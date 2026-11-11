/* Sota Kece people bubbles (12 November 2026).
   In the starter Koro card, "Say bula to" becomes a small living cluster: people to meet are the large
   bubbles, the starter Koro are smaller anchors, and a line joins a person to the hub you share.
   Bubbles push each other apart, can be dragged, and settle; tapping one brings it forward and opens a
   panel with the same actions the card already has (Visit room, Ask to be friends, Join / Open Koro).
   Data and actions come from sota-hubs.js (peopleToMeet, askFriend, visitRoom, joinHub, openHub).
   If there is nobody to show, or this file is missing, the card's own list stays exactly as it was. */
(function () {
  'use strict';
  if (window.SotaPeopleBubbles) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(v); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }
  function colour(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : '#4FA8D8'; }

  // ------------------------------------------------------------------ physics (pure, testable)
  // Each node: {x,y,vx,vy,r,tr,pin}. One step: pull towards the middle, push overlaps apart, damp, keep inside.
  function step(nodes, w, h, focus) {
    var cx = w / 2, cy = h / 2, moving = 0, i, j;
    for (i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      a.r += (a.tr - a.r) * 0.2;
      if (a.pin) continue;
      var k = a === focus ? 0.012 : a.hub ? 0.003 : 0.005;
      a.vx += (cx - a.x) * k; a.vy += (cy - a.y) * k;
    }
    for (i = 0; i < nodes.length; i++) for (j = i + 1; j < nodes.length; j++) {
      var p = nodes[i], q = nodes[j], dx = q.x - p.x, dy = q.y - p.y;
      if (!dx && !dy) { dx = (j - i) * 0.7; dy = 0.4; }   // two bubbles on the same spot still need a direction
      var d = Math.sqrt(dx * dx + dy * dy), min = p.r + q.r + 6;
      if (d < min) {
        var o = (min - d) / d * 0.5; dx *= o; dy *= o;
        if (!p.pin) { p.x -= dx; p.y -= dy; }
        if (!q.pin) { q.x += dx; q.y += dy; }
      }
    }
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.pin) { n.vx *= 0.82; n.vy *= 0.82; n.x += n.vx; n.y += n.vy; moving += Math.abs(n.vx) + Math.abs(n.vy); }
      n.x = Math.min(w - n.r - 4, Math.max(n.r + 4, n.x));
      n.y = Math.min(h - n.r - 4, Math.max(n.r + 4, n.y));
    }
    return moving;
  }

  // People are the stars: bigger for members who posted on the wall this month (posts is already in the data).
  function radius(p) { return 30 + Math.min(num(p.posts), 8) * 1.5; }

  function nodesFor(people, hubs, w, h) {
    var list = [], n = people.length + hubs.length, idx = 0;
    function place(node) {
      var a = (idx++ / Math.max(n, 1)) * Math.PI * 2;
      node.x = w / 2 + Math.cos(a) * w * 0.3; node.y = h / 2 + Math.sin(a) * h * 0.3; node.vx = 0; node.vy = 0; node.r = node.tr;
      list.push(node);
    }
    people.forEach(function (p) { place({ kind: 'person', id: String(p.id), data: p, tr: radius(p) }); });
    hubs.forEach(function (hub) { place({ kind: 'hub', hub: true, id: 'hub:' + hub.slug, data: hub, tr: 22 }); });
    return list;
  }
  // A person is linked to the hub they share with you (the database names it in `hub`).
  function links(nodes) {
    var byName = {}, out = [];
    nodes.forEach(function (n) { if (n.hub) byName[n.data.name] = n; });
    nodes.forEach(function (n) { if (n.kind === 'person' && n.data.hub && byName[n.data.hub]) out.push([n, byName[n.data.hub]]); });
    return out;
  }

  // ------------------------------------------------------------------ one cluster per card
  function Cluster(host, people, hubs) {
    var H = window.SotaHubs, self = this;
    var wrap = document.createElement('div');
    wrap.className = 'pb-wrap';
    wrap.innerHTML = '<h3 class="pb-title">Say bula to</h3>' +
      '<div class="pb-stage" role="group" aria-label="People to meet. Tap someone to see what you can do."><svg class="pb-lines" aria-hidden="true"></svg></div>' +
      '<div class="pb-detail" aria-live="polite"></div>';
    var list = host.querySelector('.hub-people');
    list.parentNode.insertBefore(wrap, list);
    list.hidden = true;
    var stage = wrap.querySelector('.pb-stage'), svg = wrap.querySelector('.pb-lines'), detail = wrap.querySelector('.pb-detail');
    var W = stage.clientWidth || 320, Hh = stage.clientHeight || 280;
    var nodes = nodesFor(people, hubs, W, Hh), pairs = links(nodes), focus = null, raf = 0, drag = null;

    nodes.forEach(function (n) {
      var b = document.createElement('button');
      b.type = 'button';
      if (n.kind === 'person') {
        var p = n.data;
        b.className = 'pb-b pb-person';
        b.style.setProperty('--pb-ring', colour(p.accent));
        b.innerHTML = '<span class="pb-face" aria-hidden="true">' + esc(p.avatar_emoji || '🌺') + '</span><span class="pb-name">' + esc(p.display_name || p.handle) + '</span>';
        b.setAttribute('aria-label', (p.display_name || p.handle) + (p.hub ? ', in your ' + p.hub + ' Koro' : ''));
      } else {
        b.className = 'pb-b pb-hub' + (n.data.joined ? ' on' : '');
        b.innerHTML = '<span class="pb-face" aria-hidden="true">' + esc(n.data.emoji || '🪸') + '</span>';
        b.setAttribute('aria-label', n.data.name + ' Koro, ' + num(n.data.members) + ' members');
        b.title = n.data.name;
      }
      n.el = b; stage.appendChild(b);
      b.addEventListener('pointerdown', function (e) {
        drag = { n: n, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0 }; n.pin = true;
        try { b.setPointerCapture(e.pointerId); } catch (_) {}
      });
      b.addEventListener('pointermove', function (e) {
        if (!drag || drag.n !== n) return;
        var r = stage.getBoundingClientRect();
        drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy));
        n.x = e.clientX - r.left; n.y = e.clientY - r.top; n.vx = (e.clientX - drag.lx) * 0.4; n.vy = (e.clientY - drag.ly) * 0.4;
        drag.lx = e.clientX; drag.ly = e.clientY; wake();
      });
      var end = function () { if (!drag || drag.n !== n) return; n.pin = false; n.dragged = drag.moved > 6; drag = null; wake(); };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
      b.addEventListener('click', function () { if (n.dragged) { n.dragged = false; return; } select(n); });
    });

    function paint() {
      nodes.forEach(function (n) {
        n.el.style.width = n.el.style.height = (n.r * 2).toFixed(1) + 'px';
        n.el.style.transform = 'translate(' + (n.x - n.r).toFixed(1) + 'px,' + (n.y - n.r).toFixed(1) + 'px)';
        n.el.classList.toggle('focus', n === focus);
      });
      svg.innerHTML = pairs.map(function (pq) {
        var hot = focus && (pq[0] === focus || pq[1] === focus);
        return '<line x1="' + pq[0].x.toFixed(1) + '" y1="' + pq[0].y.toFixed(1) + '" x2="' + pq[1].x.toFixed(1) + '" y2="' + pq[1].y.toFixed(1) + '"' + (hot ? ' class="hot"' : '') + '/>';
      }).join('');
    }
    function frame() {
      raf = 0;
      if (!wrap.isConnected) return;
      W = stage.clientWidth || W; Hh = stage.clientHeight || Hh;
      var m = step(nodes, W, Hh, focus);
      paint();
      if (m > 0.15 || drag) raf = requestAnimationFrame(frame);   // stop when it has settled
    }
    function wake() { if (!raf) raf = requestAnimationFrame(frame); }
    function settleNow() { for (var i = 0; i < 260; i++) step(nodes, W, Hh, focus); paint(); }

    function select(n) {
      focus = focus === n ? null : n;
      nodes.forEach(function (x) { x.tr = x.kind === 'person' ? radius(x.data) * (x === focus ? 1.25 : 1) : x === focus ? 28 : 22; });
      showDetail();
      if (reduced()) settleNow(); else wake();
    }
    function showDetail() {
      if (!focus) { detail.innerHTML = ''; return; }
      var d = focus.data, html;
      if (focus.kind === 'person') {
        var asked = H.hasAsked && H.hasAsked(d.id);
        html = '<div class="pb-card"><span class="pb-face" aria-hidden="true">' + esc(d.avatar_emoji || '🌺') + '</span>' +
          '<span class="pb-who"><b>' + esc(d.display_name || d.handle) + '</b><small>@' + esc(d.handle) +
          (d.hub ? ' · in your ' + esc(d.hub) + ' Koro' : num(d.posts) ? ' · on the wall this month' : '') + '</small></span>' +
          '<span class="pb-acts"><button type="button" class="btn sm ghost" data-pb="room">Visit room</button>' +
          '<button type="button" class="btn sm' + (asked ? ' ghost' : '') + '" data-pb="ask"' + (asked ? ' disabled' : '') + '>' + (asked ? 'Asked' : 'Ask to be friends') + '</button></span></div>';
      } else {
        html = '<div class="pb-card"><span class="pb-face" aria-hidden="true">' + esc(d.emoji || '🪸') + '</span>' +
          '<span class="pb-who"><b>' + esc(d.name) + '</b><small>' + (num(d.members) ? num(d.members) + (num(d.members) === 1 ? ' member' : ' members') : 'Be the first') + (d.joined ? ' · you are in' : '') + '</small></span>' +
          '<span class="pb-acts"><button type="button" class="btn sm" data-pb="' + (d.joined ? 'open' : 'join') + '">' + (d.joined ? 'Open Koro' : 'Join') + '</button></span></div>';
      }
      detail.innerHTML = html;
    }
    detail.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-pb]'); if (!b || !focus) return;
      var a = b.getAttribute('data-pb'), d = focus.data;
      if (a === 'room') return H.visitRoom(d.handle);
      if (a === 'open') return H.openHub(d.crew_id);
      b.disabled = true;
      if (a === 'ask') { var ok = await H.askFriend(d.id); if (!ok) b.disabled = false; else showDetail(); }
      if (a === 'join') { try { await H.joinHub(d.slug); } catch (_) { b.disabled = false; } }   // joinHub repaints the card, which mounts a fresh cluster
    });

    if (reduced()) settleNow(); else { paint(); wake(); }
    self.nodes = nodes; self.select = select; self.wrap = wrap;
  }

  // ------------------------------------------------------------------ attach to every drawn starter Koro card
  var pending = typeof WeakMap === 'function' ? new WeakMap() : null;
  async function mount(host) {
    var H = window.SotaHubs;
    if (!H || !H.peopleToMeet || !host || !host.isConnected || host.querySelector('.pb-wrap')) return null;
    if (!host.querySelector('.hub-people h3')) return null;          // first members see the invite message, not bubbles
    if (pending && pending.get(host)) return pending.get(host);
    var job = (async function () {
      var people = await H.peopleToMeet(12), hubs = (await H.load()) || [];
      if (!people.length || !host.isConnected || host.querySelector('.pb-wrap') || !host.querySelector('.hub-people')) return null;
      return new Cluster(host, people, hubs);
    })();
    if (pending) { pending.set(host, job); job.then(function () { pending.delete(host); }, function () { pending.delete(host); }); }
    return job;
  }
  document.addEventListener('sota-hubs-ready', function (e) { mount(e.target); });
  // Cards drawn before this file arrived.
  Array.prototype.forEach.call(document.querySelectorAll('[data-hubs]:not([hidden])'), function (h) { mount(h); });

  window.SotaPeopleBubbles = { mount: mount, step: step, nodesFor: nodesFor, links: links, radius: radius };
})();
