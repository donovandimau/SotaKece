/* Sota Kece — Song Scratch: cover media (photos, video clips, layouts, backgrounds), framing,
   animation and templates. No DOM: canvases and media elements are passed in. */

export const LAYOUTS = {
  single: { label: 'One', n: 1 },
  'two-v': { label: 'Two ↕', n: 2 },
  'two-h': { label: 'Two ↔', n: 2 },
  three: { label: 'Three', n: 3 },
  four: { label: 'Four', n: 4 },
};
export const GAP = 10;

/** Cell rectangles [x, y, w, h] for a layout on a w×h story. */
export function cellRects(layout, w, h, gap = GAP) {
  const g = gap, hw = (w - g) / 2, hh = (h - g) / 2;
  switch (layout) {
    case 'two-v': return [[0, 0, w, hh], [0, hh + g, w, hh]];
    case 'two-h': return [[0, 0, hw, h], [hw + g, 0, hw, h]];
    case 'three': return [[0, 0, w, hh], [0, hh + g, hw, hh], [hw + g, hh + g, hw, hh]];
    case 'four': return [[0, 0, hw, hh], [hw + g, 0, hw, hh], [0, hh + g, hw, hh], [hw + g, hh + g, hw, hh]];
    default: return [[0, 0, w, h]];
  }
}

export function cellAt(layout, w, h, x, y) {
  const cells = cellRects(layout, w, h);
  return cells.findIndex(([cx, cy, cw, ch]) => x >= cx && x <= cx + cw && y >= cy && y <= cy + ch);
}

/** Natural size of an image or video element. */
export function mediaSize(el) {
  return { w: el.videoWidth || el.naturalWidth || el.width || 1, h: el.videoHeight || el.naturalHeight || el.height || 1 };
}

/** Framing: cover-fit the (possibly turned) media in a cell, then zoom and pan. Returns draw box in cell-centre space. */
export function frameBox(size, cw, ch, item) {
  const turned = (((item.rot || 0) % 180) + 180) % 180 === 90;
  const mw = turned ? size.h : size.w, mh = turned ? size.w : size.h;
  const k = Math.max(cw / mw, ch / mh) * (item.zoom || 1);
  return { w: size.w * k, h: size.h * k, k };
}

/** Keep a pan inside the picture so no empty edge shows. */
export function clampPan(size, cw, ch, item) {
  const turned = (((item.rot || 0) % 180) + 180) % 180 === 90;
  const { w, h } = frameBox(size, cw, ch, item);
  const vw = turned ? h : w, vh = turned ? w : h;
  const mx = Math.max(0, (vw - cw) / 2), my = Math.max(0, (vh - ch) / 2);
  return { px: Math.max(-mx, Math.min(mx, item.px || 0)), py: Math.max(-my, Math.min(my, item.py || 0)) };
}

export function drawMediaInCell(c, item, rect, filterCss) {
  const [x, y, cw, ch] = rect;
  const size = mediaSize(item.el);
  const { w, h } = frameBox(size, cw, ch, item);
  c.save();
  c.beginPath(); c.rect(x, y, cw, ch); c.clip();
  c.translate(x + cw / 2 + (item.px || 0), y + ch / 2 + (item.py || 0));
  c.rotate(((item.rot || 0) * Math.PI) / 180);
  if (filterCss && filterCss !== 'none') c.filter = filterCss;
  try { c.drawImage(item.el, -w / 2, -h / 2, w, h); } catch (_) { /* video not ready */ }
  c.restore();
}

/* ---------- backgrounds ---------- */

export const BACKGROUNDS = {
  lagoon: { label: 'Lagoon', stops: ['#0b6e8a', '#7fd6e0'] },
  sunset: { label: 'Sunset', stops: ['#ff6856', '#ffcb47'] },
  night: { label: 'Night', stops: ['#06182b', '#3b2a6b'] },
  coral: { label: 'Coral', stops: ['#ff5fa2', '#ff9a5a'] },
  forest: { label: 'Forest', stops: ['#0d3b2a', '#2ecc71'] },
  masi: { label: 'Masi', stops: ['#5a3a22', '#f1e2c6'], masi: true },
  white: { label: 'White', stops: ['#fffdf8', '#fffdf8'] },
  black: { label: 'Black', stops: ['#05080c', '#05080c'] },
};

