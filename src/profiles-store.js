// Sender profiles in Supabase's `profiles` table (ADR 0020, backlog S18). Anyone can read a
// profile; a signed-in sender can create and change only their own (row-level security,
// supabase/schema.sql). Add ?demo=empty or ?demo=error to see those states.
(function () {
  "use strict";

  var CONFIG = window.CROSSFADE_CONFIG || {};
  var REST = String(CONFIG.supabaseUrl || "").replace(/\/$/, "") + "/rest/v1/profiles";
  var DEMO = new URLSearchParams(location.search).get("demo");
  var FIELDS = "id,username,display_name,avatar_url,bio";
  var MAX_BIO = 160, MAX_NAME = 50;

  function fail(name) { var e = new Error(name); e.name = name; return e; }

  // The error name for a bad username, or null. Same rule as the database's check.
  function checkUsername(u) {
    var s = String(u == null ? "" : u).trim();
    if (!s) return "username-empty";
    if (!/^[A-Za-z0-9_]{3,20}$/.test(s)) return "username-format";
    return null;
  }

  function checkFields(f) {
    var problems = {};
    var u = checkUsername(f.username);
    if (u) problems.username = u;
    if (String(f.display_name || "").trim().length > MAX_NAME) problems.display_name = "name-too-long";
    if (String(f.bio || "").trim().length > MAX_BIO) problems.bio = "bio-too-long";
    return problems;
  }

  function request(method, query, body, token) {
    if (DEMO === "error") return Promise.reject(fail("network"));
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) return Promise.reject(fail("not-configured"));
    var headers = { apikey: CONFIG.supabaseKey, Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    if (body) { headers["Content-Type"] = "application/json"; headers.Prefer = "return=representation"; }
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    return fetch(REST + query, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: controller.signal })
      .then(function (res) {
        if (res.ok) return res.json();
        return res.json().catch(function () { return {}; }).then(function (err) {
          // 23505: the username_key unique constraint. 23514: a check constraint.
          if (res.status === 409 || err.code === "23505") throw fail("taken");
          if (err.code === "23514") throw fail("invalid");
          if (res.status === 401 || res.status === 403) throw fail("signed-out");
          throw fail("network");
        });
      }, function () { throw fail("network"); })
      .finally(function () { clearTimeout(timer); });
  }

  function first(rows) { return Array.isArray(rows) && rows.length ? rows[0] : null; }

  // The signed-in sender's own profile, or null if they haven't picked a username yet.
  function mine(session) {
    if (DEMO === "empty") return Promise.resolve(null);
    return request("GET", "?select=" + FIELDS + "&id=eq." + encodeURIComponent(session.user.id), null, session.access_token).then(first);
  }

  // Anyone's profile by username, any capitalization. No sign-in needed.
  function byUsername(username) {
    if (DEMO === "empty") return Promise.resolve(null);
    var key = String(username || "").trim().toLowerCase();
    if (checkUsername(key)) return Promise.resolve(null);
    return request("GET", "?select=username,display_name,avatar_url,bio&username_key=eq." + encodeURIComponent(key)).then(first);
  }

  // Creates the profile, or changes it if `existing` is the row from mine(). The photo always
  // comes from Google (ADR 0020).
  function save(session, fields, existing) {
    var problems = checkFields(fields);
    var names = Object.keys(problems);
    if (names.length) { var e = fail("invalid"); e.fields = problems; return Promise.reject(e); }
    var row = {
      username: String(fields.username).trim(),
      display_name: String(fields.display_name || "").trim(),
      bio: String(fields.bio || "").trim(),
      avatar_url: session.user.avatar_url || "",
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      return request("PATCH", "?id=eq." + encodeURIComponent(session.user.id), row, session.access_token).then(first);
    }
    row.id = session.user.id;
    return request("POST", "", row, session.access_token).then(first);
  }

  window.CrossfadeProfiles = {
    mine: mine, byUsername: byUsername, save: save, checkUsername: checkUsername, checkFields: checkFields,
    MAX_BIO: MAX_BIO, MAX_NAME: MAX_NAME,
  };
})();
