#!/usr/bin/env node
// Prepares the static output folder for the Cloudflare Worker (Workers Builds).
//
//   node scripts/cf-static-assets.mjs --out dist [--copy]
//
// --copy  copies the public site files from the repo root into --out first
//         (for sites with no build step). Dotfiles, .env*, node_modules, *.md,
//         tests, scripts, docs, api and config files are never copied.
//
// Then it turns vercel.json "headers" (and "routes" entries that carry
// headers) into <out>/_headers, and plain "redirects" / static "rewrites" into
// <out>/_redirects, so security headers such as CSP survive the move from
// Vercel. Vercel lets a later matching rule override an earlier one; the
// Cloudflare _headers file joins values instead, so every header that an
// earlier rule may already have set is detached ("! Name") and set again.
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

// Never published, whatever the site.
const SKIP_NAMES = new Set([
  'node_modules', 'api', 'scripts', 'tests', 'test', '__tests__', 'docs', 'supabase', 'backend',
  'tools', 'verify', 'handovers', 'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
  'vercel.json', 'netlify.toml', 'wrangler.jsonc', 'wrangler.toml', 'wrangler.json', 'tsconfig.json',
  'vite.config.js', 'vitest.config.ts', 'eslint.config.mjs', 'dist', 'Dockerfile', 'LICENSE',
  ...extraSkip,
]);
const SKIP_EXT = /\.(md|mdx|cjs|ts|tsx|py|sh|ps1|toml|lock|log|sql|yml|yaml|env)$/i;

