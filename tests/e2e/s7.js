// S7 acceptance criteria (docs/backlog.md), one check each, written from the ACs, not the code.
// Run all checks with node tests/e2e/run.js, or: node tests/e2e/s7.js http://127.0.0.1:8000
// The build is the recorded one (ADR 0015). These checks swap its file for TEST FIXTURES of the
// sizes the ACs name (25 and 50 songs), made from the recorded songs. Nothing reaches Apple or Spotify.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { signedIn } = require("./signed-in");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const APPLE = "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D";
const results = [];
const check = (id, ok, detail) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + id + " :: " + detail); };
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();

// TEST FIXTURES, not app data. The recorded build has 52 songs, 4 not on Spotify.
const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, "../../src/sample/build-sample.json"), "utf8")).report;
function fixture(tracks) {
  return { _note: "TEST FIXTURE for tests/e2e/s7.js", report: { name: recorded.name, total: tracks.length,
    matched: tracks.filter((t) => t.tier !== "unmatched").length, tracks } };
}
const TWENTY_FIVE = fixture(recorded.tracks.slice(0, 25));
// 50 songs with exactly 3 misses: drop one miss (Feel So Close) and the last song.
const FIFTY = fixture(recorded.tracks.filter((t) => t.title !== "Feel So Close (Radio Edit)").slice(0, 50));
const FIFTY_MISSES = FIFTY.report.tracks.filter((t) => t.tier === "unmatched").map((t) => t.title);

// Fills in Create and taps Create link, with the build file swapped for `fx`.
// Returns what was on screen while it built, the time to the link, and the link.
async function createLink(page, title, fx) {
  await page.route("**/sample/build-sample.json", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fx) }));
  await page.goto(BASE + "/#/create");
  await page.fill("#title", title); await page.fill("#link", APPLE);
  // Every line the progress box shows, recorded as it changes.
  await page.evaluate(() => {
    window.__progress = [];
    new MutationObserver(() => {
      const el = document.getElementById("build-progress");
      const line = el && el.textContent.trim();
      if (line && window.__progress[window.__progress.length - 1] !== line) window.__progress.push(line);
    }).observe(document.getElementById("create-result"), { childList: true, subtree: true });
  });
  const started = Date.now();
  await page.click("#create-form button[type=submit]");
  let url = null;
  try { await page.waitForSelector("#made-url", { timeout: 15000 }); url = await page.textContent("#made-url"); } catch (e) { /* no link in 15 s */ }
  const ms = Date.now() - started;
  const progress = await page.evaluate(() => window.__progress);
  await page.unroute("**/sample/build-sample.json");
  return { url, ms, progress };
}

(async () => {
  const browser = await chromium.launch();
  const sender = await (await signedIn(await browser.newContext())).newPage();
  const errors = [];
  sender.on("pageerror", (e) => errors.push(String(e)));

  // AC1 (PRD R1): signed in, a 25-song US link, Create link → a Crossfade link within 15 s,
  // with progress on screen while it builds.
  const a1 = await createLink(sender, "AC1 twenty-five", TWENTY_FIVE);
  const sawMatching = a1.progress.some((l) => /^Matching \d+ of 25/.test(l));
  check("AC1", !!a1.url && a1.ms <= 15000 && a1.progress.length >= 2 && sawMatching,
    `link=${a1.url ? "yes" : "NO"} in ${a1.ms} ms, progress lines=${a1.progress.length} ` +
    `(first="${a1.progress[0]}", last="${a1.progress[a1.progress.length - 1]}")`);

  // AC2 (PRD R5): the friend opens that link in their own browser (never signed in) and taps
  // Play in Spotify: playback within 3 taps of opening the text, never asked to log in.
  // Tap 1 opens the link. Tap 2 must be Play in Spotify, pointing at the playlist, so Spotify's own
  // play is tap 3 at most. That last tap happens inside Spotify, which no browser check can see.
  const friendCtx = await browser.newContext(); // no session, no saved data: someone else's phone
  const friend = await friendCtx.newPage();
  const asked = [];
  friend.on("request", (r) => { if (/accounts\.google|\/auth\/v1\//.test(r.url())) asked.push(r.url()); });
  await friend.goto(a1.url || BASE + "/p.html?code=missing");
  await friend.waitForFunction(() => !/Loading…/.test(document.getElementById("view").innerText));
  const friendText = txt(await friend.textContent("#view"));
  const play = await friend.$$eval("a", (as) => as.filter((a) => a.textContent.trim() === "Play in Spotify").map((a) => a.href));
  const loginAsked = asked.length > 0 || /sign in|log in/i.test(friendText);
  check("AC2", play.length === 1 && /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]{22}$/.test(play[0]) && !loginAsked,
    `Play in Spotify=${JSON.stringify(play)}, asked to log in=${loginAsked}, friend sees "${friendText.slice(0, 60)}"`);
  await friendCtx.close();

  // AC3 (PRD R3): 50 songs, 3 not on Spotify → `Matched 47 of 50` and the 3 by name, before I send
  // (on the same screen as the new link, above it).
  const a3 = await createLink(sender, "AC3 fifty", FIFTY);
  const headline = a3.url ? txt(await sender.textContent("#match-headline")) : "";
  // innerText, not textContent: the names must be readable on screen, not only inside the closed
  // "All 50 songs" list (break B2 passed with textContent).
  const report = a3.url ? txt(await sender.innerText("#build-report")) : "";
  const reportFirst = a3.url ? await sender.evaluate(() =>
    !!(document.getElementById("build-report").compareDocumentPosition(document.getElementById("made-link")) & Node.DOCUMENT_POSITION_FOLLOWING)) : false;
  const named = FIFTY_MISSES.filter((t) => report.includes(t));
  check("AC3", FIFTY_MISSES.length === 3 && headline === "Matched 47 of 50" && named.length === 3 && reportFirst,
    `headline="${headline}", misses named ${named.length}/3 ${JSON.stringify(named)}, report above the link=${reportFirst}`);

  // AC4 (negative, PRD R2): a song with no Spotify match shows on the recipient's page greyed, with
  // exactly `Not found on Spotify (US)`, in its place. Never dropped, never swapped for another song.
  // Opened in the sender's browser: that's the only place a Create link opens today (see AC2).
  await sender.goto(a3.url); await sender.waitForSelector("#tracks");
  const rows = await sender.$$eval("#tracks > li", (ls) => ls.map((li) => ({
    title: li.querySelector(".title").textContent.trim(),
    unmatched: li.classList.contains("unmatched"),
    opacity: Number(getComputedStyle(li.querySelector(".row") || li).opacity),
    text: li.innerText,
    links: li.querySelectorAll("a").length,
  })));
  const sourceOrder = FIFTY.report.tracks.map((t) => t.title);
  const inOrder = JSON.stringify(rows.map((r) => r.title)) === JSON.stringify(sourceOrder);
  const misses = rows.filter((r) => r.unmatched);
  const missesOk = misses.length === 3 && misses.every((r) => r.opacity < 1 && r.links === 0 &&
    r.text.includes("Not found on Spotify (US)") && !r.text.includes("On Spotify:"));
  const hitsNotGrey = rows.filter((r) => !r.unmatched).every((r) => r.opacity === 1);
  check("AC4", rows.length === 50 && inOrder && missesOk && hitsNotGrey,
    `rows=${rows.length}/50, source order kept=${inOrder}, misses=${JSON.stringify(misses.map((r) => r.title))} ` +
    `greyed, no link, exact text=${missesOk}, matched rows not greyed=${hitsNotGrey}`);

  if (errors.length) check("no page errors", false, errors.join(" | "));
  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
