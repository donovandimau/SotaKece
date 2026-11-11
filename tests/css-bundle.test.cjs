// index.html loads two combined stylesheets built by scripts/build-css.cjs from the separate .css files.
// If this fails after a stylesheet edit, run: node scripts/build-css.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const root=path.join(__dirname,'..');
const {build,minify,critical,needs,vocabulary}=require('../scripts/build-css.cjs');

test('the combined stylesheets, their ?v= hashes, critical CSS and preload list match the source files',()=>{
  const {html,next,bundles}=build();
  assert.deepEqual(bundles.map(b=>b.name),['sota-styles-head','sota-styles']);
  for(const b of bundles)assert.equal(fs.readFileSync(path.join(root,b.name+'.css'),'utf8'),b.body,b.name+'.css is out of date: run node scripts/build-css.cjs');
  assert.equal(html,next,'index.html carries an old bundle hash, critical CSS or preload list: run node scripts/build-css.cjs');
});

test('each bundled file is loaded once, through its bundle, in the old cascade order',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  // The page as the browser uses it: index.html with every <!-- ... --> comment cut out.
  let live='',at=0;
  for(let open=html.indexOf('<!--',at);open>=0;open=html.indexOf('<!--',at)){const close=html.indexOf('-->',open+4);assert(close>0,'unclosed comment');live+=html.slice(at,open);at=close+3;}
  live+=html.slice(at);
  const {bundles}=build(),all=bundles.flatMap(b=>b.sources);
  assert.equal(new Set(all).size,all.length,'a file is listed in two bundles');
  for(const src of all)assert(!live.includes('href="/'+src),src+' is also linked directly');
  assert.equal(bundles[0].sources[0],'dimau-header-standard.css');
  assert.equal(bundles[1].sources.at(-1),'phone-tidy-20261029.css');
  // Where each bundle is linked (its SK.css call and critical <style>) keeps the old cascade position.
  const call=name=>live.indexOf('<script>SK.css("'+name+'"');
  assert(call('sota-styles-head')>0&&call('sota-styles')>0);
  assert(live.indexOf('<style data-sk-critical="sota-styles-head"')<call('sota-styles-head')&&call('sota-styles-head')<live.indexOf('@layer dimau-premium,dimau-history-lighting;'),'head bundle stays before the inline layer order');
  assert(live.indexOf('<style>\n/* Keep the companion')<live.indexOf('<style data-sk-critical="sota-styles"'),'inline page styles stay before the main bundle');
  assert(live.indexOf('rel="preload" as="image"')<live.indexOf('window.SK='),'photo preload still comes first');
  assert(!/<link rel="stylesheet" href="\/sota-styles/.test(live.replace(/<noscript>[\s\S]*?<\/noscript>/g,'')),'bundles are only linked through SK.css (and <noscript>)');
});

test('the minifier drops comments and white space only',()=>{
  assert.equal(minify('a  >  b , c{ color : red ; /* x */ }\n@media (max-width:700px){ .x{content:"  a /* b */ ;"} }','t'),'a > b,c{color : red;}@media (max-width:700px){.x{content:"  a /* b */ ;"}}');
  assert.equal(minify('.a{background:url(//x.y/a;b.png) no-repeat}','t'),'.a{background:url(//x.y/a;b.png) no-repeat}');
  assert.equal(minify('div/**/.x{margin:1px/**/2px}','t'),'div/**/.x{margin:1px/**/2px}');
  assert.throws(()=>minify('.a{color:red','t'),/unbalanced/);
});

test('critical CSS keeps every rule the first screen could use, and only those',()=>{
  assert.deepEqual(needs('body.sx-enabled #app.sx-app > header[data-dimau-header]:not(.x) a:hover::before'),['body','.sx-enabled','#app','.sx-app','header','@data-dimau-header','a']);
  assert.deepEqual(needs(':is(.a,.b) .c svg'),['.c','svg']);
  assert.deepEqual(needs('.md\\:flex'),['.md:flex']);
  const words=new Set(['body','.a','@data-x','svg']);
  assert.equal(critical('@layer l{.a{color:red}.b{color:blue}}@layer m{.b{x:1}}@media (min-width:900px){.a{x:2}}@media (max-width:760px){[data-x] svg{x:3}.zz{x:4}}@font-face{font-family:f}@keyframes k{to{x:5}}*{box-sizing:border-box}.a,.q{x:6}',words),
    '@layer l{.a{color:red}}@layer m;@media (max-width:760px){[data-x] svg{x:3}}@font-face{font-family:f}@keyframes k{to{x:5}}*{box-sizing:border-box}.a,.q{x:6}');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),v=vocabulary(html);
  for(const w of ['.sx-hero-copy','.sx-top','@data-dps-nav','.sx-enabled','.bv-welcome','picture','.dps-fab'])assert(v.has(w),w+' is part of the first screen');
  assert(!v.has('.sx-member'),'scripts and comments are not part of the first screen');
  const {bundles}=build();
  for(const b of bundles){assert(b.critical.length>2000&&b.critical.length<b.body.length/3,b.name+' critical CSS is a small part of the bundle');assert(html.includes('<style data-sk-critical="'+b.name+'" media="not all">'+b.critical+'</style>'));}
});

test('held scripts are preloaded, in page order, for everyone who is not on the first-paint path',()=>{
  const {next,bundles,scripts}=build();
  const pre=/var pre="([^"]*)";/.exec(next)[1].split(' ');
  assert.equal(pre[0],bundles[1].href,'main bundle preloaded so it does not wait for the head bundle');
  assert.deepEqual(pre.slice(1),scripts);
  for(const f of ['/vendor/supabase-2.45.0.min.js','/sota-experience.js','/skin-studio.js','/bula-top-20261030.js','/dimau-pwa.js'])assert(scripts.some(s=>s.startsWith(f)),f+' is held and preloaded');
  assert(!scripts.some(s=>/^\/\//.test(s)||/^https?:/.test(s)),'only same-origin scripts are preloaded');
});
