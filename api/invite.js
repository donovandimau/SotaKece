'use strict';
// Public page for an invite link:  GET /i/<token>
// The token is minted by bv_invite_create for the member who made the invite. The page says who sent
// it (never the private label the member gave it), carries the preview tags WhatsApp, Messenger and
// Facebook read, and has one button: sign-up with the invite remembered (index.html rememberReferral),
// so the join is credited to the inviter once the room exists. Only the publishable key is used: the
// token is the capability, and bv_invite_open returns nothing for a token that was never made.
const listen=require('./listen.js');
const SOTA_URL='https://xnxmumbvgtmlpenutlii.supabase.co';
const SOTA_KEY='sb_publishable_WFJ3jKwImNhGdTdrS9W6mg_3CUSUYIM';
const SITE='https://sotakece.com';
const OG_IMAGE=SITE+'/assets/og-sota-kece-premium-20261111.jpg';
const TOKEN=/^[a-f0-9]{32}$/;
const esc=listen.esc;
const ABOUT='A small private social network for actual friends. No algorithm, no ads, no AI content.';

function joinUrl(token){return `${SITE}/?ref=${token}`;}
function pageUrl(token){return `${SITE}/i/${token}`;}
function colour(c){return /^#[0-9a-f]{3,8}$/i.test(String(c||''))?c:'#4FA8D8';}
// Scratch links (20261122210000): the three layers are public files in sota-scratch-links.
const LINK_FILES=SOTA_URL+'/storage/v1/object/public/sota-scratch-links/';
const FILE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(under|cover|over)\.(png|webp|jpg)$/;
const SONG=/^[a-z0-9][a-z0-9-]{0,79}$/;
/** The scratch part of a card, checked, or null. */
function scratchOf(card){
  const x=card&&card.scratch,f=x&&x.files;
  if(!f||!['under','cover','over'].every(k=>FILE.test(String(f[k]||''))))return null;
  if(!SONG.test(String(x.song_id||'')))return null;
  const start=Number(x.song_start);
  return {urls:{under:LINK_FILES+f.under,cover:LINK_FILES+f.cover,over:LINK_FILES+f.over},song_id:x.song_id,
    song_start:Number.isFinite(start)&&start>=0&&start<=3600?Math.round(start):0,caption:String(x.caption||'').slice(0,140)};
}
/** What joining through this link does, in words. */
function joinWords(card){
  const name=String((card&&(card.display_name||card.handle))||'your friend').trim().slice(0,40);
  const k=card&&card.koro&&typeof card.koro==='object'?card.koro:null;
  const koro=k&&k.name?(String(k.emoji||'').slice(0,8)+' '+String(k.name).slice(0,40)).trim():'';
  const n=k&&Number.isFinite(Number(k.members))?Number(k.members):0;
  const parts=[];
  if(koro)parts.push('puts you in '+koro+(n>1?' ('+n+' people already there)':''));
  if(card&&card.befriend)parts.push('makes you friends with '+name);
  return {koro,line:parts.length?'Joining '+parts.join(' and ')+'.':''};
}
function scratchPage(card,token,sx){
  const name=String(card.display_name||card.handle||'A friend').trim().slice(0,40);
  const jw=joinWords(card);
  // the cover is what WhatsApp and Facebook show in the preview: a picture to scratch, the song kept secret
  return listen.page({title:`${name} sent you a song to scratch 🎵`,description:sx.caption||`Scratch it to hear the song, then reply on Sota Kece. ${ABOUT}`,
    url:pageUrl(token),image:sx.urls.cover,
    body:`<style>.sx{position:relative}.sx canvas{display:block;width:100%;aspect-ratio:9/16;max-height:72dvh;object-fit:contain;touch-action:none;cursor:crosshair;background:#0a2540}
.sk-story-hint{position:absolute;left:50%;top:62%;transform:translateX(-50%);margin:0;padding:8px 14px;border-radius:999px;background:#06182bcc;color:#fff;font-size:15px;pointer-events:none;white-space:nowrap}.sk-story-hint[hidden]{display:none}
.sk-story-reveal{display:block;margin:8px auto 10px;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit;cursor:pointer}.sk-story-reveal[hidden]{display:none}
.cta.after{animation:sxpulse 1.6s ease-in-out 3}@keyframes sxpulse{50%{transform:scale(1.04)}}@media(prefers-reduced-motion:reduce){.cta.after{animation:none}}</style>
<article class="card"><div id="sx" class="sx sk-story-media" aria-live="polite">Opening the song story…</div>
<div class="words"><h1>${esc(name)} sent you a song to scratch</h1><p>${sx.caption?esc(sx.caption):'Scratch the picture with your finger to hear it.'}</p></div></article>
${jw.line?`<p class="quiet">${esc(jw.line)}</p>`:''}
<a class="cta" id="sx-join" href="${esc(joinUrl(token))}">${jw.koro?`Join ${esc(jw.koro)} on Sota Kece ↗`:'Reply on Sota Kece ↗'}</a>
<p class="quiet">Join in a minute. Already a member? The button opens the app${jw.koro?' and adds you to the Koro':''}.</p>
<script src="/sota-story-media.js?v=20261122-links-1"></script>
<script>SotaStoryMedia.mountUrls(document.getElementById('sx'),${JSON.stringify(sx.urls).replace(/</g,'\u003c')},${JSON.stringify({song_id:sx.song_id,song_start:sx.song_start})},function(){var j=document.getElementById('sx-join');j.classList.add('after');${jw.koro?'':"j.textContent='Liked it? Reply on Sota Kece ↗';"}});</script>`});
}
function invitePage(card,token){
  const name=String(card.display_name||card.handle||'A friend').trim().slice(0,40),handle=String(card.handle||'').slice(0,20);
  return listen.page({title:`${name} invited you to Sota Kece`,description:`${ABOUT} Be one of the first members.`,url:pageUrl(token),image:OG_IMAGE,
    body:`<style>.inv{padding:18px}.who{display:flex;align-items:center;gap:12px;margin-bottom:14px}.av{display:grid;place-items:center;flex:none;width:52px;height:52px;border-radius:15px;font-size:28px;background:color-mix(in srgb,var(--av) 22%,transparent);border:2px solid var(--av)}
.who small{display:block;color:var(--soft)}.inv h1{font-size:22px}.inv ul{margin:12px 0 0;padding:0 0 0 20px;color:var(--soft)}.inv li{margin:4px 0}.by{text-align:center;font-size:14px;color:var(--soft);margin:0}</style>
<article class="card"><div class="inv">
<div class="who"><span class="av" style="--av:${esc(colour(card.accent))}" aria-hidden="true">${esc(card.avatar_emoji||'🌺')}</span><div><b>${esc(name)}</b>${handle?`<small>@${esc(handle)}</small>`:''}</div></div>
<h1>${esc(name)} wants you on Sota Kece</h1>
<p>${esc(ABOUT)}</p>
<ul><li>Your own room: your music, your look, your people.</li><li>Talanoa with friends, not strangers.</li><li>Light on data, made for Fijians wherever you are.</li></ul>
</div></article>
<a class="cta" href="${esc(joinUrl(token))}">Join Sota Kece ↗</a>
<p class="by">You make your room in a minute. Already a member? The button opens the app.</p>`});
}

async function openInvite(token,fetcher=fetch){
  const r=await fetcher(`${SOTA_URL}/rest/v1/rpc/bv_invite_open`,{
    method:'POST',headers:{apikey:SOTA_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_token:token}),signal:AbortSignal.timeout(5000)
  });
  if(!r.ok)throw Error('db');
  const card=await r.json();
  return card&&typeof card==='object'&&card.handle?card:null;
}

