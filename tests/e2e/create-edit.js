// The edit screen between matching and Create playlist (ADR 0029), against the FAKE server
// (server-stub.js). Run all checks with node tests/e2e/run.js, or:
//   node tests/e2e/create-edit.js http://127.0.0.1:8000
const { chromium } = require("playwright");
const { signedIn } = require("./signed-in");
const { stubServer, calls, SONGS } = require("./server-stub");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const APPLE = "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D";
const results = [];
const check = (id, ok, detail) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + id + " :: " + detail); };
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const last = (fn) => [...calls].reverse().find((c) => c.fn === fn);

async function matchOnly(p, title) {
  await p.goto(BASE + "/#/create");
  await p.fill("#title", title); await p.fill("#link", APPLE);
  await p.click("#create-form button[type=submit]");
  await p.waitForSelector("#publish");
}

(async () => {
  const browser = await chromium.launch();
  const p = await (await signedIn(await browser.newContext())).newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));

  // E1: after matching, nothing is made until Create playlist; the count shows what goes in.
  await matchOnly(p, "edited");
  const before = txt(await p.textContent("#draft-count"));
  const published = calls.filter((c) => c.fn === "publish").length;
  check("E1", /^\d+ songs go in the playlist$/.test(before) && published === 0 && !(await p.$("#made-url")),
    `count="${before}", publish calls=${published}, link shown=${!!(await p.$("#made-url"))}`);

  // E2: Remove leaves a song out (count drops, row struck through); Put back undoes it.
  const n0 = parseInt(before, 10);
  const rows0 = await p.$$eval("#draft-tracks > li", (l) => l.length); // every Apple row, misses included
  await p.click("#draft-tracks li:nth-child(1) [data-toggle]");
  const afterRemove = parseInt(await p.textContent("#draft-count"), 10);
  const struck = await p.$eval("#draft-tracks li:nth-child(1)", (li) => li.classList.contains("left-out") && li.innerText.includes("Left out"));
  await p.click("#draft-tracks li:nth-child(2) [data-toggle]");
  await p.click("#draft-tracks li:nth-child(2) [data-toggle]"); // put back
  const afterUndo = parseInt(await p.textContent("#draft-count"), 10);
  check("E2", afterRemove === n0 - 1 && struck && afterUndo === n0 - 1, `count ${n0} → ${afterRemove} after Remove, ${afterUndo} after Remove + Put back on another row, struck=${struck}`);

  // E3: a blank search is refused on the page; a search shows results; + Add adds once.
  await p.fill("#song-q", "   "); await p.click("#song-search button[type=submit]");
  const blank = await p.textContent("#search-error");
  await p.fill("#song-q", "test song"); await p.click("#song-search button[type=submit]");
  await p.waitForSelector("#song-results li");
  await p.click("#song-results li:nth-child(1) [data-add]");
  const addedBtn = await p.textContent("#song-results li:nth-child(1) [data-add]");
  const afterAdd = parseInt(await p.textContent("#draft-count"), 10);
  const addedList = txt(await p.textContent("#added-tracks"));
  check("E3", blank === "Type a song or an artist to search." && addedBtn === "Added" && afterAdd === n0 && addedList.includes(SONGS[0].title),
    `blank="${blank}", button="${addedBtn}", count=${afterAdd}, added list="${addedList.slice(0, 40)}"`);

  // E4: Create playlist sends exactly the edits; the link appears with the added song marked.
  await p.click("#publish");
  await p.waitForSelector("#made-url");
  const sent = last("publish").body;
  const report = txt(await p.innerText("#build-report"));
  check("E4", JSON.stringify(sent.remove) === "[1]" && JSON.stringify(sent.add) === JSON.stringify([SONGS[0].id]) && sent.title === "edited",
    `sent remove=${JSON.stringify(sent.remove)} add=${JSON.stringify(sent.add)} title="${sent.title}", report has added song=${report.includes(SONGS[0].title)}`);

  // E5: a friend on another phone sees the edit: the removed song is gone, the added one says who added it.
  const url = await p.textContent("#made-url");
  const f = await (await stubServer(await browser.newContext())).newPage();
  await f.goto(url); await f.waitForSelector("#tracks");
  const rows = await f.$$eval("#tracks > li", (ls) => ls.map((li) => li.innerText));
  const firstTitle = await f.$eval("#tracks > li .title", (el) => el.textContent);
  check("E5", rows.length === rows0 - 1 + 1 && firstTitle !== "Babydoll" && rows.at(-1).includes(SONGS[0].title) && rows.at(-1).includes("Added by"),
    `rows=${rows.length} (expected ${rows0} − 1 removed + 1 added), first="${firstTitle}", last="${txt(rows.at(-1)).slice(0, 60)}"`);

  // E6 (negative): removing every song keeps Create playlist off.
  await matchOnly(p, "nothing left");
  await p.evaluate(() => document.querySelectorAll("#draft-tracks [data-toggle]").forEach((b, i) => { b.setAttribute("data-i", i); }));
  const count = await p.$$eval("#draft-tracks [data-toggle]", (b) => b.length);
  for (let i = 0; i < count; i++) await p.click(`#draft-tracks li:nth-child(${i + 1}) [data-toggle]`);
  const off = await p.$eval("#publish", (b) => b.disabled);
  check("E6", off && txt(await p.textContent("#draft-count")) === "0 songs go in the playlist", `Create playlist disabled=${off}`);

  // E7 (negative): the server refusing the publish shows its message and keeps the edits.
  await matchOnly(p, "refused");
  await p.click("#draft-tracks li:nth-child(3) [data-toggle]");
  await p.route("**/functions/v1/publish-link", (r) => r.fulfill({ status: 410, contentType: "application/json",
    body: JSON.stringify({ error: "That match is over an hour old. Paste the link again." }) }));
  await p.click("#publish");
  await p.waitForFunction(() => document.getElementById("draft-error").textContent);
  const err = await p.textContent("#draft-error");
  const stillOut = await p.$eval("#draft-tracks li:nth-child(3)", (li) => li.classList.contains("left-out"));
  check("E7", err === "That match is over an hour old. Paste the link again." && stillOut && !(await p.$("#made-url")),
    `error="${err}", edit kept=${stillOut}`);
  await p.unroute("**/functions/v1/publish-link");

  // E8 (negative): matching fails → the server's wording, nothing to edit.
  await p.route("**/functions/v1/match-playlist", (r) => r.fulfill({ status: 422, contentType: "application/json",
    body: JSON.stringify({ error: "Apple Music wouldn't share this playlist. Check that it's shared by link." }) }));
  await p.goto(BASE + "/#/create");
  await p.fill("#title", "private"); await p.fill("#link", APPLE);
  await p.click("#create-form button[type=submit]");
  await p.waitForSelector("#build-error");
  const merr = await p.textContent("#build-error");
  check("E8", merr === "Apple Music wouldn't share this playlist. Check that it's shared by link." && !(await p.$("#publish")), `error="${merr}"`);

  // E9 (negative): an expired sign-in says so instead of a raw 401.
  await p.route("**/functions/v1/match-playlist", (r) => r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Sign in to make a link." }) }));
  await p.goto(BASE + "/#/create");
  await p.fill("#title", "expired"); await p.fill("#link", APPLE);
  await p.click("#create-form button[type=submit]");
  await p.waitForSelector("#build-error");
  check("E9", (await p.textContent("#build-error")) === "Your sign-in ran out. Sign in again, then try once more.", `"${await p.textContent("#build-error")}"`);

  if (errors.length) check("no page errors", false, errors.join(" | "));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
