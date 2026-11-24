'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const media = require('../native-call-media.js');

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
function track(kind, id = kind) {
  const listeners = new Map();
  return {
    kind, id, enabled: true, readyState: 'live', stopped: 0,
    stop() { this.stopped++; this.readyState = 'ended'; },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
    end() { this.readyState = 'ended'; listeners.get('ended')?.(); }
  };
}
class Stream {
  constructor(tracks = []) { this.tracks = tracks.slice(); }
  getTracks() { return this.tracks.slice(); }
  addTrack(t) { if (!this.tracks.includes(t)) this.tracks.push(t); }
  removeTrack(t) { this.tracks = this.tracks.filter(x => x !== t); }
}
class Connection {
  constructor(config) {
    this.config = config;
    this.signalingState = 'stable';
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.localDescription = null;
    this.remoteDescription = null;
    this.transceivers = [];
    this.addedIce = [];
    this.localDescriptions = [];
    this.remoteDescriptions = [];
    this.stats = new Map();
    this.restarts = 0;
    this.closed = 0;
  }
  addTransceiver(input, init) {
    const sender = {
      track: typeof input === 'string' ? null : input,
      parameters: { encodings: [{}], transactionId: 'a' },
      replaceCalls: [],
      async replaceTrack(t) { this.replaceCalls.push(t); this.track = t; },
      getParameters() { return structuredClone(this.parameters); },
      async setParameters(parameters) { this.parameters = parameters; }
    };
    const transceiver = { kind: typeof input === 'string' ? input : input.kind, sender, init };
    this.transceivers.push(transceiver);
    return transceiver;
  }
  async setLocalDescription(description) {
    if (this.localGate) await this.localGate.promise;
    if (this.signalingState === 'closed') throw new Error('closed');
    description ||= { type: this.signalingState === 'have-remote-offer' ? 'answer' : 'offer', sdp: 'v=0\r\na=ice-ufrag:local\r\n' };
    this.localDescriptions.push(description);
    if (description.type === 'rollback') { this.localDescription = null; this.signalingState = 'stable'; return; }
    this.localDescription = description;
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(description) {
    if (this.remoteGate) await this.remoteGate.promise;
    if (this.signalingState === 'closed') throw new Error('closed');
    if (description.type === 'answer') assert.equal(this.signalingState, 'have-local-offer');
    if (description.type === 'offer') assert.equal(this.signalingState, 'stable');
    this.remoteDescription = description;
    this.remoteDescriptions.push(description);
    this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
  async addIceCandidate(candidate) {
    assert.ok(this.remoteDescription, 'ICE must wait for remote SDP');
    this.addedIce.push(candidate);
  }
  restartIce() { this.restarts++; this.onnegotiationneeded?.(); }
  async createOffer(options) { this.offerOptions = options; return { type: 'offer', sdp: 'restart' }; }
  async getStats() { if (this.statsGate) await this.statsGate.promise; return this.stats; }
  getConfiguration() { return structuredClone(this.config); }
  setConfiguration(config) { if (this.rejectConfiguration?.(config)) throw new Error('configuration rejected'); this.config = structuredClone(config); }
  close() { this.closed++; this.signalingState = this.connectionState = this.iceConnectionState = 'closed'; }
}
function harness(extra = {}) {
  const pcs = [], signals = [], errors = [], states = [], remoteStreams = [];
  const audio = track('audio'), video = track('video');
  const localStream = new Stream(extra.audioOnly ? [audio] : [audio, video]);
  const api = media.create({
    localId: extra.localId || 'a', localStream, iceServers: [{ urls: 'stun:example.invalid' }],
    peerConnectionFactory: config => { const pc = new Connection(config); pcs.push(pc); return pc; },
    mediaStreamFactory: () => new Stream(),
    sendSignal: async (id, signal) => { signals.push({ id, ...signal }); },
    onError: (error, detail) => errors.push({ error, detail }),
    onPeerState: (id, state, detail) => states.push({ id, state, ...detail }),
    onRemoteStream: (id, stream) => remoteStreams.push({ id, stream }),
    statsIntervalMs: 0,
    ...extra
  });
  return { api, pcs, signals, errors, states, remoteStreams, audio, video, localStream };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('A queued ontrack callback after peer removal stops its late track',()=>{
  const h=harness();h.api.addPeer('b');const ontrack=h.pcs[0].ontrack;
  h.api.removePeer('b');const late=track('video','late-after-remove');
  ontrack({track:late});assert.equal(late.stopped,1);assert.equal(h.remoteStreams.length,0);
  h.api.close();
});
const offer = { type: 'description', payload: { type: 'offer', sdp: 'v=0\r\na=ice-ufrag:remote\r\n' } };
const candidate = { candidate: 'candidate:1 1 udp 1 192.0.2.1 1234 typ host', sdpMid: '0', usernameFragment: 'remote' };

test('audio-first calls reserve both media kinds and only the designated initiator offers initially', async t => {
  const caller = harness({ audioOnly: true });
  const callee = harness({ localId: 'b', audioOnly: true });
  t.after(() => { caller.api.close(); callee.api.close(); });
  const a = caller.api.addPeer('b', { initiator: true });
  const b = callee.api.addPeer('a', { initiator: false });
  assert.deepEqual(a.transceivers.map(x => x.kind), ['audio', 'video']);
  assert.equal(a.transceivers[1].sender.track, null);
  a.onnegotiationneeded(); b.onnegotiationneeded();
  await tick();
  assert.equal(caller.signals.length, 1);
  assert.equal(callee.signals.length, 0);
  await callee.api.handleSignal('a', { type: 'description', payload: caller.signals[0].payload });
  await tick();
  assert.equal(callee.signals[0].payload.type, 'answer');
  await caller.api.handleSignal('b', { type: 'description', payload: callee.signals[0].payload });
  assert.equal(a.signalingState, 'stable');
  assert.equal(b.signalingState, 'stable');
});

test('simultaneous offers converge: polite peer rolls back, impolite peer ignores the collision', async t => {
  const polite = harness({ localId: 'a' });
  const impolite = harness({ localId: 'z' });
  t.after(() => { polite.api.close(); impolite.api.close(); });
  const a = polite.api.addPeer('z', { initiator: true });
  const z = impolite.api.addPeer('a', { initiator: true });
  a.onnegotiationneeded(); z.onnegotiationneeded();
  await tick();
  const aOffer = { type: 'description', payload: { type: 'offer', sdp: 'v=0\r\na=ice-ufrag:a-offer\r\n' } };
  const zOffer = { type: 'description', payload: { type: 'offer', sdp: 'v=0\r\na=ice-ufrag:z-offer\r\n' } };
  assert.equal(await impolite.api.handleSignal('a', aOffer), false);
  assert.equal(await impolite.api.handleSignal('a', { type: 'ice', payload: { ...candidate, usernameFragment: 'a-offer' } }), false);
  await polite.api.handleSignal('z', zOffer);
  await tick();
  assert.ok(a.localDescriptions.some(x => x.type === 'rollback'));
  const answer = polite.signals.find(x => x.payload?.type === 'answer');
  await impolite.api.handleSignal('a', { type: 'description', payload: answer.payload });
  assert.equal(a.signalingState, 'stable');
  assert.equal(z.signalingState, 'stable');
  assert.equal(await impolite.api.handleSignal('a', { type: 'ice', payload: { ...candidate, usernameFragment: 'a-offer' } }), false);
  assert.equal(polite.errors.length + impolite.errors.length, 0);
});

test('ICE and end-of-candidates arriving before SDP are queued and flushed in order', async t => {
  const h = harness(); t.after(() => h.api.close());
  const pc = h.api.addPeer('b');
  await h.api.handleSignal('b', { type: 'ice', payload: candidate });
  await h.api.handleSignal('b', { type: 'ice', payload: null });
  assert.equal(pc.addedIce.length, 0);
  await h.api.handleSignal('b', offer);
  assert.deepEqual(pc.addedIce, [candidate, null]);
});

test('closing a peer during async offer generation prevents late signaling', async () => {
  const h = harness();
  const pc = h.api.addPeer('b', { initiator: true });
  pc.localGate = deferred();
  pc.onnegotiationneeded();
  await tick();
  h.api.removePeer('b');
  pc.localGate.resolve();
  await tick();
  assert.equal(h.signals.length, 0);
  assert.equal(h.errors.length, 0);
  h.api.close();
});

test('device and screen replacement reuses senders, preserves mute and does not stop caller tracks', async t => {
  const h = harness(); t.after(() => h.api.close());
  h.api.addPeer('b'); h.api.addPeer('c');
  h.api.setAudioEnabled(false);
  const newAudio = track('audio', 'headset');
  const screen = track('video', 'screen');
  await h.api.replaceAudioTrack(newAudio);
  await h.api.replaceVideoTrack(screen);
  assert.equal(newAudio.enabled, false);
  for (const pc of h.pcs) {
    assert.equal(pc.transceivers.length, 2);
    assert.equal(pc.transceivers[0].sender.track, newAudio);
    assert.equal(pc.transceivers[1].sender.track, screen);
  }
  assert.equal(h.audio.stopped, 0);
  assert.equal(h.video.stopped, 0);
  await h.api.replaceVideoTrack(null);
  assert.equal(h.pcs[0].transceivers[1].sender.track, null);
  await assert.rejects(h.api.replaceVideoTrack(track('audio')), /live video/);
  assert.equal(screen.stopped, 0);
});

test('close stops remote receivers, removes handlers and preserves local microphone and camera', () => {
  const h = harness();
  const pc = h.api.addPeer('b');
  const remote = track('audio', 'remote');
  const trackHandler = pc.ontrack;
  trackHandler({ track: remote, streams: [] });
  assert.deepEqual(h.remoteStreams[0].stream.getTracks(), [remote]);
  h.api.close(); h.api.close();
  assert.equal(remote.stopped, 1);
  assert.equal(h.audio.stopped, 0);
  assert.equal(h.video.stopped, 0);
  assert.equal(pc.closed, 1);
  assert.equal(pc.ontrack, null);
  const lateTrack = track('video', 'late');
  trackHandler({ track: lateTrack });
  assert.equal(lateTrack.stopped, 1);
});

test('member limit counts the local member and rejects unknown signaling peers', async t => {
  const h = harness(); t.after(() => h.api.close());
  assert.equal(media.maxMembers, 8);
  for (let i = 0; i < 7; i++) h.api.addPeer('member-' + i);
  assert.throws(() => h.api.addPeer('overflow'), /eight members/);
  assert.throws(() => h.api.addPeer('a'), /different member/);
  await assert.rejects(h.api.handleSignal('not-joined', offer), /authorized member/);
  assert.equal(h.api.addPeer('member-0'), h.pcs[0]);
});

test('connection recovery has a finite restart budget and leaves a clear rejoin state', async t => {
  const timers = new Map(); let timerId = 0;
  const h = harness({
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); }, maxRestarts: 2
  });
  t.after(() => h.api.close());
  const pc = h.api.addPeer('b', { initiator: true });
  pc.connectionState = pc.iceConnectionState = 'failed';
  pc.onconnectionstatechange();
  for (let i = 0; i < 2; i++) {
    assert.equal(timers.size, 1);
    const [id, fn] = timers.entries().next().value;
    timers.delete(id); fn(); await tick();
  }
  assert.equal(pc.restarts, 2);
  assert.equal(timers.size, 0);
  assert.ok(h.states.some(x => x.state === 'unreachable' && x.canRejoin));
  pc.onconnectionstatechange(); await tick();
  assert.equal(pc.restarts, 2);
});

test('a recovered connection cancels pending restart work', async () => {
  const timers = new Map(); let timerId = 0;
  const h = harness({ setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); } });
  const pc = h.api.addPeer('b');
  pc.connectionState = 'disconnected'; pc.onconnectionstatechange();
  assert.equal(timers.size, 1);
  pc.connectionState = pc.iceConnectionState = 'connected'; pc.onconnectionstatechange();
  assert.equal(timers.size, 0);
  h.api.close(); await tick();
});

