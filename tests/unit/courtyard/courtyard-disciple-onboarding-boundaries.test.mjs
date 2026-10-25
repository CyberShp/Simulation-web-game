import test from 'node:test';
import assert from 'node:assert/strict';
import {commandSect} from '../../../apps/courtyard/sect-sim.mjs';
import {createDiscipleOnboardingScenario} from '../../fixtures/disciple-onboarding.mjs';

const snapshot=f=>JSON.stringify(f.session.state);
const housing=f=>f.session.state.residentialHousing?.recordsByPersonId[f.candidateId];
const answers=f=>f.session.state.courtyardSeekers.recordsByPersonId[f.candidateId].visits.at(-1).answers;
function notAdmitted(f){
 const s=f.session.state;
 assert(!s.homeMemberIds.includes(f.candidateId));
 assert.equal(s.courtyardAdmissions?.recordsByPersonId[f.candidateId],undefined);
 assert(!housing(f)?.pending);assert(!housing(f)?.home);
 assert(!Object.values(s.factsById).some(v=>v.kind==='courtyard-admission'&&v.personId===f.candidateId));
}

for(const [condition,reason] of [['no-bed',/床|居所|安置/],['no-food',/食粮|口粮/]]){
 test(condition+': admission rejects without changing the committed world',()=>{
  const f=createDiscipleOnboardingScenario({condition});notAdmitted(f);
  const before=snapshot(f),reply=commandSect(f.session,f.admissionRequest);
  assert.equal(reply.ok,false);assert.match(reply.error,reason);
  assert.equal(snapshot(f),before,'hard admission failure must discard the entire command draft');
  assert.equal(answers(f).length,0,'missing living conditions do not manufacture an NPC answer');
  notAdmitted(f);
 });
}

test('a personal refusal is recorded once and repeating unchanged conditions reserves no bed',()=>{
 const f=createDiscipleOnboardingScenario({condition:'unwilling'});notAdmitted(f);
 const initial=f.session.state,resources=structuredClone(initial.resources),rng=initial.rngState,tick=initial.worldTick;
 const reply=commandSect(f.session,f.admissionRequest);
 assert.equal(reply.ok,false);assert.equal(reply.refused,true);assert.equal(reply.result.accepted,false);
 assert.equal(answers(f).length,1);assert.equal(answers(f)[0].type,'npc-decline');
 notAdmitted(f);
 const recorded=structuredClone(answers(f)),relationships=structuredClone(f.session.state.personsById[f.candidateId].mind.relationships);
 const repeated=commandSect(f.session,f.admissionRequest);
 assert.equal(repeated.refused,true);assert.deepEqual(repeated.result,reply.result);
 assert.deepEqual(answers(f),recorded);assert.deepEqual(f.session.state.personsById[f.candidateId].mind.relationships,relationships);
 assert.deepEqual(f.session.state.resources,resources);assert.equal(f.session.state.rngState,rng);assert.equal(f.session.state.worldTick,tick);
 notAdmitted(f);
});

test('a second admission request cannot duplicate membership, consent, or the promised bed',()=>{
 const f=createDiscipleOnboardingScenario({condition:'ready'});notAdmitted(f);
 const reply=commandSect(f.session,f.admissionRequest);assert.equal(reply.ok,true,reply.error);
 assert.equal(reply.result.accepted,true);
 const s=f.session.state,record=s.courtyardAdmissions.recordsByPersonId[f.candidateId];
 assert.equal(s.homeMemberIds.filter(id=>id===f.candidateId).length,1);
 assert.equal(Object.values(s.factsById).filter(v=>v.kind==='courtyard-admission'&&v.personId===f.candidateId).length,1);
 assert.equal(answers(f).filter(v=>v.type==='npc-accept').length,1);
 assert(housing(f)?.pending?.slotId,'acceptance promises an actual bed');assert.equal(housing(f).home,null,'a command does not imply physical arrival');
 assert.equal(s.factsById[record.factId].personId,f.candidateId);
 const committed=snapshot(f),duplicate=commandSect(f.session,f.admissionRequest);
 assert.equal(duplicate.ok,false);assert.match(duplicate.error,/名册|收录/);
 assert.equal(snapshot(f),committed,'a new duplicate request changes no committed fact');
});
