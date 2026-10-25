import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {advanceExpeditionMedicine,prepareExpeditionMedicine,validateExpeditionMedicine} from '../../../src/simulation/ea-disciple-expedition-medicine.mjs';
import {transferExpeditionMedicine} from '../../../src/simulation/ea-sr-economy.mjs';
import {discipleExpeditionsView} from '../../../src/simulation/ea-disciple-expeditions.mjs';
import {createExpeditionMedicineScenario,EXPEDITION_MEDICINE_SCENARIO} from '../../fixtures/expedition-medicine.mjs';
function step(f,n=0){if(n%100===0)assert.equal(commandSect(f.session,{type:'manual'}).ok,true);advanceSect(f.session,.1);return f.session.state;}
const quantities=(s,f)=>({home:s.stockpilesById[f.homeStockpileId].pills.heal,bag:s.stockpilesById[f.carryStockpileId]?.pills?.heal||0});

test('a real expedition carries one authorized dose and uses it only after retreating to safety for twenty world ticks',()=>{
 const f=createExpeditionMedicineScenario(),j=f.s.discipleExpeditions.journeys[0];let s=f.s,p=s.personsById[f.travellerId];
 assert.equal(j.medicine.source,'public');assert.deepEqual(quantities(s,f),{home:0,bag:1});const pickup=s.factsById[j.medicine.pickupFactId];assert.equal(pickup.quantity,1);assert.equal(pickup.targetStockpileId,f.carryStockpileId);const initialReason=j.medicine.reason;
 let useStart,consumed,injurySeen=false,finished=false;
 for(let n=0;n<EXPEDITION_MEDICINE_SCENARIO.maxWorldSteps;n++){
  s=step(f,n);p=s.personsById[f.travellerId];const trip=s.discipleExpeditions.journeys[0],m=trip.medicine,u=m.use;
  if(p.wound>5)injurySeen=true;
  assert.equal(m.reason,initialReason);assert.equal(discipleExpeditionsView(s).journeys[0].preparation.at(-1),initialReason);
  if(u?.status==='preparing'){
   assert.equal(trip.phase,'valley-return');assert(Math.hypot(p.location.x-trip.encounter.lastPosition.x,p.location.y-trip.encounter.lastPosition.y)>6);
   useStart??={tick:u.startedTick,position:{...p.location},wound:p.wound,energy:p.energy};assert.deepEqual(p.location,useStart.position);assert.equal(p.wound,useStart.wound);assert.equal(s.stockpilesById[f.carryStockpileId].pills.heal,1);assert.equal(s.factsById[`fact:disciple:${trip.id}:medicine-use`],undefined);
   const progress=u.progressTicks,before=JSON.stringify(s);assert.equal(advanceExpeditionMedicine(s,p,trip),true);assert.equal(u.progressTicks,progress);assert.equal(JSON.stringify(s),before,'same-world-tick retry cannot add another use step');
  }
  if(u?.status==='consumed'&&!consumed){
   consumed=structuredClone(u);assert.equal(u.completedTick-u.startedTick,19);const fact=s.factsById[u.factId],a=s.srEconomy.pillAllocations[u.allocationId];assert.equal(fact.before.wound,10);assert.equal(fact.after.wound,0);assert.equal(fact.after.energy,Math.min(100,fact.before.energy+15));assert.equal(p.wound,0);assert.deepEqual(quantities(s,f),{home:0,bag:0});assert.equal(a.phase,'consumed');assert.deepEqual(a.parts,[{stockpileId:f.carryStockpileId,quantity:1}]);
  }
  if(consumed)assert(!['scouting','exploring'].includes(trip.phase),'treatment does not start a second adventure');
  if(trip.phase==='returned'){finished=true;assert.equal(trip.medicine.returned,0);assert.match(trip.report,/实际服药1份/);break;}
 }
 assert(injurySeen);assert(useStart);assert(consumed);assert(finished);assert.equal(validateSect(f.session),true);
 const trip=s.discipleExpeditions.journeys[0],bad=structuredClone(s);assert.match(trip.report,/主动撤回/);assert.doesNotMatch(trip.report,/正在撤离/);const mismatched=structuredClone(s);mismatched.discipleExpeditions.journeys[0].medicine.use.status='cancelled';assert.throws(()=>validateExpeditionMedicine(mismatched,mismatched.discipleExpeditions.journeys[0],m=>{throw Error(m);}),/用药状态/);delete bad.factsById[trip.medicine.use.factId];assert.throws(()=>validateExpeditionMedicine(bad,bad.discipleExpeditions.journeys[0],m=>{throw Error(m);}),/用药/);
});

