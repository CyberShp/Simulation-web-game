/** U-172 conditions for purpose decisions; journeys and outcomes use real ticks. */
import {createWorkSpecializationScenario} from './work-specialization.mjs';
import {advanceSect,commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {releaseBodyActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';

export const EXPEDITION_PURPOSE_SCENARIO=Object.freeze({id:'expedition-purpose-v1',conditions:Object.freeze(['supply-shortage','well-supplied','known-risk']),travellerId:'person:lin-changfeng',companionId:'person:lu-zhiwei',maxWorldSteps:5000});
const HOME='scene:yunxiu-courtyard',VALLEY='scene:valley';
function ready(s,p){releaseBodyActivity(s,p);p.job=null;p.activityId=null;p.energy=100;p.wound=0;p.mind.satiety=100;Object.assign(p.mind,{activity:'rest',reason:'留院供给与山谷见闻，待本人权衡。',lastDecision:-100,commitUntil:0,goal:'求索奇法',traits:[70,50,50,80,50],away:null});const stock=s.stockpilesById['stockpile:yunxiu'];Object.assign(p.mind.scenic,{x:stock.position.x,y:stock.position.y,path:[],goal:null,revision:geometryRevision(s)});delete p.mind.scenic.bodyYield;p.position={kind:'scene',sceneId:HOME,x:stock.position.x,y:stock.position.y};p.location={kind:'local',sceneId:HOME,x:stock.position.x,y:stock.position.y};}
function step(session,n){if(n%100===0){const r=commandSect(session,{type:'manual'});if(!r.ok)throw Error(r.error);}advanceSect(session,.1);}
export function createExpeditionPurposeScenario({condition='supply-shortage'}={}){
 if(!EXPEDITION_PURPOSE_SCENARIO.conditions.includes(condition))throw Error('Unknown expedition purpose condition: '+condition);
 const {session}=createWorkSpecializationScenario();let s=session.state;const{travellerId,companionId}=EXPEDITION_PURPOSE_SCENARIO;
 ready(s,s.personsById[travellerId]);s.resources.herb=condition==='supply-shortage'?0:100;s.stockpilesById['stockpile:building:yunxiu:2'].resources.herb=0;
 const foe=s.personsById['person:valley-shanxiao'],originalFoe=structuredClone(foe.location);
 if(condition!=='known-risk'){foe.location={kind:'local',sceneId:VALLEY,x:5,y:5};foe.position={kind:'scene',sceneId:VALLEY,x:5,y:5};}
 const enabled=commandSect(session,{type:'disciple-expeditions',enabled:true});if(!enabled.ok)throw Error(enabled.error);
 let history=null;
 if(condition==='known-risk'){
  // A completed real first trip supplies this person's own observation. No
  // encounter, return, report, experience or risk result is manufactured here.
  for(let n=0;n<EXPEDITION_PURPOSE_SCENARIO.maxWorldSteps;n++){step(session,n);s=session.state;const j=s.discipleExpeditions.journeys[0];if(j?.phase==='returned'){if(j.encounter?.risk!=='high')throw Error('Prior trip must actually observe the high risk before returning');history={worldSteps:n+1,journey:structuredClone(j)};break;}}
  if(!history)throw Error('Known-risk setup did not finish a real observed return within the bound');
  // The targeted next-decision scene begins rested, with its opportunity due.
  // The prior actual journey and all its source facts remain intact.
  ready(s,s.personsById[travellerId]);s.resources.herb=100;s.discipleExpeditions.nextOpportunityTick=s.worldTick;
 }
 s=session.state;validateSect(session);
 return{session,state:s,s,travellerId,companionId,metadata:{id:EXPEDITION_PURPOSE_SCENARIO.id,condition,startTick:s.worldTick,travellerId,companionId,history,
  conditions:{publicHerb:s.resources.herb,publicFood:s.resources.food,traits:[...s.personsById[travellerId].mind.traits],goal:s.personsById[travellerId].mind.goal,plantSkill:s.personsById[travellerId].mind.skills.plant,energy:100,wound:0,farmSeedHerb:0,foePosition:structuredClone(s.personsById['person:valley-shanxiao'].location),originalFoePosition:originalFoe,knownRiskHistoryActual:!!history,nextOpportunityDue:s.discipleExpeditions.nextOpportunityTick,configuredStartPosition:{...s.personsById[travellerId].position}},
  scope:'Configured supply, aspiration, position and readiness. Purpose, movement, finite gathering, observation, return and rewards are produced by official world ticks.'}};
}
