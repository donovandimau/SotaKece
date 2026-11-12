/* Playback indicators and page lighting share the existing players and analyser. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(root);
  else if(root.SotaMusicBadge?.install)root.SotaMusicBadge.install();
  else{root.SotaMusicBadge=factory(root);root.SotaMusicBadge.install();}
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const events=['play','playing','waiting','stalled','pause','ended','error','emptied'];
  const eligible=audio=>audio?.tagName==='AUDIO'&&['sota-playlist-audio','sota-local-audio'].includes(audio.id);
  const healthy=audio=>eligible(audio)&&!audio.paused&&!audio.ended&&!audio.error;
  let document=null,current=null,installed=false,phases=new WeakMap(),cleanup=[],unbind=()=>{};
  let lights=true,theme="rainbow",motion=null,overlay=null,frame=0,last=0,low=0,high=0;
  const show=playing=>document?.documentElement?.classList.toggle('sota-music-playing',!!playing);
  const playing=()=>!document.hidden&&healthy(current)&&phases.get(current)==='playing';

  function updateControls(){
    document?.querySelectorAll('[data-sota-lights-toggle]').forEach(button=>{
      button.disabled=false;
      button.setAttribute('aria-pressed',String(lights));
      const words='Page lights: '+(lights?'On':'Off');
      // An icon-only switch (the mini-player) keeps its symbol; the words become its name.
      if(button.dataset.sotaLightsToggle==='icon'){button.setAttribute('aria-label',words);button.title=words;}
      else button.textContent=words;
    });
  }
  function paintColours(){
    if(!overlay)return;
    const colours=root.DimauMusicVisuals?.palettes?.[theme];
    if(!colours)return;
    const selected=theme==='rainbow'?[colours[1],colours[9],colours[5],colours[7]]:[colours[0],colours[2],colours[1],colours[0]];
    ['bass-a','bass-b','mid-a','mid-b'].forEach((name,i)=>overlay.style.setProperty('--sota-light-'+name,selected[i]));
  }
  function paletteChanged(event){
    const next=event.detail?.theme;
    if(next===theme||!root.DimauMusicVisuals?.palettes?.[next])return;
    theme=next;paintColours();
  }
  function prepare(audio){
    if(!lights||!eligible(audio)||!(audio.currentSrc||audio.getAttribute('src')))return;
    root.DimauMusicVisuals?.prepare?.(audio)?.catch(()=>{});
  }
  function clearLights(){
    if(frame)root.cancelAnimationFrame?.(frame);
    frame=0;last=0;low=0;high=0;
    overlay?.remove();overlay=null;
  }
  function band(frequency,rate,min,max){
    const scale=frequency.length*2/rate;
    const first=Math.max(0,Math.floor(min*scale)),end=Math.min(frequency.length,Math.ceil(max*scale));
    let total=0;
    for(let i=first;i<end;i++)total+=frequency[i];
    return end>first?total/(255*(end-first)):0;
  }
  function animate(time){
    frame=0;
    if(!installed||!lights||!playing()||!document.body?.classList.contains('sx-enabled')){
      clearLights();return;
    }
    if(!last||time-last>=42){
      last=time;
      const sample=root.DimauMusicVisuals?.sample?.(current);
      if(sample?.context?.state==='running'&&sample.frequency?.length){
        if(!overlay){
          overlay=document.createElement('div');
          overlay.className='sota-page-lights';
          overlay.setAttribute('aria-hidden','true');
          document.body.append(overlay);
          paintColours();
        }
        const rate=sample.context.sampleRate||48000;
        low+=(band(sample.frequency,rate,45,180)-low)*.26;
        high+=(band(sample.frequency,rate,450,3500)-high)*.22;
        overlay.style.setProperty('--sota-bass-light',(low*.82).toFixed(3));
        overlay.style.setProperty('--sota-mid-light',(high*.72).toFixed(3));
      }else if(overlay){
        overlay.remove();overlay=null;low=0;high=0;
      }
    }
    frame=root.requestAnimationFrame(animate);
  }
  function sync(){
    const active=playing();
    show(active);
    if(active&&lights&&document.body?.classList.contains('sx-enabled')&&root.requestAnimationFrame){
      if(!frame)frame=root.requestAnimationFrame(animate);
    }else clearLights();
  }
  function changeLights(event){
    const button=event.target.closest?.('[data-sota-lights-toggle]');
    if(!button)return;
    lights=!lights;
    try{root.localStorage.setItem('sota.page-lights',lights?'on':'off');}catch{}
    if(lights&&playing())prepare(current);
    updateControls();sync();
  }
  // Phones only let sound analysis start from a tap, so each tap wakes it.
  function gesture(){
    if(!installed||!lights)return;
    const audio=[current,...document.querySelectorAll('#sota-playlist-audio,#sota-local-audio')].find(a=>eligible(a)&&(a.currentSrc||a.getAttribute('src')));
    if(audio)prepare(audio);
  }
  function bind(audio){
    if(current===audio)return;
    if(current)phases.set(current,'superseded');
    unbind();current=audio;
    // Local music can keep playing after its dialog is removed. Direct
    // listeners still observe that audio when document capture cannot.
    for(const event of events)audio.addEventListener(event,media);
    unbind=()=>{for(const event of events)audio.removeEventListener(event,media);};
  }
  function media(event){
    const audio=event.target;if(!installed||!eligible(audio))return;
    if((event.type==='play'||event.type==='playing')&&lights)prepare(audio);
    if(event.type==='playing'&&healthy(audio)){
      bind(audio);phases.set(audio,'playing');sync();
    }else if(event.type==='stalled'&&audio===current&&healthy(audio)&&audio.readyState>=3&&phases.get(audio)==='playing'){
      // Downloading may stall while buffered audio continues playing.
      sync();
    }else{
      phases.set(audio,event.type==='play'?'pending':'blocked');
      if(audio===current)sync();
    }
  }
  function restore(){
    if(document.hidden){show(false);clearLights();return;}
    const candidates=[current,...document.querySelectorAll('#sota-playlist-audio,#sota-local-audio')];
    const audio=candidates.find(item=>healthy(item)&&item.readyState>=3&&(!phases.has(item)||phases.get(item)==='playing'));
    if(audio){bind(audio);phases.set(audio,'playing');sync();}else{show(false);clearLights();}
  }
  function release(){
    (document||root.document)?.documentElement?.classList.remove('sota-music-playing');
    installed=false;clearLights();unbind();unbind=()=>{};
    cleanup.forEach(fn=>fn());cleanup=[];current=null;document=null;phases=new WeakMap();
  }
  function install(){
    if(installed)return release;
    document=root.document;
    if(!document?.documentElement||!document.addEventListener){document=null;return release;}
    installed=true;
    try{
      lights=root.localStorage?.getItem('sota.page-lights')!=='off';
      theme=JSON.parse(root.localStorage?.getItem('dimau.music.visuals.v1')||'null')?.theme||'rainbow';
    }catch{lights=true;theme='rainbow';}
    motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
    // Reduced motion only sets the starting choice; the switch always works.
    try{if(!root.localStorage?.getItem('sota.page-lights')&&motion?.matches)lights=false;}catch{}
    const motionChanged=()=>{updateControls();sync();};
    motion?.addEventListener?.('change',motionChanged);
    cleanup.push(()=>motion?.removeEventListener?.('change',motionChanged));
    document.addEventListener('visualchange',paletteChanged);
    cleanup.push(()=>document.removeEventListener('visualchange',paletteChanged));
    document.addEventListener('click',changeLights);
    for(const [type,capture] of [['pointerup',true],['touchend',true],['click',false],['keydown',true]]){
      document.addEventListener(type,gesture,capture);
      cleanup.push(()=>document.removeEventListener(type,gesture,capture));
    }
    cleanup.push(()=>document.removeEventListener('click',changeLights));
    for(const event of events){
      document.addEventListener(event,media,true);
      cleanup.push(()=>document.removeEventListener(event,media,true));
    }
    document.addEventListener('visibilitychange',restore);
    cleanup.push(()=>document.removeEventListener('visibilitychange',restore));
    updateControls();restore();return release;
  }
  return {install,release,prepare,updateControls};
});
