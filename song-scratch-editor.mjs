/* Sota Kece — Song Scratch editor: text, stickers, drawing and layer maths (no DOM; canvas passed in).
   Shared by song-scratch.js and tests. */

export const FONTS = {
  classic: { label: 'Classic', css: (px) => `800 ${px}px Manrope, system-ui, sans-serif` },
  modern: { label: 'Modern', css: (px) => `500 ${px}px Lexend, system-ui, sans-serif` },
  type: { label: 'Typewriter', css: (px) => `700 ${px}px "Courier New", Courier, monospace` },
  serif: { label: 'Serif', css: (px) => `italic 700 ${px}px Georgia, "Times New Roman", serif` },
  neon: { label: 'Neon', css: (px) => `700 ${px}px Lexend, system-ui, sans-serif`, glow: true },
};
export const COLOURS = ['#ffffff', '#06182b', '#87CEEB', '#ff6856', '#ffcb47', '#2ecc71', '#ff5fa2', '#8e6cff'];
export const EMOJI = ['🌺', '🌴', '🌊', '🥥', '🐚', '☀️', '🎶', '🎧', '❤️', '🔥', '✨', '😂', '🥹', '🙏', '💃', '🇫🇯'];
export const WORDS = ['Bula!', 'Vinaka', 'Isa Lei', 'Sota tale', 'Mai kana', 'Lomana'];
export const FILTERS = {
  none: { label: 'Normal', css: 'none' },
  warm: { label: 'Warm', css: 'sepia(.25) saturate(1.3) hue-rotate(-8deg)' },
  cool: { label: 'Cool', css: 'saturate(1.1) hue-rotate(14deg) brightness(1.04)' },
  mono: { label: 'Mono', css: 'grayscale(1) contrast(1.12)' },
  fade: { label: 'Fade', css: 'contrast(.85) brightness(1.08) saturate(.8)' },
  vivid: { label: 'Vivid', css: 'saturate(1.6) contrast(1.1)' },
};
export const CARD_STYLES = {
  glass: { label: 'Glass', fill: 'rgba(8,28,48,.82)', text: '#eaf6ff', sub: '#9fbfd6', line: 'rgba(160,220,255,.22)', bar: '#87CEEB' },
  light: { label: 'Light', fill: 'rgba(255,253,248,.95)', text: '#06182b', sub: '#4d6577', line: 'rgba(6,24,43,.12)', bar: '#086779' },
  sunset: { label: 'Sunset', fill: 'rgba(120,32,60,.86)', text: '#fff3e8', sub: '#ffc9a8', line: 'rgba(255,200,160,.3)', bar: '#ffcb47' },
};
export const PENS = {
  pen: { label: 'Pen', alpha: 1, glow: 0, k: 1 },
  marker: { label: 'Marker', alpha: .45, glow: 0, k: 2.2 },
  neon: { label: 'Neon', alpha: 1, glow: 18, k: 1 },
};

export const TEXT_PX = 56, EMOJI_PX = 130, WORD_PX = 46;

let nextId = 1;
export function newLayer(props) { return { id: nextId++, x: 360, y: 520, s: 1, r: 0, ...props }; }

function lines(text) { return String(text || '').split('\n').slice(0, 8); }

/** Size of a layer in its own (unscaled, unrotated) space. */
export function layerSize(c, L) {
  if (L.type === 'emoji') return { w: EMOJI_PX * 1.15, h: EMOJI_PX * 1.15 };
  if (L.type === 'chip') return { w: 430, h: 112 };
  if (L.type === 'word') {
    c.font = FONTS.classic.css(WORD_PX);
    return { w: c.measureText(L.text).width + 64, h: WORD_PX + 40 };
  }
  c.font = (FONTS[L.font] || FONTS.classic).css(TEXT_PX);
  const ls = lines(L.text);
  const w = Math.max(40, ...ls.map((l) => c.measureText(l).width)) + 36;
  return { w, h: ls.length * TEXT_PX * 1.22 + 24 };
}

/** Point (canvas space) to the layer's local space. */
export function toLocal(L, x, y) {
  const dx = x - L.x, dy = y - L.y, cos = Math.cos(-L.r), sin = Math.sin(-L.r);
  return { x: (dx * cos - dy * sin) / L.s, y: (dx * sin + dy * cos) / L.s };
}

/** Topmost layer under a point, or null. A little slack makes small things easy to grab. */
export function hitLayer(c, layers, x, y) {
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i], p = toLocal(L, x, y), { w, h } = layerSize(c, L), slack = 18 / L.s;
    if (Math.abs(p.x) <= w / 2 + slack && Math.abs(p.y) <= h / 2 + slack) return L;
  }
  return null;
}

/** Scale and rotation from a two-finger gesture. */
export function pinch(start, now) {
  const d = (a, b) => Math.hypot(b.x - a.x, b.y - a.y), ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const k = d(now[0], now[1]) / Math.max(1, d(start[0], start[1]));
  return { k, dr: ang(now[0], now[1]) - ang(start[0], start[1]) };
}

export const clampScale = (s) => Math.min(6, Math.max(.25, s));

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function textOn(colour) {
  const h = colour.replace('#', ''), n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > .6 ? '#06182b' : '#ffffff';
}

