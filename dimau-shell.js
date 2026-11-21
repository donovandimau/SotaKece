/* Dimau Super App shell v1 — app switcher, Volau button and Sign in with Dimau.
 * Master copy: dimau-platform-standard/super-app/dimau-shell.js. Copy byte for byte; never fork an app copy.
 *
 *   <script src="/dimau-shell.js?v=1" data-app="fiji-history" data-client-id="<oauth client id>" defer></script>
 *
 * data-app        this app's id (marked as current in the switcher; required)
 * data-client-id  this app's Sign in with Dimau client id (public PKCE client). Without it, no sign-in is offered.
 * data-redirect   the exact redirect URI registered for that client. Default: this origin + "/dimau-sso-callback.html"
 *                 (copy super-app/dimau-sso-callback.html beside this file; it loads only this script with
 *                 data-page="callback", so no other script can consume the returned code first)
 * data-scope      default "openid email profile"
 * data-launcher   "float" (default when the page has no [data-dimau-shell-open]) or "none"
 * data-volau      "on" (default) or "off" (use "off" on credit, identity and payment surfaces)
 *
 * Opens from any [data-dimau-shell-open] element (e.g. a Premium Shell nav tab) or the floating button.
 * Global: window.DimauSuperApp (window.DimauShell belongs to the Premium Shell and is left alone).
 *   DimauSuperApp.open() / close()
 *   DimauSuperApp.auth.getSession()   -> null | { access_token, refresh_token, expires_at, user:{ id, email, name, is_anonymous:false } }
 *   DimauSuperApp.auth.signIn() / signOut() / user() / onChange(fn)
 * getSession() has the same shape as DimauAccount.getSession() (identity/ACCOUNT_SESSION.md), so widgets that take
 * opts.getSession can use it. Await it right before each protected request; never store or log the token.
 * Host CSP needs: connect-src https://xnxmumbvgtmlpenutlii.supabase.co; frame-src https://volau.dimau-fintech.com
 */
