const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const root=path.join(__dirname,'..'),origin='https://sotakece.com';
const workerSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');

function worker(){
  const handlers={},stores=new Map(),calls=[];
  let network=async url=>new Response('public '+new URL(url).pathname);
  let installed=0,claimed=0;const broadcasts=[];
  const absolute=value=>new URL(typeof value==='string'?value:value.url,origin).href;
  const fetch=async request=>{const url=absolute(request);calls.push(url);return network(url,request);};
  const caches={
    async open(name){
      if(!stores.has(name))stores.set(name,new Map());
      const store=stores.get(name);
      return {
        async match(key){return store.get(absolute(key))?.clone();},
        async put(key,response){store.set(absolute(key),response.clone());},
        async addAll(urls){for(const url of urls){const response=await fetch(url);assert(response.ok,'Essential file failed: '+url);store.set(absolute(url),response.clone());}}
      };
    },
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);}
  };
  const context={URL,Request,Response,Set,caches,fetch,self:{location:{origin},addEventListener(type,handler){handlers[type]=handler;},skipWaiting(){installed++;},clients:{claim(){claimed++;},async matchAll(){return [{postMessage(message){broadcasts.push(JSON.parse(JSON.stringify(message)));}}];}}}};
  vm.createContext(context);vm.runInContext(workerSource,context);
  const cacheName=vm.runInContext('CACHE',context),assets=Array.from(vm.runInContext('ASSETS',context));
  async function lifetime(type){const waits=[];handlers[type]({waitUntil(promise){waits.push(promise);}});await Promise.all(waits);}
  async function request(url,options={}){
    const waits=[];let response;
    const request={url:absolute(url),method:options.method||'GET',mode:options.mode||'cors',headers:new Headers(options.headers)};
    handlers.fetch({request,respondWith(promise){response=promise;},waitUntil(promise){waits.push(promise);}});
    if(response===undefined)return {intercepted:false};
    let result;
    try{result=await response;}finally{await Promise.all(waits);}
    return {intercepted:true,response:result};
  }
  return {assets,cacheName,stores,calls,caches,broadcasts,install:()=>lifetime('install'),activate:()=>lifetime('activate'),request,message(data){let answer;handlers.message({data,ports:[{postMessage(value){answer=JSON.parse(JSON.stringify(value));}}]});return answer;},
    setNetwork(fn){network=fn;},get installed(){return installed;},get claimed(){return claimed;}};
}

test('install saves a lean shell and makes no optional artwork or font requests',async()=>{
  const app=worker();
  app.setNetwork(async (url,request)=>{
    assert(!url.includes('/assets/'),'Installation requested optional artwork');
    assert.equal(request.credentials,'omit','Public installation must omit session cookies');
    assert.equal(request.cache,'reload','A worker update must fetch the current deployment');
    return new Response('shell');
  });
  await app.install();
  assert.equal(app.installed,1);assert.equal(app.calls.length,app.assets.length);
  assert(app.assets.includes('/dimau-install.js'));assert(app.assets.includes('/manifest.webmanifest'));
  assert(!app.assets.includes('/index.html'),'Do not download the homepage twice');
  const bytes=app.assets.reduce((sum,url)=>sum+fs.statSync(path.join(root,url==='/'?'index.html':url.slice(1))).size,0);
  assert(bytes<1024*1024,'Essential shell must remain below 1 MB');
});

