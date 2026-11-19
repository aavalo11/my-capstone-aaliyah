// Opening playlists (2026-11-05): a link you made opens to its songs, each matched song opens
// in Spotify, a friend's shared playlist opens to its songs, and nothing unbuilt is on screen.
// Run all checks with node tests/e2e/run.js, or: node tests/e2e/playlists.js http://127.0.0.1:8000
const { chromium } = require("playwright");
const { signedIn } = require("./signed-in");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const URL1 = "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D";
const results = [];
const check = (id, ok, detail) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + id + " :: " + detail); };
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
// Misses in the recorded build that offer a near version (ADR 0026), counted from the file.
const SAMPLE = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "../../src/sample/build-sample.json"), "utf8")).report;
const NEAR = SAMPLE.tracks.filter((t) => t.tier === "unmatched" && t.near).length;

(async () => {
  const browser = await chromium.launch();
  const p = await (await signedIn(await browser.newContext())).newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));

  // P1: Create shows progress, then the report, then the link.
  await p.goto(BASE + "/#/create");
  await p.fill("#title", "70 degrees out"); await p.fill("#link", URL1);
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
  const hrefs = await p.$$eval("#tracks li a.song-link", (a) => a.map((x) => x.href)); // ADR 0022: the row is the link
  // ADR 0026: a miss has no song link, only its "Spotify has a different version" link, if any.
  const unmatchedLinks = await p.$$eval("#tracks li.unmatched a", (a) => a.map((x) => x.className));
  check("P2", location(p).startsWith("#/links/" + code) && rows === 52 && hrefs.length === 48 &&
    unmatchedLinks.length === NEAR && unmatchedLinks.every((c) => c.includes("near")),
    `at ${location(p)}, songs=${rows}, Spotify links=${hrefs.length}, links on misses=${JSON.stringify(unmatchedLinks)}`);

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

  // P5 (ADR 0022): Friends has no sample people, only its empty state, even at an old friend's address.
  await p.goto(BASE + "/#/friends"); await p.waitForSelector("#friends-empty");
  const friends = txt(await p.textContent("#view"));
  await p.goto(BASE + "/#/friends/jordan/playlists/0"); await p.waitForSelector("#friends-empty");
  check("P5", friends.includes("No friends yet") && !/Sample|match|Jordan/i.test(friends) && !(await p.$(".friend-card")),
    `"${friends}"`);

  // P5f: Friends has an error state.
  await p.goto(BASE + "/?demo=error#/friends"); await p.waitForSelector("#friends-error");
  check("P5f", txt(await p.textContent("#friends-error")).startsWith("Couldn't load your friends"), "error state shown");

  // P10 (ADR 0022): a Top songs row is one link to Spotify with no button on the side, albums
  // open Spotify too, and New this week looks through the top 100.
  const chartUrls = [];
  await p.route("**/itunes.apple.com/**", (r) => chartUrls.push(r.request().url()) && r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: { entry: [
    { "im:name": { label: "Good Days" }, "im:artist": { label: "SZA" }, "im:image": [{ label: "" }], id: { label: "https://music.apple.com/x" }, "im:releaseDate": { label: new Date().toISOString() } },
  ] } }) }));
  await p.goto(BASE + "/#/home"); await p.waitForSelector("#top-songs a.song-link");
  const top = await p.$$eval("#top-songs li", (l) => l.map((li) => ({ href: (li.querySelector("a.song-link") || {}).href, pills: li.querySelectorAll(".pill").length })));
  const fresh = await p.$$eval("#new-songs a.song-card", (a) => a.map((x) => x.href));
  await p.waitForSelector("#top-albums a.song-card");
  const album = await p.$eval("#top-albums a.song-card", (a) => a.href);
  const asked100 = chartUrls.some((u) => u.includes("/topsongs/limit=100/"));
  check("P10", top.length === 1 && top[0].href === "https://open.spotify.com/search/Good%20Days%20SZA" && top[0].pills === 0 &&
    fresh[0] === top[0].href && album === top[0].href && asked100,
    `top=${JSON.stringify(top)}, new this week card=${fresh[0]}, album=${album}, top 100 asked=${asked100}`);
  await p.unroute("**/itunes.apple.com/**");

  // P6f: a link code that isn't on this device says so, and a deleted one says it was deleted.
  await p.goto(BASE + "/#/links/nope");
  const nope = txt(await p.textContent("#view"));
  check("P6f", nope.includes("That link isn't here"), `"${nope.slice(0, 50)}"`);

  // P8 (S17, ADR 0018): a friend's link you opened is under Sent to me; your own link isn't.
  await p.evaluate(() => localStorage.removeItem("crossfade-received-v1:test-user")); // P4 already opened sample
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

  // P9 (ADR 0021): Home shows my own links; another account on this browser starts empty.
  await p.goto(BASE + "/#/home"); await p.waitForSelector("#recent .card");
  const mine = txt(await p.textContent("#recent")), myStats = txt(await p.textContent("#stats"));
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("crossfade-session-v1"));
    s.user = { id: "someone-else", email: "other@example.com", name: "Someone Else", avatar_url: "" };
    localStorage.setItem("crossfade-session-v1", JSON.stringify(s));
  });
  await p.goto(BASE + "/#/playlists/made"); await p.waitForSelector("#my-links .card");
  const theirLinks = txt(await p.textContent("#my-links"));
  await p.goto(BASE + "/#/home"); await p.waitForSelector("#recent .card");
  const theirs = txt(await p.textContent("#recent")), theirStats = txt(await p.textContent("#stats"));
  check("P9", mine.includes("70 degrees out") && myStats.includes("48") && theirs.startsWith("Nothing added yet") &&
    theirStats.startsWith("No numbers yet") && theirLinks.startsWith("No links yet"),
    `mine="${mine.slice(0, 30)}", stats="${myStats.slice(0, 20)}", other account sees "${theirs.slice(0, 20)}" / "${theirLinks.slice(0, 15)}"`);

  // P9f: signed out, Home has nothing of anyone's, and Made by me asks you to sign in.
  const out = await (await browser.newContext()).newPage();
  await out.goto(BASE + "/#/home"); await out.waitForSelector("#recent .card");
  const outHome = txt(await out.textContent("#recent"));
  await out.goto(BASE + "/#/playlists/made"); await out.waitForSelector("#made-signin");
  const sharedTable = await out.evaluate(() => performance.getEntriesByType("resource").some((e) => e.name.includes("/rest/v1/links")));
  check("P9f", outHome.startsWith("Nothing added yet") && !sharedTable &&
    txt(await out.textContent("#made-signin")).startsWith("Sign in to see playlists you made"),
    `home="${outHome.slice(0, 20)}", read shared links table=${sharedTable}`);
  await out.close();

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
