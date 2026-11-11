'use strict';
// Guests on phones see the Home welcome (veranda photo and its words) from a static copy in index.html before the
// feature scripts load. The copy must stay in step with sota-experience.js, only show for signed-out visitors on Home,
// and the app must still find supabase and the skin scripts before its own inline script runs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),experience=read('sota-experience.js');
const tpl=(html.match(/<template id="sx-first-paint">([\s\S]*?)<\/template>/)||[])[1]||'';
test('first-paint copy carries the welcome exactly as sota-experience.js renders it',()=>{
 assert.ok(tpl,'template present');
 const copy=(experience.match(/<div class="sx-hero-copy">[\s\S]*?<\/picture><\/div>/)||[])[0];
 assert.ok(copy,'welcome markup found in sota-experience.js');
 assert.ok(tpl.includes(copy),'hero copy (eyebrow, heading, text, buttons, photo) matches sota-experience.js byte for byte');
 assert.ok(tpl.includes('<nav class="sx-nav" data-dps-nav="" aria-label="Main navigation">'),'bottom navigation present');
 assert.ok(tpl.includes('<header class="sx-top" data-dimau-header="">'),'header present');
 assert.ok(!/bw-pill/.test(tpl),'Bula pill is added by its own script, not copied');
 assert.ok(!/ id="sk-sign-(in|up)"/.test(tpl),'no duplicate account button ids');
});
test('first-paint copy only shows for signed-out phone visitors on Home',()=>{
 const sk=html.slice(html.indexOf('window.SK='),html.indexOf('</script>',html.indexOf('window.SK=')));
 assert.match(sk,/matchMedia\('\(max-width:760px\)'\)/);
 assert.match(sk,/\(!h\|\|h==='#home'\)/);
 assert.match(sk,/tok=localStorage\.getItem\('sb-aqfzpaczyodhugsgqvxi-auth-token'\)/);
 assert.match(sk,/fp=ok&&\(!h\|\|h==='#home'\)&&!tok;/,'guests: no stored session');
 assert.match(sk,/code\|sid\|error/);
 assert.ok(html.indexOf('window.SK=')<html.indexOf('<!-- css-bundle'),'decided before the first stylesheet');
 const s=html.slice(html.indexOf('</template>'));const guard=s.slice(0,s.indexOf('</script>'));
 assert.match(guard,/if\(!window\.SK\|\|!SK\.fp\)return;/,'the copy is only drawn on the first-paint path');
 assert.match(guard,/img\.addEventListener\('load',go\)/,'stylesheets and scripts follow the welcome photo');
 assert.match(guard,/setTimeout\(go,\d+\)/,'and never wait for ever');
 assert.ok(html.includes('const SB_URL = "https://aqfzpaczyodhugsgqvxi.supabase.co"'),'token key matches the Supabase project');
});
test('every script after the decision is held the same way, so the page order is kept on both paths',()=>{
 // Outside comments, the only executable scripts left are SK itself, its SK.* calls, the copy guard and two
 // independent beacons; everything else sits in js-later blocks or as text/x-sk-later run by SK.run().
 let live='',at=0;for(let o=html.indexOf('<!--',at);o>=0;o=html.indexOf('<!--',at)){live+=html.slice(at,o);at=html.indexOf('-->',o)+3;}live+=html.slice(at);
 // Each <script ...>...</script> in the live markup, found by position (no regular expression over markup).
 const all=[],low=live.toLowerCase();
 for(let o=low.indexOf('<script');o>=0;){const gt=low.indexOf('>',o),end=low.indexOf('</script',gt);all.push([live.slice(o+7,gt),live.slice(gt+1,end)]);o=low.indexOf('<script',end);}
 const plain=all.filter(m=>!m[0].includes('type="text/x-sk-later"')&&!/^SK\.(css|js|run)\(/.test(m[1]));
 const kinds=plain.map(m=>/src="([^"]+)"/.exec(m[0])?.[1]||m[1].trim().slice(0,24));
 assert.deepEqual(kinds,['/* First paint for a gue','https://dimau-ops.vercel.app/api/visit?s=sota-kece','https://xnxmumbvgtmlpenutlii.supabase.co/functions/v1/track/beacon.js','/* Phones, guests on Hom']);
 assert.equal((live.match(/type="text\/x-sk-later"/g)||[]).length,2,'the app script and its start-up line');
 const held=all.filter(m=>m[0].includes('type="text/x-sk-later"'));
 for(const m of held)assert.ok(live.includes(m[1]+'</script><script>SK.run()</script>'),'each held inline script is followed by SK.run()');
 assert.ok(live.indexOf('/* ---------- config ---------- */')<live.lastIndexOf('boot();'));
});
test('scripts the app needs still load, in order, before the app script',()=>{
 const app=html.indexOf('/* ---------- config ---------- */');let last=-1;
 for(const f of ['/vendor/supabase-2.45.0.min.js','/room-media.js','/skin-identities.js','/pacific-themes.js','/skin-visuals.js','/skins.js','/communications-core.js']){
  const i=html.indexOf('<script src="'+f);assert.ok(i>last&&i<app,f+' in order before the app script');last=i;
  assert.ok(i>html.indexOf('</template>'),f+' after the first-paint copy so it cannot hold up the first paint');
 }
 assert.ok(html.indexOf('rel="preload" as="image"')<html.indexOf('<link rel="stylesheet"'),'photo preload comes before the stylesheets');
});

