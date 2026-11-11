'use strict';
// The Dimau Premium Shell on Sota Kece: shared files are byte copies of the standard, the page carries the
// contract markup, the worker ships the files with the shell, and the release label moves with the worker.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),sw=read('sw.js'),adapterCss=read('sota-premium-shell.css'),adapterJs=read('sota-premium-shell.js'),experience=read('sota-experience.js');
const manifest=JSON.parse(read('tests/premium-shell-sha256.json'));
test('dimau-premium-shell.css and .js are byte copies of dimau-platform-standard/premium-shell',()=>{
 for(const [file,hash] of Object.entries(manifest))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file+' differs from the standard');
});
test('page: layer declared first, shell stylesheet after the header standard, adapters last, scripts deferred',()=>{
 assert.ok(html.indexOf('<style>@layer dimau-premium-shell;</style>')<html.indexOf('<link'),'layer line is the first thing in head');
 assert.ok(html.indexOf('dimau-header-standard.css')<html.indexOf('dimau-premium-shell.css'));
 assert.ok(html.indexOf('premium-finish.css')<html.indexOf('sota-premium-shell.css'),'Sota adapter is the last stylesheet');
 assert.match(html,/<script src="\/dimau-premium-shell\.js\?v=[\w-]+" defer><\/script>/);
 assert.match(html,/<script src="\/sota-premium-shell\.js\?v=[\w-]+" defer><\/script>/);
 assert.match(html,/<body class="dps-shell dps-has-nav">/);
});
test('page: floating search button and overlay follow the shell contract and are static markup (no layout shift on mount)',()=>{
 assert.equal((html.replace(/<template id="sx-first-paint">[\s\S]*?<\/template>/,'').replace(/,mw="[^"]*"/,'').match(/data-dps-search-open/g)||[]).length,1,'one opener: the floating button (the inert first-paint copy of the header is replaced on first render)');
 assert.match(html,/<button type="button" class="dps-fab" data-dps-search-open aria-expanded="false" aria-label="Search Sota Kece"/);
 assert.match(html,/<div class="dps-search" data-dps-search hidden/);
 assert.match(html,/role="dialog" aria-modal="true" aria-labelledby="dps-search-title"/);
 assert.match(html,/<label id="dps-search-title" class="dps-visually-hidden" for="dps-search-input">/);
 assert.match(html,/<form class="dps-search-form" role="search" data-dps-search-form action="#people">/);
 assert.match(html,/<ul class="dps-search-results" role="listbox" data-dps-search-results><\/ul>/);
 const page=html.replace(/,mw="[^"]*"/,''); // the member-copy word list in the SK script is not markup
 assert.ok(page.indexOf('data-dps-search-open')>page.indexOf('<div id="app"></div>'),'search markup sits after the app root, outside the re-rendered tree');
});
test('navigation carries the shell roles without changing labels or handlers',()=>{
 assert.match(experience,/<nav class="sx-nav" data-dps-nav aria-label="Main navigation">/);
 assert.match(experience,/data-dps-tab="\$\{key\}" aria-current=/);
 for(const sel of ['@media(max-width:760px)','body.sx-enabled .sx-nav{position:fixed','grid-auto-flow:column','env(safe-area-inset-bottom','@media(min-width:761px)','body.sx-enabled.dps-has-nav{padding-bottom:0!important}','body.sx-enabled .sx-rail>.sx-brand,body.sx-enabled .sx-rail-caption,body.sx-enabled .sx-rail-bottom,body.sx-enabled .sx-world-rail-links{display:none','body.sx-enabled .dps-fab{display:none!important}','.sx-header-search{','body.sx-enabled > [data-dimau-group-footer]{position:static!important'])assert.ok(adapterCss.includes(sel),sel);
 assert.ok(!/width:min\(560px/.test(adapterCss),'no floating dock on wider screens: the left rail is the one primary navigation there');
 assert.match(experience,/class="sx-header-search" data-dps-search-open/,'search opens from the header');
 assert.ok(!/prefers-color-scheme/.test(adapterCss),'light sky-blue only; no dark theme');
});
test('search provider: syntax, no storage, no new hosts, registers with the shell',()=>{
 new vm.Script(adapterJs,{filename:'sota-premium-shell.js'});
 assert.ok(!/localStorage|sessionStorage|indexedDB|sendBeacon/.test(adapterJs));
 assert.ok(!/https?:\/\//.test(adapterJs),'only same-origin reads (members through the existing client, the playlist file)');
 assert.match(adapterJs,/DimauShell\.search\.provider\(provider\)/);
});
test('worker: shell files travel with the essential shell and the release label matches the page',()=>{
 const release=/<meta name="sota-release" content="([^"]+)">/.exec(html)[1];
 assert.match(sw,new RegExp("const CACHE='"+release.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"'"));
 for(const f of ['/dimau-premium-shell.css','/dimau-premium-shell.js','/sota-premium-shell.css','/sota-premium-shell.js'])assert.ok(sw.includes("'"+f+"'"),f+' in the worker list');
});
