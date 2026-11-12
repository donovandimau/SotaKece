'use strict';
// Hub zoom map (12 Nov 2026): the starter Koro on the Sentinel-2 mosaic of Fiji, with detail that grows as you zoom.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const windows=[];test.after(()=>windows.forEach(w=>w.close()));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const HUBS=[
  {slug:'suva',name:'Suva',emoji:'🌴',blurb:'The capital and the Central side',members:12,joined:false,crew_id:1},
  {slug:'west',name:'Nadi & Lautoka',emoji:'🌅',blurb:'The West',members:0,joined:false,crew_id:null},
  {slug:'diaspora',name:'UK & overseas',emoji:'✈️',blurb:'Viti away from home',members:23,joined:true,crew_id:3}];

function boot({hubs=HUBS}={}){
  const d=new JSDOM('<!doctype html><body><button id="opener">open</button></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://sotakece.com/'});
  const w=d.window;windows.push(w);
  w.matchMedia=()=>({matches:true});
  w.fetch=async()=>({ok:true,json:async()=>({index:{}})});
  const joined=[],opened=[];
  w.SotaHubs={load:async()=>hubs,joinHub:async slug=>{joined.push(slug);return Object.assign({},hubs.find(h=>h.slug===slug),{joined:true,members:13,crew_id:9});},openHub:c=>opened.push(c)};
  w.eval(read('sota-hub-map.js'));
  return {w,joined,opened,q:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)]};
}

test('projection keeps Fiji in one piece across 180° and round-trips',dom,()=>{
  const d=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});
  const w=d.window;windows.push(w);
  w.fetch=async()=>({ok:false});w.eval(read('sota-hub-map.js'));
  const M=w.SotaHubMap,a=M.project(-17,179.5,10),b=M.project(-17,-179.5,10);
  assert.ok(b.x>a.x,'east of 180° sits to the right of west of it');
  assert.ok(Math.abs((b.x-a.x)-(1/360)*256*1024)<1e-6);
  const p=M.project(-18.1416,178.4419,11),back=M.unproject(p.x,p.y,11);
  assert.ok(Math.abs(back.lat+18.1416)<1e-9&&Math.abs(back.lon-178.4419)<1e-9);
  assert.equal(Math.floor(p.x/256),2039);
  assert.deepEqual([M.detail(7),M.detail(9),M.detail(11)],[1,2,3]);
});

test('opening shows the two Fiji hubs as pins and UK & overseas as a chip',dom,async()=>{
  const h=boot();h.q('#opener').focus();
  assert.equal(await h.w.SotaHubMap.open(),true);
  assert.equal(h.q('.hm-root').hidden,false);
  assert.deepEqual(h.all('.hm-dot').map(b=>b.dataset.slug),['suva','west']);
  assert.match(h.q('.hm-chips').textContent,/UK & overseas/);
  assert.match(h.q('.hm-chips').textContent,/23 members/);
  assert.ok(h.q('.hm-chips [data-hm="open"]'),'a joined hub offers Open Koro');
  assert.match(h.q('.hm-credit').textContent,/Copernicus Sentinel/);
  assert.equal(h.w.document.activeElement,h.q('.hm-close'));
  assert.ok(h.w.SotaHubMap.camera().z<8.5,'it opens on all of the main islands');
  assert.equal(h.all('.hm-label .hm-go').length,0,'far out, pins show names only');
});

test('zooming in adds members, then the blurb and a Join button; joining turns it into Open Koro',dom,async()=>{
  const h=boot();await h.w.SotaHubMap.open();
  h.q('[data-hm="fly"][data-slug="suva"]').click();await wait(30);
  assert.ok(h.w.SotaHubMap.camera().z>10);
  const suva=h.all('.hm-label').find(l=>/Suva/.test(l.textContent));
  assert.match(suva.textContent,/12 members/);
  assert.match(suva.textContent,/The capital and the Central side/);
  h.q('.hm-label [data-hm="join"][data-slug="suva"]').click();await wait(30);
  assert.deepEqual(h.joined,['suva']);
  assert.ok(h.q('.hm-label [data-hm="open"][data-slug="suva"]'),'after joining the button opens the Koro');
  h.q('.hm-label [data-hm="open"][data-slug="suva"]').click();
  assert.deepEqual(h.opened,[9]);
  assert.equal(h.w.SotaHubMap.isOpen(),false,'opening the Koro closes the map');
});

test('keys move and zoom the map, Esc closes it and focus goes back',dom,async()=>{
  const h=boot();const opener=h.q('#opener');opener.focus();await h.w.SotaHubMap.open();
  const z0=h.w.SotaHubMap.camera().z,lon0=h.w.SotaHubMap.camera().lon;
  const key=k=>h.q('.hm-view').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:k,bubbles:true}));
  key('+');assert.ok(h.w.SotaHubMap.camera().z>z0);
  key('ArrowLeft');assert.notEqual(h.w.SotaHubMap.camera().lon,lon0);
  key('Escape');
  assert.equal(h.w.SotaHubMap.isOpen(),false);
  assert.equal(h.q('.hm-root').hidden,true);
  assert.equal(h.w.document.activeElement,opener);
});

