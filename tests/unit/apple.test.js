// Unit tests for supabase/functions/create-link/apple.ts (ADR 0012). No install needed:
// Node 24 strips the TypeScript types itself. Nothing here calls Apple; the real page is
// a saved fixture (tests/fixtures/apple-70-degrees-out.html, fetched 2026-11-05).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const load = () => import("../../supabase/functions/create-link/apple.ts");
const FIXTURE = fs.readFileSync(path.join(__dirname, "../fixtures/apple-70-degrees-out.html"), "utf8");

// A share page with only what readSharePage reads. items: track-list items; header: overrides.
function page(items, header = {}) {
  const data = { data: [{ intent: {}, data: { sections: [
    { id: "playlist-detail-header-section - pl.u-test", items: [{ title: "Test", trackCount: items.length, ...header }] },
    { id: "track-list - pl.u-test", items },
  ] } }] };
  return '<script type="application/json" id="serialized-server-data">' + JSON.stringify(data) + "</script>";
}
const song = (title, extra = {}) => ({
  title, artistName: "Artist", subtitleLinks: [{ title: "Artist" }], duration: 200000,
  showExplicitBadge: false, contentDescriptor: { kind: "song", identifiers: { storeAdamID: "1" } }, ...extra,
});
const kindOf = async (fn) => {
  const { AppleError } = await load();
  try { await fn(); } catch (e) { assert.ok(e instanceof AppleError, "expected AppleError, got " + e); return e.kind; }
  assert.fail("expected it to throw");
};

// --- Step 2: which links count (PRD R1) ---

test("accepts a US playlist link and ignores a trailing slash and query string", async () => {
  const { parseAppleLink } = await load();
  for (const link of [
    "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D",
    "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D/",
    "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D?l=en",
    "  http://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D?ls  ",
  ]) {
    assert.deepEqual(parseAppleLink(link), {
      id: "pl.u-LdbqEzvu2jzpe8D",
      url: "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D",
    }, link);
  }
});

test("accepts Apple's editorial playlists (pl. without u-)", async () => {
  const { parseAppleLink } = await load();
  assert.equal(parseAppleLink("https://music.apple.com/us/playlist/top-100-global/pl.d25f5d1181894928af76c85c967f8f31").id,
    "pl.d25f5d1181894928af76c85c967f8f31");
});

test("Negative: empty, Spotify, album and malformed links are not-playlist", async () => {
  const { parseAppleLink } = await load();
  for (const link of [
    "", "   ", "not a link", undefined,
    "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    "https://music.apple.com/us/album/sos/1657869377",
    "https://music.apple.com/us/playlist/pl.u-LdbqEzvu2jzpe8D", // no slug
    "https://music.apple.com/us/playlist/name/1657869377", // id isn't pl.
    "https://music.apple.com.evil.example/us/playlist/name/pl.u-1",
    "ftp://music.apple.com/us/playlist/name/pl.u-1",
  ]) {
    assert.equal(await kindOf(() => parseAppleLink(link)), "not-playlist", String(link));
  }
});

test("Negative: a valid-looking link from another storefront is not-us", async () => {
  const { parseAppleLink } = await load();
  assert.equal(await kindOf(() => parseAppleLink("https://music.apple.com/gb/playlist/late-train-home/pl.u-8aAVZ")), "not-us");
});

// --- Step 5: reading the page ---

test("reads all 52 tracks from the real share page, in order", async () => {
  const { readSharePage } = await load();
  const p = readSharePage(FIXTURE, "pl.u-LdbqEzvu2jzpe8D");
  assert.equal(p.name, "70 degrees out");
  assert.equal(p.trackCount, 52);
  assert.equal(p.tracks.length, 52);
  assert.deepEqual(p.tracks.map((t) => t.position), Array.from({ length: 52 }, (_, i) => i + 1));
  assert.deepEqual(p.tracks[0], {
    position: 1, appleId: "1438243880", kind: "song", title: "Babydoll",
    artistName: "Dominic Fike", primaryArtist: "Dominic Fike", durationMs: 97960, explicit: false,
  });
  assert.equal(p.tracks.at(-1).title, "The Heart Wants What It Wants");
});

test("primary artist is the first subtitle link, not the joined string", async () => {
  const { readSharePage } = await load();
  const t = readSharePage(FIXTURE).tracks;
  const djSnake = t.find((x) => x.title === "You Know You Like It");
  assert.equal(djSnake.artistName, "DJ Snake & AlunaGeorge");
  assert.equal(djSnake.primaryArtist, "DJ Snake");
  // A comma inside one artist's name isn't a split point.
  assert.equal(t.find((x) => x.title === "Judge Judy").primaryArtist, "Tyler, The Creator");
});

