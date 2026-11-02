'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../sota-wellbeing.js');
const DAY = 864e5, now = Date.parse('2026-11-02T12:00:00Z');

test('new since last visit counts only newer moments; first visit shows none', () => {
  const m = [{ id: 30 }, { id: 29 }, { id: 25 }, { id: 20 }];
  assert.deepEqual(W.newSince(m, 25), { count: 2, newest: 30 });
  assert.equal(W.newSince(m, null).count, 0);
  assert.equal(W.newSince([], 25).newest, 25);
});

test('say bula: friends not visited in three weeks, oldest first, snoozed ones skipped', () => {
  const friends = [{ handle: 'ana' }, { handle: 'bo' }, { handle: 'cy' }, { handle: 'di' }];
  const visits = { ana: now - 2 * DAY, bo: now - 30 * DAY, cy: now - 60 * DAY };
  const r = W.reachOut(friends, visits, { di: now - 3 * DAY }, now);
  assert.deepEqual(r.map((x) => x.handle), ['cy', 'bo']);
  assert.equal(r[0].days, 60);
  assert.deepEqual(W.reachOut(friends, visits, {}, now).map((x) => x.handle), ['di', 'cy']); // never visited first
});

test('break note after 25 minutes, at most once a day', () => {
  assert.equal(W.breakDue(now - 10 * 60e3, null, now), false);
  assert.equal(W.breakDue(now - 26 * 60e3, null, now), true);
  assert.equal(W.breakDue(now - 26 * 60e3, '2026-11-02', now), false);
});
