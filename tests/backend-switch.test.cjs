'use strict';
// Sota Kece's sign-in and data share one Supabase connection. Moving it to the shared Dimau project
// (scripts/switch-backend.cjs) must catch every file, or people would sign in to one project and read
// data from another. These tests keep the list of files honest and prove the switch leaves no Sydney
// reference behind.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {FROM, TO, rewrite, namesSydney, sydneyFiles} = require('../scripts/switch-backend.cjs');
const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Files that still name Sota Kece's old Sydney project. Empty since the cutover: nothing may go back to it.
const EXPECTED = []; // switched to dimau-core-ireland on 21 Nov 2026 (docs/CUTOVER-IRELAND.md)

test('the files that name Sota Kece\'s own project are exactly the known list', () => {
  assert.deepEqual(sydneyFiles().sort(), [...EXPECTED].sort());
});

test('the switch leaves no Sydney reference in any of them', () => {
  for (const f of EXPECTED) {
    const after = rewrite(read(f));
    assert.equal(namesSydney(after), false, f);
    assert.ok(after.includes(TO.ref) || after.includes(TO.key), f + ' should name Ireland after the switch');
  }
});

test('the page\'s address, key and saved sign-in name move together', () => {
  const after = rewrite(read('index.html'));
  assert.ok(after.includes(`const SB_URL = "https://${TO.ref}.supabase.co"`));
  assert.ok(after.includes(`const SB_KEY = "${TO.key}"`));
  assert.ok(after.includes(`sb-${TO.ref}-auth-token`));
});

test('the switch changes nothing but the project names', () => {
  for (const f of EXPECTED) {
    const before = read(f), after = rewrite(before);
    const strip = (t, p) => t.split(p.ref).join('REF').split(p.key).join('KEY').split(p.name).join('NAME');
    assert.equal(strip(after, TO), strip(before, FROM).split(TO.ref).join('REF').split(TO.key).join('KEY'), f);
  }
});

test('the migration check follows the database', () => {
  const cfg = JSON.parse(rewrite(read('migrations-check.json')));
  assert.equal(cfg.databases[0].name, TO.name);
  assert.equal(cfg.databases[0].url, `https://${TO.ref}.supabase.co`);
});

test('email sign-up confirmations come back to Sota Kece, not the shared project default page', () => {
  // Ireland's Site URL is account.dimau-fintech.com; without emailRedirectTo, new members would land there.
  assert.match(read('index.html'), /sb\.auth\.signUp\(\{[^}]*options:\{emailRedirectTo:location\.origin\+"\/"\}\}\)/);
});
