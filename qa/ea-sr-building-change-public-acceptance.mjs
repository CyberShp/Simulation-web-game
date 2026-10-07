/** SR-XF-006: occupied building changes through the production command gateway.
 * Each scenario starts from a normal opening and earns its materials through play.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from '../dist/ea-opening-sim.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';
import {meterCanStand,meterFindPath,polygonContains,spatialAccess,spatialFootprint,spatialPrefab,spatialSlots} from '../dist/ea-sr-spatial.mjs';

function earned(cost){const h=normalOpening();h.resources(cost);h.save();return h;}
function earnedLibraryMaterial(cost){const h=earned({...cost,herb:Math.max(cost.herb||0,2)}),building=h.s.buildings.find(b=>b.type==='library'),sourceId=`stockpile:${building.instanceId}`;const transfer=h.act('startTransport','stockpile:yunxiu',sourceId,'person:master',{herb:2});h.until(s=>s.workOrdersById[transfer.id].phase==='delivered','real library source receives herbs',2000);h.save();return h;}
function fork(h){return harness(S.validateSave(JSON.parse(JSON.stringify(h.s))));}
function courtyardPerson(s,id){const p=s.personsById[id];assert(p);return p;}

test('SR-XF-006-AC-01/03: occupied beds leave by real steps before a paid upgrade; new slots and entrance survive reload',t=>{
 const h=earned({jade:45,wood:30,stone:20,food:40}),hall=h.s.buildings.find(b=>b.type==='hall'),oldSlots=spatialSlots(hall,'rest').map(slot=>slot.id);
 const sleepers=s=>s.homeMemberIds.filter(id=>{const a=s.activitiesById[s.personsById[id].activityId];return a?.action==='rest'&&a.phase==='executing'&&a.targetId===hall.instanceId;});
 h.until(s=>sleepers(s).length>=2,'two autonomous occupants actually reach their beds',5000);h.save();
 const occupants=sleepers(h.s),before=Object.fromEntries(occupants.map(id=>[id,{...courtyardPerson(h.s,id).mind.scenic}])),original={...hall.transform},buildingId=hall.instanceId;
 const order=h.act('upgrade',hall.id);assert.deepEqual(h.s.buildingsById[buildingId].transform,original);assert.equal(h.s.buildingsById[buildingId].level,1);h.save();
 h.act('setSpeed',0);const frozen=JSON.stringify(h.s);S.tick(h.s,30);assert.equal(JSON.stringify(h.s),frozen,'pause cannot advance evacuation or construction');h.save();h.act('setSpeed',1);
 h.until(s=>s.workOrdersById[order.workOrderId]?.progressTicks>0,'workers safely leave before paid progress',1500);h.save();
 for(const id of occupants)assert(Math.hypot(courtyardPerson(h.s,id).mind.scenic.x-before[id].x,courtyardPerson(h.s,id).mind.scenic.y-before[id].y)>0,'occupant really moved');
 h.until(s=>!s.workOrdersById[order.workOrderId],'upgrade completion',1500);h.save();const upgraded=h.s.buildingsById[buildingId],result=h.s.spatial.completedOrders.at(-1);
 assert.equal(result.operation,'upgrade');assert.equal(result.phase,'completed');assert.equal(result.progressTicks,240);assert.equal(upgraded.level,2);assert.equal(spatialPrefab(upgraded).width,10);assert.equal(spatialSlots(upgraded,'rest').length,8);assert.deepEqual(spatialSlots(upgraded,'rest').slice(0,4).map(slot=>slot.id),oldSlots);
 for(const id of occupants){const p=courtyardPerson(h.s,id);assert(result.evacuations.some(e=>e.personId===id),'every original occupant is recorded as physically evacuated');assert(!polygonContains(p.mind.scenic,spatialFootprint(upgraded),.26));assert(meterCanStand(h.s,p.mind.scenic));assert.equal(p.mind.scenic.spatialEvacuationOrderId,undefined);}
 assert.notEqual(meterFindPath(h.s,{x:32,y:56},spatialAccess(upgraded),{maxSnap:0}),null);t.diagnostic(JSON.stringify({source:'normal opening/public commands',...h.counts,evacuated:occupants.length}));
});

test('SR-XF-006-AC-01/02: active worker exits before demolition; salvage and real stock remain traceable',t=>{
 const h=earned({jade:45,wood:30,stone:20,food:40}),building=h.s.buildings.find(b=>b.type==='lumber');let workerId=null;
 for(const id of h.s.homeMemberIds)if(h.act('inviteWork',id,building.instanceId).accepted){workerId=id;break;}assert(workerId,'a worker voluntarily accepts the lumber job');
 h.until(s=>{const p=courtyardPerson(s,workerId),a=s.activitiesById[p.activityId];return a?.action==='work'&&a.targetId===building.instanceId&&a.phase==='executing'&&polygonContains(p.mind.scenic,spatialFootprint(building));},'worker at a physical production slot',3000);
 h.until(s=>s.stockpilesById[`stockpile:${building.instanceId}`].resources.wood>0,'real lumber stock before demolition',2000);h.save();
 const identity=building.instanceId,order=h.act('demolish',building.id);assert(h.s.buildingsById[identity]);h.save();
 h.until(s=>!s.workOrdersById[order.workOrderId],'safe demolition',2000);h.save();const result=h.s.spatial.completedOrders.at(-1),stock=h.s.stockpilesById[`stockpile:${identity}`];
 assert.equal(result.operation,'demolish');assert.equal(result.phase,'completed');assert.equal(result.progressTicks,120);assert(result.evacuations.some(e=>e.personId===workerId&&e.action==='work'));assert.equal(h.s.buildingsById[identity],undefined);assert.equal(h.s.buildings.filter(b=>b.instanceId===identity).length,0);
 assert.deepEqual(result.salvage,Object.fromEntries(Object.entries(S.BUILDINGS.lumber.cost).map(([k,v])=>[k,Math.floor(v*.65)])));assert.equal(stock.removedBuildingId,identity);assert.equal(stock.buildingId,undefined);assert(stock.resources.wood>0);assert(meterCanStand(h.s,stock.position));assert(meterCanStand(h.s,courtyardPerson(h.s,workerId).mind.scenic));
 const once=JSON.stringify({resources:h.s.resources,stock:stock.resources,completed:h.s.spatial.completedOrders});for(let n=0;n<3;n++)S.tick(h.s,.1);assert.equal(JSON.stringify({resources:h.s.resources,stock:stock.resources,completed:h.s.spatial.completedOrders}),once,'demolition cannot salvage or settle stock twice');t.diagnostic(JSON.stringify({source:'normal opening/public commands',...h.counts,workerId}));
});

test('SR-XF-006-AC-01/02: transport inside the source rejects all building changes atomically; cancellation permits paid relocation',t=>{
 const root=earnedLibraryMaterial({jade:10,wood:8}),h=fork(root),building=h.s.buildings.find(b=>b.type==='library');h.until(s=>s.homeMemberIds.some(id=>polygonContains(courtyardPerson(s,id).mind.scenic,spatialFootprint(building),.26)),'library occupant reaches the source',3000);const personId=h.s.homeMemberIds.find(id=>polygonContains(courtyardPerson(h.s,id).mind.scenic,spatialFootprint(building),.26)),person=courtyardPerson(h.s,personId),origin={...building.transform};
 assert(polygonContains(person.mind.scenic,spatialFootprint(building),.26),'the worker is actually inside the source building');
 const sourceId=`stockpile:${building.instanceId}`,cargo=h.act('startTransport',sourceId,'stockpile:yunxiu',personId,{herb:1});h.save();assert.equal(h.s.workOrdersById[cargo.id].phase,'to-source');
 for(const [name,args] of [['relocate',[building.id,20,14]],['upgrade',[building.id]],['demolish',[building.id]]]){const original=JSON.stringify(h.s);assert.throws(()=>h.act(name,...args),/建筑内履行事务/);assert.equal(JSON.stringify(h.s),original,`${name} rejection changes no resource, cargo, person or building`);}
 h.act('cancelTransport',cargo.id);h.save();assert.equal(h.s.workOrdersById[cargo.id].phase,'cancelled');assert.equal(h.s.workOrdersById[cargo.id].returnedTo,sourceId);
 const target=S.recommendedPlacement(h.s,'library');assert(target);const first=h.act('relocate',building.id,target.x,target.y);h.until(s=>s.workOrdersById[first.workOrderId]?.progressTicks>=20,'first paid relocation work',1500);h.save();
 const used={...h.s.workOrdersById[first.workOrderId].usedCost},reserved={...h.s.reservationsById[h.s.workOrdersById[first.workOrderId].reservationId].cost},beforeCancel={...h.s.resources};const cancelled=h.act('cancelConstruction');assert.deepEqual(cancelled.refund,Object.fromEntries(Object.entries(reserved).map(([k,v])=>[k,v-(used[k]||0)])));
 assert.equal(cancelled.pending,true,'materials still at the site require a real return trip');assert.deepEqual(h.s.resources,beforeCancel,'request alone does not refund undelivered materials');assert.deepEqual(h.s.buildingsById[building.instanceId].transform,origin);h.save();h.until(s=>!s.workOrdersById[first.workOrderId],'unused relocation materials return to the warehouse',1500);const settled=h.s.spatial.completedOrders.findLast(o=>o.id===first.workOrderId);assert.equal(settled.phase,'cancelled');assert.deepEqual(settled.refund,cancelled.refund);const after=JSON.stringify(h.s.resources);assert.equal(h.act('cancelConstruction').alreadyCancelled,true);assert.equal(JSON.stringify(h.s.resources),after,'a second cancellation cannot refund again');h.save();
 const second=h.act('relocate',building.id,target.x,target.y);h.save();h.until(s=>!s.workOrdersById[second.workOrderId],'same building relocates after cancellation',2000);h.save();assert.deepEqual(h.s.buildingsById[building.instanceId].transform,{...target,orientation:'south'});assert.equal(h.s.buildings.filter(b=>b.instanceId===building.instanceId).length,1);assert.notEqual(meterFindPath(h.s,{x:32,y:56},spatialAccess(h.s.buildingsById[building.instanceId]),{maxSnap:0}),null);t.diagnostic(JSON.stringify({source:'normal opening/public commands',opening:root.counts,continuation:h.counts}));
});

test('SR-XF-006-AC-02: transport outside the source waits through relocation and delivers once at its new entrance',t=>{
 const root=earnedLibraryMaterial({jade:10,wood:8}),h=fork(root),building=h.s.buildings.find(b=>b.type==='library'),personId=h.s.homeMemberIds.find(id=>!polygonContains(courtyardPerson(h.s,id).mind.scenic,spatialFootprint(building),.26)),sourceId=`stockpile:${building.instanceId}`;
 assert(!polygonContains(courtyardPerson(h.s,personId).mind.scenic,spatialFootprint(building),.26));const before={source:h.s.stockpilesById[sourceId].resources.herb,public:h.s.resources.herb};
 const cargo=h.act('startTransport',sourceId,'stockpile:yunxiu',personId,{herb:1});h.save();const target=S.recommendedPlacement(h.s,'library');assert(target);const order=h.act('relocate',building.id,target.x,target.y);h.save();
 h.until(s=>!s.workOrdersById[order.workOrderId],'relocation while carrier waits outside',2000);h.save();assert.equal(h.s.buildingsById[building.instanceId].transform.x,target.x);assert.equal(h.s.workOrdersById[cargo.id].phase!=='cancelled',true);assert.deepEqual(h.s.stockpilesById[sourceId].position,{sceneId:'scene:yunxiu-courtyard',...spatialAccess(h.s.buildingsById[building.instanceId])});
 h.until(s=>s.workOrdersById[cargo.id].phase==='delivered','carrier reaches relocated source then the public stockpile',3000);h.save();assert.equal(h.s.resources.herb,before.public+1);assert.equal(h.s.stockpilesById[sourceId].resources.herb,before.source-1);assert.deepEqual(h.s.factsById[`fact:transport:${cargo.id}`].quantities,{herb:1});assert.equal(h.s.reservationsById[h.s.workOrdersById[cargo.id].reservationId],undefined);const delivered=JSON.stringify({public:h.s.resources.herb,fact:h.s.factsById[`fact:transport:${cargo.id}`]});for(let n=0;n<3;n++)S.tick(h.s,.1);assert.equal(JSON.stringify({public:h.s.resources.herb,fact:h.s.factsById[`fact:transport:${cargo.id}`]}),delivered);t.diagnostic(JSON.stringify({source:'normal opening/public commands',opening:root.counts,continuation:h.counts}));
});
