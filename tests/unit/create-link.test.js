// Unit tests for supabase/functions/create-link/build.ts, architecture §2 steps 1–9, split into
// matchPlaylist, searchSongs and publishLink (ADR 0029). createLink is match then publish.
// Apple is the saved real share page; Spotify and the database are FAKES (tests/fakes/).
// No network, no secrets.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FIXTURE = fs.readFileSync(path.join(__dirname, "../fixtures/apple-70-degrees-out.html"), "utf8");
const LINK = "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D";
const USER = "test-user";
const BUILD = "11111111-1111-4111-8111-111111111111";
// A song only the edit screen adds: real-shaped id (22 characters), Spotify CDN art.
const EXTRA = { id: "7yNf9YjeO5JXUE3JEBgnYc", uri: "spotify:track:7yNf9YjeO5JXUE3JEBgnYc", name: "Kill Bill",
  artists: [{ name: "SZA" }], duration_ms: 153946, explicit: true,
  album: { images: [{ url: "https://i.scdn.co/image/640", width: 640 }, { url: "https://i.scdn.co/image/300", width: 300 }, { url: "https://evil.example/64", width: 64 }] } };
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
  const db = new FakeDb(opts.seedBuildTimes, opts.seedOwner);
  Object.assign(db.fail, opts.dbFail ?? {});
  let clock = T0;
  const slept = [];
  const logs = [];
  const appleCalls = [];
  db.now = () => clock;
  const deps = {
    userId: "userId" in opts ? opts.userId : USER,
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
  const run = (input = {}) => build.createLink({ link: LINK, build_id: BUILD, ...input }, deps);
  const match = (input = {}) => build.matchPlaylist({ link: LINK, build_id: BUILD, ...input }, deps);
  const publish = (input = {}) => build.publishLink({ build_id: BUILD, ...input }, deps);
  const search = (q) => build.searchSongs({ q }, deps);
  return { build, apple, spotify, db, deps, run, match, publish, search, slept, logs, appleCalls, playlist, advance: (ms) => { clock += ms; } };
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
    artwork_url: saved.tracks[1].artwork_url, duration_ms: report.tracks[1].duration_ms,
    near_track_id: null, near_title: null, near_artists: null,
  });
  // ADR 0025: the owner, the cover, and each song's cover and length travel with the link.
  assert.equal(saved.owner, "Aaliyah Avalo");
  assert.equal(saved.owner, report.owner);
  assert.match(saved.artwork_url, /mzstatic\.com/);
  assert.ok(report.tracks.every((t) => /^https:\/\/[^/]*mzstatic\.com\//.test(t.artwork) && t.duration_ms > 0));
  // ADR 0026: the live-only track is unmatched but offers its (Live) version as a near one.
  assert.match(report.tracks[6].near.title, /\(Live\)$/);
  assert.equal(saved.tracks[6].near_title, report.tracks[6].near.title);
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

// --- Step 1: signed in (ADR 0019, 0029) ---

test("Negative: signed out is rejected before any call or row, on match, search and publish", async () => {
  for (const userId of [null, undefined, ""]) {
    const s = await setup({ userId });
    assert.deepEqual(await s.run(), { http: 401, body: { error: "Sign in to make a link." } }, String(userId));
    assert.deepEqual(await s.search("SZA"), { http: 401, body: { error: "Sign in to make a link." } });
    assert.deepEqual(await s.publish(), { http: 401, body: { error: "Sign in to make a link." } });
    noOutsideCalls(s);
    assert.equal(s.db.builds.size, 0, "signed out must not count toward the rate limit");
  }
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

// --- ADR 0029: match, edit, publish ---

const ERR = {
  gone: "That match isn't here anymore. Paste the link again.",
  expired: "That match is over an hour old. Paste the link again.",
  made: "You already made a link from this match.",
  edit: "Those changes didn't add up. Reload the page and try again.",
  empty: "There are no songs left to put in the playlist.",
  daily: "You've made 10 links today. You can make more tomorrow.",
};
const withExtra = async (opts = {}) => {
  const s0 = await setup();
  const { catalogFrom } = await import("../fakes/fake-spotify.mts");
  return setup({ catalog: [...catalogFrom(s0.playlist.tracks, opts.twists ?? {}), EXTRA], ...opts });
};

test("match saves a draft and touches nothing on Spotify", async () => {
  const s = await setup({ twists: { 2: "missing" } });
  const out = await s.match();
  assert.equal(out.http, 200);
  assert.equal(out.body.build_id, BUILD);
  assert.equal(out.body.publishable, true);
  assert.equal(out.body.report.matched, 51);
  const b = s.db.builds.get(BUILD);
  assert.equal(b.status, "matched");
  assert.equal(b.owner_id, USER);
  assert.deepEqual(b.draft.report, out.body.report);
  assert.equal(b.draft.source_url, LINK);
  assert.equal(s.spotify.count("createPlaylist") + s.spotify.count("addTracks"), 0);
  assert.equal(s.db.links.length, 0);
});

test("publish with no edits makes the same playlist createLink does, named by the sender", async () => {
  const s = await setup();
  await s.match();
  const out = await s.publish({ title: "  chilling  " });
  assert.equal(out.http, 200);
  assert.equal(out.body.spotify_playlist_id, [...s.spotify.playlists.keys()][0], "Create shows Play in Spotify from this");
  const [pl] = [...s.spotify.playlists.values()];
  assert.equal(pl.name, "chilling");
  assert.equal(pl.uris.length, 52);
  const [saved] = s.db.links;
  assert.equal(saved.title, "chilling");
  assert.equal(saved.name, "70 degrees out");
  assert.equal(saved.owner_id, USER);
  assert.equal(s.db.builds.get(BUILD).status, "ok");
});

test("a blank title falls back to the Apple playlist's name", async () => {
  const s = await setup();
  await s.match();
  await s.publish({ title: "   " });
  assert.equal(s.db.links[0].title, "70 degrees out");
});

test("removed songs leave the playlist and the link; Matched X of N counts what's left", async () => {
  const s = await setup({ twists: { 2: "missing" } });
  await s.match();
  const out = await s.publish({ remove: [1, 2, 5] }); // 2 was a miss
  assert.equal(out.http, 200);
  const r = out.body.report;
  assert.equal(r.total, 49);
  assert.equal(r.matched, 49);
  assert.ok(!r.tracks.some((t) => [1, 2, 5].includes(t.position)));
  const [pl] = [...s.spotify.playlists.values()];
  assert.equal(pl.uris.length, 49);
  assert.ok(!pl.uris.includes("spotify:track:fake-1") && !pl.uris.includes("spotify:track:fake-5"));
  assert.deepEqual(s.db.links[0].tracks.map((t) => t.position), Array.from({ length: 49 }, (_, i) => i));
});

test("an added song is checked with Spotify and goes after the rest, tier added, with Spotify's cover", async () => {
  const s = await withExtra();
  await s.match();
  const out = await s.publish({ add: [EXTRA.id] });
  assert.equal(out.http, 200);
  assert.deepEqual(s.spotify.calls.filter((c) => c.method === "getTrack").map((c) => c.args[0]), [EXTRA.id]);
  const last = out.body.report.tracks.at(-1);
  assert.deepEqual({ tier: last.tier, title: last.title, artist: last.artist, position: last.position, artwork: last.artwork },
    { tier: "added", title: "Kill Bill", artist: "SZA", position: 53, artwork: "https://i.scdn.co/image/300" });
  assert.equal(out.body.report.total, 52, "an added song isn't one of the Apple rows");
  const [pl] = [...s.spotify.playlists.values()];
  assert.equal(pl.uris.at(-1), EXTRA.uri);
  assert.equal(s.db.links[0].matched_count, 53);
  assert.equal(s.db.links[0].tracks.at(-1).tier, "added");
});

test("zero matched can still be published once the sender adds a song", async () => {
  const s = await setup({ catalog: [EXTRA] });
  const m = await s.match();
  assert.equal(m.body.publishable, false);
  assert.equal(s.db.builds.get(BUILD).status, "matched");
  const out = await s.publish({ add: [EXTRA.id] });
  assert.equal(out.http, 200);
  assert.equal([...s.spotify.playlists.values()][0].uris.length, 1);
});

test("Negative: removing every song fails with nothing on Spotify", async () => {
  const s = await setup();
  await s.match();
  const out = await s.publish({ remove: Array.from({ length: 52 }, (_, i) => i + 1) });
  assert.deepEqual(out, { http: 422, body: { error: ERR.empty } });
  assert.equal(s.spotify.count("createPlaylist"), 0);
});

test("Negative: edits that don't make sense are refused before Spotify is called", async () => {
  for (const edit of [
    { remove: [99] }, { remove: [1.5] }, { remove: ["1"] }, { remove: "1" },
    { add: ["fake-1"] }, { add: ["x".repeat(22) + "<"] }, { add: "abc" }, { add: Array(51).fill(EXTRA.id) },
  ]) {
    const s = await setup();
    await s.match();
    const before = s.spotify.calls.length;
    assert.deepEqual(await s.publish(edit), { http: 400, body: { error: ERR.edit } }, JSON.stringify(edit).slice(0, 40));
    assert.ok(s.spotify.calls.slice(before).every((c) => c.method === "connect"), "no Spotify call but the token");
    assert.equal(s.db.links.length, 0);
  }
});

test("Negative: an added id Spotify doesn't have is refused, nothing made", async () => {
  const s = await setup();
  await s.match();
  assert.deepEqual(await s.publish({ add: ["0000000000000000000000"] }), { http: 400, body: { error: ERR.edit } });
  assert.equal(s.spotify.count("createPlaylist"), 0);
});

test("Negative: another sender's draft, a missing one, or a bad id is not found", async () => {
  const s = await setup();
  await s.match();
  s.deps.userId = "someone-else";
  assert.deepEqual(await s.publish(), { http: 404, body: { error: ERR.gone } });
  s.deps.userId = USER;
  assert.deepEqual(await s.publish({ build_id: "99999999-9999-4999-8999-999999999999" }), { http: 404, body: { error: ERR.gone } });
  assert.deepEqual(await s.publish({ build_id: "not-a-uuid" }), { http: 404, body: { error: ERR.gone } });
  assert.equal(s.spotify.count("createPlaylist"), 0);
});

test("Negative: a draft over an hour old has expired", async () => {
  const s = await setup();
  await s.match();
  s.advance(60 * 60 * 1000 + 1);
  assert.deepEqual(await s.publish(), { http: 410, body: { error: ERR.expired } });
  assert.equal(s.spotify.count("createPlaylist"), 0);
});

test("Negative: a draft can be published once", async () => {
  const s = await setup();
  await s.match();
  assert.equal((await s.publish()).http, 200);
  assert.deepEqual(await s.publish(), { http: 409, body: { error: ERR.made } });
  assert.equal(s.spotify.playlists.size, 1);
});

test("Negative: a failed match (Apple said no) can't be published", async () => {
  const s = await setup({ appleError: "not-shared" });
  await s.match();
  assert.deepEqual(await s.publish(), { http: 404, body: { error: ERR.gone } });
});

test("a failed Spotify write leaves the draft matched, so Try again can publish it", async () => {
  const s = await setup({ failures: [{ method: "createPlaylist", status: 500 }] });
  await s.match();
  assert.equal((await s.publish()).http, 502);
  assert.equal(s.db.builds.get(BUILD).status, "matched");
  assert.equal((await s.publish()).http, 200);
});

test("Negative: the 11th link in a day is refused (ADR 0019); links from yesterday don't count", async () => {
  const s = await setup();
  for (let i = 0; i < 10; i++) {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-" + String(i).padStart(12, "0");
    await s.match({ build_id: id });
    assert.equal((await s.publish({ build_id: id })).http, 200, "link " + (i + 1));
    s.advance(6 * 60 * 1000); // stay under 20 builds an hour
  }
  await s.match();
  assert.deepEqual(await s.publish(), { http: 429, body: { error: ERR.daily } });
  s.advance(24 * 60 * 60 * 1000);
  await s.match({ build_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
  assert.equal((await s.publish({ build_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })).http, 200);
});

test("the hourly rate limit counts only this sender's builds", async () => {
  const s = await setup({ seedOwner: "someone-else", seedBuildTimes: Array.from({ length: 20 }, (_, i) => T0 - i * 60_000) });
  assert.equal((await s.match()).http, 200);
});

// --- ADR 0029: search ---

test("search returns up to 10 songs with Spotify CDN covers only", async () => {
  const s = await withExtra();
  const out = await s.search("  kill bill ");
  assert.equal(out.http, 200);
  assert.deepEqual(out.body.songs, [{ id: EXTRA.id, title: "Kill Bill", artists: "SZA", artwork: "https://i.scdn.co/image/300", duration_ms: 153946, explicit: true }]);
  assert.deepEqual(s.spotify.calls.find((c) => c.method === "searchAny").args, ["kill bill"]);
  const many = await s.search("a");
  assert.ok(many.body.songs.length <= 10);
});

test("Negative: a blank search is refused without calling Spotify; a Spotify failure says so", async () => {
  const s = await setup();
  assert.deepEqual(await s.search("   "), { http: 400, body: { error: "Type a song or an artist to search." } });
  assert.equal(s.spotify.calls.length, 0);
  const f = await setup({ failures: [{ method: "searchAny", status: 500 }] });
  assert.deepEqual(await f.search("SZA"), { http: 502, body: { error: "Something failed on Spotify's side. Nothing was sent. Try again." } });
});
