import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {facilitySlots} from '../../../src/simulation/ea-facility-slots.mjs';
import {makeWorldPerson} from '../../../src/simulation/ea-sr-world.mjs';
import {scenicDistance,scenicSweep} from '../../../src/simulation/ea-scene-geometry.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';

const MASTER='person:master',LU='person:lu-zhiwei',LIN='person:lin-changfeng';
const copy=value=>JSON.parse(JSON.stringify(value));
const send=(s,name,...args)=>SIM.dispatchCommand(s,{name,args}).state;
const housing=(s,id)=>s.residentialHousing?.recordsByPersonId[id];
const payload={personId:LIN,rank:'outer',affiliationId:'scene:yunxiu-courtyard',mentorId:null};
function until(s,predicate,limit=1200){for(let i=0;i<limit&&!predicate(s);i++)SIM.tick(s,.1);assert.ok(predicate(s),'public world steps reach the requested state');}
function roundtrip(s){const before=copy(s),restored=SIM.validateSave(before);assert.deepEqual(copy(restored),before);return restored;}
function atBed(s,id){
 const p=s.personsById[id],a=s.activitiesById[p.activityId],home=housing(s,id).home;
 const slot=facilitySlots(s,s.buildingsById[home.buildingId],a.action).find(slot=>slot.id===a.slotId);
 assert.equal(a.phase,'executing');assert.ok(scenicDistance(p.position,slot.position)<.04);assert.ok(scenicDistance((id===MASTER?p:p.mind).scenic,slot.position)<.04);
 assert.equal(scenicSweep(s,p.position,slot.position).blocked,false);assert.equal(s.reservationsById[a.reservationId].personId,id);
}
// Public shared-simulation commands start from the unchanged desktop seed.
// The lumber plot follows the existing admission fixture, not the GC preset
// desktop construction acceptance. Explicit resource/body boundaries below are
// labeled independently and never described as normal-play finance or travel.
function prepareAdmission(){
 let s=send(SIM.validateSave(seed.state),'build','lumber',26,16);
 until(s,x=>x.buildings.some(b=>b.type==='lumber'));
 s=send(s,'moveScenicMaster',27.5,14);until(s,x=>SIM.courtyardAdmissionView(x,LIN).distance.near);return s;
}

test('old saves and paused reads keep housing absent; the first real step assigns residents and natural travel survives reload',()=>{
 let s=SIM.validateSave(seed.state);const original=copy(s),raw=JSON.stringify(s);
 for(const id of [MASTER,LU,'person:merchant-qingxi'])assert.equal(SIM.courtyardAdmissionView(s,id).housing,null);
 const preview=SIM.residentialProjectionState(s);assert.ok(preview!==s);assert.equal(SIM.residentialHousingView(preview).counts.pending,2);
 assert.deepEqual(SIM.courtyardAdmissionView(s,LIN,{preparedHousingState:preview}).housing,SIM.courtyardAdmissionView(s,LIN).housing);
 assert.equal(JSON.stringify(s),raw);assert.equal(roundtrip(s).residentialHousing,undefined);
 s=send(s,'setSpeed',0);const paused=copy(s);SIM.tick(s,5);assert.deepEqual(copy(s),paused);assert.equal(s.residentialHousing,undefined);
 s=send(s,'setSpeed',1);SIM.tick(s,.1);assert.deepEqual(Object.keys(s.residentialHousing.recordsByPersonId).sort(),[MASTER,LU].sort());
 assert.equal(housing(s,LU).home,null);assert.deepEqual(s.homeMemberIds,original.homeMemberIds);assert.deepEqual(s.personsById[LU].appearance,original.personsById[LU].appearance);
 until(s,x=>x.activitiesById[x.personsById[LU].activityId]?.phase==='navigating'&&x.activitiesById[x.personsById[LU].activityId]?.action==='rest');
 const pending=copy(housing(s,LU).pending);s=roundtrip(s);assert.deepEqual(housing(s,LU).pending,pending);
 until(s,x=>housing(x,LU).home!==null);atBed(s,LU);assert.equal(housing(s,LU).pending,null);roundtrip(s);
});

