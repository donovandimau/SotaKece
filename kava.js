(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SotaKava=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const currencies=['FJD','GBP','AUD','NZD'];
  const amounts=[200,500,1000];
  function draft(input={}){
    const title=String(input.title||'').trim(),topic=String(input.topic||'').trim(),capacity=Number(input.capacity);
    if(!title||title.length>80)throw new Error('Give your circle a title of 1–80 characters.');
    if(topic.length>500)throw new Error('Keep the topic within 500 characters.');
    if(!Number.isInteger(capacity)||capacity<4||capacity>6)throw new Error('Choose four, five or six speaker seats.');
    if(!Number.isSafeInteger(Number(input.crew))||Number(input.crew)<1)throw new Error('Choose a Village for your circle.');
    return {p_crew:Number(input.crew),p_title:title,p_topic:topic,p_capacity:capacity};
  }
  function seats(circle,people){
    return Array.from({length:Math.min(6,Math.max(4,Number(circle.capacity)||6))},(_,i)=>({number:i+1,person:people.find(p=>p.seat===i+1)||null}));
  }
  function nextSeat(circle,people){return seats(circle,people).find(s=>s.number>1&&!s.person)?.number||null;}
  function money(minor,currency){
    if(!currencies.includes(currency)||!Number.isSafeInteger(minor)||minor<0)throw new Error('Invalid money amount.');
    return new Intl.NumberFormat(undefined,{style:'currency',currency,currencyDisplay:'code'}).format(minor/100);
  }
  function tipSelection(minor,currency){
    if(!amounts.includes(minor)||!currencies.includes(currency))throw new Error('Choose a listed tip amount and currency.');
    return {minor,currency,label:money(minor,currency),available:false,fee:null,recipientAmount:null};
  }
  function api(client){
    const check=result=>{if(result.error){const err=new Error(result.error.message);err.code=result.error.code;throw err;}return result.data;};
    return {
      crews:async()=>check(await client.rpc('bv_my_crews'))||[],
      list:async()=>check(await client.from('bv_circles').select('*').order('created_at',{ascending:false}).limit(40))||[],
      create:async input=>check(await client.rpc('bv_circle_create',draft(input))),
      load:async id=>{
        const circle=check(await client.from('bv_circles').select('*').eq('id',id).maybeSingle());
        if(!circle)throw new Error('This circle is unavailable. Check your Village membership.');
        const people=check(await client.from('bv_circle_people').select('*').eq('circle_id',id).order('joined_at'))||[];
        const comments=check(await client.from('bv_circle_comments').select('*').eq('circle_id',id).order('created_at',{ascending:false}).limit(60))||[];
        const ids=[...new Set([circle.host,...people.map(p=>p.member),...comments.map(p=>p.author)])];
        const profiles=check(await client.from('bv_profiles').select('id,display_name,avatar_emoji,handle').in('id',ids))||[];
        return {circle,people,comments,profiles:Object.fromEntries(profiles.map(p=>[p.id,p]))};
      },
      join:async(id,user)=>check(await client.from('bv_circle_people').upsert({circle_id:id,member:user},{onConflict:'circle_id,member',ignoreDuplicates:true})),
      request:async(id,user,value)=>check(await client.from('bv_circle_people').update({requested:!!value}).eq('circle_id',id).eq('member',user).select().single()),
      moderate:async(id,user,patch)=>check(await client.from('bv_circle_people').update(patch).eq('circle_id',id).eq('member',user).select().single()),
      status:async(id,status)=>check(await client.from('bv_circles').update({status}).eq('id',id).select().single()),
      comment:async(id,user,body)=>{
        const text=String(body||'').trim();if(!text||text.length>900)throw new Error('Write a comment of 1–900 characters.');
        return check(await client.from('bv_circle_comments').insert({circle_id:id,author:user,body:text}));
      },
      removeComment:async id=>check(await client.from('bv_circle_comments').delete().eq('id',id))
    };
  }
  return {currencies,amounts,draft,seats,nextSeat,money,tipSelection,api};
});
