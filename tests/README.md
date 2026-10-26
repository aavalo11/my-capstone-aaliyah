# Tests

Two kinds, both run from the repo root. The app in `src/` still has no build and no
dependencies. Playwright is used only here (ADR 0011).

| What | Covers | Needs | Run |
|---|---|---|---|
| `unit/` | `src/links-store.js`: create, list, rename, remove, every error it throws | Node 18+ only | `node --test tests/unit/*.test.js` |
| `e2e/` | The link CRUD checks C1–C5 and one check per fixed break-it bug, in a real browser | Node, Python 3, Playwright | `node tests/e2e/run.js` |

## First time only, for `e2e/`

```sh
cd tests
npm install                      # Playwright 1.63.0, pinned in tests/package.json
npx playwright install chromium  # about 150 MB, once per machine
cd ..
```

`run.js` starts `python3 -m http.server` on port 8123, runs `link-crud.js` and then
`link-crud-fixes.js`, and stops the server. Any failing check makes it exit with 1.

**Pass signal:** `9/9 passed`, then `13/13 passed`, then `All browser checks passed`.

## Not a test

`e2e/explore-link-crud.js` is the break-it pass from `docs/features/link-crud.md`. It
prints what happened and asserts nothing, so `run.js` skips it. Start the server from the
README first, then run `node tests/e2e/explore-link-crud.js http://127.0.0.1:8000`.

## Not here yet

- **The S7 match-report checks** (`docs/features/S7-match-report.md`) were run from
  scripts outside the repo, and those scripts aren't in this folder.
  `TODO(W10)`: rewrite them here.
- **Nothing tests Supabase or the Week 9 bridge**, because neither writes anything yet.
