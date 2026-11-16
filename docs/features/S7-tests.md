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

## 5 · Cleanup with the tests running (ADR 0023)

**What bothered me.** `esc()` was written four times (`app.js`, `p.js`, `u.js`,
`report-view.js`) and `stateBlock()` three times (`app.js`, `p.js`, `u.js`). `esc()` is the
function that keeps every interpolated string safe, and a fix to one copy would miss the others.

"Tests after" is the same every time: unit `90/90`; browser `9/9`, `13/13`, `13/13`, `9/9`,
`8/8`, then `s7.js` `3/4` (only AC2, the known failure).

| Step | What changed | Tests after |
|---|---|---|
| 1 | New `src/ui.js` with one `esc()` and `stateBlock()`; loaded first on `index.html`, `p.html`, `u.html`. Nothing uses it yet | Same as baseline |
| 2 | `report-view.js`: its `esc()` copy → `window.CrossfadeUI.esc` | Same |
| 3 | `p.js`: both copies (and the "Copied from app.js" comment) → one alias line | Same |
| 4 | `u.js`: both copies → one alias line | Same |
| 5 | `app.js`: both copies → one alias line. No call site changed in any file | Same |

37 lines removed, 7 added, plus `ui.js`.

## 6 · What got through

**Using it myself** (local server, signed in with the test session): I made a link titled
`Mix <b>loud</b> & "quiet"`. Create showed `Matched 48 of 52` and the 4 misses by name. The
title showed as plain text, not bold, on Create and on the friend's page. That page had 52 rows,
and the 4 misses were greyed with `Not found on Spotify (US)`. `p.html?code=nope`,
`?demo=error` and an unknown `/u/` username showed their states through the shared
`stateBlock()`. Nothing broke.

**What the tests would and wouldn't have caught.** I broke the result on purpose (each one undone):

| Break | Tests after |
|---|---|
| `ui.js` tag missing from `index.html` | `6 of 6 check files failed` |
| `ui.js` tag missing from `p.html` | link-crud C3–C5 fail |
| `ui.js` tag missing from `u.html` | `profile.js` fails |
| **`esc()` stops escaping** (returns the string as is) | **Every test passes** (unit 90/90, browser same as baseline) |

**The answer.** The tests protected *that the helpers are wired up*: a page that forgets
`ui.js` fails loudly. They didn't protect *what `esc()` does*. No test puts a `<` or a `"` in a
title or song name. This refactor put every page's escaping in one function, so one bad edit
there is now an HTML injection on every page, and the suite stays green. The manual
`Mix <b>loud</b>` check is the only evidence it still works.

**Can't be caught here.** The Netlify paths `/p/<code>` and `/u/<name>` load `ui.js` through
`<base href="/">`. Locally the tests use `p.html?code=`, so a wrong path would only show on
the deployed site.

**One more test.** Make a link whose title and a song name hold `<b>x</b> & "q"`, then check
that Create, Made by me, Home and the friend's page show it as text and create no `<b>`
element. It would have failed the `esc()` break above.
