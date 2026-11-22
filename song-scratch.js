/* Sota Kece — Song Scratch (song-scratch.html).
   A story maker built round one trick: pick an Island Mix song, cover it (your photos or video clips,
   a background or a silver scratch card), then scratch the cover away to reveal the playing song card.
   Or switch the scratch off and make an ordinary music story with the card on top of your picture.
   On top: text (animated if you like), emoji, Fijian words, moving stickers, your own stickers, the
   song sticker and drawings. Photos can be laid out, cropped, zoomed and turned. Templates, drafts
   kept on the phone, and saving as a story video with the music or as a picture.
   Nothing is uploaded: it all happens on the phone. */
import { loadCatalogue } from '/shared-music/core.mjs';
import { W, H, fmtTime, splitTitle, searchTracks, coverColours, buildTimeline, pickMime, clearedShare, MAX_EXPORT_MS } from '/song-scratch-core.mjs';
import { FONTS, COLOURS, EMOJI, WORDS, FILTERS, CARD_STYLES, PENS, newLayer, hitLayer, pinch, clampScale, drawLayer, drawSelection, drawPaths, history } from '/song-scratch-editor.mjs';
import { LAYOUTS, cellRects, cellAt, mediaSize, clampPan, drawMediaInCell, BACKGROUNDS, drawBackground, ANIMS, MOVING, TEMPLATES } from '/song-scratch-media.mjs';
import { AUTO, saveDraft, getDraft, deleteDraft, listDrafts, draftLabel } from '/song-scratch-drafts.mjs';

const $ = (id) => document.getElementById(id);
const stage = $('ss-canvas'), ctx = stage.getContext('2d');
stage.width = W; stage.height = H;
const canvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };

// Bottom to top: song card (+ blurred backdrop) → cover (base minus scratched mask) → drawings → layers.
const base = canvas(), bctx = base.getContext('2d');     // the cover picture: photos/clips, background or foil
const mask = canvas(), mctx = mask.getContext('2d', { willReadFrequently: true }); // where it has been scratched
const cover = canvas(), cctx = cover.getContext('2d');
let foil = null, backdrop = null, baseDirty = true;

const audio = new Audio();
audio.crossOrigin = 'anonymous';
audio.preload = 'metadata';
audio.loop = true;

const S = {
  tracks: [], song: null, start: 0, brush: 46,
  strokes: [], t0: 0, down: false, last: null,
  revealed: 0, recording: false, playing: false, dust: [],
  mode: 'scratch',                  // finger on empty story: scratch | draw | move | frame
  scratch: true,                    // false: no cover, the card sits on the picture
  cover: { kind: 'foil', bg: 'lagoon', layout: 'single' },  // kind: foil | bg | media
  media: [], cell: 0,               // media[i] = {asset, type, zoom, px, py, rot} for layout cell i
  layers: [], paths: [], sel: null,
  pen: { style: 'pen', color: '#ffffff', size: 12 },
  text: { font: 'classic', color: '#ffffff', bg: 'none', align: 'center', anim: 'none' },
  filter: 'none', card: 'glass', cardOn: true,
  anim0: performance.now(),
};
const assets = new Map();           // id → {el, blob, type}
let assetSeq = 1;
const hist = history();
const snapshot = () => ({ layers: S.layers, paths: S.paths });
function remember() { hist.push(snapshot()); $('ss-undo').disabled = false; dirty(); }
const asset = (id) => assets.get(id)?.el || null;
const videos = () => S.media.filter(Boolean).filter((m) => m.type === 'video').map((m) => asset(m.asset)).filter(Boolean);
const coverChanged = () => { baseDirty = true; backdrop = null; dirty(); };

/* ---------- drawing ---------- */

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
  if (lines.join(' ').split(/\s+/).length < words.length) {
    let l = lines[maxLines - 1];
    while (l && c.measureText(l + '…').width > maxW) l = l.slice(0, -1);
    lines[maxLines - 1] = l.trimEnd() + '…';
  }
  return lines;
}

const songInfo = () => S.song ? { ...splitTitle(S.song.title), colours: coverColours(S.song.id) } : null;

function makeFoil() {
  foil = canvas(); const f = foil.getContext('2d');
  const g = f.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#cfd8df'); g.addColorStop(.35, '#f4f7f9'); g.addColorStop(.6, '#aab6c0'); g.addColorStop(1, '#e6ebef');
  f.fillStyle = g; f.fillRect(0, 0, W, H);
  f.globalAlpha = .08; f.fillStyle = '#06182b';
  for (let i = 0; i < 2600; i++) f.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  f.globalAlpha = 1;
  f.fillStyle = 'rgba(6,24,43,.72)'; f.textAlign = 'center';
  f.font = '800 54px Manrope, system-ui, sans-serif'; f.fillText('Scratch me', W / 2, H / 2 - 10);
  f.font = '400 28px Lexend, system-ui, sans-serif'; f.fillText('to hear the song', W / 2, H / 2 + 36);
  f.font = '700 24px Manrope, system-ui, sans-serif'; f.fillText('Sota Kece', W / 2, H - 80);
}

/** The cover picture itself. */
function paintBase(c) {
  c.clearRect(0, 0, W, H);
  if (S.cover.kind === 'foil') { if (!foil) makeFoil(); c.drawImage(foil, 0, 0); return; }
  if (S.cover.kind === 'bg') { drawBackground(c, S.cover.bg, W, H); return; }
  c.fillStyle = '#05080c'; c.fillRect(0, 0, W, H);
  cellRects(S.cover.layout, W, H).forEach((rect, i) => {
    const item = S.media[i], el = item && asset(item.asset);
    if (el) { drawMediaInCell(c, { ...item, el }, rect, FILTERS[S.filter].css); return; }
    const [x, y, w, h] = rect;
    c.fillStyle = '#0f2a44'; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(234,246,255,.6)'; c.textAlign = 'center'; c.font = '600 30px Lexend, system-ui, sans-serif';
    c.fillText('+ photo or clip', x + w / 2, y + h / 2);
  });
}
function refreshBase() {
  if (baseDirty || videos().length) { paintBase(bctx); baseDirty = false; }
}

