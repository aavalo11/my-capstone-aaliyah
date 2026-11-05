// create-link, steps 1–9 (architecture §2), with every outside service passed in. The
// Edge Function hands it the real Apple reader, Spotify and database; tests and
// scripts/create-link-dry-run.ts hand it fakes. Nothing here reads env vars or calls fetch.

import { AppleError, MAX_TRACKS, parseAppleLink, type ApplePlaylist, type AppleTrack } from "./apple.ts";
import { closeQuery, pickClose, type SpotifyCandidate } from "./match.ts";
import { SpotifyError, type SpotifyPort } from "./spotify.ts";

export const RATE_LIMIT = 20; // builds per rolling hour (R6)
export const HOUR_MS = 60 * 60 * 1000;
export const SEARCHES_AT_ONCE = 5; // architecture §2, "Speed"
export const GIVE_UP_AFTER_MS = 120_000; // a retry wait that would pass this fails instead
export const NAME_MAX = 100; // code points (architecture §5)

export const MSG = {
  wrongPasscode: "Wrong passcode.",
  notPlaylist: "That isn't an Apple Music playlist link.",
  notUs: "Crossfade only handles US Apple Music links.",
  notShared: "Apple Music wouldn't share this playlist. Check that it's shared by link.",
  empty: "This playlist is empty.",
  tooMany: "This playlist has more than 100 tracks. Crossfade handles up to 100.",
  rateLimited: (min: number) => "Crossfade is rate-limited. Try again in " + min + (min === 1 ? " minute." : " minutes."),
  failed: (side: "Apple Music" | "Spotify" | "Crossfade") => "Something failed on " + side + "'s side. Nothing was sent. Try again.",
};

export type Db = {
  buildTimesSince(sinceMs: number): Promise<number[]>; // created_at of each build, any order
  insertBuild(id: string, createdAtMs: number, total: number): Promise<void>;
  updateBuild(id: string, fields: { done?: number; total?: number; status?: "running" | "ok" | "failed" }): Promise<void>;
  saveLink(link: SavedLink): Promise<void>; // links + link_tracks in one transaction
};

export type SavedLink = {
  code: string;
  source_url: string;
  name: string;
  spotify_playlist_id: string;
  track_count: number;
  matched_count: number;
  tracks: {
    position: number; // 0-based (architecture §4)
    source_title: string;
    source_artist: string;
    isrc: null; // always null in v1 (ADR 0012)
    tier: "exact" | "close" | "unmatched";
    spotify_track_id: string | null;
    spotify_title: string | null;
    spotify_artists: string | null;
  }[];
};

export type Deps = {
  senderPasscode: string | undefined; // SENDER_PASSCODE
  readApple(link: string): Promise<ApplePlaylist>;
  connectSpotify(): Promise<SpotifyPort>;
  db: Db;
  now(): number;
  sleep(ms: number): Promise<void>;
  randomCode(): string;
  newBuildId(): string;
  log(event: string, data?: Record<string, unknown>): void; // never given the passcode
};

export type ReportRow = {
  position: number; // 1-based, as shown
  title: string;
  artist: string;
  tier: "exact" | "close" | "unmatched";
  spotify: { id: string; title: string; artists: string } | null;
};
export type Report = { name: string; matched: number; total: number; tracks: ReportRow[] };

export type Outcome =
  | { http: 200; body: { code: string; report: Report } }
  | { http: 200; body: { code: null; report: Report } } // zero matched: report, no link (R1)
  | { http: number; body: { error: string } };

const fail = (http: number, error: string): Outcome => ({ http, body: { error } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Step 1: compare SHA-256 digests byte by byte, so the time taken doesn't depend on how
// much of the passcode was right.
export async function samePasscode(given: unknown, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(given ?? ""))),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// 10 characters from [A-Za-z0-9], with rejection sampling so every character is equally likely.
export function randomCode(): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  while (out.length < 10) {
    for (const byte of crypto.getRandomValues(new Uint8Array(16))) {
      if (byte < 248 && out.length < 10) out += A[byte % 62]; // 248 = 4 × 62
    }
  }
  return out;
}

export function playlistName(appleName: string): string {
  const name = Array.from(String(appleName ?? "")).slice(0, NAME_MAX).join("");
  return name.trim() === "" ? "Untitled playlist" : name;
}

