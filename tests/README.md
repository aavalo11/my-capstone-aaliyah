# Tests

Two kinds, both run from the repo root. The app in `src/` still has no build and no
dependencies. Playwright is used only here (ADR 0011).

| What | Covers | Needs | Run |
|---|---|---|---|
| `unit/` | `src/links-store.js`: create, list, rename, remove, every error it throws. `src/profiles-store.js`: the username, name and bio rules. `create-link/apple.ts`: link check and share-page reading, against a saved page in `fixtures/`. `create-link/match.ts`: PRD R2's close-match rule. `create-link/spotify.ts`: what a search sends, with a fake fetch. `create-link/build.ts`: all of create-link's steps 1–9, with the FAKE Spotify and database in `fakes/`. | Node 24 (it runs the `.ts` files directly) | `node --test tests/unit/*.test.js` |
| `e2e/` | The link CRUD checks C1–C5, one check per fixed break-it bug, and `playlists.js`: opening a link's songs, Spotify links, friends' playlists, nothing unbuilt on screen. `auth.js`: Google sign-in, sign-out, the daily limit. `profile.js`: usernames and public profiles. Both fake Supabase, so nothing reaches Google or the real database | Node, Python 3, Playwright | `node tests/e2e/run.js` |

## First time only, for `e2e/`

```sh
cd tests
npm install                      # Playwright 1.63.0, pinned in tests/package.json
npx playwright install chromium  # about 150 MB, once per machine
cd ..
```

`run.js` starts `python3 -m http.server` on port 8123, runs `link-crud.js` and then
`link-crud-fixes.js`, and stops the server. Any failing check makes it exit with 1.

**Pass signal:** `9/9 passed`, `13/13 passed`, then `10/10 passed`, `9/9 passed`, `8/8 passed`, and `All browser checks passed`.

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
- **Nothing tests Supabase or the Week 9 bridge**, because neither writes anything yet.
