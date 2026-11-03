/* Dimau Install — make any Dimau app installable, offline-ready and up to date.
 * Drop-in. No build step, no dependencies, no framework. Optional worker: /dimau-install-sw.js.
 *
 * Use:  <link rel="manifest" href="/manifest.webmanifest">
 *       <script src="/dimau-install.js" data-app="myfiji" data-label="MyFiji" defer></script>
 *
 * Optional attributes:
 *   data-sw      Path of a Dimau install worker (/dimau-install-sw.js, or a /sw.js that imports it) for this script
 *                to register and manage: offline note, update note, status() and save().
 *                Leave it out when the site already registers its own worker (delivery-worker.js, the older
 *                dimau-sw.js core, a custom sw.js). This script then never registers, replaces or messages a worker,
 *                and never promises offline use. Never point it at a worker that is not the Dimau install worker.
 *   data-prompt  "auto" (default): offer to install from the second visit, at most once a month after "Not now".
 *                "manual": only when the page is opened with ?install=1 (links from an app list) or via the API.
 *   data-notify  "off": no "works offline" / "update ready" notes (for pages that show their own status).
 *   data-shared-origin  Present when several installable apps share this origin; the help then explains how an app
 *                installed earlier with a wider scope can hide the install option.
 *   data-buttons "glass": the note's buttons are Sota glass round icon buttons (translucent dome, chrome rim, one symbol
 *                per action, the label as their accessible name and tooltip). Pages can tint them with
 *                --sota-unified-tint. Leave it out for the standard text buttons.
 *
 * Any element with data-dimau-install-button (e.g. a "Get the app" button) installs, or shows the steps, when
 * clicked, and is hidden when the app is already running installed.
 *
 * Inside a frame (an app embedded in another page) it stays silent and DimauInstall.framed is true; inside a store
 * app (Capacitor) it stays silent and DimauInstall.native is true.
 *
 * API: window.DimauInstall = {app, label, platform, standalone, framed, native, canInstall(), install(), help(), status(), save()}
 * Every outcome is announced as a "dimau:install" event on document, detail {app, outcome, platform},
 * so any analytics can count installs without this file knowing about it.
 * Nothing here uploads anything. Visit counts and choices stay in this browser's localStorage.
 */
