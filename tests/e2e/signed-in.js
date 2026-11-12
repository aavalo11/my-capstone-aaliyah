// A signed-in sender for browser checks that aren't about signing in (ADR 0019).
// The app trusts a stored session until it expires; the server will check the token for real.
const USER = { id: "test-user", email: "sender@example.com", name: "Test Sender", avatar_url: "" };

async function signedIn(ctx) {
  await ctx.addInitScript((user) => {
    if (!localStorage.getItem("crossfade-session-v1")) {
      localStorage.setItem("crossfade-session-v1", JSON.stringify({
        access_token: "test-token", refresh_token: "test-refresh", expires_at: Date.now() + 3600e3, user,
      }));
    }
  }, USER);
  return ctx;
}

module.exports = { signedIn, USER };
