'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const types=require('../circle-types.js');
const skins=require('../skins.js');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const kava=fs.readFileSync(path.join(__dirname,'../kava-ui.js'),'utf8');
function extract(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,'extract actual '+start);return source.slice(a,b);}
const viewSource=extract(index,'function viewRun(','async function requestResult(');
const bootSource=extract(index,'async function boot(){','/* Signed in, but no room yet.');
const changedSource=extract(index,'function circleGroupChanged(','function openCircleMember(');
const memberSource=extract(index,'function openCircleMember(','async function viewCrews(');
const sessionSkinSource=extract(kava,'  function applySessionSkin(','  async function open(');
const own='61025000-0000-4000-8000-000000000001',other='61025000-0000-4000-8000-000000000002';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function bootHarness({hash='#circle-graph=42',session={user:{id:own}},profile={id:own,handle:'owner'},profileError=null,throwProfile=false,getSession,online=true}={}){
 const calls={profile:0,auth:[],shell:[],route:[],rpc:[],finish:0},S={user:null,me:null,tab:'pulse',roomHandle:null,crew:null,viewRevision:0};let context;
 const request={select(){return this;},eq(){return this;},async maybeSingle(){return {data:profile,error:profileError};}};
 context=vm.createContext({S,navigator:{onLine:online},location:{hash,pathname:'/',search:''},
  sb:{auth:{getSession:getSession||(async()=>({data:{session}}))},from(name){calls.profile++;if(throwProfile)throw Error('The public route must not request a private profile');assert.equal(name,'bv_profiles');return request;},rpc(name,args){calls.rpc.push({name,args});throw Error('No write or private activity RPC should run on a link-only boot');}},
  renderAuth:(...args)=>{calls.auth.push(args);context.viewRun();},shell:html=>calls.shell.push(html),finishRoom:()=>calls.finish++,
  window:{SotaConnections:{preview:()=>assert.fail('No example route expected')},SotaCircles:{route:()=>{calls.route.push(hash);return true;},resumeDraft:()=>assert.fail('No creation draft should auto-resume over a link')}},
  document:{documentElement:{style:{setProperty:()=>assert.fail('No personal skin should be applied before a link opens')}}},URLSearchParams,sessionStorage:{getItem:()=>''},history:{replaceState:()=>{}},render:()=>assert.fail('Link-only boot should not open a private app view')
 });
 vm.runInContext(viewSource+'\n'+bootSource,context,{filename:'actual-circle-route-boot.js'});
 return {context,S,calls};
}

test('signed-in public circle and friends links dispatch without reading a private profile',async()=>{
 for(const hash of ['#circle-graph=42','#friends-graph=owner']){
  const h=bootHarness({hash,throwProfile:true});await h.context.boot();
  assert.equal(h.calls.profile,0);assert.deepEqual(h.calls.route,[hash]);assert.equal(h.S.user.id,own);assert.equal(h.S.me,null);
  assert.equal(h.calls.finish,0);assert.equal(h.calls.auth.length,0);assert.equal(h.calls.rpc.length,0);assert.match(h.calls.shell[0],/A public view/);
 }
});

test('guest public links keep the normal account entry behind the public viewer without a private read',async()=>{
 for(const hash of ['#circle-graph=42','#friends-graph=owner']){
  const h=bootHarness({hash,session:null,throwProfile:true});await h.context.boot();
  assert.deepEqual(h.calls.auth,[['in',false]]);assert.deepEqual(h.calls.route,[hash]);assert.equal(h.calls.profile,0);assert.equal(h.calls.rpc.length,0);assert.equal(h.S.user,null);
 }
});

test('offline public links show the entry and public route without waiting on account or profile requests',async()=>{
 const h=bootHarness({online:false,throwProfile:true,getSession:()=>assert.fail('Offline boot must not request a session')});await h.context.boot();
 assert.deepEqual(h.calls.auth,[['in',false]]);assert.deepEqual(h.calls.route,['#circle-graph=42']);assert.equal(h.calls.profile,0);
});

test('an invitation still requires the signed-in account profile and never auto-joins',async()=>{
 const failed=bootHarness({hash:'#circle-invite=0123456789',profileError:{code:'42501'}});await failed.context.boot();
 assert.equal(failed.calls.profile,1);assert.equal(failed.calls.route.length,0);assert.match(failed.calls.shell[0],/Connection interrupted/);assert.equal(failed.calls.rpc.length,0);
 const incomplete=bootHarness({hash:'#circle-invite=0123456789',profile:null});await incomplete.context.boot();
 assert.equal(incomplete.calls.profile,1);assert.equal(incomplete.calls.finish,1);assert.equal(incomplete.calls.route.length,0);assert.equal(incomplete.calls.rpc.length,0);
 const ready=bootHarness({hash:'#circle-invite=0123456789'});await ready.context.boot();
 assert.equal(ready.calls.profile,1);assert.equal(ready.S.me.id,own);assert.deepEqual(ready.calls.route,['#circle-invite=0123456789']);assert.equal(ready.calls.rpc.length,0);
});

test('a stale session response cannot open a public route after the app view changes',async()=>{
 const gate=deferred(),h=bootHarness({throwProfile:true,getSession:()=>gate.promise});const pending=h.context.boot();
 h.S.tab='friends';h.context.viewRun();gate.resolve({data:{session:{user:{id:own}}}});await pending;
 assert.equal(h.calls.route.length,0);assert.equal(h.calls.profile,0);assert.equal(h.calls.shell.length,0);
});

