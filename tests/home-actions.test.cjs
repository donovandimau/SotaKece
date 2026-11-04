'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../skin-studio.js'),'utf8');
const start=source.indexOf('async function shareApp(');
const end=source.indexOf('  renderAuth=function',start);
assert(start>=0&&end>start,'extract the actual shareApp and wireInvite helpers before renderAuth');
const helpers=source.slice(start,end);
const publicURL='https://sotakece.com/';
function harness(navigator={}){
  const context=vm.createContext({navigator,
    location:{href:'https://sotakece.com/?token=PRIVATE_TOKEN&room=PRIVATE_ROOM#connections=mine'},
    S:{user:{id:'PRIVATE_OWNER'},me:{display_name:'PRIVATE_NAME',handle:'PRIVATE_HANDLE'}}
  });
  vm.runInContext(helpers,context,{filename:'actual-home-share-helpers.js'});
  return context;
}
function nodes(){
  const events=new Map();
  const button={isConnected:true,disabled:false,
    addEventListener(type,listener){events.set(type,listener);},
    fire(){return events.get('click')({preventDefault(){},currentTarget:button});}
  };
  const status={isConnected:true,textContent:'Ready to invite.'};
  const input={isConnected:true,value:publicURL,parentElement:{hidden:true},focused:0,selected:0,
    focus(){this.focused++;},select(){this.selected++;}
  };
  return {button,status,input};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function focusDocument(n){
  const doc={body:{id:'body'},activeElement:n.button};let disabled=n.button.disabled;
  n.button.ownerDocument=doc;n.button.focused=0;
  n.button.focus=options=>{n.button.focused++;n.button.focusOptions=options;doc.activeElement=n.button;};
  Object.defineProperty(n.button,'disabled',{get:()=>disabled,set(value){disabled=value;if(value&&doc.activeElement===n.button)doc.activeElement=doc.body;}});
  n.input.focus=()=>{n.input.focused++;doc.activeElement=n.input;};
  return doc;
}

test('native share sends only the canonical public app invitation',async()=>{
  const payloads=[],copies=[];
  const context=harness({share:async payload=>payloads.push(payload),clipboard:{writeText:async value=>copies.push(value)}});
  const result=await context.shareApp();
  assert.equal(result.kind,'shared');assert.equal(result.message,'Sharing options opened.');assert.equal(payloads.length,1);
  const payload=JSON.parse(JSON.stringify(payloads[0]));
  assert.deepEqual(Object.keys(payload).sort(),['text','title','url']);assert.equal(payload.title,'Sota Kece');assert.equal(payload.url,publicURL);
  assert.equal(typeof payload.text,'string');assert(payload.text.trim().length>0);assert(!JSON.stringify(payload).includes('PRIVATE_'));
  assert.deepEqual(copies,[]);
});

test('cancelling native sharing never copies a link or reports success',async()=>{
  let copies=0;
  const context=harness({share:async()=>{throw {name:'AbortError'};},clipboard:{writeText:async()=>{copies++;}}});
  const result=await context.shareApp();assert.equal(result.kind,'cancelled');assert.equal(copies,0);assert.notEqual(result.message,'Sharing options opened.');
});

test('clipboard is used when native sharing is unavailable',async()=>{
  const copies=[],context=harness({clipboard:{writeText:async value=>copies.push(value)}});
  const result=await context.shareApp();assert.equal(result.kind,'copied');assert.deepEqual(copies,[publicURL]);
});

test('copy-only invitations bypass native sharing even when supported',async()=>{
  let shares=0;const copies=[];
  const context=harness({share:async()=>{shares++;},clipboard:{writeText:async value=>copies.push(value)}});
  const result=await context.shareApp(true);assert.equal(result.kind,'copied');assert.equal(shares,0);assert.deepEqual(copies,[publicURL]);
});

test('a non-cancellation native share failure falls back to the public clipboard link',async()=>{
  const copies=[],context=harness({share:async()=>{throw {name:'NotAllowedError'};},clipboard:{writeText:async value=>copies.push(value)}});
  const result=await context.shareApp();assert.equal(result.kind,'copied');assert.deepEqual(copies,[publicURL]);
});

test('missing or denied clipboard access offers the visible canonical link',async()=>{
  for(const navigator of [{},{clipboard:{}},{clipboard:{writeText:async()=>{throw new Error('Clipboard denied');}}}]){
    const result=await harness(navigator).shareApp();assert.equal(result.kind,'manual');assert(result.message.includes(publicURL));assert(!result.message.includes('PRIVATE_'));
  }
});

test('pending invitations disable the button and cannot start a duplicate share',async()=>{
  const gate=deferred();let shares=0;
  const context=harness({share:()=>{shares++;return gate.promise;}}),n=nodes();
  context.wireInvite(n.button,n.status,{input:n.input});
  const first=n.button.fire();assert.equal(n.button.disabled,true);const duplicate=n.button.fire();
  assert.equal(shares,1);gate.resolve();await Promise.all([first,duplicate]);
  assert.equal(n.button.disabled,false);assert.equal(n.status.textContent,'Sharing options opened.');assert.equal(n.input.parentElement.hidden,true);
  assert.equal(n.input.focused,0);assert.equal(n.input.selected,0);
});

test('manual fallback reveals and selects the existing input and restores the button',async()=>{
  const context=harness({clipboard:{writeText:async()=>{throw new Error('denied');}}}),n=nodes();focusDocument(n);
  context.wireInvite(n.button,n.status,{input:n.input});await n.button.fire();
  assert(n.status.textContent.includes(publicURL));assert.equal(n.input.parentElement.hidden,false);assert.equal(n.input.focused,1);assert.equal(n.input.selected,1);assert.equal(n.button.disabled,false);
});

test('copy-only wiring preserves native share bypass and hides an old manual fallback',async()=>{
  let shares=0;const copies=[],context=harness({share:async()=>{shares++;},clipboard:{writeText:async value=>copies.push(value)}}),n=nodes();
  n.input.parentElement.hidden=false;context.wireInvite(n.button,n.status,{copyOnly:true,input:n.input});await n.button.fire();
  assert.equal(shares,0);assert.deepEqual(copies,[publicURL]);assert.equal(n.input.parentElement.hidden,true);assert.equal(n.input.focused,0);assert.equal(n.button.disabled,false);
});

test('a removed button suppresses the pending status and manual-focus update',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes();
  context.wireInvite(n.button,n.status,{input:n.input});const pending=n.button.fire(),before=n.status.textContent;n.button.isConnected=false;
  gate.reject(new Error('denied'));await pending;
  assert.equal(n.status.textContent,before);assert.equal(n.input.parentElement.hidden,true);assert.equal(n.input.focused,0);assert.equal(n.input.selected,0);
  assert.equal(n.button.disabled,true,'detached controls are not changed after completion');
});

