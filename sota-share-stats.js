/* Sota Kece share stats (12 November 2026).
   At the top of Activity: what happened to the wall posts you shared. Three totals (links shared, opens,
   people who joined through you), a bar chart of your links (opens and joins, tap a bar for the exact
   figures and to open the post), a filter by when you shared, and the people who joined through you.
   One read: bv_share_stats() (supabase/migrations/20261112120000_sota_share_stats.sql), which returns only
   the member's own rows. Opens and joins are running counts on each link, so the filter goes by the day the
   link was made, and the panel says so. If the function is not there yet the panel stays hidden. */
(function () {
  'use strict';
  if (window.SotaShareStats) return;

  var DAY = 864e5, MAXBARS = 8;
  var state = { data: null, range: 'all', sel: null };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(v); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function day(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function colour(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : '#4FA8D8'; }

  // Links made inside the chosen window (by the day each link was first shared).
  function inRange(links, range, now) {
    var cut = range === '7' ? 7 : range === '30' ? 30 : 0;
    if (!cut) return links.slice();
    return links.filter(function (l) { var t = Date.parse(l.created_at); return !isNaN(t) && now - t <= cut * DAY; });
  }
  function totals(links) {
    return links.reduce(function (a, l) { a.links++; a.opens += num(l.opens); a.joins += num(l.joins); return a; }, { links: 0, opens: 0, joins: 0 });
  }
  // Busiest links first; ties keep the newest first.
  function top(links) {
    return links.slice().sort(function (a, b) { return num(b.opens) - num(a.opens) || num(b.joins) - num(a.joins); }).slice(0, MAXBARS);
  }

  function chart(links) {
    var bars = top(links), max = Math.max(1, Math.max.apply(null, bars.map(function (l) { return num(l.opens); }))), H = 120, bw = 26, gap = 14;
    var w = Math.max(240, bars.length * (bw + gap) + gap);
    var svg = '<line x1="0" x2="' + w + '" y1="' + H + '" y2="' + H + '" class="ss-axis"/>';
    bars.forEach(function (l, i) {
      var x = gap + i * (bw + gap), ho = Math.round(num(l.opens) / max * (H - 18)), hj = Math.round(num(l.joins) / max * (H - 18));
      var on = state.sel === String(l.post_id);
      svg += '<g class="ss-bar' + (on ? ' on' : '') + '" data-ss="pick" data-post="' + num(l.post_id) + '" tabindex="0" role="button" aria-pressed="' + on + '" ' +
        'aria-label="' + esc('“' + l.body + '”: ' + plural(num(l.opens), 'open', 'opens') + ', ' + plural(num(l.joins), 'person joined', 'people joined')) + '">' +
        '<rect x="' + x + '" y="0" width="' + bw + '" height="' + H + '" class="ss-hit"/>' +
        '<rect x="' + x + '" y="' + (H - Math.max(ho, 2)) + '" width="' + bw + '" height="' + Math.max(ho, 2) + '" rx="4" class="ss-open"/>' +
        (hj ? '<rect x="' + (x + 6) + '" y="' + (H - hj) + '" width="' + (bw - 12) + '" height="' + hj + '" rx="3" class="ss-join"/>' : '') +
        '<text x="' + (x + bw / 2) + '" y="' + (H - Math.max(ho, 2) - 5) + '" text-anchor="middle">' + num(l.opens) + '</text></g>';
    });
    return '<svg class="ss-chart" viewBox="0 0 ' + w + ' ' + (H + 4) + '" role="group" aria-label="Opens for each link you shared. Tap a bar for details.">' + svg + '</svg>' +
      '<p class="ss-key"><span class="ss-sw ss-open"></span>Opens <span class="ss-sw ss-join"></span>Joined through it' +
      (links.length > MAXBARS ? ' · busiest ' + MAXBARS + ' of ' + links.length + ' links' : '') + '</p>';
  }

  function readout(links) {
    var l = null;
    links.forEach(function (x) { if (String(x.post_id) === state.sel) l = x; });
    if (!l) return '<p class="ss-read">Tap a bar to see that link.</p>';
    return '<div class="ss-read on"><p>“' + esc(l.body) + (String(l.body || '').length >= 80 ? '…' : '') + '”</p>' +
      '<small>' + plural(num(l.opens), 'open', 'opens') + ' · ' + plural(num(l.joins), 'person joined', 'people joined') + ' · shared ' + esc(day(l.created_at)) + '</small>' +
      '<button type="button" class="btn sm ghost" data-ss="post" data-post="' + num(l.post_id) + '">See the post</button></div>';
  }

  function body() {
    var d = state.data, now = Date.now();
    if (!d) return '';
    var all = Array.isArray(d.links) ? d.links : [], joined = Array.isArray(d.joined) ? d.joined : [];
    var head = '<div class="ss-head"><h3>Your shared posts</h3><p class="sub">What happened after you shared from the Talanoa Wall. Only you see this.</p></div>';
    if (!all.length && !joined.length) {
      return head + '<p class="ss-empty">Nothing shared yet. Tap <b>Share</b> on any wall post: when someone opens your link or joins through it, it shows up here.</p>';
    }
    var links = inRange(all, state.range, now), t = state.range === 'all' && d.totals ? { links: num(d.totals.links), opens: num(d.totals.opens), joins: num(d.totals.joins) } : totals(links);
    var chips = [['all', 'All'], ['30', 'Last 30 days'], ['7', 'Last 7 days']].map(function (c) {
      return '<button type="button" class="ss-chip' + (state.range === c[0] ? ' on' : '') + '" data-ss="range" data-range="' + c[0] + '" aria-pressed="' + (state.range === c[0]) + '">' + c[1] + '</button>';
    }).join('');
    var tiles = [[t.links, 'links shared'], [t.opens, 'opens'], [t.joins, 'joined through you']].map(function (x) {
      return '<div class="ss-tile"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>';
    }).join('');
    var people = joined.length ? '<h4>Joined through you</h4><ul class="ss-people">' + joined.slice(0, 12).map(function (p) {
      return '<li><span class="av sm" style="--accent:' + esc(colour(p.accent)) + '">' + esc(p.avatar_emoji || '🌺') + '</span>' +
        '<span class="ss-who"><b>' + esc(p.display_name || p.handle) + '</b><small>@' + esc(p.handle) + ' · ' + esc(day(p.created_at)) + '</small></span>' +
        '<button type="button" class="btn sm ghost" data-sp="room" data-handle="' + esc(p.handle) + '">Room</button></li>';
    }).join('') + '</ul>' : '';
    return head + '<div class="ss-chips" role="group" aria-label="When you shared">' + chips + '</div>' +
      '<div class="ss-tiles">' + tiles + '</div>' +
      (links.length ? chart(links) + readout(links) : '<p class="ss-empty">No links shared in this period.</p>') +
      '<p class="ss-note">Periods go by the day you shared a link; opens and joins are counted since then.</p>' + people;
  }

  var host = null;
  function paint() { if (host && host.isConnected) { host.innerHTML = body(); host.hidden = !state.data; } }

  /** Activity calls this with a placeholder from html() and its own rpc helper. */
  async function fill(el, rpc) {
    host = el; state.sel = null;
    if (!host) return false;
    try { state.data = await rpc('bv_share_stats'); } catch (_) { state.data = null; }
    if (!state.data || typeof state.data !== 'object') { state.data = null; host.hidden = true; return false; }
    paint();
    return true;
  }
  function html() { return '<section class="glass card ss-card" data-share-stats hidden></section>'; }

  function act(t, key) {
    var a = t.getAttribute('data-ss');
    if (a === 'range') { state.range = t.getAttribute('data-range'); state.sel = null; paint(); }
    else if (a === 'pick') { var id = t.getAttribute('data-post'); state.sel = state.sel === id ? null : id; paint(); var again = host.querySelector('[data-ss="pick"][data-post="' + id + '"]'); if (key && again && again.focus) again.focus(); }
    else if (a === 'post') {
      // The wall opens #talanoa=<post> when it draws; switch to it without recording a route, which would replace the hash first.
      try { history.replaceState(null, '', location.pathname + location.search + '#talanoa=' + num(t.getAttribute('data-post'))); } catch (_) {}
      if (typeof window.go === 'function') window.go('pulse', { history: false });
    }
  }
  document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-share-stats] [data-ss]'); if (t) act(t); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target.closest && e.target.closest('[data-share-stats] g[data-ss]'); if (!t) return;
    e.preventDefault(); act(t, true);
  });

  window.SotaShareStats = { html: html, fill: fill, inRange: inRange, totals: totals, top: top, _state: state };
})();
