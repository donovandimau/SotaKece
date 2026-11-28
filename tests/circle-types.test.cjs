'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const circles=require('../circle-types.js');
const skins=require('../skins.js');

const expected=[
  ['kava','Digital Kava Session','grog'],
  ['tale','Sota Tale Circle','studio-ocean'],
  ['kakase','Kakase Circle','kula'],
  ['lotu','Lotu Circle','masi-white'],
  ['koro','Village Circle','village'],
  ['mataqali','Mataqali Circle','core-masi'],
  ['school','School Circle','varsity'],
  ['old-boys','Old Boys Circle','occasion-school-reunion'],
  ['old-girls','Old Girls Circle','occasion-school-reunion'],
  ['family','Family Circle','occasion-family-reunion'],
  ['music','Music / Sigidrigi Circle','sigidrigi'],
  ['other','Other Circle','lagoon']
];
const legacyAccents={kava:'#efc187',tale:'#6de6dd',kakase:'#b52b50',lotu:'#756035',koro:'#246347',mataqali:'#7a412c',school:'#8f2d40','old-boys':'#875016','old-girls':'#875016',family:'#246347',music:'#c4b7fc',other:'#086779'};

test('circle types retain the requested labels, stable IDs and existing skin mappings',()=>{
  assert.deepEqual(circles.types.map(type=>[type.id,type.label,type.skin]),expected);
  assert.equal(new Set(circles.types.map(type=>type.id)).size,expected.length);
  assert.equal(skins.presets.length,94,'validate against the actual saved catalogue');
  for(const type of circles.types){
    const preset=skins.presets.find(preset=>preset.id===type.skin);
    assert(preset,`existing preset for ${type.id}`);
    assert.equal(type.accent,legacyAccents[type.id],`stable server metadata accent for ${type.id}`);
    assert.equal(type.displayAccent,preset.accent,`current presentation accent for ${type.id}`);
    assert.match(type.accent,/^#[0-9a-f]{6}$/);
    assert.equal(typeof type.emoji,'string');assert(type.emoji.length>0);
  }
  assert.equal(circles.requireType('school').skin,'varsity','school default claims no specific affiliation');
});

test('catalogue records and public configuration cannot be changed by callers',()=>{
  assert(Object.isFrozen(circles));assert(Object.isFrozen(circles.types));
  for(const type of circles.types)assert(Object.isFrozen(type));
  assert.throws(()=>circles.types.push({id:'unexpected'}),TypeError);
  assert.throws(()=>{circles.get('koro').skin='school-ratu-kadavulevu-school';},TypeError);
  assert.throws(()=>{circles.types=[];},TypeError);
  assert.equal(circles.get('koro').skin,'village');
});

test('lookup fallback is distinct from strict validation of saved or submitted types',()=>{
  const fallback=circles.requireType('koro');
  for(const id of [undefined,null,'','unknown','__proto__','constructor',{},'KORO']){
    assert.equal(circles.get(id),fallback);
    assert.throws(()=>circles.requireType(id),{name:'RangeError',message:'Unknown circle type.'});
  }
  for(const type of circles.types){assert.equal(circles.get(type.id),type);assert.equal(circles.requireType(type.id),type);}
});

test('select options contain only catalogue labels and exactly one selected known type',()=>{
  for(const selected of circles.types.map(type=>type.id)){
    const html=circles.options(selected);
    assert.equal((html.match(/<option /g)||[]).length,expected.length);
    assert.equal((html.match(/ selected/g)||[]).length,1);
    assert(html.includes(`<option value="${selected}" selected>`));
    for(const [id,label] of expected)assert(html.includes(`>${label}</option>`),`${id} label`);
  }
  assert.equal(circles.options(),circles.options('koro'));
  const html=circles.options('\"><img src=x onerror=alert(1)>');
  assert.equal(html,circles.options('koro'));
  assert(!html.includes('<img'));assert(!html.includes('onerror'));
});

test('themes use only BulaSkins.normalize id input and never mutate profiles or presets',()=>{
  const profile={room_css:'private saved CSS',room_accent:'#123456',display_name:'Private name'};
  const beforeProfile=structuredClone(profile),beforePresets=structuredClone(skins.presets);
  for(const type of circles.types){
    const inputs=[];
    const adapter={normalize(input){inputs.push(input);return skins.normalize(input);},profile};
    const settings=circles.theme(type.id,adapter);
    assert.deepEqual(inputs,[{id:type.skin}]);
    assert.deepEqual(settings,skins.normalize({id:type.skin}));
    assert.equal(settings.id,type.skin);
    assert.equal(settings.trackUrl,'');assert.equal(settings.trackPath,'');assert.equal(settings.coverPath,'');
    settings.accent='#000000';settings.note='A caller may edit its own settings';
    assert.notEqual(circles.theme(type.id,skins).accent,settings.accent);
  }
  assert.deepEqual(profile,beforeProfile);assert.deepEqual(skins.presets,beforePresets);
  assert.equal(circles.theme('unknown',skins).id,'village');
  assert.throws(()=>circles.theme('koro'),{name:'TypeError',message:'The skin catalogue is unavailable.'});
  assert.throws(()=>circles.theme('koro',{}),TypeError);
});

test('browser UMD exposes the same immutable helper without DOM, storage or network access',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../circle-types.js'),'utf8');
  const context=vm.createContext({BulaSkins:skins});
  context.window=context;
  vm.runInContext(source,context,{filename:'circle-types.js'});
  const browser=context.window.SotaCircleTypes;
  assert(browser);assert(Object.isFrozen(browser));assert(Object.isFrozen(browser.types));
  assert.deepEqual(JSON.parse(JSON.stringify(browser.types)),circles.types);
  assert.equal(browser.get('unknown').id,'koro');
  assert.equal(browser.theme('school',{normalize:input=>input}).id,'varsity');
});

test('browser helper retains safe legacy defaults without the optional skin catalogue',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../circle-types.js'),'utf8');
  for(const BulaSkins of [undefined,{presets:[]},{presets:[{id:'grog',accent:'red;position:fixed'}]}]){
    const context=vm.createContext({BulaSkins});vm.runInContext(source,context);
    const browser=context.SotaCircleTypes;assert.equal(browser.types.length,12);assert.equal(browser.get('kava').skin,'grog');assert.equal(browser.get('kava').accent,'#efc187');assert.equal(browser.get('kava').displayAccent,'#efc187');assert(Object.isFrozen(browser.get('kava')));
  }
});
