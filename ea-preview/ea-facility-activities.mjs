/** Body activities and exclusive work stations, called only by the world owner. */
import {BUILDINGS,canPay,pay,grant} from './ea-data.mjs?v=ea-160-courtyard-20261008-r36';
import {productionAvailability,settleFiniteProduction,initEconomy,productionInputAvailable,reserveProductionInput,refundProductionInput,cancelMerchantCollection,farmWaterlogged,FARM_CROP_RECIPE,FARM_V1_RECIPE,PRODUCTION_RECIPE_VERSION,productionRecipeDefinition,productionRecipeSnapshot} from './ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r36';
const units=(s,pixels)=>s.spatial?.version==='spatial-metres-1'?pixels/32:pixels;
const spacing=s=>s.spatial?.version==='spatial-metres-1'?.5:8;
const arrival=s=>s.spatial?.version==='spatial-metres-1'?.04:.5;
import {facilitySlots,slotById,slotReservation,facilityBodyKinds} from './ea-facility-slots.mjs?v=ea-160-courtyard-20261008-r36';
import {geometryRevision,buildingAccess,scenicFindPath,scenicDistance,scenicSweep,scenicNearest} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r36';
import {advanceScenic,syncScenicPosition} from './ea-scenic.mjs?v=ea-160-courtyard-20261008-r36';
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
 if(position.bodyYield?.kind==='mutual-corridor'){a.phase='waiting';a.reason='正在给同行者让路，随后继续前往原工位。';return false;}
 const arrived=()=>scenicDistance(position,slot.position)<arrival(s)&&!scenicSweep(s,position,slot.position).blocked;
 if(!arrived()){
  if(position.revision!==geometryRevision(s)||!position.goal||scenicDistance(position.goal,slot.position)>units(s,.01)||!position.path.length){
   const path=scenicFindPath(s,position,slot.position,{maxSnap:units(s,1)});
   if(path===null){a.phase='waiting';a.reason='工位通路受阻。';position.path=[];position.goal=null;return false;}
   position.path=path;position.goal={...slot.position};position.revision=geometryRevision(s);position.destinationId=b.id;
  }
  a.phase='navigating';a.reason='前往'+slot.label+'。';
  if(budget>0){const moved=advanceScenic(position,budget,s);p.energy=Math.max(0,p.energy-moved/46*.04);syncScenicPosition(s,p);if(position.waitingForPersonId){a.phase='waiting';a.reason=`${s.personsById[position.waitingForPersonId]?.name||'同行者'}暂占通路，等待其移动。`;}}
  if(p===s.master&&!position.path.length&&action==='study')p.action='study';
  // Arrival itself spends this world step, never also a full second of work.
  return false;
 }
 position.path=[];position.goal={...slot.position};a.phase='executing';a.reason='正在使用'+slot.label+'。';return true;
}
export function productionOrder(s,b){return s.workOrdersById?.[`work:production:${b.instanceId}`]||null;}
const ordinaryRecipe=(b,version=PRODUCTION_RECIPE_VERSION)=>productionRecipeDefinition(version,b.type);
function snapshotOrdinaryBatch(s,b,order){
 if(b.type==='farm'||!s.srEconomy)return;
 order.recipeSnapshot=productionRecipeSnapshot(s,b);
 order.participantSkills={};
}
// Called after the original save has passed validation on a clone. No goods,
// progress, wages or results are created by the compatibility step.
export function upgradeProductionRecipeSnapshots(s){
 for(const order of Object.values(s.workOrdersById||{})){
  if(order.kind!=='production'||order.phase==='completed'||order.recipeSnapshot)continue;
  const b=s.buildingsById[order.targetId],recipe=b&&ordinaryRecipe(b,'economy:yunxiu:v1');
  if(!recipe||b.type==='farm')continue;
  order.recipeSnapshot={...productionRecipeSnapshot(s,b,'economy:yunxiu:v1'),createdTick:0};
 }
 return s;
}
function nextFarmBatch(s,b){const prefixes=[`fact:crop:sow:${b.instanceId}:`,`fact:production:${b.instanceId}:`],numbers=Object.keys(s.factsById||{}).flatMap(id=>prefixes.filter(prefix=>id.startsWith(prefix)).map(prefix=>Number(id.slice(prefix.length)))).filter(Number.isSafeInteger);return Math.max(0,...numbers)+1;}
function startFarmCrop(s,b,order,p){
 const siteId=`stockpile:${b.instanceId}`,site=s.stockpilesById?.[siteId],cost=FARM_CROP_RECIPE.seedCost;
 if(!site||site.ownerId!=='person:master'||site.access!=='public'||!productionInputAvailable(s,b,cost))return false;
 if(!reserveProductionInput(s,b,cost))return false;
 const sowFactId=`fact:crop:sow:${b.instanceId}:${order.batch}`;
 order.recipeSnapshot={recipeId:FARM_CROP_RECIPE.recipeId,recipeVersion:FARM_CROP_RECIPE.recipeVersion,inputCost:{...cost},durationUnit:'contribution',durationValue:FARM_CROP_RECIPE.careRequired,outputDefinition:{...FARM_CROP_RECIPE.output},outputRuleVersion:'farm-yield:v1',skillRuleVersion:'production-skill:v1',skillGate:0,workstationRule:'facility:farm:four-exclusive-slots',sourceStockpileIds:{herb:siteId},ownerId:site.ownerId,createdTick:s.worldTick};
 order.crop={cropId:`crop:${b.instanceId}:${order.batch}`,recipeVersion:FARM_CROP_RECIPE.recipeVersion,seedSourceStockpileId:siteId,seedUsed:cost.herb,sownAtTick:s.worldTick,growthElapsedTicks:0,maturityRequiredTicks:FARM_CROP_RECIPE.maturityRequiredTicks,careContribution:0,maturedAtTick:null,harvestedAtTick:null,fallowUntilTick:null,weatherPauseReason:null,phase:'growing',sowFactId};
 order.participantSkills={};order.inheritedTicks=0;order.progressTicks=0;order.durationTicks=FARM_CROP_RECIPE.careRequired;order.contributions={};
 s.reservationsById[order.reservationId].usedCost={...cost};s.reservationsById[order.reservationId].remainingCost={herb:0};
 s.factsById[sowFactId]={id:sowFactId,kind:'crop-sow',atTick:s.worldTick,actorId:p.personId,buildingId:b.instanceId,workOrderId:order.id,batch:order.batch,sourceStockpileId:siteId,quantity:cost.herb,recipeVersion:FARM_CROP_RECIPE.recipeVersion};
 return true;
}
export function contributeProduction(s,p,b,settle){
 if(interruptWoundedWork(s,p))return false;
 const a=bodyActivity(s,p);if(!a||a.action!=='work'||a.phase!=='executing'||a.targetId!==b.instanceId)return false;
 if(s.srEconomy)initEconomy(s);
 let order=productionOrder(s,b);
 const newFarm=s.srEconomy&&b.type==='farm'&&(!order||order.phase==='completed'),cropBatch=order?.recipeSnapshot?.recipeVersion===FARM_CROP_RECIPE.recipeVersion;
 if(!newFarm&&!cropBatch){const availability=productionAvailability(s,b);if(!availability.available){a.reason=availability.reason;return false;}}
 if(!order){
  const cost=newFarm?FARM_CROP_RECIPE.seedCost:s.srEconomy?ordinaryRecipe(b)?.inputCost||{}:BUILDINGS[b.type].input||{};if(!productionInputAvailable(s,b,cost)){a.reason=newFarm?'药田缺少现场灵草2份种苗；先实际搬入。':s.srEconomy?'工位尚未收到原料；先从府库实际搬入。':'生产原料不足。';return false;}
  const id=`work:production:${b.instanceId}`,reservationId=`reservation:input:${b.instanceId}`;
  if(!newFarm)reserveProductionInput(s,b,cost);s.reservationsById[reservationId]={id:reservationId,kind:'materials',workOrderId:id,cost:{...cost}};
  const duration=s.srEconomy?(newFarm?FARM_CROP_RECIPE.careRequired:ordinaryRecipe(b).durationValue):BUILDINGS[b.type].duration*10;
  order={id,kind:'production',targetId:b.instanceId,phase:'active',batch:newFarm?nextFarmBatch(s,b):1,inheritedTicks:Math.min(duration-1,Math.round((b.progress||0)*10)),progressTicks:Math.min(duration-1,Math.round((b.progress||0)*10)),durationTicks:duration,reservationId,contributions:{},resultTransactionId:null};
  if(!newFarm)snapshotOrdinaryBatch(s,b,order);
  if(newFarm&&!startFarmCrop(s,b,order,p)){delete s.reservationsById[reservationId];a.reason='药田种苗须来自田边公有库存。';return false;}
  s.workOrdersById[id]=order;b.progress=0;
 }
 if(order.phase==='completed'){
  if(newFarm&&s.worldTick<(order.crop?.fallowUntilTick??0)){a.reason='药田刚收获，下一世界步方可播种。';return false;}
  const cost=newFarm?FARM_CROP_RECIPE.seedCost:s.srEconomy?ordinaryRecipe(b)?.inputCost||{}:BUILDINGS[b.type].input||{};if(!productionInputAvailable(s,b,cost)){a.reason=newFarm?'下一批药田缺少现场灵草2份种苗；先实际搬入。':s.srEconomy?'下一批工位原料不足，先实际搬入。':'下一批原料不足。';return false;}
  if(!newFarm)reserveProductionInput(s,b,cost);s.reservationsById[order.reservationId]={id:order.reservationId,kind:'materials',workOrderId:order.id,cost:{...cost}};
  order.phase='active';order.batch++;order.progressTicks=0;order.inheritedTicks=0;order.contributions={};order.resultTransactionId=null;
  if(!newFarm)snapshotOrdinaryBatch(s,b,order);
  if(newFarm&&!startFarmCrop(s,b,order,p)){delete s.reservationsById[order.reservationId];order.phase='completed';order.batch--;a.reason='药田种苗须来自田边公有库存。';return false;}
 }
 a.workOrderId=order.id;order.phase='active';
 if(order.crop){if(farmWaterlogged(s)){order.crop.phase='paused:waterlogged';order.crop.weatherPauseReason='waterlogged';a.reason='药田积水，成长与照料暂停。';order.phase='waiting';return false;}if(order.crop.maturedAtTick===null&&order.progressTicks>=order.durationTicks){a.reason='照料已满，等待灵草成熟。';order.phase='waiting';return false;}}
 const contribution=Math.min(10,order.durationTicks-order.progressTicks);order.progressTicks+=contribution;if(contribution){order.contributions[p.personId]=(order.contributions[p.personId]||0)+contribution;if(order.crop)order.participantSkills[p.personId]??=p.mind?.skills?.plant||0;else if(order.recipeSnapshot?.recipeVersion===PRODUCTION_RECIPE_VERSION)order.participantSkills[p.personId]??=p.mind?.skills?.[order.recipeSnapshot.skillKey]||0;}
 if(order.crop)order.crop.careContribution=order.progressTicks;
 if(order.progressTicks<order.durationTicks)return true;
 if(order.crop&&order.crop.maturedAtTick===null){order.phase='waiting';order.crop.phase='growing';a.reason='照料已满，等待灵草成熟。';return false;}
 const participants=Object.entries(order.contributions).map(([id,ticks])=>({person:s.personsById[id],share:ticks/order.durationTicks,...(order.crop||order.recipeSnapshot?.recipeVersion===PRODUCTION_RECIPE_VERSION?{skillAtFirstContribution:order.participantSkills[id]}:{})})).sort((a,b)=>b.share-a.share||a.person.id-b.person.id);
 if(!settleFiniteProduction(s,b,settle,participants)){if(!order.crop){order.progressTicks-=contribution;order.contributions[p.personId]-=contribution;if(!order.contributions[p.personId]){delete order.contributions[p.personId];if(order.participantSkills)delete order.participantSkills[p.personId];}}else{order.phase='waiting';order.crop.phase='ripe/waiting';}a.reason='整批成品容量或来源不足，保留投入等待；不会截断产物。';return false;}
 if(order.crop){const factId=`fact:production:${b.instanceId}:${order.batch}`,harvestFactId=`fact:crop:harvest:${b.instanceId}:${order.batch}`;order.crop.harvestedAtTick=s.worldTick;order.crop.fallowUntilTick=s.worldTick+1;order.crop.phase='harvested';s.factsById[harvestFactId]={id:harvestFactId,kind:'crop-harvest',atTick:s.worldTick,buildingId:b.instanceId,workOrderId:order.id,batch:order.batch,sowFactId:order.crop.sowFactId,productionFactId:factId,quantity:s.factsById[factId]?.quantities?.herb||0,recipeVersion:FARM_CROP_RECIPE.recipeVersion};}
 order.phase='completed';order.resultTransactionId=`result:${order.id}:${order.batch}`;delete s.reservationsById[order.reservationId];return true;
}
export function cancelProduction(s,id){
 const b=s.buildings.find(b=>b.id===id),order=b&&productionOrder(s,b);if(!order||order.phase==='completed')throw Error('当前没有未完成的生产批次。');
 for(const collection of Object.values(s.workOrdersById))if(collection.kind==='sr-merchant-collection'&&collection.productionWorkOrderId===order.id&&collection.productionBatch===order.batch&&['to-source','waiting-for-goods'].includes(collection.phase))cancelMerchantCollection(s,collection.id);
 const r=s.reservationsById[order.reservationId],refund={};for(const[k,v]of Object.entries(r.cost))refund[k]=order.crop?0:v*(1-order.progressTicks/order.durationTicks);
 if(order.crop){const id=`fact:crop:cancel:${b.instanceId}:${order.batch}`;s.factsById[id]={id,kind:'crop-cancel',atTick:s.worldTick,buildingId:b.instanceId,batch:order.batch,sowFactId:order.crop.sowFactId,seedUsed:order.crop.seedUsed};}
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
function validateFarmCrop(s,o,b,r,fail){
 const snap=o.recipeSnapshot,c=o.crop,siteId=`stockpile:${b.instanceId}`,sowId=`fact:crop:sow:${b.instanceId}:${o.batch}`,sow=s.factsById[sowId];
 if(!snap||snap.recipeId!==FARM_CROP_RECIPE.recipeId||snap.recipeVersion!==FARM_CROP_RECIPE.recipeVersion||snap.durationUnit!=='contribution'||snap.durationValue!==FARM_CROP_RECIPE.careRequired||JSON.stringify(snap.inputCost)!==JSON.stringify(FARM_CROP_RECIPE.seedCost)||JSON.stringify(snap.outputDefinition)!==JSON.stringify(FARM_CROP_RECIPE.output)||snap.outputRuleVersion!=='farm-yield:v1'||snap.skillRuleVersion!=='production-skill:v1'||snap.skillGate!==0||snap.workstationRule!=='facility:farm:four-exclusive-slots'||snap.sourceStockpileIds?.herb!==siteId||snap.ownerId!=='person:master'||!Number.isSafeInteger(snap.createdTick)||snap.createdTick<0||snap.createdTick>s.worldTick)fail();
 if(!c||c.cropId!==`crop:${b.instanceId}:${o.batch}`||c.recipeVersion!==snap.recipeVersion||c.seedSourceStockpileId!==siteId||c.seedUsed!==FARM_CROP_RECIPE.seedCost.herb||c.sownAtTick!==snap.createdTick||!Number.isSafeInteger(c.growthElapsedTicks)||c.growthElapsedTicks<0||c.growthElapsedTicks>FARM_CROP_RECIPE.maturityRequiredTicks||c.maturityRequiredTicks!==FARM_CROP_RECIPE.maturityRequiredTicks||c.careContribution!==o.progressTicks||!['growing','mature','ripe/waiting','paused:waterlogged','paused:facility','harvested'].includes(c.phase)||c.sowFactId!==sowId)fail();
 if(!sow||sow.kind!=='crop-sow'||sow.atTick!==c.sownAtTick||sow.sourceStockpileId!==siteId||sow.quantity!==c.seedUsed||sow.recipeVersion!==snap.recipeVersion||sow.workOrderId!==o.id||sow.batch!==o.batch)fail();
 if(!o.participantSkills||Object.keys(o.participantSkills).length!==Object.keys(o.contributions).length||!Object.entries(o.participantSkills).every(([pid,v])=>o.contributions[pid]>0&&Number.isFinite(v)&&v>=0&&v<=100))fail();
 if(c.maturedAtTick===null?c.growthElapsedTicks===c.maturityRequiredTicks:!Number.isSafeInteger(c.maturedAtTick)||c.maturedAtTick<c.sownAtTick+c.maturityRequiredTicks||c.maturedAtTick>s.worldTick||c.growthElapsedTicks!==c.maturityRequiredTicks)fail();
 if(c.phase==='paused:waterlogged'?c.weatherPauseReason!=='waterlogged':c.weatherPauseReason!==null)fail();
 if(o.phase==='completed'){
  const productionId=`fact:production:${b.instanceId}:${o.batch}`,harvest=s.factsById[`fact:crop:harvest:${b.instanceId}:${o.batch}`],production=s.factsById[productionId];
  if(c.phase!=='harvested'||!Number.isSafeInteger(c.harvestedAtTick)||c.harvestedAtTick<c.maturedAtTick||c.fallowUntilTick!==c.harvestedAtTick+1||!harvest||harvest.kind!=='crop-harvest'||harvest.atTick!==c.harvestedAtTick||harvest.sowFactId!==sowId||harvest.productionFactId!==productionId||harvest.recipeVersion!==snap.recipeVersion||harvest.quantity!==production?.quantities?.herb||production?.recipeVersion!==snap.recipeVersion)fail();
 }else if(c.harvestedAtTick!==null||c.fallowUntilTick!==null||r?.usedCost?.herb!==c.seedUsed||r?.remainingCost?.herb!==0)fail();
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
  if(!o)fail();if(o.kind==='construction'||o.kind==='treatment'||o.kind==='transport'||o.kind?.startsWith('sr-'))continue;const b=s.buildingsById[o.targetId],newFarm=b?.type==='farm'&&o.recipeSnapshot?.recipeVersion===FARM_CROP_RECIPE.recipeVersion,recipe=b&&ordinaryRecipe(b,o.recipeSnapshot?.recipeVersion||'economy:yunxiu:v1'),cost=newFarm?FARM_CROP_RECIPE.seedCost:b?.type==='farm'?FARM_V1_RECIPE.inputCost:o.recipeSnapshot?.inputCost||recipe?.inputCost||{},r=s.reservationsById[o.reservationId];
  if(o.kind!=='production'||o.id!==id||id!==`work:production:${o.targetId}`||!b||!BUILDINGS[b.type].work||b.progress!==0||!['active','waiting','completed'].includes(o.phase)||!Number.isSafeInteger(o.batch)||o.batch<1||o.durationTicks!==(newFarm?FARM_CROP_RECIPE.careRequired:recipe?.durationValue)||!Number.isSafeInteger(o.progressTicks)||o.progressTicks<0||o.progressTicks>o.durationTicks||!o.contributions||Array.isArray(o.contributions)||!Object.entries(o.contributions).every(([pid,t])=>s.personsById[pid]&&Number.isSafeInteger(t)&&t>0)||!Number.isSafeInteger(o.inheritedTicks)||o.inheritedTicks<0||o.inheritedTicks>=o.durationTicks||Object.values(o.contributions).reduce((n,v)=>n+v,0)+o.inheritedTicks!==o.progressTicks)fail();
  if(b.type==='farm'&&o.recipeSnapshot&&!newFarm)fail();
  if(b.type!=='farm'&&o.recipeSnapshot){
   const snap=o.recipeSnapshot,expected=recipe&&productionRecipeSnapshot(s,b,snap.recipeVersion);
   if(!expected||snap.recipeId!==expected.recipeId||JSON.stringify(snap.inputCost)!==JSON.stringify(expected.inputCost)||snap.durationUnit!=='contribution'||snap.durationValue!==recipe.durationValue||JSON.stringify(snap.outputDefinition)!==JSON.stringify(expected.outputDefinition)||snap.outputRuleVersion!==expected.outputRuleVersion||snap.skillRuleVersion!==expected.skillRuleVersion||snap.skillKey!==expected.skillKey||snap.skillGate!==0||snap.workstationRule!==expected.workstationRule||JSON.stringify(snap.sourceStockpileIds)!==JSON.stringify(expected.sourceStockpileIds)||snap.ownerId!==expected.ownerId||!Number.isSafeInteger(snap.createdTick)||snap.createdTick<0||snap.createdTick>s.worldTick)fail();
   if(snap.recipeVersion===PRODUCTION_RECIPE_VERSION&&(!o.participantSkills||Object.keys(o.participantSkills).length!==Object.keys(o.contributions).length||!Object.entries(o.participantSkills).every(([pid,v])=>o.contributions[pid]>0&&Number.isFinite(v)&&v>=0&&v<=100)))fail();
  }
  if(newFarm)validateFarmCrop(s,o,b,r,fail);
  if(o.phase==='completed'){if(o.progressTicks!==o.durationTicks||r||o.resultTransactionId!==`result:${id}:${o.batch}`)fail();}
  else if(o.progressTicks===o.durationTicks&&!newFarm||o.resultTransactionId!==null||!r||r.id!==o.reservationId||r.kind!=='materials'||r.workOrderId!==id||!r.cost||Object.keys(r.cost).length!==Object.keys(cost).length||!Object.entries(cost).every(([k,v])=>r.cost[k]===v))fail();
 }
 for(const [id,r]of Object.entries(s.reservationsById))if(r.kind==='materials'&&(!s.workOrdersById[r.workOrderId]||s.workOrdersById[r.workOrderId].reservationId!==id))fail();
 for(const [id,r]of Object.entries(s.reservationsById))if(!(['slot','materials','care-medicine','transport-cargo','trade-order','construction-material','ecology-material'].includes(r.kind)||r.kind?.startsWith('sr-'))&&!(r.kind===undefined&&s.activitiesById[r.activityId]?.kind==='construction'&&s.activitiesById[r.activityId].reservationId===id))fail();
 for(const p of Object.values(s.personsById))if(p.activityId&&!s.activitiesById[p.activityId])fail();
 return true;
}
