/* Sota Kece — plays stories made in Song Scratch inside the Stories viewer (sota-plus.js).
   video   : the story video, with its music
   image   : a still picture
   scratch : the friend scratches the cover away themselves; the song starts on the first touch
   Files are private (bucket "sota-stories"); the database only signs a link while the story can be
   seen. Links last an hour. Everything stops when the viewer closes or moves on. */
(function () {
  'use strict';
  var BUCKET = 'sota-stories', W = 720, H = 1280;
  var playing = [];   // audio/video elements to stop

  function stop() {
    playing.forEach(function (m) { try { m.pause(); } catch (_) {} });
    playing = [];
  }

  /** Find the story's files (their extensions vary) and sign a link for each. */
  async function signed(client, stem) {
    var folder = stem.split('/')[0], id = stem.split('/')[1];
    var listed = await client.storage.from(BUCKET).list(folder, { search: id, limit: 10 });
    if (listed.error) throw listed.error;
    var names = (listed.data || []).map(function (f) { return f.name; }).filter(function (n) { return n.indexOf(id) === 0; });
    if (!names.length) throw new Error('gone');
    var s = await client.storage.from(BUCKET).createSignedUrls(names.map(function (n) { return folder + '/' + n; }), 3600);
    if (s.error) throw s.error;
    var out = {};
    (s.data || []).forEach(function (row, k) {
      var rest = names[k].slice(id.length).replace(/\.[a-z0-9]+$/, '');   // '', '-under', '-cover', '-over'
      out[rest || 'main'] = row.signedUrl;
    });
    return out;
  }

  function img(src) {
    return new Promise(function (resolve, reject) {
      var i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = function () { resolve(i); }; i.onerror = reject; i.src = src;
    });
  }

  var catalogue = null;
  async function songUrl(id) {
    if (!id) return null;
    try {
      if (!catalogue) catalogue = (await import('/shared-music/core.mjs')).loadCatalogue().then(function (r) { return r.tracks; });
      var t = (await catalogue).filter(function (x) { return x.id === id; })[0];
      return t ? t.url : null;
    } catch (_) { return null; }
  }

  function scratchPlayer(host, files, item) {
    var wrap = document.createElement('div'); wrap.className = 'sk-story-scratch';
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    cv.setAttribute('aria-label', 'Scratch the picture with your finger to hear the song');
    var hint = document.createElement('p'); hint.className = 'sk-story-hint'; hint.textContent = 'Scratch to hear the song 🎵';
    var reveal = document.createElement('button'); reveal.type = 'button'; reveal.className = 'btn sm ghost sk-story-reveal'; reveal.textContent = 'Show it all';
    wrap.append(cv, hint, reveal); host.append(wrap);
    var ctx = cv.getContext('2d');
    var cover = document.createElement('canvas'); cover.width = W; cover.height = H;
    var cc = cover.getContext('2d');
    var under = null, over = null, audio = null, started = false, last = null, down = false;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (under) ctx.drawImage(under, 0, 0, W, H);
      ctx.drawImage(cover, 0, 0);
      if (over) ctx.drawImage(over, 0, 0, W, H);
    }
    function at(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
    function cut(a, b) {
      cc.globalCompositeOperation = 'destination-out'; cc.lineCap = 'round'; cc.lineJoin = 'round'; cc.lineWidth = 70;
      cc.beginPath(); cc.moveTo(a.x, a.y); cc.lineTo(b.x, b.y); cc.stroke();
      cc.globalCompositeOperation = 'source-over';
      draw();
    }
    async function music() {
      if (started) return; started = true; hint.hidden = true;
      var url = await songUrl(item.song_id);
      if (!url) return;
      audio = new Audio(url); audio.loop = true; playing.push(audio);
      audio.addEventListener('loadedmetadata', function () { try { audio.currentTime = item.song_start || 0; } catch (_) {} }, { once: true });
      audio.play().catch(function () {});
    }
    cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); down = true; last = at(e); cut(last, { x: last.x + .1, y: last.y + .1 }); music(); });
    cv.addEventListener('pointermove', function (e) { if (!down) return; var p = at(e); cut(last, p); last = p; });
    cv.addEventListener('pointerup', function () { down = false; });
    cv.addEventListener('pointercancel', function () { down = false; });
    reveal.addEventListener('click', function () { cc.clearRect(0, 0, W, H); draw(); music(); reveal.hidden = true; });

    return Promise.all([img(files['-under']), img(files['-cover']), img(files['-over'])]).then(function (l) {
      under = l[0]; over = l[2]; cc.drawImage(l[1], 0, 0, W, H); draw();
    });
  }

  /** Put the story's media into `host`. `item` is one entry of bv_stories().items. */
  async function mount(host, item, client) {
    stop();
    if (!host || !item || !item.media_path || !client) return;
    host.classList.add('is-loading');
    try {
      var files = await signed(client, item.media_path);
      host.textContent = '';
      if (item.media_kind === 'video' && files.main) {
        var v = document.createElement('video');
        v.src = files.main; v.controls = true; v.autoplay = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.loop = true;
        host.append(v); playing.push(v);
        v.play().catch(function () {});
      } else if (item.media_kind === 'image' && files.main) {
        var i = document.createElement('img'); i.alt = item.body || 'Story picture'; i.src = files.main; host.append(i);
      } else if (item.media_kind === 'scratch' && files['-under'] && files['-cover'] && files['-over']) {
        await scratchPlayer(host, files, item);
      } else {
        throw new Error('gone');
      }
    } catch (_) {
      host.textContent = 'This story could not be opened. It may have run out.';
    } finally {
      host.classList.remove('is-loading');
    }
  }

  window.SotaStoryMedia = { mount: mount, stop: stop };
})();
