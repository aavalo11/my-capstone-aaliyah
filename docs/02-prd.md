# Crossfade — Product Requirements

**Status:** v1 for CP-M2 · living spec, revised as the build proceeds
**Last updated:** 2026-09-27
**Owner:** A. Avalo
**Builds from:** `01-concept-brief.md` (problem, job) · `backlog.md` (stories S1–S11,
MoSCoW, MVP slice) · `research/interview-01.md` (W01) · `decisions/0002–0006`

This document decides what v1 is. Where it changes the backlog, §11 lists the change so
the two stay in sync. If code and this document disagree, one of them gets a commit.

---

## 1. Problem

I'm on Apple Music. Most of the people I trade music with are on Spotify. When someone
says "send me that playlist," I send a screenshot of the track list or a few single-song
links, and the friend either retypes it or, more often, never listens. The playlist
doesn't actually get shared.

**The job:** when my friend and I are on different services, I send one link and they can
press play on the playlist in the app they already use.

## 2. Users

| | Who | Has | Won't tolerate |
|---|---|---|---|
| **Sender** | Me (the only sender in v1) | iPhone, Apple Music, a playlist already shared by link | Anything slower than sending a screenshot |
| **Recipient** | A friend on Spotify, Free or Premium, often on a family plan | iPhone or Android, Spotify app installed | Logging in to a stranger's site; a stranger's playlist written into their library |

## 3. Evidence status (read this before the requirements)

- **W01 did not support this product.** He said cross-service sharing would be "nice,"
  then said he "doesn't mind not being able to work with other music services." His
  real pain was downloading (4 unprompted mentions), which this product doesn't address
  (ADR 0003).
- **The bridge stories (S7, S8) are still founder-sourced.** W02 and W03 are not
  recorded yet (`research/interview-02.md` is empty).
- **ADR 0003 set the go/no-go point "before the PRD is due." That deadline was missed.**
  New deadline: **Sun Oct 4**, so the answer arrives a week before the architecture doc
  (Oct 11). Rule unchanged: if W02 and W03 both lead with downloading rather than
  sharing, the capstone moves to J1 and this PRD gets rewritten.

This PRD is written so that the first week of building also tests the premise: the
match-rate benchmark (§8) answers the concept brief's biggest unknown with numbers.

## 4. What v1 is

> **Paste an Apple Music playlist link. Get a Crossfade link. Your friend opens it,
> sees exactly what matched, taps "Play in Spotify," and hears it. Nobody logs in.**

The flow, end to end:

1. I share a playlist in Apple Music (Share → Copy Link) and paste the link into
   Crossfade on my phone, along with the sender passcode.
2. Crossfade reads the tracks, finds each one on Spotify, and builds a public Spotify
   playlist **on Crossfade's own Spotify account**.
3. I see `Matched 23 of 25`, with the two misses listed by name, and a Copy Link button.
4. I text the link. My friend opens it and sees the same report and a
   **Play in Spotify** button.
5. The button opens the playlist in their Spotify app. They press play. Audio comes out.
6. Nothing was added to their library, because Crossfade never had access to it.

## 5. Decisions

Each of these could have gone the other way. They're decided here so the build doesn't
re-decide them.

