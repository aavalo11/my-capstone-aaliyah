// One real Deezer track search from the terminal (D09, ADR 0013). No key, no account.
// Prints what was sent and what came back.
//
//   node scripts/deezer-search.ts "Kill Bill" "SZA"
//   node scripts/deezer-search.ts "Kill Bill" "SZA" --break=bad-token
//
// --plain               send "title artist" instead of Deezer's track:"…" artist:"…" filters
// --break=no-query      leave out q
// --break=bad-token     add a made-up access_token (search doesn't need one)
// --break=bad-path      ask for /searchh, an endpoint that doesn't exist
// --break=post          use POST instead of GET
// --full                print the whole response instead of a summary

const args = process.argv.slice(2);
const [title, artist] = args.filter((a) => !a.startsWith("--"));
const breakIt = args.find((a) => a.startsWith("--break="))?.slice("--break=".length);
const plain = args.includes("--plain");
const full = args.includes("--full");

if (!title || !artist) {
  console.error('Usage: node scripts/deezer-search.ts "<title>" "<artist>" [--plain] [--break=…] [--full]');
  process.exit(1);
}

type Track = { title: string; isrc: string; link: string; artist: { name: string }; album: { title: string } };
type Reply = { data?: Track[]; total?: number; error?: { type: string; message: string; code: number } };

const params = new URLSearchParams({ limit: "5" });
if (breakIt !== "no-query") params.set("q", plain ? title + " " + artist : 'track:"' + title + '" artist:"' + artist + '"');
if (breakIt === "bad-token") params.set("access_token", "not-a-real-token");
const url = "https://api.deezer.com/" + (breakIt === "bad-path" ? "searchh" : "search") + "?" + params;
const method = breakIt === "post" ? "POST" : "GET";

console.log(method + " " + url);
const res = await fetch(url, { method });
const text = await res.text();
console.log("→ " + res.status + " " + res.statusText + "\n");

let body: Reply;
try { body = JSON.parse(text); } catch { console.log(text.slice(0, 500)); process.exit(1); }

// Deezer answers most mistakes with a 200 and an error object, so the status alone can't be trusted.
if (body.error) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(1);
}
if (full) console.log(JSON.stringify(body, null, 2));
else {
  console.log(body.total + " total, showing " + (body.data ?? []).length);
  for (const t of body.data ?? []) {
    console.log("  " + t.title + " — " + t.artist.name + "  (" + t.album.title + ")  ISRC " + t.isrc);
    console.log("    " + t.link);
  }
}

// R2: a different recording never stands in. Say so when the top result isn't what was asked for.
const top = body.data?.[0];
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
if (top && !(same(top.title, title) && same(top.artist.name, artist))) {
  console.log("\n! The top result isn't \"" + title + "\" by " + artist + ".");
}
