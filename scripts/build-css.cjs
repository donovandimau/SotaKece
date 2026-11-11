#!/usr/bin/env node
// Builds the combined stylesheets index.html loads, so the page waits for two style files instead of 43,
// the critical CSS a phone guest's first screen needs, and the preload list for the scripts the page holds back.
//
// The source of truth stays in the separate .css files and in index.html. Each bundle is declared there as
//
//   <!-- css-bundle sota-styles-head
//   <link rel="stylesheet" href="/dimau-header-standard.css?v=...">
//   ...
//   --><style data-sk-critical="sota-styles-head" media="not all">...</style><script>SK.css("sota-styles-head","/sota-styles-head.css?v=<hash>")</script><noscript>...</noscript>
//
// The list inside the comment is the order the files are joined in (the same cascade order they had as
// separate <link>s). SK.css (the SK script at the top of <head>) writes the ordinary render-blocking <link> for
// everyone, except a guest on a phone opening Home: that visitor gets the <style> above switched on instead,
// the welcome is painted from it, and the bundle is linked once the welcome photo has loaded (then the <style>
// is removed, so the finished page has exactly the old cascade). The <style> holds every rule of the bundle
// that could match the first screen: a rule is kept when the classes, ids, attribute names and element names
// its selector needs (outside :not(), :is(), :has() and the like) all appear in the markup of <body> (the
// first-paint template included), plus the classes the first-paint script adds. Media blocks no phone can
// match (min-width above 760px, print) are dropped; @font-face, @keyframes and @layer order are kept.
//
// Scripts are listed the same way, in <!-- js-later ... --><script>SK.js()</script> blocks (and inline ones as
// <script type="text/x-sk-later">...</script><script>SK.run()</script>): SK writes them in place for everyone
// else, so they run exactly as before, and runs them in the same order after the welcome photo for that guest.
// The build keeps `var pre="..."` in the SK script in step with them, so other visitors preload them at once.
//
//   node scripts/build-css.cjs          writes /<name>.css and updates index.html (hash, critical CSS, preloads)
//   node scripts/build-css.cjs --check  exits 1 if a bundle, its hash, critical CSS or preload list is out of date
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
const BLOCK = /<!-- css-bundle ([a-z0-9-]+)\n([\s\S]*?)\n-->(<style data-sk-critical="([a-z0-9-]+)" media="not all">[\s\S]*?<\/style><script>SK\.css\("([a-z0-9-]+)","\/([a-z0-9-]+)\.css\?v=([a-z0-9]*)"\)<\/script><noscript><link rel="stylesheet" href="\/[a-z0-9-]+\.css\?v=[a-z0-9]*" data-css-bundle="[a-z0-9-]+"><\/noscript>)/g;
const LATER = /<!-- js-later\n([\s\S]*?)\n--><script>SK\.js\(\)<\/script>/g;
const PRE = /var pre="([^"]*)";/;
// Classes the first-paint script in <body> puts on <body> and #app before it copies the welcome in.
const FIRST_PAINT_CLASSES = ['sx-enabled', 'sx-guest', 'bv-welcome', 'sx-app'];
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

// Split CSS (already minified) into top-level items: { prelude, body } for blocks, { prelude, body: null } for statements.
function items(css) {
  const out = []; let i = 0; const n = css.length;
  const skipString = (j, q) => { j++; while (j < n && css[j] !== q) { if (css[j] === '\\') j++; j++; } return j + 1; };
  while (i < n) {
    let j = i, depth = 0;
    while (j < n) {
      const c = css[j];
      if (c === '"' || c === "'") { j = skipString(j, c); continue; }
      if (c === '(') depth++; else if (c === ')') depth--;
      else if (!depth && (c === '{' || c === ';')) break;
      j++;
    }
    const prelude = css.slice(i, j).trim();
    if (j >= n || css[j] === ';') { if (prelude) out.push({ prelude, body: null }); i = j + 1; continue; }
    let k = j + 1, d = 1;
    while (k < n && d) {
      const c = css[k];
      if (c === '"' || c === "'") { k = skipString(k, c); continue; }
      if (c === '{') d++; else if (c === '}') d--;
      k++;
    }
    out.push({ prelude, body: css.slice(j + 1, k - 1) }); i = k;
  }
  return out;
}

