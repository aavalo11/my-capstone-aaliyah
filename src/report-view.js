// A playlist's song rows (PRD R3, ADR 0016), shared by the sender's pages (app.js) and the
// friend's page (p.js). Tapping a matched song opens it in Spotify, like Home's Top songs. Nothing
// here calls Spotify: a link either goes to the track's own Spotify page, when there's a
// real track id, or to Spotify's search for that song.
(function () {
  "use strict";

  var esc = window.CrossfadeUI.esc; // ui.js (ADR 0023)

  // Spotify search for a title and artist. Home's charts use the same URL.
  function searchUrl(title, artist) {
    return "https://open.spotify.com/search/" + encodeURIComponent(String(title || "") + " " + String(artist || ""));
  }

  // A real Spotify track id is 22 base-62 characters. Sample ids ("fake-12") aren't, so a
  // sample song opens Spotify's search instead of a track page that doesn't exist.
  function songUrl(t) {
    var sp = t.spotify;
    if (!sp) return null;
    if (/^[A-Za-z0-9]{22}$/.test(sp.id || "")) return "https://open.spotify.com/track/" + sp.id;
    return searchUrl(sp.title || t.title, sp.artists || t.artist);
  }

  // Only https covers on Apple's image CDN are drawn (ADR 0025). Anything else gets a blank tile.
  function coverUrl(src) {
    return /^https:\/\/([a-z0-9-]+\.)*mzstatic\.com\//.test(src || "") ? src : null;
  }
  function cover(src, cls) {
    var u = coverUrl(src);
    return u ? '<img class="' + cls + '" src="' + esc(u) + '" alt="" loading="lazy">'
      : '<span class="' + cls + ' cover-blank" aria-hidden="true"></span>';
  }

  // 97960 → "1:37". Null when Apple gave no length.
  function time(ms) {
    if (typeof ms !== "number" || !(ms > 0)) return "";
    var s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  // One row. t is { title, artist, tier, spotify: { id, title, artists } | null,
  // artwork, duration_ms, near: { id, title, artists } | null }.
  function row(t) {
    var head = '<div class="title">' + esc(t.title) + '</div><div class="small muted">' + esc(t.artist) + "</div>";
    var len = '<span class="time small muted">' + esc(time(t.duration_ms)) + "</span>";
    if (t.tier === "unmatched" || !t.spotify) {
      // ADR 0026: still unmatched and still left out of the playlist. Spotify's nearest
      // version is offered as a link the friend can open and save themselves.
      var near = t.near && /^[A-Za-z0-9]{22}$/.test(t.near.id || "")
        ? '<a class="near small" href="https://open.spotify.com/track/' + esc(t.near.id) + '" target="_blank" rel="noopener">' +
          "Spotify has a different version: " + esc(t.near.title) + " · " + esc(t.near.artists) + "</a>"
        : "";
      return '<li class="row unmatched" data-tier="unmatched"><span class="dim">' + cover(t.artwork, "row-art") + "</span>" +
        '<div class="grow"><div class="dim">' + head + '<div class="small">Not found on Spotify (US)</div></div>' + near + "</div>" +
        '<span class="dim">' + len + "</span></li>";
    }
    // ADR 0016: Spotify's version is shown only when its title is written differently.
    // ADR 0022: the whole row is the link to Spotify, with no separate button.
    var differs = t.spotify.title != null && t.spotify.title !== t.title;
    return '<li class="song" data-tier="' + esc(t.tier) + '"><a class="row song-link" href="' + esc(songUrl(t)) +
      '" target="_blank" rel="noopener" aria-label="' + esc(t.title) + ", " + esc(t.artist) + ', open in Spotify">' +
      cover(t.artwork, "row-art") + '<div class="grow">' + head +
      (differs ? '<div class="small muted" data-spotify-version style="margin-top:4px">On Spotify: ' +
        esc(t.spotify.title) + " · " + esc(t.spotify.artists) + "</div>" : "") + "</div>" + len + "</a></li>";
  }

  function list(tracks) {
    return '<div class="list-head small muted" aria-hidden="true"><span>Song</span><span>Time</span></div>' +
      '<ol class="list" id="tracks">' + tracks.map(row).join("") + "</ol>";
  }

  // ADR 0025: the top of a playlist page. p is { name, owner, artwork, playUrl, share, extra, after }.
  // share: true adds a Share button (#share-link, ADR 0028); the caller wires it.
  // extra (above the buttons) and after (below them) are trusted HTML the caller built.
  function header(p) {
    return '<header class="pl-head">' + cover(p.artwork, "pl-cover") +
      '<div class="pl-meta"><h1>' + esc(p.name) + "</h1>" +
      '<p class="muted pl-sub">Playlist transferred with Crossfade</p>' +
      (p.owner ? '<p class="small muted pl-sub" id="pl-owner">Made by ' + esc(p.owner) + " on Apple Music</p>" : "") +
      (p.extra || "") +
      (p.playUrl || p.share ? '<div class="pl-actions">' +
        (p.playUrl ? '<a class="btn pl-play" href="' + esc(p.playUrl) + '" target="_blank" rel="noopener" id="play-spotify">' +
          '<span aria-hidden="true">▶</span>&nbsp;Play in Spotify</a>' : "") +
        (p.share ? '<button class="btn quiet pl-share" type="button" id="share-link">' +
          '<span aria-hidden="true">↗</span>&nbsp;Share</button>' : "") + "</div>" : "") +
      (p.after || "") + "</div></header>";
  }

  function matched(tracks) {
    return tracks.filter(function (t) { return t.tier !== "unmatched" && t.spotify; }).length;
  }

  // The playlist itself, once create-link has made a real one (R5). Null until then, so the
  // button isn't shown.
  function playlistUrl(spotifyPlaylistId) {
    return /^[A-Za-z0-9]{22}$/.test(spotifyPlaylistId || "") ? "https://open.spotify.com/playlist/" + spotifyPlaylistId : null;
  }

  window.CrossfadeReport = { esc: esc, row: row, list: list, header: header, cover: cover, time: time, matched: matched, searchUrl: searchUrl, songUrl: songUrl, playlistUrl: playlistUrl };
})();
