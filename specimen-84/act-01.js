(() => {
  'use strict';
  const S=window.S84;if(!S)return;
  const field=S.$('#acquireField'),seal=S.$('#custodySeal'),trace=S.$('#contactTrace'),side=S.$('#custodyState'),header=S.$('#custodyHeader');
  if(!field)return;

  field.tabIndex=0;
  let dragging=false,pointerId=null,startX=0,startY=0,startRot=[0,0,0],moved=0;

  function stampContact(){
    const first=!S.state.contactAt;
    S.markContact();
    seal?.classList.add('is-broken');
    if(side)side.textContent='COMPROMISED';
    if(header)header.textContent='COMPROMISED';
    if(first && navigator.vibrate) navigator.vibrate(12);
    updateTrace();
  }

  function updateTrace(){
    if(!trace||!S.state.contactAt)return;
    const t=S.state.contactAt.toLocaleTimeString([],{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const deg=Math.round(Math.abs(S.control.manualRotTarget[1])*57.2958);
    trace.textContent=`OPERATOR CONTACT ${t} / HANDLING DEVIATION ${String(deg).padStart(2,'0')}° / TRACE RETAINED`;
  }

  field.addEventListener('pointerdown',e=>{
    if(e.button!==undefined&&e.button!==0)return;
    dragging=true;pointerId=e.pointerId;startX=e.clientX;startY=e.clientY;startRot=[...S.control.manualRotTarget];moved=0;
    field.setPointerCapture?.(e.pointerId);
    document.body.classList.add('is-grabbing');
    S.control.freezeP=S.clamp(scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight));
    stampContact();
    e.preventDefault();
  });

  field.addEventListener('pointermove',e=>{
    if(!dragging||e.pointerId!==pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    const resistance=1/(1+Math.abs(dx)*.0015+Math.abs(dy)*.0015);
    S.control.manualRotTarget[1]=S.clamp(startRot[1]+dx*.008*resistance,-1.15,1.15);
    S.control.manualRotTarget[0]=S.clamp(startRot[0]+dy*.0055*resistance,-.58,.58);
    moved=Math.max(moved,Math.hypot(dx,dy));
    S.state.contactMoves++;
    if(S.state.contactMoves%5===0)updateTrace();
    e.preventDefault();
  });

  function release(e){
    if(!dragging)return;
    dragging=false;document.body.classList.remove('is-grabbing');S.control.freezeP=null;
    if(pointerId!==null&&field.hasPointerCapture?.(pointerId)) field.releasePointerCapture(pointerId);
    pointerId=null;
    if(moved<5){S.control.manualRotTarget[1]+=0.055;}
    updateTrace();
  }
  field.addEventListener('pointerup',release);field.addEventListener('pointercancel',release);

  field.addEventListener('keydown',e=>{
    const step=e.shiftKey?.12:.055;let used=true;
    if(e.key==='ArrowLeft')S.control.manualRotTarget[1]-=step;
    else if(e.key==='ArrowRight')S.control.manualRotTarget[1]+=step;
    else if(e.key==='ArrowUp')S.control.manualRotTarget[0]-=step;
    else if(e.key==='ArrowDown')S.control.manualRotTarget[0]+=step;
    else if(e.key==='Enter'||e.key===' '){stampContact();}
    else used=false;
    if(used){S.control.manualRotTarget[0]=S.clamp(S.control.manualRotTarget[0],-.58,.58);S.control.manualRotTarget[1]=S.clamp(S.control.manualRotTarget[1],-1.15,1.15);stampContact();updateTrace();e.preventDefault();}
  });
})();
