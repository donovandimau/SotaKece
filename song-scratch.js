/* Sota Kece — Song Scratch (song-scratch.html).
   A story editor built round one trick: pick an Island Mix song, cover it with your photo (or a silver
   scratch card), then scratch the cover away to reveal the playing song card underneath.
   On top you can add text, stickers (emoji, Fijian words, a song sticker) and drawings, move, pinch,
   rotate and delete them, filter the photo and restyle the card. Save it as a story video with the
   music, or as a picture. Nothing is uploaded: it all happens on the phone. */
import { loadCatalogue } from '/shared-music/core.mjs';
import { W, H, fmtTime, splitTitle, searchTracks, coverColours, buildTimeline, pickMime, clearedShare } from '/song-scratch-core.mjs';
import { FONTS, COLOURS, EMOJI, WORDS, FILTERS, CARD_STYLES, PENS, newLayer, hitLayer, pinch, clampScale, drawLayer, drawSelection, drawPaths, history } from '/song-scratch-editor.mjs';

const $ = (id) => document.getElementById(id);
const stage = $('ss-canvas'), ctx = stage.getContext('2d');
stage.width = W; stage.height = H;

// Layers, bottom to top: song card (with blurred backdrop) → cover (photo/foil, scratched away) →
// drawings → text and stickers.
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
  mode: 'scratch',                        // what a finger on empty canvas does: scratch | draw | move
  layers: [], paths: [], sel: null,
  pen: { style: 'pen', color: '#ffffff', size: 12 },
  text: { font: 'classic', color: '#ffffff', bg: 'none', align: 'center' },
  filter: 'none', card: 'glass',
};
const hist = history();
const snapshot = () => ({ layers: S.layers, paths: S.paths });
function remember() { hist.push(snapshot()); $('ss-undo').disabled = false; }

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
  if (lines.join(' ').split(/\s+/).length < words.length) {
    let l = lines[maxLines - 1];
    while (l && c.measureText(l + '…').width > maxW) l = l.slice(0, -1);
    lines[maxLines - 1] = l.trimEnd() + '…';
  }
  return lines;
}

const songInfo = () => S.song ? { ...splitTitle(S.song.title), colours: coverColours(S.song.id) } : null;

function makeBackdrop() {
  backdrop = document.createElement('canvas'); backdrop.width = W / 4; backdrop.height = H / 4;
  const b = backdrop.getContext('2d');
  if (photo) {
    b.filter = 'blur(6px) saturate(1.3) ' + (FILTERS[S.filter].css === 'none' ? '' : FILTERS[S.filter].css);
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
  c.fillStyle = 'rgba(255,255,255,.14)';  // masi-style triangles
  const n = 8, tw = s / n;
  for (let i = 0; i < n; i++) { c.beginPath(); c.moveTo(x + i * tw, y + s); c.lineTo(x + i * tw + tw / 2, y + s - tw * .9); c.lineTo(x + (i + 1) * tw, y + s); c.fill(); }
  const cx = x + s * .5, cy = y + s * .44, r = s * .28, a = S.playing ? now / 900 : 0;  // record
  c.fillStyle = 'rgba(5,15,28,.85)'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2;
  for (let k = .45; k < 1; k += .14) { c.beginPath(); c.arc(cx, cy, r * k, a, a + 4.2); c.stroke(); }
  c.fillStyle = c1; c.beginPath(); c.arc(cx, cy, r * .3, 0, 7); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r * .06, 0, 7); c.fill();
  c.restore();
}

function drawCard(c, now) {
  if (!backdrop) makeBackdrop();
  const st = CARD_STYLES[S.card];
  c.imageSmoothingEnabled = true;
  c.drawImage(backdrop, 0, 0, W, H);
  const vg = c.createRadialGradient(W / 2, H * .45, 80, W / 2, H * .45, H * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);

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

  c.textAlign = 'center'; c.fillStyle = 'rgba(234,246,255,.85)';
  c.font = '700 26px Manrope, system-ui, sans-serif'; c.fillText('Sota Kece', W / 2, H - 92);
  c.font = '400 20px Lexend, system-ui, sans-serif'; c.fillStyle = 'rgba(159,191,214,.9)';
  c.fillText('sotakece.com · Island Mix', W / 2, H - 62);
}

