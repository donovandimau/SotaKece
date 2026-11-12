'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const src=fs.readFileSync(path.join(__dirname,'../sota-plus.js'),'utf8');
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};

const windows=[];test.after(()=>windows.forEach(w=>w.close()));
function boot(rpcImpl){
  const dom=new JSDOM('<!doctype html><body><div id="shell"></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://test.invalid/'});
  const w=dom.window;windows.push(w);
  w.eval(src);
  const calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return {data:await rpcImpl(name,args),error:null};}};
  const state={user:{id:'u1'},me:{id:'u1',handle:'ana'}};
  const shell=html=>{w.document.getElementById('shell').innerHTML=html;};
  w.SotaPlus.init({client,state,toast(){},render(){},openRoom(){},esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),ago:()=>'just now',mediaMarkup:()=>'',shell});
  return {w,calls,shell};
}

test('side panel carries an Activity button with a hidden badge; polling fills it',{skip:!JSDOM},async()=>{
  const {w,calls,shell}=boot(async name=>name==='bv_activity_unread'?7:[]);
  shell(w.SotaPlus.sidePanel());
  const badge=w.document.getElementById('sp-act-badge');
  assert.ok(badge.hidden,'badge hidden until counted');
  await w.SotaPlus.pollUnread();
  assert.equal(badge.hidden,false);assert.equal(badge.textContent,'7');
  assert.equal(badge.closest('.sp-act-btn').getAttribute('aria-label'),'Activity, 7 unread');
  assert.ok(calls.some(c=>c.name==='bv_activity_unread'));
});

test('activity lines read naturally and escape content',{skip:!JSDOM},()=>{
  const {w}=boot(async()=>[]);
  const line=n=>w.SotaPlus.actLine(n);
  assert.match(line({kind:'reaction',target_kind:'moment',handle:'bo',snippet:'fire|hello <b>'}),/@bo<\/span> 🔥 reacted to your moment/);
  assert.match(line({kind:'reaction',target_kind:'moment',handle:'bo',snippet:'fire|hello <b>'}),/&lt;b&gt;/);
  assert.match(line({kind:'rsvp',target_kind:'event',handle:'bo',snippet:'going|Kava night'}),/✅ is going to event/);
  assert.match(line({kind:'friend_request',target_kind:'friendship',handle:'cy',snippet:''}),/@cy<\/span> wants to be friends$/);
  assert.match(line({kind:'mention',target_kind:'comment',handle:'bo',snippet:'x'.repeat(90)}),/…”/);
});

test('opening Activity lists rows newest-first as given, marks unread read and clears the badge',{skip:!JSDOM},async()=>{
  const rows=[{id:2,kind:'reply',target_kind:'moment',target_id:1,snippet:'nice',created_at:'2026-10-31T10:00:00Z',read:false,handle:'bo',avatar_emoji:'🥥'},
              {id:1,kind:'reaction',target_kind:'moment',target_id:1,snippet:'wow|hi',created_at:'2026-10-31T09:00:00Z',read:true,handle:'bo',avatar_emoji:'🥥'}];
  const {w,calls,shell}=boot(async name=>name==='bv_activity'?rows:name==='bv_activity_unread'?1:name==='bv_activity_read'?1:[]);
  shell(w.SotaPlus.sidePanel());await w.SotaPlus.pollUnread();
  await w.SotaPlus.open('activity');await flush();
  const items=[...w.document.querySelectorAll('.sp-act')];
  assert.equal(items.length,2);assert.equal(items[0].dataset.id,'2');assert.ok(items[0].classList.contains('unread'));
  assert.ok(calls.some(c=>c.name==='bv_activity_read'&&Array.isArray(c.args.p_ids)&&c.args.p_ids.length===1&&c.args.p_ids[0]===2),'only the loaded unread rows are marked read on open');
  assert.ok(w.document.querySelector('[data-sp="act-read-all"]'),'mark-all control shown while something is unread');
});

test('when the function is not deployed yet the badge stays quiet',{skip:!JSDOM},async()=>{
  const {w,shell}=boot(async()=>{throw new Error('function bv_activity_unread does not exist');});
  shell(w.SotaPlus.sidePanel());
  await w.SotaPlus.pollUnread();
  assert.ok(w.document.getElementById('sp-act-badge').hidden);
});
