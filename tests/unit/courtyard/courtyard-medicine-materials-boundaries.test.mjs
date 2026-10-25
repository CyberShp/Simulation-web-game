import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceSect,commandSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';
import {medicineMaterialNeeds,medicineMaterialWorkCandidate,medicineMaterialTransportCandidate,beginMedicineMaterialTransport} from '../../../src/simulation/ea-medicine-materials.mjs';
import {createMedicineSupplyScenario} from '../../fixtures/medicine-supply.mjs';
import {initEconomy,productionVersionFor,PRODUCTION_RECIPE_VERSION,SPRING_WATER_RECIPE_VERSION} from '../../../src/simulation/ea-sr-economy.mjs';
import {spatialPrefab} from '../../../src/simulation/ea-sr-spatial.mjs';

const HOME='stockpile:yunxiu',FARM='building:yunxiu:2';
function fixture(){
 const f=createMedicineSupplyScenario({condition:'ready'}),s=f.session.state;
 s.stockpilesById[HOME].resources.herb=0;s.stockpilesById[HOME].resources.cleanWater=0;
 s.stockpilesById[`stockpile:${FARM}`].resources.herb=2;
 const reply=commandSect(f.session,{type:'medicine-supply',enabled:true,target:2});assert(reply.ok,reply.error);
 validateSect(f.session);return f;
}
const person=f=>f.session.state.personsById[f.workerId];
const farm=f=>f.session.state.buildingsById[FARM];

test('food shortage suppresses new medicine preferences and tasks while observations stay read-only',()=>{
 const f=fixture(),s=f.session.state,p=person(f);
 assert.equal(medicineMaterialWorkCandidate(s,p,farm(f))?.scoreBonus,24,'the high-food control must actually have a useful medicine preference');
 assert(medicineMaterialTransportCandidate(s,p),'the high-food control has public wood to transport');
 s.stockpilesById[HOME].resources.food=34;const before=JSON.stringify(s),needs=medicineMaterialNeeds(s);
 assert.equal(needs.foodProtected,true);assert.equal(needs.foodTarget,35);
 for(let n=0;n<3;n++){
  assert.equal(medicineMaterialWorkCandidate(s,p,farm(f)),null);
  assert.equal(medicineMaterialTransportCandidate(s,p),null);medicineMaterialNeeds(s);
 }
 assert.equal(JSON.stringify(s),before);
 advanceSect(f.session,.1);assert.equal(f.session.state.medicineSupply.active,null);
 assert.match(f.session.state.medicineSupply.reason,/口粮|生活储备/);
});

test('a material transport reserves only actual surplus, retains crop seed, and is counted in transit',()=>{
 const f=fixture(),s=f.session.state,p=person(f),source=s.stockpilesById[`stockpile:${FARM}`],site=s.stockpilesById[f.siteStockpileId];
 // Only one surplus herb is available after the existing two-herb crop seed.
 source.resources.herb=3;s.stockpilesById[HOME].resources.wood=0;site.resources.wood=1;site.resources.cleanWater=2;
 const candidate=medicineMaterialTransportCandidate(s,p);assert(candidate);
 assert.equal(candidate.sourceStockpileId,source.id);assert.deepEqual(candidate.cargo,{herb:1});
 const result=beginMedicineMaterialTransport(s,p,candidate);assert.equal(result.accepted,true,result.reason);
 const w=s.workOrdersById[result.id];assert.equal(w.phase,'to-source');assert.equal(w.carrierId,p.personId);
 assert.equal(source.resources.herb,2);assert.equal(site.resources.herb,0,'a reservation is not an onsite delivery');
 assert.equal(source.resources.herb+w.cargo.herb+site.resources.herb,3);
 const needs=medicineMaterialNeeds(s);assert.equal(needs.materials.herb.transit,1);assert.equal(needs.materials.herb.deficit,9);
 assert.equal(needs.materials.herb.available,0,'the reserved crop seed cannot be counted again');validateSect(f.session);
});

test('an existing accepted job is not replaced by a medicine preference or transport',()=>{
 const f=fixture(),reply=commandSect(f.session,{type:'invite-work',personId:f.workerId,buildingId:'building:yunxiu:80'});
 assert(reply.ok,reply.error);assert.equal(reply.result.accepted,true);
 const s=f.session.state,p=person(f),job=p.job;
 assert.equal(medicineMaterialWorkCandidate(s,p,farm(f)),null);assert.equal(medicineMaterialTransportCandidate(s,p),null);
 for(let n=0;n<20;n++)advanceSect(f.session,.1);
 const current=person(f);assert.equal(current.job,job);assert.equal(current.mind.activity,'work');
 assert.equal(f.session.state.activitiesById[current.activityId]?.targetId,'building:yunxiu:80');validateSect(f.session);
});

