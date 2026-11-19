# 0030 · A renamed link gets a drawn cover with its own title

**Date.** 2026-11-19
**Status.** Decided. Founder request. Extends ADR 0025. Evidence: NONE.

**Context.** Apple draws a personal playlist's cover with the playlist's name on it. A link
the sender named `poot`, made from the Apple playlist `70 degrees out`, showed a cover
reading `70 degrees out`. Apple signs those image URLs, so the text in them can't be changed.

**Decision.** When the link's title differs from the Apple name (ignoring case and spaces at
the ends), Crossfade draws the cover in the page: a square gradient with the title in large
type at the top left, as Apple's are. It reuses the colours Apple's URL lists (`c1`–`c4`,
`tc`), so it looks like a sibling of the original. Same name: Apple's cover, unchanged.
`get_link` now also returns `apple_name`, so the friend's page can tell.

**Why not the alternative.** Uploading a cover to the Spotify playlist needs the
`ugc-image-upload` scope and a JPEG made on the server. Possible later. **Cost:** the
Spotify playlist itself still shows Spotify's own mosaic of song covers.

**What would change my mind.** Friends say the drawn cover looks fake next to Apple's.
