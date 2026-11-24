/* Dimau native calling media. Independent implementation of browser WebRTC APIs.
 * Signaling is supplied by the application and must authorize joined members.
 * References: https://www.w3.org/TR/webrtc/ and MDN perfect negotiation.
 * The caller owns local media; close() never stops a local microphone/camera.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DimauCallMedia = api;
}(typeof window === 'object' ? window : null, function () {
  'use strict';

  var MAX_REMOTE_PEERS = 7;
  var MAX_QUEUED_ICE = 256;

  function iceConfiguration(servers) {
    if (!Array.isArray(servers) || servers.length > 16) throw new TypeError('ICE servers must be a bounded array.');
    return servers.map(function (server) {
      if (!server || typeof server !== 'object') throw new TypeError('Invalid ICE server.');
      var urls = typeof server.urls === 'string' ? [server.urls] : server.urls;
      if (!Array.isArray(urls) || !urls.length || urls.length > 16 || urls.some(function (url) { return typeof url !== 'string' || url.length > 2048 || !/^(stun|stuns|turn|turns):[^\s]+$/i.test(url); })) throw new TypeError('Invalid ICE server URLs.');
      if (server.username !== undefined && (typeof server.username !== 'string' || server.username.length > 4096)) throw new TypeError('Invalid ICE username.');
      if (server.credential !== undefined && (typeof server.credential !== 'string' || server.credential.length > 4096)) throw new TypeError('Invalid ICE credentials.');
      if (urls.some(function (url) { return /^turns?:/i.test(url); }) && (typeof server.username !== 'string' || !server.username || typeof server.credential !== 'string' || !server.credential)) throw new TypeError('TURN servers require credentials.');
      var result = { urls: typeof server.urls === 'string' ? urls[0] : urls.slice() };
      if (server.username !== undefined) result.username = server.username;
      if (server.credential !== undefined) result.credential = server.credential;
      return result;
    });
  }

  function create(options) {
    options = options || {};
    if (typeof options.localId !== 'string' || !options.localId.trim()) throw new TypeError('A local member ID is required.');
    if (typeof options.sendSignal !== 'function') throw new TypeError('An authorized signaling transport is required.');
    var makeConnection = options.peerConnectionFactory || function (config) { return new RTCPeerConnection(config); };
    var makeStream = options.mediaStreamFactory || function () { return new MediaStream(); };
    var schedule = options.setTimeout || setTimeout;
    var unschedule = options.clearTimeout || clearTimeout;
    var repeat = options.setInterval || setInterval;
    var unrepeat = options.clearInterval || clearInterval;
    var now = options.now || Date.now;
    var maxRestarts = Math.min(3, Math.max(0, Number.isInteger(options.maxRestarts) ? options.maxRestarts : 3));
    var reconnectDelay = Math.max(1, options.reconnectDelayMs || 2500);
    var reconnectWait = Math.max(1, options.reconnectWaitMs || 6000);
    var peers = new Map();
    var iceServers = iceConfiguration(options.iceServers || []);
    var closed = false;
    var lowData = options.lowData === true;
    var enabled = { audio: true, video: true };
    var currentTracks = { audio: null, video: null };
    var localStream = options.localStream || makeStream();
    var localTracks = typeof localStream.getTracks === 'function' ? localStream.getTracks() : [];
    localTracks.forEach(function (track) {
      if (track && (track.kind === 'audio' || track.kind === 'video') && !currentTracks[track.kind]) currentTracks[track.kind] = track;
    });
    if (currentTracks.audio) enabled.audio = currentTracks.audio.enabled !== false;
    if (currentTracks.video) enabled.video = currentTracks.video.enabled !== false;

    function callback(name, args) {
      if (typeof options[name] !== 'function') return;
      try { options[name].apply(null, args); } catch (error) {
        if (name !== 'onError') report(error, null, name);
      }
    }
    function report(error, peer, operation) {
      callback('onError', [error instanceof Error ? error : new Error(String(error)), { peerId: peer ? peer.id : null, operation: operation }]);
    }
    function active(peer) {
      return !closed && !peer.closed && peers.get(peer.id) === peer && peer.pc.signalingState !== 'closed';
    }
    function state(peer, value, extra) {
      if (!active(peer)) return;
      callback('onPeerState', [peer.id, value, Object.assign({
        iceState: peer.pc.iceConnectionState,
        signalingState: peer.pc.signalingState,
        restarts: peer.restarts
      }, extra || {})]);
    }
    function enqueue(peer, operation, run) {
      var result = peer.queue.then(function () { return active(peer) ? run() : false; });
      peer.queue = result.catch(function (error) { if (active(peer)) report(error, peer, operation); });
      return result;
    }
    // Do not hold the negotiation queue while awaiting a network round trip.
    // An application may immediately deliver a reply inside sendSignal().
    function emit(peer, signal) {
      peer.outbound = peer.outbound.then(function () {
        if (active(peer)) return options.sendSignal(peer.id, signal);
      }).catch(function (error) { if (active(peer)) report(error, peer, 'sendSignal'); });
    }
    function ufrags(sdp) {
      var matches = String(sdp || '').matchAll(/^a=ice-ufrag:([^\r\n]+)$/gm);
      return new Set(Array.from(matches, function (match) { return match[1]; }));
    }
    function candidateIgnored(peer, candidate) {
      if (!candidate) return false;
      var fragment = candidate.usernameFragment;
      return Boolean(fragment && peer.ignoredUfrags.has(fragment) && !ufrags(peer.pc.remoteDescription && peer.pc.remoteDescription.sdp).has(fragment));
    }
    async function flushIce(peer) {
      while (active(peer) && peer.pc.remoteDescription && peer.pendingIce.length) {
        var candidate = peer.pendingIce.shift();
        if (!candidateIgnored(peer, candidate)) {
          try { await peer.pc.addIceCandidate(candidate); } catch (error) {
            if (active(peer) && !peer.ignoreOffer) throw error;
          }
        }
      }
    }
    async function applyQuality(peer) {
      if (!active(peer)) return;
      var videoLimit = Math.floor(Math.min(lowData ? 180000 : 800000, (lowData ? 600000 : 1800000) / Math.max(1, peers.size)));
      for (var kind of ['audio', 'video']) {
        var sender = peer.senders[kind];
        if (!sender || !sender.track || typeof sender.getParameters !== 'function' || typeof sender.setParameters !== 'function') continue;
        var parameters = sender.getParameters();
        // Browsers determine the encoding count. Changing it is not permitted.
        if (!parameters.encodings || !parameters.encodings.length) continue;
        parameters.encodings.forEach(function (encoding) {
          encoding.maxBitrate = kind === 'audio' ? (lowData ? 24000 : 48000) : videoLimit;
          if (kind === 'video') encoding.maxFramerate = lowData ? 15 : 24;
        });
        try { await sender.setParameters(parameters); } catch (error) {
          // Quality hints are optional; unsupported parameters must not kill a call.
          if (active(peer)) state(peer, peer.pc.connectionState || 'new', { qualityHintApplied: false });
        }
        if (!active(peer)) return;
      }
    }
    function updateAllQuality() {
      peers.forEach(function (peer) { enqueue(peer, 'quality', function () { return applyQuality(peer); }).catch(function () {}); });
    }
    async function negotiate(peer, restart) {
      if (!active(peer) || peer.pc.signalingState !== 'stable' || (!peer.allowOffer && !peer.pc.remoteDescription)) return false;
      peer.makingOffer = true;
      try {
        if (restart && typeof peer.pc.restartIce !== 'function') {
          var offer = await peer.pc.createOffer({ iceRestart: true });
          if (!active(peer)) return false;
          await peer.pc.setLocalDescription(offer);
        } else {
          await peer.pc.setLocalDescription();
        }
        if (!active(peer)) return false;
        var description = peer.pc.localDescription;
        emit(peer, { type: 'description', payload: { type: description.type, sdp: description.sdp } });
        return true;
      } finally { peer.makingOffer = false; }
    }
    function badConnection(peer) {
      return ['failed', 'disconnected'].includes(peer.pc.connectionState) || ['failed', 'disconnected'].includes(peer.pc.iceConnectionState);
    }
    function clearRestart(peer) {
      if (peer.restartTimer !== null) unschedule(peer.restartTimer);
      peer.restartTimer = null;
    }
    function scheduleRestart(peer, delay) {
      if (!active(peer) || peer.restartTimer !== null) return;
      if (peer.restarts >= maxRestarts) {
        if (!peer.exhausted) { peer.exhausted = true; state(peer, 'unreachable', { canRejoin: true }); }
        return;
      }
      peer.restartTimer = schedule(function () {
        peer.restartTimer = null;
        if (!active(peer) || !badConnection(peer)) return;
        enqueue(peer, 'restartIce', function () { return restartPeer(peer, false); }).catch(function () {});
      }, delay);
      if (peer.restartTimer && typeof peer.restartTimer.unref === 'function') peer.restartTimer.unref();
    }
    async function restartPeer(peer, force) {
      if (!active(peer) || (!force && !badConnection(peer))) return false;
      if (peer.restarts >= maxRestarts) {
        if (badConnection(peer)) scheduleRestart(peer, reconnectWait);
        return false;
      }
      peer.restarts += 1;
      state(peer, 'reconnecting');
      if (typeof peer.pc.restartIce === 'function') peer.pc.restartIce();
      else await negotiate(peer, true);
      if (active(peer) && badConnection(peer)) scheduleRestart(peer, reconnectWait);
      return true;
    }
    function onConnectionChange(peer) {
      if (!active(peer)) return;
      state(peer, peer.pc.connectionState || peer.pc.iceConnectionState || 'new');
      if (badConnection(peer)) scheduleRestart(peer, reconnectDelay);
      else if (peer.pc.connectionState === 'connected' || peer.pc.iceConnectionState === 'connected' || peer.pc.iceConnectionState === 'completed') {
        clearRestart(peer);
        enqueue(peer, 'quality', function () { return applyQuality(peer); }).catch(function () {});
      }
    }
    function addPeer(id, settings) {
      if (closed) throw new Error('This call has ended.');
      if (typeof id !== 'string' || !id.trim() || id.length > 128 || id === options.localId) throw new TypeError('A different member ID is required.');
      if (peers.has(id)) {
        var existing = peers.get(id);
        if (settings && settings.initiator && !existing.allowOffer) {
          existing.allowOffer = true;
          enqueue(existing, 'negotiate', function () { return negotiate(existing, false); }).catch(function () {});
        }
        return existing.pc;
      }
      if (peers.size >= MAX_REMOTE_PEERS) throw new RangeError('Calls support up to eight members.');
      var pc = makeConnection({ iceServers: iceConfiguration(iceServers), iceTransportPolicy: options.iceTransportPolicy === 'relay' ? 'relay' : 'all', bundlePolicy: 'max-bundle' });
      var peer = {
        id: id, pc: pc, polite: options.localId < id, allowOffer: Boolean(settings && settings.initiator),
        makingOffer: false, ignoreOffer: false, settingAnswer: false, ignoredUfrags: new Set(),
        pendingIce: [], remote: makeStream(), remoteTracks: new Set(), trackHandlers: [],
        senders: {}, queue: Promise.resolve(), outbound: Promise.resolve(), restartTimer: null,
        restarts: 0, exhausted: false, closed: false, counters: null
      };
      peers.set(id, peer);
      // Captions travel to the other members over the call's own peer connection (never through the server).
      // A negotiated channel needs no extra signalling: both sides open id 1.
      if (typeof pc.createDataChannel === 'function') {
        try {
          peer.captions = pc.createDataChannel('captions', { negotiated: true, id: 1, ordered: true });
          peer.captions.onmessage = function (event) {
            if (!active(peer)) return;
            var message; try { message = JSON.parse(event.data); } catch (_) { return; }
            if (message && message.t === 'cap' && typeof message.text === 'string') callback('onCaption', [id, message.text.slice(0, 500), Boolean(message.final)]);
          };
        } catch (_) { peer.captions = null; }
      }
      pc.onnegotiationneeded = function () { enqueue(peer, 'negotiate', function () { return negotiate(peer, false); }).catch(function () {}); };
      pc.onicecandidate = function (event) {
        if (!active(peer)) return;
        var candidate = event.candidate;
        emit(peer, { type: 'ice', payload: candidate ? (typeof candidate.toJSON === 'function' ? candidate.toJSON() : candidate) : null });
      };
      pc.onconnectionstatechange = function () { onConnectionChange(peer); };
      pc.oniceconnectionstatechange = function () { onConnectionChange(peer); };
      pc.ontrack = function (event) {
        var track = event.track;
        if (!active(peer)) { if (track && !Object.values(currentTracks).includes(track)) track.stop(); return; }
        if (!track || peer.remoteTracks.has(track)) return;
        peer.remoteTracks.add(track);
        peer.remote.addTrack(track);
        if (typeof track.addEventListener === 'function') {
          var ended = function () {
            if (!active(peer)) return;
            peer.remote.removeTrack(track);
            peer.remoteTracks.delete(track);
            callback('onRemoteStream', [id, peer.remote]);
          };
          track.addEventListener('ended', ended);
          peer.trackHandlers.push({ track: track, listener: ended });
        }
        callback('onRemoteStream', [id, peer.remote]);
      };
      try {
        ['audio', 'video'].forEach(function (kind) {
          var track = currentTracks[kind];
          var transceiver = pc.addTransceiver(track || kind, { direction: 'sendrecv', streams: [localStream] });
          peer.senders[kind] = transceiver.sender;
        });
      } catch (error) { removePeer(id); throw error; }
      updateAllQuality();
      state(peer, 'new');
      return pc;
    }
    async function handleSignal(id, message) {
      if (closed) return false;
      if (!message || !['description', 'ice'].includes(message.type)) throw new TypeError('Unsupported call signal.');
      var payload = message.payload;
      if (message.type === 'description' && (!payload || !['offer', 'answer'].includes(payload.type) || typeof payload.sdp !== 'string' || payload.sdp.length > 98304)) throw new TypeError('Invalid call description.');
      if (message.type === 'ice' && payload !== null && (typeof payload !== 'object' || typeof payload.candidate !== 'string' || payload.candidate.length > 8192)) throw new TypeError('Invalid ICE candidate.');
      if (!peers.has(id)) throw new Error('Add the authorized member before accepting their signals.');
      var peer = peers.get(id);
      return enqueue(peer, 'handleSignal', async function () {
        if (message.type === 'description') {
          var ready = !peer.makingOffer && (peer.pc.signalingState === 'stable' || peer.settingAnswer);
          var collision = payload.type === 'offer' && !ready;
          peer.ignoreOffer = !peer.polite && collision;
          if (peer.ignoreOffer) {
            ufrags(payload.sdp).forEach(function (fragment) { peer.ignoredUfrags.add(fragment); });
            return false;
          }
          if (collision && peer.pc.signalingState !== 'stable') {
            await peer.pc.setLocalDescription({ type: 'rollback' });
            if (!active(peer)) return false;
          }
          peer.settingAnswer = payload.type === 'answer';
          try { await peer.pc.setRemoteDescription({ type: payload.type, sdp: payload.sdp }); }
          finally { peer.settingAnswer = false; }
          if (!active(peer)) return false;
          peer.allowOffer = true;
          await flushIce(peer);
          if (!active(peer)) return false;
          if (payload.type === 'offer') {
            await peer.pc.setLocalDescription();
            if (!active(peer)) return false;
            var answer = peer.pc.localDescription;
            emit(peer, { type: 'description', payload: { type: answer.type, sdp: answer.sdp } });
          }
          await applyQuality(peer);
          return true;
        }
        if (peer.ignoreOffer || candidateIgnored(peer, payload)) return false;
        if (!peer.pc.remoteDescription) {
          if (peer.pendingIce.length >= MAX_QUEUED_ICE) throw new RangeError('Too many pending ICE candidates.');
          peer.pendingIce.push(payload);
          return true;
        }
        await peer.pc.addIceCandidate(payload);
        return true;
      });
    }
    async function replaceTrack(kind, track) {
      if (closed) return false;
      if (track !== null && (!track || track.kind !== kind || track.readyState === 'ended')) throw new TypeError('A live ' + kind + ' track is required.');
      currentTracks[kind] = track;
      if (track) track.enabled = enabled[kind];
      var operations = Array.from(peers.values(), function (peer) {
        return enqueue(peer, 'replaceTrack', async function () {
          await peer.senders[kind].replaceTrack(track);
          if (!active(peer)) return false;
          await applyQuality(peer);
          return true;
        });
      });
      await Promise.all(operations);
      return !closed;
    }
    function setEnabled(kind, value) {
      enabled[kind] = Boolean(value);
      if (currentTracks[kind]) currentTracks[kind].enabled = enabled[kind];
      return enabled[kind];
    }
    function removePeer(id) {
      var peer = peers.get(id);
      if (!peer) return false;
      peer.closed = true;
      peers.delete(id);
      clearRestart(peer);
      peer.pendingIce.length = 0;
      peer.pc.onnegotiationneeded = peer.pc.onicecandidate = peer.pc.ontrack = null;
      peer.pc.onconnectionstatechange = peer.pc.oniceconnectionstatechange = null;
      peer.trackHandlers.forEach(function (entry) { entry.track.removeEventListener('ended', entry.listener); });
      peer.remoteTracks.forEach(function (track) { if (!Object.values(currentTracks).includes(track)) track.stop(); });
      peer.remoteTracks.clear();
      if (peer.captions) { try { peer.captions.onmessage = null; peer.captions.close(); } catch (_) {} peer.captions = null; }
      peer.pc.close();
      callback('onPeerState', [id, 'closed', { restarts: peer.restarts }]);
      updateAllQuality();
      return true;
    }
    async function statsFor(peer) {
      if (!active(peer)) return null;
      var reportSet = await peer.pc.getStats();
      if (!active(peer)) return null;
      var records = new Map();
      reportSet.forEach(function (record) { records.set(record.id, record); });
      var inbound = 0, outbound = 0, lost = 0, received = 0, pair = null, audioLevel = null, fps = null, reason = null;
      records.forEach(function (record) {
        if (record.type === 'inbound-rtp' && !record.isRemote) {
          inbound += record.bytesReceived || 0;
          lost += Math.max(0, record.packetsLost || 0);
          received += record.packetsReceived || 0;
          if (typeof record.audioLevel === 'number') audioLevel = record.audioLevel;
        }
        if (record.type === 'outbound-rtp' && !record.isRemote) {
          outbound += record.bytesSent || 0;
          if (typeof record.framesPerSecond === 'number') fps = record.framesPerSecond;
          if (record.qualityLimitationReason && record.qualityLimitationReason !== 'none') reason = record.qualityLimitationReason;
        }
        if (record.type === 'transport' && record.selectedCandidatePairId) pair = records.get(record.selectedCandidatePairId) || pair;
        if (!pair && record.type === 'candidate-pair' && record.state === 'succeeded' && (record.nominated || record.selected)) pair = record;
      });
      var timestamp = now();
      var previous = peer.counters;
      peer.counters = { at: timestamp, inbound: inbound, outbound: outbound };
      var elapsed = previous ? (timestamp - previous.at) / 1000 : 0;
      var remoteCandidate = pair && records.get(pair.remoteCandidateId);
      var localCandidate = pair && records.get(pair.localCandidateId);
      return {
        peerId: peer.id, connectionState: peer.pc.connectionState, iceState: peer.pc.iceConnectionState,
        restarts: peer.restarts, lowData: lowData,
        receivedBps: elapsed > 0 ? Math.max(0, (inbound - previous.inbound) * 8 / elapsed) : null,
        sentBps: elapsed > 0 ? Math.max(0, (outbound - previous.outbound) * 8 / elapsed) : null,
        roundTripMs: pair && typeof pair.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 1000) : null,
        packetLossPercent: received + lost > 0 ? Math.round(lost / (received + lost) * 1000) / 10 : null,
        relay: Boolean((localCandidate && localCandidate.candidateType === 'relay') || (remoteCandidate && remoteCandidate.candidateType === 'relay')),
        availableOutgoingBitrate: pair && typeof pair.availableOutgoingBitrate === 'number' ? pair.availableOutgoingBitrate : null,
        framesPerSecond: fps, qualityLimitationReason: reason, audioLevel: audioLevel
      };
    }
    async function getStats() {
      if (closed) return [];
      var result = await Promise.all(Array.from(peers.values(), async function (peer) {
        try { return await statsFor(peer); } catch (error) { if (active(peer)) report(error, peer, 'getStats'); return null; }
      }));
      var statistics = result.filter(Boolean);
      if (!closed) callback('onStats', [statistics]);
      return statistics;
    }
    async function updateIceServers(servers, settings) {
      if (closed) return false;
      var next = iceConfiguration(servers), changed = [];
      // setConfiguration is synchronous. Update all live PCs before publishing
      // the configuration for future members, and roll back if one rejects it.
      try {
        peers.forEach(function (peer) {
          if (!active(peer)) return;
          if (typeof peer.pc.setConfiguration !== 'function') throw new Error('This browser cannot refresh ICE credentials.');
          var previous = typeof peer.pc.getConfiguration === 'function' ? peer.pc.getConfiguration() : { iceServers: iceConfiguration(iceServers), iceTransportPolicy: options.iceTransportPolicy === 'relay' ? 'relay' : 'all', bundlePolicy: 'max-bundle' };
          peer.pc.setConfiguration(Object.assign({}, previous, { iceServers: iceConfiguration(next) }));
          changed.push({ peer: peer, previous: previous });
        });
      } catch (error) {
        changed.forEach(function (entry) { try { if (active(entry.peer)) entry.peer.pc.setConfiguration(entry.previous); } catch (rollbackError) { report(rollbackError, entry.peer, 'restoreIceServers'); } });
        report(error, null, 'updateIceServers');
        throw error;
      }
      iceServers = next;
      if (settings && settings.restart) {
        await Promise.all(changed.map(function (entry) {
          clearRestart(entry.peer);
          return enqueue(entry.peer, 'restartIce', function () { return restartPeer(entry.peer, true); });
        }));
      }
      return !closed;
    }
    var statsTimer = null;
    if (typeof options.onStats === 'function' && options.statsIntervalMs !== 0) {
      statsTimer = repeat(function () { getStats().catch(function (error) { report(error, null, 'getStats'); }); }, Math.max(1000, options.statsIntervalMs || 5000));
      if (statsTimer && typeof statsTimer.unref === 'function') statsTimer.unref();
    }
    return {
      addPeer: addPeer, handleSignal: handleSignal,
      replaceVideoTrack: function (track) { return replaceTrack('video', track); },
      replaceAudioTrack: function (track) { return replaceTrack('audio', track); },
      setAudioEnabled: function (value) { return setEnabled('audio', value); },
      setVideoEnabled: function (value) { return setEnabled('video', value); },
      setLowDataMode: function (value) { lowData = Boolean(value); updateAllQuality(); return lowData; },
      sendCaption: function (text, final) {
        var message = JSON.stringify({ t: 'cap', text: String(text || '').slice(0, 500), final: Boolean(final) });
        peers.forEach(function (peer) { var channel = peer.captions; if (channel && channel.readyState === 'open') { try { channel.send(message); } catch (_) {} } });
      },
      removePeer: removePeer, getStats: getStats, updateIceServers: updateIceServers,
      close: function () {
        if (closed) return;
        closed = true;
        if (statsTimer !== null) unrepeat(statsTimer);
        Array.from(peers.keys()).forEach(removePeer);
      }
    };
  }
  return { create: create, maxMembers: MAX_REMOTE_PEERS + 1, version: '1.0.0' };
}));