function copyPublic(src, dest, rel = '') {
  for (const name of readdirSync(src)) {
    const relPath = rel ? `${rel}/${name}` : name;
    if (name.startsWith('.')) continue; // .env*, .git, .github, .vercel ...
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

const vercelPath = join(root, 'vercel.json');
const vercel = existsSync(vercelPath) ? JSON.parse(readFileSync(vercelPath, 'utf8')) : {};
const warnings = [];

// Convert a Vercel (path-to-regexp) source into one or more Cloudflare URL patterns.
function toPatterns(source) {
  if (!source || !source.startsWith('/')) return null;
  let s = source;
  // An optional group such as (index.html)? becomes two patterns.
  const opt = s.match(/\(([^()*?+|]+)\)\?/);
  if (opt) {
    const a = toPatterns(s.replace(opt[0], opt[1]));
    const b = toPatterns(s.replace(opt[0], ''));
    return a && b ? [...a, ...b] : null;
  }
  // Alternation groups such as (a|b) are expanded into separate patterns.
  const alt = s.match(/\(([^()*?+]*\|[^()*?+]*)\)/);
  if (alt) {
    const parts = alt[1].split('|').map((part) => toPatterns(s.replace(alt[0], part)));
    return parts.every(Boolean) ? parts.flat() : null;
  }
  // A character-class group such as ([a-f0-9]{16}) matches one path segment.
  let n = 0;
  s = s.replace(/\(\[[^\]/]+\](?:\{\d+(?:,\d*)?\}|\+)\)/g, () => `:seg${++n}`);
  s = s.replace(/\(\.\*\)/g, '*').replace(/\(\.\+\)/g, '*').replace(/:[A-Za-z_]\w*\*/g, '*');
  s = s.replace(/\\\./g, '.');
  if ((s.match(/\*/g) || []).length > 1) return null;
  if (/[()[\]?+|^$]/.test(s)) return null;
  return [s];
}

// ---- _headers ----
const rules = [];
for (const rule of vercel.headers || []) {
  if (rule.has || rule.missing) { warnings.push(`headers ${rule.source}: host/cookie condition, skipped`); continue; }
  const pats = toPatterns(rule.source);
  if (!pats) { warnings.push(`headers ${rule.source}: pattern not supported, skipped`); continue; }
  for (const p of pats) rules.push({ path: p, headers: rule.headers.map((h) => [h.key, h.value]) });
}
for (const route of vercel.routes || []) {
  if (route.dest || route.status) {
    warnings.push(`routes ${route.src} -> ${route.dest || route.status}${route.has ? ' (host condition)' : ''}: not carried over, needs a Worker`);
    continue;
  }
  if (!route.headers) continue;
  if (route.has || route.missing) { warnings.push(`routes ${route.src}: conditional headers skipped`); continue; }
  const pats = toPatterns(route.src);
  if (!pats) { warnings.push(`routes ${route.src}: pattern not supported, skipped`); continue; }
  for (const p of pats) rules.push({ path: p, headers: Object.entries(route.headers) });
}
// Vercel-only headers mean nothing on Cloudflare.
for (const r of rules) r.headers = r.headers.filter(([k]) => !/^vercel-|^x-vercel/i.test(k));

if (rules.length) {
  const seen = new Set();
  const blocks = rules.filter((r) => r.headers.length).map((r) => {
    const lines = [r.path];
    for (const [k, v] of r.headers) {
      const key = k.toLowerCase();
      if (seen.has(key)) lines.push(`  ! ${k}`);
      lines.push(`  ${k}: ${v}`);
    }
    for (const [k] of r.headers) seen.add(k.toLowerCase());
    return lines.join('\n');
  });
  if (blocks.length > 100) { console.error('cf-static-assets: more than 100 header rules'); process.exit(1); }
  const text = `# Generated from vercel.json by scripts/cf-static-assets.mjs. Do not edit.\n${blocks.join('\n\n')}\n`;
  for (const line of text.split('\n')) {
    if (line.length > 2000) { console.error(`cf-static-assets: header line over 2000 chars: ${line.slice(0, 80)}`); process.exit(1); }
  }
  writeFileSync(join(out, '_headers'), text);
}

// ---- _redirects ----
const toDest = (d) => d.replace(/\$1/g, ':splat').replace(/:([A-Za-z_]\w*)\*/g, ':splat');
const redirectLines = [];
for (const r of vercel.redirects || []) {
  if (r.has || r.missing) { warnings.push(`redirect ${r.source}: host/cookie condition, skipped`); continue; }
  const pats = toPatterns(r.source);
  if (!pats) { warnings.push(`redirect ${r.source}: pattern not supported, skipped`); continue; }
  // html_handling "auto-trailing-slash" already sends /page.html to /page and /index.html to /.
  if (r.source === `${r.destination.replace(/\/$/, '')}.html` || (r.source === '/index.html' && r.destination === '/')) continue;
  const code = r.statusCode || (r.permanent === false ? 307 : 308);
  for (const p of pats) redirectLines.push(`${p} ${toDest(r.destination)} ${code}`);
}
for (const r of vercel.rewrites || []) {
  if (/^\/api(\/|$)/.test(r.destination) || /^https?:/.test(r.destination)) {
    warnings.push(`rewrite ${r.source} -> ${r.destination}: needs a server, not served by static assets`);
    continue;
  }
  if (r.has || r.missing) { warnings.push(`rewrite ${r.source}: conditional, skipped`); continue; }
  // /page and /page/ already serve page.html under html_handling "auto-trailing-slash".
  if (r.destination === `${r.source.replace(/\/$/, '')}.html`) continue;
  const pats = toPatterns(r.source);
  if (!pats) { warnings.push(`rewrite ${r.source}: pattern not supported, skipped`); continue; }
  // Rewrite to the clean address: html_handling would answer /page.html with a redirect to /page.
  const dest = r.destination.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  for (const p of pats) {
    if (p === dest) continue;
    redirectLines.push(`${p} ${toDest(dest)} 200`);
  }
}
if (redirectLines.length) {
  writeFileSync(join(out, '_redirects'), `# Generated from vercel.json by scripts/cf-static-assets.mjs. Do not edit.\n${redirectLines.join('\n')}\n`);
}

for (const w of warnings) console.warn(`cf-static-assets: ${w}`);
console.log(`cf-static-assets: ${out} ready (${rules.length} header rules, ${redirectLines.length} redirects)`);
