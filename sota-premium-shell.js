/* Sota Kece search provider for the Dimau Premium Shell (9 November 2026).
   Searches what the app already has: destinations, members (signed in), the skin collection and the music library.
   Nothing is stored; nothing is sent anywhere new (members come from the existing bv_profiles read). */
(function(){
  'use strict';
  function member(){try{return typeof S==='object'&&S&&S.user&&S.me?S:null;}catch(_){return null;}}
  var pages=[
    {label:'Home',hint:'Welcome, today and your people',guest:'#home',member:'pulse',icon:'🏠'},
    {label:'Talanoa wall',hint:'The Talanoa Wall for every member',member:'pulse',icon:'🌊'},
    {label:'Moments',hint:'Photos and notes from your friends',member:'moments',icon:'🐚'},
    {label:'People',hint:'Find your people and send an ask',guest:'#people',member:'friends',icon:'🤝'},
    {label:'Koro',hint:'Circles, Koro and conversations',guest:'#talanoa',member:'crews',icon:'🥥'},
    {label:'Circles',hint:'Your Talanoa Circles',member:'circles',icon:'🪸'},
    {label:'Music',hint:'Your island soundtrack',guest:'#music',member:'music',icon:'🎵'},
    {label:'My space',hint:'Your room, your rules',guest:'#profile',member:'room',icon:'🌺'},
    {label:'Skins',hint:'Fiji-first looks for your room',guest:'#skins',member:'skins',icon:'🎨'},
    {label:'3D connections',hint:'Your people as a map',guest:'#people',member:'connections',icon:'🧭'},
    {label:'Communications',hint:'Chat, boards and calls',href:'/communications.html?app=sota-kece',icon:'📞'}
  ];
  function goTo(p){
    var me=member();
    if(p.href){location.href=p.href;return;}
    if(me&&p.member){if(p.member==='skins'){try{window.BulaSkinStudio&&window.BulaSkinStudio.open(null,'All');}catch(_){}return;}if(typeof go==='function')go(p.member);return;}
    var hash=p.guest||'#home';if(location.hash!==hash)location.hash=hash;else window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  var music=null;
  function library(){
    if(music)return music;
    music=fetch('/music-playlist.json',{credentials:'omit'}).then(function(r){return r.ok?r.json():[];}).then(function(list){return Array.isArray(list)?list:[];}).catch(function(){return [];});
    return music;
  }
  function norm(s){return String(s||'').toLowerCase();}
  function hit(text,q){return norm(text).indexOf(q)>=0;}
  async function people(q,signal){
    var me=member();if(!me||q.length<2||typeof sb==='undefined')return [];
    var handle=q.replace(/^@/,'').replace(/[^a-z0-9_]/g,'');if(!handle)return [];
    var res=await sb.from('bv_profiles').select('id,handle,display_name,avatar_emoji').ilike('handle','%'+handle+'%').neq('id',me.user.id).limit(6).abortSignal?.(signal)||await sb.from('bv_profiles').select('id,handle,display_name,avatar_emoji').ilike('handle','%'+handle+'%').neq('id',me.user.id).limit(6);
    if(res.error||!Array.isArray(res.data))return [];
    return res.data.map(function(p){return {label:p.display_name||p.handle,hint:'@'+p.handle+' · open their room',icon:p.avatar_emoji||'🌺',run:function(){if(typeof openRoom==='function')openRoom(p.handle);}};});
  }
  function skins(q){
    var presets=(window.BulaSkins&&window.BulaSkins.presets)||[];
    return presets.filter(function(s){return hit(s.name,q)||hit(s.category,q)||hit(s.note,q);}).slice(0,6).map(function(s){
      return {label:s.name,hint:(s.category?s.category+' skin':'Skin')+(s.note?' · '+s.note:''),icon:'🎨',run:function(){try{if(window.BulaSkinStudio)window.BulaSkinStudio.open(s.id);else goTo({guest:'#skins',member:'skins'});}catch(_){goTo({guest:'#skins',member:'skins'});}}};
    });
  }
  async function tracks(q){
    if(q.length<2)return [];
    var list=await library();
    return list.filter(function(t){return hit(t.title,q)||hit(t.artist,q);}).slice(0,6).map(function(t){
      return {label:t.title,hint:(t.artist?t.artist+' · ':'')+'Open Music',icon:'🎵',run:function(){goTo({guest:'#music',member:'music'});}};
    });
  }
  async function provider(query,signal){
    var q=norm(query).trim(),me=member();
    var visible=pages.filter(function(p){return p.href||(me?p.member:p.guest);});
    if(!q)return visible.slice(0,6).map(function(p){return {label:p.label,hint:p.hint,icon:p.icon,run:function(){goTo(p);}};});
    var found=visible.filter(function(p){return hit(p.label,q)||hit(p.hint,q);}).map(function(p){return {label:p.label,hint:p.hint,icon:p.icon,run:function(){goTo(p);}};});
    var more=await Promise.all([people(q,signal).catch(function(){return [];}),Promise.resolve(skins(q)),tracks(q).catch(function(){return [];})]);
    return found.concat(more[0],more[1],more[2]).slice(0,18);
  }
  function ready(){if(window.DimauShell){window.DimauShell.search.provider(provider);return true;}return false;}
  if(!ready())document.addEventListener('DOMContentLoaded',ready,{once:true});
})();
