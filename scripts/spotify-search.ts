// One real Spotify search from the terminal (D09, ADR 0013). Prints what was sent and what
// came back, never the client secret or the token.
//
//   node --env-file=.env scripts/spotify-search.ts "Kill Bill" "SZA"
//   node --env-file=.env scripts/spotify-search.ts "Kill Bill" "SZA" --break=wrong-secret
//
// --break=wrong-secret  a secret Spotify never issued
// --break=bad-token     a made-up bearer token on the search
// --break=no-query      an empty q
// --break=limit-50      limit=50, the old maximum (dev mode now allows 10)
// --full                print the whole response instead of a summary

import { getAppToken, searchTrack, SpotifyError, trackQuery } from "../supabase/functions/create-link/spotify.ts";

const args = process.argv.slice(2);
const [title, artist] = args.filter((a) => !a.startsWith("--"));
const breakIt = args.find((a) => a.startsWith("--break="))?.slice("--break=".length);
const full = args.includes("--full");

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET aren't set. Fill them in .env and run with --env-file=.env.");
  process.exit(1);
}
if (!title || !artist) {
  console.error('Usage: node --env-file=.env scripts/spotify-search.ts "<title>" "<artist>" [--break=…] [--full]');
  process.exit(1);
}

type Track = { name: string; id: string; artists: { name: string }[]; album: { name: string }; external_urls: { spotify: string } };

try {
  let token = "not-a-real-token";
  if (breakIt !== "bad-token") {
    console.log("POST https://accounts.spotify.com/api/token  (client credentials)");
    token = await getAppToken(clientId, breakIt === "wrong-secret" ? "wrong-secret-for-d09" : clientSecret);
    console.log("→ 200 OK, got an access token (not printed)\n");
  }

  const opts = { q: breakIt === "no-query" ? "" : undefined, limit: breakIt === "limit-50" ? 50 : undefined };
  const sent = opts.q ?? trackQuery(title, artist);
  console.log("GET https://api.spotify.com/v1/search  q=" + JSON.stringify(sent) + "  market=US  limit=" + (opts.limit ?? 10));
  const body = await searchTrack(token, title, artist, opts) as { tracks: { total: number; items: Track[] } };
  console.log("→ 200 OK, " + body.tracks.total + " total\n");

  if (full) console.log(JSON.stringify(body, null, 2));
  else for (const t of body.tracks.items) {
    console.log("  " + t.name + " — " + t.artists.map((a) => a.name).join(", ") + "  (" + t.album.name + ")");
    console.log("    " + t.external_urls.spotify);
  }
} catch (e) {
  if (!(e instanceof SpotifyError)) throw e;
  console.log("→ " + e.status);
  console.log(JSON.stringify(e.body, null, 2));
  process.exitCode = 1;
}
