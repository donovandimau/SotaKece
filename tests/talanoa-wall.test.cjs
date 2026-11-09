'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'/tmp/jsd/node_modules/jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'sota-pulse.js'),'utf8');
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const ana={id:'u-ana',handle:'ana',display_name:'Ana',avatar_emoji:'🌺',room_accent:'#4FA8D8'};
const post=(id,over)=>Object.assign({id,author:'u-bo',handle:'bo',display_name:'Bo',avatar_emoji:'🥥',accent:'#2A9D8F',body:'line '+id,created_at:new Date(1700000000000+id*60000).toISOString(),reply_to:null,quote_of:null,like_count:0,repost_count:0,reply_count:0,hot:0,mine:false,i_liked:false,i_reposted:false,quote:null},over||{});

const windows=[];test.after(()=>windows.forEach(w=>w.close()));
function boot(rpcImpl){
  const dom=new JSDOM('<!doctype html><body><div id="app"><main id="view"></main></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://test.invalid/'});
  const w=dom.window;windows.push(w);
  w.IntersectionObserver=class{constructor(cb){this.cb=cb;w.__io=this;}observe(){}disconnect(){}};
  w.scrollTo=()=>{};w.confirm=()=>true;
  w.eval(src);
  const calls=[],inserts=[];
  let handler=null;
  const channel={on(_e,_f,cb){handler=cb;return channel;},subscribe(){return channel;}};
  const client={rpc:async(name,args)=>{calls.push({name,args});const data=await rpcImpl(name,args||{},calls);return {data,error:null};},channel:()=>channel,removeChannel(){inserts.push('removed');}};
  const state={user:{id:'u-ana'},me:ana,tab:'pulse'};
  const toasts=[];
  const shell=html=>{w.document.getElementById('view').innerHTML=html;};
  w.SotaPulse.init({client,state,toast:m=>toasts.push(m),esc,ago:()=>'now',openRoom(){},shell});
  return {w,calls,toasts,shell,fire:p=>handler&&handler(p),inserts};
}
const feed=(rows)=>async(name,args)=>{
  if(name==='bv_talanoa_feed'){
    if(args.p_post_id)return rows.filter(p=>p.id===args.p_post_id);
    if(args.p_reply_to)return rows.filter(p=>p.reply_to===args.p_reply_to);
    if(args.p_since)return rows.filter(p=>!p.reply_to&&p.created_at>args.p_since);
    let roots=rows.filter(p=>!p.reply_to).sort((a,b)=>b.id-a.id);
    if(args.p_cursor_id)roots=roots.filter(p=>p.id<args.p_cursor_id);
    if(args.p_mode==='hot')roots=roots.slice(args.p_offset||0);
    return roots.slice(0,args.p_limit||20);
  }
  if(name==='bv_talanoa_like')return {liked:true,like_count:1};
  if(name==='bv_talanoa_repost')return {reposted:true,repost_count:1};
  if(name==='bv_talanoa_post'){const p=post(900,{author:'u-ana',handle:'ana',display_name:'Ana',body:args.p_body,mine:true,reply_to:args.p_reply_to||null});rows.push(p);return p;}
  if(name==='bv_talanoa_delete')return null;
  return null;
};

test('pure helpers: merge never duplicates, newest picks the latest timestamp, pill wording, share link',()=>{
  // No DOM needed: the module only wants a window to hang itself on and a location for share links.
  const vm=require('node:vm');const sandbox={location:{origin:'http://test.invalid',pathname:'/app',hash:''}};sandbox.window=sandbox;
  vm.runInContext(src,vm.createContext(sandbox));const P=sandbox.SotaPulse;
  const merged=P.merge([post(3),post(2)],[post(2),post(1)]);
  assert.equal(JSON.stringify(merged.map(p=>p.id)),'[3,2,1]'); // vm-realm arrays are not reference-equal to ours
  assert.equal(P.newest([post(1),post(5),post(3)]),post(5).created_at);
  assert.equal(P.pillText(1),'1 new post');assert.equal(P.pillText(4),'4 new posts');
  assert.equal(P.shareUrl(12),'http://test.invalid/app#talanoa=12');
  assert.equal(P.DEFAULT_MODE,'latest');assert.equal(P.MAX,280);
});

