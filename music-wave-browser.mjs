import {sleeve} from './music-sleeves.mjs?v=1';
export function waveBrowser(field) {
  const row=document.createElement('div');row.className='sk-display-cards sk-wave-fan';
  row.setAttribute('role','group');row.setAttribute('aria-label','Browse song sleeves');
  const nav=document.createElement('div');nav.className='sk-wave-nav';
  function stepButton(label,text,delta){
    const node=document.createElement('button');node.type='button';node.textContent=text;
    node.setAttribute('aria-label',label);node.addEventListener('click',()=>settle(index+delta));return node;
  }
  const back=stepButton('Previous sleeve','‹',-1),next=stepButton('Next sleeve','›',1);
  const caption=document.createElement('span');caption.setAttribute('aria-live','polite');
  const title=document.createElement('b'),credit=document.createElement('small');caption.append(title,credit);
  nav.append(back,caption,next);field.append(row,nav);
  let items=[],index=0,position=0,playing='',drag=null,suppress=false;
  const nodes=new Map();
  const bound=n=>Math.min(Math.max(0,items.length-1),Math.max(0,n));
  function paint(value) {
    position=bound(value);
    const center=Math.round(position), visible=new Set();
    for(let i=Math.max(0,center-2);i<=Math.min(items.length-1,center+2);i++){
      const item=items[i],key=item.track.key;visible.add(key);
      let card=nodes.get(key);
      if(!card){
        card=document.createElement('button');card.type='button';card.className='sk-wave-cover';
        card.setAttribute('aria-label','Play '+item.track.title);card.dataset.key=key;
        sleeve(card,item.track);nodes.set(key,card);row.append(card);
        card.addEventListener('click',e=>{
          if(suppress && e.detail!==0){e.preventDefault();return;}
          items.find(entry=>entry.track.key===key)?.pick();
        });
      }
      const d=i-position,dist=Math.abs(d);
      card.style.setProperty('--shift',(d*66)+'%');card.style.setProperty('--turn',(d*9)+'deg');
      card.style.setProperty('--scale',String(1-.12*Math.min(dist,2)));
      card.style.zIndex=String(30-Math.round(dist*10));
      card.tabIndex=i===center?0:-1;
      card.setAttribute('aria-current',String(i===center));
    }
    for(const [key,node] of nodes)if(!visible.has(key)){node.remove();nodes.delete(key);}
  }
  function settle(value){
    index=bound(Math.round(value));paint(index);
    const track=items[index]?.track;
    title.textContent=track?.title||'Queue is empty';
    credit.textContent=track ? [track.artist,track.key===playing?'Current track':'Tap sleeve to play'].filter(Boolean).join(' · ') : '';
    back.disabled=index===0;next.disabled=index>=items.length-1;
  }
  function setItems(entries,currentKey) {
    const previous=items[index]?.track.key;
    items=entries;
    const at=items.findIndex(entry=>entry.track.key===previous);
    drag=null;row.classList.remove('is-dragging');suppress=false;
    const nextIndex=currentKey===playing&&at>=0?at:0;
    playing=currentKey;settle(nextIndex);
  }
  row.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();
    const target=e.key==='Home'?0:e.key==='End'?items.length-1:index+(e.key==='ArrowLeft'?-1:1);
    settle(target);nodes.get(items[index]?.track.key)?.focus({preventScroll:true});
  });
  field.addEventListener('pointerdown',e=>{
    if(e.button!==0 || drag || e.target.closest('.sk-wave-nav,.sk-display-angle'))return;
    suppress=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:index,slid:false};
  });
  field.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.slid){
      if(Math.abs(dy)>8&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
      if(Math.abs(dx)<6)return;
      drag.slid=true;suppress=true;field.setPointerCapture(e.pointerId);row.classList.add('is-dragging');
    }
    paint(drag.start-dx/Math.max(52,Math.min(120,row.clientWidth*.22)));
  });
  function stop(e,cancel){
    if(!drag||drag.id!==e.pointerId)return;
    const prior=drag;drag=null;row.classList.remove('is-dragging');
    if(prior.slid)settle(cancel?prior.start:position);
  }
  field.addEventListener('pointerup',e=>stop(e,false));
  field.addEventListener('pointercancel',e=>stop(e,true));
  // Touch implicitly captures on the sleeve. Its bubbled loss is expected when the field takes over a drag.
  field.addEventListener('lostpointercapture',e=>{if(e.target===field)stop(e,true);});
  field.addEventListener('pointerleave',()=>{if(drag&&!drag.slid)drag=null;});
  return {setItems};
}
