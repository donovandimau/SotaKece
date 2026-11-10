const test=require('node:test'),assert=require('node:assert'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function load(fine){
  const win={};const ctx={window:win,document:{addEventListener(){},documentElement:{addEventListener(){}}},matchMedia:()=>({matches:fine}),addEventListener(){}};
  win.addEventListener=()=>{};vm.runInNewContext(fs.readFileSync(path.join(root,'hover-lights.js'),'utf8'),ctx);return win.SotaHoverLights;
}
test('hover lights finds the whole word under the pointer',()=>{
  const api=load(false);
  assert.deepStrictEqual({...api.wordAt('Bula vinaka, Sota',6)},{start:5,end:12});
  assert.deepStrictEqual({...api.wordAt('Bula vinaka',4)},{start:0,end:4});
  assert.strictEqual(api.wordAt('a   b',2),null);
});
test('hover lights stays off without a mouse and gives neighbours different colours',()=>{
  const api=load(false);assert.strictEqual(api.active,false);
  const a={},b={};assert.notStrictEqual(api.colourFor(a),api.colourFor(b));assert.strictEqual(api.colourFor(a),api.colourFor(a));
  assert.ok(api.COLOURS.length>=8);
});
test('hover lights is loaded by the page and known to the offline worker',()=>{
  const page=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(page,/hover-lights\.js\?v=/);assert.match(page,/hover-lights\.css\?v=/);
  assert.ok(sw.includes("'/hover-lights.js'")&&sw.includes("'/hover-lights.css'"));
});
test('hover lights does not relight after the pointer has left the page',()=>{
  const src=fs.readFileSync(path.join(root,'hover-lights.js'),'utf8');
  assert.match(src,/function run\(\)\{queued=false;if\(!target\)return;/);
  assert.match(src,/function off\(\)\{target=null;/);
});
