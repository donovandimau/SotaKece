'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','music-badge.js'),'utf8');
function target(){return {listeners:new Map(),addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);},removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);},emit(event){for(const fn of [...this.listeners.get(event.type)||[]])fn(event);}};}
function fixture(options={}){
  const classes=new Set(),audios=[];
  const document=Object.assign(target(),{hidden:!!options.hidden,documentElement:{classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},remove(name){classes.delete(name);}}},querySelectorAll(selector){return selector.includes('audio')?audios.filter(audio=>audio.isConnected):[];}});
  function audio(id,extra={}){const node=Object.assign(target(),{tagName:'AUDIO',id,paused:true,ended:false,error:null,readyState:0,isConnected:true},extra);node.play=node.pause=()=>{throw Error('Badge must never control playback');};audios.push(node);return node;}
  const playlist=audio('sota-playlist-audio',options.playlist),local=audio('sota-local-audio',options.local);
  const root={document};vm.runInNewContext(source,root,{timeout:1000});
  return {root,document,playlist,local,audio,api:root.SotaMusicBadge,spins:()=>classes.has('sota-music-playing'),event(node,type,changes={}){Object.assign(node,changes);const event={target:node,type};if(node.isConnected)document.emit(event);node.emit(event);},visibility(hidden){document.hidden=hidden;document.emit({type:'visibilitychange',target:document});},count(node){return [...node.listeners.values()].reduce((total,set)=>total+set.size,0);}};
}
const playing={paused:false,ended:false,error:null,readyState:4};
test('initial paused players and play without playing do not spin',()=>{const f=fixture();assert.equal(f.spins(),false);f.event(f.playlist,'play',playing);assert.equal(f.spins(),false);f.event(f.playlist,'canplay');assert.equal(f.spins(),false);f.api.release();});
test('actual playing from either shared player spins; unrelated media is ignored',()=>{const f=fixture();for(const node of [f.playlist,f.local]){f.event(node,'playing',playing);assert.equal(f.spins(),true);f.event(node,'pause',{paused:true});assert.equal(f.spins(),false);}for(const node of [f.audio('profile-audio'),f.audio('call-audio'),f.audio('sota-playlist-audio',{tagName:'VIDEO'})]){f.event(node,'playing',playing);assert.equal(f.spins(),false);}f.api.release();});
test('buffered stalled keeps playing; waiting or low-data stalled need actual playing',()=>{const f=fixture();f.event(f.playlist,'playing',playing);f.event(f.playlist,'stalled',{readyState:4});assert.equal(f.spins(),true);f.visibility(true);f.visibility(false);assert.equal(f.spins(),true);for(const type of ['waiting','stalled']){f.event(f.playlist,type,{readyState:2});assert.equal(f.spins(),false);f.event(f.playlist,'stalled',{readyState:4});assert.equal(f.spins(),false);f.visibility(true);f.visibility(false);assert.equal(f.spins(),false);f.event(f.playlist,'canplay');assert.equal(f.spins(),false);f.event(f.playlist,'playing');assert.equal(f.spins(),true);}f.api.release();});
test('pause, end, error and emptied stop the current source',()=>{const f=fixture();for(const [type,changes] of [['pause',{paused:true}],['ended',{ended:true}],['error',{error:{code:3}}],['emptied',{readyState:0}]]){f.event(f.playlist,'playing',playing);assert.equal(f.spins(),true);f.event(f.playlist,type,changes);assert.equal(f.spins(),false);}f.api.release();});
test('late old-source events cannot stop a newer actual playing source',()=>{const f=fixture();f.event(f.playlist,'playing',playing);f.event(f.local,'playing',playing);assert.equal(f.spins(),true);for(const type of ['pause','waiting','stalled','ended','error','emptied']){f.event(f.playlist,type,{paused:true});assert.equal(f.spins(),true);}f.event(f.local,'pause',{paused:true});assert.equal(f.spins(),false);f.api.release();});
test('direct listeners still observe a detached local audio',()=>{const f=fixture();f.event(f.local,'playing',playing);f.local.isConnected=false;f.event(f.local,'waiting',{readyState:2});assert.equal(f.spins(),false);f.event(f.local,'playing',{readyState:4});assert.equal(f.spins(),true);f.event(f.local,'pause',{paused:true});assert.equal(f.spins(),false);f.api.release();assert.equal(f.count(f.local),0);});
test('hidden documents stop; visible ready playing media restores',()=>{const f=fixture();f.event(f.playlist,'playing',playing);f.visibility(true);assert.equal(f.spins(),false);f.event(f.local,'playing',playing);assert.equal(f.spins(),false);f.visibility(false);assert.equal(f.spins(),true);f.visibility(true);f.local.readyState=2;f.visibility(false);assert.equal(f.spins(),false);f.event(f.local,'playing',{readyState:3});assert.equal(f.spins(),true);f.api.release();});
test('installation detects already playing ready media and respects hidden/error states',()=>{for(const [options,expected] of [[{playlist:{...playing,readyState:3}},true],[{local:{...playing,readyState:2}},false],[{local:{...playing,error:{code:3}}},false],[{playlist:playing,hidden:true},false]]){const f=fixture(options);assert.equal(f.spins(),expected);f.api.release();}});
test('duplicate installation is idempotent; release removes all listeners and class',()=>{const f=fixture();const listeners=f.count(f.document);f.api.install();vm.runInNewContext(source,f.root,{timeout:1000});assert.equal(f.count(f.document),listeners);f.event(f.playlist,'playing',playing);assert.equal(f.spins(),true);f.api.release();f.api.release();assert.equal(f.spins(),false);assert.equal(f.count(f.document),0);assert.equal(f.count(f.playlist),0);f.event(f.local,'playing',playing);assert.equal(f.spins(),false);f.api.install();assert.equal(f.count(f.document),listeners);f.api.release();});
let JSDOM;try{({JSDOM}=require('jsdom'));}catch{}
test('real DOM capture and detached-target events update the root class',{skip:!JSDOM&&'Optional jsdom is not installed'},()=>{const dom=new JSDOM('<!doctype html><audio id="sota-playlist-audio"></audio><audio id="sota-local-audio"></audio>',{runScripts:'outside-only'});const w=dom.window,d=w.document;Object.defineProperty(d,'hidden',{configurable:true,value:false});const a=d.getElementById('sota-playlist-audio'),b=d.getElementById('sota-local-audio');for(const audio of [a,b])for(const [key,value] of Object.entries(playing))Object.defineProperty(audio,key,{configurable:true,writable:true,value});a.paused=b.paused=true;w.eval(source);const spins=()=>d.documentElement.classList.contains('sota-music-playing');a.paused=false;a.dispatchEvent(new w.Event('play'));assert.equal(spins(),false);a.dispatchEvent(new w.Event('playing'));assert.equal(spins(),true);b.paused=false;b.dispatchEvent(new w.Event('playing'));a.paused=true;a.dispatchEvent(new w.Event('pause'));assert.equal(spins(),true);b.remove();b.dispatchEvent(new w.Event('waiting'));assert.equal(spins(),false);b.dispatchEvent(new w.Event('playing'));assert.equal(spins(),true);b.paused=true;b.dispatchEvent(new w.Event('pause'));assert.equal(spins(),false);w.SotaMusicBadge.release();dom.window.close();});