function makeBackdrop() {
  backdrop = document.createElement('canvas'); backdrop.width = W / 4; backdrop.height = H / 4;
  const b = backdrop.getContext('2d');
  if (S.cover.kind !== 'foil') {
    refreshBase();
    b.filter = 'blur(6px) saturate(1.3)'; b.drawImage(base, 0, 0, W / 4, H / 4); b.filter = 'none';
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
  c.fillStyle = 'rgba(255,255,255,.14)';
  const n = 8, tw = s / n;
  for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(x + i * tw, y + s); c.lineTo(x + i * tw + tw / 2, y + s - tw * .9); c.lineTo(x + (i + 1) * tw, y + s); c.fill(); }
  const cx = x + s * .5, cy = y + s * .44, r = s * .28, a = S.playing ? now / 900 : 0;
  c.fillStyle = 'rgba(5,15,28,.85)'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
  for (let k = .45; k < 1; k += .14) { c.beginPath(); c.arc(cx, cy, r * k, a, a + 4.2); c.stroke(); }
  c.fillStyle = c1; c.beginPath(); c.arc(cx, cy, r * .3, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r * .06, 0, 7); c.fill();
  c.restore();
}

/** The song card. `onPicture`: drawn over the picture (scratch off), so no blurred backdrop. */
function drawCard(c, now, onPicture) {
  if (!onPicture) {
    if (!backdrop) makeBackdrop();
    c.imageSmoothingEnabled = true;
    c.drawImage(backdrop, 0, 0, W, H);
    const vg = c.createRadialGradient(W / 2, H * .45, 80, W / 2, H * .45, H * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  if (!S.cardOn) return;
  const st = CARD_STYLES[S.card];
  const cw = 520, ch = 700, x = (W - cw) / 2, y = (H - ch) / 2 - 20;
  c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 50; c.shadowOffsetY = 20;
  roundRect(c, x, y, cw, ch, 36); c.fillStyle = st.fill; c.fill(); c.restore();
  roundRect(c, x, y, cw, ch, 36); c.strokeStyle = st.line; c.lineWidth = 2; c.stroke();

  const pad = 40, art = cw - pad * 2;
  drawCoverArt(c, x + pad, y + pad, art, now);
  const { song, artist } = S.song ? splitTitle(S.song.title) : { song: 'Choose a song', artist: 'Island Mix' };
  let ty = y + pad + art + 52;
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = st.text;
  c.font = '800 36px Manrope, system-ui, sans-serif';
  for (const l of wrap(c, song, art - 80, 2)) { c.fillText(l, x + pad, ty); ty += 42; }
  c.font = '400 26px Lexend, system-ui, sans-serif'; c.fillStyle = st.sub;
  c.fillText(wrap(c, artist || (S.song?.playlist ?? ''), art, 1)[0] || '', x + pad, ty + 2);

  const dur = Number.isFinite(audio.duration) ? audio.duration : 0, cur = audio.currentTime || S.start;
  const py = y + ch - 78, pw = art, k = dur ? Math.min(1, cur / dur) : 0;
  c.fillStyle = st.line; roundRect(c, x + pad, py, pw, 8, 4); c.fill();
  c.fillStyle = st.bar; roundRect(c, x + pad, py, Math.max(8, pw * k), 8, 4); c.fill();
  c.beginPath(); c.arc(x + pad + pw * k, py + 4, 10, 0, 7); c.fill();
  c.font = '500 20px Lexend, system-ui, sans-serif'; c.fillStyle = st.sub;
  c.fillText(fmtTime(cur), x + pad, py + 40);
  c.textAlign = 'right'; c.fillText(dur ? '-' + fmtTime(dur - cur) : '', x + pad + pw, py + 40);

  c.textAlign = 'left';
  const bx = x + cw - pad - 64, by = y + pad + art + 18;
  for (let i = 0; i < 5; i++) {
    const h = S.playing ? 10 + 22 * Math.abs(Math.sin(now / (180 + i * 37) + i)) : 8;
    c.fillStyle = st.bar; roundRect(c, bx + i * 13, by + 34 - h, 8, h, 3); c.fill();
  }
  if (!onPicture) {
    c.textAlign = 'center'; c.fillStyle = 'rgba(234,246,255,.85)';
    c.font = '700 26px Manrope, system-ui, sans-serif'; c.fillText('Sota Kece', W / 2, H - 92);
    c.font = '400 20px Lexend, system-ui, sans-serif'; c.fillStyle = 'rgba(159,191,214,.9)';
    c.fillText('sotakece.com · Island Mix', W / 2, H - 62);
  }
}

function clearMask() { mctx.clearRect(0, 0, W, H); S.revealed = 0; }

/** Scratch = paint the mask; the cover is the base with the mask cut out of it. */
function scratch(a, b, r) {
  const c = mctx;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#000'; c.lineWidth = r;
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  c.lineWidth = r * .3;  // ragged edges so it looks scratched, not erased
  const seed = (a.x * 7 + b.y * 13) % 1;
  for (let i = 0; i < 3; i++) {
    const o = (i - 1) * r * .55 + (seed - .5) * 6;
    c.beginPath(); c.moveTo(a.x + o, a.y - o * .4); c.lineTo(b.x + o, b.y - o * .4); c.stroke();
  }
}

function composeCover() {
  refreshBase();
  cctx.globalCompositeOperation = 'source-over';
  cctx.clearRect(0, 0, W, H);
  cctx.drawImage(base, 0, 0);
  cctx.globalCompositeOperation = 'destination-out';
  cctx.drawImage(mask, 0, 0);
  cctx.globalCompositeOperation = 'source-over';
}

function addDust(p) {
  if (S.dust.length > 140) return;
  for (let i = 0; i < 3; i++) S.dust.push({ x: p.x, y: p.y, vx: (Math.random() - .5) * 5, vy: -Math.random() * 4, life: 1, s: 2 + Math.random() * 4 });
}
function drawDust(c) {
  c.fillStyle = S.cover.kind === 'foil' ? 'rgba(210,220,228,.95)' : 'rgba(255,255,255,.8)';
  for (const d of S.dust) { c.globalAlpha = Math.max(0, d.life); c.fillRect(d.x, d.y, d.s, d.s); d.x += d.vx; d.y += d.vy; d.vy += .35; d.life -= .04; }
  c.globalAlpha = 1;
  S.dust = S.dust.filter((d) => d.life > 0);
}

/** One full picture of the story. `clean` leaves out the editing marks (for saved files). */
function render(now, clean) {
  if (S.scratch) {
    drawCard(ctx, now, false);
    composeCover();
    ctx.drawImage(cover, 0, 0);
  } else {
    refreshBase();
    ctx.drawImage(base, 0, 0);
    drawCard(ctx, now, true);
  }
  drawDust(ctx);
  drawPaths(ctx, S.paths);
  const info = songInfo(), t = (now - S.anim0) / 1000;
  for (const L of S.layers) drawLayer(ctx, L, info, t, asset);
  if (clean) return;
  if (S.sel && S.layers.includes(S.sel)) drawSelection(ctx, S.sel);
  if (S.mode === 'frame' && S.cover.kind === 'media') {
    const r = cellRects(S.cover.layout, W, H)[S.cell];
    if (r) { ctx.save(); ctx.setLineDash([14, 10]); ctx.lineWidth = 4; ctx.strokeStyle = '#87CEEB'; ctx.strokeRect(r[0] + 2, r[1] + 2, r[2] - 4, r[3] - 4); ctx.restore(); }
  }
}

function frame(now) {
  if (!S.recording) render(now, false);  // the recorder draws its own frames
  requestAnimationFrame(frame);
}

/* ---------- pointer ---------- */

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
      say('Playing ' + splitTitle(S.song.title).song + '.');
    }
  } catch (e) { if (e?.name !== 'AbortError') say('Tap again to start the music.'); }
}

