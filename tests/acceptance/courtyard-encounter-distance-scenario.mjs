/** U-172 distance conditions; perception, damage, retreat and return are real. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createExpeditionPurposeScenario,EXPEDITION_PURPOSE_SCENARIO} from '../fixtures/expedition-purpose.mjs';
import {advanceSect,commandSect,validateSect,viewSect} from '../../apps/courtyard/sect-sim.mjs';
import {DISCIPLE_ENCOUNTER_RULES} from '../../src/simulation/ea-disciple-encounters.mjs';
import {equipmentCombatBenefits} from '../../src/simulation/ea-sr-equipment.mjs';
import {valleyEncounterDefinition} from '../../src/simulation/ea-campaign.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),arg=process.argv.find(v=>v.startsWith('--output=')),output=path.resolve(arg?.slice(9)||'/tmp/immortal-encounter-distance-scenario');
assert(!output.startsWith(root));assert(!existsSync(path.join(output,'report.json')),'Use a fresh external evidence directory');await fs.mkdir(output,{recursive:true});
const sha=v=>createHash('sha256').update(v).digest('hex'),files=['src/simulation/ea-disciple-encounters.mjs','src/simulation/ea-disciple-expeditions.mjs','src/simulation/ea-campaign.mjs','src/simulation/ea-sr-equipment.mjs','src/simulation/ea-society.mjs','src/simulation/ea-sr-persons.mjs','apps/courtyard/sect-sim.mjs','tests/fixtures/work-specialization.mjs','tests/fixtures/expedition-purpose.mjs','tests/acceptance/courtyard-encounter-distance-scenario.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await fs.readFile(path.join(root,f)))])));
const report={success:false,scope:'Two configured encounter placements; official world ticks produce discovery, damage, retreat, return and recovery intent. State and public-view evidence; no UI/native/persistence claim.',rules:{...DISCIPLE_ENCOUNTER_RULES,publicInteractionRadius:valleyEncounterDefinition().radius},scenarios:[],checks:[],errors:[]};
try{
 report.runtimeBefore=await hashes();assert.equal(DISCIPLE_ENCOUNTER_RULES.perception,6);assert.equal(DISCIPLE_ENCOUNTER_RULES.contactDistance,3);
 for(const condition of ['default-danger','initial-contact']){
  const f=createExpeditionPurposeScenario({condition:'well-supplied'}),{session,travellerId}=f,s=session.state,foe=s.personsById['person:valley-shanxiao'];
  const initialFoe=condition==='default-danger'?f.metadata.conditions.originalFoePosition:{kind:'local',sceneId:'scene:valley',x:9,y:27};
  foe.location=structuredClone(initialFoe);foe.position={kind:'scene',sceneId:initialFoe.sceneId,x:initialFoe.x,y:initialFoe.y};validateSect(session);
  const p=s.personsById[travellerId],xpBefore=p.xp,herbBefore=s.resources.herb,guard=equipmentCombatBenefits(s,travellerId).guard,expectedContactInjury=DISCIPLE_ENCOUNTER_RULES.contactWound*(1-guard);
  const o={condition,configured:{fixture:f.metadata,foePosition:structuredClone(foe.location),valleyArrival:{x:7,y:27},initialWound:p.wound,initialXP:xpBefore,guard,expectedContactInjury,scope:condition==='default-danger'?'Default persistent foe position.':'Initial foe placed 2m from the actual valley arrival point; no traveller position or outcome is assigned.'},initialStateSha256:sha(JSON.stringify(s)),transitions:[],encounter:null,returned:null};report.scenarios.push(o);
  let phase=null;
  for(let n=0;n<EXPEDITION_PURPOSE_SCENARIO.maxWorldSteps;n++){
   if(n%100===0)assert(commandSect(session,{type:'manual'}).ok);const before=session.state.worldTick;advanceSect(session,.1);const state=session.state,person=state.personsById[travellerId],j=state.discipleExpeditions.journeys[0];assert.equal(state.worldTick,before+1);if(!j)continue;
   assert.equal(j.personId,travellerId);assert.equal(j.purpose,'explore');if(j.phase!==phase){o.transitions.push({tick:state.worldTick,phase:j.phase,wound:person.wound,xp:person.xp,position:structuredClone(person.position)});phase=j.phase;}
   if(!o.encounter&&j.encounter){const distance=Math.hypot(person.location.x-j.encounter.lastPosition.x,person.location.y-j.encounter.lastPosition.y);assert(distance<=DISCIPLE_ENCOUNTER_RULES.perception);assert.equal(j.phase,'valley-return');assert.equal(j.retreated,true);assert.equal(j.encounter.risk,'high');assert.equal(person.xp,xpBefore);
    if(condition==='default-danger'){assert(distance>DISCIPLE_ENCOUNTER_RULES.contactDistance);assert.equal(person.wound,0);assert.equal(j.encounter.injury,0);assert.equal(j.encounter.lastContactTick,undefined);}else{assert(distance<=DISCIPLE_ENCOUNTER_RULES.contactDistance);assert(Math.abs(person.wound-expectedContactInjury)<1e-9);assert.equal(j.encounter.injury,person.wound);assert.equal(j.encounter.lastContactTick,state.worldTick);assert.equal(person.bodyState,'impaired');}
    const text=JSON.stringify(state),view=viewSect(session),publicJourney=view.discipleExpeditions.journeys.find(x=>x.id===j.id);assert.equal(JSON.stringify(state),text);assert.equal(publicJourney.report,null);assert(!Object.hasOwn(publicJourney,'encounter'));assert(!Object.hasOwn(publicJourney,'position'));o.encounter={tick:state.worldTick,distance,observation:structuredClone(j.encounter),wound:person.wound,xp:person.xp,publicJourney};
   }
   if(condition==='default-danger')assert.equal(person.wound,0,'perception-range retreat must stay unharmed');
   if(j.phase==='returned'){
    assert(o.encounter);assert.equal(person.xp,xpBefore);assert.equal(j.growth.experience,0);assert(!state.factsById[`fact:disciple:${j.id}:exploration`]);assert(!state.factsById[`fact:disciple:${j.id}:gather`]);assert.equal(j.delivered.herb,0);assert.equal(j.cargo.herb,0);assert.equal(state.resources.herb,herbBefore);assert.equal(person.activityId,null);assert(Math.hypot(person.position.x-j.deliveryGoal.x,person.position.y-j.deliveryGoal.y)<.041);
    if(condition==='default-danger'){assert.equal(person.wound,0);assert.notEqual(person.mind.recovering,true);assert.equal(person.mind.activity,'rest');}else{assert(person.wound>5);assert(Math.abs(person.wound-expectedContactInjury)<1e-9);assert.equal(person.mind.recovering,true);assert.equal(person.mind.activity,'heal');assert.equal(person.job,null);assert.match(person.mind.reason,/草药调养/);}
    const text=JSON.stringify(state),view=viewSect(session),publicJourney=view.discipleExpeditions.journeys.find(x=>x.id===j.id);assert.equal(JSON.stringify(state),text,'returned report is read-only');assert.equal(publicJourney.report,j.report);assert.match(publicJourney.report,/主动撤回/);assert(publicJourney.report.includes(`归来伤势${person.wound}`));validateSect(session);assert.equal(state.economy.starvation,0);o.steps=n+1;o.returned={tick:state.worldTick,journey:structuredClone(j),wound:person.wound,xp:person.xp,recovering:person.mind.recovering===true,intent:person.mind.activity,reason:person.mind.reason,publicJourney,starvation:state.economy.starvation};break;
   }
  }
  assert(o.encounter&&o.returned,'bounded scenario reaches actual encounter and complete return');
 }
 report.checks=['default foe discovered within 6m but outside 3m: no injury','configured 2m crisis: real guarded contact damage','actual autonomous retreat and physical cargo-return arrival','unfinished exploration and no gather: zero experience','damaged return retains heal/recovering intent','in-flight outcome withheld / returned report read-only','fixed source hashes and bounded official world ticks'];report.runtimeAfter=await hashes();assert.deepEqual(report.runtimeAfter,report.runtimeBefore);report.success=true;
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}finally{await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({success:report.success,report:path.join(output,'report.json'),scenarios:report.scenarios.map(s=>({condition:s.condition,steps:s.steps,distance:s.encounter?.distance,wound:s.returned?.wound,xp:s.returned?.xp,recovering:s.returned?.recovering})),errors:report.errors}));
