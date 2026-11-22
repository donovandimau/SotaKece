/* Sota Kece — Song Scratch (song-scratch.html).
   Pick an Island Mix song, cover it with your photo (or a silver scratch card), then scratch the
   cover away with your finger to reveal the playing song card underneath. Save the scratch as a
   story video with the music, or as a picture. Nothing is uploaded: it all happens on the phone. */
import { loadCatalogue } from '/shared-music/core.mjs';
import { W, H, fmtTime, splitTitle, searchTracks, coverColours, buildTimeline, pickMime, clearedShare } from '/song-scratch-core.mjs';

const $ = (id) => document.getElementById(id);
const stage = $('ss-canvas'), ctx = stage.getContext('2d');
stage.width = W; stage.height = H;

// Layers: `cover` is the photo/foil that gets scratched away; `photo` keeps the original picture.
const cover = document.createElement('canvas'); cover.width = W; cover.height = H;
const cctx = cover.getContext('2d', { willReadFrequently: true });
let photo = null;          // HTMLImageElement or null (silver scratch card)
let backdrop = null;       // blurred, darkened copy of the photo behind the card

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload = 'metadata';
audio.loop = true;

const S = {
  tracks: [], song: null, start: 0, brush: 46,
  strokes: [], t0: 0, down: false, last: null,
  revealed: 0, recording: false, playing: false, dust: [],
};

/* ---------- drawing ---------- */

function coverFit(img, w, h) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  return [(w - dw) / 2, (h - dh) / 2, dw, dh];
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function wrap(c, text, maxW, maxLines) {
  const words = String(text).split(/\s+/), lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width <= maxW) { line = test; continue; }
    if (line) lines.push(line);
    line = w;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  const usedAll = lines.join(' ').split(/\s+/).length >= words.length;
  if (!usedAll) {
    let l = lines[maxLines - 1];
    while (l && c.measureText(l + '…').width > maxW) l = l.slice(0, -1);
    lines[maxLines - 1] = l.trimEnd() + '…';
  }
  return lines;
}

function makeBackdrop() {
  backdrop = document.createElement('canvas'); backdrop.width = W / 4; backdrop.height = H / 4;
  const b = backdrop.getContext('2d');
  if (photo) {
    b.filter = 'blur(6px) saturate(1.3)';
    b.drawImage(photo, ...coverFit(photo, W / 4, H / 4));
    b.filter = 'none';
  } else {
    const [c1, c2] = S.song ? coverColours(S.song.id) : ['#1d5f8f', '#06182b'];
    const g = b.createLinearGradient(0, 0, W / 4, H / 4); g.addColorStop(0, c1); g.addColorStop(1, c2);
    b.fillStyle = g; b.fillRect(0, 0, W / 4, H / 4);
  }
  b.fillStyle = 'rgba(4,16,30,.45)'; b.fillRect(0, 0, W / 4, H / 4);
}

function drawCoverArt(c, x, y, s, now) {
  const [c1, c2] = S.song ? coverColours(S.song.id) : ['#3BA7E0', '#0a2540'];
  c.save(); roundRect(c, x, y, s, s, 22); c.clip();
  const g = c.createLinearGradient(x, y, x + s, y + s); g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.fillRect(x, y, s, s);
  // masi-style triangles along the bottom
  c.fillStyle = 'rgba(255,255,255,.14)';
  const n = 8, tw = s / n;
  for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(x + i * tw, y + s); c.lineTo(x + i * tw + tw / 2, y + s - tw * .9); c.lineTo(x + (i + 1) * tw, y + s); c.fill(); }
  // spinning record when playing
  const cx = x + s * .5, cy = y + s * .44, r = s * .28, a = S.playing ? now / 900 : 0;
  c.fillStyle = 'rgba(5,15,28,.85)'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
  for (let k = .45; k < 1; k += .14) { c.beginPath(); c.arc(cx, cy, r * k, a, a + 4.2); c.stroke(); }
  c.fillStyle = c1; c.beginPath(); c.arc(cx, cy, r * .3, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r * .06, 0, 7); c.fill();
  c.restore();
}

