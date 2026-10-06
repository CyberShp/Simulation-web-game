import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../dist/ea-opening-sim.mjs';
import * as legacy from '../dist/ea-sim.mjs';
import {HALL_INTERIOR,indoorBuildingAt,indoorRoofOpen} from '../dist/ea-hall-interior.mjs';
import {facilitySlots,facilitySlotView} from '../dist/ea-facility-slots.mjs';
import {prepareFacilityActivity,releaseBodyActivity,validateFacilityActivities} from '../dist/ea-facility-activities.mjs';
import {scenicFindPath,scenicSweep,scenicCanStand,buildingAccess} from '../dist/ea-scene-geometry.mjs';
import {personHitCandidates} from '../dist/ea-scene-picking.mjs';
const act=(s,name,...args)=>sim.dispatchCommand(s,{name,args}).state;
const saved=s=>sim.validateSave(JSON.parse(JSON.stringify(s)));
function restFixture(count=4){const s=sim.initial();s.master.wound=0;for(let i=0;i<count;i++){const p=legacy.addDisciple(s);p.mind.activity='rest';p.energy=10;p.mind.commitUntil=1000;p.mind.satiety=100;}return s;}

test('hall door is the only exterior access; furniture, walls and closed corners cannot be crossed',()=>{
 const s=sim.initial(),b=s.buildings[0],entry=buildingAccess(s,b);
 assert.equal(scenicCanStand(s,{x:726,y:110}),false);assert.equal(scenicCanStand(s,{x:696,y:145}),false);
 assert.equal(scenicSweep(s,entry,{x:770,y:172}).blocked,true);
 for(const action of ['rest','heal','study','teach','cultivate'])for(const slot of facilitySlots(s,b,action)){
  const path=scenicFindPath(s,entry,slot.position,{maxSnap:1});assert.ok(path,slot.id);assert.deepEqual(path.at(-1),slot.position);
  let p=entry;for(const to of path){assert.equal(scenicSweep(s,p,to).blocked,false);p=to;}
  assert.ok(path.some(p=>p.x===840&&p.y<204),'route uses the actual doorway');
 }
 const historical=legacy.initial();assert.equal(scenicCanStand(historical,{x:840,y:172}),false);
});

test('healing consumes one preparation, walks through the door, then gains relief only at the bed',()=>{
 let s=act(sim.initial(),'masterAction','heal');const herb=s.resources.herb,wound=s.master.wound;
 sim.tick(s,1);assert.equal(s.master.wound,wound);assert.equal(s.activitiesById[s.master.activityId].phase,'navigating');assert.ok(s.master.scenic.path.length);
 s=act(s,'masterAction','heal');assert.equal(s.resources.herb,herb);
 for(let n=0;n<100&&s.master.wound===wound;n++)sim.tick(s,1);
 assert.ok(s.master.wound<wound);assert.equal(s.activitiesById[s.master.activityId].phase,'executing');assert.equal(indoorBuildingAt(s,s.master.scenic).id,s.buildings[0].id);
});

test('rest and healing compete for the same physical beds; a later patient cannot overlap a sleeper',()=>{
 const s=restFixture(),hall=s.buildings[0];for(const p of s.disciples)prepareFacilityActivity(s,p,hall,'rest',0);
 s.master.action='heal';prepareFacilityActivity(s,s.master,hall,'heal',0);
 assert.equal(s.activitiesById[s.master.activityId].slotId,null);assert.equal(s.activitiesById[s.master.activityId].phase,'waiting');
 const rows=facilitySlotView(s,hall).filter(x=>x.kind==='rest');assert.equal(rows.length,4);assert.ok(rows.every(x=>x.personId));
 releaseBodyActivity(s,s.disciples[0]);prepareFacilityActivity(s,s.master,hall,'heal',0);
 assert.ok(s.activitiesById[s.master.activityId].slotId);assert.equal(facilitySlotView(s,hall).filter(x=>x.kind==='rest')[0].personId,'person:master');saved(s);
});

test('a full bed pool offers slower temporary rest; movement never receives the bed recovery rate',()=>{
 const s=restFixture();for(const p of s.disciples)prepareFacilityActivity(s,p,s.buildings[0],'rest',0);
 s.master.energy=10;s.master.action='rest';sim.tick(s,1);assert.ok(Math.abs(s.master.energy-10.3)<1e-9);
 releaseBodyActivity(s,s.disciples[0]);const before=s.master.energy;sim.tick(s,1);assert.ok(s.master.energy<=before+.3);
 for(let n=0;n<100&&s.activitiesById[s.master.activityId]?.phase!=='executing';n++)sim.tick(s,1);
 assert.equal(s.activitiesById[s.master.activityId].phase,'executing');const atBed=s.master.energy;sim.tick(s,1);assert.ok(s.master.energy-atBed>=1.29);
});

