'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const wp = require('../api/_webpush.js');
const push = require('../api/push.js');
const root = path.join(__dirname, '..');

// A fixed message made by the independent http_ece library (a test-only random key pair, never used anywhere).
const VECTOR = {
 "text": "Sina is calling. Family Koro, video call.",
 "uaPublic": "BEzJQBoTzN5C5uXfDIIzoDQ8LLyZtKOAw8OpfQpe17-ssrMhxSr-5RCnl30AAYs_BnJ7rUBi-OZY3mKXX8OqBMg",
 "uaPrivate": "sUe-6Bv_5ADk96BO-k_E6ahQtv9-cV2-6hO6ZjdEopo",
 "asPublic": "BI6TWUVhBBx1Qi1ssVPR2HmHJYASFPIRNadfAS2aihAwVugfswP5Eq8DAfY_DSWjutKPGrkuQRmuqXeTbDFGKwk",
 "asPrivate": "aDNrn9Ab6RACd-A8kA_SIbmuBa8eAv9dL7uBCtVN3Uw",
 "auth": "8BQa82653vsyvgig4iF3aQ",
 "salt": "8dyvYasXOTyIfWiG20UEJA",
 "body": "8dyvYasXOTyIfWiG20UEJAAAEABBBI6TWUVhBBx1Qi1ssVPR2HmHJYASFPIRNadfAS2aihAwVugfswP5Eq8DAfY_DSWjutKPGrkuQRmuqXeTbDFGKwmo6d6jDZtddwfpnSm_ZlmNgKk0LcOWBcJO42PraGk9jixF4LpdBR5wuvCRAdWTUuZw9gVyS8ItojkX"
};

async function vapidPair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const pub = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url');
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: pub, privateKey: jwk.d, subject: 'mailto:support@sotakece.com' };
}

test('the encrypted message matches the independent library byte for byte', async () => {
  const pubRaw = Buffer.from(VECTOR.asPublic, 'base64url');
  const jwk = { kty: 'EC', crv: 'P-256', x: pubRaw.subarray(1, 33).toString('base64url'), y: pubRaw.subarray(33).toString('base64url'), d: VECTOR.asPrivate, ext: true };
  const keyPair = {
    privateKey: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']),
    publicKey: await crypto.subtle.importKey('raw', pubRaw, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  };
  const out = await wp.encrypt(VECTOR.text, VECTOR.uaPublic, VECTOR.auth, { salt: new Uint8Array(Buffer.from(VECTOR.salt, 'base64url')), keyPair });
  assert.equal(Buffer.from(out).toString('base64url'), VECTOR.body);
});

test('a real message is random each time, one record, and only the browser can read it', async () => {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16).toString('base64url');
  const a = await wp.encrypt('hello', ua.getPublicKey().toString('base64url'), auth);
  const b = await wp.encrypt('hello', ua.getPublicKey().toString('base64url'), auth);
  assert.notEqual(Buffer.from(a).toString('hex'), Buffer.from(b).toString('hex'));
  assert.equal(Buffer.from(a).readUInt32BE(16), 4096);
  assert.equal(a[20], 65);
  assert.equal(a.length, 21 + 65 + 'hello'.length + 1 + 16);
  await assert.rejects(() => wp.encrypt('x'.repeat(4000), ua.getPublicKey().toString('base64url'), auth), /payload_too_large/);
  await assert.rejects(() => wp.encrypt('x', 'AAAA', auth), /bad_p256dh/);
  await assert.rejects(() => wp.encrypt('x', ua.getPublicKey().toString('base64url'), 'AA'), /bad_auth/);
});

