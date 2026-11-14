/* Sota Kece — who is around, and a quick way into your Koro.
 * Presence uses what friends can already see of each other (the "last seen" time on the
 * friends list); nothing new is stored or shared. A member counts as online for ten minutes
 * after the app last checked in, because the check-in is saved at most once every five. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaLive=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const ONLINE=10*60*1000,RECENT=60*60*1000,BEAT=5*60*1000,MAX_KORO=5,FOLD='sota.koro-switch.folded';
  let client=null,S=null,openKoro=null,goTo=null,app=null,timer=0,observer=null,queued=false,koro=null,koroFor=null,loading=null,stopVisible=null;

  function status(lastSeen,now){
    const t=Date.parse(lastSeen||''),age=(now??Date.now())-t;
    if(!Number.isFinite(t)||age<-ONLINE)return null;
    if(age<=ONLINE)return 'online';
    if(age<=RECENT)return 'recent';
    return null;
  }
  function words(state,lastSeen,now){
    if(state==='online')return 'Online now';
    if(state!=='recent')return '';
    const mins=Math.max(1,Math.round(((now??Date.now())-Date.parse(lastSeen))/60000));
    return 'Active '+mins+' min ago';
  }
  function byHandle(friends,now){
    const map=new Map();
    for(const f of Array.isArray(friends)?friends:[]){
      const state=f&&typeof f.handle==='string'?status(f.last_seen,now):null;
      if(state)map.set(f.handle.toLowerCase(),{state,label:words(state,f.last_seen,now)});
    }
    return map;
  }
  /** Rings every friend's avatar on the page that carries their handle. Safe to call again. */
  function mark(scope,friends,now){
    const doc=scope?.ownerDocument||scope;if(!scope?.querySelectorAll)return 0;
    const map=byHandle(friends,now);let count=0;
    scope.querySelectorAll('[data-handle]').forEach(node=>{
      if(!node.matches('.av,.tw-av,.sota-social-avatar,[data-live-avatar]'))return;
      const hit=map.get(String(node.dataset.handle||'').toLowerCase()),was=node.dataset.live||'';
      if((hit?.state||'')===was&&(hit?.label||'')===(node.dataset.liveLabel||''))return void(hit&&count++);
      node.classList.remove('sl-online','sl-recent');
      if(!hit){delete node.dataset.live;delete node.dataset.liveLabel;if(node.dataset.liveTitle){node.removeAttribute('title');delete node.dataset.liveTitle;}return;}
      node.classList.add('sl-'+hit.state);node.dataset.live=hit.state;node.dataset.liveLabel=hit.label;
      if(!node.title||node.dataset.liveTitle){node.title=hit.label;node.dataset.liveTitle='1';}
      count++;
    });
    scope.querySelectorAll('[data-live-text]').forEach(node=>{
      const hit=map.get(String(node.dataset.liveText||'').toLowerCase());
      if(node.dataset.liveOriginal===undefined)node.dataset.liveOriginal=node.textContent;
      const next=hit?.state==='online'?'Online':node.dataset.liveOriginal;
      if(node.textContent!==next)node.textContent=next;
      node.classList.toggle('sl-online-text',hit?.state==='online');
    });
    void doc;return count;
  }

  /* ------------------------------------------------------------ Koro quick-switch */
  function folded(){try{return root.localStorage.getItem(FOLD)==='1';}catch{return false;}}
  function koroList(rows){
    return (Array.isArray(rows)?rows:[]).filter(c=>c&&Number.isSafeInteger(Number(c.id))&&typeof c.name==='string'&&c.name.trim()).slice(0,50);
  }
  function drawKoro(){
    const doc=root.document,rail=app?.querySelector('.sx-rail'),nav=rail?.querySelector('.sx-nav');
    if(!rail||!nav||!S?.user?.id)return;
    let box=rail.querySelector('.sl-koro');
    const list=koroList(koro);
    if(!list.length){box?.remove();return;}
    const key=list.map(c=>c.id+':'+c.name+':'+(c.emoji||'')).join('|')+'#'+(S.tab==='crews'?S.crew||'':'');
    if(box&&box.dataset.key===key)return;
    if(!box){
      box=doc.createElement('details');box.className='sl-koro';box.open=!folded();
      box.addEventListener('toggle',()=>{try{root.localStorage.setItem(FOLD,box.open?'0':'1');}catch{}});
      box.addEventListener('click',event=>{
        const pick=event.target.closest('[data-live-koro]');if(!pick)return;
        event.preventDefault();event.stopPropagation();
        const id=pick.dataset.liveKoro;
        if(id==='all')goTo?.('crews');else openKoro?.(Number(id));
      });
      const people=nav.querySelector('[data-dps-tab="people"]');
      if(people&&people.parentNode===nav)people.after(box);else nav.after(box);
    }
    box.dataset.key=key;box.textContent='';
    const summary=doc.createElement('summary');summary.textContent='Your Koro';
    const count=doc.createElement('b');count.textContent=String(list.length);summary.append(count);box.append(summary);
    const items=doc.createElement('div');items.className='sl-koro-list';items.setAttribute('role','group');items.setAttribute('aria-label','Your Koro');
    for(const c of list.slice(0,MAX_KORO)){
      const b=doc.createElement('button');b.type='button';b.dataset.liveKoro=String(c.id);
      const here=S.tab==='crews'&&Number(S.crew)===Number(c.id);b.setAttribute('aria-current',here?'page':'false');
      const mark=doc.createElement('span');mark.className='sl-koro-mark';mark.setAttribute('aria-hidden','true');mark.textContent=c.emoji||'🌴';
      const name=doc.createElement('span');name.className='sl-koro-name';name.textContent=c.name.trim();
      b.append(mark,name);b.setAttribute('aria-label','Open '+c.name.trim()+' Koro');items.append(b);
    }
    const all=doc.createElement('button');all.type='button';all.className='sl-koro-all';all.dataset.liveKoro='all';
    all.textContent=list.length>MAX_KORO?'All '+list.length+' Koro ↗':'All Koro ↗';items.append(all);
    box.append(items);
  }
  async function loadKoro(force){
    const owner=S?.user?.id;if(!owner||!client)return;
    if(!force&&koroFor===owner&&koro)return;
    if(loading)return loading;
    loading=(async()=>{
      try{const r=await client.rpc('bv_my_crews');if(S?.user?.id!==owner)return;if(!r.error){koro=r.data||[];koroFor=owner;drawKoro();}}
      catch{}finally{loading=null;}
    })();
    return loading;
  }

  /* ------------------------------------------------------------ keeping it current */
  function paint(){
    queued=false;if(!app||!S)return;
    if(!S.user?.id){koro=null;koroFor=null;app.querySelector('.sl-koro')?.remove();return;}
    mark(app,S.friends);drawKoro();
    if(koroFor!==S.user.id)loadKoro();
  }
  function schedule(){if(queued)return;queued=true;(root.requestAnimationFrame||root.setTimeout)(paint,0);}
  async function beat(){
    if(!client||!S?.user?.id||root.document?.hidden)return;
    const owner=S.user.id;
    try{
      client.rpc('bv_touch');
      const r=await client.rpc('bv_my_friends');
      if(S.user?.id===owner&&!r.error&&Array.isArray(r.data)){S.friends=r.data;schedule();}
      loadKoro(true);
    }catch{}
  }
  function stop(){
    if(timer)root.clearInterval(timer);timer=0;observer?.disconnect();observer=null;stopVisible?.();stopVisible=null;
    koro=null;koroFor=null;loading=null;queued=false;app?.querySelector?.('.sl-koro')?.remove();
  }
  function init(options){
    stop();
    client=options.client;S=options.state;openKoro=options.openKoro||null;goTo=options.go||null;app=options.app;
    if(!app||!root.document)return;
    if(root.MutationObserver){observer=new root.MutationObserver(schedule);observer.observe(app,{childList:true,subtree:true});}
    timer=root.setInterval(beat,BEAT);
    const seen=()=>{if(!root.document.hidden)beat();};
    root.document.addEventListener('visibilitychange',seen);stopVisible=()=>root.document.removeEventListener('visibilitychange',seen);
    schedule();
  }
  return {init,stop,status,words,byHandle,mark,refresh:schedule,reloadKoro:()=>loadKoro(true),ONLINE,RECENT};
});
