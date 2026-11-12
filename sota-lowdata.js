// Sota Kece — low-data mode (12 Nov 2026).
// Island internet is patchy and data is dear. Low data turns off moving backgrounds, animation and
// video autoplay, and stops videos and background artwork downloading until someone taps play.
// It switches itself on when the phone says "Data Saver" is on or the connection is 2G; a member can
// turn it on or off from the "📶 Low data" button (any element with data-sk-lowdata).
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.SotaLowData) return;
  var KEY = 'sk-low-data', root = document.documentElement;

  function saved() { try { return localStorage.getItem(KEY); } catch (_) { return null; } }
  function auto() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
  }
  function isOn() { var s = saved(); return s === '1' ? true : s === '0' ? false : auto(); }

  function quietVideos(scope) {
    if (!root.classList.contains('sk-low-data')) return;
    (scope || document).querySelectorAll('video').forEach(function (v) {
      if (v.dataset.skLow) return; v.dataset.skLow = '1';
      if (v.autoplay) { v.autoplay = false; try { v.pause(); } catch (_) {} }
      v.preload = 'none'; v.controls = true;
    });
    (scope || document).querySelectorAll('img:not([loading])').forEach(function (i) { i.loading = 'lazy'; });
  }
  function paint() {
    var on = isOn();
    root.classList.toggle('sk-low-data', on);
    document.querySelectorAll('[data-sk-lowdata]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(on));
      var s = b.querySelector('.sk-low-state'); if (s) s.textContent = on ? 'On' : 'Off';
    });
    if (on) quietVideos();
  }
  function set(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) {} paint(); }

  paint();
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-sk-lowdata]'); if (!b) return;
    e.preventDefault(); set(!isOn());
  });
  function watch() {
    paint();
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function (m) {
        if (!root.classList.contains('sk-low-data')) { if (document.querySelector('[data-sk-lowdata]:not([aria-pressed])')) paint(); return; }
        m.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) quietVideos(n); }); });
        if (document.querySelector('[data-sk-lowdata]:not([aria-pressed])')) paint();
      }).observe(document.body, { childList: true, subtree: true });
    }
    var c = navigator.connection; if (c && c.addEventListener) c.addEventListener('change', paint);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

  window.SotaLowData = { isOn: isOn, set: set, auto: auto };
})();
