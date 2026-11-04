/* Dimau Music Visuals v1 — original implementation, no runtime dependencies. */
(function(root){
  'use strict';
  if(root.DimauMusicVisuals)return;
  const graphs=new WeakMap();
  const modes=['spectrum','waveform','halo','ocean'];
  const palettes={rainbow:['#ff3048','#ff8a18','#ffe62e','#8ded24','#16e879','#00dce8','#1786ff','#6248ff','#b944ff','#ff38ca'],ocean:['#009cbe','#3458d4','#00b48b'],ember:['#d9480f','#de2474','#e4a100'],violet:['#8436d3','#146ecc','#d31b8d'],mono:['#456477','#748597','#243b53']};
  const abortError=signal=>signal?.reason||new DOMException('Cancelled','AbortError');
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  let context;
  function canAnalyse(audio){
    if(!audio)return false;
    const raw=audio.currentSrc||audio.getAttribute('src')||'';
    if(!raw)return true;
    try{const u=new URL(raw,root.location?.href||'https://localhost/');return u.protocol==='blob:'||u.protocol==='data:'||u.origin===root.location?.origin||audio.crossOrigin==='anonymous';}catch{return false;}
  }
  function audioGraph(audio){
    let graph=graphs.get(audio);if(graph)return graph;
    if(!canAnalyse(audio))throw Error('This source does not support visual analysis. Music can keep playing.');
    const C=root.AudioContext||root.webkitAudioContext;if(!C)throw Error('Audio visuals are unavailable in this browser. Music can keep playing.');
    if(!context||context.state==='closed')context=new C();
    const analyser=context.createAnalyser();analyser.fftSize=2048;analyser.smoothingTimeConstant=.78;
    const source=context.createMediaElementSource(audio);
    // One speaker route. Analysis and recording branch from the same source.
    source.connect(context.destination);source.connect(analyser);
    graph={context,source,analyser,frequency:new Uint8Array(analyser.frequencyBinCount),wave:new Uint8Array(analyser.fftSize)};
    graphs.set(audio,graph);return graph;
  }
  async function prepare(audio,{signal}={}){
    if(signal?.aborted)throw abortError(signal);
    if(!canAnalyse(audio))throw Error('This source does not support visual analysis. Music can keep playing.');
    const cached=graphs.get(audio);
    let captured=cached?.context||context;
    if(!captured||captured.state==='closed'&&!cached){
      const C=root.AudioContext||root.webkitAudioContext;
      if(!C)throw Error('Audio visuals are unavailable in this browser. Music can keep playing.');
      captured=context=new C();
    }
    if(typeof captured.resume!=='function')throw Error('Audio visuals are unavailable in this browser. Music can keep playing.');
    // Keep native audio untouched until its shared speaker context is running.
    await captured.resume();
    if(signal?.aborted)throw abortError(signal);
    if(captured.state!=='running')throw Error('Audio visuals could not start. Music can keep playing.');
    if(!canAnalyse(audio))throw Error('This source does not support visual analysis. Music can keep playing.');
    return graphs.get(audio)||audioGraph(audio);
  }
  function sample(audio){const g=graphs.get(audio);if(!g)return null;g.analyser.getByteFrequencyData(g.frequency);g.analyser.getByteTimeDomainData(g.wave);return g;}
  function bins(frequency,count,sampleRate=48000){
    const result=new Float32Array(count);if(!frequency?.length)return result;
    const nyquist=sampleRate/2,low=35,high=Math.min(16000,nyquist);
    for(let i=0;i<count;i++){
      const start=clamp(Math.floor(low*Math.pow(high/low,i/count)/nyquist*frequency.length),0,frequency.length-1);
      const end=clamp(Math.ceil(low*Math.pow(high/low,(i+1)/count)/nyquist*frequency.length),start+1,frequency.length);
      let value=0;for(let j=start;j<end;j++)value+=frequency[j]*frequency[j];
      result[i]=Math.sqrt(value/(end-start))/255;
    }return result;
  }
  // Schematic motion for an honest preview, independent of media or Web Audio.
  function previewSpectrum(timeMs=0,count=64){
    const time=Number.isFinite(timeMs)?timeMs/1000:0,result=new Float32Array(count);
    for(let i=0;i<count;i++){
      const x=i/Math.max(1,count-1),envelope=.25+.65*Math.pow(Math.sin(Math.PI*x),.6);
      result[i]=clamp(.12+envelope*(.52+.24*Math.sin(time*1.1+i*.31)+.12*Math.sin(time*1.9-i*.17)),.08,.9);
    }return result;
  }
  function draw(ctx,w,h,settings={},state={},data=null,background=true){
    const colours=palettes[settings.theme]||palettes.rainbow,mode=modes.includes(settings.mode)?settings.mode:'spectrum';
    const preview=!data&&(state.preview===true||Number.isFinite(state.previewTime)),time=Number.isFinite(state.previewTime)?state.previewTime/1000:0;
    if(state.previewActive!==preview){state.peaks=null;state.previewActive=preview;}
    const gain=clamp(Number(settings.gain)||1,.5,2),f=preview?previewSpectrum(state.previewTime,64):bins(data?.frequency,64,data?.context?.sampleRate),wave=data?.wave;
    const unit=Math.min(w,h),base=h*.79;ctx.save();
    if(background){
      const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#fff1b8');bg.addColorStop(.48,'#c8fff2');bg.addColorStop(1,'#f9d7f0');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
      const aura=ctx.createRadialGradient(w*.52,h*.4,0,w*.52,h*.4,w*.6);aura.addColorStop(0,colours[1]+'22');aura.addColorStop(1,colours[1]+'00');ctx.fillStyle=aura;ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='#194f6620';ctx.lineWidth=1;for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(w*.06,h*i/5);ctx.lineTo(w*.94,h*i/5);ctx.stroke();}
    }
    const gradient=ctx.createLinearGradient(w*.07,0,w*.93,0);colours.forEach((colour,i)=>gradient.addColorStop(i/(colours.length-1),colour));ctx.fillStyle=gradient;ctx.strokeStyle=gradient;
    if(mode==='spectrum'){
      if(!state.peaks)state.peaks=new Float32Array(64);
      for(let i=0;i<64;i++){
        const v=clamp(f[i]*gain,0,1),x=w*.07+i*w*.86/64,bw=Math.max(1,w*.86/64*.65),height=Math.max(1,v*h*.62);
        if(settings.vivid){ctx.shadowColor=colours[Math.min(colours.length-1,Math.floor(i/64*colours.length))];ctx.shadowBlur=Math.min(10,h*.035);}
        ctx.globalAlpha=settings.vivid?1:.8;ctx.fillRect(x,base-height,bw,height);ctx.globalAlpha=settings.vivid?.16:.1;ctx.fillRect(x,base+4,bw,height*.2);
        const decay=Number.isFinite(state.dt)?clamp(state.dt,0,100)/1000*.32:.012;
        state.peaks[i]=Math.max(v,state.peaks[i]-decay);ctx.globalAlpha=.9;ctx.fillStyle=colours[Math.min(colours.length-1,Math.floor(i/64*colours.length))];ctx.fillRect(x,base-state.peaks[i]*h*.62-3,bw,1.5);ctx.fillStyle=gradient;
      }
    }else if(mode==='halo'){
      const radius=unit*.22,cx=w/2,cy=h*.49;
      ctx.lineWidth=1;ctx.globalAlpha=.2;for(let ring=0;ring<3;ring++){ctx.beginPath();ctx.arc(cx,cy,radius-ring*5,0,Math.PI*2);ctx.stroke();}
      ctx.lineWidth=Math.max(1,unit*.008);ctx.globalAlpha=.95;
      for(let i=0;i<128;i++){const a=i/128*Math.PI*2-Math.PI/2+(preview?time*.16:0),v=f[i<64?i:127-i]*gain,r=radius+clamp(v,0,1)*unit*.2;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*radius,cy+Math.sin(a)*radius);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.stroke();}
      ctx.globalAlpha=.7;ctx.fillStyle=colours[2];ctx.font=`500 ${Math.max(10,unit*.045)}px system-ui`;ctx.textAlign='center';ctx.fillText('D I M A U',cx,cy+4);
    }else{
      const layers=mode==='ocean'?5:1;ctx.lineWidth=mode==='ocean'?1.4:2;
      for(let layer=0;layer<layers;layer++){
        ctx.globalAlpha=mode==='ocean'?.25+layer*.12:.95;ctx.beginPath();
        const points=Math.min(512,wave?.length||256);
        for(let i=0;i<points;i++){
          const x=w*.06+i/(points-1)*w*.88;
          const phase=i/(points-1)*Math.PI*2;
          const signal=wave?(wave[Math.floor(i/points*wave.length)]-128)/128:preview?Math.sin(phase*2.4-time*.9+layer*.45)*(.35+.15*Math.sin(time*1.2))+.18*Math.sin(phase*6.1+time*1.3+layer*.6):0;
          const y=h*.48+(layer-(layers-1)/2)*h*.045+signal*gain*h*(.27-layer*.028);
          if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }ctx.stroke();
      }
    }ctx.restore();
  }
