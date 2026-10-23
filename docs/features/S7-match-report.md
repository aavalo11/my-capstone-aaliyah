# S7 (AC 3 + 4) · Honest match report, recipient view

Built 2026-10-23, Lab 5. PRD R3. **Evidence: NONE.** S7 is a founder assumption
(backlog line 217) and W02 still hasn't been run, so this page works but the premise
behind it is untested.

## Story
As someone on Apple Music who made a playlist, I want to send one link that opens as a
playable playlist in my friend's Spotify, so that they hear it instead of retyping it
from a screenshot.

This card covers only the report half, from the recipient's side:

- **AC 3:** I see `Matched 47 of 50` and can read the failures by name.
- **AC 4 (negative):** an unmatched track appears greyed with `Not found on Spotify (US)`.
  It's never silently dropped and never substituted.

## Acceptance criteria → checks
| AC | Check | Result |
|---|---|---|
| AC 3: header and failures by name | Load the 6-track sample (2 unmatched), open `p.html?code=sample`, print the header and the names on unmatched rows | ✅ `Matched 4 of 6`; *Nobody · Mitski*, *Bags · Clairo* |
| AC 4: never dropped, never substituted | List every row in display order with its status | ✅ 6 rows, source order 0–5, both unmatched rows greyed with exactly `Not found on Spotify (US)` and no Spotify title |
| Empty state | Open `p.html?code=nope` and print what's on screen | ✅ `This Crossfade link doesn't exist.`, 0 rows, no header |
| Error state | Open `p.html?code=sample&demo=error` and print what's on screen | ✅ `Couldn't open this playlist` naming Crossfade, a Try again button, 0 rows |
| R3 close match *(added)* | Print the close-match row | ✅ `Close match · On Spotify: Get You · Daniel Caesar, Kali Uchis` |
| Defensive: playlist with no tracks | Open `p.html?code=sample&demo=empty` | ✅ `This playlist has no songs`, not a blank list |

## Plan (as approved)
- New `src/p.html` + `src/p.js`: the recipient page, with no sender nav. It follows
  architecture §3 (`/p/<code>` → `p.html` via the Netlify rewrite, ADR 0008). Locally it
  opens as `p.html?code=sample`.
- New `src/sample/link-sample.json`, shaped like `get_link(code)`, labelled as sample data
  both on screen and in the file.
- `styles.css`: one rule, `.row.unmatched` (greyed).
- `p.js` copies `esc()` and `stateBlock()` from `app.js`, because loading `app.js` would
  start the sender's router.
- **Play in Spotify** is shown disabled. Linking to a made-up playlist id would be a fake pass.
- Changed in planning: the empty-state check became "unknown code", because R1 never
  issues a link for an empty playlist. `tracks: []` stayed as a defensive check.

## Evidence
Headless Chrome (`--dump-dom`, already on the Mac, nothing installed) against
`python3 -m http.server 8000 --directory src`, with a Python standard-library parser
pulling the text out of `#view`:

```
=================== p.html?code=sample
HEADLINE: Matched 4 of 6
BUTTONS: ['disabled']
ROW COUNT: 6
  row 0: class='row' tier=exact :: Pink + White | Frank Ocean
  row 1: class='row unmatched' tier=unmatched :: Nobody | Mitski | Not found on Spotify (US)
  row 2: class='row' tier=close :: Get You (feat. Kali Uchis) | Daniel Caesar | Close match | On Spotify: Get You · Daniel Caesar, Kali Uchis
  row 3: class='row' tier=exact :: Kill Bill | SZA
  row 4: class='row unmatched' tier=unmatched :: Bags | Clairo | Not found on Spotify (US)
  row 5: class='row' tier=exact :: Bad Habit | Steve Lacy
=================== p.html?code=nope
SCREEN TEXT: This Crossfade link doesn't exist. / Check that the whole link was copied, or ask whoever sent it.
ROW COUNT: 0
=================== p.html?code=sample&demo=error
SCREEN TEXT: Couldn't open this playlist / Crossfade couldn't load it. Nothing on your Spotify was touched. / Try again
ROW COUNT: 0
=================== p.html?code=sample&demo=empty
SCREEN TEXT: late night drive / This playlist has no songs / There's nothing here to play.
ROW COUNT: 0
```

**The checks can fail.** A deliberately broken copy, served from the scratchpad and
changed to drop unmatched rows, came back `Matched 4 of 4` with 4 rows and no failures
named. Checks 1 and 2 fail against it. The repo copy wasn't touched.

I opened all four URLs myself in the browser. They matched the output above.

## What I corrected
- **Narrowed the story.** The agent's first list offered all of S7. I took only AC 3 + 4,
  because AC 1 and AC 2 need the Week 9 bridge.
- **Chose the recipient view** over the sender's post-create view, because it's shot 4
  of the screen-record test and the page architecture §9 says comes first.
- **Approved a change to my own empty-state check.** "Load an empty playlist" isn't
  something a recipient can receive (R1), so the real empty state is an unknown code.
- **Accepted an added check.** My checks skipped the `Close match` row that R3 requires.
  Without it, the card would only partly check R3.
- **Kept the fake data visible.** Play in Spotify stays disabled, and the sample notice
  shows on screen, rather than pointing at an invented playlist id.

## Left for later
- `TODO(W10): real data`: `p.js` reads `sample/link-sample.json`. It gets replaced by
  `rpc get_link(code)` once `link_tracks` exists (architecture §3–4).
- **Play in Spotify** (S7 AC 2 / R5) is disabled until there's a real Spotify playlist id.
- `/p/<code>` only works once the Netlify `_redirects` rewrite exists. Locally it's
  `p.html?code=…`.
- The sender's post-create report (R3 shows the same report to both) isn't built.
- The check scripts are outside the repo. Move them into `tests/` when Week 9 starts it.
- `esc()` and `stateBlock()` now exist in two files.
- Evidence: S7 is still `Evidence: NONE` until W02 runs.
