// Funnel events (view -> signup -> first_action) and the server key shape check.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html');

function tracker(store={}){
  const src=/window\.SKTrack=function[\s\S]*?\n\}catch\(_\)\{\}\};/.exec(html);
  assert(src,'SKTrack is defined in index.html');
  const sent=[];
  const window={innerWidth:390,dimau:{visitor:'v-1',code:null}};
  const ctx={window,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},sessionStorage:{getItem:()=>'s-1'},
    location:{pathname:'/',hostname:'sotakece.com'},navigator:{sendBeacon:(url,blob)=>{sent.push({url,blob});return true;}},
    Blob:class{constructor(parts,opts){this.text=parts.join('');this.type=opts.type;}},fetch:()=>{throw Error('beacon should be used');}};
  new Function(...Object.keys(ctx),src[0])(...Object.values(ctx));
  return {track:window.SKTrack,sent,store};
}

test('funnel events go to the event spine without a member token or any member words',()=>{
  const {track,sent}=tracker();
  track('signup',{kind:'email'});
  assert.equal(sent.length,1);
  assert.equal(sent[0].url,'https://xnxmumbvgtmlpenutlii.supabase.co/functions/v1/track');
  assert.equal(sent[0].blob.type,'text/plain;charset=UTF-8','no preflight, no Authorization header');
  const [e]=JSON.parse(sent[0].blob.text);
  assert.deepEqual(Object.keys(e).sort(),['at','code','device','host','name','path','props','referrer_host','session','surface','visitor']);
  assert.equal(e.name,'signup');assert.equal(e.surface,'sota-kece');assert.equal(e.visitor,'v-1');assert.equal(e.device,'phone');
  assert.deepEqual(e.props,{kind:'email'});
});

test('first_action is sent once per device',()=>{
  const {track,sent,store}=tracker();
  track('first_action',{kind:'wall_post'},'sk-first-action');
  track('first_action',{kind:'sere'},'sk-first-action');
  assert.equal(sent.length,1);assert.equal(store['sk-first-action'],'1');
});

test('nothing is sent when the beacon never gave this device a visitor id',()=>{
  const src=/window\.SKTrack=function[\s\S]*?\n\}catch\(_\)\{\}\};/.exec(html)[0],sent=[],window={innerWidth:1200};
  new Function('window','localStorage','navigator',src)(window,{getItem:()=>null,setItem(){}},{sendBeacon:()=>sent.push(1)});
  window.SKTrack('signup');assert.equal(sent.length,0);
});

test('sign-up, wall posts, voice posts and seres report their funnel step',()=>{
  assert.equal((html.match(/window\.SKTrack\("signup",/g)||[]).length,2,'both room-creation paths');
  assert.equal((read('sota-pulse.js').match(/window\.SKTrack\('first_action', \{ kind: replyTo \? 'wall_reply' : 'wall_post' \}, 'sk-first-action'\)/g)||[]).length,2);
  assert.match(read('sere-maker.js'),/if \(window\.SKTrack\) window\.SKTrack\('first_action', \{ kind: 'sere' \}, 'sk-first-action'\)/);
});

test('a server key that is not shaped like a key is a config fault, not a header error',async()=>{
  const sere=require('../api/sere.js'),listen=require('../api/listen.js');
  const pasted='export const WALLPAPER_PRESETS = [\n  { id: "parallax" },';
  const never=async()=>{throw Error('fetch must not be reached');};
  await assert.rejects(sere.getJob({SOTA_SERVER_SECRET:pasted},'x',never),/^Error: config$/);
  await assert.rejects(listen.readSere({SOTA_SERVER_SECRET:pasted},'x',never),/^Error: config$/);
  await assert.rejects(sere.speak({REPLICATE_API_TOKEN:pasted},'hi','bella',never),/^Error: config$/);
  let reached=false;
  await sere.getJob({SOTA_SERVER_SECRET:'0123456789abcdef0123456789abcdef0123'},'x',async()=>{reached=true;return {ok:true,json:async()=>[]};});
  assert(reached,'a well-formed key is used');
  assert.match(read('api/_sota-server.js'),/if\(!KEY_SHAPE\.test\(key\)\)throw Error\('config'\)/);
  assert.match(read('api/account-delete.js'),/require\('\.\/_sota-server\.js'\)/);
});

// Sign-up funnel steps (14 Nov 2026): every step exists, carries only fixed words, and Google/Facebook
// are read back once the person returns signed in.
function funnel(store={},now=Date.now()){
  const pick=re=>{const m=re.exec(html);assert(m,String(re));return m[0];};
  const src=[pick(/window\.SKFunnel=function[\s\S]*?\}catch\(_\)\{\}\};/),pick(/window\.SKAuthPending=function[\s\S]*?\}catch\(_\)\{\}\};/),pick(/window\.SKAuthReturned=function[\s\S]*?\}catch\(_\)\{\}\};/)].join('\n');
  const spine=[],site=[],goals=[];
  const window={SKEvent:(n,p)=>spine.push([n,p]),dimauTrack:(n,p)=>site.push([n,p]),dimauGoal:g=>goals.push(g)};
  const localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}};
  new Function('window','localStorage','Date',src)(window,localStorage,{now:()=>now,parse:Date.parse});
  return {window,spine,site,goals,store};
}

