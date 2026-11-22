/* Sota Kece — what is playing now, and keeping it playing while the member moves around.
 * One <audio id="sota-now-audio"> lives on <body>, outside #app, so a page change never removes it.
 * - play(): wall songs and other one-off sounds play here, so they keep going on any page.
 * - Handover: an <audio data-now-title> inside a page (a voice note on a post, the room's own music)
 *   plays where it is. If that page is taken away while it is playing, the browser pauses it; the
 *   same sound carries on here from the same second, so nothing drops.
 * - active(): the sound that played most recently, with its title, for the mini-player.
 * Every sound still goes through SotaPlayback, so only one plays at a time. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaNowPlaying=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const ID='sota-now-audio',EVENT='sota-now-playing';
  let audio=null,meta=null,last=null,lastMeta=null;
  const watched=typeof WeakSet==='function'?new WeakSet():null;
  const doc=()=>root.document;

  function clip(v,n){return typeof v==='string'?v.trim().slice(0,n):'';}
  function clean(m){
    m=m||{};
    return {id:clip(m.id,120),title:clip(m.title,120)||'Now playing',credit:clip(m.credit,120),kind:['track','voice','room','sere'].includes(m.kind)?m.kind:'track'};
  }
  function tell(){try{root.dispatchEvent(new root.CustomEvent(EVENT,{detail:state()}));}catch(_){}}
  function own(){
    if(audio&&audio.isConnected)return audio;
    const d=doc();if(!d||!d.body)return null;
    audio=d.getElementById(ID);
    if(!audio){
      audio=d.createElement('audio');audio.id=ID;audio.preload='none';audio.hidden=true;
      audio.setAttribute('data-sota-playback-source','now');audio.setAttribute('aria-hidden','true');
      for(const e of ['play','pause','ended','emptied'])audio.addEventListener(e,tell);
      audio.addEventListener('ended',()=>{if(meta)meta.ended=true;});
    }
    if(!audio.isConnected)d.body.append(audio);
    return audio;
  }
  function metaOf(el){
    if(!el||!el.getAttribute)return null;
    if(el===audio)return meta;
    const title=el.getAttribute('data-now-title');
    return title==null?null:clean({id:el.getAttribute('data-now-id')||'',title,credit:el.getAttribute('data-now-credit')||'',kind:el.getAttribute('data-now-kind')||'track'});
  }
  function source(el){return el&&(el.currentSrc||el.getAttribute?.('src')||'');}

  /** Play a sound here. Pressing the same sound again pauses it, and again resumes it.
   *  Resolves true once playing, false if it could not start, null when this press paused it. */
  function play(src,m){
    const a=own();if(!a||typeof src!=='string'||!src)return Promise.resolve(false);
    const next=clean(m);
    if(meta&&next.id&&meta.id===next.id&&a.getAttribute('src')){
      if(!a.paused&&!a.ended){a.pause();return Promise.resolve(null);}
      return start(a);
    }
    if(m?.analyse===true)a.crossOrigin='anonymous';else a.removeAttribute('crossorigin');
    meta=next;a.src=src;
    return start(a);
  }
  function start(a){
    last=a;lastMeta=meta;
    let p;try{p=a.play();}catch(_){p=null;}
    tell();
    return p&&typeof p.then==='function'?p.then(()=>true,()=>{tell();return false;}):Promise.resolve(true);
  }
  function pause(){if(audio&&!audio.paused)audio.pause();}
  function toggle(){
    const a=active()?.audio;if(!a)return;
    if(a.paused||a.ended){const p=a.play();if(p&&p.catch)p.catch(()=>{});}else a.pause();
  }
  /** Carry a page sound on here when its page went away mid-play. */
  function handover(el){
    const m=metaOf(el),src=source(el);
    if(!m||!src||el.isConnected||el.ended)return false;
    const a=own();if(!a)return false;
    const at=Number.isFinite(el.currentTime)?el.currentTime:0;
    if(el.crossOrigin)a.crossOrigin=el.crossOrigin;else a.removeAttribute('crossorigin');
    meta=m;a.src=src;
    const seek=()=>{try{if(at>0)a.currentTime=at;}catch(_){}};
    if(a.readyState>=1)seek();else a.addEventListener('loadedmetadata',seek,{once:true});
    start(a);
    return true;
  }
  function watch(el){
    if(!el||el===audio||metaOf(el)==null)return;
    if(watched){if(watched.has(el))return;watched.add(el);}
    else{if(el.__sotaNow)return;el.__sotaNow=1;}
    el.addEventListener('pause',()=>{if(!el.isConnected)handover(el);else tell();});
    el.addEventListener('ended',tell);
  }
  /** The sound to show in the mini-player: whatever played most recently and still has a source. */
  function active(){
    if(!last||!source(last))return null;
    if(last!==audio&&!last.isConnected)return null;
    const m=last===audio?meta:lastMeta;
    return m?{audio:last,title:m.title,credit:m.credit,kind:m.kind,id:m.id}:null;
  }
  function state(){const a=active();return a?{id:a.id,title:a.title,credit:a.credit,kind:a.kind,playing:!a.audio.paused&&!a.audio.ended}:null;}
  function isPlaying(id){const s=state();return !!(s&&s.playing&&id&&s.id===id);}

  if(doc())doc().addEventListener('play',e=>{
    const el=e.target;if(!el||el.tagName!=='AUDIO')return;
    if(el===audio){last=audio;lastMeta=meta;tell();return;}
    const m=metaOf(el);
    if(m){watch(el);last=el;lastMeta=m;tell();}
    else if(el.id==='sota-playlist-audio'||el.id==='sota-local-audio'){last=null;lastMeta=null;tell();}
  },true);

  return {play,pause,toggle,active,state,isPlaying,handover,EVENT};
});
