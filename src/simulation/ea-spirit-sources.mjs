/** U-167/T-24: finite natural qi, physical survey and maintenance on the existing clock. */
import {MEDITATION_SUPPLY_VERSION,SPIRIT_SOURCES_VERSION,MEDITATION_SOURCE_ID,MEDITATION_SITE_ID,MEDITATION_RULES as R,meditationSupplyEnabled,meditationMaintenanceOrders,meditationMaintenanceCost,meditationBuildView,meditationBuildingChangeView} from './ea-meditation-definitions.mjs';
import {NORTH_MEDITATION_FEET} from './ea-north-meditation-geometry.mjs';
import {facilitySlots,slotById,slotReservation} from './ea-facility-slots.mjs';
import {prepareFacilityActivity,releaseBodyActivity} from './ea-facility-activities.mjs';
import {scenicDistance,scenicFindPath,geometryRevision,buildingAccess} from './ea-scene-geometry.mjs';
import {advanceScenic,syncScenicPosition} from './ea-scenic.mjs';
import {routeReachable} from './ea-route-reachability.mjs';
import {productionInputAvailable,reserveProductionInput,refundProductionInput} from './ea-sr-economy.mjs';
import {xpNeed} from './ea-data.mjs';
const clone=x=>structuredClone(x),mind=p=>p.mind||p,action=p=>p.mind?.activity||p.action,active=o=>o&&!['completed','cancelled'].includes(o.phase);
const sourcePoint=()=>NORTH_MEDITATION_FEET.find(x=>x.suffix==='work:1').position;
const building=(s,id)=>s.buildingsById?.[id]||s.buildings.find(b=>b.id===id);
const atHome=(s,p)=>p&&p.lifeStatus!=='dead'&&p.position?.kind==='scene'&&p.position.sceneId==='scene:yunxiu-courtyard'&&!mind(p).away&&!mind(p).journey&&(p===s.master||s.homeMemberIds.includes(p.personId));
const usable=b=>meditationSupplyEnabled(b)&&b.enabled!==false&&!b.disabled&&b.condition>0&&!b.spatialLock;
const bodyFree=(s,p)=>!p.activityId||s.activitiesById[p.activityId]?.kind==='facility'&&!s.activitiesById[p.activityId].serviceOrderId&&!s.activitiesById[p.activityId].serviceMealOrderId&&!s.activitiesById[p.activityId].meditationOrderId;
const setAction=(p,v)=>{if(p.mind)p.mind.activity=v;else p.action=v;};
const record=(s,kind,cost)=>{if(s.economy)for(const[k,v]of Object.entries(cost))s.economy[kind][k]=(s.economy[kind][k]||0)+v;};
const orders=s=>Object.values(s.workOrdersById||{}).filter(o=>['sr-spirit-survey','sr-meditation-maintenance'].includes(o.kind));
function bodyReason(s,p){return !atHome(s,p)?'本人尚未在院中。':p.wound>20||p.energy<22?'先恢复伤势与精力。':!bodyFree(s,p)?'本人已有身体事务，先完成或中止。':'';}
function ensureSource(s){
 if(s.spiritSources)return s.spiritSources;
 const id='fact:spirit-source:registered';s.factsById[id]={id,kind:'spirit-source-registered',version:SPIRIT_SOURCES_VERSION,sourceId:MEDITATION_SOURCE_ID,atTick:s.worldTick,initialMilli:R.capacityMilli};
 return s.spiritSources={version:SPIRIT_SOURCES_VERSION,sourceId:MEDITATION_SOURCE_ID,registeredAtTick:s.worldTick,registrationFactId:id,discoveredAtTick:null,lastMeasuredAtTick:null,measurementFactIds:[],reserveMilli:R.capacityMilli,integrityBp:10000,recoveredMilli:0,extractedMilli:0,lastExtractAtTick:null,processedThroughTick:s.worldTick,pulseRecoveryBaseline:0,lastPulse:null,buildingsById:{}};
}
export function meditationSourceView(s,buildingId){
 const q=s.spiritSources,b=building(s,buildingId),surveyBuilding=s.buildings.find(x=>meditationSupplyEnabled(x)),account=q?.buildingsById?.[b?.instanceId],p=s.master;
 let surveyReason=s.spatial?.northMeditation?.version!=='north-meditation-1'?'先接通聚灵台山路。':bodyReason(s,p);
 if(!surveyReason&&orders(s).some(o=>active(o)))surveyReason='先完成或中止当前脉眼勘察与检修。';
 if(!surveyReason&&slotReservation(s,surveyBuilding&&`${surveyBuilding.instanceId}/slot:work:1`))surveyReason='勘察站位正有人使用。';
 if(!surveyReason&&!routeReachable(s,mind(p).scenic,sourcePoint(),'meditation-survey'))surveyReason='勘察地点通路暂不可达。';
 let maintenanceReason=!usable(b)?'聚灵台尚未可用。':meditationMaintenanceOrders(s,b).length?'此台已有现场检修工单。':bodyReason(s,p);
 if(!maintenanceReason&&orders(s).some(o=>o.kind==='sr-spirit-survey'&&active(o)))maintenanceReason='先完成当前脉眼勘察。';
 if(!maintenanceReason&&!productionInputAvailable(s,b,meditationMaintenanceCost(b.level)))maintenanceReason='现场木石不足，请先实际搬入。';
 if(!maintenanceReason&&!facilitySlots(s,b,'work').some(slot=>!slotReservation(s,slot.id)&&routeReachable(s,mind(p).scenic,slot.position,`meditation-maintenance:${slot.id}`)))maintenanceReason='维护工位已占用或通路受阻。';
 return {enabled:!!q,sourceId:MEDITATION_SOURCE_ID,name:'云岫北台浅脉眼',discovered:!!q&&q.discoveredAtTick!==null,reserveMilli:q?.reserveMilli??null,capacityMilli:R.capacityMilli,integrityBp:q?.integrityBp??null,recoveryMilliPerTick:q?Math.floor(R.recoveryMilliPerTick*q.integrityBp/10000):null,flowMilliPerSecond:q?Math.floor(R.flowMilliPerSecond*q.integrityBp/10000):null,lastMeasuredAtTick:q?.lastMeasuredAtTick??null,buildingId:b?.instanceId||null,maintenance:account?{remainingMilli:account.remainingMilli,capacityMilli:R.maintenanceMilli[b.level-1],cost:meditationMaintenanceCost(b.level),durationTicks:R.maintenanceTicks[b.level-1]}:null,survey:{available:!surveyReason,reason:surveyReason},maintain:{available:!maintenanceReason,reason:maintenanceReason},build:meditationBuildView(s),upgrade:b?meditationBuildingChangeView(s,b,{operation:'upgrade'}):null,orders:orders(s).map(o=>clone(o)),lastPulse:q?.lastPulse?clone(q.lastPulse):null};
}
export function surveyMeditationSource(s){
 const view=meditationSourceView(s);if(!view.survey.available)throw Error(view.survey.reason);
 const p=s.master,target={...sourcePoint()},path=scenicFindPath(s,mind(p).scenic,target,{maxSnap:0});if(path===null)throw Error('勘察地点通路暂不可达。');
 const q=ensureSource(s),id=`work:spirit-survey:${s.transactions.nextCommandId}`,aid=`activity:spirit-survey:${p.personId}`;
 if(s.workOrdersById[id])throw Error('勘察工单编号已使用。');
 releaseBodyActivity(s,p);p.action='walk';p.job=null;p.learning=null;p.scenic.path=path;p.scenic.goal=target;p.scenic.revision=geometryRevision(s);
 const o={id,kind:'sr-spirit-survey',version:SPIRIT_SOURCES_VERSION,sourceId:MEDITATION_SOURCE_ID,personId:p.personId,target,createdTick:s.worldTick,lastTick:s.worldTick,phase:'moving',progressTicks:0,durationTicks:R.surveyTicks,resultFactId:null};
 s.workOrdersById[id]=o;s.activitiesById[aid]={id:aid,kind:'sr-spirit-survey',personId:p.personId,workOrderId:id,phase:'moving',reason:'前往台地下脉眼的实际勘察位置。'};p.activityId=aid;return {accepted:true,workOrderId:id,sourceId:q.sourceId};
}
function detach(s,p,o){const a=s.activitiesById[p?.activityId];if(!a||a.meditationOrderId!==o.id&&a.workOrderId!==o.id)return;if(a.kind==='facility')releaseBodyActivity(s,p);else{delete s.activitiesById[a.id];p.activityId=null;mind(p).scenic.path=[];mind(p).scenic.goal=null;}setAction(p,'rest');p.job=null;if(p.mind){p.mind.commitUntil=s.time;if(p.schedule)p.schedule.commitUntilTick=s.worldTick;}}
function attachMaintenance(s,p,b,o){
 const slot=facilitySlots(s,b,'work').find(slot=>!slotReservation(s,slot.id)&&routeReachable(s,mind(p).scenic,slot.position,`meditation-maintenance:${slot.id}`));if(!slot)throw Error('没有可用维护工位。');
 releaseBodyActivity(s,p);setAction(p,'work');p.job=b.id;if(p===s.master){p.learning=null;p.path=[];}
 prepareFacilityActivity(s,p,b,'work',0,{slotId:slot.id});const a=s.activitiesById[p.activityId];if(!a)throw Error('无法预约维护身体工位。');a.meditationOrderId=o.id;
}
export function startMeditationMaintenance(s,buildingId){
 const b=building(s,buildingId),v=meditationSourceView(s,buildingId);if(!v.maintain.available)throw Error(v.maintain.reason);
 const id=`work:meditation-maintenance:${s.transactions.nextCommandId}`,reservationId=`reservation:meditation:${id}`,cost=meditationMaintenanceCost(b.level);if(s.workOrdersById[id])throw Error('检修工单编号已使用。');
 const o={id,kind:'sr-meditation-maintenance',version:MEDITATION_SUPPLY_VERSION,targetId:b.instanceId,sourceId:MEDITATION_SOURCE_ID,level:b.level,sourceStockpileId:`stockpile:${b.instanceId}`,createdTick:s.worldTick,lastTick:s.worldTick,phase:'moving',progressTicks:0,durationTicks:R.maintenanceTicks[b.level-1],reservationId,inputCost:cost,usedInput:{},returnedInput:{},contributions:{},resultFactId:null,reason:'前往实际维护工位。'};
 reserveProductionInput(s,b,cost);s.workOrdersById[id]=o;s.reservationsById[reservationId]={id:reservationId,kind:'sr-site-service-input',workOrderId:id,sourceStockpileId:o.sourceStockpileId,cost:clone(cost),remainingCost:clone(cost),usedCost:{},createdTick:s.worldTick};attachMaintenance(s,s.master,b,o);return {accepted:true,workOrderId:id};
}
export function cancelMeditationSourceOrder(s,id){
 const o=s.workOrdersById[id];if(!orders(s).includes(o)||!active(o))throw Error('此勘察或检修已经结束。');
 if(o.kind==='sr-meditation-maintenance'){const r=s.reservationsById[o.reservationId];refundProductionInput(s,building(s,o.targetId),r.remainingCost);o.returnedInput=clone(r.remainingCost);delete s.reservationsById[o.reservationId];}
 o.phase='cancelled';o.finishedTick=s.worldTick;for(const p of Object.values(s.personsById))detach(s,p,o);
 const fid=`fact:spirit-order:${id}:cancelled`;s.factsById[fid]={id:fid,kind:'spirit-order-cancelled',workOrderId:id,atTick:s.worldTick,progressTicks:o.progressTicks,usedInput:clone(o.usedInput||{}),returnedInput:clone(o.returnedInput||{})};o.resultFactId=fid;return {cancelled:true,returned:clone(o.returnedInput||{})};
}
export function meditationCultivationView(s,personId,buildingId,slotId){
 const p=s.personsById[personId],b=building(s,buildingId),slot=facilitySlots(s,b,'cultivate').find(x=>x.id===slotId),held=slot&&slotReservation(s,slot.id);let reason=!usable(b)?'聚灵台尚未可用。':!p?'人物不存在。':!mind(p).main?'先确定主修法门。':p.xp>=xpNeed(p.realm)?'当前境界修为已满。':bodyReason(s,p);
 if(!reason&&(!slot||held&&held.personId!==personId))reason='该蒲团已占用或不存在。';
 if(!reason&&!routeReachable(s,mind(p).scenic,slot.position,`meditation-seat:${slot.id}`))reason='蒲团通路暂不可达。';
 const q=s.spiritSources,a=q?.buildingsById?.[b?.instanceId],powered=!!a&&a.remainingMilli>0&&q.reserveMilli>0&&!meditationMaintenanceOrders(s,b).length;
 return {available:!reason,reason,personId,buildingId:b?.instanceId||buildingId,slotId,powered,powerReason:powered?'到席后与同台修士共享实际脉息。':meditationMaintenanceOrders(s,b).length?'检修期间可作基础吐纳。':'引流供能不足，可作基础吐纳。',maximumMultiplier:usable(b)?1+R.bonus[b.level-1]:1};
}
export function startMeditationCultivation(s,{buildingId,slotId}={}){
 const p=s.master,b=building(s,buildingId),v=meditationCultivationView(s,p.personId,buildingId,slotId);if(!v.available)throw Error(v.reason);
 releaseBodyActivity(s,p);p.action='cultivate';p.job=null;p.learning=null;p.path=[];prepareFacilityActivity(s,p,b,'cultivate',0,{slotId});return {accepted:true,buildingId:b.instanceId,slotId};
}
export function spiritSourcePersonBusy(s,p){const a=s.activitiesById[p?.activityId];return a?.kind==='sr-spirit-survey'||a?.kind==='facility'&&a.action==='work'&&meditationSupplyEnabled(s.buildingsById[a.targetId]);}
function tickSurvey(s,o){
 const p=s.personsById[o.personId],a=s.activitiesById[p?.activityId];if(a?.workOrderId!==o.id){o.phase='waiting';return;}
 if(!atHome(s,p)||p.wound>20||p.energy<5){o.phase='waiting';a.phase='waiting';a.reason='身体条件未恢复，保留勘察进度。';return;}
 const sc=mind(p).scenic;
 if(scenicDistance(sc,o.target)>=.04){if(sc.revision!==geometryRevision(s)||!sc.path.length){const path=scenicFindPath(s,sc,o.target,{maxSnap:0});if(path===null){o.phase='waiting';a.phase='waiting';a.reason='勘察道路受阻。';return;}sc.path=path;sc.goal={...o.target};sc.revision=geometryRevision(s);}advanceScenic(sc,4.6,s);syncScenicPosition(s,p);o.phase='moving';a.phase='moving';return;}
 o.phase='working';a.phase='working';a.reason='已到脉眼站位，测量实际积蓄与脉势。';o.progressTicks++;p.energy=Math.max(0,p.energy-.01);
 if(o.progressTicks<R.surveyTicks)return;
 const q=s.spiritSources,id=`fact:spirit-survey:${o.id}`;s.factsById[id]={id,kind:'spirit-source-surveyed',sourceId:MEDITATION_SOURCE_ID,workOrderId:o.id,personId:p.personId,position:{...o.target},atTick:s.worldTick,reserveMilli:q.reserveMilli,integrityBp:q.integrityBp};q.discoveredAtTick??=s.worldTick;q.lastMeasuredAtTick=s.worldTick;q.measurementFactIds.push(id);o.phase='completed';o.finishedTick=s.worldTick;o.resultFactId=id;detach(s,p,o);
}
function tickMaintenance(s,o){
 const b=building(s,o.targetId);if(!usable(b)){o.phase='waiting';o.reason='设施暂不可用，保留现场投入。';return;}
 let contribution=0;
 for(const p of Object.values(s.personsById).sort((a,b)=>a.personId.localeCompare(b.personId))){
  const a=s.activitiesById[p.activityId];if(!atHome(s,p)||p.job!==b.id||action(p)!=='work'||a?.kind!=='facility'||a.targetId!==b.instanceId||p.wound>20||p.energy<22||(mind(p).satiety??100)<22)continue;
  a.meditationOrderId=o.id;
  if(!prepareFacilityActivity(s,p,b,'work',4.6,{slotId:a.slotId}))continue;
  if(o.progressTicks+contribution>=o.durationTicks)break;
  contribution++;o.contributions[p.personId]=(o.contributions[p.personId]||0)+1;p.energy=Math.max(0,p.energy-.032);
 }
 if(!contribution){o.phase='waiting';o.reason='等待愿意承担检修的人实际到位。';return;}
 const r=s.reservationsById[o.reservationId];if(!o.progressTicks){r.usedCost=clone(r.cost);r.remainingCost={};o.usedInput=clone(r.cost);record(s,'expense',r.cost);}
 o.progressTicks+=contribution;o.phase='working';o.reason='在独立维护位检修引流设施。';
 if(o.progressTicks<o.durationTicks)return;
 const a=s.spiritSources.buildingsById[b.instanceId],maximum=R.maintenanceMilli[b.level-1],restored=maximum-a.remainingMilli,id=`fact:spirit-maintenance:${o.id}`;
 a.events.push({kind:'maintenance',atTick:s.worldTick,workOrderId:o.id,beforeMilli:a.remainingMilli,afterMilli:maximum,restoredMilli:restored});a.restoredMilli+=restored;a.remainingMilli=maximum;
 s.factsById[id]={id,kind:'meditation-maintained',workOrderId:o.id,buildingId:b.instanceId,atTick:s.worldTick,usedInput:clone(o.usedInput),restoredMilli:restored};o.phase='completed';o.finishedTick=s.worldTick;o.resultFactId=id;delete s.reservationsById[o.reservationId];for(const p of Object.values(s.personsById))detach(s,p,o);
}
export function advanceSpiritSources(s){
 const q=s.spiritSources;if(!q||s.speed===0||q.processedThroughTick>=s.worldTick)return;
 if(q.processedThroughTick!==s.worldTick-1)throw Error('天然脉眼时钟没有逐步接续。');q.processedThroughTick=s.worldTick;
 const restored=Math.min(R.capacityMilli-q.reserveMilli,Math.floor(R.recoveryMilliPerTick*q.integrityBp/10000));q.reserveMilli+=restored;q.recoveredMilli+=restored;
 if(s.worldTick-(q.lastExtractAtTick??q.registeredAtTick)>=R.restDelayTicks&&q.reserveMilli>=R.capacityMilli/2)q.integrityBp=Math.min(10000,q.integrityBp+1);
 for(const o of orders(s))if(active(o)&&o.lastTick<s.worldTick){o.lastTick=s.worldTick;if(o.kind==='sr-spirit-survey')tickSurvey(s,o);else tickMaintenance(s,o);}
}
const pending=new WeakMap();
export function beginMeditationPulse(s){if(s.spiritSources){if((s.worldTick-s.schemaMigration.clockOriginTick)%10)throw Error('聚灵分配须在实际世界秒边界。');pending.set(s,{tick:s.worldTick,requests:new Map()});}}
export function queueMeditationCultivation(s,p,b,baseRate){
 if(!meditationSupplyEnabled(b))return false;
 const batch=pending.get(s),a=s.activitiesById[p.activityId],slot=a?.slotId&&slotById(s,a.slotId);
 if(!batch||batch.tick!==s.worldTick)throw Error('聚灵修行须由同一世界秒结算。');
 if(!mind(p).main||p.xp>=xpNeed(p.realm)||a?.kind!=='facility'||a.phase!=='executing'||a.action!=='cultivate'||a.targetId!==b.instanceId||!slot||scenicDistance(mind(p).scenic,slot.position)>=.04||slotReservation(s,slot.id)?.personId!==p.personId)return true;
 if(!batch.requests.has(p.personId))batch.requests.set(p.personId,{personId:p.personId,buildingId:b.instanceId,slotId:slot.id,baseRate});return true;
}
export function finishMeditationPulse(s){
 const q=s.spiritSources,batch=pending.get(s);pending.delete(s);if(!q||!batch||batch.tick!==s.worldTick||q.lastPulse?.atTick===s.worldTick)return;
 const requests=[...batch.requests.values()].filter(r=>{const p=s.personsById[r.personId],a=s.activitiesById[p?.activityId],b=s.buildingsById[r.buildingId],slot=slotById(s,r.slotId);return atHome(s,p)&&usable(b)&&a?.phase==='executing'&&a.slotId===r.slotId&&a.targetId===r.buildingId&&a.action==='cultivate'&&slotReservation(s,r.slotId)?.personId===p.personId&&scenicDistance(mind(p).scenic,slot.position)<.04&&p.xp<xpNeed(p.realm);}).sort((a,b)=>a.slotId.localeCompare(b.slotId));
 if(!requests.length){q.pulseRecoveryBaseline=q.recoveredMilli;return;}
 // The stable natural source serves the one GC03 platform. A later platform needs a distinct contract.
 const b=s.buildingsById[requests[0].buildingId],account=q.buildingsById[b.instanceId],eff=R.efficiencyBp[b.level-1],raw=meditationMaintenanceOrders(s,b).length?0:Math.min(q.reserveMilli,Math.floor(R.flowMilliPerSecond*q.integrityBp/10000),Math.ceil(requests.length*R.demandMilli*10000/eff),account.remainingMilli),delivered=Math.floor(raw*eff/10000),beforeReserve=q.reserveMilli,beforeIntegrity=q.integrityBp;
 q.reserveMilli-=raw;q.extractedMilli+=raw;account.remainingMilli-=raw;account.usedMilli+=raw;if(raw)q.lastExtractAtTick=s.worldTick;
 const natural=q.recoveredMilli-q.pulseRecoveryBaseline;if(q.reserveMilli<R.capacityMilli/4)q.integrityBp=Math.max(R.minIntegrityBp,q.integrityBp-Math.ceil(Math.max(0,raw-natural)*R.degradationBpPerUnit/1000));
 const offset=Math.floor((s.worldTick-s.schemaMigration.clockOriginTick)/10)%requests.length;
 const allocations=requests.map((r,i)=>{const amount=Math.floor(delivered/requests.length)+((i-offset+requests.length)%requests.length<delivered%requests.length?1:0),p=s.personsById[r.personId],beforeXp=p.xp,gain=r.baseRate*(1+R.bonus[b.level-1]*amount/R.demandMilli);p.xp=Math.min(xpNeed(p.realm),p.xp+gain);if(p.mind&&p.xp>=xpNeed(p.realm))p.mind.commitUntil=0;return {...r,deliveredMilli:amount,beforeXp,afterXp:p.xp};});
 q.lastPulse={atTick:s.worldTick,buildingId:b.instanceId,level:b.level,rawMilli:raw,deliveredMilli:delivered,lossMilli:raw-delivered,naturalMilli:natural,beforeReserveMilli:beforeReserve,afterReserveMilli:q.reserveMilli,beforeIntegrityBp:beforeIntegrity,afterIntegrityBp:q.integrityBp,allocations};q.pulseRecoveryBaseline=q.recoveredMilli;
}
export function validateSpiritSources(s){
 const q=s.spiritSources,fail=()=>{throw Error('存档校验失败：天然脉眼、聚灵供能或现场检修记录异常');},int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max,tick=n=>int(n,0,s.worldTick),equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const marked=Object.values(s.buildingsById||{}).filter(b=>b.meditationSupplyVersion!==undefined||b.spiritSourceId!==undefined),facts=Object.values(s.factsById||{}).filter(f=>f.kind==='meditation-commissioned'||f.kind==='spirit-source-registered');
 if(q===undefined){if(marked.length||facts.length||orders(s).length)fail();return true;}
 if(!q||q.version!==SPIRIT_SOURCES_VERSION||q.sourceId!==MEDITATION_SOURCE_ID||s.spatial?.northMeditation?.version!=='north-meditation-1'||!tick(q.registeredAtTick)||q.registeredAtTick<s.spatial.northMeditation.openedAtTick||!tick(q.processedThroughTick)||q.processedThroughTick!==s.worldTick||!int(q.reserveMilli,0,R.capacityMilli)||!int(q.integrityBp,R.minIntegrityBp,10000)||!int(q.recoveredMilli)||!int(q.extractedMilli)||q.reserveMilli!==R.capacityMilli+q.recoveredMilli-q.extractedMilli||!int(q.pulseRecoveryBaseline,0,q.recoveredMilli)||q.lastExtractAtTick!==null&&(!tick(q.lastExtractAtTick)||q.lastExtractAtTick<q.registeredAtTick)||!q.buildingsById||Array.isArray(q.buildingsById)||!Array.isArray(q.measurementFactIds)||new Set(q.measurementFactIds).size!==q.measurementFactIds.length)fail();
 const registered=s.factsById[q.registrationFactId];if(!equal(registered,{id:'fact:spirit-source:registered',kind:'spirit-source-registered',version:SPIRIT_SOURCES_VERSION,sourceId:MEDITATION_SOURCE_ID,atTick:q.registeredAtTick,initialMilli:R.capacityMilli}))fail();
 const measurements=q.measurementFactIds.map(id=>s.factsById[id]);for(const f of measurements)if(!f||f.kind!=='spirit-source-surveyed'||f.sourceId!==MEDITATION_SOURCE_ID||!tick(f.atTick)||!equal(f.position,sourcePoint())||s.workOrdersById[f.workOrderId]?.resultFactId!==f.id||!int(f.reserveMilli,0,R.capacityMilli)||!int(f.integrityBp,R.minIntegrityBp,10000))fail();
 if(q.discoveredAtTick!==(measurements[0]?.atTick??null)||q.lastMeasuredAtTick!==(measurements.at(-1)?.atTick??null))fail();
 let totalUsed=0;for(const [id,a]of Object.entries(q.buildingsById)){
  const b=s.buildingsById[id],f=s.factsById[a.commissionFactId];if(a.buildingId!==id||!f||f.kind!=='meditation-commissioned'||f.version!==MEDITATION_SUPPLY_VERSION||f.sourceId!==MEDITATION_SOURCE_ID||f.siteId!==MEDITATION_SITE_ID||f.buildingId!==id||!tick(f.atTick)||q.discoveredAtTick===null||f.atTick<q.discoveredAtTick||!int(a.level,1,3)||a.initialMilli!==R.maintenanceMilli[0]||!int(a.usedMilli)||!int(a.restoredMilli)||!int(a.upgradeDeltaMilli)||!int(a.remainingMilli,0,R.maintenanceMilli[a.level-1])||a.remainingMilli!==a.initialMilli+a.restoredMilli+a.upgradeDeltaMilli-a.usedMilli||!Array.isArray(a.events))fail();
  if(b){if(!meditationSupplyEnabled(b)||b.spiritSourceId!==MEDITATION_SOURCE_ID||b.domainSiteId!==MEDITATION_SITE_ID||a.level!==b.level||a.removedAtTick!==null)fail();const st=s.stockpilesById[`stockpile:${id}`],entry=buildingAccess(s,b);if(!st||st.buildingId!==id||st.capacity!==80||st.ownerId!=='person:master'||st.custodianId!=='person:master'||st.access!=='public'||st.position?.sceneId!=='scene:yunxiu-courtyard'||scenicDistance(st.position,entry)>1e-8)fail();}
  else if(!tick(a.removedAtTick)||!equal(s.factsById[`fact:meditation-demolished:${id}`],{id:`fact:meditation-demolished:${id}`,kind:'meditation-demolished',buildingId:id,sourceId:MEDITATION_SOURCE_ID,atTick:a.removedAtTick}))fail();
  let restored=0,upgraded=0,level=1;for(const e of a.events){if(!tick(e.atTick)||e.atTick<f.atTick)fail();if(e.kind==='maintenance'){const o=s.workOrdersById[e.workOrderId];if(o?.phase!=='completed'||s.factsById[o.resultFactId]?.restoredMilli!==e.restoredMilli||e.afterMilli-e.beforeMilli!==e.restoredMilli||!int(e.restoredMilli))fail();restored+=e.restoredMilli;}else if(e.kind==='upgrade'){if(e.fromLevel!==level||e.toLevel!==level+1||e.afterMilli!==Math.floor(e.beforeMilli*R.maintenanceMilli[e.toLevel-1]/R.maintenanceMilli[level-1])||e.deltaMilli!==e.afterMilli-e.beforeMilli)fail();upgraded+=e.deltaMilli;level++;}else if(e.kind==='demolish'){if(e.atTick!==a.removedAtTick)fail();}else fail();}if(restored!==a.restoredMilli||upgraded!==a.upgradeDeltaMilli||level!==a.level)fail();totalUsed+=a.usedMilli;
 }
 if(totalUsed!==q.extractedMilli||marked.some(b=>!q.buildingsById[b.instanceId])||facts.some(f=>f.kind==='meditation-commissioned'&&!q.buildingsById[f.buildingId]))fail();
 for(const o of orders(s)){
  const survey=o.kind==='sr-spirit-survey';if(o.id!==s.workOrdersById[o.id]?.id||o.sourceId!==MEDITATION_SOURCE_ID||o.version!==(survey?SPIRIT_SOURCES_VERSION:MEDITATION_SUPPLY_VERSION)||!tick(o.createdTick)||o.createdTick<q.registeredAtTick||!tick(o.lastTick)||o.lastTick<o.createdTick||!['moving','working','waiting','completed','cancelled'].includes(o.phase)||!int(o.progressTicks,0,o.durationTicks)||o.durationTicks!==(survey?R.surveyTicks:R.maintenanceTicks[o.level-1]))fail();
  if(survey){if(o.personId!=='person:master'||!equal(o.target,sourcePoint()))fail();if(active(o)){const a=s.activitiesById[s.master.activityId];if(a?.kind!=='sr-spirit-survey'||a.workOrderId!==o.id)fail();}}
  else {const b=s.buildingsById[o.targetId],a=q.buildingsById[o.targetId],r=s.reservationsById[o.reservationId],cost=meditationMaintenanceCost(o.level),sum=Object.values(o.contributions||{}).reduce((x,y)=>x+y,0);if(!a||active(o)&&(!meditationSupplyEnabled(b)||o.level!==b.level)||!equal(o.inputCost,cost)||o.sourceStockpileId!==`stockpile:${o.targetId}`||sum!==o.progressTicks||Object.entries(o.contributions||{}).some(([pid,n])=>!s.personsById[pid]||!int(n,1))||!equal(o.usedInput,o.progressTicks?cost:{}))fail();if(active(o)){if(!r||r.id!==o.reservationId||r.kind!=='sr-site-service-input'||r.workOrderId!==o.id||r.sourceStockpileId!==o.sourceStockpileId||!equal(r.cost,cost)||!equal(r.usedCost,o.usedInput)||!equal(r.remainingCost,o.progressTicks?{}:cost)||r.createdTick!==o.createdTick)fail();}else if(r||!equal(o.returnedInput,o.phase==='cancelled'&&!o.progressTicks?cost:{}))fail();}
  if(!active(o)){const f=s.factsById[o.resultFactId];if(!tick(o.finishedTick)||o.finishedTick<o.createdTick||!f||f.workOrderId!==o.id||f.atTick!==o.finishedTick||o.phase==='completed'&&(o.progressTicks!==o.durationTicks||f.kind!==(survey?'spirit-source-surveyed':'meditation-maintained'))||o.phase==='cancelled'&&(f.kind!=='spirit-order-cancelled'||f.progressTicks!==o.progressTicks||!equal(f.usedInput,o.usedInput||{})||!equal(f.returnedInput,o.returnedInput||{})))fail();}
 }
 for(const a of Object.values(s.activitiesById||{}))if(a.kind==='sr-spirit-survey'||a.meditationOrderId!==undefined){
  const p=s.personsById[a.personId],o=s.workOrdersById[a.kind==='sr-spirit-survey'?a.workOrderId:a.meditationOrderId];if(!p||p.activityId!==a.id||!active(o))fail();
  if(a.kind==='sr-spirit-survey'){if(o.kind!=='sr-spirit-survey'||a.personId!=='person:master'||a.id!==`activity:spirit-survey:${a.personId}`||!['moving','working','waiting'].includes(a.phase))fail();}
  else if(o.kind!=='sr-meditation-maintenance'||a.kind!=='facility'||a.action!=='work'||a.targetId!==o.targetId||!new RegExp('^'+o.targetId+'/slot:work:[12]$').test(a.slotId))fail();
 }
 const pulse=q.lastPulse;if(pulse!==null){if(!tick(pulse.atTick)||(pulse.atTick-s.schemaMigration.clockOriginTick)%10||!int(pulse.naturalMilli)||!int(pulse.beforeIntegrityBp,R.minIntegrityBp,10000)||!int(pulse.afterIntegrityBp,R.minIntegrityBp,10000)||pulse.rawMilli>Math.floor(R.flowMilliPerSecond*pulse.beforeIntegrityBp/10000)||pulse.afterIntegrityBp!==(pulse.afterReserveMilli<R.capacityMilli/4?Math.max(R.minIntegrityBp,pulse.beforeIntegrityBp-Math.ceil(Math.max(0,pulse.rawMilli-pulse.naturalMilli)*R.degradationBpPerUnit/1000)):pulse.beforeIntegrityBp)||!q.buildingsById[pulse.buildingId]||!int(pulse.level,1,3)||!int(pulse.rawMilli,0,R.flowMilliPerSecond)||!int(pulse.deliveredMilli)||pulse.deliveredMilli!==Math.floor(pulse.rawMilli*R.efficiencyBp[pulse.level-1]/10000)||pulse.lossMilli!==pulse.rawMilli-pulse.deliveredMilli||pulse.afterReserveMilli!==pulse.beforeReserveMilli-pulse.rawMilli||!int(pulse.beforeReserveMilli,0,R.capacityMilli)||!int(pulse.afterReserveMilli,0,R.capacityMilli)||!Array.isArray(pulse.allocations)||pulse.allocations.length<1||pulse.allocations.length>4||new Set(pulse.allocations.map(a=>a.personId)).size!==pulse.allocations.length||new Set(pulse.allocations.map(a=>a.slotId)).size!==pulse.allocations.length)fail();let delivered=0;const offset=Math.floor((pulse.atTick-s.schemaMigration.clockOriginTick)/10)%pulse.allocations.length;for(const [index,a] of pulse.allocations.entries()){if(!s.personsById[a.personId]||a.buildingId!==pulse.buildingId||!new RegExp('^'+pulse.buildingId+'/slot:mat:[1-4]$').test(a.slotId)||!int(a.deliveredMilli,0,R.demandMilli)||a.deliveredMilli!==Math.floor(pulse.deliveredMilli/pulse.allocations.length)+((index-offset+pulse.allocations.length)%pulse.allocations.length<pulse.deliveredMilli%pulse.allocations.length?1:0)||!Number.isFinite(a.baseRate)||a.baseRate<0||!Number.isFinite(a.beforeXp)||!Number.isFinite(a.afterXp)||a.afterXp<a.beforeXp||a.afterXp-a.beforeXp>a.baseRate*(1+R.bonus[pulse.level-1]*a.deliveredMilli/R.demandMilli)+1e-8)fail();delivered+=a.deliveredMilli;}if(delivered!==pulse.deliveredMilli)fail();}
 return true;
}
export const spiritSourceHandlers={surveyMeditationSource,cancelMeditationSourceOrder,startMeditationMaintenance,startMeditationCultivation};
