/** SR-XF-010 D02: study budget, historical orders and stockpile references. */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as S from '../dist/ea-opening-sim.mjs';
import * as E from '../dist/ea-sr-economy.mjs';

const save=s=>S.validateSave(JSON.parse(JSON.stringify(s)));
const occupied=st=>Object.values(st.resources).reduce((sum,n)=>sum+n,0)+Object.values(st.pills||{}).reduce((sum,n)=>sum+n,0);
function withLibrary(){
 const s=S.initial({sr:true}),placement=S.recommendedPlacement(s,'library'),id=s.nextId++;
 const b={id,instanceId:`building:yunxiu:${id}`,type:'library',buildingGridVersion:S.BUILDING_GRID.version,prefabId:'prefab:library:units:v1',sceneId:'scene:yunxiu-courtyard',x:placement.x/2,y:placement.y/2,transform:{...placement,orientation:'south'},level:1,condition:100,enabled:true,progress:0};
 s.buildings.push(b);s.spatial.geometryRevision++;E.initEconomy(s);
 return {s,b,home:s.stockpilesById['stockpile:yunxiu'],library:s.stockpilesById[`stockpile:${b.instanceId}`]};
}
function reserveHistoricalInsight(s,source,target,phase='carrying'){
 const id='work:transport:historical-insight',activityId='activity:transport:person:master',reservationId=`reservation:transport:${id}`;
 s.master.activityId=activityId;s.master.wound=0;s.master.energy=100;
 s.activitiesById[activityId]={id:activityId,kind:'sr-transport',personId:'person:master',workOrderId:id};
 s.reservationsById[reservationId]={id:reservationId,kind:'transport-cargo',workOrderId:id,cost:{insight:1},sourceStockpileId:source.id};
 s.workOrdersById[id]={id,kind:'transport',sourceStockpileId:source.id,targetStockpileId:target.id,carrierId:'person:master',cargo:{insight:1},phase,reservationId,startedTick:s.worldTick,reason:'历史已预约事务'};
 s.master.scenic={...s.master.scenic,x:target.position.x,y:target.position.y,path:[],goal:null};
 return id;
}

test('new courtyard transport accepts physical material and leaves study budget unchanged',()=>{
 const {s,home,library}=withLibrary();home.resources.insight=3;home.resources.wood=3;s.master.activityId=null;s.master.wound=0;s.master.energy=100;
 const before=JSON.stringify(s);
 assert.throws(()=>E.startTransport(s,home.id,library.id,'person:master',{insight:1}),/道韵/);
 assert.equal(JSON.stringify(s),before);
 const order=E.startTransport(s,home.id,library.id,'person:master',{wood:1});
 assert.equal(order.accepted,true);assert.equal(s.workOrdersById[order.id].cargo.wood,1);
 assert.equal(s.resources.insight,3);
});

test('library production credits the public study budget once at the same world tick',()=>{
 const {s,b,home,library}=withLibrary(),before=home.resources.insight;
 const orderId=`work:production:${b.instanceId}`,factId=`fact:production:${b.instanceId}:1`;
 s.workOrdersById[orderId]={id:orderId,batch:1};
 const settle=(_participants,state)=>{state.resources.insight+=6;return true;};
 assert.equal(E.settleFiniteProduction(s,b,settle,[]),true);
 assert.equal(home.resources.insight,before+6);
 assert.equal(library.resources.insight,0);
 assert.equal(s.factsById[factId].targetStockpileId,home.id);
 assert.deepEqual(s.factsById[factId].quantities.insight,6);
 const raw=JSON.stringify(s);assert.equal(E.settleFiniteProduction(s,b,settle,[]),false);
 assert.equal(JSON.stringify(s),raw);
 delete s.workOrdersById[orderId];
 const loaded=save(s);
 assert.equal(loaded.resources.insight,before+6);
 assert.equal(loaded.factsById[factId].quantities.insight,6);
 assert.equal(save(loaded).resources.insight,before+6);
});

test('library output waits for public budget capacity and settles after space is available',()=>{
 const {s,b,home,library}=withLibrary(),orderId=`work:production:${b.instanceId}`,factId=`fact:production:${b.instanceId}:1`;
 s.workOrdersById[orderId]={id:orderId,batch:1};
 const initialInsight=home.resources.insight,initialSource=s.srEconomy.patches.insight.remaining,used=occupied(home);
 const settle=(_participants,state)=>{state.resources.insight+=7;state.stats.crafted++;return true;};
 home.capacity=used+5;
 assert.match(E.productionAvailability(s,b).reason,/公库.*容量/);
 let before=JSON.stringify(s);assert.equal(E.settleFiniteProduction(s,b,settle,[]),false);
 assert.equal(JSON.stringify(s),before);
 home.capacity=used+6;
 assert.equal(E.productionAvailability(s,b).available,true,'declared output fits');
 before=JSON.stringify(s);assert.equal(E.settleFiniteProduction(s,b,settle,[]),false,'actual output exceeds capacity');
 assert.equal(JSON.stringify(s),before);
 assert.equal(s.srEconomy.patches.insight.remaining,initialSource);
 assert.equal(s.factsById[factId],undefined);
 home.capacity=used+7;
 assert.equal(E.settleFiniteProduction(s,b,settle,[]),true);
 assert.equal(home.resources.insight,initialInsight+7);
 assert.equal(library.resources.insight,0);
 assert.equal(s.srEconomy.patches.insight.remaining,initialSource-7);
 assert.equal(occupied(home),home.capacity);
 assert.equal(s.factsById[factId].quantities.insight,7);
 delete s.workOrdersById[orderId];
 const restored=save(s);assert.equal(restored.resources.insight,initialInsight+7);
 assert.equal(occupied(restored.stockpilesById[home.id]),home.capacity);
});