test('each sign-up step is sent to the event spine and the site analytics with fixed words only',()=>{
  const {window,spine,site,goals}=funnel();
  window.SKFunnel('signup_space_setup',{via:'room'},true);
  assert.deepEqual(spine,[['signup_space_setup',{via:'room'}]]);assert.deepEqual(site,spine);assert.deepEqual(goals,['signup_complete']);
  for(const step of ['signup_open','signup_provider','signup_error','signup_signed_in','signup_account_created','signup_space_setup'])
    assert.match(html,new RegExp('SKFunnel\\("'+step+'"'),step);
  // No member words: every SKFunnel call passes only literals, the provider variable or 0/1 flags.
  for(const call of html.match(/SKFunnel\("signup_[a-z_]+",\{[^}]*\}/g)){
    assert.doesNotMatch(call,/email\.|value|handle|name:|user|message/,call);
  }
});

test('coming back from Google counts a sign-in, and a new account only when it was just made',()=>{
  const now=Date.parse('2026-11-14T10:00:00Z');
  let f=funnel({},now);f.window.SKAuthPending('google');assert.match(f.store['sk-auth-pending'],/^google\|/);
  f.window.SKAuthReturned({created_at:'2026-11-14T09:59:00Z'});
  assert.deepEqual(f.spine,[['signup_signed_in',{provider:'google',new_account:1}],['signup_account_created',{provider:'google'}]]);
  assert.equal(f.store['sk-auth-pending'],undefined,'read once');
  f.window.SKAuthReturned({created_at:'2026-11-14T09:59:00Z'});assert.equal(f.spine.length,2,'not again on the next load');
  f=funnel({'sk-auth-pending':'google|'+(now-60e3)},now);f.window.SKAuthReturned({created_at:'2025-01-01T00:00:00Z'});
  assert.deepEqual(f.spine,[['signup_signed_in',{provider:'google',new_account:0}]]);
  f=funnel({'sk-auth-pending':'google|'+(now-3*36e5)},now);f.window.SKAuthReturned({created_at:'2026-11-14T09:59:00Z'});
  assert.deepEqual(f.spine,[],'a stale marker from hours ago is dropped');
});

test('Continue with Google answers the first tap and is not left disabled after an error',()=>{
  const fn=/async function oauthSignIn\(provider\)\{[\s\S]*?\n\}/.exec(html)[0];
  assert.match(fn,/b\.disabled=true/);assert.match(fn,/Opening "\+\(provider==="google"\?"Google":"Facebook"\)/);
  assert.match(fn,/if\(error\)\{buttons\.forEach\(b=>\{b\.disabled=false/);
  assert.match(fn,/redirectTo:location\.origin\+"\/"/,'returns to the page it left (sotakece.com)');
  assert.match(html,/S\.user = session\.user;\n\s*window\.SKAuthReturned\?\.\(S\.user\);/);
});

test('coming back with the browser Back button does not leave the sign-in buttons stuck',()=>{
  assert.match(html,/window\.addEventListener\("pageshow",e=>\{if\(!e\.persisted\)return;document\.querySelectorAll\("\.social-btn\[aria-busy\]"\)\.forEach\(b=>\{b\.disabled=false;/);
});
