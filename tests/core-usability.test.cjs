const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const section=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert(a>=0&&b>a,'Current source section: '+start+' → '+end);return html.slice(a,b);};
const helpers=section('// Every view owns its pending reads','function mediaMarkup');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(extra={}){
  const ctx={S:{tab:'moments',user:{id:'owner'},me:{handle:'sina'},roomHandle:null,crew:null,pending:[],friends:[]},esc,
    shell:body=>{ctx.screen=body;},screen:'',ago:()=>'',mediaMarkup:()=>'',toast:()=>{},window:{},...extra};
  // These tests own the app's view logic. The circle module boundary delegates
  // to the existing RPC fixture so failures still exercise the real view catch.
  ctx.window.SotaCircles??={stop(){},list:async()=>{const result=await ctx.sb.rpc('bv_circle_groups');if(result.error)throw result.error;return result.data;}};
  vm.createContext(ctx);vm.runInContext(helpers,ctx);return ctx;
}
function load(ctx,start,end){vm.runInContext(section(start,end),ctx);}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const checks=[];
function check(name,fn){checks.push([name,fn]);}

check('late Moments responses cannot replace a newer view or a newer request',async()=>{
  const requests=[deferred(),deferred()];let reads=0;
  const ctx=harness({sb:{rpc:()=>requests[reads++].promise}});
  load(ctx,'async function viewMoments()','async function postMoment()');
  const first=ctx.viewMoments();const second=ctx.viewMoments();
  requests[1].resolve({data:[]});await second;const latest=ctx.screen;
  requests[0].resolve({data:[{id:1,body:'OUTDATED',author:'mate'}]});await first;
  assert.equal(ctx.screen,latest);assert(!ctx.screen.includes('OUTDATED'));
  const other=deferred();ctx.sb.rpc=()=>other.promise;const pending=ctx.viewMoments();
  ctx.S.tab='friends';ctx.viewRun();ctx.screen='Friends screen';other.resolve({data:[]});await pending;
  assert.equal(ctx.screen,'Friends screen');
});

check('Moments and Koro failures expose a retry instead of a false empty state',async()=>{
  const ctx=harness({sb:{rpc:async()=>({data:null,error:{message:'offline'}})}});
  load(ctx,'async function viewMoments()','async function postMoment()');
  await ctx.viewMoments();assert.match(ctx.screen,/Connection interrupted/);assert.match(ctx.screen,/onclick="viewMoments\(\)"/);assert(!ctx.screen.includes('Nothing yet'));
  ctx.S.tab='crews';load(ctx,'async function circleGroupsResult()','function circleGroupChanged(');load(ctx,'async function viewCrews()','async function makeCrew()');await ctx.viewCrews();
  assert.match(ctx.screen,/onclick="viewCrews\(\)"/);assert(!ctx.screen.includes('No Koro yet'));
  ctx.sb.rpc=async()=>{throw new Error('Connection lost');};await ctx.viewCrews();assert.match(ctx.screen,/Connection interrupted/);
});

check('metadata failures preserve known friends and show explicit requests/friends retry states',async()=>{
  const known={id:'friend',handle:'friend'};
  const ctx=harness({sb:{rpc:async()=>({data:null,error:{message:'offline'}})},$:()=>({addEventListener(){}})});
  ctx.S.tab='friends';ctx.S.friends=[known];ctx.S.pending=[{friendship_id:1}];
  load(ctx,'async function refreshMeta()','/* ================= WALLET');await ctx.refreshMeta();
  assert.equal(ctx.S.friends[0],known);assert.equal(ctx.S.pending.length,1);
  load(ctx,'async function viewFriends()','async function search()');await ctx.viewFriends();
  assert.match(ctx.screen,/Friend requests could not load/);assert.match(ctx.screen,/Your friends could not load/);assert(!ctx.screen.includes('Nobody yet'));
});

