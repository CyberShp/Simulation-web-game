/** SR-XF-011-AC-01 bounded delivery-window acceptance from a normal opening. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {setRouteConditionSR} from '../dist/ea-sr-world.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';

const ID='artisan_tools',CARGO='stockpile:market-order:artisan_tools:cargo',PAYMENT='stockpile:market-order:artisan_tools:payment',MERCHANT='stockpile:qingxi';
const persistence=createEAPersistence({validate:SIM.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr011-deadline'});
let prepared;
function opening(){
 if(!prepared){const h=normalOpening();h.resources({wood:20,stone:10,food:5});h.save();prepared=JSON.stringify(h.s);}
 return harness(SIM.validateSave(JSON.parse(prepared)));
}
function order(h){return h.s.srEconomy.orders[ID];}
function exact(h,label){
 h.save();const raw=JSON.stringify(h.s),imported=persistence.parseImport(persistence.exportState(h.s,{slot:1}));
 assert.equal(imported.ok,true,`${label}: native import`);
 assert.equal(JSON.stringify(imported.state),raw,`${label}: exact native save`);
 const before=JSON.stringify(h.s);SIM.viewEconomy(h.s);assert.equal(JSON.stringify(h.s),before,`${label}: read-only projection`);
}
function acceptedAtMarket(){
 const h=opening();h.act('marketOrder',ID,'quote-v2');h.act('marketOrder',ID,'accept-v2');exact(h,'accepted');
 h.act('marketOrder',ID,'pickup-v2');exact(h,'picked-up');h.act('marketOrder',ID,'depart-v2');exact(h,'departed');
 h.until(s=>!s.srWorld.activeTravelId,'real market arrival',300);h.until(s=>s.srEconomy.orders[ID].phase==='delivered','order location sync',3);
 h.worldWalk(37,25);exact(h,'market-arrived');return h;
}

test('normal public order records one sourced breach after 1201 fulfillable ticks and cancels once',()=>{
 const h=acceptedAtMarket(),quote=order(h).quote;
 assert.equal(quote.deadlineTick,quote.earliestDeliverTick+1200);
 assert.match(renderSRPanel(h.s,SIM,'production'),/此后有 1200 个可履约世界步/);
 h.until(s=>s.srEconomy.orders[ID].passableTicks>=1200,'full passable delivery window',8000);
 assert.equal(order(h).passableTicks,1200);assert.equal(order(h).breachTick,undefined);exact(h,'last-fulfillable-tick');
 h.until(s=>s.srEconomy.orders[ID].breachTick!==undefined,'sourced seller breach',8000);
 assert.equal(order(h).passableTicks,1201);
 const id=`fact:order-v2:breach:${ID}`,fact=h.s.factsById[id];
 assert.equal(fact.atTick,order(h).breachTick);assert.equal(fact.orderId,ID);assert.equal(fact.sellerId,'person:master');
 assert.equal(fact.pausedTicks,order(h).pausedTicks);assert.deepEqual(fact.pausedReasons,order(h).pauseSpans);
 assert.equal(h.s.stockpilesById[PAYMENT].resources.jade,30,'breach does not confiscate merchant money');
 assert.equal(h.s.stockpilesById[CARGO].resources.wood,20,'breach does not erase seller goods');
 exact(h,'breached');
 assert.match(renderSRPanel(h.s,SIM,'production'),/卖方失约已记入账本/);
 const corrupt=JSON.parse(JSON.stringify(h.s));corrupt.srEconomy.orders[ID].pausedTicks++;
 assert.throws(()=>SIM.validateSave(corrupt),/商单交付时钟异常/);
 const before={merchant:h.s.stockpilesById[MERCHANT].resources.jade,payment:h.s.stockpilesById[PAYMENT].resources.jade,wood:h.s.stockpilesById[CARGO].resources.wood,stone:h.s.stockpilesById[CARGO].resources.stone};
 h.act('marketOrder',ID,'cancel-v2');assert.equal(order(h).phase,'cancelled');
 assert.equal(h.s.stockpilesById[MERCHANT].resources.jade,before.merchant+before.payment);
 assert.equal(h.s.stockpilesById[PAYMENT].resources.jade,0);
 assert.equal(h.s.stockpilesById[CARGO].resources.wood,before.wood);assert.equal(h.s.stockpilesById[CARGO].resources.stone,before.stone);
 assert.equal(h.s.stockpilesById[CARGO].access,'public');
 assert.equal(h.s.factsById[id].atTick,fact.atTick,'cancellation preserves the single breach fact');
 exact(h,'cancelled-after-breach');
 const state=JSON.stringify(h.s);assert.throws(()=>h.act('marketOrder',ID,'cancel-v2'),/已经结束/);assert.equal(JSON.stringify(h.s),state);
});

test('road, merchant and warehouse pauses form exact segments without advancing on reload',()=>{
 const h=acceptedAtMarket(),q=order(h).quote;
 setRouteConditionSR(h.s,'route:valley-market','blocked');
 h.until(s=>s.worldTick>=q.earliestDeliverTick+20,'road pause after earliest time',500);
 assert.equal(order(h).passableTicks,0);assert.equal(order(h).pausedTicks,20);
 assert(order(h).pauseSpans.some(span=>span.reasons.includes('road:route:valley-market')));
 exact(h,'road-blocked');const paused=order(h).pausedTicks;
 exact(h,'same-tick-reload');assert.equal(order(h).pausedTicks,paused);
 setRouteConditionSR(h.s,'route:valley-market','open');
 h.until(s=>s.srEconomy.orders[ID].passableTicks>=3,'road recovered and actual merchant available',4000);
 assert.equal(order(h).pauseSpans.at(-1).endTick!==undefined,true);
 exact(h,'road-recovered');
 const merchant=h.s.personsById['person:merchant-qingxi'],wound=merchant.wound;
 merchant.wound=25;const beforeWound=order(h).pausedTicks,woundEnd=h.s.worldTick+8;
 h.until(s=>s.worldTick>=woundEnd,'merchant incapacity pause',9);
 assert.equal(order(h).pausedTicks,beforeWound+8);
 assert(order(h).pauseSpans.at(-1).reasons.includes('merchant:incapacitated'));
 exact(h,'merchant-incapacitated');h.s.personsById['person:merchant-qingxi'].wound=wound;
 const warehouse=h.s.stockpilesById[MERCHANT],capacity=warehouse.capacity;
 warehouse.capacity=Object.values(warehouse.resources).reduce((n,v)=>n+v,0)+29;
 const beforeFull=order(h).pausedTicks,fullEnd=h.s.worldTick+7;
 h.until(s=>s.worldTick>=fullEnd,'warehouse capacity pause',8);
 assert.equal(order(h).pausedTicks,beforeFull+7);
 assert(order(h).pauseSpans.at(-1).reasons.includes('warehouse:unavailable'));
 exact(h,'warehouse-unavailable');h.s.stockpilesById[MERCHANT].capacity=capacity;
 h.until(s=>s.srEconomy.orders[ID].passableTicks>=4,'capacity recovered',4000);
 assert.equal(order(h).pausedTicks,order(h).pauseSpans.reduce((n,span)=>n+span.pausedTicks,0));
 assert.equal(order(h).breachTick,undefined);
 exact(h,'pause-resumed');
});
