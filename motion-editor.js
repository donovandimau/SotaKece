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
    replace: $('#mw-replace'), removeBtn: $('#mw-remove'), status: $('#mw-status'), access: $('#mw-access'), progress: $('#mw-progress'),
    hint: $('#mw-hint')
  };
  let engine = null, user = null, sb = null, accountReady = null, uploadSeq = 0, access = { allowed: false, reason: 'signed-out' }, current = null, styleIndex = 0;

  /* ---------- account + free-year check ---------- */
  async function loadAccount() {
    try {
      if (!window.supabase) throw new Error('no client');
      sb = window.supabase.createClient(SB_URL, SB_KEY);
      const r = await sb.auth.getUser();
      user = r && r.data && r.data.user || null;
    } catch (_) { user = null; }
    access = G.checkMotionAccess(user);
    ui.access.textContent = access.reason === 'free-year' ? 'Free for you · ' + access.freeDaysLeft + ' days left in your free year'
      : access.reason === 'subscribed' ? 'Creator plan · unlimited'
      : access.reason === 'upgrade-required' ? 'Creator plan needed to export'
      : 'Free for your first year — sign in to export';
    ui.access.dataset.state = access.allowed ? 'ok' : 'locked';
    if (user && sb && window.BulaSkins) { try { ui.removeBtn.hidden = !(await readRoom()).s.motionPath; } catch (_) {} }
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
    document.body.classList.add('mw-has-image');
    setStatus('Reading your picture…');
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) { try { bmp = await createImageBitmap(file); } catch (e) { return fail('That picture could not be opened.'); } }
    if (seq !== uploadSeq) { bmp.close && bmp.close(); return; }
    showPreview(bmp);
    if (Math.min(bmp.width, bmp.height) < MIN_EDGE) { return fail('That picture is too small. Use one at least ' + MIN_EDGE + ' pixels on its shortest side.'); }
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
    ui.preview.hidden = true; ui.stage.classList.add('is-live');
    setStatus('');
    [ui.exportBtn, ui.saveBtn].forEach(function (b) { b.disabled = false; });
  }
  function showPreview(bmp) {
    const c = ui.preview, r = c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * dpr) || 360; c.height = Math.round(r.height * dpr) || 640;
    const s = Math.max(c.width / bmp.width, c.height / bmp.height);
    c.getContext('2d').drawImage(bmp, (c.width - bmp.width * s) / 2, (c.height - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
    c.hidden = false;
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
  /* ---------- profile backdrop (seen by the owner and accepted friends) ---------- */
  const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
  async function roomFile() {
    let blob = current.blob;
    if (!EXT[blob.type] || blob.size > 5.5 * 1024 * 1024) blob = await new Promise(function (r) { current.canvas.toBlob(r, 'image/jpeg', 0.85); });
    if (!blob || blob.size > 6 * 1024 * 1024) throw new Error('That picture is too large to save. Try a smaller one.');
    return new File([blob], 'motion-wallpaper.' + EXT[blob.type], { type: blob.type });
  }
  async function readRoom() {
    const r = await sb.from('bv_profiles').select('room_css,room_accent').eq('id', user.id).single();
    if (r.error || !r.data) throw new Error('Your profile could not be opened. Please try again.');
    const parsed = window.BulaSkins.read(r.data.room_css), s = parsed.settings;
    if (!String(r.data.room_css || '').startsWith('/* bv-skin:v1 ') && /^#[0-9a-f]{6}$/i.test(r.data.room_accent || '')) s.accent = r.data.room_accent;
    return { s: s, legacy: parsed.legacy };
  }
  async function writeRoom(room) {
    const room_css = window.BulaSkins.encode(room.s, room.legacy);
    const r = await sb.from('bv_profiles').update({ room_css: room_css }).eq('id', user.id).select('room_css').single();
    if (r.error || !r.data || r.data.room_css !== room_css) throw new Error('Your profile could not be saved. Please try again.');
  }
  ui.saveBtn.addEventListener('click', async function () {
    if (!engine || !current || !(await requireAccess())) return;
    if (!user || !sb || !window.SotaRoomMedia || !window.BulaSkins) return setStatus('Sign in to put this on your profile.');
    ui.saveBtn.disabled = true; setStatus('Putting it on your profile…');
    let uploaded = null;
    try {
      const media = window.SotaRoomMedia.api(sb, user.id);
      uploaded = await media.upload(await roomFile(), 'covers');
      const room = await readRoom(), old = room.s.motionPath, set = engine.settings();
      Object.assign(room.s, { motionPath: uploaded.path, motionStyle: set.style, motionVariant: set.variant || 0,
        motionIntensity: set.intensity, motionFocusX: set.focus ? set.focus[0] : 0.5, motionFocusY: set.focus ? set.focus[1] : 0.5 });
      await writeRoom(room);
      if (old && old !== uploaded.path) media.remove(old).catch(function () {});
      window.SotaMotionStore.save({ blob: current.blob, settings: set, savedAt: Date.now() }).catch(function () {});
      ui.removeBtn.hidden = false;
      setStatus('Done. Your friends now see it moving on your profile.');
    } catch (err) {
      if (uploaded) window.SotaRoomMedia.api(sb, user.id).remove(uploaded.path).catch(function () {});
      setStatus(err.message || 'Could not save. Please try again.');
    }
    ui.saveBtn.disabled = false;
  });
  ui.removeBtn.addEventListener('click', async function () {
    if (!user || !sb) return;
    ui.removeBtn.disabled = true;
    try {
      const room = await readRoom(), old = room.s.motionPath;
      Object.assign(room.s, { motionPath: '', motionStyle: '', motionVariant: 0, motionIntensity: 1, motionFocusX: 0.5, motionFocusY: 0.5 });
      await writeRoom(room);
      if (old) window.SotaRoomMedia.api(sb, user.id).remove(old).catch(function () {});
      window.SotaMotionStore.clear().catch(function () {});
      ui.removeBtn.hidden = true; setStatus('Removed from your profile.');
    } catch (err) { setStatus(err.message || 'Could not remove it. Please try again.'); }
    ui.removeBtn.disabled = false;
  });
  function setStatus(t) { ui.status.textContent = t; }

  accountReady = loadAccount();
})();
