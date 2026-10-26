// Link CRUD checks C1–C5 (docs/features/link-crud.md). Run all checks with node tests/e2e/run.js,
// or this file alone against a running server: node tests/e2e/link-crud.js http://127.0.0.1:8000
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const results = [];
const check = (id, ok, detail) => { results.push([id, ok]); console.log((ok ? "PASS " : "FAIL ") + id + " :: " + detail); };

async function store(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("crossfade-links-v1") || "[]"));
}
async function create(page, title, link, pass = "x") {
  await page.goto(BASE + "/#/create");
  await page.fill("#title", title);
  await page.fill("#link", link);
  await page.fill("#passcode", pass);
  await page.click("#create-form button[type=submit]");
}
async function myLinks(page) {
  await page.goto("about:blank");
  await page.goto(BASE + "/#/home");
  await page.waitForSelector("#my-links .card");
  return page.$$eval("#my-links .link-row", (rows) => rows.map((r) => ({
    code: r.getAttribute("data-code"), text: r.innerText.replace(/\s+/g, " ").trim() })));
}
async function friend(page, code, extra = "") {
  await page.goto(BASE + "/p.html?code=" + encodeURIComponent(code) + extra);
  await page.waitForFunction(() => !document.querySelector("#view").innerText.includes("Loading"));
  return page.$eval("#view", (v) => v.innerText.replace(/\s+/g, " ").trim());
}
const URL1 = "https://music.apple.com/us/playlist/late-train-home/pl.u-8aAVZ";
const URL2 = "https://music.apple.com/us/playlist/study-no-words/pl.u-0zZ1";

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // C1f: bad link and empty name save nothing
  await create(page, "late train home", "https://open.spotify.com/playlist/abc");
  const e1 = await page.textContent("#link-error");
  await create(page, "   ", URL1);
  const e2 = await page.textContent("#title-error");
  const s0 = await store(page);
  check("C1f", e1.includes("isn't an Apple Music") && e2 === "Give the playlist a name." && s0.length === 0,
    `link error="${e1}" | name error="${e2}" | records=${s0.length}`);

  // C2e: empty and error
  const empty = await page.goto(BASE + "/#/home").then(() => page.waitForSelector("#my-links .card")).then(() => page.textContent("#my-links"));
  await page.goto(BASE + "/?demo=error#/home"); await page.waitForSelector("#my-links .card");
  const errText = await page.textContent("#my-links");
  const errRows = await page.$$("#my-links .link-row");
  check("C2e", empty.includes("No links yet") && errText.includes("Couldn't read your links") && errRows.length === 0,
    `empty="${empty.trim().slice(0, 40)}…" | error="${errText.trim().slice(0, 40)}…" rows=${errRows.length}`);

  // C1: create
  await create(page, "late train home", URL1);
  const url = await page.textContent("#made-url");
  const code = (url.match(/code=([A-Za-z0-9]+)$/) || [])[1] || "";
  const s1 = await store(page);
  const l1 = await myLinks(page);
  check("C1", /^[A-Za-z0-9]{10}$/.test(code) && s1.length === 1 && l1.length === 1 && l1[0].code === code,
    `url=${url} | records=${s1.length} | home rows=${JSON.stringify(l1.map((r) => r.text))}`);

  // C2: two links, newest first
  await page.waitForTimeout(20);
  await create(page, "study, no words", URL2);
  const code2 = (await page.textContent("#made-url")).match(/code=(\w+)$/)[1];
  const l2 = await myLinks(page);
  check("C2", l2.length === 2 && l2[0].code === code2 && l2[1].code === code && /Made \w+ \d+/.test(l2[0].text),
    `home rows=${JSON.stringify(l2.map((r) => r.text))}`);

  // C3: friend view + regressions
  const f1 = await friend(page, code);
  const play = await page.$eval("button.btn", (b) => b.disabled);
  const nope = await friend(page, "nope");
  const sample = await friend(page, "sample");
  const sampleRows = await page.$$eval("#tracks li", (l) => l.length);
  check("C3", f1.includes("late train home") && f1.includes("Saved on this device only") && play &&
    nope.includes("doesn't exist") && sampleRows === 6,
    `friend="${f1.slice(0, 90)}…" play disabled=${play} | nope="${nope.slice(0, 35)}" | sample rows=${sampleRows}`);

  // C4: rename keeps the code
  await myLinks(page);
  await page.click(`.link-row[data-code="${code}"] [data-rename]`);
  await page.fill(`#rename-${code}`, "late train home (fixed)");
  await page.click(`.link-row[data-code="${code}"] button[type=submit]`);
  const l4 = await myLinks(page);
  const f4 = await friend(page, code);
  const r4 = (await store(page)).find((r) => r.code === code);
  check("C4", l4.some((r) => r.code === code && r.text.includes("late train home (fixed)")) &&
    f4.includes("late train home (fixed)") && r4 && r4.title === "late train home (fixed)",
    `home row="${(l4.find((r) => r.code === code) || {}).text}" | friend h1 has new name=${f4.includes("(fixed)")} | same code=${!!r4}`);

  // C4f: blank rename is rejected
  await myLinks(page);
  await page.click(`.link-row[data-code="${code}"] [data-rename]`);
  await page.fill(`#rename-${code}`, "   ");
  await page.click(`.link-row[data-code="${code}"] button[type=submit]`);
  const e4 = await page.textContent(`.link-row[data-code="${code}"] .field-error`).catch(() => "");
  const r4f = (await store(page)).find((r) => r.code === code);
  check("C4f", e4 === "Give the playlist a name." && r4f.title === "late train home (fixed)",
    `error="${e4}" | stored title="${r4f.title}"`);

  // C5c: cancel delete
  await myLinks(page);
  await page.click(`.link-row[data-code="${code}"] [data-delete]`);
  const confirmText = await page.textContent(`.link-row[data-code="${code}"]`);
  await page.click(`.link-row[data-code="${code}"] [data-cancel]`);
  const l5c = await myLinks(page);
  check("C5c", confirmText.includes("Anyone you sent it to will see it was removed") && l5c.length === 2,
    `confirm="${confirmText.replace(/\s+/g, " ").trim()}" | rows after cancel=${l5c.length}`);

  // C5: delete
  await page.click(`.link-row[data-code="${code}"] [data-delete]`);
  await page.click(`.link-row[data-code="${code}"] [data-confirm-delete]`);
  const l5 = await myLinks(page);
  const f5 = await friend(page, code);
  const f5other = await friend(page, code2);
  const s5 = await store(page);
  check("C5", l5.length === 1 && l5[0].code === code2 && f5.includes("This link was removed by whoever sent it.") &&
    f5other.includes("study, no words"),
    `home rows=${JSON.stringify(l5.map((r) => r.text))} | friend="${f5.slice(0, 45)}" | other link ok=${f5other.includes("study")} | stored=${JSON.stringify(s5.find((r) => r.code === code))}`);

  await browser.close();
  const failed = results.filter((r) => !r[1]).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