test('staggered ICE/connection state events do not mistake a failed transport for recovery', () => {
  const timers = new Map(); let timerId = 0;
  const h = harness({ setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); } });
  const pc = h.api.addPeer('b');
  pc.connectionState = 'connected'; pc.iceConnectionState = 'failed';
  pc.oniceconnectionstatechange();
  assert.equal(timers.size, 1);
  h.api.close();
  assert.equal(timers.size, 0);
});

test('an existing waiting peer can be promoted to the initial offer role without a new connection', async t => {
  const h = harness(); t.after(() => h.api.close());
  const pc = h.api.addPeer('b');
  pc.onnegotiationneeded(); await tick();
  assert.equal(h.signals.length, 0);
  assert.equal(h.api.addPeer('b', { initiator: true }), pc);
  await tick();
  assert.equal(h.signals.length, 1);
  assert.equal(h.signals[0].payload.type, 'offer');
  assert.equal(h.pcs.length, 1);
});

test('low-data limits are applied per sender and shared across the mesh upload budget', async t => {
  const h = harness({ lowData: true }); t.after(() => h.api.close());
  for (let i = 0; i < 4; i++) h.api.addPeer('member-' + i);
  await tick();
  const senders = h.pcs[0].transceivers.map(x => x.sender);
  assert.equal(senders[0].parameters.encodings[0].maxBitrate, 24000);
  assert.equal(senders[1].parameters.encodings[0].maxBitrate, 150000);
  assert.equal(senders[1].parameters.encodings[0].maxFramerate, 15);
  h.api.setLowDataMode(false); await tick();
  assert.equal(senders[0].parameters.encodings[0].maxBitrate, 48000);
  assert.equal(senders[1].parameters.encodings[0].maxBitrate, 450000);
});

