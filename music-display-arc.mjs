import {analyseWave, savedWave} from './music-waveform.mjs?v=1';
const clamp = (value, max=1) => Math.max(0, Math.min(max, value));
const point = (radius, fraction) => {
  const angle = Math.PI * (1 - fraction);
  return [(120 + radius * Math.cos(angle)).toFixed(2), (115 - radius * Math.sin(angle)).toFixed(2)];
};
function waveformPath(peaks, start, span) {
  const count = 112, lines = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(peaks.length * (start + span * i / count));
    const end = Math.min(peaks.length, Math.max(index + 1, Math.floor(peaks.length * (start + span * (i + 1) / count))));
    let sum = 0;
    for (let p = index; p < end; p++) sum += peaks[p];
    const level = sum / Math.max(1, end - index) / 255;
    const u = (i + .5) / count;
    lines.push('M' + point(79, u).join(' ') + 'L' + point(81 + 21 * level, u).join(' '));
  }
  return lines.join('');
}
export function makeArc(audio, clock) {
  const arc = document.createElement('div');
  arc.className = 'sk-display-arc';
  arc.setAttribute('role','slider'); arc.setAttribute('aria-label','Seek through song');
  arc.setAttribute('aria-valuemin','0'); arc.setAttribute('aria-valuemax','100');
  const ticks = Array.from({length:31},(_,i) => 'M'+point(74,i/30).join(' ')+'L'+point(i%5?72:69,i/30).join(' ')).join('');
  arc.innerHTML = '<svg viewBox="0 0 240 124" preserveAspectRatio="none" aria-hidden="true"><path class="arc-scale"/><path class="arc-wave"/><path class="arc-rail" d="M12 115 A108 108 0 0 1 228 115"/><path class="sk-display-arc-fill" pathLength="100" d="M12 115 A108 108 0 0 1 228 115"/><line class="arc-needle" x1="120" y1="115"/><circle r="4"/></svg><span class="sk-dial-readout" aria-hidden="true"><b></b><small></small></span>';
  const find = selector => arc.querySelector(selector);
  function endpoint(x,anchor){
    const text=document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x',x);text.setAttribute('y','122');text.setAttribute('text-anchor',anchor);
    find('svg').append(text);return text;
  }
  const leftTime=endpoint('6','start'),rightTime=endpoint('234','end');
  find('.arc-scale').setAttribute('d',ticks);
  const wave = find('.arc-wave'), hand=find('line'), dot=find('circle'), fill=find('.sk-display-arc-fill');
  const time=find('b'), sub=find('small');
  const info=document.createElement('div'); info.className='sk-arc-info';
  const overview=document.createElement('div');overview.className='sk-arc-overview';overview.hidden=true;
  overview.innerHTML='<span>Track overview</span><svg viewBox="0 0 300 34" preserveAspectRatio="none" aria-hidden="true"><path/><rect width="75" height="34"/><line y1="0" y2="34"/></svg>';
  const strip=overview.querySelector('path'),windowMark=overview.querySelector('rect'),cursor=overview.querySelector('line');
  const status=document.createElement('span'); status.setAttribute('role','status');
  const load=document.createElement('button');load.type='button';load.textContent='Load waveform';load.hidden=true;
  info.append(overview,status,load);
  let data=null, track=null, request=null, drag=null;
  const enabled=()=>Number.isFinite(audio.duration)&&audio.duration>0;
  function drawWave() {
    wave.setAttribute('d',data?waveformPath(data.peaks,drag?.start||0,drag?.span||1):'');
    arc.dataset.wave= data?'ready':'empty';
  }
  function update() {
    const seconds=drag?drag.target*audio.duration:audio.currentTime;
    const fraction=enabled()?clamp(seconds/audio.duration):0;
    const duration=enabled()?audio.duration:data?.duration;
    leftTime.textContent=duration?clock((drag?.start||0)*duration):'';
    rightTime.textContent=duration?clock((drag?drag.start+drag.span:1)*duration):'';
    if(data){
      const tip=enabled()?'Touch the waveform · drag sideways for fine seeking':'Press Play to seek through the waveform';
      if(status.textContent!==tip)status.textContent=tip;
    }
    const position=drag?clamp((fraction-drag.start)/drag.span):fraction;
    cursor.setAttribute('x1',String(fraction*300));cursor.setAttribute('x2',String(fraction*300));
    windowMark.style.display=drag?'':'none';
    if(drag)windowMark.setAttribute('x',String(drag.start*300));
    const [cx,cy]=point(108,position),[hx,hy]=point(77,position);
    dot.setAttribute('cx',cx);dot.setAttribute('cy',cy);
    hand.setAttribute('x2',hx);hand.setAttribute('y2',hy);
    fill.style.strokeDasharray=(100*position)+' 100';
    time.textContent=clock(seconds);
    sub.textContent=drag?'4× fine seek':enabled()?Math.round(fraction*100)+'% played':'Track position';
    arc.setAttribute('aria-valuenow',String(Math.round(fraction*100)));
    arc.setAttribute('aria-valuetext',clock(seconds)+' of '+clock(audio.duration));
    arc.setAttribute('aria-disabled',String(!enabled())); arc.tabIndex=enabled()?0:-1;
  }
  function ready(value) {
    data=value;overview.hidden=false;
    const bars=[];
    for(let i=0;i<150;i++){
      const height=1+value.peaks[Math.floor(i*value.peaks.length/150)]/255*15;
      bars.push('M'+(i*2+1)+' '+(17-height).toFixed(1)+'v'+(height*2).toFixed(1));
    }
    strip.setAttribute('d',bars.join(''));drawWave();update();
    load.hidden=true;
  }
  async function analyse() {
    const signal=request.signal;
    load.hidden=true;status.textContent='Reading the waveform…';
    try {
      const value=await analyseWave(track,signal);
      if(!signal.aborted && value)ready(value);
    } catch {
      if(signal.aborted)return;
      status.textContent='Waveform unavailable. The dial still seeks.';load.hidden=false;
    }
  }
  load.addEventListener('click',analyse);
  async function setTrack(next) {
    if(next?.key===track?.key)return;
    request?.abort(); request=new AbortController(); const signal=request.signal;
    drag=null;track=next;data=null;overview.hidden=true;drawWave();update();load.hidden=true;
    if(!next){status.textContent='Choose a track';return;}
    status.textContent='Reading the waveform…';
    const saved=await savedWave(next,signal);
    if(signal.aborted)return;
    if(saved){ready(saved);return;}
    if(!next.blob && (navigator.connection?.saveData || (next.size||0)>18*1024*1024)){
      status.textContent='Full-track waveform';load.hidden=false;return;
    }
    await analyse();
  }
  function locationOnDial(e) {
    const b=arc.getBoundingClientRect();
    const x=(e.clientX-b.left)/b.width*240-120;
    const y=Math.max(0,115-(e.clientY-b.top)/b.height*124);
    return clamp(1-Math.atan2(y,x)/Math.PI);
  }
  arc.addEventListener('pointerdown',e=>{
    if(!enabled()||e.button!==0||drag)return;
    const anchor=locationOnDial(e),span=.25,start=clamp(anchor-span/2,1-span);
    drag={id:e.pointerId,anchor,target:anchor,start,span,x:e.clientX,width:arc.getBoundingClientRect().width};
    arc.setPointerCapture(e.pointerId);drawWave();update();
  });
  function move(e){
    if(!drag||e.pointerId!==drag.id)return;
    drag.target=Math.min(drag.start+drag.span, Math.max(drag.start,drag.anchor+(e.clientX-drag.x)/drag.width*drag.span));
    update();
  }
  arc.addEventListener('pointermove',move);
  arc.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    move(e);const target=drag.target;drag=null;
    if(enabled())audio.currentTime=target*audio.duration;
    drawWave();update();
  });
  arc.addEventListener('lostpointercapture',()=>{if(drag){drag=null;drawWave();update();}});
  arc.addEventListener('keydown',e=>{
    if(!enabled())return;
    const step=e.shiftKey ? .5 : 5;
    const positions={Home:0,End:audio.duration,ArrowLeft:audio.currentTime-step,ArrowDown:audio.currentTime-step,ArrowRight:audio.currentTime+step,ArrowUp:audio.currentTime+step};
    if(!(e.key in positions))return;
    e.preventDefault();audio.currentTime=clamp(positions[e.key],audio.duration);update();
  });
  update();
  return {node:arc,info,update,setTrack,destroy(){request?.abort();drag=null;}};
}
