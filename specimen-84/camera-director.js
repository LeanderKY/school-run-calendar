(() => {
  'use strict';
  const S=window.S84;if(!S)return;
  const canvas=S.$('#gl');

  const desktop=[
    {rot:null,scale:1.00,shift:[0,0]},
    {rot:[0,0,0],scale:.96,shift:[2,0]},
    {rot:[.03,-2.42,-.02],scale:.80,shift:[-11,2]},
    {rot:[-2.28,-3.72,-.52],scale:.72,shift:[15,7]},
    {rot:[0,.92,0],scale:.72,shift:[17,-3]},
    {rot:[0,0,0],scale:.72,shift:[18,-1]}
  ];
  const mobile=[
    {rot:null,scale:.96,shift:[0,0]},
    {rot:[0,0,0],scale:.90,shift:[6,0]},
    {rot:[.03,-2.42,-.02],scale:.67,shift:[-10,2]},
    {rot:[-2.28,-3.72,-.52],scale:.60,shift:[18,8]},
    {rot:[0,.92,0],scale:.58,shift:[22,-2]},
    {rot:[0,0,0],scale:.58,shift:[23,-2]}
  ];

  function apply(index){
    const table=innerWidth<900?mobile:desktop;
    const shot=table[index]||table[0];
    if(shot.rot)S.control.manualRotTarget=[...shot.rot];
    else if(index!==0)S.control.manualRotTarget=[0,0,0];
    S.control.manualScale=shot.scale;
    if(canvas){
      canvas.style.transform=`translate(${shot.shift[0]}vw,${shot.shift[1]}vh)`;
      canvas.style.transition='transform 700ms cubic-bezier(.2,.75,.18,1)';
    }
  }

  S.on('act',apply);
  addEventListener('resize',()=>apply(S.activeAct),{passive:true});
  apply(S.activeAct);
})();
