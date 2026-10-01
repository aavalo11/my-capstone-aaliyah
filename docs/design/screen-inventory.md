# Screen inventory

Prototype: `docs/design/prototype/` (open `index.html`). Static — nothing functions.

## Screen → stories

| Screen | File | Stories |
|---|---|---|
| Connect Spotify | `connect.html` | S6 (K3 fallback only) |
| Create a link | `create.html` | S7 AC1 |
| Building | `building.html` | S7 AC1 |
| Link ready | `sent.html` | S7 AC3, match report |
| Recipient view | `playlist.html` | S7 AC2, S7 AC4, S8, match report, S11 AC1 |
| Link doesn't exist | `missing.html` | **none** — PRD R5 only |
| Fix a match | `fix-match.html` | S9 |
| Track / buy | `track.html` | S5 |
| Offline | `offline.html` | S1, S2 |
| DJ set | `dj-set.html` | S4, S11 AC2–3, S3 |
| Group playlist | `group.html` | S10 |

## Story → screen

| Story | Band | Screen(s) |
|---|---|---|
| S1 bulk offline download | COULD | `offline.html` |
| S2 size before download | COULD | `offline.html` |
| S3 DJ CSV export | COULD (evidence withdrawn) | `dj-set.html` |
| S4 offline set list | SHOULD | `dj-set.html` |
| S5 buy links | COULD | `track.html` — **no entry point** (removed from `playlist.html` by the brief) |
| S6 own-account connect | out of v1, not Won't | `connect.html` |
| S7 send to playable link | MUST | `create.html`, `building.html`, `sent.html`, `playlist.html` |
| S8 nothing written to recipient | MUST | `playlist.html` |
| S9 fix a bad match | SHOULD | `fix-match.html`, entry from `playlist.html` |
| S10 collaborative playlist | SHOULD | `group.html` |
| S11 preserve order and segues | SHOULD | `playlist.html` (AC1), `dj-set.html` (AC2–3) |
| Honest match report | MUST | `sent.html`, `playlist.html` |
| DJ request intake | COULD | **not drawn** — no story exists |

## MVP slice

`create.html` → `building.html` → `sent.html` → *(Messages)* → `playlist.html` →
*(Spotify plays)* → *(Spotify library unchanged)*. Shots 3, 5 and 6 happen outside
Crossfade.
