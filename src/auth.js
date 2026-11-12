// Sender sign-in with Google through Supabase Auth (ADR 0019). Recipients never sign in
// (ADR 0006). No library: the PKCE flow is three fetch calls to Supabase's /auth/v1.
// Add ?demo=error to see the sign-in error state.
(function () {
  "use strict";

  var CONFIG = window.CROSSFADE_CONFIG || {};
  var BASE = String(CONFIG.supabaseUrl || "").replace(/\/$/, "") + "/auth/v1";
  var KEY = "crossfade-session-v1";
  var VERIFIER_KEY = "crossfade-pkce-verifier";
  var DEMO = new URLSearchParams(location.search).get("demo");

  function fail(name) { var e = new Error(name); e.name = name; return e; }

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function write(key, value) {
    try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  function b64url(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function post(path, body, token) {
    var headers = { apikey: CONFIG.supabaseKey, "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(BASE + path, { method: "POST", headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (res) {
        if (!res.ok) throw fail("http-" + res.status);
        return res.status === 204 ? null : res.json();
      });
  }

  // Only what the screens need. The tokens stay in this browser, like supabase-js does.
  function keep(data) {
    var u = data.user || {}, m = u.user_metadata || {};
    var session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      user: { id: u.id, email: u.email || "", name: m.full_name || m.name || "", avatar_url: m.avatar_url || m.picture || "" },
    };
    write(KEY, JSON.stringify(session));
    return session;
  }

  function stored() {
    if (DEMO === "error") return null;
    var raw = read(KEY);
    if (!raw) return null;
    try { var s = JSON.parse(raw); return s && s.access_token && s.user ? s : null; } catch (e) { return null; }
  }

  // Sends the browser to Google. Comes back to this page with ?code=…
  function signIn() {
    if (DEMO === "error") return Promise.reject(fail("demo"));
    if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) return Promise.reject(fail("not-configured"));
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    var verifier = b64url(bytes);
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (hash) {
      write(VERIFIER_KEY, verifier);
      var back = location.origin + location.pathname;
      location.assign(BASE + "/authorize?provider=google&redirect_to=" + encodeURIComponent(back) +
        "&code_challenge=" + b64url(new Uint8Array(hash)) + "&code_challenge_method=s256");
    });
  }

  // Runs once on load. Resolves to null, the session, or rejects if Google or Supabase said no.
  // Either way it takes ?code= or ?error= out of the address bar so a reload doesn't retry.
  function finishSignIn() {
    var params = new URLSearchParams(location.search);
    var code = params.get("code"), error = params.get("error");
    if (!code && !error) return Promise.resolve(null);
    params.delete("code"); params.delete("error"); params.delete("error_code"); params.delete("error_description");
    var q = params.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + "#/account");
    var verifier = read(VERIFIER_KEY);
    write(VERIFIER_KEY, null);
    if (error) return Promise.reject(fail(error === "access_denied" ? "cancelled" : "provider"));
    if (!verifier) return Promise.reject(fail("no-verifier"));
    return post("/token?grant_type=pkce", { auth_code: code, code_verifier: verifier }).then(keep);
  }

  // The session, refreshed if its hour is up. Resolves to null when signed out.
  function current() {
    var s = stored();
    if (!s) return Promise.resolve(null);
    if (s.expires_at - Date.now() > 60 * 1000) return Promise.resolve(s);
    return post("/token?grant_type=refresh_token", { refresh_token: s.refresh_token })
      .then(keep, function () { write(KEY, null); return null; });
  }

  // Signs out here even if Supabase can't be reached, so a shared phone is never left signed in.
  function signOut() {
    var s = stored();
    write(KEY, null);
    if (!s) return Promise.resolve();
    return post("/logout", null, s.access_token).catch(function () { /* already signed out here */ });
  }

  window.CrossfadeAuth = { signIn: signIn, finishSignIn: finishSignIn, current: current, user: function () {
    var s = stored(); return s ? s.user : null;
  }, signOut: signOut, KEY: KEY, DAILY_LIMIT: 10 };
})();