| # | Decision | Why | Rejected alternative |
|---|---|---|---|
| D1 | **Nobody connects an account in v1.** The sender pastes a link. The rebuilt playlist lives on a Crossfade-owned Spotify account. | Removes both OAuth flows. The recipient can't be written to (S8 holds by design), and family-plan recipients have nothing to authorize (S6 holds by design). See ADR 0006. | Recipient OAuth + create in their library. Since Mar 2026, Spotify dev mode allows only **5 allowlisted users**, and extended quota needs 250k MAU. So recipient login caps the product at 5 hand-registered friends. It would also break S8 and ask a friend to log in to a stranger's site. |
| D2 | **Apple Music → Spotify only.** | ADR 0002. | Both directions: double the work, no extra demo value. |
| D3 | **Match by ISRC first, then a strict metadata rule, and nothing else.** No fuzzy scores, no "best guess." | ISRC identifies a specific recording. Anything looser is exactly how a sped-up or karaoke version gets in. | Scored fuzzy matching: better recall, and it silently substitutes recordings. |
| D4 | **Unmatched tracks are left out of the Spotify playlist and shown on the Crossfade page in their original position.** | A Spotify playlist can't hold a placeholder. The Crossfade page is where the honest report lives. | Substituting the closest search result: the lie this product exists to avoid. |
| D5 | **US storefront and US Spotify market only.** | One region to test. "Not available" then means one thing. | Detecting the recipient's region: needs recipient data I've chosen not to collect. |
| D6 | **1–100 tracks per playlist.** | One page of Apple's API and one Spotify add-items call. Covers every playlist I actually send. | Unlimited: pagination and partial-failure handling for a case I don't have. |
| D7 | **Sender access is one passcode.** | Stops strangers from filling Crossfade's Spotify account. No user system to build. | Sender accounts: a login system for one user. |
| D8 | **Target device is an iPhone browser at 390 px wide**, including the browser that opens from Messages. Other browsers are best effort. | That's where the link gets opened. | Desktop-first. |

## 6. Requirements

Acceptance criteria are Given / When / Then. A requirement is done when every AC passes
as written. Where an AC names exact text, that text is the requirement.

### R1 — Create a link (sender) · from S7

**The page.** One form with two fields, **Apple Music link** and **Passcode**, and a
**Create link** button. That's the empty state. Nothing is remembered between visits,
though the browser may autofill.

**What counts as a valid link.** `http` or `https`, host `music.apple.com`, path
`/us/playlist/<any-slug>/<id>`, where `<id>` starts with `pl.`. That covers both user
playlists (`pl.u-…`) and Apple's editorial ones. A trailing slash and any query string
(`?l=en`, `?ls`) are ignored.

**Check order.** On submit, these run in order, and the first one that fails shows its
message: (1) passcode, (2) link format, (3) rate limit (R6). Then Crossfade calls Apple.

- **Given** the correct passcode and a valid link to a playlist with 1–100 items,
  **when** I tap **Create link**, **then** I see the match report (R3) and a link of the
  form `https://<host>/p/<code>`, shown as selectable text, with a **Copy link** button.
- **Given** a 25-track playlist, **when** I tap **Create link**, **then** the link
  appears within 15 seconds. A progress line appears within 2 seconds of the tap. It
  reads `Reading playlist…` until Apple responds, then `Matching K of N…`, and K goes up
  as each track finishes.
- While a build is running, **Create link** is disabled.
- Tapping **Copy link** copies the link, and the button reads `Copied` for 2 seconds. If
  the browser blocks the clipboard, the link is still selectable text.
- `<code>` is 10 random URL-safe characters. It can't be guessed and isn't derived from
  the playlist.
- Submitting the same link twice creates two separate links and two separate Spotify
  playlists. v1 doesn't de-duplicate.
- **Negative — Given** a wrong or empty passcode, **when** I submit, **then** I see
  `Wrong passcode.` and no Apple or Spotify call is made.
- **Negative — Given** an empty link, or a link that isn't a valid link as defined above
  (a Spotify link, an Apple Music album link), **when** I submit, **then** I see
  `That isn't an Apple Music playlist link.` and nothing is created.
- **Negative — Given** a valid-looking link from a storefront other than `/us/`, **when**
  I submit, **then** I see `Crossfade only handles US Apple Music links.` and nothing is
  created.
- **Negative — Given** Apple answers "not found" (private, deleted, or a mistyped id),
  **when** I submit, **then** I see
  `Apple Music wouldn't share this playlist. Check that it's shared by link.` and
  nothing is created.
- **Negative — Given** a playlist with 0 items, **then** `This playlist is empty.` **Given**
  more than 100, **then** `This playlist has more than 100 tracks. Crossfade handles up
  to 100.` In both cases nothing is created.
- **Negative — Given** zero tracks match, **when** matching finishes, **then** I see the
  report with every track listed as unmatched, **no Spotify playlist is created, and no
  link is issued.**
