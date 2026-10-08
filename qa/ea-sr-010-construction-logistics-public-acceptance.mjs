/** SR-XF-010-AC-01: location-owned construction material from an earned public save.
 * Source: /tmp/immortal-m2-sr010-gap/{before,after}.json from public healing and farm placement.
 * Run: node --test qa/ea-sr-010-construction-logistics-public-acceptance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as S from '../dist/ea-opening-sim.mjs';
import {meterSweep} from '../dist/ea-sr-spatial.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const sourceDir=process.env.SR010_SOURCE_DIR||'/tmp/immortal-m2-sr010-gap';
const beforePath=`${sourceDir}/before.json`,afterPath=`${sourceDir}/after.json`;
const sourcesPresent=existsSync(beforePath)&&existsSync(afterPath);
const orderId='work:construction:2',sourceId='stockpile:construction:source:2',siteId='stockpile:construction:site:2';
const homeId='stockpile:yunxiu';
function earned(name){
 const record=JSON.parse(readFileSync(`${sourceDir}/${name}.json`,'utf8'));
 assert.equal(record.provenance.kind,'normal-public-command-checkpoint');
 const state=S.validateSave(record.state);
 assert.equal(JSON.stringify(state),JSON.stringify(record.state),'source is an exact canonical save');
 assert.equal(state.worldTick,record.provenance.counts.worldTick);
 return {record,h:harness(state,'sr010-construction')};
}
function exactSave(h,label){const raw=JSON.stringify(h.s);h.save();assert.equal(JSON.stringify(h.s),raw,`${label}: exact save and reload`);}
function start(h){const r=h.act('build','farm',26,16);assert.equal(r.workOrderId,orderId);return r;}
function flow(s){return s.workOrdersById[orderId]?.materialFlow;}
function count(s){const f=flow(s),source=s.stockpilesById[sourceId],site=s.stockpilesById[siteId],used=s.workOrdersById[orderId].usedCost;return {source:{wood:source.resources.wood,stone:source.resources.stone},carried:{wood:f.cargo.wood||0,stone:f.cargo.stone||0},site:{wood:site.resources.wood,stone:site.resources.stone},used:{wood:used.wood||0,stone:used.stone||0}};}
function conservation(s){const n=count(s);assert.equal(n.source.wood+n.carried.wood+n.site.wood+n.used.wood,25);assert.equal(n.source.stone+n.carried.stone+n.site.stone+n.used.stone,10);const publicView=S.viewEconomy(s).constructionMaterials[0];assert(publicView);assert.deepEqual(publicView.reservedAtSource,s.stockpilesById[sourceId].resources);assert.deepEqual(publicView.deliveredAtSite,s.stockpilesById[siteId].resources);assert.deepEqual(publicView.inTransit,flow(s).cargo);}

if(!sourcesPresent){
 test('SR-XF-010-AC-01 earned checkpoints',{skip:`Expected ${beforePath} and ${afterPath}`},()=>{});
}else{
 test('warehouse reservation, actual carrying, onsite delivery, installation and final build conserve one input',()=>{
  const {record,h}=earned('before'),initial={...h.s.resources};
  start(h);
  assert.deepEqual(h.s.reservationsById['reservation:build:2'].cost,{jade:30,wood:25,stone:10});
  assert.deepEqual({jade:h.s.resources.jade,wood:h.s.resources.wood,stone:h.s.resources.stone},{jade:initial.jade-30,wood:initial.wood-25,stone:initial.stone-10});
  assert.deepEqual(count(h.s),{source:{wood:25,stone:10},carried:{wood:0,stone:0},site:{wood:0,stone:0},used:{wood:0,stone:0}});
  assert.equal(h.s.workOrdersById[orderId].progressTicks,0);
  conservation(h.s);exactSave(h,'materials reserved at the warehouse');
  h.until(s=>flow(s)?.phase==='carrying','master actually picks up material',500);
  assert.deepEqual(count(h.s),{source:{wood:0,stone:0},carried:{wood:25,stone:10},site:{wood:0,stone:0},used:{wood:0,stone:0}});
  assert.equal(h.s.workOrdersById[orderId].progressTicks,0);
  conservation(h.s);exactSave(h,'material in the carrier custody');
  for(let i=0;i<20;i++)S.tick(h.s,.1);
  assert.equal(flow(h.s).phase,'carrying');
  assert.equal(h.s.workOrdersById[orderId].progressTicks,0,'travel itself cannot install materials');
  conservation(h.s);exactSave(h,'material still en route');
  h.until(s=>flow(s)?.phase==='ready','onsite delivery',500);
  assert.deepEqual(count(h.s),{source:{wood:0,stone:0},carried:{wood:0,stone:0},site:{wood:25,stone:10},used:{wood:0,stone:0}});
  assert.equal(h.s.workOrdersById[orderId].progressTicks,0,'delivery step gives no construction progress');
  conservation(h.s);exactSave(h,'material delivered onsite');
  h.until(s=>s.workOrdersById[orderId]?.progressTicks>=40,'actual installation',100);
  assert.deepEqual(count(h.s),{source:{wood:0,stone:0},carried:{wood:0,stone:0},site:{wood:20,stone:8},used:{wood:5,stone:2}});
  conservation(h.s);exactSave(h,'installed portion debited from site');
  h.until(s=>!s.workOrdersById[orderId],'physical construction completed',300);
  assert.equal(h.s.buildingsById['building:yunxiu:2']?.type,'farm');
  assert.equal(h.s.stockpilesById[sourceId],undefined);
  assert.equal(h.s.stockpilesById[siteId],undefined);
  assert.equal(S.viewEconomy(h.s).constructionMaterials.length,0);
  assert.equal(h.s.spatial.completedOrders.filter(o=>o.id===orderId&&o.phase==='completed').length,1);
  assert.deepEqual({jade:h.s.resources.jade,wood:h.s.resources.wood,stone:h.s.resources.stone},{jade:initial.jade-30,wood:initial.wood-25,stone:initial.stone-10});
  exactSave(h,'completed building and spent materials');
  console.log(JSON.stringify({case:'construction-delivery',source:beforePath,sourceCounts:record.provenance.counts,worldTick:h.s.worldTick,saves:h.counts.saves}));
 });

 test('cancellation during actual carriage returns the whole load before a single warehouse refund',()=>{
  const {h}=earned('before'),initial={...h.s.resources};start(h);
  h.until(s=>flow(s)?.phase==='carrying','actual pickup',500);
  const carriedPosition={x:h.s.master.scenic.x,y:h.s.master.scenic.y};
  h.act('setSpeed',0);const frozen=JSON.stringify(h.s);for(let i=0;i<30;i++)S.tick(h.s,.1);assert.equal(JSON.stringify(h.s),frozen,'pause does not move carried stock');exactSave(h,'paused during carriage');h.act('setSpeed',1);
  const result=h.act('cancelConstruction');assert.equal(result.pending,true);
  assert.equal(h.s.resources.wood,initial.wood-25,'refund has not crossed the yard yet');
  assert.equal(h.s.resources.stone,initial.stone-10);
  assert(h.s.master.scenic.x===carriedPosition.x&&h.s.master.scenic.y===carriedPosition.y);
  conservation(h.s);exactSave(h,'cancel request with physical cargo');
  h.until(s=>!s.workOrdersById[orderId],'cargo physically returned to source',500);
  assert.deepEqual({jade:h.s.resources.jade,wood:h.s.resources.wood,stone:h.s.resources.stone},{jade:initial.jade,wood:initial.wood,stone:initial.stone});
  assert.equal(h.s.spatial.completedOrders.filter(o=>o.id===orderId&&o.phase==='cancelled').length,1);
  assert.equal(h.act('cancelConstruction').alreadyCancelled,true);
  assert.equal(h.s.resources.wood,initial.wood);
  assert.equal(h.s.stockpilesById[sourceId],undefined);
  assert.equal(h.s.stockpilesById[siteId],undefined);
  exactSave(h,'one return and one refund');
 });

 test('installed materials stay spent; only the onsite remainder returns after cancellation and reload',()=>{
  const {h}=earned('before'),initial={...h.s.resources};start(h);
  h.until(s=>s.workOrdersById[orderId]?.progressTicks>=40,'forty actual installation steps',500);
  const pending=h.act('cancelConstruction');assert.equal(pending.pending,true);
  assert.deepEqual(pending.refund,{jade:24,wood:20,stone:8});
  assert.equal(h.s.resources.wood,initial.wood-25);
  exactSave(h,'unused material remains at the worksite');
  h.until(s=>!s.workOrdersById[orderId],'unused material returned to warehouse',500);
  assert.deepEqual({jade:h.s.resources.jade,wood:h.s.resources.wood,stone:h.s.resources.stone},{jade:initial.jade-6,wood:initial.wood-5,stone:initial.stone-2});
  assert.equal(h.s.spatial.completedOrders.at(-1).refund.wood,20);
  assert.equal(h.s.spatial.completedOrders.filter(o=>o.id===orderId&&o.phase==='cancelled').length,1);
  assert.equal(h.act('cancelConstruction').alreadyCancelled,true);
  exactSave(h,'partial refund completed exactly once');
 });

 test('earned in-progress save without a material-flow marker keeps its original paid order and cancellation',()=>{
  const {h}=earned('after'),initial={...h.s.resources};
  assert.equal(h.s.workOrdersById[orderId].materialFlow,undefined);
  exactSave(h,'existing paid order unchanged');
  for(let i=0;i<5;i++)S.tick(h.s,.1);
  assert.equal(h.s.workOrdersById[orderId].materialFlow,undefined);
  assert.equal(h.s.stockpilesById[sourceId],undefined);
  const result=h.act('cancelConstruction');assert.deepEqual(result.refund,{jade:30,wood:25,stone:10});
  assert.deepEqual({jade:h.s.resources.jade,wood:h.s.resources.wood,stone:h.s.resources.stone},{jade:initial.jade+30,wood:initial.wood+25,stone:initial.stone+10});
  assert.equal(h.act('cancelConstruction').alreadyCancelled,true);
  exactSave(h,'existing order refunded once without new stock');
 });

 test('isolated injury during carriage pauses the same cargo and resumes its route after recovery',()=>{
  const {h}=earned('before');start(h);
  h.until(s=>flow(s)?.phase==='carrying','actual pickup before isolated injury',500);
  h.s.master.wound=25;
  const held={position:{x:h.s.master.scenic.x,y:h.s.master.scenic.y},materials:count(h.s),progress:h.s.workOrdersById[orderId].progressTicks};
  for(let i=0;i<20;i++)S.tick(h.s,.1);
  assert.deepEqual({x:h.s.master.scenic.x,y:h.s.master.scenic.y},held.position);
  assert.deepEqual(count(h.s),held.materials);
  assert.equal(h.s.workOrdersById[orderId].progressTicks,held.progress);
  assert.match(h.s.activitiesById[h.s.master.activityId].reason,/受伤/);
  conservation(h.s);exactSave(h,'injured carrier and cargo held in place');
  h.until(s=>flow(s)?.phase==='ready','carrier recovers and delivers held cargo',1000);
  assert.equal(h.s.workOrdersById[orderId].progressTicks,0);
  assert.deepEqual(count(h.s).site,{wood:25,stone:10});
  exactSave(h,'same batch after injury recovery');
 });

 test('isolated warehouse medicine stays in the warehouse when construction stockpiles are created',()=>{
  const {h}=earned('before');
  h.s.stockpilesById[homeId].pills.qi=2;
  assert.equal(h.s.pills.qi,2);
  start(h);
  assert.equal(h.s.stockpilesById[homeId].pills.qi,2);
  assert.equal(h.s.stockpilesById[sourceId].pills.qi,0);
  assert.equal(h.s.stockpilesById[siteId].pills.qi,0);
  assert.equal(h.s.pills.qi,2,'new building material custody cannot copy medicine');
  exactSave(h,'warehouse medicine remains one physical stock');
 });

 test('isolated new obstruction interrupts a live route; cancellation reload returns the held cargo once',()=>{
  const {h}=earned('before'),initial={...h.s.resources};start(h);
  h.until(s=>flow(s)?.phase==='carrying','actual pickup before route fault injection',500);
  for(let i=0;i<5;i++)S.tick(h.s,.1);
  const heldRoute=structuredClone(h.s.master.scenic.path);
  assert(heldRoute.length>0,'the carrier has a route before the isolated obstruction');
  // Fault injection: a newly placed, otherwise legal well cuts the route already
  // held by the carrier. Move the story visitor outside the injected footprint.
  const visitor=h.s.personsById['person:lin-changfeng'];
  visitor.mind.scenic={...visitor.mind.scenic,x:35,y:30,path:[],goal:null};
  visitor.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:35,y:30};
  if(visitor.location?.sceneId==='scene:yunxiu-courtyard'){visitor.location.x=35;visitor.location.y=30;}
  const id=h.s.nextId++,well={id,instanceId:`building:yunxiu:${id}`,type:'well',x:28,y:14,level:1,
   transform:{x:28,y:14,orientation:'south'},prefabId:'prefab:well:units:v1',sceneId:'scene:yunxiu-courtyard',
   condition:100,enabled:true,progress:0,buildingGridVersion:'building-units-1'};
  h.s.buildings.push(well);h.s.buildingsById[well.instanceId]=well;h.s.spatial.geometryRevision++;
  assert(heldRoute.some((p,i)=>meterSweep(h.s,i?heldRoute[i-1]:h.s.master.scenic,p).blocked),'the new wall cuts the previously held route');
  for(let i=0;i<4;i++)S.tick(h.s,.1);
  assert.equal(meterSweep(h.s,h.s.master.scenic,h.s.master.scenic.path[0]||h.s.master.scenic).blocked,false,'the carrier holds or replans a wall-free route');
  assert.equal(h.s.workOrdersById[orderId].progressTicks,0);
  assert.deepEqual(count(h.s).carried,{wood:25,stone:10});
  conservation(h.s);exactSave(h,'route interrupted with cargo at one actual position');
  const requested=h.act('cancelConstruction');assert.equal(requested.pending,true);
  assert.equal(h.s.resources.wood,initial.wood-25,'a route interruption cannot grant an early refund');
  exactSave(h,'return transaction survived reload after route interruption');
  h.until(s=>!s.workOrdersById[orderId],'held cargo returned around the well',500);
  assert.deepEqual({jade:h.s.resources.jade,wood:h.s.resources.wood,stone:h.s.resources.stone},
   {jade:initial.jade,wood:initial.wood,stone:initial.stone});
  assert.equal(h.s.spatial.completedOrders.filter(o=>o.id===orderId&&o.phase==='cancelled').length,1);
  exactSave(h,'route-fault refund only once');
 });
}
