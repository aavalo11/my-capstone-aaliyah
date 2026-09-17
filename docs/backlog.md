# Lab 3 Backlog — Crossfade

Playlist bridge between Apple Music and Spotify. See `docs/01-concept-brief.md`.

## Evidence sources

| Key | Source |
|-----|--------|
| **I-01** | Interview 01, one participant — `docs/research/interview-01.md` |
| **OBS** | My own observed behaviour, logged in `docs/research/product-reflection-music-app.md` |
| **NONE** | No evidence yet. My inference, not something a person said. Cut or ground it. |

Each story below carries an evidence strength so the weak ones are visible
rather than hidden:

- **STRONG** — a direct quote asking for this
- **MODERATE** — a direct quote, but I'm interpreting what the fix is
- **THIN** — the participant hedged, or I'm stretching the quote
- **NONE** — no person said this

---

## MUST

### S1. Send a playlist to someone on the other service

**Story.** As someone whose friends are split between Apple Music and Spotify, I want to send a playlist that rebuilds itself in their app, so we can trade music without either of us switching services.

**Acceptance criteria**
- [ ] Given a playlist of 20 songs on Apple Music and a connected Spotify account, When I run a transfer, Then a Spotify playlist exists with the same name and 20 track slots accounted for.
- [ ] Given a playlist containing a song unavailable on the target service, When the transfer runs, Then the remaining songs still transfer and the unavailable song is listed as skipped — it is never silently dropped. *(negative)*
- [ ] Given the target account's authorisation has expired, When I start a transfer, Then it stops with a re-connect prompt and creates no partial playlist on the target service. *(negative)*

**Evidence.** I-01 — "sync music apps together to play songs together" and "nice to do playlists and jams with other music services."
**Strength: THIN.** Same participant also said "he doesn't mind not being able to... but it could be nice to do." This is the core story of the product and its evidence is a hedge. **This is the thing to fix in your next interview.**

---

### S2. See what didn't match before I send it

**Story.** As someone sending a playlist I care about, I want to see which songs matched badly before anything is final, so I don't hand someone a playlist full of wrong versions.

**Acceptance criteria**
- [ ] Given a transfer has been prepared, When I open the match report, Then every song shows as exact match, uncertain match, or not found, with the matched title and artist visible for each.
- [ ] Given a song matched to a different version (live, remix, or clean vs. explicit), When I view the report, Then that song is flagged uncertain rather than shown as an exact match. *(negative)*
- [ ] Given I reject an uncertain match, When I confirm the transfer, Then that song is omitted from the target playlist and recorded as rejected.

**Evidence.** NONE. This came from my own concern about catalogue mismatch in the CP-M1 unknown, not from a person.
**Strength: NONE.** Defensible as a design response to a real technical risk, but no one asked for it. Either ground it by showing someone a bad transfer and logging their reaction, or drop it to Should.

---

### S3. Transferred playlists keep their song information

**Story.** As someone moving a playlist between apps, I want titles, artists, and order to carry over, so the playlist arrives usable instead of as a pile of songs.

**Acceptance criteria**
- [ ] Given a playlist with a set track order, When it arrives on the target service, Then the track order matches the source exactly.
- [ ] Given a song whose title differs across catalogues by punctuation or featured-artist formatting, When it transfers, Then it is still matched to the correct recording.
- [ ] Given a transfer completes, When I compare source and target, Then no song has been matched to a track by a different primary artist. *(negative)*

**Evidence.** I-01 — his own idea about moving downloaded songs: "having downloaded songs and some other app allows you to upload them." My own acceptance note from the discovery log was "song info like title and artist carries over."
**Strength: MODERATE.** He raised the underlying need himself.

---

## SHOULD

### S4. Connect and disconnect my own accounts

**Story.** As someone handing a tool access to my music library, I want to connect each service myself and revoke it later, so I'm not permanently granting access to my library.

**Acceptance criteria**
- [ ] Given I have connected both services, When I return to the app later, Then both remain connected without re-entering credentials.
- [ ] Given I disconnect a service, When I attempt a transfer involving it, Then the transfer is blocked with a prompt to reconnect, and no cached token is used. *(negative)*
- [ ] Given I decline the permission prompt on the service's own login screen, When I return to the app, Then the account shows as not connected and no partial connection is stored. *(negative)*

**Evidence.** NONE directly. Mechanism required by S1 rather than a user request.
**Strength: NONE.** Kept because nothing works end to end without it — argue it as a precondition of the job, not as a feature. Do not write this up as "as a user I want to log in."

---

### S5. Label playlists by occasion and switch them fast

**Story.** As someone playing music for other people at an event, I want playlists labelled by occasion and switchable in a couple of taps, so I can change the vibe without stopping to search.

**Acceptance criteria**
- [ ] Given playlists labelled by occasion, When I filter by a label, Then only playlists with that label are shown.
- [ ] Given music is currently playing, When I switch to another labelled playlist, Then playback moves to the new playlist in two taps or fewer.
- [ ] Given a playlist has no label, When I filter by any label, Then it does not appear in the results. *(negative)*

**Evidence.** I-01 — mentioned playing music at events; OBS — I keep separate playlists for different scenarios (homework, working out, relaxing).
**Strength: THIN** for I-01 (no specific tool or process was ever described), **MODERATE** for OBS (my own logged behaviour).

---

