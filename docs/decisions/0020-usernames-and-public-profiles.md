# 0020 · Senders pick a username and get a public profile link

**Date.** 2026-11-12
**Status.** Decided. Adds S18 to the holding pen and a `profiles` table to `supabase/schema.sql`.

**Context.** Sign-in works (ADR 0019). The founder wants each sender to have a username and
a profile they can send to people, the way they send a playlist link. Until now the browser
has only read the database with the publishable key. A profile is the first row a signed-in
sender writes themselves.

**Decision.** After the first Google sign-in, Account asks for a username: 3–20 letters,
numbers or `_`, unique regardless of case, and changeable later (old profile links then
stop working). The profile has a display name, an optional bio of up to 160 characters, and
the Google photo. There's no upload. Anyone with the link can see it at `/u/<username>`
without signing in, as with `/p/<code>` (ADR 0006). The email is never shown. Row-level
security lets anyone read profiles and lets each sender insert and update only their own row.
The profile's playlists stay hidden until links move into the database (Phase 10).

**Why not the alternative.** Uploading a photo needs Supabase Storage and its own rules,
for a picture Google already gives us. Profiles visible only to signed-in users would make
the link useless to the friend it's sent to, who never signs in.

**What would change my mind.** W02/W03 show nobody sends profiles, only playlists. Then
the profile page goes, and the username is kept only as a sender name on links.
