/* Original outline symbols for explicit UI actions. Content cards and artwork keep their own presentation. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaIconControls=api;})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const icons={
    home:'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    music:'M9 17V5l11-2v12M9 8l11-2M9 17c0 2-2 3-4 3s-3-1-3-2.5S4 15 6 15c1 0 2 .5 3 1M20 15c0 2-2 3-4 3s-3-1-3-2.5 2-2.5 4-2.5c1 0 2 .5 3 1',
    world:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
    connect:'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a3 3 0 0 0 0-6M3 21v-3a6 6 0 0 1 12 0v3M17 13a5 5 0 0 1 4 5v3',
    design:'M20 13a8 8 0 1 0-9 8h2a2 2 0 0 0 1-4 2 2 0 0 1 2-3h2a2 2 0 0 0 2-1ZM7 9h.01M10 6h.01M15 7h.01M6 13h.01',
    back:'M19 12H5m6-6-6 6 6 6',close:'M6 6l12 12M18 6 6 18',
    play:'M8 4v16l12-8L8 4Z',pause:'M8 4v16M16 4v16',previous:'M5 5v14M19 5l-10 7 10 7V5Z',next:'M19 5v14M5 5l10 7-10 7V5Z',
    upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',save:'M5 3h12l4 4v14H3V3h2ZM7 3v6h10V3M7 21v-8h10v8',
    cancel:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 8l8 8M16 8l-8 8',
    share:'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 10l6-4M9 14l6 4',
    copy:'M8 8h13v13H8V8ZM16 4V2H2v14h2',invite:'M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 21v-3a6 6 0 0 1 12 0v3M19 8v8m-4-4h8',
    search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6',
    refresh:'M20 8a9 9 0 1 0 0 8M20 3v5h-5',reset:'M4 8a9 9 0 1 1 0 8M4 3v5h5',
    fullscreen:'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',edit:'m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15v6Z',
    signup:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 12-5M19 13v8m-4-4h8',
    signin:'M14 3h7v18h-7M3 12h13m-5-5 5 5-5 5',delete:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    view:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    undo:'M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14',
    visualiser:'M2 12h3l3-8 4 16 4-12 3 4h3',playlist:'M8 5h13M8 12h13M8 19h13M3 5h.01M3 12h.01M3 19h.01',
    colour:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',swatch:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    mix:'M15 8a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM11 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0ZM23 16a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
    friends:'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 5 5v2',
    family:'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 9 8 15 8-6 12-11 8-15Z',
    school:'m2 8 10-5 10 5-10 5L2 8ZM6 10v7c4 4 8 4 12 0v-7M22 8v10',
    work:'M3 7h18v14H3V7ZM8 7V3h8v4M3 12c6 4 12 4 18 0M10 12h4v4h-4v-4Z',
    pets:'M7 14c-4 3-2 7 1 6 3-1 5-1 8 0 3 1 5-3 1-6-3-3-7-3-10 0ZM6 7a2 3 0 1 1-4 0 2 3 0 0 1 4 0ZM12 5a2 3 0 1 1-4 0 2 3 0 0 1 4 0ZM18 5a2 3 0 1 1-4 0 2 3 0 0 1 4 0ZM23 9a2 3 0 1 1-4 0 2 3 0 0 1 4 0Z',
    nature:'M21 3C6 1 1 11 6 17s17 1 15-14ZM3 22 17 8M9 16v-5m0 5h5',
    chat:'M3 3h18v14H8l-5 5V3ZM7 8h10M7 12h7',send:'m2 3 20 9-20 9 4-9-4-9ZM6 12h16',
    heart:'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 0 9 8 15 8-6 12-11 8-15Z',
    download:'M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4',wallet:'M3 6h18v15H3V6Zm0 0V3h15v3M21 11h-6v5h6M17 13.5h.01',
    logout:'M10 3H3v18h7M12 12h10m-5-5 5 5-5 5',join:'M4 12h12m-5-5 5 5-5 5M17 3h4v18h-4',
    accept:'m4 12 5 5L20 5',up:'M12 21V3m-7 7 7-7 7 7',down:'M12 3v18m-7-7 7 7 7-7',
    left:'M21 12H3m7-7-7 7 7 7',right:'M3 12h18m-7-7 7 7-7 7',centre:'M12 2v4m0 12v4M2 12h4m12 0h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z',
    'zoom-in':'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6M6 10h8M10 6v8',
    'zoom-out':'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6M6 10h8',
    mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
    'mic-off':'m3 3 18 18M9 5a3 3 0 0 1 6 0v5M9 9v3a3 3 0 0 0 5 2M5 10v2a7 7 0 0 0 12 5M19 10v2M12 19v3M8 22h8',
    video:'M3 6h12v12H3V6Zm12 4 6-3v10l-6-3',
    'video-off':'m3 3 18 18M3 6h12v7M3 6v12h12v-3M15 10l6-3v10l-4-2',
    phone:'M5 3 2 6c0 7 9 16 16 16l3-3-5-5-3 3c-3-2-4-3-6-6l3-3-5-5Z',
    hangup:'M3 10c5-4 13-4 18 0l-1 5-5-1v-3a9 9 0 0 0-6 0v3l-5 1-1-5Z',
    screen:'M2 3h20v14H2V3ZM12 17v5m-5 0h10M12 14V6m-4 4 4-4 4 4',
    'screen-off':'M2 3h20v14H2V3ZM12 17v5m-5 0h10M8 6l8 8m0-8-8 8',
    record:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',stop:'M5 5h14v14H5V5Z',
    captions:'M2 5h20v14H2V5ZM10 9H6v6h4m8-6h-4v6h4',settings:'M3 6h18M3 12h18M3 18h18M7 3v6m10 0v6M10 15v6',
    board:'M2 3h20v18H2V3ZM9 3v18m6-18v18M4 7h3m4 0h2m4 0h3M4 11h3m4 0h3',
    lock:'M5 10h14v12H5V10Zm3 0V6a4 4 0 0 1 8 0v4M12 15v3',
    profile:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM3 22v-2a9 9 0 0 1 18 0v2',
    camera:'M3 6h4l2-3h6l2 3h4v15H3V6Zm13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    image:'M3 3h18v18H3V3Zm0 13 5-5 5 5 3-3 5 5M17 7h.01',
    add:'M12 3v18M3 12h18',blank:'M5 2h9l5 5v15H5V2Zm9 0v6h5',
    volume:'M3 9h4l6-5v16l-6-5H3V9Zm13-2c4 3 4 7 0 10m3-13c6 5 6 11 0 16',
    more:'M5 12h.01M12 12h.01M19 12h.01',emoji:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 9h.01M16 9h.01M7 14c3 4 7 4 10 0'
  };
  const rules=[
    {selector:'.sfp-navigation a.sfp-page-close',action:'close',label:'Close page'},
    {selector:'.sfp-navigation a[data-front-view]',action:node=>({home:'home',music:'music',world:'world',connect:'connect',skins:'design',profile:'edit',talanoa:'connect'}[node.dataset.frontView]||'view'),label:node=>node.dataset.frontView==='world'?'3D connections':''},
    {selector:'.bv-entry-connections a',action:node=>({friends:'friends',family:'family',school:'school',work:'work',pets:'pets',nature:'nature'}[words(node.textContent).toLowerCase()]||'connect'),label:'Explore your connections'},
    {selector:'.bv-home-section-nav a,.bv-entry-map-link,nav.bottom button[data-tab],header.top .luvchip',action:semantic,label:'Open page',dynamic:true},
    {selector:'a.sfp-back,#kc-back',action:'back',label:'Back to home'},
    {selector:'.sk-playlist-close',action:node=>node.closest('.sk-playlist-inline')?'back':'close',label:'Close music playlist'},
    {selector:'a.sfp-page-close,a.sfp-panel-close,.spp-close,.ssd-close,.ssd-feedback-close,[data-tc-close],.bv-music-dialog-head button,#bv-account-close,.bv-close,#kc-close,.sota-modal-head>button',action:'close',label:'Close panel'},
    {selector:'.ssd-launcher,.ssd-dialog-design',action:'design',label:'Design your space'},
    {selector:'[data-music-view]',action:node=>node.dataset.musicView==='playlist'?'playlist':'visualiser',label:node=>node.dataset.musicView==='playlist'?'Music playlist':'Music visualiser'},
    {selector:'.ssd-mode-tabs [data-ssd-mode]',action:node=>node.dataset.ssdMode==='one'?'colour':'mix',label:node=>node.dataset.ssdMode==='one'?'One colour':'Mix and match colours'},
    {selector:'.ssd-one-colour,.ssd-palette',action:'swatch',label:'Choose colour mood'},
    {selector:'#sk-sign-up',action:'signup',label:'Sign up'},
    {selector:'#sk-sign-in,[data-tc-sign-in]',action:'signin',label:'Sign in'},
    {selector:'#a-go',action:'signin',label:'Sign in',dynamic:true},
    {selector:'#sk-share-app,[data-tc-share]',action:'share',label:'Share'},
    {selector:'#sk-copy-invite,[data-tc-copy]',action:'copy',label:'Copy link'},
    {selector:'#sk-invite-circle',action:'invite',label:'Invite to a circle'},
    {selector:'.bv-home-search button[type="submit"],#bv-home-search button',action:'search',label:'Find a mate'},
    {selector:'.sk-playlist-transport button,#bv-local-music-play,[data-local-music-toggle]',action:'play',label:'Play music',dynamic:true},
    {selector:'[data-local-music-open],#bv-home-play,.sk-music-stage-choose',action:node=>node.matches('[data-local-music-open]')?'upload':'music',label:node=>node.matches('[data-local-music-open]')?'Upload music':'Choose music'},
    {selector:'[data-photo-save],.ssd-save,#bv-save,[data-tc-save]',action:'save',label:'Save changes'},
    {selector:'.spp-dialog [data-photo-cancel]:not(.spp-close),.ssd-cancel,#bv-cancel',action:'cancel',label:'Cancel',dynamic:true},
    {selector:'.ssd-reset,[data-lg3d-reset]',action:'reset',label:'Reset view'},
    {selector:'.ssd-text-button',action:'delete',label:'Remove image'},
    {selector:'.ssd-undo',action:'undo',label:'Undo design change'},
    {selector:'[data-friend-refresh],[data-tc-refresh]',action:'refresh',label:'Refresh'},
    {selector:'[data-tc-view]',action:'view',label:'View graph'},
    {selector:'[data-slc-edit]',action:'edit',label:'Edit connection'},
    {selector:'[data-slc-remove]',action:'delete',label:'Remove connection'},
    {selector:'[data-slc-add],.tc-create button[type="submit"]',action:'invite',label:'Add connection'},
    {selector:'[data-slc-cancel]',action:'close',label:'Close connection form'},
    {selector:'.slc-save',action:'save',label:'Save connection'},
    {selector:'[data-stage-fullscreen]',action:'fullscreen',label:'Fullscreen visualiser'},
    {selector:'[data-stage-motion],[data-slc-motion],.sk-motion-toggle',action:'pause',label:'Pause visuals',dynamic:true},
    {selector:'[data-social-refresh],#sc-refresh,#reloadGroups,#ncRefresh',action:'refresh',label:'Refresh'},
    {selector:'[data-lg3d-zoom-in],#sc-in',action:'zoom-in',label:'Zoom in'},
    {selector:'[data-lg3d-zoom-out],#sc-out',action:'zoom-out',label:'Zoom out'},
    {selector:'#sc-fit',action:'reset',label:'Reset view'},
    {selector:'#sc-back,.bv-preview-back,.bv-room-home,.sk-back',action:'back',label:'Back'},
    {selector:'.bv-studio button:not(.bv-skin-option):not(.bv-collection-card),.bv-account-dialog button,.authwrap button,.bv-skin-room-head button,.bv-discovery-all,.bv-circle-explore,.bv-cover-load,[data-choose-song],[data-cover-x],[data-profile-photo-edit]',action:semantic,label:'Open action',dynamic:true},
    {selector:'#app button.btn,#app a.btn,#app .luvbtn,.koro-text-button,.tc-button,.kava-room button,.sc-filters button,.sc-zoom button,#sc-open,#sc-find,#sc-retry,[data-friend-sign-in],.bv-music-dialog button,.sk-playlist>button,.sk-icon,.sk-quick-btn',action:semantic,label:'Open action',dynamic:true},
    {selector:'#workspace button,#workspace a.link-button,body.cr button,body.cr a.link-button,#nativeCalls button,#ncMoreToggle,.nc-sheet-close,.nc-more-btn,.nc-react,.home-link,.masthead .home-link,#signedOut>a.link-button',action:semantic,label:'Open action',dynamic:true}
  ];
  const preview='.bv-skin-option[data-skin],.bv-collection-card[data-collection]';
  const content='.sk-playlist-songs button,.bv-local-music-row,.pulse-item,.group-button,[data-circle],.tc-graph-list [data-tc-person],.sc-list button,.sc-neighbours button,.scf-list button,.lg3d-list button,.sota-social-panel,.nc-emoji,.sk-emo,.kava-room [data-tip],button[onclick^="walletTopUp"]';
  const selector=rules.map(rule=>rule.selector).join(',')+','+content+','+preview;
  const excluded='#crLobby button,#workspace .tabs button,.sx-standalone-nav button,.sk-hero-play,.sk-artwork-play,.sk-hero-create,.spp-hero-edit,.sfp-visual-link,#bv-your-room .bv-discovery-all,#bv-your-room .bv-collection-card';
  let current=null;
  const words=value=>String(value||'').replace(/\s+/g,' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').trim();
  function infer(value,fallback){
    const text=words(value).toLowerCase();
    if(/^(?:pause|stop animation)/.test(text))return 'pause';if(/^(?:play|resume|start motion)/.test(text))return 'play';
    if(/^previous/.test(text))return 'previous';if(/^next/.test(text))return 'next';if(/^close/.test(text))return 'close';if(/^cancel/.test(text))return 'cancel';
    if(/^(?:sign up|create (?:your |my |a )?(?:account|room)|make (?:your |my )?room)|\bsign up$/.test(text))return 'signup';if(/^sign in|\bsign in$/.test(text))return 'signin';
    if(/^(?:mic off|unmute)/.test(text))return 'mic-off';if(/^(?:mic on|mute)/.test(text))return 'mic';
    if(/^(?:camera off|turn camera on)/.test(text))return 'video-off';if(/^(?:camera on|turn camera off)/.test(text))return 'video';
    if(/^stop recording/.test(text))return 'stop';if(/^(?:start recording|record)/.test(text))return 'record';
    if(/^stop sharing/.test(text))return 'screen-off';if(/^(?:share screen|screen shar)/.test(text))return 'screen';
    if(/captions|transcript/.test(text))return /save|download/.test(text)?'download':'captions';
    if(/^(?:sign out|log out)/.test(text))return 'logout';if(/^back|^your circles/.test(text))return 'back';
    if(/^copy|^show meeting link/.test(text))return 'copy';if(/^share/.test(text))return 'share';if(/^invite|^offer seat|^request.*seat/.test(text))return 'invite';
    if(/^save|^saving/.test(text))return 'save';if(/^download/.test(text))return 'download';if(/^undo/.test(text))return 'undo';if(/^reset/.test(text))return 'reset';
    if(/^remove|^delete/.test(text))return 'delete';if(/^find|^search/.test(text))return 'search';if(/^refresh|^retry|^try again|reconnect/.test(text))return 'refresh';
    if(/^accept|^admit|^select|^chosen|^use this skin|^mark (?:available|done)/.test(text))return 'accept';if(/^no$|^reject|^decline/.test(text))return 'cancel';
    if(/^end.*(?:call|everyone)|^leave call|^end$/.test(text))return 'hangup';if(/^end circle/.test(text))return 'stop';
    if(/^join|^rejoin/.test(text))return 'join';if(/^video|^start video|^create.*video|^answer video|^open meeting/.test(text))return 'video';if(/voice call|audio call|callback|start audio|create.*audio|^answer audio|^open call|^take request/.test(text))return 'phone';
    if(/^send|^post|^write|^open comments/.test(text))return 'send';if(/^uro|^love/.test(text))return 'heart';
    if(/^unlock/.test(text))return 'lock';if(/^add to top|^pin/.test(text))return 'friends';if(/^ask|^add friend/.test(text))return 'invite';
    if(/^decorat|^change skin|^choose a skin|^try this skin|^explore all/.test(text))return 'design';if(/^create your own|^edit/.test(text))return 'edit';
    if(/^start blank/.test(text))return 'blank';if(/^start.*(?:circle|koro)|^create.*(?:circle|koro)|^add task/.test(text))return 'add';
    if(/^see my connections|^explore your life/.test(text))return 'world';if(/^go to koro|^return to audience/.test(text))return 'connect';
    if(/^load.*(?:image|cover|artwork)/.test(text))return 'image';if(/^preview|^view|^visit room/.test(text))return 'view';
    if(/^upload|^your music/.test(text))return 'upload';if(/^choose.*(?:song|track)|^play track/.test(text))return 'music';
    if(/^enable.*sound|^test speaker|^tap to hear/.test(text))return 'volume';if(/^more\b/.test(text))return 'more';if(/^check.*(?:camera|microphone)|^settings|^connection/.test(text))return 'settings';
    if(/^payments|^your wallet/.test(text))return 'wallet';if(/^support|^preview support/.test(text))return 'heart';
    if(/^discussion|^talanoa|^chat|^explore.*(?:talanoa|circle)/.test(text))return 'chat';if(/^board/.test(text))return 'board';if(/^profile/.test(text))return 'profile';if(/^home/.test(text))return 'home';if(/^i have an invite code/.test(text))return 'join';return fallback;
  }
  function semantic(node){
    const id=node.id||'',text=words(node.textContent),name=node.getAttribute('aria-label')||'',tab=node.dataset.tab||node.dataset.filter;
    if(tab)return {pulse:'home',moments:'camera',room:'profile',circles:'chat',crews:'connect',friends:'friends',wallet:'wallet',chat:'chat',discussions:'chat',board:'board',calls:'video',all:'connect',people:'friends',groups:'connect'}[tab]||null;
    if(node.matches('[data-cover-x]')){const x=+node.dataset.coverX,y=+node.dataset.coverY;return y===0?'up':y===100?'down':x===0?'left':x===100?'right':'centre';}
    if(node.matches('[data-preview-mode]'))return node.dataset.previewMode==='chat'?'chat':'profile';
    if(node.matches('[data-editor-mode]'))return node.dataset.editorMode==='create'?'edit':'design';
    if(node.matches('[data-choose-song]'))return node.getAttribute('aria-pressed')==='true'?'accept':'music';
    if(node.matches('[data-profile-photo-edit]'))return 'camera';
    if(id==='ncMute')return /mic off|unmute/i.test(name+' '+text)?'mic-off':'mic';
    if(id==='ncVideo')return /camera off|turn camera on/i.test(name+' '+text)?'video-off':'video';
    const ids={ncStartAudio:'phone',ncStartVideo:'video',ncCheck:'settings',ncSpeakerTest:'volume',ncJoin:'join',ncCancel:'cancel',ncMoreClose:'close',ncMoreToggle:'more',ncShare:/stop/i.test(text)?'screen-off':'screen',ncEnd:'hangup',ncLeave:'hangup',ncRecord:/stop/i.test(text)?'stop':'record',ncCaptions:'captions',ncSaveCaptions:'download',ncDownload:'download',ncResumeSound:'volume',ncAvailable:'accept',crInvite:'invite',crInvite2:'invite',crRejoin:'join',crSound:'volume',signOut:'logout',checkSession:'refresh',inviteGroup:'invite',createAudio:'phone',createVideo:'video',fGo:'signup','f-go':'signup','bv-borrow-skin':'design','bv-room-change-skin':'design','bv-room-sign-in':'signin','bv-room-home':'home','bv-start-blank':'blank','bv-reset-design':'reset','bv-undo-design':'undo','bv-remove-track':'delete','bv-remove-cover':'delete','bv-view-preview':'view','sc-open':'profile','sc-find':'friends','kc-gokoro':'connect','kc-group-invite':'invite','kc-open-chat':'chat','kc-end':'stop','kc-request':/^cancel/i.test(text)?'cancel':'invite'};
    if(Object.hasOwn(ids,id))return ids[id];
    if(node.matches('.luvchip'))return 'wallet';if(node.matches('.luvbtn'))return /delete/i.test(name)?'delete':'heart';
    if(node.matches('.sk-call,.sk-q-call'))return 'phone';if(node.matches('.sk-video,.sk-q-video'))return 'video';if(node.matches('.sk-invite'))return 'invite';if(node.matches('.sk-emoji,.nc-react'))return 'emoji';if(node.matches('.sk-send'))return 'send';if(node.matches('.nc-more-btn'))return 'more';if(node.matches('.nc-sheet-close'))return 'close';
    if(node.matches('.bv-home-section-nav a,.bv-entry-map-link,.home-link')){const hash=(node.getAttribute('href')||'').split('#')[1];return {'bv-music':'music','sota-connections':'world','bv-circle':'chat','bv-your-room':'design',home:'home',music:'music',world:'world',connect:'connect'}[hash]||'home';}
    if(node.matches('.bv-circle-explore'))return 'chat';
    const handler=node.getAttribute('onclick')||'';
    if(/exportArchive/.test(handler))return 'download';if(/openDecorate/.test(handler))return 'design';if(/giveLuv/.test(handler))return 'heart';if(/delMoment/.test(handler))return 'delete';if(/walletSend/.test(handler))return 'send';if(/manageTop/.test(handler))return /'up'/.test(handler)?'up':/'down'/.test(handler)?'down':'delete';
    return infer(text||name,null);
  }
  function symbol(action){
    const span=root.document.createElement('span');span.className='sota-control-symbol';span.setAttribute('aria-hidden','true');
    const svg=root.document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','24');svg.setAttribute('height','24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2.2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('focusable','false');svg.setAttribute('aria-hidden','true');
    const path=root.document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',icons[action]||icons.view);
    if(action==='swatch')path.setAttribute('fill','var(--one-accent,var(--swatch,currentColor))');else if(action==='colour')path.setAttribute('fill','currentColor');
    svg.append(path);span.append(svg);return span;
  }
  function restore(record){
    const {node,label,symbol:icon}=record;
    if(record.mode&&record.mode!=='icon'){if(!record.hadClass)node.classList.remove(record.mode==='preview'?'sota-glass-preview':'sota-glass-content');if(record.oldGlass===null)node.removeAttribute('data-sota-glass');else node.setAttribute('data-sota-glass',record.oldGlass);return;}
    if(label?.parentNode===node)label.replaceWith(...label.childNodes);
    if(icon?.parentNode===node)icon.remove();
    if(!record.hadClass)node.classList.remove('sota-icon-control');
    if(record.oldIcon===null)node.removeAttribute('data-sota-icon');else node.setAttribute('data-sota-icon',record.oldIcon);
    for(const [name,old,last] of [['aria-label',record.baseAria,record.lastAria],['title',record.baseTitle,record.lastTitle]])if(node.getAttribute(name)===last){if(old===null)node.removeAttribute(name);else node.setAttribute(name,old);}
  }
  function stop(){const session=current;current=null;if(!session)return;session.observer?.disconnect();session.records.forEach(restore);session.records.clear();session.pending.clear();}
  function mount(target=root.document?.body){
    stop();if(!target)return ()=>{};
    const session={target,records:new Map(),pending:new Set(),scheduled:false,observer:null};current=session;
    const inside=node=>node===target||target.contains(node);
    function material(node,mode='content'){
      const existing=session.records.get(node);if(existing?.mode===mode)return;
      if(existing){restore(existing);session.records.delete(node);}
      const className=mode==='preview'?'sota-glass-preview':'sota-glass-content';session.records.set(node,{node,mode,oldGlass:node.getAttribute('data-sota-glass'),hadClass:node.classList.contains(className)});node.classList.add(className);node.setAttribute('data-sota-glass',mode);
    }
    function enhance(node){
      if(!inside(node)||node.matches(excluded))return;
      if(node.matches(preview)){material(node,'preview');return;}if(node.matches(content)){material(node);return;}
      if(!node.matches('button,a,summary')||node.querySelector('input,select,textarea,button,a'))return;
      const rule=rules.find(item=>node.matches(item.selector));if(!rule)return;
      const rawAction=typeof rule.action==='function'?rule.action(node):rule.action;
      if(!rawAction){material(node);return;}
      let record=session.records.get(node);
      if(record?.mode&&record.mode!=='icon'){restore(record);session.records.delete(node);record=null;}
      if(!record){record={node,mode:'icon',baseAria:node.getAttribute('aria-label'),baseTitle:node.getAttribute('title'),lastAria:null,lastTitle:null,oldIcon:node.getAttribute('data-sota-icon'),hadClass:node.classList.contains('sota-icon-control'),action:''};session.records.set(node,record);}
      else{if(node.getAttribute('aria-label')!==record.lastAria)record.baseAria=node.getAttribute('aria-label');if(node.getAttribute('title')!==record.lastTitle)record.baseTitle=node.getAttribute('title');}
      const text=words(node.textContent),fallback=typeof rule.label==='function'?rule.label(node):rule.label,base=words(record.baseAria),baseAction=rawAction;
      const action=rule.dynamic?infer(text||base,baseAction):baseAction;
      let label=text||base||fallback||'Open';
      // Static actions keep the canonical accessible name supplied by their owner,
      // including shorter or equal-length route labels. Dynamic playback text wins
      // over a stale Play/Pause aria label until both describe the same state.
      if(base&&(!rule.dynamic||!text||infer(base,'')===action))label=base;
      if(node.matches('.sfp-navigation [data-front-view="world"]'))label='3D connections';
      if(node.matches('header.top .luvchip'))label='Your wallet';
      if(!record.label||record.label.parentNode!==node||node.childNodes.length!==2||record.symbol?.parentNode!==node){
        record.symbol?.remove();if(record.label?.parentNode===node)record.label.replaceWith(...record.label.childNodes);
        const wrapper=root.document.createElement('span');wrapper.className='sota-control-label';while(node.firstChild)wrapper.append(node.firstChild);node.append(wrapper);record.label=wrapper;record.symbol=symbol(action);node.prepend(record.symbol);record.action=action;
      }else if(record.action!==action){const next=symbol(action);record.symbol.replaceWith(next);record.symbol=next;record.action=action;}
      const caption=node.id==='bv-home-play'?'Choose a song':node.matches('.bv-account-dialog>.bv-link')?(action==='signup'?'Sign up':'Sign in'):label;
      if(record.label.dataset.caption!==caption)record.label.dataset.caption=caption;
      node.classList.add('sota-icon-control');if(node.getAttribute('data-sota-icon')!==action)node.setAttribute('data-sota-icon',action);
      if(node.getAttribute('aria-label')!==label)node.setAttribute('aria-label',label);record.lastAria=label;
      if(node.getAttribute('title')!==label)node.setAttribute('title',label);record.lastTitle=label;
    }
    function flush(){
      session.scheduled=false;if(current!==session)return;
      const controls=[...session.pending];session.pending.clear();controls.forEach(enhance);
      for(const [node,record] of session.records)if(!inside(node)){restore(record);session.records.delete(node);}
    }
    function enqueue(node,subtree=false){
      if(!node)return;const element=node.nodeType===1?node:node.parentElement;if(!element)return;
      const nearest=element.closest?.(selector);if(nearest&&inside(nearest))session.pending.add(nearest);
      if(subtree&&element.querySelectorAll)element.querySelectorAll(selector).forEach(control=>session.pending.add(control));
    }
    enqueue(target,true);flush();
    if(root.MutationObserver){session.observer=new root.MutationObserver(changes=>{
      if(current!==session)return;
      let removedControls=false;
      for(const change of changes){const changedElement=change.target.nodeType===1?change.target:change.target.parentElement;if(changedElement?.closest('.lg3d-label'))continue;enqueue(change.target);if(change.type==='childList'){
        change.addedNodes.forEach(node=>enqueue(node,true));
        if(!removedControls)removedControls=[...change.removedNodes].some(node=>node.nodeType===1&&(node.matches(selector)||node.querySelector(selector)));
      }}
      if((session.pending.size||removedControls)&&!session.scheduled){session.scheduled=true;root.queueMicrotask(flush);}
    });session.observer.observe(target,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title']});}
    return ()=>{if(current===session)stop();};
  }
  function init(options={}){return mount(options?.nodeType?options:options.app||root.document?.body);}
  return {init,mount,stop};
});
