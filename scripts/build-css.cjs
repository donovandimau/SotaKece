#!/usr/bin/env node
// Builds the combined stylesheets index.html loads, so the page waits for two style files instead of 43.
//
// The source of truth stays in the separate .css files and in index.html. Each bundle is declared there as
//
//   <!-- css-bundle sota-styles-head
//   <link rel="stylesheet" href="/dimau-header-standard.css?v=...">
//   ...
//   --><link rel="stylesheet" href="/sota-styles-head.css?v=<hash>" data-css-bundle="sota-styles-head">
//
// The list inside the comment is the order the files are joined in (the same cascade order they had as
// separate <link>s). Edit a source file or the list, then run:
//
//   node scripts/build-css.cjs          writes /<name>.css and updates the ?v= hash in index.html
//   node scripts/build-css.cjs --check  exits 1 if a bundle or its hash is out of date (tests/css-bundle.test.cjs)
//
// Every file sits at the site root, as does every bundle, so relative url()s resolve the same. The only
// change made to the CSS is removing comments and collapsing white space outside strings; rules, their order,
// @layer/@media blocks and values are untouched.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const BLOCK = /<!-- css-bundle ([a-z0-9-]+)\n([\s\S]*?)\n-->(<link rel="stylesheet" href="\/([a-z0-9-]+)\.css\?v=([a-z0-9]*)" data-css-bundle="([a-z0-9-]+)">)/g;
const SOURCE = /^<link rel="stylesheet" href="\/([a-z0-9][a-z0-9.-]*\.css)\?v=[a-z0-9._-]+">$/i;

// Remove comments and squeeze white space, leaving strings and url(...) contents exactly as written.
function minify(css, file) {
  let out = '', i = 0, depth = 0, pendingSpace = false;
  const n = css.length;
  const push = s => {
    if (pendingSpace && out && !/[{};,\s]$/.test(out) && !/^[{};,]/.test(s)) out += ' ';
    pendingSpace = false; out += s;
  };
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end < 0) throw new Error(file + ': unclosed comment');
      // A comment separates tokens: keep an empty one where no white space stands in for it.
      const glued = i > 0 && !/\s/.test(css[i - 1]) && end + 2 < n && !/\s/.test(css[end + 2]);
      i = end + 2; if (glued) push('/**/'); continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && css[j] !== c) { if (css[j] === '\\') j++; if (css[j] === '\n') throw new Error(file + ': string broken by a new line'); j++; }
      if (j >= n) throw new Error(file + ': unclosed string');
      push(css.slice(i, j + 1)); i = j + 1; continue;
    }
    if ((c === 'u' || c === 'U') && /^url\(/i.test(css.slice(i, i + 4)) && !/[\w-]$/.test(out)) {
      // Unquoted url(...) may contain characters such as // or ; that must be kept verbatim.
      let j = i + 4; while (j < n && /\s/.test(css[j])) j++;
      if (css[j] !== '"' && css[j] !== "'") {
        const end = css.indexOf(')', j);
        if (end < 0) throw new Error(file + ': unclosed url(');
        push(css.slice(i, end + 1)); i = end + 1; continue;
      }
    }
    if (/\s/.test(c)) { pendingSpace = true; i++; continue; }
    if (c === '{') depth++;
    if (c === '}') { depth--; if (depth < 0) throw new Error(file + ': unbalanced }'); }
    if (c === '{' || c === '}' || c === ';' || c === ',') { pendingSpace = false; out = out.replace(/ $/, ''); out += c; i++; continue; }
    push(c); i++;
  }
  if (depth !== 0) throw new Error(file + ': unbalanced {');
  return out.trim();
}

function build() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const bundles = [];
  const next = html.replace(BLOCK, (whole, name, list, link, file, version, attr) => {
    if (name !== file || name !== attr) throw new Error('css-bundle ' + name + ': the bundle link must be /' + name + '.css');
    const sources = list.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const m = SOURCE.exec(line);
      if (!m) throw new Error('css-bundle ' + name + ': not a plain stylesheet link: ' + line);
      return m[1];
    });
    const body = sources.map(src => '/* ' + src + ' */\n' + minify(fs.readFileSync(path.join(root, src), 'utf8'), src)).join('\n') + '\n';
    const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12);
    bundles.push({ name, sources, body, hash, version });
    return whole.slice(0, whole.length - link.length) + '<link rel="stylesheet" href="/' + name + '.css?v=' + hash + '" data-css-bundle="' + name + '">';
  });
  if (!bundles.length) throw new Error('index.html declares no css-bundle blocks');
  return { html, next, bundles };
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const { html, next, bundles } = build();
  let stale = [];
  for (const b of bundles) {
    const out = path.join(root, b.name + '.css');
    const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    if (current !== b.body) stale.push(b.name + '.css');
    if (!check && current !== b.body) fs.writeFileSync(out, b.body);
  }
  if (html !== next) stale.push('index.html (?v= hash)');
  if (check) {
    if (stale.length) { console.error('Out of date: ' + stale.join(', ') + '. Run: node scripts/build-css.cjs'); process.exit(1); }
    console.log('CSS bundles up to date: ' + bundles.map(b => b.name + ' (' + b.sources.length + ' files)').join(', '));
  } else {
    if (html !== next) fs.writeFileSync(htmlPath, next);
    for (const b of bundles) console.log(b.name + '.css: ' + b.sources.length + ' files, ' + Buffer.byteLength(b.body) + ' bytes, v=' + b.hash);
  }
}

module.exports = { build, minify };
