// Usernames and public profiles (ADR 0020, backlog S18). Supabase's /rest/v1/profiles is faked
// with page.route, so nothing is written to the real database. Run all checks with
// node tests/e2e/run.js, or: node tests/e2e/profile.js http://127.0.0.1:8000
const { chromium } = require("playwright");
const { signedIn, USER } = require("./signed-in");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const results = [];
const check = (id, ok, detail) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + id + " :: " + detail); };
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const json = (r, status, body) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch();
  const c = await signedIn(await browser.newContext());
  const p = await c.newPage();

  // A fake profiles table: one row per user id, usernames unique regardless of case.
  const table = { other: { id: "other", username: "Ari_Lane", display_name: "Ari Lane", avatar_url: "", bio: "late trains, loud songs" } };
  const sent = [];
  let down = false;
  await p.route("**/rest/v1/profiles**", (r) => {
    const req = r.request(), url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    sent.push({ method: req.method(), query: url.search, body, auth: req.headers().authorization || "" });
    if (down) return r.fulfill({ status: 503, body: "{}" });
    const taken = (name, id) => Object.values(table).some((row) => row.id !== id && row.username.toLowerCase() === name.toLowerCase());
    if (req.method() === "GET") {
      const id = url.searchParams.get("id"), key = url.searchParams.get("username_key");
      const rows = Object.values(table).filter((row) => (id ? "eq." + row.id === id : "eq." + row.username.toLowerCase() === key));
      return json(r, 200, rows);
    }
    if (taken(body.username, req.method() === "POST" ? body.id : USER.id)) return json(r, 409, { code: "23505" });
    const row = req.method() === "POST" ? (table[body.id] = { ...body }) : Object.assign(table[USER.id], body);
    return json(r, req.method() === "POST" ? 201 : 200, [row]);
  });

  // R1: first visit to Account after sign-in asks for a username, with the Google name filled in.
  await p.goto(BASE + "/#/account"); await p.waitForSelector("#profile-form");
  const heading = txt(await p.textContent("#profile-form h2"));
  check("R1", heading === "Pick a username" && (await p.inputValue("#p-name")) === USER.name,
    `heading="${heading}", display name="${await p.inputValue("#p-name")}"`);

  // R1f: a bad username, a long bio and a long name are refused without a database write.
  const before = sent.length;
  await p.fill("#p-username", "a!"); await p.fill("#p-bio", "x".repeat(161)); await p.fill("#p-name", "n".repeat(51));
  await p.click("#profile-form button[type=submit]");
  const errs = [await p.textContent("#p-username-error"), await p.textContent("#p-name-error"), await p.textContent("#p-bio-error")];
  const writes = sent.slice(before).filter((s) => s.method !== "GET").length;
  check("R1f", errs.every(Boolean) && writes === 0 && (await p.evaluate(() => document.activeElement.id)) === "p-username",
    `errors=${JSON.stringify(errs)}, writes=${writes}`);

  // R2f: a username someone else has, in other capitals, is taken.
  await p.fill("#p-name", "Test Sender"); await p.fill("#p-bio", "");
  await p.fill("#p-username", "ari_lane"); await p.click("#profile-form button[type=submit]");
  await p.waitForFunction(() => document.querySelector("#p-username-error").textContent);
  check("R2f", (await p.textContent("#p-username-error")) === "That username is taken." && !table[USER.id],
    `error="${await p.textContent("#p-username-error")}", row made=${!!table[USER.id]}`);

  // R2: saving creates my row, as me, and shows the profile with its link.
  await p.fill("#p-username", "Test_Sender"); await p.fill("#p-bio", "mostly sad songs");
  await p.click("#profile-form button[type=submit]"); await p.waitForSelector("#account-profile");
  const post = sent.filter((s) => s.method === "POST").pop();
  const link = await p.textContent("#profile-url");
  check("R2", post.body.id === USER.id && post.auth === "Bearer test-token" && txt(await p.textContent("#account-username")) === "@Test_Sender" &&
    link === BASE + "/u.html?name=Test_Sender" && !(await p.$("#profile-form")),
    `id=${post.body.id}, auth="${post.auth}", link=${link}`);

  // R3: editing changes my row with PATCH, never sending an id.
  await p.click("#edit-profile"); await p.fill("#p-bio", "mostly sad songs, sometimes not");
  await p.click("#profile-form button[type=submit]"); await p.waitForSelector("#account-profile");
  const patch = sent.filter((s) => s.method === "PATCH").pop();
  check("R3", patch && patch.query.includes("id=eq." + USER.id) && !("id" in patch.body) &&
    txt(await p.textContent("#account-bio")) === "mostly sad songs, sometimes not",
    `query=${patch && patch.query}, body has id=${patch && "id" in patch.body}`);

  // R4: the public profile opens without signing in, in any capitals, and never shows the email.
  const stranger = await (await browser.newContext()).newPage();
  await stranger.route("**/rest/v1/profiles**", (r) => json(r, 200,
    Object.values(table).filter((row) => "eq." + row.username.toLowerCase() === new URL(r.request().url()).searchParams.get("username_key"))));
  await stranger.goto(BASE + "/u.html?name=test_sender"); await stranger.waitForSelector("#public-profile");
  const page = txt(await stranger.textContent("#view"));
  const asked = await stranger.evaluate(() => localStorage.getItem("crossfade-session-v1"));
  check("R4", page.includes("Test Sender") && page.includes("@Test_Sender") && page.includes("mostly sad songs, sometimes not") &&
    !page.includes(USER.email) && !asked, `"${page.slice(0, 70)}", signed in=${!!asked}`);

  // R4f: a username nobody has says so; a database that's down says so with Try again.
  await stranger.goto(BASE + "/u.html?name=nobody_here"); await stranger.waitForSelector("#profile-missing");
  const missing = txt(await stranger.textContent("#profile-missing"));
  await stranger.goto(BASE + "/u.html?demo=error&name=test_sender"); await stranger.waitForSelector("#profile-error #retry");
  const broken = txt(await stranger.textContent("#profile-error"));
  check("R4f", missing.startsWith("No one has that username") && broken.startsWith("Couldn't load this profile"),
    `missing="${missing.slice(0, 30)}", error="${broken.slice(0, 30)}"`);

  // R5f: if the database is down, saving says so without losing what I typed, and Account says so.
  await p.click("#edit-profile"); down = true;
  await p.fill("#p-bio", "typed while offline"); await p.click("#profile-form button[type=submit]");
  await p.waitForFunction(() => document.querySelector("#p-error").textContent);
  const saveErr = txt(await p.textContent("#p-error")), kept = await p.inputValue("#p-bio");
  await p.goto(BASE + "/#/home"); await p.goto(BASE + "/#/account"); await p.waitForSelector("#profile-load-error");
  const loadErr = txt(await p.textContent("#profile-load-error"));
  check("R5f", saveErr.startsWith("Couldn't save") && kept === "typed while offline" && table[USER.id].bio !== kept &&
    loadErr.startsWith("Couldn't load your profile") && !!(await p.$("#sign-out")),
    `save="${saveErr.slice(0, 20)}", typing kept=${kept === "typed while offline"}, load="${loadErr.slice(0, 30)}"`);

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
