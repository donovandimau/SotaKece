/* Discover the existing Sota worlds. Content, media, accounts and saved designs keep their owners. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaWorlds=api;})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const photos={social:'/assets/social-sunset-20261104/friends-guitar-clean-768.webp',music:'/assets/social-sunset-20261104/beach-singalong-768.webp',space:'/assets/social-sunset-20261104/garden-catchup-768.webp'};
  const worlds={
    home:{label:'Home',title:'A little closer to your people.',line:'Your people, music and space, together.',tone:'sun',photo:null},
    people:{label:'People',title:'Good people. Great connections.',line:'Find a familiar face. Bring your friends. See your world grow.',tone:'rose',photo:photos.social,action:'Find a mate',focus:'#bv-find-mate,#s-q'},
    talanoa:{label:'Talanoa',title:'Pull up a seat. Stay a while.',line:'Your stories, your circles and a little time together.',tone:'coral',photo:photos.social,action:'Explore a circle',tool:'circle'},
    music:{label:'Music',title:'Your music. In full colour.',line:'Choose your soundtrack, remix the visuals and make the moment yours.',tone:'violet',photo:photos.music,compact:true},
    profile:{label:'My space',title:'A world with your name on it.',line:'Your look, your people, your soundtrack. Make every detail feel like you.',tone:'lilac',photo:photos.space,action:'Open Room Studio',tool:'studio',sere:true},
    skins:{label:'Skins & Room Studio',title:'Your space. Your choice.',line:'Browse colours, artwork and layouts, or create your own.',tone:'sun',photo:null,action:'Browse every skin',tool:'skins'},
    world:{label:'3D world',title:'Every connection has a story.',line:'Explore your people and places from a different perspective.',tone:'lime',photo:null,action:'Explore the map',focus:'#sota-connections'},
    pulse:{label:'Your feed',title:'A little closer, every day.',line:'Catch up with your people. Share a thought. Start a conversation.',tone:'rose',photo:null,action:'Share a moment',member:'moments',sere:true},
    moments:{label:'Moments',title:'Little moments. Yours to keep.',line:'The good days, everyday stories and memories worth sharing.',tone:'sun',photo:null,action:'Share a moment',focus:'#m-body'},
    friends:{label:'Friends',title:'Good people. Great connections.',line:'Keep your circle close. Find a mate, visit a room and catch up.',tone:'rose',photo:photos.social,action:'Find a friend',focus:'#s-q'},
    room:{label:'My space',title:'A world with your name on it.',line:'Your look, your people, your soundtrack. Make every detail feel like you.',tone:'lilac',photo:photos.space,action:'Open Room Studio',tool:'studio',sere:true},
    crews:{label:'Your Koro',title:'Your people. Your Koro.',line:'Private groups for the people you want to bring together.',tone:'coral',photo:photos.social,action:'Start a Koro',focus:'#koro-create input'},
    circles:{label:'Talanoa circles',title:'A place for every voice.',line:'Familiar voices, fresh stories and space for your circle.',tone:'coral',photo:photos.social,action:'Explore your circles',focus:'#kc-retry,.kava-room button'},
    connections:{label:'Your connections',title:'Every connection has a story.',line:'Discover the friendships and Koro that make up your world.',tone:'lime',photo:null,action:'Explore the map',focus:'#sc-search,.sc-map,#sota-connections'}
  };
  const publicPages=['home','people','talanoa','music','profile','skins','world'];
  const memberPages=['pulse','moments','friends','crews','circles','room','music','connections'];
  // The pill strip only lists the worlds that belong to the active dock tab. Home and Talanoa both
  // land on the wall, so that cluster shares one strip; Music and My space have nothing to add and show none.
  const tabGroups={pulse:['pulse','moments','crews','circles'],moments:['pulse','moments','crews','circles'],crews:['pulse','moments','crews','circles'],circles:['pulse','moments','crews','circles'],friends:['friends','connections'],connections:['friends','connections'],music:[],room:[]};
  const choices={
    pulse:{
      label:'What are you sharing?',
      options:[
        ['life','Your life','What’s happening in your life today?'],
        ['message','Your message','What would you like to say to your friends?'],
        ['faith','Your faith','Share a thought, prayer or moment of gratitude.'],
        ['family','Your family','What’s new with your family?'],
        ['community','Your community','What’s happening in your community?']
      ]
    },
    moments:{
      label:'What kind of moment?',
      options:[
        ['everyday','Everyday life','What small moment would you like to remember?'],
        ['milestone','Milestones','What milestone did you reach?'],
        ['family','Family memories','Tell a story about a moment with family.'],
        ['faith','Faith and gratitude','What are you grateful for today?'],
        ['community','Community events','What brought your community together?']
      ]
    },
    friends:{
      label:'Who are you looking for?',
      options:[
        ['family','Family','Find a relative by handle'],
        ['school','Schoolmates','Find a schoolmate by handle'],
        ['work','Workmates','Find a workmate by handle'],
        ['local','Neighbours','Find a neighbour by handle'],
        ['overseas','Friends overseas','Find a friend overseas by handle']
      ]
    },
    crews:{
      label:'Who is your Koro for?',
      options:[
        ['yasana','Your yasana','Name your provincial Koro','koro'],
        ['mataqali','Your mataqali','Name your mataqali circle','mataqali'],
        ['island','Your island','Name your island Koro','koro'],
        ['village','Your village','Name your village Koro','koro'],
        ['family','Your family','Name your family circle','family']
      ]
    },
    circles:{
      label:'How do you want to gather?',
      action:'Start a circle',
      options:[['kava','Kava session'],['lotu','Lotu and faith'],['music','Sigidrigi and music'],['family','Family talanoa'],['tale','Catch up with friends']]
    },
    room:{
      label:'What’s your room style?',
      action:'Preview this skin',
      options:[['lagoon','Lagoon Club'],['studio-masi','Masi'],['kula','Kula Classic'],['sunset','Golden Hour'],['midnight','Midnight Mixtape']]
    },
    connections:{
      label:'How do you want to explore?',
      action:'Open this map view',
      options:[['all','Everyone'],['people','Friends only'],['groups','Koro only'],['search','Search names'],['summary','Connection summary']]
    }
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const symbols={home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',talanoa:'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5ZM7 10h10M7 14h6',music:'M9 18V5l12-2v13M9 8l12-2M9 18a3 2 0 1 1-6 0 3 2 0 0 1 6 0M21 16a3 2 0 1 1-6 0 3 2 0 0 1 6 0',profile:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 22v-2a8 8 0 0 1 16 0v2',skins:'M20 13a8 8 0 1 0-9 8h2a2 2 0 0 0 1-4 2 2 0 0 1 2-3h2a2 2 0 0 0 2-1ZM7 9h.01M10 6h.01M15 7h.01M6 13h.01',world:'M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 23a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 7l6 4M15 14l-6 5M6 8v9',moments:'M3 6h4l2-3h6l2 3h4v15H3V6Zm13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z'};
  const symbol=key=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${symbols[({pulse:'home',friends:'people',room:'profile',crews:'talanoa',circles:'talanoa',connections:'world'})[key]||key]||symbols.home}"/></svg>`;
  function heroVisual(w,key){
    if(!w.photo)return `<div class="sx-world-art" aria-hidden="true">${symbol(key)}<span>${esc(w.label)}</span></div>`;
    const alt=w.photo===photos.social?'Illustrative scene of four friends chatting while one plays guitar on a veranda at sunset':w.photo===photos.music?'Illustrative scene of happy young adult friends singing with a guitar on a beach at sunset':'Illustrative scene of happy young adult friends chatting in a Fijian garden at sunset';
    return `<img src="${w.photo}" class="${w.photo===photos.social?'sx-world-social':''}" srcset="${w.photo} 768w, ${w.photo.replace('-768.webp','-1536.webp')} 1536w" sizes="(max-width:760px) calc(100vw - 48px), 500px" alt="${alt}" width="768" height="512" decoding="async"><span aria-hidden="true">${esc(w.label)}<i>Make it yours.</i></span>`;
  }
  const lightsToggle='<button type="button" class="sx-lights-toggle" data-sota-lights-toggle aria-pressed="true">Page lights: On</button>';
  function homeListening(){
    return `<section class="sx-home-listen" aria-labelledby="sx-home-listen-title">
      <header><h2 id="sx-home-listen-title">Music visuals</h2><button type="button" class="sx-world-primary" data-world-member="music">Open Music ↗</button></header>
      <div class="sx-home-visuals" data-world-home-visual aria-label="Music visualiser"></div>
    </section>`;
  }
  let session=null;
  function move(node,parent){if(!node||!parent||node.parentNode===parent)return;if(typeof parent.moveBefore==='function'&&node.isConnected&&parent.isConnected){try{parent.moveBefore(node,null);return;}catch(_){}}parent.append(node);}
  function memberRouteFromHash(hash){const key=String(hash||'').replace(/^#/,'');if(key.startsWith('view=')){const p=key.slice(5);return memberPages.includes(p)?p:null;}return ({'':'pulse',home:'pulse',people:'friends',talanoa:'crews',music:'music',profile:'room',skins:'room',world:'connections'})[key]||null;}
  function sereButton(w){return w.sere&&typeof window!=='undefined'&&window.SotaSere?` <button type="button" class="sx-world-secondary sx-world-sere" data-world-sere="1">🎤 Make a photo sing</button>`:'';}
  function action(w){return w.compact?'':actionMain(w)+sereButton(w);}
  function actionMain(w){if(w.member)return `<button type="button" class="sx-world-primary" data-world-member="${w.member}">${esc(w.action)} <span aria-hidden="true">↗</span></button>`;if(w.tool)return `<button type="button" class="sx-world-primary" data-world-tool="${w.tool}">${esc(w.action)} <span aria-hidden="true">↗</span></button>`;return `<button type="button" class="sx-world-primary" data-world-focus="${esc(w.focus||'')}">${esc(w.action||'Explore')} <span aria-hidden="true">↗</span></button>`;}
  function toolbar(member=false){return `<nav class="sx-world-toolbar" aria-label="Page tools"><div class="sx-world-crumb"><${member?'button type="button" data-world-member="pulse"':'a href="#home"'}>Home</${member?'button':'a'}><span aria-hidden="true">/</span><span data-world-label></span></div><div><button type="button" data-world-tool="explore" aria-haspopup="dialog">Explore Sota Kece <span aria-hidden="true">✦</span></button><button type="button" data-world-tool="design" aria-haspopup="dialog">Design this page <span aria-hidden="true">✎</span></button></div></nav>`;}
  function banner(w,member=false,key='home'){return `${toolbar(member)}<section class="sx-world-hero${w.compact?' sx-world-hero-compact':''}" data-world-tone="${w.tone}"><div class="sx-world-hero-copy"><span class="sx-eyebrow">YOUR PEOPLE. YOUR POSSIBILITIES.</span><h1 tabindex="-1">${esc(w.title)}</h1><p data-world-description>${esc(w.line)}</p><div class="sx-world-actions" data-world-actions>${action(w)}</div></div><div class="sx-world-hero-photo">${heroVisual(w,key)}</div></section>`;}
  function destinationCard(key,member=false,photo){
    const w=worlds[key];
    const target=member?'button type="button" data-world-member="'+key+'"':'a href="#'+key+'"';
    const artwork=photo
      ? `<img src="${photo}" alt="" loading="lazy" decoding="async">`
      : `<span class="sx-world-card-art" aria-hidden="true">${symbol(key)}</span>`;
    return `<${target} class="sx-world-card${photo?' sx-world-card-photo':''}" data-world-tone="${w.tone}">${artwork}<span class="sx-world-card-copy"><small>EXPLORE YOUR WORLD</small><strong>${esc(w.label)}</strong><span>${esc(w.line)}</span><b aria-hidden="true">↗</b></span></${member?'button':'a'}>`;
  }
  // New or returning: a member is greeted by name. The first visit on this device
  // points at one thing to do; later visits say welcome back.
  const visits={};
  function firstName(state){return String(state?.me?.display_name||'').trim().split(/\s+/)[0].slice(0,24);}
  function seenBefore(id){try{const key='sota.seen.'+id,had=!!root.localStorage.getItem(key);root.localStorage.setItem(key,String(Date.now()));root.localStorage.setItem('sota.known','1');return had;}catch{return true;}}
  function knownVisitor(){try{return root.localStorage.getItem('sota.known')==='1';}catch{return false;}}
  function greet(tools,state){
    const title=tools.querySelector('.sx-world-hero h1'),line=tools.querySelector('.sx-world-hero [data-world-description]'),eyebrow=tools.querySelector('.sx-world-hero .sx-eyebrow');
    if(!title||!state?.user?.id)return;
    const name=firstName(state),returning=visits[state.user.id]??(visits[state.user.id]=seenBefore(state.user.id));
    tools.querySelector('.sx-world-hero').dataset.worldVisit=returning?'returning':'first';
    if(returning){title.textContent=name?`Welcome back, ${name}.`:'Welcome back.';return;}
    if(eyebrow)eyebrow.textContent=name?`BULA, ${name.toUpperCase()}. YOU’RE IN.`:'BULA. YOU’RE IN.';
    title.textContent='Start with one small moment.';
    if(line)line.textContent='Share a photo, a thought or a song. Your friends will see it in their feed.';
  }
  function welcomeBack(app){
    const primary=app.querySelector('.sx-hero .sx-actions [data-sx-auth="up"]'),small=app.querySelector('.sx-hero-copy small');
    if(!primary||!knownVisitor())return;
    primary.dataset.sxAuth='in';primary.innerHTML='Welcome back · Sign in <span aria-hidden="true">↗</span>';
    const other=small?.querySelector('[data-sx-auth="in"]');
    if(other){other.dataset.sxAuth='up';other.textContent='Create your space';small.firstChild.textContent='New here? ';}
  }
  function choiceKey(s,page){return 'sota.world-choice.'+s.state.user.id+'.'+page;}
  function chosen(s,page){
    if(!s?.state.user?.id||!choices[page])return null;
    try{
      const id=root.localStorage.getItem(choiceKey(s,page));
      return choices[page].options.find(option=>option[0]===id)||null;
    }catch{return null;}
  }
  function choiceMenu(s,page,inDirectory=false){
    const group=choices[page],current=chosen(s,page);
    const options=group.options.map(([id,label])=>`<option value="${id}"${current?.[0]===id?' selected':''}>${esc(label)}</option>`).join('');
    const menu=`<div class="sx-world-choice${inDirectory?' sx-world-choice-compact':''}">
      <label><span>${esc(group.label)}</span><select data-world-choice="${page}"><option value="">Choose a starting point</option>${options}</select></label>
      ${!inDirectory&&group.action?`<button type="button" data-world-choice-action="${page}"${current?'':' disabled'}>${esc(group.action)}</button>`:''}
    </div>`;
    // On the page itself the ideas menu stays folded away until asked for, so the
    // hero keeps one clear action. It opens by itself once a choice has been made.
    return inDirectory?menu:`<details class="sx-world-more"${current?' open':''}><summary>Need an idea? <span>Pick a starting point</span></summary>${menu}</details>`;
  }
  function applyChoice(s=session){
    if(!s?.member)return;
    const page=s.page,selection=chosen(s,page);
    const input=s.app.querySelector(({pulse:'#p-text',moments:'#m-body',friends:'#s-q',crews:'#koro-create [data-tc-name]'})[page]||'[data-sx-no-choice-input]');
    if(input){
      if(input.dataset.worldOriginalPrompt===undefined)input.dataset.worldOriginalPrompt=input.placeholder;
      input.placeholder=selection?.[2]??input.dataset.worldOriginalPrompt;
    }
    if(page==='crews'&&selection){
      const type=s.app.querySelector('#koro-create [data-tc-type]');
      if(type&&[...type.options].some(option=>option.value===selection[3])){
        type.value=selection[3];
        type.dispatchEvent(new root.Event('change',{bubbles:true}));
      }
    }
  }
  function openChoice(s,page){
    const option=chosen(s,page);
    if(!option)return;
    const [id]=option;
    if(page==='circles'){root.SotaCircles?.openInvite(null,{type:id});return;}
    if(page==='room'){root.BulaSkinStudio?.open({id});return;}
    if(page!=='connections')return;
    const target=s.app.querySelector(({search:'#sc-search',summary:'#sc-visual-summary'})[id]||`.sc-filters [data-filter="${id}"]`);
    if(!target)return;
    if(id==='summary')target.open=true;
    else if(id!=='search')target.click();
    target.scrollIntoView?.({block:'center'});
    (id==='summary'?target.querySelector('summary'):target)?.focus?.({preventScroll:true});
  }
  function directory(s){if(s.directory?.isConnected)return s.directory;const d=root.document.createElement('dialog');d.className='sx-world-directory';d.setAttribute('aria-labelledby','sx-directory-title');const pages=s.member?memberPages:publicPages;d.innerHTML=`<header><div><span class="sx-eyebrow">A WORLD OF POSSIBILITIES</span><h2 id="sx-directory-title">What feels like you today?</h2></div><button type="button" data-world-close aria-label="Close Explore">×</button></header><div class="sx-world-directory-grid">${pages.map(p=>s.member?`<div class="sx-world-directory-tile">${destinationCard(p,true)}${choices[p]?choiceMenu(s,p,true):''}</div>`:destinationCard(p,false)).join('')}</div><footer><button type="button" data-world-tool="studio">Room Studio</button><button type="button" data-world-tool="skins">Browse skins</button><button type="button" data-world-tool="design">Design this page</button><a href="/communications.html?app=sota-kece">Chats & calls ↗</a></footer>`;s.app.append(d);s.directory=d;d.addEventListener('close',()=>s.returnFocus?.isConnected&&s.returnFocus.focus({preventScroll:true}));return d;}
  function stop(){if(!session)return;const visual=session.app.querySelector('[data-world-home-visual] dimau-music-visualiser'),player=root.document?.querySelector('#sk-music-playlist');if(visual&&player){visual.removeAttribute('compact');move(visual,player.querySelector('[data-world-inline-visual]')||player);}session.remove.forEach(fn=>fn());session.directory?.remove();session=null;}
  function enhanceMusic(){
    const doc=root.document;let player=doc?.querySelector('#sk-music-playlist');if(!player){root.SotaPlaylist?.prepareVisual?.();player=doc?.querySelector('#sk-music-playlist');}if(!player)return;
    let now=player.querySelector('.sx-player-now');
    if(!now){now=doc.createElement('div');now.className='sx-player-now';now.setAttribute('aria-label','Now playing');player.querySelector('.sk-playlist-head')?.after(now);for(const n of [...player.children])if(n.matches('.sk-playlist-hero,audio,.sk-playlist-transport,.sk-deck,.sk-playlist-status')||n.tagName==='BUTTON')move(n,now);}
    // The track list is the page's main content: always open, beside the player.
    let library=player.querySelector('.sx-player-library');
    if(!library){library=doc.createElement('section');library.className='sx-player-library';library.setAttribute('aria-label','Music library');player.append(library);for(const n of [...player.children])if(n.matches('.sk-lib-host,.sk-playlist-search,.sk-playlist-queue,.sk-playlist-songs'))move(n,library);}
    if(!now.querySelector('[data-world-sere]')&&root.SotaSere){const sing=doc.createElement('button');sing.type='button';sing.className='sx-player-sere';sing.setAttribute('data-world-sere','1');sing.textContent='🎤 Make a photo sing';now.append(sing);}
    let region=player.querySelector('.sx-music-visuals');
    if(region?.tagName==='DETAILS'){const old=region;region=doc.createElement('section');region.className=old.className;for(const n of [...old.children])if(n.tagName!=='SUMMARY')region.append(n);old.replaceWith(region);}
    if(!region){region=doc.createElement('section');region.className='sx-music-visuals';now.after(region);}
    region.setAttribute('aria-label','Music visuals');
    if(!region.querySelector('[data-world-inline-visual]')){const header=doc.createElement('header');header.innerHTML='<span class="sx-eyebrow">MAKE YOUR MUSIC MOVE</span><h3>Music visuals</h3><p>Choose a visual style and colour. Page lights respond to the playing track.</p>'+lightsToggle;const host=doc.createElement('div');host.setAttribute('data-world-inline-visual','');region.prepend(header);region.append(host);}
    // One view: player, visuals and library share the card, so the old two-tab bar is retired.
    const section=doc.querySelector('#sota-music-home'),tabs=section?.querySelector('.sota-music-view-tabs'),panel=section?.querySelector('[data-music-panel="playlist"]');
    if(tabs)tabs.hidden=true;
    if(panel){panel.setAttribute('role','region');panel.setAttribute('aria-label','Player and library');panel.removeAttribute('aria-labelledby');}
    root.SotaMusicBadge?.updateControls?.();
    const homeHost=session?.app.querySelector('[data-world-home-visual]');
    const visual=player.querySelector('dimau-music-visualiser')||homeHost?.querySelector('dimau-music-visualiser');if(!visual)return;
    const atHome=!!homeHost&&(session.member?session.page==='pulse':session.app.dataset.sxPage==='home');
    if(atHome)visual.setAttribute('compact','');else visual.removeAttribute('compact');
    const target=atHome?homeHost:region.querySelector('[data-world-inline-visual]');move(visual,target);visual.wake?.();
    const close=player.querySelector('.sk-playlist-close');if(close&&player.classList.contains('sk-playlist-inline'))close.hidden=true;
  }
  function mount(app,{member=false,state={},go}={}){
    stop();if(!app)return;
    app.querySelectorAll('.sx-member-world-heading,.sx-world-member-tabs,.sx-world-next,.sx-world-rail-links,.sx-world-home-tools,.sx-home-listen').forEach(n=>n.remove());
    const s={app,member,go,state,remove:[],directory:null,page:member?state.tab||'pulse':app.dataset.sxPage||'home'};session=s;
    const on=(node,event,fn)=>{node.addEventListener(event,fn);s.remove.push(()=>node.removeEventListener(event,fn));};
    const heading=member?null:app.querySelector('.sx-page-heading');
    if(heading)heading.innerHTML=banner(worlds[s.page]||worlds.home,false,s.page);
    if(member){
      const view=app.querySelector('#view');if(view){const w=worlds[s.page]||worlds.room;
        const nativeHero=view.querySelector('.koro-hero,.kava-hero,.sc-heading,.sc-hero');
        const tools=root.document.createElement('div');
        tools.className='sx-member-world-heading';
        tools.innerHTML=nativeHero||s.page==='room'?toolbar(true):banner(w,true,s.page);
        if(s.page==='room'){
          const visiting=state.roomHandle&&state.roomHandle!==state.me?.handle;
          tools.insertAdjacentHTML('beforeend','<h1 class="sx-room-page-title">'+(visiting?'Their space.':'Your space.')+'</h1>');
          const portrait=visiting?'':root.BulaSkinStudio?.showcasePortrait?.();
          if(portrait)tools.insertAdjacentHTML('beforeend',`<section class="sx-sema-showcase" aria-labelledby="sx-sema-title">
            <div class="sx-sema-portrait">${portrait}</div>
            <div><span class="sx-eyebrow">MY SPACE SHOWCASE</span><h2 id="sx-sema-title">Sema’s space</h2>
              <p>See how Sema makes her room her own, from the skin to the soundtrack.</p>
              <button type="button" class="sx-world-primary" data-world-tool="studio">Try Room Studio ↗</button>
            </div>
          </section>`);
        }
        if(state.user?.id&&choices[s.page]&&!(s.page==='room'&&state.roomHandle&&state.roomHandle!==state.me?.handle)&&!(s.page==='crews'&&state.crew)){
          tools.insertAdjacentHTML('beforeend',choiceMenu(s,s.page));
        }
        view.prepend(tools);
        if(s.page==='pulse')greet(tools,state);
        const old=view.querySelector('.sx-member-heading');old?.remove();
        const group=tabGroups[s.page]||[];if(group.length>1){const tabs=root.document.createElement('nav');tabs.className='sx-world-member-tabs';tabs.setAttribute('aria-label','Your Sota Kece worlds');tabs.innerHTML=group.map(p=>`<button type="button" data-world-member="${p}" aria-current="${p===s.page?'page':'false'}">${esc(worlds[p].label)}</button>`).join('');tools.before(tabs);const current=tabs.querySelector('[aria-current="page"]');if(current&&tabs.scrollWidth>tabs.clientWidth)tabs.scrollLeft=Math.max(0,current.offsetLeft-(tabs.clientWidth-current.offsetWidth)/2);}
        if(s.page==='pulse'){const wall=[...view.children].find(n=>n.classList?.contains('tw-wrap'));(wall||tools).insertAdjacentHTML('afterend',homeListening());}
      }
    }else{
      welcomeBack(app);
      const paths=app.querySelector('.sx-home-paths');paths?.insertAdjacentHTML('afterend','<div class="sx-world-home-tools"><span>Your world. Your way.</span><button type="button" data-world-tool="explore">Explore everything ✦</button><button type="button" data-world-tool="design">Design this page ✎</button></div>');
    }
    const rail=app.querySelector('.sx-rail');if(rail){const links=root.document.createElement('nav');links.className='sx-world-rail-links';links.setAttribute('aria-label','Create and explore');links.innerHTML=`<span>MAKE IT YOURS</span><button type="button" data-world-tool="studio">Room Studio <i aria-hidden="true">↗</i></button><button type="button" data-world-tool="skins">Skins & collections <i aria-hidden="true">↗</i></button><button type="button" data-world-tool="explore">Explore every world <i aria-hidden="true">✦</i></button><a href="/communications.html?app=sota-kece">Chats & calls <i aria-hidden="true">↗</i></a>`;rail.querySelector('.sx-nav')?.after(links);}
    function update(page){if(!worlds[page])return;s.page=page;app.dataset.worldPage=page;const w=worlds[page];app.querySelectorAll('[data-world-label]').forEach(n=>n.textContent=w.label);if(!heading)return;heading.querySelector('[data-world-label]').textContent=w.label;heading.querySelector('h1').textContent=w.title;heading.querySelector('.sx-world-hero').dataset.worldTone=w.tone;heading.querySelector('.sx-world-hero').classList.toggle('sx-world-hero-compact',!!w.compact);heading.querySelector('[data-world-description]').textContent=w.line;heading.querySelector('[data-world-actions]').innerHTML=action(w);heading.querySelector('.sx-world-hero-photo').innerHTML=heroVisual(w,page);}
    update(s.page);enhanceMusic();
    if(s.page!=='crews')applyChoice(s);
    on(root,'sota-front-page-change',event=>{if(!member)update(event.detail?.view);enhanceMusic();});
    on(root.document,'sota-music-home-prepare',()=>{enhanceMusic();applyChoice(s);});
    on(root.document,'sota-music-home-change',()=>enhanceMusic());
    on(app,'change',event=>{
      const select=event.target.closest('[data-world-choice]');
      const page=select?.dataset.worldChoice;
      if(!page||!s.state.user?.id||!choices[page])return;
      const option=choices[page].options.find(choice=>choice[0]===select.value);
      try{
        if(option)root.localStorage.setItem(choiceKey(s,page),option[0]);
        else root.localStorage.removeItem(choiceKey(s,page));
      }catch{}
      app.querySelectorAll(`[data-world-choice="${page}"]`).forEach(control=>control.value=option?.[0]||'');
      app.querySelectorAll(`[data-world-choice-action="${page}"]`).forEach(control=>control.disabled=!option);
      if(s.page===page)applyChoice(s);
    });
    on(app,'click',event=>{
      const sere=event.target.closest('[data-world-sere]');if(sere&&app.contains(sere)){event.preventDefault();window.SotaSere?.open();return;}
      const button=event.target.closest('[data-world-tool],[data-world-member],[data-world-focus],[data-world-close],[data-world-choice-action]');
      if(!button){if(event.target.closest('.sx-world-directory a'))s.directory?.close();return;}
      if(!app.contains(button))return;event.preventDefault();
      if(button.dataset.worldChoiceAction){openChoice(s,button.dataset.worldChoiceAction);return;}
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
        root.SotaMusicHome?.choose('playlist');enhanceMusic();const target=tool==='visuals'?root.document.querySelector('.sx-music-visuals'):root.document.querySelector('#sk-playlist-filter');target?.scrollIntoView?.({block:'center',behavior:'auto'});const focus=tool==='visuals'?target?.querySelector('dimau-music-visualiser')?.shadowRoot?.querySelector('.mode'):target;focus?.focus?.({preventScroll:true});
      }
    });
    return ()=>{if(session===s)stop();};
  }
  return {mount,stop,enhanceMusic,applyChoice,memberRouteFromHash,worlds};
});

