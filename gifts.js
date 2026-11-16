/* Sota Kece — free gifts.
   Friends send each other gifts that sit on their room. Three a day, like Uro.
   No money involved: nothing is bought, nothing can be cashed out.
   Mounts itself under #room-head whenever a room is drawn. */
(function () {
  'use strict';

  var GIFTS = [
    { key: 'bilo',      icon: '🥣', name: 'Bilo of grog', line: 'A bowl poured for you.' },
    { key: 'salusalu',  icon: '🌺', name: 'Salusalu',     line: 'A garland, with respect.' },
    { key: 'lovo',      icon: '🍲', name: 'Lovo',         line: 'Come eat, the lovo is up.' },
    { key: 'bua',       icon: '🌸', name: 'Bua',          line: 'A frangipani for you.' },
    { key: 'niu',       icon: '🥥', name: 'Niu',          line: 'A cold coconut on a hot day.' },
    { key: 'drua',      icon: '⛵', name: 'Drua',         line: 'Safe travels, wherever you are.' },
    { key: 'rugby',     icon: '🏉', name: 'Great try',    line: 'Over the line. Well done.' },
    { key: 'sigidrigi', icon: '🎸', name: 'Sigidrigi',    line: 'A song for you tonight.' }
  ];
  var BY_KEY = {};
  GIFTS.forEach(function (g) { BY_KEY[g.key] = g; });

  var SAY = {
    OUT_OF_GIFTS: 'You have sent your three gifts for today. More tomorrow.',
    NOT_FRIENDS: 'Gifts are for friends. Ask to be friends first.',
    SELF_GIFT: 'That is your own room.',
    NOT_SIGNED_IN: 'Sign in to send a gift.'
  };

  var client = null, toast = function () {}, app = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ago(t) {
    var s = Math.max(1, Math.round((Date.now() - new Date(t).getTime()) / 1000));
    if (s < 60) return 'just now';
    var m = Math.round(s / 60); if (m < 60) return m + 'm ago';
    var h = Math.round(m / 60); if (h < 24) return h + 'h ago';
    var d = Math.round(h / 24); return d + 'd ago';
  }
  function errorText(err) {
    var msg = (err && err.message) || '';
    for (var k in SAY) if (msg.indexOf(k) !== -1) return SAY[k];
    return 'That gift did not go. Try again in a moment.';
  }

  function draw(card, owner, d) {
    if (!d || !d.visible) { card.remove(); return; }
    var counts = d.counts || {};
    var shelf = GIFTS.filter(function (g) { return counts[g.key] > 0; }).map(function (g) {
      return '<span class="skg-count" title="' + esc(g.name) + '">' + g.icon + ' <b>' + counts[g.key] + '</b></span>';
    }).join('');

    var recent = (d.recent || []).map(function (r) {
      var g = BY_KEY[r.gift] || { icon: '🎁', name: 'Gift' };
      return '<div class="skg-item" data-id="' + esc(r.id) + '">' +
        '<span class="skg-icon">' + g.icon + '</span>' +
        '<div class="skg-body"><div><b>@' + esc(r.handle) + '</b> sent ' + esc(g.name) +
        ' <span class="ago">' + ago(r.created_at) + '</span></div>' +
        (r.note ? '<div class="skg-note">' + esc(r.note) + '</div>' : '') + '</div>' +
        (d.is_me ? '<button type="button" class="skg-hide" data-hide="' + esc(r.id) + '" aria-label="Hide this gift">✕</button>' : '') +
        '</div>';
    }).join('');

    var picker = '';
    if (d.can_send) {
      picker = d.left > 0
        ? '<div class="skg-pick" role="group" aria-label="Choose a gift">' +
            GIFTS.map(function (g) {
              return '<button type="button" class="skg-gift" data-gift="' + g.key + '" aria-pressed="false">' +
                '<span>' + g.icon + '</span><small>' + esc(g.name) + '</small></button>';
            }).join('') + '</div>' +
          '<div class="row skg-send"><input class="skg-input" maxlength="80" aria-label="Add a short note (optional)" placeholder="Add a short note (optional)">' +
          '<button type="button" class="btn sm skg-go" disabled>Send</button></div>' +
          '<div class="sub skg-left">' + d.left + ' of 3 gifts left today</div>'
        : '<div class="sub skg-left">You have sent your three gifts for today. More tomorrow.</div>';
    }

    card.innerHTML =
      '<h3>Gifts</h3>' +
      '<div class="sub" style="margin-bottom:10px">' +
        (d.is_me ? 'Gifts your friends have left you.' : 'Leave them something. Three a day, so each one means something.') +
      '</div>' +
      (shelf ? '<div class="skg-shelf">' + shelf + '</div>' : '') +
      picker +
      (recent ? '<div class="skg-list">' + recent + '</div>'
              : '<div class="empty"><em>🎁</em>' + (d.is_me ? 'No gifts yet.' : 'No gifts yet. Pick one above to leave them something.') + '</div>');

    var chosen = null;
    var goBtn = card.querySelector('.skg-go');
    card.querySelectorAll('.skg-gift').forEach(function (b) {
      b.addEventListener('click', function () {
        chosen = b.getAttribute('data-gift');
        card.querySelectorAll('.skg-gift').forEach(function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        if (goBtn) { goBtn.disabled = false; goBtn.textContent = 'Send ' + BY_KEY[chosen].name; }
      });
    });
    if (goBtn) goBtn.addEventListener('click', function () {
      if (!chosen || goBtn.disabled) return;
      goBtn.disabled = true;
      var note = (card.querySelector('.skg-input') || {}).value || '';
      var g = BY_KEY[chosen];
      client.rpc('bv_gift_send', { p_to: owner, p_gift: chosen, p_note: note }).then(function (res) {
        if (res.error) { toast(errorText(res.error)); goBtn.disabled = false; return; }
        toast(g.icon + ' ' + g.line);
        load(card, owner);
      }, function () { toast(errorText(null)); goBtn.disabled = false; });
    });
    card.querySelectorAll('.skg-hide').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true;
        client.rpc('bv_gift_hide', { p_id: Number(b.getAttribute('data-hide')) }).then(function (res) {
          if (res.error) { b.disabled = false; toast('Could not hide that one. Try again.'); return; }
          load(card, owner);
        });
      });
    });
  }

  function load(card, owner) {
    return client.rpc('bv_gifts_for', { p_owner: owner }).then(function (res) {
      if (res.error) {
        card.innerHTML = '<h3>Gifts</h3><div class="sub">Gifts did not load. Pull the page again in a moment.</div>';
        return;
      }
      draw(card, owner, res.data);
    }, function () {
      card.innerHTML = '<h3>Gifts</h3><div class="sub">Gifts did not load. Pull the page again in a moment.</div>';
    });
  }

  function mount() {
    if (!client || !app) return;
    var head = app.querySelector('#room-head[data-owner]:not([data-gifts])');
    if (!head) return;
    head.setAttribute('data-gifts', '1');
    var card = document.createElement('div');
    card.className = 'glass card skg-card';
    card.innerHTML = '<h3>Gifts</h3><div class="sub">Opening gifts…</div>';
    head.insertAdjacentElement('afterend', card);
    load(card, head.getAttribute('data-owner'));
  }

  function addStyles() {
    if (document.getElementById('skg-styles')) return;
    var l = document.createElement('link');
    l.id = 'skg-styles'; l.rel = 'stylesheet'; l.href = '/gifts.css?v=20261030-gifts-1';
    document.head.appendChild(l);
  }

  window.SotaGifts = {
    gifts: GIFTS,
    init: function (o) {
      client = o && o.client; app = (o && o.app) || document.getElementById('app');
      if (o && typeof o.toast === 'function') toast = o.toast;
      if (!client || !app) return;
      addStyles();
      new MutationObserver(mount).observe(app, { childList: true, subtree: true });
      mount();
    }
  };
})();
