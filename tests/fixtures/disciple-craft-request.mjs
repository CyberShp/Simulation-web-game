/** U-172 contact and finite materials; requests and completion stay official. */
import {createPharmacistDevelopmentScenario} from './pharmacist-development.mjs';
import {validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {prepareFacilityActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';
export const DISCIPLE_CRAFT_REQUEST_SCENARIO=Object.freeze({id:'disciple-craft-request-v1',conditions:Object.freeze(['ready','materials','qualification','commitment','unwilling','remote','hidden']),maxWorldSteps:5000});
export function createDiscipleCraftRequestScenario({condition='ready'}={}){
 if(!DISCIPLE_CRAFT_REQUEST_SCENARIO.conditions.includes(condition))throw Error('Unknown disciple craft request condition: '+condition);
 const f=createPharmacistDevelopmentScenario({condition:'growth'}),{session}=f,s=session.state,personId=f.pharmacistId,p=s.personsById[personId];
 p.mind.knowledge.alchemy=condition==='qualification'?34.5:35.1;
 Object.assign(s.stockpilesById[f.siteStockpileId].resources,{herb:75,cleanWater:condition==='materials'?0:6,wood:4,crystal:12});Object.assign(s.resources,{jade:200,insight:15,food:100});
 if(condition==='commitment'){p.mind.activity='cultivate';p.job=1;p.mind.commitUntil=s.time+60;p.schedule.commitUntilTick=s.worldTick+600;p.mind.reason='正在履行既有静修承诺。';prepareFacilityActivity(s,p,s.buildings.find(b=>b.id===1),'cultivate');}
 if(condition==='unwilling'){p.mind.traits=[0,10,50,0,10];p.mind.relationships.master.trust=0;}
 if(condition==='hidden'){const secret={id:s.society.nextIncidentId++,discipleId:p.id,kind:'book',subject:'alchemy',time:s.society.clock,discovered:false,discoveredAt:null,handled:false,outcome:null,evidenceProgress:0,motive:'既有私下研习记录。',restitution:12};s.society.secrets.push(secret);p.mind.hiddenKnowledge.alchemy=secret.id;s.incidentId=s.society.nextIncidentId;}
 const point=condition==='remote'?{x:57,y:31}:{x:p.position.x+.8,y:p.position.y};Object.assign(s.master.scenic,{...point,path:[],goal:null,revision:geometryRevision(s)});s.master.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',...point};s.master.location={kind:'local',sceneId:'scene:yunxiu-courtyard',...point};validateSect(session);
 const request={type:'request-disciple-craft',personId,recipeId:'foundation',buildingId:f.buildingId};
 return{...f,session,s,state:s,personId,recipeId:'foundation',request,metadata:{id:DISCIPLE_CRAFT_REQUEST_SCENARIO.id,condition,startTick:s.worldTick,personId,buildingId:f.buildingId,siteStockpileId:f.siteStockpileId,sourceStockpileId:f.sourceStockpileId,request,
  conditions:{completedCanonicalGC26:structuredClone(s.buildingsById[f.buildingId].transform),realm:p.realm,alchemy:p.mind.knowledge.alchemy,medicine:p.mind.skills.medicine,books:[...s.doctrine.books],siteMaterials:structuredClone(s.stockpilesById[f.siteStockpileId].resources),budget:{jade:s.resources.jade,insight:s.resources.insight,food:s.resources.food},masterPosition:structuredClone(s.master.position),personPosition:structuredClone(p.position),priorActivityId:p.activityId,priorJob:p.job,commitUntil:p.mind.commitUntil,hiddenAlchemy:condition==='hidden',willingPersonality:condition!=='unwilling'},
  scope:'Completed room, contact, finite resources and qualification/readiness are configured. Formal public request, own answer, four-stage work, growth and physical delivery must be earned by the authoritative world loop.'}};
}
