// A closed trefoil tube. The same mesh drives WebGL and the Canvas fallback.
const TAU=Math.PI*2, slices=144, sides=18;
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const length=Math.hypot(...v)||1;return v.map(n=>n/length);};
function spine(t){
  const r=.54+.21*Math.cos(3*t);
  return [r*Math.cos(2*t),r*Math.sin(2*t),.34*Math.sin(3*t)];
}
function tube(){
  const vertices=[],indices=[];
  for(let i=0;i<slices;i++){
    const t=TAU*i/slices,c=spine(t),after=spine(t+.001),before=spine(t-.001);
    const tangent=unit(after.map((n,k)=>n-before[k]));
    const normal=unit(cross(tangent,[0,0,1])),binormal=unit(cross(tangent,normal));
    for(let j=0;j<sides;j++){
      const a=TAU*j/sides,n=normal.map((v,k)=>v*Math.cos(a)+binormal[k]*Math.sin(a));
      vertices.push(...c.map((v,k)=>v+.17*n[k]),...n);
      const p=i*sides+j,q=i*sides+(j+1)%sides,r=((i+1)%slices)*sides+j,u=((i+1)%slices)*sides+(j+1)%sides;
      indices.push(p,r,q,q,r,u);
    }
  }
  return {vertices:new Float32Array(vertices),indices:new Uint16Array(indices)};
}
const vertex=`
attribute vec3 pos;
attribute vec3 normal;
uniform vec4 pose;
uniform float aspect;
varying vec3 vNormal;
varying vec3 vPosition;
void main(){
  float ax=pose.x, ay=pose.y;
  mat3 rx=mat3(1.,0.,0.,0.,cos(ax),sin(ax),0.,-sin(ax),cos(ax));
  mat3 ry=mat3(cos(ay),0.,-sin(ay),0.,1.,0.,sin(ay),0.,cos(ay));
  vec3 p=ry*rx*(pos+normal*pose.z);
  vNormal=ry*rx*normal;
  vPosition=p;
  float lens=1.67/(2.38-p.z*.54);
  gl_Position=vec4(p.x*lens*1.37/aspect,p.y*lens*1.37,-p.z*.50,1.);
}`;
const fragment=`
precision mediump float;
varying vec3 vNormal;
varying vec3 vPosition;
uniform vec4 pose;
void main(){
  vec3 n=normalize(vNormal),eye=normalize(vec3(0.,0.,3.)-vPosition);
  vec3 r=reflect(-eye,n);
  float edge=pow(1.-abs(dot(n,eye)),1.35);
  float phase=r.x*1.2+r.y*1.7+pose.w+edge*.9;
  vec3 film=.52+.48*cos(6.283*(phase*.45+vec3(.09,.32,.57)));
  vec3 col=mix(vec3(.035,.085,.15),film,.50+.43*edge);
  float sky=smoothstep(-.24,.72,r.y);
  col+=sky*vec3(.13,.27,.32);
  float strip=exp(-abs(r.y-.17-.40*r.x)*9.);
  float rim=exp(-abs(r.x+.54+.12*r.y)*15.);
  col+=strip*vec3(.78,.92,1.)+rim*vec3(1.,.69,.34);
  col+=pow(max(0.,dot(r,normalize(vec3(.61,.6,.6)))),32.)*vec3(.9,.9,1.);
  gl_FragColor=vec4(pow(clamp(col,0.,1.),vec3(.88)),1.);
}`;
function compile(gl,type,source){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Shader unavailable');
  return shader;
}
function material(gl,mesh){
  const program=gl.createProgram();
  const vs=compile(gl,gl.VERTEX_SHADER,vertex),fs=compile(gl,gl.FRAGMENT_SHADER,fragment);
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Material unavailable');
  gl.useProgram(program);
  const verts=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,verts);gl.bufferData(gl.ARRAY_BUFFER,mesh.vertices,gl.STATIC_DRAW);
  for(const [name,offset] of [['pos',0],['normal',12]]){
    const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset);
  }
  const index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
  const pose=gl.getUniformLocation(program,'pose'),aspect=gl.getUniformLocation(program,'aspect');
  return (w,h,x,y,bloom,hue)=>{
    gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(aspect,w/h);
    gl.uniform4f(pose,x,y,bloom,hue);
    gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);
  };
}
// Smooth per-vertex iridescence, interpolated over the visible triangles. This
// uses the same surface and optical highlights on machines without WebGL.
function software(ctx,mesh,w,h,ax,ay,bloom,hue){
  if(mesh.image?.width!==w || mesh.image?.height!==h){
    mesh.image=ctx.createImageData(w,h);mesh.depth=new Float32Array(w*h);
  }
  const pixels=mesh.image.data,depth=mesh.depth;
  pixels.fill(0);depth.fill(-Infinity);
  const v=mesh.vertices,count=v.length/6;
  const projected=mesh.projected||(mesh.projected=new Float32Array(count*6));
  const cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay);
  const rotate=(x,y,z)=>{const a=y*cx-z*sx,b=y*sx+z*cx;return [x*cy+b*sy,a,-x*sy+b*cy];};
  for(let i=0;i<v.length;i+=6){
    const [x,y,z]=rotate(v[i]+bloom*v[i+3],v[i+1]+bloom*v[i+4],v[i+2]+bloom*v[i+5]);
    const [nx,ny,nz]=rotate(v[i+3],v[i+4],v[i+5]);
    const [ex,ey,ez]=unit([-x,-y,3-z]);
    const dot=nx*ex+ny*ey+nz*ez,rx=2*dot*nx-ex,ry=2*dot*ny-ey,rz=2*dot*nz-ez;
    const fresnel=Math.pow(1-Math.min(1,Math.abs(dot)),1.35);
    const phase=(rx*1.2+ry*1.7+hue+fresnel*.9)*.45;
    const shine=Math.exp(-Math.abs(ry-.17-.40*rx)*8), rim=Math.exp(-Math.abs(rx+.54+.12*ry)*14);
    const cap=Math.pow(Math.max(0,(rx*.61+ry*.6+rz*.6)/1.045),30);
    const mix=.50+.43*fresnel,sky=Math.min(1,Math.max(0,(ry+.24)/.96));
    const colour=(offset,base,tint,a,b)=>{
      const film=.52+.48*Math.cos(TAU*(phase+offset));
      const radiance=base*(1-mix)+film*mix+sky*tint+shine*a+rim*b+cap*.85;
      return 255*Math.pow(Math.min(1,Math.max(0,radiance)),.88);
    };
    const scale=h*1.145/(2.38-z*.54);
    projected.set([w*.5+x*scale,h*.5-y*scale,z,colour(.09,.035,.13,.78,1),
      colour(.32,.085,.27,.92,.69),colour(.57,.15,.32,1,.34)],i);
  }
  const ids=mesh.indices,p=projected;
  for(let k=0;k<ids.length;k+=3){
    const a=ids[k]*6,b=ids[k+1]*6,c=ids[k+2]*6;
    const x0=p[a],y0=p[a+1],bx=p[b]-x0,by=p[b+1]-y0,cx=p[c]-x0,cy=p[c+1]-y0;
    const det=bx*cy-by*cx;if(Math.abs(det)<.005)continue;
    const xMin=Math.max(0,Math.floor(Math.min(x0,p[b],p[c]))),xMax=Math.min(w-1,Math.ceil(Math.max(x0,p[b],p[c])));
    const yMin=Math.max(0,Math.floor(Math.min(y0,p[b+1],p[c+1]))),yMax=Math.min(h-1,Math.ceil(Math.max(y0,p[b+1],p[c+1])));
    for(let y=yMin;y<=yMax;y++)for(let x=xMin;x<=xMax;x++){
      const dx=x+.5-x0,dy=y+.5-y0,u=(dx*cy-dy*cx)/det,v=(bx*dy-by*dx)/det,t=1-u-v;
      if(u<0||v<0||t<0)continue;
      const i=y*w+x,z=t*p[a+2]+u*p[b+2]+v*p[c+2];if(z<depth[i])continue;
      depth[i]=z;
      for(let n=0;n<3;n++)pixels[i*4+n]=t*p[a+3+n]+u*p[b+3+n]+v*p[c+3+n];
      pixels[i*4+3]=255;
    }
  }
  ctx.putImageData(mesh.image,0,0);
}
export function createPrism(canvas){
  const mesh=tube();
  let gl=null,render=null, fallback=null;
  function initialize(){
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power'});if(gl)render=material(gl,mesh);}catch{render=null;}
    if(!render){
      if(gl){fallback=document.createElement('canvas');canvas.after(fallback);fallback.className=canvas.className;canvas.hidden=true;}
      const target=fallback||canvas,ctx=target.getContext('2d');
      render=(w,h,...params)=>{if(ctx)software(ctx,mesh,w,h,...params);};
    }
  }
  initialize();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();render=null;});
  canvas.addEventListener('webglcontextrestored',initialize);
  return (audio,gains,motion)=>{
    const target=fallback||canvas;
    if(fallback && canvas.parentElement && fallback.parentElement!==canvas.parentElement)canvas.after(fallback);
    const ratio=gl&&!fallback?Math.min(window.devicePixelRatio||1,1.4):Math.min(1.2,480/Math.max(1,target.clientWidth));
    const w=Math.round(target.clientWidth*ratio),h=Math.round(target.clientHeight*ratio);
    if(!w||!h||!render)return;
    if(target.width!==w||target.height!==h){target.width=w;target.height=h;}
    const g=window.DimauMusicVisuals?.sample(audio);
    const bass=g&&!audio.paused?(g.frequency[3]||0)/255:0;
    const t=motion?audio.currentTime:0;
    render(w,h,.72+gains[0]*.042+.09*Math.sin(t*.31),.52+gains[4]*.063+t*.14,bass*.035,gains[2]*.036);
  };
}
