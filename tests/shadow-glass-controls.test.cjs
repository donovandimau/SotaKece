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
domTest('companion glass icons retain settings, hide, restore and clear behavior without touching the mascot or form',async t=>{
 const h=harness(t);h.run('dimau-companion.js');const companion=h.w.DimauCompanion.mount({appId:'bulavata'}),r=companion.shadowRoot;
 const names=['settings-toggle','close','hide','restore','attach','clear-context','read','send','stop','clear'];
 for(const name of names){const b=r.querySelector('.'+name);assert(b.classList.contains('dg-action'));assert(b.getAttribute('aria-label'));assert.equal(b.title,b.getAttribute('aria-label'));assert.equal(b.textContent.trim(),'');assert.equal(b.querySelectorAll('.dg-symbol').length,1);}
 assert(r.querySelector('.bubble .art svg'),'The original companion character remains');assert(r.querySelector('[data-glass-controls]').textContent.includes('backdrop-filter'));
 const question=r.querySelector('textarea');question.value='Keep this draft';companion.open();r.querySelector('.settings-toggle').click();assert.equal(r.querySelector('.settings').hidden,false);assert.equal(r.querySelector('.settings-toggle').getAttribute('aria-expanded'),'true');
 r.querySelector('.hide').click();assert.equal(r.querySelector('.restore').hidden,false);assert.equal(r.querySelector('.anchor').hidden,true);
 // jsdom does not cascade shadow CSS; apply the exact two shipped stylesheets to
 // a detached-control probe to exercise their relative/fixed cascade directly.
 const style=h.d.createElement('style');style.textContent=source('dimau-companion.css')+'\n'+r.querySelector('[data-glass-controls]').textContent;h.d.head.append(style);
 const restoreProbe=r.querySelector('.restore').cloneNode(true);h.d.body.append(restoreProbe);assert.equal(h.w.getComputedStyle(restoreProbe).position,'fixed','Show companion stays docked after Hide rather than moving into the zero-size host');restoreProbe.remove();style.remove();
 r.querySelector('.restore').click();assert.equal(r.querySelector('.anchor').hidden,false);assert.equal(question.value,'Keep this draft');
 companion.open();r.querySelector('.clear').click();assert.equal(question.value,'');assert.equal(r.querySelector('.conversation').children.length,1);assert.equal(r.querySelector('.read').disabled,true,'Unsupported speech remains disabled');assert.equal(r.querySelector('.stop').hidden,true);
 assert.equal(r.querySelector('.send').type,'submit');assert.equal(r.querySelector('.clear-context').hidden,true);companion.destroy();await flush();
});
domTest('companion suggested tasks keep readable labels and existing local callbacks',async t=>{
 const h=harness(t);h.run('dimau-companion.js');let calls=0;const c=h.w.DimauCompanion.mount({appId:'bulavata',actions:{group(){calls++;}}}),r=c.shadowRoot,tasks=[...r.querySelectorAll('.tasks button')];assert(tasks.length);for(const b of tasks){assert(b.querySelector('svg'));assert(b.querySelector('span').textContent.trim(),'Explanatory task text remains visible');assert.equal(b.type,'button');}
 const task=tasks.find(b=>b.textContent.includes('community'));assert(task);task.click();assert.equal(calls,1);assert(r.querySelector('.conversation').lastElementChild.textContent.length>0);c.destroy();await flush();
});
domTest('companion symbol send submits locally with the same textarea and preserves pending state guards',async t=>{
 const h=harness(t);h.run('dimau-companion.js');const c=h.w.DimauCompanion.mount({appId:'bulavata'}),r=c.shadowRoot,q=r.querySelector('textarea');q.value='Find my community';r.querySelector('.send').click();await flush();assert.equal(r.querySelector('textarea'),q);assert(r.querySelectorAll('.message').length>=3);assert.equal(r.querySelector('.send').disabled,false);assert.equal(r.querySelector('.stop').hidden,true);assert(r.querySelector('.send svg'));c.destroy();
});
domTest('Connect glass launcher and symbol links keep exact destinations and keyboard dismissal',async t=>{
 const h=harness(t);h.run('dimau-connect.js');h.d.dispatchEvent(new h.w.Event('DOMContentLoaded'));const host=h.d.getElementById('dimau-connect-launcher'),r=host.shadowRoot,toggle=r.querySelector('.toggle');
 assert(r.querySelector('[data-glass-controls]').textContent.includes('.item .ic'));const links=[...r.querySelectorAll('a.item')];assert.equal(links.length,4);assert(links.every(a=>a.getAttribute('aria-label')&&a.title&&a.target==='_blank'&&a.rel==='noopener noreferrer'&&a.referrerPolicy==='no-referrer'));
 assert.equal(links.find(a=>a.classList.contains('audio')).href,'https://sotakece.com/call.html?mode=audio&app=dimau');assert.equal(links.find(a=>a.classList.contains('chat')).href,'https://sotakece.com/communications.html?app=dimau&view=chat');
 toggle.click();assert.equal(r.querySelector('.menu').hidden,false);assert.equal(toggle.getAttribute('aria-expanded'),'true');h.d.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(r.querySelector('.menu').hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');await flush();
});
