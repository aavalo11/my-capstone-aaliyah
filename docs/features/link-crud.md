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
`python3 -m http.server 8000 --directory src`. The checks are now in `tests/e2e/link-crud.js`
(ADR 0011); `node tests/e2e/run.js` runs them.

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
| Create | **C-1** Double-tap Create | 1 record, but the second tap cleared the result and showed `Enter the passcode.` The link *was* made, and the sender never sees it | **Yes.** You asked for the break-it bugs to be fixed. Create now stays off until you type again (F-C1) |
| Create | **C-2** Same playlist, same name, twice | 2 links, 2 codes, no warning | **Yes**, same request. A second link is still allowed, but it now says `You already had a link for this playlist (…)` (F-C2) |
| Create | **C-3** Name `<img src=x onerror=alert(1)>` | No script ran; shown literally (`esc()` works) | No |
| Create | **C-4** 150-character name | `maxlength` silently cut it to 100. No message, so the error I wrote never shows | **Yes.** `maxlength` removed; the field keeps all 150 and says `Keep the name to 100 characters or fewer.` (F-C4) |
| Create | **C-5** Share-sheet link with spaces and `?ls=1&app=music` | Accepted, trimmed, query string kept | No |
| Create | **C-6** UK link and blank name together | Only the link error shows. The name error appears only after fixing the link | **Yes.** All field errors show at once. Focus goes to the first in PRD R1 order (F-C6) |
| Read | **R-1** Friend opens the link in another browser | `This Crossfade link doesn't exist.` The friend's half of Read doesn't work off-device (ADR 0010's cost) | Not fixable here. Needs the real database (Workshop 4) |
| Read | **R-2** Trailing `.` from Messages; lowercased code | Both: `doesn't exist`. Codes are case-sensitive and nothing trims punctuation | **Half.** Junk characters are now stripped, so `code.` and `code)` open (F-R2). Lowercase still fails: codes use both cases (architecture §6), and changing that is an ADR, not a bug fix |
| Read | **R-3** Home open in tab A, link made in tab B | Tab A still shows 1 row until reload | **Yes.** Home redraws when another tab changes the saved links (F-R3) |
| Read | **R-4** Saved data corrupted | Home: `Couldn't read your links`. Create: `Something went wrong. Nothing changed.` Every old link is unreachable and nothing can be made until the data is cleared | **Partly.** Create now says `Couldn't read the links saved on this device, so nothing was saved.` (F-R4). There's still no way to recover or clear the data from the page |
| Update | **U-1** Rename in tab A after tab B deleted it | Tab A silently shows `No links yet`. The `not-found` message I wrote is thrown away because the row it belongs to is gone | **Yes.** It now shows `That link was already deleted, maybe in another tab.` above the list (F-U1) |
| Update | **U-2** Open Rename, Save unchanged | Row now says `renamed Oct 26` though nothing changed | **Yes.** Saving the same name changes nothing (F-U2) |
| Update | **U-3** Start renaming one link, tap Rename on another | The first row's half-typed name is lost without warning | **Yes.** Other rows' Rename and Delete are off until you Save or Cancel (F-U3) |
| Update | **U-4** Escape to back out | Nothing happens; still editing | **Yes.** Escape cancels a rename or a delete confirm (F-U4) |
| Update | **U-5** Rename while the friend has the page open | Friend keeps the old name until they reload | **Yes.** The friend's page redraws when the link changes in the same browser (F-U5). On another device it still can't (R-1) |
| Delete | **D-1** Delete, then Back to the friend page | Chromium re-ran the page and showed `removed`. Not tried in Safari, where back/forward cache may show the old page | **Guarded, not tested.** The friend's page now redraws on `pageshow` from the back/forward cache. Still needs a try in Safari on your phone |
| Delete | **D-2** Delete by mistake, then re-create | New code. The old texted link stays `removed` forever, and there's no undo | Not fixed. Undo is a feature decision, not a bug |
| Delete | **D-3** Two tabs both confirm delete | Second tab silently shows `No links yet` (same swallowed error as U-1) | **Yes.** Same notice as U-1 (F-D3) |
| Delete | **D-4** Sender clears website data | Friend sees `doesn't exist`, not `removed`. The tombstone went too | Not fixable here. Needs the real database |
| Delete | **D-5** Someone else holding the phone | Delete is right there, no passcode asked | Not fixable here. Needs the sender login (Week 12) |

"What happened" is what the first break-it run saw, before any fix. The last column says
what was corrected afterwards and which check in **Fixes** proves it.

## What I corrected
- **Asked for the break-it bugs to be fixed** after reading the table. That was one request
  for all of them, not row by row. The agent chose each fix. Two rows are only half fixed
  (R-2 lowercase, R-4 recovery), and D-2 (undo) was left as a feature decision.
- _(add your own)_
- Agent-side, for honesty: the check harness had two bugs of its own.
  Navigating to the same `#/home` didn't re-render, and "Back" landed on `about:blank`.
  Both were fixed in the scripts, not the app, and both cost a rerun.

## Fixes
Each fix got its own check (`tests/e2e/link-crud-fixes.js`). Every check was
run against commit `57ce734` (before the fixes) and against the fixed code. All 13 fail
before, which shows they test the bug. All 13 pass after, and the original 9 checks
still pass.

```
===== BEFORE (commit 57ce734)
FAIL F-C1 :: records=1, link still shown=false, pass error="Enter the passcode."
FAIL F-C2 :: "…" records=2
FAIL F-C4 :: field kept 100 chars, error="", records=3
FAIL F-C6 :: errors=["Enter the passcode.","",""], focus=#
FAIL F-R2 :: "rMOkE77IaG." opens=false, "rMOkE77IaG)" opens=false
FAIL F-R3 :: tab A rows before=1, after (no reload)=1
FAIL F-U5 :: friend tab shows "late train home" without reloading
FAIL F-U2 :: updated_at unchanged=false
FAIL F-U3 :: other row's Rename disabled=false, typed text kept="half-typed"
FAIL F-U4 :: still editing=true, name unchanged=renamed while watching
FAIL F-U1 :: tab A shows "No links yetLinks you make on Create show up here, …"
FAIL F-D3 :: second tab shows "No links yetLinks you make on Create show up here, …"
FAIL F-R4 :: "Something went wrong. Nothing changed."
0/13 passed
===== AFTER
PASS F-C1 :: records=1, link still shown=true, pass error=""
PASS F-C2 :: "You already had a link for this playlist (late train home). This is a …" records=2
PASS F-C4 :: field kept 150 chars, error="Keep the name to 100 characters or fewer.", records=2
PASS F-C6 :: errors=["Enter the passcode.","Crossfade only handles US Apple Music links.","Give the playlist a name."], focus=#passcode
PASS F-R2 :: "WB1W1t0mXZ." opens=true, "WB1W1t0mXZ)" opens=true
PASS F-R3 :: tab A rows before=1, after (no reload)=2
PASS F-U5 :: friend tab shows "renamed while watching" without reloading
PASS F-U2 :: updated_at unchanged=true
PASS F-U3 :: other row's Rename disabled=true, typed text kept="half-typed"
PASS F-U4 :: still editing=false, name unchanged=renamed while watching
PASS F-U1 :: tab A shows "That link was already deleted, maybe in another tab. Nothing else changed. …"
PASS F-D3 :: second tab shows "That link was already deleted, maybe in another tab. Nothing…"
PASS F-R4 :: "Couldn't read the links saved on this device, so nothing was saved."
13/13 passed
```

The fixes split by verb like this: Create 4 (C-1, C-2, C-4, C-6), Read 3 (R-2 half, R-3,
R-4 partly), Update 5 (U-1 to U-5), Delete 1 (D-3) plus one untested guard (D-1).

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
- Still open from the break-it table: R-2 lowercase codes (needs an ADR on the code
  alphabet), R-4 has no recovery from corrupted data, D-1 untested in Safari, D-2 has no
  undo. R-1, D-4 and D-5 wait for the database and the login.
- The checks are in `tests/` (unit tests for the store, plus the browser checks). S7's
  check scripts still aren't (`tests/README.md`).
- Architecture §9's table doesn't list Your links yet.
