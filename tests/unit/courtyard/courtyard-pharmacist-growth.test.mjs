import test from 'node:test';
import assert from 'node:assert/strict';
import {createMedicineSupplyScenario} from '../../fixtures/medicine-supply.mjs';
import {validateSect,advanceSect} from '../../../apps/courtyard/sect-sim.mjs';
import {craftSR,craftAvailabilityForPerson,requestAutonomousCraft,pharmacistProgress,tickEconomy,validateEconomy} from '../../../src/simulation/ea-sr-economy.mjs';
import {facilitySlots,slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';

// U-172: completed GC26, finite ingredients, known drug theory and initial
// location are configured. Every stage, receipt and growth uses actual ticks.
function fixture({master=false}={}){
 const f=createMedicineSupplyScenario(),{s}=f,b=s.buildingsById[f.buildingId],p=master?s.master:s.personsById[f.workerId],m=master?p:p.mind;
 p.realm=9;m.skills??={};m.skills.medicine=12;m.knowledge.alchemy=34.5;
 if(!s.doctrine.books.includes('foundation'))s.doctrine.books.push('foundation');
 Object.assign(s.stockpilesById[f.siteStockpileId].resources,{herb:85,cleanWater:8,wood:5,crystal:12});Object.assign(s.resources,{jade:300,insight:15});
 const slot=facilitySlots(s,b,'work').find(x=>x.id.endsWith('slot:work:herb:1'));
 assert(slot);Object.assign(m.scenic,{...slot.position,path:[],goal:null,revision:geometryRevision(s)});
 p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',...slot.position};p.location={kind:'local',sceneId:'scene:yunxiu-courtyard',...slot.position};
 validateSect(f.session);return{...f,p,m};
}
function step(s){s.worldTick++;tickEconomy(s);}
function complete(s,p,w,max=2500,stepper=()=>step(s)){
 for(let i=0;i<max&&w.phase==='active';i++){
  const progress=w.progressTicks;stepper();
  if(w.progressTicks>progress){assert.equal(w.progressTicks,progress+1);const slot=slotById(s,s.activitiesById[p.activityId]?.slotId||w.process?.completedStages.at(-1)?.slotId||`${w.targetId}/slot:work:1`);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);}
 }
 assert.equal(w.phase,'completed','real stages must complete within bound');
}
const qualifies=(s,p,id)=>pharmacistProgress(s,p.personId).recipes.find(r=>r.recipeId===id).qualified;

test('real four-stage completion grows the actor and unlocks existing foundation qualification before an actual advanced batch',()=>{
 const {s,p,m,buildingId,siteStockpileId}=fixture();assert.equal(qualifies(s,p,'foundation'),false);
 const before=JSON.stringify(s);assert.equal(pharmacistProgress(s,p.personId).lastCompletion,null);assert.equal(JSON.stringify(s),before);
 const r=requestAutonomousCraft(s,p.personId,'heal',{buildingId});assert.equal(r.accepted,true,r.reason);const w=s.workOrdersById[r.id];
 for(let i=0;i<1600&&w.progressTicks<279;i++)step(s);assert.equal(w.progressTicks,279);assert.equal(m.skills.medicine,12);assert.equal(m.knowledge.alchemy,34.5);assert.equal(s.factsById[`fact:craft:${w.id}`],undefined);
 complete(s,p,w);const fact=s.factsById[w.resultFactId];assert.equal(w.progressTicks,280);assert.equal(s.stockpilesById[siteStockpileId].pills.heal,2);
 assert.equal(m.skills.medicine,12.6);assert.equal(m.knowledge.alchemy,35.1);assert.equal(fact.growth.personId,p.personId);assert.deepEqual(fact.growth.medicine,{before:12,after:12.6,gain:12.6-12});
 assert.equal(qualifies(s,p,'foundation'),true);assert.equal(craftAvailabilityForPerson(s,'foundation',p.personId,{buildingId}).available,true);
 const advanced=requestAutonomousCraft(s,p.personId,'foundation',{buildingId});assert.equal(advanced.accepted,true,advanced.reason);const next=s.workOrdersById[advanced.id];complete(s,p,next);
 assert.equal(s.stockpilesById[siteStockpileId].pills.foundation,1);assert.equal(next.progressTicks,780);assert.equal(m.skills.medicine,13.2);assert.equal(m.knowledge.alchemy,35.7);
 assert.equal(pharmacistProgress(s,p.personId).lastCompletion.factId,next.resultFactId);validateEconomy(s);
 const growth=JSON.stringify([m.skills,m.knowledge]);for(let i=0;i<10;i++)step(s);assert.equal(JSON.stringify([m.skills,m.knowledge]),growth);assert.equal(validateEconomy(s),true);
});

test('master craft earns the same completion growth and retains its existing command owner',()=>{
 const {s,p,m,siteStockpileId,session}=fixture({master:true});delete m.skills;assert.equal(pharmacistProgress(s,p.personId).medicine,0);const out=craftSR(s,'heal'),w=s.workOrdersById[out.id];
 assert.equal(w.personId,'person:master');assert.equal(w.process.stageIndex,0);complete(s,p,w,2500,()=>advanceSect(session,.1));
 assert.equal(w.progressTicks,280);assert.equal(s.stockpilesById[siteStockpileId].pills.heal,2);assert.equal(m.skills.medicine,.6);assert.equal(m.knowledge.alchemy,35.1);assert.equal(s.factsById[w.resultFactId].growth.personId,'person:master');assert.equal(p.action,'rest');validateSect(session);
});

test('completed historical receipts stay optional and growth records validate their own snapshot rather than future skill',()=>{
 const {s,p,m,buildingId}=fixture();const out=requestAutonomousCraft(s,p.personId,'heal',{buildingId}),w=s.workOrdersById[out.id];complete(s,p,w);const f=s.factsById[w.resultFactId];
 const actual=structuredClone(f.growth);m.skills.medicine=70;m.knowledge.alchemy=90;assert.equal(validateEconomy(s),true);
 f.growth.medicine.after=101;assert.throws(()=>validateEconomy(s),/炼药成长/);f.growth=actual;
 delete f.growth;const before=JSON.stringify(s);assert.equal(validateEconomy(s),true);assert.equal(pharmacistProgress(s,p.personId).lastCompletion,null);for(let i=0;i<3;i++){pharmacistProgress(s,p.personId);tickEconomy(s);}assert.equal(JSON.stringify(s),before);
});
