const test = require('node:test');
const assert = require('node:assert');
const G = require('../subscription-guard.js');
const E = require('../motion-engine.js');

const now = new Date('2026-11-09T12:00:00Z');
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString();

test('account age in whole days', () => {
  assert.strictEqual(G.accountAgeDays(daysAgo(0), now), 0);
  assert.strictEqual(G.accountAgeDays(daysAgo(365), now), 365);
  assert.strictEqual(G.accountAgeDays('not a date', now), null);
});
test('free for the first 365 days', () => {
  const r = G.checkMotionAccess({ created_at: daysAgo(10) }, now);
  assert.deepStrictEqual([r.allowed, r.reason, r.freeDaysLeft], [true, 'free-year', 355]);
  assert.strictEqual(G.checkMotionAccess({ created_at: daysAgo(365) }, now).allowed, true);
});
test('day 366 needs the Creator plan', () => {
  assert.strictEqual(G.checkMotionAccess({ created_at: daysAgo(366) }, now).reason, 'upgrade-required');
  const paid = G.checkMotionAccess({ created_at: daysAgo(900), app_metadata: { creator_plan: true } }, now);
  assert.deepStrictEqual([paid.allowed, paid.reason], [true, 'subscribed']);
});
test('signed out is not allowed to export', () => {
  assert.strictEqual(G.checkMotionAccess(null, now).reason, 'signed-out');
});
test('depth map is normalised and puts the bottom nearer than the sky', () => {
  const w = 64, h = 64, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, sky = y < h / 2;
    px[i] = sky ? 220 : 40; px[i + 1] = sky ? 235 : 90; px[i + 2] = sky ? 255 : 40; px[i + 3] = 255;
  }
  const d = E.estimateDepth(px, w, h);
  assert.strictEqual(d.length, w * h);
  let lo = 1, hi = 0; for (const v of d) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(lo >= 0 && hi <= 1 && hi - lo > 0.9);
  assert.ok(d[(h - 2) * w + w / 2] > d[2 * w + w / 2]);
});
test('five styles in the agreed order', () => {
  assert.deepStrictEqual(E.STYLES, ['parallax', 'particles', 'fluid', 'glitch', 'cinemagraph']);
});
test('upload helper refuses non-pictures before doing any work', async () => {
  await assert.rejects(E.handleUserWallpaperUpload({ type: 'application/pdf', size: 10 }), /PNG, JPEG or WebP/);
  await assert.rejects(E.handleUserWallpaperUpload({ type: 'image/png', size: 30 * 1024 * 1024 }), /25 MB/);
});
