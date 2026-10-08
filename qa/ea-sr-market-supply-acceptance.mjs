/** SR-XF-011-AC02: normal public supply with labeled interruption fixtures. */
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import * as S from '../dist/ea-opening-sim.mjs';
import {recordPermanentDeathSR} from '../dist/ea-sr-crises.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';
const checkpointOption=process.argv.indexOf('--checkpoint-dir'),checkpointDir=checkpointOption<0?null:resolve(process.argv[checkpointOption+1]);
const legacyOption=process.argv.indexOf('--legacy-save');
function writeCheckpoint(h,name){if(!checkpointDir)return;mkdirSync(checkpointDir,{recursive:true});writeFileSync(join(checkpointDir,`${name}.json`),JSON.stringify(h.s));writeFileSync(join(checkpointDir,`${name}.provenance.json`),JSON.stringify({kind:'normal-public-command-checkpoint',name,seed:618033,counts:h.counts}));}

function start(){
 const h=harness();
 h.act('acknowledgeIntro');h.act('masterAction','heal');h.until(s=>s.master.wound===0,'opening healing');h.act('advanceStory');
 return h;
}
const earnedSupplyStages={};

{
 const h=start(),source=()=>h.s.stockpilesById['stockpile:qingxi-supplier'],shop=()=>h.s.stockpilesById['stockpile:qingxi'];
 assert.equal(source().resources.food,160);
 assert.equal(h.s.srEconomy.marketSourceRemaining,undefined);
 h.merchant();h.act('marketTrade','food','buy',8);h.save();
 assert.equal(shop().resources.food,0);
 h.until(s=>s.worldTick>=2400,'source quote while merchant lacks travel food',3000);h.save();
 assert.equal(Object.keys(h.s.srEconomy.marketSupply.runs).length,0);
 assert.match(S.viewEconomy(h.s).market.supply.reason,/路粮不足/);
 const local=h.s.srEconomy.patches.food.remaining;
 h.harvest('food');h.save();
 assert.equal(h.s.srEconomy.patches.food.remaining,local-16);
 h.travel('scene:market',{cargo:{food:12,jade:12}});h.worldWalk(37,25);
 h.act('marketTrade','food','sell',1);h.save();
 assert.equal(shop().resources.food,10);
 const regional=k=>Object.entries(h.s.stockpilesById).filter(([id])=>['stockpile:qingxi','stockpile:qingxi-supplier','stockpile:qingxi-supplier-wallet','stockpile:chizhang-market-toll'].includes(id)||id.startsWith('stockpile:market-supply:')).reduce((sum,[,st])=>sum+(st.resources[k]||0),0);
 const beforeRun={food:regional('food'),jade:regional('jade')};
 const phase=name=>h.until(s=>Object.values(s.srEconomy.marketSupply.runs).some(r=>r.phase===name),`supplier ${name}`,4500);
 for(const name of ['outbound','at-source','purchased','returning','awaiting-delivery','completed']){phase(name);h.save();if(name!=='completed')earnedSupplyStages[name]=JSON.stringify(h.s);if(name==='returning')writeCheckpoint(h,'normal-supply-in-transit');}
 const run=Object.values(h.s.srEconomy.marketSupply.runs)[0];
 assert.equal(source().resources.food,140);
 assert.equal(shop().resources.food,24);
 assert.equal(run.consumedFood,6);
 assert.equal(run.paidGoodsJade,run.price);
 assert.equal(run.paidTollJade,2);
 assert(h.s.factsById[run.settlementFactId]);
 assert.equal(regional('jade'),beforeRun.jade,'supplier price and toll are transfers of the same finite money');
 assert.equal(regional('food'),beforeRun.food-run.consumedFood,'only six paid road meals leave regional holdings');
 const before=shop().resources.food;
 h.act('marketTrade','food','buy',1);h.save();
 assert.equal(shop().resources.food,before-10);
 writeCheckpoint(h,'normal-supply-completed');
 const factCount=Object.keys(h.s.factsById).filter(id=>id===run.settlementFactId).length;
 for(let n=0;n<10;n++)S.tick(h.s,.1);
 assert.equal(Object.keys(h.s.factsById).filter(id=>id===run.settlementFactId).length,factCount);
 console.log('PASS normal public shortage → actual harvest → market sale → funded physical supplier run → purchase; staged exact reload',h.counts);
}