### S6. Move my offline songs to the other app

**Story.** As someone with music downloaded in one app, I want those songs available offline in the other app, so I'm not locked to one service by my own download history.

**Acceptance criteria**
- [ ] Given a set of songs downloaded in the source app, When I move them, Then each is available for offline playback in the target app.
- [ ] Given a song that the target service does not carry, When I attempt the move, Then it is reported as unavailable rather than appearing as a broken entry. *(negative)*
- [ ] Given the move completes, When I play a moved song in airplane mode, Then it plays without a network connection.

**Evidence.** I-01, his own unprompted idea — "having downloaded songs and some other app allows you to upload them / sync music apps together to play songs together."
**Strength: MODERATE.** He volunteered this, which makes it better evidenced than S1. **Worth considering whether this, not playlist sharing, is your real MVP.** Note it may be blocked by DRM — that is a feasibility question, not an evidence question.

---

## COULD

### S7. Reuse a playlist as a template

**Story.** As someone who runs similar events repeatedly, I want to start a new playlist from a previous one, so I don't rebuild the same set every time.

**Acceptance criteria**
- [ ] Given a past playlist, When I create a new one from it as a template, Then the new playlist contains the same songs and is independently editable.
- [ ] Given I edit the new playlist, When I open the original, Then the original is unchanged. *(negative)*

**Evidence.** I-01, event mentions; my own discovery-log acceptance note about reusing a playlist as a template.
**Strength: THIN.** He never described doing this.

---

### S8. Listen together across platforms

**Story.** As someone whose friends use a different service, I want a shared listening session that works across both, so we can listen to the same thing at the same time.

**Acceptance criteria**
- [ ] Given two people on different services in one session, When the host plays a song, Then both hear the same song, each through their own service.
- [ ] Given a song is missing from one participant's service, When it plays, Then that participant is told it was skipped for them rather than being silently dropped from the session. *(negative)*

**Evidence.** I-01 — "nice to do playlists and jams with other music services."
**Strength: THIN,** and explicitly hedged as a nice-to-have in the same breath.

---

### S9. Background playlists for working

**Story.** As someone who plays music while doing homework, I want a playlist that suits background listening, so I can start music without it pulling my attention.

**Acceptance criteria**
- [ ] Given I pick a background playlist, When it plays, Then it continues without requiring interaction for at least an hour.
- [ ] Given a song that breaks the mood (large volume or energy jump), When the playlist is generated, Then that song is not included. *(negative — needs a measurable definition before this is testable)*

**Evidence.** OBS — "The last time I used it, I just wanted some background music while I was doing homework."
**Strength: MODERATE** as behaviour, but the second criterion is not yet measurable. Fix or cut it.

---

## WON'T — this semester

Every item here has **stronger evidence than most of the Must column.** That is the honest finding of this backlog: the loudest problems are ones I can't build.

### S10. Faster, easier downloads
**Evidence.** I-01 — "painfully slow," "hard to download," "wish there were easier downloading." **Strength: STRONG** — the most emphatic thing the participant said.
**Why not.** Download speed is Apple Music's and Spotify's own infrastructure. I have no access to it and nothing I build changes it. Also, "slow" was never defined, so there is no pass/fail I could write.

### S11. Buy songs outright instead of renting
**Evidence.** I-01 — "buy instead of rent music." **Strength: STRONG.**
**Why not.** Requires label licensing deals and a payments system. Out of reach for a one-semester project, and it is a different product from a playlist bridge.

### S12. Show whether artists are paid fairly
**Evidence.** I-01 — "don't pay artists enough." **Strength: STRONG.**
**Why not.** Royalty split data isn't published in any form I can access per-stream. I would be inventing numbers, which is worse than omitting the feature.

---

## The board

| MUST | SHOULD | COULD | WON'T (+ why) |
|------|--------|-------|---------------|
| S1 Send playlist cross-service | S4 Connect/disconnect accounts | S7 Playlist as template | S10 Faster downloads — not my infrastructure |
| S2 Match report before sending | S5 Label + switch by occasion | S8 Cross-platform listening | S11 Buy songs — licensing + payments |
| S3 Song info carries over | S6 Move offline songs | S9 Background playlists | S12 Artist pay transparency — no data access |

---

## MVP slice

**S4 → S1 → S2 → S3.** Connect both accounts, pick one playlist, transfer it, review the match report, confirm, and open the finished playlist in the target app.

Screen-recordable end to end: connect two accounts on camera, pick a real playlist, show the match report catching a wrong version, confirm, then open the target app and play the transferred playlist. Nothing in that demo requires saying "and then imagine it saves."

S5–S9 are all excluded from the slice. None is needed to demonstrate the job once.

---

## Evidence gaps to close

1. **Only one interview exists.** `docs/research/interview-02.md` is empty. The lab asks for two people with the same problem.
2. **The core story (S1) rests on a hedge.** The one participant said he doesn't mind not being able to share across platforms. Interview 02 needs to either confirm a real cross-service sharing pain or this product needs repointing — possibly to S6, which he raised himself.
3. **Two stories (S2, S4) have no human evidence.** Both are mine. S2 answers a real technical risk; S4 is a precondition. Ground or cut them.
4. **The CP-M1 brief claims I screenshot track lists and paste song links.** I did not log that behaviour — it was extrapolated. Either confirm it as observed behaviour with a date or remove it from the brief.
