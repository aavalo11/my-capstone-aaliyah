// Break-it pass: things a real sender or friend might do that the checks didn't plan for
// (docs/features/link-crud.md, "Try to break it"). Prints what happened; nothing here asserts,
// so it isn't part of run.js. Start the server first, then:
//   node tests/e2e/explore-link-crud.js http://127.0.0.1:8000
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const URL1 = "https://music.apple.com/us/playlist/late-train-home/pl.u-8aAVZ";
const log = (id, what, happened) => console.log(`\n[${id}] ${what}\n   → ${happened}`);
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("crossfade-links-v1") || "[]"));

async function fill(page, title, link, pass = "x") {
  await page.goto("about:blank"); await page.goto(BASE + "/#/create");
  await page.fill("#title", title); await page.fill("#link", link); await page.fill("#passcode", pass);
}
async function home(page) {
  await page.goto("about:blank"); await page.goto(BASE + "/#/home"); await page.waitForSelector("#my-links .card");
}
async function friendText(page, code) {
  await page.goto(BASE + "/p.html?code=" + encodeURIComponent(code));
  await page.waitForFunction(() => !document.querySelector("#view").innerText.includes("Loading"));
  return txt(await page.textContent("#view"));
}
async function make(page, title, link = URL1) {
  await fill(page, title, link);
  await page.click("#create-form button[type=submit]");
  return (await page.textContent("#made-url")).match(/code=(\w+)/)[1];
}

