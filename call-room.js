/* Sota Kece direct calls: choose voice or video, then join.
 * Anyone with the link can join (like a meeting link), up to 6 people.
 * Signalling runs over a realtime channel named after the room; media goes
 * person-to-person through native-call-media.js. Nothing is recorded. */
(function () {
  'use strict';
  const URL_ = 'https://aqfzpaczyodhugsgqvxi.supabase.co', KEY = 'sb_publishable_DvpX2PSuPtxE3IqWUlRZfQ_YP2qLZtF';
  const MAX = 6, UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let mode = params.get('mode') === 'audio' ? 'audio' : 'video';
  const me = crypto.randomUUID();
  let room = location.hash.slice(1).toLowerCase();
  if (!UUID.test(room)) { room = crypto.randomUUID(); history.replaceState(null, '', location.pathname + location.search + '#' + room); }
  let link = location.origin + '/call.html?mode=' + mode + '#' + room;

  let stream = null, camTrack = null, screenTrack = null, engine = null, channel = null, sb = null, left = false;
  let micOn = true, camOn = mode === 'video';
  const tiles = new Map(), names = new Map();
  let myName = '';
  try { myName = localStorage.getItem('sk-call-name') || ''; } catch (_) {}

  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function pill(text) { $('ncConnection').textContent = text; }
  function toast(text) { const t = $('crToast'); t.textContent = text; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600); }
  function displayName() { return (myName || 'Guest').slice(0, 40); }

  function paintButtons() {
    const m = $('ncMute'), v = $('ncVideo'), s = $('ncShare');
    m.textContent = micOn ? 'Mute' : 'Unmute'; m.setAttribute('aria-pressed', String(micOn));
    v.textContent = camOn ? 'Turn camera off' : 'Turn camera on'; v.setAttribute('aria-pressed', String(camOn));
    s.textContent = screenTrack ? 'Stop sharing' : 'Share screen';
  }
  function updateCount() {
    const n = tiles.size + 1;
    pill(n === 1 ? 'Waiting for others · tap Invite' : n + ' in the call');
    $('crWaiting').hidden = n > 1;
  }

  function tileFor(peer) {
    let t = tiles.get(peer);
    if (t) return t;
    const item = el('article', 'nc-tile'), video = el('video'), label = el('span', 'nc-person-label', names.get(peer) || 'Guest'), state = el('small', 'nc-peer-state', 'Connecting');
    video.autoplay = true; video.playsInline = true;
    item.append(video, label, state);
    $('ncGrid').appendChild(item);
    t = { item, video, label, state };
    tiles.set(peer, t);
    updateCount();
    return t;
  }
  function dropPeer(peer) {
    const t = tiles.get(peer);
    if (t) { if (t.audio) { t.audio.pause(); t.audio.srcObject = null; } t.item.remove(); tiles.delete(peer); }
    if (engine) try { engine.removePeer(peer); } catch (_) {}
    updateCount();
  }

  async function config() {
    try {
      const r = await fetch('/api/guest-call-config?room=' + room, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d.iceServers)) return d.iceServers; }
    } catch (_) {}
    return [{ urls: ['stun:stun.cloudflare.com:3478'] }];
  }

  async function getMedia() {
    const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    const video = { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };
    try { return await navigator.mediaDevices.getUserMedia({ audio, video: mode === 'video' ? video : false }); }
    catch (e) {
      if (mode === 'video') { try { camOn = false; toast('Camera unavailable. Joined with sound only.'); return await navigator.mediaDevices.getUserMedia({ audio, video: false }); } catch (_) {} }
      micOn = false; camOn = false;
      toast(e && e.name === 'NotAllowedError' ? 'Microphone and camera are blocked. Allow them in your browser to talk.' : 'No microphone found. You can still watch and listen.');
      return new MediaStream();
    }
  }

  function connectPeer(peer) {
    if (!engine || peer === me) return;
    tileFor(peer);
    // addPeer is safe to repeat; the lower ID makes the offer so both sides never collide.
    try { engine.addPeer(peer, { initiator: me < peer }); } catch (_) {}
  }

  function onPresence() {
    const state = channel.presenceState(), present = new Map();
    for (const [key, metas] of Object.entries(state)) {
      const meta = metas && metas[0] || {};
      present.set(key, meta);
      names.set(key, String(meta.name || 'Guest').slice(0, 40));
    }
    // Over the limit: the most recent arrivals step back.
    const order = [...present.entries()].sort((a, b) => (a[1].at || 0) - (b[1].at || 0) || (a[0] < b[0] ? -1 : 1)).map(e => e[0]);
    if (order.indexOf(me) >= MAX) { leave('This call is full (6 people). Try again later.'); return; }
    for (const peer of order.slice(0, MAX)) if (peer !== me) connectPeer(peer);
    for (const peer of [...tiles.keys()]) if (!present.has(peer)) dropPeer(peer);
    for (const [peer, t] of tiles) t.label.textContent = names.get(peer) || 'Guest';
  }

  async function join() {
    pill(mode === 'video' ? 'Starting your camera…' : 'Starting your microphone…');
    const media = await getMedia();
    if(left){media.getTracks().forEach(track=>track.stop());return;}
    stream = media;
    camTrack = stream.getVideoTracks()[0] || null;
    stream.getAudioTracks().forEach(t => { t.enabled = micOn; });
    if (camTrack) camTrack.enabled = camOn;
    $('ncSelf').srcObject = stream;
    paintButtons();
    const iceServers = await config();
    if (left) return;
    sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 40 } } });
    channel = sb.channel('guest-call-' + room, { config: { presence: { key: me }, broadcast: { self: false } } });
    engine = window.DimauCallMedia.create({
      localStream: stream, localId: me, iceServers, maxPeers: MAX - 1, lowData: false, statsIntervalMs: 0,
      sendSignal: async (peer, signal) => { if (channel) await channel.send({ type: 'broadcast', event: 'sig', payload: { from: me, to: peer, signal } }); },
      onRemoteStream: (peer, media) => {
        const t = tileFor(peer);
        if (t.video.srcObject === media) return;
        // Pictures play silently at once; sound plays separately so a browser
        // that holds back sound never leaves the picture frozen.
        t.video.muted = true; t.video.srcObject = media; t.video.play().catch(() => {});
        if (!t.audio) { t.audio = new Audio(); t.audio.autoplay = true; }
        t.audio.srcObject = media;
        t.audio.play().catch(() => { $('crSound').hidden = false; });
      },
      onPeerState: (peer, state) => { const t = tiles.get(peer); if (t) t.state.textContent = state === 'connected' ? '' : state === 'failed' ? 'Connection lost' : 'Connecting'; },
      onError: () => {}
    });
    channel
      .on('broadcast', { event: 'sig' }, ({ payload }) => {
        if (!payload || payload.to !== me || typeof payload.from !== 'string' || payload.from === me) return;
        if (!tiles.has(payload.from)) connectPeer(payload.from);
        Promise.resolve(engine.handleSignal(payload.from, payload.signal)).catch(() => {});
      })
      .on('presence', { event: 'sync' }, onPresence)
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') { await channel.track({ name: displayName(), at: Date.now() }); updateCount(); document.getElementById('nativeCalls').dataset.ncCall = room; }
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') pill('Reconnecting…');
      });
    if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
  }

  function leave(message) {
    if (left) return; left = true;
    try { channel && channel.untrack(); channel && sb.removeChannel(channel); } catch (_) {}
    try { engine && engine.close(); } catch (_) {}
    [stream, screenTrack && new MediaStream([screenTrack])].forEach(s => s && s.getTracks().forEach(t => t.stop()));
    for (const t of tiles.values()) if (t.audio) { t.audio.pause(); t.audio.srcObject = null; }
    document.getElementById('nativeCalls').dataset.ncCall = '';
    $('ncLive').hidden = true;
    $('crEnded').hidden = false;
    $('crEndedText').textContent = message || 'You left the call.';
  }

  async function invite() {
    const data = { title: 'Join my Sota Kece call', text: 'Tap to join my ' + (mode === 'video' ? 'video' : 'voice') + ' call', url: link };
    try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(link); toast('Call link copied. Send it to anyone you want to join.'); }
    catch (_) { $('crLink').hidden = false; $('crLinkField').value = link; $('crLinkField').select(); }
  }

  async function toggleCamera() {
    if (!camTrack) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
        if(left){s.getTracks().forEach(track=>track.stop());return;}
        camTrack = s.getVideoTracks()[0]; stream.addTrack(camTrack);
        if (engine) await engine.replaceVideoTrack(camTrack);
        $('ncSelf').srcObject = stream; camOn = true;
      } catch (_) { toast('Camera could not start. Check your browser permissions.'); }
    } else { camOn = !camOn; camTrack.enabled = camOn; if (engine) engine.setVideoEnabled(camOn); }
    paintButtons();
  }

  async function toggleShare() {
    if (screenTrack) { screenTrack.stop(); return; }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if(left){s.getTracks().forEach(track=>track.stop());return;}
      screenTrack = s.getVideoTracks()[0];
      if (engine) await engine.replaceVideoTrack(screenTrack);
      $('ncSelf').srcObject = s;
      screenTrack.addEventListener('ended', async () => { screenTrack = null; if (engine) await engine.replaceVideoTrack(camTrack || null).catch(() => {}); $('ncSelf').srcObject = stream; paintButtons(); });
      paintButtons();
    } catch (_) {}
  }

  function start() {
    $('crLobby').hidden = true;
    if($('crTitle'))$('crTitle').textContent = mode === 'video' ? 'Video call' : 'Voice call';
    $('ncLiveTitle').textContent = mode === 'video' ? 'Video call' : 'Voice call';
    $('ncMute').addEventListener('click', () => { micOn = !micOn; stream && stream.getAudioTracks().forEach(t => { t.enabled = micOn; }); if (engine) engine.setAudioEnabled(micOn); paintButtons(); });
    $('ncVideo').addEventListener('click', toggleCamera);
    $('ncShare').addEventListener('click', toggleShare);
    $('ncLeave').addEventListener('click', () => leave());
    $('crInvite').addEventListener('click', invite);
    $('crInvite2').addEventListener('click', invite);
    $('crRejoin').addEventListener('click', () => location.reload());
    $('crSound').addEventListener('click', () => { for (const t of tiles.values()) { t.video.play().catch(() => {}); if (t.audio) t.audio.play().catch(() => {}); } $('crSound').hidden = true; });
    const nameField = $('crName');
    nameField.value = myName;
    nameField.addEventListener('change', async () => {
      myName = nameField.value.trim().slice(0, 40);
      try { localStorage.setItem('sk-call-name', myName); } catch (_) {}
      if (channel) await channel.track({ name: displayName(), at: Date.now() });
      toast('Name updated.');
    });
    // Browsers hold back call sound until the first tap; any tap turns it on.
    const unlock = () => { for (const t of tiles.values()) if (t.audio) t.audio.play().then(() => { $('crSound').hidden = true; }).catch(() => {}); };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
    window.addEventListener('pagehide', () => leave());
    $('ncLive').hidden = false;
    paintButtons(); updateCount();
    join().catch(() => pill('The call could not start. Check your connection and reload.'));
  }

  function prepareLobby(){
    $('ncLive').hidden=true;
    const name=$('crLobbyName');name.value=myName;
    const choices=[...document.querySelectorAll('[data-call-mode]')];
    function choose(value){mode=value;camOn=mode==='video';for(const button of choices)button.setAttribute('aria-pressed',String(button.dataset.callMode===mode));$('crJoin').textContent='Join '+(mode==='video'?'video':'voice')+' call ↗';}
    for(const button of choices)button.addEventListener('click',()=>choose(button.dataset.callMode));
    choose(mode);
    $('crJoin').addEventListener('click',()=>{
      $('crJoin').disabled=true;myName=name.value.trim().slice(0,40);
      try{localStorage.setItem('sk-call-name',myName);}catch(_){}
      const url=new URL(location.href);url.searchParams.set('mode',mode);history.replaceState(null,'',url.pathname+url.search+url.hash);
      link=location.origin+'/call.html?mode='+mode+'#'+room;start();
    },{once:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepareLobby, { once: true }); else prepareLobby();
})();
