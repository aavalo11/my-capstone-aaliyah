// Runs create-link end to end from the terminal: the REAL Apple share page, a FAKE Spotify
// and a FAKE database (tests/fakes/). TODO(W10): real data — swap in the real Spotify once
// the Crossfade account's credentials are in .env.
//
//   node scripts/create-link-dry-run.ts "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D"
//   node scripts/create-link-dry-run.ts --fixture        the saved page, no network at all
//   node scripts/create-link-dry-run.ts --fixture --json > src/sample/build-sample.json
//                                                        the sample Create plays back (ADR 0015)
//
// The fake catalog holds every song, with a few twists so the report shows unmatched rows:
// track 2 missing, 7 only as (Live), 9 with the other explicit flag, 14 ten seconds longer.

import fs from "node:fs";
import { fetchPlaylist, readSharePage } from "../supabase/functions/create-link/apple.ts";
import { createLink, randomCode } from "../supabase/functions/create-link/build.ts";
import { FakeSpotify, catalogFrom } from "../tests/fakes/fake-spotify.mts";
import { FakeDb } from "../tests/fakes/fake-db.mts";

const args = process.argv.slice(2);
const useFixture = args.includes("--fixture");
const asJson = args.includes("--json");
const say = (...m: unknown[]) => { if (!asJson) console.log(...m); };
const link = args.find((a) => !a.startsWith("--")) ?? "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D";
const twists = { 2: "missing", 7: "live-only", 9: "explicit-flip", 14: "long-edit" } as const;

let spotify: FakeSpotify | null = null;
const db = new FakeDb();
db.onProgress = (b) => { if (b.status === "running" && !asJson) process.stdout.write("\r  Matching " + b.done + " of " + b.total + "…"); };

const readApple = async (url: string) => {
  say("  Reading playlist…" + (useFixture ? " (saved page)" : " " + url));
  const p = useFixture
    ? readSharePage(fs.readFileSync(new URL("../tests/fixtures/apple-70-degrees-out.html", import.meta.url), "utf8"), "fixture")
    : await fetchPlaylist(url);
  spotify = new FakeSpotify(catalogFrom(p.tracks, twists), { searchDelayMs: 30 });
  return p;
};

say("create-link dry run — Apple is real" + (useFixture ? " (saved page)" : "") + ", Spotify and the database are FAKE\n");
const t0 = Date.now();
const out = await createLink({ link, passcode: "dry-run", build_id: crypto.randomUUID() }, {
  senderPasscode: "dry-run",
  readApple,
  connectSpotify: () => spotify!.connect(),
  db,
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  randomCode,
  newBuildId: () => crypto.randomUUID(),
  log: (event, data) => { if (event !== "built") console.error("\n  log:", event, JSON.stringify(data)); },
});
say("\n");

if (asJson) {
  console.log(JSON.stringify({
    _sample: true,
    _note: "One create-link dry run (ADR 0015). Apple's tracks are real, read " + new Date().toISOString().slice(0, 10) +
      (useFixture ? " from tests/fixtures/apple-70-degrees-out.html" : " from " + link) +
      ". Every Spotify match is FAKE (tests/fakes/fake-spotify.mts). TODO(W10): real data.",
    http: out.http,
    ...out.body,
  }, null, 1));
  process.exit(out.http === 200 ? 0 : 1);
}

if ("error" in out.body) {
  console.log("→ " + out.http + "  " + out.body.error);
  process.exitCode = 1;
} else {
  const { code, report } = out.body;
  console.log((code ? "→ link /p/" + code : "→ no link (zero matched)") + "   in " + (Date.now() - t0) + " ms\n");
  console.log("  " + report.name + " — Matched " + report.matched + " of " + report.total + "\n");
  for (const t of report.tracks) {
    const line = String(t.position).padStart(3) + "  " + t.title + " — " + t.artist;
    if (t.tier === "unmatched") console.log(line + "\n       Not found on Spotify (US)");
    else console.log(line + "\n       Close match: " + t.spotify!.title + " — " + t.spotify!.artists + "  [FAKE " + t.spotify!.id + "]");
  }
  const pl = [...spotify!.playlists.values()][0];
  if (pl) console.log("\n  FAKE Spotify playlist: \"" + pl.name + "\", " + pl.uris.length + " tracks\n  " + pl.description);
}
