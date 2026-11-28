'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const own='61025000-0000-4000-8000-000000000001';
const other='61025000-0000-4000-8000-000000000002';
const call='61025000-0000-4000-8000-000000000091';
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};};

function harness(){
 const dom=new JSDOM('<!doctype html><html lang="en-GB"><body><div id="root"></div><div id="inbox"></div></body></html>',{url:'https://sotakece.com/communications.html',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,root=w.document.querySelector('#root'),inbox=w.document.querySelector('#inbox');
 let now=1000000,context={user:{id:own},group:{id:42,name:'Test Village'}},mediaCalls=0,device,intercept;
 const timers=new Map(),rpcCalls=[],streams=[],engines=[],recorders=[],revoked=[],screens=[],fetchCalls=[];
 let timerId=0;
 w.setInterval=(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;};w.clearInterval=id=>timers.delete(id);
 w.Date.now=()=>now;w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
 Object.defineProperty(w.crypto,'randomUUID',{value:randomUUID});
 w.URL.createObjectURL=()=>`blob:test-${randomUUID()}`;w.URL.revokeObjectURL=url=>revoked.push(url);
 class Track{constructor(kind){this.kind=kind;this.enabled=true;this.readyState='live';this.stops=0;}stop(){this.stops++;this.readyState='ended';}clone(){return new Track(this.kind);}}
 class Stream{constructor(tracks=[]){this.tracks=tracks;}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}addTrack(track){this.tracks.push(track);}}
 w.MediaStream=Stream;
 Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:async opts=>{mediaCalls++;const stream=new Stream([...(opts.audio?[new Track('audio')]:[]),...(opts.video?[new Track('video')]:[])]);streams.push(stream);return stream;},enumerateDevices:async()=>[]}});
 w.fetch=async(...args)=>{fetchCalls.push(args);return {ok:true,json:async()=>({iceServers:[{urls:'stun:example.invalid'}],relayConfigured:false})};};
 const makeSnapshot=(state='joined',host=own)=>({call:{id:call,crew_id:42,host,mode:'video',status:'active',capacity:6},participants:[{member:own,display_name:'Own member',device_id:device,state,recording:false,spatial_x:.5,spatial_y:.5},{member:other,display_name:'Other member',device_id:randomUUID(),state:'joined',recording:false,spatial_x:.5,spatial_y:.5}]});
 let state=makeSnapshot(),acceptState='joined';
 const sb={auth:{getSession:async()=>({data:{session:{access_token:'test_token_is_long_enough_1234'}},error:null})},rpc:async(name,args)=>{
  rpcCalls.push({name,args});
  const special=intercept?.(name,args);if(special!==undefined)return special;
  let data;
  if(name==='bv_call_list')data=[];
  else if(name==='bv_callback_list')data={is_owner:false,available:false,requests:[]};
  else if(name==='bv_call_start'){device=args.p_device;state=makeSnapshot();state.call.mode=args.p_mode;data=state;}
  else if(name==='bv_call_snapshot')data=state;
  else if(name==='bv_call_act'){
   if(args.p_action==='accept'){const incomingMode=state.call.mode;device=args.p_device;state=makeSnapshot(acceptState,other);state.call.mode=incomingMode;}
   if(args.p_action==='record_start')state.participants[0].recording=true;
   if(args.p_action==='record_stop')state.participants[0].recording=false;
   data=state;
  }else if(name==='bv_call_signals')data=[];
  else data={};
  return {data,error:null};
 }};
 w.DimauCallMedia={create:options=>{const e={options,closed:0,peers:new Set(),replaced:[],audioChanges:[],audioTrack:options.localStream.getAudioTracks()[0],audioEnabled:options.localStream.getAudioTracks()[0]?.enabled!==false,videoEnabled:options.localStream.getVideoTracks()[0]?.enabled!==false,close(){this.closed++;},addPeer(id){this.peers.add(id);},removePeer(id){this.peers.delete(id);},setAudioEnabled(value){this.audioEnabled=value;this.audioChanges.push(value);if(this.audioTrack)this.audioTrack.enabled=value;},setVideoEnabled(value){this.videoEnabled=value;},setLowDataMode(){},async replaceAudioTrack(track){this.audioTrack=track;if(track)track.enabled=this.audioEnabled;},async replaceVideoTrack(track){this.replaced.push(track);if(track)track.enabled=this.videoEnabled;},handleSignal:async()=>{},getStats:async()=>[]};engines.push(e);return e;}};
 w.DimauCallEffects={createScreenShare:async options=>{const video=new Track('video'),s={track:video,stream:new Stream([video]),stop(){video.stop();options.onEnded();}};screens.push(s);return s;},createRecorder:options=>{const r={options,active:false,start:async()=>{r.active=true;},stop(){r.active=false;options.onStop(new w.Blob(['recorded'],{type:'video/webm'}));}};recorders.push(r);return r;}};
 for(const name of ['native-calls-core.js','native-calls.js'])w.eval(fs.readFileSync(path.join(__dirname,'..',name),'utf8'));
 const controller=w.DimauNativeCalls.create({root,inbox,sb,getContext:()=>context,onSelectGroup:async id=>{context={...context,group:{id,name:'Selected Village'}};}});
 const click=async id=>{root.querySelector('#'+id).click();await flush();};
 const tick=async()=>{await [...timers.values()].find(t=>t.ms===2500).fn();await flush();};
 return {w,root,inbox,controller,rpcCalls,streams,engines,recorders,revoked,screens,fetchCalls,makeSnapshot,click,tick,
  get context(){return context},set context(v){context=v},get state(){return state},set state(v){state=v},get mediaCalls(){return mediaCalls},get device(){return device},
  set acceptState(v){acceptState=v},set intercept(v){intercept=v},advance:ms=>{now+=ms},close(){controller.destroy();dom.window.close();}};
}
async function live(h,mode='video'){await h.click(mode==='video'?'ncStartVideo':'ncStartAudio');await h.click('ncJoin');assert.equal(h.engines.length,1);}

