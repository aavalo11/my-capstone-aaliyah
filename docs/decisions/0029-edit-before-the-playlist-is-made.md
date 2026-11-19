# 0029 · The sender can edit the songs before the Spotify playlist is made

**Date.** 2026-11-19
**Status.** Decided. Changes PRD R1 and R4 and architecture §2–4. Founder request.
Evidence: NONE (S19 holding pen; it works against the five-second send).

**Context.** `create-link` read Apple, matched, made the playlist and saved the link in one
call. The founder wants to remove songs, or search Spotify and add songs, before anything
reaches Spotify. Phase 10 hasn't deployed `create-link` yet, so the split costs no rework.

**Decision.** Three calls, all signed in (the Google session replaces `SENDER_PASSCODE`):
1. `match-playlist {link, build_id}` does R1 steps 2–7, saves the result as a draft on the
   `builds` row (`status = matched`), and returns the report. Nothing on Spotify.
2. `search-songs {q}` returns up to 10 Spotify tracks (US) for the edit screen to add.
3. `publish-link {build_id, title, remove: [positions], add: [track ids]}` reads the draft
   (only the sender's own, under an hour old), checks each added id with Spotify, makes
   the playlist (R4 order: kept matches, then added songs), and saves the link with its
   `owner_id`. Removed songs aren't saved; added ones show as `Added by <sender>`.

The report keeps **Create playlist** at the top, so not editing stays one tap. The Spotify
playlist is named after the sender's title (R4 used the Apple name). An added song's cover
is Spotify's album art from `i.scdn.co`, the one other image host the browser loads (ADR 0025).

**Why not the alternative.** Editing after the playlist exists (one call, then edit calls)
puts every change through Spotify twice and leaves a playlist on the account for a link
the sender never sends. **Cost:** three functions to deploy instead of one, and a draft
row per build.

**What would change my mind.** W02/W03 senders never edit. Then the edit screen goes, and
`publish-link` runs straight after `match-playlist`.
