// Unit tests for src/links-store.js (ADR 0010). No install needed: node --test tests/unit
// The store is a browser script, so each test loads it into a fresh sandbox with a fake localStorage.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "../../src/links-store.js"), "utf8");
const KEY = "crossfade-links-v1";
const URL1 = "https://music.apple.com/us/playlist/late-train-home/pl.u-8aAVZ";

// opts.search is the page's query string (e.g. "?demo=error"); opts.failWrites makes setItem throw.
function load(opts = {}) {
  const data = new Map(Object.entries(opts.seed || {}));
  const localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { if (opts.failWrites) throw new Error("QuotaExceededError"); data.set(k, String(v)); },
  };
  const window = {};
  vm.runInNewContext(SOURCE, {
    window, localStorage, crypto: globalThis.crypto, URL, URLSearchParams,
    location: { search: opts.search || "" },
  });
  return { store: window.CrossfadeLinks, rows: () => JSON.parse(data.get(KEY) || "[]") };
}

// Arrays made inside the sandbox belong to another realm, and deepStrictEqual rejects them.
const plain = (v) => JSON.parse(JSON.stringify(v));

function errorName(fn) {
  try { fn(); } catch (e) { return e.name; }
  return "no error";
}

test("create saves a link with a 10-character code", () => {
  const { store, rows } = load();
  const link = store.create("  late train home  ", URL1);
  assert.match(link.code, /^[A-Za-z0-9]{10}$/);
  assert.equal(link.title, "late train home");
  assert.equal(link.created_at, link.updated_at);
  assert.deepEqual(rows().map((r) => r.code), [link.code]);
});

test("create rejects a blank or too-long name and saves nothing", () => {
  const { store, rows } = load();
  assert.equal(errorName(() => store.create("   ", URL1)), "title-empty");
  assert.equal(errorName(() => store.create("x".repeat(101), URL1)), "title-too-long");
  assert.equal(rows().length, 0);
  assert.equal(store.create("x".repeat(100), URL1).title.length, 100);
});

test("checkTitle names the problem without throwing", () => {
  const { store } = load();
  assert.equal(store.checkTitle(""), "title-empty");
  assert.equal(store.checkTitle("x".repeat(101)), "title-too-long");
  assert.equal(store.checkTitle("ok"), null);
});

test("list is newest first and leaves out deleted links", () => {
  const seed = [
    { code: "AAAAAAAAAA", title: "old", apple_url: URL1, created_at: "2026-10-01T00:00:00.000Z", updated_at: "2026-10-01T00:00:00.000Z" },
    { code: "BBBBBBBBBB", deleted_at: "2026-10-02T00:00:00.000Z" },
    { code: "CCCCCCCCCC", title: "new", apple_url: URL1, created_at: "2026-10-03T00:00:00.000Z", updated_at: "2026-10-03T00:00:00.000Z" },
  ];
  const { store } = load({ seed: { [KEY]: JSON.stringify(seed) } });
  assert.deepEqual(plain(store.list().map((r) => r.title)), ["new", "old"]);
});

test("rename keeps the code and updates the name", () => {
  const { store, rows } = load();
  const { code } = store.create("late train home", URL1);
  store.rename(code, "late train home (fixed)");
  assert.equal(rows()[0].code, code);
  assert.equal(rows()[0].title, "late train home (fixed)");
});

test("rename to the same name changes nothing (U-2)", () => {
  const { store, rows } = load();
  const link = store.create("late train home", URL1);
  store.rename(link.code, "  late train home ");
  assert.equal(rows()[0].updated_at, link.updated_at);
});

test("rename to blank is rejected and the old name kept", () => {
  const { store, rows } = load();
  const { code } = store.create("late train home", URL1);
  assert.equal(errorName(() => store.rename(code, " ")), "title-empty");
  assert.equal(rows()[0].title, "late train home");
});

test("remove leaves a tombstone with only the code and when", () => {
  const { store, rows } = load();
  const { code } = store.create("sent to the wrong person", URL1);
  store.remove(code);
  assert.deepEqual(Object.keys(rows()[0]).sort(), ["code", "deleted_at"]);
  assert.ok(store.get(code).deleted_at);
  assert.equal(store.list().length, 0);
});

test("rename or remove a deleted or unknown link says not-found (U-1, D-3)", () => {
  const { store } = load();
  const { code } = store.create("two tabs", URL1);
  store.remove(code);
  assert.equal(errorName(() => store.remove(code)), "not-found");
  assert.equal(errorName(() => store.rename(code, "new")), "not-found");
  assert.equal(errorName(() => store.rename("nope", "new")), "not-found");
});

test("get returns null for a code never made here", () => {
  const { store } = load();
  assert.equal(store.get("nope"), null);
});

test("samePlaylist ignores the share sheet's query string (C-2)", () => {
  const { store } = load();
  store.create("late train home", URL1);
  assert.equal(store.samePlaylist(URL1 + "?ls=1&app=music").length, 1);
  assert.equal(store.samePlaylist("https://music.apple.com/us/playlist/other/pl.u-1").length, 0);
});

test("corrupted saved data is a read failure, not a crash (R-4)", () => {
  const { store } = load({ seed: { [KEY]: "{not json" } });
  assert.equal(errorName(() => store.list()), "read-failed");
  assert.equal(errorName(() => store.create("x", URL1)), "read-failed");
});

test("a full or blocked localStorage is a write failure", () => {
  const { store } = load({ failWrites: true });
  assert.equal(errorName(() => store.create("x", URL1)), "write-failed");
});

test("?demo=empty and ?demo=error give the screens their states", () => {
  assert.deepEqual(plain(load({ search: "?demo=empty" }).store.list()), []);
  assert.equal(errorName(() => load({ search: "?demo=error" }).store.list()), "read-failed");
});
