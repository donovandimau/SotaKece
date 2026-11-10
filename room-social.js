(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SotaRoomSocial=api;
})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  let ctx=null,mounted=null,epoch=0;
  const handleOK=value=>typeof value==='string'&&/^[a-z0-9_]{3,20}$/.test(value);
  const text=(value,max)=>typeof value==='string'?value.slice(0,max):'';
  const compare=(a,b)=>a<b?-1:a>b?1:0;
  function authError(){const error=new Error('Sign in again to see your room.');error.code='AUTH_REQUIRED';return error;}
  function model(room,friends,owner=''){
    const rows=(Array.isArray(friends)?friends:[]).filter(f=>f&&handleOK(f.handle)&&(!f.status||f.status==='accepted')&&(!owner||String(f.id||'')!==String(owner))&&f.handle!==room?.profile?.handle).map(f=>({
      handle:f.handle,display_name:text(f.display_name,80),avatar_emoji:text(f.avatar_emoji,24)||'🌺',key:String(f.id||f.handle)
    })).sort((a,b)=>compare(a.handle,b.handle)||compare(a.key,b.key)||compare(a.display_name,b.display_name));
    const byHandle=new Map(),keys=new Set();
    for(const f of rows)if(!byHandle.has(f.handle)&&!keys.has(f.key)){keys.add(f.key);byHandle.set(f.handle,{handle:f.handle,display_name:f.display_name,avatar_emoji:f.avatar_emoji});}
    const accepted=[...byHandle.values()],mates=[],chosen=new Set();
    const pins=(Array.isArray(room?.top)?room.top:[]).filter(p=>p&&Number.isInteger(p.slot)&&p.slot>=1&&p.slot<=16&&byHandle.has(p.handle)).slice().sort((a,b)=>a.slot-b.slot||compare(a.handle,b.handle));
    for(const f of [...pins.map(p=>byHandle.get(p.handle)),...accepted])if(!chosen.has(f.handle)&&mates.length<16){chosen.add(f.handle);mates.push(f);}
    const notes=(Array.isArray(room?.wall)?room.wall:[]).filter(w=>w&&handleOK(w.handle)&&typeof w.body==='string').map(w=>{
      let body=text(w.body,500);
      if(body.startsWith('[sota-meme]')){try{const post=JSON.parse(body.slice(11));body=typeof post.note==='string'?text(post.note,500).trim():'';}catch(_){body='';}if(!body)body='Shared an image link.';}
      return {handle:w.handle,body:body.trim(),created_at:text(w.created_at,64),time:Number.isFinite(Date.parse(w.created_at))?Date.parse(w.created_at):0};
    }).filter(w=>w.body).sort((a,b)=>b.time-a.time||compare(a.handle,b.handle)||compare(a.body,b.body)).slice(0,2).map(({time,...note})=>note);
    return {friends:accepted,mates,notes,friendCount:accepted.length};
  }
  async function load(client,state){
    const owner=String(state?.user?.id||''),profile=state?.me,handle=profile?.handle;
    const owned=()=>owner&&String(state?.user?.id||'')===owner&&String(state?.me?.id||'')===owner&&state.me.handle===handle;
    if(!owned()||!handleOK(handle))throw authError();
    async function check(){
      const result=await client.auth.getUser();
      if(!owned())throw authError();
      if(result.error){if(result.error.name==='AuthRetryableFetchError'||result.error.status===0||result.error.status>=500)throw new Error('Your room could not be refreshed.');throw authError();}
      if(String(result.data?.user?.id||'')!==owner)throw authError();
    }
    await check();
    const [room,friends]=await Promise.all([client.rpc('bv_room',{p_handle:handle}),client.rpc('bv_my_friends')]);
    if(!owned())throw authError();
    if(room.error||friends.error)throw new Error('Your room could not be refreshed.');
    const data=room.data;
    if(!data?.found||data.visible!==true||data.is_me!==true||String(data.profile?.id||'')!==owner||data.profile?.handle!==handle)throw authError();
    if(!Array.isArray(friends.data)||!Array.isArray(data.top)||!Array.isArray(data.wall))throw new Error('Your room could not be refreshed.');
    await check();
    return {...model(data,friends.data,owner),updated:new Date()};
  }
  function markup({hero=false}={}){
    const ready=ctx?.state?.user?.id&&ctx?.state?.me?.id===ctx.state.user.id;
    const body=ready?'Loading your room…':'Your conversations, together.';
    return `<section class="sota-social-host${hero?' sota-social-hero':''}" aria-label="Your Talanoa and mates"><button type="button" class="sota-social-panel sota-social-wall" data-social-panel="wall"><span class="sota-social-heading">Talanoa</span><span class="sota-social-body" data-social-body="wall">${body}</span><span class="sota-social-action"${ready?'':' hidden'}>${ready?'Open your room →':''}</span></button><button type="button" class="sota-social-panel sota-social-mates-panel" data-social-panel="mates"><span class="sota-social-heading">Top Mates</span><span class="sota-social-body" data-social-body="mates">${ready?'Loading your friends…':'Your closest connections.'}</span><span class="sota-social-action"${ready?'':' hidden'}>${ready?'See your friends →':''}</span></button>${hero?'':'<div class="sota-social-footer"><span class="sota-social-status" role="status" aria-live="polite"></span><button type="button" class="sota-social-refresh" data-social-refresh>Refresh</button></div>'}</section>`;
  }
  function init(options){stop();ctx=options;}
  function stop(){epoch++;const previous=mounted;mounted=null;previous?.dispose();}
  function refresh(){return mounted?.feed?.refresh()||Promise.resolve();}
  function mount(container=ctx?.app){
    stop();if(!ctx||!container)return;
    const hosts=[...(container.matches?.('.sota-social-host')?[container]:[]),...container.querySelectorAll('.sota-social-host')];
    if(!hosts.length)return;
    const context=ctx,state=context.state,owner=String(state.user?.id||''),handle=state.me?.handle,run=epoch;
    const listeners=[];let disposed=false,subscription=null,feed=null,lastUpdated=null,authExpired=false;
    const active=()=>!root.document.hidden&&root.navigator?.onLine!==false;
    let wasActive=active(),activity=0,reading=null,rerun=false;
    const valid=()=>!disposed&&run===epoch&&String(state.user?.id||'')===owner&&String(state.me?.id||'')===owner&&state.me?.handle===handle&&hosts.every(host=>host.isConnected&&context.app.contains(host));
    const on=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
    function span(host,className,value){const node=host.ownerDocument.createElement('span');node.className=className;if(value!==undefined)node.textContent=value;return node;}
    function reset(kind){
      for(const host of hosts){
        host.dataset.socialState=kind;host.removeAttribute('aria-busy');
        for(const panel of host.querySelectorAll('[data-social-panel]')){
          const wall=panel.dataset.socialPanel==='wall',body=panel.querySelector('.sota-social-body'),action=panel.querySelector('.sota-social-action');
          body.replaceChildren(span(host,'sota-social-empty',kind==='guest'?(wall?'Your conversations, together.':'Your closest connections.'):kind==='setup'?'Finish setting up your room to see this panel.':kind==='auth-required'?'Sign in again to see your room.':'Your live panel is paused.'));
          action.hidden=kind==='guest';
          action.textContent=kind==='guest'?'':kind==='auth-required'?'Sign in →':kind==='setup'?'Room setup required':wall?'Open your room →':'See your friends →';
          panel.disabled=kind==='setup'||kind==='stopped';
        }
        const status=host.querySelector('.sota-social-status');if(status)status.textContent='';
        const button=host.querySelector('[data-social-refresh]');if(button)button.disabled=kind!=='loading';
      }
    }
    function dispose(){
      if(disposed)return;disposed=true;feed?.stop();subscription?.unsubscribe();listeners.forEach(fn=>fn());reset('stopped');
    }
    mounted={get feed(){return feed;},dispose};
    const guest=!owner,incomplete=!guest&&(String(state.me?.id||'')!==owner||!handleOK(handle));
    if(guest||incomplete){
      reset(guest?'guest':'setup');
      if(guest)for(const host of hosts)for(const panel of host.querySelectorAll('[data-social-panel]'))on(panel,'click',()=>{if(!disposed&&!state.user?.id)context.auth('in',true);});
      return;
    }
    function draw(result){
      if(!valid())return;lastUpdated=result.updated;
      for(const host of hosts){
        const wall=host.querySelector('[data-social-body="wall"]'),mates=host.querySelector('[data-social-body="mates"]');
        wall.replaceChildren();mates.replaceChildren();
        if(!result.notes.length)wall.append(span(host,'sota-social-empty','Your wall is ready for real notes from your friends.'));
        for(const note of result.notes){const row=span(host,'sota-social-note');row.append(span(host,'sota-social-note-author','@'+note.handle),span(host,'sota-social-note-text',note.body));wall.append(row);}
        if(!result.mates.length)mates.append(span(host,'sota-social-empty','Your accepted friends will appear here as you connect.'));
        else{
          const list=span(host,'sota-social-mates');list.setAttribute('role','list');
          for(const friend of result.mates){const row=span(host,'sota-social-mate');row.setAttribute('role','listitem');const avatar=span(host,'sota-social-avatar',friend.avatar_emoji);avatar.setAttribute('aria-hidden','true');avatar.dataset.handle=friend.handle||'';row.append(avatar,span(host,'sota-social-mate-name',friend.display_name||'@'+friend.handle));list.append(row);}
          mates.append(list);
        }
        mates.append(span(host,'sota-social-count',`${result.friendCount} accepted ${result.friendCount===1?'friend':'friends'}`));
      }
    }
    function status(value){
      if(!valid())return;
      if(value==='auth-required'){authExpired=true;feed?.stop();reset('auth-required');return;}
      for(const host of hosts){
        host.dataset.socialState=value;host.setAttribute('aria-busy',String(value==='loading'));
        const node=host.querySelector('.sota-social-status');
        if(node){node.setAttribute('aria-live',value==='current'?'off':'polite');node.textContent=value==='loading'?'Checking your room…':value==='current'?`Live · Updated ${lastUpdated.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:value==='paused'?'Updates paused':value==='stale'?'Could not refresh · Showing your last update':'Could not load your room · Try Refresh';}
        if(value==='error')for(const body of host.querySelectorAll('.sota-social-body'))body.replaceChildren(span(host,'sota-social-empty','Your room could not load. Try Refresh.'));
      }
    }
    for(const host of hosts){
      for(const panel of host.querySelectorAll('[data-social-panel]'))on(panel,'click',()=>{if(!valid())return;if(authExpired){context.auth('in',true);return;}if(panel.dataset.socialPanel==='wall')state.roomHandle=null;context.go(panel.dataset.socialPanel==='wall'?'room':'friends');});
      const button=host.querySelector('[data-social-refresh]');if(button){button.disabled=false;on(button,'click',()=>refresh());}
    }
    function wake(){
      const next=active();if(next!==wasActive){activity++;wasActive=next;}
      if(reading!==null&&reading!==activity&&next)rerun=true;
      feed.refresh().then(()=>{if(rerun&&reading===null&&valid()&&active()){rerun=false;feed.refresh();}});
    }
    const result=context.client.auth.onAuthStateChange?.((event,session)=>{
      if(event==='SIGNED_OUT'||String(session?.user?.id||'')!==owner){stop();}
    });
    subscription=result?.data?.subscription||null;
    if(disposed){subscription?.unsubscribe();return;}
    if(!root.SotaFriendFeed?.watchFriends){status('error');return;}
    feed=root.SotaFriendFeed.watchFriends({
      read:async()=>{const stamp=activity;reading=stamp;try{const result=await load(context.client,state);if(stamp!==activity)throw new Error('The page activity changed.');return result;}finally{reading=null;}},
      valid,active,onData:draw,onStatus:status
    });
    on(root.document,'visibilitychange',wake);on(root,'online',wake);on(root,'offline',wake);on(root,'focus',wake);
  }
  return {init,markup,mount,stop,refresh,load,model};
});
