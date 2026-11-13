(function(){
  function status(){
    let notice=document.querySelector('#sota-connection');
    if(!notice){notice=document.createElement('div');notice.id='sota-connection';notice.setAttribute('role','status');document.body.prepend(notice);}
    notice.hidden=navigator.onLine;
    notice.textContent='You are offline. Previously loaded designs may still be available. Reconnect to sign in, visit friends or send posts.';
  }
  // Connectivity changes must not replace an active view or discard an unsent draft.
  status();window.addEventListener('offline',status);window.addEventListener('online',status);
  if(!('serviceWorker' in navigator))return;
  const sw=navigator.serviceWorker,pageRelease=document.querySelector('meta[name="sota-release"]')?.content;
  const drafts=new Set(),originals=new WeakMap();let registration,lastCheck=Date.now();
  const draftField=el=>el?.matches?.('textarea,input:not([type]),input[type="text"],input[type="url"],input[type="email"],input[type="password"],input[type="tel"]')&&!el.readOnly&&!el.disabled&&!/search|filter|find|^s-q$/i.test(el.id||'');
  const remember=event=>{if(draftField(event.target)&&!originals.has(event.target))originals.set(event.target,event.target.value);};
  document.addEventListener('focusin',remember);document.addEventListener('beforeinput',remember);
  document.addEventListener('input',event=>{const el=event.target;if(!draftField(el))return;if(!originals.has(el))originals.set(el,el.defaultValue||'');if(el.value===originals.get(el))drafts.delete(el);else drafts.add(el);});
  function hasDraft(){
    for(const el of drafts){if(!el.isConnected)drafts.delete(el);else if(el.value!==originals.get(el))return true;}
    return !!document.querySelector('dialog[open]:not(.sk-playlist-inline):not(.sota-share-sheet)');
  }
  // A new release updates quietly: the page reloads only while it is out of sight (tab switched,
  // phone locked, app in the background) and never while a draft or editor is open. No pop-up.
  let pending='';
  function quietReload(){if(pending&&document.visibilityState==='hidden'&&!hasDraft()){pending='';window.location.reload();}}
  function offer(release){
    if(!/^sota-kece-shell-[a-z0-9._-]+$/i.test(release||'')||release===pageRelease)return;
    pending=release;quietReload();
  }
  document.addEventListener('visibilitychange',quietReload);
  function readRelease(){
    if(!sw.controller||typeof MessageChannel!=='function')return;
    const channel=new MessageChannel();const done=()=>{channel.port1.close();channel.port2.close();};
    const timer=setTimeout(done,5000);channel.port1.onmessage=event=>{clearTimeout(timer);done();if(event.data?.type==='SOTA_RELEASE')offer(event.data.release);};
    try{sw.controller.postMessage({type:'SOTA_RELEASE_REQUEST'},[channel.port2]);}catch(_){clearTimeout(timer);done();}
  }
  sw.addEventListener('message',event=>{if(event.source===sw.controller&&event.data?.type==='SOTA_RELEASE')offer(event.data.release);});
  sw.addEventListener('controllerchange',readRelease);
  function check(){if(!registration||!navigator.onLine||document.visibilityState==='hidden'||Date.now()-lastCheck<300000)return;lastCheck=Date.now();registration.update().catch(()=>{});}
  document.addEventListener('visibilitychange',check);window.addEventListener('online',check);window.addEventListener('focus',check);
  function start(){sw.register('/sw.js',{updateViaCache:'none'}).then(reg=>{registration=reg;readRelease();setInterval(check,300000);}).catch(()=>{});}
  if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});
})();
