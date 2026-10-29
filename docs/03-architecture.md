# Crossfade: Architecture

**CP-M3 · Submitted 2026-10-16 (deadline moved from 2026-10-11)** · Map: `docs/design/architecture-map.md`

How v1 (PRD §4) gets built: paste an Apple Music link, get a Crossfade link, and your
friend plays the playlist in Spotify without logging in. This doc answers the PRD's
how-questions (§10). It doesn't change any requirement. Where it would, it says so in §11.

---

## 0. Read this first: what this doc stands on

The PRD said the architecture doc would be "built on facts" from K1–K3, checked by
Oct 9. As of 2026-10-16, it still isn't. Nothing in this table has changed since
2026-10-08. **Updated 2026-10-29:** K1 and K2 are settled by ADR 0012.

| Dependency | State 2026-10-16 (unchanged since 10-08) | This doc assumes | If it goes the other way |
|---|---|---|---|
| **Go/no-go (PRD §3)**: W02 and W03 test the premise | **Missed.** The Oct 4 deadline passed and `research/interview-02.md` is empty. This is the second missed go/no-go. | The bridge is still the product | If W02 and W03 lead with downloading, the capstone moves to J1 and this doc is rewritten |
| **K1**: a developer token reads a user-shared `pl.u-` playlist, with ISRCs | **Replaced (ADR 0012).** The public share page held all 52 tracks of one playlist, with no ISRCs. A ~100-track playlist is untested. | Steps 5–6 read the share page and skip the ISRC search | Pay $99 or repoint (ADR 0012) |
| **K2**: Apple developer token, $99/yr | **Settled 2026-10-29:** SU has no team, so no developer token | No Apple key at all | — |
| **K3**: Spotify Premium for the app owner, plus the Developer Policy check | Premium: **yes**. Policy reread and test playlist: **not done** | Crossfade's own account builds public playlists (D1) | Recipient OAuth, capped at 5 friends (ADR 0006's fallback) |

Nothing below is built until these are settled. The current `src/` is a UI shell with no
Apple or Spotify code (§9).

---

## 1. The system in one picture

```
 Sender's iPhone                       Supabase (hosted)                     Outside
 ───────────────                       ─────────────────                     ───────
 Create page ──POST link+passcode──▶  Edge Function: create-link  ──────▶  Apple share page
      ▲                                 │  1 check passcode, format             (public HTML,
      │ poll progress (1s)              │  2 check rate limit                    no ISRCs)
      └──────────────── builds row ◀────┤  3 read Apple playlist
                                        │  4 match each track   ──────────▶  Spotify Web API
                                        │  5 create playlist                    (search, create,
                                        │  6 save link + tracks                  add items)
                                        ▼
                                     Postgres: links, link_tracks, builds
                                        ▲
 Friend's phone                         │ rpc get_link(code)  (publishable key)
 /p/<code> page ────────────────────────┘
      │
      └── "Play in Spotify" ─────────────────────────────────────────────▶  open.spotify.com
```

**Three parts, two of them hosted:**

| Part | What it is | Where it runs |
|---|---|---|
| Front end | Plain HTML, CSS and JS in `src/`, with no build step (ADR 0007) | Netlify (ADR 0008). Locally, `python3 -m http.server`. |
| `create-link` | One Supabase Edge Function (TypeScript on Deno). It's the only code that holds secrets. | Supabase |
| Database | Postgres with row-level security | Supabase |

The browser never talks to Apple or Spotify, so secrets never reach a phone (PRD R6,
requirements lines 8–9). The one exception is the "Play in Spotify" button, which is a
plain link.

---

## 2. Creating a link, step by step

This is `create-link`, a single `POST` from the Create page with
`{ link, passcode, build_id }`. `build_id` is a random UUID the browser makes so it can
poll progress (§5).

