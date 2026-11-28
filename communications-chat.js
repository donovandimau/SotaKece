/* Sota Kece Connect: modern chat layout on top of communications.js.
 * Only rearranges and decorates what the page already draws; saving,
 * loading and permissions stay in communications.js. */
(function () {
  'use strict';
  if (window.DimauChatSkin) return;
  const $ = id => document.getElementById(id);
  const PHONE = window.matchMedia('(max-width: 760px)');
  const EMOJI = ['😀','😂','🥰','😍','😊','😉','😎','🤔','😮','😢','😡','🙏','👍','👎','👏','🙌','💪','🤝','❤️','💙','🔥','🎉','✨','⭐','✅','❌','☕','🍽️','🌺','🌴','🌊','🏝️','⛪','🏉','🎶','📸','📍','📅','💬','👋'];
  const COLOURS = ['#2f7fd8', '#0f9d8a', '#d9822b', '#8f5bd6', '#d14d72', '#3a9b4b', '#c2410c', '#0e7490'];
  let ready = false;

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function iconButton(cls, label, onClick) { const b = el('button', 'sk-icon ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.addEventListener('click', onClick); return b; }
  function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) | 0; return Math.abs(h); }
  function initialOf(name) { return (String(name).replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '•').toUpperCase(); }

  // "Mere · 25 Oct 2026, 20:12" -> name, day, time
  function splitMeta(text) {
    const at = text.indexOf(' · ');
    const name = at > 0 ? text.slice(0, at) : 'Village member';
    const when = at > 0 ? text.slice(at + 3) : text;
    const comma = when.lastIndexOf(', ');
    return { name, day: comma > 0 ? when.slice(0, comma) : when, time: comma > 0 ? when.slice(comma + 2) : '' };
  }

  let msgWatch = null;
  function decorateMessages() {
    const host = $('messages');
    if (!host) return;
    // Pause watching while we add dividers, or our own changes would retrigger us.
    if (msgWatch) msgWatch.disconnect();
    const atEnd = host.scrollHeight - host.scrollTop - host.clientHeight < 120;
    try { decorate(host); if (atEnd) host.scrollTop = host.scrollHeight; } finally { if (msgWatch) { msgWatch.takeRecords(); msgWatch.observe(host, { childList: true }); } }
  }
  function decorate(host) {
    let lastDay = '', lastName = '';
    for (const item of [...host.children]) {
      if (!item.classList.contains('message')) {
        if (item.classList.contains('sk-day')) item.remove();
        continue;
      }
      if (!item.dataset.sk) {
        const meta = item.querySelector('.message-meta'), body = item.querySelector('.message-body');
        if (!meta || !body) continue;
        const m = splitMeta(meta.textContent.trim());
        item.dataset.sk = '1'; item.dataset.day = m.day; item.dataset.name = m.name;
        const mine = item.classList.contains('mine');
        const av = el('span', 'sk-av', initialOf(m.name));
        av.setAttribute('aria-hidden', 'true');
        av.style.background = COLOURS[hash(m.name) % COLOURS.length];
        const bubble = el('div', 'sk-bubble');
        if (!mine) bubble.appendChild(el('span', 'sk-name', m.name));
        bubble.appendChild(body);
        bubble.appendChild(el('time', 'sk-time', m.time));
        meta.classList.add('sk-sr');
        item.append(av, bubble);
      }
      const day = item.dataset.day, name = item.dataset.name + (item.classList.contains('mine') ? '#me' : '');
      if (day !== lastDay) {
        const sep = el('div', 'sk-day', day);
        sep.setAttribute('role', 'separator');
        host.insertBefore(sep, item);
        lastDay = day; lastName = '';
      }
      item.classList.toggle('sk-cont', name === lastName);
      lastName = name;
    }
  }

  function filterGroups() {
    const q = ($('skSearch')?.value || '').trim().toLowerCase();
    for (const b of document.querySelectorAll('#groups .group-button')) b.hidden = !!q && !b.textContent.toLowerCase().includes(q);
  }

  function syncDetails() {
    const name = $('roomName')?.textContent || '', count = $('memberCount')?.textContent || '';
    const title = $('skDetailName'), sub = $('skDetailCount'), av = $('skDetailAv'), head = $('skHeadAv');
    const emoji = document.querySelector('#groups .group-button.selected .group-icon')?.textContent || initialOf(name);
    // Only write when something changed, so the watchers don't wake each other.
    const set = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
    set(title, name); set(sub, count); set(av, emoji); set(head, emoji);
  }

  function openRoom(open) { document.body.classList.toggle('sk-room-open', !!open); }

  function startCall(kind) {
    $('tab-calls')?.click();
    const b = $(kind === 'video' ? 'ncStartVideo' : 'ncStartAudio');
    if (b && !b.disabled && !b.hidden) b.click();
    $('panel-calls')?.scrollIntoView({ block: 'nearest' });
  }

  function insertAtCaret(field, text) {
    const s = field.selectionStart ?? field.value.length, e = field.selectionEnd ?? s;
    field.value = field.value.slice(0, s) + text + field.value.slice(e);
    const p = s + text.length; field.setSelectionRange(p, p); field.focus();
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function grow(field) { field.style.height = 'auto'; field.style.height = Math.min(field.scrollHeight, 140) + 'px'; }

  function build() {
    const connected = $('connected'), side = document.querySelector('#connected .sidebar'), groups = $('groups'), heading = document.querySelector('.room-heading'), form = $('sendChat'), text = $('chatText'), messages = $('messages');
    if (!connected || !side || !groups || !heading || !form || !text || !messages) return false;
    document.body.classList.add('sk-chat');

    // Left: search the conversation list.
    const search = el('input', 'sk-search');
    search.id = 'skSearch'; search.type = 'search'; search.placeholder = 'Search your Village'; search.setAttribute('aria-label', 'Search your Village');
    search.addEventListener('input', filterGroups);
    groups.parentNode.insertBefore(search, groups);
    new MutationObserver(() => { filterGroups(); syncDetails(); }).observe(groups, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // Phones show the list first, then the chat on its own screen.
    groups.addEventListener('click', e => {
      const b = e.target.closest('.group-button'); if (!b) return;
      if (b.classList.contains('selected')) { e.stopImmediatePropagation(); e.preventDefault(); }
      openRoom(true);
      setTimeout(() => { if (PHONE.matches) text.blur(); }, 0);
    }, true);

    // Centre: chat header with avatar, back, voice and video.
    const back = iconButton('sk-back', 'Back to your Village', () => openRoom(false));
    const headAv = el('span', 'sk-head-av'); headAv.id = 'skHeadAv'; headAv.setAttribute('aria-hidden', 'true');
    heading.prepend(back, headAv);
    const actions = el('div', 'sk-head-actions');
    actions.append(iconButton('sk-call', 'Start a voice call', () => startCall('audio')), iconButton('sk-video', 'Start a video call', () => startCall('video')));
    const invite = $('inviteGroup');
    if (invite) { invite.classList.add('sk-icon', 'sk-invite'); invite.setAttribute('aria-label', 'Invite to Village'); invite.title = 'Invite to Village'; actions.append(invite); }
    heading.append(actions);
    new MutationObserver(syncDetails).observe(heading, { childList: true, subtree: true, characterData: true });

    // Composer: one line that grows, Enter to send, emoji picker, round send button.
    text.rows = 1; text.placeholder = 'Write your message';
    text.addEventListener('input', () => grow(text));
    text.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !PHONE.matches) { e.preventDefault(); if (text.value.trim()) form.requestSubmit(); }
    });
    form.addEventListener('submit', () => setTimeout(() => grow(text), 50));
    const send = form.querySelector('button[type=submit]');
    if (send) { send.classList.add('sk-send'); send.setAttribute('aria-label', 'Send message'); send.title = 'Send message'; }
    const row = el('div', 'sk-compose-row');
    const picker = el('div', 'sk-emoji-pop'); picker.id = 'skEmoji'; picker.hidden = true; picker.setAttribute('role', 'dialog'); picker.setAttribute('aria-label', 'Pick an emoji');
    for (const e of EMOJI) { const b = el('button', 'sk-emo', e); b.type = 'button'; b.setAttribute('aria-label', e); b.addEventListener('click', () => { insertAtCaret(text, e); picker.hidden = true; emo.setAttribute('aria-expanded', 'false'); }); picker.appendChild(b); }
    const emo = iconButton('sk-emoji', 'Add an emoji', () => { picker.hidden = !picker.hidden; emo.setAttribute('aria-expanded', String(!picker.hidden)); });
    emo.setAttribute('aria-expanded', 'false'); emo.setAttribute('aria-controls', 'skEmoji');
    text.parentNode.insertBefore(row, text);
    row.append(emo, text);
    if (send) row.append(send);
    form.appendChild(picker);
    document.addEventListener('pointerdown', e => { if (!picker.hidden && !e.target.closest('#skEmoji,.sk-emoji')) { picker.hidden = true; emo.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !picker.hidden) { picker.hidden = true; emo.focus(); } });

    // Right (wide screens): details and shortcuts for the open Village.
    const details = el('aside', 'sk-details panel');
    details.setAttribute('aria-label', 'Village details');
    const card = el('div', 'sk-detail-card');
    const dav = el('span', 'sk-detail-av'); dav.id = 'skDetailAv'; dav.setAttribute('aria-hidden', 'true');
    const dn = el('h3', 'sk-detail-name'); dn.id = 'skDetailName';
    const dc = el('p', 'sk-detail-count'); dc.id = 'skDetailCount';
    card.append(dav, dn, dc);
    const quick = el('div', 'sk-quick');
    const q = (cls, label, fn) => { const b = el('button', 'sk-quick-btn ' + cls, label); b.type = 'button'; b.addEventListener('click', fn); return b; };
    quick.append(q('sk-q-call', 'Voice call', () => startCall('audio')), q('sk-q-video', 'Video call', () => startCall('video')), q('sk-q-disc', 'Discussions', () => $('tab-discussions')?.click()), q('sk-q-board', 'Board', () => $('tab-board')?.click()));
    const note = el('p', 'sk-detail-note', 'Messages are shared with members of this Village only. Camera and microphone stay off until you join a call.');
    details.append(card, quick, note);
    connected.appendChild(details);

    msgWatch = new MutationObserver(decorateMessages); msgWatch.observe(messages, { childList: true });
    const watch = () => {
      const on = !connected.hidden;
      document.body.classList.toggle('sk-connected', on);
      const room = $('groupWorkspace'), hasRoom = room && !room.hidden;
      document.body.classList.toggle('sk-has-room', !!hasRoom);
      if (!hasRoom) openRoom(false);
    };
    new MutationObserver(watch).observe(connected, { attributes: true, attributeFilter: ['hidden'] });
    if ($('groupWorkspace')) new MutationObserver(watch).observe($('groupWorkspace'), { attributes: true, attributeFilter: ['hidden'] });
    watch(); decorateMessages(); syncDetails(); grow(text);
    return true;
  }

  function start() {
    if (ready) return;
    if (build()) { ready = true; return; }
    const wait = new MutationObserver(() => { if (build()) { ready = true; wait.disconnect(); } });
    wait.observe(document.body, { childList: true, subtree: true });
  }
  window.DimauChatSkin = Object.freeze({ version: '1.0.0' });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
