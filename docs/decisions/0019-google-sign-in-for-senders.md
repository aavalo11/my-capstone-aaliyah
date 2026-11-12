# 0019 · Senders sign in with Google, and that replaces the passcode

**Date.** 2026-11-12
**Status.** Decided. Changes PRD D7 and R1. Brings S14 into the app. ADR 0006 still holds.

**Context.** D7 gave Crossfade one passcode, because there was only one sender. The founder
wants anyone to be able to use the app with a personal account, and Workshop 5 is about
auth. Every link is still built on Crossfade's one Spotify account (ADR 0006), so whatever
replaces the passcode still has to stop strangers from filling that account.

**Decision.** Senders sign in with Google through Supabase Auth, using the PKCE flow
called with `fetch` (no new library, per ADR 0007). Anyone with a Google account can sign
in. Create asks you to sign in in place of the passcode, and each account can make **10 links
a day**. Recipients still never sign in, and nobody links a Spotify or Apple account
(ADR 0006). Until `create-link` deploys (Phase 10), the sign-in check happens only in the
browser. When it deploys, step 1 of `create-link` checks the Supabase token and the daily
count in place of `SENDER_PASSCODE`.

**Why not the alternative.** Keeping the passcode means one shared secret for every user,
and anyone who has it can use up the whole quota. A magic-link email (the plan in
architecture §9) works too, but it's slower on a phone mid-chat than one Google tap.
**Cost:** a Google Cloud project to look after, and a sign-in step before the first link.

**What would change my mind.** Spotify rate-limits the shared account even at 10 links a
day per person. Then the limit goes down, or new accounts wait for approval.
