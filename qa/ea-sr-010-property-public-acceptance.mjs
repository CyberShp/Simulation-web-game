/** SR-XF-010-AC-03: public gift, equipment loan, and competing warehouse reservations.
 * Each case starts from a fresh SR save. Empty-bag and medical event fixtures are labeled below.
 * Run: node --test qa/ea-sr-010-property-public-acceptance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {carriedStockpile,grantPills} from '../dist/ea-sr-economy.mjs';
import {releaseBodyActivity} from '../dist/ea-facility-activities.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const homeId='stockpile:yunxiu',luId='person:lu-zhiwei',luStockId='stockpile:lu-zhiwei';
function exactSave(s,label){
 const raw=JSON.stringify(s),restored=S.validateSave(JSON.parse(raw));
 assert.equal(JSON.stringify(restored),raw,`${label}: exact JSON reload`);
 return restored;
}
function openingGift(){
 const h=harness();h.act('acknowledgeIntro');h.act('masterAction','heal');
 h.until(s=>s.master.wound===0,'public healing',500);
 h.act('advanceStory');h.walk(27.25,13.432692307692308);
 h.act('advanceStory','gift');
 assert.equal(h.s.factsById['fact:opening:gift'].recipientId,luId);
 assert.equal(h.s.stockpilesById[luStockId].resources.herb,10);
 assert.equal(h.s.stockpilesById[luStockId].ownerId,luId);
 exactSave(h.s,'public opening gift');return h;
}

test('public gift keeps recipient ownership; a carrier cannot transfer her private herb to the public warehouse',()=>{
 const h=openingGift(),privateStock=()=>h.s.stockpilesById[luStockId],home=()=>h.s.stockpilesById[homeId];
 assert.equal(h.s.homeMemberIds.includes(luId),false,'recipient has not joined the home');
 const before=JSON.stringify(h.s),herb={private:privateStock().resources.herb,public:home().resources.herb};
 assert.throws(()=>h.act('startTransport',luStockId,homeId,luId,{herb:1}),/跨所有者财物/);
 assert.equal(JSON.stringify(h.s),before,'rejected command makes no reservation, ledger entry, or resource change');
 assert.deepEqual({private:privateStock().resources.herb,public:home().resources.herb},herb);
 assert.equal(Object.values(h.s.workOrdersById).filter(w=>w.kind==='transport').length,0);
 assert.equal(Object.keys(h.s.factsById).filter(id=>id.startsWith('fact:transport:')).length,0);
 exactSave(h.s,'rejected private transfer');
 const gift=h.act('transferProperty',homeId,luStockId,'herb',1);
 assert.equal(home().resources.herb,herb.public-1);
 assert.equal(privateStock().resources.herb,herb.private+1);
 assert.equal(privateStock().ownerId,luId);
 assert.equal(h.s.factsById[gift.id].operation,'gift');
 assert.equal(h.s.factsById[gift.id].targetStockpileId,luStockId);
 exactSave(h.s,'additional public gift');
 const loanBefore=JSON.stringify(h.s);
 assert.throws(()=>h.act('transferProperty',homeId,luStockId,'herb',1,'loan'),/可消耗物资须赠予/);
 assert.equal(JSON.stringify(h.s),loanBefore);
});

test('same-owner carrying keeps the earned private herb under its original owner',()=>{
 const h=openingGift();
 // Initialize an empty second location with the production stockpile helper;
 // the herb itself comes only from the public opening gift.
 const carriedId=carriedStockpile(h.s,luId);
 const transport=h.act('startTransport',luStockId,carriedId,luId,{herb:1});
 h.until(s=>s.workOrdersById[transport.id].phase==='delivered','same-owner delivery',20);
 assert.equal(h.s.stockpilesById[luStockId].resources.herb,9);
 assert.equal(h.s.stockpilesById[carriedId].resources.herb,1);
 assert.equal(h.s.stockpilesById[carriedId].ownerId,luId);
 assert.equal(h.s.stockpilesById[homeId].resources.herb,6);
 exactSave(h.s,'same-owner private locations');
});

test('public delivery cannot turn a remote warehouse trip into a personal gift',()=>{
 const h=openingGift();h.act('advanceStory','invite');h.walk(40,35);
 const master=h.s.master.scenic,recipient=h.s.personsById[luId].mind.scenic;
 assert.ok(Math.hypot(master.x-recipient.x,master.y-recipient.y)>1.5);
 const before=JSON.stringify(h.s),wood=h.s.stockpilesById[homeId].resources.wood;
 assert.throws(()=>h.act('transferProperty',homeId,luStockId,'wood',1),/同地交付/);
 assert.equal(JSON.stringify(h.s),before);
 assert.throws(()=>h.act('startTransport',homeId,luStockId,luId,{wood:1}),/跨所有者财物/);
 assert.equal(JSON.stringify(h.s),before);
 assert.equal(h.s.stockpilesById[homeId].resources.wood,wood);
 assert.equal(h.s.stockpilesById[luStockId].resources.wood,0);
 assert.equal(Object.values(h.s.workOrdersById).filter(w=>w.kind==='transport').length,0);
 exactSave(h.s,'remote gift attempt');
});

test('autonomous medicine pickup keeps one public dose through a real walk and one use',()=>{
 const h=openingGift();h.act('advanceStory','invite');
 // Isolated medical trigger and production-recorded dose. The recipient,
 // public warehouse, and permission rule come from the public opening chain.
 const p=h.s.personsById[luId],home=h.s.stockpilesById[homeId];
 releaseBodyActivity(h.s,p);
 p.wound=35;p.energy=100;p.mind.satiety=100;p.mind.lastPillDay=-1;p.mind.restrictedUntil=0;
 p.mind.scenic={...p.mind.scenic,x:40,y:35,path:[],goal:null};
 p.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:40,y:35};
 h.s.doctrine.pillRule='shared';
 grantPills(h.s,homeId,'heal',1,{factId:'fact:qa:npc-heal-source'});
 const bagId=carriedStockpile(h.s,luId),before=JSON.stringify(h.s),consumed=h.s.stats.consumed;
 assert.throws(()=>h.act('preparePillUse','heal',luId),/门人按取用约定自主取药/);
 assert.equal(JSON.stringify(h.s),before);
 assert.throws(()=>h.act('startTransport',homeId,bagId,luId,{'pill:heal':1}),/跨所有者财物/);
 assert.equal(JSON.stringify(h.s),before,'public JSON command cannot impersonate autonomous pickup');
 exactSave(h.s,'available public medicine before autonomous pickup');
 h.until(s=>Object.values(s.workOrdersById).some(w=>w.kind==='transport'&&w.carrierId===luId&&w.cargo['pill:heal']===1),'autonomous medicine order',300);
 const order=Object.values(h.s.workOrdersById).find(w=>w.kind==='transport'&&w.carrierId===luId&&w.cargo['pill:heal']===1);
 assert.equal(order.sourceStockpileId,homeId);assert.equal(order.targetStockpileId,bagId);
 assert.equal(order.phase,'to-source');assert.equal(h.s.stockpilesById[homeId].pills.heal,0);
 exactSave(h.s,'one dose reserved for autonomous pickup');
 h.until(s=>s.workOrdersById[order.id].phase==='carrying','actual medicine pickup',300);
 exactSave(h.s,'one dose carried by recipient');
 h.until(s=>s.stats.consumed===consumed+1,'autonomous medicine use',700);
 assert.equal(h.s.workOrdersById[order.id].phase,'delivered');
 assert.equal(h.s.stockpilesById[homeId].pills.heal,0);
 assert.equal(h.s.stockpilesById[bagId].pills.heal,0);
 assert.ok(h.s.personsById[luId].wound<=10);
 assert.equal(h.s.factsById[`fact:transport:${order.id}`].operation,'delivery');
 exactSave(h.s,'one dose used after physical delivery');
});

test('public loan returns the same sword through a physical walk to the home warehouse',()=>{
 const h=openingGift();h.act('advanceStory','invite');
 assert.equal(h.s.homeMemberIds.includes(luId),true);
 const itemId='item:sr-equipment:1',item=()=>h.s.itemsById[itemId];
 assert.equal(item().source.claimId,'claim:starting-tools');assert.equal(item().ownerId,'person:master');
 const loan=h.act('lendEquipment',itemId,luId,600);
 assert.equal(item().loan,null,'the order has not transferred custody immediately');
 h.until(s=>s.srEquipment.orders[loan.orderId].phase==='completed','public loan handoff',100);
 assert.equal(item().ownerId,'person:master');assert.equal(item().location.id,luId);
 assert.equal(item().loan.borrowerId,luId);assert.equal(item().loan.status,'active');
 exactSave(h.s,'loaned sword');
 const equip=h.act('offerEquipItem',itemId,luId);
 h.until(s=>s.srEquipment.orders[equip.orderId].phase==='completed','companion equips borrowed sword',100);
 assert.equal(item().location.slot,'weapon');assert.equal(item().ownerId,'person:master');
 assert.equal(Object.values(h.s.itemsById).filter(i=>i.id===itemId).length,1);
 const before=JSON.stringify(h.s);
 assert.throws(()=>h.act('giftEquipment',itemId,luId),/无权赠予/);
 assert.equal(JSON.stringify(h.s),before,'the active loan cannot be sold or gifted by the lender');
 exactSave(h.s,'one borrowed equipped instance');
 const returned=h.act('returnEquipment',itemId);
 assert.equal(h.s.srEquipment.orders[returned.orderId].operation,'return');
 assert.equal(h.s.srEquipment.orders[returned.orderId].personId,luId);
 const reserved=JSON.stringify(h.s);
 assert.throws(()=>h.act('returnEquipment',itemId),/借物人正在忙/);
 assert.equal(JSON.stringify(h.s),reserved,'the occupied borrower cannot start a second return');
 const target=h.s.stockpilesById[homeId].position;
 const start=h.s.personsById[luId].mind.scenic;
 assert.ok(Math.hypot(start.x-target.x,start.y-target.y)>0.5,'borrower starts away from the handoff point');
 h.save();
 S.tick(h.s,.1);
 assert.equal(h.s.srEquipment.orders[returned.orderId].progressTicks,0,'walking does not count as handoff time');
 assert.notDeepEqual({x:h.s.personsById[luId].mind.scenic.x,y:h.s.personsById[luId].mind.scenic.y},{x:start.x,y:start.y},'borrower actually starts walking');
 assert.equal(item().ownerId,'person:master');
 assert.equal(item().loan.borrowerId,luId);
 assert.equal(item().location.id,luId);
 assert.equal(item().location.slot,'weapon');
 h.save();
 h.until(s=>s.srEquipment.orders[returned.orderId].progressTicks>0,'borrower reaches the home warehouse',30);
 assert.ok(Math.hypot(h.s.personsById[luId].mind.scenic.x-target.x,h.s.personsById[luId].mind.scenic.y-target.y)<0.04);
 assert.equal(item().location.id,luId,'the sword remains carried until handoff time elapses');
 h.save();
 h.until(s=>s.srEquipment.orders[returned.orderId].phase==='completed','public return handoff',50);
 assert.equal(h.s.srEquipment.orders[returned.orderId].progressTicks,30);
 assert.equal(item().ownerId,'person:master');
 assert.deepEqual(item().location,{kind:'stockpile',id:homeId});
 assert.equal(item().loan,null);
 assert.equal(Object.values(h.s.itemsById).filter(i=>i.source?.claimId==='claim:starting-tools').length,1);
 h.save();
 assert.equal(h.s.srEquipment.orders[returned.orderId].phase,'completed');
 assert.equal(h.s.itemsById[itemId].ownerId,'person:master');
 assert.deepEqual(h.s.itemsById[itemId].location,{kind:'stockpile',id:homeId});
 assert.equal(h.s.itemsById[itemId].loan,null);
 assert.equal(Object.values(h.s.itemsById).filter(i=>i.source?.claimId==='claim:starting-tools').length,1);
 const completed=JSON.stringify(h.s);
 assert.throws(()=>h.act('returnEquipment',itemId),/未借出/);
 assert.equal(JSON.stringify(h.s),completed,'completed return cannot be settled twice');
});

test('public warehouse reservation gives one carrier the full remaining wood and rejects a competing order',()=>{
 const h=openingGift();h.act('advanceStory','invite');
 const build=h.act('build','farm',26,16);
 h.until(s=>!s.workOrdersById[build.workOrderId],'public farm completion',700);
 const siteId=`stockpile:building:yunxiu:${build.id}`;
 assert.equal(h.s.stockpilesById[homeId].resources.wood,40);
 assert.equal(h.s.stockpilesById[siteId].resources.wood,0);
 exactSave(h.s,'earned public worksite');
 const first=h.act('startTransport',homeId,siteId,luId,{wood:40});
 assert.equal(h.s.workOrdersById[first.id].phase,'to-source');
 assert.equal(h.s.reservationsById[`reservation:transport:${first.id}`].cost.wood,40);
 assert.equal(h.s.stockpilesById[homeId].resources.wood,0);
 assert.equal(h.s.stockpilesById[siteId].resources.wood,0);
 const reserved=JSON.stringify(h.s);
 assert.throws(()=>h.act('startTransport',homeId,siteId,'person:master',{wood:1}),/可用库存不足/);
 assert.equal(JSON.stringify(h.s),reserved,'second order cannot consume the reserved wood');
 exactSave(h.s,'one public reservation');
 assert.equal(h.act('cancelTransport',first.id).returnedTo,homeId);
 assert.equal(h.s.stockpilesById[homeId].resources.wood,40);
 assert.equal(h.s.reservationsById[`reservation:transport:${first.id}`],undefined);
 assert.throws(()=>h.act('cancelTransport',first.id),/已结束/);
 exactSave(h.s,'reservation released once');
 const next=h.act('startTransport',homeId,siteId,'person:master',{wood:1});
 h.until(s=>s.workOrdersById[next.id].phase==='delivered','public worksite delivery',200);
 assert.equal(h.s.stockpilesById[homeId].resources.wood,39);
 assert.equal(h.s.stockpilesById[siteId].resources.wood,1);
 exactSave(h.s,'next order delivered one available unit');
});
