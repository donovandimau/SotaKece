/* Discover the existing Sota worlds. Content, media, accounts and saved designs keep their owners. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaWorlds=api;})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const photos={social:'/assets/social-sunset-20261104/friends-guitar-768.webp',music:'/assets/social-sunset-20261104/music-friends-768.webp',space:'/assets/social-sunset-20261104/space-friends-768.webp'};
  const worlds={
    home:{label:'Home',title:'A little closer to your people.',line:'Your people, music and space, together.',tone:'sun',photo:null},
    people:{label:'People',title:'Good people. Great connections.',line:'Find a familiar face. Bring your friends. See your world grow.',tone:'rose',photo:photos.social,action:'Find a mate',focus:'#bv-find-mate,#s-q'},
    talanoa:{label:'Talanoa',title:'Pull up a seat. Stay a while.',line:'Your stories, your circles and a little time together.',tone:'coral',photo:photos.social,action:'Explore a circle',tool:'circle'},
    music:{label:'Music',title:'Your music. In full colour.',line:'Choose your soundtrack, remix the visuals and make the moment yours.',tone:'violet',photo:photos.music,action:'Choose music visuals',tool:'visuals'},
    profile:{label:'My space',title:'A world with your name on it.',line:'Your look, your people, your soundtrack. Make every detail feel like you.',tone:'lilac',photo:photos.space,action:'Open Room Studio',tool:'studio'},
    skins:{label:'Skins & Room Studio',title:'Your space. Your choice.',line:'Browse colours, artwork and layouts, or create your own.',tone:'sun',photo:null,action:'Browse every skin',tool:'skins'},
    world:{label:'3D world',title:'Every connection has a story.',line:'Explore your people and places from a different perspective.',tone:'lime',photo:null,action:'Explore the map',focus:'#sota-connections'},
    pulse:{label:'Your feed',title:'A little closer, every day.',line:'Catch up with your people. Share a thought. Start a conversation.',tone:'rose',photo:null,action:'Share a moment',member:'moments'},
    moments:{label:'Moments',title:'Little moments. Yours to keep.',line:'The good days, everyday stories and memories worth sharing.',tone:'sun',photo:null,action:'Share a moment',focus:'#m-body'},
    friends:{label:'Friends',title:'Good people. Great connections.',line:'Keep your circle close. Find a mate, visit a room and catch up.',tone:'rose',photo:photos.social,action:'Find a friend',focus:'#s-q'},
    room:{label:'My space',title:'A world with your name on it.',line:'Your look, your people, your soundtrack. Make every detail feel like you.',tone:'lilac',photo:photos.space,action:'Open Room Studio',tool:'studio'},
    crews:{label:'Your Koro',title:'Your people. Your Koro.',line:'Private groups for the people you want to bring together.',tone:'coral',photo:photos.social,action:'Start a Koro',focus:'#koro-create input'},
    circles:{label:'Talanoa circles',title:'A place for every voice.',line:'Familiar voices, fresh stories and space for your circle.',tone:'coral',photo:photos.social,action:'Explore your circles',focus:'#kc-retry,.kava-room button'},
    connections:{label:'Your connections',title:'Every connection has a story.',line:'Discover the friendships and Koro that make up your world.',tone:'lime',photo:null,action:'Explore the map',focus:'#sc-search,.sc-map,#sota-connections'}
  };
  const publicPages=['home','people','talanoa','music','profile','skins','world'];
  const memberPages=['pulse','moments','friends','crews','circles','room','music','connections'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const symbols={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',talanoa:'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5ZM7 10h10M7 14h6',music:'M9 18V5l12-2v13M9 8l12-2M9 18a3 2 0 1 1-6 0 3 2 0 0 1 6 0M21 16a3 2 0 1 1-6 0 3 2 0 0 1 6 0',profile:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 22v-2a8 8 0 0 1 16 0v2',skins:'M20 13a8 8 0 1 0-9 8h2a2 2 0 0 0 1-4 2 2 0 0 1 2-3h2a2 2 0 0 0 2-1ZM7 9h.01M10 6h.01M15 7h.01M6 13h.01',world:'M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 23a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 7l6 4M15 14l-6 5M6 8v9',moments:'M3 6h4l2-3h6l2 3h4v15H3V6Zm13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'};
  const symbol=key=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${symbols[({pulse:'home',friends:'people',room:'profile',crews:'talanoa',circles:'talanoa',connections:'world'})[key]||key]||symbols.home}"/></svg>`;
  function heroVisual(w,key){return w.photo?`<img src="${w.photo}" class="${w.photo===photos.social?'sx-world-social':''}" ${w.photo===photos.social?'srcset="/assets/social-sunset-20261104/friends-guitar-768.webp 768w, /assets/social-sunset-20261104/friends-guitar-1536.webp 1536w" sizes="(max-width:760px) calc(100vw - 48px), 500px"':''} alt="${w.photo===photos.social?'Illustrative scene of four friends chatting while one plays guitar on a veranda at sunset':''}" width="768" height="512" decoding="async"><span aria-hidden="true">${esc(w.label)}<i>Make it yours.</i></span>`:`<div class="sx-world-art" aria-hidden="true">${symbol(key)}<span>${esc(w.label)}</span></div>`;}
  let session=null;
  function move(node,parent){if(!node||!parent||node.parentNode===parent)return;if(typeof parent.moveBefore==='function'&&node.isConnected&&parent.isConnected){try{parent.moveBefore(node,null);return;}catch(_){}}parent.append(node);}
  function memberRouteFromHash(hash){const key=String(hash||'').replace(/^#/,'');if(key.startsWith('view=')){const p=key.slice(5);return memberPages.includes(p)?p:null;}return ({'':'pulse',home:'pulse',people:'friends',talanoa:'crews',music:'music',profile:'room',skins:'room',world:'connections'})[key]||null;}
  function action(w){if(w.member)return `<button type="button" class="sx-world-primary" data-world-member="${w.member}">${esc(w.action)} <span aria-hidden="true">↗</span></button>`;if(w.tool)return `<button type="button" class="sx-world-primary" data-world-tool="${w.tool}">${esc(w.action)} <span aria-hidden="true">↗</span></button>`;return `<button type="button" class="sx-world-primary" data-world-focus="${esc(w.focus||'')}">${esc(w.action||'Explore')} <span aria-hidden="true">↗</span></button>`;}
  function toolbar(member=false){return `<nav class="sx-world-toolbar" aria-label="Page tools"><div class="sx-world-crumb"><${member?'button type="button" data-world-member="pulse"':'a href="#home"'}>Home</${member?'button':'a'}><span aria-hidden="true">/</span><span data-world-label></span></div><div><button type="button" data-world-tool="explore" aria-haspopup="dialog">Explore Sota Kece <span aria-hidden="true">✦</span></button><button type="button" data-world-tool="design" aria-haspopup="dialog">Design this page <span aria-hidden="true">✎</span></button></div></nav>`;}
  function banner(w,member=false,key='home'){return `${toolbar(member)}<section class="sx-world-hero" data-world-tone="${w.tone}"><div class="sx-world-hero-copy"><span class="sx-eyebrow">YOUR PEOPLE. YOUR POSSIBILITIES.</span><h1 tabindex="-1">${esc(w.title)}</h1><p data-world-description>${esc(w.line)}</p><div class="sx-world-actions" data-world-actions>${action(w)}</div></div><div class="sx-world-hero-photo">${heroVisual(w,key)}</div></section>`;}
  function destinationCard(key,member=false){const w=worlds[key];return `<${member?'button type="button" data-world-member="'+key+'"':'a href="#'+key+'"'} class="sx-world-card" data-world-tone="${w.tone}"><span class="sx-world-card-art" aria-hidden="true">${symbol(key)}</span><span class="sx-world-card-copy"><small>EXPLORE YOUR WORLD</small><strong>${esc(w.label)}</strong><span>${esc(w.line)}</span><b aria-hidden="true">↗</b></span></${member?'button':'a'}>`;}
  function recommendations(page,member=false){const pages=member?({pulse:['moments','crews','room'],moments:['room','music','friends'],friends:['connections','crews','room'],crews:['circles','music','connections'],circles:['crews','music','friends'],room:['music','friends','moments'],music:['room','crews','moments'],connections:['friends','crews','room']}[page]||['room','music','friends']):({people:['world','talanoa','profile'],talanoa:['people','music','profile'],music:['profile','skins','talanoa'],profile:['skins','music','world'],skins:['profile','music','people'],world:['people','talanoa','profile']}[page]||[]);return `<section class="sx-world-next" aria-label="Keep exploring"><header><div><span class="sx-eyebrow">THERE’S MORE TO YOUR WORLD</span><h2>Where to next?</h2></div><button type="button" data-world-tool="explore">Explore everything <span aria-hidden="true">↗</span></button></header><div>${pages.map(p=>destinationCard(p,member)).join('')}</div></section>`;}
  function directory(s){if(s.directory?.isConnected)return s.directory;const d=root.document.createElement('dialog');d.className='sx-world-directory';d.setAttribute('aria-labelledby','sx-directory-title');const pages=s.member?memberPages:publicPages;d.innerHTML=`<header><div><span class="sx-eyebrow">A WORLD OF POSSIBILITIES</span><h2 id="sx-directory-title">What feels like you today?</h2></div><button type="button" data-world-close aria-label="Close Explore">×</button></header><div class="sx-world-directory-grid">${pages.map(p=>destinationCard(p,s.member)).join('')}</div><footer><button type="button" data-world-tool="studio">Room Studio</button><button type="button" data-world-tool="skins">Browse skins</button><button type="button" data-world-tool="design">Design this page</button><a href="/communications.html?app=sota-kece">Chats & calls ↗</a></footer>`;s.app.append(d);s.directory=d;d.addEventListener('close',()=>s.returnFocus?.isConnected&&s.returnFocus.focus({preventScroll:true}));return d;}
  function stop(){if(!session)return;const visual=session.app.querySelector('[data-world-home-visual] dimau-music-visualiser'),player=root.document?.querySelector('#sk-music-playlist');if(visual&&player){visual.removeAttribute('compact');move(visual,player.querySelector('[data-world-inline-visual]')||player);}session.remove.forEach(fn=>fn());session.directory?.remove();session=null;}
  function enhanceMusic(){
    const doc=root.document;let player=doc?.querySelector('#sk-music-playlist');if(!player){root.SotaPlaylist?.prepareVisual?.();player=doc?.querySelector('#sk-music-playlist');}if(!player)return;
    let now=player.querySelector('.sx-player-now');
    if(!now){now=doc.createElement('div');now.className='sx-player-now';now.setAttribute('aria-label','Now playing');player.querySelector('.sk-playlist-head')?.after(now);for(const n of [...player.children])if(n.matches('.sk-playlist-hero,audio,.sk-playlist-transport,.sk-deck,.sk-playlist-status')||n.tagName==='BUTTON')move(n,now);}
    let library=player.querySelector('.sx-player-library');
    if(!library){library=doc.createElement('details');library.className='sx-player-library';library.setAttribute('aria-label','Music library');const summary=doc.createElement('summary');summary.innerHTML='<span class="sx-library-symbol" aria-hidden="true">'+symbol('music')+'</span><span><strong><span class="sx-library-closed-label">Browse music</span><span class="sx-library-open-label">Hide music library</span></strong><small>Island Mix, your playlists and music from your device</small></span><span class="sx-library-chevron" aria-hidden="true">⌄</span>';library.append(summary);player.append(library);for(const n of [...player.children])if(n.matches('.sk-lib-host,.sk-playlist-search,.sk-playlist-queue,.sk-playlist-songs'))move(n,library);}
    let region=player.querySelector('.sx-music-visuals');
    if(region?.tagName==='DETAILS'){const old=region;region=doc.createElement('section');region.className=old.className;for(const n of [...old.children])if(n.tagName!=='SUMMARY')region.append(n);old.replaceWith(region);}
    if(!region){region=doc.createElement('section');region.className='sx-music-visuals';now.after(region);}
    region.setAttribute('aria-label','Music visuals');
    if(!region.querySelector('[data-world-inline-visual]')){const header=doc.createElement('header');header.innerHTML='<span class="sx-eyebrow">MAKE YOUR MUSIC MOVE</span><h3>Music visuals</h3><p>Choose a visual and colour. Turn it up, or go fullscreen.</p>';const host=doc.createElement('div');host.setAttribute('data-world-inline-visual','');region.prepend(header);region.append(host);}
    const section=doc.querySelector('#sota-music-home'),panel=section?.querySelector('[data-music-panel="visualiser"]');
    let stage=panel?.querySelector('[data-world-visual-stage]');if(panel&&!stage){stage=doc.createElement('div');stage.setAttribute('data-world-visual-stage','');stage.className='sx-visual-studio';stage.innerHTML='<header><span class="sx-eyebrow">YOUR SOUND, YOUR WAY</span><h2>A whole different atmosphere.</h2><p>Four visual styles. Five colour moods. One soundtrack.</p><button type="button" data-world-tool="playlist">Back to player & library ↗</button></header>';panel.append(stage);}
    const homeHost=doc.querySelector('[data-world-home-visual]');
    const visual=player.querySelector('dimau-music-visualiser')||stage?.querySelector('dimau-music-visualiser')||homeHost?.querySelector('dimau-music-visualiser');if(!visual)return;
    const atHome=!!homeHost&&section?.closest('.sx-app')?.dataset.sxPage==='home';
    if(atHome)visual.setAttribute('compact','');else visual.removeAttribute('compact');
    const target=atHome?homeHost:section?.dataset.activeMusicView==='visualiser'&&stage?stage:region.querySelector('[data-world-inline-visual]');move(visual,target);visual.wake?.();
    const oldStage=panel?.querySelector('.sk-music-stage');if(oldStage)oldStage.hidden=true;
    for(const [key,label] of [['playlist','Player & library'],['visualiser','Music visuals']]){const tab=section?.querySelector(`[data-music-view="${key}"]`);if(tab)tab.textContent=label;}
    const close=player.querySelector('.sk-playlist-close');if(close&&player.classList.contains('sk-playlist-inline'))close.hidden=true;
  }
  function mount(app,{member=false,state={},go}={}){
    stop();if(!app)return;
    app.querySelectorAll('.sx-member-world-heading,.sx-world-member-tabs,.sx-world-next,.sx-world-rail-links,.sx-world-home-tools').forEach(n=>n.remove());
    const s={app,member,go,state,remove:[],directory:null,page:member?state.tab||'pulse':app.dataset.sxPage||'home'};session=s;
    const on=(node,event,fn)=>{node.addEventListener(event,fn);s.remove.push(()=>node.removeEventListener(event,fn));};
    const heading=member?null:app.querySelector('.sx-page-heading');
    if(heading)heading.innerHTML=banner(worlds[s.page]||worlds.home,false,s.page);
    if(member){
      const view=app.querySelector('#view');if(view){const w=worlds[s.page]||worlds.room;
        const nativeHero=view.querySelector('.koro-hero,.kava-hero,.sc-heading,.sc-hero');
        const tools=root.document.createElement('div');tools.className='sx-member-world-heading';tools.innerHTML=nativeHero||s.page==='room'?toolbar(true):banner(w,true,s.page);if(s.page==='room')tools.insertAdjacentHTML('beforeend','<h1 class="sx-room-page-title">'+(state.roomHandle&&state.roomHandle!==state.me?.handle?'Their space.':'Your space.')+'</h1>');view.prepend(tools);
        const old=view.querySelector('.sx-member-heading');old?.remove();
        const tabs=root.document.createElement('nav');tabs.className='sx-world-member-tabs';tabs.setAttribute('aria-label','Your Sota Kece worlds');tabs.innerHTML=memberPages.map(p=>`<button type="button" data-world-member="${p}" aria-current="${p===s.page?'page':'false'}">${esc(worlds[p].label)}</button>`).join('');tools.before(tabs);
        view.insertAdjacentHTML('beforeend',recommendations(s.page,true));
      }
    }else{
      for(const p of publicPages.filter(p=>p!=='home'))app.querySelector(`[data-sx-page="${p}"]`)?.insertAdjacentHTML('beforeend',recommendations(p));
      const paths=app.querySelector('.sx-home-paths');paths?.insertAdjacentHTML('afterend','<div class="sx-world-home-tools"><span>Your world. Your way.</span><button type="button" data-world-tool="explore">Explore everything ✦</button><button type="button" data-world-tool="design">Design this page ✎</button></div>');
    }
    const rail=app.querySelector('.sx-rail');if(rail){const links=root.document.createElement('nav');links.className='sx-world-rail-links';links.setAttribute('aria-label','Create and explore');links.innerHTML=`<span>MAKE IT YOURS</span><button type="button" data-world-tool="studio">Room Studio <i aria-hidden="true">↗</i></button><button type="button" data-world-tool="skins">Skins & collections <i aria-hidden="true">↗</i></button><button type="button" data-world-tool="explore">Explore every world <i aria-hidden="true">✦</i></button><a href="/communications.html?app=sota-kece">Chats & calls <i aria-hidden="true">↗</i></a>`;rail.querySelector('.sx-nav')?.after(links);}
    function update(page){if(!worlds[page])return;s.page=page;app.dataset.worldPage=page;const w=worlds[page];app.querySelectorAll('[data-world-label]').forEach(n=>n.textContent=w.label);if(!heading)return;heading.querySelector('[data-world-label]').textContent=w.label;heading.querySelector('h1').textContent=w.title;heading.querySelector('.sx-world-hero').dataset.worldTone=w.tone;heading.querySelector('[data-world-description]').textContent=w.line;heading.querySelector('[data-world-actions]').innerHTML=action(w);heading.querySelector('.sx-world-hero-photo').innerHTML=heroVisual(w,page);}
    update(s.page);enhanceMusic();
    on(root,'sota-front-page-change',event=>{if(!member)update(event.detail?.view);enhanceMusic();});
    on(root.document,'sota-music-home-prepare',()=>enhanceMusic());
    on(root.document,'sota-music-home-change',()=>enhanceMusic());
    on(app,'click',event=>{
      const button=event.target.closest('[data-world-tool],[data-world-member],[data-world-focus],[data-world-close]');
      if(!button){if(event.target.closest('.sx-world-directory a'))s.directory?.close();return;}
      if(!app.contains(button))return;event.preventDefault();
      if(button.hasAttribute('data-world-close')){s.directory?.close();return;}
      if(button.dataset.worldMember){s.directory?.close();go?.(button.dataset.worldMember);return;}
      if(button.dataset.worldFocus){const target=app.querySelector(button.dataset.worldFocus);if(target){target.scrollIntoView?.({block:'center',behavior:'auto'});if(!target.matches('input,button,textarea,select,a'))target.setAttribute('tabindex','-1');target.focus?.({preventScroll:true});}return;}
      const tool=button.dataset.worldTool;
      if(tool==='circle'){app.querySelector('#bv-circle button')?.click();return;}
      if(tool==='explore'){s.returnFocus=button;directory(s).showModal();return;}
      s.directory?.close();
      if(tool==='design'){root.SotaSpaceDesign?.open(member&&s.page==='room'?'profile':s.page);return;}
      if(tool==='studio'||tool==='skins'){root.BulaSkinStudio?.open(null,tool==='skins'?'All':undefined);return;}
      if(tool==='visuals'||tool==='playlist'){
        root.SotaMusicHome?.choose('playlist');enhanceMusic();if(tool==='playlist'){const library=root.document.querySelector('.sx-player-library');if(library)library.open=true;}const target=tool==='visuals'?root.document.querySelector('.sx-music-visuals'):root.document.querySelector('#sk-playlist-filter');target?.scrollIntoView?.({block:'center',behavior:'auto'});const focus=tool==='visuals'?target?.querySelector('dimau-music-visualiser')?.shadowRoot?.querySelector('.mode'):target;focus?.focus?.({preventScroll:true});
      }
    });
    return ()=>{if(session===s)stop();};
  }
  return {mount,stop,enhanceMusic,memberRouteFromHash,worlds};
});