const describe = (matched: number, total: number) =>
  "Rebuilt from Apple Music by Crossfade. " + matched + " of " + total + " tracks matched.";

export async function createLink(input: { link?: unknown; passcode?: unknown; build_id?: unknown }, deps: Deps): Promise<Outcome> {
  const started = deps.now();

  // 1. Passcode. An unset SENDER_PASSCODE is a server mistake, never "no passcode needed".
  if (!deps.senderPasscode) {
    deps.log("config", { missing: "SENDER_PASSCODE" });
    return fail(500, MSG.failed("Crossfade"));
  }
  if (!(await samePasscode(input.passcode, deps.senderPasscode))) return fail(401, MSG.wrongPasscode);

  // 2. Link format.
  let source: { id: string; url: string };
  try {
    source = parseAppleLink(String(input.link ?? ""));
  } catch (e) {
    if (e instanceof AppleError) return fail(400, e.kind === "not-us" ? MSG.notUs : MSG.notPlaylist);
    throw e;
  }

  // 3–4. Rate limit, then the builds row. From here on the build counts (R6).
  const buildId = typeof input.build_id === "string" && UUID.test(input.build_id) ? input.build_id : deps.newBuildId();
  try {
    const times = (await deps.db.buildTimesSince(started - HOUR_MS)).sort((a, b) => a - b);
    if (times.length >= RATE_LIMIT) {
      // The window drops below the limit when the (n − 19)th oldest build turns an hour old.
      const freesAt = times[times.length - RATE_LIMIT] + HOUR_MS;
      return fail(429, MSG.rateLimited(Math.max(1, Math.ceil((freesAt - started) / 60_000))));
    }
    await deps.db.insertBuild(buildId, started, 0);
  } catch (e) {
    deps.log("db", { step: "rate-limit", error: String(e) });
    return fail(500, MSG.failed("Crossfade"));
  }

  const progress = (fields: Parameters<Db["updateBuild"]>[1]) =>
    deps.db.updateBuild(buildId, fields).catch((e) => deps.log("db", { step: "progress", error: String(e) }));
  const stop = async (out: Outcome) => { await progress({ status: "failed" }); return out; };

  // 5. Apple.
  let playlist: ApplePlaylist;
  try {
    playlist = await deps.readApple(source.url);
  } catch (e) {
    if (!(e instanceof AppleError)) throw e;
    deps.log("apple", { kind: e.kind, detail: e.detail });
    const msg = e.kind === "not-shared" ? MSG.notShared : e.kind === "empty" ? MSG.empty
      : e.kind === "too-many" ? MSG.tooMany : e.kind === "not-us" ? MSG.notUs
      : e.kind === "not-playlist" ? MSG.notPlaylist : MSG.failed("Apple Music");
    return stop(fail(e.kind === "apple-failed" ? 502 : 422, msg));
  }
  if (playlist.tracks.length === 0) return stop(fail(422, MSG.empty));
  if (playlist.tracks.length > MAX_TRACKS) return stop(fail(422, MSG.tooMany));
  const total = playlist.tracks.length;
  await progress({ total, done: 0 });

  // 6. Match, 5 searches at a time, each retried once on a timeout or 429.
  let spotify: SpotifyPort;
  try {
    spotify = await deps.connectSpotify();
  } catch (e) {
    deps.log("spotify", { step: "token", ...spotifyInfo(e) });
    return stop(fail(502, MSG.failed("Spotify")));
  }

  const results: ReturnType<typeof pickClose>[] = new Array(total);
  let done = 0;
  try {
    await pool(playlist.tracks, SEARCHES_AT_ONCE, async (t, i) => {
      results[i] = t.kind === "song"
        ? pickClose(t, (await withRetry(() => spotify.search(t.title, t.primaryArtist), deps, started)) as SpotifyCandidate[])
        : pickClose(t, []); // a music video: unmatched, no search
      done++;
      await progress({ done });
    });
  } catch (e) {
    deps.log("spotify", { step: "search", ...spotifyInfo(e) });
    if (!(e instanceof SpotifyError)) throw e;
    return stop(fail(502, MSG.failed("Spotify")));
  }

  const report = toReport(playlist, results);

  // 7. Zero matched: show the report, create nothing, issue no link.
  if (report.matched === 0) {
    await progress({ status: "failed" });
    return { http: 200, body: { code: null, report } };
  }

  // 8. The Spotify playlist, matched tracks only, in source order, duplicates included.
  const uris = results.flatMap((r) => (r.tier === "close" ? [r.candidate.uri ?? "spotify:track:" + r.candidate.id] : []));
  let playlistId: string;
  try {
    playlistId = (await withRetry(() => spotify.createPlaylist(playlistName(playlist.name), describe(report.matched, total)), deps, started)).id;
  } catch (e) {
    deps.log("spotify", { step: "create", ...spotifyInfo(e) });
    if (!(e instanceof SpotifyError)) throw e;
    return stop(fail(502, MSG.failed("Spotify")));
  }

  const cleanUp = async () => {
    try {
      await spotify.removePlaylist(playlistId);
    } catch (e) {
      deps.log("cleanup-failed", { spotify_playlist_id: playlistId, ...spotifyInfo(e) }); // remove by hand
    }
  };

  try {
    await withRetry(() => spotify.addTracks(playlistId, uris), deps, started);
  } catch (e) {
    deps.log("spotify", { step: "add", ...spotifyInfo(e) });
    await cleanUp();
    return stop(fail(502, MSG.failed(e instanceof SpotifyError ? "Spotify" : "Crossfade")));
  }

  // 9. Save the link and its tracks, then answer.
  const code = deps.randomCode();
  try {
    await deps.db.saveLink(toSaved(code, source.url, playlist, playlistId, report));
  } catch (e) {
    deps.log("db", { step: "save", error: String(e) });
    await cleanUp();
    return stop(fail(500, MSG.failed("Crossfade")));
  }
  await progress({ status: "ok" });
  deps.log("built", { build_id: buildId, matched: report.matched, total, ms: deps.now() - started });
  return { http: 200, body: { code, report } };
}

