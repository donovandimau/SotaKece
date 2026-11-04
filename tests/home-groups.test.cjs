'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../skin-studio.js'),'utf8');
const start=source.indexOf('  function discoveryMarkup()');
const end=source.indexOf('  function originalCrop(',start);
assert(start>=0&&end>start,'extract the real discoveryMarkup function');
const markupSource=source.slice(start,end);
function render({count=94,discovery={},collections='<button type="button" data-collection="test-school">Test school collection</button>'}={}){
  const calls=[];
  const context=vm.createContext({skins:{presets:Array.from({length:count},(_,id)=>({id}))},discovery,
    collectionMarkup(...args){calls.push(args);if(!discovery)throw new Error('Unavailable discovery must not render collections');return collections;}
  });
  vm.runInContext(markupSource,context,{filename:'actual-discoveryMarkup.js'});
  return {html:context.discoveryMarkup(),calls};
}
function allButtons(html){
  return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].filter(match=>/\bclass="[^"]*\bbv-discovery-all\b[^"]*"/.test(match[1]));
}

test('the All skins action derives its count from the current catalogue',()=>{
  for(const count of [0,1,12,94,137]){
    const {html}=render({count});const buttons=allButtons(html);
    assert.equal(buttons.length,1);assert.match(buttons[0][1],/\btype="button"/);
    assert(buttons[0][2].includes(`Explore all ${count} skins`),'current catalogue count '+count);
  }
});

test('one skin section provides the existing anchor, heading and selected-skin label',()=>{
  const {html}=render();
  assert.equal((html.match(/\bid="bv-your-room"/g)||[]).length,1);
  assert.match(html,/<section\b[^>]*\bid="bv-your-room"[^>]*\btabindex="-1"[^>]*\baria-labelledby="bv-discovery-title"/);
  assert.equal((html.match(/\bid="bv-discovery-title"/g)||[]).length,1);
  assert.match(html,/<h2\b[^>]*\bid="bv-discovery-title"[^>]*>Make it yours\.<\/h2>/);
  assert.equal((html.match(/\bid="bv-welcome-skin-name"/g)||[]).length,1);
  assert.match(html,/<span\b[^>]*\bid="bv-welcome-skin-name"[^>]*><\/span>/);
  assert.equal(allButtons(html).length,1);
});

test('available discovery keeps the existing collection markup alongside the one All action',()=>{
  const collections='<button type="button" data-collection="school-pride">Existing school card</button><button type="button" data-collection="vanua-islands">Existing vanua card</button>';
  const {html,calls}=render({count:23,collections});
  assert.equal(calls.length,1);assert.equal(calls[0].length,0,'use normal collection cards rather than compact studio controls');
  assert(html.includes(collections));assert.match(html,/class="bv-collection-grid"/);
  assert.equal((html.match(/data-collection=/g)||[]).length,2);assert.equal(allButtons(html).length,1);
});

test('without discovery the anchor and native All action remain usable without reading collections',()=>{
  for(const discovery of [undefined,null,false]){
    // Passing undefined explicitly must not take render()'s default available dependency.
    const context=vm.createContext({skins:{presets:[{id:'first'},{id:'second'}]},discovery,
      collectionMarkup(){throw new Error('No discovery collection call is allowed');}
    });
    vm.runInContext(markupSource,context);const html=context.discoveryMarkup(),buttons=allButtons(html);
    assert.equal(buttons.length,1);assert.match(buttons[0][1],/\btype="button"/);assert(buttons[0][2].includes('Explore all 2 skins'));
    assert(html.includes('id="bv-your-room"'));assert(html.includes('id="bv-welcome-skin-name"'));assert(!html.includes('bv-collection-grid'));assert(!html.includes('data-collection='));
  }
});
