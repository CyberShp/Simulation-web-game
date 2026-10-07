/** SR-XF-004/006: physical furniture, versioned save migration and safe changes.
 * Funded component fixtures exercise failure and recovery; normal player routes
 * are covered separately by ea-courtyard-life-acceptance.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import * as base from '../dist/ea-sim.mjs';
import {prepareFacilityActivity,validateFacilityActivities} from '../dist/ea-facility-activities.mjs';
import {initPersons} from '../dist/ea-sr-persons.mjs';
import {studyArt} from '../dist/ea-sr-cultivation.mjs';
import {startTransport,tickEconomy} from '../dist/ea-sr-economy.mjs';
import {travelSR,srWorldCommand} from '../dist/ea-sr-world.mjs';
import {INTERIOR_LAYOUT_VERSION,spatialPrefab,spatialSlots,spatialAccess,meterCanStand,meterFindPath,meterSweep,validateSpatial,handlers,tickSpatial,polygonContains,spatialFootprint,viewSpatial} from '../dist/ea-sr-spatial.mjs';

const kinds=['rest','heal','study','teach','cultivate','work','care'];
function fixture(){const s=S.initial({sr:true,seed:415});s.master.wound=0;s.master.energy=100;s.speed=1;for(const key of Object.keys(s.resources))s.resources[key]=10000;return S.validateSave(s);}
function room(s,type,x=40,y=40,level=1){const id=s.nextId++,b={id,instanceId:`building:yunxiu:${id}`,type,level,x,y,transform:{x,y,orientation:'south'},buildingGridVersion:S.BUILDING_GRID.version,interiorLayoutVersion:INTERIOR_LAYOUT_VERSION,prefabId:`prefab:${type}:units:v1`,sceneId:'scene:yunxiu-courtyard',condition:100,enabled:true,progress:0};s.buildings.push(b);return b;}
function feet(s,p,point){const q=p===s.master?p.scenic:p.mind.scenic;Object.assign(q,point,{path:[],goal:null});p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',...point};}
function dimensions(poly){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);return {width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
function assertNear(a,b){assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);}
function compact(s){delete s.spatial.interiorLayoutVersion;for(const b of s.buildings)delete b.interiorLayoutVersion;return s;}
function snapshotFacts(s){return {worldTick:s.worldTick,time:s.time,seed:s.sim.seed,resources:structuredClone(s.resources),orders:structuredClone(s.workOrdersById),reservations:structuredClone(s.reservationsById),story:structuredClone(s.story),persons:Object.values(s.personsById).map(p=>[p.personId,p.name,structuredClone(p.appearance)]),buildings:s.buildings.map(b=>[b.instanceId,b.type,b.level,{...b.transform},b.condition]),stocks:Object.values(s.stockpilesById).map(st=>[st.id,structuredClone(st.resources),structuredClone(st.pills)])};}

test('SR-XF-004-AC-01/02: all adult furniture and 264 stations fit the shared room and are reachable through the real doorway',()=>{
 let count=0;
 for(const type of Object.keys(base.BUILDINGS))for(let level=1;level<=base.BUILDINGS[type].max;level++){
  const s=fixture(),b=room(s,type,40,40,level),d=spatialPrefab(b),slots=kinds.flatMap(kind=>spatialSlots(b,kind));
  for(const f of d.furniture){const size=dimensions(f.polygon);if(f.kind==='bed'){assertNear(size.width,.9);assertNear(size.height,2.2);}if(f.kind==='desk'){assertNear(size.width,1.1);assertNear(size.height,.65);}for(const [x,y]of f.polygon)assert(x>=.18&&x<=d.width-.18&&y>=.18&&y<=d.height-.18,`${type}/${level}/${f.id} inside floor`);}
  for(const slot of slots){assert(meterCanStand(s,slot.position),slot.id);const path=meterFindPath(s,spatialAccess(b),slot.position,{maxSnap:0});assert.notEqual(path,null,slot.id);let last=spatialAccess(b);for(const p of path){assert.equal(meterSweep(s,last,p).blocked,false);last=p;}count++;}
  for(let i=0;i<slots.length;i++)for(let j=0;j<i;j++){const a=slots[i],z=slots[j],distance=Math.hypot(a.position.x-z.position.x,a.position.y-z.position.y);if(distance<.001)assert.deepEqual(new Set([a.kind,z.kind]),new Set(['rest','heal']));else assert(distance>=.52,`${type}/${level}: two distinct bodies fit ${a.id}, ${z.id}`);}
  if(['hall','house','clinic'].includes(type)){assert.equal(d.furniture.filter(f=>f.kind==='bed').length,4*level);assert.equal(spatialSlots(b,'rest').length,4*level);}
 }
 assert.equal(count,264);
});

test('SR-XF-004-AC-02 / SAVE-01: executing bed and navigating study keep their identity, reservations and facts across a deterministic immutable load',()=>{
 const s=fixture(),hall=s.buildings[0];delete s.spatial.interiorLayoutVersion;for(const b of s.buildings)delete b.interiorLayoutVersion;
 const p=base.addDisciple(s,{name:'原床住客'});initPersons(s);feet(s,p,spatialAccess(hall));prepareFacilityActivity(s,p,hall,'rest',0);const rest=s.activitiesById[p.activityId],oldRest=spatialSlots(hall,'rest').find(slot=>slot.id===rest.slotId);feet(s,p,oldRest.position);p.mind.scenic.goal={...oldRest.position};rest.phase='executing';
 feet(s,s.master,spatialAccess(hall));prepareFacilityActivity(s,s.master,hall,'study',0);const studyId=s.master.activityId,bedId=rest.slotId,source=JSON.stringify(s),facts=snapshotFacts(s);
 validateSpatial(s);validateFacilityActivities(s);
 const loaded=S.validateSave(s);assert.equal(JSON.stringify(s),source);assert.deepEqual(snapshotFacts(loaded),facts);
 const sleeper=loaded.personsById[p.personId],newBed=spatialSlots(loaded.buildings[0],'rest').find(slot=>slot.id===bedId);
 assert.equal(loaded.spatial.interiorLayoutVersion,INTERIOR_LAYOUT_VERSION);assert.equal(sleeper.activityId,rest.id);assert.equal(loaded.activitiesById[rest.id].phase,'executing');assertNear(sleeper.mind.scenic.x,newBed.position.x);assertNear(sleeper.mind.scenic.y,newBed.position.y);assert.equal(sleeper.mind.scenic.path.length,0);
 assert.equal(loaded.master.activityId,studyId);assert.equal(loaded.activitiesById[studyId].phase,'navigating');assert(loaded.master.scenic.path.length>0);validateFacilityActivities(loaded);validateSpatial(loaded);
 const saved=JSON.stringify(loaded);assert.equal(JSON.stringify(S.validateSave(JSON.parse(saved))),saved);assert.equal(JSON.stringify(S.validateSave(s)),saved);
});

test('SR-XF-004-AC-03 / SAVE-01: invalid original geometry and unknown furniture versions leave source saves intact',()=>{
 const s=fixture();delete s.spatial.interiorLayoutVersion;for(const b of s.buildings)delete b.interiorLayoutVersion;
 const b=s.buildings[0];feet(s,s.master,{x:b.transform.x+.05,y:b.transform.y+1});const bad=JSON.stringify(s);assert.throws(()=>S.validateSave(s),/脚点|位置/);assert.equal(JSON.stringify(s),bad);
 for(const owner of ['spatial','building']){const v=fixture();(owner==='spatial'?v.spatial:v.buildings[0]).interiorLayoutVersion='future-furniture';const before=JSON.stringify(v);assert.throws(()=>S.validateSave(v),/室内布局版本/);assert.equal(JSON.stringify(v),before);}
});

test('SR-XF-004-AC-02 / SAVE-01: an executing study order retains paid materials and exact progress, then resumes at its same desk',()=>{
 const s=fixture();delete s.spatial.interiorLayoutVersion;for(const b of s.buildings)delete b.interiorLayoutVersion;feet(s,s.master,spatialAccess(s.buildings[0]));
 const {orderId}=studyArt(s,'qingyuan');for(let n=0;s.srCultivation.orders[orderId].progressTicks<20&&n<2000;n++)S.tick(s,.1);
 const order=structuredClone(s.srCultivation.orders[orderId]),activity=structuredClone(s.activitiesById[s.master.activityId]),facts=snapshotFacts(s),knowledge=structuredClone(s.master.artsById),source=JSON.stringify(s);assert.equal(order.progressTicks,20);assert.equal(order.phase,'executing');
 const loaded=S.validateSave(s),next=loaded.srCultivation.orders[orderId];assert.equal(JSON.stringify(s),source);assert.deepEqual(snapshotFacts(loaded),facts);assert.deepEqual(loaded.master.artsById,knowledge);assert.equal(loaded.master.activityId,activity.id);assert.equal(loaded.activitiesById[activity.id].slotId,activity.slotId);assert.deepEqual({...next,target:null},{...order,target:null});
 const desk=spatialSlots(loaded.buildings[0],'study').find(slot=>slot.id===activity.slotId);assert.deepEqual(next.target,desk.position);assertNear(loaded.master.scenic.x,desk.position.x);assertNear(loaded.master.scenic.y,desk.position.y);
 for(let n=0;next.phase!=='completed'&&n<1000;n++)S.tick(loaded,.1);assert.equal(next.phase,'completed');assert(loaded.master.artsById.qingyuan.understanding>knowledge.qingyuan.understanding);assert.equal(loaded.srCultivation.orders[orderId].progressTicks,order.durationTicks);S.validateSave(loaded);
});

test('SR-XF-006-AC-01/03: occupied adult bed evacuates by bounded real steps before upgrade; relocation cancellation refunds only once',()=>{
 const s=fixture(),b=room(s,'house',40,40),p=base.addDisciple(s,{name:'搬迁住客'});
 feet(s,p,spatialAccess(b));prepareFacilityActivity(s,p,b,'rest',0);const a=s.activitiesById[p.activityId],slot=spatialSlots(b,'rest').find(slot=>slot.id===a.slotId);feet(s,p,slot.position);a.phase='executing';
 const id=b.instanceId,before={x:p.mind.scenic.x,y:p.mind.scenic.y};handlers.upgrade(s,b.id);const job=s.activitiesById[s.master.activityId];feet(s,s.master,job.target);job.phase='working';tickSpatial(s);assert(Math.hypot(p.mind.scenic.x-before.x,p.mind.scenic.y-before.y)<=.130001);assert.equal(b.level,1);
 for(let n=0;s.master.activityId&&n<4000;n++){s.worldTick++;tickSpatial(s);}assert.equal(s.master.activityId,null);assert.equal(b.instanceId,id);assert.equal(b.level,2);assert.equal(spatialSlots(b,'rest').length,8);assert(!polygonContains(p.mind.scenic,spatialFootprint(b),.26));validateSpatial(s);
 const origin={...b.transform};handlers.relocate(s,b.id,62,40);const moving=s.activitiesById[s.master.activityId];feet(s,s.master,moving.target);moving.phase='working';for(let n=0;n<30;n++){s.worldTick++;tickSpatial(s);}assert.deepEqual(b.transform,origin);handlers.cancelConstruction(s);const resources=structuredClone(s.resources);handlers.cancelConstruction(s);assert.deepEqual(s.resources,resources);assert.deepEqual(b.transform,origin);assert.equal(b.instanceId,id);validateSpatial(s);
});

test('SR-XF-006 / SAVE-01: build, upgrade and relocation underway retain paid progress and finish with the adult prefab after loading',()=>{
 for(const operation of ['build','upgrade','relocate'])for(const phase of ['moving','working']){
  const s=fixture(),b=operation==='build'?null:room(s,'house');compact(s);const result=operation==='build'?handlers.build(s,'house',40,40):operation==='upgrade'?handlers.upgrade(s,b.id):handlers.relocate(s,b.id,62,40);
  if(phase==='working'){const a=s.activitiesById[s.master.activityId];feet(s,s.master,a.target);a.phase='working';for(let n=0;n<25;n++)S.tick(s,.1);}
  const original=JSON.stringify(s),facts=snapshotFacts(s),loaded=S.validateSave(s);assert.equal(JSON.stringify(s),original);assert.deepEqual(snapshotFacts(loaded),facts);assert.equal(loaded.activitiesById[loaded.master.activityId].phase,phase);assert.equal(viewSpatial(loaded).building.interiorLayoutVersion,INTERIOR_LAYOUT_VERSION);
  for(let n=0;loaded.workOrdersById[result.workOrderId]&&n<4000;n++)S.tick(loaded,.1);assert(!loaded.workOrdersById[result.workOrderId],`${operation}/${phase} completed`);
  const completed=loaded.buildingsById[`building:yunxiu:${result.id}`];assert.equal(completed.interiorLayoutVersion,INTERIOR_LAYOUT_VERSION);assertNear(dimensions(spatialPrefab(completed).furniture.find(f=>f.kind==='bed').polygon).height,2.2);assert.equal(loaded.buildings.filter(x=>x.instanceId===completed.instanceId).length,1);S.validateSave(loaded);
 }
});

test('SR-XF-010 / SAVE-01: pending pickup and carried cargo follow reachable stocks after furniture migration and deliver once',()=>{
 for(const phase of ['to-source','carrying']){
  const s=compact(fixture()),point=spatialSlots(s.buildings[0],'rest')[0].position,home=s.stockpilesById['stockpile:yunxiu'],id='stockpile:indoor-ground';home.capacity=100000;
  const ground={...structuredClone(home),id,position:{sceneId:'scene:yunxiu-courtyard',...point},resources:Object.fromEntries(Object.keys(home.resources).map(k=>[k,0]))};delete ground.buildingId;s.stockpilesById[id]=ground;
  const source=phase==='to-source'?ground:home,target=phase==='to-source'?home:ground;source.resources.wood+=10;feet(s,s.master,spatialAccess(s.buildings[0]));const {id:orderId}=startTransport(s,source.id,target.id,'person:master',{wood:3});if(phase==='carrying'){s.worldTick++;tickEconomy(s);}assert.equal(s.workOrdersById[orderId].phase,phase);
  const sourceSave=JSON.stringify(s),facts=snapshotFacts(s),initialTarget=target.resources.wood,loaded=S.validateSave(s);assert.equal(JSON.stringify(s),sourceSave);assert.deepEqual(snapshotFacts(loaded),facts);assert(meterCanStand(loaded,loaded.stockpilesById[id].position));
  const order=loaded.workOrdersById[orderId];for(let n=0;order.phase!=='delivered'&&n<2000;n++)S.tick(loaded,.1);assert.equal(order.phase,'delivered');assert.equal(loaded.stockpilesById[target.id].resources.wood,initialTarget+3);assert(!loaded.reservationsById[order.reservationId]);const saved=JSON.stringify(loaded);assert.equal(JSON.stringify(S.validateSave(JSON.parse(saved))),saved);for(let n=0;n<3;n++)S.tick(loaded,.1);assert.equal(loaded.stockpilesById[target.id].resources.wood,initialTarget+3);
 }
});

test('SR-XF-004 / SAVE-01: travelling and visiting people keep world positions and resume a safe courtyard return after furniture migration',()=>{
 for(const destinationPhase of ['travelling','visiting']){
  const s=compact(fixture()),hall=s.buildings[0],oldBed=spatialSlots(hall,'rest')[0];feet(s,s.master,oldBed.position);
  travelSR(s,'scene:valley',{cargo:{food:20,jade:20}});for(let n=0;n<(destinationPhase==='travelling'?20:80);n++)S.tick(s,.1);
  const before=JSON.stringify(s),facts=snapshotFacts(s),actualPosition=structuredClone(s.master.position),trips=structuredClone(s.travelsById),outside=Object.fromEntries(Object.entries(s.personsById).filter(([id,p])=>id!=='person:master'&&p.position?.sceneId!=='scene:yunxiu-courtyard').map(([id,p])=>[id,structuredClone(p)])),loaded=S.validateSave(s);
  assert.equal(JSON.stringify(s),before);assert.deepEqual(snapshotFacts(loaded),facts);assert.deepEqual(loaded.master.position,actualPosition);assert.deepEqual(loaded.travelsById,trips);for(const [id,p]of Object.entries(outside))assert.deepEqual(structuredClone(loaded.personsById[id]),p);
  assert(meterCanStand(loaded,loaded.master.scenic));assert(loaded.spatial.migrations.some(m=>m.entityId==='person:master'&&m.kind==='home-return-adult-furniture'));const saved=JSON.stringify(loaded);assert.equal(JSON.stringify(S.validateSave(JSON.parse(saved))),saved);
  srWorldCommand(loaded,destinationPhase==='travelling'?{action:'return'}:{action:'travel',destination:'scene:yunxiu-courtyard'});for(let n=0;loaded.srWorld.activeTravelId&&n<3000;n++)S.tick(loaded,.1);assert.equal(loaded.master.location.sceneId,'scene:yunxiu-courtyard');assert(meterCanStand(loaded,loaded.master.scenic));S.validateSave(loaded);
 }
});