function drawCard(c, now) {
  // backdrop
  if (!backdrop) makeBackdrop();
  c.imageSmoothingEnabled = true;
  c.drawImage(backdrop, 0, 0, W, H);
  const vg = c.createRadialGradient(W / 2, H * .45, 80, W / 2, H * .45, H * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);

  // card
  const cw = 520, ch = 700, x = (W - cw) / 2, y = (H - ch) / 2 - 20;
  c.save();
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 50; c.shadowOffsetY = 20;
  roundRect(c, x, y, cw, ch, 36); c.fillStyle = 'rgba(8,28,48,.82)'; c.fill();
  c.restore();
  roundRect(c, x, y, cw, ch, 36); c.strokeStyle = 'rgba(160,220,255,.22)'; c.lineWidth = 2; c.stroke();

  const pad = 40, art = cw - pad * 2;
  drawCoverArt(c, x + pad, y + pad, art, now);

  const { song, artist } = S.song ? splitTitle(S.song.title) : { song: 'Choose a song', artist: 'Island Mix' };
  let ty = y + pad + art + 52;
  c.textAlign = 'left'; c.fillStyle = '#eaf6ff';
  c.font = '800 36px Manrope, system-ui, sans-serif';
  const lines = wrap(c, song, art, 2);
  for (const l of lines) { c.fillText(l, x + pad, ty); ty += 42; }
  c.font = '400 26px Lexend, system-ui, sans-serif'; c.fillStyle = '#9fbfd6';
  c.fillText(wrap(c, artist || (S.song?.playlist ?? ''), art, 1)[0] || '', x + pad, ty + 2);

  // progress
  const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
  const cur = audio.currentTime || S.start;
  const py = y + ch - 78, pw = art;
  c.fillStyle = 'rgba(255,255,255,.18)'; roundRect(c, x + pad, py, pw, 8, 4); c.fill();
  const k = dur ? Math.min(1, cur / dur) : 0;
  c.fillStyle = '#87CEEB'; roundRect(c, x + pad, py, Math.max(8, pw * k), 8, 4); c.fill();
  c.beginPath(); c.arc(x + pad + pw * k, py + 4, 10, 0, 7); c.fill();
  c.font = '500 20px Lexend, system-ui, sans-serif'; c.fillStyle = '#9fbfd6';
  c.fillText(fmtTime(cur), x + pad, py + 40);
  c.textAlign = 'right'; c.fillText(dur ? '-' + fmtTime(dur - cur) : '', x + pad + pw, py + 40);

  // equaliser bars (move with the music)
  c.textAlign = 'left';
  const bx = x + cw - pad - 64, by = y + pad + art + 18;
  for (let i = 0; i < 5; i++) {
    const h = S.playing ? 10 + 22 * Math.abs(Math.sin(now / (180 + i * 37) + i)) : 8;
    c.fillStyle = '#87CEEB'; roundRect(c, bx + i * 13, by + 34 - h, 8, h, 3); c.fill();
  }

  // footer
  c.textAlign = 'center'; c.fillStyle = 'rgba(234,246,255,.85)';
  c.font = '700 26px Manrope, system-ui, sans-serif';
  c.fillText('Sota Kece', W / 2, H - 92);
  c.font = '400 20px Lexend, system-ui, sans-serif'; c.fillStyle = 'rgba(159,191,214,.9)';
  c.fillText('sotakece.com · Island Mix', W / 2, H - 62);
}

function paintCover() {
  cctx.globalCompositeOperation = 'source-over';
  cctx.clearRect(0, 0, W, H);
  if (photo) {
    cctx.drawImage(photo, ...coverFit(photo, W, H));
  } else {
    // silver scratch-card foil
    const g = cctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#cfd8df'); g.addColorStop(.35, '#f4f7f9'); g.addColorStop(.6, '#aab6c0'); g.addColorStop(1, '#e6ebef');
    cctx.fillStyle = g; cctx.fillRect(0, 0, W, H);
    cctx.globalAlpha = .08; cctx.fillStyle = '#06182b';
    for (let i = 0; i < 2600; i++) cctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    cctx.globalAlpha = 1;
    cctx.fillStyle = 'rgba(6,24,43,.72)'; cctx.textAlign = 'center';
    cctx.font = '800 54px Manrope, system-ui, sans-serif'; cctx.fillText('Scratch me', W / 2, H / 2 - 10);
    cctx.font = '400 28px Lexend, system-ui, sans-serif'; cctx.fillText('to hear the song', W / 2, H / 2 + 36);
    cctx.font = '700 24px Manrope, system-ui, sans-serif'; cctx.fillText('Sota Kece', W / 2, H - 80);
  }
  S.revealed = 0;
}

