(function(){
 'use strict';
 function uuid4(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g,function(c){return (c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16);});}
 const C=window.DimauCommsCore,$=id=>document.getElementById(id);
 const sb=window.supabase.createClient('https://aqfzpaczyodhugsgqvxi.supabase.co','sb_publishable_DvpX2PSuPtxE3IqWUlRZfQ_YP2qLZtF');
 const S={user:null,me:null,groups:[],group:null,rows:new Map(),profiles:new Map(),epoch:0,loading:false,sending:false,operation:null,dirty:true,tab:'chat',cursor:null,complete:false};
 window.SotaSpaceDesign?.init({getOwner:()=>S.user?.id||null});window.SotaSpaceDesign?.mount($('workspace'),{page:'communications'});
 const callUI=window.DimauNativeCalls.create({sb,root:$('nativeCalls'),inbox:$('callInbox'),getContext:()=>({user:S.user,group:S.group,groups:S.groups}),onStatus:tell,onSelectGroup:async crew=>{const g=S.groups.find(g=>String(g.id)===String(crew));if(g){setTab('calls');await selectGroup(g);}}});
 const route=C.routeView(new URLSearchParams(location.search).get('view'));S.tab=route.tab;let focusGroups=route.groups;
 const names={todo:'To do',doing:'In progress',done:'Done'};
 function tell(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
 function make(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function button(text,fn,cls='secondary'){const n=make('button',text,cls);n.type='button';n.addEventListener('click',fn);return n;}
 function check(result){if(result.error)throw result.error;return result.data;}
 const circleStyleKeys=new Set();
 function clearCircleTheme(){const host=$('groupWorkspace');for(const key of circleStyleKeys)host.style.removeProperty(key);circleStyleKeys.clear();host.classList.remove('circle-workspace');delete host.dataset.circleSkin;$('circleIdentity').textContent='';}
 function circleTheme(group){
  const host=$('groupWorkspace'),types=window.SotaCircleTypes,skins=window.BulaSkins;if(!host||!types||!skins)return;
  const type=types.get(group.circle_type),settings=types.theme(type.id,skins);clearCircleTheme();
  for(const [key,value]of Object.entries(skins.tokens(settings))){host.style.setProperty(key,value);circleStyleKeys.add(key);}
  host.classList.add('circle-workspace');host.dataset.circleSkin=settings.id;
  const preset=skins.presets.find(p=>p.id===settings.id);$('circleIdentity').textContent=type.emoji+' '+type.label+' · '+(preset?.name||'Shared circle skin');
 }
 function circlePreview(){
  const host=$('circleSkinPreview'),types=window.SotaCircleTypes,skins=window.BulaSkins;if(!host||!types||!skins)return;
  const type=types.get($('groupType').value),settings=types.theme(type.id,skins),tokens=skins.tokens(settings),preset=skins.presets.find(p=>p.id===settings.id);
  for(const key of ['--bv-panel','--bv-ink','--bv-accent'])host.style.setProperty(key,tokens[key]);
  host.textContent=type.emoji+' '+type.label+' · '+(preset?.name||'Shared circle skin')+' skin for everyone in the circle.';
 }
 async function circleAccount(user,run){
  const result=check(await sb.auth.getUser());
  if(!user||result?.user?.id!==user||S.user?.id!==user||run!==S.epoch)throw Error('account-changed');
 }
 async function circleGroups(){if(window.SotaCircles)return window.SotaCircles.list();return check(await sb.rpc('bv_my_crews'))||[];}
 async function refreshCircleDetails(){
  const user=S.user?.id,run=S.epoch,id=S.group?.id;if(!user)return;
  try{const groups=await circleGroups();if(S.user?.id!==user||run!==S.epoch)return;S.groups=groups;paintGroups();
   if(!id)return;const group=groups.find(g=>String(g.id)===String(id));
   if(!group){reset();paintGroups();tell('This circle is no longer available to your account.');return;}
   S.group=group;$('roomName').textContent=group.name;$('memberCount').textContent=String(group.members||1)+' members · Shared Koro history';circleTheme(group);
  }catch(_){if(S.user?.id===user&&run===S.epoch)tell('Circle details could not refresh. Try again when connected.',true);}
 }
 window.SotaCircles?.init({client:sb,state:S,toast:tell,auth:()=>location.assign('/'),go:()=>location.assign('/'),render:refreshCircleDetails,openRoom:handle=>{try{sessionStorage.setItem('sota-find-mate',handle);}catch(_){}location.assign('/');}});
 if(window.SotaCircleTypes){$('groupType').innerHTML=window.SotaCircleTypes.options();$('groupType').addEventListener('change',circlePreview);circlePreview();}
 function current(run,group=S.group?.id){return run===S.epoch&&S.user&&String(group)===String(S.group?.id);}
 function stamp(row){const p=S.profiles.get(row.author);return (row.author===S.user?.id?'You':p?.display_name||p?.handle||'Koro member')+' · '+new Date(row.created_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});}
 function reset(identity=false){window.SotaCircles?.stop();clearCircleTheme();callUI.resetContext();S.epoch++;S.group=null;S.rows.clear();S.profiles.clear();S.cursor=null;S.complete=false;S.loading=false;S.sending=false;S.operation=null;S.dirty=true;document.querySelectorAll('#connected input,#connected textarea,#connected button,#connected select').forEach(n=>n.disabled=false);$('groupWorkspace').hidden=true;$('noGroup').hidden=false;$('messages').textContent='';$('threads').textContent='';$('board').textContent='';$('calls').textContent='';$('chatText').value='';$('threadTitle').value='';$('threadText').value='';$('taskTitle').value='';$('groupCode').hidden=true;if(identity){S.me=null;S.groups=[];paintGroups();$('groupName').value='';$('groupType').value='koro';$('groupGraphVisibility').value='private';$('createShowOnGraph').checked=false;$('joinShowOnGraph').checked=false;circlePreview();$('joinCode').value='';$('copyCode').value='';$('accountName').textContent='';}}
 async function boot(){
  const preferred=S.group?.id,previous=S.user?.id;reset(true);S.user=null;$('connected').hidden=true;const run=S.epoch;tell('Checking your Sota Kece account…');
  try{const {session}=check(await sb.auth.getSession());if(run!==S.epoch)return;S.user=session?.user||null;window.SotaSpaceDesign?.apply();
   $('connected').hidden=!S.user;$('signedOut').hidden=!!S.user;
   if(!S.user){tell('Sign in on Sota Kece to open your existing Koro.');return;}
   const user=S.user.id;const profile=check(await sb.from('bv_profiles').select('id,handle,display_name').eq('id',user).maybeSingle());if(S.user?.id!==user||run!==S.epoch)return;
   if(!profile){reset();$('connected').hidden=true;$('signedOut').hidden=false;tell('Finish creating your Sota Kece room on the home page, then reconnect here.');return;}
   S.me=profile;$('accountName').textContent='Signed in as '+(profile.display_name||profile.handle);S.profiles.set(profile.id,profile);await loadGroups(previous===user?preferred:undefined);
  }catch(_){if(run!==S.epoch)return;reset(true);S.user=null;$('connected').hidden=true;tell('Your account could not connect. Reconnect or sign in on Sota Kece again.',true);$('signedOut').hidden=false;}
 }
 function paintGroups(){const host=$('groups');host.textContent='';if(!S.groups.length){host.append(make('p','No Koro yet. Create one below or join with an invitation.','fine'));return;}
  for(const group of S.groups){const n=button('',()=>selectGroup(group),'group-button');n.classList.toggle('selected',String(group.id)===String(S.group?.id));n.setAttribute('aria-pressed',String(String(group.id)===String(S.group?.id)));n.append(make('span',group.emoji||'✦','group-icon'));const text=make('span');text.append(make('strong',group.name),make('small',String(group.members||1)+' members'));n.append(text);host.append(n);}
 }
 async function loadGroups(prefer,run=S.epoch){const user=S.user?.id;if(!user)return;try{const groups=await circleGroups();if(S.user?.id!==user||run!==S.epoch)return;S.groups=groups;paintGroups();
   if(S.group&&!groups.some(g=>String(g.id)===String(S.group.id))){reset();paintGroups();tell('This Koro is no longer available to your account.');}
   const selected=groups.find(g=>String(g.id)===String(prefer));if(selected)await selectGroup(selected);else if(!S.group)tell(groups.length?'Choose a Koro to start.':'Create your first Koro or join with a code.');if(focusGroups){$('groups').tabIndex=-1;$('groups').focus({preventScroll:true});focusGroups=false;}
  }catch(_){if(S.user?.id!==user||run!==S.epoch)return;tell('Your Koro could not load. Refresh groups when your connection returns.',true);}
 }
 async function selectGroup(group){if(callUI.active){tell('Leave your current call before changing Koro.');return;}if(S.sending){tell('Wait for your current message to finish saving.');return;}reset();S.group=group;const run=S.epoch;paintGroups();$('noGroup').hidden=true;$('groupWorkspace').hidden=false;$('roomName').textContent=group.name;$('memberCount').textContent=String(group.members||1)+' members · Shared Koro history';circleTheme(group);setTab(S.tab);callUI.setContext();tell('Loading this Koro’s shared history…');await refresh(run,true);}
 async function refresh(run=S.epoch,full=false){if(!S.user||!S.group||S.loading||document.hidden||!navigator.onLine)return;S.loading=true;const group=S.group.id,after=full?null:S.cursor,loaded=[],pageSize=200;let offset=0;
  try{const groups=await circleGroups();if(!current(run,group))return;const membership=groups.find(g=>String(g.id)===String(group));if(!membership){reset();S.groups=groups;paintGroups();tell('Your account is no longer a member of this Koro.');return;}S.groups=groups;S.group=membership;$('roomName').textContent=membership.name;$('memberCount').textContent=String(membership.members||1)+' members · Shared Koro history';circleTheme(membership);
   while(true){let q=sb.from('bv_crew_messages').select('id,crew_id,author,body,created_at').eq('crew_id',group).order('created_at',{ascending:true}).order('id',{ascending:true});if(after)q=q.gte('created_at',after);const rows=check(await q.range(offset,offset+pageSize-1))||[];if(!current(run,group))return;loaded.push(...rows);if(rows.length<pageSize)break;offset+=pageSize;if(offset>=50000)throw Error('history-limit');}
   if(!current(run,group))return;let changed=!S.complete;for(const row of loaded){if(JSON.stringify(S.rows.get(String(row.id)))!==JSON.stringify(row))changed=true;S.rows.set(String(row.id),row);}if(changed)S.dirty=true;const authors=[...new Set(loaded.map(r=>r.author))].filter(id=>!S.profiles.has(id));for(let i=0;i<authors.length;i+=100){const profiles=check(await sb.from('bv_profiles').select('id,display_name,handle').in('id',authors.slice(i,i+100)))||[];if(!current(run,group))return;for(const p of profiles)S.profiles.set(p.id,p);}
   if(loaded.length)S.cursor=loaded[loaded.length-1].created_at;S.complete=true;if(S.dirty&&!S.sending)paint();tell('Connected · shared with this Koro. Refreshes every 6 seconds.');
  }catch(error){if(current(run,group)){if(full){S.rows.clear();S.complete=false;paint();}tell(error.message==='history-limit'?'This Koro is too large to load completely here. Use the original Koro on Sota Kece.':'This Koro could not refresh. Your draft is still here. Reconnect to try again.',true);}}
  finally{if(run===S.epoch)S.loading=false;}
 }
 function metadata(row){return make('p',stamp(row),'message-meta');}
 function empty(host,text){host.append(make('p',text,'empty-note'));}
 function paint(){const active=document.activeElement,focus=active?.id,selection=typeof active?.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;const data=C.reduce([...S.rows.values()]);$('chatCount').textContent=data.chat.length?'('+data.chat.length+')':'';paintChat(data.chat);paintThreads(data.threads);paintBoard(data.tasks);paintCalls(data.calls);if(focus){const target=$(focus);if(target&&target!==active){target.focus({preventScroll:true});if(selection&&target.setSelectionRange)target.setSelectionRange(...selection);}}S.dirty=false;}
 function paintChat(rows){const host=$('messages'),nearEnd=host.scrollHeight-host.scrollTop-host.clientHeight<100;host.textContent='';if(!rows.length)empty(host,'Start with a hello. Your messages are shared with this Koro.');
  for(const row of rows){const item=make('article',undefined,'message'+(row.author===S.user?.id?' mine':''));item.append(metadata(row),make('p',row.text,'message-body'));host.append(item);}if(nearEnd)host.scrollTop=host.scrollHeight;
 }
 function paintThreads(threads){const host=$('threads'),open=new Set([...host.querySelectorAll('details[open]')].map(n=>n.dataset.thread));const drafts=new Map([...host.querySelectorAll('textarea')].map(n=>[n.dataset.thread,n.value]));host.textContent='';if(!threads.length)empty(host,'No discussions yet. Give the first one a topic above.');
  for(const thread of [...threads].reverse()){const wrap=make('details',undefined,'thread');wrap.dataset.thread=thread.id;wrap.open=open.has(thread.id);const title=make('summary');title.append(make('strong',thread.title),make('span',thread.replies.length+' replies','fine'));wrap.append(title,metadata(thread.row),make('p',thread.text,'message-body'));
   for(const reply of thread.replies){const n=make('article',undefined,'reply');n.append(metadata(reply.row),make('p',reply.text,'message-body'));wrap.append(n);}
   const form=make('form',undefined,'reply-form'),label=make('label','Reply to this discussion'),input=make('textarea');input.id='reply-'+thread.id;label.htmlFor=input.id;input.dataset.thread=thread.id;input.maxLength=700;input.required=true;input.rows=2;input.value=drafts.get(thread.id)||'';const submit=make('button','Post reply','secondary');submit.type='submit';form.append(label,input,submit);form.addEventListener('submit',e=>{e.preventDefault();try{save(C.encode({kind:'reply',thread:thread.id,text:input.value.trim()}),form,()=>{input.value='';});}catch(err){tell(err.message,true);}});wrap.append(form);host.append(wrap);}
 }
 function paintBoard(tasks){const host=$('board'),editor=host.querySelector('form.task-edit'),editing=editor?{id:editor.dataset.taskId,value:editor.querySelector('input').value}:null,focused=document.activeElement?.dataset?.taskId;host.textContent='';for(const state of C.statuses){const col=make('section',undefined,'board-column');col.append(make('h3',names[state]+' · '+tasks.filter(t=>t.status===state).length));const list=make('div',undefined,'task-list');for(const task of tasks.filter(t=>t.status===state)){const card=make('article',undefined,'task');card.append(make('h4',task.title),metadata(task.row));const label=make('label','Move card'),select=make('select');select.id='move-'+task.id;select.dataset.taskId=task.id;label.htmlFor=select.id;select.setAttribute('aria-label','Move '+task.title);for(const value of C.statuses){const option=make('option',names[value]);option.value=value;option.selected=value===task.status;select.append(option);}select.addEventListener('change',()=>save(C.encode({kind:'task',id:task.id,title:task.title,status:select.value}),select));card.append(label,select,button('Edit card',()=>editTask(task,card),'text-button'));if(editing?.id===task.id)editTask(task,card,editing.value,false);list.append(card);}if(!list.children.length)empty(list,'No cards here.');col.append(list);host.append(col);}if(focused)host.querySelector('[data-task-id="'+focused+'"]')?.focus({preventScroll:true});}
 function editTask(task,card,draft=task.title,focus=true){const form=make('form',undefined,'task-edit'),label=make('label','Task title'),input=make('input');input.id='edit-'+task.id;label.htmlFor=input.id;input.maxLength=180;input.required=true;input.value=draft;form.dataset.taskId=task.id;const submit=make('button','Save card','primary');submit.type='submit';form.append(label,input,submit,button('Cancel',()=>{form.remove();paint();},'text-button'));form.addEventListener('submit',e=>{e.preventDefault();try{save(C.encode({kind:'task',id:task.id,title:input.value.trim(),status:task.status}),form,()=>form.remove());}catch(err){tell(err.message,true);}});card.textContent='';card.append(form);if(focus)input.focus();}
 function paintCalls(calls){const host=$('calls');host.textContent='';if(!calls.length)empty(host,'No meeting invitations yet. Create one above.');for(const call of [...calls].reverse()){const url=C.meetingUrl(call.id,call.mode);if(!C.validMeetingUrl(url))continue;const card=make('article',undefined,'call-card');card.append(make('h4',call.mode==='audio'?'Audio-call invitation':'Video-call invitation'),metadata(call.row),make('p','External Jitsi Meet · anyone holding this link may join.','fine'));const link=make('a','Open meeting on Jitsi ↗','primary link-button');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';card.append(link,button('Show meeting link',()=>{let field=card.querySelector('input');if(!field){field=make('input');field.readOnly=true;field.setAttribute('aria-label','External Jitsi meeting link');field.value=url;card.append(field);}field.focus();field.select();},'text-button'));host.append(card);}}
 function setTab(name){S.tab=name;for(const n of document.querySelectorAll('[data-tab]')){const active=n.dataset.tab===name;n.setAttribute('aria-selected',String(active));n.tabIndex=active?0:-1;$('panel-'+n.dataset.tab).hidden=!active;}}
 async function save(body,control,success){if(S.sending||!S.user||!S.group)return;if(!S.complete){tell('Wait until the complete Koro history is connected before saving.',true);return;}const run=S.epoch,user=S.user.id,group=S.group.id,operation={};S.operation=operation;S.sending=true;const controls=control.tagName==='FORM'?[...control.querySelectorAll('input,textarea,button')]:[control];controls.forEach(n=>n.disabled=true);tell('Saving to your Koro…');
  try{const row=check(await sb.from('bv_crew_messages').insert({crew_id:group,author:user,body}).select('id,crew_id,author,body,created_at').single());if(!current(run,group)||S.user.id!==user||S.operation!==operation)return;if(row)S.rows.set(String(row.id),row);success?.();paint();tell('Saved to your Koro. Other members receive it on refresh.');}
  catch(_){if(current(run,group))tell('This did not save. Your text is still here. Try again when connected.',true);}
  finally{if(run===S.epoch&&S.operation===operation){S.operation=null;S.sending=false;controls.forEach(n=>n.disabled=false);if(S.dirty)paint();}}
 }
 function handleForm(id,fn){$(id).addEventListener('submit',e=>{e.preventDefault();try{fn(e.currentTarget);}catch(err){tell(err.message||'Check your message and try again.',true);}});}
 handleForm('sendChat',form=>{const text=$('chatText').value.trim();save(C.encode({kind:'chat',text}),form,()=>{$('chatText').value='';});});
 handleForm('startThread',form=>save(C.encode({kind:'thread',id:uuid4(),title:$('threadTitle').value.trim(),text:$('threadText').value.trim()}),form,()=>{$('threadTitle').value='';$('threadText').value='';}));
 handleForm('addTask',form=>save(C.encode({kind:'task',id:uuid4(),title:$('taskTitle').value.trim(),status:'todo'}),form,()=>{$('taskTitle').value='';}));
 handleForm('createGroup',async form=>{
  if(S.sending||!S.user)return;const run=S.epoch,user=S.user.id,operation={},controls=[...form.querySelectorAll('input,select,button')];
  const name=$('groupName').value.trim(),type=$('groupType').value,visibility=$('groupGraphVisibility').value,show=$('createShowOnGraph').checked;
  S.operation=operation;S.sending=true;controls.forEach(n=>n.disabled=true);
  try{if(!name||name.length>40||!['private','public'].includes(visibility))throw Error('invalid-circle');window.SotaCircleTypes.requireType(type);
   await circleAccount(user,run);if(S.operation!==operation)return;
   const group=check(await sb.rpc('bv_circle_create_group',{p_name:name,p_type:type,p_graph_visibility:visibility,p_show_on_graph:show,p_expected_owner:user}));
   if(S.user?.id!==user||run!==S.epoch||S.operation!==operation)return;if(!group||!/^\d+$/.test(String(group.id)))throw Error('invalid-circle');
   $('groupName').value='';$('createShowOnGraph').checked=false;S.operation=null;S.sending=false;controls.forEach(n=>n.disabled=false);await loadGroups(group.id,run);
  }catch(err){if(run===S.epoch&&S.operation===operation)tell(['PGRST202','42883'].includes(err.code)?'Circle settings are unavailable right now. Your group name is still here.':'Your circle could not be created. Check your account and choices; your group name is still here.',true);}
  finally{if(run===S.epoch&&S.operation===operation){S.operation=null;S.sending=false;controls.forEach(n=>n.disabled=false);}}
 });
 handleForm('joinGroup',async form=>{
  if(S.sending||!S.user)return;const run=S.epoch,user=S.user.id,operation={},controls=[...form.querySelectorAll('input,button')],code=$('joinCode').value.trim(),show=$('joinShowOnGraph').checked;
  S.operation=operation;S.sending=true;controls.forEach(n=>n.disabled=true);
  try{if(!code||code.length>160)throw Error('invalid-code');await circleAccount(user,run);if(S.operation!==operation)return;
   const group=check(await sb.rpc('bv_join_circle',{p_code:code,p_show_on_graph:show,p_expected_owner:user}));
   if(S.user?.id!==user||run!==S.epoch||S.operation!==operation)return;if(!/^\d+$/.test(String(group)))throw Error('invalid-circle');
   $('joinCode').value='';$('joinShowOnGraph').checked=false;S.operation=null;S.sending=false;controls.forEach(n=>n.disabled=false);await loadGroups(group,run);
  }catch(_){if(run===S.epoch&&S.operation===operation)tell('This circle could not be joined. Check the code and your account; your code is still here.',true);}
  finally{if(run===S.epoch&&S.operation===operation){S.operation=null;S.sending=false;controls.forEach(n=>n.disabled=false);}}
 });
 for(const mode of ['audio','video'])$('create'+(mode==='audio'?'Audio':'Video')).addEventListener('click',()=>{const id='Dimau-'+uuid4().replace(/-/g,'');save(C.encode({kind:'call',id,mode}),$('create'+(mode==='audio'?'Audio':'Video')));});
 $('inviteGroup').addEventListener('click',()=>{if(!S.group)return;if(window.SotaCircles)return window.SotaCircles.openInvite(S.group);tell('Circle invitations are unavailable right now. Try again when connected.',true);});
 $('reloadGroups').addEventListener('click',()=>{if(S.group)refresh();else loadGroups();});$('checkSession').addEventListener('click',boot);$('signOut').addEventListener('click',async()=>{reset(true);S.user=null;$('connected').hidden=true;$('signedOut').hidden=false;const result=await sb.auth.signOut();tell(result.error?'Your view is cleared. Sign-out could not be confirmed; reconnect to retry.':'Signed out. Your group history remains saved.');});
 document.querySelector('.tabs').addEventListener('click',e=>{const n=e.target.closest('[data-tab]');if(n)setTab(n.dataset.tab);});document.querySelector('.tabs').addEventListener('keydown',e=>{const tabs=[...document.querySelectorAll('[data-tab]')],index=tabs.indexOf(e.target);if(index<0)return;const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next!==null){e.preventDefault();setTab(tabs[next].dataset.tab);tabs[next].focus();}});
 const app=new URLSearchParams(location.search).get('app');if(app&&/^[a-z0-9-]{1,60}$/.test(app)){$('sourceLabel').textContent='CONNECTED FROM '+app.replace(/-/g,' ').toUpperCase();$('groupName').placeholder=app.replace(/-/g,' ').slice(0,25)+' · group name';}
 sb.auth.onAuthStateChange((_event,session)=>{if(S.user?.id!==session?.user?.id){reset(true);S.user=null;window.SotaSpaceDesign?.apply();$('connected').hidden=true;setTimeout(boot,0);}});
 window.addEventListener('offline',()=>tell('Offline. Your current draft stays on this page; messages need a connection.',true));window.addEventListener('online',()=>{if(S.group)refresh();else boot();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.group)refresh();});setInterval(()=>{if(S.group)refresh();},6000);boot();
})();