check('search ignores stale queries and late results after leaving Friends',async()=>{
  const reads=[];const input={value:'sina'},results={textContent:'',innerHTML:''};
  const ctx=harness({$:selector=>selector==='#s-q'?input:selector==='#s-res'?results:null,
    sb:{from:()=>({select:()=>({ilike:()=>({neq:()=>({limit:()=>{const next=deferred();reads.push(next);return next.promise;}})})})})}});
  ctx.S.tab='friends';load(ctx,'async function search()','async function respond(');ctx.viewRun();
  const first=ctx.search();input.value='jo';const second=ctx.search();
  reads[1].resolve({data:[{id:'jo',handle:'jo',display_name:'Jo'}]});await second;const latest=results.innerHTML;
  reads[0].resolve({data:[{id:'sina',handle:'sina',display_name:'Sina'}]});await first;assert.equal(results.innerHTML,latest);
  input.value='donu';const third=ctx.search();ctx.S.tab='pulse';ctx.viewRun();results.innerHTML='Untouched';
  reads[2].resolve({data:[{handle:'donu'}]});await third;assert.equal(results.innerHTML,'Untouched');
  ctx.S.tab='friends';ctx.viewRun();const failed=ctx.search();reads[3].resolve({data:null,error:{message:'offline'}});await failed;
  assert.match(results.innerHTML,/Search could not load/);assert(!results.innerHTML.includes('Nobody with that handle'));
});

check('Koro sends retain a failed draft, allow retry, and suppress duplicate taps',async()=>{
  const input={value:'Please keep this message',disabled:false},button={disabled:false},errorBox={hidden:true,textContent:''};
  let request=deferred(),inserts=0,renders=0;
  const ctx=harness({$:selector=>({'#cm':input,'#cm-send':button,'#cm-error':errorBox}[selector]),
    sb:{from:()=>({insert:()=>{inserts++;return request.promise;}})},render:()=>{renders++;}});
  ctx.S.tab='crews';ctx.S.crew=42;ctx.viewRun();load(ctx,'async function sendMsg(cid)','/* ================= FRIENDS');
  const first=ctx.sendMsg(42);assert(input.disabled);assert(button.disabled);await ctx.sendMsg(42);assert.equal(inserts,1);
  request.resolve({error:{message:'offline'}});await first;
  assert.equal(input.value,'Please keep this message');assert.equal(renders,0);assert.equal(errorBox.hidden,false);assert.match(errorBox.textContent,/text is still here/);assert(!input.disabled);assert(!button.disabled);
  request=deferred();const retry=ctx.sendMsg(42);request.resolve({error:null});await retry;
  assert.equal(inserts,2);assert.equal(input.value,'');assert.equal(renders,1);
});

check('a completed Koro send cannot rerender a different route',async()=>{
  const request=deferred(),input={value:'Hello'},button={},errorBox={};let renders=0;
  const ctx=harness({$:selector=>({'#cm':input,'#cm-send':button,'#cm-error':errorBox}[selector]),sb:{from:()=>({insert:()=>request.promise})},render:()=>renders++});
  ctx.S.tab='crews';ctx.S.crew=42;ctx.viewRun();load(ctx,'async function sendMsg(cid)','/* ================= FRIENDS');
  const pending=ctx.sendMsg(42);ctx.S.tab='moments';ctx.viewRun();request.resolve({error:null});await pending;assert.equal(renders,0);
});

check('an old owner send cannot unlock the new owner pending send',async()=>{
  const requests=[deferred(),deferred()];let inserts=0,renders=0;
  let input={value:'Old owner message'},button={},errorBox={};
  const ctx=harness({$:selector=>({'#cm':input,'#cm-send':button,'#cm-error':errorBox}[selector]),
    sb:{from:()=>({insert:()=>requests[inserts++].promise})},render:()=>renders++});
  ctx.S.tab='crews';ctx.S.crew=42;ctx.viewRun();load(ctx,'async function sendMsg(cid)','/* ================= FRIENDS');
  const oldSend=ctx.sendMsg(42);
  // Owner cleanup releases the old UI lock, then the new owner opens their Koro.
  ctx.S.sendingMessage=false;ctx.S.user={id:'new-owner'};ctx.viewRun();
  input={value:'New owner message'};button={};errorBox={};
  const newSend=ctx.sendMsg(42),newToken=ctx.S.sendingMessage;
  assert(newToken);assert(button.disabled);assert.equal(inserts,2);
  requests[0].resolve({error:null});await oldSend;
  assert.equal(ctx.S.sendingMessage,newToken);assert(button.disabled);assert(input.disabled);assert.equal(renders,0);
  await ctx.sendMsg(42);assert.equal(inserts,2);
  requests[1].resolve({error:null});await newSend;
  assert.equal(ctx.S.sendingMessage,false);assert.equal(inserts,2);assert.equal(renders,1);
});

