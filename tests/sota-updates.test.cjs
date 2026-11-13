'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const domTest=(name,fn)=>test(name,{skip:!JSDOM?'Install jsdom to check safe live updates':false},fn);
const source=fs.readFileSync(path.join(__dirname,'../offline.js'),'utf8'),flush=()=>new Promise(r=>setImmediate(r));
function harness(t,{current='sota-kece-shell-old',worker='sota-kece-shell-new'}={}){
 const dom=new JSDOM('<!doctype html><meta name="sota-release" content="'+current+'"><button data-dimau-menu-toggle>Menu</button><textarea id="draft"></textarea><input type="search" id="filter">',{url:'https://sotakece.com/',pretendToBeVisual:true}),d=dom.window.document,handlers={},events={},calls={reloads:0,register:[],updates:0};
 const sw={release:worker,controller:{postMessage(_data,ports){ports[0].postMessage({type:'SOTA_RELEASE',release:sw.release});}},addEventListener(k,fn){handlers[k]=fn;},register:async(...args)=>{calls.register.push(args);return{update:async()=>calls.updates++};}};
 const win={addEventListener(k,fn){events[k]=fn;},location:{reload(){calls.reloads++;}}};
 class Channel{constructor(){this.port1={onmessage:null,close(){}};this.port2={postMessage:value=>this.port1.onmessage?.({data:value}),close(){}};}}
 vm.runInNewContext(source,{document:d,navigator:{onLine:true,serviceWorker:sw},window:win,MessageChannel:Channel,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,Date});
 t.after(()=>dom.window.close());events.load?.();return{d,w:dom.window,sw,handlers,calls,get:s=>d.querySelector(s),async ready(){await flush();},newRelease(value){sw.release=value;handlers.message({source:sw.controller,data:{type:'SOTA_RELEASE',release:value}});}};
}
const hide=h=>{Object.defineProperty(h.d,'visibilityState',{value:'hidden',configurable:true});h.d.dispatchEvent(new h.w.Event('visibilitychange'));};
domTest('a changed release shows no pop-up and does not reload while the page is in view',async t=>{const h=harness(t);await h.ready();assert.equal(h.get('#sota-update'),null);assert.equal(h.calls.reloads,0);assert.equal(h.calls.register[0][1].updateViaCache,'none');});
domTest('a changed release reloads quietly once the page goes out of sight',async t=>{const h=harness(t);await h.ready();hide(h);assert.equal(h.calls.reloads,1);hide(h);assert.equal(h.calls.reloads,1,'only once');});
domTest('unsent draft text blocks the quiet reload until the draft is cleared',async t=>{const h=harness(t);await h.ready();const draft=h.get('#draft');draft.dispatchEvent(new h.w.FocusEvent('focusin',{bubbles:true}));draft.value='A note I have not sent';draft.dispatchEvent(new h.w.Event('input',{bubbles:true}));hide(h);assert.equal(h.calls.reloads,0);assert.equal(draft.value,'A note I have not sent');draft.value='';draft.dispatchEvent(new h.w.Event('input',{bubbles:true}));hide(h);assert.equal(h.calls.reloads,1);});
domTest('open editors block the quiet reload and a harmless search filter does not',async t=>{const h=harness(t);await h.ready();const dialog=h.d.createElement('dialog');dialog.open=true;h.d.body.append(dialog);hide(h);assert.equal(h.calls.reloads,0);dialog.remove();h.get('#filter').value='DJ';h.get('#filter').dispatchEvent(new h.w.Event('input',{bubbles:true}));hide(h);assert.equal(h.calls.reloads,1);});
domTest('the same release as the page never reloads',async t=>{const h=harness(t,{current:'sota-kece-shell-current',worker:'sota-kece-shell-current'});await h.ready();hide(h);assert.equal(h.calls.reloads,0);});
domTest('a fresh page and its matching worker do not show an update note',async t=>{const h=harness(t,{current:'sota-kece-shell-current',worker:'sota-kece-shell-current'});await h.ready();assert.equal(h.get('#sota-update'),null);});
domTest('messages from another source and invalid release values are ignored',async t=>{const h=harness(t,{current:'sota-kece-shell-current',worker:'sota-kece-shell-current'});await h.ready();h.handlers.message({source:{},data:{type:'SOTA_RELEASE',release:'sota-kece-shell-new'}});h.newRelease('<script>bad</script>');assert.equal(h.get('#sota-update'),null);});
