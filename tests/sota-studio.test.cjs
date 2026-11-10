'use strict';
// The Studio drawer (10 Nov 2026): page design, room skins and lights behind one entry and one tab strip.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const wait=(w,ms=15)=>new Promise(r=>w.setTimeout(r,ms));
function boot(){
  const d=new JSDOM('<!doctype html><body><div id="app"></div></body>',{url:'https://sotakece.com/',pretendToBeVisual:true}),w=d.window,doc=w.document,log=[];
  // jsdom has no modal dialogs: stand in for showModal/close with the open attribute and a close event.
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  w.HTMLDialogElement.prototype.close=function(){if(!this.hasAttribute('open'))return;this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  const page=doc.createElement('dialog');page.id='ssd-editor';page.className='ssd-editor';page.innerHTML='<header class="ssd-head"><button class="ssd-close">×</button></header><p>page tools</p>';doc.body.append(page);
  page.querySelector('.ssd-close').addEventListener('click',()=>{log.push('page cancel');page.close();});
  w.SotaSpaceDesign={open:p=>{log.push('page open '+p);page.showModal();}};
  w.BulaSkinStudio={open:(initial,collection)=>{log.push('skins open '+(collection||'-'));const s=doc.createElement('dialog');s.className='bv-studio';s.innerHTML='<div class="bv-studio-head"><button class="bv-close">×</button></div>';s.querySelector('.bv-close').addEventListener('click',()=>{log.push('skins cancel');s.close();});s.addEventListener('close',()=>s.remove());doc.body.append(s);s.showModal();}};
  let lights=true;w.SotaMusicBadge={updateControls:()=>doc.querySelectorAll('[data-sota-lights-toggle]').forEach(b=>{b.textContent='Page lights: '+(lights?'On':'Off');b.setAttribute('aria-pressed',String(lights));})};
  const went=[];
  const api=new w.Function('globalThis','module',read('sota-studio.js')+';return globalThis.SotaStudio;')(w,undefined);
  api.init({getPage:()=>'pulse',go:t=>went.push(t)});
  const open=()=>[...doc.querySelectorAll('dialog[open]')];
  return {w,doc,api,log,went,open,tabs:()=>[...doc.querySelectorAll('dialog[open] > .sd-tabs [data-studio-tab]')]};
}
test('one drawer, three tabs: each section opens docked with the same tab strip and only one is ever open',dom,async()=>{
  const h=boot();
  assert.equal(h.api.open('page'),true);
  assert.deepEqual(h.log,['page open pulse']);assert.equal(h.api.current(),'page');
  let d=h.open();assert.equal(d.length,1);assert(d[0].classList.contains('sd-drawer'));assert.equal(d[0].firstElementChild.className,'sd-tabs');
  assert.deepEqual(h.tabs().map(b=>b.textContent+':'+b.getAttribute('aria-current')),['This page:page','Room skins:false','Lights:false']);
  h.tabs()[1].click();await wait(h.w);
  assert.deepEqual(h.log,['page open pulse','page cancel','skins open -'],'the page editor is cancelled its own way before the skins open');
  d=h.open();assert.equal(d.length,1);assert(d[0].classList.contains('bv-studio'));assert.equal(h.api.current(),'skins');
  assert.deepEqual(h.tabs().map(b=>b.getAttribute('aria-current')),['false','page','false']);
  h.tabs()[2].click();await wait(h.w);
  assert.equal(h.log.at(-1),'skins cancel');assert.equal(h.api.current(),'lights');assert.equal(h.open().length,1);
  const toggle=h.doc.querySelector('.sd-lights [data-sota-lights-toggle]');assert.equal(toggle.textContent,'Page lights: On','the existing lights switch is reused, not reimplemented');
  h.doc.querySelector('.sd-lights [data-studio-go]').click();assert.deepEqual(h.went,['music']);assert.equal(h.api.current(),null);assert.equal(h.doc.querySelector('.sd-lights'),null);
  h.api.stop();h.w.close();
});
test('an editor opened by any old button still arrives as the drawer, and reopening the same tab does nothing twice',dom,async()=>{
  const h=boot();
  h.w.BulaSkinStudio.open(null,'All');await wait(h.w);
  const skins=h.doc.querySelector('dialog.bv-studio');assert(skins.classList.contains('sd-drawer'));assert.equal(skins.querySelectorAll(':scope > .sd-tabs').length,1);
  h.api.open('skins');await wait(h.w);assert.equal(h.log.filter(l=>l.startsWith('skins open')).length,1);assert.equal(skins.querySelectorAll(':scope > .sd-tabs').length,1);
  h.api.close();assert.equal(h.api.current(),null);assert.equal(h.log.at(-1),'skins cancel');
  h.api.open('nonsense');assert.equal(h.api.current(),'page','an unknown section falls back to the page tab');
  h.api.open('page',{page:'room'});assert.equal(h.log.filter(l=>l.startsWith('page open')).length,1);
  h.api.close();h.api.open('page',{page:'room'});assert.equal(h.log.at(-1),'page open profile','My space is designed as the profile page');
  h.api.stop();h.w.close();
});
test('the page loads the drawer, starts it, and the old scattered entries are gone',()=>{
  const html=read('index.html'),sw=read('sw.js'),worlds=read('sota-worlds.js'),css=read('sota-studio.css');
  assert.match(html,/<script src="\/sota-studio\.js\?v=[a-z0-9-]+"><\/script>/);assert.match(html,/<link rel="stylesheet" href="\/sota-studio\.css\?v=[a-z0-9-]+">/);
  assert.match(html,/window\.SotaStudio\?\.init\(\{getPage:/);assert.match(sw,/'\/sota-studio\.js','\/sota-studio\.css'/);
  assert.doesNotMatch(worlds,/Room Studio <i|Skins & collections|>Design this page </);
  assert.match(worlds,/data-world-tool="studio-drawer" aria-haspopup="dialog">Studio /);
  assert.match(css,/dialog\.ssd-editor\.sd-drawer::backdrop,dialog\.sd-lights\.sd-drawer::backdrop\{background:#14263d1f;backdrop-filter:none\}/,'the page stays visible behind the page and lights tabs');
  assert.match(css,/prefers-reduced-motion:reduce\)\{dialog\.sd-drawer\[open\]\{animation:none\}/);
  assert.doesNotMatch(read('sota-studio.js'),/innerHTML|insertAdjacentHTML/);
});