check('clipboard confirmation waits for success and rejection reveals a selectable fallback',async()=>{
  const request=deferred(),notices=[],fallback={hidden:true},input={focused:false,selected:false,focus(){this.focused=true;},select(){this.selected=true;}};
  const ctx=harness({navigator:{clipboard:{writeText:()=>request.promise}},document:{getElementById:id=>id==='fallback'?fallback:input},toast:value=>notices.push(value)});
  const pending=ctx.copyText('CODE','Join code copied','fallback','code');assert.equal(notices.length,0);request.reject(new Error('Denied'));await pending;
  assert.equal(notices.length,0);assert.equal(fallback.hidden,false);assert(input.focused&&input.selected);
  ctx.navigator.clipboard.writeText=async()=>{};await ctx.copyText('CODE','Join code copied','fallback','code');assert.deepEqual(notices,['Join code copied']);
});

check('late boot profile reads cannot replace a newer sign-in screen',async()=>{
  const profile=deferred();let renders=0;
  const ctx=harness({navigator:{onLine:true},document:{documentElement:{style:{setProperty(){}}}},sessionStorage:{getItem:()=>''},
    sb:{auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:()=>profile.promise})})}),rpc:()=>{}},
    renderAuth:()=>{ctx.viewRun();ctx.screen='New sign-in screen';},render:()=>renders++});
  load(ctx,'async function boot(){','/* Signed in, but no room yet.');
  const pending=ctx.boot();await tick();ctx.renderAuth();profile.resolve({data:{handle:'owner'},error:null});await pending;
  assert.equal(renders,0);assert.equal(ctx.screen,'New sign-in screen');
});

check('auth owner changes immediately clear member state and defer boot beyond the callback',async()=>{
  let callback,boots=0,authScreens=0,clears=0,studioCloses=0,stops=0,circleStops=0,insideCallback=false;
  const tasks=[];
  const ctx=harness({sb:{auth:{onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}};}}},
    window:{SotaCircles:{stop(){circleStops++;}},SotaConnections:{stop(){stops++;}},SotaKavaUI:{stop(){stops++;}},BulaSkinStudio:{closeForOwnerChange(){studioCloses++;}}},
    app:{set textContent(v){if(v==='')clears++;}},setTimeout:fn=>tasks.push(fn),
    boot:()=>{assert(!insideCallback);boots++;},renderAuth:()=>{assert(!insideCallback);authScreens++;}});
  ctx.S.friends=[{handle:'private-friend'}];ctx.S.pending=[{id:1}];ctx.S.crew=42;ctx.S.wallet={balance_minor:1234};
  ctx.viewRun();const oldView=ctx.viewRun(false);ctx.installAuthLifecycle();
  const emit=(event,id)=>{insideCallback=true;callback(event,id?{user:{id}}:null);insideCallback=false;};
  emit('INITIAL_SESSION','owner');emit('TOKEN_REFRESHED','owner');emit('SIGNED_IN','owner');
  assert.equal(clears,0);assert.equal(circleStops,0);assert.equal(tasks.length,0);assert.equal(ctx.S.friends.length,1);assert(ctx.currentView(oldView));
  emit('SIGNED_IN','new-owner');
  assert.equal(ctx.S.user,null);assert.equal(ctx.S.me,null);assert.equal(ctx.S.friends.length,0);assert.equal(ctx.S.pending.length,0);assert.equal(ctx.S.wallet,null);assert.equal(ctx.S.crew,null);assert.equal(ctx.S.roomHandle,null);
  assert.equal(clears,1);assert.equal(studioCloses,1);assert.equal(stops,2);assert.equal(circleStops,1);assert.equal(boots,0);assert(!ctx.currentView(oldView));
  tasks.shift()();assert.equal(boots,1);assert.equal(authScreens,0);
  ctx.S.user={id:'new-owner'};ctx.S.me={handle:'new-owner'};ctx.S.friends=[{handle:'private'}];
  emit('SIGNED_OUT');assert.equal(ctx.S.user,null);assert.equal(ctx.S.me,null);assert.equal(ctx.S.friends.length,0);assert.equal(authScreens,0);
  tasks.shift()();assert.equal(authScreens,1);assert.equal(boots,1);assert.equal(circleStops,2);
});