| # | Step | On failure (PRD R1 wording) | Calls made so far |
|---|---|---|---|
| 1 | Compare the passcode with `SENDER_PASSCODE`, in constant time | `Wrong passcode.` | none |
| 2 | Validate the link: `music.apple.com`, `/us/`, `/playlist/` | `That isn't an Apple Music playlist link.` / `Crossfade only handles US Apple Music links.` | none |
| 3 | Rate limit: count `builds` rows in the last hour. If there are 20 or more, stop. | `Crossfade is rate-limited. Try again in N minutes.` | none |
| 4 | Insert the `builds` row. From here on it counts toward the limit (R6). | — | — |
| 5 | Apple: fetch the share page from `music.apple.com`, parse `<script id="serialized-server-data">`, and take the section whose id starts with `track-list` (ADR 0012). Over 100 items → stop. A page without that block or section fails the same way as an Apple error. | `Apple Music wouldn't share this playlist…` / size message | Apple |
| 6 | Match each item in source order (R2): the close-match search. There's no ISRC search, because the page has no ISRCs (ADR 0012). | — | Spotify (search) |
| 7 | Zero matched → stop. No playlist is created and no link is issued (R1). | report with every track unmatched | — |
| 8 | Create the playlist on Crossfade's account, then add the tracks in order, duplicates included (R4) | `Something failed on Spotify's side…` | Spotify (write) |
| 9 | Insert `links` and `link_tracks` in one transaction, then return `{ code, report }` | `Something failed on Crossfade's side…` | — |

**Cleanup (R1).** If step 8 or 9 fails after the playlist exists, unfollow it (Spotify's
only form of delete). If the unfollow also fails, log the playlist id for manual cleanup.
The sender sees the same message either way.

**Speed (S7 AC 1: 25 tracks in 15 s).** Run Spotify searches **5 at a time**, not one by
one. The worst case is 1 search per track (no ISRC search, ADR 0012). On a `429`, wait for Spotify's `Retry-After`
and then continue. Week 9 benchmark: time 25, 50 and 100-track builds.

**Function limits** (Supabase docs, *Edge Functions → Limits*, checked 2026-10-16):

| Limit | Free plan | What it means for `create-link` |
|---|---|---|
| Wall clock | **150 s** (400 s on paid plans) | The whole build has to finish in this time |
| Request idle timeout | **150 s**, then a `504` | The `POST` has to get a response within 150 s, so the build can't run longer than that and report later |
| CPU time | **2 s** per request. Async I/O doesn't count. | Waiting on Apple and Spotify is free. Only JSON parsing and normalizing titles count. |
| Memory | **256 MB** | A 100-track playlist is a few hundred KB, nowhere near it |

Back-of-envelope estimate for the worst case: 100 tracks × 2 searches ÷ 5 at a time = 40
rounds. At roughly 0.3 s per round that's about 12 s, plus the Apple read and 1–2 Spotify
writes. That is well inside 150 s. **The real threat is a long `Retry-After` on a `429`**,
not CPU. Rule: if a `Retry-After` would push the build past **120 s**, stop and fail
honestly with `Something failed on Spotify's side…`, rather than letting it hit the 504.
The Week 9 benchmark still has to confirm the 0.3 s figure. If 100 tracks don't fit, ADR
0007's "what would change my mind" applies: matching moves to a queue.

---

## 3. Opening a link

`/p/<code>` is a static page. Its JS calls one database function with the publishable
key:

```
POST /rest/v1/rpc/get_link   { "p_code": "x7Kq2mVb9R" }
```

It returns the name, Spotify playlist id and every track row in source order. The page
renders the report (R3) and **Play in Spotify** → `https://open.spotify.com/playlist/<id>`.

- **Unknown code** → `This Crossfade link doesn't exist.` (R5)
- **Database unreachable** → an error state that names Crossfade, not a blank page
- **Nothing is written** when a link is opened. There are no cookies and no analytics (R6).

