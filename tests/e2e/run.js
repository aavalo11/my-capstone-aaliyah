// Runs every browser check against a fresh local server: node tests/e2e/run.js
// Needs Python 3 (the same server as the README) and Playwright (tests/README.md, ADR 0011).
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");

const PORT = 8123;
const BASE = "http://127.0.0.1:" + PORT;
const ROOT = path.join(__dirname, "../..");
const CHECKS = ["link-crud.js", "link-crud-fixes.js"];

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", "src"],
  { cwd: ROOT, stdio: "ignore" });

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + "/index.html")).ok) return; } catch (e) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("The local server didn't start on port " + PORT + ". Is something else using it?");
}

waitForServer().then(() => {
  let failed = 0;
  for (const file of CHECKS) {
    console.log("\n===== " + file);
    const run = spawnSync(process.execPath, [path.join(__dirname, file), BASE], { stdio: "inherit" });
    if (run.status !== 0) failed++;
  }
  server.kill();
  console.log(failed ? `\n${failed} of ${CHECKS.length} check files failed` : "\nAll browser checks passed");
  process.exit(failed ? 1 : 0);
}).catch((e) => { console.error(e.message); server.kill(); process.exit(2); });
