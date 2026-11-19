# Tests

Two kinds, both run from the repo root. The app in `src/` still has no build and no
dependencies. Playwright is used only here (ADR 0011).

| What | Covers | Needs | Run |
|---|---|---|---|
| `unit/` | `src/links-store.js`: create, list, rename, remove, every error it throws. `src/profiles-store.js`: the username, name and bio rules. `create-link/apple.ts`: link check and share-page reading, against a saved page in `fixtures/`. `create-link/match.ts`: PRD R2's close-match rule. `create-link/spotify.ts`: what a search sends, with a fake fetch. `create-link/build.ts`: all of create-link's steps 1–9, with the FAKE Spotify and database in `fakes/`. | Node 24 (it runs the `.ts` files directly) | `node --test tests/unit/*.test.js` |
| `e2e/` | The link CRUD checks C1–C5, one check per fixed break-it bug, and `playlists.js`: opening a link's songs, Spotify links, friends' playlists, nothing unbuilt on screen. `auth.js`: Google sign-in, sign-out, the daily limit. `profile.js`: usernames and public profiles. `s7.js`: S7's four ACs, one check each (`docs/features/S7-tests.md`). All fake Supabase, so nothing reaches Google or the real database | Node, Python 3, Playwright | `node tests/e2e/run.js` |

## First time only, for `e2e/`

```sh
cd tests
npm install                      # Playwright 1.63.0, pinned in tests/package.json
npx playwright install chromium  # about 150 MB, once per machine
cd ..
```

`run.js` starts `python3 -m http.server` on port 8123, runs every file in its `CHECKS` list
(`link-crud.js`, `link-crud-fixes.js`, `playlists.js`, `auth.js`, `profile.js`, `s7.js`,
`create-edit.js`), and stops the server. Any failing check makes it exit with 1.

**Pass signal:** `9/9`, `13/13`, `13/13`, `9/9`, `8/8`, `4/4`, `10/10`, then
`All browser checks passed`. S7 AC2 passes since 2026-11-19 (links are saved online,
ADR 0029). Any failure is new.

The browser checks never reach the real Supabase or Spotify: `e2e/server-stub.js` answers the
Edge Functions and database functions with recorded data. So they test the pages, not the
matching rules. Those are covered only by the unit tests, which is why "the whole suite"
means both commands.

## Not a test

`scripts/create-link-dry-run.ts` (from the repo root) runs create-link against the real Apple
share page with the FAKE Spotify and database, and prints the report. Add `--fixture` to use
the saved page instead of the network.


`e2e/explore-link-crud.js` is the break-it pass from `docs/features/link-crud.md`. It
prints what happened and asserts nothing, so `run.js` skips it. Start the server from the
README first, then run `node tests/e2e/explore-link-crud.js http://127.0.0.1:8000`.

## Not here yet

- **The S7 match-report checks** (`docs/features/S7-match-report.md`) were run from
  scripts outside the repo, and those scripts aren't in this folder.
  `TODO(W10)`: rewrite them here.
- **Nothing tests the deployed Edge Functions automatically.** `create-link/server.ts` (the
  Deno glue) was checked once by hand against the live project on 2026-11-19.

## Drill log

### 2026-11-19 · Move 8, break it on purpose

- **Break:** in `supabase/functions/create-link/match.ts`, commented out the line
  `if (source.explicit !== (c.explicit === true)) return "explicit";`.
- **Run:** unit tests went from 112 passed to **107 passed, 5 failed**. All five were in
  `match.test.js` (lines 86, 119, 127, 171) and `create-link.test.js` (line 66). The plainest
  one: `closeMismatch(clean source, explicit candidate)` expected `'explicit'`, got `null`.
  In English: a clean Apple song now matched an explicit Spotify copy.
- **Browser checks stayed green (66/66).** They run against `server-stub.js`, which returns
  recorded matches, so they can't see a matching bug.
- **Decision:** PRD R2 says a match needs "the explicit flags are equal", and its negative AC
  says a clean source and an explicit candidate are `unmatched`. Backlog S7 AC4 says a song is
  "never substituted with a different recording". The tests say the same, so the **code** was
  wrong, not the tests.
- **Fix:** `git restore` on `match.ts`. `git diff --stat` and `git diff tests/` were empty, so no
  test was loosened, deleted or skipped.
- **Run again:** 112/112 unit, 66/66 browser, nothing skipped.
