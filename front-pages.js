/* Visual front gallery and detail pages. Existing views, players and drafts keep their DOM owners. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaFrontPages=api;})(typeof globalThis==='object'?globalThis:this,function(root){
  'use strict';
  const pages={home:{name:'Home'},music:{name:'Music',title:'Your music. Your way.',note:'Choose a song, switch the visuals or bring your own soundtrack.'},world:{name:'3D connections',title:'Your world, connected.',note:'Explore the live map. Add the people, pets and living things that belong in your world.'},connect:{name:'Connect',title:'Bring your people together.',note:'Create your account, invite your people or find someone you already know.'},talanoa:{name:'Talanoa',title:'Pull up a seat.',note:'A circle brings people together for conversation. Explore the Talanoa Circle, then create or join your own with an invitation.'},skins:{name:'Skins',title:'A space that feels like you.',note:'Explore your school, vanua, music and memories. Choose a collection to preview and personalise your room.'},profile:{name:'Your space',title:'Make this space your own.',note:'Choose Edit photos to add your profile photo and banner. Make this example space your own.'}};
  const aliases={'bv-music':'music','sota-music-home':'music','sota-connections':'world','bv-circle':'talanoa','bv-your-room':'skins'};
  let current=null;
  function fromHash(hash){const value=String(hash||'').replace(/^#/,'');return !value?'home':Object.prototype.hasOwnProperty.call(pages,value)?value:aliases[value]||null;}
  function stop(){
    const session=current;current=null;if(!session)return;
    session.listeners.forEach(remove=>remove());
    session.hidden.forEach((value,node)=>{node.hidden=value;});
    session.inert.forEach((value,node)=>{if(value===null)node.removeAttribute('inert');else node.setAttribute('inert',value);});
    session.wrappers.forEach(({wrapper,node})=>{if(wrapper.parentNode)wrapper.replaceWith(node);});
    session.added.forEach(node=>node.remove());
    if(session.oldScrollRestoration!==undefined)root.history.scrollRestoration=session.oldScrollRestoration;
    if(session.oldPage===undefined)delete session.app.dataset.frontPage;else session.app.dataset.frontPage=session.oldPage;
  }
  function mount(app){
    stop();if(!app)return ()=>{};
    const header=app.querySelector('.sk-site-header');if(!header)return ()=>{};
    const session={app,oldPage:app.dataset.frontPage,oldScrollRestoration:root.history.scrollRestoration,listeners:[],added:[],wrappers:[],hidden:new Map(),inert:new Map(),blocks:[],view:'home'};current=session;
    if(session.oldScrollRestoration!==undefined)root.history.scrollRestoration='manual';
    const valid=()=>current===session&&app.isConnected&&navigation.isConnected;
    const listen=(node,event,fn,capture=false)=>{node.addEventListener(event,fn,capture);session.listeners.push(()=>node.removeEventListener(event,fn,capture));};
    const created=(tag,className,role)=>{const node=root.document.createElement(tag);node.className=className;node.dataset.frontPages=role;session.added.push(node);return node;};
    function block(selector,views){app.querySelectorAll(selector).forEach(node=>{if(!session.hidden.has(node))session.hidden.set(node,node.hidden);session.blocks.push({node,views});});}
    block('.sk-original-front',['home','music','profile']);block('.sk-hero-artwork',['home','profile']);block('#sota-music-home',['home','music']);
    block('.bv-connect-header',['connect']);block('.bv-home-section-nav',[]);block('#sota-connections',['home','world']);block('#bv-circle',['home','talanoa']);block('#bv-your-room',['home','skins']);block('.bv-classic-footer',['home']);
    const navigation=created('nav','sfp-navigation','navigation');navigation.setAttribute('aria-label','Sota Kece pages');
    for(const view of ['home','music','world','connect']){const anchor=root.document.createElement('a');anchor.href='#'+view;anchor.dataset.frontView=view;anchor.textContent=view==='world'?'3D':pages[view].name;navigation.append(anchor);}
    header.after(navigation);
    const detail=created('section','sfp-detail-heading','heading'),back=root.document.createElement('a'),heading=root.document.createElement('h1'),note=root.document.createElement('p'),close=root.document.createElement('a');
    back.href='#home';back.className='sfp-back';back.dataset.frontPages='back';back.dataset.frontView='home';back.textContent='← Back to home';
    close.href='#home';close.className='sfp-page-close';close.dataset.frontPages='close';close.dataset.frontView='home';close.textContent='×';
    heading.tabIndex=-1;detail.append(back,heading,note);navigation.append(close);navigation.after(detail);
    function visual(container,view,label){
      if(!container)return;
      const anchor=created('a','sfp-visual-link','visual-link');anchor.href='#'+view;anchor.dataset.frontView=view;anchor.setAttribute('aria-label',label);
      const caption=root.document.createElement('span');caption.className='sfp-visual-symbol sota-glass-mark';caption.dataset.sotaMark=view;caption.setAttribute('aria-hidden','true');anchor.title=label;
      const paths={profile:'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-2a8 8 0 0 1 16 0v2',music:'M9 17V5l11-2v12M9 8l11-2M9 17c0 2-2 3-4 3s-3-1-3-2.5S4 15 6 15c1 0 2 .5 3 1M20 15c0 2-2 3-4 3s-3-1-3-2.5 2-2.5 4-2.5c1 0 2 .5 3 1',world:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',talanoa:'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5ZM7 10h10M7 14h6',skins:'M20 13a8 8 0 1 0-9 8h2a2 2 0 0 0 1-4 2 2 0 0 1 2-3h2a2 2 0 0 0 2-1ZM7 9h.01M10 6h.01M15 7h.01M6 13h.01'};
      const svg=root.document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','26');svg.setAttribute('height','26');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('focusable','false');const path=root.document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',paths[view]||paths.world);svg.append(path);caption.append(svg);anchor.append(caption);container.append(anchor);
    }
    visual(app.querySelector('.sk-hero-artwork'),'profile','Open your space');
    visual(app.querySelector('#sota-music-home .bv-music-feature'),'music','Open music');
    visual(app.querySelector('#sota-music-home .sk-music-stage-picture'),'music','Open the music visualiser');
    visual(app.querySelector('#sota-connections [data-lg3d-stage], #sota-connections .lg3d-stage'),'world','Open 3D connections');
    visual(app.querySelector('#bv-circle .bv-circle-art')||app.querySelector('#bv-circle .bv-circle-feature'),'talanoa','Open Talanoa');
    // Skin collection buttons already have meaningful labels and category
    // callbacks. Keep those original actions instead of covering each with a
    // second, unlabelled shortcut to the same Skins page.
    for(const node of [...app.querySelectorAll('#sota-connections .lg3d-labels, .sk-hero-artwork .sota-social-hero')])session.inert.set(node,node.getAttribute('inert'));
    function scrollTop(){
      // Reset the document itself, not merely the navigation's position. Temporarily
      // remove smooth scrolling so returning Home is immediate even after a long page.
      const elements=[root.document.documentElement,root.document.body,root.document.scrollingElement].filter((node,index,list)=>node&&list.indexOf(node)===index);
      const styles=elements.map(node=>[node,node.style.getPropertyValue('scroll-behavior'),node.style.getPropertyPriority('scroll-behavior')]);
      elements.forEach(node=>{node.style.setProperty('scroll-behavior','auto','important');node.scrollTop=0;node.scrollLeft=0;});
      try{root.scrollTo?.({top:0,left:0,behavior:'instant'});}finally{styles.forEach(([node,value,priority])=>{if(value)node.style.setProperty('scroll-behavior',value,priority);else node.style.removeProperty('scroll-behavior');});}
    }
    function show(view,{focus=false,scroll=false}={}){
      if(!valid()||!Object.prototype.hasOwnProperty.call(pages,view))return false;
      session.view=view;app.dataset.frontPage=view;
      session.blocks.forEach(({node,views})=>{node.hidden=!views.includes(view)||session.hidden.get(node);});
      session.inert.forEach((original,node)=>{if(view==='home')node.setAttribute('inert','');else if(original===null)node.removeAttribute('inert');else node.setAttribute('inert',original);});
      detail.hidden=view==='home';heading.textContent=pages[view].title||'';note.textContent=pages[view].note||'';
      close.hidden=view==='home';close.setAttribute('aria-label','Close '+pages[view].name+' and return to home');close.title='Close '+pages[view].name;
      navigation.querySelectorAll('[data-front-view]').forEach(anchor=>{if(anchor.dataset.frontView===view)anchor.setAttribute('aria-current','page');else anchor.removeAttribute('aria-current');});
      if(focus)(view==='home'?navigation.querySelector('[data-front-view="home"]'):heading).focus({preventScroll:true});
      if(scroll)scrollTop();
      // Canvas owners measure their original elements again after page visibility changes.
      root.dispatchEvent(new root.Event('resize'));
      app.dispatchEvent(new root.CustomEvent('sota-front-page-change',{bubbles:true,detail:{view}}));return true;
    }
    session.navigate=(view,options={})=>{
      if(!valid()||!Object.prototype.hasOwnProperty.call(pages,view))return false;
      if(root.location.hash!=='#'+view)root.history.pushState(null,'',root.location.pathname+root.location.search+'#'+view);
      return show(view,{focus:options.focus!==false,scroll:true});
    };
    listen(app,'click',event=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=event.target.closest?.('a[href]');if(!anchor||!app.contains(anchor)||anchor.target&&anchor.target!=='_self'||anchor.hasAttribute('download'))return;
      let url;try{url=new root.URL(anchor.href,root.location.href);}catch(_){return;}
      if(url.origin!==root.location.origin||url.pathname!==root.location.pathname||url.search!==root.location.search)return;
      const view=fromHash(url.hash);if(!view)return;
      event.preventDefault();session.navigate(view);
    });
    listen(root,'hashchange',()=>{const view=fromHash(root.location.hash);if(view)show(view,{scroll:true});});
    listen(root,'sota-playlist-inline-open',event=>{if(valid()&&app.contains(event.target))session.navigate('music',{focus:false});},true);
    show(fromHash(root.location.hash)||'home');
    return ()=>{if(current===session)stop();};
  }
  function open(view){return current?.navigate(view)||false;}
  return {mount,open,stop};
});
