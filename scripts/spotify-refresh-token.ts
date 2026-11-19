// Gets the Spotify refresh token for Crossfade's own Premium account, once, by hand
// (architecture §6, ADR 0014). Opens Spotify's login page, waits for the redirect on
// http://127.0.0.1:8888/callback, trades the code for tokens, and writes the refresh token
// into .env as SPOTIFY_REFRESH_TOKEN. The token is never printed.
//
//   node --env-file=.env scripts/spotify-refresh-token.ts
//
// Log in as the Crossfade account, not a personal one. The script prints which account
// approved so you can check.

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { getUserToken, SpotifyError } from "../supabase/functions/create-link/spotify.ts";

const REDIRECT_URI = "http://127.0.0.1:8888/callback"; // must match the dev app's settings exactly
const ENV_PATH = new URL("../.env", import.meta.url);
const TIMEOUT_MS = 5 * 60_000;
// playlist-modify-*: create the playlist and add songs. user-library-modify: DELETE /me/library,
// which removes a failed or expired playlist from the account (spotify.ts removePlaylist).
const SCOPES = ["playlist-modify-public", "playlist-modify-private", "user-library-modify"];

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET aren't set. Fill them in .env and run with --env-file=.env.");
  process.exit(1);
}

// state guards against a redirect that this run didn't start.
const state = randomBytes(16).toString("hex");
const authUrl = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
  response_type: "code",
  client_id: clientId,
  scope: SCOPES.join(" "),
  redirect_uri: REDIRECT_URI,
  state,
  show_dialog: "true", // always show the approve screen, so you see which account is logged in
});

function page(msg: string): string {
  return "<!doctype html><meta charset=utf-8><title>Crossfade</title>" +
    "<body style='font:16px system-ui;padding:2rem'>" + msg.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!) +
    "</body>";
}

const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", REDIRECT_URI);
    if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
    const done = (status: number, msg: string, result: () => void) => {
      res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" }).end(page(msg));
      clearTimeout(timer);
      server.close();
      result();
    };
    if (url.searchParams.get("state") !== state) {
      return done(400, "That redirect didn't come from this run. Close this tab and run the script again.",
        () => reject(new Error("state didn't match")));
    }
    const err = url.searchParams.get("error");
    if (err) {
      return done(400, "Spotify said: " + err + ". You can close this tab.",
        () => reject(new Error("Spotify returned error=" + err + (err === "access_denied" ? " (Cancel was pressed)" : ""))));
    }
    const c = url.searchParams.get("code");
    if (!c) return done(400, "No code in the redirect.", () => reject(new Error("no code in the redirect")));
    done(200, "Done. You can close this tab and go back to the terminal.", () => resolve(c));
  });
  const timer = setTimeout(() => { server.close(); reject(new Error("no login within 5 minutes")); }, TIMEOUT_MS);
  server.on("error", (e: NodeJS.ErrnoException) => {
    clearTimeout(timer);
    reject(e.code === "EADDRINUSE" ? new Error("port 8888 is already in use; close whatever is using it and try again") : e);
  });
  server.listen(8888, "127.0.0.1", () => {
    console.log("Opening Spotify's login page. Log in as the Crossfade account and click Agree.");
    console.log("If no browser opens, paste this into one:\n  " + authUrl + "\n");
    execFile("open", [authUrl], () => {}); // macOS; the URL above covers anything else
  });
}).catch((e: Error) => {
  console.error("Stopped: " + e.message);
  process.exit(1);
});

// Trade the one-time code for tokens.
const res = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: {
    Authorization: "Basic " + btoa(clientId + ":" + clientSecret),
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }).toString(),
  signal: AbortSignal.timeout(10_000),
});
const body = await res.json().catch(() => ({})) as { refresh_token?: string; scope?: string; error?: string; error_description?: string };
if (!res.ok || !body.refresh_token) {
  console.error("→ " + res.status + " from the token exchange: " + (body.error_description ?? body.error ?? "no refresh token"));
  process.exit(1);
}
console.log("→ 200 OK, got a refresh token (not printed)");

const granted = (body.scope ?? "").split(" ");
const missing = SCOPES.filter((s) => !granted.includes(s));
if (missing.length) console.log("Warning: Spotify didn't grant " + missing.join(", "));

// Check the token works the way create-link will use it, and show whose account it is.
try {
  const access = await getUserToken(clientId, clientSecret, body.refresh_token);
  const me = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: "Bearer " + access }, signal: AbortSignal.timeout(10_000) });
  const who = await me.json() as { display_name?: string; id?: string; product?: string };
  console.log("Approved by: " + (who.display_name ?? "?") + " (id " + (who.id ?? "?") + ", " + (who.product ?? "unknown plan") + ")");
  if (who.product && who.product !== "premium") console.log("Warning: this account isn't Premium. ADR 0014 expects the Crossfade Premium account.");
} catch (e) {
  if (!(e instanceof SpotifyError)) throw e;
  console.error("The refresh token didn't produce an access token (" + e.status + "). Not saving it.");
  process.exit(1);
}

// Write it into .env, replacing an existing SPOTIFY_REFRESH_TOKEN line or adding one.
const line = "SPOTIFY_REFRESH_TOKEN=" + body.refresh_token;
const env = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
const next = /^SPOTIFY_REFRESH_TOKEN=.*$/m.test(env)
  ? env.replace(/^SPOTIFY_REFRESH_TOKEN=.*$/m, line)
  : env + (env === "" || env.endsWith("\n") ? "" : "\n") + line + "\n";
writeFileSync(ENV_PATH, next);
console.log("Saved SPOTIFY_REFRESH_TOKEN in .env.");
