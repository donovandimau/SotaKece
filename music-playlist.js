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
let list,filter,count,status,title,play,previous,next,retry,mood,subtitle,upNext;
const played=[];
function el(tag,text,cls){const node=root.document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,action,cls){const node=el('button',text,cls);node.type='button';node.addEventListener('click',action);return node;}

function createUpNext({el,button,available,changed}) {
  let scheduled=null,edited=false,painted='';
  const key=track=>track.key||track.id;
  const items=()=>scheduled??available();
  const box=el('section',undefined,'up-next');
  const heading=el('h3',undefined,'up-next-heading');
  const toggle=button('',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));refresh();},'up-next-toggle');
  const preview=el('span',undefined,'up-next-preview');
  toggle.append(el('span','Up Next'),preview);
  heading.append(toggle);
  const panel=el('div',undefined,'up-next-panel');
  const list=el('ol',undefined,'up-next-list');
  list.setAttribute('aria-label','Upcoming songs');
  const empty=el('p','No songs are queued. Use Play Next on a song to add it.','up-next-empty');
  const announcement=el('span',undefined,'up-next-announcement');
  announcement.setAttribute('role','status');
  panel.id='music-up-next';
  panel.hidden=true;
  toggle.setAttribute('aria-controls',panel.id);
  toggle.setAttribute('aria-expanded','false');
  panel.append(list,empty);
  box.append(heading,panel,announcement);

  function refresh() {
    const songs=items();
    preview.textContent=songs.length?'· '+songs[0].title:'· Empty';
    if(panel.hidden)return;
    const signature=JSON.stringify(songs.map(track=>[key(track),track.title]));
    if(signature===painted)return;
    painted=signature;
    empty.hidden=!!songs.length;
    list.hidden=!songs.length;
    list.textContent='';
    list.append(...songs.map((track,index)=>{
      const row=el('li',undefined,'up-next-track');
      row.dataset.queueTrack=key(track);
      row.append(el('span',track.title,'up-next-song'));
      const actions=el('div',undefined,'up-next-actions');
      const reorder=(label,mark,delta)=>{
        const control=button(mark,()=>move(track,delta),'up-next-move');
        control.dataset.direction=String(delta);
        control.setAttribute('aria-label','Move '+track.title+' '+label);
        control.title='Move '+label;
        control.disabled=index+delta<0||index+delta>=songs.length;
        return control;
      };
      actions.append(reorder('up','↑',-1),reorder('down','↓',1));
      row.append(actions);
      return row;
    }));
  }
  function move(track,delta) {
    const order=[...items()];
    const index=order.findIndex(song=>key(song)===key(track));
    const destination=index+delta;
    if(index<0||destination<0||destination>=order.length)return;
    [order[index],order[destination]]=[order[destination],order[index]];
    scheduled=order;
    edited=true;
    announcement.textContent=track.title+' moved to position '+(destination+1)+'.';
    changed();
    const row=list.children[destination];
    const controls=[...row.querySelectorAll('button')];
    const target=controls.find(control=>control.dataset.direction===String(delta)&&!control.disabled)||controls.find(control=>!control.disabled);
    target?.focus();
  }
  function promote(track) {
    scheduled=[track,...items().filter(song=>key(song)!==key(track))];
    edited=true;
    announcement.textContent=track.title+' will play next.';
    changed();
  }

  return {
    box,refresh,items,
    edited:()=>edited,
    reset(order=null){scheduled=order;edited=false;},
    take(){scheduled=[...items()];return scheduled.shift();},
    restore(track){scheduled=[track,...items().filter(song=>key(song)!==key(track))];},
    remove(track){scheduled=items().filter(song=>key(song)!==key(track));},
    promote,
    action(track){
      const control=button('Play Next',()=>promote(track),'up-next-add');
      control.setAttribute('aria-label','Play Next: '+track.title);
      return control;
    }
  };
}

