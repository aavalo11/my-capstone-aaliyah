# 0018 · A Playlists tab splits links I made from links friends sent me

**Date.** 2026-11-12
**Status.** Decided. Moves *Your links* off Home. Adds S17 to the holding pen.

**Context.** The founder didn't like *Your links* on Home with three buttons on every row.
The founder wants a Playlists tab in the side menu with two parts, playlists I made and playlists
friends sent me. Crossfade has no accounts yet, so nothing on the server knows which links
were sent to whom.

**Decision.** Add Playlists → *Made by me* and *Sent to me*. *Made by me* is the link list
from Home, now without the *Friend's view* button, since the link's own page already
shows its friend link. *Sent to me* is the links this browser has opened at `p.html`,
remembered the same way as the sender's links (ADR 0010). Links I made myself aren't
added. The recipient still never logs in (ADR 0006).

**Why not the alternative.** Waiting for sign-in would let a server keep the received
list on every device, but sign-in isn't built yet, so the tab would stay empty until
then. **Cost:** a link opened on your phone doesn't show on your laptop.

**What would change my mind.** When sender sign-in lands, both lists move to the database
under the signed-in account, and this browser-only list goes away.
