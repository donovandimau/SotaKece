const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const stagedPath=path.join(__dirname,'bulavata-files.json');
const archive=fs.existsSync(stagedPath)?JSON.parse(fs.readFileSync(stagedPath,'utf8')):[];
const skins=require(fs.existsSync(path.join(__dirname,'../skins.js'))?'../skins.js':'./bulavata-skins.js');
// Retain historical fixtures, but never let them mask current checked-out files.
const source=p=>{const current=path.join(__dirname,'..',p);if(fs.existsSync(current))return fs.readFileSync(current,'utf8');const saved=archive.find(f=>f.path===p);assert(saved,'Current source or archived fallback exists: '+p);return saved.content;};
for(const preset of skins.presets){
  const s=skins.normalize({id:preset.id,note:'Bula 🌺 </style><script>no</script> */',interests:'Drua, music, café',trackUrl:'https://example.com/song.mp3',trackTitle:'Fiji tunes'});
  const encoded=skins.encode(s,'.scrawl { border-radius: 17px; }');
  assert(!encoded.includes('</style>'));
  assert.deepEqual(skins.read(encoded),{settings:s,legacy:'.scrawl { border-radius: 17px; }'});
  assert(skins.contrast(s.accent,skins.foreground(s.accent))>=4.5);
  const t=skins.tokens(s);assert(skins.contrast(t['--bv-panel'],t['--bv-link'])>=4.5);
  assert(skins.safeLegacy('.scrawl { border-radius: 17px; }').includes('#view.bv-room .scrawl'));
}
assert.equal(skins.normalize({accent:'red;position:fixed',background:'url(https://bad.test)',id:'missing'}).id,'lagoon');
assert.equal(skins.normalize({accent:'red;position:fixed'}).accent,skins.presets.find(p=>p.id==='lagoon').accent);
for(const unsafe of ['@import "https://bad.test";','.scrawl{background:url(https://bad.test)}','</style><script>alert(1)</script>','.scrawl{background:u\\72l(x)}'])assert.equal(skins.safeLegacy(unsafe),'');
assert(!skins.safeLegacy('.scrawl{position:fixed;z-index:9999;color:red}').includes('position'));
assert(!skins.safeLegacy('body{color:red}').includes('body'));
assert.throws(()=>skins.encode({},'x'.repeat(4000)),/too long/);
assert.deepEqual(skins.read('old CSS'),{settings:skins.normalize(),legacy:'old CSS'});
for(const p of ['skins.js','skin-studio.js','offline.js','sw.js'])new vm.Script(source(p),{filename:p});
const html=source('index.html');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
assert(!html.includes('<style id="roomcss">${custom}</style>'));
assert(html.includes('window.BulaSkinStudio?.apply(p,R)'));
const studioScript=/<script\b[^>]*\bsrc="\/skin-studio\.js(?:\?[^\"]*)?"[^>]*>/.exec(html);
assert(studioScript&&studioScript.index<html.lastIndexOf('boot();'),'Skin studio must load before app boot');
for(const marker of ['async function viewPulse','async function sparkCard','async function exportArchive','async function viewCrewRoom','async function viewFriends'])assert(html.includes(marker));
assert(html.includes('<title>Sota Kece'));
assert(/<link rel="manifest" href="\/manifest\.webmanifest">\s*<script src="\/dimau-install\.js(?:\?v=[\w-]+)?" data-app="bulavata" data-label="Sota Kece" data-prompt="manual" data-notify="off" data-buttons="glass" defer><\/script>/.test(html)); // Dimau install kit, no data-sw: sw.js stays the only worker.
assert(!html.includes('Bula Vata'));assert(!html.includes('Tanoa 8'));
assert(!html.includes('fonts.googleapis.com'));assert(!html.includes('cdn.jsdelivr.net'));
for(const bad of ['javascript:alert(1)','http://example.com/song.mp3','https://name:secret@example.com/song.mp3','https://example.com/page'])assert.equal(skins.safeUrl(bad,true),'');
assert.equal(skins.safeUrl('https://example.com/track.m4a?version=2',true),'https://example.com/track.m4a?version=2');
const context={S:{user:{id:'owner'},me:{handle:'sina'}},window:{BulaSkins:skins,BulaSkinStudio:{apply(){}}},esc:v=>String(v).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c])),toast:()=>{},render:()=>{}};
vm.createContext(context);
vm.runInContext(html.slice(html.indexOf('function mediaMarkup'),html.indexOf('function openDecorate')),context);
assert(context.wallMarkup('[sota-meme]'+JSON.stringify({note:'<script>oops</script>',url:'https://example.com/meme.jpg'})).includes('&lt;script&gt;'));
assert(!context.mediaMarkup('javascript:alert(1)').includes('button'));
assert(!context.mediaMarkup('https://example.com/meme.jpg').includes('<img'));
assert(!source('skin-studio.js').includes('<audio')); // No audio request before a tap.
async function pin(rows,readError=null){
  const inserts=[],messages=[];context.toast=m=>messages.push(m);
  context.sb={from:()=>({select:()=>({eq:async()=>({data:rows,error:readError})}),insert:async value=>{inserts.push(value);return {error:null};}})};
  await context.pinTop('new-mate');return {inserts,messages};
}
(async()=>{
  const rows=n=>Array.from({length:n},(_,i)=>({slot:i+1,friend:'mate'+i}));
  assert.equal((await pin(rows(8))).inserts[0].slot,9);
  assert.equal((await pin(rows(15))).inserts[0].slot,16);
  assert.equal((await pin(rows(16))).inserts.length,0);
  assert.equal((await pin([{slot:3,friend:'new-mate'}])).inserts.length,0);
  assert.equal((await pin(null,{message:'offline'})).inserts.length,0);
  vm.runInContext(html.slice(html.indexOf('async function viewRoom'),html.indexOf('function mediaMarkup')),context);
  let rendered='';context.shell=x=>{rendered=x;};context.document={documentElement:{style:{setProperty(){}}}};context.ago=()=>'';
  context.sb={rpc:async()=>({data:{found:true,visible:true,is_me:true,profile:{id:'owner',handle:'sina',avatar_emoji:'🌺',display_name:'Sina',created_at:'2026-10-01',room_accent:'#086779'},top:rows(16).map(x=>({...x,handle:x.friend})),moments:[],wall:[]},error:null})};
  await context.viewRoom();assert.equal((rendered.match(/class="topslot /g)||[]).length,16);assert(rendered.includes('manageTop(16,\'remove\')'));assert(rendered.includes('Talanoa · Whiteboard'));
  context.sb={rpc:async()=>({data:null,error:{message:'offline'}})};await context.viewRoom();assert(rendered.includes('Connection interrupted'));assert(!rendered.includes('No room at'));
  // Public handle searches must wait for an authenticated session and a valid profile.
  let authenticated=false,stored='mate_123',lookups=0,renders=0,authRenders=0;
  const input={value:''};
  const bootContext={S:{},window:{},navigator:{onLine:true},document:{documentElement:{style:{setProperty(){}}}},
    sessionStorage:{getItem:()=>stored,removeItem:()=>{stored='';}},
    sb:{auth:{getSession:async()=>({data:{session:authenticated?{user:{id:'owner'}}:null}})},
      from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{handle:'owner'},error:null})})})}),rpc:()=>{}},
    renderAuth:()=>{authRenders++;},finishRoom:()=>{},shell:()=>{},render:async()=>{renders++;},
    $:()=>input,search:async()=>{lookups++;}};
  vm.createContext(bootContext);
  vm.runInContext(html.slice(html.indexOf('async function boot()'),html.indexOf('/* Signed in, but no room yet.')),bootContext);
  await bootContext.boot();assert.equal(authRenders,1);assert.equal(lookups,0);assert.equal(stored,'mate_123');
  authenticated=true;await bootContext.boot();assert.equal(bootContext.S.tab,'friends');assert.equal(input.value,'mate_123');assert.equal(lookups,1);assert.equal(stored,'');
  stored='<script>';await bootContext.boot();assert.equal(lookups,1);assert.equal(renders,2);
  console.log('PASS: '+skins.presets.length+' skin round trips, contrast, URL/CSS injection guards, Top 16 allocation and cap, duplicate/read-failure handling, sixteen room tiles, tap-only media, connection recovery, authenticated handle-search handoff and all script syntax.');
})().catch(error=>{console.error(error);process.exitCode=1;});