// Split a selector list on its top-level commas.
function selectors(list) {
  const out = []; let depth = 0, cur = '', quote = '';
  for (const c of list) {
    if (quote) { cur += c; if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
    if (c === ',' && !depth) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur); return out;
}

// What a selector needs to find on the page before it can match anything: '.class', '#id', '@attribute'
// and element names. Arguments of functional pseudo-classes (:not(), :is(), :where(), :has(), :nth-child())
// are skipped, so the answer never asks for more than the selector really needs.
function needs(sel) {
  let s = '';
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === '"' || c === "'") { let j = i + 1; while (j < sel.length && sel[j] !== c) { if (sel[j] === '\\') j++; j++; } i = j; continue; }
    if (c === '\\') { s += sel.slice(i, i + 2); i++; continue; }
    if (c === ':') {
      const m = /^::?[a-z-]+\(/i.exec(sel.slice(i));
      if (m) { let k = i + m[0].length, d = 1; while (k < sel.length && d) { if (sel[k] === '(') d++; else if (sel[k] === ')') d--; k++; } i = k - 1; s += ' '; continue; }
    }
    if (c === '[') { const k = sel.indexOf(']', i); const m = /^\[\s*(?:[\w-]*\|)?([\w-]+)/.exec(sel.slice(i, k + 1)); if (m) s += ' @' + m[1].toLowerCase() + ' '; i = k; continue; }
    s += c;
  }
  s = s.replace(/(?<!\\)::?[a-z-]+/gi, ' ');
  const out = [];
  for (const m of s.matchAll(/([.#])((?:\\.|[\w-])+)|@([\w-]+)|(^|[\s>+~])([a-z][\w-]*)/gi)) {
    if (m[1]) out.push(m[1] + m[2].replace(/\\(.)/g, '$1'));
    else if (m[3]) out.push('@' + m[3]);
    else out.push(m[5].toLowerCase());
  }
  return out;
}

// Start tags in a piece of HTML, read with a small tokenizer (no regular expressions over markup): comments are
// skipped, and so is the content of raw-text elements (script, style, noscript, textarea, title), so neither
// scripts nor <noscript> fallbacks count as page content. Element and attribute names come back lower case.
const RAW_TEXT = new Set(['script', 'style', 'noscript', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']);
function startTags(html) {
  const out = []; const n = html.length; const lower = html.toLowerCase(); let i = 0;
  const isSpace = c => c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f';
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) { const end = html.indexOf('-->', lt + 4); i = end < 0 ? n : end + 3; continue; }
    if (html[lt + 1] === '!' || html[lt + 1] === '?' || html[lt + 1] === '/') { const end = html.indexOf('>', lt + 1); i = end < 0 ? n : end + 1; continue; }
    if (!/[a-z]/i.test(html[lt + 1] || '')) { i = lt + 1; continue; }
    let j = lt + 1;
    while (j < n && !isSpace(html[j]) && html[j] !== '>' && html[j] !== '/') j++;
    const name = lower.slice(lt + 1, j), attrs = [];
    while (j < n && html[j] !== '>') {
      if (isSpace(html[j]) || html[j] === '/') { j++; continue; }
      let k = j; while (k < n && !isSpace(html[k]) && html[k] !== '=' && html[k] !== '>' && html[k] !== '/') k++;
      const attr = lower.slice(j, k); let value = ''; j = k;
      while (j < n && isSpace(html[j])) j++;
      if (html[j] === '=') {
        j++; while (j < n && isSpace(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") { const end = html.indexOf(q, j + 1); value = html.slice(j + 1, end < 0 ? n : end); j = end < 0 ? n : end + 1; }
        else { let k2 = j; while (k2 < n && !isSpace(html[k2]) && html[k2] !== '>') k2++; value = html.slice(j, k2); j = k2; }
      }
      if (attr) attrs.push([attr, value]);
    }
    out.push({ name, attrs });
    i = j + 1;
    if (RAW_TEXT.has(name)) { const close = lower.indexOf('</' + name, i); i = close < 0 ? n : close; }
  }
  return out;
}

// Everything the first screen of a phone guest can be made of: the elements, attributes, classes and ids in
// <body> (scripts and comments left out, the first-paint template included) and the classes its script adds.
function vocabulary(html) {
  const words = new Set(['html', 'head', 'body', '@lang', '@style', ...FIRST_PAINT_CLASSES.map(c => '.' + c)]);
  for (const tag of startTags(html.slice(html.toLowerCase().indexOf('<body')))) {
    words.add(tag.name);
    for (const [name, value] of tag.attrs) {
      words.add('@' + name);
      if (name === 'class') for (const c of value.split(/\s+/)) if (c) words.add('.' + c);
      if (name === 'id' && value) words.add('#' + value);
    }
  }
  return words;
}

// True unless every query in the @media list needs a screen wider than 760px, or print.
function phoneMedia(prelude) {
  return prelude.replace(/^@media\s*/i, '').split(',').some(q => {
    if (/^\s*(print|not\s+all)\b/i.test(q)) return false;
    const m = /min-width\s*:\s*([\d.]+)px/i.exec(q);
    return !(m && +m[1] > 760);
  });
}

// The rules of a bundle that could style a phone guest's first screen, in their original order.
function critical(css, words) {
  let out = '';
  for (const it of items(css)) {
    if (it.body === null) { if (/^@layer\b/i.test(it.prelude)) out += it.prelude + ';'; continue; }
    if (it.prelude[0] === '@') {
      const name = /^@([\w-]+)/.exec(it.prelude)[1].toLowerCase();
      if (name === 'media' && !phoneMedia(it.prelude)) continue;
      if (name === 'media' || name === 'supports' || name === 'layer' || name === 'container') {
        const inner = critical(it.body, words);
        if (inner) out += it.prelude + '{' + inner + '}';
        else if (name === 'layer' && /^@layer\s+[\w-]/i.test(it.prelude)) out += it.prelude + ';'; // keep the layer order
        continue;
      }
      if (name === 'page') continue;
      out += it.prelude + '{' + it.body + '}'; // @font-face, @keyframes, @property
      continue;
    }
    if (selectors(it.prelude).some(sel => needs(sel).every(w => w === '*' || words.has(w)))) out += it.prelude + '{' + it.body + '}';
  }
  return out;
}

function build() {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const words = vocabulary(html);
  const bundles = [];
  let next = html.replace(BLOCK, (whole, name, list, tail, critName, callName, file, version) => {
    if (name !== file || name !== critName || name !== callName) throw new Error('css-bundle ' + name + ': the bundle must be /' + name + '.css');
    const sources = list.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const m = SOURCE.exec(line);
      if (!m) throw new Error('css-bundle ' + name + ': not a plain stylesheet link: ' + line);
      return m[1];
    });
    const parts = sources.map(src => ({ src, css: minify(fs.readFileSync(path.join(root, src), 'utf8'), src) }));
    const body = parts.map(p => '/* ' + p.src + ' */\n' + p.css).join('\n') + '\n';
    const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 12);
    const crit = parts.map(p => critical(p.css, words)).join('');
    if (/<\/style/i.test(crit)) throw new Error('css-bundle ' + name + ': critical CSS may not contain "</style"');
    const href = '/' + name + '.css?v=' + hash;
    bundles.push({ name, sources, body, hash, version, href, critical: crit });
    return whole.slice(0, whole.length - tail.length) +
      '<style data-sk-critical="' + name + '" media="not all">' + crit + '</style><script>SK.css("' + name + '","' + href + '")</script>' +
      '<noscript><link rel="stylesheet" href="' + href + '" data-css-bundle="' + name + '"></noscript>';
  });
  if (!bundles.length) throw new Error('index.html declares no css-bundle blocks');
  // Same-origin scripts held in js-later blocks, in page order, and every bundle after the first: preloaded at
  // once by visitors who load the page the ordinary way, so nothing waits on the SK.css/SK.js writes.
  const scripts = [];
  for (const m of next.matchAll(LATER)) for (const tag of startTags(m[1])) {
    const src = tag.name === 'script' && (tag.attrs.find(a => a[0] === 'src') || [])[1];
    if (src && src[0] === '/' && src[1] !== '/') scripts.push(src);
  }
  const pre = [...bundles.slice(1).map(b => b.href), ...scripts].join(' ');
  if (!PRE.test(next)) throw new Error('index.html: the SK script has no var pre="..." list');
  next = next.replace(PRE, 'var pre="' + pre + '";');
  return { html, next, bundles, scripts };
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
  if (html !== next) stale.push('index.html (?v= hash, critical CSS or preload list)');
  if (check) {
    if (stale.length) { console.error('Out of date: ' + stale.join(', ') + '. Run: node scripts/build-css.cjs'); process.exit(1); }
    console.log('CSS bundles up to date: ' + bundles.map(b => b.name + ' (' + b.sources.length + ' files)').join(', '));
  } else {
    if (html !== next) fs.writeFileSync(htmlPath, next);
    for (const b of bundles) console.log(b.name + '.css: ' + b.sources.length + ' files, ' + Buffer.byteLength(b.body) + ' bytes, v=' + b.hash + '; critical ' + Buffer.byteLength(b.critical) + ' bytes');
  }
}

module.exports = { build, minify, critical, needs, vocabulary, startTags };
