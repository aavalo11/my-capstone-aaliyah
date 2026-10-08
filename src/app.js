// Crossfade front end. No framework and no build step: hash routes render into #view.
// Add ?demo=empty or ?demo=error to the URL to see each screen's empty or error state.
(function () {
  "use strict";

  var view = document.getElementById("view");
  var DEMO = new URLSearchParams(location.search).get("demo"); // "empty" | "error" | null
  var CONFIG = window.CROSSFADE_CONFIG || {};

  // ---------- helpers ----------

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function stateBlock(title, body, action) {
    return '<div class="state"><strong>' + esc(title) + "</strong>" + esc(body) +
      (action ? '<div style="margin-top:14px">' + action + "</div>" : "") + "</div>";
  }

  function storage(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  // ---------- Supabase (REST, no client library) ----------

  function supabaseConfigured() {
    return CONFIG.supabaseUrl && CONFIG.supabaseKey &&
      CONFIG.supabaseUrl.indexOf("PASTE_") !== 0 && CONFIG.supabaseKey.indexOf("PASTE_") !== 0;
  }

  function fetchRecentLinks() {
    if (DEMO === "empty") return Promise.resolve([]);
    if (DEMO === "error") return Promise.reject(new Error("demo"));
    if (!supabaseConfigured()) return Promise.reject(new Error("not-configured"));

    var headers = { apikey: CONFIG.supabaseKey };
    // Legacy anon keys are JWTs and also need a bearer header; publishable keys don't.
    if (CONFIG.supabaseKey.indexOf("eyJ") === 0) headers.Authorization = "Bearer " + CONFIG.supabaseKey;

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 8000);
    var url = CONFIG.supabaseUrl.replace(/\/$/, "") +
      "/rest/v1/links?select=code,title,track_count,matched_count,created_at&order=created_at.desc&limit=20";

    return fetch(url, { headers: headers, signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error("http-" + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  // ---------- sample data (Friends only; clearly labelled on screen) ----------

  var MY_ARTISTS = ["Frank Ocean", "SZA", "Steve Lacy", "Mitski", "Clairo", "Daniel Caesar", "Kali Uchis", "Tyler, The Creator"];

  var FRIENDS = [
    {
      id: "jordan", name: "Jordan", service: "Spotify",
      playlists: [
        { title: "gym but make it sad", tracks: 32 },
        { title: "sunday reset", tracks: 21 },
      ],
      songs: [
        { title: "Bad Habit", artist: "Steve Lacy" },
        { title: "Kill Bill", artist: "SZA" },
        { title: "Pink + White", artist: "Frank Ocean" },
        { title: "telepatía", artist: "Kali Uchis" },
        { title: "Get You", artist: "Daniel Caesar" },
      ],
      artists: ["Steve Lacy", "SZA", "Frank Ocean", "Kali Uchis", "Daniel Caesar", "Drake"],
    },
    {
      id: "sam", name: "Sam", service: "Spotify",
      playlists: [{ title: "road trip 2026", tracks: 48 }],
      songs: [
        { title: "Washing Machine Heart", artist: "Mitski" },
        { title: "Mr. Brightside", artist: "The Killers" },
        { title: "Sofia", artist: "Clairo" },
      ],
      artists: ["Mitski", "Clairo", "The Killers", "Arctic Monkeys", "Phoebe Bridgers"],
    },
    {
      id: "priya", name: "Priya", service: "Apple Music",
      playlists: [
        { title: "lab hours", tracks: 15 },
        { title: "throwbacks", tracks: 60 },
        { title: "new finds", tracks: 12 },
      ],
      songs: [
        { title: "Levitating", artist: "Dua Lipa" },
        { title: "As It Was", artist: "Harry Styles" },
      ],
      artists: ["Dua Lipa", "Harry Styles", "Tyler, The Creator", "Doja Cat"],
    },
  ];

  // Share of artists in common, out of all artists either of you plays (Jaccard).
  function tasteMatch(friend) {
    var mine = {}, all = {}, shared = [];
    MY_ARTISTS.forEach(function (a) { mine[a] = true; all[a] = true; });
    friend.artists.forEach(function (a) {
      if (mine[a]) shared.push(a);
      all[a] = true;
    });
    var total = Object.keys(all).length;
    return { percent: total ? Math.round((shared.length / total) * 100) : 0, shared: shared };
  }

  function matchPill(percent) {
    var cls = percent >= 50 ? "good" : percent >= 20 ? "" : "warn";
    return '<span class="pill ' + cls + '">' + percent + "% match</span>";
  }

  var SAMPLE_NOTICE = '<div class="notice"><b>Sample data.</b> Friends need Crossfade ' +
    "accounts, which v1 doesn't have yet (backlog S13). None of these people are real.</div>";

  // ---------- screens ----------

  // ---------- Apple's free public charts (no key, readable from the browser) ----------

  function fetchJSON(url, ms) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, ms || 8000);
    return fetch(url, { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error("http-" + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  // The iTunes RSS feed is old and undocumented. If Apple retires it, these sections show
  // their error state and the rest of Home keeps working.
  function fetchChart(kind, limit) {
    if (DEMO === "empty") return Promise.resolve([]);
    if (DEMO === "error") return Promise.reject(new Error("demo"));
    return fetchJSON("https://itunes.apple.com/us/rss/" + kind + "/limit=" + limit + "/json")
      .then(function (d) {
        var entries = (d.feed && d.feed.entry) || [];
        if (!Array.isArray(entries)) entries = [entries];
        return entries.map(function (e) {
          var images = e["im:image"] || [];
          return {
            title: e["im:name"] ? e["im:name"].label : "",
            artist: e["im:artist"] ? e["im:artist"].label : "",
            art: images.length ? images[images.length - 1].label : "",
            url: e.id ? e.id.label : "",
            released: e["im:releaseDate"] ? e["im:releaseDate"].label : "",
          };
        });
      });
  }

  // Search only: Spotify opens its own search page, no API or key involved.
  function spotifySearchUrl(song) {
    return "https://open.spotify.com/search/" + encodeURIComponent(song.title + " " + song.artist);
  }

  function art(src, label) {
    return src
      ? '<img class="art" src="' + esc(src) + '" alt="" loading="lazy">'
      : '<span class="art art-blank" aria-hidden="true">' + esc((label || "?")[0]) + "</span>";
  }

  // ---------- screens ----------

  function renderHome() {
    view.innerHTML =
      '<div class="home">' +
        '<section class="hero span-all">' +
          "<h1>Send a playlist</h1>" +
          '<p class="muted">Paste an Apple Music playlist link. Your friend gets one link that plays in Spotify.</p>' +
          '<form class="hero-form" id="hero-form" novalidate>' +
            '<input id="hero-link" type="url" inputmode="url" autocomplete="off" aria-label="Apple Music playlist link" placeholder="https://music.apple.com/us/playlist/…">' +
            '<button class="btn" type="submit">Continue</button>' +
          "</form>" +
          '<div class="field-error" id="hero-error" role="alert"></div>' +
        "</section>" +

        '<section class="span-all">' +
          '<div class="tiles">' +
            tile("#/create", "＋", "New playlist link", "Paste and send") +
            tile("", "⎘", "Paste from clipboard", "Skip the typing", "paste") +
            tile("", "✉", "Invite a friend", "Copy the app link", "invite") +
            tile("#/friends", "☺", "Friends", "See taste matches") +
            tile("", "✎", "Fix a match", "Coming soon", "", true) +
            tile("#/settings/matching", "?", "How matching works", "Exact, close, not found") +
          "</div>" +
          '<div class="small muted" id="tile-msg" role="status" style="min-height:1.2em;margin-top:6px"></div>' +
        "</section>" +

        '<div class="col">' +
          '<section><div class="section-head"><h2>Recently added</h2><a class="small" href="#/create">Add one</a></div>' +
            '<div id="recent">' + stateBlock("Loading…", "") + "</div></section>" +

          '<section><div class="section-head"><h2>New this week</h2><span class="small muted">Released in the last 14 days</span></div>' +
            '<div id="new-songs">' + stateBlock("Loading…", "") + "</div></section>" +

          '<section><div class="section-head"><h2>Top albums</h2><span class="small muted">Apple Music, US</span></div>' +
            '<div id="top-albums">' + stateBlock("Loading…", "") + "</div></section>" +
        "</div>" +

        '<div class="col">' +
          '<section><h2>Your numbers</h2><div id="stats" class="stats">' + stateBlock("Loading…", "") + "</div></section>" +

          '<section><div class="section-head"><h2>Top songs</h2><span class="small muted">Apple Music, US</span></div>' +
            '<div class="card" id="top-songs">' + stateBlock("Loading…", "") + "</div></section>" +

          "<section><h2>Listening history</h2>" +
            '<div class="card locked"><span class="lock" aria-hidden="true">🔒</span><div>' +
              "<strong>Not available in this version</strong>" +
              '<p class="small muted" style="margin:4px 0 0">Showing what you\'ve played means signing in to ' +
              "Apple Music, and Crossfade doesn't ask anyone to sign in yet (ADR 0006, backlog S12).</p>" +
            "</div></div></section>" +
        "</div>" +
      "</div>";

    document.getElementById("hero-form").onsubmit = function (e) {
      e.preventDefault();
      var link = document.getElementById("hero-link").value;
      var problem = checkAppleLink(link);
      if (problem) { document.getElementById("hero-error").textContent = problem; return; }
      storage("crossfade-prefill", link.trim());
      location.hash = "#/create";
    };
    wireTiles();
    loadRecent();
    loadCharts();
  }

  function tile(href, icon, label, sub, action, disabled) {
    var inner = '<span class="tile-ico" aria-hidden="true">' + icon + "</span>" +
      '<span class="tile-label">' + esc(label) + '</span><span class="tile-sub">' + esc(sub) + "</span>";
    if (href) return '<a class="tile" href="' + href + '">' + inner + "</a>";
    return '<button class="tile" type="button"' + (action ? ' data-action="' + action + '"' : "") +
      (disabled ? " disabled" : "") + ">" + inner + "</button>";
  }

  function wireTiles() {
    var msg = document.getElementById("tile-msg");
    view.querySelectorAll("[data-action]").forEach(function (b) {
      b.onclick = function () {
        var action = b.getAttribute("data-action");
        msg.textContent = "";
        if (action === "paste") {
          if (!navigator.clipboard || !navigator.clipboard.readText) {
            msg.textContent = "This browser won't share the clipboard. Paste into the box above instead.";
            return;
          }
          navigator.clipboard.readText().then(function (text) {
            document.getElementById("hero-link").value = text;
            document.getElementById("hero-form").requestSubmit();
          }).catch(function () {
            msg.textContent = "The clipboard was blocked. Paste into the box above instead.";
          });
        }
        if (action === "invite") {
          var link = location.origin + location.pathname;
          var done = function () { msg.textContent = "Copied " + link; };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link).then(done, function () { msg.textContent = "Copy this link: " + link; });
          } else {
            msg.textContent = "Copy this link: " + link;
          }
        }
      };
    });
  }

  function loadRecent() {
    var box = document.getElementById("recent");
    var stats = document.getElementById("stats");
    box.innerHTML = stateBlock("Loading…", "");

    fetchRecentLinks().then(function (rows) {
      if (!document.body.contains(box)) return; // user navigated away
      renderStats(stats, rows);
      if (!rows.length) {
        box.innerHTML = '<div class="card">' + stateBlock("Nothing added yet",
          "Paste an Apple Music playlist link and it shows up here.",
          '<a class="btn quiet" href="#/create">Send your first playlist</a>') + "</div>";
        return;
      }
      box.innerHTML = '<div class="grid-cards">' + rows.slice(0, 6).map(function (r) {
        var complete = r.matched_count === r.track_count;
        return '<div class="card playlist-card">' + art("", r.title) +
          '<div class="grow"><div class="title">' + esc(r.title) + "</div>" +
          '<div class="small muted">Added ' + esc(formatDate(r.created_at)) + " · " + esc(r.track_count) + " songs</div>" +
          '<span class="pill ' + (complete ? "good" : "warn") + '" style="margin-top:6px">Matched ' +
          esc(r.matched_count) + " of " + esc(r.track_count) + "</span></div></div>";
      }).join("") + "</div>";
    }).catch(function (err) {
      if (!document.body.contains(box)) return;
      stats.innerHTML = '<div class="card">' + stateBlock("No numbers yet", "They come from the same database.") + "</div>";
      if (err.message === "not-configured") {
        box.innerHTML = '<div class="card">' + stateBlock("Supabase isn't connected yet",
          "Add your Project URL and publishable key to src/config.js, then reload.") + "</div>";
        return;
      }
      box.innerHTML = '<div class="card">' + stateBlock("Couldn't load your playlists",
        "Crossfade couldn't reach its database. Nothing you sent is lost.",
        '<button class="btn quiet" type="button" id="retry">Try again</button>') + "</div>";
      document.getElementById("retry").onclick = loadRecent;
    });
  }

  function renderStats(box, rows) {
    var tracks = 0, matched = 0;
    rows.forEach(function (r) { tracks += r.track_count; matched += r.matched_count; });
    var rate = tracks ? Math.round((matched / tracks) * 100) + "%" : "—";
    box.innerHTML =
      '<div class="stat"><span class="stat-n">' + rows.length + '</span><span class="stat-l">Playlists sent</span></div>' +
      '<div class="stat"><span class="stat-n">' + matched + '</span><span class="stat-l">Songs matched</span></div>' +
      '<div class="stat"><span class="stat-n">' + rate + '</span><span class="stat-l">Match rate</span></div>';
  }

  function loadCharts() {
    var newBox = document.getElementById("new-songs");
    var songBox = document.getElementById("top-songs");
    var albumBox = document.getElementById("top-albums");
    var retry = function (id) {
      return '<button class="btn quiet" type="button" data-retry="' + id + '">Try again</button>';
    };
    var chartError = function (box) {
      box.innerHTML = '<div class="card">' + stateBlock("Couldn't load Apple's chart",
        "This comes from Apple, not Crossfade. Your playlists aren't affected.", retry("charts")) + "</div>";
      box.querySelector("[data-retry]").onclick = loadCharts;
    };

    fetchChart("topsongs", 25).then(function (songs) {
      if (!document.body.contains(songBox)) return;
      var cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      var fresh = songs.filter(function (s) { return new Date(s.released).getTime() >= cutoff; });

      newBox.innerHTML = fresh.length
        ? '<div class="hscroll">' + fresh.slice(0, 12).map(function (s) {
            return '<div class="song-card">' + art(s.art, s.title) +
              '<div class="title">' + esc(s.title) + '</div><div class="small muted ellipsis">' + esc(s.artist) + "</div>" +
              '<a class="small" href="' + esc(spotifySearchUrl(s)) + '" target="_blank" rel="noopener">Find on Spotify</a></div>';
          }).join("") + "</div>"
        : '<div class="card">' + stateBlock("Nothing new in this week's chart",
            "None of the top songs came out in the last 14 days.") + "</div>";

      songBox.innerHTML = songs.length
        ? '<ol class="list ranked">' + songs.slice(0, 10).map(function (s, i) {
            return '<li class="row"><span class="rank">' + (i + 1) + "</span>" + art(s.art, s.title) +
              '<div class="grow"><div class="title">' + esc(s.title) + '</div><div class="small muted ellipsis">' + esc(s.artist) + "</div></div>" +
              '<a class="pill" href="' + esc(spotifySearchUrl(s)) + '" target="_blank" rel="noopener" aria-label="Find ' + esc(s.title) + ' on Spotify">Spotify ↗</a></li>';
          }).join("") + "</ol>"
        : stateBlock("The chart is empty", "Apple didn't return any songs this time.");
    }).catch(function () {
      if (!document.body.contains(songBox)) return;
      chartError(newBox);
      songBox.innerHTML = stateBlock("Couldn't load Apple's chart", "Try again in a moment.");
    });

    fetchChart("topalbums", 12).then(function (albums) {
      if (!document.body.contains(albumBox)) return;
      albumBox.innerHTML = albums.length
        ? '<div class="hscroll">' + albums.map(function (a) {
            return '<a class="song-card" href="' + esc(a.url) + '" target="_blank" rel="noopener">' + art(a.art, a.title) +
              '<div class="title">' + esc(a.title) + '</div><div class="small muted ellipsis">' + esc(a.artist) + "</div></a>";
          }).join("") + "</div>"
        : '<div class="card">' + stateBlock("No albums right now", "Apple didn't return any albums this time.") + "</div>";
    }).catch(function () {
      if (!document.body.contains(albumBox)) return;
      chartError(albumBox);
    });
  }

  // PRD R1: the link must be an https/http music.apple.com US playlist link.
  function checkAppleLink(raw) {
    var url;
    try { url = new URL(raw.trim()); } catch (e) { return "That isn't an Apple Music playlist link."; }
    var parts = url.pathname.split("/").filter(Boolean); // [storefront, "playlist", slug, id]
    if (!/^https?:$/.test(url.protocol) || url.hostname !== "music.apple.com" || parts[1] !== "playlist") {
      return "That isn't an Apple Music playlist link.";
    }
    if (parts[0] !== "us") return "Crossfade only handles US Apple Music links.";
    return null;
  }

  function renderCreate(tab) {
    tab = tab === "search" ? "search" : "link";
    view.innerHTML =
      "<h1>Create</h1>" +
      '<p class="muted">Turn an Apple Music playlist into one your friend can play in Spotify.</p>' +
      '<div class="tabs-inline" role="tablist">' +
        '<button type="button" role="tab" data-tab="link" aria-selected="' + (tab === "link") + '">Paste a link</button>' +
        '<button type="button" role="tab" data-tab="search" aria-selected="' + (tab === "search") + '">Search songs</button>' +
      "</div>" +
      '<div id="create-body"></div>';

    view.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () { renderCreate(b.getAttribute("data-tab")); };
    });

    var body = document.getElementById("create-body");
    if (tab === "search") {
      body.innerHTML =
        '<div class="card">' +
          '<label for="q">Search songs</label>' +
          '<input id="q" type="search" placeholder="Song or artist" disabled>' +
          '<p class="small muted" style="margin-top:10px">Searching Apple Music needs a developer ' +
          "key that has to stay on a server, so it can't run in this page. It arrives with the " +
          "Supabase Edge Function in Week 9.</p>" +
        "</div>";
      return;
    }

    body.innerHTML =
      '<form class="card" id="create-form" novalidate>' +
        '<label for="link">Apple Music link</label>' +
        '<input id="link" type="url" inputmode="url" autocomplete="off" placeholder="https://music.apple.com/us/playlist/…">' +
        '<div class="field-error" id="link-error" role="alert"></div>' +
        '<label for="passcode">Passcode</label>' +
        '<input id="passcode" type="password" autocomplete="current-password">' +
        '<div class="field-error" id="pass-error" role="alert"></div>' +
        '<div style="margin-top:18px"><button class="btn block" type="submit">Create link</button></div>' +
        '<p class="small muted" style="margin-top:12px">In Apple Music: open the playlist, tap ' +
        "Share, then Copy Link.</p>" +
      "</form>" +
      '<div id="create-result"></div>';

    var prefill = storage("crossfade-prefill");
    if (prefill) { document.getElementById("link").value = prefill; storage("crossfade-prefill", null); }

    document.getElementById("create-form").onsubmit = function (e) {
      e.preventDefault();
      var link = document.getElementById("link").value;
      var pass = document.getElementById("passcode").value;
      var linkErr = document.getElementById("link-error");
      var passErr = document.getElementById("pass-error");
      var result = document.getElementById("create-result");
      linkErr.textContent = passErr.textContent = result.innerHTML = "";

      // Same order as PRD R1: passcode, then link format.
      if (!pass) { passErr.textContent = "Enter the passcode."; return; }
      var problem = checkAppleLink(link);
      if (problem) { linkErr.textContent = problem; return; }

      if (DEMO === "error") {
        result.innerHTML = '<div class="notice error">Something failed on Apple Music\'s side. ' +
          "Nothing was sent. Try again.</div>";
        return;
      }
      result.innerHTML = '<div class="notice"><b>That link looks right.</b> Building the Spotify ' +
        "playlist isn't wired up yet (Week 9), so nothing was sent and nothing was saved.</div>";
    };
  }

  function renderFriends() {
    var list = DEMO === "empty" ? [] : FRIENDS;
    var html = "<h1>Friends</h1>" + SAMPLE_NOTICE;

    if (DEMO === "error") {
      html += '<div class="card">' + stateBlock("Couldn't load your friends",
        "Crossfade couldn't reach its database. Try again in a moment.",
        '<button class="btn quiet" type="button" onclick="location.reload()">Try again</button>') + "</div>";
    } else if (!list.length) {
      html += '<div class="card">' + stateBlock("No friends yet",
        "When accounts exist, you'll add a friend by sending them your Crossfade link.") + "</div>";
    } else {
      html += '<div class="friend-grid">' + list.map(function (f) {
        var m = tasteMatch(f);
        return '<a class="card friend-card" href="#/friends/' + esc(f.id) + '">' +
          '<div class="row" style="padding:0;border:0"><span class="avatar">' + esc(f.name[0]) + "</span>" +
          '<div class="grow"><div class="title">' + esc(f.name) + "</div>" +
          '<div class="small muted">' + esc(f.service) + " · " + f.playlists.length + (f.playlists.length === 1 ? " playlist" : " playlists") + "</div></div>" +
          matchPill(m.percent) + "</div>" +
          '<div class="meter" style="margin:14px 0 8px"><span style="width:' + m.percent + '%"></span></div>' +
          '<div class="small muted ellipsis">' + (m.shared.length ? "Both play " + m.shared.slice(0, 3).map(esc).join(", ") : "No shared artists yet") + "</div>" +
          '<div class="small muted ellipsis" style="margin-top:4px">Latest: ' + esc(f.songs[0].title) + " · " + esc(f.songs[0].artist) + "</div></a>";
      }).join("") + "</div>";
    }
    view.innerHTML = html;
  }

  function renderFriend(id, tab) {
    var f = FRIENDS.filter(function (x) { return x.id === id; })[0];
    if (!f) {
      view.innerHTML = '<a class="back" href="#/friends">‹ Friends</a>' +
        '<div class="card">' + stateBlock("That friend isn't here",
          "They may have been removed, or the link is wrong.") + "</div>";
      return;
    }
    tab = tab === "songs" ? "songs" : "playlists";
    var m = tasteMatch(f);

    var items = tab === "songs"
      ? f.songs.map(function (s) {
          return '<li class="row"><div class="grow"><div class="title">' + esc(s.title) +
            '</div><div class="small muted">' + esc(s.artist) + "</div></div></li>";
        })
      : f.playlists.map(function (p) {
          return '<li class="row"><div class="grow"><div class="title">' + esc(p.title) +
            '</div><div class="small muted">' + p.tracks + " songs</div></div></li>";
        });

    view.innerHTML =
      '<a class="back" href="#/friends">‹ Friends</a>' +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
        '<span class="avatar">' + esc(f.name[0]) + "</span>" +
        '<div><h1 style="margin:0">' + esc(f.name) + '</h1><div class="small muted">On ' + esc(f.service) + "</div></div>" +
      "</div>" +
      SAMPLE_NOTICE +

      '<div class="card">' +
        '<div class="small muted">How similar your music is</div>' +
        '<div class="big-number" style="margin:6px 0 10px">' + m.percent + "%</div>" +
        '<div class="meter" role="img" aria-label="' + m.percent + ' percent taste match"><span style="width:' + m.percent + '%"></span></div>' +
        '<p class="small" style="margin-top:12px">' +
          (m.shared.length
            ? "You both listen to <b>" + m.shared.map(esc).join(", ") + "</b>."
            : "You don't share any artists yet. Something new to send them.") +
        "</p>" +
        '<p class="small muted" style="margin:0">Artists you both play, out of every artist either of you plays.</p>' +
      "</div>" +

      '<div class="tabs-inline" role="tablist">' +
        '<button type="button" role="tab" data-tab="playlists" aria-selected="' + (tab === "playlists") + '">Playlists</button>' +
        '<button type="button" role="tab" data-tab="songs" aria-selected="' + (tab === "songs") + '">Songs</button>' +
      "</div>" +
      '<div class="card">' + (items.length
        ? '<ul class="list">' + items.join("") + "</ul>"
        : stateBlock("Nothing here yet", f.name + " hasn't shared any " + tab + ".")) + "</div>";

    view.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () { renderFriend(id, b.getAttribute("data-tab")); };
    });
  }

  function renderSettings() {
    var theme = storage("crossfade-theme") || "system";
    view.innerHTML =
      "<h1>Settings</h1>" +

      '<div class="two-col"><section><h2>Account</h2>' +
      '<div class="card">' +
        '<div class="notice">Accounts arrive with the Lab 5 login (backlog S14). Until then ' +
        "these are placeholders and nothing here is saved.</div>" +
        '<label for="email">Email</label>' +
        '<input id="email" type="email" placeholder="you@example.com" disabled>' +
        '<label for="pw">Password</label>' +
        '<input id="pw" type="password" value="placeholder" disabled>' +
        '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">' +
          '<button class="btn quiet" type="button" disabled>Change password</button>' +
          '<button class="btn quiet" type="button" disabled>Sign out</button>' +
        "</div>" +
      "</div>" +

      "</section><section><h2>Sending</h2>" +
      '<div class="card"><dl class="kv">' +
        "<div><dt>Passcode</dt><dd>Asked each time. Never saved on this device.</dd></div>" +
        "<div><dt>Region</dt><dd>US Apple Music and US Spotify only</dd></div>" +
        "<div><dt>Playlist size</dt><dd>1 to 100 songs</dd></div>" +
        "<div><dt>Stored on</dt><dd>Crossfade's own Spotify account. Never yours, never your friend's.</dd></div>" +
      "</dl></div>" +

      "</section><section><h2>Appearance</h2>" +
      '<div class="card"><div class="segmented" role="group" aria-label="Theme">' +
        ["system", "light", "dark"].map(function (t) {
          return '<button type="button" data-theme-choice="' + t + '" aria-pressed="' + (theme === t) + '">' +
            t[0].toUpperCase() + t.slice(1) + "</button>";
        }).join("") +
      "</div></div>" +

      '</section><section><h2 id="matching">How matching works</h2>' +
      '<div class="card"><dl class="kv">' +
        '<div><dt><span class="pill good">Exact</span></dt><dd>Same recording, found by its ID code (ISRC)</dd></div>' +
        '<div><dt><span class="pill">Close</span></dt><dd>Same title and artist. Shown with Spotify\'s version so you can check it.</dd></div>' +
        '<div><dt><span class="pill warn">Not found</span></dt><dd>Left out and listed by name. Never swapped for a different song.</dd></div>' +
      "</dl></div>" +

      "</section><section><h2>What Crossfade can't do</h2>" +
      '<div class="card"><ul class="small" style="margin:0;padding-left:18px">' +
        "<li>Move audio or downloaded songs between apps. Songs are locked to each person's own subscription.</li>" +
        "<li>Set crossfade or transitions. That's a setting in your own music app.</li>" +
        "<li>Play in sync across apps. No music app lets another app control playback timing.</li>" +
        "<li>Match every song. Remixes, live versions, and clean or explicit versions sometimes don't line up.</li>" +
      "</ul></div>" +

      "</section><section><h2>About</h2>" +
      '<div class="card"><dl class="kv"><div><dt>Version</dt><dd>0.1.0 (local)</dd></div>' +
        "<div><dt>Database</dt><dd>" + (supabaseConfigured() ? "Supabase connected" : "Not connected") + "</dd></div>" +
        "<div><dt>Charts</dt><dd>Apple Music's public US chart</dd></div>" +
      "</dl></div></section></div>";

    view.querySelectorAll("[data-theme-choice]").forEach(function (b) {
      b.onclick = function () {
        var t = b.getAttribute("data-theme-choice");
        storage("crossfade-theme", t === "system" ? null : t);
        applyTheme();
        renderSettings();
      };
    });
  }

  function renderNotFound() {
    view.innerHTML = '<div class="card">' + stateBlock("This page doesn't exist",
      "The link may be wrong.", '<a class="btn quiet" href="#/home">Go home</a>') + "</div>";
  }

  // ---------- router ----------

  function applyTheme() {
    var t = storage("crossfade-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }

  function route() {
    var parts = (location.hash.replace(/^#\/?/, "") || "home").split("/");
    var page = parts[0];

    document.querySelectorAll(".tab").forEach(function (a) {
      if (a.getAttribute("data-route") === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    if (page === "home") renderHome();
    else if (page === "create") renderCreate();
    else if (page === "friends" && parts[1]) renderFriend(parts[1]);
    else if (page === "friends") renderFriends();
    else if (page === "settings") {
      renderSettings();
      if (parts[1]) {
        var target = document.getElementById(parts[1]);
        if (target) { target.scrollIntoView(); return; }
      }
    }
    else renderNotFound();

    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }

  applyTheme();
  window.addEventListener("hashchange", route);
  route();
})();
