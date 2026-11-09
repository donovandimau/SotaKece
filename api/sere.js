'use strict';
// Sere (singing photo) — the one server step the browser cannot do itself: hand the uploaded
// photo and sound to the lip-sync model and record the job. Everything else (allowance, the
// pending row, uploads, the wall post) happens in the database or the browser.
//   POST /api/sere  { action:'start', id }  — member only; signs the two inputs, starts the render
//   POST /api/sere  { action:'check', id }  — member only; re-reads a job that looks stuck
// Env: SOTA_SERVICE_KEY (service role), REPLICATE_API_TOKEN, SERE_SECRET (webhook signing),
//      SERE_REPLICATE_MODEL ("owner/name", used when SERE_REPLICATE_VERSION is empty),
//      SERE_REPLICATE_VERSION (version hash), SERE_INPUT_IMAGE (default source_image),
//      SERE_INPUT_AUDIO (default driven_audio), SERE_INPUT_EXTRA (JSON merged into the input),
//      SERE_PUBLIC_URL (default https://sotakece.com)
const {createHmac,timingSafeEqual}=require('node:crypto');
const SOTA_URL='https://aqfzpaczyodhugsgqvxi.supabase.co';
const SOTA_KEY='sb_publishable_DvpX2PSuPtxE3IqWUlRZfQ_YP2qLZtF';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPLICATE='https://api.replicate.com/v1';

