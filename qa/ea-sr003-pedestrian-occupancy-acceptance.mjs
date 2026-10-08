/** SR-XF-003: public-command courtyard traffic and persisted door ownership. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from '../dist/ea-opening-sim.mjs';
import {meterDoorPermit,meterCanStand,meterSweep,tickSpatial} from '../dist/ea-sr-spatial.mjs';
import {validateScenic} from '../dist/ea-scenic.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const entryId='building:yunxiu:1/entry:south';
function localBodies(s){return Object.values(s.personsById).filter(p=>p.lifeStatus!=='dead'&&!p.left&&p.position?.sceneId==='scene:yunxiu-courtyard'&&(p===s.master||p.mind?.scenic));}
function assertSeparated(s){const people=localBodies(s);for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++)assert(distance(people[i].position,people[j].position)>=.53-1e-6,`${people[i].personId} and ${people[j].personId} have separate feet`);}
function publicOpeningAtDoor(){
 const h=harness();h.act('acknowledgeIntro');h.act('masterAction','heal');h.until(s=>s.master.wound===0,'opening healing');h.save();
 h.act('advanceStory');h.walkPerson('person:lu-zhiwei');h.act('advanceStory','gift');h.save();h.act('advanceStory','invite');
 h.build('farm');h.build('lumber');h.walkPerson('person:lin-changfeng');h.act('advanceStory');h.save();
 return h;
}

test('public opening: same-tick arrivals retain person-ID order, wait apart, cross serially, and survive reload',()=>{
 const h=publicOpeningAtDoor();
 h.until(s=>s.spatial.doorQueuesByEntryId[entryId]?.waiting.length===2,'two real arrivals at the hall door',100);
 let queue=h.s.spatial.doorQueuesByEntryId[entryId];
 assert.equal(queue.holder,null);
 assert.deepEqual(queue.waiting.map(w=>[w.firstArrivalTick,w.personId]),[[queue.waiting[0].firstArrivalTick,'person:lin-changfeng'],[queue.waiting[0].firstArrivalTick,'person:master']]);
 const firstTick=queue.waiting[0].firstArrivalTick,resources=JSON.stringify(h.s.resources),activities=[h.s.master.activityId,h.s.personsById['person:lin-changfeng'].activityId];
 h.save();assert.equal(h.s.spatial.doorQueuesByEntryId[entryId].waiting[0].firstArrivalTick,firstTick,'reload keeps the first arrival');
 const before=JSON.stringify(h.s),copied={...h.s.master.scenic};assert.equal(meterDoorPermit(h.s,copied,copied,copied.path,{x:copied.x,y:copied.y}),true);assert.equal(JSON.stringify(h.s),before,'a copied render pose cannot allocate a door');
 const holders=[];for(let i=0;i<250;i++){S.tick(h.s,.1);assertSeparated(h.s);queue=h.s.spatial.doorQueuesByEntryId[entryId];if(queue?.holder)holders.push([h.s.worldTick,queue.holder.personId]);if(distance(h.s.master.scenic,{x:24.95,y:7})<.1)break;}
 assert(holders.some(([,id])=>id==='person:lin-changfeng'),'first holder actually uses the door');
 assert(holders.some(([,id])=>id==='person:master'),'second holder receives the door later');
 assert(holders.find(([,id])=>id==='person:master')[0]>holders.find(([,id])=>id==='person:lin-changfeng')[0]);
 assert.equal(JSON.stringify(h.s.resources),resources,'queuing changes no material balance');
 assert.deepEqual([h.s.master.activityId,h.s.personsById['person:lin-changfeng'].activityId],activities,'queuing keeps original body activities');
 assert(distance(h.s.master.scenic,{x:24.95,y:7})<.1,'master reaches the original exact bed approach');h.save();
});

test('a public job change releases the holder and the original waiter resumes next world step',()=>{
 const h=publicOpeningAtDoor();h.until(s=>!!s.spatial.doorQueuesByEntryId[entryId]?.holder,'first actual holder',100);
 const queue=h.s.spatial.doorQueuesByEntryId[entryId],arrival=queue.waiting[0].firstArrivalTick,materials=JSON.stringify(h.s.resources);
 assert.equal(queue.holder.personId,'person:lin-changfeng');assert.equal(queue.waiting[0].personId,'person:master');h.save();
 const lumber=h.s.buildings.find(b=>b.type==='lumber');assert.equal(h.act('inviteWork','person:lin-changfeng',lumber.id).accepted,true);
 assert.equal(h.s.spatial.doorQueuesByEntryId[entryId].holder,null);
 assert.equal(h.s.spatial.doorQueuesByEntryId[entryId].waiting[0].firstArrivalTick,arrival);
 assert.equal(h.s.spatial.doorQueuesByEntryId[entryId].lastPassTick,h.s.worldTick);
 h.save();S.tick(h.s,.1);assert.equal(h.s.spatial.doorQueuesByEntryId[entryId]?.holder,null,'the next person does not cross in the release tick');
 h.until(s=>distance(s.master.scenic,{x:24.95,y:7})<.1,'original bed approach after redirection',300);
 assert.equal(JSON.stringify(h.s.resources),materials);assertSeparated(h.s);h.save();
});

test('a normal public opening builds, transports, produces, studies, and reloads with crowd clearance',()=>{
 const h=normalOpening();assert(h.counts.commands>=20);assert(h.counts.saves>=15);
 assert(Object.values(h.s.factsById).some(f=>f.kind==='inventory-transaction'&&f.operation==='delivery'));
 assert(Object.values(h.s.spatial.completedOrders).some(o=>o.operation==='build'&&o.phase==='completed'));
 assertSeparated(h.s);h.save();
});

test('a public courtyard walk bends around a working person while her accepted job continues',()=>{
 const h=normalOpening(),workerId='person:lu-zhiwei',lumber=h.s.buildings.find(b=>b.type==='lumber');
 assert.equal(h.act('inviteWork',workerId,lumber.id).accepted,true);const assigned=h.s.personsById[workerId].job,goal={x:32,y:14};
 h.act('moveScenicMaster',goal.x,goal.y);let closest=Infinity,arrived=false;
 for(let i=0;i<230;i++){S.tick(h.s,.1);assertSeparated(h.s);closest=Math.min(closest,distance(h.s.master.scenic,h.s.personsById[workerId].mind.scenic));if(distance(h.s.master.scenic,goal)<.04){arrived=true;break;}}
 assert(arrived,'the original public destination is reached');assert(closest<1.5,'the walked route really passes the occupied work area');assert.equal(h.s.personsById[workerId].job,assigned);h.save();
});

test('bad door records are rejected while a valid pre-queue save upgrades without changing time or facts',()=>{
 const h=publicOpeningAtDoor();h.until(s=>s.spatial.doorQueuesByEntryId[entryId]?.waiting.length===2,'two actual waiters',100);h.save();
 const raw=JSON.parse(JSON.stringify(h.s)),tick=raw.worldTick,facts=JSON.stringify(raw.factsById);
 const old=structuredClone(raw);delete old.spatial.doorQueuesByEntryId;const migrated=S.validateSave(old);assert.equal(migrated.spatial.doorQueuesByEntryId,undefined);assert.equal(migrated.worldTick,tick);assert.equal(JSON.stringify(migrated.factsById),facts);
 const wrongOrder=structuredClone(raw);wrongOrder.spatial.doorQueuesByEntryId[entryId].waiting.reverse();assert.throws(()=>S.validateSave(wrongOrder),/门道候选队序异常/);
 const duplicate=structuredClone(raw);duplicate.spatial.doorQueuesByEntryId[entryId].holder={...duplicate.spatial.doorQueuesByEntryId[entryId].waiting[0]};assert.throws(()=>S.validateSave(duplicate),/门道通行权或候选记录异常/);
 const future=structuredClone(raw);future.spatial.doorQueuesByEntryId[entryId].waiting[0].firstArrivalTick=tick+1;assert.throws(()=>S.validateSave(future),/门道通行权或候选记录异常/);
});

test('a newly occupied construction lane clears its old route and returns held cargo after a saved cancellation',()=>{
 const h=harness();h.act('masterAction','heal');h.until(s=>s.master.wound===0,'public healing');
 const initial={...h.s.resources},order=h.act('build','farm',26,16).workOrderId;
 h.until(s=>s.workOrdersById[order]?.materialFlow.phase==='carrying','actual source pickup',500);
 for(let i=0;i<5;i++)S.tick(h.s,.1);
 const carrier=h.s.master.scenic,oldRoute=JSON.stringify(carrier.path),visitor=h.s.personsById['person:lin-changfeng'];
 // Isolated physical obstruction after public pickup. Keep the other person's
 // real feet outside the new footprint so only the route changes.
 visitor.mind.scenic={...visitor.mind.scenic,x:35,y:30,path:[],goal:null};visitor.position={...visitor.position,x:35,y:30};
 if(visitor.location?.sceneId==='scene:yunxiu-courtyard'){visitor.location.x=35;visitor.location.y=30;}
 const id=h.s.nextId++,well={id,instanceId:`building:yunxiu:${id}`,type:'well',x:28,y:14,level:1,transform:{x:28,y:14,orientation:'south'},prefabId:'prefab:well:units:v1',sceneId:'scene:yunxiu-courtyard',condition:100,enabled:true,progress:0,buildingGridVersion:'building-units-1'};
 h.s.buildings.push(well);h.s.buildingsById[well.instanceId]=well;
 let rerouted=false;for(let i=0;i<20;i++){S.tick(h.s,.1);const scenic=h.s.master.scenic;assert(meterCanStand(h.s,scenic),'carrier never enters the new well');let from=scenic;for(const next of scenic.path){assert.equal(meterSweep(h.s,from,next).blocked,false,'the whole retained carrier path stays physically valid');from=next;}rerouted ||=JSON.stringify(scenic.path)!==oldRoute;h.save();}
 assert(rerouted,'the old route is replaced after the new physical obstacle');assert.notEqual(oldRoute,'[]');
 assert.deepEqual(h.s.workOrdersById[order].materialFlow.cargo,{wood:25,stone:10});assert.equal(h.s.workOrdersById[order].progressTicks,0);h.save();
 const requested=h.act('cancelConstruction');assert.equal(requested.pending,true);assert.equal(h.s.resources.wood,initial.wood-25);
 h.save();h.until(s=>!s.workOrdersById[order],'real return of held cargo',500);
 assert.deepEqual({jade:h.s.resources.jade,wood:h.s.resources.wood,stone:h.s.resources.stone},{jade:initial.jade,wood:initial.wood,stone:initial.stone});
 assert.equal(h.s.spatial.completedOrders.filter(o=>o.id===order&&o.phase==='cancelled').length,1);h.save();
});

test('a real side-step near the hall wall keeps the original activity route saveable',()=>{
 const h=normalOpening(),lu=h.s.personsById['person:lu-zhiwei'],lin=h.s.personsById['person:lin-changfeng'];
 const a=lu.mind.scenic,holder=lin.mind.scenic,goal={x:24.95,y:7},holderGoal={x:26.983333333333334,y:7};
 Object.assign(a,{x:27.981149469716094,y:13.525809905837567,path:[{x:27.5,y:11.5},goal],goal,bodyYield:{kind:'door-wait',requestedBy:lin.personId,startedTick:h.s.worldTick,target:{x:27,y:13.5},path:[{x:27,y:13.5}]}});
 Object.assign(holder,{x:27.95329404164106,y:14.32288216868081,path:[holderGoal],goal:holderGoal});
 for(const p of [lu,lin])Object.assign(p.position,{x:p.mind.scenic.x,y:p.mind.scenic.y});
 const candidate=p=>({entryId,personId:p.personId,firstArrivalTick:h.s.worldTick-1,activityId:p.activityId,target:{...p.mind.scenic.goal},phase:'in'});
 h.s.spatial.doorQueuesByEntryId={[entryId]:{entryId,holder:candidate(lin),waiting:[candidate(lu)],lastPassTick:-1}};
 assert(validateScenic(a,h.s),'the original route is valid before the real side-step');
 const before={x:a.x,y:a.y,activityId:lu.activityId,tick:h.s.worldTick};tickSpatial(h.s);
 assert(distance(before,a)>.12&&distance(before,a)<=.13+1e-6,'the waiting body moves by one physical step');
 assert.equal(lu.activityId,before.activityId);assert.equal(h.s.worldTick,before.tick);assert.deepEqual(a.goal,goal);
 assert(validateScenic(a,h.s),'the retained goal has a newly valid route after the side-step');
});
