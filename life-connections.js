(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SotaLifeConnections=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const CATEGORIES=Object.freeze([
    {id:'friends',name:'Friends',color:'#f26045',ink:'#8a281a',note:'The mates who make ordinary days better.'},
    {id:'family',name:'Family',color:'#e64e90',ink:'#962850',note:'Your roots. Your people. Your home.'},
    {id:'teachers',name:'Teachers',color:'#9662dc',ink:'#65309f',note:'The people who helped you find your way.'},
    {id:'workmates',name:'Workmates',color:'#4388e9',ink:'#21569c',note:'The crew you take on the day with.'},
    {id:'schoolmates',name:'School mates',color:'#20a8b5',ink:'#176a73',note:'Old classmates. New stories. Shared memories.'},
    {id:'dog',name:'Dog',color:'#df9b28',ink:'#80551b',note:'Four paws. A whole lot of love.'},
    {id:'cat',name:'Cat',color:'#de7b43',ink:'#8b4721',note:'Your independent little housemate.'},
    {id:'pets',name:'Other pets',color:'#76992a',ink:'#4d6818',note:'Feathers, fins, fur — all part of your world.'},
    {id:'nature',name:'Nature',color:'#29a578',ink:'#196947',note:'The living things you care for and connect with.'},
    {id:'other',name:'Other connections',color:'#bb5bb3',ink:'#81387b',note:'Neighbours, mentors and every other living connection.'}
  ]);
  const LIMIT=120,MAX_NAME=60,MAX_KIND=40;
  const category=id=>CATEGORIES.find(c=>c.id===id)||CATEGORIES[0];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=(value,max)=>typeof value==='string'?value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):'';
  const keyFor=owner=>'sota-life-connections:v1:'+(owner?'account:'+encodeURIComponent(String(owner)):'guest');
  function sanitize(records){
    if(!Array.isArray(records))return [];
    const seen=new Set();
    return records.slice(0,LIMIT).flatMap(record=>{
      if(!record||typeof record!=='object')return [];
      const id=clean(record.id,80),name=clean(record.name,MAX_NAME),kind=clean(record.kind,MAX_KIND);
      if(!id||!name||seen.has(id)||!CATEGORIES.some(c=>c.id===record.category))return [];
      seen.add(id);return [{id,name,category:record.category,kind}];
    });
  }
  function readRecords(storage,owner){
    try{
      const raw=storage?.getItem(keyFor(owner));
      if(!raw)return {records:[],available:!!storage};
      const value=JSON.parse(raw);
      if(!value||value.version!==1||!Array.isArray(value.records))return {records:[],available:true,invalid:true};
      return {records:sanitize(value.records),available:true};
    }catch(_){return {records:[],available:false};}
  }
  function saveRecords(storage,owner,records){
    try{if(!storage)return false;storage.setItem(keyFor(owner),JSON.stringify({version:1,records:sanitize(records)}));return true;}
    catch(_){return false;}
  }
  function acceptedFriends(friends){
    const seen=new Set();
    return (Array.isArray(friends)?friends:[]).slice(0,LIMIT).flatMap(friend=>{
      if(!friend||typeof friend!=='object')return [];
      const id=clean(String(friend.id||friend.key||friend.handle||''),100),name=clean(friend.display_name||friend.label||friend.handle,MAX_NAME);
      if(!id||!name||seen.has(id))return [];
      seen.add(id);
      return [{id:'accepted:'+id,name,category:'friends',kind:'Accepted Sota Kece friend',accepted:true,handle:clean(friend.handle,30)}];
    });
  }
  function graphModel(records,friends){
    const members=[...sanitize(records),...acceptedFriends(friends)];
    return {self:'you',hubs:CATEGORIES.map(c=>({...c,count:members.filter(m=>m.category===c.id).length})),members,
      edges:CATEGORIES.map(c=>({source:'you',target:c.id}))};
  }
  function sceneFromMembers(members){
    return {nodes:[{id:'you',label:'You',kind:'you',color:'#e9f5ff'},...CATEGORIES.map(c=>({id:c.id,label:c.name,color:c.color,kind:'category'})),...members.map(m=>({id:'member:'+m.id,label:m.name,color:category(m.category).color,kind:'person'}))],
      edges:[...CATEGORIES.map(c=>({source:'you',target:c.id})),...members.map(m=>({source:m.category,target:'member:'+m.id}))]};
  }
  function sceneModel(records,friends){return sceneFromMembers(graphModel(records,friends).members);}
  let sequence=0;
  function mount(host,{owner='',friends=[]}={}){
    if(!host)throw new Error('A life connections container is required.');
    const uid='slc-'+(++sequence),listeners=[],q=s=>host.querySelector(s);
    let storage=null;
    try{storage=window.localStorage;}catch(_){}
    const saved=readRecords(storage,owner);
    let records=saved.records,remote=acceptedFriends(friends),selected='friends',query='',editing='',disposed=false,saveAvailable=saved.available;
    const motionPreference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let motion=false,renderer=null;
    const on=(el,event,fn)=>{el.addEventListener(event,fn);listeners.push(()=>el.removeEventListener(event,fn));};
    host.classList.add('slc');
    host.innerHTML=`<div class="slc-topline"><span class="slc-eyebrow">EXPLORE YOUR CONNECTIONS IN 3D</span><button type="button" class="slc-motion" data-slc-motion aria-pressed="${motion}">${motion?'Pause rotation':'Resume rotation'}</button></div>
      <div class="slc-graph3d" data-slc-graph3d></div>
      <div class="slc-under-map"><p>Select a node to explore</p><strong data-slc-total></strong></div>
      <div class="slc-details" id="${uid}-details"><div class="slc-branch-head"><span class="slc-branch-dot" aria-hidden="true"></span><div><h4 data-slc-branch-name></h4><p data-slc-branch-note></p></div><button type="button" class="slc-add" data-slc-add>Add connection</button></div>
      <div class="slc-tools"><label class="slc-category-filter" for="${uid}-filter"><span>Connection type</span><select id="${uid}-filter" data-slc-filter>${CATEGORIES.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label class="slc-search"><span class="slc-sr-only">Search all life connections</span><input type="search" maxlength="60" placeholder="Search names or roles" data-slc-search autocomplete="off"></label></div>
      <p class="slc-results-label" data-slc-results-label hidden></p><div class="slc-members" data-slc-members></div>
      <form class="slc-form" data-slc-form hidden><div class="slc-form-heading"><h4 data-slc-form-title>Add a connection</h4><button class="slc-close" type="button" data-slc-cancel aria-label="Close connection form">×</button></div><label for="${uid}-name">Name<input id="${uid}-name" name="connectionName" required maxlength="60" placeholder="A person, pet or living thing" autocomplete="off"></label>
      <div class="slc-form-row"><label for="${uid}-category">Connection<select id="${uid}-category" name="connectionCategory">${CATEGORIES.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label for="${uid}-kind">Role <span>(optional)</span><input id="${uid}-kind" name="connectionKind" maxlength="40" placeholder="e.g. cousin, horse, mango tree" autocomplete="off"></label></div>
      <p class="slc-form-note">Keep only details you’re comfortable saving in this browser.</p><p class="slc-form-error" data-slc-error role="alert" hidden></p><button type="submit" class="slc-save">Save connection</button></form>
      </div><div class="slc-storage"><p><strong data-slc-storage-title>Saved on this device</strong><span data-slc-storage-note>${owner?'Your connections and node positions stay in this browser, separate for each account.':'Your connections and node positions stay in this browser. Guest and account maps are separate.'}</span></p></div><p class="slc-status slc-sr-only" data-slc-status role="status" aria-live="polite"></p>`;
    function allMembers(){return [...records,...remote];}
    function message(text){q('[data-slc-status]').textContent=text;}
    function setStorageState(){
      q('[data-slc-storage-title]').textContent=saveAvailable?'Saved on this device':'Temporary map · saving unavailable';
      if(!saveAvailable)q('[data-slc-storage-note]').textContent='This browser could not save your additions. They will be lost when you leave or reload.';
    }
    function persist(){saveAvailable=saveRecords(storage,owner,records);setStorageState();}
    function draw(){
      if(disposed)return;
      const c=category(selected),members=allMembers(),filtered=query?members.filter(m=>`${m.name} ${m.kind} ${category(m.category).name}`.toLocaleLowerCase().includes(query)):members.filter(m=>m.category===selected);
      host.classList.toggle('slc-paused',!motion);host.style.setProperty('--slc-selected',c.color);host.style.setProperty('--slc-selected-ink',c.ink);
      q('[data-slc-motion]').textContent=motion?'Pause rotation':'Resume rotation';q('[data-slc-motion]').setAttribute('aria-pressed',String(motion));
      renderer?.update(sceneFromMembers(members));renderer?.select(selected);renderer?.setMotion(motion);
      q('[data-slc-total]').textContent=members.length?`${members.length} ${members.length===1?'connection':'connections'}`:'10 connection types';
      q('[data-slc-filter]').value=selected;q('[data-slc-branch-name]').textContent=c.name;q('[data-slc-branch-note]').textContent=c.note;
      q('[data-slc-results-label]').hidden=!query;q('[data-slc-results-label]').textContent=`${filtered.length} ${filtered.length===1?'match':'matches'} across your world`;
      q('[data-slc-add]').setAttribute('aria-label','Add to '+c.name);
      q('[data-slc-members]').innerHTML=filtered.length?filtered.map(m=>`<div class="slc-member" style="--slc-member-color:${category(m.category).color}"><span class="slc-member-dot" aria-hidden="true"></span><div><strong>${esc(m.name)}</strong><small>${esc(m.kind||category(m.category).name)}${query?' · '+esc(category(m.category).name):''}</small></div>${m.accepted?'<span class="slc-accepted">Sota friend</span>':`<button type="button" class="slc-edit" data-slc-edit="${esc(m.id)}" aria-label="Edit ${esc(m.name)}">Edit</button>`}</div>`).join(''):`<div class="slc-empty"><p>${query?'No matches. Try a different name or role.':'Add a name to grow your '+esc(c.name.toLocaleLowerCase())+' connections.'}</p></div>`;
      setStorageState();
    }
    function openForm(id){
      const record=id?records.find(r=>r.id===id):null;
      editing=record?.id||'';
      q('[data-slc-form-title]').textContent=editing?'Edit connection':'Add a connection';
      q('[data-slc-form] [name="connectionName"]').value=record?.name||'';
      q('[data-slc-form] [name="connectionCategory"]').value=record?.category||selected;
      q('[data-slc-form] [name="connectionKind"]').value=record?.kind||'';
      q('[data-slc-error]').hidden=true;
      const old=q('[data-slc-remove]');if(old)old.remove();
      if(editing){const button=document.createElement('button');button.type='button';button.className='slc-remove';button.dataset.slcRemove=editing;button.textContent='Remove connection';q('[data-slc-form]').append(button);}
      q('[data-slc-form]').hidden=false;q('[data-slc-form] [name="connectionName"]').focus();
    }
    function closeForm(){q('[data-slc-form]').hidden=true;editing='';q('[data-slc-add]').focus({preventScroll:true});}
    on(host,'click',event=>{
      const edit=event.target.closest('[data-slc-edit]');if(edit&&host.contains(edit)){openForm(edit.dataset.slcEdit);return;}
      const remove=event.target.closest('[data-slc-remove]');
      if(remove&&host.contains(remove)){const deleted=records.find(r=>r.id===editing);records=records.filter(r=>r.id!==editing);persist();closeForm();draw();message((deleted?.name||'Connection')+' removed.');}
    });
    function selectNode(id){
      const member=allMembers().find(m=>'member:'+m.id===id);
      if(!member&&!CATEGORIES.some(c=>c.id===id))return;
      selected=member?member.category:id;query='';q('[data-slc-search]').value='';q('[data-slc-form]').hidden=true;editing='';draw();
      if(member)renderer?.select(id);
      message((member?.name||category(selected).name)+' selected.');
    }
    on(q('[data-slc-filter]'),'change',event=>selectNode(event.target.value));
    on(q('[data-slc-add]'),'click',()=>openForm());
    on(q('[data-slc-cancel]'),'click',closeForm);
    on(q('[data-slc-motion]'),'click',()=>{motion=!motion;draw();});
    on(q('[data-slc-search]'),'input',event=>{query=event.target.value.trim().toLocaleLowerCase();draw();});
    on(q('[data-slc-form]'),'keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeForm();}});
    on(q('[data-slc-form]'),'submit',event=>{
      event.preventDefault();
      const name=clean(q('[data-slc-form] [name="connectionName"]').value,MAX_NAME),cat=q('[data-slc-form] [name="connectionCategory"]').value,kind=clean(q('[data-slc-form] [name="connectionKind"]').value,MAX_KIND),issue=q('[data-slc-error]');
      if(!name){issue.textContent='Add a name for this connection.';issue.hidden=false;return;}
      if(!editing&&records.length>=LIMIT){issue.textContent='This device map can hold 120 personal connections. Edit or remove one before adding another.';issue.hidden=false;return;}
      const id=editing||('life-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)),record={id,name,category:category(cat).id,kind};
      records=editing?records.map(r=>r.id===editing?record:r):[...records,record];selected=record.category;query='';q('[data-slc-search]').value='';persist();closeForm();draw();message(name+(saveAvailable?' saved on this device.':' added temporarily. Saving is unavailable.'));
    });
    on(window,'storage',event=>{if(event.key===keyFor(owner)){const updated=readRecords(storage,owner);records=updated.records;saveAvailable=updated.available;draw();}});
    if(window.SotaLifeGraph3D){renderer=window.SotaLifeGraph3D.mount(q('[data-slc-graph3d]'),{...sceneFromMembers(allMembers()),onSelect:selectNode,motion,storage,storageKey:keyFor(owner)+':layout-v1'});}
    else{q('[data-slc-graph3d]').innerHTML='<p class="slc-graph-unavailable" role="status">3D view could not load. Your connections are available below.</p>';}
    if(motionPreference?.addEventListener)on(motionPreference,'change',event=>{if(event.matches)motion=false;draw();});
    draw();
    return {updateFriends(next){if(disposed)return;remote=acceptedFriends(next);draw();},dispose(){disposed=true;renderer?.dispose();renderer=null;listeners.forEach(fn=>fn());records=[];remote=[];host.textContent='';host.classList.remove('slc','slc-paused');}};
  }
  return {mount,CATEGORIES,keyFor,sanitize,readRecords,saveRecords,acceptedFriends,graphModel,sceneModel};
});
