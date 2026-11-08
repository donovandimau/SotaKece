/* Dimau PWA kit v1 — one script for every Dimau app.
   Gives an app: (1) install-to-home-screen prompt (Android + iPhone), via khmyznikov/pwa-install
                 (2) service-worker registration + "new version, reload" bar (pair with sw.js / Workbox)
                 (3) a phone-style slide-up bottom sheet:  DimauSheet.open({title, html, actions})
                 (4) a date picker on any input:            DimauPwa.datePicker(inputEl, onPick)  (vanilla-calendar-pro)
   Usage: <script src="/dimau-pwa.js" data-sw="/sw.js" defer></script>
   Brand: sky-blue glass. Override with CSS vars --dp-primary, --dp-glass, --dp-ink. */
(function () {
  'use strict';
  const me = document.currentScript || {};
  const SW = (me.dataset && me.dataset.sw) || '';   // opt-in: data-sw="/sw.js". Apps with their own worker leave this off.
  const CDN = {
    install: 'https://cdn.jsdelivr.net/npm/@khmyznikov/pwa-install@0.6.3/dist/pwa-install.bundle.js',
    calJs: 'https://cdn.jsdelivr.net/npm/vanilla-calendar-pro@3/index.js',
    calCss: 'https://cdn.jsdelivr.net/npm/vanilla-calendar-pro@3/styles/index.css'
  };

  /* ---------- styles (bottom sheet + update bar + calendar tint) ---------- */
  const css = `
  :root{--dp-primary:#075b94;--dp-ink:#0b2540;--dp-sub:#284b68;--dp-glass:rgba(238,248,255,.94);--dp-line:rgba(7,91,148,.22)}
  .dp-scrim{position:fixed;inset:0;background:rgba(11,37,64,.35);backdrop-filter:blur(3px);opacity:0;transition:opacity .22s;z-index:9000}
  .dp-scrim.on{opacity:1}
  .dp-sheet{position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:560px;background:var(--dp-glass);backdrop-filter:blur(16px);
    border:1px solid var(--dp-line);border-bottom:0;border-radius:20px 20px 0 0;box-shadow:0 -10px 40px rgba(7,91,148,.18);
    transform:translateY(100%);transition:transform .28s cubic-bezier(.32,.72,0,1);z-index:9001;padding:8px 18px calc(18px + env(safe-area-inset-bottom));
    color:var(--dp-ink);font:16px/1.5 inherit;max-height:85vh;display:flex;flex-direction:column;touch-action:none}
  .dp-sheet.on{transform:translateY(0)}
  .dp-grab{width:42px;height:5px;border-radius:3px;background:rgba(7,91,148,.3);margin:4px auto 10px;flex:none}
  .dp-title{font-weight:800;font-size:18px;margin:0 0 6px;flex:none}
  .dp-body{overflow:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;color:var(--dp-sub);font-size:15px}
  .dp-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;flex:none}
  .dp-btn{appearance:none;border:0;border-radius:12px;padding:12px 18px;font-size:15px;font-weight:700;min-height:44px;cursor:pointer;
    background:var(--dp-primary);color:#fff;flex:1 1 auto}
  .dp-btn.sec{background:#fff;color:var(--dp-primary);border:1px solid var(--dp-line)}
  .dp-btn.warn{background:#fff;color:#b4690e;border:1px solid rgba(180,105,14,.35)}
  .dp-update{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));margin:0 auto;max-width:480px;
    background:var(--dp-glass);backdrop-filter:blur(14px);border:1px solid var(--dp-line);border-radius:14px;padding:10px 14px;
    display:flex;gap:10px;align-items:center;box-shadow:0 8px 30px rgba(7,91,148,.18);z-index:8999;font-size:14px;color:var(--dp-ink)}
  .dp-update .dp-btn{flex:none;padding:8px 14px;min-height:36px;font-size:14px}
  .vc{--vc-color-primary:var(--dp-primary)!important;border-radius:14px!important;box-shadow:0 8px 30px rgba(7,91,148,.18)!important}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- helpers ---------- */
  const loadScript = (src, type) => new Promise((ok, no) => {
    if (document.querySelector('script[src="' + src + '"]')) return ok();
    const s = document.createElement('script'); s.src = src; if (type) s.type = type; s.onload = ok; s.onerror = no; document.head.appendChild(s);
  });
  const loadCss = (href) => { if (!document.querySelector('link[href="' + href + '"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l); } };

  /* ---------- 1. install prompt ---------- */
  function installPrompt() {
    if (me.dataset && me.dataset.install === 'off') return; // app has its own install prompt (dimau-install.js)
    if (me.dataset && me.dataset.install === 'off') return; // app has its own install prompt
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return; // already installed
    if (!document.querySelector('link[rel="manifest"]')) return; // no manifest = not installable; skip quietly
    // Capture Chrome's native event before the component loads, so it is never lost.
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window._dimauPromptEvent = e; });
    loadScript(CDN.install).then(() => {
      let el = document.querySelector('pwa-install');
      if (!el) { el = document.createElement('pwa-install'); el.setAttribute('manual-apple', 'true'); el.setAttribute('manual-chrome', 'true'); document.body.appendChild(el); }
      if (window._dimauPromptEvent) el.externalPromptEvent = window._dimauPromptEvent;
      // Show once per visitor, after they have used the app for a little while — not on first paint.
      const seen = (() => { try { return localStorage.getItem('dimau-install-seen'); } catch (e) { return '1'; } })();
      if (!seen) setTimeout(() => { try { el.showDialog(true); localStorage.setItem('dimau-install-seen', '1'); } catch (e) {} }, 25000);
      window.DimauPwa.install = () => { try { el.showDialog(true); } catch (e) {} };
    }).catch(() => {});
  }

  /* ---------- 2. service worker + update bar ---------- */
  function serviceWorker() {
    if (!('serviceWorker' in navigator) || !SW) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(SW).then(reg => {
        const bar = () => {
          if (document.querySelector('.dp-update')) return;
          const d = document.createElement('div'); d.className = 'dp-update';
          d.innerHTML = '<span style="flex:1">A new version is ready.</span><button class="dp-btn">Reload</button>';
          d.querySelector('button').onclick = () => { reg.waiting && reg.waiting.postMessage({ type: 'SKIP_WAITING' }); };
          document.body.appendChild(d);
        };
        if (reg.waiting) bar();
        reg.addEventListener('updatefound', () => {
          const w = reg.installing; if (!w) return;
          w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) bar(); });
        });
      }).catch(() => {});
      let refreshed = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!refreshed) { refreshed = true; location.reload(); } });
    });
  }

  /* ---------- 3. bottom sheet ---------- */
  const Sheet = {
    _els: null,
    open(o) {
      o = o || {};
      this.close(true);
      const scrim = document.createElement('div'); scrim.className = 'dp-scrim';
      const sh = document.createElement('div'); sh.className = 'dp-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
      sh.innerHTML = '<div class="dp-grab"></div>' + (o.title ? '<h3 class="dp-title"></h3>' : '') + '<div class="dp-body"></div><div class="dp-actions"></div>';
      if (o.title) sh.querySelector('.dp-title').textContent = o.title;
      const body = sh.querySelector('.dp-body');
      if (o.node) body.appendChild(o.node); else body.innerHTML = o.html || '';
      const acts = sh.querySelector('.dp-actions');
      (o.actions || []).forEach(a => {
        const b = document.createElement('button'); b.className = 'dp-btn' + (a.kind ? ' ' + a.kind : ''); b.textContent = a.label;
        b.onclick = () => { const r = a.onClick && a.onClick(); if (r !== false) Sheet.close(); }; acts.appendChild(b);
      });
      if (!o.actions || !o.actions.length) acts.remove();
      scrim.onclick = () => Sheet.close();
      // swipe down to dismiss
      let y0 = null, dy = 0;
      sh.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
      sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
      sh.addEventListener('touchend', () => { sh.style.transition = ''; if (dy > 90) Sheet.close(); else sh.style.transform = ''; y0 = null; });
      document.body.append(scrim, sh);
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => { scrim.classList.add('on'); sh.classList.add('on'); });
      this._els = { scrim, sh };
      const esc = e => { if (e.key === 'Escape') Sheet.close(); }; document.addEventListener('keydown', esc); this._esc = esc;
      return sh;
    },
    close(now) {
      const e = this._els; if (!e) return; this._els = null;
      document.body.style.overflow = ''; document.removeEventListener('keydown', this._esc);
      e.scrim.classList.remove('on'); e.sh.classList.remove('on'); e.sh.style.transform = '';
      setTimeout(() => { e.scrim.remove(); e.sh.remove(); }, now ? 0 : 300);
    }
  };

  /* ---------- 4. date picker ---------- */
  let calReady = null;
  function datePicker(input, onPick, opts) {
    if (!input) return;
    if (!calReady) { loadCss(CDN.calCss); calReady = loadScript(CDN.calJs); }
    input.setAttribute('readonly', 'readonly'); input.setAttribute('inputmode', 'none'); input.placeholder = input.placeholder || 'Pick a date';
    calReady.then(() => {
      const C = window.VanillaCalendarPro && window.VanillaCalendarPro.Calendar; if (!C) return;
      const cal = new C(input, Object.assign({
        inputMode: true, positionToInput: 'auto', selectionDatesMode: 'single', firstWeekday: 1, locale: 'en-GB',
        onClickDate(self) {
          const d = (self.context && self.context.selectedDates || [])[0]; if (!d) return;
          input.value = d; input.dataset.iso = d; input.dispatchEvent(new Event('change', { bubbles: true }));
          onPick && onPick(d); self.hide();
        }
      }, opts || {}));
      cal.init(); input._dimauCal = cal;
    }).catch(() => { input.removeAttribute('readonly'); input.type = 'date'; }); // fall back to the browser's own picker
  }

  window.DimauSheet = Sheet;
  window.DimauPwa = { datePicker, sheet: Sheet, install: () => {} };
  installPrompt(); serviceWorker();
})();