function scratch(c, a, b, r) {
  c.globalCompositeOperation = 'destination-out';
  c.lineCap = 'round'; c.lineJoin = 'round';
  // a soft core plus a few ragged offsets so it looks scratched, not erased
  c.strokeStyle = 'rgba(0,0,0,1)'; c.lineWidth = r;
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  c.lineWidth = r * .3;
  const seed = (a.x * 7 + b.y * 13) % 1;
  for (let i = 0; i < 3; i++) {
    const o = (i - 1) * r * .55 + (seed - .5) * 6;
    c.beginPath(); c.moveTo(a.x + o, a.y - o * .4); c.lineTo(b.x + o, b.y - o * .4); c.stroke();
  }
  c.globalCompositeOperation = 'source-over';
}

function addDust(p) {
  if (S.dust.length > 140) return;
  for (let i = 0; i < 3; i++) S.dust.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 5, vy: -Math.random() * 4, life: 1, s: 2 + Math.random() * 4 });
}

function drawDust(c) {
  c.fillStyle = photo ? 'rgba(255,255,255,.8)' : 'rgba(210,220,228,.95)';
  for (const d of S.dust) { c.globalAlpha = Math.max(0, d.life); c.fillRect(d.x, d.y, d.s, d.s); d.x += d.vx; d.y += d.vy; d.vy += .35; d.life -= .04; }
  c.globalAlpha = 1;
  S.dust = S.dust.filter((d) => d.life > 0);
}

function frame(now) {
  if (S.recording) { requestAnimationFrame(frame); return; } // the recorder draws its own frames
  drawCard(ctx, now);
  ctx.drawImage(cover, 0, 0);
  drawDust(ctx);
  requestAnimationFrame(frame);
}

/* ---------- interaction ---------- */

function toCanvas(e) {
  const r = stage.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}

async function startMusic() {
  if (!S.song) return;
  try {
    if (audio.paused) {
      if (!audio.currentTime) audio.currentTime = S.start;
      await audio.play();
      say('Playing ' + splitTitle(S.song.title).song + '. Keep scratching.');
    }
  } catch (e) { if (e?.name !== 'AbortError') say('Tap again to start the music.'); }
}

let revealTimer = 0;
function measureReveal() {
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    try {
      const small = document.createElement('canvas'); small.width = 90; small.height = 160;
      small.getContext('2d').drawImage(cover, 0, 0, 90, 160);
      S.revealed = clearedShare(small.getContext('2d').getImageData(0, 0, 90, 160).data);
    } catch (_) { return; }
    $('ss-revealed').textContent = Math.round(S.revealed * 100) + '% scratched';
    if (S.strokes.length) $('ss-save').disabled = false, $('ss-picture').disabled = false;
  }, 150);
}

stage.addEventListener('pointerdown', (e) => {
  if (S.recording) return;
  if (!S.song) { say('Choose a song first.'); return; }
  stage.setPointerCapture(e.pointerId);
  S.down = true;
  const p = toCanvas(e);
  if (!S.strokes.length) S.t0 = performance.now();
  const pt = { t: performance.now() - S.t0, x: p.x, y: p.y, r: S.brush, down: true };
  S.strokes.push(pt); S.last = pt;
  scratch(cctx, pt, { x: pt.x + .1, y: pt.y + .1 }, S.brush);
  addDust(pt);
  startMusic();
  $('ss-tip').hidden = true;
});
stage.addEventListener('pointermove', (e) => {
  if (!S.down || S.recording) return;
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events) {
    const p = toCanvas(ev);
    const pt = { t: performance.now() - S.t0, x: p.x, y: p.y, r: S.brush, down: false };
    scratch(cctx, S.last, pt, S.brush);
    S.strokes.push(pt); S.last = pt;
    if (Math.random() < .35) addDust(pt);
  }
  measureReveal();
});
const up = () => { if (S.down) { S.down = false; measureReveal(); } };
stage.addEventListener('pointerup', up);
stage.addEventListener('pointercancel', up);

/* ---------- songs ---------- */

function say(t) { $('ss-status').textContent = t; }

function renderList() {
  const list = $('ss-songs');
  list.textContent = '';
  const found = searchTracks(S.tracks, $('ss-search').value, 60);
  if (!found.length) { const li = document.createElement('li'); li.className = 'ss-empty'; li.textContent = 'No songs match that.'; list.append(li); return; }
  for (const t of found) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ss-song'; b.setAttribute('aria-pressed', String(S.song?.id === t.id));
    const { song, artist } = splitTitle(t.title);
    const name = document.createElement('b'); name.textContent = song;
    const by = document.createElement('small'); by.textContent = artist || t.playlist;
    b.append(name, by);
    b.addEventListener('click', () => chooseSong(t));
    li.append(b); list.append(li);
  }
}

