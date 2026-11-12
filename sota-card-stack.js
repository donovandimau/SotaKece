/* Sota Kece card stack (12 November 2026).
   "New for you" at the top of Activity: the member's unread notifications as a pile of tilted cards.
   The front card is the one to read; the next ones peek out behind it. Swipe or drag the front card
   aside, use the arrows, the arrow keys, or pick from the list beside the pile (desktop) to bring
   another card forward. No new data: Activity hands over cards it has already drawn from bv_activity().
   Reduced motion: no tilt and no sliding, the cards just change. */
(function () {
  'use strict';
  if (window.SotaCardStack) return;

  var PEEK = 2, SWIPE = 70, MIN = 2;

  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Where card i sits when card `cur` is in front: 0 is the front, 1..PEEK peek out behind, the rest wait out of sight.
  function depth(i, cur, n) { return ((i - cur) % n + n) % n; }
  function pose(d, flat) {
    if (d === 0) return 'translate3d(0,0,0) rotate(0deg) scale(1)';
    if (d > PEEK) return 'translate3d(0,' + (PEEK * 12) + 'px,0) scale(' + (1 - PEEK * 0.05) + ')';
    return 'translate3d(' + (flat ? 0 : d * 6) + 'px,' + (d * 12) + 'px,0) rotate(' + (flat ? 0 : (d % 2 ? 3 : -2) * d) + 'deg) scale(' + (1 - d * 0.05) + ')';
  }

  /** cards: [{key, html, label}] — html is the inside of one card (already escaped by the caller), label is plain text for the list and screen readers. */
  function html(cards, title) {
    if (!Array.isArray(cards) || cards.length < MIN) return '';
    var n = cards.length;
    return '<section class="glass card cs-wrap" data-card-stack data-cur="0" aria-label="' + esc(title || 'New for you') + '">' +
      '<div class="cs-head"><h3>' + esc(title || 'New for you') + '</h3><span class="cs-count" aria-live="polite">1 of ' + n + '</span></div>' +
      '<div class="cs-body"><div class="cs-pile" tabindex="0" role="group" aria-roledescription="card stack" aria-label="Swipe or use the arrow keys to see the next card">' +
      cards.map(function (c, i) {
        return '<article class="cs-card" data-i="' + i + '" data-key="' + esc(c.key) + '" aria-label="' + esc((i + 1) + ' of ' + n + ': ' + (c.label || '')) + '">' + c.html + '</article>';
      }).join('') + '</div>' +
      '<ol class="cs-list">' + cards.map(function (c, i) {
        return '<li><button type="button" data-cs="pick" data-i="' + i + '" aria-current="' + (i === 0) + '">' + esc(c.label || '') + '</button></li>';
      }).join('') + '</ol></div>' +
      '<div class="cs-nav"><button type="button" class="btn sm ghost" data-cs="prev" aria-label="Previous card">‹</button>' +
      '<span class="cs-dots" aria-hidden="true">' + cards.map(function (_, i) { return '<i data-i="' + i + '"></i>'; }).join('') + '</span>' +
      '<button type="button" class="btn sm ghost" data-cs="next" aria-label="Next card">›</button></div></section>';
  }

  function cardsOf(root) { return Array.prototype.slice.call(root.querySelectorAll('.cs-card')); }

  function show(root, cur) {
    var cards = cardsOf(root), n = cards.length; if (!n) return;
    cur = ((cur % n) + n) % n; root.setAttribute('data-cur', cur);
    var flat = reduced();
    cards.forEach(function (c, i) {
      var d = depth(i, cur, n);
      c.style.transform = pose(d, flat);
      c.style.zIndex = String(n - d);
      c.style.opacity = d > PEEK ? '0' : '1';
      c.classList.toggle('front', d === 0);
      if (d === 0) { c.removeAttribute('aria-hidden'); c.inert = false; }
      else { c.setAttribute('aria-hidden', 'true'); c.inert = true; }
    });
    root.querySelectorAll('[data-cs="pick"]').forEach(function (b) { b.setAttribute('aria-current', String(Number(b.getAttribute('data-i')) === cur)); });
    root.querySelectorAll('.cs-dots i').forEach(function (d) { d.classList.toggle('on', Number(d.getAttribute('data-i')) === cur); });
    var count = root.querySelector('.cs-count'); if (count) count.textContent = (cur + 1) + ' of ' + n;
  }
  function cur(root) { return Number(root.getAttribute('data-cur')) || 0; }
  function step(root, by) { show(root, cur(root) + by); }

  /** Lays out a stack drawn by html(); safe to call again. Returns false when there is nothing to lay out. */
  function mount(root) {
    if (!root || !root.querySelector('.cs-card')) return false;
    show(root, cur(root));
    if (root.__cs) return true; root.__cs = true;
    var pile = root.querySelector('.cs-pile'), drag = null;
    root.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-cs]'); if (!t || !root.contains(t)) return;
      var a = t.getAttribute('data-cs');
      if (a === 'next') step(root, 1); else if (a === 'prev') step(root, -1);
      else if (a === 'pick') show(root, Number(t.getAttribute('data-i')));
    });
    pile.addEventListener('keydown', function (e) {
      if (e.target !== pile) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(root, 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(root, -1); }
    });
    // Drag the front card aside; let go far enough and the next (or previous) card comes forward.
    pile.addEventListener('pointerdown', function (e) {
      var card = e.target.closest && e.target.closest('.cs-card.front');
      if (!card || (e.target.closest && e.target.closest('button,a,input,textarea')) || (e.button != null && e.button !== 0)) return;
      drag = { card: card, x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId, on: false };
    });
    pile.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) { if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return; drag.on = true; try { pile.setPointerCapture(e.pointerId); } catch (_) {} drag.card.classList.add('dragging'); }
      drag.dx = dx; e.preventDefault();
      drag.card.style.transform = 'translate3d(' + dx + 'px,0,0) rotate(' + (reduced() ? 0 : dx / 18) + 'deg)';
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null; d.card.classList.remove('dragging');
      if (!d.on) return;
      if (d.dx <= -SWIPE) step(root, 1); else if (d.dx >= SWIPE) step(root, -1); else show(root, cur(root));
    }
    pile.addEventListener('pointerup', end); pile.addEventListener('pointercancel', end);
    return true;
  }

  window.SotaCardStack = { html: html, mount: mount, show: show, depth: depth, MIN: MIN };
})();
