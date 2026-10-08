/** SR-XF-011-AC-01: one real home-to-market order from the normal public opening.
 * Optional native checkpoints are written only to XIANFU_QA_SR011_V2_DIR.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {setRouteConditionSR} from '../dist/ea-sr-world.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';

const ID='artisan_tools';
const HOME='stockpile:yunxiu';
const MERCHANT='stockpile:qingxi';
const PARTY='stockpile:sr-party';
const CARGO='stockpile:market-order:artisan_tools:cargo';
const PAYMENT='stockpile:market-order:artisan_tools:payment';
const FREIGHT='stockpile:market-order:artisan_tools:freight';
const RESERVATION='reservation:market-order:v2:artisan_tools';
const persistence=createEAPersistence({validate:SIM.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr011-v2'});
let prepared;

function publicOpening(){
 if(!prepared){const h=normalOpening();h.resources({wood:20,stone:10,food:5});h.save();prepared=JSON.stringify(h.s);}
 return harness(SIM.validateSave(JSON.parse(prepared)));
}
function stock(h,id){return h.s.stockpilesById[id];}
function state(h){return h.s.srEconomy.orders[ID];}
function accountTotals(h){
 const groups=SIM.viewEconomy(h.s).inventorySummary;
 return Object.fromEntries(groups.map(group=>[group.id,Object.fromEntries(['wood','stone','food','jade'].map(key=>[key,group.amounts[key].total]))]));
}
function scope(h,group,key){return SIM.viewEconomy(h.s).inventorySummary.find(item=>item.id===group).amounts[key];}
function orderPanel(h){return renderSRPanel(h.s,SIM,'production');}
function checkpoint(h,label){
 h.save();const raw=JSON.stringify(h.s),result=persistence.parseImport(persistence.exportState(h.s,{slot:1}));
 assert.equal(result.ok,true,`${label}: native export imports`);
 assert.equal(JSON.stringify(result.state),raw,`${label}: exact state survives native save/load`);
 assert.deepEqual(SIM.viewEconomy(result.state).market.orders.find(o=>o.id===ID),SIM.viewEconomy(h.s).market.orders.find(o=>o.id===ID),`${label}: public order projection survives`);
 const dir=process.env.XIANFU_QA_SR011_V2_DIR;
 if(dir){mkdirSync(resolve(dir),{recursive:true});writeFileSync(resolve(dir,`${label}.json`),JSON.stringify({provenance:{kind:'normal-public-command-checkpoint',label,counts:h.counts},state:h.s}));}
}
function rejected(h,choice,pattern){const before=JSON.stringify(h.s);assert.throws(()=>h.act('marketOrder',ID,choice),pattern);assert.equal(JSON.stringify(h.s),before,`${choice}: rejected public command changes no state`);}
function reserve(h){const quote=h.act('marketOrder',ID,'quote-v2');assert.equal(quote.version,'market-order:v2');assert.deepEqual(quote.cargo,{wood:20,stone:10});assert.deepEqual(quote.payment,{jade:30});assert.deepEqual(quote.routeIds,['route:home-valley','route:valley-market']);assert.equal(quote.foodCost,2);assert.equal(quote.carrierId,'person:master');const before={wood:stock(h,HOME).resources.wood,stone:stock(h,HOME).resources.stone,food:stock(h,HOME).resources.food,jade:stock(h,MERCHANT).resources.jade};const accepted=h.act('marketOrder',ID,'accept-v2');assert.equal(accepted.phase,'accepted');assert.equal(stock(h,HOME).resources.wood,before.wood-20);assert.equal(stock(h,HOME).resources.stone,before.stone-10);assert.equal(stock(h,HOME).resources.food,before.food-2);assert.equal(stock(h,MERCHANT).resources.jade,before.jade-30);assert.deepEqual({wood:stock(h,CARGO).resources.wood,stone:stock(h,CARGO).resources.stone},{wood:20,stone:10});assert.equal(stock(h,PAYMENT).resources.jade,30);assert.equal(stock(h,FREIGHT).resources.food,2);assert.equal(stock(h,CARGO).ownerId,'person:master');assert.equal(stock(h,PAYMENT).ownerId,'person:merchant-qingxi');assert.equal(stock(h,FREIGHT).ownerId,'person:master');assert(h.s.reservationsById[RESERVATION]);return {quote,before};}

test('public order reserves three located holdings, follows actual two-leg travel, settles once and reloads exactly',()=>{
 const h=publicOpening(),initialQuote=SIM.viewEconomy(h.s).market.orders.find(o=>o.id===ID).quoteV2,openingAccounts=accountTotals(h);
 assert(initialQuote,'public economy projection exposes the source-backed offer');
 assert.match(orderPanel(h),/百工用材[\s\S]*?接下跨场景委托/,'the player can take the quoted cross-scene order');
 const projectionBefore=JSON.stringify(h.s);SIM.viewEconomy(h.s);assert.equal(JSON.stringify(h.s),projectionBefore,'quote projection does not advance the clock or state');
 rejected(h,'deliver-v2',/先接单/);
 const {quote,before}=reserve(h);assert.deepEqual(accountTotals(h),openingAccounts,'reserving public goods and merchant money preserves every ownership total');assert.equal(scope(h,'public','wood').reserved>=20,true);assert.equal(scope(h,'public','stone').reserved>=10,true);assert.equal(scope(h,'public','food').reserved>=2,true);assert.equal(scope(h,'merchant','jade').reserved>=30,true);assert.equal(stock(h,CARGO).access,'public');assert.equal(stock(h,FREIGHT).access,'public');checkpoint(h,'accepted');
 assert.match(orderPanel(h),/百工用材[\s\S]*?到公库实际取货/);
 for(const id of [CARGO,PAYMENT,FREIGHT])assert.equal(SIM.viewEconomy(h.s).stockpiles.find(p=>p.id===id)?.orderReserved,true);
 assert.doesNotMatch(orderPanel(h),/<option value="stockpile:market-order:artisan_tools:/,'reserved holdings are absent from ordinary stock selectors');
 const isolated=JSON.stringify(h.s);
 assert.throws(()=>h.act('startTransport',CARGO,HOME,'person:master',{wood:1}),/商单预留/);
 assert.throws(()=>h.act('startTransport',HOME,CARGO,'person:master',{wood:1}),/商单预留/);
 assert.throws(()=>h.act('transferProperty',CARGO,HOME,'wood',1),/商单预留/);
 assert.throws(()=>h.act('transferProperty',HOME,CARGO,'wood',1),/商单预留/);
 assert.equal(JSON.stringify(h.s),isolated,'ordinary logistics cannot borrow or fill active order reserves');
 rejected(h,'accept-v2',/已有约定/);rejected(h,'deliver-v2',/双方须/);
 h.act('marketOrder',ID,'pickup-v2');assert.equal(stock(h,CARGO).carrierId,'person:master');assert.equal(stock(h,FREIGHT).carrierId,'person:master');assert.equal(stock(h,CARGO).access,'public');assert.equal(stock(h,FREIGHT).access,'public');assert.deepEqual(accountTotals(h),openingAccounts);checkpoint(h,'picked-up');
 assert.match(orderPanel(h),/百工用材[\s\S]*?携货出发去青溪/);
 const partyBefore=stock(h,PARTY)?.resources?JSON.stringify(stock(h,PARTY).resources):null;
 const departed=h.act('marketOrder',ID,'depart-v2');
 assert.equal(departed.phase,'in_transit');assert.equal(departed.carrierId,'person:master');assert.equal(departed.travelId,h.s.srWorld.activeTravelId);assert.deepEqual(h.s.travelsById[departed.travelId].loadedCargo,{},'order journey cannot load default public cargo');
 assert.equal(partyBefore,null,'the general party bag does not exist before the first trip');
 assert.deepEqual(h.s.travelsById[departed.travelId].loadedCargo,{},'the newly created party bag receives no default cargo');
 assert(Object.values(stock(h,PARTY).resources).every(quantity=>quantity===0),'the general party bag stays empty until a real transfer');
 assert.equal(stock(h,HOME).resources.food,before.food-2,'world travel payer has zero net change at departure beyond original reserve');
 assert.equal(stock(h,FREIGHT).resources.food,2,'no road food is consumed before a segment completes');checkpoint(h,'departed');
 assert.match(orderPanel(h),/百工用材[\s\S]*?实际承运途中/);
 rejected(h,'depart-v2',/先由具名承运人/);
 h.until(s=>s.srEconomy.orders[ID].chargedSegments===1,'first actual route segment',150);
 assert.equal(stock(h,FREIGHT).resources.food,1);assert.equal(stock(h,HOME).resources.food,before.food-2);assert.equal(stock(h,CARGO).position.travelId,departed.travelId);checkpoint(h,'first-leg');
 h.until(s=>!s.srWorld.activeTravelId,'market arrival',300);h.until(s=>s.srEconomy.orders[ID].phase==='delivered','order arrival sync',3);
 assert.equal(state(h).chargedSegments,2);assert.equal(stock(h,FREIGHT).resources.food,0);assert.equal(stock(h,CARGO).position.sceneId,'scene:market');checkpoint(h,'market-arrived');
 assert.match(orderPanel(h),/百工用材[\s\S]*?当面验货收款/);
 rejected(h,'deliver-v2',/双方须/);
 h.worldWalk(37,25);assert.equal(SIM.viewEconomy(h.s).market.merchantPresent,true,'master meets the same identified merchant');
 h.until(s=>s.worldTick>=quote.earliestDeliverTick,'earliest receipt time',500);
 checkpoint(h,'merchant-near-before-delivery');
 const beforeSettle={jade:stock(h,CARGO).resources.jade,merchantWood:stock(h,MERCHANT).resources.wood,merchantStone:stock(h,MERCHANT).resources.stone,rep:h.s.sect.reputation};
 const complete=h.act('marketOrder',ID,'deliver-v2');assert.equal(complete.phase,'completed');assert.equal(stock(h,CARGO).resources.wood,0);assert.equal(stock(h,CARGO).resources.stone,0);assert.equal(stock(h,PAYMENT).resources.jade,0);assert.equal(stock(h,CARGO).resources.jade,beforeSettle.jade+30);assert.equal(stock(h,MERCHANT).resources.wood,beforeSettle.merchantWood+20);assert.equal(stock(h,MERCHANT).resources.stone,beforeSettle.merchantStone+10);assert.equal(stock(h,CARGO).access,'public');assert.equal(stock(h,CARGO).resources.food,0);assert.equal(scope(h,'public','jade').total,openingAccounts.public.jade+30);assert.deepEqual(accountTotals(h).personal,openingAccounts.personal);assert.equal(h.s.sect.reputation,beforeSettle.rep+2);assert.equal(h.s.reservationsById[RESERVATION],undefined);assert.equal(Object.keys(h.s.factsById).filter(id=>id==='fact:order-v2:complete:artisan_tools').length,1);checkpoint(h,'completed');
 assert.match(orderPanel(h),/订单交付 · 百工用材 · 交付 灵木 20 · 青石 10 · 收款 灵石 30 · 名声\+2/);
 rejected(h,'deliver-v2',/已经结束/);rejected(h,'cancel-v2',/已经结束/);
});

test('explicit public-receipt allocation funds market food and a real return without automatic ownership change',()=>{
 const h=publicOpening(),opening=accountTotals(h),regionalCash=()=>stock(h,MERCHANT).resources.jade+stock(h,'stockpile:qingxi-supplier-wallet').resources.jade+stock(h,'stockpile:chizhang-market-toll').resources.jade,openingRegionalCash=regionalCash();
 reserve(h);h.act('marketOrder',ID,'pickup-v2');h.act('marketOrder',ID,'depart-v2');
 h.until(s=>!s.srWorld.activeTravelId,'market arrival',300);h.until(s=>state({s}).phase==='delivered','order arrival',3);
 h.worldWalk(37,25);h.until(s=>s.worldTick>=state({s}).quote.earliestDeliverTick,'delivery time',500);
 h.act('marketOrder',ID,'deliver-v2');
 assert.equal(stock(h,CARGO).resources.jade,30);assert.equal(stock(h,PARTY).resources.jade,0);assert.equal(stock(h,PARTY).resources.food,0);
 assert.equal(scope(h,'public','jade').total,opening.public.jade+30);assert.equal(scope(h,'personal','jade').total,opening.personal.jade);
 const card=orderPanel(h);
 assert.match(card,/本次公款转入掌门私人行囊后，该数额变为掌门私物/);
 assert.match(card,/data-command="transferProperty"[\s\S]*?name="sourceId" value="stockpile:market-order:artisan_tools:cargo"[\s\S]*?name="targetId" value="stockpile:sr-party"[\s\S]*?name="resource" value="jade"/);
 checkpoint(h,'completed-awaiting-explicit-allocation');
 const beforeRemote=JSON.stringify(h.s);
 assert.throws(()=>h.act('transferProperty',HOME,PARTY,'jade',1,'gift'),/同一实际地点/);
 assert.equal(JSON.stringify(h.s),beforeRemote,'market player cannot draw remote home funds');
 const allocation=h.act('transferProperty',CARGO,PARTY,'jade',30,'gift'),fact=h.s.factsById[allocation.id];
 assert.deepEqual({operation:fact.operation,source:fact.sourceStockpileId,target:fact.targetStockpileId,resource:fact.resource,quantity:fact.quantity},{operation:'gift',source:CARGO,target:PARTY,resource:'jade',quantity:30});
 assert.equal(stock(h,CARGO).resources.jade,0);assert.equal(stock(h,PARTY).resources.jade,30);
 assert.equal(scope(h,'public','jade').total,opening.public.jade);assert.equal(scope(h,'personal','jade').total,opening.personal.jade+30);
 assert.doesNotMatch(orderPanel(h),/确认划拨公款/,'the public receipt is exhausted and no allocation form remains');
 const afterAllocation=JSON.stringify(h.s);
 assert.throws(()=>h.act('transferProperty',CARGO,PARTY,'jade',30,'gift'),/可用库存/);
 assert.equal(JSON.stringify(h.s),afterAllocation,'repeat allocation cannot spend the receipt twice');checkpoint(h,'explicitly-allocated');
 const merchantBefore={jade:stock(h,MERCHANT).resources.jade,food:stock(h,MERCHANT).resources.food};
 h.act('marketTrade','food','buy',1);
 assert.equal(stock(h,PARTY).resources.jade,20);assert.equal(stock(h,PARTY).resources.food,10);
 assert.equal(stock(h,MERCHANT).resources.jade,merchantBefore.jade+10);assert.equal(stock(h,MERCHANT).resources.food,merchantBefore.food-10);
 assert.equal(stock(h,CARGO).resources.jade,0);checkpoint(h,'return-food-purchased');
 const trip=h.act('srWorldCommand',{action:'travel',destination:'scene:yunxiu-courtyard'});
 assert.equal(trip.cost.food,2);assert.equal(stock(h,PARTY).resources.food,8);assert.equal(stock(h,CARGO).access,'public');
 h.until(s=>!s.srWorld.activeTravelId,'actual return home',300);
 assert.equal(h.s.master.location.sceneId,'scene:yunxiu-courtyard');assert.equal(stock(h,PARTY).resources.food,8);
 assert.equal(stock(h,PARTY).resources.jade,20);assert.equal(stock(h,CARGO).resources.jade,0);
 assert.equal(regionalCash(),openingRegionalCash-20,'order payment and food purchase preserve actual merchant, supplier and toll holdings');
 checkpoint(h,'returned-after-explicit-allocation');
});

test('public decline and cancellation return each unspent holding once',()=>{
 const declined=publicOpening(),before=JSON.stringify(declined.s.stockpilesById);
 declined.act('marketOrder',ID,'decline-v2');assert.equal(state(declined).phase,'declined');assert.equal(JSON.stringify(declined.s.stockpilesById),before);checkpoint(declined,'declined');rejected(declined,'accept-v2',/已经结束|已有约定/);
 const h=publicOpening(),{before:funds}=reserve(h);checkpoint(h,'cancel-reserved');
 h.act('marketOrder',ID,'cancel-v2');assert.equal(state(h).phase,'cancelled');assert.equal(stock(h,HOME).resources.wood,funds.wood);assert.equal(stock(h,HOME).resources.stone,funds.stone);assert.equal(stock(h,HOME).resources.food,funds.food);assert.equal(stock(h,MERCHANT).resources.jade,funds.jade);assert.equal(stock(h,CARGO).resources.wood,0);assert.equal(stock(h,CARGO).resources.stone,0);assert.equal(stock(h,PAYMENT).resources.jade,0);assert.equal(stock(h,FREIGHT).resources.food,0);checkpoint(h,'cancelled-before-pickup');rejected(h,'cancel-v2',/已经结束/);
 const carried=publicOpening(),{before:carriedFunds}=reserve(carried);carried.act('marketOrder',ID,'pickup-v2');const cargoBefore=JSON.stringify(stock(carried,CARGO).resources);carried.act('marketOrder',ID,'cancel-v2');assert.equal(state(carried).cancelledAfterPickup,true);assert.equal(JSON.stringify(stock(carried,CARGO).resources),cargoBefore,'picked cargo stays with seller at its actual position');assert.equal(stock(carried,PAYMENT).resources.jade,0);assert.equal(stock(carried,FREIGHT).resources.food,2);checkpoint(carried,'cancelled-after-pickup');
 const returnCargo=carried.act('startTransport',CARGO,HOME,'person:master',{wood:20,stone:10});carried.until(s=>s.workOrdersById[returnCargo.id].phase==='delivered','public cargo recovery');
 const returnFreight=carried.act('startTransport',FREIGHT,HOME,'person:master',{food:2});carried.until(s=>s.workOrdersById[returnFreight.id].phase==='delivered','public unused food recovery');
 assert.equal(stock(carried,HOME).resources.wood,carriedFunds.wood);assert.equal(stock(carried,HOME).resources.stone,carriedFunds.stone);assert.equal(stock(carried,HOME).resources.food,carriedFunds.food);checkpoint(carried,'cancelled-publicly-recovered');
 const homeRecovery=publicOpening();reserve(homeRecovery);homeRecovery.act('marketOrder',ID,'pickup-v2');homeRecovery.act('marketOrder',ID,'cancel-v2');
 const homeAccounts=accountTotals(homeRecovery),recovered=homeRecovery.act('marketOrder',ID,'recover-v2');assert.equal(recovered.targetStockpileId,CARGO);assert.deepEqual(accountTotals(homeRecovery),homeAccounts);assert.equal(stock(homeRecovery,CARGO).access,'public');
 assert.deepEqual(recovered.cargo,{wood:20,stone:10});assert.equal(recovered.food,2);
 assert.equal(stock(homeRecovery,CARGO).resources.wood,20);assert.equal(stock(homeRecovery,CARGO).resources.stone,10);
 assert.equal(stock(homeRecovery,CARGO).resources.food,2);checkpoint(homeRecovery,'cancelled-home-direct-recovered');
 rejected(homeRecovery,'recover-v2',/已取回/);
});

test('full source warehouse keeps cancelled goods in same-place seller holdings for public recovery',()=>{
 const h=publicOpening();reserve(h);
 // Warehouse-capacity fixture represents other activity filling the free space
 // after acceptance; no goods, money, person or story state is injected.
 const home=stock(h,HOME);home.capacity=Object.values(home.resources).reduce((n,v)=>n+v,0);
 h.act('marketOrder',ID,'cancel-v2');assert.equal(state(h).cancelledAtSourceRetained,true);assert.equal(stock(h,CARGO).resources.wood,20);assert.equal(stock(h,CARGO).resources.stone,10);assert.equal(stock(h,FREIGHT).resources.food,2);assert.equal(stock(h,CARGO).ownerId,'person:master');assert.equal(stock(h,CARGO).position.sceneId,'scene:yunxiu-courtyard');assert(Object.values(home.resources).reduce((n,v)=>n+v,0)<=home.capacity);checkpoint(h,'cancel-full-source-fixture');
 const target=Object.values(h.s.stockpilesById).find(st=>st.access==='public'&&st.id!==HOME&&st.position?.sceneId==='scene:yunxiu-courtyard'&&st.capacity-Object.values(st.resources).reduce((n,v)=>n+v,0)>=32);
 assert(target,'normal opening has a same-yard public recovery store');
 const cargo=h.act('startTransport',CARGO,target.id,'person:master',{wood:20,stone:10});h.until(s=>s.workOrdersById[cargo.id].phase==='delivered','recovery to alternate same-yard store');
 const freight=h.act('startTransport',FREIGHT,target.id,'person:master',{food:2});h.until(s=>s.workOrdersById[freight.id].phase==='delivered','unused food to alternate same-yard store');
 assert.equal(stock(h,CARGO).resources.wood,0);assert.equal(stock(h,CARGO).resources.stone,0);assert.equal(stock(h,FREIGHT).resources.food,0);checkpoint(h,'cancel-full-source-recovered');
});

test('route break fixture pauses the actual journey and preserves all three holdings through save and recovery',()=>{
 const h=publicOpening();reserve(h);h.act('marketOrder',ID,'pickup-v2');const departed=h.act('marketOrder',ID,'depart-v2');
 h.until(s=>s.travelsById[departed.travelId].progressTicks>=15,'real route progress',30);
 // There is currently no player command to break this road. Only route condition
 // is varied here; all goods, payment, people and trip were earned publicly.
 setRouteConditionSR(h.s,'route:home-valley','blocked');h.until(s=>state({s}).phase==='blocked','blocked order projection',4);
 const paused=h.s.travelsById[departed.travelId].progressTicks,goods=JSON.stringify([stock(h,CARGO).resources,stock(h,PAYMENT).resources,stock(h,FREIGHT).resources]);
 for(let i=0;i<12;i++)SIM.tick(h.s,.1);
 assert.equal(h.s.travelsById[departed.travelId].progressTicks,paused);assert.equal(JSON.stringify([stock(h,CARGO).resources,stock(h,PAYMENT).resources,stock(h,FREIGHT).resources]),goods);checkpoint(h,'route-blocked-fixture');
 setRouteConditionSR(h.s,'route:home-valley','open');h.until(s=>!s.srWorld.activeTravelId,'resumed actual trip',300);h.until(s=>s.srEconomy.orders[ID].phase==='delivered','resumed order arrival',3);assert.equal(state(h).travelId,departed.travelId);assert.equal(state(h).chargedSegments,2);assert.equal(stock(h,FREIGHT).resources.food,0);checkpoint(h,'route-restored-fixture');
});

test('a public return from a blocked journey keeps the same travel ID and recoverable seller goods',()=>{
 const h=publicOpening(),{before}=reserve(h);h.act('marketOrder',ID,'pickup-v2');const departed=h.act('marketOrder',ID,'depart-v2');
 h.until(s=>s.travelsById[departed.travelId].progressTicks>=15,'real outbound steps',30);
 setRouteConditionSR(h.s,'route:home-valley','blocked');h.until(s=>s.srEconomy.orders[ID].phase==='blocked','route block',4);
 const returned=h.act('srWorldCommand',{action:'return'});assert.equal(returned.id,departed.travelId);assert.equal(returned.returning,true);
 h.until(s=>!s.srWorld.activeTravelId,'real return walk',30);assert.equal(h.s.master.location.sceneId,'scene:yunxiu-courtyard');assert.equal(state(h).travelId,departed.travelId);checkpoint(h,'route-returned-fixture');
 h.act('marketOrder',ID,'cancel-v2');assert.equal(state(h).phase,'cancelled');assert.equal(stock(h,CARGO).ownerId,'person:master');assert.equal(stock(h,CARGO).position.sceneId,'scene:yunxiu-courtyard');assert.equal(stock(h,CARGO).resources.wood,20);assert.equal(stock(h,CARGO).resources.stone,10);assert.equal(stock(h,FREIGHT).resources.food,2);assert.equal(stock(h,MERCHANT).resources.jade,before.jade);checkpoint(h,'route-return-cancelled-fixture');
});

test('cancelled cargo at the market stays in a public carried holding after recovery',()=>{
 const h=publicOpening();reserve(h);h.act('marketOrder',ID,'pickup-v2');const departed=h.act('marketOrder',ID,'depart-v2');
 h.until(s=>!s.srWorld.activeTravelId,'market arrival',300);h.until(s=>s.srEconomy.orders[ID].phase==='delivered','order at market',3);
 const bag=stock(h,PARTY),wood=bag.resources.wood,stone=bag.resources.stone;
 h.act('marketOrder',ID,'cancel-v2');assert.equal(state(h).phase,'cancelled');assert.equal(stock(h,CARGO).ownerId,'person:master');checkpoint(h,'market-cancelled');
 assert.match(orderPanel(h),/百工用材[\s\S]*?整理随行公用物资/);
 const outOfReach=JSON.stringify(h.s);
 assert.throws(()=>h.act('startTransport',CARGO,HOME,'person:master',{wood:1}),/跨地点/);
 assert.equal(JSON.stringify(h.s),outOfReach,'public cargo cannot be taken from the market by an on-yard transport command');
 const marketAccounts=accountTotals(h),recovered=h.act('marketOrder',ID,'recover-v2');assert.equal(recovered.targetStockpileId,CARGO);assert.deepEqual(accountTotals(h),marketAccounts);assert.equal(stock(h,CARGO).access,'public');assert.equal(stock(h,FREIGHT).access,'public');assert.deepEqual(recovered.cargo,{wood:20,stone:10});assert.equal(stock(h,PARTY).resources.wood,wood);assert.equal(stock(h,PARTY).resources.stone,stone);assert.equal(stock(h,CARGO).resources.wood,20);assert.equal(stock(h,CARGO).resources.stone,10);assert.equal(stock(h,CARGO).position.sceneId,'scene:market');assert.equal(SIM.viewEconomy(h.s).stockpiles.find(item=>item.id===CARGO).position.sceneId,'scene:market');checkpoint(h,'market-public-recovered');rejected(h,'recover-v2',/已取回/);
 assert.match(orderPanel(h),/公用货物与剩余口粮已整理到同一随行货位/);
 assert.doesNotMatch(orderPanel(h),/整理随行公用物资/);
 assert.equal(state(h).travelId,departed.travelId);
 h.worldWalk(33,27);const carried=SIM.viewEconomy(h.s).stockpiles.find(item=>item.id===CARGO);assert.equal(carried.position.sceneId,'scene:market');assert.equal(carried.position.x,h.s.master.location.x);assert.equal(carried.position.y,h.s.master.location.y);checkpoint(h,'market-public-carried');
});

test('failed world departure leaves the home payer and reserved freight byte-for-byte unchanged',()=>{
 const h=publicOpening();reserve(h);h.act('marketOrder',ID,'pickup-v2');checkpoint(h,'failed-departure-before');
 // Body-energy fixture reaches the travelSR rejection after the order has
 // supplied its already-reserved fee to the normal world payer.
 h.s.master.energy=0;const before=JSON.stringify(h.s),home=JSON.stringify(stock(h,HOME).resources),freight=JSON.stringify(stock(h,FREIGHT).resources);
 rejected(h,'depart-v2',/出行需精力/);
 assert.equal(JSON.stringify(h.s),before);assert.equal(JSON.stringify(stock(h,HOME).resources),home);assert.equal(JSON.stringify(stock(h,FREIGHT).resources),freight);checkpoint(h,'failed-departure-after');
});

test('previous v2 active save restores public access once without changing quantities',()=>{
 const h=publicOpening();reserve(h);
 const prior=JSON.parse(JSON.stringify(h.s));
 delete prior.srEconomy.orders[ID].accessVersion;
 prior.stockpilesById[CARGO].access='private';prior.stockpilesById[FREIGHT].access='private';
 const quantities=Object.fromEntries([HOME,CARGO,PAYMENT,FREIGHT,MERCHANT].map(id=>[id,JSON.stringify(prior.stockpilesById[id].resources)]));
 const oldTick=prior.worldTick,loaded=SIM.validateSave(prior),restored=harness(loaded);
 assert.equal(loaded.worldTick,oldTick);assert.equal(stock(restored,CARGO).access,'public');assert.equal(stock(restored,FREIGHT).access,'public');
 assert.equal(state(restored).accessVersion,'source-access:v1');assert(loaded.factsById[`fact:order-v2:access-migration:${ID}`]);
 for(const [id,balance] of Object.entries(quantities))assert.equal(JSON.stringify(stock(restored,id).resources),balance);
 const raw=JSON.stringify(loaded);assert.equal(JSON.stringify(SIM.validateSave(JSON.parse(raw))),raw,'repeat import does not migrate again');
 restored.act('marketOrder',ID,'cancel-v2');assert.equal(stock(restored,HOME).resources.wood,stock(h,HOME).resources.wood+20);checkpoint(restored,'previous-v2-public-cancel');
});

test('public order cargo follows its named carrier home and can return to the original public store',()=>{
 const h=publicOpening();h.resources({food:15});
 h.travel('scene:market',{cargo:{food:10}});
 h.travel('scene:yunxiu-courtyard');
 const original={wood:stock(h,HOME).resources.wood,stone:stock(h,HOME).resources.stone,food:stock(h,HOME).resources.food};
 reserve(h);h.act('marketOrder',ID,'pickup-v2');h.act('marketOrder',ID,'depart-v2');
 h.until(s=>!s.srWorld.activeTravelId,'market arrival',300);h.until(s=>s.srEconomy.orders[ID].phase==='delivered','order at market',3);
 h.act('marketOrder',ID,'cancel-v2');h.act('marketOrder',ID,'recover-v2');checkpoint(h,'public-cargo-before-homebound');
 h.travel('scene:yunxiu-courtyard');
 const carried=SIM.viewEconomy(h.s).stockpiles.find(item=>item.id===CARGO);
 assert.equal(carried.position.sceneId,'scene:yunxiu-courtyard');assert.equal(carried.access,'public');
 assert.equal(stock(h,CARGO).resources.wood,20);assert.equal(stock(h,CARGO).resources.stone,10);
 const returned=h.act('startTransport',CARGO,HOME,'person:master',{wood:20,stone:10});
 h.until(s=>s.workOrdersById[returned.id].phase==='delivered','public order cargo returned to yard');
 assert.equal(stock(h,HOME).resources.wood,original.wood);assert.equal(stock(h,HOME).resources.stone,original.stone);
 assert.equal(stock(h,CARGO).resources.wood,0);assert.equal(stock(h,CARGO).resources.stone,0);
 assert.equal(accountTotals(h).personal.wood,0);checkpoint(h,'public-cargo-returned-home');
});

test('previous completed v2 save keeps its settled money and cannot pay twice',()=>{
 const h=publicOpening();reserve(h);h.act('marketOrder',ID,'pickup-v2');h.act('marketOrder',ID,'depart-v2');
 h.until(s=>!s.srWorld.activeTravelId,'market arrival',300);h.until(s=>s.srEconomy.orders[ID].phase==='delivered','order at market',3);
 h.act('srWorldCommand',{action:'move',x:37,y:25});h.until(s=>!s.srWorld.interaction,'merchant approach');h.act('marketOrder',ID,'deliver-v2');
 const prior=JSON.parse(JSON.stringify(h.s)),order=prior.srEconomy.orders[ID];
 delete order.accessVersion;prior.stockpilesById[CARGO].access='private';prior.stockpilesById[FREIGHT].access='private';
 prior.stockpilesById[CARGO].resources.jade-=30;prior.stockpilesById[PARTY].resources.jade+=30;
 order.freightRefundStockpileId=PARTY;prior.factsById[order.resultTransactionId].paymentTargetStockpileId=PARTY;
 const raw=JSON.stringify(prior),loaded=SIM.validateSave(JSON.parse(raw));
 assert.equal(JSON.stringify(loaded),raw,'completed historical holdings remain unchanged on import');
 const restored=harness(loaded),before=JSON.stringify(restored.s);
 rejected(restored,'deliver-v2',/已经结束/);assert.equal(JSON.stringify(restored.s),before);
});

test('incomplete or redirected previous v2 orders reject on import without editing the source save',()=>{
 const h=publicOpening();reserve(h);
 const prior=JSON.parse(JSON.stringify(h.s));
 delete prior.srEconomy.orders[ID].accessVersion;
 prior.stockpilesById[CARGO].access='private';prior.stockpilesById[FREIGHT].access='private';
 const cases=[
  ['missing source',order=>delete order.sourceStockpileId],
  ['redirected freight',order=>order.quote.deliveryCostStockpileId=PARTY],
  ['redirected destination',order=>order.quote.targetStockpileId=HOME],
  ['redirected carrier',order=>order.carrierId='person:merchant-qingxi'],
  ['missing cargo holding',order=>delete order.cargoStockpileId],
  ['missing route costs',order=>delete order.quote.routeFoodBySegment],
 ];
 for(const [label,mutate] of cases){
  const malformed=JSON.parse(JSON.stringify(prior));mutate(malformed.srEconomy.orders[ID]);
  const raw=JSON.stringify(malformed);
  assert.throws(()=>SIM.validateSave(malformed),/订单|商单/,`${label}: malformed historical order must reject`);
  assert.equal(JSON.stringify(malformed),raw,`${label}: import must not modify supplied save`);
 }
});
