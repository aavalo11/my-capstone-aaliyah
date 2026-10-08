# Crossfade

A playlist bridge between Apple Music and Spotify. Send one link; the playlist rebuilds
itself as a real, playable playlist in whatever service your friend already uses.

The thing it replaces is a screenshot of a tracklist that the other person has to retype
song by song. Most of the time, they don't — so the playlist never actually gets shared.

**Status:** 🚧 Early build. A navigable shell runs locally (see *Running this
project*); the Apple → Spotify bridge itself starts in Week 9. Solo capstone for IST300, Syracuse University, Fall 2026.

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
supabase/schema.sql        database setup, run once in the dashboard
src/                       the app: plain HTML/CSS/JS (started 2026-10-08)
tests/                     from Week 9
```

## Running this project

**Stack:** Supabase (hosted database, and later Edge Functions and Auth) plus plain
HTML, CSS and JavaScript. No framework, no build step, no `npm install`. Why:
`docs/decisions/0007-supabase-and-plain-html.md`.

### What has to exist on the machine

| Thing | Why | Check |
|---|---|---|
| Python 3 | Only to serve `src/` at a local address. It comes with macOS. | `python3 --version` |
| A browser | To open the app | — |
| A Supabase project | The database. It's hosted, so nothing gets installed for it. | supabase.com dashboard → `crossfade` |

Nothing is installed system-wide. The Supabase CLI and Docker aren't needed yet; they
arrive in Week 9 with Edge Functions.

### Start it

```sh
cd ~/my-capstone-aaliyah
python3 -m http.server 8000 --bind 127.0.0.1 --directory src
```

Open **http://localhost:8000**. Stop the server with `Ctrl+C`.

**Pass signal:** Home → *Recently sent* lists the rows from the Supabase `links` table.

### Connect Supabase (once per project)

1. Copy the SQL inside the file (`pbcopy < supabase/schema.sql`), paste it into
   Supabase → **SQL Editor**, and run it. Paste the SQL itself, not the file name.
   It creates the `links` table, read-only to the public key, and it's safe to run twice.
2. **Project Settings → API Keys**: copy the Project URL and the **publishable** key
   into `src/config.js`.
3. **Never** put the secret or `service_role` key in `src/`. Everything in there is
   public.

### Seeing every state

Every screen has an empty and an error state. Add `?demo=empty` or `?demo=error` before
the `#`, for example `http://localhost:8000/?demo=error#/home`.

### What's real and what isn't (2026-10-08)

| Screen | State |
|---|---|
| Home → Recently added, Your numbers | Real: reads Supabase |
| Home → New this week, Top songs, Top albums | Real: Apple's free public US chart (no key). *Find on Spotify* opens Spotify's own search |
| Home → Listening history | Locked: needs an Apple Music sign-in (ADR 0006, backlog S12) |
| Create → Paste a link | Link and passcode are checked here; building the playlist arrives in Week 9 |
| Create → Search songs | Disabled: needs a server-side Apple key |
| Friends | Sample data only (backlog S13) |
| Settings → Account | Placeholder until Lab 5 login (backlog S14); the theme setting works |

## A note on the research

The first interview (`docs/research/interview-01.md`) **did not support this product.**
W01 said cross-service sharing would be "nice," then said plainly he *"doesn't mind not
being able to work with other music services."* His actual pain was downloading and cost.

That finding is recorded rather than buried, and the backlog marks the bridge stories as
provisional until two more interviews land. If they come back the same way, the honest
move is to repoint the capstone — see `docs/decisions/0003-best-evidenced-stories-in-could.md`.
