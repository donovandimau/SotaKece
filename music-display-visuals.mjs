// Render in CSS pixels. Each canvas owns its history and filter-response buffers.
const surfaces = new WeakMap();
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;
const heatColors = Array.from({length: 256}, (_, value) => {
  const intensity = value / 255;
  return `hsl(${205 - 160 * intensity} 84% ${15 + 69 * intensity}%)`;
});
const frequencies = [60, 230, 910, 3600, 14000];
const minHz = 30, maxHz = 18000, octaves = Math.log(maxHz / minHz);
export const bandX = hz => Math.log(hz / minHz) / octaves;
export const plot = {left:.08, right:.94, top:.13, bottom:.82, limit:18};
export function bandPoint(band, gain) {
  return [plot.left + (plot.right - plot.left) * bandX(frequencies[band]),
    plot.top + (plot.bottom - plot.top) * (.5 - gain / (2 * plot.limit))];
}
const line = (ctx, x1,y1,x2,y2) => {ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
function type(ctx, value, x,y, align='left', color='#9bb1bd') {
  ctx.textAlign=align; ctx.fillStyle=color; ctx.font='600 9px Consolas, monospace'; ctx.fillText(value,x,y);
}
function surface(canvas) {
  let s = surfaces.get(canvas);
  if (!s) {
    const samples = 128;
    s = {ctx:canvas.getContext('2d'), history:[], lastTime:-1, source:'', responseKey:null,
      hz:Float32Array.from({length:samples},(_,i)=>minHz*Math.exp(octaves*i/(samples-1))),
      magnitudes:new Float32Array(samples), phase:new Float32Array(samples), db:new Float32Array(samples)};
    surfaces.set(canvas,s);
  }
  return s;
}
function wing(ctx,w,h,bins, range, t) {
  const ranges = {all:[0,63],bass:[0,23],mid:[23,43],air:[43,63]};
  const [start,end] = ranges[range] || ranges.all;
  const mid=h*.53;
  ctx.lineJoin='round';
  // Two folded, translucent surfaces. Each rib reads the selected range of FFT bins.
  for (const side of [-1,1]) {
    const pigment=ctx.createLinearGradient(side < 0 ? 0 : w,0,w/2,0);
    pigment.addColorStop(0,side<0?'#ff9b4c':'#46edd9');
    pigment.addColorStop(.42,side<0?'#ff4e80':'#57a5ff');
    pigment.addColorStop(.76,side<0?'#ec99fd':'#bb8bff');
    pigment.addColorStop(1,'#f7f8ff');
    for (let rib=0;rib<34;rib++){
      const v=rib/33;
      ctx.beginPath();
      for(let j=0;j<=68;j++){
        const u=j/68, env=Math.pow(Math.sin(Math.PI*u),.74);
        const energy=(bins?.[Math.round(start+(end-start)*u)] || 0);
        const x=w*.5+side*w*(.115+.425*u);
        const fold=Math.sin(u*6.9-v*2.8+t*.25)*.23+Math.sin(u*13.6+v*2.1)*.10;
        const y=mid + h*env*((v-.48)*.70+fold+(v-.62)*energy*.84)
          + h*.12*Math.cos(u*3.8+v*.8);
        if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=pigment;ctx.globalAlpha=.30+.63*Math.pow(Math.sin(v*Math.PI),.6);ctx.lineWidth=rib%6===0?1.45:.72;ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
}
function landscape(ctx,w,h,bins,s,t,steep) {
  if(s.source!==s.track || t<s.lastTime || t-s.lastTime>1){s.history=[];s.lastTime=-1;s.source=s.track;}
  if(bins && (s.lastTime<0 || t-s.lastTime>=.07)){
    s.history.unshift(bins.slice()); if(s.history.length>30)s.history.pop(); s.lastTime=t;
  }
  const tilt = steep ? .38 : .21, rows=30, cols=62;
  // Far ridges first; nearer filled ridges hide the mesh behind them.
  const horizon=h*.36;
  for(let row=rows-1;row>=0;row--){
    const depth=1-row/(rows-1), rowData=s.history[row];
    const xScale=.51+depth*.69, yBase=horizon+h*(.06+depth*depth*.63);
    const points=[];
    for(let col=0;col<=cols;col++){
      const u=col/cols;
      const x=w*(.5+(u-.5)*xScale+(1-depth)*.04);
      const peaks=.58*Math.exp(-((u-.31-.10*Math.sin(depth*4))**2)/.016)
        +.42*Math.exp(-((u-.70+.06*Math.sin(depth*7))**2)/.013);
      const energy=rowData?.[Math.min(63,col)] || 0;
      const y=yBase-h*(.5+depth*.5)*(tilt*peaks+.11*peaks*Math.cos(depth*6+u*11)+energy*.26);
      points.push([x,y]);
    }
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
    ctx.lineTo(points[cols][0],h+1);ctx.lineTo(points[0][0],h+1);ctx.closePath();
    ctx.fillStyle='hsl('+ (258+depth*14) +' 46% '+(13-depth*6)+'%)';ctx.fill();
    const gradient=ctx.createLinearGradient(0,0,w,0);
    gradient.addColorStop(0,'#b05afa');gradient.addColorStop(.29,'#fa8dce');gradient.addColorStop(.60,'#afbbff');gradient.addColorStop(1,'#55e9e6');
    ctx.strokeStyle=gradient;ctx.globalAlpha=.34+depth*.55;ctx.lineWidth=.7+depth*.5;
    ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.globalAlpha=1;
  }
}
function response(ctx,w,h,s,graph,gains,active) {
  const x0=w*plot.left, x1=w*plot.right, y0=h*plot.top, y1=h*plot.bottom;
  const xFor=hz=>x0+(x1-x0)*bandX(hz), yFor=db=>y0+(y1-y0)*(.5-db/(2*plot.limit));
  ctx.lineWidth=1;
  for(const d of [-12,-6,0,6,12]){
    const y=yFor(d);ctx.strokeStyle=d===0?'#8ca79f70':'#77968c2e';line(ctx,x0,y,x1,y);
    if(d%12===0)type(ctx,(d>0?'+':'')+d, x0-3,y+3,'right');
  }
  for(const hz of [60,100,230,500,910,2000,3600,8000,14000]){
    const x=xFor(hz);ctx.strokeStyle='#77968c2e';line(ctx,x,y0,x,y1);
    if([60,230,910,3600,14000].includes(hz))type(ctx,hz>999?(hz/1000)+'k':String(hz),x,y1+14,'center');
  }
  // The area is the analyser spectrum. The bright line is the combined Biquad transfer function.
  if(graph){
    const data=graph.frequency,nyquist=graph.context.sampleRate/2;
    const grad=ctx.createLinearGradient(0,y0,0,y1);grad.addColorStop(0,'#e5bd5d9c');grad.addColorStop(1,'#68834c18');
    ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(x0,y1);
    for(let i=0;i<s.hz.length;i++){
      const bin=Math.min(data.length-1,Math.round(s.hz[i]/nyquist*data.length));
      ctx.lineTo(x0+(x1-x0)*i/(s.hz.length-1),y1-(y1-y0)*data[bin]/255);
    }
    ctx.lineTo(x1,y1);ctx.closePath();ctx.fill();
  }
  const filters=graph?.filters || [];
  const key=filters.map(f=>f.gain.value.toFixed(2)).join('/');
  if(s.responseKey!==key){
    s.db.fill(0);
    for(const f of filters){
      f.getFrequencyResponse(s.hz,s.magnitudes,s.phase);
      for(let j=0;j<s.db.length;j++)if(Number.isFinite(s.magnitudes[j]))s.db[j]+=20*Math.log10(Math.max(.00001,s.magnitudes[j]));
    }
    s.responseKey=key;
  }
  ctx.strokeStyle='#a9fbd4';ctx.lineWidth=2.3;ctx.beginPath();
  s.db.forEach((db,i)=>{const x=x0+(x1-x0)*i/(s.db.length-1),y=yFor(clamp(db,-18,18));if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});ctx.stroke();
  for(let i=0;i<5;i++){
    const [px,py]=bandPoint(i,gains[i]);
    ctx.beginPath();ctx.arc(px*w,py*h,i===active?7:5,0,TAU);
    ctx.fillStyle=i===active?'#ffd998':'#0b2422';ctx.fill();ctx.strokeStyle=i===active?'#ffdf9e':'#a9fbd4';ctx.lineWidth=2;ctx.stroke();
  }
}
// Store measurements at the media time they were sampled. A pause adds no rows.
function spectrogram(ctx,w,h,s,bins,graph,time,source,probe){
  if(s.historySource!==source||time<s.scanTime||time-s.scanTime>1){
    s.rows=[];s.scanTime=-1;s.historySource=source;
  }
  if(!s.rows)s.rows=[];
  if(bins&&(s.scanTime==null||s.scanTime<0||time-s.scanTime>=.09)){
    s.rows.push({time,values:bins});if(s.rows.length>64)s.rows.shift();s.scanTime=time;
  }
  const left=w*.08,right=w*.94,top=h*.16,bottom=h*.81,cols=64;
  const dx=(right-left)/cols,dy=(bottom-top)/64;
  for(let i=0;i<s.rows.length;i++){
    const y=bottom-(s.rows.length-i)*dy,row=s.rows[i].values;
    for(let j=0;j<cols;j++){
      const n=row[j];if(n<.008)continue;
      ctx.fillStyle=heatColors[Math.round(clamp(n) * 255)];
      ctx.fillRect(left+j*dx,y,dx+.35,dy+.35);
    }
  }
  for(const hz of [60,230,910,3600,14000]){
    const x=left+(right-left)*Math.log(hz/35)/Math.log(Math.min(graph?.context.sampleRate/2||16000,16000)/35);
    ctx.strokeStyle='#b4d6b729';line(ctx,x,top,x,bottom);type(ctx,hz>=1000?hz/1000+'k':String(hz),x,bottom+14,'center');
  }
  if(!probe)return s.rows.length?'Frequency history · touch to inspect':'Play a track to capture its spectrum';
  const col=clamp(Math.floor((probe[0]*w-left)/dx),0,63);
  const offset=clamp(Math.floor((bottom-probe[1]*h)/dy),0,63);
  const row=s.rows[s.rows.length-1-offset],x=left+(col+.5)*dx,y=bottom-(offset+.5)*dy;
  ctx.strokeStyle='#f4cf80';line(ctx,x,top,x,bottom);line(ctx,left,y,right,y);
  const hz=Math.round(35*Math.pow(Math.min(graph?.context.sampleRate/2||16000,16000)/35,(col+.5)/64));
  if(!row)return hz+' Hz · no sample';
  return hz+' Hz · '+Math.max(0,time-row.time).toFixed(1)+' s ago';
}
export function draw(canvas,audio,layout,settings) {
  const s=surface(canvas),ctx=s.ctx;if(!ctx)return;
  const w=canvas.clientWidth,h=canvas.clientHeight,ratio=Math.min(window.devicePixelRatio||1,1.6);
  if(!w||!h)return;
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){
    canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);
  }
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const graph=window.DimauMusicVisuals?.sample(audio);
  const bins=!audio.paused && !audio.ended && graph ? window.DimauMusicVisuals.bins(graph.frequency,64,graph.context.sampleRate) : null;
  const t=Number.isFinite(audio.currentTime)?audio.currentTime:0;
  if(layout==='wings')wing(ctx,w,h,bins,settings.range,t);
  if(layout==='wave'){s.track=audio.currentSrc;landscape(ctx,w,h,bins,s,t,settings.steep);}
  if(layout==='studio'){
    if(settings.studioMode==='history')return spectrogram(ctx,w,h,s,bins,graph,t,audio.currentSrc,settings.probe);
    response(ctx,w,h,s,graph,settings.gains,settings.band);
  }
}
