import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {canPay,pay,grant} from '../../../src/simulation/ea-data.mjs';
import {enableServiceResources,resourceBalance,resourceTypes,SERVICE_RESOURCE_VERSION} from '../../../src/simulation/ea-resource-types.mjs';
import {startTransport,cancelTransport,carriedStockpile,stockpileReceiptPreview,initEconomy,enableWarehouseServiceStorage,WAREHOUSE_SERVICE_STORAGE} from '../../../src/simulation/ea-sr-economy.mjs';
const copy=s=>JSON.parse(JSON.stringify(s)),HOME='stockpile:yunxiu';
const fixture=()=>SIM.validateSave(copy(SIM.initial({sr:true})));

const roundtrip=s=>{const before=JSON.stringify(s),restored=SIM.validateSave(copy(s));assert.equal(JSON.stringify(s),before);assert.deepEqual(copy(restored),copy(s));return restored;};
// Isolated resource-contract fixtures; supplied amounts are not gameplay funding.
test('old seven-resource saves remain byte-stable and reject service goods before activation',()=>{
 const s=fixture(),before=JSON.stringify(s);
 assert.equal(Object.keys(resourceTypes(s)).length,7);roundtrip(s);
 assert.equal(canPay(s,{cleanWater:0}),false);assert.throws(()=>grant(s,{cleanWater:3}));
 assert.throws(()=>pay(s,{cleanWater:0}));assert.equal(JSON.stringify(s),before);
 const bad=copy(s);bad.stockpilesById[HOME].resources.cleanWater=0;assert.throws(()=>SIM.validateSave(bad));
});
test('explicit service activation adds only a versioned fact; optional quantities read zero without writing',()=>{
 const s=fixture(),stocks=copy(s.stockpilesById),clock=s.worldTick,seed=s.sim.seed;
 assert.equal(enableServiceResources(s),true);assert.deepEqual(copy(s.stockpilesById),stocks);
 const before=JSON.stringify(s);assert.equal(resourceBalance(s,s.resources,'meal'),0);assert.equal(resourceBalance(s,s.resources,'cleanWater'),0);
 assert.equal(enableServiceResources(s),false);assert.equal(JSON.stringify(s),before);assert.equal(s.worldTick,clock);assert.equal(s.sim.seed,seed);roundtrip(s);
});
test('service quantities share payment and income/expense records and survive exact restore',()=>{
 let s=fixture();enableServiceResources(s);grant(s,{cleanWater:6,meal:10});pay(s,{cleanWater:2,meal:3});
 assert.equal(s.resources.cleanWater,4);assert.equal(s.resources.meal,7);assert.equal(s.economy.income.cleanWater,6);assert.equal(s.economy.expense.cleanWater,2);
 s=roundtrip(s);const before=JSON.stringify(s);assert.equal(canPay(s,{cleanWater:5}),false);assert.throws(()=>pay(s,{cleanWater:5}));
 assert.throws(()=>grant(s,{meal:1,unregisteredGood:1}));assert.equal(JSON.stringify(s),before);
});
test('service transport reserves real stock, restores its in-flight order and refunds only once',()=>{
 let s=fixture();s.master.wound=0;enableServiceResources(s);grant(s,{cleanWater:8});const target=carriedStockpile(s),before=s.resources.cleanWater;
 const receipt=stockpileReceiptPreview(s,target,{cleanWater:5});assert.equal(receipt.available,true);assert(receipt.maximumByResource.cleanWater>=5);
 const {id}=startTransport(s,HOME,target,'person:master',{cleanWater:5});assert.equal(s.resources.cleanWater,before-5);assert.equal(s.stockpilesById[target].resources.cleanWater??0,0);
 s=roundtrip(s);assert.deepEqual(s.workOrdersById[id].cargo,{cleanWater:5});cancelTransport(s,id);assert.equal(s.resources.cleanWater,before);
 const after=JSON.stringify(s);assert.throws(()=>cancelTransport(s,id));assert.equal(JSON.stringify(s),after);roundtrip(s);
});
test('unknown versions, invalid activation facts, missing base keys and invalid new quantities are rejected',()=>{
 const s=fixture();enableServiceResources(s);
 const cases=[x=>x.serviceResources.version='service-resources:yunxiu:v2',x=>x.serviceResources.enabledAtTick++,x=>delete x.factsById[x.serviceResources.originFactId],x=>delete x.stockpilesById[HOME].resources.food,x=>x.stockpilesById[HOME].resources.cleanWater=-1,x=>x.stockpilesById[HOME].resources.cleanWater=Infinity,x=>x.stockpilesById[HOME].resources.other=1];
 for(const mutate of cases){const bad=copy(s);mutate(bad);assert.throws(()=>SIM.validateSave(bad));}
 assert.equal(s.serviceResources.version,SERVICE_RESOURCE_VERSION);roundtrip(s);
});

