/** U-172 configured return conditions; settlement and recovery use official ticks. */
import {createWorkSpecializationScenario} from './work-specialization.mjs';
import {advanceSect,commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {releaseBodyActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {scenicFindPath,geometryRevision} from '../../src/simulation/ea-scenic.mjs';
import {recordFactSR} from '../../src/simulation/ea-sr-world.mjs';

export const EXPEDITION_RECOVERY_SCENARIO=Object.freeze({
 id:'expedition-recovery-v1',conditions:Object.freeze(['healthy','injured','no-medicine']),
 returneeId:'person:lin-changfeng',companionId:'person:lu-zhiwei',wound:12,maxWorldSteps:900,
});
const HOME='scene:yunxiu-courtyard';
function put(s,p,x,y){Object.assign(p.mind.scenic,{x,y,path:[],goal:null,revision:geometryRevision(s)});delete p.mind.scenic.bodyYield;delete p.mind.scenic.waitingForPersonId;p.position={kind:'scene',sceneId:HOME,x,y};p.location={kind:'local',sceneId:HOME,x,y};}
export function createExpeditionRecoveryScenario({condition='injured'}={}){
 if(!EXPEDITION_RECOVERY_SCENARIO.conditions.includes(condition))throw Error('Unknown recovery condition: '+condition);
 const base=createWorkSpecializationScenario(),{session,buildingIds}=base;
 let s=session.state;const {returneeId,companionId}=EXPEDITION_RECOVERY_SCENARIO;
 let p=s.personsById[returneeId];const stock=s.stockpilesById['stockpile:yunxiu'];
 // Generate the journey and actually pay its ordinary preparation cost first.
 // The trip itself is outside this targeted scene; its return cargo is a declared condition.
 put(s,p,stock.position.x,stock.position.y);p.mind.traits=[40,80,50,80,20];
 const enabled=commandSect(session,{type:'disciple-expeditions',enabled:true});if(!enabled.ok)throw Error(enabled.error);
 for(let n=0;n<60;n++){advanceSect(session,.1);s=session.state;const j=s.discipleExpeditions?.journeys[0];if(j?.phase==='approach')break;}
 s=session.state;p=s.personsById[returneeId];const j=s.discipleExpeditions?.journeys[0];
 if(j?.personId!==returneeId||j.phase!=='approach'||!s.factsById[`fact:disciple:${j.id}:supply`])throw Error('The official preparation did not produce a paid journey');
 const preparationTick=s.worldTick,cargo=condition==='no-medicine'?0:2;
 // Configure an unfinished, valid delivery leg, never a returned or healed result.
 put(s,p,stock.position.x+2,stock.position.y);j.phase='delivery';j.progress=0;j.cargo={herb:cargo};j.departedWound=0;
 j.deliveryGoal={x:stock.position.x,y:stock.position.y};j.deliveryBlocked=false;
 const returnPath=scenicFindPath(s,p.mind.scenic,j.deliveryGoal);if(!returnPath?.length)throw Error('Configured return leg must have an actual walk');
 Object.assign(p.mind.scenic,{path:returnPath,goal:{...j.deliveryGoal},revision:geometryRevision(s)});
 p.mind.activity='walk';p.mind.away=null;p.mind.traits=[40,20,50,80,20];p.energy=80;p.wound=condition==='healthy'?0:EXPEDITION_RECOVERY_SCENARIO.wound;
 if(cargo)recordFactSR(s,`fact:disciple:${j.id}:gather`,{kind:'resource-transfer',personId:returneeId,objectId:'object:valley:herbs',amount:cargo,text:'U-172 场景起点：本次返程已经携带的有限药草。'});
 const companion=s.personsById[companionId];releaseBodyActivity(s,companion);companion.job=null;companion.activityId=null;
 Object.assign(companion.mind,{activity:'rest',reason:'同门归院，待本人权衡差事。',lastDecision:-100,commitUntil:0});
 // Both prefer the same currently vacant real lumber job; the injured returnee
 // must recover instead of receiving an externally assigned shift.
 companion.mind.skills.plant=0;companion.mind.skills.industry=80;put(s,companion,25,15);
 s.resources.wood=0;s.resources.herb=condition==='no-medicine'?0:8;
 s.stockpilesById[`stockpile:${buildingIds.plant}`].resources.herb=0;
 // Keep the observer outside door traffic. Reading is tested separately from movement.
 Object.assign(s.master.scenic,{x:23.7,y:7.2,path:[],goal:null,revision:geometryRevision(s)});s.master.position={kind:'scene',sceneId:HOME,x:23.7,y:7.2};
 session.control={mode:'manual',idleMs:0};s.masterControl={mode:'manual',idleMs:0};
 validateSect(session);
 const metadata={...EXPEDITION_RECOVERY_SCENARIO,condition,startTick:s.worldTick,preparationTick,journeyId:j.id,buildingIds,
  conditions:{returnPhase:'delivery',returnPosition:{...p.position},deliveryGoal:{...j.deliveryGoal},remainingPathPoints:returnPath.length,initialWound:p.wound,initialEnergy:p.energy,initialHerb:s.resources.herb,returnCargo:cargo,paidSupply:structuredClone(j.cost),configuredTripSegment:true,configuredSkills:{returneeIndustry:80,companionIndustry:80},farmSeedHerb:0,foodStock:s.resources.food,observer:{...s.master.position}},
  scope:'Configured unfinished return leg after official paid preparation. Return delivery, recovery, voluntary work and production are not prewritten.'};
 return{session,state:s,s,metadata,returneeId,companionId,journeyId:j.id,buildingIds};
}
