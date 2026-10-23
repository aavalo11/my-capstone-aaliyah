// Recipient link page (PRD R3 + R5). Locally it opens as p.html?code=<code>; on Netlify
// /p/<code> rewrites here (ADR 0008). Add ?demo=empty or ?demo=error to see those states.
(function () {
  "use strict";

  var view = document.getElementById("view");
  var params = new URLSearchParams(location.search);
  var DEMO = params.get("demo"); // "empty" | "error" | null
  var CODE = params.get("code") || location.pathname.split("/p/")[1] || "";

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
    return fetch("sample/link-sample.json")
      .then(function (res) {
        if (!res.ok) throw new Error("http-" + res.status);
        return res.json();
      })
      .then(function (d) {
        var link = d.links[code] || null;
        if (link && DEMO === "empty") link = { name: link.name, spotify_playlist_id: null, tracks: [] };
        return link;
      });
  }

  function trackRow(t) {
    var head = '<div class="title">' + esc(t.source_title) + '</div><div class="small muted">' + esc(t.source_artist) + "</div>";
    if (t.tier === "unmatched") {
      return '<li class="row unmatched" data-tier="unmatched"><div class="grow">' + head +
        '<div class="small">Not found on Spotify (US)</div></div></li>';
    }
    if (t.tier === "close") {
      return '<li class="row" data-tier="close"><div class="grow">' + head +
        '<div class="small" style="margin-top:4px"><span class="pill warn">Close match</span> On Spotify: ' +
        esc(t.spotify_title) + " · " + esc(t.spotify_artists) + "</div></div></li>";
    }
    return '<li class="row" data-tier="exact"><div class="grow">' + head + "</div></li>";
  }

  function render() {
    view.innerHTML = stateBlock("Loading…", "");

    fetchLink(CODE).then(function (link) {
      if (!link) {
        view.innerHTML = '<div class="card">' + stateBlock("This Crossfade link doesn't exist.",
          "Check that the whole link was copied, or ask whoever sent it.") + "</div>";
        return;
      }
      if (!link.tracks.length) {
        view.innerHTML = "<h1>" + esc(link.name) + "</h1>" +
          '<div class="card">' + stateBlock("This playlist has no songs", "There's nothing here to play.") + "</div>";
        return;
      }
      var tracks = link.tracks.slice().sort(function (a, b) { return a.position - b.position; });
      // R3: X counts exact and close, counted from the rows so the headline can't disagree with them.
      var matched = tracks.filter(function (t) { return t.tier !== "unmatched"; }).length;

      view.innerHTML =
        '<div class="notice"><b>Sample playlist.</b> Real Crossfade links arrive in Week 9. ' +
        "These songs and matches are made up.</div>" +
        "<h1>" + esc(link.name) + "</h1>" +
        '<p class="muted" id="match-headline">Matched ' + matched + " of " + tracks.length + "</p>" +
        '<button class="btn block" type="button" disabled>Play in Spotify</button>' +
        '<p class="small muted" style="margin-top:8px">Playing arrives in Week 9. Nothing is ever added to your library.</p>' +
        '<div class="card"><ol class="list" id="tracks">' + tracks.map(trackRow).join("") + "</ol></div>";
    }).catch(function () {
      view.innerHTML = '<div class="card">' + stateBlock("Couldn't open this playlist",
        "Crossfade couldn't load it. Nothing on your Spotify was touched.",
        '<button class="btn quiet" type="button" id="retry">Try again</button>') + "</div>";
      document.getElementById("retry").onclick = render;
    });
  }

  render();
})();
