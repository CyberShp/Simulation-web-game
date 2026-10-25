/** U-172 finite 3/5-disciple conditions for the single authoritative world. */
import {createMedicineMaterialsScenario} from './medicine-materials.mjs';
import {recruit} from '../../src/simulation/ea-opening-sim.mjs';
import {commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {releaseBodyActivity,prepareFacilityActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {spatialPrefab,spatialAccess,visibleBodyPointClear,visibleBodyWalkPath} from '../../src/simulation/ea-sr-spatial.mjs';
import {facilitySlots} from '../../src/simulation/ea-facility-slots.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';
import {initPersons} from '../../src/simulation/ea-sr-persons.mjs';
import {initEconomy} from '../../src/simulation/ea-sr-economy.mjs';
export const SECT_CONCURRENCY_SCENARIO=Object.freeze({id:'sect-concurrency-v1',memberCounts:Object.freeze([3,5]),minimumDailySettlements:3,maxWorldSteps:7200});
const HOME='scene:yunxiu-courtyard';
function ready(s,p,x,y){releaseBodyActivity(s,p);p.activityId=null;p.job=null;p.energy=100;p.wound=0;p.realm=1;p.xp=0;p.talent=1;
 Object.assign(p.mind,{activity:'rest',reason:'有限供给与差事开放，待本人决定。',main:'qingyuan',support:[],learning:null,office:null,away:null,journey:null,satiety:100,mood:80,lastDecision:-100,commitUntil:0,lastSocial:s.society.clock,goal:'安稳生活，精进所长',traits:[70,10,50,80,10]});delete p.mind.recovering;
 p.mind.relationships.master.trust=80;p.mind.knowledge=Object.fromEntries(s.doctrine.books.map(id=>[id,100]));p.mind.skills={medicine:0,plant:0,array:0,industry:0,learning:0};p.schedule.commitUntilTick=s.worldTick;
 p.mind.scenic??={steps:0,facing:1,back:false,geometry:'spatial-metres-1'};Object.assign(p.mind.scenic,{x,y,path:[],goal:null,revision:geometryRevision(s)});delete p.mind.scenic.bodyYield;delete p.mind.scenic.waitingForPersonId;p.position={kind:'scene',sceneId:HOME,x,y};p.location={kind:'local',sceneId:HOME,x,y};
}
export function createSectConcurrencyScenario({memberCount=3}={}){
 if(!SECT_CONCURRENCY_SCENARIO.memberCounts.includes(memberCount))throw Error('Concurrency scene needs 3 or 5 disciples');
 const f=createMedicineMaterialsScenario({condition:'food-shortage'}),{session}=f;let s=session.state;
 const hall=s.buildings.find(b=>b.type==='hall'),house={id:93,instanceId:'building:yunxiu:93',type:'house',level:1,enabled:true,condition:100,progress:0,sceneId:HOME,domainSiteId:'site:domain:east-residence-1',buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',x:132,y:40,transform:{x:132,y:40,orientation:'south'}};house.prefabId=spatialPrefab(house).id;s.buildings.push(house);s.nextId=Math.max(s.nextId,94);s.spatial.geometryRevision++;initEconomy(s);
 Object.assign(s.resources,{jade:1500,herb:300,food:300});const initialIds=[...s.homeMemberIds],recruitment=[];
 while(s.homeMemberIds.length<memberCount){const before=new Set(s.homeMemberIds),result=recruit(s);const p=s.disciples.find(p=>!before.has(p.personId));if(!p)throw Error('Formal recruitment did not add a resident');recruitment.push({personId:p.personId,result:result?.personId||null});}
 initPersons(s);
 const memberIds=[...s.homeMemberIds],newIds=memberIds.filter(id=>!initialIds.includes(id)),pharmacistId=f.workerId,travellerId=f.travellerId,cultivatorId=newIds[0],producerIds=newIds.slice(1);
 const points=[[18,32],[34.5,26.6],[30,14],[25,30],[37,28]];
 for(const [i,id]of memberIds.entries())ready(s,s.personsById[id],...points[i]);
 const pharmacist=s.personsById[pharmacistId],traveller=s.personsById[travellerId],cultivator=s.personsById[cultivatorId];pharmacist.mind.skills.medicine=80;pharmacist.mind.skills.plant=80;
 traveller.mind.traits=[70,50,50,80,50];traveller.mind.goal='求索奇法';traveller.mind.skills.array=80;
 cultivator.mind.traits=[10,65,50,10,5];cultivator.mind.activity='cultivate';cultivator.job=hall.id;cultivator.mind.commitUntil=s.time+240;cultivator.mind.reason='已决定履行静修安排，按原工位持续精进。';prepareFacilityActivity(s,cultivator,hall,'cultivate');
 for(const [i,id]of producerIds.entries())s.personsById[id].mind.skills[i===0?'plant':'array']=80;
 Object.assign(s.resources,{jade:300,herb:60,food:50,wood:0,cleanWater:0,crystal:0,insight:0});s.stockpilesById[f.sourceStockpileId].pills.heal=1;
 Object.assign(s.stockpilesById[f.siteStockpileId].resources,{herb:10,cleanWater:2,wood:1});s.stockpilesById[f.siteStockpileId].pills.heal=0;s.stockpilesById[`stockpile:${f.grainId}`].resources.food=160;
 s.doctrine.pillRule='shared';for(const id of memberIds){s.personsById[id].mind.pillPermitDay=-1;s.personsById[id].mind.lastPillDay=-1;}
 const foe=s.personsById['person:valley-shanxiao'],foePoint=memberCount===5?{x:9,y:27}:{x:5,y:5};foe.location={kind:'local',sceneId:'scene:valley',...foePoint};foe.position={kind:'scene',sceneId:'scene:valley',...foePoint};
 const originalCommitment={personId:cultivatorId,activityId:cultivator.activityId,job:cultivator.job,commitUntil:cultivator.mind.commitUntil};
 const medicine=commandSect(session,{type:'medicine-supply',enabled:true,target:2});if(!medicine.ok)throw Error(medicine.error);
 const expedition=commandSect(session,{type:'disciple-expeditions',enabled:true});if(!expedition.ok)throw Error(expedition.error);s=session.state;validateSect(session);
 const residences=[s.buildingsById[house.instanceId],s.buildings.find(b=>b.type==='hall')],beds=residences.flatMap(b=>facilitySlots(s,b,'rest')),sources=[...facilitySlots(s,s.buildingsById[f.wellId],'work'),...facilitySlots(s,s.buildings.find(b=>b.type==='hall'),'cultivate')];
 if(!residences.every(b=>visibleBodyPointClear(s,spatialAccess(b)))||!beds.every(b=>visibleBodyPointClear(s,b.position)))throw Error('Configured residence requires visible entrance and every physical bed');
 for(const source of sources)for(const bed of beds)if(!visibleBodyWalkPath(s,source.position,bed.position)||!visibleBodyWalkPath(s,bed.position,source.position))throw Error('Configured residence needs both directions between actual work/cultivation slots and every bed');
 return{...f,session,state:s,s,memberIds,memberCount,pharmacistId,travellerId,cultivatorId,producerIds,originalCommitment,metadata:{id:SECT_CONCURRENCY_SCENARIO.id,memberCount,masterAdditional:true,startTick:s.worldTick,startTime:s.time,memberIds,pharmacistId,travellerId,cultivatorId,producerIds,recruitment,originalCommitment,housingPreflight:{bedCount:beds.length,sourceSlots:sources.map(x=>x.id),bidirectionalPairs:beds.length*sources.length},
  conditions:{completedBuildings:s.buildings.map(b=>({id:b.instanceId,type:b.type,level:b.level,transform:b.transform})),publicResources:structuredClone(s.resources),homeHeal:1,siteResources:structuredClone(s.stockpilesById[f.siteStockpileId].resources),grainHarvest:160,farmSeed:2,wellProcess:'water',sharedPills:true,initialFoe:structuredClone(foe.location),people:memberIds.map(id=>{const p=s.personsById[id];return{personId:id,traits:p.mind.traits,skills:p.mind.skills,position:p.position,energy:p.energy,wound:p.wound};})},
  scope:'3 or 5 disciples plus the master. Completed facilities, finite stocks and initial cultivation commitment are configured. Additional identities are generated by paid formal recruitment. Subsequent choices, travel, work, daily supply, medicine use and deliveries use official world ticks.'}};
}
