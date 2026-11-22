'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),model=require('../space-design.js');
const colours={
 lagoon:'Fiji Lagoon',sunset:'Island Sunset',electric:'Bula Beats',ocean:'Pacific Blue',night:'Reef Night',garden:'Tropical Grove',
 'neon-cyan':'Reef Glow','neon-blue':'Pacific Neon','neon-purple':'Island Violet','neon-pink':'Hibiscus Pink','neon-orange':'Sunset Amber','neon-green':'Rainforest Green',volcanic:'Volcanic Dark'
};
const lum=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);

test('island palette revision preserves all saved IDs and explicit personal colours',()=>{
 assert.deepEqual(Object.keys(model.palettes),Object.keys(colours));
 for(const [palette,name]of Object.entries(colours)){
  assert.equal(model.palettes[palette].name,name);
  const old={version:1,pages:{home:{palette,accent:'#aa3355',background:'#fef7e1',imageId:'img-personal',font:'editorial',textSize:'larger',buttonStyle:'outline',wallpaperFit:'tile',wallpaperPosition:'bottom'}}};
  const updated=model.normalizeRecord(old);
  assert.equal(updated.version,1);assert.equal(updated.pages.home.palette,palette);
  for(const field of ['accent','background','imageId','font','textSize','buttonStyle','wallpaperFit','wallpaperPosition'])assert.equal(updated.pages.home[field],old.pages.home[field]);
 }
 assert.equal(model.palettes['neon-cyan'].accent,'#59ebf0');assert.equal(model.palettes['neon-blue'].accent,'#72adff');
 assert.equal(model.palettes['neon-purple'].accent,'#c29aff');assert.equal(model.palettes['neon-pink'].accent,'#ff96ce');
 assert.equal(model.palettes['neon-orange'].accent,'#ffb772');assert.equal(model.palettes['neon-green'].accent,'#89edab');
});

test('all regional palette content and chosen button foregrounds meet AA contrast',()=>{
 for(const [id,palette]of Object.entries(model.palettes)){
  for(const surface of ['panel','background'])for(const text of ['ink','muted'])assert.ok(ratio(palette[surface],palette[text])>=4.5,id+' '+text+' on '+surface);
  assert.ok(ratio(palette.accent,model.contrast(palette.accent))>=4.5,id+' button');
 }
});

test('native and Revised deliver the same regional page designer',()=>{
 for(const name of ['space-design.js','space-design.css'])assert.deepEqual(fs.readFileSync(path.join(root,name)),fs.readFileSync(path.join(root,'revised/live',name)),name+' must match');
});

let JSDOM;try{({JSDOM}=require('jsdom'));}catch{}
test('the island designer previews, saves and reloads a regional mood while retaining every option',{skip:!JSDOM&&'Optional jsdom is not installed'},async()=>{
 const dom=new JSDOM('<!doctype html><body><main id="app" data-front-page="home"><audio id="sound"></audio><p>My people and moments</p></main></body>',{url:'https://sotakece.com/#home',runScripts:'outside-only'}),w=dom.window,d=w.document,app=d.getElementById('app');
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');queueMicrotask(()=>this.dispatchEvent(new w.Event('close')));};
 w.eval(fs.readFileSync(path.join(root,'space-design.js'),'utf8'));const api=w.SotaSpaceDesign;
 const flush=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
 try{
  api.init({getOwner:()=> 'member-A'});api.mount(app);const audio=d.getElementById('sound');api.open('home');
  const dialog=d.getElementById('ssd-editor');assert.match(dialog.querySelector('.ssd-local').textContent,/Fiji, the Pacific and the tropics/);
  assert.equal(dialog.querySelector('.ssd-head small').textContent,'FIJI · PACIFIC · TROPICAL');
  assert.equal(dialog.querySelector('[data-ssd-quick="neon-pink"]').textContent,'Hibiscus Pink');
  dialog.querySelector('[data-ssd-mode="mix"]').click();dialog.querySelector('[data-ssd-palette="sunset"]').click();
  assert.equal(app.style.getPropertyValue('--ssd-accent'),model.palettes.sunset.accent);assert.equal(app.style.getPropertyValue('--ssd-background'),model.palettes.sunset.background);
  assert.match(dialog.querySelector('[data-ssd-preview]').textContent,/Pacific colour/);
  for(const field of ['font','textSize','buttonStyle','corners','density','frame','wallpaperFit','wallpaperPosition'])assert.ok(dialog.querySelector('[data-ssd-'+field+']'));
  dialog.querySelector('.ssd-save').click();await flush();assert.equal(api.read(w.localStorage,'member-A').pages.home.palette,'sunset');
  api.mount(app);api.open('home');assert.equal(dialog.querySelector('[data-ssd-palette="sunset"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.getElementById('sound'),audio);assert.equal(app.querySelector('p').textContent,'My people and moments');
  const other=api.read(w.localStorage,'member-B');assert.equal(other.version,1);assert.equal(Object.keys(other.pages).length,0);
 }finally{api.stop();dom.window.close();}
});
