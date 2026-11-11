'use strict';
// Public "tap to play" pages for sharing outside the app (WhatsApp family chats, Facebook groups).
// A link opens a small page that plays straight away, with no account, and carries the preview
// tags the messaging apps read, so the chat shows a picture, a title and a play button.
//   GET /s/<sere id>/<key>   one singing photo. The key is signed on the server and is only ever
//                            handed to the member who made it (see /api/sere action "share"), so
//                            nobody else can turn a member's sere into a public page.
//   GET /t/<track id>        one Island Mix song from music-playlist.json.
// Env: SOTA_SERVICE_KEY (service role, read only here), SERE_SECRET (link signing).
const {createHmac,timingSafeEqual}=require('node:crypto');
const SOTA_URL='https://aqfzpaczyodhugsgqvxi.supabase.co';
const AUDIO_BASE='https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/fiji-audio/';
const SITE='https://sotakece.com';
const OG_IMAGE=SITE+'/assets/og-sota-kece-premium-20261111.jpg';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRACK=/^[a-z0-9-]{1,80}$/;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function shareKey(secret,id){return createHmac('sha256',String(secret)).update('share:'+String(id).toLowerCase()).digest('hex').slice(0,32);}
function sameKey(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&timingSafeEqual(x,y);}
function shareUrl(secret,id){return `${SITE}/s/${String(id).toLowerCase()}/${shareKey(secret,id)}`;}
// Only files we host are ever put in a page: the public sere bucket and the Island Mix bucket.
function ourVideo(url){return typeof url==='string'&&url.startsWith(`${SOTA_URL}/storage/v1/object/public/sere-video/`)&&!/["'<>\s]/.test(url)?url:null;}

let playlist=null;
function tracks(){
  if(!playlist){try{playlist=require('../music-playlist.json');}catch(_){playlist=[];}}
  return Array.isArray(playlist)?playlist:[];
}
function findTrack(id,list){
  const t=(list||tracks()).find(x=>x&&x.id===id);
  return t&&typeof t.title==='string'&&/^[a-z0-9-]{1,80}\.mp3$/.test(String(t.path||''))?{id:t.id,title:t.title.trim().slice(0,250),url:AUDIO_BASE+t.path}:null;
}

function page({title,description,url,image,video,audio,body,status}){
  const tags=[
    ['og:type',video?'video.other':audio?'music.song':'website'],['og:site_name','Sota Kece'],['og:title',title],['og:description',description],
    ['og:url',url],['og:image',image],['og:image:secure_url',image],['og:image:alt',title],
    ...(video?[['og:video',video],['og:video:secure_url',video],['og:video:type','video/mp4']]:[]),
    ...(audio?[['og:audio',audio],['og:audio:secure_url',audio],['og:audio:type','audio/mpeg']]:[])
  ].map(([p,c])=>`<meta property="${p}" content="${esc(c)}">`).join('\n');
  return {status:status||200,html:`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${tags}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">
<link rel="image_src" href="${esc(image)}"><link rel="canonical" href="${esc(url)}">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><meta name="theme-color" content="#4FA8D8">
<link rel="icon" href="/favicon.ico">
<style>
:root{color-scheme:light dark;--bg:#eef7fd;--card:#fff;--ink:#12283a;--soft:#4d6577;--accent:#1f7fb8;--line:#d5e6f1}
@media(prefers-color-scheme:dark){:root{--bg:#0d1b26;--card:#152938;--ink:#eef6fb;--soft:#a9c0cf;--accent:#6cc0ee;--line:#27445a}}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;padding:16px 16px calc(24px + env(safe-area-inset-bottom))}
main{width:100%;max-width:440px;display:flex;flex-direction:column;gap:14px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;color:inherit;text-decoration:none;padding:4px 0}.brand img{width:36px;height:36px;border-radius:10px}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:0 10px 30px #0b2a4014}
video{display:block;width:100%;max-height:70dvh;background:#000}
.art{display:block;width:100%;aspect-ratio:1200/630;object-fit:cover}
.words{padding:14px 16px 16px}h1{font-size:20px;line-height:1.25;margin:0 0 4px;text-wrap:balance}p{margin:0;color:var(--soft)}
audio{display:block;width:100%;margin-top:12px}
.cta{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:14px;background:var(--accent);color:#fff;font-weight:700;text-decoration:none;padding:0 18px}
@media(prefers-color-scheme:dark){.cta{color:#06202f}}
.quiet{text-align:center;font-size:14px;color:var(--soft)}.quiet a{color:inherit}
a:focus-visible,video:focus-visible,audio:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
</style></head><body><main>
<a class="brand" href="${SITE}/"><img src="/icons/sota-icon-192-20261027g.png" alt="" width="36" height="36">Sota Kece</a>
${body}
<p class="quiet">Fiji’s own place for your people, your music and your space. <a href="${SITE}/privacy.html">Privacy</a></p>
</main></body></html>`};
}
function serePage(job,name,url){
  const video=ourVideo(job.output_video_url),poster=ourVideo(job.output_poster_url)||OG_IMAGE;
  const who=name||'A friend',caption=String(job.caption||'').trim().slice(0,140);
  const title=`${who} made a photo sing 🎤`;
  return page({title:`${title} · Sota Kece`,description:caption||'Tap to watch. Made with Sere on Sota Kece.',url,image:poster,video,
    body:`<article class="card"><video controls playsinline preload="metadata" poster="${esc(poster)}" src="${esc(video)}"></video>
<div class="words"><h1>${esc(title)}</h1><p>${esc(caption||'Made with Sere on Sota Kece.')}</p></div></article>
<a class="cta" href="https://sere.sotakece.com/">Make your own photo sing ↗</a>`});
}
function trackPage(track){
  const url=`${SITE}/t/${track.id}`;
  return page({title:`${track.title} · Sota Kece`,description:'Tap to listen. Island music on Sota Kece.',url,image:OG_IMAGE,audio:track.url,
    body:`<article class="card"><img class="art" src="/assets/og-sota-kece-premium-20261111.jpg" alt="" width="1200" height="630">
<div class="words"><h1>${esc(track.title)}</h1><p>From the Island Mix on Sota Kece.</p>
<audio controls preload="none" src="${esc(track.url)}"></audio></div></article>
<a class="cta" href="${SITE}/?song=${encodeURIComponent(track.id)}">Hear the whole Island Mix ↗</a>`});
}
function gone(what){
  return page({status:404,title:'Sota Kece',description:'Your people. Your music. Your space.',url:SITE+'/',image:OG_IMAGE,
    body:`<article class="card"><div class="words"><h1>${esc(what)}</h1><p>It may have been removed by the person who made it.</p></div></article>
<a class="cta" href="${SITE}/">Open Sota Kece ↗</a>`});
}

async function readSere(env,id,fetcher){
  const key=String(env.SOTA_SERVICE_KEY||'');if(!/^[A-Za-z0-9._-]{20,}$/.test(key))throw Error('config');
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  const r=await fetcher(`${SOTA_URL}/rest/v1/bv_sere_media_generations?id=eq.${id}&status=eq.completed&select=id,user_id,caption,output_video_url,output_poster_url`,{headers,signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw Error('db');
  const job=(await r.json())[0];
  if(!job||!ourVideo(job.output_video_url))return null;
  let name='';
  try{
    const p=await fetcher(`${SOTA_URL}/rest/v1/bv_profiles?id=eq.${job.user_id}&select=display_name,handle`,{headers,signal:AbortSignal.timeout(4000)});
    if(p.ok){const row=(await p.json())[0];name=String(row?.display_name||row?.handle||'').trim().split(/\s+/)[0].slice(0,24);}
  }catch(_){}
  return {job,name};
}

async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const send=out=>res.status(out.status).send(out.html);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return res.status(405).send('Use GET.');}
  const q=req.query||{},env=process.env;
  try{
    if(q.track!==undefined){
      const track=TRACK.test(String(q.track))?findTrack(String(q.track)):null;
      if(!track){res.setHeader('Cache-Control','public, max-age=60');return send(gone('That song is not on the Island Mix.'));}
      res.setHeader('Cache-Control','public, max-age=300, s-maxage=86400');
      return send(trackPage(track));
    }
    const id=String(q.sere||'').toLowerCase(),secret=String(env.SERE_SECRET||'');
    // A wrong key and a missing sere answer the same way, so a link cannot be used to probe ids.
    if(!UUID.test(id)||secret.length<16||!sameKey(q.k,shareKey(secret,id))){res.setHeader('Cache-Control','no-store');return send(gone('That singing photo is not here.'));}
    const found=await readSere(env,id,fetch);
    if(!found){res.setHeader('Cache-Control','no-store');return send(gone('That singing photo is not here.'));}
    // Short cache: when the maker removes a sere the page goes with it within minutes.
    res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
    return send(serePage(found.job,found.name,shareUrl(secret,id)));
  }catch(err){
    console.error('listen',err?.message);
    res.setHeader('Cache-Control','no-store');
    return res.status(503).send(page({status:503,title:'Sota Kece',description:'Your people. Your music. Your space.',url:SITE+'/',image:OG_IMAGE,
      body:`<article class="card"><div class="words"><h1>That did not load.</h1><p>Try the link again in a minute.</p></div></article><a class="cta" href="${SITE}/">Open Sota Kece ↗</a>`}).html);
  }
}
module.exports=handler;
Object.assign(module.exports,{shareKey,sameKey,shareUrl,ourVideo,findTrack,serePage,trackPage,gone,readSere,esc,page});
