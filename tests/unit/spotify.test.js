// Unit tests for supabase/functions/create-link/spotify.ts: what searchTrack sends (PRD R2).
// No network and no secrets: fetch is replaced for each test.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../supabase/functions/create-link/spotify.ts");

async function capture(fn) {
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push({ url: new URL(url), init }); return new Response('{"tracks":{"total":0,"items":[]}}', { status: 200 }); };
  try { await fn(); } finally { globalThis.fetch = real; }
  return seen;
}

test("searchTrack sends R2's quoted query, market=US and the first 10 results", async () => {
  const { searchTrack } = await load();
  const [req] = await capture(() => searchTrack("tok", "Suit & Tie (feat. JAŸ-Z)", "Justin Timberlake"));
  assert.equal(req.url.origin + req.url.pathname, "https://api.spotify.com/v1/search");
  assert.equal(req.url.searchParams.get("q"), 'track:"Suit & Tie (feat. JAŸ-Z)" artist:"Justin Timberlake"');
  assert.equal(req.url.searchParams.get("type"), "track");
  assert.equal(req.url.searchParams.get("market"), "US");
  assert.equal(req.url.searchParams.get("limit"), "10");
  assert.equal(req.init.headers.Authorization, "Bearer tok");
});

test("trackQuery replaces double quotes inside a name with a space (architecture §5)", async () => {
  const { trackQuery } = await load();
  assert.equal(trackQuery('The "Real" One', "SZA"), 'track:"The  Real  One" artist:"SZA"');
});

test("Negative: a non-200 from Spotify throws SpotifyError with the status and body", async () => {
  const { searchTrack, SpotifyError } = await load();
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"error":{"status":401,"message":"Invalid access token"}}', { status: 401 });
  try {
    await assert.rejects(searchTrack("bad", "a", "b"), (e) => e instanceof SpotifyError && e.status === 401 && e.body.error.message === "Invalid access token");
  } finally { globalThis.fetch = real; }
});
