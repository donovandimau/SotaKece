'use strict';
// Guided tour for new members (11 Nov 2026): Talanoa Wall -> starter Koro -> Music -> Sere -> My space.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'/tmp/jsd/node_modules/jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const windows=[];test.after(()=>windows.forEach(w=>w.close()));
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const PAGES={
  pulse:'<h1>Talanoa Wall</h1><div class="tw-wrap">wall</div><section class="hub-card">hubs</section><button data-tw="sere">Make a photo sing</button>',
  music:'<h1>Music</h1>',room:'<h1>My space</h1>',crews:'<h1>Koro</h1>'
};
function boot({member=true,sere=true,pending=false,done=false}={}){
  const d=new JSDOM('<!doctype html><body><main id="view"></main></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://sotakece.com/'});
  const w=d.window;windows.push(w);
  // jsdom has no layout: give every element a box so the tour can ring it.
  w.Element.prototype.getClientRects=function(){return [1];};
  w.Element.prototype.getBoundingClientRect=function(){return {top:100,left:20,bottom:200,right:300,width:280,height:100};};
  w.Element.prototype.scrollIntoView=function(){};
  w.matchMedia=()=>({matches:true});
  if(sere)w.SotaSere={open(){}};
  if(pending)w.localStorage.setItem('sk-tour-pending','1');
  if(done)w.localStorage.setItem('sk-tour-done','1');
  const went=[];
  const state={user:member?{id:'u-ana'}:null,me:member?{id:'u-ana',handle:'ana'}:null,tab:'pulse'};
  const go=async t=>{went.push(t);state.tab=t;w.document.getElementById('view').innerHTML=PAGES[t]||'<h1>'+t+'</h1>';};
  w.document.getElementById('view').innerHTML=PAGES.pulse;
  w.eval(read('sota-tour.js'));
  return {w,went,state,go,q:s=>w.document.querySelector(s)};
}

test('the tour walks the five stops in order, rings each one and ends cleanly',dom,async()=>{
  const h=boot();h.w.SotaTour.init({state:h.state,go:h.go});
  assert.equal(h.w.SotaTour.start(),true);await wait(30);
  assert.equal(h.q('#sk-tour-step').textContent,'Step 1 of 5');
  assert.equal(h.q('#sk-tour-title').textContent,'The Talanoa Wall');
  assert.equal(h.q('.sk-tour-ring').hidden,false);
  assert.equal(h.q('[data-tour="back"]').hidden,true);
  const titles=['The Talanoa Wall'];
  for(let k=0;k<4;k++){h.q('[data-tour="next"]').click();await wait(40);titles.push(h.q('#sk-tour-title').textContent);}
  assert.deepEqual(titles,['The Talanoa Wall','Join a starter Koro','Your island soundtrack','Make a photo sing','My space']);
  assert.deepEqual(h.went,['music','pulse','room']);
  assert.equal(h.q('[data-tour="next"]').textContent,'Finish');
  h.q('[data-tour="next"]').click();await wait(10);
  assert.equal(h.w.SotaTour.active(),false);
  assert.equal(h.q('.sk-tour-card').hidden,true);
  assert.equal(h.w.localStorage.getItem('sk-tour-done'),'1');
  assert.equal(h.w.document.documentElement.classList.contains('sk-touring'),false);
});

test('Sere is left out when that feature is not loaded, and Esc ends the tour',dom,async()=>{
  const h=boot({sere:false});h.w.SotaTour.init({state:h.state,go:h.go});
  assert.deepEqual(Array.from(h.w.SotaTour.stops(),s=>s.title),['The Talanoa Wall','Join a starter Koro','Your island soundtrack','My space']);
  h.w.SotaTour.start();await wait(20);
  assert.equal(h.q('#sk-tour-step').textContent,'Step 1 of 4');
  h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(5);
  assert.equal(h.w.SotaTour.active(),false);
});

test('arrow keys move through the tour but not while the member is typing',dom,async()=>{
  const h=boot();h.w.SotaTour.init({state:h.state,go:h.go});h.w.SotaTour.start();await wait(20);
  h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait(40);
  assert.equal(h.q('#sk-tour-step').textContent,'Step 2 of 5');
  const box=h.w.document.createElement('textarea');h.w.document.body.appendChild(box);
  box.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await wait(40);
  assert.equal(h.q('#sk-tour-step').textContent,'Step 2 of 5');
  h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await wait(40);
  assert.equal(h.q('#sk-tour-step').textContent,'Step 1 of 5');
  h.w.SotaTour.stop();
});

test('a new member gets the tour once by itself; guests and finished members do not',dom,async()=>{
  const fresh=boot({pending:true});fresh.w.SotaTour.init({state:fresh.state,go:fresh.go});await wait(1100);
  assert.equal(fresh.w.SotaTour.active(),true);
  assert.equal(fresh.w.localStorage.getItem('sk-tour-pending'),null);
  fresh.w.SotaTour.stop();
  const finished=boot({pending:true,done:true});finished.w.SotaTour.init({state:finished.state,go:finished.go});await wait(1100);
  assert.equal(finished.w.SotaTour.active(),false);
  const guest=boot({member:false});guest.w.SotaTour.init({state:guest.state,go:guest.go});
  assert.equal(guest.w.SotaTour.start(),false);
});

test('the page loads the tour the house way and new members are flagged for it',()=>{
  const html=read('index.html'),sw=read('sw.js'),shell=read('sota-premium-shell.js');
  assert.match(html,/<script src="\/sota-wellbeing\.js\?v=[^"]+"><\/script><script src="\/sota-tour\.js\?v=[^"]+"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\/sota-tour\.css\?v=/);
  assert.match(html,/window\.SotaTour\?\.init\(\{state:S,go:t=>go\(t\)\}\)/);
  assert.match(html,/localStorage\.setItem\("sk-tour-pending","1"\);[^\n]*\n\s*window\.SKTrack\("signup",\{kind:"room"\}\)/);
  assert.match(sw,/'\/sota-tour\.js','\/sota-tour\.css'/);
  assert.match(shell,/label:'Show me around'[^\n]*run:function\(\)\{window\.SotaTour&&window\.SotaTour\.start\(\);\}/);
  assert.match(shell,/if\(p\.run\)\{p\.run\(\);return;\}/);
});
