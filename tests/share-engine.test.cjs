'use strict';
// Share engine (10 Nov 2026): public post pages at /p/<post>/<token>, minted links from the wall,
// and referral credit when someone joins through a link.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'/tmp/jsd/node_modules/jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const share=require('../api/share.js');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TOKEN='0123456789abcdef0123456789abcdef';
const card={id:7,body:'Sunset at Suva <b>harbour</b>\nwas unreal',created_at:'2026-11-10T10:00:00Z',like_count:3,reply_count:1,handle:'lusi',display_name:'Lusi Vakatawa',avatar_emoji:'🌺',accent:'#E76F51',sharer:{handle:'ana',display_name:'Ana'},quote:{body:'orig <i>',handle:'joji',display_name:'Joji'}};
const response=()=>({headers:{},code:null,body:null,setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},send(b){this.body=b;return this;}});
const request=(over={})=>({method:'GET',query:{post:'7',t:TOKEN},...over});
const withFetch=async(impl,fn)=>{const old=global.fetch;global.fetch=impl;try{await fn();}finally{global.fetch=old;}};

test('the public page carries preview tags, escapes the words, and sends everyone to the post with the link remembered',()=>{
  const out=share.postPage(card,TOKEN,new Date('2026-11-10T12:00:00Z').getTime());
  assert.equal(out.status,200);
  const html=out.html;
  assert.match(html,/<meta property="og:title" content="Lusi Vakatawa on Sota Kece">/);
  assert.match(html,/<meta property="og:description" content="Sunset at Suva &lt;b&gt;harbour&lt;\/b&gt;\nwas unreal">/);
  assert.match(html,/<meta property="og:url" content="https:\/\/sotakece.com\/p\/7\/0123456789abcdef0123456789abcdef">/);
  assert.match(html,/<meta property="og:image" content="https:\/\/sotakece.com\/assets\/og-sota-kece-20261104.jpg">/);
  assert.match(html,/Sunset at Suva &lt;b&gt;harbour&lt;\/b&gt;<br>was unreal/,'words are escaped and keep their line breaks');
  assert.doesNotMatch(html,/<b>harbour<\/b>/);
  assert.match(html,/class="quote"><b>Joji<\/b> @joji<br>orig &lt;i&gt;/,'the quoted post is shown and escaped');
  assert.match(html,/3 likes · 1 reply/);assert.match(html,/2 h ago/);
  assert.match(html,/href="https:\/\/sotakece.com\/\?ref=0123456789abcdef0123456789abcdef#talanoa=7">Open in Sota Kece/);
  assert.match(html,/Shared by Ana\./);
  assert.match(html,/name="robots" content="noindex"/);
});

test('a long post is cut for the preview and a card without a quote or counts stays clean',()=>{
  const out=share.postPage({...card,body:'x'.repeat(260),quote:null,like_count:0,reply_count:0,sharer:null},TOKEN);
  assert.match(out.html,new RegExp('og:description" content="'+'x'.repeat(199)+'…"'));
  assert.doesNotMatch(out.html,/class="quote"/);assert.doesNotMatch(out.html,/class="meta"/);assert.doesNotMatch(out.html,/Shared by/);
});

test('the handler asks the database for exactly the shared card with the publishable key only, and caches briefly',async()=>{
  const calls=[];
  await withFetch(async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>card};},async()=>{
    const res=response();await share(request(),res);
    assert.equal(res.code,200);assert.match(res.headers['Cache-Control'],/public, max-age=60/);assert.match(res.body,/Lusi Vakatawa on Sota Kece/);
  });
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://aqfzpaczyodhugsgqvxi.supabase.co/rest/v1/rpc/bv_talanoa_shared');
  assert.equal(calls[0].init.headers.apikey,'sb_publishable_DvpX2PSuPtxE3IqWUlRZfQ_YP2qLZtF');
  assert.equal(calls[0].init.headers.Authorization,undefined,'no bearer: anon is the whole point');
  assert.deepEqual(JSON.parse(calls[0].init.body),{p_post:7,p_token:TOKEN});
});

test('wrong or malformed links, a removed post, and a database error answer safely',async()=>{
  let hits=0;
  await withFetch(async()=>{hits++;return {ok:true,json:async()=>null};},async()=>{
    for(const q of[{post:'7',t:'short'},{post:'abc',t:TOKEN},{post:'7'},{}]){const res=response();await share(request({query:q}),res);assert.equal(res.code,404);assert.equal(res.headers['Cache-Control'],'no-store');}
    assert.equal(hits,0,'a malformed link never reaches the database');
    const res=response();await share(request(),res);assert.equal(res.code,404);assert.match(res.body,/That post is not here/);assert.equal(res.headers['Cache-Control'],'no-store');
  });
  await withFetch(async()=>{throw Error('down');},async()=>{const res=response();await share(request(),res);assert.equal(res.code,503);assert.equal(res.headers['Cache-Control'],'no-store');});
  const res=response();await share(request({method:'POST'}),res);assert.equal(res.code,405);
});

