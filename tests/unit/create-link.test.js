// Unit tests for supabase/functions/create-link/build.ts, architecture §2 steps 1–9.
// Apple is the saved real share page; Spotify and the database are FAKES (tests/fakes/).
// No network, no secrets.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FIXTURE = fs.readFileSync(path.join(__dirname, "../fixtures/apple-70-degrees-out.html"), "utf8");
const LINK = "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D";
const PASS = "correct horse";
const T0 = Date.parse("2026-11-05T12:00:00Z");

async function setup(opts = {}) {
  const build = await import("../../supabase/functions/create-link/build.ts");
  const apple = await import("../../supabase/functions/create-link/apple.ts");
  const { FakeSpotify, catalogFrom } = await import("../fakes/fake-spotify.mts");
  const { FakeDb } = await import("../fakes/fake-db.mts");

  const playlist = opts.playlist ?? apple.readSharePage(FIXTURE, "pl.u-LdbqEzvu2jzpe8D");
  const spotify = new FakeSpotify(opts.catalog ?? catalogFrom(playlist.tracks, opts.twists ?? {}), {
    failures: opts.failures, searchDelayMs: opts.searchDelayMs,
  });
  const db = new FakeDb(opts.seedBuildTimes);
  Object.assign(db.fail, opts.dbFail ?? {});
  let clock = T0;
  const slept = [];
  const logs = [];
  const appleCalls = [];
  const deps = {
    senderPasscode: "senderPasscode" in opts ? opts.senderPasscode : PASS,
    readApple: async (url) => {
      appleCalls.push(url);
      if (opts.appleError) throw new apple.AppleError(opts.appleError);
      return playlist;
    },
    connectSpotify: () => spotify.connect(),
    db,
    now: () => clock,
    sleep: async (ms) => { slept.push(ms); clock += ms; },
    randomCode: build.randomCode,
    newBuildId: () => "00000000-0000-4000-8000-000000000000",
    log: (event, data) => logs.push({ event, data }),
  };
  const run = (input = {}) => build.createLink({ link: LINK, passcode: PASS, build_id: "11111111-1111-4111-8111-111111111111", ...input }, deps);
  return { build, apple, spotify, db, deps, run, slept, logs, appleCalls, playlist, advance: (ms) => { clock += ms; } };
}

const noOutsideCalls = (s) => {
  assert.deepEqual(s.appleCalls, [], "Apple was called");
  assert.equal(s.spotify.calls.length, 0, "Spotify was called");
};

// --- The happy path ---

test("builds a link from the real 52-track page: playlist, report and saved rows agree", async () => {
  const s = await setup({ twists: { 2: "missing", 7: "live-only", 9: "explicit-flip", 14: "long-edit", 20: "live-first" } });
  const out = await s.run();
  assert.equal(out.http, 200);
  const { code, report } = out.body;
  assert.match(code, /^[A-Za-z0-9]{10}$/);

  // Report (R3): every source row, in order, 4 unmatched.
  assert.equal(report.total, 52);
  assert.equal(report.matched, 48);
  assert.deepEqual(report.tracks.map((t) => t.position), Array.from({ length: 52 }, (_, i) => i + 1));
  assert.deepEqual(report.tracks.filter((t) => t.tier === "unmatched").map((t) => t.position), [2, 7, 9, 14]);
  assert.equal(report.tracks[19].spotify.id, "fake-20", "live-first picks the studio version");
  assert.equal(report.tracks[12].artist, "DJ Snake & AlunaGeorge");
  assert.equal(report.tracks[12].spotify.artists, "DJ Snake, AlunaGeorge");

  // Spotify playlist (R4): name, description, matched tracks only, source order.
  const [[id, pl]] = [...s.spotify.playlists];
  assert.equal(pl.name, "70 degrees out");
  assert.equal(pl.description, "Rebuilt from Apple Music by Crossfade. 48 of 52 tracks matched.");
  const expected = report.tracks.filter((t) => t.tier !== "unmatched").map((t) => "spotify:track:" + t.spotify.id);
  assert.deepEqual(pl.uris, expected);

  // Saved rows (architecture §4): 0-based positions, isrc always null.
  const [saved] = s.db.links;
  assert.equal(saved.code, code);
  assert.equal(saved.spotify_playlist_id, id);
  assert.equal(saved.source_url, LINK);
  assert.equal(saved.track_count, 52);
  assert.equal(saved.matched_count, 48);
  assert.deepEqual(saved.tracks.map((t) => t.position), Array.from({ length: 52 }, (_, i) => i));
  assert.ok(saved.tracks.every((t) => t.isrc === null));
  assert.deepEqual(saved.tracks[1], {
    position: 1, source_title: "Breathe", source_artist: "Malcolm Todd", isrc: null,
    tier: "unmatched", spotify_track_id: null, spotify_title: null, spotify_artists: null,
  });
  assert.equal(s.db.builds.get("11111111-1111-4111-8111-111111111111").status, "ok");
});

