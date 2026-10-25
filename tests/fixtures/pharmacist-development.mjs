/** U-172 pharmacist conditions; all orders, growth and delivery use real steps. */
import {createMedicineSupplyScenario} from './medicine-supply.mjs';
import {advanceSect,commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {releaseBodyActivity,prepareFacilityActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';

export const PHARMACIST_DEVELOPMENT_SCENARIO=Object.freeze({id:'pharmacist-development-v1',conditions:Object.freeze(['growth','injured-replacement','away-replacement','interrupted-replacement']),maxWorldSteps:6000});
const HOME='scene:yunxiu-courtyard';
function ready(s,p,{medicine=60,x=26,y=15}={}){
 releaseBodyActivity(s,p);p.activityId=null;p.job=null;p.energy=100;p.wound=0;
 Object.assign(p.mind,{activity:'rest',reason:'药物差事开放，待本人权衡。',learning:null,office:null,away:null,journey:null,satiety:100,lastDecision:s.time,commitUntil:0,lastSocial:s.society.clock,traits:[70,10,50,80,10]});
 delete p.mind.recovering;p.mind.relationships.master.trust=80;p.mind.skills.medicine=medicine;
 Object.assign(p.mind.scenic,{x,y,path:[],goal:null,revision:geometryRevision(s)});delete p.mind.scenic.bodyYield;delete p.mind.scenic.waitingForPersonId;
 p.position={kind:'scene',sceneId:HOME,x,y};p.location={kind:'local',sceneId:HOME,x,y};
}
function step(session,n){if(n%100===0){const r=commandSect(session,{type:'manual'});if(!r.ok)throw Error(r.error);}advanceSect(session,.1);}
export function createPharmacistDevelopmentScenario({condition='growth'}={}){
 if(!PHARMACIST_DEVELOPMENT_SCENARIO.conditions.includes(condition))throw Error('Unknown pharmacist condition: '+condition);
 const f=createMedicineSupplyScenario(),{session}=f;let s=session.state;
 const pharmacistId=f.workerId,replacementId=f.travellerId,pharmacist=s.personsById[pharmacistId];
 ready(s,pharmacist,{medicine:80,x:27,y:15});ready(s,s.personsById[replacementId],{medicine:60,x:24,y:15});
 const prelude={steps:0,phases:[]};let initialCraftId=null;
 // Finite GC26 inputs are present at the scene start. This batch tests the
 // pharmacist's work and succession; material procurement is covered by 86.
 Object.assign(s.stockpilesById[f.siteStockpileId].resources,{herb:condition==='growth'?85:condition==='interrupted-replacement'?20:10,cleanWater:condition==='growth'?8:condition==='interrupted-replacement'?4:2,wood:condition==='growth'?5:condition==='interrupted-replacement'?2:1,crystal:condition==='growth'?12:0});
 const configuredSiteInputs=structuredClone(s.stockpilesById[f.siteStockpileId].resources);
 Object.assign(s.resources,{jade:300,insight:condition==='growth'?15:0,herb:100,food:1000});
 if(condition==='growth'){
  pharmacist.realm=9;pharmacist.mind.knowledge.alchemy=34.5;
  if(!s.doctrine.books.includes('alchemy'))s.doctrine.books.push('alchemy');
  if(!s.doctrine.books.includes('foundation'))s.doctrine.books.push('foundation');
 }
 if(condition==='injured-replacement'){
  pharmacist.wound=12;pharmacist.mind.recovering=true;pharmacist.mind.activity='heal';pharmacist.mind.reason='伤势需要照料，自行取用草药调养。';
  const hall=s.buildings.find(b=>b.type==='hall');prepareFacilityActivity(s,pharmacist,hall,'heal');
 }
 if(condition==='away-replacement'){
  pharmacist.mind.traits=[70,50,50,90,50];pharmacist.mind.goal='求索奇法';
  const on=commandSect(session,{type:'disciple-expeditions',enabled:true});if(!on.ok)throw Error(on.error);
  let departed=false,phase=null;
  for(let n=0;n<1800;n++){
   step(session,n);s=session.state;const j=s.discipleExpeditions.journeys[0];
   if(j&&j.phase!==phase){prelude.phases.push({tick:s.worldTick,phase:j.phase,personId:j.personId});phase=j.phase;}
   if(j&&j.personId!==pharmacistId)throw Error('Configured pharmacist must be the real voluntary traveller');
   if(j?.phase==='outbound'&&s.personsById[pharmacistId].location?.kind==='travel'){prelude.steps=n+1;prelude.journeyId=j.id;departed=true;break;}
  }
  if(!departed)throw Error('Pharmacist did not really leave the courtyard within the bound');
  const off=commandSect(session,{type:'disciple-expeditions',enabled:false});if(!off.ok)throw Error(off.error);
  s=session.state;
  // The targeted succession scene starts with a rested, available colleague.
  // The completed departure and its original owner/route/facts stay intact.
  ready(s,s.personsById[replacementId],{medicine:60,x:24,y:15});
 }
 if(condition==='interrupted-replacement'){
  const on=commandSect(session,{type:'medicine-supply',enabled:true,target:2});if(!on.ok)throw Error(on.error);
  let worked=false;
  for(let n=0;n<1800;n++){step(session,n);s=session.state;const w=Object.values(s.workOrdersById).find(w=>w.kind==='sr-crafting');if(w?.progressTicks>0){if(w.personId!==pharmacistId)throw Error('Original pharmacist must own the first actual batch');initialCraftId=w.id;prelude.steps=n+1;prelude.workedBeforeInjury=w.progressTicks;worked=true;break;}}
  if(!worked)throw Error('Original pharmacist did not physically begin the batch');
  s.personsById[pharmacistId].wound=30;s.personsById[pharmacistId].mind.recovering=true;
  ready(s,s.personsById[replacementId],{medicine:60,x:24,y:15});
 }
 s=session.state;validateSect(session);
 return{...f,session,state:s,s,pharmacistId,replacementId,initialCraftId,metadata:{id:PHARMACIST_DEVELOPMENT_SCENARIO.id,condition,startTick:s.worldTick,pharmacistId,replacementId,buildingId:f.buildingId,siteStockpileId:f.siteStockpileId,sourceStockpileId:f.sourceStockpileId,prelude,
  conditions:{completedCanonicalGC26:f.metadata.conditions.configuredCompletedCanonicalGC26,configuredSiteInputs,siteMaterials:structuredClone(s.stockpilesById[f.siteStockpileId].resources),publicBudget:{jade:s.resources.jade,insight:s.resources.insight},food:s.resources.food,pharmacist:{realm:s.personsById[pharmacistId].realm,medicine:s.personsById[pharmacistId].mind.skills.medicine,alchemy:s.personsById[pharmacistId].mind.knowledge.alchemy||0,wound:s.personsById[pharmacistId].wound,position:structuredClone(s.personsById[pharmacistId].position),activityId:s.personsById[pharmacistId].activityId},replacement:{medicine:60,available:true},books:[...s.doctrine.books],initialCraftId},
  scope:'Completed room, finite onsite inputs, skills and readiness are configured. The away branch first makes a real voluntary departure; the interruption branch first performs real work before a configured injury event at the scene start. Completion, growth, refunds, successor orders and medicine delivery are produced by official logic.'}};
}
