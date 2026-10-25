import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {medicineSupplyView} from '../../../src/simulation/ea-medicine-supply.mjs';
import {createMedicineSupplyScenario} from '../../fixtures/medicine-supply.mjs';

const orders=f=>Object.values(f.session.state.workOrdersById).filter(w=>w.kind==='sr-crafting'&&w.autonomous);
const pillFacts=f=>Object.values(f.session.state.factsById).filter(v=>v.operation==='pill-production').map(v=>v.id).sort();
function policy(f,enabled,target=2){const r=commandSect(f.session,{type:'medicine-supply',enabled,target});assert(r.ok,r.error);}
function steps(f,count){for(let n=0;n<count;n++){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);}}
function until(f,predicate,limit=20000){
 for(let n=0;n<limit;n++){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);if(predicate())return;}
 assert.fail('the bounded supply scenario did not reach the required actual outcome');
}

test('repeated observation produces nothing and a satisfied stock target stops new batches',()=>{
 const f=createMedicineSupplyScenario({condition:'ready'}),before=JSON.stringify(f.session.state);
 for(let n=0;n<5;n++)medicineSupplyView(f.session.state);
 assert.equal(JSON.stringify(f.session.state),before);
 policy(f,true);
 until(f,()=>medicineSupplyView(f.session.state).home>=2&&!f.session.state.medicineSupply.active);
 const facts=pillFacts(f),batches=orders(f).map(w=>w.id);assert(facts.length>0);assert(batches.length>0);
 steps(f,300);
 assert.deepEqual(pillFacts(f),facts);assert.deepEqual(orders(f).map(w=>w.id),batches);
 const settled=JSON.stringify(f.session.state);
 for(let n=0;n<5;n++)assert(medicineSupplyView(f.session.state).home>=2);
 assert.equal(JSON.stringify(f.session.state),settled);validateSect(f.session);
});

test('disabling supply preserves the accepted batch, its real reservations, and its completion',()=>{
 const f=createMedicineSupplyScenario({condition:'ready'});policy(f,true);
 until(f,()=>orders(f).some(w=>w.phase==='active'&&w.progressTicks>=10));
 const w=orders(f).find(w=>w.phase==='active'),id=w.id,s=f.session.state;
 assert.notEqual(w.personId,'person:master');
 assert.equal(s.personsById[w.personId].activityId,w.activityId);
 assert.equal(Object.values(s.activitiesById).filter(a=>a.personId===w.personId).length,1,'the accepted worker owns one body activity');
 assert.equal(s.reservationsById[w.slotReservationId].personId,w.personId);
 const batch=JSON.stringify(w),material=JSON.stringify(s.reservationsById[w.reservationId]),slot=JSON.stringify(s.reservationsById[w.slotReservationId]);
 policy(f,false);
 assert.equal(JSON.stringify(f.session.state.workOrdersById[id]),batch);
 assert.equal(JSON.stringify(f.session.state.reservationsById[w.reservationId]),material);
 assert.equal(JSON.stringify(f.session.state.reservationsById[w.slotReservationId]),slot);
 until(f,()=>f.session.state.workOrdersById[id].phase==='completed');
 const done=f.session.state.workOrdersById[id],fact=f.session.state.factsById[done.resultFactId];
 assert.equal(fact.actorId,w.personId);assert.equal(fact.targetStockpileId,f.siteStockpileId);
 assert(f.session.state.stockpilesById[f.siteStockpileId].pills.heal>=done.yield);
 assert.equal(orders(f).length,1);assert.equal(f.session.state.medicineSupply.enabled,false);validateSect(f.session);
});

test('missing real material makes no medicine and replenished public stock can resume through actual transport',()=>{
 const f=createMedicineSupplyScenario({condition:'missing-material'});policy(f,true);
 const originalFacts=pillFacts(f);steps(f,120);
 assert.deepEqual(pillFacts(f),originalFacts);assert.equal(orders(f).length,0);
 assert.equal(medicineSupplyView(f.session.state).home,0);
 // The fixture supplies finite water in the master's private carried stock.
 // Deliver it through the public command; the NPC must then move it onward.
 const refill=commandSect(f.session,{type:'transport',sourceStockpileId:f.refillSourceStockpileId,targetStockpileId:'stockpile:yunxiu',cargo:{cleanWater:2}});
 assert(refill.ok,refill.error);
 until(f,()=>orders(f).some(w=>w.progressTicks>0));
 const w=orders(f).find(w=>w.progressTicks>0),s=f.session.state;
 assert.equal(w.sourceStockpileIds.cleanWater,f.siteStockpileId);
 assert(Object.values(s.workOrdersById).some(t=>t.kind==='transport'&&t.sourceStockpileId==='stockpile:yunxiu'&&t.targetStockpileId===f.siteStockpileId&&t.cargo.cleanWater>0&&t.phase==='delivered'));
 assert(w.cost.cleanWater>0);assert.equal(s.reservationsById[w.reservationId].cost.cleanWater,w.cost.cleanWater);
 assert.equal(s.activitiesById[w.activityId].personId,w.personId);validateSect(f.session);
});

test('a stock shortage cannot force an unwilling or already committed resident into supply work',()=>{
 const f=createMedicineSupplyScenario({condition:'no-worker'});policy(f,true);
 const facts=pillFacts(f);steps(f,120);
 assert.equal(medicineSupplyView(f.session.state).home,0);
 assert.equal(f.session.state.medicineSupply.active,null);assert.equal(orders(f).length,0);
 assert.deepEqual(pillFacts(f),facts);
 assert.match(medicineSupplyView(f.session.state).reason,/暂无|愿意|承诺|恢复|空闲/);
 assert(!Object.values(f.session.state.activitiesById).some(a=>a.kind==='sr-craft'&&a.personId!=='person:master'));
 validateSect(f.session);
});
