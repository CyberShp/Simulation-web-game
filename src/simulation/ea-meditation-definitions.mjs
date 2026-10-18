/** U-167/T-24. Pure definitions and lifecycle checks; no simulation imports. */
export const MEDITATION_SUPPLY_VERSION='meditation-supply:yunxiu:v1';
export const SPIRIT_SOURCES_VERSION='spirit-sources:yunxiu:v1';
export const MEDITATION_SOURCE_ID='spirit-source:yunxiu:north-terrace';
export const MEDITATION_SITE_ID='site:domain:gc-03';
export const MEDITATION_RULES=Object.freeze({capacityMilli:1200000,recoveryMilliPerTick:200,flowMilliPerSecond:4000,minIntegrityBp:2500,degradationBpPerUnit:10,restDelayTicks:600,surveyTicks:80,measurementFreshTicks:1200,demandMilli:1000,efficiencyBp:Object.freeze([6500,8000,9000]),bonus:Object.freeze([.6,.9,1.2]),maintenanceMilli:Object.freeze([2400000,3600000,4800000]),maintenanceTicks:Object.freeze([80,100,120])});
export const meditationSupplyEnabled=b=>b?.type==='meditation'&&b.meditationSupplyVersion===MEDITATION_SUPPLY_VERSION;
export const meditationMaintenanceOrders=(s,b)=>Object.values(s.workOrdersById||{}).filter(o=>o.kind==='sr-meditation-maintenance'&&(!b||o.targetId===b.instanceId)&&!['completed','cancelled'].includes(o.phase));
export const meditationMaintenanceCost=level=>({wood:2*level,stone:level});
const result=reason=>({available:!reason,reason});
export function meditationBuildView(s){const q=s.spiritSources;return result(s.spatial?.northMeditation?.version!=='north-meditation-1'?'先接通聚灵台山路。':!q||q.discoveredAtTick===null?'先到脉眼实际勘察，再安排聚灵台营造。':'');}
export function meditationBuildingChangeView(s,b,{operation}={}){
 if(!meditationSupplyEnabled(b))return result('');
 const q=s.spiritSources,account=q?.buildingsById?.[b.instanceId];
 if(!account)return result('聚灵台引流记录缺失。');
 if(meditationMaintenanceOrders(s,b).length||Object.values(s.activitiesById||{}).some(a=>a.targetId===b.instanceId&&a.kind==='facility')||Object.values(s.workOrdersById||{}).some(o=>o.kind==='sr-spirit-survey'&&!['completed','cancelled'].includes(o.phase)))return result('先结束台上修行、勘察与检修，再调整聚灵台。');
 if(operation!=='upgrade')return result('');
 if(q.lastMeasuredAtTick===null||s.worldTick-q.lastMeasuredAtTick>MEDITATION_RULES.measurementFreshTicks)return result('先到脉眼复测当前灵脉条件。');
 if(q.reserveMilli<MEDITATION_RULES.capacityMilli/2)return result('天然积蓄尚不足一半，待脉眼恢复后升阶。');
 if(q.integrityBp<(b.level===1?7000:8500))return result('当前脉势不足以支撑下一级引流。');
 if(account.remainingMilli<MEDITATION_RULES.maintenanceMilli[b.level-1]/2)return result('先完成现场检修，再扩建引流设施。');
 return result('');
}
export function commissionMeditationBuilding(s,b){
 if(b.type!=='meditation'||b.domainSiteId!==MEDITATION_SITE_ID||b.level!==1)throw Error('聚灵台建成来源不符。');
 const gate=meditationBuildView(s);if(!gate.available)throw Error(gate.reason);
 const q=s.spiritSources,id=`fact:meditation-commission:${b.instanceId}`;
 if(q.buildingsById[b.instanceId]||s.factsById[id])throw Error('聚灵台建成已登记。');
 b.meditationSupplyVersion=MEDITATION_SUPPLY_VERSION;b.spiritSourceId=MEDITATION_SOURCE_ID;
 q.buildingsById[b.instanceId]={buildingId:b.instanceId,commissionFactId:id,level:1,remainingMilli:MEDITATION_RULES.maintenanceMilli[0],initialMilli:MEDITATION_RULES.maintenanceMilli[0],usedMilli:0,restoredMilli:0,upgradeDeltaMilli:0,removedAtTick:null,events:[]};
 s.factsById[id]={id,kind:'meditation-commissioned',version:MEDITATION_SUPPLY_VERSION,sourceId:MEDITATION_SOURCE_ID,buildingId:b.instanceId,siteId:MEDITATION_SITE_ID,atTick:s.worldTick};return b;
}
export function finishMeditationBuildingChange(s,b,operation,previousLevel){
 if(!meditationSupplyEnabled(b))return;
 const a=s.spiritSources?.buildingsById[b.instanceId];if(!a)throw Error('聚灵台引流记录缺失。');
 if(operation==='upgrade'){
  if(a.level!==previousLevel||b.level!==previousLevel+1)throw Error('聚灵台升级来源不符。');
  const next=Math.floor(a.remainingMilli*MEDITATION_RULES.maintenanceMilli[b.level-1]/MEDITATION_RULES.maintenanceMilli[previousLevel-1]),delta=next-a.remainingMilli;
  a.events.push({kind:'upgrade',atTick:s.worldTick,fromLevel:previousLevel,toLevel:b.level,beforeMilli:a.remainingMilli,afterMilli:next,deltaMilli:delta});a.upgradeDeltaMilli+=delta;a.remainingMilli=next;a.level=b.level;
 }else if(operation==='demolish'){a.removedAtTick=s.worldTick;a.events.push({kind:'demolish',atTick:s.worldTick});const id=`fact:meditation-demolished:${b.instanceId}`;s.factsById[id]={id,kind:'meditation-demolished',buildingId:b.instanceId,sourceId:MEDITATION_SOURCE_ID,atTick:s.worldTick};}
}
