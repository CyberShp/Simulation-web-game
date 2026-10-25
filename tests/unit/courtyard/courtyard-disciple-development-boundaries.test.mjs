import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,advanceSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {discipleDevelopmentView,recommendDiscipleTechnique,setDiscipleWorkFocus} from '../../../src/simulation/ea-disciple-development.mjs';

// Explicit isolated fixtures; normal source acceptance lives in the desktop harness.
function fixture(){const run=createSectSession(),s=run.state,p=SIM.addDisciple(s,{name:'研习边界门人',main:'qingyuan',traits:[60,60,60,60,60]});const normalized=restoreSect(snapshotSect(run));return{run:normalized,s:normalized.state,p:normalized.state.personsById[p.personId]};}
test('development projection and paused advancement preserve complete state',()=>{
 const {run,s}=fixture();const before=structuredClone(s);
 for(let i=0;i<4;i++)discipleDevelopmentView(s);
 assert.deepEqual(s,before);
 s.speed=0;const paused=snapshotSect(run);advanceSect(run,10);assert.deepEqual(snapshotSect(run),paused);
});
test('public work focus preserves current bodily activity and finite commitment',()=>{
 const {s,p}=fixture();p.mind.commitUntil=s.time+20;p.mind.activity='study';p.mind.learning={id:'qingyuan',progress:1,total:55,mode:'deepen'};
 const before=structuredClone(p);setDiscipleWorkFocus(s,'wood');assert.equal(s.doctrine.workFocus,'wood');assert.deepEqual(p,before);
 assert.throws(()=>setDiscipleWorkFocus(s,'imaginary-resource'));assert.equal(s.doctrine.workFocus,'wood');
});
test('unavailable recommendation repeats its determined answer without consuming random state or growth',()=>{
 const {s,p}=fixture();p.position={kind:'scene',sceneId:'scene:valley',x:27,y:30.5};
 const knowledge=structuredClone(p.mind.knowledge),random=s.rngState,first=recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'qingyuan'});
 assert.equal(first.accepted,false);assert.equal(first.status,'unavailable');
 assert.deepEqual(recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'qingyuan'}),first);
 assert.deepEqual(p.mind.knowledge,knowledge);assert.equal(s.rngState,random);
});
test('unknown people and inaccessible books cannot create recommendation receipts',()=>{
 const {s,p}=fixture();assert.throws(()=>recommendDiscipleTechnique(s,{personId:'person:missing',techniqueId:'qingyuan'}));
 assert.throws(()=>recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'missing'}));
 s.doctrine.sealed.push('qingyuan');assert.throws(()=>recommendDiscipleTechnique(s,{personId:p.personId,techniqueId:'qingyuan'}));
 assert.equal(p.mind.developmentRecommendation,undefined);
});
test('ordinary codec preserves publicly changed work focus',()=>{
 const {run,s}=fixture();setDiscipleWorkFocus(s,'herb');const saved=snapshotSect(run);assert.deepEqual(restoreSect(saved).state,s);
});
test('out-of-contact public member does not reveal current study or skills',()=>{
 const {s,p}=fixture();p.position={kind:'scene',sceneId:'scene:valley',x:27,y:30.5};p.mind.learning={id:'qingyuan',progress:12,total:55,mode:'deepen'};p.mind.activity='study';p.mind.skills.learning=7;
 const member=discipleDevelopmentView(s).members.find(m=>m.personId===p.personId);
 assert.equal(member.contact.available,false);assert(!member.learning);assert.equal(member.knowledge?.length||0,0);assert.equal(member.skills?.length||0,0);assert.equal(member.options?.length||0,0);
});