test("progress: total is set once, done counts up to it, then status ok", async () => {
  const s = await setup();
  await s.run();
  const dones = s.db.progress.filter((p) => "done" in p).map((p) => p.done);
  assert.deepEqual(dones, [0, ...Array.from({ length: 52 }, (_, i) => i + 1)]);
  assert.deepEqual(s.db.progress[0], { total: 52, done: 0 });
  assert.deepEqual(s.db.progress.at(-1), { status: "ok" });
});

test("runs at most 5 searches at once, one per track", async () => {
  const s = await setup({ searchDelayMs: 2 });
  await s.run();
  assert.equal(s.spotify.count("search"), 52);
  assert.equal(s.spotify.maxInFlight, 5);
});

test("duplicates are kept, in place (R4)", async () => {
  const s0 = await setup();
  const t = s0.playlist.tracks;
  const playlist = { ...s0.playlist, tracks: [t[0], t[1], { ...t[0], position: 3 }].map((x, i) => ({ ...x, position: i + 1 })) };
  const s = await setup({ playlist });
  const out = await s.run();
  assert.deepEqual([...s.spotify.playlists.values()][0].uris, ["spotify:track:fake-1", "spotify:track:fake-2", "spotify:track:fake-1"]);
  assert.equal(out.body.report.tracks.length, 3);
});

test("a music video is unmatched and never searched", async () => {
  const s0 = await setup();
  const t = s0.playlist.tracks;
  const playlist = { ...s0.playlist, tracks: [t[0], { ...t[1], kind: "musicVideo" }] };
  const s = await setup({ playlist });
  const out = await s.run();
  assert.equal(s.spotify.count("search"), 1);
  assert.equal(out.body.report.tracks[1].tier, "unmatched");
});

test("playlist name is cut to 100 code points, or Untitled playlist", async () => {
  const { build } = await setup();
  const long = "🎵".repeat(150);
  assert.equal(Array.from(build.playlistName(long)).length, 100);
  assert.equal(build.playlistName(long), "🎵".repeat(100)); // never half an emoji
  assert.equal(build.playlistName(""), "Untitled playlist");
  assert.equal(build.playlistName("   "), "Untitled playlist");
});

test("link codes are 10 characters from [A-Za-z0-9] and differ each time", async () => {
  const { build } = await setup();
  const codes = new Set(Array.from({ length: 200 }, () => build.randomCode()));
  assert.equal(codes.size, 200);
  for (const c of codes) assert.match(c, /^[A-Za-z0-9]{10}$/);
});

test("the same link twice makes two links and two playlists (no de-duplication)", async () => {
  const s = await setup();
  const a = await s.run({ build_id: "22222222-2222-4222-8222-222222222222" });
  const b = await s.run({ build_id: "33333333-3333-4333-8333-333333333333" });
  assert.notEqual(a.body.code, b.body.code);
  assert.equal(s.spotify.playlists.size, 2);
});

// --- Step 1: passcode ---

test("Negative: a wrong or empty passcode is rejected before any call or row", async () => {
  for (const passcode of ["wrong", "", undefined, "correct horse ", "Correct horse"]) {
    const s = await setup();
    const out = await s.run({ passcode });
    assert.deepEqual(out, { http: 401, body: { error: "Wrong passcode." } }, String(passcode));
    noOutsideCalls(s);
    assert.equal(s.db.builds.size, 0, "a wrong passcode must not count toward the rate limit");
  }
});

test("Negative: an unset SENDER_PASSCODE fails on Crossfade's side, even for an empty passcode", async () => {
  for (const senderPasscode of [undefined, ""]) {
    const s = await setup({ senderPasscode });
    const out = await s.run({ passcode: "" });
    assert.equal(out.http, 500);
    assert.equal(out.body.error, "Something failed on Crossfade's side. Nothing was sent. Try again.");
    noOutsideCalls(s);
  }
});

test("the passcode never reaches the logs", async () => {
  const s = await setup({ failures: [{ method: "addTracks", status: 500 }] });
  await s.run();
  await s.run({ passcode: "a-wrong-guess" });
  const text = JSON.stringify(s.logs);
  assert.ok(!text.includes(PASS) && !text.includes("a-wrong-guess"));
});