test("explicit comes only from showExplicitBadge === true", async () => {
  const { readSharePage } = await load();
  const t = readSharePage(FIXTURE).tracks;
  assert.equal(t.find((x) => x.title === "Good Days").explicit, true);
  assert.equal(t.find((x) => x.title === "Babydoll").explicit, false);
  const odd = readSharePage(page([
    song("a", { showExplicitBadge: "true" }), song("b", { showExplicitBadge: undefined }), song("c", { showExplicitBadge: 1 }),
  ])).tracks;
  assert.deepEqual(odd.map((x) => x.explicit), [false, false, false]);
});

test("with no subtitle links, primary artist is artistName unchanged", async () => {
  const { readSharePage } = await load();
  const [t] = readSharePage(page([song("x", { subtitleLinks: [], artistName: "A & B" })])).tracks;
  assert.equal(t.primaryArtist, "A & B");
});

test("a music video is kept in place with its kind, so R2 can mark it unmatched", async () => {
  const { readSharePage } = await load();
  const t = readSharePage(page([song("a"), song("v", { contentDescriptor: { kind: "musicVideo" } }), song("c")])).tracks;
  assert.deepEqual(t.map((x) => [x.position, x.kind]), [[1, "song"], [2, "musicVideo"], [3, "song"]]);
});

test("duplicates stay as separate rows (R4)", async () => {
  const { readSharePage } = await load();
  const t = readSharePage(page([song("same"), song("same")])).tracks;
  assert.deepEqual(t.map((x) => [x.position, x.title]), [[1, "same"], [2, "same"]]);
});

test("exactly 100 tracks is allowed", async () => {
  const { readSharePage } = await load();
  assert.equal(readSharePage(page(Array.from({ length: 100 }, (_, i) => song("t" + i)))).tracks.length, 100);
});

test("Negative: 0 tracks is empty", async () => {
  const { readSharePage } = await load();
  assert.equal(await kindOf(() => readSharePage(page([]))), "empty");
});

test("Negative: 101 tracks is too-many, even if the page only holds the first batch", async () => {
  const { readSharePage } = await load();
  assert.equal(await kindOf(() => readSharePage(page(Array.from({ length: 101 }, (_, i) => song("t" + i))))), "too-many");
  assert.equal(await kindOf(() => readSharePage(page([song("a")], { trackCount: 250 }))), "too-many");
});

test("Negative: fewer items than the header promises fails instead of dropping tracks", async () => {
  const { readSharePage } = await load();
  assert.equal(await kindOf(() => readSharePage(page([song("a"), song("b")], { trackCount: 3 }))), "apple-failed");
});

test("Negative: a page Apple changed (no block, bad JSON, no track-list) is apple-failed", async () => {
  const { readSharePage } = await load();
  for (const html of [
    "<html>nothing here</html>",
    '<script type="application/json" id="serialized-server-data">{not json</script>',
    '<script type="application/json" id="serialized-server-data">{"data":[]}</script>',
    '<script type="application/json" id="serialized-server-data">' +
      JSON.stringify({ data: [{ data: { sections: [{ id: "something-else", items: [] }] } }] }) + "</script>",
  ]) {
    assert.equal(await kindOf(() => readSharePage(html)), "apple-failed", html.slice(0, 60));
  }
});

// --- Step 5: fetching, with a fake fetch ---

const fakeFetch = (status, body = "", seen = []) => async (url) => { seen.push(url); return new Response(body, { status }); };

test("fetchPlaylist fetches the cleaned URL and parses it", async () => {
  const { fetchPlaylist } = await load();
  const seen = [];
  const p = await fetchPlaylist("https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D/?l=en", fakeFetch(200, FIXTURE, seen));
  assert.deepEqual(seen, ["https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D"]);
  assert.equal(p.id, "pl.u-LdbqEzvu2jzpe8D");
  assert.equal(p.tracks.length, 52);
});

test("Negative: a bad link makes no request at all", async () => {
  const { fetchPlaylist } = await load();
  const seen = [];
  assert.equal(await kindOf(() => fetchPlaylist("https://open.spotify.com/playlist/x", fakeFetch(200, "", seen))), "not-playlist");
  assert.deepEqual(seen, []);
});

test("Negative: 404 is not-shared; 500, 403 and a network error are apple-failed", async () => {
  const { fetchPlaylist } = await load();
  const link = "https://music.apple.com/us/playlist/x/pl.u-1";
  assert.equal(await kindOf(() => fetchPlaylist(link, fakeFetch(404))), "not-shared");
  assert.equal(await kindOf(() => fetchPlaylist(link, fakeFetch(500))), "apple-failed");
  assert.equal(await kindOf(() => fetchPlaylist(link, fakeFetch(403))), "apple-failed");
  assert.equal(await kindOf(() => fetchPlaylist(link, async () => { throw new TypeError("fetch failed"); })), "apple-failed");
});
