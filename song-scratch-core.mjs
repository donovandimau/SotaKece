/* Sota Kece — Song Scratch: pure helpers (no DOM), shared by song-scratch.js and tests. */

export const W = 720, H = 1280;            // story canvas, 9:16
export const MAX_EXPORT_MS = 30000;        // saved video is at most 30 s
export const LEAD_MS = 900, TAIL_MS = 3500; // hold before the first scratch and after the last
export const MAX_GAP_MS = 450;             // long pauses between strokes are shortened to this

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** Tidy a catalogue title for display: drop bracketed tags and file noise. */
export function cleanTitle(title) {
  const t = String(title || '')
    .replace(/\.mp3$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s*[\[(][^\])]*[\])]\s*/g, ' ')
    .replace(/\s*#\s*\d{4}\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '');
  return t || String(title || '').trim();
}

/** Split "Song - Artist" style titles into a song line and an artist line. */
export function splitTitle(title) {
  const t = cleanTitle(title);
  const m = t.split(/\s+[-–—]\s+/);
  if (m.length >= 2) {
    const [a, ...rest] = m;
    const b = rest.join(' – ');
    // Catalogue names are usually "Song - Artist", but "DJ X - Song" also appears.
    if (/^(dj|mc)\b/i.test(a)) return { song: b, artist: a };
    return { song: a, artist: b };
  }
  return { song: t, artist: '' };
}

export function searchTracks(tracks, query, limit = 60) {
  const q = String(query || '').trim().toLowerCase();
  const words = q ? q.split(/\s+/) : [];
  const out = [];
  for (const t of tracks) {
    const hay = (t.title + ' ' + (t.playlist || '')).toLowerCase();
    if (words.every((w) => hay.includes(w))) out.push(t);
    if (out.length >= limit) break;
  }
  return out;
}

/** Stable small hash for a string, used to colour a song's cover. */
export function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Two cover colours (HSL strings) for a song id. */
export function coverColours(id) {
  const h = hash(id);
  const hue = h % 360, hue2 = (hue + 40 + (h >> 9) % 80) % 360;
  return [`hsl(${hue} 70% 46%)`, `hsl(${hue2} 75% 22%)`];
}

/**
 * Turn the strokes the member drew into a replay timeline for the saved video.
 * points: [{t, x, y, r, down}] with t in ms since the first scratch.
 * Returns {points (with new t), scratchMs, totalMs}. Long pauses are shortened and the whole
 * scratch is sped up if needed so that LEAD + scratch + TAIL fits in MAX_EXPORT_MS.
 */
export function buildTimeline(points) {
  if (!Array.isArray(points) || !points.length) return { points: [], scratchMs: 0, totalMs: LEAD_MS + TAIL_MS };
  const out = [];
  let shift = 0, prev = points[0].t;
  for (const p of points) {
    const gap = p.t - prev;
    if (gap > MAX_GAP_MS) shift += gap - MAX_GAP_MS;
    out.push({ ...p, t: p.t - points[0].t - shift });
    prev = p.t;
  }
  let scratchMs = out[out.length - 1].t;
  const room = MAX_EXPORT_MS - LEAD_MS - TAIL_MS;
  if (scratchMs > room) {
    const k = room / scratchMs;
    for (const p of out) p.t *= k;
    scratchMs = room;
  }
  for (const p of out) p.t += LEAD_MS;
  return { points: out, scratchMs, totalMs: LEAD_MS + scratchMs + TAIL_MS };
}

/** Best recording format this browser offers (mp4 first, it shares to more apps). */
export function pickMime(isSupported) {
  const list = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of list) { try { if (isSupported(m)) return m; } catch (_) {} }
  return '';
}

/** Share of the cover's alpha that has been scratched away (0..1), from RGBA bytes. */
export function clearedShare(rgba) {
  let clear = 0, n = 0;
  for (let i = 3; i < rgba.length; i += 16) { n++; if (rgba[i] < 40) clear++; }
  return n ? clear / n : 0;
}
