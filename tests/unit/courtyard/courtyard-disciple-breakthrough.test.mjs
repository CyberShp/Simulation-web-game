import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession} from '../../../apps/courtyard/sect-sim.mjs';
import {tick,validateSave,dispatchCommand,xpNeed} from '../../../src/simulation/ea-opening-sim.mjs';
import {npcScheduleDecision} from '../../../src/simulation/ea-sr-persons.mjs';
import {beginPersonBreakthrough,BREAKTHROUGH_PHASES} from '../../../src/simulation/ea-sr-cultivation.mjs';
import {slotById} from '../../../src/simulation/ea-facility-slots.mjs';

// Isolated rule fixture. Its XP and one-order material budget do not represent
// normal fundraising; that path is checked against the ordinary source save.
function fixture(){
 const {state:s}=createSectSession(),p=s.disciples[0];
 p.realm=1;p.xp=xpNeed(p.realm);p.energy=100;p.wound=0;p.breakthroughCooldown=0;p.mind.main='qingyuan';p.mind.knowledge.qingyuan=100;
 Object.assign(s.resources,{jade:24,herb:8});
 return {s,p};
}
const orders=s=>Object.values(s.srCultivation.orders).filter(o=>o.kind==='breakthrough');
function advanceTo(s,id,progress,limit=2200){
 s.speed=1;for(let i=0;i<limit&&s.srCultivation.orders[id].progressTicks<progress;i++)tick(s,.1);
 assert.equal(s.srCultivation.orders[id].progressTicks,progress);
}
function exact(s){const raw=JSON.stringify(s);assert.equal(JSON.stringify(validateSave(JSON.parse(raw))),raw);}

test('an eligible disciple independently reserves one public budget and completes one seat-bound breakthrough',()=>{
 const {s,p}=fixture(),realm=p.realm,stats=s.stats.breakthroughs;
 assert.equal(npcScheduleDecision(s,p),true);const o=orders(s)[0];assert(o);assert.equal(o.personId,p.personId);assert.equal(o.sourceStockpileId,'stockpile:yunxiu');assert.deepEqual(o.cost,{jade:24,herb:8});assert.equal(o.progressTicks,0);assert.equal(p.realm,realm);assert.equal(s.resources.jade,0);assert.equal(s.resources.herb,0);
 assert.equal(npcScheduleDecision(s,p),true);assert.equal(orders(s).length,1);
 s.speed=1;tick(s,.1);assert.equal(o.progressTicks,0,'the journey is not completed breakthrough work');
 advanceTo(s,o.id,BREAKTHROUGH_PHASES.reserveTicks-1);
 const a=s.activitiesById[p.activityId],slot=slotById(s,a.slotId);assert.equal(slot.kind,'cultivate');assert.equal(s.reservationsById[a.reservationId].personId,p.personId);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04);assert.equal(o.refineStarted,false);exact(s);
 s.speed=0;const paused=JSON.stringify(s);tick(s,10);assert.equal(JSON.stringify(s),paused);s.speed=1;
 advanceTo(s,o.id,BREAKTHROUGH_PHASES.reserveTicks);assert.equal(o.refineStarted,true);assert.equal(o.consumed,true);exact(s);
 advanceTo(s,o.id,180);assert.equal(p.realm,realm+1);assert.equal(p.xp,0);assert.equal(o.phase,'completed');assert.equal(o.completedTick,s.worldTick);assert.equal(p.breakthroughCooldown,s.time+15);assert.equal(p.activityId,null);assert.equal(s.stats.breakthroughs,stats+1);assert.equal(s.factsById[o.startFactId].personId,p.personId);exact(s);
 tick(s,1);assert.equal(p.realm,realm+1);assert.equal(orders(s).length,1);assert.equal(s.stats.breakthroughs,stats+1);assert.equal(s.resources.jade,0);assert.equal(s.resources.herb,0);
});

test('a disciple lacking prerequisites or willing ambition does not create or charge a breakthrough',()=>{
 for(const alter of [p=>p.xp--,p=>p.energy=34,p=>p.wound=1,p=>p.mind.traits[1]=29]){
  const {s,p}=fixture();alter(p);const material={jade:s.resources.jade,herb:s.resources.herb},realm=p.realm,xp=p.xp;
  npcScheduleDecision(s,p);assert.equal(orders(s).length,0);assert.equal(p.realm,realm);assert.equal(p.xp,xp);assert.deepEqual({jade:s.resources.jade,herb:s.resources.herb},material);
 }
 for(const key of ['jade','herb']){
  const {s,p}=fixture();s.resources[key]--;const before={jade:s.resources.jade,herb:s.resources.herb};npcScheduleDecision(s,p);assert.equal(orders(s).length,0);assert.deepEqual({jade:s.resources.jade,herb:s.resources.herb},before);
 }
});

test('the player cannot substitute a direct forced breakthrough for the disciple decision',()=>{
 const {s,p}=fixture(),before=JSON.stringify(s);
 assert.throws(()=>beginPersonBreakthrough(s,p.personId),/自主/);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>dispatchCommand(s,{name:'beginPersonBreakthrough',args:[p.personId,{autonomous:true}]}));assert.equal(JSON.stringify(s),before);
});

test('disciple breakthrough saves reject a changed person or start fact without altering the source',()=>{
 const {s,p}=fixture();npcScheduleDecision(s,p);const o=orders(s)[0],raw=JSON.stringify(s);exact(s);
 for(const change of [b=>b.srCultivation.orders[o.id].parameters.personId='person:master',b=>b.factsById[o.startFactId].personId='person:master',b=>b.srCultivation.orders[o.id].refineStarted=true]){
  const bad=JSON.parse(raw);change(bad);assert.throws(()=>validateSave(bad),/突破/);assert.equal(JSON.stringify(s),raw);
 }
});
