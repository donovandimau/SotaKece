'use strict';
// Cloudflare Worker routing (cloudflare/site-routes.cjs): the vercel.json routes that static files
// cannot answer, restored after the move from Vercel to Cloudflare Workers on 17 Nov 2026.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const routes=require('../cloudflare/site-routes.cjs');
const listen=require('../api/listen.js');
const vercel=require('../vercel.json');

const ASSETS={fetch:async req=>{const r=req instanceof Request?req:new Request(req);ASSETS.last=new URL(r.url).pathname;return new Response('static '+ASSETS.last);}};
const env=(extra={})=>({ASSETS,...extra});
const get=(url,init)=>new Request(url,init);
const SERE='11111111-2222-4333-8444-555555555555';

function stubFetch(t,answer){
  const real=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,o={})=>{calls.push({url:String(url),o});return answer(String(url),o);};
  t.after(()=>{globalThis.fetch=real;});
  return calls;
}

test('every short-link route in vercel.json has the same pattern in the Worker',()=>{
  const fromVercel=vercel.routes.filter(r=>/^\/[stpi]\//.test(r.src||'')).map(r=>'^'+r.src+'$');
  assert.deepEqual(routes.ROUTES.map(r=>r.re.source.replace(/\\\//g,'/')),fromVercel);
});

test('paths are matched like Vercel did, and nothing else is caught',()=>{
  assert.deepEqual(routes.match('/t/fiji-default-soundtrack-v1').query,{track:'fiji-default-soundtrack-v1'});
  assert.deepEqual(routes.match('/t/abc/').query,{track:'abc'});
  assert.deepEqual(routes.match('/p/42/'+'A'.repeat(32)).query,{post:'42',t:'A'.repeat(32)});
  assert.deepEqual(routes.match('/i/'+'b'.repeat(32)).query,{t:'b'.repeat(32)});
  assert.deepEqual(routes.match(`/s/${SERE}/${'c'.repeat(32)}`).query,{sere:SERE,k:'c'.repeat(32)});
  for(const p of ['/','/t/Bad_Id','/i/short','/p/x/'+'a'.repeat(32),'/s/'+SERE,'/sere/','/t/a/b','/api/listen'])assert.equal(routes.match(p),null,p);
});

test('wrangler.jsonc sends exactly these paths to the Worker first',()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(__dirname,'../wrangler.jsonc'),'utf8').replace(/^\s*\/\/.*$/gm,''));
  assert.equal(cfg.main,'cloudflare/site-worker.js');
  assert.deepEqual(cfg.compatibility_flags,['nodejs_compat']);
  assert.equal(cfg.assets.binding,'ASSETS');
  assert.deepEqual(cfg.assets.run_worker_first,['/','/s/*','/t/*','/p/*','/i/*','/api/*']);
});

test('sere.sotakece.com/ opens the Sere app; sotakece.com/ and other sere paths stay as they are',async()=>{
  assert.equal(await (await routes.handle(get('https://sere.sotakece.com/'),env())).text(),'static /sere/');
  assert.equal(await (await routes.handle(get('https://sotakece.com/'),env())).text(),'static /');
  assert.equal(await (await routes.handle(get('https://sere.sotakece.com/privacy.html'),env())).text(),'static /privacy.html');
  assert.equal(await (await routes.handle(get('https://sotakece.com/t/Bad_Id'),env())).text(),'static /t/Bad_Id');
});

test('/t/<song> is the public song page with the site security headers',async t=>{
  const calls=stubFetch(t,()=>{throw Error('no network expected');});
  const r=await routes.handle(get('https://sotakece.com/t/fiji-default-soundtrack-v1'),env());
  const html=await r.text();
  assert.equal(r.status,200);
  assert.match(html,/<meta property="og:audio" content="https:\/\/xnxmumbvgtmlpenutlii\.supabase\.co\/storage\/v1\/object\/public\/fiji-audio\/fiji-default-soundtrack\.mp3">/);
  assert.equal(r.headers.get('content-type'),'text/html; charset=utf-8');
  assert.match(r.headers.get('content-security-policy'),/^frame-ancestors 'self'/);
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.equal(r.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
  assert.equal(calls.length,0);
  const missing=await routes.handle(get('https://sotakece.com/t/no-such-song'),env());
  assert.equal(missing.status,404);
  const head=await routes.handle(get('https://sotakece.com/t/fiji-default-soundtrack-v1',{method:'HEAD'}),env());
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  const post=await routes.handle(get('https://sotakece.com/t/fiji-default-soundtrack-v1',{method:'POST'}),env());
  assert.equal(post.status,405);assert.equal(post.headers.get('allow'),'GET, HEAD');
});

test('/i/<token> and /p/<post>/<token> run the invite and share pages against Supabase',async t=>{
  const calls=stubFetch(t,(url,o)=>{
    const body=JSON.parse(o.body);
    if(url.endsWith('/rpc/bv_invite_open'))return Response.json(body.p_token==='a'.repeat(32)?{handle:'mere',display_name:'Mere T'}:null);
    if(url.endsWith('/rpc/bv_talanoa_shared'))return Response.json(body.p_token==='b'.repeat(32)?{id:42,handle:'mere',display_name:'Mere',body:'Bula',created_at:new Date().toISOString()}:null);
    return new Response('',{status:500});
  });
  let r=await routes.handle(get('https://sotakece.com/i/'+'A'.repeat(32)),env());
  assert.equal(r.status,200);assert.match(await r.text(),/<title>Mere T invited you to Sota Kece<\/title>/);
  assert.equal(r.headers.get('cache-control'),'private, max-age=60');
  r=await routes.handle(get('https://sotakece.com/i/'+'c'.repeat(32)),env());assert.equal(r.status,404);
  r=await routes.handle(get('https://sotakece.com/p/42/'+'b'.repeat(32)),env());
  assert.equal(r.status,200);assert.match(await r.text(),/<title>Mere on Sota Kece<\/title>/);
  assert.match(r.headers.get('content-security-policy'),/frame-ancestors/);
  r=await routes.handle(get('https://sotakece.com/p/42/'+'c'.repeat(32)),env());assert.equal(r.status,404);
  assert.deepEqual(calls.map(c=>c.url.replace(/^https:\/\/[^/]+/,'')),['/rest/v1/rpc/bv_invite_open','/rest/v1/rpc/bv_invite_open','/rest/v1/rpc/bv_talanoa_shared','/rest/v1/rpc/bv_talanoa_shared']);
  assert(calls.every(c=>!/service|secret/i.test(JSON.stringify(c.o.headers))));
});

test('/s/ without the sere secrets on the Worker is answered by the Vercel deployment that has them',async()=>{
  const seen=[];
  const fetcher=async(url,o)=>{seen.push({url,o});return new Response('from vercel',{status:200,headers:{'content-type':'text/html; charset=utf-8'}});};
  const r=await routes.handle(get(`https://sotakece.com/s/${SERE}/${'d'.repeat(32)}`),env(),fetcher);
  assert.equal(await r.text(),'from vercel');
  assert.equal(seen[0].url,`${routes.VERCEL_ORIGIN}/s/${SERE}/${'d'.repeat(32)}`);
  assert.equal(seen[0].o.method,'GET');
  assert.match(r.headers.get('content-security-policy'),/frame-ancestors/);
  const down=await routes.handle(get(`https://sotakece.com/s/${SERE}/${'d'.repeat(32)}`),env(),async()=>{throw Error('offline');});
  assert.equal(down.status,503);assert.match(await down.text(),/That did not load/);
});

test('/s/ with the sere secrets on the Worker runs api/listen.js itself and checks the signed key',async t=>{
  const secret='test-secret-0123456789abcdef',vid='https://aqfzpaczyodhugsgqvxi.supabase.co/storage/v1/object/public/sere-video/x.mp4';
  const saved={k:process.env.SOTA_SERVICE_KEY,s:process.env.SERE_SECRET};
  delete process.env.SOTA_SERVICE_KEY;delete process.env.SERE_SECRET;
  t.after(()=>{for(const [k,v] of [['SOTA_SERVICE_KEY',saved.k],['SERE_SECRET',saved.s]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
  stubFetch(t,url=>url.includes('/bv_sere_media_generations')?Response.json([{id:SERE,user_id:'u1',caption:'Isa lei',output_video_url:vid}]):Response.json([{display_name:'Mere Tora'}]));
  const e=env({SOTA_SERVICE_KEY:'fake_service_key_for_test_only',SERE_SECRET:secret});
  const never=async()=>{throw Error('must not call Vercel');};
  let r=await routes.handle(get(`https://sotakece.com/s/${SERE}/${listen.shareKey(secret,SERE)}`),e,never);
  assert.equal(r.status,200);assert.match(await r.text(),/<title>Mere made a photo sing/);
  r=await routes.handle(get(`https://sotakece.com/s/${SERE}/${'f'.repeat(32)}`),e,never);
  assert.equal(r.status,404);
});
