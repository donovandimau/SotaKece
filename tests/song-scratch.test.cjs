'use strict';
// Song Scratch (song-scratch.html): pure helpers and page wiring.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const core = () => import(path.join(root, 'song-scratch-core.mjs').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));

test('titles are split into song and artist', async () => {
  const { splitTitle, cleanTitle } = await core();
  assert.deepEqual(splitTitle('Lei Lusi - firstKlaz Dj - [ 2023 remix ]'), { song: 'Lei Lusi', artist: 'firstKlaz Dj' });
  assert.deepEqual(splitTitle('DJ Junior - Rosi Ni Yanuyanu Vonu (Remix)'), { song: 'Rosi Ni Yanuyanu Vonu', artist: 'DJ Junior' });
  assert.equal(cleanTitle('DJ JORDAN_-_LAUTI AU REMIX #2024'), 'DJ JORDAN - LAUTI AU REMIX');
  assert.deepEqual(splitTitle('Isa Lei'), { song: 'Isa Lei', artist: '' });
});

test('search matches every word, in title or playlist', async () => {
  const { searchTracks } = await core();
  const tracks = [{ title: 'Isa Lei', playlist: 'Classics' }, { title: 'Lei Lusi', playlist: 'Dimau Mix' }, { title: 'Bula Maleya', playlist: 'Classics' }];
  assert.equal(searchTracks(tracks, 'lei').length, 2);
  assert.equal(searchTracks(tracks, 'lei classics').length, 1);
  assert.equal(searchTracks(tracks, '').length, 3);
  assert.equal(searchTracks(tracks, '', 2).length, 2);
});

test('replay timeline shortens pauses and fits in 30 seconds', async () => {
  const { buildTimeline, LEAD_MS, TAIL_MS, MAX_GAP_MS, MAX_EXPORT_MS } = await core();
  const pts = [{ t: 1000, x: 0, y: 0, r: 40, down: true }, { t: 1100, x: 5, y: 5, r: 40 }, { t: 9100, x: 9, y: 9, r: 40, down: true }];
  const tl = buildTimeline(pts);
  assert.equal(tl.points[0].t, LEAD_MS);
  assert.equal(tl.points[2].t - tl.points[1].t, MAX_GAP_MS);
  assert.equal(tl.totalMs, LEAD_MS + 100 + MAX_GAP_MS + TAIL_MS);
  const long = Array.from({ length: 200 }, (_, i) => ({ t: i * 300, x: i, y: i, r: 40 }));
  const tl2 = buildTimeline(long);
  assert.ok(tl2.totalMs <= MAX_EXPORT_MS + 1, 'video stays within 30 s');
  assert.deepEqual(buildTimeline([]).points, []);
});

test('mp4 is preferred when the browser can record it', async () => {
  const { pickMime } = await core();
  assert.match(pickMime(() => true), /^video\/mp4/);
  assert.match(pickMime((m) => m.startsWith('video/webm')), /^video\/webm/);
  assert.equal(pickMime(() => false), '');
});

test('scratched share counts clear pixels', async () => {
  const { clearedShare } = await core();
  const px = new Uint8ClampedArray(16 * 4 * 4);
  for (let i = 3; i < px.length; i += 4) px[i] = 255;
  assert.equal(clearedShare(px), 0);
  px.fill(0);
  assert.equal(clearedShare(px), 1);
});

