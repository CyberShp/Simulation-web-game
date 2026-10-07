/** SR-XF-009-AC-02: one shared workshop batch from an earned public-command save.
 * Source: node qa/ea-sr-integration-acceptance.mjs --case 'normal fresh SR full artisan care' --checkpoint-dir /tmp/immortal-sr009-source
 * Run: SR009_SOURCE=/tmp/immortal-sr009-source/physical-workshop-built.json node --test qa/ea-sr-009-shared-batch-public-acceptance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as S from '../dist/ea-opening-sim.mjs';
import {buildingYield} from '../dist/ea-sim.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';
import {productionAvailability} from '../dist/ea-sr-economy.mjs';

const sourcePath=process.env.SR009_SOURCE;
const source=sourcePath?JSON.parse(readFileSync(sourcePath,'utf8')):null;
const buildingId='building:yunxiu:6';
const workOrderId=`work:production:${buildingId}`;
const factId=`fact:production:${buildingId}:1`;
const siteId=`stockpile:${buildingId}`;
const close=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-8,`${label}: ${actual} ≈ ${expected}`);
function exactSave(h,label){const raw=JSON.stringify(h.s);h.save();assert.equal(JSON.stringify(h.s),raw,`${label}: exact save and reload`);}
function worker(s,id){const p=s.personsById[id];return {skill:p.mind.skills.industry,purse:p.mind.purse,memories:structuredClone(p.mind.memories)};}
function resultCount(s){return Object.values(s.factsById).filter(f=>f.operation==='production'&&f.targetStockpileId===siteId).length;}
function earned(){
 assert.equal(source?.provenance?.kind,'normal-public-command-checkpoint');
 assert.equal(source.provenance.label,'physical workshop built');
 const state=S.validateSave(source.state);
 assert.equal(JSON.stringify(state),JSON.stringify(source.state),'source must be a canonical save');
 assert.equal(source.provenance.counts.worldTick,state.worldTick);
 assert.equal(state.buildingsById[buildingId]?.type,'workshop');
 assert.equal(state.workOrdersById[workOrderId],undefined);
 assert.equal(state.stockpilesById[siteId].resources.jade,0);
 return harness(state,'sr009-shared-batch');
}

if(!source){
 test('SR-XF-009-AC-02 earned source checkpoint',{skip:'Set SR009_SOURCE to the earned physical-workshop-built.json checkpoint.'},()=>{});
}else{
 test('two onsite workers settle one finite workshop batch and the same result survives exact reload',()=>{
  const h=earned(),initialFacts=resultCount(h.s),recipe=S.BUILDINGS.workshop.input;
  assert.deepEqual(recipe,{wood:3,stone:2});
  assert.equal(initialFacts,0);
  for(const [resource,quantity] of [['stone',recipe.stone],['wood',recipe.wood]]){
   const transfer=h.act('startTransport','stockpile:yunxiu',siteId,'person:master',{[resource]:quantity});
   assert.equal(transfer.accepted,true);
   h.until(s=>s.workOrdersById[transfer.id].phase==='delivered',`${resource} physically delivered`,1000);
   exactSave(h,`${resource} received at workshop`);
  }
  assert.equal(h.s.stockpilesById[siteId].resources.wood,recipe.wood);
  assert.equal(h.s.stockpilesById[siteId].resources.stone,recipe.stone);
  h.until(s=>productionAvailability(s,s.buildingsById[buildingId]).available,'merchant physically available',3000);
  const workerIds=[];
  for(const id of h.s.homeMemberIds){
   const offer=h.act('inviteWork',id,buildingId);
   if(offer.accepted)workerIds.push(id);
   if(workerIds.length===2)break;
  }
  assert.equal(workerIds.length,2,'two members voluntarily accept onsite work');
  exactSave(h,'accepted worker invitations');
  h.until(s=>s.workOrdersById[workOrderId]?.progressTicks>0,'onsite batch begins',1200);
  const order=h.s.workOrdersById[workOrderId];
  assert.equal(order.batch,1);
  assert.equal(order.phase,'active');
  assert.deepEqual(h.s.reservationsById[order.reservationId]?.cost,recipe,'input is reserved once for the shared batch');
  assert.equal(h.s.stockpilesById[siteId].resources.wood,0);
  assert.equal(h.s.stockpilesById[siteId].resources.stone,0);
  assert.equal(h.s.factsById[factId],undefined);
  exactSave(h,'batch input consumed once at first actual contribution');

  let before=null;
  for(let i=0;i<2000&&!h.s.factsById[factId];i++){
   const s=h.s,b=s.buildingsById[buildingId];
   before={tick:s.worldTick,order:structuredClone(s.workOrdersById[workOrderId]),siteJade:s.stockpilesById[siteId].resources.jade,homeJade:s.resources.jade,buyerJade:s.stockpilesById['stockpile:qingxi'].resources.jade,cycles:s.society.stats.workCycles,workers:Object.fromEntries(workerIds.map(id=>[id,worker(s,id)])),yields:Object.fromEntries(workerIds.map(id=>[id,buildingYield(s,b,s.personsById[id]).jade]))};
   S.tick(s,.1);
  }
  const s=h.s,fact=s.factsById[factId],finished=s.workOrdersById[workOrderId];
  assert(fact,'batch completes through normal world ticks');
  assert.equal(before.order.phase,'active');
  assert.equal(finished.phase,'completed');
  assert.equal(finished.batch,1);
  assert.equal(finished.progressTicks,finished.durationTicks);
  assert.deepEqual(Object.keys(finished.contributions).sort(),workerIds.slice().sort());
  assert.equal(Object.values(finished.contributions).reduce((a,b)=>a+b,0),finished.durationTicks);
  assert.deepEqual(fact.participantIds.slice().sort(),workerIds.slice().sort());
  assert.equal(resultCount(s),initialFacts+1,'one fact for one batch');
  assert.equal(s.society.stats.workCycles,before.cycles+1,'one work-cycle settlement');
  assert.equal(s.reservationsById[finished.reservationId],undefined,'current-batch input reservation is released');
  assert.equal(s.stockpilesById[siteId].resources.wood,0);
  assert.equal(s.stockpilesById[siteId].resources.stone,0);
  const weighted=workerIds.reduce((sum,id)=>sum+before.yields[id]*finished.contributions[id]/finished.durationTicks*(1+before.workers[id].skill/250),0);
  close(fact.grossOutput.jade,weighted,'contribution-weighted recipe yield');
  close(fact.payment,fact.grossOutput.jade,'finite buyer payment');
  close(before.buyerJade-s.stockpilesById['stockpile:qingxi'].resources.jade,fact.payment,'buyer paid exactly once');
  close(s.stockpilesById[siteId].resources.jade-before.siteJade,fact.quantities.jade,'one physical output stock increase');
  close(fact.grossOutput.jade-fact.quantities.jade,fact.wagesFromProceeds,'wages separated from output stock');
  const publicWage=before.homeJade-s.resources.jade;
  close(publicWage,Math.min(before.homeJade,.8),'available public cash pays its share of wages');
  close(fact.wagesFromProceeds,.8-publicWage,'buyer proceeds cover the remaining wages');
  for(const id of workerIds){
   const share=finished.contributions[id]/finished.durationTicks,p=s.personsById[id];
   close(p.mind.skills.industry-before.workers[id].skill,.6*share,`${id} skill share`);
   close(p.mind.purse-before.workers[id].purse,.8*share,`${id} wage share`);
   assert.equal(before.workers[id].memories.filter(m=>m.key===factId).length,0);
   const linked=p.mind.memories.filter(m=>m.key===factId);
   assert.equal(linked.length,1,`${id} remembers this one result`);
   assert.match(linked[0].text,/百工坊.*协作.*完成/);
   assert.equal(linked[0].time,s.society.clock);
  }
  close(workerIds.reduce((sum,id)=>sum+s.personsById[id].mind.purse-before.workers[id].purse,0),publicWage+fact.wagesFromProceeds,'worker wages conserve both payment sources');
  exactSave(h,'completed shared batch and each linked memory');
  const settled={fact:structuredClone(h.s.factsById[factId]),siteJade:h.s.stockpilesById[siteId].resources.jade,buyerJade:h.s.stockpilesById['stockpile:qingxi'].resources.jade,cycles:h.s.society.stats.workCycles,workers:Object.fromEntries(workerIds.map(id=>[id,worker(h.s,id)]))};
  for(let i=0;i<30;i++)S.tick(h.s,.1);
  assert.deepEqual(h.s.factsById[factId],settled.fact);
  assert.equal(resultCount(h.s),initialFacts+1);
  assert.equal(h.s.stockpilesById[siteId].resources.jade,settled.siteJade);
  assert.equal(h.s.stockpilesById['stockpile:qingxi'].resources.jade,settled.buyerJade);
  assert.equal(h.s.society.stats.workCycles,settled.cycles);
  for(const id of workerIds){
   assert.equal(h.s.personsById[id].mind.skills.industry,settled.workers[id].skill);
   assert.equal(h.s.personsById[id].mind.purse,settled.workers[id].purse);
   assert.equal(h.s.personsById[id].mind.memories.filter(m=>m.key===factId).length,1);
  }
  exactSave(h,'post-settlement replay interval');
  console.log(JSON.stringify({case:'shared-workshop-batch',source:sourcePath,sourceCounts:source.provenance.counts,worldTick:h.s.worldTick,participants:fact.participantIds,contributions:finished.contributions,grossOutput:fact.grossOutput.jade,received:fact.quantities.jade,publicWage,wagesFromProceeds:fact.wagesFromProceeds,cost:recipe,saves:h.counts.saves}));
 });
}
