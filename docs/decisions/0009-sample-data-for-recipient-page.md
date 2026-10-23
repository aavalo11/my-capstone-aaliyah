# 0009 · The recipient page reads a sample file until Week 9

**Date.** 2026-10-23
**Status.** Decided

**Context.** Lab 5 builds the match report (S7 AC 3 + 4, PRD R3) on the recipient page.
Real report data needs `link_tracks` and `rpc get_link(code)`, and those only exist once
the Week 9 bridge writes them (architecture §3–4).

**Decision.** `src/p.js` reads `src/sample/link-sample.json`, which is shaped like
`get_link`'s response. It's marked `TODO(W10): real data`, and the page shows a
"Sample playlist" notice. **Play in Spotify** stays disabled until a real playlist id exists.

**Why not the alternative.** Adding `link_tracks` to the shell schema now would mean
designing tables before K1 shows what Apple actually returns, and then hand-writing
matches into a real database anyway. A fake link to an invented Spotify playlist would
make AC 2 look done when it isn't.
**Cost:** the page has never read a real row, so field-name mismatches with the real
`get_link` won't show up until Week 9.

**What would change my mind.** If the Week 9 schema differs from the sample's shape
(`position`, `source_title`, `tier`, `spotify_title`, …), change the sample to match first.
Then swap the read, and the checks in `docs/features/S7-match-report.md` should still pass
without being edited.