(function (root) {
  'use strict';
  if (root.DimauSuperApp) return;

  var AUTH = 'https://xnxmumbvgtmlpenutlii.supabase.co/auth/v1';
  var ACCOUNT = 'https://account.dimau-fintech.com/';
  var VOLAU = 'https://volau.dimau-fintech.com/';

  // flag: 'live' shown normally, 'sandbox' shown with a "Test only" label, 'hidden' not shown.
  var PILLARS = Object.freeze([
    { id: 'home', name: 'Home', apps: [
      { id: 'sota-kece', name: 'Sota Kece', purpose: 'Your people, your feed', url: 'https://sotakece.com/', flag: 'live' }] },
    { id: 'money', name: 'Money', apps: [
      { id: 'lavo', name: 'Lavo', purpose: 'Budget every dollar', url: 'https://lavo.dimau-fintech.com/', flag: 'live' },
      { id: 'debt-calculator', name: 'My Debt Calculator', purpose: 'Plan your way out of debt', url: 'https://mydebtcalculator.app/', flag: 'live' },
      { id: 'sema', name: 'SEMA', purpose: 'Simple accounts for small business', url: 'https://sema-accounting.donovan-dimau.workers.dev/', flag: 'sandbox' }] },
    { id: 'explore', name: 'Explore', apps: [
      { id: 'fiji-navigate', name: 'Fiji Navigate', purpose: 'Directions across Fiji', url: 'https://nav.fijimap.com/', flag: 'live' },
      { id: 'fiji-3d-maps', name: 'Fiji 3D Maps', purpose: 'See Fiji in 3D', url: 'https://3d.fijimap.com/', flag: 'live' },
      { id: 'fiji-homes', name: 'Fiji Homes', purpose: 'Homes and land', url: 'https://homes.fijiinvestment.com/', flag: 'live' },
      { id: 'vitiauto', name: 'VitiAuto', purpose: 'Cars for sale', url: 'https://vitiauto.com/', flag: 'live' },
      { id: 'viti-market', name: 'Viti Market', purpose: 'Shop independent sellers', url: 'https://viti-market.dimau-fintech.com/', flag: 'live' }] },
    { id: 'knowledge', name: 'Knowledge', apps: [
      { id: 'fiji-history', name: 'Fiji: A Living History', purpose: 'Walk through Fiji’s past', url: 'https://fijihistory.com/', flag: 'live' },
      { id: 'ai-vola-tabu', name: 'Ai Vola Tabu', purpose: 'Read and hear the Bible', url: 'https://fijianbible.com/', flag: 'live' },
      { id: 'fijilearn', name: 'FijiLearn', purpose: 'Lessons for every class', url: 'https://fijilearn.com/', flag: 'live' }] },
    { id: 'trust', name: 'Trust', apps: [
      { id: 'bula-score', name: 'Bula Score', purpose: 'Your credit story', url: 'https://bulascore.dimau-fintech.com/', flag: 'sandbox' },
      { id: 'vanua-vault', name: 'Vanua Vault', purpose: 'Proof of what you own', url: 'https://qele.fijiinvestment.com/', flag: 'live' },
      { id: 'rating-hub', name: 'Rating Hub', purpose: 'Reviews you can trust', url: 'https://ratings.dimau-fintech.com/', flag: 'live' }] }
  ]);

  /* ---------------- Sign in with Dimau (OAuth 2.1 authorization code + PKCE, public client) ---------------- */
  function b64u(bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return root.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function claims(jwt) {
    try {
      var p = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var json = decodeURIComponent(root.atob(p).split('').map(function (c) { return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2); }).join(''));
      return JSON.parse(json);
    } catch (e) { return null; }
  }

  function createAuth(o) {
    var clientId = o.clientId, redirect = o.redirectUri, scope = o.scope || 'openid email profile';
    var f = o.fetch, ls = o.localStorage, ss = o.sessionStorage, loc = o.location, crypto = o.crypto, now = o.now || Date.now;
    var KEY = 'dimau.sso.session.v1:' + clientId, PENDING = 'dimau.sso.pending.v1';
    var listeners = [], refreshing = null;

    function read(store, k) { try { return JSON.parse(store.getItem(k) || 'null'); } catch (e) { return null; } }
    function write(store, k, v) { try { v == null ? store.removeItem(k) : store.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
    function emit() { var u = user(); listeners.slice().forEach(function (fn) { try { fn(u); } catch (e) { /* listener error */ } }); }

    function toSession(t, prev) {
      var c = claims(t.access_token) || {}, meta = c.user_metadata || {};
      return {
        access_token: t.access_token,
        refresh_token: t.refresh_token || (prev && prev.refresh_token) || null,
        expires_at: Math.floor(now() / 1000) + (Number(t.expires_in) || 3600),
        user: { id: c.sub || (prev && prev.user && prev.user.id) || null, email: c.email || (prev && prev.user && prev.user.email) || null,
          name: meta.full_name || meta.name || (prev && prev.user && prev.user.name) || null, is_anonymous: false }
      };
    }
    function token(body) {
      return f(AUTH + '/oauth/token', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.access_token) { var e = new Error('token'); e.status = r.status; throw e; } return j; }); });
    }

    function signIn(returnTo) {
      if (!clientId) return Promise.reject(new Error('Sign in with Dimau is not set up for this app.'));
      var verifier = b64u(crypto.getRandomValues(new Uint8Array(32)));
      var state = b64u(crypto.getRandomValues(new Uint8Array(16)));
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (h) {
        write(ss, PENDING, { clientId: clientId, redirect: redirect, verifier: verifier, state: state, returnTo: sameOrigin(returnTo || loc.href), at: now() });
        if (!read(ss, PENDING)) throw new Error('Allow storage in this tab to sign in.');
        var u = new URL(AUTH + '/oauth/authorize');
        u.searchParams.set('response_type', 'code'); u.searchParams.set('client_id', clientId);
        u.searchParams.set('redirect_uri', redirect); u.searchParams.set('scope', scope); u.searchParams.set('state', state);
        u.searchParams.set('code_challenge', b64u(new Uint8Array(h))); u.searchParams.set('code_challenge_method', 'S256');
        loc.assign(u.toString());
      });
    }
    function sameOrigin(href) {
      try { var u = new URL(href, loc.href); return u.origin === loc.origin ? u.pathname + u.search + u.hash : '/'; } catch (e) { return '/'; }
    }

    // Finishes a sign-in when this page is the redirect target. Only acts on a state this tab created.
    function handleCallback(href) {
      var u = new URL(href || loc.href), state = u.searchParams.get('state'), pending = read(ss, PENDING);
      if (!clientId || !state || !pending || pending.state !== state || pending.clientId !== clientId) return Promise.resolve({ handled: false });
      write(ss, PENDING, null);
      var back = pending.returnTo || '/', code = u.searchParams.get('code'), error = u.searchParams.get('error');
      // Same page: just drop code/state from the address. Different page: go there for real.
      function finish(result) {
        result.navigated = false;
        try {
          var here = new URL(href || loc.href); here.searchParams.delete('code'); here.searchParams.delete('state');
          here.searchParams.delete('error'); here.searchParams.delete('error_description');
          var target = new URL(back, loc.href);
          if (target.pathname === here.pathname) o.history.replaceState(null, '', target.pathname + target.search + target.hash);
          else { result.navigated = true; loc.replace(target.pathname + target.search + target.hash); }
        } catch (e) { /* ignore */ }
        return result;
      }
      if (error) return Promise.resolve(finish({ handled: true, ok: false, error: error === 'access_denied' ? 'denied' : 'failed' }));
      if (!code || now() - pending.at > 10 * 60 * 1000) return Promise.resolve(finish({ handled: true, ok: false, error: 'expired' }));
      return token({ grant_type: 'authorization_code', code: code, client_id: clientId, redirect_uri: redirect, code_verifier: pending.verifier })
        .then(function (t) { write(ls, KEY, toSession(t)); emit(); return finish({ handled: true, ok: true }); },
              function () { return finish({ handled: true, ok: false, error: 'failed' }); });
    }

    function doRefresh() {
      var s = read(ls, KEY);                        // another tab may already have refreshed
      if (!s || !s.refresh_token) return Promise.resolve(null);
      if (s.expires_at - 60 > Math.floor(now() / 1000)) return Promise.resolve(s);
      return token({ grant_type: 'refresh_token', refresh_token: s.refresh_token, client_id: clientId })
        .then(function (t) { var n = toSession(t, s); write(ls, KEY, n); return n; },
              function (e) { if (e.status >= 400 && e.status < 500) { write(ls, KEY, null); emit(); } return null; });
    }
    function getSession() {
      var s = read(ls, KEY);
      if (!s || !s.access_token) return Promise.resolve(null);
      if (s.expires_at - 60 > Math.floor(now() / 1000)) return Promise.resolve(s);
      if (!refreshing) {
        var run = function () { return doRefresh(); };
        var p = o.locks ? o.locks.request('dimau-sso-refresh:' + clientId, run) : run();
        refreshing = Promise.resolve(p).then(function (r) { refreshing = null; return r; }, function () { refreshing = null; return null; });
      }
      return refreshing;
    }
    function user() { var s = read(ls, KEY); return s && s.user ? s.user : null; }
    function signOut() { write(ls, KEY, null); emit(); }
    function onChange(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }

    return { enabled: !!clientId, signIn: signIn, handleCallback: handleCallback, getSession: getSession, user: user,
      signOut: signOut, onChange: onChange, storageKey: KEY, _emit: emit };
  }

  /* ---------------- UI (only in a browser page) ---------------- */
  var doc = root.document;
  var me = doc && (doc.currentScript || doc.querySelector('script[src*="dimau-shell.js"]'));
  var ds = (me && me.dataset) || {};
  var APP = /^[a-z0-9][a-z0-9-]{0,63}$/.test(ds.app || '') ? ds.app : '';
  var START = root.location && root.location.href;   // read before any other script rewrites the address
  var CALLBACK_PAGE = ds.page === 'callback';
  var NOTICE = 'dimau.sso.notice.v1';
  // The return page carries no client id: it takes the one this tab saved when sign-in started.
  var started = null;
  if (CALLBACK_PAGE) { try { started = JSON.parse(root.sessionStorage.getItem('dimau.sso.pending.v1') || 'null'); } catch (e) { started = null; } }
  var cid = CALLBACK_PAGE ? (started && started.clientId) : ds.clientId;
  var auth = createAuth({
    clientId: /^[A-Za-z0-9-]{8,64}$/.test(cid || '') ? cid : '',
    redirectUri: (CALLBACK_PAGE && started && started.redirect) || ds.redirect || (root.location && root.location.origin + '/dimau-sso-callback.html'), scope: ds.scope,
    fetch: root.fetch && root.fetch.bind(root), localStorage: safe('localStorage'), sessionStorage: safe('sessionStorage'),
    location: root.location, history: root.history, crypto: root.crypto, locks: root.navigator && root.navigator.locks
  });
  function safe(name) { try { return root[name]; } catch (e) { return { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} }; } }

  var api = { version: '1.0.0', pillars: PILLARS, auth: { getSession: auth.getSession, signIn: auth.signIn, signOut: auth.signOut, user: auth.user, onChange: auth.onChange },
    open: function () { open(); }, close: function () { close(); }, _createAuth: createAuth };
  root.DimauSuperApp = api;
  if (!doc || !root.location) return;

  root.addEventListener('storage', function (e) { if (e.key === auth.storageKey) { auth._emit(); } });
  auth.onChange(function (u) {
    render();
    try { root.dispatchEvent(new CustomEvent('dimau:auth', { detail: { signedIn: !!u } })); } catch (e) { /* old browser */ }
  });

  var notice = '';
  var host, sheet, volauSheet, lastFocus;
  var CSS = ':host{all:initial}[hidden]{display:none!important}*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}'
    + '.scrim{position:fixed;inset:0;background:rgba(6,18,32,.5);z-index:2147483000;display:flex;align-items:flex-end;justify-content:center}'
    + '@media(min-width:720px){.scrim{align-items:center}}'
    + '.panel{background:#fff;color:#0b2a4a;width:100%;max-width:30rem;max-height:88vh;overflow:auto;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.25)}'
    + '@media(min-width:720px){.panel{border-radius:16px}}'
    + '.top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}'
    + 'h2{font-size:1.15rem;font-weight:800;margin:0}h3{font-size:.75rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#46607a;margin:14px 0 4px}'
    + 'button,a{font:inherit;color:inherit}button{cursor:pointer}'
    + '.x{min-width:44px;min-height:44px;border:0;background:none;font-size:1.4rem;border-radius:12px}'
    + '.acct{display:flex;align-items:center;gap:10px;background:#f1f7fb;border-radius:12px;padding:10px 12px}'
    + '.acct .who{flex:1;min-width:0;font-size:.9rem}.acct .who strong{display:block;overflow-wrap:anywhere}'
    + '.go{min-height:44px;border:0;border-radius:999px;padding:0 16px;font-weight:700;color:#fff;background:linear-gradient(135deg,#1E90FF,#00a3d9)}'
    + '.quiet{min-height:44px;border:1.5px solid #1E90FF;border-radius:999px;padding:0 14px;font-weight:700;background:#fff}'
    + '.small{font-size:.8rem;color:#46607a}.msg{font-size:.85rem;margin:8px 0 0;padding:8px 10px;border-radius:8px;background:#fdecec;color:#8c1c1c}'
    + 'ul{list-style:none;margin:0;padding:0}li a{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 8px;border-radius:12px;text-decoration:none}'
    + 'li a:hover{background:#f1f7fb}li a[aria-current]{background:#e6f2ff}'
    + '.badge{flex:none;display:inline-grid;place-items:center;width:36px;height:36px;border-radius:4px 14px;background:#1E90FF;color:#fff;font-weight:800}'
    + '.t{flex:1;min-width:0}.t strong{display:block;font-size:.95rem}.t span{font-size:.8rem;color:#46607a}'
    + '.tag{font-size:.7rem;font-weight:800;color:#8a4b00;background:#fff4e0;border-radius:999px;padding:2px 8px}'
    + ':focus-visible{outline:2px solid #00BCD4;outline-offset:2px}'
    + '.vpanel{background:#fff;width:100%;max-width:30rem;height:min(88vh,640px);border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden}'
    + '@media(min-width:720px){.vpanel{border-radius:16px}}.vpanel .top{padding:6px 8px 6px 16px;margin:0}iframe{flex:1;border:0;width:100%}'
    + '.fab{position:fixed;z-index:2147482000;width:56px;height:56px;border-radius:4px 20px;border:0;box-shadow:0 6px 20px rgba(11,42,74,.3);display:grid;place-items:center}'
    + '.launch{left:16px;background:#0b2a4a;color:#fff}.volau{right:16px;background:linear-gradient(135deg,#1E90FF,#00a3d9);color:#fff;font-weight:800}'
    + '@media(prefers-reduced-motion:no-preference){.panel,.vpanel{animation:up .18s ease-out}@keyframes up{from{transform:translateY(12px);opacity:.6}}}';

  function el(tag, attrs, kids) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'text') n.textContent = v; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function link(app) {
    var u = new URL(app.url);
    if (APP) u.searchParams.set('utm_source', APP);
    u.searchParams.set('utm_medium', 'dimau-shell');
    return u.toString();
  }
  function count(app) { try { if (root.dimau && typeof root.dimau.track === 'function') root.dimau.track('click', { kind: 'shell_switch', from: APP || null, to: app.id }); } catch (e) { /* never block */ } }

  function accountRow() {
    if (!auth.enabled) return el('p', { class: 'small', text: 'Use your one Dimau account in every Dimau app.' });
    var u = auth.user();
    if (!u) {
      return el('div', {}, [el('div', { class: 'acct' }, [
        el('div', { class: 'who' }, [el('strong', { text: 'One account for every Dimau app' }), el('span', { class: 'small', text: 'Nothing is shared until you choose Allow.' })]),
        el('button', { class: 'go', type: 'button', text: 'Sign in with Dimau', onclick: function () {
          auth.signIn().catch(function (e) { notice = e.message; render(); });
        } })
      ]), notice ? el('p', { class: 'msg', role: 'alert', text: notice }) : null]);
    }
    return el('div', { class: 'acct' }, [
      el('div', { class: 'who' }, [el('strong', { text: u.name || u.email || 'Signed in' }), el('a', { class: 'small', href: ACCOUNT, text: 'Manage your Dimau account' })]),
      el('button', { class: 'quiet', type: 'button', text: 'Sign out', onclick: function () { auth.signOut(); } })
    ]);
  }

  function render() {
    if (!sheet || sheet.hidden) return;
    var panel = sheet.querySelector('.panel');
    panel.textContent = '';
    panel.appendChild(el('div', { class: 'top' }, [el('h2', { id: 'dsa-title', text: 'Dimau apps', tabindex: '-1' }),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Close', text: '×', onclick: close })]));
    panel.appendChild(accountRow());
    PILLARS.forEach(function (p) {
      var apps = p.apps.filter(function (a) { return a.flag !== 'hidden'; });
      if (!apps.length) return;
      panel.appendChild(el('h3', { text: p.name }));
      panel.appendChild(el('ul', {}, apps.map(function (a) {
        return el('li', {}, [el('a', { href: link(a), 'aria-current': a.id === APP ? 'page' : null, onclick: function () { count(a); } }, [
          el('span', { class: 'badge', 'aria-hidden': 'true', text: a.name.charAt(0) }),
          el('span', { class: 't' }, [el('strong', { text: a.name }), el('span', { text: a.purpose })]),
          a.flag === 'sandbox' ? el('span', { class: 'tag', text: 'Test only' }) : null
        ])]);
      })));
    });
  }

  function trap(e, box) {
    if (e.key === 'Escape') { e.preventDefault(); closeAll(); return; }
    if (e.key !== 'Tab') return;
    var f = [].slice.call(box.querySelectorAll('a[href],button,iframe,[tabindex]:not([tabindex="-1"])'));
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], active = host.shadowRoot.activeElement;
    if (e.shiftKey && (active === first || !active)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  function ensureHost() {
    if (host) return;
    host = el('div', { 'data-dimau-super-app': '' });
    var sr = host.attachShadow({ mode: 'open' });
    sr.appendChild(el('style', { text: CSS }));
    sheet = el('div', { class: 'scrim', hidden: true, onclick: function (e) { if (e.target === sheet) close(); } },
      [el('div', { class: 'panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dsa-title' })]);
    sheet.addEventListener('keydown', function (e) { trap(e, sheet); });
    sr.appendChild(sheet);
    doc.body.appendChild(host);
  }

  function open() {
    ensureHost(); lastFocus = doc.activeElement; sheet.hidden = false; render();
    setExpanded(true);
    var t = sheet.querySelector('#dsa-title'); if (t) t.focus();
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true; notice = ''; setExpanded(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function setExpanded(v) { [].forEach.call(doc.querySelectorAll('[data-dimau-shell-open]'), function (b) { b.setAttribute('aria-expanded', v ? 'true' : 'false'); }); }

  function openVolau() {
    ensureHost(); lastFocus = doc.activeElement;
    if (!volauSheet) {
      var src = new URL(VOLAU); src.searchParams.set('from', APP || 'dimau');
      volauSheet = el('div', { class: 'scrim', onclick: function (e) { if (e.target === volauSheet) closeVolau(); } }, [
        el('div', { class: 'vpanel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Volau assistant' }, [
          el('div', { class: 'top' }, [el('h2', { text: 'Volau' }), el('button', { class: 'x', type: 'button', 'aria-label': 'Close Volau', text: '×', onclick: closeVolau })]),
          el('iframe', { title: 'Volau assistant', src: src.toString(), loading: 'lazy', referrerpolicy: 'strict-origin-when-cross-origin', allow: '' })])]);
      volauSheet.addEventListener('keydown', function (e) { trap(e, volauSheet); });
      host.shadowRoot.appendChild(volauSheet);
    }
    volauSheet.hidden = false;
    var x = volauSheet.querySelector('.x'); if (x) x.focus();
  }
  function closeVolau() { if (volauSheet && !volauSheet.hidden) { volauSheet.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); } }
  function closeAll() { close(); closeVolau(); }

  function fabs() {
    var hasTrigger = !!doc.querySelector('[data-dimau-shell-open]');
    var wantLauncher = ds.launcher ? ds.launcher === 'float' : !hasTrigger;
    var wantVolau = ds.volau !== 'off';
    if (!wantLauncher && !wantVolau) return;
    ensureHost();
    var bottom = doc.body.classList.contains('dps-has-nav') ? 'calc(64px + env(safe-area-inset-bottom) + 16px)' : 'calc(16px + env(safe-area-inset-bottom))';
    if (wantLauncher) host.shadowRoot.appendChild(el('button', { class: 'fab launch', type: 'button', 'aria-label': 'Dimau apps', 'aria-haspopup': 'dialog', style: 'bottom:' + bottom, onclick: open },
      [el('span', { 'aria-hidden': 'true', text: '⋮⋮⋮' })]));
    if (wantVolau) host.shadowRoot.appendChild(el('button', { class: 'fab volau', type: 'button', 'aria-label': 'Ask Volau', 'aria-haspopup': 'dialog', style: 'bottom:' + bottom, onclick: openVolau, text: 'V' }));
  }

  function message(err) { return err === 'denied' ? 'Sign-in was cancelled. Nothing was shared.' : 'Sign-in did not finish. Please try again.'; }
  function start() {
    if (CALLBACK_PAGE) {
      // dimau-sso-callback.html: finish the sign-in, then always leave for the page the person started on.
      auth.handleCallback(START).then(function (r) {
        if (r.handled && !r.ok) { try { root.sessionStorage.setItem(NOTICE, r.error); } catch (e) { /* storage blocked */ } }
        if (!r.handled || !r.navigated) root.location.replace('/');
      });
      return;
    }
    doc.addEventListener('click', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-dimau-shell-open]');
      if (t) { e.preventDefault(); open(); }
    });
    fabs();
    var pendingNotice = null;
    try { pendingNotice = root.sessionStorage.getItem(NOTICE); root.sessionStorage.removeItem(NOTICE); } catch (e) { /* storage blocked */ }
    if (pendingNotice) { notice = message(pendingNotice); open(); }
    // Pages that are themselves the registered redirect URI also finish sign-in here.
    auth.handleCallback(START).then(function (r) { if (r.handled && !r.ok) { notice = message(r.error); open(); } });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
