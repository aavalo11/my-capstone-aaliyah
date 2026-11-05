// PRD R2's close-match rule, as plain functions with no network calls (architecture §2,
// step 6). create-link searches Spotify with closeQuery(), then hands the results to
// pickClose(). The exact tier never fires in v1: the share page has no ISRCs (ADR 0012).

import type { AppleTrack } from "./apple.ts";
import { trackQuery } from "./spotify.ts";

export const MAX_DURATION_GAP_MS = 3000; // inclusive
export const CANDIDATES_CHECKED = 10; // "of the first 10 results"

// The fields R2 reads from a Spotify search result.
export type SpotifyCandidate = {
  id: string;
  uri?: string;
  name: string;
  artists: { name: string }[];
  duration_ms: number;
  explicit: boolean;
};

export type MatchResult =
  | { tier: "close"; candidate: SpotifyCandidate }
  | { tier: "unmatched"; reason: string };

// A feature segment's first word must be exactly one of these (after lowercasing).
const FEATURE_WORDS = new Set(["feat", "feat.", "ft", "ft.", "with"]);
const isFeature = (inner: string) => FEATURE_WORDS.has(inner.trim().split(/\s+/)[0] ?? "");

// R2 title normalization. Lowercase, drop feature segments, keep only letters, digits and
// spaces in any script, collapse spaces, trim. Never drops remix / live / sped up / etc.
// Two additions R2 doesn't spell out (see the PRD note in the commit): NFC first, so an
// "é" stored as e + accent mark isn't turned into "e"; and any whitespace (tab, no-break
// space) counts as a space, so words don't run together.
export function normalizeTitle(title: string): string {
  let t = String(title ?? "").normalize("NFC").toLowerCase().replace(/\s/g, " ");
  t = t.replace(/\(([^()]*)\)|\[([^[\]]*)\]/g, (seg, p, b) => (isFeature(p ?? b) ? " " : seg));
  const dash = t.indexOf(" - ");
  if (dash !== -1 && isFeature(t.slice(dash + 3))) t = t.slice(0, dash);
  return t.replace(/[^\p{L}\p{N} ]/gu, "").replace(/ +/g, " ").trim();
}

const sameName = (a: string, b: string) =>
  a.normalize("NFC").toLowerCase() === b.normalize("NFC").toLowerCase();

// Why one candidate fails R2's close rule, or null when it passes. The reason is for the
// §8 benchmark and the logs. Sender and recipient only ever see `Not found on Spotify (US)`.
export function closeMismatch(source: AppleTrack, c: SpotifyCandidate): string | null {
  if (normalizeTitle(source.title) !== normalizeTitle(c.name)) return "title";
  if (!c.artists?.some((a) => sameName(a.name ?? "", source.primaryArtist))) return "artist";
  if (source.durationMs === null || typeof c.duration_ms !== "number") return "duration missing";
  if (Math.abs(source.durationMs - c.duration_ms) > MAX_DURATION_GAP_MS) return "duration";
  if (source.explicit !== (c.explicit === true)) return "explicit";
  return null;
}

// R2 steps 2–3: the first of the first 10 candidates that passes every check, else unmatched.
// Anything that isn't a song (a music video) is unmatched without looking at candidates.
export function pickClose(source: AppleTrack, candidates: SpotifyCandidate[]): MatchResult {
  if (source.kind !== "song") return { tier: "unmatched", reason: "not a song (" + source.kind + ")" };
  const checked = (candidates ?? []).slice(0, CANDIDATES_CHECKED);
  if (checked.length === 0) return { tier: "unmatched", reason: "no results" };
  const reasons: string[] = [];
  for (const c of checked) {
    const why = closeMismatch(source, c);
    if (why === null) return { tier: "close", candidate: c };
    reasons.push(why);
  }
  return { tier: "unmatched", reason: "no candidate passed (" + reasons.join(", ") + ")" };
}

// R2 step 2's search for one source track. The format lives in spotify.ts (trackQuery).
export function closeQuery(source: AppleTrack): string {
  return trackQuery(source.title, source.primaryArtist);
}
