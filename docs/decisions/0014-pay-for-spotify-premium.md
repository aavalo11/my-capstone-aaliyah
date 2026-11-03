# 0014 · Pay for Spotify Premium on Crossfade's own account

**Date.** 2026-11-03
**Status.** Decided. Reverses ADR 0013's "paying for Premium now comes before the go/no-go evidence."

**Context.** Since Feb 2026 a dev-mode Spotify app works only while its owner has Premium
(ADR 0013, PRD K3). Without it there's no real Spotify search, no real wrong-key test for
D09, and no way to build `create-link`. Apple costs nothing now (ADR 0012), so Premium is
the only money Crossfade needs. W02 and W03 still haven't run.

**Decision.** Pay for Premium, monthly, on a separate Crossfade Spotify account, as ADR 0006
already says. That account owns the developer app and the playlists. Its client ID and
secret go in `.env` and later `supabase secrets set`, never in `src/`.

**Why not the alternative.** My personal account would be cheaper if I already paid, but
every recipient playlist would land in my own library, and the app's secret would sit on
the account I listen with. Waiting for W02/W03 first leaves `create-link` unbuilt for
another week, with the milestone due. **What this costs:** a monthly Premium bill
until I cancel, and the money is spent before I know anyone wants this.

**What would change my mind.** W02 and W03 both decline the cross-service premise, as W01
did: cancel and repoint (PRD §3). Or K3's policy reread rules out one account making
playlists for others: cancel, and fall back to ADR 0006's recipient OAuth.
