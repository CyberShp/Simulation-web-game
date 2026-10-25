import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect} from '../../../apps/courtyard/sect-sim.mjs';
import {validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {AUTONOMY_V2,prepareAutonomyV2} from '../../../src/simulation/ea-sr-persons.mjs';
import {createWorkSpecializationScenario} from '../../fixtures/work-specialization.mjs';

// U-172: configure eligible jobs and skill profiles only; the official session
// clock and command gateway must produce the choices and invitations below.
function decide(f,ids=f.people.map(p=>p.personId)){
 const initial=new Map(ids.map(id=>[id,f.session.state.personsById[id].mind.lastDecision]));
 for(let n=0;n<50;n++){
  advanceSect(f.session,.1);
  if(ids.every(id=>f.session.state.personsById[id].mind.lastDecision>initial.get(id)))return;
 }
 assert.fail('no actual autonomous decision within50 world steps');
}
function v2Fixture(){
 const f=createWorkSpecializationScenario();
 // This prepares a legal v2 fixture, not a save/reopen acceptance chain.
 f.session.state=prepareAutonomyV2(f.session.state,validateSave);
 return f;
}

test('maximum different expertise stays a soft preference: a novice may choose the focused legal job',()=>{
 const f=createWorkSpecializationScenario(),id=f.people[0].personId,s=f.session.state,p=s.personsById[id];
 p.mind.skills.plant=0;p.mind.skills.industry=100;s.doctrine.workFocus='herb';
 const resources=structuredClone(s.resources),realm=p.realm;
 decide(f,[id]);const chosen=f.session.state.personsById[id];
 assert.equal(chosen.mind.activity,'work');assert.equal(chosen.job,s.buildingsById[f.buildingIds.plant].id);
 assert.equal(chosen.mind.skills.plant,0,'expertise is not a work qualification');
 assert.equal(chosen.realm,realm);assert.deepEqual(f.session.state.resources,resources,'choosing a job creates no goods or realm growth');
 assert.match(chosen.mind.reason,/响应公开差事/);assert.doesNotMatch(chosen.mind.reason,/已有灵植经验/);
});

test('v2 specialists without an accepted invitation do not acquire work through the v1 scorer',()=>{
 const f=v2Fixture();decide(f);
 for(const entry of f.people){const p=f.session.state.personsById[entry.personId];
  assert.equal(p.schedule.definitionId,AUTONOMY_V2.version);
  assert.deepEqual(p.schedule.invitations,{});assert.deepEqual(p.schedule.commitmentsById,{});
  assert.notEqual(p.mind.activity,'work');assert.doesNotMatch(p.mind.reason,/已有(?:灵植|百工)经验/);
 }
});

test('an existing formal v2 invitation still starts and preserves accepted work',()=>{
 const f=v2Fixture(),id=f.people[0].personId,buildingId=f.buildingIds.plant;
 const reply=commandSect(f.session,{type:'invite-work',personId:id,buildingId});
 assert(reply.ok,reply.error);assert.equal(reply.result.accepted,true);
 for(let n=0;n<20;n++)advanceSect(f.session,.1);
 const s=f.session.state,p=s.personsById[id];assert.equal(p.schedule.definitionId,AUTONOMY_V2.version);
 assert.equal(p.mind.activity,'work');assert.equal(p.job,s.buildingsById[buildingId].id);
 assert(Object.values(p.schedule.commitmentsById).some(c=>c.status==='active'&&c.targetId===buildingId));
});
