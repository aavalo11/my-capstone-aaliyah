# 0024 · Among passing candidates, the closest length wins

**Date.** 2026-11-19
**Status.** Decided. Changes PRD R2 step 2. No check is loosened.

**Context.** The first real `--real-spotify` run (70 degrees out, 2026-11-19) matched Apple's
solo *expectations* (Olivia Rodrigo, 221,958 ms) to *expectations (feat. Chappell Roan)*
(223,935 ms), a different recording. Both pass R2, because normalization drops feature
segments, and R2 took whichever came first. Spotify's result order changed between two runs
of the same search, so the pick wasn't even stable. A 0 ms solo copy was in the results.

**Decision.** Of the first 10 results, keep every candidate that passes all four checks, then
take the one whose duration is closest to the source. A tie goes to the earlier result.

**Why not the alternative.** Preferring a title that matches *before* dropping feature segments
would fix this case but not a remaster or a re-release that's 2 s off. **Cost:** none in calls,
since all 10 results are already fetched.

**What would change my mind.** The §8 benchmark finds a closest-length pick that's the wrong
recording where the first-passing pick was right.
