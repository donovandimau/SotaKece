(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DimauCommsCore=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const PREFIX='#dimau-comms:v1 ',MAX_BODY=900;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
 const ROOM=/^Dimau-[0-9a-f]{32}$/;
 const statuses=['todo','doing','done'];
 const clean=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
 function valid(e){
  if(!e||typeof e!=='object'||Array.isArray(e))return false;
  const shapes={chat:['kind','text'],thread:['kind','id','title','text'],reply:['kind','thread','text'],task:['kind','id','title','status'],call:['kind','id','mode']};
  const keys=shapes[e.kind];if(!keys||Object.keys(e).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(e,k)))return false;
  if(e.kind==='chat')return clean(e.text,850);
  if(e.kind==='thread')return UUID.test(e.id)&&clean(e.title,80)&&clean(e.text,600);
  if(e.kind==='reply')return UUID.test(e.thread)&&clean(e.text,700);
  if(e.kind==='task')return UUID.test(e.id)&&clean(e.title,180)&&statuses.includes(e.status);
  return ROOM.test(e.id)&&['audio','video'].includes(e.mode);
 }
 function encode(e){if(!valid(e))throw Error('Check the message or card before saving.');const body=PREFIX+JSON.stringify(e);if(body.length>MAX_BODY)throw Error('This message is too long. Shorten it and try again.');return body;}
 function parse(body){if(typeof body!=='string'||body.length>MAX_BODY||!body.startsWith(PREFIX))return null;try{const e=JSON.parse(body.slice(PREFIX.length));return valid(e)?e:null;}catch(_){return null;}}
 function compare(a,b){const time=String(a.created_at||'').localeCompare(String(b.created_at||''));if(time)return time;const x=String(a.id),y=String(b.id);if(/^\d+$/.test(x)&&/^\d+$/.test(y))return x.length-y.length||x.localeCompare(y);return x.localeCompare(y);}
 function reduce(rows){const ordered=[...new Map(rows.map(r=>[String(r.id),r])).values()].sort(compare),chat=[],threads=new Map(),tasks=new Map(),calls=[];
  for(const row of ordered){const e=parse(row.body);if(!e){chat.push({...row,text:String(row.body||'')});continue;}if(e.kind==='chat'){chat.push({...row,text:e.text});continue;}
   if(e.kind==='thread'){if(!threads.has(e.id))threads.set(e.id,{...e,row,replies:[]});}
   else if(e.kind==='reply'){const t=threads.get(e.thread);if(t)t.replies.push({...e,row});}
   else if(e.kind==='task')tasks.set(e.id,{...e,row});
   else calls.push({...e,row});
  }return {chat,threads:[...threads.values()],tasks:[...tasks.values()],calls};
 }
 function meetingUrl(id,mode){if(!ROOM.test(id)||!['audio','video'].includes(mode))throw Error('Invalid meeting invitation.');return 'https://meet.jit.si/'+id+(mode==='audio'?'#config.startAudioOnly=true':'');}
 function validMeetingUrl(value){try{const u=new URL(value);return u.origin==='https://meet.jit.si'&&!u.username&&!u.password&&!u.search&&ROOM.test(u.pathname.slice(1))&&['','#config.startAudioOnly=true'].includes(u.hash);}catch(_){return false;}}
 function summary(body){const e=parse(body);if(!e)return body;return e.kind==='chat'?e.text:e.kind==='task'?'Board · '+e.title+' · '+e.status:e.kind==='thread'?'Discussion · '+e.title:e.kind==='reply'?'Discussion reply · '+e.text:'Call invitation · '+e.mode+' · Open Communications to join';}
 function routeView(view){return {tab:view==='boards'?'board':view==='calls'?'calls':view==='discussions'?'discussions':'chat',groups:view==='groups'};}
 return {PREFIX,MAX_BODY,statuses,valid,encode,parse,compare,reduce,meetingUrl,validMeetingUrl,summary,routeView};
});
