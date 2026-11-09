'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const c=require('../connections.js');
const me={id:'me',handle:'owner',display_name:'Owner'};
const friends=[{id:'a',handle:'ana',display_name:'Ana'},{id:'b',handle:'jone',display_name:'Jone'}];
const crews=[{id:1,name:'Village'},{id:2,name:'Stories'}];
let passed=0;
async function check(name,fn){await fn();passed++;console.log('PASS',name);}
function client({fr=friends,gr=crews,members=[],profiles=[],user=me,authError=false,rpcError=false,memberError=false}={}){
  const calls=[];
  return {calls,auth:{getUser:async()=>({data:{user},error:authError?{}:null})},rpc:async name=>{calls.push({rpc:name});return {data:name==='bv_my_friends'?fr:gr,error:rpcError?{}:null};},
    from(table){const call={table,filters:{}};calls.push(call);return {select(columns){call.columns=columns;return this;},in(key,values){call.filters[key]=values;return this;},async limit(n){call.limit=n;return {data:profiles,error:null};},async range(start,end){call.range=[start,end];return {data:members.slice(start,end+1),error:memberError?{}:null};}};}};
}
(async()=>{
  await check('only accepted-friend and own-Koro IDs can create membership edges',()=>{
    const g=c.model(me,friends,crews,[{member:'a',crew_id:1},{member:'stranger',crew_id:1},{member:'a',crew_id:999},{member:'me',crew_id:1}]);
    assert.equal(g.nodes.length,5);assert.equal(g.edges.length,5);assert(!JSON.stringify(g).includes('stranger'));assert(!JSON.stringify(g).includes('999'));
    assert(!g.edges.some(e=>e.source==='person:a'&&e.target==='person:b'));
    assert.deepEqual(c.path(g,'group:1'),['person:me','group:1']);assert.deepEqual(c.path(g,'unknown'),[]);
  });
  await check('duplicate records never multiply nodes or membership edges',()=>{
    const g=c.model(me,[...friends,...friends],[...crews,...crews],[{member:'a',crew_id:1},{member:'a',crew_id:1}]);
    assert.equal(g.nodes.length,5);assert.equal(g.edges.length,5);
  });
  await check('query is constrained on both sides and carries no private profile fields',async()=>{
    const api=client({members:[{member:'a',crew_id:1}]});const r=await c.load(api,{user:me,me});
    assert.equal(r.graph.edges.length,5);assert.equal(api.calls.length,3);
    const q=api.calls[2];assert.equal(q.table,'bv_crew_members');assert.equal(q.columns,'crew_id,member');
    assert.deepEqual(q.filters,{crew_id:[1,2],member:['a','b']});assert.deepEqual(q.range,[0,999]);
    assert(!Object.keys(r.graph.nodes[0]).some(x=>['email','age_band','join_code'].includes(x)));
  });
  await check('signed-out read fails before querying',async()=>{
    const api=client();await assert.rejects(c.load(api,{user:null,me:null}),/Sign in/);assert.equal(api.calls.length,0);
  });
  await check('RPC errors fail closed rather than showing a false empty community',async()=>{
    await assert.rejects(c.load(client({rpcError:true}),{user:me,me}),/could not be loaded/);
  });
  await check('server-validated account must match the current graph owner before social reads',async()=>{
    for(const options of [{user:{id:'other'}},{authError:true},{user:null}]){
      const api=client(options);await assert.rejects(c.load(api,{user:me,me}),/Sign in again/);assert.equal(api.calls.length,0);
    }
    const api=client();await assert.rejects(c.load(api,{user:me,me:{...me,id:'different'}}),/profile is changing/);assert.equal(api.calls.length,0);
  });
  await check('legacy friend rows resolve UUIDs only through exact already-accepted handles',async()=>{
    const api=client({fr:[{handle:'ana',display_name:'Ana'},{handle:'jone',display_name:'Jone'}],profiles:[{id:'a',handle:'ana'},{id:'b',handle:'jone'},{id:'stranger',handle:'unrequested'}],members:[{member:'a',crew_id:1}]});
    const r=await c.load(api,{user:me,me});assert.equal(r.graph.nodes.length,5);assert(!JSON.stringify(r.graph).includes('stranger'));
    assert.equal(api.calls[2].table,'bv_profiles');assert.equal(api.calls[2].columns,'id,handle');assert.deepEqual(api.calls[2].filters,{handle:['ana','jone']});assert.equal(api.calls[2].limit,120);
    assert.deepEqual(api.calls[3].filters,{crew_id:[1,2],member:['a','b']});
  });
  await check('malformed RPC payloads fail rather than drawing an empty personal graph',async()=>{
    await assert.rejects(c.load(client({fr:{bad:'shape'}}),{user:me,me}),/could not be loaded/);
  });
  await check('membership permission failure gives an explicit partial view',async()=>{
    const r=await c.load(client({memberError:true}),{user:me,me});assert.equal(r.graph.edges.length,4);assert.match(r.notices[0],/unavailable/);
  });
  await check('empty network needs no membership query',async()=>{
    const api=client({fr:[],gr:[]});const r=await c.load(api,{user:me,me});assert.equal(r.graph.nodes.length,1);assert.equal(r.graph.edges.length,0);assert.equal(api.calls.length,2);
  });
  await check('inline friend graph reads only accepted friends, never Koro or memberships',async()=>{
    const api=client({gr:[{id:1,name:'Private Koro'}],members:[{member:'a',crew_id:1}]});
    const r=await c.load(api,{user:me,me},{friendsOnly:true});
    assert.deepEqual(api.calls,[{rpc:'bv_my_friends'}]);
    assert.equal(r.graph.nodes.length,3);assert.equal(r.graph.edges.length,2);
    assert(r.graph.edges.every(e=>e.type==='friend'&&e.source===r.graph.self));
    assert(!JSON.stringify(r.graph).includes('Private Koro'));
  });
  await check('inline positions stay stable through addition, removal and RPC reordering',()=>{
    const slots=new Map(),first=c.model(me,friends,[],[]),a=c.friendPositions(first,slots);
    const next=c.model(me,[friends[1],{id:'c',display_name:'New friend'},friends[0]],[],[]),b=c.friendPositions(next,slots);
    assert.deepEqual(a.get('person:a'),b.get('person:a'));assert.deepEqual(a.get('person:b'),b.get('person:b'));
    const after=c.friendPositions(c.model(me,[friends[0],{id:'c'}],[],[]),slots);
    assert.deepEqual(after.get('person:a'),a.get('person:a'));assert(!slots.has('person:b'));
    const many=c.friendPositions(c.model(me,Array.from({length:120},(_,i)=>({id:'f'+i})),[],[]));
    assert.equal(many.size,121);for(const p of many.values())assert(Number.isFinite(p.x)&&p.x>=0&&p.x<=720&&p.y>=0&&p.y<=480);
  });
  await check('inline polling retries transient auth failures but clears on lost identity',async()=>{
    const api=client();api.auth.getUser=async()=>({data:{user:null},error:{name:'AuthRetryableFetchError',status:503}});
    await assert.rejects(c.load(api,{user:me,me},{friendsOnly:true}),err=>!err.code&&/refreshed/.test(err.message));assert.equal(api.calls.length,0);
    const switched=client({user:{id:'other'}});
    await assert.rejects(c.load(switched,{user:me,me},{friendsOnly:true}),err=>err.code==='AUTH_REQUIRED');assert.equal(switched.calls.length,0);
  });
  await check('inline entry has no fictional example or external export call to action',()=>{
    const entry=c.entryHtml();assert.match(entry,/data-friend-graph/);assert(!/Explore the example|dimau-visuals\.vercel|openPersonal\(\)/.test(entry));
  });
  await check('Home request errors preserve social panels without starting the optional People map',async()=>{
    const vm=require('node:vm'),html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
    const source=html.slice(html.indexOf('async function viewPulse(){'),html.indexOf('async function answerSpark(id){'));
    let mounts=0,socialMounts=0,errors=0,shells=0,current=true;
    const insertions=[],view={querySelector:()=>null,insertAdjacentHTML(where,value){insertions.push({where,value});}};
    // The wall module renders through shell(); a failed first page paints its own error card there.
    const wall={init(cfg){assert.equal(cfg.client,context.sb);assert.equal(typeof cfg.spark,'function');},async view(){context.shell('<section class="view-error"></section>');errors++;}};
    const context=vm.createContext({Date,S:{user:{id:me.id},me,tab:'pulse'},viewRun:()=>1,currentView:()=>current,shell(){shells++;},requestResult:async p=>p,
      sb:{rpc:async()=>({data:[]}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({error:Error('Unavailable Spark')})})})})},
      toast(){},esc:String,ago:()=>'now',openRoom(){},
      viewError(){errors++;},$:selector=>{assert.equal(selector,'#view');return view;},window:{SotaPulse:wall,
        SotaRoomSocial:{markup:()=>'<section data-room-social></section>',mount(target){assert.equal(target,view);socialMounts++;}},
        SotaConnections:{entryHtml:()=>'<section data-friend-graph></section>',mountEntry(){mounts++;}}
      }});
    vm.runInContext(source+';this.testPulse=viewPulse;this.testSpark=sparkCard;',context);await context.testPulse();assert.equal(errors,1);assert.equal(shells,1);assert.equal(mounts,0);assert.equal(socialMounts,1);
    assert.deepEqual(insertions,[{where:'afterbegin',value:'<section data-room-social></section>'}]);
    assert.equal(await context.testSpark(),'','an unavailable Spark yields no card instead of an error');
    current=false;context.S.tab='room';await context.testPulse();assert.equal(mounts,0);assert.equal(socialMounts,1,'social panel mounts only on the Pulse tab');assert.equal(insertions.length,1);assert.equal(errors,2);
    delete context.window.SotaPulse;context.S.tab='pulse';await context.testPulse();assert.equal(errors,3,'without the wall module the page shows the error view');
  });
  await check('truncation is explicit and queries only the bounded graph',async()=>{
    const api=client({fr:Array.from({length:130},(_,i)=>({id:String(i)})),gr:Array.from({length:45},(_,i)=>({id:i}))});
    const r=await c.load(api,{user:me,me});assert.equal(r.graph.nodes.length,161);assert.match(r.notices[0],/120/);assert.equal(api.calls[2].filters.member.length,120);assert.equal(api.calls[2].filters.crew_id.length,40);
    const positions=c.layout(r.graph);assert.equal(positions.size,161);for(const p of positions.values())assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=900&&p.y>=0&&p.y<=620);
  });
  await check('membership pagination includes records beyond the API default page',async()=>{
    const api=client({members:[...Array.from({length:1000},()=>({member:'a',crew_id:1})),{member:'b',crew_id:2}]});
    const r=await c.load(api,{user:me,me});assert.equal(r.graph.edges.length,6);assert.deepEqual(api.calls[3].range,[1000,1999]);
  });
  await check('example is a connected fictional graph and carries no contact records',()=>{
    const r=c.example();assert.equal(r.graph.nodes.length,10);assert.equal(r.graph.edges.length,18);assert.equal(r.updated,null);
    for(const n of r.graph.nodes)assert(c.path(r.graph,n.id).length);
  });
  await check('app integration preserves existing routes and adds no remote graph dependency',()=>{
    const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(html,/SotaConnections\.init/);const studio=fs.readFileSync(path.join(__dirname,'../skin-studio.js'),'utf8');assert.match(studio,/SotaConnections\?\.entryHtml/);assert(studio.indexOf('SotaConnections?.entryHtml')<studio.indexOf('<footer class="bv-classic-footer">'));assert(!studio.includes('>Connections example</button>'));assert.match(html,/go\('connections'\)/);assert.match(html,/if\(S.tab==="connections"\)/);
    const js=fs.readFileSync(path.join(__dirname,'../connections.js'),'utf8');assert(!/localStorage|sessionStorage|service_role/.test(js));
    const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');assert.match(sw,/const CACHE='sota-kece-shell-\d{8}-v\d+-[a-z-]+';/);assert.match(sw,/'\/connections.js'/);
  });
  await check('public example opens before any session or member lookup',async()=>{
    const vm=require('node:vm');const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
    const source=html.slice(html.indexOf('async function boot(){'),html.indexOf('/* Signed in, but no room yet.'));
    let examples=0,queries=0;const context=vm.createContext({location:{hash:'#connections=example'},window:{SotaConnections:{preview(){examples++;}}},sb:{auth:{getSession(){queries++;throw Error('Example must not look up a session');}}}});
    vm.runInContext(source+';this.openExample=boot;',context);await context.openExample();assert.equal(examples,1);assert.equal(queries,0);
  });
  await check('visual summaries count only supplied visible graph and contain no member identifiers',()=>{
    const r=c.summaryRows(c.example().graph);assert.deepEqual(r.map(x=>x.Count),[6,3,6,12]);assert.deepEqual(Object.keys(r[0]),['Category','Count']);assert(!JSON.stringify(r).includes('sina'));
    const reduced={nodes:[{type:'you'},{type:'group'}],edges:[{type:'member'}]};assert.deepEqual(c.summaryRows(reduced).map(x=>x.Count),[0,1,0,1]);
    assert.deepEqual(c.summaryRows({nodes:[],edges:[]}).map(x=>x.Count),[0,0,0,0]);
    const charts=require('../dimau-charts-core.js');assert.equal(charts.prepare(r,{x:'Category',y:'Count'}).points.reduce((n,p)=>n+p.y,0),27);
  });
  console.log(`${passed} Connections checks passed`);
})().catch(err=>{console.error(err);process.exitCode=1;});