{
 // A one-time injury at each real same-scene handoff must recover on the world clock.
 for(const stage of ['at-source','purchased','awaiting-delivery']){
  let s=S.validateSave(JSON.parse(earnedSupplyStages[stage]));
  const run=s.srEconomy.marketSupply.runs[s.srEconomy.marketSupply.activeRunId],carrier=s.personsById[run.carrierId];
  const fund=s.stockpilesById[run.fundStockpileId],cargo=s.stockpilesById[run.cargoStockpileId||run.sourceReserveId];
  const holdings=JSON.stringify({fund:fund.resources,cargo:cargo.resources,fundPosition:fund.position,cargoPosition:cargo.position,fundOwner:fund.ownerId,cargoOwner:cargo.ownerId,paid:run.paidGoodsJade,road:run.consumedFood});
  assert.equal(carrier.position.sceneId,stage==='awaiting-delivery'?'scene:market':'scene:supply');
  carrier.wound=35;
  for(let n=0;n<80;n++)S.tick(s,.1);
  assert.equal(run.phase,stage);assert(carrier.wound<35&&carrier.wound>20);
  assert.equal(JSON.stringify({fund:fund.resources,cargo:cargo.resources,fundPosition:fund.position,cargoPosition:cargo.position,fundOwner:fund.ownerId,cargoOwner:cargo.ownerId,paid:run.paidGoodsJade,road:run.consumedFood}),holdings);
  let raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
  for(let n=0;n<2400&&s.srEconomy.marketSupply.runs[run.id].phase!=='completed';n++)S.tick(s,.1);
  assert.equal(s.srEconomy.marketSupply.runs[run.id].phase,'completed',`${stage} injury should recover and finish the same run`);
  assert.equal(Object.keys(s.factsById).filter(id=>id===`fact:supply-purchase:${run.id}`).length,1);
  assert.equal(Object.keys(s.factsById).filter(id=>id===`fact:supply-delivery:${run.id}`).length,1);
  raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
 }
 console.log('PASS normal-origin source, purchased and destination injuries rest in place and finish one paid shipment; exact reload');
}