function memberHarness({user={id:own},me=null}={}){
 const calls={stored:[],history:[],boot:0,rooms:[]},S={user,me};
 const context=vm.createContext({S,sessionStorage:{setItem:(...args)=>calls.stored.push(args)},history:{replaceState:(...args)=>calls.history.push(args)},location:{pathname:'/',search:'?source=public'},boot:()=>{calls.boot++;},openRoom:handle=>calls.rooms.push(handle)});
 vm.runInContext(memberSource,context,{filename:'actual-circle-member-navigation.js'});return {context,S,calls};
}
test('public graph member navigation bootstraps unverified profiles instead of opening a private room',()=>{
 for(const options of [{user:null,me:null},{user:{id:own},me:null},{user:{id:own},me:{id:other}}]){
  const h=memberHarness(options);h.context.openCircleMember('alice');assert.deepEqual(h.calls.stored,[['sota-find-mate','alice']]);assert.equal(h.calls.boot,1);assert.equal(h.calls.rooms.length,0);assert.deepEqual(h.calls.history,[[null,'','/?source=public']]);
 }
 const ready=memberHarness({me:{id:own,handle:'owner'}});ready.context.openCircleMember('alice');assert.deepEqual(ready.calls.rooms,['alice']);assert.equal(ready.calls.boot,0);assert.equal(ready.calls.stored.length,0);
});

function changedHarness(){
 const composer={value:'An unsent message'},graph={},nodes={'#crew-type-label':{textContent:''},'#crew-avatar':{textContent:'',style:{}},'#crew-graph':graph,'#cm':composer};
 const calls={skins:[],graphs:[],kava:[]},S={tab:'crews',crew:'42',user:{id:own},me:{id:own,room_css:'Personal room skin'}};
 const context=vm.createContext({S,$:selector=>nodes[selector],window:{SotaCircleTypes:types,BulaSkins:skins,SotaCircles:{applyGroupSkin:group=>calls.skins.push(group),mountGroupGraph:(...args)=>calls.graphs.push(args),stop:()=>assert.fail('Appearance updates must not stop the active room')},SotaKavaUI:{updateGroupAppearance:group=>calls.kava.push(group),stop:()=>assert.fail('Appearance updates must not stop a circle')}},render:()=>assert.fail('Appearance update must not render the room again'),shell:()=>assert.fail('Appearance update must not replace the room DOM')});
 vm.runInContext(changedSource,context,{filename:'actual-circle-group-changed.js'});return {context,S,calls,nodes,composer,graph};
}
test('Village settings update the group skin, label and graph without replacing an unsent composer',()=>{
 const h=changedHarness(),group={id:42,name:'Our people',circle_type:'lotu'},before=JSON.stringify(h.S.me);Object.freeze(h.S.me);h.context.circleGroupChanged(group);
 assert.match(h.nodes['#crew-type-label'].textContent,/Lotu Circle.*White Masi/);assert.equal(h.nodes['#crew-avatar'].textContent,types.get('lotu').emoji);assert.equal(h.nodes['#crew-avatar'].style.background,types.get('lotu').displayAccent+'22');
 assert.deepEqual(h.calls.skins,[group]);assert.equal(h.calls.graphs.length,1);assert.equal(h.calls.graphs[0][0],h.graph);assert.equal(h.calls.graphs[0][1],group);assert.equal(h.nodes['#cm'],h.composer);assert.equal(h.composer.value,'An unsent message');assert.equal(JSON.stringify(h.S.me),before);
});

test('group settings for another Village do nothing, while Talanoa updates delegate without rendering or stopping',()=>{
 const h=changedHarness(),group={id:99,circle_type:'kava'};h.context.circleGroupChanged(group);assert.equal(h.calls.skins.length,0);assert.equal(h.calls.graphs.length,0);
 h.S.tab='circles';h.context.circleGroupChanged(group);assert.deepEqual(h.calls.kava,[group]);assert.equal(h.calls.skins.length,0);assert.equal(h.composer.value,'An unsent message');
});

test('Talanoa applies a fresh group token skin only to the matching live group and leaves personal settings alone',()=>{
 const styles=new Map(),host={dataset:{},style:{setProperty:(k,v)=>styles.set(k,v)}},banner={hidden:true,textContent:''},invite={},calls=[];
 const profile=Object.freeze({id:own,room_css:'Personal skin remains'}),context=vm.createContext({guest:false,snapshot:{circle:{crew_id:42}},S:{me:profile},q:selector=>({'.kava-room':host,'#kc-group-type':banner,'#kc-group-invite':invite})[selector],root:{SotaCircleTypes:types,BulaSkins:skins,SotaCircles:{openInvite:group=>calls.push(group)}}});
 vm.runInContext(sessionSkinSource,context,{filename:'actual-talanoa-session-skin.js'});
 const group={id:42,name:'Our church friends',circle_type:'lotu'};context.updateGroupAppearance({id:99,circle_type:'kava'});assert.equal(styles.size,0);
 context.guest=true;context.updateGroupAppearance(group);assert.equal(styles.size,0);context.guest=false;context.updateGroupAppearance(group);
 assert.equal(host.dataset.circleSkin,'lotu');assert.equal(styles.get('--bv-accent'),types.get('lotu').displayAccent);assert.equal(styles.get('--bv-art'),skins.tokens({id:types.get('lotu').skin})['--bv-art']);assert.match(styles.get('--bv-art'),/\/photographic-20261029\/[a-z0-9-]+\.webp/);assert.equal(banner.hidden,false);assert.match(banner.textContent,/Lotu Circle.*Our church friends.*White Masi/);assert.equal(profile.room_css,'Personal skin remains');
 invite.onclick();assert.deepEqual(calls,[group]);
});