function paintCover() {
  cctx.globalCompositeOperation = 'source-over';
  cctx.clearRect(0, 0, W, H);
  if (photo) {
    cctx.filter = FILTERS[S.filter].css;
    cctx.drawImage(photo, ...coverFit(photo, W, H));
    cctx.filter = 'none';
  } else {
    const g = cctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#cfd8df'); g.addColorStop(.35, '#f4f7f9'); g.addColorStop(.6, '#aab6c0'); g.addColorStop(1, '#e6ebef');
    cctx.fillStyle = g; cctx.fillRect(0, 0, W, H);
    cctx.globalAlpha = .08; cctx.fillStyle = '#06182b';
    for (let i = 0; i < 2600; i++) cctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    cctx.globalAlpha = 1;
    cctx.fillStyle = 'rgba(6,24,43,.72)'; cctx.textAlign = 'center'; cctx.textBaseline = 'alphabetic';
    cctx.font = '800 54px Manrope, system-ui, sans-serif'; cctx.fillText('Scratch me', W / 2, H / 2 - 10);
    cctx.font = '400 28px Lexend, system-ui, sans-serif'; cctx.fillText('to hear the song', W / 2, H / 2 + 36);
    cctx.font = '700 24px Manrope, system-ui, sans-serif'; cctx.fillText('Sota Kece', W / 2, H - 80);
  }
  S.revealed = 0;
}

function scratch(c, a, b, r) {
  c.globalCompositeOperation = 'destination-out';
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = '#000'; c.lineWidth = r;
  c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
  c.lineWidth = r * .3;  // ragged edges so it looks scratched, not erased
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

/** One full picture of the story. `clean` leaves out the selection frame (for saved files). */
function render(now, clean) {
  drawCard(ctx, now);
  ctx.drawImage(cover, 0, 0);
  drawDust(ctx);
  drawPaths(ctx, S.paths);
  const info = songInfo();
  for (const L of S.layers) drawLayer(ctx, L, info);
  if (!clean && S.sel && S.layers.includes(S.sel)) drawSelection(ctx, S.sel);
}

function frame(now) {
  if (!S.recording) render(now, false);  // the recorder draws its own frames
  requestAnimationFrame(frame);
}

/* ---------- pointer: scratch, draw, move / pinch / rotate, delete ---------- */

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
    savable();
  }, 150);
}
const savable = () => { const any = S.strokes.length || S.layers.length || S.paths.length; $('ss-save').disabled = !S.strokes.length; $('ss-picture').disabled = !any; };

const ptrs = new Map();       // pointerId → canvas point, for the layer gesture
let gesture = null;           // {layer, start:{x,y,s,r}, from:[pts]} while moving a layer
let drawing = null;           // current path while drawing
const bin = $('ss-bin');

function overBin(p) { return p.y > H - 170 && Math.abs(p.x - W / 2) < 110; }

function beginGesture() {
  const pts = [...ptrs.values()];
  gesture = { layer: gesture.layer, start: { x: gesture.layer.x, y: gesture.layer.y, s: gesture.layer.s, r: gesture.layer.r }, from: pts.map((p) => ({ ...p })) };
}