let revealTimer = 0;
function measureReveal() {
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => {
    try {
      const small = document.createElement('canvas'); small.width = 90; small.height = 160;
      small.getContext('2d').drawImage(mask, 0, 0, 90, 160);
      S.revealed = 1 - clearedShare(small.getContext('2d').getImageData(0, 0, 90, 160).data);
    } catch (_) { return; }
    $('ss-revealed').textContent = S.scratch && S.strokes.length ? Math.round(S.revealed * 100) + '% scratched' : '';
    savable();
  }, 150);
}
const hasContent = () => !!(S.strokes.length || S.layers.length || S.paths.length || S.media.some(Boolean) || S.cover.kind === 'bg' || !S.scratch);
function savable() { $('ss-save').disabled = !hasContent(); $('ss-picture').disabled = !hasContent(); }

const ptrs = new Map();
let gesture = null;          // moving a layer: {layer, start, from}
let framing = null;          // moving / zooming a photo in its cell: {item, start, from, rect}
let drawing = null;
const bin = $('ss-bin');
const overBin = (p) => p.y > H - 170 && Math.abs(p.x - W / 2) < 110;

function startGesture(g, target) {
  const pts = [...ptrs.values()];
  return { ...g, start: { ...target }, from: pts.map((p) => ({ ...p })) };
}

stage.addEventListener('pointerdown', (e) => {
  if (S.recording) return;
  stage.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  ptrs.set(e.pointerId, p);

  if (gesture) { gesture = startGesture(gesture, gesture.layer); return; }
  if (framing) { framing = startGesture(framing, framing.item); return; }

  if (S.mode === 'frame') {
    if (S.cover.kind !== 'media') { say('Framing is for photos and clips. Add some in Cover.'); return; }
    const i = cellAt(S.cover.layout, W, H, p.x, p.y);
    if (i < 0) return;
    S.cell = i; showFrame();
    const item = S.media[i];
    if (!item) { pickFiles(i); return; }
    framing = startGesture({ item, rect: cellRects(S.cover.layout, W, H)[i] }, item);
    return;
  }

  if (S.mode !== 'draw') {
    const hit = hitLayer(ctx, S.layers, p.x, p.y);
    if (hit) {
      remember();
      S.sel = hit;
      S.layers = S.layers.filter((l) => l !== hit).concat(hit);
      gesture = startGesture({ layer: hit }, hit);
      showSelected();
      return;
    }
    if (S.sel) { S.sel = null; showSelected(); }
  }

  if (S.mode === 'draw') {
    remember();
    drawing = { style: S.pen.style, color: S.pen.color, size: S.pen.size, pts: [p] };
    S.paths = S.paths.concat([drawing]);
    savable();
    return;
  }
  if (S.mode === 'move') return;

  if (!S.scratch) { say('Scratch is off for this story. Turn it on in Cover, or use Move and Draw.'); return; }
  if (!S.song) { say('Choose a song first.'); return; }
  S.down = true;
  if (!S.strokes.length) S.t0 = performance.now();
  const pt = { t: performance.now() - S.t0, x: p.x, y: p.y, r: S.brush, down: true };
  S.strokes.push(pt); S.last = pt;
  scratch(pt, { x: pt.x + .1, y: pt.y + .1 }, S.brush);
  addDust(pt);
  startMusic();
  $('ss-tip').hidden = true;
});

stage.addEventListener('pointermove', (e) => {
  if (S.recording || !ptrs.has(e.pointerId)) return;
  const p = toCanvas(e);
  ptrs.set(e.pointerId, p);
  const now = [...ptrs.values()];

  if (gesture) {
    const L = gesture.layer, st = gesture.start;
    if (now.length >= 2 && gesture.from.length >= 2) {
      const { k, dr } = pinch(gesture.from, now);
      const mid = (a) => ({ x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 });
      const m0 = mid(gesture.from), m1 = mid(now);
      L.s = clampScale(st.s * k); L.r = st.r + dr; L.x = st.x + m1.x - m0.x; L.y = st.y + m1.y - m0.y;
    } else { L.x = st.x + p.x - gesture.from[0].x; L.y = st.y + p.y - gesture.from[0].y; }
    bin.hidden = false; bin.classList.toggle('is-hot', ptrs.size === 1 && overBin(p));
    return;
  }
  if (framing) {
    const it = framing.item, st = framing.start, [, , cw, ch] = framing.rect, el = asset(it.asset);
    if (now.length >= 2 && framing.from.length >= 2) it.zoom = Math.min(5, Math.max(1, (st.zoom || 1) * pinch(framing.from, now).k));
    else { it.px = (st.px || 0) + p.x - framing.from[0].x; it.py = (st.py || 0) + p.y - framing.from[0].y; }
    if (el) Object.assign(it, clampPan(mediaSize(el), cw, ch, it));
    coverChanged(); $('ss-zoom').value = String(it.zoom || 1);
    return;
  }
  if (drawing) { for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) drawing.pts.push(toCanvas(ev)); return; }
  if (!S.down) return;
  for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) {
    const q = toCanvas(ev);
    const pt = { t: performance.now() - S.t0, x: q.x, y: q.y, r: S.brush, down: false };
    scratch(S.last, pt, S.brush);
    S.strokes.push(pt); S.last = pt;
    if (Math.random() < .35) addDust(pt);
  }
  measureReveal();
});

