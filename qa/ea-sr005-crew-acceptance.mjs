import test from 'node:test';
import assert from 'node:assert/strict';
import * as base from '../dist/ea-sim.mjs';
import {initial,initSR,validateSave,dispatchCommand,tick} from '../dist/ea-opening-sim.mjs';
import {handlers,tickSpatial,validateSpatial} from '../dist/ea-sr-spatial.mjs';

function world(names=[]){
 const s=initial({sr:true});s.master.wound=0;s.master.energy=100;s.speed=1;
 for(const key of Object.keys(s.resources))s.resources[key]=10000;
 for(const [index,name] of names.entries()){
  const p=base.addDisciple(s,{name,traits:[65,64,52,62,60]});p.wound=0;p.energy=100;p.mind.satiety=100;p.mind.activity='rest';
  Object.assign(p.mind.scenic,{x:25+index*.7,y:14,path:[],goal:null});
 }
 initSR(s);return s;
}
function step(s,count=1){for(let i=0;i<count;i++)tick(s,.1);}
function until(s,predicate,max=1500){for(let i=0;i<max;i++){if(predicate())return i;step(s);}assert.fail(`condition did not become true within ${max} world ticks`);}
function order(s){const a=s.activitiesById[s.master.activityId];return a&&s.workOrdersById[a.workOrderId];}

test('SR-XF-005-I01: confirmed site keeps two deterministic exclusive feet and a single material reservation',()=>{
 const s=world(['甲','乙']),before=structuredClone(s.resources),result=handlers.build(s,'farm',12,24),o=order(s);
 assert.equal(result.workOrderId,o.id);assert.equal(o.workSlots.length,2);assert.deepEqual(o.workSlots.map(x=>x.id),[`${o.id}/slot:1`,`${o.id}/slot:2`]);
 assert.equal(Object.keys(s.reservationsById).filter(id=>id.startsWith('reservation:build:')).length,1);
 assert.equal(o.progressTicks,0);assert.notDeepEqual(s.resources,before);
 const feet=o.workSlots.map(x=>({...x.position}));step(s,1);assert.deepEqual(o.workSlots.map(x=>x.position),feet);
 until(s,()=>o.materialFlow.phase==='ready'&&o.workSlots.every(x=>x.occupantId)&&o.progressTicks>0);
 assert.equal(new Set(o.workSlots.map(x=>x.occupantId)).size,2);assert.ok(o.activityIds.length<=3);
 const prior=o.progressTicks;step(s);assert.equal(o.progressTicks-prior,2,'two arrived workers contribute at most one each in stable person order');
 assert.deepEqual(o.workSlots.map(x=>x.position),feet);validateSpatial(s);
});

test('SR-XF-005-I01: progress and arrivals survive exact save/reload without a read-time tick',()=>{
 let s=world(['甲','乙']);const {state}=dispatchCommand(s,{name:'build',args:['farm',12,24]});s=state;
 const o=order(s);until(s,()=>o.progressTicks>=20&&o.workSlots.every(x=>x.occupantId));
 const saved=JSON.parse(JSON.stringify(s)),tick=s.worldTick,progress=o.progressTicks,slots=structuredClone(o.workSlots),used=structuredClone(o.usedCost);
 const restored=validateSave(saved),continued=order(restored);
 assert.equal(restored.worldTick,tick);assert.equal(continued.progressTicks,progress);assert.deepEqual(continued.workSlots,slots);assert.deepEqual(continued.usedCost,used);
 assert.deepEqual(continued.activityIds,o.activityIds);step(restored);assert.ok(continued.progressTicks>progress);validateSave(restored);
});

test('SR-XF-005-I01: save checks the occupied worker foot while a distant moving reservation remains legal',()=>{
 const moving=world(['甲']);handlers.build(moving,'farm',12,24);
 until(moving,()=>{const a=moving.activitiesById[moving.personsById[moving.homeMemberIds[0]].activityId],slot=order(moving).workSlots.find(x=>x.id===a?.slotId);return slot&&a.slotArrived===false&&Math.hypot(moving.personsById[a.personId].mind.scenic.x-slot.position.x,moving.personsById[a.personId].mind.scenic.y-slot.position.y)>.53;});
 const pending=order(moving),pendingId=pending.activityIds.find(id=>moving.activitiesById[id]?.kind==='sr-construction'),pendingSlot=pending.workSlots.find(x=>x.id===moving.activitiesById[pendingId].slotId);
 const resumed=validateSave(JSON.parse(JSON.stringify(moving)));assert.equal(resumed.workOrdersById[pending.id].workSlots.find(x=>x.id===pendingSlot.id).occupantId,moving.activitiesById[pendingId].personId);
 const s=world(['甲']);handlers.build(s,'farm',12,24);
 until(s,()=>{const o=order(s),a=o.activityIds.map(id=>s.activitiesById[id]).find(x=>x?.kind==='sr-construction');return a?.phase==='working'&&a.slotArrived&&o.progressTicks>0;});
 const clean=JSON.parse(JSON.stringify(s)),o=order(s),id=o.activityIds.map(id=>s.activitiesById[id]).find(x=>x?.kind==='sr-construction').personId;
 assert.equal(validateSave(clean).worldTick,s.worldTick);
 const forged=JSON.parse(JSON.stringify(s)),person=forged.personsById[id];Object.assign(person.mind.scenic,{x:25,y:14,path:[],goal:null});person.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:25,y:14};
 assert.throws(()=>validateSave(forged),/施工执行位占用者与活动不一致/);
});

