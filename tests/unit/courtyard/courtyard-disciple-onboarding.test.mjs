import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {courtyardAdmissionView} from '../../../src/simulation/ea-courtyard-admission.mjs';
import {residentialHousingView} from '../../../src/simulation/ea-residential-housing.mjs';
import {createDiscipleOnboardingScenario,DISCIPLE_ONBOARDING_SCENARIO} from '../../fixtures/disciple-onboarding.mjs';

const identity=p=>({personId:p.personId,id:p.id,name:p.name,appearance:structuredClone(p.appearance),talent:p.talent});
test('an ordinary caller formally joins, walks to the promised bed and autonomously earns a first production contribution',()=>{
 const f=createDiscipleOnboardingScenario(),run=f.session,id=f.candidateId;let s=run.state,p=s.personsById[id];
 const originalIdentity=identity(p),initialSkill=p.mind.skills.industry,initialStocks=structuredClone(s.stockpilesById),initialRng=s.rngState,started=s.worldTick,initialFacts=new Set(Object.keys(s.factsById));
 assert.deepEqual(originalIdentity,f.metadata.identity);assert.equal(p.courtyardVisit.phase,'present');assert.equal(s.homeMemberIds.includes(id),false);assert.equal(s.residentialHousing.recordsByPersonId[id],undefined);
 assert.equal(Object.values(s.factsById).some(x=>x.operation==='production'&&x.participantIds?.includes(id)),false);
 const readBefore=JSON.stringify(s);assert.equal(courtyardAdmissionView(s,id).canAdmit,true);residentialHousingView(s,{personId:id});assert.equal(JSON.stringify(s),readBefore,'preview neither joins nor settles the caller');
 const accepted=commandSect(run,f.admissionRequest);assert.equal(accepted.ok,true,accepted.error);s=run.state;p=s.personsById[id];
 assert.equal(s.worldTick,started);assert.equal(s.rngState,initialRng);assert.deepEqual(s.stockpilesById,initialStocks);assert.deepEqual(identity(p),originalIdentity);
 assert.equal(s.homeMemberIds.filter(x=>x===id).length,1);assert.equal(Object.values(s.personsById).filter(x=>x.personId===id).length,1);
 const membership=structuredClone(s.courtyardAdmissions.recordsByPersonId[id]),pending=structuredClone(s.residentialHousing.recordsByPersonId[id].pending);
 assert.equal(membership.rank,'outer');assert.equal(membership.consentSource,'yunxiu:south-road-seekers');assert.equal(s.factsById[membership.factId].kind,'courtyard-admission');assert.equal(s.residentialHousing.recordsByPersonId[id].home,null);assert(pending?.slotId);
 const firstPosition={...p.position};let arrivedAt=null,arrivalPosition=null,firstContributionAt=null,result=null;
 for(let n=0;n<DISCIPLE_ONBOARDING_SCENARIO.maxWorldSteps;n++){
  if(n%100===0)assert.equal(commandSect(run,{type:'manual'}).ok,true);
  advanceSect(run,.1);s=run.state;p=s.personsById[id];const body=s.activitiesById[p.activityId],residence=s.residentialHousing.recordsByPersonId[id];
  assert.deepEqual(identity(p),originalIdentity);assert.deepEqual(s.courtyardAdmissions.recordsByPersonId[id],membership);
  if(residence.home&&!arrivedAt){
   arrivedAt=s.worldTick;arrivalPosition={...p.position};const slot=slotById(s,pending.slotId),reservation=s.reservationsById[body?.reservationId];
   assert.equal(residence.pending,null);assert.equal(residence.home.slotId,pending.slotId);assert.equal(residence.home.source,'arrived');
   assert.equal(body.kind,'facility');assert.equal(body.action,'rest');assert.equal(body.phase,'executing');assert.equal(body.slotId,pending.slotId);assert.equal(reservation.personId,id);assert.equal(reservation.slotId,pending.slotId);
   assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);assert(Math.hypot(p.position.x-firstPosition.x,p.position.y-firstPosition.y)>1);
  }
  const work=s.workOrdersById['work:production:'+f.buildingIds.industry];
  if(work?.contributions?.[id]>0&&!firstContributionAt){
   firstContributionAt=s.worldTick;assert(arrivedAt,'this configured tired caller reaches the bed before contributing');assert(firstContributionAt>arrivedAt);
   assert.equal(body.action,'work');assert.equal(body.phase,'executing');const slot=slotById(s,body.slotId);assert.equal(slot.buildingId,s.buildingsById[f.buildingIds.industry].id);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);
  }
  result=Object.values(s.factsById).find(x=>!initialFacts.has(x.id)&&x.operation==='production'&&x.participantIds?.includes(id));if(result)break;
 }
 assert(arrivedAt);assert(arrivalPosition);assert(firstContributionAt);assert(result,'bounded real ticks settle the caller\'s first batch');
 assert(result.atTick>=firstContributionAt);assert(result.atTick>membership.admittedAtTick);assert.equal(result.workOrderId,'work:production:'+f.buildingIds.industry);assert.equal(result.targetStockpileId,'stockpile:'+f.buildingIds.industry);assert(result.grossOutput.wood>0);assert.equal(result.participantSkills[id],initialSkill);assert(p.mind.skills.industry>initialSkill);
 assert(s.stockpilesById[result.targetStockpileId].resources.wood>initialStocks[result.targetStockpileId].resources.wood);assert.equal(p.mind.activity,'work');assert.match(p.mind.reason,/百工经验/);
 assert.equal(s.homeMemberIds.filter(x=>x===id).length,1);assert.equal(Object.values(s.factsById).filter(x=>x.kind==='courtyard-admission'&&x.personId===id).length,1);assert.equal(validateSect(run),true);
});