function endPointer(e) {
  const p = ptrs.get(e.pointerId);
  ptrs.delete(e.pointerId);
  if (gesture) {
    if (!ptrs.size) {
      if (p && overBin(p) && bin.classList.contains('is-hot')) deleteLayer(gesture.layer, false);
      gesture = null; bin.hidden = true; bin.classList.remove('is-hot');
    } else gesture = startGesture(gesture, gesture.layer);
    return;
  }
  if (framing) { framing = ptrs.size ? startGesture(framing, framing.item) : null; return; }
  if (drawing) { drawing = null; dirty(); }
  if (S.down) { S.down = false; measureReveal(); dirty(); }
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('dblclick', (e) => {
  const p = toCanvas(e), hit = hitLayer(ctx, S.layers, p.x, p.y);
  if (hit?.type === 'text') { S.sel = hit; showSelected(); openTab('text'); $('ss-text').focus(); }
});

/* ---------- selection, layers, undo ---------- */

function deleteLayer(L, keepHistory = true) {
  if (keepHistory) remember(); else dirty();
  S.layers = S.layers.filter((l) => l !== L);
  if (S.sel === L) S.sel = null;
  showSelected(); savable();
}

function showSelected() {
  const L = S.sel, box = $('ss-selected');
  box.hidden = !L;
  if (!L) return;
  $('ss-sel-name').textContent = { text: 'Text', chip: 'Song sticker', word: 'Word sticker', moving: 'Moving sticker', image: 'Your sticker' }[L.type] || 'Sticker';
  $('ss-sel-size').value = String(L.s);
  $('ss-sel-turn').value = String(Math.round(L.r * 180 / Math.PI));
  $('ss-sel-edit').hidden = L.type !== 'text';
  chips($('ss-sel-anim'), Object.entries(ANIMS).filter(([k]) => k !== 'type' || L.type === 'text'), L.anim || 'none', (k) => {
    remember(); L.anim = k; S.anim0 = performance.now(); showSelected();
  });
  if (L.type === 'text') {
    $('ss-text').value = L.text;
    Object.assign(S.text, { font: L.font, color: L.color, bg: L.bg, align: L.align, anim: L.anim || 'none' });
    paintTextChoices();
  }
}

$('ss-sel-size').addEventListener('input', (e) => { if (S.sel) S.sel.s = clampScale(Number(e.target.value)); });
$('ss-sel-turn').addEventListener('input', (e) => { if (S.sel) S.sel.r = Number(e.target.value) * Math.PI / 180; });
$('ss-sel-size').addEventListener('pointerdown', () => remember());
$('ss-sel-turn').addEventListener('pointerdown', () => remember());
$('ss-sel-delete').addEventListener('click', () => { if (S.sel) deleteLayer(S.sel); });
$('ss-sel-edit').addEventListener('click', () => { openTab('text'); $('ss-text').focus(); });
$('ss-sel-front').addEventListener('click', () => { if (!S.sel) return; remember(); S.layers = S.layers.filter((l) => l !== S.sel).concat(S.sel); });
$('ss-sel-copy').addEventListener('click', () => {
  if (!S.sel) return;
  const { id, ...rest } = S.sel;
  addLayer({ ...JSON.parse(JSON.stringify(rest)), x: S.sel.x + 40, y: S.sel.y + 40 }, 'Copied.');
});
$('ss-sel-done').addEventListener('click', () => { S.sel = null; showSelected(); });
$('ss-replay').addEventListener('click', () => { S.anim0 = performance.now(); });

$('ss-undo').addEventListener('click', () => {
  const prev = hist.pop();
  if (!prev) return;
  S.layers = prev.layers; S.paths = prev.paths; S.sel = null;
  showSelected(); savable(); dirty();
  $('ss-undo').disabled = !hist.size;
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); deleteLayer(S.sel); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('ss-undo').click(); }
});

function addLayer(props, msg) {
  remember();
  const L = newLayer({ x: W / 2 + (Math.random() - .5) * 120, y: H * .3 + (Math.random() - .5) * 160, ...props });
  S.layers = S.layers.concat(L); S.sel = L;
  if (L.anim && L.anim !== 'none') S.anim0 = performance.now();
  setMode('move');
  showSelected(); savable();
  say(msg || 'Drag it into place. Pinch to resize and turn. Drag it to the bin to delete.');
  return L;
}

/* ---------- modes and tabs ---------- */

function setMode(m) {
  S.mode = m;
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  stage.dataset.mode = m;
  $('ss-tip').hidden = !(m === 'scratch' && S.scratch && S.song && !S.strokes.length);
  if (m === 'frame') showFrame();
}
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));

function openTab(name) {
  for (const t of document.querySelectorAll('[data-tab]')) {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', String(on));
    $('ss-tab-' + t.dataset.tab).hidden = !on;
  }
  if (name === 'draw') setMode('draw');
  else if (S.mode === 'draw') setMode(S.scratch ? 'scratch' : 'move');
  if (name === 'save') refreshDrafts();
}
for (const t of document.querySelectorAll('[data-tab]')) t.addEventListener('click', () => openTab(t.dataset.tab));

function chips(host, items, current, onPick, cls = 'ss-chip') {
  host.textContent = '';
  for (const [key, label, style] of items) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.setAttribute('aria-pressed', String(key === current));
    if (style) b.style.cssText = style;
    b.textContent = label;
    if (cls === 'ss-swatch') b.setAttribute('aria-label', 'Colour ' + key);
    b.addEventListener('click', () => onPick(key));
    host.append(b);
  }
}

/* ---------- text ---------- */

