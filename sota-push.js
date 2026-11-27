/* Sota Kece — call alerts for a phone that has the site closed (Web Push).
   The member taps "Notify me about incoming calls". This asks the browser for permission, subscribes
   this browser, and stores the subscription on their account (bv_push_save). When they start a call,
   ring() asks /api/push to alert the people being rung. The service worker (sw.js) shows the alert.
   If the site's push keys are not set up yet, /api/push answers 503 and every call here ends quietly
   with {ok:false, reason:'off'}: nothing breaks and nothing is stored.
   On iPhone and iPad this only works once Sota Kece has been added to the Home Screen. */
(function (root, factory) { var api = factory(root); if (typeof module === 'object' && module.exports) module.exports = api; else root.SotaPush = api; })(typeof globalThis === 'object' ? globalThis : this, function (root) {
  function supported() {
    return !!(root.navigator && root.navigator.serviceWorker && root.PushManager && root.Notification);
  }
  function keyBytes(text) {
    var pad = '='.repeat((4 - text.length % 4) % 4), raw = root.atob((text + pad).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  function same(a, b) { if (!a || !b || a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  async function registration() {
    var ready = root.navigator.serviceWorker.ready;
    return Promise.race([ready, new Promise(function (_, no) { setTimeout(function () { no(Error('no_worker')); }, 6000); })]);
  }
  async function publicKey(fetcher) {
    var r = await (fetcher || root.fetch)('/api/push', { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    var j = await r.json();
    return j && typeof j.key === 'string' && j.key ? j.key : null;
  }
  /** Is this browser already set up for call alerts? */
  async function active() {
    if (!supported() || root.Notification.permission !== 'granted') return false;
    try { return !!(await (await registration()).pushManager.getSubscription()); } catch (_) { return false; }
  }
  /** Ask permission, subscribe this browser and store the subscription. Returns {ok} or {ok:false, reason}. */
  async function enable(client, fetcher) {
    if (!supported()) return { ok: false, reason: 'unsupported' };
    var permission = root.Notification.permission === 'granted' ? 'granted' : await root.Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };
    var key;
    try { key = await publicKey(fetcher); } catch (_) { return { ok: false, reason: 'off' }; }
    if (!key) return { ok: false, reason: 'off' };
    try {
      var reg = await registration(), want = keyBytes(key), sub = await reg.pushManager.getSubscription();
      if (sub && !same(sub.options && sub.options.applicationServerKey && new Uint8Array(sub.options.applicationServerKey), want)) { await sub.unsubscribe(); sub = null; }   // the site's key changed
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
      var json = sub.toJSON();
      if (!json.endpoint || !json.keys || !json.keys.p256dh || !json.keys.auth) return { ok: false, reason: 'failed' };
      var saved = await client.rpc('bv_push_save', { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth });
      if (saved && saved.error) return { ok: false, reason: 'save' };
      return { ok: true };
    } catch (_) { return { ok: false, reason: 'failed' }; }
  }
  /** Stop call alerts on this browser (also used when someone signs out, so the next person does not get them). */
  async function disable(client) {
    try {
      var sub = supported() && await (await registration()).pushManager.getSubscription();
      if (!sub) return { ok: true };
      try { await client.rpc('bv_push_remove', { p_endpoint: sub.endpoint }); } catch (_) {}
      await sub.unsubscribe();
      return { ok: true };
    } catch (_) { return { ok: false }; }
  }
  /** After starting a call: tell the server to alert the people being rung. Never throws. */
  async function ring(client, callId) {
    try {
      var s = await client.auth.getSession(), token = s && s.data && s.data.session && s.data.session.access_token;
      if (!token) return { ok: false };
      var r = await root.fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'ring', call: callId }) });
      return { ok: r.ok };
    } catch (_) { return { ok: false }; }
  }
  var REASONS = {
    unsupported: 'This browser cannot get call alerts while closed. On iPhone, add Sota Kece to your Home Screen first.',
    denied: 'Notifications are blocked for this site. Allow them in your browser settings, then try again.',
    off: 'Call alerts for closed phones are not switched on yet. You will still be alerted while this page is open.',
    save: 'Could not save your call alerts just now. Try again.',
    failed: 'Could not set up call alerts on this device.'
  };
  return { supported: supported, active: active, enable: enable, disable: disable, ring: ring, publicKey: publicKey, REASONS: REASONS, keyBytes: keyBytes };
});
