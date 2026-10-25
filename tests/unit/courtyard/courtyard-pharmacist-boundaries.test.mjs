import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {pharmacistProgress,craftAvailabilityForPerson} from '../../../src/simulation/ea-sr-economy.mjs';
import {discipleDevelopmentView} from '../../../src/simulation/ea-disciple-development.mjs';
import {createPharmacistDevelopmentScenario} from '../../fixtures/pharmacist-development.mjs';

const person=f=>f.session.state.personsById[f.pharmacistId];
const orders=f=>Object.values(f.session.state.workOrdersById).filter(w=>w.kind==='sr-crafting');
function enable(f){const r=commandSect(f.session,{type:'medicine-supply',enabled:true,target:2});assert(r.ok,r.error);}
function steps(f,n){for(let i=0;i<n;i++){if(i%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);}}
function until(f,predicate,limit=7000){for(let n=0;n<limit;n++){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);if(predicate())return;}assert.fail('the bounded pharmacist scene did not reach the actual outcome');}

test('one actual completed batch caps medicine growth and does not teach unknown alchemy',()=>{
 const f=createPharmacistDevelopmentScenario({condition:'growth'});person(f).mind.skills.medicine=99.8;person(f).mind.knowledge.alchemy=0;
 enable(f);until(f,()=>orders(f).some(w=>w.phase==='completed'));
 const w=orders(f).find(w=>w.phase==='completed'),fact=f.session.state.factsById[w.resultFactId];
 assert.equal(fact.actorId,f.pharmacistId);assert.equal(fact.growth.personId,f.pharmacistId);
 assert.equal(fact.growth.medicine.before,99.8);assert.equal(fact.growth.medicine.after,100);
 assert.equal(fact.growth.alchemy.before,0);assert.equal(fact.growth.alchemy.after,0);assert.equal(fact.growth.alchemy.gain,0);
 const before=JSON.stringify(f.session.state);for(let n=0;n<5;n++){pharmacistProgress(f.session.state,f.pharmacistId);discipleDevelopmentView(f.session.state);}
 assert.equal(JSON.stringify(f.session.state),before);
 steps(f,40);assert.equal(person(f).mind.skills.medicine,100);assert.equal(person(f).mind.knowledge.alchemy,0);
 assert.deepEqual(f.session.state.factsById[w.resultFactId].growth,fact.growth);assert.equal(orders(f).length,1);validateSect(f.session);
});

test('a severe half-batch injury cancels the original owner without growth and cannot refill consumed material',()=>{
 const f=createPharmacistDevelopmentScenario({condition:'growth'}),s=f.session.state;
 Object.assign(s.stockpilesById[f.siteStockpileId].resources,{herb:10,cleanWater:2,wood:1,crystal:0});
 Object.assign(s.stockpilesById[f.sourceStockpileId].resources,{herb:0,cleanWater:0,wood:0});
 enable(f);until(f,()=>orders(f).some(w=>w.process?.stageIndex===0&&w.process.stageProgressTicks===10));
 const w=orders(f)[0],id=w.id,initial=person(f).mind.skills.medicine,knowledge=person(f).mind.knowledge.alchemy,choice=structuredClone(f.session.state.factsById[w.choiceFactId]);
 person(f).wound=30;advanceSect(f.session,.1);
 const cancelled=f.session.state.workOrdersById[id];assert.equal(cancelled.phase,'cancelled');assert.equal(cancelled.personId,f.pharmacistId);
 assert.equal(cancelled.consumed.herb,5);assert.equal(cancelled.refund.herb,5);
 assert.equal(f.session.state.stockpilesById[f.siteStockpileId].resources.herb,5);
 assert.equal(f.session.state.medicineSupply.lastInterruption.workOrderId,id);
 assert.equal(f.session.state.factsById[`fact:craft:${id}`],undefined);assert.deepEqual(f.session.state.factsById[w.choiceFactId],choice);
 steps(f,120);assert.equal(orders(f).length,1,'half a refunded recipe cannot fund a fresh whole batch');
 assert.equal(person(f).mind.skills.medicine,initial);assert.equal(person(f).mind.knowledge.alchemy,knowledge);
 const quote=craftAvailabilityForPerson(f.session.state,'heal',f.replacementId,{buildingId:f.buildingId});
 assert.equal(quote.available,false);assert(quote.reasons.some(r=>/灵草需10/.test(r)));validateSect(f.session);
});

test('a temporarily closed furnace preserves paid progress and grants no completion growth',()=>{
 const f=createPharmacistDevelopmentScenario({condition:'growth'});enable(f);
 until(f,()=>orders(f).some(w=>w.progressTicks>=10));
 const w=orders(f)[0],id=w.id,progress=w.progressTicks,skill=person(f).mind.skills.medicine,knowledge=person(f).mind.knowledge.alchemy;
 f.session.state.buildingsById[f.buildingId].enabled=false;steps(f,25);
 const paused=f.session.state.workOrdersById[id];assert.equal(paused.phase,'active');assert.equal(paused.progressTicks,progress);
 assert(f.session.state.reservationsById[paused.reservationId]);assert(f.session.state.reservationsById[paused.slotReservationId]);
 assert.equal(f.session.state.medicineSupply.lastInterruption,undefined);assert.equal(f.session.state.factsById[`fact:craft-cancel:${id}`],undefined);
 assert.equal(person(f).mind.skills.medicine,skill);assert.equal(person(f).mind.knowledge.alchemy,knowledge);
 f.session.state.buildingsById[f.buildingId].enabled=true;
 until(f,()=>f.session.state.workOrdersById[id].phase==='completed');
 assert.equal(orders(f).length,1);assert(f.session.state.factsById[`fact:craft:${id}`].growth);validateSect(f.session);
});

test('pharmacist progress retains original recipe requirements and hides undisclosed knowledge even nearby',()=>{
 const f=createPharmacistDevelopmentScenario({condition:'growth'}),s=f.session.state,p=person(f);
 p.mind.skills.medicine=100;
 const foundation=()=>pharmacistProgress(s,p.personId).recipes.find(r=>r.recipeId==='foundation');
 assert.equal(foundation().qualified,false,'medical expertise does not replace alchemy understanding35');
 p.mind.knowledge.alchemy=35;assert.equal(foundation().qualified,true);
 p.realm=8;assert.equal(foundation().qualified,false);p.realm=9;
 s.doctrine.books=s.doctrine.books.filter(id=>id!=='foundation');assert.equal(foundation().qualified,false);s.doctrine.books.push('foundation');
 Object.assign(s.master.scenic,{x:p.position.x+.8,y:p.position.y,path:[],goal:null});s.master.position={...p.position,x:p.position.x+.8};
 let member=discipleDevelopmentView(s).members.find(x=>x.personId===p.personId);assert(member.contact.available);assert(member.pharmacist);
 // U-172 legal pre-existing private-study record, with the ordinary source link.
 const secret={id:s.society.nextIncidentId++,discipleId:p.id,kind:'book',subject:'alchemy',time:s.society.clock,discovered:false,discoveredAt:null,handled:false,outcome:null,evidenceProgress:0,motive:'已存在的私下研习。',restitution:12};
 s.society.secrets.push(secret);p.mind.hiddenKnowledge.alchemy=secret.id;s.incidentId=s.society.nextIncidentId;validateSect(f.session);
 const before=JSON.stringify(s);member=discipleDevelopmentView(s).members.find(x=>x.personId===p.personId);
 assert(member.contact.available);assert.equal(member.pharmacist,null);assert(!member.knowledge.some(x=>x.techniqueId==='alchemy'));
 assert.equal(JSON.stringify(s),before);
});