test('page lights use measured energy and stop on pause, hidden tabs, or the setting',{skip:!JSDOM&&'Optional jsdom is not installed'},()=>{
  const dom=new JSDOM('<!doctype html><body class="sx-enabled"><button data-sota-lights-toggle></button><audio id="sota-playlist-audio"></audio></body>',{url:'https://sotakece.com/',runScripts:'outside-only'});
  const w=dom.window,d=w.document,media=d.querySelector('audio'),button=d.querySelector('button');
  let hidden=false,id=0;
  const frames=new Map(),frequency=new Uint8Array(1024);
  const state=Object.assign({},playing);
  Object.defineProperty(d,'hidden',{get:()=>hidden});
  for(const key of Object.keys(state))Object.defineProperty(media,key,{get:()=>state[key]});
  w.requestAnimationFrame=fn=>{const token=++id;frames.set(token,fn);return token;};
  w.cancelAnimationFrame=token=>frames.delete(token);
  const step=time=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));};
  w.DimauMusicVisuals={sample:()=>({frequency,context:{state:'running',sampleRate:48000}})};
  w.eval(source);
  media.dispatchEvent(new w.Event('playing'));
  step(42);
  const lamp=()=>d.querySelector('.sota-page-lights');
  assert.equal(lamp().style.getPropertyValue('--sota-bass-light'),'0.000');
  frequency.fill(220,2,8);
  step(90);
  assert(Number(lamp().style.getPropertyValue('--sota-bass-light'))>0);
  assert.equal(lamp().style.getPropertyValue('--sota-mid-light'),'0.000');
  button.click();
  assert.equal(button.getAttribute('aria-pressed'),'false');
  assert.equal(lamp(),null);
  assert.equal(frames.size,0);
  button.click();
  step(142);
  assert(lamp());
  hidden=true;
  d.dispatchEvent(new w.Event('visibilitychange'));
  assert.equal(lamp(),null);
  hidden=false;
  d.dispatchEvent(new w.Event('visibilitychange'));
  step(200);
  assert(lamp());
  state.paused=true;
  media.dispatchEvent(new w.Event('pause'));
  assert.equal(lamp(),null);
  assert.equal(frames.size,0);
  w.SotaMusicBadge.release();
  dom.window.close();
});