- **Negative — Given** a failure partway through, **when** the build stops, **then** no
  link is issued, and I see
  `Something failed on <Apple Music|Spotify|Crossfade>'s side. Nothing was sent. Try again.`
  The service named is the one that failed: Apple or Spotify for an error, timeout, or
  rate-limit response from them, and Crossfade for anything else.
  - Any Spotify playlist already created for this attempt is removed. That means
    unfollowed, which is Spotify's only form of delete. If the removal also fails, its
    Spotify id is logged for manual cleanup, and the sender still sees the same message.
  - Before counting as a failure, a call that times out or gets a rate-limit response is
    retried once, if the 15-second budget allows.

### R2 — Match each track · from S7, CB-01

**N counts every item in the Apple playlist.** That includes music videos and items
Apple no longer has in its catalog. Those are always `unmatched` and count toward the
100 limit.

Run for every item, in source order. The first rule that produces a result wins.

1. **Exact.** If the source track has an ISRC, search Spotify for `isrc:<ISRC>` with
   `market=US`. If any results come back, take the first result. Tier = `exact`.
2. **Close.** If there's no ISRC, **or** the ISRC search returned nothing, search Spotify
   for `track:"<title>" artist:"<primary artist>"` with `market=US`. Of the first 10
   results, take the first one where **all** of these hold:
   - the normalized titles are equal. Normalization (below) is applied to both sides.
   - the primary artist equals, case-insensitively, one of the candidate's artist names
   - the durations differ by at most 3,000 ms, inclusive
   - the explicit flags are equal. A source track is explicit only if Apple's
     `contentRating` is `explicit`. `clean` and a missing rating both count as not
     explicit.

   Tier = `close`.
3. **Otherwise** the track is `unmatched`. No other rule and no manual override exists
   in v1.

**Primary artist:** the first artist in Apple's `artists` relationship for the song. If
that's missing, use Apple's full `artistName` string unchanged. Don't try to split it.

**Title normalization:** lowercase. Remove any feature segment: a parenthesized or
bracketed segment, or a ` - ` suffix, whose first word is exactly `feat`, `feat.`, `ft`,
`ft.`, or `with`. So `(With You)` is removed, but `(Without You)` isn't. Remove every
character that isn't a letter or digit in any script, or a space, so `é`, `ñ`, and
non-Latin titles survive. Collapse runs of spaces and trim. **Don't remove words like
`remix`, `live`, `acoustic`, `sped up`, `remaster`, or `version`.** Those words are what
keep the wrong recording out.

- **Negative — Given** a studio track whose only Spotify title match is a `(Live)` or
  `(Sped Up)` version, **when** it's matched, **then** it's `unmatched`, because the
  normalized titles differ.
- **Negative — Given** a clean source track and an explicit Spotify candidate with the
  same title, artist, and length, **when** it's matched, **then** it's `unmatched`.

### R3 — Match report · from S7 AC 3–4

Shown to the sender after creating a link, and to the recipient on the link page. The
content is identical for both.

- The headline reads `Matched X of N`, where X counts `exact` and `close` tracks.
- Every source track is listed once, in source position, with title and artist.
  - `exact` tracks show normally.
  - `close` tracks show a `Close match` label with the Spotify title and all its artists,
    comma-separated, beneath, so a reader can spot a wrong one.
  - `unmatched` tracks are greyed, with the text `Not found on Spotify (US)`.
- **Negative — Given** 3 of 50 tracks unmatched, **when** the recipient views the page,
  **then** all 50 rows are present. None is dropped and none is shown as playable.

### R4 — The rebuilt Spotify playlist · from S7, S11 AC 1

- It's created on the Crossfade Spotify account and is public.
- Its name is the Apple Music playlist name exactly, cut to 100 characters, or
  `Untitled playlist` if Apple's name is empty.
- Its description reads `Rebuilt from Apple Music by Crossfade. X of N tracks
  matched.`
- It contains the `exact` and `close` tracks in source order, **duplicates included**.
  Unmatched tracks are left out, and the other tracks keep their order.
- v1 never edits or deletes a playlist after its link has been issued.

