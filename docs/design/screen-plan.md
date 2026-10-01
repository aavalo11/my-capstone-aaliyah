# Screen plan (agent) — approved 2026-10-01: draw S6, skip DJ request intake

Generated from `docs/backlog.md` and `docs/02-prd.md` on 2026-10-01, before anything was
built. Won't-band items are excluded.

| # | Screen | File | Stories | What's on it |
|---|---|---|---|---|
| 0 | Prototype index | `index.html` | — | Not a product screen. Links every screen, shows the inventory and the MVP path. |
| 1 | Create a link (sender) | `create.html` | S7 AC1 | Apple Music link + Passcode fields, one **Create link** button. Error states: `Wrong passcode.`, bad link, non-US, rate-limited, empty, >100. |
| 2 | Building | `building.html` | S7 AC1 | `Reading playlist…` → `Matching K of N…` progress, Create link disabled. |
| 3 | Link ready (sender) | `sent.html` | S7 AC3, match report | `Matched 23 of 25`, misses named, link as selectable text, **Copy link**. Also: zero-match state (no link issued), mid-build failure state. |
| 4 | Recipient link page | `playlist.html` | S7 AC2 + AC4, S8, match report, S11 AC1 | Playlist name, `Matched X of N`, every row in source order (exact / `Close match` / greyed `Not found on Spotify (US)`), one primary **Play in Spotify**. No login anywhere. |
| 5 | Link doesn't exist | `missing.html` | *(PRD R5 only — no story)* | `This Crossfade link doesn't exist.` |
| 6 | Fix a match | `fix-match.html` | S9 | Up to 5 alternates with duration + album; manual search box when none clear the threshold. |
| 7 | Track sheet | `track.html` | S5 | Buy on Bandcamp / iTunes when a source exists; no affordance at all when it doesn't. |
| 8 | Offline | `offline.html` | S1, S2 | Size estimate + free space before commit, **Make available offline**, `n of 50 downloaded`, shortfall error, Offline list largest-first with bulk delete. |
| 9 | DJ set | `dj-set.html` | S4, S11 AC2–3, S3 | Set list marked for an event, unplayable tracks flagged, `next track missing — segue broken`, **Export CSV** with `28/40 with BPM`. |
| 10 | Group playlist | `group.html` | S10 | One shared list, each track attributed to the adder and their service, de-duplicated. |

## Decisions needed before building

- **S6 (family-plan connect).** Crossed out under MUST, "out of v1," but **not in the
  Won't column**. Draw it (as the K3-fallback connect screen) or move it to Won't?
- **DJ request intake.** On the board in COULD with **no story behind it**. Proposal:
  don't draw it; log it in gaps.md as "on the board, no story."

## Things I noticed while planning (candidate gaps — verify against your own list)

- S1 AC1 assumes "a connected account" and a native download manager; ADR 0006 says
  nobody connects. S1 can't be drawn without contradicting the PRD.
- S5 ("open its row" → buy link) and S9 ("tap it" → alternates) both claim the same tap
  on a track row.
- Nothing says what the sender sees *after* copying the link, or whether they can find
  an old link again (PRD rules out history).
- S9 AC2 ("correction is reused") needs to know who the recipient is; R6 says nothing
  about the recipient is stored.
- S4/S11/S3 have no entry point: nothing says how a playlist becomes "a set list marked
  for an event."
