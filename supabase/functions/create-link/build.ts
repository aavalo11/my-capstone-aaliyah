// create-link (architecture §2), split in three for ADR 0029, with every outside service
// passed in. The Edge Functions hand these the real Apple reader, Spotify and database; tests
// and scripts/create-link-dry-run.ts hand them fakes. Nothing here reads env vars or calls fetch.
//
//   matchPlaylist  R1 steps 2–7: Apple, then R2 matching. Saves a draft. Nothing on Spotify.
//   searchSongs    the edit screen's Spotify search, for songs to add.
//   publishLink    the sender's edits applied to the draft, then R4's playlist and the link.
//   createLink     match, then publish with no edits (the dry run, and most tests).

import { AppleError, MAX_TRACKS, parseAppleLink, type ApplePlaylist, type AppleTrack } from "./apple.ts";
import { pickClose, type SpotifyCandidate } from "./match.ts";
import { SpotifyError, type SpotifyCandidateRaw, type SpotifyPort } from "./spotify.ts";

export const RATE_LIMIT = 20; // builds per account per rolling hour (R6)
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
export const DAILY_LINKS = 10; // links per account per rolling day (ADR 0019)
export const DRAFT_TTL_MS = HOUR_MS; // a draft older than this can't be published (ADR 0029)
export const MAX_ADDED = 50; // songs the sender can add to one draft
export const SEARCHES_AT_ONCE = 5; // architecture §2, "Speed"
export const GIVE_UP_AFTER_MS = 120_000; // a retry wait that would pass this fails instead
export const NAME_MAX = 100; // code points (architecture §5)

export const MSG = {
  signIn: "Sign in to make a link.",
  notPlaylist: "That isn't an Apple Music playlist link.",
  notUs: "Crossfade only handles US Apple Music links.",
  notShared: "Apple Music wouldn't share this playlist. Check that it's shared by link.",
  empty: "This playlist is empty.",
  tooMany: "This playlist has more than 100 tracks. Crossfade handles up to 100.",
  rateLimited: (min: number) => "Crossfade is rate-limited. Try again in " + min + (min === 1 ? " minute." : " minutes."),
  dailyLimit: "You've made " + DAILY_LINKS + " links today. You can make more tomorrow.",
  draftGone: "That match isn't here anymore. Paste the link again.",
  draftExpired: "That match is over an hour old. Paste the link again.",
  alreadyMade: "You already made a link from this match.",
  badEdit: "Those changes didn't add up. Reload the page and try again.",
  nothingLeft: "There are no songs left to put in the playlist.",
  badSearch: "Type a song or an artist to search.",
  failed: (side: "Apple Music" | "Spotify" | "Crossfade") => "Something failed on " + side + "'s side. Nothing was sent. Try again.",
};

export type BuildStatus = "running" | "matched" | "ok" | "failed";

// What matchPlaylist saves and publishLink reads back (builds.draft, ADR 0029).
export type Draft = { source_url: string; report: Report };

export type Db = {
  buildTimesSince(ownerId: string, sinceMs: number): Promise<number[]>; // created_at of each build, any order
  insertBuild(id: string, ownerId: string, createdAtMs: number, total: number): Promise<void>;
  updateBuild(id: string, fields: { done?: number; total?: number; status?: BuildStatus }): Promise<void>;
  saveDraft(id: string, draft: Draft): Promise<void>; // and status = matched
  getBuild(id: string): Promise<{ owner_id: string | null; created_at: number; status: BuildStatus; draft: Draft | null } | null>;
  linksSince(ownerId: string, sinceMs: number): Promise<number>;
  saveLink(link: SavedLink): Promise<void>; // links + link_tracks; nothing half-saved
};

export type Tier = "exact" | "close" | "unmatched" | "added";

export type SavedLink = {
  code: string;
  owner_id: string;
  title: string; // the sender's name for it
  source_url: string;
  name: string; // the Apple playlist's name
  spotify_playlist_id: string;
  track_count: number; // rows on the link
  matched_count: number; // rows in the Spotify playlist
  owner: string | null; // Apple display name (ADR 0025)
  artwork_url: string | null;
  tracks: {
    position: number; // 0-based (architecture §4)
    source_title: string;
    source_artist: string;
    isrc: null; // always null in v1 (ADR 0012)
    tier: Tier;
    spotify_track_id: string | null;
    spotify_title: string | null;
    spotify_artists: string | null;
    artwork_url: string | null; // ADR 0025
    duration_ms: number | null;
    near_track_id: string | null; // ADR 0026, unmatched rows only
    near_title: string | null;
    near_artists: string | null;
  }[];
};

