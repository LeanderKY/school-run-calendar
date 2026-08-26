(() => {
  'use strict';
  const S=window.S84;if(!S)return;
  const rail=S.$('#reconstruction'),result=S.$('#reconstructionResult');
  if(!rail)return;

  let drag=null,pointerId=null,startX=0,currentX=0,targetIndex=0;

  function strips(){return S.$$('.evidence-strip',rail);}
  function indexOf(el){return strips().indexOf(el);}

  function setTraceIdentity(){
    const map={A:['39%','7deg'],B:['46%','7deg'],C:['53%','7deg'],D:['60%','7deg']};
    strips().forEach(el=>{const v=map[el.dataset.frame]||['50%','0deg'];el.style.setProperty('--trace-y',v[0]);el.style.setProperty('--trace-r',v[1]);});
  }

  function check(){
    const order=strips().map(el=>Number(el.dataset.seq));
    const solved=order.every((v,i)=>v===i);
    rail.classList.toggle('is-solved',solved);
    result?.classList.toggle('is-solved',solved);
    if(result){
      const b=result.querySelector('b'),p=result.querySelector('p');
      if(b)b.textContent=solved?'CONTINUOUS':'BROKEN';
      if(p)p.textContent=solved?'05:18:14 — room empty 0.7 s before the cage latch moves.':'Frame order unresolved.';
    }
    if(solved&&!S.state.reconstruction){
      S.state.reconstruction=true;S.emit('reconstruction',order);
      if(navigator.vibrate)navigator.vibrate([10,26,10]);
    }
    return solved;
  }

  function placeAt(el,index){
    const list=strips().filter(x=>x!==el),safe=S.clamp(index,0,list.length);
    if(safe>=list.length)rail.appendChild(el);else rail.insertBefore(el,list[safe]);
    setTraceIdentity();check();
  }

  function begin(e){
    const el=e.target.closest('.evidence-strip');if(!el||e.button!==0)return;
    drag=el;pointerId=e.pointerId;startX=currentX=e.clientX;targetIndex=indexOf(el);
    el.classList.add('is-dragging');el.setPointerCapture?.(e.pointerId);S.markContact();e.preventDefault();
  }

  function move(e){
    if(!drag||e.pointerId!==pointerId)return;
    currentX=e.clientX;const dx=currentX-startX,r=rail.getBoundingClientRect(),slot=r.width/Math.max(1,strips().length);
    targetIndex=S.clamp(Math.floor((currentX-r.left)/Math.max(1,slot)),0,strips().length-1);
    drag.style.transform=`translate(${dx.toFixed(1)}px,-14px)`;
    strips().forEach((el,i)=>{if(el===drag)return;const from=indexOf(drag);let shift=0;if(targetIndex>from&&i>from&&i<=targetIndex)shift=-12;if(targetIndex<from&&i>=targetIndex&&i<from)shift=12;el.style.transform=`translateX(${shift}px)`;});
    e.preventDefault();
  }

  function end(){
    if(!drag)return;
    const el=drag,idx=targetIndex;
    drag=null;
    strips().forEach(x=>{x.classList.remove('is-dragging');x.style.transform='';});
    if(pointerId!==null&&el.hasPointerCapture?.(pointerId))el.releasePointerCapture(pointerId);pointerId=null;
    placeAt(el,idx);
  }

  rail.addEventListener('pointerdown',begin);
  rail.addEventListener('pointermove',move);
  rail.addEventListener('pointerup',end);
  rail.addEventListener('pointercancel',end);

  rail.addEventListener('keydown',e=>{
    const el=e.target.closest('.evidence-strip');if(!el)return;
    const list=strips(),i=list.indexOf(el);let next=i;
    if(e.key==='ArrowLeft')next=i-1;else if(e.key==='ArrowRight')next=i+1;else return;
    next=S.clamp(next,0,list.length-1);if(next===i)return;
    placeAt(el,next);el.focus();S.markContact();e.preventDefault();
  });

  setTraceIdentity();check();
})();
