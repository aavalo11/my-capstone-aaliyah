// A playlist's song rows (PRD R3, ADR 0016), shared by the sender's pages (app.js) and the
// friend's page (p.js). Each matched song opens in Spotify, like Home's Top songs. Nothing
// here calls Spotify: a link either goes to the track's own Spotify page, when there's a
// real track id, or to Spotify's search for that song.
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

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

  // One row. t is { title, artist, tier, spotify: { id, title, artists } | null }.
  function row(t) {
    var head = '<div class="title">' + esc(t.title) + '</div><div class="small muted">' + esc(t.artist) + "</div>";
    if (t.tier === "unmatched" || !t.spotify) {
      return '<li class="row unmatched" data-tier="unmatched"><div class="grow">' + head +
        '<div class="small">Not found on Spotify (US)</div></div></li>';
    }
    // ADR 0016: Spotify's version is shown only when its title is written differently.
    var differs = t.spotify.title != null && t.spotify.title !== t.title;
    return '<li class="row" data-tier="' + esc(t.tier) + '"><div class="grow">' + head +
      (differs ? '<div class="small muted" data-spotify-version style="margin-top:4px">On Spotify: ' +
        esc(t.spotify.title) + " · " + esc(t.spotify.artists) + "</div>" : "") + "</div>" +
      '<a class="pill" href="' + esc(songUrl(t)) + '" target="_blank" rel="noopener" aria-label="Open ' +
        esc(t.title) + ' in Spotify">Spotify ↗</a></li>';
  }

  // A plain song with no match data (a friend's sample songs): always Spotify search.
  function songRow(s) {
    return '<li class="row"><div class="grow"><div class="title">' + esc(s.title) + '</div><div class="small muted">' +
      esc(s.artist) + '</div></div><a class="pill" href="' + esc(searchUrl(s.title, s.artist)) +
      '" target="_blank" rel="noopener" aria-label="Find ' + esc(s.title) + ' on Spotify">Spotify ↗</a></li>';
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

  window.CrossfadeReport = { esc: esc, row: row, songRow: songRow, list: list, matched: matched, searchUrl: searchUrl, songUrl: songUrl, playlistUrl: playlistUrl };
})();
