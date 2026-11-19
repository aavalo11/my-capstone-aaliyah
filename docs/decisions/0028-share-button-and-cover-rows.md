# 0028 · A Share button replaces the link card, and playlist rows show covers

**Date.** 2026-11-19
**Status.** Decided. Founder request with a reference screenshot (a playlist row in another
music app). Extends ADR 0025. Evidence: NONE.

**Context.** A link's page ended with a `Your friend opens` card holding the raw URL and Copy
link. Playlists → Made by me rows were a name, a date line and two pills, with no picture.

**Decision.** The link page drops that card. Next to **Play in Spotify** is **Share**, which
opens the phone's share sheet (`navigator.share`) with the friend's link, or copies it where
there's no share sheet. Rows in Made by me and Sent to me show the playlist cover, the name,
and `Playlist · <owner>`. Rename and Delete stay on Made by me rows, quieter.

**Why not the alternative.** A Friends list to send to needs accounts for friends and a
database (S13, Evidence: NONE). The share sheet reaches whatever app the sender already
texts in, which is the job. **Cost:** until Phase 10 saves links in the database, a shared
link opens only on the sender's device, so the page says so (TODO(W10)).

**What would change my mind.** W02/W03 senders want to send inside Crossfade, not their
messaging app. Then S13 gets evidence.
