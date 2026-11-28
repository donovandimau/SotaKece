'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const catalogue=require('../circle-types.js');
const skins=require('../skins.js');
const source=fs.readFileSync(path.join(__dirname,'../circle-groups.js'),'utf8');
const own='61025000-0000-4000-8000-000000000001',other='61025000-0000-4000-8000-000000000002';
const group=(patch={})=>({id:42,name:'Our friends',owner:own,join_code:'INVITE_1234',members:2,last_at:null,circle_type:'koro',skin_id:'village',graph_visibility:'private',show_on_graph:false,...patch});
const graph=(patch={})=>({kind:'circle',title:'Our friends',visibility:'public',nodes:[{id:'group:42',type:'group',label:'Our friends',emoji:'🪸'},{id:'person:alice',type:'person',label:'Alice',handle:'alice',emoji:'🌺'}],edges:[{source:'group:42',target:'person:alice',type:'member'}],...patch});
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function plainHarness({user={id:own},responses={}}={}){
  const state={user,me:user?{id:user.id,handle:'alice',room_css:'private-profile-css'}:null},calls=[],authCalls=[],rendered=[],timers=new Map();let identity=user?.id||null,authListener,timer=0;
  const root=vm.createContext({SotaCircleTypes:catalogue,BulaSkins:skins,setTimeout:fn=>{timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id)});
  const client={auth:{getUser:async()=>({data:{user:identity?{id:identity}:null},error:null}),onAuthStateChange(fn){authListener=fn;return {data:{subscription:{unsubscribe(){}}}};}},rpc:async(name,args)=>{calls.push({name,args});const value=responses[name];if(typeof value==='function')return value(args);if(value!==undefined)return value;return {data:null,error:{code:'PGRST202',message:'PRIVATE_DATABASE_DETAIL'}};}};
  vm.runInContext(source,root,{filename:'actual-circle-groups.js'});
  const api=root.SotaCircles;
  const context={client,state,auth:(...args)=>authCalls.push(args),render:()=>rendered.push(true),openRoom:handle=>calls.push({room:handle})};api.init(context);
  return {root,api,context,state,calls,authCalls,rendered,timers,set identity(value){identity=value;},authChange(value){identity=value;authListener(value?'SIGNED_IN':'SIGNED_OUT',value?{user:{id:value}}:null);}};
}

test('member list accepts only bounded known metadata and strips unneeded server fields',async()=>{
  const h=plainHarness({responses:{bv_circle_groups:{data:[group({secret:'not exposed'})],error:null}}});
  const rows=await h.api.list();assert.equal(rows.length,1);assert.equal(rows[0].circle_type,'koro');assert.equal(rows[0].skin_id,'village');assert.equal(rows[0].secret,undefined);assert.equal(rows[0].show_on_graph,false);
  assert.deepEqual(h.calls.map(call=>call.name),['bv_circle_groups']);
  h.api.stop();
});
test('only a missing new RPC falls back to a private legacy Village with unknown owner',async()=>{
  const h=plainHarness({responses:{bv_circle_groups:{data:null,error:{code:'PGRST202'}},bv_my_crews:{data:[{id:42,name:'Legacy',join_code:'LEGACY_CODE',owner:own,graph_visibility:'public',show_on_graph:true}],error:null}}});
  const [row]=await h.api.list();assert.equal(row.legacy,true);assert.equal(row.owner,null);assert.equal(row.graph_visibility,'private');assert.equal(row.show_on_graph,false);assert.equal(row.skin_id,'village');
  assert.deepEqual(h.calls.map(call=>call.name),['bv_circle_groups','bv_my_crews']);h.api.stop();
});
test('permission and transport failures propagate rather than masquerading as legacy or empty groups',async()=>{
  const error={code:'42501',message:'PRIVATE_DATABASE_DETAIL'},h=plainHarness({responses:{bv_circle_groups:{data:null,error}}});
  await assert.rejects(h.api.list(),value=>value===error);assert.deepEqual(h.calls.map(call=>call.name),['bv_circle_groups']);h.api.stop();
});
test('malformed, duplicate, oversized and unknown type metadata fails closed',async()=>{
  for(const data of [[group({circle_type:'not-a-type'})],[group({skin_id:'school-usp'})],[group({graph_visibility:'everybody'})],[group({show_on_graph:'yes'})],[group(),group()],Array.from({length:201},(_,i)=>group({id:i+1})),{}]){
    const h=plainHarness({responses:{bv_circle_groups:{data,error:null}}});await assert.rejects(h.api.list());h.api.stop();
  }
});
test('an account change prevents a late private member list from being returned',async()=>{
  const gate=deferred(),h=plainHarness({responses:{bv_circle_groups:()=>gate.promise}}),pending=h.api.list();
  h.state.user={id:other};h.authChange(other);gate.resolve({data:[group()],error:null});await assert.rejects(pending);h.api.stop();
});
test('create markup defaults to private with no implied personal-graph consent',()=>{
  const h=plainHarness(),html=h.api.createHTML();assert(html.includes('value="private" selected'));assert(html.includes('data-tc-consent'));assert(!/data-tc-consent[^>]*checked/.test(html));assert(html.includes('Automatic skin: My Village'));assert(!html.includes('PRIVATE_'));h.api.stop();
});
test('applying a group skin uses a fresh allowlisted settings object and never alters a member profile',()=>{
  const h=plainHarness(),before=JSON.stringify(h.state.me),applied=[];Object.freeze(h.state.me);h.root.BulaSkinStudio={applyChat:profile=>applied.push(profile)};
  const settings=h.api.applyGroupSkin(group({circle_type:'kava',skin_id:'grog'}));assert.equal(settings.id,'grog');assert.equal(applied.length,1);assert.notEqual(applied[0],h.state.me);assert.equal(skins.read(applied[0].room_css).settings.id,'grog');assert.equal(JSON.stringify(h.state.me),before);h.api.stop();
});

