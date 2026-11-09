(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SotaRoomMedia=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const bucket='bv-room-media',limit=6*1024*1024;
  const formats={mp3:'audio/mpeg',m4a:'audio/mp4',ogg:'audio/ogg',opus:'audio/ogg',wav:'audio/wav',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
  function path(value,kind){const text=String(value||'');return new RegExp('^[a-f0-9-]{36}/'+(kind==='music'?'music':'covers')+'/[a-f0-9-]{36}\\.(?:'+(kind==='music'?'mp3|m4a|ogg|opus|wav':'jpg|jpeg|png|webp')+')$','i').test(text)?text:'';}
  async function inspect(file,kind){
    if(!file||!file.size||file.size>limit)throw new Error('Choose a file up to 6 MB.');
    const extension=String(file.name).split('.').pop().toLowerCase();
    const allowed=kind==='music'?['mp3','m4a','ogg','opus','wav']:['jpg','jpeg','png','webp'];
    if(!allowed.includes(extension))throw new Error(kind==='music'?'Use MP3, M4A, OGG, Opus or WAV.':'Use a JPG, PNG or WebP image.');
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const text=String.fromCharCode(...bytes);
    const signatures={mp3:text.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224),m4a:text.slice(4,8)==='ftyp',ogg:text.startsWith('OggS'),opus:text.startsWith('OggS'),wav:text.startsWith('RIFF')&&text.slice(8,12)==='WAVE',jpg:bytes[0]===255&&bytes[1]===216&&bytes[2]===255,jpeg:bytes[0]===255&&bytes[1]===216&&bytes[2]===255,png:bytes[0]===137&&text.slice(1,4)==='PNG',webp:text.startsWith('RIFF')&&text.slice(8,12)==='WEBP'};
    if(!signatures[extension])throw new Error('The file content does not match its format. Try a different file.');
    return {extension,contentType:formats[extension]};
  }
  function api(client,userId){
    if(!/^[a-f0-9-]{36}$/i.test(userId||''))throw new Error('Sign in to upload your music or cover artwork.');
    return {
      async upload(file,kind){
        const checked=await inspect(file,kind);
        const objectPath=userId+'/'+(kind==='music'?'music':'covers')+'/'+crypto.randomUUID()+'.'+checked.extension;
        const {data,error}=await client.storage.from(bucket).upload(objectPath,file,{contentType:checked.contentType,cacheControl:'3600',upsert:false});
        if(error)throw new Error(error.message||'Upload interrupted. Try again when your connection returns.');
        if(!data||data.path!==objectPath)throw new Error('The upload could not be confirmed. Please try again.');
        return {path:objectPath,title:String(file.name).replace(/\.[^.]+$/,'').slice(0,80)};
      },
      async remove(objectPath){
        if(!objectPath.startsWith(userId+'/')||!(path(objectPath,'music')||path(objectPath,'covers')))throw new Error('That upload belongs to another room.');
        const {error}=await client.storage.from(bucket).remove([objectPath]);if(error)throw new Error(error.message);links.delete(objectPath);return true;
      }
    };
  }
  // Re-use one link per file for most of its hour, so repeat views come from the
  // browser and the nearby CDN copy instead of the Sydney origin. Memory only:
  // a reload or sign-out starts fresh, so links never outlive the session.
  const links=new Map(),reuseMs=50*60*1000;
  async function signed(client,objectPath,kind){
    if(!path(objectPath,kind))throw new Error('This room file is unavailable.');
    const hit=links.get(objectPath);
    if(hit&&hit.client===client&&hit.until>Date.now())return hit.url;
    const url=(async()=>{
      const {data,error}=await client.storage.from(bucket).createSignedUrl(objectPath,3600);
      if(error||!data?.signedUrl)throw new Error(error?.message||'This file is available to the room owner and their friends.');
      return data.signedUrl;
    })();
    links.set(objectPath,{client,url,until:Date.now()+reuseMs});
    try{return await url;}catch(e){links.delete(objectPath);throw e;}
  }
  function forget(objectPath){if(objectPath)links.delete(objectPath);else links.clear();}
  return {bucket,limit,formats,path,inspect,api,signed,forget};
});