// 12 Nov 2026 (Ops task 1050): live phones reported "moved is not a function" at sota-hub-map.js:150.
// A pointer counter `var moved` replaced the moved() function, so every zoom and drag threw before the map redrew.
test('zooming and dragging redraw the pins without a script error',dom,async()=>{
  const {VirtualConsole}=require(process.env.JSDOM_MODULE||'jsdom');
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(String(e&&(e.detail||e.message)||e)));
  const d=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://sotakece.com/',virtualConsole:vc});
  const w=d.window;windows.push(w);
  w.matchMedia=()=>({matches:true});
  w.fetch=async()=>({ok:true,json:async()=>({index:{}})});
  w.SotaHubs={load:async()=>HUBS};
  w.HTMLElement.prototype.setPointerCapture=function(){};
  w.eval(read('sota-hub-map.js'));
  const M=w.SotaHubMap;await M.open();
  const view=w.document.querySelector('.hm-view');
  const suva=()=>w.document.querySelector('.hm-dot[data-slug="suva"]').style.left;
  const frame=()=>new Promise(r=>w.requestAnimationFrame(()=>r()));
  const ptr=(type,x,y)=>{const e=new w.MouseEvent(type,{clientX:x,clientY:y,bubbles:true});Object.defineProperty(e,'pointerId',{value:1});view.dispatchEvent(e);};
  const steps=[
    ['+ key',()=>view.dispatchEvent(new w.KeyboardEvent('keydown',{key:'+',bubbles:true}))],
    ['zoom out button',()=>w.document.querySelector('[data-hm="out"]').click()],
    ['wheel',()=>view.dispatchEvent(new w.WheelEvent('wheel',{deltaY:-200,clientX:100,clientY:100,bubbles:true,cancelable:true}))],
    ['arrow key',()=>view.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))],
    ['drag',()=>{ptr('pointerdown',100,100);ptr('pointermove',160,130);ptr('pointerup',160,130);}],
    ['double tap',()=>view.dispatchEvent(new w.MouseEvent('dblclick',{clientX:120,clientY:140,bubbles:true}))]];
  for(const [name,act] of steps){
    const before=suva();act();await frame();await frame();
    assert.deepEqual(errors,[],name+' threw');
    assert.notEqual(suva(),before,name+' moved the Suva pin on screen');
  }
});

test('the map script never reuses the moved() name for something else',()=>{
  const src=read('sota-hub-map.js');
  assert.equal((src.match(/\bfunction moved\(/g)||[]).length,1);
  assert.doesNotMatch(src,/\b(?:var|let|const)\s+(?:[\w$]+\s*=\s*[^,;]+,\s*)*moved\b|[,]\s*moved\s*=/);
  assert.doesNotMatch(src,/\bmoved\s*(?:\+?=)(?!=)/);
});

test('no hubs, no map',dom,async()=>{
  const h=boot({hubs:[]});
  assert.equal(await h.w.SotaHubMap.open(),false);
  assert.equal(h.q('.hm-root'),null);
});

test('the starter Koro card offers the map only when the map is loaded, and the map joins through the card code',dom,async()=>{
  const d=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only',url:'https://sotakece.com/'});const w=d.window;windows.push(w);
  w.eval(read('sota-hubs.js'));
  const hubs=[{slug:'suva',name:'Suva',emoji:'🌴',members:1,joined:false,crew_id:1}];
  const calls=[],toasts=[];
  w.SotaHubs.init({client:{rpc:async(n,a)=>{calls.push([n,a]);return {data:{slug:'suva',name:'Suva',joined:true,members:2,crew_id:5},error:null};}},state:{user:{id:'u1'}},toast:m=>toasts.push(m),esc:x=>String(x),openRoom(){},openKoro:id=>calls.push(['open',id])});
  assert.doesNotMatch(w.SotaHubs.body('wall',hubs,[]),/data-hubmap/);
  w.SotaHubMap={};
  assert.match(w.SotaHubs.body('wall',hubs,[]),/<button type="button" class="btn sm ghost hub-map-btn" data-hubmap>See them on the map<\/button>/);
  const row=await w.SotaHubs.joinHub('suva');
  assert.equal(row.joined,true);
  assert.equal(calls[0][0],'bv_hub_join');assert.equal(calls[0][1].p_slug,'suva');
  assert.deepEqual(toasts,['You are in Suva. Say bula.']);
  w.SotaHubs.openHub(5);assert.deepEqual(calls[1],['open',5]);
});

test('the page loads the map the house way',()=>{
  const html=read('index.html'),sw=read('sw.js'),shell=read('sota-premium-shell.js');
  assert.match(html,/<script src="\/sota-tour\.js\?v=[^"]+"><\/script><script src="\/sota-hub-map\.js\?v=[^"]+"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\/sota-hub-map\.css\?v=/);
  assert.match(sw,/'\/sota-hub-map\.js','\/sota-hub-map\.css'/);
  assert.match(shell,/label:'Hub map'[^\n]*run:function\(\)\{window\.SotaHubMap&&window\.SotaHubMap\.open\(\);\}/);
});
