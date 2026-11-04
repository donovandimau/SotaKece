'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const browserTest=(name,fn)=>test(name,{skip:!JSDOM?'Set JSDOM_MODULE to run the responsive shell integration':false},fn);
const source=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function harness(t,hash=''){
 const d=new JSDOM(`<!doctype html><div id="app"><header class="sk-site-header"></header><section id="sota-music-home"><button data-music-view="visualiser"></button><button data-music-view="playlist"></button><div data-music-panel="visualiser"><canvas></canvas></div><div data-music-panel="playlist"><div data-music-playlist-host><input id="track-search" value="keep my song"></div></div></section><header class="bv-connect-header"><div class="bv-entry-account-actions"><button id="sk-sign-up">Sign up</button><button id="sk-sign-in">Sign in</button></div><form id="bv-home-search"><input id="mate" value="my_mate"></form><section class="bv-entry-invite"></section></header><dialog id="bv-entry"><input value="draft@example.test"></dialog><section id="bv-circle"><button id="circle-preview">Explore circle</button></section><section id="bv-your-room"><button data-collection="Vanua">Vanua</button></section><section id="sota-connections"><canvas id="world-canvas"></canvas></section><footer class="bv-classic-footer"></footer></div>`,{url:'https://sotakece.com/'+hash,runScripts:'outside-only'});
 const w=d.window,app=w.document.querySelector('#app'),calls={playlist:0,pause:0,auth:0,circle:0,go:[],welcome:0};w.scrollTo=()=>{};
 w.SotaPlaylist={showInline:()=>calls.playlist++,hideInline(){},detachInline(){},pause:()=>calls.pause++};
 w.eval(source('music-home.js'));w.eval(source('sota-experience.js'));w.SotaMusicHome.mount(app);
 app.querySelector('#sk-sign-up').onclick=()=>calls.auth++;app.querySelector('#circle-preview').onclick=()=>calls.circle++;
 w.SotaExperience.init({go:page=>calls.go.push(page),welcome:()=>calls.welcome++});t.after(()=>w.close());
 return {w,app,calls,api:w.SotaExperience,get:selector=>app.querySelector(selector),mount:()=>w.SotaExperience.mountGuest(app,{roomMarkup:'<p>Example space</p>'})};
}
browserTest('the five destinations preserve original controls, drafts and DOM owners',t=>{
 const h=harness(t),music=h.get('#sota-music-home'),canvas=h.get('#world-canvas'),account=h.get('#bv-entry'),mate=h.get('#mate');h.mount();
 assert.equal(h.w.document.activeElement,h.get('#sx-welcome-title'),'initial inline dialog must leave visitors at the welcome heading');
 assert.deepEqual([...h.app.querySelectorAll('.sx-nav a')].map(n=>n.textContent.trim()),['Home','People','Talanoa','Music','My space']);
 for(const page of ['music','people','talanoa','profile','home'])h.get(`[data-sx-route="${page}"]`).click();
 assert.equal(h.get('#sota-music-home'),music);assert.equal(h.get('#world-canvas'),canvas);assert.equal(h.get('#bv-entry'),account);assert.equal(h.get('#mate'),mate);assert.equal(mate.value,'my_mate');assert.equal(h.get('#track-search').value,'keep my song');assert.equal(h.calls.pause,0);assert.equal(h.calls.playlist,1);
 h.get('[data-sx-auth="up"]').click();assert.equal(h.calls.auth,1);h.get('#circle-preview').click();assert.equal(h.calls.circle,1);
});
browserTest('direct links, legacy hashes and Back select one visible panel and current nav',t=>{
 const h=harness(t,'#bv-your-room');h.mount();assert.equal(h.app.dataset.sxPage,'skins');assert.equal(h.get('[data-sx-route="profile"]').getAttribute('aria-current'),'page');
 h.w.history.replaceState(null,'','#people');h.w.dispatchEvent(new h.w.PopStateEvent('popstate'));
 assert.equal(h.app.querySelectorAll('[data-sx-page]:not([hidden])').length,1);assert.equal(h.app.dataset.sxPage,'people');assert.equal(h.w.document.activeElement,h.get('.sx-page-heading h1'));
 h.w.history.replaceState(null,'','#circle-invite=private-token');h.w.dispatchEvent(new h.w.HashChangeEvent('hashchange'));assert.equal(h.app.dataset.sxPage,'people','Special invitation routing is left to its existing owner');
});
browserTest('routing uses the existing music owner without autoplay or losing the filter',t=>{
 const h=harness(t);h.mount();h.get('[data-sx-route="music"]').click();h.get('#track-search').value='new filter';h.get('[data-sx-route="home"]').click();h.get('[data-sx-route="music"]').click();
 assert.equal(h.calls.playlist,1);assert.equal(h.get('#track-search').value,'new filter');assert.equal(h.calls.pause,0);assert.equal(h.get('[data-music-panel="visualiser"]').hidden,true);assert.equal(h.get('[data-music-panel="playlist"]').hidden,false);
});
browserTest('stopping a session removes route listeners',t=>{
 const h=harness(t);h.mount();h.api.stop();h.w.history.replaceState(null,'','#music');h.w.dispatchEvent(new h.w.HashChangeEvent('hashchange'));assert.equal(h.app.dataset.sxPage,'home');assert.equal(h.calls.playlist,0);
});
browserTest('Home and destination pages share the same room and music nodes without restarting playback',t=>{
 const h=harness(t);h.mount();const room=h.get('.sx-room-example'),music=h.get('#sota-music-home');
 assert(h.get('[data-sx-room-home]').contains(room));assert(h.get('[data-sx-slot="music"]').contains(music));assert.equal(music.closest('[data-sx-page]').hidden,true);
 h.get('#track-search').value='keep this filter';
 for(const page of ['profile','music','home','people','home'])h.get(`[data-sx-route="${page}"]`).click();
 assert.equal(h.app.querySelectorAll('.sx-room-example').length,1);assert.equal(h.app.querySelectorAll('#sota-music-home').length,1);
 assert(h.get('[data-sx-room-home]').contains(room));assert(h.get('[data-sx-slot="music"]').contains(music));assert.equal(music.closest('[data-sx-page]').hidden,true);
 assert.equal(h.get('#track-search').value,'keep this filter');assert.equal(h.calls.playlist,1);assert.equal(h.calls.pause,0);
});
browserTest('an explicit music control opens Music and preserves the existing owner',t=>{
 const h=harness(t);h.mount();const music=h.get('#sota-music-home');
 h.get('[data-music-playlist-host]').dispatchEvent(new h.w.CustomEvent('sota-playlist-inline-open',{bubbles:true}));
 assert.equal(h.app.dataset.sxPage,'music');assert.equal(h.get('#sota-music-home'),music);assert.equal(h.calls.playlist,1);
});
browserTest('music remains collapsed on Home and each music entry reveals the same player',t=>{
 const h=harness(t);h.mount();const music=h.get('#sota-music-home');
 assert.equal(h.calls.playlist,0,'Home must not open the player automatically');
 assert.equal(h.get('.sx-panel[data-sx-page="home"] #sota-music-home'),null);
 assert.equal(h.get('.sx-panel[data-sx-page="home"] [data-music-playlist-host]'),null);
 assert.equal(music.closest('[data-sx-page]').hidden,true);
 for(const selector of ['.sx-discover-music','.sx-home-soundtrack a[href="#music"]','.sx-top a[href="#music"]']){
  h.get(selector).click();assert.equal(h.app.dataset.sxPage,'music');assert.equal(music.closest('[data-sx-page]').hidden,false);
  h.get('#track-search').value='preserved choice';h.get('[data-sx-route="home"]').click();assert.equal(music.closest('[data-sx-page]').hidden,true);assert.equal(h.get('#track-search').value,'preserved choice');
 }
 assert.equal(h.calls.playlist,1,'Opening again must not create another player');assert.equal(h.calls.pause,0);
 assert.equal(h.get('.sx-home-soundtrack').querySelector('[data-music-playlist-host]'),null);
});
browserTest('photographic feature headings retain their original destinations',t=>{
 const h=harness(t);h.mount();const cards=[...h.app.querySelectorAll('.sx-discover-card')];
 assert.equal(cards.length,3);assert.equal(new Set(cards.map(card=>card.querySelector('img').getAttribute('src'))).size,3);
 for(const card of cards){assert(card.querySelector('h3').textContent.trim());assert.equal(card.querySelector('img').getAttribute('loading'),'lazy');const target=card.getAttribute('href').slice(1);card.click();assert.equal(h.app.dataset.sxPage,target);h.get('[data-sx-route="home"]').click();}
});
browserTest('signed-in navigation dispatches the existing views and retains wallet controls',t=>{
 const h=harness(t);h.app.innerHTML='<header class="top"><button id="wallet" class="luvchip">Wallet</button></header><main id="view"><input value="keep my draft"></main><nav class="bottom"></nav>';const wallet=h.get('#wallet');h.api.mountMember(h.app,{user:{id:'test'},me:{display_name:'A < B',handle:'example'},tab:'pulse',pending:[1]});
 assert.deepEqual([...h.app.querySelectorAll('.sx-nav button')].map(n=>n.dataset.sxMember),['pulse','friends','crews','music','room']);h.get('[data-sx-member="music"]').click();assert.deepEqual(h.calls.go,['music']);assert.equal(h.get('#wallet'),wallet);assert.equal(h.get('#view input').value,'keep my draft');assert(h.get('.sx-top-note').textContent.includes('A < B'));assert.equal(h.get('.sx-top-note b'),null);
});
browserTest('guest circle previews return to public destinations without loading member data',t=>{
 const h=harness(t);h.app.innerHTML='<header class="top"></header><main id="view">Example circle</main><nav class="bottom"></nav>';h.api.mountMember(h.app,{user:null,tab:'circles'});h.get('[data-sx-route="music"]').click();assert.equal(h.w.location.hash,'#music');assert.equal(h.calls.welcome,1);assert.equal(h.calls.go.length,0);
});
browserTest('the persistent music control follows the same audio element and player action',t=>{
 const h=harness(t);h.mount();const audio=h.w.document.createElement('audio');audio.id='sota-playlist-audio';audio.src='https://example.test/song.mp3';h.w.document.body.append(audio);let taps=0;const player=h.w.document.createElement('div');player.id='sk-music-playlist';player.innerHTML='<b class="sk-playlist-title">Test song</b><button class="sk-deck-play">Play</button>';player.querySelector('button').onclick=()=>taps++;h.w.document.body.append(player);audio.dispatchEvent(new h.w.Event('loadedmetadata'));
 assert.equal(h.get('.sx-mini-player').hidden,false);assert.equal(h.get('.sx-mini-open b').textContent,'Test song');h.get('.sx-mini-toggle').click();assert.equal(taps,1);h.get('.sx-mini-open').click();assert.equal(h.app.dataset.sxPage,'music');assert.equal(h.get('.sx-mini-player').hidden,true,'The full music page does not duplicate its controls in a floating bar');assert.equal(h.w.document.querySelectorAll('#sota-playlist-audio').length,1);
});