test('missing seed or usable source cannot create a medicine opportunity, and off or target coverage removes it',()=>{
 const f=fixture(),s=f.session.state,p=person(f),source=s.stockpilesById[`stockpile:${FARM}`];
 source.resources.herb=0;assert.equal(medicineMaterialWorkCandidate(s,p,farm(f)),null);
 source.resources.herb=2;farm(f).enabled=false;assert.equal(medicineMaterialWorkCandidate(s,p,farm(f)),null);farm(f).enabled=true;
 assert(medicineMaterialNeeds(s).materials.cleanWater.productionDeficit>0);
 assert(!s.buildings.some(b=>medicineMaterialWorkCandidate(s,p,b)?.resource==='cleanWater'),'this fixture has no completed clean-water source');
 assert.equal(medicineMaterialWorkCandidate(s,p,farm(f))?.scoreBonus,24);
 const off=commandSect(f.session,{type:'medicine-supply',enabled:false,target:2});assert(off.ok,off.error);
 assert.equal(medicineMaterialWorkCandidate(f.session.state,person(f),farm(f)),null);
 assert.equal(medicineMaterialTransportCandidate(f.session.state,person(f)),null);
 const on=commandSect(f.session,{type:'medicine-supply',enabled:true,target:2});assert(on.ok,on.error);
 f.session.state.stockpilesById[HOME].pills.heal=2; // U-172 initial target-coverage boundary.
 assert.equal(medicineMaterialNeeds(f.session.state).needed,false);
 assert.equal(medicineMaterialWorkCandidate(f.session.state,person(f),farm(f)),null);
 assert.equal(medicineMaterialTransportCandidate(f.session.state,person(f)),null);validateSect(f.session);
});

test('a normal well retains its default recipe and a real water batch rejects an atomic mid-batch switch',()=>{
 const f=fixture(),s=f.session.state,id='building:yunxiu:91';
 // U-172 completed ordinary well at a legal original-courtyard position. This
 // does not create the future GC23 site or any production outcome.
 const b={id:91,instanceId:id,type:'well',level:1,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',sceneId:'scene:yunxiu-courtyard',enabled:true,condition:100,progress:0,x:44,y:40,transform:{x:44,y:40,orientation:'south'}};
 b.prefabId=spatialPrefab(b).id;s.buildings.push(b);s.nextId=Math.max(s.nextId,92);s.spatial.geometryRevision++;initEconomy(s);validateSect(f.session);
 assert.equal(productionVersionFor(b),PRODUCTION_RECIPE_VERSION);
 assert.equal(medicineMaterialWorkCandidate(s,person(f),b),null,'ordinary crystal production is not clean-water production');
 const mode=commandSect(f.session,{type:'well-production',buildingId:id,mode:'water'});assert(mode.ok,mode.error);
 assert.equal(productionVersionFor(f.session.state.buildingsById[id]),SPRING_WATER_RECIPE_VERSION);
 const invitation=commandSect(f.session,{type:'invite-work',personId:f.workerId,buildingId:id});assert(invitation.ok,invitation.error);assert.equal(invitation.result.accepted,true);
 const order=()=>f.session.state.workOrdersById[`work:production:${id}`];
 for(let n=0;n<1500&&!order();n++){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);}
 assert(order());assert.equal(order().recipeSnapshot.recipeVersion,SPRING_WATER_RECIPE_VERSION);
 const before=JSON.stringify(f.session.state),switching=commandSect(f.session,{type:'well-production',buildingId:id,mode:'crystal'});
 assert.equal(switching.ok,false);assert.match(switching.error,/未完|批次/);assert.equal(JSON.stringify(f.session.state),before);
 for(let n=0;n<1500&&order().phase!=='completed';n++){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);}
 assert.equal(order().phase,'completed');
 const fact=Object.values(f.session.state.factsById).find(v=>v.operation==='production'&&v.workOrderId===order().id);
 assert(fact?.participantIds.includes(f.workerId));assert(fact.quantities.cleanWater>0);
 assert.equal(fact.quantities.crystal,undefined);validateSect(f.session);
});