export function drawBackground(c, key, w, h) {
  const b = BACKGROUNDS[key] || BACKGROUNDS.lagoon;
  const g = c.createLinearGradient(0, 0, w * .4, h);
  g.addColorStop(0, b.stops[0]); g.addColorStop(1, b.stops[1]);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (b.masi) {
    // bands of masi (tapa) triangles
    c.fillStyle = 'rgba(40,22,10,.55)';
    const s = 60;
    for (let row = 0; row < h / (s * 3); row++) {
      const y = row * s * 3 + s;
      for (let x = 0; x < w; x += s) { c.beginPath(); c.moveTo(x, y + s); c.lineTo(x + s / 2, y); c.lineTo(x + s, y + s); c.fill(); }
      c.fillRect(0, y + s + 8, w, 6);
    }
  }
}

/* ---------- animation ---------- */

export const ANIMS = {
  none: 'Still', pop: 'Pop in', fade: 'Fade in', type: 'Type', bounce: 'Bounce', pulse: 'Pulse', wiggle: 'Wiggle', spin: 'Spin', float: 'Float',
};
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** Offsets for a layer's animation at t seconds (since the story started playing). */
export function animate(anim, t, seed = 0) {
  const o = { dx: 0, dy: 0, ds: 1, dr: 0, alpha: 1, reveal: 1 };
  const ph = (seed % 7) * .37;
  switch (anim) {
    case 'pop': { const k = ease(t / .45); o.ds = k < 1 ? .2 + .8 * k + Math.sin(k * Math.PI) * .15 : 1; o.alpha = Math.min(1, t / .2); break; }
    case 'fade': o.alpha = ease(t / .8); o.dy = (1 - ease(t / .8)) * 30; break;
    case 'type': o.reveal = Math.min(1, t / 1.4); break;
    case 'bounce': o.dy = -Math.abs(Math.sin((t + ph) * 3.2)) * 26; break;
    case 'pulse': o.ds = 1 + Math.sin((t + ph) * 4.5) * .08; break;
    case 'wiggle': o.dr = Math.sin((t + ph) * 9) * .12; break;
    case 'spin': o.dr = (t * 1.6) % (Math.PI * 2); break;
    case 'float': o.dy = Math.sin((t + ph) * 1.8) * 14; o.dx = Math.cos((t + ph) * 1.1) * 6; break;
    default: break;
  }
  return o;
}

/** Built-in moving stickers (drawn, not GIF files). */
export const MOVING = {
  hearts: { label: 'Hearts', w: 220, h: 260 },
  sparkle: { label: 'Sparkle', w: 240, h: 240 },
  eq: { label: 'Beat', w: 220, h: 150 },
  live: { label: 'LIVE', w: 230, h: 92 },
  wave: { label: 'Wave', w: 360, h: 120 },
  sun: { label: 'Sun', w: 220, h: 220 },
};