// --- Step 2: link format ---

test("Negative: a non-playlist or non-US link is rejected before any call or row", async () => {
  for (const [link, error] of [
    ["", "That isn't an Apple Music playlist link."],
    ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "That isn't an Apple Music playlist link."],
    ["https://music.apple.com/us/album/sos/1657869377", "That isn't an Apple Music playlist link."],
    ["https://music.apple.com/gb/playlist/late-train-home/pl.u-8aAVZ", "Crossfade only handles US Apple Music links."],
  ]) {
    const s = await setup();
    const out = await s.run({ link });
    assert.deepEqual(out, { http: 400, body: { error } }, link);
    noOutsideCalls(s);
    assert.equal(s.db.builds.size, 0);
  }
});

// --- Steps 3–4: rate limit ---

test("19 builds in the last hour still allows one more", async () => {
  const s = await setup({ seedBuildTimes: Array.from({ length: 19 }, (_, i) => T0 - i * 60_000) });
  assert.equal((await s.run()).http, 200);
});

test("Negative: the 21st build in an hour is refused, with minutes until a slot frees", async () => {
  // 20 builds: the oldest 50 min ago, so a slot frees in 10 min.
  const times = Array.from({ length: 20 }, (_, i) => T0 - 50 * 60_000 + i * 1000);
  const s = await setup({ seedBuildTimes: times });
  const out = await s.run();
  assert.deepEqual(out, { http: 429, body: { error: "Crossfade is rate-limited. Try again in 10 minutes." } });
  noOutsideCalls(s);
  assert.equal(s.db.builds.size, 20, "a refused build isn't counted");
});

test("Negative: rate-limit minutes round up, minimum 1", async () => {
  const s = await setup({ seedBuildTimes: Array.from({ length: 20 }, () => T0 - HOUR() + 5_000) });
  assert.equal((await s.run()).body.error, "Crossfade is rate-limited. Try again in 1 minute.");
  function HOUR() { return 60 * 60 * 1000; }
});

test("builds older than an hour don't count", async () => {
  const s = await setup({ seedBuildTimes: Array.from({ length: 30 }, () => T0 - 61 * 60_000) });
  assert.equal((await s.run()).http, 200);
});

test("Negative: the database failing at the rate-limit check is Crossfade's side, nothing called", async () => {
  const s = await setup({ dbFail: { buildTimesSince: true } });
  const out = await s.run();
  assert.equal(out.body.error, "Something failed on Crossfade's side. Nothing was sent. Try again.");
  noOutsideCalls(s);
});

test("a failed Apple read still counts toward the rate limit (R6)", async () => {
  const s = await setup({ appleError: "not-shared" });
  await s.run();
  assert.equal(s.db.builds.size, 1);
  assert.equal([...s.db.builds.values()][0].status, "failed");
});

// --- Step 5: Apple ---

test("Negative: each Apple failure shows its own message and creates nothing", async () => {
  for (const [kind, http, error] of [
    ["not-shared", 422, "Apple Music wouldn't share this playlist. Check that it's shared by link."],
    ["empty", 422, "This playlist is empty."],
    ["too-many", 422, "This playlist has more than 100 tracks. Crossfade handles up to 100."],
    ["apple-failed", 502, "Something failed on Apple Music's side. Nothing was sent. Try again."],
  ]) {
    const s = await setup({ appleError: kind });
    assert.deepEqual(await s.run(), { http, body: { error } }, kind);
    assert.equal(s.spotify.calls.length, 0);
    assert.equal(s.db.links.length, 0);
  }
});

// --- Step 6: matching and retries ---

test("a 429 on a search waits Retry-After, retries once, and succeeds", async () => {
  const s = await setup({ failures: [{ method: "search", call: 3, status: 429, retryAfterS: 2 }] });
  const out = await s.run();
  assert.equal(out.http, 200);
  assert.deepEqual(s.slept, [2000]);
  assert.equal(s.spotify.count("search"), 53);
});

test("a timed-out search is retried once at once", async () => {
  const s = await setup({ failures: [{ method: "search", call: 1, status: 0 }] });
  assert.equal((await s.run()).http, 200);
  assert.deepEqual(s.slept, []);
});

