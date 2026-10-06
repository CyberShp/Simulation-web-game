import test from 'node:test';
import assert from 'node:assert/strict';
import * as w from '../dist/ea-opening-sim.mjs';
import * as old from '../dist/ea-sim.mjs';
import {facilitySlots} from '../dist/ea-facility-slots.mjs';
import {prepareFacilityActivity,releaseBodyActivity,productionOrder} from '../dist/ea-facility-activities.mjs';
import {scenicFindPath,scenicSweep,buildingAccess,scenicDistance} from '../dist/ea-scene-geometry.mjs';
import {personHitCandidates} from '../dist/ea-scene-picking.mjs';
import {runOpening} from '../qa/ea-opening-v12-acceptance.mjs';
const act=(s,name,...args)=>w.dispatchCommand(s,{name,args}).state;
// Deliberately isolated stress fixtures; these are not normal-play evidence.
function fixture(count=5,type='farm'){
 const s=w.initial();s.master.wound=0;s.story.step=3;s.story.claimed=['story:0','story:1','story:2'];for(const k of Object.keys(s.resources))s.resources[k]=1000;
 old.build(s,'house',5,5);const b=old.build(s,type,4,4);
 for(let i=0;i<count;i++){const p=old.addDisciple(s);p.job=b.id;p.mind.activity='work';p.mind.commitUntil=10000;p.mind.lastDecision=0;p.mind.satiety=100;}
 return {s,b,people:s.disciples};
}
function arrive(s,p,b,action='work'){
 for(let n=0;n<200&&!prepareFacilityActivity(s,p,b,action);n++);assert.equal(s.activitiesById[p.activityId].phase,'executing');
}
function until(s,predicate,seconds=200){for(let n=0;n<seconds&&!predicate();n++)w.tick(s,1);assert.ok(predicate());}
function artisan(){const {state:s}=runOpening();until(s,()=>s.story.artisan.phase==='present');return s;}

test('five willing workers use four exclusive crop stations, then the first waiter takes a released place',()=>{
 const {s,b,people}=fixture();for(const p of people)prepareFacilityActivity(s,p,b,'work');
 assert.equal(facilitySlots(s,b,'work').length,4);assert.equal(new Set(people.slice(0,4).map(p=>s.activitiesById[p.activityId].slotId)).size,4);
 const waiting=s.activitiesById[people[4].activityId];assert.equal(waiting.phase,'waiting');assert.equal(waiting.slotId,null);
 releaseBodyActivity(s,people[0]);prepareFacilityActivity(s,people[4],b,'work');assert.ok(waiting.slotId);w.validateSave(JSON.parse(JSON.stringify(s)));
});

test('arrival and a full station prevent production progress, and exact station targets survive navigation',()=>{
 const {s,b,people}=fixture(5);const herbs=s.resources.herb;w.tick(s,1);assert.equal(s.resources.herb,herbs);assert.equal(productionOrder(s,b),null);
 const p=people[0],a=s.activitiesById[p.activityId],slot=facilitySlots(s,b,'work').find(slot=>slot.id===a.slotId),path=scenicFindPath(s,p.mind.scenic,slot.position,{maxSnap:1});
 assert.deepEqual(path.at(-1),slot.position);let from=p.mind.scenic;for(const point of path){assert.equal(scenicSweep(s,from,point).blocked,false);from=point;}
 const blocked=people[4];assert.equal(s.activitiesById[blocked.activityId].phase,'waiting');
});

test('four contributors complete one shared batch and receive divided labor credit, not four yields',()=>{
 const {s,b,people}=fixture(4);for(const p of people)arrive(s,p,b);
 const cycles=s.society.stats.workCycles,herbs=s.resources.herb,purses=people.map(p=>p.mind.purse);
 w.tick(s,5);const o=productionOrder(s,b);assert.equal(o.progressTicks,200);assert.equal(o.phase,'completed');assert.equal(s.society.stats.workCycles,cycles+1);
 assert.ok(s.resources.herb-herbs<20&&s.resources.herb>herbs);assert.equal(b.progress,0);
 assert.deepEqual(Object.values(o.contributions),[50,50,50,50]);people.forEach((p,i)=>assert.ok(Math.abs(p.mind.purse-purses[i]-.2)<1e-9));w.validateSave(JSON.parse(JSON.stringify(s)));
});