function paintTextChoices() {
  chips($('ss-fonts'), Object.entries(FONTS).map(([k, f]) => [k, f.label, `font:${f.css(15)}`]), S.text.font, (k) => setText({ font: k }));
  chips($('ss-text-colours'), COLOURS.map((c) => [c, '', `background:${c}`]), S.text.color, (c) => setText({ color: c }), 'ss-swatch');
  chips($('ss-text-bg'), [['none', 'No box'], ['soft', 'Dark box'], ['solid', 'Colour box']], S.text.bg, (k) => setText({ bg: k }));
  chips($('ss-text-align'), [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], S.text.align, (k) => setText({ align: k }));
  chips($('ss-text-anim'), Object.entries(ANIMS), S.text.anim, (k) => { setText({ anim: k }); S.anim0 = performance.now(); });
}
function setText(change) {
  Object.assign(S.text, change);
  if (S.sel?.type === 'text') { remember(); Object.assign(S.sel, change); }
  paintTextChoices();
}
$('ss-text').addEventListener('input', (e) => { if (S.sel?.type === 'text') S.sel.text = e.target.value || ' '; });
$('ss-text').addEventListener('focus', () => { if (S.sel?.type === 'text') remember(); });
$('ss-text-add').addEventListener('click', () => {
  const v = $('ss-text').value.trim();
  if (S.sel?.type === 'text') { S.sel = null; showSelected(); $('ss-text').value = ''; say('Text done.'); return; }
  if (!v) { say('Type something first.'); $('ss-text').focus(); return; }
  addLayer({ type: 'text', text: v, ...S.text, y: H * .2 });
  $('ss-text').value = '';
});

/* ---------- stickers ---------- */

for (const ch of EMOJI) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ss-sticker'; b.textContent = ch; b.setAttribute('aria-label', 'Add sticker ' + ch);
  b.addEventListener('click', () => addLayer({ type: 'emoji', ch }));
  $('ss-stickers').append(b);
}
WORDS.forEach((w, i) => {
  const color = ['#ff6856', '#ffcb47', '#87CEEB', '#2ecc71', '#ff5fa2', '#8e6cff'][i % 6];
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ss-word'; b.textContent = w; b.style.background = color;
  b.addEventListener('click', () => addLayer({ type: 'word', text: w, color }));
  $('ss-words').append(b);
});
for (const [kind, m] of Object.entries(MOVING)) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ss-chip ss-moving'; b.textContent = m.label;
  b.addEventListener('click', () => addLayer({ type: 'moving', kind }, 'Moving sticker added. It moves in the saved video too.'));
  $('ss-moving').append(b);
}
$('ss-chip').addEventListener('click', () => {
  if (!S.song) { say('Choose a song first, then add its sticker.'); openTab('song'); return; }
  addLayer({ type: 'chip', y: H * .82 }, 'Song sticker added.');
});
$('ss-own-sticker').addEventListener('click', () => $('ss-sticker-file').click());
$('ss-sticker-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file || !/^image\//.test(file.type)) { say('Choose a picture for your sticker.'); return; }
  const id = await addAsset(file);
  if (!id) return;
  const { w, h } = mediaSize(asset(id)), k = Math.min(320 / w, 320 / h, 1);
  addLayer({ type: 'image', asset: id, w: Math.round(w * k), h: Math.round(h * k) }, 'Your sticker is on. PNGs with see-through backgrounds look best.');
});

/* ---------- draw ---------- */

function paintPens() {
  chips($('ss-pens'), Object.entries(PENS).map(([k, p]) => [k, p.label]), S.pen.style, (k) => { S.pen.style = k; paintPens(); });
  chips($('ss-pen-colours'), COLOURS.map((c) => [c, '', `background:${c}`]), S.pen.color, (c) => { S.pen.color = c; paintPens(); }, 'ss-swatch');
}
$('ss-pen-size').addEventListener('input', (e) => { S.pen.size = Number(e.target.value); });
$('ss-draw-clear').addEventListener('click', () => { if (!S.paths.length) return; remember(); S.paths = []; savable(); });

/* ---------- look ---------- */

function paintLook() {
  chips($('ss-filters'), Object.entries(FILTERS).map(([k, f]) => [k, f.label]), S.filter, (k) => {
    S.filter = k; coverChanged();
    if (S.cover.kind !== 'media') say('Filters change photos and clips. Add some in Cover.');
    paintLook();
  });
  chips($('ss-cards'), [...Object.entries(CARD_STYLES).map(([k, c]) => [k, c.label]), ['off', 'No card']], S.cardOn ? S.card : 'off', (k) => {
    if (k === 'off') S.cardOn = false; else { S.cardOn = true; S.card = k; }
    dirty(); paintLook();
  });
  chips($('ss-templates'), Object.entries(TEMPLATES).map(([k, t]) => [k, t.label]), '', applyTemplate, 'ss-chip ss-template');
}

function applyTemplate(key) {
  const t = TEMPLATES[key]; if (!t) return;
  remember();
  S.layers = t.layers.map((l) => newLayer({ ...l }));
  S.card = t.card; S.cardOn = true;
  if (S.cover.kind !== 'media') { S.cover.kind = 'bg'; S.cover.bg = t.bg; coverChanged(); paintCoverChoices(); }
  if (S.layers.some((l) => l.type === 'chip') && !S.song) say(`${t.label} template on. Choose a song for the song sticker.`);
  else say(`${t.label} template on. Tap anything to change it.`);
  S.sel = null; showSelected(); setMode('move'); paintLook(); savable();
  S.anim0 = performance.now();
}

/* ---------- cover: photos, clips, layouts, backgrounds, framing ---------- */

async function addAsset(file) {
  const url = URL.createObjectURL(file), video = /^video\//.test(file.type);
  const el = video ? document.createElement('video') : new Image();
  try {
    await new Promise((resolve, reject) => {
      if (video) {
        Object.assign(el, { muted: true, loop: true, playsInline: true, preload: 'auto' });
        el.setAttribute('playsinline', ''); el.onloadeddata = resolve; el.onerror = reject; el.src = url;
      } else { el.onload = resolve; el.onerror = reject; el.src = url; }
    });
  } catch (_) { say(video ? 'That clip could not be played here. Try an MP4.' : 'That picture could not be opened.'); return null; }
  if (video) el.play().catch(() => {});
  const id = 'a' + assetSeq++;
  assets.set(id, { el, blob: file, type: video ? 'video' : 'image' });
  return id;
}

let pickTarget = -1;
function pickFiles(cell = -1) { pickTarget = cell; $('ss-file').click(); }
$('ss-photo').addEventListener('click', () => pickFiles(-1));
$('ss-file').addEventListener('change', async (e) => { const files = [...e.target.files]; e.target.value = ''; await useFiles(files, pickTarget); });
stage.addEventListener('dragover', (e) => e.preventDefault());
stage.addEventListener('drop', (e) => { e.preventDefault(); useFiles([...e.dataTransfer.files], -1); });