test('indoor action and route are deterministic across save/reload and a paused world',()=>{
 let s=act(sim.initial(),'masterAction','heal');sim.tick(s,2.3);const copy=saved(s);
 sim.tick(s,7.7);for(let n=0;n<77;n++)sim.tick(copy,.1);assert.deepEqual(s,copy);
 const paused=act(saved(s),'setSpeed',0),raw=JSON.stringify(paused);sim.tick(paused,1000);assert.equal(JSON.stringify(paused),raw);
 s=saved(s);for(let n=0;n<100&&s.master.wound;n++)sim.tick(s,1);saved(s);
});

test('old exterior hall study reservations migrate to navigation without changing learning, stock or time',()=>{
 const s=sim.initial();s.rulesetVersion='opening-runtime-2';s.master.wound=0;
 const p=buildingAccess(s,s.buildings[0]);s.master.scenic={...p,path:[],steps:0,facing:1,back:false,geometry:'plots-v1',revision:null};
 legacy.masterStudy(s,'qingyuan');for(let n=0;n<20&&!prepareFacilityActivity(s,s.master,s.buildings[0],'study');n++);
 const raw=JSON.parse(JSON.stringify(s)),source=JSON.stringify(raw),before={time:s.worldTick,stock:structuredClone(s.stockpilesById),learning:structuredClone(s.master.learning),seed:s.rngState,slot:s.activitiesById[s.master.activityId].slotId};
 const loaded=sim.validateSave(raw);assert.equal(JSON.stringify(raw),source);assert.equal(loaded.rulesetVersion,'opening-runtime-3');assert.deepEqual(loaded.master.learning,before.learning);assert.deepEqual(loaded.stockpilesById,before.stock);assert.equal(loaded.worldTick,before.time);assert.equal(loaded.rngState,before.seed);assert.equal(loaded.activitiesById[loaded.master.activityId].slotId,before.slot);assert.equal(loaded.activitiesById[loaded.master.activityId].phase,'navigating');
 saved(loaded);sim.tick(loaded,20);saved(loaded);
});

test('an old hall applicant without a reservation remains waiting after indoor migration',()=>{
 const s=sim.initial();s.rulesetVersion='opening-runtime-2';s.master.wound=0;
 legacy.masterStudy(s,'qingyuan');prepareFacilityActivity(s,s.master,s.buildings[0],'study',0);
 const a=s.activitiesById[s.master.activityId];delete s.reservationsById[a.reservationId];a.slotId=null;a.reservationId=null;a.phase='waiting';
 validateFacilityActivities(s);const raw=JSON.parse(JSON.stringify(s)),source=JSON.stringify(raw),loaded=sim.validateSave(raw);
 assert.equal(JSON.stringify(raw),source);assert.equal(loaded.rulesetVersion,'opening-runtime-3');assert.equal(loaded.activitiesById[a.id].phase,'waiting');assert.equal(loaded.activitiesById[a.id].slotId,null);
 saved(loaded);sim.tick(loaded,20);assert.equal(loaded.activitiesById[a.id].phase,'executing');saved(loaded);
});

test('roof reveal and person hit candidates are pure projections of the same indoor person',()=>{
 let s=act(sim.initial(),'masterAction','heal');sim.tick(s,10);const hall=s.buildings[0],p=s.master.scenic,raw=JSON.stringify(s);
 assert.equal(indoorRoofOpen(s,hall,{actors:[p]}),true);assert.equal(indoorRoofOpen(s,hall,{actors:[buildingAccess(s,hall)]}),false);
 assert.equal(indoorRoofOpen(s,hall,{selection:{kind:'building',id:hall.id}}),true);
 const hit=personHitCandidates({x:p.x,y:p.y-20},[{...p,id:'master'}],{scale:.5,height:58});assert.equal(hit[0].id,'master');assert.equal(JSON.stringify(s),raw);
});

test('a forged executing bed away from its physical station is rejected without altering the save',()=>{
 let s=act(sim.initial(),'masterAction','heal');sim.tick(s,10);const raw=JSON.parse(JSON.stringify(s));raw.personsById['person:master'].scenic.x+=20;const original=JSON.stringify(raw);assert.throws(()=>sim.validateSave(raw));assert.equal(JSON.stringify(raw),original);
});
