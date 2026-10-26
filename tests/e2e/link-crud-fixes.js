// One check per break-it bug that was fixed (docs/features/link-crud.md). Run all checks with node tests/e2e/run.js,
// or this file alone against a running server: node tests/e2e/link-crud-fixes.js http://127.0.0.1:8000
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const URL1 = "https://music.apple.com/us/playlist/late-train-home/pl.u-8aAVZ";
const results = [];
const check = (id, ok, detail) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + id + " :: " + detail); };
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("crossfade-links-v1") || "[]"));

async function fill(page, title, link, pass = "x") {
  await page.goto("about:blank"); await page.goto(BASE + "/#/create");
  await page.fill("#title", title); await page.fill("#link", link); await page.fill("#passcode", pass);
}
async function make(page, title, link = URL1) {
  await fill(page, title, link);
  await page.click("#create-form button[type=submit]");
  return (await page.textContent("#made-url")).match(/code=(\w+)/)[1];
}
async function home(page) {
  await page.goto("about:blank"); await page.goto(BASE + "/#/home"); await page.waitForSelector("#my-links .card");
}
async function friendText(page, code) {
  await page.goto(BASE + "/p.html?code=" + encodeURIComponent(code));
  await page.waitForFunction(() => !document.querySelector("#view").innerText.includes("Loading"));
  return txt(await page.textContent("#view"));
}
const row = (code) => `.link-row[data-code="${code}"]`;