test('input materials reserve once, paused or absent workers cannot earn, and cancellation refunds only once',()=>{
 let {s,b,people}=fixture(1,'lumber');b.type='workshop';for(const p of people)arrive(s,p,b);
 const before=s.resources.wood;w.tick(s,1);const order=productionOrder(s,b);assert.equal(s.resources.wood,before-3);assert.equal(order.progressTicks,10);
 const copy=w.validateSave(JSON.parse(JSON.stringify(s)));s.speed=0;const saved=JSON.stringify(s);w.tick(s,500);assert.equal(JSON.stringify(s),saved);
 s.speed=1;s=act(s,'toggleBuilding',b.id);const reserved=order.progressTicks;w.tick(s,4);assert.equal(productionOrder(s,s.buildings.find(x=>x.id===b.id)).progressTicks,reserved);assert.notEqual(s.activitiesById[s.personsById[people[0].personId].activityId]?.targetId,b.instanceId);assert.equal(Object.values(s.reservationsById).some(r=>r.kind==='slot'&&r.slotId.startsWith(b.instanceId+'/')),false);
 s=act(s,'cancelProduction',b.id);assert.ok(Math.abs(s.resources.wood-(before-.15))<1e-9);assert.throws(()=>act(s,'cancelProduction',b.id),/没有未完成/);
 w.tick(copy,30);assert.ok(copy.society.stats.workCycles>0);
});

test('shared progress, exclusive reservations and individual walking resume identically across a cold save',()=>{
 const {s,b,people}=fixture(3);w.tick(s,12.3);const loaded=w.validateSave(JSON.parse(JSON.stringify(s)));
 w.tick(s,30.5);for(let n=0;n<305;n++)w.tick(loaded,.1);assert.deepEqual(s,loaded);
 const before=JSON.stringify(s);for(let n=0;n<5;n++){w.personLifeSummary(s,people[0]);facilitySlots(s,b,'work');}assert.equal(JSON.stringify(s),before);
});

test('malformed shared progress, duplicate reservations and dangling body references fail without changing input',()=>{
 const {s,b,people}=fixture(2);for(const p of people)arrive(s,p,b);w.tick(s,1);
 const cases=[x=>{const p=x.personsById[people[1].personId],a=x.activitiesById[p.activityId],first=x.activitiesById[x.personsById[people[0].personId].activityId];a.slotId=first.slotId;x.reservationsById[a.reservationId].slotId=first.slotId;},x=>{Object.values(x.workOrdersById)[0].progressTicks=201;},x=>{x.personsById[people[0].personId].activityId='missing';},x=>{x.reservationsById.orphan={id:'orphan',kind:'materials',workOrderId:'missing',cost:{}};}];
 for(const mutate of cases){const saved=JSON.parse(JSON.stringify(s));mutate(saved);const before=JSON.stringify(saved);assert.throws(()=>w.validateSave(saved));assert.equal(JSON.stringify(saved),before);}
 const other=old.build(s,'farm',3,3),worker=people[1];worker.job=other.id;w.tick(s,1);assert.equal(s.activitiesById[worker.activityId].targetId,other.instanceId);assert.equal(productionOrder(s,other),null);arrive(s,worker,other);w.tick(s,1);w.validateSave(JSON.parse(JSON.stringify(s)));
 const mismatched=JSON.parse(JSON.stringify(s)),activity=mismatched.activitiesById[mismatched.personsById[worker.personId].activityId];activity.workOrderId=productionOrder(s,b).id;
 const before=JSON.stringify(mismatched);assert.throws(()=>w.validateSave(mismatched),/工位、活动或生产批次引用异常/);assert.equal(JSON.stringify(mismatched),before);
});