{
 // Both interruptions begin from the normal public sale and the same paid, physical run.
 for(const stage of ['outbound','returning']){
  let s=S.validateSave(JSON.parse(earnedSupplyStages[stage]));
  const run=s.srEconomy.marketSupply.runs[s.srEconomy.marketSupply.activeRunId],trip=s.travelsById[run.travelId],carrier=s.personsById[run.carrierId];
  const fund=s.stockpilesById[run.fundStockpileId],cargo=s.stockpilesById[run.cargoStockpileId||run.sourceReserveId],holdings=JSON.stringify({fund:fund.resources,cargo:cargo.resources,fundPosition:fund.position,cargoPosition:cargo.position,fundOwner:fund.ownerId,cargoOwner:cargo.ownerId,fundCustodian:fund.custodianId,cargoCustodian:cargo.custodianId,road:run.consumedFood,paid:run.paidGoodsJade});
  carrier.wound=35;
  const progress=trip.segmentWork,segment=trip.segmentIndex;
  for(let n=0;n<80;n++)S.tick(s,.1);
  assert.equal(trip.status,'blocked');assert.equal(trip.segmentWork,progress);assert.equal(trip.segmentIndex,segment);
  assert.equal(JSON.stringify({fund:fund.resources,cargo:cargo.resources,fundPosition:fund.position,cargoPosition:cargo.position,fundOwner:fund.ownerId,cargoOwner:cargo.ownerId,fundCustodian:fund.custodianId,cargoCustodian:cargo.custodianId,road:run.consumedFood,paid:run.paidGoodsJade}),holdings);
  assert.match(S.viewEconomy(s).market.supply.active.reason,/受伤/);
  let raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
  assert(s.personsById[run.carrierId].wound<35&&s.personsById[run.carrierId].wound>20);
  let restingTicks=0;
  while(s.personsById[run.carrierId].wound>20&&restingTicks++<600){S.tick(s,.1);assert.equal(s.travelsById[run.travelId].status,'blocked');}
  assert(restingTicks>300&&restingTicks<600,'normal rest must consume hundreds of world ticks');
  assert.equal(s.travelsById[run.travelId].segmentWork,progress);
  const heldRun=s.srEconomy.marketSupply.runs[run.id],heldFund=s.stockpilesById[heldRun.fundStockpileId],heldCargo=s.stockpilesById[heldRun.cargoStockpileId||heldRun.sourceReserveId];
  assert.equal(JSON.stringify({fund:heldFund.resources,cargo:heldCargo.resources,fundPosition:heldFund.position,cargoPosition:heldCargo.position,fundOwner:heldFund.ownerId,cargoOwner:heldCargo.ownerId,fundCustodian:heldFund.custodianId,cargoCustodian:heldCargo.custodianId,road:heldRun.consumedFood,paid:heldRun.paidGoodsJade}),holdings);
  raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
  S.tick(s,.1);
  assert.equal(s.travelsById[run.travelId].status,'traveling');assert(s.travelsById[run.travelId].segmentWork>progress);
  assert.equal(s.personsById[run.carrierId].mind.activity,'travel');
  assert.match(S.viewEconomy(s).market.supply.active.reason,/阻碍已解除/);
  let segmentMarker='',routeCheckpoints=0;
  for(let n=0;n<2000&&s.srEconomy.marketSupply.runs[run.id].phase!=='completed';n++){
   S.tick(s,.1);
   const current=s.srEconomy.marketSupply.runs[run.id],currentTravel=s.travelsById[current.travelId],marker=`${current.phase}:${currentTravel?.segmentIndex??'scene'}`;
   if(marker!==segmentMarker){raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);segmentMarker=marker;routeCheckpoints++;}
  }
  assert.equal(s.srEconomy.marketSupply.runs[run.id].phase,'completed');
  assert(routeCheckpoints>=5,'outbound and returning segments must survive exact reload');
  raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
 }
 console.log('PASS normal-origin outbound and returning injury fixtures pause one freight holding and resume the same route; exact reload');
}

{
 let s=S.validateSave(JSON.parse(earnedSupplyStages.outbound));
 const run=s.srEconomy.marketSupply.runs[s.srEconomy.marketSupply.activeRunId],carrier=s.personsById[run.carrierId],trip=s.travelsById[run.travelId],progress=trip.segmentWork;
 carrier.energy=2;
 for(let n=0;n<5;n++)S.tick(s,.1);
 assert.equal(trip.status,'blocked');assert.equal(trip.segmentWork,progress);assert(carrier.energy>2&&carrier.energy<5);
 let raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
 for(let n=0;n<20&&s.travelsById[run.travelId].status==='blocked';n++)S.tick(s,.1);
 assert.equal(s.travelsById[run.travelId].status,'traveling');assert(s.personsById[run.carrierId].energy>=5);
 raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
 console.log('PASS normal-origin exhausted carrier rests at one travel position and resumes on the same world clock; exact reload');
}

