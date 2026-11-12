# 0021 · Every account starts empty: Home and Playlists show only your own links

**Date.** 2026-11-12
**Status.** Decided. Changes ADR 0010 (links in this browser) and ADR 0018 (Sent to me).

**Context.** Anyone opening the live site saw Home → *Recently added* and *Your numbers*
filled in. Both read the one shared `links` table, which holds two sample rows, so every
visitor saw the same playlists as if they were their own. In the browser, links were saved
under one key, so a second Google account on the same device saw the first account's
links. The founder wants each person to start clean, with nothing tied to anyone else.

**Decision.** *Recently added* and *Your numbers* stay on Home, but read only the
signed-in account's own links. A new account, or someone signed out, sees their empty
states (`Nothing added yet`). They no longer read the shared `links` table. Links and
*Sent to me* are saved under a key that includes the account's id, so each account has its
own lists. Signed out, *Made by me* asks you to sign in.

**Why not the alternative.** Filtering the shared table needs an owner column on `links`
and links in the database, which is Phase 10. Until then it can only show strangers the
same rows. **Cost:** links made before today stay under the old key, so they no longer show
in *Made by me*. They were all sample builds (ADR 0015).

**What would change my mind.** Phase 10 puts links in the database with an owner. Then
both sections read the sender's own rows with their sign-in token, on any device.
