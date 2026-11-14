(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaPlaylist=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const AUDIO_BASE='https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/fiji-audio/';
function validateCatalog(value){
if(!Array.isArray(value)||!value.length||value.length>500)throw Error('Playlist unavailable.');
const ids=new Set();
return value.map(track=>{
if(!track||typeof track.id!=='string'||!/^[a-z0-9-]{1,80}$/.test(track.id)||ids.has(track.id)||typeof track.title!=='string'||!track.title.trim()||track.title.length>250||typeof track.path!=='string'||!(track.path==='fiji-default-soundtrack.mp3'||/^fiji-(?:remix|song)-\d{2,3}\.mp3$/.test(track.path)))throw Error('Playlist unavailable.');
ids.add(track.id);return {id:track.id,title:track.title.trim(),url:AUDIO_BASE+track.path};
});
}
// Turns a raw upload name ("DJ JORDAN_-_LAUTI AU REMIX #2024") into a clean
// title and a credit line. Display only: ids, paths and search keep the raw name.
const ARTIST_FIRST=/^(?:dj\b|(?:beenie man|brenda fassie|cynthia schloss|daniel rae costello|fiji|j boog|lagani rabukawaqa|maoli|marcia griffiths|master kg|natalie raikadroka|rootstrata|sassy|susan cadogan|ub40|vkm)(?=$|\s+(?:ft\.?|feat\.?|x|&)\s))/i;
const KEEP_CAPS=new Set(['DJ','UB40','VKM','VNT','LC','OG','KG','TNI','FJ','NZ','USA','UK']);
const YEAR=/(?:^|\s)(?:(?:19|20)\d{2}|2k\d{2})(?=\s|$)/gi;
function tidyWords(text){
const words=text.replace(YEAR,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
const shout=words.length>1&&words.every(w=>!/[a-z]/.test(w));
return words.map(w=>{
if(/^dj$/i.test(w))return 'DJ';
if(/^rmx$/i.test(w))return 'Remix';
if(/[a-z]/.test(w)||!/[A-Z]/.test(w)||/\d/.test(w)||KEEP_CAPS.has(w))return w;
if(!shout&&w.length<4)return w;
return w.charAt(0)+w.slice(1).toLowerCase();
}).join(' ').replace(/^[\s\-–·,]+|[\s\-–·,]+$/g,'');
}
function describe(raw){
let text=String(raw??'').replace(/\.(?:mp3|m4a|aac|wav|ogg|flac)$/i,'').replace(/_/g,' ').replace(/#/g,' ');
text=text.replace(/\b(?:[A-Za-z] ){3,}[A-Za-z]\b/g,m=>m.replace(/ /g,''));
text=text.replace(/^\s*\d{1,2}(?:\s*[.)\-]\s*|\s+)(?=[A-Za-z])/,'').replace(/\bpromo\b/gi,' ');
const notes=[];
text=text.replace(/[\[(]([^\])]*)[\])]/g,(_,inner)=>{notes.push(inner);return ' ';});
let parts=text.split(/\s+[-–]\s+|\s+[-–]$|^[-–]\s+/).map(part=>part.trim()).filter(Boolean);
if(!parts.length)parts=[text.trim()];
let title,credit;
if(parts.length>1&&ARTIST_FIRST.test(parts[0])){credit=parts[0];title=parts[1];notes.unshift(...parts.slice(2));}
else{title=parts[0];credit=parts[1]||'';notes.unshift(...parts.slice(2));}
let featured='';
const guest=title.match(/^(.*?)\s+((?:ft|feat)\.?\s+.+)$/i);
if(guest&&guest[1].trim()){title=guest[1];featured=guest[2];}
let version='';
const trailing=/\s+(?:remix|rmx)$/i;
if(trailing.test(tidyWords(title))){title=tidyWords(title).replace(trailing,'');version='Remix';}
title=tidyWords(title);credit=tidyWords([credit,featured].filter(Boolean).join(' '));
if(trailing.test(' '+credit)&&/^(?:remix|rmx)$/i.test(credit)){credit='';version='Remix';}
const lines=[];
for(const note of [credit,...notes]){const clean=tidyWords(note);if(!clean)continue;if(/^(?:remix|rmx)$/i.test(clean)){version='Remix';continue;}if(!lines.some(line=>line.toLowerCase()===clean.toLowerCase()))lines.push(clean);}
if(version&&!lines.some(line=>/remix|rework|mashup|\bmix\b/i.test(line)))lines.push(version);
if(!title){title=lines.shift()||String(raw??'').trim();}
return {title,artist:lines.join(' · ')};
}
function tidy(track){const d=describe(track.title);return {...track,rawTitle:track.title,title:d.title||track.title,artist:d.artist};}
let ext=null,catalogue=[];
const view=()=>ext?.items?.()||catalogue;
let dialog=null,audio=null,tracks=[],current=-1,selectedTrack=null,authoritative=false,loading=null,attempt=0,beforePlay=()=>{},focusBefore=null,inlineHost=null,message='Choose a song to start listening.';
root.SotaPlayback?.register('playlist',pause);
let list,filter,count,status,title,play,previous,next,retry,mood,subtitle;
function el(tag,text,cls){const node=root.document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,action){const node=el('button',text);node.type='button';node.addEventListener('click',action);return node;}
function live(){return !!audio&&!audio.paused&&!audio.ended;}
function homeHost(){return root.document?.querySelector?.('[data-music-playlist-host]')||null;}
function sync(){
const selected=tracks[current]||selectedTrack,playing=live();
root.document.querySelectorAll('[data-playlist-open]').forEach(b=>{
b.setAttribute('aria-expanded',String(!!dialog?.open));b.setAttribute('aria-pressed',String(playing));
if(homeHost())b.removeAttribute('aria-haspopup');else b.setAttribute('aria-haspopup','dialog');
b.title=selected?(playing?'Playing: ':'Paused: ')+selected.title+' · Open music playlist':'Open music playlist';
});
root.document.querySelectorAll('[data-playlist-status]').forEach(s=>s.textContent=selected?(playing?'Playing · ':'Paused · ')+selected.title:'Music playlist · tap to choose a song');
if(!dialog)return;
title.textContent=selected?selected.title:'Your island soundtrack';status.textContent=message;
dialog.classList.toggle('is-playing',playing);
mood.textContent=selected?(playing?'Now playing':'On pause'):'Turn up the island vibes';
subtitle.textContent=selected?(selected.artist||'Track '+(current+1)+' of '+tracks.length+' · Sota Kece'):'Pick a song. Find your rhythm.';
play.textContent='';play.append(el('span',playing?'Ⅱ':'▶','sk-playlist-play-icon'),el('span',playing?'Pause':'Play'));
play.firstChild.setAttribute('aria-hidden','true');play.disabled=previous.disabled=next.disabled=!tracks.length;
list.querySelectorAll('[data-track-index]').forEach(b=>{
const active=!!selected&&b.dataset.trackKey===selected.key;
if(active)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');
});
ext?.sync?.(selected,playing);
}
function pause(){attempt++;if(audio)audio.pause();if(selectedTrack)message='Paused · '+selectedTrack.title;sync();}
async function playTrack(index){
const selected=tracks[index];if(!selected)return;
beforePlay();const request=++attempt;
const url=selected.url||ext?.urlFor?.(selected)||'';
if(current!==index||audio.getAttribute('src')!==url||audio.error){audio.pause();current=index;audio.src=url;}
selectedTrack=selected;
message='Loading · '+selected.title;sync();
root.SotaMusicBadge?.prepare?.(audio);
root.SotaHeroVisualiser?.prepare(audio);
try{await audio.play();if(request!==attempt)return;message='Playing · '+selected.title;sync();}
catch(_){if(request===attempt){message='Could not play this song. Tap Play to retry, or choose another song.';sync();}}
}
function move(delta,auto){if(!tracks.length)return;const t=ext?.next?ext.next(delta,!!auto):current<0?0:(current+delta+tracks.length)%tracks.length;if(t>=0)playTrack(t);}
function playKey(key){const items=view();tracks=items.slice();const i=tracks.findIndex(t=>t.key===key);if(i>=0)playTrack(i);}
function render(){
list.textContent='';const query=filter.value.trim().toLocaleLowerCase();let shown=0;
const items=view();
items.forEach((track,index)=>{
if(query&&!(track.rawTitle||track.title).toLocaleLowerCase().includes(query)&&!(track.title+' '+(track.artist||'')).toLocaleLowerCase().includes(query))return;
shown++;const row=el('li'),pick=button('',()=>playKey(track.key));pick.dataset.trackIndex=String(index);pick.dataset.trackKey=track.key;pick.setAttribute('aria-label','Play '+track.title+(track.artist?', '+track.artist:''));
const number=el('span',String(index+1).padStart(2,'0'),'sk-playlist-number');number.setAttribute('aria-hidden','true');
const name=el('span','','sk-playlist-song-name');name.append(el('strong',track.title,'sk-playlist-song-title'));const credit=track.artist||(String(track.key).startsWith('mix:')?'Island Mix':'');if(credit)name.append(el('small',credit,'sk-playlist-song-artist'));
pick.append(number,name);row.append(pick);ext?.row?.(track,row);list.append(row);
});
if(!shown)list.append(el('li',items.length?'No songs match your search.':ext?.empty?.()||'The playlist could not load.'));
count.textContent=query?shown+' of '+items.length+' songs':items.length+' songs';sync();
}
async function readCatalogue(){
try{
const shared=await import('/shared-music/core.mjs');
const result=await shared.loadCatalogue();
authoritative=true;return result;
}catch(error){
if(authoritative)throw error;
const response=await root.fetch('/music-playlist.json?v=20261026-shared-music',{credentials:'omit',cache:'no-cache'});
if(!response.ok)throw Error('Playlist unavailable.');
return {tracks:validateCatalog(await response.json()),source:'fallback',stale:true};
}
}
async function load(){
if(loading)return loading;
retry.hidden=true;message='Loading playlist…';sync();
loading=(async()=>{
try{
const result=await readCatalogue();
const selectedId=(tracks[current]||selectedTrack)?.id;
catalogue=result.tracks.map(t=>({...tidy(t),key:'mix:'+t.id}));
if(!selectedTrack||selectedTrack.key?.startsWith('mix:')){tracks=catalogue.slice();current=selectedId?tracks.findIndex(track=>track.id===selectedId):-1;if(current>=0)selectedTrack=tracks[current];}
message=result.stale?'Saved playlist · Connection unavailable. Music needs an internet connection.':selectedTrack?(live()?'Playing · ':'Paused · ')+selectedTrack.title:'Choose a song to start listening.';
retry.hidden=!result.stale;render();ext?.loaded?.();
}
catch(_){message=tracks.length?'The shared playlist could not refresh. Your current selection is kept.':'The playlist could not load. Check your connection and try again.';retry.hidden=false;sync();}
finally{loading=null;}
})();
return loading;
}
function create(){
dialog=el('dialog','','sk-playlist');dialog.id='sk-music-playlist';dialog.setAttribute('aria-labelledby','sk-playlist-heading');
const head=el('div','','sk-playlist-head'),brand=el('div'),heading=el('h2','Music playlist');heading.id='sk-playlist-heading';
brand.append(el('span','SOTA KECE · ISLAND MIX','sk-playlist-eyebrow'),heading);
const close=button('×',()=>{if(inlineHost){const host=inlineHost;host.dispatchEvent(new root.CustomEvent('sota-playlist-inline-close',{bubbles:true}));if(inlineHost)hideInline();}else dialog.close();});close.className='sk-playlist-close';close.setAttribute('aria-label','Close music playlist');head.append(brand,close);
const hero=el('div','','sk-playlist-hero'),record=el('div','','sk-playlist-record');record.setAttribute('aria-hidden','true');
record.append(el('span','♫','sk-playlist-record-label'));
const details=el('div','','sk-playlist-details');mood=el('span','Turn up the island vibes','sk-playlist-mood');
title=el('strong','Your island soundtrack','sk-playlist-title');subtitle=el('span','Pick a song. Find your rhythm.','sk-playlist-subtitle');
const bars=el('span','','sk-playlist-bars');bars.setAttribute('aria-hidden','true');for(let i=0;i<5;i++)bars.append(el('i'));
details.append(mood,title,subtitle);hero.append(record,details);
audio=el('audio');audio.id='sota-playlist-audio';audio.crossOrigin='anonymous';audio.controls=true;audio.preload='none';audio.setAttribute('aria-label','Playlist audio');audio.setAttribute('data-sota-playback-source','playlist');
const transport=el('div','','sk-playlist-transport');transport.setAttribute('role','group');transport.setAttribute('aria-label','Playlist playback controls');
previous=button('Previous',()=>move(-1));play=button('Play',()=>live()?pause():playTrack(current<0?0:current));play.className='sk-playlist-play';next=button('Next',()=>move(1));transport.append(previous,play,next);
status=el('p','','sk-playlist-status');status.setAttribute('role','status');retry=button('Retry playlist',load);retry.hidden=true;
const search=el('div','','sk-playlist-search'),label=el('label','Find your next favourite');label.htmlFor='sk-playlist-filter';filter=el('input');filter.id='sk-playlist-filter';filter.type='search';filter.placeholder='Search song or artist';filter.addEventListener('input',render);search.append(label,filter);
count=el('small','Loading playlist…');count.setAttribute('aria-live','polite');list=el('ol','','sk-playlist-songs');list.setAttribute('aria-label','Playlist songs');
const queue=el('div','','sk-playlist-queue');queue.append(el('span','THE PLAYLIST'),count);
const visuals=el('dimau-music-visualiser');visuals.setAttribute('for','sota-playlist-audio');
const extras=el('div','','sk-lib-host');
dialog.append(head,hero,audio,transport,visuals,status,retry,extras,search,queue,list);root.document.body.append(dialog);
const docHead=root.document.head;
if(root.SotaMusicLibrary)extend(root.SotaMusicLibrary);
else if(docHead){const s=el('script');s.src='/music-library.js?v=20261114-oldbrowsers-1';s.async=true;docHead.append(s);}
audio.addEventListener('play',()=>{
root.SotaPlayback?.activate('playlist',audio);
beforePlay();root.document.querySelectorAll('audio').forEach(other=>{if(other!==audio)other.pause();});
message='Playing · '+(selectedTrack?.title||'');sync();
});
audio.addEventListener('pause',()=>{if(selectedTrack)message='Paused · '+selectedTrack.title;sync();});
audio.addEventListener('ended',()=>ext?.ended?ext.ended():move(1,true));
audio.addEventListener('error',()=>{message='This song could not load. Tap Play to retry, or choose another song.';sync();});
dialog.addEventListener('close',()=>{sync();if(dialog.open)return;stopVisuals();if(!inlineHost&&focusBefore?.isConnected)focusBefore.focus({preventScroll:true});focusBefore=null;});
}
// The music add-on (/music-library.js) calls this once loaded: control deck, playlists, My music, sharing.
function extend(addon){
if(!dialog||ext||!addon?.attach)return;
ext=addon.attach({dialog,audio,host:dialog.querySelector('.sk-lib-host'),catalogue:()=>catalogue,tracks:()=>tracks,index:()=>current,selected:()=>tracks[current]||selectedTrack,live,playTrack,playKey,move,select(key){const i=catalogue.findIndex(t=>t.key===key);if(i<0)return;tracks=catalogue.slice();current=i;selectedTrack=tracks[i];render();},pause,load,render,sync,say(text){message=text;sync();},clear(){filter.value='';}})||null;
render();if(catalogue.length)ext?.loaded?.();
}
function stopVisuals(){const visual=dialog?.querySelector('dimau-music-visualiser');visual?.finishRecording?.();visual?.stop?.();}
function relocate(parent){
if(dialog.parentNode===parent)return;
// Modern browsers preserve the audio element's playback and custom-element
// state during a connected move. The fallback still reuses the same nodes.
if(typeof parent.moveBefore==='function'&&dialog.isConnected&&parent.isConnected){
try{parent.moveBefore(dialog,null);return;}catch(_){}
}
parent.append(dialog);
}
function showInline(host){
if(!host||!host.isConnected||typeof host.append!=='function')return null;
if(!dialog)create();
if(inlineHost===host&&dialog.parentNode===host&&dialog.open){sync();return dialog;}
const active=root.document.activeElement;
focusBefore=null;
if(dialog.open)dialog.close();
inlineHost=host;dialog.classList.add('sk-playlist-inline');dialog.querySelector('.sk-playlist-close').setAttribute('aria-label','Back to visualiser');
relocate(host);dialog.show();sync();
if(active&&active!==root.document.body&&active.isConnected)active.focus({preventScroll:true});
dialog.querySelector('dimau-music-visualiser')?.wake?.();
if(!tracks.length)load();
return dialog;
}
function hideInline(){
if(!dialog||!inlineHost)return;
const active=root.document.activeElement;
focusBefore=null;
if(dialog.open)dialog.close();
inlineHost=null;dialog.classList.remove('sk-playlist-inline');dialog.querySelector('.sk-playlist-close').setAttribute('aria-label','Close music playlist');
relocate(root.document.body);stopVisuals();sync();
if(active&&active!==root.document.body&&active.isConnected&&!dialog.contains(active))active.focus({preventScroll:true});
}
function open(){
const host=homeHost();
if(host){
host.dispatchEvent(new root.CustomEvent('sota-playlist-inline-open',{bubbles:true}));
const target=host.isConnected?host:homeHost();
if(target&&showInline(target)){
target.scrollIntoView?.({behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth',block:'start'});
filter.focus({preventScroll:true});
return;
}
}
hideInline();
if(!dialog)create();if(dialog.open)return;
focusBefore=root.document.activeElement;dialog.showModal();dialog.querySelector('button').focus();sync();load();
}
function prepareVisual(){if(!dialog)create();return audio;}
function mount(target,options={}){
beforePlay=options.beforePlay||beforePlay;
target.querySelectorAll('[data-playlist-open]:not([data-playlist-bound])').forEach(b=>{
b.dataset.playlistBound='true';b.setAttribute('aria-haspopup','dialog');b.setAttribute('aria-controls','sk-music-playlist');b.addEventListener('click',open);
});sync();
}
// Shared song / music links open the player; the add-on picks the song.
if(root.location&&/[?&](?:song|music)=/.test(root.location.search||''))root.addEventListener?.('load',()=>root.setTimeout(open,600),{once:true});
if(root.document)root.document.addEventListener('play',event=>{if(event.target.tagName==='AUDIO'&&event.target!==audio)pause();},true);
return {validateCatalog,describe,mount,open,pause,extend,showInline,hideInline,prepareVisual,detachInline:hideInline,isInline:()=>!!inlineHost&&!!dialog?.open&&inlineHost.isConnected};
});