stage.addEventListener('pointerdown', (e) => {
  if (S.recording) return;
  stage.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  ptrs.set(e.pointerId, p);

  if (gesture) { beginGesture(); return; }  // second finger joins a layer gesture: pinch / rotate

  if (S.mode !== 'draw') {
    const hit = hitLayer(ctx, S.layers, p.x, p.y);
    if (hit) {
      remember();
      S.sel = hit;
      S.layers = S.layers.filter((l) => l !== hit).concat(hit);  // bring to front
      gesture = { layer: hit }; beginGesture();
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

  if (!S.song) { say('Choose a song first.'); return; }
  S.down = true;
  if (!S.strokes.length) S.t0 = performance.now();
  const pt = { t: performance.now() - S.t0, x: p.x, y: p.y, r: S.brush, down: true };
  S.strokes.push(pt); S.last = pt;
  scratch(cctx, pt, { x: pt.x + .1, y: pt.y + .1 }, S.brush);
  addDust(pt);
  startMusic();
  $('ss-tip').hidden = true;
});

stage.addEventListener('pointermove', (e) => {
  if (S.recording || !ptrs.has(e.pointerId)) return;
  const p = toCanvas(e);
  ptrs.set(e.pointerId, p);

  if (gesture) {
    const L = gesture.layer, now = [...ptrs.values()], st = gesture.start;
    if (now.length >= 2 && gesture.from.length >= 2) {
      const { k, dr } = pinch(gesture.from, now);
      const mid = (a) => ({ x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 });
      const m0 = mid(gesture.from), m1 = mid(now);
      L.s = clampScale(st.s * k); L.r = st.r + dr; L.x = st.x + m1.x - m0.x; L.y = st.y + m1.y - m0.y;
    } else {
      L.x = st.x + p.x - gesture.from[0].x; L.y = st.y + p.y - gesture.from[0].y;
    }
    bin.hidden = false; bin.classList.toggle('is-hot', ptrs.size === 1 && overBin(p));
    return;
  }
  if (drawing) {
    for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) drawing.pts.push(toCanvas(ev));
    return;
  }
  if (!S.down) return;
  for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) {
    const q = toCanvas(ev);
    const pt = { t: performance.now() - S.t0, x: q.x, y: q.y, r: S.brush, down: false };
    scratch(cctx, S.last, pt, S.brush);
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
    } else beginGesture();  // one finger lifted: carry on moving with the other
    return;
  }
  drawing = null;
  if (S.down) { S.down = false; measureReveal(); }
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('dblclick', (e) => {
  const p = toCanvas(e), hit = hitLayer(ctx, S.layers, p.x, p.y);
  if (hit?.type === 'text') { S.sel = hit; showSelected(); openTab('text'); $('ss-text').focus(); }
});

/* ---------- selection, layers, undo ---------- */

function deleteLayer(L, keepHistory = true) {
  if (keepHistory) remember();
  S.layers = S.layers.filter((l) => l !== L);
  if (S.sel === L) S.sel = null;
  showSelected(); savable();
}

function showSelected() {
  const L = S.sel, box = $('ss-selected');
  box.hidden = !L;
  if (!L) return;
  $('ss-sel-name').textContent = L.type === 'text' ? 'Text' : L.type === 'chip' ? 'Song sticker' : L.type === 'word' ? 'Word sticker' : 'Sticker';
  $('ss-sel-size').value = String(L.s);
  $('ss-sel-turn').value = String(Math.round(L.r * 180 / Math.PI));
  $('ss-sel-edit').hidden = L.type !== 'text';
  if (L.type === 'text') {
    $('ss-text').value = L.text;
    Object.assign(S.text, { font: L.font, color: L.color, bg: L.bg, align: L.align });
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
$('ss-sel-done').addEventListener('click', () => { S.sel = null; showSelected(); });

$('ss-undo').addEventListener('click', () => {
  const prev = hist.pop();
  if (!prev) return;
  // keep object identity for layers that still exist so a selection survives undo where it can
  S.layers = prev.layers; S.paths = prev.paths; S.sel = null;
  showSelected(); savable();
  $('ss-undo').disabled = !hist.size;
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); deleteLayer(S.sel); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('ss-undo').click(); }
});

function addLayer(props, say_) {
  remember();
  const L = newLayer({ x: W / 2 + (Math.random() - .5) * 120, y: H * .3 + (Math.random() - .5) * 160, ...props });
  S.layers = S.layers.concat(L); S.sel = L;
  setMode('move');
  showSelected(); savable();
  say(say_ || 'Drag it into place. Pinch to resize and turn. Drag it to the bin to delete.');
  return L;
}

/* ---------- modes and tabs ---------- */

function setMode(m) {
  S.mode = m;
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  stage.dataset.mode = m;
}
for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));

function openTab(name) {
  for (const t of document.querySelectorAll('[data-tab]')) {
    const on = t.dataset.tab === name;
    t.setAttribute('aria-selected', String(on));
    $('ss-tab-' + t.dataset.tab).hidden = !on;
  }
  if (name === 'draw') setMode('draw');
  else if (S.mode === 'draw') setMode('scratch');
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
}
function setText(change) {
  Object.assign(S.text, change);
  if (S.sel?.type === 'text') { remember(); Object.assign(S.sel, change); }
  paintTextChoices();
}
$('ss-text').addEventListener('input', (e) => {
  if (S.sel?.type === 'text') { S.sel.text = e.target.value || ' '; }
});
$('ss-text').addEventListener('focus', () => { if (S.sel?.type === 'text') remember(); });
$('ss-text-add').addEventListener('click', () => {
  const v = $('ss-text').value.trim();
  if (S.sel?.type === 'text') { S.sel = null; showSelected(); $('ss-text').value = ''; say('Text done.'); return; }
  if (!v) { say('Type something first.'); $('ss-text').focus(); return; }
  addLayer({ type: 'text', text: v, ...S.text, y: H * .2 });
  $('ss-text').value = '';
});

/* ---------- stickers ---------- */