async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  const send=out=>res.status(out.status).send(out.html);
  if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');return res.status(405).send('Use GET.');}
  const token=String((req.query||{}).t||'').toLowerCase();
  // A malformed link and an unknown or removed invite answer the same way.
  if(!TOKEN.test(token)){res.setHeader('Cache-Control','no-store');return send(listen.gone('That invite is not here.'));}
  try{
    const card=await openInvite(token,fetch);
    if(!card){res.setHeader('Cache-Control','no-store');return send(listen.gone('That invite is not here.'));}
    // Not cached at the edge, so every person who opens the invite is counted on it.
    res.setHeader('Cache-Control','private, max-age=60');
    const sx=scratchOf(card);
    return send(sx?scratchPage(card,token,sx):invitePage(card,token));
  }catch(err){
    console.error('invite',err?.message);
    res.setHeader('Cache-Control','no-store');
    return res.status(503).send(listen.page({status:503,title:'Sota Kece',description:'Your people. Your music. Your space.',url:SITE+'/',image:OG_IMAGE,
      body:`<article class="card"><div class="words"><h1>That did not load.</h1><p>Try the link again in a minute.</p></div></article><a class="cta" href="${SITE}/">Open Sota Kece ↗</a>`}).html);
  }
}
module.exports=handler;
Object.assign(module.exports,{invitePage,scratchPage,scratchOf,joinWords,openInvite,joinUrl,pageUrl});
