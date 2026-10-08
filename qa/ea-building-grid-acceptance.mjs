/** U-99 / SR-XF-003–006: building units are separate from navigation metres.
 * Explicit component fixtures only. No private saves, files, browser or normal-play claims.
 * Keep the historical half-metre fixtures in ea-sr-spatial-acceptance.mjs unchanged. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import * as base from '../dist/ea-sim.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {spatialPrefab,spatialFootprint,spatialAccess,spatialSlots,meterCanStand,meterFindPath,meterSweep,validateSpatial} from '../dist/ea-sr-spatial.mjs';
import {prepareFacilityActivity,validateFacilityActivities} from '../dist/ea-facility-activities.mjs';
import {initEconomy} from '../dist/ea-sr-economy.mjs';
import {initPersons} from '../dist/ea-sr-persons.mjs';

function fixture(){
 const s=S.initial({sr:true,seed:713});
 // Deliberate component funding/health: this fixture does not prove player progression.
 s.master.wound=0;s.master.energy=100;s.speed=1;
 for(const k of Object.keys(s.resources))s.resources[k]=10000;
 // Complete ordinary content hydration before taking any migration baseline.
 return S.validateSave(s);
}
function well(profile=S.BUILDING_GRID.version){return {id:99,instanceId:'building:yunxiu:99',type:'well',level:1,transform:{x:10,y:30,orientation:'south'},...(profile?{buildingGridVersion:profile}:{})};}

test('U-99: 14 prefab types / 42 variants have integral cell footprints and reachable physical stations',()=>{
 let variants=0,stations=0;
 for(const type of Object.keys(S.BUILDINGS))for(let level=1;level<=S.BUILDINGS[type].max;level++){
  const b={...well(),type,level},s={buildings:[b]},d=spatialPrefab(b),cells=S.buildingCellSize(type,level);
  assert.equal(d.width,cells.columns*2);assert.equal(d.height,cells.rows*2);
  assert.deepEqual(spatialFootprint(b),[[10,30],[10+d.width,30],[10+d.width,30+d.height],[10,30+d.height]]);
  for(const kind of ['rest','heal','study','teach','cultivate','work','care'])for(const slot of spatialSlots(b,kind)){
   stations++;assert(meterCanStand(s,slot.position),`${type}/${level}/${slot.id}`);
   assert.notEqual(meterFindPath(s,spatialAccess(b),slot.position,{maxSnap:0}),null,`${type}/${level}/${slot.id}`);
  }
  variants++;
 }
 assert.equal(variants,42);assert.equal(stations,264);
 assert.equal(S.buildingCellSize('hall',1).count,16);
 for(const type of ['lumber','quarry'])assert.deepEqual(S.buildingCellSize(type,1),{columns:2,rows:2,count:4,width:4,height:4});
});

test('U-99: real renderer keeps 2m cell selection and 0.5m walking distinct through zoom and pan without state writes',async()=>{
 const oldImage=globalThis.Image,oldDPR=globalThis.devicePixelRatio,oldFetch=globalThis.fetch;
 const noop=()=>{},ctx=new Proxy({measureText:t=>({width:t.length*7}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
 globalThis.Image=class{set src(v){queueMicrotask(()=>this.onload?.());}};
 globalThis.fetch=async()=>({ok:false});globalThis.devicePixelRatio=1;
 let r;
 try{
  const s=fixture(),before=JSON.stringify(s);let sceneState=s,mode='inspect',away=null,battle=null;
  const canvas={width:900,height:600,clientWidth:900,clientHeight:600,getContext:()=>ctx,getBoundingClientRect:()=>({left:7,top:13})};
  r=createWorldRenderer(canvas,{getState:()=>sceneState,getMode:()=>mode,getSelection:()=>null,getLocalScene:()=>away,getCampaignScene:()=>battle});await r.ready;
  const screen=p=>{const q=r.projectPoint(p);return{clientX:q.x+7,clientY:q.y+13};};
  for(const delta of [0,.65,-1,.8]){
   r.setZoom(delta);r.pan.x+=13;r.pan.y-=7;
   for(const p of [{x:40.1,y:34.1},{x:41.8,y:35.8},{x:39.64,y:41.88},{x:33.73,y:32.14}]){
    const event=screen(p),walk={x:Math.round(p.x/.5)*.5,y:Math.round(p.y/.5)*.5},cell={x:Math.floor(p.x/2)*2,y:Math.floor(p.y/2)*2};
    assert.deepEqual(r.walkPoint(event),walk);mode='build';
    assert.deepEqual(r.mapPoint(event),cell);const hit=r.pick(event);assert.equal(hit.x,cell.x);assert.equal(hit.y,cell.y);
    mode='inspect';const raw=r.screenPoint(event);assert(Math.hypot(raw.x-p.x,raw.y-p.y)<1e-9);
   }
  }
  const p={x:9.173,y:12.327};sceneState=S.validateSave(JSON.parse(before));
  sceneState.master.location={kind:'local',sceneId:'scene:market',...p};
  sceneState.master.position={kind:'scene',sceneId:'scene:market',...p};
  away={scene:{id:'scene:market',objects:[]},actors:[]};const awayBefore=JSON.stringify(sceneState);
  let q=r.walkPoint(screen(p));assert(Math.hypot(q.x-p.x,q.y-p.y)<1e-9);
  assert.equal(JSON.stringify(sceneState),awayBefore);
  sceneState=s;away=null;battle={type:'combat',player:{x:3,y:4},enemies:[],allies:[],effects:[],obstacles:[]};
  q=r.walkPoint(screen(p));assert(Math.hypot(q.x-p.x,q.y-p.y)<1e-9);assert.equal(JSON.stringify(s),before);
 }finally{r?.destroy();globalThis.Image=oldImage;globalThis.devicePixelRatio=oldDPR;globalThis.fetch=oldFetch;}
});

test('U-99: half-cell anchors, occupied cells and protected terrain reject atomically',()=>{
 const s=fixture(),before=JSON.stringify(s);
 for(const [x,y]of[[12.5,32],[12,32.5],[24,4],[58,10],[30,58]]){
  assert.throws(()=>S.dispatchCommand(s,{name:'build',args:['lumber',x,y]}));assert.equal(JSON.stringify(s),before);
 }
});

test('U-99: unit well body blocks standing/crossing; front station is reachable; legacy input geometry remains unchanged',()=>{
 const b=well(),s={buildings:[b]};assert(!meterCanStand(s,{x:11,y:31}));
 assert(meterSweep(s,{x:9,y:31},{x:13,y:31}).blocked);
 const slot=spatialSlots(b,'work');assert.equal(slot.length,1);assert.deepEqual(slot[0].position,spatialAccess(b));
 assert(meterCanStand(s,slot[0].position));assert.notEqual(meterFindPath(s,{x:9,y:33},slot[0].position,{maxSnap:0}),null);
 assert.equal(spatialSlots(well(null),'work').length,2);assert(meterCanStand({buildings:[well(null)]},{x:11,y:31}));
});

function legacyWorkingWell(){
 const s=fixture();delete s.spatial.buildingGridVersion;
 for(const b of s.buildings){delete b.buildingGridVersion;b.prefabId=`prefab:${b.type}:metres:v1`;}
 const add=(type,x,y)=>{const id=s.nextId++,b={id,instanceId:`building:yunxiu:${id}`,type,x,y,level:1,transform:{x,y,orientation:'south'},prefabId:`prefab:${type}:metres:v1`,sceneId:'scene:yunxiu-courtyard',condition:100,enabled:true,progress:0};s.buildings.push(b);return b;};
 const b=add('well',10,30),workshop=add('workshop',20,30),workers=['井工甲','井工乙'].map(name=>base.addDisciple(s,{name}));
 initEconomy(s);initPersons(s);
 for(const p of workers){
  p.job=b.id;p.mind.activity='work';prepareFacilityActivity(s,p,b,'work',0);
  const a=s.activitiesById[p.activityId],slot=spatialSlots(b,'work').find(q=>q.id===a.slotId);
  // Explicit old executing-slot fixture, legal under the pre-unit collision profile.
  Object.assign(p.mind.scenic,slot.position,{path:[],goal:{...slot.position}});
  p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',...slot.position};a.phase='executing';
 }
 // Two historical batches: well progress and a material-consuming workshop batch.
 // Contributions are existing facts, not new work performed during migration.
 for(const facility of[b,workshop]){
  const id=`work:production:${facility.instanceId}`,reservationId=`reservation:input:${facility.instanceId}`;
  s.workOrdersById[id]={id,kind:'production',targetId:facility.instanceId,phase:'active',batch:1,inheritedTicks:17,progressTicks:37,durationTicks:base.BUILDINGS[facility.type].duration*10,reservationId,contributions:Object.fromEntries(workers.map(p=>[p.personId,10])),resultTransactionId:null};
  s.reservationsById[reservationId]={id:reservationId,kind:'materials',workOrderId:id,cost:{...base.BUILDINGS[facility.type].input}};
  if(facility===b)for(const p of workers)s.activitiesById[p.activityId].workOrderId=id;
 }
 validateFacilityActivities(s);validateSpatial(s);return{s,b,workers};
}

test('U-99: old well work:2 waits safely; production inputs/progress and identities survive an immutable, idempotent load',()=>{
 const {s,b,workers}=legacyWorkingWell(),source=JSON.stringify(s),second={...s.activitiesById[workers[1].activityId]},firstId=workers[0].activityId;
 const before={resources:structuredClone(s.resources),orders:structuredClone(s.workOrdersById),materials:structuredClone(Object.values(s.reservationsById).filter(r=>r.kind==='materials')),stocks:Object.values(s.stockpilesById).map(st=>[st.id,{...st.resources},{...st.pills}]),facts:structuredClone(s.factsById),worldTick:s.worldTick,time:s.time,seed:s.sim.seed,persons:Object.values(s.personsById).map(p=>[p.personId,p.name,p.appearance])};
 assert(second.slotId.endsWith('work:2'));assert(before.materials.some(r=>Object.values(r.cost).some(n=>n>0)));
 const migrated=S.validateSave(s);assert.equal(JSON.stringify(s),source);validateFacilityActivities(migrated);validateSpatial(migrated);
 const a=migrated.activitiesById[second.id],p=migrated.personsById[second.personId];
 assert.equal(a.id,second.id);assert.equal(a.workOrderId,second.workOrderId);assert.equal(a.phase,'waiting');assert(!a.slotId&&!a.reservationId);
 assert(!migrated.reservationsById[second.reservationId]);assert(!p.mind.scenic.goal&&!p.mind.scenic.activitySlotId);assert(meterCanStand(migrated,p.mind.scenic));
 assert.equal(migrated.spatial.migrations.filter(m=>m.entityId===a.id&&m.kind==='activity-unit-grid-wait'&&m.releasedReservationId===second.reservationId).length,1);
 const first=migrated.activitiesById[firstId],slot=spatialSlots(migrated.buildingsById[b.instanceId],'work')[0],feet=migrated.personsById[first.personId].mind.scenic;
 assert.equal(first.phase,'executing');assert(Math.hypot(feet.x-slot.position.x,feet.y-slot.position.y)<.04);assert.equal(feet.path.length,0);
 assert.deepEqual(migrated.resources,before.resources);
 assert.deepEqual(Object.keys(migrated.workOrdersById),Object.keys(before.orders));
 for(const [id,oldOrder] of Object.entries(before.orders)){
  const order=migrated.workOrdersById[id],siteId=`stockpile:${oldOrder.targetId}`,inputCost=before.materials.find(r=>r.workOrderId===id).cost;
  const {recipeSnapshot,...retained}=order;
  assert.deepEqual(retained,oldOrder,`${id}: paid work and progress survive`);
  assert.equal(recipeSnapshot.recipeVersion,'economy:yunxiu:v1');
  assert.equal(recipeSnapshot.durationValue,oldOrder.durationTicks);
  assert.deepEqual(recipeSnapshot.inputCost,inputCost);
  assert.deepEqual(recipeSnapshot.sourceStockpileIds,Object.fromEntries(Object.keys(inputCost).map(key=>[key,siteId])));
  assert.equal(recipeSnapshot.ownerId,'person:master');
  assert.equal(recipeSnapshot.createdTick,0);
 }
 assert.deepEqual(Object.values(migrated.reservationsById).filter(r=>r.kind==='materials'),before.materials);
 assert.deepEqual(Object.values(migrated.stockpilesById).map(st=>[st.id,{...st.resources},{...st.pills}]),before.stocks);
 assert.deepEqual(migrated.factsById,before.facts);
 assert.equal(migrated.worldTick,before.worldTick);assert.equal(migrated.time,before.time);assert.equal(migrated.sim.seed,before.seed);
 assert.deepEqual(Object.values(migrated.personsById).map(p=>[p.personId,p.name,p.appearance]),before.persons);
 const saved=JSON.stringify(migrated);assert.equal(JSON.stringify(S.validateSave(JSON.parse(saved))),saved);assert.equal(JSON.stringify(S.validateSave(s)),saved);
});

test('U-99: public build/relocate/upgrade completes on site, rejects expansion conflict and retains exact saved footprint',()=>{
 let s=fixture();const act=(name,...args)=>{const r=S.dispatchCommand(s,{name,args});s=r.state;return r.result;};
 const save=()=>{const raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);};
 const finish=r=>{let n=0;while(s.workOrdersById[r.workOrderId]&&n++<6000)S.tick(s,.1);assert(n<6000);save();return s.buildings.find(b=>b.id===r.id);};
 const a=finish(act('build','lumber',8,34));assert.equal(spatialPrefab(a).cells.count,4);
 const b=finish(act('build','quarry',12,34)),before=JSON.stringify(s);
 assert.throws(()=>act('upgrade',a.id),/冲突/);assert.equal(JSON.stringify(s),before);
 finish(act('relocate',b.id,18,34));const r=act('upgrade',a.id);save();const upgraded=finish(r);
 assert.equal(upgraded.level,2);assert.equal(spatialPrefab(upgraded).cells.count,9);
 assert.deepEqual(spatialFootprint(upgraded),[[8,34],[14,34],[14,40],[8,40]]);validateSpatial(s);
 assert.deepEqual(s.spatial.completedOrders.slice(-4).map(o=>o.operation),['build','build','relocate','upgrade']);
});