test('formal visitor admission reserves one actual bed and exact receipt replay preserves identity, path and resources',()=>{
 const source=prepareAdmission(),before=copy(source),candidate=SIM.courtyardAdmissionView(source,LIN).housing.candidate;
 const command={name:'admitCourtyardVisitor',args:[payload],id:`command:${source.transactions.nextCommandId}`,expectedRevision:source.revision};
 const outcome=SIM.dispatchCommand(source,command);let s=outcome.state;
 assert.equal(housing(s,LIN).home,null);assert.equal(housing(s,LIN).pending.slotId,candidate.slotId);assert.equal(housing(s,LIN).pending.source,'admission');
 assert.deepEqual(s.personsById[LIN].appearance,before.personsById[LIN].appearance);assert.deepEqual(s.personsById[LIN].position,before.personsById[LIN].position);
 assert.deepEqual(s.resources,before.stockpilesById['stockpile:yunxiu'].resources);assert.equal(s.rngState,before.rngState);assert.equal(s.worldTick,before.worldTick);
 s=roundtrip(s);const saved=copy(s),replay=SIM.dispatchCommand(s,command);assert.equal(replay.replayed,true);assert.deepEqual(copy(replay.state),saved);
 assert.equal(SIM.courtyardAdmissionView(s,LIN).housing,null,'member display uses the shared housing view');
 until(s,x=>housing(x,LIN).home!==null,2500);atBed(s,LIN);roundtrip(s);
});

test('damaged shelter boundary blocks admission and construction preserves existing accommodation',()=>{
 // Damage fixture: the hall cannot be disabled through the public toggle.
 const s=prepareAdmission();s.buildingsById['building:yunxiu:1'].condition=0;
 assert.equal(SIM.courtyardAdmissionView(s,LIN).housing.reasonCode,'housing-shortage');const before=copy(s);
 assert.throws(()=>send(s,'admitCourtyardVisitor',payload),/居所|安置/);assert.deepEqual(copy(s),before);
 const old=SIM.validateSave(seed.state),unmodified=copy(old);
 assert.throws(()=>send(old,'upgrade',1),/入住承诺|住处/);assert.deepEqual(copy(old),unmodified);assert.equal(old.residentialHousing,undefined);
});

test('legacy recruitment uses physical beds including master; refusal rolls back fees and world NPC factories leave beds untouched',()=>{
 // Resource fixture isolates the pre-existing recruit command from finance.
 let s=SIM.validateSave(seed.state);Object.assign(s.resources,{jade:500,herb:100,food:100});
 s=send(s,'recruit');s=send(s,'recruit');assert.equal(s.homeMemberIds.length,3);
 assert.equal(SIM.residentialHousingView(s).counts.pending,4);const full=copy(s);
 assert.throws(()=>send(s,'recruit'),/空床/);assert.deepEqual(copy(s),full,'failed generation includes RNG, fees and person ids');
 s=roundtrip(s);const ledger=copy(s.residentialHousing),members=[...s.homeMemberIds];
 const visitor=makeWorldPerson(s,'person:housing-world-fixture','来访规则夹具','scene:market',6,SIM.addDisciple);
 assert.equal(visitor.position.sceneId,'scene:market');assert.deepEqual(s.homeMemberIds,members);assert.deepEqual(s.residentialHousing,ledger);
 assert.equal(housing(s,visitor.personId),undefined);
 // World factories receive ordinary appearance/schedule initialization on the
 // existing runtime normalization path; accommodation stays unchanged.
 const initialized=SIM.validateSave(copy(s));assert.deepEqual(initialized.residentialHousing,ledger);assert.deepEqual(initialized.homeMemberIds,members);roundtrip(initialized);
});

test('public save validation rejects housing corruption before normalization and keeps original bytes',()=>{
 const s=SIM.validateSave(seed.state);SIM.tick(s,.1);
 for(const mutate of [x=>{x.residentialHousing.version='future';},x=>{housing(x,LU).pending=copy(housing(x,MASTER).pending);},x=>{housing(x,LU).pending.atTick=x.worldTick+1;},x=>{x.residentialHousing.extra=1;}]){
  const raw=copy(s);mutate(raw);const text=JSON.stringify(raw);assert.throws(()=>SIM.validateSave(raw),/住宅|residentialHousing|版本/);assert.equal(JSON.stringify(raw),text);
 }
});

