(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaLocalMusic=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const limit=250*1024*1024,accept='.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.opus';
  const formats={mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',oga:'audio/ogg',flac:'audio/flac',opus:'audio/ogg'};
  async function inspect(file){
    if(!file||!file.size)throw Error('Choose a music file that is not empty.');
    if(file.size>limit)throw Error('Choose music up to 250 MB per file.');
    const extension=String(file.name||'').split('.').pop().toLowerCase();
    if(!formats[extension])throw Error('Use MP3, M4A, AAC, WAV, OGG, FLAC or Opus music.');
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer()),text=String.fromCharCode(...bytes);
    const mpeg=bytes[0]===255&&(bytes[1]&224)===224,ogg=text.startsWith('OggS');
    const valid={mp3:text.startsWith('ID3')||mpeg,m4a:text.slice(4,8)==='ftyp',aac:bytes[0]===255&&(bytes[1]&246)===240,wav:text.startsWith('RIFF')&&text.slice(8,12)==='WAVE',ogg,oga:ogg,opus:ogg,flac:text.startsWith('fLaC')};
    if(!valid[extension])throw Error('The file content does not match its music format.');
    return {extension,type:formats[extension]};
  }
  function createStore(idb=root.indexedDB){
    function open(){return new Promise((resolve,reject)=>{
      if(!idb){reject(Error('This browser cannot save music on the device.'));return;}
      const request=idb.open('sota-kece-saved-music',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('tracks'))request.result.createObjectStore('tracks',{keyPath:'id'});};
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
      request.onerror=()=>reject(request.error||Error('Music storage could not open.'));
      request.onblocked=()=>reject(Error('Close another Sota Kece tab and try again.'));
    });}
    function done(transaction){return new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onabort=transaction.onerror=()=>reject(transaction.error||Error('Music could not be saved. Check available device storage.'));});}
    return {
      async list(){const db=await open();try{const tx=db.transaction('tracks','readonly'),complete=done(tx);const request=tx.objectStore('tracks').getAll();const recordsRequest=new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const [records]=await Promise.all([recordsRequest,complete]);return records.filter(r=>r.blob&&r.size>0).sort((a,b)=>b.addedAt-a.addedAt);}finally{db.close();}},
      async add(files){
        const accepted=[],rejected=[];
        for(const file of Array.from(files||[])){try{const checked=await inspect(file);accepted.push({id:JSON.stringify([file.name,file.size,file.lastModified||0]),title:String(file.name).replace(/\.[^.]+$/,'').slice(0,120),fileName:String(file.name).slice(0,240),type:checked.type,size:file.size,addedAt:Date.now()+accepted.length,blob:file});}catch(error){rejected.push({fileName:String(file?.name||'File').slice(0,120),reason:error.message});}}
        if(!accepted.length)return {saved:[],rejected};
        const db=await open();try{const tx=db.transaction('tracks','readwrite'),complete=done(tx);for(const record of accepted)tx.objectStore('tracks').put(record);await complete;return {saved:accepted,rejected};}finally{db.close();}
      },
      async remove(id){const db=await open();try{const tx=db.transaction('tracks','readwrite'),complete=done(tx);tx.objectStore('tracks').delete(id);await complete;}finally{db.close();}}
    };
  }
  const store=createStore();
  let tracks=[],selected=null,audio=null,objectUrl='',ready=null,dialog=null,busy=false,beforePlay=()=>{},message='',focusBefore=null;
  root.SotaPlayback?.register('local',pause);
  function el(tag,text,className){const node=root.document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
  function button(text,action){const node=el('button',text,'btn ghost');node.type='button';node.addEventListener('click',action);return node;}
  function remember(){try{if(selected)root.localStorage.setItem('sota.music.selected',selected.id);else root.localStorage.removeItem('sota.music.selected');}catch(_){} }
  function changed(){root.dispatchEvent(new root.CustomEvent('sota-music-change'));}
  function getAudio(){
    if(audio)return audio;
    audio=root.document.createElement('audio');audio.id='sota-local-audio';audio.controls=true;audio.preload='none';audio.setAttribute('aria-label','Your uploaded music');audio.setAttribute('data-sota-playback-source','local');
    audio.addEventListener('play',()=>{root.SotaPlayback?.activate('local',audio);sync();});
    for(const event of ['pause','ended'])audio.addEventListener(event,sync);
    audio.addEventListener('error',()=>{message='This track could not play. Choose another audio file.';sync();});
    return audio;
  }
  function pause(){if(audio&&!audio.paused)audio.pause();sync();}
  function choose(id){
    pause();const player=getAudio();player.removeAttribute('src');player.load();
    if(objectUrl){root.URL.revokeObjectURL(objectUrl);objectUrl='';}
    const hadSelection=!!selected;selected=tracks.find(track=>track.id===id)||null;
    if(selected){objectUrl=root.URL.createObjectURL(selected.blob);player.src=objectUrl;}
    else if(hadSelection)beforePlay();
    remember();sync();changed();
  }
  async function ensure(){
    if(!ready)ready=(async()=>{try{tracks=await store.list();let id;try{id=root.localStorage.getItem('sota.music.selected');}catch(_){}choose((tracks.find(t=>t.id===id)||tracks[0])?.id);}catch(_){message='Music will stay on this device. Choose a file to check available storage.';sync();}})();
    await ready;
  }
  async function toggle(){
    await ensure();if(!selected)return;
    const player=getAudio();if(!player.paused){pause();return;}
    beforePlay();message='';
    root.SotaMusicBadge?.prepare?.(player);
    root.SotaHeroVisualiser?.prepare(player);
    try{await player.play();}catch(_){message='Tap Play again, or choose a music format this browser supports.';sync();}
  }
  function sync(){
    if(!root.document)return;
    const playing=!!selected&&audio&&!audio.paused&&!audio.ended;
    if(selected){
      root.document.querySelectorAll('[data-sample-play],[data-local-music-toggle]').forEach(b=>{b.textContent=b.id==='sk-hero-play'?'':playing?'Ⅱ Pause music':'▶ Play my music';b.setAttribute('aria-pressed',String(playing));b.setAttribute('aria-label',(playing?'Pause ':'Play ')+selected.title);});
      root.document.querySelectorAll('[data-sample-status]').forEach(s=>s.textContent=(playing?'Playing · ':'Selected · ')+selected.title+' · saved on this device');
    }
    if(dialog){
      dialog.querySelector('#bv-local-music-status').textContent=message;
      const play=dialog.querySelector('#bv-local-music-play');play.disabled=!selected||busy;play.textContent=playing?'Pause music':'Play selected music';play.setAttribute('aria-pressed',String(playing));
      dialog.querySelector('#bv-local-music-files').disabled=busy;
      dialog.querySelector('#bv-local-music-title').textContent=selected?selected.title:'No music selected';
      getAudio().hidden=!selected;
    }
  }
  function renderList(){
    if(!dialog)return;
    const list=dialog.querySelector('#bv-local-music-list');list.replaceChildren();
    if(!tracks.length){list.append(el('p','Add songs from your device. They will be here when you return.','sub'));return;}
    for(const track of tracks){
      const row=el('div','','bv-local-music-row'),words=el('div');words.append(el('strong',track.title),el('small',`${(track.size/1024/1024).toFixed(1)} MB · saved on this device`));
      const pick=button(selected?.id===track.id?'Selected':'Select',()=>{beforePlay();choose(track.id);message='';renderList();dialog.querySelector('#bv-local-music-play').focus();});
      pick.setAttribute('aria-label','Select song '+track.title);pick.setAttribute('aria-pressed',String(selected?.id===track.id));pick.disabled=busy;
      const remove=button('Remove',async()=>{
        if(busy)return;busy=true;renderList();sync();
        try{await store.remove(track.id);tracks=tracks.filter(t=>t.id!==track.id);if(selected?.id===track.id){beforePlay();choose(tracks[0]?.id);}message='Song removed from this device.';}
        catch(_){message='Could not remove this song. Try again.';}
        finally{busy=false;renderList();sync();dialog?.querySelector('#bv-local-music-files')?.focus();}
      });remove.setAttribute('aria-label','Remove song '+track.title);remove.disabled=busy;
      row.append(words,pick,remove);list.append(row);
    }
  }
  async function importFiles(files){
    await ensure();if(busy)throw Error('Please wait for the current music change.');
    busy=true;message='Saving music on this device…';sync();renderList();
    try{
      const result=await store.add(files);tracks=await store.list();
      if(result.saved.length){beforePlay();choose(result.saved[0].id);}
      message=(result.saved.length?`${result.saved.length} song${result.saved.length===1?'':'s'} saved on this device. Tap Play when ready.`:'')+(result.rejected.length?' '+result.rejected.map(r=>r.fileName+': '+r.reason).slice(0,3).join(' '):'');
      return result;
    }catch(error){message='Music could not be saved. Check available device storage and try again.';throw Error(message);}
    finally{busy=false;sync();renderList();}
  }
  async function openLibrary(){
    if(dialog?.isConnected){dialog.showModal();return;}
    focusBefore=root.document.activeElement;dialog=el('dialog','','bv-music-dialog');dialog.setAttribute('aria-labelledby','bv-local-music-heading');
    const head=el('div','','bv-music-dialog-head'),heading=el('h2','Your music');heading.id='bv-local-music-heading';const close=button('×',()=>dialog.close());close.setAttribute('aria-label','Close your music');head.append(heading,close);
    const note=el('p','Saved on this device, like Fiji 3D Maps. Your files are not sent to a server or shared with friends.','sub');
    const label=el('label','Choose music files');label.htmlFor='bv-local-music-files';const input=el('input');input.id='bv-local-music-files';input.type='file';input.multiple=true;input.accept=accept;
    const formatsNote=el('p','MP3, M4A, AAC, WAV, OGG, FLAC or Opus · up to 250 MB per song.','sub');
    const status=el('p','','bv-local-music-status');status.id='bv-local-music-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const title=el('h3');title.id='bv-local-music-title';const play=button('Play selected music',toggle);play.id='bv-local-music-play';
    const list=el('div','','bv-local-music-list');list.id='bv-local-music-list';list.setAttribute('aria-label','Saved songs');
    const visuals=el('dimau-music-visualiser');visuals.setAttribute('for','sota-local-audio');
    dialog.append(head,note,label,input,formatsNote,status,title,play,getAudio(),visuals,list);root.document.body.append(dialog);
    input.addEventListener('change',async()=>{const files=Array.from(input.files||[]);input.disabled=true;try{await importFiles(files);}catch(_){}finally{input.disabled=false;input.value='';}});
    dialog.addEventListener('close',()=>{dialog.remove();dialog=null;focusBefore?.focus({preventScroll:true});});
    dialog.showModal();await ensure();if(dialog){sync();renderList();}
  }
  function mount(target,options={}){
    if(options.beforePlay)beforePlay=options.beforePlay;
    target.querySelectorAll('[data-local-music-open]:not([data-music-bound])').forEach(b=>{b.dataset.musicBound='true';b.addEventListener('click',openLibrary);});
    target.querySelectorAll('[data-local-music-toggle]:not([data-music-bound])').forEach(b=>{b.dataset.musicBound='true';b.addEventListener('click',toggle);});
    ensure().then(sync);
  }
  return {limit,accept,inspect,createStore,mount,importFiles,open:openLibrary,toggle,pause,hasSelected:()=>!!selected,title:()=>selected?.title||''};
});
