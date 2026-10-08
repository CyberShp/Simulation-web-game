/** Body activities and exclusive work stations, called only by the world owner. */
import {BUILDINGS,canPay,pay,grant} from './ea-data.mjs?v=ea-160-courtyard-20261008-r4';
import {productionAvailability,settleFiniteProduction,initEconomy,productionInputAvailable,reserveProductionInput,refundProductionInput,cancelMerchantCollection} from './ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r4';
const units=(s,pixels)=>s.spatial?.version==='spatial-metres-1'?pixels/32:pixels;
const spacing=s=>s.spatial?.version==='spatial-metres-1'?.5:8;
const arrival=s=>s.spatial?.version==='spatial-metres-1'?.04:.5;
import {facilitySlots,slotById,slotReservation,facilityBodyKinds} from './ea-facility-slots.mjs?v=ea-160-courtyard-20261008-r4';
import {geometryRevision,buildingAccess,scenicFindPath,scenicDistance,scenicSweep,scenicNearest} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r4';
import {advanceScenic,syncScenicPosition} from './ea-scenic.mjs?v=ea-160-courtyard-20261008-r4';
const owner=(s,p)=>p===s.master?p:p.mind;
export function bodyActivity(s,p){const a=s.activitiesById?.[p.activityId];return a?.kind==='facility'?a:null;}
export function releaseBodyActivity(s,p){
 const a=bodyActivity(s,p);if(!a)return;
 if(a.reservationId)delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];p.activityId=null;
 const o=owner(s,p);if(o.scenic){o.scenic.path=[];o.scenic.goal=null;delete o.scenic.activitySlotId;}
}
// SR-XF-008-AC-03: an injury ends this person's work promise before another contribution.
// The shared production order and its material reservation belong to the batch.
function interruptWoundedWork(s,p){
 const o=owner(s,p),a=bodyActivity(s,p);
 if(p===s.master||!(p.wound>20)||a?.action!=='work'&&o.activity!=='work')return false;
 releaseBodyActivity(s,p);p.job=null;o.activity='heal';o.reason='伤势未愈，原差事已中断，先调养。';o.commitUntil=s.time;
 if(p.schedule)p.schedule.commitUntilTick=s.worldTick;
 return true;
}
function waitOutside(s,p,a,b,budget){const o=owner(s,p),entry=buildingAccess(s,b),queue=Object.values(s.activitiesById).filter(x=>x.kind==='facility'&&x.targetId===a.targetId&&!x.slotId).sort((x,y)=>x.startedTick-y.startedTick||x.personId.localeCompare(y.personId));let index=Math.max(0,queue.findIndex(x=>x.id===a.id));
 if(!a.waitingPosition){for(let step=0;step<12;step++){const n=index+step,side=n%2?-1:1,q=scenicNearest(s,{x:entry.x+side*units(s,28+Math.floor(n/2)*20),y:entry.y+units(s,24)});if(!q||Object.values(s.activitiesById).some(x=>x.id!==a.id&&x.waitingPosition&&scenicDistance(x.waitingPosition,q)<spacing(s)))continue;a.waitingPosition=q;break;}}
 if(!a.waitingPosition||!o.scenic)return;if(scenicDistance(o.scenic,a.waitingPosition)<arrival(s)){o.scenic.path=[];o.scenic.goal=null;return;}if(o.scenic.revision!==geometryRevision(s)||!o.scenic.goal||scenicDistance(o.scenic.goal,a.waitingPosition)>units(s,.01)){const path=scenicFindPath(s,o.scenic,a.waitingPosition);if(path===null)return;o.scenic.path=path;o.scenic.goal={...a.waitingPosition};o.scenic.revision=geometryRevision(s);}if(budget>0){advanceScenic(o.scenic,budget,s);syncScenicPosition(s,p);}}
