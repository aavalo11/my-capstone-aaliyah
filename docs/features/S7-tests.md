# S7 · Tests from the acceptance criteria (Discovery, 2026-11-16)

Draft log. `tests/e2e/s7.js`, one check per AC, written from `docs/backlog.md`, not from the code.
No app code changed. The build is the recorded one (ADR 0015). The checks swap its file for
TEST FIXTURES of the sizes the ACs name: 25 songs, and 50 songs with exactly 3 misses.

## 1 · The acceptance criteria (copied from `docs/backlog.md`)

- **AC1.** Given a shared US Apple Music playlist link with 25 tracks, and I'm signed in
  (ADR 0019), when I tap **Create link**, then I get a Crossfade link within 15 seconds, with
  progress visible while it builds. (PRD R1)
- **AC2.** Given that link, when my friend opens it and taps **Play in Spotify**, then playback
  starts within 3 taps of opening the text, and they're never asked to log in. (PRD R5)
- **AC3.** Given a 50-track playlist, when matching completes, then I see `Matched 47 of 50` and
  can read the 3 failures by name before I send. (PRD R3)
- **AC4 (negative).** Given a track has no equivalent in Spotify, when the recipient views the
  playlist, then it appears greyed with `Not found on Spotify (US)`. It's never silently dropped,
  and never substituted with a different recording as defined by PRD R2's matching rules.

## 2 · First run

```
PASS AC1 :: link=yes in 1858 ms, progress lines=9 (first="Reading playlist…", last="Matching 25 of 25…")
FAIL AC2 :: Play in Spotify=[], asked to log in=false, friend sees "This Crossfade link doesn't exist.Check that the whole link "
PASS AC3 :: headline="Matched 47 of 50", misses named 3/3 ["Breathe","Chest Pain (I Love)","Good Days"], report above the link=true
PASS AC4 :: rows=50/50, source order kept=true, misses=["Breathe","Chest Pain (I Love)","Good Days"] greyed, no link, exact text=true, matched rows not greyed=true

3/4 passed
```

**AC2 fails, and the failure is real.** A link from Create is saved only in the sender's
browser (ADR 0010), so on the friend's phone it says `This Crossfade link doesn't exist.` There's
no **Play in Spotify** either, because a recorded build has no Spotify playlist id. The test
doesn't use a made-up playlist id, because `S7-match-report.md` already rejected that as a fake pass.

## 3 · Each test

| Test | AC it checks | What it looks at | Still passes if broken? |
|---|---|---|---|
| AC1 | AC1: link in ≤ 15 s, progress shown | Records every line the progress box shows, times click → link | No. B1 failed it |
| AC2 | AC2: ≤ 3 taps, no login | A fresh browser with no session opens the link and looks for one **Play in Spotify** to `open.spotify.com/playlist/<22 chars>`, and for any sign-in request or text | Already failing. Can't see tap 3 (inside Spotify) |
| AC3 | AC3: `Matched 47 of 50`, 3 names, before send | Headline, the 3 names in the **visible** report text, report above the new link | **Yes, at first.** See B2 |
| AC4 | AC4: greyed, exact text, never dropped or swapped | 50 rows in source order, 3 misses with opacity < 1, exact text, no link, no `On Spotify:` | No. B3, B4, B5 each failed it |

## 4 · Breaking it on purpose (each undone with `git restore src`)

| Break | Change | AC1 | AC3 | AC4 |
|---|---|---|---|---|
| B1 | Comment out the `Matching k of N…` progress line (`app.js`) | **FAIL** | pass | pass |
| B2 | Delete the `Not on Spotify: …` names line (`app.js`) | pass | **pass ← should fail** | pass |
| B3 | Drop unmatched songs from the song list (`report-view.js`) | pass | pass | **FAIL** (47/50 rows) |
| B4 | Remove the grey: `.row.unmatched { }` (`styles.css`) | pass | pass | **FAIL** |
| B5 | `Not found on Spotify (US)` → `Not found on Spotify` (`report-view.js`) | pass | pass | **FAIL** |

**The keeper: B2.** With the names line deleted, AC3 still passed, because it read
`textContent`, which includes the closed **All 50 songs** list. The names were in the page but
not on screen. A sender wouldn't see them before sending. Fixed by reading `innerText` (only
what's rendered). Rerun of B2 after the fix: `FAIL AC3 :: … misses named 0/3 []`.

Also from B3: dropping the misses from the sender's **All 50 songs** list didn't fail AC3, because AC3
only looks at the headline and the names line. AC4 caught it, on the recipient's page.

## What these tests can't see
- **AC2's third tap** happens inside Spotify. No browser check can see playback start.
- **AC1's 15 s** is timed against the recorded build, so it always takes about 1.9 s. The real
  create-link (Apple page + Spotify search) isn't in this test (`TODO(W10)`).
- **"Never substituted" (PRD R2)** is decided by `match.ts`, which `tests/unit/match.test.js`
  covers. AC4 only checks that the recipient's page never shows a Spotify song for a miss.
