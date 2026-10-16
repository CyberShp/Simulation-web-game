/** Canvas-local pointer control. All capture and drag state has one cleanup path. */
export function attachMapInput(canvas, {pan, onHover, onActivate, onPinch=()=>{}, onDragChange=()=>{}, enabled=()=>true, windowTarget=window, documentTarget=document}) {
  let drag=null,pinch=null;
  const subscriptions=[];
  const listen=(target,name,fn)=>{target.addEventListener(name,fn);subscriptions.push(()=>target.removeEventListener(name,fn));};
  function finish(){
    const ids=drag?[drag.id,...(pinch?[pinch.second.id]:[])]:[];
    drag=pinch=null;
    onDragChange(false);
    for(const id of ids)if(canvas.hasPointerCapture(id))try{canvas.releasePointerCapture(id);}catch{}
  }
  listen(canvas,'pointerdown',e=>{
    if(!enabled()||e.button!==0)return;
    if(drag){
      if(pinch||drag.type!=='touch'||e.pointerType!=='touch'||e.pointerId===drag.id)return;
      pinch={first:{x:drag.currentX,y:drag.currentY},second:{id:e.pointerId,x:e.clientX,y:e.clientY}};
      pinch.distance=Math.hypot(pinch.first.x-pinch.second.x,pinch.first.y-pinch.second.y);
      pinch.midX=(pinch.first.x+pinch.second.x)/2;pinch.midY=(pinch.first.y+pinch.second.y)/2;
      drag.moved=true;onDragChange(false);
      try{canvas.setPointerCapture(e.pointerId);}catch{finish();}
      return;
    }
    if(e.isPrimary===false)return;
    drag={id:e.pointerId,type:e.pointerType,x:e.clientX,y:e.clientY,currentX:e.clientX,currentY:e.clientY,px:pan.x,py:pan.y,moved:false};
    try{canvas.setPointerCapture(e.pointerId);}catch{finish();}
  });
  listen(canvas,'pointermove',e=>{
    if(pinch){
      if(!enabled()){finish();return;}
      const point=e.pointerId===drag.id?pinch.first:e.pointerId===pinch.second.id?pinch.second:null;
      if(!point)return;
      point.x=e.clientX;point.y=e.clientY;
      const distance=Math.hypot(pinch.first.x-pinch.second.x,pinch.first.y-pinch.second.y);
      const midX=(pinch.first.x+pinch.second.x)/2,midY=(pinch.first.y+pinch.second.y)/2;
      if(pinch.distance>0&&distance>0)onPinch({scale:distance/pinch.distance,clientX:midX,clientY:midY,dx:midX-pinch.midX,dy:midY-pinch.midY});
      pinch.distance=distance;pinch.midX=midX;pinch.midY=midY;
      return;
    }
    if(drag&&e.pointerId!==drag.id)return;
    if(drag&&((e.pointerType==='mouse'&&!(e.buttons&1))||!enabled())){finish();return;}
    onHover(e);
    if(!drag)return;
    drag.currentX=e.clientX;drag.currentY=e.clientY;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>6){drag.moved=true;onDragChange(true);}
    if(drag.moved){pan.x=Math.max(Math.min(-700,drag.px),Math.min(Math.max(700,drag.px),drag.px+dx));pan.y=Math.max(Math.min(-500,drag.py),Math.min(Math.max(500,drag.py),drag.py+dy));}
  });
  listen(canvas,'pointerup',e=>{
    if(pinch){if(e.pointerId===drag.id||e.pointerId===pinch.second.id)finish();return;}
    if(!drag||e.pointerId!==drag.id)return;
    const activate=!drag.moved&&Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)<=6&&enabled();
    finish();
    if(activate)onActivate(e);
  });
  const cancel=e=>{if(drag&&(e.pointerId===drag.id||e.pointerId===pinch?.second.id))finish();};
  listen(canvas,'pointercancel',cancel);
  listen(canvas,'lostpointercapture',cancel);
  listen(windowTarget,'blur',finish);
  listen(windowTarget,'pagehide',finish);
  listen(documentTarget,'visibilitychange',()=>{if(documentTarget.hidden)finish();});
  const dispose=()=>{finish();subscriptions.forEach(stop=>stop());};
  dispose.cancel=finish;
  return dispose;
}
