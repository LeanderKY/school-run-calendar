(() => {
  'use strict';
  const S=window.S84;if(!S)return;
  const room=S.$('#darkroom'),trace=S.$('#operatorTrace'),releaseStatus=S.$('.release-status b'),restart=S.$('.restart');
  if(!room)return;

  room.tabIndex=0;
  let dragging=false,pointerId=null,x=.72,y=.58;
  const mark={x:.80,y:.58};

  function sessionCode(){
    const t=S.state.sessionStarted.getTime();
    return `OP-${String((t>>>5)%100000).padStart(5,'0')}`;
  }

  function fmtTime(date){return date?date.toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}):'NONE';}

  function buildTrace(){
    if(!trace)return;
    const anomalyN=S.state.anomalies.filter(Boolean).length;
    const stable=Math.round(S.state.fragmentBest*100);
    const rows=[
      ['FIRST CONTACT',fmtTime(S.state.contactAt)],
      ['OPTICAL ANOMALIES',`${anomalyN}/3`],
      ['13.8 HZ LOCK',S.state.tunerLocked?'HELD':'NOT HELD'],
      ['MAX STABILITY',`${stable}%`],
      ['FRAME CONTINUITY',S.state.reconstruction?'RESTORED':'BROKEN'],
      ['SECOND SHADOW',S.state.lightFound?'ACQUIRED':'UNRESOLVED']
    ];
    const b=trace.querySelector('b'),ul=trace.querySelector('ul');
    if(b)b.textContent=`${sessionCode()} / TRACE INCLUDED`;
    if(ul)ul.innerHTML=rows.map(([a,bv])=>`<li><span>${a}</span><span>${bv}</span></li>`).join('');
    if(releaseStatus)releaseStatus.textContent=S.state.contactAt?'EVIDENCE + OPERATOR':'OPEN';
  }

  function setLight(nx,ny,fromUser=true){
    x=S.clamp(nx,.02,.98);y=S.clamp(ny,.02,.98);
    room.style.setProperty('--light-x',`${(x*100).toFixed(2)}%`);room.style.setProperty('--light-y',`${(y*100).toFixed(2)}%`);
    S.control.darkAimTarget[0]=(x-.5)*2;S.control.darkAimTarget[1]=(y-.5)*2;
    const d=Math.hypot(x-mark.x,y-mark.y);
    if(d<.115&&!S.state.lightFound){
      S.state.lightFound=true;room.classList.add('has-found-mark');S.emit('lightmark',{x,y});
      if(fromUser&&navigator.vibrate)navigator.vibrate([12,20,12]);
      buildTrace();
    }
  }

  function fromPointer(e){
    const r=room.getBoundingClientRect();setLight((e.clientX-r.left)/Math.max(1,r.width),(e.clientY-r.top)/Math.max(1,r.height),true);
  }

  room.addEventListener('pointerdown',e=>{
    if(e.button!==undefined&&e.button!==0)return;
    dragging=true;pointerId=e.pointerId;room.setPointerCapture?.(e.pointerId);S.markContact();fromPointer(e);buildTrace();e.preventDefault();
  });
  room.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==pointerId)return;fromPointer(e);e.preventDefault();});
  function end(){
    if(!dragging)return;dragging=false;
    if(pointerId!==null&&room.hasPointerCapture?.(pointerId))room.releasePointerCapture(pointerId);pointerId=null;
  }
  room.addEventListener('pointerup',end);room.addEventListener('pointercancel',end);

  room.addEventListener('keydown',e=>{
    const step=e.shiftKey ? .015 : .045;let used=true;
    if(e.key==='ArrowLeft')x-=step;else if(e.key==='ArrowRight')x+=step;else if(e.key==='ArrowUp')y-=step;else if(e.key==='ArrowDown')y+=step;else used=false;
    if(used){S.markContact();setLight(x,y,true);buildTrace();e.preventDefault();}
  });

  S.on('act',i=>{
    S.control.darkActive=i===5?1:0;
    if(i===5)buildTrace();
  });
  S.on('statechange',buildTrace);S.on('anomaly',buildTrace);S.on('tunerlock',buildTrace);S.on('fragmentstable',buildTrace);S.on('reconstruction',buildTrace);S.on('contact',buildTrace);

  restart?.addEventListener('click',e=>{
    e.preventDefault();history.replaceState(null,'',`${location.pathname}${location.search}#acquire`);location.reload();
  });

  setLight(x,y,false);buildTrace();
})();
