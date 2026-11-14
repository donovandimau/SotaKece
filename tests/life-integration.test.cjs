'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A small event/element adapter exercises the real Connections lifecycle without
// depending on a browser or replacing its data-loading implementation.
class Element {
  constructor() { this.listeners = new Map(); this.children = new Map(); this.isConnected = true; this.text = ''; this.hidden = false; this.attrs = new Map(); this.markup = ''; }
  set innerHTML(value) {
    this.markup = value; this.children.clear(); this.text = '';
    for (const match of value.matchAll(/<\w+\b([^>]*)>/g)) {
      for (const attr of match[1].matchAll(/\b(data-[\w-]+)(?:="[^"]*")?/g)) {
        const child = new Element(); child.hidden = /\bhidden\b/.test(match[1]); this.children.set('[' + attr[1] + ']', child);
      }
    }
  }
  get innerHTML() { return this.markup; }
  querySelector(selector) { return this.children.get(selector) || null; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  // Like the DOM: setting textContent removes every child.
  get textContent() { return this.text; }
  set textContent(value) { this.text = String(value); this.markup = ''; this.children.clear(); }
  get listenerCount() { return [...this.listeners.values()].reduce((total, set) => total + set.size, 0); }
}

function fixture({ signedIn = true } = {}) {
  const host = new Element(), document = new Element(), window = new Element();
  document.hidden = false;
  const state = signedIn ? { user: { id: 'owner' }, me: { id: 'owner', handle: 'owner' } } : { user: null, me: null };
  const calls = [], maps = [], watches = [];
  let authChange, privacyDisposals = 0, authScreens = 0;
  const client = {
    auth: {
      getUser: async () => { calls.push('getUser'); return { data: { user: { id: 'owner' } } }; },
      onAuthStateChange(fn) { authChange = fn; return { data: { subscription: { unsubscribe() {} } } }; }
    },
    async rpc(name) {
      calls.push(name);
      assert.equal(name, 'bv_my_friends', 'inline life map must not discover Koro members');
      return { data: [{ id: 'ana', handle: 'ana', display_name: 'Ana' }, { id: 'owner', handle: 'owner' }] };
    },
    from() { throw Error('Known accepted friends need no profile or membership queries'); }
  };
  window.SotaLifeConnections = {
    mount(target, options) {
      const map = { target, options, updates: [], disposals: 0,
        updateFriends(friends) { this.updates.push(friends); target.textContent = friends.map(p => p.label).join(', '); },
        dispose() { this.disposals++; target.textContent = ''; }
      };
      target.textContent = options.owner ? 'Private device record' : 'Guest category map'; maps.push(map); return map;
    }
  };
  window.SotaCircles = { mountPersonalSettings() { return () => { privacyDisposals++; }; } };
  window.SotaFriendFeed = {
    watchFriends(options) { const feed = { options, stops: 0, refreshes: 0, stop() { this.stops++; }, refresh() { this.refreshes++; } }; watches.push(feed); return feed; }
  };
  const app = { querySelector: selector => selector === '#sota-connections [data-friend-graph]' ? host : null, contains: node => node === host };
  const sandbox = { module: { exports: {} }, window, document, navigator: { onLine: true }, location: { hash: '', pathname: '/', search: '' }, history: { replaceState() {} }, Date };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../connections.js'), 'utf8'), sandbox, { filename: 'connections.js' });
  const connections = sandbox.module.exports;
  connections.init({ client, state, app, auth() { authScreens++; }, go() {} });
  return { connections, host, document, window, state, client, calls, maps, watches, authChange: (...args) => authChange(...args),
    get privacyDisposals() { return privacyDisposals; }, get authScreens() { return authScreens; } };
}

test('guest gets an interactive life map without account or social data reads', () => {
  const f = fixture({ signedIn: false }); f.connections.mountEntry();
  assert.equal(f.maps.length, 1); assert.equal(f.maps[0].options.owner, ''); assert.equal(f.maps[0].options.friends.length, 0);
  assert.equal(f.maps[0].target.textContent, 'Guest category map'); assert.equal(f.watches.length, 0); assert.deepEqual(f.calls, []);
  assert.equal(f.host.querySelector('[data-friend-sign-in]').hidden, true);
  f.connections.stopEntry(); assert.equal(f.maps[0].disposals, 1); assert.equal(f.host.innerHTML, '');
});

test('owner feed validates identity and supplies accepted people, excluding self and groups', async () => {
  const f = fixture(); f.connections.mountEntry(); const feed = f.watches[0];
  const result = await feed.options.read();
  result.graph.nodes.push({ id: 'group:private', type: 'group', label: 'Private Koro' });
  feed.options.onData(result); feed.options.onStatus('current');
  assert.deepEqual(f.calls, ['getUser', 'bv_my_friends']);
  assert.equal(f.maps[0].options.owner, 'owner'); assert.equal(f.maps[0].updates.length, 1);
  assert.deepEqual(Array.from(f.maps[0].updates[0], p => p.id), ['person:ana']);
  assert.equal(f.maps[0].target.textContent, 'Ana');
  assert.match(f.host.querySelector('[data-friend-status]').textContent, /Accepted friends updated/);
  f.connections.stop();
});

test('stopping tears down feed, device map and listeners and rejects late read results', async () => {
  const f = fixture(); let release, began;
  const started = new Promise(resolve => { began = resolve; });
  f.client.rpc = () => new Promise(resolve => { release = resolve; began(); });
  f.connections.mountEntry(); const feed = f.watches[0], map = f.maps[0];
  const pending = feed.options.read(); await started;
  const controls = [...f.host.children.values()];
  assert(f.window.listenerCount > 0); assert(f.document.listenerCount > 0); assert.equal(feed.options.valid(), true);
  f.connections.stopEntry();
  assert.equal(feed.stops, 1); assert.equal(map.disposals, 1); assert.equal(f.privacyDisposals, 1);
  assert.equal(f.window.listenerCount, 0); assert.equal(f.document.listenerCount, 0);
  assert(controls.every(control => control.listenerCount === 0)); assert.equal(f.host.innerHTML, ''); assert.equal(feed.options.valid(), false);
  release({ data: [{ id: 'late', display_name: 'Late private record' }] });
  feed.options.onData(await pending); feed.options.onStatus('current');
  assert.equal(map.updates.length, 0); assert.equal(f.host.innerHTML, ''); assert.equal(map.target.textContent, '');
});

test('lost authentication immediately removes the visible owner map and offers sign in', () => {
  const f = fixture(); f.connections.mountEntry(); const feed = f.watches[0], map = f.maps[0];
  assert.equal(map.target.textContent, 'Private device record');
  feed.options.onStatus('auth-required');
  assert.equal(map.disposals, 1); assert.equal(map.target.textContent, ''); assert.equal(f.privacyDisposals, 1);
  assert.equal(f.host.querySelector('[data-friend-refresh]').hidden, true);
  assert.equal(f.host.querySelector('[data-friend-sign-in]').hidden, false);
  assert.match(f.host.querySelector('[data-friend-status]').textContent, /Sign in again/);
  f.connections.stop();
});

test('account replacement disposes the previous owner before returning to authentication', () => {
  const f = fixture(); f.connections.mountEntry(); const feed = f.watches[0];
  f.authChange('SIGNED_IN', { user: { id: 'different-owner' } });
  assert.equal(f.maps[0].disposals, 1); assert.equal(feed.stops, 1); assert.equal(feed.options.valid(), false);
  assert.equal(f.state.user, null); assert.equal(f.state.me, null); assert.equal(f.authScreens, 1); assert.equal(f.host.innerHTML, '');
});
