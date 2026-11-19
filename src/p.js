// Recipient link page (PRD R3 + R5). Locally it opens as p.html?code=<code>; on Netlify
// /p/<code> rewrites here (ADR 0008). Add ?demo=empty or ?demo=error to see those states.
(function () {
  "use strict";

  var view = document.getElementById("view");
  var params = new URLSearchParams(location.search);
  var DEMO = params.get("demo"); // "empty" | "error" | null
  // Codes are only [A-Za-z0-9], so anything else is junk a messaging app added (a trailing "." or ")").
  var CODE = (params.get("code") || location.pathname.split("/p/")[1] || "").replace(/[^A-Za-z0-9]/g, "");

  var esc = window.CrossfadeUI.esc, stateBlock = window.CrossfadeUI.stateBlock; // ui.js (ADR 0023)

  // Where a link comes from, in order: a link made in this browser before Phase 10 (ADR 0010),
  // then Crossfade's database through get_link (architecture §3, ADR 0029), then the made-up
  // sample link (code=sample), which stays labelled as made up.
  function fetchLink(code) {
    if (DEMO === "error") return Promise.reject(new Error("demo"));
    // A link made in this browser (ADR 0010), with the songs from its recorded build (ADR 0015).
    var mine;
    try { mine = window.CrossfadeLinks.get(code); } catch (e) { return Promise.reject(e); }
    if (mine) {
      if (mine.deleted_at) return Promise.resolve({ removed: true });
      var r = mine.report || { tracks: [] };
      return Promise.resolve({ local: true, sample: !!r.sample, name: mine.title, owner: r.owner || null, artwork: r.artwork || null,
        spotify_playlist_id: r.spotify_playlist_id || null, tracks: r.tracks });
    }
    if (code !== "sample") {
      return window.CrossfadeServer.getLink(code).then(function (d) {
        if (!d) return null;
        if (d.removed) return { removed: true };
        if (DEMO === "empty") d.tracks = [];
        return { name: d.name, owner: d.owner || null, artwork: d.artwork_url || null, sender: d.sender || null,
          spotify_playlist_id: d.spotify_playlist_id, tracks: window.CrossfadeReport.fromRows(d.tracks, d.sender) };
      });
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
        return { sample: true, name: link.name, owner: link.owner || null, artwork: link.artwork_url || null,
          spotify_playlist_id: link.spotify_playlist_id,
          tracks: link.tracks.slice().sort(function (a, b) { return a.position - b.position; }).map(function (t) {
            return { title: t.source_title, artist: t.source_artist, tier: t.tier,
              artwork: t.artwork_url || null, duration_ms: t.duration_ms || null,
              near: t.near_track_id ? { id: t.near_track_id, title: t.near_title, artists: t.near_artists } : null,
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
      // Remember a friend's link for Playlists → Sent to me (ADR 0018). Your own links stay
      // under Made by me. If this browser won't save, the page still shows the playlist.
      if (!link.local && !DEMO) {
        try { window.CrossfadeReceived.add({ code: CODE, title: link.name, track_count: link.tracks.length, matched: R.matched(link.tracks), sample: !!link.sample,
          artwork: link.artwork || null, owner: link.owner || null }); }
        catch (e) { /* nothing to show: the playlist is what the friend came for */ }
      }
      var play = R.playlistUrl(link.spotify_playlist_id);
      // A link made on this device holds a real Spotify run (ADR 0025), so it isn't labelled.
      // The made-up link (code=sample) still is: its songs and matches are invented.
      var notice = !link.local && link.sample
        ? '<div class="notice"><b>Sample playlist.</b> These songs and matches are made up.</div>' : "";
      if (!link.tracks.length) {
        view.innerHTML = notice + R.header({ name: link.name, owner: link.owner, artwork: link.artwork }) +
          '<div class="card">' + stateBlock("This playlist has no songs", "There's nothing here to play.") + "</div>";
        return;
      }
      // R3: X counts exact and close, counted from the rows so the headline can't disagree with them.
      view.innerHTML = notice +
        R.header({ name: link.name, owner: link.owner, artwork: link.artwork, playUrl: play,
          extra: '<p class="muted" id="match-headline">Matched ' + esc(R.matched(link.tracks)) + " of " + esc(R.total(link.tracks)) + "</p>",
          after: play ? '<p class="small muted pl-sub">Nothing is ever added to your library.</p>' : "" }) +
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
