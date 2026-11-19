// What the three Edge Functions share (ADR 0029): CORS, the signed-in sender, the real
// database (PostgREST with the secret key), the real Spotify and Apple. Runs on Deno only;
// build.ts holds the logic and is tested on Node with fakes.
//
// Secrets (architecture §6), set with `supabase secrets set`:
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN
// Given to every Edge Function by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. The secret key never leaves the server.

import { fetchPlaylist } from "./apple.ts";
import { connectSpotify } from "./spotify.ts";
import { randomCode, type BuildStatus, type Db, type Deps, type Draft, type SavedLink } from "./build.ts";

declare const Deno: { env: { get(name: string): string | undefined }; serve(h: (req: Request) => Promise<Response>): void };

const env = (name: string) => Deno.env.get(name) ?? "";

// The sites the browser calls from. Anything else gets no CORS headers, so its browser refuses.
const ORIGINS = new Set([
  "https://crossfade-e0a.pages.dev",
  "https://crossfademusic.netlify.app",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  if (!ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Vary": "Origin",
  };
}

// The Google session the browser sends, checked with Supabase Auth. Null if it isn't valid.
async function signedInUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!/^Bearer \S+$/.test(auth)) return null;
  try {
    const res = await fetch(env("SUPABASE_URL") + "/auth/v1/user", {
      headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: auth },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const user = await res.json() as { id?: unknown };
    return typeof user.id === "string" ? user.id : null;
  } catch {
    return null;
  }
}

// ---------- the real database ----------

class RestError extends Error {}

async function rest(path: string, init: RequestInit & { prefer?: string } = {}): Promise<unknown> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(env("SUPABASE_URL") + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  if (!res.ok) throw new RestError("db " + res.status + " " + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}

const iso = (ms: number) => new Date(ms).toISOString();
const q = encodeURIComponent;

export const realDb: Db = {
  async buildTimesSince(ownerId, sinceMs) {
    const rows = await rest("builds?select=created_at&owner_id=eq." + q(ownerId) + "&created_at=gt." + q(iso(sinceMs))) as { created_at: string }[];
    return rows.map((r) => Date.parse(r.created_at));
  },
  async insertBuild(id, ownerId, createdAtMs, total) {
    await rest("builds", { method: "POST", body: JSON.stringify({ id, owner_id: ownerId, created_at: iso(createdAtMs), total }) });
  },
  async updateBuild(id, fields) {
    // Progress is read by polling, so a write every 5 songs is enough (and 5× fewer calls).
    if (fields.done !== undefined && fields.status === undefined && fields.total === undefined && fields.done % 5 !== 0) return;
    await rest("builds?id=eq." + q(id), { method: "PATCH", body: JSON.stringify(fields) });
  },
  async saveDraft(id, draft: Draft) {
    await rest("builds?id=eq." + q(id), { method: "PATCH", body: JSON.stringify({ draft, status: "matched", done: draft.report.tracks.length }) });
  },
  async getBuild(id) {
    const rows = await rest("builds?select=owner_id,created_at,status,draft&id=eq." + q(id)) as
      { owner_id: string | null; created_at: string; status: BuildStatus; draft: Draft | null }[];
    return rows[0] ? { ...rows[0], created_at: Date.parse(rows[0].created_at) } : null;
  },
  async linksSince(ownerId, sinceMs) {
    const rows = await rest("links?select=id&owner_id=eq." + q(ownerId) + "&created_at=gt." + q(iso(sinceMs))) as unknown[];
    return rows.length;
  },
  // links, then link_tracks. If the tracks fail, the link row is deleted again, so a friend
  // never opens a link with no songs.
  async saveLink(link: SavedLink) {
    const [row] = await rest("links?select=id", {
      method: "POST", prefer: "return=representation",
      body: JSON.stringify({
        code: link.code, owner_id: link.owner_id, title: link.title, source_url: link.source_url,
        apple_name: link.name, apple_owner: link.owner, artwork_url: link.artwork_url,
        spotify_playlist_id: link.spotify_playlist_id, track_count: link.track_count, matched_count: link.matched_count,
      }),
    }) as { id: number }[];
    try {
      await rest("link_tracks", { method: "POST", body: JSON.stringify(link.tracks.map((t) => ({ link_id: row.id, ...t }))) });
    } catch (e) {
      await rest("links?id=eq." + row.id, { method: "DELETE" }).catch(() => {});
      throw e;
    }
  },
};

export function realDeps(userId: string | null): Deps {
  return {
    userId,
    readApple: (url) => fetchPlaylist(url),
    connectSpotify: () => connectSpotify({
      clientId: env("SPOTIFY_CLIENT_ID"), clientSecret: env("SPOTIFY_CLIENT_SECRET"), refreshToken: env("SPOTIFY_REFRESH_TOKEN"),
    }),
    db: realDb,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    randomCode,
    newBuildId: () => crypto.randomUUID(),
    // One JSON line per event in the function's logs. Never the session token.
    log: (event, data) => console.log(JSON.stringify({ event, ...data })),
  };
}

// One Edge Function: POST JSON in, JSON out, with CORS and the signed-in sender.
export function serve(handler: (body: Record<string, unknown>, deps: Deps) => Promise<{ http: number; body: unknown }>) {
  Deno.serve(async (req) => {
    const headers = { ...cors(req), "Content-Type": "application/json" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only." }), { status: 405, headers });
    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      body = {};
    }
    try {
      const out = await handler(body, realDeps(await signedInUser(req)));
      return new Response(JSON.stringify(out.body), { status: out.http, headers });
    } catch (e) {
      console.log(JSON.stringify({ event: "crash", error: String(e) }));
      return new Response(JSON.stringify({ error: "Something failed on Crossfade's side. Nothing was sent. Try again." }), { status: 500, headers });
    }
  });
}
