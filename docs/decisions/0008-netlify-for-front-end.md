# 0008 · Netlify hosts the front end

**Date.** 2026-10-16
**Status.** Decided

**Context.** `/p/<code>` has to be a real URL that returns a `200`, because Messages link
previews may treat a `404` as broken (PRD R1, R5, D8). Supabase holds the function and
the database (ADR 0007), but `src/` still needs a static host.

**Decision.** Netlify serves `src/` from the GitHub repo with one `_redirects` rule:
`/p/*  /p.html  200`. A status-200 rewrite keeps `/p/<code>` in the address bar and
serves `p.html`. Every deploy comes from a push to `main`.

**Why not the alternative.** GitHub Pages can't rewrite, and its `404.html` workaround
returns a 404 status. Supabase Storage serves files, not routing rules. Cloudflare Pages
and Vercel can both do the rewrite, so this is close: Netlify wins because the rewrite is
one documented line, and it was already the lean in architecture §8.
**Cost:** that's one more account and dashboard, deploys depend on a third service, and
free-tier limits are Netlify's to change.

**What would change my mind.** If the Week 9 test shows Netlify's free tier can't serve
`/p/<code>` with a 200 and a working Messages preview, I'll switch to Cloudflare Pages,
which uses the same `_redirects` format, so only the host changes.
