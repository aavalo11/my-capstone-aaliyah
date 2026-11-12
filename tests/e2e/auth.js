// Sender sign-in with Google (ADR 0019). Supabase's /auth/v1 is faked with page.route, so
// nothing reaches Google or Supabase. Run all checks with node tests/e2e/run.js, or:
// node tests/e2e/auth.js http://127.0.0.1:8000
const { chromium } = require("playwright");
const { signedIn } = require("./signed-in");
const BASE = process.argv[2] || "http://127.0.0.1:8000";
const URL1 = "https://music.apple.com/us/playlist/70-degrees-out/pl.u-LdbqEzvu2jzpe8D";
const results = [];
const check = (id, ok, detail) => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + id + " :: " + detail); };
const txt = (s) => (s || "").replace(/\s+/g, " ").trim();
const SESSION_KEY = "crossfade-session-v1";

const TOKEN_REPLY = {
  access_token: "fake-access", refresh_token: "fake-refresh", expires_in: 3600, token_type: "bearer",
  user: { id: "u1", email: "ari@example.com", user_metadata: { full_name: "Ari Lane", avatar_url: "" } },
};

(async () => {
  const browser = await chromium.launch();
  const fresh = async () => { const c = await browser.newContext(); return { c, p: await c.newPage() }; };

  // A1: signed out, the icon says Sign in, and Create asks you to sign in before showing the form.
  let { c, p } = await fresh();
  await p.goto(BASE + "/#/create"); await p.waitForSelector("#create-signin");
  const label = await p.getAttribute("#account-link", "aria-label");
  const form = await p.$("#create-form");
  check("A1", label === "Sign in" && !form && txt(await p.textContent("#create-signin")).includes("Sign in to make a link"),
    `icon label="${label}", form shown=${!!form}`);

  // A2: Sign in with Google goes to Supabase's authorize page with PKCE and comes back here.
  let authorize = null;
  await p.route("**/auth/v1/authorize**", (r) => {
    authorize = new URL(r.request().url());
    r.fulfill({ status: 302, headers: { location: BASE + "/#/create" } }); // as if the user came straight back
  });
  await p.click("#create-signin [data-sign-in]");
  await p.waitForURL(BASE + "/#/create"); await p.waitForSelector("#create-signin");
  const verifier = await p.evaluate(() => localStorage.getItem("crossfade-pkce-verifier"));
  check("A2", !!authorize && authorize.searchParams.get("provider") === "google" &&
    authorize.searchParams.get("code_challenge_method") === "s256" && (authorize.searchParams.get("code_challenge") || "").length === 43 &&
    authorize.searchParams.get("redirect_to") === BASE + "/" && !!verifier,
    `provider=${authorize && authorize.searchParams.get("provider")}, redirect_to=${authorize && authorize.searchParams.get("redirect_to")}, verifier saved=${!!verifier}`);

  // A3: coming back with ?code= trades it for a session and shows the profile; the code leaves the address bar.
  let tokenBody = null;
  await p.route("**/auth/v1/token?grant_type=pkce", (r) => {
    tokenBody = JSON.parse(r.request().postData());
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TOKEN_REPLY) });
  });
  await p.goto(BASE + "/?code=abc123"); await p.waitForSelector("#account-profile");
  const name = txt(await p.textContent("#account-name"));
  const icon = await p.getAttribute("#account-link", "aria-label");
  check("A3", name === "Ari Lane" && icon === "Account: Ari Lane" && tokenBody && tokenBody.auth_code === "abc123" &&
    tokenBody.code_verifier === verifier && !p.url().includes("code=") && new URL(p.url()).hash === "#/account",
    `name="${name}", icon="${icon}", sent verifier=${tokenBody && tokenBody.code_verifier === verifier}, url=${p.url().replace(BASE, "")}`);

  // A4: signed in, Create shows the form with no passcode field.
  await p.goto(BASE + "/#/create"); await p.waitForSelector("#create-form");
  check("A4", !(await p.$("#passcode")), `passcode field=${!!(await p.$("#passcode"))}`);

  // A5: Sign out forgets the session here and tells Supabase.
  let loggedOut = false;
  await p.route("**/auth/v1/logout", (r) => { loggedOut = true; r.fulfill({ status: 204 }); });
  await p.goto(BASE + "/#/account"); await p.click("#sign-out"); await p.waitForSelector("#account-signed-out");
  const left = await p.evaluate((k) => localStorage.getItem(k), SESSION_KEY);
  check("A5", !left && loggedOut && (await p.getAttribute("#account-link", "aria-label")) === "Sign in",
    `session left=${!!left}, Supabase told=${loggedOut}`);
  await c.close();

  // A5f: signing out still works when Supabase can't be reached.
  ({ c, p } = await fresh());
  await signedIn(c);
  await p.route("**/auth/v1/logout", (r) => r.abort());
  await p.goto(BASE + "/#/account"); await p.waitForSelector("#sign-out");
  await p.click("#sign-out"); await p.waitForSelector("#account-signed-out");
  const stillThere = await p.evaluate((k) => localStorage.getItem(k), SESSION_KEY); // no reload, so the init script hasn't re-added it
  check("A5f", !stillThere && (await p.getAttribute("#account-link", "aria-label")) === "Sign in",
    `session left=${!!stillThere} with Supabase unreachable`);
  await c.close();

  // A6f: cancelling at Google comes back with ?error= and says so, signed out.
  ({ c, p } = await fresh());
  await p.goto(BASE + "/?error=access_denied&error_description=denied"); await p.waitForSelector("#account-error");
  const cancelled = txt(await p.textContent("#account-error"));
  check("A6f", cancelled.includes("You cancelled signing in with Google") && !p.url().includes("error="),
    `"${cancelled.slice(0, 60)}", url=${p.url().replace(BASE, "")}`);

  // A7f: Supabase refusing the code shows the error state, and nobody is signed in.
  await p.route("**/auth/v1/token?grant_type=pkce", (r) => r.fulfill({ status: 500, body: "{}" }));
  await p.evaluate(() => localStorage.setItem("crossfade-pkce-verifier", "v"));
  await p.goto(BASE + "/?code=bad"); await p.waitForSelector("#account-error");
  const refused = txt(await p.textContent("#account-error"));
  const session = await p.evaluate((k) => localStorage.getItem(k), SESSION_KEY);
  check("A7f", refused.includes("Couldn't sign in with Google") && !session, `"${refused.slice(0, 40)}", session=${!!session}`);
  await c.close();

  // A8f: the 11th link of the day is refused, and nothing is saved.
  ({ c, p } = await fresh());
  await signedIn(c);
  await p.goto(BASE + "/#/create"); await p.waitForSelector("#create-form");
  await p.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem("crossfade-links-v1", JSON.stringify(Array.from({ length: 10 }, (_, i) =>
      ({ code: "c" + i, title: "t" + i, apple_url: "x", created_at: now, updated_at: now }))));
  });
  await p.fill("#title", "one more"); await p.fill("#link", URL1);
  await p.click("#create-form button[type=submit]"); await p.waitForSelector("#limit-error");
  const count = await p.evaluate(() => JSON.parse(localStorage.getItem("crossfade-links-v1")).length);
  check("A8f", txt(await p.textContent("#limit-error")).startsWith("You've made 10 links today") && count === 10,
    `"${txt(await p.textContent("#limit-error"))}", links saved=${count}`);
  await c.close();

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
