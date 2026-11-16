'use strict';
// Sound that keeps playing across pages (16 Nov 2026): sota-now-playing.js, the wall songs and voice
// notes that use it, and the mini-player showing whatever played last.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};

/** A page with media that behaves like a browser: play/pause fire events, and taking a playing
 *  element off the page pauses it (the HTML rule this module relies on). */
function page(){
  const dom=new JSDOM('<!doctype html><body><main id="app"></main></body>',{runScripts:'outside-only',url:'https://sotakece.com/'});
  const w=dom.window,M=w.HTMLMediaElement.prototype,played=[];
  Object.defineProperty(M,'paused',{configurable:true,get(){return this._paused!==false;}});
  Object.defineProperty(M,'ended',{configurable:true,get(){return false;}});
  Object.defineProperty(M,'readyState',{configurable:true,get(){return 1;}});
  Object.defineProperty(M,'currentTime',{configurable:true,get(){return this._t||0;},set(v){this._t=v;}});
  M.play=function(){played.push(this.getAttribute('src'));this._paused=false;this.dispatchEvent(new w.Event('play'));return Promise.resolve();};
  M.pause=function(){if(this._paused===false){this._paused=true;this.dispatchEvent(new w.Event('pause'));}};
  M.load=function(){};
  const remove=w.Element.prototype.remove;
  w.Element.prototype.remove=function(){const media=this.matches('audio')?[this]:[...this.querySelectorAll('audio')];const live=media.filter(a=>a._paused===false);remove.call(this);live.forEach(a=>a.pause());};
  w.eval(read('playback.js'));w.eval(read('sota-now-playing.js'));
  return {w,d:w.document,N:w.SotaNowPlaying,played};
}

test('play() uses one page-wide audio outside #app, and pressing again pauses and resumes',{skip:!JSDOM&&'jsdom missing'},async()=>{
  const {d,N}=page();
  assert.equal(await N.play('/a.mp3',{id:'track:a',title:'Isa Lei',credit:'Viti band',kind:'track'}),true);
  const a=d.getElementById('sota-now-audio');
  assert.ok(a&&a.parentElement===d.body,'lives on body, not in #app');
  assert.equal(a.getAttribute('data-sota-playback-source'),'now');
  assert.deepEqual(JSON.parse(JSON.stringify(N.state())),{id:'track:a',title:'Isa Lei',credit:'Viti band',kind:'track',playing:true});
  assert.equal(N.isPlaying('track:a'),true);
  assert.equal(await N.play('/a.mp3',{id:'track:a',title:'Isa Lei'}),null,'same song again pauses');
  assert.equal(N.isPlaying('track:a'),false);
  assert.equal(await N.play('/a.mp3',{id:'track:a',title:'Isa Lei'}),true,'and again resumes');
  d.getElementById('app').textContent='';
  assert.equal(N.isPlaying('track:a'),true,'changing the page leaves it playing');
});

test('a voice note taken off the page mid-play carries on from the same second',{skip:!JSDOM&&'jsdom missing'},async()=>{
  const {d,N,played}=page();
  d.getElementById('app').innerHTML='<div class="tw-voice-note"><audio controls src="/v.webm" data-now-kind="voice" data-now-title="Voice note from Mere" data-now-id="voice:x"></audio></div>';
  const note=d.querySelector('.tw-voice-note audio');
  await note.play();note.currentTime=7.5;
  assert.equal(N.active().title,'Voice note from Mere');assert.equal(N.active().audio,note,'plays where it is while the page is up');
  note.pause();note.play();
  d.querySelector('.tw-voice-note').remove();await flush();
  const a=d.getElementById('sota-now-audio');
  assert.equal(a.getAttribute('src'),'/v.webm');assert.equal(played.at(-1),'/v.webm');
  assert.equal(a.currentTime,7.5,'same second');
  assert.equal(N.state().kind,'voice');assert.equal(N.state().playing,true);
});

test('a note the member paused, then left, is not restarted; untagged audio is never taken over',{skip:!JSDOM&&'jsdom missing'},async()=>{
  const {d,N}=page();
  d.getElementById('app').innerHTML='<audio id="v" src="/v.webm" data-now-title="Voice note"></audio><audio id="plain" src="/p.mp3"></audio>';
  const v=d.getElementById('v'),plain=d.getElementById('plain');
  await v.play();v.pause();v.remove();await flush();
  assert.equal(d.getElementById('sota-now-audio'),null,'nothing new plays');
  await plain.play();plain.remove();await flush();
  assert.equal(d.getElementById('sota-now-audio'),null);
});

test('the playlist starting hands the mini-player back to the playlist',{skip:!JSDOM&&'jsdom missing'},async()=>{
  const {d,N}=page();
  await N.play('/a.mp3',{id:'track:a',title:'A'});
  const list=d.createElement('audio');list.id='sota-playlist-audio';list.setAttribute('src','/l.mp3');list.setAttribute('data-sota-playback-source','playlist');d.getElementById('app').append(list);
  await list.play();
  assert.equal(N.active(),null);
  assert.equal(d.getElementById('sota-now-audio').paused,true,'SotaPlayback paused the other sound');
});

test('wall songs and voice notes are wired to SotaNowPlaying; the mini-player follows it',()=>{
  const pulse=read('sota-pulse.js'),exp=read('sota-experience.js'),html=read('index.html'),local=read('local-music.js');
  assert.match(pulse,/window\.SotaNowPlaying\.play\(btn\.dataset\.src/);
  assert.match(pulse,/data-now-kind="voice"/);
  assert.match(exp,/root\.SotaNowPlaying\?\.active/);
  assert.match(exp,/listen\(s,root,'sota-now-playing',update\)/);
  assert.match(local,/data-now-title/);
  const at=f=>html.indexOf('<script src="/'+f);
  assert.ok(at('sota-now-playing.js')>at('playback.js')&&at('playback.js')>0,'loads after playback.js');
});
