# 0017 · Home reads Apple's public chart feed from the browser, for now

**Date.** 2026-11-12
**Status.** Decided. An exception to "the browser never calls Apple" (architecture §2, CLAUDE.md).

**Context.** Home's New this week, Top songs and Top albums fetch
`itunes.apple.com/us/rss/…` straight from `src/app.js`. That breaks the rule. The rule
exists so that secrets never reach a phone. This feed takes no key and sends nothing
about the user.

**Decision.** Keep the browser call as the one Apple exception. Every other Apple and
Spotify call stays on the server. The feed's error state already covers Apple retiring it.

**Why not the alternative.** Moving it to an Edge Function keeps the rule whole, but
nothing is deployed until Phase 10, so for now Home would have no charts. **Cost:** the rule
has an exception that anyone reading `src/` has to know about.

**What would change my mind.** The feed starts needing a key, or Phase 10 deploys an Edge
Function this call could ride along with. Then it moves to the server.
