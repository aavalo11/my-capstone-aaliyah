# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Crossfade** (IST300 solo capstone): paste a shared Apple Music playlist link, get one link a friend opens as a playable Spotify playlist. The name is a metaphor. The app can't control crossfade.
- **Sender:** on Apple Music, on her phone, mid-chat. It has to take about 5 s or she sends a screenshot. **Recipient:** on Spotify, never logs in, nothing is written to their library.
- These are assumptions. **W01 declined the cross-service premise, and W02/W03 haven't run.** Say so when evidence contradicts the idea.

## Run and check
- `python3 -m http.server 8000 --bind 127.0.0.1 --directory src` → http://localhost:8000. No build, no npm.
- Empty and error states: add `?demo=empty` or `?demo=error` before the `#`. Recipient page: `p.html?code=sample` (also `code=nope`).
- Checks: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --virtual-time-budget=3000 --dump-dom "<url>"`.
- Tests: `node --test tests/unit/*.test.js` (no install) and `node tests/e2e/run.js` (Playwright, set up per `tests/README.md`). Playwright stays inside `tests/` (ADR 0011).

## Rules
- `docs/backlog.md` is the source of truth. If a request contradicts it, say so.
- Evidence comes only from `docs/research/`. A story with no quote goes in the holding pen as `Evidence: NONE`.
- Don't over-read field notes. If one is ambiguous, ask (ADR 0004: an over-read note cost S3 its evidence).
- Every story has a failure-path AC. Every feature has an empty state and an error state.
- Fake data is labelled on screen and marked `TODO(W10): real data`.
- The browser never calls Apple or Spotify. Only the publishable key goes in `src/`. Use `esc()` on every interpolated string.
- A decision that could have gone another way gets a five-line ADR in `docs/decisions/` first. No new dependency without saying why.

## Never propose
- Moving audio between services (DRM), controlling crossfade/transitions, or cross-service synced playback. No API allows any of them.
- Recipient login or account connection (ADR 0006).
- Substituting a different recording. Unmatched shows `Not found on Spotify (US)` (PRD R2).

## Commits
- History is graded (asked / changed / rejected). Add new commits, never rewrite pushed ones. Read the change and message back to me before committing.
