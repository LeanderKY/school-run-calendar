(() => {
  'use strict';
  const S=window.S84;if(!S)return;
  const input=S.$('#freqInput'),valueEl=S.$('#freqValue'),needle=S.$('#tunerNeedle'),fragment=S.$('#signalFragment'),wave=S.$('#wave');
  if(!input||!wave)return;
  const ctx=wave.getContext('2d');
  const target=13.8;
  let freq=Number(input.value)||11.2,coherence=0,lockHold=0,locked=false;

  function calculate(){
    const dist=Math.abs(freq-target);
    coherence=Math.pow(S.clamp(1-dist/1.55),1.7);
    S.state.tunerBest=Math.max(S.state.tunerBest,coherence);
    if(S.activeAct===2)S.control.signalLock=coherence;
    if(valueEl)valueEl.textContent=freq.toFixed(2);
    if(needle)needle.style.setProperty('--x',`${((freq-9)/9)*100}%`);
    S.audio?.tune(freq,coherence);
  }

  input.addEventListener('input',()=>{freq=Number(input.value);calculate();});
  input.addEventListener('pointerdown',()=>S.markContact());

  function resizeWave(){
    const r=wave.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(1,Math.floor(r.width*dpr)),h=Math.max(1,Math.floor(r.height*dpr));
    if(wave.width!==w||wave.height!==h){wave.width=w;wave.height=h;}
  }

  function draw(time){
    resizeWave();
    const w=wave.width,h=wave.height;
    ctx.clearRect(0,0,w,h);
    ctx.lineWidth=Math.max(1,w/1400);
    const baseAlpha=.42+coherence*.5;
    ctx.strokeStyle=`rgba(255,61,24,${baseAlpha})`;
    ctx.beginPath();
    const noiseAmp=(1-coherence)*h*.19;
    const signalAmp=(.04+coherence*.15)*h;
    for(let x=0;x<w;x++){
      const u=x/Math.max(1,w-1),phase=u*Math.PI*2*7.25;
      const deterministicNoise=(Math.sin(phase*6.17+time*.021)+Math.sin(phase*13.71-time*.017)+Math.sin(phase*29.3+time*.009))*.333;
      const burst=Math.pow(Math.max(0,Math.sin(phase*.57+time*.0014)),10)*Math.sin(phase*5.4+time*.013);
      const coherent=Math.sin(phase+time*.0042)*.56+Math.sin(phase*2.01+time*.0021)*.17;
      const y=h*.5+deterministicNoise*noiseAmp+burst*noiseAmp*.52+coherent*signalAmp;
      if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();

    if(coherence>.6){
      ctx.strokeStyle=`rgba(238,232,219,${(coherence-.6)*.9})`;ctx.lineWidth=1;ctx.beginPath();
      const y=h*.5;ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
    }
  }

  S.addUpdater(({time,dt,activeAct})=>{
    if(activeAct!==2){if(S.control.signalLock!==0)S.control.signalLock=0;return;}
    S.control.signalLock=coherence;
    draw(time);
    if(coherence>.965&&!locked){
      lockHold+=dt;
      if(lockHold>=520){
        locked=true;S.state.tunerLocked=true;S.emit('tunerlock',{freq});
        fragment?.classList.add('is-locked');
        const p=fragment?.querySelector('p');if(p)p.textContent='THE ROOM WAS EMPTY BEFORE YOU OPENED IT.';
        if(navigator.vibrate)navigator.vibrate([12,35,12]);
      }
    }else if(!locked){lockHold=Math.max(0,lockHold-dt*1.8);}
  });

  S.on('act',i=>{if(i!==2)S.control.signalLock=0;else calculate();});
  addEventListener('resize',resizeWave,{passive:true});
  calculate();resizeWave();
})();
