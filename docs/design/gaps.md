# Gaps list — full-coverage prototype

Found 2026-10-01 by drawing every non-Won't story in `docs/backlog.md` as a static
prototype (`docs/design/prototype/`). Each line names the story. Feeds the PRD revision
and the architecture doc (Oct 11).

## Story was wrong

- **S1, S2.** ACs assume "a connected account" and the native app's download manager.
  ADR 0006 says nobody connects, and a web page can't drive Spotify's downloads. Not
  buildable as written.
- **S10.** "Everyone adds from their own app" requires every member to connect an
  account. Contradicts ADR 0006.
- **S9 AC1.** Swapping a match edits the shared Spotify playlist for everyone holding the
  link. PRD R4 says v1 never edits a playlist after the link is issued.
- **S9 AC2.** "Correction is reused in a future playlist" needs to know who the recipient
  is. PRD R6 stores nothing about the recipient.
- **S11 AC2–3.** "Two tracks that segue in the source" — neither Apple nor Spotify
  exposes segue data, so there's nothing to detect.
- **S3.** Evidence withdrawn (ADR 0004) but still in COULD, so it had to be drawn.
  Re-evidence it or move it to Won't.

## Story was silent

- **S7.** Nothing says what the sender sees after Copy link, whether they can find the
  link again, or how to discard a bad one before sending.
- **S7.** Nothing says what happens if the sender leaves the page mid-build.
- **S7, S8.** The sender's name ("Aaliyah sent you this") is the recipient's main trust
  signal. No story asks for it and PRD R6 stores no sender name.
- **S5, S9.** Both claim the same tap on a track row. S5 also doesn't say whose screen
  it's on or which store comes first. The recipient-view brief removed Buy entirely, so
  S5 now has no entry point.
- **S9.** Nothing says what's shown about the source recording, which the recipient needs
  in order to pick the right alternate.
- **S6.** Nothing says where connecting sits in the flow. AC3 (disconnect) needs a
  settings screen no story asks for.
- **S4, S11, S3.** Nothing says how a playlist becomes "a set list marked for an event,"
  so the DJ screen has no entry point.
- **S7 (recipient).** Free-tier recipients may get shuffle (PRD K4). Nothing warns them,
  which breaks "know what you'll hear."
- **S10.** Nothing says how people join, who owns the group, or who can remove a song.

## No story at all

- **Link doesn't exist.** A whole screen (`missing.html`) that comes from PRD R5 only.
- **Messages link preview.** The recipient's first impression happens before the page
  opens. Nothing covers what it says.
- **Finding the Create page.** Nothing says how the sender gets to Crossfade — bookmark,
  home screen, share sheet.
- **Running time on the recipient view.** Added by the brief ("know what you'll hear");
  no story asks for it.
- **DJ request intake.** On the COULD board with no story behind it. Not drawn.
- **My expectations vs. my backlog.** I pictured connecting accounts, QR codes, sharing
  albums, and playing music together. No story covers accounts (S6 is out of v1), QR
  codes, or albums — every story says playlist. Live listening together is a Won't and a
  hard constraint in `CLAUDE.md`. The app I picture and the app my backlog describes are
  different apps. Decide which one is real before the architecture doc.

## My corrections from the click-through

<!-- Add each correction here as you make it, then move it into a section above:
     wrong = my story said it and I disagree; silent = my story didn't say. -->