test('SR-XF-005-I01: a later bystander on a reserved foot blocks arrival and work until the foot clears',()=>{
 const s=world(['甲','乙']),helper=s.personsById[s.homeMemberIds[0]],bystander=s.personsById[s.homeMemberIds[1]];
 bystander.mind.traits=[0,0,0,0,0];handlers.build(s,'farm',12,24);
 until(s,()=>{const a=s.activitiesById[helper.activityId],slot=order(s).workSlots.find(x=>x.id===a?.slotId);return slot&&a.slotArrived===false&&Math.hypot(helper.mind.scenic.x-slot.position.x,helper.mind.scenic.y-slot.position.y)>.53;});
 const o=order(s),activity=s.activitiesById[helper.activityId],slot=o.workSlots.find(x=>x.id===activity.slotId),arrival=activity.firstArrivalTick;
 Object.assign(bystander.mind.scenic,{...slot.position,path:[],goal:null});const before=o.progressTicks;
 for(let i=0;i<12;i++){s.worldTick++;tickSpatial(s);assert.equal(activity.slotArrived,false);assert.equal(activity.phase,'blocked');assert.ok(Math.hypot(helper.mind.scenic.x-bystander.mind.scenic.x,helper.mind.scenic.y-bystander.mind.scenic.y)>=.53);}
 assert.equal(activity.firstArrivalTick,arrival);assert.equal(slot.occupantId,helper.personId);assert.ok(o.progressTicks-before<=12,'blocked helper adds no second worker contribution');
 Object.assign(bystander.mind.scenic,{x:26,y:15,path:[],goal:null});
 for(let i=0;i<1000&&!activity.slotArrived;i++){s.worldTick++;tickSpatial(s);}
 assert.equal(activity.slotArrived,true);assert.equal(activity.firstArrivalTick,arrival);const progressed=o.progressTicks;
 for(let i=0;i<8;i++){s.worldTick++;tickSpatial(s);}assert.ok(o.progressTicks>progressed);validateSpatial(s);
});

test('SR-XF-005-I01: injury and retask release only that helper; cancellation releases all feet',()=>{
 const s=world(['甲','乙']),result=handlers.build(s,'farm',12,24),o=order(s);
 until(s,()=>o.workSlots.every(x=>x.occupantId)&&o.progressTicks>0);
 const helperId=o.activityIds.find(id=>s.activitiesById[id]?.kind==='sr-construction'),helper=s.personsById[s.activitiesById[helperId].personId],held=o.workSlots.find(x=>x.occupantId===helper.personId);
 helper.wound=25;step(s);assert.equal(s.activitiesById[helperId],undefined);assert.equal(helper.activityId,null);assert.equal(held.occupantId,null);assert.equal(held.firstArrivalTick,null);
 assert.ok(o.progressTicks>0);validateSpatial(s);
 const otherId=o.activityIds.find(id=>s.activitiesById[id]?.kind==='sr-construction'),other=otherId&&s.personsById[s.activitiesById[otherId].personId];
 if(other){other.mind.activity='study';step(s);assert.equal(s.activitiesById[otherId],undefined);assert.equal(other.activityId,null);}
 const pending=handlers.cancelConstruction(s);assert.equal(pending.pending,true);
 assert.equal(o.activityIds.length,1);assert.ok(o.workSlots.every(x=>x.occupantId===null));
 until(s,()=>!s.workOrdersById[result.workOrderId]);
 assert.equal(s.spatial.completedOrders.at(-1).phase,'cancelled');validateSave(s);
});

test('SR-XF-005-I01: a departed helper releases its exclusive work foot on the next world step',()=>{
 const s=world(['甲']),result=handlers.build(s,'farm',12,24),o=order(s);
 until(s,()=>o.progressTicks>0&&o.activityIds.some(id=>s.activitiesById[id]?.kind==='sr-construction'&&s.activitiesById[id].slotArrived));
 const id=o.activityIds.find(id=>s.activitiesById[id]?.kind==='sr-construction'),p=s.personsById[s.activitiesById[id].personId],slot=o.workSlots.find(x=>x.occupantId===p.personId);
 p.left=true;step(s);assert.equal(s.activitiesById[id],undefined);assert.equal(p.activityId,null);assert.equal(slot.occupantId,null);assert.equal(slot.firstArrivalTick,null);
 assert.ok(s.workOrdersById[result.workOrderId]);validateSpatial(s);
});

test('SR-XF-005-I01: completed two-worker order opens the original building once and clears crew ownership',()=>{
 const s=world(['甲','乙']),result=handlers.build(s,'farm',12,24),o=order(s),memberIds=s.homeMemberIds.slice();
 until(s,()=>!s.workOrdersById[result.workOrderId]);
 assert.equal(s.buildings.filter(b=>b.id===result.id).length,1);assert.equal(s.spatial.completedOrders.filter(x=>x.id===result.workOrderId&&x.phase==='completed').length,1);
 assert.equal(s.reservationsById[`reservation:build:${result.id}`],undefined);assert.deepEqual(s.homeMemberIds,memberIds);
 for(const id of memberIds)assert.ok(!s.personsById[id].activityId?.startsWith('activity:construction:'));
 assert.equal(o.progressTicks,o.durationTicks);validateSave(s);
});

test('SR-XF-005-I01: legal pre-crew solo construction remains a one-person order after load',()=>{
 const s=world(),result=handlers.build(s,'farm',12,24),o=order(s);
 delete o.workSlots;delete o.workSlotGeometryRevision;
 const restored=validateSave(JSON.parse(JSON.stringify(s))),old=restored.workOrdersById[result.workOrderId];
 assert.equal(old.workSlots,undefined);until(restored,()=>old.progressTicks>=3);const before=old.progressTicks;step(restored);assert.equal(old.progressTicks,before+1);
 until(restored,()=>!restored.workOrdersById[result.workOrderId]);assert.equal(restored.spatial.completedOrders.at(-1).phase,'completed');validateSave(restored);
});
