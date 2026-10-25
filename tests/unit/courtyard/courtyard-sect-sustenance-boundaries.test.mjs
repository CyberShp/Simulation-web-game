import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,snapshotSect,restoreSect,advanceSect} from '../../../apps/courtyard/sect-sim.mjs';
import {sectSustenanceCandidate} from '../../../src/simulation/ea-sect-sustenance.mjs';

// Isolated scarcity fixtures test choice boundaries, not normal-play acceptance.
function fixture(){
 const run=createSectSession(),s=run.state,d=s.disciples[0],b=s.buildings.find(x=>x.type==='farm');
 b.type='granary';b.enabled=true;b.condition=100;
 const stock=s.stockpilesById[`stockpile:${b.instanceId}`];stock.resources.food=52;
 s.resources.food=1;d.energy=80;d.wound=0;d.mind.satiety=90;d.mind.activity='rest';d.mind.commitUntil=0;d.mind.learning=null;
 d.schedule.commitUntilTick=0;d.schedule.commitmentsById={};d.mind.relationships.master.trust=80;d.mind.traits[3]=80;
 return {run,s,d,b,stock};
}
test('sustenance projection preserves complete state and leaves crop seed plus carrier cap',()=>{
 const {s,d,stock}=fixture(),before=structuredClone(s),candidate=sectSustenanceCandidate(s,d);
 assert.ok(candidate);assert.equal(candidate.quantity,34);assert.ok(candidate.quantity<=40);assert.ok(stock.resources.food-candidate.quantity>=2);
 for(let i=0;i<4;i++)assert.deepEqual(sectSustenanceCandidate(s,d),candidate);
 assert.deepEqual(s,before);
});
test('existing lesson and finite commitments retain the same body and reservation',()=>{
 for(const mode of ['mind','schedule','promise','lesson']){
  const {s,d}=fixture();
  if(mode==='mind')d.mind.commitUntil=s.time+10;
  if(mode==='schedule')d.schedule.commitUntilTick=s.worldTick+100;
  if(mode==='promise')d.schedule.commitmentsById={duty:{status:'active',endTick:s.worldTick+100}};
  if(mode==='lesson'){d.mind.activity='study';d.mind.learning={id:'qingyuan',progress:3,total:55};}
  const before=structuredClone(s);assert.equal(sectSustenanceCandidate(s,d),null,mode);assert.deepEqual(s,before,mode);
 }
});
test('away, wounded, exhausted, hungry or unwilling people do not accept supply transport',()=>{
 for(const mode of ['away','wound','energy','satiety','trust','discipline']){
  const {s,d}=fixture();
  if(mode==='away')d.position={kind:'scene',sceneId:'scene:valley',x:27,y:30};
  if(mode==='wound')d.wound=21;if(mode==='energy')d.energy=21;if(mode==='satiety')d.mind.satiety=21;
  if(mode==='trust')d.mind.relationships.master.trust=34;if(mode==='discipline')d.mind.traits[3]=39;
  const before=structuredClone(s);assert.equal(sectSustenanceCandidate(s,d),null,mode);assert.deepEqual(s,before,mode);
 }
});
test('seed only, stopped fields, private goods and satisfied reserve cannot create cargo',()=>{
 for(const mode of ['seed','stopped','private','full']){
  const {s,d,b,stock}=fixture();if(mode==='seed')stock.resources.food=2;if(mode==='stopped')b.enabled=false;
  if(mode==='private')stock.access='private';if(mode==='full')s.resources.food=35;
  const before=structuredClone(s);assert.equal(sectSustenanceCandidate(s,d),null,mode);assert.deepEqual(s,before,mode);
 }
});
test('paused ordinary world restores without advancing its single clock or supply',()=>{
 const run=createSectSession();run.state.speed=0;const saved=snapshotSect(run),restored=restoreSect(saved);
 advanceSect(restored,30);assert.deepEqual(snapshotSect(restored),saved);
});
test('unreachable supply and unavailable storage leave all goods in place',()=>{
 for(const mode of ['unreachable','capacity']){
  const {s,d,stock}=fixture();
  if(mode==='unreachable')stock.position={sceneId:'scene:yunxiu-courtyard',x:99999,y:99999};
  else s.stockpilesById['stockpile:yunxiu'].capacity=0;
  const before=structuredClone(s);assert.equal(sectSustenanceCandidate(s,d),null,mode);assert.deepEqual(s,before,mode);
 }
});
