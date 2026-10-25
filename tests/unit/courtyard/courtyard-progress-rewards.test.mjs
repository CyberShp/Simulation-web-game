import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {stockpileReceiptPreview} from '../../../src/simulation/ea-sr-economy.mjs';
const HOME='stockpile:yunxiu';
// A unit fixture marks one existing breakthrough complete; it is not play evidence.
const eligible=()=>{const run=createSectSession();run.state.stats.breakthroughs=1;return run;};
const send=(run,id='breakthrough',type='claim-progress-reward')=>commandSect(run,{type,rewardId:id});
const reward=run=>viewSect(run).progressRewards.find(r=>r.id==='breakthrough');
test('progress reward projection is read only and uses the existing definitions',()=>{
 const run=createSectSession(),before=snapshotSect(run),list=viewSect(run).progressRewards;
 assert.deepEqual(list.map(r=>r.id),['quarry','meditation','breakthrough','food','alchemy']);
 for(const row of list)assert.deepEqual(row.resources,SIM.QUESTS.find(q=>q.id===row.id).reward);
 assert.deepEqual(snapshotSect(run),before);
});
test('completed alchemy exposes its existing reward and claims it once through the public route',()=>{
 const run=createSectSession();assert.equal(viewSect(run).progressRewards.find(r=>r.id==='alchemy').available,false);
 // Isolated eligibility fixture; the ordinary save must carry its real craft fact.
 run.state.stats.crafted=1;
 const before=structuredClone(run.state),row=viewSect(run).progressRewards.find(r=>r.id==='alchemy');
 assert.equal(row.available,true);assert.deepEqual(row.resources,{jade:70,herb:30});
 assert.equal(send(run,'alchemy').ok,true);
 assert.equal(run.state.resources.jade,before.stockpilesById[HOME].resources.jade+70);
 assert.equal(run.state.resources.herb,before.stockpilesById[HOME].resources.herb+30);
 assert.equal(run.state.worldTick,before.worldTick);assert.equal(run.state.claimed.filter(id=>id==='alchemy').length,1);
 const reopened=restoreSect(snapshotSect(run)),saved=structuredClone(reopened.state);
 assert.equal(send(reopened,'alchemy').ok,false);assert.deepEqual(reopened.state,saved);
});
test('alchemy reward refuses an insufficient public capacity without partial payment',()=>{
 const run=createSectSession();run.state.stats.crafted=1;
 run.state.stockpilesById[HOME].resources.food+=stockpileReceiptPreview(run.state,HOME).remaining-99;
 const before=structuredClone(run.state),result=send(run,'alchemy');
 assert.equal(result.ok,false);assert.match(result.error,/容量/);assert.deepEqual(run.state,before);
});
test('unmet and unsupported rewards preserve the complete world',()=>{
 const run=createSectSession();for(const id of ['breakthrough','meditation','food','alchemy','unknown']){
  const before=structuredClone(run.state),result=send(run,id);assert.equal(result.ok,false);assert.deepEqual(run.state,before);
 }
});
test('claim commits the official reward once and replay after save cannot duplicate it',()=>{
 const run=eligible(),before=structuredClone(run.state),cost=SIM.QUESTS.find(q=>q.id==='breakthrough').reward;
 assert.equal(reward(run).available,true);assert.equal(send(run).ok,true);
 for(const[k,n]of Object.entries(cost))assert.equal(run.state.stockpilesById[HOME].resources[k],before.stockpilesById[HOME].resources[k]+n);
 assert.equal(run.state.sect.reputation,before.sect.reputation+10);assert.equal(run.state.worldTick,before.worldTick);assert.equal(run.state.claimed.filter(x=>x==='breakthrough').length,1);
 for(const current of [run,restoreSect(snapshotSect(run))]){const prior=structuredClone(current.state);assert.equal(send(current).ok,false);assert.deepEqual(current.state,prior);assert.equal(reward(current).claimed,true);}
});
test('full public storage refuses the entire bundle before inventory or claim changes',()=>{
 const run=eligible(),stock=run.state.stockpilesById[HOME];stock.resources.food+=stockpileReceiptPreview(run.state,HOME).remaining;
 assert.equal(stockpileReceiptPreview(run.state,HOME).remaining,0);assert.equal(reward(run).available,false);
 const before=structuredClone(run.state),result=send(run);assert.equal(result.ok,false);assert.match(result.error,/容量/);assert.deepEqual(run.state,before);assert(!run.state.claimed.includes('breakthrough'));
});
test('capacity must fit the complete bundle and the legacy quarry API keeps its restriction',()=>{
 const run=eligible(),stock=run.state.stockpilesById[HOME],bundle=SIM.QUESTS.find(q=>q.id==='breakthrough').reward,total=Object.values(bundle).reduce((a,b)=>a+b,0);
 stock.resources.food+=stockpileReceiptPreview(run.state,HOME).remaining-total+1;
 assert.equal(reward(run).available,false);const before=structuredClone(run.state);assert.equal(send(run).ok,false);assert.deepEqual(run.state,before);
 stock.resources.food--;assert.equal(reward(run).available,true);assert.equal(send(run).ok,true);assert.equal(stockpileReceiptPreview(run.state,HOME).remaining,0);
 const saved=structuredClone(run.state);assert.equal(send(run,'breakthrough','claim-building-reward').ok,false);assert.deepEqual(run.state,saved);
});
