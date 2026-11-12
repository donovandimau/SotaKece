// Sota Kece — report and block (12 Nov 2026).
// A "⋯" on every wall post that is not yours opens a small sheet: report the post (with a reason)
// or block the person. Blocked people's posts are hidden on this device straight away and on every
// later load. Server side: bv_report, bv_block, bv_unblock, bv_blocked
// (supabase/migrations/20261112130000_sota_safety_and_mates.sql).
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.SotaSafety) return;

  var REASONS = [
    ['spam', 'Spam or fake account'], ['scam', 'Scam or money trick'], ['bullying', 'Bullying or harassment'],
    ['hate', 'Hate against a group'], ['violence', 'Violence or threats'], ['sexual', 'Sexual content'],
    ['underage', 'Someone under 16'], ['other', 'Something else']
  ];
  var blocked = new Set(), loaded = false, sheet = null, lastFocus = null;

  function client() { return window.sb || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function note(msg) {
    var t = document.createElement('div'); t.className = 'sk-safe-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  async function rpc(name, args) {
    var c = client(); if (!c) throw new Error('offline');
    var r = await c.rpc(name, args || {}); if (r.error) throw r.error; return r.data;
  }

  async function load() {
    try {
      var list = await rpc('bv_blocked');
      blocked = new Set((list || []).map(function (b) { return b.id; }));
      loaded = true; hideBlocked();
    } catch (_) { /* not deployed yet, or signed out: nothing hidden */ }
    return blocked;
  }
  function isBlocked(id) { return !!id && blocked.has(id); }
  function hideBlocked(root) {
    if (!blocked.size) return;
    (root || document).querySelectorAll('.tw-post[data-author]').forEach(function (a) {
      if (blocked.has(a.getAttribute('data-author'))) a.remove();
    });
  }

  function close() {
    if (!sheet) return;
    sheet.remove(); sheet = null;
    document.removeEventListener('keydown', onKey, true);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (_) {}
  }
  function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }

  // target: { kind:'post'|'profile', id, author, handle }
  function open(target) {
    close();
    lastFocus = document.activeElement;
    var who = target.handle ? '@' + esc(target.handle) : 'this person';
    sheet = document.createElement('div');
    sheet.className = 'sk-safe-wrap';
    sheet.innerHTML =
      '<div class="sk-safe-back" data-safe="close"></div>' +
      '<div class="sk-safe-sheet glass" role="dialog" aria-modal="true" aria-labelledby="sk-safe-h">' +
        '<h3 id="sk-safe-h">' + (target.kind === 'post' ? 'This post' : 'This room') + '</h3>' +
        '<div class="sk-safe-step" data-step="menu">' +
          '<button type="button" class="sk-safe-row" data-safe="report">🚩 Report ' + (target.kind === 'post' ? 'this post' : who) + '</button>' +
          (target.author ? '<button type="button" class="sk-safe-row" data-safe="block">🚫 Block ' + who + '</button>' : '') +
          '<button type="button" class="sk-safe-row sk-safe-quiet" data-safe="close">Cancel</button>' +
        '</div>' +
        '<div class="sk-safe-step" data-step="report" hidden>' +
          '<p class="sub">What is wrong with it? Only the Sota Kece team sees reports. ' + who + ' is not told who reported.</p>' +
          '<div class="sk-safe-reasons">' + REASONS.map(function (r) {
            return '<button type="button" class="sk-safe-chip" data-reason="' + r[0] + '">' + esc(r[1]) + '</button>';
          }).join('') + '</div>' +
          '<label class="sub" for="sk-safe-note">Anything to add? (optional)</label>' +
          '<textarea id="sk-safe-note" maxlength="500" rows="2"></textarea>' +
          '<div class="sk-safe-actions"><button type="button" class="btn ghost sm" data-safe="close">Cancel</button>' +
          '<button type="button" class="btn sm" data-safe="send" disabled>Send report</button></div>' +
        '</div>' +
        '<div class="sk-safe-step" data-step="block" hidden>' +
          '<p>Block ' + who + '?</p>' +
          '<p class="sub">You will stop seeing their posts. You come off each other\'s Top Mates. They are not told.</p>' +
          '<div class="sk-safe-actions"><button type="button" class="btn ghost sm" data-safe="close">Cancel</button>' +
          '<button type="button" class="btn sm sk-safe-danger" data-safe="block-yes">Block</button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(sheet);
    document.addEventListener('keydown', onKey, true);
    var reason = null;
    function step(name) {
      sheet.querySelectorAll('.sk-safe-step').forEach(function (s) { s.hidden = s.dataset.step !== name; });
      var f = sheet.querySelector('.sk-safe-step[data-step="' + name + '"] button'); if (f) f.focus();
    }
    sheet.addEventListener('click', async function (e) {
      var chip = e.target.closest('[data-reason]');
      if (chip) {
        reason = chip.dataset.reason;
        sheet.querySelectorAll('[data-reason]').forEach(function (c) { c.classList.toggle('on', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
        sheet.querySelector('[data-safe="send"]').disabled = false; return;
      }
      var b = e.target.closest('[data-safe]'); if (!b) return;
      var act = b.dataset.safe;
      if (act === 'close') return close();
      if (act === 'report') return step('report');
      if (act === 'block') return step('block');
      if (act === 'send') {
        b.disabled = true;
        try {
          await rpc('bv_report', { p_kind: target.kind, p_id: String(target.id), p_reason: reason, p_note: sheet.querySelector('#sk-safe-note').value || null });
          close(); note('Thanks. We will look at it.');
        } catch (err) {
          b.disabled = false;
          note(/REPORT_LIMIT/.test(err && err.message) ? 'You have sent a lot of reports today. Try again tomorrow.' : 'That did not go through. Try again in a moment.');
        }
        return;
      }
      if (act === 'block-yes') {
        b.disabled = true;
        try {
          await rpc('bv_block', { p_member: target.author });
          blocked.add(target.author); hideBlocked(); close(); note('Blocked.');
          document.dispatchEvent(new CustomEvent('sota:blocked', { detail: { id: target.author } }));
        } catch (err) { b.disabled = false; note('That did not go through. Try again in a moment.'); }
      }
    });
    step('menu');
  }

  async function unblock(id) {
    await rpc('bv_unblock', { p_member: id }); blocked.delete(id);
  }

  window.SotaSafety = { open: open, load: load, isBlocked: isBlocked, hideBlocked: hideBlocked, unblock: unblock, REASONS: REASONS,
    get loaded() { return loaded; } };

  // Load the block list once a session exists, and keep the wall clean as posts arrive.
  function start() {
    var c = client();
    if (c && c.auth && typeof c.auth.onAuthStateChange === 'function') {
      c.auth.onAuthStateChange(function (ev, session) {
        if (session && session.user) load(); else { blocked = new Set(); loaded = false; }
      });
    }
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function () { if (blocked.size) hideBlocked(); })
        .observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