test('an uninjured traveller never eats the dose and physically returns the unused public medicine at the original store',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-safe'});let s=f.s,j,loaded=false;
 for(let n=0;n<EXPEDITION_MEDICINE_SCENARIO.maxWorldSteps;n++){
  s=step(f,n);j=s.discipleExpeditions.journeys[0];if(!j)continue;
  if(j.medicine.status==='carried'){loaded=true;assert.deepEqual(quantities(s,f),{home:0,bag:1});assert.equal(j.medicine.use,undefined);}
  if(j.phase==='returned')break;
 }
 assert(loaded);assert.equal(j.phase,'returned');assert.equal(j.medicine.use,undefined);assert.equal(j.medicine.returned,1);assert.deepEqual(quantities(s,f),{home:1,bag:0});
 const fact=s.factsById[j.medicine.returnFactId],home=s.stockpilesById[f.homeStockpileId];assert.equal(fact.sourceStockpileId,f.carryStockpileId);assert.equal(fact.targetStockpileId,f.homeStockpileId);assert(Math.hypot(fact.position.x-home.position.x,fact.position.y-home.position.y)<=1.5);assert.equal(Object.values(s.factsById).filter(x=>x.journeyId===j.id&&x.operation==='expedition-medicine-return').length,1);assert.equal(validateSect(f.session),true);
});

test('the pickup API requires this exact journey body, physical access and real free bag capacity',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-safe'});let s=step(f),j=s.discipleExpeditions.journeys[0],p=s.personsById[f.travellerId];
 for(const condition of ['other-body','far','permission','capacity']){
  const clone=structuredClone(s),q=clone.personsById[p.personId],trip=clone.discipleExpeditions.journeys[0];
  if(condition==='other-body')clone.activitiesById[q.activityId].id='activity:sr:disciple-expedition:other';
  if(condition==='far'){q.mind.scenic.x+=5;q.position.x+=5;}
  if(condition==='permission'){clone.doctrine.pillRule='permission';q.mind.pillPermitDay=-1;}
  if(condition==='capacity')clone.stockpilesById[f.carryStockpileId]={id:f.carryStockpileId,ownerId:p.personId,custodianId:p.personId,carrierId:p.personId,access:'private',capacity:0,position:{...q.position},resources:{},pills:{heal:0}};
  const before=JSON.stringify(clone);assert.equal(transferExpeditionMedicine(clone,trip.id,'pickup').quantity,0,condition);assert.equal(JSON.stringify(clone),before,condition+' fails without changing inventory or making a new carrier');
 }
 prepareExpeditionMedicine(s,p,j);assert.equal(j.medicine.status,'carried');assert.deepEqual(quantities(s,f),{home:0,bag:1});const before=JSON.stringify(s);prepareExpeditionMedicine(s,p,j);assert.equal(JSON.stringify(s),before);
});

test('an interrupted departure keeps its unused borrowed medicine on the actual person when away from the store',()=>{
 const f=createExpeditionMedicineScenario({condition:'medicine-safe'});let s=f.s,j,p;
 for(let n=0;n<1000;n++){
  s=step(f,n);j=s.discipleExpeditions.journeys[0];p=s.personsById[f.travellerId];const home=s.stockpilesById[f.homeStockpileId];
  if(j?.phase==='approach'&&Math.hypot(p.position.x-home.position.x,p.position.y-home.position.y)>2){p.mind.scenic.path=[];break;}
 }
 assert.equal(j.phase,'approach');s=step(f);j=s.discipleExpeditions.journeys[0];assert.equal(j.phase,'cancelled');assert.equal(j.medicine.status,'retained');assert.equal(j.medicine.borrowed,1);assert.equal(j.medicine.returned,0);assert.deepEqual(quantities(s,f),{home:0,bag:1});assert.equal(validateSect(f.session),true);
});
