/** Canvas-local pointer control. All capture and drag state has one cleanup path. */
export function attachMapInput(canvas, {pan, onHover, onActivate, onDragChange=()=>{}, enabled=()=>true, windowTarget=window, documentTarget=document}) {
  let drag=null;
  const subscriptions=[];
  const listen=(target,name,fn)=>{target.addEventListener(name,fn);subscriptions.push(()=>target.removeEventListener(name,fn));};
  function finish(){
    const previous=drag;
    drag=null;
    onDragChange(false);
    if(previous&&canvas.hasPointerCapture(previous.id)){
      try{canvas.releasePointerCapture(previous.id);}catch{}
    }
  }
  listen(canvas,'pointerdown',e=>{
    if(!enabled()||drag||e.isPrimary===false||e.button!==0)return;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y,moved:false};
    try{canvas.setPointerCapture(e.pointerId);}catch{finish();}
  });
  listen(canvas,'pointermove',e=>{
    if(drag&&e.pointerId!==drag.id)return;
    if(drag&&((e.pointerType==='mouse'&&!(e.buttons&1))||!enabled())){finish();return;}
    onHover(e);
    if(!drag)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>6){drag.moved=true;onDragChange(true);}
    if(drag.moved){pan.x=Math.max(-700,Math.min(700,drag.px+dx));pan.y=Math.max(-500,Math.min(500,drag.py+dy));}
  });
  listen(canvas,'pointerup',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const activate=!drag.moved&&enabled();
    finish();
    if(activate)onActivate(e);
  });
  const cancel=e=>{if(drag&&e.pointerId===drag.id)finish();};
  listen(canvas,'pointercancel',cancel);
  listen(canvas,'lostpointercapture',cancel);
  listen(windowTarget,'blur',finish);
  listen(windowTarget,'pagehide',finish);
  listen(documentTarget,'visibilitychange',()=>{if(documentTarget.hidden)finish();});
  const dispose=()=>{finish();subscriptions.forEach(stop=>stop());};
  dispose.cancel=finish;
  return dispose;
}
