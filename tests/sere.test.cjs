'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'/tmp/jsd/node_modules/jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------------------------------------------------------------- maker helpers (pure)
const sere=require(path.join(root,'sere-maker.js'));
test('pickWindow keeps a 60 s window inside the track',()=>{
  assert.deepEqual(sere.pickWindow(0,185000),{startMs:0,endMs:60000});
  assert.deepEqual(sere.pickWindow(150000,185000),{startMs:125000,endMs:185000},'start is pulled back so the window fits');
  assert.deepEqual(sere.pickWindow(-5,9000),{startMs:0,endMs:9000},'short clip is the whole clip');
  assert.deepEqual(sere.pickWindow(120400,185000),{startMs:120400,endMs:180400});
});
test('checkImageDims enforces size, sides and a portrait-friendly aspect',()=>{
  assert.equal(sere.checkImageDims(768,1024,500000),null);
  assert.equal(sere.checkImageDims(1000,1000,500000),null,'square is fine');
  assert.match(sere.checkImageDims(200,400,1000),/too small/);
  assert.match(sere.checkImageDims(5000,4000,1000),/too large/);
  assert.match(sere.checkImageDims(1600,400,1000),/portrait or square/);
  assert.match(sere.checkImageDims(800,800,5*1024*1024),/4\.7 MB/);
});
test('encodeWav writes a valid 16-bit mono header and clamps samples',()=>{
  const buf=sere.encodeWav(new Float32Array([0,0.5,-0.5,2,-2]),16000);
  const v=new DataView(buf),str=(o,n)=>String.fromCharCode(...new Uint8Array(buf,o,n));
  assert.equal(str(0,4),'RIFF');assert.equal(str(8,4),'WAVE');assert.equal(str(36,4),'data');
  assert.equal(v.getUint16(22,true),1,'mono');assert.equal(v.getUint32(24,true),16000,'rate');assert.equal(v.getUint16(34,true),16,'bits');
  assert.equal(v.getUint32(40,true),10,'five samples');
  assert.equal(v.getInt16(44,true),0);assert.equal(v.getInt16(46,true),16383);assert.equal(v.getInt16(48,true),-16384);
  assert.equal(v.getInt16(50,true),32767,'clamped high');assert.equal(v.getInt16(52,true),-32768,'clamped low');
});
test('mixWindow averages channels over the chosen window',()=>{
  const left=new Float32Array([1,1,1,1,1,1]),right=new Float32Array([0,0,0,0,0,0]);
  const buffer={sampleRate:1000,length:6,numberOfChannels:2,getChannelData:i=>i?right:left};
  const out=sere.mixWindow(buffer,2,3);
  assert.deepEqual(Array.from(out),[0.5,0.5,0.5]);
  assert.equal(sere.mixWindow(buffer,5,10).length,1,'never reads past the end');
});
test('say maps database codes to plain words',()=>{
  assert.equal(sere.say(new Error('OUT_OF_SERE')),'Five a day — more tomorrow.');
  assert.equal(sere.say(new Error('NOT_FRIENDS')),'Add them as a mate to tip them.');
  assert.equal(sere.say(new Error('zzz'),'custom'),'custom');
});