test('the VAPID token is signed by the site key, names the push service, and expires in 12 hours', async () => {
  const keys = await vapidPair();
  const now = Date.UTC(2026, 10, 27, 12, 0, 0);
  const header = await wp.vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, now);
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
  assert.ok(m);
  assert.equal(m[4], keys.publicKey);
  const pub = Buffer.from(keys.publicKey, 'base64url');
  const keyObject = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }, format: 'jwk' });
  assert.equal(crypto.verify('sha256', Buffer.from(m[1] + '.' + m[2]), { key: keyObject, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')), true);
  assert.deepEqual(JSON.parse(Buffer.from(m[1], 'base64url')), { typ: 'JWT', alg: 'ES256' });
  assert.deepEqual(JSON.parse(Buffer.from(m[2], 'base64url')), { aud: 'https://fcm.googleapis.com', exp: Math.floor(now / 1000) + 43200, sub: 'mailto:support@sotakece.com' });
  await assert.rejects(() => wp.vapidAuthorization('https://x.example.com/a', { publicKey: 'AAAA', privateKey: 'AAAA', subject: 'mailto:a@b.co' }), /bad_vapid_key/);
});

test('only public https push addresses are used', () => {
  for (const ok of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/abc']) assert.equal(wp.safeEndpoint(ok), true, ok);
  for (const bad of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://printer.local/x', 'https://svc.internal/x', 'https://user:pw@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'not a url', '', 'https://singlelabel/x', 'https://a.example.com/' + 'x'.repeat(1000)])
    assert.equal(wp.safeEndpoint(bad), false, bad);
});

test('send() posts an encrypted body with the right headers and reports a dropped subscription', async () => {
  const keys = await vapidPair();
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
  let seen;
  const ok = await wp.send(sub, { title: 't' }, keys, { fetcher: async (url, init) => { seen = { url, init }; return { status: 201 }; } });
  assert.deepEqual(ok, { ok: true, status: 201, gone: false });
  assert.equal(seen.url, sub.endpoint);
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Content-Encoding'], 'aes128gcm');
  assert.equal(seen.init.headers.TTL, '45');
  assert.equal(seen.init.headers.Urgency, 'high');
  assert.match(seen.init.headers.Authorization, /^vapid t=.+, k=.+$/);
  const gone = await wp.send(sub, {}, keys, { fetcher: async () => ({ status: 410 }) });
  assert.deepEqual(gone, { ok: false, status: 410, gone: true });
  let called = false;
  const refused = await wp.send({ ...sub, endpoint: 'https://127.0.0.1/x' }, {}, keys, { fetcher: async () => { called = true; return { status: 201 }; } });
  assert.equal(refused.ok, false); assert.equal(called, false, 'an internal address is never contacted');
});

// ---- /api/push ----
const CALL = '8f5f2f3a-1c4e-4b52-9a77-1d7c2f2b3a10';
const AUTH = 'Bearer ' + 'a'.repeat(40);
function targets(n) { return Array.from({ length: n }, (_, i) => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/' + i, p256dh: 'p', auth: 'a' })); }
function fakeFetch(answer) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, body: init && init.body ? JSON.parse(init.body) : null, headers: init && init.headers }); return answer(url, init); };
  f.calls = calls; return f;
}
const json = (data, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(data) });

test('ring() alerts each person once with the caller, the Koro and the kind of call, and clears dead addresses', async () => {
  const keys = await vapidPair();
  const env = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey };
  const f = fakeFetch(url => url.endsWith('/bv_call_push_targets') ? json({ from: 'Sina', group: 'Family Koro', mode: 'video', targets: targets(3) }) : json(null));
  const sent = [];
  const sender = async (t, message) => { sent.push(message); return t.endpoint.endsWith('/1') ? { ok: false, status: 410, gone: true } : t.endpoint.endsWith('/2') ? { ok: false, status: 500, gone: false } : { ok: true, status: 201 }; };
  const out = await push.ring(env, AUTH, CALL, f, sender);
  assert.deepEqual(out, { sent: 1, failed: 2, removed: 1 });
  assert.deepEqual(sent[0], { title: 'Sina is calling', body: 'Family Koro · video call', tag: CALL, url: '/communications.html?view=calls', call: CALL, mode: 'video' });
  const prune = f.calls.find(c => c.url.endsWith('/bv_push_prune'));
  assert.deepEqual(prune.body, { p_call: CALL, p_endpoints: ['https://fcm.googleapis.com/fcm/send/1'] });
  assert.equal(f.calls[0].headers.Authorization, AUTH, 'the caller\'s own sign-in is used');
});

