# 0011 · Playwright as a test-only dependency

**Date.** 2026-10-26
**Status.** Decided

**Context.** The link CRUD checks (`docs/features/link-crud.md`) have to click, type, open
two tabs and read localStorage. The headless Chrome `--dump-dom` check in CLAUDE.md can
only print a page. Until now the S7 and CRUD check scripts lived outside the repo, so a
grader saw no tests. The course layout asks for `tests/` with unit and Playwright tests.

**Decision.** Playwright goes in `tests/package.json` as a dev dependency, pinned to
1.63.0, and nowhere else. `src/` keeps no build, no npm and no dependencies (ADR 0007).
Unit tests use Node's built-in `node:test` and need no install at all. The browser checks
are plain Node scripts that exit non-zero on a failure, and `tests/e2e/run.js` starts the
same Python server as the README.

**Why not the alternative.** `@playwright/test` brings a runner, a config file and its own
reporter, which is more than about 20 checks need. Puppeteer only drives Chrome, and
Playwright was already what the course names. Keeping the checks outside the repo hides
the evidence from the grade.
**Cost:** `npm install` and `npx playwright install chromium` inside `tests/`, which is
about 150 MB of browser on first run. Node has to be on the machine, which plain HTML
didn't need before.

**What would change my mind.** If the Week 13 tests need fixtures, retries or trace
viewing, switch these scripts to `@playwright/test`. The checks themselves shouldn't
change.
