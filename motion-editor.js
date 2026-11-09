/* Sota Kece — Motion Wallpaper editor (motion.html).
   Upload a picture, pick a motion style, preview it live, then export a looping video
   or save it as your profile backdrop. Free for an account's first year. */
(function () {
  'use strict';
  const E = window.SotaMotionEngine, G = window.SotaSubscriptionGuard;
  const SB_URL = 'https://aqfzpaczyodhugsgqvxi.supabase.co', SB_KEY = 'sb_publishable_DvpX2PSuPtxE3IqWUlRZfQ_YP2qLZtF';
  const MAX_BYTES = 25 * 1024 * 1024, MAX_EDGE = 2048, MIN_EDGE = 320;
  const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  const STYLES = [
    { id: 'parallax', name: '3D Parallax Tilt', blurb: 'Reacts to device movement' },
    { id: 'particles', name: 'Ambient Particles', blurb: 'Dust, rain, or sun flares',
      variants: ['Dust', 'Sun flare', 'Rain'] },
    { id: 'fluid', name: 'Liquid Ripple', blurb: 'Gentle water and air wave simulation' },
    { id: 'glitch', name: 'Cyberpunk HUD', blurb: 'Digital scanlines and holographic drift' },
    { id: 'cinemagraph', name: 'Loop Cinemagraph', blurb: 'Tap what stays still; everything else flows',
      variants: ['Flow sideways', 'Flow downwards'] }
  ];
  const $ = function (s) { return document.querySelector(s); };
  const ui = {
    drop: $('#mw-drop'), file: $('#mw-file'), error: $('#mw-error'), stage: $('#mw-stage'),
    canvas: $('#mw-canvas'), preview: $('#mw-preview'), styles: $('#mw-styles'), variants: $('#mw-variants'),
    intensity: $('#mw-intensity'), tilt: $('#mw-tilt'), exportBtn: $('#mw-export'), saveBtn: $('#mw-save'),
    replace: $('#mw-replace'), status: $('#mw-status'), access: $('#mw-access'), progress: $('#mw-progress'),
    hint: $('#mw-hint')
  };
  let engine = null, user = null, accountReady = null, uploadSeq = 0, access = { allowed: false, reason: 'signed-out' }, current = null, styleIndex = 0;

  /* ---------- account + free-year check ---------- */
  async function loadAccount() {
    try {
      if (!window.supabase) throw new Error('no client');
      const sb = window.supabase.createClient(SB_URL, SB_KEY);
      const r = await sb.auth.getUser();
      user = r && r.data && r.data.user || null;
    } catch (_) { user = null; }
    access = G.checkMotionAccess(user);
    ui.access.textContent = access.reason === 'free-year' ? 'Free for you · ' + access.freeDaysLeft + ' days left in your free year'
      : access.reason === 'subscribed' ? 'Creator plan · unlimited'
      : access.reason === 'upgrade-required' ? 'Creator plan needed to export'
      : 'Free for your first year — sign in to export';
    ui.access.dataset.state = access.allowed ? 'ok' : 'locked';
  }
  async function requireAccess() {
    await accountReady;
    if (access.allowed) return true;
    G.showUpgradeModal({ reason: access.reason, onUpgrade: function () { location.href = '/#plans'; } });
    return false;
  }

  /* ---------- upload + pre-processing ---------- */
  function fail(msg) { ui.error.textContent = msg; ui.error.hidden = !msg; }
  async function handleFile(file) {
    fail('');
    if (!file) return;
    const seq = ++uploadSeq;
    if (TYPES.indexOf(file.type) < 0) return fail('Please choose a PNG, JPEG or WebP picture.');
    if (file.size > MAX_BYTES) return fail('That picture is over 25 MB. Please choose a smaller one.');
    const url = URL.createObjectURL(file);
    ui.preview.src = url; ui.preview.hidden = false;
    document.body.classList.add('mw-has-image');
    setStatus('Reading your picture…');
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) { try { bmp = await createImageBitmap(file); } catch (e) { URL.revokeObjectURL(url); return fail('That picture could not be opened.'); } }
    if (seq !== uploadSeq) { bmp.close && bmp.close(); URL.revokeObjectURL(url); return; }
    if (Math.min(bmp.width, bmp.height) < MIN_EDGE) { URL.revokeObjectURL(url); return fail('That picture is too small. Use one at least ' + MIN_EDGE + ' pixels on its shortest side.'); }
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    const blob = await new Promise(function (r) { c.toBlob(r, 'image/webp', 0.9); }) || file;
    if (seq !== uploadSeq) return;
    current = { canvas: c, blob: blob };
    setStatus('Bringing it to life…');
    if (!engine) { engine = E.createMotionEngine(ui.canvas); }
    engine.setImage(c);
    selectStyle(styleIndex);
    engine.setIntensity(+ui.intensity.value);
    engine.start();
    URL.revokeObjectURL(url);
    ui.preview.hidden = true; ui.stage.classList.add('is-live');
    setStatus('');
    [ui.exportBtn, ui.saveBtn].forEach(function (b) { b.disabled = false; });
  }
  ui.drop.addEventListener('click', function () { ui.file.click(); });
  ui.drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.file.click(); } });
  ui.replace.addEventListener('click', function () { ui.file.click(); });
  ui.file.addEventListener('change', function () { handleFile(ui.file.files[0]); ui.file.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { ui.drop.addEventListener(ev, function (e) { e.preventDefault(); ui.drop.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { ui.drop.addEventListener(ev, function (e) { e.preventDefault(); ui.drop.classList.remove('is-over'); }); });
  ui.drop.addEventListener('drop', function (e) { handleFile(e.dataTransfer.files[0]); });

  /* ---------- style picker ---------- */
  ui.styles.innerHTML = STYLES.map(function (s, i) {
    return '<button type="button" role="radio" class="mw-style" data-i="' + i + '" data-style="' + s.id + '" aria-checked="' + (i === 0) + '">' +
      '<span class="mw-swatch" aria-hidden="true"></span><span class="mw-style-name">' + s.name + '</span>' +
      '<span class="mw-style-blurb">' + s.blurb + '</span></button>';
  }).join('');
  ui.styles.addEventListener('click', function (e) { const b = e.target.closest('.mw-style'); if (b) selectStyle(+b.dataset.i); });
  function selectStyle(i) {
    styleIndex = i;
    ui.styles.querySelectorAll('.mw-style').forEach(function (b) { b.setAttribute('aria-checked', String(+b.dataset.i === i)); });
    const s = STYLES[i];
    ui.variants.innerHTML = (s.variants || []).map(function (v, n) {
      return '<button type="button" class="mw-chip" data-v="' + n + '" aria-pressed="' + (n === 0) + '">' + v + '</button>';
    }).join('');
    ui.variants.hidden = !s.variants;
    ui.hint.hidden = s.id !== 'cinemagraph';
    ui.tilt.hidden = s.id !== 'parallax';
    if (engine) { engine.setStyle(s.id); engine.setVariant(0); }
  }
  ui.variants.addEventListener('click', function (e) {
    const b = e.target.closest('.mw-chip'); if (!b) return;
    ui.variants.querySelectorAll('.mw-chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
    engine && engine.setVariant(+b.dataset.v);
  });
  ui.intensity.addEventListener('input', function () { engine && engine.setIntensity(+ui.intensity.value); });
  ui.canvas.addEventListener('click', function (e) {
    if (!engine || STYLES[styleIndex].id !== 'cinemagraph') return;
    const r = ui.canvas.getBoundingClientRect();
    engine.setFocus((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  ui.tilt.addEventListener('click', async function () {
    const ok = engine && await engine.enableTilt();
    setStatus(ok ? 'Tilt your phone to look around the picture.' : 'Move your mouse or finger over the picture to look around it.');
  });

  /* ---------- export + save ---------- */
  ui.exportBtn.addEventListener('click', async function () {
    if (!engine || !(await requireAccess())) return;
    ui.exportBtn.disabled = true; ui.progress.hidden = false;
    try {
      const blob = await engine.exportLoop({ onProgress: function (p) { ui.progress.value = p; } });
      const ext = blob.type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'sota-kece-motion-wallpaper.' + ext;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      setStatus('Saved a ' + E.LOOP + '-second loop to your device.');
    } catch (err) { setStatus(err.message || 'Export failed. Please try again.'); }
    ui.exportBtn.disabled = false; ui.progress.hidden = true;
  });
  ui.saveBtn.addEventListener('click', async function () {
    if (!engine || !current || !(await requireAccess())) return;
    try {
      await window.SotaMotionStore.save({ blob: current.blob, settings: engine.settings(), savedAt: Date.now() });
      setStatus('Set as your profile backdrop on this device.');
    } catch (_) { setStatus('Could not save on this device. Check your browser storage settings.'); }
  });
  function setStatus(t) { ui.status.textContent = t; }

  accountReady = loadAccount();
})();
