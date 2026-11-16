// The two helpers every page uses (ADR 0023). Load this before any other script on a page.
(function () {
  "use strict";

  // Escapes a value for HTML. Every interpolated string goes through this (CLAUDE.md).
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // An empty, error or sign-in state: a bold title, a line of text, and an optional button (HTML).
  function stateBlock(title, body, action) {
    return '<div class="state"><strong>' + esc(title) + "</strong>" + esc(body) +
      (action ? '<div style="margin-top:14px">' + action + "</div>" : "") + "</div>";
  }

  window.CrossfadeUI = { esc: esc, stateBlock: stateBlock };
})();
