# 0016 · A matched song shows Spotify's version only when its title is written differently

**Date.** 2026-11-05
**Status.** Decided. Changes PRD R3.

**Context.** R3 put a `Close match` label and Spotify's title and artists under every
`close` track, so a reader could spot a wrong version. In v1 every match is `close`,
because the share page has no ISRCs (ADR 0012). On a real 52-track playlist that's 48
labels saying the same thing. The founder doesn't want the screen to explain how matching
works.

**Decision.** A matched track shows like any other song. Spotify's title and artists
appear beneath it, with no label, only when Spotify's title isn't character-for-character
the Apple title (`Feel So Close (Radio Edit)` vs `Feel So Close - Radio Edit`). Unmatched
tracks keep `Not found on Spotify (US)`. The `How matching works` tile and Settings
section come out.

**Why not the alternative.** Keeping R3 as written shows the same line 48 times, and that
hides the one that matters. Never showing Spotify's version would mean a wrong version
can't be spotted before playing, which is what R3 exists to prevent. **Cost:** an
artist-only difference is no longer shown. R2 already requires the primary artist to be
one of Spotify's, so the only thing hidden is a different list of featured artists.

**What would change my mind.** The §8 benchmark finds a wrong match whose Spotify title is
character-for-character the Apple one. Then a match that looks identical can still be
wrong, and the label comes back.
