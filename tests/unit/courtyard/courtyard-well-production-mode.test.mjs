import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkSpecializationScenario} from '../../fixtures/work-specialization.mjs';
import {commandSect,advanceSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {initEconomy,productionVersionFor,SPRING_WATER_RECIPE_VERSION,PRODUCTION_RECIPE_VERSION,setWellProduction,validateEconomy} from '../../../src/simulation/ea-sr-economy.mjs';
import {enableServiceResources} from '../../../src/simulation/ea-resource-types.mjs';
import {spatialPrefab} from '../../../src/simulation/ea-sr-spatial.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
const ID='building:yunxiu:90';
function fixture(){const f=createWorkSpecializationScenario(),s=f.s,b={id:90,instanceId:ID,type:'well',level:1,sceneId:'scene:yunxiu-courtyard',x:40,y:40,transform:{x:40,y:40,orientation:'south'},enabled:true,condition:100,progress:0,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1'};b.prefabId=spatialPrefab(b).id;s.buildings.push(b);s.nextId=91;s.spatial.geometryRevision++;initEconomy(s);return{...f,b};}

test('a normal well retains crystal by default and its explicit water operation requires life supplies',()=>{
 const f=fixture(),s=f.s,b=f.b;assert.equal(b.domainSiteId,undefined);assert.equal(productionVersionFor(b),PRODUCTION_RECIPE_VERSION);
 let before=JSON.stringify(s);assert.throws(()=>setWellProduction(s,ID,'water'),/生活物资/);assert.equal(JSON.stringify(s),before);
 enableServiceResources(s);assert.deepEqual(setWellProduction(s,ID,'water'),{buildingId:ID,mode:'water',recipeVersion:SPRING_WATER_RECIPE_VERSION});assert.equal(b.wellProductionVersion,SPRING_WATER_RECIPE_VERSION);assert.equal(b.domainSiteId,undefined);assert.equal(productionVersionFor(b),SPRING_WATER_RECIPE_VERSION);assert.equal(validateEconomy(s),true);
 assert.deepEqual(setWellProduction(s,ID,'crystal'),{buildingId:ID,mode:'crystal',recipeVersion:PRODUCTION_RECIPE_VERSION});assert.equal(Object.hasOwn(b,'wellProductionVersion'),false);
 before=JSON.stringify(s);assert.throws(()=>setWellProduction(s,ID,'unknown'));assert.equal(JSON.stringify(s),before);
 b.domainSiteId='site:domain:gc-23';before=JSON.stringify(s);assert.throws(()=>setWellProduction(s,ID,'crystal'),/固定供水/);assert.equal(JSON.stringify(s),before);delete b.domainSiteId;
});

test('the selected operation produces real clean water, refuses changing an unfinished batch, and preserves the completed snapshot',()=>{
 const f=fixture();enableServiceResources(f.s);setWellProduction(f.s,ID,'water');const worker=f.people[0].personId;
 const invite=commandSect(f.session,{type:'invite-work',personId:worker,buildingId:ID});assert.equal(invite.ok,true,invite.error);assert.equal(invite.result.accepted,true);let s=f.session.state,first=null,seenWork=false;
 for(let n=0;n<600;n++){
  advanceSect(f.session,.1);s=f.session.state;const order=s.workOrdersById['work:production:'+ID],p=s.personsById[worker],a=s.activitiesById[p.activityId];
  if(order?.progressTicks>0&&!seenWork){seenWork=true;const slot=slotById(s,a.slotId);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);assert.equal(order.recipeSnapshot.recipeVersion,SPRING_WATER_RECIPE_VERSION);const before=JSON.stringify(s);assert.throws(()=>setWellProduction(s,ID,'crystal'),/未完生产/);assert.equal(JSON.stringify(s),before);}
  first=Object.values(s.factsById).find(x=>x.operation==='production'&&x.workOrderId==='work:production:'+ID);if(first)break;
 }
 assert(seenWork);assert(first);assert(first.grossOutput.cleanWater>0);assert.equal(first.grossOutput.crystal,undefined);assert(first.participantIds.includes(worker));assert(s.stockpilesById['stockpile:'+ID].resources.cleanWater>0);assert.equal(s.stockpilesById['stockpile:'+ID].resources.crystal,0);
 const snapshot=structuredClone(s.workOrdersById['work:production:'+ID].recipeSnapshot);setWellProduction(s,ID,'crystal');assert.deepEqual(s.workOrdersById['work:production:'+ID].recipeSnapshot,snapshot);assert.equal(productionVersionFor(s.buildingsById[ID]),PRODUCTION_RECIPE_VERSION);assert.equal(validateSect(f.session),true);
});

test('well operation metadata rejects wrong versions and non-well buildings without rewriting state',()=>{
 const f=fixture();enableServiceResources(f.s);
 for(const condition of ['version','building']){const s=structuredClone(f.s);if(condition==='version')s.buildingsById[ID].wellProductionVersion='unknown';else s.buildingsById[f.buildingIds.plant].wellProductionVersion=SPRING_WATER_RECIPE_VERSION;const before=JSON.stringify(s);assert.throws(()=>validateEconomy(s),/水井工序/);assert.equal(JSON.stringify(s),before);}
});
