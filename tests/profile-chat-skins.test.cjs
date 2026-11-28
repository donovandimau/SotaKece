const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const skins=require('../skins.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../skin-studio.js'),'utf8');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('new skins round-trip profile media and readable chat colours, including custom palettes',()=>{
  const ids=['studio-ocean','studio-masi','studio-coral','studio-retro'];
  assert.deepEqual(skins.presets.filter(p=>ids.includes(p.id)).map(p=>p.id),ids);
  for(const id of ids){
    const saved=skins.normalize({id,note:'My own story',interests:'Friends, music',trackTitle:'My recording',trackUrl:'https://example.org/song.mp3',layout:'wide'});
    assert.deepEqual(skins.read(skins.encode(saved)).settings,saved);
  }
  assert.equal(skins.normalize({id:'studio-retro'}).effect,'sticker');
  for(const p of skins.presets){
    for(const custom of [{},{accent:'#ffffee',panel:'#111111'},{accent:'#000011',panel:'#fff9f0'}]){
      const t=skins.tokens({id:p.id,...custom});
      assert(skins.contrast(t['--bv-chat-in'],t['--bv-chat-in-ink'])>=4.5,p.name+' incoming contrast');
      assert(skins.contrast(t['--bv-chat-out'],t['--bv-chat-out-ink'])>=4.5,p.name+' outgoing contrast');
    }
  }
});

test('chat sample escapes profile text and contains no live message form or remote request',()=>{
  const context=vm.createContext({skins,esc,window:{}});
  vm.runInContext(source.slice(source.indexOf('  function chatPreview('),source.indexOf('  function coverMediaMarkup(')),context);
  const html=context.chatPreview({display_name:'<img src=x onerror=alert(1)>'},{id:'studio-ocean'});
  assert(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert(!html.includes('<img'));
  assert(!/<form|<input|onclick|https?:/.test(html));
  assert(html.includes('disabled aria-label="Send (preview only)"'));
  assert(html.includes('class="msg mine"'));
});

test('Village uses its current owner skin and removes old tokens when changing screen',()=>{
  const classes=new Set(),styles=[];
  let activeStyle=null,hasMessages=true;
  const context=vm.createContext({skins,S:{me:{room_accent:'#046e86'}},stopSample(){},app:{classList:{remove(){}}},window:{},
    document:{body:{dataset:{},classList:{add:(...v)=>v.forEach(x=>classes.add(x)),remove:(...v)=>v.forEach(x=>classes.delete(x))}},
      querySelector:selector=>selector==='#msgs'?(hasMessages?{}:null):selector==='#bv-active-skin'?activeStyle:null,
      createElement:()=>({remove(){activeStyle=null;}}),head:{appendChild(style){activeStyle=style;styles.push(style);}},documentElement:{style:{setProperty(){}}}}});
  vm.runInContext(source.slice(source.indexOf('  function applyChat('),source.indexOf('  const originalShell=')),context);
  vm.runInContext(source.slice(source.indexOf('  function reset()'),source.indexOf('  function apply(profile')),context);
  context.applyChat({room_css:skins.encode({id:'studio-ocean'})});
  assert(classes.has('bv-chat-active'));
  assert(activeStyle.textContent.includes('--bv-chat-out:'+skins.presets.find(p=>p.id==='studio-ocean').accent));
  context.applyChat({room_css:skins.encode({id:'studio-coral'})});
  assert(activeStyle.textContent.includes('--bv-chat-out:'+skins.presets.find(p=>p.id==='studio-coral').accent));
  context.reset();assert.equal(activeStyle,null);assert.equal(classes.size,0);
  hasMessages=false;context.applyChat({room_css:skins.encode({id:'studio-retro'})});
  assert.equal(activeStyle,null);assert.equal(styles.length,2);
});
