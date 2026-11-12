/* Sota Kece invite links (12 November 2026).
   At the top of Activity: make a link for a person or a group, send it, and see which invite worked.
   The name you give an invite ("Auckland church youth") is only for you; the person who opens the link
   sees who sent it. Each link counts its opens and the people who joined through it.
   Calls: bv_invite_create(p_label), bv_invites_mine() (supabase/migrations/20261112180000_sota_invites.sql).
   The link is /i/<token> (api/invite.js); its button goes to sign-up with ?ref=<token>, which index.html
   remembers and claims once the room exists. If the functions are not there yet the panel stays hidden. */
(function () {
  'use strict';
  if (window.SotaInvites) return;

  var SITE = 'https://sotakece.com';
  var SHOWN = 8;
  var state = { data: null, busy: false, msg: '', all: false };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = Number(v); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function day(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function colour(c) { return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : '#4FA8D8'; }
  function safePath(p) { return /^\/i\/[a-f0-9]{32}$/.test(String(p || '')) ? p : ''; }
  function link(path) { return SITE + path; }
  function name(i) { return String(i.label || '').trim() || 'Invite made ' + day(i.created_at); }

  /** The message that goes out with the link. */
  function message(me) {
    var who = me && String(me.display_name || me.handle || '').trim();
    return (who ? who + ' here. ' : '') + 'Come join me on Sota Kece: a small private social network for actual friends. No algorithm, no ads.';
  }

  function body() {
    var d = state.data;
    if (!d) return '';
    var list = Array.isArray(d.invites) ? d.invites : [], joined = Array.isArray(d.joined) ? d.joined : [];
    var t = d.totals || {};
    var head = '<div class="iv-head"><h3>Invite your people</h3>' +
      '<p class="sub">Sota Kece grows one friend at a time. Make a link for a person or a group, send it, and see who joins. The name is only for you.</p></div>';
    var form = '<form class="iv-form" data-iv="make"><label for="iv-label">Who is this invite for?</label>' +
      '<div class="iv-row"><input id="iv-label" name="label" maxlength="60" autocomplete="off" placeholder="e.g. Auckland church youth">' +
      '<button type="submit" class="btn sm"' + (state.busy ? ' disabled' : '') + '>' + (state.busy ? 'Making…' : 'Make invite link') + '</button></div>' +
      '<p class="iv-msg" role="status" aria-live="polite">' + esc(state.msg) + '</p></form>';
    if (!list.length) return head + form;
    var tiles = [[num(t.invites), 'invites'], [num(t.opens), 'opens'], [num(t.joins), 'joined']].map(function (x) {
      return '<div class="iv-tile"><b>' + x[0] + '</b><span>' + x[1] + '</span></div>';
    }).join('');
    var rows = (state.all ? list : list.slice(0, SHOWN)).map(function (i) {
      var p = safePath(i.path); if (!p) return '';
      return '<li><span class="iv-what"><b>' + esc(name(i)) + '</b><small>' + plural(num(i.opens), 'open', 'opens') + ' · ' +
        plural(num(i.joins), 'joined', 'joined') + ' · made ' + esc(day(i.created_at)) + '</small></span>' +
        '<button type="button" class="btn sm ghost" data-iv="send" data-path="' + esc(p) + '">Send</button></li>';
    }).join('');
    var more = list.length > SHOWN && !state.all ? '<button type="button" class="sp-link" data-iv="all">Show all ' + list.length + ' invites</button>' : '';
    var people = joined.length ? '<h4>Joined through your invites</h4><ul class="iv-people">' + joined.slice(0, 12).map(function (p) {
      return '<li><span class="av sm" style="--accent:' + esc(colour(p.accent)) + '">' + esc(p.avatar_emoji || '🌺') + '</span>' +
        '<span class="iv-what"><b>' + esc(p.display_name || p.handle) + '</b><small>@' + esc(p.handle) + (p.label ? ' · ' + esc(p.label) : '') + ' · ' + esc(day(p.created_at)) + '</small></span>' +
        '<button type="button" class="btn sm ghost" data-sp="room" data-handle="' + esc(p.handle) + '">Room</button></li>';
    }).join('') + '</ul>' : '';
    return head + form + '<div class="iv-tiles">' + tiles + '</div><ul class="iv-list">' + rows + '</ul>' + more + people;
  }

  var host = null, call = null, me = null;
  function paint() {
    if (!host || !host.isConnected) return;
    var typed = host.querySelector('#iv-label'), value = typed ? typed.value : '', focused = typed && document.activeElement === typed;
    host.innerHTML = body(); host.hidden = !state.data;
    var again = host.querySelector('#iv-label'); if (again) { again.value = value; if (focused) again.focus(); }
  }
  async function load() {
    try { state.data = await call('bv_invites_mine'); } catch (_) { state.data = null; }
    if (!state.data || typeof state.data !== 'object') state.data = null;
    paint();
    return !!state.data;
  }

  /** Activity calls this with a placeholder from html(), its own rpc helper and the member's profile. */
  async function fill(el, rpc, profile) {
    host = el; call = rpc; me = profile || null; state.msg = ''; state.all = false;
    if (!host) return false;
    return load();
  }
  function html() { return '<section class="glass card iv-card" data-invites hidden></section>'; }

  function send(path) {
    var url = link(path);
    if (window.SotaShare && typeof window.SotaShare.share === 'function') return window.SotaShare.share({ url: url, title: 'Join me on Sota Kece', text: message(me) });
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url); state.msg = 'Link copied. Ready to send.'; paint(); } } catch (_) {}
  }
  var SAY = { TOO_MANY_INVITES: 'You have 50 invites already. Send one of those again.', NOT_SIGNED_IN: 'Sign in again to make an invite.' };
  async function make(label) {
    if (state.busy) return;
    state.busy = true; state.msg = ''; paint();
    var made = null;
    try { made = await call('bv_invite_create', { p_label: String(label || '').slice(0, 60) }); }
    catch (e) { var m = String((e && e.message) || ''); state.msg = SAY[Object.keys(SAY).filter(function (k) { return m.indexOf(k) >= 0; })[0]] || 'That did not work. Try again in a moment.'; }
    state.busy = false;
    if (made && safePath(made.path)) {
      var box = host && host.querySelector('#iv-label'); if (box) box.value = '';
      state.msg = 'Invite ready. Send it on WhatsApp, Messenger or anywhere.';
      await load();
      send(made.path);
    } else paint();
  }

  document.addEventListener('submit', function (e) {
    var f = e.target.closest && e.target.closest('[data-invites] form[data-iv="make"]'); if (!f) return;
    e.preventDefault(); make(f.querySelector('#iv-label').value);
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-invites] [data-iv]'); if (!t) return;
    var a = t.getAttribute('data-iv');
    if (a === 'send') { var p = safePath(t.getAttribute('data-path')); if (p) send(p); }
    else if (a === 'all') { state.all = true; paint(); }
  });

  window.SotaInvites = { html: html, fill: fill, message: message, name: name, _state: state };
})();
