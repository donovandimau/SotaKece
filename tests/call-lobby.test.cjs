'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const browserTest=(name,fn)=>test(name,{skip:!JSDOM?'Install jsdom to check explicit call entry':false},fn);
const text=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));};
function harness(t,{defer=false}={}){
 const dom=new JSDOM(text('call.html'),{url:'https://sotakece.com/call.html#00000000-0000-4000-8000-000000000001',runScripts:'outside-only'}),w=dom.window,d=w.document,calls={media:[],config:0,signals:0,engines:0,stopped:0,closed:0};let finish;
 class Stream{constructor(tracks=[]){this.tracks=tracks;}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}addTrack(t){this.tracks.push(t);}}
 const track=kind=>({kind,enabled:true,stop(){calls.stopped++;}}),media=new Stream([track('audio')]);w.MediaStream=Stream;
 Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:options=>{calls.media.push(options);return defer?new Promise(resolve=>finish=resolve):Promise.resolve(media);}}});
 w.fetch=async()=>{calls.config++;return{ok:true,json:async()=>({iceServers:[]})};};
 const channel={on(){return this;},subscribe(cb){cb('SUBSCRIBED');return this;},track:async()=>{},untrack(){},presenceState:()=>({}),send:async()=>{}};
 w.supabase={createClient:()=>({channel:()=>{calls.signals++;return channel;},removeChannel(){}})};w.DimauCallMedia={create:()=>{calls.engines++;return{close(){calls.closed++;},setAudioEnabled(){},setVideoEnabled(){}};}};
 w.eval(text('call-room.js'));d.dispatchEvent(new w.Event('DOMContentLoaded'));t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});return{w,d,calls,media,get:id=>d.getElementById(id),finish:()=>finish(media)};
}
browserTest('opening a call waits at a real join screen without media, configuration or signalling requests',async t=>{
 const h=harness(t);await flush();assert.equal(h.get('crLobby').hidden,false);assert.equal(h.get('ncLive').hidden,true);assert.equal(h.calls.media.length,0);assert.equal(h.calls.config,0);assert.equal(h.calls.signals,0);h.d.querySelector('[data-call-mode="audio"]').click();assert.match(h.get('crJoin').textContent,/voice/);assert.equal(h.calls.media.length,0);
});
browserTest('Join starts the chosen voice mode once and retains the existing call controls',async t=>{
 const h=harness(t);h.d.querySelector('[data-call-mode="audio"]').click();h.get('crJoin').click();h.get('crJoin').click();await flush();assert.equal(h.calls.media.length,1);assert.equal(h.calls.media[0].video,false);assert.equal(h.calls.signals,1);assert.equal(h.calls.engines,1);assert.equal(h.get('crLobby').hidden,true);assert.equal(h.get('ncLive').hidden,false);assert.equal(h.get('ncLiveTitle').textContent,'Voice call');assert.match(h.w.location.search,/mode=audio/);h.get('ncLeave').click();assert.equal(h.calls.stopped,1);assert.equal(h.calls.closed,1);assert.equal(h.get('crEnded').hidden,false);
});
browserTest('leaving while a device request is pending stops late media before signalling',async t=>{
 const h=harness(t,{defer:true});h.d.querySelector('[data-call-mode="audio"]').click();h.get('crJoin').click();assert.equal(h.calls.media.length,1);h.get('ncLeave').click();h.finish();await flush();assert.equal(h.calls.stopped,1);assert.equal(h.calls.config,0);assert.equal(h.calls.signals,0);assert.equal(h.calls.engines,0);assert.equal(h.get('ncSelf').srcObject,undefined);
});
