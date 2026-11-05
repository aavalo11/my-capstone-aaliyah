// A FAKE Spotify for tests and scripts/create-link-dry-run.ts. TODO(W10): real data.
// It holds a made-up catalog in memory and records every call, so tests can check what
// create-link sent. Nothing here talks to Spotify.

import { normalizeTitle } from "../../supabase/functions/create-link/match.ts";
import { SpotifyError, type SpotifyCandidateRaw, type SpotifyPort } from "../../supabase/functions/create-link/spotify.ts";
import type { AppleTrack } from "../../supabase/functions/create-link/apple.ts";

export type Twist =
  | "missing" // not in the catalog at all
  | "live-only" // only a (Live) version exists
  | "explicit-flip" // the only version has the other explicit flag
  | "long-edit" // the only version is 10 s longer
  | "live-first"; // a (Live) version comes back before the studio one

// One catalog entry per source track, shaped by its twist. Track ids are fake-<position>.
export function catalogFrom(tracks: AppleTrack[], twists: Record<number, Twist> = {}): SpotifyCandidateRaw[] {
  const out: SpotifyCandidateRaw[] = [];
  for (const t of tracks) {
    if (t.kind !== "song") continue;
    const base = {
      id: "fake-" + t.position, uri: "spotify:track:fake-" + t.position, name: t.title,
      // One name unless Apple joined several: "Tyler, The Creator" is one artist.
      artists: (t.artistName === t.primaryArtist ? [t.artistName] : t.artistName.split(/, | & /)).map((name) => ({ name })),
      duration_ms: (t.durationMs ?? 200000) + 400, explicit: t.explicit,
    };
    const live = { ...base, id: base.id + "-live", uri: base.uri + "-live", name: t.title + " (Live)" };
    switch (twists[t.position]) {
      case "missing": break;
      case "live-only": out.push(live); break;
      case "explicit-flip": out.push({ ...base, explicit: !t.explicit }); break;
      case "long-edit": out.push({ ...base, duration_ms: base.duration_ms + 10_000 }); break;
      case "live-first": out.push(live, base); break;
      default: out.push(base);
    }
  }
  return out;
}

// Make the n-th call (1-based) to `method` throw a SpotifyError with this status, `times`
// calls in a row. With `title`, only searches for that title are counted, because searches
// run 5 at a time and their overall order isn't fixed.
export type Failure = {
  method: keyof SpotifyPort | "connect"; call?: number; status: number; retryAfterS?: number; times?: number; title?: string;
};

export class FakeSpotify {
  catalog: SpotifyCandidateRaw[];
  failures: Failure[];
  calls: { method: string; args: unknown[] }[] = [];
  playlists = new Map<string, { name: string; description: string; uris: string[] }>();
  removed: string[] = [];
  inFlight = 0;
  maxInFlight = 0;
  searchDelayMs: number;
  private counts: Record<string, number> = {};

  constructor(catalog: SpotifyCandidateRaw[], opts: { failures?: Failure[]; searchDelayMs?: number } = {}) {
    this.catalog = catalog;
    this.failures = opts.failures ?? [];
    this.searchDelayMs = opts.searchDelayMs ?? 0;
  }

  private maybeFail(method: Failure["method"], title?: string) {
    const n = (this.counts[method] = (this.counts[method] ?? 0) + 1);
    for (const f of this.failures) {
      if (f.method !== method) continue;
      if (f.title !== undefined) {
        if (f.title !== title) continue;
        const k = method + ":" + title;
        const m = (this.counts[k] = (this.counts[k] ?? 0) + 1);
        const first = f.call ?? 1;
        if (m >= first && m < first + (f.times ?? 1)) {
          throw new SpotifyError(f.status, { error: { status: f.status, message: "fake " + method + " failure" } }, f.retryAfterS ?? null);
        }
        continue;
      }
      const first = f.call ?? 1;
      if (n >= first && n < first + (f.times ?? 1)) {
        throw new SpotifyError(f.status, { error: { status: f.status, message: "fake " + method + " failure" } }, f.retryAfterS ?? null);
      }
    }
  }

  // What create-link's deps.connectSpotify() returns.
  async connect(): Promise<SpotifyPort> {
    this.calls.push({ method: "connect", args: [] });
    this.maybeFail("connect");
    return {
      search: async (title, artist) => {
        this.calls.push({ method: "search", args: [title, artist] });
        this.inFlight++;
        this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
        try {
          await new Promise((r) => setTimeout(r, this.searchDelayMs));
          this.maybeFail("search", title);
          // Loose like the real search: same artist, and the normalized title contains the query's.
          const want = normalizeTitle(title);
          return this.catalog
            .filter((c) => c.artists.some((a) => a.name.toLowerCase() === artist.toLowerCase()) && normalizeTitle(c.name).includes(want))
            .slice(0, 10);
        } finally {
          this.inFlight--;
        }
      },
      createPlaylist: async (name, description) => {
        this.calls.push({ method: "createPlaylist", args: [name, description] });
        this.maybeFail("createPlaylist");
        const id = "fakeplaylist" + (this.playlists.size + 1);
        this.playlists.set(id, { name, description, uris: [] });
        return { id };
      },
      addTracks: async (id, uris) => {
        this.calls.push({ method: "addTracks", args: [id, uris] });
        this.maybeFail("addTracks");
        this.playlists.get(id)!.uris.push(...uris);
      },
      removePlaylist: async (id) => {
        this.calls.push({ method: "removePlaylist", args: [id] });
        this.maybeFail("removePlaylist");
        this.removed.push(id);
      },
    };
  }

  count(method: string) {
    return this.calls.filter((c) => c.method === method).length;
  }
}
