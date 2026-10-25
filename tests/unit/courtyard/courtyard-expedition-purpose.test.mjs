import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect} from '../../../apps/courtyard/sect-sim.mjs';
import {expeditionPurposeDecision,discipleExpeditionsView,validateDiscipleExpeditions} from '../../../src/simulation/ea-disciple-expeditions.mjs';
import {createExpeditionPurposeScenario,EXPEDITION_PURPOSE_SCENARIO} from '../../fixtures/expedition-purpose.mjs';
const PATCH='object:valley:herbs';
function step(f,n=0){if(n%100===0)assert.equal(commandSect(f.session,{type:'manual'}).ok,true);advanceSect(f.session,.1);return f.session.state;}
function checkBad(s,mutate,pattern=/历练/){const bad=structuredClone(s);mutate(bad);const before=JSON.stringify(bad);assert.throws(()=>validateDiscipleExpeditions(bad),pattern);assert.equal(JSON.stringify(bad),before);}

test('purpose scores use public shortage and the person\'s existing aspiration and skills, with deterministic supply ties',()=>{
 const f=createExpeditionPurposeScenario(),s=f.s,p=s.personsById[f.travellerId],before=JSON.stringify(s);
 const decision=expeditionPurposeDecision(s,p);assert.equal(JSON.stringify(s),before);assert.equal(decision.purpose,'supply');assert.equal(decision.purposeDecision.inputs.herbTarget,45);assert.equal(decision.purposeDecision.scores.supply,67);assert.equal(decision.purposeDecision.scores.explore,65);
 // U-172 isolates the stated score boundary without starting or rewarding an action.
 s.resources.herb=100;p.mind.traits=[0,0,50,80,0];p.mind.goal='安稳生活';p.mind.skills.plant=0;
 const tied=expeditionPurposeDecision(s,p);assert.deepEqual(tied.purposeDecision.scores,{supply:20,explore:20});assert.equal(tied.purpose,'supply');
 p.mind.goal='精研草木';assert.equal(expeditionPurposeDecision(s,p).purposeDecision.scores.supply,40);p.mind.skills.plant=100;assert.equal(expeditionPurposeDecision(s,p).purposeDecision.scores.supply,45);
});

for(const [condition,purpose]of [['supply-shortage','supply'],['well-supplied','explore']])test(`${purpose} physically performs its own task and settles only its actual result once`,()=>{
 const f=createExpeditionPurposeScenario({condition});let s=f.s,p=s.personsById[f.travellerId];const herb=s.resources.herb,initialXp=p.xp,initialPatch=s.srWorld.resourcePatches?.[PATCH]??18;
 let j,decision,arrival=null,lastProgress=0,observations=0;const phases=new Set();
 for(let n=0;n<EXPEDITION_PURPOSE_SCENARIO.maxWorldSteps;n++){
  s=step(f,n);p=s.personsById[f.travellerId];j=s.discipleExpeditions.journeys[0];if(!j)continue;
  assert.equal(j.purpose,purpose);decision??=structuredClone(j.purposeDecision);assert.deepEqual(j.purposeDecision,decision);phases.add(j.phase);
  if(j.phase==='scouting'&&j.scoutPath.length===0&&j.progress<60){
   assert(Math.hypot(p.location.x-27,p.location.y-30.5)<.01);arrival??=s.worldTick;
   if(j.progress>lastProgress){assert.equal(j.progress,lastProgress+1);observations++;}lastProgress=j.progress;
   assert.equal(s.factsById[`fact:disciple:${j.id}:exploration`],undefined);assert.equal(p.xp,initialXp);
  }
  const before=JSON.stringify(s),view=discipleExpeditionsView(s);assert.equal(JSON.stringify(s),before);const publicJourney=view.journeys.find(x=>x.id===j.id);assert.equal(publicJourney.purposeLabel,purpose==='supply'?'采药补给':'探索修行');assert.equal(publicJourney.decisionReason,decision.reason);if(j.phase!=='returned'){assert.equal(publicJourney.report,null);assert.equal(publicJourney.encounter,undefined);assert.equal(publicJourney.position,undefined);}
  if(j.phase==='returned')break;
 }
 assert.equal(j.phase,'returned');assert(phases.has('outbound'));assert(phases.has('returning'));assert(phases.has('delivery'));assert.deepEqual(j.cost,{food:2,energy:8});assert.equal(j.cargo.herb,0);assert.equal(p.xp-initialXp,8);assert.equal(j.growth.experience,8);
 const gather=s.factsById[`fact:disciple:${j.id}:gather`],explore=s.factsById[`fact:disciple:${j.id}:exploration`];
 if(purpose==='supply'){assert(phases.has('exploring'));assert(!phases.has('scouting'));assert.equal(gather.amount,6);assert.equal(explore,undefined);assert.equal(s.srWorld.resourcePatches[PATCH],initialPatch-6);assert.equal(j.delivered.herb,6);assert.equal(s.resources.herb,herb+6);}
 else{assert(!phases.has('exploring'));assert(phases.has('scouting'));assert(arrival);assert.equal(observations,59);assert.equal(gather,undefined);assert.equal(explore.personId,p.personId);assert.equal(explore.observationTicks,60);assert.equal(explore.atTick-explore.observationStartedTick,59);assert.equal(s.srWorld.resourcePatches?.[PATCH]??18,initialPatch);assert.equal(j.delivered.herb,0);assert.equal(s.resources.herb,herb);}
 assert.equal(validateDiscipleExpeditions(s),true);
 const xp=p.xp,cargo=structuredClone(j.delivered);for(let n=0;n<20;n++)s=step(f,n);assert.equal(s.personsById[f.travellerId].xp,xp);assert.deepEqual(s.discipleExpeditions.journeys[0].delivered,cargo);
 if(purpose==='explore'){
  checkBad(s,v=>{delete v.discipleExpeditions.journeys[0].purpose;});
  checkBad(s,v=>{delete v.discipleExpeditions.journeys[0].purpose;delete v.discipleExpeditions.journeys[0].purposeDecision;});
  checkBad(s,v=>{v.factsById[`fact:disciple:${j.id}:exploration`].observationTicks=1;});
  checkBad(s,v=>{delete v.factsById[`fact:disciple:${j.id}:exploration`];});
 }
});