{
 // Permanent death uses the shared world death hook on a normal-origin physical trip.
 for(const stage of ['outbound','returning']){
  let s=S.validateSave(JSON.parse(earnedSupplyStages[stage]));
  const run=s.srEconomy.marketSupply.runs[s.srEconomy.marketSupply.activeRunId],trip=s.travelsById[run.travelId],fund=s.stockpilesById[run.fundStockpileId],cargo=s.stockpilesById[run.cargoStockpileId||run.sourceReserveId];
  const holdings=JSON.stringify({fund:fund.resources,cargo:cargo.resources,fundPosition:fund.position,cargoPosition:cargo.position,fundOwner:fund.ownerId,cargoOwner:cargo.ownerId,fundCustodian:fund.custodianId,cargoCustodian:cargo.custodianId,road:run.consumedFood,paid:run.paidGoodsJade});
  const progress=trip.segmentWork,segment=trip.segmentIndex;
  recordPermanentDeathSR(s,run.carrierId,{cause:'受控承运事故'});
  assert.equal(s.personsById[run.carrierId].lifeStatus,'dead');assert.equal(trip.status,'blocked');
  assert.match(run.reason,/身死/);assert(s.deathRecordsByPersonId[run.carrierId]);
  assert.deepEqual(s.itemsById[`item:relic:${run.carrierId}`].location,{kind:'travel',id:run.travelId});
  for(let n=0;n<80;n++)S.tick(s,.1);
  assert.equal(trip.segmentWork,progress);assert.equal(trip.segmentIndex,segment);
  assert.equal(JSON.stringify({fund:fund.resources,cargo:cargo.resources,fundPosition:fund.position,cargoPosition:cargo.position,fundOwner:fund.ownerId,cargoOwner:cargo.ownerId,fundCustodian:fund.custodianId,cargoCustodian:cargo.custodianId,road:run.consumedFood,paid:run.paidGoodsJade}),holdings);
  assert.equal(s.factsById[`fact:supply-delivery:${run.id}`],undefined);
  const raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
 }
 console.log('PASS normal-origin pre- and post-purchase carrier death leaves paid money and goods in one last physical holding; exact reload');
}

{
 const h=start();h.merchant();h.act('marketTrade','food','buy',8);
 h.until(s=>s.worldTick>=2400,'supplier quote waits for actual goods',3000);h.harvest('food');
 h.travel('scene:market',{cargo:{food:31,jade:9}});h.worldWalk(37,25);
 h.act('marketTrade','food','sell',3);h.save();
 h.until(s=>Object.keys(s.srEconomy.marketSupply.runs).length>=3,'normal second and third supply batches quoted',1200);h.save();
 const queued=h.s.srEconomy.marketSupply.runs['market-supply:3'];
 assert(queued&&queued.phase==='quoted');
 h.until(s=>s.srEconomy.marketSupply.runs['market-supply:1'].phase==='awaiting-delivery','first batch returns with clerk',1500);h.save();
 assert.equal(h.s.personsById['person:qingxi-supply-clerk'].position.sceneId,'scene:market');
 assert.deepEqual(h.s.stockpilesById[queued.sourceReserveId].position,{sceneId:'scene:supply',x:35,y:31});
 assert.equal(h.s.stockpilesById[queued.sourceReserveId].carrierId,null);
 assert(S.viewEconomy(h.s).giftRecipients.every(recipient=>!recipient.stockpileId.startsWith('stockpile:market-supply:')));
 const beforeGift=JSON.stringify(h.s);
 assert.throws(()=>S.dispatchCommand(h.s,{name:'transferProperty',args:['stockpile:sr-party',queued.sourceReserveId,'food',1,'gift']}),/不能作为普通赠借对象/);
 assert.throws(()=>S.dispatchCommand(h.s,{name:'startTransport',args:[queued.sourceReserveId,'stockpile:yunxiu','person:master',{food:1}]}),/不能由普通搬运处置/);
 assert.equal(JSON.stringify(h.s),beforeGift,'internal reservation rejects ordinary transfer without mutation');
 h.save();
 h.until(s=>s.srEconomy.marketSupply.runs['market-supply:1'].phase==='completed','first physical supply batch',2000);h.save();
 h.until(s=>s.srEconomy.marketSupply.runs['market-supply:2'].phase==='completed','second physical supply batch',2000);h.save();
 h.until(s=>s.srEconomy.marketSupply.runs['market-supply:3'].phase==='completed','third queued physical supply batch',2000);h.save();
 assert.deepEqual(h.s.stockpilesById[queued.sourceReserveId].position,{sceneId:'scene:supply',x:35,y:31});
 console.log('PASS normal public queued second and third supplier batches retain source location and reject internal gifts; exact reload',h.counts);
}

