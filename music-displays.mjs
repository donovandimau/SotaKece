import {sleeve} from './music-sleeves.mjs?v=1';
import {waveBrowser} from './music-wave-browser.mjs?v=1';
const layouts = [
  ['wings', 'Equalizer Wings'], ['arc', 'Arc Control'], ['wave', 'Wave Stage'],
  ['glass', 'Frosted Glass'], ['studio', 'Pro Studio EQ']
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
  const actions = element('div', 'sk-display-actions');
  const theatre = element('dialog', 'sk-display-theatre');
  theatre.setAttribute('aria-label','Expanded music player');
  const expand = button('sk-display-expand', '', () => {
    if (theatre.open) { theatre.close(); return; }
    theatre.append(stage); theatre.showModal(); expanded(true); expand.focus();
  });
  function expanded(on) {
    expand.setAttribute('aria-label',on?'Exit expanded player':'Expand player');
    expand.title=expand.getAttribute('aria-label'); expand.setAttribute('aria-expanded',String(on));
    stage.classList.toggle('sk-display-expanded',on);
  }
  expand.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/></svg>';
  actions.append(launch,expand);bar.append(name,actions);
  const visual = element('div', 'sk-display-visual'), meta = element('div', 'sk-display-meta');
  const title = element('span', 'sk-display-title'), credit = element('span', 'sk-display-credit');
  meta.append(title, credit);
  const detail = element('div', 'sk-display-detail');
  stage.append(bar, visual, meta, time, main, detail, sheet);
  deck.prepend(stage);
  deck.append(theatre); expanded(false);
  theatre.addEventListener('close',()=>{deck.prepend(stage);expanded(false);expand.focus({preventScroll:true});wake();});
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (sheet.open) sheet.close();
    if (theatre.open) theatre.close();
  });
  const css = element('link'); css.rel = 'stylesheet'; css.href = '/music-displays.css?v=20261122-phone1'; document.head.append(css);
  dialog.classList.add('sk-display-enabled');
  sheet.addEventListener('close', () => { if (dialog.open) launch.focus({preventScroll:true}); });
  sheet.addEventListener('click', e => { if (e.target === sheet && !e.target.closest('.sk-display-sheet-head, .sk-display-choices')) {
    const b = sheet.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) sheet.close();
  }});
  let layout = 'wings', currentCanvas = null, arc = null, toneControls = [], lastKey = '', list = null;
  let frame = 0, visible = true, graph = null, paint = null, selection = 0, lastDraw = -Infinity;
  let prismCanvas = null, prism = null, fan = null, toneMarker = null;
  let range = 'all', steep = true, activeBand = 2, studioMode='response', probe=null, plotCaption=null;
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
    input.disabled = !hasEQ(); input.dataset.band=String(band);
    const value = element('output');
    function show() {
      const v = Number(input.value);
      value.textContent = (v > 0 ? '+' : '') + v + ' dB';
      input.setAttribute('aria-valuetext', value.textContent);
    }
    input.setAttribute('aria-label', labelText + ' gain'); show();
    input.addEventListener('input', async () => {
      const requested = Number(input.value); gains[band] = requested; activeBand=band; show(); updateToneMarker(); wake();
      const active = graph || await prepare();
      if (active?.filters?.[band]) {
        active.filters[band].gain.setTargetAtTime(gains[band], active.context.currentTime, 0.015);
        wake();
      } else {
        gains[band] = 0; input.value = '0'; show();
        api.say('Tone controls are unavailable for this audio in this browser.');
      }
    });
    label.append(element('span', '', labelText), input, value); toneControls.push(input);
    return label;
  }
  function renderFrame(stamp) {
    frame = 0;
    if (!currentCanvas || !visible || document.hidden || !dialog.open) return;
    const animate = !audio.paused && !audio.ended && !reducedMotion();
    if (stamp-lastDraw>=32 || !animate) {
      lastDraw = stamp;
      if(layout==='glass')prism?.(audio,gains,!reducedMotion());
      else {
        const reading=paint?.draw(currentCanvas,audio,layout,{range,steep,band:activeBand,gains,studioMode,probe});
        if(plotCaption && reading && plotCaption.textContent!==reading)plotCaption.textContent=reading;
      }
    }
    if (animate) frame = requestAnimationFrame(renderFrame);
  }
  function wake() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastDraw = -Infinity;
    if (currentCanvas && dialog.open && visible && !document.hidden) frame = requestAnimationFrame(renderFrame);
  }
  if (window.IntersectionObserver) new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); }).observe(stage);
  if (window.ResizeObserver) new ResizeObserver(wake).observe(stage);
  new MutationObserver(wake).observe(dialog, {attributes:true, attributeFilter:['open']});
  document.addEventListener('visibilitychange', wake);
  for (const event of ['playing','pause','ended','loadedmetadata','emptied']) audio.addEventListener(event, wake);
  audio.addEventListener('play', prepare);
  for (const event of ['timeupdate','durationchange','loadedmetadata','emptied']) audio.addEventListener(event, () => {
    arc?.update();
    if(reducedMotion() && layout==='studio')wake();
  });
  function sync() {
    const selected = api.selected(), entries = queue(layout === 'wave' ? Infinity : 3);
    const track = selected || entries[0]?.track;
    title.textContent = track?.title || 'Your island soundtrack';
    credit.textContent = track?.artist || track?.playlist || (track?.key?.startsWith('dev:') ? 'My music' : 'Island Mix');
    const signature = JSON.stringify([layout, selected?.key, track?.key, ...entries.map(e=>e.track.key)]);
    if (signature !== lastKey) {
      lastKey = signature;
      sleeve(stage,track);
      arc?.setTrack(track);
      if(fan){
        const choices=selected?[{track:selected,pick:()=>{if(!api.live())api.playTrack(api.index());}},...entries.filter(item=>item.track.key!==selected.key)]:entries;
        fan.setItems(choices,selected?.key||'');
      }
      if (list) {
        list.textContent = '';
        for (const item of entries) {
          const b = button('sk-display-queue-item','',item.pick);
          const art=element('span','sk-display-queue-art');sleeve(art,item.track);
          const copy=element('span','sk-display-queue-copy');copy.append(element('span','sk-display-song',item.track.title));
          if(item.track.artist)copy.append(element('small','sk-display-queue-credit',item.track.artist));
          b.append(art,copy,element('span','sk-display-go','↗'));
          list.append(b);
        }
        if (!entries.length) list.textContent = selected ? 'End of queue' : 'Choose a song from the library';
      }
    }
    wake();
  }
  function setGain(index,db){
    const input=toneControls.find(control=>control.dataset.band===String(index));
    if(!input||input.disabled)return;
    input.value=String(Math.max(-12,Math.min(12,Math.round(db))));
    input.dispatchEvent(new Event('input'));
  }
  function updateToneMarker(){
    if(!toneMarker)return;
    toneMarker.style.left=(7+(gains[4]+12)/24*86)+'%';
    toneMarker.style.top=(11+(12-gains[0])/24*69)+'%';
  }
  function bindChart(panel,kind){
    let drag=null;
    const point=e=>{const b=panel.getBoundingClientRect();return [(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height];};
    function move(e){
      if(drag?.id!==e.pointerId)return;
      const [x,y]=point(e);
      if(kind==='studio'&&studioMode==='history'){probe=[x,y];wake();}
      else if(kind==='glass'){setGain(4,(x-.07)/.86*24-12);setGain(0,12-(y-.11)/.69*24);}
      else {const {top,bottom,limit}=paint.plot;setGain(drag.band,2*limit*(.5-(y-top)/(bottom-top)));}
    }
    panel.addEventListener('pointerdown',e=>{
      if(e.button!==0 || (kind==='studio'&&!paint))return;
      const [x]=point(e);
      let band=0;
      if(kind==='studio')for(let i=1;i<5;i++)if(Math.abs(paint.bandPoint(i,0)[0]-x)<Math.abs(paint.bandPoint(band,0)[0]-x))band=i;
      drag={id:e.pointerId,band};panel.setPointerCapture(e.pointerId);move(e);
    });
    panel.addEventListener('pointermove',move);
    panel.addEventListener('lostpointercapture',()=>{drag=null;});
  }
  function makeField(kind) {
    const panel=element('div','sk-display-field');
    panel.setAttribute('role','img');
    panel.setAttribute('aria-label',kind==='studio'?'Frequency response and live spectrum. Use the five gain sliders below to adjust the curve.':'Tone sculpture. Drag horizontally for treble and vertically for bass, or use the tone sliders below.');
    visual.append(panel);
    bindChart(panel,kind);
    return panel;
  }
  function canvasFor(parent){
    const canvas=element('canvas','sk-display-canvas');canvas.setAttribute('aria-hidden','true');parent.append(canvas);return canvas;
  }
  function select(id) {
    const entry = layouts.find(([key]) => key === id) || layouts[0];
    const turn = ++selection;
    delete stage.dataset.arcReady;
    layout = entry[0]; stage.dataset.layout = layout; name.textContent = entry[1];
    for (const choice of choices.children) choice.setAttribute('aria-pressed',String(choice.dataset.layout === layout));
    visual.textContent = ''; detail.textContent = '';
    stage.querySelector('[data-transient]')?.remove();
    arc?.destroy(); currentCanvas = null; fan=null; toneMarker=null; plotCaption=null;
    arc = null; list = null; lastKey = ''; toneControls = [];
    if(layout!=='arc' && layout!=='glass' && !paint)import('./music-display-visuals.mjs?v=instruments').then(module=>{paint=module;wake();}).catch(()=>{});
    if (layout === 'wings' || layout === 'wave') {
      currentCanvas = canvasFor(visual);
      if (layout === 'wave') {
        const surface=element('div','sk-wave-interaction');visual.append(surface);fan=waveBrowser(surface);
        const angle=button('sk-display-angle','',()=>{steep=!steep;updateAngle();wake();});
        function updateAngle(){angle.textContent=steep?'View · Peaks':'View · Low tide';angle.setAttribute('aria-label',steep?'Switch to low perspective':'Switch to high perspective');}
        updateAngle();visual.append(angle);
      }
      else {
        const currentArt=element('div','sk-display-edition');
        const disc=element('div','sk-display-vinyl');
        const sleeve=element('div','sk-display-sleeve');
        currentArt.append(disc,sleeve);visual.append(currentArt);
        const bands=element('div','sk-display-ranges');bands.setAttribute('role','group');bands.setAttribute('aria-label','Spectrum frequency range');
        for (const [id,label] of [['all','Full'],['bass','Bass'],['mid','Mid'],['air','Air']]){
          const b=button('sk-display-range',label,()=>{range=id;for(const opt of bands.children)opt.setAttribute('aria-pressed',String(opt===b));wake();});
          b.setAttribute('aria-pressed',String(range===id));bands.append(b);
        }
        visual.append(bands);
        list = element('div','sk-display-queue');
        detail.append(element('span','sk-display-group-name','Up next'), list);
      }
    } else if (layout === 'arc') {
      import('./music-display-arc.mjs?v=phone1').then(({makeArc}) => {
        if (turn !== selection) return;
        arc = makeArc(audio, clock); visual.append(arc.node);detail.append(arc.info);arc.setTrack(api.selected()||queue()[0]?.track);stage.dataset.arcReady = 'true';
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
      const field=makeField(layout);
      if (layout==='studio'){
        currentCanvas=canvasFor(field);
        plotCaption=element('span','sk-display-chart-label');field.append(plotCaption);
        const modes=element('div','sk-display-chart-modes');
        for(const [mode,text] of [['response','EQ curve'],['history','Spectrogram']]){
          const opt=button('sk-display-chart-mode',text,()=>{studioMode=mode;probe=null;setMode();wake();});
          opt.dataset.mode=mode;modes.append(opt);
        }
        function setMode(){
          for(const opt of modes.children)opt.setAttribute('aria-pressed',String(opt.dataset.mode===studioMode));
          plotCaption.textContent=studioMode==='response'?'Filter response · dB':'Frequency history · touch to inspect';
          field.setAttribute('aria-label',studioMode==='response'?'Drag a frequency handle to change its gain or use the sliders below.':'Spectrogram of recently measured audio, oldest at the top. Touch to inspect a frequency.');
        }
        setMode();visual.before(modes);modes.dataset.transient='true';
      }else {
        if(!prismCanvas)prismCanvas=canvasFor(field);else field.append(prismCanvas);
        currentCanvas=prismCanvas;
        if(!prism)import('./music-display-prism.mjs?v=instruments').then(({createPrism})=>{if(!prism)prism=createPrism(prismCanvas);wake();}).catch(()=>{});
        field.append(element('span','sk-display-field-x','Treble →'),element('span','sk-display-field-y','Bass ↑'));
        toneMarker=element('i','sk-display-point');field.append(toneMarker);updateToneMarker();
      }
    }
    sync();
  }
  for (const [id, label] of layouts) {
    const choice = button('sk-display-choice', '', () => {
      select(id); try { localStorage.setItem(storageKey,id); } catch {}
      sheet.close();
    });
    choice.dataset.layout = id;
    const thumbnail = element('img');
    thumbnail.alt = ''; thumbnail.loading = 'lazy';
    thumbnail.width = 216; thumbnail.height = 164;
    thumbnail.src = '/assets/music-instruments/' + id + '.webp';
    choice.append(thumbnail,element('span','',label)); choices.append(choice);
  }
  let saved; try { saved = localStorage.getItem(storageKey); } catch {}
  let requested=null;try{requested=new URL(location.href).searchParams.get('music-display');}catch{}
  const deepLink=layouts.some(([id])=>id===requested);
  select(deepLink?requested:saved);
  if(deepLink && dialog.open)expand.click();
  if (!audio.paused) prepare();
  return {sync};
}
