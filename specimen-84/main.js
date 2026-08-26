const $ = (s) => document.querySelector(s);
const clamp = (v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const mix = (a,b,t)=>a+(b-a)*t;
const ease = t => t*t*(3-2*t);

const loader = $('#loader');
const loaderBar = $('#loaderBar');
const loaderPct = $('#loaderPct');
const glCanvas = $('#gl');
const grain = $('#grain');
const meter = $('#scrollMeter');
const chapterLabel = $('#chapterLabel');

function setLoad(v){ const n=Math.round(v*100); loaderBar.style.width=`${n}%`; loaderPct.textContent=String(n).padStart(2,'0'); }
setLoad(.08);

// Minimal math — intentionally no rendering framework.
function ident(){ return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
function perspective(fovy,aspect,near,far){
  const f=1/Math.tan(fovy/2), nf=1/(near-far), o=new Float32Array(16);
  o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;
}
function lookAt(eye,target,up=[0,1,0]){
  let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2]; let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
  let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
  let yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);
}
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];return o}
function trs(p,r,s){
  const [x,y,z]=r,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
  const rx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
  const ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
  const rz=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);
  let m=multiply(rz,multiply(ry,rx));m[0]*=s;m[1]*=s;m[2]*=s;m[4]*=s;m[5]*=s;m[6]*=s;m[8]*=s;m[9]*=s;m[10]*=s;m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;
}

function parseGLB(buffer){
  const dv=new DataView(buffer); if(dv.getUint32(0,true)!==0x46546c67) throw new Error('Not a GLB file');
  let off=12,json,bin;
  while(off<buffer.byteLength){const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);off+=8;const chunk=buffer.slice(off,off+len);off+=len;if(type===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(chunk).replace(/\0+$/,''));if(type===0x004E4942)bin=chunk}
  return {json,bin};
}
function accessorData(gltf,bin,index){
  const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView];
  const comps={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  const info={5120:[Int8Array,1],5121:[Uint8Array,1],5122:[Int16Array,2],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]}[a.componentType];
  const [Ctor,size]=info,stride=v.byteStride||comps*size,start=(v.byteOffset||0)+(a.byteOffset||0),out=new Ctor(a.count*comps),src=new DataView(bin);
  for(let i=0;i<a.count;i++)for(let c=0;c<comps;c++){
    const o=start+i*stride+c*size; let val;
    if(a.componentType===5126)val=src.getFloat32(o,true);else if(a.componentType===5125)val=src.getUint32(o,true);else if(a.componentType===5123)val=src.getUint16(o,true);else if(a.componentType===5122)val=src.getInt16(o,true);else if(a.componentType===5121)val=src.getUint8(o);else val=src.getInt8(o); out[i*comps+c]=val;
  }
  return out;
}
function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function program(gl,vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p}

const VS=`#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNormal; in vec2 aUV;
uniform mat4 uModel,uView,uProj; uniform vec3 uCenter;
out vec3 vN; out vec3 vW; out vec2 vUV;
void main(){vec4 w=uModel*vec4(aPos-uCenter,1.0);vW=w.xyz;vN=normalize(mat3(uModel)*aNormal);vUV=aUV;gl_Position=uProj*uView*w;}`;
const FS=`#version 300 es
precision highp float;
in vec3 vN; in vec3 vW; in vec2 vUV;
uniform sampler2D uTex; uniform vec3 uTint; uniform vec3 uLight; uniform vec3 uEye; uniform float uRim; uniform float uMono; uniform float uGlow;
out vec4 outColor;
void main(){vec3 tex=texture(uTex,vUV).rgb;float gray=dot(tex,vec3(.299,.587,.114));tex=mix(tex,vec3(gray),uMono);tex*=uTint;vec3 n=normalize(vN);float diff=max(dot(n,normalize(uLight)),0.0);vec3 v=normalize(uEye-vW);float rim=pow(1.0-max(dot(n,v),0.0),2.4)*uRim;float spec=pow(max(dot(reflect(-normalize(uLight),n),v),0.0),42.0)*.55;vec3 col=tex*(.18+diff*.88)+vec3(spec)+vec3(rim)*mix(vec3(1.0),uTint,.25)+uGlow*vec3(1.0,.14,.035)*rim;outColor=vec4(col,1.0);}`;

function fallbackGeometry(){
  const lat=20,lon=28,pos=[],nor=[],uv=[],ind=[];
  for(let y=0;y<=lat;y++){const v=y/lat,phi=v*Math.PI;for(let x=0;x<=lon;x++){const u=x/lon,theta=u*Math.PI*2;const sx=Math.sin(phi)*Math.cos(theta),sy=Math.cos(phi),sz=Math.sin(phi)*Math.sin(theta);const squash=.84+.16*Math.cos(phi*2);pos.push(sx*squash,sy*1.16,sz*squash);nor.push(sx,sy,sz);uv.push(u,v)}}
  for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;ind.push(a,b,a+1,b,b+1,a+1)}
  return {pos:new Float32Array(pos),nor:new Float32Array(nor),uv:new Float32Array(uv),idx:new Uint16Array(ind),source:'procedural fallback'};
}

