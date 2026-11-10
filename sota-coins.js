/* Sota Kece — coins, tipping and payouts.
   Coins ride on the FJD wallet: buy a pack from the wallet, tip coins on wall posts, move earned
   coins back into the wallet. Shown only while window.SOTA_WALLET_ON is true, the same switch that
   hides the wallet until the Reserve Bank of Fiji approves it; buying and payouts are also switched
   in the database (bv_coins().buy_on / payout_on). Every movement is one bv_coin* call; the rules
   live in supabase/migrations/20261110200000_sota_coins.sql. */
(function () {
  'use strict';

  var PRESETS = [5, 10, 25, 50];
  var SAY = {
    NOT_SIGNED_IN: 'Sign in first.', TIPS_OFF: 'Tipping is switched off right now.', BAD_AMOUNT: 'Pick between 1 and 500 coins.',
    GONE: 'That post is gone.', SELF_TIP: 'You cannot tip your own post.', DAILY_CAP: 'That is your coin limit for today.',
    NOT_ENOUGH_COINS: 'Not enough coins. Get some first.', COINS_BUY_OFF: 'Buying coins opens together with the wallet.',
    NO_SUCH_BUNDLE: 'That pack is not for sale.', NO_WALLET: 'Your wallet is not open yet.', INSUFFICIENT_FUNDS: 'Not enough in your wallet.',
    DAILY_LIMIT_EXCEEDED: 'That is over your wallet limit for today.', PAYOUT_OFF: 'Moving coins to your wallet opens together with the wallet.',
    BELOW_MINIMUM: 'Earn a few more coins first.', NOT_ENOUGH_EARNED: 'You have not earned that many coins yet.',
    WALLET_FROZEN: 'Your wallet is frozen.', WALLET_CLOSED: 'Your wallet is closed.', WALLET_DORMANT: 'Add money first to wake your wallet up.'
  };

  var client, S, toast, esc, fjd, go, ago;
  var st = { data: null, wired: false };

  function say(err, fallback) {
    var m = (err && err.message) || '';
    for (var k in SAY) if (m.indexOf(k) !== -1) return SAY[k];
    return fallback || 'That did not go through. Try again in a moment.';
  }
  async function rpc(name, args) {
    var r = await client.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function num(v) { var n = Number(v); return Number.isSafeInteger(n) && n >= 0 ? n : 0; }
  function on() { return !!(typeof window !== 'undefined' && window.SOTA_WALLET_ON && S && S.user); }
  function money(coins, d) { d = d || st.data; return d && fjd ? fjd(num(coins) * num(d.coin_sene), 'FJD') : ''; }
  function plural(n, one, many) { return n === 1 ? one : many; }

  async function load(force) {
    if (!on()) return null;
    if (st.data && !force) return st.data;
    st.data = await rpc('bv_coins');
    return st.data;
  }

  /* ---------------------------------------------------------------- tip sheet (inline, under the post) */
  function sheet(postId, d) {
    var balance = num(d && d.balance), can = balance > 0;
    return '<div class="sk-coin-sheet" role="dialog" aria-label="Tip coins" data-coin-sheet="' + postId + '">' +
      '<div class="sk-coin-top"><b>Tip coins</b><span class="sub">You have ' + balance + ' ' + plural(balance, 'coin', 'coins') + (balance ? ' (' + esc(money(balance, d)) + ')' : '') + '</span></div>' +
      (can
        ? '<div class="sk-coin-presets" role="group" aria-label="How many coins">' +
            PRESETS.map(function (n) { return '<button type="button" class="sk-coin-pick' + (n === PRESETS[0] ? ' on' : '') + '" data-coin-pick="' + n + '"' + (n > balance ? ' disabled' : '') + '>🪙 ' + n + '</button>'; }).join('') +
            '<input class="sk-coin-custom" type="number" inputmode="numeric" min="1" max="' + Math.min(balance, num(d.max_tip) || 500) + '" placeholder="other" aria-label="Another amount">' +
          '</div>' +
          '<input class="sk-coin-note" maxlength="60" placeholder="say why (optional)" aria-label="A note with your tip">' +
          '<div class="sk-coin-row"><button type="button" class="btn sm" data-coin-send="' + postId + '">Send 5 coins</button>' +
            '<button type="button" class="btn sm ghost" data-coin-close>Not now</button></div>'
        : '<p class="sub">No coins yet. ' + (d && d.buy_on ? 'Get a pack from your wallet.' : 'Coin packs open together with the wallet.') + '</p>' +
          '<div class="sk-coin-row">' + (d && d.buy_on ? '<button type="button" class="btn sm" data-coin-shop>Get coins</button>' : '') +
            '<button type="button" class="btn sm ghost" data-coin-close>Not now</button></div>') +
    '</div>';
  }
  function chosen(box) {
    var custom = $('.sk-coin-custom', box), n = custom && custom.value ? Math.floor(Number(custom.value)) : 0;
    if (!n) { var pick = $('.sk-coin-pick.on', box); n = pick ? Number(pick.dataset.coinPick) : 0; }
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  }
  function paintSend(box) {
    var n = chosen(box), b = $('[data-coin-send]', box);
    if (b) { b.textContent = n ? 'Send ' + n + ' ' + plural(n, 'coin', 'coins') : 'Pick an amount'; b.disabled = !n; }
  }
  async function tip(postId, btn) {
    if (!on()) return toast('Coins open together with the wallet.');
    closeSheets();
    var bar = btn && btn.closest ? btn.closest('.tw-bar') : null; if (!bar) return;
    var d; try { d = await load(); } catch (e) { return toast(say(e)); }
    bar.insertAdjacentHTML('afterend', sheet(postId, d));
    var box = bar.nextElementSibling; paintSend(box);
    var first = $('.sk-coin-pick:not([disabled])', box) || $('[data-coin-close]', box); if (first) first.focus();
  }
  function closeSheets() { $$('.sk-coin-sheet').forEach(function (el) { el.remove(); }); }
  async function send(postId, box) {
    var n = chosen(box); if (!n) return;
    var note = ($('.sk-coin-note', box) || {}).value || '', b = $('[data-coin-send]', box);
    b.disabled = true;
    try {
      var r = await rpc('bv_coin_tip', { p_post: Number(postId), p_coins: n, p_note: note.trim() || null });
      if (st.data) { st.data.balance = num(r.balance); st.data.tipped_today = num(r.tipped_today); }
      $$('.tw-post[data-id="' + postId + '"] [data-count="coin"]').forEach(function (c) { c.textContent = num(r.tip_coins) || ''; });
      $$('.tw-post[data-id="' + postId + '"] [data-tw="coin"]').forEach(function (c) { c.classList.add('on'); c.setAttribute('aria-label', 'Tip coins, ' + num(r.tip_coins)); });
      box.remove();
      toast('Sent ' + n + ' ' + plural(n, 'coin', 'coins') + '. ' + num(r.balance) + ' left.');
    } catch (e) { b.disabled = false; toast(say(e)); }
  }

  /* ---------------------------------------------------------------- wallet cards (coins, packs, earnings) */
  function walletCards(d) {
    if (!on() || !d) return '';
    var balance = num(d.balance), earned = num(d.earned), minOut = num(d.payout_min) || 100;
    return '<div class="glass card sk-coins" data-coins-card>' +
      '<h3>Your coins</h3>' +
      '<div class="sk-coins-big">🪙 ' + balance + '</div>' +
      '<div class="sub">' + (balance ? 'Worth ' + esc(money(balance, d)) + '. ' : '') + 'Tip them on the Talanoa Wall. ' + num(d.tipped_today) + ' given today of ' + num(d.daily_cap) + '.</div>' +
      (d.buy_on
        ? '<div class="sk-coins-packs">' + (d.bundles || []).map(function (b) {
            return '<button type="button" class="sk-pack" data-coin-buy="' + esc(b.id) + '"><b>🪙 ' + num(b.coins) + (num(b.bonus) ? ' <i>+' + num(b.bonus) + ' free</i>' : '') + '</b><span>' + esc(fjd(num(b.price_minor), 'FJD')) + ' from your wallet</span></button>';
          }).join('') + '</div>'
        : '<p class="sub sk-coins-soon">Coin packs open together with the wallet.</p>') +
    '</div>' +
    '<div class="glass card sk-coins" data-coins-earned>' +
      '<h3>Earned on the wall</h3>' +
      '<div class="sk-coins-big">🪙 ' + earned + '</div>' +
      '<div class="sub">' + (earned ? 'Worth ' + esc(money(earned, d)) + ' in your wallet. ' : 'Coins people tip on your posts land here. ') +
        'Sota Kece keeps ' + (num(d.fee_bps) / 100) + '% of each tip.</div>' +
      (d.payout_on
        ? '<div class="sk-coin-row"><button type="button" class="btn sm" data-coin-payout="' + earned + '"' + (earned < minOut ? ' disabled' : '') + '>Move ' + earned + ' coins to my wallet</button>' +
          (earned < minOut ? '<span class="sub">From ' + minOut + ' coins.</span>' : '') + '</div>'
        : '<p class="sub sk-coins-soon">Moving coins to your wallet opens together with the wallet.</p>') +
      (d.ledger && d.ledger.length ? '<div class="sk-coins-ledger">' + d.ledger.slice(0, 8).map(line).join('') + '</div>' : '') +
    '</div>';
  }
  function line(l) {
    var words = { buy: 'Pack', tip_out: 'Tipped' + (l.other ? ' @' + l.other : ''), tip_in: 'Tip' + (l.other ? ' from @' + l.other : ''), payout: 'To wallet', adjust: 'Adjustment', fee: 'Fee' }[l.kind] || l.kind;
    return '<div class="sk-coins-line"><span>' + esc(words) + (l.memo && l.kind !== 'buy' ? ' <i>“' + esc(l.memo) + '”</i>' : '') + '</span><b>' + (l.delta > 0 ? '+' : '') + num(Math.abs(l.delta)) * (l.delta < 0 ? -1 : 1) + '</b><small>' + esc(ago ? ago(l.created_at) : '') + '</small></div>';
  }
  async function buy(bundle, btn) {
    btn.disabled = true;
    try {
      var r = await rpc('bv_coins_buy', { p_bundle: bundle, p_idem: (S.user && S.user.id) + ':' + bundle + ':' + Date.now() });
      toast(r.status === 'already_done' ? 'Already added.' : 'Added ' + num(r.coins) + ' coins.');
      await repaint();
    } catch (e) { btn.disabled = false; toast(say(e)); }
  }
  async function payout(coins, btn) {
    btn.disabled = true;
    try {
      var r = await rpc('bv_coins_payout', { p_coins: Number(coins) });
      toast('Moved ' + num(r.coins) + ' coins to your wallet: ' + fjd(num(r.minor), 'FJD') + '.');
      await repaint();
    } catch (e) { btn.disabled = false; toast(say(e)); }
  }
  async function repaint() {
    var d = await load(true);
    var cards = $$('[data-coins-card],[data-coins-earned]'); if (!cards.length) return;
    cards[0].insertAdjacentHTML('beforebegin', walletCards(d));
    cards.forEach(function (c) { c.remove(); });
    if (go) go('wallet', { history: false });
  }

  /* ---------------------------------------------------------------- events (one delegated listener on #app) */
  function wire() {
    if (st.wired || typeof document === 'undefined') return;
    st.wired = true;
    var app = document.getElementById('app') || document.body;
    app.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-coin-pick],[data-coin-send],[data-coin-close],[data-coin-shop],[data-coin-buy],[data-coin-payout]');
      if (!t) return;
      var box = t.closest('.sk-coin-sheet');
      if (t.hasAttribute('data-coin-pick')) { $$('.sk-coin-pick', box).forEach(function (b) { b.classList.toggle('on', b === t); }); var c = $('.sk-coin-custom', box); if (c) c.value = ''; return paintSend(box); }
      if (t.hasAttribute('data-coin-send')) return send(t.dataset.coinSend, box);
      if (t.hasAttribute('data-coin-close')) return box && box.remove();
      if (t.hasAttribute('data-coin-shop')) { closeSheets(); return go && go('wallet'); }
      if (t.hasAttribute('data-coin-buy')) return buy(t.dataset.coinBuy, t);
      if (t.hasAttribute('data-coin-payout')) return payout(t.dataset.coinPayout, t);
    });
    app.addEventListener('input', function (ev) {
      if (!ev.target.matches('.sk-coin-custom')) return;
      var box = ev.target.closest('.sk-coin-sheet'); $$('.sk-coin-pick', box).forEach(function (b) { b.classList.remove('on'); }); paintSend(box);
    });
  }

  function init(cfg) {
    client = cfg.client; S = cfg.state; toast = cfg.toast; esc = cfg.esc; fjd = cfg.fjd; go = cfg.go || null; ago = cfg.ago || null;
    wire();
  }
  function reset() { st.data = null; }

  window.SotaCoins = {
    init: init, load: load, tip: tip, walletCards: walletCards, reset: reset, on: on,
    // exposed for tests
    sheet: sheet, line: line, say: say, PRESETS: PRESETS, state: function () { return st; }
  };
})();
