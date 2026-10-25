/** U-172 missing inputs; actual existing production and transportation supply them. */
import {createMedicineSupplyScenario} from './medicine-supply.mjs';
import {commandSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {initEconomy} from '../../src/simulation/ea-sr-economy.mjs';
import {spatialPrefab,spatialAccess,visibleBodyPointClear,visibleBodyWalkPath} from '../../src/simulation/ea-sr-spatial.mjs';
import {facilitySlots} from '../../src/simulation/ea-facility-slots.mjs';
import {releaseBodyActivity,prepareFacilityActivity} from '../../src/simulation/ea-facility-activities.mjs';
import {geometryRevision} from '../../src/simulation/ea-scene-geometry.mjs';
export const MEDICINE_MATERIALS_SCENARIO=Object.freeze({id:'medicine-materials-v1',conditions:Object.freeze(['ready','no-worker','food-shortage','committed']),maxWorldSteps:16000});
const SCENE='scene:yunxiu-courtyard';
function addBuilding(s,id,type,x,y){const b={id,instanceId:`building:yunxiu:${id}`,type,level:1,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',enabled:true,condition:100,progress:0,x,y,sceneId:SCENE,transform:{x,y,orientation:'south'}};b.prefabId=spatialPrefab(b).id;s.buildings.push(b);s.nextId=Math.max(s.nextId,id+1);s.spatial.geometryRevision++;return b;}
function put(s,p,x,y){Object.assign(p.mind.scenic,{x,y,path:[],goal:null,revision:geometryRevision(s)});delete p.mind.scenic.bodyYield;p.position={kind:'scene',sceneId:SCENE,x,y};p.location={kind:'local',sceneId:SCENE,x,y};}
export function createMedicineMaterialsScenario({condition='ready',wellMode='water'}={}){
 if(!MEDICINE_MATERIALS_SCENARIO.conditions.includes(condition))throw Error('Unknown medicine materials condition: '+condition);
 const f=createMedicineSupplyScenario(),{session,workerId,travellerId}=f;let s=session.state;
 const well=addBuilding(s,91,'well',36,24),grain=condition==='food-shortage'?addBuilding(s,92,'granary',20,24):null;initEconomy(s);
 const farmId='building:yunxiu:2',wellId=well.instanceId,grainId=grain?.instanceId||null;
 s.resources.herb=0;s.resources.cleanWater=0;s.resources.food=condition==='food-shortage'?5:1000;
 s.stockpilesById[`stockpile:${farmId}`].resources.herb=2;s.stockpilesById[`stockpile:${wellId}`].resources.cleanWater=0;
 if(grain)s.stockpilesById[`stockpile:${grainId}`].resources.food=160;
 for(const id of [workerId,travellerId]){const p=s.personsById[id];releaseBodyActivity(s,p);p.activityId=null;p.job=null;Object.assign(p.mind,{activity:'rest',commitUntil:0,lastDecision:-100,reason:'公库药材有缺口，待本人权衡生产与生活。'});p.schedule.commitUntilTick=s.worldTick;}
 s.personsById[workerId].mind.skills.plant=80;s.personsById[workerId].mind.skills.array=0;
 s.personsById[travellerId].mind.skills.plant=0;s.personsById[travellerId].mind.skills.array=100;
 put(s,s.personsById[workerId],18,32);put(s,s.personsById[travellerId],34.5,26.6);
 if(condition==='no-worker')for(const id of [workerId,travellerId]){s.personsById[id].mind.traits=[0,20,50,0,20];s.personsById[id].mind.relationships.master.trust=0;}
 if(condition==='committed'){const p=s.personsById[workerId];p.job=80;p.mind.activity='work';p.mind.commitUntil=s.time+60;prepareFacilityActivity(s,p,s.buildingsById['building:yunxiu:80'],'work');}
 let wellModeCommand=null;if(wellMode==='water'){wellModeCommand=commandSect(session,{type:'well-production',buildingId:wellId,mode:'water'});if(!wellModeCommand.ok)throw Error(wellModeCommand.error);s=session.state;}else if(wellMode!=='crystal')throw Error('Unknown well mode');
 validateSect(session);const entry=spatialAccess(s.buildingsById[wellId]),stations=facilitySlots(s,s.buildingsById[wellId],'work');if(!visibleBodyPointClear(s,entry)||!stations.every(slot=>visibleBodyPointClear(s,slot.position))||!visibleBodyWalkPath(s,s.stockpilesById[f.sourceStockpileId].position,entry)||!visibleBodyWalkPath(s,entry,spatialAccess(s.buildingsById[f.buildingId])))throw Error('Configured well needs visible, physically connected access and workstations');
 if(grain){const actual=s.buildingsById[grainId],access=spatialAccess(actual);if(!visibleBodyPointClear(s,access)||!facilitySlots(s,actual,'work').every(slot=>visibleBodyPointClear(s,slot.position))||!visibleBodyWalkPath(s,access,s.stockpilesById[f.sourceStockpileId].position))throw Error('Configured grain field needs visible workstations and an actual food-delivery route');}
 return{...f,state:s,s,session,farmId,wellId,grainId,metadata:{id:MEDICINE_MATERIALS_SCENARIO.id,condition,startTick:s.worldTick,sourceFixture:f.metadata,farmId,wellId,grainId,wellModeCommand,
  conditions:{publicHerb:0,publicCleanWater:0,farmInitialSeedHerb:2,publicFood:s.resources.food,initialHarvestedGrain:grain?160:0,configuredGrainField:grain?{...grain.transform}:null,configuredCompletedOrdinaryWell:{...well.transform},wellMode,workerPlant:80,travellerArray:100,commitment:condition==='committed'?'Existing lumber work until initial time +60 seconds':null},
  scope:'Existing ordinary well configured complete at legal original-courtyard coordinates, then changed by the formal water-process command. This is production acceptance, not GC23 construction or terrain acceptance. Only seed/food/personnel conditions are configured; material output and medicine must come from official ticks.'}};
}
