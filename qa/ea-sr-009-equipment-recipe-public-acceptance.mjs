/** SR-XF-009 equipment batches from a saved, normal public-command workshop.
 * The missing-snapshot branch is an explicitly controlled old-order fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as S from '../dist/ea-opening-sim.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const source=process.env.SR009_EQUIPMENT_SOURCE;
const clone=s=>JSON.parse(JSON.stringify(s));
const reload=s=>S.validateSave(clone(s));
const crafted=(s,id)=>Object.values(s.itemsById).filter(i=>i.source?.craftOrderId===id);

test('paid equipment recipe, old active order and single result survive exact reload',()=>{
 assert(source,'set SR009_EQUIPMENT_SOURCE to a normal public-command workshop checkpoint');
 const record=JSON.parse(readFileSync(source,'utf8'));
 assert.equal(record.provenance?.kind,'normal-public-command-checkpoint');
 assert(record.state?.buildingsById&&Object.values(record.state.buildingsById).some(b=>b.type==='workshop'&&b.enabled!==false));
 const h=harness(reload(record.state),'sourced-public-workshop');
 h.resources({jade:12,wood:6,food:10});h.rest();
 const before={jade:h.s.resources.jade,wood:h.s.resources.wood};
 const started=h.act('craftEquipment','equipment:travel-robe'),id=started.orderId;
 h.save();const first=h.s.srEquipment.orders[id],snapshot=clone(first.recipeSnapshot);
 assert.equal(first.recipeSnapshot.recipeVersion,S.EQUIPMENT_RECIPE_VERSION);
 assert.deepEqual(first.recipeSnapshot.inputCost,{jade:12,wood:6});
 assert.deepEqual(first.recipeSnapshot.sourceStockpileIds,{jade:'stockpile:yunxiu',wood:'stockpile:yunxiu'});
 assert.equal(first.recipeSnapshot.durationValue,100);
 assert.equal(h.s.resources.jade,before.jade-12);assert.equal(h.s.resources.wood,before.wood-6);
 assert.equal(crafted(h.s,id).length,0);

 const forged=clone(h.s);forged.srEquipment.orders[id].recipeSnapshot.inputCost.wood=7;
 assert.throws(()=>S.validateSave(forged),/装备制作配方快照异常/);
 const wrongVersion=clone(h.s);wrongVersion.srEquipment.orders[id].recipeSnapshot.recipeVersion='equipment-recipes:unknown';
 assert.throws(()=>S.validateSave(wrongVersion),/装备制作配方快照异常/);

 const cancel=harness(reload(h.s),'cancel-branch');
 const result=cancel.act('cancelEquipmentOrder',id);assert.equal(result.refunded,true);
 assert.equal(cancel.s.resources.jade,before.jade);assert.equal(cancel.s.resources.wood,before.wood);
 cancel.save();assert.throws(()=>cancel.act('cancelEquipmentOrder',id));
 assert.equal(crafted(cancel.s,id).length,0);

 h.until(s=>s.srEquipment.orders[id].progressTicks>=25,'actual workshop contribution',2000);
 h.save();const progress=h.s.srEquipment.orders[id].progressTicks;
 const interrupted=harness(reload(h.s),'worked-cancel-branch'),spent={...interrupted.s.resources};
 assert.equal(interrupted.act('cancelEquipmentOrder',id).refunded,false);
 assert.equal(interrupted.s.resources.jade,spent.jade);assert.equal(interrupted.s.resources.wood,spent.wood);
 interrupted.save();assert.throws(()=>interrupted.act('cancelEquipmentOrder',id));
 assert.equal(crafted(interrupted.s,id).length,0);
 const old=clone(h.s);delete old.srEquipment.orders[id].recipeSnapshot;
 const oldRaw=JSON.stringify(old),migrated=S.validateSave(old);
 assert.equal(JSON.stringify(old),oldRaw,'old archive remains untouched');
 assert.equal(migrated.srEquipment.orders[id].recipeMigration,S.EQUIPMENT_RECIPE_VERSION);
 assert.deepEqual(migrated.srEquipment.orders[id].recipeSnapshot,snapshot);
 assert.equal(migrated.srEquipment.orders[id].progressTicks,progress);
 assert.equal(migrated.resources.jade,h.s.resources.jade);assert.equal(migrated.resources.wood,h.s.resources.wood);
 assert.equal(JSON.stringify(reload(migrated)),JSON.stringify(migrated),'migration is once-only');
 const badOld=clone(old);badOld.srEquipment.orders[id].cost.wood=7;
 assert.throws(()=>S.validateSave(badOld),/装备制作旧单成本/);
 const historical=harness(migrated,'old-active-fixture');
 historical.until(s=>s.srEquipment.orders[id].phase==='completed','old paid order completion',2000);
 historical.save();assert.equal(crafted(historical.s,id).length,1);
 assert.equal(historical.s.factsById[`fact:equipment-craft:${id}`].recipeVersion,S.EQUIPMENT_RECIPE_VERSION);

 h.until(s=>s.srEquipment.orders[id].phase==='completed','new order completion',2000);h.save();
 assert.equal(crafted(h.s,id).length,1);
 assert.equal(Object.values(h.s.factsById).filter(f=>f.operation==='equipment-craft'&&f.workOrderId===id).length,1);
 const badResult=clone(h.s);badResult.factsById[`fact:equipment-craft:${id}`].cost.wood=7;
 assert.throws(()=>S.validateSave(badResult),/装备制作结算事实异常/);
 for(let n=0;n<30;n++)S.tick(h.s,.1);
 assert.equal(crafted(h.s,id).length,1);assert.equal(JSON.stringify(reload(h.s)),JSON.stringify(h.s));
 console.log(JSON.stringify({source:record.provenance.label,commands:h.counts.commands,saves:h.counts.saves,worldTick:h.s.worldTick,orderId:id,legacyProgress:progress}));
});
