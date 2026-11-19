# 0026 · An unmatched song can show Spotify's nearest version as a link

**Date.** 2026-11-19
**Status.** Decided. Founder request after the first real run. Adds to PRD R3; R2 unchanged.
Evidence: NONE.

**Context.** On 2026-11-19, three songs on 70 degrees out were unmatched, but Spotify had
a near version: a `- Radio Edit` label, a copy 4.8 s longer, an explicit-only copy. The friend
saw only `Not found on Spotify (US)`, with no way to find it.

**Decision.** The row still says `Not found on Spotify (US)` and the song stays out of the
playlist. Under it, `Spotify has a different version:` names that version, and tapping it
opens it in Spotify. A near version has the same primary artist, and its normalized title
equals the source's or starts with it followed by a space. Of those in the first 10
results, the closest length wins. Crossfade adds nothing anywhere (ADR 0006).

**Why not the alternative.** Putting it in the playlist would be the substitution R2 and S7
rule out, and an explicit copy could reach someone the sender picked a clean one for.
**Cost:** a remix or live take can be offered. Its real title is shown, so the friend can tell.

**What would change my mind.** The §8 benchmark shows near versions are mostly the same
recording. Then R2's checks loosen instead.
