'use strict';
// Replicate calls this when a sere render finishes. The body is never trusted: the id and the
// signature in the address are checked, then the job is re-read from Replicate with our token and
// finished by the same code /api/sere uses for a manual check.
const sere=require('./sere.js');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end();}
  const id=String(req.query?.id||''),sig=String(req.query?.sig||'');
  const secret=String(process.env.SERE_SECRET||'');
  if(!UUID.test(id)||secret.length<16||!sere.sameSig(sig,sere.sign(secret,id)))return res.status(401).end();
  try{
    const job=await sere.getJob(process.env,id,fetch);
    if(!job)return res.status(404).end();
    if(job.status!=='processing'||!job.provider_job_id)return res.status(200).json({ok:true,status:job.status});
    const prediction=await sere.readRender(process.env,job.provider_job_id,fetch);
    const state=await sere.finish(process.env,job,prediction,fetch);
    return res.status(200).json({ok:true,status:state});
  }catch(err){
    // A 5xx makes Replicate retry the webhook; the member's "check" button is the other way back.
    return res.status(503).json({error:'retry'});
  }
}
module.exports=handler;
