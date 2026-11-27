'use strict';
// Web Push without a library: the message is encrypted for one browser (RFC 8291, aes128gcm) and the
// request proves it comes from this site (VAPID, RFC 8292). Only WebCrypto is used, so the same file
// runs in the Cloudflare Worker and in Node.
//
// Keys (set on the Worker, never in the repository):
//   VAPID_PUBLIC_KEY   the 65-byte uncompressed P-256 public key, base64url
//   VAPID_PRIVATE_KEY  the 32-byte private scalar, base64url
const subtle=globalThis.crypto.subtle;
const enc=new TextEncoder();

const b64u=bytes=>Buffer.from(bytes).toString('base64url');
const unb64u=text=>new Uint8Array(Buffer.from(String(text),'base64url'));
const concat=(...parts)=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;};

async function hkdf(salt,ikm,info,length){
  const key=await subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));
}

// RFC 8291. `userPublic` is the browser's p256dh key and `authSecret` its auth secret (both base64url).
// `fixed` lets a test supply the salt and the sender's key pair; it is never used in production.
async function encrypt(payload,userPublic,authSecret,fixed){
  const ua=unb64u(userPublic),auth=unb64u(authSecret);
  if(ua.length!==65||ua[0]!==4)throw Error('bad_p256dh');
  if(auth.length<16)throw Error('bad_auth');
  const data=typeof payload==='string'?enc.encode(payload):new Uint8Array(payload);
  if(data.length>3993)throw Error('payload_too_large');   // one 4096-byte record: 4096 - 16 tag - 1 delimiter - 86 header
  const pair=fixed&&fixed.keyPair||await subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const asPublic=new Uint8Array(await subtle.exportKey('raw',pair.publicKey));
  const uaKey=await subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const secret=new Uint8Array(await subtle.deriveBits({name:'ECDH',public:uaKey},pair.privateKey,256));
  const prk=await hkdf(auth,secret,concat(enc.encode('WebPush: info\0'),ua,asPublic),32);
  const salt=fixed&&fixed.salt||globalThis.crypto.getRandomValues(new Uint8Array(16));
  const cek=await hkdf(salt,prk,enc.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await hkdf(salt,prk,enc.encode('Content-Encoding: nonce\0'),12);
  const aes=await subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const body=await subtle.encrypt({name:'AES-GCM',iv:nonce},aes,concat(data,new Uint8Array([2])));   // 0x02 ends the last record
  const header=new Uint8Array(21);header.set(salt,0);new DataView(header.buffer).setUint32(16,4096,false);header[20]=asPublic.length;
  return concat(header,asPublic,new Uint8Array(body));
}

// RFC 8292: a short-lived signed token naming this site, plus the public key the push service checks it against.
async function vapidAuthorization(endpoint,{publicKey,privateKey,subject},now=Date.now()){
  const pub=unb64u(publicKey),d=unb64u(privateKey);
  if(pub.length!==65||pub[0]!==4||d.length!==32)throw Error('bad_vapid_key');
  const jwk={kty:'EC',crv:'P-256',x:b64u(pub.slice(1,33)),y:b64u(pub.slice(33)),d:b64u(d),ext:true};
  const key=await subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const claims={aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+12*3600,sub:subject};
  const unsigned=b64u(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+b64u(enc.encode(JSON.stringify(claims)));
  const sig=new Uint8Array(await subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(unsigned)));   // raw r||s, which is what JWT wants
  return `vapid t=${unsigned}.${b64u(sig)}, k=${publicKey}`;
}

// A push endpoint must be an https address on a push service, never an internal one.
function safeEndpoint(endpoint){
  try{
    const u=new URL(endpoint);
    if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return false;
    const h=u.hostname.toLowerCase();
    if(!h.includes('.')||/^\d+\.\d+\.\d+\.\d+$/.test(h)||h==='localhost'||h.endsWith('.local')||h.endsWith('.internal'))return false;
    return endpoint.length<=1000;
  }catch(_){return false;}
}

// Send one message. Returns {ok, status, gone}; `gone` means the browser dropped the subscription (404/410).
async function send(subscription,message,vapid,options={}){
  const {endpoint,p256dh,auth}=subscription;
  if(!safeEndpoint(endpoint))return {ok:false,status:0,gone:false,error:'bad_endpoint'};
  const fetcher=options.fetcher||fetch;
  const body=await encrypt(JSON.stringify(message),p256dh,auth);
  const response=await fetcher(endpoint,{
    method:'POST',
    headers:{Authorization:await vapidAuthorization(endpoint,vapid,options.now),'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:String(options.ttl??45),Urgency:options.urgency||'high'},
    body,signal:AbortSignal.timeout(options.timeout||8000)
  });
  return {ok:response.status>=200&&response.status<300,status:response.status,gone:response.status===404||response.status===410};
}

module.exports={encrypt,vapidAuthorization,safeEndpoint,send,b64u,unb64u};
