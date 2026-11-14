(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SotaLifeGraph3D=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const MAX_NODES=251,TAU=Math.PI*2,GOLDEN=Math.PI*(3-Math.sqrt(5));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const hash=s=>{let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
  function normalize({nodes=[],edges=[]}={}){
    const ids=new Set(),out=[];
    for(const n of Array.isArray(nodes)?nodes.slice(0,MAX_NODES):[]){
      if(!n||typeof n.id!=='string'||!n.id)continue;
      const id=n.id.slice(0,180);if(ids.has(id))continue;ids.add(id);out.push({id,label:String(n.label||n.id).slice(0,80),color:/^#[a-f0-9]{6}$/i.test(n.color)?n.color:'#55b9ff',kind:['you','category','person'].includes(n.kind)?n.kind:'person'});
    }
    const actualIds=new Set(out.map(n=>n.id)),seen=new Set(),links=[];
    for(const e of Array.isArray(edges)?edges.slice(0,1000):[]){
      if(!e||!actualIds.has(e.source)||!actualIds.has(e.target)||e.source===e.target)continue;
      const key=[e.source,e.target].sort().join('|');if(seen.has(key))continue;seen.add(key);links.push({source:e.source,target:e.target});
    }
    return {nodes:out,edges:links};
  }
  function layout(input){
    const graph=normalize(input),positions=new Map(),categories=graph.nodes.filter(n=>n.kind==='category');
    graph.nodes.filter(n=>n.kind==='you').forEach(n=>positions.set(n.id,[0,0,0]));
    categories.forEach((n,i)=>{
      const y=1-2*(i+.5)/Math.max(1,categories.length),r=Math.sqrt(Math.max(0,1-y*y)),a=i*GOLDEN+.4;
      positions.set(n.id,[2.65*r*Math.cos(a),2.65*y,2.65*r*Math.sin(a)]);
    });
    const categoryIds=new Set(categories.map(n=>n.id));
    graph.nodes.filter(n=>n.kind==='person').forEach((n,i)=>{
      const edge=graph.edges.find(e=>(e.source===n.id&&categoryIds.has(e.target))||(e.target===n.id&&categoryIds.has(e.source)));
      const parent=edge?positions.get(edge.source===n.id?edge.target:edge.source):null,h=hash(n.id),a=(h%10007)/10007*TAU,y=((h>>>8)%1009)/1009*2-1,r=Math.sqrt(1-y*y),d=.38+((h>>>16)%100)/250;
      positions.set(n.id,parent?[parent[0]+d*r*Math.cos(a),parent[1]+d*y,parent[2]+d*r*Math.sin(a)]:[3*r*Math.cos(a),3*y,3*r*Math.sin(a)]);
    });
    return positions;
  }
  function color(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);}
  function rotate(point,yaw,pitch){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),x=cy*point[0]+sy*point[2],z=-sy*point[0]+cy*point[2];
    return [x,cp*point[1]-sp*z,sp*point[1]+cp*z];
  }
  function project(point,{width,height,yaw=.3,pitch=-.1,distance=8.8}={}){
    const r=rotate(point,yaw,pitch),depth=distance-r[2],f=1/Math.tan(.7/2),aspect=width/height;
    return {x:width/2+(r[0]*f/aspect/depth)*width/2,y:height/2-(r[1]*f/depth)*height/2,depth,visible:depth>.1};
  }
  function moveInView(point,dx,dy,camera){
    const r=rotate(point,camera.yaw,camera.pitch),scale=2*(camera.distance-r[2])*Math.tan(.7/2)/camera.height;
    const x=r[0]+dx*scale,y=r[1]-dy*scale,z=r[2],cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch),cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw);
    const worldY=cp*y+sp*z,worldZ=-sp*y+cp*z;
    return [cy*x-sy*worldZ,worldY,sy*x+cy*worldZ];
  }
  function matrix({width,height,yaw,pitch,distance}){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),f=1/Math.tan(.7/2),a=width/height,near=.1,far=50;
    // Column-major projection * translation * camera rotation.
    const view=new Float32Array([cy,sp*sy,-cp*sy,0,0,cp,sp,0,sy,-sp*cy,cp*cy,0,0,0,-distance,1]);
    const projection=[f/a,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],out=new Float32Array(16);
    for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=projection[k*4+row]*view[col*4+k];
    return {mvp:out,rotation:new Float32Array([cy,sp*sy,-cp*sy,0,cp,sp,sy,-sp*cy,cp*cy])};
  }
  function placeCaption(point,box,placed,spheres){
    const {width,height,w,h}=box,gap=7,half=h/2,side=point.radius+w/2+gap,vertical=point.radius+half+gap,candidates=[];
    for(let step=0;step<7;step++){
      const extra=step*(h+7);
      candidates.push({x:point.x,y:point.y+vertical+extra},{x:point.x,y:point.y-vertical-extra});
      if(step<3)candidates.push({x:point.x-side,y:point.y+step*(h+7)},{x:point.x+side,y:point.y-step*(h+7)});
    }
    // On narrow screens, search spare space across the view as well as near the node.
    for(let y=half+5;y<=height-half-10;y+=h+7)for(let x=w/2+5;x<=width-w/2-5;x+=Math.max(24,w*.45))candidates.push({x,y});
    let best=null,bestScore=Infinity;
    for(const candidate of candidates){
      const x=clamp(candidate.x,w/2+5,width-w/2-5),y=clamp(candidate.y,half+5,height-half-10);
      const distance=Math.hypot(x-point.x,y-point.y);
      let score=distance*distance+(candidate.y<point.y?100:0);
      for(const b of placed){const ox=(w+b.w)/2+5-Math.abs(x-b.x),oy=(h+b.h)/2+5-Math.abs(y-b.y);if(ox>0&&oy>0)score+=1000000+ox*oy*100;}
      for(const sphere of spheres){const dx=Math.max(0,Math.abs(sphere.x-x)-w/2),dy=Math.max(0,Math.abs(sphere.y-y)-half),overlap=sphere.radius+4-Math.hypot(dx,dy);if(overlap>0)score+=overlap*overlap*5;}
      if(score<bestScore){best={x,y};bestScore=score;}
    }
    return best;
  }
  const nodeRadius=n=>n.kind==='you'?.44:n.kind==='category'?.32:.075;
  function buildGeometry(graph,positions,selected){
    const spheres=[],lines=[],glows=[],byId=new Map(graph.nodes.map(n=>[n.id,n]));
    for(const edge of graph.edges){const a=positions.get(edge.source),b=positions.get(edge.target),n=byId.get(edge.target),c=color(n.color),active=edge.source===selected||edge.target===selected;for(const p of [a,b])lines.push(...p,...c,active?.65:.22);}
    const latitudes=10,segments=16;
    const normal=(lat,lon)=>{const theta=lat*Math.PI/latitudes,phi=lon*TAU/segments;return [Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];};
    for(const n of graph.nodes){
      const p=positions.get(n.id),c=color(n.color),radius=nodeRadius(n),scale=n.id===selected?1.22:1;
      glows.push(...p,...c,radius*scale);
      for(let lat=0;lat<latitudes;lat++)for(let lon=0;lon<segments;lon++){
        const normals=[normal(lat,lon),normal(lat+1,lon),normal(lat,lon+1),normal(lat,lon+1),normal(lat+1,lon),normal(lat+1,lon+1)];
        for(const v of normals)spheres.push(p[0]+v[0]*radius*scale,p[1]+v[1]*radius*scale,p[2]+v[2]*radius*scale,...v,...c);
      }
    }
    return {spheres:new Float32Array(spheres),lines:new Float32Array(lines),glows:new Float32Array(glows)};
  }
  const VERTEX=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uMatrix;uniform mat3 uRotation;varying vec3 vNormal;varying vec3 vColor;void main(){gl_Position=uMatrix*vec4(aPosition,1.0);vNormal=uRotation*aNormal;vColor=aColor;}`;
  const FRAGMENT=`precision mediump float;varying vec3 vNormal;varying vec3 vColor;void main(){vec3 n=normalize(vNormal);vec3 light=normalize(vec3(-0.5,0.8,1.0));float diffuse=max(dot(n,light),0.0);float spec=pow(max(dot(reflect(-light,n),vec3(0.0,0.0,1.0)),0.0),28.0);float rim=pow(1.0-max(n.z,0.0),2.0);vec3 c=vColor*(0.30+diffuse*0.8)+vec3(0.85)*spec+vColor*rim*0.48;gl_FragColor=vec4(c,1.0);}`;
  const LINE_VERTEX=`attribute vec3 aPosition;attribute vec3 aColor;attribute float aAlpha;uniform mat4 uMatrix;varying vec4 vColor;void main(){gl_Position=uMatrix*vec4(aPosition,1.0);vColor=vec4(aColor,aAlpha);}`;
  const LINE_FRAGMENT=`precision mediump float;varying vec4 vColor;void main(){gl_FragColor=vColor;}`;
  const GLOW_VERTEX=`attribute vec3 aPosition;attribute vec3 aColor;attribute float aSize;uniform mat4 uMatrix;uniform float uHeight;uniform float uPointMax;varying vec3 vColor;void main(){gl_Position=uMatrix*vec4(aPosition,1.0);gl_PointSize=min(uPointMax,max(3.0,aSize*uHeight*8.5/gl_Position.w));vColor=aColor;}`;
  const GLOW_FRAGMENT=`precision mediump float;varying vec3 vColor;void main(){float d=length(gl_PointCoord-vec2(0.5))*2.0;if(d>1.0)discard;float glow=pow(1.0-d,2.5)*0.48;gl_FragColor=vec4(vColor,glow);}`;
  function createRenderer(gl){
    const resources={programs:[],shaders:[],buffers:[]};
    function shader(type,source){const s=gl.createShader(type);resources.shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('The 3D shader could not be prepared.');return s;}
    function program(vertex,fragment){const p=gl.createProgram();resources.programs.push(p);gl.attachShader(p,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('The 3D view could not be prepared.');return p;}
    function cleanup(){for(const b of resources.buffers)gl.deleteBuffer(b);for(const p of resources.programs)gl.deleteProgram(p);for(const s of resources.shaders)gl.deleteShader(s);resources.buffers=[];resources.programs=[];resources.shaders=[];}
    let spheres,lines,glows;
    function item(vertex,fragment){const p=program(vertex,fragment),buffer=gl.createBuffer();resources.buffers.push(buffer);return {program:p,buffer};}
    try{spheres=item(VERTEX,FRAGMENT);lines=item(LINE_VERTEX,LINE_FRAGMENT);glows=item(GLOW_VERTEX,GLOW_FRAGMENT);}catch(error){cleanup();throw error;}
    const pointMax=gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)?.[1]||64;
    function attribute(p,name,size,stride,offset){const location=gl.getAttribLocation(p,name);if(location<0)return;gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,stride*4,offset*4);}
    function use(item,coordinates){gl.useProgram(item.program);gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);gl.uniformMatrix4fv(gl.getUniformLocation(item.program,'uMatrix'),false,coordinates.mvp);}
    return {setData(geometry){for(const [item,data,stride] of [[spheres,geometry.spheres,9],[lines,geometry.lines,7],[glows,geometry.glows,7]]){gl.bindBuffer(gl.ARRAY_BUFFER,item.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);item.count=data.length/stride;}},
      draw(camera,pixelWidth,pixelHeight){
        gl.viewport(0,0,pixelWidth,pixelHeight);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthMask(false);
        const coordinates=matrix(camera);use(lines,coordinates);attribute(lines.program,'aPosition',3,7,0);attribute(lines.program,'aColor',3,7,3);attribute(lines.program,'aAlpha',1,7,6);gl.drawArrays(gl.LINES,0,lines.count);
        gl.disable(gl.DEPTH_TEST);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);use(glows,coordinates);attribute(glows.program,'aPosition',3,7,0);attribute(glows.program,'aColor',3,7,3);attribute(glows.program,'aSize',1,7,6);gl.uniform1f(gl.getUniformLocation(glows.program,'uHeight'),pixelHeight);gl.uniform1f(gl.getUniformLocation(glows.program,'uPointMax'),pointMax);gl.drawArrays(gl.POINTS,0,glows.count);
        gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);use(spheres,coordinates);attribute(spheres.program,'aPosition',3,9,0);attribute(spheres.program,'aNormal',3,9,3);attribute(spheres.program,'aColor',3,9,6);gl.uniformMatrix3fv(gl.getUniformLocation(spheres.program,'uRotation'),false,coordinates.rotation);gl.drawArrays(gl.TRIANGLES,0,spheres.count);
      },dispose:cleanup};
  }
  let instance=0;
  function mount(host,{nodes=[],edges=[],onSelect=()=>{},motion=true,storage=null,storageKey=''}={}){
    if(!host)throw Error('A 3D graph container is required.');
    const uid='lg3d-'+(++instance),listeners=[],q=s=>host.querySelector(s),doc=host.ownerDocument||document,win=doc.defaultView||window;
    let graph=normalize({nodes,edges}),points=layout(graph),selected=graph.nodes.find(n=>n.kind==='you')?.id||'',renderer=null,gl=null,disposed=false,lost=false,inView=true,raf=0,lastFrame=0,drag=null;
    let width=600,height=500,yaw=.28,pitch=-.08,distance=8.8,requestedMotion=!!motion;
    const media=win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const on=(el,event,fn,options)=>{el.addEventListener(event,fn,options);listeners.push(()=>el.removeEventListener(event,fn,options));};
    host.classList.add('lg3d');host.dataset.background='galaxy';host.innerHTML=`<div class="lg3d-toolbar" aria-label="Graph appearance and view"><select class="lg3d-background" data-lg3d-background aria-label="Graph background"><option value="galaxy">Galaxy</option><option value="dark">Dark</option></select><div class="lg3d-controls" aria-label="3D view controls"><button type="button" data-lg3d-zoom-in aria-label="Zoom into connection graph">+</button><button type="button" data-lg3d-zoom-out aria-label="Zoom out of connection graph">−</button><button type="button" data-lg3d-reset>Reset</button></div></div><div class="lg3d-stage" data-lg3d-stage><canvas data-lg3d-canvas aria-label="Three dimensional life connections" role="img"></canvas><div class="lg3d-labels" data-lg3d-labels></div></div><p class="lg3d-state" data-lg3d-state role="status">Preparing 3D view…</p><details class="lg3d-outline" data-lg3d-outline><summary>Connection list <span data-lg3d-list-count></span></summary><div class="lg3d-list" data-lg3d-list></div></details>`;
    const canvas=q('[data-lg3d-canvas]'),stage=q('[data-lg3d-stage]'),labels=q('[data-lg3d-labels]');
    let labelButtons=new Map(),movedPoints=new Map(),suppressClickUntil=0,savingAvailable=true;
    const instructions='Drag a node to move it · drag empty space to rotate';
    function storageState(){if(!lost)setState(instructions+(savingAvailable?'':' · Layout saving unavailable; changes are temporary.'));}
    function saveLayout(){
      if(!storageKey)return;
      try{
        if(!storage)throw Error('Storage unavailable');
        if(!movedPoints.size)storage.removeItem(storageKey);
        else storage.setItem(storageKey,JSON.stringify({version:1,positions:[...movedPoints],camera:{yaw,pitch,distance}}));
        savingAvailable=true;
      }catch(_){savingAvailable=false;}
      storageState();
    }
    if(storageKey){
      try{
        if(!storage)throw Error('Storage unavailable');
        const raw=storage.getItem(storageKey),saved=raw&&raw.length<100000?JSON.parse(raw):null;
        if(saved?.version===1&&Array.isArray(saved.positions)){
          for(const entry of saved.positions.slice(0,MAX_NODES)){
            if(!Array.isArray(entry)||entry.length!==2)continue;
            const [id,p]=entry;
            if(!points.has(id)||!Array.isArray(p)||p.length!==3||!p.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=50))continue;
            movedPoints.set(id,[...p]);points.set(id,[...p]);
          }
          const c=saved.camera;
          if(movedPoints.size&&c&&[c.yaw,c.pitch,c.distance].every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.abs(c.yaw)<100000&&Math.abs(c.pitch)<=1.1&&c.distance>=5.5&&c.distance<=15){yaw=c.yaw;pitch=c.pitch;distance=c.distance;}
        }
      }catch(_){savingAvailable=false;}
    }

    function active(){return !disposed&&!lost&&renderer&&inView&&!doc.hidden;}
    function moving(){return active()&&requestedMotion&&!media?.matches;}
    function cancel(){if(raf)win.cancelAnimationFrame(raf);raf=0;lastFrame=0;}
    function camera(){return {width,height,yaw,pitch,distance:distance*Math.max(1,height/width)};}
    function setState(text){q('[data-lg3d-state]').textContent=text;}
    function rebuild(){
      if(disposed)return;
      if(renderer&&!lost)renderer.setData(buildGeometry(graph,points,selected));
      q('[data-lg3d-list-count]').textContent=String(graph.nodes.length);
      q('[data-lg3d-list]').innerHTML=graph.nodes.map(n=>`<button type="button" data-lg3d-pick="${esc(n.id)}" aria-pressed="${n.id===selected}"><i style="--lg3d-color:${n.color}" aria-hidden="true"></i>${esc(n.label)}<small>${n.kind==='you'?'You':n.kind==='category'?'Connection category':'Connection'}</small></button>`).join('');
      const ids=new Set(graph.nodes.map(n=>n.id));for(const [id,button] of labelButtons)if(!ids.has(id)){button.remove();labelButtons.delete(id);}
      for(const n of graph.nodes){let button=labelButtons.get(n.id);if(!button){button=doc.createElement('button');button.type='button';button.className='lg3d-label';button.dataset.lg3dPick=n.id;labels.append(button);labelButtons.set(n.id,button);}let caption=button.querySelector('.lg3d-caption');if(!caption){caption=doc.createElement('span');caption.className='lg3d-caption';button.textContent='';button.append(caption);}caption.textContent=n.label;button.style.setProperty('--lg3d-color',n.color);button.dataset.kind=n.kind;button.setAttribute('aria-label',n.label+(n.kind==='category'?', connection category':''));button.setAttribute('aria-pressed',String(n.id===selected));}
      draw();schedule();
    }
    function draw(){
      if(!active())return;
      renderer.draw(camera(),canvas.width,canvas.height);
      const connected=new Set([selected]);graph.edges.forEach(e=>{if(e.source===selected)connected.add(e.target);if(e.target===selected)connected.add(e.source);});
      const projected=graph.nodes.map(n=>({node:n,...project(points.get(n.id),camera())})).sort((a,b)=>a.depth-b.depth),placed=[];
      const spheres=projected.filter(p=>p.visible).map(p=>({...p,radius:nodeRadius(p.node)*(p.node.id===selected?1.22:1)*height/(2*Math.tan(.7/2)*p.depth)}));
      let memberLabels=0;
      for(const p of projected){
        const n=p.node,button=labelButtons.get(n.id),show=n.kind!=='person'||n.id===selected||(connected.has(n.id)&&memberLabels++<16);
        button.hidden=!show||!p.visible||p.x<0||p.x>width||p.y<0||p.y>height;
        if(button.hidden)continue;
        const compact=width<=600,labelWidth=Math.min(width-16,n.kind==='you'?84:compact?180:220,Math.max(60,n.label.length*(compact?8:9)+28));
        const radiusPx=nodeRadius(n)*(n.id===selected?1.22:1)*height/(2*Math.tan(.7/2)*p.depth);
        const labelHeight=compact?34:38,{x,y}=placeCaption({...p,radius:radiusPx},{width,height,w:labelWidth,h:labelHeight},placed,spheres);
        placed.push({x,y,w:labelWidth,h:labelHeight});
        const dx=p.x-x,dy=p.y-y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,start=Math.min(labelWidth/(2*Math.abs(ux)||1e-9),labelHeight/(2*Math.abs(uy)||1e-9))+1;
        button.style.setProperty('--lg3d-tether-x',(ux*start)+'px');button.style.setProperty('--lg3d-tether-y',(uy*start)+'px');button.style.setProperty('--lg3d-tether-length',Math.max(0,length-start-radiusPx-2)+'px');button.style.setProperty('--lg3d-tether-angle',Math.atan2(dy,dx)+'rad');
        button.style.left=x+'px';button.style.top=y+'px';button.style.maxWidth=labelWidth+'px';button.style.opacity='1';button.style.zIndex=String(100-Math.round(p.depth));button.style.setProperty('--lg3d-leader-x',(p.x-x)+'px');button.style.setProperty('--lg3d-leader-y',(p.y-y)+'px');
      }
    }
    function frame(time){raf=0;if(!moving())return;if(!lastFrame||time-lastFrame>=1000/30){const delta=lastFrame?Math.min(.1,(time-lastFrame)/1000):0;lastFrame=time;if(!drag)yaw+=delta*.065;draw();}if(moving())raf=win.requestAnimationFrame(frame);}
    function schedule(){if(moving()&&!raf)raf=win.requestAnimationFrame(frame);else if(!moving())cancel();}
    function resize(){
      if(disposed)return;const rect=stage.getBoundingClientRect();width=Math.max(1,rect.width||host.clientWidth||600);height=Math.max(1,rect.height||500);
      const ratio=Math.min(1.5,win.devicePixelRatio||1);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);draw();schedule();
    }
    function select(id){if(disposed||id===selected||!graph.nodes.some(n=>n.id===id))return;selected=id;rebuild();}
    function pick(id){select(id);onSelect(id);}
    function zoom(factor){if(disposed||!Number.isFinite(factor)||factor<=0)return;distance=clamp(distance/factor,5.5,15);draw();if(movedPoints.size)saveLayout();}
    function reset(){end();movedPoints.clear();points=layout(graph);yaw=.28;pitch=-.08;distance=8.8;saveLayout();rebuild();}
    function unavailable(text){lost=true;cancel();host.classList.add('lg3d-unavailable');host.dataset.renderer='unavailable';labels.hidden=true;host.querySelector('.lg3d-controls').hidden=true;q('[data-lg3d-outline]').open=true;setState(text);}
    function start(){
      try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,powerPreference:'low-power',preserveDrawingBuffer:false});if(!gl)throw Error('WebGL is unavailable.');renderer=createRenderer(gl);lost=false;host.classList.remove('lg3d-unavailable');host.dataset.renderer='webgl';labels.hidden=false;host.querySelector('.lg3d-controls').hidden=false;storageState();rebuild();resize();}catch(_){renderer?.dispose();renderer=null;unavailable('3D is unavailable on this device. Use the connection list below.');}
    }
    on(host,'click',event=>{const item=event.target.closest('[data-lg3d-pick]');if(item&&host.contains(item)){if(Date.now()<suppressClickUntil){event.preventDefault();return;}pick(item.dataset.lg3dPick);}});
    on(q('[data-lg3d-background]'),'change',event=>{host.dataset.background=event.target.value==='dark'?'dark':'galaxy';});
    on(q('[data-lg3d-zoom-in]'),'click',()=>zoom(1.2));on(q('[data-lg3d-zoom-out]'),'click',()=>zoom(1/1.2));on(q('[data-lg3d-reset]'),'click',reset);
    function hitNode(event){
      const rect=stage.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,c=camera();
      return graph.nodes.map(n=>({n,p:project(points.get(n.id),c)})).filter(({n,p})=>p.visible&&Math.hypot(x-p.x,y-p.y)<=Math.max(14,nodeRadius(n)*(n.id===selected?1.22:1)*height/(2*Math.tan(.7/2)*p.depth)+5)).sort((a,b)=>a.p.depth-b.p.depth)[0]?.n.id;
    }
    function end(event){
      if(!drag||(event&&event.pointerId!==drag.pointerId))return;
      const finished=drag;drag=null;stage.classList.remove('lg3d-dragging');
      if(finished.moved){suppressClickUntil=Date.now()+300;if(movedPoints.size)saveLayout();}
      else if(event?.type==='pointerup'&&finished.id&&finished.canvas)pick(finished.id);
      if(finished.capture.hasPointerCapture?.(finished.pointerId))finished.capture.releasePointerCapture(finished.pointerId);
    }
    on(stage,'pointerdown',event=>{
      if(event.button!==0||event.isPrimary===false||lost||drag)return;
      const label=event.target.closest('.lg3d-label'),isCanvas=event.target===canvas;
      if(!label&&!isCanvas)return;
      const id=label?.dataset.lg3dPick||hitNode(event);
      drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,yaw,pitch,id,capture:label||canvas,canvas:isCanvas,point:id?[...points.get(id)]:null,camera:camera(),moved:false};
      drag.capture.setPointerCapture?.(event.pointerId);
    });
    on(stage,'pointermove',event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!drag.moved&&Math.hypot(dx,dy)<4)return;
      drag.moved=true;stage.classList.add('lg3d-dragging');event.preventDefault();
      if(drag.id){
        const origin=project(drag.point,drag.camera),next=moveInView(drag.point,clamp(origin.x+dx,18,width-18)-origin.x,clamp(origin.y+dy,18,height-18)-origin.y,drag.camera);
        points.set(drag.id,next);movedPoints.set(drag.id,next);renderer?.setData(buildGeometry(graph,points,selected));
      }else{yaw=drag.yaw+dx*.008;pitch=clamp(drag.pitch+dy*.006,-1.1,1.1);}
      draw();
    });
    on(stage,'pointerup',end);on(stage,'pointercancel',end);on(stage,'lostpointercapture',end);
    on(canvas,'webglcontextlost',event=>{event.preventDefault();end();unavailable('3D view interrupted. Your connections remain available in the list below.');});
    on(canvas,'webglcontextrestored',()=>{if(disposed)return;renderer=null;start();});
    on(doc,'visibilitychange',()=>{if(active())draw();schedule();});
    if(media?.addEventListener)on(media,'change',()=>{draw();schedule();});
    // WebGL setup and the first layout read wait until the graph is near the screen, so a hidden graph never slows the first paint.
    let started=false;function begin(){if(started||disposed)return;started=true;start();}
    const observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting);if(inView)begin();if(active())draw();schedule();},{rootMargin:'120px'}):null;observer?.observe(host);
    const resizeObserver=win.ResizeObserver?new win.ResizeObserver(resize):null;resizeObserver?.observe(stage);if(!resizeObserver)on(win,'resize',resize);
    rebuild();if(!observer)begin();
    return {update(next){if(disposed)return;const normalized=normalize(next);if(JSON.stringify(normalized)===JSON.stringify(graph))return;end();graph=normalized;points=layout(graph);for(const [id,p] of movedPoints){if(points.has(id))points.set(id,p);else movedPoints.delete(id);}if(storageKey)saveLayout();if(!graph.nodes.some(n=>n.id===selected))selected=graph.nodes.find(n=>n.kind==='you')?.id||'';rebuild();},select,setMotion(value){requestedMotion=!!value;if(active())draw();schedule();},zoom,reset,
      dispose(){if(disposed)return;end();disposed=true;cancel();observer?.disconnect();resizeObserver?.disconnect();listeners.forEach(fn=>fn());if(!lost)renderer?.dispose();try{gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch(_){}renderer=null;gl=null;graph={nodes:[],edges:[]};points.clear();movedPoints.clear();labelButtons.clear();host.textContent='';host.classList.remove('lg3d','lg3d-unavailable');delete host.dataset.renderer;delete host.dataset.background;}};
  }
  return {mount,normalize,layout,rotate,project,moveInView,placeCaption,matrix,buildGeometry,createRenderer};
});

