// Cloudflare Worker entry for sotakece.com, www.sotakece.com and sere.sotakece.com.
// Static files are served from dist/ (the ASSETS binding). The Worker runs first only for the paths
// in wrangler.jsonc "run_worker_first":
//   - /api/*: the same eight api/*.js handlers Vercel ran, through cloudflare/node-adapter.js, so the
//     API no longer needs Vercel. (While dimau-api-forwarder still has routes for <host>/api/*, those
//     routes win and this code is not reached for /api/*; remove them once the secrets below are set.)
//   - the share links /s/, /t/, /p/, /i/ and the home page "/" (so sere.sotakece.com/ can open the
//     Sere app). That routing lives in cloudflare/site-routes.cjs, where the tests can reach it.
//
// Secrets the API reads (set on this Worker with `wrangler secret put`, same values as Vercel):
//   SOTA_SERVICE_KEY, SERE_SECRET, REPLICATE_API_TOKEN   (sere, sere-callback, account-delete)
//   optional: CF_TURN_KEY_ID, CF_TURN_API_TOKEN, CALLS_TURN_URLS, CALLS_TURN_SECRET (call relay)
// With nodejs_compat and this compatibility date, Worker secrets also appear in process.env, which is
// where the handlers read them, as on Vercel.
import routes from './site-routes.cjs';
import {runNode} from './node-adapter.js';
import accountDelete from '../api/account-delete.js';
import callConfig from '../api/call-config.js';
import guestCallConfig from '../api/guest-call-config.js';
import invite from '../api/invite.js';
import listen from '../api/listen.js';
import sereCallback from '../api/sere-callback.js';
import sere from '../api/sere.js';
import share from '../api/share.js';

export const API = {
  '/api/account-delete': accountDelete,
  '/api/call-config': callConfig,
  '/api/guest-call-config': guestCallConfig,
  '/api/invite': invite,
  '/api/listen': listen,
  '/api/sere-callback': sereCallback,
  '/api/sere': sere,
  '/api/share': share,
};

const notFound = () => new Response(JSON.stringify({error: 'Not found.'}), {status: 404, headers: {
  'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});

export default {
  fetch(request, env) {
    const {pathname} = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      const handler = API[pathname.replace(/\/+$/, '')];
      return handler ? runNode(handler, request) : notFound();
    }
    return routes.handle(request, env);
  }
};
