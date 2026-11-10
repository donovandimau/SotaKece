// POST /api/account-delete — the signed-in member deletes their own account.
// Order matters: files first through the storage API (so the bytes go, not
// just the rows), then bv_account_delete() as the member (profile and its
// cascades — the shared Dimau login is kept), then a second file sweep to catch an upload that raced the
// delete. Needs SOTA_SERVICE_KEY (same as /api/sere).
'use strict';
const SOTA_URL='https://aqfzpaczyodhugsgqvxi.supabase.co';
const SOTA_KEY='sb_publishable_DvpX2PSuPtxE3IqWUlRZfQ_YP2qLZtF';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKETS=['sere-video','sere-images','sere-audio','bv-room-media','profile-photos','talanoa-voice'];

function svcHeaders(env,extra){
  const key=String(env.SOTA_SERVICE_KEY||'');
  if(key.length<20)throw Error('config');
  return Object.assign({apikey:key,Authorization:`Bearer ${key}`},extra||{});
}
async function who(auth,fetcher){
  if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(auth))return null;
  const r=await fetcher(`${SOTA_URL}/auth/v1/user`,{headers:{apikey:SOTA_KEY,Authorization:auth},signal:AbortSignal.timeout(5000)});
  if(!r.ok)return null;
  const u=await r.json();return UUID.test(u?.id||'')?u.id:null;
}
// Every object under <uid>/ in one bucket (paged), deleted through the API.
async function wipeBucket(env,bucket,uid,fetcher){
  let removed=0;
  for(let page=0;page<50;page++){
    const r=await fetcher(`${SOTA_URL}/storage/v1/object/list/${bucket}`,{
      method:'POST',headers:svcHeaders(env,{'Content-Type':'application/json'}),
      body:JSON.stringify({prefix:`${uid}/`,limit:1000,offset:0}),signal:AbortSignal.timeout(10000)});
    if(r.status===404||r.status===400)return removed; // bucket absent
    if(!r.ok)throw Error('storage list '+r.status);
    const items=(await r.json()).filter(o=>o&&o.name);
    if(!items.length)return removed;
    // list returns folders too; walk one level down for nested files
    const paths=[];
    for(const o of items){
      if(o.id)paths.push(`${uid}/${o.name}`);
      else{
        const s=await fetcher(`${SOTA_URL}/storage/v1/object/list/${bucket}`,{
          method:'POST',headers:svcHeaders(env,{'Content-Type':'application/json'}),
          body:JSON.stringify({prefix:`${uid}/${o.name}/`,limit:1000,offset:0}),signal:AbortSignal.timeout(10000)});
        if(!s.ok)throw Error('storage list '+s.status);
        for(const f of await s.json())if(f&&f.name&&f.id)paths.push(`${uid}/${o.name}/${f.name}`);
      }
    }
    if(!paths.length)return removed;
    const d=await fetcher(`${SOTA_URL}/storage/v1/object/${bucket}`,{
      method:'DELETE',headers:svcHeaders(env,{'Content-Type':'application/json'}),
      body:JSON.stringify({prefixes:paths}),signal:AbortSignal.timeout(15000)});
    if(!d.ok)throw Error('storage delete '+d.status);
    removed+=paths.length;
    if(items.length<1000)return removed; // that was the last page
  }
  return removed;
}
async function wipeAll(env,uid,fetcher){
  let n=0;for(const b of BUCKETS)n+=await wipeBucket(env,b,uid,fetcher);return n;
}
async function handler(req,res){
  if(req.method!=='POST'){res.statusCode=405;return res.end();}
  const fetcher=globalThis.fetch;
  try{
    const auth=req.headers.authorization;
    const uid=await who(auth,fetcher);
    if(!uid){res.statusCode=401;return res.end(JSON.stringify({error:'sign in first'}));}
    const files=await wipeAll(process.env,uid,fetcher);
    const r=await fetcher(`${SOTA_URL}/rest/v1/rpc/bv_account_delete`,{
      method:'POST',headers:{apikey:SOTA_KEY,Authorization:auth,'Content-Type':'application/json'},
      body:'{}',signal:AbortSignal.timeout(15000)});
    if(!r.ok){const t=await r.text();console.error('account-delete rpc',r.status,t.slice(0,200));res.statusCode=502;return res.end(JSON.stringify({error:'could not delete the account'}));}
    // The profile is gone by now, so a failed late sweep is reported, not hidden:
    // the page still shows success (the data is deleted) and the leftover files
    // are logged by member id for support to clear.
    let late=0,sweep='done';
    try{late=await wipeAll(process.env,uid,fetcher);}
    catch(e){sweep='failed';console.error('account-delete late sweep',uid,e&&e.message);}
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({ok:true,files:files+late,sweep}));
  }catch(e){
    console.error('account-delete',e&&e.message);
    res.statusCode=500;res.end(JSON.stringify({error:'could not delete the account'}));
  }
}
module.exports=handler;
module.exports.wipeBucket=wipeBucket;
module.exports.BUCKETS=BUCKETS;