test("Negative: a search that fails twice stops the build on Spotify's side, nothing created", async () => {
  const s = await setup({ failures: [{ method: "search", title: "Royals", status: 429, retryAfterS: 1, times: 2 }] });
  const out = await s.run();
  assert.deepEqual(out, { http: 502, body: { error: "Something failed on Spotify's side. Nothing was sent. Try again." } });
  assert.equal(s.spotify.count("createPlaylist"), 0);
  assert.equal(s.db.links.length, 0);
  assert.equal([...s.db.builds.values()][0].status, "failed");
});

test("Negative: a Retry-After that would pass 120 s fails at once instead of waiting", async () => {
  const s = await setup({ failures: [{ method: "search", call: 1, status: 429, retryAfterS: 121 }] });
  const out = await s.run();
  assert.equal(out.http, 502);
  assert.deepEqual(s.slept, []);
});

test("Negative: a 401 or 500 on a search is not retried", async () => {
  for (const status of [401, 500]) {
    const s = await setup({ failures: [{ method: "search", call: 1, status }] });
    assert.equal((await s.run()).body.error, "Something failed on Spotify's side. Nothing was sent. Try again.");
    assert.deepEqual(s.slept, []);
  }
});

test("Negative: Spotify refusing the token fails before any search", async () => {
  const s = await setup({ failures: [{ method: "connect", status: 400 }] });
  assert.equal((await s.run()).body.error, "Something failed on Spotify's side. Nothing was sent. Try again.");
  assert.equal(s.spotify.count("search"), 0);
});

// --- Step 7: zero matched ---

test("Negative: zero matched returns the full report, creates no playlist and issues no link", async () => {
  const s = await setup({ catalog: [] });
  const out = await s.run();
  assert.equal(out.http, 200);
  assert.equal(out.body.code, null);
  assert.equal(out.body.report.matched, 0);
  assert.equal(out.body.report.tracks.length, 52);
  assert.ok(out.body.report.tracks.every((t) => t.tier === "unmatched" && t.spotify === null));
  assert.equal(s.spotify.count("createPlaylist"), 0);
  assert.equal(s.db.links.length, 0);
});

// --- Steps 8–9: writes and cleanup ---

test("Negative: creating the playlist fails → Spotify's side, nothing to clean up", async () => {
  const s = await setup({ failures: [{ method: "createPlaylist", status: 500 }] });
  assert.equal((await s.run()).body.error, "Something failed on Spotify's side. Nothing was sent. Try again.");
  assert.equal(s.spotify.count("removePlaylist"), 0);
  assert.equal(s.db.links.length, 0);
});

test("Negative: adding tracks fails → the new playlist is removed, no link", async () => {
  const s = await setup({ failures: [{ method: "addTracks", status: 500 }] });
  const out = await s.run();
  assert.equal(out.body.error, "Something failed on Spotify's side. Nothing was sent. Try again.");
  assert.deepEqual(s.spotify.removed, ["fakeplaylist1"]);
  assert.equal(s.db.links.length, 0);
});

test("Negative: saving the link fails → Crossfade's side, the playlist is removed", async () => {
  const s = await setup({ dbFail: { saveLink: true } });
  const out = await s.run();
  assert.deepEqual(out, { http: 500, body: { error: "Something failed on Crossfade's side. Nothing was sent. Try again." } });
  assert.deepEqual(s.spotify.removed, ["fakeplaylist1"]);
});

test("Negative: if the cleanup also fails, the playlist id is logged and the sender sees the same message", async () => {
  const s = await setup({ dbFail: { saveLink: true }, failures: [{ method: "removePlaylist", status: 503 }] });
  const out = await s.run();
  assert.equal(out.body.error, "Something failed on Crossfade's side. Nothing was sent. Try again.");
  const entry = s.logs.find((l) => l.event === "cleanup-failed");
  assert.equal(entry.data.spotify_playlist_id, "fakeplaylist1");
});

test("a missing or malformed build_id gets a fresh one instead of failing", async () => {
  const s = await setup();
  await s.run({ build_id: "not-a-uuid" });
  assert.ok(s.db.builds.has("00000000-0000-4000-8000-000000000000"));
});

test("samePasscode: equal strings match, anything else doesn't", async () => {
  const { build } = await setup();
  assert.equal(await build.samePasscode("abc", "abc"), true);
  assert.equal(await build.samePasscode("abd", "abc"), false);
  assert.equal(await build.samePasscode("", "abc"), false);
  assert.equal(await build.samePasscode(undefined, "abc"), false);
  assert.equal(await build.samePasscode({ toString: () => "abc" }, "abc"), true); // String() of an object; JSON bodies can't send one
});
