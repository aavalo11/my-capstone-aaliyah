# Crossfade

A playlist bridge between Apple Music and Spotify. Send one link; the playlist rebuilds
itself as a real, playable playlist in whatever service your friend already uses.

The thing it replaces is a screenshot of a tracklist that the other person has to retype
song by song. Most of the time, they don't — so the playlist never actually gets shared.

**Status:** 🚧 Pre-build. Requirements and research only — no application code until
Week 9. Solo capstone for IST300, Syracuse University, Fall 2026.

**Live URL:** not deployed yet.

---

## Who it's for

| | |
|---|---|
| **Sender** | On Apple Music, on her phone, mid-conversation. Needs it to take five seconds. |
| **Recipient** | On Spotify, often a free or family-plan account. Wants to hear the playlist without it being written into their library uninvited. |

## The job it does

> When a friend and I are on different music services and I want to share a playlist
> with them, I want to send one link that rebuilds the playlist in whatever app they
> already use, so we can trade music without either of us switching services or adding
> songs one at a time.

## MVP slice

Apple Music → Spotify, one direction, one playlist: preview it, see an honest match
report, press play. Deliberately smaller than the MUST column.

The demo test: a friend opens a texted link, sees `Matched 23 of 25` with the two
failures named, taps play, and **audio comes out of the phone** — then closes the app and
finds nothing was added to their library. No step where you have to say "and then imagine
it saves."

## What it will never do

- **Move audio files between services.** Downloads are DRM-encrypted and licensed to the
  account, not the listener. The bridge moves track identities; each person plays on
  their own subscription.
- **Guarantee perfect matching.** Remixes, live versions, explicit vs. clean, and
  regional availability all break it. An honest `matched 47 of 50` beats a silent
  substitution.
- **Synchronize playback across services.** No public API exposes playback position on
  another service.

## Repo layout

```
docs/01-concept-brief.md   CP-M1 · what it is and why          (done)
docs/02-prd.md             CP-M2 · requirements                (due Sep 27)
docs/03-architecture.md    CP-M3 · how it's built              (due Oct 11)
docs/backlog.md            Lab 3 · 11 stories, MoSCoW, MVP     (done)
docs/research/             interview notes, verbatim + reading
docs/design/               wireframes and UI notes
docs/decisions/            one file per call that could have gone otherwise
src/  tests/               application code — from Week 9
```

## How to run it

Nothing to run yet. This section gets filled in at Week 9 with install, env vars, and
dev-server steps.

Planned stack (will change): Spotify Web API + Apple MusicKit, OAuth so each person
connects their own account, React front end, Node or Python backend. See
`docs/01-concept-brief.md`.

## A note on the research

The first interview (`docs/research/interview-01.md`) **did not support this product.**
W01 said cross-service sharing would be "nice," then said plainly he *"doesn't mind not
being able to work with other music services."* His actual pain was downloading and cost.

That finding is recorded rather than buried, and the backlog marks the bridge stories as
provisional until two more interviews land. If they come back the same way, the honest
move is to repoint the capstone — see `docs/decisions/0003-best-evidenced-stories-in-could.md`.
