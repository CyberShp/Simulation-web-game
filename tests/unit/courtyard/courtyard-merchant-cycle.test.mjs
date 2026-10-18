import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {tickEconomy} from '../../../src/simulation/ea-sr-economy.mjs';

const MERCHANT='person:merchant-qingxi',MARKET='stockpile:qingxi',SUPPLIER='stockpile:qingxi-supplier';
const copy=x=>JSON.parse(JSON.stringify(x));
function restored(s){const raw=JSON.stringify(s),loaded=SIM.validateSave(JSON.parse(raw));assert.ok(JSON.stringify(loaded)===raw,'canonical save restores exactly');return loaded;}
function until(s,predicate,limit=6000){for(let n=0;n<limit&&!predicate(s);n++)SIM.tick(s,.1);assert(predicate(s));}
// Directed finite-source rule fixtures. Continuous normal funding is recorded
// separately by courtyard-residential-funding-public.mjs from its original save.
function exhaustedSource(){
 const s=SIM.validateSave(SIM.initial({sr:true,mountainOpening:true,seed:618033})),e=s.srEconomy;
 for(const key of Object.keys(e.marketSupplyMigration.oldRemaining))e.marketSupplyMigration.oldRemaining[key]=0;
 s.factsById['fact:market-supply-migration:v1'].quantities=copy(e.marketSupplyMigration.oldRemaining);
 for(const key of Object.keys(s.stockpilesById[SUPPLIER].resources))s.stockpilesById[SUPPLIER].resources[key]=0;
 e.marketInsightSource.balance=0;
 return restored(s);
}

test('finite upstream exhaustion preserves a merchant second actual visit, cargo and exact journey reload',()=>{
 let s=exhaustedSource();const initial=copy(s.stockpilesById[MARKET].resources),identity=s.personsById[MERCHANT].id;
 until(s,x=>x.personsById[MERCHANT].courtyardVisit?.phase==='present');
 const first=s.srEconomy.merchantArrivalTick;
 until(s,x=>x.srEconomy.merchantSchedulePhase==='market');
 const raw=JSON.stringify(s);s=restored(s);assert.equal(JSON.stringify(s),raw,'read keeps the expired saved window');
 SIM.tick(s,.1);assert.equal(s.srEconomy.merchantArrivalTick,first+2400);
 const scheduled=s.srEconomy.merchantArrivalTick;
 until(s,x=>x.srEconomy.merchantSchedulePhase==='arriving'&&x.personsById[MERCHANT].position.kind==='worldTravel');
 const travel=s.travelsById[s.srEconomy.merchantJourneyId];
 assert.equal(travel.durationTicks,300);assert.equal(travel.startedTick,scheduled-300);assert(travel.progressTicks<=1);
 s=restored(s);const before=JSON.stringify(s);tickEconomy(s);assert.equal(JSON.stringify(s),before,'same world step cannot advance the journey twice');
 const twin=restored(s);
 for(let n=0;n<600&&s.personsById[MERCHANT].courtyardVisit?.phase!=='present';n++){SIM.tick(s,.1);SIM.tick(twin,.1);}
 assert.equal(JSON.stringify(s),JSON.stringify(twin));
 const p=s.personsById[MERCHANT];assert.equal(p.courtyardVisit.phase,'present');assert.equal(p.id,identity);
 assert(s.srEconomy.merchantArrivalTick>=scheduled,'road walking follows the complete world journey');
 assert.equal(s.srEconomy.merchantVisitEndsTick-s.srEconomy.merchantArrivalTick,900);
 assert.deepEqual(s.stockpilesById[MARKET].resources,initial);assert.equal(Object.keys(s.srEconomy.marketSupply.runs).length,0);
 assert.match(s.srEconomy.marketSupply.lastReason,/已用尽/);restored(s);
});

test('a merchant with no cash or goods gains no replenishment from elapsed visit cycles',()=>{
 const s=exhaustedSource(),stock=s.stockpilesById[MARKET];for(const key of Object.keys(stock.resources))stock.resources[key]=0;
 until(s,x=>x.srEconomy.merchantSchedulePhase==='market');const window=[s.srEconomy.merchantArrivalTick,s.srEconomy.merchantVisitEndsTick];
 for(let n=0;n<5000;n++)SIM.tick(s,.1);
 assert.deepEqual(Object.values(stock.resources),Object.values(stock.resources).map(()=>0));
 assert.deepEqual([s.srEconomy.merchantArrivalTick,s.srEconomy.merchantVisitEndsTick],window);
 assert.equal(s.srEconomy.merchantSchedulePhase,'market');assert.equal(Object.keys(s.srEconomy.marketSupply.runs).length,0);restored(s);
});

test('a real supplier quote reserves finite goods without changing an independently scheduled visit',()=>{
 const s=SIM.validateSave(SIM.initial({sr:true,seed:618033})),e=s.srEconomy;
 e.merchantSchedulePhase='market';e.merchantArrivalTick=1200;e.merchantVisitEndsTick=2100;e.nextMarketSourceQuoteTick=0;
 const before=copy(s.stockpilesById[SUPPLIER].resources),cash=s.stockpilesById[MARKET].resources.jade;
 SIM.tick(s,.1);
 assert.equal(e.merchantArrivalTick,1200);assert.equal(e.merchantVisitEndsTick,2100);
 assert(Object.keys(e.marketSupply.runs).length>0);assert(s.stockpilesById[MARKET].resources.jade<cash);
 assert(s.stockpilesById[SUPPLIER].resources.food<before.food);
 const raw=JSON.stringify(s);tickEconomy(s);assert.equal(JSON.stringify(s),raw);restored(s);
});
