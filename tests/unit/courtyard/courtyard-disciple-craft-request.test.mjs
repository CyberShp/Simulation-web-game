import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {createDiscipleCraftRequestScenario} from '../../fixtures/disciple-craft-request.mjs';
import {requestDiscipleCraft,discipleCraftRequestsView,advanceDiscipleCraftRequests,validateDiscipleCraftRequests} from '../../../src/simulation/ea-disciple-craft-request.mjs';
import {craftRefundPreview,cancelTransport,autonomousCraftAvailability} from '../../../src/simulation/ea-sr-economy.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';

function begin(){const f=createDiscipleCraftRequestScenario(),out=commandSect(f.session,f.request);assert(out.ok,out.error);assert(out.result.accepted,out.result.reason);return{...f,id:out.result.id,wid:out.result.craftOrderId};}
const record=f=>f.session.state.discipleCraftRequests.records.find(r=>r.id===f.id);
function advance(f,n){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);}
function until(f,predicate,max=5000){for(let n=0;n<max&&!predicate();n++)advance(f,n);assert(predicate(),'bounded formal scenario reaches its actual endpoint');}

test('older worlds and all craft projections remain read-only without creating request state',()=>{
 const s=createSectSession().state;assert.equal(s.discipleCraftRequests,undefined);const before=JSON.stringify(s);
 for(let i=0;i<3;i++){discipleCraftRequestsView(s);advanceDiscipleCraftRequests(s);validateDiscipleCraftRequests(s);autonomousCraftAvailability(s,s.homeMemberIds[0],'heal');}
 assert.equal(JSON.stringify(s),before);assert.equal(s.discipleCraftRequests,undefined);
});

test('one face-to-face accepted batch visits real stations, grows once and actually delivers its one foundation pill home',()=>{
 const f=begin(),initial=f.session.state,w=initial.workOrdersById[f.wid],p=initial.personsById[f.personId],medicine=p.mind.skills.medicine,alchemy=p.mind.knowledge.alchemy;
 assert.equal(w.personId,p.personId);assert.equal(w.recipeId,'foundation');assert.equal(w.durationTicks,780);assert.deepEqual(w.cost,{jade:180,herb:75,crystal:12,insight:15,cleanWater:6,wood:4});
 const repeatBefore=JSON.stringify(initial),answer=requestDiscipleCraft(initial,f.request);assert.equal(answer.id,f.id);assert.equal(answer.craftOrderId,w.id);assert.equal(JSON.stringify(initial),repeatBefore);
 let worked=0;const stages=new Set();
 for(let n=0;n<5000&&record(f).status==='accepted';n++){
  const previous=f.session.state.workOrdersById[f.wid].progressTicks;advance(f,n);const s=f.session.state,current=s.workOrdersById[f.wid],worker=s.personsById[f.personId];
  if(current.progressTicks>previous){worked++;assert.equal(current.progressTicks,previous+1);const last=current.process.completedStages.at(-1),a=s.activitiesById[worker.activityId],slot=slotById(s,a?.slotId||last?.slotId);assert(Math.hypot(worker.position.x-slot.position.x,worker.position.y-slot.position.y)<.04);stages.add(current.process.stageIndex);}
 }
 const s=f.session.state,r=record(f),finished=s.workOrdersById[f.wid],delivery=s.workOrdersById[r.deliveryOrderId];assert.equal(r.status,'completed');assert.equal(worked,780);assert.equal(stages.size,4);assert.equal(finished.phase,'completed');assert.equal(s.stockpilesById[f.siteStockpileId].pills.foundation,0);assert.equal(s.stockpilesById[f.sourceStockpileId].pills.foundation,1);
 assert.equal(delivery.phase,'delivered');assert.equal(delivery.carrierId,f.personId);assert.deepEqual(delivery.cargo,{'pill:foundation':1});assert.equal(s.factsById[`fact:transport:${delivery.id}`].targetStockpileId,f.sourceStockpileId);
 assert.equal(s.personsById[f.personId].mind.skills.medicine,medicine+.6);assert.equal(s.personsById[f.personId].mind.knowledge.alchemy,alchemy+.6);assert.equal(s.factsById[finished.resultFactId].growth.personId,f.personId);validateSect(f.session);
 const sameTick=JSON.stringify(s);advanceDiscipleCraftRequests(s);assert.equal(JSON.stringify(s),sameTick);
});

test('a real partial batch interrupted by injury refunds only unspent inputs and grants neither pills nor growth',()=>{
 const f=begin();until(f,()=>f.session.state.workOrdersById[f.wid].progressTicks>0,2000);const s=f.session.state,w=s.workOrdersById[f.wid],p=s.personsById[f.personId],preview=craftRefundPreview(s,w),medicine=p.mind.skills.medicine;
 p.wound=30;advance(f,1);const after=f.session.state,ended=after.workOrdersById[f.wid];assert.equal(ended.phase,'cancelled');assert.deepEqual(ended.refund,preview.refundable);assert.equal(record(f).status,'interrupted');assert.match(record(f).reason,/重伤/);assert.equal(after.stockpilesById[f.sourceStockpileId].pills.foundation,0);assert.equal(after.factsById[`fact:craft:${w.id}`],undefined);assert.equal(after.personsById[f.personId].mind.skills.medicine,medicine);validateSect(f.session);
});

test('cancelled carrying leaves the real medicine at its actual drop and never reports delivery completed',()=>{
 const f=begin();until(f,()=>{const r=record(f);return r.deliveryOrderId&&f.session.state.workOrdersById[r.deliveryOrderId].phase==='carrying';});
 const s=f.session.state,r=record(f),id=r.deliveryOrderId,drop=cancelTransport(s,id).returnedTo;assert.equal(s.stockpilesById[drop].pills.foundation,1);assert.equal(s.stockpilesById[f.sourceStockpileId].pills.foundation,0);
 advance(f,1);assert.equal(record(f).status,'interrupted');assert.match(record(f).reason,/运输已中止/);assert.equal(f.session.state.stockpilesById[f.sourceStockpileId].pills.foundation,0);assert.equal(f.session.state.stockpilesById[drop].pills.foundation,1);validateSect(f.session);
});
