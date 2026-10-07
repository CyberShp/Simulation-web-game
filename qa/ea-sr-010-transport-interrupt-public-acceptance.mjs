/** SR-XF-010-AC-02: public healing, harvest, pickup and cancellation.
 * The injury and offsite-death triggers below are explicitly isolated event injections.
 * Run: node --test qa/ea-sr-010-transport-interrupt-public-acceptance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {settleEconomyDeath} from '../dist/ea-sr-economy.mjs';
import {geometryRevision,scenicSweep} from '../dist/ea-scene-geometry.mjs';
import {meterFindPath} from '../dist/ea-sr-spatial.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const carriedId='stockpile:carried:master',homeId='stockpile:yunxiu';
const allWood=s=>Object.values(s.stockpilesById).reduce((n,st)=>n+(st.resources.wood||0),0)
 +Object.values(s.workOrdersById).filter(w=>w.kind==='transport'&&!['delivered','cancelled'].includes(w.phase)).reduce((n,w)=>n+(w.cargo.wood||0),0);
function saveRoundtrip(s,label){
 const inventory=allWood(s),orders=structuredClone(Object.values(s.workOrdersById).filter(w=>w.kind==='transport'));
 const restored=S.validateSave(JSON.parse(JSON.stringify(s))),raw=JSON.stringify(restored);
 assert.equal(allWood(restored),inventory,`${label}: material survives reload`);
 assert.deepEqual(Object.values(restored.workOrdersById).filter(w=>w.kind==='transport'),orders);
 assert.equal(JSON.stringify(S.validateSave(JSON.parse(raw))),raw,`${label}: repeated reload is exact`);
 return restored;
}
function harvested(){
 const h=harness();h.act('masterAction','heal');h.until(s=>s.master.wound===0,'public healing',500);
 const a=h.act('startMasterHarvest','wood');h.until(s=>!s.activitiesById[a.id],'public wood harvest',500);
 assert.equal(h.s.stockpilesById[carriedId].resources.wood,12);
 assert.equal(h.s.factsById[`fact:manual-harvest:${a.id}`].quantity,12);
 saveRoundtrip(h.s,'earned carried wood');return h;
}
function carrying(){
 const h=harvested(),before=allWood(h.s),t=h.act('startTransport',carriedId,homeId,'person:master',{wood:12});
 assert.equal(h.s.workOrdersById[t.id].phase,'to-source');
 assert.equal(h.s.stockpilesById[carriedId].resources.wood,0);
 h.until(s=>s.workOrdersById[t.id].phase==='carrying','actual public pickup',20);
 assert.equal(allWood(h.s),before);saveRoundtrip(h.s,'actual pickup');
 return {h,t,before};
}

test('public harvest → pickup → walk → delivery keeps one batch',()=>{
 const {h,t,before}=carrying();h.until(s=>s.workOrdersById[t.id].phase==='delivered','actual public delivery',500);
 assert.equal(allWood(h.s),before);assert.equal(h.s.stockpilesById[homeId].resources.wood,77);
 assert.equal(h.s.factsById[`fact:transport:${t.id}`].operation,'delivery');
 assert.equal(h.s.reservationsById[`reservation:transport:${t.id}`],undefined);
 saveRoundtrip(h.s,'delivered once');
});

test('public pre-pickup cancellation returns the reserved material once',()=>{
 const h=harvested(),before=allWood(h.s);
 const t=h.act('startTransport',homeId,carriedId,'person:master',{wood:5});
 assert.equal(h.s.workOrdersById[t.id].phase,'to-source');assert.equal(h.s.stockpilesById[homeId].resources.wood,60);
 const c=h.act('cancelTransport',t.id);assert.equal(c.returnedTo,homeId);
 assert.equal(h.s.stockpilesById[homeId].resources.wood,65);
 assert.equal(h.s.stockpilesById[`stockpile:dropped:${t.id}`],undefined);
 assert.equal(allWood(h.s),before);const restored=saveRoundtrip(h.s,'pre-pickup refund');
 const saved=JSON.stringify(h.s);assert.throws(()=>h.act('cancelTransport',t.id),/已结束/);
 assert.equal(JSON.stringify(h.s),saved);assert.equal(restored.factsById[`fact:transport-cancel:${t.id}`].targetStockpileId,homeId);
 assert.throws(()=>S.dispatchCommand(restored,{name:'cancelTransport',args:[t.id]}),/已结束/);
});

test('injected injury pauses earned carrying; public cancellation drops once at actual feet',()=>{
 const {h,t,before}=carrying();for(let i=0;i<5;i++)S.tick(h.s,.1);
 // Event injection only: this suite has no public injury source for a working carrier.
 h.s.master.wound=50;const feet={sceneId:h.s.master.position.sceneId,x:h.s.master.scenic.x,y:h.s.master.scenic.y};
 for(let i=0;i<20;i++)S.tick(h.s,.1);
 assert.equal(h.s.workOrdersById[t.id].phase,'carrying');
 assert.deepEqual({sceneId:h.s.master.position.sceneId,x:h.s.master.scenic.x,y:h.s.master.scenic.y},feet);
 assert.equal(allWood(h.s),before);saveRoundtrip(h.s,'injured custody');
 const c=h.act('cancelTransport',t.id),drop=h.s.stockpilesById[c.returnedTo];
 assert.equal(c.returnedTo,`stockpile:dropped:${t.id}`);
 assert.deepEqual(drop.position,feet);assert.equal(drop.ownerId,'person:master');
 assert.equal(drop.resources.wood,12);assert.equal(h.s.stockpilesById[homeId].resources.wood,65);
 assert.equal(h.s.reservationsById[`reservation:transport:${t.id}`],undefined);
 assert.equal(allWood(h.s),before);const restored=saveRoundtrip(h.s,'injury cancellation');
 const saved=JSON.stringify(h.s);assert.throws(()=>h.act('cancelTransport',t.id),/已结束/);
 assert.equal(JSON.stringify(h.s),saved);
 for(let i=0;i<20;i++)S.tick(restored,.1);
 assert.equal(restored.stockpilesById[c.returnedTo].resources.wood,12);
 assert.equal(allWood(restored),before);saveRoundtrip(restored,'cancelled order remains settled');
 assert.equal(Object.keys(restored.factsById).filter(id=>id===`fact:transport-cancel:${t.id}`).length,1);
});

test('injected courtyard route interruption preserves earned cargo through cancellation and reload',()=>{
 const {h,t,before}=carrying();for(let i=0;i<5;i++)S.tick(h.s,.1);
 const attempted=JSON.stringify(h.s);
 assert.throws(()=>h.act('build','well',30,14),/已有身体活动/);
 assert.equal(JSON.stringify(h.s),attempted,'the public build command cannot replace the carrying body');
 assert.equal(S.placementLock(h.s,'well',30,14),'','the obstruction has a legal courtyard footprint');
 // Fault injection: a completed well appears across the current path. The
 // construction command takes its own body and time, so this event is not a player action.
 const id=h.s.nextId++,well={id,instanceId:`building:yunxiu:${id}`,type:'well',x:30,y:14,level:1,
  transform:{x:30,y:14,orientation:'south'},prefabId:'prefab:well:units:v1',sceneId:'scene:yunxiu-courtyard',
  condition:100,enabled:true,progress:0,buildingGridVersion:'building-units-1'};
 h.s.buildings.push(well);h.s.buildingsById[well.instanceId]=well;h.s.spatial.geometryRevision++;
 const target=h.s.stockpilesById[homeId].position;
 assert.equal(scenicSweep(h.s,h.s.master.scenic,target).blocked,true,'the held route now intersects the obstacle');
 for(let i=0;i<5;i++)S.tick(h.s,.1);
 assert.equal(h.s.workOrdersById[t.id].phase,'carrying');
 assert.equal(h.s.reservationsById[`reservation:transport:${t.id}`].cost.wood,12);
 assert.equal(h.s.stockpilesById[homeId].resources.wood,65);
 assert.equal(allWood(h.s),before);saveRoundtrip(h.s,'route replanned with cargo retained');
 const feet={sceneId:h.s.master.position.sceneId,x:h.s.master.scenic.x,y:h.s.master.scenic.y};
 const result=h.act('cancelTransport',t.id),drop=h.s.stockpilesById[result.returnedTo];
 assert.deepEqual(drop.position,feet);assert.equal(drop.ownerId,'person:master');
 assert.equal(drop.resources.wood,12);assert.equal(allWood(h.s),before);
 const restored=saveRoundtrip(h.s,'route interruption cancellation');
 assert.throws(()=>S.dispatchCommand(restored,{name:'cancelTransport',args:[t.id]}),/已结束/);
 for(let i=0;i<20;i++)S.tick(restored,.1);
 assert.equal(restored.stockpilesById[result.returnedTo].resources.wood,12);
 assert.equal(allWood(restored),before);saveRoundtrip(restored,'route interruption stays settled');
});

test('injected complete route closure holds earned cargo through waiting, reload, and one cancellation',()=>{
 const {h,t,before}=carrying();for(let i=0;i<5;i++)S.tick(h.s,.1);
 const feet={sceneId:h.s.master.position.sceneId,x:h.s.master.scenic.x,y:h.s.master.scenic.y};
 // Fault injection: these completed wells form a closed, individually valid
 // courtyard barrier after public pickup; building while carrying is unavailable.
 const barrier=[[32,12],[34,12],[36,12],[30,14],[38,14],[32,16],[36,16],
  [30,18],[38,18],[32,20],[34,20],[36,20]];
 for(const [x,y] of barrier){
  const id=h.s.nextId++,well={id,instanceId:`building:yunxiu:${id}`,type:'well',x,y,level:1,
   transform:{x,y,orientation:'south'},prefabId:'prefab:well:units:v1',
   sceneId:'scene:yunxiu-courtyard',condition:100,enabled:true,progress:0,
   buildingGridVersion:'building-units-1'};
  h.s.buildings.push(well);h.s.buildingsById[well.instanceId]=well;h.s.spatial.geometryRevision++;
 }
 assert.equal(meterFindPath(h.s,h.s.master.scenic,h.s.stockpilesById[homeId].position,{maxSnap:0}),null,
  'the actual destination has no alternate route');
 for(let i=0;i<40;i++)S.tick(h.s,.1);
 const held=h.s.workOrdersById[t.id],reservationId=`reservation:transport:${t.id}`;
 assert.equal(held.phase,'carrying');assert.match(held.reason,/道路不通/);
 assert.deepEqual({sceneId:h.s.master.position.sceneId,x:h.s.master.scenic.x,y:h.s.master.scenic.y},feet);
 assert.deepEqual(h.s.master.scenic.path,[]);assert.equal(h.s.master.scenic.goal,null);
 assert.equal(h.s.master.scenic.revision,geometryRevision(h.s));
 assert.equal(h.s.reservationsById[reservationId].cost.wood,12);
 assert.equal(h.s.stockpilesById[homeId].resources.wood,65);
 assert.equal(allWood(h.s),before);
 const restored=saveRoundtrip(h.s,'saved while all routes are closed');
 for(let i=0;i<40;i++)S.tick(restored,.1);
 assert.equal(restored.workOrdersById[t.id].phase,'carrying');
 assert.equal(restored.reservationsById[reservationId].cost.wood,12);
 assert.equal(allWood(restored),before);
 const {state:cancelled,result}=S.dispatchCommand(restored,{name:'cancelTransport',args:[t.id]});
 const drop=cancelled.stockpilesById[result.returnedTo];
 assert.equal(result.returnedTo,`stockpile:dropped:${t.id}`);
 assert.deepEqual(drop.position,feet);assert.equal(drop.resources.wood,12);
 assert.equal(cancelled.reservationsById[reservationId],undefined);
 assert.equal(allWood(cancelled),before);
 const settled=saveRoundtrip(cancelled,'cancelled behind complete closure');
 assert.throws(()=>S.dispatchCommand(settled,{name:'cancelTransport',args:[t.id]}),/已结束/);
 for(let i=0;i<20;i++)S.tick(settled,.1);
 assert.equal(settled.stockpilesById[result.returnedTo].resources.wood,12);
 assert.equal(allWood(settled),before);
 saveRoundtrip(settled,'repeated wait after cancellation');
});

test('injected offsite death hook records the carrier\'s actual scene',()=>{
 const {h,t,before}=carrying();
 // Isolated event injection: preserve the earned cargo/order, then model an offsite death report.
 h.s.master.position={kind:'scene',sceneId:'scene:market',x:37,y:25};
 settleEconomyDeath(h.s,'person:master');
 const w=h.s.workOrdersById[t.id],drop=h.s.stockpilesById[w.returnedTo];
 assert.equal(w.phase,'cancelled');assert.deepEqual(drop.position,{sceneId:'scene:market',x:37,y:25});
 assert.equal(drop.ownerId,'person:master');assert.equal(drop.resources.wood,12);
 assert.equal(allWood(h.s),before);const restored=saveRoundtrip(h.s,'offsite death cargo location');
 settleEconomyDeath(restored,'person:master');
 assert.equal(restored.stockpilesById[w.returnedTo].resources.wood,12);
 assert.equal(allWood(restored),before);saveRoundtrip(restored,'repeated death cleanup');
});
