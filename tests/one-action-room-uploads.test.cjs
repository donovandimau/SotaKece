'use strict';
// Home keeps one clear action, greets new and returning members differently,
// and Room Studio offers a private room song and cover upload (#379, #380, #381).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const worlds=read('sota-worlds.js'),css=read('sota-worlds.css'),studio=read('skin-studio.js');

test('heroes carry at most one primary action; Home has none because its composer is the starting point',()=>{
  assert.match(worlds,/class="sx-world-secondary sx-world-sere" data-world-sere="1"/);
  // 10 Nov 2026: the Home banner is a slim greeting. Voice and music still lead on Home, in the composer below it.
  assert.match(worlds,/pulse:\{[^}]*slim:true\}/);
  assert.doesNotMatch(worlds,/sereFirst/);
  assert.match(worlds,/function action\(w\)\{return w\.compact\|\|w\.slim\?'':/);
  assert.match(fs.readFileSync(path.join(__dirname,'..','sota-pulse.js'),'utf8'),/class="tw-make-main tw-sere-open" data-tw="sere"/);
  assert.match(css,/\.sx-world-secondary\{[^}]*background:transparent/);
});
test('the ideas menu is folded away on the page and stays plain in the directory',()=>{
  assert.match(worlds,/return inDirectory\?menu:`<details class="sx-world-more"\$\{current\?' open':''\}>/);
});
test('members are greeted as new or returning, and a known visitor is offered sign in first',()=>{
  assert.match(worlds,/Welcome back, \$\{name\}\./);
  assert.match(worlds,/Start with one small moment\./);
  assert.match(worlds,/if\(s\.page==='pulse'\)greet\(tools,state\);/);
  assert.match(worlds,/welcomeBack\(app\);/);
  assert.match(worlds,/primary\.dataset\.sxAuth='in'/);
});
test('Room Studio uploads a room song and cover privately, and keeps device music separate',()=>{
  assert.match(studio,/<input id="bv-room-track-upload" type="file" accept="\.mp3,\.m4a,\.ogg,\.opus,\.wav">/);
  assert.match(studio,/<input id="bv-cover-upload" type="file" accept="\.jpg,\.jpeg,\.png,\.webp">/);
  assert.doesNotMatch(studio,/Cover uploads are being prepared/);
  assert.match(studio,/onDevice=event\.target\.id==='bv-music-upload'/);
  assert.match(studio,/if\(onDevice\)\{/);
  assert.match(studio,/input\.disabled=false\);event\.target\.value=''/);
});
test('only one upload runs at a time, so Save cannot come back early',()=>{
  assert.equal((studio.match(/querySelectorAll\('input\[type=file\]'\)\.forEach\(input=>input\.disabled=true\)/g)||[]).length,2);
  assert.equal((studio.match(/querySelectorAll\('input\[type=file\]'\)\.forEach\(input=>input\.disabled=false\)/g)||[]).length,2);
});
