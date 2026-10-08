/** SR-XF-006: one building's complete construction-change lifecycle via public commands. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from '../dist/ea-opening-sim.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';
import {spatialAccess,spatialPrefab} from '../dist/ea-sr-spatial.mjs';

const BUILD_SITE={x:16,y:12,orientation:'south'};
const MOVE_SITE={x:40,y:12,orientation:'south'};

function exactReload(h){
 const serialized=JSON.stringify(h.s),tick=h.s.worldTick;
 h.save();
 assert.equal(JSON.stringify(h.s),serialized,'save/load preserves every serialized field');
 assert.equal(h.s.worldTick,tick,'save/load does not advance construction');
}

function issuePaidCommand(h,name,cost,...args){
 const before={...h.s.resources},result=h.act(name,...args);
 for(const [key,amount] of Object.entries(cost))assert.equal(h.s.resources[key],before[key]-amount,`${name} reserves ${key} once`);
 for(const key of Object.keys(before))if(!(key in cost))assert.equal(h.s.resources[key],before[key],`${name} leaves unrelated ${key} unchanged`);
 return result;
}

function reservedMaterials(h,orderId,buildingId,cost){
 const order=h.s.workOrdersById[orderId];
 assert(order&&order.targetId===buildingId);
 const reservation=h.s.reservationsById[order.reservationId];
 assert.deepEqual(reservation.cost,cost);
 const flow=order.materialFlow;
 assert(flow,'physical construction material route exists');
 const origin=h.s.stockpilesById[flow.sourceStockpileId],site=h.s.stockpilesById[flow.siteStockpileId];
 assert(origin&&site);
 for(const [key,quantity] of Object.entries(cost))if(key!=='jade'){
  const located=origin.resources[key]+site.resources[key]+(flow.cargo[key]||0)+(order.usedCost[key]||0);
  assert.equal(located,quantity,`${key} remains in source, cargo, site or installed work`);
 }
}

function completedOrder(h,id,operation,duration,cost){
 const records=h.s.spatial.completedOrders.filter(o=>o.id===id&&o.operation===operation);
 assert.equal(records.length,1,`${operation} has one completion record`);
 const result=records[0];
 assert.equal(result.phase,'completed');
 assert.equal(result.progressTicks,duration);
 assert.deepEqual(result.usedCost,cost);
 assert.equal(h.s.workOrdersById[id],undefined,'completed work order is cleared');
 assert.equal(h.s.reservationsById[id.replace('work:construction:','reservation:build:')],undefined,'material reservation is released');
 return result;
}

test('SR-XF-006: one earned lumber site builds, upgrades, relocates and demolishes through public commands',t=>{
 const h=normalOpening(),type='lumber',baseCost=S.BUILDINGS[type].cost;
 assert.equal(S.placementLock(h.s,type,BUILD_SITE.x,BUILD_SITE.y,null,2),'','site supports the later larger footprint');

 h.resources({...baseCost,food:40});
 const build=issuePaidCommand(h,'build',baseCost,type,BUILD_SITE.x,BUILD_SITE.y);
 const id=`building:yunxiu:${build.id}`,orderId=build.workOrderId;
 assert.equal(h.s.buildingsById[id],undefined,'construction does not create a completed building early');
 reservedMaterials(h,orderId,id,baseCost);
 exactReload(h);
 h.until(s=>s.workOrdersById[orderId]?.progressTicks>=20,'paid build work',1800);
 reservedMaterials(h,orderId,id,baseCost);
 exactReload(h);
 h.until(s=>!s.workOrdersById[orderId],'physical build completion',1800);
 exactReload(h);
 let building=h.s.buildingsById[id];
 assert(building&&building.id===build.id&&building.type===type);
 assert.deepEqual(building.transform,BUILD_SITE);
 assert.equal(building.level,1);
 const originalWidth=spatialPrefab(building).width,buildRevision=h.s.spatial.geometryRevision;
 const built=completedOrder(h,orderId,'build',200,baseCost);
 assert.equal(built.sourceTransform,null);
 assert.deepEqual(built.targetTransform,BUILD_SITE);

 const farm=h.s.buildings.find(b=>b.type==='farm'),farmStockId=`stockpile:${farm.instanceId}`,siteStockId=`stockpile:${id}`;
 h.until(s=>s.stockpilesById[farmStockId].resources.herb>=2,'real farm herbs for facility stock',3000);
 const farmHerb=h.s.stockpilesById[farmStockId].resources.herb,siteHerb=h.s.stockpilesById[siteStockId].resources.herb;
 const stockTransfer=h.act('startTransport',farmStockId,siteStockId,'person:master',{herb:2});
 assert.equal(h.s.stockpilesById[farmStockId].resources.herb,farmHerb-2,'public transfer reserves real farm inventory');
 exactReload(h);
 h.until(s=>s.workOrdersById[stockTransfer.id].phase==='delivered','herbs reach the new facility',3000);
 exactReload(h);
 const preservedHerb=siteHerb+2;
 assert(preservedHerb>0);
 assert.equal(h.s.stockpilesById[siteStockId].resources.herb,preservedHerb);
 assert.deepEqual(h.s.factsById[`fact:transport:${stockTransfer.id}`].quantities,{herb:2});

 const upgradeCost={jade:45,wood:30,stone:20};
 h.resources({...upgradeCost,food:40});
 assert.equal(S.placementLock(h.s,type,BUILD_SITE.x,BUILD_SITE.y,build.id,2),'');
 const upgrade=issuePaidCommand(h,'upgrade',upgradeCost,build.id);
 assert.equal(upgrade.workOrderId,orderId,'same building reuses its work order identity');
 assert.equal(h.s.buildingsById[id].level,1,'capacity does not grow before completion');
 assert.deepEqual(h.s.buildingsById[id].transform,BUILD_SITE);
 reservedMaterials(h,orderId,id,upgradeCost);
 exactReload(h);
 h.until(s=>s.workOrdersById[orderId]?.progressTicks>=20,'paid upgrade work',1800);
 assert.equal(h.s.buildingsById[id].level,1);
 reservedMaterials(h,orderId,id,upgradeCost);
 exactReload(h);
 h.until(s=>!s.workOrdersById[orderId],'upgrade completion',2400);
 exactReload(h);
 building=h.s.buildingsById[id];
 assert(building&&building.id===build.id&&building.level===2);
 assert.deepEqual(building.transform,BUILD_SITE);
 assert(spatialPrefab(building).width>originalWidth);
 assert.equal(h.s.spatial.geometryRevision,buildRevision+1);
 assert.equal(h.s.stockpilesById[siteStockId].resources.herb,preservedHerb,'facility stock survives upgrade');
 const upgraded=completedOrder(h,orderId,'upgrade',240,upgradeCost);
 assert.deepEqual(upgraded.sourceTransform,BUILD_SITE);
 assert.deepEqual(upgraded.targetTransform,BUILD_SITE);

 const relocateCost={jade:20,wood:16};
 h.resources({...relocateCost,food:40});
 assert.equal(S.placementLock(h.s,type,MOVE_SITE.x,MOVE_SITE.y,build.id,2),'','larger building has a legal destination');
 const relocate=issuePaidCommand(h,'relocate',relocateCost,build.id,MOVE_SITE.x,MOVE_SITE.y);
 assert.equal(relocate.workOrderId,orderId);
 assert.deepEqual(h.s.buildingsById[id].transform,BUILD_SITE,'source remains occupied until safe completion');
 reservedMaterials(h,orderId,id,relocateCost);
 exactReload(h);
 h.until(s=>s.workOrdersById[orderId]?.progressTicks>=20,'paid relocation work',1800);
 assert.deepEqual(h.s.buildingsById[id].transform,BUILD_SITE);
 reservedMaterials(h,orderId,id,relocateCost);
 exactReload(h);
 h.until(s=>!s.workOrdersById[orderId],'relocation completion',2400);
 exactReload(h);
 building=h.s.buildingsById[id];
 assert(building&&building.id===build.id&&building.level===2);
 assert.deepEqual(building.transform,MOVE_SITE);
 assert.equal(h.s.buildings.filter(b=>b.instanceId===id).length,1);
 assert.equal(h.s.spatial.geometryRevision,buildRevision+2);
 assert.equal(h.s.stockpilesById[siteStockId].resources.herb,preservedHerb,'facility stock survives relocation');
 const relocated=completedOrder(h,orderId,'relocate',180,relocateCost);
 assert.deepEqual(relocated.sourceTransform,BUILD_SITE);
 assert.deepEqual(relocated.targetTransform,MOVE_SITE);
 const stock=h.s.stockpilesById[`stockpile:${id}`];
 assert(stock);
 assert.deepEqual(stock.position,{sceneId:'scene:yunxiu-courtyard',...spatialAccess(building)});

 const beforeDemolish=JSON.stringify(h.s.resources),demolish=h.act('demolish',build.id);
 assert.equal(demolish.workOrderId,orderId);
 assert.equal(JSON.stringify(h.s.resources),beforeDemolish,'demolition charges no new materials');
 assert(h.s.buildingsById[id],'building stays until demolition is safe');
 assert.deepEqual(h.s.reservationsById[h.s.workOrdersById[orderId].reservationId].cost,{});
 exactReload(h);
 h.until(s=>s.workOrdersById[orderId]?.progressTicks>=20,'demolition work',1800);
 assert(h.s.buildingsById[id]);
 assert.equal(h.s.stockpilesById[siteStockId].resources.herb,preservedHerb);
 exactReload(h);
 let beforeCommit=null;
 for(let tick=0;tick<2400&&h.s.workOrdersById[orderId];tick++){
  const before={...h.s.resources};
  S.tick(h.s,.1);
  if(!h.s.workOrdersById[orderId])beforeCommit=before;
 }
 assert(beforeCommit,'demolition completes within the world-step budget');
 const afterCommit={...h.s.resources};
 exactReload(h);
 assert.equal(h.s.buildingsById[id],undefined);
 assert.equal(h.s.buildings.filter(b=>b.instanceId===id).length,0);
 assert.equal(h.s.spatial.geometryRevision,buildRevision+3);
 const demolished=completedOrder(h,orderId,'demolish',120,{});
 assert.deepEqual(demolished.sourceTransform,MOVE_SITE);
 assert.deepEqual(demolished.salvage,{jade:45,wood:32,stone:18});
 for(const [key,quantity] of Object.entries(demolished.salvage))assert.equal(afterCommit[key]-beforeCommit[key],quantity,`${key} salvage enters the public treasury on the completion tick`);
 const remainingStock=h.s.stockpilesById[`stockpile:${id}`];
 assert(remainingStock);
 assert.equal(remainingStock.removedBuildingId,id);
 assert.equal(remainingStock.buildingId,undefined);
 assert.equal(remainingStock.resources.herb,preservedHerb,'nonzero facility stock remains as traceable demolition inventory');
 assert.deepEqual(remainingStock.position,{sceneId:'scene:yunxiu-courtyard',...spatialAccess(building)});
 assert.deepEqual(h.s.spatial.completedOrders.filter(o=>o.id===orderId).map(o=>o.operation),['build','upgrade','relocate','demolish']);
 const after=JSON.stringify(h.s);
 assert.throws(()=>h.act('demolish',build.id),/建筑不存在/);
 assert.equal(JSON.stringify(h.s),after,'a repeated demolition cannot create another refund');
 t.diagnostic(JSON.stringify({source:'normal opening/public commands',buildingId:id,...h.counts}));
});
