export function makeArc(audio, clock) {
  const arc = document.createElement('div');
  arc.className = 'sk-display-arc';
  arc.setAttribute('role', 'slider');
  arc.setAttribute('aria-label', 'Seek through song');
  arc.setAttribute('aria-valuemin', '0');
  arc.setAttribute('aria-valuemax', '100');
  arc.innerHTML = '<svg viewBox="0 0 240 124" preserveAspectRatio="none" aria-hidden="true"><path d="M12 115 A108 108 0 0 1 228 115"/><path class="sk-display-arc-fill" pathLength="100" d="M12 115 A108 108 0 0 1 228 115"/><circle r="5.5"/></svg>';
  const enabled = () => Number.isFinite(audio.duration) && audio.duration > 0;
  function update() {
    const fraction = enabled() ? Math.max(0, Math.min(1, audio.currentTime / audio.duration)) : 0;
    const angle = Math.PI * (1 - fraction);
    arc.querySelector('.sk-display-arc-fill').style.strokeDasharray = (100 * fraction) + ' 100';
    const dot = arc.querySelector('circle');
    dot.setAttribute('cx', String(120 + 108 * Math.cos(angle)));
    dot.setAttribute('cy', String(115 - 108 * Math.sin(angle)));
    arc.setAttribute('aria-valuenow', String(Math.round(100 * fraction)));
    arc.setAttribute('aria-valuetext', clock(audio.currentTime) + ' of ' + clock(audio.duration));
    arc.setAttribute('aria-disabled', String(!enabled()));
    arc.tabIndex = enabled() ? 0 : -1;
  }
  function scrub(e) {
    const rect = arc.getBoundingClientRect();
    const x = (e.clientX - rect.left) * 240 / rect.width - 120;
    const y = Math.max(0, 115 - (e.clientY - rect.top) * 124 / rect.height);
    audio.currentTime = audio.duration * (1 - Math.atan2(y, x) / Math.PI);
    update();
  }
  arc.addEventListener('pointerdown', e => {
    if (!enabled() || e.button !== 0) return;
    arc.setPointerCapture(e.pointerId);
    scrub(e);
  });
  arc.addEventListener('pointermove', e => {
    if (enabled() && arc.hasPointerCapture(e.pointerId)) scrub(e);
  });
  arc.addEventListener('keydown', e => {
    if (!enabled()) return;
    const values = {Home: 0, End: audio.duration, ArrowLeft: audio.currentTime - 5, ArrowDown: audio.currentTime - 5,
      ArrowRight: audio.currentTime + 5, ArrowUp: audio.currentTime + 5};
    if (!(e.key in values)) return;
    e.preventDefault();
    audio.currentTime = Math.max(0, Math.min(audio.duration, values[e.key]));
    update();
  });
  update();
  return {node: arc, update};
}
