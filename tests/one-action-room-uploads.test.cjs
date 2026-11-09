'use strict';
// Home keeps one clear action, greets new and returning members differently,
// and Room Studio offers a private room song and cover upload (#379, #380, #381).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const worlds=read('sota-worlds.js'),css=read('sota-worlds.css'),studio=read('skin-studio.js');

test('the hero has one primary action; Sere is a quiet second choice',()=>{
  assert.match(worlds,/class="sx-world-secondary sx-world-sere" data-world-sere="1"/);
  assert.doesNotMatch(worlds,/sx-world-primary sx-world-sere/);
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
