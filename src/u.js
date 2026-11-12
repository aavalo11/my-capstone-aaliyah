// A sender's public profile (ADR 0020, S18). Locally it opens as u.html?name=<username>; on
// Netlify /u/<username> rewrites here (src/_redirects). Add ?demo=empty or ?demo=error.
(function () {
  "use strict";

  var view = document.getElementById("view");
  var params = new URLSearchParams(location.search);
  var NAME = (params.get("name") || decodeURIComponent(location.pathname.split("/u/")[1] || "")).replace(/[^A-Za-z0-9_]/g, "");

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

  function render() {
    view.innerHTML = stateBlock("Loading…", "");
    window.CrossfadeProfiles.byUsername(NAME).then(function (p) {
      if (!p) {
        view.innerHTML = '<div class="card" id="profile-missing">' + stateBlock("No one has that username",
          "Check the link, or ask whoever sent it. They may have changed their username.") + "</div>";
        return;
      }
      var shown = p.display_name || p.username;
      document.title = shown + " on Crossfade";
      var initial = esc(shown.charAt(0).toUpperCase());
      view.innerHTML = '<div class="card public-profile" id="public-profile">' +
        '<span class="avatar big-avatar">' + (p.avatar_url
          ? '<img src="' + esc(p.avatar_url) + '" alt="" referrerpolicy="no-referrer" data-initial="' + initial + '">' : initial) + "</span>" +
        '<h1 id="profile-name">' + esc(shown) + "</h1>" +
        '<div class="muted" id="profile-username">@' + esc(p.username) + "</div>" +
        (p.bio ? '<p id="profile-bio">' + esc(p.bio) + "</p>" : "") +
        '<a class="btn quiet" href="/">Send a playlist with Crossfade</a></div>';
      var img = view.querySelector("img[data-initial]");
      if (img) img.onerror = function () { img.parentNode.textContent = img.getAttribute("data-initial"); };
    }).catch(function () {
      view.innerHTML = '<div class="card" id="profile-error">' + stateBlock("Couldn't load this profile",
        "Crossfade couldn't reach its database. Try again in a moment.",
        '<button class="btn quiet" type="button" id="retry">Try again</button>') + "</div>";
      document.getElementById("retry").onclick = render;
    });
  }

  render();
})();