(async () => {
  const browser = await chromium.launch();
  const fresh = async () => { const c = await browser.newContext(); return { c, p: await c.newPage() }; };
  let { c, p } = await fresh();

  // C-1 double tap
  await fill(p, "late train home", URL1);
  await p.dblclick("#create-form button[type=submit]");
  check("F-C1", (await store(p)).length === 1 && !!(await p.$("#made-url")) && (await p.textContent("#pass-error")) === "",
    `records=${(await store(p)).length}, link still shown=${!!(await p.$("#made-url"))}, pass error="${await p.textContent("#pass-error")}"`);

  // C-2 duplicate playlist (share-sheet variant of the same URL)
  await fill(p, "late train home again", URL1 + "?ls=1&app=music");
  await p.click("#create-form button[type=submit]");
  const dupNote = txt(await p.textContent("#create-result"));
  check("F-C2", dupNote.includes("You already had a link for this playlist (late train home)") && (await store(p)).length === 2,
    `"${dupNote.slice(dupNote.indexOf("You already"), dupNote.indexOf("You already") + 70)}…" records=${(await store(p)).length}`);

  // C-4 long name is reported, not cut
  await fill(p, "x".repeat(150), URL1);
  const kept = (await p.inputValue("#title")).length;
  await p.click("#create-form button[type=submit]");
  check("F-C4", kept === 150 && (await p.textContent("#title-error")) === "Keep the name to 100 characters or fewer." && (await store(p)).length === 2,
    `field kept ${kept} chars, error="${await p.textContent("#title-error")}", records=${(await store(p)).length}`);

  // C-6 every field error at once
  await fill(p, "  ", "https://music.apple.com/gb/playlist/x/pl.u-1", "");
  await p.click("#create-form button[type=submit]");
  const errs = [await p.textContent("#pass-error"), await p.textContent("#link-error"), await p.textContent("#title-error")];
  const focused = await p.evaluate(() => document.activeElement.id);
  check("F-C6", errs.every(Boolean) && focused === "passcode", `errors=${JSON.stringify(errs)}, focus=#${focused}`);
  await c.close();

  // R-2 junk after the code
  ({ c, p } = await fresh());
  const code = await make(p, "late train home");
  const dot = await friendText(p, code + ".");
  const paren = await friendText(p, code + ")");
  check("F-R2", dot.includes("late train home") && paren.includes("late train home"),
    `"${code}." opens=${dot.includes("late train home")}, "${code})" opens=${paren.includes("late train home")}`);

  // R-3 Home in another tab redraws
  const tabA = await c.newPage();
  await home(tabA);
  const before = (await tabA.$$(".link-row")).length;
  await make(p, "second one");
  await tabA.waitForTimeout(300);
  const after = (await tabA.$$(".link-row")).length;
  check("F-R3", before === 1 && after === 2, `tab A rows before=${before}, after (no reload)=${after}`);

  // U-5 friend page redraws after a rename
  const friendTab = await c.newPage();
  await friendText(friendTab, code);
  await home(p);
  await p.click(`${row(code)} [data-rename]`);
  await p.fill(`#rename-${code}`, "renamed while watching");
  await p.click(`${row(code)} button[type=submit]`);
  await friendTab.waitForTimeout(300);
  check("F-U5", txt(await friendTab.textContent("#view")).includes("renamed while watching"),
    `friend tab shows "${txt(await friendTab.textContent("h1"))}" without reloading`);

  // U-2 saving the same name
  await home(p);
  await p.click(`${row(code)} [data-rename]`);
  await p.click(`${row(code)} button[type=submit]`);
  const r2 = (await store(p)).find((r) => r.code === code);
  const before2 = r2.updated_at;
  await home(p);
  await p.click(`${row(code)} [data-rename]`);
  await p.click(`${row(code)} button[type=submit]`);
  const r2b = (await store(p)).find((r) => r.code === code);
  check("F-U2", r2b.updated_at === before2, `updated_at unchanged=${r2b.updated_at === before2}`);

  // U-3 one row at a time
  const other = (await store(p)).find((r) => r.code !== code && !r.deleted_at).code;
  await home(p);
  await p.click(`${row(code)} [data-rename]`);
  await p.fill(`#rename-${code}`, "half-typed");
  const otherDisabled = await p.$eval(`${row(other)} [data-rename]`, (b) => b.disabled);
  check("F-U3", otherDisabled && (await p.inputValue(`#rename-${code}`)) === "half-typed",
    `other row's Rename disabled=${otherDisabled}, typed text kept="${await p.inputValue(`#rename-${code}`)}"`);

  // U-4 Escape backs out
  await p.press(`#rename-${code}`, "Escape");
  const stillEditing = !!(await p.$(`#rename-${code}`));
  check("F-U4", !stillEditing && (await store(p)).find((r) => r.code === code).title === "renamed while watching",
    `still editing=${stillEditing}, name unchanged=${(await store(p)).find((r) => r.code === code).title}`);
  await c.close();

  // U-1 rename after another tab deleted it
  ({ c, p } = await fresh());
  const u = await make(p, "late train home");
  const tab2 = await c.newPage();
  await home(p);
  await p.click(`${row(u)} [data-rename]`);
  await p.fill(`#rename-${u}`, "renamed after delete");
  await home(tab2);
  await tab2.click(`${row(u)} [data-delete]`);
  await tab2.click(`${row(u)} [data-confirm-delete]`);
  await p.click(`${row(u)} button[type=submit]`);
  const u1 = txt(await p.textContent("#my-links"));
  check("F-U1", u1.startsWith("That link was already deleted, maybe in another tab."), `tab A shows "${u1.slice(0, 75)}…"`);

  // D-3 two tabs confirm delete
  const d = await make(p, "two tabs");
  await home(p);
  await p.click(`${row(d)} [data-delete]`);
  await home(tab2);
  await tab2.click(`${row(d)} [data-delete]`);
  await tab2.click(`${row(d)} [data-confirm-delete]`);
  await p.click(`${row(d)} [data-confirm-delete]`);
  const d3 = txt(await p.textContent("#my-links"));
  check("F-D3", d3.startsWith("That link was already deleted"), `second tab shows "${d3.slice(0, 60)}…"`);

  // R-4 corrupted data: Create says why
  await p.evaluate(() => localStorage.setItem("crossfade-links-v1", "{not json"));
  await fill(p, "after corruption", URL1);
  await p.click("#create-form button[type=submit]");
  const r4 = txt(await p.textContent("#create-result"));
  check("F-R4", r4 === "Couldn't read the links saved on this device, so nothing was saved.", `"${r4}"`);

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
