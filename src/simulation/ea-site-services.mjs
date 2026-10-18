/** U-167/T-21: finite on-site cooking, treatment and meals on the existing world clock. */
import {SERVICE_RECIPES,serviceRecipe,SITE_SERVICE_VERSION,siteServiceEnabled} from './ea-service-definitions.mjs';
import {productionInputAvailable,reserveProductionInput,refundProductionInput,stockpileReceiptPreview} from './ea-sr-economy.mjs';
import {prepareFacilityActivity,releaseBodyActivity} from './ea-facility-activities.mjs';
import {facilitySlots,slotById,slotReservation} from './ea-facility-slots.mjs';
import {scenicDistance} from './ea-scene-geometry.mjs';
import {routeReachable} from './ea-route-reachability.mjs';
import {inviteWork} from './ea-sr-persons.mjs';
import {day} from './ea-data.mjs';

const clone=x=>structuredClone(x),mind=p=>p.mind||p,active=o=>o&&!['completed','cancelled'].includes(o.phase),orders=s=>Object.values(s.workOrdersById||{}).filter(o=>o.kind==='sr-site-service'),mealOrders=s=>Object.values(s.workOrdersById||{}).filter(o=>o.kind==='sr-site-meal');
const building=(s,id)=>s.buildingsById?.[id]||s.buildings.find(b=>b.id===id),stockId=b=>`stockpile:${b.instanceId}`,position=p=>mind(p).scenic,action=p=>p.mind?.activity||p.action;
const alive=(s,p)=>p&&p.lifeStatus!=='dead'&&!mind(p).away&&!mind(p).journey&&(!p.location?.sceneId||p.location.sceneId==='scene:yunxiu-courtyard')&&(p===s.master||s.homeMemberIds.includes(p.personId));
const availableBuilding=b=>siteServiceEnabled(b)&&b.enabled!==false&&!b.disabled&&b.condition>0&&!b.spatialLock;
const known=(p,id)=>p.artsById?.[id]?.understanding??mind(p).knowledge?.[id]??0;
const qualified=(p,r)=>!r.skillGate||(r.skills||[r.skill]).some(id=>known(p,id)>=r.skillGate);
const workerSlot=(s,b,r)=>facilitySlots(s,b,r.slotKind).find(x=>x.id===`${b.instanceId}/slot:${r.slotKey}`);
function patientSlot(s,b,r){return facilitySlots(s,b,r.patientSlotKind).find(x=>(!r.patientSlotKey||x.id===`${b.instanceId}/slot:${r.patientSlotKey}`)&&!slotReservation(s,x.id));}
function bodyFree(s,p){const a=s.activitiesById[p?.activityId];return !a||a.kind==='facility'&&!a.serviceOrderId&&!a.serviceMealOrderId&&['rest','heal','social'].includes(action(p));}
function pathTo(s,p,slot){return !!slot&&!!position(p)&&routeReachable(s,position(p),slot.position,`service:${p.personId}`);}
function workerReason(s,p,o){
 const b=building(s,o.targetId),r=o.recipeSnapshot;
 if(!alive(s,p))return '本人尚未在院中可承担差事。';
 if(!availableBuilding(b))return '设施尚未可用。';
 if(p.personId===o.patientId)return '医生与患者需要各自的身体和位置。';
 if(p.wound>20||p.energy<22||(mind(p).satiety??100)<22)return '伤势、精力或口粮需要先照料。';
 if(!qualified(p,r))return '尚未掌握这份工序所需的药理。';
 if(!pathTo(s,p,workerSlot(s,b,r)))return '工位通路暂不可达。';
 if(!bodyFree(s,p)&&s.activitiesById[p.activityId]?.serviceOrderId!==o.id)return '本人已有另一项身体活动。';
 return '';
}
function setAction(p,value){if(p.mind)p.mind.activity=value;else p.action=value;}
function attach(s,p,b,a,slotId,field,id){
 releaseBodyActivity(s,p);setAction(p,a);p.job=a==='work'?b.id:null;
 if(p===s.master){p.learning=null;p.path=[];p.work=0;}
 prepareFacilityActivity(s,p,b,a,0,{slotId});
 const body=s.activitiesById[p.activityId];if(!body)throw Error('无法建立实际身体工位。');body[field]=id;
}
function detach(s,p,id){const a=s.activitiesById[p?.activityId];if(a?.serviceOrderId!==id&&a?.serviceMealOrderId!==id)return;releaseBodyActivity(s,p);setAction(p,'rest');p.job=null;if(p.mind){p.mind.commitUntil=s.time;if(p.schedule)p.schedule.commitUntilTick=s.worldTick;}}
const addRecord=(s,kind,values)=>{if(!s.economy)return;for(const[k,v]of Object.entries(values))s.economy[kind][k]=(s.economy[kind][k]||0)+v;};
function requireOrder(s,id){const o=s.workOrdersById[id];if(o?.kind!=='sr-site-service'||!active(o))throw Error('此服务工单已结束或不存在。');return o;}

