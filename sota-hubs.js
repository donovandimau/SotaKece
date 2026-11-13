/* Sota Kece — starter Koro ("hubs") and people to meet.
   A new member has no friends and no Koro. This card gives one tap into an open Koro for their
   side of Viti (Suva, Nadi & Lautoka, UK & overseas) and up to three members to say bula to.
   Rules live in supabase/migrations/20261110120000_sota_hubs.sql (bv_hubs, bv_hub_join,
   bv_people_to_meet). If those are not in the database yet the card removes itself, so the page
   it sits on looks exactly as it did before. */
(function () {
  'use strict';

  var client, S, toast, esc, openRoom, openKoro;
  var cache = null, loading = null, people = null, asked = {}, wired = false, missing = false;
  var SAY = { NOT_SIGNED_IN: 'Sign in first.', NO_SUCH_HUB: 'That Koro is not open yet.', NO_ROOM: 'Finish making your room first.' };

  function say(err) {
    var m = (err && err.message) || '';
    for (var k in SAY) if (m.indexOf(k) !== -1) return SAY[k];
    return 'That did not go through. Try again in a moment.';
  }
  /** True when the database does not have the hub functions yet (migration not run). */
  function isMissing(err) {
    var code = String((err && err.code) || ''), m = String((err && err.message) || '');
    return code === 'PGRST202' || code === '42883' || code === '404' || /could not find the function|does not exist/i.test(m);
  }
  async function rpc(name, args) {
    var r = await client.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }
  function num(v) { var n = Number(v); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  function clean(list) {
    return (Array.isArray(list) ? list : []).filter(function (h) { return h && /^[a-z0-9-]{2,24}$/.test(String(h.slug || '')) && h.name; });
  }
  function joinedAny(list) { return (list || []).some(function (h) { return h.joined; }); }

  async function load(force) {
    if (missing) return null;
    if (cache && !force) return cache;
    if (loading) return loading;
    loading = rpc('bv_hubs').then(function (list) { cache = clean(list); return cache; })
      .catch(function (e) { if (isMissing(e)) missing = true; return null; })
      .then(function (v) { loading = null; return v; });
    return loading;
  }
  async function loadPeople(force) {
    if (people && !force) return people;
    try { var list = await rpc('bv_people_to_meet', { p_limit: 3 }); people = Array.isArray(list) ? list : []; }
    catch (_) { people = []; }
    return people;
  }

  /* ---------------------------------------------------------------- markup */
  function pill(h) {
    var n = num(h.members);
    return '<button type="button" class="hub-pill' + (h.joined ? ' on' : '') + '" data-hub="' + (h.joined ? 'open' : 'join') + '" data-slug="' + esc(h.slug) + '"' +
      (h.crew_id ? ' data-crew="' + num(h.crew_id) + '"' : '') + ' aria-label="' + esc((h.joined ? 'Open ' : 'Join ') + h.name + ' Koro') + '">' +
      '<span class="hub-emoji" aria-hidden="true">' + esc(h.emoji || '🪸') + '</span>' +
      '<span class="hub-name"><b>' + esc(h.name) + '</b><small>' + (h.joined ? 'You are in · open' : n ? n + (n === 1 ? ' member' : ' members') + ' · join' : 'Be the first · join') + '</small></span></button>';
  }
  function person(p) {
    var done = asked[p.id];
    return '<div class="hub-person"><button type="button" class="av hub-av" data-hub="room" data-handle="' + esc(p.handle) + '" style="background:' + esc(p.accent || '#4FA8D8') + '18" aria-label="Visit ' + esc(p.display_name || p.handle) + '\'s room">' + esc(p.avatar_emoji || '🌺') + '</button>' +
      '<span class="hub-who"><b>' + esc(p.display_name || p.handle) + '</b><small>@' + esc(p.handle) + (p.hub ? ' · ' + esc(p.hub) : num(p.posts) ? ' · on the wall this month' : '') + '</small></span>' +
      '<button type="button" class="btn sm' + (done ? ' ghost' : '') + '" data-hub="ask" data-id="' + esc(p.id) + '"' + (done ? ' disabled' : '') + '>' + (done ? 'Asked' : 'Ask to be friends') + '</button></div>';
  }
  function peopleBlock(list) {
    if (!list) return '';
    if (!list.length) return '<div class="hub-people"><p class="hub-first">You are among the first here. Bring one person with you and the wall wakes up.</p>' +
      '<button type="button" class="btn sm ghost" data-iv-quick="Home: Top Mates" data-sota-share data-share-text="Come and join me on Sota Kece. Make your space, share music and catch up over Talanoa.">Invite someone ↗</button></div>';
    return '<div class="hub-people"><h3>Say bula to</h3>' + list.map(person).join('') + '</div>';
  }
  function body(context, hubs, list) {
    var mates = context === 'mates';
    return '<header class="hub-head"><span class="hub-kicker">' + (mates ? 'TOP MATES START HERE' : 'FIND YOUR PEOPLE') + '</span>' +
      '<h2>Where are your people?</h2><p>One tap puts you in an open Koro. Your own Koro stay invite-only.</p></header>' +
      '<div class="hub-pills" role="group" aria-label="Starter Koro">' + hubs.map(pill).join('') + '</div>' +
      (typeof window !== 'undefined' && window.SotaHubMap ? '<button type="button" class="btn sm ghost hub-map-btn" data-hubmap>See them on the map</button>' : '') +
      peopleBlock(list);
  }
  function announce(h) { try { h.dispatchEvent(new CustomEvent('sota-hubs-ready', { bubbles: true })); } catch (_) {} }
  /** A placeholder the page can drop anywhere; fill() turns it into the card. */
  function html(context) {
    return '<section class="hub-card glass card" data-hubs="' + esc(context || 'wall') + '" aria-label="Find your people" hidden></section>';
  }
  async function fill(root) {
    var hosts = Array.prototype.slice.call((root || document).querySelectorAll('[data-hubs]'));
    if (!hosts.length || !S || !S.user) return false;
    var hubs = await load();
    if (!hubs || !hubs.length) {
      hosts.forEach(function (h) { h.dispatchEvent(new CustomEvent('sota-hubs-unavailable', { bubbles: true })); h.remove(); });
      return false;
    }
    // People are suggested from the start: a member who skips the pills still sees who to greet.
    var list = await loadPeople();
    hosts.forEach(function (h) { if (!h.isConnected) return; h.innerHTML = body(h.dataset.hubs, hubs, list); h.hidden = false; announce(h); });
    return true;
  }
  function repaint() {
    Array.prototype.slice.call(document.querySelectorAll('[data-hubs]')).forEach(function (h) {
      if (cache) { h.innerHTML = body(h.dataset.hubs, cache, people); h.hidden = false; announce(h); }
    });
  }

  /* ---------------------------------------------------------------- actions */
  async function join(slug, btn) {
    if (!S.user) return toast(SAY.NOT_SIGNED_IN);
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    try {
      var row = await rpc('bv_hub_join', { p_slug: slug });
      cache = (cache || []).map(function (h) { return h.slug === slug ? row : h; });
      await loadPeople(true);
      repaint();
      toast('You are in ' + row.name + '. Say bula.');
      var again = document.querySelector('[data-hubs] [data-slug="' + slug + '"]'); if (again) again.focus({ preventScroll: true });
    } catch (e) {
      btn.disabled = false; btn.removeAttribute('aria-busy'); toast(say(e));
    }
  }
  async function ask(id, btn) {
    if (!S.user || asked[id]) return;
    btn.disabled = true;
    try {
      var r = await client.from('bv_friendships').insert({ requester: S.user.id, addressee: id });
      // A second ask is refused by the database; either way the member has been asked.
      asked[id] = true; btn.textContent = 'Asked'; btn.classList.add('ghost');
      toast(r && r.error ? 'Already asked.' : 'Request sent.');
    } catch (_) { btn.disabled = false; toast('That did not go through. Try again in a moment.'); }
  }
  function wire() {
    if (wired || typeof document === 'undefined') return;
    wired = true;
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest && ev.target.closest('[data-hub]'); if (!t || !t.closest('[data-hubs]')) return;
      var act = t.dataset.hub;
      if (act === 'join') return join(t.dataset.slug, t);
      if (act === 'open') return openKoro && openKoro(num(t.dataset.crew));
      if (act === 'ask') return ask(t.dataset.id, t);
      if (act === 'room') return openRoom && openRoom(t.dataset.handle);
    });
  }
  function init(cfg) {
    client = cfg.client; S = cfg.state; toast = cfg.toast; esc = cfg.esc; openRoom = cfg.openRoom; openKoro = cfg.openKoro;
    wire();
  }
  /** Join from somewhere other than the card (the hub map). Same database call and cache as the pills. */
  async function joinHub(slug) {
    if (!S || !S.user) throw new Error('NOT_SIGNED_IN');
    try {
      var row = await rpc('bv_hub_join', { p_slug: slug });
      cache = (cache || []).map(function (h) { return h.slug === slug ? row : h; });
      repaint();
      toast('You are in ' + row.name + '. Say bula.');
      return row;
    } catch (e) { toast(say(e)); throw e; }
  }
  function openHub(crew) { if (openKoro) openKoro(num(crew)); }
  /** For the people bubbles: a longer list of people to greet (same database function, up to 12). */
  async function peopleToMeet(limit) {
    if (!S || !S.user) return [];
    try { var list = await rpc('bv_people_to_meet', { p_limit: Math.min(12, Math.max(1, num(limit) || 12)) }); return Array.isArray(list) ? list : []; }
    catch (_) { return []; }
  }
  /** Ask from outside the card. Same insert and messages as the card's button; resolves true once asked. */
  async function askFriend(id) {
    if (!S || !S.user || !id) return false;
    if (asked[id]) return true;
    try {
      var r = await client.from('bv_friendships').insert({ requester: S.user.id, addressee: id });
      asked[id] = true; toast(r && r.error ? 'Already asked.' : 'Request sent.');
      return true;
    } catch (_) { toast('That did not go through. Try again in a moment.'); return false; }
  }
  function hasAsked(id) { return !!asked[id]; }
  function visitRoom(handle) { if (openRoom && handle) openRoom(handle); }
  /** Sign-out or a change of member: forget everything. */
  function reset() { cache = null; loading = null; people = null; asked = {}; }

  var api = {
    init: init, html: html, fill: fill, reset: reset, load: load, joinHub: joinHub, openHub: openHub,
    peopleToMeet: peopleToMeet, askFriend: askFriend, hasAsked: hasAsked, visitRoom: visitRoom,
    // exposed for tests
    pill: pill, person: person, body: body, isMissing: isMissing, clean: clean, joinedAny: joinedAny,
    state: function () { return { cache: cache, people: people, missing: missing, asked: asked }; },
    _forget: function () { reset(); missing = false; }
  };
  if (typeof window !== 'undefined') window.SotaHubs = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
