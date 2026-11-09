/* Sota Kece — plays a member's motion wallpaper behind their profile room cover.
   The picture is a private room file: only the owner and accepted friends can open it.
   Pauses when the cover scrolls off screen to save battery and data. */
(function () {
  'use strict';
  let current = null;
  const css = '.bv-cover.has-motion{isolation:isolate}.bv-cover>.mw-mounted{z-index:1;pointer-events:none;border-radius:inherit}';
  function style() {
    if (document.getElementById('sota-motion-room-css')) return;
    const s = document.createElement('style'); s.id = 'sota-motion-room-css'; s.textContent = css; document.head.appendChild(s);
  }
  function release() {
    if (!current) return;
    const c = current; current = null;
    c.observer && c.observer.disconnect();
    c.engine && c.engine.destroy();
    c.cover && c.cover.classList.remove('has-motion');
    c.cover && c.cover.querySelectorAll(':scope>.mw-mounted').forEach(function (n) { n.remove(); });
  }
  async function mount(cover, s, client) {
    release();
    if (!cover || !s || !s.motionPath || !s.motionStyle || !client || !window.SotaMotionEngine || !window.SotaRoomMedia) return;
    const mine = { cover: cover, engine: null, observer: null }; current = mine;
    try {
      const url = await window.SotaRoomMedia.signed(client, s.motionPath, 'covers');
      const res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) return;
      const bmp = await createImageBitmap(await res.blob());
      if (current !== mine || !cover.isConnected) { bmp.close && bmp.close(); return; }
      style(); cover.classList.add('has-motion');
      mine.engine = window.SotaMotionEngine.mount(cover, bmp, {
        style: s.motionStyle, variant: s.motionVariant, intensity: s.motionIntensity, focus: [s.motionFocusX, s.motionFocusY]
      });
      if ('IntersectionObserver' in window) {
        mine.observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) mine.engine.start(); else mine.engine.stop(); });
        });
        mine.observer.observe(cover);
      }
    } catch (_) { /* The room still shows its normal cover if the wallpaper cannot load. */ }
  }
  window.SotaMotionRoom = { mount: mount, release: release };
})();
