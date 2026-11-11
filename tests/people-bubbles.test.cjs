'use strict';
// People bubbles (12 Nov 2026): "Say bula to" in the starter Koro card as a cluster of people and hub anchors.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'/tmp/jsd/node_modules/jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const windows=[];test.after(()=>windows.forEach(w=>w.close()));
const flush=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const HUBS=[{slug:'suva',name:'Suva',emoji:'🌴',members:12,joined:true,crew_id:1},{slug:'west',name:'Nadi & Lautoka',emoji:'🌅',members:0,joined:false,crew_id:null}];
const PEOPLE=[{id:'u1',handle:'mere',display_name:'Mere',avatar_emoji:'🌺',accent:'#E76F51',posts:4,hub:'Suva'},
  {id:'u2',handle:'jone',display_name:'Jone',avatar_emoji:'🥥',accent:'javascript:x',posts:0,hub:null}];

function boot({people=PEOPLE}={}){
  const d=new JSDOM('<!doctype html><body><div id="host"></div></body>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://sotakece.com/'});
  const w=d.window;windows.push(w);
  w.matchMedia=()=>({matches:true});
  const calls=[],inserts=[],rooms=[],koro=[];
  const client={rpc:async(name,args)=>{calls.push([name,args]);
      if(name==='bv_hubs')return {data:HUBS,error:null};
      if(name==='bv_people_to_meet')return {data:people.slice(0,args.p_limit),error:null};
      if(name==='bv_hub_join')return {data:Object.assign({},HUBS[1],{joined:true,members:1,crew_id:7}),error:null};
      return {data:null,error:null};},
    from:()=>({insert:async row=>{inserts.push(row);return {};}})};
  w.eval(read('sota-hubs.js'));w.eval(read('sota-people-bubbles.js'));
  w.SotaHubs.init({client,state:{user:{id:'me'},me:{id:'me'}},toast(){},esc,openRoom:h=>rooms.push(h),openKoro:id=>koro.push(id)});
  w.document.getElementById('host').innerHTML=w.SotaHubs.html('wall');
  return {w,calls,inserts,rooms,koro,q:s=>w.document.querySelector(s),all:s=>[...w.document.querySelectorAll(s)]};
}

test('the physics pushes bubbles apart and keeps them inside the stage',()=>{
  const d=JSDOM?new JSDOM('',{runScripts:'outside-only'}):null;if(!d)return;const w=d.window;windows.push(w);
  w.eval(read('sota-people-bubbles.js'));const B=w.SotaPeopleBubbles;
  const nodes=B.nodesFor(PEOPLE,HUBS,300,260);
  assert.equal(nodes.length,4);
  nodes.forEach(n=>{n.x=150;n.y=130;});
  for(let i=0;i<300;i++)B.step(nodes,300,260,null);
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r,'no overlaps after settling');}
  nodes.forEach(n=>{assert.ok(n.x-n.r>=0&&n.x+n.r<=300&&n.y-n.r>=0&&n.y+n.r<=260,'inside the stage');});
  assert.ok(B.radius({posts:8})>B.radius({posts:0}),'people who post this month are bigger');
  const pairs=B.links(nodes);
  assert.equal(pairs.length,1);assert.equal(pairs[0][0].data.handle,'mere');assert.equal(pairs[0][1].data.slug,'suva');
});

test('a drawn card gets the bubbles, asks for up to 12 people and hides its own list',dom,async()=>{
  const h=boot();await h.w.SotaHubs.fill(h.w.document);await flush();
  assert.ok(h.q('.pb-wrap'));
  assert.equal(h.all('.pb-person').length,2);assert.equal(h.all('.pb-hub').length,2);
  assert.equal(h.q('.hub-people').hidden,true);
  assert.ok(h.calls.some(c=>c[0]==='bv_people_to_meet'&&c[1].p_limit===3),'the card still asks for 3');
  assert.ok(h.calls.some(c=>c[0]==='bv_people_to_meet'&&c[1].p_limit===12),'the bubbles ask for up to 12');
  assert.equal(h.all('.pb-lines line').length,1,'Mere is joined to the Suva hub she shares');
  assert.match(h.all('.pb-person')[1].getAttribute('style'),/--pb-ring: ?#4FA8D8/,'a bad accent falls back to the house blue');
});

test('tapping a person shows Visit room and Ask; asking goes through the card code once',dom,async()=>{
  const h=boot();await h.w.SotaHubs.fill(h.w.document);await flush();
  h.all('.pb-person')[0].click();
  assert.match(h.q('.pb-detail').textContent,/Mere/);
  assert.match(h.q('.pb-detail').textContent,/in your Suva Koro/);
  h.q('[data-pb="room"]').click();assert.deepEqual(h.rooms,['mere']);
  h.q('[data-pb="ask"]').click();await flush();
  assert.equal(JSON.stringify(h.inserts),JSON.stringify([{requester:'me',addressee:'u1'}]));
  assert.equal(h.q('[data-pb="ask"]').textContent,'Asked');
  assert.equal(h.q('[data-pb="ask"]').disabled,true);
  h.all('.pb-person')[0].click();assert.equal(h.q('.pb-detail').textContent,'','tapping again lets go');
});

test('tapping a hub offers Join or Open Koro, and joining redraws the card with fresh bubbles',dom,async()=>{
  const h=boot();await h.w.SotaHubs.fill(h.w.document);await flush();
  const suva=h.all('.pb-hub').find(b=>/Suva/.test(b.getAttribute('aria-label')));
  suva.click();h.q('[data-pb="open"]').click();assert.deepEqual(h.koro,[1]);
  const west=h.all('.pb-hub').find(b=>/Nadi/.test(b.getAttribute('aria-label')));
  west.click();assert.match(h.q('.pb-detail').textContent,/Be the first/);
  h.q('[data-pb="join"]').click();await flush();
  assert.ok(h.calls.some(c=>c[0]==='bv_hub_join'&&c[1].p_slug==='west'));
  assert.equal(h.all('.pb-wrap').length,1,'one cluster after the card repaints');
  assert.ok(h.all('.pb-hub').find(b=>/Nadi/.test(b.getAttribute('aria-label'))).classList.contains('on'));
});

test('with nobody to meet the card keeps its own invite message and no bubbles',dom,async()=>{
  const h=boot({people:[]});await h.w.SotaHubs.fill(h.w.document);await flush();
  assert.equal(h.q('.pb-wrap'),null);
  assert.equal(h.q('.hub-people').hidden,false);
  assert.match(h.q('.hub-first').textContent,/among the first/);
});

test('the page loads the bubbles the house way',()=>{
  const html=read('index.html'),sw=read('sw.js'),css=read('sota-people-bubbles.css');
  assert.match(html,/<script src="\/sota-hub-map\.js\?v=[^"]+"><\/script><script src="\/sota-people-bubbles\.js\?v=[^"]+"><\/script>/);
  assert.match(html,/<link rel="stylesheet" href="\/sota-people-bubbles\.css\?v=/);
  assert.match(sw,/'\/sota-people-bubbles\.js','\/sota-people-bubbles\.css'/);
  assert.match(css,/\.hub-card \.hub-people\[hidden\]\{display:none!important\}/);
});
