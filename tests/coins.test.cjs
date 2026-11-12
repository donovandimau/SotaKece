'use strict';
// Coins, tipping and payouts (10 Nov 2026): the tip sheet on wall posts, the coin cards in the
// wallet, the Activity wording, and the page wiring. All of it sits behind window.SOTA_WALLET_ON.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fjd=(minor)=>'FJ$'+((Number(minor)||0)/100).toFixed(2);
const coinsSrc=read('sota-coins.js'),pulseSrc=read('sota-pulse.js'),plusSrc=read('sota-plus.js');
const flush=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
const post=(id,over)=>Object.assign({id,author:'u-bo',handle:'bo',display_name:'Bo',avatar_emoji:'🥥',accent:'#2A9D8F',body:'line '+id,created_at:new Date(1700000000000+id*60000).toISOString(),reply_to:null,quote_of:null,like_count:0,repost_count:0,reply_count:0,tip_count:0,tip_coins:0,hot:0,mine:false,i_liked:false,i_reposted:false,quote:null},over||{});
const data=(over)=>Object.assign({balance:40,earned:0,bought:50,tipped:10,received:0,paid_out:0,coin_sene:10,fee_bps:3000,tips_on:true,buy_on:false,payout_on:false,payout_min:100,max_tip:500,daily_cap:500,tipped_today:10,bundles:[{id:'bilo',coins:50,bonus:0,price_minor:500},{id:'tanoa',coins:100,bonus:10,price_minor:1000}],ledger:[]},over||{});

