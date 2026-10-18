import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {personLifeSummary} from '../../../src/simulation/ea-life.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
const HOME='stockpile:yunxiu';let fixture;
function send(run,name,...args){const r=SIM.dispatchCommand(run.state,{name,args});run.state=r.state;return r.result;}
function until(run,predicate,max=3000){run.state.speed=1;for(let i=0;i<max&&!predicate(run.state);i++)SIM.tick(run.state,.1);assert(predicate(run.state));}
function exact(run){run.control={...run.state.masterControl};const raw=snapshotSect(run);assert.deepEqual(snapshotSect(restoreSect(raw)),raw);return raw;}
function prepared(){
 if(!fixture){const run=createSectSession();
  // Finite UI/rule fixture using the legacy courtyard build path; not normal GC26 funding or spatial acceptance.
  Object.assign(run.state.resources,{jade:200,wood:100,stone:100,herb:100,food:200});
  const order=send(run,'build','alchemy',44,40);until(run,s=>!s.workOrdersById[order.workOrderId]);
  const b=run.state.buildings.find(b=>b.type==='alchemy'),delivery=send(run,'startTransport',HOME,`stockpile:${b.instanceId}`,'person:master',{herb:20});until(run,s=>s.workOrdersById[delivery.id].phase==='delivered');
  fixture=exact(run);
 }return restoreSect(structuredClone(fixture));
}
function start(run){const b=run.state.buildings.find(b=>b.type==='alchemy'),r=commandSect(run,{type:'craft-pill',buildingId:b.instanceId,recipeId:'heal'});assert(r.ok,r.error);return r.result.id;}

test('alchemy view is read-only and missing facility, local input or selected building refuses without state changes',()=>{
 const empty=createSectSession(),raw=snapshotSect(empty);assert.equal(viewSect(empty).operations.alchemy.workstation,null);assert.equal(commandSect(empty,{type:'craft-pill',buildingId:'missing',recipeId:'heal'}).ok,false);assert.deepEqual(snapshotSect(empty),raw);
 for(const wrong of ['building','input']){const run=prepared(),b=run.state.buildings.find(b=>b.type==='alchemy');if(wrong==='input')run.state.stockpilesById[`stockpile:${b.instanceId}`].resources.herb=0;const before=snapshotSect(run),v=viewSect(run).operations.alchemy;assert.equal(v.workstation.buildingId,b.instanceId);assert.deepEqual(snapshotSect(run),before);const r=commandSect(run,{type:'craft-pill',buildingId:wrong==='building'?'missing':b.instanceId,recipeId:'heal'});assert.equal(r.ok,false);assert.deepEqual(snapshotSect(run),before);}
});

test('shared cancellation preserves exact input accounting before arrival and after partial furnace work',()=>{
 for(const progress of [0,30]){const run=prepared(),before=structuredClone(run.state.stockpilesById),id=start(run);if(progress)until(run,s=>s.workOrdersById[id].progressTicks>=progress);const o=run.state.workOrdersById[id];assert.equal(o.progressTicks,progress);const view=viewSect(run),c=view.operations.actionConsequences;assert(view.operations.master.actions.cancel.available);assert.equal(view.operations.master.activity.progressTicks,progress);assert.equal(c.requiresConfirmation,progress>0);exact(run);const r=commandSect(run,{type:'cancel-activity'});assert(r.ok,r.error);assert.equal(run.state.workOrdersById[id].phase,'cancelled');for(const [key,quantity]of Object.entries(o.cost)){const sid=o.sourceStockpileIds[key];assert(Math.abs(before[sid].resources[key]-run.state.stockpilesById[sid].resources[key]-quantity*progress/o.durationTicks)<1e-7);}assert.equal(run.state.stockpilesById[`stockpile:${o.targetId}`].pills.heal,0);exact(run);}
});

test('a public furnace batch waits for its real seat, resumes exactly and produces pills only once at the furnace',()=>{
 let run=prepared();const id=start(run),initial=run.state.workOrdersById[id];assert.equal(initial.progressTicks,0);assert.equal(run.state.stockpilesById[`stockpile:${initial.targetId}`].pills.heal,0);
 until(run,s=>s.workOrdersById[id].progressTicks>=20);const body=run.state.activitiesById[run.state.master.activityId],slot=slotById(run.state,body.slotId);assert.equal(slot.kind,'work');assert(Math.hypot(run.state.master.position.x-slot.position.x,run.state.master.position.y-slot.position.y)<.04);assert.equal(body.phase,'working');const life=personLifeSummary(run.state,run.state.master);assert.equal(life.label,'炼丹');assert.equal(life.facilityId,slot.buildingId);assert.equal(life.progress.value,20);assert.equal(life.progress.total,200);assert.match(life.reason,/丹炉/);
 run=restoreSect(exact(run));until(run,s=>s.workOrdersById[id].phase==='completed');const o=run.state.workOrdersById[id],stock=run.state.stockpilesById[`stockpile:${o.targetId}`];assert.equal(o.progressTicks,200);assert.equal(stock.pills.heal,2);assert(o.resultFactId&&run.state.factsById[o.resultFactId]);const pills=stock.pills.heal;for(let i=0;i<20;i++)SIM.tick(run.state,.1);assert.equal(stock.pills.heal,pills);exact(run);const view=viewSect(run).operations.alchemy;assert.equal(view.workstation.pills.heal,2);assert.equal(view.orders.find(o=>o.id===id).phase,'completed');
});