test('a private or no-store essential file rejects installation without replacing the active shell',async()=>{
  for(const policy of ['private, max-age=60','public, no-store']){
    const app=worker(),oldCache=await app.caches.open('sota-kece-shell-previous');
    await oldCache.put('/',new Response('previous working shell'));
    app.setNetwork(async url=>new Response('new shell',{headers:new URL(url).pathname==='/'?{'cache-control':policy}:{}}));
    await assert.rejects(app.install(),/Public shell file cannot be saved: \//);
    assert.equal(app.installed,0,'A rejected update must not request activation');
    assert.equal(app.claimed,0);assert(!app.stores.has(app.cacheName),'Do not save a partially validated shell');
    assert.equal(await (await oldCache.match('/')).text(),'previous working shell');
  }
});

test('first offline visit resolves versioned shell files from their installed entries',async()=>{
  const app=worker();await app.install();
  app.setNetwork(async()=>{throw Error('offline');});
  for(const url of ['/front-page.css?v=20261024-cohesive','/skins.js?v=20261014-core-skins','/music-playlist.json?v=20261020','/dimau-install.js?v=20261019']){
    const result=await app.request(url);assert(result.intercepted);assert.equal(result.response.status,200);assert.match(await result.response.text(),/^public /);
  }
  const store=app.stores.get(app.cacheName);assert(![...store.keys()].some(url=>url.includes('?')),'Version labels should not create duplicate cache entries');
});

test('new versioned code, styles and data use the current deployment on the first request',async()=>{
  const app=worker();await app.install();const cache=await app.caches.open(app.cacheName);
  const files=['/skin-studio.js','/connections.js','/life-connections.js','/front-page.css','/life-connections.css','/music-playlist.json','/shared-music/core.mjs'];
  for(const file of files)await cache.put(file,new Response('old deployment '+file));
  app.setNetwork(async url=>new Response('new deployment '+new URL(url).pathname));
  for(const file of files){
    const result=await app.request(file+'?v=revision-2');
    assert.equal(await result.response.text(),'new deployment '+file,'Do not return a stale file before the background refresh: '+file);
    assert.equal(await (await cache.match(file)).text(),'new deployment '+file);
  }
  assert(![...app.stores.get(app.cacheName).keys()].some(url=>url.includes('?')),'Fresh version labels must share the lean offline entry');
});

test('versioned files retain cached offline content when the newer deployment cannot be reached',async()=>{
  const app=worker();await app.install();const cache=await app.caches.open(app.cacheName);
  await cache.put('/skin-studio.js',new Response('working older code'));
  app.setNetwork(async()=>{throw Error('offline');});
  assert.equal(await (await app.request('/skin-studio.js?v=revision-2')).response.text(),'working older code');
  assert.equal(await (await cache.match('/skin-studio.js')).text(),'working older code');
  assert.equal((await app.request('/life-connections.js?v=never-cached')).response.type,'error');
});

test('failed versioned responses fall back without replacing a working file',async()=>{
  const app=worker();await app.install();const cache=await app.caches.open(app.cacheName);
  await cache.put('/connections.js',new Response('working graph'));
  app.setNetwork(async()=>new Response('temporarily unavailable',{status:503}));
  assert.equal(await (await app.request('/connections.js?v=revision-2')).response.text(),'working graph');
  assert.equal(await (await cache.match('/connections.js')).text(),'working graph');
  assert.equal((await app.request('/life-connections.js?v=never-cached')).response.status,503);
});

test('unversioned requests keep their cached response while refreshing in the background',async()=>{
  const app=worker();await app.install();const cache=await app.caches.open(app.cacheName);
  await cache.put('/connections.js',new Response('cached graph'));
  app.setNetwork(async()=>new Response('fresh graph'));
  assert.equal(await (await app.request('/connections.js')).response.text(),'cached graph');
  assert.equal(await (await cache.match('/connections.js')).text(),'fresh graph');
});

test('known original hero artwork, optional visualiser, fonts and public skins cache only after use',async()=>{
  const app=worker();await app.install();
  const files=['/hero-visualiser.js','/assets/front-reference-brand.jpg','/assets/mobile-front-reference-brand.jpg','/assets/mobile-front-reference.png','/assets/sota-blue-white-background-20261021.png','/assets/fonts/nunito-latin.woff2','/assets/skins/core/masi-border.svg'];
  for(const file of files){assert(!app.stores.get(app.cacheName).has(origin+file));const result=await app.request(file+'?v=24');assert.equal(result.response.status,200);assert(app.stores.get(app.cacheName).has(origin+file));}
  app.setNetwork(async()=>{throw Error('offline');});
  for(const file of files){const result=await app.request(file);assert.equal(result.response.status,200);}
});

test('API, private, cross-origin and signed-query requests bypass the worker',async()=>{
  const app=worker();await app.install();const count=app.calls.length;
  const cases=[
    ['/rest/v1/bv_profiles'],['/api/room'],['/assets/member-cover.jpg'],['/assets/skins/private/room.svg'],
    ['https://other.example/assets/fiji-music.jpg'],['/assets/fiji-music.jpg?token=private'],['/skins.js?v=24&token=private'],['/hero-visualiser.js?token=private'],['/hero-visualiser.js',{headers:{authorization:'Bearer session'}}],
    ['/skins.js?v=24&v=25'],['/skins.js?v='],['/assets/fiji-music.jpg',{headers:{authorization:'Bearer session'}}],
    ['/assets/fiji-music.jpg',{headers:{range:'bytes=0-20'}}],['/skins.js',{method:'POST'}],['/members',{mode:'navigate'}]
  ];
  for(const [url,options] of cases)assert.equal((await app.request(url,options)).intercepted,false,url);
  assert.equal(app.calls.length,count);
});

test('private and no-store responses are never saved as public artwork',async()=>{
  for(const policy of ['private, max-age=60','public, no-store']){
    const app=worker();await app.install();app.setNetwork(async()=>new Response('private',{headers:{'cache-control':policy}}));
    const result=await app.request('/assets/fiji-music.jpg');assert.equal(await result.response.text(),'private');
    assert(!app.stores.get(app.cacheName).has(origin+'/assets/fiji-music.jpg'));
  }
});

test('navigation uses the network first, falls back offline and never saves claim queries',async()=>{
  const app=worker();await app.install();
  app.setNetwork(async()=>new Response('new public shell'));
  assert.equal(await (await app.request('/',{mode:'navigate'})).response.text(),'new public shell');
  app.setNetwork(async()=>new Response('claim response'));
  assert.equal(await (await app.request('/?sid=cs_example',{mode:'navigate'})).response.text(),'claim response');
  app.setNetwork(async()=>{throw Error('offline');});
  for(const url of ['/','/index.html','/?sid=cs_example'])assert.equal(await (await app.request(url,{mode:'navigate'})).response.text(),'new public shell');
  app.setNetwork(async()=>new Response('temporarily unavailable',{status:503}));
  assert.equal(await (await app.request('/',{mode:'navigate'})).response.text(),'new public shell');
});

test('activation removes only older Sota Kece shell caches',async()=>{
  const app=worker();await app.install();await app.caches.open('sota-kece-shell-old');await app.caches.open('another-app');
  await app.activate();assert.equal(app.claimed,1);assert(!app.stores.has('sota-kece-shell-old'));assert(app.stores.has('another-app'));assert(app.stores.has(app.cacheName));
});

test('the page and worker identify the same release and notify open tabs without private data',async()=>{
 const app=worker(),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert(html.includes('<meta name="sota-release" content="'+app.cacheName+'">'),'Bump the page release and worker cache together');
 await app.install();await app.activate();
 assert.deepEqual(app.broadcasts,[{type:'SOTA_RELEASE',release:app.cacheName}]);
 assert.deepEqual(app.message({type:'SOTA_RELEASE_REQUEST'}),{type:'SOTA_RELEASE',release:app.cacheName});
 assert.equal(app.message({type:'UNKNOWN',token:'private'}),undefined);
});

test('photographic theme covers cache on demand without widening access to private media',async()=>{
 const app=worker();await app.install();
 const image='/revised/assets/skins/photographic-20261029/reef.webp';
 assert(!app.calls.some(url=>url.includes('photographic-20261029')),'No cover is mandatory installation content');
 const result=await app.request(image);assert(result.intercepted);assert.equal(result.response.status,200);
 assert(app.stores.get(app.cacheName).has(origin+image));
 for(const url of ['/revised/assets/private/reef.webp','/storage/v1/object/private/reef.webp',image+'?token=private'])assert.equal((await app.request(url)).intercepted,false);
});

test('connectivity changes update the notice while preserving active views and drafts',()=>{
  const handlers={},notices=new Map(),draft={value:'My unfinished Talanoa'},activeView={name:'room'},registrations=[];
  let boots=0;
  const context={document:{querySelector:selector=>notices.get(selector),addEventListener(){},createElement:()=>({setAttribute(){}}),body:{prepend(node){notices.set('#'+node.id,node);}}},
    navigator:{onLine:false,serviceWorker:{addEventListener(){},register:url=>{registrations.push(url);return Promise.resolve({update:async()=>{}});}}},window:{addEventListener(type,handler){const previous=handlers[type];handlers[type]=previous?()=>{previous();handler();}:handler;}},setInterval(){},boot(){boots++;},draft,activeView};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'offline.js'),'utf8'),context);
  assert.equal(notices.get('#sota-connection').hidden,false);assert.match(notices.get('#sota-connection').textContent,/offline/);
  context.navigator.onLine=true;handlers.online();assert.equal(notices.get('#sota-connection').hidden,true);
  context.navigator.onLine=false;handlers.offline();assert.equal(notices.get('#sota-connection').hidden,false);
  assert.equal(boots,0);assert.equal(draft.value,'My unfinished Talanoa');assert.equal(activeView.name,'room');
  handlers.load();assert.deepEqual(registrations,['/sw.js']);
});