// ---------------------------------------------------------------- server module
const api=require(path.join(root,'api/sere.js'));
test('webhook signature is HMAC of the id and compares in constant time',()=>{
  const s=api.sign('a-long-secret-value-1234',  '11111111-1111-4111-8111-111111111111');
  assert.match(s,/^[0-9a-f]{64}$/);
  assert.ok(api.sameSig(s,api.sign('a-long-secret-value-1234','11111111-1111-4111-8111-111111111111')));
  assert.ok(!api.sameSig(s,api.sign('other-secret-value-12345','11111111-1111-4111-8111-111111111111')));
  assert.ok(!api.sameSig('',''));
});
test('outputUrl handles string, array and object outputs',()=>{
  assert.equal(api.outputUrl({output:'https://r/v.mp4'}),'https://r/v.mp4');
  assert.equal(api.outputUrl({output:['https://r/a.png','https://r/v.mp4']}),'https://r/v.mp4');
  assert.equal(api.outputUrl({output:{video:'https://r/v.mp4'}}),'https://r/v.mp4');
  assert.equal(api.outputUrl({output:null}),null);
});
test('modelInput maps the two files onto the model keys and merges extras',()=>{
  assert.deepEqual(api.modelInput({},'I','A'),{source_image:'I',driven_audio:'A',still:true,preprocess:'full',enhancer:'gfpgan'});
  const custom=api.modelInput({SERE_INPUT_IMAGE:'face',SERE_INPUT_AUDIO:'audio',SERE_INPUT_EXTRA:'{"fps":25}'},'I','A');
  assert.equal(custom.face,'I');assert.equal(custom.audio,'A');assert.equal(custom.fps,25,'env overrides add to the engine defaults');
  assert.throws(()=>api.modelInput({SERE_INPUT_EXTRA:'{bad'},'I','A'),/config/);
});
test('startRender posts to Replicate with a signed webhook and refuses without keys',async()=>{
  const calls=[];
  const fetcher=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return {ok:true,json:async()=>({id:'pred_1'})};};
  const env={REPLICATE_API_TOKEN:'r8_token_xxxxxxx',SERE_SECRET:'a-long-secret-value-1234',SERE_REPLICATE_MODEL:'owner/sadtalker',SERE_PUBLIC_URL:'https://sotakece.com/'};
  const job={id:'11111111-1111-4111-8111-111111111111'};
  assert.equal(await api.startRender(env,job,'I','A',fetcher),'pred_1');
  assert.equal(calls[0].url,'https://api.replicate.com/v1/models/owner/sadtalker/predictions');
  assert.equal(calls[0].body.webhook,`https://sotakece.com/api/sere-callback?id=${job.id}&sig=${api.sign(env.SERE_SECRET,job.id)}`);
  assert.deepEqual(calls[0].body.webhook_events_filter,['completed']);
  await api.startRender(Object.assign({},env,{SERE_REPLICATE_VERSION:'abc123'}),job,'I','A',fetcher);
  assert.equal(calls[1].url,'https://api.replicate.com/v1/predictions');assert.equal(calls[1].body.version,'abc123');
  await assert.rejects(api.startRender({SERE_SECRET:'a-long-secret-value-1234'},job,'I','A',fetcher),/config/,'no token');
  await api.startRender(Object.assign({},env,{SERE_REPLICATE_MODEL:'bad'}),job,'I','A',fetcher);
  assert.equal(calls[2].url,'https://api.replicate.com/v1/predictions');assert.match(calls[2].body.version,/^85c698db/,'a bad model name falls back to the built-in quick version');
});
test('finish stores the video and poster, marks completed, and marks failures',async()=>{
  const log=[];
  const env={SOTA_SERVICE_KEY:'service-key-xxxxxxxxxxxxxxxx'};
  const job={id:'11111111-1111-4111-8111-111111111111',user_id:'22222222-2222-4222-8222-222222222222',audio_url:'u/a.wav',source_image_url:'u/i.jpg'};
  const fetcher=async(url,init={})=>{
    log.push({url,method:init.method||'GET',headers:init.headers||{},body:init.body});
    if(url==='https://r/v.mp4')return {ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
    if(url.includes('/object/sere-images/'))return {ok:true,headers:new Map([['content-type','image/jpeg']]),arrayBuffer:async()=>new Uint8Array([9]).buffer};
    if(url.includes('/rest/v1/'))return {ok:true,json:async()=>[{id:job.id}]};
    return {ok:true,json:async()=>({})};
  };
  assert.equal(await api.finish(env,job,{status:'succeeded',output:'https://r/v.mp4'},fetcher),'completed');
  const puts=log.filter(l=>l.url.includes('/object/sere-video/'));
  assert.deepEqual(puts.map(p=>p.url.split('/sere-video/')[1]),[`${job.user_id}/${job.id}/v.mp4`,`${job.user_id}/${job.id}/p.jpg`]);
  assert.equal(puts[0].headers['Content-Type'],'video/mp4');
  const patch=log.find(l=>l.method==='PATCH');
  assert.match(patch.url,/status=eq\.processing$/,'only a processing row is completed (idempotent)');
  const body=JSON.parse(patch.body);
  assert.equal(body.status,'completed');assert.match(body.output_video_url,/\/object\/public\/sere-video\/.*\/v\.mp4$/);assert.match(body.output_poster_url,/p\.jpg$/);
  log.length=0;
  assert.equal(await api.finish(env,job,{status:'failed',error:'no face found'},fetcher),'failed');
  assert.equal(JSON.parse(log.find(l=>l.method==='PATCH').body).error,'no face found');
  assert.equal(await api.finish(env,job,{status:'processing'},fetcher),'processing');
});
test('callback refuses a bad signature before touching anything',async()=>{
  const cb=require(path.join(root,'api/sere-callback.js'));
  process.env.SERE_SECRET='a-long-secret-value-1234';
  let status=null;const res={setHeader(){},status(s){status=s;return this;},end(){},json(){}};
  await cb({method:'POST',query:{id:'11111111-1111-4111-8111-111111111111',sig:'nope'}},res);
  assert.equal(status,401);
  await cb({method:'GET',query:{}},res);assert.equal(status,405);
});

// ---------------------------------------------------------------- the wall card
test('the wall renders a sere post with video, tip and remix',{skip:!JSDOM&&'jsdom not installed'},()=>{
  const dom=new JSDOM('<!doctype html><body><div id="app"><main id="view"></main></div></body>',{runScripts:'outside-only',url:'http://test.invalid/'});
  const w=dom.window;w.SotaSere={};
  w.eval(fs.readFileSync(path.join(root,'sota-pulse.js'),'utf8'));
  w.SotaPulse.init({client:{},state:{user:{id:'u-ana'},me:{handle:'ana'}},toast(){},esc,ago:()=>'now',openRoom(){},shell(){}});
  const sr={id:'33333333-3333-4333-8333-333333333333',video:'https://x/v.mp4',poster:'https://x/p.jpg',plays:4,tips:2,scene:'neon',seconds:60,remix_of:null};
  const html=w.SotaPulse.card({id:7,author:'u-bo',handle:'bo',display_name:'Bo',body:'Vude night',created_at:'2026-11-09T00:00:00Z',sere:sr});
  const el=new w.DOMParser().parseFromString(html,'text/html');
  const video=el.querySelector('.tw-sere video');
  assert.ok(video,'video present');assert.equal(video.getAttribute('preload'),'none','video does not download until tapped');
  assert.equal(video.getAttribute('poster'),'https://x/p.jpg');assert.equal(video.dataset.sere,sr.id);
  assert.equal(el.querySelector('.tw-sere').dataset.scene,'neon');
  assert.equal(el.querySelector('[data-tw="tip"]').dataset.id,sr.id);assert.equal(el.querySelector('[data-tw="tip"] b').textContent,'2');
  assert.ok(el.querySelector('[data-tw="remix"]'));
  const mine=new w.DOMParser().parseFromString(w.SotaPulse.card({id:8,author:'u-ana',handle:'ana',body:'me',created_at:'2026-11-09T00:00:00Z',mine:true,sere:sr}),'text/html');
  assert.ok(!mine.querySelector('[data-tw="tip"]'),'no tip button on your own sere');
  assert.equal(w.SotaPulse.sereBox(null),'','posts without a sere are unchanged');
  assert.ok(!w.SotaPulse.card({id:9,author:'u-bo',handle:'bo',body:'plain',created_at:'2026-11-09T00:00:00Z'}).includes('tw-sere'));
  assert.ok(w.SotaPulse.composer().includes('data-tw="sere"'),'composer offers Sere');
  assert.ok(!w.SotaPulse.composer({replyTo:1}).includes('data-tw="sere"'),'not on a reply');
});

// ---------------------------------------------------------------- engines and say-it
test('modelInput picks the engine mapping (quick = SadTalker keys, lifelike = MEMO keys)',()=>{
  assert.deepEqual(api.modelInput({},'I','A','quick'),{source_image:'I',driven_audio:'A',still:true,preprocess:'full',enhancer:'gfpgan'});
  assert.deepEqual(api.modelInput({},'I','A','lifelike'),{image:'I',audio:'A',resolution:512,fps:30,max_audio_seconds:60});
  assert.deepEqual(api.modelInput({},'I','A','nonsense'),api.modelInput({},'I','A','quick'),'unknown engine falls back to quick');
});
test('startRender sends the lifelike version for a lifelike job',async()=>{
  const calls=[];const fetcher=async(url,init)=>{calls.push(JSON.parse(init.body));return {ok:true,json:async()=>({id:'p'})};};
  const env={REPLICATE_API_TOKEN:'r8_token_xxxxxxx',SERE_SECRET:'a-long-secret-value-1234'};
  await api.startRender(env,{id:'11111111-1111-4111-8111-111111111111',engine:'lifelike'},'I','A',fetcher);
  assert.equal(calls[0].version,'be54f93bc72d562ab2577f57b7eec44707efde55d058ee504c8b65a62d70fdf3');assert.equal(calls[0].input.image,'I');
  await api.startRender(env,{id:'11111111-1111-4111-8111-111111111111'},'I','A',fetcher);
  assert.equal(calls[1].version,'85c698db7c0a66d5011435d0191db323034e1da04b912a6d365833141b6a285b');assert.equal(calls[1].input.source_image,'I');
});
test('wavDurationMs reads a WAV header',()=>{
  const buf=Buffer.from(sere.encodeWav(new Float32Array(16000*3),16000));
  assert.equal(api.wavDurationMs(buf),3000);
  assert.equal(api.wavDurationMs(Buffer.from('nope')),null);
});
test('speak waits on Replicate, polls, and returns the audio bytes',async()=>{
  const log=[];
  const fetcher=async(url,init={})=>{log.push(url);
    if(url.endsWith('/predictions'))return {ok:true,json:async()=>({id:'tts1',status:'processing'})};
    if(url.includes('/predictions/tts1'))return {ok:true,json:async()=>({id:'tts1',status:'succeeded',output:'https://r/out.wav'})};
    if(url==='https://r/out.wav')return {ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer};
    throw new Error('unexpected '+url);};
  const bytes=await api.speak({REPLICATE_API_TOKEN:'r8_token_xxxxxxx'},'Bula vinaka','george',fetcher);
  assert.deepEqual(Array.from(bytes),[1,2,3,4]);
  assert.ok(log[0].endsWith('/predictions'),'creates the prediction first');
  await assert.rejects(api.speak({},'hi','bella',fetcher),/config/);
});
test('the maker exposes the voice and engine lists the sheet is built from',()=>{
  assert.ok(sere.VOICES.some(v=>v[0]==='george'));assert.deepEqual(sere.ENGINES.map(e=>e[0]),['quick','lifelike']);
});
