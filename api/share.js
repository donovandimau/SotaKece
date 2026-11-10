'use strict';
// Public page for a wall post shared outside the app:  GET /p/<post id>/<token>
// The token is minted by bv_talanoa_share for the member who tapped Share, so a post is readable
// outside the app only once a member chose to send it, and every open and every sign-up through
// that link is counted for that member. The page carries the preview tags WhatsApp, Messenger and
// Facebook read, and one button that opens the post in Sota Kece (members land on the post, new
// people land on sign-up with the link remembered). Only the publishable key is used: the token
// is the capability, and nothing here can read a post that was never shared.
const listen=require('./listen.js');
const SOTA_URL='https://aqfzpaczyodhugsgqvxi.supabase.co';
const SOTA_KEY='sb_publishable_DvpX2PSuPtxE3IqWUlRZfQ_YP2qLZtF';
const SITE='https://sotakece.com';
const OG_IMAGE=SITE+'/assets/og-sota-kece-20261104.jpg';
const POST=/^[0-9]{1,18}$/,TOKEN=/^[a-f0-9]{32}$/;
const esc=listen.esc;

function rich(text){return esc(String(text||'')).replace(/\r?\n/g,'<br>');}
function ago(iso,now=Date.now()){
  const s=(now-new Date(iso).getTime())/1000;
  if(!Number.isFinite(s)||s<60)return 'just now';
  if(s<3600)return Math.floor(s/60)+' min ago';
  if(s<86400)return Math.floor(s/3600)+' h ago';
  if(s<604800)return Math.floor(s/86400)+' d ago';
  return new Date(iso).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
}
function openUrl(card,token){return `${SITE}/?ref=${token}#talanoa=${card.id}`;}
function pageUrl(card,token){return `${SITE}/p/${card.id}/${token}`;}
function postPage(card,token,now=Date.now()){
  const name=String(card.display_name||card.handle||'Someone').trim().slice(0,40),handle=String(card.handle||'').slice(0,20);
  const text=String(card.body||'').trim(),description=text.length>200?text.slice(0,199).trimEnd()+'…':text;
  const sharer=card.sharer&&String(card.sharer.display_name||card.sharer.handle||'').trim().slice(0,40);
  const q=card.quote&&typeof card.quote==='object'?card.quote:null;
  const likes=Number(card.like_count)||0,replies=Number(card.reply_count)||0;
  const meta=[likes?`${likes} ${likes===1?'like':'likes'}`:'',replies?`${replies} ${replies===1?'reply':'replies'}`:''].filter(Boolean).join(' · ');
  return listen.page({title:`${name} on Sota Kece`,description:description||'A post on the Talanoa Wall.',url:pageUrl(card,token),image:OG_IMAGE,
    body:`<style>.post{padding:18px 18px 14px}.who{display:flex;align-items:center;gap:12px;margin-bottom:12px}.av{display:grid;place-items:center;width:44px;height:44px;border-radius:13px;background:${esc(card.accent||'#4FA8D8')}22;font-size:22px;flex:none}.who b{display:block;font-size:16px}.who small{color:var(--soft);font-size:13px}.say{font-size:19px;line-height:1.5;overflow-wrap:anywhere;margin:0}.quote{margin:12px 0 0;padding:10px 12px;border:1px solid var(--line);border-radius:12px;font-size:15px;color:var(--soft)}.quote b{color:var(--ink)}.meta{margin-top:12px;font-size:13px;color:var(--soft)}.by{text-align:center;font-size:14px;color:var(--soft);margin:0}</style>
<article class="card"><div class="post">
<div class="who"><span class="av" aria-hidden="true">${esc(card.avatar_emoji||'🌺')}</span><div><b>${esc(name)}</b><small>@${esc(handle)} · ${esc(ago(card.created_at,now))}</small></div></div>
<p class="say">${rich(text)}</p>
${q?`<div class="quote"><b>${esc(String(q.display_name||q.handle||''))}</b> @${esc(String(q.handle||''))}<br>${rich(String(q.body||''))}</div>`:''}
${meta?`<div class="meta">${esc(meta)}</div>`:''}
</div></article>
<a class="cta" href="${esc(openUrl(card,token))}">Open in Sota Kece ↗</a>
${sharer?`<p class="by">Shared by ${esc(sharer)}. New here? That button makes you a room in a minute.</p>`:''}`});
}

async function readShared(post,token,fetcher=fetch){
  const r=await fetcher(`${SOTA_URL}/rest/v1/rpc/bv_talanoa_shared`,{
    method:'POST',headers:{apikey:SOTA_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_post:Number(post),p_token:token}),signal:AbortSignal.timeout(5000)
  });
  if(!r.ok)throw Error('db');
  const card=await r.json();
  return card&&typeof card==='object'&&card.id?card:null;
}

async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const send=out=>res.status(out.status).send(out.html);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return res.status(405).send('Use GET.');}
  const q=req.query||{},post=String(q.post||''),token=String(q.t||'').toLowerCase();
  // A malformed link, a wrong token and a removed post all answer the same way.
  if(!POST.test(post)||!TOKEN.test(token)){res.setHeader('Cache-Control','no-store');return send(listen.gone('That post is not here.'));}
  try{
    const card=await readShared(post,token,fetch);
    if(!card){res.setHeader('Cache-Control','no-store');return send(listen.gone('That post is not here.'));}
    // Short cache: when the author removes the post the page goes with it within minutes.
    res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
    return send(postPage(card,token));
  }catch(err){
    console.error('share',err?.message);
    res.setHeader('Cache-Control','no-store');
    return res.status(503).send(listen.page({status:503,title:'Sota Kece',description:'Your people. Your music. Your space.',url:SITE+'/',image:OG_IMAGE,
      body:`<article class="card"><div class="words"><h1>That did not load.</h1><p>Try the link again in a minute.</p></div></article><a class="cta" href="${SITE}/">Open Sota Kece ↗</a>`}).html);
  }
}
module.exports=handler;
Object.assign(module.exports,{postPage,readShared,rich,ago,openUrl,pageUrl});
