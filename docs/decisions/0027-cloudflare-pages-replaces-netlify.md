# 0027 · Cloudflare Pages replaces Netlify

**Date.** 2026-11-19
**Status.** Decided. Supersedes ADR 0008's choice of host. The `/p/<code>` rewrite stays.

**Context.** Netlify's free plan ran out of credits on 2026-11-19 and paused production
deploys. The site stayed up on the 2026-11-16 version (`4368d5f`), so three pushed commits
(ADR 0024–0026) never reached it.

**Decision.** Cloudflare Pages serves `src/` from `main`, with no build step:
https://crossfade-e0a.pages.dev. `_redirects` now targets `/p` and `/u`, because Pages
answers `/p.html` with a 308 to `/p` and drops the code. Supabase's Site URL and Redirect
URLs list the new address.

**Why not the alternative.** Vercel needs its own `vercel.json`; GitHub Pages can't rewrite
(ADR 0008). Paying Netlify was possible. **Cost:** a new URL, so links already sent from
the Netlify site keep showing the old version, and the free plan caps builds at 500 a month.

**What would change my mind.** Cloudflare starts metering static requests, or the Messages
preview test for `/p/<code>` fails here.
