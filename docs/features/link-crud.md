# Link CRUD · create, read, rename, delete a Crossfade link

Built 2026-10-26, Week 9 CRUD inquiry. **Evidence: NONE.** Sender-side link management
isn't a backlog story; the closest is S12 (Home history, holding pen, Evidence: NONE).
This is coursework on the shell, not a step toward the MVP slice, and `backlog.md` is
unchanged.

## The instrument (written before building)
```
Create — the sender pastes an Apple Music link and a name, and gets a Crossfade link
Read   — the sender sees her links on Home; the friend opens p.html?code=… and sees that playlist
Update — the sender fixes the playlist name, and the already-texted link keeps working
Delete — the sender removes a link sent by mistake; the friend then sees "removed", not an error
```

## Where the data lives, and why
Browser `localStorage`, key `crossfade-links-v1`, through `src/links-store.js` (ADR 0010).
- `links` in Supabase is read-only to the publishable key on purpose (architecture §3).
  Opening writes with no login would let anyone holding the public key rename or delete
  every link.
- The cloud session doing the build couldn't reach Supabase at all (proxy 403), so those
  writes couldn't have been checked.
- **Cost:** the friend's half of Read only works in the browser that made the link (see R-1).
  Workshop 4 (Oct 29) replaces the store's five functions.

## Checks → results
| # | Verb | Check | Result |
|---|---|---|---|
| C1 | Create | Name + valid US link + passcode, submit | ✅ `p.html?code=3r5iCEtaWw` (10 chars), 1 record, listed on Home |
| C1f | Create (fail) | Bad link; blank name | ✅ `That isn't an Apple Music playlist link.` / `Give the playlist a name.`, 0 records |
| C2 | Read (sender) | Two links | ✅ Both on Home, newest first, `Made Oct 26` |
| C2e | Read (empty/error) | Empty store; `?demo=error` | ✅ `No links yet` / `Couldn't read your links`, 0 rows |
| C3 | Read (friend) | `p.html?code=<code>` | ✅ Name, "Saved on this device only" notice, Play disabled. `code=nope` still says doesn't exist, and `code=sample` still has 6 rows |
| C4 | Update | Rename on Home | ✅ Home and friend page both show `late train home (fixed)`, same code |
| C4f | Update (fail) | Rename to blank | ✅ `Give the playlist a name.`, stored title unchanged |
| C5c | Delete (cancel) | Delete → Cancel | ✅ Confirm text shown, still 2 rows |
| C5 | Delete | Delete → confirm | ✅ Gone from Home; friend sees `This link was removed by whoever sent it.`; other link fine; stored row is `{code, deleted_at}` only |

## Plan (as approved)
- ADR 0010 first.
- New `src/links-store.js` with `list / get / create / rename / remove`, loaded by both
  `index.html` and `p.html`. `p.js` deliberately doesn't load `app.js`, so the store is
  shared rather than copied.
- A delete leaves a tombstone (`code` + `deleted_at`) so the friend's page can say
  "removed" rather than "doesn't exist".
- Create gets a `Playlist name` field. Passcode, then link (PRD R1), then name. The
  result shows the link with a Copy button.
- Home gets `Your links · Saved on this device` above Recently added, which still reads
  Supabase and is untouched. Rename and Delete are inline per row, and Delete asks first.
- `p.js` checks the store before the sample JSON.

## Evidence
Playwright (preinstalled in the cloud container, not added to the repo) against
`python3 -m http.server 8000 --directory src`. The scripts are outside the repo, as with S7.

```
PASS C1f :: link error="That isn't an Apple Music playlist link." | name error="Give the playlist a name." | records=0
PASS C2e :: empty="No links yet…" | error="Couldn't read your links…" rows=0
PASS C1 :: url=http://127.0.0.1:8000/p.html?code=3r5iCEtaWw | records=1 | home rows=["late train home Made Oct 26 Open Rename Delete"]
PASS C2 :: home rows=["study, no words Made Oct 26 …","late train home Made Oct 26 …"]
PASS C3 :: friend="Saved on this device only. …" play disabled=true | nope="This Crossfade link doesn't exist." | sample rows=6
PASS C4 :: home row="late train home (fixed) Made Oct 26 · renamed Oct 26 …" | friend h1 has new name=true | same code=true
PASS C4f :: error="Give the playlist a name." | stored title="late train home (fixed)"
PASS C5c :: confirm="Delete late train home (fixed)? Anyone you sent it to will see it was removed." | rows after cancel=2
PASS C5 :: home rows=["study, no words …"] | friend="This link was removed by whoever sent it." | other link ok=true | stored={"code":"3r5iCEtaWw","deleted_at":"2026-10-26T17:14:22.287Z"}
9/9 passed
```

