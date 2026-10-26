# 0010 · Links live in the browser for the CRUD week

**Date.** 2026-10-26
**Status.** Decided, until Workshop 4 (2026-10-29)

**Context.** The Week 9 CRUD inquiry needs a sender to create, read, rename and delete a
Crossfade link (`docs/features/link-crud.md`). The `links` table is read-only to the
publishable key on purpose (`supabase/schema.sql`, architecture §3), and there's no login
yet to decide whose link is whose.

**Decision.** Links are stored in `localStorage` under `crossfade-links-v1`, through one
shared file, `src/links-store.js`, loaded by both `index.html` and `p.html`. A delete
leaves a tombstone (`code` + `deleted_at`, nothing else) so the friend's page can say
"removed" instead of "doesn't exist". Marked `TODO(W10): real data`.

**Why not the alternative.** Supabase with open writes means granting insert, update and
delete on `links` to the publishable key. With no login, anyone holding the key, which is
public in `src/config.js`, could rename or delete every link. The cloud session that built
this also couldn't reach Supabase (proxy 403), so those writes couldn't have been checked.
**Cost:** the friend's view only works in the same browser that made the link, so the
"text it to a friend" half of Read can't really happen this week.

**What would change my mind.** Workshop 4 connects a real database. Then the store's five
functions (`list`, `get`, `create`, `rename`, `remove`) get swapped for calls to it, and
the checks in `docs/features/link-crud.md` should pass without being edited.
