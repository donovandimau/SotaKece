// Both drawings read the analyser that already belongs to this media element.
export function draw(canvas, audio, layout) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * ratio), h = Math.round(rect.height * ratio);
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  ctx.clearRect(0, 0, w, h);
  const graph = audio.paused || audio.ended ? null : window.DimauMusicVisuals?.sample(audio);
  if (layout === 'wings') {
    const n = 18;
    const cover = canvas.parentElement.querySelector('.sk-display-sleeve')?.getBoundingClientRect().width || 0;
    const gap = Math.min(w * 0.32, cover * ratio / 2 + 4 * ratio);
    const step = (w / 2 - gap) / n;
    const energy = graph && window.DimauMusicVisuals.bins(graph.frequency, n, graph.context.sampleRate);
    for (let i = 0; i < n; i++) {
      const rest = graph ? 0.018 : 0.06 + 0.18 * Math.sin((i+1) * 1.5)**2 * (1-i/n);
      const amp = Math.max(rest, Math.sqrt(energy?.[i] || 0)) * h * 0.45;
      ctx.strokeStyle = 'hsl(' + (315 - 155 * i / n) + ',94%,72%)';
      ctx.lineWidth = Math.max(2, step * 0.54); ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        const x = w / 2 + side * (gap + (i + 0.5) * step);
        ctx.beginPath(); ctx.moveTo(x, h / 2 - amp); ctx.lineTo(x, h / 2 + amp); ctx.stroke();
      }
    }
  } else {
    const colours = ['#bd77ff', '#5bf1da', '#fa86b8'];
    colours.forEach((colour, layer) => {
      ctx.strokeStyle = colour; ctx.lineWidth = ratio * 1.8; ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = i / 120, sample = graph?.wave[Math.floor(t * (graph.wave.length - 1) / (layer + 1))] ?? 128;
        const y = h * (0.44 + 0.09 * layer + ((sample - 128) / 128) * 0.36);
        if (i) ctx.lineTo(w * t, y); else ctx.moveTo(0, y);
      }
      ctx.stroke();
    });
  }
}
