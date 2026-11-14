'use strict';
// Older browsers (14 Nov 2026, Ops 1159). Live analytics logged "button.replaceChildren is not a function":
// Element.replaceChildren only exists from Safari 14 / Chrome 86. The page already needs optional chaining
// (Safari 13.1 / Chrome 80), so anything newer than that must not be called unguarded in shipped first-party JS.
// The /revised/ design preview is held for review and is not loaded by guests or members, so it is not scanned.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

const BANNED=[
  [/\.replaceChildren\s*\(/,'Element.replaceChildren (Safari 14, Chrome 86): use el.textContent=\'\' then el.append(...)'],
  [/\bstructuredClone\s*\(/,'structuredClone (Safari 15.4, Chrome 98)'],
  [/\bObject\.hasOwn\s*\(/,'Object.hasOwn (Safari 15.4, Chrome 93): use Object.prototype.hasOwnProperty.call'],
  [/\.replaceAll\s*\(/,'String.replaceAll (Chrome 85): use .replace(/x/g, ...)'],
  [/\.at\s*\(\s*-?\d/,'Array/String .at() (Safari 15.4, Chrome 92): use a[a.length-1]'],
  [/\.findLast(?:Index)?\s*\(/,'findLast (Safari 15.4, Chrome 97)'],
  [/(?:\?\?|\|\||&&)=(?!=)/,'logical assignment ??= ||= &&= (Safari 14, Chrome 85)'],
  [/randomUUID\s*\(/,'crypto.randomUUID (Safari 15.4, Chrome 92) unguarded: use a typeof-guarded uuid4() helper'],
];
// The one allowed form of randomUUID: inside a helper that checks it exists first.
const GUARDED_UUID=/typeof\s+[\w.]*randomUUID\s*===\s*'function'\s*\)\s*return\s+[\w.]*randomUUID\(\)/g;

function shippedFiles(){
  const out=[];
  for(const dir of ['.','sere','shared-music']){
    for(const name of fs.readdirSync(path.join(root,dir))){
      if(/\.(?:js|mjs|html)$/.test(name))out.push(path.posix.join(dir,name).replace(/^\.\//,''));
    }
  }
  return out;
}
function scripts(file,text){
  if(!file.endsWith('.html'))return text;
  // Inline scripts only (external first-party files are scanned on their own).
  return [...text.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
}
function problems(file,text){
  const found=[];
  scripts(file,text).replace(GUARDED_UUID,'').split('\n').forEach((line,i)=>{
    for(const [re,why] of BANNED)if(re.test(line))found.push(`${file}:${i+1}: ${why}`);
  });
  return found;
}

test('shipped first-party scripts avoid DOM/JS APIs older phones lack',()=>{
  const files=shippedFiles();
  for(const must of ['index.html','life-graph3d.js','sota-join-nudge.js','communications.js','music-playlist.js'])assert.ok(files.includes(must),must+' is scanned');
  const found=files.flatMap(f=>problems(f,fs.readFileSync(path.join(root,f),'utf8')));
  assert.deepEqual(found,[]);
});

test('the scanner catches each banned call',()=>{
  for(const bad of ["button.replaceChildren(caption);","host.replaceChildren();","x=structuredClone(y)","Object.hasOwn(o,'k')","s.replaceAll('-','')","a.at(-1)","a.findLast(f)","a??=1","id=crypto.randomUUID()"])
    assert.equal(problems('x.js',bad).length,1,bad);
  assert.deepEqual(problems('x.html','<script src="/a.js"></script><script>a.replaceChildren()</script>').length,1);
  assert.deepEqual(problems('x.js',"function uuid4(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();return 'x';}"),[]);
  assert.deepEqual(problems('x.js',"a!==b&&c===d;a||b"),[]);
});