test('a real earlier returned observation changes the next choice, preserving the exact person and source journey',()=>{
 const f=createExpeditionPurposeScenario({condition:'known-risk'}),s=f.s,p=s.personsById[f.travellerId],history=f.metadata.history.journey;
 assert.equal(history.phase,'returned');assert.equal(history.encounter.risk,'high');assert.equal(history.growth.experience,0);
 const before=JSON.stringify(s),choice=expeditionPurposeDecision(s,p);assert.equal(JSON.stringify(s),before);assert.equal(choice.purpose,'supply');assert.equal(choice.purposeDecision.riskSourceJourneyId,history.id);assert.equal(choice.purposeDecision.inputs.knownRisk,'high');assert.equal(choice.purposeDecision.scores.explore,25);
 const next=step(f),j=next.discipleExpeditions.journeys.at(-1);assert.notEqual(j.id,history.id);assert.equal(j.personId,p.personId);assert.deepEqual(j.purposeDecision,choice.purposeDecision);assert.equal(j.purpose,'supply');assert.match(discipleExpeditionsView(next).journeys.at(-1).decisionReason,/亲见/);
 checkBad(next,v=>{v.discipleExpeditions.journeys.at(-1).purposeDecision.riskSourceJourneyId='outing:missing';});checkBad(next,v=>{v.discipleExpeditions.journeys.at(-1).purposeDecision.scores.supply++;});
 checkBad(next,v=>{delete v.discipleExpeditions.journeys.at(-1).purpose;});
});

test('a new supply journey actually reaches an initially empty patch and returns without herbs or completion experience',()=>{
 const f=createExpeditionPurposeScenario(),initialXp=f.s.personsById[f.travellerId].xp,initialHerb=f.s.resources.herb;
 f.s.srWorld.resourcePatches??={};f.s.srWorld.resourcePatches[PATCH]=0;let s=f.s,j,reachedPatch=false;
 for(let n=0;n<EXPEDITION_PURPOSE_SCENARIO.maxWorldSteps;n++){
  s=step(f,n);j=s.discipleExpeditions.journeys[0];if(j?.phase==='exploring'&&j.valleyPath.length===0)reachedPatch=true;if(j?.phase==='returned')break;
 }
 assert(reachedPatch);assert.equal(j.purpose,'supply');assert.equal(j.phase,'returned');assert.equal(s.factsById[`fact:disciple:${j.id}:gather`].amount,0);assert.equal(j.delivered.herb,0);assert.equal(j.growth.experience,0);assert.equal(s.personsById[f.travellerId].xp,initialXp);assert.equal(s.resources.herb,initialHerb);assert.equal(s.srWorld.resourcePatches[PATCH],0);assert.equal(validateDiscipleExpeditions(s),true);
});