export function startSiteService(s,{buildingId,recipeId,patientId}={}){
 const b=building(s,buildingId),recipe=SERVICE_RECIPES[recipeId];
 if(!availableBuilding(b)||!recipe||recipe.buildingType!==b.type)throw Error('服务设施或配方不可用。');
 if(!s.serviceResources)throw Error('先启用生活物资供应。');
 const r=serviceRecipe(recipeId,b.level),slot=workerSlot(s,b,r);
 if(!slot||orders(s).some(o=>active(o)&&o.targetId===b.instanceId&&o.recipeSnapshot.slotKey===r.slotKey))throw Error('该工位已有未完工单。');
 if(!productionInputAvailable(s,b,r.input))throw Error('现场材料不足，请实际搬入。');
 const id=`work:site-service:${b.instanceId}:${s.transactions.nextCommandId}`,reservationId=`reservation:site-service:${id}`;
 if(s.workOrdersById[id])throw Error('服务工单编号已使用。');
 let patient=null,patientSeat=null;
 if(r.patientSlotKind){
  patient=s.personsById[patientId||'person:master'];patientSeat=patientSlot(s,b,r);
  if(!alive(s,patient)||patient.wound<=0||!bodyFree(s,patient)||!pathTo(s,patient,patientSeat))throw Error('患者伤情、身体活动或诊疗位置尚不具备条件。');
  if(patient!==s.master&&((mind(patient).relationships?.master?.trust??55)<15||(mind(patient).commitUntil||0)>s.time&&!['rest','heal'].includes(action(patient))))return {accepted:false,reason:'本人希望先完成现有事务，暂未接受诊疗。'};
 }
 reserveProductionInput(s,b,r.input);
 const o={id,kind:'sr-site-service',version:SITE_SERVICE_VERSION,targetId:b.instanceId,sourceStockpileId:stockId(b),recipeId,recipeSnapshot:r,createdTick:s.worldTick,lastTick:s.worldTick,phase:'queued',progressTicks:0,durationTicks:r.durationTicks,workerId:null,patientId:patient?.personId||null,patientSlotId:patientSeat?.id||null,reservationId,usedInput:{},resultFactId:null,reason:'现场材料已预留，等待本人承担工序。'};
 s.workOrdersById[id]=o;s.reservationsById[reservationId]={id:reservationId,kind:'sr-site-service-input',workOrderId:id,sourceStockpileId:o.sourceStockpileId,cost:clone(r.input),remainingCost:clone(r.input),usedCost:{},createdTick:s.worldTick};
 if(patient)attach(s,patient,b,r.patientSlotKind,patientSeat.id,'serviceOrderId',id);
 return {accepted:true,id,workOrderId:id};
}
export function masterSiteService(s,id){const o=requireOrder(s,id),p=s.master,reason=workerReason(s,p,o);if(reason)throw Error(reason);if(o.workerId&&o.workerId!==p.personId)throw Error('已有本人正在承担该工序。');const b=building(s,o.targetId);attach(s,p,b,'work',workerSlot(s,b,o.recipeSnapshot).id,'serviceOrderId',o.id);o.workerId=p.personId;o.phase='moving';return {accepted:true,workOrderId:o.id};}
export function requestServiceWork(s,{workOrderId,personId}={}){
 const o=requireOrder(s,workOrderId),p=s.personsById[personId];if(p===s.master)throw Error('掌门使用亲自承担工序。');const reason=workerReason(s,p,o);if(reason)return {accepted:false,available:false,publicReason:reason};if(o.workerId&&o.workerId!==personId)return {accepted:false,available:false,publicReason:'此工序已有本人承担。'};
 const b=building(s,o.targetId),answer=inviteWork(s,personId,b.instanceId);if(!answer.accepted)return answer;
 attach(s,p,b,'work',workerSlot(s,b,o.recipeSnapshot).id,'serviceOrderId',o.id);o.workerId=personId;o.phase='moving';return answer;
}
export function cancelSiteService(s,id){
 const o=requireOrder(s,id),b=building(s,o.targetId),r=s.reservationsById[o.reservationId];
 refundProductionInput(s,b,r.remainingCost);o.phase='cancelled';o.finishedTick=s.worldTick;o.returnedInput=clone(r.remainingCost);o.usedInput=clone(r.usedCost);delete s.reservationsById[r.id];
 for(const pid of [o.workerId,o.patientId])if(pid)detach(s,s.personsById[pid],o.id);
 const fid=`fact:site-service-result:${o.id}:cancelled`;s.factsById[fid]={id:fid,kind:'site-service-cancelled',workOrderId:id,atTick:s.worldTick,returnedInput:clone(o.returnedInput),usedInput:clone(o.usedInput)};o.resultFactId=fid;return {cancelled:true,returned:clone(o.returnedInput)};
}
function arrived(s,p,b,o,role){
 const a=s.activitiesById[p?.activityId];if(!a||a.serviceOrderId!==o.id)return false;
 const slotId=role==='worker'?workerSlot(s,b,o.recipeSnapshot)?.id:o.patientSlotId;
 return prepareFacilityActivity(s,p,b,role==='worker'?'work':o.recipeSnapshot.patientSlotKind,4.6,{slotId})&&s.activitiesById[p.activityId]?.slotId===slotId;
}
function finish(s,o,b){
 const r=o.recipeSnapshot,patient=s.personsById[o.patientId],output=r.output||{};
 if(!stockpileReceiptPreview(s,o.sourceStockpileId,output).available){o.phase='waiting';o.reason='工序已完成，现场成品库位不足，等待腾出空间。';return;}
 const id=`fact:site-service-result:${o.id}:completed`;if(s.factsById[id])throw Error('服务结果已经登记。');
 const effect=patient?{woundBefore:patient.wound,woundAfter:Math.max(0,patient.wound-(r.woundRecovery||0)),energyBefore:patient.energy,energyAfter:Math.min(100,patient.energy+(r.energyRecovery||0))}:null;
 refundProductionInput(s,b,output);addRecord(s,'income',output);if(effect){patient.wound=effect.woundAfter;patient.energy=effect.energyAfter;}
 s.factsById[id]={id,kind:'site-service-completed',workOrderId:o.id,recipeId:o.recipeId,atTick:s.worldTick,workerId:o.workerId,patientId:o.patientId,input:clone(o.usedInput),output:clone(output),effect};o.resultFactId=id;o.finishedTick=s.worldTick;o.phase='completed';o.reason='工序完成，结果已登记。';delete s.reservationsById[o.reservationId];
 for(const pid of [o.workerId,o.patientId])if(pid)detach(s,s.personsById[pid],o.id);
}
export function siteServicePersonBusy(s,p){const a=s.activitiesById?.[p.activityId];return !!(a?.kind==='facility'&&(a.serviceOrderId&&active(s.workOrdersById[a.serviceOrderId])||a.serviceMealOrderId&&active(s.workOrdersById[a.serviceMealOrderId])));}
export function siteMealCount(s,personId,dayIndex=day(s)){return Object.values(s.factsById||{}).filter(f=>f.kind==='site-meal-consumed'&&f.personId===personId&&f.dayIndex===dayIndex).length;}
function firstKitchenDay(s){
 const facts=Object.values(s.factsById||{}).filter(f=>f.kind==='site-service-commissioned'&&(f.siteId==='site:domain:gc-13'||building(s,f.buildingId)?.type==='kitchen'));
 return facts.length?Math.min(...facts.map(f=>Math.floor((s.time-(s.worldTick-f.atTick)/10)/120))):null;
}
export function siteFoodDemand(s,dayIndex=day(s)){
 const first=firstKitchenDay(s);if(first===null||day(s)<=first)return null;
 return ['person:master',...s.homeMemberIds].filter(id=>s.personsById[id]?.lifeStatus!=='dead').reduce((sum,id)=>sum+Math.max(0,2-siteMealCount(s,id,dayIndex)),0);
}
export function siteFoodSettlement(s){const first=firstKitchenDay(s);return first===null||day(s)<=first?null:day(s)===first+1?0:siteFoodDemand(s,day(s)-1);}
export function siteFoodPrepaidTransition(s){const first=firstKitchenDay(s);return first!==null&&day(s)===first+1;}
export function sitePersonalMealSupply(s,personId,dayIndex=day(s)){
 const first=firstKitchenDay(s);if(first===null||dayIndex<=first+1)return [];
 return Object.values(s.factsById||{}).filter(f=>f.kind==='site-meal-consumed'&&f.personId===personId&&f.dayIndex===dayIndex-1).map(f=>f.id);
}
export function siteMealView(s,b,personId='person:master',resourceKey='meal'){
 const p=s.personsById[personId],remainingToday=Math.max(0,2-siteMealCount(s,personId));let reason='';
 if(!availableBuilding(b)||b.type!=='kitchen')reason='膳房尚未可用。';else if(firstKitchenDay(s)!==null&&day(s)<=firstKitchenDay(s))reason='今日口粮已经结算，翌日起按实际用膳抵扣。';else if(!alive(s,p))reason='本人尚未在院中。';else if(!['meal','spiritMeal'].includes(resourceKey))reason='用膳物资无效。';else if(!remainingToday)reason='今日两份口粮已经用足。';else if(!(s.stockpilesById[stockId(b)]?.resources[resourceKey]>=1))reason='现场尚无这份熟食。';else if(!bodyFree(s,p))reason='本人已有另一项身体活动。';
 const seat=!reason&&facilitySlots(s,b,'eat').find(slot=>!slotReservation(s,slot.id)&&pathTo(s,p,slot));if(!reason&&!seat)reason='暂无可达的空用膳位。';
 return {available:!reason,reason,remainingToday,slotId:seat?.id||null};
}
export function eatSiteMeal(s,{buildingId,resourceKey='meal'}={}){return beginMeal(s,s.master,building(s,buildingId),resourceKey);}
export function considerSiteMeal(s,p){
 if(s.schemaVersion!==6||!s.serviceResources||p===s.master||!alive(s,p)||siteServicePersonBusy(s,p)||(mind(p).commitUntil||0)>s.time||!bodyFree(s,p))return false;
 if((mind(p).satiety??100)>=80&&(s.worldTick%s.ticksPerDay)/s.ticksPerDay<.65)return false;
 for(const b of s.buildings.filter(x=>siteServiceEnabled(x)&&x.type==='kitchen').sort((a,b)=>scenicDistance(position(p),spatialEntry(s,a))-scenicDistance(position(p),spatialEntry(s,b))))for(const key of ['meal','spiritMeal'])if(siteMealView(s,b,p.personId,key).available){beginMeal(s,p,b,key);mind(p).reason='今日尚有口粮份额，愿到膳房实际用膳。';return true;}
 return false;
}
function spatialEntry(s,b){return facilitySlots(s,b,'eat')[0]?.position||position(s.master);}
function beginMeal(s,p,b,resourceKey){
 const view=siteMealView(s,b,p.personId,resourceKey);if(!view.available)throw Error(view.reason);
 const id=`work:site-meal:${p.personId}:${s.transactions.nextCommandId}:${s.worldTick}`,reservationId=`reservation:site-service:${id}`;if(s.workOrdersById[id])throw Error('本次用膳已经安排。');reserveProductionInput(s,b,{[resourceKey]:1});
 const o={id,kind:'sr-site-meal',version:SITE_SERVICE_VERSION,targetId:b.instanceId,sourceStockpileId:stockId(b),personId:p.personId,resourceKey,slotId:view.slotId,reservationId,phase:'moving',createdTick:s.worldTick,lastTick:s.worldTick,resultFactId:null};s.workOrdersById[id]=o;s.reservationsById[reservationId]={id:reservationId,kind:'sr-site-service-input',workOrderId:id,sourceStockpileId:o.sourceStockpileId,cost:{[resourceKey]:1},remainingCost:{[resourceKey]:1},usedCost:{},createdTick:s.worldTick};attach(s,p,b,'eat',view.slotId,'serviceMealOrderId',id);return {accepted:true,workOrderId:id};
}
export function tickSiteServices(s){
 if(s.speed===0)return;
 for(const o of orders(s)){
  if(!active(o)||o.lastTick>=s.worldTick)continue;o.lastTick=s.worldTick;const b=building(s,o.targetId),p=s.personsById[o.workerId],patient=s.personsById[o.patientId];
  if(!availableBuilding(b)){o.phase='waiting';o.reason='设施暂不可用，保留投入和工序。';continue;}
  if(!p){o.reason='等待本人承担工序。';continue;}
  if(!alive(s,p)||p.wound>20||p.energy<22||action(p)!=='work'||p.job!==b.id||s.activitiesById[p.activityId]?.serviceOrderId!==o.id){detach(s,p,o.id);o.workerId=null;o.phase='waiting';o.reason='工作已中断，保留已投入物资与进度。';continue;}
  if(patient&&(!alive(s,patient)||s.activitiesById[patient.activityId]?.serviceOrderId!==o.id||action(patient)!==o.recipeSnapshot.patientSlotKind)){o.phase='waiting';o.reason='患者已离位，待双方重新到场或取消工单。';continue;}
  const workerReady=arrived(s,p,b,o,'worker'),patientReady=!patient||arrived(s,patient,b,o,'patient');if(!workerReady||!patientReady){o.phase='moving';o.reason='等待实际到齐各自工位。';continue;}
  if(o.progressTicks<o.durationTicks){const r=s.reservationsById[o.reservationId];if(!o.progressTicks){r.usedCost=clone(r.cost);r.remainingCost=Object.fromEntries(Object.keys(r.cost).map(k=>[k,0]));o.usedInput=clone(r.usedCost);addRecord(s,'expense',r.usedCost);}o.progressTicks++;p.energy=Math.max(0,p.energy-.032);o.phase='working';o.reason='本人已到场，正在实际劳动。';}
  if(o.progressTicks===o.durationTicks)finish(s,o,b);
 }
 for(const o of mealOrders(s)){
  if(!active(o)||o.lastTick>=s.worldTick)continue;o.lastTick=s.worldTick;const p=s.personsById[o.personId],b=building(s,o.targetId),a=s.activitiesById[p?.activityId],r=s.reservationsById[o.reservationId];
  if(!alive(s,p)||!availableBuilding(b)||a?.serviceMealOrderId!==o.id||action(p)!=='eat'||siteMealCount(s,p.personId)>=2){refundProductionInput(s,b,r.remainingCost);delete s.reservationsById[r.id];o.phase='cancelled';o.finishedTick=s.worldTick;detach(s,p,o.id);continue;}
  if(!prepareFacilityActivity(s,p,b,'eat',4.6,{slotId:o.slotId}))continue;
  const id=`fact:site-meal:${o.id}`;s.factsById[id]={id,kind:'site-meal-consumed',workOrderId:o.id,personId:p.personId,buildingId:b.instanceId,resourceKey:o.resourceKey,quantity:1,dayIndex:day(s),atTick:s.worldTick};addRecord(s,'expense',{[o.resourceKey]:1});if(o.resourceKey==='spiritMeal')p.energy=Math.min(100,p.energy+6);o.phase='completed';o.finishedTick=s.worldTick;o.resultFactId=id;delete s.reservationsById[r.id];detach(s,p,o.id);
 }
}
export function viewSiteServices(s,buildingId){
 const b=building(s,buildingId);if(!siteServiceEnabled(b))return {enabled:false,buildingId:b?.instanceId||buildingId,recipes:[],orders:[]};
 return {enabled:true,buildingId:b.instanceId,stockpileId:stockId(b),patients:b.type==='clinic'?['person:master',...s.homeMemberIds].map(id=>{const p=s.personsById[id],available=alive(s,p)&&p.wound>0&&bodyFree(s,p);return {personId:id,name:p.name,wound:p.wound,available,reason:available?'':'本人伤情或现有身体活动暂不适合诊疗。'};}):[],recipes:Object.values(SERVICE_RECIPES).filter(r=>r.buildingType===b.type).map(r=>{const recipe=serviceRecipe(r.id,b.level),busy=orders(s).some(o=>active(o)&&o.targetId===b.instanceId&&o.recipeSnapshot.slotKey===recipe.slotKey),reason=!availableBuilding(b)?'设施尚未可用。':busy?'工位已有未完工单。':!productionInputAvailable(s,b,recipe.input)?'现场材料不足，请实际搬入。':'';return {...recipe,available:!reason,reason};}),orders:orders(s).filter(o=>o.targetId===b.instanceId).map(o=>({id:o.id,recipeId:o.recipeId,phase:o.phase,progressTicks:o.progressTicks,durationTicks:o.durationTicks,workerId:o.workerId,patientId:o.patientId,reason:o.reason,masterWork:(()=>{const reason=active(o)?o.workerId&&o.workerId!=='person:master'?'已有本人承担该工序。':workerReason(s,s.master,o):'工单已经结束。';return {available:!reason,reason};})(),invites:s.homeMemberIds.map(pid=>{const p=s.personsById[pid],reason=active(o)?o.workerId&&o.workerId!==pid?'已有本人承担该工序。':workerReason(s,p,o):'工单已经结束。';return {personId:pid,name:p.name,available:!reason,reason,lastResult:clone(p.schedule?.invitations?.[`work:${b.instanceId}`]||null)};})})),meal:siteMealView(s,b),spiritMeal:siteMealView(s,b,'person:master','spiritMeal')};
}
export function validateSiteServices(s){
 const fail=()=>{throw Error('现场服务工单、投入或用膳事实异常。');},tick=n=>Number.isSafeInteger(n)&&n>=0&&n<=s.worldTick,equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),occupied=new Set();
 for(const o of orders(s)){
  const b=building(s,o.targetId),r=SERVICE_RECIPES[o.recipeId]&&serviceRecipe(o.recipeId,o.recipeSnapshot?.level),reservation=s.reservationsById[o.reservationId];
  const commission=s.factsById[`fact:site-service:${o.targetId}`];
  if(o.id!==s.workOrdersById[o.id]?.id||o.version!==SITE_SERVICE_VERSION||(!b?active(o)||commission?.kind!=='site-service-commissioned':!siteServiceEnabled(b))||!r||b&&r.buildingType!==b.type||active(o)&&r.level!==b.level||commission?.siteId!==`site:domain:gc-${r.buildingType==='kitchen'?13:14}`||!equal(o.recipeSnapshot,r)||o.sourceStockpileId!==`stockpile:${o.targetId}`||!tick(o.createdTick)||!tick(o.lastTick)||o.lastTick<o.createdTick||!['queued','moving','working','waiting','completed','cancelled'].includes(o.phase)||!Number.isSafeInteger(o.progressTicks)||o.progressTicks<0||o.progressTicks>r.durationTicks||o.durationTicks!==r.durationTicks||typeof o.reason!=='string'||o.workerId&&!s.personsById[o.workerId]||o.patientId&&!s.personsById[o.patientId]||o.workerId&&o.workerId===o.patientId)fail();
  if(!!r.patientSlotKind!==!!o.patientId||active(o)&&r.patientSlotKind&&(!slotById(s,o.patientSlotId)||slotById(s,o.patientSlotId).kind!==r.patientSlotKind))fail();
  if(!equal(o.usedInput,o.progressTicks?r.input:{}))fail();
  if(active(o)){const key=`${o.targetId}/${r.slotKey}`;if(occupied.has(key))fail();occupied.add(key);if(!reservation||reservation.id!==o.reservationId||reservation.kind!=='sr-site-service-input'||reservation.workOrderId!==o.id||reservation.sourceStockpileId!==o.sourceStockpileId||reservation.createdTick!==o.createdTick||!equal(reservation.cost,r.input)||!equal(reservation.usedCost,o.usedInput)||!equal(reservation.remainingCost,o.progressTicks?Object.fromEntries(Object.keys(r.input).map(k=>[k,0])):r.input)||o.resultFactId!==null)fail();}
  else{const fact=s.factsById[o.resultFactId];if(reservation||!tick(o.finishedTick)||o.finishedTick<o.createdTick||!fact||fact.id!==o.resultFactId||fact.workOrderId!==o.id||fact.atTick!==o.finishedTick||o.phase==='completed'&&(o.progressTicks!==r.durationTicks||fact.kind!=='site-service-completed'||fact.workerId!==o.workerId||fact.patientId!==o.patientId||!equal(fact.input,o.usedInput)||!equal(fact.output,r.output||{}))||o.phase==='cancelled'&&(fact.kind!=='site-service-cancelled'||!equal(fact.usedInput,o.usedInput)||!equal(fact.returnedInput,o.progressTicks?Object.fromEntries(Object.keys(r.input).map(k=>[k,0])):r.input)))fail();if(o.phase==='completed'&&o.patientId){const e=fact.effect;if(!e||![e.woundBefore,e.woundAfter,e.energyBefore,e.energyAfter].every(v=>Number.isFinite(v)&&v>=0&&v<=100)||e.woundAfter!==Math.max(0,e.woundBefore-r.woundRecovery)||e.energyAfter!==Math.min(100,e.energyBefore+r.energyRecovery))fail();}}
 }
 const counts=new Map();for(const f of Object.values(s.factsById))if(f.kind==='site-meal-consumed'){const o=s.workOrdersById[f.workOrderId],key=`${f.personId}/${f.dayIndex}`;counts.set(key,(counts.get(key)||0)+1);if(!o||o.kind!=='sr-site-meal'||o.phase!=='completed'||o.resultFactId!==f.id||!s.personsById[f.personId]||f.personId!==o.personId||f.resourceKey!==o.resourceKey||f.quantity!==1||!tick(f.atTick)||f.dayIndex!==Math.floor((s.time-(s.worldTick-f.atTick)/10)/120)||counts.get(key)>2)fail();}
 for(const o of mealOrders(s)){const b=building(s,o.targetId),r=s.reservationsById[o.reservationId],commission=s.factsById[`fact:site-service:${o.targetId}`];if(o.version!==SITE_SERVICE_VERSION||(!b?active(o)||commission?.kind!=='site-service-commissioned':!siteServiceEnabled(b)||b.type!=='kitchen')||!s.personsById[o.personId]||!['meal','spiritMeal'].includes(o.resourceKey)||!['moving','completed','cancelled'].includes(o.phase)||!tick(o.createdTick)||!tick(o.lastTick)||o.lastTick<o.createdTick||o.sourceStockpileId!==`stockpile:${o.targetId}`||active(o)&&slotById(s,o.slotId)?.kind!=='eat'||o.phase==='completed'&&s.factsById[o.resultFactId]?.kind!=='site-meal-consumed')fail();if(active(o)?!r||r.id!==o.reservationId||r.kind!=='sr-site-service-input'||r.workOrderId!==o.id||r.sourceStockpileId!==o.sourceStockpileId||r.createdTick!==o.createdTick||!equal(r.cost,{[o.resourceKey]:1})||!equal(r.remainingCost,r.cost)||!equal(r.usedCost,{})||o.resultFactId!==null:!!r||!tick(o.finishedTick))fail();}
 for(const a of Object.values(s.activitiesById))if(a.serviceOrderId||a.serviceMealOrderId){const o=s.workOrdersById[a.serviceOrderId||a.serviceMealOrderId];if(a.kind!=='facility'||!active(o)||a.targetId!==o.targetId||a.serviceOrderId&&![o.workerId,o.patientId].includes(a.personId)||a.serviceMealOrderId&&o.personId!==a.personId)fail();const expectedAction=a.serviceMealOrderId?'eat':a.personId===o.workerId?'work':o.recipeSnapshot.patientSlotKind,expectedSlot=a.serviceMealOrderId?o.slotId:a.personId===o.workerId?`${o.targetId}/slot:${o.recipeSnapshot.slotKey}`:o.patientSlotId;if(a.action!==expectedAction||a.slotId&&a.slotId!==expectedSlot)fail();}
 for(const r of Object.values(s.reservationsById))if(r.kind==='sr-site-service-input'&&(!active(s.workOrdersById[r.workOrderId])||s.workOrdersById[r.workOrderId].reservationId!==r.id))fail();return true;
}
export const siteServiceHandlers={startSiteService,cancelSiteService,masterSiteService,requestServiceWork,eatSiteMeal};