test('a removed status suppresses all result UI while a connected button is restored',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes();
  context.wireInvite(n.button,n.status,{input:n.input});const pending=n.button.fire(),before=n.status.textContent;n.status.isConnected=false;
  gate.reject(new Error('denied'));await pending;
  assert.equal(n.status.textContent,before);assert.equal(n.input.parentElement.hidden,true);assert.equal(n.input.focused,0);assert.equal(n.input.selected,0);assert.equal(n.button.disabled,false);
});

test('an input removed during sharing is never focused or selected',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes();
  context.wireInvite(n.button,n.status,{input:n.input});const pending=n.button.fire();n.input.isConnected=false;
  gate.reject(new Error('denied'));await pending;
  assert(n.status.textContent.includes(publicURL));assert.equal(n.input.focused,0);assert.equal(n.input.selected,0);assert.equal(n.button.disabled,false);
});

test('a failed copy releases the pending guard so the same button can retry',async()=>{
  let attempts=0;const context=harness({clipboard:{writeText:async()=>{if(++attempts===1)throw new Error('denied');}}}),n=nodes();
  context.wireInvite(n.button,n.status,{input:n.input});await n.button.fire();assert.equal(n.button.disabled,false);assert.equal(n.input.parentElement.hidden,false);
  await n.button.fire();assert.equal(attempts,2);assert.equal(n.button.disabled,false);assert.equal(n.input.parentElement.hidden,true);
});