test('Device access is explicit and context reset stops every preview track',async()=>{
 const h=harness();try{assert.equal(h.mediaCalls,0);await h.click('ncStartVideo');assert.equal(h.mediaCalls,0);await h.click('ncCheck');assert.equal(h.mediaCalls,1);assert.equal(h.streams[0].getVideoTracks().length,1);h.controller.resetContext();assert(h.streams[0].getTracks().every(t=>t.readyState==='ended'));assert.equal(h.root.querySelector('#ncPrejoin').hidden,true);}finally{h.close();}
});
test('Video joins muted and a host kick closes media and remote tiles',async()=>{
 const h=harness();try{await live(h);assert.equal(h.streams[0].getAudioTracks()[0].enabled,false);assert.equal(h.root.querySelector('#ncLive').hidden,false);h.state=h.makeSnapshot('kicked');await h.tick();assert.equal(h.engines[0].closed,1);assert(h.streams[0].getTracks().every(t=>t.readyState==='ended'));assert.equal(h.root.querySelector('#ncLive').hidden,true);assert.equal(h.controller.active,false);}finally{h.close();}
});
test('Lobby waits without transmitting, heartbeats pending admission and cancel stops devices',async()=>{
 const h=harness();try{h.acceptState='waiting';h.state=h.makeSnapshot('ringing',other);await h.controller.open(call,42,'video');await h.click('ncJoin');assert.equal(h.engines.length,0);assert.equal(h.controller.active,true);await h.tick();assert(h.rpcCalls.some(r=>r.name==='bv_call_act'&&r.args.p_action==='heartbeat'));await h.click('ncCancel');assert(h.streams[0].getTracks().every(t=>t.readyState==='ended'));assert(h.rpcCalls.some(r=>r.name==='bv_call_act'&&r.args.p_action==='leave'));}finally{h.close();}
});
test('Unverifiable live membership stops media after bounded grace',async()=>{
 const h=harness();try{await live(h);h.advance(21001);h.intercept=name=>name==='bv_call_snapshot'?Promise.resolve({data:null,error:new Error('membership unavailable')}):undefined;await h.tick();assert.equal(h.engines[0].closed,1);assert(h.streams[0].getTracks().every(t=>t.readyState==='ended'));assert.match(h.root.querySelector('#ncStatus').textContent,/membership could not be verified/);}finally{h.close();}
});
test('Recording requires consent, advertises server notice and clears local exports on context reset',async()=>{
 const h=harness();try{await live(h);await h.click('ncRecord');assert.equal(h.recorders.length,0);assert(!h.rpcCalls.some(r=>r.args.p_action==='record_start'));h.root.querySelector('#ncRecordConsent').checked=true;await h.click('ncRecord');assert.equal(h.recorders.length,1);assert.equal(h.root.querySelector('#ncRecordingNotice').hidden,false);await h.click('ncRecord');assert.equal(h.root.querySelector('#ncDownload').hidden,false);h.controller.resetContext();assert.equal(h.root.querySelector('#ncDownload').hidden,true);assert(h.revoked.length>0);assert.equal(h.root.querySelector('#ncRecordConsent').checked,false);}finally{h.close();}
});
test('Late callback response cannot reveal previous Village notes after context reset',async()=>{
 const h=harness(),gate=deferred();try{h.intercept=name=>name==='bv_callback_list'?gate.promise:undefined;h.controller.setContext();await flush();h.controller.resetContext();h.context={user:{id:other},group:{id:99,name:'Other Village'}};gate.resolve({data:{is_owner:true,available:true,requests:[{id:randomUUID(),requester_name:'Private old member',note:'PRIVATE PREVIOUS KORO NOTE',state:'queued'}]},error:null});await flush();assert(!h.root.textContent.includes('PRIVATE PREVIOUS KORO NOTE'));assert.equal(h.root.querySelector('#ncAvailable').hidden,true);}finally{h.close();}
});
test('Late open snapshot cannot reopen a previous call after account reset',async()=>{
 const h=harness(),gate=deferred();try{h.intercept=name=>name==='bv_call_snapshot'?gate.promise:undefined;const opening=h.controller.open(call,42,'video');await flush();h.controller.resetContext();h.context={user:{id:other},group:{id:99,name:'Other Village'}};gate.resolve({data:h.makeSnapshot('ringing',other),error:null});await opening;await flush();assert.equal(h.root.querySelector('#ncPrejoin').hidden,true);assert.equal(h.controller.active,false);}finally{h.close();}
});
test('Late recording mutation cannot restart a recorder after context reset',async()=>{
 const h=harness(),gate=deferred();try{await live(h);h.root.querySelector('#ncRecordConsent').checked=true;h.intercept=(name,args)=>name==='bv_call_act'&&args.p_action==='record_start'?gate.promise:undefined;h.root.querySelector('#ncRecord').click();await flush();h.controller.resetContext();h.context={user:null,group:null};const old=h.makeSnapshot();old.participants[0].recording=true;gate.resolve({data:old,error:null});await flush();assert.equal(h.recorders.length,0);assert.equal(h.root.querySelector('#ncRecordingNotice').hidden,true);assert.equal(h.controller.active,false);}finally{h.close();}
});
test('Switching devices preserves an explicitly disabled camera',async()=>{
 const h=harness();try{await live(h);await h.click('ncVideo');assert.equal(h.streams[0].getVideoTracks()[0].enabled,false);h.root.querySelector('#ncMic').dispatchEvent(new h.w.Event('change'));await flush();assert.equal(h.streams.length,2);assert.equal(h.streams[1].getVideoTracks()[0].enabled,false);assert.equal(h.root.querySelector('#ncVideo .nc-control-label').textContent,'Camera Off');}finally{h.close();}
});
test('Stopping screen share restores the camera with its previous off state',async()=>{
 const h=harness();try{await live(h);await h.click('ncVideo');const camera=h.streams[0].getVideoTracks()[0];await h.click('ncShare');assert.equal(h.screens[0].track.enabled,true);await h.click('ncShare');assert.equal(h.screens[0].track.readyState,'ended');assert.equal(h.engines[0].replaced.at(-1),camera);assert.equal(camera.enabled,false);}finally{h.close();}
});
test('An active call offers rejoin after leaving, while host removal blocks rejoin',async()=>{
 for(const [state,canJoin]of[['left',true],['missed',true],['kicked',false],['rejected',false]]){
  const h=harness();try{h.intercept=name=>name==='bv_call_list'?Promise.resolve({data:[{...h.makeSnapshot().call,my_state:state,created_at:new Date().toISOString(),host_name:'Host'}],error:null}):undefined;h.controller.setContext();await flush();const open=[...h.root.querySelectorAll('#ncCallList button')].find(b=>b.textContent==='Open call');assert.equal(!!open,canJoin,`Rejoin admission for ${state}`);}finally{h.close();}
 }
});