{
 const h=start();h.until(s=>s.weatherByRegionId['region:yunxiu'].phase==='rain','ordinary rain',6000);
 h.act('srStoryCommand',{action:'activateRainChain'});h.save();
 assert.equal(h.s.srWorld.routes['route:bridge'].condition,'blocked');
 const source=h.s.stockpilesById['stockpile:qingxi-supplier'].resources.food,local=h.s.srEconomy.patches.food.remaining;
 h.harvest('food');h.save();
 assert.equal(h.s.srEconomy.patches.food.remaining,local-16);
 h.until(s=>s.worldTick>=2400,'closed bridge source quote',3000);h.save();
 assert.equal(h.s.stockpilesById['stockpile:qingxi-supplier'].resources.food,source);
 assert.equal(Object.keys(h.s.srEconomy.marketSupply.runs).length,0);
 assert.match(S.viewEconomy(h.s).market.supply.reason,/石桥路段不能通行/);
 assert.equal(S.viewEconomy(h.s).market.supply.localFoodRemaining,local-16);
 writeCheckpoint(h,'bridge-local-harvest');
 console.log('PASS public rain chain blocks supplier trip while real local food remains harvestable; exact reload',h.counts);
}

{
 // Controlled road-condition fixture: only this block mutates a route directly.
 let s=S.validateSave(JSON.parse(JSON.stringify(S.initial({sr:true}))));
 while(s.worldTick<2400)S.tick(s,.1);
 const run=s.srEconomy.marketSupply.runs[s.srEconomy.marketSupply.activeRunId],trip=s.travelsById[run.travelId];
 for(let n=0;n<300&&trip.segmentIndex<1;n++)S.tick(s,.1);
 assert.equal(run.phase,'outbound');assert.equal(trip.segmentIndex,1);
 s.routesById['route:bridge'].condition='damaged';
 assert.equal(S.viewEconomy(s).market.routeOpen,true);
 const damagedStart=trip.segmentWork;
 for(let n=0;n<10;n++)S.tick(s,.1);
 assert.equal(trip.status,'traveling');assert(trip.segmentWork>damagedStart);assert(trip.segmentWork-damagedStart<10,'damaged bridge consumes more travel time');
 s.routesById['route:bridge'].condition='blocked';
 assert.equal(S.viewEconomy(s).market.routeOpen,false);
 const reserved=JSON.stringify(s.stockpilesById[run.sourceReserveId].resources),funds=JSON.stringify(s.stockpilesById[run.fundStockpileId].resources),progress=trip.segmentWork;
 for(let n=0;n<80;n++)S.tick(s,.1);
 assert.equal(trip.status,'blocked');assert.equal(trip.segmentWork,progress);
 assert.equal(JSON.stringify(s.stockpilesById[run.sourceReserveId].resources),reserved);
 assert.equal(JSON.stringify(s.stockpilesById[run.fundStockpileId].resources),funds);
 let raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
 const reject=(label,change)=>{const bad=JSON.parse(raw);change(bad);assert.throws(()=>S.validateSave(bad),undefined,label);assert.equal(JSON.stringify(s),raw,label+' must leave original save intact');};
 reject('wrong cargo owner',bad=>{bad.srEconomy.marketSupply.runs[run.id].cargoOwnerId='person:master';});
 reject('extra reserved source goods',bad=>{bad.stockpilesById[run.sourceReserveId].resources.wood++;});
 reject('extra reserved merchant funds',bad=>{bad.stockpilesById[run.fundStockpileId].resources.jade++;});
 reject('lost physical trip',bad=>{delete bad.travelsById[run.travelId];});
 reject('changed migration balance',bad=>{bad.srEconomy.marketSupplyMigration.oldRemaining.food++;});
 s.routesById['route:bridge'].condition='closed';
 for(let n=0;n<10;n++)S.tick(s,.1);
 assert.equal(trip.status,'blocked');assert.equal(trip.segmentWork,progress);
 s.routesById['route:bridge'].condition='open';
 for(let n=0;n<2500&&s.srEconomy.marketSupply.runs[run.id].phase!=='completed';n++)S.tick(s,.1);
 assert.equal(s.srEconomy.marketSupply.runs[run.id].phase,'completed');
 assert.equal(Object.keys(s.factsById).filter(id=>id===`fact:supply-delivery:${run.id}`).length,1);
 raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);
 reject('supplier goods cannot appear without source',bad=>{bad.stockpilesById['stockpile:qingxi-supplier'].resources.food+=100;});
 reject('supplier wallet cannot gain unearned payment',bad=>{bad.stockpilesById['stockpile:qingxi-supplier-wallet'].resources.jade++;});
 reject('bridge toll cannot gain unearned payment',bad=>{bad.stockpilesById['stockpile:chizhang-market-toll'].resources.jade++;});
 reject('delivery cargo fact must match real run',bad=>{bad.factsById[`fact:supply-delivery:${run.id}`].cargo.food++;});
 reject('delivery payment fact must match real run',bad=>{bad.factsById[`fact:supply-delivery:${run.id}`].paidGoodsJade++;});
 reject('purchase payment fact must match actual debit',bad=>{bad.factsById[`fact:supply-purchase:${run.id}`].payment++;});
 reject('purchase fact cannot disappear',bad=>{delete bad.factsById[`fact:supply-purchase:${run.id}`];});
 reject('all six road meals require facts',bad=>{for(const id of Object.keys(bad.factsById))if(id.startsWith(`fact:supply-road:${run.id}:`))delete bad.factsById[id];});
 console.log('PASS controlled bridge interruption preserves route, cargo, funds and one resumed delivery');
}

