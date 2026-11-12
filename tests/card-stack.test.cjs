'use strict';
// Card stack (12 Nov 2026): "New for you" at the top of Activity, unread notifications as a pile of cards.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'/tmp/jsd/node_modules/jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const windows=[];test.after(()=>windows.forEach(w=>w.close()));
const CARDS=['Mere liked your post','Jone replied','Sera is going'].map((l,i)=>({key:i+1,label:l,html:'<p>'+l+'</p><button type="button" data-x>Room</button>'}));

function boot(cards=CARDS,reduce=false){
  const d=new JSDOM('<!doctype html><body><div id="host"></div></body>',{runScripts:'outside-only',url:'https://sotakece.com/'});
  const w=d.window;windows.push(w);w.matchMedia=()=>({matches:reduce});
  w.eval(read('sota-card-stack.js'));
  w.document.getElementById('host').innerHTML=w.SotaCardStack.html(cards);
  const r=w.document.querySelector('[data-card-stack]');if(r)w.SotaCardStack.mount(r);
  return {w,r,q:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)]};
}
const front=h=>h.q('.cs-card.front').getAttribute('data-key');

test('depth wraps round the pile',()=>{
  const d=JSDOM?new JSDOM('',{runScripts:'outside-only'}):null;if(!d)return;const w=d.window;windows.push(w);
  w.eval(read('sota-card-stack.js'));const C=w.SotaCardStack;
  assert.equal(C.depth(0,0,3),0);assert.equal(C.depth(1,0,3),1);assert.equal(C.depth(0,1,3),2);assert.equal(C.depth(2,2,3),0);
});

test('one card or none draws nothing',dom,()=>{
  assert.equal(boot([]).r,null);assert.equal(boot(CARDS.slice(0,1)).r,null);
});

test('the front card is live, the ones behind are hidden from readers and keys',dom,()=>{
  const h=boot();
  assert.equal(front(h),'1');assert.equal(h.q('.cs-count').textContent,'1 of 3');
  const back=h.all('.cs-card').filter(c=>!c.classList.contains('front'));
  assert.equal(back.length,2);back.forEach(c=>{assert.equal(c.getAttribute('aria-hidden'),'true');assert.equal(c.inert,true);});
  assert.equal(h.q('.cs-card.front').style.zIndex,'3');
  assert.match(h.all('.cs-card')[1].style.transform,/rotate\(3deg\)/,'the next card is tilted');
});

test('arrows, keys and the list bring cards forward and wrap',dom,()=>{
  const h=boot();
  h.q('[data-cs="next"]').click();assert.equal(front(h),'2');
  h.q('[data-cs="prev"]').click();h.q('[data-cs="prev"]').click();assert.equal(front(h),'3','previous from the first wraps to the last');
  const pile=h.q('.cs-pile');pile.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(front(h),'1');
  h.all('[data-cs="pick"]')[1].click();assert.equal(front(h),'2');
  assert.equal(h.all('[data-cs="pick"]')[1].getAttribute('aria-current'),'true');
  assert.equal(h.q('.cs-dots i.on').getAttribute('data-i'),'1');
});

test('dragging the front card far enough swaps it, a short drag puts it back',dom,()=>{
  const h=boot();const pile=h.q('.cs-pile'),P=h.w.MouseEvent;
  const ev=(t,x,target)=>{const e=new P(t,{bubbles:true,clientX:x,clientY:100,button:0});e.pointerId=1;(target||pile).dispatchEvent(e);};
  ev('pointerdown',200,h.q('.cs-card.front'));ev('pointermove',170);ev('pointermove',100);ev('pointerup',100);
  assert.equal(front(h),'2','a swipe left brings the next card');
  ev('pointerdown',200,h.q('.cs-card.front'));ev('pointermove',230);ev('pointerup',230);
  assert.equal(front(h),'2','a short drag does nothing');
  ev('pointerdown',200,h.q('.cs-card.front [data-x]'));ev('pointermove',50);ev('pointerup',50);
  assert.equal(front(h),'2','pressing a button inside the card never drags');
});

test('reduced motion lays the pile flat',dom,()=>{
  const h=boot(CARDS,true);assert.doesNotMatch(h.all('.cs-card')[1].style.transform,/rotate\([1-9]/);
});

test('labels are escaped and Activity wires the stack the house way',dom,()=>{
  const h=boot([{key:1,label:'<img src=x>',html:'a'},{key:2,label:'b',html:'b'}]);
  assert.equal(h.q('img'),null);
  const plus=read('sota-plus.js'),html=read('index.html'),sw=read('sw.js');
  assert.match(plus,/actStack\(list\) \+ '<div class="glass card"><div class="row"><h3 style="margin:0">🔔 Activity/);
  assert.match(plus,/filter\(function \(n\) \{ return !n\.read; \}\)\.slice\(0, 8\)/);
  assert.match(plus,/SotaCardStack\.mount\(document\.querySelector\('\[data-card-stack\]'\)\)/);
  assert.match(html,/<script src="\/sota-share-stats\.js\?v=[^"]+"><\/script><script src="\/sota-card-stack\.js\?v=[^"]+"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\/sota-card-stack\.css\?v=/);
  assert.match(sw,/'\/sota-card-stack\.js','\/sota-card-stack\.css'/);
});
