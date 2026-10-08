/** SR-XF-011-AC-01 bounded named-merchant response to an actual overdue v2 order. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {setRouteConditionSR} from '../dist/ea-sr-world.mjs';
import {harness,normalOpening} from './ea-sr-integration-acceptance.mjs';

const ID='artisan_tools',CARGO='stockpile:market-order:artisan_tools:cargo',PAYMENT='stockpile:market-order:artisan_tools:payment',MERCHANT='stockpile:qingxi';
const persistence=createEAPersistence({validate:SIM.validateSave,dataVersion:6,gameVersion:'1.6.0-dev',writerId:'qa-sr011-merchant-response'});
let prepared;
function opening(){if(!prepared){const h=normalOpening();h.resources({wood:20,stone:10,food:5});h.save();prepared=JSON.stringify(h.s);}return harness(SIM.validateSave(JSON.parse(prepared)));}
function order(h){return h.s.srEconomy.orders[ID];}
function exact(h,label){h.save();const raw=JSON.stringify(h.s),native=persistence.exportState(h.s,{slot:1}),loaded=persistence.parseImport(native);assert.equal(loaded.ok,true,`${label}: native import`);assert.equal(JSON.stringify(loaded.state),raw,`${label}: exact native reload`);const before=JSON.stringify(h.s);SIM.viewEconomy(h.s);assert.equal(JSON.stringify(h.s),before,`${label}: read-only order view`);if(process.env.XIANFU_QA_SR011_RESPONSE_DIR){const dir=resolve(process.env.XIANFU_QA_SR011_RESPONSE_DIR);mkdirSync(dir,{recursive:true});writeFileSync(resolve(dir,`${label}.json`),native);}}
function reject(h,choice,pattern){const before=JSON.stringify(h.s);assert.throws(()=>h.act('marketOrder',ID,choice),pattern);assert.equal(JSON.stringify(h.s),before,`${choice}: no partial mutation`);}
function accept(h){h.act('marketOrder',ID,'quote-v2');h.act('marketOrder',ID,'accept-v2');exact(h,'accepted');}
function ship(h){const source=h.s.stockpilesById['stockpile:yunxiu'].position;h.walk(source.x,source.y);h.act('marketOrder',ID,'pickup-v2');exact(h,'picked-up');h.act('marketOrder',ID,'depart-v2');exact(h,'departed');h.until(s=>!s.srWorld.activeTravelId,'real market arrival',300);h.until(s=>s.srEconomy.orders[ID].phase==='delivered','order arrival sync',3);exact(h,'market-arrived');}
function breach(h){h.until(s=>s.srEconomy.orders[ID].breachTick!==undefined,'actual fulfillable deadline',9000);assert.equal(order(h).passableTicks,1201);assert.equal(h.s.factsById[`fact:order-v2:breach:${ID}`].atTick,order(h).breachTick);exact(h,'breached');}

test('visible cargo makes the named merchant continue at original price and settle only once',()=>{
 const h=opening();accept(h);ship(h);h.worldWalk(37,25);breach(h);
 assert.equal(order(h).merchantResponse.decision,'continue');assert.equal(order(h).merchantResponse.cargoVisible,true);
 assert.equal(h.s.factsById[`fact:order-v2:response:${ID}`].breachFactId,`fact:order-v2:breach:${ID}`);
 assert.match(renderSRPanel(h.s,SIM,'production'),/货物已在周行舟面前/);
 const forged=JSON.parse(JSON.stringify(h.s));forged.srEconomy.orders[ID].merchantResponse.reason='<img src=x onerror=alert(1)>';forged.factsById[`fact:order-v2:response:${ID}`].reason=forged.srEconomy.orders[ID].merchantResponse.reason;assert.throws(()=>SIM.validateSave(forged),/商人失约回应/);
 const falseCost=JSON.parse(JSON.stringify(h.s));falseCost.srEconomy.orders[ID].merchantResponse.costs.spentFoodAtDecision++;falseCost.factsById[`fact:order-v2:response:${ID}`].costs.spentFoodAtDecision++;assert.throws(()=>SIM.validateSave(falseCost),/商人回应成本快照异常/);
 const before={wood:h.s.stockpilesById[MERCHANT].resources.wood,jade:h.s.stockpilesById[CARGO].resources.jade,rep:h.s.sect.reputation};
 h.act('marketOrder',ID,'deliver-v2');assert.equal(order(h).phase,'completed');assert.equal(h.s.stockpilesById[MERCHANT].resources.wood,before.wood+20);assert.equal(h.s.stockpilesById[CARGO].resources.jade,before.jade+30);assert.equal(h.s.sect.reputation,before.rep+2);exact(h,'continued-and-completed');reject(h,'deliver-v2',/已经结束/);
});

test('missing cargo with sufficient merchant stock yields sourced refusal and seller cancellation',()=>{
 const h=opening();accept(h);breach(h);
 assert.equal(order(h).merchantResponse.decision,'refuse');assert.equal(order(h).merchantResponse.cargoVisible,false);
 assert.match(renderSRPanel(h.s,SIM,'production'),/决定拒收/);reject(h,'agree-amend-v2',/没有可同意/);reject(h,'pickup-v2',/已拒收/);
 const before={merchant:h.s.stockpilesById[MERCHANT].resources.jade,payment:h.s.stockpilesById[PAYMENT].resources.jade,wood:h.s.stockpilesById[CARGO].resources.wood};
 h.act('marketOrder',ID,'cancel-v2');assert.equal(order(h).phase,'cancelled');assert.equal(h.s.stockpilesById[MERCHANT].resources.jade,before.merchant+before.payment);assert.equal(h.s.stockpilesById[PAYMENT].resources.jade,0);assert.equal(h.s.stockpilesById[CARGO].resources.wood,0);assert.equal(h.s.stockpilesById['stockpile:yunxiu'].resources.wood>=before.wood,true);exact(h,'refused-cancelled');reject(h,'cancel-v2',/已经结束/);
});

test('finite public trade creates a low-stock renegotiation; only explicit agreement starts 300 passable ticks',()=>{
 const h=opening();h.resources({jade:450});h.resources({wood:20,stone:10,food:5},{jade:450});h.merchant();
 const merchant=h.s.stockpilesById[MERCHANT],batches=Math.ceil(merchant.resources.wood/10);
 assert(batches<=24,`finite merchant wood can be purchased in bounded public trades: ${merchant.resources.wood}`);
 for(let left=batches;left>0;){const n=Math.min(8,left);h.act('marketTrade','wood','buy',n);left-=n;}
 assert.equal(h.s.stockpilesById[MERCHANT].resources.wood,0,'actual public purchases exhaust merchant wood');exact(h,'finite-stock-traded');
 accept(h);breach(h);
 assert.equal(order(h).merchantResponse.decision,'renegotiate');assert.match(order(h).merchantResponse.reason,/木 40、石 20/);
 assert.equal(order(h).amendment,undefined,'merchant offer does not change the clock');
 assert.match(renderSRPanel(h.s,SIM,'production'),/未当面同意前，期限不延长/);reject(h,'agree-amend-v2',/当面同意/);
 ship(h);h.worldWalk(37,25);exact(h,'at-merchant-before-agreement');
 const backdatedCost=JSON.parse(JSON.stringify(h.s)),backdated=backdatedCost.srEconomy.orders[ID].merchantResponse,backdatedFact=backdatedCost.factsById[`fact:order-v2:response:${ID}`];
 backdated.chargedSegmentsAtDecision=2;backdated.costs.spentFoodAtDecision=backdatedCost.srEconomy.orders[ID].quote.foodCost;
 backdatedFact.chargedSegmentsAtDecision=2;backdatedFact.costs.spentFoodAtDecision=backdated.costs.spentFoodAtDecision;
 assert.throws(()=>SIM.validateSave(backdatedCost),/商人回应路粮时序异常/);
 reject(h,'deliver-v2',/须当面同意后才能交付/);
 const agreed=h.act('marketOrder',ID,'agree-amend-v2');assert.equal(agreed.amendment.passableTicks,0);exact(h,'explicitly-agreed');reject(h,'agree-amend-v2',/没有可同意/);
 const wrongParties=JSON.parse(JSON.stringify(h.s)),amendFact=wrongParties.factsById[`fact:order-v2:amend:${ID}`];[amendFact.buyerId,amendFact.sellerId]=[amendFact.sellerId,amendFact.buyerId];assert.throws(()=>SIM.validateSave(wrongParties),/商单改约时钟或事实异常/);
 const expired=harness(SIM.validateSave(JSON.parse(JSON.stringify(h.s))));
 setRouteConditionSR(expired.s,'route:valley-market','blocked');const pauseEnd=expired.s.worldTick+8;
 expired.until(s=>s.worldTick>=pauseEnd,'amended road closure pauses time',9);assert.equal(order(expired).amendment.passableTicks,0);assert.equal(order(expired).amendment.pausedTicks,8);exact(expired,'amendment-road-paused');
 setRouteConditionSR(expired.s,'route:valley-market','open');
 expired.until(s=>s.srEconomy.orders[ID].amendment.expiredTick!==undefined,'explicitly accepted extra window expires',8000);
 assert.equal(order(expired).amendment.passableTicks,301);assert.equal(expired.s.factsById[`fact:order-v2:amend-expired:${ID}`].atTick,order(expired).amendment.expiredTick);
 exact(expired,'amendment-expired');reject(expired,'deliver-v2',/拒收本单/);
 for(const change of [f=>{f.operation='forged';},f=>{f.merchantId='person:master';}]){const falseExpiry=JSON.parse(JSON.stringify(expired.s));change(falseExpiry.factsById[`fact:order-v2:amend-expired:${ID}`]);assert.throws(()=>SIM.validateSave(falseExpiry),/商单改约时钟或事实异常/);}
 const reserved=expired.s.stockpilesById[PAYMENT].resources.jade,merchantJade=expired.s.stockpilesById[MERCHANT].resources.jade;
 expired.act('marketOrder',ID,'cancel-v2');assert.equal(expired.s.stockpilesById[PAYMENT].resources.jade,0);assert.equal(expired.s.stockpilesById[MERCHANT].resources.jade,merchantJade+reserved);assert.equal(expired.s.stockpilesById[CARGO].access,'public');exact(expired,'expired-cancelled');reject(expired,'cancel-v2',/已经结束/);
 h.until(s=>s.srEconomy.orders[ID].amendment.passableTicks>=3,'amended real world clock',300);assert.equal(order(h).amendment.passableTicks,3);exact(h,'amendment-running');
 const before={jade:h.s.stockpilesById[CARGO].resources.jade,rep:h.s.sect.reputation};h.act('marketOrder',ID,'deliver-v2');assert.equal(h.s.stockpilesById[CARGO].resources.jade,before.jade+30);assert.equal(h.s.sect.reputation,before.rep+2);exact(h,'amended-completed');
});
