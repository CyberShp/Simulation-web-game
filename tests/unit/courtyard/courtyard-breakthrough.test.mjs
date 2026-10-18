import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {BREAKTHROUGH_ORDER_VERSION} from '../../../src/simulation/ea-sr-cultivation.mjs';
import {personLifeSummary} from '../../../src/simulation/ea-life.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {grantPills,carriedStockpile,stockpileReceiptPreview} from '../../../src/simulation/ea-sr-economy.mjs';
const HOME='stockpile:yunxiu';
// Finite rule fixture: XP/material prerequisites isolate the existing breakthrough
// phases. This is not evidence of normal fundraising or cultivation progression.
function prepared(realm=6){const run=createSectSession(),s=run.state;s.master.realm=realm;s.master.xp=SIM.xpNeed(realm);s.master.wound=0;s.master.energy=100;s.master.breakthroughCooldown=0;Object.assign(s.resources,SIM.breakthroughCost(s.master));if(realm===9){s.master.artsById.foundation={artId:'foundation',access:true,understanding:36,mastery:0,source:'rule-fixture',chapter:'foundation'};s.master.knowledge.foundation=36;grantPills(s,carriedStockpile(s,'person:master'),'foundation',1,{factId:'fact:pill:breakthrough-rule-fixture',actorId:'person:master'});}return run;}
function start(run){const r=commandSect(run,{type:'breakthrough'});assert(r.ok,r.error);return r.result.orderId;}
function until(run,id,progress,limit=2000){run.state.speed=1;for(let n=0;n<limit&&run.state.srCultivation.orders[id].progressTicks<progress;n++)SIM.tick(run.state,.1);assert.equal(run.state.srCultivation.orders[id].progressTicks,progress);}
function exact(run){const raw=JSON.stringify(snapshotSect(run)),loaded=restoreSect(raw);assert.equal(JSON.stringify(snapshotSect(loaded)),raw);return loaded;}
function rawExact(s){const raw=JSON.stringify(s);assert.equal(JSON.stringify(SIM.validateSave(JSON.parse(raw))),raw);}
function summary(run){return viewSect(run).operations.inventory.summary.find(x=>x.id==='public').amounts;}

test('desktop starts one real seat-bound breakthrough and completes once after 180 actual work ticks',()=>{
 let run=prepared();const initial=snapshotSect(run),view=viewSect(run);assert(view.operations.master.breakthrough.entryAvailable);assert.deepEqual(snapshotSect(run),initial);
 const id=start(run),order=run.state.srCultivation.orders[id];assert.equal(order.breakthroughVersion,BREAKTHROUGH_ORDER_VERSION);assert.equal(order.progressTicks,0);assert.equal(run.state.master.realm,6);assert.equal(run.state.resources.jade,0);
 const before=snapshotSect(run);viewSect(run);assert.deepEqual(snapshotSect(run),before);run=exact(run);
 run.state.speed=0;SIM.tick(run.state,2);assert.equal(run.state.srCultivation.orders[id].progressTicks,0);run.state.speed=1;SIM.tick(run.state,.1);assert.equal(run.state.srCultivation.orders[id].progressTicks,0,'commute is not breakthrough time');
 until(run,id,29);const a=run.state.activitiesById[run.state.master.activityId],slot=slotById(run.state,a.slotId);assert.equal(slot.kind,'cultivate');assert(Math.hypot(run.state.master.position.x-slot.position.x,run.state.master.position.y-slot.position.y)<.04);assert.equal(personLifeSummary(run.state,run.state.master).label,'突破调息');assert.equal(personLifeSummary(run.state,run.state.master).facilityId,slot.buildingId);assert.equal(personLifeSummary(run.state,run.state.master).progress.value,29);assert.equal(viewSect(run).operations.master.breakthrough.current.stageLabel,'调息准备');rawExact(run.state);
 until(run,id,30);assert.equal(viewSect(run).operations.master.breakthrough.current.stageLabel,'炼化');rawExact(run.state);
 until(run,id,120);assert.equal(viewSect(run).operations.master.breakthrough.current.stageLabel,'稳固境界');until(run,id,180);assert.equal(run.state.master.realm,7);assert.equal(run.state.master.xp,0);assert.equal(run.state.master.breakthroughCooldown,run.state.time+15);assert.equal(run.state.master.activityId,null);rawExact(run.state);SIM.tick(run.state,2);assert.equal(run.state.master.realm,7);assert.equal(run.state.stats.breakthroughs,1);
});

test('29 versus 30 work ticks preserve exact cancellation, source refunds and reserved totals',()=>{
 for(const tick of [0,29,30]){let run=prepared();const id=start(run);if(tick)until(run,id,tick);run.control={...run.state.masterControl};run=exact(run);const data=viewSect(run).operations,source=data.inventory.stockpiles.find(x=>x.id===HOME),amounts=summary(run);assert(data.master.actions.cancel.available);assert.equal(source.reserved.jade||0,tick<30?144:0);assert.equal(amounts.jade.reserved,tick<30?144:0);assert.equal(amounts.jade.total,tick<30?144:0);assert.equal(data.actionConsequences.requiresConfirmation,tick>=30);const r=commandSect(run,{type:'cancel-activity'});assert(r.ok,r.error);assert.equal(run.state.resources.jade,tick<30?144:0);assert.equal(run.state.resources.herb,tick<30?48:0);assert.equal(run.state.master.realm,6);assert.equal(run.state.master.xp,600);assert.notEqual(run.state.activitiesById[run.state.master.activityId]?.orderId,id);assert.equal(run.state.activitiesById[run.state.master.activityId]?.action,'rest');assert.equal(run.state.srCultivation.orders[id].phase,'cancelled');exact(run);const after=JSON.stringify(run.state);assert.throws(()=>SIM.dispatchCommand(run.state,{name:'cancelCultivationOrder',args:[id]}));assert.equal(JSON.stringify(run.state),after);}
});

