/** Issue #5: production receipts, physical inventory, transport and recovery.
 * Public opening follows the current inheritance choice. Nutrition, large-balance,
 * empty-stock and capacity cases are explicitly controlled boundary fixtures.
 * No experiment checkpoints or player saves are written by this suite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../src/simulation/ea-opening-sim.mjs';
import * as E from '../../src/simulation/ea-sr-economy.mjs';
import {cloneState} from '../../src/simulation/ea-state-v6.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

const homeId='stockpile:yunxiu';
const productionFacts=s=>Object.values(s.factsById).filter(f=>f.operation==='production');
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=1e-8,`${label}: ${actual} vs ${expected}`);
const exactReload=s=>{
 const serialized=JSON.stringify(s),restored=S.validateSave(JSON.parse(serialized));
 assert.equal(JSON.stringify(s),serialized,'save validation leaves its input untouched');
 assert.equal(JSON.stringify(restored),serialized,'accounting and references restore without another settlement');
 return restored;
};
let openingSource;
function opening(){
 if(!openingSource){
  const h=harness();h.act('acknowledgeIntro');h.act('masterAction','heal');
  h.act('chooseOpeningInheritance','qinglan');h.until(s=>s.master.wound===0,'current opening healing');
  h.act('advanceStory');h.walkPerson('person:lu-zhiwei');
  h.act('advanceStory','gift');h.act('advanceStory','invite');
  h.build('farm');h.build('lumber');h.walkPerson('person:lin-changfeng');h.act('advanceStory');
  openingSource=JSON.stringify(h.s);
 }
 return harness(S.validateSave(JSON.parse(openingSource)),'issue5-boundary-fixture');
}
function activeLumber(){
 const h=opening(),b=h.s.buildings.find(b=>b.type==='lumber'),orderId=`work:production:${b.instanceId}`;
 h.until(s=>s.workOrdersById[orderId]?.phase==='active'&&s.workOrdersById[orderId].progressTicks>0,'actual onsite lumber batch',6000);
 const order=h.s.workOrdersById[orderId],participants=Object.entries(order.contributions).map(([id])=>({person:h.s.personsById[id],share:1,skillAtFirstContribution:order.participantSkills[id]}));
 assert.equal(participants.length,1,'boundary source has one first actual contributor');
 return {h,b,order,participants,siteId:`stockpile:${b.instanceId}`,factId:`fact:production:${b.instanceId}:${order.batch}`};
}
function receiptCallback(output,wages=[],effect=()=>{}){
 return (participants,draft)=>{
  for(const wage of wages)draft.personsById[wage.personId].mind.purse+=wage.quantity;
  effect(draft,participants);
  return {grossOutput:{...output},wages:structuredClone(wages)};
 };
}

test('Issue #5 original 6000-second nutrition fixture keeps noncurrency production jade exactly zero',()=>{
 const h=opening(),s=h.s,b=s.buildings.find(b=>b.type==='lumber'),siteId=`stockpile:${b.instanceId}`;
 const startTick=s.worldTick,patchBefore=s.srEconomy.patches.wood.remaining,woodBefore=s.stockpilesById[siteId].resources.wood;
 for(let seconds=0;seconds<6000;seconds++){
  if(seconds%600===0){s.resources.food=2000;for(const p of Object.values(s.personsById))if(p.mind?.satiety!==undefined)p.mind.satiety=100;}
  S.tick(s,1);
 }
 const facts=productionFacts(s).filter(f=>f.targetStockpileId===siteId);
 assert.equal(s.worldTick-startTick,60000,'all 6000 simulated seconds really ran');
 assert.ok(facts.length>=10,'test reached multiple natural production and wage settlements');
 for(const fact of facts){
  assert.equal(fact.grossOutput.jade||0,0,'wood recipe has no currency output');
  assert.equal(fact.quantities.jade||0,0,'wood receipt has no residual currency');
  assert.ok(fact.grossOutput.wood>0);
  assert.ok(fact.accountingVersion,'new facts declare their accounting contract');
  near(fact.quantities.wood,fact.grossOutput.wood,'all produced wood reaches its actual site');
 }
 const quantity=facts.reduce((n,f)=>n+f.grossOutput.wood,0);
 assert.ok(facts.some(f=>!Number.isInteger(f.grossOutput.wood)),'legal production fractions remain');
 assert.equal(s.stockpilesById[siteId].resources.jade,0,'zero-output currency inventory stays zero');
 assert.equal(s.resources.jade,.2,'daily costs and production wages preserve the legal decimal cash balance');
 near(s.stockpilesById[siteId].resources.wood-woodBefore,quantity,'production facts equal stocked wood');
 near(patchBefore-s.srEconomy.patches.wood.remaining,quantity,'finite wood source equals gross harvest');
 const before=JSON.stringify(s);
 assert.throws(()=>E.startTransport(s,siteId,homeId,'person:master',{jade:1e-14}),/库存|数量|物资/);
 assert.equal(JSON.stringify(s),before,'ghost transport cannot mutate state');
 exactReload(s);
 console.log(JSON.stringify({experiment:'issue5-after-6000s',worldTick:s.worldTick,productionFacts:facts.length,anomalousJadeFacts:facts.filter(f=>(f.grossOutput.jade||0)!==0).length,publicResources:{...s.resources},siteResources:s.stockpilesById[siteId].resources,firstOutput:facts[0].grossOutput}));
});

test('explicit output survives large public balances and the batch receipt blocks duplicate settlement',()=>{
 const {h,b,participants,siteId,factId}=activeLumber(),s=h.s,site=s.stockpilesById[siteId];
 s.stockpilesById[homeId].capacity=2e16;s.resources.wood=1e16;
 const stockBefore=site.resources.wood,sourceBefore=s.srEconomy.patches.wood.remaining;
 let calls=0;const settle=receiptCallback({wood:17.145},[],()=>{calls++;});
 assert.equal(E.settleFiniteProduction(s,b,settle,participants),true);
 assert.equal(calls,1,'only one callback runs for the successful draft');
 assert.equal(site.resources.wood,stockBefore+17.145,'legal fractional output reaches the physical stock despite large unrelated balance');
 assert.equal(s.resources.wood,1e16,'production never round-trips through the large public balance');
 near(sourceBefore-s.srEconomy.patches.wood.remaining,17.145,'explicit source consumption');
 assert.equal(s.factsById[factId].grossOutput.wood,17.145);
 const done=JSON.stringify(s);
 assert.equal(E.settleFiniteProduction(s,b,settle,participants),false);
 assert.equal(calls,1);assert.equal(JSON.stringify(s),done,'replayed settlement makes no changes');
});

test('a last fractional public wage conserves cash with its worker purse and reaches exactly zero',()=>{
 const {h,b,participants,factId}=activeLumber(),s=h.s,p=participants[0].person;
 s.resources.jade=.3;p.mind.purse=9999.7;
 const callback=(people,draft)=>{
  draft.personsById[p.personId].mind.purse=10000;
  return {grossOutput:{wood:17.145},wages:[{personId:p.personId,quantity:.3}]};
 };
 assert.equal(E.settleFiniteProduction(s,b,callback,participants),true);
 assert.equal(s.resources.jade,0,'the last valid wage leaves no cash residue');
 assert.equal(p.mind.purse,10000,'worker receives exactly the last available wallet capacity');
 const fact=s.factsById[factId];
 assert.equal(fact.wagesFromPublic,.3);assert.equal(fact.wagesFromProceeds,0);
 assert.deepEqual(fact.wages,[{personId:p.personId,quantity:.3}]);
 assert.equal(fact.grossOutput.jade||0,0,'wages never become currency output');
 assert.equal(s.resources.jade+p.mind.purse,10000,'public and worker cash remain conserved');
});

test('failed actual output capacity, finite source and callback failures preserve the whole transaction',()=>{
 for(const mode of ['capacity','source','false','throw']){
  const {h,b,participants,siteId}=activeLumber(),s=h.s;
  if(mode==='capacity')s.stockpilesById[siteId].capacity=20;
  if(mode==='source')s.srEconomy.patches.wood.remaining=18;
  const before=JSON.stringify(s),callback=(people,draft)=>{
   people[0].person.mind.purse+=.8;
   if(mode==='false'||mode==='throw')draft.resources.jade-=.8;
   if(mode==='throw')throw Error('controlled accounting callback failure');
   if(mode==='false')return false;
   return {grossOutput:{wood:25},wages:[{personId:people[0].person.personId,quantity:.8}]};
  };
  if(mode==='throw')assert.throws(()=>E.settleFiniteProduction(s,b,callback,participants),/controlled accounting callback failure/);
  else assert.equal(E.settleFiniteProduction(s,b,callback,participants),false);
  assert.equal(JSON.stringify(s),before,`${mode} leaves the complete state untouched`);
 }
});

test('full worker purses cannot consume public cash while actual natural production still settles',()=>{
 const {h,factId}=activeLumber(),s=h.s;
 for(const p of Object.values(s.personsById))if(p.mind)p.mind.purse=10000;
 let cashBefore;
 for(let n=0;n<1500&&!s.factsById[factId];n++){cashBefore=s.resources.jade;S.tick(s,.1);}
 const fact=s.factsById[factId];assert.ok(fact,'a real worker completes this production batch');
 assert.equal(s.resources.jade,cashBefore,'full-purse workers charge no public cash');
 assert.equal(fact.wagesFromPublic,0);assert.equal(fact.wagesFromProceeds,0);
 assert.deepEqual(fact.wages,[],'no unpaid wallet increment is booked');
 for(const id of fact.participantIds)assert.equal(s.personsById[id].mind.purse,10000);
});

test('partially full purses book only the actual accepted wages, and forged production ledger entries fail recovery',()=>{
 const {h,factId}=activeLumber(),s=h.s;
 for(const p of Object.values(s.personsById))if(p.mind)p.mind.purse=9999.7;
 let cashBefore;
 for(let n=0;n<1500&&!s.factsById[factId];n++){cashBefore=s.resources.jade;S.tick(s,.1);}
 const fact=s.factsById[factId];assert.ok(fact);
 const wages=fact.wages.reduce((n,w)=>n+w.quantity,0);
 assert.ok(wages>0);assert.ok(fact.wages.every(w=>w.quantity<=.3),'wages fit the actual wallet capacity');
 near(cashBefore-s.resources.jade,wages,'only accepted wages leave the public vault');
 near(fact.wagesFromPublic,wages,'public wage receipt matches all actual wallet increments');
 assert.equal(fact.wagesFromProceeds,0,'wood output cannot pay in currency');
 const restored=exactReload(s);
 for(const forge of [
  f=>{f.grossOutput.jade=1e-14;},
  f=>{f.quantities.wood+=1;},
  f=>{f.wagesFromPublic+=1;},
  f=>{f.wages[0].quantity+=1;},
  f=>{f.recipeOutputDefinition={jade:24};}
 ]){
  const invalid=JSON.parse(JSON.stringify(restored));forge(invalid.factsById[factId]);
  assert.throws(()=>S.validateSave(invalid),/生产|结算|账|工资/,'tampered new receipt cannot be restored');
 }
});

test('zero inventory cannot create tiny cargo; actual fractional and tiny legacy property transports conserve quantity',()=>{
 for(const amount of [17.145,3.552713678800501e-15]){
  const h=opening(),s=h.s,b=s.buildings.find(b=>b.type==='lumber'),siteId=`stockpile:${b.instanceId}`,site=s.stockpilesById[siteId];
  site.resources.wood=amount;
  h.act('masterAction','rest');
  const transfer=h.act('startTransport',siteId,homeId,'person:master',{wood:amount});
  assert.equal(h.s.stockpilesById[siteId].resources.wood,0,'entire actual balance moves into one cargo');
  assert.equal(h.s.workOrdersById[transfer.id].cargo.wood,amount,'existing legacy fraction is not rounded away');
  h.act('cancelTransport',transfer.id);
  assert.equal(h.s.stockpilesById[siteId].resources.wood,amount,'cancelled reservation returns all actual material');
  assert.equal(h.s.reservationsById[h.s.workOrdersById[transfer.id].reservationId],undefined);
  exactReload(h.s);
 }
 const h=opening(),s=h.s,b=s.buildings.find(b=>b.type==='lumber'),siteId=`stockpile:${b.instanceId}`;
 s.stockpilesById[siteId].resources.jade=0;
 const before=JSON.stringify(s);
 assert.throws(()=>E.startTransport(s,siteId,homeId,'person:master',{jade:1e-14}),/库存|数量|物资/);
 assert.equal(JSON.stringify(s),before,'zero-stock rejection preserves command state');
});

test('physical fractional cargo delivery and restored reservation settle once with the same ledger quantity',()=>{
 const h=opening(),b=h.s.buildings.find(b=>b.type==='lumber'),siteId=`stockpile:${b.instanceId}`;
 h.act('toggleBuilding',b.id);h.s.stockpilesById[siteId].resources.wood=17.145;
 const publicBefore=h.s.resources.wood,transfer=h.act('startTransport',siteId,homeId,'person:master',{wood:17.145});
 h.save();h.until(s=>s.workOrdersById[transfer.id].phase==='delivered','fractional cargo delivery',2000);
 assert.equal(publicBefore,20,'controlled public delivery starts with twenty units');
 assert.equal(h.s.resources.wood,37.145,'decimal transfer gives the exact declared fractional balance');
 assert.equal(h.s.factsById[`fact:transport:${transfer.id}`].quantities.wood,17.145);
 assert.equal(h.s.stockpilesById[siteId].resources.wood,0);
 const restored=exactReload(h.s),receipt=JSON.stringify(restored.factsById[`fact:transport:${transfer.id}`]),delivered=restored.resources.wood;
 for(const forge of [
  state=>{delete state.factsById[`fact:transport:${transfer.id}`];},
  state=>{state.factsById[`fact:transport:${transfer.id}`].quantities.wood+=1;}
 ]){
  const invalid=JSON.parse(JSON.stringify(restored));forge(invalid);
  assert.throws(()=>S.validateSave(invalid),/运输|交付|事实/,'missing or mismatched new transport receipt fails recovery');
 }
 for(let n=0;n<50;n++)S.tick(restored,.1);
 assert.equal(restored.resources.wood,delivered,'resumed completed delivery does not credit again');
 assert.equal(JSON.stringify(restored.factsById[`fact:transport:${transfer.id}`]),receipt);
});

test('old fractional balances, historical production facts and in-transit tiny cargo remain readable and unchanged',()=>{
 const h=opening(),s=h.s,b=s.buildings.find(b=>b.type==='lumber'),siteId=`stockpile:${b.instanceId}`,tiny=3.552713678800501e-15;
 s.stockpilesById[siteId].resources.jade=tiny;s.stockpilesById[siteId].resources.wood=309.43783108800005;
 const factId='fact:production:legacy-accounting-fixture';
 s.factsById[factId]={id:factId,kind:'inventory-transaction',operation:'production',atTick:s.worldTick,targetStockpileId:siteId,quantities:{jade:tiny,wood:17.145},grossOutput:{jade:tiny,wood:17.145},participantIds:['person:lin-changfeng'],wagesFromProceeds:0};
 const transfer=h.act('startTransport',siteId,homeId,'person:master',{jade:tiny});
 const raw=JSON.stringify(h.s),restored=S.validateSave(JSON.parse(raw));
 assert.equal(JSON.stringify(h.s),raw,'migration keeps original save intact');
 assert.equal(restored.stockpilesById[siteId].resources.wood,309.43783108800005);
 assert.deepEqual(restored.factsById[factId],h.s.factsById[factId],'unversioned historical facts remain historical');
 assert.equal(restored.workOrdersById[transfer.id].cargo.jade,tiny,'real reserved legacy cargo survives recovery');
 assert.equal(JSON.stringify(S.validateSave(JSON.parse(JSON.stringify(restored)))),JSON.stringify(restored),'restoration is idempotent');
});

test('actual furnace input and output receipt survives active and completed save recovery without duplication',()=>{
 const h=opening(),furnace=h.build('alchemy'),siteId=`stockpile:${furnace.instanceId}`;
 h.resources({herb:10,jade:10,food:20});
 const transfer=h.act('startTransport',homeId,siteId,'person:master',{herb:10});
 h.until(s=>s.workOrdersById[transfer.id].phase==='delivered','real herb delivery to furnace');
 const before={herb:h.s.stockpilesById[siteId].resources.herb,jade:h.s.resources.jade,pills:h.s.stockpilesById[siteId].pills.heal};
 const order=h.act('craftSR','heal');
 assert.equal(h.s.stockpilesById[siteId].resources.herb,before.herb-10);
 assert.equal(h.s.resources.jade,before.jade-10);
 h.save();h.until(s=>s.workOrdersById[order.id].progressTicks>=40,'actual furnace partial progress',1500);h.save();
 const paid=JSON.parse(JSON.stringify(h.s)),paidOrder=paid.workOrdersById[order.id],progress=paidOrder.progressTicks;
 paidOrder.recipeVersion='pill-recipes:yunxiu:v1';delete paidOrder.recipeSnapshot;
 const oldRaw=JSON.stringify(paid),migrated=S.validateSave(paid);
 assert.equal(JSON.stringify(paid),oldRaw,'old paid furnace source is left intact');
 assert.equal(migrated.workOrdersById[order.id].progressTicks,progress,'old paid progress survives');
 assert.equal(migrated.stockpilesById[siteId].resources.herb,paid.stockpilesById[siteId].resources.herb,'migration does not charge herb twice');
 assert.equal(migrated.resources.jade,paid.stockpilesById[homeId].resources.jade,'migration does not charge jade twice');
 const cancelled=harness(migrated,'issue5-paid-old-furnace-fixture'),refund=cancelled.act('cancelCraftSR');
 near(refund.refund.herb,10*(1-progress/200),'old paid unworked fractional material refund');
 near(cancelled.s.stockpilesById[siteId].resources.herb,paid.stockpilesById[siteId].resources.herb+refund.refund.herb,'returned herb matches only the unworked share');
 near(cancelled.s.resources.jade,paid.stockpilesById[homeId].resources.jade+refund.refund.jade,'returned currency matches only the unworked share');
 assert.equal(cancelled.s.stockpilesById[siteId].pills.heal,before.pills,'cancelled active old batch produces no pill');
 exactReload(cancelled.s);assert.throws(()=>cancelled.act('cancelCraftSR'));
 h.until(s=>s.workOrdersById[order.id].phase==='completed','real furnace batch',2500);
 const factId=`fact:craft:${order.id}`,fact=h.s.factsById[factId];
 assert.equal(fact.quantity,2);assert.equal(h.s.stockpilesById[siteId].pills.heal,before.pills+2);
 assert.deepEqual(fact.cost,{jade:10,herb:10});
 h.save();const completed=cloneState(h.s);
 for(let n=0;n<30;n++)S.tick(completed,.1);
 assert.equal(completed.stockpilesById[siteId].pills.heal,before.pills+2);
 assert.deepEqual(completed.factsById[factId],fact);
 assert.equal(Object.values(completed.factsById).filter(f=>f.workOrderId===order.id&&f.operation==='pill-production').length,1);
 exactReload(completed);
});

test('a decimal cargo of exactly forty units reserves, cancels and fits a forty-unit target warehouse',()=>{
 const h=opening(),b=h.s.buildings.find(b=>b.type==='lumber'),siteId=`stockpile:${b.instanceId}`;
 h.act('toggleBuilding',b.id);
 const cargo={wood:.02,stone:32.02,jade:7.96};
 Object.assign(h.s.resources,cargo);h.s.stockpilesById[siteId].capacity=40;
 assert.deepEqual(h.s.stockpilesById[siteId].resources,{jade:0,wood:0,stone:0,herb:0,crystal:0,insight:0,food:0});
 const cancelled=h.act('startTransport',homeId,siteId,'person:master',cargo);
 assert.equal(cancelled.accepted,true,'mathematically forty units satisfy the carry boundary');
 for(const key of Object.keys(cargo))assert.equal(h.s.resources[key],0,'entire exact decimal amount is reserved');
 assert.deepEqual(h.s.workOrdersById[cancelled.id].cargo,cargo);
 h.act('cancelTransport',cancelled.id);
 for(const [key,quantity]of Object.entries(cargo))assert.equal(h.s.resources[key],quantity,'cancellation restores each actual amount');
 h.save();
 const delivered=h.act('startTransport',homeId,siteId,'person:master',cargo);
 h.until(s=>s.workOrdersById[delivered.id].phase==='delivered','exact forty-unit delivery',2000);
 assert.deepEqual(h.s.factsById[`fact:transport:${delivered.id}`].quantities,cargo);
 for(const [key,quantity]of Object.entries(cargo))assert.equal(h.s.stockpilesById[siteId].resources[key],quantity,'target receives every exact decimal amount');
 assert.equal(h.s.stockpilesById[siteId].capacity,40);
 exactReload(h.s);
});

test('a real legacy microquantity reaches a zero-balance target intact and restored delivery never repeats',()=>{
 const h=opening(),b=h.s.buildings.find(b=>b.type==='lumber'),siteId=`stockpile:${b.instanceId}`,tiny=3.552713678800501e-15;
 h.act('toggleBuilding',b.id);h.s.stockpilesById[siteId].resources.jade=tiny;h.s.resources.jade=0;
 const transfer=h.act('startTransport',siteId,homeId,'person:master',{jade:tiny});
 assert.equal(h.s.stockpilesById[siteId].resources.jade,0);
 assert.equal(h.s.workOrdersById[transfer.id].cargo.jade,tiny);
 h.save();h.until(s=>s.workOrdersById[transfer.id].phase==='delivered','legacy microquantity reaches empty target',2000);
 assert.equal(h.s.resources.jade,tiny,'zero-balance target preserves the actual legacy quantity');
 assert.equal(h.s.factsById[`fact:transport:${transfer.id}`].quantities.jade,tiny);
 assert.equal(h.s.stockpilesById[siteId].resources.jade,0);
 const restored=exactReload(h.s),factId=`fact:transport:${transfer.id}`,receipt=JSON.stringify(restored.factsById[factId]);
 for(let ticks=0;ticks<20;ticks++)S.tick(restored,.1);
 const recovered=exactReload(restored);
 assert.equal(recovered.resources.jade,tiny,'completed delivery is not credited after repeated recovery');
 assert.equal(JSON.stringify(recovered.factsById[factId]),receipt);
});
