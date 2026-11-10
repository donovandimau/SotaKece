/* 30 Oct 2026: the Bula welcome button sits in the top bar, phone and desktop (beside Sign in / the menu) */
(function(){
  var HOLD=3000,shown=0,folded=false,peek=false,floatTimer=0;
  function bulaTop(){
    var acts=document.querySelector('header [data-dimau-header-actions]');
    var pill=document.querySelector('.bw-pill');
    // No top bar to sit in: the pill floats in a corner. It must never stay parked over the page (it used to cover the
    // profile block at the bottom of the rail), so a floating pill is put away after three seconds.
    if(pill&&!acts&&!floatTimer)floatTimer=setTimeout(function(){var p=document.querySelector('.bw-pill');if(p&&!document.querySelector('header [data-dimau-header-actions]'))(p.closest('.bw-group')||p).style.setProperty('display','none','important');},HOLD);
    if(!acts||!pill)return;
    (pill.closest('.bw-group')||pill).style.removeProperty('display');
    var el=pill.closest('.bw-group')||pill;
    if(el.parentNode!==acts)acts.insertBefore(el,acts.firstChild);
    // If bula-welcome floated it first (the header was not drawn yet), take off the floating position so it sits in the row,
    // exactly as when it is placed in the header directly. Without this the pill landed bottom-left on some loads.
    if(!pill.classList.contains('bw-inline')){pill.classList.add('bw-inline');el.classList.remove('bw-float');['top','right','bottom','left'].forEach(function(p){el.style.removeProperty(p);pill.style.removeProperty(p);});}
    if(el.classList.contains('bw-own-line'))el.classList.remove('bw-own-line');
    // 10 Nov 2026: the full "Bula! Welcome to …" greets for three seconds, then folds to the short "Bula!" so it stops
    // taking up the bar. It stays a working button, and opens out again while pointed at or focused.
    if(!shown){shown=Date.now();setTimeout(function(){folded=true;bulaTop();},HOLD);pill.addEventListener('mouseenter',function(){peek=true;bulaTop();});pill.addEventListener('mouseleave',function(){peek=false;bulaTop();});pill.addEventListener('focus',function(){peek=true;bulaTop();});pill.addEventListener('blur',function(){peek=false;bulaTop();});}
    if(!pill.title)pill.title='Bula! Welcome to Sota Kece';
    var small=window.matchMedia('(max-width: 640px)').matches||(folded&&!peek);
    var set=function(e,p,v){if(e&&(e.style.getPropertyValue(p)!==v||e.style.getPropertyPriority(p)!=='important'))e.style.setProperty(p,v,'important');};
    set(pill,'white-space','nowrap');set(pill,'flex','0 0 auto');set(pill,'width','auto');set(pill,'max-width','none');set(pill,'align-self','center');set(pill,'margin','0');
    set(pill.querySelector('.bw-long'),'display',small?'none':'inline');
    set(pill.querySelector('.bw-short'),'display',small?'inline':'none');
  }
  // Move the pill in the same task it is added (a microtask, before paint) so the page never shows it on its own line first: no layout jump.
  var q=0;new MutationObserver(function(){if(q)return;q=1;Promise.resolve().then(function(){q=0;bulaTop();});}).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',bulaTop);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bulaTop);else bulaTop();
})();

/* 30 Oct 2026: no "?" help button (retired 28 Sep); the guided tour stays */
;(function(){function h(){var q=document.getElementById('dg-launcher');if(q&&q.style.getPropertyValue('display')!=='none')q.style.setProperty('display','none','important');}new MutationObserver(h).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});h();})();
