# Requirements — what has to exist behind the screens

Written 2026-10-05 by clicking through `docs/design/prototype/` as if it worked. Plain
words, no platform names. Feeds the platform comparison and the architecture doc (Oct 11).

**Scope note.** This list is for the **account version** of Crossfade (lines 1–3, 6–7),
which goes against ADR 0006 (nobody logs in in v1). I'm comparing platforms against the
app I picture; ADR 0006 is not yet revised. Accounts here are Crossfade accounts, not
Spotify logins — so Spotify's 5-user dev-mode cap does not apply.

**Provenance.** Lines 1–7 are my original ideas, reworded with Claude's help into
"what has to be true" form. Lines 8–10 are my own wording.

## The list

1. People have to be able to make a Crossfade account (not log in with Spotify), and the
   app has to remember who they are next time.
2. Every playlist someone makes has to be saved somewhere that isn't their phone, so it's
   still there next week and on another device.
3. The app has to keep a list of who's friends with whom, and update it when someone adds
   or removes a friend.
4. It has to be at a web address that opens on any phone or computer, so nobody has to
   install anything.
5. Album cover images have to come from Apple Music or Spotify — I'm not storing them
   myself.
6. The app has to check who's asking before it lets anyone edit or delete a playlist.
   Only the person who made it, or people they invited, can change it.
7. When one friend adds a song, the others have to see it without refreshing the page.
8. When someone pastes an Apple Music link, something has to read the songs in it, and it
   needs a developer key or token from Apple to be allowed to. That key is made from a
   private key, so it has to stay on a server too.
9. Something has to find each song on Spotify and build the playlist, and the secret key
   for that has to be kept on a server, not inside the app, so no user can see it.
10. The link the sender copies has to keep working after the sender closes the app, and
    for days afterward, so something has to remember the finished playlist (its songs,
    the unmatched ones, and which link points to it).

## What the list implies

Lines 8–10 together mean I need somewhere that **runs my own code on a server**, keeps
secret keys, and calls Apple and Spotify. Ask every platform: can I run my own code
there, or does it only store data and handle logins?

## Comparison

<!-- Requirements down the side, 3–4 platforms across the top.
     ✅ covers it · ⚠️ partly / add-on · ❌ leaves it to me — plus a few words from the docs. -->