async function useFiles(files, cell) {
  files = files.filter((f) => /^(image|video)\//.test(f.type)).slice(0, 4);
  if (!files.length) { say('Choose photos (JPEG, PNG, WebP) or video clips (MP4).'); return; }
  if (files.some((f) => f.size > 300 * 1024 * 1024)) { say('That clip is too big for the phone to edit. Try a shorter one.'); return; }
  if (S.cover.kind !== 'media') { S.cover.kind = 'media'; S.media = []; }
  if (cell < 0 && files.length > 1) {
    S.cover.layout = { 2: 'two-v', 3: 'three', 4: 'four' }[files.length] || S.cover.layout;
    S.media = []; cell = 0;
  }
  const n = LAYOUTS[S.cover.layout].n;
  let at = cell >= 0 ? cell : S.media.slice(0, n).findIndex((m) => !m);
  if (at < 0) at = S.media.length < n ? S.media.length : S.cell;
  for (const f of files) {
    say(/^video/.test(f.type) ? 'Loading your clip…' : 'Loading your photo…');
    const id = await addAsset(f);
    if (!id) continue;
    S.media[at] = { asset: id, type: assets.get(id).type, zoom: 1, px: 0, py: 0, rot: 0 };
    S.cell = at;
    at = (at + 1) % n;
  }
  coverChanged(); paintCoverChoices(); showFrame(); savable();
  say(S.song ? (S.scratch ? 'Scratch it to reveal the song. Use Frame to crop, zoom or turn.' : 'Use Frame to crop, zoom or turn.') : 'Now choose a song.');
  if (S.scratch && S.strokes.length === 0) $('ss-tip').hidden = !S.song;
}

function paintCoverChoices() {
  chips($('ss-layouts'), Object.entries(LAYOUTS).map(([k, l]) => [k, l.label]), S.cover.kind === 'media' ? S.cover.layout : '', (k) => {
    S.cover.layout = k; if (S.cover.kind !== 'media') { S.cover.kind = 'media'; S.media = []; }
    S.cell = Math.min(S.cell, LAYOUTS[k].n - 1);
    coverChanged(); paintCoverChoices(); showFrame(); setMode('frame');
    say('Tap a space on the story to fill it with a photo or clip.');
  });
  chips($('ss-backgrounds'), [['foil', 'Silver card', 'background:linear-gradient(135deg,#cfd8df,#f4f7f9,#aab6c0)'], ...Object.entries(BACKGROUNDS).map(([k, b]) => [k, b.label, `background:linear-gradient(135deg,${b.stops[0]},${b.stops[1]});color:#fff`])],
    S.cover.kind === 'foil' ? 'foil' : S.cover.kind === 'bg' ? S.cover.bg : '', (k) => {
      if (k === 'foil') S.cover.kind = 'foil'; else { S.cover.kind = 'bg'; S.cover.bg = k; }
      coverChanged(); paintCoverChoices(); showFrame(); savable();
    }, 'ss-chip ss-bg');
  $('ss-scratch-on').checked = S.scratch;
}

function showFrame() {
  const item = S.cover.kind === 'media' ? S.media[S.cell] : null;
  $('ss-frame').hidden = !item;
  if (!item) return;
  $('ss-frame-name').textContent = (item.type === 'video' ? 'Clip' : 'Photo') + (LAYOUTS[S.cover.layout].n > 1 ? ` ${S.cell + 1}` : '');
  $('ss-zoom').value = String(item.zoom || 1);
}
const framed = (fn) => () => {
  const item = S.media[S.cell], el = item && asset(item.asset); if (!item) return;
  fn(item);
  const r = cellRects(S.cover.layout, W, H)[S.cell];
  if (el) Object.assign(item, clampPan(mediaSize(el), r[2], r[3], item));
  coverChanged(); showFrame();
};
$('ss-zoom').addEventListener('input', framed((it) => { it.zoom = Number($('ss-zoom').value); }));
$('ss-rotate').addEventListener('click', framed((it) => { it.rot = ((it.rot || 0) + 90) % 360; }));
$('ss-frame-reset').addEventListener('click', framed((it) => { Object.assign(it, { zoom: 1, px: 0, py: 0, rot: 0 }); }));
$('ss-frame-replace').addEventListener('click', () => pickFiles(S.cell));
$('ss-frame-remove').addEventListener('click', () => { S.media[S.cell] = null; coverChanged(); showFrame(); savable(); });
$('ss-frame-mode').addEventListener('click', () => { setMode('frame'); say('Drag to move the photo in its space. Pinch or use Zoom to crop.'); });

$('ss-scratch-on').addEventListener('change', (e) => {
  S.scratch = e.target.checked; backdrop = null; dirty();
  setMode(S.scratch ? 'scratch' : 'move');
  $('ss-tip').hidden = !(S.scratch && S.song && !S.strokes.length);
  say(S.scratch ? 'Scratch is on: the song card hides under your cover.' : 'Scratch is off: the song card sits on your picture.');
  savable();
});

/* ---------- songs ---------- */

function say(t) { $('ss-status').textContent = t; }

function renderList() {
  const list = $('ss-songs');
  list.textContent = '';
  const found = searchTracks(S.tracks, $('ss-search').value, 60);
  if (!found.length) { const li = document.createElement('li'); li.className = 'ss-empty'; li.textContent = S.tracks.length ? 'No songs match that.' : 'Loading songs…'; list.append(li); return; }
  for (const t of found) {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = 'ss-song'; b.setAttribute('aria-pressed', String(S.song?.id === t.id));
    const { song, artist } = splitTitle(t.title);
    const name = document.createElement('b'); name.textContent = song;
    const by = document.createElement('small'); by.textContent = artist || t.playlist;
    b.append(name, by);
    b.addEventListener('click', () => chooseSong(t));
    li.append(b); list.append(li);
  }
}

function chooseSong(t, keepScratch = false) {
  S.song = t;
  if (!keepScratch) S.start = 0;
  audio.pause(); audio.src = t.url; audio.currentTime = 0;
  $('ss-start').value = String(S.start); $('ss-start-label').textContent = fmtTime(S.start);
  backdrop = null;
  if (!keepScratch) resetScratch(false);
  renderList();
  $('ss-picked').textContent = splitTitle(t.title).song;
  if (!keepScratch) {
    say(S.scratch ? 'Now scratch the picture to hear it.' : 'Song chosen. Press Play to hear it.');
    setMode(S.scratch ? 'scratch' : 'move');
    $('ss-tip').hidden = !S.scratch;
  }
  dirty();
}

audio.addEventListener('loadedmetadata', () => {
  const max = Math.max(0, Math.floor(audio.duration - 20));
  $('ss-start').max = String(max); $('ss-start').disabled = !max;
  if (S.start) audio.currentTime = S.start;
});
audio.addEventListener('play', () => { S.playing = true; $('ss-play').textContent = 'Pause'; });
audio.addEventListener('pause', () => { S.playing = false; $('ss-play').textContent = 'Play'; });
audio.addEventListener('error', () => { if (S.song) say('This song would not load. Try another one.'); });

$('ss-start').addEventListener('input', (e) => {
  S.start = Number(e.target.value) || 0;
  $('ss-start-label').textContent = fmtTime(S.start);
  if (S.song) audio.currentTime = S.start;
  dirty();
});
$('ss-play').addEventListener('click', () => {
  if (!S.song) { say('Choose a song first.'); return; }
  if (audio.paused) startMusic(); else audio.pause();
});
$('ss-search').addEventListener('input', renderList);

/* ---------- scratch tools ---------- */

$('ss-brush').addEventListener('input', (e) => { S.brush = Number(e.target.value); });

function resetScratch(stopMusic = true) {
  S.strokes = []; S.last = null; S.dust = [];
  clearMask();
  if (stopMusic) { audio.pause(); if (S.song) audio.currentTime = S.start; }
  $('ss-revealed').textContent = '';
  savable(); dirty();
}
$('ss-reset').addEventListener('click', () => { resetScratch(); if (S.scratch) setMode('scratch'); say('Covered again. Scratch away.'); $('ss-tip').hidden = !(S.song && S.scratch); });
$('ss-reveal').addEventListener('click', () => {
  if (!S.song) { say('Choose a song first.'); return; }
  if (!S.scratch) { say('Scratch is off, so the song card already shows.'); return; }
  if (!S.strokes.length) S.t0 = performance.now();
  const start = performance.now() - S.t0 + 120;
  let t = start, first = true;
  for (let y = 40; y < H; y += 90) {
    const row = y / 90 % 2 ? [W - 30, 30] : [30, W - 30];
    for (const x of row) { S.strokes.push({ t, x, y, r: 120, down: first }); first = false; t += 70; }
  }
  replay(S.strokes.filter((p) => p.t >= start));
  startMusic(); measureReveal(); dirty();
  $('ss-tip').hidden = true;
});

function replay(pts) {
  let last = null;
  for (const p of pts) { if (p.down || !last) scratch(p, { x: p.x + .1, y: p.y + .1 }, p.r); else scratch(last, p, p.r); last = p; }
}

/* ---------- drafts (on this phone) ---------- */

let isDirty = false, restoring = false;
function dirty() { if (!restoring) isDirty = true; }

function thumbnail() {
  render(performance.now(), true);
  const t = document.createElement('canvas'); t.width = 90; t.height = 160;
  t.getContext('2d').drawImage(stage, 0, 0, 90, 160);
  try { return t.toDataURL('image/jpeg', .7); } catch (_) { return ''; }
}

function serialise(id, name) {
  const used = new Set([...S.media.filter(Boolean).map((m) => m.asset), ...S.layers.filter((l) => l.type === 'image').map((l) => l.asset)]);
  return {
    id, name: name || (S.song ? splitTitle(S.song.title).song : 'Story'), savedAt: Date.now(), thumb: thumbnail(),
    songId: S.song?.id || null, start: S.start, brush: S.brush,
    scratch: S.scratch, cover: { ...S.cover }, filter: S.filter, card: S.card, cardOn: S.cardOn,
    media: S.media.map((m) => m && { ...m }),
    assets: [...used].map((a) => ({ id: a, type: assets.get(a).type, blob: assets.get(a).blob })),
    layers: JSON.parse(JSON.stringify(S.layers)), paths: S.paths, strokes: S.strokes,
  };
}

let pendingSongId = null;
async function restore(d) {
  restoring = true;
  $('ss-resume').hidden = true;
  try {
    for (const v of videos()) v.pause();
    assets.clear();
    // new ids for loading, then give each asset back the id the draft's layers and photos use
    assetSeq = 1 + Math.max(0, ...(d.assets || []).map((a) => Number(String(a.id).slice(1)) || 0));
    const loaded = [];
    for (const a of d.assets || []) {
      const id = await addAsset(new File([a.blob], 'media', { type: a.blob.type || (a.type === 'video' ? 'video/mp4' : 'image/jpeg') }));
      if (id) loaded.push([a.id, assets.get(id), id]);
    }
    for (const [, , tmp] of loaded) assets.delete(tmp);
    for (const [orig, entry] of loaded) assets.set(orig, entry);
    Object.assign(S, {
      start: d.start || 0, brush: d.brush || 46, scratch: d.scratch !== false, cover: { kind: 'foil', bg: 'lagoon', layout: 'single', ...d.cover },
      filter: d.filter || 'none', card: d.card || 'glass', cardOn: d.cardOn !== false,
      media: d.media || [], cell: 0, layers: d.layers || [], paths: d.paths || [], strokes: d.strokes || [], sel: null,
    });
    hist.clear(); $('ss-undo').disabled = true;
    $('ss-brush').value = String(S.brush);
    clearMask(); replay(S.strokes);
    coverChanged(); paintCoverChoices(); paintLook(); showSelected(); showFrame();
    const song = d.songId && S.tracks.find((t) => t.id === d.songId);
    if (song) chooseSong(song, true); else if (d.songId) pendingSongId = d.songId;
    setMode(S.scratch ? 'scratch' : 'move');
    $('ss-tip').hidden = true;
    measureReveal(); savable();
    S.anim0 = performance.now();
  } finally { restoring = false; isDirty = false; }
}

async function autosave() {
  if (!isDirty || S.recording || S.down || gesture || framing || drawing) return;
  isDirty = false;
  try { if (hasContent()) await saveDraft(serialise(AUTO, 'Last story')); } catch (_) {}
}
setInterval(autosave, 6000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosave(); });