test('ring() does nothing without the site keys, and never reads targets (so the once-per-call guard is kept)', async () => {
  const f = fakeFetch(() => json({}));
  assert.deepEqual(await push.ring({}, AUTH, CALL, f), { off: true, sent: 0, failed: 0, removed: 0 });
  assert.deepEqual(await push.ring({ VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_KEY: 'y' }, AUTH, CALL, f), { off: true, sent: 0, failed: 0, removed: 0 });
  assert.equal(f.calls.length, 0);
});

test('ring() handles a rejected sign-in, an empty answer, unsafe addresses, messages with odd text, and big Koros', async () => {
  const keys = await vapidPair();
  const env = { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey };
  assert.deepEqual(await push.ring(env, AUTH, CALL, fakeFetch(() => json(null, 401))), { unauthorised: true });
  assert.deepEqual(await push.ring(env, AUTH, CALL, fakeFetch(() => json({}))), { sent: 0, failed: 0, removed: 0 });
  const msgs = [];
  const f = fakeFetch(() => json({ from: 'Sina\n\u0007<b>x</b>' + 'y'.repeat(200), group: 'G', mode: 'audio', targets: [...targets(150), { endpoint: 'https://127.0.0.1/x', p256dh: 'p', auth: 'a' }] }));
  const out = await push.ring(env, AUTH, CALL, f, async (t, m) => { msgs.push(m); return { ok: true }; });
  assert.equal(out.sent, 100, 'at most 100 alerts per call, internal addresses skipped');
  assert.ok(msgs[0].title.length <= 60 + ' is calling'.length && !/[\u0000-\u001f]/.test(msgs[0].title));
  assert.equal(msgs[0].body, 'G · audio call');
  await assert.rejects(() => push.ring(env, AUTH, CALL, fakeFetch(() => json(null, 500))), /db 500/);
});

