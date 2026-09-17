# Lab 3 Backlog — Crossfade

**Status:** draft, provisional pending W02/W03
**Last updated:** 2026-09-17

Every story below carries a pointer back to evidence. Stories with no evidence are
kept in a holding pen and are not eligible for MUST until evidence exists.

---

## 1. The job, stated without the app

| ID | Job story | Evidence strength |
|---|---|---|
| **J1** | When I'm somewhere with bad signal, help me already have the music on my phone, so I'm not stuck in silence. | Strong — raised 4x unprompted in W01 |
| **J2** | When I'm DJing an event, help the songs play in the intended order and transition cleanly, so the set doesn't stall between tracks. | Moderate — W01 (DJs at KTP events; transition need from interviewer recall, not notes) |
| **J3** | When I love an artist, help my money reach them instead of renting them. | Moderate — W01 |
| **J4** | When my friends and I listen together, help everyone contribute without first negotiating platforms. | Weak — W01 says "nice to," then declines it |
| **J5** | When I've made a playlist I'm proud of, help my friend actually hear it. | **None yet — founder-sourced** |

J5 is the capstone. It is currently the least-evidenced job on the list. That is the
finding, and the rest of this document is organized around fixing it.

---

## 2. Evidence ledger

| Code | Source | Location | Status |
|---|---|---|---|
| **W01** | Interview 1 — undergrad, Spotify via family plan, DJs at KTP events | `docs/research/interview-01.md` | Conducted 2026-09-10, in person. Notes transcribed verbatim. |
| **SELF-01** | Own observed behaviour — receiving a playlist screenshot | not yet created | **Not logged.** Claimed in `01-concept-brief.md` but never recorded as an observation. |
| **CB-01** | Own logged unknown — catalog match quality | `docs/01-concept-brief.md` line 19 | Written 2026-09-17 |
| **W02** | Person who has had a playlist stranded on the wrong service | `docs/research/interview-02.md` | **Not run** (file is empty scaffolding) |
| **W03** | Second person, same problem | not yet created | **Not run** |

### Evidence hygiene — fix before this is presented

- `41000` in the raw notes is garbled. Do not cite a number that cannot be reconstructed.
  The usable figure from that exchange is 2 hours/day.
- `Titles` in the raw notes is almost certainly **Tidal**. Confirm before quoting.
- `Storage` is a bare word with no claim attached. Recover what was said, or drop S2.
- `Easy to sync with projects` was originally over-read as "export tracklists to DJ
  software." The participant did not say that. Evidence for S3 is withdrawn; ask what
  "projects" meant before citing that line again.
- "DJ Charles" in the raw notes is an in-joke from the conversation, **not the
  participant's name.** No naming-consent question arises; cite as W01.

---

## 3. Stories

Direction note: the founder is on **Apple Music**; the friends she shares with are on
**Spotify**. All sender-side stories are written Apple Music → Spotify to match the
demo she can actually record.

### J1 — Offline / downloading (evidenced)

---

**S1.** As a student commuting with no signal, I want a playlist I received to be fully
downloaded to my phone before I leave, so that I'm not staring at greyed-out tracks on
the train.

**Acceptance criteria**

- [ ] **Given** a 50-track received playlist and a connected account, **when** I tap
  "Make available offline," **then** all 50 tracks are queued in the native app's
  download manager in one action, with no per-track taps.
- [ ] **Given** a download in progress, **when** I view the playlist, **then** I see
  `n of 50 downloaded` updating at least every 5 seconds.
- [ ] **Given** downloads have finished, **when** I enable airplane mode and press play,
  **then** every track plays with no buffering state.
- [ ] **Negative — Given** 200 MB free and a playlist needing 400 MB, **when** I tap
  "Make available offline," **then** nothing downloads and I am told the shortfall in MB
  before any bytes are written.

**Evidence.** W01 — "Painfully slow and it's hard to download songs"; "Wish there were
easier downloading"; "Better downloading abilities."

---

**S2.** As someone with a full phone, I want to see a playlist's offline size before
downloading, so that I can decide what to delete first.

**Acceptance criteria**

- [ ] **Given** any playlist, **when** I open its detail view, **then** estimated offline
  size in MB and current free space are both shown before I commit.
