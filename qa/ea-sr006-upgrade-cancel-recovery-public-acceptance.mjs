/** SR-XF-006-AC-02/03: paid upgrade cancellation and recovery through public commands. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from '../dist/ea-opening-sim.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';
import {spatialPrefab} from '../dist/ea-sr-spatial.mjs';

const SITE={x:16,y:12,orientation:'south'};
const COST={jade:45,wood:30,stone:20};

function saveExactly(h){
 const before=JSON.stringify(h.s),tick=h.s.worldTick;
 h.save();
 assert.equal(JSON.stringify(h.s),before);
 assert.equal(h.s.worldTick,tick);
}

function locations(h,order){
 const flow=order.materialFlow;
 assert(flow);
 const source=h.s.stockpilesById[flow.sourceStockpileId];
 const site=h.s.stockpilesById[flow.siteStockpileId];
 assert(source&&site);
 for(const key of ['wood','stone']){
  assert.equal(source.resources[key]+site.resources[key]+(flow.cargo[key]||0)+(order.usedCost[key]||0),COST[key],`${key} remains accounted for`);
 }
}

test('SR-XF-006: an earned upgrade returns unused material, reloads, and completes on the same building',t=>{
 const h=normalOpening(),type='lumber',baseCost=S.BUILDINGS[type].cost;
 assert.equal(S.placementLock(h.s,type,SITE.x,SITE.y,null,2),'');
 h.resources({...baseCost,food:40});
 const built=h.act('build',type,SITE.x,SITE.y),buildingId=`building:yunxiu:${built.id}`;
 saveExactly(h);
 h.until(s=>!s.workOrdersById[built.workOrderId],'real first construction',2000);
 saveExactly(h);
 const building=h.s.buildingsById[buildingId],origin={...building.transform},level=building.level,revision=h.s.spatial.geometryRevision;
 assert(building&&level===1);
 const oldWidth=spatialPrefab(building).width;

 h.resources({...COST,food:40});
 const funded={...h.s.resources},first=h.act('upgrade',built.id),orderId=first.workOrderId;
 assert.equal(orderId,built.workOrderId);
 assert.equal(h.s.resources.jade,funded.jade-COST.jade);
 assert.equal(h.s.resources.wood,funded.wood-COST.wood);
 assert.equal(h.s.resources.stone,funded.stone-COST.stone);
 assert.equal(h.s.buildingsById[buildingId].spatialLock,orderId);
 saveExactly(h);
 h.until(s=>s.workOrdersById[orderId]?.progressTicks>=30,'actual paid upgrade progress',2200);
 const order=h.s.workOrdersById[orderId],used={...order.usedCost},progress=order.progressTicks;
 assert(progress>0&&progress<order.durationTicks);
 assert(Object.values(used).some(n=>n>0),'some reserved cost has actually been installed');
 locations(h,order);
 assert.equal(h.s.buildingsById[buildingId].level,level);
 assert.deepEqual(h.s.buildingsById[buildingId].transform,origin);
 assert.equal(h.s.spatial.geometryRevision,revision);
 saveExactly(h);

 const beforeRequest={...h.s.resources},requested=h.act('cancelConstruction');
 const expected=Object.fromEntries(Object.entries(COST).map(([key,n])=>[key,n-(used[key]||0)]));
 const flow=h.s.workOrdersById[orderId].materialFlow;
 const returnStockpileId=flow.sourceStockpileId,siteStockpileId=flow.siteStockpileId;
 const returnPosition={...h.s.stockpilesById[returnStockpileId].position};
 assert.equal(requested.pending,true,'site material needs a physical return trip');
 assert.deepEqual(requested.refund,expected);
 assert.deepEqual(h.s.resources,beforeRequest,'request does not credit material before return');
 assert.equal(h.s.workOrdersById[orderId].progressTicks,progress);
 assert.equal(h.s.workOrdersById[orderId].materialFlow.cancelRequested,true);
 locations(h,h.s.workOrdersById[orderId]);
 saveExactly(h);
 const repeated=h.act('cancelConstruction');
 assert.equal(repeated.pending,true);
 assert.deepEqual(h.s.resources,beforeRequest);
 saveExactly(h);
 let beforeSettlement=null,afterSettlement=null;
 for(let tick=0;tick<2000&&h.s.workOrdersById[orderId];tick++){
  const before={...h.s.resources};
  S.tick(h.s,.1);
  if(!h.s.workOrdersById[orderId]){beforeSettlement=before;afterSettlement={...h.s.resources};}
 }
 assert(beforeSettlement&&afterSettlement,'unused material returns within the world-step budget');
 for(const [key,amount] of Object.entries(expected))assert.equal(afterSettlement[key]-beforeSettlement[key],amount,`${key} reaches the treasury on the cancellation settlement tick`);
 saveExactly(h);
 const cancelled=h.s.spatial.completedOrders.findLast(o=>o.id===orderId);
 assert.equal(cancelled.phase,'cancelled');
 assert.equal(cancelled.operation,'upgrade');
 assert.equal(cancelled.progressTicks,progress);
 assert.deepEqual(cancelled.usedCost,used);
 assert.deepEqual(cancelled.refund,expected);
 const returnTrips=cancelled.materialTrips.filter(trip=>trip.kind==='return');
 assert(returnTrips.length>0,'unused material travels back in recorded trips');
 for(const trip of returnTrips){
  assert.equal(trip.sourceStockpileId,siteStockpileId);
  assert.equal(trip.targetStockpileId,returnStockpileId);
  assert.equal(trip.carrierId,'person:master');
  assert.equal(trip.phase,'returned');
  assert(Number.isSafeInteger(trip.finishedTick)&&trip.finishedTick>=trip.startedTick&&trip.finishedTick<=cancelled.tick);
 }
 for(const key of ['wood','stone'])assert.equal(returnTrips.reduce((sum,trip)=>sum+(trip.cargo[key]||0),0),expected[key],`${key} unused material physically returns`);
 assert.equal(returnPosition.sceneId,h.s.master.position.sceneId);
 assert(Math.hypot(h.s.master.scenic.x-returnPosition.x,h.s.master.scenic.y-returnPosition.y)<=.1,'carrier finishes at the reserved main-hall stockpile');
 assert.equal(h.s.stockpilesById[returnStockpileId],undefined);
 assert.equal(h.s.stockpilesById[siteStockpileId],undefined);
 assert.equal(h.s.buildingsById[buildingId].spatialLock,undefined);
 assert.equal(h.s.buildingsById[buildingId].level,level);
 assert.deepEqual(h.s.buildingsById[buildingId].transform,origin);
 assert.equal(h.s.spatial.geometryRevision,revision);
 assert.equal(h.s.buildings.filter(b=>b.instanceId===buildingId).length,1);
 const afterCancel=JSON.stringify(h.s.resources);
 assert.equal(h.act('cancelConstruction').alreadyCancelled,true);
 assert.equal(JSON.stringify(h.s.resources),afterCancel);

 h.resources({...COST,food:40});
 const second=h.act('upgrade',built.id);
 assert.equal(second.workOrderId,orderId,'retry keeps the building and work-order identity');
 saveExactly(h);
 h.until(s=>!s.workOrdersById[orderId],'recovered upgrade completion',2400);
 saveExactly(h);
 const upgraded=h.s.buildingsById[buildingId],records=h.s.spatial.completedOrders.filter(o=>o.id===orderId&&o.operation==='upgrade');
 assert.equal(upgraded.level,2);
 assert.deepEqual(upgraded.transform,origin);
 assert(spatialPrefab(upgraded).width>oldWidth);
 assert.equal(h.s.spatial.geometryRevision,revision+1);
 assert.equal(h.s.buildings.filter(b=>b.instanceId===buildingId).length,1);
 assert.deepEqual(records.map(o=>o.phase),['cancelled','completed']);
 assert.equal(records[1].operation,'upgrade');
 assert.deepEqual(records[1].usedCost,COST);
 t.diagnostic(JSON.stringify({source:'normal opening/public commands',buildingId,progress,used,cancelledRefund:expected,...h.counts}));
});
