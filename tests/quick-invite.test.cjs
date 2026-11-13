'use strict';
// Home "Invite someone" buttons (13 Nov 2026): one tap makes a personal /i/ link so joins are counted;
// the plain share is only the fallback. Also: a Sere post with the default caption does not repeat "🎤 Sere".
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM;try{({JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'));}catch(_){}
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dom=JSDOM?{}:{skip:'jsdom is not installed'};
const TOKEN='0123456789abcdef0123456789abcdef';

function page(rpcImpl){
  const w=new JSDOM('<button data-iv-quick="Home: Top Mates" data-sota-share data-share-text="plain">Invite</button>',{runScripts:'outside-only',url:'https://sotakece.com/'}).window;
  w.shared=[];
  w.SotaShare={share:o=>{w.shared.push(o);}};
  w.document.addEventListener('click',e=>{if(e.target.closest('[data-sota-share]'))w.shared.push({plainHandler:true});});
  if(rpcImpl)w.SotaPlus={inviteRpc:rpcImpl,me:()=>({display_name:'Dimau'})};
  w.eval(read('sota-invites.js'));
  return w;
}
const tick=()=>new Promise(r=>setTimeout(r,10));

test('a Home invite button makes a personal link and shares it, not the plain site link',dom,async()=>{
  const calls=[];
  const w=page(async(n,a)=>{calls.push([n,a]);return {path:'/i/'+TOKEN};});
  w.document.querySelector('button').click();await tick();
  assert.equal(JSON.stringify(calls),JSON.stringify([['bv_invite_create',{p_label:'Home: Top Mates'}]]));
  assert.equal(w.shared.length,1);
  assert.equal(w.shared[0].url,'https://sotakece.com/i/'+TOKEN);
  assert.match(w.shared[0].text,/^Dimau here\./);
  w.close();
});

test('if making the link fails, the plain share still goes out',dom,async()=>{
  const w=page(async()=>{throw new Error('NOT_SIGNED_IN');});
  w.document.querySelector('button').click();await tick();
  assert.equal(w.shared.length,1);
  assert.equal(w.shared[0].url,'https://sotakece.com/');
  assert.equal(w.shared[0].text,'plain');
  w.close();
});

test('without the database helper the old plain share handler runs',dom,async()=>{
  const w=page(null);
  w.document.querySelector('button').click();await tick();
  assert.equal(JSON.stringify(w.shared),'[{"plainHandler":true}]');
  w.close();
});

test('both Home invite buttons are wired, and the default Sere caption is not repeated',()=>{
  assert.match(read('sota-hubs.js'),/data-iv-quick="Home: Top Mates"/);
  assert.match(read('sota-pulse.js'),/data-iv-quick="Home: Start something"/);
  assert.match(read('sota-pulse.js'),/p\.sere && String\(p\.body \|\| ''\)\.trim\(\) === '🎤 Sere' \? ''/);
  assert.match(read('sota-plus.js'),/inviteRpc:/);
});
