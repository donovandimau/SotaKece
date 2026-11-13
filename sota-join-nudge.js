/* Join prompt for guests (13 Nov 2026, Ops 1098).
   After a guest scrolls about a screen, or taps around the page twice, a small bar at the bottom offers
   "Join free". It opens the existing sign-up (#sk-sign-up), so the form and its checks are unchanged.
   "Not now" hides it for a week on this device. It is never shown to members, on the sign-up or sign-in
   screens, or before the page has finished its first paint.
   Every start of the sign-up flow sends cta_click {cta:'join'} through the shared Dimau beacon. */
(function () {
  'use strict';
  var KEY = 'sk-join-nudge-off', WEEK = 7 * 864e5, bar = null, shown = false, taps = 0;
  function ev(name, props) { try { if (window.SKEvent) window.SKEvent(name, props); else if (window.dimau && window.dimau.track) window.dimau.track(name, props); } catch (e) {} }
  function off() { try { var t = Number(localStorage.getItem(KEY) || 0); return t && Date.now() - t < WEEK; } catch (e) { return false; } }
  /* Guests have the sign-up button; its form sits in the #bv-entry dialog, which is open while signing up or in. */
  function guest() { return !!document.getElementById('sk-sign-up') && !document.querySelector('dialog.bv-account-dialog[open]'); }
  function hide() { if (bar) { bar.remove(); bar = null; } }
  function show() {
    if (shown || off() || !guest()) return;
    shown = true;
    bar = document.createElement('div');
    bar.className = 'sk-join-nudge';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Join Sota Kece');
    bar.innerHTML = '<p>Free to join. Make your own space.</p><button type="button" class="sk-join-go" data-sk-join>Join free</button><button type="button" class="sk-join-x" aria-label="Not now">×</button>';
    bar.querySelector('.sk-join-x').addEventListener('click', function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} hide(); });
    document.body.appendChild(bar);
    place();
    requestAnimationFrame(function () { if (bar) bar.classList.add('sk-in'); });
  }
  /* Sit above any full-width bar fixed to the bottom (the phone tab bar, the mini player). */
  function place() {
    if (!bar) return;
    var lift = 0, vh = window.innerHeight, vw = window.innerWidth;
    document.querySelectorAll('nav,[class*="mini"],[class*="player"]').forEach(function (n) {
      if (n === bar || bar.contains(n)) return;
      var s = getComputedStyle(n);
      if (s.position !== 'fixed' || s.display === 'none' || s.visibility === 'hidden') return;
      var r = n.getBoundingClientRect();
      if (r.height > 0 && r.bottom >= vh - 4 && r.width > vw * 0.5) lift = Math.max(lift, vh - r.top);
    });
    bar.style.bottom = lift ? 'calc(' + Math.round(lift + 10) + 'px + 0px)' : '';
  }
  window.addEventListener('resize', place);
  function check() {
    if (bar && !guest()) { hide(); return; }
    place();
    if (!shown && (window.scrollY || document.documentElement.scrollTop || 0) > window.innerHeight * 0.9) show();
  }
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('hashchange', function () { setTimeout(check, 0); });
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var join = t.closest('[data-sk-join]');
    if (join) {
      hide();
      var b = document.getElementById('sk-sign-up');
      if (b) b.click(); else if (window.renderAuth) window.renderAuth('up');
      return;
    }
    if (t.closest('#sk-sign-up')) { ev('cta_click', { cta: 'join' }); hide(); return; }
    if (!shown && t.closest('#app') && !t.closest('dialog') && ++taps >= 2) show();
  }, true);
  document.addEventListener('visibilitychange', function () { if (bar && !guest()) hide(); });
})();
