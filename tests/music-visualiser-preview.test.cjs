'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../music-visualiser.js'),'utf8');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch{}
const run=(name,fn)=>test(name,{skip:!JSDOM&&'Optional jsdom is not installed'},fn),flush=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};
function context(){const calls=[];const gradient={addColorStop(){}};const ctx={calls,save(){},restore(){},createLinearGradient:()=>gradient,createRadialGradient:()=>gradient};for(const key of ['fillRect','beginPath','moveTo','lineTo','stroke','arc','fill','fillText'])ctx[key]=(...args)=>calls.push([key,...args]);return ctx;}
function fixture({reduced=false,saveData=false,pausedPreference=false}={}){
 const dom=new JSDOM('<!doctype html><body><audio id="music" src="/song.mp3"></audio></body>',{url:'https://sotakece.com/',runScripts:'outside-only'}),w=dom.window,d=w.document,frames=new Map(),observers=[],motionListeners=new Set(),ctx=context();let frameId=0,contexts=0,sources=0,plays=0,mediaPaused=true,ready=4,hidden=false,fullscreen=null,modal=null;
 const queryAll=d.querySelectorAll.bind(d);d.querySelectorAll=selector=>selector==='dialog:modal'?(modal?[modal]:[]):queryAll(selector);
 Object.defineProperty(d,'hidden',{get:()=>hidden});Object.defineProperty(d,'fullscreenElement',{get:()=>fullscreen});Object.defineProperty(w.navigator,'connection',{value:{saveData}});
 w.matchMedia=()=>({matches:reduced,addEventListener(_,fn){motionListeners.add(fn);},removeEventListener(_,fn){motionListeners.delete(fn);}});
 w.requestAnimationFrame=fn=>{const id=++frameId;frames.set(id,fn);return id;};w.cancelAnimationFrame=id=>frames.delete(id);
 w.ResizeObserver=class{constructor(fn){this.fn=fn;}observe(){}disconnect(){}};w.IntersectionObserver=class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){}};
 w.HTMLCanvasElement.prototype.getContext=()=>ctx;w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({width:600,height:220});
 w.HTMLElement.prototype.getClientRects=function(){if(this.closest('dialog')&&!this.closest('dialog').open)return [];return [{width:600,height:300}];};
 const audio=d.getElementById('music');Object.defineProperties(audio,{paused:{get:()=>mediaPaused},ended:{get:()=>false},readyState:{get:()=>ready}});audio.play=async()=>{plays++;mediaPaused=false;audio.dispatchEvent(new w.Event('play'));audio.dispatchEvent(new w.Event('playing'));};audio.pause=()=>{mediaPaused=true;audio.dispatchEvent(new w.Event('pause'));};
 w.AudioContext=class{constructor(){contexts++;this.state='suspended';this.sampleRate=48000;this.destination={speaker:true};}async resume(){this.state='running';}createAnalyser(){return {fftSize:2048,frequencyBinCount:1024,getByteFrequencyData:a=>a.fill(96),getByteTimeDomainData:a=>a.fill(128)};}createMediaElementSource(){sources++;return {connect(){}};}};
 if(pausedPreference)w.localStorage.setItem('dimau.music.visuals.v1',JSON.stringify({paused:true}));
 w.eval(source);const visual=d.createElement('dimau-music-visualiser');visual.setAttribute('for','music');d.body.append(visual);
 return {w,d,dom,visual,audio,ctx,frames,api:w.DimauMusicVisuals,buffer(value){ready=value;audio.dispatchEvent(new w.Event(value<3?'waiting':'playing'));},counters:()=>({contexts,sources,plays}),step(time){const pending=[...frames];frames.clear();pending.forEach(([,fn])=>fn(time));},visibility(value){hidden=value;d.dispatchEvent(new w.Event('visibilitychange'));},intersect(value){observers.forEach(o=>o.fn([{isIntersecting:value}]));},motion(value){for(const listener of motionListeners){visual.motion.matches=value;listener();}},modal(value){modal=value;},fullscreen(value){fullscreen=value;d.dispatchEvent(new w.Event('fullscreenchange'));},close(){visual.remove();dom.window.close();}};
}
test('preview renderer varies all five modes without media and real silence remains real silence',()=>{
 const root={Float32Array,Uint8Array,URL,WeakMap,Math,Number,Blob,DOMException};vm.runInNewContext(source,root);const api=root.DimauMusicVisuals;
 assert.equal(api.modes.length,5);assert.equal(Object.keys(api.palettes).length,5);
 assert(api.previewSpectrum(0).some(n=>n>.3));assert.notDeepEqual([...api.previewSpectrum(0)],[...api.previewSpectrum(1000)]);
 for(const mode of api.modes){const first=context(),next=context();api.draw(first,600,220,{mode},{previewTime:0},null,false);api.draw(next,600,220,{mode},{previewTime:1000},null,false);assert.notDeepEqual(first.calls,next.calls,mode+' has moving preview geometry');}
 const silent=context();api.draw(silent,600,220,{mode:'spectrum'},{previewTime:1000},{frequency:new Uint8Array(1024),context:{sampleRate:48000}},false);const bars=silent.calls.filter(c=>c[0]==='fillRect').filter((_,i)=>i%3===0);assert(bars.every(c=>c[4]===1));
});
run('mounted visualiser animates Preview by default without playing audio or creating Web Audio',()=>{
 const f=fixture();try{assert.equal(f.visual.enabled,true);assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'Preview');assert.equal(f.visual.shadowRoot.querySelector('.toggle').textContent,'Pause visuals');assert.equal(f.frames.size,1);const before=f.ctx.calls.slice();f.step(60);assert.notDeepEqual(f.ctx.calls,before);assert(f.visual.drawState.previewTime>0);assert.deepEqual(f.counters(),{contexts:0,sources:0,plays:0});}finally{f.close();}
});
run('real playback becomes reactive and pausing audio returns to animated Preview',async()=>{
 const f=fixture();try{await f.audio.play();await flush();assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'LIVE AUDIO');assert.deepEqual(f.counters(),{contexts:1,sources:1,plays:1});f.audio.pause();assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'Preview');assert.equal(f.frames.size,1);f.step(150);assert.equal(f.visual.drawState.preview,true);assert.equal(f.counters().sources,1);}finally{f.close();}
});
run('explicit Pause is kept after reconnect and Resume needs no audio',async()=>{
 const f=fixture();try{await f.visual.toggle();assert.equal(f.visual.enabled,false);assert.equal(f.frames.size,0);assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'Motion paused');f.visual.remove();f.d.body.append(f.visual);assert.equal(f.visual.enabled,false);assert.equal(f.frames.size,0);await f.visual.toggle();assert.equal(f.visual.enabled,true);assert.equal(f.frames.size,1);assert.deepEqual(f.counters(),{contexts:0,sources:0,plays:0});}finally{f.close();}
});
run('reduced motion, hidden documents and offscreen states stop preview frames',async()=>{
 const reduced=fixture({reduced:true});try{assert.equal(reduced.frames.size,0);assert.equal(reduced.visual.shadowRoot.querySelector('.state').textContent,'Reduced motion');await reduced.visual.toggle();assert.equal(reduced.frames.size,0);assert.equal(reduced.counters().contexts,0);}finally{reduced.close();}
 const f=fixture();try{f.visibility(true);assert.equal(f.frames.size,0);f.visibility(false);assert.equal(f.frames.size,1);f.intersect(false);assert.equal(f.frames.size,0);f.intersect(true);assert.equal(f.frames.size,1);}finally{f.close();}
});
run('low-data previews run at eight drawn frames per second and recording still requires real music',async()=>{
 const f=fixture({saveData:true});try{const initial=f.ctx.calls.length;f.step(60);assert.equal(f.ctx.calls.length,initial);f.step(130);assert(f.ctx.calls.length>initial);await f.visual.record(15);assert.match(f.visual.shadowRoot.querySelector('.note').textContent,/play your music before recording/);assert.deepEqual(f.counters(),{contexts:0,sources:0,plays:0});}finally{f.close();}
});
run('an unrelated modal pauses the preview and closing it resumes the same visualiser',async()=>{
 const f=fixture();try{const modal=f.d.createElement('dialog');modal.innerHTML='<button>Account</button>';f.d.body.append(modal);f.modal(modal);modal.setAttribute('open','');modal.querySelector('button').focus();await flush();assert.equal(f.frames.size,0);f.modal(null);modal.removeAttribute('open');await flush();assert.equal(f.frames.size,1);assert.equal(f.counters().sources,0);}finally{f.close();}
});
run('fullscreen has a reachable exit cross only while the shared widget owns fullscreen',async()=>{
 const f=fixture();try{const exit=f.visual.shadowRoot.querySelector('.fullscreen-exit');assert.equal(exit.hidden,true);let exits=0;f.d.exitFullscreen=async()=>{exits++;f.fullscreen(null);};f.fullscreen(f.visual);assert.equal(exit.hidden,false);assert.equal(exit.getAttribute('aria-label'),'Exit fullscreen music visualiser');exit.click();await flush();assert.equal(exits,1);assert.equal(exit.hidden,true);}finally{f.close();}
});

run('reconnecting the same visualiser rebinds its unchanged media element',async()=>{
 const f=fixture();try{f.visual.remove();f.d.body.append(f.visual);await f.audio.play();await flush();assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'LIVE AUDIO');assert.equal(f.counters().sources,1);f.audio.pause();assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'Preview');assert.equal(f.frames.size,1);}finally{f.close();}
});

run('buffering is labelled Preview and returning audio is labelled Live again',async()=>{
 const f=fixture();try{await f.audio.play();await flush();assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'LIVE AUDIO');f.buffer(2);assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'Preview');assert.equal(f.visual.drawState.preview,true);assert.equal(f.frames.size,1);f.buffer(4);assert.equal(f.visual.shadowRoot.querySelector('.state').textContent,'LIVE AUDIO');assert.equal(f.visual.drawState.preview,false);assert.equal(f.counters().sources,1);}finally{f.close();}
});
