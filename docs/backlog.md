# Lab 3 Backlog — one hub for multiple music services

**The product.** One app that connects the music services I already use, so my
libraries, playlists, and downloads live in one place instead of being split
across apps.

> **Note on scope.** `docs/01-concept-brief.md` currently describes a narrower
> product (a playlist bridge between two services). This backlog is written for
> the broader hub. The brief needs updating to match.

## Evidence sources

| Key | Source |
|-----|--------|
| **I-01** | Interview 01, one participant — `docs/research/interview-01.md` |
| **OBS** | My own observed behaviour — `docs/research/product-reflection-music-app.md` |

**Evidence strength, stated honestly.** We had one interviewee and the interview
was limited, so the evidence base is thin by acknowledged choice. Of the 12
stories below:

- **4 are MODERATE** — a real quote, with me interpreting the fix (S1, S3, S4, S5)
- **2 are THIN** — stretching a quote or a one-word mention (S8, S9)
- **3 are NONE** — my inference, no person said this (S2, S6, S7)
- **3 in Won't are STRONG** — the best-evidenced items are the ones I can't build

Every NONE is labelled in place. They are not disguised as user requests.

---

## MUST

### S1. Find a song without checking each app first

**Story.** As someone with music spread across more than one service, I want one search that covers all of them, so I stop opening two apps to find out who has a song.

**Acceptance criteria**
- [ ] Given two connected services, When I search a song title, Then results show matches from both, each labelled with the service it came from.
- [ ] Given a song only one service carries, When I search it, Then it appears once, attributed to that service — not duplicated as a phantom entry for the other. *(negative)*
- [ ] Given one service is unreachable, When I search, Then results from the reachable service still display and the failed service is shown as unavailable rather than returning silently empty. *(negative)*

**Evidence.** I-01 — "sync music apps together to play songs together."
**Strength: MODERATE.** He named the goal; the search-based fix is my interpretation.

---

### S2. Play a song without caring which service has it

**Story.** As someone who doesn't want to think about subscriptions mid-listen, I want to hit play and have the hub use whichever connected service can play it, so the split between my apps stops being my problem.

**Acceptance criteria**
- [ ] Given a song available on one connected service, When I press play, Then it plays without me choosing a service first.
- [ ] Given a song available on both services, When I press play, Then the hub picks one by a stated rule and shows which it used.
- [ ] Given a song no connected service can play, When I press play, Then I get told it is unplayable and why — it never fails silently or shows a stuck loading state. *(negative)*

**Evidence.** NONE. My inference about what a hub has to do.
**Strength: NONE.** This is the central story of the product and no one asked for it. Interview 02 should test whether service-switching is actually felt as friction.

---

### S3. Download a whole playlist in one action

**Story.** As someone who wants music offline before leaving the house, I want to send a full playlist to download in one action and keep using the app while it runs, so downloading isn't something I babysit.

**Acceptance criteria**
- [ ] Given a playlist of 30 songs, When I choose download, Then all 30 queue from a single action and the queue shows progress per song.
- [ ] Given a download queue is running, When I browse or play other music, Then the app stays responsive and playback does not stutter. *(negative)*
- [ ] Given I cancel mid-queue, When I check the queue, Then already-finished songs remain downloaded and only pending ones are cleared. *(negative)*

**Evidence.** I-01 — "hard to download," "wish there were easier downloading."
**Strength: MODERATE.** The complaint is direct and emphatic. Reading it as *effort and babysitting* rather than *raw speed* is my interpretation — and it's the part I can actually build.

---

### S4. One offline library across services

**Story.** As someone with downloads in more than one app, I want a single offline view of everything I have available, so I know what I can play with no signal without opening each app to check.

**Acceptance criteria**
- [ ] Given songs downloaded through the hub from two services, When I open the offline view, Then all of them are listed in one place with their source service shown.
- [ ] Given I am in airplane mode, When I play from the offline view, Then playback starts with no network request.
- [ ] Given a song appears in the offline view but its underlying file is gone or expired, When I play it, Then it is marked unavailable rather than failing as a silent skip. *(negative)*

**Evidence.** I-01 — his own unprompted idea: "having downloaded songs and some other app allows you to upload them."
**Strength: MODERATE.** He raised it himself, which makes it the best-evidenced buildable story here.

> **Feasibility risk — read before committing to this.** Files downloaded inside
> Apple Music or Spotify are DRM-encrypted and cannot be read, moved, or pooled
> by another app. A hub can only build an offline library from downloads *it*
> owns, and only where a service's terms allow offline caching by third parties.
> Confirm what each API permits before Week 7. This could invalidate the whole
> download half of the product, which makes it a stronger CP-M1 unknown than
> anything currently written there.

---

## SHOULD

### S5. Interrupted downloads pick themselves back up

**Story.** As someone who downloads on unreliable campus wifi, I want failed downloads to retry on their own, so a dropped connection doesn't mean starting the whole thing again.

**Acceptance criteria**
- [ ] Given a download fails from a dropped connection, When the connection returns, Then it resumes or restarts automatically without me finding it manually.
- [ ] Given a download has failed three times, When I open the queue, Then it is shown as failed with a reason and is not retried endlessly in the background. *(negative)*
- [ ] Given a partial download exists, When it resumes, Then no duplicate entry is created in my library. *(negative)*

