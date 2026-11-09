/* Dimau Premium Shell v1 controller. Canonical: dimau-platform-standard/premium-shell/. Copy unchanged.
   Bottom navigation state, floating search overlay, badges. No network, no storage, no framework.
   Apps plug in through window.DimauShell:
     DimauShell.nav.setActive('home')      mark one tab current (data-dps-tab)
     DimauShell.nav.badge('friends', 3)    show/clear a count on a tab
     DimauShell.search.provider(fn)        fn(query, signal) -> Promise<[{label, hint, href, icon, run}]>
     DimauShell.search.open() / close()    the overlay (also: any [data-dps-search-open], "/" or Ctrl/Cmd+K)
   Markup: see README.md. Everything degrades to plain links and a plain <form role="search"> without this file. */
(function () {
  'use strict';
  if (window.DimauShell) return;
  var doc = document, NAV = '[data-dps-nav]', SEARCH = '[data-dps-search]';
  var provider = null, opener = null, timer = 0, controller = null, activeIndex = -1, lastQuery = null;
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function nav() { return doc.querySelector(NAV); }
  function overlay() { return doc.querySelector(SEARCH); }
  function parts() { var o = overlay(); if (!o) return null; return { root: o, input: o.querySelector('[data-dps-search-input]'), results: o.querySelector('[data-dps-search-results]'), status: o.querySelector('[data-dps-search-status]'), form: o.querySelector('[data-dps-search-form]'), panel: o.querySelector('[role="dialog"]') }; }
  function focusable(root) { return Array.prototype.filter.call(root.querySelectorAll('a[href],button,input,select,textarea,[tabindex]'), function (el) { return el.tabIndex >= 0 && !el.disabled && el.getClientRects().length > 0; }); }

  /* ---- navigation ------------------------------------------------------ */
  function setActive(key) {
    var n = nav(); if (!n) return;
    Array.prototype.forEach.call(n.querySelectorAll('[data-dps-tab]'), function (el) {
      var on = el.getAttribute('data-dps-tab') === key;
      if (el.tagName === 'A') { if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); }
      else el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function badge(key, count) {
    var n = nav(); if (!n) return;
    var tab = n.querySelector('[data-dps-tab="' + key + '"]'); if (!tab) return;
    var b = tab.querySelector('.dps-badge');
    var value = Number(count) > 0 ? (Number(count) > 99 ? '99+' : String(Math.floor(Number(count)))) : '';
    if (!value) { if (b) b.remove(); tab.removeAttribute('data-dps-count'); return; }
    if (!b) { b = doc.createElement('span'); b.className = 'dps-badge'; b.setAttribute('aria-hidden', 'true'); tab.appendChild(b); }
    b.textContent = value; tab.setAttribute('data-dps-count', value);
  }
  function syncFromHash() {
    var n = nav(); if (!n || !n.hasAttribute('data-dps-nav-hash')) return;
    var hash = location.hash || '#';
    var match = n.querySelector('[data-dps-tab][href="' + hash.replace(/"/g, '') + '"]');
    if (match) setActive(match.getAttribute('data-dps-tab'));
  }

  /* ---- search overlay --------------------------------------------------- */
  function render(items, query) {
    var p = parts(); if (!p || !p.results) return;
    activeIndex = -1;
    if (!items || !items.length) { p.results.innerHTML = ''; if (p.status) p.status.textContent = query ? (p.root.getAttribute('data-dps-empty') || 'Nothing found. Try another word.') : ''; return; }
    if (p.status) p.status.textContent = '';
    p.results.innerHTML = items.slice(0, 20).map(function (it, i) {
      var tag = it.href ? 'a' : 'button', attrs = it.href ? ' href="' + esc(it.href) + '"' : ' type="button"';
      var icon = it.icon ? '<span class="dps-result-icon" aria-hidden="true">' + (/^</.test(it.icon) ? it.icon : esc(it.icon)) + '</span>' : '';
      return '<li role="option" aria-selected="false"><' + tag + attrs + ' data-dps-result="' + i + '">' + icon + '<span class="dps-result-text"><b>' + esc(it.label) + '</b>' + (it.hint ? '<small>' + esc(it.hint) + '</small>' : '') + '</span></' + tag + '>';
    }).join('');
    p.results._items = items;
  }
  function query(value) {
    var p = parts(); if (!p) return;
    var q = String(value || '').trim();
    if (!provider) return;
    if (controller) controller.abort();
    controller = typeof AbortController === 'function' ? new AbortController() : null;
    var mine = controller;
    if (p.status) p.status.textContent = q ? (p.root.getAttribute('data-dps-searching') || 'Searching…') : '';
    Promise.resolve().then(function () { return provider(q, mine ? mine.signal : undefined); }).then(function (items) {
      if (mine !== controller) return; lastQuery = q; render(items || [], q);
    }, function (err) {
      if (mine !== controller || (err && err.name === 'AbortError')) return;
      render([], q); if (p.status) p.status.textContent = p.root.getAttribute('data-dps-error') || 'Search could not load. Check your connection and try again.';
    });
  }
  function open(from) {
    var p = parts(); if (!p) return false;
    if (!p.root.hidden) { if (p.input) p.input.focus(); return true; }
    opener = from || doc.activeElement;
    p.root.hidden = false; doc.body.classList.add('dps-search-open');
    Array.prototype.forEach.call(doc.querySelectorAll('[data-dps-search-open]'), function (el) { el.setAttribute('aria-expanded', 'true'); });
    if (p.input) { p.input.focus(); if (p.input.value) p.input.select(); }
    if (provider && lastQuery === null) query('');
    return true;
  }
  function close(restore) {
    var p = parts(); if (!p || p.root.hidden) return;
    if (controller) { controller.abort(); controller = null; }
    p.root.hidden = true; doc.body.classList.remove('dps-search-open');
    Array.prototype.forEach.call(doc.querySelectorAll('[data-dps-search-open]'), function (el) { el.setAttribute('aria-expanded', 'false'); });
    if (restore !== false && opener && typeof opener.focus === 'function' && doc.contains(opener)) opener.focus();
    opener = null;
  }
  function choose(el) {
    var p = parts(); if (!p || !p.results) return;
    var items = p.results._items || [], it = items[Number(el.getAttribute('data-dps-result'))];
    if (!it) return;
    if (typeof it.run === 'function') { close(false); it.run(it); return; }
    if (it.href) { close(false); return; }
  }
  function move(delta) {
    var p = parts(); if (!p || !p.results) return;
    var options = focusable(p.results); if (!options.length) return;
    activeIndex = (activeIndex + delta + options.length) % options.length;
    options.forEach(function (o, i) { o.parentNode.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false'); });
    options[activeIndex].focus();
  }

  doc.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var openBtn = t.closest('[data-dps-search-open]');
    if (openBtn) { e.preventDefault(); open(openBtn); return; }
    var o = overlay(); if (!o || o.hidden) return;
    if (t.closest('[data-dps-search-close]')) { e.preventDefault(); close(true); return; }
    var result = t.closest('[data-dps-result]'); if (result && o.contains(result)) { choose(result); return; }
  }, true);
  doc.addEventListener('input', function (e) {
    var p = parts(); if (!p || !p.input || e.target !== p.input) return;
    clearTimeout(timer); var v = p.input.value;
    timer = setTimeout(function () { query(v); }, 180);
  });
  doc.addEventListener('submit', function (e) {
    var p = parts(); if (!p || !p.form || e.target !== p.form) return;
    if (!provider) return; // plain form: let the app's action handle it
    e.preventDefault(); clearTimeout(timer);
    var first = p.results ? focusable(p.results)[0] : null;
    if (first && p.input && p.input.value.trim() === lastQuery) { first.click(); return; }
    query(p.input ? p.input.value : '');
  });
  doc.addEventListener('keydown', function (e) {
    var p = parts(), o = p && p.root;
    if (o && !o.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
      if (e.key === 'Tab') {
        var list = focusable(p.panel || o); if (!list.length) return;
        var first = list[0], last = list[list.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    var typing = e.target && (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable);
    if (!typing && overlay() && ((e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)))) { e.preventDefault(); open(doc.activeElement); }
  }, true);
  window.addEventListener('hashchange', syncFromHash);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', syncFromHash); else syncFromHash();

  window.DimauShell = {
    version: '1.0.0',
    nav: { setActive: setActive, badge: badge },
    search: {
      provider: function (fn) { provider = typeof fn === 'function' ? fn : null; lastQuery = null; return window.DimauShell; },
      open: function (from) { return open(from); },
      close: function () { close(true); },
      isOpen: function () { var o = overlay(); return !!o && !o.hidden; },
      render: render
    }
  };
})();
