// New adapter to existing account and data services; no legacy UI modules.
// Only the public client key is embedded. Access remains governed by existing RLS.
const URL='https://xnxmumbvgtmlpenutlii.supabase.co';
const PUBLIC_KEY='sb_publishable_WFJ3jKwImNhGdTdrS9W6mg_3CUSUYIM';
let clientPromise;
export async function client(){if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.57.4').then(({createClient})=>createClient(URL,PUBLIC_KEY,{auth:{storageKey:'sota-revised-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})).catch(error=>{clientPromise=null;throw error;});return clientPromise;}
export async function result(query){const {data,error}=await query;if(error)throw new Error(error.message||'The connection was interrupted. Try again.');return data;}
export const profile=p=>({id:p.id,name:p.display_name||p.handle,handle:p.handle,emoji:p.avatar_emoji||'🌺',bio:p.bio||'',color:'sage',theme:'lagoon',pronouns:p.pronouns||''});
export function mapMoment(p){return {id:String(p.id),author:p.author,person:{id:p.author,name:p.display_name||p.handle||'Member',handle:p.handle||'',emoji:p.avatar_emoji||'🌺',color:'sage'},text:p.body||'',createdAt:p.created_at,art:'',likes:Number(p.luv_count??p.luv??0),comments:[],liked:Boolean(p.i_luvd),remote:true};}
export class Service{
 constructor(sb){this.sb=sb;this.user=null;this.epoch=0;}
 owner(user){this.user=user;this.epoch++;}
 async guarded(work){const owner=this.user?.id,epoch=this.epoch;if(!owner)throw Error('Please sign in first.');const data=await work(owner);if(epoch!==this.epoch||owner!==this.user?.id)throw Error('Your account changed. Please reopen this page.');return data;}
 me(){return this.guarded(async owner=>{const p=await result(this.sb.from('bv_profiles').select('*').eq('id',owner).maybeSingle());return p?profile(p):null;});}
 feed(){return this.guarded(async()=>{const p=await result(this.sb.rpc('bv_moments_feed',{lim:40}));return (p||[]).map(mapMoment);});}
 friends(){return this.guarded(async()=>{const rows=await result(this.sb.rpc('bv_my_friends'))||[];const missing=rows.filter(p=>!p.id&&p.handle);const mapped=missing.length?await result(this.sb.from('bv_profiles').select('id,handle').in('handle',missing.map(p=>p.handle)).limit(200)):[];return rows.map(p=>profile({...p,id:p.id||mapped.find(m=>m.handle===p.handle)?.id}));});}
 pending(){return this.guarded(()=>result(this.sb.rpc('bv_pending_requests')));}
 search(handle){return this.guarded(owner=>result(this.sb.from('bv_profiles').select('id,handle,display_name,avatar_emoji,bio').ilike('handle',handle.replace(/[%_]/g,'')+'%').neq('id',owner).limit(20))).then(rows=>(rows||[]).map(profile));}
 post(text){return this.guarded(owner=>result(this.sb.from('bv_moments').insert({author:owner,body:text,media_url:null})));}
 like(post){return this.guarded(owner=>result(this.sb.from('bv_luv').insert({giver:owner,target_kind:'moment',target_id:Number(post)})));}
 request(person){return this.guarded(owner=>result(this.sb.from('bv_friendships').insert({requester:owner,addressee:person})));}
 accept(request){return this.guarded(()=>result(this.sb.from('bv_friendships').update({status:'accepted'}).eq('id',request)));}
 circles(){return this.guarded(async()=>{const rows=await result(this.sb.rpc('bv_circle_groups'));return (rows||[]).map(c=>({...c,id:String(c.id),description:c.circle_type==='music'?'A circle for your music.':'Your private conversation.',color:'sage',joined:true}));});}
 messages(circle){return this.guarded(async()=>{const rows=await result(this.sb.from('bv_crew_messages').select('id,author,body,created_at').eq('crew_id',Number(circle)).order('created_at',{ascending:false}).limit(80));const ids=[...new Set((rows||[]).map(m=>m.author))];const people=ids.length?await result(this.sb.from('bv_profiles').select('id,display_name,handle,avatar_emoji').in('id',ids)):[];return (rows||[]).reverse().map(m=>({id:String(m.id),author:m.author,text:m.body,createdAt:m.created_at,person:profile((people||[]).find(p=>p.id===m.author)||{id:m.author,display_name:'Member'})}));});}
 send(circle,text){return this.guarded(owner=>result(this.sb.from('bv_crew_messages').insert({crew_id:Number(circle),author:owner,body:text})));}
 createCircle(name){return this.guarded(owner=>result(this.sb.rpc('bv_circle_create_group',{p_name:name,p_type:'other',p_graph_visibility:'private',p_show_on_graph:false,p_expected_owner:owner})));}
 joinCircle(code){return this.guarded(owner=>result(this.sb.rpc('bv_join_circle',{p_code:code,p_show_on_graph:false,p_expected_owner:owner})));}
 saveProfile(p){return this.guarded(owner=>result(this.sb.from('bv_profiles').update({display_name:p.name,bio:p.bio,avatar_emoji:p.emoji}).eq('id',owner)));}
 async room(handle){return this.guarded(()=>result(this.sb.rpc('bv_room',{p_handle:handle})));}
 setup(p){return this.guarded(async owner=>{const free=await result(this.sb.rpc('bv_handle_free',{p_handle:p.handle}));if(!free)throw Error('That handle is taken. Try another one.');return result(this.sb.from('bv_profiles').insert({id:owner,handle:p.handle,display_name:p.name,avatar_emoji:'☀️'}));});}
}