test('a card escapes content, links @mentions, and shows counts and viewer state',{skip:!JSDOM},()=>{
  const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'});windows.push(dom.window);
  dom.window.eval(src);const P=dom.window.SotaPulse;
  P.init({esc,ago:()=>'2m',state:{me:ana}});
  const html=P.card(post(7,{body:'hi <b>@bo</b>\nnext',like_count:3,i_liked:true,reply_count:2,mine:true,quote:{id:1,handle:'ana',display_name:'Ana',avatar_emoji:'🌺',body:'orig <i>',created_at:'2026-11-09T00:00:00Z'}}));
  assert.match(html,/hi &lt;b&gt;/);assert.match(html,/data-tw="room" data-handle="bo"/);assert.match(html,/<br>/);
  assert.match(html,/tw-like on[^>]*aria-pressed="true"[^>]*>♥<b data-count="like">3</);
  assert.match(html,/data-count="reply">2</);assert.match(html,/data-tw="del"/);
  assert.match(html,/tw-quote[^>]*data-id="1"/);assert.match(html,/orig &lt;i&gt;/);
  assert.doesNotMatch(P.card(post(8)),/data-tw="del"/);
});

test('the wall paints a skeleton first, then the first page, with latest selected and a sentinel ahead of the scroll',{skip:!JSDOM},async()=>{
  const rows=[post(1),post(2),post(3)];
  const {w,calls}=boot(feed(rows));
  const p=w.SotaPulse.view();
  assert.ok(w.document.querySelector('.tw-skel'),'skeleton shows before data');
  await p;await flush();
  const ids=[...w.document.querySelectorAll('#tw-list .tw-post')].map(e=>e.dataset.id);
  assert.deepEqual(ids,['3','2','1']);
  assert.equal(w.document.querySelector('[data-mode="latest"]').getAttribute('aria-selected'),'true');
  assert.equal(calls[0].name,'bv_talanoa_feed');assert.equal(calls[0].args.p_mode,'latest');assert.equal(calls[0].args.p_limit,20);
  assert.ok(w.document.querySelector('.tw-end'),'a short first page ends the wall (nothing more to load)');
  assert.ok(w.document.querySelector('.tw-compose textarea'),'composer present');
  assert.ok(w.document.querySelector('.tw-pill').hidden,'new-posts pill hidden until something arrives');
});

test('a live INSERT from someone else only raises the pill; tapping it prepends without duplicates; own posts are ignored',{skip:!JSDOM},async()=>{
  const rows=[post(1),post(2)];
  const {w,fire}=boot(feed(rows));
  await w.SotaPulse.view();await flush();
  rows.push(post(3));fire({new:{id:3,author:'u-bo',reply_to:null}});
  fire({new:{id:99,author:'u-ana',reply_to:null}});
  const pill=w.document.querySelector('.tw-pill');
  assert.equal(pill.hidden,false);assert.equal(pill.textContent,'1 new post');
  assert.equal(w.document.querySelectorAll('#tw-list .tw-post').length,2,'the list did not move under the reader');
  pill.click();await flush();
  const ids=[...w.document.querySelectorAll('#tw-list .tw-post')].map(e=>e.dataset.id);
  assert.deepEqual(ids,['3','2','1']);
  assert.ok(pill.hidden);
  fire({new:{id:5,author:'u-bo',reply_to:2}});
  assert.equal(w.document.querySelector('.tw-post[data-id="2"] [data-count="reply"]').textContent,'1','a reply bumps the parent count in place');
});

test('like is optimistic and reconciles with the server; a failure rolls back',{skip:!JSDOM},async()=>{
  const rows=[post(1,{like_count:4})];
  let fail=false;
  const {w,toasts}=boot(async(name,args)=>{if(name==='bv_talanoa_like'){if(fail)throw new Error('boom');return {liked:true,like_count:9};}return feed(rows)(name,args);});
  await w.SotaPulse.view();await flush();
  const btn=w.document.querySelector('.tw-post[data-id="1"] [data-tw="like"]');
  btn.click();
  assert.ok(btn.classList.contains('on'));assert.equal(btn.querySelector('b').textContent,'5','optimistic +1');
  await flush();
  assert.equal(btn.querySelector('b').textContent,'9','server count wins');
  fail=true;btn.click();await flush();
  assert.equal(btn.querySelector('b').textContent,'9');assert.ok(btn.classList.contains('on'),'rolled back to the server state');
  assert.ok(toasts.length,'the member is told');
});

test('posting prepends the returned card and clears the box; the counter and button follow the text',{skip:!JSDOM},async()=>{
  const rows=[post(1)];
  const {w,calls}=boot(feed(rows));
  await w.SotaPulse.view();await flush();
  const form=w.document.querySelector('[data-tw-form="post"]'),ta=form.querySelector('textarea'),btn=form.querySelector('button[type=submit]');
  assert.ok(btn.disabled);
  ta.value='bula everyone';ta.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(form.querySelector('.tw-count').textContent,String(280-'bula everyone'.length));assert.ok(!btn.disabled);
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  const first=w.document.querySelector('#tw-list .tw-post');
  assert.equal(first.dataset.id,'900');assert.match(first.textContent,/bula everyone/);
  assert.equal(w.document.querySelector('[data-tw-form="post"] textarea').value,'');
  const c=calls.find(c=>c.name==='bv_talanoa_post');assert.equal(c.args.p_body,'bula everyone');assert.equal(c.args.p_quote,null);
});