test('new opening hall cannot create jade without labor or trade; historical content keeps its compatibility',()=>{
 const s=w.initial(),jade=s.resources.jade;w.tick(s,40);assert.equal(s.resources.jade,jade);
 const oldSave=w.validateSave(old.initial()),oldJade=oldSave.resources.jade;w.tick(oldSave,40);assert.ok(oldSave.resources.jade>oldJade);
});

test('construction has one serializable work-order progress and first-batch v6 construction upgrades losslessly',()=>{
 let s=w.initial();s.master.wound=0;s.story.step=2;s.story.claimed=['story:0','story:1'];s=act(s,'build','farm',4,4);w.tick(s,18);
 const saved=JSON.parse(JSON.stringify(s)),a=saved.activitiesById[s.master.activityId],o=saved.workOrdersById[a.workOrderId];assert.equal('progressTicks' in a,false);
 a.progressTicks=o.progressTicks;a.totalTicks=o.durationTicks;delete saved.workOrdersById[a.workOrderId];delete a.workOrderId;
 const upgraded=w.validateSave(saved);assert.equal(w.constructionStatus(upgraded).progressTicks,o.progressTicks);w.tick(s,90);w.tick(upgraded,90);assert.deepEqual(s,upgraded);
});

test('actual master and overlapping people all remain selectable using at least 44 CSS pixels',()=>{
 const actors=[{id:'master',name:'沈砚',x:100,y:100},{id:1,name:'陆知微',x:104,y:100}];
 for(const scale of [.25,.5,1,2]){const list=personHitCandidates({x:100,y:80},actors,{scale});assert.equal(list.length,2);assert.ok(list.some(p=>p.id==='master'));
 const hit=personHitCandidates({x:100+21/scale,y:80},[actors[0]],{scale});assert.equal(hit.length,1);}
});

test('rain artisan is a separate persistent person; treatment requires real arrival, pauses and survives reload',()=>{
 let s=artisan();const p=s.personsById[s.story.artisan.personId],id=p.personId,members=s.homeMemberIds.slice(),herb=s.resources.herb;
 assert.notEqual(id,'person:lu-zhiwei');s=act(s,'offerArtisanCare');assert.equal(s.resources.herb,herb-8);assert.equal(w.treatmentStatus(s).progressTicks,0);assert.equal(s.personsById[id].wound,35);
 w.tick(s,.1);assert.equal(w.treatmentStatus(s).progressTicks,0);const loaded=w.validateSave(JSON.parse(JSON.stringify(s)));s.speed=0;const before=JSON.stringify(s);w.tick(s,100);assert.equal(JSON.stringify(s),before);s.speed=1;
 assert.throws(()=>act(s,'masterAction','wood'),/正在换药/);w.tick(s,140);w.tick(loaded,140);assert.deepEqual(s,loaded);assert.equal(s.story.artisan.phase,'recovered');assert.equal(s.personsById[id].wound,0);assert.deepEqual(s.homeMemberIds,members);
 assert.equal(s.personsById[id].mind.memories.filter(m=>m.key==='rain-artisan:care').length,1);assert.notEqual(s.activitiesById[s.master.activityId]?.action,'care');assert.throws(()=>act(s,'offerArtisanCare'));
});

test('care cancellation returns unused medicine once; a declined artisan actually departs and never respawns',()=>{
 let s=artisan(),herb=s.resources.herb;s=act(s,'offerArtisanCare');s=act(s,'cancelArtisanCare');assert.equal(s.resources.herb,herb);assert.throws(()=>act(s,'cancelArtisanCare'),/没有伤匠治疗/);
 const id=s.story.artisan.personId;s=act(s,'declineArtisanCare');const position={...s.personsById[id].mind.scenic};w.tick(s,.1);assert.ok(scenicDistance(position,s.personsById[id].mind.scenic)<=2.2);until(s,()=>s.story.artisan.phase==='departed');const saved=w.validateSave(JSON.parse(JSON.stringify(s)));w.tick(saved,300);assert.equal(saved.story.artisan.phase,'departed');assert.ok(saved.personsById[id]);assert.equal(saved.factsById['fact:rain-artisan:cooperation'],undefined);
});

