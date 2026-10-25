/** U-172 finite materials and completed GC26; all supply work starts afterwards. */
import {createWorkSpecializationScenario} from './work-specialization.mjs';
import {commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {enableServiceResources} from '../../src/simulation/ea-resource-types.mjs';
import {initEconomy,carriedStockpile} from '../../src/simulation/ea-sr-economy.mjs';
import {releaseBodyActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {spatialPrefab} from '../../src/simulation/ea-sr-spatial.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';

export const MEDICINE_SUPPLY_SCENARIO=Object.freeze({id:'medicine-supply-v1',conditions:Object.freeze(['ready','missing-material','no-worker','furnace-busy']),maxWorldSteps:12000,buildingId:'building:yunxiu:90'});
const HOME='stockpile:yunxiu',SCENE='scene:yunxiu-courtyard';
function put(s,p,x,y){const a=p===s.master?p.scenic:p.mind.scenic;Object.assign(a,{x,y,path:[],goal:null,revision:geometryRevision(s)});delete a.bodyYield;delete a.waitingForPersonId;p.position={kind:'scene',sceneId:SCENE,x,y};p.location={kind:'local',sceneId:SCENE,x,y};}
export function createMedicineSupplyScenario({condition='ready'}={}){
 if(!MEDICINE_SUPPLY_SCENARIO.conditions.includes(condition))throw Error('Unknown medicine supply condition: '+condition);
 const {session}=createWorkSpecializationScenario();for(const type of ['enable-courtyard-terrain','enable-domain','enable-valley','enable-west-workshops']){const r=commandSect(session,{type});if(!r.ok)throw Error(r.error);}
 let s=session.state;enableServiceResources(s);const buildingId=MEDICINE_SUPPLY_SCENARIO.buildingId,siteStockpileId=`stockpile:${buildingId}`;
 const b={id:90,instanceId:buildingId,type:'alchemy',level:1,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',domainSiteId:'site:domain:gc-26',sceneId:SCENE,enabled:true,condition:100,progress:0,x:-76,y:2,transform:{x:-76,y:2,orientation:'south'}};b.prefabId=spatialPrefab(b).id;s.buildings.push(b);s.nextId=Math.max(s.nextId,91);s.spatial.geometryRevision++;initEconomy(s);
 Object.assign(s.resources,{jade:200,herb:20,cleanWater:condition==='missing-material'?0:2,wood:1,food:1000});s.stockpilesById[HOME].capacity=10000;
 for(const id of [HOME,siteStockpileId,'stockpile:building:yunxiu:2','stockpile:building:yunxiu:80']){const stock=s.stockpilesById[id];if(stock.pills)for(const key of Object.keys(stock.pills))stock.pills[key]=0;if(id!==HOME)for(const key of ['herb','wood','cleanWater'])stock.resources[key]=0;}
 const workerId='person:lu-zhiwei',travellerId='person:lin-changfeng';
 for(const id of [workerId,travellerId]){const p=s.personsById[id];releaseBodyActivity(s,p);p.activityId=null;p.job=null;p.energy=100;p.wound=0;p.mind.satiety=100;p.mind.learning=null;p.mind.office=null;Object.assign(p.mind,{activity:'rest',lastDecision:-100,commitUntil:0,lastSocial:s.society.clock,reason:'供给机会开放，待本人权衡。'});p.mind.relationships.master.trust=80;put(s,p,id===workerId?27:24,15);}
 const worker=s.personsById[workerId],traveller=s.personsById[travellerId];worker.mind.skills.medicine=80;worker.mind.traits=[70,20,50,90,20];
 // A real initial daily commitment keeps the future traveller separate from
 // the first supply volunteer; ordinary scheduling can later change it.
 traveller.mind.traits=[70,50,50,80,50];traveller.mind.goal='求索奇法';traveller.mind.activity='cultivate';traveller.job=1;traveller.mind.commitUntil=s.time+30;
 if(condition==='no-worker')for(const id of [workerId,travellerId]){s.personsById[id].mind.traits=[0,20,50,0,20];s.personsById[id].mind.relationships.master.trust=0;}
 put(s,s.master,30,14);session.control={mode:'manual',idleMs:0};s.masterControl={mode:'manual',idleMs:0};
 let refillSourceStockpileId=null,initialCraft=null;
 if(condition==='missing-material'){refillSourceStockpileId=carriedStockpile(s);s.stockpilesById[refillSourceStockpileId].resources.cleanWater=2;}
 if(condition==='furnace-busy'){Object.assign(s.stockpilesById[siteStockpileId].resources,{herb:10,cleanWater:2,wood:1});const r=commandSect(session,{type:'craft-pill',buildingId,recipeId:'heal'});if(!r.ok)throw Error(r.error);initialCraft=r.result;s=session.state;}
 const foe=s.personsById['person:valley-shanxiao'];foe.location={kind:'local',sceneId:'scene:valley',x:5,y:5};foe.position={kind:'scene',sceneId:'scene:valley',x:5,y:5};validateSect(session);
 return{session,state:s,s,buildingId,siteStockpileId,sourceStockpileId:HOME,refillSourceStockpileId,workerId,carrierId:workerId,travellerId,metadata:{id:MEDICINE_SUPPLY_SCENARIO.id,condition,startTick:s.worldTick,buildingId,siteStockpileId,sourceStockpileId:HOME,refillSourceStockpileId,initialCraft,
  conditions:{configuredCompletedCanonicalGC26:{...b.transform},siteMaterials:structuredClone(s.stockpilesById[siteStockpileId].resources),sourceMaterials:{herb:s.resources.herb,cleanWater:s.resources.cleanWater,wood:s.resources.wood,jade:s.resources.jade},homeHeal:s.stockpilesById[HOME].pills.heal,siteHeal:s.stockpilesById[siteStockpileId].pills.heal,privateWater:refillSourceStockpileId?2:0,workerMedicineSkill:80,travellerInitialDuty:'cultivate',food:1000},
  scope:'Completed room, finite source materials and initial personnel conditions are configured; supply commands, all transportation, four stages, pill receipt and subsequent expedition are executed by official logic.'}};
}
