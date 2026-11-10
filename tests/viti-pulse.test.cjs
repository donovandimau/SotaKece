'use strict';
// Cold-start work (10 Nov 2026): Viti Pulse at the end of the wall, the Sere-first composer,
// starter Koro (hubs), the public listen pages and the maker-only share link.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'/tmp/jsd/node_modules/jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const windows=[];test.after(()=>windows.forEach(w=>w.close()));
const playlist=JSON.parse(read('music-playlist.json'));

function bootWall({posts=[],sere=true,spark=null}={}){
  const d=new JSDOM('<!doctype html><body><div id="app"><main id="view"></main></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://sotakece.com/'});
  const w=d.window;windows.push(w);
  w.IntersectionObserver=class{observe(){}disconnect(){}};w.scrollTo=()=>{};
  const opened=[],went=[],played=[];
  if(sere)w.SotaSere={open:o=>opened.push(o||{}),shareLink:async id=>id==='s-mine'?'https://sotakece.com/s/x/y':null};
  w.fetch=async url=>({ok:true,json:async()=>String(url).includes('music-playlist')?playlist:[]});
  w.Audio=class{constructor(){this.dataset={};this.paused=true;}addEventListener(){}play(){this.paused=false;played.push(this.src);return Promise.resolve();}pause(){this.paused=true;}};
  w.eval(read('sota-pulse.js'));
  const channel={on(){return channel;},subscribe(){return channel;}};
  const client={rpc:async name=>({data:name==='bv_talanoa_feed'?posts:null,error:null}),channel:()=>channel,removeChannel(){}};
  const shared=[];w.navigator.share=async data=>{shared.push(data);};
  w.SotaPulse.init({client,state:{user:{id:'u-ana'},me:{id:'u-ana',handle:'ana',display_name:'Ana'},tab:'pulse'},toast(){},esc,ago:()=>'now',openRoom(){},
    shell:html=>{w.document.getElementById('view').innerHTML=html;},spark:spark?async()=>spark:null,go:t=>went.push(t)});
  return {w,opened,went,played,shared,q:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)]};
}
const post=(id,over)=>Object.assign({id,author:'u-bo',handle:'bo',display_name:'Bo',avatar_emoji:'🥥',accent:'#2A9D8F',body:'line '+id,created_at:new Date(1700000000000+id*60000).toISOString(),like_count:0,repost_count:0,reply_count:0,mine:false},over||{});

