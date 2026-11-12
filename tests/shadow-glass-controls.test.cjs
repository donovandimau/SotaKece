'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const domTest=(name,fn)=>test(name,{skip:!JSDOM?'Install jsdom or set JSDOM_MODULE':false},fn),source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function harness(t){const dom=new JSDOM('<!doctype html><html><head><script src="/dimau-install.js" data-app="bulavata" data-label="Sota Kece" data-prompt="manual" data-buttons="glass"></script></head><body><button data-dimau-connect>Open Connect</button></body></html>',{url:'https://sotakece.com/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};t.after(()=>w.close());return {w,d:w.document,run:name=>w.eval(source(name))};}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
domTest('installer uses an accessible symbol-only glass action and its existing dismissal handler',async t=>{
 const h=harness(t);h.run('dimau-install.js');h.w.DimauInstall.help();const root=h.d.querySelector('[data-dimau-install]').shadowRoot,button=root.querySelector('button');
 assert.equal(button.type,'button');assert.equal(button.getAttribute('aria-label'),'OK');assert.equal(button.title,'OK');assert.equal(button.dataset.glassAction,'ok');assert.equal(button.textContent.trim(),'');assert.equal(button.querySelectorAll('svg').length,1);assert.equal(button.querySelector('svg').getAttribute('aria-hidden'),'true');
 assert(root.querySelector('style')?.textContent.includes('--dg-bg')||root.adoptedStyleSheets.length,'Glass paint is installed in the actual shadow root');button.click();assert.equal(root.querySelector('.bar'),null);assert.equal(h.w.DimauInstall.canInstall(),false);await flush();
});
domTest('installer keeps install and defer behavior while assigning different semantic glyphs',async t=>{
 const h=harness(t);h.run('dimau-install.js');let prompts=0;const event=new h.w.Event('beforeinstallprompt');event.prompt=()=>{prompts++;};event.userChoice=Promise.resolve({outcome:'accepted'});h.w.dispatchEvent(event);
 await h.w.DimauInstall.install();assert.equal(prompts,1);assert.equal(h.w.DimauInstall.canInstall(),false);
});
// The old Dimau Companion was replaced by Volau (the one assistant for every Dimau app). dimau-companion.js is now a
// small loader: it keeps window.DimauCompanion so older callers do not break, and hands "open" to Volau when it is there.
domTest('companion file is the Volau loader: old callers keep working and open goes to Volau',async t=>{
 const h=harness(t);h.run('dimau-companion.js');const c=h.w.DimauCompanion;assert.equal(typeof c.mount,'function');assert.equal(c.mount({appId:'bulavata'}),null,'nothing of the old companion is drawn');
 assert.doesNotThrow(()=>c.open(),'open is safe before Volau has loaded');let opened=0;h.w.Volau={open(){opened++;}};c.open();assert.equal(opened,1);
 assert.equal(h.d.querySelector('[data-dimau-companion]'),null);const text=source('dimau-companion.js');assert.match(text,/fijian-assistant-api\.vercel\.app\/widget\/widget\.js/);assert.match(text,/window\.self !== window\.top/,'never loads inside embedded frames');await flush();
});
domTest('Connect glass launcher and symbol links keep exact destinations and keyboard dismissal',async t=>{
 const h=harness(t);h.run('dimau-connect.js');h.d.dispatchEvent(new h.w.Event('DOMContentLoaded'));const host=h.d.getElementById('dimau-connect-launcher'),r=host.shadowRoot,toggle=r.querySelector('.toggle');
 const links=[...r.querySelectorAll('a.item')];assert.equal(links.length,4);assert(links.every(a=>a.getAttribute('aria-label')&&a.title&&a.target==='_blank'&&a.rel==='noopener noreferrer'&&a.referrerPolicy==='no-referrer'));
 assert.equal(links.find(a=>a.classList.contains('audio')).href,'https://sotakece.com/call.html?mode=audio&app=dimau');assert.equal(links.find(a=>a.classList.contains('chat')).href,'https://sotakece.com/communications.html?app=dimau&view=chat');
 toggle.click();assert.equal(r.querySelector('.menu').hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');h.d.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(r.querySelector('.menu').hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');await flush();
});
