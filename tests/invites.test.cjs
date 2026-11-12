'use strict';
// Invite links (12 Nov 2026): a member makes a named link at the top of Activity, sends it, and sees
// who opened it and who joined. Public page at /i/<token>; joins are claimed by index.html as ?ref=.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const invite=require('../api/invite.js');
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const windows=[];test.after(()=>windows.forEach(w=>w.close()));
const TOKEN='0123456789abcdef0123456789abcdef';
const card={handle:'ana',display_name:'Ana <Vaka>',avatar_emoji:'🌺',accent:'#E76F51'};
const response=()=>({headers:{},code:null,body:null,setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},send(b){this.body=b;return this;}});
const withFetch=async(impl,fn)=>{const old=global.fetch;global.fetch=impl;try{await fn();}finally{global.fetch=old;}};

test('the invite page names the sender, escapes it, carries preview tags and sends people to sign-up with the invite remembered',()=>{
  const out=invite.invitePage(card,TOKEN);
  assert.equal(out.status,200);
  const html=out.html;
  assert.match(html,/<meta property="og:title" content="Ana &lt;Vaka&gt; invited you to Sota Kece">/);
  assert.match(html,/<meta property="og:url" content="https:\/\/sotakece.com\/i\/0123456789abcdef0123456789abcdef">/);
  assert.match(html,/<meta property="og:image" content="https:\/\/sotakece.com\/assets\/og-sota-kece-premium-20261111.jpg">/);
  assert.match(html,/og:description" content="A small private social network for actual friends\. No algorithm, no ads, no AI content\. Be one of the first members\."/);
  assert.match(html,/href="https:\/\/sotakece.com\/\?ref=0123456789abcdef0123456789abcdef">Join Sota Kece/);
  assert.doesNotMatch(html,/<Vaka>/);
  assert.match(html,/name="robots" content="noindex"/);
  assert.match(html,/--av:#E76F51/);
});

test('a bad colour is replaced and a card without a name still reads',()=>{
  const html=invite.invitePage({handle:'',display_name:'',accent:'red;background:url(x)'},TOKEN).html;
  assert.match(html,/--av:#4FA8D8/);assert.doesNotMatch(html,/url\(x\)/);
  assert.match(html,/A friend invited you to Sota Kece/);
});

test('the page reads the invite with the publishable key only and the token as the only argument',async()=>{
  let call=null;
  const got=await invite.openInvite(TOKEN,async(url,opts)=>{call={url,opts};return {ok:true,json:async()=>card};});
  assert.equal(got.handle,'ana');
  assert.equal(call.url,'https://aqfzpaczyodhugsgqvxi.supabase.co/rest/v1/rpc/bv_invite_open');
  assert.equal(call.opts.headers.apikey.startsWith('sb_publishable_'),true);
  assert.equal(call.opts.headers.Authorization,undefined);
  assert.deepEqual(JSON.parse(call.opts.body),{p_token:TOKEN});
  assert.equal(await invite.openInvite(TOKEN,async()=>({ok:true,json:async()=>null})),null);
});

test('malformed and unknown invites are 404 and not cached; a database error is 503; other methods are 405',async()=>{
  let res=response();await invite({method:'GET',query:{t:'nope'}},res);
  assert.equal(res.code,404);assert.equal(res.headers['Cache-Control'],'no-store');assert.match(res.body,/That invite is not here/);
  await withFetch(async()=>({ok:true,json:async()=>null}),async()=>{res=response();await invite({method:'GET',query:{t:TOKEN}},res);});
  assert.equal(res.code,404);
  await withFetch(async()=>({ok:false}),async()=>{res=response();await invite({method:'GET',query:{t:TOKEN}},res);});
  assert.equal(res.code,503);assert.equal(res.headers['Cache-Control'],'no-store');
  await withFetch(async()=>({ok:true,json:async()=>card}),async()=>{res=response();await invite({method:'GET',query:{t:TOKEN.toUpperCase()}},res);});
  assert.equal(res.code,200);assert.equal(res.headers['Cache-Control'],'private, max-age=60','not cached at the edge, so every open counts');
  res=response();await invite({method:'POST',query:{t:TOKEN}},res);assert.equal(res.code,405);
});

function boot(rpcImpl){
  const d=new JSDOM('<!doctype html><body><div id="host"></div></body>',{runScripts:'outside-only',url:'https://sotakece.com/'});
  const w=d.window;windows.push(w);
  const shared=[];w.SotaShare={share:x=>shared.push(x)};
  w.eval(read('sota-invites.js'));
  w.document.getElementById('host').innerHTML=w.SotaInvites.html();
  const calls=[];const rpc=async(name,args)=>{calls.push([name,args]);return rpcImpl(name,args);};
  return {w,shared,calls,rpc,q:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)],el:()=>w.document.querySelector('[data-invites]')};
}
const tick=()=>new Promise(r=>setTimeout(r,0));
const EMPTY={totals:{invites:0,opens:0,joins:0},invites:[],joined:[]};

test('the card stays hidden until the invite functions answer',dom,async()=>{
  const h=boot(async()=>{throw Error('function not found');});
  assert.equal(await h.w.SotaInvites.fill(h.el(),h.rpc,{handle:'ana'}),false);
  assert.equal(h.el().hidden,true);
});

test('a first invite: the form makes the link, opens the share sheet with the link and a message, and lists it',dom,async()=>{
  let data=EMPTY;
  const h=boot(async(name,args)=>{
    if(name==='bv_invites_mine')return data;
    if(name==='bv_invite_create'){data={totals:{invites:1,opens:0,joins:0},invites:[{label:args.p_label,path:'/i/'+'a'.repeat(32),opens:0,joins:0,created_at:new Date().toISOString()}],joined:[]};return {path:'/i/'+'a'.repeat(32),label:args.p_label};}
  });
  assert.equal(await h.w.SotaInvites.fill(h.el(),h.rpc,{handle:'ana',display_name:'Ana'}),true);
  assert.equal(h.el().hidden,false);
  assert.match(h.q('.iv-head h3').textContent,/Invite your people/);
  assert.equal(h.all('.iv-list li').length,0,'no list before the first invite');
  h.q('#iv-label').value='Auckland church youth';
  h.q('form[data-iv="make"]').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<5;i++)await tick();
  assert.equal(JSON.stringify(h.calls.find(c=>c[0]==='bv_invite_create')[1]),JSON.stringify({p_label:'Auckland church youth'}));
  assert.equal(h.shared.length,1);
  assert.equal(h.shared[0].url,'https://sotakece.com/i/'+'a'.repeat(32));
  assert.match(h.shared[0].text,/^Ana here\. Come join me on Sota Kece/);
  assert.equal(h.all('.iv-list li').length,1);
  assert.match(h.q('.iv-list li').textContent,/Auckland church youth.*0 opens · 0 joined/);
  assert.equal(h.q('#iv-label').value,'','the box is cleared for the next invite');
  assert.match(h.q('.iv-msg').textContent,/Invite ready/);
});