async function responseBuffer(res,from=.18,to=.46){
  const total=Number(res.headers.get('content-length'))||0;
  if(!res.body||!total)return res.arrayBuffer();
  const reader=res.body.getReader(),chunks=[];let received=0;
  while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.byteLength;setLoad(mix(from,to,clamp(received/total)))}
  const all=new Uint8Array(received);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.byteLength}return all.buffer;
}

function geometryBounds(pos){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<pos.length;i+=3)for(let a=0;a<3;a++){const v=pos[i+a];if(v<min[a])min[a]=v;if(v>max[a])max[a]=v}
  const center=min.map((v,i)=>(v+max[i])*.5),span=Math.max(...max.map((v,i)=>v-min[i]));
  return {center,span};
}

let renderer=null;
async function init3D(){
  const gl=glCanvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false});
  if(!gl) throw new Error('WebGL2 unavailable');
  const p=program(gl,VS,FS); gl.useProgram(p); setLoad(.16);

  const urls=[
    './assets/ScatteringSkull.glb',
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ScatteringSkull/glTF-Binary/ScatteringSkull.glb'
  ];
  let model=null;
  for(const url of urls){
    try{
      const res=await fetch(url,{mode:'cors'}); if(!res.ok) continue;
      loader.querySelector('p').textContent=url.startsWith('http')?'DOWNLOADING CC0 SPECIMEN':'DECODING LOCAL SPECIMEN';
      const {json,bin}=parseGLB(await responseBuffer(res,.18,.45)); setLoad(.48);
      const prim=json.meshes[0].primitives[0];
      const pos=accessorData(json,bin,prim.attributes.POSITION),nor=accessorData(json,bin,prim.attributes.NORMAL),idx=accessorData(json,bin,prim.indices);
      const uv=prim.attributes.TEXCOORD_0!==undefined?accessorData(json,bin,prim.attributes.TEXCOORD_0):new Float32Array((pos.length/3)*2);
      model={pos,nor,uv,idx,source:url}; break;
    }catch(err){console.warn('Model source failed',url,err)}
  }
  if(!model){model=fallbackGeometry();loader.querySelector('p').textContent='OFFLINE FALLBACK / REMOTE MODEL NOT REACHED'}

  const {pos,nor,uv,idx}=model,{center,span}=geometryBounds(pos); setLoad(.62);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const bind=(name,data,size)=>{const loc=gl.getAttribLocation(p,name),b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0)};
  bind('aPos',pos,3);bind('aNormal',nor,3);bind('aUV',uv,2);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);

  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(0,0,0,0);
  const U={};['uModel','uView','uProj','uCenter','uTint','uLight','uEye','uRim','uMono','uGlow','uTex'].forEach(n=>U[n]=gl.getUniformLocation(p,n)); gl.uniform1i(U.uTex,0);
  setLoad(.86);
  renderer={gl,p,vao,U,tex,center:new Float32Array(center),baseScale:1.8/span,source:model.source,count:idx.length,indexType:idx instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT};
}

const frames=[
  {p:0,   pos:[.72,-.25,0],   rot:[-.08,-.52,.03], scale:1.00,tint:[.82,.86,.90],mono:.78,rim:.48,glow:.05,light:[-1.5,2.2,3]},
  {p:.18, pos:[.55,-.05,0],   rot:[.03,1.12,-.02], scale:1.14,tint:[.72,.78,.86],mono:.94,rim:.3,glow:0,light:[1.8,2.6,2]},
  {p:.37, pos:[.25,.10,.35],  rot:[-.15,2.22,.08], scale:1.46,tint:[1,.9,.82],mono:.98,rim:.95,glow:.82,light:[-2,.4,2]},
  {p:.57, pos:[.92,.22,.1],   rot:[2.7,3.2,.62], scale:1.37,tint:[.74,.72,.68],mono:1,rim:.4,glow:.18,light:[2,-1.2,1]},
  {p:.76, pos:[.55,-.10,0],   rot:[.04,5.15,0], scale:1.09,tint:[.91,.86,.74],mono:.76,rim:.24,glow:0,light:[-1,2.5,3]},
  {p:1,   pos:[0,.02,.15],    rot:[-.04,6.3,0], scale:1.37,tint:[.94,.95,.97],mono:.96,rim:.75,glow:.35,light:[1.7,1.8,2.2]}
];
function frameAt(p){let a=frames[0],b=frames.at(-1);for(let i=0;i<frames.length-1;i++)if(p>=frames[i].p&&p<=frames[i+1].p){a=frames[i];b=frames[i+1];break}const t=ease(clamp((p-a.p)/(b.p-a.p||1)));return {pos:a.pos.map((v,i)=>mix(v,b.pos[i],t)),rot:a.rot.map((v,i)=>mix(v,b.rot[i],t)),scale:mix(a.scale,b.scale,t),tint:a.tint.map((v,i)=>mix(v,b.tint[i],t)),mono:mix(a.mono,b.mono,t),rim:mix(a.rim,b.rim,t),glow:mix(a.glow,b.glow,t),light:a.light.map((v,i)=>mix(v,b.light[i],t))}}
let pointer={x:0,y:0,tx:0,ty:0};
addEventListener('pointermove',e=>{pointer.tx=(e.clientX/innerWidth-.5)*2;pointer.ty=(e.clientY/innerHeight-.5)*2},{passive:true});

