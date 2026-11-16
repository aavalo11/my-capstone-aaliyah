# 0022 · Friends starts empty, and tapping a song opens it in Spotify

**Date.** 2026-11-12
**Status.** Decided. Removes S13's sample data. Follows ADR 0021.

**Context.** Friends showed four made-up people with playlists and taste matches (S13,
sample data). Since ADR 0021, everything else in the app starts empty for a new account, so
fake friends were the one thing a stranger saw that wasn't theirs. Every song row also had
a `Spotify ↗` button on the side, which the founder found redundant with the row itself.

**Decision.** The sample friends, their playlists and the taste match come out. The Friends
tab stays and shows its empty state, `No friends yet`, with its error state behind
`?demo=error`. Song rows on Home and in a playlist are a single link: tapping anywhere on a
matched song opens it in Spotify. An unmatched song isn't a link and still reads `Not
found on Spotify (US)` (PRD R2). New this week's cards and Top albums do the same: albums
open Spotify's search, not Apple Music. New this week now looks through the chart's top
100, not its top 25, so it finds more than one or two new songs.

**Why not the alternative.** Hiding the Friends tab would also work, but the founder
prefers sections that stay with an empty state (ADR 0021). Keeping the button as well as
the row link gives two targets for one action. **Cost:** a row no longer says *Spotify*
on it, so the first tap is a guess. The search and track links still open in Spotify.

**What would change my mind.** People in a usability test don't realise a row opens Spotify.
Then a small Spotify mark goes back on each row, inside the same link.
