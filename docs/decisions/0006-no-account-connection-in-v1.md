# 0006 · Nobody connects an account in v1

**Date.** 2026-09-27
**Status.** Decided, pending spike K3 in `02-prd.md` §9

**Context.** The Lab 3 slice had the sender connect Apple Music and the recipient connect
Spotify. Since March 2026, a dev-mode Spotify app can allowlist only 5 users, and extended
quota requires 250k MAU. So recipient OAuth caps Crossfade at five hand-registered
friends. Recipient OAuth is also the only way S8's worry (junk written into your library)
could happen at all.

**Decision.** The sender pastes a shared Apple Music playlist link, which a developer
token can read. Crossfade builds the Spotify playlist on its own account (Premium, as dev
mode now requires) and hands the recipient an `open.spotify.com` link. No one logs in.

**Why not the alternative.** Recipient OAuth adds two login flows, a 5-user ceiling, and
write access to a friend's library, all to put the playlist in a place they can reach
anyway by tapping Follow in Spotify. This also makes S6 (family-plan privacy) and S8
(nothing written without asking) true by construction, instead of true only if tested.

**What would change my mind.** If Spotify's Developer Policy turns out to forbid an
app-owned account making playlists for others (K3), fall back to recipient OAuth, capped
at 5 friends, with S8's preview-first flow back in MUST.