let JSDOM;
try{({JSDOM}=require('jsdom'));}catch(_){try{({JSDOM}=require(path.join(__dirname,'../call-controls/test-tools/node_modules/jsdom')));}catch(_){}}
const domTest=(name,fn)=>test(name,{skip:!JSDOM?'Optional jsdom fixture is not installed':false},fn);
function harness(options={}){
  const dom=new JSDOM('<!doctype html><html lang="en"><body><button id="opener">Invite</button><div id="host"></div></body></html>',{url:'https://sotakece.com/?token=PRIVATE_TOKEN',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,state={user:options.guest?null:{id:own},me:options.guest?null:{id:own,handle:'alice',room_css:'private-profile-css'}},calls=[],authCalls=[],rendered=[],copied=[],timers=new Map(),responses=options.responses||{};let authListener,identity=state.user?.id||null,timer=0;
  w.setTimeout=(fn,delay)=>{timers.set(++timer,{fn,delay});return timer;};w.clearTimeout=id=>timers.delete(id);
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  Object.defineProperty(w.navigator,'onLine',{configurable:true,value:true});Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{writeText:async value=>copied.push(value)}});
  w.SotaCircleTypes=catalogue;w.BulaSkins=skins;
  const client={auth:{getUser:async()=>({data:{user:identity?{id:identity}:null},error:null}),onAuthStateChange(fn){authListener=fn;return {data:{subscription:{unsubscribe(){}}}};}},rpc:async(name,args)=>{calls.push({name,args});const value=responses[name];if(typeof value==='function')return value(args);if(value!==undefined)return value;return {data:null,error:{code:'PGRST202',message:'PRIVATE_DATABASE_DETAIL'}};}};
  w.eval(source);const api=w.SotaCircles;api.init({client,state,auth:(...args)=>authCalls.push(args),render:()=>rendered.push(true),openRoom:handle=>calls.push({room:handle}),...(options.groupChanged?{groupChanged:options.groupChanged}:{})});
  return {w,api,client,state,calls,authCalls,rendered,copied,timers,responses,host:w.document.querySelector('#host'),q:selector=>w.document.querySelector(selector),
    get dialog(){return w.document.querySelector('.tc-dialog');},submit(selector){this.q(selector).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));},
    set identity(value){identity=value;},authChange(value,event){identity=value;authListener(event||(value?'SIGNED_IN':'SIGNED_OUT'),value?{user:{id:value}}:null);},close(){api.stop();dom.window.close();}};
}
domTest('guest type preview works, but creation asks for an account without writing or sharing',async()=>{
  const h=harness({guest:true});try{
    await h.api.openInvite();h.q('[data-tc-type]').value='lotu';h.q('[data-tc-type]').dispatchEvent(new h.w.Event('change'));
    assert(h.dialog.textContent.includes('Lotu Circle'));assert(h.dialog.textContent.includes('White Masi'));assert.equal(h.q('[data-tc-consent]').checked,false);
    h.q('[data-tc-name]').value='Friends';h.submit('[data-tc-create]');await flush();assert.deepEqual(h.authCalls,[['up',true]]);assert.equal(h.calls.length,0);assert.equal(h.dialog,null);
  }finally{h.close();}
});
domTest('circle creation validates the current authenticated owner and ignores duplicate pending submits',async()=>{
  const gate=deferred(),h=harness({responses:{bv_circle_create_group:()=>gate.promise}}),created=[];try{
    h.host.innerHTML=h.api.createHTML();h.api.mountCreate(h.host,value=>created.push(value));h.q('[data-tc-name]').value='Friends';h.submit('[data-tc-create]');h.submit('[data-tc-create]');await flush();
    const calls=h.calls.filter(call=>call.name==='bv_circle_create_group');assert.equal(calls.length,1);assert.equal(calls[0].args.p_type,'koro');assert.equal(calls[0].args.p_graph_visibility,'private');assert.equal(calls[0].args.p_show_on_graph,false);assert.equal(calls[0].args.p_expected_owner,own);
    gate.resolve({data:group(),error:null});await flush();assert.equal(created.length,1);assert.equal(created[0].id,42);
  }finally{h.close();}
});
domTest('mismatched auth blocks all writes and stale create responses never update a new account',async()=>{
  const h=harness();try{
    h.host.innerHTML=h.api.createHTML();h.api.mountCreate(h.host,()=>assert.fail('Unexpected creation'));h.q('[data-tc-name]').value='Friends';h.identity=other;h.submit('[data-tc-create]');await flush();assert.equal(h.calls.length,0);assert(!h.host.textContent.includes('PRIVATE_DATABASE_DETAIL'));
  }finally{h.close();}
  const gate=deferred(),late=harness({responses:{bv_circle_create_group:()=>gate.promise}}),created=[];try{
    late.host.innerHTML=late.api.createHTML();late.api.mountCreate(late.host,value=>created.push(value));late.q('[data-tc-name]').value='Friends';late.submit('[data-tc-create]');await flush();late.state.user={id:other};late.authChange(other);gate.resolve({data:group(),error:null});await flush();assert.equal(created.length,0);assert.equal(late.host.childElementCount,0);
  }finally{late.close();}
});
domTest('invitation reads show sanitized saved metadata and never join automatically',async()=>{
  const h=harness({guest:true,responses:{bv_circle_invitation:{data:{id:42,name:'<img src=x onerror=alert(1)>',circle_type:'lotu',skin_id:'masi-white',graph_visibility:'public',members:['PRIVATE_MEMBER']},error:null}}});try{
    h.w.location.hash='#circle-invite=INVITE_1234';assert.equal(h.api.route(),true);await flush();assert(h.dialog.textContent.includes('Lotu Circle'));assert.equal(h.dialog.querySelectorAll('img').length,0);assert(!h.dialog.textContent.includes('PRIVATE_MEMBER'));assert.deepEqual(h.calls.map(call=>call.name),['bv_circle_invitation']);
    h.q('[data-tc-sign-in]').click();assert.deepEqual(h.authCalls,[['in',true]]);assert.equal(h.w.location.hash,'#circle-invite=INVITE_1234');assert.equal(h.dialog,null);
  }finally{h.close();}
});
domTest('joining an invitation is explicit, unchecked by default, and navigates only after server confirmation',async()=>{
  const h=harness({responses:{bv_circle_invitation:{data:group(),error:null},bv_join_circle:{data:42,error:null}}});try{
    h.w.location.hash='#circle-invite=INVITE_1234';h.api.route();await flush();assert.equal(h.q('[data-tc-consent]').checked,false);assert(!h.calls.some(call=>call.name==='bv_join_circle'));
    h.submit('[data-tc-join-form]');await flush();const joined=h.calls.find(call=>call.name==='bv_join_circle');assert.equal(joined.args.p_show_on_graph,false);assert.equal(joined.args.p_expected_owner,own);assert.equal(h.state.crew,42);assert.equal(h.state.tab,'crews');assert.equal(h.rendered.length,1);assert.equal(h.w.location.hash,'');
  }finally{h.close();}
});
domTest('owner preview changes never mislabel the saved invitation before successful settings save',async()=>{
  const saved=group(),h=harness({responses:{bv_circle_groups:{data:[saved],error:null},bv_circle_update_group:args=>({data:{id:42,circle_type:args.p_type,skin_id:catalogue.get(args.p_type).skin,graph_visibility:args.p_graph_visibility},error:null})}});try{
    await h.api.openInvite(saved);h.q('[data-tc-owner-type]').value='kava';h.q('[data-tc-owner-type]').dispatchEvent(new h.w.Event('change'));assert(h.q('[data-tc-pending-preview]').textContent.includes('Digital Kava Session'));assert(h.q('[data-tc-invitation-kind]').textContent.includes('Village Circle'));
    h.q('[data-tc-copy]').click();await flush();assert(h.copied[0].includes('Village Circle'));assert(!h.copied[0].includes('Digital Kava Session'));assert(h.copied[0].includes('https://sotakece.com/#circle-invite=INVITE_1234'));
    h.submit('[data-tc-owner-form]');await flush();assert.equal(h.calls.find(call=>call.name==='bv_circle_update_group').args.p_expected_owner,own);assert.equal(saved.circle_type,'kava');assert.equal(saved.skin_id,'grog');assert(h.q('[data-tc-invitation-kind]').textContent.includes('Digital Kava Session'));assert.equal(h.rendered.length,1);
  }finally{h.close();}
});
domTest('members cannot edit circle type and can save only their own appearance choice',async()=>{
  const saved=group({owner:other}),h=harness({responses:{bv_circle_groups:{data:[saved],error:null},bv_circle_graph_choice:{data:true,error:null}}});try{
    await h.api.openInvite(saved);assert.equal(h.q('[data-tc-owner-form]'),null);h.q('[data-tc-own-choice]').checked=true;h.submit('[data-tc-choice-form]');await flush();assert.equal(saved.show_on_graph,true);const choice=h.calls.find(call=>call.name==='bv_circle_graph_choice');assert.deepEqual(Object.keys(choice.args).sort(),['p_crew','p_expected_owner','p_visible']);assert.equal(choice.args.p_visible,true);assert.equal(choice.args.p_expected_owner,own);assert(!h.calls.some(call=>call.name==='bv_circle_update_group'));
  }finally{h.close();}
});
domTest('native share cancellation never copies and clipboard denial offers an actual selectable invitation',async()=>{
  const h=harness({responses:{bv_circle_groups:{data:[group()],error:null}}});try{
    Object.defineProperty(h.w.navigator,'share',{configurable:true,value:async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'});}});await h.api.openInvite(group());h.q('[data-tc-share]').click();await flush();assert.equal(h.copied.length,0);assert(h.q('[data-tc-status]').textContent.includes('cancelled'));
    Object.defineProperty(h.w.navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}});h.q('[data-tc-copy]').click();await flush();assert.equal(h.q('[data-tc-fallback]').hidden,false);assert(h.q('[data-tc-copy-value]').value.includes('INVITE_1234'));assert(!h.q('[data-tc-status]').textContent.includes('copied'));
  }finally{h.close();}
});
domTest('public personal graph links appear only after an explicit confirmed public save',async()=>{
  const gate=deferred(),h=harness({responses:{bv_my_graph_visibility:{data:'private',error:null},bv_set_graph_visibility:()=>gate.promise}});try{
    h.api.mountPersonalSettings(h.host);await flush();assert.equal(h.q('[data-tc-public-actions]').hidden,true);h.q('[data-tc-personal-visibility]').value='public';h.submit('[data-tc-personal-form]');await flush();assert.equal(h.q('[data-tc-public-actions]').hidden,true);assert.equal(h.calls.find(call=>call.name==='bv_set_graph_visibility').args.p_expected_owner,own);
    gate.resolve({data:'public',error:null});await flush();assert.equal(h.q('[data-tc-public-actions]').hidden,false);h.q('[data-tc-copy]').click();await flush();assert.deepEqual(h.copied,['https://sotakece.com/#friends-graph=alice']);assert(!h.copied[0].includes('PRIVATE_'));assert(!h.copied[0].includes('token='));
  }finally{h.close();}
});
domTest('missing personal settings stay unavailable without claiming a local public flag is saved',async()=>{
  const h=harness();try{h.api.mountPersonalSettings(h.host);await flush();assert.equal(h.q('[data-tc-personal-visibility]').value,'private');assert.equal(h.q('[data-tc-save]').disabled,true);assert.equal(h.q('[data-tc-public-actions]').hidden,true);assert(h.host.textContent.includes('unavailable'));assert(!h.host.textContent.includes('PRIVATE_DATABASE_DETAIL'));}finally{h.close();}
});
domTest('public circle routes always use the public-only RPC, including for the signed-in owner',async()=>{
  const h=harness({responses:{bv_public_circle_graph:{data:graph(),error:null}}});try{
    h.w.location.hash='#circle-graph=42';h.api.route();await flush();assert.deepEqual(h.calls.map(call=>call.name),['bv_public_circle_graph']);assert.equal(h.q('[data-tc-graph]').querySelectorAll('svg').length,1);assert(h.dialog.textContent.includes('Alice'));assert(!h.calls.some(call=>call.name==='bv_circle_graph'));
    h.q('[data-tc-copy]').click();await flush();assert.deepEqual(h.copied,['https://sotakece.com/#circle-graph=42']);
  }finally{h.close();}
});
domTest('public graph revocation clears previously rendered people and disables stale public sharing',async()=>{
  let reads=0;const h=harness({responses:{bv_public_circle_graph:()=>++reads===1?{data:graph(),error:null}:{data:null,error:{code:'42501',message:'PRIVATE_DATABASE_DETAIL'}}}});try{
    h.w.location.hash='#circle-graph=42';h.api.route();await flush();assert(h.dialog.textContent.includes('Alice'));h.q('[data-tc-refresh]').click();await flush();assert.equal(h.q('[data-tc-graph]').childElementCount,0);assert.equal(h.q('[data-tc-copy]').disabled,true);assert(!h.dialog.textContent.includes('Alice'));assert(!h.dialog.textContent.includes('PRIVATE_DATABASE_DETAIL'));
  }finally{h.close();}
});
domTest('a public route rejects a private graph payload rather than displaying its roster',async()=>{
  const h=harness({responses:{bv_public_circle_graph:{data:graph({visibility:'private'}),error:null}}});try{h.w.location.hash='#circle-graph=42';h.api.route();await flush();assert.equal(h.q('[data-tc-graph]').childElementCount,0);assert(!h.dialog.textContent.includes('Alice'));assert.equal(h.q('[data-tc-copy]').disabled,true);}finally{h.close();}
});
domTest('public graph node IDs and markup are constrained, and ignored fields never enter the DOM',async()=>{
  const malformed=graph({nodes:[{id:'group:42',type:'group',label:'Group'},{id:'person:'+own,type:'person',label:'PRIVATE_UUID'}]});
  const h=harness({responses:{bv_public_circle_graph:{data:malformed,error:null}}});try{h.w.location.hash='#circle-graph=42';h.api.route();await flush();assert.equal(h.q('[data-tc-graph]').childElementCount,0);assert(!h.dialog.textContent.includes(own));}finally{h.close();}
  const safe=graph();safe.nodes[1].label='<img src=x onerror=alert(1)>';safe.nodes[1].wallet='PRIVATE_WALLET';const escaped=harness({responses:{bv_public_circle_graph:{data:safe,error:null}}});try{escaped.w.location.hash='#circle-graph=42';escaped.api.route();await flush();assert.equal(escaped.dialog.querySelectorAll('img').length,0);assert(!escaped.dialog.textContent.includes('PRIVATE_WALLET'));}finally{escaped.close();}
});
domTest('member graph uses full member RPC but public button opens the separate public representation',async()=>{
  const saved=group({graph_visibility:'public'}),h=harness({responses:{bv_circle_groups:{data:[saved],error:null},bv_circle_graph:{data:graph({visibility:'private'}),error:null},bv_public_circle_graph:{data:graph({nodes:[{id:'group:42',type:'group',label:'Our friends'}],edges:[]}),error:null}}});try{
    h.api.mountGroupGraph(h.host,saved);await flush();assert(h.host.textContent.includes('Member view'));assert.equal(h.q('[data-tc-public-actions]').hidden,false);assert(h.calls.some(call=>call.name==='bv_circle_graph'));h.q('[data-tc-view]').click();await flush();assert(h.calls.some(call=>call.name==='bv_public_circle_graph'));assert(!h.dialog.textContent.includes('Alice'));assert(h.dialog.textContent.includes('0 visible people'));
  }finally{h.close();}
});
domTest('public polling never overlaps and stop ignores late responses',async()=>{
  const gate=deferred(),h=harness({responses:{bv_public_circle_graph:()=>gate.promise}});try{
    h.w.location.hash='#circle-graph=42';h.api.route();h.q('[data-tc-refresh]').click();h.q('[data-tc-refresh]').click();assert.equal(h.calls.filter(call=>call.name==='bv_public_circle_graph').length,1);h.api.stop();gate.resolve({data:graph(),error:null});await flush();assert.equal(h.dialog,null);assert.equal([...h.timers.values()].filter(timer=>timer.delay===15000).length,0);assert(!h.w.document.body.textContent.includes('Alice'));
  }finally{h.close();}
});
domTest('visible graph polling schedules one 15-second refresh and disposal removes that timer',async()=>{
  const h=harness({responses:{bv_public_circle_graph:{data:graph(),error:null}}});try{
    h.w.location.hash='#circle-graph=42';h.api.route();await flush();const polls=[...h.timers.values()].filter(timer=>timer.delay===15000);assert.equal(polls.length,1);
    polls[0].fn();await flush();assert.equal(h.calls.filter(call=>call.name==='bv_public_circle_graph').length,2);assert.equal([...h.timers.values()].filter(timer=>timer.delay===15000).length,1);
    h.api.stop();assert.equal([...h.timers.values()].filter(timer=>timer.delay===15000).length,0);
  }finally{h.close();}
});
domTest('route changes and account changes suppress late invitation or graph results',async()=>{
  const gate=deferred(),h=harness({responses:{bv_circle_invitation:()=>gate.promise}});try{h.w.location.hash='#circle-invite=INVITE_1234';h.api.route();h.w.location.hash='#other-flow';gate.resolve({data:group(),error:null});await flush();assert(!h.dialog.textContent.includes('Our friends'));h.api.route();assert.equal(h.dialog,null);assert.equal(h.w.location.hash,'#other-flow');}finally{h.close();}
  const pending=deferred(),changed=harness({responses:{bv_public_circle_graph:()=>pending.promise}});try{changed.w.location.hash='#circle-graph=42';changed.api.route();changed.state.user={id:other};changed.authChange(other);pending.resolve({data:graph(),error:null});await flush();assert.equal(changed.dialog,null);assert(!changed.w.document.body.textContent.includes('Alice'));}finally{changed.close();}
});
domTest('closing a route clears only its own hash and safely restores a connected opener',async()=>{
  const h=harness({responses:{bv_public_circle_graph:{data:graph(),error:null}}});try{
    const opener=h.q('#opener');opener.focus();h.w.location.hash='#circle-graph=42';h.api.route();await flush();h.q('[data-tc-close]').click();assert.equal(h.w.location.hash,'');assert.equal(h.w.document.activeElement,opener);
    h.w.location.hash='#circle-graph=42';h.api.route();await flush();h.w.location.hash='#unrelated';h.q('[data-tc-close]').click();assert.equal(h.w.location.hash,'#unrelated');
  }finally{h.close();}
});
domTest('settings widgets and an invitation dialog use unique label targets while they coexist',async()=>{
  const h=harness({responses:{bv_my_graph_visibility:{data:'private',error:null},bv_circle_groups:{data:[group()],error:null}}});try{
    const second=h.w.document.createElement('div');h.w.document.body.append(second);h.api.mountPersonalSettings(h.host);h.api.mountPersonalSettings(second);await h.api.openInvite(group());await flush();
    const ids=[...h.w.document.querySelectorAll('[id]')].map(node=>node.id);assert.equal(new Set(ids).size,ids.length);
    const fields=[...h.w.document.querySelectorAll('[data-tc-personal-visibility],[data-tc-copy-value]')];assert.equal(fields.length,5);
    for(const field of fields){assert(field.id);const labels=[...h.w.document.querySelectorAll('label[for]')].filter(label=>label.htmlFor===field.id);assert.equal(labels.length,1);assert.equal(labels[0].control,field);}
  }finally{h.close();}
});
domTest('guest creation choices resume once after verified signup with private unchecked defaults and no write',async()=>{
  const h=harness({guest:true});try{
    await h.api.openInvite();h.q('[data-tc-type]').value='lotu';h.q('[data-tc-name]').value='Our Sunday people';h.q('[data-tc-visibility]').value='public';h.q('[data-tc-consent]').checked=true;h.submit('[data-tc-create]');await flush();assert.equal(h.dialog,null);assert.equal(h.calls.length,0);
    h.state.user={id:own};h.state.me={id:own,handle:'alice'};h.authChange(own);assert.equal(await h.api.resumeDraft(),true);
    assert.equal(h.q('[data-tc-type]').value,'lotu');assert.equal(h.q('[data-tc-name]').value,'Our Sunday people');assert(h.dialog.textContent.includes('White Masi'));assert.equal(h.q('[data-tc-visibility]').value,'private');assert.equal(h.q('[data-tc-consent]').checked,false);assert.equal(h.calls.length,0,'resuming never creates or joins');
    assert.equal(await h.api.resumeDraft(),false,'draft is consumed exactly once');assert.equal(h.calls.length,0);
  }finally{h.close();}
});
domTest('a cancelled signin can reopen its in-memory choices, and explicit Close discards them',async()=>{
  const h=harness({guest:true});try{
    await h.api.openInvite();h.q('[data-tc-type]').value='mataqali';h.q('[data-tc-name]').value='Our family';h.q('[data-tc-sign-in]').click();await flush();assert.deepEqual(h.authCalls,[['in',true]]);assert.equal(h.dialog,null);
    h.api.stop();await h.api.openInvite();assert.equal(h.q('[data-tc-type]').value,'mataqali');assert.equal(h.q('[data-tc-name]').value,'Our family');h.q('[data-tc-close]').click();assert.equal(h.dialog,null);
    h.state.user={id:own};h.state.me={id:own,handle:'alice'};h.authChange(own);assert.equal(await h.api.resumeDraft(),false);await h.api.openInvite();assert.equal(h.q('[data-tc-type]').value,'koro');assert.equal(h.q('[data-tc-name]').value,'');assert.equal(h.calls.length,0);
  }finally{h.close();}
});
domTest('a guest draft cannot cross an unrelated account switch or continue before its profile loads',async()=>{
  const h=harness({guest:true});try{
    await h.api.openInvite();h.q('[data-tc-type]').value='old-girls';h.q('[data-tc-name]').value='School friends';h.submit('[data-tc-create]');await flush();
    h.state.user={id:own};h.state.me=null;h.authChange(own);assert.equal(await h.api.resumeDraft(),false);assert.equal(h.dialog,null);
    h.state.user={id:other};h.state.me={id:other,handle:'other'};h.authChange(other);assert.equal(await h.api.resumeDraft(),false);assert.equal(h.dialog,null);await h.api.openInvite();assert.equal(h.q('[data-tc-name]').value,'');assert.equal(h.q('[data-tc-type]').value,'koro');assert.equal(h.calls.length,0);
  }finally{h.close();}
});
domTest('a late auth check cannot resume a guest draft after the account changes',async()=>{
  const h=harness({guest:true});try{
    await h.api.openInvite();h.q('[data-tc-name]').value='Friends';h.submit('[data-tc-create]');await flush();h.state.user={id:own};h.state.me={id:own,handle:'alice'};h.authChange(own);
    const gate=deferred();h.api.init({client:{auth:{getUser:()=>gate.promise,onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};}},rpc:async()=>assert.fail('No write expected')},state:h.state,auth:()=>{},render:()=>{}});
    const pending=h.api.resumeDraft();h.state.user={id:other};h.state.me={id:other,handle:'other'};h.api.stop();gate.resolve({data:{user:{id:own}},error:null});assert.equal(await pending,false);assert.equal(h.dialog,null);assert.equal(h.calls.length,0);
  }finally{h.close();}
});
domTest('a confirmed create is not reported as failed when its navigation callback fails',async()=>{
  const h=harness({responses:{bv_circle_create_group:{data:group(),error:null}}});try{
    h.host.innerHTML=h.api.createHTML();h.api.mountCreate(h.host,()=>{throw Error('Navigation failed');});h.q('[data-tc-name]').value='Friends';h.submit('[data-tc-create]');await flush();assert(h.q('[data-tc-status]').textContent.startsWith('Circle created.'));assert(!h.q('[data-tc-status]').textContent.includes('could not be created'));assert.equal(h.calls.filter(call=>call.name==='bv_circle_create_group').length,1);
  }finally{h.close();}
});
domTest('legacy Village still shares its actual stored invitation while new owner and graph settings stay unavailable',async()=>{
  const h=harness({responses:{bv_circle_groups:{data:null,error:{code:'PGRST202'}},bv_my_crews:{data:[{id:42,name:'Our old Village',join_code:'ACTUAL_LEGACY_CODE',owner:own}],error:null}}});try{
    await h.api.openInvite({id:42});assert.equal(h.q('[data-tc-owner-form]'),null);assert.equal(h.q('[data-tc-choice-form]'),null);assert(h.dialog.textContent.includes('remains private'));h.q('[data-tc-copy]').click();await flush();assert.equal(h.copied.length,1);assert(h.copied[0].includes('#circle-invite=ACTUAL_LEGACY_CODE'));assert(h.copied[0].includes('Village Circle'));assert(!h.calls.some(call=>['bv_circle_update_group','bv_circle_graph_choice'].includes(call.name)));
  }finally{h.close();}
});
domTest('mounting a replacement widget prunes the disconnected member graph and its polling timer',async()=>{
  const saved=group(),h=harness({responses:{bv_circle_groups:{data:[saved],error:null},bv_circle_graph:{data:graph({visibility:'private'}),error:null},bv_my_graph_visibility:{data:'private',error:null}}});try{
    h.api.mountGroupGraph(h.host,saved);await flush();assert.equal([...h.timers.values()].filter(timer=>timer.delay===15000).length,1);h.host.remove();const replacement=h.w.document.createElement('div');h.w.document.body.append(replacement);h.api.mountPersonalSettings(replacement);await flush();assert.equal([...h.timers.values()].filter(timer=>timer.delay===15000).length,0);
  }finally{h.close();}
});
domTest('settings notifications use the in-place groupChanged hook without resetting the current room or composer',async()=>{
  const changed=[],saved=group(),h=harness({groupChanged:value=>changed.push(value),responses:{bv_circle_groups:{data:[saved],error:null},bv_circle_update_group:args=>({data:{id:42,circle_type:args.p_type,skin_id:catalogue.get(args.p_type).skin,graph_visibility:args.p_graph_visibility},error:null}),bv_circle_graph_choice:{data:true,error:null}}});try{
    h.host.innerHTML='<textarea aria-label="Current comment">An unsent comment</textarea>';const composer=h.host.firstElementChild;await h.api.openInvite(saved);h.q('[data-tc-owner-type]').value='lotu';h.submit('[data-tc-owner-form]');await flush();assert.equal(changed.length,1);assert.equal(changed[0].skin_id,'masi-white');assert.equal(saved.circle_type,'lotu');assert.equal(h.rendered.length,0);assert.equal(h.host.firstElementChild,composer);assert.equal(composer.value,'An unsent comment');
    h.q('[data-tc-own-choice]').checked=true;h.submit('[data-tc-choice-form]');await flush();assert.equal(changed.length,2);assert.equal(changed[1].show_on_graph,true);assert.equal(h.rendered.length,0);assert.equal(composer.value,'An unsent comment');
  }finally{h.close();}
});
domTest('a token switch after getUser still binds the write to its original captured owner for server rejection',async()=>{
  let serverActor=own,writes=0;const created=[];
  const h=harness({responses:{bv_circle_create_group:args=>{
    if(args.p_expected_owner&&args.p_expected_owner!==serverActor)return {data:null,error:{code:'42501',message:'PRIVATE_EXPECTED_OWNER_MISMATCH'}};
    writes++;return {data:group({owner:serverActor}),error:null};
  }}});try{
    h.client.auth.getUser=async()=>{const checked={data:{user:{id:own}},error:null};queueMicrotask(()=>{serverActor=other;h.identity=other;});return checked;};
    h.host.innerHTML=h.api.createHTML();h.api.mountCreate(h.host,value=>created.push(value));h.q('[data-tc-name]').value='Friends';h.submit('[data-tc-create]');await flush();
    const request=h.calls.find(call=>call.name==='bv_circle_create_group');assert(request);assert.equal(serverActor,other);assert.equal(request.args.p_expected_owner,own);assert.equal(writes,0);assert.equal(created.length,0);assert(!h.q('[data-tc-status]').textContent.includes('PRIVATE_EXPECTED_OWNER_MISMATCH'));assert(h.q('[data-tc-status]').textContent.includes('could not be created'));
  }finally{h.close();}
});
domTest('going offline clears a visible public graph immediately even during a pending refresh',async()=>{
  const gate=deferred();let reads=0;const h=harness({responses:{bv_public_circle_graph:()=>++reads===1?{data:graph(),error:null}:reads===2?gate.promise:{data:graph(),error:null}}});try{
    h.w.location.hash='#circle-graph=42';h.api.route();await flush();assert(h.dialog.textContent.includes('Alice'));assert.equal(h.q('[data-tc-copy]').disabled,false);
    h.q('[data-tc-refresh]').click();await flush();assert.equal(reads,2);Object.defineProperty(h.w.navigator,'onLine',{configurable:true,value:false});h.w.dispatchEvent(new h.w.Event('offline'));
    assert.equal(h.q('[data-tc-graph]').childElementCount,0);assert.equal(h.q('[data-tc-copy]').disabled,true);assert(!h.dialog.textContent.includes('Alice'));
    gate.resolve({data:graph(),error:null});await flush();assert.equal(reads,2);assert.equal(h.q('[data-tc-graph]').childElementCount,0);assert.equal(h.q('[data-tc-copy]').disabled,true);assert.equal([...h.timers.values()].filter(timer=>timer.delay===15000).length,0);
    Object.defineProperty(h.w.navigator,'onLine',{configurable:true,value:true});h.w.dispatchEvent(new h.w.Event('online'));await flush();assert.equal(reads,3);assert(h.dialog.textContent.includes('Alice'));assert.equal(h.q('[data-tc-copy]').disabled,false);
  }finally{h.close();}
});
domTest('reconnecting before an old request settles queues a fresh nonoverlapping public read',async()=>{
  const gate=deferred();let reads=0;const h=harness({responses:{bv_public_circle_graph:()=>++reads===1?{data:graph(),error:null}:reads===2?gate.promise:{data:graph({nodes:[{id:'group:42',type:'group',label:'Our friends'}],edges:[]}),error:null}}});try{
    h.w.location.hash='#circle-graph=42';h.api.route();await flush();h.q('[data-tc-refresh]').click();await flush();assert.equal(reads,2);
    Object.defineProperty(h.w.navigator,'onLine',{configurable:true,value:false});h.w.dispatchEvent(new h.w.Event('offline'));Object.defineProperty(h.w.navigator,'onLine',{configurable:true,value:true});h.w.dispatchEvent(new h.w.Event('online'));await flush();assert.equal(reads,2,'old request remains the only in-flight read');
    gate.resolve({data:graph(),error:null});await flush();assert.equal(reads,3);assert(!h.dialog.textContent.includes('Alice'),'pre-offline response must not restore stale people');assert(h.dialog.textContent.includes('0 visible people'));assert.equal(h.q('[data-tc-copy]').disabled,false);
  }finally{h.close();}
});
domTest('a matching initial session retains a public graph opened before the private profile loads',async()=>{
  const h=harness({guest:true,responses:{bv_public_circle_graph:{data:graph(),error:null}}});try{
    h.state.user={id:own};h.state.me=null;h.w.location.hash='#circle-graph=42';h.api.route();await flush();const opened=h.dialog;assert(opened);assert(opened.textContent.includes('Alice'));
    h.authChange(own,'INITIAL_SESSION');await flush();assert.equal(h.dialog,opened);assert(opened.isConnected);assert(opened.textContent.includes('Alice'));assert.deepEqual(h.calls.map(call=>call.name),['bv_public_circle_graph']);
    h.state.user={id:other};h.authChange(other);assert.equal(h.dialog,null);assert(!h.w.document.body.textContent.includes('Alice'));assert.deepEqual(h.calls.map(call=>call.name),['bv_public_circle_graph']);
  }finally{h.close();}
});
domTest('Close remains usable during a pending owner save and late completion cannot reopen or steal focus',async()=>{
  const gate=deferred(),saved=group(),h=harness({responses:{bv_circle_groups:{data:[saved],error:null},bv_circle_update_group:()=>gate.promise}});try{
    const opener=h.q('#opener');opener.focus();await h.api.openInvite(saved);h.q('[data-tc-owner-type]').value='lotu';h.submit('[data-tc-owner-form]');await flush();assert.equal(h.calls.filter(call=>call.name==='bv_circle_update_group').length,1);assert.equal(h.q('[data-tc-owner-type]').disabled,true);assert.equal(h.q('[data-tc-close]').disabled,false);
    h.q('[data-tc-close]').click();assert.equal(h.dialog,null);assert.equal(h.w.document.activeElement,opener);const otherControl=h.w.document.createElement('input');h.w.document.body.append(otherControl);otherControl.focus();
    gate.resolve({data:{id:42,circle_type:'lotu',skin_id:'masi-white',graph_visibility:'private'},error:null});await flush();assert.equal(h.dialog,null);assert.equal(h.w.document.activeElement,otherControl);assert.equal(saved.circle_type,'koro');assert.equal(h.rendered.length,0);assert(!h.w.document.body.textContent.includes('Circle settings saved'));
  }finally{h.close();}
});
domTest('saved and recipient invitations use the correct article without changing the circle type label',async()=>{
  const saved=group({circle_type:'old-boys',skin_id:'occasion-school-reunion'}),h=harness({responses:{bv_circle_groups:{data:[saved],error:null},bv_circle_invitation:{data:saved,error:null}}});try{
    await h.api.openInvite(saved);assert(h.q('[data-tc-invitation-kind]').textContent.includes('to an Old Boys Circle.'));h.q('[data-tc-copy]').click();await flush();assert(h.copied[0].includes(', an Old Boys Circle on Sota Kece.'));
    h.q('[data-tc-close]').click();h.w.location.hash='#circle-invite=INVITE_1234';h.api.route();await flush();assert(h.dialog.textContent.includes('invited to an Old Boys Circle.'));assert(h.dialog.textContent.includes('Old Boys Circle'));
  }finally{h.close();}
});
