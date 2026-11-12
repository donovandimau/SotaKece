'use strict';
// Share stats (12 Nov 2026): what happened to the wall posts a member shared, at the top of Activity.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const windows=[];test.after(()=>windows.forEach(w=>w.close()));
const ago=d=>new Date(Date.now()-d*864e5).toISOString();
const DATA={totals:{links:3,opens:19,joins:2},
  links:[{post_id:11,path:'/p/11/a',body:'<b>Lovo</b> on Saturday',opens:4,joins:0,created_at:ago(2)},
    {post_id:12,path:'/p/12/b',body:'Village clean-up',opens:12,joins:2,created_at:ago(20)},
    {post_id:13,path:'/p/13/c',body:'Old news',opens:3,joins:0,created_at:ago(90)}],
  joined:[{handle:'mere',display_name:'Mere',avatar_emoji:'🌺',accent:'javascript:x',post_id:12,created_at:ago(19)}]};

function boot(){
  const d=new JSDOM('<!doctype html><body><div id="host"></div></body>',{runScripts:'outside-only',url:'https://sotakece.com/'});
  const w=d.window;windows.push(w);
  w.eval(read('sota-share-stats.js'));
  w.document.getElementById('host').innerHTML=w.SotaShareStats.html();
  const went=[];w.go=(t,o)=>went.push([t,o]);
  return {w,went,q:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)]};
}
const tiles=h=>h.all('.ss-tile b').map(b=>b.textContent);

test('the sums, the window and the busiest-first order',()=>{
  const d=JSDOM?new JSDOM('',{runScripts:'outside-only'}):null;if(!d)return;const w=d.window;windows.push(w);
  w.eval(read('sota-share-stats.js'));const S=w.SotaShareStats,now=Date.now();
  assert.equal(S.inRange(DATA.links,'7',now).length,1);
  assert.equal(S.inRange(DATA.links,'30',now).length,2);
  assert.equal(S.inRange(DATA.links,'all',now).length,3);
  assert.equal(JSON.stringify(S.totals(DATA.links)),JSON.stringify({links:3,opens:19,joins:2}));
  assert.equal(JSON.stringify(Array.from(S.top(DATA.links),l=>l.post_id)),'[12,11,13]');
});

test('the panel draws totals, bars and the people who joined, escaped',dom,async()=>{
  const h=boot();const calls=[];
  assert.equal(await h.w.SotaShareStats.fill(h.q('[data-share-stats]'),async n=>{calls.push(n);return DATA;}),true);
  assert.equal(JSON.stringify(calls),'["bv_share_stats"]');
  assert.equal(h.q('[data-share-stats]').hidden,false);
  assert.deepEqual(tiles(h),['3','19','2']);
  assert.equal(h.all('.ss-bar').length,3);
  assert.equal(h.q('.ss-bar b'),null,'post text never becomes markup');
  assert.match(h.q('.ss-people').textContent,/Mere/);
  assert.match(h.q('.ss-people .av').getAttribute('style'),/#4FA8D8/,'a bad accent falls back');
  assert.ok(h.q('.ss-people [data-sp="room"][data-handle="mere"]'));
});

test('the range chips recount from the links made in that window',dom,async()=>{
  const h=boot();await h.w.SotaShareStats.fill(h.q('[data-share-stats]'),async()=>DATA);
  h.q('[data-range="30"]').click();assert.deepEqual(tiles(h),['2','16','2']);
  h.q('[data-range="7"]').click();assert.deepEqual(tiles(h),['1','4','0']);
  assert.equal(h.q('[data-range="7"]').getAttribute('aria-pressed'),'true');
  h.q('[data-range="all"]').click();assert.deepEqual(tiles(h),['3','19','2']);
});

test('tapping a bar shows its figures; See the post opens the wall at that post',dom,async()=>{
  const h=boot();await h.w.SotaShareStats.fill(h.q('[data-share-stats]'),async()=>DATA);
  h.q('.ss-bar[data-post="12"]').dispatchEvent(new h.w.MouseEvent('click',{bubbles:true}));
  assert.match(h.q('.ss-read').textContent,/12 opens · 2 people joined/);
  h.q('[data-ss="post"]').click();
  assert.equal(h.w.location.hash,'#talanoa=12');
  assert.equal(JSON.stringify(h.went),JSON.stringify([['pulse',{history:false}]]));
  h.q('.ss-bar[data-post="12"]').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.match(h.q('.ss-read').textContent,/Tap a bar/,'Enter toggles the same bar off');
});

test('nothing shared shows the how-to; a missing function keeps the panel hidden',dom,async()=>{
  const h=boot();await h.w.SotaShareStats.fill(h.q('[data-share-stats]'),async()=>({totals:{links:0,opens:0,joins:0},links:[],joined:[]}));
  assert.match(h.q('.ss-empty').textContent,/Nothing shared yet/);
  const h2=boot();
  assert.equal(await h2.w.SotaShareStats.fill(h2.q('[data-share-stats]'),async()=>{throw new Error('PGRST202');}),false);
  assert.equal(h2.q('[data-share-stats]').hidden,true);
});

test('Activity carries the panel and the page loads it the house way',()=>{
  const plus=read('sota-plus.js'),html=read('index.html'),sw=read('sw.js'),sql=read('supabase/migrations/20261112120000_sota_share_stats.sql');
  // The invite card (sota-invites.js, 12 Nov) sits just above it.
  assert.match(plus,/back\(\) \+ (\(window\.SotaInvites \? window\.SotaInvites\.html\(\) : ''\) \+ )?\(window\.SotaShareStats \? window\.SotaShareStats\.html\(\) : ''\)/);
  assert.match(plus,/SotaShareStats\.fill\(document\.querySelector\('\[data-share-stats\]'\), rpc\)/);
  assert.match(html,/<script src="\/sota-people-bubbles\.js\?v=[^"]+"><\/script><script src="\/sota-share-stats\.js\?v=[^"]+"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\/sota-share-stats\.css\?v=/);
  assert.match(sw,/'\/sota-share-stats\.js','\/sota-share-stats\.css'/);
  assert.match(sql,/security definer set search_path = ''/);
  assert.match(sql,/revoke all on function public\.bv_share_stats\(\) from public, anon;/);
});
