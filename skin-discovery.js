(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SotaSkinDiscovery=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const groups=[
    {id:'school-pride',name:'School pride',line:'Your school. Your people.',categories:['Schools'],picks:['school-ratu-kadavulevu-school','school-adi-cakobau-school'],kind:'school'},
    {id:'vanua-islands',name:'Vanua & islands',line:'Carry a little home with you.',categories:['Provinces','Places'],picks:['province-ra','province-nadroga-navosa'],kind:'place'},
    {id:'music-crowd',name:'The music crowd',line:'The artists that bring you together.',categories:['Music & bands'],picks:['music-makare','music-paradise-rootz'],kind:'music'},
    {id:'masi-culture',name:'Masi & culture',line:'Cloth, craft and a sense of belonging.',categories:['Culture','Masi-inspired'],picks:['core-masi','salusalu'],kind:'heritage'},
    {id:'life-memories',name:'Life & memories',line:'Big days. Little memories.',categories:['Celebrations','Love & Memories'],picks:['memory-love','memory-broken-hearted'],kind:'celebration'},
    {id:'fresh-looks',name:'Fresh looks',line:'An ocean mood or a little nostalgia.',categories:['New picks'],picks:['studio-ocean','studio-retro'],kind:'social'}
  ];
  const text=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  function collections(presets){
    return groups.map(group=>{
      const members=presets.filter(p=>group.categories.includes(p.category));
      const featured=group.picks.map(id=>members.find(p=>p.id===id)).filter(Boolean);
      return {...group,count:members.length,featured:featured.length?featured:members.slice(0,2)};
    }).filter(group=>group.count);
  }
  function featuredCollections(presets){return collections(presets).filter(group=>group.id!=='school-pride');}
  function matching(presets,category='Discover',query=''){
    const needle=text(query),group=groups.find(g=>g.id===category);
    // Searching always covers the complete catalogue, including attributed artist/song names.
    if(needle)return presets.filter(p=>text([p.name,p.identityLabel,p.category,p.note,...(p.songs||[]).flatMap(s=>[s.title,s.performer])].join(' ')).includes(needle));
    if(category==='Discover')return featuredCollections(presets).flatMap(g=>g.featured);
    return presets.filter(p=>category==='All'||group?.categories.includes(p.category)||p.category===category);
  }
  function layout(preset){
    if(!preset)return 'social';
    if(preset.category==='Schools')return 'school';
    if(preset.look==='music'||preset.category==='Music & bands')return 'music';
    if(preset.look==='masi')return 'heritage';
    if(['Provinces','Places'].includes(preset.category))return 'place';
    if(['Celebrations','Love & Memories'].includes(preset.category))return 'celebration';
    return 'social';
  }
  return {collections,featuredCollections,matching,layout};
});
