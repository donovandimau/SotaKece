(function() {
  'use strict';
  const skins = window.BulaSkins;
  if (!skins) return;
  const discovery = window.SotaSkinDiscovery;
  const visuals = window.SotaSkinVisuals;
  let studio = null, draft = null, legacy = '', focusBefore = null;
  let homeSkinChosen=false,guestPreviewToken=0;
  try{homeSkinChosen=!!localStorage.getItem('bv-picked-skin');}catch(_){}
  const example = {display_name:'Sema',handle:'sema',bio:'Good people. Brighter days. Suva, Fiji.'};
  let sampleAudio = null, sampleTimer = null;
  function stopSample() {window.SotaLocalMusic?.pause();stopSampleOnly();}
  function stopSampleOnly() {
    clearTimeout(sampleTimer);
    if(sampleAudio) { sampleAudio.close().catch(()=>{}); sampleAudio=null; }
    document.querySelectorAll('[data-sample-play]').forEach(button=>{
      button.textContent=button.id==='sk-hero-play'?'':button.id==='bv-home-play'?'▶ Try a sample':'▶';button.setAttribute('aria-label',button.id==='sk-hero-play'?'Play sample music':'Play sample loop');button.setAttribute('aria-pressed','false');
    });
    document.querySelectorAll('[data-sample-status]').forEach(status=>status.textContent='Sample melody · tap to play');
    document.querySelector('.bv-mixtape')?.classList.remove('is-playing');
  }
  function picked() {
    try { return skins.normalize(JSON.parse(localStorage.getItem('bv-picked-skin')||'{"id":"hibiscus"}')); }
    catch (_) { return skins.normalize({id:'hibiscus'}); }
  }
  function remix(settings,id) {
    const oldPreset=skins.presets.find(p=>p.id===settings.id);
    return skins.normalize({id,note:settings.note!==oldPreset.note?settings.note:undefined,
      layout:settings.layout,interests:settings.interests,trackUrl:settings.trackUrl,trackTitle:settings.trackTitle,
      trackPath:settings.trackPath,coverPath:settings.coverPath,avatarPath:settings.avatarPath,songRef:settings.songRef,
      atmosphere:settings.atmosphere,motionEnergy:settings.motionEnergy,
      customName:settings.customName,font:settings.font!==oldPreset.font?settings.font:undefined,
      textScale:settings.textScale,headingScale:settings.headingScale,coverHeight:settings.coverHeight,
      coverX:settings.coverX,coverY:settings.coverY,textAlign:settings.textAlign,musicPosition:settings.musicPosition});
  }
  function themeLabel(p) { return p.regionalTitle||p.identityLabel||p.name; }
  function skinScene(settings) {
    const p=skins.presets.find(p=>p.id===settings.id);
    if(!p?.artwork)return '';
    return `<div class="bv-skin-scene" style="background-image:url(&quot;${esc(p.artwork)}&quot;)" role="img" aria-label="${esc(p.artDescription)}"><span>${esc(p.name)}</span></div>`;
  }
  function skinSongs(settings) {
    const s=skins.normalize(settings),p=skins.presets.find(p=>p.id===s.id),songs=p.songs||[];
    if(!songs.length&&!p.identityLabel)return '';
    const sources=(p.identitySources||[]).filter(url=>skins.safeUrl(url));
    return `<section class="bv-identity-music"><header><span>THE MUSIC. THE MEMORIES.</span><h3>${esc(themeLabel(p))}</h3></header>
      ${songs.length?`<div class="bv-identity-songs">${songs.map((song,i)=>{
        const ref=p.id+':'+i,selected=s.songRef===ref;
        const label=/official institutional|documented school association/.test(song.relationship)?'School / community song':/alumni/.test(song.relationship)?'Alumni anthem':/school-themed|collaboration/.test(song.relationship)?'Supporter recording':'Listening reference';
        return `<div class="bv-identity-song"><span class="bv-song-record" aria-hidden="true">♫</span><div><small>${esc(label)}</small><b>${esc(song.title)}</b><span>${esc(song.performer)}</span><a href="${esc(song.url)}" target="_blank" rel="noopener noreferrer">Listen at the source ↗</a></div>${studio?`<button type="button" data-choose-song="${ref}" aria-pressed="${selected}" aria-label="${selected?'Selected':'Choose'} ${esc(song.title)}">${selected?'Chosen ✓':'Choose'}</button>`:''}</div>`;
      }).join('')}</div>`:'<p class="bv-music-empty">Make it personal with your own track in Create your own.</p>'}
      ${sources.length?`<details><summary>About this community skin</summary><p>${esc(p.identityNote||'Community-made design')}</p>${sources.map((url,i)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Identity reference ${i+1} ↗</a>`).join('')}</details>`:''}</section>`;
  }
  function coverContent(settings) {
    const s=skins.normalize(settings),p=skins.presets.find(p=>p.id===s.id);
    return `${window.SotaRoomAtmosphere?.markup(s)||''}${s.coverPath?coverMediaMarkup(s):''}<div class="bv-cover-placement"><div class="bv-cover-copy"><span class="bv-skin-tag">${s.customName?'YOUR OWN DESIGN':esc(p.category)+' · Your community'}</span><h3 class="bv-identity-title">${esc(s.customName||themeLabel(p))}</h3><div class="bv-cover-words">${esc(s.note||p.note)}</div></div></div>`;
  }
  function preview(profile, settings) {
    const s=skins.normalize(settings),p=skins.presets.find(p=>p.id===s.id);
    const roomLayout=discovery?.layout(p)||'social';
    const interests=s.interests.split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
    const portraits=Array.from({length:16},(_,i)=>originalMate(i%14,`Example friend ${i+1}`));
    const avatar=profile.avatar_emoji?`<span class="bv-avatar-emoji">${esc(profile.avatar_emoji)}</span>`:frontAvatar('Sema — example profile portrait');
    const soundtrack=`${s.trackUrl||s.trackPath||s.songRef?trackMarkup(s):window.SotaLocalMusic?.hasSelected()?`<div class="bv-track"><span>♫ ${esc(window.SotaLocalMusic.title())}</span><button type="button" class="btn sm ghost" data-local-music-toggle>Play my music</button><small>Saved on this device.</small></div>`:`<div class="bv-skin-player"><span class="bv-vinyl" aria-hidden="true"></span><div><small>THE SOUND OF YOUR ROOM</small><b>Your own mixtape</b><p>Add a track in Create your own.</p></div><span class="bv-player-wave" aria-hidden="true">▂▅▃▇▂▆▃</span></div>`}${skinSongs(s)}`;
    return `<div class="bv-preview bv-art-room" style="${esc(skins.inline(s))}" data-layout="${s.layout}" data-music-position="${s.musicPosition}" data-look="${p.look}" data-identity-layout="${roomLayout}">
      <div class="bv-cover" data-pattern="${s.pattern}">${coverContent(s)}</div>
      <div class="bv-profile-intro"><div class="bv-profile-avatar">${avatar}</div><div class="bv-room-identity"><h2>${esc(profile.display_name||profile.handle||'Your name')}</h2><p class="bv-room-handle">@${esc(profile.handle||'yourhandle')}</p></div><span class="bv-room-sticker" aria-hidden="true">✦</span><p class="bv-room-bio">${esc(profile.bio||'Good people. Brighter days.')}</p>
        ${interests.length?`<div class="bv-interests">${interests.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}</div>
      <div class="bv-room-tabs"><span>Talanoa</span><span>Top Mates · 16</span><span>My soundtrack</span></div>
      ${s.musicPosition==='top'||s.musicPosition==='auto'&&roomLayout==='music'?`<div class="bv-soundstage bv-preview-soundtrack">${soundtrack}</div>`:''}
      <div class="bv-preview-columns"><section class="bv-mini-card bv-preview-wall"><h3>Talanoa <small>Example notes</small></h3><div class="bv-photo-note">${frontCrop(660,500,46,49,'Example portrait of Donu')}<div><b>Donu</b><p>Same time, same sunset?</p></div></div><div class="bv-photo-note">${frontCrop(658,562,46,48,'Example portrait of Jo')}<div><b>Jo</b><p>Bring your favourite track.</p></div></div></section>
      <section class="bv-mini-card bv-preview-mates"><h3>My people <small>Example Top Mates</small></h3><div class="bv-photo-friends">${portraits.map(p=>`<span>${p}</span>`).join('')}</div></section></div>
      ${s.musicPosition==='bottom'||s.musicPosition==='auto'&&roomLayout!=='music'?`<div class="bv-preview-soundtrack">${soundtrack}</div>`:''}</div>`;
  }
  function chatPreview(profile, settings) {
    const s=skins.normalize(settings),p=skins.presets.find(p=>p.id===s.id);
    return `<section data-look="${p.look}" class="bv-chat-preview" style="${esc(skins.inline(s))}" aria-label="Chat skin preview">
      <header class="bv-chat-heading">${window.SotaRoomAtmosphere?.markup(s)||''}<span class="bv-chat-avatar" aria-hidden="true">✦</span><div><h3>Your circle</h3><p>Example Koro · ${esc(profile.display_name||profile.handle||'You')}</p></div></header>
      <div class="bv-chat-messages"><p class="bv-chat-caption">Example conversation</p>
        <div class="msg"><span class="who">Donu</span>Same time, same sunset?</div>
        <div class="msg mine"><span class="who">You</span>Absolutely. I’ll bring the playlist.</div>
        <div class="msg"><span class="who">Jo</span>See you there! 🌺</div>
      </div><div class="bv-chat-compose" aria-label="Example composer"><span>Write a message…</span><button type="button" disabled aria-label="Send (preview only)">↑</button></div>
      <p class="bv-chat-caption">Preview only · your saved skin also styles your Koro chats.</p>
    </section>`;
  }
  function coverMediaMarkup(settings) {
    return settings.coverPath?`<button type="button" class="bv-cover-load" data-cover-path="${esc(settings.coverPath)}">Load my cover artwork ↗</button>`:'';
  }
  function trackMarkup(settings) {
    const attribute=settings.trackPath?`data-profile-path="${esc(settings.trackPath)}"`:settings.trackUrl?`data-profile-track="${esc(settings.trackUrl)}"`:'';
    if(attribute)return `<div class="bv-track"><span>♫ ${esc(settings.trackTitle||'My profile track')}</span><button type="button" class="btn sm ghost" ${attribute}>Play track</button><small>Tap to load. No autoplay.</small></div>`;
    const song=skins.song(settings.songRef);
    return song?`<div class="bv-track bv-chosen-song"><span class="bv-vinyl" aria-hidden="true"></span><div><small>MY SOUNDTRACK</small><b>${esc(song.title)}</b><span>${esc(song.performer)}</span></div><a href="${esc(song.url)}" target="_blank" rel="noopener noreferrer">Listen ↗</a></div>`:'';
  }
  function wireMedia(root) {
    window.SotaRoomAtmosphere?.mount(root);
    root.querySelectorAll('[data-choose-song]').forEach(button=>button.addEventListener('click',()=>{
      if(!studio||!draft||!skins.song(button.dataset.chooseSong))return;
      const ref=button.dataset.chooseSong;draft.songRef=ref;draft.trackUrl='';draft.trackPath='';
      studio.querySelector('#bv-trackUrl').value='';drawPreview();
      studio.querySelector(`[data-choose-song="${ref}"]`)?.focus({preventScroll:true});
    }));
    window.SotaLocalMusic?.mount(root,{beforePlay:()=>{window.SotaPlaylist?.pause();stopSample();}});
    root.querySelectorAll('[data-profile-track]:not([data-bv-bound]),[data-profile-path]:not([data-bv-bound])').forEach(button=>{
      button.dataset.bvBound='true';button.addEventListener('click',async()=>{
        button.disabled=true;button.textContent='Loading…';
        try{
          const url=button.dataset.profilePath?await window.SotaRoomMedia.signed(sb,button.dataset.profilePath,'music'):button.dataset.profileTrack;
          if(!button.isConnected)return;
          const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=url;audio.setAttribute('aria-label','Profile track');
          audio.addEventListener('error',()=>{audio.parentElement.querySelector('small').textContent='Track unavailable. Check the file or try again later.';});
          button.replaceWith(audio);audio.play().catch(()=>{audio.parentElement?.querySelector('small')&&(audio.parentElement.querySelector('small').textContent='Tap the audio controls to play.');});
        }catch(_){button.disabled=false;button.textContent='Try track again';button.parentElement.querySelector('small').textContent='Uploaded tracks are for the room owner and mutual friends. Sign in or check your connection.';}
      });
    });
    root.querySelectorAll('[data-cover-path]:not([data-bv-bound])').forEach(button=>{
      button.dataset.bvBound='true';button.addEventListener('click',async()=>{
        button.disabled=true;button.textContent='Loading cover…';
        try{
          const url=await window.SotaRoomMedia.signed(sb,button.dataset.coverPath,'covers');if(!button.isConnected)return;
          const image=document.createElement('img');image.className='bv-cover-photo';image.alt='Room cover artwork';image.decoding='async';image.src=url;
          image.addEventListener('error',()=>{image.remove();button.hidden=false;button.disabled=false;button.textContent='Cover unavailable · try again';});
          button.closest('.bv-cover').prepend(image);button.hidden=true;
        }catch(_){button.disabled=false;button.textContent='Sign in or retry to load cover';}
      });
    });
    root.querySelectorAll('[data-media-url]:not([data-bv-bound])').forEach(button=>{button.dataset.bvBound='true';button.addEventListener('click',()=>{
      const image=document.createElement('img');image.alt='Shared image';image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';image.src=button.dataset.mediaUrl;
      image.addEventListener('error',()=>{image.replaceWith(button);button.textContent='Image unavailable · tap to retry';});button.replaceWith(image);
    });});
  }
  let mediaUploads=[],mediaBusy=false;
  async function uploadRoomMedia(event) {
    const kind=event.target.id==='bv-music-upload'?'music':'covers',file=event.target.files?.[0];if(!file)return;
    const dialog=studio,userId=S.user?.id;if(!dialog||!draft)return;
    if(kind==='music'){
      const status=dialog.querySelector('#bv-upload-status'),saveButton=dialog.querySelector('#bv-save');
      mediaBusy=true;saveButton.disabled=true;event.target.disabled=true;status.textContent='Saving music on this device…';
      try{const result=await window.SotaLocalMusic.importFiles(Array.from(event.target.files||[]));if(studio===dialog){status.textContent=result.saved.length?'Music saved on this device. Tap Play in the preview or open Your music.':result.rejected.map(r=>r.reason).join(' ');drawPreview();}}
      catch(error){if(studio===dialog)status.textContent=error.message;}
      finally{mediaBusy=false;if(studio===dialog){saveButton.disabled=false;event.target.disabled=false;event.target.value='';}}
      return;
    }
    if(!userId)return;
    const status=dialog.querySelector('#bv-upload-status'),saveButton=dialog.querySelector('#bv-save');
    mediaBusy=true;saveButton.disabled=true;status.textContent=kind==='music'?'Uploading your track…':'Uploading your artwork…';
    dialog.querySelectorAll('input[type=file]').forEach(input=>input.disabled=true);
    try{
      const uploaded=await window.SotaRoomMedia.api(sb,userId).upload(file,kind);
      if(studio!==dialog||!draft){await window.SotaRoomMedia.api(sb,userId).remove(uploaded.path);return;}
      mediaUploads.push({path:uploaded.path,userId});
      if(kind==='music'){draft.trackPath=uploaded.path;draft.trackTitle=uploaded.title;draft.trackUrl='';dialog.querySelector('#bv-trackTitle').value=draft.trackTitle;dialog.querySelector('#bv-trackUrl').value='';}
      else draft.coverPath=uploaded.path;
      status.textContent=kind==='music'?'Track uploaded. Save your room to add it.':'Cover uploaded. Save your room to use it.';drawPreview();
    }catch(error){if(studio===dialog)status.textContent=error.message||'Upload interrupted. Your design is still here.';}
    finally{mediaBusy=false;if(studio===dialog){saveButton.disabled=false;dialog.querySelectorAll('input[type=file]').forEach(input=>input.disabled=input.id==='bv-cover-upload');event.target.value='';}}
  }
  function discardUploads(keep=[]) {
    const pending=mediaUploads.filter(file=>!keep.includes(file.path));mediaUploads=[];
    pending.forEach(file=>window.SotaRoomMedia.api(sb,file.userId).remove(file.path).catch(()=>{}));
  }

  function reset() {
    window.SotaExperience?.stop();
    window.SotaFrontPages?.stop();
    window.SotaMusicHome?.stop();
    window.SotaProfilePhotos?.stop();
    window.SotaHeroVisualiser?.release();
    window.SotaRoomAtmosphere?.release(app);
    window.SotaPlayback?.pauseSource('profile');
    stopSample();
    document.body.classList.remove('bv-room-active','bv-chat-active');
    delete document.body.dataset.bvLook;
    document.querySelector('#bv-active-skin')?.remove();
    app.classList.remove('bv-welcome','bv-skin-room-preview');
    document.documentElement.style.setProperty('--accent',S.me?.room_accent||'#086779');
  }
  function apply(profile, room) {
    const parsed=skins.read(profile.room_css),s=parsed.settings;
    if (!String(profile.room_css||'').startsWith('/* bv-skin:v1 ')) s.accent=/^#[0-9a-f]{6}$/i.test(profile.room_accent)?profile.room_accent:s.accent;
    const view=document.querySelector('#view');
    if(!view)return;
    view.classList.add('bv-room');view.dataset.layout=s.layout;view.dataset.musicPosition=s.musicPosition;view.dataset.bvLook=skins.presets.find(p=>p.id===s.id).look;
    view.dataset.bvIdentity=discovery?.layout(skins.presets.find(p=>p.id===s.id))||'social';
    const style=document.createElement('style');style.id='bv-active-skin';
    style.textContent='body.bv-room-active{'+skins.inline(s)+'}\n'+skins.safeLegacy(parsed.legacy);
    document.head.appendChild(style);document.body.classList.add('bv-room-active');
    const p=skins.presets.find(p=>p.id===s.id),head=document.querySelector('#room-head');
    if(head){
      const cover=document.createElement('div');cover.className='bv-cover';cover.dataset.pattern=s.pattern;
      cover.innerHTML=coverContent(s);
      head.prepend(cover);
      const soundtrack=document.createElement('div');soundtrack.className='bv-room-soundstage';
      if(s.trackUrl||s.trackPath||s.songRef)soundtrack.innerHTML=trackMarkup(s);
      soundtrack.insertAdjacentHTML('beforeend',skinSongs(s));
      head.appendChild(soundtrack);
      const stats=document.createElement('div');stats.className='bv-profile-stats';
      stats.innerHTML=`<span><b>${(room.top||[]).length}</b>Top friends</span><span><b>${(room.moments||[]).length}</b>Moments</span><span><b>${(room.wall||[]).length}</b>Whiteboard notes</span>`;
      head.appendChild(stats);
    }
    const columns=view.querySelector('.grid.two');
    if(columns){
      columns.classList.add('bv-personal-columns');
      columns.children[0]?.classList.add('bv-personal-wall');
      columns.children[1]?.classList.add('bv-personal-side');
      const music=view.querySelector('.bv-room-soundstage');
      if(music&&s.musicPosition==='top')columns.before(music);
      if(music&&s.musicPosition==='bottom')columns.after(music);
    }
    const side=view.querySelector('.grid.two>.stack:nth-child(2)');
    if(side){
      const about=document.createElement('section');about.className='glass card';
      const interests=s.interests.split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
      about.innerHTML=`<h3>A little about me</h3><p class="sub" style="line-height:1.8">${esc(profile.bio||'Still making this space my own.')}</p>
        ${interests.length?`<div class="bv-interests">${interests.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}
        <div class="hr"></div><div class="sub">Wearing ${esc(p.name)}</div>
        ${!room.is_me?`<button type="button" class="btn sm ghost" style="margin-top:12px" id="bv-borrow-skin">Try this skin</button>`:''}`;
      side.prepend(about);
      about.querySelector('#bv-borrow-skin')?.addEventListener('click',()=>open(s));
    }
    wireMedia(view);
    window.SotaProfilePhotos?.mountRoom(view,profile,{isOwner:!!room.is_me});
  }
  function applyChat(profile) {
    if(!profile||!document.querySelector('#msgs'))return;
    const s=skins.read(profile.room_css).settings;
    if(!String(profile.room_css||'').startsWith('/* bv-skin:v1 '))s.accent=/^#[0-9a-f]{6}$/i.test(profile.room_accent)?profile.room_accent:s.accent;
    document.querySelector('#bv-active-skin')?.remove();
    const style=document.createElement('style');style.id='bv-active-skin';
    style.textContent='body.bv-room-active{'+skins.inline(s)+'}';
    document.head.appendChild(style);document.body.classList.add('bv-room-active','bv-chat-active');
    document.body.dataset.bvLook=skins.presets.find(p=>p.id===s.id).look;
    const messages=document.querySelector('#msgs');
    document.querySelector('.sk-chat-atmosphere')?.remove();
    if(s.atmosphere!=='none'&&window.SotaRoomAtmosphere){
      const art=document.createElement('div');art.className='sk-chat-atmosphere';
      art.innerHTML=window.SotaRoomAtmosphere.markup(s)+'<p>Your room atmosphere</p>';
      messages.before(art);window.SotaRoomAtmosphere.mount(art);
    }
  }
  const originalShell=shell;
  shell=function(body){reset();originalShell(body);wireMedia(app);window.SotaSpaceDesign?.mount(app);window.SotaExperience?.mountMember(app,S);};
  const originalAuth=renderAuth;
  let pendingMate='';
  function coverChoices() {
    const ids=['hibiscus','midnight','pixel','studio-masi','studio-coral','studio-ocean'];
    return ids.map(id=>skins.presets.find(p=>p.id===id)).filter(Boolean).map(skinOption).join('');
  }
  function skinThumbnail(p) {
    const art=visuals?.thumbnail(p)||visuals?.cover(p)||p.coverArt||p.artwork;
    return `<span class="bv-visual-thumb" style="${esc(skins.inline({id:p.id}))}" data-look="${p.look}" aria-hidden="true"><span class="bv-thumb-art">${art?`<img src="${esc(art)}" style="object-position:${esc(visuals?.position(p)||'center')}" loading="lazy" alt="">`:''}<b>${esc(themeLabel(p))}</b></span></span>`;
  }
  function skinOption(p) {
    return `<button type="button" class="bv-skin-option" data-skin="${p.id}" aria-pressed="${draft.id===p.id}" aria-label="${esc(p.name)} skin">${skinThumbnail(p)}<span class="bv-choice-label"><strong>${esc(p.name)}</strong><small>${esc(p.category)}</small></span></button>`;
  }
  function collectionMarkup(compact=false) {
    if(!discovery)return '';
    return discovery.featuredCollections(skins.presets).map(group=>`<button type="button" class="bv-collection-card" data-collection="${group.id}" ${compact?`aria-pressed="${skinCategory===group.id}"`:''} aria-label="Browse ${esc(group.name)} · ${group.count} skins">
      <span class="bv-collection-art" aria-hidden="true"><img src="${esc(visuals?.collection(group.id)||group.featured[0].coverArt)}" alt="" loading="lazy" decoding="async" width="1536" height="1024"></span>
      <span class="bv-collection-copy"><span class="bv-collection-count">${group.count} skins</span><strong>${esc(group.name)}</strong>${compact?'':`<span class="bv-collection-line">${esc(group.line)}</span><span class="bv-collection-members">${group.featured.map(p=>esc(p.name)).join(' / ')}</span>`}</span><span class="bv-collection-arrow" aria-hidden="true">↗</span></button>`).join('');
  }
  function discoveryMarkup() {
    return `<section class="bv-discovery" id="bv-your-room" tabindex="-1" aria-labelledby="bv-discovery-title"><header><div><span class="bv-discovery-kicker">MAKE IT YOURS</span><h2 id="bv-discovery-title">Make it yours.</h2><p>Browse a look, or start with your own ideas.</p><small class="bv-discovery-selected">Selected skin · <span id="bv-welcome-skin-name"></span></small></div><button type="button" class="bv-discovery-all">Explore all ${skins.presets.length} skins <span aria-hidden="true">↗</span></button></header>${discovery?`<div class="bv-collection-grid">${collectionMarkup()}</div>`:''}<p class="bv-discovery-note">Original cover artwork. Community-made designs. A space to make your own.</p></section>`;
  }
  function originalCrop(x,y,w,h,label) {
    return `<svg class="sk-photo" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label)}"><image href="/assets/mobile-front-reference.png" width="1008" height="1792"/></svg>`;
  }
  function originalMate(index,label) {
    // Native portraits from Donovan's original mobile artwork, without re-encoding.
    return originalCrop(150+(index%7)*103,1452+Math.floor(index/7)*85,80,80,label);
  }
  function frontCrop(x,y,w,h,label) {
    if(x===660&&y===500)return originalCrop(153,1221,79,79,label);
    if(x===658&&y===562)return originalCrop(153,1305,79,79,label);
    if(w===48&&h===48)return originalMate((Math.round((x-1020)/61)+Math.round((y-448)/50)*4)%14,label);
    return `<svg class="sk-photo" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(label)}"><image href="/assets/front-reference.jpg" width="1360" height="768"/></svg>`;
  }
  function frontAvatar(label) { return originalCrop(121,951,215,215,label); }
  function showcasePortrait() { return frontAvatar('Sema — My Space showcase model'); }
  async function shareApp(copyOnly=false) {
    const url='https://sotakece.com/';
    if(!copyOnly&&typeof window==='object'&&window.SotaShare){const kind=await window.SotaShare.share({title:'Sota Kece',text:'Join me on Sota Kece for friends, music and talanoa.',url});return {kind,message:kind==='cancelled'?'Sharing cancelled.':kind==='shared'?'Sharing options opened.':'Choose how to send your invitation.'};}
    if(!copyOnly&&typeof navigator.share==='function'){
      try{await navigator.share({title:'Sota Kece',text:'Join me on Sota Kece for friends, music and talanoa.',url});return {kind:'shared',message:'Sharing options opened.'};}
      catch(error){if(error?.name==='AbortError')return {kind:'cancelled',message:'Sharing cancelled.'};}
    }
    try{if(typeof navigator.clipboard?.writeText!=='function')throw Error('Clipboard unavailable');await navigator.clipboard.writeText(url);return {kind:'copied',message:'Invite link copied. Send it to your friends.'};}
    catch(_){return {kind:'manual',message:'Copy this invite link: '+url};}
  }
  function wireInvite(button,status,{copyOnly=false,input=null}={}) {
    button.addEventListener('click',async()=>{
      if(button.disabled)return;const doc=button.ownerDocument,restoreFocus=doc?.activeElement===button;button.disabled=true;
      try{
        const result=await shareApp(copyOnly);
        if(!button.isConnected||!status.isConnected)return;
        status.textContent=result.message;
        if(input?.isConnected){input.parentElement.hidden=result.kind!=='manual';if(result.kind==='manual'&&(doc?.activeElement===button||(restoreFocus&&doc?.activeElement===doc?.body))){input.focus();input.select();}}
      }finally{if(button.isConnected){button.disabled=false;if(restoreFocus&&doc.activeElement===doc.body)button.focus({preventScroll:true});}}
    });
  }
  function musicMarkup(){return `<section id="sota-music-home" class="sota-music-home" aria-label="Music">
        <section class="bv-music-feature" id="bv-music" tabindex="-1" aria-labelledby="bv-music-title"><img src="/assets/fiji-music.jpg" width="720" height="480" alt="Fijian singer and friends sharing live music at a seaside gathering" loading="lazy" decoding="async"><div class="bv-music-copy"><small>YOUR ROOM. YOUR SOUNDTRACK.</small><h1 id="bv-music-title">Viti roots.<br>Volume up.</h1><p>Your tunes. Your people. Your island energy.</p><div class="bv-music-actions"><button id="bv-home-play" data-playlist-open type="button" aria-label="Try a sample from the online music playlist" aria-haspopup="dialog" aria-expanded="false" aria-pressed="false">▶ Try a sample</button><button type="button" data-local-music-open>Upload music</button></div><small id="bv-home-status" data-playlist-status role="status">Online music · choose a song to listen</small></div></section>
        <div class="sota-music-views"><div class="sota-music-view-tabs" role="tablist" aria-label="Music view"><button type="button" id="music-view-visualiser" role="tab" data-music-view="visualiser" aria-controls="music-panel-visualiser" aria-selected="true" tabindex="0">Visualiser</button><button type="button" id="music-view-playlist" role="tab" data-music-view="playlist" aria-controls="music-panel-playlist" aria-selected="false" tabindex="-1">Playlist</button></div><div id="music-panel-visualiser" class="sota-music-view-panel" role="tabpanel" data-music-panel="visualiser" aria-labelledby="music-view-visualiser"><section class="sk-music-stage" data-state="idle" aria-labelledby="sk-music-stage-title"><header class="sk-music-stage-heading"><div><small>SOUND IN COLOUR</small><h2 id="sk-music-stage-title">Your soundtrack, in colour.</h2></div><button type="button" class="sk-music-stage-choose" data-playlist-open aria-haspopup="dialog"><span aria-hidden="true">♫</span> Choose a song</button></header><div class="sk-music-stage-picture" role="img" aria-label="Music visualiser · choose a song to begin"><canvas aria-hidden="true"></canvas><div class="sk-music-stage-baseline" aria-hidden="true"></div></div><footer class="sk-music-stage-footer"><p data-stage-status role="status" aria-live="off">Choose a song. Watch your sound come alive.</p><div class="sk-music-stage-controls"><label>Visual style <select data-stage-mode><option value="spectrum">Spectrum</option><option value="waveform">Waves</option><option value="halo">Halo</option></select></label><button type="button" data-stage-motion aria-pressed="false">Pause visuals</button></div></footer></section></div><div id="music-panel-playlist" class="sota-music-view-panel" role="tabpanel" data-music-panel="playlist" aria-labelledby="music-view-playlist" hidden><div data-music-playlist-host></div></div></div>
      </section>`;}
  renderAuth=function(mode='in',expanded=false){
    guestPreviewToken++;window.SotaConnections?.stopEntry();window.SotaRoomSocial?.stop();window.SotaRoomSocialLayout?.stop();
    reset();originalAuth(mode);
    const authNode=app.querySelector('.authwrap');
    authNode.querySelectorAll(':scope > .row,:scope > .tagline,:scope > .promises,:scope > .btn').forEach(node=>node.remove());
    authNode.querySelector('.seg').remove();
    authNode.querySelectorAll('label').forEach(label=>label.htmlFor=label.nextElementSibling.id);
    authNode.querySelector('#a-email').autocomplete='email';
    authNode.querySelector('#a-pass').autocomplete=mode==='up'?'new-password':'current-password';
    const auth=authNode.outerHTML;
    app.classList.add('bv-welcome');
    app.innerHTML=`<a class="sota-skip" href="#bv-neon">Skip to content</a><header class="sk-site-header sk-pattern-masthead" aria-label="Sota Kece header"><a class="sk-site-brand" href="/" aria-label="Sota Kece home"><img class="dimau-owner-logo" src="/assets/dimau-owner-logo-20260920.png" alt="Dimau Fintech" width="36" height="36"></a><div class="sk-pattern-heading" aria-hidden="true">Sota Kece</div><button class="sk-hero-play" id="sk-hero-play" type="button" data-playlist-open aria-label="Open music playlist" aria-pressed="false" aria-describedby="sk-hero-status" title="Open music playlist"></button><span class="sk-hero-status" id="sk-hero-status" data-playlist-status role="status">Music playlist · tap to choose a song</span></header><section class="sk-front sk-original-front" aria-label="Sota Kece original supplied design">
      <div class="sk-hero-artwork"><picture class="sk-original-picture"><source media="(max-width:760px)" srcset="/assets/mobile-front-reference-brand.jpg" width="1008" height="1896"><img class="sk-original-design" src="/assets/front-reference-brand.jpg" width="1360" height="832" loading="lazy" decoding="async" alt="Sota Kece: Create your own space with friends. Sunset room artwork, masi border and music player."></picture>${window.SotaRoomSocial?.markup({hero:true})||`<section class="sota-social-host sota-social-hero" aria-label="Your Talanoa and mates"><button type="button" class="sota-social-panel" data-social-panel="wall" onclick="renderAuth('in',true)"><span class="sota-social-heading">Talanoa</span><span>Your conversations, together.</span></button><button type="button" class="sota-social-panel" data-social-panel="mates" onclick="renderAuth('in',true)"><span class="sota-social-heading">Top Mates</span><span>Your closest connections.</span></button></section>`}<div class="sk-hero-visualiser" hidden data-state="idle" role="img" aria-label="Music visualiser · choose a song to begin"><canvas aria-hidden="true"></canvas></div><button class="sk-artwork-play" hidden type="button" data-playlist-open aria-label="Choose music for live visualiser" aria-pressed="false" aria-describedby="sk-hero-status"></button><button class="sk-hero-create" type="button" onclick="renderAuth('up',true)" aria-label="Create your space" title="Create your space"></button></div>
      ${musicMarkup()}
    </section><main class="bv-neon-section" id="bv-neon" tabindex="-1"><div class="bv-classic">
      <header class="bv-classic-header bv-connect-header"><div class="bv-wordmark" aria-label="Sota Kece"><small>FIJI ROOTS. EVERYWHERE ENERGY.</small></div>
        <div class="bv-entry-copy"><h2>Bring your <span>whole world</span> together.</h2><p>People, pets and everything that connects you.</p><ul class="bv-entry-connections" aria-label="Explore your life connections"><li><a class="bv-entry-friends" href="#sota-connections">Friends</a></li><li><a class="bv-entry-family" href="#sota-connections">Family</a></li><li><a class="bv-entry-school" href="#sota-connections">School</a></li><li><a class="bv-entry-work" href="#sota-connections">Work</a></li><li><a class="bv-entry-pets" href="#sota-connections">Pets</a></li><li><a class="bv-entry-nature" href="#sota-connections">Nature</a></li></ul><a class="bv-entry-map-link" href="#sota-connections">Explore your life map <span aria-hidden="true">↗</span></a></div>
        <nav class="bv-entry-account-actions" aria-label="Sign up or sign in"><button type="button" class="bv-entry-button bv-entry-primary" id="sk-sign-up" aria-haspopup="dialog" aria-controls="bv-entry">Sign up</button><button type="button" class="bv-entry-button" id="sk-sign-in" aria-haspopup="dialog" aria-controls="bv-entry">Sign in</button></nav>
        <section class="bv-entry-invite" aria-labelledby="bv-entry-invite-title"><div class="bv-entry-invite-heading"><span class="bv-entry-invite-icon" aria-hidden="true">↗</span><div><small>MAKE ROOM FOR YOUR PEOPLE</small><h3 id="bv-entry-invite-title">Better when we're together.</h3></div></div><p>Bring your people into the circle.</p><div class="bv-entry-share-actions"><button type="button" class="bv-entry-button bv-entry-share" id="sk-share-app">Share app <span aria-hidden="true">↗</span></button><button type="button" class="bv-entry-button" id="sk-copy-invite">Copy invite link</button><button type="button" class="bv-entry-button" id="sk-invite-circle">Invite to a circle <span aria-hidden="true">→</span></button></div><small class="bv-entry-status" id="sk-share-status" role="status" aria-live="polite"></small><div class="bv-entry-copy-link" hidden><label for="sk-invite-url">Invite link</label><input id="sk-invite-url" type="text" value="https://sotakece.com/" readonly></div></section>
        <form class="bv-home-search" id="bv-home-search" role="search" aria-label="Find a mate"><label for="bv-find-mate">Find your people</label><div><input id="bv-find-mate" placeholder="Find a mate by @handle" value="${esc(pendingMate)}" maxlength="21" autocapitalize="off" spellcheck="false" autocomplete="off" aria-describedby="bv-search-status"><button type="submit" aria-label="Find a mate">⌕</button></div><small id="bv-search-status" role="status">Already know someone here? Find them by @handle.</small></form>
      </header>
      <nav class="bv-home-section-nav" aria-label="On this page"><span>Jump into your world</span><a href="#sota-connections">Life map</a><a href="#bv-music">Music</a><a href="#bv-circle">Talanoa Circle</a><a href="#bv-your-room">Skins</a></nav>
      <dialog class="bv-account-dialog" id="bv-entry" aria-labelledby="bv-account-title"><div class="bv-account-head"><h2 id="bv-account-title">${mode==='up'?'Create your account':'Sign in'}</h2><button type="button" id="bv-account-close" aria-label="Close account form">×</button></div>${auth}<button type="button" class="bv-link" onclick="renderAuth('${mode==='up'?'in':'up'}',true)">${mode==='up'?'Already have an account? Sign in':'New here? Sign up'}</button></dialog>
      <section class="bv-social-stage bv-home-call-group" id="bv-circle" tabindex="-1" aria-label="Talanoa Circle"><section class="bv-circle-feature" aria-labelledby="bv-circle-title"><div class="bv-circle-art"><img class="bv-circle-logo" src="/assets/sota-kece-logo-20261020.svg" width="256" height="256" alt="Sota Kece" loading="lazy" decoding="async"></div><small>SIT DOWN. CATCH UP.</small><h2 id="bv-circle-title">Same circle. New stories.</h2><p>Pull up a seat in Our Talanoa Circle.</p><button type="button" class="bv-circle-explore" onclick="window.SotaKavaUI.preview()">Explore Our Talanoa Circle →</button></section>
      </section>
      ${window.SotaConnections?.entryHtml?.()||''}
      ${discoveryMarkup()}
      <footer class="bv-classic-footer"><span>Sota Kece · alive together</span><button type="button" class="bv-install-link" data-dimau-install-button>Install Sota Kece</button><span>Mutual friends · Your own archive · No ads</span></footer>
    </div></main>`;
    window.SotaConnections?.mountEntry();
    window.SotaLocalMusic?.mount(app,{beforePlay:()=>{window.SotaPlaylist?.pause();stopSample();}});
    window.SotaHeroVisualiser?.mount(app);
    window.SotaRoomSocial?.mount(app);window.SotaRoomSocialLayout?.mount(app);
    window.SotaProfilePhotos?.mountHero(app);
    window.SotaPlaylist?.mount(app,{beforePlay:stopSample});
    window.SotaMusicHome?.mount(app);
    window.SotaFrontPages?.mount(app);
    window.SotaSpaceDesign?.mount(app);
    window.SotaSpaceDesign?.decorateDialog?.(app.querySelector('.bv-account-dialog'));
    // Replacing the wrapper recreates controls, so restore the original auth handlers.
    $('#a-go').textContent=mode==='up'?'Create account':'Sign in';
    $('#a-go').onclick=()=>mode==='up'?signUp():signIn();
    app.querySelectorAll('.authwrap input').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')$('#a-go').click();}));
    app.querySelector('.bv-discovery-all')?.addEventListener('click',()=>open(null,'All'));
    app.querySelectorAll('[data-collection]').forEach(button=>button.addEventListener('click',()=>open(null,button.dataset.collection)));

    $('#sk-invite-circle').addEventListener('click',()=>window.SotaCircles?.openInvite());
    $('#sk-sign-up').addEventListener('click',()=>renderAuth('up',true));
    $('#sk-sign-in').setAttribute('aria-haspopup','dialog');
    $('#sk-sign-in').setAttribute('aria-controls','bv-entry');
    $('#sk-sign-in').addEventListener('click',()=>renderAuth('in',true));
    const account=$('#bv-entry');
    $('#bv-account-close').addEventListener('click',()=>account.close());
    account.addEventListener('close',()=>$('#sk-sign-in')?.focus({preventScroll:true}));

    $('#bv-home-search').addEventListener('submit',event=>{
      event.preventDefault();pendingMate=$('#bv-find-mate').value.trim().toLowerCase().replace(/^@/,'');
      if(!/^[a-z0-9_]{3,20}$/.test(pendingMate)){ $('#bv-search-status').textContent='Use a handle: 3–20 letters, numbers or underscores.';return; }
      try{sessionStorage.setItem('sota-find-mate',pendingMate);}catch(_){}
      if(mode==='up')renderAuth('in',true);else if(!$('#bv-entry').open)$('#bv-entry').showModal();
      $('#bv-search-status').textContent=`Sign in to find @${pendingMate}. Profiles stay private.`;
      $('#a-email').focus();
    });
    wireInvite($('#sk-share-app'),$('#sk-share-status'),{input:$('#sk-invite-url')});
    wireInvite($('#sk-copy-invite'),$('#sk-share-status'),{copyOnly:true,input:$('#sk-invite-url')});
    showWelcome(picked(),homeSkinChosen);
    window.SotaExperience?.mountGuest(app,{roomMarkup:preview(example,picked())});
    wireMedia(app.querySelector('.sx-room-example')||app);
    if(expanded){account.showModal();$(mode==='up'?'#a-handle':'#a-email').focus();}
  };
  function showWelcome(settings,themed=true) {
    const s=skins.normalize(settings),root=document.querySelector('#app.bv-welcome');
    const label=document.querySelector('#bv-welcome-skin-name');
    if(label)label.textContent=s.customName||skins.presets.find(p=>p.id===s.id).name;
    if(!root)return;
    root.classList.toggle('bv-home-skinned',themed);
    if(themed){
      Object.entries(skins.tokens(s)).forEach(([key,value])=>root.style.setProperty(key,value));
      root.dataset.homeSkin=s.id;
    }else{
      Object.keys(skins.tokens(s)).forEach(key=>root.style.removeProperty(key));
      delete root.dataset.homeSkin;
    }
  }
  function showGuestRoom(settings) {
    if(S.user)return;
    if(window.SotaExperience){history.replaceState(null,'','#profile');renderAuth('in');app.querySelector('.sx-page-heading h1')?.focus({preventScroll:true});return;}
    const s=skins.normalize(settings),name=s.customName||skins.presets.find(p=>p.id===s.id).name;
    window.SotaView?.invalidate();window.SotaConnections?.stop();window.SotaKavaUI?.stop();
    reset();app.classList.add('bv-skin-room-preview');
    app.innerHTML=`<section class="bv-skin-room-page"><header class="bv-skin-room-head"><div><p class="bv-skin-room-kicker">YOUR SELECTED SKIN</p><h1 id="bv-skin-room-title" tabindex="-1">${esc(name)}</h1><p>Example room · Sign in to make it yours.</p></div><nav aria-label="Room preview actions"><button type="button" class="btn ghost" id="bv-room-change-skin">Change skin</button><button type="button" class="btn" id="bv-room-sign-in">Sign in to save my room</button><button type="button" class="btn ghost" id="bv-room-home">Back to home</button></nav></header><main id="bv-skin-room" data-skin="${esc(s.id)}" aria-label="${esc(name)} room preview">${preview(example,s)}</main></section>`;
    app.querySelector('#bv-room-change-skin').onclick=()=>open(s);
    app.querySelector('#bv-room-sign-in').onclick=()=>renderAuth('in',true);
    app.querySelector('#bv-room-home').onclick=()=>renderAuth('in');
    wireMedia(app);
    app.scrollIntoView({block:'start'});app.querySelector('#bv-skin-room-title').focus({preventScroll:true});
  }
  const designControlKeys=['accent','background','panel','cover','cardStyle','effect','pattern','font','note','layout','interests','trackUrl','trackTitle','atmosphere','motionEnergy','customName','textScale','headingScale','coverHeight','coverX','coverY','textAlign','musicPosition'];
  function rangeField(key,label,min,max,step,unit){
    return `<div class="bv-range-field"><label for="bv-${key}">${label} <output id="bv-${key}-value" for="bv-${key}">${draft[key]}${unit}</output></label><input id="bv-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${draft[key]}" data-unit="${unit}"></div>`;
  }
  function syncDesignReadouts(){
    for(const key of ['textScale','headingScale','coverHeight','coverX','coverY']){
      const input=studio.querySelector('#bv-'+key),output=studio.querySelector('#bv-'+key+'-value');
      if(output)output.textContent=draft[key]+input.dataset.unit;
    }
    studio.querySelectorAll('[data-cover-x]').forEach(button=>button.setAttribute('aria-pressed',String(draft.coverX===Number(button.dataset.coverX)&&draft.coverY===Number(button.dataset.coverY))));
  }
  function syncDesignControls(){
    for(const key of designControlKeys)studio.querySelector('#bv-'+key).value=draft[key];
    studio.querySelector('#bv-showArtwork').checked=draft.showArtwork;
    syncDesignReadouts();
  }
  function setEditorMode(mode){
    if(!studio)return;const creating=mode==='create';studio.dataset.editorMode=creating?'create':'browse';
    studio.querySelector('.bv-studio-custom').hidden=!creating;
    studio.querySelector('.bv-studio-custom').open=creating;
    studio.querySelector('.bv-creator-intro').hidden=!creating;
    studio.querySelectorAll('[data-editor-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.editorMode===studio.dataset.editorMode)));
    studio.querySelector('.bv-preview-back').textContent=creating?'← Back to my design':'← Back to skin choices';
    studio.querySelector('#bv-studio-title').textContent=creating?'Create your own skin.':'Make it yours.';
  }
  function open(initial,collection) {
    if(studio)return;
    const parsed=skins.read(S.me?.room_css);
    const current=String(S.me?.room_css||'');
    draft=skins.normalize(initial||(!S.user||!current?picked():current.startsWith('/* bv-skin:v1 ')?parsed.settings:{...parsed.settings,accent:S.me.room_accent}));
    const group=discovery?.collections(skins.presets).find(g=>g.id===collection);
    if(group&&!group.categories.includes(skins.presets.find(p=>p.id===draft.id).category))draft=remix(draft,group.featured[0].id);
    legacy=parsed.legacy;focusBefore=document.activeElement;
    const p=S.me||example;skinCategory=collection||(initial?.id?skins.presets.find(p=>p.id===draft.id).category:discovery?'Discover':'New picks');skinQuery='';studioPreviewMode='profile';
    studio=document.createElement('dialog');studio.className='bv-studio';studio.dataset.editorMode='browse';studio.setAttribute('aria-labelledby','bv-studio-title');
    studio.innerHTML=`<div class="bv-studio-head"><div><span class="bv-studio-kicker">YOUR SPACE, REMIXED</span><h2 id="bv-studio-title">Make it yours.</h2><p>Pick a skin or create your own. Your room, your way.</p></div><button type="button" class="bv-close" aria-label="Close skin studio">×</button></div>
      <div class="bv-studio-body"><div class="bv-studio-controls"><div class="bv-studio-modes" role="group" aria-label="Skin editor mode"><button type="button" data-editor-mode="browse" aria-pressed="true">Choose a skin</button><button type="button" data-editor-mode="create" aria-pressed="false">Create your own</button></div><div class="bv-creator-intro" hidden><h3>Your design, from the ground up.</h3><p>Use the current skin as a starting point, or begin with a blank canvas. Every change appears in your preview.</p><div class="row"><button type="button" class="btn ghost" id="bv-start-blank">Start blank</button><button type="button" class="btn ghost" id="bv-reset-design">Reset design</button><button type="button" class="btn ghost" id="bv-undo-design" hidden>Undo reset</button></div><p class="bv-editor-status" id="bv-editor-status" role="status"></p></div><section class="bv-studio-covers" aria-labelledby="bv-cover-choices-title"><h3 id="bv-cover-choices-title">Cover choices</h3><div class="bv-skin-grid" aria-label="Cover choices">${coverChoices()}</div></section><section class="bv-atmosphere-picker" aria-labelledby="bv-atmosphere-title"><h3 id="bv-atmosphere-title">Room atmosphere</h3><p>A little movement over your artwork. Press Play in the preview.</p><div class="bv-atmosphere-fields"><label for="bv-atmosphere">Effect<select id="bv-atmosphere">${(window.SotaRoomAtmosphere?.effects||[{id:'none',name:'Off'}]).map(e=>`<option value="${e.id}" ${draft.atmosphere===e.id?'selected':''}>${e.name}</option>`).join('')}</select></label><label for="bv-motionEnergy">Energy<select id="bv-motionEnergy"><option value="calm" ${draft.motionEnergy==='calm'?'selected':''}>Calm</option><option value="bold" ${draft.motionEnergy==='bold'?'selected':''}>Energetic</option></select></label></div></section><nav class="bv-collection-shortcuts" aria-label="Browse identity collections">${collectionMarkup(true)}</nav><div class="bv-studio-picker"><div class="bv-skin-filters"><label class="bv-search-label" for="bv-skin-search">Find a skin<input id="bv-skin-search" type="search" placeholder="Style, artist, place or name…" autocomplete="off"></label><label for="bv-skin-category">Collection<select id="bv-skin-category" aria-label="Skin collection"></select></label><p id="bv-skin-count" role="status"></p></div><div class="bv-skin-grid" id="bv-skin-options" tabindex="0" aria-label="Room skins"></div></div>

      <details class="bv-studio-custom" hidden open><summary>Your design tools <span>Colours · fonts & sizes · placement · music</span></summary><div class="bv-custom-content"><fieldset class="bv-creator-group"><legend>Name your skin</legend><div class="bv-controls"><div class="bv-span"><label for="bv-customName">Skin name</label><input id="bv-customName" maxlength="40" value="${esc(draft.customName)}" placeholder="Give your design a name"></div><label class="bv-span bv-artwork-choice"><input id="bv-showArtwork" type="checkbox" ${draft.showArtwork?'checked':''}> Use this skin’s cover artwork</label></div></fieldset><fieldset class="bv-creator-group"><legend>Colours & pattern</legend><div class="bv-controls">
        <div><label for="bv-accent">Accent colour</label><input id="bv-accent" type="color" value="${draft.accent}"></div>
        <div><label for="bv-background">Page colour</label><input id="bv-background" type="color" value="${draft.background}"></div>
        <div><label for="bv-panel">Card colour</label><input id="bv-panel" type="color" value="${draft.panel}"></div><div><label for="bv-cover">Cover colour</label><input id="bv-cover" type="color" value="${draft.cover}"></div>
        <div><label for="bv-cardStyle">Card corners</label><select id="bv-cardStyle">${['soft','square','round'].map(v=>`<option value="${v}" ${draft.cardStyle===v?'selected':''}>${v}</option>`).join('')}</select></div><div><label for="bv-effect">Card finish</label><select id="bv-effect">${['flat','glow','sticker'].map(v=>`<option value="${v}" ${draft.effect===v?'selected':''}>${v}</option>`).join('')}</select></div>
        <div><label for="bv-pattern">Background pattern</label><select id="bv-pattern">${skins.patterns.map(v=>`<option value="${v}" ${draft.pattern===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></div>
        </div></fieldset><fieldset class="bv-creator-group"><legend>Fonts & sizes</legend><div class="bv-controls"><div class="bv-span"><label for="bv-font">Font style</label><select id="bv-font">${[['rounded','Rounded'],['serif','Storybook'],['mono','Typewriter'],['sans','Clean sans'],['display','Bold display'],['handwritten','Handwritten']].map(([v,t])=>`<option value="${v}" ${draft.font===v?'selected':''}>${t}</option>`).join('')}</select></div>
        ${rangeField('textScale','Text size',90,140,5,'%')}${rangeField('headingScale','Heading size',80,150,5,'%')}
        </div></fieldset><fieldset class="bv-creator-group"><legend>Place your content</legend><p>Arrange your room cards and move the words anywhere inside your cover.</p><div class="bv-controls">
        <div class="bv-span"><label for="bv-layout">Room layout</label><select id="bv-layout">${[['classic','Classic · Talanoa and friends'],['wide','Wide wall'],['reverse','Friends on the left'],['stacked','One column']].map(([v,t])=>`<option value="${v}" ${draft.layout===v?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="bv-span"><label for="bv-musicPosition">Music placement</label><select id="bv-musicPosition">${[['auto','Follow the original skin'],['top','Above the room cards'],['bottom','Below the room cards']].map(([v,t])=>`<option value="${v}" ${draft.musicPosition===v?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="bv-span"><span class="bv-placement-label">Quick cover positions</span><div class="bv-placement-presets" role="group" aria-label="Cover text position">${[['Top left',0,0],['Top centre',50,0],['Top right',100,0],['Middle left',0,50],['Centre',50,50],['Middle right',100,50],['Bottom left',0,100],['Bottom centre',50,100],['Bottom right',100,100]].map(([label,x,y])=>`<button type="button" data-cover-x="${x}" data-cover-y="${y}" aria-label="${label}" aria-pressed="${draft.coverX===x&&draft.coverY===y}"><span aria-hidden="true">${label==='Centre'?'●':label.startsWith('Top')?'↑':label.startsWith('Bottom')?'↓':'↔'}</span><span>${label}</span></button>`).join('')}</div></div>
        ${rangeField('coverX','Horizontal position',0,100,1,'%')}${rangeField('coverY','Vertical position',0,100,1,'%')}
        ${rangeField('coverHeight','Cover height',180,420,5,'px')}
        <div><label for="bv-textAlign">Cover text alignment</label><select id="bv-textAlign">${['left','center','right'].map(v=>`<option value="${v}" ${draft.textAlign===v?'selected':''}>${v==='center'?'Centre':v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></div>
        </div></fieldset><fieldset class="bv-creator-group"><legend>Your words & music</legend><div class="bv-controls">
        <div class="bv-span"><label for="bv-note">Words on your cover</label><input id="bv-note" value="${esc(draft.note)}" maxlength="80" placeholder="Whatever feels like you"></div>
        <div class="bv-span"><label for="bv-interests">Your favourites, separated by commas</label><input id="bv-interests" value="${esc(draft.interests)}" maxlength="160" placeholder="Drua, music, sunsets, good company"></div>
        <div class="bv-span"><label for="bv-trackTitle">Your profile track</label><input id="bv-trackTitle" value="${esc(draft.trackTitle)}" maxlength="80" placeholder="Song name · artist"></div>
        <div class="bv-upload-box"><h4>Bring your own music & artwork</h4><p>Uploaded music is saved on this device, like Fiji 3D Maps. Use a direct audio link below for a track your friends can hear. Cover uploads are being prepared.</p><label for="bv-music-upload">Upload music · MP3, M4A, AAC, WAV, OGG, FLAC or Opus · up to 250 MB per song</label><input id="bv-music-upload" type="file" accept=".mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.opus" multiple><button type="button" class="btn ghost" data-local-music-open>Your music</button><label for="bv-cover-upload">Upload cover artwork · JPG, PNG or WebP · up to 6 MB</label><input id="bv-cover-upload" type="file" accept=".jpg,.jpeg,.png,.webp" disabled><div class="bv-upload-status" id="bv-upload-status" role="status"></div><div class="bv-upload-actions"><button type="button" class="btn ghost" id="bv-remove-track">Remove track</button><button type="button" class="btn ghost" id="bv-remove-cover">Remove cover</button></div></div>
        <div class="bv-span"><label for="bv-trackUrl">Or paste a direct audio link</label><input id="bv-trackUrl" type="url" value="${esc(draft.trackUrl)}" maxlength="320" placeholder="https://…/your-track.mp3"><p class="sub">Use an HTTPS MP3, M4A, OGG, Opus or WAV file you can share. Loads only when a visitor taps Play.</p></div></div></fieldset>
      ${S.user&&S.me?`<details><summary>Edit your profile</summary><div class="stack"><div><label for="d-name">Display name</label><input id="d-name" value="${esc(p.display_name||'')}" maxlength="40"></div>
        <div><label for="d-pro">Pronouns</label><input id="d-pro" value="${esc(p.pronouns||'')}" maxlength="24"></div>
        <div><label for="d-bio">Bio</label><textarea id="d-bio" maxlength="400">${esc(p.bio||'')}</textarea></div>
        <div><label for="d-emo">Your emoji</label><input id="d-emo" value="${esc(p.avatar_emoji||'🌺')}" maxlength="8"></div></div></details>
        <details><summary>Advanced: your custom CSS</summary><p class="sub">Style room cards and text. External files and page overlays are excluded.</p><label for="d-css">Room CSS</label><textarea id="d-css" maxlength="3000" placeholder=".scrawl { border-radius: 20px; }">${esc(legacy)}</textarea></details>`:''}</div></details></div>
      <aside class="bv-studio-preview"><div class="bv-example-label"><span>${S.user?'Your room · live preview':'Example room · live preview'}</span><span id="bv-preview-name"></span></div><div class="bv-preview-modes" role="group" aria-label="Preview surface"><button type="button" data-preview-mode="profile" aria-pressed="true">Profile</button><button type="button" data-preview-mode="chat" aria-pressed="false">Chat</button></div><div id="bv-studio-preview"></div><p class="sub" style="font-size:11px;line-height:1.7;margin-top:14px">${S.user?'Your friends will see this skin when they visit your room.':'These are example details. Your own name, friends and posts appear when you make a room.'}</p></aside></div>
      <div class="bv-studio-footer"><div class="bv-studio-error" id="bv-studio-error" role="status" aria-live="polite"></div><div class="row"><button type="button" class="btn ghost bv-view-preview" id="bv-view-preview">Preview</button><button type="button" class="btn ghost" id="bv-cancel">Cancel</button><button type="button" class="btn" id="bv-save">${S.user?'Save my room':'Use this skin'}</button></div></div>`;
    // The creator is a first-class mode, before the long preset catalogue.
    const creator=studio.querySelector('.bv-studio-custom');
    studio.querySelector('.bv-creator-intro').after(creator);
    document.body.appendChild(studio);
    let undoDesign=null;
    studio.querySelectorAll('[data-editor-mode]').forEach(button=>button.addEventListener('click',()=>setEditorMode(button.dataset.editorMode)));
    studio.querySelector('#bv-view-preview').addEventListener('click',()=>{
      const target=studio.querySelector('.bv-studio-preview');target.scrollIntoView({block:'start',behavior:'auto'});
      studio.querySelector('.bv-preview-back').focus({preventScroll:true});
    });
    const replaceDesign=blank=>{
      undoDesign={...draft};
      const keep={interests:draft.interests,trackUrl:draft.trackUrl,trackTitle:draft.trackTitle,trackPath:draft.trackPath,coverPath:draft.coverPath,avatarPath:draft.avatarPath,songRef:draft.songRef};
      draft=skins.normalize({...keep,id:blank?'lagoon':draft.id,...(blank?{customName:'My own skin',showArtwork:false,pattern:'plain',note:'Your space. Your people.'}:{})});
      syncDesignControls();drawOptions();drawPreview();studio.querySelector('#bv-undo-design').hidden=false;
      studio.querySelector('#bv-editor-status').textContent=blank?'Blank canvas ready. Your music and favourites are kept.':'Design reset to the original skin. Your music and favourites are kept.';
      studio.querySelector('#bv-customName').focus({preventScroll:true});
    };
    studio.querySelector('#bv-start-blank').addEventListener('click',()=>replaceDesign(true));
    studio.querySelector('#bv-reset-design').addEventListener('click',()=>replaceDesign(false));
    studio.querySelector('#bv-undo-design').addEventListener('click',()=>{
      if(!undoDesign)return;draft=skins.normalize(undoDesign);undoDesign=null;
      syncDesignControls();drawOptions();drawPreview();studio.querySelector('#bv-undo-design').hidden=true;
      studio.querySelector('#bv-editor-status').textContent='Your previous design is restored.';studio.querySelector('#bv-reset-design').focus({preventScroll:true});
    });
    studio.querySelectorAll('[data-cover-x]').forEach(button=>button.addEventListener('click',()=>{
      draft.coverX=Number(button.dataset.coverX);draft.coverY=Number(button.dataset.coverY);
      syncDesignControls();drawPreview();
    }));
    studio.querySelector('.bv-close').addEventListener('click',close);
    studio.querySelector('#bv-cancel').addEventListener('click',close);
    studio.querySelector('#bv-save').addEventListener('click',save);
    studio.querySelectorAll('[data-preview-mode]').forEach(button=>button.addEventListener('click',()=>{
      studioPreviewMode=button.dataset.previewMode;drawPreview();
    }));
    const browse=document.createElement('button');browse.type='button';browse.className='bv-preview-back';browse.textContent='← Back to skin choices';
    browse.addEventListener('click',()=>{studio.querySelector('.bv-studio-controls').scrollIntoView({block:'start',behavior:'auto'});studio.querySelector(`[data-editor-mode="${studio.dataset.editorMode}"]`).focus({preventScroll:true});});
    studio.querySelector('.bv-studio-preview').prepend(browse);
    studio.addEventListener('cancel',event=>{event.preventDefault();close();});
    const opened=studio,returnFocus=focusBefore;
    studio.addEventListener('close',()=>{
      window.SotaRoomAtmosphere?.release(opened);
      opened.remove();if(studio!==opened)return;
      discardUploads();studio=null;draft=null;showWelcome(picked(),homeSkinChosen);returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});
    });
    studio.addEventListener('input',update);studio.addEventListener('change',update);
    studio.querySelectorAll('input[type=file]').forEach(input=>input.addEventListener('change',uploadRoomMedia));
    studio.querySelector('#bv-remove-track').addEventListener('click',()=>{draft.trackPath='';draft.trackUrl='';draft.trackTitle='';draft.songRef='';studio.querySelector('#bv-trackUrl').value='';studio.querySelector('#bv-trackTitle').value='';drawPreview();});
    studio.querySelector('#bv-remove-cover').addEventListener('click',()=>{draft.coverPath='';drawPreview();});
    studio.addEventListener('click',event=>{
      const button=event.target.closest('[data-skin]');
      if(!button||!studio.contains(button))return;
      const fromCovers=!!button.closest('.bv-studio-covers');
      draft=remix(draft,button.dataset.skin);
      syncDesignControls();
      drawOptions();drawPreview();
      studio.querySelector(`${fromCovers?'.bv-studio-covers':'#bv-skin-options'} [data-skin="${draft.id}"]`)?.focus({preventScroll:true});
      if(window.matchMedia('(max-width:760px)').matches)studio.querySelector('.bv-studio-preview').scrollIntoView({block:'start',behavior:'auto'});
    });
    const gallery=studio.querySelector('#bv-skin-options');
    const category=studio.querySelector('#bv-skin-category');
    const groups=discovery?.collections(skins.presets)||[];
    category.innerHTML=[{id:'Discover',name:'Discover'},{id:'All',name:'All skins'},...groups.map(g=>({id:g.id,name:g.name})),...[...new Set(skins.presets.map(p=>p.category))].map(c=>({id:c,name:c}))].map(c=>`<option value="${esc(c.id)}" ${c.id===skinCategory?'selected':''}>${esc(c.name)}</option>`).join('');
    studio.querySelectorAll('[data-collection]').forEach(button=>button.addEventListener('click',()=>{
      skinCategory=button.dataset.collection;category.value=skinCategory;skinQuery='';studio.querySelector('#bv-skin-search').value='';drawOptions();
    }));
    category.addEventListener('change',()=>{skinCategory=category.value;skinQuery='';studio.querySelector('#bv-skin-search').value='';drawOptions();});
    studio.querySelector('#bv-skin-search').addEventListener('input',event=>{
      skinQuery=event.target.value.trim().toLowerCase();
      if(skinQuery){skinCategory='All';category.value='All';}
      drawOptions();
    });
    gallery.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      const buttons=Array.from(gallery.querySelectorAll('[data-skin]')),i=buttons.indexOf(event.target);if(i<0)return;
      const next=i+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-2,ArrowDown:2}[event.key]);
      if(buttons[next]){event.preventDefault();buttons[next].focus();}
    });
    studio.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    drawOptions();drawPreview();studio.showModal();if(draft.customName)setEditorMode('create');
  }
  function close() {if(!saving)studio?.close();}
  let skinCategory='Discover',skinQuery='',studioPreviewMode='profile';
  function drawOptions() {
    const gallery=studio.querySelector('#bv-skin-options');
    const choices=discovery?discovery.matching(skins.presets,skinCategory,skinQuery):skins.presets.filter(p=>skinQuery?`${p.name} ${p.category} ${p.note}`.toLowerCase().includes(skinQuery):skinCategory==='All'||p.category===skinCategory);
    const collectionName=discovery?.collections(skins.presets).find(g=>g.id===skinCategory)?.name||skinCategory;
    studio.querySelector('#bv-skin-count').textContent=`${choices.length} ${choices.length===1?'skin':'skins'} · ${skinQuery?'searching all collections':collectionName}`;
    studio.querySelectorAll('[data-collection]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.collection===skinCategory)));
    gallery.innerHTML=choices.length?choices.map(skinOption).join(''):'<p class="bv-no-skins">No skins match. Try another name or clear your search.</p>';
    studio.querySelectorAll('[data-skin]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.skin===draft.id)));

  }
  function update(event) {
    if(!studio||!draft)return;
    for(const key of designControlKeys)draft[key]=studio.querySelector('#bv-'+key).value;
    draft.showArtwork=studio.querySelector('#bv-showArtwork').checked;
    if(event?.target.id==='bv-trackUrl'&&draft.trackUrl){draft.trackPath='';draft.songRef='';}
    draft=skins.normalize(draft);syncDesignReadouts();drawPreview();
  }
  function drawPreview() {
    window.SotaRoomAtmosphere?.release(studio.querySelector('#bv-studio-preview'));
    const profile={...(S.me||example)};
    for(const [id,field] of [['d-name','display_name'],['d-bio','bio'],['d-emo','avatar_emoji']]){const el=studio.querySelector('#'+id);if(el)profile[field]=el.value;}
    studio.querySelector('#bv-studio-preview').innerHTML=studioPreviewMode==='chat'?chatPreview(profile,draft):preview(profile,draft);
    studio.querySelectorAll('[data-preview-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewMode===studioPreviewMode)));
    wireMedia(studio.querySelector('#bv-studio-preview'));
    studio.querySelector('#bv-preview-name').textContent=draft.customName||skins.presets.find(p=>p.id===draft.id).name;
    if(!S.user)showWelcome(draft);
  }
  let saving=false;
  async function save() {
    if(!studio||!draft||mediaBusy||saving)return;
    const dialog=studio,settings={...draft},ownerId=S.user?.id;
    const button=dialog.querySelector('#bv-save'),errorBox=dialog.querySelector('#bv-studio-error');
    errorBox.textContent='';
    const trackInput=dialog.querySelector('#bv-trackUrl').value.trim();
    if(trackInput&&!skins.safeUrl(trackInput,true)){errorBox.textContent='Use a direct HTTPS audio-file link, or leave it empty.';dialog.querySelector('#bv-trackUrl').focus();return;}
    if(S.user&&!S.me){errorBox.textContent='Finish setting up your room before saving a skin.';return;}
    if(!S.user){
      try{localStorage.setItem('bv-picked-skin',JSON.stringify(settings));}catch(_){errorBox.textContent='This browser could not keep your choice. You can still pick it after signing in.';return;}
      homeSkinChosen=true;const chosenSkin=settings,previewToken=++guestPreviewToken;
      // One-shot token: the pending preview runs unless another flow bumps the token.
      dialog.addEventListener('close',()=>{if(S.user||previewToken!==guestPreviewToken)return;showGuestRoom(chosenSkin);},{once:true});
      close();return;
    }
    const name=dialog.querySelector('#d-name').value.trim();
    if(!name){errorBox.textContent='Give your profile a display name.';dialog.querySelector('#d-name').focus();return;}
    let patch;
    try{patch={display_name:name,pronouns:dialog.querySelector('#d-pro').value.trim(),bio:dialog.querySelector('#d-bio').value,
      avatar_emoji:dialog.querySelector('#d-emo').value.trim()||'🌺',room_accent:settings.accent,room_css:skins.encode(settings,dialog.querySelector('#d-css').value)};}
    catch(e){errorBox.textContent=e.message;return;}
    const controls=Array.from(dialog.querySelectorAll('button,input,select,textarea')).map(control=>({control,disabled:control.disabled}));
    saving=true;controls.forEach(({control})=>control.disabled=true);button.textContent='Saving…';dialog.setAttribute('aria-busy','true');
    try{
      const {data,error}=await sb.from('bv_profiles').update(patch).eq('id',ownerId).select('id,display_name,pronouns,bio,avatar_emoji,room_accent,room_css').single();
      if(error)throw error;
      if(!data||data.id!==ownerId||data.room_css!==patch.room_css)throw new Error('Your saved skin could not be confirmed. Please try again.');
      if(studio!==dialog||S.user?.id!==ownerId||S.me?.id!==ownerId)return;
      Object.assign(S.me,data);discardUploads([settings.trackPath,settings.coverPath]);saving=false;close();toast('Your room, your skin. Saved.');S.tab='room';S.roomHandle=null;await render();
    }catch(e){if(studio===dialog)errorBox.textContent=e.message||'Your room could not be saved. Your changes are still here.';}
    finally{if(studio===dialog)saving=false;dialog.removeAttribute('aria-busy');controls.forEach(({control,disabled})=>control.disabled=disabled);button.textContent='Save my room';}
  }
  window.addEventListener('sota-music-change',()=>{if(studio&&draft)drawPreview();});
  openDecorate=function(){open();};
  function closeForOwnerChange(){
    window.SotaProfilePhotos?.stop();
    window.SotaRoomAtmosphere?.release(studio);
    const previous=studio,pending=mediaUploads;mediaUploads=[];studio=null;draft=null;saving=false;
    previous?.close();previous?.remove();window.SotaPlayback?.activate('auth-change');stopSampleOnly();
    // The auth notification stays synchronous; private upload cleanup runs after its lock is released.
    if(pending.length)setTimeout(()=>pending.forEach(file=>window.SotaRoomMedia.api(sb,file.userId).remove(file.path).catch(()=>{})),0);
  }
  window.SotaPlayback?.register('sample',stopSampleOnly);
  window.BulaSkinStudio={musicMarkup,apply,applyChat,reset,open,preview,chatPreview,showcasePortrait,closeForOwnerChange};
})();