function res() { const r = { headers: {}, code: 0, body: null, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; }

test('/api/push hands out the public key only when the keys are set, and rejects bad requests', async () => {
  const keys = await vapidPair();
  const saved = { ...process.env };
  try {
    delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
    let r = res(); await push({ method: 'GET', headers: {} }, r);
    assert.equal(r.code, 503);
    process.env.VAPID_PUBLIC_KEY = keys.publicKey; process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    r = res(); await push({ method: 'GET', headers: {} }, r);
    assert.equal(r.code, 200); assert.deepEqual(r.body, { key: keys.publicKey });
    assert.ok(!JSON.stringify(r.body).includes(keys.privateKey));
    r = res(); await push({ method: 'PUT', headers: {} }, r); assert.equal(r.code, 405);
    r = res(); await push({ method: 'POST', headers: {}, body: { action: 'ring', call: CALL } }, r); assert.equal(r.code, 401);
    r = res(); await push({ method: 'POST', headers: { authorization: AUTH }, body: { action: 'ring', call: 'nope' } }, r); assert.equal(r.code, 400);
    r = res(); await push({ method: 'POST', headers: { authorization: AUTH }, body: { action: 'other', call: CALL } }, r); assert.equal(r.code, 400);
  } finally { for (const k of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
});

test('the Worker serves /api/push and the setup script makes a key pair the handler accepts', async () => {
  assert.match(fs.readFileSync(path.join(root, 'cloudflare/site-worker.js'), 'utf8'), /'\/api\/push': push/);
  const out = require('node:child_process').execFileSync(process.execPath, [path.join(root, 'scripts/make-vapid-keys.mjs')], { encoding: 'utf8' });
  const env = Object.fromEntries(out.trim().split('\n').map(l => l.split('=')));
  assert.ok(push.vapid(env), 'the generated pair passes the handler\'s checks');
  const header = await wp.vapidAuthorization('https://fcm.googleapis.com/x', { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: 'mailto:a@b.co' });
  assert.match(header, /^vapid t=/);
});

// ---- the service worker ----
function loadWorker() {
  const listeners = {}, shown = [], opened = [];
  const windows = [];
  const self = {
    location: { origin: 'https://sotakece.com' }, addEventListener: (n, f) => { listeners[n] = f; },
    registration: { showNotification: async (title, options) => { shown.push({ title, options }); } },
    clients: { matchAll: async () => windows, openWindow: async url => { opened.push(url); } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), { self, URL, Request, Response, console, setTimeout, caches: {}, fetch: async () => ({}) });
  const run = async (name, event) => { let p; event.waitUntil = x => { p = x; }; listeners[name](event); await p; };
  return { run, shown, opened, windows };
}

test('the service worker always shows the alert, with the call as its tag, and never trusts odd text', async () => {
  const w = loadWorker();
  await w.run('push', { data: { json: () => ({ title: 'Sina is calling', body: 'Family Koro · video call', call: CALL }) } });
  assert.equal(w.shown[0].title, 'Sina is calling');
  assert.equal(w.shown[0].options.tag, CALL);
  assert.equal(w.shown[0].options.requireInteraction, true);
  assert.equal(w.shown[0].options.data.url, '/communications.html?view=calls');
  await w.run('push', { data: { json: () => { throw new Error('bad'); } } });
  assert.equal(w.shown[1].title, 'Someone is calling', 'a broken message still shows an alert');
  await w.run('push', { data: null });
  assert.equal(w.shown.length, 3);
  await w.run('push', { data: { json: () => ({ title: 'a\n\u0007b'.repeat(100), url: 'https://evil.example/', call: '../x' }) } });
  assert.ok(w.shown[3].title.length <= 80 && !/[\u0000-\u001f]/.test(w.shown[3].title));
  assert.equal(w.shown[3].options.tag, 'sota-call');
  assert.equal(w.shown[3].options.data.url, '/communications.html?view=calls', 'the link in the message is ignored');
});

test('tapping the alert opens Koro calls, reusing an open window', async () => {
  const w = loadWorker(); let closed = 0, focused = 0, navigated = null;
  await w.run('notificationclick', { notification: { close: () => { closed++; } } });
  assert.equal(closed, 1); assert.deepEqual(w.opened, ['https://sotakece.com/communications.html?view=calls']);
  w.windows.push({ url: 'https://sotakece.com/index.html', focus: async () => { focused++; }, navigate: async u => { navigated = u; } });
  await w.run('notificationclick', { notification: { close() {} } });
  assert.equal(focused, 1); assert.equal(navigated, 'https://sotakece.com/communications.html?view=calls'); assert.equal(w.opened.length, 1);
});

// ---- the browser module ----
function browser({ permission = 'default', answer = 'granted', keyReply = { ok: true, json: async () => ({ key: 'BAEC' }) }, existing = null, subscribeFails = false } = {}) {
  const log = { subscribe: [], unsub: 0, rpc: [], fetch: [] };
  const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/z', options: {}, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/z', keys: { p256dh: 'P'.repeat(87), auth: 'a'.repeat(22) } }), unsubscribe: async () => { log.unsub++; return true; } };
  let current = existing;
  const reg = { pushManager: { getSubscription: async () => current, subscribe: async o => { if (subscribeFails) throw new Error('x'); log.subscribe.push(o); current = sub; return sub; } } };
  const Notification = { permission, requestPermission: async () => { Notification.permission = answer; return answer; } };
  const root = { navigator: { serviceWorker: { ready: Promise.resolve(reg) } }, PushManager: {}, Notification, atob: s => Buffer.from(s, 'base64').toString('binary'), fetch: async (u, i) => { log.fetch.push({ u, i }); return typeof keyReply === 'function' ? keyReply(u, i) : keyReply; } };
  const client = { rpc: async (n, a) => { log.rpc.push({ n, a }); return { error: null }; }, auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } };
  const load = () => { const src = fs.readFileSync(path.join(root_dir, 'sota-push.js'), 'utf8'); const m = { exports: {} }; vm.runInNewContext(src, { module: m, globalThis: root, Uint8Array, Error, setTimeout, Promise }); return m.exports; };
  return { api: load(), client, log, root };
}
const root_dir = root;

