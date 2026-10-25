import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {createWorldPerson} from '../../../src/simulation/ea-sim.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {guestLodgingView,offerGuestLodging,advanceGuestLodging,validateGuestLodging} from '../../../src/simulation/ea-guest-lodging.mjs';
const copy=v=>JSON.parse(JSON.stringify(v));
const send=(s,name,...args)=>SIM.dispatchCommand(s,{name,args});
function until(s,f,max=4000){for(let i=0;i<max&&!f(s);i++)SIM.tick(s,.1);assert.ok(f(s),`condition reached at tick ${s.worldTick}`);}
function reload(s){const before=copy(s),next=SIM.validateSave(copy(s));assert.deepEqual(copy(next),before);assert.deepEqual(copy(s),before);return next;}
function visitor(){
 let s=SIM.validateSave(copy(seed.state));s=send(s,'build','lumber',26,16).state;until(s,x=>x.buildings.some(b=>b.type==='lumber'));
 s=send(s,'moveScenicMaster',27.5,14).state;until(s,x=>SIM.courtyardAdmissionView(x,'person:lin-changfeng').distance.near);
 s=send(s,'admitCourtyardVisitor',{personId:'person:lin-changfeng',rank:'outer',affiliationId:'scene:yunxiu-courtyard',mentorId:null}).state;
 s=send(s,'setCourtyardReception',{enabled:true}).state;until(s,x=>Object.keys(x.courtyardSeekers.recordsByPersonId).length>0);
 const id=Object.keys(s.courtyardSeekers.recordsByPersonId)[0];return {s,id};
}
test('old save guest projection is read only and empty accommodation roundtrips exactly',()=>{
 const s=SIM.validateSave(copy(seed.state)),before=copy(s);for(let i=0;i<3;i++){assert.equal(guestLodgingView(s).counts.physical,0);validateGuestLodging(s);}assert.deepEqual(copy(s),before);reload(s);
});
test('arriving ordinary caller cannot reserve a guest bed and rejection is atomic',()=>{
 const {s,id}=visitor(),before=copy(s);assert.equal(s.personsById[id].courtyardVisit.phase,'arriving');assert.equal(guestLodgingView(s,id).canOffer,false);assert.throws(()=>offerGuestLodging(s,id));assert.deepEqual(copy(s),before);reload(s);
});
// Finite rules fixture: commissioned two-bed room and willing visitor traits.
// This fixture does not establish normal fundraising or fixed-site construction.
function lodgingFixture(){
 let {s,id}=visitor();until(s,x=>x.personsById[id].courtyardVisit.phase==='present');
 s=send(s,'moveScenicMaster',29,26.285714285714285).state;until(s,x=>SIM.courtyardSeekerView(x,id).distance.near);
 const p=s.personsById[id];p.mind.traits[3]=85;p.mind.traits[0]=65;
 const n=s.nextId++,b={id:n,instanceId:`building:yunxiu:${n}`,type:'guesthouse',prefabId:'prefab:guesthouse:units:v1',level:1,condition:100,enabled:true,progress:0,x:34,y:24,transform:{x:34,y:24,orientation:'south'},buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1'};
 s.buildingsById[b.instanceId]=b;s.spatial.geometryRevision++;
 return {s,id,b};
}
test('finite fixture reserves two physical guest beds separately from member housing and medical beds',()=>{
 const {s,id}=lodgingFixture(),before=copy(s);assert.equal(guestLodgingView(s).counts.physical,2);assert.deepEqual(copy(s),before);
 const out=offerGuestLodging(s,id);assert.equal(out.accepted,true);assert.equal(guestLodgingView(s).counts.pending,1);assert.deepEqual(s.homeMemberIds,before.homeMemberIds);assert.deepEqual(copy(s.residentialHousing),before.residentialHousing);
 assert.equal(guestLodgingView(s).guests[0].assessment,undefined);assert.equal(guestLodgingView(s).stays[0].assessment,undefined);
 const stay=s.guestLodging.stays[0];assert.equal(stay.expiresTick,s.courtyardSeekers.recordsByPersonId[id].visits.at(-1).deadlineTick);assert.equal(stay.arrivedTick,null);assert.equal(stay.phase,'navigating');
 const raw=copy(s);assert.deepEqual(offerGuestLodging(s,id),out);assert.deepEqual(copy(s),raw);reload(s);
});
test('finite fixture rejects forged arrival stage and preserves exact walking continuation',()=>{
 let {s,id}=lodgingFixture();offerGuestLodging(s,id);const bad=copy(s);bad.guestLodging.stays[0].phase='staying';assert.throws(()=>validateGuestLodging(bad));
 const reference=reload(s);for(let i=0;i<10;i++){SIM.tick(s,.1);SIM.tick(reference,.1);}assert.deepEqual(copy(s),copy(reference));
 until(s,x=>x.guestLodging.stays[0].phase==='staying',1200);s=reload(s);const stay=s.guestLodging.stays[0],a=s.activitiesById[s.personsById[id].activityId];assert.equal(a.action,'guest-bed');assert.equal(a.slotId,stay.slotId);assert.notEqual(stay.arrivedTick,null);
});
test('finite fixture reaches original visit expiry, releases exactly once and walks down the road',()=>{
 let {s,id}=lodgingFixture();const deadline=s.courtyardSeekers.recordsByPersonId[id].visits.at(-1).deadlineTick;offerGuestLodging(s,id);
 until(s,x=>x.guestLodging.stays[0].phase==='staying',1200);s=reload(s);assert.equal(s.courtyardSeekers.recordsByPersonId[id].visits.at(-1).deadlineTick,deadline);
 until(s,x=>x.guestLodging.stays[0].phase==='released',1400);assert.equal(s.guestLodging.stays[0].releasedTick,deadline);assert.equal(s.guestLodging.stays[0].releaseReason,'visit-ended');assert.equal(guestLodgingView(s).counts.occupied,0);
 until(s,x=>x.personsById[id].courtyardVisit.phase==='departed',500);s=reload(s);assert.equal(s.guestLodging.stays.length,1);assert.equal(Object.values(s.factsById).filter(f=>f.kind==='guest-lodging'&&f.event==='released').length,1);
});
test('finite fixture disabled guesthouse releases body and rejected offers keep a durable answer',()=>{
 const {s,id,b}=lodgingFixture();s.personsById[id].mind.traits[3]=0;s.personsById[id].mind.traits[0]=0;
 assert.equal(offerGuestLodging(s,id).accepted,false);const before=copy(s);assert.equal(offerGuestLodging(s,id).accepted,false);assert.deepEqual(copy(s),before);reload(s);
 s.personsById[id].mind.traits[3]=85;s.personsById[id].mind.traits[0]=65;assert.equal(offerGuestLodging(s,id).accepted,true);b.enabled=false;SIM.tick(s,.1);
 assert.equal(s.guestLodging.stays[0].releaseReason,'facility-unavailable');assert.equal(s.activitiesById[s.personsById[id].activityId]?.action==='guest-bed',false);reload(s);
});
test('finite fixture rejects missing lodging ledger with durable lodging facts',()=>{
 const {s,id}=lodgingFixture();offerGuestLodging(s,id);delete s.guestLodging;assert.throws(()=>SIM.validateSave(copy(s)));
});
test('finite simultaneous caller fixture fills two exclusive beds and third offer is atomic',()=>{
 const {s,id}=lodgingFixture();
 // Additional finite callers exercise capacity only, independently of normal opportunity timing.
 const add=()=>{const p=createWorldPerson(s),source=s.personsById[id],record=copy(s.courtyardSeekers.recordsByPersonId[id]);p.position=copy(source.position);p.courtyardVisit=copy(source.courtyardVisit);p.mind.scenic=copy(source.mind.scenic);p.mind.traits=copy(source.mind.traits);p.mind.relationships=copy(source.mind.relationships);p.mind.activity='rest';record.personId=p.personId;s.courtyardSeekers.recordsByPersonId[p.personId]=record;return p.personId;};
 const second=add(),third=add();assert.equal(offerGuestLodging(s,id).accepted,true);assert.equal(offerGuestLodging(s,second).accepted,true);assert.equal(guestLodgingView(s).counts.free,0);assert.equal(new Set(s.guestLodging.stays.map(x=>x.slotId)).size,2);
 const before=copy(s);assert.throws(()=>offerGuestLodging(s,third),/客床/);assert.deepEqual(copy(s),before);
});

test('finite lifecycle fixture releases guest reservation on membership and death',()=>{
 for(const reason of ['admitted','death']){const {s,id}=lodgingFixture();offerGuestLodging(s,id);const old=s.personsById[id].activityId;
  if(reason==='admitted')s.homeMemberIds.push(id);else s.personsById[id].lifeStatus='dead';
  advanceGuestLodging(s);assert.equal(s.guestLodging.stays[0].releaseReason,reason);assert.equal(s.activitiesById[old],undefined);assert.equal(guestLodgingView(s).counts.occupied,0);
 }
});
test('finite fixture offers a read-only reachable conversation point beside an occupied guest bed',()=>{
 let {s,id}=lodgingFixture();offerGuestLodging(s,id);until(s,x=>x.guestLodging.stays[0].phase==='staying',1200);
 // Finite near-room reception placement isolates conversation access from unfinished domain art.
 const master=s.personsById['person:master'];releaseBodyActivity(s,master);Object.assign(master.scenic,{x:37,y:28.5,path:[],goal:null});Object.assign(master.position,{x:37,y:28.5});
 const before=copy(s),view=guestLodgingView(s,id),point=view.conversationPoint,p=s.personsById[id].position;assert(point);assert(Math.hypot(point.x-p.x,point.y-p.y)>=.8);assert(Math.hypot(point.x-p.x,point.y-p.y)<=1.2);assert.deepEqual(copy(s),before);
 s=send(s,'moveScenicMaster',point.x,point.y).state;until(s,x=>SIM.courtyardSeekerView(x,id).distance.near,600);assert.equal(SIM.courtyardSeekerView(s,id).canTalk,true);
});
