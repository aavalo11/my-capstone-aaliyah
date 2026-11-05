// Spotify calls for create-link (architecture §2, steps 6 and 8). Runs on Deno in the Edge
// Function and on Node 24 from scripts/ and tests/, so it uses only fetch, btoa and
// AbortSignal. It never reads secrets itself: the caller passes them in (ADR 0013).
//
// Endpoints follow Spotify's February 2026 dev-mode migration guide (checked 2026-11-05):
// POST /me/playlists, POST /playlists/{id}/items, DELETE /me/library. None of the write
// calls has run against the real Crossfade account yet (K3).

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";
const TIMEOUT_MS = 10_000; // one call; the build's overall limits are in build.ts

// Every failed call is thrown as one of these, with what Spotify actually sent back.
// status 0 means no response: the call timed out or the network failed.
export class SpotifyError extends Error {
  status: number;
  body: unknown;
  retryAfterS: number | null; // from a 429's Retry-After header
  constructor(status: number, body: unknown, retryAfterS: number | null = null) {
    super("spotify-" + status);
    this.name = "SpotifyError";
    this.status = status;
    this.body = body;
    this.retryAfterS = retryAfterS;
  }
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function call(url: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const name = (e as Error)?.name;
    throw new SpotifyError(0, name === "TimeoutError" || name === "AbortError" ? "timeout" : "network: " + (e as Error)?.message);
  }
  const body = await readBody(res);
  if (!res.ok) {
    const ra = Number(res.headers.get("Retry-After"));
    throw new SpotifyError(res.status, body, Number.isFinite(ra) && ra >= 0 && res.headers.has("Retry-After") ? ra : null);
  }
  return body;
}

async function token(clientId: string, clientSecret: string, form: string): Promise<string> {
  const body = await call(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(clientId + ":" + clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  return (body as { access_token: string }).access_token;
}

// Client credentials: enough for search, not for making playlists.
export function getAppToken(clientId: string, clientSecret: string): Promise<string> {
  return token(clientId, clientSecret, "grant_type=client_credentials");
}

// An access token for Crossfade's own account, from the refresh token fetched once by hand
// (architecture §6). Needed for every write below.
export function getUserToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  return token(clientId, clientSecret, new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString());
}

// R2 step 2's query: track:"<title>" artist:"<primary artist>", with the raw Apple title,
// not the normalized one. A double quote inside a name is replaced with a space, because
// Spotify documents no escape for it (architecture §5).
export function trackQuery(title: string, artist: string): string {
  const q = (s: string) => '"' + String(s ?? "").replace(/"/g, " ") + '"';
  return "track:" + q(title) + " artist:" + q(artist);
}

// One track's candidates in the US market (PRD R2: the first 10 results). Dev mode caps
// limit at 10 (Feb 2026). Pass q to send a raw query instead of trackQuery().
export function searchTrack(
  accessToken: string,
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
  return call(API + "/search?" + params, { headers: { Authorization: "Bearer " + accessToken } });
}

const json = (accessToken: string, method: string, body?: unknown): RequestInit => ({
  method,
  headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// R4: a public playlist on Crossfade's account.
export async function createPlaylist(accessToken: string, name: string, description: string): Promise<{ id: string }> {
  const body = await call(API + "/me/playlists", json(accessToken, "POST", { name, description, public: true }));
  return { id: (body as { id: string }).id };
}

// R4: append tracks in the order given. Spotify takes at most 100 per call, which is D6's
// limit, so a v1 build needs one call.
export async function addItems(accessToken: string, playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    await call(API + "/playlists/" + encodeURIComponent(playlistId) + "/items", json(accessToken, "POST", { uris: uris.slice(i, i + 100) }));
  }
}

// R1 cleanup: remove a playlist from Crossfade's library, Spotify's only form of delete.
export async function removePlaylist(accessToken: string, playlistId: string): Promise<void> {
  const uris = encodeURIComponent("spotify:playlist:" + playlistId);
  await call(API + "/me/library?uris=" + uris, json(accessToken, "DELETE"));
}

// The shape build.ts uses. One user token per build: a fresh one each time (§6).
export type SpotifyCandidateRaw = {
  id: string; uri: string; name: string; artists: { name: string }[]; duration_ms: number; explicit: boolean;
};
export type SpotifyPort = {
  search(title: string, artist: string): Promise<SpotifyCandidateRaw[]>;
  createPlaylist(name: string, description: string): Promise<{ id: string }>;
  addTracks(playlistId: string, uris: string[]): Promise<void>;
  removePlaylist(playlistId: string): Promise<void>;
};

export async function connectSpotify(env: { clientId: string; clientSecret: string; refreshToken: string }): Promise<SpotifyPort> {
  const t = await getUserToken(env.clientId, env.clientSecret, env.refreshToken);
  return {
    async search(title, artist) {
      const body = await searchTrack(t, title, artist) as { tracks?: { items?: SpotifyCandidateRaw[] } };
      return body.tracks?.items ?? [];
    },
    createPlaylist: (name, description) => createPlaylist(t, name, description),
    addTracks: (id, uris) => addItems(t, id, uris),
    removePlaylist: (id) => removePlaylist(t, id),
  };
}