const same = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

test('turning alerts on asks permission, subscribes this browser and saves it on the account', async () => {
  const b = browser();
  const r = await b.api.enable(b.client);
  same(r, { ok: true });
  assert.equal(b.log.subscribe[0].userVisibleOnly, true);
  assert.ok(b.log.subscribe[0].applicationServerKey.length > 0);
  same(b.log.rpc[0], { n: 'bv_push_save', a: { p_endpoint: 'https://fcm.googleapis.com/fcm/send/z', p_p256dh: 'P'.repeat(87), p_auth: 'a'.repeat(22) } });
  assert.equal(await b.api.active(), true);
});

test('alerts fail quietly and say why: blocked, not switched on yet, unsupported, subscribe failure', async () => {
  same(await browser({ answer: 'denied' }).api.enable(browser().client), { ok: false, reason: 'denied' });
  const off = browser({ keyReply: { ok: false, status: 503, json: async () => ({}) } });
  same(await off.api.enable(off.client), { ok: false, reason: 'off' });
  assert.equal(off.log.rpc.length, 0, 'nothing is stored while the site keys are not set');
  same(await browser({ subscribeFails: true }).api.enable(browser().client), { ok: false, reason: 'failed' });
  const none = browser(); none.root.PushManager = undefined;
  assert.equal(none.api.supported(), false);
  same(await none.api.enable(none.client), { ok: false, reason: 'unsupported' });
  for (const k of ['unsupported', 'denied', 'off', 'save', 'failed']) assert.ok(browser().api.REASONS[k].length > 20);
});

test('turning alerts off removes the address from the account and the browser; ring() never throws', async () => {
  const b = browser(); await b.api.enable(b.client);
  same(await b.api.disable(b.client), { ok: true });
  assert.equal(b.log.unsub, 1); assert.equal(b.log.rpc.at(-1).n, 'bv_push_remove');
  const r = await b.api.ring(b.client, CALL);
  assert.equal(r.ok, true);
  const post = b.log.fetch.at(-1);
  assert.equal(post.u, '/api/push'); assert.equal(post.i.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(post.i.body), { action: 'ring', call: CALL });
  const broken = browser({ keyReply: () => { throw new Error('offline'); } });
  same(await broken.api.ring(broken.client, CALL), { ok: false });
});

test('the calls panel offers the alert, rings after starting a call, and sign-out turns it off', () => {
  const calls = fs.readFileSync(path.join(root, 'native-calls.js'), 'utf8');
  assert.match(calls, /even when this page is closed/);
  assert.match(calls, /window\.SotaPush\.enable\(o\.sb\)/);
  assert.match(calls, /window\.SotaPush\?\.ring\(o\.sb,next\.call\.id\)/);
  assert.match(calls, /window\.SotaPush\?\.disable\(o\.sb\)/);
  assert.match(fs.readFileSync(path.join(root, 'communications.js'), 'utf8'), /await window\.SotaPush\?\.disable\(sb\)/);
  const html = fs.readFileSync(path.join(root, 'communications.html'), 'utf8');
  assert.ok(html.indexOf('/sota-push.js') > -1 && html.indexOf('/sota-push.js') < html.indexOf('/native-calls.js'), 'loaded before the calls panel');
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'/sota-push.js'"));
});
