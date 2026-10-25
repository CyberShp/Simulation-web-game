import test from 'node:test';
import assert from 'node:assert/strict';
import {createPharmacistDevelopmentScenario} from '../../fixtures/pharmacist-development.mjs';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {cancelPersonCraftSR,craftRefundPreview} from '../../../src/simulation/ea-sr-economy.mjs';
import {craftBodyYielding,visibleBodyRouteClear} from '../../../src/simulation/ea-sr-spatial.mjs';

// The fixture first performs real work, then declares its initial injury.
// All cancellation, successor choice, commuting and traffic are real ticks.
function start(){
 const f=createPharmacistDevelopmentScenario({condition:'interrupted-replacement'}),s=f.session.state;
 assert(commandSect(f.session,{type:'medicine-supply',enabled:true,target:2}).ok);
 for(let i=0;i<1800;i++){
  advance(f.session,i);const s=f.session.state,p=s.personsById[f.replacementId],y=p.mind.scenic.bodyYield;
  if(y?.kind==='transport-retreat'){
   const a=s.activitiesById[p.activityId],w=s.workOrdersById[a.workOrderId];
   assert.equal(w.phase,'active');assert.equal(w.progressTicks,0);assert.equal(s.workOrdersById[f.initialCraftId].phase,'cancelled');validateSect(f.session);
   return{...f,pid:p.personId,wid:w.id,atYield:structuredClone(y),originalGoal:structuredClone(p.mind.scenic.goal)};
  }
 }
 assert.fail('real reciprocal craft/heal traffic did not reach a bounded retreat');
}
function advance(session,n){if(n%100===0)assert(commandSect(session,{type:'manual'}).ok);advanceSect(session,.1);}

test('owned craft physically yields to the returning healer, restores its route and only works after actual arrival',()=>{
 const f=start(),{session,pid,wid,atYield,originalGoal}=f,initial=session.state,from=structuredClone(initial.personsById[pid].position),steps=initial.personsById[pid].mind.scenic.steps,bed=initial.activitiesById[initial.personsById[f.pharmacistId].activityId].slotId;
 assert.equal(craftBodyYielding(initial,initial.personsById[pid],initial.workOrdersById[wid]),true);
 assert.equal(visibleBodyRouteClear(initial,from,atYield.path),true);assert.deepEqual(atYield.returnPath.at(-1),originalGoal);
 const prefixLength=atYield.path.reduce((sum,p,i)=>sum+Math.hypot(p.x-(i?atYield.path[i-1].x:from.x),p.y-(i?atYield.path[i-1].y:from.y)),0);assert(prefixLength<=24);
 let yieldedSteps=0,restored=false;
 for(let i=0;i<1800;i++){
  advance(session,i);const s=session.state,p=s.personsById[pid],w=s.workOrdersById[wid],a=p.mind.scenic;
  if(a.bodyYield){yieldedSteps++;assert.equal(w.progressTicks,0);assert.equal(w.personId,pid);assert.deepEqual(a.goal,originalGoal);}
  else if(!restored){restored=true;assert.deepEqual(a.goal,originalGoal);assert(a.steps>steps);}
  if(w.phase==='completed')break;
 }
 const s=session.state,w=s.workOrdersById[wid],healer=s.personsById[f.pharmacistId];assert(yieldedSteps>0);assert(restored);assert.equal(w.phase,'completed');assert.equal(w.progressTicks,280);assert.equal(s.stockpilesById[f.siteStockpileId].pills.heal,2);assert.equal(s.factsById[w.resultFactId].actorId,pid);
 assert(healer.wound<30);assert.equal(s.activitiesById[healer.activityId].slotId,bed);assert.equal(s.activitiesById[healer.activityId].phase,'executing');validateSect(session);
});

test('cancelling the owned commuting batch immediately releases only its yield and preserves the healer bed',()=>{
 const f=start(),s=f.session.state,p=s.personsById[f.pid],w=s.workOrdersById[f.wid],healer=s.personsById[f.pharmacistId],bedActivity=structuredClone(s.activitiesById[healer.activityId]),bedReservation=structuredClone(s.reservationsById[bedActivity.reservationId]),preview=craftRefundPreview(s,w);
 assert.deepEqual(cancelPersonCraftSR(s,p.personId).refund,preview.refundable);assert.equal(p.mind.scenic.bodyYield,undefined);assert.equal(p.activityId,null);assert.equal(w.phase,'cancelled');assert.equal(s.factsById[`fact:craft:${w.id}`],undefined);assert.deepEqual(s.activitiesById[healer.activityId],bedActivity);assert.deepEqual(s.reservationsById[bedActivity.reservationId],bedReservation);validateSect(f.session);
});
