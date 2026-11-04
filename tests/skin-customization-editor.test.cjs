'use strict';

// Run the complete browser modules and the real dialog handlers. No production
// requests, media permissions, uploads, or real account changes are made here.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let JSDOM,VirtualConsole;
try{({JSDOM,VirtualConsole}=require('jsdom'));}
catch(_){try{({JSDOM,VirtualConsole}=require('../call-controls/test-tools/node_modules/jsdom'));}catch(_){}}
const editorTest=(name,fn)=>test(name,{skip:!JSDOM?'Install the pinned jsdom test tools to run the browser integration.':false},fn);
const root=path.join(__dirname,'..');
const files=['skin-identities.js','skin-visuals.js','skin-discovery.js','skins.js','skin-studio.js'];
const sources=files.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]);
const owner='11111111-1111-4111-8111-111111111111';
const musicPath=owner+'/music/22222222-2222-4222-8222-222222222222.mp3';
const coverPath=owner+'/covers/33333333-3333-4333-8333-333333333333.webp';
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
const plain=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

function harness(t,{settings=null,user=null,me=null,legacy='',pending=null}={}){
  const errors=[],calls={writes:[],renders:0,auth:0,toast:[]};
  const console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error));
  const dom=new JSDOM('<!doctype html><html><head></head><body><button id="opener">Skins</button><div id="app" class="bv-welcome"><span id="bv-welcome-skin-name"></span></div></body></html>',{url:'https://sotakece.com/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
  const w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  w.S={user,me};w.app=d.querySelector('#app');w.$=selector=>d.querySelector(selector);
  w.esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  w.shell=()=>{};w.renderAuth=()=>{calls.auth++;};w.openDecorate=()=>{};
  w.render=async()=>{calls.renders++;};w.toast=message=>calls.toast.push(message);
  w.sb={from(table){
    assert.equal(table,'bv_profiles');
    assert(w.S.user,'A guest must never write a profile');
    const query={update(patch){calls.writes.push({patch:plain(patch)});return query;},eq(key,id){calls.writes.at(-1).filter={key,id};return query;},select(){return query;},single(){return pending?pending.promise:Promise.resolve({data:null,error:{message:'No response configured'}});}};
    return query;
  }};
  for(const [file,source] of sources){
    if(file==='skin-studio.js'){
      if(settings)w.localStorage.setItem('bv-picked-skin',JSON.stringify(settings));
      if(me)me.room_css=w.BulaSkins.encode(settings||{id:'lagoon'},legacy);
    }
    w.eval(source+'\n//# sourceURL=actual-'+file);
  }
  t.after(()=>{w.BulaSkinStudio.closeForOwnerChange();dom.window.close();});
  const get=selector=>d.querySelector(selector);
  const input=(selector,value,type='input')=>{const node=get(selector);assert(node,selector+' exists');if(node.type==='checkbox')node.checked=value;else node.value=String(value);node.dispatchEvent(new w.Event(type,{bubbles:true}));return node;};
  const open=initial=>{get('#opener').focus();w.BulaSkinStudio.open(initial);assert(get('.bv-studio')?.open,'A native editor dialog opens');return get('.bv-studio');};
  const choose=()=>get('button[data-editor-mode="create"]').click();
  const preview=()=>get('#bv-studio-preview .bv-preview');
  const clean=()=>assert.deepEqual(errors.map(error=>error.message),[],'No browser handler errors');
  return {w,d,calls,errors,get,input,open,choose,preview,clean,skins:w.BulaSkins};
}

function customize(h){
  h.choose();
  const values={customName:'Our sunset room',font:'handwritten',textScale:135,headingScale:145,coverHeight:360,coverX:71,coverY:24,textAlign:'right',layout:'reverse',musicPosition:'top',note:'Come as you are',accent:'#236b82'};
  for(const [key,value] of Object.entries(values))h.input('#bv-'+key,value);
  h.input('#bv-showArtwork',false);
  return values;
}

editorTest('creator controls are first-class, labelled, unique, and preserve old skin defaults',t=>{
  const h=harness(t),initial=h.skins.normalize({id:'school-marist-brothers-high-school'});
  const dialog=h.open(initial);
  assert.equal(dialog.dataset.editorMode,'browse');
  assert.equal(h.get('.bv-studio-custom').hidden,true);
  h.choose();
  assert.equal(dialog.dataset.editorMode,'create');
  assert.equal(h.get('.bv-studio-custom').hidden,false);
  assert.equal(h.get('.bv-studio-custom').open,true);
  assert.equal(h.get('button[data-editor-mode="create"]').getAttribute('aria-pressed'),'true');
  assert.equal(h.get('button[data-editor-mode="browse"]').getAttribute('aria-pressed'),'false');
  assert(h.get('.bv-creator-intro').compareDocumentPosition(h.get('.bv-studio-custom'))&h.w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert(h.get('.bv-studio-custom').compareDocumentPosition(h.get('.bv-studio-covers'))&h.w.Node.DOCUMENT_POSITION_FOLLOWING);
  const ids=Array.from(dialog.querySelectorAll('[id]'),node=>node.id);
  assert.equal(ids.length,new Set(ids).size,'Every control has a unique id');
  for(const label of dialog.querySelectorAll('label[for]'))assert(h.get('#'+label.htmlFor),label.htmlFor+' labels an existing control');
  assert.deepEqual(Array.from(h.get('#bv-font').options,option=>option.value),['rounded','serif','mono','sans','display','handwritten']);
  for(const [key,value] of Object.entries({font:initial.font,textScale:100,headingScale:100,coverHeight:195,coverX:0,coverY:100,textAlign:'left',layout:'classic',musicPosition:'auto'}))assert.equal(h.get('#bv-'+key).value,String(value));
  assert.equal(h.get('#bv-showArtwork').checked,true);
  assert.equal(h.preview().style.getPropertyValue('--bv-text-scale'),'1');
  assert.equal(h.calls.writes.length,0);h.clean();
});

editorTest('all customization controls update the real preview without losing keyboard focus or writing',t=>{
  const h=harness(t);h.open({id:'school-marist-brothers-high-school'});const values=customize(h);
  const range=h.get('#bv-textScale');range.focus();h.input('#bv-textScale',140);
  assert.equal(h.d.activeElement,range,'Live redraw does not replace the focused range');
  assert.equal(h.get('#bv-textScale-value').textContent,'140%');
  assert.equal(h.get('#bv-headingScale-value').textContent,'145%');
  assert.equal(h.get('#bv-coverHeight-value').textContent,'360px');
  assert.equal(h.preview().dataset.layout,'reverse');assert.equal(h.preview().dataset.musicPosition,'top');
  for(const [key,value] of Object.entries({'--bv-text-scale':'1.4','--bv-heading-scale':'1.45','--bv-cover-height':'360px','--bv-cover-x':'71%','--bv-cover-y':'24%','--bv-text-align':'right','--bv-hero':'none','--bv-art':'none'}))assert.equal(h.preview().style.getPropertyValue(key),value,key);
  assert.match(h.preview().style.getPropertyValue('--bv-font'),/Segoe Print/);
  assert.equal(h.get('#bv-studio-preview .bv-identity-title').textContent,values.customName);
  const sound=h.get('#bv-studio-preview .bv-preview-soundtrack'),cards=h.get('#bv-studio-preview .bv-preview-columns');
  assert(sound.compareDocumentPosition(cards)&h.w.Node.DOCUMENT_POSITION_FOLLOWING,'Top music appears before the room cards');
  h.input('#bv-customName','<img src=x onerror=alert(1)>');
  assert.equal(h.get('#bv-studio-preview .bv-identity-title').textContent,'<img src=x onerror=alert(1)>');
  assert.equal(h.get('#bv-studio-preview .bv-identity-title img'),null,'A design name is text');
  assert.equal(h.w.localStorage.getItem('bv-picked-skin'),null);assert.equal(h.calls.writes.length,0);h.clean();
});

editorTest('guest save opens the chosen customized room and Change skin restores every saved edit',t=>{
  const h=harness(t);h.open({id:'school-marist-brothers-high-school'});const values=customize(h);
  h.get('#bv-save').click();
  assert.equal(h.get('.bv-studio'),null);
  const saved=JSON.parse(h.w.localStorage.getItem('bv-picked-skin'));
  for(const [key,value] of Object.entries(values))assert.equal(saved[key],value,key);
  assert.equal(saved.showArtwork,false);
  assert.equal(h.get('#bv-skin-room-title').textContent,values.customName);
  assert.equal(h.get('#bv-skin-room').dataset.skin,'school-marist-brothers-high-school');
  assert.equal(h.get('#bv-skin-room .bv-preview').dataset.layout,'reverse');
  assert.equal(h.get('#bv-skin-room .bv-preview').style.getPropertyValue('--bv-hero'),'none');
  assert.equal(h.d.activeElement,h.get('#bv-skin-room-title'));
  h.get('#bv-room-change-skin').click();
  assert.equal(h.get('.bv-studio').dataset.editorMode,'create','A named design returns to the creator');
  for(const [key,value] of Object.entries(values))assert.equal(h.get('#bv-'+key).value,String(value),key);
  assert.equal(h.get('#bv-showArtwork').checked,false);
  assert.equal(h.calls.writes.length,0);assert.equal(h.calls.renders,0);assert.equal(h.calls.auth,0);h.clean();
});

editorTest('Cancel discards a draft, restores the selected appearance, and returns focus to its opener',t=>{
  const selected={id:'lagoon',customName:'Saved design',font:'sans',textScale:110,coverX:30,showArtwork:true};
  const h=harness(t,{settings:selected});h.open();customize(h);
  h.get('#bv-cancel').click();
  assert.equal(h.get('.bv-studio'),null);
  assert.deepEqual(JSON.parse(h.w.localStorage.getItem('bv-picked-skin')),selected,'Cancel does not overwrite the saved choice');
  assert.equal(h.get('#app').dataset.homeSkin,'lagoon');
  assert.equal(h.get('#app').style.getPropertyValue('--bv-text-scale'),'1.1');
  assert.equal(h.d.activeElement,h.get('#opener'));
  h.open();assert.equal(h.get('#bv-customName').value,'Saved design');assert.equal(h.get('#bv-coverX').value,'30');
  assert.equal(h.calls.writes.length,0);h.clean();
});

editorTest('blank, reset, Undo, and choosing a new cover keep media and update selection state',t=>{
  const initial={id:'school-marist-brothers-high-school',trackPath:musicPath,coverPath,trackTitle:'My music',interests:'Music, family'};
  const h=harness(t);h.open(initial);h.input('#bv-skin-category','All','change');const values=customize(h);
  const assertSelected=id=>{
    const selected=Array.from(h.get('.bv-studio').querySelectorAll('[data-skin][aria-pressed="true"]'));
    assert(selected.length>0,'Current skin has a visible selected option');
    assert(selected.every(button=>button.dataset.skin===id),'Catalogue and cover selection agree with the actual draft');
  };
  h.get('#bv-start-blank').click();
  assert.equal(h.get('#bv-customName').value,'My own skin');assert.equal(h.get('#bv-showArtwork').checked,false);
  assert.equal(h.get('#bv-pattern').value,'plain');assert.equal(h.get('#bv-textScale').value,'100');
  assert.equal(h.d.activeElement,h.get('#bv-customName'));assert.equal(h.get('#bv-undo-design').hidden,false);
  assert.equal(h.get('#bv-trackTitle').value,'My music');assert.equal(h.get('#bv-interests').value,'Music, family');
  assertSelected('lagoon');
  h.get('#bv-undo-design').click();
  for(const [key,value] of Object.entries(values))assert.equal(h.get('#bv-'+key).value,String(value),key);
  assert.equal(h.get('#bv-showArtwork').checked,false);assertSelected(initial.id);
  h.get('#bv-reset-design').click();
  assert.equal(h.get('#bv-customName').value,'');assert.equal(h.get('#bv-textScale').value,'100');assert.equal(h.get('#bv-showArtwork').checked,true);
  h.get('#bv-undo-design').click();
  h.input('#bv-skin-category','Schools','change');
  h.get('#bv-skin-options [data-skin="school-natabua-high-school"]').click();
  assert.equal(h.get('#bv-showArtwork').checked,true,'Choosing another cover intentionally restores its artwork');
  for(const key of ['customName','font','textScale','headingScale','coverHeight','coverX','coverY','textAlign','layout','musicPosition'])assert.equal(h.get('#bv-'+key).value,String(values[key]),key+' survives another base cover');
  h.get('#bv-save').click();const saved=JSON.parse(h.w.localStorage.getItem('bv-picked-skin'));
  assert.equal(saved.trackPath,musicPath);assert.equal(saved.coverPath,coverPath);assert.equal(saved.trackTitle,'My music');assert.equal(saved.interests,'Music, family');h.clean();
});

editorTest('keyboard gallery navigation, quick placement, and preview return controls keep coherent state',t=>{
  const h=harness(t);h.open({id:'lagoon'});
  h.input('#bv-skin-category','All','change');
  const options=Array.from(h.get('#bv-skin-options').querySelectorAll('[data-skin]'));
  assert(options.length>2);options[0].focus();
  const arrow=new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true});options[0].dispatchEvent(arrow);
  assert.equal(h.d.activeElement,options[1]);assert.equal(arrow.defaultPrevented,true);
  assert.equal(h.get('#bv-skin-options [aria-pressed="true"]').dataset.skin,'lagoon','Arrow navigation alone does not choose a skin');
  h.choose();const corner=h.get('[data-cover-x="100"][data-cover-y="0"]');corner.focus();corner.click();
  assert.equal(h.get('#bv-coverX').value,'100');assert.equal(h.get('#bv-coverY').value,'0');
  assert.equal(corner.getAttribute('aria-pressed'),'true');assert.equal(h.d.activeElement,corner);
  h.get('[data-preview-mode="chat"]').click();
  assert(h.get('#bv-studio-preview .bv-chat-preview'));assert.equal(h.get('[data-preview-mode="chat"]').getAttribute('aria-pressed'),'true');
  h.get('#bv-view-preview').click();assert.equal(h.d.activeElement,h.get('.bv-preview-back'));
  h.get('.bv-preview-back').click();assert.equal(h.d.activeElement,h.get('button[data-editor-mode="create"]'));
  h.get('.bv-studio').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(h.get('.bv-studio'),null);assert.equal(h.d.activeElement,h.get('#opener'));assert.equal(h.w.localStorage.getItem('bv-picked-skin'),null);h.clean();
});

