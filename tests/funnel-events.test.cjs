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
  await assert.rejects(sere.getJob({SOTA_SERVICE_KEY:pasted},'x',never),/^Error: config$/);
  await assert.rejects(listen.readSere({SOTA_SERVICE_KEY:pasted},'x',never),/^Error: config$/);
  await assert.rejects(sere.speak({REPLICATE_API_TOKEN:pasted},'hi','bella',never),/^Error: config$/);
  let reached=false;
  await sere.getJob({SOTA_SERVICE_KEY:'sb_secret_abcdefghijklmnop-1234'},'x',async()=>{reached=true;return {ok:true,json:async()=>[]};});
  assert(reached,'a well-formed key is used');
  assert.match(read('api/account-delete.js'),/if\(!KEY_SHAPE\.test\(key\)\)throw Error\('config'\)/);
});