export type Deps = {
  userId: string | null; // the signed-in sender, from their Google session (ADR 0019, 0029)
  readApple(link: string): Promise<ApplePlaylist>;
  connectSpotify(): Promise<SpotifyPort>;
  db: Db;
  now(): number;
  sleep(ms: number): Promise<void>;
  randomCode(): string;
  newBuildId(): string;
  log(event: string, data?: Record<string, unknown>): void;
};

export type ReportRow = {
  position: number; // 1-based, as shown; an added song continues after the Apple rows
  title: string;
  artist: string;
  tier: Tier;
  spotify: { id: string; title: string; artists: string } | null;
  artwork: string | null; // ADR 0025
  duration_ms: number | null;
  near: { id: string; title: string; artists: string } | null; // ADR 0026
};
export type Report = {
  name: string; owner: string | null; artwork: string | null;
  matched: number; total: number; tracks: ReportRow[];
};

export type Outcome<B> = { http: 200; body: B } | { http: number; body: { error: string } };
export type MatchOutcome = Outcome<{ build_id: string; report: Report; publishable: boolean }>;
export type PublishOutcome = Outcome<{ code: string; report: Report; spotify_playlist_id: string }>;
export type LinkOutcome = Outcome<{ code: string | null; report: Report }>;
export type SongResult = { id: string; title: string; artists: string; artwork: string | null; duration_ms: number | null; explicit: boolean };
export type SearchOutcome = Outcome<{ songs: SongResult[] }>;