editorTest('owner save encodes customization, locks every new control, and waits for the confirmed owner row',async t=>{
  const gate=deferred(),me={id:owner,display_name:'Sina',bio:'Bula',handle:'sina'};
  const h=harness(t,{user:{id:owner},me,settings:{id:'lagoon'},legacy:'.scrawl{color:#112233}',pending:gate});
  h.open();const values=customize(h);h.input('#d-name','Sina edited');
  assert.equal(h.calls.writes.length,0);
  h.get('#bv-save').click();assert.equal(h.calls.writes.length,1);
  assert.equal(h.get('.bv-studio').getAttribute('aria-busy'),'true');
  for(const selector of ['button[data-editor-mode="browse"]','button[data-editor-mode="create"]','#bv-start-blank','#bv-reset-design','#bv-undo-design','#bv-view-preview','#bv-customName','#bv-showArtwork','#bv-font','#bv-textScale','#bv-headingScale','#bv-coverHeight','#bv-coverX','#bv-coverY','#bv-layout','#bv-musicPosition','#bv-textAlign'])assert.equal(h.get(selector).disabled,true,selector+' is locked while saving');
  h.get('.bv-studio').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(h.get('.bv-studio'),'Escape cannot close an in-flight save');
  const write=h.calls.writes[0],read=h.skins.read(write.patch.room_css);
  assert.deepEqual(write.filter,{key:'id',id:owner});assert.equal(write.patch.display_name,'Sina edited');
  assert.equal(read.legacy,'.scrawl{color:#112233}');
  for(const [key,value] of Object.entries(values))assert.equal(read.settings[key],value,key);
  assert.equal(read.settings.showArtwork,false);assert.equal(me.display_name,'Sina','The local profile waits for confirmation');
  gate.resolve({data:{id:owner,...write.patch},error:null});await tick();
  assert.equal(h.get('.bv-studio'),null);assert.equal(me.display_name,'Sina edited');assert.equal(me.room_css,write.patch.room_css);assert.equal(h.calls.renders,1);assert.equal(h.w.S.tab,'room');h.clean();
});