test('diagnostics calculate bitrate and expose relay/latency/loss without candidate addresses', async t => {
  let time = 1000;
  const h = harness({ now: () => time }); t.after(() => h.api.close());
  const pc = h.api.addPeer('b');
  function stats(inbound, outbound) {
    return new Map([
      ['in', { id: 'in', type: 'inbound-rtp', bytesReceived: inbound, packetsReceived: 90, packetsLost: 10, audioLevel: 0.2 }],
      ['out', { id: 'out', type: 'outbound-rtp', bytesSent: outbound, framesPerSecond: 15 }],
      ['pair', { id: 'pair', type: 'candidate-pair', state: 'succeeded', nominated: true, localCandidateId: 'local', remoteCandidateId: 'remote', currentRoundTripTime: 0.125 }],
      ['local', { id: 'local', type: 'local-candidate', candidateType: 'relay', address: 'secret-address' }],
      ['remote', { id: 'remote', type: 'remote-candidate', candidateType: 'host', address: 'other-address' }]
    ]);
  }
  pc.stats = stats(1000, 2000);
  const [first] = await h.api.getStats();
  assert.equal(first.sentBps, null);
  time += 2000; pc.stats = stats(3000, 6000);
  const [second] = await h.api.getStats();
  assert.equal(second.receivedBps, 8000);
  assert.equal(second.sentBps, 16000);
  assert.equal(second.roundTripMs, 125);
  assert.equal(second.packetLossPercent, 10);
  assert.equal(second.relay, true);
  assert.equal(JSON.stringify(second).includes('address'), false);
});

