# 0025 · Playlist pages get a cover, the Apple owner's name, and song covers

**Date.** 2026-11-19
**Status.** Decided. Founder request with a reference screenshot (another transfer app's
playlist in Apple Music). Extends ADR 0017's image exception. Evidence: NONE.

**Context.** The sender's link page and the friend's page opened on a bare title and a
`Sample playlist` notice. Apple's share page already carries the playlist's artwork, each
song's artwork and length, and the owner's display name (`subtitleLinks[0].title`).

**Decision.** create-link keeps those fields. Both pages open with a large cover, the title,
`Playlist transferred with Crossfade`, `Made by <name> on Apple Music`, and **Play in
Spotify**. Each row shows the song's cover and length. Covers load from Apple's image CDN
(`mzstatic.com`), as Home's chart covers already do: an image request, no key, no API.
There's no Shuffle button: no API lets Crossfade control playback (CLAUDE.md).

**Why not the alternative.** Spotify's album art would mean extra calls per track. **Cost:**
the owner's real Apple display name is shown to anyone the link reaches (the founder chose
this over hiding it), and the browser now loads images from Apple on more pages.

**What would change my mind.** A W02/W03 sender objects to their name showing. Then it
becomes a toggle on Create, off by default.
