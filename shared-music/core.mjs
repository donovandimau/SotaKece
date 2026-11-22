export const AUDIO_BASE='https://xnxmumbvgtmlpenutlii.supabase.co/storage/v1/object/public/fiji-audio/';
export const CATALOGUE_URL='https://fijihistory.com/shared-music/catalogue.json';
const KEY='dimau.shared-music.catalogue.v1',TTL=300000;
let saved=null,pending=null;
export function validateCatalogue(value){
  if(!value||value.version!==1||!Array.isArray(value.tracks)||value.tracks.length<1||value.tracks.length>999)throw Error('Music catalogue unavailable.');
  const ids=new Set(),paths=new Set();
  return Object.freeze(value.tracks.map(t=>{
    if(!t||typeof t.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(t.id)||ids.has(t.id)||typeof t.title!=='string'||!t.title.trim()||t.title.length>250||typeof t.path!=='string'||!(/^(?:fiji-default-soundtrack|fiji-(?:remix|song)-\d{2,3})\.mp3$/).test(t.path)||paths.has(t.path)||!Number.isSafeInteger(t.size)||t.size<1||t.size>262144000||t.type!=='audio/mpeg'||(t.fileName!==undefined&&(typeof t.fileName!=='string'||!t.fileName.trim()||t.fileName.length>250||/[\u0000-\u001f\u007f]/.test(t.fileName)))||(t.playlist!==undefined&&(typeof t.playlist!=='string'||!t.playlist.trim()||t.playlist.length>80||/[\u0000-\u001f\u007f]/.test(t.playlist)))||t.url!==undefined)throw Error('Music catalogue unavailable.');
    ids.add(t.id);paths.add(t.path);
    const cover=t.artworkUrl||t.coverUrl||t.artwork;
    const artwork=typeof cover==='string' && /^https:\/\//i.test(cover) && cover.length<2048 ? {artworkUrl:cover} : {};
    return Object.freeze({id:t.id,title:t.title.trim(),path:t.path,fileName:t.fileName?.trim()||t.path,size:t.size,type:t.type,playlist:t.playlist?.trim()||OTHER,url:AUDIO_BASE+t.path,...artwork});
  }));
}
export const ALL='All songs',OTHER='Dimau Mix';
export function playlists(tracks){const names=[];for(const t of tracks)if(!names.includes(t.playlist))names.push(t.playlist);return names;}
const raw=tracks=>tracks.map(({id,title,path,fileName,size,type,playlist,artworkUrl})=>({id,title,path,fileName,size,type,playlist,...(artworkUrl?{artworkUrl}:{})}));
function cached(){
  if(saved)return saved;
  try{const value=JSON.parse(globalThis.localStorage.getItem(KEY));if(value&&Number.isFinite(value.savedAt)&&value.savedAt>0&&value.savedAt<=Date.now()){saved={tracks:validateCatalogue(value),savedAt:value.savedAt};}}catch(_){}
  return saved;
}
export async function loadCatalogue({force=false}={}){
  if(pending)return pending;
  const previous=cached();
  if(!force&&previous&&Date.now()-previous.savedAt<TTL)return {tracks:previous.tracks,source:'cache',stale:false};
  const request=(async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await globalThis.fetch(CATALOGUE_URL,{credentials:'omit',referrerPolicy:'no-referrer',cache:'no-cache',signal:controller.signal});
      if(!response.ok)throw Error('Music catalogue unavailable.');
      const tracks=validateCatalogue(await response.json());saved={tracks,savedAt:Date.now()};
      try{globalThis.localStorage.setItem(KEY,JSON.stringify({version:1,savedAt:saved.savedAt,tracks:raw(tracks)}));}catch(_){}
      return {tracks,source:'network',stale:false};
    }catch(_){if(previous)return {tracks:previous.tracks,source:'cache',stale:true};throw Error('Music could not connect. Please try again.');}
    finally{clearTimeout(timeout);}
  })();
  pending=request;
  try{return await request;}finally{if(pending===request)pending=null;}
}
