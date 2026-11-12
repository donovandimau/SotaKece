/* Sota Kece hub map (12 November 2026).
   The starter Koro on a real map of Fiji: the Copernicus Sentinel-2 mosaic already kept in the Dimau
   basemap bucket (zoom 6-14, land tiles only; index.json lists which exist). Suva and Nadi & Lautoka
   are pins; UK & overseas sits as a chip, because the imagery only covers Fiji.
   Zoom adds detail: a pin shows its name, then its member count, then the blurb with Join / Open.
   Data and joining come from sota-hubs.js (SotaHubs.load / joinHub / openHub), so the card and the map
   never disagree. Drag or arrow keys to move, wheel / pinch / + and - to zoom, Esc to close. */
(function () {
  'use strict';
  if (window.SotaHubMap) return;

  var TILES = 'https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/basemap/fiji-s2/';
  var CREDIT = 'Imagery: contains modified Copernicus Sentinel data 2024–2026';
  var ZMIN = 6.5, ZMAX = 13, TILE = 256;
  // Where each starter Koro sits. `diaspora` has no place on a map of Fiji, so it is shown as a chip.
  var PLACES = { suva: { lat: -18.1416, lon: 178.4419 }, west: { lat: -17.70, lon: 177.44 } };
  var HOME = { lat: -17.62, lon: 178.65 };   // the middle of the main islands
  var MAIN = { n: -15.9, w: 177.0, s: -19.3, e: 180.3 };   // Viti Levu, Vanua Levu and Taveuni
  var BOUNDS = { latMin: -21.5, latMax: -15.2, lonMin: 176.4, lonMax: 181.6 };

  var index = null, indexLoading = null;
  var root = null, view = null, layer = null, pinsBox = null, chipBox = null, hint = null;
  var hubs = [], open_ = false, lastFocus = null;
  var cam = { lat: HOME.lat, lon: HOME.lon, z: 7 }, tiles = {}, raf = 0;
  // While the map is moving it only stretches the tiles it already has; new ones are fetched once it settles,
  // so a zoom never queues dozens of in-between downloads. Older tiles stay underneath until the sharper ones arrive.
  var flying = false, lastMove = 0, shownZ = 7, settleTimer = 0;

  /* ----------------------------------------------------------- projection (Web Mercator) */
  // Longitudes west of 180° are carried on past it (−179 → 181) so Fiji stays in one piece.
  function lonU(lon) { return lon < 0 ? lon + 360 : lon; }
  function project(lat, lon, z) {
    var w = TILE * Math.pow(2, z), s = Math.sin(lat * Math.PI / 180);
    return { x: (lonU(lon) + 180) / 360 * w, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * w };
  }
  function unproject(x, y, z) {
    var w = TILE * Math.pow(2, z), lon = x / w * 360 - 180, n = Math.PI - 2 * Math.PI * y / w;
    return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lon: lon };
  }
  function clampCam() {
    cam.z = Math.min(ZMAX, Math.max(ZMIN, cam.z));
    cam.lat = Math.min(BOUNDS.latMax, Math.max(BOUNDS.latMin, cam.lat));
    cam.lon = Math.min(BOUNDS.lonMax, Math.max(BOUNDS.lonMin, lonU(cam.lon)));
  }
  // What a pin shows at a given zoom: 1 name, 2 + member count, 3 + blurb and Join / Open.
  function detail(z) { return z < 8.5 ? 1 : z < 10 ? 2 : 3; }

  /* ----------------------------------------------------------- data */
  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (indexLoading) return indexLoading;
    indexLoading = fetch(TILES + 'index.json', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { index = d && d.index ? d.index : {}; return index; })
      .catch(function () { index = {}; return index; });
    return indexLoading;
  }
  function has(z, x, y) { var col = index && index[z] && index[z][x]; return !!(col && col.indexOf(y) !== -1); }
  function num(v) { var n = Number(v); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function members(h) { var n = num(h.members); return n ? n + (n === 1 ? ' member' : ' members') : 'Be the first'; }

  /* ----------------------------------------------------------- drawing */
  function size() { return { w: view.clientWidth || 360, h: view.clientHeight || 480 }; }
  function settled() { return !flying && Date.now() - lastMove > 160; }
  function moved() { lastMove = Date.now(); clearTimeout(settleTimer); settleTimer = setTimeout(schedule, 180); }
  function draw() {
    raf = 0;
    if (!open_) return;
    clampCam();
    var s = size(), still = settled();
    var want = Math.min(14, Math.max(6, Math.round(cam.z)));
    if (still) shownZ = want;
    var zt = shownZ, k = Math.pow(2, cam.z - zt), c = project(cam.lat, cam.lon, zt), n = Math.pow(2, zt), need = 0, ready = 0;
    if (still) {
      var x0 = Math.floor((c.x - s.w / 2 / k) / TILE), x1 = Math.floor((c.x + s.w / 2 / k) / TILE);
      var y0 = Math.floor((c.y - s.h / 2 / k) / TILE), y1 = Math.floor((c.y + s.h / 2 / k) / TILE);
      for (var tx = x0; tx <= x1; tx++) for (var ty = y0; ty <= y1; ty++) {
        var wx = ((tx % n) + n) % n;
        if (ty < 0 || ty >= n || !has(zt, wx, ty)) continue;
        var key = zt + '/' + tx + '/' + ty, t = tiles[key];
        if (!t) {
          var img = document.createElement('img');
          img.alt = ''; img.decoding = 'async'; img.draggable = false; img.className = 'hm-tile';
          t = tiles[key] = { img: img, z: zt, x: tx, y: ty, ok: false };
          img.onload = function () { this._t.ok = true; schedule(); };
          img.onerror = function () { this._t.ok = true; this.remove(); };
          img._t = t;
          img.src = TILES + zt + '/' + wx + '/' + ty + '.webp';
          layer.appendChild(img);
        }
        need++; if (t.ok) ready++;
      }
    }
    var allIn = still && ready === need;
    Object.keys(tiles).forEach(function (key) {
      var t = tiles[key], kk = Math.pow(2, cam.z - t.z), cc = project(cam.lat, cam.lon, t.z);
      var left = (t.x * TILE - cc.x) * kk + s.w / 2, top = (t.y * TILE - cc.y) * kk + s.h / 2, edge = TILE * kk;
      var off = left > s.w || top > s.h || left + edge < 0 || top + edge < 0;
      if ((t.z !== zt && allIn) || (off && t.z !== zt) || (off && still)) { t.img.remove(); delete tiles[key]; return; }
      t.img.style.zIndex = t.z === zt ? 2 : 1;
      t.img.style.transform = 'translate(' + left + 'px,' + top + 'px) scale(' + kk + ')';
    });
    drawPins(s);
    var d = detail(cam.z);
    hint.textContent = d === 1 ? 'Zoom in on a hub to see who is there.' : d === 2 ? 'Closer still to join.' : 'Tap a hub to join or open its Koro.';
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(draw); }

  function hubCard(h, d) {
    var go = h.joined ? 'open' : 'join';
    return '<span class="hm-emoji" aria-hidden="true">' + esc(h.emoji || '🪸') + '</span>' +
      '<span class="hm-text"><b>' + esc(h.name) + '</b>' +
      (d >= 2 ? '<small>' + esc(h.joined ? 'You are in · ' + members(h) : members(h)) + '</small>' : '') +
      (d >= 3 && h.blurb ? '<small class="hm-blurb">' + esc(h.blurb) + '</small>' : '') + '</span>' +
      (d >= 3 ? '<button type="button" class="hm-go" data-hm="' + go + '" data-slug="' + esc(h.slug) + '">' + (h.joined ? 'Open Koro' : 'Join') + '</button>' : '');
  }
  function drawPins(s) {
    var d = detail(cam.z), c = project(cam.lat, cam.lon, cam.z), labels = '', dots = '', chips = '';
    hubs.forEach(function (h) {
      var p = PLACES[h.slug];
      if (!p) { chips += '<div class="hm-chip">' + hubCard(h, 3) + '</div>'; return; }
      var at = project(p.lat, p.lon, cam.z), x = at.x - c.x + s.w / 2, y = at.y - c.y + s.h / 2;
      if (x < -160 || y < -160 || x > s.w + 160 || y > s.h + 160) return;
      var at_ = 'left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px';
      // Far out, the whole label zooms to the hub; close in it holds the Join / Open button instead.
      labels += d < 3
        ? '<button type="button" class="hm-label hm-d' + d + (h.joined ? ' on' : '') + '" style="' + at_ + '" data-hm="fly" data-slug="' + esc(h.slug) + '">' + hubCard(h, d) + '</button>'
        : '<div class="hm-label hm-d' + d + (h.joined ? ' on' : '') + '" style="' + at_ + '">' + hubCard(h, d) + '</div>';
      dots += '<button type="button" class="hm-dot' + (h.joined ? ' on' : '') + '" style="' + at_ + '" data-hm="fly" data-slug="' + esc(h.slug) + '" aria-label="' + esc('Zoom to ' + h.name) + '"></button>';
    });
    // Dots go after the labels, so a label can never cover another hub's dot.
    pinsBox.innerHTML = labels + dots;
    // Keep each label on screen; the dot stays on the place.
    Array.prototype.forEach.call(pinsBox.querySelectorAll('.hm-label'), function (l) {
      var r = l.getBoundingClientRect(), v = view.getBoundingClientRect(), shift = 0;
      if (r.left < v.left + 8) shift = v.left + 8 - r.left;
      else if (r.right > v.right - 8) shift = v.right - 8 - r.right;
      if (shift) l.style.transform = 'translate(calc(-50% + ' + shift.toFixed(1) + 'px), 20px)';
    });
    if (chipBox.innerHTML !== chips) chipBox.innerHTML = chips;
  }

  /* ----------------------------------------------------------- moving */
  function zoomAt(dz, px, py) {
    var s = size(), before = project(cam.lat, cam.lon, cam.z);
    var fx = before.x + (px - s.w / 2), fy = before.y + (py - s.h / 2), focus = unproject(fx, fy, cam.z);
    cam.z += dz; clampCam();
    var after = project(focus.lat, focus.lon, cam.z), ctr = unproject(after.x - (px - s.w / 2), after.y - (py - s.h / 2), cam.z);
    cam.lat = ctr.lat; cam.lon = ctr.lon; moved(); schedule();
  }
  function pan(dx, dy) {
    var c = project(cam.lat, cam.lon, cam.z), ctr = unproject(c.x - dx, c.y - dy, cam.z);
    cam.lat = ctr.lat; cam.lon = ctr.lon; moved(); schedule();
  }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function fly(lat, lon, z) {
    if (reduced()) { cam.lat = lat; cam.lon = lon; cam.z = z; schedule(); return; }
    var from = { lat: cam.lat, lon: lonU(cam.lon), z: cam.z }, t0 = performance.now(), dur = 700;
    flying = true;
    (function step(now) {
      if (!open_) return;
      var t = Math.min(1, (now - t0) / dur), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      cam.lat = from.lat + (lat - from.lat) * e; cam.lon = from.lon + (lonU(lon) - from.lon) * e; cam.z = from.z + (z - from.z) * e;
      if (t >= 1) flying = false;
      draw(); if (t < 1) requestAnimationFrame(step);
    })(t0);
  }
  // The zoom that fits the main islands into the space between the header and the controls.
  function fitZoom() {
    var s = size(), a = project(MAIN.n, MAIN.w, 0), b = project(MAIN.s, MAIN.e, 0);
    var z = Math.log2(Math.min(s.w * 0.86 / (b.x - a.x), (s.h - 140) * 0.86 / (b.y - a.y)));
    return Math.min(8.4, Math.max(ZMIN, z));
  }
  function fitAll() { fly(HOME.lat, HOME.lon, fitZoom()); }

  // `moved` is the function above that marks the camera as moving; never reuse the name here.
  var ptrs = {}, pinch = 0;
  function wire() {
    view.addEventListener('wheel', function (e) { e.preventDefault(); var r = view.getBoundingClientRect(); zoomAt(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    view.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      view.setPointerCapture(e.pointerId); ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; pinch = 0;
    });
    view.addEventListener('pointermove', function (e) {
      var p = ptrs[e.pointerId]; if (!p) return;
      var ids = Object.keys(ptrs);
      if (ids.length === 1) pan(e.clientX - p.x, e.clientY - p.y);
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (ids.length === 2) {
        var a = ptrs[ids[0]], b = ptrs[ids[1]], dist = Math.hypot(a.x - b.x, a.y - b.y), r = view.getBoundingClientRect();
        if (pinch) zoomAt(Math.log2(dist / pinch), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = dist;
      }
    });
    var up = function (e) { delete ptrs[e.pointerId]; pinch = 0; };
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    view.addEventListener('dblclick', function (e) { var r = view.getBoundingClientRect(); zoomAt(1, e.clientX - r.left, e.clientY - r.top); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hm]'); if (!b) return;
      var a = b.getAttribute('data-hm'), slug = b.getAttribute('data-slug');
      if (a === 'close') return close();
      if (a === 'in') return zoomAt(1, size().w / 2, size().h / 2);
      if (a === 'out') return zoomAt(-1, size().w / 2, size().h / 2);
      if (a === 'all') return fitAll();
      if (a === 'fly' && PLACES[slug]) return fly(PLACES[slug].lat, PLACES[slug].lon, 10.6);
      if (a === 'join') return join(slug, b);
      if (a === 'open') { var h = find(slug); close(); if (h && window.SotaHubs && window.SotaHubs.openHub) window.SotaHubs.openHub(h.crew_id); }
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); return close(); }
      if (e.target.closest('button') && (e.key === 'Enter' || e.key === ' ')) return;
      var step = 80, keys = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (keys[e.key]) { e.preventDefault(); pan(keys[e.key][0], keys[e.key][1]); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1, size().w / 2, size().h / 2); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(-1, size().w / 2, size().h / 2); }
      else if (e.key === 'Tab') trap(e);
    });
    addEventListener('resize', schedule);
  }
  function trap(e) {
    var f = Array.prototype.filter.call(root.querySelectorAll('button,[tabindex="0"]'), function (n) { return !n.disabled && n.getClientRects().length; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function find(slug) { for (var i = 0; i < hubs.length; i++) if (hubs[i].slug === slug) return hubs[i]; return null; }

  async function join(slug, btn) {
    var H = window.SotaHubs; if (!H || !H.joinHub) return;
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    try {
      var row = await H.joinHub(slug);
      hubs = hubs.map(function (h) { return h.slug === slug ? row : h; });
      draw();
      var again = root.querySelector('[data-hm="open"][data-slug="' + slug + '"]'); if (again) again.focus({ preventScroll: true });
    } catch (_) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
  }

  /* ----------------------------------------------------------- open / close */
  function build() {
    root = document.createElement('div');
    root.className = 'hm-root'; root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'hm-title');
    root.innerHTML =
      '<header class="hm-head"><div><h2 id="hm-title">Where Sota Kece gathers</h2><p>The starter Koro on a satellite map of Fiji.</p></div>' +
      '<button type="button" class="hm-close" data-hm="close" aria-label="Close the map">✕</button></header>' +
      '<div class="hm-view" tabindex="0" aria-label="Map of Fiji. Arrow keys move, plus and minus zoom.">' +
      '<div class="hm-layer" aria-hidden="true"></div><div class="hm-pins"></div></div>' +
      '<div class="hm-chips" aria-label="Hubs outside Fiji"></div>' +
      '<div class="hm-zoom" role="group" aria-label="Zoom"><button type="button" data-hm="in" aria-label="Zoom in">+</button>' +
      '<button type="button" data-hm="out" aria-label="Zoom out">−</button><button type="button" data-hm="all">All of Fiji</button></div>' +
      '<p class="hm-hint" aria-live="polite"></p><p class="hm-credit">' + esc(CREDIT) + '</p>';
    document.body.appendChild(root);
    view = root.querySelector('.hm-view'); layer = root.querySelector('.hm-layer');
    pinsBox = root.querySelector('.hm-pins'); chipBox = root.querySelector('.hm-chips'); hint = root.querySelector('.hm-hint');
    wire();
  }
  async function open() {
    var H = window.SotaHubs;
    if (open_ || !H || !H.load) return false;
    var list = await H.load();
    if (!list || !list.length) return false;
    hubs = list.slice();
    if (!root) build();
    lastFocus = document.activeElement;
    root.hidden = false; open_ = true;
    document.documentElement.classList.add('hm-open');
    await loadIndex();
    cam = { lat: HOME.lat, lon: HOME.lon, z: fitZoom() };
    draw();
    root.querySelector('.hm-close').focus({ preventScroll: true });
    return true;
  }
  function close() {
    if (!open_) return;
    open_ = false; flying = false; root.hidden = true;
    document.documentElement.classList.remove('hm-open');
    try { if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true }); } catch (_) {}
  }

  // The "See them on the map" button lives in the starter Koro card (sota-hubs.js adds it when this file is loaded).
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-hubmap]'); if (b) { e.preventDefault(); open(); } });

  window.SotaHubMap = {
    open: open, close: close, isOpen: function () { return open_; },
    // exposed for tests
    project: project, unproject: unproject, detail: detail, places: PLACES,
    camera: function () { return { lat: cam.lat, lon: cam.lon, z: cam.z }; },
    _index: function (d) { index = d; }
  };
})();
