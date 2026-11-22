// A compact overview is preferred on phones. New songs and local files can be analysed on demand.
const resolution = 1024;
const recent = new Map();
let catalogue;
function remember(key, value) {
  recent.set(key, value);
  if (recent.size > 12) recent.delete(recent.keys().next().value);
  return value;
}
export function envelope(buffer) {
  const energy = new Float32Array(resolution);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel);
    for (let i = 0; i < resolution; i++) {
      const start = Math.floor(i * samples.length / resolution);
      const end = Math.floor((i + 1) * samples.length / resolution);
      let sum = 0;
      for (let j = start; j < end; j++) sum += samples[j] * samples[j];
      energy[i] += sum / Math.max(1, end - start);
    }
  }
  const ordered = energy.slice().sort();
  const scale = ordered[Math.floor(resolution * .99)] || ordered[resolution - 1] || 1;
  return Uint8Array.from(energy, n => Math.round(255 * Math.min(1, Math.sqrt(n / scale))));
}
export async function savedWave(track, signal) {
  const key = track.key || track.id;
  if (recent.has(key)) return recent.get(key);
  if (!track.url) return null;
  if (!catalogue) catalogue = fetch('/assets/music-waveforms.json?v=1', {credentials:'omit'})
    .then(response => response.ok ? response.json() : Promise.reject())
    .catch(() => { catalogue = null; return {}; });
  const entry = (await catalogue)[track.id];
  if (signal.aborted || !entry || (track.size && entry.bytes !== track.size)) return null;
  return remember(key, {duration:entry.seconds, peaks:Uint8Array.from(atob(entry.peaks), ch => ch.charCodeAt(0))});
}
export async function analyseWave(track, signal) {
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) throw Error('Audio analysis is unavailable');
  let bytes;
  if (track.blob) bytes = await track.blob.arrayBuffer();
  else {
    const response = await fetch(track.url, {signal, credentials:'omit', referrerPolicy:'no-referrer'});
    if (!response.ok) throw Error('Audio unavailable');
    bytes = await response.arrayBuffer();
  }
  if (signal.aborted) return null;
  const decoder = new Offline(1, 1, 8000);
  const buffer = await decoder.decodeAudioData(bytes);
  if (signal.aborted) return null;
  return remember(track.key || track.id, {duration:buffer.duration, peaks:envelope(buffer)});
}
