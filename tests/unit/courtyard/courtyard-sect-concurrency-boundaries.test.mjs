import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectConcurrencyScenario} from '../../fixtures/sect-concurrency.mjs';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {requestAutonomousCraft,cancelPersonCraftSR} from '../../../src/simulation/ea-sr-economy.mjs';
import {advanceMedicineSupply,medicineSupplyView} from '../../../src/simulation/ea-medicine-supply.mjs';

function fixture(){
 const f=createSectConcurrencyScenario({memberCount:3});
 assert.equal(commandSect(f.session,{type:'disciple-expeditions',enabled:false}).ok,true);
 // Two finite recipes isolate station contention from an unrelated shortage.
 Object.assign(f.session.state.stockpilesById[f.siteStockpileId].resources,{herb:20,cleanWater:4,wood:2});
 return f;
}
function begin(f){
 const s=f.session.state,r=requestAutonomousCraft(s,f.pharmacistId,'heal',{buildingId:f.buildingId});
 assert.equal(r.accepted,true,r.reason);return s.workOrdersById[r.id];
}
const crafts=s=>Object.values(s.workOrdersById).filter(w=>w.kind==='sr-crafting');

test('another willing resident cannot take an occupied furnace or alter its real reservations',()=>{
 const f=fixture(),w=begin(f),s=f.session.state;
 assert.equal(s.personsById[f.pharmacistId].activityId,w.activityId);
 const before=JSON.stringify(s),r=requestAutonomousCraft(s,f.travellerId,'heal',{buildingId:f.buildingId});
 assert.equal(r.accepted,false);assert.match(r.reason,/工位.*预约/);
 assert.equal(JSON.stringify(s),before,'refusal does not take materials, a station or another body');
 assert.equal(s.reservationsById[w.slotReservationId].personId,f.pharmacistId);
 assert.equal(s.reservationsById[w.reservationId].workOrderId,w.id);
 assert.equal(validateSect(f.session),true);
});

test('existing public medicine and a real pending batch cover the target without duplicate work or read-side production',()=>{
 const f=fixture(),w=begin(f);
 for(let n=0;n<60;n++)advanceSect(f.session,.1);
 const s=f.session.state,v=medicineSupplyView(s);
 assert.equal(v.home,1);assert.equal(v.pending,2);assert.equal(v.committed,3);
 assert.equal(s.workOrdersById[w.id].phase,'active');assert.equal(crafts(s).length,1);
 assert.equal(s.medicineSupply.active,null,'the policy does not create a duplicate batch over existing work');
 const before=JSON.stringify(s);
 for(let n=0;n<5;n++){medicineSupplyView(s);advanceMedicineSupply(s);}
 assert.equal(JSON.stringify(s),before,'same-tick scheduling and projections cannot produce or reserve again');
 assert.equal(validateSect(f.session),true);
});

test('cancelling one pharmacist keeps a concurrently executing cultivator and the master unchanged',()=>{
 const f=fixture(),w=begin(f);let s,p,a;
 for(let n=0;n<300;n++){
  advanceSect(f.session,.1);s=f.session.state;p=s.personsById[f.cultivatorId];a=s.activitiesById[p.activityId];
  if(a?.action==='cultivate'&&a.phase==='executing'&&p.xp>0)break;
 }
 assert.equal(a?.action,'cultivate');assert.equal(a.phase,'executing');assert(p.xp>0);
 assert.equal(s.workOrdersById[w.id].phase,'active');
 const ownBody=structuredClone({person:p,activity:a,reservation:s.reservationsById[a.reservationId]});
 const master=JSON.stringify(s.master),commit=p.mind.commitUntil;
 assert(commit>s.time);assert.equal(ownBody.reservation.personId,p.personId);
 cancelPersonCraftSR(s,f.pharmacistId);
 assert.deepEqual({person:p,activity:s.activitiesById[p.activityId],reservation:s.reservationsById[a.reservationId]},ownBody);
 assert.equal(JSON.stringify(s.master),master);
 assert.equal(s.workOrdersById[w.id].phase,'cancelled');assert.equal(s.factsById[`fact:craft:${w.id}`],undefined);
 assert.equal(Object.values(s.activitiesById).filter(x=>x.personId===p.personId).length,1);
 assert.equal(validateSect(f.session),true);
});