test('page is linked from the welcome screen and the music player, and loads its files', () => {
  const html = fs.readFileSync(path.join(root, 'song-scratch.html'), 'utf8');
  assert.match(html, /src="\/song-scratch\.js\?v=/);
  assert.match(html, /href="\/song-scratch\.css\?v=/);
  for (const id of ['ss-canvas', 'ss-search', 'ss-songs', 'ss-photo', 'ss-file', 'ss-save', 'ss-picture', 'ss-reveal', 'ss-reset', 'ss-brush', 'ss-start'])
    assert.match(html, new RegExp(`id="${id}"`), id);
  const js = fs.readFileSync(path.join(root, 'song-scratch.js'), 'utf8');
  for (const id of js.matchAll(/\$\('([a-z-]+)'\)/g)) assert.match(html, new RegExp(`id="${id[1]}"`), `${id[1]} used by the script exists`);
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /href="\/song-scratch\.html"/);
  assert.match(fs.readFileSync(path.join(root, 'music-library.js'), 'utf8'), /\/song-scratch\.html/);
});

const editor = () => import(path.join(root, 'song-scratch-editor.mjs').replace(/\\/g, '/').replace(/^([A-Za-z]):/, 'file:///$1:'));
// Minimal canvas stand-in: measureText = 0.5 px per font px per character.
const fakeCtx = () => { const c = { font: '16px x' }; c.measureText = (t) => ({ width: String(t).length * parseFloat(/(\d+)px/.exec(c.font)[1]) * .5 }); return c; };

test('editor: tapping finds the topmost layer, honouring move, scale and turn', async () => {
  const { newLayer, hitLayer } = await editor();
  const c = fakeCtx();
  const a = newLayer({ type: 'emoji', ch: '🌺', x: 200, y: 200 });
  const b = newLayer({ type: 'emoji', ch: '🔥', x: 220, y: 210 });
  assert.equal(hitLayer(c, [a, b], 215, 205), b, 'top layer wins');
  assert.equal(hitLayer(c, [a, b], 600, 900), null);
  const t = newLayer({ type: 'text', text: 'Bula', font: 'classic', x: 360, y: 400, s: 2, r: Math.PI / 2 });
  assert.equal(hitLayer(c, [t], 360, 400 + 100), t, 'turned 90°: text now runs down the page');
  assert.equal(hitLayer(c, [t], 360 + 150, 400), null);
});

test('editor: pinch gives scale and turn, scale is kept in bounds', async () => {
  const { pinch, clampScale } = await editor();
  const g = pinch([{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 200 }]);
  assert.ok(Math.abs(g.k - 2) < 1e-9);
  assert.ok(Math.abs(g.dr - Math.PI / 2) < 1e-9);
  assert.equal(clampScale(100), 6);
  assert.equal(clampScale(0), .25);
});

test('editor: undo history returns earlier copies, not live objects', async () => {
  const { history } = await editor();
  const h = history(2);
  const layers = [{ id: 1, x: 1 }];
  h.push({ layers }); layers[0].x = 99;
  h.push({ layers: [] }); h.push({ layers: [{ id: 2 }] });
  assert.equal(h.size, 2, 'oldest dropped at the limit');
  assert.deepEqual(h.pop().layers, [{ id: 2 }]);
  assert.deepEqual(h.pop().layers, []);
  assert.equal(h.pop(), null);
});

test('editor: every tool tab has its panel', () => {
  const html = fs.readFileSync(path.join(root, 'song-scratch.html'), 'utf8');
  for (const m of html.matchAll(/data-tab="([a-z]+)"/g)) assert.match(html, new RegExp(`id="ss-tab-${m[1]}"`), m[1]);
  for (const m of ['scratch', 'draw', 'move']) assert.match(html, new RegExp(`data-mode="${m}"`));
});

const { pathToFileURL } = require('node:url');
const media = () => import(pathToFileURL(path.join(root, 'song-scratch-media.mjs')).href);
const drafts = () => import(pathToFileURL(path.join(root, 'song-scratch-drafts.mjs')).href);

test('layouts: cells fill the story with a gap and taps find the right cell', async () => {
  const { LAYOUTS, cellRects, cellAt, GAP } = await media();
  for (const [k, l] of Object.entries(LAYOUTS)) {
    const cells = cellRects(k, 720, 1280);
    assert.equal(cells.length, l.n, k);
    const area = cells.reduce((a, [, , w, h]) => a + w * h, 0);
    assert.ok(area <= 720 * 1280 && area > 720 * 1280 * .95, `${k} covers the story`);
  }
  assert.deepEqual(cellRects('two-v', 720, 1280)[1], [0, (1280 - GAP) / 2 + GAP, 720, (1280 - GAP) / 2]);
  assert.equal(cellAt('four', 720, 1280, 700, 1270), 3);
  assert.equal(cellAt('four', 720, 1280, 360, 10), -1, 'the gap is no cell');
});

test('framing: cover-fit, turned pictures swap sides, panning stops at the edges', async () => {
  const { frameBox, clampPan } = await media();
  const size = { w: 800, h: 600 };
  const b = frameBox(size, 720, 1280, { zoom: 1 });
  assert.ok(Math.abs(b.h - 1280) < 1e-6 && b.w >= 720, 'landscape photo fills a tall story');
  const t = frameBox(size, 720, 1280, { zoom: 1, rot: 90 });
  assert.ok(t.w >= 1280 - 1e-6 && t.h >= 720 - 1e-6, 'turned photo still covers');
  const p = clampPan(size, 720, 1280, { zoom: 1, px: 5000, py: 5000 });
  assert.equal(p.py, 0, 'no room to move up or down');
  assert.ok(p.px > 0 && p.px < 5000, 'sideways pan stops at the edge');
});

test('animations: entrances finish, loops stay near rest, typing reveals text', async () => {
  const { animate, ANIMS } = await media();
  for (const k of Object.keys(ANIMS)) {
    const a = animate(k, 5, 3);
    for (const v of Object.values(a)) assert.ok(Number.isFinite(v), k);
  }
  assert.equal(animate('pop', 2).ds, 1);
  assert.equal(animate('fade', 0).alpha, 0);
  assert.equal(animate('fade', 3).alpha, 1);
  assert.equal(animate('type', 0.7).reveal, 0.5);
  assert.equal(animate('type', 9).reveal, 1);
  assert.deepEqual(animate('none', 1), { dx: 0, dy: 0, ds: 1, dr: 0, alpha: 1, reveal: 1 });
});

test('templates use real backgrounds, card styles, fonts and stickers', async () => {
  const { TEMPLATES, BACKGROUNDS, MOVING, ANIMS } = await media();
  const { CARD_STYLES, FONTS } = await editor();
  for (const [k, t] of Object.entries(TEMPLATES)) {
    assert.ok(BACKGROUNDS[t.bg], `${k} background`);
    assert.ok(CARD_STYLES[t.card], `${k} card`);
    for (const l of t.layers) {
      if (l.type === 'text') assert.ok(FONTS[l.font], `${k} font`);
      if (l.type === 'moving') assert.ok(MOVING[l.kind], `${k} moving sticker`);
      if (l.anim) assert.ok(ANIMS[l.anim], `${k} animation`);
    }
  }
});

test('drafts: labels say how long ago', async () => {
  const { draftLabel } = await drafts();
  const now = Date.UTC(2026, 10, 22, 12);
  assert.equal(draftLabel({ name: 'Bula', savedAt: now - 20000 }, now), 'Bula · just now');
  assert.equal(draftLabel({ name: 'Bula', savedAt: now - 5 * 60000 }, now), 'Bula · 5 min ago');
  assert.equal(draftLabel({ savedAt: now - 3 * 3600000 }, now), 'Story · 3 h ago');
});

test('scratch links: the public page plays the story, previews the cover and never trusts the card', () => {
  const inv = require(path.join(root, 'api', 'invite.js'));
  const stem = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222';
  const card = { handle: 'don', display_name: 'Donovan', scratch: {
    files: { under: stem + '-under.webp', cover: stem + '-cover.jpg', over: stem + '-over.webp' },
    song_id: 'fiji-remix-2026-05', song_start: 30, caption: 'Bula </script><img src=x onerror=alert(1)>' } };
  const sx = inv.scratchOf(card);
  assert.ok(sx);
  assert.equal(sx.song_start, 30);
  const html = inv.scratchPage(card, 'a'.repeat(32), sx).html;
  assert.match(html, /<meta property="og:image" content="https:\/\/xnxmumbvgtmlpenutlii\.supabase\.co\/storage\/v1\/object\/public\/sota-scratch-links\/[^"]+-cover\.jpg">/);
  assert.match(html, /SotaStoryMedia\.mountUrls/);
  assert.match(html, /href="https:\/\/sotakece\.com\/\?ref=a{32}"/, 'the join button credits the sender');
  assert.doesNotMatch(html, /<img src=x/, 'the caption is escaped');
  // a card without all three good file names, or with a strange song, is an ordinary invite
  assert.equal(inv.scratchOf({ scratch: { files: { under: '../etc', cover: stem + '-cover.jpg', over: stem + '-over.webp' }, song_id: 'x' } }), null);
  assert.equal(inv.scratchOf({ scratch: { ...card.scratch, song_id: 'BAD ID' } }), null);
  assert.equal(inv.scratchOf({ handle: 'don' }), null);
});

test('scratch links: posting errors are put into plain words', async () => {
  const post = await import(pathToFileURL(path.join(root, 'song-scratch-post.mjs')).href);
  assert.match(post.linkError(new Error('LINK_LIMIT')), /30 links today/);
  assert.match(post.linkError(new Error('Could not find the function public.bv_scratch_link_create')), /not switched on yet/);
  assert.match(post.postError(new Error('NOT_SIGNED_IN')), /sign in/i);
  assert.equal(post.extFor('image/jpeg'), 'jpg');
  assert.equal(post.extFor('text/html'), null);
});