test('historical public library balance converts once; private and merchant balances stay owned',()=>{
 const {s,b,home,library}=withLibrary(),privateStock=s.stockpilesById['stockpile:lu-zhiwei'],merchant=s.stockpilesById['stockpile:qingxi'];
 home.resources.insight=2;library.resources.insight=5;privateStock.resources.insight=3;merchant.resources.insight=4;
 home.capacity=occupied(home)+1;
 const total=Object.values(s.stockpilesById).reduce((n,st)=>n+st.resources.insight,0);
 let loaded=save(s);
 assert.equal(loaded.resources.insight,7);
 assert.equal(occupied(loaded.stockpilesById[home.id]),home.capacity+4,'legacy excess remains available');
 assert.equal(loaded.stockpilesById[library.id].resources.insight,0);
 assert.equal(loaded.stockpilesById[privateStock.id].resources.insight,3);
 assert.equal(loaded.stockpilesById[merchant.id].resources.insight,4);
 assert.equal(Object.values(loaded.stockpilesById).reduce((n,st)=>n+st.resources.insight,0),total);
 const fact=Object.values(loaded.factsById).find(f=>f.operation==='library-study-budget'&&f.sourceStockpileId===`stockpile:${b.instanceId}`);
 assert.equal(fact.quantity,5);assert.equal(fact.targetStockpileId,home.id);
 const raw=JSON.stringify(loaded);loaded=save(loaded);E.initEconomy(loaded);E.initEconomy(loaded);
 assert.equal(JSON.stringify(loaded),raw);
});

test('historical reserved insight order keeps its single cargo on delivery or cancellation',()=>{
 const {s,home,library}=withLibrary(),baseTotal=Object.values(s.stockpilesById).reduce((n,st)=>n+st.resources.insight,0);library.resources.insight=1;
 const id=reserveHistoricalInsight(s,library,home),raw=JSON.stringify(s);
 const delivered=save(s);
 assert.equal(JSON.stringify(s),raw,'validation leaves the source save unchanged');
 assert.equal(delivered.resources.insight,1,'unreserved library balance converts once');
 assert.equal(delivered.workOrdersById[id].cargo.insight,1);
 delivered.worldTick++;E.tickEconomy(delivered);
 assert.equal(delivered.workOrdersById[id].phase,'delivered');
 assert.equal(delivered.resources.insight,2);
 assert.equal(Object.values(delivered.stockpilesById).reduce((n,st)=>n+st.resources.insight,0),baseTotal+2);
 assert.equal(Object.keys(delivered.factsById).filter(key=>key===`fact:transport:${id}`).length,1);
 assert.equal(JSON.stringify(save(delivered)),JSON.stringify(delivered));
 const cancelled=save(s);const result=E.cancelTransport(cancelled,id);
 assert.equal(cancelled.workOrdersById[id].phase,'cancelled');
 assert.equal(cancelled.stockpilesById[result.returnedTo].resources.insight,1);
 assert.equal(cancelled.resources.insight,1);
 assert.equal(Object.values(cancelled.stockpilesById).reduce((n,st)=>n+st.resources.insight,0),baseTotal+2);
 assert.equal(JSON.stringify(save(cancelled)),JSON.stringify(cancelled));
});

test('save validation rejects explicit stockpile access, custodian and scene errors while filling legacy omissions',()=>{
 const base=S.initial({sr:true}),id='stockpile:yunxiu';
 const badOwner=save(base);badOwner.stockpilesById[id].ownerId='person:unknown';
 assert.throws(()=>E.validateEconomy(badOwner),/所有者/);
 assert.throws(()=>save(badOwner),/归属/);
 for(const [label,mutate,pattern] of [
  ['access',s=>s.stockpilesById[id].access='guest',/访问级别/],
  ['null access',s=>s.stockpilesById[id].access=null,/访问级别/],
  ['custodian',s=>s.stockpilesById[id].custodianId='person:unknown',/custodianId|保管者/],
  ['null custodian',s=>s.stockpilesById[id].custodianId=null,/保管者/],
  ['scene',s=>s.stockpilesById[id].position.sceneId='scene:unknown',/场景或坐标/],
  ['coordinate',s=>s.stockpilesById[id].position.x='elsewhere',/场景或坐标/],
  ['travel',s=>s.stockpilesById[id].position={kind:'travel',travelId:'travel:unknown'},/旅队仓储/],
  ['null position',s=>s.stockpilesById[id].position=null,/仓储位置/]
 ]){const s=save(base);mutate(s);assert.throws(()=>save(s),pattern,label);}
 const old=save(base),amount=old.resources.wood;delete old.stockpilesById[id].custodianId;delete old.stockpilesById[id].access;delete old.stockpilesById[id].position;
 const restored=save(old);assert.equal(restored.stockpilesById[id].custodianId,'person:master');assert.equal(restored.stockpilesById[id].access,'public');assert.equal(restored.stockpilesById[id].position.sceneId,'scene:yunxiu-courtyard');assert.equal(restored.resources.wood,amount);
 assert.equal(JSON.stringify(save(restored)),JSON.stringify(restored));
});
