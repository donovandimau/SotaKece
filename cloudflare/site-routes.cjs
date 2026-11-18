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
// /t/, /p/ and /i/ need nothing secret. /s/ needs SOTA_SERVICE_KEY and SERE_SECRET; while those are
// not set on the Worker, /s/ links are passed to the Vercel deployment that still has them, so a
// shared singing photo keeps working.
// Everything else goes to the static files, and /api/* never reaches this Worker (the
// dimau-api-forwarder Worker owns <host>/api/*).
const listen = require('../api/listen.js');
const share = require('../api/share.js');
const invite = require('../api/invite.js');
const vercel = require('../vercel.json');

const SERE_HOST = 'sere.sotakece.com';
// Vercel origin that still runs the functions (the same one dimau-api-forwarder uses).
const VERCEL_ORIGIN = 'https://sotakece-donovandimau-3468s-projects.vercel.app';

// The same patterns as vercel.json "routes".
const ROUTES = [
  { re: /^\/s\/([0-9a-fA-F-]{36})\/([0-9a-f]{32})\/?$/, handler: listen, query: (m) => ({ sere: m[1], k: m[2] }), secret: true },
  { re: /^\/t\/([a-z0-9-]{1,80})\/?$/, handler: listen, query: (m) => ({ track: m[1] }) },
  { re: /^\/p\/([0-9]{1,18})\/([a-fA-F0-9]{32})\/?$/, handler: share, query: (m) => ({ post: m[1], t: m[2] }) },
  { re: /^\/i\/([a-fA-F0-9]{32})\/?$/, handler: invite, query: (m) => ({ t: m[1] }) },
];
const SERE_SECRETS = ['SOTA_SERVICE_KEY', 'SERE_SECRET'];

// Vercel put these on every answer (first entry of vercel.json "routes"); the static files get them
// from dist/_headers, the pages made here get them from this list.
const SITE_HEADERS = Object.entries((vercel.routes || []).find((r) => r.src === '/(.*)' && r.headers && r.continue)?.headers || {});

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
    // No sere secrets on the Worker yet: ask the Vercel deployment, which has them.
    if (request.method !== 'GET' && request.method !== 'HEAD') return withSiteHeaders(await runNode(listen, request, found.query));
    try {
      const upstream = await fetcher(VERCEL_ORIGIN + url.pathname, {
        method: request.method,
        headers: { accept: request.headers.get('accept') || 'text/html', 'x-forwarded-host': url.host },
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      return withSiteHeaders(upstream);
    } catch (err) {
      console.error('listen forward', err && err.message);
      return withSiteHeaders(unavailable(request));
    }
  }
  if (found.route.secret && typeof process !== 'undefined') {
    // api/listen.js reads process.env, as on Vercel.
    for (const k of SERE_SECRETS) if (!process.env[k]) process.env[k] = env[k];
  }
  return withSiteHeaders(await runNode(found.route.handler, request, found.query));
}

module.exports = { handle, match, runNode, ROUTES, SITE_HEADERS, SERE_HOST, VERCEL_ORIGIN };
