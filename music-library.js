/* Sota Kece music add-on, loaded on demand by music-playlist.js (kept out of the offline shell):
   - control deck: seek bar, shuffle / previous / play / next / repeat, auto-play, share, volume
   - "My music" (songs saved on this device) and the listener's own playlists, kept in this browser
   - shared song links (?song=<id>) and phone lock-screen controls
   Without it (e.g. offline before it was ever loaded) the core player keeps its basic controls. */
(function(root){
'use strict';
const LISTS='sk-music-playlists',VIEW='sk-music-view',PREFS='sk-music-prefs',MAX_LISTS=50,MAX_ITEMS=500,SITE='https://sotakece.com/';
const svg=(d,f)=>'<svg viewBox="0 0 24 24" aria-hidden="true" '+(f?'fill="currentColor">':'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">')+d+'</svg>';
const ICON={play:svg('<path d="M8 5.2v13.6L19 12z"/>',1),pause:svg('<path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z"/>',1),prev:svg('<path d="M5.5 5h2.2v14H5.5zM19.5 5.4v13.2L9 12z"/>',1),next:svg('<path d="M16.3 5h2.2v14h-2.2zM4.5 5.4v13.2L15 12z"/>',1),
shuffle:svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),repeat:svg('<path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3"/>'),
vol:svg('<path fill="currentColor" d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'),mute:svg('<path fill="currentColor" d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>'),
share:svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>')};
let pendingSong='';
// A shared song link (?song=<id>) or music link (?music=1): remember the song, tidy the address bar, open the player.
try{const url=new URL(location.href),song=url.searchParams.get('song');
if(song||url.searchParams.has('music')){if(song&&/^[a-z0-9-]{1,80}$/.test(song))pendingSong=song;url.searchParams.delete('song');url.searchParams.delete('music');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}}catch(_){}
const plus='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const cross='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim().slice(0,60);
function read(key,fallback){try{const v=JSON.parse(root.localStorage.getItem(key)||'null');return v==null?fallback:v;}catch(_){return fallback;}}
function write(key,value){try{root.localStorage.setItem(key,JSON.stringify(value));return true;}catch(_){return false;}}
function readLists(){
const saved=read(LISTS,[]),ids=new Set();if(!Array.isArray(saved))return [];
return saved.filter(l=>l&&typeof l.id==='string'&&/^[a-z0-9]{4,20}$/.test(l.id)&&!ids.has(l.id)&&ids.add(l.id)&&clean(l.name)).slice(0,MAX_LISTS)
.map(l=>({id:l.id,name:clean(l.name),items:Array.from(new Set((Array.isArray(l.items)?l.items:[]).filter(k=>typeof k==='string'&&/^(?:mix|dev):.{1,400}$/.test(k)))).slice(0,MAX_ITEMS)}));
}
function attach(api){
const doc=root.document;
let lists=readLists(),device=[],view=String(read(VIEW,'mix')),menuFor='',form='',pendingAdd='',blobUrl={key:'',url:''};
if(!/^(?:mix|device|pl:[a-z0-9]{4,20})$/.test(view))view='mix';
const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const btn=(text,cls,fn)=>{const n=el('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;};
const own=id=>lists.find(l=>l.id===id)||null;
const byKey=key=>key.startsWith('mix:')?api.catalogue().find(t=>t.key===key):device.find(t=>t.key===key);
const current=()=>view.startsWith('pl:')?own(view.slice(3)):null;
const bar=el('div','','sk-lib'),tools=el('div','','sk-lib-tools'),picker=el('input');
bar.setAttribute('role','group');bar.setAttribute('aria-label','Your music lists');tools.hidden=true;
picker.type='file';picker.multiple=true;picker.hidden=true;picker.accept=root.SotaLocalMusic?.accept||'audio/*';picker.setAttribute('aria-label','Choose songs from this device');
api.host.append(bar,tools,picker);
const prefs={shuffle:false,repeat:'off',autoplay:true,volume:1,muted:false};
try{const p=read(PREFS,{})||{};for(const k in prefs)if(typeof p[k]===typeof prefs[k])prefs[k]=p[k];if(!['off','all','one'].includes(prefs.repeat))prefs.repeat='off';prefs.volume=Math.min(1,Math.max(0,prefs.volume));}catch(_){}
const audio=api.audio,keep=()=>write(PREFS,prefs),label=(n,t)=>{n.title=t;n.setAttribute('aria-label',t);};
const ib=(cls,text,icon,fn)=>{const n=btn('',cls,fn);n.innerHTML=icon;label(n,text);return n;};
const fill=r=>r.style.setProperty('--p',(Number(r.value)/(Number(r.max)||1)*100)+'%');
const clock=t=>{if(!Number.isFinite(t)||t<0)return '0:00';t=Math.floor(t);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
let order=[],seeking=false;
function shuffled(){const n=api.tracks().length,cur=api.index();order=[...Array(n).keys()];for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}const at=order.indexOf(cur);if(at>0){order.splice(at,1);order.unshift(cur);}}
function next(delta,auto){
const n=api.tracks().length,cur=api.index();if(!n)return -1;
if(prefs.shuffle){if(order.length!==n)shuffled();let t=order.indexOf(cur)+delta;if(t>=n){if(auto&&prefs.repeat==='off')return -1;shuffled();if(n>1&&order[0]===cur)order.push(order.shift());t=0;}return order[t<0?n-1:t];}
let t=cur<0?0:cur+delta;if(t>=n){if(auto&&prefs.repeat==='off')return -1;t=0;}return t<0?n-1:t;
}
function ended(){
const s=api.selected();
if(prefs.repeat==='one'&&s){audio.currentTime=0;return api.playTrack(api.index());}
if(!prefs.autoplay)return api.say('Finished · '+(s?.title||'')+'. Auto-play is off — tap Next for another song.');
const t=next(1,true);if(t<0)return api.say('End of the list. Turn on Repeat to keep the music going.');
api.playTrack(t);
}
function start(){
if(api.live())return api.pause();
if(api.selected()&&api.index()>=0)return api.playTrack(api.index());
const items=(view==='mix'?null:current()?.items.map(byKey).filter(Boolean))||(view==='device'?device:api.catalogue());
if(!items.length)return api.say('This list is empty. Add songs to it first.');
api.playKey(items[prefs.shuffle?Math.floor(Math.random()*items.length):0].key);
}
function back(){if(audio.currentTime>3&&api.index()>=0){audio.currentTime=0;if(!api.live())api.playTrack(api.index());return;}api.move(-1);}
function shareSong(){
const s=api.selected(),mix=s?.key?.startsWith('mix:');
const data=s?{title:s.title+' · Sota Kece',text:(mix?'Listen to ':'Listening to ')+s.title+' on Sota Kece 🎶',url:mix?SITE+'?song='+encodeURIComponent(s.id):SITE}:{title:'Sota Kece · Island Mix',text:'Island music on Sota Kece 🎶',url:SITE+'?music=1'};
if(root.SotaShare)root.SotaShare.share(data);else navigator.share?.(data).catch(()=>{});
}
const deck=el('div','','sk-deck');deck.setAttribute('role','group');deck.setAttribute('aria-label','Music controls');
const time=el('div','','sk-deck-seek'),elapsed=el('span','0:00','sk-deck-time'),total=el('span','0:00','sk-deck-time'),seek=el('input');
Object.assign(seek,{type:'range',min:'0',max:'1000',step:'1',value:'0',disabled:true,className:'sk-deck-range'});seek.setAttribute('aria-label','Song position');
seek.addEventListener('input',()=>{seeking=true;tick();});
seek.addEventListener('change',()=>{const d=audio.duration;if(Number.isFinite(d))audio.currentTime=Number(seek.value)/1000*d;seeking=false;tick();});
time.append(elapsed,seek,total);
const main=el('div','','sk-deck-main');
const shuffleBtn=ib('sk-deck-mode','Shuffle',ICON.shuffle,()=>{prefs.shuffle=!prefs.shuffle;if(prefs.shuffle)shuffled();keep();api.say(prefs.shuffle?'Shuffle on · songs play in a random order.':'Shuffle off · songs play in list order.');});
const playBtn=ib('sk-deck-play','Play',ICON.play,start);
const repeatBtn=ib('sk-deck-mode sk-deck-repeat','Repeat',ICON.repeat,()=>{prefs.repeat={off:'all',all:'one',one:'off'}[prefs.repeat];keep();api.say(prefs.repeat==='one'?'Repeat on · this song plays again.':prefs.repeat==='all'?'Repeat on · the list starts again at the end.':'Repeat off.');});
main.append(ib('sk-deck-skip','Previous song',ICON.prev,back),playBtn,ib('sk-deck-skip','Next song',ICON.next,()=>api.move(1)));
const extra=el('div','','sk-deck-extra'),sw=el('label','','sk-deck-switch'),auto=el('input');auto.type='checkbox';auto.setAttribute('role','switch');
auto.addEventListener('change',()=>{prefs.autoplay=auto.checked;keep();api.say(prefs.autoplay?'Auto-play on · the next song starts by itself.':'Auto-play off · music stops after each song.');});
sw.append(auto,el('span','','sk-deck-knob'),el('span','Auto-play'));
const sound=el('div','','sk-deck-volume'),vol=el('input');
const mute=ib('sk-deck-mute','Mute',ICON.vol,()=>{if(prefs.muted||!prefs.volume){prefs.muted=false;if(!prefs.volume)prefs.volume=.6;}else prefs.muted=true;keep();loud();modes();});
Object.assign(vol,{type:'range',min:'0',max:'100',step:'1',className:'sk-deck-range'});vol.setAttribute('aria-label','Volume');
vol.addEventListener('input',()=>{prefs.volume=Number(vol.value)/100;prefs.muted=!prefs.volume;keep();loud();modes();});
sound.append(mute,vol);
const options=el('div','','sk-deck-options');options.append(shuffleBtn,repeatBtn,sw);
const share=ib('sk-deck-share','Share this song',ICON.share,shareSong);share.append(el('span','Share music'));
extra.append(sound,share);deck.append(time,main,options,extra);
function loud(){audio.volume=prefs.volume;audio.muted=prefs.muted;}
function modes(){
shuffleBtn.setAttribute('aria-pressed',String(prefs.shuffle));label(shuffleBtn,prefs.shuffle?'Shuffle on':'Shuffle off');
repeatBtn.dataset.repeat=prefs.repeat;repeatBtn.setAttribute('aria-pressed',String(prefs.repeat!=='off'));label(repeatBtn,prefs.repeat==='one'?'Repeat this song':prefs.repeat==='all'?'Repeat playlist':'Repeat off');
auto.checked=prefs.autoplay;vol.value=String(Math.round((prefs.muted?0:prefs.volume)*100));fill(vol);
const quiet=prefs.muted||!prefs.volume;mute.innerHTML=quiet?ICON.mute:ICON.vol;label(mute,quiet?'Unmute':'Mute');
}
function tick(){
const d=Number.isFinite(audio.duration)?audio.duration:0;
if(!seeking)seek.value=d?String(Math.round(audio.currentTime/d*1000)):'0';
fill(seek);seek.disabled=!d;elapsed.textContent=clock(seeking&&d?Number(seek.value)/1000*d:audio.currentTime);total.textContent=clock(d);
seek.setAttribute('aria-valuetext',elapsed.textContent+' of '+total.textContent);
}
for(const e of ['timeupdate','loadedmetadata','durationchange'])audio.addEventListener(e,tick);
// The deck replaces the basic controls and the browser's own audio bar.
api.dialog.querySelector('.sk-playlist-transport')?.setAttribute('hidden','');
audio.controls=false;audio.hidden=true;
api.dialog.querySelector('.sk-playlist-hero').after(deck);
if(!doc.querySelector('link[data-sk-deck]')){const l=el('link');l.rel='stylesheet';l.href='/music-controls.css?v=20261110-music-tidy-1';l.dataset.skDeck='1';doc.head.append(l);}
const session=navigator.mediaSession,set=(a,h)=>{try{session.setActionHandler(a,h);}catch(_){}};
if(session){set('play',()=>{if(!api.live())start();});set('pause',api.pause);set('previoustrack',back);set('nexttrack',()=>api.move(1));set('seekto',d=>{if(Number.isFinite(d?.seekTime))audio.currentTime=d.seekTime;});}
loud();modes();tick();
function setView(next){if(next.startsWith('pl:')&&!own(next.slice(3)))next='mix';view=next;write(VIEW,view);menuFor='';form='';api.clear();draw();api.render();}
function save(){if(!write(LISTS,lists)){api.say('This browser could not save playlists. Check it is not in private mode.');return false;}return true;}
function make(name,first){
name=clean(name);if(!name)return null;
if(lists.length>=MAX_LISTS){api.say('You have 50 playlists. Delete one to make another.');return null;}
const list={id:Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4),name,items:first?[first]:[]};lists.push(list);
if(!save()){lists.pop();return null;}return list;
}
function toggle(list,key){
const at=list.items.indexOf(key);
if(at>=0){list.items.splice(at,1);api.say('Removed from '+list.name+'.');}
else if(list.items.length>=MAX_ITEMS){api.say(list.name+' is full (500 songs).');return;}
else{list.items.push(key);api.say('Added to '+list.name+'.');}
save();
}
async function loadDevice(){
const store=root.SotaLocalMusic?.createStore?.();if(!store)return;
try{device=(await store.list()).map(r=>{const raw=r.title||r.fileName||'Saved song',d=root.SotaPlaylist?.describe?.(raw)||{title:raw,artist:''};return {key:'dev:'+r.id,id:r.id,title:d.title||raw,artist:d.artist,rawTitle:raw,blob:r.blob};});}catch(_){device=[];}
draw();api.render();
}
picker.addEventListener('change',async()=>{
const files=Array.from(picker.files||[]);picker.value='';if(!files.length)return;
if(!root.SotaLocalMusic?.importFiles)return api.say('This browser cannot save songs on the device.');
api.say('Saving songs on this device…');
try{const r=await root.SotaLocalMusic.importFiles(files);await loadDevice();api.say((r.saved.length?r.saved.length+' song'+(r.saved.length===1?'':'s')+' added to My music.':'No songs were added.')+(r.rejected.length?' '+r.rejected.slice(0,2).map(x=>x.fileName+': '+x.reason).join(' '):''));}
catch(e){api.say(e.message||'Songs could not be saved. Check available device storage.');}
});
function chip(text,key,n){const c=btn('','sk-lib-chip',()=>setView(key));c.append(el('span',text),el('small',String(n)));c.setAttribute('aria-pressed',String(view===key));return c;}
function draw(){
bar.replaceChildren(chip('Island Mix','mix',api.catalogue().length),chip('My music','device',device.length),...lists.map(l=>chip(l.name,'pl:'+l.id,l.items.filter(byKey).length)));
const add=btn('','sk-lib-chip sk-lib-new',()=>{form=form==='new'?'':'new';pendingAdd='';draw();});add.innerHTML=plus;add.append(el('span','New playlist'));add.setAttribute('aria-expanded',String(form==='new'));bar.append(add);
tools.replaceChildren();const list=current();
if(form){
const editing=form==='rename'?list:null,f=el('form','','sk-lib-form'),input=el('input');
Object.assign(input,{type:'text',maxLength:60,required:true,placeholder:'Playlist name, e.g. Kava night',value:editing?.name||''});input.setAttribute('aria-label','Playlist name');
const ok=el('button',editing?'Save name':'Create','sk-lib-action sk-lib-primary');ok.type='submit';
f.append(input,ok,btn('Cancel','sk-lib-action',()=>{form='';pendingAdd='';draw();}));
f.addEventListener('submit',e=>{
e.preventDefault();const name=clean(input.value);if(!name)return input.focus();
if(editing){editing.name=name;save();api.say('Renamed to '+name+'.');form='';draw();return api.render();}
const made=make(name,pendingAdd);if(!made)return;
api.say(pendingAdd?'Made '+name+' and added the song.':'Made '+name+'. Tap + on any song to add it.');
form='';pendingAdd='';setView('pl:'+made.id);
});
tools.append(f);root.setTimeout(()=>input.focus(),0);
}
else if(view==='device'){
const pick=btn('','sk-lib-action sk-lib-primary',()=>picker.click());pick.innerHTML=plus;pick.append(el('span','Add songs from this device'));
tools.append(pick,el('small','Songs stay on this phone or computer. They are not uploaded.','sk-lib-note'));
}
else if(list){
tools.append(btn('Rename','sk-lib-action',()=>{form='rename';draw();}),btn('Delete playlist','sk-lib-action sk-lib-danger',()=>{
if(!root.confirm('Delete the playlist "'+list.name+'"? The songs themselves are kept.'))return;
lists=lists.filter(l=>l!==list);save();api.say('Deleted '+list.name+'.');setView('mix');
}));
}
tools.hidden=!tools.childNodes.length;
const q=api.dialog.querySelector('.sk-playlist-queue span');if(q)q.textContent=(view==='device'?'My music':current()?.name||'Island Mix').toUpperCase();
}
function row(track,li){
li.classList.add('sk-song-row');
const add=btn('','sk-song-act',()=>{menuFor=menuFor===track.key?'':track.key;api.render();});add.innerHTML=plus;
add.setAttribute('aria-label','Add '+track.title+' to a playlist');add.title='Add to playlist';add.setAttribute('aria-expanded',String(menuFor===track.key));li.append(add);
const list=current();
if(list){const drop=btn('','sk-song-act sk-song-remove',()=>{toggle(list,track.key);draw();api.render();});drop.innerHTML=cross;drop.setAttribute('aria-label','Remove '+track.title+' from '+list.name);drop.title='Remove from this playlist';li.append(drop);}
if(menuFor!==track.key)return;
const menu=el('div','','sk-pl-menu');menu.setAttribute('role','group');menu.setAttribute('aria-label','Add '+track.title+' to a playlist');
menu.append(el('span','Add to playlist','sk-pl-menu-title'));
for(const l of lists){const inside=l.items.includes(track.key),o=btn('','sk-pl-option',()=>{toggle(l,track.key);menuFor='';draw();api.render();});o.setAttribute('aria-pressed',String(inside));o.append(el('span',inside?'✓':'+','sk-pl-mark'),el('span',l.name));menu.append(o);}
const fresh=btn('','sk-pl-option sk-pl-fresh',()=>{menuFor='';form='new';pendingAdd=track.key;draw();api.render();});fresh.append(el('span','+','sk-pl-mark'),el('span','New playlist…'));menu.append(fresh);
li.append(menu);
}
root.addEventListener('sota-music-change',loadDevice);
draw();loadDevice();
return {
next,ended,
sync(s,playing){modes();playBtn.innerHTML=playing?ICON.pause:ICON.play;label(playBtn,playing?'Pause':'Play');tick();
if(session&&s)try{if(root.MediaMetadata&&session.metadata?.title!==s.title)session.metadata=new MediaMetadata({title:s.title,artist:s.artist||'Sota Kece'});session.playbackState=playing?'playing':'paused';}catch(_){}},
loaded(){draw();if(!pendingSong)return;const t=api.catalogue().find(x=>x.id===pendingSong);pendingSong='';if(t&&!api.live()){setView('mix');api.select(t.key);api.say('Shared with you · '+t.title+'. Tap Play to listen.');}},
items:()=>view==='device'?device:view.startsWith('pl:')?(current()?.items||[]).map(byKey).filter(Boolean):null,
name:()=>view==='device'?'My music':current()?.name||'Island Mix',
empty:()=>view==='device'?'No songs saved on this device yet. Tap “Add songs from this device”.':view.startsWith('pl:')?'This playlist is empty. Go to Island Mix or My music and tap + on a song.':'',
urlFor(track){if(!track.blob)return '';if(blobUrl.key!==track.key){if(blobUrl.url)root.URL.revokeObjectURL(blobUrl.url);blobUrl={key:track.key,url:root.URL.createObjectURL(track.blob)};}return blobUrl.url;},
row
};
}
root.SotaMusicLibrary={attach,readLists};
root.SotaPlaylist?.extend?.(root.SotaMusicLibrary);
})(window);
