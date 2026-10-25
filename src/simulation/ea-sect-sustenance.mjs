import {scenicNearest,scenicFindPath} from './ea-scenic.mjs';
import {startTransport,stockpileReceiptPreview} from './ea-sr-economy.mjs';
import {subtractAmounts} from './ea-resource-amounts.mjs';

// U-63 author parameters: use the existing public-food scarcity target; keep
// one crop's two seed units at the field, and the existing 40-unit carrier cap.
export const SECT_SUSTENANCE_RULES=Object.freeze({source:'U-63/T-sect-sustenance-01',minimumTarget:35,foodPerMember:7,seedReserve:2,carryCapacity:40,transportBaseScore:16});
export function sectSustenanceCandidate(s,d){
 const m=d.mind,r=SECT_SUSTENANCE_RULES,home=s.stockpilesById?.['stockpile:yunxiu'];
 if(!s.srEconomy||!home||d.schedule?.definitionId!=='autonomy:yunxiu:v1'||d.lifeStatus==='dead'||!s.homeMemberIds?.includes(d.personId)||d.position?.kind!=='scene'||d.position.sceneId!=='scene:yunxiu-courtyard'||m.away||m.journey||m.scenic?.spatialEvacuationOrderId||d.wound>20||d.energy<22||m.satiety<22)return null;
 if((m.relationships?.master?.trust??55)<35||(m.traits?.[3]??0)<40)return null;
 if(s.time<m.commitUntil||s.worldTick<d.schedule.commitUntilTick)return null;
 if(Object.values(d.schedule.commitmentsById||{}).some(c=>c.status==='active'&&c.endTick>s.worldTick))return null;
 // Finish an already selected lesson before accepting a different body task.
 if(m.activity==='study'&&m.learning&&m.learning.progress<m.learning.total)return null;
 const body=s.activitiesById?.[d.activityId];if(body&&body.kind!=='facility')return null;
 const target=Math.max(r.minimumTarget,s.disciples.length*r.foodPerMember),deficit=target-(home.resources.food||0);if(deficit<=0)return null;
 for(const b of s.buildings){
  if(!['granary','warehouse'].includes(b.type)||b.enabled===false||b.condition<=0||b.spatialLock)continue;
  const stock=s.stockpilesById[`stockpile:${b.instanceId}`];if(!stock||stock.access!=='public'||stock.ownerId!==home.ownerId)continue;
  const available=subtractAmounts(stock.resources.food||0,b.type==='granary'?r.seedReserve:0);if(available<=0)continue;
  const quantity=Math.min(r.carryCapacity,available,deficit);if(quantity<=0)continue;
  if(!stockpileReceiptPreview(s,home,{food:quantity}).available)continue;
  const reach=s.spatial?.version==='spatial-metres-1'?1.5:48;
  const source=scenicNearest(s,stock.position,{maxDistance:reach}),destination=scenicNearest(s,home.position,{maxDistance:reach});
  if(!source||!destination||scenicFindPath(s,m.scenic,source,{maxSnap:0})===null||scenicFindPath(s,source,destination,{maxSnap:0})===null)continue;
  const scarcity=Math.min(1,deficit/target)*40,focus=s.doctrine.workFocus==='food'?20:0;
  return {activity:'transport',job:null,score:r.transportBaseScore+m.traits[3]*.3+m.traits[0]*.1+scarcity+focus,reason:'公库口粮不足，愿把已有收成实际运回，田边留好下轮种粮。',sourceStockpileId:stock.id,targetStockpileId:home.id,quantity};
 }
 return null;
}
export function beginSectSustenance(s,d,candidate){
 const result=startTransport(s,candidate.sourceStockpileId,candidate.targetStockpileId,d.personId,{food:candidate.quantity});
 if(result.accepted){d.mind.reason=candidate.reason;d.schedule.lastReason=candidate.reason;}
 return result;
}
