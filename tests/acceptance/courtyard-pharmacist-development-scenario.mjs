/** Real four-stage learning, existing recipe qualification and voluntary cover. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createPharmacistDevelopmentScenario,PHARMACIST_DEVELOPMENT_SCENARIO} from '../fixtures/pharmacist-development.mjs';
import {advanceSect,commandSect,validateSect,viewSect,snapshotSect} from '../../apps/courtyard/sect-sim.mjs';
import {pharmacistProgress,craftAvailabilityForPerson,requestAutonomousCraft,craftRefundPreview} from '../../src/simulation/ea-sr-economy.mjs';
import {slotById} from '../../src/simulation/ea-facility-slots.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),output=path.resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'/tmp/immortal-pharmacist-development-scenario');
assert(!output.startsWith(root));assert(!existsSync(path.join(output,'report.json')),'Use a fresh external evidence directory');await fs.mkdir(output,{recursive:true});
const sha=x=>createHash('sha256').update(x).digest('hex'),files=['src/simulation/ea-sr-spatial.mjs','src/simulation/ea-sr-economy.mjs','src/simulation/ea-medicine-supply.mjs','src/simulation/ea-medicine-materials.mjs','src/simulation/ea-alchemy-definitions.mjs','src/simulation/ea-disciple-development.mjs','src/simulation/ea-disciple-expeditions.mjs','src/simulation/ea-facility-activities.mjs','src/simulation/ea-sr-persons.mjs','src/simulation/ea-society.mjs','src/simulation/ea-opening-sim.mjs','apps/courtyard/sect-sim.mjs','apps/courtyard/courtyard-development-panel.mjs','tests/fixtures/medicine-supply.mjs','tests/fixtures/pharmacist-development.mjs','tests/acceptance/courtyard-pharmacist-development-scenario.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async file=>[file,sha(await fs.readFile(path.join(root,file)))])));
const report={success:false,scope:'U-172 configured finite onsite GC26 inputs and initial conditions. Completion, growth, existing foundation qualification, voluntary replacement and physical HOME delivery use official world ticks. Full snapshots are separate; no native or persistence claim.',cases:[],checks:[],errors:[]};let active=null;
async function save(f,label){const text=JSON.stringify(snapshotSect(f.session)),file=path.join(output,label+'.json');await fs.writeFile(file,text);return{file,sha256:sha(text),tick:f.session.state.worldTick};}
function step(f,n){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);const tick=f.session.state.worldTick;advanceSect(f.session,.1);assert.equal(f.session.state.worldTick,tick+1);assert.equal(f.session.state.economy.starvation,0);return f.session.state;}
function progress(f,id){const s=f.session.state,before=JSON.stringify(s),v=pharmacistProgress(s,id);viewSect(f.session);assert.equal(JSON.stringify(s),before,'pharmacist/public projections are read-only');return v;}
const near=(a,b)=>Math.abs(a-b)<1e-9;
function observe(s,w,o){
 const p=s.personsById[w.personId];assert.equal(w.targetId,o.buildingId);
 if(w.phase==='active'){
  const a=s.activitiesById[w.activityId];assert.equal(a.personId,w.personId);assert.equal(p.activityId,a.id);assert.equal(s.reservationsById[w.slotReservationId].personId,w.personId);
  if(a.phase==='working'){
   const slot=slotById(s,a.slotId);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.041);
   if(!o.stages.some(x=>x.index===w.process.stageIndex))o.stages.push({index:w.process.stageIndex,tick:s.worldTick,slotId:slot.id,personId:w.personId});
  }
  assert.equal(p.mind.skills.medicine,o.initial.medicine,'unfinished batch grants no medical growth');
  assert.equal(p.mind.knowledge.alchemy||0,o.initial.alchemy,'unfinished batch grants no alchemy understanding');
  assert.equal(s.factsById[`fact:craft:${w.id}`],undefined,'unfinished batch has no completed product');
 }
 if(w.phase==='completed'&&!o.result){
  assert.equal(w.progressTicks,w.durationTicks);assert.equal(w.process.completedStages.length,4);assert.equal(o.stages.length,4);assert.equal(new Set(o.stages.map(x=>x.slotId)).size,4);
  const fact=s.factsById[w.resultFactId],g=fact.growth;assert.equal(fact.actorId,w.personId);assert.equal(fact.targetStockpileId,o.siteStockpileId);assert.equal(fact.quantity,w.yield);assert.equal(g.personId,w.personId);assert.equal(g.version,1);
  assert.equal(g.medicine.before,o.initial.medicine);assert.equal(g.medicine.after,Math.min(100,o.initial.medicine+.6));assert(near(g.medicine.gain,g.medicine.after-g.medicine.before));
  assert.equal(g.alchemy.before,o.initial.alchemy);assert.equal(g.alchemy.after,Math.min(100,o.initial.alchemy+(o.initial.alchemy>0?.6:0)));
  assert.equal(p.mind.skills.medicine,g.medicine.after);assert.equal(p.mind.knowledge.alchemy||0,g.alchemy.after);
  o.result={workOrderId:w.id,personId:w.personId,recipeId:w.recipeId,finishedTick:w.finishedTick,workTicks:w.progressTicks,cost:w.cost,quantity:fact.quantity,factId:fact.id,growth:g};
 }
}
function observation(f,personId){const p=f.session.state.personsById[personId];return{buildingId:f.buildingId,siteStockpileId:f.siteStockpileId,initial:{medicine:p.mind.skills.medicine,alchemy:p.mind.knowledge.alchemy||0},stages:[]};}
async function finishCraft(f,recipeId){
 const o=observation(f,f.pharmacistId),r=requestAutonomousCraft(f.session.state,f.pharmacistId,recipeId,{buildingId:f.buildingId});assert(r.accepted,r.reason);o.request={accepted:r.accepted,score:r.score,id:r.id};
 for(let n=0;n<PHARMACIST_DEVELOPMENT_SCENARIO.maxWorldSteps;n++){const s=step(f,n),w=s.workOrdersById[r.id];observe(s,w,o);if(o.result){o.steps=n+1;break;}}
 assert(o.result,'bounded real four-stage batch completes');return o;
}
try{
 report.runtimeBefore=await hashes();
 const f=createPharmacistDevelopmentScenario({condition:'growth'});active=f;const g={condition:'growth',configured:f.metadata,initialSnapshot:await save(f,'growth-initial')};report.cases.push(g);
 g.before=progress(f,f.pharmacistId);const initialQuote=craftAvailabilityForPerson(f.session.state,'foundation',f.pharmacistId,{buildingId:f.buildingId});assert.equal(g.before.recipes.find(x=>x.recipeId==='foundation').qualified,false);assert.equal(initialQuote.available,false);assert(initialQuote.reasons.some(x=>x.includes('35')));
 assert.equal(g.before.alchemy,34.5);assert.equal(g.before.medicine,80);g.heal=await finishCraft(f,'heal');assert.equal(g.heal.result.workTicks,280);
 g.afterHeal=progress(f,f.pharmacistId);assert.equal(g.afterHeal.alchemy,35.1);assert.equal(g.afterHeal.medicine,80.6);assert.equal(g.afterHeal.recipes.find(x=>x.recipeId==='foundation').qualified,true);assert.equal(g.afterHeal.lastCompletion.factId,g.heal.result.factId);
 const quote=craftAvailabilityForPerson(f.session.state,'foundation',f.pharmacistId,{buildingId:f.buildingId});assert(quote.available,quote.reasons.join('；'));g.qualifiedQuote={available:quote.available,cost:quote.cost,durationTicks:quote.durationTicks,requirements:g.afterHeal.recipes.find(x=>x.recipeId==='foundation').requirements};
 g.foundation=await finishCraft(f,'foundation');assert.equal(g.foundation.result.workTicks,780);assert.equal(g.foundation.result.quantity,1);assert.equal(f.session.state.stockpilesById[f.siteStockpileId].pills.foundation,1);assert.equal(f.session.state.stockpilesById[f.siteStockpileId].pills.heal,2);
 g.afterFoundation=progress(f,f.pharmacistId);assert.equal(g.afterFoundation.lastCompletion.factId,g.foundation.result.factId);const completed=JSON.stringify(f.session.state);for(let n=0;n<5;n++)progress(f,f.pharmacistId);assert.equal(JSON.stringify(f.session.state),completed);validateSect(f.session);g.finalSnapshot=await save(f,'growth-final');
 for(const condition of ['injured-replacement','away-replacement','interrupted-replacement']){
  const c=createPharmacistDevelopmentScenario({condition});active=c;const s=c.session.state,original=s.personsById[c.pharmacistId],bodyId=original.activityId,bodyKind=s.activitiesById[bodyId]?.kind,originalMedicine=original.mind.skills.medicine;
  const o={condition,configured:c.metadata,initialSnapshot:await save(c,condition+'-initial'),original:{bodyId,bodyKind,medicine:originalMedicine},batches:{},oldPreview:c.initialCraftId?craftRefundPreview(s,c.initialCraftId):null};report.cases.push(o);
  if(condition==='away-replacement'){assert.equal(original.location.kind,'travel');assert.equal(bodyKind,'sr-travel');o.original.journeyId=c.metadata.prelude.journeyId;}
  if(condition==='injured-replacement'){assert.equal(original.wound,12);assert.equal(original.mind.recovering,true);assert.equal(s.activitiesById[bodyId].action,'heal');}
  assert(commandSect(c.session,{type:'medicine-supply',enabled:true,target:2}).ok);
  let cancelled=false;
  for(let n=0;n<PHARMACIST_DEVELOPMENT_SCENARIO.maxWorldSteps;n++){
   const cur=step(c,n);for(const w of Object.values(cur.workOrdersById).filter(w=>w.kind==='sr-crafting')){
    if(w.id===c.initialCraftId){
     assert.equal(w.personId,c.pharmacistId);assert.equal(cur.personsById[c.pharmacistId].mind.skills.medicine,originalMedicine);
     if(w.phase==='cancelled'&&!cancelled){cancelled=true;assert.equal(w.progressTicks,1);assert.deepEqual(w.refund,o.oldPreview.refundable);assert.deepEqual(w.consumed,o.oldPreview.consumed);assert.equal(w.resultFactId,null);assert.equal(cur.factsById[`fact:craft:${w.id}`],undefined);assert.equal(cur.medicineSupply.lastInterruption.workOrderId,w.id);assert.equal(cur.medicineSupply.lastInterruption.personId,c.pharmacistId);o.cancelled={workOrderId:w.id,tick:w.finishedTick,refund:w.refund,consumed:w.consumed,factId:`fact:craft-cancel:${w.id}`};}
     continue;
    }
    assert.equal(w.personId,c.replacementId,'new batch belongs to the willing colleague');
    o.batches[w.id]??=observation(c,c.replacementId);observe(cur,w,o.batches[w.id]);
   }
   if(condition==='away-replacement'){
    const p=cur.personsById[c.pharmacistId],j=cur.discipleExpeditions.journeys.find(x=>x.id===o.original.journeyId);
    assert.equal(j.personId,c.pharmacistId);
    if(!['returned','cancelled','dead'].includes(j.phase)){assert.equal(p.activityId,bodyId);assert(['sr-travel','sr-disciple-expedition'].includes(cur.activitiesById[bodyId].kind));}
   }
   if(condition==='injured-replacement'&&cur.personsById[c.pharmacistId].wound>5){assert.equal(cur.personsById[c.pharmacistId].activityId,bodyId);assert.equal(cur.activitiesById[bodyId].action,'heal');}
   if(cur.stockpilesById[c.sourceStockpileId].pills.heal===2){const delivery=Object.values(cur.workOrdersById).find(w=>w.kind==='transport'&&w.phase==='delivered'&&w.sourceStockpileId===c.siteStockpileId&&w.targetStockpileId===c.sourceStockpileId&&w.cargo['pill:heal']===2);assert(delivery);assert(Object.values(o.batches).some(x=>x.result));if(c.initialCraftId)assert(cancelled);o.home={tick:cur.worldTick,heal:2,transportId:delivery.id,carrierId:delivery.carrierId};o.steps=n+1;break;}
  }
  assert(o.home,'bounded successor batch is physically delivered HOME');assert.equal(Object.keys(o.batches).length,1);o.after=progress(c,c.replacementId);validateSect(c.session);o.finalSnapshot=await save(c,condition+'-final');
 }
 report.checks=['unfinished work gives no product or growth','exclusive real feet at four GC26 stations','one completed batch grants actual owner medical and already-learned alchemy growth','existing foundation realm/book/understanding requirements before and after real growth','qualified pharmacist completes an actual foundation batch','initially injured pharmacist retains healing while a willing colleague takes a new batch','real voluntary departure retains its travel body while colleague supplies medicine','injured partial batch keeps original owner and actual consumed/refunded material accounting','successor starts a distinct real batch and medicine is physically delivered HOME','public progress is read-only and repeated reads do not repeat growth','full snapshots separate and runtime source hashes unchanged'];
 report.runtimeAfter=await hashes();assert.deepEqual(report.runtimeAfter,report.runtimeBefore);report.success=true;
}catch(error){report.errors.push(error.stack||String(error));if(active){report.failureSnapshot=await save(active,'failure-state');const s=active.session.state;report.failure={tick:s.worldTick,policy:s.medicineSupply,people:s.disciples.map(p=>({personId:p.personId,job:p.job,activityId:p.activityId,activity:s.activitiesById[p.activityId],position:p.position,wound:p.wound,reason:p.mind.reason}))};}process.exitCode=1;}finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({success:report.success,report:path.join(output,'report.json'),cases:report.cases.map(c=>({condition:c.condition,homeTick:c.home?.tick,healCompleted:c.heal?.result.finishedTick,foundationCompleted:c.foundation?.result.finishedTick})),errors:report.errors}));