async function finalizeWebmDuration(blob, durationSeconds, { signal } = {}) {
  if (!/webm/i.test(blob.type)) return blob;
  if (signal?.aborted) throw abortError(signal);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error('The video has no usable duration.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (signal?.aborted) throw abortError(signal);
  const invalid = () => new Error('This browser produced WebM metadata that could not be finalized safely. Try current Chrome or Edge.');
  const element = (offset, limit) => {
    if (offset >= limit || !bytes[offset]) throw invalid();
    let idLength = 1, marker = 0x80;
    while (!(bytes[offset] & marker)) { marker >>= 1; idLength++; }
    if (idLength > 4 || offset + idLength >= limit) throw invalid();
    let id = 0;
    for (let i = 0; i < idLength; i++) id = id * 256 + bytes[offset + i];
    const sizeOffset = offset + idLength;
    let sizeLength = 1;
    marker = 0x80;
    if (!bytes[sizeOffset]) throw invalid();
    while (!(bytes[sizeOffset] & marker)) { marker >>= 1; sizeLength++; }
    if (sizeLength > 8 || sizeOffset + sizeLength > limit) throw invalid();
    let value = BigInt(bytes[sizeOffset] & (marker - 1));
    for (let i = 1; i < sizeLength; i++) value = (value << 8n) | BigInt(bytes[sizeOffset + i]);
    const unknown = value === (1n << BigInt(sizeLength * 7)) - 1n;
    if (!unknown && value > BigInt(Number.MAX_SAFE_INTEGER)) throw invalid();
    const dataStart = sizeOffset + sizeLength;
    const size = unknown ? null : Number(value);
    const end = unknown ? limit : dataStart + size;
    if (end > limit || end < dataStart) throw invalid();
    return { id, offset, sizeOffset, sizeLength, dataStart, size, end };
  };
  const integer = (part) => {
    if (part.size === null || part.size > 8) throw invalid();
    let value = 0;
    for (let at = part.dataStart; at < part.end; at++) value = value * 256 + bytes[at];
    return value;
  };
  const sizeBytes = (value, minimumLength) => {
    let length = minimumLength;
    while (BigInt(value) >= (1n << BigInt(length * 7)) - 1n) length++;
    if (length > 8) throw invalid();
    const encoded = new Uint8Array(length);
    let remaining = BigInt(value);
    for (let i = length - 1; i >= 0; i--) { encoded[i] = Number(remaining & 255n); remaining >>= 8n; }
    encoded[0] |= 1 << (8 - length);
    return encoded;
  };
  let segment;
  for (let at = 0; at < bytes.length;) {
    const part = element(at, bytes.length);
    if (part.id === 0x18538067) { segment = part; break; }
    if (part.size === null) throw invalid();
    at = part.end;
  }
  if (!segment) throw invalid();
  let info;
  for (let at = segment.dataStart; at < segment.end;) {
    const part = element(at, segment.end);
    if (part.id === 0x1549A966) { info = part; break; }
    if (part.size === null) throw invalid();
    at = part.end;
  }
  if (!info || info.size === null) throw invalid();
  let scale = 1000000, durationElement, checksum = false;
  for (let at = info.dataStart; at < info.end;) {
    const part = element(at, info.end);
    if (part.size === null) throw invalid();
    if (part.id === 0x2AD7B1) scale = integer(part);
    if (part.id === 0x4489) durationElement = part;
    if (part.id === 0xBF) checksum = true;
    at = part.end;
  }
  if (!(scale > 0) || !Number.isFinite(scale)) throw invalid();
  if (durationElement) {
    const { dataStart, size } = durationElement;
    const view = new DataView(bytes.buffer);
    if (size !== 4 && size !== 8) throw invalid();
    const existing = size === 4 ? view.getFloat32(dataStart) : view.getFloat64(dataStart);
    if (Number.isFinite(existing) && existing > 0) return blob;
    if (checksum) throw invalid();
    const value = durationSeconds * 1000000000 / scale;
    if (size === 4) view.setFloat32(dataStart, value); else view.setFloat64(dataStart, value);
    return new Blob([bytes], { type: blob.type });
  }
  if (checksum) throw invalid();
  const levelOne = new Set([0x114D9B74, 0x1549A966, 0x1654AE6B, 0x1F43B675, 0x1C53BB6B, 0x1941A469, 0x1043A770, 0x1254C367]);
  for (let at = segment.dataStart; at < segment.end;) {
    const part = element(at, segment.end);
    if (part.id === 0x114D9B74 || part.id === 0x1C53BB6B || part.id === 0xBF) throw invalid();
    if (part.id === 0x1F43B675) {
      let childAt = part.dataStart;
      while (childAt < part.end) {
        const child = element(childAt, part.end);
        if (part.size === null && levelOne.has(child.id)) break;
        if (child.id === 0xA7 || child.size === null) throw invalid();
        childAt = child.end;
      }
      at = childAt;
    } else {
      if (part.size === null) throw invalid();
      at = part.end;
    }
  }
  const durationData = new Uint8Array(11);
  durationData.set([0x44, 0x89, 0x88]);
  new DataView(durationData.buffer).setFloat64(3, durationSeconds * 1000000000 / scale);
  const newInfoSize = sizeBytes(info.size + durationData.length, info.sizeLength);
  const delta = durationData.length + newInfoSize.length - info.sizeLength;
  const newSegmentSize = segment.size === null
    ? bytes.subarray(segment.sizeOffset, segment.dataStart)
    : sizeBytes(segment.size + delta, segment.sizeLength);
  return new Blob([
    bytes.subarray(0, segment.sizeOffset), newSegmentSize,
    bytes.subarray(segment.dataStart, info.sizeOffset), newInfoSize,
    bytes.subarray(info.dataStart, info.end), durationData, bytes.subarray(info.end),
  ], { type: blob.type });
}


  const controlSymbols={
    pause:'<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
    play:'<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    fullscreen:'<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M8 20H4v-4"/>',
    shrink:'<path d="M4 9h5V4M20 9h-5V4M15 20v-5h5M9 20v-5H4"/>',
    close:'<path d="m6.5 6.5 11 11M17.5 6.5l-11 11" stroke-width="3"/>',
    record:'<circle cx="12" cy="12" r="8.2" stroke-width="2"/><circle cx="12" cy="12" r="4.8" fill="currentColor" stroke="none"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
    download:'<path d="M12 4v11m-4-4 4 4 4-4M5 17v3h14v-3"/>'
  };
  function symbolControl(node,kind,label){
    // Keep the actual button and all its event listeners during state changes.
    let svg=node.querySelector('svg[data-control-symbol]'),text=node.querySelector('.control-label');
    if(!svg){svg=root.document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('data-control-symbol','');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','2.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');}
    if(!text){text=root.document.createElement('span');text.className='control-label';node.replaceChildren(svg,text);}
    if(svg.getAttribute('data-symbol-kind')!==kind){svg.innerHTML=controlSymbols[kind]||controlSymbols.play;svg.setAttribute('data-symbol-kind',kind);}
    text.textContent=label;node.classList.add('symbol-control');node.setAttribute('data-control-kind',kind);node.setAttribute('aria-label',label);node.title=label;
  }
  const css=`:host{display:block;min-width:0;max-width:100%;margin:14px 0;color:#17364c;font:13px/1.45 system-ui,sans-serif;color-scheme:light}*{box-sizing:border-box}.shell{border:2px solid #e82c87;background:linear-gradient(135deg,#fff1a8,#a6f6ed 56%,#ffc0df);border-radius:12px;overflow:hidden}.heading{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:13px 15px;border-bottom:1px solid #d2297b;background:linear-gradient(110deg,#ffcf45,#ff8dba 60%,#a6e6ff)}.heading strong{font-size:10px;letter-spacing:.18em;color:#24364b}.state{font-size:11px;color:#34435a}.stage{position:relative;background:linear-gradient(120deg,#fff1b8,#c8fff2,#f9d7f0)}.fullscreen-exit{display:grid;place-items:center;width:44px;height:44px;min-width:44px;min-height:44px;padding:0!important;border-radius:50%!important;font-size:26px!important}.heading>.state{margin-left:auto}canvas{display:block;width:100%;height:220px;object-fit:fill}.caption{position:absolute;bottom:10px;left:15px;right:15px;display:flex;justify-content:space-between;gap:10px;color:#34445b;font-size:9px;letter-spacing:.16em;pointer-events:none}.tools{background:linear-gradient(110deg,#eaffb7,#b5f7f2,#ffe0ec);display:flex;flex-wrap:wrap;align-items:end;gap:8px;padding:12px}label{display:flex;flex:1 1 90px;flex-direction:column;gap:4px;font-size:11px;color:#183f55}button,select,input{font:inherit}button,select{min-height:44px;border:1px solid #287887;border-radius:6px;color:#17364c;background:#fffdf4;padding:9px 10px;max-width:100%}button{cursor:pointer}.toggle{background:#ffcf45;border-color:#9f5700;font-weight:700}.fullscreen{background:#ffacd3;border-color:#a61a68}button:hover{background:#ffdb71}button:focus-visible,select:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #9e1472;outline-offset:3px}button[aria-pressed=true]{background:#ffdb71;border-color:#a12470}input[type=range]{width:100%;min-height:44px;accent-color:#d91b7f}button:disabled{opacity:.6;cursor:default}.note{padding:0 14px 12px;margin:0;color:#28485a;font-size:11px}a{color:#8e165f;display:inline-block;padding:8px;min-height:44px}[hidden]{display:none!important}:host([compact]) .tools,:host([compact]) .note{display:none!important}:host([compact]){margin:0}:host(:fullscreen){margin:0;background:linear-gradient(135deg,#ffe983,#73e4df,#ff9fce);padding:3vw;display:flex;align-items:center;justify-content:center}.shell:fullscreen{width:100%}:host(:fullscreen) .shell{width:min(1200px,100%)}:host(:fullscreen) canvas{height:60vh}:host(:fullscreen) .fullscreen-exit{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,env(safe-area-inset-right));z-index:50;background:#fffaf0;box-shadow:0 3px 18px #17364c55}@media(max-width:420px){canvas{height:185px}.tools{gap:6px;padding:10px}.tools>button{flex:1 1 110px}}@media(forced-colors:active){.shell,.heading,.tools,.stage{background:Canvas;color:CanvasText}.shell{border:1px solid CanvasText}button,select{background:ButtonFace;color:ButtonText;border:1px solid ButtonText}.heading strong,.state,.caption,label,.note{color:CanvasText}}
.control-label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0}
/* Chrome rims and coloured glass domes, with a distinct solid glyph per action. */
.symbol-control{--dome-light:#d4fffa;--dome-mid:#75d7cb;--dome-deep:#299493;--dome-glow:#d2fff3;position:relative;display:inline-grid;place-items:center;box-sizing:border-box;width:44px;height:44px;min-width:44px;min-height:44px;max-width:44px;flex:0 0 44px;padding:0!important;border:1px solid #d4e8ef!important;border-radius:50%!important;background:radial-gradient(ellipse at 50% 96%,color-mix(in srgb,var(--sota-unified-tint,var(--dome-glow)) 92%,transparent) 0%,transparent 39%),radial-gradient(ellipse at 44% 18%,#ffffff86 0%,transparent 53%),linear-gradient(150deg,color-mix(in srgb,var(--sota-unified-tint,var(--dome-light)) 82%,transparent) 1%,color-mix(in srgb,var(--sota-unified-tint,var(--dome-mid)) 76%,transparent) 48%,color-mix(in srgb,var(--sota-unified-tint,var(--dome-deep)) 78%,transparent) 78%,color-mix(in srgb,var(--sota-unified-tint,var(--dome-glow)) 90%,transparent))!important;color:#07151d!important;box-shadow:inset 0 2px 2px #fffffff0,inset 0 -4px 5px #14385245,inset 2px 0 3px #ffffff8c,inset -2px 0 3px #305c7340,0 3px 5px #19354942,0 0 0 1px #48627385;backdrop-filter:blur(10px) saturate(1.3);text-decoration:none;cursor:pointer;isolation:isolate}
.symbol-control::before{content:'';position:absolute;inset:-2px;padding:2px;border-radius:50%;background:conic-gradient(from -32deg,#344553 0deg,#faffff 30deg,#8eb8c8 64deg,#ffffff 96deg,#68778e 130deg,#dcecff 163deg,#ffffff 192deg,#8fbeb6 226deg,#fefaf1 258deg,#d0c0cc 290deg,#3f5668 322deg,#faffff 343deg,#344553);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;pointer-events:none;z-index:1}
.symbol-control::after{content:'';position:absolute;top:4px;left:8px;right:8px;height:8px;border-top:2px solid #ffffffed;border-radius:50% 50% 46% 46%;background:linear-gradient(170deg,#ffffffa1,#ffffff05);transform:rotate(-8deg);box-shadow:0 -1px 1px #ffffff69;pointer-events:none;z-index:2}
.symbol-control svg{position:relative;z-index:3;display:block;width:23px;height:23px;pointer-events:none;filter:drop-shadow(0 1px 0 #ffffff70)}
.symbol-control[data-control-kind=pause]{--dome-light:#c0fff1;--dome-mid:#57cdb9;--dome-deep:#299c94;--dome-glow:#a6ffde}
.symbol-control[data-control-kind=play]{--dome-light:#d4ffd1;--dome-mid:#88d383;--dome-deep:#4d9e64;--dome-glow:#e1ffc2}
.symbol-control[data-control-kind=fullscreen]{--dome-light:#c7d9ff;--dome-mid:#88b0e8;--dome-deep:#4c83bb;--dome-glow:#a7e5ff}
.symbol-control[data-control-kind=shrink]{--dome-light:#e8d7ff;--dome-mid:#b9a4eb;--dome-deep:#8e75bc;--dome-glow:#edc7ff}
.symbol-control[data-control-kind=close],.symbol-control[data-control-kind=record]{--dome-light:#ffd6cf;--dome-mid:#f39a91;--dome-deep:#c86463;--dome-glow:#ffcbb0}
.symbol-control[data-control-kind=stop]{--dome-light:#ffe5b7;--dome-mid:#f5bf6b;--dome-deep:#cb9145;--dome-glow:#ffed9e}
.symbol-control[data-control-kind=download]{--dome-light:#cffff4;--dome-mid:#82d8c2;--dome-deep:#449f93;--dome-glow:#baffdc}
.tools>.symbol-control{flex:0 0 44px;align-self:end}.symbol-control:hover{filter:brightness(1.06);box-shadow:inset 0 2px 2px #fff,inset 0 -4px 5px #14385245,0 4px 8px #19354959,0 0 0 1px #85aabc}.symbol-control[aria-pressed=true]{box-shadow:inset 0 2px 2px #fffffff0,inset 0 -4px 5px #14385245,0 3px 5px #19354942,0 0 0 1px #48627385,0 0 0 3px #67b7c035}.symbol-control:active{filter:brightness(.95);box-shadow:inset 0 2px 5px #17384f50,0 1px 3px #19354942,0 0 0 1px #48627385}.symbol-control:focus-visible{outline:3px solid #64349d;outline-offset:5px}.symbol-control:disabled{opacity:.45;cursor:default}:host(:fullscreen) .fullscreen-exit.symbol-control{box-shadow:inset 0 2px 2px #fffffff0,inset 0 -4px 5px #14385245,inset 2px 0 3px #ffffff8c,inset -2px 0 3px #305c7340,0 3px 5px #19354942,0 0 0 1px #48627385}
@media(prefers-reduced-transparency:reduce){.symbol-control{background:linear-gradient(145deg,var(--sota-unified-tint,var(--dome-light)),var(--sota-unified-tint,var(--dome-mid)) 58%,var(--sota-unified-tint,var(--dome-deep)))!important;backdrop-filter:none}}@media(forced-colors:active){.symbol-control{background:ButtonFace!important;color:ButtonText!important;border:1px solid ButtonText!important;box-shadow:none;backdrop-filter:none}.symbol-control::before,.symbol-control::after{display:none}.symbol-control svg{filter:none}.symbol-control:focus-visible{outline-color:Highlight}}
`;
  if(root.HTMLElement&&root.customElements){
    class Visualiser extends root.HTMLElement{
      constructor(){super();this.attachShadow({mode:'open'});this.settings={mode:'spectrum',theme:'rainbow',gain:1};this.enabled=true;this.userPaused=false;this.frame=0;this.visible=true;this.last=0;this.drawState={preview:true,previewTime:0};this.handlers=[];this.prepareRun=0;}
      connectedCallback(){
        if(this.built)return;this.built=true;
        try{const saved=JSON.parse(root.localStorage.getItem('dimau.music.visuals.v1')||'null');if(saved){if(modes.includes(saved.mode))this.settings.mode=saved.mode;if(palettes[saved.theme])this.settings.theme=saved.theme;this.settings.gain=clamp(Number(saved.gain)||1,.5,2);if(typeof saved.paused==='boolean')this.userPaused=saved.paused;}}catch{}
        this.shadowRoot.innerHTML=`<style>${css}</style><section class="shell" aria-label="Music visuals"><div class="heading"><strong>SOUND IN MOTION</strong><span class="state">Preview</span><button class="fullscreen-exit" type="button" aria-label="Exit fullscreen music visualiser" hidden>×</button></div><div class="stage"><canvas aria-label="Audio-reactive music visualiser" role="img"></canvas><div class="caption"><span>FREQUENCY / FORM</span><span>DIMAU MUSIC</span></div></div><div class="tools"><button class="toggle" type="button" aria-pressed="true">Pause visuals</button><label>Visual<select class="mode"><option value="spectrum">Spectrum</option><option value="waveform">Waveform</option><option value="halo">Halo</option><option value="ocean">Ocean waves</option></select></label><label>Colour<select class="theme"><option value="rainbow">Rainbow</option><option value="ocean">Ocean</option><option value="ember">Ember</option><option value="violet">Violet</option><option value="mono">Silver</option></select></label><label>Intensity<input class="gain" type="range" min="0.5" max="2" step="0.1" value="1"></label><button class="fullscreen" type="button">Fullscreen</button></div><p class="note" role="status">Animated preview. Play a song to follow your music.</p></section>`;
        const $=s=>this.shadowRoot.querySelector(s);this.$=$;this.canvas=$('canvas');this.ctx=this.canvas.getContext('2d');
        for(const key of ['mode','theme','gain']){const control=$('.'+key);control.value=this.settings[key];control.addEventListener('input',()=>{this.settings[key]=key==='gain'?Number(control.value):control.value;this.persist();this.changed();this.render();});}
        $('.toggle').addEventListener('click',()=>this.toggle());
        $('.fullscreen').addEventListener('click',async()=>{try{if(root.document.fullscreenElement===this)await root.document.exitFullscreen();else await this.requestFullscreen();}catch{this.note('Fullscreen is unavailable here. Use the player in its own tab.');}});
        $('.fullscreen-exit').addEventListener('click',async()=>{try{await root.document.exitFullscreen();$('.fullscreen').focus({preventScroll:true});}catch{this.note('Use Escape to exit fullscreen.');}});
        symbolControl($('.fullscreen-exit'),'close','Exit fullscreen music visualiser');
        const fullscreen=()=>{const active=root.document.fullscreenElement===this;$('.fullscreen-exit').hidden=!active;symbolControl($('.fullscreen'),active?'shrink':'fullscreen',active?'Exit fullscreen':'Fullscreen');};
        root.document.addEventListener('fullscreenchange',fullscreen);this.handlers.push(()=>root.document.removeEventListener('fullscreenchange',fullscreen));fullscreen();
        this.motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
        const motion=()=>{this.enabled=!this.userPaused&&!this.motion?.matches;if(!this.enabled){this.analysisController?.abort();this.finishRecording();}this.changed();this.wake();};
        this.enabled=!this.userPaused&&!this.motion?.matches;
        this.motion?.addEventListener('change',motion);this.handlers.push(()=>this.motion?.removeEventListener('change',motion));
        const visibility=()=>{if(root.document.hidden){if(this.recording)this.finishRecording();this.stop();}else this.wake();};root.document.addEventListener('visibilitychange',visibility);this.handlers.push(()=>root.document.removeEventListener('visibilitychange',visibility));
        this.resize=new root.ResizeObserver(()=>this.render());this.resize.observe(this);
        this.intersection=new root.IntersectionObserver(entries=>{this.visible=entries[0]?.isIntersecting!==false;this.wake();});this.intersection.observe(this);
        if(root.MutationObserver){this.modalObserver=new root.MutationObserver(changes=>{if(changes.some(change=>change.type==='attributes'||[...change.addedNodes,...change.removedNodes].some(node=>node.tagName==='DIALOG'||node.querySelector?.('dialog'))))this.wake();});this.modalObserver.observe(root.document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});}
        this.bind();this.changed();this.wake();
        if(this.hasAttribute('export'))this.addExport();
      }
      bind(){
        const audio=this._media||root.document.getElementById(this.getAttribute('for'));
        if(this.audio===audio&&this.bindingActive)return;this.analysisController?.abort();this.prepareRun++;this.unbind?.();this.audio=audio;this.bindingActive=!!audio;if(!audio)return;
        const wake=()=>this.wake();const play=()=>{this.wake();if(this.enabled)this.analyse();};
        const names=['pause','ended','emptied','loadedmetadata','error','playing','waiting','stalled'];names.forEach(n=>audio.addEventListener(n,wake));audio.addEventListener('play',play);
        this.unbind=()=>{names.forEach(n=>audio.removeEventListener(n,wake));audio.removeEventListener('play',play);};
      }
      set media(value){this._media=value;if(this.built){this.stop();this.bind();this.wake();}}
      note(text){this.$('.note').textContent=text;}
      changed(){if(!this.$)return;symbolControl(this.$('.toggle'),this.enabled?'pause':'play',this.enabled?'Pause visuals':'Resume visuals');this.$('.toggle').setAttribute('aria-pressed',String(this.enabled));this.dispatchEvent(new root.CustomEvent('visualchange',{detail:{...this.settings,enabled:this.enabled},bubbles:true}));}
      persist(){try{root.localStorage.setItem('dimau.music.visuals.v1',JSON.stringify({...this.settings,paused:this.userPaused}));}catch{}}
      async analyse(){
        const audio=this.audio;if(!this.enabled||!audio||audio.paused||audio.ended||audio.error||this.motion?.matches)return;
        this.analysisController?.abort();const run=++this.prepareRun,controller=root.AbortController?new root.AbortController():null;this.analysisController=controller;
        try{await prepare(audio,{signal:controller?.signal});if(run===this.prepareRun&&this.isConnected&&this.audio===audio&&this.enabled)this.wake();}
        catch(error){if(run===this.prepareRun&&!controller?.signal.aborted&&this.isConnected){this.wake();this.note('Animated preview · audio analysis is unavailable. Music keeps playing.');}}
      }
      async toggle(){
        if(this.recording){this.note('Finish the clip before pausing visuals.');return;}
        if(this.motion?.matches){this.note('Motion stays paused for your reduced-motion setting.');return;}
        this.userPaused=!this.userPaused;this.enabled=!this.userPaused&&!this.motion?.matches;
        if(!this.enabled)this.analysisController?.abort();
        this.persist();this.changed();this.wake();
        if(this.enabled&&this.audio&&!this.audio.paused)await this.analyse();
      }
      liveData(){
        if(!this.enabled||!this.audio||this.audio.paused||this.audio.ended||this.audio.error||this.audio.readyState<3)return null;
        const data=sample(this.audio);return data?.context.state==='running'?data:null;
      }
      blockedByModal(){
        let dialogs;try{dialogs=[...root.document.querySelectorAll('dialog:modal')];}catch{dialogs=[...root.document.querySelectorAll('dialog[open]:not(.sk-playlist-inline)')];}
        const active=root.document.activeElement?.closest?.('dialog'),modal=dialogs.includes(active)?active:dialogs[dialogs.length-1];return !!modal&&!modal.contains(this);
      }
      wake(){
        if(!this.built||!this.$)return;
        this.stop();if(this.audio?.paused||this.audio?.ended)this.analysisController?.abort();
        this.render();const data=this.liveData();this.lastLive=!!data;const active=this.enabled&&!this.motion?.matches&&!root.document.hidden&&this.visible&&this.getClientRects().length>0&&!this.blockedByModal()&&!!this.ctx;
        this.$('.state').textContent=this.motion?.matches?'Reduced motion':!this.enabled?'Motion paused':data?'LIVE AUDIO':'Preview';
        this.note(this.motion?.matches?'Static preview · your reduced-motion setting is respected.':!this.enabled?'Visuals paused. Music keeps playing.':data?'Following the sound from this player.':'Animated preview. Play a song to follow your music.');
        if(active)this.frame=root.requestAnimationFrame(t=>this.tick(t));
      }
      tick(time){
        this.frame=0;if(!this.isConnected||!this.enabled||this.motion?.matches||root.document.hidden||!this.visible||!this.getClientRects().length||this.blockedByModal()){this.wake();return;}
        const data=this.liveData();if(!!data!==this.lastLive){this.wake();return;}const fps=root.navigator?.connection?.saveData?(data?15:8):(data?30:20);
        if(time-this.last>=1000/fps){this.drawState.dt=clamp(time-this.last,0,100);this.last=time;this.drawState.previewTime+=this.drawState.dt;this.render();}
        this.frame=root.requestAnimationFrame(t=>this.tick(t));
      }
      render(){
        if(!this.ctx)return;
        const bounds=this.canvas.getBoundingClientRect(),ratio=Math.min(root.devicePixelRatio||1,2);
        const w=clamp(Math.round((bounds.width||600)*ratio),1,1920),h=clamp(Math.round((bounds.height||220)*ratio),1,1080);
        if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;
        const data=this.liveData();this.drawState.preview=!data;
        draw(this.ctx,w,h,this.settings,this.drawState,data);
      }
      stop(){if(this.frame)root.cancelAnimationFrame(this.frame);this.frame=0;}
      addExport(){
        const tools=this.shadowRoot.querySelector('.tools');const label=root.document.createElement('label');label.textContent='Clip length';const select=root.document.createElement('select');for(const n of [15,30,60]){const o=root.document.createElement('option');o.value=n;o.textContent=n+' seconds';select.append(o);}label.append(select);
        const button=root.document.createElement('button');button.type='button';symbolControl(button,'record','Record visual clip');
        const download=root.document.createElement('a');download.hidden=true;symbolControl(download,'download','Download WebM');download.download='dimau-music-visual.webm';
        tools.append(label,button,download);this.exportButton=button;this.download=download;
        button.addEventListener('click',()=>this.recording?this.finishRecording():this.record(Number(select.value)));
      }
      async record(seconds){
        if(!this.enabled||!this.audio||this.audio.paused||this.audio.ended||this.audio.error||this.audio.readyState<3){this.note('Enable visuals and play your music before recording.');return;}
        if(this.starting)return;
        if(!root.MediaRecorder||!this.canvas.captureStream){this.note('Clip recording is unavailable in this browser. Try current Chrome or Edge.');return;}
        this.starting=true;this.exportButton.disabled=true;
        let destination,canvasStream,stream,graph;
        try{
          graph=audioGraph(this.audio);await graph.context.resume();
          const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>root.MediaRecorder.isTypeSupported(t));if(!mime)throw Error('This browser cannot record WebM clips.');
          destination=graph.context.createMediaStreamDestination();graph.source.connect(destination);
          canvasStream=this.canvas.captureStream(30);stream=new root.MediaStream([...canvasStream.getVideoTracks(),...destination.stream.getAudioTracks()]);
          const recorder=new root.MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000});const chunks=[];
          let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;clearTimeout(this.recordTimer);graph.source.disconnect(destination);stream.getTracks().forEach(t=>t.stop());this.audio.removeEventListener('pause',this.finish);this.audio.removeEventListener('ended',this.finish);this.recording=null;symbolControl(this.exportButton,'record','Record visual clip');this.$('.toggle').disabled=false;};
          recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};let failed=false;
          recorder.onerror=()=>{failed=true;this.note('Recording failed. Try a shorter clip.');};
          recorder.onstop=async()=>{const duration=(root.performance.now()-started)/1000;cleanup();if(failed||!chunks.length){this.note('No clip was captured. Try again while music is playing.');return;}if(this.downloadUrl)root.URL.revokeObjectURL(this.downloadUrl);let blob;try{blob=await finalizeWebmDuration(new root.Blob(chunks,{type:mime}),duration);}catch(e){this.note('Clip finalisation failed: '+e.message);return;}if(!this.isConnected)return;this.downloadUrl=root.URL.createObjectURL(blob);this.download.href=this.downloadUrl;this.download.hidden=false;this.note('Your clip is ready, with audio. Download WebM.');};
          const started=root.performance.now();recorder.start(250);this.recording=recorder;this.finish=()=>this.finishRecording();this.audio.addEventListener('pause',this.finish);this.audio.addEventListener('ended',this.finish);
          this.recordTimer=setTimeout(this.finish,clamp(seconds,1,60)*1000);symbolControl(this.exportButton,'stop','Finish clip');this.$('.toggle').disabled=true;this.download.hidden=true;
          this.note('Recording picture and sound. Keep this tab visible; up to '+seconds+' seconds.');
        }catch(e){if(graph&&destination)try{graph.source.disconnect(destination);}catch{}stream?.getTracks().forEach(t=>t.stop());canvasStream?.getTracks().forEach(t=>t.stop());this.note('Could not record: '+e.message);}
        finally{this.starting=false;this.exportButton.disabled=false;}
      }
      finishRecording(){if(this.recording&&this.recording.state!=='inactive')this.recording.stop();}
      disconnectedCallback(){this.analysisController?.abort();this.prepareRun++;this.finishRecording();this.stop();this.unbind?.();this.bindingActive=false;this.resize?.disconnect();this.intersection?.disconnect();this.modalObserver?.disconnect();this.handlers.forEach(fn=>fn());this.handlers=[];if(this.downloadUrl)root.URL.revokeObjectURL(this.downloadUrl);this.built=false;}
    }
    root.customElements.define('dimau-music-visualiser',Visualiser);
  }
  root.DimauMusicVisuals={version:'1.0.0',finalizeWebmDuration,audioGraph,prepare,canAnalyse,sample,bins,draw,previewSpectrum,modes,palettes};
  if(typeof module==='object'&&module.exports)module.exports=root.DimauMusicVisuals;
})(typeof globalThis!=='undefined'?globalThis:this);

