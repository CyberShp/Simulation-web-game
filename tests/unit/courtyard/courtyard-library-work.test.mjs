import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {personLifeSummary} from '../../../src/simulation/ea-life.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {familyNotesView} from '../../../src/simulation/ea-sr-cultivation.mjs';
import {releaseSRBody} from '../../../src/simulation/ea-sr-equipment.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';
import {prepareFacilityActivity} from '../../../src/simulation/ea-facility-activities.mjs';
const MASTER='person:master',LU='person:lu-zhiwei';
let fixture;
function send(s,name,...args){const r=SIM.dispatchCommand(s,{name,args});return {s:r.state,result:r.result};}
function until(s,condition,limit=3000){for(let i=0;i<limit&&!condition(s);i++)SIM.tick(s,.1);assert(condition(s));}
function roundtrip(s){const raw=JSON.stringify(s),r=SIM.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(r),raw);return r;}
function prepared(){
 if(!fixture){
  let s=createSectSession().state;
  // Finite rule fixture for library operations; not a normal funding or story run.
  s.resources.jade=100;s.resources.wood=80;s.story.step=3;
  const r=send(s,'build','library',44,40);s=r.s;
  until(s,x=>!x.workOrdersById[r.result.workOrderId]);
  fixture=JSON.stringify(roundtrip(s));
 }
 const s=SIM.validateSave(JSON.parse(fixture)),b=s.buildings.find(b=>b.type==='library');
 return {s,b};
}
test('family notes use the selected library desk, accrue actual time, restore exactly and settle once',()=>{
 let {s,b}=prepared();const originalBooks=[...s.doctrine.books],food=s.resources.food;
 const r=send(s,'collateFamilyNotes',b.instanceId);s=r.s;const id=r.result.orderId;
 assert.equal(s.resources.food,food-2);assert.deepEqual(s.doctrine.books,originalBooks);assert.equal(s.srCultivation.orders[id].progressTicks,0);
 SIM.tick(s,.1);assert.equal(s.srCultivation.orders[id].progressTicks,0,'travel does not count as reading');
 until(s,x=>x.srCultivation.orders[id].progressTicks>=20);
 const o=s.srCultivation.orders[id],a=s.activitiesById[s.master.activityId],slot=slotById(s,a.slotId);
 assert.equal(o.workstationId,b.instanceId);assert.equal(slot.buildingId,b.id);assert(Math.hypot(s.master.position.x-slot.position.x,s.master.position.y-slot.position.y)<.04);
 assert.equal(personLifeSummary(s,s.master).progress.label,'整理家传');
 s=roundtrip(s);until(s,x=>x.srCultivation.orders[id].phase==='completed');
 assert.equal(s.story.step,4);assert(s.doctrine.books.includes('spring'));assert(s.doctrine.books.includes('foundation'));assert.equal(s.master.artsById.spring?.understanding||0,0);
 assert(s.factsById['fact:revenge:family-notes']);const completed=JSON.stringify(s.doctrine.books);for(let i=0;i<20;i++)SIM.tick(s,.1);assert.equal(JSON.stringify(s.doctrine.books),completed);roundtrip(s);
 const before=JSON.stringify(s);assert.throws(()=>send(s,'collateFamilyNotes',b.instanceId),/已整理/);assert.equal(JSON.stringify(s),before);
});
test('collation cancellation returns only an unconsumed reservation and leaves knowledge intact',()=>{
 for(const started of [false,true]){
  let {s,b}=prepared();const food=s.resources.food,books=[...s.doctrine.books];let r=send(s,'collateFamilyNotes',b.instanceId);s=r.s;const id=r.result.orderId;
  if(started)until(s,x=>x.srCultivation.orders[id].progressTicks>=1);
  r=send(s,'cancelCultivationOrder',id);s=r.s;assert.equal(r.result.refunded,!started);assert.equal(s.resources.food,food-(started?2:0));assert.deepEqual(s.doctrine.books,books);assert.equal(s.story.step,3);roundtrip(s);
 }
});
test('unavailable story, library, body or food reject atomically and views stay read only',()=>{
 for(const change of [s=>s.story.step=2,s=>s.buildings.find(b=>b.type==='library').enabled=false,s=>s.master.wound=1,s=>s.master.energy=19,s=>s.resources.food=1]){
  const {s,b}=prepared();change(s);const before=JSON.stringify(s);assert.equal(familyNotesView(s,b.instanceId).available,false);assert.throws(()=>send(s,'collateFamilyNotes',b.instanceId));assert.equal(JSON.stringify(s),before);
 }
 const {s,b}=prepared(),before=JSON.stringify(s);for(let i=0;i<3;i++)assert.equal(familyNotesView(s,b.instanceId).available,true);assert.equal(JSON.stringify(s),before);
});
test('bound study completes at the selected library and pauses while it is unavailable',()=>{
 let {s,b}=prepared();const before=s.master.artsById.qingwind.understanding;
 const r=send(s,'masterStudy','qingwind',{buildingId:b.instanceId});s=r.s;const id=r.result.orderId;
 until(s,x=>x.srCultivation.orders[id].progressTicks>=10);s.buildingsById[b.instanceId].enabled=false;
 const progress=s.srCultivation.orders[id].progressTicks;for(let i=0;i<30;i++)SIM.tick(s,.1);assert.equal(s.srCultivation.orders[id].progressTicks,progress);s=roundtrip(s);
 s.buildingsById[b.instanceId].enabled=true;until(s,x=>x.srCultivation.orders[id].phase==='completed');assert.equal(s.master.artsById.qingwind.understanding,Math.min(100,before+12));assert.equal(s.srCultivation.orders[id].workstationId,b.instanceId);roundtrip(s);
});
test('bound lessons require willing student and teacher at separate desks of one library',()=>{
 let {s,b}=prepared();const student=s.personsById[LU];releaseSRBody(s,student);
 // Skill/trust fixture isolates the existing teaching qualification, not normal progression.
 Object.assign(s.master.artsById.qingwind,{understanding:80,mastery:60});s.master.knowledge.qingwind=80;
 student.artsById.qingwind={artId:'qingwind',access:true,understanding:0,mastery:0,source:'fixture',chapter:'qi'};student.mind.knowledge.qingwind=0;student.mind.relationships.master.trust=80;
 let r=send(s,'masterTeach','qingwind',LU,{buildingId:b.instanceId});s=r.s;assert.equal(r.result.accepted,true);const id=r.result.orderId;
 until(s,x=>x.srCultivation.orders[id].progressTicks>=10);const teacherActivity=s.activitiesById[s.master.activityId],studentActivity=s.activitiesById[s.personsById[LU].activityId];
 assert.notEqual(teacherActivity.slotId,studentActivity.slotId);assert.equal(slotById(s,teacherActivity.slotId).buildingId,b.id);assert.equal(slotById(s,studentActivity.slotId).buildingId,b.id);
 assert.equal(personLifeSummary(s,s.master).activity,'teach');assert.equal(personLifeSummary(s,s.personsById[LU]).activity,'study');
 assert.equal(studentActivity.phase,'executing');assert.equal(personLifeSummary(s,s.personsById[LU]).status,'active');assert.match(personLifeSummary(s,s.personsById[LU]).reason,/阅卷席参加讲习/);
 s.personsById[LU].wound=1;const progress=s.srCultivation.orders[id].progressTicks;for(let i=0;i<5;i++)SIM.tick(s,.1);
 assert.equal(s.srCultivation.orders[id].progressTicks,progress);assert.equal(s.srCultivation.orders[id].phase,'blocked');s.personsById[LU].wound=0;
 s=roundtrip(s);until(s,x=>x.srCultivation.orders[id].phase==='completed');assert.equal(s.personsById[LU].artsById.qingwind.understanding,12);roundtrip(s);
});
test('desktop library actions expose their real reservation and preserve state on inspection and cancellation',()=>{
 const {s,b}=prepared();let run=createSectSession();run.state=s;
 const before=JSON.stringify(snapshotSect(run));let library=viewSect(run).operations.libraries.find(x=>x.buildingId===b.instanceId);
 assert(library.family.available);assert.equal(library.studySeats,2);assert.equal(library.teachingSeats,1);assert.equal(JSON.stringify(snapshotSect(run)),before);
 const start=commandSect(run,{type:'collate-family',buildingId:b.instanceId});assert(start.ok,start.error);
 const view=viewSect(run),order=run.state.srCultivation.orders[start.result.orderId];
 assert.equal(order.parameters.preferredBuildingId,b.instanceId);assert.equal(view.operations.study.kind,'family-notes');assert.equal(view.operations.study.name,'整理家传遗卷');
 assert.equal(view.operations.inventory.stockpiles.find(x=>x.id==='stockpile:yunxiu').reserved.food,2);assert(view.operations.master.actions.cancel.available);
 const reserved=JSON.stringify(snapshotSect(run));viewSect(run);assert.equal(JSON.stringify(snapshotSect(run)),reserved);
 run=restoreSect(snapshotSect(run));assert.equal(JSON.stringify(snapshotSect(run)),reserved);
 const end=commandSect(run,{type:'cancel-activity'});assert(end.ok,end.error);assert.equal(run.state.srCultivation.orders[order.id].phase,'cancelled');assert.equal(run.state.story.step,3);
 const study=commandSect(run,{type:'study',buildingId:b.instanceId,artId:'qingwind'});assert(study.ok,study.error);assert.equal(run.state.srCultivation.orders[study.result.orderId].parameters.preferredBuildingId,b.instanceId);
});
test('desktop north road activation exposes the preset library while retaining old facts',()=>{
 const run=createSectSession();assert(commandSect(run,{type:'enable-courtyard-terrain'}).ok);
 const old=structuredClone(run.state.personsById),resources=JSON.stringify(run.state.stockpilesById);
 assert.equal(viewSect(run).domain.plannedSites.find(x=>x.planId==='GC-02').status,'locked');
 const r=commandSect(run,{type:'enable-north-library'});assert(r.ok,r.error);
 const view=viewSect(run);assert(view.domain.northLibraryEnabled);assert.equal(view.domain.plannedSites.find(x=>x.planId==='GC-02').status,'available');
 assert.deepEqual(run.state.personsById,old);assert.equal(JSON.stringify(run.state.stockpilesById),resources);
});
test('new collation order validation rejects changed cost or a missing library without repairing input',()=>{
 let {s,b}=prepared();const r=send(s,'collateFamilyNotes',b.instanceId);s=r.s;const id=r.result.orderId;
 for(const alter of [x=>x.srCultivation.orders[id].cost.food=0,x=>x.srCultivation.orders[id].durationTicks=1,x=>x.srCultivation.orders[id].parameters.preferredBuildingId='building:missing']){
  const bad=JSON.parse(JSON.stringify(s));alter(bad);const before=JSON.stringify(bad);assert.throws(()=>SIM.validateSave(bad));assert.equal(JSON.stringify(bad),before);
 }
});
function restingStudentFixture(){
 const {s,b}=prepared(),student=s.personsById[LU];releaseSRBody(s,student);
 Object.assign(s.master.artsById.qingwind,{understanding:80,mastery:60});s.master.knowledge.qingwind=80;
 student.artsById.qingwind={artId:'qingwind',access:true,understanding:0,mastery:0,source:'fixture',chapter:'qi'};
 student.mind.knowledge.qingwind=0;student.mind.relationships.master.trust=80;student.energy=60;student.wound=0;student.mind.satiety=80;
 student.mind.activity='rest';prepareFacilityActivity(s,student,s.buildings.find(x=>x.type==='hall'),'rest');
 assert.equal(s.activitiesById[student.activityId].action,'rest');return {s,b,student};
}
test('a willing rested student leaves an autonomous rest reservation only after accepting the library invitation',()=>{
 let {s,b,student}=restingStudentFixture();const oldId=student.activityId,oldReservation=s.activitiesById[oldId].reservationId,position=structuredClone(student.position),food=s.resources.food;
 const r=send(s,'masterTeach','qingwind',LU,{buildingId:b.instanceId});s=r.s;assert.equal(r.result.accepted,true);
 assert.equal(s.activitiesById[oldId],undefined);assert.equal(s.reservationsById[oldReservation],undefined);assert.deepEqual(s.personsById[LU].position,position);assert.equal(s.resources.food,food-4);
 s=roundtrip(s);until(s,x=>x.srCultivation.orders[r.result.orderId].phase==='completed');assert.equal(s.personsById[LU].artsById.qingwind.understanding,12);
});
test('an unwilling student retains their actual rest activity and reservation across the declined invitation and reload',()=>{
 let {s,b,student}=restingStudentFixture();student.mind.relationships.master.trust=20;
 const before=structuredClone(student),activities=JSON.stringify(s.activitiesById),reservations=JSON.stringify(s.reservationsById),food=s.resources.food;
 const r=send(s,'masterTeach','qingwind',LU,{buildingId:b.instanceId});s=r.s;assert.equal(r.result.accepted,false);
 assert.deepEqual(s.personsById[LU],before);assert.equal(JSON.stringify(s.activitiesById),activities);assert.equal(JSON.stringify(s.reservationsById),reservations);assert.equal(s.resources.food,food);roundtrip(s);
});
test('existing work and injured rest cannot be replaced by a library invitation',()=>{
 for(const variant of ['work','wound','energy','hunger']){
  const {s,b,student}=restingStudentFixture();
  if(variant==='work'){releaseSRBody(s,student);student.mind.activity='work';student.job=b.id;prepareFacilityActivity(s,student,b,'work');}
  if(variant==='wound')student.wound=1;if(variant==='energy')student.energy=19;if(variant==='hunger')student.mind.satiety=21;
  const before=JSON.stringify(s);assert.throws(()=>send(s,'masterTeach','qingwind',LU,{buildingId:b.instanceId}));assert.equal(JSON.stringify(s),before);
 }
});