test('real first-slice v6 save receives one dormant artisan without moving existing people or consuming RNG/assets',async()=>{
 const {readFile}=await import('node:fs/promises'),input=JSON.parse(await readFile(new URL('./fixtures/opening-v6-first-slice.json',import.meta.url),'utf8')),before=JSON.stringify(input);
 assert.equal(input.rulesetVersion,'opening-runtime-1');assert.equal(input.story.artisan,undefined);
 const loaded=w.validateSave(input);assert.equal(JSON.stringify(input),before);assert.equal(loaded.rulesetVersion,'opening-runtime-3');assert.equal(loaded.story.artisan.phase,'dormant');assert.equal(loaded.rngState,input.rngState);
 assert.deepEqual(loaded.stockpilesById,input.stockpilesById);assert.deepEqual(loaded.homeMemberIds,input.homeMemberIds);assert.equal(loaded.worldTick,input.worldTick);
 for(const [id,p]of Object.entries(input.personsById))assert.deepEqual(loaded.personsById[id],p);
 const saved=JSON.stringify(loaded),again=w.validateSave(JSON.parse(saved));assert.equal(JSON.stringify(again),saved);
});

test('rules upgrade can register the visitor in a full residence while preserving membership and numeric identity allocation',()=>{
 const s=w.initial();for(let i=0;i<4;i++)old.addDisciple(s);
 s.rulesetVersion='opening-runtime-1';delete s.personsById['person:cheng-wenzhou'];delete s.story.artisan;
 const ids=s.homeMemberIds.slice(),next=s.society.nextPersonId,seed=s.rngState,loaded=w.validateSave(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(loaded.homeMemberIds,ids);assert.equal(loaded.personsById[loaded.story.artisan.personId].id,next);assert.equal(loaded.society.nextPersonId,next+1);assert.equal(loaded.rngState,seed);
});

test('partly administered treatment keeps its actual relief and refunds only the unused fraction',()=>{
 let s=artisan();const herb=s.resources.herb,id=s.story.artisan.personId;s=act(s,'offerArtisanCare');until(s,()=>w.treatmentStatus(s)?.progressTicks>=50);
 const progress=w.treatmentStatus(s).progressTicks,wound=s.personsById[id].wound;assert.ok(wound<35&&wound>10);
 s=act(s,'cancelArtisanCare');assert.equal(s.personsById[id].wound,wound);assert.ok(Math.abs(s.resources.herb-(herb-8*progress/250))<1e-8);assert.equal(s.factsById['fact:rain-artisan:cooperation'],undefined);w.validateSave(JSON.parse(JSON.stringify(s)));
});

test('a prior building batch preserves inherited work and still settles one full output with proportional new credit',()=>{
 const {s,b,people}=fixture(1);b.progress=15;arrive(s,people[0],b);const before=s.resources.herb;w.tick(s,5);const o=productionOrder(s,b);
 assert.equal(o.inheritedTicks,150);assert.equal(o.progressTicks,200);assert.equal(o.contributions[people[0].personId],50);assert.ok(s.resources.herb-before>10);assert.equal(s.society.stats.workCycles,1);w.validateSave(JSON.parse(JSON.stringify(s)));
});

test('malformed care actors, material claims and cooperation facts cannot be accepted on load',()=>{
 let s=artisan();s=act(s,'offerArtisanCare');const mutateCases=[x=>{x.workOrdersById['work:rain-artisan:care'].durationTicks=0;},x=>{x.reservationsById['reservation:rain-artisan:medicine'].cost.herb=0;},x=>{x.story.artisan.personId='person:lu-zhiwei';},x=>{x.reservationsById.extra={id:'extra',kind:'care-medicine',cost:{herb:8}};}];
 for(const mutate of mutateCases){const copy=JSON.parse(JSON.stringify(s));mutate(copy);const before=JSON.stringify(copy);assert.throws(()=>w.validateSave(copy));assert.equal(JSON.stringify(copy),before);}
 w.tick(s,140);const copy=JSON.parse(JSON.stringify(s));copy.factsById['fact:rain-artisan:cooperation'].sourcePersonId='missing';assert.throws(()=>w.validateSave(copy));
});