function sign(secret,id){return createHmac('sha256',secret).update(String(id)).digest('hex');}
function sameSig(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);}

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
async function getJob(env,id,fetcher){
  const r=await fetcher(`${SOTA_URL}/rest/v1/bv_sere_media_generations?id=eq.${id}&select=*`,{headers:svcHeaders(env),signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw Error('db');
  const rows=await r.json();return rows[0]||null;
}
async function patchJob(env,id,patch,fetcher,where){
  const r=await fetcher(`${SOTA_URL}/rest/v1/bv_sere_media_generations?id=eq.${id}${where||''}`,{
    method:'PATCH',headers:svcHeaders(env,{'Content-Type':'application/json',Prefer:'return=representation'}),
    body:JSON.stringify(patch),signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw Error('db');
  return (await r.json())[0]||null;
}
async function signedUrl(env,bucket,path,fetcher){
  const r=await fetcher(`${SOTA_URL}/storage/v1/object/sign/${bucket}/${path}`,{
    method:'POST',headers:svcHeaders(env,{'Content-Type':'application/json'}),body:JSON.stringify({expiresIn:3600}),signal:AbortSignal.timeout(5000)});
  if(!r.ok)return null;
  const d=await r.json();return d?.signedURL?`${SOTA_URL}/storage/v1${d.signedURL}`:null;
}
async function copyObject(env,bucket,from,to,fetcher){
  const r=await fetcher(`${SOTA_URL}/storage/v1/object/copy`,{
    method:'POST',headers:svcHeaders(env,{'Content-Type':'application/json'}),
    body:JSON.stringify({bucketId:bucket,sourceKey:from,destinationKey:to}),signal:AbortSignal.timeout(10000)});
  return r.ok;
}
function modelInput(env,imageUrl,audioUrl){
  const input={};
  input[env.SERE_INPUT_IMAGE||'source_image']=imageUrl;
  input[env.SERE_INPUT_AUDIO||'driven_audio']=audioUrl;
  let extra={still:true,preprocess:'full',enhancer:'gfpgan'};
  if(env.SERE_INPUT_EXTRA){try{extra=JSON.parse(env.SERE_INPUT_EXTRA);}catch(_){throw Error('config');}}
  return Object.assign(input,extra);
}
async function startRender(env,job,imageUrl,audioUrl,fetcher){
  const token=String(env.REPLICATE_API_TOKEN||''),secret=String(env.SERE_SECRET||'');
  if(token.length<10||secret.length<16)throw Error('config');
  const base=String(env.SERE_PUBLIC_URL||'https://sotakece.com').replace(/\/$/,'');
  const body={input:modelInput(env,imageUrl,audioUrl),webhook:`${base}/api/sere-callback?id=${job.id}&sig=${sign(secret,job.id)}`,webhook_events_filter:['completed']};
  let url=`${REPLICATE}/predictions`;
  if(env.SERE_REPLICATE_VERSION)body.version=String(env.SERE_REPLICATE_VERSION);
  else if(/^[\w.-]+\/[\w.-]+$/.test(env.SERE_REPLICATE_MODEL||''))url=`${REPLICATE}/models/${env.SERE_REPLICATE_MODEL}/predictions`;
  else throw Error('config');
  const r=await fetcher(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('provider');
  const p=await r.json();
  if(!p?.id)throw Error('provider');
  return p.id;
}
async function readRender(env,providerJobId,fetcher){
  const r=await fetcher(`${REPLICATE}/predictions/${encodeURIComponent(providerJobId)}`,{headers:{Authorization:`Bearer ${env.REPLICATE_API_TOKEN||''}`},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('provider');
  return r.json();
}
function outputUrl(p){
  const o=p?.output;
  if(typeof o==='string')return o;
  if(Array.isArray(o)){for(let i=o.length-1;i>=0;i--)if(typeof o[i]==='string')return o[i];}
  if(o&&typeof o==='object'){for(const v of Object.values(o))if(typeof v==='string'&&/^https?:/.test(v))return v;}
  return null;
}

// Pulls the finished video into sere-video next to a poster made from the source photo, then
// marks the row completed (the database writes the wall post). Shared with /api/sere-callback.
async function finish(env,job,prediction,fetcher){
  if(prediction.status==='failed'||prediction.status==='canceled'){
    await patchJob(env,job.id,{status:'failed',error:String(prediction.error||'render failed').slice(0,500)},fetcher,'&status=eq.processing');
    return 'failed';
  }
  if(prediction.status!=='succeeded')return prediction.status||'processing';
  const src=outputUrl(prediction);if(!src)throw Error('provider');
  const base=`${job.user_id}/${job.id}`;
  const video=await fetcher(src,{signal:AbortSignal.timeout(45000)});
  if(!video.ok)throw Error('provider');
  const put=async(path,type,body)=>{
    const r=await fetcher(`${SOTA_URL}/storage/v1/object/sere-video/${path}`,{method:'POST',headers:svcHeaders(env,{'Content-Type':type,'x-upsert':'true','Cache-Control':'public, max-age=31536000, immutable'}),body,signal:AbortSignal.timeout(45000)});
    if(!r.ok)throw Error('storage');
  };
  await put(`${base}/v.mp4`,'video/mp4',Buffer.from(await video.arrayBuffer()));
  const poster=await fetcher(`${SOTA_URL}/storage/v1/object/sere-images/${job.source_image_url}`,{headers:svcHeaders(env),signal:AbortSignal.timeout(15000)});
  if(poster.ok)await put(`${base}/p.jpg`,poster.headers.get('content-type')||'image/jpeg',Buffer.from(await poster.arrayBuffer()));
  const pub=p=>`${SOTA_URL}/storage/v1/object/public/sere-video/${p}`;
  await patchJob(env,job.id,{status:'completed',progress:100,output_video_url:pub(`${base}/v.mp4`),output_poster_url:poster.ok?pub(`${base}/p.jpg`):null},fetcher,'&status=eq.processing');
  // Inputs are no longer needed (the poster is the copy that stays).
  fetcher(`${SOTA_URL}/storage/v1/object/sere-audio`,{method:'DELETE',headers:svcHeaders(env,{'Content-Type':'application/json'}),body:JSON.stringify({prefixes:[job.audio_url]}),signal:AbortSignal.timeout(5000)}).catch(()=>{});
  return 'completed';
}

async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
  const body=typeof req.body==='object'&&req.body?req.body:{};
  const id=String(body.id||'');
  if(!UUID.test(id))return res.status(400).json({error:'A valid sere is required.'});
  try{
    const me=await who(req.headers?.authorization,fetch);
    if(!me)return res.status(401).json({error:'Sign in again.'});
    const env=process.env;
    const job=await getJob(env,id,fetch);
    if(!job||job.user_id!==me)return res.status(404).json({error:'That sere is not yours.'});

    if(body.action==='start'){
      if(job.status!=='pending')return res.status(409).json({error:'Already started.',status:job.status});
      let audioPath=job.audio_url;
      if(job.remix_of&&!audioPath.startsWith(`${me}/`)){
        // Remix: the sound belongs to another member's folder — copy it into this member's.
        const mine=`${me}/${job.id}.wav`;
        if(!(await copyObject(env,'sere-audio',audioPath,mine,fetch)))return res.status(409).json({error:'That sound is no longer available to remix.'});
        audioPath=mine;await patchJob(env,job.id,{audio_url:mine},fetch);
      }
      const [image,audio]=await Promise.all([signedUrl(env,'sere-images',job.source_image_url,fetch),signedUrl(env,'sere-audio',audioPath,fetch)]);
      if(!image||!audio)return res.status(409).json({error:'Upload the photo and the sound first.'});
      const providerJobId=await startRender(env,job,image,audio,fetch);
      await patchJob(env,job.id,{status:'processing',provider:'replicate',provider_job_id:providerJobId,attempts:(job.attempts||0)+1},fetch,'&status=eq.pending');
      return res.status(200).json({ok:true,status:'processing'});
    }

    if(body.action==='check'){
      if(job.status!=='processing'||!job.provider_job_id)return res.status(200).json({ok:true,status:job.status});
      const prediction=await readRender(env,job.provider_job_id,fetch);
      const state=await finish(env,job,prediction,fetch);
      return res.status(200).json({ok:true,status:state});
    }
    return res.status(400).json({error:'Unknown action.'});
  }catch(err){
    const m=err?.message;
    if(m==='config')return res.status(503).json({error:'The sere maker needs its keys set on the server.'});
    if(m==='provider')return res.status(502).json({error:'The render service did not answer. Try again in a minute.'});
    return res.status(503).json({error:'The sere maker is temporarily unavailable.'});
  }
}
module.exports=handler;
module.exports.sign=sign;
module.exports.sameSig=sameSig;
module.exports.outputUrl=outputUrl;
module.exports.modelInput=modelInput;
module.exports.startRender=startRender;
module.exports.readRender=readRender;
module.exports.finish=finish;
module.exports.getJob=getJob;
module.exports.patchJob=patchJob;
