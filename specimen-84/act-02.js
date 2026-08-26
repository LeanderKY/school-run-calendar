(() => {
  'use strict';
  const S=window.S84;if(!S)return;
  const scanner=S.$('#scanner'),beam=S.$('#scannerBeam'),depth=S.$('#scanDepth'),section=S.$('#scanSection'),pass=S.$('#scanPass'),count=S.$('#anomalyCount');
  const marks=S.$$('.scanner__anomaly'),logs=S.$$('.anomaly-log li');
  if(!scanner||!beam)return;

  scanner.tabIndex=0;
  let dragging=false,pointerId=null,passes=1,lastValue=.5;
  const anomalyValues=[.23,.54,.79];
  const anomalyCopy=[
    'A / seam repeats beneath outer surface',
    'B / internal return precedes light plane',
    'C / density gradient reverses direction'
  ];

  function setValue(v,fromUser=true){
    v=S.clamp(v,.015,.985);lastValue=v;S.control.scanY=v;
    beam.style.setProperty('--scan',v);
    if(depth)depth.textContent=`${v<.5?'-':'+'}${Math.abs((v-.5)*32).toFixed(1)}`;
    if(section)section.textContent=v.toFixed(2);
    anomalyValues.forEach((target,i)=>{
      const proximity=Math.abs(v-target);
      if(proximity<.023&&!S.state.anomalies[i]){
        S.state.anomalies[i]=true;
        marks[i]?.classList.add('is-found');logs[i]?.classList.add('is-found');
        if(logs[i])logs[i].querySelector('span').textContent=anomalyCopy[i];
        if(count)count.textContent=String(S.state.anomalies.filter(Boolean).length);
        S.emit('anomaly',{index:i,value:v});
        if(fromUser&&navigator.vibrate)navigator.vibrate(9);
      }
    });
  }

  function fromPointer(e){
    const r=scanner.getBoundingClientRect();
    setValue((e.clientY-r.top)/Math.max(1,r.height),true);
  }

  scanner.addEventListener('pointerdown',e=>{
    if(e.button!==undefined&&e.button!==0)return;
    dragging=true;pointerId=e.pointerId;scanner.setPointerCapture?.(e.pointerId);document.body.classList.add('is-scanning');passes++;if(pass)pass.textContent=String(Math.min(99,passes)).padStart(2,'0');
    fromPointer(e);e.preventDefault();
  });
  scanner.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==pointerId)return;fromPointer(e);e.preventDefault();});
  function release(){
    if(!dragging)return;dragging=false;document.body.classList.remove('is-scanning');
    if(pointerId!==null&&scanner.hasPointerCapture?.(pointerId))scanner.releasePointerCapture(pointerId);pointerId=null;
  }
  scanner.addEventListener('pointerup',release);scanner.addEventListener('pointercancel',release);

  scanner.addEventListener('keydown',e=>{
    let v=lastValue,used=true,step=e.shiftKey?.04:.012;
    if(e.key==='ArrowUp')v-=step;else if(e.key==='ArrowDown')v+=step;else if(e.key==='Home')v=.02;else if(e.key==='End')v=.98;else used=false;
    if(used){setValue(v,true);e.preventDefault();}
  });

  S.on('act',i=>{S.control.scanActive=i===1?1:0;if(i!==1)document.body.classList.remove('is-scanning');});
  S.control.scanActive=S.activeAct===1?1:0;
  setValue(.5,false);
})();
