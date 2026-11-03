# 0013 · Deezer for the first outside call, not a borrowed Spotify app

**Date.** 2026-11-03
**Status.** Decided for D09 only. Whether `create-link` uses Deezer is still open (ADR 0012).

**Context.** D09 needs one real call to an outside service. Spotify search is the one
Crossfade needs, but since Feb 2026 a dev-mode app works only while its **owner** has
Premium, and I don't. Deezer's public API answers track searches with no key and no
account, and each result carries an ISRC, which the Apple share page doesn't (ADR 0012).

**Decision.** `scripts/deezer-search.ts` makes one search from the terminal with Node 24
(`fetch` is built in, nothing installed) and prints what was sent and what came back.
It's a script, not part of `create-link`. The browser still never calls it.

**Why not the alternative.** A friend's Spotify app would have tested the real thing, but
the secret and the quota aren't mine, and the finished app can't depend on someone
else's Premium. Paying for Premium now comes before the go/no-go evidence (W02, W03).
**What this costs:** Deezer isn't the service Crossfade matches against, and with no key
there's no real wrong-key test. Its search also isn't strict: it can hand back a
different recording, which R2 forbids using.

**What would change my mind.** Building `create-link`. Then it's my own Premium or
repointing (ADR 0006), and adding Deezer's ISRCs to the close-match rule gets its own ADR.
