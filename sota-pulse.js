/* Sota Kece — the Talanoa Wall.
   One feed for every member: short posts (280), quote, reply, like, repost, share.
   New posts arrive live through Supabase Realtime and wait behind a "N new" pill, so the
   list never jumps under a thumb. Pages load ahead of the scroll; Latest is pure recency,
   Hot is a velocity ranking frozen at the moment the wall opened so pages stay stable.
   Every read and write goes through bv_talanoa_* in
   supabase/migrations/20261109000000_sota_talanoa_wall.sql; the rules live in the database. */
(function () {
  'use strict';

  var MAX = 280, PAGE = 20, PREFETCH_PX = 900, DEFAULT_MODE = 'latest', CHANNEL = 'talanoa-wall';
  var SAY = {
    NOT_SIGNED_IN: 'Sign in first.', EMPTY: 'Write something first.', TOO_LONG: 'Keep it under 280 characters.',
    GONE: 'That post is gone.', NOT_YOURS: 'That is not yours to remove.'
  };

  var client, S, toast, esc, ago, openRoom, shell, spark;
  var st = fresh(), wired = false;

  function fresh() {
    return { mode: DEFAULT_MODE, asOf: null, posts: [], offset: 0, done: false, loading: false,
             pending: 0, newest: null, thread: null, quote: null, channel: null, io: null, seq: 0, sparkHtml: null };
  }
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
  function rich(text) {
    return esc(text || '')
      .replace(/(^|[\s(])@([a-z0-9_]{2,32})/gi, function (_, pre, h) {
        return pre + '<button type="button" class="tw-mention" data-tw="room" data-handle="' + esc(h) + '">@' + esc(h) + '</button>';
      })
      .replace(/\n/g, '<br>');
  }
  function newest(posts) {
    var m = null;
    posts.forEach(function (p) { if (!m || new Date(p.created_at) > new Date(m)) m = p.created_at; });
    return m;
  }
  /** Prepend fresh posts, never duplicating one that is already on the wall. */
  function merge(fresh, current) {
    var seen = {}, out = [];
    current.forEach(function (p) { seen[p.id] = true; });
    fresh.forEach(function (p) { if (!seen[p.id]) { seen[p.id] = true; out.push(p); } });
    return out.concat(current);
  }
  function pillText(n) { return n === 1 ? '1 new post' : n + ' new posts'; }
  function shareUrl(id) { return location.origin + location.pathname + '#talanoa=' + id; }

  /* ---------------------------------------------------------------- markup */
  function avatar(p) {
    return '<button type="button" class="av tw-av" data-tw="room" data-handle="' + esc(p.handle) + '" style="background:' + esc(p.accent || '#4FA8D8') + '18" aria-label="Visit ' + esc(p.display_name || p.handle) + '\'s room">' + esc(p.avatar_emoji || '🌺') + '</button>';
  }
  function quoteBox(q) {
    if (!q) return '';
    return '<div class="tw-quote" data-tw="open" data-id="' + q.id + '" role="link" tabindex="0">' +
      '<div class="tw-head"><span>' + esc(q.avatar_emoji || '🌺') + '</span><span class="name">' + esc(q.display_name || q.handle) + '</span><span class="tw-handle">@' + esc(q.handle) + '</span><span class="spacer"></span><span class="ago">' + ago(q.created_at) + '</span></div>' +
      '<div class="tw-quote-body">' + rich(q.body) + '</div></div>';
  }
  /** The singing photo on a post (see sere-maker.js). Poster first; the video only loads on tap. */
  function sereBox(sr) {
    if (!sr || !sr.video) return '';
    return '<div class="tw-sere" data-scene="' + esc(sr.scene || 'none') + '">' +
      '<div class="tw-sere-meta"><span>🎤 Sere</span>' + (sr.seconds ? '<span>' + num(sr.seconds) + 's</span>' : '') + (sr.remix_of ? '<span>🔁 remix</span>' : '') + '</div>' +
      '<video data-sere="' + esc(sr.id) + '" controls playsinline preload="none"' + (sr.poster ? ' poster="' + esc(sr.poster) + '"' : '') + ' src="' + esc(sr.video) + '"></video></div>';
  }
  function card(p, opts) {
    opts = opts || {};
    var likes = num(p.like_count), reposts = num(p.repost_count), replies = num(p.reply_count), sr = p.sere || null;
    return '<article class="tw-post' + (opts.expanded ? ' tw-expanded' : '') + (opts.reply ? ' tw-reply' : '') + '" data-id="' + p.id + '" data-author="' + esc(p.author) + '">' +
      avatar(p) +
      '<div class="tw-main">' +
        '<div class="tw-head"><span class="name">' + esc(p.display_name || p.handle) + '</span><span class="tw-handle">@' + esc(p.handle) + '</span><span class="spacer"></span>' +
          '<time class="ago" datetime="' + esc(p.created_at) + '">' + ago(p.created_at) + '</time></div>' +
        '<div class="tw-body"' + (opts.expanded ? '' : ' data-tw="open" data-id="' + p.id + '"') + '>' + rich(p.body) + '</div>' +
        quoteBox(p.quote) +
        sereBox(sr) +
        '<div class="tw-bar">' +
          '<button type="button" class="tw-btn" data-tw="reply" data-id="' + p.id + '" aria-label="Reply, ' + replies + '">💬<b data-count="reply">' + (replies || '') + '</b></button>' +
          '<button type="button" class="tw-btn tw-repost' + (p.i_reposted ? ' on' : '') + '" data-tw="repost" data-id="' + p.id + '" aria-pressed="' + (p.i_reposted ? 'true' : 'false') + '" aria-label="Repost, ' + reposts + '">🔁<b data-count="repost">' + (reposts || '') + '</b></button>' +
          '<button type="button" class="tw-btn tw-like' + (p.i_liked ? ' on' : '') + '" data-tw="like" data-id="' + p.id + '" aria-pressed="' + (p.i_liked ? 'true' : 'false') + '" aria-label="Like, ' + likes + '">' + (p.i_liked ? '♥' : '♡') + '<b data-count="like">' + (likes || '') + '</b></button>' +
          '<button type="button" class="tw-btn" data-tw="quote" data-id="' + p.id + '" aria-label="Quote">❝</button>' +
          '<button type="button" class="tw-btn" data-tw="share" data-id="' + p.id + '" aria-label="Share">↗</button>' +
          (sr && !p.mine ? '<button type="button" class="tw-btn" data-tw="tip" data-id="' + esc(sr.id) + '" aria-label="Tip the maker, ' + num(sr.tips) + '">🎁<b>' + (num(sr.tips) || '') + '</b></button>' : '') +
          (sr ? '<button type="button" class="tw-btn" data-tw="remix" data-id="' + esc(sr.id) + '" aria-label="Remix this sound with your photo">🎤</button>' : '') +
          (p.mine ? '<button type="button" class="tw-btn tw-del" data-tw="del" data-id="' + p.id + '" aria-label="Remove your post">✕</button>' : '') +
        '</div>' +
      '</div></article>';
  }
  function composer(opts) {
    opts = opts || {};
    var me = S.me || {};
    return '<form class="tw-compose glass card" data-tw-form="' + (opts.replyTo ? 'reply' : 'post') + '"' + (opts.replyTo ? ' data-reply-to="' + opts.replyTo + '"' : '') + '>' +
      '<div class="tw-compose-row">' +
        '<div class="av" style="background:' + esc(me.room_accent || '#4FA8D8') + '18" aria-hidden="true">' + esc(me.avatar_emoji || '🌺') + '</div>' +
        '<textarea name="body" maxlength="' + MAX + '" rows="2" aria-label="' + (opts.replyTo ? 'Your reply' : 'Say it to everyone') + '" placeholder="' + (opts.replyTo ? 'Reply…' : 'What\'s happening, ' + esc(me.display_name || me.handle || 'you') + '?') + '"></textarea>' +
      '</div>' +
      (st.quote && !opts.replyTo ? '<div class="tw-quoting">' + quoteBox(st.quote) + '<button type="button" class="tw-btn tw-unquote" data-tw="unquote" aria-label="Remove the quote">✕</button></div>' : '') +
      '<div class="tw-compose-bar">' + (opts.replyTo || !window.SotaSere ? '' : '<button type="button" class="tw-btn tw-sere-open" data-tw="sere" aria-label="Make a photo sing">🎤 Make a singing photo</button>') +
        '<span class="tw-count" aria-live="polite">' + MAX + ' letters left</span><span class="spacer"></span>' +
        '<button type="submit" class="btn sm" disabled>' + (opts.replyTo ? 'Reply' : 'Post') + '</button></div>' +
    '</form>';
  }
  function tabs() {
    return '<div class="tw-tabs" role="tablist" aria-label="Order">' +
      '<button type="button" role="tab" data-tw="mode" data-mode="latest" aria-selected="' + (st.mode === 'latest') + '">Latest</button>' +
      '<button type="button" role="tab" data-tw="mode" data-mode="hot" aria-selected="' + (st.mode === 'hot') + '">Hot</button></div>';
  }
  function pill() {
    return '<button type="button" class="tw-pill" data-tw="new" hidden aria-live="polite">' + pillText(st.pending) + '</button>';
  }
  function list(posts) {
    if (!posts.length) return '<div class="tw-empty"><img src="/assets/feature-scenes/pulse-cafe-20261105-880.webp" alt="" loading="lazy" decoding="async"><p>Quiet in here. Say the first thing.</p></div>';
    return posts.map(function (p) { return card(p); }).join('');
  }
  function endMark() {
    return st.done
      ? (st.posts.length ? '<div class="tw-end">That is everything on the wall right now.</div>' : '')
      : '<div class="tw-sentinel" aria-hidden="true"></div><div class="tw-loading" role="status">' + (st.loading ? 'Loading…' : '') + '</div>';
  }
  function wall() {
    return '<section class="tw-wrap" aria-label="The Talanoa Wall">' +
      '<div class="tw-top"><h1 class="tw-title">Talanoa</h1>' + tabs() + '</div>' +
      composer() +
      '<div id="tw-spark">' + (st.sparkHtml || '') + '</div>' +
      pill() +
      '<div class="tw-list" id="tw-list">' + list(st.posts) + '</div>' +
      '<div id="tw-foot">' + endMark() + '</div>' +
    '</section>';
  }
  function threadView(root, replies) {
    return '<section class="tw-wrap tw-thread" aria-label="Post">' +
      '<div class="tw-top"><button type="button" class="tw-back" data-tw="back" aria-label="Back to the wall">←</button><h1 class="tw-title">Post</h1></div>' +
      '<div class="tw-list">' + card(root, { expanded: true }) + '</div>' +
      composer({ replyTo: root.id }) +
      '<div class="tw-list tw-replies" id="tw-replies">' + replies.map(function (r) { return card(r, { reply: true }); }).join('') + '</div>' +
      (replies.length ? '' : '<div class="tw-end">No replies yet.</div>') +
    '</section>';
  }
  function skeleton() {
    var rows = '';
    for (var i = 0; i < 4; i++) rows += '<div class="tw-skel"><i></i><div><b></b><b></b></div></div>';
    return '<section class="tw-wrap" aria-busy="true"><div class="tw-top"><h1 class="tw-title">Talanoa</h1>' + tabs() + '</div>' + composer() + '<div class="tw-list">' + rows + '</div></section>';
  }
  function errorBox() {
    return '<section class="glass card view-error" role="alert"><h3>Connection interrupted.</h3><p>We could not load the wall. Try again when your signal returns.</p><button type="button" class="btn" data-tw="retry">Try again</button></section>';
  }

  /* ---------------------------------------------------------------- data */
  async function page(args) {
    return rpc('bv_talanoa_feed', Object.assign({ p_mode: st.mode, p_as_of: st.asOf, p_limit: PAGE }, args || {}));
  }
  async function loadFirst() {
    st.asOf = new Date().toISOString();
    var posts = await page({ p_offset: 0 });
    st.posts = posts; st.offset = posts.length; st.done = posts.length < PAGE; st.newest = newest(posts); st.pending = 0;
  }
  async function loadMore() {
    if (st.loading || st.done || st.thread) return;
    st.loading = true; paintFoot();
    var seq = st.seq;
    try {
      var last = st.posts[st.posts.length - 1];
      var more = await page(st.mode === 'hot'
        ? { p_offset: st.offset }
        : { p_cursor_created: last ? last.created_at : null, p_cursor_id: last ? last.id : null });
      if (seq !== st.seq) return;
      st.posts = st.posts.concat(more); st.offset += more.length; st.done = more.length < PAGE;
      var listEl = $('#tw-list');
      if (listEl && more.length) listEl.insertAdjacentHTML('beforeend', more.map(function (p) { return card(p); }).join(''));
    } catch (e) {
      if (seq === st.seq) toast(say(e));
    } finally {
      if (seq === st.seq) { st.loading = false; paintFoot(); }
    }
  }
  async function showNew() {
    var seq = st.seq;
    try {
      var fresh = await rpc('bv_talanoa_feed', { p_mode: 'latest', p_as_of: new Date().toISOString(), p_limit: 50, p_since: st.newest });
      if (seq !== st.seq) return;
      st.posts = merge(fresh, st.posts); st.newest = newest(st.posts) || st.newest; st.pending = 0;
      if (st.mode === 'hot') st.offset += fresh.length;
      var listEl = $('#tw-list');
      if (listEl) {
        if (!st.posts.length) listEl.innerHTML = list([]);
        else if (listEl.querySelector('.tw-empty')) listEl.innerHTML = list(st.posts);
        else listEl.insertAdjacentHTML('afterbegin', fresh.map(function (p) { return card(p); }).join(''));
      }
      paintPill();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { if (seq === st.seq) toast(say(e)); }
  }
  function paintPill() {
    var el = $('.tw-pill'); if (!el) return;
    el.hidden = !st.pending || !!st.thread; el.textContent = pillText(st.pending);
  }
  function paintFoot() { var el = $('#tw-foot'); if (el) { el.innerHTML = endMark(); watchSentinel(); } }
  function watchSentinel() {
    if (st.io) { st.io.disconnect(); st.io = null; }
    var s = $('.tw-sentinel'); if (!s || typeof IntersectionObserver === 'undefined') return;
    st.io = new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) loadMore(); }, { rootMargin: PREFETCH_PX + 'px 0px' });
    st.io.observe(s);
  }

  /* ---------------------------------------------------------------- realtime */
  function subscribe() {
    if (st.channel || !client || typeof client.channel !== 'function') return;
    st.channel = client.channel(CHANNEL)
      .on('postgres_changes', { event: 'INSERT', schema: 'bulavata', table: 'talanoa_posts' }, onInsert)
      .subscribe();
  }
  function onInsert(payload) {
    var row = payload && payload['new']; if (!row || !row.id) return;
    var mine = S.user && row.author === S.user.id;
    if (row.reply_to) {
      if (st.thread && Number(row.reply_to) === Number(st.thread.id)) { if (!mine) refreshThread(); }
      else bump(row.reply_to, 'reply', 1);
      return;
    }
    if (mine) return;
    st.pending += 1; paintPill();
  }
  function bump(id, kind, delta) {
    $$('.tw-post[data-id="' + id + '"] [data-count="' + kind + '"]').forEach(function (b) {
      var n = Math.max(0, num(b.textContent) + delta); b.textContent = n || '';
      var btn = b.closest('button'); if (btn) btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(/\d+$/, String(n)));
    });
    st.posts.forEach(function (p) { if (Number(p.id) === Number(id)) p[kind + '_count'] = Math.max(0, num(p[kind + '_count']) + delta); });
  }

  /* ---------------------------------------------------------------- thread */
  async function openThread(id) {
    var seq = ++st.seq;
    id = Number(id);
    st.thread = { id: id }; st.quote = null;
    if (st.io) { st.io.disconnect(); st.io = null; }
    try {
      var both = await Promise.all([
        rpc('bv_talanoa_feed', { p_post_id: id, p_limit: 1 }),
        rpc('bv_talanoa_feed', { p_reply_to: id, p_limit: 50 })
      ]);
      if (seq !== st.seq) return;
      var root = both[0][0];
      if (!root) { toast(SAY.GONE); st.thread = null; return view(); }
      st.thread.root = root; st.thread.replies = both[1];
      shell(threadView(root, both[1]));
      $('.tw-thread .tw-expanded')?.focus?.({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      if (seq !== st.seq) return;
      shell(errorBox());
    }
  }
  async function refreshThread() {
    if (!st.thread) return;
    var seq = st.seq, id = st.thread.id;
    try {
      var replies = await rpc('bv_talanoa_feed', { p_reply_to: id, p_limit: 50 });
      if (seq !== st.seq || !st.thread) return;
      st.thread.replies = replies;
      var el = $('#tw-replies'); if (el) el.innerHTML = replies.map(function (r) { return card(r, { reply: true }); }).join('');
      $$('.tw-expanded [data-count="reply"]').forEach(function (b) { b.textContent = replies.length || ''; });
    } catch (_) {}
  }
  function backToWall() {
    st.thread = null;
    return view();
  }

  /* ---------------------------------------------------------------- actions */
  async function toggle(kind, id, btn) {
    if (!S.user) return toast(SAY.NOT_SIGNED_IN);
    var on = btn.classList.toggle('on'), countEl = btn.querySelector('b'), before = num(countEl.textContent);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    countEl.textContent = Math.max(0, before + (on ? 1 : -1)) || '';
    if (kind === 'like') btn.firstChild.textContent = on ? '♥' : '♡';
    try {
      var r = await rpc(kind === 'like' ? 'bv_talanoa_like' : 'bv_talanoa_repost', { p_id: Number(id) });
      var state = kind === 'like' ? r.liked : r.reposted, count = num(kind === 'like' ? r.like_count : r.repost_count);
      $$('.tw-post[data-id="' + id + '"] [data-tw="' + kind + '"]').forEach(function (b) {
        b.classList.toggle('on', !!state); b.setAttribute('aria-pressed', state ? 'true' : 'false');
        b.querySelector('b').textContent = count || '';
        if (kind === 'like') b.firstChild.textContent = state ? '♥' : '♡';
        b.setAttribute('aria-label', (kind === 'like' ? 'Like, ' : 'Repost, ') + count);
      });
      st.posts.forEach(function (p) { if (Number(p.id) === Number(id)) { p['i_' + (kind === 'like' ? 'liked' : 'reposted')] = !!state; p[kind + '_count'] = count; } });
    } catch (e) {
      btn.classList.toggle('on', !on); btn.setAttribute('aria-pressed', !on ? 'true' : 'false');
      countEl.textContent = before || ''; if (kind === 'like') btn.firstChild.textContent = !on ? '♥' : '♡';
      toast(say(e));
    }
  }
  async function share(id) {
    var p = findPost(id), url = shareUrl(id), text = p ? p.body : 'On the Talanoa Wall';
    try {
      if (navigator.share) { await navigator.share({ title: 'Sota Kece', text: text, url: url }); return; }
      await navigator.clipboard.writeText(url); toast('Link copied.');
    } catch (e) { if (!e || e.name !== 'AbortError') toast('Copy this: ' + url); }
  }
  function findPost(id) {
    id = Number(id);
    for (var i = 0; i < st.posts.length; i++) if (Number(st.posts[i].id) === id) return st.posts[i];
    if (st.thread) {
      if (st.thread.root && Number(st.thread.root.id) === id) return st.thread.root;
      for (var j = 0; j < (st.thread.replies || []).length; j++) if (Number(st.thread.replies[j].id) === id) return st.thread.replies[j];
    }
    return null;
  }
  async function remove(id) {
    if (!confirm('Remove this post from the wall?')) return;
    try {
      await rpc('bv_talanoa_delete', { p_id: Number(id) });
      $$('.tw-post[data-id="' + id + '"]').forEach(function (el) { el.remove(); });
      st.posts = st.posts.filter(function (p) { return Number(p.id) !== Number(id); });
      if (st.thread && Number(st.thread.id) === Number(id)) return backToWall();
      if (st.thread) refreshThread();
      toast('Removed.');
    } catch (e) { toast(say(e)); }
  }
  function startQuote(id) {
    var p = findPost(id); if (!p) return;
    if (st.thread) { st.quote = p; st.thread = null; return view(); }
    st.quote = p;
    var form = $('[data-tw-form="post"]'); if (form) form.outerHTML = composer();
    $('[data-tw-form="post"] textarea')?.focus();
  }
  async function submit(form) {
    if (!S.user) return toast(SAY.NOT_SIGNED_IN);
    var ta = form.querySelector('textarea'), body = (ta.value || '').trim(), btn = form.querySelector('button[type=submit]');
    if (!body) return toast(SAY.EMPTY);
    if (body.length > MAX) return toast(SAY.TOO_LONG);
    var replyTo = form.dataset.replyTo ? Number(form.dataset.replyTo) : null;
    btn.disabled = true; ta.disabled = true;
    try {
      var post = await rpc('bv_talanoa_post', { p_body: body, p_quote: replyTo ? null : (st.quote ? Number(st.quote.id) : null), p_reply_to: replyTo });
      ta.value = ''; ta.disabled = false; st.quote = null;
      if (replyTo) {
        if (st.thread && Number(st.thread.id) === Number(replyTo)) {
          st.thread.replies = (st.thread.replies || []).concat([post]);
          var rep = $('#tw-replies'); if (rep) rep.insertAdjacentHTML('beforeend', card(post, { reply: true }));
          $('.tw-thread .tw-end')?.remove();
          $$('.tw-expanded [data-count="reply"]').forEach(function (b) { b.textContent = st.thread.replies.length; });
        }
      } else {
        st.posts = merge([post], st.posts); st.newest = newest(st.posts); if (st.mode === 'hot') st.offset += 1;
        var listEl = $('#tw-list');
        if (listEl) { if (listEl.querySelector('.tw-empty')) listEl.innerHTML = list(st.posts); else listEl.insertAdjacentHTML('afterbegin', card(post)); }
        form.outerHTML = composer();
      }
      toast(replyTo ? 'Replied.' : 'Posted.');
    } catch (e) {
      ta.disabled = false; btn.disabled = false; toast(say(e));
    }
  }
  function setMode(mode) {
    if (mode === st.mode || (mode !== 'hot' && mode !== 'latest')) return;
    st.mode = mode; st.thread = null;
    return view();
  }

  /* ---------------------------------------------------------------- events (one delegated listener on #app) */
  function wire() {
    if (wired || typeof document === 'undefined') return;
    wired = true;
    var app = document.getElementById('app') || document.body;
    app.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-tw]'); if (!t || !app.contains(t)) return;
      var act = t.dataset.tw, id = t.dataset.id;
      if (act === 'room') { ev.preventDefault(); ev.stopPropagation(); return openRoom(t.dataset.handle); }
      if (act === 'open') { if (ev.target.closest('a,button')) return; return openThread(id); }
      if (act === 'like' || act === 'repost') return toggle(act, id, t);
      if (act === 'reply') return st.thread && Number(st.thread.id) === Number(id) ? $('[data-tw-form="reply"] textarea')?.focus() : openThread(id);
      if (act === 'quote') return startQuote(id);
      if (act === 'share') return share(id);
      if (act === 'del') return remove(id);
      if (act === 'sere') return window.SotaSere && window.SotaSere.open();
      if (act === 'tip') return window.SotaSere && window.SotaSere.tip(id, t);
      if (act === 'remix') return window.SotaSere && window.SotaSere.open({ remixOf: id });
      if (act === 'unquote') { st.quote = null; var f = $('[data-tw-form="post"]'); if (f) f.outerHTML = composer(); return; }
      if (act === 'mode') return setMode(t.dataset.mode);
      if (act === 'new') return showNew();
      if (act === 'back') return backToWall();
      if (act === 'retry') return view();
    });
    app.addEventListener('keydown', function (ev) {
      var t = ev.target.closest('.tw-quote[data-tw="open"]');
      if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openThread(t.dataset.id); }
      if (ev.target.matches('.tw-compose textarea') && (ev.metaKey || ev.ctrlKey) && ev.key === 'Enter') { ev.preventDefault(); submit(ev.target.form); }
    });
    app.addEventListener('input', function (ev) {
      var ta = ev.target; if (!ta.matches('.tw-compose textarea')) return;
      var form = ta.form, left = MAX - ta.value.length, c = form.querySelector('.tw-count');
      c.textContent = left + ' letters left'; c.classList.toggle('low', left < 20);
      form.querySelector('button[type=submit]').disabled = !ta.value.trim();
      ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px';
    });
    app.addEventListener('submit', function (ev) {
      var form = ev.target.closest('.tw-compose'); if (!form) return;
      ev.preventDefault(); submit(form);
    });
  }

  /* ---------------------------------------------------------------- entry points */
  async function view() {
    var seq = ++st.seq;
    st.thread = null;
    wire(); subscribe();
    shell(skeleton());
    if (spark && st.sparkHtml === null) {
      Promise.resolve().then(spark).then(function (html) { st.sparkHtml = html || ''; var el = $('#tw-spark'); if (el && seq === st.seq) el.innerHTML = st.sparkHtml; }).catch(function () { st.sparkHtml = ''; });
    }
    var deep = /^#talanoa=(\d+)$/.exec(location.hash || '');
    if (deep) { history.replaceState(null, '', location.pathname + location.search); return openThread(Number(deep[1])); }
    try { await loadFirst(); } catch (e) { if (seq === st.seq) shell(errorBox()); return; }
    if (seq !== st.seq) return;
    shell(wall());
    paintPill(); watchSentinel();
  }
  function stop() {
    st.seq += 1;
    if (st.io) { st.io.disconnect(); st.io = null; }
    if (st.channel && client && typeof client.removeChannel === 'function') { try { client.removeChannel(st.channel); } catch (_) {} }
    var keepMode = st.mode; st = fresh(); st.mode = keepMode;
  }
  function init(cfg) {
    client = cfg.client; S = cfg.state; toast = cfg.toast; esc = cfg.esc; ago = cfg.ago;
    openRoom = cfg.openRoom; shell = cfg.shell; spark = cfg.spark || null;
  }

  window.SotaPulse = {
    init: init, view: view, stop: stop, openThread: openThread,
    // exposed for tests
    card: card, sereBox: sereBox, composer: composer, merge: merge, pillText: pillText, rich: rich, newest: newest, shareUrl: shareUrl,
    onInsert: onInsert, state: function () { return st; }, MAX: MAX, PAGE: PAGE, DEFAULT_MODE: DEFAULT_MODE
  };
})();
