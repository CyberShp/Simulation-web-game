import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,viewSect,quoteSectTrade,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';

test('desktop supplies command exposes water trade and read-only supply facts without adding player inventory',()=>{
 let session=createSectSession();const home=JSON.stringify(session.state.stockpilesById['stockpile:yunxiu'].resources),tick=session.state.worldTick;
 assert.equal(viewSect(session).operations.serviceSupplies.enabled,false);assert(!quoteSectTrade(session).goods.some(item=>item.id==='cleanWater'));
 const result=commandSect(session,{type:'enable-service-supplies'});assert(result.ok,result.error);
 assert.equal(viewSect(session).operations.serviceSupplies.enabled,true);assert.equal(session.state.worldTick,tick);
 assert.equal(JSON.stringify(session.state.stockpilesById['stockpile:yunxiu'].resources),home);
 const raw=JSON.stringify(snapshotSect(session));
 for(let i=0;i<3;i++){const view=viewSect(session);assert.equal(view.operations.serviceSupplies.merchantWater,0);const quote=quoteSectTrade(session,{resource:'cleanWater',side:'buy'});assert(quote.goods.some(item=>item.id==='cleanWater'&&item.label==='洁水'));assert.equal(quote.available,false);}
 assert.equal(JSON.stringify(snapshotSect(session)),raw);session=restoreSect(snapshotSect(session));assert.equal(JSON.stringify(snapshotSect(session)),raw);
});

test('desktop warehouse conversion rejects unrelated stocks and keeps the world intact',()=>{
 const session=createSectSession();assert(commandSect(session,{type:'enable-service-supplies'}).ok);
 const raw=JSON.stringify(session.state),result=commandSect(session,{type:'enable-warehouse-services',stockpileId:'stockpile:yunxiu'});
 assert.equal(result.ok,false);assert.match(result.error,/储运院/);assert.equal(JSON.stringify(session.state),raw);
});

import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {advanceSect} from '../../../apps/courtyard/sect-sim.mjs';
let kitchenSource;
function serviceSession(){
 if(!kitchenSource){
  let run=createSectSession();
  const command=(name,...args)=>{const r=SIM.dispatchCommand(run.state,{name,args});run.state=r.state;return r.result;};
  const until=(predicate,max=12000)=>{for(let i=0;i<max&&!predicate();i++)SIM.tick(run.state,.1);assert(predicate());};
  for(const name of ['enableCourtyardTerrain','enableEastResidences','enableEastServices','enableServiceSupplies'])command(name);
  command('startMasterHarvest','wood');until(()=>!run.state.master.activityId);
  const haul=command('startTransport','stockpile:carried:master','stockpile:yunxiu','person:master',{wood:12});until(()=>run.state.workOrdersById[haul.id].phase==='delivered');
  const build=command('buildDomainSite','site:domain:gc-13');until(()=>!run.state.workOrdersById[build.workOrderId]);
  kitchenSource=snapshotSect(run);
 }
 return restoreSect(structuredClone(kitchenSource));
}
function preparedKitchen(){
 const run=serviceSession(),b=run.state.buildings.find(b=>b.type==='kitchen'),stock=run.state.stockpilesById[`stockpile:${b.instanceId}`];
 // Finite input fixture for controller tests; not claimed as player-earned supplies.
 Object.assign(stock.resources,{food:18,cleanWater:4,wood:2});
 return {run,b,stockId:stock.id};
}
test('desktop service orders show local reservations, preserve read-only views and cancel once',()=>{
 let {run,b,stockId}=preparedKitchen();
 const start=commandSect(run,{type:'start-service',buildingId:b.instanceId,recipeId:'meal'});assert(start.ok,start.error);
 const id=start.result.workOrderId,raw=JSON.stringify(snapshotSect(run));
 for(let i=0;i<3;i++){
  const view=viewSect(run),service=view.operations.services.find(item=>item.buildingId===b.instanceId);
  assert.equal(service.orders[0].id,id);assert.equal(service.orders[0].phase,'queued');assert.equal(service.orders[0].masterWork.available,true);
  const stock=view.operations.inventory.stockpiles.find(item=>item.id===stockId);assert.equal(stock.serviceFacility,true);assert.equal(stock.reserved.food,9);assert.equal(stock.reserved.cleanWater,2);assert.equal(stock.items.find(item=>item.id==='cleanWater').name,'洁水');
 }
 assert.equal(JSON.stringify(snapshotSect(run)),raw);run=restoreSect(snapshotSect(run));assert.equal(JSON.stringify(snapshotSect(run)),raw);
 const cancel=commandSect(run,{type:'cancel-service',workOrderId:id});assert(cancel.ok,cancel.error);
 assert.equal(run.state.stockpilesById[stockId].resources.cleanWater,4);assert.equal(run.state.stockpilesById[stockId].resources.food,18);
 const state=JSON.stringify(run.state);assert.equal(commandSect(run,{type:'cancel-service',workOrderId:id}).ok,false);assert.equal(JSON.stringify(run.state),state);
});
test('desktop automatic control preserves an accepted service journey and onsite work',()=>{
 const {run,b}=preparedKitchen();
 let r=SIM.dispatchCommand(run.state,{name:'moveScenicMaster',args:[27,25]});run.state=r.state;
 for(let i=0;i<9000&&run.state.master.scenic.path.length;i++)SIM.tick(run.state,.1);
 assert.equal(run.state.master.scenic.path.length,0);
 const start=commandSect(run,{type:'start-service',buildingId:b.instanceId,recipeId:'meal'});assert(start.ok,start.error);
 const id=start.result.workOrderId,work=commandSect(run,{type:'master-service',workOrderId:id});assert(work.ok,work.error);
 advanceSect(run,31);
 assert.equal(run.control.mode,'auto');
 const order=run.state.workOrdersById[id];assert.notEqual(order.phase,'cancelled');assert.equal(order.workerId,'person:master');
 assert.equal(run.state.activitiesById[run.state.master.activityId]?.serviceOrderId,id);
 assert.equal(Object.values(run.state.factsById).filter(f=>f.kind==='site-service-completed'&&f.workOrderId===id).length,0);
 const raw=JSON.stringify(snapshotSect(run));assert.equal(JSON.stringify(snapshotSect(restoreSect(snapshotSect(run)))),raw);
});
