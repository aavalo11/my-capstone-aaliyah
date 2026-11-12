// Unit tests for the rules in src/profiles-store.js (ADR 0020). No install needed: node --test tests/unit
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "../../src/profiles-store.js"), "utf8");

function load() {
  const window = { CROSSFADE_CONFIG: { supabaseUrl: "https://example.supabase.co", supabaseKey: "sb_publishable_test" } };
  let calls = 0;
  const fetch = () => { calls++; return Promise.reject(new Error("no network in unit tests")); };
  vm.runInNewContext(SOURCE, { window, location: { search: "" }, URLSearchParams, fetch, AbortController, setTimeout, clearTimeout });
  return { P: window.CrossfadeProfiles, calls: () => calls };
}

test("usernames are 3–20 letters, numbers or _", () => {
  const { P } = load();
  for (const ok of ["ari", "Ari_Lane", "a1_b2_c3", "x".repeat(20)]) assert.equal(P.checkUsername(ok), null, ok);
  assert.equal(P.checkUsername(""), "username-empty");
  assert.equal(P.checkUsername("   "), "username-empty");
  for (const bad of ["ab", "x".repeat(21), "ari lane", "ari-lane", "ari.lane", "ári", "<b>"]) {
    assert.equal(P.checkUsername(bad), "username-format", bad);
  }
});

test("surrounding spaces don't count against a username", () => {
  assert.equal(load().P.checkUsername("  ari_l  "), null);
});

test("bio is capped at 160 characters and the display name at 50", () => {
  const { P } = load();
  // JSON, because objects made inside the vm sandbox have a different prototype.
  const check = (f) => JSON.stringify(P.checkFields(f));
  assert.equal(check({ username: "ari", display_name: "x".repeat(50), bio: "y".repeat(160) }), "{}");
  assert.equal(check({ username: "ari", display_name: "x".repeat(51), bio: "y".repeat(161) }),
    JSON.stringify({ display_name: "name-too-long", bio: "bio-too-long" }));
});

test("save refuses bad fields without calling the database", async () => {
  const { P, calls } = load();
  const session = { access_token: "t", user: { id: "u1", avatar_url: "" } };
  await assert.rejects(P.save(session, { username: "no", bio: "" }, null),
    (e) => e.name === "invalid" && e.fields.username === "username-format");
  assert.equal(calls(), 0);
});

test("a username that can't exist is 'not found' without a database call", async () => {
  const { P, calls } = load();
  assert.equal(await P.byUsername("../etc"), null);
  assert.equal(calls(), 0);
});
