# 0002 · MVP slice is Apple Music → Spotify, one direction only

**Date.** 2026-09-17
**Status.** Decided

**Context.** A bridge could run either direction, or both. The first draft of the backlog
had the slice running Spotify → Apple Music, which is backwards: the concept brief says
I'm on Apple Music and the friends I want to share with are on Spotify.

**Decision.** v1 sends Apple Music → Spotify only. Reverse direction is out of the MVP
slice.

**Why not the alternative.** Bidirectional doubles the matching work and the OAuth work
for no extra demo value, and the wrong direction can't be demoed at all — the slice has
to be a playlist I can actually send from my own library to a real friend's phone. One
direction proves the hard part (catalog matching) just as well.

**What would change my mind.** If W02 and W03 turn out to be mostly Apple Music users,
the demoable direction flips and this gets rewritten. Worth confirming before Week 9.