editorTest('custom CSS budget failure leaves the new design editable and sends no partial profile write',async t=>{
  const h=harness(t,{user:{id:owner},me:{id:owner,display_name:'Sina',handle:'sina'},settings:{id:'lagoon'}});
  h.open();customize(h);h.input('#bv-customName','🌺'.repeat(20));h.input('#bv-note','A'.repeat(80));h.input('#bv-interests','A'.repeat(160));h.input('#bv-trackTitle','A'.repeat(80));
  h.input('#d-css','.card{color:red}'+(' '.repeat(2984)));
  h.get('#bv-save').click();await tick();
  assert.equal(h.calls.writes.length,0);assert(h.get('.bv-studio'));
  assert.match(h.get('#bv-studio-error').textContent,/custom CSS is too long/i);
  assert.equal(h.get('#bv-customName').value,'🌺'.repeat(20));assert.equal(h.get('#bv-textScale').value,'135');assert.equal(h.get('#bv-save').disabled,false);
  h.input('#d-css','.card{color:red}');h.get('#bv-save').click();await tick();
  assert.equal(h.calls.writes.length,1,'Shortening only CSS allows the same design to retry');
  assert.equal(h.skins.read(h.calls.writes[0].patch.room_css).settings.customName,'🌺'.repeat(20));
  assert.match(h.get('#bv-studio-error').textContent,/No response configured/);assert.equal(h.get('#bv-cover-upload').disabled,true);h.clean();
});

