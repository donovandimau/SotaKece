/* Sota Kece — the Studio: one editor for how things look.
 *
 * One drawer, three tabs (This page, Room skins, Lights), one Save and one Cancel.
 * The page-design tools (space-design.js) and the room-skin tools (skin-studio.js) keep their own
 * models and their own saving, but they no longer open as separate windows: the Studio hosts both
 * inside itself, side by side, so moving between tabs keeps everything you have changed, and one
 * Save keeps all of it.
 *
 * How the hosting works: both tools open themselves with dialog.showModal(). While the Studio is
 * running, that call is caught for those two elements only; the element is moved into the Studio's
 * panel and shown in place instead. Whichever button asked for a tool, it arrives in the Studio. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaStudio=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const TABS=[['page','This page','Colours, type and backgrounds for the page you are on'],['skins','Room skins','Your room’s skin, or one you design yourself'],['lights','Lights','Lights that move with your music']];
  // Controls that only change what is being looked at. (Matched on the control itself: the skin tool's own
  // element carries data-editor-mode, so an unqualified selector would match everything inside it.)
  const QUIET='button[data-preview-mode],button[data-editor-mode],button[data-ssd-mode],select[data-ssd-page],.bv-preview-back,#bv-view-preview,.bv-skin-categories button,#bv-skin-search,button[data-studio-tab]';
  let getPage=()=>null,go=null,rerender=null,isOwnRoom=()=>false,started=false,nativeShowModal=null;
  let drawer=null,active=null,saving=false,liveTouched=false,ensuring=false;
  const hosted={page:null,skins:null},dirty={page:false,skins:false};
  const doc=()=>root.document;
  const el=(tag,cls,text)=>{const n=doc().createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  function sectionOf(node){return node?.id==='ssd-editor'?'page':node?.classList?.contains('bv-studio')?'skins':null;}
  function panel(section){return drawer?.querySelector('[data-studio-panel="'+section+'"]')||null;}
  function anyDirty(){return dirty.page||dirty.skins;}
  function current(){return drawer?.open?active:null;}

  /* ---------------------------------------------------------------- the drawer */
  function build(){
    if(drawer?.isConnected)return drawer;
    const d=el('dialog','sd-studio');d.setAttribute('aria-labelledby','sd-studio-title');
    const nav=el('nav','sd-tabs');nav.setAttribute('aria-label','Studio sections');
    const title=el('strong','sd-title','Studio');title.id='sd-studio-title';
    const row=el('div','sd-tab-row');row.setAttribute('role','tablist');
    for(const [key,label,hint] of TABS){const b=el('button',null,label);b.type='button';b.dataset.studioTab=key;b.title=hint;b.setAttribute('role','tab');b.id='sd-tab-'+key;b.setAttribute('aria-controls','sd-panel-'+key);row.append(b);}
    const x=el('button','sd-close','×');x.type='button';x.setAttribute('aria-label','Close Studio');x.dataset.studioAct='close';
    nav.append(title,row,x);
    const panels=el('div','sd-panels');
    for(const [key] of TABS){const s=el('section','sd-panel');s.dataset.studioPanel=key;s.id='sd-panel-'+key;s.setAttribute('role','tabpanel');s.setAttribute('aria-labelledby','sd-tab-'+key);s.hidden=true;panels.append(s);}
    const foot=el('footer','sd-foot'),status=el('p','sd-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const cancel=el('button','sd-cancel','Cancel');cancel.type='button';cancel.dataset.studioAct='cancel';
    const save=el('button','sd-save','Save changes');save.type='button';save.dataset.studioAct='save';
    foot.append(status,cancel,save);
    d.append(nav,panels,foot);
    d.addEventListener('click',event=>{
      const tab=event.target.closest('[data-studio-tab]');if(tab&&nav.contains(tab)){show(tab.dataset.studioTab);return;}
      const act=event.target.closest('[data-studio-act]')?.dataset.studioAct;
      if(act==='save')saveAll();else if(act==='cancel')cancelAll();else if(act==='close')leave();
      else if(event.target.closest('[data-studio-go]')){const to=event.target.closest('[data-studio-go]').dataset.studioGo;if(leave())go?.(to);}
    });
    d.addEventListener('cancel',event=>{event.preventDefault();leave();});
    // A hosted tool may handle Escape itself and stop the browser's own dialog cancel, so Escape is also read here.
    d.addEventListener('keydown',event=>{if(event.key!=='Escape'||event.defaultPrevented&&!event.target.closest('.sd-hosted'))return;if(event.target.closest('select,[aria-expanded="true"]'))return;event.preventDefault();event.stopPropagation();leave();},true);
    d.addEventListener('close',teardown);
    for(const kind of ['input','change','click'])d.addEventListener(kind,event=>touch(event,kind),true);
    lightsPanel(d.querySelector('[data-studio-panel="lights"]'));
    doc().body.append(d);drawer=d;return d;
  }
  function lightsPanel(host){
    const body=el('div','sd-lights-body');
    const h=el('h2',null,'Page lights');
    const p=el('p',null,'A soft glow around the page that moves with the song that is playing. It follows you from page to page.');
    const toggle=el('button','sd-lights-toggle','Page lights: On');toggle.type='button';toggle.setAttribute('data-sota-lights-toggle','');toggle.setAttribute('aria-pressed','true');
    const note=el('p','sd-note','The lights only show while music is playing. Their colours follow the visual style you pick on the Music page. This switch is kept as soon as you press it.');
    const music=el('button','sd-link','Open Music ↗');music.type='button';music.dataset.studioGo='music';
    body.append(h,p,toggle,note,music);host.append(body);
  }
  function say(text){const s=drawer?.querySelector('.sd-status');if(s)s.textContent=text||'';}
  function paint(){
    if(!drawer)return;
    drawer.dataset.studioSection=active||'';
    drawer.classList.toggle('sd-live',active==='skins'&&isOwnRoom());
    drawer.classList.toggle('sd-wide',active==='skins'&&!isOwnRoom());
    for(const [key] of TABS){
      const tab=drawer.querySelector('[data-studio-tab="'+key+'"]'),selected=key===active;
      tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;tab.classList.toggle('sd-changed',!!dirty[key]);
      panel(key).hidden=!selected;
    }
    const save=drawer.querySelector('.sd-save'),cancel=drawer.querySelector('.sd-cancel');
    save.disabled=saving;cancel.disabled=saving;
    save.textContent=saving?'Saving…':anyDirty()?'Save changes':'Done';
    cancel.hidden=!anyDirty();
    if(!saving)say(anyDirty()?(dirty.page&&dirty.skins?'Changes on This page and Room skins are waiting to be saved.':dirty.page?'Changes to this page are waiting to be saved.':'Changes to your room are waiting to be saved.'):'');
    root.SotaMusicBadge?.updateControls?.();
  }
  /** Any real edit inside a hosted tool marks that tab as changed. Browsing controls do not. */
  function touch(event,kind){
    if(saving)return;
    const section=['page','skins'].find(key=>hosted[key]?.contains(event.target));if(!section)return;
    const t=event.target;
    if(t.closest(QUIET))return;
    if(kind==='click'&&!t.closest('button,[role=button],label,input[type=checkbox],input[type=radio]'))return;
    if(!dirty[section]){dirty[section]=true;paint();}
  }

  /* ---------------------------------------------------------------- hosting the two tools */
  function host(node){
    const section=sectionOf(node);if(!section)return false;
    build();
    if(!drawer.open)nativeShowModal.call(drawer);
    hosted[section]=node;dirty[section]=false;
    panel(section).append(node);
    node.classList.add('sd-hosted');
    if(typeof node.show==='function')node.show();else node.setAttribute('open','');
    if(!node.dataset.studioWatched){
      node.dataset.studioWatched='1';
      node.addEventListener('close',()=>released(section,node));
    }
    return true;
  }
  /** A hosted tool closed itself: after its own save, or because the member changed. */
  function released(section,node){
    if(hosted[section]!==node)return;
    hosted[section]=null;dirty[section]=false;node.classList.remove('sd-hosted');
    // The page tool is one long-lived element: give it back to the page so the next open finds it.
    if(section==='page'&&doc()?.body)doc().body.append(node);
    if(saving||!drawer?.open)return;
    if(active===section){const other=section==='page'?'skins':'page';if(hosted[other])show(other);else closeDrawer();}
    else paint();
  }
  function patchShowModal(){
    const proto=root.HTMLDialogElement?.prototype;if(!proto||nativeShowModal)return;
    nativeShowModal=proto.showModal||function(){this.setAttribute('open','');};
    proto.showModal=function(){
      if(started&&sectionOf(this)){host(this);if(!ensuring)active=sectionOf(this);paint();return;}
      return nativeShowModal.call(this);
    };
  }
  function ensure(section,options={}){
    ensuring=true;try{return wake(section,options);}finally{ensuring=false;}
  }
  function wake(section,options){
    if(section==='page'){
      if(hosted.page?.open)return true;
      if(!root.SotaSpaceDesign?.open)return false;
      const page=options.page||getPage()||undefined;
      root.SotaSpaceDesign.open(page==='room'?'profile':page);return !!hosted.page;
    }
    if(section==='skins'){
      if(hosted.skins?.open)return true;
      if(!root.BulaSkinStudio?.open)return false;
      root.BulaSkinStudio.open(options.initial||null,options.collection);return !!hosted.skins;
    }
    return section==='lights';
  }
  function show(section,options={}){
    if(!TABS.some(([key])=>key===section))section='page';
    build();
    if(!drawer.open)nativeShowModal.call(drawer);
    if(!ensure(section,options)&&section!=='lights'){
      // The tool for this tab is not on this page: fall back to whichever is, or to Lights.
      section=hosted.page?'page':hosted.skins?'skins':'lights';
    }
    active=section;paint();
    const tab=drawer.querySelector('[data-studio-tab="'+section+'"]');
    if(!drawer.contains(doc().activeElement))tab?.focus({preventScroll:true});
    return true;
  }
  function open(section='page',options={}){return show(section,options);}

  /* ---------------------------------------------------------------- one Save, one Cancel */
  function settled(node){
    // Each tool closes itself when its save worked, and stays open (no longer busy) when it did not.
    return new Promise(resolve=>{
      const began=Date.now();
      (function check(){
        if(!node.open||!node.isConnected)return resolve(true);
        const waited=Date.now()-began;
        if(waited>150&&!node.hasAttribute('aria-busy'))return resolve(false);
        if(waited>30000)return resolve(false);
        root.setTimeout(check,40);
      })();
    });
  }
  function cancelTool(section){
    const node=hosted[section];if(!node?.open)return;
    const out=node.querySelector(section==='page'?'.ssd-cancel,.ssd-close':'#bv-cancel,.bv-close');
    if(out)out.click();
    if(node.open)try{node.close();}catch(_){}
  }
  async function saveAll(){
    if(saving||!drawer?.open)return false;
    if(!anyDirty()){cancelAll(true);return true;}
    saving=true;paint();say('Saving…');
    let failed=null;
    // This page first (it is kept on this device and cannot fail on the network), then the room.
    for(const section of ['page','skins']){
      const node=hosted[section];if(!node?.open)continue;
      if(!dirty[section]){continue;}
      const button=node.querySelector(section==='page'?'.ssd-save':'#bv-save');
      if(!button){failed=section;break;}
      button.disabled=false;button.click();
      if(!(await settled(node))){failed=section;break;}
      dirty[section]=false;if(section==='skins')liveTouched=false;
    }
    saving=false;
    if(failed){
      active=failed;paint();
      say(failed==='page'?'This page could not be saved. See the note above; your changes are still here.':'Your room could not be saved. See the note above; your changes are still here.');
      return false;
    }
    cancelAll(true);return true;
  }
  /** Puts back anything not saved and closes. `quiet` skips nothing here; it marks an expected close. */
  function cancelAll(quiet){
    if(saving)return;
    const restore=liveTouched&&dirty.skins&&!quiet;
    for(const section of ['page','skins']){dirty[section]=false;cancelTool(section);}
    liveTouched=false;
    closeDrawer();
    if(restore)rerender?.();
  }
  /** The × and Escape: ask before dropping changes. */
  function leave(){
    if(saving)return false;
    if(anyDirty()&&typeof root.confirm==='function'&&!root.confirm('Leave Studio without saving your changes?'))return false;
    cancelAll();return true;
  }
  function closeDrawer(){if(drawer?.open)drawer.close();else teardown();}
  function teardown(){
    const d=drawer;if(!d)return;
    drawer=null;active=null;saving=false;
    // A tool still open here was not closed through its own Cancel (for example the page was torn down): close it now.
    for(const section of ['page','skins']){const node=hosted[section];if(node){hosted[section]=null;dirty[section]=false;node.classList.remove('sd-hosted');if(node.open)try{node.close();}catch(_){}if(section==='page'&&node.isConnected)doc().body.append(node);}}
    d.remove();
  }
  function close(){cancelAll();}

  /* ---------------------------------------------------------------- skins on the real room */
  function draft(event){
    if(!drawer?.open||!hosted.skins||!isOwnRoom())return;
    const settings=event.detail?.settings;if(!settings||!root.BulaSkinStudio?.previewLive)return;
    try{if(root.BulaSkinStudio.previewLive(settings))liveTouched=true;}catch(_){}
  }

  function init(options={}){
    if(typeof options.getPage==='function')getPage=options.getPage;
    if(typeof options.go==='function')go=options.go;
    if(typeof options.rerender==='function')rerender=options.rerender;
    if(typeof options.isOwnRoom==='function')isOwnRoom=options.isOwnRoom;
    if(started||!doc()?.body)return;
    started=true;patchShowModal();
    doc().addEventListener('sota-skin-draft',draft);
  }
  function stop(){
    if(!started)return;
    cancelAll();started=false;doc()?.removeEventListener('sota-skin-draft',draft);
    const proto=root.HTMLDialogElement?.prototype;if(proto&&nativeShowModal){proto.showModal=nativeShowModal;nativeShowModal=null;}
  }
  return {init,stop,open,close,save:saveAll,current,isDirty:anyDirty,TABS};
});
