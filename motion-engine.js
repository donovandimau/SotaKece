/* Sota Kece — Motion Wallpaper engine.
   Turns one still picture into a seamless looping motion wallpaper with WebGL.
   Five styles: parallax, particles, ripple, glitch, cinemagraph.
   Every movement repeats exactly every LOOP seconds, so exports loop without a seam.
   No network calls: depth is estimated on the device, so it works on low data. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SotaMotionEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const LOOP = 6; // seconds
  const STYLES = ['parallax', 'particles', 'fluid', 'glitch', 'cinemagraph'];

  /* ---------- Depth estimate (pure, testable) ----------
     A light on-device estimate, not a neural model: lower in the frame is nearer,
     the subject near the centre and detailed areas come forward, then it is smoothed.
     Returns Float32Array of 0 (far) .. 1 (near). */
  function estimateDepth(rgba, w, h) {
    const n = w * h, lum = new Float32Array(n), d = new Float32Array(n);
    for (let i = 0; i < n; i++) lum[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const gx = lum[y * w + Math.min(w - 1, x + 1)] - lum[y * w + Math.max(0, x - 1)];
      const gy = lum[Math.min(h - 1, y + 1) * w + x] - lum[Math.max(0, y - 1) * w + x];
      const detail = Math.min(1, Math.sqrt(gx * gx + gy * gy) * 4);
      const vy = h > 1 ? y / (h - 1) : 0.5, vx = w > 1 ? x / (w - 1) : 0.5;
      const centre = 1 - Math.min(1, Math.hypot(vx - 0.5, (vy - 0.55) * 1.2) * 1.6);
      const sky = (lum[i] > 0.7 && vy < 0.45) ? -0.25 : 0;
      d[i] = 0.45 * vy + 0.35 * centre + 0.2 * detail + sky;
    }
    const r = Math.max(1, Math.round(Math.min(w, h) / 24));
    let out = d;
    for (let pass = 0; pass < 3; pass++) out = boxBlur(out, w, h, r);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { if (out[i] < lo) lo = out[i]; if (out[i] > hi) hi = out[i]; }
    const span = hi - lo || 1;
    for (let i = 0; i < n; i++) out[i] = (out[i] - lo) / span;
    return out;
  }
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(src.length), dst = new Float32Array(src.length);
    for (let y = 0; y < h; y++) { let s = 0, c = 0;
      for (let x = -r; x < w; x++) {
        if (x + r < w) { s += src[y * w + x + r]; c++; }
        if (x - r - 1 >= 0) { s -= src[y * w + x - r - 1]; c--; }
        if (x >= 0) tmp[y * w + x] = s / c;
      } }
    for (let x = 0; x < w; x++) { let s = 0, c = 0;
      for (let y = -r; y < h; y++) {
        if (y + r < h) { s += tmp[(y + r) * w + x]; c++; }
        if (y - r - 1 >= 0) { s -= tmp[(y - r - 1) * w + x]; c--; }
        if (y >= 0) dst[y * w + x] = s / c;
      } }
    return dst;
  }

  /* ---------- Shaders ---------- */
  const VERT = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}';
  const FRAG = `precision highp float;
varying vec2 v;
uniform sampler2D uImg,uDepth;
uniform vec2 uRes,uImgSize,uTilt,uFocus;
uniform float uPhase,uStyle,uVariant,uIntensity,uFocusR;
const float TAU=6.2831853;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 cover(vec2 uv,float zoom){
  float ca=uRes.x/uRes.y,ia=uImgSize.x/uImgSize.y;
  vec2 s=ca>ia?vec2(1.,ia/ca):vec2(ca/ia,1.);
  return (uv-.5)*s/zoom+.5;
}
vec3 img(vec2 uv){return texture2D(uImg,clamp(uv,0.001,.999)).rgb;}
float depth(vec2 uv){return texture2D(uDepth,clamp(uv,0.,1.)).r;}
vec2 sway(){return vec2(sin(TAU*uPhase),cos(TAU*uPhase))*.35;}
/* loopable flow: two offsets half a loop apart, cross-faded */
vec3 flow(vec2 uv,vec2 dir,float amt){
  float a=fract(uPhase),b=fract(uPhase+.5);
  vec2 n=vec2(sin(uv.y*18.+uv.x*7.),cos(uv.x*15.-uv.y*5.))*.004*amt;
  vec3 ca=img(uv+dir*(a-.5)*amt*.03+n), cb=img(uv+dir*(b-.5)*amt*.03-n);
  return mix(ca,cb,abs(a*2.-1.));
}
void main(){
  float k=uIntensity;
  vec2 uv0=cover(v,1.08);
  vec2 t=uTilt+sway();
  vec3 col;
  if(uStyle<.5){ /* 3D parallax */
    float d=depth(uv0);
    vec2 uv=uv0+t*(d-.5)*.045*k;
    col=img(uv);
    col*=1.+.06*(d-.5)*k;
  } else if(uStyle<1.5){ /* ambient particles */
    float d=depth(uv0);
    col=img(uv0+t*(d-.5)*.015*k);
    vec2 g=v*vec2(uRes.x/uRes.y,1.)*(uVariant>1.5?28.:14.);
    vec2 id=floor(g),f=fract(g);
    float h=hash(id),h2=hash(id+7.);
    if(uVariant<.5){ /* floating motes rise */
      float y=fract(h2-uPhase*(1.+floor(h*2.)));
      vec2 c=vec2(.5+.3*sin(TAU*(uPhase+h)),y);
      float sz=.03+.06*h2,m=smoothstep(sz,0.,length(f-c))*step(.72,h)*(.55+.45*sin(TAU*(uPhase+h2)));
      col+=vec3(1.,.93,.75)*m*.75*k;
    } else if(uVariant<1.5){ /* sun flare + glints */
      vec2 sun=vec2(.78,.18);
      float r=length((v-sun)*vec2(uRes.x/uRes.y,1.));
      float pulse=.85+.15*sin(TAU*uPhase);
      col+=vec3(1.,.75,.4)*(.35/(1.+r*r*40.))*pulse*k;
      col+=vec3(1.,.85,.6)*smoothstep(.006,0.,abs((v.y-sun.y)-(v.x-sun.x)*.35))*smoothstep(.6,0.,r)*.25*k;
      float tw=pow(max(0.,sin(TAU*(uPhase*2.+h))),24.)*step(.8,h)*smoothstep(.05,0.,length(f-.5));
      col+=vec3(1.)*tw*k;
    } else { /* gentle rain */
      float y=fract(h2+uPhase*3.);
      float streak=smoothstep(.04,0.,abs(f.x-.5))*smoothstep(.0,.25,f.y-y+.25)*smoothstep(.25,.0,f.y-y)*step(.55,h);
      col=mix(col,col*.85+vec3(.75,.85,.95)*.15,.6*k)+vec3(.8,.9,1.)*streak*.35*k;
    }
  } else if(uStyle<2.5){ /* liquid ripple */
    float d=depth(uv0);
    float w=mix(1.,.35,d);
    vec2 o=vec2(sin(uv0.y*40.-TAU*uPhase*2.)+.5*sin(uv0.x*23.+TAU*uPhase),
                cos(uv0.x*31.-TAU*uPhase*3.))*.0045*k*w;
    col=img(uv0+o);
    col+=vec3(.9,.97,1.)*pow(max(0.,sin((uv0.y+o.x*30.)*60.-TAU*uPhase*2.)),40.)*.12*k*w;
  } else if(uStyle<3.5){ /* cyber HUD / glitch */
    vec2 uv=uv0;
    float slice=floor(v.y*24.);
    float burst=step(.82,fract(uPhase*3.+hash(vec2(slice,0.))*.1));
    uv.x+=(hash(vec2(slice,floor(uPhase*18.)))-.5)*.06*burst*k;
    float ab=.004*k*(1.+3.*burst);
    col=vec3(img(uv+vec2(ab,0.)).r,img(uv).g,img(uv-vec2(ab,0.)).b);
    col*=.88+.12*sin(v.y*uRes.y*1.6);
    vec2 gg=v*vec2(uRes.x/uRes.y,1.)*10.+vec2(0.,uPhase*10.);
    float grid=max(smoothstep(.03,0.,abs(fract(gg.x)-.5)-.47),smoothstep(.03,0.,abs(fract(gg.y)-.5)-.47));
    col+=vec3(.3,.85,1.)*grid*.18*k;
    float scan=smoothstep(.015,0.,abs(v.y-fract(uPhase)));
    col+=vec3(.4,.9,1.)*scan*.35*k;
    col=mix(col,col*vec3(.75,1.,1.15),.25*k);
  } else { /* cinemagraph: focus stays still, the rest flows */
    vec2 a=v*vec2(uRes.x/uRes.y,1.),f=uFocus*vec2(uRes.x/uRes.y,1.);
    float still=smoothstep(uFocusR,uFocusR*.6,length(a-f));
    vec3 moving=flow(uv0,uVariant<.5?vec2(1.,0.):vec2(0.,1.),k*1.4);
    col=mix(moving,img(uv0),still);
  }
  float vig=smoothstep(1.15,.35,length(v-.5));
  gl_FragColor=vec4(col*mix(.82,1.,vig),1.);
}`;

  function compile(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
    return s;
  }

  /* ---------- Engine ---------- */
  function createMotionEngine(canvas, opts) {
    opts = opts || {};
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    const state = { style: 0, variant: 0, intensity: 1, focus: [0.5, 0.5], focusR: 0.28, tilt: [0, 0], target: [0, 0],
      img: null, raf: 0, start: 0, fixedTime: null, useTilt: true, running: false };
    const listeners = [];

    if (!gl) { canvas.dataset.motionFallback = 'css'; return fallbackEngine(canvas, state); }

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(pLoc); gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uImg', 'uDepth', 'uRes', 'uImgSize', 'uTilt', 'uFocus', 'uPhase', 'uStyle', 'uVariant', 'uIntensity', 'uFocusR']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    const texImg = gl.createTexture(), texDepth = gl.createTexture();
    function setupTex(t) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    setupTex(texImg); setupTex(texDepth);

    function setImage(source) {
      const w = source.width, h = source.height;
      state.img = { w: w, h: h };
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texImg);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      const dw = 192, dh = Math.max(1, Math.round(192 * h / w));
      const c = document.createElement('canvas'); c.width = dw; c.height = dh;
      const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(source, 0, 0, dw, dh);
      const depth = estimateDepth(cx.getImageData(0, 0, dw, dh).data, dw, dh);
      const bytes = new Uint8Array(depth.length);
      for (let i = 0; i < depth.length; i++) bytes[i] = Math.round(depth[i] * 255);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texDepth);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, dw, dh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
      draw(0);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round((r.width || canvas.width) * dpr)), h = Math.max(1, Math.round((r.height || canvas.height) * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    function draw(seconds) {
      if (!state.img) return;
      if (state.fixedTime === null) resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      state.tilt[0] += (state.target[0] - state.tilt[0]) * 0.08;
      state.tilt[1] += (state.target[1] - state.tilt[1]) * 0.08;
      gl.uniform1i(U.uImg, 0); gl.uniform1i(U.uDepth, 1);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uImgSize, state.img.w, state.img.h);
      gl.uniform2f(U.uTilt, state.useTilt ? state.tilt[0] : 0, state.useTilt ? state.tilt[1] : 0);
      gl.uniform2f(U.uFocus, state.focus[0], state.focus[1]);
      gl.uniform1f(U.uPhase, (seconds % LOOP) / LOOP);
      gl.uniform1f(U.uStyle, state.style);
      gl.uniform1f(U.uVariant, state.variant);
      gl.uniform1f(U.uIntensity, state.intensity);
      gl.uniform1f(U.uFocusR, state.focusR);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function frame(now) {
      if (!state.running) return;
      if (!state.start) state.start = now;
      draw(state.fixedTime !== null ? state.fixedTime : (now - state.start) / 1000);
      state.raf = requestAnimationFrame(frame);
    }

    function on(target, ev, fn, o) { target.addEventListener(ev, fn, o); listeners.push([target, ev, fn, o]); }
    on(window, 'pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      state.target = [(e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2];
    }, { passive: true });
    on(window, 'deviceorientation', function (e) {
      if (e.gamma == null) return;
      state.target = [Math.max(-1, Math.min(1, e.gamma / 30)), Math.max(-1, Math.min(1, (e.beta - 45) / 30))];
    }, { passive: true });
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');

    const api = {
      LOOP: LOOP, STYLES: STYLES, fallback: false,
      setImage: setImage,
      setStyle: function (s) { const i = typeof s === 'number' ? s : STYLES.indexOf(s); if (i >= 0) state.style = i; },
      setVariant: function (n) { state.variant = n; },
      setIntensity: function (n) { state.intensity = Math.max(0, Math.min(2, n)); },
      setFocus: function (x, y) { state.focus = [x, y]; },
      setFocusRadius: function (r) { state.focusR = r; },
      settings: function () { return { style: STYLES[state.style], variant: state.variant, intensity: state.intensity, focus: state.focus.slice(), focusR: state.focusR }; },
      applySettings: function (s) { if (!s) return; api.setStyle(s.style); api.setVariant(s.variant || 0);
        if (s.intensity != null) api.setIntensity(s.intensity); if (s.focus) api.setFocus(s.focus[0], s.focus[1]); if (s.focusR) api.setFocusRadius(s.focusR); },
      start: function () { if (state.running) return; state.running = true; state.start = 0;
        if (reduce && reduce.matches) { state.running = false; draw(0); return; }
        state.raf = requestAnimationFrame(frame); },
      stop: function () { state.running = false; cancelAnimationFrame(state.raf); },
      /* iOS needs a tap before the gyroscope can be read */
      enableTilt: async function () {
        const D = window.DeviceOrientationEvent;
        if (D && typeof D.requestPermission === 'function') { try { return (await D.requestPermission()) === 'granted'; } catch (_) { return false; } }
        return !!D;
      },
      /* Record exactly one loop as a video. Tilt is switched off so the loop is seamless. */
      exportLoop: function (o) {
        o = o || {};
        return new Promise(function (resolve, reject) {
          if (!canvas.captureStream || typeof MediaRecorder === 'undefined') return reject(new Error('Video export is not supported in this browser.'));
          const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
          const type = types.find(function (t) { return MediaRecorder.isTypeSupported(t); }) || '';
          const fps = o.fps || 30, wasRunning = state.running;
          api.stop(); state.useTilt = false;
          const stream = canvas.captureStream(fps);
          const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: o.bitrate || 6e6 });
          const chunks = [];
          rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
          rec.onstop = function () {
            state.useTilt = true; state.fixedTime = null; if (wasRunning) api.start();
            resolve(new Blob(chunks, { type: (type || 'video/webm').split(';')[0] }));
          };
          rec.onerror = function (e) { reject(e.error || new Error('Recording failed')); };
          rec.start();
          const t0 = performance.now();
          (function tick() {
            const s = (performance.now() - t0) / 1000;
            if (o.onProgress) o.onProgress(Math.min(1, s / LOOP));
            if (s >= LOOP) { draw(0); setTimeout(function () { rec.stop(); }, 60); return; }
            state.fixedTime = s; draw(s); requestAnimationFrame(tick);
          })();
        });
      },
      snapshot: function (type) { return new Promise(function (r) { canvas.toBlob(r, type || 'image/jpeg', 0.92); }); },
      destroy: function () { api.stop(); listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); });
        const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
    };
    return api;
  }

  /* No WebGL: CSS keyframes on the picture so the page still moves. */
  function fallbackEngine(canvas, state) {
    const img = document.createElement('img');
    img.className = 'mw-fallback'; img.alt = '';
    canvas.replaceWith(img);
    const api = {
      LOOP: LOOP, STYLES: STYLES, fallback: true,
      setImage: function (src) { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0); img.src = c.toDataURL('image/jpeg', 0.9); },
      setStyle: function (s) { const i = typeof s === 'number' ? s : STYLES.indexOf(s); if (i >= 0) { state.style = i; img.dataset.style = STYLES[i]; } },
      setVariant: function () {}, setIntensity: function () {}, setFocus: function () {}, setFocusRadius: function () {},
      settings: function () { return { style: STYLES[state.style] }; }, applySettings: function (s) { if (s) api.setStyle(s.style); },
      start: function () { img.classList.add('is-moving'); }, stop: function () { img.classList.remove('is-moving'); },
      enableTilt: async function () { return false; },
      exportLoop: function () { return Promise.reject(new Error('Video export needs a browser with WebGL.')); },
      snapshot: function () { return Promise.resolve(null); }, destroy: function () {}
    };
    return api;
  }

  /* Render a saved wallpaper into any element, e.g. a profile backdrop. */
  function mount(container, bitmap, settings) {
    const c = document.createElement('canvas');
    c.className = 'mw-mounted'; c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.prepend(c);
    const e = createMotionEngine(c);
    e.setImage(bitmap); e.applySettings(settings); e.start();
    return e;
  }

  /* Turn an uploaded file into a ready motion config (default: gentle depth parallax drift).
     intensity is 0..1 here (0.2 = subtle) and maps onto the engine's 0..2 strength. */
  const TYPE_TO_STYLE = { depth_parallax_drift: 'parallax', particles: 'particles', fluid: 'fluid', glitch: 'glitch', cinemagraph: 'cinemagraph' };
  async function handleUserWallpaperUpload(file, opts) {
    opts = opts || {};
    if (!file || ['image/png', 'image/jpeg', 'image/webp'].indexOf(file.type) < 0) throw new Error('Please choose a PNG, JPEG or WebP picture.');
    if (file.size > 25 * 1024 * 1024) throw new Error('That picture is over 25 MB.');
    const animationType = opts.animationType || 'depth_parallax_drift';
    const config = { sourceImage: URL.createObjectURL(file), animationType: animationType, style: TYPE_TO_STYLE[animationType] || 'parallax',
      fps: 60, loop: true, intensity: opts.intensity != null ? opts.intensity : 0.2 };
    config.bitmap = await createImageBitmap(file);
    if (opts.container) {
      config.engine = mount(opts.container, config.bitmap, { style: config.style, intensity: Math.max(0.2, config.intensity * 2) });
    }
    return config;
  }

  return { LOOP: LOOP, STYLES: STYLES, estimateDepth: estimateDepth, createMotionEngine: createMotionEngine, mount: mount, handleUserWallpaperUpload: handleUserWallpaperUpload };
});
