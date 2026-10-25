import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {createDiscipleAdvancementScenario} from '../../fixtures/disciple-advancement.mjs';
import {discipleAdvancementView} from '../../../src/simulation/ea-disciple-advancement.mjs';
import {breakthroughPillAvailability} from '../../../src/simulation/ea-sr-economy.mjs';
import {cancelCultivationOrder} from '../../../src/simulation/ea-sr-cultivation.mjs';
import {sceneUnits} from '../../../src/simulation/ea-sr-spatial.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';

const breakthrough=(f)=>Object.values(f.session.state.srCultivation.orders).find(o=>o.personId===f.targetId&&o.kind==='breakthrough');
function advance(f,n){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);}
function until(f,predicate,max=4000){for(let i=0;i<max&&!predicate();i++)advance(f,i);assert(predicate(),'bounded formal scenario reaches the actual endpoint');}

test('advancement needs are pure and older worlds gain no new state',()=>{
 const s=createSectSession().state,before=JSON.stringify(s);for(let i=0;i<3;i++)discipleAdvancementView(s);assert.equal(JSON.stringify(s),before);
 const f=createDiscipleAdvancementScenario(),initial=JSON.stringify(f.session.state),target=discipleAdvancementView(f.session.state).members.find(p=>p.personId===f.targetId);
 assert.equal(target.needsFoundation,true);assert.equal(target.recipeId,'foundation');assert.equal(target.quantity,1);assert.equal(JSON.stringify(f.session.state),initial);
});

test('a distant willing resident actually picks one pill, consumes it at30 and completes180 own station steps before returning to production',()=>{
 // U-172 supplies one finite initial pill to isolate existing advancement work.
 // The complete medicine-crafting chain is separately exercised by the scenario.
 const f=createDiscipleAdvancementScenario({initialFoundation:1}),s=f.session.state,p=s.personsById[f.targetId],realm=p.realm,stats=s.stats.breakthroughs,initialFacts=new Set(Object.keys(s.factsById));
 assert.equal(breakthroughPillAvailability(s,p.personId).available,0);assert.equal(breakthroughPillAvailability(s,p.personId).needsPickup,true);assert.equal(s.stockpilesById[f.sourceStockpileId].pills.foundation,1);
 until(f,()=>{const now=f.session.state,target=now.personsById[f.targetId],a=now.activitiesById[target.activityId];return a?.kind==='sr-transport';},100);
 let now=f.session.state,target=now.personsById[f.targetId],transport=now.workOrdersById[now.activitiesById[target.activityId].workOrderId];assert.equal(transport.phase,'to-source');assert.deepEqual(transport.cargo,{'pill:foundation':1});assert.equal(now.stockpilesById[f.sourceStockpileId].pills.foundation,0);assert.equal(breakthrough(f),undefined);
 until(f,()=>breakthrough(f)?.progressTicks===29);
 now=f.session.state;let order=breakthrough(f);target=now.personsById[f.targetId];const a=now.activitiesById[target.activityId],slot=slotById(now,a.slotId);
 assert.equal(order.pillAllocation.phase,'reserved');assert.equal(order.consumed,false);assert.equal(order.refineStarted,false);assert.equal(target.realm,realm);assert(Math.hypot(target.position.x-slot.position.x,target.position.y-slot.position.y)<=sceneUnits(now,1)+1e-8);assert.equal(now.reservationsById[a.reservationId].personId,f.targetId);assert.equal(now.reservationsById[a.reservationId].activityId,a.id);assert.equal(now.reservationsById[a.reservationId].slotId,a.slotId);
 assert.equal(order.pillAllocation.parts.length,1);assert.equal(order.pillAllocation.parts[0].stockpileId,`stockpile:carried:${f.targetId.slice(7)}`);assert.equal(now.workOrdersById[transport.id].phase,'delivered');
 const quoteBefore=JSON.stringify(now);discipleAdvancementView(now);assert.equal(JSON.stringify(now),quoteBefore);
 advance(f,1);now=f.session.state;order=breakthrough(f);assert.equal(order.progressTicks,30);assert.equal(order.pillAllocation.phase,'consumed');assert.equal(order.refineStarted,true);assert.equal(now.factsById[`fact:pill-consume:${order.pillAllocation.id}`].quantity,1);
 until(f,()=>breakthrough(f).progressTicks===179);assert.equal(f.session.state.personsById[f.targetId].realm,realm);advance(f,1);now=f.session.state;order=breakthrough(f);assert.equal(order.progressTicks,180);assert.equal(order.phase,'completed');assert.equal(now.personsById[f.targetId].realm,realm+1);assert.equal(now.stats.breakthroughs,stats+1);
 assert.equal(Object.values(now.srCultivation.orders).filter(o=>o.personId===f.targetId&&o.kind==='breakthrough').length,1);assert.equal(now.personsById[f.targetId].breakthroughCooldown,now.time+15);assert.equal(now.stockpilesById[f.sourceStockpileId].pills.foundation,0);validateSect(f.session);
 until(f,()=>Object.entries(f.session.state.factsById).some(([id,fact])=>!initialFacts.has(id)&&fact.operation==='production'&&fact.atTick>order.completedTick&&fact.participantIds?.includes(f.targetId)),2500);
 const final=f.session.state;assert.equal(final.personsById[f.targetId].realm,realm+1);assert.equal(final.stats.breakthroughs,stats+1);assert.equal(Object.values(final.factsById).filter(fact=>fact.id===`fact:pill-consume:${order.pillAllocation.id}`).length,1);validateSect(f.session);
});

for(const progress of [29,30])test(`cancelling at${progress} preserves the existing pre/post-refining refund boundary for the personally carried pill`,()=>{
 const f=createDiscipleAdvancementScenario({initialFoundation:1});until(f,()=>breakthrough(f)?.progressTicks===progress);
 const s=f.session.state,o=breakthrough(f),bag=`stockpile:carried:${f.targetId.slice(7)}`,before={...s.resources},allocation=o.pillAllocation;
 assert.equal(allocation.parts[0].stockpileId,bag);assert.equal(s.stockpilesById[bag].pills.foundation,0);assert.equal(o.consumed,progress===30);
 assert.equal(cancelCultivationOrder(s,o.id).refunded,progress===29);assert.equal(o.phase,'cancelled');assert.equal(s.personsById[f.targetId].realm,9);assert.equal(s.stockpilesById[f.sourceStockpileId].pills.foundation,0);assert.equal(s.stockpilesById[bag].pills.foundation,progress===29?1:0);
 for(const[k,q]of Object.entries(o.cost))assert(Math.abs(s.resources[k]-before[k]-(progress===29?q:0))<1e-8);
 assert.equal(allocation.phase,progress===29?'refunded':'consumed');assert.equal(!!s.factsById[`fact:pill-consume:${allocation.id}`],progress===30);assert.equal(!!s.factsById[`fact:pill-refund:${allocation.id}`],progress===29);validateSect(f.session);
});
