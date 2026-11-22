'use strict';
// What the Cloudflare Worker "sotakece" does before the static files (cloudflare/site-worker.js
// is only the entry point). These are the vercel.json routes that static files cannot answer:
//
//   sere.sotakece.com/          -> the Sere app, sere/index.html (Vercel: host route to /sere/index.html)
//   /s/<sere id>/<key>          -> api/listen.js  (one singing photo)
//   /t/<track id>               -> api/listen.js  (one Island Mix song)
//   /p/<post id>/<token>        -> api/share.js   (a shared Talanoa Wall post)
//   /i/<token>                  -> api/invite.js  (an invite)
//
// The same handler files Vercel ran are used here, unchanged, through a small (req, res) adapter.
// /t/, /p/ and /i/ need nothing secret. /s/ needs SOTA_SERVER_SECRET (the key for the sota-server edge
// function, which reads the sere with the service key) and SERE_SECRET, both set on the Worker. If either is
// missing, /s/ answers a "try again" page (503); Vercel is retired, so there is nowhere to pass it to.
// Everything else goes to the static files. /api/* is handled before this file is reached, in
// cloudflare/site-worker.js.
const listen = require('../api/listen.js');
const share = require('../api/share.js');
const invite = require('../api/invite.js');
const routesConfig = require('./routes.json');

const SERE_HOST = 'sere.sotakece.com';

// The same patterns as the old vercel.json "routes" (vercel.json was retired on 22 Nov 2026).
const ROUTES = [
  { re: /^\/s\/([0-9a-fA-F-]{36})\/([0-9a-f]{32})\/?$/, handler: listen, query: (m) => ({ sere: m[1], k: m[2] }), secret: true },
  { re: /^\/t\/([a-z0-9-]{1,80})\/?$/, handler: listen, query: (m) => ({ track: m[1] }) },
  { re: /^\/p\/([0-9]{1,18})\/([a-fA-F0-9]{32})\/?$/, handler: share, query: (m) => ({ post: m[1], t: m[2] }) },
  { re: /^\/i\/([a-fA-F0-9]{32})\/?$/, handler: invite, query: (m) => ({ t: m[1] }) },
];
const SERE_SECRETS = ['SOTA_SERVER_SECRET', 'SERE_SECRET'];

// The headers on every answer: the static files get them from dist/_headers (cloudflare/_headers),
// the pages made here get them from cloudflare/routes.json (until 22 Nov 2026 both came from
// vercel.json "routes"). tests/site-worker.test.cjs checks the two stay the same.
const SITE_HEADERS = Object.entries(routesConfig.siteHeaders || {});

function match(pathname) {
  for (const route of ROUTES) {
    const m = pathname.match(route.re);
    if (m) return { route, query: route.query(m) };
  }
  return null;
}

function withSiteHeaders(response) {
  const out = new Response(response.body, response);
  for (const [k, v] of SITE_HEADERS) out.headers.set(k, v);
  return out;
}

/** Run a Vercel-style Node (req, res) handler and return a web Response. */
async function runNode(handler, request, query) {
  const headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  const url = new URL(request.url);
  const req = { method: request.method, url: url.pathname + url.search, headers, query: { ...Object.fromEntries(url.searchParams), ...query } };
  const out = { status: 200, headers: new Headers(), body: null };
  const res = {
    setHeader(k, v) { out.headers.set(k, String(v)); return res; },
    status(code) { out.status = code; return res; },
    send(data) { out.body = typeof data === 'string' ? data : JSON.stringify(data); return res; },
    json(data) { out.headers.set('content-type', 'application/json'); out.body = JSON.stringify(data); return res; },
    end(data) { if (data !== undefined) out.body = data; return res; },
  };
  await handler(req, res);
  return new Response(request.method === 'HEAD' ? null : out.body, { status: out.status, headers: out.headers });
}

// The same "That did not load" page the handlers give when the database cannot be reached.
function unavailable(request) {
  const out = listen.page({ status: 503, title: 'Sota Kece', description: 'Your people. Your music. Your space.', url: 'https://sotakece.com/',
    image: 'https://sotakece.com/assets/og-sota-kece-premium-20261111.jpg',
    body: '<article class="card"><div class="words"><h1>That did not load.</h1><p>Try the link again in a minute.</p></div></article><a class="cta" href="https://sotakece.com/">Open Sota Kece ↗</a>' });
  return new Response(request.method === 'HEAD' ? null : out.html, { status: 503, headers: {
    'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function handle(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  // sere.sotakece.com/ is the Sere app. Other paths on that host are the same files as sotakece.com.
  if (host === SERE_HOST && url.pathname === '/' && (request.method === 'GET' || request.method === 'HEAD')) {
    return env.ASSETS.fetch(new Request(new URL('/sere/', url), request));
  }

  const found = match(url.pathname);
  if (!found) return env.ASSETS.fetch(request);

  if (found.route.secret && !SERE_SECRETS.every((k) => env[k])) {
    // A sere secret is missing on the Worker: say so plainly rather than guess.
    if (request.method !== 'GET' && request.method !== 'HEAD') return withSiteHeaders(await runNode(listen, request, found.query));
    console.error('listen: SOTA_SERVER_SECRET or SERE_SECRET is not set on the Worker');
    return withSiteHeaders(unavailable(request));
  }
  if (found.route.secret && typeof process !== 'undefined') {
    // api/listen.js reads process.env, as on Vercel.
    for (const k of SERE_SECRETS) if (!process.env[k]) process.env[k] = env[k];
  }
  return withSiteHeaders(await runNode(found.route.handler, request, found.query));
}

module.exports = { handle, match, runNode, ROUTES, SITE_HEADERS, SERE_HOST };
