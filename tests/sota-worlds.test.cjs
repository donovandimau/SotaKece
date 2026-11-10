'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const browserTest=(name,fn)=>test(name,{skip:!JSDOM?'Install jsdom to verify discovery ownership and navigation':false},fn);
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(t){
 const dom=new JSDOM('<!doctype html><div id="app"><header class="bv-connect-header"><div class="bv-entry-account-actions"><button id="sk-sign-up">Join</button><button id="sk-sign-in">Sign in</button></div><input id="bv-find-mate"></header><section id="sota-music-home"><div class="sota-music-view-tabs"><button data-music-view="visualiser">Visualiser</button><button data-music-view="playlist">Playlist</button></div><div data-music-panel="visualiser"><section class="sk-music-stage">Old preview</section></div><div data-music-panel="playlist" hidden><div data-music-playlist-host></div></div></section><section id="bv-circle"><button>Preview circle</button></section><section id="bv-your-room"></section><section id="sota-connections"></section><dialog id="bv-entry"></dialog><footer class="bv-classic-footer"></footer></div>',{url:'https://sotakece.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document,app=d.querySelector('#app'),calls={go:[],design:[],skins:[],play:0,pause:0,wake:0};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=w.HTMLDialogElement.prototype.show=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 const player=d.createElement('dialog');player.id='sk-music-playlist';player.className='sk-playlist sk-playlist-inline';player.innerHTML='<header class="sk-playlist-head"><h2>Music playlist</h2><button class="sk-playlist-close">Close</button></header><div class="sk-playlist-hero">Now playing</div><audio id="sota-playlist-audio"></audio><div class="sk-playlist-transport"><button>Play</button></div><dimau-music-visualiser></dimau-music-visualiser><p class="sk-playlist-status">Paused</p><div class="sk-lib-host">Your playlists</div><div class="sk-playlist-search"><input id="sk-playlist-filter" value="keep my filter"></div><div class="sk-playlist-queue">82 songs</div><ol class="sk-playlist-songs"><li>Song</li></ol>';d.body.append(player);
 const visual=player.querySelector('dimau-music-visualiser');visual.attachShadow({mode:'open'}).innerHTML='<label>Visual<select class="mode"><option value="spectrum">Spectrum</option><option value="halo">Halo</option></select></label>';visual.wake=()=>calls.wake++;player.querySelector('.sk-playlist-transport button').onclick=()=>calls.play++;
 const audio=player.querySelector('audio');audio.pause=()=>calls.pause++;
 w.SotaPlaylist={showInline(host){host.append(player);player.open=true;return player;},hideInline(){player.open=false;d.body.append(player);},detachInline(){player.open=false;d.body.append(player);},pause:()=>calls.pause++};
 w.SotaSpaceDesign={open:p=>calls.design.push(p)};w.BulaSkinStudio={open:(...args)=>calls.skins.push(args)};
 for(const file of ['sota-worlds.js','music-home.js','sota-experience.js'])w.eval(source(file));w.SotaMusicHome.mount(app);w.SotaExperience.init({go:p=>calls.go.push(p)});w.SotaExperience.mountGuest(app,{roomMarkup:'<p>Example room</p>'});
 t.after(()=>{w.SotaExperience.stop();w.close();});return {w,d,app,calls,player,visual,audio,get:s=>d.querySelector(s)};
}
browserTest('all seven guest worlds expose page design, discovery and valid related destinations',t=>{
 const h=harness(t);let previews=0;h.get('#bv-circle button').addEventListener('click',()=>previews++);const pages=['people','talanoa','music','profile','skins','world'];
 for(const page of pages){h.app.querySelector(`a[href="#${page}"]`).click();assert.equal(h.app.dataset.worldPage,page);assert.equal(h.app.querySelector('img[src*="friends-natural"]'),null);assert.equal(h.app.querySelector('img[src*="talanoa-natural"]'),null);assert.equal(h.app.querySelector('.sx-world-toolbar [data-world-label]').textContent,h.w.SotaWorlds.worlds[page].label);h.get('.sx-world-toolbar [data-world-tool="design"]').click();assert.equal(h.calls.design.at(-1),page);const panel=h.get(`.sx-panel[data-sx-page="${page}"]`);assert.equal(panel.querySelector('.sx-world-next'),null,'pages end on their own content; the rail already links every page');if(page==='talanoa'){h.get('[data-world-tool="circle"]').click();assert.equal(previews,1,'The hero opens the native circle preview');}}
});
browserTest('Explore is a working directory and skin tools open the native catalogue without saving a choice',t=>{
 const h=harness(t);h.get('.sx-world-home-tools [data-world-tool="explore"]').click();const dialog=h.get('.sx-world-directory');assert(dialog.open);assert.equal(dialog.querySelectorAll('.sx-world-card').length,7);assert.equal(dialog.querySelectorAll('img').length,0);assert.equal(new Set([...dialog.querySelectorAll('.sx-world-card-art path')].map(n=>n.getAttribute('d'))).size,7);dialog.querySelector('a[href="#music"]').click();assert.equal(h.app.dataset.sxPage,'music');assert(!dialog.open);const links=[...h.app.querySelectorAll('.sx-world-rail-links button')].map(b=>b.dataset.worldTool);assert.deepEqual(links,['studio-drawer','explore'],'one Studio entry replaces Room Studio and Skins & collections');const opened=[];h.w.SotaStudio={open:(section,options)=>opened.push([section,options?.page,options?.collection])};h.get('.sx-world-rail-links [data-world-tool="studio-drawer"]').click();h.get('.sx-world-toolbar [data-world-tool="design"]').click();assert.deepEqual(opened,[['page','music',undefined],['page','music',undefined]]);assert.equal(h.get('.sx-world-toolbar [data-world-tool="design"]').textContent.trim(),'Studio ✎');assert.equal(h.calls.skins.length,0,'the drawer, not the old dialogs, is asked');delete h.w.SotaStudio;h.get('.sx-world-rail-links [data-world-tool="studio-drawer"]').click();assert.equal(h.calls.design.at(-1),'music','without the drawer module the page editor still opens');h.w.SotaWorlds.stop();assert.equal(h.get('.sx-world-directory'),null);
});
browserTest('player, visual choices, filter and audio survive switching between music views',t=>{
 const h=harness(t);h.app.querySelector('a[href="#music"]').click();const mode=h.visual.shadowRoot.querySelector('.mode');mode.value='halo';
 assert.equal(h.get('.sx-music-visuals').tagName,'SECTION');assert(h.get('[data-world-inline-visual]').contains(h.visual));assert(h.get('.sx-player-library').contains(h.get('#sk-playlist-filter')));assert.equal(h.get('.sx-player-library').tagName,'SECTION','the track list is always open');assert.equal(h.get('.sota-music-view-tabs').hidden,true,'the two-tab bar is retired');assert(h.get('.sx-player-now').contains(h.audio));
 for(let i=0;i<3;i++){h.w.SotaWorlds.enhanceMusic();assert.equal(h.get('[data-world-visual-stage]'),null);assert(h.get('[data-world-inline-visual]').contains(h.visual));}
 h.get('.sk-playlist-transport button').click();assert.equal(h.calls.play,1);assert.equal(h.calls.pause,0);assert.equal(mode.value,'halo');assert.equal(h.get('#sk-playlist-filter').value,'keep my filter');assert.equal(h.d.querySelectorAll('dimau-music-visualiser').length,1);assert.equal(h.d.querySelectorAll('#sota-playlist-audio').length,1);
 h.w.SotaWorlds.enhanceMusic();assert.equal(h.player.querySelectorAll('.sx-player-library').length,1);assert.equal(h.player.querySelectorAll('.sx-player-now').length,1);
});
browserTest('each signed-in destination retains its content and the pill strip lists only its group',t=>{
 const h=harness(t);const strip={pulse:4,moments:4,crews:4,circles:4,friends:2,connections:2,music:0,room:0},seen=new Set();for(const page of ['pulse','moments','friends','crews','circles','room','music','connections']){h.w.SotaExperience.stop();h.app.innerHTML='<header class="top"></header><main id="view"><section class="glass card"><input id="draft" value="keep my draft"></section></main>';const draft=h.get('#draft');h.w.SotaExperience.mountMember(h.app,{user:{id:'fixture'},me:{handle:'fixture',display_name:'Fixture'},tab:page});assert.equal(h.app.querySelector('.sx-world-next'),null,'no repeated destination cards under the page');if(page==='music'){assert.equal(h.app.querySelector('.sx-world-more'),null,'Music has no second visual-style picker');assert.equal(h.app.querySelector('.sx-world-hero [data-world-tool]'),null,'the Music hero has no visuals button');assert(h.app.querySelector('.sx-world-hero-compact'));  }assert.equal(h.get('#draft'),draft);assert.equal(draft.value,'keep my draft');const pills=[...h.app.querySelectorAll('.sx-world-member-tabs button')];pills.forEach(b=>seen.add(b.dataset.worldMember));assert.equal(pills.length,strip[page],'the pill strip lists only the active dock group');if(strip[page])assert.equal(h.app.querySelector('.sx-world-member-tabs [aria-current="page"]').dataset.worldMember,page);else assert.equal(h.app.querySelector('.sx-world-member-tabs'),null,'Music and My space have no secondary pills');assert.equal(h.app.querySelectorAll('.sx-nav [aria-current="page"]').length,1);h.get('.sx-world-toolbar [data-world-tool="design"]').click();assert.equal(h.calls.design.at(-1),page==='room'?'profile':page);}
 assert.deepEqual([...seen].sort(),['circles','connections','crews','friends','moments','pulse'],'every secondary world is reachable from its dock tab; Music and My space are dock tabs themselves');
});
browserTest('the slim Home greeting and the compact Music hero are both action-free',t=>{
 const h=harness(t);h.w.SotaSere={open(){}};
 for(const page of ['pulse','music']){
   h.w.SotaExperience.stop();h.app.innerHTML='<header class="top"></header><main id="view"></main>';
   h.w.SotaExperience.mountMember(h.app,{user:{id:'fixture'},me:{handle:'fixture'},tab:page});
   const actions=h.app.querySelector('.sx-world-hero [data-world-actions]');
   assert.equal(actions.querySelector('button'),null);
   if(page==='pulse'){assert(h.app.querySelector('.sx-world-hero-slim'));assert.equal(h.app.querySelector('.sx-world-hero-photo'),null,'no banner artwork on Home');assert.equal(h.app.querySelector('.sx-world-more'),null,'no ideas menu on Home');assert.match(h.app.querySelector('.sx-world-hero h1').textContent,/Start with one small moment|Welcome back/);}
 }
});
test('member deep links are bounded and leave invitation and public graph routes to their existing owners',()=>{
 const {memberRouteFromHash}=require('../sota-worlds.js');assert.equal(memberRouteFromHash('#music'),'music');assert.equal(memberRouteFromHash('#profile'),'room');assert.equal(memberRouteFromHash('#world'),'connections');assert.equal(memberRouteFromHash('#view=moments'),'moments');for(const route of ['#view=wallet','#view=admin','#circle-invite=secret','#circle-graph=public','#friends-graph=public','#connections=mine'])assert.equal(memberRouteFromHash(route),null);
});
test('member navigation records destinations and a late owner cannot steal focus',async()=>{
 const vm=require('node:vm'),{memberRouteFromHash}=require('../sota-worlds.js'),html=source('index.html');
 const code=html.slice(html.indexOf('function go('),html.indexOf('/* ================= DATA'));
 let finish,focus=0,scroll=0;const pushes=[],S={user:{id:'one'},tab:'pulse'},location={hash:'',pathname:'/',search:''};
 const ctx={S,location,document:{},Promise,$:()=>({querySelector:()=>({focus:()=>focus++})}),render:()=>new Promise(resolve=>finish=resolve),history:{replaceState(){},pushState(state,_title,url){pushes.push(url);location.hash=url;}},window:{SotaWorlds:{memberRouteFromHash},scrollTo:()=>scroll++}};
 vm.createContext(ctx);vm.runInContext(code,ctx);const pending=ctx.go('music');assert.equal(S.tab,'music');assert.deepEqual(pushes,['#view=music']);S.user={id:'two'};finish();await pending;assert.equal(focus,0);assert.equal(scroll,0);
 const next=ctx.go('friends');finish();await next;assert.equal(focus,1);assert.equal(scroll,1);assert.equal(pushes.at(-1),'#view=friends');
 const back=ctx.go('music',{history:false});finish();await back;assert.equal(pushes.length,2,'Restoring Back does not add another history entry');
});


browserTest('Home keeps one animated visual while the working player stays collapsed',t=>{
 const h=harness(t),host=h.get('[data-world-home-visual]'),visual=h.visual,audio=h.audio;
 assert(host.contains(visual));assert(visual.hasAttribute('compact'));assert.equal(h.player.open,false);assert(!host.querySelector('audio,select,input,.sk-playlist-transport,.sk-playlist-search'));
 h.app.querySelector('a[href="#music"]').click();assert(!visual.hasAttribute('compact'));assert.equal(h.player.open,true);assert(h.get('[data-world-inline-visual]').contains(visual));
 h.get('#sk-playlist-filter').value='keep this choice';h.app.querySelector('a[href="#home"]').click();
 assert(host.contains(visual));assert(visual.hasAttribute('compact'));assert.equal(h.d.querySelectorAll('dimau-music-visualiser').length,1);assert.equal(h.d.querySelector('#sota-playlist-audio'),audio);assert.equal(h.get('#sk-playlist-filter').value,'keep this choice');assert.equal(h.calls.pause,0);
 assert.equal(h.get('#sota-music-home').closest('.sx-panel').hidden,true);
});

browserTest('stopping the shell returns the visible visual to its existing player owner',t=>{
 const h=harness(t),visual=h.visual;assert(h.get('[data-world-home-visual]').contains(visual));
 h.w.SotaWorlds.stop();assert(h.player.contains(visual));assert(!visual.hasAttribute('compact'));
 assert.equal(h.d.querySelectorAll('dimau-music-visualiser').length,1);
 h.w.SotaWorlds.mount(h.app);assert(h.get('[data-world-home-visual]').contains(visual));
});

browserTest('member Home moves one compact visualiser back to the existing player before remount',t=>{
 const h=harness(t);
 const {app,w,visual,player,audio}=h;
 const state={user:{id:'fixture'},me:{handle:'fixture'},tab:'pulse'};
 for(let pass=0;pass<2;pass++){
   w.SotaExperience.stop();
   assert(player.contains(visual));
   app.innerHTML='<header class="top"></header><main id="view"></main>';
   w.SotaExperience.mountMember(app,state);
   const host=app.querySelector('[data-world-home-visual]');
   assert(host.contains(visual));
   assert(visual.hasAttribute('compact'));
   assert(!host.contains(audio));
   assert.equal(h.d.querySelectorAll('dimau-music-visualiser').length,1);
 }
});

browserTest('seven signed-in worlds have five choices and a feed choice changes the prompt without writing a post',t=>{
 const h=harness(t);
 const {app,w}=h;
 const user={id:'choice-test-member'};
 function home(owner){
   w.SotaExperience.stop();
   app.innerHTML='<header class="top"></header><main id="view"><textarea id="p-text" placeholder="Say something"></textarea></main>';
   w.SotaExperience.mountMember(app,{user:owner,me:{handle:'fixture'},tab:'pulse'});
 }
 home(user);
 h.get('.sx-world-toolbar [data-world-tool="explore"]').click();
 const menus=[...h.get('.sx-world-directory').querySelectorAll('[data-world-choice]')];
 assert.equal(menus.length,7,'Music keeps its visual style on the visualiser card only');assert(!menus.some(menu=>menu.dataset.worldChoice==='music'));
 assert(menus.every(menu=>menu.options.length===6));
 const faith=menus.find(menu=>menu.dataset.worldChoice==='pulse');
 faith.value='faith';
 faith.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.match(h.get('#p-text').placeholder,/prayer/);
 assert.equal(h.get('#p-text').value,'');
 home(user);
 assert.match(h.get('#p-text').placeholder,/prayer/);
 home({id:'another-member'});
 assert.equal(h.get('#p-text').placeholder,'Say something');
});

browserTest('Koro choices use native group type and naming controls',t=>{
 const h=harness(t);
 const {app,w}=h;
 w.SotaExperience.stop();
 app.innerHTML='<header class="top"></header><main id="view"><section id="koro-create"><input data-tc-name placeholder="Circle name"><select data-tc-type><option value="koro">Koro</option><option value="mataqali">Mataqali</option></select></section></main>';
 w.SotaExperience.mountMember(app,{user:{id:'choice-test-member'},me:{handle:'fixture'},tab:'crews'});
 const menu=h.get('[data-world-choice=crews]');
 for(const [choice,type,placeholder] of [['yasana','koro',/provincial/],['mataqali','mataqali',/mataqali/],['island','koro',/island/]]){
   menu.value=choice;
   menu.dispatchEvent(new w.Event('change',{bubbles:true}));
   assert.equal(h.get('[data-tc-type]').value,type);
   assert.match(h.get('[data-tc-name]').placeholder,placeholder);
   assert.equal(h.get('[data-tc-name]').value,'');
 }
});
test('wide desktops use the room beside the rail, and Home docks its side blocks next to the wall',()=>{
 const css=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','sota-worlds.css'),'utf8');
 assert.match(css,/@media\(min-width:1101px\)\{\s*body\.sx-member #app\.sx-app \.sx-member-content\{max-width:1560px;/);
 assert.match(css,/@media\(min-width:1360px\)\{\s*body\.sx-member #app\.sx-app\[data-world-page="pulse"\] #view\.sx-member-content\{display:grid;grid-template-columns:minmax\(0,1fr\) minmax\(320px,400px\)/);
 assert.match(css,/#view>\.tw-wrap\{grid-column:1;grid-row:3\/span 12;/);
});
test('the welcome button greets for three seconds, then folds to its short form and never stays floating over the page',()=>{
 const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','bula-top-20261030.js'),'utf8');
 assert.match(src,/var HOLD=3000,/);assert.match(src,/setTimeout\(function\(\)\{folded=true;bulaTop\(\);\},HOLD\)/);
 assert.match(src,/\|\|\(folded&&!peek\)/,'pointing at it or focusing it opens it out again');
 assert.match(src,/if\(pill&&!acts&&!floatTimer\)floatTimer=setTimeout\(/,'a pill with no top bar to sit in is put away');
 assert.doesNotMatch(src,/\.remove\(\)/,'the button is folded or hidden, never deleted');
});
