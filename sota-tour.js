/* Sota Kece guided tour (11 November 2026).
   A short "show me around" for new members: Talanoa Wall -> starter Koro -> Music -> Sere -> My space.
   It moves through the member's real pages with the existing go(), rings the part being explained and
   shows one small card. No backend, nothing stored except two device-only flags:
     sk-tour-pending  set when a member has just created their room (index.html #f-go)
     sk-tour-done     set once the tour has been finished or skipped, so it never starts by itself again
   Anyone can run it again from search ("Show me around"). Esc ends it; the arrow keys move through it. */
(function () {
  'use strict';
  if (window.SotaTour) return;

  var PENDING = 'sk-tour-pending', DONE = 'sk-tour-done';
  var cfg = null, ring = null, card = null, i = 0, active = false, stepToken = 0, lastFocus = null;

  // Each stop: where to go, what to ring (first selector that is on the page wins) and what to say.
  // `need` drops a stop that cannot be shown here (for example Sere when that feature is not loaded).
  var STOPS = [
    { view: 'pulse', find: ['.tw-wrap', '#view h1'], title: 'The Talanoa Wall',
      text: 'One live feed for every member, at home and overseas. Say bula: your first post can be a single line.' },
    { view: 'pulse', find: ['.hub-card', '#view h1'], title: 'Join a starter Koro',
      text: 'Suva, Nadi & Lautoka, or UK & overseas. Joining one is the quickest way to meet people and get your feed going.',
      fallbackView: 'crews' },
    { view: 'music', find: ['#view h1', '#view'], title: 'Your island soundtrack',
      text: 'Pick a song and it keeps playing while you move around Sota Kece. Set one on your page so visitors hear it too.' },
    { view: 'pulse', find: ['[data-tw="sere"]'], title: 'Make a photo sing',
      text: 'Sere turns a photo and a short recording into a singing clip for the wall. You can make five a day.',
      need: function () { return !!window.SotaSere; } },
    { view: 'room', find: ['#view h1', '#view'], title: 'My space',
      text: 'Your room, your rules. Choose a Fiji-first skin, add your photos and pick the song people hear when they visit.' }
  ];

  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function member() { var s = cfg && cfg.state; return !!(s && s.user && s.me); }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function stops() { return STOPS.filter(function (s) { return !s.need || s.need(); }); }

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function build() {
    ring = el('div', 'sk-tour-ring', { 'aria-hidden': 'true' });
    card = el('section', 'sk-tour-card', { role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'sk-tour-title', 'aria-describedby': 'sk-tour-text' });
    card.innerHTML =
      '<div class="sk-tour-top"><span class="sk-tour-step" id="sk-tour-step"></span><span class="sk-tour-dots" aria-hidden="true"></span>' +
      '<button type="button" class="sk-tour-skip" data-tour="skip">Skip tour</button></div>' +
      '<h2 class="sk-tour-title" id="sk-tour-title" tabindex="-1"></h2><p class="sk-tour-text" id="sk-tour-text"></p>' +
      '<div class="sk-tour-actions"><button type="button" class="sk-tour-back" data-tour="back">Back</button>' +
      '<button type="button" class="sk-tour-next" data-tour="next">Next</button></div>';
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tour]'); if (!b) return;
      var a = b.getAttribute('data-tour');
      if (a === 'next') show(i + 1); else if (a === 'back') show(i - 1); else finish();
    });
    document.body.appendChild(ring);
    document.body.appendChild(card);
  }

  function find(list) {
    for (var k = 0; k < list.length; k++) {
      var n = document.querySelector(list[k]);
      if (n && n.getClientRects().length) return n;
    }
    return null;
  }

  // Panels such as the starter Koro fill in after the page renders, so look for a moment before giving up.
  function waitFor(list, token) {
    return new Promise(function (done) {
      var tries = 0;
      (function look() {
        if (token !== stepToken) return done(null);
        var n = find(list);
        if (n || tries++ >= 15) return done(n);
        setTimeout(look, 100);
      })();
    });
  }

  function place(target) {
    if (!ring) return;
    if (!target) { ring.hidden = true; return; }
    var r = target.getBoundingClientRect(), pad = 8;
    var top = Math.max(r.top - pad, 4), left = Math.max(r.left - pad, 4);
    var bottom = Math.min(r.bottom + pad, innerHeight - 4), right = Math.min(r.right + pad, innerWidth - 4);
    if (bottom - top < 16 || right - left < 16) { ring.hidden = true; return; }
    ring.hidden = false;
    ring.style.top = top + 'px'; ring.style.left = left + 'px';
    ring.style.width = (right - left) + 'px'; ring.style.height = (bottom - top) + 'px';
    // Keep the card off the part it is explaining: flip it to the top if the two would overlap.
    card.classList.remove('sk-tour-card--top');
    var c = card.getBoundingClientRect();
    if (c.top < bottom && c.bottom > top && c.left < right && c.right > left && top > c.height + 80) card.classList.add('sk-tour-card--top');
  }

  var current = null;
  function reposition() { if (active) place(current && current.isConnected ? current : null); }

  async function show(n) {
    var list = stops();
    if (n < 0) return;
    if (n >= list.length) return finish();
    i = n;
    var s = list[i], token = ++stepToken;
    card.querySelector('#sk-tour-step').textContent = 'Step ' + (i + 1) + ' of ' + list.length;
    card.querySelector('.sk-tour-dots').innerHTML = list.map(function (_, k) { return '<i' + (k <= i ? ' class="on"' : '') + '></i>'; }).join('');
    card.querySelector('#sk-tour-title').textContent = s.title;
    card.querySelector('#sk-tour-text').textContent = s.text;
    card.querySelector('[data-tour="back"]').hidden = i === 0;
    card.querySelector('[data-tour="next"]').textContent = i === list.length - 1 ? 'Finish' : 'Next';
    ring.hidden = true; current = null;
    try { if (cfg.state.tab !== s.view) await cfg.go(s.view); } catch (_) {}
    var target = await waitFor(s.find, token);
    if (!target && s.fallbackView && token === stepToken) {
      try { await cfg.go(s.fallbackView); } catch (_) {}
      target = await waitFor(['#view h1', '#view'], token);
    }
    if (token !== stepToken || !active) return;
    current = target;
    if (target && target.scrollIntoView) {
      try { target.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); } catch (_) { target.scrollIntoView(); }
    }
    setTimeout(reposition, reduced() ? 0 : 350);
    reposition();
    card.querySelector('#sk-tour-title').focus({ preventScroll: true });
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
    var typing = e.target && e.target.closest && e.target.closest('input,textarea,select,[contenteditable="true"]');
    if (typing) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
  }

  function start() {
    if (active || !cfg || !member()) return false;
    store(PENDING, null);
    lastFocus = document.activeElement;
    if (!card) build();
    ring.hidden = true; card.hidden = false; active = true;
    document.documentElement.classList.add('sk-touring');
    addEventListener('keydown', onKey, true);
    addEventListener('resize', reposition);
    addEventListener('scroll', reposition, true);
    show(0);
    return true;
  }

  function finish() {
    if (!active) return;
    active = false; stepToken++; current = null;
    store(DONE, '1'); store(PENDING, null);
    if (ring) ring.hidden = true;
    if (card) card.hidden = true;
    document.documentElement.classList.remove('sk-touring');
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', reposition);
    removeEventListener('scroll', reposition, true);
    try { if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true }); } catch (_) {}
  }

  // A member who has just made their room gets the tour once, after their first page has drawn.
  function maybeAuto() {
    if (read(PENDING) !== '1' || read(DONE) === '1') return;
    var tries = 0;
    (function wait() {
      if (member() && document.querySelector('#view')) { setTimeout(start, 900); return; }
      if (tries++ < 40) setTimeout(wait, 500);
    })();
  }

  window.SotaTour = {
    init: function (o) { cfg = o || null; maybeAuto(); },
    start: start,
    stop: finish,
    active: function () { return active; },
    stops: function () { return stops().map(function (s) { return { view: s.view, title: s.title }; }); }
  };
})();
