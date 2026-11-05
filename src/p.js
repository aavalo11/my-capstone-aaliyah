// Recipient link page (PRD R3 + R5). Locally it opens as p.html?code=<code>; on Netlify
// /p/<code> rewrites here (ADR 0008). Add ?demo=empty or ?demo=error to see those states.
(function () {
  "use strict";

  var view = document.getElementById("view");
  var params = new URLSearchParams(location.search);
  var DEMO = params.get("demo"); // "empty" | "error" | null
  // Codes are only [A-Za-z0-9], so anything else is junk a messaging app added (a trailing "." or ")").
  var CODE = (params.get("code") || location.pathname.split("/p/")[1] || "").replace(/[^A-Za-z0-9]/g, "");

  // Copied from app.js. Loading app.js here would start the sender's router.
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function stateBlock(title, body, action) {
    return '<div class="state"><strong>' + esc(title) + "</strong>" + esc(body) +
      (action ? '<div style="margin-top:14px">' + action + "</div>" : "") + "</div>";
  }

  // TODO(W10): real data. Replace with POST /rest/v1/rpc/get_link { p_code } (architecture §3).
  function fetchLink(code) {
    if (DEMO === "error") return Promise.reject(new Error("demo"));
    // A link made in this browser (ADR 0010), with the songs from its recorded build (ADR 0015).
    var mine;
    try { mine = window.CrossfadeLinks.get(code); } catch (e) { return Promise.reject(e); }
    if (mine) {
      if (mine.deleted_at) return Promise.resolve({ removed: true });
      var r = mine.report || { tracks: [] };
      return Promise.resolve({ local: true, sample: !!r.sample, name: mine.title, spotify_playlist_id: r.spotify_playlist_id || null, tracks: r.tracks });
    }
    return fetch("sample/link-sample.json")
      .then(function (res) {
        if (!res.ok) throw new Error("http-" + res.status);
        return res.json();
      })
      .then(function (d) {
        var link = d.links[code] || null;
        if (link && DEMO === "empty") link = { name: link.name, spotify_playlist_id: null, tracks: [] };
        if (!link) return null;
        // get_link's rows (architecture §4) in report-view.js's shape.
        return { sample: true, name: link.name, spotify_playlist_id: link.spotify_playlist_id,
          tracks: link.tracks.slice().sort(function (a, b) { return a.position - b.position; }).map(function (t) {
            return { title: t.source_title, artist: t.source_artist, tier: t.tier,
              spotify: t.tier === "unmatched" ? null : { id: t.spotify_track_id || null, title: t.spotify_title, artists: t.spotify_artists } };
          }) };
      });
  }

  function render() {
    view.innerHTML = stateBlock("Loading…", "");

    fetchLink(CODE).then(function (link) {
      if (!link) {
        view.innerHTML = '<div class="card">' + stateBlock("This Crossfade link doesn't exist.",
          "Check that the whole link was copied, or ask whoever sent it.") + "</div>";
        return;
      }
      if (link.removed) {
        view.innerHTML = '<div class="card">' + stateBlock("This link was removed by whoever sent it.",
          "Nothing on your Spotify was touched. Ask them for a new link if they meant to send it.") + "</div>";
        return;
      }
      var R = window.CrossfadeReport;
      var play = R.playlistUrl(link.spotify_playlist_id);
      var notice = link.local
        ? '<div class="notice"><b>Sample playlist, saved on this device only.</b> The Spotify matches are made up.</div>'
        : link.sample ? '<div class="notice"><b>Sample playlist.</b> These songs and matches are made up.</div>' : "";
      if (!link.tracks.length) {
        view.innerHTML = notice + "<h1>" + esc(link.name) + "</h1>" +
          '<div class="card">' + stateBlock("This playlist has no songs", "There's nothing here to play.") + "</div>";
        return;
      }
      // R3: X counts exact and close, counted from the rows so the headline can't disagree with them.
      view.innerHTML = notice +
        "<h1>" + esc(link.name) + "</h1>" +
        '<p class="muted" id="match-headline">Matched ' + R.matched(link.tracks) + " of " + link.tracks.length + "</p>" +
        (play ? '<a class="btn block" href="' + esc(play) + '" target="_blank" rel="noopener">Play in Spotify</a>' +
          '<p class="small muted" style="margin-top:8px">Nothing is ever added to your library.</p>' : "") +
        '<div class="card">' + R.list(link.tracks) + "</div>";
    }).catch(function () {
      view.innerHTML = '<div class="card">' + stateBlock("Couldn't open this playlist",
        "Crossfade couldn't load it. Nothing on your Spotify was touched.",
        '<button class="btn quiet" type="button" id="retry">Try again</button>') + "</div>";
      document.getElementById("retry").onclick = render;
    });
  }

  // The sender renamed or deleted this link in another tab, or Back restored an old copy of the page.
  window.addEventListener("storage", function (e) { if (e.key === window.CrossfadeLinks.KEY) render(); });
  window.addEventListener("pageshow", function (e) { if (e.persisted) render(); });

  render();
})();
