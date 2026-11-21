#!/usr/bin/env node
// Moves Sota Kece's own sign-in and data connection from dimau-core-sydney to the shared
// dimau-core-ireland project (where the one Dimau account lives) in one go.
//
// Sign-in and data share one Supabase connection, so they move together. The page, the /api/*
// Worker code, share links, the call room, Sere, the deletion page and the tests all name the
// Sydney project directly: its address, its public key, and the browser's saved sign-in name
// "sb-<ref>-auth-token". This script swaps all of them, so no file is left on Sydney.
//
// Several files already use Ireland on purpose (analytics beacon, payments, the shared music
// catalogue, hub map, Viti Pulse). Those are untouched, which is why there is no "--to sydney":
// to go back, revert the cutover commit.
//
//   node scripts/switch-backend.cjs --check      list every file that still names Sydney
//   node scripts/switch-backend.cjs --dry-run    show what the switch would change, write nothing
//   node scripts/switch-backend.cjs --switch     do it (only on cutover day: docs/CUTOVER-IRELAND.md)
//
// After --switch: node scripts/build-css.cjs, then the tests.
'use strict';
const fs = require('node:fs'), path = require('node:path'), {execFileSync} = require('node:child_process');

const FROM = {name: 'dimau-core-sydney', ref: 'aqfzpaczyodhugsgqvxi', key: 'sb_publishable_DvpX2PSuPtxE3IqWUlRZfQ_YP2qLZtF'};
const TO = {name: 'dimau-core-ireland', ref: 'xnxmumbvgtmlpenutlii', key: 'sb_publishable_WFJ3jKwImNhGdTdrS9W6mg_3CUSUYIM'};
// History and records keep the name they were written with; this script names both on purpose.
const KEEP = [/^supabase\/baseline\//, /^docs\//, /\.md$/i, /^scripts\/switch-backend\.cjs$/];

const root = path.resolve(__dirname, '..');

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], {cwd: root, encoding: 'utf8'}).split('\0').filter(Boolean)
    .filter((f) => !KEEP.some((re) => re.test(f)));
}

const namesSydney = (text) => text.includes(FROM.ref) || text.includes(FROM.key);

// Pure, so the test can check it on every file without writing anything.
function rewrite(text) {
  return text.split(FROM.ref).join(TO.ref).split(FROM.key).join(TO.key)
    .split(`"name": "${FROM.name}"`).join(`"name": "${TO.name}"`);
}

function sydneyFiles(read = (f) => fs.readFileSync(path.join(root, f), 'utf8')) {
  const out = [];
  for (const f of trackedFiles()) {
    let text;
    try { text = read(f); } catch { continue; }
    if (!text.includes('\0') && namesSydney(text)) out.push(f);
  }
  return out;
}

module.exports = {FROM, TO, KEEP, rewrite, namesSydney, sydneyFiles};

if (require.main === module) {
  const args = process.argv.slice(2), files = sydneyFiles();
  if (args.includes('--switch') || args.includes('--dry-run')) {
    const dry = !args.includes('--switch');
    if (!files.length) { console.log('Nothing names Sydney; already switched.'); process.exit(0); }
    for (const f of files) {
      const p = path.join(root, f);
      if (!dry) fs.writeFileSync(p, rewrite(fs.readFileSync(p, 'utf8')));
      console.log(`${dry ? 'would change' : 'changed'} ${f}`);
    }
    console.log(dry ? `${files.length} files would move to ${TO.name}.` : `Moved ${files.length} files to ${TO.name}. Next: node scripts/build-css.cjs, then the tests.`);
  } else {
    console.log(files.length ? `${files.length} files still name ${FROM.name}:` : `Nothing names ${FROM.name}.`);
    for (const f of files) console.log('  ' + f);
  }
}
