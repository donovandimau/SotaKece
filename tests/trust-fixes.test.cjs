'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('a private sere has no public page, and the old query is used before the visibility column exists', async () => {
  const env = { SOTA_SERVER_SECRET: 'a'.repeat(40) };
  const listen = require('../api/listen.js');
  const video = 'https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/sere-video/u/v.mp4';
  const urls = [];
  const mk = rows => async url => { urls.push(url); return { ok: true, json: async () => rows }; };
  assert.equal(await listen.readSere(env, 'id1', mk([{ id: 'id1', user_id: 'u', visibility: 'private', output_video_url: video }])), null);
  const wall = await listen.readSere(env, 'id1', mk([{ id: 'id1', user_id: 'u', visibility: 'wall', output_video_url: video }]));
  assert.ok(wall && wall.job.id === 'id1');
  urls.length = 0;
  let calls = 0;
  const old = async url => { urls.push(url); calls++; return calls === 1 ? { ok: false, status: 400, json: async () => ({}) } : { ok: true, json: async () => [{ id: 'id1', user_id: 'u', output_video_url: video }] }; };
  const before = await listen.readSere(env, 'id1', old);
  assert.ok(before && before.job.id === 'id1');
  assert.ok(urls[0].includes(',visibility') && !urls[1].includes('visibility'));
  // a temporary database error must never fall back to serving a sere that may be private
  const down = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(() => listen.readSere(env, 'id1', down), /db/);
});

function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), map: m };
}
function loadSync(storage) {
  globalThis.localStorage = storage;
  delete require.cache[require.resolve('../space-design-sync.js')];
  return require('../space-design-sync.js');
}
function client(server, saved) {
  return {
    auth: { onAuthStateChange(cb) { this.cb = cb; } },
    async rpc(name, args) { if (name === 'bv_prefs_get') return { data: server ? { page_design: server } : {} }; saved.push(args.p_page_design); return {}; }
  };
}
const design = accent => ({ version: 1, pages: { home: { accent } } });

test('a stale design on a new device does not overwrite the saved account design', async () => {
  const uid = 'u1', key = 'sota-page-design:v1:account:' + uid;
  const st = fakeStorage({ [key]: JSON.stringify(design('#aaaaaa')) });
  const sync = loadSync(st);
  const saved = [];
  const c = client(design('#bbbbbb'), saved);
  sync.init({ client: c });
  c.auth.cb('SIGNED_IN', { user: { id: uid } });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(saved.length, 0, 'nothing was pushed');
  assert.equal(JSON.parse(st.getItem(key)).pages.home.accent, '#bbbbbb', 'the account design was taken');
  assert.equal(JSON.parse(st.getItem('sota-page-design-backup:' + uid)).pages.home.accent, '#aaaaaa', 'the local copy is kept aside');
});

test('a design with no saved copy is sent to the account, and wallpaper pictures are not', async () => {
  const uid = 'u2', key = 'sota-page-design:v1:account:' + uid;
  const st = fakeStorage({ [key]: JSON.stringify({ version: 1, pages: { home: { accent: '#123456', imageId: 'pic1' } } }) });
  const sync = loadSync(st);
  const saved = [];
  const c = client(null, saved);
  sync.init({ client: c });
  c.auth.cb('SIGNED_IN', { user: { id: uid } });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].pages.home.accent, '#123456');
  assert.equal('imageId' in saved[0].pages.home, false);
});
