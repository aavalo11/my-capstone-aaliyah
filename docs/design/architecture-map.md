# Crossfade: Architecture map (CP-M3)

The MVP slice only: **S7 + S8 + the match report** (backlog §5). Every box names the
requirement it serves. The prose is in `docs/03-architecture.md`.

```
 SENDER'S iPHONE (D8)                 SUPABASE (ADR 0007)                       OUTSIDE
 ════════════════════                 ═══════════════════                       ═══════

 ┌───────────────────┐   POST        ┌──────────────────────────────┐        ┌──────────────────┐
 │ [A] Create page   │ link+passcode │ [C] Edge Function            │  GET   │ [G] Apple Music  │
 │  R1 · S7          │──────────────▶│     create-link              │───────▶│     share page   │
 │                   │               │  R1 · R2 · R4 · R6           │        │  R1 · K1 · K2    │
 └───────────────────┘               │  1 passcode  (R6, D7)        │        └──────────────────┘
       │ poll 1s                     │  2 link format (R1, D5)      │
       ▼                             │  3 rate limit (R6)           │ search ┌──────────────────┐
 ┌───────────────────┐               │  4 read Apple (R1, D6)       │ create │ [H] Spotify      │
 │ [B] rpc get_build │◀── row ───────│  5 match (R2, D3)            │───────▶│     Web API      │
 │  R1 progress      │               │  6 build playlist (R4, D1)   │  add   │  R2 · R4 · K3    │
 └───────────────────┘               │  7 save (R3, R5)             │        └──────────────────┘
                                     └──────────────┬───────────────┘
                                                    │ secret key (R6)
                                                    ▼
                                     ┌──────────────────────────────┐
                                     │ [D] Postgres, RLS on         │
                                     │  links · link_tracks  R3 R5  │
                                     │  builds   R1 progress, R6    │
                                     │  no recipient data   R6 S8   │
                                     └──────────────┬───────────────┘
                                                    ▲ publishable key
 FRIEND'S PHONE (D8)                                │
 ═══════════════════                 ┌──────────────┴───────────────┐
 ┌───────────────────┐  rpc          │ [E] rpc get_link(code)       │
 │ [F] /p/<code>     │──────────────▶│  R5 · R6 (no table select)   │
 │  page             │◀──────────────│                              │
 │  R3 · R5 · S8     │  name+tracks  └──────────────────────────────┘
 └─────────┬─────────┘
           │ "Play in Spotify" (plain link, no login: D1, S8)
           ▼
     open.spotify.com/playlist/<id>   [I]  R5

 [S] Netlify (ADR 0008) serves A and F. The rewrite /p/*  /p.html  200 gives a real
     /p/<code> URL with a 200 (R1, R5, D8).
```

## Each box and why it exists

| Box | Component | Serves | Without it |
|---|---|---|---|
| A | Create page | R1, S7 | The sender has no way in |
| B | `get_build(id)` | R1 (visible progress, S7 AC 1) | A 15 s build would look frozen on the phone |
| C | `create-link` Edge Function | R1, R2, R4, R6 | Secrets would have to sit in the browser (R6) |
| D | Postgres: `links`, `link_tracks`, `builds` | R3, R5 (links last for days), R6 (rate-limit count) | Links would die, and the rate limit would have nothing to count |
| E | `get_link(code)` | R5, R6 | The publishable key could list every link (architecture §3) |
| F | `/p/<code>` page | R3, R5, S8 | The recipient has nothing to open |
| G | Apple Music share page, public HTML (ADR 0012) | R1 (read playlist, no ISRCs) | Nothing to rebuild |
| H | Spotify Web API | R2 (search), R4 (create, add) | Nothing to play |
| I | `open.spotify.com` link | R5 | The recipient would have to search Spotify themselves |
| S | Netlify static host (ADR 0008) | R1, R5, D8 (a real `/p/<code>` URL that Messages previews) | No public URL to send |

None of these boxes is there "just in case". If one can't be traced to a requirement, it
comes off the map.

## Trace: S7, hop by hop

"As someone on Apple Music who made a playlist, I want to send one link…"

1. **Sender → A.** She pastes `music.apple.com/us/playlist/…` and the passcode, then
   taps **Create link**. The browser makes a `build_id`.
2. **A → C.** `POST { link, passcode, build_id }`. Steps 1–3 can fail with no API calls
   at all: wrong passcode, bad link, or rate-limited (R1, R6).
3. **C → D.** C inserts the `builds` row. From here on the build counts toward the limit
   (R6).
4. **A → B → D, every second.** The page polls `get_build` and shows `done / total` (R1).
5. **C → G.** C reads the share page and its tracks. There are no ISRCs (ADR 0012). Over 100 tracks, or a
   private playlist, stops the build with R1's wording.
6. **C → H.** For each track, C runs the strict close-match rule (no ISRC search,
   ADR 0012), 5 searches at a time (R2, D3). If nothing matches, the build stops and no link
   is made (R1).
7. **C → H.** C creates the playlist on Crossfade's account and adds the tracks in source
   order (R4, D1). If this or step 8 fails, C unfollows the playlist (R1 cleanup).
8. **C → D.** C writes `links` and `link_tracks` in one transaction.
9. **C → A.** C returns `{ code, report }`. The sender sees `Matched 47 of 50` and the
   three misses by name (R3), then sends the link in Messages.
10. **Friend → S → F.** The friend taps the link and the host serves the page.
11. **F → E → D.** The page calls `get_link(code)` and gets the name, playlist id and
    tracks. An unknown code shows `This Crossfade link doesn't exist.` (R5). Nothing is
    written (R6, S8).
12. **F → I.** The friend taps **Play in Spotify**. Playback happens on the friend's own
    Spotify subscription, so no audio passes through Crossfade.

## Not on this map, on purpose

- **Home, Friends, Settings and Discover (S12–S15)** are in the holding pen with no
  evidence. They exist in `src/` as a shell, but they aren't part of the MVP slice.
- **Sender login (Lab 5)** would replace D7's passcode and needs an ADR first.
- **Recipient OAuth, fixing a match (S9), and offline/DJ/buy (J1–J3)** are outside v1
  (PRD §7).
- **Audio transfer, crossfade control, and synced playback** can't be built at all
  (CLAUDE.md hard constraints).