const stickerHost = $('ss-stickers');
for (const ch of EMOJI) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ss-sticker'; b.textContent = ch; b.setAttribute('aria-label', 'Add sticker ' + ch);
  b.addEventListener('click', () => addLayer({ type: 'emoji', ch }));
  stickerHost.append(b);
}
const wordHost = $('ss-words');
WORDS.forEach((w, i) => {
  const color = ['#ff6856', '#ffcb47', '#87CEEB', '#2ecc71', '#ff5fa2', '#8e6cff'][i % 6];
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ss-word'; b.textContent = w; b.style.background = color;
  b.addEventListener('click', () => addLayer({ type: 'word', text: w, color }));
  wordHost.append(b);
});
$('ss-chip').addEventListener('click', () => {
  if (!S.song) { say('Choose a song first, then add its sticker.'); openTab('song'); return; }
  addLayer({ type: 'chip', y: H * .82 }, 'Song sticker added. It shows the song even before anyone scratches.');
});

/* ---------- draw ---------- */

function paintPens() {
  chips($('ss-pens'), Object.entries(PENS).map(([k, p]) => [k, p.label]), S.pen.style, (k) => { S.pen.style = k; paintPens(); });
  chips($('ss-pen-colours'), COLOURS.map((c) => [c, '', `background:${c}`]), S.pen.color, (c) => { S.pen.color = c; paintPens(); }, 'ss-swatch');
}
$('ss-pen-size').addEventListener('input', (e) => { S.pen.size = Number(e.target.value); });
$('ss-draw-clear').addEventListener('click', () => { if (!S.paths.length) return; remember(); S.paths = []; savable(); });

/* ---------- look: filters, card style ---------- */

function paintLook() {
  chips($('ss-filters'), Object.entries(FILTERS).map(([k, f]) => [k, f.label]), S.filter, (k) => {
    S.filter = k; backdrop = null;
    if (photo) { redoCover(); } else say('Filters change your photo. Add a photo first.');
    paintLook();
  });
  chips($('ss-cards'), Object.entries(CARD_STYLES).map(([k, c]) => [k, c.label]), S.card, (k) => { S.card = k; paintLook(); });
}
/** Repaint the cover (e.g. new filter) and scratch the same strokes away again. */
function redoCover() { paintCover(); replayInto(cctx, S.strokes); measureReveal(); }

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
  setMode('scratch');
  $('ss-tip').hidden = false;
}

audio.addEventListener('loadedmetadata', () => {
  const max = Math.max(0, Math.floor(audio.duration - 20));
  $('ss-start').max = String(max); $('ss-start').disabled = !max;
});
audio.addEventListener('play', () => { S.playing = true; $('ss-play').textContent = 'Pause'; });
audio.addEventListener('pause', () => { S.playing = false; $('ss-play').textContent = 'Play'; });
audio.addEventListener('error', () => { if (S.song) say('This song would not load. Try another one.'); });

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
  const img = new Image();
  img.onload = () => {
    photo = img; backdrop = null;
    paintCover(); resetScratch(false);
    $('ss-photo-label').textContent = 'Change photo';
    say(S.song ? 'Scratch the photo to reveal the song.' : 'Now choose a song.');
  };
  img.onerror = () => say('That picture could not be opened.');
  img.src = URL.createObjectURL(file);
}
$('ss-photo').addEventListener('click', () => $('ss-file').click());
$('ss-file').addEventListener('change', (e) => loadPhoto(e.target.files[0]));
$('ss-foil').addEventListener('click', () => { photo = null; backdrop = null; paintCover(); resetScratch(false); $('ss-photo-label').textContent = 'Use my photo'; });
stage.addEventListener('dragover', (e) => e.preventDefault());
stage.addEventListener('drop', (e) => { e.preventDefault(); loadPhoto(e.dataTransfer.files[0]); });

/* ---------- scratch tools ---------- */

$('ss-brush').addEventListener('input', (e) => { S.brush = Number(e.target.value); });

function resetScratch(stopMusic = true) {
  S.strokes = []; S.last = null; S.dust = [];
  paintCover();
  if (stopMusic) { audio.pause(); if (S.song) audio.currentTime = S.start; }
  $('ss-revealed').textContent = '';
  savable();
}
$('ss-reset').addEventListener('click', () => { resetScratch(); setMode('scratch'); say('Covered again. Scratch away.'); $('ss-tip').hidden = !S.song; });
$('ss-reveal').addEventListener('click', () => {
  if (!S.song) { say('Choose a song first.'); return; }
  // sweep across like a finger would, so the saved video shows it too
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
  render(performance.now(), true);  // without the selection frame
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

  // replay: cover again, then redraw the strokes on their timeline while the song plays.
  // Text, stickers and drawings stay on top the whole time.
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
      // draw here: requestAnimationFrame pauses in hidden tabs, a timer keeps the video going
      render(performance.now(), true);
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

paintTextChoices(); paintPens(); paintLook();
openTab('song'); setMode('scratch');
paintCover();
renderList();
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