(async () => {
  const browser = await chromium.launch();
  const fresh = async () => { const c = await browser.newContext(); return { c, p: await c.newPage() }; };
  let dialogs = [];

  let c, p;
  if (process.env.ONLY !== "delete") {
  // ---------- CREATE ----------
  ({ c, p } = await fresh());
  p.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  await fill(p, "late train home", URL1);
  await p.dblclick("#create-form button[type=submit]");
  log("C-1", "Double-tap Create", `records=${(await store(p)).length}; pass error="${await p.textContent("#pass-error")}"; result shown=${!!(await p.$("#made-url"))}`);

  await fill(p, "late train home", URL1);
  await p.click("#create-form button[type=submit]");
  await fill(p, "late train home", URL1);
  await p.click("#create-form button[type=submit]");
  const dup = await store(p);
  log("C-2", "Paste the same playlist twice with the same name", `records=${dup.length}, codes=${dup.map((r) => r.code).join(",")}, any warning=${txt(await p.textContent("#create-result")).includes("already")}`);

  await fill(p, '<img src=x onerror=alert(1)>', URL1);
  await p.click("#create-form button[type=submit]");
  await home(p);
  const xssRow = txt(await p.textContent("#my-links"));
  log("C-3", "Name the playlist with HTML in it", `alert fired=${dialogs.length > 0}; Home shows literally="${xssRow.includes("<img src=x onerror=alert(1)>")}"`);

  await fill(p, "x".repeat(150), URL1);
  const typedLen = (await p.inputValue("#title")).length;
  await p.click("#create-form button[type=submit]");
  log("C-4", "Paste a 150-character name", `field kept ${typedLen} chars; result="${txt(await p.textContent("#create-result")).slice(0, 50)}"; title error="${await p.textContent("#title-error")}"`);

  await fill(p, "share sheet", "  https://music.apple.com/us/playlist/late-train-home/pl.u-8aAVZ?ls=1&app=music  ");
  await p.click("#create-form button[type=submit]");
  const shared = (await store(p)).slice(-1)[0];
  log("C-5", "Paste a share-sheet link with spaces and ?ls=1&app=music", `created=${!!(await p.$("#made-url"))}; stored apple_url="${shared.apple_url}"`);

  await fill(p, "  ", "https://music.apple.com/gb/playlist/x/pl.u-1");
  await p.click("#create-form button[type=submit]");
  log("C-6", "UK link and blank name together", `errors shown: link="${await p.textContent("#link-error")}" name="${await p.textContent("#title-error")}"`);
  await c.close();

  // ---------- READ ----------
  ({ c, p } = await fresh());
  const code = await make(p, "late train home");
  const other = await fresh();
  log("R-1", "Friend opens the link on another device (fresh browser context)", `"${await friendText(other.p, code)}"`);
  await other.c.close();

  log("R-2", "Friend's Messages app adds a trailing period, or the code gets lowercased", `period: "${(await friendText(p, code + ".")).slice(0, 40)}" | lowercase: "${(await friendText(p, code.toLowerCase())).slice(0, 40)}"`);

  const tabA = await c.newPage();
  await home(tabA);
  const before = (await tabA.$$(".link-row")).length;
  await make(p, "second one");
  const after = (await tabA.$$(".link-row")).length;
  log("R-3", "Home open in tab A, new link made in tab B", `tab A rows before=${before}, after (no reload)=${after}`);

  await p.evaluate(() => localStorage.setItem("crossfade-links-v1", "{not json"));
  await home(p);
  const corrupt = txt(await p.textContent("#my-links"));
  await fill(p, "after corruption", URL1);
  await p.click("#create-form button[type=submit]");
  log("R-4", "Saved data gets corrupted (another script / old version writes junk)", `Home="${corrupt.slice(0, 40)}"; Create then says "${txt(await p.textContent("#create-result"))}"`);
  await c.close();

  // ---------- UPDATE ----------
  ({ c, p } = await fresh());
  const u = await make(p, "late train home");
  const tab2 = await c.newPage();
  await home(p);
  await p.click(`.link-row[data-code="${u}"] [data-rename]`);
  await p.fill(`#rename-${u}`, "renamed after delete");
  await home(tab2);
  await tab2.click(`.link-row[data-code="${u}"] [data-delete]`);
  await tab2.click(`.link-row[data-code="${u}"] [data-confirm-delete]`);
  await p.click(`.link-row[data-code="${u}"] button[type=submit]`);
  log("U-1", "Rename in tab A after the link was deleted in tab B", `tab A shows: "${txt(await p.textContent("#my-links"))}"; stored=${JSON.stringify((await store(p)).find((r) => r.code === u))}`);

  const v = await make(p, "late train home");
  await home(p);
  await p.click(`.link-row[data-code="${v}"] [data-rename]`);
  await p.click(`.link-row[data-code="${v}"] button[type=submit]`);
  const vr = (await store(p)).find((r) => r.code === v);
  log("U-2", "Open Rename and Save without changing anything", `row now says "${txt(await p.textContent(`.link-row[data-code="${v}"]`))}"; updated_at changed=${vr.updated_at !== vr.created_at}`);

  const w = await make(p, "two");
  await home(p);
  await p.click(`.link-row[data-code="${v}"] [data-rename]`);
  await p.fill(`#rename-${v}`, "half-typed new name");
  const otherOff = await p.$eval(`.link-row[data-code="${w}"] [data-rename]`, (b) => b.disabled);
  if (!otherOff) await p.click(`.link-row[data-code="${w}"] [data-rename]`);
  const vAfter = await p.$(`#rename-${v}`);
  log("U-3", "Start renaming one link, then tap Rename on another", `other row's Rename disabled=${otherOff}; first row still editing=${!!vAfter}; half-typed text kept=${vAfter ? await vAfter.inputValue() : "lost"}`);

  const editing = otherOff ? v : w;
  await p.press(`#rename-${editing}`, "Escape");
  log("U-4", "Press Escape to back out of a rename", `still in edit mode=${!!(await p.$(`#rename-${editing}`))}`);

  const friendTab = await c.newPage();
  const beforeName = await friendText(friendTab, v);
  await home(p);
  await p.click(`.link-row[data-code="${v}"] [data-rename]`);
  await p.fill(`#rename-${v}`, "new name while friend watches");
  await p.click(`.link-row[data-code="${v}"] button[type=submit]`);
  const stillOld = txt(await friendTab.textContent("#view"));
  log("U-5", "Rename while the friend already has the page open", `friend page before="${beforeName.match(/only\. .*? Play/) ? "" : ""}${stillOld.includes("new name while friend watches") ? "updated live" : "still the old name until they reload"}"`);
  await c.close();
  }

  // ---------- DELETE ----------
  ({ c, p } = await fresh());
  const d = await make(p, "sent to the wrong person");
  await friendText(p, d);
  await p.goto(BASE + "/#/home"); await p.waitForSelector("#my-links .card"); // real navigation, so Back has somewhere to go
  await p.click(`.link-row[data-code="${d}"] [data-delete]`);
  await p.click(`.link-row[data-code="${d}"] [data-confirm-delete]`);
  await p.goBack(); await p.waitForTimeout(300);
  log("D-1", "Delete, then press Back to the friend page that was open before", `url=${p.url().replace(BASE, "")} shows "${txt(await p.textContent("#view")).slice(0, 60)}"`);

  const d2 = await make(p, "sent to the wrong person");
  log("D-2", "Delete by mistake, then re-create the same playlist", `new code=${d2} (old was ${d}); old link now says "${(await friendText(p, d)).slice(0, 42)}"; any undo offered=no button exists`);

  const t2 = await c.newPage();
  await home(p);
  await p.click(`.link-row[data-code="${d2}"] [data-delete]`);
  await home(t2);
  await t2.click(`.link-row[data-code="${d2}"] [data-delete]`);
  await t2.click(`.link-row[data-code="${d2}"] [data-confirm-delete]`);
  await p.click(`.link-row[data-code="${d2}"] [data-confirm-delete]`);
  log("D-3", "Two tabs both confirm delete on the same link", `second tab shows "${txt(await p.textContent("#my-links")).slice(0, 80)}"`);

  const d3 = await make(p, "cleared");
  await p.evaluate(() => localStorage.clear());
  log("D-4", "Sender clears Safari history/website data", `friend sees "${(await friendText(p, d3)).slice(0, 40)}" (not "removed")`);

  const d4 = await make(p, "friend's phone");
  await home(p);
  log("D-5", "Anyone holding this phone (or the friend, if they open it on the sender's device) can delete", `Delete button visible to whoever is on Home: ${!!(await p.$(`.link-row[data-code="${d4}"] [data-delete]`))}; no passcode asked`);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