/* ---------------------------------------------------------------- the wall mints a link and hands it to the share sheet */
const src=read('sota-pulse.js');
const post=(id,over)=>Object.assign({id,author:'u-bo',handle:'bo',display_name:'Bo',avatar_emoji:'🥥',accent:'#2A9D8F',body:'line '+id,created_at:new Date(1700000000000+id*60000).toISOString(),reply_to:null,quote_of:null,like_count:0,repost_count:0,reply_count:0,hot:0,mine:false,i_liked:false,i_reposted:false,quote:null},over||{});
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
const windows=[];test.after(()=>windows.forEach(w=>w.close()));
function boot(rpcImpl){
  const dom=new JSDOM('<!doctype html><body><div id="app"><main id="view"></main></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://test.invalid/'});
  const w=dom.window;windows.push(w);
  w.IntersectionObserver=class{observe(){}disconnect(){}};w.scrollTo=()=>{};
  w.eval(src);
  const calls=[],shared=[];
  w.SotaShare={share:async data=>{shared.push(data);return 'sheet';}};
  const client={rpc:async(name,args)=>{calls.push({name,args});const data=await rpcImpl(name,args||{});return {data,error:null};},channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}};
  w.SotaPulse.init({client,state:{user:{id:'u-ana'},me:{handle:'ana',display_name:'Ana'},tab:'pulse'},toast(){},esc,ago:()=>'now',openRoom(){},shell:h=>{w.document.getElementById('view').innerHTML=h;}});
  return {w,calls,shared};
}
const feed=rows=>async(name,args)=>{
  if(name==='bv_talanoa_feed')return rows.filter(p=>!p.reply_to);
  if(name==='bv_talanoa_share')return {token:TOKEN,path:'/p/'+args.p_id+'/'+TOKEN};
  return null;
};

test('tapping Share mints a token for this member and opens the app sheet with the public link and the words',{skip:!JSDOM},async()=>{
  const rows=[post(2,{body:'Who is going to the rugby at Churchill Park Saturday? Need two more for the carload from Nadi, leaving at nine.'})];
  const {w,calls,shared}=boot(feed(rows));
  await w.SotaPulse.view();await flush();
  w.document.querySelector('.tw-post[data-id="2"] [data-tw="share"]').click();await flush();
  const mint=calls.find(c=>c.name==='bv_talanoa_share');assert.ok(mint);assert.equal(mint.args.p_id,2);
  assert.equal(shared.length,1);
  assert.equal(shared[0].url,'https://sotakece.com/p/2/'+TOKEN);
  assert.equal(shared[0].text,'“Who is going to the rugby at Churchill Park Saturday? Need two more for the carload from…” — Bo on Sota Kece','cut at 90 characters, then who said it');
});

test('if minting fails the member still gets the in-app link',{skip:!JSDOM},async()=>{
  const rows=[post(3)];
  const {w,shared}=boot(async(name,args)=>{if(name==='bv_talanoa_share')throw Error('offline');return feed(rows)(name,args);});
  await w.SotaPulse.view();await flush();
  w.document.querySelector('.tw-post[data-id="3"] [data-tw="share"]').click();await flush();
  assert.equal(shared.length,1);assert.equal(shared[0].url,'http://test.invalid/#talanoa=3');
});

test('page wiring: the link is remembered before sign-in, credited once a room exists, routed on Vercel, and Activity knows the new kind',()=>{
  const html=read('index.html');
  assert.match(html,/async function boot\(\)\{\n  if\(typeof location==='object'&&location.hash==="#connections=example"\)return window\.SotaConnections\.preview\(\);\n  rememberReferral\(\);/);
  assert.match(html,/const REF_KEY='sota-ref',REF_TTL=30\*86400000;/);
  assert.equal((html.match(/await claimReferral\(\);\n\s*boot\(\);/g)||[]).length,2,'credited after both ways of creating a room');
  assert.match(html,/sb\.rpc\('bv_referral_claim',\{p_token:saved\.token\}\)/);
  const release=/<meta name="sota-release" content="([^"]+)">/.exec(html)[1];
  assert.match(read('sw.js'),new RegExp("const CACHE='"+release+"';"));
  assert.match(html,/sota-pulse\.js\?v=20261110-share-engine-1/);assert.match(html,/sota-plus\.js\?v=20261110-share-engine-1/);
  const cfg=JSON.parse(read('vercel.json')),routes=cfg.routes,fsi=routes.findIndex(r=>r.handle==='filesystem'),pi=routes.findIndex(r=>r.dest&&r.dest.startsWith('/api/share'));
  assert.ok(pi>-1&&pi<fsi,'the /p/ route runs before the filesystem');
  assert.equal(routes[pi].src,'/p/([0-9]{1,18})/([a-fA-F0-9]{32})/?');
  assert.match(read('sota-plus.js'),/ACT_WORDS = \{ joined: 'joined Sota Kece through your link'/);
  assert.match(read('sota-plus.js'),/ACT_TARGET = \{ profile: ''/);
  assert.match(read('.github/workflows/talanoa-security.yml'),/node tests\/run-share-engine-db\.cjs/);
  assert.match(read('api/listen.js'),/gone,readSere,esc,page\}\);/,'listen.js lends its page frame');
});