function toolbar(h){
 const bar=h.root.querySelector('.nc-toolbar');
 assert.deepEqual([...bar.children].map(n=>n.id),['ncMute','ncVideo','ncMore','ncLeave']);
 assert.equal(h.root.querySelector('#ncMore').tagName,'DETAILS');
 assert.equal(h.root.querySelector('#ncMoreToggle').tagName,'SUMMARY');
 assert.equal(h.root.querySelector('#ncLeave').getAttribute('aria-label'),'End your call');
 for(const id of ['ncMute','ncVideo','ncMore','ncMoreToggle','ncLeave','ncShare','ncEnd','ncBubble','ncRecord','ncCaptions','ncDiagnostics'])assert.equal(h.root.querySelectorAll('#'+id).length,1,'one preserved '+id);
 for(const id of ['ncShare','ncEnd','ncBubble','ncRecord','ncCaptions','ncDiagnostics'])assert(h.root.querySelector('#ncMore').contains(h.root.querySelector('#'+id)),id+' remains in More');
 return bar;
}
const label=(h,id)=>h.root.querySelector('#'+id+' .nc-control-label').textContent.trim();

test('Outgoing audio and video share four controls and display their actual muted join state',async()=>{
 for(const mode of ['audio','video']){
  const h=harness();try{
   await live(h,mode);toolbar(h);
   assert.equal(label(h,'ncMute'),'Mic Off');assert.equal(h.root.querySelector('#ncMute').getAttribute('aria-pressed'),'false');
   assert.match(h.root.querySelector('#ncMute').getAttribute('aria-label'),/Mic Off/);
   assert.equal(h.streams[0].getAudioTracks()[0].enabled,false);
   assert.equal(label(h,'ncVideo'),mode==='video'?'Camera On':'Camera Off');
   assert.equal(h.root.querySelector('#ncVideo').getAttribute('aria-pressed'),String(mode==='video'));
   assert.equal(h.streams[0].getVideoTracks().length,mode==='video'?1:0);
   assert.equal(h.root.querySelector('#ncMore').open,false);
  }finally{h.close();}
 }
});

