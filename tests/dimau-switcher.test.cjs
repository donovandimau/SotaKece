'use strict';
// The Dimau app switcher (dimau-platform-standard/super-app/dimau-shell.js), added 21 Nov 2026 once Sota Kece
// moved onto the shared Dimau account. It opens from a header button, never floats, and offers no second
// sign-in: Sota Kece already signs people in on the shared project itself.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

test('dimau-shell.js is the unchanged master copy', () => {
  // Update together with a byte copy from dimau-platform-standard/super-app; never edit it here.
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'dimau-shell.js'))).digest('hex');
  assert.equal(sha, 'bd631bcae7b73126ea8bfff6d736ba2a7f350c33bdd1f4b7ccb6a0032dc54ef7');
});

test('the page loads the shell once, deferred, as Sota Kece, with no floating button and no second sign-in', () => {
  const html = read('index.html');
  const tags = html.match(/<script src="\/dimau-shell\.js[^>]*><\/script>/g) || [];
  assert.equal(tags.length, 1);
  assert.match(tags[0], /data-app="sota-kece"/);
  assert.match(tags[0], /data-launcher="none"/);
  assert.match(tags[0], / defer>/);
  assert.doesNotMatch(tags[0], /data-client-id/);
  const block = html.slice(html.lastIndexOf('<!-- js-later', html.indexOf(tags[0])), html.indexOf(tags[0]));
  assert.ok(!block.includes('-->'), 'the shell loads inside a js-later block, after first paint');
});

test('the header has a Dimau apps button in the live header and the first-paint copy', () => {
  for (const [file, text] of [['sota-experience.js', read('sota-experience.js')], ['index.html', read('index.html')]]) {
    assert.match(text, /class="sx-header-apps" data-dimau-shell-open(="")? aria-haspopup="dialog" aria-expanded="false" aria-label="Dimau apps"/, file);
  }
  assert.match(read('index.html'), /mw="[^"]* \.sx-header-apps /, 'the kept member header may contain it');
  assert.match(read('sota-premium-shell.css'), /\.sx-header-apps\{[^}]*width:44px!important/);
  // On narrow phones the header icon would squeeze the Sota Kece name, so it hides there and the menu item opens it.
  for (const [file, text] of [['sota-experience.js', read('sota-experience.js')], ['index.html', read('index.html')]]) {
    assert.match(text, /class="sx-menu-apps" data-dimau-shell-open(="")? aria-haspopup="dialog" aria-expanded="false">.*? Dimau apps<\/button>/, file);
  }
  assert.match(read('sota-premium-shell.css'), /@media \(max-width:420px\)\{[^{]*\.sx-header-apps\{display:none!important\}\}/);
  assert.match(read('index.html'), /mw="[^"]* \.sx-menu-apps /);
  assert.match(read('sota-premium-shell.js'), /\.sx-menu-apps[\s\S]*\[data-dimau-menu-toggle\][\s\S]*focus\(\)/, 'focus returns to the menu button');
});

test('the shell is cached for offline use with the rest of the shell', () => {
  assert.match(read('sw.js'), /'\/dimau-shell\.js'/);
});
