# 0023 · One copy of esc() and stateBlock(), in src/ui.js

**Date.** 2026-11-16
**Status.** Decided. Refactor only: nothing on screen changes.

**Context.** `esc()` was written four times (`app.js`, `p.js`, `u.js`, `report-view.js`) and
`stateBlock()` three times (`app.js`, `p.js`, `u.js`). `p.js` copied them because loading
`app.js` would start the sender's router. A fix to `esc()` in one copy would miss the others,
and `esc()` is what keeps every interpolated string safe (CLAUDE.md).

**Decision.** A new `src/ui.js` defines both once, as `window.CrossfadeUI`, and loads first on
`index.html`, `p.html` and `u.html`. Each file keeps a one-line local name
(`var esc = window.CrossfadeUI.esc;`) so none of its call sites change.

**Why not the alternative.** `report-view.js` already exports `esc`, but `u.html` doesn't load
it, and `stateBlock()` has nothing to do with song rows. **Cost:** one more script tag on each
page, and a page that forgets it breaks on first render.

**What would change my mind.** A build step arrives (it won't this semester), and modules
replace the globals.