test('Incoming audio and video answers use the same controls without bypassing prejoin',async()=>{
 for(const mode of ['audio','video']){
  const h=harness();try{
   h.state=h.makeSnapshot('ringing',other);h.state.call.mode=mode;
   h.intercept=name=>name==='bv_call_list'?Promise.resolve({data:[{...h.state.call,my_state:'ringing',ring_expires_at:new Date(1060000).toISOString()}],error:null}):undefined;
   h.controller.setContext();await flush();
   const answer=[...h.inbox.querySelectorAll('button')].find(n=>n.textContent==='Answer '+mode);assert(answer);
   answer.click();await flush();assert.equal(h.mediaCalls,0);assert.equal(h.engines.length,0);assert.equal(h.root.querySelector('#ncPrejoin').hidden,false);
   await h.click('ncJoin');assert.equal(h.engines.length,1);toolbar(h);
   assert(h.rpcCalls.some(r=>r.name==='bv_call_act'&&r.args.p_action==='accept'));
   assert.equal(label(h,'ncMute'),'Mic Off');assert.equal(h.streams[0].getAudioTracks()[0].enabled,false);
   assert.equal(label(h,'ncVideo'),mode==='video'?'Camera On':'Camera Off');
   assert.equal(h.root.querySelector('#ncEnd').hidden,true,'non-host cannot end for everyone');
  }finally{h.close();}
 }
});