// Runs the SK script from <head> against a small stand-in for the browser and returns what it decided.
function runSK({width=390,hash='',search='',store={},release}={}){
 const vm=require('node:vm');
 const src=html.slice(html.indexOf('window.SK='),html.indexOf('</script>',html.indexOf('window.SK=')));
 const rel=release||/<meta name="sota-release" content="([^"]+)">/.exec(html)[1],written=[];
 const document={write:s=>written.push(s),querySelector:q=>q==='meta[name="sota-release"]'?{content:rel}:null,createElement:()=>({content:{}}),currentScript:null,addEventListener(){}};
 const window={document,Blob:function(){},URL:{createObjectURL:()=>''},addEventListener(){},matchMedia:q=>({matches:/max-width:760px/.test(q)&&width<=760})};
 const ctx={window,document,location:{hash,search},localStorage:{getItem:k=>k in store?store[k]:null,setItem(k,v){store[k]=String(v);},removeItem(k){delete store[k];}},
  matchMedia:window.matchMedia,URL:window.URL,setTimeout,clearTimeout,Event:function(){}};
 vm.runInNewContext(src,ctx);return {SK:window.SK,written,store};
}
const TOKEN='sb-aqfzpaczyodhugsgqvxi-auth-token',uid='11111111-2222-4333-8444-555555555555';
const session={user:{id:uid}},rel=/<meta name="sota-release" content="([^"]+)">/.exec(html)[1];
const copy=(o={})=>JSON.stringify(Object.assign({v:rel,u:uid,a:'#4FA8D8',t:[['header',['class','top glass sx-top'],'Sota Kece']]},o));
test('signed-in members on a phone take the first-paint path only with their own copy from this release',()=>{
 assert.equal(runSK().SK.fp,true,'guest on a phone');assert.equal(runSK().SK.member,false);
 assert.equal(runSK({width:1440}).SK.fp,false,'wide screens load as before');
 const member=store=>runSK({store:Object.assign({[TOKEN]:JSON.stringify(session)},store)});
 assert.equal(member({}).SK.fp,false,'member without a kept copy loads as before');
 assert.ok(member({}).written.some(s=>s.includes('rel="preload"')),'and preloads at once');
 assert.equal(member({'sk-member-paint':copy()}).SK.member,true,'member with a copy of their Home from this release');
 assert.equal(member({'sk-member-paint':copy()}).SK.fp,true);
 assert.equal(member({'sk-member-paint':copy({u:'someone-else'})}).SK.fp,false,'another account on this device');
 assert.equal(member({'sk-member-paint':copy({v:'older-release'})}).SK.fp,false,'a copy from an older release');
 assert.equal(member({'sk-member-paint':'{broken'}).SK.fp,false,'an unreadable copy');
 for(const hash of ['#home','#view=pulse'])assert.equal(runSK({hash,store:{[TOKEN]:JSON.stringify(session),'sk-member-paint':copy()}}).SK.member,true,hash);
 for(const hash of ['#music','#view=room'])assert.equal(runSK({hash,store:{[TOKEN]:JSON.stringify(session),'sk-member-paint':copy()}}).SK.fp,false,hash+' loads as before');
 assert.equal(runSK({search:'?code=abc',store:{[TOKEN]:JSON.stringify(session),'sk-member-paint':copy()}}).SK.fp,false,'sign-in returns load as before');
 const {SK,store}=member({'sk-member-paint':copy()});SK.forget();assert.ok(!('sk-member-paint' in store),'signing out drops the copy');
});
test('the member copy is rebuilt node by node from the allowed words, never parsed as HTML',()=>{
 const sk=html.slice(html.indexOf('window.SK='),html.indexOf('</script>',html.indexOf('window.SK=')));
 const paint=sk.slice(sk.indexOf('paint:function'),sk.indexOf('keep:function'));
 assert.ok(paint.length>100);
 assert.doesNotMatch(paint,/innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|document\.write|d\.write/,'no HTML parsing');
 assert.match(paint,/allow\[o\[0\]\]/,'elements must be in mw');
 assert.match(paint,/\/\^on\/\.test\(l\)/,'event-handler attributes are dropped');
 assert.match(paint,/href'\|\|l==='src'/,'links and sources must be same-site paths, anchors or https');
 const keep=sk.slice(sk.indexOf('keep:function'),sk.indexOf('forget:function'));
 assert.match(keep,/sx-member-world-heading/,'kept only once the member greeting is on Home');
 assert.match(keep,/max-width|phone\(\)/,'phones only');
 assert.match(keep,/bw-pill/,'the Bula pill is added by its own script, not kept');
 // The app keeps the copy after Home renders and drops it on sign-out; the start-up auth event leaves the copy up.
 assert.match(html,/if\(S\.tab==='pulse'\)window\.SK\?\.keep\?\.\(S\.user\.id,me\.room_accent\|\|''\);/);
 assert.match(html,/if\(!window\.SK\?\.showing\?\.\(\)\)app\.replaceChildren\(\);if\(!next\)window\.SK\?\.forget\?\.\(\);/);
 assert.match(html,/function renderAuth\(mode="in"\)\{\n  viewRun\(\);window\.SK\?\.forget\?\.\(\);/);
 const s=html.slice(html.indexOf('</template>'));const guard=s.slice(0,s.indexOf('</script>'));
 assert.match(guard,/if\(SK\.member\)\{if\(!SK\.paint\(a\)\)a\.replaceChildren\(\);requestAnimationFrame/,'members: copy drawn, then everything loads at once');
});
