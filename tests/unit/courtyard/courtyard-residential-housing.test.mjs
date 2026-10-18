import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {hydrateState} from '../../../src/simulation/ea-state-v6.mjs';
import {facilitySlots} from '../../../src/simulation/ea-facility-slots.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {advanceScenic,syncScenicPosition} from '../../../src/simulation/ea-scenic.mjs';
import {buildingAccess,scenicFindPath,scenicDistance,scenicSweep,geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';
import {RESIDENTIAL_HOUSING_VERSION,validateResidentialHousing,ensureResidentialHousing,residentialHousingView,residentialAdmissionView,chooseResidentialBed,reserveResidentialBed,settleResidentialArrival,reconcileResidentialHousing} from '../../../src/simulation/ea-residential-housing.mjs';
const MASTER='person:master',LU='person:lu-zhiwei',LIN='person:lin-changfeng';
const copy=v=>JSON.parse(JSON.stringify(v));
// These are isolated housing-rule fixtures, with real metre rooms and navigation.
// Building/roster setup is deliberate test input; it is not preset construction,
// public admission, autonomy integration, or desktop normal-play evidence.
function fixture({houses=2,members=[]}={}){
 const s=SIM.initial({sr:true});s.story.opening.hallPhase='complete';s.homeMemberIds=[...members];
 for(const [i,[x,y]]of [[8,20],[42,36],[8,48],[60,52]].slice(0,houses).entries())addBuilding(s,'house',i+2,x,y);
 return s;
}
function addBuilding(s,type,id,x,y){
 const b={...s.buildingsById['building:yunxiu:1'],id,type,instanceId:`building:yunxiu:${id}`,x,y,transform:{x,y,orientation:'south'},prefabId:`prefab:${type}:units:v1`};
 s.buildingsById[b.instanceId]=b;s.spatial.geometryRevision++;return b;
}
const bed=(s,id,n=1,action='rest')=>facilitySlots(s,s.buildingsById[`building:yunxiu:${id}`],action)[n-1];
function addMember(s,n){
 const p=copy(s.personsById[LU]);p.personId=`person:housing-fixture:${n}`;p.id=100+n;p.name=`规则住户${n}`;p.activityId=null;
 // Absent bodies still retain real local positions for path planning, so their
 // fixture roster can exercise bed capacity without a crowd collision test.
 p.mind.scenic=null;s.personsById[p.personId]=p;s.homeMemberIds.push(p.personId);return p.personId;
}
function assertRoute(s,personId,slot){
 const from=s.personsById[personId].position,path=scenicFindPath(s,from,slot.position,{maxSnap:0});assert.notEqual(path,null);
 let last=from;for(const p of path){assert.equal(scenicSweep(s,last,p).blocked,false);last=p;}assert.ok(scenicDistance(last,slot.position)<.001);return path;
}
function bodyAtTarget(s,personId,slot,action='rest'){
 const p=s.personsById[personId],b=s.buildings.find(b=>b.id===slot.buildingId);releaseBodyActivity(s,p);assertRoute(s,personId,slot);
 const a={id:`activity:body:${personId}`,kind:'facility',personId,action,phase:'navigating',targetId:b.instanceId,slotId:slot.id,reservationId:`reservation:slot:${personId}`,startedTick:s.worldTick,reason:'规则夹具：按实体床的实际路径行走'};
 s.activitiesById[a.id]=a;s.reservationsById[a.reservationId]={id:a.reservationId,kind:'slot',personId,activityId:a.id,slotId:slot.id,createdTick:s.worldTick};p.activityId=a.id;
 const scenic=(personId===MASTER?p:p.mind).scenic;scenic.path=assertRoute(s,personId,slot);scenic.goal={...slot.position};scenic.revision=geometryRevision(s);scenic.activitySlotId=slot.id;
 return a;
}
function advanceBody(s,personId,{one=false}={}){
 const p=s.personsById[personId],a=s.activitiesById[p.activityId],scenic=(personId===MASTER?p:p.mind).scenic,slot=facilitySlots(s,s.buildingsById[a.targetId],a.action).find(slot=>slot.id===a.slotId);
 for(let i=0;i<(one?1:2000);i++){
  s.worldTick++;const before=copy(p.position);advanceScenic(scenic,4,s);syncScenicPosition(s,p);const after=p.position,done=scenicDistance(after,slot.position)<.04;if(done)a.phase='executing';
  assert.equal(scenicSweep(s,before,after).blocked,false);
  if(done)return true;if(one)return false;
 }
 assert.fail(`real body did not arrive: ${personId}: ${a.reason}`);
}
function roundtrip(s){const text=JSON.stringify(s),raw=JSON.parse(text);assert.equal(validateResidentialHousing(raw),true);assert.equal(JSON.stringify(raw),text);return hydrateState(raw);}
function record(s,id){return s.residentialHousing.recordsByPersonId[id];}

// Read-only compatibility and physical count are separate from runtime activation.
test('legacy reads leave ledger absent; four level-one houses expose sixteen physical beds and master is additional demand',()=>{
 const s=fixture({houses:4});addBuilding(s,'clinic',6,72,24);
 const raw=copy(s),text=JSON.stringify(raw);assert.equal(validateResidentialHousing(raw),true);
 for(let i=0;i<2;i++){
  const v=residentialHousingView(raw);assert.equal(v.enabled,false);assert.equal(v.counts.physical,20);assert.equal(v.counts.unassignedResidents,1);assert.equal(v.counts.freeForAdmission,0);
  assert.equal(v.beds.filter(b=>b.buildingId!=='building:yunxiu:1').length,16);assert.equal(v.beds.some(b=>b.buildingId==='building:yunxiu:6'),false);
  assert.equal(chooseResidentialBed(raw,MASTER).reasonCode,'not-enabled');assert.equal(residentialAdmissionView(raw,LU).reasonCode,'not-enabled');
 }
 assert.equal(JSON.stringify(raw),text);assert.equal(Object.hasOwn(raw,'residentialHousing'),false);
 const preview=hydrateState(copy(raw));ensureResidentialHousing(preview);const candidate=residentialAdmissionView(preview,LU).candidate;assert.ok(candidate);
 const command=hydrateState(copy(raw));ensureResidentialHousing(command);assert.deepEqual(residentialAdmissionView(command,LU).candidate,candidate);reserveResidentialBed(command,LU,candidate.slotId,{source:'admission'});command.homeMemberIds.push(LU);validateResidentialHousing(command);assert.equal(record(command,LU).home,null);assert.equal(JSON.stringify(raw),text);
 ensureResidentialHousing(s);assert.equal(record(s,MASTER).pending.buildingId,'building:yunxiu:1');assert.equal(residentialHousingView(s).counts.pending,1);
 assert.equal(residentialAdmissionView(s,LU).candidate.buildingId.startsWith('building:yunxiu:'),true);
 assert.notEqual(residentialAdmissionView(s,LU).candidate.buildingId,'building:yunxiu:1');
 const baseline=JSON.stringify(s);for(let i=0;i<2;i++){residentialHousingView(s,{buildingId:'building:yunxiu:2'});residentialAdmissionView(s,LU);chooseResidentialBed(s,MASTER);validateResidentialHousing(s);ensureResidentialHousing(s);}
 assert.equal(JSON.stringify(s),baseline);roundtrip(s);
});

test('compatibility observes actual heal-bed arrival and preserves an existing journey to bed without changing other facts',()=>{
 const s=fixture({members:[LU,LIN]});bodyAtTarget(s,LU,bed(s,1,2,'heal'),'heal');advanceBody(s,LU);
 bodyAtTarget(s,LIN,bed(s,2,1));advanceBody(s,LIN,{one:true});assert.equal(s.activitiesById[s.personsById[LIN].activityId].phase,'navigating');
 const original=copy(s);ensureResidentialHousing(s);
 assert.equal(record(s,LU).home.slotId,bed(s,1,2).id);assert.equal(record(s,LU).home.source,'legacy-observed');assert.equal(record(s,LU).home.atTick,s.worldTick);
 assert.equal(record(s,LIN).home,null);assert.equal(record(s,LIN).pending.slotId,bed(s,2,1).id);
 const after=copy(s);delete after.residentialHousing;assert.deepEqual(after,original);
 assert.equal(residentialHousingView(s).counts.occupied,1);assert.equal(residentialHousingView(s).counts.settled,1);roundtrip(s);
});

test('two admissions cannot reuse a final physical bed, including its heal alias; rejected writes preserve state',()=>{
 const s=fixture({houses:1});for(let n=0;n<6;n++)addMember(s,n);ensureResidentialHousing(s);
 const preview=residentialAdmissionView(s,LU);assert.equal(preview.available,true);assert.equal(residentialHousingView(s).counts.freeForAdmission,1);
 const oldFacts=copy(s.personsById[LU]),alias=preview.candidate.slotId.replace('/slot:bed:','/slot:bed-care:');
 reserveResidentialBed(s,LU,alias,{source:'admission'});s.homeMemberIds.push(LU);assert.deepEqual(s.personsById[LU],oldFacts);
 assert.equal(record(s,LU).pending.slotId,preview.candidate.slotId);assert.equal(residentialAdmissionView(s,LIN).available,false);
 const before=JSON.stringify(s);assert.throws(()=>reserveResidentialBed(s,LIN,preview.candidate.slotId,{source:'admission'}));assert.equal(JSON.stringify(s),before);
 s.worldTick++;const reservation=copy(record(s,LU));reserveResidentialBed(s,LU,alias,{source:'admission'});assert.deepEqual(record(s,LU),reservation);roundtrip(s);
});

test('a full nearby room chooses a reachable farther bed; body reservations exclude the same rest/heal bed',()=>{
 const s=fixture({houses:2,members:[LU]});ensureResidentialHousing(s);record(s,LU).pending=null;
 // Fill the hall and nearer house with stable accommodation claims.
 const occupied=residentialHousingView(s).beds.filter(b=>b.buildingId!=='building:yunxiu:2'&&b.slotId!==record(s,MASTER).pending.slotId);
 for(const [n,b]of occupied.entries()){
  const id=addMember(s,n);s.residentialHousing.recordsByPersonId[id]={personId:id,home:null,pending:{buildingId:b.buildingId,slotId:b.slotId,atTick:s.worldTick,source:'legacy-placement'},release:null};
 }
 const chosen=chooseResidentialBed(s,LU);assert.equal(chosen.buildingId,'building:yunxiu:2');assertRoute(s,LU,facilitySlots(s,s.buildingsById[chosen.buildingId],'rest').find(b=>b.id===chosen.slotId));
 const alias=facilitySlots(s,s.buildingsById[chosen.buildingId],'heal').find(b=>b.id.replace('/slot:bed-care:','/slot:bed:')===chosen.slotId);
 bodyAtTarget(s,LIN,alias,'heal');const next=chooseResidentialBed(s,LU);assert.notEqual(next.slotId,chosen.slotId);
 const before=JSON.stringify(s);assert.throws(()=>reserveResidentialBed(s,LU,chosen.slotId,{source:'autonomous-rest'}),e=>e.reasonCode==='occupied');assert.equal(JSON.stringify(s),before);
 assert.deepEqual(residentialHousingView(s,{buildingId:'building:yunxiu:2'}).counts,residentialHousingView(s).counts);
});

test('pending arrival survives save/load, requires body reservation and actual feet, then settles exactly once',()=>{
 let s=fixture({members:[LU]});ensureResidentialHousing(s);const target=record(s,LU).pending,slot=facilitySlots(s,s.buildingsById[target.buildingId],'rest').find(b=>b.id===target.slotId);
 bodyAtTarget(s,LU,slot);advanceBody(s,LU,{one:true});const a=s.activitiesById[s.personsById[LU].activityId];a.phase='executing';assert.equal(settleResidentialArrival(s,LU),false);a.phase='navigating';
 assert.equal(record(s,LU).home,null);const pending=copy(record(s,LU).pending);s=roundtrip(s);assert.deepEqual(record(s,LU).pending,pending);
 advanceBody(s,LU);const activity=s.activitiesById[s.personsById[LU].activityId],reservation=s.reservationsById[activity.reservationId];delete s.reservationsById[activity.reservationId];
 assert.equal(settleResidentialArrival(s,LU),false);s.reservationsById[activity.reservationId]=reservation;
 assert.equal(settleResidentialArrival(s,LU),true);assert.equal(record(s,LU).home.slotId,pending.slotId);assert.equal(record(s,LU).pending,null);
 const home=copy(record(s,LU).home);s.worldTick+=10;assert.equal(settleResidentialArrival(s,LU),false);assert.deepEqual(record(s,LU).home,home);roundtrip(s);
});

test('lost home remains claimed while a real relocation arrives; only then is the old bed released',()=>{
 let s=fixture({members:[LU]});ensureResidentialHousing(s);const pending=record(s,LU).pending;
 bodyAtTarget(s,LU,facilitySlots(s,s.buildingsById[pending.buildingId],'rest').find(b=>b.id===pending.slotId));advanceBody(s,LU);assert.equal(settleResidentialArrival(s,LU),true);
 const original=copy(record(s,LU).home),oldBuilding=s.buildingsById[original.buildingId];oldBuilding.enabled=false;
 assert.equal(residentialAdmissionView(s,LIN).reasonCode,'housing-shortage');reconcileResidentialHousing(s);assert.deepEqual(record(s,LU).home,original);
 const target=chooseResidentialBed(s,LU);assert.ok(target.slotId);assert.notEqual(target.buildingId,original.buildingId);
 reserveResidentialBed(s,LU,target.slotId,{source:'autonomous-rest'});assert.deepEqual(record(s,LU).home,original);assert.equal(residentialAdmissionView(s,LIN).reasonCode,'housing-shortage');
 s=roundtrip(s);const slot=facilitySlots(s,s.buildingsById[target.buildingId],'rest').find(b=>b.id===target.slotId);bodyAtTarget(s,LU,slot);advanceBody(s,LU);assert.equal(settleResidentialArrival(s,LU),true);
 assert.equal(record(s,LU).home.slotId,target.slotId);assert.equal(record(s,LU).pending,null);assert.equal(residentialHousingView(s).beds.find(b=>b.slotId===original.slotId).homePersonId,null);roundtrip(s);
});

test('construction, damage and blocked doors stop allocation; restoring the real route permits the same bed again',()=>{
 const s=fixture({houses:1});ensureResidentialHousing(s);const b=s.buildingsById['building:yunxiu:2'];
 for(const [field,value,reason]of [['enabled',false,'disabled'],['condition',0,'damaged'],['spatialLock','work:fixture','construction']]){
  const before=b[field];b[field]=value;const v=residentialHousingView(s,{buildingId:b.instanceId});assert.ok(v.beds.every(b=>!b.usable&&b.reasonCode===reason));if(before===undefined)delete b[field];else b[field]=before;
 }
 b.condition=1;assert.equal(residentialHousingView(s,{buildingId:b.instanceId}).beds.every(b=>b.usable),true);
 const existing=facilitySlots(s,b,'rest').map(slot=>slot.id);b.level=2;assert.equal(residentialHousingView(s,{buildingId:b.instanceId}).beds.length,8);assert.deepEqual(facilitySlots(s,b,'rest').slice(0,4).map(slot=>slot.id),existing);b.level=1;
 const promise=residentialAdmissionView(s,LU).candidate;reserveResidentialBed(s,LU,promise.slotId,{source:'admission'});s.homeMemberIds.push(LU);b.enabled=false;reconcileResidentialHousing(s);assert.notEqual(record(s,LU).pending.buildingId,b.instanceId);assert.equal(record(s,LU).home,null);assert.equal(residentialAdmissionView(s,LIN).available,true);b.enabled=true;
 const entry=buildingAccess(s,b);addBuilding(s,'well',10,entry.x-1,entry.y-1);assert.equal(residentialHousingView(s,{buildingId:b.instanceId}).beds.every(b=>b.reasonCode==='no-path'),true);
 delete s.buildingsById['building:yunxiu:10'];s.spatial.geometryRevision++;assert.equal(residentialHousingView(s,{buildingId:b.instanceId}).beds.every(b=>b.usable),true);
 s.story.opening.hallPhase='shelter';assert.equal(residentialHousingView(s,{buildingId:'building:yunxiu:1'}).beds.every(b=>b.reasonCode==='not-complete'),true);
});

test('away residents keep claims; confirmed departure and death release them without changing person identities',()=>{
 const s=fixture({members:[LU,LIN]});ensureResidentialHousing(s);const before=copy(record(s,LU));s.personsById[LU].mind.away={kind:'journey'};s.personsById[LU].position={kind:'travel',journeyId:'fixture:away'};
 reconcileResidentialHousing(s);assert.deepEqual(record(s,LU),before);assert.equal(chooseResidentialBed(s,LU).reasonCode,'person-unavailable');
 s.homeMemberIds=s.homeMemberIds.filter(id=>id!==LIN);s.worldTick++;reconcileResidentialHousing(s);assert.deepEqual(record(s,LIN).release,{atTick:s.worldTick,reason:'departed'});assert.equal(record(s,LIN).pending,null);
 s.personsById[LU].lifeStatus='dead';s.worldTick++;const persons=copy(s.personsById);reconcileResidentialHousing(s);assert.equal(record(s,LU).release.reason,'dead');assert.equal(record(s,LU).pending,null);assert.deepEqual(s.personsById,persons);
 const ledger=copy(s.residentialHousing);s.worldTick++;reconcileResidentialHousing(s);assert.deepEqual(s.residentialHousing,ledger);roundtrip(s);
});

test('legacy overcapacity and away residents retain identities; fifteen-member gate is independent of physical beds',()=>{
 const s=fixture({houses:0});for(let n=0;n<15;n++)addMember(s,n);s.personsById[s.homeMemberIds[0]].mind.away={kind:'journey'};
 const people=copy(s.personsById);ensureResidentialHousing(s);assert.equal(residentialHousingView(s).counts.physical,4);assert.equal(residentialHousingView(s).counts.pending,4);assert.equal(residentialHousingView(s).counts.unassignedResidents,12);assert.deepEqual(s.personsById,people);
 assert.equal(residentialAdmissionView(s,LU).reasonCode,'roster-full');assert.equal(record(s,s.homeMemberIds[0]).pending,null);
 const roomy=fixture({houses:4});for(let n=0;n<15;n++)addMember(roomy,n);ensureResidentialHousing(roomy);assert.equal(residentialHousingView(roomy).counts.pending,16);assert.equal(residentialHousingView(roomy).counts.usable,20);assert.equal(residentialAdmissionView(roomy,LU).reasonCode,'roster-full');
 const old=copy(s.residentialHousing);ensureResidentialHousing(s);assert.deepEqual(s.residentialHousing,old);roundtrip(s);
});

test('strict original-save validation rejects versions, aliases, duplicate claims, bad references and future time without repairs',()=>{
 const s=fixture({members:[LU]});ensureResidentialHousing(s);const mutations=[
  x=>{x.residentialHousing.version='future';},
  x=>{x.residentialHousing.extra=true;},
  x=>{x.residentialHousing.recordsByPersonId[LU].pending.slotId='missing';},
  x=>{x.residentialHousing.recordsByPersonId[LU].pending.slotId=x.residentialHousing.recordsByPersonId[LU].pending.slotId.replace('/slot:bed:','/slot:bed-care:');},
  x=>{x.residentialHousing.recordsByPersonId[LU].pending=copy(x.residentialHousing.recordsByPersonId[MASTER].pending);},
  x=>{x.residentialHousing.recordsByPersonId[LU].pending.atTick=x.worldTick+1;},
  x=>{x.residentialHousing.recordsByPersonId[LU].pending.buildingId='missing';},
  x=>{x.residentialHousing.recordsByPersonId[LU].personId='missing';},
  x=>{delete x.personsById[LU];},
  x=>{x.residentialHousing.recordsByPersonId[LU].pending.source='arrived';},
  x=>{x.residentialHousing.recordsByPersonId[LU].release={atTick:x.worldTick,reason:'departed'};},
  x=>{x.residentialHousing=null;},
 ];
 for(const mutate of mutations){const raw=copy(s);mutate(raw);const original=JSON.stringify(raw);assert.throws(()=>validateResidentialHousing(raw),/住宅存档校验失败/);assert.equal(JSON.stringify(raw),original);}
 const disabled=copy(s);disabled.buildingsById[record(s,LU).pending.buildingId].enabled=false;assert.equal(validateResidentialHousing(disabled),true);assert.equal(disabled.residentialHousing.version,RESIDENTIAL_HOUSING_VERSION);
});
