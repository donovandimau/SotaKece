/* 30 Oct 2026: the Bula welcome button sits in the top bar, phone and desktop (beside Sign in / the menu) */
(function(){
  function bulaTop(){
    var acts=document.querySelector('header [data-dimau-header-actions]');
    var pill=document.querySelector('.bw-pill');
    if(!acts||!pill)return;
    var el=pill.closest('.bw-group')||pill;
    if(el.parentNode!==acts)acts.insertBefore(el,acts.firstChild);
    if(el.classList.contains('bw-own-line'))el.classList.remove('bw-own-line');
    var small=window.matchMedia('(max-width: 640px)').matches;
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
