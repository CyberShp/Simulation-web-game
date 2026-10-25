import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';
import {createExpeditionPurposeScenario} from '../../fixtures/expedition-purpose.mjs';

const PATCH='object:valley:herbs',FOE='person:valley-shanxiao';
const journey=(f,id)=>f.session.state.discipleExpeditions.journeys.find(j=>j.id===id);
function nextJourney(f){
 const ids=new Set(f.session.state.discipleExpeditions.journeys.map(j=>j.id));
 for(let n=0;n<20;n++){advanceSect(f.session,.1);const j=f.session.state.discipleExpeditions.journeys.find(j=>!ids.has(j.id));if(j)return j;}
 assert.fail('the configured eligible resident did not choose an actual journey');
}
function finish(f,id,observe=()=>{}){
 for(let n=0;n<5000;n++){
  if(n%100===0){const result=commandSect(f.session,{type:'manual'});assert(result.ok,result.error);}
  advanceSect(f.session,.1);const j=journey(f,id);observe(j);
  if(j.phase==='returned'){validateSect(f.session);return j;}
 }
 assert.fail('the bounded official journey did not actually return');
}
function moveFoe(s,x,y){const p=s.personsById[FOE];p.location={kind:'local',sceneId:'scene:valley',x,y};p.position={kind:'scene',sceneId:'scene:valley',x,y};}

test('remote monster and herb-patch facts do not change an at-home departure decision',()=>{
 const a=createExpeditionPurposeScenario({condition:'well-supplied'}),b=createExpeditionPurposeScenario({condition:'well-supplied'});
 moveFoe(a.session.state,5,5);moveFoe(b.session.state,27,30.5);
 a.session.state.srWorld.resourcePatches??={};b.session.state.srWorld.resourcePatches??={};
 a.session.state.srWorld.resourcePatches[PATCH]=0;b.session.state.srWorld.resourcePatches[PATCH]=18;
 b.session.state.personsById[FOE].realm=12;
 validateSect(a.session);validateSect(b.session);
 const first=nextJourney(a),second=nextJourney(b);
 assert.equal(first.personId,a.travellerId);assert.equal(second.personId,b.travellerId);
 assert.equal(first.purpose,'explore');assert.equal(second.purpose,first.purpose);
 assert.deepEqual(second.purposeDecision,first.purposeDecision);
 assert.equal(second.purposeDecision.inputs.knownRisk,null);
});

test('another residents returned encounter does not become the new travellers private knowledge',()=>{
 const f=createExpeditionPurposeScenario({condition:'known-risk'}),s=f.session.state;
 const prior=s.discipleExpeditions.journeys.at(-1);assert.equal(prior.phase,'returned');assert.equal(prior.encounter.risk,'high');
 const original=s.personsById[f.travellerId],p=s.personsById[f.companionId],stock=s.stockpilesById['stockpile:yunxiu'];
 original.energy=0;releaseBodyActivity(s,p);p.activityId=null;p.job=null;p.energy=100;p.wound=0;
 Object.assign(p.mind,{activity:'rest',away:null,office:null,main:original.mind.main,goal:original.mind.goal,traits:[...original.mind.traits],satiety:100,commitUntil:0,lastDecision:-100});
 p.mind.skills.plant=original.mind.skills.plant;
 Object.assign(p.mind.scenic,{x:stock.position.x,y:stock.position.y,path:[],goal:null,revision:geometryRevision(s)});
 p.location={kind:'local',sceneId:'scene:yunxiu-courtyard',x:stock.position.x,y:stock.position.y};p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:stock.position.x,y:stock.position.y};
 validateSect(f.session);const chosen=nextJourney(f);
 assert.equal(chosen.personId,p.personId);assert.equal(chosen.purpose,'explore');
 assert.equal(chosen.purposeDecision.inputs.knownRisk,null);assert.equal(chosen.purposeDecision.riskSourceJourneyId,null);
 assert.equal(journey(f,prior.id).encounter.risk,'high','the actual prior encounter remains intact');
});

test('an exploration interrupted by actual danger returns without an exploration reward',()=>{
 const f=createExpeditionPurposeScenario({condition:'well-supplied'});moveFoe(f.session.state,27,30.5);validateSect(f.session);
 const j=nextJourney(f),initialXp=f.session.state.personsById[j.personId].xp;assert.equal(j.purpose,'explore');
 const ended=finish(f,j.id),s=f.session.state;
 assert.equal(ended.retreated,true);assert(ended.encounter?.observedTick);
 assert.equal(s.factsById[`fact:disciple:${j.id}:exploration`],undefined);
 assert.equal(s.factsById[`fact:disciple:${j.id}:gather`],undefined);
 assert.equal(ended.growth.experience,0);assert.equal(s.personsById[j.personId].xp,initialXp);
 assert.equal(ended.delivered.herb,0);
});

test('an old journey without purpose keeps its original gather-scout reward semantics',()=>{
 const f=createExpeditionPurposeScenario({condition:'well-supplied'}),started=nextJourney(f),id=started.id;
 // U-172 legacy boundary: configure the old optional-field shape before any
 // gathering, scouting, or return result. The depleted patch is an initial fact.
 delete started.purpose;delete started.purposeDecision;
 f.session.state.srWorld.resourcePatches??={};f.session.state.srWorld.resourcePatches[PATCH]=0;
 validateSect(f.session);let sawScouting=false;
 const ended=finish(f,id,j=>{if(j.phase==='scouting')sawScouting=true;});
 const s=f.session.state,gather=s.factsById[`fact:disciple:${id}:gather`];
 assert(sawScouting,'the legacy route still scouts after gathering');assert.equal(gather.amount,0);
 assert.equal(ended.delivered.herb,0);assert.equal(ended.growth.experience,8,'legacy completion used the gathering fact, including an empty patch');
 assert.equal(s.factsById[`fact:disciple:${id}:exploration`],undefined);
 assert(!Object.hasOwn(ended,'purpose'));assert(!Object.hasOwn(ended,'purposeDecision'));
});
