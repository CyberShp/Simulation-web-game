import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {AUTONOMY_V2,prepareAutonomyV2} from '../../../src/simulation/ea-sr-persons.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {createExpeditionRecoveryScenario} from '../../fixtures/expedition-recovery.mjs';

const person=f=>f.session.state.personsById[f.returneeId];
const journey=f=>f.session.state.discipleExpeditions.journeys.find(j=>j.id===f.journeyId);
function until(f,predicate,limit=400){
 for(let n=0;n<limit;n++){advanceSect(f.session,.1);if(predicate())return;}
 assert.fail('required physical outcome did not occur within '+limit+' world steps');
}
function returned(condition='no-medicine'){
 const f=createExpeditionRecoveryScenario({condition});
 until(f,()=>journey(f).phase==='returned',50);
 assert.equal(person(f).mind.recovering,true);
 return f;
}

test('hunger can interrupt recovery and actual foraging resumes healing without medicine',()=>{
 const f=returned(),p=person(f);p.mind.satiety=10;
 validateSect(f.session);
 until(f,()=>person(f).mind.activity==='forage',30);
 assert.equal(person(f).mind.recovering,true);
 assert.equal(person(f).wound,12,'seeking food is not a healing step');
 until(f,()=>person(f).mind.satiety>=22,150);
 assert.equal(person(f).mind.recovering,true);
 until(f,()=>person(f).mind.activity==='heal'&&person(f).wound<12,100);
 assert.equal(f.session.state.resources.herb,0);
 assert.equal(person(f).mind.recovering,true);
 assert.match(person(f).mind.reason,/自然调养/);
 assert.equal(journey(f).phase,'returned');
});

test('a returning v2 resident keeps healing through the night-rest phase',()=>{
 const f=returned();
 // Configure the supported schedule version after the actual return; do not
 // prewrite the subsequent decision, recovery, or physical bed arrival.
 f.session.state=prepareAutonomyV2(f.session.state,validateSave);
 person(f).energy=60;
 validateSect(f.session);
 const initialWound=person(f).wound;
 until(f,()=>person(f).schedule.phase==='rest',350);
 const p=person(f),s=f.session.state,a=s.activitiesById[p.activityId];
 assert.equal(p.schedule.definitionId,AUTONOMY_V2.version);
 assert(p.energy<92,'night-rest override must have an eligible energy level');
 assert(p.wound>5&&p.wound<initialWound);
 assert.equal(p.mind.activity,'heal');assert.equal(p.mind.recovering,true);
 assert.equal(a?.kind,'facility');assert.equal(a?.phase,'executing');
 assert.equal(f.session.state.resources.herb,0);
 assert.deepEqual(p.schedule.invitations,{});
});

test('return delivery and bed navigation do not heal or spend treatment herbs before arrival',()=>{
 const f=returned('injured'),start={...person(f).position};
 const deliveredHerb=f.session.state.resources.herb,wound=person(f).wound;
 let navigatingSteps=0;
 until(f,()=>{
  const s=f.session.state,p=person(f),a=s.activitiesById[p.activityId];
  if(a?.phase==='executing')return true;
  if(a?.phase==='navigating')navigatingSteps++;
  assert.equal(p.wound,wound);assert.equal(s.resources.herb,deliveredHerb);
  return false;
 },100);
 const s=f.session.state,p=person(f),a=s.activitiesById[p.activityId];
 assert(navigatingSteps>0,'the fixture must include actual bed navigation');
 assert(Math.hypot(p.position.x-start.x,p.position.y-start.y)>0);
 assert.equal(a.kind,'facility');assert.equal(a.action,'heal');
 assert(slotById(s,a.slotId));
 assert.equal(s.reservationsById[a.reservationId]?.slotId,a.slotId);
 assert(p.wound<wound,'natural recovery begins only after arrival');
 assert.equal(p.mind.workProgress,1);
 assert.equal(s.resources.herb,deliveredHerb,'the first executing step is not an eight-step dose');
});
