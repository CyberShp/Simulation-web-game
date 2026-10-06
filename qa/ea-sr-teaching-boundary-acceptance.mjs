/** SR-XF-014 / 02-6.3: explicit teaching boundary fixtures, never a normal-play proof.
 * Uses the real cultivation runtime and workstation movement; writes no QA artifacts.
 */
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import * as C from '../dist/ea-sr-cultivation.mjs';
import {releaseBodyActivity} from '../dist/ea-facility-activities.mjs';
import {cloneState} from '../dist/ea-state-v6.mjs';

const cases=[];
function test(name,fn){fn();cases.push(name);}
function fixture(artId){
 const s=SIM.initial({sr:true,seed:1847});
 SIM.tick(s,1);
 const master=s.master,student=s.personsById['person:lu-zhiwei'];
 for(const p of [master,student]){releaseBodyActivity(s,p);p.wound=0;p.energy=100;p.journey=null;}
 master.realm=9;student.realm=9;student.mind.away=null;
 student.mind.relationships.master.trust=70;
 master.knowledge[artId]=70;
 master.artsById[artId]={artId,understanding:70,mastery:60};
 student.mind.knowledge[artId]=0;
 student.artsById[artId]={artId,understanding:0,mastery:0};
 return {s,master,student};
}
function rejectWithoutMutation(s,artId,studentId,reason){
 const before=JSON.stringify(s);
 assert.throws(()=>C.teachArt(s,artId,studentId),reason);
 assert.equal(JSON.stringify(s),before,'rejected teaching must not spend food, reserve bodies or change knowledge');
}
function step(s,n){for(let i=0;i<n;i++){s.worldTick++;s.revision++;C.tickCultivation(s);}}

test('under-tier student cannot learn a foundation chapter through a teacher',()=>{
 const {s,student}=fixture('foundation');student.realm=1;
 rejectWithoutMutation(s,'foundation',student.personId,/学生境界不足/);
});
test('named prerequisite applies to a student as it does to self-study',()=>{
 const {s,student}=fixture('foundation');
 student.mind.knowledge.qingyuan=0;
 student.artsById.qingyuan={artId:'qingyuan',understanding:0,mastery:0};
 rejectWithoutMutation(s,'foundation',student.personId,/学生未理解前置法门/);
});
test('current-main prerequisite cannot be bypassed by teacher mastery',()=>{
 const {s,student}=fixture('sword');student.realm=6;student.mind.main='qingyuan';
 student.mind.knowledge.qingyuan=20;
 student.artsById.qingyuan={artId:'qingyuan',understanding:20,mastery:0};
 rejectWithoutMutation(s,'sword',student.personId,/学生主修理解不足/);
});
test('teacher also satisfies chapter realm qualification',()=>{
 const {s,master,student}=fixture('foundation');master.realm=1;
 rejectWithoutMutation(s,'foundation',student.personId,/典籍准入境界/);
});
test('a qualified oral lesson supplies access without making the student own a book',()=>{
 let {s,student}=fixture('flame');student.realm=2;
 student.mind.knowledge.qingyuan=20;
 student.artsById.qingyuan={artId:'qingyuan',understanding:20,mastery:0};
 assert.equal(s.doctrine.books.includes('flame'),false);
 const food=s.resources.food,r=C.teachArt(s,'flame',student.personId);
 assert.equal(r.accepted,true);assert.equal(s.resources.food,food-4);
 assert.equal(student.artsById.flame.understanding,0,'acceptance is not completed study');
 step(s,30);s=cloneState(s);C.initCultivation(s);
 for(let n=0;n<3000&&s.srCultivation.orders[r.orderId].phase!=='completed';n++)step(s,1);
 assert.equal(s.srCultivation.orders[r.orderId].phase,'completed','both bodies arrive at actual study/teaching workstations');
 assert.equal(s.personsById[student.personId].artsById.flame.understanding,12);
 assert.equal(s.personsById[student.personId].activityId,null);
 assert.equal(s.master.activityId,null);
 step(s,150);
 assert.equal(s.personsById[student.personId].artsById.flame.understanding,12,'completion and reload do not award twice');
 assert.equal(s.doctrine.books.includes('flame'),false,'oral access does not duplicate an edition');
 C.validateCultivation(s);
});

console.log(JSON.stringify({suite:'SR teaching admission boundaries',passed:cases.length,failed:0,cases,boundary:'Explicit realm/knowledge fixtures and actual workstation movement. No normal progression, browser, balance or real-device completion claim.'},null,2));
