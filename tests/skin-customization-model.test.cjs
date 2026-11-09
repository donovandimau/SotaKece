'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const skins=require('../skins.js');
const defaults={customName:'',showArtwork:true,textScale:100,headingScale:100,coverHeight:195,coverX:0,coverY:100,textAlign:'left',musicPosition:'auto',avatarPath:'',motionPath:'',motionStyle:'',motionVariant:0,motionIntensity:1,motionFocusX:0.5,motionFocusY:0.5};
const numeric={textScale:[90,140,100],headingScale:[80,150,100],coverHeight:[180,420,195],coverX:[0,100,0],coverY:[0,100,100]};
const fields=Object.keys(defaults);
function customization(settings){return Object.fromEntries(fields.map(key=>[key,settings[key]]));}

test('all 94 legacy presets retain defaults and read existing v1 saves',()=>{
 assert.equal(skins.presets.length,94);
 for(const preset of skins.presets){
  const legacy={id:preset.id,font:preset.font,layout:'wide',note:'Legacy room note',interests:'Music, mates',accent:preset.accent};
  const encoded='/* bv-skin:v1 '+encodeURIComponent(JSON.stringify(legacy))+' */\n.legacy{color:red}';
  const result=skins.read(encoded);
  assert.equal(result.settings.id,preset.id);assert.equal(result.settings.font,preset.font);assert.equal(result.settings.layout,'wide');
  assert.equal(result.settings.note,legacy.note);assert.equal(result.settings.interests,legacy.interests);assert.equal(result.legacy,'.legacy{color:red}');
  assert.deepEqual(customization(result.settings),defaults);
  assert.deepEqual(skins.read(skins.encode(result.settings)).settings,result.settings);
 }
});

test('all presets round-trip independently customized v1 settings without mutating input',()=>{
 for(const [index,preset] of skins.presets.entries()){
  const raw=Object.freeze({id:preset.id,customName:'My own room '+index,showArtwork:false,font:skins.fonts[index%skins.fonts.length],
   textScale:119.5,headingScale:132,coverHeight:360,coverX:28,coverY:72,textAlign:'right',layout:'reverse',musicPosition:'top'});
  const normalized=skins.normalize(raw),encoded=skins.encode(raw,'.note{color:blue}');
  assert.deepEqual(skins.read(encoded),{settings:normalized,legacy:'.note{color:blue}'});
  for(const key of Object.keys(raw))assert.equal(normalized[key],raw[key]);
  assert.equal(skins.normalize({id:preset.id}).customName,'');
 }
});

test('unchanged legacy skin keeps its exact old header and full previous custom-CSS budget',()=>{
 for(const preset of skins.presets){
  const normalized=skins.normalize({id:preset.id,layout:'wide',font:'mono',note:'My existing note',interests:'Mates, music'});
  const oldShape={...normalized};for(const key of fields)delete oldShape[key];
  const oldHeader='/* bv-skin:v1 '+encodeURIComponent(JSON.stringify(oldShape))+' */\n';
  const css='/*'+'.'.repeat(4000-oldHeader.length-4)+'*/';
  assert.equal(oldHeader.length+css.length,4000);
  const oldSaved=oldHeader+css;
  assert.equal(skins.encode(normalized,css),oldSaved,preset.id+' preserves old CSS allowance');
  assert.equal(skins.encode(skins.read(oldSaved).settings,skins.read(oldSaved).legacy),oldSaved);
  assert.deepEqual(skins.read(oldSaved).settings,normalized);
 }
});