const fail = (http: number, error: string) => ({ http, body: { error } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRACK_ID = /^[A-Za-z0-9]{22}$/;

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

// The sender's name for the link and its Spotify playlist, or the Apple name when it's blank.
function linkTitle(given: unknown, appleName: string): string {
  const t = Array.from(String(given ?? "").trim()).slice(0, NAME_MAX).join("");
  return t === "" ? playlistName(appleName) : t;
}

const describe = (matched: number, total: number) =>
  "Rebuilt from Apple Music by Crossfade. " + matched + " of " + total + " tracks matched.";

// ---------- matchPlaylist: R1 steps 2–7 ----------

export async function matchPlaylist(input: { link?: unknown; build_id?: unknown }, deps: Deps): Promise<MatchOutcome> {
  const started = deps.now();

  // 1. Signed in. The Edge Function has already checked the session; no user, no build.
  const owner = deps.userId;
  if (!owner) return fail(401, MSG.signIn);

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
    const times = (await deps.db.buildTimesSince(owner, started - HOUR_MS)).sort((a, b) => a - b);
    if (times.length >= RATE_LIMIT) {
      // The window drops below the limit when the (n − 19)th oldest build turns an hour old.
      const freesAt = times[times.length - RATE_LIMIT] + HOUR_MS;
      return fail(429, MSG.rateLimited(Math.max(1, Math.ceil((freesAt - started) / 60_000))));
    }
    await deps.db.insertBuild(buildId, owner, started, 0);
  } catch (e) {
    deps.log("db", { step: "rate-limit", error: String(e) });
    return fail(500, MSG.failed("Crossfade"));
  }

  const progress = (fields: Parameters<Db["updateBuild"]>[1]) =>
    deps.db.updateBuild(buildId, fields).catch((e) => deps.log("db", { step: "progress", error: String(e) }));
  const stop = async <T>(out: T) => { await progress({ status: "failed" }); return out; };

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

  // 7. Save the draft. Zero matched can still be published if the sender adds songs, so the
  // draft is kept either way; `publishable` tells Create whether one tap is enough.
  try {
    await deps.db.saveDraft(buildId, { source_url: source.url, report });
  } catch (e) {
    deps.log("db", { step: "draft", error: String(e) });
    return stop(fail(500, MSG.failed("Crossfade")));
  }
  deps.log("matched", { build_id: buildId, matched: report.matched, total, ms: deps.now() - started });
  return { http: 200, body: { build_id: buildId, report, publishable: report.matched > 0 } };
}

// ---------- searchSongs: the edit screen (ADR 0029) ----------

export async function searchSongs(input: { q?: unknown }, deps: Pick<Deps, "userId" | "connectSpotify" | "log">): Promise<SearchOutcome> {
  if (!deps.userId) return fail(401, MSG.signIn);
  const q = String(input.q ?? "").trim().slice(0, 100);
  if (q === "") return fail(400, MSG.badSearch);
  try {
    const spotify = await deps.connectSpotify();
    const found = await spotify.searchAny(q);
    return { http: 200, body: { songs: found.slice(0, 10).map(toSong) } };
  } catch (e) {
    deps.log("spotify", { step: "search-songs", ...spotifyInfo(e) });
    if (!(e instanceof SpotifyError)) throw e;
    return fail(502, MSG.failed("Spotify"));
  }
}

// ---------- publishLink: R1 steps 8–9 with the sender's edits ----------

export async function publishLink(
  input: { build_id?: unknown; title?: unknown; remove?: unknown; add?: unknown },
  deps: Deps,
): Promise<PublishOutcome> {
  const started = deps.now();
  const owner = deps.userId;
  if (!owner) return fail(401, MSG.signIn);

  // The edits have to make sense before anything is looked up.
  const remove = Array.isArray(input.remove ?? []) ? (input.remove ?? []) as unknown[] : null;
  const add = Array.isArray(input.add ?? []) ? (input.add ?? []) as unknown[] : null;
  if (!remove || !add || add.length > MAX_ADDED || !add.every((id) => typeof id === "string" && TRACK_ID.test(id)) ||
      !remove.every((p) => Number.isInteger(p))) {
    return fail(400, MSG.badEdit);
  }
  if (typeof input.build_id !== "string" || !UUID.test(input.build_id)) return fail(404, MSG.draftGone);
  const buildId = input.build_id;

  // The draft: this sender's own, matched, under an hour old.
  let build: Awaited<ReturnType<Db["getBuild"]>>;
  let madeToday: number;
  try {
    build = await deps.db.getBuild(buildId);
    madeToday = await deps.db.linksSince(owner, started - DAY_MS);
  } catch (e) {
    deps.log("db", { step: "draft-read", error: String(e) });
    return fail(500, MSG.failed("Crossfade"));
  }
  if (!build || build.owner_id !== owner || !build.draft) return fail(404, MSG.draftGone);
  if (build.status === "ok") return fail(409, MSG.alreadyMade);
  if (build.status !== "matched") return fail(404, MSG.draftGone);
  if (started - build.created_at > DRAFT_TTL_MS) return fail(410, MSG.draftExpired);
  if (madeToday >= DAILY_LINKS) return fail(429, MSG.dailyLimit);

  const { report: matched, source_url } = build.draft;
  const positions = new Set(matched.tracks.map((t) => t.position));
  if (!remove.every((p) => positions.has(p as number))) return fail(400, MSG.badEdit);
  const removed = new Set(remove as number[]);

  let spotify: SpotifyPort;
  try {
    spotify = await deps.connectSpotify();
  } catch (e) {
    deps.log("spotify", { step: "token", ...spotifyInfo(e) });
    return fail(502, MSG.failed("Spotify"));
  }

  // Each added song is looked up, so the playlist only gets real tracks Spotify plays in the US.
  const added: SongResult[] = new Array(add.length);
  try {
    await pool(add as string[], SEARCHES_AT_ONCE, async (id, i) => {
      added[i] = toSong(await withRetry(() => spotify.getTrack(id), deps, started));
    });
  } catch (e) {
    deps.log("spotify", { step: "get-track", ...spotifyInfo(e) });
    if (e instanceof SpotifyError && e.status === 404) return fail(400, MSG.badEdit);
    if (!(e instanceof SpotifyError)) throw e;
    return fail(502, MSG.failed("Spotify"));
  }

  const report = editReport(matched, removed, added);
  const inPlaylist = report.tracks.filter((t) => t.spotify !== null);
  if (inPlaylist.length === 0) return fail(422, MSG.nothingLeft);
  const title = linkTitle(input.title, matched.name);

  const progress = (status: BuildStatus) =>
    deps.db.updateBuild(buildId, { status }).catch((e) => deps.log("db", { step: "progress", error: String(e) }));

  // 8. The Spotify playlist: kept matches in source order (duplicates included), then added songs.
  const uris = inPlaylist.map((t) => "spotify:track:" + t.spotify!.id);
  let playlistId: string;
  try {
    playlistId = (await withRetry(() => spotify.createPlaylist(title, describe(report.matched, report.total)), deps, started)).id;
  } catch (e) {
    deps.log("spotify", { step: "create", ...spotifyInfo(e) });
    if (!(e instanceof SpotifyError)) throw e;
    return fail(502, MSG.failed("Spotify")); // the draft stays matched: Try again can publish it
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
    return fail(502, MSG.failed(e instanceof SpotifyError ? "Spotify" : "Crossfade"));
  }

  // 9. Save the link and its tracks, then answer.
  const code = deps.randomCode();
  try {
    await deps.db.saveLink(toSaved(code, owner, title, source_url, playlistId, report));
  } catch (e) {
    deps.log("db", { step: "save", error: String(e) });
    await cleanUp();
    return fail(500, MSG.failed("Crossfade"));
  }
  await progress("ok");
  deps.log("built", { build_id: buildId, matched: report.matched, added: added.length, removed: removed.size, ms: deps.now() - started });
  return { http: 200, body: { code, report, spotify_playlist_id: playlistId } };
}

// ---------- createLink: match, then publish with no edits ----------

export async function createLink(input: { link?: unknown; build_id?: unknown; title?: unknown }, deps: Deps): Promise<LinkOutcome> {
  const m = await matchPlaylist(input, deps);
  if (m.http !== 200 || "error" in m.body) return m as LinkOutcome;
  // R1: zero matched shows the report, creates nothing and issues no link.
  if (!m.body.publishable) {
    await deps.db.updateBuild(m.body.build_id, { status: "failed" }).catch(() => {});
    return { http: 200, body: { code: null, report: m.body.report } };
  }
  const p = await publishLink({ build_id: m.body.build_id, title: input.title }, deps);
  return p.http === 200 && "code" in p.body ? { http: 200, body: { code: p.body.code, report: p.body.report } } : p as LinkOutcome;
}

// ---------- helpers ----------

// A timeout (status 0) or a 429 gets one more try: after Retry-After for a 429, at once for
// a timeout, and only if waiting wouldn't carry the build past GIVE_UP_AFTER_MS.
async function withRetry<T>(fn: () => Promise<T>, deps: Pick<Deps, "now" | "sleep">, started: number): Promise<T> {
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

const brief = (c: { id: string; name: string; artists: { name: string }[] }) =>
  ({ id: c.id, title: c.name, artists: c.artists.map((a) => a.name).join(", ") });

// Spotify's album art nearest 300 px, only from its image CDN (ADR 0029 extends ADR 0025).
function spotifyArt(c: SpotifyCandidateRaw): string | null {
  const imgs = (c.album?.images ?? []).filter((i) => typeof i?.url === "string" && /^https:\/\/i\.scdn\.co\//.test(i.url));
  if (!imgs.length) return null;
  return imgs.reduce((a, b) => (Math.abs((b.width ?? 300) - 300) < Math.abs((a.width ?? 300) - 300) ? b : a)).url;
}

function toSong(c: SpotifyCandidateRaw): SongResult {
  return { ...brief(c), artwork: spotifyArt(c), duration_ms: typeof c.duration_ms === "number" ? c.duration_ms : null, explicit: c.explicit === true };
}

function toReport(p: ApplePlaylist, results: ReturnType<typeof pickClose>[]): Report {
  const tracks = p.tracks.map((t: AppleTrack, i): ReportRow => {
    const r = results[i];
    return {
      position: t.position,
      title: t.title,
      artist: t.artistName,
      tier: r.tier,
      spotify: r.tier === "close" ? brief(r.candidate) : null,
      artwork: t.artworkUrl ?? null,
      duration_ms: t.durationMs,
      near: r.tier === "unmatched" && r.near ? brief(r.near) : null,
    };
  });
  return { name: p.name, owner: p.owner ?? null, artwork: p.artworkUrl ?? null, matched: tracks.filter((t) => t.tier !== "unmatched").length, total: tracks.length, tracks };
}

// The draft with the sender's edits: removed rows dropped, added songs after the rest.
// matched / total count the Apple rows that are left (R3's "Matched X of N").
function editReport(draft: Report, removed: Set<number>, added: SongResult[]): Report {
  const kept = draft.tracks.filter((t) => !removed.has(t.position));
  const last = draft.tracks.reduce((m, t) => Math.max(m, t.position), 0);
  const extra = added.map((s, i): ReportRow => ({
    position: last + 1 + i, title: s.title, artist: s.artists, tier: "added",
    spotify: { id: s.id, title: s.title, artists: s.artists }, artwork: s.artwork, duration_ms: s.duration_ms, near: null,
  }));
  return { ...draft, matched: kept.filter((t) => t.tier !== "unmatched").length, total: kept.length, tracks: [...kept, ...extra] };
}

function toSaved(code: string, ownerId: string, title: string, url: string, playlistId: string, report: Report): SavedLink {
  return {
    code,
    owner_id: ownerId,
    title,
    source_url: url,
    name: playlistName(report.name),
    spotify_playlist_id: playlistId,
    owner: report.owner,
    artwork_url: report.artwork,
    track_count: report.tracks.length,
    matched_count: report.tracks.filter((t) => t.spotify !== null).length,
    tracks: report.tracks.map((row, i) => ({
      position: i,
      source_title: row.title,
      source_artist: row.artist,
      isrc: null,
      tier: row.tier,
      spotify_track_id: row.spotify?.id ?? null,
      spotify_title: row.spotify?.title ?? null,
      spotify_artists: row.spotify?.artists ?? null,
      artwork_url: row.artwork,
      duration_ms: row.duration_ms,
      near_track_id: row.near?.id ?? null,
      near_title: row.near?.title ?? null,
      near_artists: row.near?.artists ?? null,
    })),
  };
}

function spotifyInfo(e: unknown): Record<string, unknown> {
  return e instanceof SpotifyError ? { status: e.status, body: e.body } : { error: String(e) };
}