editorTest('incomplete setup and account changes cannot save a creator draft to another profile',async t=>{
  const incomplete=harness(t,{user:{id:owner}});incomplete.open();customize(incomplete);incomplete.get('#bv-save').click();await tick();
  assert.match(incomplete.get('#bv-studio-error').textContent,/Finish setting up/);assert.equal(incomplete.calls.writes.length,0);assert.equal(incomplete.w.localStorage.getItem('bv-picked-skin'),null);incomplete.clean();
  const gate=deferred(),h=harness(t,{user:{id:owner},me:{id:owner,display_name:'Sina',handle:'sina'},pending:gate});
  h.open();customize(h);h.get('#bv-save').click();const saved=h.calls.writes[0].patch;
  h.w.S.user={id:'other'};h.w.S.me={id:'other',display_name:'Jo',handle:'jo'};h.w.BulaSkinStudio.closeForOwnerChange();h.open({id:'midnight',customName:'Other owner draft'});
  const replacement=h.get('.bv-studio');gate.resolve({data:{id:owner,...saved},error:null});await tick();
  assert.equal(h.get('.bv-studio'),replacement);assert.equal(h.get('#bv-customName').value,'Other owner draft');assert.equal(h.w.S.me.display_name,'Jo');assert.equal(h.w.S.me.room_css,undefined);assert.equal(h.calls.renders,0);h.clean();
});

