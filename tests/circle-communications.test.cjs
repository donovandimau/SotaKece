'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const types=require('../circle-types.js');
const skins=require('../skins.js');
const source=fs.readFileSync(path.join(__dirname,'../communications.js'),'utf8');
const helpers=source.slice(source.indexOf(' const circleStyleKeys='),source.indexOf(' window.SotaCircles?.init('));
const handlers=source.slice(source.indexOf(" handleForm('createGroup',"),source.indexOf(" $('inviteGroup').addEventListener('click'"));
assert(helpers.includes('async function circleAccount')&&handlers.includes('bv_join_circle'),'extract the current implementation');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function element(value=''){
 const styles=new Map(),classes=new Set();
 return {value,textContent:'',checked:false,disabled:false,dataset:{},style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k),getPropertyValue:k=>styles.get(k)||''},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)},styles,classes};
}
function setup({rpc,getUser,groups=[]}={}){
 const controls=Object.fromEntries(['groupName','groupType','groupGraphVisibility','createShowOnGraph','joinCode','joinShowOnGraph','groupWorkspace','circleIdentity','circleSkinPreview','roomName','memberCount'].map(id=>[id,element()]));
 Object.assign(controls.groupName,{value:'Our school circle'});controls.groupType.value='school';controls.groupGraphVisibility.value='private';controls.joinCode.value='0123456789';
 const S={user:{id:'owner-a'},me:{id:'owner-a',room_css:'my personal skin'},epoch:1,operation:null,sending:false,groups:[],group:null};
 const calls={rpc:[],loads:[],messages:[],reset:0,paint:0},forms={};
 const context=vm.createContext({Set,Object,String,Error,window:{SotaCircleTypes:types,BulaSkins:skins,SotaCircles:{list:async()=>groups}},S,$:id=>controls[id],check:r=>{if(r.error)throw r.error;return r.data;},
  sb:{auth:{getUser:getUser||(async()=>({data:{user:{id:'owner-a'}}}))},rpc:async(name,args)=>{calls.rpc.push({name,args});return rpc?rpc(name,args):{data:name==='bv_join_circle'?12:{id:12}};}},
  paintGroups:()=>calls.paint++,reset:()=>{calls.reset++;S.group=null;},tell:(message,error)=>calls.messages.push({message,error}),loadGroups:async(...args)=>calls.loads.push(args),handleForm:(id,fn)=>forms[id]=fn
 });
 vm.runInContext(helpers+'\n'+handlers,context);
 const createControls=[controls.groupName,controls.groupType,controls.groupGraphVisibility,controls.createShowOnGraph,element()];
 const joinControls=[controls.joinCode,controls.joinShowOnGraph,element()];
 return {context,controls,S,calls,forms,create:{querySelectorAll:()=>createControls},join:{querySelectorAll:()=>joinControls},createControls,joinControls};
}

test('creation writes one atomic group request with explicit private defaults and derived type',async()=>{
 const h=setup();await h.forms.createGroup(h.create);
 assert.equal(h.calls.rpc.length,1);assert.equal(h.calls.rpc[0].name,'bv_circle_create_group');
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls.rpc[0].args)),{p_name:'Our school circle',p_type:'school',p_graph_visibility:'private',p_show_on_graph:false,p_expected_owner:'owner-a'});
 assert.deepEqual(h.calls.loads,[[12,1]]);assert.equal(h.controls.groupName.value,'');assert(h.createControls.every(n=>!n.disabled));
 assert.equal(h.S.me.room_css,'my personal skin');
});

test('a pending creation disables its form and ignores a second submit',async()=>{
 const gate=deferred(),h=setup({rpc:()=>gate.promise});const first=h.forms.createGroup(h.create);
 await flush();assert(h.createControls.every(n=>n.disabled));
 await h.forms.createGroup(h.create);assert.equal(h.calls.rpc.length,1);
 gate.resolve({data:{id:12}});await first;assert.equal(h.calls.loads.length,1);assert.equal(h.S.sending,false);
});

