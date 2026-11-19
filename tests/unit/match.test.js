// Unit tests for supabase/functions/create-link/match.ts, PRD R2's close-match rule.
// No install, no network: Spotify results are written out by hand below.
const { test } = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../supabase/functions/create-link/match.ts");

const src = (extra = {}) => ({
  position: 1, appleId: "1", kind: "song", title: "Good Days", artistName: "SZA",
  primaryArtist: "SZA", durationMs: 278480, explicit: true, ...extra,
});
const cand = (extra = {}) => ({
  id: "sp1", name: "Good Days", artists: [{ name: "SZA" }], duration_ms: 279204, explicit: true, ...extra,
});

// --- Title normalization ---

test("normalizeTitle: lowercases, drops punctuation, collapses spaces", async () => {
  const { normalizeTitle } = await load();
  assert.equal(normalizeTitle("  Can’t   Catch Me Now!  "), "cant catch me now");
  assert.equal(normalizeTitle("Pink + White"), "pink white");
  assert.equal(normalizeTitle("oh yeah?"), "oh yeah");
  assert.equal(normalizeTitle("Feel So Close (Radio Edit)"), normalizeTitle("Feel So Close - Radio Edit"));
});

test("normalizeTitle: removes feat / ft / with segments in (), [] and after ' - '", async () => {
  const { normalizeTitle } = await load();
  for (const t of [
    "Suit & Tie (feat. JAŸ-Z)", "Suit & Tie (Feat. Jay-Z)", "Suit & Tie [ft. JAY-Z]", "Suit & Tie (ft JAY-Z)",
    "Suit & Tie (feat Jay-Z)", "Suit & Tie (with JAY-Z)", "Suit & Tie - feat. JAY-Z", "Suit & Tie",
  ]) assert.equal(normalizeTitle(t), "suit tie", t);
});

test("normalizeTitle: (With You) is removed but (Without You) isn't", async () => {
  const { normalizeTitle } = await load();
  assert.equal(normalizeTitle("Song (With You)"), "song");
  assert.equal(normalizeTitle("Song (Without You)"), "song without you");
  assert.equal(normalizeTitle("Song (Featuring X)"), "song featuring x"); // not in R2's word list
});

test("normalizeTitle: never removes remix, live, acoustic, sped up, remaster, version", async () => {
  const { normalizeTitle } = await load();
  assert.equal(normalizeTitle("Royals (Live)"), "royals live");
  assert.equal(normalizeTitle("Royals - Sped Up"), "royals sped up");
  assert.equal(normalizeTitle("Royals (Acoustic Version)"), "royals acoustic version");
  assert.equal(normalizeTitle("Royals - 2023 Remaster"), "royals 2023 remaster");
  assert.equal(normalizeTitle("Royals (feat. X) [Remix]"), "royals remix");
});

test("normalizeTitle: accents and non-Latin scripts survive, in either Unicode form", async () => {
  const { normalizeTitle } = await load();
  assert.equal(normalizeTitle("Café Niño"), "café niño");
  assert.equal(normalizeTitle("Café"), normalizeTitle("Café")); // e + accent mark vs é
  assert.equal(normalizeTitle("夜に駆ける"), "夜に駆ける");
  assert.equal(normalizeTitle("Дождь"), "дождь");
  assert.equal(normalizeTitle("a b\tc"), "a b c");
});

// --- One candidate ---

test("closeMismatch: a real-looking pair passes", async () => {
  const { closeMismatch } = await load();
  assert.equal(closeMismatch(src(), cand()), null);
});

test("closeMismatch: primary artist can be any of the candidate's artists, any case", async () => {
  const { closeMismatch } = await load();
  const s = src({ title: "You Know You Like It", primaryArtist: "DJ Snake", explicit: false, durationMs: 247267 });
  const c = cand({ name: "You Know You Like It", artists: [{ name: "AlunaGeorge" }, { name: "dj snake" }], explicit: false, duration_ms: 247000 });
  assert.equal(closeMismatch(s, c), null);
});

test("closeMismatch: duration gap of exactly 3000 ms passes, 3001 fails", async () => {
  const { closeMismatch } = await load();
  assert.equal(closeMismatch(src(), cand({ duration_ms: 278480 + 3000 })), null);
  assert.equal(closeMismatch(src(), cand({ duration_ms: 278480 - 3000 })), null);
  assert.equal(closeMismatch(src(), cand({ duration_ms: 278480 + 3001 })), "duration");
});

test("Negative: a studio track never matches its (Live) or (Sped Up) version", async () => {
  const { closeMismatch } = await load();
  assert.equal(closeMismatch(src(), cand({ name: "Good Days (Live)" })), "title");
  assert.equal(closeMismatch(src(), cand({ name: "Good Days - Sped Up" })), "title");
});

test("Negative: clean source vs explicit candidate (and the reverse) is a mismatch", async () => {
  const { closeMismatch } = await load();
  assert.equal(closeMismatch(src({ explicit: false }), cand({ explicit: true })), "explicit");
  assert.equal(closeMismatch(src({ explicit: true }), cand({ explicit: false })), "explicit");
});

test("Negative: wrong artist, or a missing duration, is a mismatch", async () => {
  const { closeMismatch } = await load();
  assert.equal(closeMismatch(src(), cand({ artists: [{ name: "SZA Tribute Band" }] })), "artist");
  assert.equal(closeMismatch(src(), cand({ artists: [] })), "artist");
  assert.equal(closeMismatch(src({ durationMs: null }), cand()), "duration missing");
});

// --- Picking from a result list ---