**Why a function and not a plain table read.** Today's shell lets the publishable key run
`select` on `links`, which means anyone can list every link. `get_link(code)` returns
only the row you already have the code for. In Week 9, `select` on the tables is revoked
from `anon`, and `get_link` becomes the only way in.

---

## 4. Data

Postgres, in the `public` schema. Row-level security is on for every table, and **no
table grants `select` to `anon`** (§3).

```
links
  id                 bigint identity  primary key
  code               text unique       10 chars, [A-Za-z0-9], random (§6)
  source_url         text
  name               text              Apple name, cut to Spotify's limit (§6)
  spotify_playlist_id text
  track_count        int  1..100
  matched_count      int  0..track_count
  created_at         timestamptz

link_tracks
  link_id            → links.id
  position           int               source order, 0-based; (link_id, position) is the key
  source_title, source_artist  text
  isrc               text null        always null in v1 (ADR 0012)
  tier               text  exact | close | unmatched
  spotify_track_id   text null
  spotify_title, spotify_artists  text null    shown under "Close match" (R3)

builds                                   rate limit + progress
  id                 uuid primary key  from the browser
  created_at         timestamptz       the rate limit counts these (R6)
  done, total        int               progress
  status             text  running | ok | failed
```

**Writes** happen only inside `create-link`, using the secret key. **Reads** go only
through `get_link(code)` and `get_build(id)`. **Nothing about the recipient is stored**
(R6).

`supabase/schema.sql` today is the shell version: one `links` table with sample rows.
In Week 9 it becomes this schema, as a Supabase migration.

---

## 5. PRD §10 answers

| Question | Answer | Why |
|---|---|---|
| **How does progress reach the phone?** | **Polling.** The page calls `get_build(id)` every second while the `POST` is open. | The function updates one row as it goes. Polling needs nothing beyond what's already there. Server-sent events would tie progress to one open connection, which iOS Safari can drop when the screen locks. With polling, the build keeps its row and the page can pick up again. |
| **Quotes inside `track:"…"`** | **Replace `"` with a space** in the title and artist before building the query. | Spotify doesn't document an escape for quotes in field filters. R2 compares *normalized* titles anyway, and normalization already strips punctuation, so the query only has to find candidates. A Week 9 test case uses a title containing quotes. |
| **What unit is "100 characters"?** | **Unicode code points** (`Array.from(name).slice(0, 100)`), never splitting an emoji or accented letter | **Unverified:** Spotify's real limit for a playlist name isn't something I've confirmed. The K3 test playlist should try a long name and measure where Spotify cuts it. If Spotify's limit is different, R4 follows Spotify's. |
| **How are the rate limit and links stored?** | In Postgres, in `builds` and `links` (§4) | One place, transactional. A `builds` row is the rate-limit counter. |

---

## 6. Secrets and keys