check('a sign-out supersedes a queued account-switch boot',async()=>{
  let callback,boots=0,authScreens=0;const tasks=[];
  const ctx=harness({sb:{auth:{onAuthStateChange:fn=>{callback=fn;return {};}}},window:{},app:{set textContent(v){}},setTimeout:fn=>tasks.push(fn),boot:()=>boots++,renderAuth:()=>authScreens++});
  ctx.installAuthLifecycle();callback('SIGNED_IN',{user:{id:'other'}});callback('SIGNED_OUT',null);
  tasks.forEach(fn=>fn());assert.equal(boots,0);assert.equal(authScreens,1);
});

check('core markup keeps a main landmark, native social controls, named inputs and announced errors',async()=>{
  assert.match(html,/<main id="view" tabindex="-1">/);assert.match(html,/class="sota-skip-link" href="#view"/);
  assert.match(html,/<nav class="bottom glass" aria-label="Main navigation">/);assert.match(html,/aria-current="\$\{S\.tab===k\?'page':'false'\}"/);
  assert.match(html,/<button type="button" class="pulse-item" onclick="openRoom/);
  assert.match(html,/<button type="button" class="pulse-item" onclick="S\.crew=/);
  for(const id of ['sp-a','m-body','m-url','c-code','cm','s-q'])assert.match(html,new RegExp('id="'+id+'" aria-label="'));
  // The Pulse composer moved to the Talanoa Wall module; its textarea is labelled there.
  const wall=fs.readFileSync(path.join(__dirname,'../sota-pulse.js'),'utf8');
  assert.match(wall,/<textarea name="body" maxlength="' \+ MAX \+ '" rows="' \+ \(opts\.replyTo \|\| !window\.SotaSere \? 2 : 1\) \+ '" aria-label="/);
  // Circle name/type/privacy inputs now come from the actual shared factory.
  const circleContext=vm.createContext({SotaCircleTypes:require('../circle-types.js')});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../circle-groups.js'),'utf8'),circleContext);
  circleContext.SotaCircles.init({state:{user:{id:'owner'}},client:{auth:{}}});
  const circleForm=circleContext.SotaCircles.createHTML();
  const circleName=/<input\b[^>]*\bid="([^"]+)"[^>]*\bdata-tc-name\b/.exec(circleForm);assert(circleName,'Named native circle input is rendered');
  assert(circleForm.includes('<label for="'+circleName[1]+'">Circle name</label>'));
  for(const field of ['type','visibility']){const select=new RegExp('<select\\b[^>]*\\bid="([^"]+)"[^>]*\\bdata-tc-'+field+'\\b').exec(circleForm);assert(select,'Native '+field+' select is rendered');assert(circleForm.includes('<label for="'+select[1]+'">'));}
  for(const id of ['f-handle','f-name','f-year'])assert.match(html,new RegExp('<label for="'+id+'">'));
  assert.match(html,/id="a-err" role="alert"/);assert.match(html,/id="f-err" role="alert"/);assert.match(html,/id="cm-error" role="alert"/);
  const ctx=harness({document:{documentElement:{style:{setProperty(){}}}},window:{BulaSkinStudio:{apply(){}}},sb:{rpc:async()=>({data:{found:true,visible:true,is_me:true,profile:{handle:'sina'},top:[{slot:1,handle:'mate',avatar_emoji:'🌺'}]},error:null})}});
  load(ctx,'async function viewRoom()','// Every view owns its pending reads');await ctx.viewRoom();
  assert.match(ctx.screen,/<button type="button" class="topslot filled"/);assert.match(ctx.screen,/aria-label="Visit @mate's room, Top Mate 1"/);
});

(async()=>{for(const [name,fn] of checks){await fn();console.log('PASS '+name);}console.log(checks.length+' core usability checks passed');})().catch(error=>{console.error(error);process.exitCode=1;});