export function drawMoving(c, kind, t) {
  const m = MOVING[kind]; if (!m) return;
  c.save();
  if (kind === 'hearts') {
    for (let i = 0; i < 6; i++) {
      const p = ((t * .45 + i / 6) % 1), x = Math.sin(i * 2.1 + t * 1.5) * 60, y = 110 - p * 230, s = 26 + (i % 3) * 10;
      c.globalAlpha = Math.sin(p * Math.PI);
      heart(c, x, y, s, ['#ff5fa2', '#ff6856', '#ffcb47'][i % 3]);
    }
  } else if (kind === 'sparkle') {
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, r = 30 + (i * 37) % 80, x = Math.cos(a) * r, y = Math.sin(a * 1.3) * r;
      const k = (Math.sin(t * 4 + i * 1.7) + 1) / 2;
      c.globalAlpha = .3 + .7 * k; star(c, x, y, 10 + 22 * k, '#fff6c8');
    }
  } else if (kind === 'eq') {
    for (let i = 0; i < 7; i++) {
      const hgt = 20 + 100 * Math.abs(Math.sin(t * (3 + i * .4) + i));
      c.fillStyle = ['#87CEEB', '#3BA7E0', '#2ecc71', '#ffcb47', '#ff6856', '#ff5fa2', '#8e6cff'][i];
      rr(c, -105 + i * 30, 70 - hgt, 22, hgt, 8); c.fill();
    }
  } else if (kind === 'live') {
    rr(c, -115, -46, 230, 92, 46); c.fillStyle = '#e0302a'; c.fill();
    c.globalAlpha = .5 + .5 * Math.abs(Math.sin(t * 3)); c.fillStyle = '#fff';
    c.beginPath(); c.arc(-70, 0, 14, 0, 7); c.fill(); c.globalAlpha = 1;
    c.font = '800 46px Manrope, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('LIVE', 18, 3);
  } else if (kind === 'wave') {
    c.lineWidth = 12; c.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      c.strokeStyle = k ? 'rgba(255,255,255,.85)' : '#3BA7E0';
      c.beginPath();
      for (let x = -170; x <= 170; x += 6) { const y = Math.sin(x / 34 + t * 3 + k) * 22 + k * 26 - 12; x === -170 ? c.moveTo(x, y) : c.lineTo(x, y); }
      c.stroke();
    }
  } else if (kind === 'sun') {
    c.rotate(t * .8);
    c.fillStyle = '#ffcb47';
    for (let i = 0; i < 12; i++) { c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(-10, 60); c.lineTo(0, 104); c.lineTo(10, 60); c.fill(); }
    c.beginPath(); c.arc(0, 0, 54, 0, 7); c.fillStyle = '#ffd96a'; c.fill();
  }
  c.restore();
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function heart(c, x, y, s, col) {
  c.fillStyle = col; c.beginPath();
  c.moveTo(x, y + s * .35);
  c.bezierCurveTo(x - s, y - s * .35, x - s * .4, y - s, x, y - s * .45);
  c.bezierCurveTo(x + s * .4, y - s, x + s, y - s * .35, x, y + s * .35);
  c.fill();
}
function star(c, x, y, s, col) {
  c.fillStyle = col; c.beginPath();
  for (let i = 0; i < 8; i++) { const r = i % 2 ? s * .28 : s, a = (i * Math.PI) / 4; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath(); c.fill();
}

/* ---------- templates ---------- */

/** Ready-made looks. Each gives a background (used when there is no photo), a card style and layers. */
export const TEMPLATES = {
  nowplaying: {
    label: 'Now playing', bg: 'night', card: 'glass',
    layers: [
      { type: 'text', text: 'Now playing', font: 'classic', color: '#ffffff', bg: 'none', align: 'center', x: 360, y: 150, anim: 'fade' },
      { type: 'chip', x: 360, y: 1080, anim: 'pop' },
      { type: 'moving', kind: 'eq', x: 590, y: 250, s: .7 },
    ],
  },
  birthday: {
    label: 'Birthday', bg: 'sunset', card: 'sunset',
    layers: [
      { type: 'text', text: 'Happy birthday!', font: 'neon', color: '#ffcb47', bg: 'none', align: 'center', x: 360, y: 160, anim: 'pop' },
      { type: 'emoji', ch: '🎂', x: 140, y: 1060, anim: 'bounce' },
      { type: 'moving', kind: 'sparkle', x: 570, y: 1040 },
    ],
  },
  throwback: {
    label: 'Throwback', bg: 'masi', card: 'light',
    layers: [
      { type: 'text', text: 'Throwback', font: 'serif', color: '#ffffff', bg: 'soft', align: 'center', x: 360, y: 150, anim: 'type' },
      { type: 'word', text: 'Isa Lei', color: '#ffcb47', x: 520, y: 1090, r: -.12, anim: 'wiggle' },
    ],
  },
  weekend: {
    label: 'Weekend', bg: 'lagoon', card: 'glass',
    layers: [
      { type: 'text', text: 'Weekend vibes', font: 'modern', color: '#ffffff', bg: 'none', align: 'center', x: 360, y: 150, anim: 'float' },
      { type: 'emoji', ch: '🌴', x: 600, y: 1060, anim: 'wiggle' },
      { type: 'moving', kind: 'wave', x: 300, y: 1110 },
    ],
  },
  shoutout: {
    label: 'Shout out', bg: 'coral', card: 'light',
    layers: [
      { type: 'text', text: 'Shout out to…', font: 'type', color: '#06182b', bg: 'solid', align: 'center', x: 360, y: 160, anim: 'type' },
      { type: 'moving', kind: 'hearts', x: 580, y: 1050 },
    ],
  },
  live: {
    label: 'Live', bg: 'black', card: 'glass',
    layers: [
      { type: 'moving', kind: 'live', x: 170, y: 120, anim: 'pulse' },
      { type: 'text', text: 'Tonight', font: 'classic', color: '#ffffff', bg: 'none', align: 'center', x: 360, y: 230, anim: 'fade' },
      { type: 'chip', x: 360, y: 1080 },
    ],
  },
};
