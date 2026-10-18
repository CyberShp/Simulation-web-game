import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {SERVICE_WATER_SOURCE} from '../../../src/simulation/ea-service-trade.mjs';
import {enableServiceSupplies,marketGoods,localMarketGoods,localMarketQuote,viewEconomy,merchantPresent,tickEconomy} from '../../../src/simulation/ea-sr-economy.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const SOURCE=SERVICE_WATER_SOURCE.stockpileId,MARKET='stockpile:qingxi',CARRIED='stockpile:carried:master',HOME='stockpile:yunxiu';
function restored(s){const raw=JSON.stringify(s),next=SIM.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(next),raw,'exact save/load');return next;}
const act=(s,name,...args)=>SIM.dispatchCommand(s,{name,args}).state;
function until(s,condition,max=6000){for(let n=0;n<max&&!condition(s);n++)SIM.tick(s,.1);assert(condition(s));}
const waterTotal=s=>Object.values(s.stockpilesById).reduce((n,stock)=>n+(stock.resources.cleanWater||0),0);
// Directed transport fixtures isolate service cargo from the existing five goods;
// their initial quantities and visit schedule are not a normal funding record.
function sourceFixture(){
 const s=SIM.validateSave(SIM.initial({sr:true,seed:618033})),e=s.srEconomy;
 for(const key of Object.keys(e.marketSupplyMigration.oldRemaining))e.marketSupplyMigration.oldRemaining[key]=0;
 s.factsById['fact:market-supply-migration:v1'].quantities=copy(e.marketSupplyMigration.oldRemaining);
 for(const key of Object.keys(s.stockpilesById[SOURCE].resources))s.stockpilesById[SOURCE].resources[key]=0;
 e.marketInsightSource.balance=0;e.merchantSchedulePhase='market';e.merchantArrivalTick=5000;e.merchantVisitEndsTick=5900;e.nextMarketSourceQuoteTick=0;
 return restored(s);
}
test('formal service supply enable declares water once at its supplier and preserves player cargo and time',()=>{
 let s=SIM.validateSave(SIM.initial({sr:true,seed:618033}));
 assert.equal(marketGoods(s).cleanWater,undefined);assert(!localMarketGoods(s).includes('cleanWater'));
 const home=copy(s.stockpilesById[HOME].resources),merchant=copy(s.stockpilesById[MARKET].resources),tick=s.worldTick,rng=s.rng;
 s=act(s,'enableServiceSupplies');assert.equal(waterTotal(s),320);assert.equal(s.stockpilesById[SOURCE].resources.cleanWater,320);
 assert.deepEqual(s.stockpilesById[HOME].resources,home);assert.deepEqual(s.stockpilesById[MARKET].resources,merchant);assert.equal(s.worldTick,tick);assert.deepEqual(s.rng,rng);
 assert.deepEqual(marketGoods(s).cleanWater,{name:'洁水',buy:8,sell:3});
 const raw=JSON.stringify(s);for(let n=0;n<4;n++){localMarketGoods(s);viewEconomy(s);localMarketQuote(s,{resource:'cleanWater',side:'buy',stockpileId:CARRIED});}assert.equal(JSON.stringify(s),raw);
 const receipt=enableServiceSupplies(s);assert(receipt.alreadyEnabled);assert.equal(JSON.stringify(s),raw);restored(s);
});
test('supplier water is reserved, physically purchased and delivered with exact in-transit recovery',()=>{
 let s=act(sourceFixture(),'enableServiceSupplies');const beforeCash=s.stockpilesById[MARKET].resources.jade;
 SIM.tick(s,.1);const id=s.srEconomy.marketSupply.activeRunId,run=s.srEconomy.marketSupply.runs[id];
 assert.deepEqual(run.cargo,{cleanWater:20});assert.equal(run.price,6);assert.equal(s.stockpilesById[MARKET].resources.cleanWater,undefined);assert.equal(s.stockpilesById[SOURCE].resources.cleanWater,300);
 assert.equal(viewEconomy(s).market.supply.inTransit.cleanWater,20);assert.equal(waterTotal(s),320);s=restored(s);
 until(s,x=>x.srEconomy.marketSupply.runs[id].phase==='returning');assert.equal(s.stockpilesById[MARKET].resources.cleanWater,undefined);assert.equal(waterTotal(s),320);s=restored(s);
 const duplicate=JSON.stringify(s);tickEconomy(s);assert.equal(JSON.stringify(s),duplicate);
 until(s,x=>x.srEconomy.marketSupply.runs[id].phase==='completed');assert.equal(s.stockpilesById[MARKET].resources.cleanWater,20);assert.equal(s.stockpilesById[MARKET].resources.jade,beforeCash-8);assert.equal(waterTotal(s),320);restored(s);
});
test('blocked water supply keeps finite reserved cargo and resumes its remaining route',()=>{
 let s=act(sourceFixture(),'enableServiceSupplies');SIM.tick(s,.1);const id=s.srEconomy.marketSupply.activeRunId;
 const route=s.routesById['route:valley-market'],condition=route.condition;route.condition='blocked';
 for(let i=0;i<15;i++)SIM.tick(s,.1);const run=s.srEconomy.marketSupply.runs[id];assert.equal(s.travelsById[run.travelId].status,'blocked');assert.equal(waterTotal(s),320);assert.equal(s.stockpilesById[MARKET].resources.cleanWater,undefined);s=restored(s);
 s.routesById['route:valley-market'].condition=condition;until(s,x=>x.srEconomy.marketSupply.runs[id].phase==='completed');assert.equal(waterTotal(s),320);restored(s);
});
test('invalid or missing water origin and surplus supplier water reject without repairing the source save',()=>{
 const source=act(sourceFixture(),'enableServiceSupplies');
 for(const mutate of [s=>delete s.srEconomy.serviceTrade,s=>delete s.factsById[SERVICE_WATER_SOURCE.factId],s=>s.factsById[SERVICE_WATER_SOURCE.factId].quantity++,s=>s.stockpilesById[SOURCE].resources.cleanWater++,s=>s.srEconomy.serviceTrade.enabledAtTick++]){
  const invalid=copy(source);mutate(invalid);const raw=JSON.stringify(invalid);assert.throws(()=>SIM.validateSave(invalid));assert.equal(JSON.stringify(invalid),raw);
 }
 const full=sourceFixture();full.stockpilesById[SOURCE].capacity=300;const raw=JSON.stringify(full);assert.throws(()=>enableServiceSupplies(full),/容量/);assert.equal(JSON.stringify(full),raw);
});
test('water purchase uses actual carried payment and supports sale and exact recovery',()=>{
 // Trade fixture: supplier-origin water is moved into the merchant by a completed
 // real upstream trip; only actor start positions/schedule and starting cash are fixture data.
 let s=act(sourceFixture(),'enableServiceSupplies');SIM.tick(s,.1);const runId=s.srEconomy.marketSupply.activeRunId;
 until(s,x=>x.srEconomy.marketSupply.runs[runId].phase==='completed');s=restored(s);
 const local=SIM.validateSave(copy(seed.state));
 // Use the same scene coordinates as the shipped courtyard merchant fixture.
 const merchant=s.personsById['person:merchant-qingxi'],reference=local.personsById['person:merchant-qingxi'];
 merchant.position=copy(reference.position);merchant.mind.scenic=copy(reference.mind.scenic);if(reference.courtyardVisit)merchant.courtyardVisit=copy(reference.courtyardVisit);else delete merchant.courtyardVisit;s.srEconomy.merchantSchedulePhase='home';s.srEconomy.merchantArrivalTick=s.worldTick;s.srEconomy.merchantVisitEndsTick=s.worldTick+2000;
 s.stockpilesById[MARKET].position=copy(reference.position);s.master.scenic=copy(local.master.scenic);s.master.position=copy(local.master.position);s.master.location=copy(local.master.location);s.master.wound=0;s.master.energy=100;
 s=act(s,'startTransport',HOME,CARRIED,'person:master',{jade:8});const haul=Object.values(s.workOrdersById).find(w=>w.kind==='transport'&&w.phase==='to-source');until(s,x=>x.workOrdersById[haul.id].phase==='delivered');
 s=act(s,'moveScenicMaster',30,13.6);until(s,x=>merchantPresent(x)&&!x.master.scenic.path.length);
 const q=localMarketQuote(s,{resource:'cleanWater',side:'buy',batches:1,stockpileId:CARRIED});assert(q.available,q.reason);assert.equal(q.price,8);const total=waterTotal(s),cash=s.stockpilesById[MARKET].resources.jade;
 s=act(s,'marketTrade','cleanWater','buy',1,{stockpileId:CARRIED});assert.equal(s.stockpilesById[CARRIED].resources.cleanWater,10);assert.equal(s.stockpilesById[CARRIED].resources.jade,0);assert.equal(s.stockpilesById[MARKET].resources.jade,cash+8);assert.equal(waterTotal(s),total);s=restored(s);
 s=act(s,'marketTrade','cleanWater','sell',1,{stockpileId:CARRIED});assert.equal(s.stockpilesById[CARRIED].resources.cleanWater,0);assert.equal(s.stockpilesById[CARRIED].resources.jade,3);assert.equal(waterTotal(s),total);restored(s);
});
