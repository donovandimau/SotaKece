/* Sota Kece call stage: full-screen call view on top of the existing calling
 * engine. It only rearranges and styles what native-calls.js already builds;
 * it never touches media, signalling or permissions. */
(function () {
  'use strict';
  if (window.DimauCallStage) return;
  const EMOJI = ['👍', '❤️', '😂', '👏', '🙌', '🎉'];
  const PHONE = window.matchMedia('(max-width: 700px)');
  let live, grid, toolbar, sheet, picker, reactBtn, moreBtn, stageObs, pinned = null, audio = null, levels = new Map(), tick = null, channel = null, channelFor = '', lastSent = 0;

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function button(cls, label, onClick) { const b = el('button', cls, label); b.type = 'button'; b.setAttribute('aria-label', label); b.addEventListener('click', onClick); return b; }

  function tiles() { return grid ? [...grid.querySelectorAll('.nc-tile')] : []; }
  function self() { return grid && grid.querySelector('.nc-self'); }

  function hasVideo(video) {
    const s = video && video.srcObject;
    const track = s && typeof s.getVideoTracks === 'function' && s.getVideoTracks()[0];
    return !!(track && track.readyState === 'live' && track.enabled && !track.muted && video.videoWidth > 0);
  }

  function initial(tile) {
    const name = (tile.querySelector('.nc-person-label')?.textContent || '').trim();
    return (name.replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '•').toUpperCase();
  }

  function layout() {
    if (!grid) return;
    const all = tiles(), me = self(), phone = PHONE.matches;
    if (pinned && !pinned.isConnected) pinned = null;
    const pip = phone && all.length >= 2 && !pinned;
    const inGrid = all.filter(t => !(pip && t === me));
    const n = Math.max(1, inGrid.length);
    let cols, rows;
    if (phone) { cols = n <= 2 ? 1 : 2; rows = Math.ceil(n / cols); }
    else { cols = n === 1 ? 1 : n <= 4 ? 2 : 3; rows = Math.ceil(n / cols); }
    grid.style.setProperty('--cols', cols);
    grid.style.setProperty('--rows', rows);
    grid.dataset.layout = pinned ? 'spot' : 'grid';
    grid.dataset.n = String(all.length);
    let i = 0;
    for (const t of all) {
      t.classList.toggle('nc-pip', pip && t === me);
      t.classList.toggle('nc-pinned', t === pinned);
      const thumb = !!pinned && t !== pinned;
      t.classList.toggle('nc-thumb', thumb);
      t.style.setProperty('--i', thumb ? i++ : 0);
      t.dataset.initial = initial(t);
      t.classList.toggle('nc-novideo', !hasVideo(t.querySelector('video')));
      if (!t.dataset.stageReady) {
        t.dataset.stageReady = '1';
        t.tabIndex = 0;
        t.setAttribute('role', 'button');
        t.setAttribute('aria-label', 'Show ' + (t.querySelector('.nc-person-label')?.textContent || 'this person') + ' large');
        const toggle = () => { pinned = pinned === t ? null : t; layout(); };
        t.addEventListener('click', e => { if (!e.target.closest('button,select,input,a')) toggle(); });
        t.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      }
    }
  }

  // Who is talking: a soft ring on the loudest remote tile. Uses the audio that
  // is already playing; nothing is recorded or sent anywhere.
  function listen() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return; }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    for (const t of tiles()) {
      if (t.classList.contains('nc-self')) continue;
      const v = t.querySelector('video'), s = v && v.srcObject;
      if (!s || typeof s.getAudioTracks !== 'function' || !s.getAudioTracks().length) continue;
      const prior = levels.get(t);
      if (prior && prior.stream === s) continue;
      try {
        const src = audio.createMediaStreamSource(new MediaStream(s.getAudioTracks()));
        const an = audio.createAnalyser(); an.fftSize = 256; src.connect(an);
        levels.set(t, { stream: s, an, buf: new Uint8Array(an.fftSize), level: 0 });
      } catch (_) {}
    }
  }
  function speaking() {
    let best = null, top = 0.06;
    for (const [t, m] of levels) {
      if (!t.isConnected) { levels.delete(t); continue; }
      m.an.getByteTimeDomainData(m.buf);
      let sum = 0; for (const x of m.buf) sum += (x - 128) * (x - 128);
      m.level = m.level * 0.6 + Math.sqrt(sum / m.buf.length) / 40 * 0.4;
      if (m.level > top) { top = m.level; best = t; }
    }
    for (const t of tiles()) t.classList.toggle('nc-speaking', t === best);
  }

  // Emoji reactions travel over a broadcast channel named after the call. If
  // the channel cannot open, the reaction button stays hidden.
  function callId() { return (document.getElementById('nativeCalls')?.dataset.ncCall || '').toLowerCase(); }
  function client() {
    if (window.__sotaStageClient) return window.__sotaStageClient;
    const lib = window.supabase;
    if (!lib || typeof lib.createClient !== 'function') return null;
    window.__sotaStageClient = lib.createClient('https://xnxmumbvgtmlpenutlii.supabase.co', 'sb_publishable_WFJ3jKwImNhGdTdrS9W6mg_3CUSUYIM');
    return window.__sotaStageClient;
  }
  function joinReactions() {
    const id = callId();
    if (!/^[0-9a-f-]{36}$/.test(id)) { leaveReactions(); return; }
    if (channelFor === id) return;
    leaveReactions();
    const sb = client(); if (!sb) return;
    channelFor = id;
    channel = sb.channel('sk-call-react-' + id, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'react' }, ({ payload }) => {
      if (payload && EMOJI.includes(payload.e)) float(payload.e);
    }).subscribe(state => { if (reactBtn) reactBtn.hidden = state !== 'SUBSCRIBED'; });
  }
  function leaveReactions() {
    if (channel) { try { channel.unsubscribe(); } catch (_) {} }
    channel = null; channelFor = '';
    if (reactBtn) reactBtn.hidden = true;
  }
  function send(e) {
    const now = Date.now(); if (now - lastSent < 700) return; lastSent = now;
    float(e);
    if (channel) channel.send({ type: 'broadcast', event: 'react', payload: { e } }).catch(() => {});
    picker.hidden = true; reactBtn.setAttribute('aria-expanded', 'false');
  }
  function float(e) {
    if (!live) return;
    const f = el('span', 'nc-float', e);
    f.setAttribute('aria-hidden', 'true');
    f.style.setProperty('--x', (12 + Math.random() * 70).toFixed(1) + '%');
    live.appendChild(f);
    setTimeout(() => f.remove(), 2600);
  }

  function build() {
    live = document.getElementById('ncLive');
    grid = document.getElementById('ncGrid');
    toolbar = live && live.querySelector('.nc-toolbar');
    if (!live || !grid || !toolbar || live.dataset.stage) return !!live;
    live.dataset.stage = '1';

    // Everything that is not the picture or the main buttons goes in a "More" sheet.
    sheet = el('section', 'nc-sheet');
    sheet.id = 'ncSheet';
    sheet.hidden = true;
    sheet.setAttribute('aria-label', 'More call options');
    const head = el('div', 'nc-sheet-head');
    head.append(el('strong', null, 'More options'), button('nc-sheet-close', 'Close', () => openSheet(false)));
    sheet.appendChild(head);
    const keep = new Set([live.querySelector('.nc-live-heading'), document.getElementById('ncRecordingNotice'), document.getElementById('ncMutedWarning'), grid, toolbar]);
    for (const child of [...live.children]) if (!keep.has(child)) sheet.appendChild(child);
    const end = document.getElementById('ncEnd');
    if (end) sheet.insertBefore(end, sheet.children[1] || null);
    live.appendChild(sheet);

    picker = el('div', 'nc-picker');
    picker.hidden = true;
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', 'Send a reaction');
    for (const e of EMOJI) { const b = button('nc-emoji', e, () => send(e)); b.setAttribute('aria-label', 'Send ' + e); picker.appendChild(b); }
    live.insertBefore(picker, toolbar);

    reactBtn = button('nc-round nc-react', 'Reactions', () => { picker.hidden = !picker.hidden; reactBtn.setAttribute('aria-expanded', String(!picker.hidden)); });
    reactBtn.hidden = true;
    reactBtn.setAttribute('aria-expanded', 'false');
    if (!document.getElementById('ncMore')) {
      moreBtn = button('nc-round nc-more-btn', 'More options', () => openSheet(sheet.hidden));
      moreBtn.setAttribute('aria-controls', 'ncSheet');
      moreBtn.setAttribute('aria-expanded', 'false');
    }
    const leave = document.getElementById('ncLeave');
    toolbar.insertBefore(reactBtn, leave);
    if (moreBtn) toolbar.insertBefore(moreBtn, leave);
    for (const id of ['ncMute', 'ncVideo', 'ncShare', 'ncLeave']) document.getElementById(id)?.classList.add('nc-round');

    const share = document.getElementById('ncShare');
    const syncShare = () => { if (share) { share.dataset.on = /stop/i.test(share.textContent) ? 'true' : 'false'; share.setAttribute('aria-label', share.textContent.trim()); } };
    const syncLabels = () => { for (const id of ['ncMute', 'ncVideo', 'ncLeave']) { const b = document.getElementById(id); if (b) b.setAttribute('aria-label', b.textContent.trim()); } syncShare(); };
    new MutationObserver(syncLabels).observe(toolbar, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-pressed'] });
    syncLabels();

    new MutationObserver(() => { layout(); listen(); }).observe(grid, { childList: true });
    stageObs = new MutationObserver(onState);
    stageObs.observe(live, { attributes: true, attributeFilter: ['hidden'] });
    new MutationObserver(joinReactions).observe(document.getElementById('nativeCalls'), { attributes: true, attributeFilter: ['data-nc-call'] });
    PHONE.addEventListener ? PHONE.addEventListener('change', layout) : PHONE.addListener(layout);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet && !sheet.hidden) openSheet(false); });
    onState();
    return true;
  }

  function openSheet(open) {
    sheet.hidden = !open;
    moreBtn.setAttribute('aria-expanded', String(open));
    if (open) sheet.querySelector('.nc-sheet-close').focus();
    else moreBtn.focus();
  }

  function onState() {
    const on = live && !live.hidden;
    document.body.classList.toggle('nc-in-call', !!on);
    if (on) {
      layout(); listen(); joinReactions();
      if (!tick) tick = setInterval(() => { speaking(); if (Math.random() < 0.34) { layout(); listen(); } }, 300);
    } else {
      clearInterval(tick); tick = null; pinned = null;
      levels.clear(); leaveReactions();
      if (sheet) sheet.hidden = true;
      if (picker) picker.hidden = true;
    }
  }

  function start() {
    if (build()) return;
    const host = document.getElementById('nativeCalls');
    if (!host) return;
    const wait = new MutationObserver(() => { if (build()) wait.disconnect(); });
    wait.observe(host, { childList: true, subtree: true });
  }

  window.DimauCallStage = Object.freeze({ version: '1.0.0', layout: () => layout() });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
