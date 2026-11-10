if (typeof importScripts === 'function') importScripts('/dimau-page-timeout.js');
// Only known public app files are cached. Auth, profiles, messages and uploaded media never enter this cache.
const CACHE='sota-kece-shell-20261110-v160-legal';
// Keep installation small and reliable: artwork and fonts are saved only after they are requested.
const ASSETS=['/dimau-header-standard.css','/dimau-header-standard.js','/dimau-premium-shell.css','/dimau-premium-shell.js','/sota-premium-shell.css','/sota-premium-shell.js','/native-header.css','/circle-types.js','/circle-groups.js','/circle-groups.css','/communications-core.js','/room-atmosphere.js','/room-atmosphere.css','/music-visualiser.js','/skin-visuals.js','/editorial-design.css','/skin-discovery.js','/community-design.css','/skin-identities.js','/studio-skins.css','/quality.css','/playback.js','/','/manifest.webmanifest','/dimau-install.js','/vendor/supabase-2.45.0.min.js','/skins.css','/skins.js','/room-media.js','/front-page.css','/local-music.js','/music-playlist.js','/music-playlist.css','/music-playlist.json','/skin-studio.js','/offline.js','/kava.css','/koro.css','/kava.js','/kava-ui.js','/connections.js','/friend-feed.js','/connections.css'];
const PUBLIC_IMAGES=['/assets/feature-scenes/moments-studio-20261105-880.webp','/assets/feature-scenes/koro-market-20261105-880.webp','/assets/feature-scenes/connections-ferry-20261105-880.webp','/assets/feature-scenes/pulse-cafe-20261105-880.webp','/assets/feature-scenes/courtside-friends-20261105-880.webp','/assets/feature-scenes/courtyard-guitars-20261105-1400.webp','/assets/feature-scenes/courtyard-guitars-20261105-720.webp','/assets/feature-scenes/design-together-20261105-880.webp','/assets/feature-scenes/talanoa-kava-jam-20261105-1400.webp','/assets/feature-scenes/talanoa-kava-jam-20261105-720.webp','/assets/social-sunset-20261104/beach-singalong-768.webp','/assets/social-sunset-20261104/beach-singalong-1536.webp','/assets/social-sunset-20261104/garden-catchup-768.webp','/assets/social-sunset-20261104/garden-catchup-1536.webp','/assets/social-sunset-20261104/friends-guitar-clean-768.webp','/assets/social-sunset-20261104/friends-guitar-clean-1536.webp','/assets/og-sota-kece-20261104.jpg','/assets/welcome-20261103/music-natural-768.webp','/assets/welcome-20261103/space-together-natural-768.webp','/icons/sota-icon-192-20261027g.png','/assets/life-galaxy-20261026.webp','/assets/music-badge-ring.svg','/assets/music-badge-note.svg','/assets/skins/studio/ocean-20261025.webp','/assets/skins/studio/coral-20261025.webp','/assets/skins/studio/rain-20261025.webp','/assets/skins/studio/retro-20261025.svg','/assets/dimau-visuals-icon.svg','/assets/sota-blue-white-background-20261021.png','/assets/sota-kece-logo-20261020.svg','/assets/sota-kece-logo-20261020.png','/assets/sota-blue-masi-lettering-20261020.png','/assets/music-badge-museum-20261018.svg','/assets/dimau-owner-logo-20260920.png','/assets/sota-kece-logo.png','/assets/fiji-music-icon-20261018.svg','/assets/fiji-sunset.jpg','/assets/front-reference.jpg','/assets/front-reference-brand.jpg','/assets/mobile-front-reference.png','/assets/mobile-front-reference-brand.jpg','/assets/fiji-music.jpg','/assets/friends.jpg','/assets/beach.jpg','/assets/masi-band.svg','/assets/masi-supplied.png','/assets/og-sota-kece-20261027g.jpg'];
const FONT_ASSETS=['/assets/fonts/fredoka-latin-ext.woff2','/assets/fonts/fredoka-latin.woff2','/assets/fonts/nunito-latin-ext.woff2','/assets/fonts/nunito-latin.woff2'];
// Cache this optional visual surface after use; keep the essential install under 1 MB.
const ON_DEMAND=['/sota-pulse.js','/sota-pulse.css','/sere-maker.js','/sere-maker.css','/circle-communications.css','/communications-chat.css','/communications-chat.js','/native-call-stage.css','/native-call-stage.js','/sota-worlds.js','/sota-worlds.css','/sota-wellbeing.js','/sota-wellbeing.css','/header-alignment-20261018.css','/pacific-themes.js','/sota-experience.js','/sota-experience.css','/icon-controls.js','/glass-controls.css','/panel-close.css','/space-design.js','/space-design.css','/colourful-pages.css','/dimau-charts-core.js','/dimau-visuals.js','/dimau-visuals.css','/front-pages.js','/front-pages.css','/music-home.js','/music-home.css','/profile-photos.js','/profile-photos.css','/life-graph3d.js','/life-graph3d.css','/hero-music-stage.css','/music-spin.css','/welcome-connections.css','/life-connections.js','/life-connections.css','/shared-music/core.mjs','/music-badge.js','/hero-visualiser.js','/room-social.js','/room-social-layout.js','/room-social.css','/sota-plus.js','/sota-plus.css','/gifts.js','/gifts.css'];
const PUBLIC_PATHS=new Set([...ASSETS,...ON_DEMAND,...PUBLIC_IMAGES,...FONT_ASSETS]);
function versionOnly(url){return !url.search||([...url.searchParams.keys()].length===1&&url.searchParams.has('v')&&/^[a-z0-9._-]{1,128}$/i.test(url.searchParams.get('v')));}
function cacheable(response){return response&&response.status===200&&response.type!=='opaque'&&response.type!=='opaqueredirect'&&(!response.url||new URL(response.url).origin===self.location.origin)&&!/(?:^|,)\s*(?:private|no-store)\b/i.test(response.headers.get('cache-control')||'');}
self.addEventListener('install',event=>{event.waitUntil((async()=>{
  // Validate the whole public shell before writing. A failed update leaves the current worker active.
  const files=await Promise.all(ASSETS.map(async asset=>{
    const request=new Request(new URL(asset,self.location.origin).href,{cache:'reload',credentials:'omit'});
    const response=await fetch(request);
    if(!cacheable(response))throw new Error('Public shell file cannot be saved: '+asset);
    return {asset,response};
  }));
  const cache=await caches.open(CACHE);
  await Promise.all(files.map(({asset,response})=>cache.put(asset,response)));
  await self.skipWaiting();
})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('sota-kece-shell-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
  if(typeof self.clients.matchAll==='function')for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'SOTA_RELEASE',release:CACHE});
})());});
self.addEventListener('message',event=>{if(event.data?.type==='SOTA_RELEASE_REQUEST')event.ports?.[0]?.postMessage({type:'SOTA_RELEASE',release:CACHE});});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('authorization')||request.headers.has('range'))return;
  if(request.mode==='navigate'){
    if(url.pathname!=='/'&&url.pathname!=='/index.html')return;
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      try{
        const response=await fetch(request);
        if(cacheable(response)&&!url.search)event.waitUntil(cache.put('/',response.clone()));
        if(response.ok)return response;
        return await cache.match('/')||response;
      }catch(_){return await cache.match('/')||Response.error();}
    })());
    return;
  }
  if(!versionOnly(url)||(!PUBLIC_PATHS.has(url.pathname)&&!/^\/revised\/assets\/skins\/photographic-20261029\/[a-z0-9-]+\.webp$/.test(url.pathname)&&!/^\/revised\/assets\/skins\/pacific-20261029\/[a-z0-9-]+\.svg$/.test(url.pathname)&&!/^\/assets\/skins\/(?:core|identity)\/[a-z0-9-]+\.svg$/.test(url.pathname)&&!/^\/assets\/skins\/editorial\/(?:school|vanua|music|heritage|memories|fresh|ra|nadroga|dalo|natabua|marist|grammar|qvs|acs|fnu|usp)-20261025\.webp$/.test(url.pathname)))return;
  // Version labels select deployments; the allowlisted public file has one offline cache entry.
  const key=url.origin+url.pathname;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(key);
    const fresh=fetch(request).then(response=>{
      if(cacheable(response))event.waitUntil(cache.put(key,response.clone()));
      return response;
    });
    // A new HTML version must receive its matching code immediately, even when
    // the single offline entry still holds an older deployment's file.
    if(url.searchParams.has('v')&&/\.(?:m?js|css|json|webmanifest)$/i.test(url.pathname)){
      try{const response=await fresh;return response.ok?response:cached||response;}
      catch(_){return cached||Response.error();}
    }
    if(cached){event.waitUntil(fresh.catch(()=>{}));return cached;}
    return fresh;
  })());
});