test('quote fills the composer with the original and sends its id',{skip:!JSDOM},async()=>{
  const rows=[post(1),post(2)];
  const {w,calls}=boot(feed(rows));
  await w.SotaPulse.view();await flush();
  w.document.querySelector('.tw-post[data-id="2"] [data-tw="quote"]').click();
  assert.ok(w.document.querySelector('.tw-quoting .tw-quote[data-id="2"]'),'quoted post shown in the composer');
  const form=w.document.querySelector('[data-tw-form="post"]'),ta=form.querySelector('textarea');
  ta.value='this, exactly';ta.dispatchEvent(new w.Event('input',{bubbles:true}));
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  assert.equal(calls.find(c=>c.name==='bv_talanoa_post').args.p_quote,2);
  assert.ok(!w.document.querySelector('.tw-quoting'),'quote cleared after posting');
});

test('opening a post loads root and replies in parallel and replying appends',{skip:!JSDOM},async()=>{
  const rows=[post(1,{reply_count:1}),post(2,{reply_to:1,body:'first reply'})];
  const {w,calls}=boot(feed(rows));
  await w.SotaPulse.view();await flush();
  w.document.querySelector('.tw-post[data-id="1"] .tw-body').click();await flush();
  const names=calls.slice(1).map(c=>c.name+':'+(c.args.p_post_id?'post':c.args.p_reply_to?'thread':'?'));
  assert.deepEqual(names.slice(0,2),['bv_talanoa_feed:post','bv_talanoa_feed:thread']);
  assert.ok(w.document.querySelector('.tw-thread .tw-expanded[data-id="1"]'));
  assert.equal(w.document.querySelectorAll('#tw-replies .tw-post').length,1);
  const form=w.document.querySelector('[data-tw-form="reply"]'),ta=form.querySelector('textarea');
  ta.value='second';ta.dispatchEvent(new w.Event('input',{bubbles:true}));
  form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await flush();
  assert.equal(w.document.querySelectorAll('#tw-replies .tw-post').length,2);
  assert.equal(calls.find(c=>c.name==='bv_talanoa_post').args.p_reply_to,1);
  w.document.querySelector('[data-tw="back"]').click();await flush();
  assert.ok(w.document.querySelector('#tw-list'),'back on the wall');
});

test('switching to Hot reloads with a frozen as_of and pages by offset; stop() releases the channel',{skip:!JSDOM},async()=>{
  const rows=[];for(let i=1;i<=25;i++)rows.push(post(i));
  const {w,calls,inserts}=boot(feed(rows));
  await w.SotaPulse.view();await flush();
  w.document.querySelector('[data-mode="hot"]').click();await flush();
  const hot=calls.filter(c=>c.args.p_mode==='hot');
  assert.equal(hot.length,1);assert.equal(hot[0].args.p_offset,0);assert.ok(hot[0].args.p_as_of);
  w.__io.cb([{isIntersecting:true}]);await flush();
  const next=calls.filter(c=>c.args.p_mode==='hot')[1];
  assert.equal(next.args.p_offset,20);assert.equal(next.args.p_as_of,hot[0].args.p_as_of,'same as_of across pages');
  assert.equal(w.document.querySelectorAll('#tw-list .tw-post').length,25);
  w.SotaPulse.stop();
  assert.deepEqual(inserts,['removed']);
});

test('the deep link #talanoa=ID opens that post and cleans the hash',{skip:!JSDOM},async()=>{
  const rows=[post(4)];
  const {w}=boot(feed(rows));
  w.location.hash='#talanoa=4';
  await w.SotaPulse.view();await flush();
  assert.ok(w.document.querySelector('.tw-thread .tw-expanded[data-id="4"]'));
  assert.equal(w.location.hash,'');
});

test('index.html hands the Pulse tab to the wall, keeps the Spark, stops the wall on tab change, and the worker caches the new files',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/window\.SotaPulse\.init\(\{client:sb,state:S,toast,esc,ago,openRoom,shell,spark:sparkCard\}\)/);
  assert.match(html,/async function sparkCard\(\)/);
  assert.match(html,/window\.SotaPulse\?\.stop\(\); S\.tab=t;/);
  assert.match(html,/<script src="\/sota-pulse\.js\?v=/);assert.match(html,/<link rel="stylesheet" href="\/sota-pulse\.css\?v=/);
  assert.doesNotMatch(html,/bv_pulse_feed|postPulse\(/,'the old one-line-per-friend pulse is gone from the tab');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(sw,/ON_DEMAND=\['\/sota-pulse\.js','\/sota-pulse\.css'/);
  assert.match(sw,/sota-kece-shell-20261109-v155-motion-room/);
});
