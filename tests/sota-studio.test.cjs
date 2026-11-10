'use strict';
// The Studio (10 Nov 2026): one editor for page design, room skins and lights — one drawer, one Save, one Cancel.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const wait=(w,ms=15)=>new Promise(r=>w.setTimeout(r,ms));
function boot({ownRoom=false,pageFails=false,skinsFail=false,confirm=true}={}){
  const d=new JSDOM('<!doctype html><body><div id="app"></div></body>',{url:'https://sotakece.com/',pretendToBeVisual:true}),w=d.window,doc=w.document,log=[];
  // jsdom has no dialog methods: stand in with the open attribute and a close event.
  const P=w.HTMLDialogElement.prototype;
  P.showModal=function(){log.push('native modal '+(this.className||this.id));this.setAttribute('open','');};
  P.show=function(){this.setAttribute('open','');};
  P.close=function(){if(!this.hasAttribute('open'))return;this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  w.confirm=()=>{log.push('asked');return confirm;};
  // The page-design tool: one long-lived dialog with its own Cancel and Save.
  const page=doc.createElement('dialog');page.id='ssd-editor';page.className='ssd-editor';
  page.innerHTML='<header class="ssd-head"><button class="ssd-close">×</button></header><button class="ssd-palette">Sunset</button><select data-ssd-page><option>a</option></select><footer class="ssd-actions"><button class="ssd-cancel">Cancel</button><button class="ssd-save">Save design</button></footer>';
  doc.body.append(page);
  const pageCancel=()=>{log.push('page cancel');page.close();};
  page.querySelector('.ssd-close').addEventListener('click',pageCancel);page.querySelector('.ssd-cancel').addEventListener('click',pageCancel);
  page.querySelector('.ssd-save').addEventListener('click',()=>{log.push('page save');if(pageFails)return;page.close();});
  w.SotaSpaceDesign={open:p=>{if(page.hasAttribute('open'))return;log.push('page open '+p);page.showModal();}};
  // The skin tool: a fresh dialog each time, removed when it closes.
  let studio=null;
  w.BulaSkinStudio={previewLive:s=>{log.push('live '+s.id);return true;},open:(initial,collection)=>{
    if(studio)return;log.push('skins open '+(collection||'-'));
    const s=studio=doc.createElement('dialog');s.className='bv-studio';s.dataset.editorMode='browse';
    s.innerHTML='<button class="bv-close">×</button><button data-editor-mode="create">Create your own</button><button class="bv-skin-option">Reef</button><div class="bv-studio-footer"><div id="bv-studio-error"></div><button id="bv-cancel">Cancel</button><button id="bv-save">Save my room</button></div>';
    const out=()=>{log.push('skins cancel');s.close();};s.querySelector('.bv-close').addEventListener('click',out);s.querySelector('#bv-cancel').addEventListener('click',out);
    s.querySelector('.bv-skin-option').addEventListener('click',()=>doc.dispatchEvent(new w.CustomEvent('sota-skin-draft',{detail:{settings:{id:'reef'}}})));
    s.querySelector('#bv-save').addEventListener('click',()=>{log.push('skins save');if(skinsFail){s.querySelector('#bv-studio-error').textContent='boom';return;}s.close();});
    s.addEventListener('close',()=>{s.remove();if(studio===s)studio=null;});
    doc.body.append(s);s.showModal();}};
  let lights=true;w.SotaMusicBadge={updateControls:()=>doc.querySelectorAll('[data-sota-lights-toggle]').forEach(b=>{b.textContent='Page lights: '+(lights?'On':'Off');})};
  const went=[],redrawn=[];
  const api=new w.Function('globalThis','module',read('sota-studio.js')+';return globalThis.SotaStudio;')(w,undefined);
  api.init({getPage:()=>'pulse',go:t=>went.push(t),rerender:()=>redrawn.push(1),isOwnRoom:()=>ownRoom});
  const drawer=()=>doc.querySelector('dialog.sd-studio');
  return {w,doc,api,log,went,redrawn,drawer,page,q:s=>doc.querySelector(s),tab:k=>doc.querySelector('.sd-tab-row [data-studio-tab="'+k+'"]')};
}
test('one drawer hosts both tools: switching tabs keeps each open, with its work, and only the drawer is a window',dom,async()=>{
  const h=boot();
  h.api.open('page');
  assert.deepEqual(h.log,['native modal sd-studio','page open pulse'],'only the Studio opens as a window; the page tool is shown inside it');
  assert.equal(h.page.parentElement.dataset.studioPanel,'page');assert(h.page.classList.contains('sd-hosted'));assert.equal(h.api.current(),'page');
  assert.deepEqual([...h.doc.querySelectorAll('.sd-tab-row button')].map(b=>b.textContent+':'+b.getAttribute('aria-selected')),['This page:true','Room skins:false','Lights:false']);
  assert.equal(h.q('.sd-save').textContent,'Done');assert.equal(h.q('.sd-cancel').hidden,true);
  h.q('.ssd-palette').click();
  assert.equal(h.api.isDirty(),true);assert.equal(h.q('.sd-save').textContent,'Save changes');assert.equal(h.q('.sd-cancel').hidden,false);assert(h.tab('page').classList.contains('sd-changed'));
  h.tab('skins').click();
  assert.equal(h.log.includes('page cancel'),false,'moving to another tab does not cancel the first');
  assert.equal(h.page.hasAttribute('open'),true);assert.equal(h.page.parentElement.hidden,true);assert.equal(h.q('.bv-studio').parentElement.dataset.studioPanel,'skins');assert.equal(h.api.current(),'skins');
  h.q('button[data-editor-mode]').click();assert.equal(h.tab('skins').classList.contains('sd-changed'),false,'switching mode inside the skin tool is browsing, not a change');
  h.tab('lights').click();assert.equal(h.api.current(),'lights');assert.equal(h.q('.sd-lights-toggle').textContent,'Page lights: On');
  h.tab('page').click();assert.equal(h.page.parentElement.hidden,false);assert.equal(h.log.filter(l=>l.startsWith('page open')).length,1,'the page tool was never reopened');
  h.api.stop();h.w.close();
});
test('one Save keeps every changed tab and closes; untouched tools are simply put away',dom,async()=>{
  const h=boot();
  h.api.open('page');h.q('.ssd-palette').click();h.tab('skins').click();h.q('.bv-skin-option').click();
  assert.match(h.q('.sd-status').textContent,/This page and Room skins/);
  const done=h.api.save();assert.equal(h.q('.sd-save').textContent,'Saving…');assert.equal(await done,true);await wait(h.w);
  assert.deepEqual(h.log.filter(l=>/save|cancel/.test(l)),['page save','skins save']);
  assert.equal(h.drawer(),null);assert.equal(h.api.current(),null);assert.equal(h.page.parentElement,h.doc.body,'the page tool is handed back for next time');assert.equal(h.redrawn.length,0);
  const g=boot();g.api.open('page');g.tab('skins').click();g.q('.bv-skin-option').click();
  assert.equal(await g.api.save(),true);await wait(g.w);
  assert.deepEqual(g.log.filter(l=>/save|cancel/.test(l)),['skins save','page cancel'],'the untouched page tool is not saved');
  h.api.stop();g.api.stop();h.w.close();g.w.close();
});
test('a save that fails keeps the drawer open on that tab with the changes still there',dom,async()=>{
  const h=boot({skinsFail:true});
  h.api.open('page');h.q('.ssd-palette').click();h.tab('skins').click();h.q('.bv-skin-option').click();h.tab('page').click();
  assert.equal(await h.api.save(),false);
  assert.equal(h.api.current(),'skins');assert.match(h.q('.sd-status').textContent,/Your room could not be saved/);assert.equal(h.q('#bv-studio-error').textContent,'boom');
  assert.equal(h.api.isDirty(),true);assert.equal(h.tab('page').classList.contains('sd-changed'),false,'the page was saved and is no longer marked');assert.equal(h.q('.sd-save').textContent,'Save changes');
  h.api.stop();h.w.close();
});
test('Cancel puts everything back; leaving with changes asks first; a skin shown on the real room is restored',dom,async()=>{
  const h=boot({ownRoom:true});
  h.api.open('skins');assert(h.drawer().classList.contains('sd-live'),'on My space the skin is previewed on the room itself');
  h.q('.bv-skin-option').click();assert.equal(h.log.at(-1),'live reef');
  h.q('.sd-cancel').click();await wait(h.w);
  assert.equal(h.log.includes('asked'),false,'Cancel is already a decision');assert.equal(h.drawer(),null);assert.deepEqual(h.redrawn,[1],'the room is drawn again with its saved skin');
  const g=boot({confirm:false});g.api.open('page');g.q('.ssd-palette').click();
  g.q('.sd-close').click();assert.equal(g.log.at(-1),'asked');assert.equal(g.api.current(),'page','declining keeps the Studio open');assert.equal(g.api.isDirty(),true);
  g.drawer().dispatchEvent(new g.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(g.api.current(),'page');
  const k=boot();k.api.open('lights');k.drawer().dispatchEvent(new k.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await wait(k.w);
  assert.equal(k.drawer(),null);assert.equal(k.log.includes('asked'),false,'nothing to lose, nothing to ask');
  const o=boot();o.api.open('skins');assert(o.drawer().classList.contains('sd-wide'),'away from My space the skin tool keeps its own preview');assert.equal(o.log.some(l=>l.startsWith('live')),false);
  for(const x of [h,g,k,o]){x.api.stop();x.w.close();}
});
test('a tool opened by any older button arrives in the Studio, and stop() gives showModal back',dom,async()=>{
  const h=boot();
  h.w.BulaSkinStudio.open(null,'All');
  assert.equal(h.api.current(),'skins');assert.equal(h.q('.bv-studio').parentElement.dataset.studioPanel,'skins');assert.equal(h.log.filter(l=>l.startsWith('native modal')).join(),'native modal sd-studio');
  h.w.SotaSpaceDesign.open('music');assert.equal(h.api.current(),'page','asking for the other tool switches to its tab');assert.equal(h.q('.bv-studio').hasAttribute('open'),true);
  const other=h.doc.createElement('dialog');other.className='some-other';h.doc.body.append(other);other.showModal();assert.equal(h.log.at(-1),'native modal some-other','other dialogs are left alone');
  h.api.open('nonsense');assert.equal(h.api.current(),'page');
  h.q('.sd-lights [data-studio-go],[data-studio-go]').click();await wait(h.w);assert.deepEqual(h.went,['music']);assert.equal(h.drawer(),null);
  h.api.stop();h.w.SotaSpaceDesign.open('x');assert.equal(h.log.at(-1),'native modal ssd-editor','after stop the tools open the old way');
  h.w.close();
});
test('the page loads the Studio, the old scattered entries are gone, and the skin tool reports its draft',()=>{
  const html=read('index.html'),sw=read('sw.js'),worlds=read('sota-worlds.js'),css=read('sota-studio.css'),skin=read('skin-studio.js');
  assert.match(html,/<script src="\/sota-studio\.js\?v=[a-z0-9-]+"><\/script>/);assert.match(html,/<link rel="stylesheet" href="\/sota-studio\.css\?v=[a-z0-9-]+">/);
  assert.match(html,/window\.SotaStudio\?\.init\(\{getPage:[^}]*rerender:\(\)=>render\(\),isOwnRoom:/);assert.match(sw,/'\/sota-studio\.js','\/sota-studio\.css'/);
  assert.doesNotMatch(worlds,/Room Studio <i|Skins & collections|>Design this page </);
  assert.match(worlds,/data-world-tool="studio-drawer" aria-haspopup="dialog">Studio /);
  assert.match(skin,/document\.dispatchEvent\(new CustomEvent\('sota-skin-draft',\{detail:\{settings:\{\.\.\.draft\}\}\}\)\)/);assert.match(skin,/window\.BulaSkinStudio=\{musicMarkup,apply,previewLive,/);
  assert.match(css,/dialog\.sd-studio dialog\.sd-hosted :is\(\.ssd-close,\.ssd-actions,\.bv-close,#bv-cancel,#bv-save\)\{display:none!important\}/,'one Save, one Cancel, one close');
  assert.match(css,/dialog\.sd-studio::backdrop\{background:#14263d1f\}/,'the page stays visible behind the drawer');
  assert.match(css,/prefers-reduced-motion:reduce\)\{dialog\.sd-studio\[open\]\{animation:none\}/);
  assert.doesNotMatch(read('sota-studio.js'),/innerHTML|insertAdjacentHTML/);
});
