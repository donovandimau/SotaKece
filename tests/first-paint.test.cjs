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
 assert.match(sk,/!localStorage\.getItem\('sb-aqfzpaczyodhugsgqvxi-auth-token'\)/);
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
