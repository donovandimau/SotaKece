'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch(_){}
test('Home gathers music, people and page choices into their own groups above Talanoa',{skip:!JSDOM},()=>{
  const dom=new JSDOM(`<div id="app" data-world-page="pulse"><main id="view"><section class="tw-wrap"><div id="tw-foot"><section class="tw-viti"><div class="tw-viti-block tw-viti-start"></div></section></div></section><section class="hub-card"></section><section class="sx-home-listen"></section><section class="sota-social-host"></section></main></div>`);
  global.window=dom.window;global.MutationObserver=dom.window.MutationObserver;
  const {arrange}=require('../sota-home-groups.js');const d=dom.window.document,app=d.getElementById('app');
  arrange(app);
  const g=k=>d.querySelector(`[data-sk-group="${k}"] .sk-group-body`);
  assert(g('music').querySelector('.sx-home-listen'));assert(g('music').querySelector('.tw-viti'));
  assert(g('people').querySelector('.hub-card'));
  assert.equal(d.querySelectorAll('[data-sk-group="yours"] [data-world-tool]').length,4);
  arrange(app);assert.equal(d.querySelectorAll('.sk-home-side').length,1,'running again does not duplicate');
  const v=d.querySelector('#view');assert.equal(v.lastElementChild.className,'tw-wrap','Talanoa sits at the foot of Home');assert.equal(d.querySelector('.sk-home-side').nextElementSibling,v.lastElementChild,'the groups sit just above Talanoa');
  app.dataset.worldPage='music';d.querySelector('#view').insertAdjacentHTML('beforeend','<section class="hub-card x"></section>');arrange(app);
  assert.equal(d.querySelector('.hub-card.x').parentNode.id,'view','other pages are left alone');
});
