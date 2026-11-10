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
 const s=html.slice(html.indexOf('</template>'));const guard=s.slice(0,s.indexOf('</script>'));
 assert.match(guard,/matchMedia\('\(max-width:760px\)'\)/);
 assert.match(guard,/h&&h!=='#home'/);
 assert.match(guard,/localStorage\.getItem\('sb-aqfzpaczyodhugsgqvxi-auth-token'\)\)return/);
 assert.ok(html.includes('const SB_URL = "https://aqfzpaczyodhugsgqvxi.supabase.co"'),'token key matches the Supabase project');
});
test('scripts the app needs still load, in order, before the app script',()=>{
 const app=html.indexOf('/* ---------- config ---------- */');let last=-1;
 for(const f of ['/vendor/supabase-2.45.0.min.js','/room-media.js','/skin-identities.js','/pacific-themes.js','/skin-visuals.js','/skins.js','/communications-core.js']){
  const i=html.indexOf('<script src="'+f);assert.ok(i>last&&i<app,f+' in order before the app script');last=i;
  assert.ok(i>html.indexOf('</template>'),f+' after the first-paint copy so it cannot hold up the first paint');
 }
 assert.ok(html.indexOf('rel="preload" as="image"')<html.indexOf('<link rel="stylesheet"'),'photo preload comes before the stylesheets');
});