function warehouseFixture(){
 const s=fixture();enableServiceResources(s);const original=s.buildingsById['building:yunxiu:1'];
 const building={...original,id:2,instanceId:'building:yunxiu:2',type:'warehouse',x:20,y:60,transform:{x:20,y:60,orientation:'south'},prefabId:'prefab:warehouse:units:v1'};
 s.buildingsById[building.instanceId]=building;s.nextId=3;s.spatial.geometryRevision++;initEconomy(s);
 return {s,stockId:`stockpile:${building.instanceId}`};
}

test('actual service delivery credits only after physical arrival and preserves its finished fact',()=>{
 let s=fixture();s.master.wound=0;enableServiceResources(s);grant(s,{cleanWater:8});const target=carriedStockpile(s);
 const {id}=startTransport(s,HOME,target,'person:master',{cleanWater:5});assert.equal(s.stockpilesById[target].resources.cleanWater??0,0);
 for(let i=0;i<1000&&s.workOrdersById[id].phase!=='delivered';i++)SIM.tick(s,.1);
 assert.equal(s.workOrdersById[id].phase,'delivered');assert.equal(s.resources.cleanWater,3);assert.equal(s.stockpilesById[target].resources.cleanWater,5);
 s=roundtrip(s);const fact=s.factsById[`fact:transport:${id}`];assert.deepEqual(fact.quantities,{cleanWater:5});
});

test('warehouse service layout is explicit, preserves inventory and enforces water capacity',()=>{
 let {s,stockId}=warehouseFixture();const stock=s.stockpilesById[stockId],before=copy(stock.resources);
 const old=stockpileReceiptPreview(s,stockId,{cleanWater:1});assert.equal(old.available,false);assert.equal(old.maximumByResource.cleanWater,0);
 assert.equal(enableWarehouseServiceStorage(s,stockId).alreadyEnabled,false);assert.deepEqual(copy(stock.resources),before);assert.equal(stock.storageVersion,WAREHOUSE_SERVICE_STORAGE.version);
 assert.equal(stockpileReceiptPreview(s,stockId,{cleanWater:201}).available,false);assert.equal(stockpileReceiptPreview(s,stockId,{cleanWater:200}).available,true);
 const text=JSON.stringify(s);assert.equal(enableWarehouseServiceStorage(s,stockId).alreadyEnabled,true);assert.equal(JSON.stringify(s),text);s=roundtrip(s);
 const bad=copy(s);delete bad.factsById[bad.stockpilesById[stockId].storageUpgradeFactId];assert.throws(()=>SIM.validateSave(bad));
 const downgraded=copy(s);downgraded.stockpilesById[stockId].storageVersion='warehouse-storage:v1';delete downgraded.stockpilesById[stockId].storageUpgradeFactId;assert.throws(()=>SIM.validateSave(downgraded),/划库事实与当前版本不符/);
 const early=copy(s);early.worldTick=1;early.serviceResources.enabledAtTick=1;early.factsById[early.serviceResources.originFactId].atTick=1;assert.throws(()=>SIM.validateSave(early),/生活物资库位版本或事实异常/);
});

test('overfilled old grain category rejects service conversion without moving or deleting goods',()=>{
 const {s,stockId}=warehouseFixture();s.stockpilesById[stockId].resources.food=500;roundtrip(s);
 const before=JSON.stringify(s);assert.throws(()=>enableWarehouseServiceStorage(s,stockId));assert.equal(JSON.stringify(s),before);
});
