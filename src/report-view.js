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

  // One row. t is { title, artist, tier, spotify: { id, title, artists } | null,
  // near: { id, title, artists } | null }.
  function row(t) {
    var head = '<div class="title">' + esc(t.title) + '</div><div class="small muted">' + esc(t.artist) + "</div>";
    if (t.tier === "unmatched" || !t.spotify) {
      // ADR 0026: still unmatched and still left out of the playlist. Spotify's nearest
      // version is offered as a link the friend can open and save themselves.
      var near = t.near && /^[A-Za-z0-9]{22}$/.test(t.near.id || "")
        ? '<a class="near small" href="https://open.spotify.com/track/' + esc(t.near.id) + '" target="_blank" rel="noopener">' +
          "Spotify has a different version: " + esc(t.near.title) + " · " + esc(t.near.artists) + "</a>"
        : "";
      return '<li class="row unmatched" data-tier="unmatched">' +
        '<div class="grow"><div class="dim">' + head + '<div class="small">Not found on Spotify (US)</div></div>' + near + "</div></li>";
    }
    // ADR 0016: Spotify's version is shown only when its title is written differently.
    // ADR 0022: the whole row is the link to Spotify, with no separate button.
    var differs = t.spotify.title != null && t.spotify.title !== t.title;
    return '<li class="song" data-tier="' + esc(t.tier) + '"><a class="row song-link" href="' + esc(songUrl(t)) +
      '" target="_blank" rel="noopener" aria-label="' + esc(t.title) + ", " + esc(t.artist) + ', open in Spotify"><div class="grow">' + head +
      (differs ? '<div class="small muted" data-spotify-version style="margin-top:4px">On Spotify: ' +
        esc(t.spotify.title) + " · " + esc(t.spotify.artists) + "</div>" : "") + "</div></a></li>";
  }

  function list(tracks) {
    return '<ol class="list" id="tracks">' + tracks.map(row).join("") + "</ol>";
  }

  function matched(tracks) {
    return tracks.filter(function (t) { return t.tier !== "unmatched" && t.spotify; }).length;
  }

  // The playlist itself, once create-link has made a real one (R5). Null until then, so the
  // button isn't shown.
  function playlistUrl(spotifyPlaylistId) {
    return /^[A-Za-z0-9]{22}$/.test(spotifyPlaylistId || "") ? "https://open.spotify.com/playlist/" + spotifyPlaylistId : null;
  }

  window.CrossfadeReport = { esc: esc, row: row, list: list, matched: matched, searchUrl: searchUrl, songUrl: songUrl, playlistUrl: playlistUrl };
})();
