(function(root,factory){
  const skins=typeof module==='object'&&module.exports?require('./skins.js'):root.BulaSkins;
  const api=factory(skins);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SotaCircleTypes=api;
})(typeof globalThis==='object'?globalThis:this,function(skins){
  'use strict';
  const types=Object.freeze([
    {id:'kava',label:'Digital Kava Session',skin:'grog',emoji:'🥥',accent:'#efc187'},
    {id:'tale',label:'Sota Tale Circle',skin:'studio-ocean',emoji:'🤝',accent:'#6de6dd'},
    {id:'kakase',label:'Kakase Circle',skin:'kula',emoji:'💬',accent:'#b52b50'},
    {id:'lotu',label:'Lotu Circle',skin:'masi-white',emoji:'🙏',accent:'#756035'},
    {id:'koro',label:'Village Circle',skin:'village',emoji:'🪸',accent:'#246347'},
    {id:'mataqali',label:'Mataqali Circle',skin:'core-masi',emoji:'🌿',accent:'#7a412c'},
    {id:'school',label:'School Circle',skin:'varsity',emoji:'🎓',accent:'#8f2d40'},
    {id:'old-boys',label:'Old Boys Circle',skin:'occasion-school-reunion',emoji:'🎓',accent:'#875016'},
    {id:'old-girls',label:'Old Girls Circle',skin:'occasion-school-reunion',emoji:'🎓',accent:'#875016'},
    {id:'family',label:'Family Circle',skin:'occasion-family-reunion',emoji:'🏡',accent:'#246347'},
    {id:'music',label:'Music / Sigidrigi Circle',skin:'sigidrigi',emoji:'🎶',accent:'#c4b7fc'},
    {id:'other',label:'Other Circle',skin:'lagoon',emoji:'💬',accent:'#086779'}
  ].map(type=>{
    const preset=Array.isArray(skins?.presets)?skins.presets.find(preset=>preset.id===type.skin):null;
    // accent is stable server metadata, shared with bv_circle_theme. Only the
    // display colour follows the current room palette; no saved group changes.
    return Object.freeze({...type,displayAccent:/^#[0-9a-f]{6}$/i.test(preset?.accent)?preset.accent:type.accent});
  }));
  const fallback=types.find(type=>type.id==='koro');
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function get(id){return types.find(type=>type.id===id)||fallback;}
  function requireType(id){
    const type=types.find(type=>type.id===id);
    if(!type)throw new RangeError('Unknown circle type.');
    return type;
  }
  function options(selected='koro'){
    const chosen=get(selected).id;
    return types.map(type=>`<option value="${escape(type.id)}"${type.id===chosen?' selected':''}>${escape(type.label)}</option>`).join('');
  }
  function theme(id,skins){
    if(!skins||typeof skins.normalize!=='function')throw new TypeError('The skin catalogue is unavailable.');
    // BulaSkins uses the saved preset's id; no member profile or custom CSS is involved.
    return skins.normalize({id:get(id).skin});
  }
  return Object.freeze({types,get,requireType,options,theme});
});
