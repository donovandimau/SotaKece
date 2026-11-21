'use strict';
const {createHmac}=require('node:crypto');
const SOTA_URL='https://xnxmumbvgtmlpenutlii.supabase.co';
const SOTA_KEY='sb_publishable_WFJ3jKwImNhGdTdrS9W6mg_3CUSUYIM';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STUN={urls:['stun:stun.cloudflare.com:3478']};
const ICE_URL=/^(?:stun|turns?):[a-z0-9.-]+(?::(\d{1,5}))?(?:\?transport=(?:udp|tcp))?$/i;

function ttlSeconds(env){
  const requested=Number(env.CALLS_TURN_TTL_SECONDS||900);
  return Number.isFinite(requested)?Math.max(60,Math.min(3600,Math.floor(requested))):900;
}

// Self-hosted relay (coturn "TURN REST" shared secret).
function relayConfig(env,call,user,now=Date.now()){
  const urls=String(env.CALLS_TURN_URLS||'').split(',').map(v=>v.trim()).filter(Boolean);
  const secret=String(env.CALLS_TURN_SECRET||'');
  if(!urls.length&&!secret)return {iceServers:[STUN],relayConfigured:false,expiresAt:null,maxParticipants:6};
  // Reject partial configuration rather than returning unusable credentials.
  if(!urls.length||urls.some(v=>!/^turns?:[a-z0-9.[\]:-]+(?:\?transport=(?:udp|tcp))?$/i.test(v))||Buffer.byteLength(secret)<32||/[\r\n]/.test(secret))throw Error('relay_config');
  const ttl=ttlSeconds(env);
  const expiry=Math.floor(now/1000)+ttl;
  const username=`${expiry}:${call}:${user}`;
  const credential=createHmac('sha1',secret).update(username).digest('base64');
  return {iceServers:[STUN,{urls,username,credential}],relayConfigured:true,expiresAt:new Date(expiry*1000).toISOString(),maxParticipants:6};
}

// Keep only well-formed STUN/TURN entries. Browsers block port 53, so a URL on
// that port would only stall connection set-up.
function cleanIceServers(list){
  const out=[];
  for(const entry of Array.isArray(list)?list:[]){
    const urls=(Array.isArray(entry?.urls)?entry.urls:[entry?.urls]).filter(u=>{
      if(typeof u!=='string')return false;const m=ICE_URL.exec(u);return !!m&&m[1]!=='53';
    });
    if(!urls.length)continue;
    const relay=urls.some(u=>/^turns?:/i.test(u));
    if(relay){
      if(typeof entry.username!=='string'||typeof entry.credential!=='string'||!entry.username||!entry.credential||entry.username.length>512||entry.credential.length>512)continue;
      out.push({urls,username:entry.username,credential:entry.credential});
    }else out.push({urls});
  }
  return out;
}

// Managed relay (Cloudflare Realtime TURN). Needs CF_TURN_KEY_ID and
// CF_TURN_API_TOKEN. Returns null when neither is set.
async function cloudflareRelay(env,now=Date.now(),fetcher=fetch){
  const id=String(env.CF_TURN_KEY_ID||'').trim(),token=String(env.CF_TURN_API_TOKEN||'').trim();
  if(!id&&!token)return null;
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(id)||token.length<20||/\s/.test(token))throw Error('relay_config');
  const ttl=ttlSeconds(env);
  const r=await fetcher(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({ttl}),signal:AbortSignal.timeout(5000)
  });
  if(!r.ok)throw Error('relay_unavailable');
  const data=await r.json();
  const iceServers=cleanIceServers(data?.iceServers);
  if(!iceServers.some(s=>s.urls.some(u=>/^turns?:/i.test(u))))throw Error('relay_unavailable');
  if(!iceServers.some(s=>!s.username))iceServers.unshift(STUN);
  return {iceServers,relayConfigured:true,expiresAt:new Date(now+ttl*1000).toISOString(),maxParticipants:6};
}

async function mediaConfig(env,call,user,now=Date.now(),fetcher=fetch){
  try{
    const managed=await cloudflareRelay(env,now,fetcher);
    if(managed)return managed;
  }catch(_){
    // A relay outage or bad setting must not stop the call: fall back to the
    // self-hosted relay if one is set, otherwise direct connection only.
  }
  return relayConfig(env,call,user,now);
}

async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Use GET.'});}
  const call=typeof req.query?.call==='string'?req.query.call.toLowerCase():'';
  const auth=req.headers?.authorization;
  if(!UUID.test(call))return res.status(400).json({error:'A valid call is required.'});
  if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9_.-]{20,8192}$/.test(auth))return res.status(401).json({error:'Sign in to join this call.'});
  try{
    const headers={apikey:SOTA_KEY,Authorization:auth,'Content-Type':'application/json'};
    const who=await fetch(`${SOTA_URL}/auth/v1/user`,{headers,signal:AbortSignal.timeout(5000)});
    if(!who.ok)return res.status(401).json({error:'Sign in again to join this call.'});
    const user=await who.json();
    if(!UUID.test(user.id||''))return res.status(401).json({error:'Sign in again to join this call.'});
    const snapshot=await fetch(`${SOTA_URL}/rest/v1/rpc/bv_call_snapshot`,{
      method:'POST',headers,body:JSON.stringify({p_call:call}),signal:AbortSignal.timeout(5000)
    });
    if(!snapshot.ok)return res.status(403).json({error:'This call is unavailable to your account.'});
    const state=await snapshot.json();
    if(state?.call?.id!==call||!['ringing','active'].includes(state?.call?.status)||
      !Array.isArray(state?.participants)||!state.participants.some(p=>p.member===user.id&&p.state==='joined'))
      return res.status(403).json({error:'Join this call before requesting media configuration.'});
    return res.status(200).json(await mediaConfig(process.env,call,user.id));
  }catch(err){
    if(err?.message==='relay_config')return res.status(503).json({error:'The call relay needs configuration.'});
    return res.status(503).json({error:'Call configuration is temporarily unavailable.'});
  }
}
module.exports=handler;
module.exports.relayConfig=relayConfig;
module.exports.cloudflareRelay=cloudflareRelay;
module.exports.cleanIceServers=cleanIceServers;
module.exports.mediaConfig=mediaConfig;