test('a short wall ends with the discovery line and Viti Pulse, never the old dead end',dom,async()=>{
  const h=bootWall({posts:[post(1)],spark:'<div class="card"><textarea></textarea></div>'});
  await h.w.SotaPulse.view();await flush();
  assert.equal(h.q('.tw-end').textContent,'You\'re caught up with your mates — here\'s what\'s happening across Viti & the diaspora.');
  assert.doesNotMatch(h.q('#view').textContent,/That is everything on the wall right now/);
  assert.ok(h.q('.tw-viti'));
  assert.equal(h.all('.tw-track').length,3,'three songs from the Island Mix');
  for(const row of h.all('.tw-track')){
    const t=playlist.find(x=>x.id===row.dataset.track);assert.ok(t,'every song is a real Island Mix track');
    assert.equal(row.querySelector('[data-sota-share]').dataset.shareUrl,'https://sotakece.com/t/'+t.id);
  }
  h.q('.tw-track-play').click();
  assert.equal(h.played.length,1);assert.match(h.played[0],/^https:\/\/xnxmumbvgtmlpenutlii\.supabase\.co\/storage\/v1\/object\/public\/fiji-audio\/[a-z0-9-]+\.mp3$/);
  assert.equal(h.q('.tw-track-play').getAttribute('aria-pressed'),'true');
  h.q('.tw-viti [data-tw="people"]').click();h.q('.tw-viti [data-tw="music"]').click();
  assert.deepEqual(h.went,['friends','music']);
  h.q('.tw-viti [data-tw="sere"]').click();assert.equal(h.opened.length,1);
});
test('an empty wall still gets Viti Pulse, and no fake member posts are drawn',dom,async()=>{
  const h=bootWall({posts:[]});
  await h.w.SotaPulse.view();await flush();
  assert.equal(h.all('.tw-post').length,0);
  assert.equal(h.q('.tw-end'),null);
  assert.ok(h.q('.tw-viti'));assert.match(h.q('.tw-empty').textContent,/Say the first thing/);
  assert.equal(h.q('.tw-viti [data-tw="spark"]'),null,'no Spark button when there is no Spark today');
});
test('the composer leads with the singing photo; the text box is the quiet second step',dom,async()=>{
  const h=bootWall({posts:[post(1)]});
  await h.w.SotaPulse.view();await flush();
  const form=h.q('[data-tw-form="post"]');
  assert.equal(form.firstElementChild.className,'tw-make');
  assert.match(form.querySelector('.tw-make-main').textContent,/Make a photo sing/);
  assert.equal(form.querySelector('textarea').rows,1);
  form.querySelector('.tw-make-main').click();form.querySelector('.tw-make-say').click();
  assert.deepEqual(JSON.parse(JSON.stringify(h.opened)),[{},{mode:'say'}]);
  assert.equal(h.w.SotaPulse.composer({replyTo:5}).includes('tw-make'),false,'a reply stays a plain text box');
  const plain=bootWall({posts:[post(1)],sere:false});
  assert.equal(plain.w.SotaPulse.makeRow(),'');assert.match(plain.w.SotaPulse.composer(),/rows="2"/);
});
test('featured songs change by day, wrap round the list and drop anything malformed',()=>{
  const w={addEventListener(){},location:{hash:'',pathname:'/',search:'',origin:'https://sotakece.com'}};w.window=w;
  new Function('window','document','location','history','sessionStorage',read('sota-pulse.js'))(w,undefined,w.location,{replaceState(){}},{getItem(){return null;},setItem(){},removeItem(){}});
  const f=w.SotaPulse.featured,list=[1,2,3,4,5,6,7].map(n=>({id:'t-'+n,title:'T'+n,path:'t-'+n+'.mp3'}));
  assert.deepEqual(f(list,0,3).map(t=>t.id),['t-1','t-2','t-3']);
  assert.deepEqual(f(list,1,3).map(t=>t.id),['t-4','t-5','t-6']);
  assert.deepEqual(f(list,2,3).map(t=>t.id),['t-7','t-1','t-2']);
  assert.deepEqual(f([{id:'ok',title:'A',path:'a.mp3'},{id:'BAD ID',title:'x',path:'x.mp3'},{id:'p',title:'x',path:'../x.mp3'},null],5,3).map(t=>t.id),['ok']);
  assert.deepEqual(f(null,1,3),[]);
});
test('only the maker shares a sere as a public page; everyone else shares the in-app link',dom,async()=>{
  const mine=post(7,{mine:true,author:'u-ana',sere:{id:'s-mine',video:'https://x/v.mp4'}}),theirs=post(8,{sere:{id:'s-theirs',video:'https://x/v.mp4'}});
  const h=bootWall({posts:[theirs,mine]});
  await h.w.SotaPulse.view();await flush();
  h.q('.tw-post[data-id="7"] [data-tw="share"]').click();await flush();
  h.q('.tw-post[data-id="8"] [data-tw="share"]').click();await flush();
  assert.equal(h.shared[0].url,'https://sotakece.com/s/x/y');
  assert.equal(h.shared[1].url,'https://sotakece.com/#talanoa=8');
});

