'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch{}
const base=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(base,'music-playlist.js'),'utf8'),fallback=JSON.parse(fs.readFileSync(path.join(base,'music-playlist.json'),'utf8'));
const boundary="import('/shared-music/core.mjs')";assert(source.includes(boundary),'only intercept the actual local module import boundary');
const coreUrl=pathToFileURL(path.join(base,'shared-music/core.mjs')).href;
const rows=()=>fallback.map((t,i)=>({...t,size:100+i,type:'audio/mpeg'}));
const remote=(tracks=rows())=>({version:1,tracks});
const extra={id:'fiji-song-2026-82',title:'New central recording',path:'fiji-song-82.mp3',size:1234,type:'audio/mpeg'};
const tick=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const domTest=(name,fn)=>test(name,{skip:!JSDOM?'Install jsdom or set JSDOM_MODULE for DOM integration':false},fn);
let serial=0;
async function harness(){
  const dom=new JSDOM('<!doctype html><body><button data-playlist-open>Music</button><audio id="local"></audio>',{url:'https://sotakece.test/',runScripts:'outside-only'}),w=dom.window,calls=[],plays=[],state=new WeakMap(),storage=new Map(),old={fetch:global.fetch,localStorage:Object.getOwnPropertyDescriptor(global,'localStorage')};
  let value=remote(),offline=false,clock=Date.now();const oldNow=Date.now;Date.now=()=>clock;
  Object.defineProperty(global,'localStorage',{configurable:true,value:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
  const fetch=async(url,opts)=>{calls.push({url,opts});if(String(url).startsWith('/music-playlist.json'))return{ok:true,json:async()=>fallback};if(offline)throw Error('offline');return{ok:true,json:async()=>value};};
  global.fetch=fetch;w.fetch=fetch;
  const media=a=>{if(!state.has(a))state.set(a,{paused:true,ended:false,error:null});return state.get(a);};
  for(const key of ['paused','ended','error'])Object.defineProperty(w.HTMLMediaElement.prototype,key,{get(){return media(this)[key];}});
  w.HTMLMediaElement.prototype.pause=function(){media(this).paused=true;this.dispatchEvent(new w.Event('pause'));};
  w.HTMLMediaElement.prototype.play=function(){media(this).paused=false;plays.push(this.getAttribute('src'));this.dispatchEvent(new w.Event('play'));this.dispatchEvent(new w.Event('playing'));return Promise.resolve();};
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  const core=await import(coreUrl+'?native-test='+ ++serial);w.__sharedImport=async()=>core;
  w.eval(source.replace(boundary,'root.__sharedImport()'));w.SotaPlaylist.mount(w.document);
  return{w,calls,plays,storage,core,set value(v){value=v;},set offline(v){offline=v;},async open(){w.SotaPlaylist.open();await tick();},async refresh(){w.document.querySelector('.sk-playlist-close').click();clock+=300001;await this.open();},close(){w.close();Date.now=oldNow;global.fetch=old.fetch;if(old.localStorage)Object.defineProperty(global,'localStorage',old.localStorage);else delete global.localStorage;}};
}
domTest('native playlist stays silent before intent and accepts central additions exactly once',async()=>{
  const h=await harness();try{assert.equal(h.calls.length,0);h.value=remote([...rows(),extra]);await h.open();assert.equal(h.calls.length,1);assert.equal(h.plays.length,0);const picks=h.w.document.querySelectorAll('[data-track-index]');assert.equal(picks.length,83);assert.equal([...picks].filter(b=>b.querySelector('.sk-playlist-song-title').textContent==='Laffy Taffy'&&b.querySelector('.sk-playlist-song-artist').textContent==='Raxz Tunez Mokubasi Remix').length,1);assert(picks[82].textContent.includes(extra.title));picks[82].click();await tick();assert.equal(h.plays.at(-1),'https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/fiji-audio/'+extra.path);}finally{h.close();}
});
domTest('a valid central replacement is authoritative and does not merge the historical fallback',async()=>{
  const h=await harness();try{h.value=remote([rows()[0],extra]);await h.open();assert.equal(h.w.document.querySelectorAll('[data-track-index]').length,2);assert.equal(h.calls.filter(c=>String(c.url).startsWith('/music-playlist.json')).length,0);}finally{h.close();}
});
domTest('catalogue refresh preserves selected identity, audio position and native player across reordering',async()=>{
  const h=await harness();try{h.value=remote([rows()[0],extra]);await h.open();h.w.document.querySelector('[data-track-index="1"]').click();await tick();const audio=h.w.document.querySelector('#sota-playlist-audio');audio.currentTime=42;const playCount=h.plays.length;h.value=remote([extra,rows()[0]]);await h.refresh();assert.equal(h.w.document.querySelector('#sota-playlist-audio'),audio);assert.equal(audio.currentTime,42);assert.equal(h.plays.length,playCount);assert.equal(h.w.document.querySelector('[aria-current="true"]').dataset.trackIndex,'0');assert.match(h.w.document.querySelector('.sk-playlist-title').textContent,/New central/);}finally{h.close();}
});
domTest('network failure keeps the last validated central queue and never replaces it with known82',async()=>{
  const h=await harness();try{h.value=remote([extra]);await h.open();h.offline=true;await h.refresh();assert.equal(h.w.document.querySelectorAll('[data-track-index]').length,1);assert.match(h.w.document.querySelector('[data-track-index]').textContent,/New central/);assert.equal(h.calls.filter(c=>String(c.url).startsWith('/music-playlist.json')).length,0);assert.match(h.w.document.querySelector('.sk-playlist-status').textContent,/Saved playlist/);}finally{h.close();}
});
domTest('refresh never replaces audible media, while an explicit replay uses an updated public mapping',async()=>{
  const h=await harness();try{h.value=remote([extra]);await h.open();h.w.document.querySelector('[data-track-index]').click();await tick();const audio=h.w.document.querySelector('#sota-playlist-audio'),oldSrc=audio.getAttribute('src'),plays=h.plays.length;h.value=remote([{...extra,path:'fiji-song-83.mp3'}]);await h.refresh();assert.equal(audio.getAttribute('src'),oldSrc);assert.equal(h.plays.length,plays);h.w.document.querySelector('[data-track-index]').click();await tick();assert.equal(audio.getAttribute('src'),h.core.AUDIO_BASE+'fiji-song-83.mp3');assert.equal(h.plays.length,plays+1);}finally{h.close();}
});
domTest('a cold failure uses the original known82 fallback without autoplay or private access',async()=>{
  const h=await harness();try{h.offline=true;await h.open();assert.equal(h.w.document.querySelectorAll('[data-track-index]').length,82);assert.equal(h.plays.length,0);assert.equal(h.calls.length,2);assert.equal(h.calls[0].opts.credentials,'omit');assert(h.calls.every(c=>!c.opts.headers));assert.match(h.w.document.querySelector('.sk-playlist-status').textContent,/Saved playlist/);}finally{h.close();}
});
domTest('invalid central media cannot enter the native queue and local media retains playback coordination',async()=>{
  const h=await harness();try{h.value=remote([{...extra,path:'https://private.invalid/signed.mp3?token=secret'}]);await h.open();assert.equal(h.w.document.querySelectorAll('[data-track-index]').length,82);h.w.document.querySelector('[data-track-index]').click();await tick();const audio=h.w.document.querySelector('#sota-playlist-audio'),local=h.w.document.querySelector('#local');assert.equal(audio.paused,false);await local.play();assert.equal(audio.paused,true);assert.equal(local.paused,false);assert(!h.calls.some(c=>String(c.url).includes('private.invalid')));}finally{h.close();}
});