/** Draw one layer. `song` = {song, artist, colours} for the song sticker. */
export function drawLayer(c, L, song) {
  c.save();
  c.translate(L.x, L.y); c.rotate(L.r); c.scale(L.s, L.s);
  c.textBaseline = 'middle';
  if (L.type === 'emoji') {
    c.font = `${EMOJI_PX}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center'; c.fillText(L.ch, 0, 6);
  } else if (L.type === 'word') {
    const { w, h } = layerSize(c, L);
    const bg = L.color || '#ff6856';
    c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
    roundRect(c, -w / 2, -h / 2, w, h, h / 2); c.fillStyle = bg; c.fill();
    c.shadowColor = 'transparent';
    c.font = FONTS.classic.css(WORD_PX); c.textAlign = 'center'; c.fillStyle = textOn(bg);
    c.fillText(L.text, 0, 3);
  } else if (L.type === 'chip') {
    const w = 430, h = 112, [c1, c2] = song?.colours || ['#3BA7E0', '#0a2540'];
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 20; c.shadowOffsetY = 8;
    roundRect(c, -w / 2, -h / 2, w, h, 26); c.fillStyle = 'rgba(255,255,255,.96)'; c.fill();
    c.shadowColor = 'transparent';
    const g = c.createLinearGradient(-w / 2 + 14, -40, -w / 2 + 94, 40); g.addColorStop(0, c1); g.addColorStop(1, c2);
    roundRect(c, -w / 2 + 14, -42, 84, 84, 16); c.fillStyle = g; c.fill();
    c.fillStyle = '#fff'; c.font = '700 34px Manrope, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('♪', -w / 2 + 56, 2);
    c.textAlign = 'left'; c.fillStyle = '#06182b'; c.font = '800 30px Manrope, system-ui, sans-serif';
    c.fillText(fit(c, song?.song || 'Choose a song', w - 140), -w / 2 + 114, -16);
    c.fillStyle = '#4d6577'; c.font = '400 22px Lexend, system-ui, sans-serif';
    c.fillText(fit(c, song?.artist || 'Island Mix · Sota Kece', w - 140), -w / 2 + 114, 22);
  } else {
    const f = FONTS[L.font] || FONTS.classic, ls = lines(L.text), lh = TEXT_PX * 1.22;
    c.font = f.css(TEXT_PX); c.textAlign = L.align || 'center';
    const { w } = layerSize(c, L), top = -(ls.length * lh) / 2 + lh / 2;
    const ax = L.align === 'left' ? -w / 2 + 18 : L.align === 'right' ? w / 2 - 18 : 0;
    ls.forEach((l, i) => {
      const y = top + i * lh;
      if (L.bg && L.bg !== 'none' && l.trim()) {
        const lw = c.measureText(l).width + 32;
        const lx = L.align === 'left' ? ax - 16 : L.align === 'right' ? ax - lw + 16 : -lw / 2;
        roundRect(c, lx, y - lh / 2 + 2, lw, lh - 4, 14);
        c.fillStyle = L.bg === 'solid' ? L.color : 'rgba(6,24,43,.55)'; c.fill();
      }
      c.fillStyle = L.bg === 'solid' ? textOn(L.color) : L.color;
      if (f.glow) { c.shadowColor = L.color; c.shadowBlur = 24; }
      else if (!L.bg || L.bg === 'none') { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 10; c.shadowOffsetY = 2; }
      c.fillText(l, ax, y + 2);
      if (f.glow) { c.fillStyle = '#ffffff'; c.shadowBlur = 6; c.globalAlpha = .55; c.fillText(l, ax, y + 2); c.globalAlpha = 1; }
      c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
    });
  }
  c.restore();
}

function fit(c, text, maxW) {
  let t = String(text);
  if (c.measureText(t).width <= maxW) return t;
  while (t && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

/** Dashed frame round the selected layer (never in saved files). */
export function drawSelection(c, L) {
  const { w, h } = layerSize(c, L);
  c.save(); c.translate(L.x, L.y); c.rotate(L.r);
  c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)';
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 4;
  c.strokeRect(-(w * L.s) / 2 - 10, -(h * L.s) / 2 - 10, w * L.s + 20, h * L.s + 20);
  c.restore();
}

/** Draw freehand paths: [{style, color, size, pts:[{x,y}]}] */
export function drawPaths(c, paths) {
  for (const p of paths) {
    if (!p.pts.length) continue;
    const pen = PENS[p.style] || PENS.pen;
    c.save();
    c.globalAlpha = pen.alpha; c.lineCap = 'round'; c.lineJoin = 'round';
    c.lineWidth = p.size * pen.k; c.strokeStyle = p.color;
    if (pen.glow) { c.shadowColor = p.color; c.shadowBlur = pen.glow; }
    c.beginPath(); c.moveTo(p.pts[0].x, p.pts[0].y);
    if (p.pts.length === 1) c.lineTo(p.pts[0].x + .1, p.pts[0].y + .1);
    for (let i = 1; i < p.pts.length - 1; i++) {
      const a = p.pts[i], b = p.pts[i + 1];
      c.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    if (p.pts.length > 1) { const z = p.pts[p.pts.length - 1]; c.lineTo(z.x, z.y); }
    c.stroke();
    if (pen.glow) { c.shadowBlur = 0; c.lineWidth = Math.max(2, p.size * .35); c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke(); }
    c.restore();
  }
}

/** Undo history of the editable parts (layers and drawings). */
export function history(limit = 40) {
  const stack = [];
  return {
    push(state) { stack.push(JSON.stringify(state)); if (stack.length > limit) stack.shift(); },
    pop() { const s = stack.pop(); return s ? JSON.parse(s) : null; },
    get size() { return stack.length; },
    clear() { stack.length = 0; },
  };
}