function upcomingOrder(tracks, selected, shuffle, wraps) {
  const key=track=>track?.key||track?.id;
  const index=tracks.findIndex(track=>key(track)===key(selected));
  if(shuffle&&index>=0){
    const shuffled=tracks.filter((_,i)=>i!==index);
    for(let i=shuffled.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
    }
    return shuffled;
  }
  if(wraps&&index>=0)return tracks.slice(index+1).concat(tracks.slice(0,index));
  return tracks.slice(index+1);
}

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
play.firstChild.setAttribute('aria-hidden','true');play.disabled=previous.disabled=next.disabled=!tracks.length&&!upNext.items().length;
upNext.refresh();
list.querySelectorAll('[data-track-index]').forEach(b=>{
const active=!!selected&&b.dataset.trackKey===selected.key;
if(active)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');
});
ext?.sync?.(selected,playing);
}
function pause(){attempt++;if(audio)audio.pause();if(selectedTrack)message='Paused · '+selectedTrack.title;sync();}
async function playTrack(index,remember=true){
const selected=tracks[index];if(!selected)return;
if(!selectedTrack&&!upNext.edited())resetOrder(selected);
beforePlay();const request=++attempt;
const url=selected.url||ext?.urlFor?.(selected)||'';
if(current!==index||audio.getAttribute('src')!==url||audio.error){audio.pause();current=index;audio.src=url;}
if(selectedTrack&&selectedTrack.key!==selected.key&&remember){played.push(selectedTrack);if(played.length>200)played.shift();}
selectedTrack=selected;
message='Loading · '+selected.title;sync();
root.SotaMusicBadge?.prepare?.(audio);
root.SotaHeroVisualiser?.prepare(audio);
try{await audio.play();if(request!==attempt)return;message='Playing · '+selected.title;sync();}
catch(_){if(request===attempt){message='Could not play this song. Tap Play to retry, or choose another song.';sync();}}
}
const settings=()=>ext?.queueModes?.()||{shuffle:false,repeat:'all'};
function resetOrder(track=selectedTrack){
  const {shuffle,repeat}=settings();
  upNext.reset(track?upcomingOrder(tracks,track,shuffle,repeat==='all'):null);
}
function playQueued(track,remember=true){
  let index=tracks.findIndex(item=>item.key===track.key);
  if(index<0){index=tracks.length;tracks=tracks.concat(track);}
  if(track.key===selectedTrack?.key)audio.currentTime=0;
  return playTrack(index,remember);
}
function move(delta,auto=false){
  if(delta<0&&played.length){
    const last=played.pop();
    if(selectedTrack)upNext.restore(selectedTrack);
    return playQueued(last,false);
  }
  if(delta>0){
    let track=upNext.take();
    if(!track&&settings().repeat==='all'&&tracks.length){
      resetOrder();
      track=upNext.take()||tracks[0];
    }
    if(track)return playQueued(track);
    if(auto){message='End of the list. Turn on Repeat to keep the music going.';sync();return;}
  }
  if(!tracks.length)return;
  const index=ext?.next?ext.next(delta,auto):current<0?0:(current+delta+tracks.length)%tracks.length;
  if(index>=0){resetOrder(tracks[index]);return playTrack(index);}
}
function playKey(key){
  const items=view(),index=items.findIndex(track=>track.key===key);
  if(index<0)return;
  tracks=items.slice();
  played.length=0;
  if(upNext.edited())upNext.remove(tracks[index]);else resetOrder(tracks[index]);
  return playTrack(index,false);
}
function render(){
list.textContent='';const query=filter.value.trim().toLocaleLowerCase();let shown=0;
const items=view();
items.forEach((track,index)=>{
if(query&&!(track.rawTitle||track.title).toLocaleLowerCase().includes(query)&&!(track.title+' '+(track.artist||'')).toLocaleLowerCase().includes(query))return;
shown++;const row=el('li'),pick=button('',()=>playKey(track.key));pick.dataset.trackIndex=String(index);pick.dataset.trackKey=track.key;pick.setAttribute('aria-label','Play '+track.title+(track.artist?', '+track.artist:''));
const number=el('span',String(index+1).padStart(2,'0'),'sk-playlist-number');number.setAttribute('aria-hidden','true');
const name=el('span','','sk-playlist-song-name');name.append(el('strong',track.title,'sk-playlist-song-title'));const credit=track.artist||(String(track.key).startsWith('mix:')?'Island Mix':'');if(credit)name.append(el('small',credit,'sk-playlist-song-artist'));
pick.append(number,name);row.classList.add('sk-song-row');row.append(pick,upNext.action(track));ext?.row?.(track,row);list.append(row);
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
catalogue=result.tracks.map(t=>({...tidy(t),key:'mix:'+t.id}));
if(!selectedTrack)tracks=catalogue.slice();
else{
  const fresh=new Map(catalogue.map(track=>[track.key,track]));
  tracks=tracks.map(track=>fresh.get(track.key)||track);
  selectedTrack=tracks[current]||selectedTrack;
}
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
previous=button('Previous',()=>move(-1));play=button('Play',()=>live()?pause():current<0&&upNext.edited()?move(1):playTrack(current<0?0:current));play.className='sk-playlist-play';next=button('Next',()=>move(1));transport.append(previous,play,next);
status=el('p','','sk-playlist-status');status.setAttribute('role','status');retry=button('Retry playlist',load);retry.hidden=true;
const search=el('div','','sk-playlist-search'),label=el('label','Find your next favourite');label.htmlFor='sk-playlist-filter';filter=el('input');filter.id='sk-playlist-filter';filter.type='search';filter.placeholder='Search song or artist';filter.addEventListener('input',render);search.append(label,filter);
count=el('small','Loading playlist…');count.setAttribute('aria-live','polite');list=el('ol','','sk-playlist-songs');list.setAttribute('aria-label','Playlist songs');
const queue=el('div','','sk-playlist-queue');queue.append(el('span','THE PLAYLIST'),count);
const visuals=el('dimau-music-visualiser');visuals.setAttribute('for','sota-playlist-audio');
const extras=el('div','','sk-lib-host');
upNext=createUpNext({el,button,available:view,changed:sync});
dialog.append(head,hero,audio,transport,upNext.box,visuals,status,retry,extras,search,queue,list);root.document.body.append(dialog);
const docHead=root.document.head;
if(root.SotaMusicLibrary)extend(root.SotaMusicLibrary);
else if(docHead){const s=el('script');s.src='/music-library.js?v=20261122-phone1';s.async=true;docHead.append(s);}
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
ext=addon.attach({dialog,audio,host:dialog.querySelector('.sk-lib-host'),catalogue:()=>catalogue,tracks:()=>tracks,index:()=>current,selected:()=>tracks[current]||selectedTrack,live,playTrack,playKey,move,queueEdited:upNext.edited,upcoming:upNext.items,resetOrder(){if(!upNext.edited())resetOrder();},playUpcoming(track){upNext.remove(track);return playQueued(track);},select(key){const i=catalogue.findIndex(t=>t.key===key);if(i<0)return;tracks=catalogue.slice();current=i;selectedTrack=tracks[i];if(!upNext.edited())resetOrder();render();},pause,load,render,sync,say(text){message=text;sync();},clear(){filter.value='';}})||null;
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

