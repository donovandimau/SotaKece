const palettes=[
  ['#193933','#ec754f','#f6e4b9'],['#322347','#fac347','#fae9cc'],
  ['#203858','#64c4be','#eee1bf'],['#492d39','#f399a1','#ffeac8'],
  ['#21352c','#a6c565','#f1dfbe'],['#382847','#a7a1e1','#fdf0d1']
];
const sleeves=new Map();
const assigned=new WeakMap();
function poster(track) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=320;
  const ctx=canvas.getContext('2d');
  let seed=2166136261;
  for(const ch of [track.artist,track.title,track.key].join('|'))seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
  const [ink,accent,paper]=palettes[seed%palettes.length];
  ctx.fillStyle=ink;ctx.fillRect(0,0,320,320);
  ctx.save();ctx.beginPath();ctx.rect(0,0,320,157);ctx.clip();
  ctx.strokeStyle=accent;ctx.lineWidth=2+(seed%4);
  const variant=(seed>>>5)%3;
  for(let i=0;i<23;i++){
    ctx.beginPath();
    if(variant===0)ctx.ellipse(65+(seed%131),58,8+i*8,8+i*6,-.35,0,Math.PI*2);
    if(variant===1){ctx.moveTo(-30,i*9-35);ctx.bezierCurveTo(105,160+i*6,185,-155+i*10,350,i*10-25);}
    if(variant===2){ctx.moveTo(i*18-90,175);ctx.lineTo(95+i*8,10);ctx.lineTo(170+i*11,155);}
    ctx.stroke();
  }
  ctx.restore();ctx.fillStyle=accent;ctx.fillRect(17,167,286,3);
  const words=String(track.title||'Island Mix').trim().split(/\s+/);
  let lines=[],size=42;
  function wrap(){
    ctx.font='700 '+size+'px "Segoe UI", sans-serif';
    const rows=[];let line='';
    for(const word of words){
      const next=line?line+' '+word:word;
      if(line&&ctx.measureText(next).width>285){rows.push(line);line=word;}else line=next;
    }
    if(line)rows.push(line);return rows;
  }
  for(;size>=21;size--){lines=wrap();if(lines.length<=3 && lines.length*size<108)break;}
  ctx.fillStyle=paper;ctx.textBaseline='top';
  lines.slice(0,3).forEach((line,i)=>ctx.fillText(line,17,180+i*size,285));
  ctx.fillStyle=accent;ctx.font='600 15px "Segoe UI", sans-serif';
  ctx.fillText(track.artist||track.playlist||'Island Mix',18,289,282);
  return canvas.toDataURL('image/webp',.88);
}
const syncInt=b=>(b[0]<<21)|(b[1]<<14)|(b[2]<<7)|b[3];
const four=(b,p)=>String.fromCharCode(...b.subarray(p,p+4));
const maxTag=2*1024*1024;
async function prefix(track,end){
  if(track.blob)return new Uint8Array(await track.blob.slice(0,end).arrayBuffer());
  const response=await fetch(track.url,{headers:{Range:'bytes=0-'+(end-1)},credentials:'omit',referrerPolicy:'no-referrer'});
  if(response.status!==206){await response.body?.cancel();return null;}
  return new Uint8Array(await response.arrayBuffer());
}
// Read common ID3v2 front-cover frames. Never fetch an entire song just to inspect its sleeve.
async function embedded(track){
  if(!track.blob&&!track.url)return null;
  let bytes=await prefix(track,512);
  if(!bytes||String.fromCharCode(...bytes.subarray(0,3))!=='ID3'||![3,4].includes(bytes[3])||(bytes[5]&0xc0))return null;
  const size=10+syncInt(bytes.subarray(6,10));
  if(size>maxTag)return null;
  if(size>bytes.length)bytes=await prefix(track,size);
  if(!bytes)return null;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(let p=10;p+10<=Math.min(size,bytes.length);){
    const id=four(bytes,p),length=bytes[3]===4?syncInt(bytes.subarray(p+4,p+8)):view.getUint32(p+4);
    const end=p+10+length;
    if(!length||end>bytes.length||end>size)break;
    if(id==='APIC'&&!bytes[p+9]){
      const enc=bytes[p+10],mimeEnd=bytes.indexOf(0,p+11);
      if(mimeEnd>p+10&&mimeEnd<end-2&&[0,3].includes(bytes[mimeEnd+1])){
        let at=mimeEnd+2;
        if(enc===1||enc===2){while(at+1<end&&(bytes[at]||bytes[at+1]))at+=2;at+=2;}
        else{while(at<end&&bytes[at])at++;at++;}
        const mime=String.fromCharCode(...bytes.subarray(p+11,Math.min(mimeEnd,p+90))).toLowerCase();
        if(at<end&&['image/jpeg','image/png','image/webp'].includes(mime))return new Blob([bytes.subarray(at,end)],{type:mime});
      }
    }
    p=end;
  }
  return null;
}
async function resolveCover(track) {
  if(track.artworkUrl){
    const url=new URL(track.artworkUrl,location.href);
    if(url.protocol==='https:'||url.origin===location.origin){
      const img=new Image();img.referrerPolicy='no-referrer';img.src=url.href;
      try{await img.decode();return url.href;}catch{}
    }
  }
  const blob=await embedded(track);
  if(!blob)return null;
  const src=URL.createObjectURL(blob);
  try{
    const img=new Image();img.src=src;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
    const side=Math.min(img.width,img.height);
    canvas.getContext('2d').drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,384,384);
    return canvas.toDataURL('image/webp',.9);
  }finally{URL.revokeObjectURL(src);}
}
export function sleeve(node,track){
  if(!track){node.style.removeProperty('--photo');assigned.delete(node);return;}
  const key=track.key||track.id||track.title;
  assigned.set(node,key);
  let entry=sleeves.get(key);
  if(!entry){
    entry={fallback:poster(track),actual:resolveCover(track).catch(()=>null)};
    sleeves.set(key,entry);if(sleeves.size>40)sleeves.delete(sleeves.keys().next().value);
  }
  const apply=url=>node.style.setProperty('--photo','url('+JSON.stringify(url)+')');
  apply(entry.fallback);
  entry.actual.then(url=>{if(url&&assigned.get(node)===key)apply(url);});
}
