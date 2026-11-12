/* Dimau header v2 static menu controller. Canonical shared source; copy unchanged.
   No DOM insertion/reparenting, network, storage, auth or application state. */
(function () {
  'use strict';
  if (window.DimauHeaderStandard) return;
  var ROOT='[data-dimau-header]', TOGGLE='[data-dimau-menu-toggle]', PANEL='[data-dimau-menu-panel]';
  function staticRoot(node) {
    var root=node&&node.closest?node.closest(ROOT):null;
    return root&&!root.hasAttribute('data-dimau-native-menu')?root:null;
  }
  function visible(el) {return !el.disabled&&el.getAttribute('aria-disabled')!=='true'&&el.getClientRects().length>0;}
  function items(panel) {return Array.from(panel.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')).filter(function(el){return el.tabIndex>=0&&visible(el);});}
  function parts(root) {return {toggle:root.querySelector(TOGGLE),panel:root.querySelector(PANEL)};}
  function close(root,restore) {
    var p=parts(root);if(!p.toggle||!p.panel)return;
    root.removeAttribute('data-dimau-menu-open');p.panel.hidden=true;p.toggle.setAttribute('aria-expanded','false');
    if(restore)p.toggle.focus();
  }
  function open(root,last) {
    var p=parts(root);if(!p.toggle||!p.panel)return;
    p.panel.querySelectorAll('[data-dimau-proxy-target]').forEach(function(proxy){
      var selector=proxy.getAttribute('data-dimau-proxy-target'),target=null;
      try{target=selector?root.querySelector(selector):null;}catch(_){}
      proxy.hidden=!target;
    });
    document.querySelectorAll(ROOT+'[data-dimau-menu-open]').forEach(function(other){if(other!==root&&!other.hasAttribute('data-dimau-native-menu'))close(other,false);});
    root.setAttribute('data-dimau-menu-open','');p.panel.hidden=false;p.toggle.setAttribute('aria-expanded','true');
    var choices=items(p.panel);if(choices.length)choices[last?choices.length-1:0].focus();
  }
  document.addEventListener('click',function(e){
    var toggle=e.target.closest&&e.target.closest(TOGGLE),root=staticRoot(e.target);
    if(toggle&&root){e.preventDefault();root.hasAttribute('data-dimau-menu-open')?close(root,true):open(root,false);return;}
    if(!root)return;
    var panel=e.target.closest&&e.target.closest(PANEL);if(!panel)return;
    var proxy=e.target.closest('[data-dimau-proxy-target]');
    if(proxy){
      e.preventDefault();var selector=proxy.getAttribute('data-dimau-proxy-target'),target=null;
      try{target=selector?root.querySelector(selector):null;}catch(_){}
      close(root,false);if(target&&target!==proxy&&typeof target.click==='function'){var opener=parts(root).toggle;if(opener)opener.focus();target.click();}return;
    }
    var action=e.target.closest('a[href],button');if(action&&!action.hasAttribute('data-dimau-menu-keep-open'))close(root,true);
  },true);
  document.addEventListener('pointerdown',function(e){
    document.querySelectorAll(ROOT+'[data-dimau-menu-open]').forEach(function(root){if(root.hasAttribute('data-dimau-native-menu'))return;var p=parts(root);if(p.panel&&!p.panel.contains(e.target)&&p.toggle&&!p.toggle.contains(e.target))close(root,false);});
  },true);
  document.addEventListener('focusin',function(e){
    document.querySelectorAll(ROOT+'[data-dimau-menu-open]').forEach(function(root){
      if(root.hasAttribute('data-dimau-native-menu'))return;var p=parts(root);
      if(p.panel&&!p.panel.contains(e.target)&&e.target!==p.toggle)close(root,false);
    });
  });
  document.addEventListener('keydown',function(e){
    var root=staticRoot(e.target);if(!root)return;var p=parts(root);if(!p.toggle||!p.panel)return;
    var opened=root.hasAttribute('data-dimau-menu-open');
    if(e.key==='Escape'&&opened){e.preventDefault();e.stopPropagation();close(root,true);return;}
    if(e.target===p.toggle&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();open(root,e.key==='ArrowUp');return;}
    if(!opened||!p.panel.contains(e.target))return;
    var choices=items(p.panel),index=choices.indexOf(document.activeElement);if(!choices.length)return;
    if(['ArrowDown','ArrowUp','Home','End'].indexOf(e.key)>=0){
      e.preventDefault();var next=e.key==='Home'?0:e.key==='End'?choices.length-1:(index+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;choices[next].focus();
    }else if(e.key==='Tab'&&e.shiftKey&&index===0){e.preventDefault();close(root,true);}
    else if(e.key==='Tab'&&!e.shiftKey&&index===choices.length-1){
      e.preventDefault();close(root,false);
      var all=Array.from(document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')).filter(function(el){return el.tabIndex>=0&&visible(el);});
      var after=all.indexOf(p.toggle)+1;if(after>0&&all[after])all[after].focus();else p.toggle.focus();
    }
  },true);
  function closeAll(){document.querySelectorAll(ROOT+'[data-dimau-menu-open]').forEach(function(root){if(!root.hasAttribute('data-dimau-native-menu'))close(root,false);});}
  window.addEventListener('resize',closeAll);window.addEventListener('hashchange',closeAll);
  window.DimauHeaderStandard=Object.freeze({version:'2.0.2',close:function(root){if(root&&!root.hasAttribute('data-dimau-native-menu'))close(root,false);}});
})();