editorTest('the saved room renderer uses the same placement tokens and moves music without changing personal data',t=>{
  const h=harness(t),settings=h.skins.normalize({id:'lagoon',customName:'My room',font:'display',textScale:120,headingScale:130,coverHeight:380,coverX:60,coverY:30,textAlign:'center',layout:'stacked',musicPosition:'bottom',showArtwork:false});
  const profile={id:owner,display_name:'Sina',handle:'sina',room_css:h.skins.encode(settings)},before=plain(profile);
  h.get('#app').innerHTML='<main id="view"><header id="room-head"></header><div class="grid two"><section class="stack"><textarea id="composer">Draft note</textarea></section><aside class="stack"></aside></div></main>';
  const composer=h.get('#composer');h.w.BulaSkinStudio.apply(profile,{is_me:true,top:[],moments:[],wall:[]});
  assert.deepEqual(profile,before);assert.equal(h.get('#composer'),composer);assert.equal(composer.value,'Draft note');
  assert.equal(h.get('#view').dataset.layout,'stacked');assert.equal(h.get('#view').dataset.musicPosition,'bottom');
  const css=h.get('#bv-active-skin').textContent;
  for(const token of ['--bv-text-scale:1.2','--bv-heading-scale:1.3','--bv-cover-height:380px','--bv-cover-x:60%','--bv-cover-y:30%','--bv-hero:none'])assert(css.includes(token),token);
  assert.equal(h.get('#room-head .bv-identity-title').textContent,'My room');
  const columns=h.get('#view .grid.two');assert.equal(columns.nextElementSibling,h.get('.bv-room-soundstage'),'Bottom soundtrack is placed after the cards');h.clean();
});

editorTest('school skins remain an explicit catalogue choice while featured covers stay neutral',t=>{
 const h=harness(t);h.open();
 assert.equal(h.get('.bv-studio-covers [data-skin^="school-"]'),null);
 const coverImages=[...h.get('.bv-studio-covers').querySelectorAll('img')].map(n=>n.getAttribute('src'));assert.equal(new Set(coverImages).size,coverImages.length,'Featured covers do not repeat the same image');
 assert.equal(h.get('.bv-collection-shortcuts [data-collection="school-pride"]'),null);
 assert.equal(h.get('#bv-skin-options [data-skin^="school-"]'),null);
 h.input('#bv-skin-category','Schools','change');assert.equal(h.get('#bv-skin-options').querySelectorAll('[data-skin]').length,8);
 h.get('#bv-skin-options [data-skin="school-natabua-high-school"]').click();assert.equal(h.get('#bv-preview-name').textContent,h.skins.presets.find(p=>p.id==='school-natabua-high-school').name);
 h.input('#bv-skin-category','All','change');assert.equal(h.get('#bv-skin-options').querySelectorAll('[data-skin]').length,94);h.clean();
});