{
 // Controlled damaged bridge before quotation: the existing road remains passable at reduced speed.
 let s=S.validateSave(JSON.parse(JSON.stringify(S.initial({sr:true}))));s.routesById['route:bridge'].condition='damaged';
 while(s.worldTick<2400)S.tick(s,.1);
 assert.equal(S.viewEconomy(s).market.routeOpen,true);
 const run=s.srEconomy.marketSupply.runs['market-supply:1'];
 assert(run&&run.phase==='outbound');
 const trip=s.travelsById[run.travelId],before=trip.segmentWork;
 for(let n=0;n<120;n++)S.tick(s,.1);
 assert.equal(trip.status,'traveling');assert(trip.segmentIndex>=1||trip.segmentWork>before);
 const raw=JSON.stringify(s);s=S.validateSave(JSON.parse(raw));assert(JSON.stringify(s)===raw,'damaged bridge save/reload stays byte exact');
 console.log('PASS controlled damaged bridge permits supplier quote and slow physical travel; exact reload');
}

if(legacyOption>=0){
 // Published older save is an explicit compatibility fixture, separate from normal public paths.
 const old=JSON.parse(readFileSync(resolve(process.argv[legacyOption+1]),'utf8'));
 const remaining={...old.srEconomy.marketSourceRemaining},cursor=old.srEconomy.marketRestockTick,shop=JSON.stringify(old.stockpilesById['stockpile:qingxi'].resources);
 const migrated=S.validateSave(old),again=S.validateSave(JSON.parse(JSON.stringify(migrated)));
 for(const key of ['food','wood','stone','herb','crystal'])assert.equal(migrated.stockpilesById['stockpile:qingxi-supplier'].resources[key],remaining[key]);
 assert.equal(migrated.srEconomy.marketInsightSource.balance,remaining.insight);
 assert.equal(migrated.srEconomy.nextMarketSourceQuoteTick,cursor);
 assert.equal(JSON.stringify(migrated.stockpilesById['stockpile:qingxi'].resources),shop);
 assert.equal(JSON.stringify(again),JSON.stringify(migrated));
 console.log('PASS published old-save balance migrates once without changing merchant stock or quote cursor');
}