- [ ] **Given** three downloaded playlists, **when** I open "Offline," **then** they are
  listed largest-first with per-playlist MB and a bulk delete that frees space in one
  confirm.
- [ ] **Negative — Given** the service API will not report bitrate, **when** I open the
  detail view, **then** the estimate is labelled approximate with the assumed bitrate
  named — not silently wrong.

**Evidence.** W01 — "Storage" (thin; this story is only as strong as what is recovered
from that note).

---

### J2 — DJ / event (evidenced)

---

**S3.** As the DJ for a KTP event, I want my set list exported as a file my venue
software reads, so that I'm not retyping 40 songs at the booth.

**Acceptance criteria**

- [ ] **Given** a playlist, **when** I export, **then** I get a CSV with artist, title,
  duration, and BPM/key where the source provides them.
- [ ] **Given** the exported file, **when** I import it into Rekordbox or Serato,
  **then** it loads without hand-editing.
- [ ] **Negative — Given** 12 of 40 tracks have no BPM available, **when** I export,
  **then** those cells are empty and the file header states `28/40 with BPM` — no
  invented values.

**Evidence.** **WITHDRAWN 2026-09-17.** Originally cited W01's "Easy to sync with
projects," read as meaning DJ-software export. The participant never said that, and the
meaning of "projects" was not recovered — see `interview-01.md` §5. The real DJ-adjacent
need was about **transitions between songs** (S11), not tracklist export. This story is
now founder-sourced and demoted to COULD. Re-evidence it or cut it.

---

**S4.** As a DJ at a venue with bad Wi-Fi, I want my set list readable and playable with
no connection, so that dead internet doesn't end the event.

**Acceptance criteria**

- [ ] **Given** a set list marked for an event, **when** the device has no network,
  **then** the full tracklist renders and all tracks play from local storage.
- [ ] **Negative — Given** three tracks failed to download before load-in, **when** I
  open the set list offline, **then** those three are visibly flagged as unplayable, so
  I find out at load-in and not mid-set.

**Evidence.** W01 — DJs at KTP events (raw notes), plus repeated download friction, four
mentions (J1 and J2 intersect here). Note the venue-Wi-Fi scenario is inferred, not
stated: he said downloading is hard, not that it has failed him at an event. Confirm.

---

---

**S11.** As someone who DJs at events, I want a rebuilt playlist to keep the order and
segues the original had, so that the set doesn't stall or jump between tracks the way the
original never did.

**Acceptance criteria**

- [ ] **Given** a source playlist in a deliberate order, **when** it is rebuilt in the
  target service, **then** track order is preserved exactly, including duplicates.
- [ ] **Given** two tracks that segue in the source (continuous mix, no gap), **when**
  the playlist is rebuilt, **then** they remain adjacent and in order.
- [ ] **Negative — Given** a segued pair where the second track is unavailable in the
  target service, **when** the playlist is rebuilt, **then** the break is flagged on the
  surviving track ("next track missing — segue broken"), so the DJ finds out before the
  set, not during it.