**The checks can fail.** A scratchpad copy had `rename` never write the name and `remove`
hard-delete with no tombstone. Against it, C4 and C5 fail: the friend sees `doesn't exist`
instead of `removed`. C4f also fails, but only because it expects C4's new name. That's a
weakness: C4f depends on C4, so it isn't an independent check. The repo copy wasn't touched.

## Try to break it
Everything here comes from the break-it run. Nothing was predicted and filled in.

| Verb | What I tried | What happened | Did I have to correct the agent? |
|---|---|---|---|
| Create | **C-1** Double-tap Create | 1 record, but the second tap cleared the result and showed `Enter the passcode.` The link *was* made, and the sender never sees it | _you_ |
| Create | **C-2** Same playlist, same name, twice | 2 links, 2 codes, no warning | _you_ |
| Create | **C-3** Name `<img src=x onerror=alert(1)>` | No script ran; shown literally (`esc()` works) | _you_ |
| Create | **C-4** 150-character name | `maxlength` silently cut it to 100. No message, so the error I wrote never shows | _you_ |
| Create | **C-5** Share-sheet link with spaces and `?ls=1&app=music` | Accepted, trimmed, query string kept | _you_ |
| Create | **C-6** UK link and blank name together | Only the link error shows. The name error appears only after fixing the link | _you_ |
| Read | **R-1** Friend opens the link in another browser | `This Crossfade link doesn't exist.` The friend's half of Read doesn't work off-device (ADR 0010's cost) | _you_ |
| Read | **R-2** Trailing `.` from Messages; lowercased code | Both: `doesn't exist`. Codes are case-sensitive and nothing trims punctuation | _you_ |
| Read | **R-3** Home open in tab A, link made in tab B | Tab A still shows 1 row until reload | _you_ |
| Read | **R-4** Saved data corrupted | Home: `Couldn't read your links`. Create: `Something went wrong. Nothing changed.` Every old link is unreachable and nothing can be made until the data is cleared | _you_ |
| Update | **U-1** Rename in tab A after tab B deleted it | Tab A silently shows `No links yet`. The `not-found` message I wrote is thrown away because the row it belongs to is gone | _you_ |
| Update | **U-2** Open Rename, Save unchanged | Row now says `renamed Oct 26` though nothing changed | _you_ |
| Update | **U-3** Start renaming one link, tap Rename on another | The first row's half-typed name is lost without warning | _you_ |
| Update | **U-4** Escape to back out | Nothing happens; still editing | _you_ |
| Update | **U-5** Rename while the friend has the page open | Friend keeps the old name until they reload | _you_ |
| Delete | **D-1** Delete, then Back to the friend page | Chromium re-ran the page and showed `removed`. Not tried in Safari, where back/forward cache may show the old page | _you_ |
| Delete | **D-2** Delete by mistake, then re-create | New code. The old texted link stays `removed` forever, and there's no undo | _you_ |
| Delete | **D-3** Two tabs both confirm delete | Second tab silently shows `No links yet` (same swallowed error as U-1) | _you_ |
| Delete | **D-4** Sender clears website data | Friend sees `doesn't exist`, not `removed`. The tombstone went too | _you_ |
| Delete | **D-5** Someone else holding the phone | Delete is right there, no passcode asked | _you_ |

Fill the last column with what *you* corrected. So far you picked the four lines and the
storage from options I offered. Nothing in this table has been fixed yet.

## What I corrected
- _(yours to write)_ Agent-side, for honesty: the check harness had two bugs of its own.
  Navigating to the same `#/home` didn't re-render, and "Back" landed on `about:blank`.
  Both were fixed in the scripts, not the app, and both cost a rerun.

## Wanted login here (keep for D10)
The sender's login only. The recipient never logs in (ADR 0006).
1. **Create** asks for a passcode that nothing checks: the browser only checks it isn't
   empty. It's a login-shaped placeholder.
2. **Rename/Delete** are open to anyone holding the device (D-5).
3. **"Your links"** really means "links in this browser". On a shared iPad, everyone's
   links mix.
4. **Read off-device (R-1)** needs a server. Once links are on a server, "who may rename
   or delete this row" needs an owner, and that's auth.
5. **Recently added** (Supabase) lists every link from everyone. Whose are whose?
6. **D-4** clearing site data loses every link. An account would keep them.

## The question: which verb was hardest, and why?
_(yours to write)_ Name one verb and cite rows from the table above. Say whether it was
hard to specify, hard for the agent to build, or only hard once you tried to break it.

## Left for later
- `TODO(W10): real data`: `links-store.js` gets replaced at Workshop 4.
- The bugs in the break-it table are recorded, not fixed: C-1, C-4, C-6, R-2, U-1/D-3,
  U-2, U-3, U-4.
- Check scripts live outside the repo. Move them into `tests/` with S7's.
- Architecture §9's table doesn't list Your links yet.
