'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const model=require('../space-design.js'),source=fs.readFileSync(path.join(__dirname,'../space-design.js'),'utf8');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch{}
const domTest=(name,fn)=>test(name,{skip:!JSDOM&&'Optional jsdom is not installed'},fn),flush=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
function fixture({owner='',route='home',pathname='/',blocked=false}={}){
 const dom=new JSDOM('<!doctype html><body><main id="app"><audio id="sound"></audio><section class="card">Keep this content</section></main></body>',{url:'https://sotakece.com'+pathname,runScripts:'outside-only'}),w=dom.window,d=w.document,app=d.getElementById('app'),records=new Map(),images=new Map();let who=owner,tab='profile',putGate=null;
 if(route)app.dataset.frontPage=route;
 const storage={getItem:key=>records.get(key)||null,setItem:(key,value)=>{if(blocked)throw Error('Storage is blocked.');records.set(key,value);}};
 Object.defineProperty(w,'localStorage',blocked?{get(){throw Error('Storage is blocked.');},configurable:true}:{value:storage,configurable:true});
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');queueMicrotask(()=>{if(w.document)this.dispatchEvent(new w.Event('close'));});};
 let urls=0;w.URL.createObjectURL=()=> 'blob:preview-'+(++urls);w.URL.revokeObjectURL=()=>{};w.createImageBitmap=async()=>({width:800,height:600,close(){}});
 const db={objectStoreNames:{contains:()=>true},transaction(){const tx={};tx.objectStore=()=>{const operation=(kind,value,key)=>{const request={};queueMicrotask(async()=>{if(kind==='put'&&putGate)await putGate;if(kind==='put')images.set(key,value);if(kind==='delete')images.delete(key);request.result=kind==='get'?images.get(key):undefined;request.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return request;};return {get:key=>operation('get',null,key),put:(value,key)=>operation('put',value,key),delete:key=>operation('delete',null,key)};};return tx;}};
 w.indexedDB={open(){const request={};queueMicrotask(()=>{request.result=db;request.onsuccess?.();});return request;}};
 w.eval(source);const api=w.SotaSpaceDesign;api.init({getOwner:()=>who,getPage:()=>tab});api.mount(app);
 const q=s=>d.querySelector(s),change=(selector,value)=>{const node=q(selector);node.value=value;node.dispatchEvent(new w.Event('input',{bubbles:true}));},pick=key=>{q('[data-ssd-mode="mix"]').click();q('[data-ssd-palette="'+key+'"]').click();};
 return {w,d,dom,api,app,records,images,q,change,pick,owner:v=>who=v,tab:v=>tab=v,holdPut:p=>putGate=p,async upload(){const file=new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3])],{type:'image/png'}),input=q('[data-ssd-image]');Object.defineProperty(input,'files',{configurable:true,value:[file]});input.dispatchEvent(new w.Event('change'));await flush();},close(){api.stop();dom.window.close();}};
}
test('design records whitelist pages, colours and layouts without arbitrary CSS or URLs',()=>{
 const r=model.normalizeRecord({version:1,pages:{home:{accent:'red;url(javascript:x)',background:'https://evil.test',density:'fixed',corners:'evil',imageId:'https://evil.test'},unknown:{accent:'#ffffff'}}});
 assert.deepEqual(Object.keys(r.pages),['home']);assert.match(r.pages.home.accent,/^#[0-9a-f]{6}$/);assert.equal(r.pages.home.imageId,'');assert.equal(r.pages.home.density,'spacious');assert.equal(r.pages.home.corners,'round');
 assert.notEqual(model.storageKey('A'),model.storageKey('B'));assert.notEqual(model.storageKey(''),model.storageKey('A'));assert.equal(model.currentPage(null,'/call.html'),'communications');
 assert.equal(model.contrast('#ffffff'),'#142438');assert.equal(model.contrast('#000000'),'#ffffff');
});
domTest('live preview and cancel restore saved styles without replacing content or audio',async()=>{
 const f=fixture();try{const sound=f.q('#sound'),card=f.q('.card');f.api.open();assert.equal(f.q('.ssd-more').open,false);f.pick('sunset');assert.equal(f.app.style.getPropertyValue('--ssd-accent'),model.palettes.sunset.accent);f.change('[data-ssd-density]','compact');f.change('[data-ssd-corners]','square');f.change('[data-ssd-frame]','wide');assert.equal(f.app.dataset.spaceFrame,'wide');assert.equal(f.app.dataset.spaceDensity,'compact');assert.equal(f.app.dataset.spaceCorners,'square');f.q('.ssd-cancel').click();await flush();assert.equal(f.app.hasAttribute('data-space-designed'),false);assert.equal(f.q('#sound'),sound);assert.equal(f.q('.card'),card);assert.equal(f.records.size,0);}finally{f.close();}
});
domTest('saving and remounting applies per-page settings, All pages fallback and shared dialog tokens',async()=>{
 const f=fixture();try{f.api.open('all');f.pick('garden');f.q('.ssd-save').click();await flush();assert.equal(f.app.style.getPropertyValue('--ssd-accent'),model.palettes.garden.accent);assert.equal(f.d.documentElement.style.getPropertyValue('--sota-user-accent'),model.palettes.garden.accent);f.api.open('music');f.pick('night');f.q('.ssd-save').click();await flush();f.app.dataset.frontPage='music';await flush();assert.equal(f.app.style.getPropertyValue('--ssd-accent'),model.palettes.night.accent);assert.equal(f.d.documentElement.style.getPropertyValue('--ssd-ink'),model.palettes.night.ink);f.app.dataset.frontPage='skins';await flush();assert.equal(f.app.style.getPropertyValue('--ssd-accent'),model.palettes.garden.accent);f.api.mount(f.app);assert.equal(f.d.querySelectorAll('.ssd-launcher').length,1);assert.equal(f.app.style.getPropertyValue('--ssd-accent'),model.palettes.garden.accent);f.api.open('all');f.q('.ssd-reset').click();f.q('.ssd-save').click();await flush();assert.equal(f.app.hasAttribute('data-space-designed'),false);}finally{f.close();}
});
domTest('guest and account preferences never mix, and signed-in routes can have individual designs',async()=>{
 const f=fixture({route:null});try{f.tab('friends');f.api.open();f.pick('electric');f.q('.ssd-save').click();await flush();assert.equal(JSON.parse(f.records.get(model.storageKey(''))).pages.friends.palette,'electric');f.owner('member-A');f.api.mount(f.app);assert.equal(f.app.hasAttribute('data-space-designed'),false);f.api.open();f.pick('sunset');f.q('.ssd-save').click();await flush();f.owner('member-B');f.api.apply();assert.equal(f.app.hasAttribute('data-space-designed'),false);f.owner('');f.api.mount(f.app);assert.equal(f.app.style.getPropertyValue('--ssd-accent'),model.palettes.electric.accent);}finally{f.close();}
});
domTest('blocked storage leaves an explicit unsaved preview with a working cancel',async()=>{
 const f=fixture({blocked:true});try{f.api.open();f.pick('sunset');f.q('.ssd-save').click();await flush();assert.equal(f.q('#ssd-editor').open,true);assert.match(f.q('[data-ssd-status]').textContent,/could not save/);assert.equal(f.q('.ssd-save').disabled,false);f.q('.ssd-cancel').click();assert.equal(f.app.hasAttribute('data-space-designed'),false);}finally{f.close();}
});
domTest('queued close events cannot clear a newly opened editor draft',async()=>{
 const f=fixture();try{f.api.open();f.pick('sunset');f.q('.ssd-cancel').click();f.api.open();f.pick('night');await flush();assert.equal(f.q('#ssd-editor').open,true);assert.equal(f.app.style.getPropertyValue('--ssd-accent'),model.palettes.night.accent);f.q('.ssd-save').click();await flush();assert.equal(JSON.parse(f.records.get(model.storageKey(''))).pages.home.palette,'night');}finally{f.close();}
});
domTest('local background blobs are partitioned and stale image saves cannot write into the next account',async()=>{
 const f=fixture({owner:'A'});try{f.api.open();f.pick('sunset');await f.upload();assert.match(f.q('[data-ssd-status]').textContent,/preview ready/);let release;f.holdPut(new Promise(resolve=>release=resolve));f.q('.ssd-save').click();await flush();f.owner('B');release();await flush();assert.equal(f.records.has(model.storageKey('B')),false);assert.equal(f.records.has(model.storageKey('A')),false);assert.equal(f.images.size,0);assert.equal(f.app.hasAttribute('data-space-designed'),false);f.api.open();assert.equal(f.q('.ssd-save').disabled,false);}finally{f.close();}
});
domTest('invalid, truncated and oversized image data cannot enter a saved design',async()=>{
 const f=fixture();try{const api=f.api;await assert.rejects(api.validateImage(new Blob(['<svg/>'],{type:'image/svg+xml'})),/PNG/);await assert.rejects(api.validateImage(new Blob(['bad'],{type:'image/png'})),/not a supported/);f.w.createImageBitmap=async()=>{throw Error('Truncated image');};await assert.rejects(api.validateImage(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])],{type:'image/png'})),/Truncated/);f.w.createImageBitmap=async()=>({width:12000,height:10000,close(){}});await assert.rejects(api.validateImage(new Blob([new Uint8Array([255,216,255,0])],{type:'image/jpeg'})),/8192/);}finally{f.close();}
});

