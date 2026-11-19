// Crossfade front end. No framework and no build step: hash routes render into #view.
// Add ?demo=empty or ?demo=error to the URL to see each screen's empty or error state.
// Create plays back a recorded create-link run until the real one is deployed (ADR 0015).
(function () {
  "use strict";

  var view = document.getElementById("view");
  var DEMO = new URLSearchParams(location.search).get("demo"); // "empty" | "error" | null

  // ---------- helpers ----------

  var esc = window.CrossfadeUI.esc, stateBlock = window.CrossfadeUI.stateBlock; // ui.js (ADR 0023)

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
            tile("#/friends", "☺", "Friends", "Who you share with") +
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

  // ---------- your links (create, read, rename, delete; ADR 0010) ----------

  var LINK_ERRORS = {
    "title-empty": "Give the playlist a name.",
    "title-too-long": "Keep the name to " + window.CrossfadeLinks.MAX_TITLE + " characters or fewer.",
    "not-found": "That link was already deleted, maybe in another tab. Nothing else changed.",
    "read-failed": "Couldn't read the links saved on this device, so nothing was saved.",
    "write-failed": "Couldn't save on this device. Nothing changed.",
  };

  function linkError(err) {
    return LINK_ERRORS[err && err.name] || "Something went wrong. Nothing changed.";
  }

  function recipientUrl(code) {
    return location.origin + location.pathname.replace(/[^/]*$/, "") + "p.html?code=" + encodeURIComponent(code);
  }

  // The one row being renamed or deleted: { code, kind: "rename" | "delete", value, error }, or null.
  var linkMode = null;

  // notice: a message above the list, for a change that no longer has a row to show it in.
  function loadMyLinks(mode, notice) {
    var box = document.getElementById("my-links");
    if (!box) return;
    linkMode = mode || null;
    var top = notice ? '<div class="notice" role="status">' + esc(notice) + "</div>" : "";
    var rows;
    try { rows = window.CrossfadeLinks.list(); } catch (e) {
      box.innerHTML = '<div class="card">' + stateBlock("Couldn't read your links",
        "This browser wouldn't open Crossfade's saved links. Nothing was deleted.",
        '<button class="btn quiet" type="button" id="links-retry">Try again</button>') + "</div>";
      document.getElementById("links-retry").onclick = function () { loadMyLinks(); };
      return;
    }
    if (linkMode && !rows.some(function (r) { return r.code === linkMode.code; })) linkMode = null;
    if (!rows.length) {
      box.innerHTML = top + '<div class="card">' + stateBlock("No links yet",
        "Links you make on Create show up here, so you can rename or delete them.",
        '<a class="btn quiet" href="#/create">Make a link</a>') + "</div>";
      return;
    }

    // While one row is being changed, the others wait, so a half-typed name can't be lost.
    var busy = linkMode ? " disabled" : "";
    box.innerHTML = top + '<div class="card"><ul class="list" id="my-links-list">' + rows.map(function (r) {
      var editing = linkMode && linkMode.code === r.code ? linkMode : null;
      // ADR 0028: cover, name, Playlist · owner, like a music app's library row.
      var owner = (r.report && r.report.owner) || "";
      var head = window.CrossfadeReport.cover(r.report && r.report.artwork, "row-art") +
        '<div class="grow"><a class="title" href="#/links/' + esc(r.code) + '">' + esc(r.title) + "</a>" +
        '<div class="small muted">Playlist' + (owner ? " · " + esc(owner) : "") +
        " · Made " + esc(formatDate(r.created_at)) + "</div>";
      var err = editing && editing.error ? '<div class="field-error" role="alert">' + esc(editing.error) + "</div>" : "";

      if (editing && editing.kind === "rename") {
        return '<li class="row link-row" data-code="' + esc(r.code) + '"><form class="grow link-edit" data-rename-form novalidate>' +
          '<label for="rename-' + esc(r.code) + '">New name</label>' +
          '<input id="rename-' + esc(r.code) + '" type="text" value="' + esc(editing.value != null ? editing.value : r.title) + '">' +
          err + '<div class="link-actions"><button class="btn" type="submit">Save</button>' +
          '<button class="btn quiet" type="button" data-cancel>Cancel</button></div></form></li>';
      }
      if (editing && editing.kind === "delete") {
        return '<li class="row link-row" data-code="' + esc(r.code) + '"><div class="grow">' +
          "<div>Delete <b>" + esc(r.title) + "</b>? Anyone you sent it to will see it was removed.</div>" + err +
          '<div class="link-actions"><button class="btn danger" type="button" data-confirm-delete>Delete</button>' +
          '<button class="btn quiet" type="button" data-cancel>Cancel</button></div></div></li>';
      }
      return '<li class="row link-row pl-row" data-code="' + esc(r.code) + '">' + head + "</div>" +
        '<div class="link-actions"><button class="pill" type="button" data-rename' + busy + ">Rename</button>" +
        '<button class="pill warn" type="button" data-delete' + busy + ">Delete</button></div></li>";
    }).join("") + "</ul></div>";

    // A change that hits a link another tab already deleted gets the notice, not a silent empty list.
    var gone = function (code, e) {
      if (e && e.name === "not-found") loadMyLinks(null, linkError(e));
      else loadMyLinks({ code: code, kind: linkMode.kind, value: linkMode.value, error: linkError(e) });
    };

    box.querySelectorAll(".link-row").forEach(function (li) {
      var code = li.getAttribute("data-code");
      var on = function (sel, fn) { var el = li.querySelector(sel); if (el) el.onclick = fn; };
      on("[data-rename]", function () { loadMyLinks({ code: code, kind: "rename" }); focusIn(code); });
      on("[data-delete]", function () {
        loadMyLinks({ code: code, kind: "delete" });
        var b = box.querySelector("[data-confirm-delete]"); if (b) b.focus();
      });
      on("[data-cancel]", function () { loadMyLinks(); });
      on("[data-confirm-delete]", function () {
        try { window.CrossfadeLinks.remove(code); loadMyLinks(); } catch (e) { gone(code, e); }
      });
      if (li.querySelector("[data-cancel]")) li.onkeydown = function (e) {
        if (e.key === "Escape") { e.preventDefault(); loadMyLinks(); }
      };
      var form = li.querySelector("[data-rename-form]");
      if (form) form.onsubmit = function (e) {
        e.preventDefault();
        var value = form.querySelector("input").value;
        linkMode.value = value;
        try { window.CrossfadeLinks.rename(code, value); loadMyLinks(); } catch (err) { gone(code, err); }
      };
    });
  }

  function focusIn(code) {
    var input = document.getElementById("rename-" + code);
    if (input) { input.focus(); input.select(); }
  }

  // Another tab changed the saved links. Redraw Home, unless a row here is mid-change:
  // then that row's Save or Delete finds out and says so.
  window.addEventListener("storage", function (e) {
    if (e.key === window.CrossfadeLinks.KEY && !linkMode) loadMyLinks();
  });

  // Recently added and Your numbers: only the signed-in account's own links (ADR 0021).
  // Someone new, or signed out, sees the empty states. TODO(W10): real data. Phase 10 reads
  // the sender's own rows from the database instead, so they show on every device.
  function loadRecent() {
    var box = document.getElementById("recent");
    var stats = document.getElementById("stats");
    var rows;
    try {
      rows = window.CrossfadeAuth.user() ? window.CrossfadeLinks.list() : [];
    } catch (err) {
      stats.innerHTML = '<div class="card">' + stateBlock("No numbers yet", "They come from your saved playlists.") + "</div>";
      box.innerHTML = '<div class="card">' + stateBlock("Couldn't load your playlists",
        "This browser wouldn't open your saved playlists. Nothing was deleted.",
        '<button class="btn quiet" type="button" id="retry">Try again</button>') + "</div>";
      document.getElementById("retry").onclick = loadRecent;
      return;
    }
    rows = rows.map(function (r) {
      var t = (r.report && r.report.tracks) || [];
      return { code: r.code, title: r.title, created_at: r.created_at, track_count: t.length,
        matched_count: t.filter(function (x) { return x.tier !== "unmatched"; }).length };
    });
    if (!rows.length) {
      stats.innerHTML = '<div class="card">' + stateBlock("No numbers yet", "Send a playlist and they show up here.") + "</div>";
      box.innerHTML = '<div class="card">' + stateBlock("Nothing added yet",
        "Paste an Apple Music playlist link and it shows up here.",
        '<a class="btn quiet" href="#/create">Send your first playlist</a>') + "</div>";
      return;
    }
    renderStats(stats, rows);
    box.innerHTML = '<div class="grid-cards">' + rows.slice(0, 6).map(function (r) {
      var complete = r.matched_count === r.track_count;
      return '<a class="card playlist-card" href="#/links/' + esc(r.code) + '">' + art("", r.title) +
        '<div class="grow"><div class="title">' + esc(r.title) + "</div>" +
        '<div class="small muted">Added ' + esc(formatDate(r.created_at)) + " · " + esc(r.track_count) + " songs</div>" +
        '<span class="pill ' + (complete ? "good" : "warn") + '" style="margin-top:6px">Matched ' +
        esc(r.matched_count) + " of " + esc(r.track_count) + "</span></div></a>";
    }).join("") + "</div>";
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

    // The top 100, so New this week finds more than the handful of new songs in the top 25.
    // Top songs still shows only the first 10.
    fetchChart("topsongs", 100).then(function (songs) {
      if (!document.body.contains(songBox)) return;
      var cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      var fresh = songs.filter(function (s) { return new Date(s.released).getTime() >= cutoff; });

      newBox.innerHTML = fresh.length
        ? '<div class="hscroll">' + fresh.slice(0, 12).map(function (s) {
            return '<a class="song-card" href="' + esc(spotifySearchUrl(s)) + '" target="_blank" rel="noopener" aria-label="' +
              esc(s.title) + ", " + esc(s.artist) + ', open in Spotify">' + art(s.art, s.title) +
              '<div class="title">' + esc(s.title) + '</div><div class="small muted ellipsis">' + esc(s.artist) + "</div></a>";
          }).join("") + "</div>"
        : '<div class="card">' + stateBlock("Nothing new in this week's chart",
            "None of the top songs came out in the last 14 days.") + "</div>";

      songBox.innerHTML = songs.length
        ? '<ol class="list ranked">' + songs.slice(0, 10).map(function (s, i) {
            return '<li class="song"><a class="row song-link" href="' + esc(spotifySearchUrl(s)) + '" target="_blank" rel="noopener" aria-label="' +
              esc(s.title) + ", " + esc(s.artist) + ', open in Spotify"><span class="rank">' + (i + 1) + "</span>" + art(s.art, s.title) +
              '<div class="grow"><div class="title">' + esc(s.title) + '</div><div class="small muted ellipsis">' + esc(s.artist) + "</div></div></a></li>";
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
            // ADR 0022: albums open Spotify's search too, like songs, not Apple Music.
            return '<a class="song-card" href="' + esc(spotifySearchUrl(a)) + '" target="_blank" rel="noopener" aria-label="' +
              esc(a.title) + ", " + esc(a.artist) + ', open in Spotify">' + art(a.art, a.title) +
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

  // Links made today in this browser. Deleted links don't count here; on the server they will.
  function linksToday() {
    var today = new Date().toDateString();
    try {
      return window.CrossfadeLinks.list().filter(function (r) { return new Date(r.created_at).toDateString() === today; }).length;
    } catch (e) { return 0; }
  }

  function renderCreate() {
    view.innerHTML =
      "<h1>Create</h1>" +
      '<p class="muted">Turn an Apple Music playlist into one your friend can play in Spotify.</p>' +
      '<div id="create-body"></div>';

    var body = document.getElementById("create-body");
    if (!window.CrossfadeAuth.user()) {
      body.innerHTML = '<div class="card" id="create-signin">' + stateBlock("Sign in to make a link",
        "Your friend won't need to sign in to play it.", signInButton()) + "</div>";
      wireSignIn(body);
      return;
    }
    body.innerHTML =
      '<form class="card" id="create-form" novalidate>' +
        '<label for="title">Playlist name</label>' +
        '<input id="title" type="text" autocomplete="off" placeholder="What your friend will see">' +
        '<div class="field-error" id="title-error" role="alert"></div>' +
        '<label for="link">Apple Music link</label>' +
        '<input id="link" type="url" inputmode="url" autocomplete="off" placeholder="https://music.apple.com/us/playlist/…">' +
        '<div class="field-error" id="link-error" role="alert"></div>' +
        '<div style="margin-top:18px"><button class="btn block" type="submit">Create link</button></div>' +
        '<p class="small muted" style="margin-top:12px">In Apple Music: open the playlist, tap ' +
        "Share, then Copy Link.</p>" +
      "</form>" +
      '<div id="create-result"></div>';

    var prefill = storage("crossfade-prefill");
    if (prefill) { document.getElementById("link").value = prefill; storage("crossfade-prefill", null); }

    document.getElementById("create-form").onsubmit = function (e) {
      e.preventDefault();
      var title = document.getElementById("title").value;
      var link = document.getElementById("link").value;
      var titleErr = document.getElementById("title-error");
      var linkErr = document.getElementById("link-error");
      var result = document.getElementById("create-result");
      var submit = e.target.querySelector("button[type=submit]");
      titleErr.textContent = linkErr.textContent = result.innerHTML = "";

      // Signed out in another tab since this form opened: back to the sign-in card.
      if (!window.CrossfadeAuth.user()) { renderCreate(); return; }

      // Every field error shows at once. Focus goes to the first in PRD R1 order:
      // link format, then the name. Sign-in replaced the passcode (ADR 0019).
      var titleProblem = window.CrossfadeLinks.checkTitle(title);
      var problems = [
        [checkAppleLink(link), linkErr, "link"],
        [titleProblem && linkError({ name: titleProblem }), titleErr, "title"],
      ].filter(function (p) { return p[0]; });
      problems.forEach(function (p) { p[1].textContent = p[0]; });
      if (problems.length) { document.getElementById(problems[0][2]).focus(); return; }

      // ADR 0019: 10 links a day per account. TODO(W10): real data. create-link counts
      // them on the server; until it deploys, this counts the links saved in this browser.
      if (linksToday() >= window.CrossfadeAuth.DAILY_LIMIT) {
        result.innerHTML = '<div class="notice error" id="limit-error">You\'ve made ' + window.CrossfadeAuth.DAILY_LIMIT +
          " links today. You can make more tomorrow.</div>";
        return;
      }

      if (DEMO === "error") {
        result.innerHTML = '<div class="notice error">Something failed on Apple Music\'s side. ' +
          "Nothing was sent. Try again.</div>";
        return;
      }
      // Saves the link on this device (ADR 0010). reportHtml is the build report shown above it.
      var form = e.target;
      // serverCode: the code Crossfade's database saved the link under (ADR 0029). This browser
      // keeps a copy so Playlists and Home show it straight away.
      function saveLink(report, reportHtml, serverCode) {
        var made, earlier = [];
        var copyFailed = false;
        try {
          earlier = window.CrossfadeLinks.samePlaylist(link);
          made = window.CrossfadeLinks.create(title, link, report, serverCode);
        } catch (err) {
          // Saved online already (ADR 0029): the link works, only this browser's copy failed.
          if (!serverCode) {
            result.innerHTML = '<div class="notice error">' + esc(linkError(err)) + "</div>";
            return;
          }
          copyFailed = true;
          made = { code: serverCode, title: String(title || "").trim() || report.name, server: true };
        }
        var url = recipientUrl(made.code);
        result.innerHTML = (reportHtml || "") + '<div class="card" id="made-link"><a class="title" href="#/links/' + esc(made.code) + '"><strong>' + esc(made.title) + "</strong></a>" +
          '<p class="small" style="margin:6px 0"><a id="made-url" href="' + esc(url) + '">' + esc(url) + "</a></p>" +
          '<button class="btn quiet" type="button" id="share-made"><span aria-hidden="true">↗</span>&nbsp;Share</button> ' +
          '<span class="small muted" id="copy-msg" role="status"></span>' +
          (copyFailed ? '<div class="notice" id="copy-failed" style="margin-top:12px">Saved online, so the link works. This browser couldn\'t keep its own copy, so it may not show under Playlists here.</div>' : "") +
          (made.server ? '<p class="small muted" style="margin:10px 0 0">Your friend opens this on any phone, and plays it in Spotify without signing in.</p>'
            : '<div class="notice" style="margin-top:12px"><b>Sample link.</b> It opens on this device only.</div>') +
          (earlier.length ? '<div class="notice" style="margin-top:8px">You already had a link for this playlist (<b>' +
            esc(earlier[0].title) + "</b>). This is a separate one with its own code. Delete either on Home.</div>" : "") +
          "</div>";
        wireShare(document.getElementById("share-made"), document.getElementById("copy-msg"), made.title, url);
        // Create stays off until something is typed, so a double tap can't replace the new link with an error.
        form.reset();
        submit.disabled = true;
        form.oninput = function () { submit.disabled = false; form.oninput = null; };
      }

      // ADR 0029: match on the server, then the edit screen, then Create playlist.
      submit.disabled = true;
      var token = window.CrossfadeAuth.token();
      var buildId = crypto.randomUUID();
      var progress = showProgress(result, token, buildId);
      window.CrossfadeServer.match(token, link, buildId).then(function (m) {
        progress.stop();
        submit.disabled = false;
        editDraft(result, m, title, function (pub) {
          saveLink(Object.assign({}, pub.report, { spotify_playlist_id: pub.spotify_playlist_id }), buildReport(pub.report), pub.code);
        });
      }, function (err) {
        progress.stop();
        submit.disabled = false;
        result.innerHTML = '<div class="notice error" id="build-error" role="alert">' + esc(serverError(err)) + "</div>";
      });
    };
  }

  // What to tell the sender when a server call fails. The server's own wording comes first:
  // it already names whose side failed (PRD R1).
  function serverError(err) {
    if (err && err.name === "signed-out") return "Your sign-in ran out. Sign in again, then try once more.";
    if (err && err.message && err.name !== "network" && err.name !== "not-configured") return err.message;
    return "Couldn't reach Crossfade. Check your connection and try again. Nothing was sent.";
  }

  // PRD R1's progress lines while the server matches, read from get_build every second.
  function showProgress(box, token, buildId) {
    var stopped = false, timer = null;
    var line = function (text) {
      box.innerHTML = '<div class="card" id="build-progress" role="status" aria-live="polite"><strong>' + esc(text) + "</strong></div>";
    };
    line("Reading playlist…");
    var tick = function () {
      if (stopped) return;
      window.CrossfadeServer.getBuild(token, buildId).then(function (b) {
        if (!stopped && b && b.total > 0 && b.status === "running") line("Matching " + b.done + " of " + b.total + "…");
      }, function () { /* the match call reports failures; a missed progress read isn't one */ })
        .then(function () { if (!stopped) timer = setTimeout(tick, 1000); });
    };
    timer = setTimeout(tick, 800);
    return { stop: function () { stopped = true; clearTimeout(timer); } };
  }

  // ADR 0029: the report, editable. Leave songs out, search Spotify to add some, then
  // Create playlist. Nothing reaches Spotify until that tap. onPublished gets publish-link's answer.
  function editDraft(box, m, title, onPublished) {
    var R = window.CrossfadeReport, draft = m.report, token = window.CrossfadeAuth.token();
    var removed = {}, added = [], found = null, searchNote = "", draftError = "", busy = false, lastQuery = "";

    function kept() {
      return draft.tracks.filter(function (t) { return !removed[t.position]; }).concat(added.map(function (s) {
        return { tier: "added", title: s.title, artist: s.artists, spotify: { id: s.id, title: s.title, artists: s.artists },
          artwork: s.artwork, duration_ms: s.duration_ms, addedBy: "you" };
      }));
    }
    function goingIn() { return kept().filter(function (t) { return t.spotify; }).length; }

    function songRow(t, action, label, note, off) {
      return '<li class="row edit-row' + (off ? " left-out" : "") + '">' + R.cover(t.artwork, "row-art") +
        '<div class="grow"><div class="title">' + esc(t.title) + '</div><div class="small muted">' + esc(t.artist) + "</div>" +
        (note ? '<div class="small' + (off ? "" : " muted") + '">' + note + "</div>" : "") + "</div>" +
        '<span class="time small muted">' + esc(R.time(t.duration_ms)) + "</span>" +
        '<button class="pill" type="button" ' + action + ">" + esc(label) + "</button></li>";
    }

    function render() {
      var list = kept(), n = goingIn();
      var rows = draft.tracks.map(function (t) {
        var off = !!removed[t.position];
        var note = off ? "Left out" : t.tier === "unmatched" ? "Not found on Spotify (US)" + (t.near ? " · Spotify has " + esc(t.near.title) : "")
          : t.spotify && t.spotify.title !== t.title ? "On Spotify: " + esc(t.spotify.title) + " · " + esc(t.spotify.artists) : "";
        return songRow(t, 'data-toggle="' + esc(t.position) + '"', off ? "Put back" : "Remove", note, off);
      }).join("");
      var addedRows = added.map(function (s, i) {
        return songRow({ title: s.title, artist: s.artists, artwork: s.artwork, duration_ms: s.duration_ms }, 'data-unadd="' + i + '"', "Remove", "Added by you", false);
      }).join("");
      var results = found ? (found.length ? '<ul class="list" id="song-results">' + found.map(function (s, i) {
        var have = added.some(function (a) { return a.id === s.id; });
        return '<li class="row">' + R.cover(s.artwork, "row-art") + '<div class="grow"><div class="title">' + esc(s.title) +
          '</div><div class="small muted">' + esc(s.artists) + (s.explicit ? " · Explicit" : "") + "</div></div>" +
          '<span class="time small muted">' + esc(R.time(s.duration_ms)) + "</span>" +
          '<button class="pill" type="button" data-add="' + i + '"' + (have ? " disabled" : "") + ">" + (have ? "Added" : "+ Add") + "</button></li>";
      }).join("") + "</ul>" : '<p class="small muted" id="song-results">No songs found for that.</p>') : "";

      box.innerHTML = '<div class="card" id="build-report">' + reportSummary({ tracks: list }) +
        '<div class="draft-actions"><button class="btn" type="button" id="publish"' + (n === 0 || busy ? " disabled" : "") + ">" +
          (busy ? "Creating playlist…" : "Create playlist") + "</button>" +
          '<span class="small muted" id="draft-count">' + n + (n === 1 ? " song goes" : " songs go") + " in the playlist</span></div>" +
        '<div class="field-error" id="draft-error" role="alert">' + esc(draftError) + "</div>" +
        (m.publishable ? "" : '<p class="small">None of these songs were found on Spotify (US). Add songs below to make a playlist anyway.</p>') +
        '<p class="small muted">Tap Remove to leave a song out, or search to add one. Nothing reaches Spotify until you tap Create playlist.</p>' +
        // Search sits above the list, so adding a song doesn't mean scrolling past every song.
        '<form id="song-search" class="song-search" role="search"><label for="song-q">Add a song from Spotify</label>' +
          '<div class="search-row"><input id="song-q" type="search" autocomplete="off" placeholder="Song or artist" value="' + esc(lastQuery) + '">' +
          '<button class="btn quiet" type="submit">Search</button></div>' +
          '<div class="field-error" id="search-error" role="alert">' + esc(searchNote) + "</div></form>" + results +
        (added.length ? '<h3 class="small" style="margin:14px 0 4px">Songs you added</h3><ol class="list" id="added-tracks">' + addedRows + "</ol>" : "") +
        '<details open><summary class="small">All ' + esc(draft.tracks.length) + " songs from Apple Music</summary>" +
          '<ol class="list" id="draft-tracks">' + rows + "</ol></details>" +
        "</div>";
      wire();
    }

    function wire() {
      box.querySelectorAll("[data-toggle]").forEach(function (b) {
        b.onclick = function () { var p = Number(b.getAttribute("data-toggle")); removed[p] = !removed[p]; draftError = ""; render(); };
      });
      box.querySelectorAll("[data-unadd]").forEach(function (b) {
        b.onclick = function () { added.splice(Number(b.getAttribute("data-unadd")), 1); render(); };
      });
      box.querySelectorAll("[data-add]").forEach(function (b) {
        b.onclick = function () {
          var s = found[Number(b.getAttribute("data-add"))];
          if (added.length >= 50) { searchNote = "You can add up to 50 songs."; render(); return; }
          if (!added.some(function (a) { return a.id === s.id; })) added.push(s);
          draftError = ""; render();
        };
      });
      document.getElementById("song-search").onsubmit = function (e) {
        e.preventDefault();
        var q = document.getElementById("song-q").value.trim();
        lastQuery = q;
        if (!q) { searchNote = "Type a song or an artist to search."; found = null; render(); return; }
        searchNote = "Searching…"; render();
        window.CrossfadeServer.search(token, q).then(function (r) {
          found = (r && r.songs) || []; searchNote = ""; render();
          var q2 = document.getElementById("song-q"); if (q2) q2.focus();
        }, function (err) { found = null; searchNote = serverError(err); render(); });
      };
      document.getElementById("publish").onclick = function () {
        if (busy) return;
        busy = true; draftError = ""; render();
        var remove = Object.keys(removed).filter(function (k) { return removed[k]; }).map(Number);
        window.CrossfadeServer.publish(token, m.build_id, title, remove, added.map(function (s) { return s.id; })).then(function (pub) {
          busy = false; onPublished(pub);
        }, function (err) { busy = false; draftError = serverError(err); render(); });
      };
    }

    render();
  }

  // PRD R3: the headline, the misses by name, then every song (report-view.js).
  function reportSummary(report) {
    var R = window.CrossfadeReport;
    var missing = report.tracks.filter(function (t) { return t.tier === "unmatched"; });
    return '<h2 style="margin:0" id="match-headline">Matched ' + esc(R.matched(report.tracks)) + " of " + esc(R.total(report.tracks)) + "</h2>" +
      (missing.length ? '<p class="small muted" style="margin:4px 0 8px">Not on Spotify: ' +
        missing.map(function (t) { return esc(t.title); }).join(", ") + "</p>" : "");
  }

  function buildReport(report) {
    return '<div class="card" id="build-report">' +
      // Create can't read the pasted link yet, so every link gets this one recorded run (ADR 0015).
      (report.sample ? '<div class="notice" style="margin-bottom:12px">Crossfade can\'t read your link yet, so this shows a real run of <b>' +
        esc(report.name) + "</b> instead.</div>" : "") +
      reportSummary(report) +
      '<details><summary class="small">All ' + esc(report.tracks.length) + " songs</summary>" +
      window.CrossfadeReport.list(report.tracks) + "</details></div>";
  }

  // A link you made: its songs, each opening in Spotify.
  function renderLink(code) {
    var link;
    try { link = window.CrossfadeLinks.get(code); } catch (e) {
      view.innerHTML = '<a class="back" href="#/playlists/made">‹ Playlists</a><div class="card">' + stateBlock("Couldn't open this link",
        "Crossfade couldn't read the links saved on this device. Nothing was deleted.",
        '<button class="btn quiet" type="button" onclick="location.reload()">Try again</button>') + "</div>";
      return;
    }
    if (!link || link.deleted_at) {
      view.innerHTML = '<a class="back" href="#/playlists/made">‹ Playlists</a><div class="card">' + stateBlock(
        link ? "You deleted this link" : "That link isn't here", link ? "Anyone you sent it to sees it was removed." : "It may have been made on another device.",
        '<a class="btn quiet" href="#/create">Make a link</a>') + "</div>";
      return;
    }
    var url = recipientUrl(link.code);
    var report = link.report;
    var play = report && window.CrossfadeReport.playlistUrl(report.spotify_playlist_id);
    var hasSongs = !!(report && report.tracks.length);
    view.innerHTML = '<a class="back" href="#/playlists/made">‹ Playlists</a>' +
      window.CrossfadeReport.header({ name: link.title, owner: report && report.owner, artwork: report && report.artwork, playUrl: play,
        share: true, extra: hasSongs ? reportSummary(report) : "",
        // TODO(W10): real data. Links live in this browser until Phase 10 saves them (ADR 0010).
        after: '<p class="small muted pl-sub" id="share-msg" role="status">Until Crossfade saves links online, a shared link opens only on this device.</p>' }) +
      '<div class="card">' + (hasSongs
        ? window.CrossfadeReport.list(report.tracks)
        : stateBlock("No songs in this link", "Make a new link to send this playlist with its songs.",
            '<a class="btn quiet" href="#/create">Make a link</a>')) + "</div>";
    wireShare(document.getElementById("share-link"), document.getElementById("share-msg"), link.title, url);
  }

  // ADR 0028: the phone's share sheet with the friend's link, or a copy where there isn't one.
  // A cancelled share sheet isn't an error, so it says nothing.
  function wireShare(btn, msg, title, url) {
    if (!btn) return;
    btn.onclick = function () {
      var copy = function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () { msg.textContent = "Link copied. Paste it in a text."; },
            function () { msg.textContent = "Couldn't copy. The link is " + url; });
        } else { msg.textContent = "Couldn't copy. The link is " + url; }
      };
      if (navigator.share) {
        navigator.share({ title: title, text: title + " on Crossfade, ready to play in Spotify", url: url })
          .catch(function (e) { if (!e || e.name !== "AbortError") copy(); });
      } else copy();
    };
  }

  // Playlists (ADR 0018): links I made, and friends' links this browser has opened.
  function renderPlaylists(which) {
    var made = which !== "received";
    document.querySelectorAll(".subtab").forEach(function (a) {
      if (a.getAttribute("data-sub") === (made ? "made" : "received")) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    view.innerHTML = "<h1>Playlists</h1>" +
      '<div class="tabs-inline playlist-tabs" role="tablist">' +
        '<button type="button" role="tab" aria-selected="' + made + '" data-go="#/playlists/made">Made by me</button>' +
        '<button type="button" role="tab" aria-selected="' + !made + '" data-go="#/playlists/received">Sent to me</button>' +
      "</div>" +
      (made ? '<div id="my-links">' : '<div id="received">') + stateBlock("Loading…", "") + "</div>";
    view.querySelectorAll("[data-go]").forEach(function (b) {
      b.onclick = function () { location.hash = b.getAttribute("data-go"); };
    });
    // Signed out there's no account to have made anything (ADR 0021).
    if (made && !window.CrossfadeAuth.user()) {
      var box = document.getElementById("my-links");
      box.innerHTML = '<div class="card" id="made-signin">' + stateBlock("Sign in to see playlists you made",
        "Your friends never need to sign in.", signInButton()) + "</div>";
      wireSignIn(box);
    } else if (made) loadMyLinks(); else loadReceived();
  }

  function loadReceived() {
    var box = document.getElementById("received");
    if (!box) return;
    var rows;
    try { rows = window.CrossfadeReceived.list(); } catch (e) {
      box.innerHTML = '<div class="card">' + stateBlock("Couldn't read your playlists",
        "This browser wouldn't open Crossfade's saved playlists. Nothing was deleted.",
        '<button class="btn quiet" type="button" id="received-retry">Try again</button>') + "</div>";
      document.getElementById("received-retry").onclick = loadReceived;
      return;
    }
    if (!rows.length) {
      box.innerHTML = '<div class="card">' + stateBlock("Nothing sent to you yet",
        "Playlists friends send you show up here once you open them.") + "</div>";
      return;
    }
    box.innerHTML = '<div class="card"><ul class="list" id="received-list">' + rows.map(function (r) {
      return '<li class="row received-row pl-row" data-code="' + esc(r.code) + '">' + window.CrossfadeReport.cover(r.artwork, "row-art") +
        '<div class="grow"><a class="title" href="' + esc(recipientUrl(r.code)) + '">' + esc(r.title) + "</a>" +
        '<div class="small muted">' + (r.sample ? "Sample · " : "Playlist · ") + (r.owner ? esc(r.owner) + " · " : "") +
        esc(r.track_count) + " songs</div></div>" +
        '<span class="pill ' + (r.matched === r.track_count ? "good" : "warn") + '">Matched ' +
        esc(r.matched) + " of " + esc(r.track_count) + "</span></li>";
    }).join("") + "</ul></div>";
  }

  window.addEventListener("storage", function (e) {
    if (e.key === window.CrossfadeReceived.KEY) loadReceived();
  });

  // Friends starts empty (ADR 0022). There are no sample friends, and no way yet to add one.
  // TODO(W10): real data. Friends would come from the database once S13 has evidence.
  function renderFriends() {
    var html = "<h1>Friends</h1>";
    if (DEMO === "error") {
      html += '<div class="card" id="friends-error">' + stateBlock("Couldn't load your friends",
        "Crossfade couldn't reach its database. Try again in a moment.",
        '<button class="btn quiet" type="button" onclick="location.reload()">Try again</button>') + "</div>";
    } else {
      html += '<div class="card" id="friends-empty">' + stateBlock("No friends yet",
        "Friends you share playlists with will show up here.") + "</div>";
    }
    view.innerHTML = html;
  }

  function renderSettings() {
    var theme = storage("crossfade-theme") || "system";
    view.innerHTML =
      "<h1>Settings</h1>" +

      '<div class="two-col"><section><h2>Sending</h2>' +
      '<div class="card"><dl class="kv">' +
        "<div><dt>Signing in</dt><dd>With Google, to make links. Your friends never sign in.</dd></div>" +
        "<div><dt>Daily limit</dt><dd>" + window.CrossfadeAuth.DAILY_LIMIT + " links a day</dd></div>" +
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

      "</section><section><h2>What Crossfade can't do</h2>" +
      '<div class="card"><ul class="small" style="margin:0;padding-left:18px">' +
        "<li>Move audio or downloaded songs between apps. Songs are locked to each person's own subscription.</li>" +
        "<li>Set crossfade or transitions. That's a setting in your own music app.</li>" +
        "<li>Play in sync across apps. No music app lets another app control playback timing.</li>" +
        "<li>Match every song. Remixes, live versions, and clean or explicit versions sometimes don't line up.</li>" +
      "</ul></div>" +

      "</section><section><h2>About</h2>" +
      '<div class="card"><dl class="kv"><div><dt>Version</dt><dd>0.1.0 (local)</dd></div>' +
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

  // ---------- account (ADR 0019) ----------

  var authError = null; // set when the trip to Google comes back with a failure

  var AUTH_ERRORS = {
    cancelled: "You cancelled signing in with Google. Nothing changed.",
    "not-configured": "Sign-in isn't set up on this copy of Crossfade.",
  };

  function signInButton() {
    return '<button class="btn" type="button" data-sign-in><span class="g-mark" aria-hidden="true">G</span>Sign in with Google</button>';
  }

  function wireSignIn(root) {
    root.querySelectorAll("[data-sign-in]").forEach(function (b) {
      b.onclick = function () {
        b.disabled = true;
        window.CrossfadeAuth.signIn().catch(function (err) {
          authError = err;
          if (location.hash === "#/account") renderAccount(); else location.hash = "#/account";
        });
      };
    });
  }

  function avatar(user, cls) {
    var initial = esc(((user && (user.name || user.email)) || "?").charAt(0).toUpperCase());
    if (user && user.avatar_url) {
      return '<span class="' + cls + '"><img src="' + esc(user.avatar_url) + '" alt="" referrerpolicy="no-referrer" data-initial="' + initial + '"></span>';
    }
    return '<span class="' + cls + '">' + (user ? initial : "&#9786;") + "</span>";
  }

  // A Google photo that won't load falls back to the first letter of the name.
  function fixAvatars(root) {
    root.querySelectorAll("img[data-initial]").forEach(function (img) {
      img.onerror = function () { img.parentNode.textContent = img.getAttribute("data-initial"); };
    });
  }

  function updateAccountIcon() {
    var link = document.getElementById("account-link");
    if (!link) return;
    var user = window.CrossfadeAuth.user();
    link.innerHTML = avatar(user, "avatar small-avatar");
    link.setAttribute("aria-label", user ? "Account: " + (user.name || user.email) : "Sign in");
    fixAvatars(link);
  }

  function renderAccount() {
    var user = window.CrossfadeAuth.user();
    var err = authError;
    authError = null;
    if (err) {
      view.innerHTML = "<h1>Account</h1>" + '<div class="card" id="account-error">' + stateBlock("Couldn't sign in with Google",
        AUTH_ERRORS[err.name] || "Google or Crossfade didn't answer. Nothing changed. Try again.", signInButton()) + "</div>";
      wireSignIn(view);
      return;
    }
    if (!user) {
      view.innerHTML = "<h1>Account</h1>" + '<div class="card" id="account-signed-out">' + stateBlock("You're not signed in",
        "Sign in to make links. Your friends never need to.", signInButton()) + "</div>";
      wireSignIn(view);
      return;
    }
    view.innerHTML = "<h1>Account</h1>" + '<div id="account-body">' + stateBlock("Loading…", "") + "</div>";
    var box = document.getElementById("account-body");
    window.CrossfadeAuth.current().then(function (session) {
      if (!session) { renderAccount(); return null; }
      return window.CrossfadeProfiles.mine(session).then(function (profile) {
        if (!document.body.contains(box)) return;
        if (profile) showProfile(box, session, profile);
        else profileForm(box, session, null);
      });
    }).catch(function (err) {
      if (!document.body.contains(box)) return;
      if (err && err.name === "signed-out") { window.CrossfadeAuth.signOut().then(function () { updateAccountIcon(); renderAccount(); }); return; }
      box.innerHTML = '<div class="card" id="profile-load-error">' + stateBlock("Couldn't load your profile",
        "Crossfade couldn't reach its database. Nothing changed.",
        '<button class="btn quiet" type="button" id="profile-retry">Try again</button>') + "</div>" + signOutButton();
      document.getElementById("profile-retry").onclick = renderAccount;
      wireSignOut(box);
    });
  }

  function signOutButton() { return '<button class="btn quiet" type="button" id="sign-out">Sign out</button>'; }
  function wireSignOut(root) {
    var b = root.querySelector("#sign-out");
    if (b) b.onclick = function () {
      window.CrossfadeAuth.signOut().then(function () { updateAccountIcon(); renderAccount(); });
    };
  }

  // On Netlify a profile is /u/<username> (src/_redirects). The local server has no rewrites.
  function profileUrl(username) {
    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    return location.origin + (local ? "/u.html?name=" : "/u/") + encodeURIComponent(username);
  }

  function showProfile(box, session, p) {
    var url = profileUrl(p.username);
    var face = { name: p.display_name || p.username, avatar_url: p.avatar_url || session.user.avatar_url };
    box.innerHTML =
      '<div class="card profile" id="account-profile">' + avatar(face, "avatar big-avatar") +
        '<div class="grow"><div class="title" id="account-name">' + esc(face.name) + "</div>" +
        '<div class="muted" id="account-username">@' + esc(p.username) + "</div>" +
        (p.bio ? '<p class="small" id="account-bio" style="margin:6px 0 0">' + esc(p.bio) + "</p>" : "") + "</div></div>" +
      '<div class="card"><p class="small" style="margin:0 0 8px">Your profile link</p>' +
        '<p class="small" style="margin:0 0 10px"><a id="profile-url" href="' + esc(url) + '">' + esc(url) + "</a></p>" +
        '<button class="btn" type="button" id="share-profile">Share profile</button> ' +
        '<button class="btn quiet" type="button" id="edit-profile">Edit profile</button> ' +
        '<span class="small muted" id="share-msg" role="status"></span></div>' +
      '<p class="small muted" id="account-email">Signed in with Google as ' + esc(session.user.email) + ". Only you see this.</p>" +
      signOutButton();
    fixAvatars(box);
    wireSignOut(box);
    document.getElementById("edit-profile").onclick = function () { profileForm(box, session, p); };
    document.getElementById("share-profile").onclick = function () {
      var msg = document.getElementById("share-msg");
      if (navigator.share) {
        navigator.share({ title: face.name + " on Crossfade", url: url }).catch(function () { /* closed the share sheet */ });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { msg.textContent = "Copied"; },
          function () { msg.textContent = "Copy the link above instead."; });
      } else { msg.textContent = "Copy the link above instead."; }
    };
  }

  var PROFILE_ERRORS = {
    "username-empty": "Pick a username.",
    "username-format": "Use 3 to 20 letters, numbers or _.",
    "name-too-long": "Keep the name to 50 characters or fewer.",
    "bio-too-long": "Keep the bio to 160 characters or fewer.",
    taken: "That username is taken.",
    network: "Couldn't save. Crossfade couldn't reach its database. Nothing changed.",
  };

  // existing is null the first time: then it's the "pick a username" step.
  function profileForm(box, session, existing) {
    var p = existing || { username: "", display_name: session.user.name || "", bio: "" };
    box.innerHTML =
      '<form class="card" id="profile-form" novalidate>' +
        (existing ? "<h2 style=\"margin-top:0\">Edit profile</h2>" :
          '<h2 style="margin-top:0">Pick a username</h2><p class="small muted" style="margin-top:0">It\'s in your profile link, so people can find you.</p>') +
        '<label for="p-username">Username</label>' +
        '<input id="p-username" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="20" value="' + esc(p.username) + '">' +
        '<div class="field-error" id="p-username-error" role="alert"></div>' +
        '<label for="p-name">Display name</label>' +
        '<input id="p-name" type="text" autocomplete="name" value="' + esc(p.display_name) + '">' +
        '<div class="field-error" id="p-name-error" role="alert"></div>' +
        '<label for="p-bio">Bio <span class="small muted" id="p-bio-count"></span></label>' +
        '<textarea id="p-bio" rows="3">' + esc(p.bio) + "</textarea>" +
        '<div class="field-error" id="p-bio-error" role="alert"></div>' +
        '<div class="field-error" id="p-error" role="alert"></div>' +
        '<div style="margin-top:16px"><button class="btn" type="submit">Save</button>' +
        (existing ? ' <button class="btn quiet" type="button" id="p-cancel">Cancel</button>' : "") + "</div>" +
      "</form>" + (existing ? "" : signOutButton());
    wireSignOut(box);
    var bio = document.getElementById("p-bio");
    var count = function () { document.getElementById("p-bio-count").textContent = bio.value.trim().length + "/" + window.CrossfadeProfiles.MAX_BIO; };
    bio.oninput = count; count();
    if (existing) document.getElementById("p-cancel").onclick = function () { showProfile(box, session, existing); };
    document.getElementById("profile-form").onsubmit = function (e) {
      e.preventDefault();
      var submit = e.target.querySelector("button[type=submit]");
      ["p-username-error", "p-name-error", "p-bio-error", "p-error"].forEach(function (id) { document.getElementById(id).textContent = ""; });
      var fields = { username: document.getElementById("p-username").value,
        display_name: document.getElementById("p-name").value, bio: bio.value };
      submit.disabled = true;
      window.CrossfadeProfiles.save(session, fields, existing).then(function (saved) {
        showProfile(box, session, saved);
      }).catch(function (err) {
        submit.disabled = false;
        if (err.fields) {
          var map = { username: "p-username", display_name: "p-name", bio: "p-bio" };
          var firstField = null;
          Object.keys(map).forEach(function (k) {
            if (!err.fields[k]) return;
            document.getElementById(map[k] + "-error").textContent = PROFILE_ERRORS[err.fields[k]];
            if (!firstField) firstField = map[k];
          });
          document.getElementById(firstField).focus();
        } else if (err.name === "taken") {
          document.getElementById("p-username-error").textContent = PROFILE_ERRORS.taken;
          document.getElementById("p-username").focus();
        } else if (err.name === "signed-out") {
          window.CrossfadeAuth.signOut().then(function () { updateAccountIcon(); renderAccount(); });
        } else {
          document.getElementById("p-error").textContent = PROFILE_ERRORS.network;
        }
      });
    };
  }

  // Signed in or out in another tab.
  window.addEventListener("storage", function (e) {
    if (e.key !== window.CrossfadeAuth.KEY) return;
    updateAccountIcon();
    var page = (location.hash.replace(/^#\/?/, "") || "home").split("/")[0];
    if (page === "account" || page === "create") route();
  });

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

    // A link's own page sits under Playlists. Sub-tabs are marked by renderPlaylists.
    var navPage = page === "links" ? "playlists" : page;
    updateAccountIcon();
    var acct = document.getElementById("account-link");
    if (acct) { if (page === "account") acct.setAttribute("aria-current", "page"); else acct.removeAttribute("aria-current"); }
    document.querySelectorAll(".subtab").forEach(function (a) { a.removeAttribute("aria-current"); });
    document.querySelectorAll(".tab").forEach(function (a) {
      if (a.getAttribute("data-route") === navPage) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    if (page === "home") renderHome();
    else if (page === "playlists") renderPlaylists(parts[1]);
    else if (page === "account") renderAccount();
    else if (page === "create") renderCreate();
    else if (page === "links" && parts[1]) renderLink(parts[1]);
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
  // Coming back from Google: finish signing in before the first screen draws.
  // Otherwise refresh an old session, so the icon shows who's signed in.
  // A slow network can't hold the first screen back for more than 5 seconds.
  view.innerHTML = stateBlock("Loading…", "");
  Promise.race([
    window.CrossfadeAuth.finishSignIn().then(function (s) { return s || window.CrossfadeAuth.current(); }),
    new Promise(function (resolve) { setTimeout(resolve, 5000); }),
  ]).catch(function (err) { authError = err; }).then(route);
})();
