/* One music area, two views, one existing playlist/audio owner. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaMusicHome=api;})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  let current=null;
  function stop(){
    const previous=current;current=null;
    if(previous){previous.listeners.forEach(remove=>remove());previous.listeners=[];}
    root.SotaPlaylist?.detachInline?.();
  }
  function mount(target){
    stop();const section=target?.querySelector('#sota-music-home');if(!section)return ()=>{};
    const tabs=[...section.querySelectorAll('[data-music-view]')],panels=[...section.querySelectorAll('[data-music-panel]')],host=section.querySelector('[data-music-playlist-host]');
    if(tabs.length!==2||panels.length!==2||!host)return ()=>{};
    const session={section,tabs,panels,host,listeners:[],view:'visualiser'};current=session;
    const valid=()=>current===session&&section.isConnected;
    const listen=(node,event,handler)=>{node.addEventListener(event,handler);session.listeners.push(()=>node.removeEventListener(event,handler));};
    function show(view,{focus=false,playlist=true}={}){
      if(!valid()||!['visualiser','playlist'].includes(view))return;
      session.view=view;section.dataset.activeMusicView=view;
      section.dispatchEvent(new root.CustomEvent('sota-music-home-prepare',{bubbles:true,detail:{view}}));
      for(const tab of tabs){const selected=tab.dataset.musicView===view;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;if(selected&&focus)tab.focus();}
      for(const panel of panels)panel.hidden=panel.dataset.musicPanel!==view;
      if(playlist){if(view==='playlist')root.SotaPlaylist?.showInline?.(host);else root.SotaPlaylist?.hideInline?.();}
      section.dispatchEvent(new root.CustomEvent('sota-music-home-change',{bubbles:true,detail:{view}}));
    }
    session.show=show;
    tabs.forEach(tab=>listen(tab,'click',()=>show(tab.dataset.musicView)));
    listen(section,'keydown',event=>{
      const tab=event.target.closest?.('[data-music-view]');if(!tab||!tabs.includes(tab))return;
      let index=tabs.indexOf(tab);if(event.key==='ArrowRight')index=(index+1)%tabs.length;else if(event.key==='ArrowLeft')index=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else return;
      event.preventDefault();show(tabs[index].dataset.musicView,{focus:true});
    });
    listen(host,'sota-playlist-inline-open',()=>show('playlist',{playlist:false}));
    listen(host,'sota-playlist-inline-close',()=>show('visualiser',{focus:true}));
    show('visualiser',{playlist:false});
    return ()=>{if(current===session)stop();};
  }
  function choose(view,options){current?.show(view,options);}
  return {mount,choose,stop};
});
