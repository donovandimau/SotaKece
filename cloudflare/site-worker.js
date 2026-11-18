// Cloudflare Worker entry for sotakece.com, www.sotakece.com and sere.sotakece.com.
// Static files are served from dist/ (the ASSETS binding). The Worker runs first only for the paths
// in wrangler.jsonc "run_worker_first": the share links /s/, /t/, /p/, /i/ and the home page "/"
// (so sere.sotakece.com/ can open the Sere app). The routing lives in cloudflare/site-routes.cjs,
// where the tests can reach it.
import routes from './site-routes.cjs';

export default {
  fetch(request, env) {
    return routes.handle(request, env);
  }
};