test('a pending diagnostics result cannot resurrect a closed peer', async () => {
  const h = harness();
  const pc = h.api.addPeer('b');
  pc.statsGate = deferred();
  const pending = h.api.getStats();
  h.api.close(); pc.statsGate.resolve();
  assert.deepEqual(await pending, []);
});

test('signaling errors are reported and later ICE delivery remains usable', async t => {
  let sends = 0;
  const h = harness({ sendSignal: async () => { if (++sends === 1) throw new Error('offline'); } });
  t.after(() => h.api.close());
  const pc = h.api.addPeer('b', { initiator: true });
  pc.onnegotiationneeded(); await tick();
  pc.onicecandidate({ candidate }); await tick();
  assert.equal(sends, 2);
  assert.equal(h.errors[0].detail.operation, 'sendSignal');
  assert.match(h.errors[0].error.message, /offline/);
});

test('bounded ICE queues and signal validation prevent unbounded work', async t => {
  const h = harness(); t.after(() => h.api.close()); h.api.addPeer('b');
  for (let i = 0; i < 256; i++) await h.api.handleSignal('b', { type: 'ice', payload: candidate });
  await assert.rejects(h.api.handleSignal('b', { type: 'ice', payload: candidate }), /Too many pending/);
  await assert.rejects(h.api.handleSignal('b', { type: 'description', payload: { type: 'offer', sdp: 'x'.repeat(98305) } }), /Invalid call description/);
  await assert.rejects(h.api.handleSignal('b', { type: 'ice', payload: {} }), /Invalid ICE/);
});

