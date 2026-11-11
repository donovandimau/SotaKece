/* Sota Kece — Sere: make a photo sing.
   Pick a photo and a sound, slide to the part you want (up to 60 seconds), and post. The phone does
   the heavy lifting before anything is sent: the photo is shrunk to 1024px and the sound is cut and
   re-encoded to a small 16 kHz WAV, so a 50 MB song leaves the phone as about 2 MB. The row is
   written by bv_sere_create, the files go straight to the member's own storage folders, /api/sere
   starts the render, and Realtime brings progress back here. When the render lands the database
   posts it to the Talanoa Wall by itself.
   Rules: supabase/migrations/20261109200000_sota_sere.sql. Server: api/sere.js, api/sere-callback.js. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.SotaSere = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var LIMITS = {
    audio: { maxBytes: 50 * 1024 * 1024, maxMs: 600000, windowMs: 60000, rate: 16000 },
    image: { maxBytes: Math.round(4.7 * 1024 * 1024), minSide: 256, maxSide: 4096, aspectMin: 0.5, aspectMax: 2.0, outSide: 1024 }
  };
  var SAY = {
    NOT_SIGNED_IN: 'Sign in first.', OUT_OF_SERE: 'Five a day — more tomorrow.', BAD_IMAGE: 'Use a JPG or PNG photo.',
    BAD_AUDIO: 'That sound is too long or unreadable.', BAD_WINDOW: 'Pick at least one second of sound.',
    GONE: 'That sere is gone.', NOT_FRIENDS: 'Add them as a mate to tip them.', OUT_OF_GIFTS: 'No gifts left today.',
    SELF_GIFT: 'You cannot tip yourself.', NOT_YOURS: 'That is not yours to remove.'
  };
  var VOICES = [['bella', 'Bella'], ['sarah', 'Sarah'], ['nicole', 'Nicole'], ['emma', 'Emma (UK)'], ['isabella', 'Isabella (UK)'], ['adam', 'Adam'], ['michael', 'Michael'], ['george', 'George (UK)'], ['lewis', 'Lewis (UK)']];
  var ENGINES = [['quick', 'Quick', 'about a minute · lips move'], ['lifelike', 'Lifelike', 'several minutes · head, eyes and expression move']];
  var GIFTS = [['bilo', '🥥', 'Bilo'], ['salusalu', '🌺', 'Salusalu'], ['lovo', '🔥', 'Lovo'], ['bua', '🌼', 'Bua']];
  var SCENES_FALLBACK = [{ id: 'none', label: 'As it is' }, { id: 'studio-soft', label: 'Studio' }, { id: 'golden-hour', label: 'Golden hour' }, { id: 'neon', label: 'Neon night' }, { id: 'bure-night', label: 'Bure night' }, { id: 'beach-day', label: 'Beach day' }];

  var client, S, toast, esc, go;
  var st = fresh(), wired = false, played = {};

  function fresh() {
    return { open: false, step: 'pick', mode: 'sing', image: null, imageMeta: null, audio: null, audioMeta: null, startMs: 0, scene: 'none',
             engine: 'quick', text: '', voice: 'bella', caption: '', remixOf: null, id: null, pct: 0, status: null, error: null, channel: null, scenes: null, mine: [] };
  }
  function say(err, fallback) {
    var m = (err && err.message) || String(err || '');
    for (var k in SAY) if (m.indexOf(k) !== -1) return SAY[k];
    return fallback || 'That did not go through. Try again in a moment.';
  }
  async function rpc(name, args) { var r = await client.rpc(name, args || {}); if (r.error) throw r.error; return r.data; }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function fmt(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  /* ---------------------------------------------------------------- pure helpers (also used by tests) */
  /** Where the render window sits for a given start, clipped to the track. */
  function pickWindow(startMs, durationMs, windowMs) {
    windowMs = windowMs || LIMITS.audio.windowMs;
    var maxStart = Math.max(0, durationMs - windowMs);
    var s = Math.min(Math.max(0, Math.round(startMs || 0)), maxStart);
    return { startMs: s, endMs: Math.min(s + windowMs, durationMs) };
  }
  /** Shape check for a portrait: size, side lengths and a portrait-to-mild-landscape aspect ratio. */
  function checkImageDims(w, h, bytes) {
    var L = LIMITS.image;
    if (bytes > L.maxBytes) return 'Photo over 4.7 MB.';
    if (Math.min(w, h) < L.minSide) return 'Photo too small (at least 256px).';
    if (Math.max(w, h) > L.maxSide) return 'Photo too large (at most 4096px).';
    var r = w / h;
    if (r < L.aspectMin || r > L.aspectMax) return 'Use a portrait or square photo.';
    return null;
  }
  /** 16-bit PCM WAV from Float32 mono samples. */
  function encodeWav(samples, rate) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0, o = 44; i < n; i++, o += 2) { var x = Math.max(-1, Math.min(1, samples[i])); v.setInt16(o, x < 0 ? x * 32768 : x * 32767, true); }
    return buf;
  }
  /** Mix any channel count down to one, from startMs for lengthMs. */
  function mixWindow(buffer, startMs, lengthMs) {
    var rate = buffer.sampleRate, from = Math.floor(startMs / 1000 * rate), len = Math.min(Math.floor(lengthMs / 1000 * rate), buffer.length - from);
    var out = new Float32Array(Math.max(0, len)), ch = buffer.numberOfChannels;
    for (var c = 0; c < ch; c++) { var d = buffer.getChannelData(c); for (var i = 0; i < len; i++) out[i] += d[from + i] / ch; }
    return out;
  }

  /* ---------------------------------------------------------------- media prep (browser only) */
  async function prepImage(file) {
    if (!file) throw new Error('Choose a photo.');
    if (!/^image\/(jpeg|png)$/.test(file.type) && !/\.(jpe?g|jfif|png)$/i.test(file.name || '')) throw new Error('BAD_IMAGE');
    var bmp = await createImageBitmap(file);
    var w = bmp.width, h = bmp.height, bad = checkImageDims(w, h, file.size);
    if (bad) { bmp.close(); throw new Error(bad); }
    var scale = Math.min(1, LIMITS.image.outSide / Math.max(w, h)), cw = Math.round(w * scale), ch = Math.round(h * scale);
    var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    cv.getContext('2d').drawImage(bmp, 0, 0, cw, ch); bmp.close();
    var blob = await new Promise(function (res) { cv.toBlob(res, 'image/jpeg', 0.86); });
    if (!blob) throw new Error('BAD_IMAGE');
    return { blob: blob, ext: 'jpg', width: cw, height: ch, previewUrl: URL.createObjectURL(blob) };
  }
  async function decodeAudio(file) {
    if (!file) throw new Error('Choose a sound.');
    if (file.size > LIMITS.audio.maxBytes) throw new Error('Sound over 50 MB.');
    if (!/^audio\/(mpeg|mp3|wav|x-wav|wave)$/.test(file.type) && !/\.(mp3|wav)$/i.test(file.name || '')) throw new Error('Use an MP3 or WAV.');
    var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    // Decoding into a 16 kHz context keeps a 10-minute song to a few tens of MB instead of 200 MB.
    var ctx = new AC(1, 16, LIMITS.audio.rate);
    var ab = await file.arrayBuffer();
    var buffer = await new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, function () { rej(new Error('BAD_AUDIO')); }); });
    var ms = Math.round(buffer.duration * 1000);
    if (ms < 1000 || ms > LIMITS.audio.maxMs) throw new Error('BAD_AUDIO');
    return { buffer: buffer, durationMs: ms, previewUrl: URL.createObjectURL(file), name: String(file.name || '').replace(/\.[^.]+$/, '').slice(0, 60) };
  }
  function cutAudio(meta, startMs) {
    var win = pickWindow(startMs, meta.durationMs);
    var wav = encodeWav(mixWindow(meta.buffer, win.startMs, win.endMs - win.startMs), meta.buffer.sampleRate);
    return { blob: new Blob([wav], { type: 'audio/wav' }), startMs: win.startMs, endMs: win.endMs };
  }
  function putWithProgress(bucket, path, blob, onPct) {
    // supabase-js uploads have no progress events; a plain PUT to the storage endpoint does.
    return client.auth.getSession().then(function (r) {
      var token = r && r.data && r.data.session && r.data.session.access_token;
      if (!token) throw new Error('NOT_SIGNED_IN');
      var base = client.storageUrl || (client.supabaseUrl + '/storage/v1');
      return new Promise(function (res, rej) {
        var x = new XMLHttpRequest();
        x.open('POST', base + '/object/' + bucket + '/' + path);
        x.setRequestHeader('Authorization', 'Bearer ' + token);
        x.setRequestHeader('apikey', client.supabaseKey || '');
        x.setRequestHeader('Content-Type', blob.type);
        x.setRequestHeader('Cache-Control', 'max-age=3600');
        x.upload.onprogress = function (e) { if (e.lengthComputable && onPct) onPct(e.loaded / e.total); };
        x.onload = function () { x.status < 300 ? res() : rej(new Error('upload ' + x.status)); };
        x.onerror = function () { rej(new Error('Connection interrupted.')); };
        x.send(blob);
      });
    });
  }

  /* ---------------------------------------------------------------- the run */
  async function authed(body) {
    var sess = await client.auth.getSession(), tok = sess && sess.data && sess.data.session && sess.data.session.access_token;
    if (!tok) throw new Error('NOT_SIGNED_IN');
    var r = await fetch('/api/sere', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || 'That did not go through.');
    return j;
  }
  async function create() {
    var say = st.mode === 'say' && !st.remixOf;
    if (!st.image) { toast('Choose a photo.'); return; }
    if (say && st.text.trim().length < 2) { toast('Type a few words first.'); return; }
    if (!say && !st.audio && !st.remixOf) { toast('Choose a sound.'); return; }
    st.step = 'working'; st.pct = 0; st.error = null; paint();
    try {
      var row, cut = null;
      if (say) {
        // Words → voice happens on the server (it also writes the pending row and uploads the sound).
        row = await authed({ action: 'speak', text: st.text.trim(), voice: st.voice, imageExt: st.image.ext, scene: st.scene, caption: st.caption || null, engine: st.engine });
      } else {
        cut = st.remixOf ? null : cutAudio(st.audio, st.startMs);
        row = await rpc('bv_sere_create', {
          p_image_ext: st.image.ext, p_duration_ms: st.remixOf ? 1000 : st.audio.durationMs, p_start_ms: cut ? cut.startMs : 0,
          p_scene: st.scene, p_caption: st.caption || null, p_remix_of: st.remixOf, p_engine: st.engine
        });
      }
      st.id = row.id; localStorage.setItem('sere:job', row.id);
      if (window.SKTrack) window.SKTrack('first_action', { kind: 'sere' }, 'sk-first-action');
      var pi = 0, pa = cut ? 0 : 1, tick = function () { st.pct = Math.round((pi * 0.3 + pa * 0.7) * 100); paintProgress(); };
      await Promise.all([
        putWithProgress('sere-images', row.image_path, st.image.blob, function (p) { pi = p; tick(); }),
        cut ? putWithProgress('sere-audio', row.audio_path, cut.blob, function (p) { pa = p; tick(); }) : Promise.resolve()
      ]);
      var sess = await client.auth.getSession();
      var r = await fetch('/api/sere', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token }, body: JSON.stringify({ action: 'start', id: row.id }) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || 'The render could not start.');
      st.status = 'processing'; st.pct = 0; subscribe(row.id); paint();
    } catch (e) { st.step = 'pick'; st.error = say(e, e && e.message); paint(); }
  }
  function subscribe(id) {
    unsubscribe();
    if (!client || typeof client.channel !== 'function') return;
    st.channel = client.channel('sere-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'bulavata', table: 'sere_media_generations', filter: 'id=eq.' + id }, function (p) { onUpdate(p && p['new']); })
      .subscribe();
    // A safety net for a missed event: ask the server to look after four minutes, then every two.
    st.timer = setTimeout(function poll() { check(id).then(function (s) { if (s === 'processing') st.timer = setTimeout(poll, 120000); }); }, 240000);
  }
  function unsubscribe() {
    if (st.timer) { clearTimeout(st.timer); st.timer = null; }
    if (st.channel && client && typeof client.removeChannel === 'function') { try { client.removeChannel(st.channel); } catch (_) {} }
    st.channel = null;
  }
  function onUpdate(row) {
    if (!row || row.id !== st.id) return;
    st.status = row.status; st.pct = Number(row.progress) || st.pct;
    if (row.status === 'completed') { localStorage.removeItem('sere:job'); st.step = 'done'; st.video = row.output_video_url; st.poster = row.output_poster_url; unsubscribe(); paint(); toast('Your sere is on the wall.'); }
    else if (row.status === 'failed') { localStorage.removeItem('sere:job'); st.step = 'pick'; st.error = row.error || 'The render failed. Try another photo or sound.'; unsubscribe(); paint(); }
    else paintProgress();
  }
  async function check(id) {
    try {
      var sess = await client.auth.getSession();
      var r = await fetch('/api/sere', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sess.data.session.access_token }, body: JSON.stringify({ action: 'check', id: id }) });
      var j = await r.json().catch(function () { return {}; });
      if (j.status === 'completed' || j.status === 'failed') { var mine = await rpc('bv_sere_mine'); var row = (mine || []).filter(function (m) { return m.id === id; })[0]; if (row) onUpdate({ id: id, status: row.status, progress: row.progress, output_video_url: row.video, output_poster_url: row.poster, error: row.error }); }
      return j.status || 'processing';
    } catch (_) { return 'processing'; }
  }
  async function resume() {
    var id = localStorage.getItem('sere:job'); if (!id) return;
    try {
      var mine = await rpc('bv_sere_mine'); var row = (mine || []).filter(function (m) { return m.id === id; })[0];
      if (!row) { localStorage.removeItem('sere:job'); return; }
      st.id = id; st.status = row.status;
      if (row.status === 'processing' || row.status === 'pending') { st.step = 'working'; st.pct = row.progress || 0; subscribe(id); }
      else onUpdate({ id: id, status: row.status, progress: row.progress, output_video_url: row.video, output_poster_url: row.poster, error: row.error });
    } catch (_) {}
  }

  /* ---------------------------------------------------------------- tipping and remix (called from the wall) */
  async function tip(sereId, btn) {
    if (!sereId) return;
    var sheet = document.createElement('div'); sheet.className = 'sere-tip glass card'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Tip the maker');
    sheet.innerHTML = '<p class="sere-tip-title">Send a gift for this sere</p><div class="sere-tip-row">' +
      GIFTS.map(function (g) { return '<button type="button" class="sere-gift" data-gift="' + g[0] + '"><span>' + g[1] + '</span><small>' + g[2] + '</small></button>'; }).join('') +
      '</div><button type="button" class="btn sm sere-tip-close">Not now</button>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', async function (ev) {
      var g = ev.target.closest('.sere-gift'); if (ev.target.closest('.sere-tip-close')) return sheet.remove();
      if (!g) return;
      try { var left = await rpc('bv_sere_tip', { p_sere: sereId, p_gift: g.dataset.gift }); toast('Gift sent. ' + left + ' left today.'); if (btn) { var b = btn.querySelector('b'); if (b) b.textContent = (Number(b.textContent) || 0) + 1; } }
      catch (e) { toast(say(e)); }
      sheet.remove();
    });
  }
  function countPlay(video) {
    var id = video && video.dataset && video.dataset.sere; if (!id || played[id]) return;
    played[id] = true; rpc('bv_sere_play', { p_sere: id }).catch(function () {});
  }

  /* ---------------------------------------------------------------- markup */
  function sceneOptions() {
    return (st.scenes || SCENES_FALLBACK).map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === st.scene ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('');
  }
  function modeTabs() {
    if (st.remixOf) return '';
    return '<div class="sere-modes" role="tablist" aria-label="What should it do">' +
      '<button type="button" role="tab" data-sere="mode" data-mode="sing" aria-selected="' + (st.mode === 'sing') + '">🎵 Sing a sound</button>' +
      '<button type="button" role="tab" data-sere="mode" data-mode="say" aria-selected="' + (st.mode === 'say') + '">💬 Say my words</button></div>';
  }
  function sayBox() {
    return '<div class="sere-say"><label>Words to say <textarea data-sere="text" maxlength="300" rows="3" placeholder="Bula! Type what the photo should say…">' + esc(st.text) + '</textarea></label>' +
      '<div class="sere-row"><label>Voice <select data-sere="voice">' + VOICES.map(function (v) { return '<option value="' + v[0] + '"' + (v[0] === st.voice ? ' selected' : '') + '>' + v[1] + '</option>'; }).join('') + '</select></label>' +
      '<small class="sere-say-note">' + (300 - st.text.length) + ' characters left · English voices for now</small></div></div>';
  }
  function engineRow() {
    return '<div class="sere-engines" role="radiogroup" aria-label="How it moves">' + ENGINES.map(function (e) {
      return '<button type="button" role="radio" class="sere-engine" data-sere="engine" data-engine="' + e[0] + '" aria-checked="' + (st.engine === e[0]) + '"><b>' + e[1] + '</b><small>' + e[2] + '</small></button>';
    }).join('') + '</div>';
  }
  function pickStep() {
    var dur = st.audio ? st.audio.durationMs : 0, win = st.audio ? pickWindow(st.startMs, dur) : null, say = st.mode === 'say' && !st.remixOf;
    return modeTabs() + '<div class="sere-grid">' +
      '<label class="sere-drop' + (st.image ? ' has' : '') + '">' + (st.image ? '<img src="' + st.image.previewUrl + '" alt="Your photo">' : '<span class="sere-ico">🖼️</span><span>Choose a photo</span><small>JPG or PNG · one face · portrait</small>') +
        '<input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.jfif,.png" data-sere="image" hidden></label>' +
      (st.remixOf
        ? '<div class="sere-drop has sere-remix"><span class="sere-ico">🔁</span><span>Remixing the sound from that sere</span><small>Your photo, their sound</small></div>'
        : say ? sayBox()
        : '<label class="sere-drop' + (st.audio ? ' has' : '') + '">' + (st.audio ? '<span class="sere-ico">🎵</span><span>' + esc(st.audio.name || 'Your sound') + '</span><small>' + fmt(dur) + '</small>' : '<span class="sere-ico">🎵</span><span>Choose a sound</span><small>MP3 or WAV · up to 10 minutes</small>') +
          '<input type="file" accept="audio/mpeg,audio/wav,.mp3,.wav" data-sere="audio" hidden></label>') +
      '</div>' +
      (st.audio && !st.remixOf && !say ? '<div class="sere-trim"><div class="sere-trim-head"><span>Sing from <b>' + fmt(win.startMs) + '</b> to <b>' + fmt(win.endMs) + '</b></span><button type="button" class="btn sm" data-sere="preview">▶ Hear it</button></div>' +
        '<input type="range" min="0" max="' + Math.max(0, dur - LIMITS.audio.windowMs) + '" step="500" value="' + win.startMs + '" data-sere="start" aria-label="Start of the part that sings"' + (dur <= LIMITS.audio.windowMs ? ' disabled' : '') + '>' +
        '<small>Up to 60 seconds sings. Slide to pick the part.</small><audio data-sere="player" src="' + st.audio.previewUrl + '" preload="none"></audio></div>' : '') +
      engineRow() +
      '<div class="sere-row"><label>Scene <select data-sere="scene">' + sceneOptions() + '</select></label>' +
        '<label class="sere-cap">Caption <input type="text" maxlength="140" data-sere="caption" value="' + esc(st.caption) + '" placeholder="Say something (optional)"></label></div>' +
      (st.error ? '<p class="sere-error" role="alert">' + esc(st.error) + '</p>' : '') +
      '<div class="sere-actions"><button type="button" class="btn" data-sere="create"' + (st.image && (say ? st.text.trim().length >= 2 : (st.audio || st.remixOf)) ? '' : ' disabled') + '>' + (say ? 'Make it speak' : 'Make it sing') + '</button></div>';
  }
  function workingStep() {
    var uploading = st.status !== 'processing';
    return '<div class="sere-working">' + (st.image ? '<img class="sere-working-img" src="' + (st.image.previewUrl || st.poster || '') + '" alt="">' : '') +
      '<p class="sere-working-title">' + (uploading ? (st.mode === 'say' ? 'Giving it a voice…' : 'Sending your photo and sound…') : (st.engine === 'lifelike' ? 'Making it lifelike…' : 'Making it sing…')) + '</p>' +
      '<div class="sere-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + st.pct + '"><i style="width:' + st.pct + '%"></i></div>' +
      '<small>' + (uploading ? st.pct + '%' : (st.engine === 'lifelike' ? 'Lifelike takes five to ten minutes.' : 'Usually one to four minutes.') + ' You can close this — it posts to the wall by itself.') + '</small>' +
      (uploading ? '' : '<button type="button" class="btn sm" data-sere="check">Check now</button>') + '</div>';
  }
  function doneStep() {
    return '<div class="sere-done"><video class="sere-video" controls playsinline preload="metadata" poster="' + esc(st.poster || '') + '" src="' + esc(st.video || '') + '"></video>' +
      '<p>It is on the wall.</p><div class="sere-actions"><button type="button" class="btn" data-sere="wall">See it on the wall</button><button type="button" class="btn sm" data-sere="again">Make another</button></div></div>';
  }
  function sheet() {
    return '<div class="sere-sheet glass card" role="dialog" aria-modal="true" aria-label="Make a photo sing">' +
      '<div class="sere-head"><h2>🎤 Sere</h2><button type="button" class="sere-close" data-sere="close" aria-label="Close">✕</button></div>' +
      (st.step === 'working' ? workingStep() : st.step === 'done' ? doneStep() : pickStep()) + '</div>';
  }
  function paint() {
    var host = $('#sere-host'); if (!host) { host = document.createElement('div'); host.id = 'sere-host'; document.body.appendChild(host); }
    host.innerHTML = st.open ? '<div class="sere-scrim" data-sere="close"></div>' + sheet() : '';
    document.body.classList.toggle('sere-open', st.open);
  }
  function paintProgress() {
    var bar = $('.sere-bar i'), t = $('.sere-working small'), p = $('.sere-bar');
    if (bar) bar.style.width = st.pct + '%'; if (p) p.setAttribute('aria-valuenow', st.pct);
    if (t && st.status !== 'processing') t.textContent = st.pct + '%';
  }

  /* ---------------------------------------------------------------- events */
  function wire() {
    if (wired || typeof document === 'undefined') return; wired = true;
    document.addEventListener('change', async function (ev) {
      var t = ev.target.closest('[data-sere]'); if (!t) return;
      var k = t.dataset.sere;
      try {
        if (k === 'image') { st.image = await prepImage(t.files[0]); st.error = null; paint(); }
        if (k === 'audio') { toast('Reading the sound…'); st.audio = await decodeAudio(t.files[0]); st.startMs = 0; st.error = null; paint(); }
        if (k === 'scene') st.scene = t.value;
        if (k === 'voice') st.voice = t.value;
        if (k === 'caption') st.caption = t.value.slice(0, 140);
      } catch (e) { st.error = say(e, e && e.message); paint(); }
    });
    document.addEventListener('input', function (ev) {
      var cap = ev.target.closest('[data-sere="caption"]'); if (cap) { st.caption = cap.value.slice(0, 140); return; }
      var txt = ev.target.closest('[data-sere="text"]'); if (txt) { st.text = txt.value.slice(0, 300); var n = $('.sere-say-note'), c = $('[data-sere="create"]'); if (n) n.textContent = (300 - st.text.length) + ' characters left · English voices for now'; if (c) c.disabled = !(st.image && st.text.trim().length >= 2); return; }
      var t = ev.target.closest('[data-sere="start"]'); if (!t) return;
      st.startMs = Number(t.value) || 0; var win = pickWindow(st.startMs, st.audio.durationMs), b = document.querySelectorAll('.sere-trim-head b');
      if (b.length === 2) { b[0].textContent = fmt(win.startMs); b[1].textContent = fmt(win.endMs); }
    });
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-sere]'); if (!t) return;
      var k = t.dataset.sere;
      if (k === 'close') return close();
      if (k === 'mode') { st.mode = t.dataset.mode; st.error = null; return paint(); }
      if (k === 'engine') { st.engine = t.dataset.engine; document.querySelectorAll('.sere-engine').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.engine === st.engine); }); return; }
      if (k === 'create') return create();
      if (k === 'check') return check(st.id);
      if (k === 'again') { var keep = st.scenes; st = fresh(); st.scenes = keep; st.open = true; return paint(); }
      if (k === 'wall') { close(); if (go) go('pulse'); return; }
      if (k === 'preview') {
        var a = $('[data-sere="player"]'); if (!a) return;
        var win = pickWindow(st.startMs, st.audio.durationMs);
        if (!a.paused) { a.pause(); t.textContent = '▶ Hear it'; return; }
        a.currentTime = win.startMs / 1000; a.play(); t.textContent = '⏸ Stop';
        a.ontimeupdate = function () { if (a.currentTime * 1000 >= win.endMs) { a.pause(); t.textContent = '▶ Hear it'; } };
        a.onpause = function () { t.textContent = '▶ Hear it'; };
      }
    });
    document.addEventListener('play', function (ev) { if (ev.target && ev.target.matches && ev.target.matches('video[data-sere]')) countPlay(ev.target); }, true);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && st.open) close(); });
  }

  /* ---------------------------------------------------------------- entry points */
  async function open(opts) {
    opts = opts || {};
    if (!S || !S.user) { toast(SAY.NOT_SIGNED_IN); return; }
    wire();
    var scenes = st.scenes;
    if (st.step !== 'working') { st = fresh(); st.scenes = scenes; }
    st.open = true; st.remixOf = opts.remixOf || null;
    if (opts.mode === 'say' && !st.remixOf && st.step !== 'working') st.mode = 'say';
    paint();
    if (!st.scenes) { try { var r = await client.from('bv_sere_scenes').select('id,label'); if (r && r.data && r.data.length) { st.scenes = r.data; if (st.open) paint(); } } catch (_) {} }
  }
  function close() { st.open = false; paint(); }
  /** The public, playable page for one of the member's own seres (see api/listen.js). Null if the
      server will not give one (not the maker, not finished, or the server is not set up). */
  var links = {};
  async function shareLink(id) {
    if (links[id]) return links[id];
    try {
      var sess = await client.auth.getSession(), tok = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!tok) return null;
      var r = await fetch('/api/sere', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ action: 'share', id: id }) });
      var d = r.ok ? await r.json() : null;
      if (d && typeof d.url === 'string' && /^https:\/\/sotakece\.com\/s\//.test(d.url)) { links[id] = d.url; return d.url; }
    } catch (_) {}
    return null;
  }
  function init(cfg) { client = cfg.client; S = cfg.state; toast = cfg.toast; esc = cfg.esc; go = cfg.go || null; wire(); resume(); }

  return {
    init: init, open: open, close: close, shareLink: shareLink, tip: tip, resume: resume, check: check,
    // pure helpers (tested)
    pickWindow: pickWindow, checkImageDims: checkImageDims, encodeWav: encodeWav, mixWindow: mixWindow, say: say, VOICES: VOICES, ENGINES: ENGINES,
    state: function () { return st; }, LIMITS: LIMITS
  };
});