test('Mic and camera labels track the actual local media toggles',async()=>{
 const h=harness();try{
  await live(h);const audio=h.streams[0].getAudioTracks()[0],video=h.streams[0].getVideoTracks()[0],permissions=h.mediaCalls;
  await h.click('ncMute');assert.equal(audio.enabled,true);assert.equal(label(h,'ncMute'),'Mic On');assert.equal(h.root.querySelector('#ncMute').getAttribute('aria-pressed'),'true');assert.match(h.root.querySelector('#ncMute').getAttribute('aria-label'),/Mic On/);
  await h.click('ncMute');assert.equal(audio.enabled,false);assert.equal(label(h,'ncMute'),'Mic Off');assert.deepEqual(h.engines[0].audioChanges,[true,false]);
  await h.click('ncVideo');assert.equal(video.enabled,false);assert.equal(label(h,'ncVideo'),'Camera Off');assert.equal(h.root.querySelector('#ncVideo').getAttribute('aria-pressed'),'false');assert.match(h.root.querySelector('#ncVideo').getAttribute('aria-label'),/Camera Off/);
  await h.click('ncVideo');assert.equal(video.enabled,true);assert.equal(label(h,'ncVideo'),'Camera On');assert.equal(h.root.querySelector('#ncVideo').getAttribute('aria-pressed'),'true');
  assert.equal(h.mediaCalls,permissions,'existing tracks toggle without new permission requests');
 }finally{h.close();}
});

test('Opening More has no media or server side effects and Escape restores focus',async()=>{
 const h=harness();try{
  await live(h);const before={rpc:h.rpcCalls.length,fetch:h.fetchCalls.length,media:h.mediaCalls,recorders:h.recorders.length,screens:h.screens.length};
  await h.click('ncMoreToggle');assert.equal(h.root.querySelector('#ncMore').open,true);
  assert.deepEqual({rpc:h.rpcCalls.length,fetch:h.fetchCalls.length,media:h.mediaCalls,recorders:h.recorders.length,screens:h.screens.length},before);
  const share=h.root.querySelector('#ncShare');share.focus();share.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await flush();
  assert.equal(h.root.querySelector('#ncMore').open,false);assert.equal(h.w.document.activeElement.id,'ncMoreToggle');
  await h.click('ncMoreToggle');await h.click('ncMoreClose');assert.equal(h.root.querySelector('#ncMore').open,false);assert.equal(h.w.document.activeElement.id,'ncMoreToggle');
 }finally{h.close();}
});

test('End leaves only this participant and closes More before local media teardown',async()=>{
 const h=harness();try{
  await live(h);await h.click('ncMoreToggle');assert.equal(h.root.querySelector('#ncMore').open,true);await h.click('ncLeave');
  assert(h.rpcCalls.some(r=>r.name==='bv_call_act'&&r.args.p_action==='leave'));assert(!h.rpcCalls.some(r=>r.name==='bv_call_act'&&r.args.p_action==='end'));
  assert.equal(h.engines[0].closed,1);assert(h.streams[0].getTracks().every(t=>t.readyState==='ended'));assert.equal(h.root.querySelector('#ncMore').open,false);assert.equal(h.root.querySelector('#ncLive').hidden,true);
 }finally{h.close();}
});

test('Host-only End for everyone remains a separate action inside More',async()=>{
 const h=harness();try{
  await live(h);toolbar(h);assert.equal(h.root.querySelector('#ncEnd').hidden,false);assert.equal(h.root.querySelector('#ncEnd').textContent.trim(),'End for everyone');
  await h.click('ncMoreToggle');await h.click('ncEnd');
  assert(h.rpcCalls.some(r=>r.name==='bv_call_act'&&r.args.p_action==='end'));assert(!h.rpcCalls.some(r=>r.name==='bv_call_act'&&r.args.p_action==='leave'));
  assert.equal(h.root.querySelector('#ncMore').open,false);assert(h.streams[0].getTracks().every(t=>t.readyState==='ended'));
 }finally{h.close();}
});

test('Context reset closes More and restores truthful off labels for the next call',async()=>{
 const h=harness();try{
  await live(h);await h.click('ncMute');await h.click('ncMoreToggle');h.controller.resetContext();
  assert.equal(h.root.querySelector('#ncMore').open,false);assert.equal(label(h,'ncMute'),'Mic Off');assert.equal(label(h,'ncVideo'),'Camera Off');assert.equal(h.root.querySelector('#ncLive').hidden,true);
  assert(h.streams[0].getTracks().every(t=>t.readyState==='ended'));assert.equal(h.controller.active,false);
 }finally{h.close();}
});
