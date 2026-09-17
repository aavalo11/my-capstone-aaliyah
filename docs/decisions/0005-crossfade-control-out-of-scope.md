# 0005 · Crossfade and transition control are out of scope

**Date.** 2026-09-17
**Status.** Decided, pending one clarifying question

**Context.** W01 wants to "DJ songs and have them transition better." Read naively, that
asks for control over how tracks blend into each other in the recipient's app. It's also
the closest thing in the research to the product's own working name.

**Decision.** Controlling crossfade or transition timing goes in WON'T. S11 keeps only
the half that is buildable: preserve track order exactly, keep segued tracks adjacent,
and warn when a missing track breaks a segue.

**Why not the alternative.** Crossfade is a client playback setting the listener toggles
inside their own Spotify or Apple Music app. Neither the Spotify Web API nor MusicKit
exposes it to a third party, so there is nothing to build — this is an API wall, not a
scope cut. Shipping a "better transitions" promise the platform won't let me keep is
worse than not offering it.

**What would change my mind.** Two things. If W01 means he mixes *live*, this becomes an
export problem (get the tracks into DJ software in order) rather than a playback problem,
and S11 changes shape. And if either platform ever exposes playback settings to third
parties, the WON'T should be revisited. The clarifying question is logged in
`docs/research/interview-01.md` §7.