### R5 — Open a link (recipient) · from S7 AC 2, S8

- **Given** a valid link, **when** it opens on an iPhone, **then** the page shows the
  playlist name, the report (R3), and one primary button, **Play in Spotify**, linking to
  `https://open.spotify.com/playlist/<id>`.
- **Given** the Spotify app is installed, **when** the recipient taps
  **Play in Spotify** and then play in Spotify, **then** audio plays. That's 3 taps on
  screens Crossfade controls or Spotify's play button: the link, the button, play. Taps
  on Spotify's own "open in app" prompts don't count against this.
- **Android and other browsers:** the page renders and the button links correctly. No
  other behavior is guaranteed (D8).
- **No Spotify app:** the button still goes to `open.spotify.com`. What happens after
  that is up to Spotify, and it isn't tested.
- **A playlist removed on Spotify's side:** v1 doesn't check. The page still renders,
  and the button lands on Spotify's own "not found." This is an accepted gap, since v1
  never deletes (R4).
- The recipient is never asked to log in, enter anything, or allow anything on the
  Crossfade page.
- **Given** the recipient played the playlist and closed Spotify, **when** they open
  their library, **then** no new playlist is in it. (This holds by design, because
  Crossfade has no access to the recipient's account.)
- **Negative — Given** a `/p/<code>` that doesn't exist, **when** it opens, **then** the
  page reads `This Crossfade link doesn't exist.`, not a blank page or a stack trace.

### R6 — Guardrails

- There's one passcode, and it comes from the `SENDER_PASSCODE` environment variable.
  It's sent with each Create link submission, and it's never logged, never stored, and
  never sent back to the browser.
- Spotify credentials (client secret, the Crossfade account's refresh token) and the
  Apple developer token's private key live only on the server.
- **Rate limit:** at most 20 builds per rolling hour, in total. A build counts once it
  passes the passcode and format checks and reaches Apple, whether or not it succeeds.
  Past the limit, the sender sees `Crossfade is rate-limited. Try again in N minutes.`,
  where N is rounded up with a minimum of 1, and no API calls are made.
- Stored per link: code, source URL, playlist name, Spotify playlist id, per-track
  source title/artist/ISRC, match tier, Spotify track id, and creation time. **Nothing
  about the recipient is stored.** No cookies on any page, and no analytics.

## 7. Out of scope

Not in v1. The reasons are why each one is out, not just what.

| Out | Why |
|---|---|
| Spotify → Apple Music | D2. Revisit only if W02/W03 are mostly Apple users. |
| Sender connects Apple Music; private or library-only playlists | D1. A shared link is the input. |
| Recipient connects Spotify; "Save to my library" | D1. They can follow the playlist in Spotify themselves, and that's Spotify's feature, not mine. |
| Fixing a bad match; remembered corrections (S9) | SHOULD. D3 keeps bad matches rare and R3 makes them visible. |
| Segue warnings (S11 AC 2–3) | SHOULD. Plain order is kept (R4), but Free recipients may hit on-demand limits anyway (§9 K4). |
| Collaborative playlists (S10) | Unevidenced. W01 contradicted it. |
| Offline/downloads, size estimates, DJ offline sets (S1, S2, S4) | Real evidence, wrong job (ADR 0003). |
| Buy links (S5), DJ CSV export (S3) | COULD. S3's evidence was withdrawn (ADR 0004). |
| Other regions, sender accounts, history, deleting old playlists, analytics | Nothing in the demo needs them. |
| **Never:** moving audio, controlling crossfade/transitions, synced cross-service playback | Hard constraints in `CLAUDE.md`: DRM, no API, no API. |

## 8. How I'll know it works

1. **The demo test.** The six-shot screen recording in `backlog.md` §5, updated to the
   §4 flow (no connect steps), with a real 25-track playlist and a friend's real phone.
   It passes if audio plays at shot 5 and the library is unchanged at shot 6.
2. **Match-rate benchmark, which answers CB-01.** I run 5 of my own Apple Music
   playlists (at least 150 tracks total) through R2 and check every `close` match by
   hand, along with a sample of 20 `exact` matches (ISRCs can be wrong too). I record
   exact / close / unmatched counts and every wrong match in
   `docs/research/match-benchmark.md`.
   - **Target:** matched ≥ 90%, and wrong matches ≤ 2% of all tracks. A "wrong match"
     is a different song, or a live, sped-up, karaoke, or remix version of a studio
     original.
   - **Below 80% matched, or above 5% wrong:** the concept brief's biggest unknown came
     true. That gets an ADR and a decision about whether S9 moves into MUST, before any
     UI polish.
3. **Evidence.** W02 and W03 are recorded in `docs/research/` by Oct 4 (§3).

## 9. Risks, and what I'll check first

These get checked with throwaway API calls, not app code in `src/`, **by Fri Oct 9**,
so the architecture doc (Oct 11) is built on facts.

**Sequencing.** No code goes in `src/` before Week 9, whatever happens. By then, the
Oct 4 go/no-go (§3) and K1–K3 have decided the path, and the build follows that path
only. If K3 fails, D1, R4, and R5 get rewritten in this document *before* Week 9, not
patched during it. If K2 isn't resolved by Oct 9, that's a repoint decision, not a
reason to build against fake Apple data.

| # | Risk | Check | If it fails |
|---|---|---|---|
| K1 | Apple's API won't return a user-shared `pl.u-` playlist's tracks and ISRCs with just a developer token. Forum reports say it will, via `GET /v1/catalog/us/playlists/{id}`, with catalog songs carrying `attributes.isrc`. | Fetch one of my shared playlists | Record in an ADR. Scraping Apple's web pages is not a fallback. |
| K2 | **Known cost, not a risk:** an Apple developer token needs a MusicKit key, which needs the **$99/yr Apple Developer Program**. There's no individual student waiver. | Ask the instructor or SU IT whether there's a university developer team I can join | Decide by Oct 9: join SU's team, pay $99, or repoint (§3). |
| K3 | **Known cost:** since Mar 2026 a dev-mode Spotify app's owner account must have **Premium**. It's also a gray area whether Spotify's policy allows one app-owned account to make public playlists for other people. It's not explicitly banned, but the Policy bars apps that "replicate a core user experience." | Confirm a Premium account for Crossfade. Reread the Developer Policy. Create one test playlist via `POST /me/playlists`. | If the policy rules it out, fall back to recipient OAuth (rejected in D1), capped at 5 allowlisted friends, with S8's preview-first flow back in scope. |
| K4 | Spotify Free on mobile limits on-demand play to a daily allowance (since Sep 2025), so a Free recipient may hit shuffle or skip caps | Open a test playlist on a Free account | Accept it. Audio still plays. R4 keeps the order even if the listener's tier doesn't honor it. |

## 10. Left to the architecture doc (Oct 11)

These are how-questions, not what-questions. The requirements above don't change
whatever the answers turn out to be:

- how progress reaches the phone (polling vs. server-sent events)
- escaping quotes inside Spotify's `track:"…"` query
- which unit "100 characters" is measured in (Spotify's limit decides)
- how the rate limit and the links are stored

## 11. Changes this PRD makes to the backlog

These go into `backlog.md` in the next commit, so the backlog stays the source of truth.

- **S7 AC 1:** "connected Apple Music account" becomes "a pasted shared playlist link."
  "Under 10 seconds" becomes R1's 15 seconds for 25 tracks, with visible progress.
- **S7 AC 2:** "connects Spotify" is removed. "At least 90% playable" moves out of the AC
  and into the benchmark (§8), because it's a property of the catalog, not a pass/fail
  on one playlist.
- **S7 AC 4:** "never substituted with a different recording" is now testable, defined
  by R2's rules. The reason text becomes `Not found on Spotify (US)`, because v1 can't
  tell "not on Spotify" apart from "not found."
- **S8:** it's satisfied by design (D1). "Save to library" moves out of scope.
- **S6:** it's out of v1. Nobody connects, so there's nothing for a family-plan owner
  to see.
- **MVP slice, shots 1 and 3:** the connect steps are removed.
