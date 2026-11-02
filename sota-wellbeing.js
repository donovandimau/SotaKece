/* Sota Kece — connection over scrolling (Nov 2026).
   Rewards real connection, never time on the app:
   - "You're all caught up" at the end of Moments, with how many are new since your last visit,
     so the feed has an end and nobody scrolls looking for more.
   - "Say bula": up to two friends whose room you have not visited in three weeks, oldest first.
     "Not now" hides one for two weeks. Nothing is sent anywhere; visits are remembered on this
     device only (sk.well.v1).
   - After 25 minutes in one sitting, one gentle note a day suggesting a break or a call.
   No streaks, no badges for activity, no counts of time spent. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SotaWell = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';
  const KEY = 'sk.well.v1', DAY = 864e5, AWAY_DAYS = 21, SNOOZE_DAYS = 14, BREAK_MIN = 25;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** How many moments are newer than the last one seen. moments: newest first, each {id}. */
  function newSince(moments, lastSeenId) {
    const list = (moments || []).filter((m) => m && Number.isFinite(Number(m.id)));
    if (!list.length) return { count: 0, newest: lastSeenId || null };
    const newest = Math.max(...list.map((m) => Number(m.id)));
    if (lastSeenId == null) return { count: 0, newest };
    return { count: list.filter((m) => Number(m.id) > Number(lastSeenId)).length, newest };
  }

  /** Friends to say bula to: not visited for AWAY_DAYS (or never), not snoozed, oldest visit first. */
  function reachOut(friends, visits, snoozed, now, max = 2) {
    const v = visits || {}, z = snoozed || {};
    return (friends || []).filter((f) => f && f.handle)
      .filter((f) => !(z[f.handle] && now - z[f.handle] < SNOOZE_DAYS * DAY))
      .map((f) => ({ f, last: v[f.handle] || 0 }))
      .filter((x) => now - x.last >= AWAY_DAYS * DAY)
      .sort((a, b) => a.last - b.last)
      .slice(0, max)
      .map((x) => ({ handle: x.f.handle, name: x.f.display_name || x.f.handle, avatar: x.f.avatar_emoji || '🌺', never: !x.last, days: x.last ? Math.floor((now - x.last) / DAY) : null }));
  }

  /** Whether to show the break note: BREAK_MIN in one sitting, at most once per day. */
  function breakDue(startedAt, lastShownDay, now) {
    const today = new Date(now).toISOString().slice(0, 10);
    return now - startedAt >= BREAK_MIN * 60e3 && lastShownDay !== today;
  }

  const api = { newSince, reachOut, breakDue, AWAY_DAYS, SNOOZE_DAYS, BREAK_MIN };
  if (typeof document === 'undefined') return api;

  /* ---------------- page side ---------------- */
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };

  api.feedEnd = function (moments) {
    const s = load(); const r = newSince(moments, s.lastSeen);
    if (r.newest != null) { s.lastSeen = r.newest; save(s); }
    if (!(moments || []).length) return '';
    return `<div class="glass card sk-caught" role="status"><em aria-hidden="true">🌅</em><b>You're all caught up</b>
      <span>${r.count ? `${r.count} new since your last visit. ` : ''}That is everything from your friends. Nothing else is waiting for you — go and enjoy your day.</span></div>`;
  };
  api.reachOut = function (friends) {
    const s = load(); const list = reachOut(friends, s.visits, s.snoozed, Date.now());
    if (!list.length) return '';
    return `<div class="glass card sk-reach"><h3>Say bula</h3><div class="sub">Mates you have not visited in a while.</div>
      ${list.map((p) => `<div class="sk-reach-row"><span class="av" aria-hidden="true">${esc(p.avatar)}</span><span class="sk-reach-name"><b>${esc(p.name)}</b><small>${p.never ? 'Not visited yet' : `${p.days} days since you visited`}</small></span>
      <button type="button" class="btn sm" data-sk-visit="${esc(p.handle)}">Visit</button><button type="button" class="btn sm ghost" data-sk-snooze="${esc(p.handle)}" aria-label="Not now for ${esc(p.name)}">Not now</button></div>`).join('')}</div>`;
  };
  api.visited = function (handle) { if (!handle) return; const s = load(); s.visits = s.visits || {}; s.visits[handle] = Date.now(); save(s); };

  document.addEventListener('click', function (e) {
    const v = e.target.closest && e.target.closest('[data-sk-visit]');
    if (v && typeof root.openRoom === 'function') { root.openRoom(v.dataset.skVisit); return; }
    const z = e.target.closest && e.target.closest('[data-sk-snooze]');
    if (z) { const s = load(); s.snoozed = s.snoozed || {}; s.snoozed[z.dataset.skSnooze] = Date.now(); save(s); const row = z.closest('.sk-reach-row'); if (row) row.remove(); }
  });

  const started = Date.now();
  setInterval(function () {
    if (document.hidden) return;
    const s = load();
    if (!breakDue(started, s.breakDay, Date.now())) return;
    s.breakDay = new Date().toISOString().slice(0, 10); save(s);
    const n = document.createElement('div'); n.className = 'sk-break'; n.setAttribute('role', 'status');
    n.innerHTML = '<span>You have been here a while. Maybe call a mate, or step outside — your place is kept.</span><button type="button" class="btn sm ghost" aria-label="Close">OK</button>';
    n.querySelector('button').onclick = () => n.remove(); document.body.appendChild(n);
  }, 60e3);
  return api;
});
