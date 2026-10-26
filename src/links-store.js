// The sender's Crossfade links, saved in this browser only (ADR 0010).
// TODO(W10): real data. Workshop 4 swaps these five functions for a real database.
// Add ?demo=empty or ?demo=error to the URL to see each screen's empty or error state.
(function () {
  "use strict";

  var KEY = "crossfade-links-v1";
  var DEMO = new URLSearchParams(location.search).get("demo"); // "empty" | "error" | null
  var CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var MAX_TITLE = 100;

  // Every failure is thrown as one of these, so screens can tell the user which one it was.
  function fail(name) { var e = new Error(name); e.name = name; return e; }

  function load() {
    if (DEMO === "error") throw fail("read-failed");
    if (DEMO === "empty") return [];
    var raw;
    try { raw = localStorage.getItem(KEY); } catch (e) { throw fail("read-failed"); }
    if (!raw) return [];
    try {
      var rows = JSON.parse(raw);
      return Array.isArray(rows) ? rows : [];
    } catch (e) { throw fail("read-failed"); }
  }

  function save(rows) {
    if (DEMO === "error") throw fail("write-failed");
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) { throw fail("write-failed"); }
  }

  // Architecture §6: 10 random characters from [A-Za-z0-9].
  function newCode(taken) {
    for (;;) {
      var bytes = new Uint8Array(10), code = "";
      crypto.getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
      if (!taken[code]) return code;
    }
  }

  // The error name for a bad playlist name, or null. Screens use it to show every field error at once.
  function checkTitle(title) {
    var t = String(title == null ? "" : title).trim();
    if (!t) return "title-empty";
    if (t.length > MAX_TITLE) return "title-too-long";
    return null;
  }

  function cleanTitle(title) {
    var problem = checkTitle(title);
    if (problem) throw fail(problem);
    return String(title).trim();
  }

  // The playlist itself, without the share sheet's ?ls=1&app=music.
  function playlistKey(appleUrl) {
    try { var u = new URL(String(appleUrl).trim()); return u.hostname + u.pathname.replace(/\/$/, ""); }
    catch (e) { return String(appleUrl).trim(); }
  }

  function findIndex(rows, code) {
    for (var i = 0; i < rows.length; i++) if (rows[i].code === code) return i;
    return -1;
  }

  // Live links only, newest first. Tombstones are left out.
  function list() {
    return load().filter(function (r) { return !r.deleted_at; })
      .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
  }

  // A live link, a tombstone ({ code, deleted_at }), or null if this code was never made here.
  function get(code) {
    var rows = load(), i = findIndex(rows, code);
    return i === -1 ? null : rows[i];
  }

  // Live links already made for the same Apple Music playlist.
  function samePlaylist(appleUrl) {
    var key = playlistKey(appleUrl);
    return list().filter(function (r) { return playlistKey(r.apple_url) === key; });
  }

  function create(title, appleUrl) {
    var rows = load(), taken = {};
    rows.forEach(function (r) { taken[r.code] = true; });
    var now = new Date().toISOString();
    var link = { code: newCode(taken), title: cleanTitle(title), apple_url: String(appleUrl).trim(),
      created_at: now, updated_at: now };
    rows.push(link);
    save(rows);
    return link;
  }

  // The code never changes, so a link that's already been texted keeps working.
  function rename(code, title) {
    var rows = load(), i = findIndex(rows, code);
    if (i === -1 || rows[i].deleted_at) throw fail("not-found");
    var t = cleanTitle(title);
    if (t === rows[i].title) return rows[i]; // nothing changed, so it isn't "renamed"
    rows[i].title = t;
    rows[i].updated_at = new Date().toISOString();
    save(rows);
    return rows[i];
  }

  // Keeps only the code and when it went, so the friend's page can say "removed".
  function remove(code) {
    var rows = load(), i = findIndex(rows, code);
    if (i === -1 || rows[i].deleted_at) throw fail("not-found");
    rows[i] = { code: code, deleted_at: new Date().toISOString() };
    save(rows);
  }

  window.CrossfadeLinks = {
    list: list, get: get, create: create, rename: rename, remove: remove,
    checkTitle: checkTitle, samePlaylist: samePlaylist, KEY: KEY, MAX_TITLE: MAX_TITLE,
  };
})();