function reserve(s,p,a,b){
 const slots=facilitySlots(s,b,a.action),slot=slots.find(slot=>!slotReservation(s,slot.id)&&!Object.values(s.reservationsById).some(r=>['slot','sr-slot'].includes(r.kind)&&scenicDistance(slotById(s,r.slotId)?.position||{x:-999,y:-999},slot.position)<spacing(s)-.001));
 if(!slot){a.phase='waiting';a.reason='工位已满，在门外独立位置等候。';return null;}
 const r={id:`reservation:slot:${p.personId}`,kind:'slot',personId:p.personId,activityId:a.id,slotId:slot.id,createdTick:s.worldTick};
 s.reservationsById[r.id]=r;a.reservationId=r.id;a.slotId=slot.id;a.phase='navigating';a.reason='前往独立工位。';return slot;
}
/** Returns true only after actual arrival at an exclusively reserved station. */
export function prepareFacilityActivity(s,p,b,action,budget=46){
 if(s.schemaVersion!==6)return true;
 if(action==='work'&&interruptWoundedWork(s,p))return false;
 if(owner(s,p)?.scenic?.spatialEvacuationOrderId)return false;
 if(p.activityId&&s.activitiesById[p.activityId]?.kind!=='facility')return false;
 let a=bodyActivity(s,p);
 if(!b||b.spatialLock&&!a||!facilityBodyKinds.has(action)||b.enabled===false||b.condition<=0){releaseBodyActivity(s,p);return false;}
 if(a&&(a.targetId!==b.instanceId||a.action!==action)){releaseBodyActivity(s,p);a=null;}
 if(!a){a={id:`activity:body:${p.personId}`,kind:'facility',personId:p.personId,action,phase:'waiting',targetId:b.instanceId,slotId:null,reservationId:null,startedTick:s.worldTick,reason:'等待工位。'};s.activitiesById[a.id]=a;p.activityId=a.id;}
 let slot=a.slotId&&slotById(s,a.slotId);
 if(slot&&!slotReservation(s,slot.id)){a.slotId=null;a.reservationId=null;slot=null;}
 if(!slot){
  // Stable FIFO: a later applicant cannot take the last station ahead of an
  // earlier waiter merely because society iterates people in member order.
  const first=Object.values(s.activitiesById).filter(x=>x.kind==='facility'&&x.targetId===a.targetId&&x.action===action&&!x.slotId).sort((x,y)=>x.startedTick-y.startedTick||x.personId.localeCompare(y.personId))[0];
  if(first?.id!==a.id){a.phase='waiting';a.reason='前面有人等候工位。';waitOutside(s,p,a,b,budget);return false;}
  slot=reserve(s,p,a,b);if(!slot){waitOutside(s,p,a,b,budget);return false;}delete a.waitingPosition;
 }
 const o=owner(s,p);if(!o.scenic){const entry=buildingAccess(s,s.buildings.find(b=>b.type==='hall'));if(entry)o.scenic={...entry,path:[],steps:0,facing:1,back:false,geometry:'plots-v1',revision:geometryRevision(s)};}const position=o.scenic;if(position)position.activitySlotId=slot.id;
 if(!position){a.phase='waiting';a.reason='尚无可用行走位置。';return false;}
 const arrived=()=>scenicDistance(position,slot.position)<arrival(s)&&!scenicSweep(s,position,slot.position).blocked;
 if(!arrived()){
  if(position.revision!==geometryRevision(s)||!position.goal||scenicDistance(position.goal,slot.position)>units(s,.01)||!position.path.length){
   const path=scenicFindPath(s,position,slot.position,{maxSnap:units(s,1)});
   if(path===null){a.phase='waiting';a.reason='工位通路受阻。';position.path=[];position.goal=null;return false;}
   position.path=path;position.goal={...slot.position};position.revision=geometryRevision(s);position.destinationId=b.id;
  }
  a.phase='navigating';a.reason='前往'+slot.label+'。';
  if(budget>0){const moved=advanceScenic(position,budget,s);p.energy=Math.max(0,p.energy-moved/46*.04);syncScenicPosition(s,p);}
  if(p===s.master&&!position.path.length&&action==='study')p.action='study';
  // Arrival itself spends this world step, never also a full second of work.
  return false;
 }
 position.path=[];position.goal={...slot.position};a.phase='executing';a.reason='正在使用'+slot.label+'。';return true;
}
export function productionOrder(s,b){return s.workOrdersById?.[`work:production:${b.instanceId}`]||null;}
export function contributeProduction(s,p,b,settle){
 if(interruptWoundedWork(s,p))return false;
 const a=bodyActivity(s,p);if(!a||a.action!=='work'||a.phase!=='executing'||a.targetId!==b.instanceId)return false;
 const availability=productionAvailability(s,b);if(!availability.available){a.reason=availability.reason;return false;}
 if(s.srEconomy)initEconomy(s);
 let order=productionOrder(s,b);
 if(!order){
  const cost=BUILDINGS[b.type].input||{};if(!productionInputAvailable(s,b)){a.reason=s.srEconomy?'工位尚未收到原料；先从府库实际搬入。':'生产原料不足。';return false;}
  const id=`work:production:${b.instanceId}`,reservationId=`reservation:input:${b.instanceId}`;
  reserveProductionInput(s,b,cost);s.reservationsById[reservationId]={id:reservationId,kind:'materials',workOrderId:id,cost:{...cost}};
  order={id,kind:'production',targetId:b.instanceId,phase:'active',batch:1,inheritedTicks:Math.min(BUILDINGS[b.type].duration*10-1,Math.round((b.progress||0)*10)),progressTicks:Math.min(BUILDINGS[b.type].duration*10-1,Math.round((b.progress||0)*10)),durationTicks:BUILDINGS[b.type].duration*10,reservationId,contributions:{},resultTransactionId:null};
  s.workOrdersById[id]=order;b.progress=0;
 }
 if(order.phase==='completed'){
  const cost=BUILDINGS[b.type].input||{};if(!productionInputAvailable(s,b)){a.reason=s.srEconomy?'下一批工位原料不足，先实际搬入。':'下一批原料不足。';return false;}
  reserveProductionInput(s,b,cost);s.reservationsById[order.reservationId]={id:order.reservationId,kind:'materials',workOrderId:order.id,cost:{...cost}};
  order.phase='active';order.batch++;order.progressTicks=0;order.inheritedTicks=0;order.contributions={};order.resultTransactionId=null;
 }
 a.workOrderId=order.id;order.phase='active';
 const contribution=Math.min(10,order.durationTicks-order.progressTicks);order.progressTicks+=contribution;order.contributions[p.personId]=(order.contributions[p.personId]||0)+contribution;
 if(order.progressTicks<order.durationTicks)return true;
 const participants=Object.entries(order.contributions).map(([id,ticks])=>({person:s.personsById[id],share:ticks/order.durationTicks})).sort((a,b)=>b.share-a.share||a.person.id-b.person.id);
 if(!settleFiniteProduction(s,b,settle,participants)){order.progressTicks-=contribution;order.contributions[p.personId]-=contribution;if(!order.contributions[p.personId])delete order.contributions[p.personId];a.reason='整批成品容量或来源不足，保留投入等待；不会截断产物。';return false;}
 order.phase='completed';order.resultTransactionId=`result:${order.id}:${order.batch}`;delete s.reservationsById[order.reservationId];return true;
}
export function cancelProduction(s,id){
 const b=s.buildings.find(b=>b.id===id),order=b&&productionOrder(s,b);if(!order||order.phase==='completed')throw Error('当前没有未完成的生产批次。');
 for(const collection of Object.values(s.workOrdersById))if(collection.kind==='sr-merchant-collection'&&collection.productionWorkOrderId===order.id&&collection.productionBatch===order.batch&&['to-source','waiting-for-goods'].includes(collection.phase))cancelMerchantCollection(s,collection.id);
 const r=s.reservationsById[order.reservationId],refund={};for(const[k,v]of Object.entries(r.cost))refund[k]=v*(1-order.progressTicks/order.durationTicks);
 refundProductionInput(s,b,refund);delete s.reservationsById[order.reservationId];delete s.workOrdersById[order.id];
 for(const a of Object.values(s.activitiesById))if(a.workOrderId===order.id)delete a.workOrderId;return refund;
}
export function finalizeBuildingChange(s,b,operation){
 const order=productionOrder(s,b);if(operation==='demolish'&&order){if(order.phase!=='completed')cancelProduction(s,b.id);else delete s.workOrdersById[order.id];}
 const st=s.stockpilesById?.[`stockpile:${b.instanceId}`];if(!st)return;
 if(operation==='demolish'){st.position={sceneId:'scene:yunxiu-courtyard',...buildingAccess(s,b)};delete st.buildingId;st.removedBuildingId=b.instanceId;st.label='拆除遗留物资';}
 else {st.position={sceneId:'scene:yunxiu-courtyard',...buildingAccess(s,b)};st.capacity=320*b.level;}
}
export function reconcileActivities(s){
 if(s.schemaVersion!==6)return;
 for(const p of Object.values(s.personsById)){
  const a=bodyActivity(s,p);if(!a)continue;
  if(interruptWoundedWork(s,p))continue;
  if(a.workOrderId&&!s.workOrdersById[a.workOrderId])delete a.workOrderId;
  const o=owner(s,p),b=s.buildingsById[a.targetId],careRole=(s.story.artisan?.phase==='care'&&[s.story.artisan.personId,'person:master'].includes(p.personId)||s.story.artisan?.phase==='recovering'&&s.story.artisan.personId===p.personId),action=careRole?'care':p===s.master?p.learning&&o.action==='walk'?'study':o.action:o.activity;
  if(b&&a.slotId&&a.phase==='executing'){const slot=slotById(s,a.slotId);if(!slot||o.scenic.path.length||scenicDistance(o.scenic,slot.position)>=arrival(s))a.phase='navigating';}
  if(!b||b.enabled===false||b.condition<=0||o.away||o.journey||p!==s.master&&!s.homeMemberIds.includes(p.personId)&&!careRole||p===s.master&&(s.world.exploration||p.journey||s.combat?.status==='active')||action!==a.action)releaseBodyActivity(s,p);
 }
 for(const order of Object.values(s.workOrdersById))if(order.kind==='production'&&order.phase==='active'&&!Object.values(s.activitiesById).some(a=>a.workOrderId===order.id&&a.phase==='executing'))order.phase='waiting';
}
export function validateFacilityActivities(s){
 const fail=()=>{throw Error('存档校验失败：工位、活动或生产批次引用异常');},used=new Set(),positions=[];
 for(const [id,a]of Object.entries(s.activitiesById)){
  if(!a)fail();if(a.kind==='construction'||a.kind?.startsWith('sr-'))continue;if(a.kind!=='facility'||a.id!==id||id!==`activity:body:${a.personId}`||s.personsById[a.personId]?.activityId!==id||!facilityBodyKinds.has(a.action)||!['waiting','navigating','executing'].includes(a.phase)||!s.buildingsById[a.targetId]||!Number.isSafeInteger(a.startedTick)||a.startedTick<0||a.startedTick>s.worldTick||typeof a.reason!=='string')fail();
  if(a.slotId){const slot=slotById(s,a.slotId),r=s.reservationsById[a.reservationId];if(!slot||slot.kind!==a.action||slot.buildingId!==s.buildingsById[a.targetId].id||used.has(a.slotId)||!r||r.kind!=='slot'||r.id!==a.reservationId||r.slotId!==a.slotId||r.personId!==a.personId||r.activityId!==id||!Number.isSafeInteger(r.createdTick)||r.createdTick<0||r.createdTick>s.worldTick)fail();if(positions.some(p=>scenicDistance(p,slot.position)<spacing(s)-.001))fail();positions.push(slot.position);used.add(a.slotId);
   const p=s.personsById[a.personId],position=owner(s,p).scenic;if(a.phase==='executing'&&(!position||scenicDistance(position,slot.position)>=arrival(s)||position.path.length))fail();
  }else if(a.reservationId||a.phase!=='waiting')fail();
  if(a.workOrderId&&(a.action!=='work'||s.workOrdersById[a.workOrderId]?.kind!=='production'||s.workOrdersById[a.workOrderId].targetId!==a.targetId))fail();
 }
 for(const [id,r]of Object.entries(s.reservationsById))if(r.kind==='slot'&&(r.id!==id||s.activitiesById[r.activityId]?.reservationId!==id))fail();
 for(const [id,o]of Object.entries(s.workOrdersById)){
  if(!o)fail();if(o.kind==='construction'||o.kind==='treatment'||o.kind==='transport'||o.kind?.startsWith('sr-'))continue;const b=s.buildingsById[o.targetId],cost=BUILDINGS[b?.type]?.input||{},r=s.reservationsById[o.reservationId];
  if(o.kind!=='production'||o.id!==id||id!==`work:production:${o.targetId}`||!b||!BUILDINGS[b.type].work||b.progress!==0||!['active','waiting','completed'].includes(o.phase)||!Number.isSafeInteger(o.batch)||o.batch<1||o.durationTicks!==BUILDINGS[b.type].duration*10||!Number.isSafeInteger(o.progressTicks)||o.progressTicks<0||o.progressTicks>o.durationTicks||!o.contributions||Array.isArray(o.contributions)||!Object.entries(o.contributions).every(([pid,t])=>s.personsById[pid]&&Number.isSafeInteger(t)&&t>0)||!Number.isSafeInteger(o.inheritedTicks)||o.inheritedTicks<0||o.inheritedTicks>=o.durationTicks||Object.values(o.contributions).reduce((n,v)=>n+v,0)+o.inheritedTicks!==o.progressTicks)fail();
  if(o.phase==='completed'){if(o.progressTicks!==o.durationTicks||r||o.resultTransactionId!==`result:${id}:${o.batch}`)fail();}
  else if(o.progressTicks===o.durationTicks||o.resultTransactionId!==null||!r||r.id!==o.reservationId||r.kind!=='materials'||r.workOrderId!==id||!r.cost||Object.keys(r.cost).length!==Object.keys(cost).length||!Object.entries(cost).every(([k,v])=>r.cost[k]===v))fail();
 }
 for(const [id,r]of Object.entries(s.reservationsById))if(r.kind==='materials'&&(!s.workOrdersById[r.workOrderId]||s.workOrdersById[r.workOrderId].reservationId!==id))fail();
 for(const [id,r]of Object.entries(s.reservationsById))if(!(['slot','materials','care-medicine','transport-cargo','trade-order','construction-material','ecology-material'].includes(r.kind)||r.kind?.startsWith('sr-'))&&!(r.kind===undefined&&s.activitiesById[r.activityId]?.kind==='construction'&&s.activitiesById[r.activityId].reservationId===id))fail();
 for(const p of Object.values(s.personsById))if(p.activityId&&!s.activitiesById[p.activityId])fail();
 return true;
}