test('master chooses an exact reachable bed; relocation keeps the old home until real arrival and then permits its upgrade',()=>{
 // One-resident and resource fixture isolates the relocation/upgrade contract.
 // Both buildings, all travel and the upgrade use ordinary public commands.
 let s=SIM.validateSave(seed.state);s.homeMemberIds=[];s.story.opening.invitation='declined';Object.assign(s.resources,{jade:500,wood:500,stone:500});
 s=send(s,'build','house',20,60);until(s,x=>x.buildings.some(b=>b.type==='house'));
 const house=s.buildings.find(b=>b.type==='house'),slot=facilitySlots(s,house,'rest')[0];
 s=send(s,'masterAction','rest');until(s,x=>!!housing(x,MASTER)?.home);atBed(s,MASTER);
 const original=copy(housing(s,MASTER).home),before=copy(s),target={buildingId:house.instanceId,slotId:slot.id};
 assert.equal(SIM.residentialRestView(s,MASTER,slot.id).available,true);assert.equal(SIM.residentialRestView(s,LU,slot.id).available,false);
 for(const options of [{...target,buildingId:original.buildingId},{...target,slotId:slot.id.replace('/slot:bed:','/slot:bed-care:')},{...target,extra:true},null]){
  assert.throws(()=>send(s,'masterAction','rest',options),/休息|空床/);assert.deepEqual(copy(s),before);
 }
 s=send(s,'masterAction','rest',target);assert.deepEqual(housing(s,MASTER).home,original);assert.equal(housing(s,MASTER).pending.slotId,slot.id);
 assert.equal(SIM.residentialBuildingChangeView(s,original.buildingId,{operation:'upgrade'}).available,false);
 s=send(s,'masterAction','rest',{buildingId:original.buildingId,slotId:original.slotId});assert.equal(housing(s,MASTER).pending,null);assert.deepEqual(housing(s,MASTER).home,original);
 s=send(s,'masterAction','rest',target);assert.equal(housing(s,MASTER).pending.slotId,slot.id);
 SIM.tick(s,.1);s=roundtrip(s);assert.deepEqual(housing(s,MASTER).home,original);
 for(let i=0;i<1500&&housing(s,MASTER).home.slotId!==slot.id;i++){
  SIM.tick(s,.1);if(housing(s,MASTER).home.slotId!==slot.id)assert.deepEqual(housing(s,MASTER).home,original);
 }
 assert.equal(housing(s,MASTER).home.slotId,slot.id);assert.equal(housing(s,MASTER).pending,null);atBed(s,MASTER);
 assert.equal(SIM.residentialBuildingChangeView(s,original.buildingId,{operation:'upgrade'}).available,true);
 s=roundtrip(s);s=send(s,'upgrade',1);assert.ok(s.buildingsById[original.buildingId].spatialLock);assert.equal(housing(s,MASTER).home.slotId,slot.id);
});

test('new mountain opening keeps temporary healing available and promises the first home only after the hall is complete',()=>{
 let s=SIM.initial({sr:true,mountainOpening:true});s=send(s,'masterAction','heal');s=send(s,'chooseOpeningInheritance','qinglan');
 until(s,x=>x.master.wound===0);assert.equal(s.story.opening.hallPhase,'shelter');
 assert.equal(housing(s,MASTER).home,null);assert.equal(housing(s,MASTER).pending,null);assert.equal(SIM.residentialHousingView(s).counts.usable,0);
 s=roundtrip(s);s=send(s,'advanceStory');s=send(s,'establishHall');until(s,x=>x.story.opening.hallPhase==='complete');
 assert.equal(housing(s,MASTER).home,null);assert.ok(housing(s,MASTER).pending);assert.equal(SIM.residentialHousingView(s).counts.usable,4);roundtrip(s);
});
