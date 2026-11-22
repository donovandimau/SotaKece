// Writes <dir>/ops-build.json: the Cloudflare Workers Builds identity of this build.
// The Ops Room (Supabase job ops_verify_workers_live) reads it and only trusts it when
// Cloudflare's own GitHub check names the same commit. Run by `wrangler deploy` (build.command).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [dir, repository] = process.argv.slice(2);
if (!dir || !repository) throw Error('usage: ops-build-marker.mjs <assets dir> <owner/repo>');
const sha = process.env.WORKERS_CI_COMMIT_SHA || '', build = process.env.WORKERS_CI_BUILD_UUID || '';
const valid = process.env.WORKERS_CI === '1' && /^[a-f0-9]{40}$/.test(sha) &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(build);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'ops-build.json'), JSON.stringify({ schema: 1, repository, commit: valid ? sha : null, build_id: valid ? build : null }));
console.log('ops-build marker:', valid ? sha.slice(0, 7) : 'not a Workers Builds production build');
