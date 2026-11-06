/* Sota Kece — the social layer on top of moments, the wall and rooms.
   Reactions, comments & replies, bookmarks, edit (1 hour, 5 edits, history kept),
   repost & quote, polls, close friends, 24-hour stories + notes + highlights,
   events with RSVP, memories, @mentions, drafts and an undo window before posting.
   Everything reads through the bv_* functions in supabase/migrations/20261031140000_sota_social_plus.sql,
   so the friends-only rule is enforced in the database, not here. Newest first, always. */
(function () {
  'use strict';

  var REACTIONS = [
    { key: 'bula',   icon: '👋', name: 'Bula' },
    { key: 'vinaka', icon: '🙏', name: 'Vinaka' },
    { key: 'haha',   icon: '😂', name: 'Haha' },
    { key: 'wow',    icon: '😮', name: 'Wow' },
    { key: 'sad',    icon: '😢', name: 'Sad' },
    { key: 'fire',   icon: '🔥', name: 'Fire' }
  ];
  var RX = {}; REACTIONS.forEach(function (r) { RX[r.key] = r; });
  var SAY = {
    NOT_SIGNED_IN: 'Sign in first.', NOT_VISIBLE: 'Only friends can do that.', NOT_FRIENDS: 'Close friends have to be friends first.',
    EDIT_WINDOW_CLOSED: 'Edits are only possible for an hour after posting.', EDIT_LIMIT: 'Five edits is the limit for one moment.',
    ALREADY_REPOSTED: 'You already reposted this.', POLL_CLOSED: 'This poll has closed.', NOT_YOURS: 'That is not yours to change.',
    NOT_IN_CREW: 'You are not in that Koro.', EMPTY: 'Write something first.'
  };
  var UNDO_SECONDS = 8, DRAFT_KEY = 'sp-draft-moment';

  var client, S, toast, render, openRoom, esc, ago, mediaMarkup, shell;
  var openComments = {}, pendingPost = null;

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
  function rich(text) {
    return esc(text || '').replace(/(^|[\s(])@([a-z0-9_]{2,32})/gi, function (_, pre, h) {
      return pre + '<button type="button" class="sp-mention" data-sp="room" data-handle="' + esc(h) + '">@' + esc(h) + '</button>';
    }).replace(/\n/g, '<br>');
  }
  function isNew(created) { return Date.now() - new Date(created).getTime() < 3600 * 1000; }
  function when(t) {
    var d = new Date(t);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function count(rs) { var n = 0, c = (rs && rs.counts) || {}; for (var k in c) n += c[k]; return n; }

  /* ---------------------------------------------------------------- reactions + comments bar (moments, wall, stories) */
  function bar(kind, id, reactions, commentCount, extra) {
    var rs = reactions || { counts: {}, mine: null }, mine = rs.mine;
    // A refreshed count can come from DOM text; never reinterpret it as HTML.
    var replies = Number(commentCount);
    if (!Number.isSafeInteger(replies) || replies < 0) replies = 0;
    var top = REACTIONS.filter(function (r) { return rs.counts[r.key] > 0; })
      .sort(function (a, b) { return rs.counts[b.key] - rs.counts[a.key]; }).slice(0, 3)
      .map(function (r) { return r.icon; }).join('');
    var total = count(rs);
    return '<div class="sp-bar" data-kind="' + kind + '" data-id="' + id + '">' +
      '<div class="sp-react-wrap">' +
        '<button type="button" class="sp-btn ' + (mine ? 'on' : '') + '" data-sp="react-open" aria-label="React">' +
          (mine ? RX[mine].icon + ' ' + RX[mine].name : '👋 React') + '</button>' +
        '<div class="sp-react-menu" role="group" aria-label="Choose a reaction">' +
          REACTIONS.map(function (r) {
            return '<button type="button" class="' + (mine === r.key ? 'on' : '') + '" data-sp="react" data-reaction="' + (mine === r.key ? '' : r.key) + '" title="' + r.name + '">' + r.icon + '</button>';
          }).join('') + '</div>' +
      '</div>' +
      (total ? '<button type="button" class="sp-who" data-sp="reactors" title="Who reacted">' + top + ' ' + total + '</button>' : '') +
      '<button type="button" class="sp-btn" data-sp="comments">💬 ' + (replies || 'Reply') + '</button>' +
      (extra || '') +
      '</div><div class="sp-comments" hidden></div>';
  }

  async function refreshBar(el, rs) {
    var kind = el.dataset.kind, id = Number(el.dataset.id);
    if (!rs) rs = await rpc('bv_reactors', { p_kind: kind, p_id: id }).then(function (list) {
      var counts = {}, mine = null;
      list.forEach(function (r) { counts[r.reaction] = (counts[r.reaction] || 0) + 1; if (S.me && r.handle === S.me.handle) mine = r.reaction; });
      return { counts: counts, mine: mine };
    });
    var cc = el.querySelector('[data-sp="comments"]');
    var extra = Array.prototype.slice.call(el.children).filter(function (c) { return c.classList.contains('sp-extra'); }).map(function (c) { return c.outerHTML; }).join('');
    var tmp = document.createElement('div');
    tmp.innerHTML = bar(kind, id, rs, cc ? cc.textContent.replace('💬', '').trim() : '', extra);
    var fresh = tmp.firstElementChild, comments = el.nextElementSibling;
    el.replaceWith(fresh);
    tmp.lastElementChild.remove(); // keep the existing comments panel
    if (comments && !comments.classList.contains('sp-comments')) fresh.insertAdjacentHTML('afterend', '<div class="sp-comments" hidden></div>');
  }

  async function loadComments(barEl) {
    var kind = barEl.dataset.kind, id = Number(barEl.dataset.id), panel = barEl.nextElementSibling;
    panel.hidden = false;
    panel.innerHTML = '<div class="sub">Loading…</div>';
    var list;
    try { list = await rpc('bv_comments', { p_kind: kind, p_id: id }); } catch (e) { panel.innerHTML = '<div class="sub">' + esc(say(e)) + '</div>'; return; }
    openComments[kind + ':' + id] = true;
    var byParent = {};
    list.forEach(function (c) { (byParent[c.parent_id || 0] = byParent[c.parent_id || 0] || []).push(c); });
    function tree(parent, depth) {
      return (byParent[parent] || []).map(function (c) {
        return '<div class="sp-comment" style="margin-left:' + Math.min(depth, 3) * 18 + 'px" data-cid="' + c.id + '">' +
          '<div class="row" style="gap:7px"><span>' + esc(c.avatar_emoji || '🌺') + '</span><b>@' + esc(c.handle) + '</b>' +
          '<span class="ago">' + ago(c.created_at) + '</span><div class="spacer"></div>' +
          (!c.deleted && (c.author === S.user.id) ? '<button type="button" class="sp-link" data-sp="comment-delete" data-cid="' + c.id + '">delete</button>' : '') + '</div>' +
          '<div class="sp-comment-body">' + (c.deleted ? '<i class="sub">removed</i>' : rich(c.body)) + '</div>' +
          (!c.deleted ? '<div class="row" style="gap:10px"><button type="button" class="sp-link" data-sp="reply" data-cid="' + c.id + '">reply</button>' +
            '<button type="button" class="sp-link ' + (c.reactions && c.reactions.mine ? 'on' : '') + '" data-sp="comment-react" data-cid="' + c.id + '">🙏 ' + (count(c.reactions) || '') + '</button></div>' : '') +
          tree(c.id, depth + 1) + '</div>';
      }).join('');
    }
    panel.innerHTML = (list.length ? tree(0, 0) : '<div class="sub">No replies yet.</div>') +
      '<form class="sp-reply" data-sp="comment-form"><input name="body" maxlength="1000" placeholder="Reply…" aria-label="Reply" required>' +
      '<input type="hidden" name="parent" value=""><button class="btn sm" type="submit">Send</button></form>';
  }

  /* ---------------------------------------------------------------- moments */
  async function feed(lim) { return rpc('bv_moments_feed2', { lim: lim || 60 }); }

  function pollMarkup(p) {
    if (!p) return '';
    var voted = p.mine !== null && p.mine !== undefined, show = voted || p.closed, total = p.total || 0;
    return '<div class="sp-poll" data-poll="' + p.id + '"><div class="sp-poll-q">' + esc(p.question) + '</div>' +
      p.options.map(function (o, i) {
        var n = (p.counts && p.counts[i]) || 0, pct = total ? Math.round(n * 100 / total) : 0;
        return show
          ? '<div class="sp-poll-opt ' + (p.mine === i ? 'mine' : '') + '"><span class="sp-poll-fill" style="width:' + pct + '%"></span><span class="sp-poll-label">' + esc(o) + '</span><b>' + pct + '%</b></div>'
          : '<button type="button" class="sp-poll-opt vote" data-sp="vote" data-choice="' + i + '"><span class="sp-poll-label">' + esc(o) + '</span></button>';
      }).join('') +
      '<div class="sub">' + total + (total === 1 ? ' vote' : ' votes') + ' · ' + (p.closed ? 'closed' : 'closes ' + when(p.closes_at)) + '</div></div>';
  }

  function momentCard(m) {
    var mine = m.author === S.user.id;
    if (m.compat) return momentCardCompat(m, mine);
    var quoted = m.repost ? (m.repost.visible === false
      ? '<div class="sp-quote sub">A moment you cannot see any more.</div>'
      : '<div class="sp-quote"><div class="row" style="gap:7px"><span>' + esc(m.repost.avatar_emoji || '🌺') + '</span><b>' + esc(m.repost.display_name || m.repost.handle) + '</b>' +
        '<span class="handle">@' + esc(m.repost.handle) + ' · ' + ago(m.repost.created_at) + '</span></div>' +
        (m.repost.body ? '<div class="body">' + rich(m.repost.body) + '</div>' : '') + mediaMarkup(m.repost.media_url) + '</div>') : '';
    var extra =
      '<button type="button" class="sp-btn sp-extra ' + (m.bookmarked ? 'on' : '') + '" data-sp="bookmark" aria-label="Save">' + (m.bookmarked ? '🔖 Saved' : '🔖') + '</button>' +
      '<button type="button" class="sp-btn sp-extra" data-sp="repost" aria-label="Repost or quote">🔁' + (m.repost_count ? ' ' + m.repost_count : '') + '</button>';
    return '<div class="moment sp-moment" data-mid="' + m.id + '">' +
      '<div class="row">' +
        '<div class="av sm" style="background:' + esc(m.accent) + '18">' + esc(m.avatar_emoji || '🌺') + '</div>' +
        '<div style="flex:1;min-width:0"><div class="name ellip">' + esc(m.display_name || m.handle) + (m.repost && !m.body ? ' <span class="sub">reposted</span>' : '') + '</div>' +
          '<div class="handle">@' + esc(m.handle) + ' · ' + ago(m.created_at) +
          (m.audience === 'close' ? ' · <span class="sp-close-tag">🟢 close friends</span>' : '') +
          (m.edited_at ? ' · <button type="button" class="sp-link" data-sp="history">edited</button>' : '') + '</div></div>' +
        (mine ? (isNew(m.created_at) && m.edit_count < 5 && !m.repost ? '<button class="luvbtn" aria-label="Edit" data-sp="edit">✏️</button>' : '') +
          '<button class="luvbtn" aria-label="Delete this moment" onclick="delMoment(' + m.id + ')">🗑</button>' : '') +
      '</div>' +
      (m.body ? '<div class="body">' + rich(m.body) + '</div>' : '') +
      mediaMarkup(m.media_url) + quoted + pollMarkup(m.poll) +
      '<div class="row wrap" style="gap:6px;margin-top:8px">' +
        '<button class="luvbtn ' + (m.i_luvd ? 'on' : '') + '" onclick="giveLuv(\'moment\',' + m.id + ')">🫶 <span>Uro</span>' + (m.luv_count ? ' · ' + m.luv_count : '') + '</button>' +
      '</div>' +
      bar('moment', m.id, m.reactions, m.comment_count, extra) +
      '</div>';
  }

  function momentCardCompat(m, mine) {
    return '<div class="moment sp-moment" data-mid="' + m.id + '"><div class="row">' +
      '<div class="av sm" style="background:' + esc(m.accent) + '18">' + esc(m.avatar_emoji || '🌺') + '</div>' +
      '<div style="flex:1;min-width:0"><div class="name ellip">' + esc(m.display_name || m.handle) + '</div><div class="handle">@' + esc(m.handle) + ' · ' + ago(m.created_at) + '</div></div>' +
      (mine ? '<button class="luvbtn" aria-label="Delete this moment" onclick="delMoment(' + m.id + ')">🗑</button>' : '') + '</div>' +
      (m.body ? '<div class="body">' + rich(m.body) + '</div>' : '') + mediaMarkup(m.media_url) +
      '<button class="luvbtn ' + (m.i_luvd ? 'on' : '') + '" onclick="giveLuv(\'moment\',' + m.id + ')">🫶 <span>Uro</span>' + (m.luv_count ? ' · ' + m.luv_count : '') + '</button></div>';
  }

  /* ---------------------------------------------------------------- composer: audience, poll, drafts, undo */
  function composerExtras() {
    return '<div class="sp-compose" id="sp-compose">' +
      '<div class="row wrap" style="gap:8px">' +
        '<label class="sp-seg"><span>Who sees it</span><select id="sp-audience" aria-label="Audience">' +
          '<option value="friends">All friends</option><option value="close">🟢 Close friends only</option></select></label>' +
        '<button type="button" class="btn sm ghost" data-sp="poll-toggle">📊 Add a poll</button>' +
        '<span class="sub" id="sp-draft-note"></span>' +
      '</div>' +
      '<div id="sp-poll-builder" hidden><input id="sp-poll-q" maxlength="200" placeholder="Poll question" aria-label="Poll question">' +
        '<div class="sp-poll-opts"><input maxlength="60" placeholder="Option 1"><input maxlength="60" placeholder="Option 2"><input maxlength="60" placeholder="Option 3 (optional)"><input maxlength="60" placeholder="Option 4 (optional)"></div>' +
        '<label class="sp-seg"><span>Open for</span><select id="sp-poll-hours"><option value="24">1 day</option><option value="72">3 days</option><option value="168">1 week</option></select></label></div>' +
      '</div>';
  }
  function wireComposer() {
    var body = document.getElementById('m-body'), note = document.getElementById('sp-draft-note');
    if (!body) return;
    try {
      var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && d.body && !body.value) { body.value = d.body; var u = document.getElementById('m-url'); if (u && d.url) u.value = d.url; if (note) note.textContent = 'Draft restored'; }
    } catch (_) {}
    function save() {
      var u = document.getElementById('m-url');
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ body: body.value, url: u ? u.value : '' })); } catch (_) {}
      if (note) note.textContent = body.value ? 'Draft saved on this device' : '';
    }
    body.addEventListener('input', save);
    var u = document.getElementById('m-url'); if (u) u.addEventListener('input', save);
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (_) {} }

  // Replaces postMoment: a short undo window, then audience + optional poll go with the post.
  async function post() {
    var body = document.getElementById('m-body'), urlEl = document.getElementById('m-url');
    var b = (body && body.value.trim()) || '', u = (urlEl && urlEl.value.trim()) || '';
    if (!b && !u) return;
    var audience = (document.getElementById('sp-audience') || {}).value || 'friends';
    var poll = null, builder = document.getElementById('sp-poll-builder');
    if (builder && !builder.hidden) {
      var q = document.getElementById('sp-poll-q').value.trim();
      var opts = Array.prototype.map.call(builder.querySelectorAll('.sp-poll-opts input'), function (i) { return i.value.trim(); }).filter(Boolean);
      if (q && opts.length >= 2) poll = { q: q, opts: opts.slice(0, 4), hours: Number(document.getElementById('sp-poll-hours').value) || 24 };
      else if (q || opts.length) return toast('A poll needs a question and at least two options.');
    }
    if (pendingPost) { clearTimeout(pendingPost.timer); pendingPost = null; }
    var left = UNDO_SECONDS, box = document.createElement('div');
    box.className = 'sp-undo glass'; box.setAttribute('role', 'status');
    box.innerHTML = '<span>Posting in <b>' + left + '</b>s…</span><button type="button" class="btn sm ghost">Undo</button>';
    document.body.appendChild(box);
    var tick = setInterval(function () { left--; var bEl = box.querySelector('b'); if (bEl) bEl.textContent = left; }, 1000);
    function done() { clearInterval(tick); box.remove(); pendingPost = null; }
    box.querySelector('button').onclick = function () { clearTimeout(pendingPost.timer); done(); toast('Not posted. Your draft is still here.'); };
    pendingPost = { timer: setTimeout(async function () {
      done();
      var ins = await client.from('bv_moments').insert({ author: S.user.id, body: b || null, media_url: u || null, audience: audience }).select('id').single();
      if (ins.error) return toast(ins.error.message);
      if (poll) { try { await rpc('bv_poll_create', { p_moment: ins.data.id, p_question: poll.q, p_options: poll.opts, p_hours: poll.hours }); } catch (e) { toast(say(e)); } }
      clearDraft(); toast('Posted'); render();
    }, UNDO_SECONDS * 1000) };
    if (body) body.value = ''; if (urlEl) urlEl.value = '';
    if (builder) { builder.hidden = true; builder.querySelectorAll('input').forEach(function (i) { i.value = ''; }); }
    clearDraft();
  }

  /* ---------------------------------------------------------------- stories strip + memories */
  function strip() { return '<div id="sp-strip" class="sp-strip" aria-label="Stories and notes"></div><div id="sp-memories"></div>'; }
  async function mountStrip() {
    var el = document.getElementById('sp-strip'), mem = document.getElementById('sp-memories');
    if (!el) return;
    var people = [], memories = [];
    try { var r = await Promise.all([rpc('bv_stories'), rpc('bv_memories')]); people = r[0] || []; memories = r[1] || []; } catch (e) { el.innerHTML = ''; return; }
    var meFirst = people.filter(function (p) { return p.is_me; }).concat(people.filter(function (p) { return !p.is_me; }));
    el.innerHTML = '<div class="sp-strip-scroll">' +
      '<button type="button" class="sp-story-btn add" data-sp="story-new"><span class="sp-ring"><span class="av sm">➕</span></span><small>Your story</small></button>' +
      meFirst.map(function (p) {
        var items = p.items || [], hasItems = items.length > 0;
        return '<div class="sp-story-person">' +
          (hasItems ? '<button type="button" class="sp-story-btn" data-sp="story-open" data-author="' + esc(p.author) + '">' +
            '<span class="sp-ring ' + (p.all_seen ? 'seen' : '') + '" style="--ring:' + esc(p.accent || '#4FA8D8') + '"><span class="av sm">' + esc(p.avatar_emoji || '🌺') + '</span></span>' +
            '<small>' + (p.is_me ? 'You' : esc(p.handle)) + '</small></button>'
          : '<button type="button" class="sp-story-btn quiet" data-sp="room" data-handle="' + esc(p.handle) + '"><span class="sp-ring none"><span class="av sm">' + esc(p.avatar_emoji || '🌺') + '</span></span><small>' + (p.is_me ? 'You' : esc(p.handle)) + '</small></button>') +
          (p.note ? '<span class="sp-note" title="' + esc(p.note.body) + '">' + esc(p.note.body) + '</span>' : '') +
          '</div>';
      }).join('') + '</div>' +
      '<div class="row" style="gap:8px;margin-top:6px"><button type="button" class="sp-link" data-sp="note-new">✍️ Leave a 24-hour note</button></div>';
    el.dataset.people = JSON.stringify(meFirst);
    if (mem) mem.innerHTML = memories.length ? '<div class="glass card sp-memories"><h3>On this day</h3>' + memories.map(function (m) {
      return '<div class="scrawl"><div class="ago">' + m.years_ago + (m.years_ago === 1 ? ' year ago' : ' years ago') + ' · ' + when(m.created_at) + '</div>' + (m.body ? rich(m.body) : '') + mediaMarkup(m.media_url) + '</div>';
    }).join('') + '</div>' : '';
  }

  function storyViewer(person, index) {
    var items = person.items, i = Math.max(0, Math.min(index || 0, items.length - 1)), it = items[i];
    var old = document.getElementById('sp-viewer'); if (old) old.remove();
    var v = document.createElement('div'); v.id = 'sp-viewer'; v.className = 'sp-viewer'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Story');
    v.innerHTML = '<div class="sp-viewer-card" style="--ring:' + esc(person.accent || '#4FA8D8') + '">' +
      '<div class="sp-viewer-dots">' + items.map(function (_, k) { return '<i class="' + (k <= i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="row" style="gap:8px"><span class="av sm">' + esc(person.avatar_emoji || '🌺') + '</span><b>' + esc(person.display_name || person.handle) + '</b>' +
        '<span class="handle">' + ago(it.created_at) + (it.audience === 'close' ? ' · 🟢 close friends' : '') + '</span><div class="spacer"></div>' +
        '<button type="button" class="luvbtn" data-sp="viewer-close" aria-label="Close">✕</button></div>' +
      (it.media_url ? '<div class="sp-viewer-media">' + mediaMarkup(it.media_url) + '</div>' : '') +
      (it.body ? '<div class="sp-viewer-text">' + rich(it.body) + '</div>' : '') +
      '<div class="row wrap" style="gap:6px">' +
        (i > 0 ? '<button type="button" class="btn sm ghost" data-sp="viewer-prev">‹</button>' : '') +
        (i < items.length - 1 ? '<button type="button" class="btn sm ghost" data-sp="viewer-next">›</button>' : '') +
        '<div class="spacer"></div>' +
        (person.is_me
          ? '<span class="sub">👁 ' + (it.views || 0) + '</span><button type="button" class="btn sm ghost" data-sp="story-highlight" data-sid="' + it.id + '">⭐ Keep on my room</button><button type="button" class="btn sm ghost" data-sp="story-delete" data-sid="' + it.id + '">🗑</button>'
          : REACTIONS.slice(0, 4).map(function (r) { return '<button type="button" class="sp-btn ' + (it.reactions && it.reactions.mine === r.key ? 'on' : '') + '" data-sp="story-react" data-sid="' + it.id + '" data-reaction="' + r.key + '">' + r.icon + '</button>'; }).join('')) +
      '</div></div>';
    v.dataset.author = person.author; v.dataset.index = i;
    document.body.appendChild(v);
    if (!person.is_me && !it.seen) { rpc('bv_story_seen', { p_id: it.id }).catch(function () {}); it.seen = true; }
  }
  function personFromStrip(author) {
    var el = document.getElementById('sp-strip'); if (!el) return null;
    try { return (JSON.parse(el.dataset.people || '[]')).filter(function (p) { return p.author === author; })[0] || null; } catch (_) { return null; }
  }
  function storyComposer(kind) {
    var old = document.getElementById('sp-viewer'); if (old) old.remove();
    var v = document.createElement('div'); v.id = 'sp-viewer'; v.className = 'sp-viewer'; v.setAttribute('role', 'dialog');
    v.innerHTML = '<form class="sp-viewer-card" data-sp="story-form" data-kind="' + kind + '">' +
      '<div class="row"><h3 style="margin:0">' + (kind === 'note' ? 'A note for 24 hours' : 'A story for 24 hours') + '</h3><div class="spacer"></div><button type="button" class="luvbtn" data-sp="viewer-close" aria-label="Close">✕</button></div>' +
      '<div class="sub" style="margin:6px 0 10px">' + (kind === 'note' ? 'Short. Sits under your name on the strip. One at a time.' : 'Gone after a day unless you keep it as a highlight on your room.') + '</div>' +
      '<textarea name="body" maxlength="' + (kind === 'note' ? 60 : 300) + '" placeholder="' + (kind === 'note' ? 'e.g. at the market till 2' : 'What is happening…') + '" required></textarea>' +
      (kind === 'story' ? '<input name="media" type="url" placeholder="HTTPS image link (optional)" style="margin-top:8px">' +
        '<label class="sp-seg" style="margin-top:8px"><span>Who sees it</span><select name="audience"><option value="friends">All friends</option><option value="close">🟢 Close friends only</option></select></label>' : '') +
      '<div class="row" style="margin-top:10px"><div class="spacer"></div><button class="btn sm" type="submit">Share</button></div></form>';
    document.body.appendChild(v);
    v.querySelector('textarea').focus();
  }

  /* ---------------------------------------------------------------- side panels: saved, close friends, events */
  function sidePanel() {
    return '<div class="glass card sp-side"><h3>More</h3>' +
      '<div class="sp-side-grid">' +
        '<button type="button" class="btn sm ghost sp-act-btn" data-sp="view" data-view="activity">🔔 Activity<span id="sp-act-badge" class="sp-act-badge" hidden>0</span></button>' +
        '<button type="button" class="btn sm ghost" data-sp="view" data-view="events">📅 Events</button>' +
        '<button type="button" class="btn sm ghost" data-sp="view" data-view="saved">🔖 Saved</button>' +
        '<button type="button" class="btn sm ghost" data-sp="view" data-view="close">🟢 Close friends</button>' +
      '</div></div>';
  }
  function back() { return '<button type="button" class="sp-link" data-sp="view" data-view="moments">‹ Back to Moments</button>'; }

  /* ---------------------------------------------------------------- activity (notifications) */
  var ACT_WORDS = { reaction: 'reacted to your', reply: 'replied to your', mention: 'mentioned you in a', friend_request: 'wants to be friends',
    friend_accepted: 'accepted your friend request', wall: 'scrawled on your wall', rsvp: 'answered your event' };
  var ACT_ICON = { reaction: '👋', reply: '💬', mention: '＠', friend_request: '🤝', friend_accepted: '✅', wall: '🖊️', rsvp: '📅' };
  var ACT_TARGET = { moment: 'moment', pulse: 'pulse', wall: 'wall scrawl', comment: 'reply', story: 'story', event: 'event', friendship: '' };
  function actLine(n) {
    var sn = n.snippet || '', pre = '', text = sn, i = sn.indexOf('|');
    if ((n.kind === 'reaction' || n.kind === 'rsvp') && i >= 0) { pre = sn.slice(0, i); text = sn.slice(i + 1); }
    var verb = ACT_WORDS[n.kind] || n.kind, what = ACT_TARGET[n.target_kind] || '';
    if (n.kind === 'reaction') verb = (RX[pre] ? RX[pre].icon + ' ' : '') + verb;
    if (n.kind === 'rsvp') verb = ({ going: '✅ is going to', maybe: '🤔 might come to', no: '❌ can\'t make' })[pre] || verb;
    return '<span class="name">@' + esc(n.handle || '') + '</span> ' + esc(verb) + (what ? ' ' + esc(what) : '') +
      (text ? ' <span class="sub">“' + esc(text.length > 70 ? text.slice(0, 70) + '…' : text) + '”</span>' : '');
  }
  function setBadge(n) {
    var b = document.getElementById('sp-act-badge'); if (!b) return;
    n = Number(n) || 0; b.textContent = n > 99 ? '99+' : String(n); b.hidden = n === 0;
    var btn = b.closest('.sp-act-btn'); if (btn) btn.setAttribute('aria-label', 'Activity, ' + n + ' unread');
  }
  async function pollUnread() {
    if (!S || !S.user) return;
    try { setBadge(await rpc('bv_activity_unread')); } catch (_) { /* function not deployed yet: stay quiet */ }
  }
  async function viewActivity() {
    shell('<div class="glass card"><h3>Activity</h3><div class="sub">Loading…</div></div>');
    var list; try { list = await rpc('bv_activity', { lim: 60 }); } catch (e) { return shell('<div class="glass card">' + back() + '<p>' + esc(say(e)) + '</p></div>'); }
    shell('<div class="stack">' + back() + '<div class="glass card"><div class="row"><h3 style="margin:0">🔔 Activity</h3><div class="spacer"></div>' +
      (list.some(function (n) { return !n.read; }) ? '<button type="button" class="sp-link" data-sp="act-read-all">mark all read</button>' : '') + '</div>' +
      '<div class="sub" style="margin:4px 0 10px">Reactions, replies, mentions, friend requests, wall scrawls and RSVPs. Friends only, newest first.</div>' +
      (list.length ? list.map(function (n) {
        return '<div class="sp-act ' + (n.read ? '' : 'unread') + '" data-id="' + n.id + '"><span class="av sm" style="--accent:' + esc(n.accent || '') + '">' + esc(n.avatar_emoji || '🌺') + '</span>' +
          '<div style="flex:1;min-width:0"><div>' + actLine(n) + '</div><div class="handle">' + esc(ago(n.created_at)) + '</div></div>' +
          '<span class="sp-act-icon" aria-hidden="true">' + (ACT_ICON[n.kind] || '') + '</span>' +
          '<button type="button" class="btn sm ghost" data-sp="room" data-handle="' + esc(n.handle || '') + '">Room</button></div>';
      }).join('') : '<div class="empty"><em>🔔</em>Nothing yet. When friends react, reply or mention you, it shows up here.</div>') + '</div></div>');
    try { var unread = list.filter(function (n) { return !n.read; }).map(function (n) { return n.id; }); if (unread.length) { await rpc('bv_activity_read', { p_ids: unread }); } pollUnread(); } catch (_) {}
  }

  async function viewSaved() {
    shell('<div class="glass card"><h3>Saved</h3><div class="sub">Loading…</div></div>');
    var list; try { list = await rpc('bv_bookmarks'); } catch (e) { return shell('<div class="glass card">' + back() + '<p>' + esc(say(e)) + '</p></div>'); }
    shell('<div class="stack">' + back() + '<div class="glass card"><h3>Saved</h3><div class="sub" style="margin-bottom:10px">Private. Only you can see what you save.</div>' +
      (list.length ? list.map(function (b) {
        return '<div class="scrawl sp-saved" data-kind="' + esc(b.kind) + '" data-id="' + b.target_id + '"><div class="row" style="gap:7px"><b>@' + esc(b.handle || '') + '</b><span class="ago">' + esc(b.kind) + ' · saved ' + ago(b.saved_at) + '</span><div class="spacer"></div>' +
          '<button type="button" class="sp-link" data-sp="unsave">remove</button></div>' + (b.body ? '<div>' + rich(b.body) + '</div>' : '') + mediaMarkup(b.media_url) + '</div>';
      }).join('') : '<div class="empty"><em>🔖</em>Nothing saved yet. Tap 🔖 on any moment.</div>') + '</div></div>');
  }

  async function viewClose() {
    shell('<div class="glass card"><h3>Close friends</h3><div class="sub">Loading…</div></div>');
    var close, friends;
    try { var r = await Promise.all([rpc('bv_close_friends'), rpc('bv_my_friends')]); close = r[0] || []; friends = r[1] || []; }
    catch (e) { return shell('<div class="glass card">' + back() + '<p>' + esc(say(e)) + '</p></div>'); }
    var closeIds = {}; close.forEach(function (c) { closeIds[c.id] = true; });
    shell('<div class="stack">' + back() + '<div class="glass card"><h3>🟢 Close friends</h3>' +
      '<div class="sub" style="margin-bottom:12px">Moments and stories marked "close friends only" go to these people and nobody else. They are not told they are on the list.</div>' +
      (friends.length ? friends.map(function (f) {
        var id = f.id || f.friend || f.profile_id, on = !!closeIds[id];
        return '<div class="row sp-close-row"><span class="av sm">' + esc(f.avatar_emoji || '🌺') + '</span><div style="flex:1;min-width:0"><div class="name ellip">' + esc(f.display_name || f.handle) + '</div><div class="handle">@' + esc(f.handle) + '</div></div>' +
          '<button type="button" class="btn sm ' + (on ? '' : 'ghost') + '" data-sp="close-toggle" data-id="' + esc(id) + '" data-on="' + (on ? '1' : '0') + '">' + (on ? '🟢 Close' : 'Add') + '</button></div>';
      }).join('') : '<div class="empty"><em>🤝</em>Add some friends first.</div>') + '</div></div>');
  }

  async function viewEvents(past) {
    shell('<div class="glass card"><h3>Events</h3><div class="sub">Loading…</div></div>');
    var list; try { list = await rpc('bv_events', { p_past: !!past }); } catch (e) { return shell('<div class="glass card">' + back() + '<p>' + esc(say(e)) + '</p></div>'); }
    var crews = (S.crews || []);
    shell('<div class="grid two">' +
      '<div class="stack">' + back() +
        '<div class="glass card"><div class="row"><h3 style="margin:0">📅 ' + (past ? 'Past events' : 'Events') + '</h3><div class="spacer"></div>' +
          '<button type="button" class="sp-link" data-sp="view" data-view="' + (past ? 'events' : 'events-past') + '">' + (past ? 'upcoming' : 'past') + '</button></div>' +
        (list.length ? list.map(function (e) {
          return '<div class="sp-event ' + (e.cancelled ? 'off' : '') + '" data-eid="' + e.id + '">' +
            '<div class="sp-event-date"><b>' + new Date(e.starts_at).getDate() + '</b><small>' + new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short' }) + '</small></div>' +
            '<div style="flex:1;min-width:0"><div class="name">' + esc(e.title) + (e.cancelled ? ' <span class="sub">(cancelled)</span>' : '') + '</div>' +
              '<div class="handle">' + when(e.starts_at) + (e.place ? ' · ' + esc(e.place) : '') + ' · by @' + esc(e.host_handle) + (e.audience === 'crew' ? ' · 🪸 Koro' : e.audience === 'close' ? ' · 🟢 close friends' : '') + '</div>' +
              (e.about ? '<div class="body" style="margin-top:6px">' + rich(e.about) + '</div>' : '') +
              '<div class="row wrap" style="gap:6px;margin-top:8px">' +
                ['going', 'maybe', 'no'].map(function (s) { return '<button type="button" class="btn sm ' + (e.mine === s ? '' : 'ghost') + '" data-sp="rsvp" data-status="' + s + '" ' + (e.cancelled ? 'disabled' : '') + '>' + ({ going: '✅ Going', maybe: '🤔 Maybe', no: '✖ Can\'t' })[s] + '</button>'; }).join('') +
                '<span class="sub">' + e.going + ' going' + (e.maybe ? ', ' + e.maybe + ' maybe' : '') + '</span>' +
                (e.is_host && !e.cancelled ? '<button type="button" class="sp-link" data-sp="event-cancel">cancel event</button>' : '') + '</div>' +
              (e.people && e.people.length ? '<div class="sp-people">' + e.people.map(function (p) { return '<span title="@' + esc(p.handle) + ' · ' + esc(p.status) + '">' + esc(p.avatar_emoji || '🌺') + '</span>'; }).join('') + '</div>' : '') +
            '</div></div>';
        }).join('') : '<div class="empty"><em>📅</em>' + (past ? 'No past events.' : 'Nothing coming up. Host something.') + '</div>') + '</div></div>' +
      '<div class="glass card" style="align-self:start"><h3>Host an event</h3>' +
        '<form data-sp="event-form" class="stack" style="gap:8px;margin-top:8px">' +
          '<input name="title" maxlength="120" placeholder="What is it?" required aria-label="Event title">' +
          '<label class="sp-seg"><span>Starts</span><input name="starts" type="datetime-local" required></label>' +
          '<label class="sp-seg"><span>Ends</span><input name="ends" type="datetime-local"></label>' +
          '<input name="place" maxlength="200" placeholder="Where (optional)">' +
          '<textarea name="about" maxlength="2000" placeholder="Details (optional)"></textarea>' +
          '<label class="sp-seg"><span>Who</span><select name="audience"><option value="friends">All friends</option><option value="close">🟢 Close friends</option>' +
            crews.map(function (c) { return '<option value="crew:' + c.id + '">🪸 ' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
          '<div class="row"><div class="spacer"></div><button class="btn sm" type="submit">Create</button></div></form>' +
        '<div class="sub" style="margin-top:10px">Friends see it, say yes, maybe or no. No public events, no promoted events.</div></div>' +
      '</div>');
  }

  async function open(view) {
    if (view === 'moments') { S.plusView = null; return render(); }
    S.plusView = view;
    if (view === 'activity') return viewActivity();
    if (view === 'saved') return viewSaved();
    if (view === 'close') return viewClose();
    if (view === 'events') return viewEvents(false);
    if (view === 'events-past') return viewEvents(true);
  }

  /* ---------------------------------------------------------------- room extras */
  function roomExtras(R) {
    var p = R.profile, out = '';
    if (!R.is_me && R.friend_status === 'accepted') {
      out += '<button type="button" class="btn sm ' + (R.is_close ? '' : 'ghost') + '" data-sp="close-toggle" data-id="' + esc(p.id) + '" data-on="' + (R.is_close ? '1' : '0') + '" data-stay="1">' + (R.is_close ? '🟢 Close friend' : '🟢 Make close friend') + '</button>';
    }
    return out;
  }
  function highlights(R) {
    var h = R.highlights || [];
    if (!h.length) return '';
    return '<div class="glass card sp-highlights"><h3>Highlights</h3><div class="sp-strip-scroll">' + h.map(function (s) {
      return '<div class="sp-highlight">' + (s.media_url ? mediaMarkup(s.media_url) : '<div class="sp-highlight-text">' + rich(s.body) + '</div>') +
        '<small>' + esc(s.title) + '</small>' + (R.is_me ? '<button type="button" class="sp-link" data-sp="unhighlight" data-sid="' + s.id + '">remove</button>' : '') + '</div>';
    }).join('') + '</div></div>';
  }


  /* ---------------------------------------------------------------- Koro room: vanish mode, broadcast, replies, reactions, pin */
  var VANISH = [[null, 'Off'], [3600, '1 hour'], [86400, '24 hours'], [604800, '7 days']];
  function vanishLabel(sec) { for (var i = 0; i < VANISH.length; i++) if (VANISH[i][0] === sec) return VANISH[i][1]; return Math.round(sec / 3600) + ' h'; }
  function koroRead(crewId) { return rpc('bv_crew_messages2', { p_crew: crewId, lim: 80 }); }

  function koroHeader(crewId, d) {
    var st = d.settings || {}, out = '';
    if (st.compat) return '';
    if (st.broadcast) out += '<span class="pill">📣 Broadcast — only the owner posts</span> ';
    if (st.vanish_seconds) out += '<span class="pill">⏳ Vanish: ' + esc(vanishLabel(st.vanish_seconds)) + '</span> ';
    if (st.is_owner) out += '<button type="button" class="btn sm ghost" data-sp="koro-settings" data-crew="' + crewId + '">⚙️ Koro settings</button>';
    var panel = st.is_owner ? '<form class="sp-koro-settings" data-sp="koro-settings-form" data-crew="' + crewId + '" hidden>' +
      '<label class="sp-seg"><span>Messages vanish after</span><select name="vanish">' + VANISH.map(function (v) { return '<option value="' + (v[0] === null ? '' : v[0]) + '" ' + (st.vanish_seconds === v[0] ? 'selected' : '') + '>' + v[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="sp-seg"><input type="checkbox" name="broadcast" ' + (st.broadcast ? 'checked' : '') + '> Broadcast Koro — only I post, everyone reacts</label>' +
      '<div class="row"><div class="spacer"></div><button class="btn sm" type="submit">Save</button></div></form>' : '';
    var pinned = d.pinned ? '<div class="sp-pinned"><span>📌</span><div style="flex:1;min-width:0"><b>@' + esc(d.pinned.handle) + '</b> ' + rich(d.pinned.body) + '</div>' +
      (st.is_owner ? '<button type="button" class="sp-link" data-sp="koro-unpin" data-crew="' + crewId + '">unpin</button>' : '') + '</div>' : '';
    return (out ? '<div class="row wrap" style="gap:6px;margin:6px 0">' + out + '</div>' : '') + panel + pinned;
  }

  function koroMessages(crewId, d) {
    var st = d.settings || {}, list = d.messages || [];
    if (!list.length) return '<div class="empty"><em>🪸</em>Say something first.</div>';
    return list.map(function (m) {
      if (m.kind === 'system') return '<div class="sp-sys">' + esc(m.body || '') + '</div>';
      if (st.compat) return '<div class="msg sp-msg ' + (m.author === S.user.id ? 'mine' : '') + '">' + (m.author !== S.user.id ? '<span class="who">' + esc(m.avatar_emoji || '🌺') + ' ' + esc(m.display_name || m.handle || '') + '</span>' : '') + rich((window.DimauCommsCore && window.DimauCommsCore.summary(m.body)) || m.body) + '</div>';
      var mine = m.author === S.user.id, canDelete = mine || st.is_owner;
      var text = m.deleted ? '<i class="sub">message removed</i>' : rich((window.DimauCommsCore && window.DimauCommsCore.summary(m.body)) || m.body);
      return '<div class="msg sp-msg ' + (mine ? 'mine' : '') + '" data-mid="' + m.id + '" data-crew="' + crewId + '">' +
        (!mine ? '<span class="who">' + esc(m.avatar_emoji || '🌺') + ' ' + esc(m.display_name || m.handle || '') + '</span>' : '') +
        (m.reply ? '<div class="sp-reply-quote">↩ <b>@' + esc(m.reply.handle) + '</b> ' + (m.reply.body === null ? '<i>removed</i>' : esc(m.reply.body)) + '</div>' : '') +
        '<div>' + text + '</div>' +
        '<div class="sp-msg-meta"><span class="ago">' + ago(m.created_at) + (m.expires_at ? ' · ⏳ ' + vanishLabel(Math.max(60, Math.round((new Date(m.expires_at) - Date.now()) / 1000))) + ' left' : '') + '</span>' +
        (!m.deleted ? (st.can_post !== false ? '<button type="button" class="sp-link" data-sp="koro-reply" data-handle="' + esc(m.handle) + '">reply</button>' : '') +
          '<span class="sp-msg-react" data-kind="message" data-id="' + m.id + '">' +
            REACTIONS.map(function (r) { var n = (m.reactions && m.reactions.counts && m.reactions.counts[r.key]) || 0; var on = m.reactions && m.reactions.mine === r.key; return (n || on) ? '<button type="button" class="sp-mini ' + (on ? 'on' : '') + '" data-sp="koro-react" data-reaction="' + (on ? '' : r.key) + '">' + r.icon + (n ? ' ' + n : '') + '</button>' : ''; }).join('') +
            '<button type="button" class="sp-mini" data-sp="koro-react-more" aria-label="React">＋</button>' +
            '<span class="sp-react-menu">' + REACTIONS.map(function (r) { return '<button type="button" data-sp="koro-react" data-reaction="' + r.key + '" title="' + r.name + '">' + r.icon + '</button>'; }).join('') + '</span></span>' +
          (st.is_owner ? '<button type="button" class="sp-link" data-sp="koro-pin">pin</button>' : '') +
          (canDelete ? '<button type="button" class="sp-link" data-sp="koro-delete">delete</button>' : '') : '') +
        '</div></div>';
    }).join('');
  }
  function koroReplyBar() { var r = S.koroReply; return '<div id="sp-reply-to" class="sp-reply-to" ' + (r ? 'data-mid="' + r.mid + '"' : 'hidden') + '><span>' + (r ? 'Replying to @' + esc(r.handle) : '') + '</span><button type="button" class="sp-link" data-sp="koro-reply-clear">✕</button></div>'; }
  function koroReplyId() { return S.koroReply ? Number(S.koroReply.mid) : null; }
  function koroReplyClear() { S.koroReply = null; var b = document.getElementById('sp-reply-to'); if (b) { b.hidden = true; b.removeAttribute('data-mid'); } }
  function koroComposerNote(d) { var st = d.settings || {}; return st.can_post === false ? '<p class="sub">📣 Only the owner posts in this Koro. You can react to any message.</p>' : ''; }


  /* ---------------------------------------------------------------- compatibility: work before the migrations are applied
     If the new database functions are not there yet, read the old way and shape the rows the same, so nothing breaks.
     Once the migrations run, these take the new path automatically. */
  function missingFn(err) { var m = (err && (err.message || '')) + ' ' + (err && err.code || ''); return /PGRST202|42883|Could not find the function|does not exist/i.test(m); }
  async function feedCompat(sb) {
    var r = await sb.rpc('bv_moments_feed2', { lim: 60 });
    if (!r.error || !missingFn(r.error)) return r;
    var old = await sb.rpc('bv_moments_feed', { lim: 60 });
    if (old.error) return old;
    return { data: (old.data || []).map(function (m) { m.audience = 'friends'; m.reactions = { counts: {}, mine: null }; m.comment_count = 0; m.edit_count = 0; m.repost_count = 0; m.poll = null; m.repost = null; m.compat = true; return m; }), error: null };
  }
  async function koroReadCompat(sb, crewId) {
    var r = await sb.rpc('bv_crew_messages2', { p_crew: crewId, lim: 80 });
    if (!r.error || !missingFn(r.error)) return r;
    var msgs = await sb.from('bv_crew_messages').select('*').eq('crew_id', crewId).order('created_at', { ascending: false }).limit(80);
    if (msgs.error) return msgs;
    var ids = []; (msgs.data || []).forEach(function (m) { if (ids.indexOf(m.author) < 0) ids.push(m.author); });
    var ppl = ids.length ? await sb.from('bv_profiles').select('id,handle,display_name,avatar_emoji').in('id', ids) : { data: [] };
    if (ppl.error) return ppl;
    var map = {}; (ppl.data || []).forEach(function (p) { map[p.id] = p; });
    return { data: { settings: { compat: true }, pinned: null, messages: (msgs.data || []).map(function (m) { var p = map[m.author] || {}; return { id: m.id, author: m.author, handle: p.handle, display_name: p.display_name, avatar_emoji: p.avatar_emoji, body: m.body, deleted: false, kind: 'text', created_at: m.created_at, expires_at: null, reactions: { counts: {}, mine: null }, reply: null }; }) }, error: null };
  }

  /* ---------------------------------------------------------------- one delegated click handler */
  function closest(el, sel) { while (el && el !== document) { if (el.matches && el.matches(sel)) return el; el = el.parentNode; } return null; }

  async function onClick(ev) {
    var media = closest(ev.target, '[data-media-url]:not([data-bv-bound])');
    if (media) { // same low-data loader skin-studio uses, for panels drawn after shell()
      media.dataset.bvBound = 'true';
      var img = document.createElement('img'); img.alt = 'Shared image'; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.src = media.dataset.mediaUrl;
      img.addEventListener('error', function () { img.replaceWith(media); media.textContent = 'Image unavailable · tap to retry'; });
      media.replaceWith(img); return;
    }
    var t = closest(ev.target, '[data-sp]'); if (!t) return;
    var act = t.dataset.sp, barEl = closest(t, '.sp-bar');
    try {
      if (act === 'room') { ev.preventDefault(); return openRoom(t.dataset.handle); }
      if (act === 'act-read-all') { try { var ids = Array.prototype.map.call(document.querySelectorAll('.sp-act.unread'), function (el) { return Number(el.dataset.id); }); await rpc('bv_activity_read', { p_ids: ids.length ? ids : null }); } catch (e) { return toast(say(e)); } document.querySelectorAll('.sp-act.unread').forEach(function (el) { el.classList.remove('unread'); }); t.remove(); return setBadge(0); }
      if (act === 'view') return open(t.dataset.view);
      if (act === 'react-open') { var w = closest(t, '.sp-react-wrap'); w.classList.toggle('open'); return; }
      if (act === 'react') {
        var rs = await rpc('bv_react', { p_kind: barEl.dataset.kind, p_id: Number(barEl.dataset.id), p_reaction: t.dataset.reaction || null });
        return refreshBar(barEl, rs);
      }
      if (act === 'reactors') {
        var who = await rpc('bv_reactors', { p_kind: barEl.dataset.kind, p_id: Number(barEl.dataset.id) });
        return toast(who.map(function (r) { return RX[r.reaction].icon + ' @' + r.handle; }).join('  ') || 'Nobody yet');
      }
      if (act === 'comments') { var panel = barEl.nextElementSibling; if (!panel.hidden) { panel.hidden = true; return; } return loadComments(barEl); }
      if (act === 'reply') { var f = closest(t, '.sp-comments').querySelector('[data-sp="comment-form"]'); f.parent.value = t.dataset.cid; f.body.placeholder = 'Reply to this…'; f.body.focus(); return; }
      if (act === 'comment-delete') { if (!confirm('Remove this reply?')) return; await rpc('bv_comment_delete', { p_id: Number(t.dataset.cid) }); return loadComments(closest(t, '.sp-comments').previousElementSibling); }
      if (act === 'comment-react') { var on = t.classList.contains('on'); await rpc('bv_react', { p_kind: 'comment', p_id: Number(t.dataset.cid), p_reaction: on ? null : 'vinaka' }); return loadComments(closest(t, '.sp-comments').previousElementSibling); }
      if (act === 'bookmark') {
        var saved = await rpc('bv_bookmark_toggle', { p_kind: barEl.dataset.kind, p_id: Number(barEl.dataset.id), p_folder: '' });
        t.classList.toggle('on', saved); t.textContent = saved ? '🔖 Saved' : '🔖'; return toast(saved ? 'Saved. Find it under More › Saved.' : 'Removed from saved.');
      }
      if (act === 'unsave') { var row = closest(t, '.sp-saved'); await rpc('bv_bookmark_toggle', { p_kind: row.dataset.kind, p_id: Number(row.dataset.id), p_folder: '' }); row.remove(); return; }
      if (act === 'repost') {
        var id = Number(barEl.dataset.id);
        var quote = prompt('Add your own words (leave blank to repost as it is):', '');
        if (quote === null) return;
        await rpc('bv_moment_repost', { p_id: id, p_quote: quote.trim() || null }); toast(quote.trim() ? 'Quoted to your friends.' : 'Reposted to your friends.'); return render();
      }
      if (act === 'edit') {
        var card = closest(t, '.sp-moment'), mid = Number(card.dataset.mid), bodyEl = card.querySelector('.body');
        var cur = bodyEl ? bodyEl.textContent : '', nb = prompt('Edit your moment (within an hour of posting, up to 5 times):', cur);
        if (nb === null) return;
        await rpc('bv_moment_edit', { p_id: mid, p_body: nb.trim(), p_media_url: null }); toast('Edited. The earlier version is kept in its history.'); return render();
      }
      if (act === 'history') {
        var h = await rpc('bv_moment_history', { p_id: Number(closest(t, '.sp-moment').dataset.mid) });
        var box = closest(t, '.sp-moment').querySelector('.sp-history');
        if (box) { box.remove(); return; }
        closest(t, '.sp-moment').insertAdjacentHTML('beforeend', '<div class="sp-history"><div class="sub">Earlier versions</div>' + h.map(function (v) { return '<div class="scrawl"><div class="ago">' + when(v.edited_at) + '</div>' + rich(v.body || '') + '</div>'; }).join('') + '</div>');
        return;
      }
      if (act === 'vote') {
        var pollEl = closest(t, '.sp-poll'), p = await rpc('bv_poll_vote', { p_poll: Number(pollEl.dataset.poll), p_choice: Number(t.dataset.choice) });
        pollEl.outerHTML = pollMarkup(p); return;
      }
      if (act === 'poll-toggle') { var b = document.getElementById('sp-poll-builder'); b.hidden = !b.hidden; if (!b.hidden) b.querySelector('input').focus(); return; }
      if (act === 'story-new') return storyComposer('story');
      if (act === 'note-new') return storyComposer('note');
      if (act === 'story-open') { var person = personFromStrip(t.dataset.author); if (person) storyViewer(person, 0); return; }
      if (act === 'viewer-close') { document.getElementById('sp-viewer').remove(); return; }
      if (act === 'viewer-next' || act === 'viewer-prev') {
        var v = document.getElementById('sp-viewer'), pp = personFromStrip(v.dataset.author);
        return storyViewer(pp, Number(v.dataset.index) + (act === 'viewer-next' ? 1 : -1));
      }
      if (act === 'story-react') { await rpc('bv_react', { p_kind: 'story', p_id: Number(t.dataset.sid), p_reaction: t.classList.contains('on') ? null : t.dataset.reaction }); t.parentNode.querySelectorAll('[data-sp="story-react"]').forEach(function (b) { b.classList.remove('on'); }); if (!t.classList.contains('on')) t.classList.add('on'); return toast('Reaction sent.'); }
      if (act === 'story-delete') { if (!confirm('Delete this story?')) return; await rpc('bv_story_delete', { p_id: Number(t.dataset.sid) }); document.getElementById('sp-viewer').remove(); return mountStrip(); }
      if (act === 'story-highlight') { var title = prompt('Name this highlight (it stays on your room):', ''); if (!title) return; await rpc('bv_story_highlight', { p_id: Number(t.dataset.sid), p_title: title.trim() }); return toast('Kept as a highlight on your room.'); }
      if (act === 'unhighlight') { await rpc('bv_story_highlight', { p_id: Number(t.dataset.sid), p_title: '' }); return render(); }
      if (act === 'close-toggle') {
        var turnOn = t.dataset.on !== '1';
        await rpc('bv_close_friend_set', { p_friend: t.dataset.id, p_on: turnOn });
        toast(turnOn ? 'Added to your close friends.' : 'Removed from close friends.');
        return t.dataset.stay ? render() : viewClose();
      }
      if (act === 'koro-settings') { var f = document.querySelector('[data-sp="koro-settings-form"]'); if (f) f.hidden = !f.hidden; return; }
      if (act === 'koro-unpin') { await rpc('bv_crew_pin', { p_crew: Number(t.dataset.crew), p_message: null }); return render(); }
      if (act === 'koro-pin') { var mm = closest(t, '.sp-msg'); await rpc('bv_crew_pin', { p_crew: Number(mm.dataset.crew), p_message: Number(mm.dataset.mid) }); return render(); }
      if (act === 'koro-delete') { if (!confirm('Remove this message for everyone?')) return; await rpc('bv_crew_message_delete', { p_id: Number(closest(t, '.sp-msg').dataset.mid) }); return render(); }
      if (act === 'koro-reply') {
        var mm2 = closest(t, '.sp-msg'), rb = document.getElementById('sp-reply-to');
        S.koroReply = { mid: mm2.dataset.mid, handle: t.dataset.handle };
        if (rb) { rb.hidden = false; rb.dataset.mid = mm2.dataset.mid; rb.querySelector('span').textContent = 'Replying to @' + t.dataset.handle; }
        var inp = document.getElementById('cm'); if (inp) inp.focus(); return;
      }
      if (act === 'koro-reply-clear') { koroReplyClear(); return; }
      if (act === 'koro-react-more') { closest(t, '.sp-msg-react').classList.toggle('open'); return; }
      if (act === 'koro-react') {
        var wrap = closest(t, '.sp-msg-react');
        await rpc('bv_react', { p_kind: 'message', p_id: Number(wrap.dataset.id), p_reaction: t.dataset.reaction || null });
        return render();
      }
      if (act === 'rsvp') { await rpc('bv_event_rsvp', { p_event: Number(closest(t, '.sp-event').dataset.eid), p_status: t.dataset.status }); return viewEvents(false); }
      if (act === 'event-cancel') { if (!confirm('Cancel this event for everyone?')) return; await rpc('bv_event_cancel', { p_event: Number(closest(t, '.sp-event').dataset.eid) }); return viewEvents(false); }
    } catch (e) { toast(say(e)); }
  }

  async function onSubmit(ev) {
    var f = closest(ev.target, 'form[data-sp]'); if (!f) return;
    ev.preventDefault();
    try {
      if (f.dataset.sp === 'comment-form') {
        var barEl = closest(f, '.sp-comments').previousElementSibling;
        await rpc('bv_comment', { p_kind: barEl.dataset.kind, p_id: Number(barEl.dataset.id), p_body: f.body.value.trim(), p_parent: f.parent.value ? Number(f.parent.value) : null });
        var cc = barEl.querySelector('[data-sp="comments"]'); if (cc) cc.textContent = '💬 ' + ((parseInt(cc.textContent.replace('💬', ''), 10) || 0) + 1);
        return loadComments(barEl);
      }
      if (f.dataset.sp === 'story-form') {
        var kind = f.dataset.kind;
        await rpc('bv_story_post', { p_body: f.body.value.trim(), p_media_url: f.media ? f.media.value.trim() || null : null, p_kind: kind, p_audience: f.audience ? f.audience.value : 'friends' });
        document.getElementById('sp-viewer').remove(); toast(kind === 'note' ? 'Note is up for 24 hours.' : 'Story shared for 24 hours.'); return mountStrip();
      }
      if (f.dataset.sp === 'koro-settings-form') {
        var v = f.vanish.value ? Number(f.vanish.value) : null;
        await rpc('bv_crew_settings', { p_crew: Number(f.dataset.crew), p_vanish_seconds: v, p_broadcast: f.broadcast.checked });
        toast('Koro settings saved.'); return render();
      }
      if (f.dataset.sp === 'event-form') {
        var aud = f.audience.value, crew = null; if (aud.indexOf('crew:') === 0) { crew = Number(aud.slice(5)); aud = 'crew'; }
        await rpc('bv_event_create', { p_title: f.title.value.trim(), p_starts_at: new Date(f.starts.value).toISOString(), p_ends_at: f.ends.value ? new Date(f.ends.value).toISOString() : null,
          p_place: f.place.value.trim() || null, p_about: f.about.value.trim() || null, p_audience: aud, p_crew: crew });
        toast('Event created. You are marked as going.'); return viewEvents(false);
      }
    } catch (e) { toast(say(e)); }
  }

  function init(o) {
    client = o.client; S = o.state; toast = o.toast; render = o.render; openRoom = o.openRoom; esc = o.esc; ago = o.ago; mediaMarkup = o.mediaMarkup; shell = o.shell;
    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    setTimeout(pollUnread, 1500); setInterval(pollUnread, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) pollUnread(); });
    document.addEventListener('click', function (ev) { if (!closest(ev.target, '.sp-react-wrap')) document.querySelectorAll('.sp-react-wrap.open').forEach(function (w) { w.classList.remove('open'); }); if (!closest(ev.target, '.sp-msg-react')) document.querySelectorAll('.sp-msg-react.open').forEach(function (w) { w.classList.remove('open'); }); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { var v = document.getElementById('sp-viewer'); if (v) v.remove(); } });
  }

  window.SotaPlus = { init: init, feed: feed, momentCard: momentCard, bar: bar, composerExtras: composerExtras, wireComposer: wireComposer, post: post,
    strip: strip, mountStrip: mountStrip, sidePanel: sidePanel, open: open, pollUnread: pollUnread, actLine: actLine, roomExtras: roomExtras, highlights: highlights, REACTIONS: REACTIONS,
    koroRead: koroRead, koroHeader: koroHeader, koroMessages: koroMessages, koroReplyBar: koroReplyBar, koroReplyId: koroReplyId, koroReplyClear: koroReplyClear, feedCompat: feedCompat, koroReadCompat: koroReadCompat, koroComposerNote: koroComposerNote };
})();
