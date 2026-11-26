#!/usr/bin/env node
// Makes the published scripts run on older phones and browsers (Donovan: "go on the old-phone fix", 26 Nov 2026).
//
//   node scripts/legacy-js.mjs dist
//
// Visitors on browsers older than about 2020 (Chrome/Android WebView before 80, Safari before 13.1) got
// "Uncaught SyntaxError: Unexpected token ." and the whole site stopped: the code uses `?.` and `??`,
// which those browsers cannot read. This rewrites every .js/.mjs file in the OUTPUT folder (never the
// source files) into the older form with esbuild: same behaviour, nothing bundled, imports and exports
// left as they are. If esbuild cannot be fetched, or a file will not convert, that file is published
// unchanged and the build carries on.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const out = resolve(process.argv[2] || 'dist');
const TARGET = ['chrome67', 'safari14', 'firefox68', 'edge79'];
const VERSION = '0.24.0';

function loadEsbuild() {
  try { return createRequire(import.meta.url)('esbuild'); } catch (_e) { /* not installed here */ }
  const dir = join(tmpdir(), 'sotakece-esbuild-' + VERSION);
  try {
    if (!existsSync(join(dir, 'node_modules', 'esbuild'))) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.json'), '{"private":true}');
      execFileSync('npm', ['install', '--prefix', dir, '--no-audit', '--no-fund', '--loglevel=error', 'esbuild@' + VERSION], { stdio: 'inherit' });
    }
    return createRequire(join(dir, 'package.json'))('esbuild');
  } catch (e) { console.warn('legacy-js: esbuild unavailable, scripts left as they are:', e.message); return null; }
}

const esbuild = loadEsbuild();
if (esbuild) {
  let done = 0, failed = 0;
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name), st = statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (/\.html$/.test(name) && st.size < 5 * 1048576) { html(p); continue; }
      if (!/\.m?js$/.test(name) || st.size > 5 * 1048576) continue;
      const src = readFileSync(p, 'utf8');
      if (!/\?\.|\?\?/.test(src)) continue; // nothing to lower
      try {
        const r = esbuild.transformSync(src, { loader: 'js', target: TARGET, charset: 'utf8', legalComments: 'inline' });
        writeFileSync(p, r.code); done++;
      } catch (e) { failed++; console.warn('legacy-js: kept original', p.slice(out.length), '-', (e.errors && e.errors[0] && e.errors[0].text) || e.message); }
    }
  })(out);
  // Inline <script> blocks in the pages (index.html's app script is inline). JSON and other data blocks are left alone.
  function html(p) {
    const text = readFileSync(p, 'utf8'); let changed = false;
    const next = text.replace(/(<script\b(?![^>]*\bsrc=)([^>]*)>)([\s\S]*?)(<\/script>)/gi, (all, open, attrs, body, close) => {
      const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1];
      if (type && !/^(module|text\/javascript|application\/javascript|text\/x-sk-later)$/i.test(type)) return all;
      if (!/\?\.|\?\?/.test(body)) return all;
      try {
        let code = esbuild.transformSync(body, { loader: 'js', target: TARGET, charset: 'utf8', legalComments: 'inline', format: undefined }).code;
        if (/<\/script/i.test(code)) return all; // never let converted text close the tag early
        code = code.replace(/\n$/, ''); changed = true; done++; return open + code + close;
      } catch (e) { failed++; console.warn('legacy-js: kept inline script in', p.slice(out.length), '-', (e.errors && e.errors[0] && e.errors[0].text) || e.message); return all; }
    });
    if (changed) writeFileSync(p, next);
  }
  console.log(`legacy-js: ${done} scripts rewritten for older browsers${failed ? `, ${failed} kept as they were` : ''}`);
}
