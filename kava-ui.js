(function(root){
  'use strict';
  let ctx,service,current=null,snapshot=null,timer=null,epoch=0,busy=false,guest=false;
  const core=()=>root.SotaKava;
  const e=value=>ctx.escape(value);
  const q=selector=>document.querySelector(selector);
  function stop(){clearTimeout(timer);timer=null;epoch++;}
  function error(err){const box=q('#kava-error');if(box){box.hidden=false;box.textContent=err.message||'Connection interrupted. Try again.';}else ctx.toast(err.message||'Connection interrupted.');}
  async function action(button,fn){
    if(busy)return;busy=true;if(button)button.disabled=true;
    try{await fn();}catch(err){error(err);}finally{busy=false;if(button?.isConnected)button.disabled=false;}
  }
  const hero=()=>`<section class="glass kava-hero" aria-labelledby="kc-lobby-title"><div class="kava-eyebrow">Talanoa • Stories • Music • Wisdom</div>
    <h1 id="kc-lobby-title">Our Talanoa Circle</h1><p>Good stories. Familiar voices. A place to bring your Village together, share what you know and make space for each other.</p>
    <div class="kava-hero-values"><span>Take turns</span><span>Listen generously</span><span>Everyone belongs</span></div></section>`;
  const lobby=content=>`<div class="kava-room kava-lobby">${hero()}${content}</div>`;
  function landingState(setup){
    return `<section class="glass card kava-setup ${setup?'':'kava-connection'}" aria-labelledby="kc-setup-title"><div class="kava-setup-copy">
      <span class="kava-setup-badge">${setup?'Explore the layout':'Connection interrupted'}</span>
      <h2 id="kc-setup-title">${setup?'Come in. Take a look around.':'Let’s reconnect.'}</h2>
      <p>${setup?'See the speaker seats, discover the conversation space and get a feel for your circle.':'Your circles could not load. Try again to reconnect with your Village.'}</p>
      <button class="btn" id="kc-retry">${setup?'Explore circle layout <span aria-hidden="true">↗</span>':'Try again'}</button>
      <p class="kava-setup-status">${setup?'Live circles and comments are not available yet. This tour is a preview, with no live people, audio or payments.':'Your saved circles have not been changed.'}</p>
      <p id="kava-error" class="kava-error" role="alert" ${setup?'hidden':''}></p></div>
      ${setup?`<div class="kava-circle-illustration" aria-hidden="true"><div class="kava-seat-ring">${Array.from({length:6},(_,i)=>`<span class="kava-ring-seat ${i===0?'is-host':''}">${i===0?'✦':'+'}</span>`).join('')}<div class="kava-ring-centre"><span class="kava-mini-bowl"></span><b>TALANOA</b><small>A space for every voice</small></div></div><span class="kava-illustration-caption">One host. Four to six speaker seats.</span></div>`:''}</section>
      ${setup?`<section class="kava-lobby-features" aria-label="Inside a circle"><article><span aria-hidden="true">01</span><h3>Your Village, together</h3><p>An invite-only space for your people.</p></article><article><span aria-hidden="true">02</span><h3>A seat for your story</h3><p>The host makes room for each speaker.</p></article><article><span aria-hidden="true">03</span><h3>More than listening</h3><p>Questions and stories keep the talanoa going.</p></article></section>`:''}`;
  }
  function init(context){ctx=context;service=core().api(ctx.client);}
  async function view(){
    stop();guest=false;current=null;snapshot=null;
    ctx.shell(lobby(`<div class="kava-state" role="status">Loading your Village circles…</div>`));
    const run=epoch;
    try{
      const [crews,circles]=await Promise.all([root.SotaCircles?root.SotaCircles.list():service.crews(),service.list()]);if(run!==epoch||ctx.state.tab!=='circles')return;
      const names=Object.fromEntries(crews.map(c=>[c.id,c.name]));
      ctx.shell(lobby(`<div class="kava-columns"><section class="glass card"><h2 style="font-size:20px">Your circles</h2>
        <p class="sub">Invite-only through your Village. Listed newest first.</p><div class="kava-list">${circles.length?circles.map(c=>`
        <button type="button" data-circle="${e(c.id)}"><strong>${e(c.title)}</strong><span>${e(names[c.crew_id]||'Your Village')} · ${c.capacity} speaker seats · ${e(c.status==='open'?'Comments open':c.status==='ended'?'Ended':'Planned')}</span></button>`).join(''):
        '<p class="kava-notice">There are no circles yet. Start one with your Village.</p>'}</div>
        <div class="kava-state">Video is awaiting setup. You can plan a circle and open its written conversation today.</div></section>
        <section class="glass card"><h2 style="font-size:20px">Host a circle</h2>${crews.length?`
        <form id="kava-create" class="kava-form"><label for="kc-koro" class="kava-label">Your Village</label><select id="kc-koro" required>${crews.map(c=>`<option value="${c.id}">${e(c.name)}</option>`).join('')}</select>
        <label for="kc-title" class="kava-label">What shall we talk about?</label><input id="kc-title" maxlength="80" required placeholder="Stories that connect us">
        <label for="kc-topic" class="kava-label">Set the scene</label><textarea id="kc-topic" maxlength="500" placeholder="The questions, stories or knowledge you want to share"></textarea>
        <label for="kc-seats" class="kava-label">Speaker seats, including you</label><select id="kc-seats"><option value="6">6 seats</option><option value="5">5 seats</option><option value="4">4 seats</option></select>
        <p class="kava-notice">You decide who takes a seat. Everyone in this Village can read and comment when you open the circle.</p>
        <button class="btn" type="submit">Create my circle</button></form>`:
        '<p class="kava-notice">Create or join a Village first, then bring your people into a circle.</p><button class="btn" id="kc-gokoro">Go to Village</button>'}
        <p id="kava-error" class="kava-error" role="alert" hidden></p></section></div>`));
      document.querySelectorAll('[data-circle]').forEach(b=>b.onclick=()=>action(b,()=>open(b.dataset.circle)));
      if(q('#kc-gokoro'))q('#kc-gokoro').onclick=()=>root.go('crews');
      if(q('#kava-create'))q('#kava-create').onsubmit=event=>{
        event.preventDefault();action(event.submitter,async()=>{const id=await service.create({crew:q('#kc-koro').value,title:q('#kc-title').value,topic:q('#kc-topic').value,capacity:q('#kc-seats').value});await open(id);});
      };
    }catch(err){if(run!==epoch)return;
      const setup=['PGRST205','PGRST202','42P01','42883'].includes(err.code);
      ctx.shell(lobby(landingState(setup)));
      if(!setup)error(err);q('#kc-retry').onclick=setup?preview:view;
    }
  }
  function frame(demo){
    return `<div class="kava-room" data-preview="${demo}"><div class="kava-room-toolbar"><button class="btn sm ghost kava-back" id="kc-back">← ${demo?'Back to sign in':'Your circles'}</button><span>Our Talanoa Circle</span><button type="button" id="kc-close" class="kava-panel-close" aria-label="Close Talanoa circle">×</button>${demo?'':'<button type="button" class="tc-button" id="kc-group-invite">Invite friends</button>'}</div><p id="kc-group-type" class="tc-session-kind" hidden></p>
      <section class="glass kava-hero"><div class="kava-hero-top"><div class="kava-eyebrow">A place for proper talanoa</div><span class="kava-session-badge">${demo?'Layout preview · no live session':'Your Village · circle room'}</span></div>
      <h1 id="kc-heading"></h1><p id="kc-topic-text" class="kava-topic"></p><div class="kava-hero-values"><span>Listen generously</span><span>Make space for each other</span></div><div id="kc-host-actions" class="kava-actions"></div></section>
      <div class="kava-columns"><div class="stack"><section class="glass card kava-stage-card"><div class="kava-close"><h2 style="font-size:18px">Around the bowl</h2><span id="kc-capacity" class="pill"></span></div>
      <div id="kc-stage" class="kava-stage"></div><div class="kava-state"><span class="kava-status-dot" aria-hidden="true"></span><div><strong>Video & audio are not connected</strong><p>These seats show the layout. No camera or microphone is on.</p></div></div>
      <button class="btn sm ghost" type="button" disabled>Video awaiting setup</button><div id="kc-my-actions" class="kava-actions"></div></section>
      <section class="glass card kava-values-card"><h2 style="font-size:18px">The economy of respect</h2><p class="kava-notice">Knowledge, humour, music and good advice deserve support. Give in real money, in a named currency, directly to the person you choose.</p>
      <div class="kava-respect"><span>No virtual coins</span><span>No public spend rankings</span><span>No pressure to give</span></div><p class="kava-notice">A historian, an elder, an educator or a musician: make room for voices with something to share.</p></section>
      <section class="glass card" id="kc-moderation" hidden><h2 style="font-size:18px">Host desk</h2><p class="kava-notice">Offer a seat, return someone to the audience, or pause their comments.</p><div id="kc-people"></div></section></div>
      <div class="stack"><section class="glass card kava-conversation-card"><h2 style="font-size:18px">Audience conversation</h2><p id="kc-chat-status" class="sub"></p>
      <div class="kava-comments" id="kc-comments" aria-live="polite" aria-relevant="additions"></div>
      <form id="kc-comment-form" class="kava-comment-form"><label for="kc-comment" class="kava-label">Add to the talanoa</label><textarea id="kc-comment" maxlength="900" required placeholder="Ask a question or share something useful"></textarea><button class="btn sm" type="submit">Post comment</button></form>
      <p id="kava-error" class="kava-error" role="alert" hidden></p></section>
      <section class="glass card kava-support-card"><div class="kava-support-heading"><h2 style="font-size:18px">Support a speaker</h2><span>Optional</span></div><p class="kava-notice">Appreciate a voice that brings something to the circle.</p><details class="kava-support-details"><summary>Preview support options <span>Payments not active</span></summary>
      <label for="kc-recipient" class="kava-label">Recipient</label><select id="kc-recipient"></select>
      <label for="kc-currency" class="kava-label">Tip currency</label><select id="kc-currency">${core().currencies.map(c=>`<option>${c}</option>`).join('')}</select>
      <div id="kc-tip-amounts" class="kava-tips"></div><dl class="kava-money"><dt>Selected tip</dt><dd id="kc-tip-value"></dd><dt>Processing and payout fees</dt><dd>Quote unavailable</dd><dt>Recipient receives</dt><dd>Awaiting payout quote</dd></dl>
      <button class="btn sm" type="button" disabled>Payments awaiting setup</button><p class="kava-notice">Nothing is charged. Before you can send a tip, you will see the total cost, fees, any conversion, the recipient amount and payout timing.</p></details></section></div></div></div>`;
  }
  let amount=200;
  function updateTip(){
    const currency=q('#kc-currency').value;
    q('#kc-tip-amounts').innerHTML=core().amounts.map(a=>`<button class="btn sm ghost" type="button" data-tip="${a}" aria-pressed="${a===amount}">${e(core().money(a,currency))}</button>`).join('');
    q('#kc-tip-value').textContent=core().tipSelection(amount,currency).label;
    document.querySelectorAll('[data-tip]').forEach(b=>b.onclick=()=>{amount=Number(b.dataset.tip);updateTip();});
  }
  async function groupList(){return root.SotaCircles?root.SotaCircles.list():service.crews();}
  function applySessionSkin(group){
    const host=q('.kava-room'),banner=q('#kc-group-type');if(!host||!group||!root.SotaCircleTypes||!root.BulaSkins)return;
    const type=root.SotaCircleTypes.get(group.circle_type),settings=root.SotaCircleTypes.theme(type.id,root.BulaSkins);
    host.dataset.circleSkin=type.id;
    for(const [key,value] of Object.entries(root.BulaSkins.tokens(settings)))host.style.setProperty(key,value);
    const preset=root.BulaSkins.presets.find(p=>p.id===type.skin);
    if(banner){banner.hidden=false;banner.textContent=type.label+' · '+group.name+' · '+(preset?.name||'Shared group skin');}
    const invite=q('#kc-group-invite');if(invite)invite.onclick=()=>root.SotaCircles?.openInvite(group);
  }
  function updateGroupAppearance(group){
    if(!guest&&snapshot&&String(snapshot.circle.crew_id)===String(group.id))applySessionSkin(group);
  }
  async function open(id){
    stop();guest=false;current=id;const run=epoch;
    ctx.shell('<div class="glass card" role="status">Opening your circle…</div>');
    try{
      let [data,groups]=await Promise.all([service.load(id),groupList()]);if(run!==epoch)return;
      if(data.circle.status!=='ended'&&!data.people.some(p=>p.member===ctx.state.user.id)){
        await service.join(id,ctx.state.user.id);data=await service.load(id);if(run!==epoch)return;
      }
      snapshot=data;ctx.shell(frame(false));bind();paint();applySessionSkin(groups.find(g=>String(g.id)===String(data.circle.crew_id)));poll(run);
    }catch(err){if(run!==epoch)return;ctx.shell('<section class="glass card"><h2>This circle could not load.</h2><p id="kava-error" class="kava-error" role="alert"></p><button class="btn" id="kc-retry">Try again</button> <button class="btn ghost" id="kc-back">Your circles</button></section>');error(err);q('#kc-retry').onclick=()=>open(id);q('#kc-back').onclick=view;}
  }
  function bind(){
    q('#kc-back').onclick=()=>{stop();if(guest){guest=false;if(ctx.state.user)view();else root.renderAuth();}else view();};
    q('#kc-close').onclick=q('#kc-back').onclick;
    q('#kc-currency').onchange=updateTip;updateTip();
    q('#kc-comment-form').onsubmit=event=>{event.preventDefault();const input=q('#kc-comment');const body=input.value;
      action(event.submitter,async()=>{await service.comment(current,ctx.state.user.id,body);if(input.value===body)input.value='';await refresh(epoch);});};
  }
  function paint(){
    const {circle,people,comments,profiles}=snapshot,user=ctx.state.user?.id,isHost=!guest&&circle.host===user,mine=people.find(p=>p.member===user),ended=circle.status==='ended';
    const person=id=>profiles[id]||{display_name:guest?'Preview host':'Village member',avatar_emoji:'🌺'};
    q('#kc-heading').textContent=circle.title;q('#kc-topic-text').textContent=circle.topic;
    q('#kc-capacity').textContent=`${circle.capacity} speaker seats`;
    q('#kc-stage').innerHTML=core().seats(circle,people).map(({number,person:p})=>`<div class="kava-seat ${number===1?'host':''} ${p?'occupied':'available'}"><small>${number===1?'Host':'Seat '+number}</small><span class="kava-face" aria-hidden="true">${p?e(person(p.member).avatar_emoji):'+'}</span><b>${p?e(person(p.member).display_name):'Open seat'}</b><small>${p?'Video not connected':'Offered by the host'}</small>${p?`<button type="button" class="btn sm ghost" data-support="${e(p.member)}">${guest?'Preview support':'Support speaker'}</button>`:''}</div>`).join('');
    const selectedRecipient=q('#kc-recipient').value;
    q('#kc-recipient').innerHTML=people.filter(p=>p.seat).map(p=>`<option value="${e(p.member)}">${e(person(p.member).display_name)}${p.member===circle.host?' · Host':''}</option>`).join('');
    if([...q('#kc-recipient').options].some(o=>o.value===selectedRecipient))q('#kc-recipient').value=selectedRecipient;
    document.querySelectorAll('[data-support]').forEach(b=>b.onclick=()=>{q('#kc-recipient').value=b.dataset.support;q('.kava-support-details').open=true;q('#kc-recipient').focus();});
    q('#kc-host-actions').innerHTML=isHost&&!ended?`${circle.status==='planned'?'<button class="btn sm" id="kc-open-chat">Open comments</button>':''}<button class="btn sm ghost" id="kc-end">End circle</button>`:'';
    if(q('#kc-open-chat'))q('#kc-open-chat').onclick=event=>action(event.target,async()=>{await service.status(current,'open');await refresh(epoch);});
    if(q('#kc-end'))q('#kc-end').onclick=event=>{if(!root.confirm('End this circle? Its comments stay readable, but the conversation cannot reopen.'))return;action(event.target,async()=>{await service.status(current,'ended');await refresh(epoch);});};
    q('#kc-my-actions').innerHTML=guest?`<button class="btn sm" id="kc-signin">${ctx.state.user?'Back to my circles':'Sign in to start a circle'}</button>`:!ended&&mine&&!isHost&&!mine.seat&&!mine.comments_paused?`<button class="btn sm ghost" id="kc-request">${mine.requested?'Cancel seat request':'Request a speaker seat'}</button>`:'';
    if(q('#kc-signin'))q('#kc-signin').onclick=()=>{stop();guest=false;if(ctx.state.user)view();else root.renderAuth();};
    if(q('#kc-request'))q('#kc-request').onclick=event=>action(event.target,async()=>{await service.request(current,user,!mine.requested);await refresh(epoch);});
    q('#kc-chat-status').textContent=guest?'A preview of your circle. No one is live and no messages are being sent.':ended?'This circle has ended. Comments remain readable.':circle.status==='planned'?'The host has not opened comments yet.':mine?.comments_paused?'The host has paused your comments.':'Comments open · Updates every 7 seconds while this page is visible.';
    const enabled=!guest&&!ended&&circle.status==='open'&&mine&&!mine.comments_paused;
    q('#kc-comment').disabled=!enabled;q('#kc-comment-form button').disabled=!enabled;
    q('#kc-comment').placeholder=guest?'Comments are available in an open circle.':'Ask a question or share something useful';
    const markup=comments.length?comments.map(c=>`<article class="kava-comment"><small>${e(person(c.author).avatar_emoji)} ${e(person(c.author).display_name)}</small><p>${e(c.body)}</p>${!guest&&(isHost||c.author===user)?`<button class="btn sm ghost" type="button" data-remove="${e(c.id)}">Remove comment</button>`:''}</article>`).join(''):`<div class="kava-empty-conversation"><span aria-hidden="true">“</span><h3>The conversation starts here</h3><p>${guest?'A question. A story. A little wisdom. This is where your Village joins in.':'There are no comments yet. Make the first one thoughtful.'}</p></div>`;
    // Avoid rebuilding the live region when no comments have changed.
    if(q('#kc-comments').innerHTML!==markup)q('#kc-comments').innerHTML=markup;
    document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(!root.confirm('Remove this comment? This cannot be undone.'))return;action(b,async()=>{await service.removeComment(b.dataset.remove);await refresh(epoch);});});
    q('#kc-moderation').hidden=!isHost||ended;
    q('#kc-people').innerHTML=isHost&&!ended?people.filter(p=>p.member!==circle.host).map(p=>`<div class="kava-person"><b>${e(person(p.member).display_name)}${p.requested?' · Seat requested':''}</b>${p.seat?`<button class="btn sm ghost" data-demote="${e(p.member)}">Return to audience</button>`:p.requested&&!p.comments_paused?`<button class="btn sm ghost" data-offer="${e(p.member)}" ${core().nextSeat(circle,people)?'':'disabled'}>Offer seat</button>`:''}<button class="btn sm ghost" data-pause="${e(p.member)}">${p.comments_paused?'Resume comments':'Pause comments'}</button></div>`).join('')||'<p class="kava-notice">Your audience will appear here when they enter.</p>':'';
    document.querySelectorAll('[data-offer]').forEach(b=>b.onclick=()=>action(b,async()=>{const seat=core().nextSeat(snapshot.circle,snapshot.people);if(!seat)throw new Error('All speaker seats are filled.');await service.moderate(current,b.dataset.offer,{seat});await refresh(epoch);}));
    document.querySelectorAll('[data-demote]').forEach(b=>b.onclick=()=>action(b,async()=>{await service.moderate(current,b.dataset.demote,{seat:null});await refresh(epoch);}));
    document.querySelectorAll('[data-pause]').forEach(b=>b.onclick=()=>action(b,async()=>{const p=snapshot.people.find(p=>p.member===b.dataset.pause);await service.moderate(current,p.member,{comments_paused:!p.comments_paused,seat:null});await refresh(epoch);}));
  }
  async function refresh(run){
    const id=current;const [data,groups]=await Promise.all([service.load(id),groupList()]);if(run!==epoch||id!==current||ctx.state.tab!=='circles')return;
    snapshot=data;paint();applySessionSkin(groups.find(g=>String(g.id)===String(data.circle.crew_id)));const box=q('#kava-error');if(box)box.hidden=true;
  }
  function poll(run){
    timer=setTimeout(async()=>{if(run!==epoch||guest||ctx.state.tab!=='circles')return;
      try{if(!document.hidden&&!busy)await refresh(run);}catch(err){if(run===epoch)error(err);}finally{if(run===epoch)poll(run);}
    },7000);
  }
  function preview(){
    root.SotaView?.invalidate();
    stop();guest=true;current=null;amount=200;
    snapshot={circle:{title:'Stories that connect us',topic:'A space for an elder’s wisdom, a musician’s song, or a question that deserves a proper conversation.',capacity:6,host:'preview',status:'planned'},people:[{member:'preview',seat:1}],comments:[],profiles:{preview:{display_name:'Your host seat',avatar_emoji:'🌺'}}};
    const old=ctx.state.tab;ctx.state.tab='circles';ctx.shell(frame(true));ctx.state.tab=old;
    const legacyNav=q('nav.bottom'),wallet=q('.luvchip');if(legacyNav){legacyNav.hidden=true;legacyNav.style.setProperty('display','none','important');}if(wallet)wallet.style.display='none';bind();paint();
  }
  root.SotaKavaUI={init,view,stop,preview,updateGroupAppearance};
})(window);