test('a mismatched authenticated account never writes a group or clears the draft',async()=>{
 const h=setup({getUser:async()=>({data:{user:{id:'other-owner'}}})});await h.forms.createGroup(h.create);
 assert.equal(h.calls.rpc.length,0);assert.equal(h.calls.loads.length,0);assert.equal(h.controls.groupName.value,'Our school circle');assert(h.createControls.every(n=>!n.disabled));
});

test('a changed account and view suppress a late successful creation response',async()=>{
 const gate=deferred(),h=setup({rpc:()=>gate.promise});const first=h.forms.createGroup(h.create);
 await flush();assert.equal(h.calls.rpc.length,1);
 h.S.epoch++;h.S.user={id:'owner-b'};h.S.operation=null;h.controls.groupName.value='New owner draft';
 gate.resolve({data:{id:12}});await first;assert.equal(h.calls.loads.length,0);assert.equal(h.controls.groupName.value,'New owner draft');
});

test('unknown types cannot create groups and unavailable settings preserve the draft',async()=>{
 const bad=setup();bad.controls.groupType.value='invented';await bad.forms.createGroup(bad.create);assert.equal(bad.calls.rpc.length,0);assert.equal(bad.controls.groupName.value,'Our school circle');
 const h=setup({rpc:async()=>({error:{code:'PGRST202',message:'database details'}})});await h.forms.createGroup(h.create);
 assert.equal(h.calls.loads.length,0);assert.equal(h.controls.groupName.value,'Our school circle');assert.match(h.calls.messages.at(-1).message,/unavailable/);assert(!h.calls.messages.at(-1).message.includes('database details'));
});

test('joining passes only the actual code and this member’s explicit graph consent',async()=>{
 const h=setup();h.controls.joinShowOnGraph.checked=true;await h.forms.joinGroup(h.join);
 assert.equal(h.calls.rpc.length,1);assert.equal(h.calls.rpc[0].name,'bv_join_circle');assert.deepEqual(JSON.parse(JSON.stringify(h.calls.rpc[0].args)),{p_code:'0123456789',p_show_on_graph:true,p_expected_owner:'owner-a'});
 assert.equal(h.controls.joinCode.value,'');assert.equal(h.controls.joinShowOnGraph.checked,false);assert.deepEqual(h.calls.loads,[[12,1]]);
 const other=setup({getUser:async()=>({data:{user:{id:'owner-b'}}})});await other.forms.joinGroup(other.join);assert.equal(other.calls.rpc.length,0);assert.equal(other.controls.joinCode.value,'0123456789');
});

test('group appearance uses the group type, stays scoped and never changes the profile',()=>{
 const h=setup(),before=JSON.stringify(h.S.me);h.context.circleTheme({circle_type:'lotu'});
 assert.equal(h.controls.groupWorkspace.dataset.circleSkin,'masi-white');assert.equal(h.controls.groupWorkspace.style.getPropertyValue('--bv-accent'),types.get('lotu').displayAccent);
 assert(h.controls.groupWorkspace.classList.contains('circle-workspace'));assert.match(h.controls.circleIdentity.textContent,/Lotu Circle/);assert.equal(JSON.stringify(h.S.me),before);
 h.context.clearCircleTheme();assert.equal(h.controls.groupWorkspace.styles.size,0);assert(!h.controls.groupWorkspace.classList.contains('circle-workspace'));assert.equal(h.controls.circleIdentity.textContent,'');
});

test('metadata refresh updates a selected group without resetting active call context',async()=>{
 const next={id:12,name:'Same circle, new look',members:3,circle_type:'mataqali'},h=setup({groups:[next]});h.S.group={id:12,name:'Old look',circle_type:'koro'};
 await h.context.refreshCircleDetails();assert.equal(h.calls.reset,0);assert.equal(h.S.epoch,1);assert.equal(h.S.group,next);assert.equal(h.controls.groupWorkspace.dataset.circleSkin,'core-masi');assert.equal(h.calls.loads.length,0);
});

test('revoked membership clears the selected workspace rather than retaining its graph/skin',async()=>{
 const h=setup({groups:[]});h.S.group={id:12};await h.context.refreshCircleDetails();assert.equal(h.calls.reset,1);assert.equal(h.S.group,null);assert.match(h.calls.messages.at(-1).message,/no longer available/);
});
