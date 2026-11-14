(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SotaCircles=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const PUBLIC='https://sotakece.com/',MAX_GROUPS=200,MAX_NODES=201;
  let ctx=null,revision=0,subscription=null,dialog=null,sequence=0,guestDraft=null;
  const records=new Set(),hosts=new WeakMap();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const owner=()=>String(ctx?.state?.user?.id||'');
  const types=()=>root.SotaCircleTypes;
  const handle=value=>typeof value==='string'&&/^[a-z0-9_]{3,20}$/.test(value);
  const code=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{4,128}$/.test(value);
  const visibility=value=>value==='private'||value==='public';
  const article=label=>/^[aeiou]/i.test(label)?'an':'a';
  const idText=value=>/^[1-9][0-9]{0,17}$/.test(String(value??''))?String(value):'';
  function groupId(value){const text=idText(value);if(!text)throw Error('Circle unavailable.');return Number.isSafeInteger(Number(text))?Number(text):text;}
  function text(value,max){if(typeof value!=='string'||!value.trim()||value.length>max)throw Error('Circle unavailable.');return value.trim();}
  function say(node,value){if(node&&node.textContent!==value)node.textContent=value;}
  const q=(host,name)=>host.querySelector('[data-tc-'+name+']');
  async function rpc(name,args){const result=await ctx.client.rpc(name,args);if(result?.error)throw result.error;return result?.data;}
  function missing(error){return ['PGRST202','42883'].includes(error?.code);}
  function current(r){return r.active&&r.revision===revision&&r.owner===owner()&&r.host.isConnected&&(!r.routeHash||root.location?.hash===r.routeHash);}
  function record(host,clear=true){
    for(const existing of Array.from(records))if(!existing.host.isConnected){if(existing===dialog)closeDialog(existing,{clearHash:false,restore:false,preserveDraft:true});else existing.dispose();}
    hosts.get(host)?.dispose();
    const r={host,owner:owner(),revision,scope:'tc-scope-'+(++sequence),active:true,pending:false,polling:false,timer:null,listeners:[],clear,
      dispose(){if(!r.active)return;r.active=false;root.clearTimeout(r.timer);r.listeners.forEach(off=>off());r.listeners=[];records.delete(r);if(hosts.get(host)===r)hosts.delete(host);if(r.clear)host.textContent='';}};
    hosts.set(host,r);records.add(r);return r;
  }
  function listen(r,node,event,fn){if(!node)return;node.addEventListener(event,fn);r.listeners.push(()=>node.removeEventListener(event,fn));}
  function setStatus(r,message){if(current(r))say(q(r.host,'status'),message);}
  async function authenticated(r){
    if(!r.owner||!current(r))throw Error('Sign in first.');
    const response=await ctx.client.auth.getUser();
    if(!current(r)||response?.error||String(response?.data?.user?.id||'')!==r.owner)throw Error('Sign in again.');
  }
  async function perform(r,fn,errorMessage){
    if(!current(r)||r.pending)return;
    r.pending=true;
    const controls=Array.from(r.host.querySelectorAll('button:not([data-tc-close]),input,select,textarea')).map(node=>[node,node.disabled]);
    controls.forEach(([node])=>node.disabled=true);
    try{await fn();}catch(_){setStatus(r,errorMessage||'That change could not be saved. Try again.');}
    finally{r.pending=false;if(current(r))controls.forEach(([node,disabled])=>{if(node.isConnected)node.disabled=disabled;});}
  }
  function metadata(raw,{legacy=false,invitation=false}={}){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Circle unavailable.');
    const type=legacy?types().get('koro'):types().requireType(raw.circle_type);
    if(!legacy&&(raw.skin_id!==type.skin||!visibility(raw.graph_visibility)))throw Error('Circle unavailable.');
    const group={id:groupId(raw.id),name:text(raw.name,40),circle_type:type.id,skin_id:type.skin,
      emoji:type.emoji,accent:type.accent,graph_visibility:legacy?'private':raw.graph_visibility,legacy};
    if(!invitation){
      if(!legacy&&typeof raw.show_on_graph!=='boolean')throw Error('Circle unavailable.');
      group.show_on_graph=legacy?false:raw.show_on_graph;
      group.owner=legacy?null:(typeof raw.owner==='string'&&raw.owner.length<=80?raw.owner:null);
      group.join_code=code(raw.join_code)?raw.join_code:'';
      group.members=Number.isInteger(raw.members)&&raw.members>=0?Math.min(raw.members,100000):0;
      group.last_at=typeof raw.last_at==='string'&&raw.last_at.length<=40?raw.last_at:null;
    }
    return group;
  }
  async function list(){
    if(!ctx||!owner())return [];
    const token=revision,person=owner();let rows,legacy=false;
    try{rows=await rpc('bv_circle_groups');}catch(error){if(!missing(error))throw error;legacy=true;rows=await rpc('bv_my_crews');}
    if(token!==revision||person!==owner())throw Error('Account changed.');
    if(!Array.isArray(rows)||rows.length>MAX_GROUPS)throw Error('Circles could not load.');
    const seen=new Set();
    return rows.map(row=>{const group=metadata(row,{legacy});if(seen.has(String(group.id)))throw Error('Circles could not load.');seen.add(String(group.id));return group;});
  }
  function skinName(type){return root.BulaSkins?.presets?.find(p=>p.id===type.skin)?.name||type.skin;}
  function preview(typeId){const type=types().get(typeId);return `<span class="tc-swatch" aria-hidden="true" style="background:${escape(type.displayAccent||type.accent)}"></span><span><strong>${escape(type.label)}</strong><small>Automatic skin: ${escape(skinName(type))}</small></span>`;}
  function createMarkup(prefix,initial=null){
    const guest=!owner();
    const chosen=types().get(initial?.type).id,name=typeof initial?.name==='string'?initial.name.slice(0,40):'';
    return `<form class="tc-create" data-tc-create><h2>Start a circle</h2><p>Choose your people’s space. Everyone in the circle shares its automatic skin.</p><label for="${prefix}-type">Circle type</label><select id="${prefix}-type" data-tc-type>${types().options(chosen)}</select><div class="tc-theme-preview" data-tc-preview>${preview(chosen)}</div><label for="${prefix}-name">Circle name</label><input id="${prefix}-name" data-tc-name value="${escape(name)}" maxlength="40" autocomplete="off" required placeholder="A name your friends will recognise"><label for="${prefix}-visibility">Circle graph</label><select id="${prefix}-visibility" data-tc-visibility><option value="private" selected>Private · members only</option><option value="public">Public · people who opt in</option></select><p class="tc-help">A public graph shows only people who choose to appear. It never publishes private friendship links.</p><label class="tc-check"><input type="checkbox" data-tc-consent> I choose to appear on this circle’s public graph</label><p class="tc-help">Your choice starts off. You can change it later.</p><button type="submit" class="tc-button tc-primary">${guest?'Sign up to create a circle':'Create circle'}</button>${guest?'<button type="button" class="tc-button" data-tc-sign-in>Already have an account? Sign in</button>':''}<p class="tc-status" data-tc-status role="status" aria-live="polite"></p></form>`;
  }
  function createHTML(){return createMarkup('tc-create-'+(++sequence));}
  function rememberDraft(r){
    if(r.owner)return;
    guestDraft={type:types().get(q(r.host,'type')?.value).id,name:String(q(r.host,'name')?.value||'').trim().slice(0,40),owner:''};
  }
  function auth(mode,r){if(dialog&&(dialog===r||(r&&dialog.host.contains(r.host))))closeDialog(dialog,{clearHash:false,restore:false,preserveDraft:true});ctx.auth?.(mode,true);}
  function mountCreate(host,onCreated){
    const r=record(host),form=q(host,'create');if(!form){r.dispose();return ()=>{};}
    listen(r,q(host,'type'),'change',()=>{if(current(r))q(host,'preview').innerHTML=preview(q(host,'type').value);});
    listen(r,q(host,'sign-in'),'click',()=>{rememberDraft(r);auth('in',r);});
    listen(r,form,'submit',event=>{
      event.preventDefault();if(!current(r))return;
      if(!r.owner){rememberDraft(r);auth('up',r);return;}
      perform(r,async()=>{
        const name=q(host,'name').value.trim(),type=types().requireType(q(host,'type').value),chosen=q(host,'visibility').value;
        if(!name||name.length>40){setStatus(r,'Give your circle a name between 1 and 40 characters.');return;}
        if(!visibility(chosen))throw Error('Invalid visibility.');
        const show=q(host,'consent').checked;
        await authenticated(r);if(!current(r))return;
        const group=metadata(await rpc('bv_circle_create_group',{p_name:name,p_type:type.id,p_graph_visibility:chosen,p_show_on_graph:show,p_expected_owner:r.owner}));
        if(!current(r))return;
        if(String(group.owner)!==r.owner||group.circle_type!==type.id||group.graph_visibility!==chosen||group.show_on_graph!==show)throw Error('Save unconfirmed.');
        setStatus(r,'Circle created. Invite your friends from its Invite button.');
        if(typeof onCreated==='function'){try{await onCreated(group);}catch(_){setStatus(r,'Circle created. Open your circles to find it and invite your friends.');}}
      },'Your circle could not be created. Your choices are still here. Try again.');
    });
    return ()=>r.dispose();
  }
  function ownHash(hash){return /^#(?:circle-invite|circle-graph|friends-graph)=/.test(hash||'');}
  function clearHash(hash){if(hash&&root.location?.hash===hash&&ownHash(hash))root.history.replaceState(null,'',root.location.pathname+root.location.search);}
  function closeDialog(r,{clearHash:clear=true,restore=true,preserveDraft=false}={}){
    if(!r||dialog!==r)return;
    if(r.creationDraft&&!preserveDraft)guestDraft=null;
    dialog=null;r.childDispose?.();r.dispose();
    try{if(r.host.open)r.host.close();}catch(_){}
    r.host.remove();if(clear)clearHash(r.routeHash);
    if(restore&&r.opener?.isConnected&&!r.opener.closest?.('[hidden]'))r.opener.focus?.({preventScroll:true});
  }
  function openDialog(title,routeHash=''){
    if(dialog)closeDialog(dialog,{clearHash:false,restore:false,preserveDraft:true});
    const opener=root.document.activeElement,node=root.document.createElement('dialog');node.className='tc-dialog';node.setAttribute('aria-labelledby','tc-dialog-title');
    node.innerHTML=`<header class="tc-dialog-head"><h2 id="tc-dialog-title">${escape(title)}</h2><button type="button" class="tc-button" data-tc-close aria-label="Close circle dialog">×</button></header><div class="tc-dialog-body" data-tc-body><p class="tc-status" data-tc-status role="status">Loading…</p></div>`;
    root.document.body.append(node);const r=record(node,false);r.opener=opener;r.routeHash=routeHash;r.childDispose=null;dialog=r;
    listen(r,q(node,'close'),'click',()=>closeDialog(r));
    listen(r,node,'cancel',event=>{event.preventDefault();closeDialog(r);});
    listen(r,node,'close',()=>{if(dialog===r)closeDialog(r);});
    if(typeof node.showModal==='function')node.showModal();else node.setAttribute('open','');
    return r;
  }
  function gate(r,message){
    q(r.host,'body').innerHTML=`<p>${escape(message)}</p><div class="tc-actions"><button type="button" class="tc-button tc-primary" data-tc-sign-up>Sign up</button><button type="button" class="tc-button" data-tc-sign-in>Sign in</button></div>`;
    listen(r,q(r.host,'sign-up'),'click',()=>auth('up',r));listen(r,q(r.host,'sign-in'),'click',()=>auth('in',r));
  }
  function sharedStatusHTML(r){const id=r.scope+'-share';return `<p class="tc-status" data-tc-status role="status" aria-live="polite"></p><div class="tc-copy-fallback" data-tc-fallback hidden><label for="${id}">Copy this link or invitation</label><textarea id="${id}" data-tc-copy-value readonly rows="3"></textarea></div>`;}
  async function share(r,packet,copyOnly=false){
    if(!current(r)||r.sharing)return;r.sharing=true;
    const buttons=Array.from(r.host.querySelectorAll('[data-tc-share],[data-tc-copy]')),opener=root.document.activeElement;
    buttons.forEach(button=>button.disabled=true);
    let result='manual';
    try{
      if(!copyOnly&&typeof root.navigator?.share==='function'){
        try{await root.navigator.share({title:packet.title,text:packet.text,url:packet.url});result='shared';}
        catch(error){if(error?.name==='AbortError')result='cancelled';}
      }
      if(result==='manual'){
        try{if(typeof root.navigator?.clipboard?.writeText!=='function')throw Error('Clipboard unavailable');await root.navigator.clipboard.writeText(packet.copy||packet.url);result='copied';}catch(_){}
      }
      if(!current(r))return;
      setStatus(r,result==='shared'?'Sharing completed.':result==='cancelled'?'Sharing cancelled.':result==='copied'?'Link copied. Share it with the people you choose.':'Copy the invitation or link below.');
      const fallback=q(r.host,'fallback'),input=q(r.host,'copy-value');if(fallback)fallback.hidden=result!=='manual';
      if(result==='manual'&&input){input.value=packet.copy||packet.url;if(root.document.activeElement===opener||root.document.activeElement===root.document.body){input.focus();input.select();}}
    }finally{r.sharing=false;if(current(r)){buttons.forEach(button=>button.disabled=r.shareAllowed===false);if(opener?.isConnected&&root.document.activeElement===root.document.body)opener.focus({preventScroll:true});}}
  }
  function publicURL(kind,value){return PUBLIC+'#'+kind+'='+encodeURIComponent(String(value));}
  function showRoute(kind,value){root.location.hash='#'+kind+'='+encodeURIComponent(String(value));route();}
  function notify(group,supplied){if(supplied&&typeof supplied==='object')Object.assign(supplied,group);try{Promise.resolve(typeof ctx.groupChanged==='function'?ctx.groupChanged(group):ctx.render?.()).catch(()=>{});}catch(_){}}
  function inviteActions(group){return group.join_code?'<p class="tc-help">This invitation uses the circle’s saved type and settings.</p><div class="tc-actions"><button type="button" class="tc-button tc-primary" data-tc-share>Share saved invitation</button><button type="button" class="tc-button" data-tc-copy>Copy saved invitation</button></div>':'<p class="tc-warning">The invitation code is unavailable. Try reopening Invite.</p>';}
  async function openInvite(supplied=null,initial=null){
    if(!ctx)return;
    if(!supplied&&!initial&&guestDraft&&owner()&&String(ctx.state.me?.id||'')===owner()){if(await resumeDraft())return;}
    const r=openDialog('Invite your people');
    if(!supplied){
      r.creationDraft=true;q(r.host,'body').innerHTML=createMarkup(r.scope+'-new',initial||guestDraft);
      // Keep the form's lifecycle within the dialog while preserving the dialog's Close control.
      const container=q(r.host,'body');r.childDispose=mountCreate(container,group=>{if(current(r)){closeDialog(r,{clearHash:false,restore:false});openInvite(group);}});return;
    }
    if(!r.owner){gate(r,'Sign in to invite people to one of your circles.');return;}
    try{
      const all=await list();if(!current(r))return;
      let group=all.find(candidate=>String(candidate.id)===String(supplied.id));if(!group)throw Error('Membership unavailable.');
      const type=types().get(group.circle_type),isOwner=group.owner===r.owner;
      q(r.host,'body').innerHTML=`<h3>${escape(group.name)}</h3><p class="tc-invitation-kind" data-tc-invitation-kind>You’re inviting your friends to ${article(type.label)} ${escape(type.label)}.</p><div class="tc-theme-preview" data-tc-saved-preview>${preview(type.id)}</div><p class="tc-help">This skin belongs to the circle. It does not change anyone’s personal room.</p>${group.legacy?'<p class="tc-warning">Circle settings are not available yet. Your existing Koro remains private. You can still share its existing invitation.</p>':`${isOwner?`<form data-tc-owner-form class="tc-settings"><h3>Circle settings</h3><label for="tc-owner-type">Circle type</label><select id="tc-owner-type" data-tc-owner-type>${types().options(type.id)}</select><label for="tc-owner-visibility">Circle graph</label><select id="tc-owner-visibility" data-tc-owner-visibility><option value="private"${group.graph_visibility==='private'?' selected':''}>Private · members only</option><option value="public"${group.graph_visibility==='public'?' selected':''}>Public · people who opt in</option></select><p class="tc-help">Only people who choose to appear are shown on a public graph. Private friendship links are never included.</p><div class="tc-theme-preview" data-tc-pending-preview hidden></div><button type="submit" class="tc-button">Save circle settings</button></form>`:''}<form data-tc-choice-form class="tc-settings"><label class="tc-check"><input type="checkbox" data-tc-own-choice${group.show_on_graph?' checked':''}> I choose to appear on this circle’s public graph</label><button type="submit" class="tc-button">Save my appearance choice</button></form>`}${inviteActions(group)}${sharedStatusHTML(r)}`;
      const packet=()=>{const t=types().get(group.circle_type),url=publicURL('circle-invite',group.join_code),message=`Join ${group.name}, ${article(t.label)} ${t.label} on Sota Kece.`;return {title:group.name,text:message,url,copy:message+' '+url};};
      listen(r,q(r.host,'share'),'click',()=>share(r,packet()));listen(r,q(r.host,'copy'),'click',()=>share(r,packet(),true));
      listen(r,q(r.host,'owner-type'),'change',()=>{const node=q(r.host,'pending-preview');node.hidden=false;node.innerHTML=preview(q(r.host,'owner-type').value)+'<span class="tc-help">Preview · Save circle settings to apply.</span>';});
      listen(r,q(r.host,'owner-form'),'submit',event=>{event.preventDefault();perform(r,async()=>{
        const chosen=types().requireType(q(r.host,'owner-type').value),view=q(r.host,'owner-visibility').value;if(!visibility(view))throw Error('Invalid visibility.');
        await authenticated(r);if(!current(r))return;
        const saved=await rpc('bv_circle_update_group',{p_crew:group.id,p_type:chosen.id,p_graph_visibility:view,p_expected_owner:r.owner});
        if(!current(r))return;
        if(!saved||String(saved.id)!==String(group.id)||saved.circle_type!==chosen.id||saved.skin_id!==chosen.skin||saved.graph_visibility!==view)throw Error('Save unconfirmed.');
        group={...group,circle_type:chosen.id,skin_id:chosen.skin,graph_visibility:view,emoji:chosen.emoji,accent:chosen.accent};
        say(q(r.host,'invitation-kind'),`You’re inviting your friends to ${article(chosen.label)} ${chosen.label}.`);q(r.host,'saved-preview').innerHTML=preview(chosen.id);q(r.host,'pending-preview').hidden=true;
        setStatus(r,'Circle settings saved. The invitation now uses these settings.');notify(group,supplied);
      },'Circle settings could not be saved. The invitation still uses the saved settings.');});
      listen(r,q(r.host,'choice-form'),'submit',event=>{event.preventDefault();perform(r,async()=>{
        const chosen=q(r.host,'own-choice').checked;await authenticated(r);if(!current(r))return;
        const saved=await rpc('bv_circle_graph_choice',{p_crew:group.id,p_visible:chosen,p_expected_owner:r.owner});if(!current(r))return;if(saved!==chosen)throw Error('Save unconfirmed.');
        group={...group,show_on_graph:saved};setStatus(r,'Your appearance choice is saved.');notify(group,supplied);
      },'Your appearance choice could not be saved. Try again.');});
    }catch(_){if(current(r))q(r.host,'body').innerHTML='<p class="tc-status" data-tc-status role="status">This circle’s invitation could not load. Reopen Invite when connected.</p>';}
  }
  function personalHandle(person){const profile=ctx.state.me;return String(profile?.id||'')===person&&handle(profile.handle)?profile.handle:'';}
  function mountPersonalSettings(host){
    const r=record(host);host.classList.add('tc-widget');
    if(!r.owner){host.innerHTML='<p>Sign in to manage your personal graph.</p>';return ()=>r.dispose();}
    host.innerHTML=`<form class="tc-settings" data-tc-personal-form><h3>Your personal graph</h3><label for="${r.scope}-personal-visibility">Who can view your friends graph?</label><select id="${r.scope}-personal-visibility" data-tc-personal-visibility disabled><option value="private" selected>Private · only you</option><option value="public">Public · friends who opt in</option></select><p class="tc-help">A public view includes you and accepted friends who also made their personal graph public. Other friends and private counts stay private.</p><button type="submit" class="tc-button" data-tc-save disabled>Save graph privacy</button></form><div class="tc-actions" data-tc-public-actions hidden><button type="button" class="tc-button" data-tc-view>View public graph</button><button type="button" class="tc-button" data-tc-copy>Copy public graph link</button></div>${sharedStatusHTML(r)}`;
    let saved='private',ready=false;
    const updateLink=()=>{q(host,'public-actions').hidden=!(ready&&saved==='public'&&personalHandle(r.owner));};
    rpc('bv_my_graph_visibility').then(value=>{if(!current(r))return;if(!visibility(value))throw Error('Unavailable.');saved=value;ready=true;q(host,'personal-visibility').value=value;q(host,'personal-visibility').disabled=false;q(host,'save').disabled=false;updateLink();setStatus(r,value==='public'?'Your personal graph is public. Only opted-in friends appear.':'Your personal graph is private.');}).catch(()=>{if(current(r)){ready=false;updateLink();setStatus(r,'Graph privacy settings are unavailable. No public change has been made.');}});
    listen(r,q(host,'personal-form'),'submit',event=>{event.preventDefault();if(!ready)return;perform(r,async()=>{
      const chosen=q(host,'personal-visibility').value;if(!visibility(chosen))throw Error('Invalid visibility.');
      await authenticated(r);if(!current(r))return;
      const result=await rpc('bv_set_graph_visibility',{p_visibility:chosen,p_expected_owner:r.owner});if(!current(r))return;if(result!==chosen)throw Error('Save unconfirmed.');
      saved=result;updateLink();setStatus(r,result==='public'?'Public graph saved. Only opted-in friends appear.':'Private graph saved.');
    },'Graph privacy could not be saved. Your saved setting has not changed.');});
    listen(r,q(host,'view'),'click',()=>{if(current(r)&&ready&&saved==='public'&&personalHandle(r.owner))showRoute('friends-graph',personalHandle(r.owner));});
    listen(r,q(host,'copy'),'click',()=>{if(current(r)&&ready&&saved==='public'&&personalHandle(r.owner))share(r,{title:'My Sota Kece graph',text:'My public friends graph on Sota Kece.',url:publicURL('friends-graph',personalHandle(r.owner))},true);});
    return ()=>r.dispose();
  }
  function graphData(raw,kind,publicOnly=false){
    if(!raw||raw.kind!==kind||!visibility(raw.visibility)||(publicOnly&&raw.visibility!=='public')||!Array.isArray(raw.nodes)||!Array.isArray(raw.edges)||raw.nodes.length>MAX_NODES||raw.edges.length>MAX_NODES)throw Error('Graph unavailable.');
    const seen=new Set(),nodes=raw.nodes.map(node=>{
      if(!node||!['group','person','you'].includes(node.type))throw Error('Graph unavailable.');
      const id=text(node.id,40),personId=/^person:([a-z0-9_]{3,20})$/.exec(id),group=/^group:([1-9][0-9]{0,17})$/.exec(id);
      if(seen.has(id)||(node.type==='group'?!group:!personId)||(kind==='personal'&&node.type==='group'))throw Error('Graph unavailable.');seen.add(id);
      if(node.handle!==undefined&&(!handle(node.handle)||personId?.[1]!==node.handle))throw Error('Graph unavailable.');
      return {id,type:node.type,label:text(node.label,80),emoji:typeof node.emoji==='string'&&node.emoji.length<=24?node.emoji:(node.type==='group'?'🪸':'🌺'),...(node.handle?{handle:node.handle}:{})};
    });
    if(kind==='circle'&&nodes.filter(node=>node.type==='group').length!==1)throw Error('Graph unavailable.');
    const byId=new Map(nodes.map(node=>[node.id,node])),edgeKeys=new Set(),edges=[];
    for(const edge of raw.edges){
      if(!edge||!seen.has(edge.source)||!seen.has(edge.target)||edge.source===edge.target||edge.type!==(kind==='circle'?'member':'friend'))throw Error('Graph unavailable.');
      if(kind==='circle'&&[byId.get(edge.source),byId.get(edge.target)].filter(node=>node.type==='group').length!==1)throw Error('Graph unavailable.');
      const key=[edge.source,edge.target].sort().join('|');if(!edgeKeys.has(key)){edgeKeys.add(key);edges.push({source:edge.source,target:edge.target,type:edge.type});}
    }
    return {kind,title:text(raw.title,100),visibility:raw.visibility,nodes,edges};
  }
  function drawGraph(r,target,graph){
    const signature=JSON.stringify(graph);if(r.graphSignature===signature&&target.childElementCount)return;r.graphSignature=signature;
    const active=root.document.activeElement,focused=target.contains(active)?active?.closest?.('[data-tc-person]')?.dataset.tcPerson:null;
    const slots=r.slots||(r.slots=new Map()),center=graph.nodes.find(node=>node.type==='group'||node.type==='you')||graph.nodes[0],others=graph.nodes.filter(node=>node!==center),ids=new Set(others.map(node=>node.id));
    for(const id of slots.keys())if(!ids.has(id))slots.delete(id);const used=new Set(slots.values());
    for(const node of others)if(!slots.has(node.id)){let slot=0;while(used.has(slot))slot++;slots.set(node.id,slot);used.add(slot);}
    const points=new Map();if(center)points.set(center.id,{x:360,y:240});
    for(const node of others){const slot=slots.get(node.id),a=slot<8?-Math.PI/2+[0,4,2,6,1,5,3,7][slot]*Math.PI/4:slot*2.399963229728653,radius=slot<8?220:100+((slot*17)%29)*4.5;points.set(node.id,{x:360+radius*Math.cos(a),y:240+radius*.71*Math.sin(a)});}
    const people=graph.nodes.filter(node=>node.type!=='group'),dense=others.length>8;
    target.innerHTML=`<h3>${escape(graph.title)}</h3><p class="tc-help">${graph.visibility==='public'?'Public view · only people who chose to appear.':'Member view · this includes your circle’s members. The public view can show fewer people.'}</p><p class="tc-graph-count">${people.length} visible ${people.length===1?'person':'people'}</p><div class="tc-graph-map"><svg viewBox="0 0 720 480" role="img" aria-label="${escape(graph.title)}. ${people.length} people are listed below.">${graph.edges.map(edge=>{const a=points.get(edge.source),b=points.get(edge.target);return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;}).join('')}${graph.nodes.map(node=>{const p=points.get(node.id),main=node===center;return `<g transform="translate(${p.x} ${p.y})" class="${main?'tc-graph-center':'tc-graph-person'}"><title>${escape(node.label)}</title><circle r="${main?30:dense?7:22}"/>${main||!dense?`<text text-anchor="middle" y="7" class="tc-graph-emoji">${escape(node.emoji)}</text><text text-anchor="middle" y="${main?53:45}" class="tc-graph-label">${escape(node.label.length>20?node.label.slice(0,18)+'…':node.label)}</text>`:''}</g>`;}).join('')}</svg></div><ul class="tc-graph-list">${people.map(node=>`<li>${node.handle?`<button type="button" class="tc-button" data-tc-person="${escape(node.handle)}"><span aria-hidden="true">${escape(node.emoji)}</span> ${escape(node.label)} <small>@${escape(node.handle)}</small></button>`:`<span>${escape(node.label)}</span>`}</li>`).join('')}</ul>${people.length?'':'<p>No people are visible in this graph.</p>'}`;
    if(focused){const replacement=target.querySelector(`[data-tc-person="${focused}"]`);(replacement||q(r.host,'refresh'))?.focus({preventScroll:true});}
  }
  function graphLinks(r,target){listen(r,target,'click',event=>{const button=event.target.closest?.('[data-tc-person]');if(!button||!target.contains(button)||!current(r)||!handle(button.dataset.tcPerson))return;if(!r.owner){auth('in',dialog===r?r:null);return;}if(dialog===r)closeDialog(r);ctx.openRoom?.(button.dataset.tcPerson);});}
  function polling(r,load,apply,clear){
    const active=()=>!root.document.hidden&&root.navigator?.onLine!==false;
    let activity=0,queued=false;
    const refresh=async()=>{
      root.clearTimeout(r.timer);if(!current(r))return;
      if(!active()){if(root.navigator?.onLine===false){activity++;clear();setStatus(r,'Offline. Reconnect to refresh this graph.');}return;}
      if(r.polling){queued=true;return;}
      r.polling=true;const started=activity;
      try{const data=await load();if(!current(r))return;if(root.navigator?.onLine===false){activity++;clear();setStatus(r,'Offline. Reconnect to refresh this graph.');return;}if(!active()||started!==activity)return;apply(data);}
      catch(_){if(current(r)){clear();setStatus(r,'This graph is unavailable or its access has changed. Try Refresh.');}}
      finally{r.polling=false;if(current(r)&&active()){if(queued||started!==activity){queued=false;refresh();}else r.timer=root.setTimeout(refresh,15000);}}
    };
    listen(r,root.document,'visibilitychange',refresh);listen(r,root,'online',refresh);listen(r,root,'offline',refresh);listen(r,q(r.host,'refresh'),'click',refresh);refresh();return refresh;
  }
  function mountGroupGraph(host,supplied){
    const r=record(host);host.classList.add('tc-widget');
    if(!r.owner){host.innerHTML='<p>Sign in to see this circle’s member graph.</p>';return ()=>r.dispose();}
    let group=supplied,dirty=false;
    host.innerHTML=`<div class="tc-actions"><button type="button" class="tc-button" data-tc-refresh>Refresh graph</button><div class="tc-actions" data-tc-public-actions hidden><button type="button" class="tc-button" data-tc-view>View public graph</button><button type="button" class="tc-button" data-tc-copy>Copy public graph link</button></div></div><div data-tc-graph></div><form class="tc-settings" data-tc-choice-form><label class="tc-check"><input type="checkbox" data-tc-own-choice disabled> I choose to appear on this circle’s public graph</label><button type="submit" class="tc-button" data-tc-save disabled>Save my appearance choice</button></form>${sharedStatusHTML(r)}`;
    const target=q(host,'graph');graphLinks(r,target);
    const clear=()=>{target.textContent='';q(host,'public-actions').hidden=true;q(host,'own-choice').disabled=true;q(host,'save').disabled=true;r.slots?.clear();};
    const refresh=polling(r,async()=>{const all=await list(),found=all.find(item=>String(item.id)===String(supplied.id));if(!current(r)||!found||found.legacy)throw Error('Membership unavailable.');const graph=graphData(await rpc('bv_circle_graph',{p_crew:found.id}),'circle');return {group:found,graph};},data=>{
      group=data.group;Object.assign(supplied,group);drawGraph(r,target,data.graph);q(host,'public-actions').hidden=group.graph_visibility!=='public';if(!dirty)q(host,'own-choice').checked=group.show_on_graph;q(host,'own-choice').disabled=false;q(host,'save').disabled=false;setStatus(r,'Member graph updated. Public views include only people who opt in.');
    },clear);
    listen(r,q(host,'own-choice'),'change',()=>dirty=true);
    listen(r,q(host,'choice-form'),'submit',event=>{event.preventDefault();perform(r,async()=>{const selected=q(host,'own-choice').checked;await authenticated(r);if(!current(r))return;const saved=await rpc('bv_circle_graph_choice',{p_crew:group.id,p_visible:selected,p_expected_owner:r.owner});if(!current(r))return;if(saved!==selected)throw Error('Save unconfirmed.');group.show_on_graph=saved;Object.assign(supplied,group);dirty=false;setStatus(r,'Your appearance choice is saved.');await refresh();},'Your appearance choice could not be saved. Try again.');});
    listen(r,q(host,'view'),'click',()=>{if(current(r)&&group.graph_visibility==='public')showRoute('circle-graph',group.id);});
    listen(r,q(host,'copy'),'click',()=>{if(current(r)&&group.graph_visibility==='public')share(r,{title:group.name,text:'A public Talanoa circle graph.',url:publicURL('circle-graph',group.id)},true);});
    return ()=>r.dispose();
  }
  function routeValue(){
    const hash=root.location?.hash||'',match=/^#(circle-invite|circle-graph|friends-graph)=([^&]+)$/.exec(hash);if(!match)return null;
    let value;try{value=decodeURIComponent(match[2]);}catch(_){return {hash,invalid:true};}
    if((match[1]==='circle-invite'&&!code(value))||(match[1]==='circle-graph'&&!idText(value))||(match[1]==='friends-graph'&&!handle(value)))return {hash,invalid:true};
    return {hash,kind:match[1],value};
  }
  async function invitationRoute(r,value){
    try{
      const group=metadata(await rpc('bv_circle_invitation',{p_code:value}),{invitation:true});if(!current(r))return;
      const type=types().get(group.circle_type);
      q(r.host,'body').innerHTML=`<h3>${escape(group.name)}</h3><p>You’re invited to ${article(type.label)} ${escape(type.label)}.</p><div class="tc-theme-preview">${preview(type.id)}</div><p class="tc-help">The circle’s skin is shared by its members. Your personal room stays yours.</p><p class="tc-help">${group.graph_visibility==='public'?'This circle has a public graph. Only people who choose to appear are shown.':'This circle’s graph is private to members.'}</p>${r.owner?'<form data-tc-join-form><label class="tc-check"><input type="checkbox" data-tc-consent> I choose to appear on this circle’s public graph</label><button type="submit" class="tc-button tc-primary">Join circle</button></form>':'<p>Sign in or create an account, then choose whether to join.</p><div class="tc-actions"><button type="button" class="tc-button tc-primary" data-tc-sign-up>Sign up</button><button type="button" class="tc-button" data-tc-sign-in>Sign in</button></div>'}<p class="tc-status" data-tc-status role="status" aria-live="polite"></p>`;
      listen(r,q(r.host,'sign-up'),'click',()=>auth('up',r));listen(r,q(r.host,'sign-in'),'click',()=>auth('in',r));
      listen(r,q(r.host,'join-form'),'submit',event=>{event.preventDefault();perform(r,async()=>{const show=q(r.host,'consent').checked;await authenticated(r);if(!current(r))return;const joined=groupId(await rpc('bv_join_circle',{p_code:value,p_show_on_graph:show,p_expected_owner:r.owner}));if(!current(r))return;if(String(joined)!==String(group.id))throw Error('Join unconfirmed.');closeDialog(r,{restore:false});ctx.state.tab='crews';ctx.state.crew=joined;ctx.render?.();},'This circle could not be joined. Your account and graph choice have not been changed here. Try again.');});
    }catch(_){if(current(r))q(r.host,'body').innerHTML='<p class="tc-status" data-tc-status role="status">This invitation is unavailable. Check the link with the person who invited you.</p>';}
  }
  function route(){
    if(!ctx)return false;const route=routeValue();
    if(!route){if(dialog?.routeHash)closeDialog(dialog,{clearHash:false});return false;}
    if(dialog?.routeHash===route.hash&&current(dialog))return true;
    const r=openDialog(route.kind==='circle-invite'?'Circle invitation':'Public graph',route.hash);
    if(route.invalid){q(r.host,'body').innerHTML='<p>This circle link is not valid.</p>';return true;}
    if(route.kind==='circle-invite'){invitationRoute(r,route.value);return true;}
    q(r.host,'body').innerHTML=`<div class="tc-actions"><button type="button" class="tc-button" data-tc-refresh>Refresh graph</button><button type="button" class="tc-button" data-tc-copy>Copy public graph link</button></div><div data-tc-graph></div>${sharedStatusHTML(r)}`;
    const target=q(r.host,'graph'),kind=route.kind==='circle-graph'?'circle':'personal';let available=false;
    q(r.host,'copy').disabled=true;r.shareAllowed=false;graphLinks(r,target);
    polling(r,async()=>graphData(await rpc(kind==='circle'?'bv_public_circle_graph':'bv_public_personal_graph',kind==='circle'?{p_crew:groupId(route.value)}:{p_handle:route.value}),kind,true),graph=>{drawGraph(r,target,graph);available=true;r.shareAllowed=true;q(r.host,'copy').disabled=false;setStatus(r,'Public graph updated. Only opted-in people appear.');},()=>{available=false;r.shareAllowed=false;target.textContent='';q(r.host,'copy').disabled=true;r.slots?.clear();});
    listen(r,q(r.host,'copy'),'click',()=>{if(current(r)&&available)share(r,{title:'Sota Kece public graph',text:'A public graph on Sota Kece.',url:publicURL(route.kind,route.value)},true);});
    return true;
  }
  function applyGroupSkin(group){
    const skins=root.BulaSkins,studio=root.BulaSkinStudio;if(!skins||!studio?.applyChat)return false;
    const settings=types().theme(group?.circle_type,skins);studio.applyChat({room_css:skins.encode(settings),room_accent:settings.accent});return settings;
  }
  async function resumeDraft(){
    if(!ctx||!guestDraft||!owner()||String(ctx.state.me?.id||'')!==owner())return false;
    const chosen=guestDraft,person=owner(),token=revision;
    if((chosen.owner&&chosen.owner!==person)||ownHash(root.location?.hash)){guestDraft=null;return false;}
    chosen.owner=person;
    let response;try{response=await ctx.client.auth.getUser();}catch(_){return false;}
    if(guestDraft!==chosen||token!==revision||owner()!==person)return false;
    if(response?.error||String(response?.data?.user?.id||'')!==person){guestDraft=null;return false;}
    guestDraft=null;await openInvite(null,chosen);return true;
  }
  function stop(){revision++;if(dialog)closeDialog(dialog,{clearHash:false,restore:false,preserveDraft:true});Array.from(records).forEach(r=>r.dispose());}
  function init(context){
    stop();subscription?.unsubscribe?.();ctx=context;let identity=owner();
    if(guestDraft?.owner&&guestDraft.owner!==identity)guestDraft=null;
    subscription=ctx.client.auth?.onAuthStateChange?.((event,session)=>{
      const next=String(session?.user?.id||'');
      if(guestDraft){if(guestDraft.owner&&guestDraft.owner!==next)guestDraft=null;else if(next&&!guestDraft.owner)guestDraft.owner=next;}
      if(event==='INITIAL_SESSION'&&next===owner()){identity=next;return;}
      if(event==='SIGNED_OUT'||next!==identity){identity=next;stop();}
    })?.data?.subscription||null;
  }
  return {init,list,createHTML,mountCreate,openInvite,mountPersonalSettings,mountGroupGraph,applyGroupSkin,resumeDraft,route,stop};
});