domTest('reset and remove image cancel a pending decode without leaving Save stuck',async()=>{
 for(const action of ['.ssd-reset','.ssd-text-button']){const f=fixture();try{f.api.open();f.pick('sunset');let release;f.w.createImageBitmap=()=>new Promise(resolve=>release=resolve);const pending=f.upload();await flush();f.q(action).click();f.q('.ssd-save').click();await flush();assert.equal(f.q('#ssd-editor').open,false);assert(f.records.has(model.storageKey('')));release({width:800,height:600,close(){}});await pending;assert.equal(f.images.size,0);}finally{f.close();}}
});

domTest('Escape during an image save permits reopening and a new save before the old write finishes',async()=>{
 const f=fixture();try{f.api.open();await f.upload();let release;f.holdPut(new Promise(resolve=>release=resolve));f.q('.ssd-save').click();await flush();f.q('#ssd-editor').dispatchEvent(new f.w.Event('cancel',{cancelable:true}));f.api.open();assert.equal(f.q('.ssd-save').disabled,false);f.pick('garden');f.q('.ssd-save').click();await flush();assert.equal(f.q('#ssd-editor').open,false);release();await flush();assert.equal(JSON.parse(f.records.get(model.storageKey(''))).pages.home.palette,'garden');assert.equal(f.images.size,0);}finally{f.close();}
});

