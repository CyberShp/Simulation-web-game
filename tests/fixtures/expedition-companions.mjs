/** U-172: three existing residents; two voluntary travellers and one committed keeper. */
import {createSectConcurrencyScenario} from './sect-concurrency.mjs';
import {advanceSect,commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {releaseBodyActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';
import {visibleBodyPointClear} from '../../src/simulation/ea-sr-spatial.mjs';

export const EXPEDITION_COMPANIONS_SCENARIO=Object.freeze({id:'expedition-companions-v1',conditions:Object.freeze(['safe','contact-shortage','declined']),maxWorldSteps:6500});
const HOME='scene:yunxiu-courtyard',VALLEY='scene:valley',STOCK='stockpile:yunxiu',FOE='person:valley-shanxiao';
function ready(s,p,{x,y,declined=false}){
 releaseBodyActivity(s,p);p.activityId=null;p.job=null;p.realm=1;p.xp=0;p.wound=0;p.energy=100;
 Object.assign(p.mind,{main:'qingyuan',support:[],activity:'rest',reason:'结伴机会开放，仍由本人权衡出行与留院。',learning:null,office:null,away:null,journey:null,goal:'求索奇法，积累见闻',traits:declined?[70,10,50,80,10]:[70,50,50,80,50],satiety:100,lastDecision:-100,commitUntil:0});
 delete p.mind.recovering;p.mind.skills.industry=80;p.mind.pillPermitDay=-1;p.mind.lastPillDay=-1;p.schedule.commitUntilTick=s.worldTick;
 Object.assign(p.mind.scenic,{x,y,path:[],goal:null,revision:geometryRevision(s)});delete p.mind.scenic.bodyYield;delete p.mind.scenic.waitingForPersonId;
 p.position={kind:'scene',sceneId:HOME,x,y};p.location={kind:'local',sceneId:HOME,x,y};
}
export function createExpeditionCompanionsScenario({condition='safe'}={}){
 if(!EXPEDITION_COMPANIONS_SCENARIO.conditions.includes(condition))throw Error('Unknown companion scenario condition');
 const f=createSectConcurrencyScenario({memberCount:3}),{session}=f;let s=session.state;
 const leaderId=f.travellerId,companionId=f.pharmacistId,stayId=f.cultivatorId;
 ready(s,s.personsById[leaderId],{x:25,y:17});ready(s,s.personsById[companionId],{x:27,y:15,declined:condition==='declined'});
 s.personsById[leaderId].mind.traits=[70,60,50,80,60];
 for(const id of [leaderId,companionId])if(!visibleBodyPointClear(s,s.personsById[id].position))throw Error('Configured traveller feet must be on the visible legal ground');
 s.stockpilesById[STOCK].pills.heal=condition==='contact-shortage'?1:2;s.doctrine.pillRule='shared';
 const foe=s.personsById[FOE];foe.location={kind:'local',sceneId:VALLEY,x:5,y:5};foe.position={kind:'scene',sceneId:VALLEY,x:5,y:5};
 for(const request of [{type:'medicine-supply',enabled:false,target:2},{type:'disciple-expeditions',enabled:false,allowCompanions:false}]){const r=commandSect(session,request);if(!r.ok)throw Error(r.error);}
 s=session.state;const initialTick=s.worldTick,initial={homeFood:s.resources.food,homeHerb:s.resources.herb,homePills:s.stockpilesById[STOCK].pills.heal,people:[leaderId,companionId,stayId].map(id=>{const p=s.personsById[id];return{personId:id,position:structuredClone(p.position),realm:p.realm,xp:p.xp,energy:p.energy,wound:p.wound,traits:[...p.mind.traits],goal:p.mind.goal,body:p.activityId,job:p.job,commitUntil:p.mind.commitUntil};}),stockpiles:[STOCK,'stockpile:building:yunxiu:80'].map(id=>({id,resources:structuredClone(s.stockpilesById[id].resources),capacity:s.stockpilesById[id].capacity})),buildings:s.buildings.map(b=>({id:b.instanceId,type:b.type,transform:structuredClone(b.transform)}))};
 const prelude={worldSteps:0,phases:[],crisis:null};
 if(condition==='contact-shortage'){
  const r=commandSect(session,{type:'disciple-expeditions',enabled:true,allowCompanions:true});if(!r.ok)throw Error(r.error);
  let previous='';
  for(let n=0;n<2000;n++){
   if(n%100===0){const out=commandSect(session,{type:'manual'});if(!out.ok)throw Error(out.error);}advanceSect(session,.1);s=session.state;
   const js=s.discipleExpeditions.journeys.filter(j=>[leaderId,companionId].includes(j.personId)),key=js.map(j=>`${j.personId}:${j.phase}`).join('|');
   if(key!==previous){prelude.phases.push({tick:s.worldTick,journeys:js.map(j=>({id:j.id,personId:j.personId,phase:j.phase,party:structuredClone(j.party||null),position:structuredClone(s.personsById[j.personId].position),activityId:s.personsById[j.personId].activityId,travelProgress:s.travelsById[j.travelId]?.progressTicks??null}))});previous=key;}
   const ps=[leaderId,companionId].map(id=>s.personsById[id]);
   if(js.length===2&&js.every(j=>j.party&&j.phase==='scouting'&&!j.encounter&&j.valleyTrail.length>1)&&ps.every(p=>p.location.sceneId===VALLEY&&p.wound===0&&Math.hypot(p.location.x-7,p.location.y-27)>8)){
    const [a,b]=ps.map(p=>p.location),distance=Math.hypot(a.x-b.x,a.y-b.y);if(distance>4)continue;
    const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},height=Math.sqrt(Math.max(0,4-distance*distance/4)),point=distance>.001?{x:mid.x-(b.y-a.y)/distance*height,y:mid.y+(b.x-a.x)/distance*height}:{x:mid.x,y:mid.y+2};
    const foe=s.personsById[FOE];foe.location={kind:'local',sceneId:VALLEY,...point};foe.position={kind:'scene',sceneId:VALLEY,...point};
    prelude.worldSteps=n+1;prelude.crisis={configuredAtTick:s.worldTick,foePosition:structuredClone(foe.position),people:ps.map(p=>({personId:p.personId,position:structuredClone(p.position),wound:p.wound,distance:Math.hypot(p.position.x-point.x,p.position.y-point.y)})),journeys:js.map(j=>({id:j.id,personId:j.personId,phase:j.phase,trailPoints:j.valleyTrail.length,medicine:structuredClone(j.medicine)}))};break;
   }
  }
  if(!prelude.crisis)throw Error('Real voluntary pair did not reach an uninjured shared mid-valley crisis starting point');
 }
 s=session.state;validateSect(session);
 return{session,state:s,s,leaderId,companionId,travellerIds:[leaderId,companionId],stayId,memberIds:[...s.homeMemberIds],sourceStockpileId:STOCK,productionBuildingId:'building:yunxiu:80',carryStockpileIds:Object.fromEntries([leaderId,companionId].map(id=>[id,`stockpile:carried:${id.slice(7)}`])),originalCommitment:f.originalCommitment,metadata:{id:EXPEDITION_COMPANIONS_SCENARIO.id,condition,initialTick,startTick:s.worldTick,leaderId,companionId,stayId,initial,prelude,configuredCanonicalResidence:f.metadata.conditions.completedBuildings.find(b=>b.id==='building:yunxiu:93'),originalCommitment:f.originalCommitment,scope:'Three disciples plus the master. Finite food, medicine, completed housing and two nearby willing personalities are configured; a third resident retains an existing cultivation commitment. Contact setup first actually prepares and walks a voluntary pair to the uninjured middle of the valley, then configures the initial two-metre enemy crisis. Observation, damage, sharing, treatment, return and subsequent production must be earned by the authoritative world.'}};
}