test('only new defaults are omitted; existing fields and every nondefault customization remain encoded',()=>{
 const normal=skins.normalize(),encoded=skins.encode(normal),payload=JSON.parse(decodeURIComponent(encoded.match(/^\/\* bv-skin:v1 ([^\n]+) \*\//)[1]));
 for(const key of fields)assert.equal(Object.hasOwn(payload,key),false);
 for(const key of ['layout','font','note','atmosphere','motionEnergy','trackUrl'])assert.equal(payload[key],normal[key]);
 const changed=skins.normalize({customName:'Own skin',showArtwork:false,textScale:120,headingScale:130,coverHeight:300,coverX:40,coverY:60,textAlign:'right',musicPosition:'top',motionPath:'11111111-1111-4111-8111-111111111111/covers/44444444-4444-4444-8444-444444444444.webp',motionStyle:'fluid',motionVariant:2,motionIntensity:1.4,motionFocusX:0.3,motionFocusY:0.7,avatarPath:'11111111-1111-4111-8111-111111111111/covers/22222222-2222-4222-8222-222222222222.webp'});
 const stored=JSON.parse(decodeURIComponent(skins.encode(changed).match(/^\/\* bv-skin:v1 ([^\n]+) \*\//)[1]));
 for(const key of fields)assert.equal(stored[key],changed[key]);
 assert.deepEqual(skins.read(skins.encode(changed)).settings,changed);
});

test('avatar and cover paths round-trip independently inside the existing room settings',()=>{
 const owner='11111111-1111-4111-8111-111111111111',object='22222222-2222-4222-8222-222222222222';
 for(const extension of ['jpg','jpeg','png','webp']){
  const avatarPath=owner+'/covers/'+object+'.'+extension,coverPath=owner+'/covers/33333333-3333-4333-8333-333333333333.webp';
  const raw=Object.freeze({id:'lagoon',avatarPath,coverPath,trackPath:owner+'/music/'+object+'.mp3',trackTitle:'My song',note:'Keep my story',interests:'Music, family',customName:'My room',layout:'wide'});
  const normalized=skins.normalize(raw),result=skins.read(skins.encode(raw,'.legacy{color:red}'));
  assert.equal(normalized.avatarPath,avatarPath);assert.equal(normalized.coverPath,coverPath);
  assert.deepEqual(result,{settings:normalized,legacy:'.legacy{color:red}'});
  for(const [key,value] of Object.entries(raw))assert.equal(result.settings[key],value);
 }
});

test('avatar paths accept only private cover object paths and reject URL or path injection',()=>{
 const owner='11111111-1111-4111-8111-111111111111',object='22222222-2222-4222-8222-222222222222',valid=owner+'/covers/'+object+'.png';
 for(const avatarPath of [undefined,null,'',17,{},'https://example.org/avatar.png','data:image/png;base64,AA',
  '/'+valid,valid+'?token=secret',valid+'#image',valid+'/extra',owner+'/covers/../'+object+'.png',
  owner+'/music/'+object+'.png',owner+'/avatars/'+object+'.png',owner+'/covers/'+object+'.svg',owner+'/covers/'+object+'.mp3',valid+'\n']){
  const normalized=skins.normalize({avatarPath});assert.equal(normalized.avatarPath,'',String(avatarPath));
  assert.equal(skins.read(skins.encode({avatarPath})).settings.avatarPath,'');
 }
 assert.equal(skins.normalize({avatarPath:valid}).avatarPath,valid);
 const oldHeader='/* bv-skin:v1 '+encodeURIComponent(JSON.stringify({id:'lagoon',note:'My original note'}))+' */\n.legacy{color:red}';
 const restored=skins.read(oldHeader);assert.equal(restored.settings.avatarPath,'');assert.equal(restored.settings.note,'My original note');assert.equal(restored.legacy,'.legacy{color:red}');
});

test('numeric controls accept finite numbers and numeric strings, and clamp each bound',()=>{
 for(const [key,[min,max]] of Object.entries(numeric)){
  assert.equal(skins.normalize({[key]:min-1000})[key],min);
  assert.equal(skins.normalize({[key]:max+1000})[key],max);
  const inside=min+(max-min)/2+.25;
  assert.equal(skins.normalize({[key]:String(inside)})[key],inside);
  assert.equal(skins.normalize({[key]:'  '+inside+'  '})[key],inside);
  assert.equal(skins.normalize({[key]:inside})[key],inside);
 }
});

test('invalid and nonfinite numbers fall back without coercing objects or booleans',()=>{
 const object={valueOf(){assert.fail('Numeric objects must not be coerced');},toString(){assert.fail('Numeric objects must not be stringified');}};
 for(const [key,[,,fallback]] of Object.entries(numeric)){
  for(const value of [undefined,null,true,false,[],[100],{},object,NaN,Infinity,-Infinity,'Infinity','-Infinity','1e999','',' ','100px','calc(100% - 1px)','1;position:fixed']){
   assert.equal(skins.normalize({[key]:value})[key],fallback,key+' rejects invalid input');
  }
 }
});

test('boolean, alignment, layout and music enums preserve only documented choices',()=>{
 assert.equal(skins.normalize({showArtwork:false}).showArtwork,false);
 for(const value of [undefined,null,0,1,'false',{},[]])assert.equal(skins.normalize({showArtwork:value}).showArtwork,true);
 for(const layout of ['classic','wide','reverse','stacked'])assert.equal(skins.normalize({layout}).layout,layout);
 for(const textAlign of ['left','center','right'])assert.equal(skins.normalize({textAlign}).textAlign,textAlign);
 for(const musicPosition of ['auto','top','bottom'])assert.equal(skins.normalize({musicPosition}).musicPosition,musicPosition);
 for(const value of ['url(https://evil.invalid)', 'right;position:fixed',{},null]){
  const result=skins.normalize({layout:value,textAlign:value,musicPosition:value});
  assert.equal(result.layout,'classic');assert.equal(result.textAlign,'left');assert.equal(result.musicPosition,'auto');
 }
});

test('custom names are bounded text and cannot inject any generated CSS',()=>{
 assert.equal(skins.normalize({customName:'x'.repeat(90)}).customName,'x'.repeat(40));
 for(const customName of [null,17,{},['name']])assert.equal(skins.normalize({customName}).customName,'');
 const malicious='</style><script>x</script> */ url(x);';
 const encoded=skins.encode({customName:malicious});
 assert.equal(skins.read(encoded).settings.customName,malicious);
 assert.ok(!encoded.includes('</style>'));assert.ok(!encoded.includes('*/ url'));
 assert.deepEqual(skins.tokens({customName:malicious}),skins.tokens({}));
 assert.equal(skins.inline({customName:malicious}),skins.inline({}));
 const malformed='a'.repeat(39)+'🌺'+'\ud800';
 assert.doesNotThrow(()=>skins.encode({customName:malformed}));
 assert.equal(skins.normalize({customName:malformed}).customName,'a'.repeat(39));
});

test('font tokens come from six fixed local stacks and never accept font URLs or CSS',()=>{
 assert.deepEqual(skins.fonts,['rounded','serif','mono','sans','display','handwritten']);
 const tokens=skins.fonts.map(font=>skins.tokens({font})['--bv-font']);
 assert.equal(new Set(tokens).size,6);
 for(const value of tokens)assert.ok(!/url\s*\(|@import|[;{}\n]/i.test(value));
 for(const font of ['https://evil.invalid/font.woff2','url(x)','sans; color:red',{},null]){
  assert.equal(skins.normalize({id:'lagoon',font}).font,skins.presets.find(p=>p.id==='lagoon').font);
  assert.equal(skins.tokens({id:'lagoon',font})['--bv-font'],skins.tokens({id:'lagoon'})['--bv-font']);
 }
 assert.equal(skins.tokens({font:'serif'})['--bv-font'],'Georgia, serif');
 assert.equal(skins.tokens({font:'mono'})['--bv-font'],'ui-monospace, monospace');
});

test('size and placement tokens expose normalized units and negative cover shifts',()=>{
 const tokens=skins.tokens({textScale:'125',headingScale:140,coverHeight:'320',coverX:25,coverY:75,textAlign:'center'});
 assert.equal(tokens['--bv-text-scale'],'1.25');assert.equal(tokens['--bv-heading-scale'],'1.4');
 assert.equal(tokens['--bv-cover-height'],'320px');assert.equal(tokens['--bv-cover-x'],'25%');assert.equal(tokens['--bv-cover-y'],'75%');
 assert.equal(tokens['--bv-cover-shift-x'],'-25%');assert.equal(tokens['--bv-cover-shift-y'],'-75%');assert.equal(tokens['--bv-text-align'],'center');
 const normal=skins.tokens({});assert.equal(normal['--bv-cover-shift-x'],'0%');assert.equal(normal['--bv-cover-shift-y'],'-100%');
});

test('hiding artwork yields none for both cover and page art, never a fallback motif',()=>{
 for(const preset of skins.presets){
  const visible=skins.tokens({id:preset.id}),hidden=skins.tokens({id:preset.id,showArtwork:false,pattern:'waves'});
  assert.equal(hidden['--bv-hero'],'none');assert.equal(hidden['--bv-art'],'none');
  assert.equal(hidden['--bv-border'],visible['--bv-border']);
  assert.ok(hidden['--bv-pattern']);
 }
});

function maximumForm(unicode=false){
 const uuid='00000000-0000-4000-8000-000000000001',char=unicode?'🌺':'x',url='https://example.invalid/'+'x'.repeat(292)+'.mp3';
 return skins.normalize({id:'occasion-school-reunion',customName:char.repeat(40),showArtwork:false,note:char.repeat(80),interests:char.repeat(160),trackTitle:char.repeat(80),
  trackUrl:url,trackPath:uuid+'/music/'+uuid+'.mp3',coverPath:uuid+'/covers/'+uuid+'.webp',avatarPath:uuid+'/covers/'+uuid+'.webp',songRef:'music-knox:0',
  font:'handwritten',textScale:140,headingScale:150,coverHeight:420,coverX:100,coverY:0,textAlign:'center',layout:'stacked',musicPosition:'bottom',atmosphere:'bubbles',motionEnergy:'calm'});
}
test('maximum ordinary normalized form fits the existing 4000-character v1 budget',()=>{
 for(const unicode of [false,true]){
  const normalized=maximumForm(unicode),encoded=skins.encode(normalized);
  assert.ok(encoded.length<=4000,'normalized maximum form must remain saveable');
  assert.deepEqual(skins.read(encoded).settings,normalized);
  const legacy='x'.repeat(4000-encoded.length);
  assert.equal(skins.encode(normalized,legacy).length,4000);
  assert.throws(()=>skins.encode(normalized,legacy+'x'),/too long/);
 }
});

test('pathological maximum encoded Unicode fails explicitly without truncating user content or raising the cap',()=>{
 const raw=maximumForm();
 raw.customName='\uffff'.repeat(40);raw.note='\uffff'.repeat(80);raw.interests='\uffff'.repeat(160);raw.trackTitle='\uffff'.repeat(80);
 const base='https://example.invalid/';raw.trackUrl=base+'%'.repeat(320-base.length-4)+'.mp3';
 const normalized=skins.normalize(raw);
 assert.equal(normalized.customName,raw.customName);assert.equal(normalized.note,raw.note);assert.equal(normalized.interests,raw.interests);assert.equal(normalized.trackUrl.length,320);
 assert.throws(()=>skins.encode(normalized),/Skin settings are too long/);
 assert.deepEqual(normalized,skins.normalize(raw));
});

test('motion wallpaper settings are bounded and survive a skin round-trip',()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const n=skins.normalize({motionPath:owner+'/covers/55555555-5555-4555-8555-555555555555.webp',motionStyle:'glitch',motionVariant:9,motionIntensity:7,motionFocusX:-1,motionFocusY:2});
 assert.deepEqual([n.motionStyle,n.motionVariant,n.motionIntensity,n.motionFocusX,n.motionFocusY],['glitch',2,1.8,0,1]);
 assert.equal(skins.normalize({motionPath:'https://evil.example/x.webp',motionStyle:'nope'}).motionPath,'');
 assert.equal(skins.normalize({motionStyle:'nope'}).motionStyle,'');
 assert.deepEqual(skins.read(skins.encode(n)).settings,n);
});
