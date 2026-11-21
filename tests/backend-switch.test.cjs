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

// Every file that talks to Sota Kece's own project. A new file that names Sydney fails this test, so
// whoever adds it also decides that it moves with the rest. At the cutover this list becomes [].
const EXPECTED = [
  'api/_sota-server.js', 'api/account-delete.js', 'api/call-config.js', 'api/invite.js', 'api/sere.js',
  'api/share.js', 'call-room.js', 'communications.js', 'data-deletion.html', 'index.html', 'link.html',
  'migrations-check.json', 'motion-editor.js', 'native-call-stage.js', 'revised/backend.mjs',
  'sere/index.html', 'tests/first-paint.test.cjs', 'tests/invites.test.cjs', 'tests/sere.test.cjs',
  'tests/share-engine.test.cjs', 'tests/site-worker.test.cjs', 'tests/viti-pulse.test.cjs',
];

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
