/* Exercise the shipped guest Music page with real decoded audio, offline and without an account.
   Run with Playwright installed: node tests/tools/check-music-displays.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright-core');
const root = path.resolve(__dirname, '../..');
const types = {'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html',
  '.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.json':'application/json'};
function tone() {
  const rate = 8000, seconds = 60, data = rate * seconds * 2;
  const wav = Buffer.alloc(44 + data);
  wav.write('RIFF'); wav.writeUInt32LE(36 + data, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(data, 40);
  for (let i = 0; i < rate * seconds; i++) wav.writeInt16LE(Math.round((i < rate*20 ? 800 : 6400) * Math.sin(i * 2 * Math.PI * 230 / rate)), 44 + i * 2);
  return wav;
}
async function check(browser,width) {
  const page = await browser.newPage({viewport:{width,height:844},hasTouch:width===390,serviceWorkers:'block',reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror',e=>errors.push(e.message));
  const wav = tone();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if(url.pathname==='/assets/music-waveforms.json')return route.fulfill({json:{}});
    if (url.hostname === 'sota.test') {
      const file = path.resolve(root,'.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
      if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile())
        return route.fulfill({path:file,contentType:types[path.extname(file)]});
    }
    if (url.pathname.startsWith('/storage/v1/object/public/fiji-audio/')) {
      const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
      const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]),wav.length-1) : wav.length-1;
      const headers = {'Access-Control-Allow-Origin':'*','Accept-Ranges':'bytes','Content-Length':String(end-start+1)};
      if (range) headers['Content-Range']='bytes '+start+'-'+end+'/'+wav.length;
      return route.fulfill({status:range?206:200,body:wav.subarray(start,end+1),contentType:'audio/wav',headers});
    }
    return route.fulfill({status:404,body:''});
  });
  await page.goto('https://sota.test/#music');
  const stage = page.locator('.sk-display-stage');
  await stage.waitFor();
  await page.locator('.sk-display-stage .sk-deck-play').click();
  await page.waitForFunction(()=>document.querySelector('#sota-playlist-audio')?.currentTime > 0.1);
  await page.evaluate(()=>{window.testPlayer=document.querySelector('#sota-playlist-audio');window.testSrc=window.testPlayer.currentSrc;});
  async function select(id) {
    await stage.getByRole('button',{name:'Displays',exact:true}).click();
    await page.locator('.sk-display-choice[data-layout="'+id+'"]').click();
    assert.equal(await stage.getAttribute('data-layout'),id);
  }
  async function capture(id) {
    if (!process.env.MUSIC_REVIEW_DIR) return;
    fs.mkdirSync(process.env.MUSIC_REVIEW_DIR,{recursive:true});
    await stage.screenshot({path:path.join(process.env.MUSIC_REVIEW_DIR,width+'-'+id+'.png')});
    if(width===390)await stage.locator('.sk-display-visual').screenshot({path:path.join(process.env.MUSIC_REVIEW_DIR,'art-'+id+'.png')});
  }
  // Both cover sources must replace the typographic fallback on the actual rendered node.
  const art=await page.evaluate(async()=>{
    const {sleeve}=await import('/music-sleeves.mjs?v=1');
    const cover=document.createElement('canvas');cover.width=cover.height=4;
    const ctx=cover.getContext('2d');ctx.fillStyle='#54aa75';ctx.fillRect(0,0,4,4);
    const png=new Uint8Array(await (await new Promise(resolve=>cover.toBlob(resolve))).arrayBuffer());
    const picture=new Uint8Array([0,...new TextEncoder().encode('image/png'),0,3,0,...png]);
    const word=new Uint8Array(4);new DataView(word.buffer).setUint32(0,picture.length);
    const frame=new Uint8Array([...new TextEncoder().encode('APIC'),...word,0,0,...picture]);
    const header=new Uint8Array([73,68,51,3,0,0,0,0,frame.length>>7,frame.length&127]);
    const node=document.createElement('span');
    sleeve(node,{key:'dev:art-test',title:'Cover check',blob:new Blob([header,frame])});
    const initial=node.style.getPropertyValue('--photo');
    for(let i=0;i<60&&node.style.getPropertyValue('--photo')===initial;i++)await new Promise(r=>setTimeout(r,15));
    const embedded=node.style.getPropertyValue('--photo')!==initial;
    const artUrl=location.origin+'/assets/music-instruments/wings.webp';
    sleeve(node,{key:'mix:cover-test',title:'Published art',artworkUrl:artUrl});
    for(let i=0;i<60&&!node.style.getPropertyValue('--photo').includes(artUrl);i++)await new Promise(r=>setTimeout(r,15));
    return {embedded,listed:node.style.getPropertyValue('--photo').includes(artUrl)};
  });
  assert.deepEqual(art,{embedded:true,listed:true});
  const position = () => page.evaluate(()=>window.testPlayer.currentTime);
  for (const id of ['wings','arc','studio','glass','wave']) {
    const before = await position();
    await select(id);
    assert(await page.evaluate(()=>document.querySelector('#sota-playlist-audio')===window.testPlayer &&
      !window.testPlayer.paused && window.testPlayer.currentSrc===window.testSrc));
    assert(await position() >= before);
    assert(await stage.locator('.sk-display-title').isVisible(), 'track title is visible in '+id);
    if (id==='wings') {
      await page.waitForFunction(()=>window.DimauMusicVisuals.sample(window.testPlayer)?.frequency.some(v=>v>10));
      assert(await stage.locator('.sk-display-queue-item').count()>0);
      await stage.getByRole('button',{name:'Bass',exact:true}).click();
      assert.equal(await stage.getByRole('button',{name:'Bass',exact:true}).getAttribute('aria-pressed'),'true');
      await stage.getByRole('button',{name:'Full',exact:true}).click();
      await stage.getByRole('button',{name:'Expand player'}).click();
      assert(await page.locator('.sk-display-theatre[open] .sk-display-stage').count());
      await page.keyboard.press('Escape');
      await stage.getByRole('button',{name:'Expand player'}).waitFor();
    }
    if (id==='arc') {
      await stage.getByRole('slider',{name:'Seek through song'}).press('ArrowRight');
      assert(await position() >= before+4.9);
      const box = await stage.locator('.sk-display-arc').boundingBox();
      await stage.locator('.sk-display-arc[data-wave="ready"]').waitFor();
      assert((await stage.locator('.arc-wave').getAttribute('d')).length>1000);
      await page.mouse.click(box.x+box.width/2,box.y+box.height*0.06);
      assert(Math.abs(await position()-30)<2);
      await page.mouse.move(box.x+box.width*.5,box.y+box.height*.06);await page.mouse.down();
      assert.match(await stage.locator('.sk-dial-readout small').innerText(),/4×/);
      await page.mouse.move(box.x+box.width*.7,box.y+box.height*.06,{steps:6});await page.mouse.up();
      assert(Math.abs(await position()-33)<1.3,'one fifth of the dial at 4× advances three seconds');
    }
    if (id==='studio') {
      const chart=await stage.locator('.sk-display-field').boundingBox();
      await page.mouse.click(chart.x+chart.width*.08,chart.y+chart.height*.34);
      assert(Number(await stage.getByRole('slider',{name:'60 Hz gain',exact:true}).inputValue())>0);
      await stage.getByRole('slider',{name:'60 Hz gain',exact:true}).fill('6');
      await page.waitForFunction(()=>Math.abs(window.DimauMusicVisuals.sample(window.testPlayer).filters[0].gain.value-6)<0.1);
      await stage.getByRole('button',{name:'Spectrogram',exact:true}).click();
      await stage.locator('.sk-display-field').scrollIntoViewIfNeeded();
      const scan=await stage.locator('.sk-display-field').boundingBox();
      await stage.locator('.sk-display-field').click({position:{x:Math.floor(scan.width*.48),y:Math.floor(scan.height*.808)}});
      await page.waitForFunction(()=>document.querySelector('.sk-display-chart-label')?.textContent.includes('s ago'));
      await stage.getByRole('button',{name:'EQ curve',exact:true}).click();
    }
    if (id==='glass') {
      assert.equal(await stage.getByRole('slider',{name:'Bass gain'}).inputValue(),'6');
      const pad=await stage.locator('.sk-display-field').boundingBox();
      await page.mouse.click(pad.x+pad.width*.72,pad.y+pad.height*.35);
      assert(Number(await stage.getByRole('slider',{name:'Treble gain'}).inputValue())>0);
      await page.waitForFunction(()=>window.DimauMusicVisuals.sample(window.testPlayer).filters[4].gain.value>1);
    }
    if (id==='wave') {
      const original=await stage.locator('.sk-wave-nav b').innerText();
      const firstArt=await stage.locator('.sk-wave-cover[aria-current="true"]').evaluate(n=>n.style.getPropertyValue('--photo'));
      await stage.getByRole('button',{name:'Next sleeve'}).click();
      assert.notEqual(await stage.locator('.sk-wave-nav b').innerText(),original);
      const nextArt=await stage.locator('.sk-wave-cover[aria-current="true"]').evaluate(n=>n.style.getPropertyValue('--photo'));
      assert.notEqual(firstArt,nextArt,'upcoming songs have individual sleeves');
      assert(await page.evaluate(()=>!window.testPlayer.paused&&window.testPlayer.currentSrc===window.testSrc));
      await stage.getByRole('button',{name:'Previous sleeve'}).click();
      const fan=stage.locator('.sk-wave-fan');await fan.scrollIntoViewIfNeeded();
      const b=await fan.boundingBox(),y=b.y+b.height*.45;
      if(width===390){
        const cdp=await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width*.7,y}]});
        for(let step=1;step<=10;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:b.x+b.width*(.7-step*.047),y}]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
      }else{
        await page.mouse.move(b.x+b.width*.7,y);await page.mouse.down();
        await page.mouse.move(b.x+b.width*.23,y,{steps:12});await page.mouse.up();
      }
      assert.notEqual(await stage.locator('.sk-wave-nav b').innerText(),original);
      assert(await page.evaluate(()=>!window.testPlayer.paused&&window.testPlayer.currentSrc===window.testSrc));
      await stage.getByRole('button',{name:'Switch to low perspective'}).click();
      await stage.getByRole('button',{name:'Switch to high perspective'}).click();
    }
    assert(await stage.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'stage width at '+width+': '+id);
    await capture(id);
  }
  const chosen=await stage.locator('.sk-wave-nav b').innerText();
  await stage.locator('.sk-wave-cover[aria-current="true"]').click();
  await page.waitForFunction(()=>window.testPlayer.currentSrc !== window.testSrc);
  assert.equal(await stage.locator('.sk-display-title').innerText(),chosen);
  await select('studio');
  await stage.getByRole('button',{name:'Reset to flat'}).click();
  await page.waitForFunction(()=>window.DimauMusicVisuals.sample(window.testPlayer).filters.every(f=>Math.abs(f.gain.value)<0.1));
  await stage.locator('.sk-deck-play').click();
  await select('arc');
  assert(await page.evaluate(()=>window.testPlayer.paused));
  await page.reload();
  await stage.waitFor();
  assert.equal(await stage.getAttribute('data-layout'),'arc');
  await stage.getByRole('button',{name:'Displays',exact:true}).click();
  await page.keyboard.press('Escape');
  assert(await stage.getByRole('button',{name:'Displays',exact:true}).evaluate(n=>document.activeElement===n));
  await page.goto('https://sota.test/?music-display=glass#music');
  await page.locator('.sk-display-theatre[open] [data-layout="glass"].sk-display-stage').waitFor();
  assert(await page.locator('#sota-playlist-audio').evaluate(audio=>audio.paused));
  await select('wave');
  assert(await page.locator('.sk-display-theatre[open] .sk-display-stage').isVisible());
  await page.keyboard.press('Escape');
  await stage.getByRole('button',{name:'Expand player'}).waitFor();
  assert.deepEqual(errors,[]);
  await page.close();
  console.log('Passed at '+width+'px: five layouts, playback continuity, real EQ, arc seek, queue navigation, keyboard and saved choice.');
}
(async()=>{
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || undefined});
  try { for(const width of [390,1440]) await check(browser,width); }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