// ---------------------------------------------------------------- starter Koro
function bootHubs(rpcImpl){
  const d=new JSDOM('<!doctype html><body><div id="app"></div></body>',{runScripts:'outside-only',url:'https://sotakece.com/'});
  const w=d.window;windows.push(w);w.eval(read('sota-hubs.js'));
  const calls=[],toasts=[],opened=[],inserts=[];
  const client={rpc:async(name,args)=>{calls.push({name,args});try{return {data:await rpcImpl(name,args||{}),error:null};}catch(error){return {data:null,error};}},
    from:t=>({insert:async row=>{inserts.push({t,row});return {error:null};}})};
  w.SotaHubs.init({client,state:{user:{id:'u-ana'},me:{id:'u-ana'}},toast:m=>toasts.push(m),esc,openRoom:h=>opened.push('room:'+h),openKoro:id=>opened.push('koro:'+id)});
  const app=w.document.getElementById('app');
  return {w,app,calls,toasts,opened,inserts,q:s=>app.querySelector(s),all:s=>[...app.querySelectorAll(s)]};
}
const HUBS=()=>[{slug:'suva',name:'Suva',emoji:'🌴',members:0,joined:false,crew_id:null},{slug:'west',name:'Nadi & Lautoka',emoji:'🌅',members:4,joined:false,crew_id:9},{slug:'diaspora',name:'UK & overseas',emoji:'✈️',members:1,joined:false,crew_id:10}];
test('the starter Koro card shows three one-tap pills and up to three people to greet',dom,async()=>{
  const h=bootHubs(async name=>name==='bv_hubs'?HUBS():[{id:'u-bo',handle:'bo',display_name:'Bo <b>',avatar_emoji:'🥥',posts:2,hub:null}]);
  h.app.innerHTML=h.w.SotaHubs.html('mates');
  assert.equal(h.q('[data-hubs]').hidden,true,'nothing shows until the hubs are known');
  assert.equal(await h.w.SotaHubs.fill(h.app),true);
  assert.deepEqual(h.all('.hub-pill').map(b=>b.querySelector('b').textContent),['Suva','Nadi & Lautoka','UK & overseas']);
  assert.match(h.q('[data-slug="suva"]').textContent,/Be the first/);assert.match(h.q('[data-slug="west"]').textContent,/4 members/);assert.match(h.q('[data-slug="diaspora"]').textContent,/1 member ·/);
  assert.equal(h.q('.hub-who b').textContent,'Bo <b>','names are text, never markup');
  assert.equal(JSON.stringify(h.calls.find(c=>c.name==='bv_people_to_meet').args),'{"p_limit":3}');
});
test('joining is one tap: the pill flips to open, people refresh, and the Koro opens on the next tap',dom,async()=>{
  let joined=false;
  const h=bootHubs(async(name,args)=>{
    if(name==='bv_hubs')return HUBS();
    if(name==='bv_hub_join'){joined=true;return {slug:args.p_slug,name:'Suva',emoji:'🌴',members:1,joined:true,crew_id:12};}
    return joined?[{id:'u-cy',handle:'cy',display_name:'Cy',hub:'Suva',posts:0}]:[];
  });
  h.app.innerHTML=h.w.SotaHubs.html('wall');await h.w.SotaHubs.fill(h.app);
  assert.match(h.q('.hub-first').textContent,/among the first/,'with nobody to suggest the card offers an invite instead');
  h.q('[data-slug="suva"]').click();await flush();
  assert.equal(JSON.stringify(h.calls.filter(c=>c.name==='bv_hub_join').map(c=>c.args)),'[{"p_slug":"suva"}]');
  assert.equal(h.q('[data-slug="suva"]').dataset.hub,'open');assert.match(h.q('[data-slug="suva"]').textContent,/You are in/);
  assert.match(h.toasts[0],/You are in Suva/);
  assert.match(h.q('.hub-who small').textContent,/@cy · Suva/);
  h.q('[data-slug="suva"]').click();assert.deepEqual(h.opened,['koro:12']);
  h.q('[data-hub="ask"]').click();await flush();
  assert.equal(JSON.stringify(h.inserts),'[{"t":"bv_friendships","row":{"requester":"u-ana","addressee":"u-cy"}}]');
  assert.equal(h.q('[data-hub="ask"]').disabled,true);assert.equal(h.q('[data-hub="ask"]').textContent,'Asked');
});
test('before the migration is run the card removes itself and tells the page',dom,async()=>{
  const h=bootHubs(async()=>{throw {code:'PGRST202',message:'Could not find the function public.bv_hubs'};});
  h.app.innerHTML='<div id="wrap">'+h.w.SotaHubs.html('mates')+'</div>';
  let told=0;h.app.addEventListener('sota-hubs-unavailable',()=>told++);
  assert.equal(await h.w.SotaHubs.fill(h.app),false);
  assert.equal(h.q('[data-hubs]'),null);assert.equal(told,1);
  assert.equal(await h.w.SotaHubs.fill(h.app),false);
  assert.equal(h.calls.length,1,'it does not keep asking a database that has no hubs');
});
test('a failed join leaves the pill ready to try again',dom,async()=>{
  const h=bootHubs(async name=>{if(name==='bv_hubs')return HUBS();if(name==='bv_hub_join')throw {message:'NO_SUCH_HUB'};return [];});
  h.app.innerHTML=h.w.SotaHubs.html('wall');await h.w.SotaHubs.fill(h.app);
  h.q('[data-slug="west"]').click();await flush();
  assert.equal(h.q('[data-slug="west"]').disabled,false);assert.equal(h.q('[data-slug="west"]').dataset.hub,'join');
  assert.deepEqual(h.toasts,['That Koro is not open yet.']);
});

