// Spotify calls for create-link (architecture §2, steps 5–6). Runs on Deno in the Edge
// Function and on Node 24 from scripts/spotify-search.ts, so it uses only fetch and btoa.
// It never reads secrets itself: the caller passes them in (ADR 0013).

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

// Every failed call is thrown as one of these, with what Spotify actually sent back.
export class SpotifyError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super("spotify-" + status);
    this.name = "SpotifyError";
    this.status = status;
    this.body = body;
  }
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// Client credentials: enough for search, not for making playlists (that needs the
// refresh token for Crossfade's account, ADR 0006).
export async function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(clientId + ":" + clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await readBody(res);
  if (!res.ok) throw new SpotifyError(res.status, body);
  return (body as { access_token: string }).access_token;
}

// R2 step 2's query: track:"<title>" artist:"<primary artist>", raw Apple title, not the
// normalized one. A double quote inside a name would end the quoted phrase, so it's dropped
// from the query only.
export function trackQuery(title: string, artist: string): string {
  const q = (s: string) => '"' + String(s ?? "").replace(/"/g, "") + '"';
  return "track:" + q(title) + " artist:" + q(artist);
}

// One track's candidates in the US market (PRD R2: the first 10 results). Dev mode caps
// limit at 10 (Feb 2026). Pass q to send a raw query instead of trackQuery().
export async function searchTrack(
  token: string,
  title: string,
  artist: string,
  opts: { limit?: number; q?: string } = {},
): Promise<unknown> {
  const params = new URLSearchParams({
    q: opts.q ?? trackQuery(title, artist),
    type: "track",
    market: "US",
    limit: String(opts.limit ?? 10),
  });
  const res = await fetch(API + "/search?" + params, {
    headers: { Authorization: "Bearer " + token },
  });
  const body = await readBody(res);
  if (!res.ok) throw new SpotifyError(res.status, body);
  return body;
}
