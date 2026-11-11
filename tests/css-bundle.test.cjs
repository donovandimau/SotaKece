// index.html loads two combined stylesheets built by scripts/build-css.cjs from the separate .css files.
// If this fails after a stylesheet edit, run: node scripts/build-css.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const root=path.join(__dirname,'..');
const {build,minify}=require('../scripts/build-css.cjs');

test('the combined stylesheets and their ?v= hashes match the source files',()=>{
  const {html,next,bundles}=build();
  assert.deepEqual(bundles.map(b=>b.name),['sota-styles-head','sota-styles']);
  for(const b of bundles)assert.equal(fs.readFileSync(path.join(root,b.name+'.css'),'utf8'),b.body,b.name+'.css is out of date: run node scripts/build-css.cjs');
  assert.equal(html,next,'index.html carries an old bundle hash: run node scripts/build-css.cjs');
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
  assert(live.indexOf('sota-styles-head.css')<live.indexOf('@layer dimau-premium,dimau-history-lighting;'),'head bundle stays before the inline layer order');
  assert(live.indexOf('<style>\n/* Keep the companion')<live.indexOf('sota-styles.css'),'inline page styles stay before the main bundle');
  assert(live.indexOf('rel="preload" as="image"')<live.indexOf('<link rel="stylesheet"'),'photo preload still comes first');
});

test('the minifier drops comments and white space only',()=>{
  assert.equal(minify('a  >  b , c{ color : red ; /* x */ }\n@media (max-width:700px){ .x{content:"  a /* b */ ;"} }','t'),'a > b,c{color : red;}@media (max-width:700px){.x{content:"  a /* b */ ;"}}');
  assert.equal(minify('.a{background:url(//x.y/a;b.png) no-repeat}','t'),'.a{background:url(//x.y/a;b.png) no-repeat}');
  assert.equal(minify('div/**/.x{margin:1px/**/2px}','t'),'div/**/.x{margin:1px/**/2px}');
  assert.throws(()=>minify('.a{color:red','t'),/unbalanced/);
});
