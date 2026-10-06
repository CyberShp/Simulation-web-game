/** Body activities and exclusive work stations, called only by the world owner. */
import {BUILDINGS,canPay,pay,grant} from './ea-data.mjs';
import {facilitySlots,slotById,slotReservation,facilityBodyKinds} from './ea-facility-slots.mjs';
import {geometryRevision,buildingAccess,scenicFindPath,scenicDistance,scenicSweep} from './ea-scene-geometry.mjs';
import {advanceScenic,syncScenicPosition} from './ea-scenic.mjs';
const owner=(s,p)=>p===s.master?p:p.mind;
export function bodyActivity(s,p){const a=s.activitiesById?.[p.activityId];return a?.kind==='facility'?a:null;}
export function releaseBodyActivity(s,p){
 const a=bodyActivity(s,p);if(!a)return;
 if(a.reservationId)delete s.reservationsById[a.reservationId];delete s.activitiesById[a.id];p.activityId=null;
 const o=owner(s,p);if(o.scenic){o.scenic.path=[];o.scenic.goal=null;delete o.scenic.activitySlotId;}
}
function reserve(s,p,a,b){
 const slots=facilitySlots(s,b,a.action),slot=slots.find(slot=>!slotReservation(s,slot.id)&&!Object.values(s.reservationsById).some(r=>r.kind==='slot'&&scenicDistance(slotById(s,r.slotId)?.position||{x:-999,y:-999},slot.position)<8-.001));
 if(!slot){a.phase='waiting';a.reason='工位已满，等待空闲位置。';const position=owner(s,p).scenic;if(position){position.path=[];position.goal=null;}return null;}
 const r={id:`reservation:slot:${p.personId}`,kind:'slot',personId:p.personId,activityId:a.id,slotId:slot.id,createdTick:s.worldTick};
 s.reservationsById[r.id]=r;a.reservationId=r.id;a.slotId=slot.id;a.phase='navigating';a.reason='前往独立工位。';return slot;
}
/** Returns true only after actual arrival at an exclusively reserved station. */
export function prepareFacilityActivity(s,p,b,action,budget=46){
 if(s.schemaVersion!==6)return true;
 let a=bodyActivity(s,p);
 if(!b||!facilityBodyKinds.has(action)||b.enabled===false||b.condition<=0){releaseBodyActivity(s,p);return false;}
 if(a&&(a.targetId!==b.instanceId||a.action!==action)){releaseBodyActivity(s,p);a=null;}
 if(!a){a={id:`activity:body:${p.personId}`,kind:'facility',personId:p.personId,action,phase:'waiting',targetId:b.instanceId,slotId:null,reservationId:null,startedTick:s.worldTick,reason:'等待工位。'};s.activitiesById[a.id]=a;p.activityId=a.id;}
 let slot=a.slotId&&slotById(s,a.slotId);
 if(slot&&!slotReservation(s,slot.id)){a.slotId=null;a.reservationId=null;slot=null;}
 if(!slot){
  // Stable FIFO: a later applicant cannot take the last station ahead of an
  // earlier waiter merely because society iterates people in member order.
  const first=Object.values(s.activitiesById).filter(x=>x.kind==='facility'&&x.targetId===a.targetId&&x.action===action&&!x.slotId).sort((x,y)=>x.startedTick-y.startedTick||x.personId.localeCompare(y.personId))[0];
  if(first?.id!==a.id){a.phase='waiting';a.reason='前面有人等候工位。';const position=owner(s,p).scenic;if(position){position.path=[];position.goal=null;}return false;}
  slot=reserve(s,p,a,b);if(!slot)return false;
 }
 const o=owner(s,p);if(!o.scenic){const entry=buildingAccess(s,s.buildings.find(b=>b.type==='hall'));if(entry)o.scenic={...entry,path:[],steps:0,facing:1,back:false,geometry:'plots-v1',revision:geometryRevision(s)};}const position=o.scenic;if(position)position.activitySlotId=slot.id;
 if(!position){a.phase='waiting';a.reason='尚无可用行走位置。';return false;}
 const arrived=()=>scenicDistance(position,slot.position)<.5&&!scenicSweep(s,position,slot.position).blocked;
 if(!arrived()){
  if(position.revision!==geometryRevision(s)||!position.goal||scenicDistance(position.goal,slot.position)>.01||!position.path.length){
   const path=scenicFindPath(s,position,slot.position,{maxSnap:1});
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
 const a=bodyActivity(s,p);if(!a||a.action!=='work'||a.phase!=='executing'||a.targetId!==b.instanceId)return false;
 let order=productionOrder(s,b);
 if(!order){
  const cost=BUILDINGS[b.type].input||{};if(!canPay(s,cost)){a.reason='生产原料不足。';return false;}
  const id=`work:production:${b.instanceId}`,reservationId=`reservation:input:${b.instanceId}`;
  pay(s,cost);s.reservationsById[reservationId]={id:reservationId,kind:'materials',workOrderId:id,cost:{...cost}};
  order={id,kind:'production',targetId:b.instanceId,phase:'active',batch:1,inheritedTicks:Math.min(BUILDINGS[b.type].duration*10-1,Math.round((b.progress||0)*10)),progressTicks:Math.min(BUILDINGS[b.type].duration*10-1,Math.round((b.progress||0)*10)),durationTicks:BUILDINGS[b.type].duration*10,reservationId,contributions:{},resultTransactionId:null};
  s.workOrdersById[id]=order;b.progress=0;
 }
 if(order.phase==='completed'){
  const cost=BUILDINGS[b.type].input||{};if(!canPay(s,cost)){a.reason='下一批原料不足。';return false;}
  pay(s,cost);s.reservationsById[order.reservationId]={id:order.reservationId,kind:'materials',workOrderId:order.id,cost:{...cost}};
  order.phase='active';order.batch++;order.progressTicks=0;order.inheritedTicks=0;order.contributions={};order.resultTransactionId=null;
 }
 a.workOrderId=order.id;order.phase='active';
 const contribution=Math.min(10,order.durationTicks-order.progressTicks);order.progressTicks+=contribution;order.contributions[p.personId]=(order.contributions[p.personId]||0)+contribution;
 if(order.progressTicks<order.durationTicks)return true;
 const participants=Object.entries(order.contributions).map(([id,ticks])=>({person:s.personsById[id],share:ticks/order.durationTicks})).sort((a,b)=>b.share-a.share||a.person.id-b.person.id);
 if(!settle(participants))throw Error('已预留的生产批次无法结算。');
 order.phase='completed';order.resultTransactionId=`result:${order.id}:${order.batch}`;delete s.reservationsById[order.reservationId];return true;
}
export function cancelProduction(s,id){
 const b=s.buildings.find(b=>b.id===id),order=b&&productionOrder(s,b);if(!order||order.phase==='completed')throw Error('当前没有未完成的生产批次。');
 const r=s.reservationsById[order.reservationId],refund={};for(const[k,v]of Object.entries(r.cost))refund[k]=v*(1-order.progressTicks/order.durationTicks);
 grant(s,refund);delete s.reservationsById[order.reservationId];delete s.workOrdersById[order.id];
 for(const a of Object.values(s.activitiesById))if(a.workOrderId===order.id)delete a.workOrderId;return refund;
}
export function reconcileActivities(s){
 if(s.schemaVersion!==6)return;
 for(const p of Object.values(s.personsById)){
  const a=bodyActivity(s,p);if(!a)continue;
  if(a.workOrderId&&!s.workOrdersById[a.workOrderId])delete a.workOrderId;
  const o=owner(s,p),b=s.buildingsById[a.targetId],careRole=(s.story.artisan?.phase==='care'&&[s.story.artisan.personId,'person:master'].includes(p.personId)||s.story.artisan?.phase==='recovering'&&s.story.artisan.personId===p.personId),action=careRole?'care':p===s.master?p.learning&&o.action==='walk'?'study':o.action:o.activity;
  if(b&&a.slotId&&a.phase==='executing'){const slot=slotById(s,a.slotId);if(!slot||o.scenic.path.length||scenicDistance(o.scenic,slot.position)>=.5)a.phase='navigating';}
  if(!b||b.enabled===false||b.condition<=0||o.away||o.journey||p!==s.master&&!s.homeMemberIds.includes(p.personId)&&!careRole||p===s.master&&(s.world.exploration||p.journey||s.combat?.status==='active')||action!==a.action)releaseBodyActivity(s,p);
 }
 for(const order of Object.values(s.workOrdersById))if(order.kind==='production'&&order.phase==='active'&&!Object.values(s.activitiesById).some(a=>a.workOrderId===order.id&&a.phase==='executing'))order.phase='waiting';
}
export function validateFacilityActivities(s){
 const fail=()=>{throw Error('存档校验失败：工位、活动或生产批次引用异常');},used=new Set(),positions=[];
 for(const [id,a]of Object.entries(s.activitiesById)){
  if(!a)fail();if(a.kind==='construction')continue;if(a.kind!=='facility'||a.id!==id||id!==`activity:body:${a.personId}`||s.personsById[a.personId]?.activityId!==id||!facilityBodyKinds.has(a.action)||!['waiting','navigating','executing'].includes(a.phase)||!s.buildingsById[a.targetId]||!Number.isSafeInteger(a.startedTick)||a.startedTick<0||a.startedTick>s.worldTick||typeof a.reason!=='string')fail();
  if(a.slotId){const slot=slotById(s,a.slotId),r=s.reservationsById[a.reservationId];if(!slot||slot.kind!==a.action||slot.buildingId!==s.buildingsById[a.targetId].id||used.has(a.slotId)||!r||r.kind!=='slot'||r.id!==a.reservationId||r.slotId!==a.slotId||r.personId!==a.personId||r.activityId!==id||!Number.isSafeInteger(r.createdTick)||r.createdTick<0||r.createdTick>s.worldTick)fail();if(positions.some(p=>scenicDistance(p,slot.position)<8-.001))fail();positions.push(slot.position);used.add(a.slotId);
   const p=s.personsById[a.personId],position=owner(s,p).scenic;if(a.phase==='executing'&&(!position||scenicDistance(position,slot.position)>=.5||position.path.length))fail();
  }else if(a.reservationId||a.phase!=='waiting')fail();
  if(a.workOrderId&&(a.action!=='work'||s.workOrdersById[a.workOrderId]?.kind!=='production'||s.workOrdersById[a.workOrderId].targetId!==a.targetId))fail();
 }
 for(const [id,r]of Object.entries(s.reservationsById))if(r.kind==='slot'&&(r.id!==id||s.activitiesById[r.activityId]?.reservationId!==id))fail();
 for(const [id,o]of Object.entries(s.workOrdersById)){
  if(!o)fail();if(o.kind==='construction'||o.kind==='treatment')continue;const b=s.buildingsById[o.targetId],cost=BUILDINGS[b?.type]?.input||{},r=s.reservationsById[o.reservationId];
  if(o.kind!=='production'||o.id!==id||id!==`work:production:${o.targetId}`||!b||!BUILDINGS[b.type].work||b.progress!==0||!['active','waiting','completed'].includes(o.phase)||!Number.isSafeInteger(o.batch)||o.batch<1||o.durationTicks!==BUILDINGS[b.type].duration*10||!Number.isSafeInteger(o.progressTicks)||o.progressTicks<0||o.progressTicks>o.durationTicks||!o.contributions||Array.isArray(o.contributions)||!Object.entries(o.contributions).every(([pid,t])=>s.personsById[pid]&&Number.isSafeInteger(t)&&t>0)||!Number.isSafeInteger(o.inheritedTicks)||o.inheritedTicks<0||o.inheritedTicks>=o.durationTicks||Object.values(o.contributions).reduce((n,v)=>n+v,0)+o.inheritedTicks!==o.progressTicks)fail();
  if(o.phase==='completed'){if(o.progressTicks!==o.durationTicks||r||o.resultTransactionId!==`result:${id}:${o.batch}`)fail();}
  else if(o.progressTicks===o.durationTicks||o.resultTransactionId!==null||!r||r.id!==o.reservationId||r.kind!=='materials'||r.workOrderId!==id||!r.cost||Object.keys(r.cost).length!==Object.keys(cost).length||!Object.entries(cost).every(([k,v])=>r.cost[k]===v))fail();
 }
 for(const [id,r]of Object.entries(s.reservationsById))if(r.kind==='materials'&&(!s.workOrdersById[r.workOrderId]||s.workOrdersById[r.workOrderId].reservationId!==id))fail();
 for(const [id,r]of Object.entries(s.reservationsById))if(!['slot','materials','care-medicine'].includes(r.kind)&&!(r.kind===undefined&&s.activitiesById[r.activityId]?.kind==='construction'&&s.activitiesById[r.activityId].reservationId===id))fail();
 for(const p of Object.values(s.personsById))if(p.activityId&&!s.activitiesById[p.activityId])fail();
 return true;
}