test('full XP, physical state and materials reject without replacing an active body or modifying world',()=>{
 for(const alter of [s=>s.master.xp=599,s=>s.master.wound=1,s=>s.master.energy=34,s=>s.resources.herb=47,s=>s.master.breakthroughCooldown=s.time+1]){const run=prepared();alter(run.state);const before=JSON.stringify(run.state);assert.equal(viewSect(run).operations.master.breakthrough.entryAvailable,false);assert.equal(commandSect(run,{type:'breakthrough'}).ok,false);assert.equal(JSON.stringify(run.state),before);}
 const run=prepared();const id=start(run),before=JSON.stringify(run.state);assert.equal(commandSect(run,{type:'breakthrough'}).ok,false);assert.equal(JSON.stringify(run.state),before);assert.equal(run.state.activitiesById[run.state.master.activityId].orderId,id);
 const high=prepared(10),highBefore=JSON.stringify(high.state);assert.equal(viewSect(high).operations.master.breakthrough.entryVisible,false);assert.equal(commandSect(high,{type:'breakthrough'}).ok,false);assert.equal(JSON.stringify(high.state),highBefore);
});

test('missing or occupied usable cultivation places accrue no work and can be cancelled',()=>{
 const run=prepared();for(const b of run.state.buildings)if(['hall','meditation'].includes(b.type))b.enabled=false;const id=start(run);run.state.speed=1;for(let n=0;n<10;n++)SIM.tick(run.state,.1);assert.equal(run.state.srCultivation.orders[id].progressTicks,0);assert.match(viewSect(run).operations.master.breakthrough.current.stageLabel,/等候/);assert(commandSect(run,{type:'cancel-activity'}).ok);assert.equal(run.state.resources.jade,144);
});

test('new orders reject changed recipe, start identity, phase and marker while legacy orders retain their facts',()=>{
 const run=prepared(),id=start(run),snapshot=snapshotSect(run);
 for(const alter of [o=>o.durationTicks=1,o=>o.cost.jade=-1,o=>o.parameters.fromRealm=1,o=>o.consumed=true,o=>o.refineStarted=true,o=>o.createdTick++,o=>o.parameters.pillCost=1,o=>delete o.breakthroughVersion,o=>delete o.startFactId]){const bad=structuredClone(snapshot);alter(bad.state.srCultivation.orders[id]);const before=JSON.stringify(bad);assert.throws(()=>restoreSect(bad),/突破/);assert.equal(JSON.stringify(bad),before);}
 const wrongFact=structuredClone(snapshot);wrongFact.state.factsById[wrongFact.state.srCultivation.orders[id].startFactId].cost.jade=0;assert.throws(()=>restoreSect(wrongFact),/突破/);
 const noBody=structuredClone(snapshot);delete noBody.state.activitiesById[noBody.state.personsById['person:master'].activityId];noBody.state.personsById['person:master'].activityId=null;assert.throws(()=>restoreSect(noBody));
 const legacy=structuredClone(snapshot),o=legacy.state.srCultivation.orders[id];delete legacy.state.factsById[o.startFactId];delete o.breakthroughVersion;delete o.startFactId;const saved=JSON.stringify(legacy);assert.equal(JSON.stringify(snapshotSect(restoreSect(legacy))),saved);
});

test('foundation pill remains one held physical dose until refine and survives cancellation or completion',()=>{
 for(const tick of [29,30,180]){const run=prepared(9),id=start(run);until(run,id,tick);rawExact(run.state);const o=run.state.srCultivation.orders[id],a=run.state.srEconomy.pillAllocations[o.pillAllocation.id];assert.equal(a.phase,tick<30?'reserved':'consumed');assert.equal(run.state.pills.foundation,tick<30?1:0);if(tick<180){const r=commandSect(run,{type:'cancel-activity'});assert(r.ok,r.error);assert.equal(run.state.pills.foundation,tick<30?1:0);assert.equal(run.state.master.realm,9);}else{assert.equal(run.state.master.realm,10);assert.equal(run.state.pills.foundation,0);}rawExact(run.state);}
});

// The source warehouse stays physically full while the 192 cost units are refundable.
test('a full source keeps its refundable breakthrough capacity until cancellation or tick 30',()=>{
 for(const tick of [0,29,30]){const run=prepared(),s=run.state;for(const k of Object.keys(s.resources))s.resources[k]=0;Object.assign(s.resources,{jade:144,herb:48,wood:2208});assert.equal(stockpileReceiptPreview(s,HOME,{wood:1}).available,false);const id=start(run);if(tick)until(run,id,tick);const preview=stockpileReceiptPreview(run.state,HOME,{wood:1});assert.equal(preview.freeCapacity,tick<30?0:192);assert.equal(preview.available,tick>=30);assert.equal(summary(run).jade.reserved,tick<30?144:0);assert.equal(summary(run).jade.total,tick<30?144:0);assert(commandSect(run,{type:'cancel-activity'}).ok);assert.equal(stockpileReceiptPreview(run.state,HOME,{}).freeCapacity,tick<30?0:192);assert.equal(run.state.resources.jade,tick<30?144:0);rawExact(run.state);}
});