// A timeout (status 0) or a 429 gets one more try: after Retry-After for a 429, at once for
// a timeout, and only if waiting wouldn't carry the build past GIVE_UP_AFTER_MS.
async function withRetry<T>(fn: () => Promise<T>, deps: Deps, started: number): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof SpotifyError) || (e.status !== 429 && e.status !== 0)) throw e;
    const waitMs = e.status === 429 ? (e.retryAfterS ?? 1) * 1000 : 0;
    if (deps.now() - started + waitMs > GIVE_UP_AFTER_MS) throw e;
    if (waitMs > 0) await deps.sleep(waitMs);
    return await fn();
  }
}

// Runs fn over items with at most `size` running at once. The first failure rejects.
async function pool<T>(items: T[], size: number, fn: (item: T, i: number) => Promise<void>): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const i = next++;
      try { await fn(items[i], i); } catch (e) { failed = true; throw e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

function toReport(p: ApplePlaylist, results: ReturnType<typeof pickClose>[]): Report {
  const tracks = p.tracks.map((t: AppleTrack, i): ReportRow => {
    const r = results[i];
    return {
      position: t.position,
      title: t.title,
      artist: t.artistName,
      tier: r.tier,
      spotify: r.tier === "close"
        ? { id: r.candidate.id, title: r.candidate.name, artists: r.candidate.artists.map((a) => a.name).join(", ") }
        : null,
    };
  });
  return { name: p.name, matched: tracks.filter((t) => t.tier !== "unmatched").length, total: tracks.length, tracks };
}

function toSaved(code: string, url: string, p: ApplePlaylist, playlistId: string, report: Report): SavedLink {
  return {
    code,
    source_url: url,
    name: playlistName(p.name),
    spotify_playlist_id: playlistId,
    track_count: report.total,
    matched_count: report.matched,
    tracks: report.tracks.map((row, i) => ({
      position: i,
      source_title: row.title,
      source_artist: row.artist,
      isrc: null,
      tier: row.tier,
      spotify_track_id: row.spotify?.id ?? null,
      spotify_title: row.spotify?.title ?? null,
      spotify_artists: row.spotify?.artists ?? null,
    })),
  };
}

function spotifyInfo(e: unknown): Record<string, unknown> {
  return e instanceof SpotifyError ? { status: e.status, body: e.body } : { error: String(e) };
}
