/** A replaceable, latest-intent worker. Only the caller may commit a world move. */
export function createCourtyardRoutePlanner({createWorker=()=>new Worker(new URL('./courtyard-route-worker.mjs',import.meta.url),{type:'module'}),now=()=>performance.now()}={}){
 let sequence=0,worker=null,pending=null,latest=null,validRequestId=null;
 const stop=()=>{worker?.terminate();worker=null;};
 function invalidate(reason='已改为新的行动。'){
  validRequestId=null;
  if(!pending){if(latest?.status==='planned')latest={...latest,status:'cancelled',finishedAt:now(),error:reason};return;}
  const old=pending;pending=null;latest={...latest,status:'cancelled',finishedAt:now(),error:reason};stop();old.resolve({ok:false,cancelled:true,requestId:old.id,error:reason});
 }
 function receive(event){
  const value=event.data;if(!pending||value?.requestId!==pending.id)return;
  const job=pending;pending=null;latest={...latest,status:value.ok?'planned':'rejected',workerFinishedAt:now(),workerDurationMs:value.workerDurationMs,...(!value.ok?{error:value.error}: {})};job.resolve({...value,requestId:job.id});
 }
 function failed(event){
  if(!pending)return;
  event.preventDefault?.();const job=pending,error='路线规划未完成：'+(event.message||event.error?.message||'后台规划不可用。');pending=null;latest={...latest,status:'rejected',workerFinishedAt:now(),error};stop();job.resolve({ok:false,requestId:job.id,error});
 }
 function plan(payload){
  invalidate();const id=++sequence;validRequestId=id;latest={requestId:id,status:'pending',startedAt:now()};
  return new Promise(resolve=>{
   pending={id,resolve};
   try{if(!worker){const instance=createWorker();worker=instance;instance.onmessage=event=>{if(worker===instance)receive(event);};instance.onerror=instance.onmessageerror=event=>{if(worker===instance)failed(event);};}worker.postMessage({requestId:id,payload});}
   catch(error){failed({message:error?.message||String(error)});}
  });
 }
 function mark(id,status,detail={}){if(id!==validRequestId||id!==latest?.requestId||latest.status==='cancelled')return false;latest={...latest,...detail,status};return true;}
 return {plan,invalidate,isCurrent:id=>id===validRequestId&&id===latest?.requestId&&latest.status!=='cancelled',mark,status:()=>latest?{...latest}:null,dispose(){invalidate('窗口已退出。');stop();}};
}
