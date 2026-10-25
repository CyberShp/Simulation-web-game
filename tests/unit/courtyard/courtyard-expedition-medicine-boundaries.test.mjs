import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {day} from '../../../src/simulation/ea-data.mjs';
import {consumePill} from '../../../src/simulation/ea-sim.mjs';
import {availablePills,carriedStockpile} from '../../../src/simulation/ea-sr-economy.mjs';
import {discipleExpeditionsView} from '../../../src/simulation/ea-disciple-expeditions.mjs';
import {createExpeditionMedicineScenario} from '../../fixtures/expedition-medicine.mjs';

const person=f=>f.session.state.personsById[f.travellerId];
const trip=f=>f.session.state.discipleExpeditions.journeys[0];
const home=f=>f.session.state.stockpilesById[f.homeStockpileId].pills.heal;
const carried=f=>f.session.state.stockpilesById[f.carryStockpileId]?.pills?.heal||0;
function until(f,predicate,limit=5000){
 for(let n=0;n<limit;n++){
  if(n%100===0){const r=commandSect(f.session,{type:'manual'});assert(r.ok,r.error);}
  advanceSect(f.session,.1);if(predicate())return;
 }
 assert.fail('the bounded official medicine journey did not reach its required state');
}
const medicineFact=(f,suffix)=>f.session.state.factsById[`fact:disciple:${trip(f).id}:medicine-${suffix}`];

test('personal medicine needs no public permission and unused personal stock is not confiscated',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-safe'}),s=f.session.state;
 carriedStockpile(s,f.travellerId);s.stockpilesById[f.carryStockpileId].pills.heal=1;
 s.doctrine.pillRule='permission';person(f).mind.pillPermitDay=-1;validateSect(f.session);
 until(f,()=>trip(f)?.phase==='returned');
 assert.equal(trip(f).medicine.source,'personal');assert.equal(trip(f).medicine.borrowed,0);
 assert.equal(trip(f).medicine.returned,0);assert.equal(carried(f),1);assert.equal(home(f),1);
 assert.equal(medicineFact(f,'pickup'),undefined);assert.equal(medicineFact(f,'return'),undefined);
 assert.equal(medicineFact(f,'use'),undefined);validateSect(f.session);
 // A completed trip is historical evidence, not a perpetual reservation of
 // the unused private dose. Later legitimate consumption must remain valid.
 person(f).wound=10;consumePill(f.session.state,'heal',person(f),{silent:true});
 assert.equal(carried(f),0);assert.equal(home(f),1);assert.equal(person(f).wound,0);
 validateSect(f.session);
});

test('a traveller who already took medicine today cannot take a second dose after retreating',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-contact'}),s=f.session.state,today=day(s);
 person(f).mind.lastPillDay=today;const consumed=s.stats.consumed;
 until(f,()=>!!trip(f).encounter,10);assert(person(f).wound>5);
 let safeTicks=0;
 until(f,()=>{
  const p=person(f),last=trip(f).encounter.lastPosition;
  assert.equal(day(f.session.state),today,'this boundary must remain in the same day');
  if(p.location?.kind==='local'&&p.location.sceneId===last.sceneId&&Math.hypot(p.location.x-last.x,p.location.y-last.y)>6)safeTicks++;
  return safeTicks>=25;
 },150);
 assert.equal(medicineFact(f,'use'),undefined);assert.equal(carried(f),1);assert.equal(home(f),0);
 assert.equal(person(f).mind.lastPillDay,today);assert.equal(f.session.state.stats.consumed,consumed);
 assert(person(f).wound>5);validateSect(f.session);
});

test('world travel cannot use the carried dose or fetch another dose from the public vault',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-safe'});
 until(f,()=>trip(f)?.phase==='outbound',500);
 person(f).wound=10;const carriedBefore=carried(f),homeBefore=home(f);assert.equal(carriedBefore,1);
 for(let n=0;n<5;n++)advanceSect(f.session,.1);
 assert.equal(trip(f).phase,'outbound');assert.equal(person(f).position.kind,'worldTravel');
 assert.equal(availablePills(f.session.state,f.travellerId,'heal'),0);
 assert.equal(person(f).wound,10);assert.equal(carried(f),carriedBefore);assert.equal(home(f),homeBefore);
 assert.equal(medicineFact(f,'use'),undefined);validateSect(f.session);
});

test('a lethal real encounter leaves the finite dose with the dead traveller and cannot revive them',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-contact'});person(f).wound=95;
 const consumed=f.session.state.stats.consumed;assert.equal(carried(f),1);
 const preparation=discipleExpeditionsView(f.session.state).journeys[0].preparation;
 until(f,()=>person(f).lifeStatus==='dead',10);
 const deathFact=person(f).deathFactId;assert(deathFact);assert(f.session.state.factsById[deathFact]);
 for(let n=0;n<25;n++)advanceSect(f.session,.1);
 assert.equal(person(f).lifeStatus,'dead');assert.equal(person(f).deathFactId,deathFact);assert.equal(trip(f).phase,'dead');
 assert.equal(carried(f),1);assert.equal(home(f),0);assert.equal(medicineFact(f,'use'),undefined);
 assert.equal(medicineFact(f,'return'),undefined);assert.equal(f.session.state.stats.consumed,consumed);
 const publicJourney=discipleExpeditionsView(f.session.state).journeys[0];
 assert.deepEqual(publicJourney.preparation,preparation,'an unreported death cannot rewrite the departure briefing');
 assert.equal(publicJourney.report,null);
 validateSect(f.session);
});

test('an old journey without the optional medicine record neither borrows nor silently adds one',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-safe'});
 until(f,()=>!!trip(f),10);
 // U-172 legacy shape before any medicine pickup, use, or return outcome.
 delete trip(f).medicine;validateSect(f.session);
 until(f,()=>trip(f).phase==='returned');
 assert(!Object.hasOwn(trip(f),'medicine'));assert.equal(home(f),1);assert.equal(carried(f),0);
 for(const suffix of ['pickup','use','return'])assert.equal(medicineFact(f,suffix),undefined);
 validateSect(f.session);
});

test('a medicine transaction cannot be orphaned by deleting its journey medicine record',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-contact'});
 assert(medicineFact(f,'pickup'));assert.equal(carried(f),1);
 delete trip(f).medicine;
 assert.throws(()=>validateSect(f.session),/携药|药物|领用|medicine/);
});