test('an unexpected helper failure still restores the captured connected button',async()=>{
  const context=harness(),n=nodes();context.shareApp=async()=>{throw new Error('unexpected helper error');};
  context.wireInvite(n.button,n.status,{input:n.input});
  try{await n.button.fire();}catch(_){}
  assert.equal(n.button.disabled,false);assert.equal(n.input.focused,0);assert.equal(n.input.selected,0);
});

test('copy completion restores the focused opener when disabling it moved focus to body',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes(),doc=focusDocument(n);
  context.wireInvite(n.button,n.status,{copyOnly:true,input:n.input});const pending=n.button.fire();
  assert.equal(n.button.disabled,true);assert.equal(doc.activeElement,doc.body);assert.equal(n.button.focused,0);
  gate.resolve();await pending;
  assert.equal(n.button.disabled,false);assert.equal(doc.activeElement,n.button);assert.equal(n.button.focused,1);assert.equal(n.button.focusOptions.preventScroll,true);
});

test('completion never steals focus from another control selected while copying',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes(),doc=focusDocument(n),other={id:'other-control'};
  context.wireInvite(n.button,n.status,{copyOnly:true,input:n.input});const pending=n.button.fire();doc.activeElement=other;
  gate.resolve();await pending;
  assert.equal(n.button.disabled,false);assert.equal(doc.activeElement,other);assert.equal(n.button.focused,0);
});

test('manual fallback does not steal focus from another control selected while copying',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes(),doc=focusDocument(n),other={id:'other-control'};
  context.wireInvite(n.button,n.status,{copyOnly:true,input:n.input});const pending=n.button.fire();doc.activeElement=other;
  gate.reject(new Error('Clipboard denied'));await pending;
  assert(n.status.textContent.includes(publicURL));assert.equal(n.input.parentElement.hidden,false);assert.equal(doc.activeElement,other);assert.equal(n.input.focused,0);assert.equal(n.input.selected,0);assert.equal(n.button.focused,0);assert.equal(n.button.disabled,false);
});

test('manual fallback keeps its selected input focused instead of restoring the opener',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes(),doc=focusDocument(n);
  context.wireInvite(n.button,n.status,{copyOnly:true,input:n.input});const pending=n.button.fire();
  assert.equal(doc.activeElement,doc.body);gate.reject(new Error('Clipboard denied'));await pending;
  assert.equal(n.button.disabled,false);assert.equal(doc.activeElement,n.input);assert.equal(n.input.focused,1);assert.equal(n.input.selected,1);assert.equal(n.button.focused,0);
});

test('a button that was not the focused opener does not gain focus on completion',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes(),doc=focusDocument(n);
  doc.activeElement={id:'previous-control'};context.wireInvite(n.button,n.status,{copyOnly:true,input:n.input});const pending=n.button.fire();doc.activeElement=doc.body;
  gate.resolve();await pending;
  assert.equal(n.button.disabled,false);assert.equal(doc.activeElement,doc.body);assert.equal(n.button.focused,0);
});

test('a detached opener is not refocused even when disabling it originally lost focus',async()=>{
  const gate=deferred(),context=harness({clipboard:{writeText:()=>gate.promise}}),n=nodes(),doc=focusDocument(n);
  context.wireInvite(n.button,n.status,{copyOnly:true,input:n.input});const pending=n.button.fire();n.button.isConnected=false;
  gate.resolve();await pending;
  assert.equal(doc.activeElement,doc.body);assert.equal(n.button.focused,0);assert.equal(n.button.disabled,true);
});

test('public invitation delegates to the premium share sheet without including private route or profile data',async()=>{
 const h=harness();let packet;h.window={SotaShare:{share:async value=>{packet=value;return 'sheet';}}};
 const result=await h.shareApp();assert.equal(packet.url,publicURL);assert.equal(packet.title,'Sota Kece');assert.equal(result.kind,'sheet');assert(!JSON.stringify(packet).includes('PRIVATE_'));
});
