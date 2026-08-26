(() => {
  'use strict';
  const S=window.S84;if(!S)return;
  const plate=S.$('#stabilizer'),value=S.$('#holdValue'),timeEl=S.$('#holdTime'),ghost=S.$('.transcript--ghost');
  if(!plate)return;

  let holding=false,pointerId=null,stability=0,latched=false;

  function begin(e){
    if(e?.button!==undefined&&e.button!==0)return;
    holding=true;S.markContact();
    if(e?.pointerId!==undefined){pointerId=e.pointerId;plate.setPointerCapture?.(e.pointerId);}
    document.body.classList.add('is-stabilizing');
    e?.preventDefault?.();
  }
  function end(){
    if(!holding)return;
    holding=false;document.body.classList.remove('is-stabilizing');
    if(pointerId!==null&&plate.hasPointerCapture?.(pointerId))plate.releasePointerCapture(pointerId);pointerId=null;
  }

  plate.addEventListener('pointerdown',begin);
  plate.addEventListener('pointerup',end);
  plate.addEventListener('pointercancel',end);
  plate.addEventListener('lostpointercapture',()=>{holding=false;document.body.classList.remove('is-stabilizing');pointerId=null;});
  plate.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat)begin(e);});
  plate.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){end();e.preventDefault();}});
  plate.addEventListener('blur',end);

  S.addUpdater(({time,dt,activeAct})=>{
    if(activeAct!==3&&holding)end();
    if(holding){
      stability=S.clamp(stability+dt/1180);
      S.state.fragmentHoldMs+=dt;
    }else{
      stability=S.clamp(stability-dt/720);
    }
    S.state.fragmentBest=Math.max(S.state.fragmentBest,stability);
    plate.style.setProperty('--stability',stability.toFixed(3));
    if(value)value.textContent=String(Math.round(stability*100)).padStart(2,'0');
    if(timeEl)timeEl.textContent=`${(S.state.fragmentHoldMs/1000).toFixed(2)} s`;
    if(ghost){
      const amp=(1-stability)*8;
      const x=Math.sin(time*.031)*amp+Math.sin(time*.077)*amp*.32;
      const y=Math.cos(time*.043)*amp*.48;
      const skew=Math.sin(time*.018)*(1-stability)*1.8;
      ghost.style.transform=`translate(${x.toFixed(2)}px,calc(-50% + ${y.toFixed(2)}px)) skewX(${skew.toFixed(2)}deg)`;
    }
    if(stability>.94&&!latched){
      latched=true;S.emit('fragmentstable',{holdMs:S.state.fragmentHoldMs});
      if(navigator.vibrate)navigator.vibrate(16);
    }else if(stability<.55){latched=false;}
    S.audio?.stability(stability);
  });
})();
