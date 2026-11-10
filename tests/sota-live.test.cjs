'use strict';
// Presence rings and the Koro quick-switch (10 Nov 2026). No database change: presence is read from
// the "last seen" time friends can already see, and the Koro list from the existing bv_my_crews.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const live=require('../sota-live.js');
const NOW=Date.parse('2026-11-10T12:00:00Z'),at=mins=>new Date(NOW-mins*60000).toISOString();
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};

test('a friend is online for ten minutes after their last check-in, recent for an hour, then nothing',()=>{
  assert.equal(live.status(at(0),NOW),'online');assert.equal(live.status(at(10),NOW),'online');
  assert.equal(live.status(at(11),NOW),'recent');assert.equal(live.status(at(60),NOW),'recent');
  assert.equal(live.status(at(61),NOW),null);assert.equal(live.status(null,NOW),null);assert.equal(live.status('not a date',NOW),null);
  assert.equal(live.status(at(-30),NOW),null,'a clock far in the future is not trusted');
  assert.equal(live.words('online',at(1),NOW),'Online now');assert.equal(live.words('recent',at(25),NOW),'Active 25 min ago');
  const map=live.byHandle([{handle:'Mere',last_seen:at(2)},{handle:'ana',last_seen:at(4000)},{handle:7},null],NOW);
  assert.deepEqual([...map.keys()],['mere']);
});
test('rings go only on friends\' avatars, come off again, and never change the page text of others',dom,()=>{
  const d=new JSDOM('<div id="app"><button class="av tw-av" data-handle="mere" aria-label="Visit Mere\'s room">M</button><div class="av" data-handle="josefa">J</div><div class="av" data-handle="stranger">S</div><p data-handle="mere">not an avatar</p><span class="ago" data-live-text="mere">2m</span><span class="ago" data-live-text="josefa">25m</span></div>');
  const app=d.window.document.getElementById('app'),q=s=>app.querySelector(s);
  const friends=[{handle:'mere',last_seen:at(2)},{handle:'josefa',last_seen:at(25)}];
  assert.equal(live.mark(app,friends,NOW),2);
  assert(q('[data-handle=mere].av').classList.contains('sl-online'));assert.equal(q('[data-handle=mere].av').title,'Online now');
  assert(q('[data-handle=josefa]').classList.contains('sl-recent'));assert.equal(q('[data-handle=stranger]').className,'av');assert.equal(q('p').className,'');
  assert.equal(q('[data-live-text=mere]').textContent,'Online');assert.equal(q('[data-live-text=josefa]').textContent,'25m');
  const before=app.innerHTML;live.mark(app,friends,NOW);assert.equal(app.innerHTML,before,'marking twice changes nothing, so the page observer settles');
  live.mark(app,[],NOW);
  assert.equal(q('[data-handle=mere].av').className,'av tw-av');assert.equal(q('[data-handle=mere].av').hasAttribute('title'),false);assert.equal(q('[data-live-text=mere]').textContent,'2m');
});
test('the Koro quick-switch sits under People, opens the chosen Koro and treats names as text',dom,async()=>{
  const d=new JSDOM('<div id="app"><aside class="sx-rail"><nav class="sx-nav"><button data-dps-tab="home">Home</button><button data-dps-tab="people">People</button><button data-dps-tab="talanoa">Talanoa</button></nav></aside><main id="view"></main></div>',{url:'https://sotakece.com/',pretendToBeVisual:true});
  const w=d.window,app=w.document.getElementById('app'),calls=[],opened=[],went=[];
  const crews=[{id:3,name:'Rugby <b>lads</b>',emoji:'🏉'},{id:1,name:'Family',emoji:'🌺'},{id:'x',name:'bad id'},{id:9,name:'   '},...Array.from({length:6},(_,i)=>({id:20+i,name:'Koro '+i}))];
  const client={rpc:async name=>{calls.push(name);return {data:name==='bv_my_crews'?crews:[],error:null};}};
  const S={user:{id:'u1'},friends:[],tab:'pulse',crew:null};
  const api=new w.Function('globalThis','module',read('sota-live.js')+';return globalThis.SotaLive;')(w,undefined);
  api.init({client,state:S,app,go:t=>went.push(t),openKoro:id=>opened.push(id)});await new Promise(r=>w.setTimeout(r,30));await flush();
  const box=app.querySelector('.sl-koro');assert(box,'the switcher is drawn');
  assert.equal(box.previousElementSibling.dataset.dpsTab,'people');assert.equal(box.tagName,'DETAILS');assert.equal(box.open,true);
  const rows=[...box.querySelectorAll('[data-live-koro]')];
  assert.deepEqual(rows.map(b=>b.dataset.liveKoro),['3','1','20','21','22','all'],'five Koro at most, then the link to all of them');
  assert.equal(rows[0].querySelector('.sl-koro-name').textContent,'Rugby <b>lads</b>');assert.equal(box.querySelector('b b'),null);assert.equal(box.querySelectorAll('.sl-koro-name b').length,0);
  assert.equal(rows.at(-1).textContent,'All 8 Koro ↗');
  rows[1].click();assert.deepEqual(opened,[1]);rows.at(-1).click();assert.deepEqual(went,['crews']);
  assert.equal(calls.filter(n=>n==='bv_my_crews').length,1,'the list is read once, not on every page change');
  S.tab='crews';S.crew=3;api.refresh();await new Promise(r=>w.setTimeout(r,30));
  assert.equal(app.querySelector('[data-live-koro="3"]').getAttribute('aria-current'),'page');
  box.open=false;box.dispatchEvent(new w.Event('toggle'));assert.equal(w.localStorage.getItem('sota.koro-switch.folded'),'1');
  S.user=null;api.refresh();await new Promise(r=>w.setTimeout(r,30));assert.equal(app.querySelector('.sl-koro'),null,'signing out removes it');
  api.stop();w.close();
});
test('the page loads the module, starts it with the Koro opener, and the worker may cache it',()=>{
  const html=read('index.html'),sw=read('sw.js');
  assert.match(html,/<script src="\/sota-live\.js\?v=[a-z0-9-]+"><\/script>/);assert.match(html,/<link rel="stylesheet" href="\/sota-live\.css\?v=[a-z0-9-]+">/);
  assert.match(html,/window\.SotaLive\?\.init\(\{client:sb,state:S,app,/);
  assert.match(html,/<div class="av" data-handle="\$\{esc\(f\.handle\)\}"/);assert.match(html,/data-live-text="\$\{esc\(f\.handle\)\}"/);
  assert.match(sw,/'\/sota-live\.js','\/sota-live\.css'/);
  assert.doesNotMatch(read('sota-live.js'),/innerHTML|insertAdjacentHTML/,'names and emoji are only ever set as text');
});
