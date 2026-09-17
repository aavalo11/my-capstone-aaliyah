# CLAUDE.md

## What this is

**Crossfade** — a playlist bridge between Apple Music and Spotify. You send one link and
the playlist rebuilds itself as a playable playlist in whatever service your friend
already uses, instead of a screenshot they have to retype. Solo capstone for IST300.

## Who uses it

- **The sender** — on Apple Music, on her phone, mid-conversation. Wants it to take five
  seconds. If it takes longer she sends a screenshot instead, which is the status quo
  this replaces.
- **The recipient** — on Spotify, often a free or family-plan account, doesn't want a
  stranger's playlist written into their library without asking.

## Current state (2026-09-17)

Docs only. **No code yet — `src/` and `tests/` start Week 9.** Don't create them early.

| Doc | State |
|---|---|
| `docs/01-concept-brief.md` | Done (CP-M1) |
| `docs/backlog.md` | Done (Lab 3) — 11 stories, MoSCoW, MVP slice |
| `docs/research/interview-01.md` | Done — W01, 2026-09-10 |
| `docs/research/interview-02.md` | **Empty — W02 not yet run** |
| `docs/02-prd.md` | Due 2026-09-27 |
| `docs/03-architecture.md` | Due 2026-10-11 |

## Conventions

- **`docs/backlog.md` is the source of truth for requirements.** If a request
  contradicts it, say so rather than guessing. Keep it current, not historical.
- **Never cite evidence that isn't in `docs/research/`.** Every story carries an evidence
  pointer. If I ask for a story you can't trace to a quote in a research file, write it
  in the holding pen and mark it `Evidence: NONE`, don't invent support for it.
- **Don't over-read field notes.** A fragment is a fragment. If a note is ambiguous, say
  it's ambiguous and ask — this already cost one story (see `decisions/0004`).
- **Every story needs a negative case.** Acceptance criteria are Given-When-Then, and at
  least one must be a failure path.
- **Every feature needs an empty state and an error state.**
- **Decisions that could have gone another way get an ADR** in `docs/decisions/`, five
  lines, before the work starts.
- **Don't add dependencies without telling me why.**

## Hard constraints — don't propose features that need these

- **Audio cannot move between services.** Downloaded Spotify/Apple tracks are
  DRM-encrypted and licensed to the account, not the listener. No upload, no transfer, no
  local-file sync. This comes up repeatedly; the answer is always no.
- **Crossfade and transition timing are not controllable.** They're client playback
  settings in the listener's own app. Neither the Spotify Web API nor MusicKit exposes
  them to a third party.
- **No true cross-service synchronized playback.** No public API exposes playback
  position on another service, so a live cross-service "jam" is not buildable.
- **Each listener plays on their own subscription.** The bridge moves track identities,
  never audio.
- **Catalog matching will never be perfect.** Remixes, live versions, explicit vs. clean,
  and regional availability all break it. Surfacing a failure honestly always beats
  silently substituting a different recording.

## Working style

- Commit history is graded — it should show what was asked for, what changed, and **what
  was rejected**. Prefer a new commit on top over rewriting pushed history. Amend only
  before pushing.
- Read what you propose back to me before committing.
- If evidence contradicts the product idea, say so plainly. W01 already declined the
  cross-service premise; that belongs in the docs, not buried.
