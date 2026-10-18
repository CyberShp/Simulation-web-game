import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession} from '../../../apps/courtyard/sect-sim.mjs';
import {initEconomy,craftSR,craftAvailabilitySR,cancelCraftSR,tickEconomy,validateEconomy,craftProcessView,craftRefundPreview,stockpileReceiptPreview,settleEconomyDeath} from '../../../src/simulation/ea-sr-economy.mjs';
import {enableServiceResources} from '../../../src/simulation/ea-resource-types.mjs';
import {hydrateState} from '../../../src/simulation/ea-state-v6.mjs';
import {slotById,facilitySlots} from '../../../src/simulation/ea-facility-slots.mjs';
import {meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {personLifeSummary} from '../../../src/simulation/ea-life.mjs';
import {WEST_ALCHEMY_PROCESS_RECIPE_VERSION,WEST_ALCHEMY_RECIPE_VERSION} from '../../../src/simulation/ea-alchemy-definitions.mjs';
const HOME='stockpile:yunxiu',B='building:yunxiu:90',SITE=`stockpile:${B}`;
// Finite economy-rule fixture in the original courtyard's open geometry. The
// named GC26 prefab is deliberately placed here to verify actual body paths.
// It is not a canonical west-site placement or full-world desktop acceptance.
function fixture({west=true,adult=true}={}){
 const s=createSectSession().state;enableServiceResources(s);
 const b={id:90,instanceId:B,type:'alchemy',level:1,buildingGridVersion:'building-units-1',...(adult?{interiorLayoutVersion:'adult-furniture-1'}:{}),enabled:true,condition:100,transform:{x:44,y:40,orientation:'south'},...(west?{domainSiteId:'site:domain:gc-26'}:{})};s.buildingsById[B]=b;initEconomy(s);
 Object.assign(s.resources,{jade:100,food:100});Object.assign(s.stockpilesById[SITE].resources,{herb:10,cleanWater:2,wood:1});
 s.master.activityId=null;s.master.energy=100;s.master.wound=0;Object.assign(s.master.scenic,{x:47,y:47,path:[],goal:null});Object.assign(s.master.position,{x:47,y:47});return s;
}
function order(s){return Object.values(s.workOrdersById).find(w=>w.kind==='sr-crafting');}
function step(s){
 const before={...s.master.position},path=structuredClone(s.master.scenic.path),w=order(s),progress=w?.progressTicks;s.worldTick++;tickEconomy(s);
 // A real step may consume a corner and continue along the next segment. Check
 // the consumed polyline, not an invented chord across the corner's furniture.
 const remaining=s.master.scenic.path,consumed=path.length>=remaining.length&&JSON.stringify(path.slice(path.length-remaining.length))===JSON.stringify(remaining)?path.slice(0,path.length-remaining.length):[];
 let previous=before;for(const point of [...consumed,s.master.position]){assert.equal(meterSweep(s,previous,point).blocked,false,'each consumed body-path segment clears real geometry');previous=point;}
 if(w?.progressTicks>progress){const slot=slotById(s,s.activitiesById[w.activityId]?.slotId||craftProcessView(s,w).slotId);assert(Math.hypot(s.master.position.x-slot.position.x,s.master.position.y-slot.position.y)<.04,'work only at the current real station');assert.equal(w.progressTicks,progress+1,'one work increment per world tick');}return s;
}
function until(s,predicate,max=1200){for(let i=0;i<max&&!predicate(s);i++)step(s);assert(predicate(s),'bounded rule progression');return s;}
function atStage(s,index,progress){return until(s,()=>order(s).process.stageIndex===index&&order(s).process.stageProgressTicks===progress);}
function exact(s){validateEconomy(s);const raw=JSON.stringify(s),copy=hydrateState(JSON.parse(raw));assert.equal(validateEconomy(copy),true);assert.equal(JSON.stringify(copy),raw,'economy validation and JSON restoration preserve every fixture fact');return copy;}

test('new GC26 batch visits four real stations, saves each stage, and seals one physical result',()=>{
 let s=fixture();const raw=JSON.stringify(s),quote=craftAvailabilitySR(s,'heal');assert.equal(quote.recipeVersion,WEST_ALCHEMY_PROCESS_RECIPE_VERSION);assert.equal(quote.furnaceTicks,200);assert.deepEqual(quote.processStages.map(x=>x.durationTicks),[20,40,200,20]);assert.equal(JSON.stringify(s),raw);
 craftSR(s,'heal');const id=order(s).id;const sameTick=JSON.stringify(s);tickEconomy(s);assert.equal(JSON.stringify(s),sameTick,'repeated world tick is idempotent');step(s);assert.equal(order(s).progressTicks,0);s=exact(s);const seen=[];
 for(let index=0;index<4;index++){
  atStage(s,index,10);const w=order(s),v=craftProcessView(s,w),before=JSON.stringify(s),body=s.activitiesById[w.activityId];assert.equal(v.stageIndex,index);assert.equal(v.progressTicks,10);assert.equal(body.slotId,v.slotId);seen.push(body.slotId);
  assert.equal(personLifeSummary(s,s.master).progress.label,v.stageLabel);assert.equal(personLifeSummary(s,s.master).progress.total,v.durationTicks);craftRefundPreview(s,id);assert.equal(JSON.stringify(s),before);
  assert.equal(s.stockpilesById[SITE].pills.heal,0);s=exact(s);
 }
 until(s,()=>order(s).phase==='completed');const w=order(s);assert.equal(new Set(seen).size,4);assert.equal(w.progressTicks,280);assert.deepEqual(w.process.completedStages.map(x=>x.id),['prepare','extract','fire','seal']);assert(w.finishedTick-w.startedTick>280,'actual travel adds time');assert.equal(s.stockpilesById[SITE].pills.heal,2);assert.equal(s.stockpilesById[HOME].pills.heal,0);assert.equal(s.factsById[w.resultFactId].processVersion,w.process.version);
 s=exact(s);for(let i=0;i<20;i++)step(s);assert.equal(s.stockpilesById[SITE].pills.heal,2);assert.equal(Object.values(s.factsById).filter(f=>f.workOrderId===id&&f.operation==='pill-production').length,1);exact(s);
});

test('local input and named-station shortages refuse before reserving any material',()=>{
 for(const key of ['cleanWater','wood','slot']){const s=fixture({adult:key!=='slot'});if(key!=='slot')s.stockpilesById[SITE].resources[key]=0;const raw=JSON.stringify(s);assert.equal(craftAvailabilitySR(s,'heal').available,false);assert.throws(()=>craftSR(s,'heal'));assert.equal(JSON.stringify(s),raw);}
});

test('stage handoff waits for an occupied next station and body pauses consume no input or time',()=>{
 let s=fixture();craftSR(s,'heal');atStage(s,0,20);const w=order(s),oldSlot=s.activitiesById[w.activityId].slotId,next=facilitySlots(s,s.buildingsById[B],'work').find(x=>x.suffix==='work:filter:1');
 // Explicit concurrent-occupancy rule fixture; the other body's scheduling is
 // outside this economy-level test, while the shared physical reservation is real.
 s.reservationsById['reservation:fixture:block']={id:'reservation:fixture:block',kind:'sr-slot',personId:'person:lu-zhiwei',activityId:'activity:fixture:block',slotId:next.id};
 for(let i=0;i<10;i++)step(s);assert.equal(w.progressTicks,20);assert.equal(s.activitiesById[w.activityId].slotId,oldSlot);assert.equal(s.activitiesById[w.activityId].phase,'blocked');assert.deepEqual(craftRefundPreview(s,w).refundable,{jade:10,herb:0,cleanWater:2,wood:1});s=exact(s);
 delete s.reservationsById['reservation:fixture:block'];step(s);assert.equal(order(s).process.stageIndex,1);assert.equal(order(s).process.stageProgressTicks,0);s=exact(s);atStage(s,1,10);
 for(const [key,value]of [['energy',0],['wound',21]]){const old=s.master[key];s.master[key]=value;const progress=order(s).progressTicks,refund=craftRefundPreview(s,order(s));for(let i=0;i<10;i++)step(s);assert.equal(order(s).progressTicks,progress);assert.deepEqual(craftRefundPreview(s,order(s)),refund);s.master[key]=old;}
 until(s,()=>order(s).phase==='completed');exact(s);
});

test('cancellation before arrival and in every stage refunds precisely the unused original inputs once',()=>{
 for(const [index,progress,consumed]of [[0,0,{jade:0,herb:0,cleanWater:0,wood:0}],[0,10,{jade:0,herb:5,cleanWater:0,wood:0}],[1,20,{jade:0,herb:10,cleanWater:1,wood:0}],[2,100,{jade:5,herb:10,cleanWater:2,wood:.5}],[3,10,{jade:10,herb:10,cleanWater:2,wood:1}]]){
  let s=fixture();const stocks=structuredClone(s.stockpilesById);craftSR(s,'heal');if(progress)atStage(s,index,progress);s=exact(s);const w=order(s),preview=craftRefundPreview(s,w);assert.deepEqual(preview.consumed,consumed);assert.deepEqual(cancelCraftSR(s).refund,preview.refundable);assert.equal(w.cancelRecordVersion,'craft-cancel:v3');assert.deepEqual(w.consumed,consumed);
  for(const[k,q]of Object.entries(consumed))assert.equal(stocks[w.sourceStockpileIds[k]].resources[k]-s.stockpilesById[w.sourceStockpileIds[k]].resources[k],q);
  assert.equal(s.stockpilesById[SITE].pills.heal,0);s=exact(s);const done=JSON.stringify(s);assert.throws(()=>cancelCraftSR(s));assert.equal(JSON.stringify(s),done);
 }
});

test('unused input reserves real shelf capacity and completed sealing waits for a single receipt',()=>{
 let s=fixture();craftSR(s,'heal');let w=order(s),stock=s.stockpilesById[SITE];assert.equal(stockpileReceiptPreview(s,SITE,{stone:308}).available,false);assert.equal(stockpileReceiptPreview(s,SITE,{stone:307}).available,true);atStage(s,3,19);
 // A finite full-stock fixture tests the already completed result awaiting room.
 stock.resources.stone=320;step(s);assert.equal(w.progressTicks,280);assert.equal(w.phase,'active');assert.equal(s.activitiesById[w.activityId].phase,'blocked');assert.equal(stock.pills.heal,0);s=exact(s);for(let i=0;i<10;i++)step(s);assert.equal(order(s).progressTicks,280);
 s.stockpilesById[SITE].resources.stone=318;step(s);assert.equal(order(s).phase,'completed');assert.equal(s.stockpilesById[SITE].pills.heal,2);exact(s);
});

test('saved stage recipes, progress, reservations, ordering and cancellation results reject tampering',()=>{
 const s=fixture();craftSR(s,'heal');atStage(s,1,10);exact(s);
 for(const mutate of [
  (x,w)=>w.recipeSnapshot.process.stages[1].durationTicks++,
  (x,w)=>w.recipeSnapshot.process.stages[1].slotSuffix='work:1',
  (x,w)=>w.process.stageIndex++,
  (x,w)=>w.progressTicks++,
  (x,w)=>w.process.stageStartedTick=x.worldTick+1,
  (x,w)=>w.process.completedStages[0].finishedTick=x.worldTick,
  (x,w)=>x.reservationsById[w.reservationId].remainingCost.cleanWater++,
  (x,w)=>x.activitiesById[w.activityId].slotId=`${B}/slot:work:1`,
  (x,w)=>x.buildingsById[B].level=2
 ]){const copy=hydrateState(JSON.parse(JSON.stringify(s)));mutate(copy,order(copy));const raw=JSON.stringify(copy);assert.throws(()=>validateEconomy(copy));assert.equal(JSON.stringify(copy),raw);}
 cancelCraftSR(s);exact(s);const copy=hydrateState(JSON.parse(JSON.stringify(s)));copy.factsById[`fact:craft-cancel:${order(copy).id}`].consumed.herb--;assert.throws(()=>validateEconomy(copy));
});

// Captured-schema rule fixtures model previously paid orders with their immutable
// catalogue snapshot. All cost/clock/body data comes from the same finite setup;
// assigning the historical version is fixture preparation, never save migration.
function legacy(version){const s=fixture({west:version===WEST_ALCHEMY_RECIPE_VERSION});craftSR(s,'heal');const w=order(s);if(version===WEST_ALCHEMY_RECIPE_VERSION){delete w.process;delete w.recipeSnapshot.process;delete s.reservationsById[w.reservationId].remainingCost;w.durationTicks=200;w.recipeSnapshot.durationTicks=200;w.recipeSnapshot.workstationRule='facility:alchemy:exclusive-slot';const a=s.activitiesById[w.activityId],slot=facilitySlots(s,s.buildingsById[B],'work').find(x=>x.suffix==='work:1');a.slotId=slot.id;s.reservationsById[w.slotReservationId].slotId=slot.id;s.master.scenic.path=[];s.master.scenic.goal={...slot.position};}w.recipeVersion=version;w.recipeSnapshot.recipeVersion=version;return s;}
test('paid legacy yunxiu v1/v2 and T25 v1 retain one furnace, original duration and proportional refund',()=>{
 for(const version of ['pill-recipes:yunxiu:v1','supply-recipes:yunxiu:v2',WEST_ALCHEMY_RECIPE_VERSION]){
  let s=legacy(version);const snapshot=JSON.stringify(order(s).recipeSnapshot);s=exact(s);until(s,()=>order(s).progressTicks===30);assert.equal(JSON.stringify(order(s).recipeSnapshot),snapshot);assert.equal(order(s).process,undefined);assert.equal(craftProcessView(s,order(s)).stageCount,1);assert.equal(order(s).durationTicks,200);s=exact(s);
  const completed=hydrateState(JSON.parse(JSON.stringify(s)));until(completed,()=>order(completed).phase==='completed');assert.equal(completed.stockpilesById[SITE].pills.heal,2);assert.equal(JSON.stringify(order(completed).recipeSnapshot),snapshot);exact(completed);
  const w=order(s),r=cancelCraftSR(s);for(const[k,q]of Object.entries(w.cost))assert.equal(r.refund[k],q*(1-30/200));assert.equal(w.cancelRecordVersion,'craft-cancel:v2');assert.equal(w.process,undefined);exact(s);
 }
});

test('death interruption preserves spent work and physically returns remaining batch material',()=>{
 const s=fixture();craftSR(s,'heal');atStage(s,1,10);const before=craftRefundPreview(s,order(s));settleEconomyDeath(s,'person:master');assert.equal(order(s).phase,'interrupted');assert.deepEqual(order(s).refund,before.refundable);assert.equal(s.stockpilesById[SITE].pills.heal,0);exact(s);
});


test('new-stage cancellation overflow retains the original physical source and owner',()=>{
 const s=fixture();craftSR(s,'heal');atStage(s,1,20);const w=order(s),source=s.stockpilesById[SITE],position=structuredClone(source.position);source.resources.stone=320;
 const result=cancelCraftSR(s);assert.equal(result.refund.cleanWater,1);assert.equal(result.refund.wood,1);for(const k of ['cleanWater','wood']){const refund=s.stockpilesById[w.refundStockpileIds[k]];assert.notEqual(refund.id,SITE);assert.equal(refund.ownerId,source.ownerId);assert.deepEqual(refund.position,position);assert.equal(refund.resources[k],1);}exact(s);
});
