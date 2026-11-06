'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../sota-plus.js'), 'utf8'), context);
const render = count => context.window.SotaPlus.bar('moment', 1, null, count, '');

test('comment counts cannot inject markup into the social bar', () => {
  for (const value of ['<img src=x onerror=alert(1)>', '2<script>alert(1)</script>', '&lt;img src=x&gt;']) {
    const markup = render(value);
    assert.match(markup, /data-sp="comments">💬 Reply<\/button>/);
    assert.doesNotMatch(markup, /<img|<script|onerror|&lt;/);
  }
});

test('social bars preserve integer counts and the empty reply label', () => {
  for (const value of [12, '12']) assert.match(render(value), /data-sp="comments">💬 12<\/button>/);
  for (const value of [0, '0', '', null, undefined, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.match(render(value), /data-sp="comments">💬 Reply<\/button>/);
  }
});
