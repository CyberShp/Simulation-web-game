/** Directly configured QA conditions; outcomes are earned by the normal world loop. */
import {createSectSession,commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {initEconomy} from '../../src/simulation/ea-sr-economy.mjs';
import {releaseBodyActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {spatialPrefab} from '../../src/simulation/ea-sr-spatial.mjs';
import {facilitySlots} from '../../src/simulation/ea-facility-slots.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';

export const WORK_SPECIALIZATION_SCENARIO=Object.freeze({
 id:'work-specialization-v1',people:Object.freeze(['person:lu-zhiwei','person:lin-changfeng']),
 farmId:'building:yunxiu:2',lumberId:'building:yunxiu:80',skillValue:80,maxWorldSteps:650,
});
const scene='scene:yunxiu-courtyard';
function put(s,p,x,y){const a=p===s.master?p.scenic:p.mind.scenic;Object.assign(a,{x,y,path:[],goal:null,revision:geometryRevision(s)});delete a.bodyYield;delete a.waitingForPersonId;p.position={kind:'scene',sceneId:scene,x,y};if(p.location?.kind==='local')Object.assign(p.location,{sceneId:scene,x,y});}
export function createWorkSpecializationScenario({swapSpecialties=false}={}){
 const session=createSectSession();let s=session.state;const {farmId,lumberId,people:ids}=WORK_SPECIALIZATION_SCENARIO;
 // Both available jobs are actual completed prefabs with ordinary recipe,
 // stockpile and exclusive workstation definitions. No production starts here.
 const lumber={id:80,instanceId:lumberId,type:'lumber',level:1,x:26,y:16,progress:0,condition:100,enabled:true,sceneId:scene,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:26,y:16,orientation:'south'}};
 lumber.prefabId=spatialPrefab(lumber).id;s.buildings.push(lumber);s.nextId=Math.max(s.nextId,81);s.spatial.geometryRevision++;initEconomy(s);
 put(s,s.master,27.3,14.4);
 const admission=commandSect(session,{type:'admit-visitor',personId:ids[1],rank:'outer',affiliationId:scene,mentorId:null});if(!admission.ok)throw Error(admission.error);s=session.state;
 Object.assign(s.resources,{jade:200,wood:0,stone:0,herb:0,crystal:0,insight:0,food:200});s.stockpilesById['stockpile:yunxiu'].capacity=10000;
 s.doctrine.workFocus='balanced';s.doctrine.sealed=[];s.stockpilesById[`stockpile:${farmId}`].resources.herb=2;s.doctrine.routes=[];
 const people=ids.map((id,index)=>{
  const p=s.personsById[id];releaseBodyActivity(s,p);p.job=null;p.activityId=null;p.realm=1;p.xp=0;p.energy=100;p.wound=0;p.talent=1;
  const m=p.mind;Object.assign(m,{activity:'rest',reason:'差事开放，待本人权衡。',main:'qingyuan',support:[],learning:null,goal:'安稳生活，精进所长',traits:[40,20,50,80,20],satiety:100,mood:80,commitUntil:0,lastDecision:-100,lastSocial:s.society.clock,mentorId:null,office:null,away:null,journey:null});
  m.knowledge=Object.fromEntries(s.doctrine.books.map(id=>[id,100]));m.skills={plant:0,industry:0,learning:0,array:0,medicine:0};delete m.developmentRecommendation;
  const skillKey=(index===0)!==swapSpecialties?'plant':'industry';m.skills[skillKey]=WORK_SPECIALIZATION_SCENARIO.skillValue;put(s,p,20+index,30);
  return{personId:id,name:p.name,skillKey,buildingId:skillKey==='plant'?farmId:lumberId,initialSkill:m.skills[skillKey]};
 });
 const observerSlot=facilitySlots(s,s.buildingsById[farmId],'work')[0];put(s,s.master,observerSlot.position.x+.9,observerSlot.position.y+.9);session.policy={foodTarget:0,herbTarget:0,spendingCap:0,risk:'cautious'};session.control={mode:'manual',idleMs:0};s.masterControl={mode:'manual',idleMs:0};
 validateSect(session);
 return{session,state:s,s,people,metadata:{...WORK_SPECIALIZATION_SCENARIO,swapSpecialties,people:structuredClone(people),startTick:s.worldTick,conditions:{sameTalent:1,sameTraits:[40,20,50,80,20],fullHealth:true,initialCommitment:false,openJobs:['farm','lumber'],publicFocus:'balanced',woodAndHerbStock:0,foodStock:200,doctrineBooks:[...s.doctrine.books],initialKnowledge:Object.fromEntries(s.doctrine.books.map(id=>[id,100])),farmSeedHerb:2,skillsAreConfigured:true,observer:{position:{...s.master.position},nearWorkstationId:observerSlot.id,scope:'Initial observer position; contact requires the worker to actually reach this station.'}}},buildingIds:{plant:farmId,industry:lumberId}};
}
