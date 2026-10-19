import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {tickEconomy,localMarketQuote} from '../../../src/simulation/ea-sr-economy.mjs';
import {visibleBodyPointClear,meterCanStand} from '../../../src/simulation/ea-sr-spatial.mjs';
import {scenicFindPath,scenicDistance} from '../../../src/simulation/ea-scenic.mjs';

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

test('a public click by the northern merchant resolves to legal visible ground and funds a real sale',()=>{
 let s=SIM.validateSave(copy(seed.state));
 const command=(name,...args)=>{const r=SIM.dispatchCommand(s,{name,args});s=r.state;return r.result;};
 const wait=predicate=>{for(let n=0;n<10000&&!predicate();n++)SIM.tick(s,.1);assert(predicate());};
 command('enableCourtyardTerrain');command('enableNorthLibrary');
 const HOME='stockpile:yunxiu',CARRIED='stockpile:carried:master';
 for(let i=0;i<2;i++){command('startMasterHarvest','wood');wait(()=>!s.master.activityId);}
 const woodOrder=command('startTransport',CARRIED,HOME,'person:master',{wood:24});
 wait(()=>s.workOrdersById[woodOrder.id]?.phase==='delivered');
 command('startMasterHarvest','stone');wait(()=>!s.master.activityId);
 const present=()=>{const p=s.personsById[MERCHANT];return p.position?.sceneId==='scene:yunxiu-courtyard'&&(!p.courtyardVisit||p.courtyardVisit.phase==='present');};
 wait(present);
 const merchant={...s.personsById[MERCHANT].position},before=copy({activities:s.activitiesById,reservations:s.reservationsById,workOrders:s.workOrdersById});
 assert.equal(command('moveScenicMaster',merchant.x+1,merchant.y),true);
 const start={x:s.master.scenic.x,y:s.master.scenic.y},planned=s.master.scenic.path.map(point=>({...point}));
 assert.ok(planned.length>0);
 if(!visibleBodyPointClear(s,start)){
  assert.equal(visibleBodyPointClear(s,planned[0]),true,'the recovery lands on visible ground');
  assert.ok(Math.hypot(planned[0].x-start.x,planned[0].y-start.y)<=8,'the recovery prefix stays bounded');
 }
 // The inherited harvest stance is off visible ground, so the walk starts with
 // one short recovery landing. Every 5 cm sample after the first legal one must
 // keep the full measured body, including samples inside each tick's segment.
 let previous={x:s.master.scenic.x,y:s.master.scenic.y},seenLegal=visibleBodyPointClear(s,previous),illegalAfterLegal=0,samples=0;
 const segmentSamples=(a,b)=>{const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.05)),out=[];for(let i=1;i<=count;i++)out.push({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count});return out;};
 for(let n=0;n<10000&&s.master.scenic.path.length;n++){
  SIM.tick(s,.1);
  const current={x:s.master.scenic.x,y:s.master.scenic.y};
  for(const sample of segmentSamples(previous,current)){samples++;if(visibleBodyPointClear(s,sample))seenLegal=true;else if(seenLegal)illegalAfterLegal++;}
  previous=current;
 }
 assert.equal(s.master.scenic.path.length,0);
 assert.equal(seenLegal,true,'the walk reaches visible ground');
 assert.equal(illegalAfterLegal,0,'after the first legal sample every 5 cm keeps the measured body');
 assert.ok(samples>100);
 const feet={x:s.master.scenic.x,y:s.master.scenic.y};
 assert.ok(Math.hypot(feet.x-s.master.scenic.goal.x,feet.y-s.master.scenic.goal.y)<.001,'the walk ends at its accepted landing');
 assert.equal(visibleBodyPointClear(s,feet),true,'the arrived feet keep the measured outdoor body');
 assert.equal(meterCanStand(s,feet),true);
 assert.ok(Math.hypot(merchant.x-feet.x,merchant.y-feet.y)>=.53,'the merchant body stays a real collision');
 const route=scenicFindPath(s,feet,merchant,{maxSnap:0});assert.ok(route,'the merchant is conversation-reachable');
 let length=0,stepFrom=feet;for(const point of route){length+=scenicDistance(stepFrom,point);stepFrom=point;}
 assert.ok(length<3,'the real approach stays inside the three-metre talk rule');
 const quote=localMarketQuote(s,{resource:'stone',side:'sell',batches:1,stockpileId:CARRIED});
 assert.equal(quote.available,true,quote.reason);
 const stone=s.stockpilesById[CARRIED].resources.stone,jade=s.stockpilesById[CARRIED].resources.jade,marketStone=s.stockpilesById[MARKET].resources.stone;
 const trade=command('marketTrade','stone','sell',1,{stockpileId:CARRIED});
 assert.equal(s.stockpilesById[CARRIED].resources.stone,stone-10);assert.equal(s.stockpilesById[MARKET].resources.stone,marketStone+10);
 assert.equal(s.stockpilesById[CARRIED].resources.jade,jade+trade.price);
 assert.deepEqual(copy({activities:s.activitiesById,reservations:s.reservationsById,workOrders:s.workOrdersById}),before,'the approach adds no body or reservation fact');
 restored(s);
});