async function refreshDrafts() {
  const host = $('ss-drafts');
  let list = [];
  try { list = await listDrafts(); } catch (_) { host.textContent = 'Drafts need a browser that allows saving on this phone.'; return; }
  host.textContent = '';
  if (!list.length) { const p = document.createElement('p'); p.className = 'ss-help'; p.textContent = 'No drafts yet.'; host.append(p); return; }
  for (const d of list) {
    const row = document.createElement('div'); row.className = 'ss-draft';
    const img = document.createElement('img'); img.alt = ''; if (d.thumb) img.src = d.thumb;
    const label = document.createElement('span'); label.textContent = draftLabel(d);
    const open = document.createElement('button'); open.type = 'button'; open.className = 'ss-btn ss-small'; open.textContent = 'Open';
    open.addEventListener('click', async () => { const full = await getDraft(d.id).catch(() => null); if (full) { await restore(full); say('Draft opened.'); openTab('cover'); } });
    const del = document.createElement('button'); del.type = 'button'; del.className = 'ss-btn ss-small ss-danger'; del.textContent = 'Delete';
    del.setAttribute('aria-label', 'Delete draft ' + (d.name || ''));
    del.addEventListener('click', async () => { await deleteDraft(d.id).catch(() => {}); refreshDrafts(); });
    row.append(img, label, open, del); host.append(row);
  }
}
$('ss-draft-save').addEventListener('click', async () => {
  if (!hasContent()) { say('Make something first, then save it as a draft.'); return; }
  try {
    await saveDraft(serialise('d' + Date.now(), $('ss-draft-name').value.trim()));
    $('ss-draft-name').value = ''; say('Draft saved on this phone.'); refreshDrafts();
  } catch (_) { say('This browser would not save the draft. Private windows cannot keep drafts.'); }
});
$('ss-new').addEventListener('click', () => {
  if (hasContent() && !confirm('Start a new story? Your current one stays in Drafts as “Last story”.')) return;
  autosave().finally(() => location.assign(location.pathname));
});

