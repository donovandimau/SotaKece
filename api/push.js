'use strict';
// Call alerts for phones that have the site closed (Web Push).
//   GET  /api/push            -> {key}   the public VAPID key the browser subscribes with
//   POST /api/push {action:'ring', call}  (signed in) -> tells the people being rung, once per call
// The caller's own sign-in is used to read who to alert (bv_call_push_targets), so only the person
// who started the call can trigger it and the Worker needs no database service key.
// Worker settings: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (see scripts/make-vapid-keys.mjs),
// optionally VAPID_SUBJECT (a mailto: or https: address, default mailto:support@sotakece.com).
// With the keys unset, nothing is sent and the site works as before.
const {SOTA_URL}=require('./_sota-server.js');
const webpush=require('./_webpush.js');
const SOTA_KEY='sb_publishable_WFJ3jKwImNhGdTdrS9W6mg_3CUSUYIM';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TARGETS=100;

function vapid(env){
  const publicKey=String(env.VAPID_PUBLIC_KEY||'').trim(),privateKey=String(env.VAPID_PRIVATE_KEY||'').trim();
  if(!publicKey||!privateKey)return null;
  const subject=String(env.VAPID_SUBJECT||'mailto:support@sotakece.com').trim();
  if(!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/[^\s]+)$/.test(subject))return null;
  try{
    const pub=webpush.unb64u(publicKey),d=webpush.unb64u(privateKey);
    if(pub.length!==65||pub[0]!==4||d.length!==32)return null;
  }catch(_){return null;}
  return {publicKey,privateKey,subject};
}

async function rpc(name,args,auth,fetcher){
  const r=await fetcher(`${SOTA_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:SOTA_KEY,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(6000)});
  if(r.status===401||r.status===403)return {status:r.status,data:null};
  if(!r.ok)throw Error('db '+r.status);
  const text=await r.text();
  return {status:r.status,data:text?JSON.parse(text):null};
}

const clean=(value,max)=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);

/** Alert everyone being rung for this call. Returns {sent, failed, removed} or {unauthorised:true}. */
async function ring(env,auth,call,fetcher=fetch,sender=webpush.send){
  const keys=vapid(env);
  if(!keys)return {off:true,sent:0,failed:0,removed:0};
  const got=await rpc('bv_call_push_targets',{p_call:call},auth,fetcher);
  if(got.status===401||got.status===403)return {unauthorised:true};
  const info=got.data||{};
  const targets=(Array.isArray(info.targets)?info.targets:[]).filter(t=>t&&webpush.safeEndpoint(t.endpoint)).slice(0,MAX_TARGETS);
  if(!targets.length)return {sent:0,failed:0,removed:0};
  const video=info.mode==='video';
  const message={
    title:clean(info.from,60)+' is calling',
    body:clean(info.group,60)+' · '+(video?'video':'audio')+' call',
    tag:call,url:'/communications.html?view=calls',call,mode:video?'video':'audio'
  };
  let sent=0,failed=0;const gone=[];
  for(let i=0;i<targets.length;i+=10){
    const results=await Promise.allSettled(targets.slice(i,i+10).map(t=>sender(t,message,keys,{fetcher,ttl:45,urgency:'high'})));
    results.forEach((r,n)=>{
      const target=targets[i+n];
      if(r.status==='fulfilled'&&r.value.ok)sent++;
      else{failed++;if(r.status==='fulfilled'&&r.value.gone)gone.push(target.endpoint);}
    });
  }
  let removed=0;
  if(gone.length){try{await rpc('bv_push_prune',{p_call:call,p_endpoints:gone},auth,fetcher);removed=gone.length;}catch(_){}}
  return {sent,failed,removed};
}

async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET'){
    const keys=vapid(process.env);
    if(!keys){res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'Call alerts are not switched on yet.'});}
    res.setHeader('Cache-Control','public, max-age=3600');
    return res.status(200).json({key:keys.publicKey});
  }
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Use GET or POST.'});}
  const body=typeof req.body==='object'&&req.body?req.body:{};
  const auth=req.headers?.authorization;
  if(body.action!=='ring'||!UUID.test(String(body.call||'')))return res.status(400).json({error:'A call is required.'});
  if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(auth))return res.status(401).json({error:'Sign in again.'});
  try{
    const out=await ring(process.env,auth,String(body.call).toLowerCase(),fetch);
    if(out.unauthorised)return res.status(401).json({error:'Sign in again.'});
    return res.status(200).json(out);
  }catch(e){
    console.error('push ring',e&&e.message);
    return res.status(502).json({error:'Could not send alerts just now.'});
  }
}
module.exports=handler;
module.exports.ring=ring;
module.exports.vapid=vapid;
