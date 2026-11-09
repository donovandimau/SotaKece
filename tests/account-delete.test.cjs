'use strict';
const test=require('node:test');const assert=require('node:assert');
const {wipeBucket,BUCKETS}=require('../api/account-delete.js');
const env={SOTA_SERVICE_KEY:'x'.repeat(40)};
const UID='33333333-3333-3333-3333-333333333333';
function fetcher(calls){
  return async(url,opts)=>{
    calls.push({url,method:opts.method,body:opts.body});
    if(url.includes('/object/list/')){
      const p=JSON.parse(opts.body).prefix;
      if(p===`${UID}/`) return {ok:true,status:200,json:async()=>[{name:'job1',id:null},{name:'p.jpg',id:'f1'}]};
      if(p===`${UID}/job1/`) return {ok:true,status:200,json:async()=>[{name:'v.mp4',id:'f2'}]};
      return {ok:true,status:200,json:async()=>[]};
    }
    if(opts.method==='DELETE') return {ok:true,status:200,json:async()=>[]};
    return {ok:false,status:500,json:async()=>({})};
  };
}
test('sweep lists the member folder, walks one level and deletes every file through the storage API',async()=>{
  const calls=[];
  const n=await wipeBucket(env,'sere-video',UID,fetcher(calls));
  assert.strictEqual(n,2);
  const del=calls.find(c=>c.method==='DELETE');
  assert.ok(del.url.endsWith('/storage/v1/object/sere-video'));
  assert.deepStrictEqual(JSON.parse(del.body).prefixes.sort(),[`${UID}/job1/v.mp4`,`${UID}/p.jpg`]);
  assert.ok(calls.every(c=>!c.url.includes('/rest/v1/')),'the sweep never touches the database directly');
});
test('a missing bucket is skipped, not fatal',async()=>{
  const n=await wipeBucket(env,'nope',UID,async()=>({ok:false,status:404,json:async()=>({})}));
  assert.strictEqual(n,0);
});
test('every bucket members upload to is swept',()=>{
  for(const b of ['sere-video','sere-images','sere-audio','bv-room-media','profile-photos'])assert.ok(BUCKETS.includes(b),b);
});