function resize(){
  const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(glCanvas.width!==w||glCanvas.height!==h){glCanvas.width=w;glCanvas.height=h}
  grain.width=Math.max(1,Math.floor(innerWidth/3));grain.height=Math.max(1,Math.floor(innerHeight/3));
}
addEventListener('resize',resize,{passive:true});resize();

function draw3D(p,time){if(!renderer)return;const {gl,vao,U,count,indexType}=renderer;const f=frameAt(p);pointer.x=mix(pointer.x,pointer.tx,.035);pointer.y=mix(pointer.y,pointer.ty,.035);const interactive=clamp((p-.84)/.16);f.rot[1]+=pointer.x*.18*interactive;f.rot[0]+=pointer.y*.08*interactive;f.rot[1]+=Math.sin(time*.00016)*.035;
 f.scale*=renderer.baseScale;
 if(innerWidth<700){f.scale*=.72;f.pos[0]*=.54;f.pos[1]*=.92;}
 const aspect=glCanvas.width/glCanvas.height,eye=[0,0,4.8],view=lookAt(eye,[0,0,0]),proj=perspective(35*Math.PI/180,aspect,.01,100),model=trs(f.pos,f.rot,f.scale);
 gl.viewport(0,0,glCanvas.width,glCanvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(renderer.p);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);
 gl.bindTexture(gl.TEXTURE_2D,renderer.tex);gl.uniform3fv(U.uCenter,renderer.center);gl.uniformMatrix4fv(U.uModel,false,model);gl.uniformMatrix4fv(U.uView,false,view);gl.uniformMatrix4fv(U.uProj,false,proj);gl.uniform3fv(U.uTint,f.tint);gl.uniform3fv(U.uLight,f.light);gl.uniform3fv(U.uEye,eye);gl.uniform1f(U.uRim,f.rim);gl.uniform1f(U.uMono,f.mono);gl.uniform1f(U.uGlow,f.glow);gl.drawElements(gl.TRIANGLES,count,indexType,0);
}

function drawGrain(){const ctx=grain.getContext('2d');const img=ctx.createImageData(grain.width,grain.height);for(let i=0;i<img.data.length;i+=4){const v=Math.random()*255|0;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=45}ctx.putImageData(img,0,0)}
setInterval(drawGrain,130);drawGrain();

const wave=$('#wave'),wctx=wave.getContext('2d');
function drawWave(time){const rect=wave.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));if(wave.width!==w||wave.height!==h){wave.width=w;wave.height=h}wctx.clearRect(0,0,w,h);wctx.strokeStyle='rgba(255,75,34,.95)';wctx.lineWidth=Math.max(1,dpr);wctx.beginPath();for(let x=0;x<w;x++){const t=x/w*11.5,burst=Math.pow(Math.max(0,Math.sin(t*1.8+time*.001)),9),y=h*.5+(Math.sin(t*5.2)*.035+Math.sin(t*13.3)*.012+burst*Math.sin(t*34)*.22)*h;(x? wctx.lineTo(x,y):wctx.moveTo(x,y))}wctx.stroke();}

const sections=[...document.querySelectorAll('[data-chapter]')];
function updateChapter(){let best=sections[0],dist=1e9;for(const s of sections){const r=s.getBoundingClientRect(),d=Math.abs(r.top-innerHeight*.25);if(d<dist){dist=d;best=s}}chapterLabel.textContent=best.dataset.chapter}
let last=0;
function tick(time){
 const max=Math.max(1,document.documentElement.scrollHeight-innerHeight),p=clamp(scrollY/max);meter.style.height=`${p*100}%`;draw3D(p,time);drawWave(time);if(time-last>120){updateChapter();last=time}requestAnimationFrame(tick)
}

init3D().then(()=>{setLoad(1);setTimeout(()=>loader.classList.add('is-done'),280);requestAnimationFrame(tick)}).catch(err=>{console.error(err);loader.querySelector('p').textContent='WEBGL FALLBACK / MODEL UNAVAILABLE';loaderPct.textContent='--';setTimeout(()=>loader.classList.add('is-done'),900);requestAnimationFrame(tick)});