domTest('a nested design editor preserves the original open account form and its values',async()=>{
 const f=fixture();try{const original=f.d.createElement('dialog');original.className='bv-account-dialog';original.innerHTML='<header class="bv-account-head"><h2>Sign in</h2><button type="button" aria-label="Close account form">×</button></header><form><input name="email" value="keep@example.test"><input name="password" type="password" value="keep-this-value"></form>';f.d.body.append(original);original.showModal();const clean=f.api.decorateDialog(original);f.api.decorateDialog(original);assert.equal(original.querySelectorAll('.ssd-dialog-design').length,1);const control=original.querySelector('.ssd-dialog-design');assert.equal(control.getAttribute('aria-label'),'Design this page');control.click();assert.equal(original.open,true);assert.equal(f.q('#ssd-editor').open,true);assert.equal(f.q('#ssd-editor').dataset.designMode,'mix');f.pick('garden');f.q('.ssd-cancel').click();await flush();assert.equal(original.open,true);assert.equal(original.querySelector('[name=email]').value,'keep@example.test');assert.equal(original.querySelector('[name=password]').value,'keep-this-value');assert.equal(f.d.activeElement,control);clean();clean();assert.equal(original.querySelector('.ssd-dialog-design'),null);}finally{f.close();}
});

domTest('the same launcher moves into new navigation after app content is replaced',()=>{
 const f=fixture();try{const launcher=f.q('.ssd-launcher');assert.equal(launcher.getAttribute('aria-label'),'Design your space');f.app.innerHTML='<nav class="sfp-navigation"><a href="#home">Home</a></nav>';f.api.mount(f.app);assert.equal(f.q('.sfp-navigation .ssd-launcher'),launcher);assert(launcher.classList.contains('ssd-hosted-launcher'));f.app.innerHTML='<header class="top"><span>Your room</span></header>';f.api.mount(f.app);assert.equal(f.q('header.top .ssd-launcher'),launcher);assert.equal(f.d.querySelectorAll('.ssd-launcher').length,1);launcher.click();assert.equal(f.q('#ssd-editor').open,true);}finally{f.close();}
});
domTest('one tap colours the whole site while retaining per-page layouts and image references; Undo restores it',async()=>{
 const f=fixture();try{const before=model.normalizeRecord({version:1,pages:{all:{palette:'garden',density:'compact',frame:'wide',corners:'square',imageId:'img-root'},music:{palette:'night',density:'spacious',frame:'centred',corners:'round',imageId:'img-music'}}});f.records.set(model.storageKey(''),JSON.stringify(before));f.images.set('guest:img-root',new Blob(['keep']));f.images.set('guest:img-music',new Blob(['keep']));f.api.mount(f.app);const sound=f.q('#sound');f.api.open();assert.equal(f.q('#ssd-one-panel').hidden,false);f.q('[data-ssd-quick="neon-cyan"]').click();await flush();assert.equal(f.q('#ssd-editor').open,false);const after=JSON.parse(f.records.get(model.storageKey('')));for(const entry of Object.values(after.pages)){assert.equal(entry.palette,'neon-cyan');assert.equal(entry.accent,'#59ebf0');}assert.equal(after.pages.all.frame,'wide');assert.equal(after.pages.all.density,'compact');assert.equal(after.pages.music.frame,'centred');assert.equal(after.pages.music.imageId,'img-music');assert.equal(f.images.size,2);assert.equal(f.q('#sound'),sound);f.app.dataset.frontPage='music';await flush();assert.equal(f.app.style.getPropertyValue('--ssd-accent'),'#59ebf0');assert.equal(f.app.dataset.spaceColourMode,'one');assert.equal(f.d.documentElement.dataset.spaceDialogColourMode,'one');f.q('.ssd-undo').click();await flush();assert.deepEqual(JSON.parse(f.records.get(model.storageKey(''))),before);assert.equal(f.app.dataset.spaceColourMode,'mix');assert.equal(f.d.documentElement.dataset.spaceDialogColourMode,'mix');assert.equal(f.images.size,2);assert.equal(f.q('.ssd-design-feedback'),null);}finally{f.close();}
});
domTest('quick colour and Undo guard account changes and do not overwrite another design',()=>{
 const f=fixture({owner:'A'});try{f.api.open();f.owner('B');assert.equal(f.api.quickApply('neon-pink'),false);assert.equal(f.records.size,0);f.api.open();assert.equal(f.api.quickApply('neon-blue'),true);const b=f.records.get(model.storageKey('B'));f.owner('C');assert.equal(f.api.undoQuick(),false);assert.equal(f.records.get(model.storageKey('B')),b);assert.equal(f.records.has(model.storageKey('C')),false);f.owner('B');f.api.mount(f.app);assert.equal(f.api.quickApply('neon-green'),true);const newer=model.normalizeRecord({version:1,pages:{all:{palette:'sunset'}}});f.records.set(model.storageKey('B'),JSON.stringify(newer));assert.equal(f.api.undoQuick(),false);assert.deepEqual(JSON.parse(f.records.get(model.storageKey('B'))),newer);}finally{f.close();}
});
domTest('blocked storage never applies or reports a successful one-colour save',()=>{
 const f=fixture({blocked:true});try{f.api.open();assert.equal(f.api.quickApply('neon-orange'),false);assert.equal(f.app.hasAttribute('data-space-designed'),false);assert.equal(f.q('#ssd-editor').open,true);assert.match(f.q('[data-ssd-status]').textContent,/Nothing was changed/);assert.equal(f.q('.ssd-design-feedback'),null);}finally{f.close();}
});
domTest('a quick colour chosen inside an account dialog keeps Undo inside that active dialog',async()=>{
 const f=fixture();try{const account=f.d.createElement('dialog');account.innerHTML='<header><h2>Sign in</h2><button type="button" aria-label="Close account">×</button></header><input value="keep me">';f.d.body.append(account);account.showModal();f.api.decorateDialog(account);account.querySelector('.ssd-dialog-design').click();f.q('[data-ssd-quick="neon-purple"]').click();await flush();assert.equal(account.open,true);assert.equal(account.querySelector('input').value,'keep me');assert.equal(account.querySelector('.ssd-undo'),f.q('.ssd-undo'));assert.equal(account.querySelector('.ssd-design-feedback').hasAttribute('data-floating'),false);account.querySelector('.ssd-undo').click();assert.equal(f.app.hasAttribute('data-space-designed'),false);}finally{f.close();}
});

domTest('Volcanic Dark previews, cancels and persists for the selected page and account',async()=>{
 const f=fixture({owner:'A',route:'pulse'});
 try{
  const audio=f.q('#sound');
  f.api.open('pulse');f.pick('volcanic');
  assert.equal(f.app.dataset.spacePalette,'volcanic');
  f.q('.ssd-cancel').click();await flush();
  assert.equal(f.app.dataset.spacePalette,undefined);
  f.api.open('pulse');f.pick('volcanic');f.q('.ssd-save').click();await flush();
  f.api.mount(f.app);
  assert.equal(f.app.dataset.spacePalette,'volcanic');
  f.app.dataset.frontPage='music';await flush();
  assert.equal(f.app.dataset.spacePalette,undefined);
  f.app.dataset.frontPage='pulse';await flush();
  assert.equal(f.app.dataset.spacePalette,'volcanic');
  assert.equal(f.q('#sound'),audio);
  f.owner('B');f.api.mount(f.app);
  assert.equal(f.app.dataset.spacePalette,undefined);
 }finally{f.close();}
});
