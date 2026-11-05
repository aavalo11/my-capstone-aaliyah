// Apple side of create-link (architecture §2, steps 2 and 5). Reads the public share page
// instead of the Apple Music API (ADR 0012). Runs on Deno in the Edge Function and on
// Node 24 in tests/unit, so it uses only fetch, URL and JSON.parse.

export const MAX_TRACKS = 100; // PRD D6

// Every failure is thrown as one of these. `kind` picks the PRD R1 message, `side` picks
// which service the "Something failed on <side>'s side" message names.
export type AppleErrorKind =
  | "not-playlist" // That isn't an Apple Music playlist link.
  | "not-us" // Crossfade only handles US Apple Music links.
  | "not-shared" // Apple Music wouldn't share this playlist. Check that it's shared by link.
  | "empty" // This playlist is empty.
  | "too-many" // This playlist has more than 100 tracks. Crossfade handles up to 100.
  | "apple-failed"; // Something failed on Apple Music's side. Nothing was sent. Try again.

export class AppleError extends Error {
  kind: AppleErrorKind;
  detail: string;
  constructor(kind: AppleErrorKind, detail = "") {
    super("apple-" + kind + (detail ? ": " + detail : ""));
    this.name = "AppleError";
    this.kind = kind;
    this.detail = detail;
  }
}

export type AppleTrack = {
  position: number; // 1-based, source order (R4 keeps it, duplicates included)
  appleId: string | null;
  kind: string; // "song" for a song. Anything else (a music video) is always unmatched (R2).
  title: string;
  artistName: string; // the full string Apple shows, e.g. "DJ Snake & AlunaGeorge"
  primaryArtist: string; // first subtitleLinks entry, else artistName unchanged (R2)
  durationMs: number | null;
  explicit: boolean; // only showExplicitBadge === true counts (R2)
};

export type ApplePlaylist = {
  id: string;
  name: string;
  trackCount: number;
  tracks: AppleTrack[];
};

// Step 2 (PRD R1 "What counts as a valid link"): http(s), host music.apple.com, path
// /us/playlist/<any-slug>/<id> with <id> starting "pl.". A trailing slash and any query
// string are ignored. Returns the id and a clean URL to fetch.
export function parseAppleLink(input: string): { id: string; url: string } {
  let u: URL;
  try {
    u = new URL(String(input ?? "").trim());
  } catch {
    throw new AppleError("not-playlist", "not a URL");
  }
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.hostname !== "music.apple.com") {
    throw new AppleError("not-playlist", "host " + u.hostname);
  }
  const parts = u.pathname.split("/").filter(Boolean);
  // [storefront, "playlist", slug, id]
  if (parts.length !== 4 || parts[1] !== "playlist" || !parts[3].startsWith("pl.")) {
    throw new AppleError("not-playlist", "path " + u.pathname);
  }
  if (parts[0] !== "us") throw new AppleError("not-us", "storefront " + parts[0]);
  const id = parts[3];
  return { id, url: "https://music.apple.com/us/playlist/" + encodeURIComponent(parts[2]) + "/" + id };
}

const BLOCK = /<script type="application\/json" id="serialized-server-data">([\s\S]*?)<\/script>/;

type Section = { id?: string; items?: Record<string, unknown>[] };

// Step 5, the parsing half. Takes the page's HTML and returns the playlist, or throws.
// A page without the block or the track-list section fails like an Apple error
// (architecture §2): Apple changed the page, and that's on Apple's side.
export function readSharePage(html: string, id = ""): ApplePlaylist {
  const m = BLOCK.exec(html);
  if (!m) throw new AppleError("apple-failed", "no serialized-server-data block");

  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    throw new AppleError("apple-failed", "serialized-server-data isn't JSON");
  }

  // Shape seen on 2026-11-05: { data: [ { intent, data: { sections: [...] } } ] }
  const sections = (data as { data?: { data?: { sections?: Section[] } }[] })?.data?.[0]?.data?.sections;
  if (!Array.isArray(sections)) throw new AppleError("apple-failed", "no sections");

  const list = sections.find((s) => typeof s?.id === "string" && s.id.startsWith("track-list"));
  if (!list || !Array.isArray(list.items)) throw new AppleError("apple-failed", "no track-list section");

  const header = sections.find((s) => typeof s?.id === "string" && s.id.startsWith("playlist-detail-header"))
    ?.items?.[0] as { title?: unknown; trackCount?: unknown } | undefined;
  const name = typeof header?.title === "string" ? header.title : "";
  const headerCount = typeof header?.trackCount === "number" ? header.trackCount : null;

  const items = list.items;
  // Size checks use the larger of the header's count and what the page holds, so a page
  // that only carries a first batch can't sneak past the 100 limit.
  const count = Math.max(headerCount ?? 0, items.length);
  if (count === 0) throw new AppleError("empty");
  if (count > MAX_TRACKS) throw new AppleError("too-many", count + " tracks");
  // D6 check: on 2026-11-05 a 100-track page held all 100. If Apple ever sends fewer
  // items than the header promises, stop rather than silently drop tracks (R3).
  if (headerCount !== null && items.length < headerCount) {
    throw new AppleError("apple-failed", "page holds " + items.length + " of " + headerCount + " tracks");
  }

  return { id, name, trackCount: count, tracks: items.map(toTrack) };
}

function toTrack(item: Record<string, unknown>, i: number): AppleTrack {
  const cd = item.contentDescriptor as { kind?: unknown; identifiers?: { storeAdamID?: unknown } } | undefined;
  const links = Array.isArray(item.subtitleLinks) ? (item.subtitleLinks as { title?: unknown }[]) : [];
  const artistName = typeof item.artistName === "string" ? item.artistName : "";
  const first = typeof links[0]?.title === "string" ? (links[0].title as string) : "";
  return {
    position: i + 1,
    appleId: typeof cd?.identifiers?.storeAdamID === "string" ? cd.identifiers.storeAdamID : null,
    kind: typeof cd?.kind === "string" ? cd.kind : "unknown",
    title: typeof item.title === "string" ? item.title : "",
    artistName,
    primaryArtist: first || artistName,
    durationMs: typeof item.duration === "number" ? item.duration : null,
    explicit: item.showExplicitBadge === true,
  };
}

// Step 5, the fetching half. A 404 means private, deleted or a mistyped id (R1).
// Anything else that isn't a 200, or a network error, is Apple's side.
export async function fetchPlaylist(link: string, fetchImpl: typeof fetch = fetch): Promise<ApplePlaylist> {
  const { id, url } = parseAppleLink(link);
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: "text/html" }, redirect: "follow" });
  } catch (e) {
    throw new AppleError("apple-failed", "network: " + (e as Error).message);
  }
  if (res.status === 404) throw new AppleError("not-shared", "404");
  if (!res.ok) throw new AppleError("apple-failed", "status " + res.status);
  return readSharePage(await res.text(), id);
}
