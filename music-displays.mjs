const layouts = [
  ['wings', 'Equalizer Wings'], ['arc', 'Arc Control'], ['wave', 'Wave Stage'],
  ['glass', 'Frosted Glass'], ['studio', 'Pro Studio EQ']
];
const pictures = [
  '/assets/welcome-20261103/music-natural-768.webp',
  '/assets/social-sunset-20261104/friends-guitar-clean-768.webp',
  '/assets/social-sunset-20261104/music-friends-768.webp',
  '/assets/fiji-sunset.jpg'
];
const bands = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'];
const storageKey = 'sota.music.display.v1';
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function button(className, text, click) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', click);
  return node;
}
function picture(track) {
  let hash = 0;
  for (const ch of track?.key || '') hash = (Math.imul(31, hash) + ch.charCodeAt(0)) >>> 0;
  return 'url("' + pictures[hash % pictures.length] + '")';
}
export function mountDisplays({api, deck, main, time, clock, queue}) {
  const {audio, dialog} = api;
  const sheet = element('dialog', 'sk-display-sheet');
  sheet.setAttribute('aria-label', 'Choose music display');
  const head = element('div', 'sk-display-sheet-head');
  const close = button('sk-display-close', '×', () => sheet.close());
  close.setAttribute('aria-label', 'Close display chooser');
  head.append(element('strong', '', 'Choose a display'), close);
  const choices = element('div', 'sk-display-choices');
  sheet.append(head, choices);
  const stage = element('section', 'sk-display-stage');
  stage.setAttribute('aria-label', 'Music display');
  const bar = element('div', 'sk-display-bar');
  const name = element('span', 'sk-display-layout-name');
  const launch = button('sk-display-layout', 'Displays', () => {
    sheet.showModal();
    choices.querySelector('[aria-pressed="true"]')?.focus();
  });
  launch.setAttribute('aria-haspopup', 'dialog');
  bar.append(name, launch);
  const visual = element('div', 'sk-display-visual'), meta = element('div', 'sk-display-meta');
  const title = element('span', 'sk-display-title'), credit = element('span', 'sk-display-credit');
  meta.append(title, credit);
  const detail = element('div', 'sk-display-detail');
  let swipe = null;
  visual.addEventListener('pointerdown', e => {
    if (stage.dataset.layout === 'wave' && !e.target.closest('button')) {
      swipe = {x:e.clientX, y:e.clientY, id:e.pointerId};
      visual.setPointerCapture(e.pointerId);
    }
  });
  visual.addEventListener('pointerup', e => {
    if (swipe?.id !== e.pointerId) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (Math.abs(dx)>36 && Math.abs(dx)>Math.abs(dy)*1.5) api.move(dx<0?1:-1);
    swipe = null;
  });
  visual.addEventListener('pointercancel', () => { swipe = null; });
  stage.append(bar, visual, meta, time, main, detail);
  deck.prepend(stage);
  dialog.append(sheet);
  const css = element('link'); css.rel = 'stylesheet'; css.href = '/music-displays.css?v=20261122-displays'; document.head.append(css);
  dialog.classList.add('sk-display-enabled');
  sheet.addEventListener('close', () => { if (dialog.open) launch.focus({preventScroll:true}); });
  sheet.addEventListener('click', e => { if (e.target === sheet && !e.target.closest('.sk-display-sheet-head, .sk-display-choices')) {
    const b = sheet.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) sheet.close();
  }});
  let layout = 'wings', currentCanvas = null, arc = null, toneControls = [], lastKey = '', list = null;
  let frame = 0, visible = true, graph = null, paint = null, selection = 0;
  const gains = [0,0,0,0,0];
  const hasEQ = () => !!(window.AudioContext || window.webkitAudioContext)?.prototype.createBiquadFilter;
  async function prepare() {
    try {
      const ready = await window.DimauMusicVisuals.prepare(audio);
      graph = ready;
      toneControls.forEach(input => { input.disabled = !ready.filters?.length; });
      return ready;
    } catch { return null; }
  }
  function tone(labelText, band) {
    const label = element('label', 'sk-display-band');
    const input = element('input');
    Object.assign(input, {type:'range', min:'-12', max:'12', step:'1', value:String(gains[band])});
    input.disabled = !hasEQ();
    const value = element('output');
    function show() {
      const v = Number(input.value);
      value.textContent = (v > 0 ? '+' : '') + v + ' dB';
      input.setAttribute('aria-valuetext', value.textContent);
    }
    input.setAttribute('aria-label', labelText + ' gain'); show();
    input.addEventListener('input', async () => {
      const requested = Number(input.value); gains[band] = requested; show();
      const active = graph || await prepare();
      if (active?.filters?.[band]) {
        active.filters[band].gain.setTargetAtTime(gains[band], active.context.currentTime, 0.015);
      } else {
        gains[band] = 0; input.value = '0'; show();
        api.say('Tone controls are unavailable for this audio in this browser.');
      }
    });
    label.append(element('span', '', labelText), input, value); toneControls.push(input);
    return label;
  }
  function renderFrame() {
    frame = 0;
    if (!currentCanvas || !visible || document.hidden || !dialog.open) return;
    if (!paint) return;
    paint(currentCanvas, audio, layout);
    if (!audio.paused && !audio.ended && !reducedMotion()) frame = requestAnimationFrame(renderFrame);
  }
  function wake() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (currentCanvas && dialog.open && visible && !document.hidden) frame = requestAnimationFrame(renderFrame);
  }
  if (window.IntersectionObserver) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(stage);
  if (window.ResizeObserver) new ResizeObserver(wake).observe(stage);
  new MutationObserver(wake).observe(dialog, {attributes:true, attributeFilter:['open']});
  document.addEventListener('visibilitychange', wake);
  for (const event of ['playing','pause','ended','loadedmetadata','emptied']) audio.addEventListener(event, wake);
  audio.addEventListener('play', prepare);
  for (const event of ['timeupdate','durationchange','loadedmetadata','emptied']) audio.addEventListener(event, () => arc?.update());
  function card(track, side, pick) {
    const node = pick ? button('sk-display-card sk-display-' + side, '', pick) : element('div', 'sk-display-card sk-display-' + side);
    node.style.setProperty('--photo', picture(track));
    if (pick) node.setAttribute('aria-label', 'Play ' + track.title);
    node.append(element('span', 'sk-display-card-caption', track?.title || 'Island Mix'));
    return node;
  }
  function sync() {
    const selected = api.selected(), entries = queue();
    const track = selected || entries[0]?.track;
    title.textContent = track?.title || 'Your island soundtrack';
    credit.textContent = track?.artist || track?.playlist || (track?.key?.startsWith('dev:') ? 'My music' : 'Island Mix');
    const signature = JSON.stringify([layout, selected?.key, track?.key, ...entries.map(e=>e.track.key)]);
    if (signature !== lastKey) {
      lastKey = signature; stage.style.setProperty('--photo', picture(track));
      if (layout === 'wave') {
        const row = visual.querySelector('.sk-display-cards');
        row.textContent = '';
        const others = entries.filter(e=>e.track.key !== track?.key);
        if (others[1]) row.append(card(others[1].track,'far',others[1].pick));
        if (others[0]) row.append(card(others[0].track,'next',others[0].pick));
        row.append(card(track, 'front'));
      }
      if (list) {
        list.textContent = '';
        for (const item of entries) {
          const b = button('sk-display-queue-item','',item.pick);
          b.append(element('span','sk-display-song', item.track.title),element('span','sk-display-go','↗'));
          list.append(b);
        }
        if (!entries.length) list.textContent = selected ? 'End of queue' : 'Choose a song from the library';
      }
    }
    wake();
  }
  function select(id) {
    const entry = layouts.find(([key]) => key === id) || layouts[0];
    const turn = ++selection;
    delete stage.dataset.arcReady;
    layout = entry[0]; stage.dataset.layout = layout; name.textContent = entry[1];
    for (const choice of choices.children) choice.setAttribute('aria-pressed',String(choice.dataset.layout === layout));
    visual.textContent = ''; detail.textContent = '';
    currentCanvas = null; arc = null; list = null; lastKey = ''; toneControls = [];
    if (layout === 'wings' || layout === 'wave') {
      if (!paint) import('./music-display-visuals.mjs').then(module => { paint = module.draw; wake(); }).catch(() => {});
      currentCanvas = element('canvas', 'sk-display-canvas'); currentCanvas.setAttribute('aria-hidden','true'); visual.append(currentCanvas);
      if (layout === 'wave') visual.append(element('div','sk-display-cards'));
      else {
        visual.append(element('div','sk-display-sleeve'));
        list = element('div','sk-display-queue');
        detail.append(element('span','sk-display-group-name','Up next'), list);
      }
    } else if (layout === 'arc') {
      import('./music-display-arc.mjs').then(({makeArc}) => {
        if (turn !== selection) return;
        arc = makeArc(audio, clock); visual.append(arc.node); stage.dataset.arcReady = 'true';
      }).catch(() => {});
    } else {
      const rack = element('div','sk-display-rack');
      if (layout === 'studio') bands.forEach((label,i) => rack.append(tone(label,i)));
      else for (const [label,i] of [['Bass',0],['Mid',2],['Treble',4]]) rack.append(tone(label,i));
      detail.append(rack);
      if (layout === 'studio') {
        const flat = button('sk-display-flat', 'Reset to flat', () => {
          for (const input of toneControls) {
            input.value = '0';
            input.dispatchEvent(new Event('input'));
          }
        });
        flat.disabled = !hasEQ();
        detail.append(flat);
      }
      if (!hasEQ()) detail.append(element('small','','Tone controls are unavailable in this browser.'));
      if (layout === 'glass') visual.append(element('div','sk-display-glass-photo'));
    }
    sync();
  }
  for (const [id, label] of layouts) {
    const choice = button('sk-display-choice', '', () => {
      select(id); try { localStorage.setItem(storageKey,id); } catch {}
      sheet.close();
    });
    choice.dataset.layout = id;
    const thumbnail = element('span','sk-display-thumb'); thumbnail.setAttribute('aria-hidden','true');
    thumbnail.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    choice.append(thumbnail,element('span','',label)); choices.append(choice);
  }
  let saved; try { saved = localStorage.getItem(storageKey); } catch {}
  select(saved);
  if (!audio.paused) prepare();
  return {sync};
}
