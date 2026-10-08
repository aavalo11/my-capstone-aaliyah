# 0007 · Supabase and plain HTML

**Date.** 2026-10-08
**Status.** Decided, pending the three stack challenges in class

**Context.** `docs/design/requirements.md` lines 8–10 need three things whichever version
of Crossfade ships: server code that keeps the Apple and Spotify keys secret, storage
that keeps a `/p/<code>` link working for days, and one web address that works in the
iPhone browser that opens from Messages (PRD D8).

**Decision.** "I'm building Crossfade with Supabase and plain HTML, because I need
somewhere to run code that keeps my Apple and Spotify keys secret and somewhere to store
links that keep working, and I don't need a framework for four screens." One responsive
site serves both phone and laptop. There is no separate phone app.

**Why not the alternative.** Firebase needs the paid Blaze plan before a function can
call Apple or Spotify. Next.js brings a framework and still needs a database added.
FastAPI or Django means hosting and patching my own server, and free hosts often wipe
local files. Streamlit can't give a clean `/p/<code>` page on a phone. Supabase also
works for both answers to ADR 0006: v1 uses a table and one Edge Function, and the
account version adds Auth and row-level security without me building them.

**What would change my mind.** If the Week 9 spike shows one Edge Function can't finish
Apple → 100 Spotify searches → playlist creation inside its time limit, then matching
moves to a queue or another host, and the front end stays.
