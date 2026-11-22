#!/usr/bin/env node
// Prepares the static output folder for the Cloudflare Worker (Workers Builds).
//
//   node scripts/cf-static-assets.mjs --out dist [--copy]
//
// --copy  copies the public site files from the repo root into --out first
//         (for sites with no build step). Dotfiles, .env*, node_modules, *.md,
//         tests, scripts, docs, api, mobile (app-store shell), cloudflare (Worker code) and config files are
//         never copied.
//
// Then it copies cloudflare/_headers and cloudflare/_redirects into --out.
// Those two files are this site's security headers (CSP), cache rules and
// redirects on Cloudflare: edit them there. (Until 22 Nov 2026 they were made
// from vercel.json at build time; Vercel is retired and that file is gone.)
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const root = resolve(opt('--root', '.'));
const out = resolve(root, opt('--out', 'dist'));
const extraSkip = (opt('--skip', '') || '').split(',').filter(Boolean);
const ignoreFile = join(root, 'cloudflare', 'publish-ignore');
const listedSkip = existsSync(ignoreFile)
  ? readFileSync(ignoreFile, 'utf8').split(/\r?\n/).map((l) => l.trim().replace(/^\/+|\/+$/g, '')).filter((l) => l && !l.startsWith('#'))
  : [];

// Never published, whatever the site.
const SKIP_NAMES = new Set([
  'node_modules', 'api', 'scripts', 'tests', 'test', '__tests__', 'docs', 'supabase', 'backend',
  'tools', 'verify', 'handovers', 'cloudflare', 'mobile', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'netlify.toml', 'wrangler.jsonc', 'wrangler.toml', 'wrangler.json', 'tsconfig.json',
  'vite.config.js', 'vitest.config.ts', 'eslint.config.mjs', 'dist', 'Dockerfile', 'LICENSE',
  ...extraSkip, ...listedSkip,
]);
const SKIP_EXT = /\.(md|mdx|cjs|ts|tsx|py|sh|ps1|toml|lock|log|sql|yml|yaml|env)$/i;

function copyPublic(src, dest, rel = '') {
  for (const name of readdirSync(src)) {
    const relPath = rel ? `${rel}/${name}` : name;
    if (name.startsWith('.')) continue; // .env*, .git, .github ...
    if (SKIP_NAMES.has(name) || SKIP_NAMES.has(relPath)) continue;
    const from = join(src, name);
    if (from === out) continue; // never copy the output folder into itself
    const st = statSync(from);
    if (st.isDirectory()) {
      copyPublic(from, join(dest, name), relPath);
    } else if (!SKIP_EXT.test(name)) {
      mkdirSync(dest, { recursive: true });
      cpSync(from, join(dest, name));
    }
  }
}

if (flag('--copy')) {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  copyPublic(root, out);
}
if (!existsSync(out)) {
  console.error(`cf-static-assets: output folder ${out} does not exist (run the site build first)`);
  process.exit(1);
}

// Cloudflare Workers static assets are capped at 25 MiB per file. A bigger file would make
// `wrangler deploy` fail anyway; stop here with a clear list so the live version stays as it is
// until the file is made smaller or moved to storage. Nothing is ever dropped silently.
const MAX_BYTES = 25 * 1024 * 1024;
const oversize = [];
(function findOversize(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) findOversize(p);
    else if (st.size > MAX_BYTES) oversize.push(`${p.slice(out.length)} (${(st.size / 1048576).toFixed(1)} MiB)`);
  }
})(out);
if (oversize.length) {
  console.error(`cf-static-assets: these files are over Cloudflare's 25 MiB asset limit; make them smaller or host them elsewhere:\n  ${oversize.join('\n  ')}`);
  process.exit(1);
}

// Cloudflare limits: 100 header rules, 2,000-character lines; 2,000 static + 100 dynamic redirects.
let headerRules = 0;
let redirects = 0;
for (const name of ['_headers', '_redirects']) {
  const src = join(root, 'cloudflare', name);
  if (!existsSync(src)) continue;
  const text = readFileSync(src, 'utf8');
  for (const line of text.split('\n')) {
    if (line.length > 2000) { console.error(`cf-static-assets: ${name} line over 2000 chars: ${line.slice(0, 80)}`); process.exit(1); }
  }
  const rules = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (name === '_headers') headerRules = rules.filter((l) => !/^\s/.test(l)).length;
  else redirects = rules.length;
  if (headerRules > 100) { console.error('cf-static-assets: more than 100 header rules'); process.exit(1); }
  cpSync(src, join(out, name));
}
console.log(`cf-static-assets: ${out} ready (${headerRules} header rules, ${redirects} redirects)`);

// Ops Room live check: write dist/ops-build.json (see scripts/ops-build-marker.mjs).
import { execFileSync as opsMarkerRun } from 'node:child_process';
import { fileURLToPath } from 'node:url';
opsMarkerRun(process.execPath, [fileURLToPath(new URL('./ops-build-marker.mjs', import.meta.url)), out, 'donovandimau/SotaKece'], { stdio: 'inherit' });