/* ---------- saving ---------- */

function fileName(ext) {
  const b = S.song ? splitTitle(S.song.title).song.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : 'story';
  return `sota-kece-${b || 'story'}.${ext}`;
}

async function deliver(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sota Kece', text: 'Made on Sota Kece · sotakece.com' }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  return 'saved';
}

$('ss-picture').addEventListener('click', () => {
  render(performance.now(), true);
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
  const tl = buildTimeline(S.scratch ? S.strokes : []);
  const moving = videos().length || S.layers.some((l) => (l.anim && l.anim !== 'none') || l.type === 'moving');
  const total = Math.min(MAX_EXPORT_MS, Math.max(tl.totalMs, S.strokes.length && S.scratch ? 0 : (moving ? 10000 : 6000)));

  S.recording = true; S.sel = null; showSelected(); document.body.classList.add('ss-busy');
  $('ss-save').disabled = true; $('ss-progress').hidden = false;
  say('Making your story video… keep this page open.');

  const out = S.song ? (tap || audioTap()) : null;
  if (actx?.state === 'suspended') await actx.resume().catch(() => {});
  const stream = stage.captureStream(30);
  if (out) for (const track of out.stream.getAudioTracks()) stream.addTrack(track);
  const chunks = [];
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined); }
  catch (_) { rec = new MediaRecorder(stream); }
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((r) => { rec.onstop = r; });

  // replay: cover again, redraw the scratch on its timeline while the song plays; clips and
  // animations start from the beginning.
  clearMask(); S.dust = [];
  for (const v of videos()) { v.currentTime = 0; v.play().catch(() => {}); }
  audio.pause(); audio.currentTime = S.start;
  rec.start(250);
  const t0 = performance.now();
  S.anim0 = t0;
  let i = 0, last = null, musicOn = false;
  await new Promise((resolve) => {
    (function step() {
      const now = performance.now(), t = now - t0;
      $('ss-progress').value = Math.min(1, t / total);
      while (i < tl.points.length && tl.points[i].t <= t) {
        const p = tl.points[i++];
        if (p.down || !last) scratch(p, { x: p.x + .1, y: p.y + .1 }, p.r); else scratch(last, p, p.r);
        if (Math.random() < .3) addDust(p);
        last = p;
      }
      if (!musicOn && S.song && (i > 0 || !tl.points.length) && t >= (tl.points.length ? 0 : 400)) { musicOn = true; audio.play().catch(() => {}); }
      // draw here: requestAnimationFrame pauses in hidden tabs, a timer keeps the video going
      render(now, true);
      if (t >= total) return resolve();
      setTimeout(step, 33);
    })();
  });
  rec.stop(); await done;
  audio.pause();
  if (S.scratch) { clearMask(); replay(S.strokes); }
  S.recording = false; document.body.classList.remove('ss-busy');
  $('ss-progress').hidden = true; savable();

  const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  if (!blob.size) { say('The video came out empty. Try again, or save a picture.'); return; }
  const how = await deliver(blob, fileName(type.includes('mp4') ? 'mp4' : 'webm'));
  if (how === 'cancelled') say('Video ready. Tap “Save story video” again to share it.');
  else say(how === 'shared' ? 'Story shared.' : (out || !S.song ? 'Story video saved to your downloads.' : 'Video saved, but this browser kept the music out of it.'));
});

/* ---------- start ---------- */

paintTextChoices(); paintPens(); paintLook(); paintCoverChoices();
openTab('song'); setMode('scratch'); showSelected(); showFrame();
renderList(); savable();
requestAnimationFrame(frame);
document.fonts?.ready.then(() => { foil = null; baseDirty = true; });

(async () => {
  // offer to carry on with the last story kept on this phone
  try {
    const last = await getDraft(AUTO);
    if (last && !new URLSearchParams(location.search).get('song')) {
      const bar = $('ss-resume'); bar.hidden = false;
      $('ss-resume-open').onclick = async () => { bar.hidden = true; await restore(last); say('Welcome back. Your last story is open.'); };
      $('ss-resume-no').onclick = () => { bar.hidden = true; };
    }
  } catch (_) {}
})();

(async () => {
  say('Loading Island Mix songs…');
  try {
    // one quiet retry: the catalogue call gives up after 8 s on a slow connection
    const { tracks, stale } = await loadCatalogue().catch(() => loadCatalogue({ force: true }));
    S.tracks = tracks.slice();
    renderList();
    const want = pendingSongId || new URLSearchParams(location.search).get('song');
    const pick = (want && S.tracks.find((t) => t.id === want)) || null;
    if (pick) chooseSong(pick, !!pendingSongId);
    else say(stale ? 'Showing saved songs (offline).' : `${S.tracks.length} songs ready. Choose one.`);
    pendingSongId = null;
  } catch (e) {
    say(e.message || 'Music could not connect. Please try again.');
  }
})();
