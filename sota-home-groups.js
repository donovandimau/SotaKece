/* Home groups (15 Nov 2026, Donovan: "All similar-themed features must stay together").
   On the signed-in Home page the Talanoa wall stays in the main column, and everything else is
   gathered into three labelled groups beside it: Music, Your people, and Make it yours.
   Other scripts keep drawing their own blocks; this only moves them into the right group, and
   moves them again if they are redrawn. Nothing is copied, so clicks and live updates still work. */
(function (root) {
  'use strict';
  var GROUPS = [
    { key: 'music', title: 'Music', line: 'Songs, the Island Mix and your music visuals.' },
    { key: 'people', title: 'Your people', line: 'Find your mates and bring someone in.' },
    { key: 'yours', title: 'Make it yours', line: 'Change how your page looks and sounds.' }
  ];
  var YOURS = '<div class="sk-group-actions">' +
    '<button type="button" data-world-tool="studio">Room Studio <i aria-hidden="true">↗</i></button>' +
    '<button type="button" data-world-tool="skins">Skins &amp; collections <i aria-hidden="true">↗</i></button>' +
    '<button type="button" data-world-tool="design">Design this page <i aria-hidden="true">✎</i></button>' +
    '<button type="button" data-world-tool="explore">Explore every world <i aria-hidden="true">✦</i></button></div>';

  function side(view) {
    var box = view.querySelector(':scope > .sk-home-side');
    if (box) return box;
    var doc = view.ownerDocument;
    box = doc.createElement('div');
    box.className = 'sk-home-side';
    box.innerHTML = GROUPS.map(function (g) {
      return '<section class="sk-group" data-sk-group="' + g.key + '" aria-labelledby="sk-group-' + g.key + '">' +
        '<header class="sk-group-head"><h2 id="sk-group-' + g.key + '">' + g.title + '</h2><p>' + g.line + '</p></header>' +
        '<div class="sk-group-body"></div>' + (g.key === 'yours' ? YOURS : '') + '</section>';
    }).join('');
    var w = view.querySelector(':scope > .tw-wrap');
    if (w) view.insertBefore(box, w); else view.appendChild(box);
    return box;
  }
  function put(box, key, node) {
    var body = box.querySelector('[data-sk-group="' + key + '"] .sk-group-body');
    if (body && node && node.parentNode !== body) body.appendChild(node);
  }
  function arrange(app) {
    if (!app || app.dataset.worldPage !== 'pulse') return;
    var view = app.querySelector('#view');
    if (!view || !view.querySelector('.tw-wrap')) return;
    var box = side(view);
    // Talanoa sits at the foot of Home (owner, 15 Nov 2026): the groups go just above the wall.
    var wall = view.querySelector(':scope > .tw-wrap');
    if (wall && box.nextElementSibling !== wall) view.insertBefore(box, wall);
    if (wall && wall !== view.lastElementChild) view.appendChild(wall);
    // Music: the music visuals card, then today's island songs from the wall's foot.
    put(box, 'music', view.querySelector(':scope > .sx-home-listen'));
    var viti = view.querySelector('.tw-wrap .tw-viti');
    if (viti) {
      var old = box.querySelector('[data-sk-group="music"] .tw-viti');
      if (old && old !== viti) old.remove();
      put(box, 'music', viti);
    }
    // The Talanoa / Top Mates panel belongs with your people, not inside Music.
    view.querySelectorAll(':scope > .sota-social-host, .sk-group-body .sota-social-host').forEach(function (n) { put(box, 'people', n); });
    // Your people: the hubs card (where your people are, invite someone).
    view.querySelectorAll(':scope > .hub-card').forEach(function (n) { put(box, 'people', n); });
  }
  function start(doc) {
    var app = doc.getElementById('app');
    if (!app || app.dataset.skGroups) return;
    app.dataset.skGroups = '1';
    var busy = false;
    var run = function () { if (busy) return; busy = true; try { arrange(app); } finally { busy = false; } };
    new root.MutationObserver(function () { if (!busy) run(); }).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-world-page'] });
    run();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { arrange: arrange, start: start };
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { start(root.document); });
    else start(root.document);
  }
})(typeof window !== 'undefined' ? window : globalThis);
