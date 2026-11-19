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

  // Only https covers on Apple's image CDN (ADR 0025) or, for a song the sender added,
  // Spotify's (ADR 0029) are drawn. Anything else gets a blank tile.
  function coverUrl(src) {
    return /^https:\/\/(([a-z0-9-]+\.)*mzstatic\.com|i\.scdn\.co)\//.test(src || "") ? src : null;
  }
  function cover(src, cls) {
    var u = coverUrl(src);
    return u ? '<img class="' + cls + '" src="' + esc(u) + '" alt="" loading="lazy">'
      : '<span class="' + cls + ' cover-blank" aria-hidden="true"></span>';
  }

  // ADR 0030: two names are the same playlist name if they match ignoring case, spaces and
  // punctuation, so "gym" and "gym." keep Apple's cover.
  function sameName(a, b) {
    var n = function (s) { return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""); };
    return n(a) === n(b);
  }

  // The colours Apple's own cover URL lists (c1–c4 and the text colour tc), as #RRGGBB, or a
  // palette picked from the title when the URL has none. Only six hex digits ever reach style="".
  function coverColors(src, title) {
    var q = {};
    try { new URL(src).searchParams.forEach(function (v, k) { q[k] = v; }); } catch (e) { /* no URL */ }
    var hex = function (v) { return /^[0-9A-Fa-f]{6}$/.test(v || "") ? "#" + v : null; };
    var c = [hex(q.c1), hex(q.c2), hex(q.c3), hex(q.c4)];
    if (c.every(Boolean)) return { c: c, text: hex(q.tc) || "#FFFFFF" };
    var PALETTES = [["#F2BC9D", "#FF7F40", "#B37C00", "#400000"], ["#B9D8FF", "#5B7CFA", "#2B2E8C", "#0B0D2E"],
      ["#FFD6E8", "#F25C9B", "#8C1D5B", "#2E0A1F"], ["#D3F5E4", "#3CC48A", "#1E6B4B", "#06261A"]];
    var h = 0;
    String(title || "").split("").forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    return { c: PALETTES[h % PALETTES.length], text: "#FFFFFF" };
  }

  // A playlist's cover. p is { artwork, title, appleName }. Renamed links get one drawn here,
  // with their own title in Apple's colours (ADR 0030); otherwise Apple's image.
  function playlistCover(p, cls) {
    if (!p.appleName || !p.title || sameName(p.title, p.appleName)) return cover(p.artwork, cls);
    var k = coverColors(p.artwork, p.title);
    var style = "--d1:" + k.c[0] + ";--d2:" + k.c[1] + ";--d3:" + k.c[2] + ";--d4:" + k.c[3] + ";--dt:" + k.text;
    return '<span class="' + cls + ' cover-drawn" role="img" aria-label="Cover: ' + esc(p.title) + '" style="' + style + '">' +
      '<span class="cover-title" aria-hidden="true">' + esc(p.title) + "</span></span>";
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
    var differs = t.tier !== "added" && t.spotify.title != null && t.spotify.title !== t.title;
    // ADR 0029: a song the sender added on the edit screen, after the Apple songs.
    var addedBy = t.tier === "added" ? '<div class="small muted" data-added style="margin-top:4px">Added by ' +
      esc(t.addedBy || "the sender") + "</div>" : "";
    return '<li class="song" data-tier="' + esc(t.tier) + '"><a class="row song-link" href="' + esc(songUrl(t)) +
      '" target="_blank" rel="noopener" aria-label="' + esc(t.title) + ", " + esc(t.artist) + ', open in Spotify">' +
      cover(t.artwork, "row-art") + '<div class="grow">' + head +
      (differs ? '<div class="small muted" data-spotify-version style="margin-top:4px">On Spotify: ' +
        esc(t.spotify.title) + " · " + esc(t.spotify.artists) + "</div>" : "") + addedBy + "</div>" + len + "</a></li>";
  }

  function list(tracks) {
    return '<div class="list-head small muted" aria-hidden="true"><span>Song</span><span>Time</span></div>' +
      '<ol class="list" id="tracks">' + tracks.map(row).join("") + "</ol>";
  }

  // ADR 0025: the top of a playlist page. p is { name, appleName, owner, artwork, playUrl, share, extra, after }.
  // share: true adds a Share button (#share-link, ADR 0028); the caller wires it.
  // extra (above the buttons) and after (below them) are trusted HTML the caller built.
  function header(p) {
    return '<header class="pl-head">' + playlistCover({ artwork: p.artwork, title: p.name, appleName: p.appleName }, "pl-cover") +
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

  // R3's "Matched X of N" counts the Apple songs only: an added song (ADR 0029) is neither.
  function matched(tracks) {
    return tracks.filter(function (t) { return t.tier !== "unmatched" && t.tier !== "added" && t.spotify; }).length;
  }
  function total(tracks) {
    return tracks.filter(function (t) { return t.tier !== "added"; }).length;
  }

  // get_link's rows (supabase/migrations/20261119_links_builds.sql) in this file's row shape.
  function fromRows(rows, sender) {
    return (rows || []).slice().sort(function (a, b) { return a.position - b.position; }).map(function (t) {
      return {
        position: t.position + 1, title: t.source_title, artist: t.source_artist, tier: t.tier,
        artwork: t.artwork_url || null, duration_ms: t.duration_ms || null, addedBy: sender || null,
        near: t.near_track_id ? { id: t.near_track_id, title: t.near_title, artists: t.near_artists } : null,
        spotify: t.tier === "unmatched" ? null : { id: t.spotify_track_id || null, title: t.spotify_title, artists: t.spotify_artists },
      };
    });
  }

  // The playlist itself, once create-link has made a real one (R5). Null until then, so the
  // button isn't shown.
  function playlistUrl(spotifyPlaylistId) {
    return /^[A-Za-z0-9]{22}$/.test(spotifyPlaylistId || "") ? "https://open.spotify.com/playlist/" + spotifyPlaylistId : null;
  }

  window.CrossfadeReport = { esc: esc, row: row, list: list, header: header, cover: cover, playlistCover: playlistCover, sameName: sameName, time: time, matched: matched, total: total, fromRows: fromRows, searchUrl: searchUrl, songUrl: songUrl, playlistUrl: playlistUrl };
})();