// ---------------------------------------------------------------- page wiring
test('no page ends on Where to next cards: the rail and bottom bar own the switching',()=>{
  const worlds=read('sota-worlds.js'),css=read('sota-worlds.css');
  assert.doesNotMatch(worlds,/recommendations\(|sx-world-next-member|Where to next/);
  assert.doesNotMatch(css,/sx-world-next-member/);
});
test('index.html loads the hubs, stands the card in for an empty Top Mates panel and the worker caches it',()=>{
  const html=read('index.html'),sw=read('sw.js'),css=read('sota-hubs.css');
  assert.match(html,/<script src="\/sota-hubs\.js\?v=[^"]+"><\/script><script src="\/sota-pulse\.js\?v=/);
  assert.match(html,/<link rel="stylesheet" href="\/sota-hubs\.css\?v=/);
  assert.match(html,/context==='mates'&&\(S\.friends\.length\|\|S\.metaErrors\?\.friends\)/,'only while the member has no accepted friends');
  assert.match(html,/addEventListener\('sota-hubs-unavailable',\(\)=>host\?\.classList\.remove\('sota-social-no-mates'\)/);
  assert.match(css,/\.sota-social-host\.sota-social-no-mates \[data-social-panel="mates"\]\{display:none\}/);
  assert.match(html,/window\.SotaHubs\?\.reset\(\);S\.user=null/,'sign-out forgets the last member\'s hubs');
  assert.match(sw,/'\/sota-hubs\.js','\/sota-hubs\.css'/);
  assert.equal((html.match(/sota-kece-shell-20261110-v170-share-engine/g)||[]).length,1);
});

// ---------------------------------------------------------------- public listen pages
const listen=require(path.join(root,'api/listen.js'));
const SECRET='s'.repeat(32),ID='0b0e7f3a-1111-4111-8111-2222aaaa3333';
function res(){const r={headers:{},code:0,body:'',setHeader(k,v){r.headers[k.toLowerCase()]=v;},status(c){r.code=c;return r;},send(b){r.body=b;return r;},json(o){r.body=o;return r;}};return r;}
async function withEnv(env,fetcher,run){
  const keep={fetch:global.fetch,env:{}};for(const k of Object.keys(env)){keep.env[k]=process.env[k];process.env[k]=env[k];}
  global.fetch=fetcher;
  try{return await run();}finally{global.fetch=keep.fetch;for(const k of Object.keys(env)){if(keep.env[k]===undefined)delete process.env[k];else process.env[k]=keep.env[k];}}
}
const VIDEO='https://aqfzpaczyodhugsgqvxi.supabase.co/storage/v1/object/public/sere-video/u/j/v.mp4',POSTER=VIDEO.replace('v.mp4','p.jpg');
const sereDb=row=>async url=>({ok:true,json:async()=>String(url).includes('bv_profiles')?[{display_name:'Mere "M" <Vuki>',handle:'mere'}]:(row?[row]:[])});
test('a song page plays without an account and carries the preview tags chat apps read',async()=>{
  const track=playlist[1],r=res();
  await withEnv({},async()=>{throw Error('no network needed');},()=>listen({method:'GET',query:{track:track.id}},r));
  assert.equal(r.code,200);assert.match(r.headers['content-type'],/text\/html/);assert.equal(r.headers['x-content-type-options'],'nosniff');
  assert.ok(r.body.includes(`<meta property="og:title" content="${esc(track.title)} · Sota Kece">`));
  assert.ok(r.body.includes(`<meta property="og:audio" content="https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/fiji-audio/${track.path}">`));
  assert.match(r.body,/<meta property="og:image" content="https:\/\/sotakece\.com\/assets\/og-sota-kece-20261104\.jpg">/);
  assert.match(r.body,/<audio controls preload="none" src="https:\/\/xnxmumbvgtmlpenutlii/);
  assert.ok(r.body.includes(`href="https://sotakece.com/?song=${track.id}"`));
  assert.ok(r.body.indexOf('og:image')<r.body.indexOf('<style>'),'preview tags come before the styling');
  const missing=res();await listen({method:'GET',query:{track:'no-such-song'}},missing);assert.equal(missing.code,404);
  const bad=res();await listen({method:'GET',query:{track:'../../etc'}},bad);assert.equal(bad.code,404);
  const post=res();await listen({method:'POST',query:{track:track.id}},post);assert.equal(post.code,405);
});
test('a sere page needs the signed key, shows only our own files and escapes the maker\'s words',async()=>{
  const key=listen.shareKey(SECRET,ID),row={id:ID,user_id:'u',caption:'Isa <script>alert(1)</script>',output_video_url:VIDEO,output_poster_url:POSTER};
  const ok=res();await withEnv({SERE_SECRET:SECRET,SOTA_SERVICE_KEY:'k'.repeat(30)},sereDb(row),()=>listen({method:'GET',query:{sere:ID.toUpperCase(),k:key}},ok));
  assert.equal(ok.code,200);
  assert.ok(ok.body.includes(`<meta property="og:video" content="${VIDEO}">`));assert.ok(ok.body.includes(`<meta property="og:image" content="${POSTER}">`));
  assert.ok(ok.body.includes('<video controls playsinline preload="metadata"'));
  assert.ok(ok.body.includes('Mere made a photo sing'),'first name only');
  assert.equal(ok.body.includes('<script>alert'),false);assert.ok(ok.body.includes('Isa &lt;script&gt;'));
  assert.match(ok.body,/<meta name="robots" content="noindex">/);
  assert.ok(ok.body.includes(`https://sotakece.com/s/${ID}/${key}`));
  let asked=0;const count=async(...a)=>{asked++;return sereDb(row)(...a);};
  for(const k of ['',key.slice(0,-1)+(key.endsWith('0')?'1':'0'),'x'.repeat(32),listen.shareKey('other-secret-other-secret',ID)]){
    const r=res();await withEnv({SERE_SECRET:SECRET,SOTA_SERVICE_KEY:'k'.repeat(30)},count,()=>listen({method:'GET',query:{sere:ID,k}},r));
    assert.equal(r.code,404);assert.equal(r.headers['cache-control'],'no-store');
  }
  assert.equal(asked,0,'a wrong key never reaches the database');
  const removed=res();await withEnv({SERE_SECRET:SECRET,SOTA_SERVICE_KEY:'k'.repeat(30)},sereDb(null),()=>listen({method:'GET',query:{sere:ID,k:key}},removed));
  assert.equal(removed.code,404,'a removed sere takes its page with it');
  const foreign=res();await withEnv({SERE_SECRET:SECRET,SOTA_SERVICE_KEY:'k'.repeat(30)},sereDb(Object.assign({},row,{output_video_url:'https://evil.example/v.mp4'})),()=>listen({method:'GET',query:{sere:ID,k:key}},foreign));
  assert.equal(foreign.code,404,'a video that is not in our bucket is never embedded');
  const nosecret=res();await withEnv({SERE_SECRET:'',SOTA_SERVICE_KEY:'k'.repeat(30)},sereDb(row),()=>listen({method:'GET',query:{sere:ID,k:listen.shareKey('',ID)}},nosecret));
  assert.equal(nosecret.code,404,'no secret set means no public pages at all');
});
test('only the maker of a finished sere is given its public link',async()=>{
  const sere=require(path.join(root,'api/sere.js'));
  const job=over=>Object.assign({id:ID,user_id:'11111111-1111-4111-8111-111111111111',status:'completed',output_video_url:VIDEO},over||{});
  const run=async(row,uid)=>{const r=res();await withEnv({SERE_SECRET:SECRET,SOTA_SERVICE_KEY:'k'.repeat(30)},
    async url=>({ok:true,json:async()=>String(url).includes('/auth/v1/user')?{id:uid}:[row]}),
    ()=>sere({method:'POST',headers:{authorization:'Bearer '+'t'.repeat(40)},body:{action:'share',id:ID}},r));return r;};
  const mine=await run(job(),'11111111-1111-4111-8111-111111111111');
  assert.equal(mine.code,200);assert.equal(mine.body.url,listen.shareUrl(SECRET,ID));
  assert.equal((await run(job(),'22222222-2222-4222-8222-222222222222')).code,404,'another member is refused');
  assert.equal((await run(job({status:'processing',output_video_url:null}),'11111111-1111-4111-8111-111111111111')).code,409);
});
test('the routes send /s and /t to the listen function ahead of the static files',()=>{
  const cfg=JSON.parse(read('vercel.json')),routes=cfg.routes,fs_i=routes.findIndex(r=>r.handle==='filesystem');
  const s=routes.findIndex(r=>r.dest==='/api/listen?sere=$1&k=$2'),t=routes.findIndex(r=>r.dest==='/api/listen?track=$1');
  assert.ok(s>=0&&t>=0&&s<fs_i&&t<fs_i);
  assert.ok(new RegExp('^'+routes[s].src+'$').test(`/s/${ID}/${listen.shareKey(SECRET,ID)}`));
  assert.ok(new RegExp('^'+routes[t].src+'$').test('/t/fiji-remix-2026-01'));
  assert.equal(new RegExp('^'+routes[t].src+'$').test('/terms.html'),false);
  assert.equal(new RegExp('^'+routes[s].src+'$').test('/sere/index.html'),false);
  assert.ok(cfg.functions['api/listen.js']);
});

// Home live feed and composer (10 Nov 2026).
test('the Home composer can drop a moment or share an Island Mix song, and shows the latest moments',dom,async()=>{
  const h=bootWall({posts:[post(1,{body:'Tune of the week https://sotakece.com/t/fiji-remix-2026-01 <b>x</b>'})]});
  const moments=[{id:9,display_name:'Mere',handle:'mere',avatar_emoji:'🌴',accent:'#e0559b',body:'Lovo at four <i>today</i>',created_at:new Date().toISOString()},{id:8,display_name:'Bo',handle:'bo',body:'',media_url:'https://example.test/a.jpg',created_at:new Date().toISOString()}];
  h.w.SotaPlus={feedCompat:async()=>({data:moments,error:null})};
  await h.w.SotaPulse.view();await flush();
  // A shared song link becomes one safe tap target; everything else stays escaped text.
  const link=h.q('.tw-post .tw-track-link');assert.equal(link.getAttribute('href'),'/t/fiji-remix-2026-01');assert.equal(link.getAttribute('rel'),'noopener');assert.equal(h.q('.tw-post .tw-body b'),null);
  const hostile=h.w.SotaPulse.rich('https://sotakece.com/t/x" onclick="y https://evil.test/t/abc <script>');
  assert.equal((hostile.match(/<a /g)||[]).length,1,'only the Sota Kece song link is linked');const frag=h.w.document.createElement('div');frag.innerHTML=hostile;assert.equal(frag.querySelectorAll('*').length,2,'one link and its icon, no other element');assert.equal(frag.querySelector('a').getAttribute('href'),'/t/x');assert.equal(frag.querySelector('a').attributes.length,4,'class, href, target and rel only');assert(frag.textContent.includes('" onclick="y https://evil.test/t/abc <script>'),'everything else stays visible text');
  // Latest moments: names and words as text, a photo-only moment gets plain words.
  const cards=h.all('.tw-moment');assert.equal(cards.length,2);assert.match(cards[0].textContent,/Mere.*Lovo at four <i>today<\/i>/);assert.equal(cards[0].querySelector('i'),null);assert.match(cards[1].textContent,/Shared a photo/);
  cards[0].click();assert.equal(h.went.at(-1),'moments');
  h.q('[data-tw="moment"]').click();assert.equal(h.went.filter(t=>t==='moments').length,2);
  // Share a track: opens the picker with clean names, puts the song and its listen link in the box, ready to post.
  const open=h.q('.tw-quick [data-tw="track"]'),box=h.q('#tw-track-pick');assert.equal(box.hidden,true);open.click();assert.equal(box.hidden,false);assert.equal(open.getAttribute('aria-expanded'),'true');
  const pick=h.q('[data-tw-track]');assert.equal(pick.options.length,playlist.length+1);assert.equal(pick.options[2].textContent,'Lauti Au — DJ Jordan · Remix'.replace('Lauti Au — DJ Jordan · Remix',h.w.SotaPlaylist?'Lauti Au — DJ Jordan · Remix':playlist[1].title));
  pick.value=playlist[1].id;pick.dispatchEvent(new h.w.Event('change',{bubbles:true}));
  const ta=h.q('[data-tw-form="post"] textarea');assert.match(ta.value,/^🎶 .+ https:\/\/sotakece\.com\/t\/fiji-remix-2026-01$/);assert.equal(h.q('[data-tw-form="post"] button[type=submit]').disabled,false);assert.equal(box.hidden,true);
  assert(ta.value.length<=280);
});
test('Viti Pulse shows clean song names when the playlist parser is loaded',dom,async()=>{
  const h=bootWall({posts:[]});h.w.eval(read('music-playlist.js'));
  await h.w.SotaPulse.view();await flush();
  for(const row of h.all('.tw-track-title'))assert.doesNotMatch(row.textContent,/[_#\[\]]| - /);
});
