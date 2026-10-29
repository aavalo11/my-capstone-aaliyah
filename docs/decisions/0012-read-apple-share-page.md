# 0012 · Read the public Apple Music share page, not the Apple Music API

**Date.** 2026-10-29
**Status.** Decided. Reverses PRD K1's "scraping Apple's web pages is not a fallback."

**Context.** K2 is settled, 20 days after its Oct 9 deadline: SU has no university
developer team (asked a professor), so a MusicKit key means paying $99/yr. A spike on
2026-10-29 fetched one of my shared playlists (`pl.u-LdbqEzvu2jzpe8D`, 52 tracks) with a
plain server-side `curl`, with no key, no cookies and no JavaScript. The HTML holds a
`<script type="application/json" id="serialized-server-data">` block, and its section
whose id starts with `track-list` has all 52 tracks. Every track had a title, artists
(split, in `subtitleLinks`), album, duration in ms, Apple song id and explicit flag.
**None had an ISRC.**

**Decision.** `create-link` reads the tracks from the share page, server-side, instead
of calling `GET /v1/catalog/us/playlists/{id}`. The browser still never calls Apple. No
new dependency: `fetch` and `JSON.parse` are built into Deno. With no ISRCs, R2's
`exact` tier never fires in v1, so every track goes through the strict `close` rule.
D3's "nothing else" still holds: no fuzzy scores, and unmatched stays unmatched.

**Why not the alternative.** Paying $99/yr is a real cost for one semester's demo.
Repointing (PRD §3) throws away the slice that's already designed, and the go/no-go
evidence that would justify it (W02, W03) still isn't in. **What this costs:** the page
isn't a documented API, so Apple can change or block it at any time. Reading it is a
terms-of-service gray area. Losing ISRCs probably lowers the match rate, and the §8
benchmark will show by how much.

**What would change my mind.** Any of these: the page stops carrying the track list, or
starts blocking server requests; a playlist near 100 tracks turns out to hold only the
first batch in the HTML (untested, D6); or the benchmark lands below 80% matched (PRD
§8). Then the choice is pay $99 or repoint, decided by a new ADR. Adding ISRCs from
another source (such as Deezer) would also need its own ADR.