const windows=[];test.after(()=>windows.forEach(w=>w.close()));
function boot(rpcImpl,walletOn=true){
  const dom=new JSDOM('<!doctype html><body><div id="app"><main id="view"></main></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'http://test.invalid/'});
  const w=dom.window;windows.push(w);
  w.IntersectionObserver=class{observe(){}disconnect(){}};w.scrollTo=()=>{};w.SOTA_WALLET_ON=walletOn;
  w.eval(pulseSrc);w.eval(coinsSrc);
  const calls=[],toasts=[],gone=[];
  const client={rpc:async(name,args)=>{calls.push({name,args});const d=await rpcImpl(name,args||{});return {data:d,error:null};},channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel(){}};
  const state={user:{id:'u-ana'},me:{handle:'ana',display_name:'Ana'},tab:'pulse'};
  const shell=h=>{w.document.getElementById('view').innerHTML=h;};
  w.SotaPulse.init({client,state,toast:m=>toasts.push(m),esc,ago:()=>'now',openRoom(){},shell});
  w.SotaCoins.init({client,state,toast:m=>toasts.push(m),esc,fjd,ago:()=>'now',go:t=>gone.push(t)});
  return {w,calls,toasts,gone};
}
const rpcs=(rows,d)=>async(name,args)=>{
  if(name==='bv_talanoa_feed')return rows.filter(p=>!p.reply_to);
  if(name==='bv_coins')return d;
  if(name==='bv_coin_tip')return {balance:d.balance-args.p_coins,coins:args.p_coins,net:Math.floor(args.p_coins*0.7),tip_count:1,tip_coins:args.p_coins,tipped_today:d.tipped_today+args.p_coins};
  return null;
};

// The module only needs a window to hang itself on for markup helpers: a plain vm context does.
function bare(walletOn=true){const vm=require('node:vm');const sandbox={SOTA_WALLET_ON:walletOn};sandbox.window=sandbox;vm.runInContext(coinsSrc,vm.createContext(sandbox));return sandbox;}

test('pure: the sheet offers presets up to the balance, a no-coins sheet points at the wallet, and errors read as words',()=>{
  const C=bare().SotaCoins;C.init({esc,fjd,state:{user:{id:'u'}},toast(){}});
  const html=C.sheet(7,data({balance:12}));
  assert.match(html,/You have 12 coins \(FJ\$1\.20\)/);
  assert.match(html,/data-coin-pick="5"[^>]*>🪙 5/);assert.match(html,/data-coin-pick="25" disabled/);assert.match(html,/data-coin-pick="50" disabled/);
  assert.match(html,/data-coin-send="7">Send 5 coins/);
  const none=C.sheet(7,data({balance:0,buy_on:false}));
  assert.match(none,/No coins yet\. Coin packs open together with the wallet\./);assert.doesNotMatch(none,/data-coin-send/);
  assert.match(C.sheet(7,data({balance:0,buy_on:true})),/data-coin-shop>Get coins/);
  assert.equal(C.say(new Error('NOT_ENOUGH_COINS')),'Not enough coins. Get some first.');
  assert.equal(C.say(new Error('COINS_BUY_OFF')),'Buying coins opens together with the wallet.');
  assert.equal(C.say(new Error('WALLET_DORMANT')),'Add money first to wake your wallet up.');
});

test('the wall shows a coin button only while the wallet is on; the author sees the total, not a button',{skip:!JSDOM},async()=>{
  const rows=[post(2,{tip_coins:12}),post(3,{mine:true,tip_coins:4}),post(4,{mine:true})];
  const on=boot(rpcs(rows,data()));await on.w.SotaPulse.view();await flush();
  assert.ok(on.w.document.querySelector('.tw-post[data-id="2"] button[data-tw="coin"].on'),'others get a tip button, lit when the post has coins');
  assert.equal(on.w.document.querySelector('.tw-post[data-id="2"] [data-count="coin"]').textContent,'12');
  assert.ok(on.w.document.querySelector('.tw-post[data-id="3"] span.tw-coin'),'the author sees the total as a label');
  assert.ok(!on.w.document.querySelector('.tw-post[data-id="4"] .tw-coin'),'an untipped own post shows nothing');
  const off=boot(rpcs(rows,data()),false);await off.w.SotaPulse.view();await flush();
  assert.equal(off.w.document.querySelectorAll('.tw-coin').length,0,'nothing coin-shaped while the wallet is hidden');
});

test('tipping: the sheet opens under the post, a preset is sent with the note, counts update and the sheet closes',{skip:!JSDOM},async()=>{
  const rows=[post(2)];
  const {w,calls,toasts}=boot(rpcs(rows,data({balance:40})));
  await w.SotaPulse.view();await flush();
  w.document.querySelector('.tw-post[data-id="2"] [data-tw="coin"]').click();await flush();
  const sheet=w.document.querySelector('.sk-coin-sheet[data-coin-sheet="2"]');
  assert.ok(sheet&&sheet.previousElementSibling.classList.contains('tw-bar'),'the sheet sits right under the post actions');
  assert.ok(calls.some(c=>c.name==='bv_coins'),'balance read once');
  w.document.querySelector('[data-coin-pick="10"]').click();
  assert.equal(w.document.querySelector('[data-coin-send]').textContent,'Send 10 coins');
  w.document.querySelector('.sk-coin-note').value='vinaka vakalevu';
  w.document.querySelector('[data-coin-send]').click();await flush();
  const tip=calls.find(c=>c.name==='bv_coin_tip');
  assert.equal(JSON.stringify(tip.args),JSON.stringify({p_post:2,p_coins:10,p_note:'vinaka vakalevu'})); // compared by value: the args live in the page's realm
  assert.equal(w.document.querySelector('.tw-post[data-id="2"] [data-count="coin"]').textContent,'10');
  assert.ok(w.document.querySelector('.tw-post[data-id="2"] [data-tw="coin"]').classList.contains('on'));
  assert.ok(!w.document.querySelector('.sk-coin-sheet'),'sheet closed');
  assert.match(toasts.pop(),/Sent 10 coins\. 30 left\./);
  assert.equal(w.SotaCoins.state().data.balance,30,'the cached balance follows');
  // a custom amount wins over the preset
  w.document.querySelector('.tw-post[data-id="2"] [data-tw="coin"]').click();await flush();
  const custom=w.document.querySelector('.sk-coin-custom');custom.value='3';custom.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal(w.document.querySelector('[data-coin-send]').textContent,'Send 3 coins');
  w.document.querySelector('[data-coin-close]').click();assert.ok(!w.document.querySelector('.sk-coin-sheet'));
});

test('a refused tip rolls nothing and tells the member in words',{skip:!JSDOM},async()=>{
  const rows=[post(2)];
  const {w,toasts}=boot(async(name,args)=>{if(name==='bv_coin_tip')throw new Error('DAILY_CAP');return rpcs(rows,data())(name,args);});
  await w.SotaPulse.view();await flush();
  w.document.querySelector('.tw-post[data-id="2"] [data-tw="coin"]').click();await flush();
  w.document.querySelector('[data-coin-send]').click();await flush();
  assert.equal(toasts.pop(),'That is your coin limit for today.');
  assert.equal(w.document.querySelector('.tw-post[data-id="2"] [data-count="coin"]').textContent,'');
  assert.ok(w.document.querySelector('.sk-coin-sheet'),'the sheet stays for another try');
});

test('wallet cards: switched-off packs and payouts say so; switched on, packs and the payout button appear with the minimum',()=>{
  const sandbox=bare(true),C=sandbox.SotaCoins;C.init({esc,fjd,ago:()=>'2m',state:{user:{id:'u'}},toast(){}});
  const off=C.walletCards(data({balance:40,earned:9}));
  assert.match(off,/🪙 40/);assert.match(off,/Worth FJ\$4\.00/);assert.match(off,/Coin packs open together with the wallet/);assert.match(off,/Moving coins to your wallet opens together with the wallet/);
  assert.match(off,/Sota Kece keeps 30% of each tip/);assert.doesNotMatch(off,/data-coin-buy/);
  const on=C.walletCards(data({buy_on:true,payout_on:true,earned:9,ledger:[{id:1,kind:'tip_in',delta:7,memo:'vinaka',created_at:'2026-11-10T00:00:00Z',other:'ana'},{id:2,kind:'buy',delta:110,memo:'tanoa',created_at:'2026-11-10T00:00:00Z'}]}));
  assert.equal((on.match(/data-coin-buy="/g)||[]).length,2);assert.match(on,/🪙 100 <i>\+10 free<\/i><\/b><span>FJ\$10\.00 from your wallet/);
  assert.match(on,/data-coin-payout="9" disabled>Move 9 coins to my wallet/);assert.match(on,/From 100 coins\./);
  assert.match(on,/Tip from @ana <i>“vinaka”<\/i><\/span><b>\+7<\/b>/);assert.match(on,/Pack<\/span><b>\+110/);
  assert.equal(C.walletCards(null),'');
  sandbox.SOTA_WALLET_ON=false;assert.equal(C.walletCards(data()),'','nothing while the wallet is hidden');
});

test('Activity words a tip with the coins and the note',{skip:!JSDOM},()=>{
  const dom=new JSDOM('<!doctype html><body><div id="shell"></div></body>',{runScripts:'outside-only'});windows.push(dom.window);
  dom.window.eval(plusSrc);
  dom.window.SotaPlus.init({client:{rpc:async()=>({data:null,error:null})},state:{user:{id:'u1'},me:{}},toast(){},render(){},openRoom(){},esc,ago:()=>'now',mediaMarkup:()=>'',shell(){}});
  const line=dom.window.SotaPlus.actLine({kind:'tip',target_kind:'post',handle:'bo',snippet:'12|vinaka <b>'});
  assert.match(line,/@bo<\/span> 🪙 12 coins, tipped your post <span class="sub">“vinaka &lt;b&gt;”<\/span>/);
});

test('page wiring: module loaded and started at boot, coins in the wallet view, worker and workflow know it, release ids agree',()=>{
  const html=read('index.html');
  assert.match(html,/<script src="\/sota-coins\.js\?v=/);assert.match(html,/<link rel="stylesheet" href="\/sota-coins\.css\?v=/);
  assert.match(html,/rememberReferral\(\);\n  window\.SotaCoins\?\.init\(\{client:sb,state:S,toast,esc,fjd,ago,go:\(t,o\)=>go\(t,o\)\}\);/);
  assert.match(html,/const coins = await \(window\.SotaCoins\?window\.SotaCoins\.load\(true\)\.catch\(\(\)=>null\):null\);/);
  assert.match(html,/\$\{window\.SotaCoins\?\.walletCards\(coins\)\|\|''\}/);
  assert.match(html,/window\.SotaCoins\?\.reset\(\);window\.SotaHubs\?\.reset\(\);S\.user=null;/,'sign-out forgets cached coin data');
  assert.match(html,/window\.SOTA_WALLET_ON = false;/,'the wallet, and with it coins, stays hidden until the RBF approves it');
  const release=/<meta name="sota-release" content="([^"]+)">/.exec(html)[1];
  assert.match(read('sw.js'),new RegExp("const CACHE='"+release+"';"));
  assert.match(read('sw.js'),/'\/sota-coins\.js','\/sota-coins\.css'/);
  assert.match(read('.github/workflows/talanoa-security.yml'),/node tests\/run-coins-db\.cjs/);
  assert.match(read('sota-pulse.js'),/if \(act === 'coin'\) return window\.SotaCoins \? window\.SotaCoins\.tip\(id, t\)/);
});
