// Crossfade's server (ADR 0029): the three Edge Functions and the database functions from
// supabase/migrations/20261119_links_builds.sql. Only the publishable key is here; the
// signed-in sender's Google session goes in Authorization when a call needs one.
// Add ?demo=error to see the error states.
(function () {
  "use strict";

  var CONFIG = window.CROSSFADE_CONFIG || {};
  var BASE = String(CONFIG.supabaseUrl || "").replace(/\/$/, "");
  var DEMO = new URLSearchParams(location.search).get("demo");

  // err.name is what went wrong ("network", "signed-out", "not-found", "http"); err.message is
  // the server's own wording when it sent one, which is already written for the sender.
  function fail(name, message) { var e = new Error(message || name); e.name = name; return e; }

  function post(path, body, token, timeoutMs) {
    if (DEMO === "error") return Promise.reject(fail("network"));
    if (!BASE || !CONFIG.supabaseKey) return Promise.reject(fail("not-configured"));
    var headers = { apikey: CONFIG.supabaseKey, "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 10000);
    return fetch(BASE + path, { method: "POST", headers: headers, body: JSON.stringify(body || {}), signal: controller.signal })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
          if (res.ok) return data;
          var msg = data && typeof data.error === "string" ? data.error : "";
          if (res.status === 401 || res.status === 403) throw fail("signed-out", msg);
          if (res.status === 404 && msg) throw fail("not-found", msg);
          throw fail("http", msg);
        });
      }, function () { throw fail("network"); })
      .finally(function () { clearTimeout(timer); });
  }

  var rpc = function (name, body, token) { return post("/rest/v1/rpc/" + name, body, token); };
  // Matching 100 songs can take a while; the server gives up at 120 s (build.ts).
  var fn = function (name, body, token) { return post("/functions/v1/" + name, body, token, 130000); };

  window.CrossfadeServer = {
    fail: fail,
    // Anyone, signed in or not: one link by its code, { removed: true }, or null.
    getLink: function (code) { return rpc("get_link", { p_code: code }); },
    // The signed-in sender only.
    myLinks: function (token) { return rpc("my_links", {}, token); },
    rename: function (token, code, title) { return rpc("rename_link", { p_code: code, p_title: title }, token); },
    remove: function (token, code) { return rpc("delete_link", { p_code: code }, token); },
    getBuild: function (token, id) { return rpc("get_build", { p_id: id }, token); },
    match: function (token, link, buildId) { return fn("match-playlist", { link: link, build_id: buildId }, token); },
    search: function (token, q) { return fn("search-songs", { q: q }, token); },
    publish: function (token, buildId, title, remove, add) {
      return fn("publish-link", { build_id: buildId, title: title, remove: remove, add: add }, token);
    },
  };
})();
