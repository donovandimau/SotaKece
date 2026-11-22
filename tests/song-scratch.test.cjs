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