function chooseSong(t) {
  S.song = t; S.start = 0;
  audio.pause(); audio.src = t.url; audio.currentTime = 0;
  $('ss-start').value = '0'; $('ss-start-label').textContent = '0:00';
  backdrop = null;
  if (!photo) paintCover();
  resetScratch(false);
  renderList();
  $('ss-picked').textContent = splitTitle(t.title).song;
  say('Now scratch the picture to hear it.');
  $('ss-tip').hidden = false;
}

audio.addEventListener('loadedmetadata', () => {
  const max = Math.max(0, Math.floor(audio.duration - 20));
  $('ss-start').max = String(max);
  $('ss-start').disabled = !max;
});
audio.addEventListener('play', () => { S.playing = true; $('ss-play').textContent = 'Pause'; });
audio.addEventListener('pause', () => { S.playing = false; $('ss-play').textContent = 'Play'; });
audio.addEventListener('error', () => say('This song would not load. Try another one.'));

$('ss-start').addEventListener('input', (e) => {
  S.start = Number(e.target.value) || 0;
  $('ss-start-label').textContent = fmtTime(S.start);
  if (S.song) audio.currentTime = S.start;
});
$('ss-play').addEventListener('click', () => {
  if (!S.song) { say('Choose a song first.'); return; }
  if (audio.paused) startMusic(); else audio.pause();
});
$('ss-search').addEventListener('input', renderList);

/* ---------- photo ---------- */

function loadPhoto(file) {
  if (!file || !/^image\//.test(file.type)) { say('That is not a picture. Choose a JPEG, PNG or WebP.'); return; }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    photo = img; backdrop = null;
    paintCover(); resetScratch(false);
    $('ss-photo-label').textContent = 'Change photo';
    say(S.song ? 'Scratch the photo to reveal the song.' : 'Now choose a song.');
  };
  img.onerror = () => say('That picture could not be opened.');
  img.src = url;
}
$('ss-photo').addEventListener('click', () => $('ss-file').click());
$('ss-file').addEventListener('change', (e) => loadPhoto(e.target.files[0]));
$('ss-foil').addEventListener('click', () => { photo = null; backdrop = null; paintCover(); resetScratch(false); $('ss-photo-label').textContent = 'Use my photo'; });
stage.addEventListener('dragover', (e) => e.preventDefault());
stage.addEventListener('drop', (e) => { e.preventDefault(); loadPhoto(e.dataTransfer.files[0]); });

/* ---------- tools ---------- */

$('ss-brush').addEventListener('input', (e) => { S.brush = Number(e.target.value); });

function resetScratch(stopMusic = true) {
  S.strokes = []; S.last = null; S.dust = [];
  paintCover();
  if (stopMusic) { audio.pause(); if (S.song) audio.currentTime = S.start; }
  $('ss-revealed').textContent = '';
  $('ss-save').disabled = true; $('ss-picture').disabled = true;
}
$('ss-reset').addEventListener('click', () => { resetScratch(); say('Covered again. Scratch away.'); $('ss-tip').hidden = !S.song; });
$('ss-reveal').addEventListener('click', () => {
  if (!S.song) { say('Choose a song first.'); return; }
  // sweep across the whole picture like a finger would, so the saved video shows it too
  if (!S.strokes.length) S.t0 = performance.now();
  const base = performance.now() - S.t0;
  let t = base + 120, first = true;
  for (let y = 40; y < H; y += 90) {
    const row = y / 90 % 2 ? [W - 30, 30] : [30, W - 30];
    for (const x of row) { S.strokes.push({ t, x, y, r: 120, down: first }); first = false; t += 70; }
  }
  replayInto(cctx, S.strokes.filter((p) => p.t >= base + 120));
  startMusic(); measureReveal();
  $('ss-tip').hidden = true;
});

function replayInto(c, pts) {
  let last = null;
  for (const p of pts) {
    if (p.down || !last) scratch(c, p, { x: p.x + .1, y: p.y + .1 }, p.r); else scratch(c, last, p, p.r);
    last = p;
  }
}

/* ---------- saving ---------- */