**Evidence.** W01 §1a — participant wants to "DJ songs and have them transition better."
**Moderate/weak: this is interviewer recall, not in the written notes.** Confirm in
follow-up, and specifically ask whether he means live mixing or in-app crossfade — the
answer changes whether this story is buildable at all (see WON'T).

---

### J3 — Buy vs. rent (evidenced)

---

**S5.** As a listener who thinks streaming underpays artists, I want a purchase link for
tracks I love, so that I can buy the ones that matter instead of only renting them.

**Acceptance criteria**

- [ ] **Given** any track, **when** I open its row, **then** a buy link to Bandcamp or
  the iTunes Store is present when one exists.
- [ ] **Given** such a link, **when** I follow it, **then** it lands on that exact
  release — not a search page.
- [ ] **Negative — Given** no purchase source exists for a track, **when** I open its
  row, **then** no buy affordance appears at all — never a dead link.

**Evidence.** W01 — "Don't pay artists enough"; "Buy instead of rent music."

---

### Account constraint (evidenced; cuts across everything)

---

**S6.** As someone whose parents pay for the family plan, I want to connect my own
account without any change visible to the plan owner, so that using this never becomes a
conversation with my parents.

**Acceptance criteria**

- [ ] **Given** I am a member of a family plan, **when** I connect, **then**
  authorization completes against my own profile with no notification, email, or setting
  change on the owner's account.
- [ ] **Given** I am connecting, **when** I review requested permissions, **then** only
  playlist read and playlist create are requested, each listed in plain language.
- [ ] **Negative — Given** I disconnect, **when** I check within 60 seconds, **then**
  stored tokens are deleted and playlists we created remain in my library, orphaned but
  intact.

**Evidence.** W01 — "Parents pay for Spotify."

---

### J5 — The bridge itself (HOLDING PEN — no evidence yet)

These are the product. They cannot enter MUST until W02/W03 land. They are written now
so that those interviews have something concrete to test.

---

**S7.** As someone on Apple Music who made a playlist, I want to send one link that
opens as a playable playlist in my friend's Spotify, so that they hear it instead of
retyping it from a screenshot.

**Acceptance criteria**

- [ ] **Given** a connected Apple Music account, **when** I pick a playlist and share,
  **then** I get a link in under 10 seconds.
- [ ] **Given** that link, **when** my friend opens it and connects Spotify, **then**
  at least 90% of tracks are playable and playback starts within 3 taps of opening.
- [ ] **Given** a 50-track playlist, **when** matching completes, **then** I see
  `matched 47 of 50` and can read the 3 failures by name before I send.
- [ ] **Negative — Given** a track has no equivalent in the target service, **when** the
  recipient views the playlist, **then** it appears greyed with a reason ("not on
  Spotify in US") — never silently dropped, and never substituted with a different
  recording.

**Evidence.** **NONE.** Founder assumption; the intent is stated in
`01-concept-brief.md` but no observation backs it. Test in W02 Q1.
Match-quality risk is logged as CB-01.

---

**S8.** As a recipient, I want to hear the playlist before anything is written to my
library, so that a shared link can't clutter my account.

**Acceptance criteria**

- [ ] **Given** an opened link, **when** it loads, **then** nothing has been created in
  my library, and "Play now" and "Save to library" are separate, equally available
  actions.
- [ ] **Negative — Given** I play without saving and close the app, **when** I reopen my
  library, **then** no new playlist exists.

**Evidence.** **NONE.** Test in W02 Q3.

---

**S9.** As a recipient looking at a wrong match, I want to swap in the right recording
myself, so that one bad match doesn't make me distrust the whole playlist.

**Acceptance criteria**

- [ ] **Given** a track matched to a sped-up or karaoke version, **when** I tap it,
  **then** I see up to 5 alternates with duration and album shown to disambiguate.
- [ ] **Given** I pick an alternate, **when** the same track appears in a future
  playlist, **then** my correction is reused.
- [ ] **Negative — Given** zero candidates score above threshold, **when** I tap the
  track, **then** I get a manual search box — not an empty list.

**Evidence.** **NONE**, but adjacent to CB-01 (own logged unknown: catalog mismatch on
remixes, live versions, explicit vs. clean). Test in W02 Q4.

---

**S10.** As a friend group split across services, we want one playlist everyone adds to
from their own app, so that nobody has to switch services to join in.

**Acceptance criteria**

- [ ] **Given** a shared playlist, **when** a Spotify member adds a track, **then** it
  appears for Apple Music members within 120 seconds, attributed to the adder.
- [ ] **Negative — Given** two members add the same song from different services within
  the sync window, **when** sync completes, **then** it appears once, not twice.

**Evidence.** W01, **weak and self-contradicting** — "Nice to do playlists and jams with
other music services" versus "He doesn't mind not being able to work with other music
services." Treat as unevidenced.

---

## 4. MoSCoW board

| MUST | SHOULD | COULD | WON'T (+ why not) |
|---|---|---|---|
| S7 — send to playable link *(provisional)* | S9 — fix a bad match | S1 — bulk offline download | Cross-service live "jam" |
| S8 — preview before writing *(provisional)* | S11 — preserve order and segues | S2 — size before download | Moving/uploading downloaded audio |
| S6 — own-account connect, narrow scopes | S10 — collaborative playlist | S5 — buy links | Controlling crossfade / transition timing |
| Honest match report *(S7 AC 3 and 4)* | S4 — offline set list | S3 — DJ CSV export *(evidence withdrawn)* | BPM/key on export |
| | | DJ request intake | Android / web parity |

**MUST — "would you delay launch for this?"** Yes to all four. Without S7 there is no
product. Without S8's preview, the first person who opens a link and finds junk in their
library never opens a second. Without S6 the one real interviewed user cannot connect at
all. Without the honest match report the product silently lies about what your friend is
hearing, which is worse than the screenshot it replaces.

**SHOULD — "could v1 ship without it and still do the job?"** Yes, painfully. A wrong
match is survivable if S7 AC 4 at least *tells* you. S4 and S11 serve J2, which is
better evidenced than anything in MUST, but it is a different job and belongs in v1.1.
Note that plain order preservation is table stakes and is assumed inside S7; what S11
adds beyond that is the broken-segue warning.

**COULD — "would anyone notice if it never arrived?"** S1 and S2 are the best-evidenced
stories in this backlog and they sit in COULD. That is not an error: they serve J1, which
this product does not do. Say so out loud when presenting — it is the sharpest thing on
the board.

**WON'T — and why, because "not now" is a decision, not a deletion:**

- **Live cross-service jam** — no public API exposes playback position on another
  service. Not a scope cut; not buildable this semester.
- **Moving downloaded audio** — DRM-encrypted and license-bound to the account. This was
  W01's own suggestion and it is the one request that has to be refused.
- **Controlling crossfade / transition timing in the recipient's app** — crossfade is a
  client playback setting the listener toggles in their own app. Neither the Spotify Web
  API nor MusicKit exposes it to a third party. If W01's transition comment turns out to
  mean in-app crossfade rather than live mixing, **S11 is not buildable** and only its
  segue-warning half survives.
- **BPM/key on export** — neither Spotify nor Apple exposes it reliably; S3 ships
  without it rather than not shipping.
- **Android / web parity** — one platform demoed well beats two half-built.

---

## 5. MVP slice

Smaller than MUST. Drop S6 (demo on a personal account and note the constraint) and drop
the correction flow entirely.

> **Apple Music → Spotify, one direction, one playlist, read-only preview, honest match
> report, play.**
>
> S7 (one direction only) + S8 (play-now path only) + the match report.

### The screen-record test, shot by shot

1. Founder connects Apple Music, picks a real 25-track playlist. A link appears.
2. Link goes to a friend by text — on camera, unstaged.
3. Friend opens it on their phone and connects Spotify.
4. Screen reads `Matched 23 of 25`, with the 2 failures named on screen.
5. Friend taps play. **Audio comes out of the phone.**
6. Friend closes the app, opens their Spotify library — nothing was added.

Six shots, no narration, no "and then imagine it saves." Step 5 is the whole capstone,
step 4 is what makes it trustworthy, step 6 is what makes it shareable twice.

**Explicitly out of the slice:** reverse direction, save-to-library, match correction,
collaboration, downloads, DJ export, buy links, remembered corrections.

---

## 6. Open work before this board is trustworthy

1. **Close W01's open questions** (`interview-01.md` §7): was "Titles" Tidal, what did
   "Storage" mean, what were the "projects," and does "transition better" mean live
   mixing or in-app crossfade. The last one decides whether S11 is buildable.
2. **Log SELF-01.** It is legitimate evidence only if it actually happened. Record:
   date, what was received, what you did, how many tracks you typed before stopping,
   what you lost by giving up.
3. **Run W02 and W03** with two people who have had a playlist stranded on the wrong
   service. They do not have to want the product. Open with the job, never the app:
   - Tell me about the last time someone sent you music you couldn't just play. What did
     you do next?
   - Walk me through it — did you type them in? How many before you stopped?
   - Did anything get saved to your library that you didn't want? (S8)
   - Has a song ever come through as the wrong version? What did you do? (S9)
   - How many of the people you share music with are on a different service?

   Do not ask "would you use an app that bridges playlists?" That returns "yeah, nice,"
   which is exactly what W01 said, and it is worth nothing.
4. **Re-run this board afterward.** If W02 and W03 come back like W01 — polite,
   unbothered, no story about giving up — the honest move is to move the capstone to J1
   or J2, where evidence already exists.
