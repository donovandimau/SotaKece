// Hover lights: the word, the bullet/button and the panel under the pointer each light up in a different colour.
// No page markup is changed: words use the browser's highlight painter, panels use two overlay frames.
(function(){
  'use strict';
  if(window.SotaHoverLights||typeof document==='undefined')return;
  const fine=typeof matchMedia==='function'&&matchMedia('(hover:hover) and (pointer:fine)').matches;
  const COLOURS=['#f5b700','#00b8d9','#ff4f9a','#22c55e','#8b5cf6','#ff7a1a','#0ea5e9','#ef4444'];
  const PANEL='section,article,aside,nav,header,footer,form,dialog,fieldset,figure,details,table,[role="dialog"],[role="region"],[class*="card"],[class*="panel"],[class*="hero"],[class*="tile"],[class*="box"],[class*="sheet"]';
  const ITEM='a,button,li,summary,label,input,select,textarea,img,[role="button"],[role="tab"],[role="menuitem"],[class*="chip"],[class*="pill"],[class*="badge"]';
  const colourOf=new WeakMap();let next=0;
  function colourFor(el){if(!colourOf.has(el))colourOf.set(el,next++%COLOURS.length);return colourOf.get(el);}
  function wordAt(text,offset){
    if(!text)return null;let i=Math.min(Math.max(offset,0),text.length);
    if(i>=text.length||/\s/.test(text[i])){if(i>0&&/\S/.test(text[i-1]))i--;else return null;}
    let start=i,end=i;while(start>0&&/\S/.test(text[start-1]))start--;while(end<text.length&&/\S/.test(text[end]))end++;
    return end>start?{start,end}:null;
  }
  const api={COLOURS,wordAt,colourFor,active:false};
  window.SotaHoverLights=api;
  if(!fine)return;
  api.active=true;
  const frames={};
  function frame(kind){
    if(frames[kind])return frames[kind];
    const f=document.createElement('div');f.className='sota-hover-frame';f.dataset.kind=kind;f.setAttribute('aria-hidden','true');
    document.documentElement.appendChild(f);return frames[kind]=f;
  }
  const current={panel:null,item:null};
  function usable(el){
    if(!el||el===document.body||el===document.documentElement)return false;
    const r=el.getBoundingClientRect();
    if(r.width<6||r.height<6)return false;
    return !(r.width>innerWidth*.96&&r.height>innerHeight*.9);
  }
  function pick(start,selector){
    let el=start&&start.closest?start.closest(selector):null;
    while(el&&!usable(el))el=el.parentElement?el.parentElement.closest(selector):null;
    return el;
  }
  function place(kind){
    const el=current[kind],f=frame(kind);
    if(!el||!el.isConnected){f.classList.remove('on');current[kind]=null;return;}
    const r=el.getBoundingClientRect(),pad=kind==='item'?3:2,bullet=el.tagName==='LI'?20:0;
    f.style.transform='translate('+(r.left-pad-bullet)+'px,'+(r.top-pad)+'px)';
    f.style.width=(r.width+pad*2+bullet)+'px';f.style.height=(r.height+pad*2)+'px';
    const radius=parseFloat(getComputedStyle(el).borderTopLeftRadius)||8;
    f.style.borderRadius=Math.min(radius+pad,Math.min(r.width,r.height)/2+pad)+'px';
    f.style.setProperty('--hl',COLOURS[(colourFor(el)+(kind==='item'?3:0))%COLOURS.length]);
    f.classList.add('on');
  }
  function light(target){
    const item=pick(target,ITEM);let panel=pick(target,PANEL);
    if(panel&&panel===item)panel=pick(panel.parentElement,PANEL);
    current.item=item;current.panel=panel;place('panel');place('item');
  }
  const painter=typeof CSS!=='undefined'&&CSS.highlights&&typeof Highlight==='function';
  let lastWord='',wordTurn=0;
  function clearWord(){if(painter)for(let i=0;i<COLOURS.length;i++)CSS.highlights.delete('sota-word-'+i);lastWord='';}
  function lightWord(x,y){
    if(!painter)return;
    let node=null,offset=0;
    if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);if(p){node=p.offsetNode;offset=p.offset;}}
    else if(document.caretRangeFromPoint){const p=document.caretRangeFromPoint(x,y);if(p){node=p.startContainer;offset=p.startOffset;}}
    if(!node||node.nodeType!==3)return clearWord();
    const w=wordAt(node.data,offset);if(!w)return clearWord();
    const range=document.createRange();range.setStart(node,w.start);range.setEnd(node,w.end);
    const r=range.getBoundingClientRect();
    if(x<r.left-2||x>r.right+2||y<r.top-2||y>r.bottom+2)return clearWord();
    const key=w.start+':'+w.end+':'+node.data;
    if(key===lastWord&&range.startContainer===api._node)return;
    clearWord();lastWord=key;api._node=node;
    CSS.highlights.set('sota-word-'+(wordTurn++%COLOURS.length),new Highlight(range));
  }
  let queued=false,px=0,py=0,target=null;
  function run(){queued=false;if(!target)return;light(target);lightWord(px,py);}
  document.addEventListener('pointermove',event=>{
    if(event.pointerType&&event.pointerType!=='mouse'&&event.pointerType!=='pen')return;
    px=event.clientX;py=event.clientY;target=event.target;
    if(!queued){queued=true;requestAnimationFrame(run);}
  },{passive:true});
  function off(){target=null;current.item=current.panel=null;place('panel');place('item');clearWord();}
  document.documentElement.addEventListener('pointerleave',off);
  window.addEventListener('blur',off);
  window.addEventListener('scroll',()=>{if(current.item||current.panel){place('panel');place('item');}},{passive:true,capture:true});
  window.addEventListener('resize',off,{passive:true});
})();