function fileName(ext) {
  const base = S.song ? splitTitle(S.song.title).song.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : 'story';
  return `sota-kece-${base || 'story'}.${ext}`;
}

async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sota Kece', text: 'Scratch to hear the song · sotakece.com' }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return 'saved';
}

$('ss-picture').addEventListener('click', () => {
  stage.toBlob(async (blob) => {
    if (!blob) { say('The picture could not be made.'); return; }
    const how = await deliver(blob, fileName('png'));
    if (how !== 'cancelled') say(how === 'shared' ? 'Picture shared.' : 'Picture saved to your downloads.');
  }, 'image/png');
});

let actx = null, tap = null;
function audioTap() {
  if (tap) return tap;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(audio);
    tap = actx.createMediaStreamDestination();
    src.connect(actx.destination); src.connect(tap);
  } catch (_) { tap = null; }
  return tap;
}

$('ss-save').addEventListener('click', async () => {
  if (!window.MediaRecorder || !stage.captureStream) { say('This browser cannot make videos. Use “Save picture” instead.'); return; }
  const mime = pickMime((m) => MediaRecorder.isTypeSupported(m));
  const tl = buildTimeline(S.strokes);
  if (!tl.points.length) return;

  S.recording = true; document.body.classList.add('ss-busy');
  $('ss-save').disabled = true; $('ss-progress').hidden = false;
  say('Making your story video… keep this page open.');

  const out = tap || audioTap();
  if (actx?.state === 'suspended') await actx.resume().catch(() => {});
  const stream = stage.captureStream(30);
  if (out) for (const track of out.stream.getAudioTracks()) stream.addTrack(track);
  const chunks = [];
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined); }
  catch (_) { rec = new MediaRecorder(stream); }
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((r) => { rec.onstop = r; });

  // replay: cover again, then redraw the strokes on their timeline while the song plays
  const saved = S.strokes;
  paintCover(); S.dust = [];
  audio.pause(); audio.currentTime = S.start;
  rec.start(250);
  const t0 = performance.now();
  let i = 0, last = null, musicOn = false;
  await new Promise((resolve) => {
    (function step() {
      const t = performance.now() - t0;
      $('ss-progress').value = Math.min(1, t / tl.totalMs);
      while (i < tl.points.length && tl.points[i].t <= t) {
        const p = tl.points[i++];
        if (p.down || !last) scratch(cctx, p, { x: p.x + .1, y: p.y + .1 }, p.r); else scratch(cctx, last, p, p.r);
        if (Math.random() < .3) addDust(p);
        last = p;
        if (!musicOn) { musicOn = true; audio.play().catch(() => {}); }
      }
      // draw here too: requestAnimationFrame pauses in hidden tabs, a timer keeps the video going
      drawCard(ctx, performance.now()); ctx.drawImage(cover, 0, 0); drawDust(ctx);
      if (t >= tl.totalMs) return resolve();
      setTimeout(step, 33);
    })();
  });
  rec.stop(); await done;
  audio.pause();
  S.strokes = saved;
  S.recording = false; document.body.classList.remove('ss-busy');
  $('ss-progress').hidden = true; $('ss-save').disabled = false;

  const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  if (!blob.size) { say('The video came out empty. Try again, or save a picture.'); return; }
  const how = await deliver(blob, fileName(type.includes('mp4') ? 'mp4' : 'webm'));
  if (how === 'cancelled') say('Video ready. Tap “Save story video” again to share it.');
  else say(how === 'shared' ? 'Story shared.' : (out ? 'Story video saved to your downloads.' : 'Video saved, but this browser kept the music out of it.'));
});

/* ---------- start ---------- */

paintCover();
requestAnimationFrame(frame);
document.fonts?.ready.then(() => { if (!photo && !S.strokes.length) paintCover(); });

(async () => {
  say('Loading Island Mix songs…');
  try {
    // one quiet retry: the catalogue call gives up after 8 s on a slow connection
    const { tracks, stale } = await loadCatalogue().catch(() => loadCatalogue({ force: true }));
    S.tracks = tracks.slice();
    renderList();
    const want = new URLSearchParams(location.search).get('song');
    const pick = (want && S.tracks.find((t) => t.id === want)) || null;
    if (pick) chooseSong(pick);
    else say(stale ? 'Showing saved songs (offline).' : `${S.tracks.length} songs ready. Choose one.`);
  } catch (e) {
    say(e.message || 'Music could not connect. Please try again.');
  }
})();
