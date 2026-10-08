/** SR009 pill batch: a real opening, built furnace and physically delivered herb.
 * The old-order branch below is an explicitly controlled compatibility fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import * as S from '../dist/ea-opening-sim.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';

const reload=s=>S.validateSave(JSON.parse(JSON.stringify(s)));
const facts=(s,id)=>Object.values(s.factsById).filter(f=>f.workOrderId===id&&f.count!==undefined);
function checkpoint(label,h){const dir=process.env.SR009_PILL_CHECKPOINT_DIR;if(!dir)return;mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${label}.json`,JSON.stringify({provenance:{kind:'normal-public-command-checkpoint',label,counts:h.counts},state:h.s}));}

test('public furnace batch freezes inputs and output through reload, cancellation and settlement',()=>{
 const h=normalOpening(),furnace=h.build('alchemy'),siteId=`stockpile:${furnace.instanceId}`;
 h.resources({herb:10,jade:10,food:20});
 const paidLegacy=JSON.parse(JSON.stringify(h.s));
 paidLegacy.crafting={recipeId:'heal',remaining:10,total:20,yield:1};
 paidLegacy.stockpilesById['stockpile:yunxiu'].resources.herb-=10;
 paidLegacy.stockpilesById['stockpile:yunxiu'].resources.jade-=10;
 const legacyBefore={herb:paidLegacy.stockpilesById['stockpile:yunxiu'].resources.herb,jade:paidLegacy.stockpilesById['stockpile:yunxiu'].resources.jade};
 const resumed=S.validateSave(paidLegacy),legacyOrder=Object.values(resumed.workOrdersById).find(w=>w.kind==='sr-crafting'&&w.legacyPaid);
 assert(legacyOrder,'paid historical furnace batch resumes');
 assert.equal(legacyOrder.recipeSnapshot.recipeVersion,'pill-recipes:yunxiu:v1');
 assert.equal(legacyOrder.recipeSnapshot.outputCount,1);
 assert.equal(legacyOrder.progressTicks,100);
 assert.equal(resumed.stockpilesById['stockpile:yunxiu'].resources.herb,legacyBefore.herb);
 assert.equal(resumed.stockpilesById['stockpile:yunxiu'].resources.jade,legacyBefore.jade);
 assert.equal(JSON.stringify(reload(resumed)),JSON.stringify(resumed),'paid legacy queue migrates once');
 const historical=harness(resumed,'paid-legacy-fixture');
 historical.until(s=>s.workOrdersById[legacyOrder.id].phase==='completed','paid legacy furnace completion',2500);
 assert.equal(historical.s.stockpilesById[siteId].pills.heal,1,'old paid yield is retained');
 assert.equal(facts(historical.s,legacyOrder.id).length,1);
 historical.save();
 const oldCompleted=JSON.parse(JSON.stringify(historical.s));
 delete oldCompleted.factsById[`fact:craft:${legacyOrder.id}`].recipeVersion;
 assert.doesNotThrow(()=>S.validateSave(oldCompleted),'completed v1 fact without a version remains readable');
 const transport=h.act('startTransport','stockpile:yunxiu',siteId,'person:master',{herb:10});
 h.until(s=>s.workOrdersById[transport.id].phase==='delivered','herb physically delivered');h.save();
 assert.equal(h.s.stockpilesById[siteId].resources.herb,10);
 const pillBefore=h.s.stockpilesById[siteId].pills.heal;
 const started=h.act('craftSR','heal'),id=started.id;
 h.save();checkpoint('pill-active',h);
 const order=h.s.workOrdersById[id],snap=order.recipeSnapshot;
 assert.equal(snap.recipeVersion,'supply-recipes:yunxiu:v2');
 assert.deepEqual(snap.inputCost,{jade:10,herb:10});
 assert.deepEqual(snap.sourceStockpileIds,{jade:'stockpile:yunxiu',herb:siteId});
 assert.equal(snap.outputCount,2);
 assert.deepEqual(snap.effectDefinition,{xp:0,energy:15,wound:25});
 assert.equal(snap.durationTicks,200);
 assert.equal(h.s.stockpilesById[siteId].resources.herb,0);
 assert.equal(facts(h.s,id).length,0);
 const forged=JSON.parse(JSON.stringify(h.s));forged.workOrdersById[id].recipeSnapshot.inputCost.herb=11;
 assert.throws(()=>S.validateSave(forged),/丹炉配方快照异常/);
 h.until(s=>s.workOrdersById[id].progressTicks>=40,'onsite furnace progress');h.save();
 const progress=h.s.workOrdersById[id].progressTicks,paid=JSON.parse(JSON.stringify(h.s));

 const cancelled=harness(reload(paid),'pill-cancel-branch'),beforeRefund=cancelled.s.stockpilesById[siteId].resources.herb;
 const refund=cancelled.act('cancelCraftSR');
 assert.equal(refund.cancelled,true);
 assert(Math.abs(refund.refund.herb-10*(1-progress/200))<1e-9);
 assert(Math.abs(cancelled.s.stockpilesById[siteId].resources.herb-beforeRefund-refund.refund.herb)<1e-9);
 assert.equal(facts(cancelled.s,id).length,0);
 cancelled.save();assert.throws(()=>cancelled.act('cancelCraftSR'));
 const cancelledState=JSON.parse(JSON.stringify(cancelled.s)),cancelFactId=`fact:craft-cancel:${id}`;
 for(const change of [
  s=>{delete s.factsById[cancelFactId];},
  s=>{s.workOrdersById[id].refund.herb=999;},
  s=>{s.factsById[cancelFactId].refund.herb=999;},
  s=>{delete s.workOrdersById[id].finishedTick;},
  s=>{delete s.workOrdersById[id].cancelRecordVersion;delete s.workOrdersById[id].refundStockpileIds;delete s.factsById[cancelFactId].refundStockpileIds;}
 ]){const forged=JSON.parse(JSON.stringify(cancelledState));change(forged);assert.throws(()=>S.validateSave(forged),/已结束丹炉批次清理或产物事实异常/);}
 const oldCancelled=JSON.parse(JSON.stringify(cancelledState)),oldCancelledOrder=oldCancelled.workOrdersById[id];
 oldCancelledOrder.recipeVersion='pill-recipes:yunxiu:v1';oldCancelledOrder.recipeSnapshot.recipeVersion='pill-recipes:yunxiu:v1';
 delete oldCancelledOrder.cancelRecordVersion;delete oldCancelledOrder.refundStockpileIds;delete oldCancelledOrder.refundTemporaryPlacements;
 delete oldCancelled.factsById[cancelFactId].refundStockpileIds;delete oldCancelled.factsById[cancelFactId].refundTemporaryPlacements;
 assert.doesNotThrow(()=>S.validateSave(oldCancelled),'older cancelled v1 batch remains readable');
 const full=JSON.parse(JSON.stringify(paid)),fullSite=full.stockpilesById[siteId];
 fullSite.resources.food=fullSite.capacity;
 assert.doesNotThrow(()=>S.validateSave(full),'full furnace warehouse is a valid controlled fixture');
 const fullCancellation=harness(S.validateSave(full),'full-warehouse-cancel-fixture');
 fullCancellation.act('cancelCraftSR');fullCancellation.save();
 const temporary=fullCancellation.s.stockpilesById[`stockpile:craft-refund:${id}:herb`];
 assert(temporary,'unworked herb goes to a named onsite temporary stock');
 assert.equal(temporary.resources.herb,10*(1-progress/200));
 assert.equal(temporary.ownerId,fullSite.ownerId);
 assert.equal(temporary.position.sceneId,fullSite.position.sceneId);
 assert.equal(fullCancellation.s.stockpilesById[siteId].resources.herb,0);
 assert.equal(JSON.stringify(reload(fullCancellation.s)),JSON.stringify(fullCancellation.s));
 for(const change of [st=>{st.custodianId='person:merchant-qingxi';},st=>{st.position={sceneId:'scene:market',x:37,y:25};}]){
  const forged=JSON.parse(JSON.stringify(fullCancellation.s));change(forged.stockpilesById[temporary.id]);
  assert.throws(()=>S.validateSave(forged),/已结束丹炉批次清理或产物事实异常/);
 }

 const old=JSON.parse(JSON.stringify(paid)),oldOrder=old.workOrdersById[id];
 oldOrder.recipeVersion='pill-recipes:yunxiu:v1';delete oldOrder.recipeSnapshot;
 const oldRaw=JSON.stringify(old),migrated=S.validateSave(old);
 assert.equal(JSON.stringify(old),oldRaw,'compatibility migration leaves the source untouched');
 assert.equal(migrated.workOrdersById[id].recipeSnapshot.recipeVersion,'pill-recipes:yunxiu:v1');
 assert.equal(migrated.workOrdersById[id].progressTicks,progress);
 assert.equal(migrated.stockpilesById[siteId].pills.heal,pillBefore);
 assert.equal(JSON.stringify(reload(migrated)),JSON.stringify(migrated),'old batch migrates once');
 const shortened=JSON.parse(JSON.stringify(old));shortened.workOrdersById[id].durationTicks=1;
 shortened.workOrdersById[id].progressTicks=0;
 assert.throws(()=>S.validateSave(shortened),/旧丹炉工单用时异常/,'old active batch cannot shorten its original duration');

 h.until(s=>s.workOrdersById[id].phase==='completed','new batch settles once',2500);
 assert.equal(h.s.stockpilesById[siteId].pills.heal,pillBefore+2);
 assert.equal(facts(h.s,id).length,1);
 assert.equal(h.s.factsById[`fact:craft:${id}`].recipeVersion,'supply-recipes:yunxiu:v2');
 h.save();checkpoint('pill-completed',h);for(let n=0;n<30;n++)S.tick(h.s,.1);
 assert.equal(facts(h.s,id).length,1);
 assert.equal(h.s.stockpilesById[siteId].pills.heal,pillBefore+2);
 const completed=JSON.parse(JSON.stringify(h.s)),factId=`fact:craft:${id}`;
 const tamper=change=>{const forged=JSON.parse(JSON.stringify(completed));change(forged);assert.throws(()=>S.validateSave(forged),/已结束丹炉批次清理或产物事实异常/);};
 tamper(s=>{s.workOrdersById[id].resultFactId='fact:pill-stock-migration:v1';delete s.factsById[factId];});
 for(const change of [
  f=>{f.count=3;},f=>{f.quantity=3;},f=>{f.workOrderId='work:other';},
  f=>{f.recipeVersion='pill-recipes:yunxiu:v1';},f=>{f.recipeId='qi';},
  f=>{f.targetStockpileId='stockpile:yunxiu';},f=>{f.cost.herb=9;}
 ])tamper(s=>change(s.factsById[factId]));
 console.log(JSON.stringify({commands:h.counts.commands,saves:h.counts.saves,worldTick:h.s.worldTick,orderId:id,legacyProgress:progress,refundHerb:refund.refund.herb}));
});