test("pickClose: skips failing results; equal lengths tie to the earlier one (ADR 0024)", async () => {
  const { pickClose } = await load();
  const r = pickClose(src(), [cand({ id: "live", name: "Good Days (Live)" }), cand({ id: "a" }), cand({ id: "b" })]);
  assert.equal(r.tier, "close");
  assert.equal(r.candidate.id, "a");
});

test("pickClose: the closest passing length wins, not the first passing result (ADR 0024)", async () => {
  const { pickClose } = await load();
  // The real 2026-11-19 case: Apple's solo "expectations", feature version listed first.
  const s = src({ title: "expectations", primaryArtist: "Olivia Rodrigo", durationMs: 221958, explicit: false });
  const feat = cand({ id: "feat", name: "expectations (feat. Chappell Roan)", artists: [{ name: "Olivia Rodrigo" }, { name: "Chappell Roan" }], duration_ms: 223935, explicit: false });
  const solo = cand({ id: "solo", name: "expectations", artists: [{ name: "Olivia Rodrigo" }], duration_ms: 221958, explicit: false });
  assert.equal(pickClose(s, [feat, solo]).candidate.id, "solo");
  assert.equal(pickClose(s, [solo, feat]).candidate.id, "solo");
  assert.equal(pickClose(s, [feat]).candidate.id, "feat"); // still a pass on its own: no check was loosened
});

test("pickClose: a closer length that fails a check never wins", async () => {
  const { pickClose } = await load();
  const r = pickClose(src(), [cand({ id: "ok", duration_ms: 280000 }), cand({ id: "clean", duration_ms: 278480, explicit: false })]);
  assert.equal(r.candidate.id, "ok");
});

// --- Near versions for unmatched songs (ADR 0026), from the 2026-11-19 real run ---

test("nearVersion: a '- Radio Edit' label, a longer copy, and an explicit-only copy are offered", async () => {
  const { pickClose } = await load();
  const dywc = src({ title: "Don't You Worry Child (feat. John Martin)", primaryArtist: "Swedish House Mafia", durationMs: 212027, explicit: false });
  const r1 = pickClose(dywc, [
    cand({ id: "radio", name: "Don't You Worry Child (feat. John Martin) - Radio Edit", artists: [{ name: "Swedish House Mafia" }], duration_ms: 212862, explicit: false }),
    cand({ id: "long", name: "Don't You Worry Child (feat. John Martin)", artists: [{ name: "Swedish House Mafia" }], duration_ms: 403493, explicit: false }),
  ]);
  assert.equal(r1.tier, "unmatched");
  assert.equal(r1.near.id, "radio", "closest length wins, even over an exact title");

  const people = src({ title: "We Are the People", primaryArtist: "Empire Of The Sun", durationMs: 267373, explicit: false });
  const r2 = pickClose(people, [cand({ id: "p", name: "We Are The People", artists: [{ name: "Empire Of The Sun" }], duration_ms: 272174, explicit: false })]);
  assert.equal(r2.tier, "unmatched");
  assert.equal(r2.near.id, "p");

  const pretend = src({ title: "Time to Pretend", primaryArtist: "MGMT", durationMs: 262853, explicit: false });
  const r3 = pickClose(pretend, [cand({ id: "x", name: "Time to Pretend", artists: [{ name: "MGMT" }], duration_ms: 261000, explicit: true })]);
  assert.equal(r3.tier, "unmatched");
  assert.equal(r3.near.id, "x");
});

test("Negative: nearVersion never offers another artist, another song, or a word-prefix", async () => {
  const { pickClose } = await load();
  const r = pickClose(src({ explicit: false }), [
    cand({ id: "other-artist", artists: [{ name: "Someone Else" }] }),
    cand({ id: "other-song", name: "Good Morning" }),
    cand({ id: "prefix", name: "Good Dayses" }),
  ]);
  assert.equal(r.tier, "unmatched");
  assert.equal(r.near, undefined);
});

test("a close match never carries a near version", async () => {
  const { pickClose } = await load();
  assert.equal(pickClose(src(), [cand()]).near, undefined);
});

test("pickClose: only the first 10 results are checked", async () => {
  const { pickClose } = await load();
  const bad = Array.from({ length: 10 }, (_, i) => cand({ id: "bad" + i, name: "Other" }));
  assert.equal(pickClose(src(), [...bad, cand({ id: "eleventh" })]).tier, "unmatched");
  assert.equal(pickClose(src(), [...bad.slice(0, 9), cand({ id: "tenth" })]).candidate.id, "tenth");
});

test("Negative: no results, or nothing passes, is unmatched with a reason", async () => {
  const { pickClose } = await load();
  assert.deepEqual(pickClose(src(), []), { tier: "unmatched", reason: "no results" });
  const r = pickClose(src(), [cand({ name: "Good Days (Live)" }), cand({ explicit: false })]);
  assert.equal(r.tier, "unmatched");
  assert.equal(r.reason, "no candidate passed (title, explicit)");
});

test("Negative: a music video is unmatched even if a candidate would pass", async () => {
  const { pickClose } = await load();
  assert.equal(pickClose(src({ kind: "musicVideo" }), [cand()]).tier, "unmatched");
});

// --- The search query ---

test("closeQuery: quoted raw title and primary artist", async () => {
  const { closeQuery } = await load();
  assert.equal(closeQuery(src({ title: "Suit & Tie (feat. JAŸ-Z)", primaryArtist: "Justin Timberlake" })),
    'track:"Suit & Tie (feat. JAŸ-Z)" artist:"Justin Timberlake"');
  assert.equal(closeQuery(src({ title: 'The "Real" One' })), 'track:"The  Real  One" artist:"SZA"');
});