**Evidence.** I-01 — "painfully slow," "hard to download."
**Strength: MODERATE** on the complaint, but note he never defined "slow," so this is my guess at which part hurt.

---

### S6. Add a third service without breaking what I set up

**Story.** As someone who might switch or add services later, I want to connect another one without redoing my setup, so the hub survives me changing where I listen.

**Acceptance criteria**
- [ ] Given two services connected, When I connect a third, Then existing playlists, offline library, and settings remain intact.
- [ ] Given I disconnect a service, When I open my library, Then its songs are marked unavailable rather than vanishing without explanation. *(negative)*
- [ ] Given I reconnect a service I removed, When it finishes connecting, Then its content becomes available again without duplicating entries. *(negative)*

**Evidence.** NONE. My inference from the vision of connecting *multiple* apps.
**Strength: NONE.** Defensible as architecture, not as a user request. Argue it as a precondition of "multiple," not as a feature.

---

### S7. Know which service is playing

**Story.** As someone using several services through one app, I want to see which one a song is playing from, so I can tell what I'd lose if I cancelled a subscription.

**Acceptance criteria**
- [ ] Given a song is playing, When I look at the player, Then the source service is visible without opening a menu.
- [ ] Given a song's source becomes unavailable mid-session, When playback moves to another service, Then the displayed source updates rather than showing the old one. *(negative)*

**Evidence.** NONE. Mine, prompted by S2 — once the hub hides the service, you can no longer see it.
**Strength: NONE.** Cut this if you need to get to 11 stories.

---

## COULD

### S8. Playlists grouped by situation, across services

**Story.** As someone who keeps different playlists for different situations, I want them grouped by situation regardless of which service they live on, so picking music matches how I actually think about it.

**Acceptance criteria**
- [ ] Given playlists on two services, When I group by situation, Then one group can contain playlists from both.
- [ ] Given a playlist is in no group, When I browse by group, Then it is still reachable from an ungrouped view rather than disappearing. *(negative)*

**Evidence.** OBS — "I have a bunch of different playlists for different scenarios."
**Strength: THIN** as a product need. It describes how I organise music; it does not establish that current grouping is a problem.

---

### S9. See what my downloads are using

**Story.** As someone who runs out of phone storage, I want to see what the hub has downloaded and how much space it takes, so I can clear things without deleting blindly.

**Acceptance criteria**
- [ ] Given downloaded music, When I open storage, Then total size is shown broken down by playlist or service.
- [ ] Given I delete a downloaded playlist, When I check storage, Then the reported figure decreases by at least the size shown for it. *(negative — guards against a display that never updates)*

**Evidence.** I-01 — "storage," a single word with no surrounding context.
**Strength: THIN.** My own discovery log flagged this one as too vague to build on. Kept only because storage pressure is a plausible consequence of S3 and S4. Cut it if challenged.

---

## WON'T — this semester

### S10. Make downloads actually transfer faster
**Evidence.** I-01 — "painfully slow." **Strength: STRONG,** the most emphatic thing he said.
**Why not.** Transfer speed belongs to each service's own servers and CDN. A hub cannot change it. S3 and S5 address the parts I *can* control — batching, backgrounding, and retry — and it is worth being able to say out loud why those are different from this. Also, "slow" was never defined, so there is no pass/fail I could write.

### S11. Buy songs outright instead of subscribing
**Evidence.** I-01 — "buy instead of rent music." **Strength: STRONG.**
**Why not.** Needs label licensing and a payments system. Out of reach in a semester, and a different product from a hub.

### S12. Show whether artists are paid fairly
**Evidence.** I-01 — "don't pay artists enough." **Strength: STRONG.**
**Why not.** Per-stream royalty data isn't published anywhere I can access. I would be inventing numbers, which is worse than leaving it out.

---

## The board

| MUST | SHOULD | COULD | WON'T (+ why) |
|------|--------|-------|---------------|
| S1 One search across services | S5 Downloads auto-resume | S8 Playlists grouped by situation | S10 Faster transfer — not my infrastructure |
| S2 Play without picking a service | S6 Add a third service safely | S9 Storage breakdown | S11 Buy songs — licensing + payments |
| S3 Download a playlist in one action | S7 Show playing source | | S12 Artist pay — no data access |
| S4 One offline library | | | |

---

## MVP slice

**Connect two services → S1 → S2.**

Connect Apple Music and Spotify, search one song, press play, hear it play from
whichever service has it.

That is smaller than the Must column on purpose. It is screen-recordable with
nothing imagined: two real connections, a real search returning results from
both, one real song playing with its source shown. The job — *find and play
music without caring which app it lives in* — is done start to finish.

**Downloads are slice 2** (S3 → S4), deliberately excluded. They are half the
product vision but they carry the DRM risk in S4, and the demo must not depend
on the riskiest unknown.

---

## Evidence gaps

1. **One interviewee, limited interview.** Accepted for this lab, but it means
   S2 — the central story — has no human evidence at all.
2. **Interview 02 is empty** (`docs/research/interview-02.md`). The single
   highest-value question to ask: *do you notice which app a song is in, and
   does it ever stop you?* That is what S2 stands or falls on.
3. **"Slow" is still undefined.** Until someone says what slow means to them,
   S3 and S5 are guesses about which part of downloading hurt.
4. **The DRM question in S4 is unanswered** and can invalidate the download half
   of the product. It belongs in the CP-M1 unknown.
