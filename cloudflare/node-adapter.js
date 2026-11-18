// Runs a Vercel-style Node handler, handler(req, res), inside a Cloudflare Worker.
// The handlers in api/ were written for Vercel: req.query, req.body (JSON already parsed),
// req.headers as a plain object; res.status().json(), res.setHeader(), res.end(), res.redirect().
// This file gives them that shape from a web Request and turns what they write into a web Response,
// so the same code answers on Cloudflare without being rewritten.

const MAX_BODY = 4_500_000; // Vercel's own request body limit

/** Build the Node-style request object. Throws a Response for an over-size body. */
export async function nodeRequest(request, {query, path} = {}) {
  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((v, k) => { headers[k] = v; });
  headers.host = url.host;
  // Vercel set these; some handlers read them (country for analytics, client IP for limits).
  const country = request.headers.get('cf-ipcountry');
  if (country && !headers['x-vercel-ip-country']) headers['x-vercel-ip-country'] = country;
  const ip = request.headers.get('cf-connecting-ip');
  if (ip && !headers['x-forwarded-for']) headers['x-forwarded-for'] = ip;
  if (!headers['x-real-ip'] && ip) headers['x-real-ip'] = ip;

  let body;
  let raw = new Uint8Array(0);
  if (!['GET', 'HEAD'].includes(request.method)) {
    const declared = Number(request.headers.get('content-length'));
    if (declared > MAX_BODY) throw new Response(JSON.stringify({error: 'Request too large.'}), {status: 413, headers: {'content-type': 'application/json'}});
    raw = new Uint8Array(await request.arrayBuffer());
    if (raw.byteLength > MAX_BODY) throw new Response(JSON.stringify({error: 'Request too large.'}), {status: 413, headers: {'content-type': 'application/json'}});
    const text = new TextDecoder().decode(raw);
    const type = String(headers['content-type'] || '');
    // Vercel parses JSON and form bodies before the handler runs; an unparseable JSON body stays a string.
    if (type.startsWith('application/json')) { try { body = text ? JSON.parse(text) : undefined; } catch { body = text; } }
    else if (type.startsWith('application/x-www-form-urlencoded')) body = Object.fromEntries(new URLSearchParams(text));
    else body = text || undefined;
  }
  const q = query || Object.fromEntries(url.searchParams);
  const req = {
    method: request.method,
    url: (path || url.pathname) + url.search,
    headers,
    query: q,
    body,
    socket: {remoteAddress: ip || ''},
    // A few handlers read the body as a stream when req.body is empty.
    async *[Symbol.asyncIterator]() { if (raw.byteLength) yield Buffer.from(raw); },
  };
  return req;
}

/** Build the Node-style response object; finish() returns the web Response. */
export function nodeResponse() {
  const headers = new Headers();
  const listeners = {};
  let chunks = [];
  let stream = null;
  let ended = false;
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(k, v) { headers.set(k, Array.isArray(v) ? v.join(', ') : String(v)); return res; },
    getHeader(k) { return headers.get(k) ?? undefined; },
    removeHeader(k) { headers.delete(k); },
    hasHeader(k) { return headers.has(k); },
    status(code) { res.statusCode = code; return res; },
    json(data) { if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8'); return res.end(JSON.stringify(data)); },
    send(data) {
      if (data !== null && typeof data === 'object' && !(data instanceof Uint8Array) && !(data instanceof ArrayBuffer)) return res.json(data);
      if (typeof data === 'string' && !headers.has('content-type')) headers.set('content-type', 'text/html; charset=utf-8');
      return res.end(data);
    },
    redirect(a, b) { const [code, loc] = typeof a === 'number' ? [a, b] : [302, a]; res.statusCode = code; headers.set('location', loc); return res.end(); },
    write(chunk) { res.headersSent = true; if (chunk !== undefined) chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk); return true; },
    end(chunk) { if (ended) return res; if (chunk !== undefined && chunk !== null) res.write(chunk); ended = true; res.headersSent = true; return res; },
    destroy() { ended = true; res.statusCode = res.statusCode >= 400 ? res.statusCode : 502; chunks = []; stream = null; },
    on(ev, fn) { (listeners[ev] ||= []).push(fn); return res; },
    off(ev, fn) { listeners[ev] = (listeners[ev] || []).filter(f => f !== fn); return res; },
    once(ev, fn) { return res.on(ev, fn); },
    /** Worker-only: answer with a web ReadableStream (used for large downloads). */
    stream(body) { stream = body; ended = true; res.headersSent = true; return res; },
    finish(method) {
      const nobody = method === 'HEAD' || [204, 304].includes(res.statusCode);
      let body = null;
      if (!nobody) {
        if (stream) body = stream;
        else if (chunks.length) {
          const size = chunks.reduce((n, c) => n + c.byteLength, 0);
          const all = new Uint8Array(size); let at = 0;
          for (const c of chunks) { all.set(c instanceof Uint8Array ? c : new Uint8Array(c), at); at += c.byteLength; }
          body = all;
        }
      }
      return new Response(body, {status: res.statusCode, headers});
    },
  };
  return res;
}

/** Run handler(req, res) for a web Request and return a web Response. */
export async function runNode(handler, request, options) {
  let req;
  try { req = await nodeRequest(request, options); } catch (e) { if (e instanceof Response) return e; throw e; }
  const res = nodeResponse();
  try {
    await handler(req, res);
  } catch (err) {
    console.error('handler failed', err?.message);
    if (!res.headersSent) return new Response(JSON.stringify({error: 'Server error.'}), {status: 500, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
  }
  return res.finish(request.method);
}