test('ICE credential refresh updates current and future peers without restarting by default', async t => {
  const h = harness(); t.after(() => h.api.close()); const first = h.api.addPeer('b');
  const next = [{ urls: ['turns:relay.example.invalid:443?transport=tcp'], username: 'short-lived-user', credential: 'short-lived-password' }];
  await h.api.updateIceServers(next, { restart: false });
  assert.deepEqual(first.config.iceServers, next);
  assert.equal(first.config.bundlePolicy, 'max-bundle'); assert.equal(first.restarts, 0);
  next[0].urls[0] = 'stun:changed.invalid'; next[0].credential = 'changed';
  const later = h.api.addPeer('c');
  assert.equal(later.config.iceServers[0].credential, 'short-lived-password');
  assert.equal(first.config.iceServers[0].credential, 'short-lived-password');
  await assert.rejects(h.api.updateIceServers(null), /bounded array/);
  await assert.rejects(h.api.updateIceServers([{ urls: 'https://relay.invalid' }]), /URLs/);
  await assert.rejects(h.api.updateIceServers([{ urls: 'turn:relay.invalid' }]), /credentials/);
});

test('a rejected credential refresh rolls back current peers and the future configuration', async t => {
  const h = harness(); t.after(() => h.api.close()); const first = h.api.addPeer('b'), second = h.api.addPeer('c');
  const previous = structuredClone(first.config);
  second.rejectConfiguration = config => config.iceServers[0].urls === 'stun:new.invalid';
  await assert.rejects(h.api.updateIceServers([{ urls: 'stun:new.invalid' }]), /configuration rejected/);
  assert.deepEqual(first.config, previous);
  assert.deepEqual(h.api.addPeer('d').config, previous);
});

test('explicit ICE refresh restarts share the finite recovery budget', async t => {
  const h = harness({ maxRestarts: 2 }); t.after(() => h.api.close()); const pc = h.api.addPeer('b', { initiator: true });
  await h.api.updateIceServers([{ urls: 'stun:new.invalid' }], { restart: true });
  await h.api.updateIceServers([{ urls: 'stun:next.invalid' }], { restart: true });
  await h.api.updateIceServers([{ urls: 'stun:final.invalid' }], { restart: true });
  assert.equal(pc.restarts, 2);
  h.api.close(); assert.equal(await h.api.updateIceServers([]), false);
});

const h0 = [];
test('Captions travel over a negotiated data channel to every other member, and only that', () => {
  const sent = [], heard = [];
  const channel = { readyState: 'open', send(m) { sent.push(m); }, close() { this.closed = true; } };
  const h = harness({
    onCaption: (id, text, final) => heard.push({ id, text, final }),
    peerConnectionFactory: config => { const pc = new Connection(config); pc.createDataChannel = (label, opts) => { pc.channelOpts = { label, ...opts }; return channel; }; h0.push(pc); return pc; }
  });
  h.api.addPeer('b');
  const pc = h0[0];
  assert.deepEqual(pc.channelOpts, { label: 'captions', negotiated: true, id: 1, ordered: true });
  h.api.sendCaption('bula vinaka', true);
  assert.deepEqual(JSON.parse(sent[0]), { t: 'cap', text: 'bula vinaka', final: true });
  channel.onmessage({ data: JSON.stringify({ t: 'cap', text: 'moce', final: false }) });
  channel.onmessage({ data: 'not json' });
  channel.onmessage({ data: JSON.stringify({ t: 'other', text: 'x' }) });
  assert.deepEqual(heard, [{ id: 'b', text: 'moce', final: false }]);
  h.api.removePeer('b');
  assert.equal(channel.closed, true);
  h.api.sendCaption('after', true);
  assert.equal(sent.length, 1);
  h.api.close();
});