| Secret | Used for | Lives in |
|---|---|---|
| `SENDER_PASSCODE` | Step 1 | `supabase secrets set` |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN` | A fresh Spotify access token for Crossfade's account each build | `supabase secrets set` |
| Supabase secret key | `create-link` writing to the database | Provided to Edge Functions automatically |
| Supabase **publishable** key | Front end: `get_link`, `get_build` | `src/config.js` (public by design) |

`.gitignore` already blocks `*.p8` and `.env`. The Spotify refresh token is obtained
**once**: I log in as Crossfade's Premium account, approve `playlist-modify-public`, and
store the result. That's a one-time manual step, not a feature.

**Link codes.** 10 characters from 62 (`crypto.getRandomValues`), which is about 59 bits.
That's too many to guess, and `get_link` only answers for an exact code.

---

## 7. Dependencies

| Where | Dependency | Why |
|---|---|---|
| Front end | **None** | `fetch` against Supabase's REST endpoints is enough |
| `create-link` | **None planned.** Deno's built-in WebCrypto signs the Apple JWT, and `fetch` calls Apple, Spotify and Supabase. | Every dependency is something to update later. If ES256 signing in WebCrypto fights me, `jose` is the fallback, and I'll say so. |
| Lab 5 (Oct 22) | `@supabase/supabase-js`, pinned | Auth sessions are where a client library earns its place |
| Tooling, Week 9 | Supabase CLI (Homebrew, system-wide) | Deploying functions and setting secrets. Docker only if I want functions to run locally. |

---

## 8. Hosting

| Thing | Choice | Status |
|---|---|---|
| Database + function | One Supabase project (`crossfade`, East US), free tier | Exists |
| Front end | **Netlify, ADR 0008.** `_redirects`: `/p/*  /p.html  200`, a rewrite, so `/p/<code>` returns a 200 (R1, R5). | Decided. GitHub Pages was rejected because its `404.html` trick returns a 404 status, and Messages link previews may treat that as broken. |
| Local | `python3 -m http.server 8000 --directory src` against the hosted project | Works (README) |

**Free-tier pause.** Supabase pauses free projects after about a week without use. That's
fine during the build. Before the demo, make sure the project has been used recently, or
restore it in the dashboard.

---

## 9. What's in `src/` today, and how it fits

Built 2026-10-08 for the stack lab (ADR 0007):

| Screen | v1? | Architecture note |
|---|---|---|
| Create (paste link + passcode) | **Yes, R1** | Client-side checks only today. In Week 9 it calls `create-link` and polls `get_build`. |
| Home → Recently added, Your numbers | Sender view | Reads `links` directly today. When `select` is revoked (§3), this moves behind the sender login (Lab 5) or comes out. |
| Home → New this week, Top songs, Top albums | No, **S15**, holding pen | Uses Apple's public RSS chart feed, a published feed, not page scraping, so it doesn't conflict with K1. It's legacy and may disappear, and the error states cover that. |
| Friends | No, **S13**, sample data | No architecture until ADR 0006 is revised |
| Settings → Account | No, **S14** | Becomes real if Lab 5 adds a sender login (below) |
| `/p/<code>` link page | **Yes, R3 + R5** | **Not built yet.** It's the most important page and comes first in Week 9. |

**Lab 5 (auth).** Recipients never log in (ADR 0006). Auth would be for **the sender
only**: Supabase Auth magic link, replacing `SENDER_PASSCODE` (D7). That changes a PRD
decision, so it gets an ADR when Lab 5 starts.

---

## 10. Risks this design adds

| Risk | Mitigation |
|---|---|
| A 100-track build exceeds the function's limits (150 s wall clock, 2 s CPU) | Estimated about 12 s worst case (§2). Benchmark in Week 9; parallel searches; stop at 120 s; queue fallback (ADR 0007) |
| Spotify `429` during a build | Honour `Retry-After`; 5 searches at a time; the R6 rate limit caps total load |
| iOS kills the page mid-build | Polling picks the build back up by `build_id`. Worst case, the sender sees the result on reload. |
| Publishable key used to scrape every link | `select` revoked; reads only through `get_link(code)` (§3) |
| Free-tier pause before the demo | Use the project recently before demo day (§8) |
| Legacy chart feed disappears | Discover only (S15). Error states already handle it. |

---

## 11. Changes this doc asks of the PRD

1. **§9 "No code goes in `src/` before Week 9, whatever happens"** was overtaken on
   2026-10-08. The stack lab required a running starter. What's there is a UI shell with
   no Apple or Spotify calls, so the rule's intent (don't build on unverified APIs) still
   holds. Update the PRD's wording to say exactly that.
2. **R1 progress.** Progress is polled once per second (§5). There's no requirement
   change, just a note.
3. **`supabase/schema.sql`** moves from the shell table to §4's schema in Week 9.
4. **K1, K2, D3, R2, R6 and §8** were updated on 2026-10-29 for ADR 0012: the share page
   replaces the Apple Music API, there are no Apple keys, and there's no `exact` tier in v1.
