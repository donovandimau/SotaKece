/* Sota Kece — the Studio drawer.
 * One place to change how things look. It does not replace the two editors that already
 * exist (page design in space-design.js, room skins in skin-studio.js): it presents them as
 * one slide-out drawer with one set of tabs, and adds the page-lights switch beside them.
 * Whichever way an editor is opened, it arrives as the drawer. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaStudio=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const TABS=[['page','This page','Colours, type and backgrounds for the page you are on'],['skins','Room skins','Your room’s skin, or one you design yourself'],['lights','Lights','Lights that move with your music']];
  let getPage=()=>null,observer=null,lightsPanel=null,pending=null,started=false;
  const doc=()=>root.document;
  const pageEditor=()=>doc()?.getElementById('ssd-editor')||null;
  const skinEditor=()=>doc()?.querySelector('dialog.bv-studio')||null;
  function current(){
    if(lightsPanel?.open)return 'lights';
    if(pageEditor()?.open)return 'page';
    if(skinEditor()?.open)return 'skins';
    return null;
  }
  function dialogFor(section){return section==='page'?pageEditor():section==='skins'?skinEditor():section==='lights'?lightsPanel:null;}
  function tabs(section){
    const nav=doc().createElement('nav');nav.className='sd-tabs';nav.setAttribute('aria-label','Studio');
    const title=doc().createElement('strong');title.className='sd-title';title.textContent='Studio';nav.append(title);
    const row=doc().createElement('div');row.className='sd-tab-row';
    for(const [key,label,hint] of TABS){
      const b=doc().createElement('button');b.type='button';b.dataset.studioTab=key;b.textContent=label;b.title=hint;
      b.setAttribute('aria-current',key===section?'page':'false');row.append(b);
    }
    nav.append(row);
    nav.addEventListener('click',event=>{const tab=event.target.closest('[data-studio-tab]');if(tab){event.preventDefault();event.stopPropagation();open(tab.dataset.studioTab);}});
    return nav;
  }
  /** Turns an open editor into the drawer: docked right, with the shared tabs on top. */
  function dress(dialog,section){
    if(!dialog)return;
    dialog.classList.add('sd-drawer');dialog.dataset.studioSection=section;
    dialog.querySelector(':scope > .sd-tabs')?.remove();
    dialog.prepend(tabs(section));
  }
  function closeDialog(section){
    const dialog=dialogFor(section);if(!dialog?.open)return;
    if(section==='lights'){dialog.close();return;}
    // Use each editor's own way out, so its unsaved preview is put back exactly as Cancel would.
    const out=dialog.querySelector(section==='page'?'.ssd-close':'.bv-close');
    if(out)out.click();else dialog.dispatchEvent(new root.Event('cancel',{cancelable:true}));
    if(dialog.open)try{dialog.close();}catch(_){}
  }
  function lights(){
    if(lightsPanel?.isConnected)return lightsPanel;
    const d=doc().createElement('dialog');d.className='sd-lights sd-drawer';d.dataset.studioSection='lights';d.setAttribute('aria-labelledby','sd-lights-title');
    const body=doc().createElement('div');body.className='sd-lights-body';
    const head=doc().createElement('header');
    const h=doc().createElement('h2');h.id='sd-lights-title';h.textContent='Page lights';
    const close=doc().createElement('button');close.type='button';close.className='sd-close';close.setAttribute('aria-label','Close Studio');close.textContent='×';
    close.addEventListener('click',()=>d.close());head.append(h,close);
    const p=doc().createElement('p');p.textContent='A soft glow around the page that moves with the song that is playing. It follows you from page to page.';
    const toggle=doc().createElement('button');toggle.type='button';toggle.className='sd-lights-toggle';toggle.setAttribute('data-sota-lights-toggle','');toggle.setAttribute('aria-pressed','true');toggle.textContent='Page lights: On';
    const note=doc().createElement('p');note.className='sd-note';note.textContent='The lights only show while music is playing. Their colours follow the visual style you pick on the Music page.';
    const music=doc().createElement('button');music.type='button';music.className='sd-link';music.dataset.studioGo='music';music.textContent='Open Music ↗';
    body.append(head,p,toggle,note,music);d.append(body);
    d.addEventListener('click',event=>{if(event.target.closest('[data-studio-go]')){d.close();go?.('music');}});
    d.addEventListener('close',()=>{d.remove();if(lightsPanel===d)lightsPanel=null;});
    doc().body.append(d);lightsPanel=d;return d;
  }
  let go=null;
  function show(section,options={}){
    if(section==='lights'){const d=lights();dress(d,'lights');if(!d.open)d.showModal();root.SotaMusicBadge?.updateControls?.();return true;}
    if(section==='page'){
      if(!root.SotaSpaceDesign?.open)return false;
      const page=options.page||getPage()||undefined;
      root.SotaSpaceDesign.open(page==='room'?'profile':page);dress(pageEditor(),'page');return !!pageEditor()?.open;
    }
    if(section==='skins'){
      if(!root.BulaSkinStudio?.open)return false;
      root.BulaSkinStudio.open(options.initial||null,options.collection);dress(skinEditor(),'skins');return !!skinEditor()?.open;
    }
    return false;
  }
  /** Opens the drawer on a section, closing whichever section is showing first. */
  function open(section='page',options={}){
    if(!TABS.some(([key])=>key===section))section='page';
    const now=current();
    if(now===section){dress(dialogFor(section),section);return true;}
    if(now){
      pending={section,options};closeDialog(now);
      // The editors tidy up in their own close handlers; open the next one after they have run.
      root.setTimeout(()=>{const next=pending;pending=null;if(next&&!current())show(next.section,next.options);},0);
      return true;
    }
    return show(section,options);
  }
  function close(){pending=null;const now=current();if(now)closeDialog(now);}
  function watch(){
    // An editor opened by any other button (search, a hero, an old link) still arrives as the drawer.
    const now=current();if(!now||now==='lights')return;
    const dialog=dialogFor(now);if(dialog&&!dialog.querySelector(':scope > .sd-tabs'))dress(dialog,now);
  }
  function init(options={}){
    if(typeof options.getPage==='function')getPage=options.getPage;
    if(typeof options.go==='function')go=options.go;
    if(started||!doc()?.body||!root.MutationObserver)return;
    started=true;
    observer=new root.MutationObserver(watch);
    observer.observe(doc().body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  }
  function stop(){observer?.disconnect();observer=null;started=false;pending=null;lightsPanel?.close?.();}
  return {init,stop,open,close,current,TABS};
});
