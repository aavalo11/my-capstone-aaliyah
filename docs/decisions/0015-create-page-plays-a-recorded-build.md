# 0015 · Create shows a recorded build behind ?demo=build until create-link is deployed

**Date.** 2026-11-05
**Status.** Decided, until `create-link` is deployed with real Spotify credentials (ADR 0014)

**Context.** `create-link` now runs end to end with a fake Spotify and database
(`scripts/create-link-dry-run.ts`). It isn't deployed: there's no `index.ts`, no database
migration and no Spotify credentials. The browser can't run it itself, because it would
have to call Apple and Spotify, which CLAUDE.md rules out.

**Decision.** `src/sample/build-sample.json` is one dry run's real output: Apple's 52
tracks as read on 2026-11-05, and FAKE Spotify matches. With `?demo=build`, Create plays
it back (`Reading playlist…`, then `Matching K of N…`, then the report) before saving the
link as it does today. The screen says the matches are fake. Marked `TODO(W10): real data`.

**Why not the alternative.** Making the playback the default would put a delay in front
of the link CRUD flow, so `tests/e2e/` and `docs/features/link-crud.md` would need editing,
and ADR 0010 says they shouldn't. Waiting for the deploy means not seeing the progress
and report on screen until then. **Cost:** whatever link you paste, the sample report
shows the same playlist, *70 degrees out*. The notice says so.

**What would change my mind.** `create-link` deployed: Create calls it and polls
`get_build`, the sample file and `?demo=build` go away, and the e2e checks wait for the
real response.