(function () {
  'use strict';
  if (window.DimauInstall) return;
  var me = document.currentScript || document.querySelector('script[src*="dimau-install.js"]');
  var APP = (me && me.dataset.app) || 'dimau';
  var LABEL = (me && me.dataset.label) || document.title || 'this app';
  var SW = (me && me.dataset.sw) || '';
  // Only a path on this site names a worker this script owns; anything else means the site manages its own.
  // "//host/x.js" and "/\host/x.js" both point at another host.
  var OWN = /^\/(?![\/\\])/.test(SW);
  var SHARED = !!(me && me.hasAttribute('data-shared-origin'));
  var MODE = (me && me.dataset.prompt) === 'manual' ? 'manual' : 'auto';
  var NOTIFY = !(me && me.dataset.notify === 'off');
  var GLASS = !!(me && me.dataset.buttons === 'glass');
  var STORE = 'dimau.install.' + APP;
  var MONTH = 30 * 24 * 3600 * 1000;
  // Embedded in another page (Ops and MyFiji show apps in frames), the browser can only install the page around it,
  // and inside a store app (Capacitor loading the site) the app is already installed. Either way this copy stays
  // silent: no offer, no steps, no notes, no worker, and "Get the app" buttons are hidden.
  var framed, wrapped = false;
  try { framed = window.self !== window.top; } catch (e) { framed = true; }
  try { wrapped = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch (e) {}
  if (framed || wrapped) {
    hideButtons();
    window.DimauInstall = {
      app: APP, label: LABEL, platform: framed ? 'framed' : 'native', standalone: !framed, framed: framed, native: !framed,
      canInstall: function () { return false; },
      install: function () { return Promise.resolve(framed ? 'framed' : 'native'); },
      help: function () {},
      status: function () { return Promise.resolve(null); },
      save: function () { return Promise.resolve({status: null, persisted: false}); },
      registration: function () { return null; }
    };
    return;
  }
  var ua = navigator.userAgent || '';
  var standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;
  var platform =
    /\b(FBAN|FBAV|Instagram|Line\/|TikTok|BytedanceWebview|musical_ly|Snapchat|Pinterest|LinkedInApp)\b/i.test(ua) ? 'inapp' :
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' :
    /Android/i.test(ua) ? 'android' :
    /Firefox\//.test(ua) ? 'firefox' :
    /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua) ? 'mac-safari' : 'desktop';
  // Offline is only promised when this script runs the worker that provides it.
  var EARLIER = SHARED ? ' If you installed a Dimau app before, open it once; after it updates (within a day) this one can be installed too.' : ' Already installed? Open it from your apps.';
  var HELP = {
    ios: 'Tap the Share button, then “Add to Home Screen”. It opens full screen' + (OWN ? ' and works offline.' : '.'),
    android: 'Open your browser menu (⋮) and choose “Install app” or “Add to Home screen”.' + (SHARED ? ' Only “Open app”?' : '') + EARLIER,
    'mac-safari': 'In Safari’s menu bar choose File → Add to Dock.',
    firefox: 'On Windows, use the taskbar button in Firefox’s address bar to pin it as an app. Elsewhere, open this page in Chrome or Edge to install it.' + (OWN ? ' It works offline either way.' : ''),
    inapp: 'You are in an in-app browser. Open the menu (⋯) and choose “Open in browser”, then install from there.',
    desktop: 'Click the install icon at the right of the address bar, or open the browser menu and choose “Install”.' + (SHARED ? ' No install option?' : '') + EARLIER
  };
  var asked = new URLSearchParams(location.search).has('install');
  // Removes ?install=1 so a reload or a shared link does not offer again. The Next.js App Router ignores an address
  // change whose state carries its own __NA marker and later writes its stored address, flag included, back; so it
  // gets a copy without the marker (Next.js adds it back itself). Every other site keeps its history state as it was.
  function dropFlag() {
    var params = new URLSearchParams(location.search);
    if (!params.has('install')) return;
    params.delete('install');
    var kept = history.state;
    if (kept && typeof kept === 'object' && kept.__NA) {
      kept = {};
      for (var key in history.state) if (key !== '__NA') kept[key] = history.state[key];
    }
    try { history.replaceState(kept, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } catch (e) {}
  }
  if (asked) {
    dropFlag();
    // Routers that read the address before this script runs (the Next.js App Router) write it back while
    // hydrating, so check again once the page has loaded and a moment later.
    var settle = function () { dropFlag(); setTimeout(dropFlag, 1000); };
    if (document.readyState === 'complete') settle(); else window.addEventListener('load', settle);
  }

  // Hides "Get the app" buttons, including ones a framework renders later. Browsers without constructable stylesheets
  // (iOS 16.3 and older) get the buttons already on the page hidden instead.
  function hideButtons() {
    try { var sheet = new CSSStyleSheet(); sheet.replaceSync('[data-dimau-install-button]{display:none!important}'); document.adoptedStyleSheets = document.adoptedStyleSheets.concat(sheet); }
    catch (e) {
      var now = function () { var b = document.querySelectorAll('[data-dimau-install-button]'); for (var i = 0; i < b.length; i++) b[i].style.setProperty('display', 'none', 'important'); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', now); else now();
    }
  }
  function load() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } }
  function save(patch) { var s = load(); for (var k in patch) s[k] = patch[k]; try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) {} return s; }
  function announce(outcome) {
    try { document.dispatchEvent(new CustomEvent('dimau:install', {detail: {app: APP, outcome: outcome, platform: platform}})); } catch (e) {}
  }
  var state = save({visits: (load().visits || 0) + 1});

  /* ---------- small UI in a shadow root, so host page styles never clash ---------- */
  // The Museum Bula card from the Dimau Kit (shell/dimau-kit.css), redrawn inside the shadow root where the kit cannot reach.
  // Sits above the floating Bula/help launchers: bottom-left on wide screens, raised clear of them on phones.
  var CSS = ':host{all:initial}.bar{position:fixed;left:16px;bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483002;display:flex;align-items:center;gap:12px;width:max-content;max-width:min(560px,calc(100vw - 300px));box-sizing:border-box;padding:14px 16px;border-radius:20px;background:#bae6fd;color:#12354b;box-shadow:0 20px 60px rgba(0,0,0,.35);font:15px/1.4 var(--dimau-app-font,Arial,Helvetica,sans-serif);animation:in .2s ease-out}' +
    '@media(prefers-reduced-motion:reduce){.bar{animation:none}}@keyframes in{from{opacity:0;transform:translateY(12px)}}' +
    'img{width:44px;height:44px;border-radius:12px;flex:none}.text{flex:1;min-width:0}.text b{display:block;font-size:16px;font-weight:800;letter-spacing:-.01em}.text span{color:#24506e;font-size:14px}' +
    '.actions{display:flex;gap:8px;flex:none}button{min-height:44px;padding:10px 16px;cursor:pointer;font:700 14px var(--dimau-app-font,Arial,Helvetica,sans-serif);color:#000080;background:rgba(240,248,255,.86);border:1px solid #1e90ff;border-radius:4px 16px 4px 16px;box-shadow:0 0 0 1px rgba(135,206,235,.35),0 0 12px rgba(30,144,255,.45),inset 0 0 14px rgba(30,144,255,.18)}button:hover{background:rgba(214,238,250,.95)}button.go{color:#fff;background:linear-gradient(135deg,#012169,#1f8fbf);border:0;border-radius:12px;box-shadow:none;font-size:15px}button.go:hover{filter:brightness(1.08)}button:focus-visible{outline:2px solid #00b4d8;outline-offset:2px}' +
    '@media(max-width:760px){.bar{left:12px;right:12px;bottom:calc(72px + env(safe-area-inset-bottom,0px));width:auto;max-width:none;flex-wrap:wrap}.text{flex:1 1 calc(100% - 56px)}.actions{width:100%;justify-content:flex-end}}' +
    '.live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}';
  if (GLASS) CSS += "/* Sota glass controls: translucent domes, chrome rims and action-specific symbols. */\nbutton.dg-action,[data-no-task]{--dg-tint:var(--sota-unified-tint,#aadbf3);position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;border:1px solid #42516c88;border-radius:50%;padding:10px;color:#101924;--dg-bg:radial-gradient(ellipse at 50% 110%,color-mix(in srgb,var(--dg-tint) 80%,#fff) 0%,transparent 64%),linear-gradient(155deg,#ffffffc9 0%,#ffffff29 38%,color-mix(in srgb,var(--dg-tint) 65%,transparent) 72%,#ffffffa6 100%);background:var(--dg-bg);background-color:color-mix(in srgb,var(--dg-tint) 48%,transparent);box-shadow:inset 0 2px 1px #fff,inset 2px 0 2px #d7faffcc,inset -2px 0 2px #ffcdf7a3,inset 0 -3px 2px #62728b88,0 1px 0 #ffffffc9,0 5px 12px #152a4538;backdrop-filter:blur(12px) saturate(1.25);-webkit-backdrop-filter:blur(12px) saturate(1.25);text-shadow:0 1px 0 #ffffff70;cursor:pointer;transition:transform .15s,box-shadow .15s;box-sizing:border-box}\n.dg-action{width:48px;flex:0 0 48px;font-size:0}\n.dg-action::before,[data-no-task]::before{content:'';position:absolute;z-index:-1;left:16%;right:16%;top:5px;height:24%;border-top:4px solid #ffffffe6;border-radius:50%;pointer-events:none}\n.dg-action::after,[data-no-task]::after{content:'';position:absolute;z-index:-1;right:5px;top:27%;height:31%;width:3px;border-radius:50%;background:linear-gradient(#ffffffc7,#ffffff00);pointer-events:none}\n.dg-action:hover:not(:disabled),[data-no-task]:hover:not(:disabled){background:var(--dg-bg);transform:translateY(-1px);box-shadow:inset 0 2px 1px #fff,inset 2px 0 3px #d7faff,inset -2px 0 3px #ffcdf7c7,inset 0 -3px 2px #62728b88,0 6px 15px #152a4550}\n.dg-action:active:not(:disabled),[data-no-task]:active:not(:disabled){transform:translateY(1px)}\n.dg-action:focus-visible,[data-no-task]:focus-visible{outline:3px solid #0a548a;outline-offset:3px}\n.dg-action[hidden]{display:none!important}.dg-action:disabled,[data-no-task]:disabled{opacity:.45;cursor:default;transform:none}\n.dg-symbol{position:relative;display:block;flex:none;width:23px;height:23px;overflow:visible;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;fill:none;filter:drop-shadow(0 1px 0 #ffffff80);pointer-events:none}\n.dg-action[data-glass-action=send]{--dg-tint:var(--sota-unified-tint,#57cec2)}.dg-action[data-glass-action=settings]{--dg-tint:var(--sota-unified-tint,#d5daf0)}.dg-action[data-glass-action=close],.dg-action[data-glass-action=remove]{--dg-tint:var(--sota-unified-tint,#f6a2a8)}.dg-action[data-glass-action=hide]{--dg-tint:var(--sota-unified-tint,#d7c8ec)}.dg-action[data-glass-action=restore]{--dg-tint:var(--sota-unified-tint,#8adbd3)}.dg-action[data-glass-action=attach]{--dg-tint:var(--sota-unified-tint,#8bc8f4)}.dg-action[data-glass-action=read]{--dg-tint:var(--sota-unified-tint,#ffd26a)}.dg-action[data-glass-action=stop]{--dg-tint:var(--sota-unified-tint,#ed7e83)}.dg-action[data-glass-action=clear]{--dg-tint:var(--sota-unified-tint,#f4bb88)}\n@media(prefers-reduced-motion:reduce){.dg-action,[data-no-task]{transition:none}}\n@media(forced-colors:active){.dg-action,[data-no-task]{background:ButtonFace!important;color:ButtonText!important;border:2px solid ButtonText!important;box-shadow:none!important;backdrop-filter:none}.dg-action::before,.dg-action::after,[data-no-task]::before,[data-no-task]::after{display:none}.dg-symbol{filter:none}}\n.actions{gap:10px}.actions .dg-action{--dg-tint:var(--sota-unified-tint,#c6dcf2)}.actions .dg-action.go{--dg-tint:var(--sota-unified-tint,#82cec7);color:#101924;border:1px solid #42516c88;border-radius:50%;font-size:0}.actions .dg-action[data-glass-action=later]{--dg-tint:var(--sota-unified-tint,#f6cf83)}.actions .dg-action[data-glass-action=reload]{--dg-tint:var(--sota-unified-tint,#b9b0eb)}.actions .dg-action[data-glass-action=ok]{--dg-tint:var(--sota-unified-tint,#98d8b5)}";
  var host, root, live;
  function ui() {
    if (root) return root;
    host = document.createElement('div');
    host.setAttribute('data-dimau-install', '');
    root = host.attachShadow({mode: 'open'});
    try { var sheet = new CSSStyleSheet(); sheet.replaceSync(CSS); root.adoptedStyleSheets = [sheet]; }
    catch (e) { var style = document.createElement('style'); style.textContent = CSS; root.appendChild(style); }
    // Screen readers announce changes to a live region that already exists, not one inserted already filled.
    live = document.createElement('div'); live.className = 'live'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    root.appendChild(live);
    (document.body || document.documentElement).appendChild(host);
    return root;
  }
  function icon() {
    var link = document.querySelector('link[rel="apple-touch-icon"]') || document.querySelector('link[rel~="icon"][type="image/png"]') || document.querySelector('link[rel~="icon"]');
    return link ? link.href : '';
  }
  // Shows one message at a time. actions: [{label, primary, run}]. A `passing` note never covers a message
  // that is already on screen (e.g. "works offline" arriving while the install offer is shown).
  // data-buttons="glass": a round icon button whose symbol matches the action; the label stays its name and tooltip.
  function glassButton(btn, label) {
    var kind = /install/i.test(label) ? 'install' : /reload/i.test(label) ? 'reload' : /later|not now/i.test(label) ? 'later' : 'ok';
    var symbols = {"install": "<rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"3\"/><path d=\"M12 6v9m-4-4 4 4 4-4M10 19h4\"/>", "later": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 6v6l4 2\"/>", "reload": "<path d=\"M20 9a8 8 0 1 0 .2 6M20 3v6h-6\"/>", "ok": "<path d=\"m5 12 4 4L20 5\"/>"};
    btn.classList.add('dg-action'); btn.dataset.glassAction = kind; btn.setAttribute('aria-label', label); btn.title = label;
    btn.innerHTML = '<svg class="dg-symbol" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + symbols[kind] + '</svg>';
  }
  function show(title, body, actions, seconds, passing) {
    var r = ui();
    var old = r.querySelector('.bar');
    if (old && passing) return;
    if (old) old.remove();
    var bar = document.createElement('div'); bar.className = 'bar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', title);
    var src = icon(); if (src) { var img = document.createElement('img'); img.src = src; img.alt = ''; bar.appendChild(img); }
    var text = document.createElement('div'); text.className = 'text';
    var b = document.createElement('b'); b.textContent = title; var s = document.createElement('span'); s.textContent = body;
    text.appendChild(b); text.appendChild(s); bar.appendChild(text);
    var row = document.createElement('div'); row.className = 'actions';
    function close() { bar.remove(); }
    (actions || []).forEach(function (a) {
      var btn = document.createElement('button'); btn.type = 'button'; if (a.primary) btn.className = 'go';
      if (GLASS) glassButton(btn, a.label); else btn.textContent = a.label;
      btn.addEventListener('click', function () { close(); if (a.run) a.run(); });
      row.appendChild(btn);
    });
    bar.appendChild(row);
    // Keys pressed on these buttons must not reach the host app's shortcuts (Space plays the timeline, Delete removes objects).
    ['keydown', 'keyup', 'keypress'].forEach(function (type) {
      bar.addEventListener(type, function (e) { if (type === 'keydown' && e.key === 'Escape') close(); e.stopPropagation(); });
    });
    r.appendChild(bar);
    live.textContent = '';
    setTimeout(function () { live.textContent = title + '. ' + body; }, 100);
    if (seconds) setTimeout(close, seconds * 1000);
  }

  /* ---------- install ---------- */
  var deferred = null;
  function snooze() { save({dismissedAt: Date.now()}); announce('dismissed'); }
  function install() {
    if (!deferred) { help(); return Promise.resolve('help'); }
    var prompt = deferred; deferred = null;
    announce('prompted');
    prompt.prompt();
    return prompt.userChoice.then(function (choice) {
      var outcome = choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
      if (outcome === 'dismissed') save({dismissedAt: Date.now()});
      announce(outcome);
      return outcome;
    }, function () { return 'dismissed'; });
  }
  function help() {
    announce('help_shown');
    show('Install ' + LABEL, HELP[platform] || HELP.desktop, [{label: 'OK', primary: true}]);
  }
  function offer() {
    if (standalone) return;
    announce('offered');
    show('Install ' + LABEL, OWN ? 'Opens in its own window, starts instantly and works offline.' : 'Opens in its own window, one tap from your home screen.', [
      {label: 'Not now', run: snooze},
      {label: 'Install', primary: true, run: install}
    ]);
  }
  var wantsOffer = !standalone && (asked || (MODE === 'auto' && state.visits >= 2 && !state.installed && !(Date.now() - (state.dismissedAt || 0) < MONTH)));
  // Someone who asked to install (?install=1) gets one-click install even if the browser's prompt arrives after the written steps.
  var askedPending = asked && !standalone;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (wantsOffer || askedPending) { wantsOffer = askedPending = false; offer(); }
  });
  window.addEventListener('appinstalled', function () {
    deferred = null;
    save({installed: true});
    announce('installed');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    show(LABEL + ' installed', 'Find it on your home screen or in your apps.', [{label: 'OK', primary: true}], 8);
  });
  // Browsers without an install prompt: explain the manual step when asked, and once to returning iPhone/iPad visitors.
  // Chrome only sends its prompt after the page has loaded, so the wait starts at load.
  if (wantsOffer && (asked || platform === 'ios')) {
    var explain = function () {
      setTimeout(function () { if (wantsOffer && !deferred) { wantsOffer = false; if (!asked) save({dismissedAt: Date.now()}); help(); } }, asked ? 2500 : 4000);
    };
    if (document.readyState === 'complete') explain(); else window.addEventListener('load', explain);
  }

  /* ---------- offline + updates ---------- */
  var sw = navigator.serviceWorker;
  var registration = null;
  // Resolves null on timeout, including when no worker ever becomes active (e.g. saving failed on a bad connection).
  function ask(type, extra) {
    if (!sw || !OWN) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { resolve(null); }, type === 'DIMAU_SAVE' ? 120000 : 5000);
      sw.ready.then(function (reg) {
        var channel = new MessageChannel();
        channel.port1.onmessage = function (e) { clearTimeout(timer); resolve(e.data); };
        var message = {type: type}; for (var k in extra) message[k] = extra[k];
        if (reg.active) reg.active.postMessage(message, [channel.port2]);
      });
    });
  }
  // Build files this page is running, e.g. /assets/video-CJ-OeXZl.js.
  function pageFiles() {
    var nodes = document.querySelectorAll('script[src],link[rel="stylesheet"][href],link[rel="modulepreload"][href]');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var url = new URL(nodes[i].src || nodes[i].href, location.href);
      if (url.origin === location.origin && url.pathname.indexOf('/assets/') === 0) out.push(url.pathname);
    }
    return out;
  }
  // The Vite dev server must never be served from a saved production copy.
  var dev = !!document.querySelector('script[src^="/@vite/client"]');
  var canSave = OWN && !!sw && !dev && window.isSecureContext;
  function register() { return sw.register(SW, {scope: '/', updateViaCache: 'none'}); }
  if (sw && dev && OWN) {
    sw.getRegistrations().then(function (regs) { regs.forEach(function (reg) { reg.unregister(); }); }).catch(function () {});
  } else if (canSave) {
    var hadController = !!sw.controller;
    // A new version took over. Pages load fresh from the network, so only offer a reload when this page's
    // build files are not part of the new version (it was opened before the deploy, or offline).
    sw.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }
      var files = NOTIFY ? pageFiles() : [];
      if (!files.length) return;
      ask('DIMAU_STATUS', {paths: files}).then(function (r) {
        if (!r || !r.ok || r.status.mode !== 'precache' || r.status.current) return;
        announce('update_ready');
        show('Update ready', 'A newer version of ' + LABEL + ' is available.', [
          {label: 'Later'},
          {label: 'Reload', primary: true, run: function () { announce('updated'); location.reload(); }}
        ]);
      });
    });
    var start = function () {
      register().then(function (reg) {
        registration = reg;
        var installing = reg.installing;
        if (!hadController && installing) {
          installing.addEventListener('statechange', function () {
            if (installing.state !== 'activated' || !NOTIFY || load().offlineToast) return;
            save({offlineToast: true});
            announce('offline_ready');
            show(LABEL + ' works offline', 'Saved on this device. It will open even without a connection.', [{label: 'OK', primary: true}], 7, true);
          });
        }
        // Installed apps can stay open for days: look for a new version hourly while visible.
        var checked = Date.now();
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible' && Date.now() - checked > 3600e3) { checked = Date.now(); reg.update().catch(function () {}); }
        });
      }).catch(function () {});
    };
    if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
  }

  /* ---------- "Get the app" buttons placed by the page ---------- */
  var BUTTON = '[data-dimau-install-button]';
  document.addEventListener('click', function (e) {
    var target = e.target && e.target.closest ? e.target.closest(BUTTON) : null;
    if (!target) return;
    e.preventDefault();
    install();
  });
  // Already running as the installed app: hide the buttons.
  if (standalone) hideButtons();

  window.DimauInstall = {
    app: APP, label: LABEL, platform: platform, standalone: standalone, framed: false, native: false,
    canInstall: function () { return !!deferred; },
    install: install,
    help: help,
    // {version, mode, files, saved, runtime} from the service worker, or null when offline support is unavailable
    // or the site runs its own worker.
    status: function () { return ask('DIMAU_STATUS').then(function (r) { return r && r.ok ? r.status : null; }); },
    // Saves anything missing and asks the browser to keep it (Firefox asks the person first). If an earlier attempt
    // to save failed (no active worker), registering again makes the browser retry.
    save: function () {
      var persist = navigator.storage && navigator.storage.persist ? navigator.storage.persist().catch(function () { return false; }) : Promise.resolve(false);
      var retry = canSave && !sw.controller ? register().catch(function () { return false; }) : Promise.resolve(true);
      return Promise.all([retry.then(function (started) { return started === false ? null : ask('DIMAU_SAVE'); }), persist]).then(function (r) {
        var ok = r[0] && r[0].ok;
        if (ok) announce('saved_offline');
        return {status: ok ? r[0].status : null, persisted: r[1] === true};
      });
    },
    registration: function () { return registration; }
  };
})();
