// A FAKE Crossfade server for browser checks (ADR 0029). Playwright answers the three Edge
// Functions and the database functions here, so no check reaches the real Supabase or Spotify.
// Matching returns the recorded build (src/sample/build-sample.json) unless a check sets its own.
// Links published here are kept for this check file's process, so a second browser (a friend's
// phone) can open them through get_link.
const fs = require("node:fs");
const path = require("node:path");

const SAMPLE = JSON.parse(fs.readFileSync(path.join(__dirname, "../../src/sample/build-sample.json"), "utf8")).report;
let report = SAMPLE;
const drafts = new Map(); // build_id → report
const links = new Map(); // code → get_link's answer
const calls = []; // { fn, body } for checks that look at what was sent
const started = new Map(); // build_id → when matching began, for get_build's progress
const MATCH_MS = 1500; // long enough for the page to show a "Matching X of N…" line

// Two songs search-songs can return. Real-shaped ids, made-up songs.
const SONGS = [
  { id: "4iV5W9uYEdYUVa79Axb7Rh", title: "Test Song One", artists: "Test Artist", artwork: null, duration_ms: 201000, explicit: false },
  { id: "1301WleyT98MSxVHPZCA6M", title: "Test Song Two", artists: "Test Artist", artwork: null, duration_ms: 185000, explicit: true },
];

function setReport(r) { report = r || SAMPLE; }

function code10() {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 10 }, () => A[Math.floor(Math.random() * 62)]).join("");
}

const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const bodyOf = (route) => { try { return JSON.parse(route.request().postData() || "{}"); } catch (e) { return {}; } };
const authed = (route) => /^Bearer \S+/.test(route.request().headers()["authorization"] || "");

async function stubServer(ctx) {
  await ctx.route("**/functions/v1/match-playlist", (route) => {
    const b = bodyOf(route); calls.push({ fn: "match", body: b });
    if (!authed(route)) return json(route, 401, { error: "Sign in to make a link." });
    const r = JSON.parse(JSON.stringify(report));
    drafts.set(b.build_id, r);
    started.set(b.build_id, { at: Date.now(), total: r.tracks.length });
    return new Promise((done) => setTimeout(done, MATCH_MS)).then(() =>
      json(route, 200, { build_id: b.build_id, report: r, publishable: r.tracks.some((t) => t.tier !== "unmatched") }));
  });
  await ctx.route("**/functions/v1/search-songs", (route) => {
    const b = bodyOf(route); calls.push({ fn: "search", body: b });
    if (!String(b.q || "").trim()) return json(route, 400, { error: "Type a song or an artist to search." });
    return json(route, 200, { songs: SONGS });
  });
  await ctx.route("**/functions/v1/publish-link", (route) => {
    const b = bodyOf(route); calls.push({ fn: "publish", body: b });
    const d = drafts.get(b.build_id);
    if (!d) return json(route, 404, { error: "That match isn't here anymore. Paste the link again." });
    drafts.delete(b.build_id);
    const removed = new Set(b.remove || []);
    const kept = d.tracks.filter((t) => !removed.has(t.position));
    const last = d.tracks.reduce((m, t) => Math.max(m, t.position), 0);
    const added = (b.add || []).map((id, i) => {
      const s = SONGS.find((x) => x.id === id);
      return { position: last + 1 + i, title: s.title, artist: s.artists, tier: "added", spotify: { id: s.id, title: s.title, artists: s.artists },
        artwork: s.artwork, duration_ms: s.duration_ms, near: null };
    });
    const tracks = kept.concat(added);
    const out = { ...d, matched: kept.filter((t) => t.tier !== "unmatched").length, total: kept.length, tracks };
    const code = code10();
    const playlist = SAMPLE.spotify_playlist_id || "65q3ybp851nrVfF2WzOZez";
    links.set(code, {
      code, name: String(b.title || "").trim() || d.name, owner: d.owner, artwork_url: d.artwork, spotify_playlist_id: playlist, sender: "test_sender",
      tracks: tracks.map((t, i) => ({ position: i, source_title: t.title, source_artist: t.artist, tier: t.tier,
        spotify_track_id: t.spotify ? t.spotify.id : null, spotify_title: t.spotify ? t.spotify.title : null, spotify_artists: t.spotify ? t.spotify.artists : null,
        artwork_url: t.artwork, duration_ms: t.duration_ms, near_track_id: t.near ? t.near.id : null,
        near_title: t.near ? t.near.title : null, near_artists: t.near ? t.near.artists : null })),
    });
    return json(route, 200, { code, report: out, spotify_playlist_id: playlist });
  });
  await ctx.route("**/rest/v1/rpc/get_build", (route) => {
    const s = started.get(bodyOf(route).p_id);
    if (!s) return json(route, 200, null);
    const done = Math.min(s.total, Math.floor((Date.now() - s.at) / MATCH_MS * s.total));
    return json(route, 200, { done, total: s.total, status: "running" });
  });
  await ctx.route("**/rest/v1/rpc/get_link", (route) => json(route, 200, links.get(bodyOf(route).p_code) || null));
  return ctx;
}

// After tapping Create link: wait for the match, then tap Create playlist (unless a field
// error or a build error stopped it), then wait for the link or an error.
async function finishBuild(page) {
  await page.waitForFunction(() => !document.querySelector("#build-progress"));
  if (!(await page.$("#publish"))) return;
  await page.click("#publish");
  await page.waitForFunction(() => document.querySelector("#made-url") || (document.querySelector("#draft-error") || {}).textContent ||
    document.querySelector("#create-result .notice.error"));
}

module.exports = { stubServer, finishBuild, setReport, calls, links, SONGS };
