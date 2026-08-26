(() => {
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
  const mix = (a,b,t) => a + (b-a)*t;
  const ease = t => t*t*(3-2*t);

  const loader = $('#loader');
  const loaderBar = $('#loaderBar');
  const loaderPct = $('#loaderPct');
  const glCanvas = $('#gl');
  const grain = $('#grain');
  const meter = $('#scrollMeter');
  const chapterLabel = $('#chapterLabel');
  const soundKey = $('#soundKey');

  const state = {
    sessionStarted: new Date(),
    contactAt: null,
    contactMoves: 0,
    anomalies: [false,false,false],
    tunerLocked: false,
    tunerBest: 0,
    fragmentBest: 0,
    fragmentHoldMs: 0,
    reconstruction: false,
    lightFound: false,
    audio: false
  };

  const control = {
    freezeP: null,
    manualRot: [0,0,0],
    manualRotTarget: [0,0,0],
    manualScale: 1,
    scanActive: 0,
    scanY: .5,
    scanPulse: 0,
    signalLock: 0,
    darkActive: 0,
    darkAim: [0,0],
    darkAimTarget: [0,0]
  };

  const updaters = new Set();
  const listeners = new Map();
  const api = window.S84 = {
    state,
    control,
    renderer: null,
    ready: false,
    activeAct: 0,
    clamp,
    mix,
    ease,
    $,
    $$,
    addUpdater(fn){ updaters.add(fn); return () => updaters.delete(fn); },
    on(name,fn){ if(!listeners.has(name)) listeners.set(name,new Set()); listeners.get(name).add(fn); return () => listeners.get(name)?.delete(fn); },
    emit(name,payload){ listeners.get(name)?.forEach(fn => { try{ fn(payload); }catch(err){ console.error(err); } }); },
    markContact(){
      if(!state.contactAt){
        state.contactAt = new Date();
        document.body.classList.add('has-contact');
        api.emit('contact', state.contactAt);
      }
    },
    setState(key,value){ state[key]=value; api.emit('statechange',{key,value,state}); },
    audio: null
  };

  function setLoad(v, text){
    const n = Math.round(clamp(v)*100);
    if(loaderBar) loaderBar.style.width = `${n}%`;
    if(loaderPct) loaderPct.textContent = String(n).padStart(2,'0');
    if(text && loader) $('p',loader).textContent = text;
  }
  setLoad(.04);

  // ---------- Audio monitor: intentionally procedural, intentionally opt-in ----------
  function makeAudioController(){
    let ctx=null, master=null, hum=null, humGain=null, returnOsc=null, returnGain=null, noise=null, noiseGain=null, filter=null;
    let enabled=false;

    function ensure(){
      if(ctx) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if(!AudioCtx) return;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 43;
      humGain = ctx.createGain();
      humGain.gain.value = .055;
      hum.connect(humGain).connect(master);

      returnOsc = ctx.createOscillator();
      returnOsc.type = 'triangle';
      returnOsc.frequency.value = 86;
      returnGain = ctx.createGain();
      returnGain.gain.value = .014;
      returnOsc.connect(returnGain).connect(master);

      const frames = Math.max(1, Math.floor(ctx.sampleRate*2));
      const buf = ctx.createBuffer(1,frames,ctx.sampleRate);
      const channel = buf.getChannelData(0);
      for(let i=0;i<frames;i++) channel[i] = Math.random()*2-1;
      noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 480;
      filter.Q.value = .8;
      noiseGain = ctx.createGain();
      noiseGain.gain.value = .018;
      noise.connect(filter).connect(noiseGain).connect(master);

      hum.start(); returnOsc.start(); noise.start();
    }

    async function setEnabled(next){
      ensure();
      if(!ctx) return false;
      if(ctx.state === 'suspended') await ctx.resume();
      enabled = !!next;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(enabled ? .72 : 0, now, .035);
      state.audio = enabled;
      document.body.classList.toggle('audio-on',enabled);
      if(soundKey){ soundKey.setAttribute('aria-pressed',String(enabled)); $('b',soundKey).textContent = enabled ? 'ON' : 'OFF'; }
      api.emit('audio',enabled);
      return enabled;
    }

    function tune(freq, coherence){
      if(!ctx) return;
      const now=ctx.currentTime;
      returnOsc.frequency.setTargetAtTime(70 + freq*2.15, now, .025);
      returnGain.gain.setTargetAtTime(.008 + coherence*.035, now, .04);
      noiseGain.gain.setTargetAtTime(.028 - coherence*.021, now, .05);
      filter.frequency.setTargetAtTime(330 + freq*13, now, .05);
    }

    function stability(v){
      if(!ctx) return;
      const now=ctx.currentTime;
      hum.frequency.setTargetAtTime(43 + v*4, now, .06);
      humGain.gain.setTargetAtTime(.045 + v*.025, now, .08);
      noiseGain.gain.setTargetAtTime(.022 - v*.014, now, .08);
    }

    return { setEnabled, tune, stability, get enabled(){return enabled;}, get context(){return ctx;} };
  }

  api.audio = makeAudioController();
  soundKey?.addEventListener('click',() => api.audio.setEnabled(!api.audio.enabled));

  // ---------- Small matrix library ----------
  function perspective(fovy,aspect,near,far){
    const f=1/Math.tan(fovy/2), nf=1/(near-far), o=new Float32Array(16);
    o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;
  }
  function lookAt(eye,target,up=[0,1,0]){
    let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2];let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
    let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);
  }
  function multiply(a,b){
    const o=new Float32Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return o;
  }
  function trs(p,r,s){
    const [x,y,z]=r,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
    const rx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
    const ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
    const rz=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);
    const m=multiply(rz,multiply(ry,rx));
    m[0]*=s;m[1]*=s;m[2]*=s;m[4]*=s;m[5]*=s;m[6]*=s;m[8]*=s;m[9]*=s;m[10]*=s;m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;
  }

  function parseGLB(buffer){
    const dv=new DataView(buffer);
    if(dv.getUint32(0,true)!==0x46546c67) throw new Error('Not a GLB file');
    let off=12,json,bin;
    while(off<buffer.byteLength){
      const len=dv.getUint32(off,true),type=dv.getUint32(off+4,true);off+=8;
      const chunk=buffer.slice(off,off+len);off+=len;
      if(type===0x4E4F534A) json=JSON.parse(new TextDecoder().decode(chunk).replace(/\0+$/,''));
      if(type===0x004E4942) bin=chunk;
    }
    if(!json||!bin) throw new Error('Incomplete GLB');
    return {json,bin};
  }

  function accessorData(gltf,bin,index){
    const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView];
    const comps={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
    const info={5120:[Int8Array,1],5121:[Uint8Array,1],5122:[Int16Array,2],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]}[a.componentType];
    if(!info||!comps) throw new Error('Unsupported accessor');
    const [Ctor,size]=info,stride=v.byteStride||comps*size,start=(v.byteOffset||0)+(a.byteOffset||0),out=new Ctor(a.count*comps),src=new DataView(bin);
    for(let i=0;i<a.count;i++)for(let c=0;c<comps;c++){
      const o=start+i*stride+c*size;
      out[i*comps+c] = a.componentType===5126?src.getFloat32(o,true):a.componentType===5125?src.getUint32(o,true):a.componentType===5123?src.getUint16(o,true):a.componentType===5122?src.getInt16(o,true):a.componentType===5121?src.getUint8(o):src.getInt8(o);
    }
    return out;
  }

  function compile(gl,type,src){
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)||'Shader compile failed');
    return s;
  }
  function makeProgram(gl,vs,fs){
    const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)||'Program link failed');
    return p;
  }

  const VS=`#version 300 es
  precision highp float;
  in vec3 aPos; in vec3 aNormal; in vec2 aUV;
  uniform mat4 uModel,uView,uProj;
  uniform vec3 uCenter;
  uniform float uMinY,uHeight;
  out vec3 vN; out vec3 vW; out vec2 vUV; out float vUnitY;
  void main(){
    vec3 local=aPos-uCenter;
    vec4 w=uModel*vec4(local,1.0);
    vW=w.xyz;
    vN=normalize(mat3(uModel)*aNormal);
    vUV=aUV;
    vUnitY=clamp((aPos.y-uMinY)/max(uHeight,.0001),0.0,1.0);
    gl_Position=uProj*uView*w;
  }`;

  const FS=`#version 300 es
  precision highp float;
  in vec3 vN; in vec3 vW; in vec2 vUV; in float vUnitY;
  uniform sampler2D uTex;
  uniform vec3 uTint,uLight,uEye;
  uniform float uRim,uMono,uGlow,uScanActive,uScanY,uScanPulse,uSignal;
  out vec4 outColor;
  void main(){
    vec3 tex=texture(uTex,vUV).rgb;
    float gray=dot(tex,vec3(.299,.587,.114));
    tex=mix(tex,vec3(gray),uMono);
    tex*=uTint;
    vec3 n=normalize(vN);
    vec3 l=normalize(uLight);
    float diff=max(dot(n,l),0.0);
    vec3 v=normalize(uEye-vW);
    float rim=pow(1.0-max(dot(n,v),0.0),2.35)*uRim;
    float spec=pow(max(dot(reflect(-l,n),v),0.0),38.0)*.48;
    vec3 col=tex*(.17+diff*.9)+vec3(spec)+vec3(rim)*mix(vec3(1.0),uTint,.22);

    float target=1.0-uScanY;
    float d=abs(vUnitY-target);
    float beam=(1.0-smoothstep(.008,.032,d))*uScanActive;
    float passed=smoothstep(target-.025,target+.025,vUnitY)*uScanActive;
    col=mix(col,col*vec3(.44,.48,.5),passed*.48);
    col+=beam*vec3(1.25,.13,.025)*(1.1+uScanPulse*.35);
    col+=uGlow*rim*vec3(1.0,.12,.028);
    col+=uSignal*vec3(.24,.035,.01)*(rim+.08);
    outColor=vec4(col,1.0);
  }`;

  function fallbackGeometry(){
    const lat=22,lon=30,pos=[],nor=[],uv=[],ind=[];
    for(let y=0;y<=lat;y++){
      const v=y/lat,phi=v*Math.PI;
      for(let x=0;x<=lon;x++){
        const u=x/lon,theta=u*Math.PI*2,sx=Math.sin(phi)*Math.cos(theta),sy=Math.cos(phi),sz=Math.sin(phi)*Math.sin(theta),squash=.83+.17*Math.cos(phi*2);
        pos.push(sx*squash,sy*1.15,sz*squash);nor.push(sx,sy,sz);uv.push(u,v);
      }
    }
    for(let y=0;y<lat;y++)for(let x=0;x<lon;x++){const a=y*(lon+1)+x,b=a+lon+1;ind.push(a,b,a+1,b,b+1,a+1);}
    return {pos:new Float32Array(pos),nor:new Float32Array(nor),uv:new Float32Array(uv),idx:new Uint16Array(ind),source:'procedural fallback'};
  }

  async function responseBuffer(res,from=.12,to=.52){
    const total=Number(res.headers.get('content-length'))||0;
    if(!res.body||!total) return res.arrayBuffer();
    const reader=res.body.getReader(),chunks=[];let received=0;
    while(true){
      const {done,value}=await reader.read(); if(done) break;
      chunks.push(value);received+=value.byteLength;setLoad(mix(from,to,received/total));
    }
    const all=new Uint8Array(received);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.byteLength;}return all.buffer;
  }

  function bounds(pos){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<pos.length;i+=3)for(let a=0;a<3;a++){const v=pos[i+a];if(v<min[a])min[a]=v;if(v>max[a])max[a]=v;}
    return {min,max,center:min.map((v,i)=>(v+max[i])*.5),span:Math.max(...max.map((v,i)=>v-min[i]))};
  }

  async function init3D(){
    const gl=glCanvas?.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false});
    if(!gl) throw new Error('WebGL2 unavailable');
    const p=makeProgram(gl,VS,FS);gl.useProgram(p);setLoad(.1,'initializing optical renderer');

    const urls=['./assets/ScatteringSkull.glb','https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ScatteringSkull/glTF-Binary/ScatteringSkull.glb'];
    let model=null;
    for(const url of urls){
      try{
        const res=await fetch(url,{mode:'cors'}); if(!res.ok) continue;
        setLoad(.14,url.startsWith('http')?'retrieving cc0 specimen':'opening local specimen');
        const {json,bin}=parseGLB(await responseBuffer(res));
        const prim=json.meshes?.[0]?.primitives?.[0]; if(!prim) throw new Error('No primitive');
        const pos=accessorData(json,bin,prim.attributes.POSITION),nor=accessorData(json,bin,prim.attributes.NORMAL),idx=accessorData(json,bin,prim.indices);
        const uv=prim.attributes.TEXCOORD_0!==undefined?accessorData(json,bin,prim.attributes.TEXCOORD_0):new Float32Array(pos.length/3*2);
        model={pos,nor,uv,idx,source:url};break;
      }catch(err){ console.warn('Specimen source failed',url,err); }
    }
    if(!model){ model=fallbackGeometry(); setLoad(.56,'remote specimen unavailable / using geometry fallback'); }

    const b=bounds(model.pos);setLoad(.62,'binding evidence geometry');
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const bind=(name,data,size)=>{const loc=gl.getAttribLocation(p,name);if(loc<0)return;const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);};
    bind('aPos',model.pos,3);bind('aNormal',model.nor,3);bind('aUV',model.uv,2);
    const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,model.idx,gl.STATIC_DRAW);
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([242,239,228,255]));

    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.clearColor(0,0,0,0);
    const U={};['uModel','uView','uProj','uCenter','uMinY','uHeight','uTint','uLight','uEye','uRim','uMono','uGlow','uScanActive','uScanY','uScanPulse','uSignal','uTex'].forEach(n=>U[n]=gl.getUniformLocation(p,n));
    gl.uniform1i(U.uTex,0);
    api.renderer={gl,p,vao,U,tex,center:new Float32Array(b.center),minY:b.min[1],height:b.max[1]-b.min[1],baseScale:1.9/b.span,source:model.source,count:model.idx.length,indexType:model.idx instanceof Uint32Array?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT};
    setLoad(.9,'calibrating field instruments');
  }

  const frames=[
    {p:0,   pos:[.72,-.06,.05],rot:[-.06,-.55,.02],scale:1.00,tint:[.84,.86,.84],mono:.82,rim:.42,glow:.04,light:[-1.8,2.4,3]},
    {p:.20, pos:[.67,-.03,.04],rot:[.02,.72,-.01],scale:1.13,tint:[.76,.78,.75],mono:.94,rim:.30,glow:.02,light:[1.7,2.7,2]},
    {p:.39, pos:[.34,.08,.08], rot:[-.10,2.18,.04],scale:1.28,tint:[.92,.85,.77],mono:.98,rim:.75,glow:.35,light:[-1.6,.7,2.4]},
    {p:.58, pos:[.68,.03,.08], rot:[2.70,3.08,.58],scale:1.25,tint:[.76,.73,.68],mono:1,rim:.36,glow:.12,light:[2,-.8,1.4]},
    {p:.78, pos:[.57,-.06,.03],rot:[.02,5.10,0],scale:1.10,tint:[.88,.84,.75],mono:.82,rim:.26,glow:.02,light:[-.8,2.6,3]},
    {p:1,   pos:[.36,.02,.12], rot:[-.03,6.25,0],scale:1.34,tint:[.91,.91,.88],mono:.98,rim:.66,glow:.18,light:[1.5,1.7,2.2]}
  ];

  function frameAt(p){
    let a=frames[0],b=frames.at(-1);
    for(let i=0;i<frames.length-1;i++) if(p>=frames[i].p&&p<=frames[i+1].p){a=frames[i];b=frames[i+1];break;}
    const t=ease(clamp((p-a.p)/(b.p-a.p||1)));
    return {pos:a.pos.map((v,i)=>mix(v,b.pos[i],t)),rot:a.rot.map((v,i)=>mix(v,b.rot[i],t)),scale:mix(a.scale,b.scale,t),tint:a.tint.map((v,i)=>mix(v,b.tint[i],t)),mono:mix(a.mono,b.mono,t),rim:mix(a.rim,b.rim,t),glow:mix(a.glow,b.glow,t),light:a.light.map((v,i)=>mix(v,b.light[i],t))};
  }

  function currentProgress(){
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    return clamp(scrollY/max);
  }

  function draw3D(time){
    const r=api.renderer;if(!r)return;
    const {gl,vao,U,count,indexType}=r;
    const p=control.freezeP==null?currentProgress():control.freezeP;
    const f=frameAt(p);
    for(let i=0;i<3;i++) control.manualRot[i]=mix(control.manualRot[i],control.manualRotTarget[i],.105);
    control.darkAim[0]=mix(control.darkAim[0],control.darkAimTarget[0],.06);control.darkAim[1]=mix(control.darkAim[1],control.darkAimTarget[1],.06);
    f.rot=f.rot.map((v,i)=>v+control.manualRot[i]);
    if(control.darkActive){f.rot[1]+=control.darkAim[0]*.32;f.rot[0]+=-control.darkAim[1]*.13;}
    f.rot[1]+=Math.sin(time*.00017)*.025;
    f.scale*=r.baseScale*control.manualScale;
    if(innerWidth<900){f.scale*=.73;f.pos[0]*=.58;f.pos[1]*=.92;}
    const eye=[0,0,4.85],view=lookAt(eye,[0,0,0]),proj=perspective(35*Math.PI/180,glCanvas.width/glCanvas.height,.01,100),model=trs(f.pos,f.rot,f.scale);
    gl.viewport(0,0,glCanvas.width,glCanvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(r.p);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,r.tex);
    gl.uniform3fv(U.uCenter,r.center);gl.uniform1f(U.uMinY,r.minY);gl.uniform1f(U.uHeight,r.height);gl.uniformMatrix4fv(U.uModel,false,model);gl.uniformMatrix4fv(U.uView,false,view);gl.uniformMatrix4fv(U.uProj,false,proj);gl.uniform3fv(U.uTint,f.tint);gl.uniform3fv(U.uLight,f.light);gl.uniform3fv(U.uEye,eye);gl.uniform1f(U.uRim,f.rim);gl.uniform1f(U.uMono,f.mono);gl.uniform1f(U.uGlow,f.glow);gl.uniform1f(U.uScanActive,control.scanActive);gl.uniform1f(U.uScanY,control.scanY);gl.uniform1f(U.uScanPulse,control.scanPulse);gl.uniform1f(U.uSignal,control.signalLock);gl.drawElements(gl.TRIANGLES,count,indexType,0);
  }

  function resize(){
    const dpr=Math.min(devicePixelRatio||1,1.6),w=Math.max(1,Math.round(innerWidth*dpr)),h=Math.max(1,Math.round(innerHeight*dpr));
    if(glCanvas && (glCanvas.width!==w||glCanvas.height!==h)){glCanvas.width=w;glCanvas.height=h;}
    if(grain){grain.width=Math.max(1,Math.floor(innerWidth/3));grain.height=Math.max(1,Math.floor(innerHeight/3));}
  }

  function drawGrain(){
    if(!grain)return;const ctx=grain.getContext('2d');if(!ctx)return;const img=ctx.createImageData(grain.width,grain.height),d=img.data;
    for(let i=0;i<d.length;i+=4){const v=Math.random()*255|0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=38;}
    ctx.putImageData(img,0,0);
  }

  const sections=$$('[data-chapter]');
  let chapterCheck=0;
  function updateChapter(){
    const line=innerHeight*.34;let best=0,bestD=Infinity;
    sections.forEach((s,i)=>{const r=s.getBoundingClientRect(),d=Math.abs(r.top-line);if(d<bestD){bestD=d;best=i;}});
    if(best!==api.activeAct){api.activeAct=best;document.body.dataset.act=String(best+1).padStart(2,'0');api.emit('act',best);}
    if(chapterLabel) chapterLabel.textContent=String(best+1).padStart(2,'0');
  }

  let lastTime=performance.now();
  function tick(time){
    const dt=Math.min(50,time-lastTime);lastTime=time;
    const p=currentProgress();if(meter)meter.style.height=`${p*100}%`;
    control.scanPulse=.5+.5*Math.sin(time*.012);
    draw3D(time);
    updaters.forEach(fn=>{try{fn({time,dt,p,activeAct:api.activeAct});}catch(err){console.error('S84 updater',err);}});
    if(time-chapterCheck>110){updateChapter();chapterCheck=time;}
    requestAnimationFrame(tick);
  }

  addEventListener('resize',resize,{passive:true});resize();setInterval(drawGrain,150);drawGrain();updateChapter();

  init3D().then(()=>{
    setLoad(1,'evidence container open');
    api.ready=true;api.emit('ready',api.renderer);
    setTimeout(()=>loader?.classList.add('is-done'),260);
  }).catch(err=>{
    console.error(err);setLoad(1,'optical renderer unavailable / instruments remain active');
    setTimeout(()=>loader?.classList.add('is-done'),700);
  }).finally(()=>requestAnimationFrame(tick));
})();
