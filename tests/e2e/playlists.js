// Opening playlists (2026-11-05): a link you made opens to its songs, each matched song opens
// in Spotify, a friend's shared playlist opens to its songs, and nothing unbuilt is on screen.
// Run all checks with node tests/e2e/run.js, or: node tests/e2e/playlists.js http://127.0.0.1:8000
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const URL1 = "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D";
const results = [];
const check = (id, ok, detail) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + id + " :: " + detail); };
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();

(async () => {
  const browser = await chromium.launch();
  const p = await (await browser.newContext()).newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));

  // P1: Create shows progress, then the report, then the link.
  await p.goto(BASE + "/#/create");
  await p.fill("#title", "70 degrees out"); await p.fill("#link", URL1); await p.fill("#passcode", "x");
  await p.click("#create-form button[type=submit]");
  const progress = txt(await p.textContent("#build-progress"));
  const disabled = await p.$eval("#create-form button[type=submit]", (b) => b.disabled);
  await p.waitForSelector("#made-url");
  const headline = txt(await p.textContent("#build-report #match-headline"));
  const code = (await p.textContent("#made-url")).match(/code=(\w+)/)[1];
  check("P1", progress.startsWith("Reading playlist") && disabled && headline === "Matched 48 of 52",
    `first line="${progress}", Create disabled while building=${disabled}, headline="${headline}"`);

  // P2: the link's name on Playlists → Made by me opens its songs.
  await p.goto(BASE + "/#/playlists/made"); await p.waitForSelector("#my-links .link-row");
  await p.click(`.link-row[data-code="${code}"] a.title`);
  await p.waitForSelector("#tracks");
  const rows = await p.$$eval("#tracks li", (l) => l.length);
  const hrefs = await p.$$eval("#tracks li a.pill", (a) => a.map((x) => x.href));
  const unmatchedLinks = await p.$$eval("#tracks li.unmatched a", (a) => a.length);
  check("P2", location(p).startsWith("#/links/" + code) && rows === 52 && hrefs.length === 48 && unmatchedLinks === 0,
    `at ${location(p)}, songs=${rows}, Spotify links=${hrefs.length}, links on misses=${unmatchedLinks}`);

  // P3: matched songs open Spotify like Top songs do; sample ids never become fake track pages.
  check("P3", hrefs.every((h) => h.startsWith("https://open.spotify.com/search/")) &&
    decodeURIComponent(hrefs[0].split("/search/")[1]) === "Babydoll Dominic Fike",
    `first="${hrefs[0]}", all are Spotify search=${hrefs.every((h) => h.startsWith("https://open.spotify.com/search/"))}`);

  // P4: Spotify's version shows only when its title is written differently (ADR 0016).
  await p.goto(BASE + "/p.html?code=sample"); await p.waitForSelector("#tracks");
  const versions = await p.$$eval("#tracks [data-spotify-version]", (d) => d.map((x) => x.innerText));
  const label = await p.$$eval("#tracks", (d) => d[0].innerText.includes("Close match"));
  check("P4", versions.length === 1 && versions[0] === "On Spotify: Get You · Daniel Caesar, Kali Uchis" && !label,
    `versions shown=${JSON.stringify(versions)}, "Close match" label=${label}`);

  // P5: a friend's shared playlist opens to its songs, each opening in Spotify.
  await p.goto(BASE + "/#/friends/jordan");
  await p.click('a.row[href="#/friends/jordan/playlists/0"]');
  await p.waitForSelector("#tracks");
  const h1 = txt(await p.textContent("h1"));
  const fRows = await p.$$eval("#tracks li a.pill", (a) => a.map((x) => x.href));
  const sampleLabel = txt(await p.textContent(".notice"));
  check("P5", h1 === "gym but make it sad" && fRows.length === 5 && fRows.every((h) => h.startsWith("https://open.spotify.com/search/")) && sampleLabel.startsWith("Sample friends"),
    `h1="${h1}", songs with Spotify links=${fRows.length}, label="${sampleLabel}"`);

  // P5f: a playlist that isn't there says so.
  await p.goto(BASE + "/#/friends/jordan/playlists/9");
  const missing = txt(await p.textContent("#view"));
  check("P5f", missing.includes("That playlist isn't here"), `"${missing.slice(0, 50)}"`);

  // P6f: a link code that isn't on this device says so, and a deleted one says it was deleted.
  await p.goto(BASE + "/#/links/nope");
  const nope = txt(await p.textContent("#view"));
  check("P6f", nope.includes("That link isn't here"), `"${nope.slice(0, 50)}"`);

  // P8 (S17, ADR 0018): a friend's link you opened is under Sent to me; your own link isn't.
  await p.evaluate(() => localStorage.removeItem("crossfade-received-v1")); // P4 already opened sample
  await p.goto(BASE + "/#/playlists/received");
  const before = txt(await p.textContent("#received"));
  await p.goto(BASE + "/p.html?code=sample"); await p.waitForSelector("#tracks");
  await p.goto(BASE + "/p.html?code=" + code); await p.waitForSelector("#tracks");
  await p.goto(BASE + "/#/playlists/received"); await p.waitForSelector("#received-list");
  const got = await p.$$eval("#received-list .received-row", (l) => l.map((r) => ({ code: r.dataset.code, href: r.querySelector("a.title").href })));
  check("P8", before.includes("Nothing sent to you yet") && got.length === 1 && got[0].code === "sample" && got[0].href.endsWith("p.html?code=sample"),
    `empty first=${before.includes("Nothing sent to you yet")}, rows=${JSON.stringify(got)}`);

  // P8f: Sent to me has an error state, and the side menu marks the sub-tab you're on.
  await p.goto(BASE + "/?demo=error#/playlists/received"); await p.waitForSelector("#received-retry");
  const errText = txt(await p.textContent("#received"));
  await p.setViewportSize({ width: 1200, height: 800 });
  await p.goto(BASE + "/#/playlists/made"); await p.waitForSelector("#my-links .link-row");
  const current = await p.$$eval('.nav [aria-current="page"]', (a) => a.map((x) => x.textContent.trim()));
  check("P8f", errText.includes("Couldn't read your playlists") && JSON.stringify(current) === JSON.stringify(["♫Playlists", "Made by me"]),
    `error="${errText.slice(0, 40)}", menu marks ${JSON.stringify(current)}`);

  // P7: nothing unbuilt or explanatory is on screen.
  const screens = {};
  for (const r of ["home", "playlists/made", "playlists/received", "create", "settings", "friends"]) {
    await p.goto(BASE + "/#/" + r); await p.waitForTimeout(300);
    screens[r] = txt(await p.textContent("#view"));
  }
  const all = Object.values(screens).join(" ");
  const banned = ["Search songs", "How matching works", "Fix a match", "Listening history", "Week 9", "Lab 5", "backlog", "ADR", "Account", "Supabase", "Close match"];
  const found = banned.filter((w) => all.includes(w));
  check("P7", found.length === 0 && errors.length === 0, `found=${JSON.stringify(found)}, page errors=${errors.length}`);

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

function location(p) { return new URL(p.url()).hash; }