test('the list shows counts, escapes names, sends an invite again and shows who joined through which invite',dom,async()=>{
  const h=boot(async()=>({totals:{invites:2,opens:7,joins:1},
    invites:[{label:'<img src=x>',path:'/i/'+'b'.repeat(32),opens:5,joins:1,created_at:'2026-11-12T01:00:00Z'},{label:'',path:'/i/'+'c'.repeat(32),opens:2,joins:0,created_at:'2026-11-10T01:00:00Z'},{label:'evil',path:'javascript:alert(1)',opens:0,joins:0,created_at:'2026-11-10T01:00:00Z'}],
    joined:[{handle:'di',display_name:'Di',avatar_emoji:'🌴',accent:'javascript:x',label:'<img src=x>',created_at:'2026-11-12T02:00:00Z'}]}));
  await h.w.SotaInvites.fill(h.el(),h.rpc,{handle:'ana'});
  assert.deepEqual(h.all('.iv-tile b').map(b=>b.textContent),['2','7','1']);
  assert.equal(h.all('.iv-list li').length,2,'a link that is not /i/<token> is never drawn');
  assert.equal(h.el().querySelector('img'),null,'labels are escaped');
  assert.match(h.all('.iv-list li')[0].textContent,/5 opens · 1 joined/);
  assert.match(h.all('.iv-list li')[1].textContent,/Invite made 10 Nov/,'an invite without a name gets its date');
  h.all('[data-iv="send"]')[1].click();
  assert.equal(h.shared.at(-1).url,'https://sotakece.com/i/'+'c'.repeat(32));
  assert.match(h.q('.iv-people').textContent,/Di.*@di/);
  assert.match(h.q('.iv-people .av').getAttribute('style'),/--accent:#4FA8D8/,'a bad colour falls back');
});

test('too many invites and other errors say what to do',dom,async()=>{
  const h=boot(async name=>{if(name==='bv_invites_mine')return EMPTY;throw Error('TOO_MANY_INVITES');});
  await h.w.SotaInvites.fill(h.el(),h.rpc,{handle:'ana'});
  h.q('form[data-iv="make"]').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));
  for(let i=0;i<5;i++)await tick();
  assert.match(h.q('.iv-msg').textContent,/50 invites already/);
  assert.equal(h.shared.length,0);
});

test('wiring: route, page tags, worker, release, Activity and CI',()=>{
  const vercel=JSON.parse(read('vercel.json'));
  const route=vercel.routes.find(r=>r.dest&&r.dest.startsWith('/api/invite'));
  assert.ok(route,'the /i/ route exists');
  assert.ok(new RegExp('^'+route.src+'$').test('/i/'+'a'.repeat(32)));
  assert.ok(vercel.routes.indexOf(route)<vercel.routes.findIndex(r=>r.handle==='filesystem'),'the route comes before the filesystem');
  const html=read('index.html'),sw=read('sw.js');
  assert.match(html,/<script src="\/sota-card-stack\.js\?v=[^"]+"><\/script><script src="\/sota-invites\.js\?v=[^"]+"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\/sota-invites\.css\?v=/);
  assert.match(html,/ \/sota-invites\.js\?v=[^ ]+ /,'listed for the phone loader');
  assert.match(sw,/'\/sota-invites\.js','\/sota-invites\.css'/);
  const release=html.match(/<meta name="sota-release" content="([^"]+)">/)[1];
  assert.match(sw,new RegExp("const CACHE='"+release+"'"),'page and worker carry the same release');
  const plus=read('sota-plus.js');
  assert.match(plus,/SotaInvites\.html\(\)/);assert.match(plus,/SotaInvites\.fill\(document\.querySelector\('\[data-invites\]'\), rpc, S && S\.me\)/);
  assert.match(read('.github/workflows/talanoa-security.yml'),/node tests\/run-invites-db\.cjs/);
  // The sign-up side already remembers any 32-hex ?ref= and claims it once the room exists.
  assert.match(html,/function rememberReferral\(\)/);assert.match(html,/sb\.rpc\('bv_referral_claim'/);
});
