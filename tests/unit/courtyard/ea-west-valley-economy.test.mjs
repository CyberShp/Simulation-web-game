import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {productionRecipeSnapshot, GRANARY_CROP_RECIPE, stockStorageView, stockpileReceiptPreview, initEconomy} from '../../../src/simulation/ea-sr-economy.mjs';
import {spatialSlots} from '../../../src/simulation/ea-sr-spatial.mjs';
const HOME='stockpile:yunxiu',MASTER='person:master',WORKER='person:lu-zhiwei';
const copy=value=>JSON.parse(JSON.stringify(value));
function harness(source=seed.state){
 let state=SIM.validateSave(copy(source));
 return {get s(){return state;},act(name,...args){const r=SIM.dispatchCommand(state,{name,args});state=r.state;return r.result;},step(seconds=.1){SIM.tick(state,seconds);},until(fn,label,max=6000){for(let n=0;n<max&&!fn(state);n++)SIM.tick(state,.1);assert.ok(fn(state),label);},save(){const text=JSON.stringify(state);state=SIM.validateSave(JSON.parse(text));assert.equal(JSON.stringify(state),text);return state;}};
}
function field(){const h=harness(),r=h.act('build','granary',20,60);h.until(s=>!s.workOrdersById[r.workOrderId],'field construction');const b=h.s.buildingsById[`building:yunxiu:${r.id}`];return {h,bid:b.instanceId,sid:`stockpile:${b.instanceId}`,wid:`work:production:${b.instanceId}`};}
function sow(f){const {h,bid,sid,wid}=f;const tx=h.act('startTransport',HOME,sid,MASTER,{food:2});h.until(s=>s.workOrdersById[tx.id].phase==='delivered','seed delivery');assert.equal(h.act('inviteWork',WORKER,bid).accepted,true);h.until(s=>!!s.workOrdersById[wid]?.crop,'onsite sowing');return h.s.workOrdersById[wid];}

test('grain requires onsite seed, grows on the shared clock, harvests locally and keeps next seed through transport',()=>{
 const f=field(),{h,bid,sid,wid}=f;
 assert.equal(spatialSlots(h.s.buildingsById[bid],'work').length,4);
 assert.equal(h.act('inviteWork',WORKER,bid).accepted,false);
 assert.equal(h.s.workOrdersById[wid],undefined);
 const foodBefore=h.s.stockpilesById[HOME].resources.food,sourceBefore=h.s.srEconomy.patches.food.remaining,supplyDay=h.s.economy.lastSupplyDay;
 const expectedHome=delivered=>foodBefore-2+delivered-(h.s.economy.lastSupplyDay-supplyDay)*SIM.foodDemand(h.s);
 const order=sow(f),batch=order.batch;
 assert.equal(h.s.stockpilesById[HOME].resources.food,expectedHome(0));
 assert.equal(h.s.stockpilesById[sid].resources.food,0);
 assert.equal(order.recipeSnapshot.recipeVersion,GRANARY_CROP_RECIPE.recipeVersion);
 assert.equal(order.crop.seedUsed,2);h.save();
 const paused=copy(h.s);paused.speed=0;const halted=harness(paused),text=JSON.stringify(halted.s);halted.step(20);assert.equal(JSON.stringify(halted.s),text);
 h.until(s=>s.workOrdersById[wid].crop.growthElapsedTicks>=10,'growth advances before maturity');
 assert.equal(h.s.workOrdersById[wid].crop.maturedAtTick,null);
 assert.equal(h.s.stockpilesById[sid].resources.food,0);h.save();
 h.until(s=>!!s.factsById[`fact:crop:harvest:${bid}:${batch}`],'mature harvest');
 assert.equal(h.s.workOrdersById[wid].crop.growthElapsedTicks,120);assert.equal(h.s.workOrdersById[wid].crop.careContribution,200);
 const fact=h.s.factsById[`fact:production:${bid}:${batch}`],harvest=h.s.factsById[`fact:crop:harvest:${bid}:${batch}`];
 assert.equal(harvest.quantity,fact.quantities.food);
 assert.ok(harvest.quantity>2);assert.equal(h.s.stockpilesById[HOME].resources.food,expectedHome(0));
 assert.ok(Math.abs(sourceBefore-h.s.srEconomy.patches.food.remaining-fact.grossOutput.food)<1e-8);
 h.act('toggleBuilding',h.s.buildingsById[bid].id);
 const amount=h.s.stockpilesById[sid].resources.food-2,tx=h.act('startTransport',sid,HOME,MASTER,{food:amount});
 h.until(s=>s.workOrdersById[tx.id].phase==='carrying','harvest pickup');h.save();
 h.until(s=>s.workOrdersById[tx.id].phase==='delivered','harvest reaches old store');
 assert.equal(h.s.stockpilesById[sid].resources.food,2);assert.equal(h.s.stockpilesById[HOME].resources.food,expectedHome(amount));h.save();
 h.act('toggleBuilding',h.s.buildingsById[bid].id);assert.equal(h.act('inviteWork',WORKER,bid).accepted,true);
 h.until(s=>s.workOrdersById[wid].batch===batch+1,'retained seed starts next batch');assert.equal(h.s.stockpilesById[sid].resources.food,0);h.save();
});

test('grain preserves growth during facility pause, waterlogging and full onsite storage',()=>{
 const f=field();sow(f);const {h,bid,sid,wid}=f;
 h.act('toggleBuilding',h.s.buildingsById[bid].id);const growth=h.s.workOrdersById[wid].crop.growthElapsedTicks;h.step(3);
 assert.equal(h.s.workOrdersById[wid].crop.growthElapsedTicks,growth);assert.equal(h.s.workOrdersById[wid].crop.phase,'paused:facility');h.save();
 h.act('toggleBuilding',h.s.buildingsById[bid].id);
 // Explicit boundary fixture: flood the current crop; goods and crop remain earned.
 const wet=copy(h.s);wet.ecologiesBySceneId['scene:yunxiu-courtyard'].surfaceZones['zone:yard-path'].wetness=.95;
 const flooded=harness(wet),before=copy(flooded.s.workOrdersById[wid].crop);flooded.step(2);
 assert.equal(flooded.s.workOrdersById[wid].crop.growthElapsedTicks,before.growthElapsedTicks);assert.equal(flooded.s.workOrdersById[wid].crop.careContribution,before.careContribution);assert.equal(flooded.s.workOrdersById[wid].crop.phase,'paused:waterlogged');flooded.save();
 const tight=copy(h.s);tight.stockpilesById[sid].capacity=1;const bounded=harness(tight),patch=bounded.s.srEconomy.patches.food.remaining;
 assert.equal(bounded.act('inviteWork',WORKER,bid).accepted,true);
 bounded.until(s=>s.workOrdersById[wid].crop.phase==='ripe/waiting','full field store retains ripe crop');
 assert.equal(bounded.s.srEconomy.patches.food.remaining,patch);assert.equal(bounded.s.stockpilesById[sid].resources.food,0);bounded.save();
});

test('an active legacy grain batch completes its frozen recipe before using new seed rules',()=>{
 const {h,bid,sid,wid}=field(),legacy=copy(h.s),b=legacy.buildingsById[bid],rid=`reservation:input:${bid}`;
 legacy.workOrdersById[wid]={id:wid,kind:'production',targetId:bid,phase:'active',batch:1,inheritedTicks:0,progressTicks:100,durationTicks:200,reservationId:rid,contributions:{[WORKER]:100},resultTransactionId:null,recipeSnapshot:productionRecipeSnapshot(h.s,b),participantSkills:{[WORKER]:legacy.personsById[WORKER].mind.skills.plant||0}};
 legacy.reservationsById[rid]={id:rid,kind:'materials',workOrderId:wid,cost:{}};
 const run=harness(legacy),version=run.s.workOrdersById[wid].recipeSnapshot.recipeVersion;assert.equal(run.s.stockpilesById[sid].resources.food,0);
 assert.equal(run.act('inviteWork',WORKER,bid).accepted,true);run.save();
 run.until(s=>s.workOrdersById[wid].phase==='completed','legacy batch finishes');assert.equal(run.s.workOrdersById[wid].recipeSnapshot.recipeVersion,version);assert.equal(run.s.workOrdersById[wid].crop,undefined);run.save();
 run.until(s=>!!s.workOrdersById[wid].crop,'next crop consumes retained grain');assert.equal(run.s.workOrdersById[wid].crop.seedUsed,2);assert.equal(run.s.workOrdersById[wid].batch,2);run.save();
});

test('quarry uses finite stone and cannot restore it through the crop restoration command',()=>{
 const h=harness(),r=h.act('build','quarry',20,60);h.until(s=>!s.workOrdersById[r.workOrderId],'quarry construction');const bid=`building:yunxiu:${r.id}`,sid=`stockpile:${bid}`;
 assert.equal(spatialSlots(h.s.buildingsById[bid],'work').length,2);assert.equal(h.s.srEconomy.patches.stone.max,960);
 const before=h.s.srEconomy.patches.stone.remaining;assert.equal(h.act('inviteWork',WORKER,bid).accepted,true);
 h.until(s=>s.stockpilesById[sid].resources.stone>0,'finite quarry output');assert.ok(Math.abs(before-h.s.srEconomy.patches.stone.remaining-h.s.stockpilesById[sid].resources.stone)<1e-8);h.save();
 const depleted=copy(h.s);depleted.srEconomy.patches.stone.remaining=0;const exhausted=harness(depleted),onsite=exhausted.s.stockpilesById[sid].resources.stone;
 assert.equal(SIM.productionAvailability(exhausted.s,exhausted.s.buildingsById[bid]).available,false);exhausted.step(3);assert.equal(exhausted.s.stockpilesById[sid].resources.stone,onsite);
 assert.throws(()=>exhausted.act('replenishPatch','stone'),/矿脉不可/);exhausted.save();
});

function storage(){
 // Capacity boundaries use explicit unit fixtures, separate from normal-play acceptance.
 const source=copy(seed.state);source.stockpilesById[HOME].resources.wood=60;
 const h=harness(source),r=h.act('build','warehouse',20,60);h.until(s=>!s.workOrdersById[r.workOrderId],'warehouse construction');const bid=`building:yunxiu:${r.id}`,sid=`stockpile:${bid}`;initEconomy(h.s);return {h,bid,sid};
}
test('warehouse has separate physical stock, classified capacity and in-transit reservations',()=>{
 const {h,bid,sid}=storage(),home=copy(h.s.stockpilesById[HOME]);
 assert.equal(h.s.stockpilesById[sid].resources.food,0);assert.equal(h.s.stockpilesById[HOME].buildingId,home.buildingId);assert.equal(SIM.BUILDINGS.warehouse.capacity,undefined);
 const stable=JSON.stringify(h.s),view=stockStorageView(h.s,sid);assert.equal(JSON.stringify(h.s),stable);assert.equal(view.capacity,2400);assert.deepEqual(view.categories.map(c=>c.capacity),[1200,600,600]);assert.equal(spatialSlots(h.s.buildingsById[bid],'rest').length,0);
 const tx=h.act('startTransport',HOME,sid,MASTER,{food:10});assert.equal(stockStorageView(h.s,sid).receivable.food,590);assert.equal(stockStorageView(h.s,sid).reserved,10);assert.equal(h.s.stockpilesById[sid].resources.food,0);h.save();
 h.until(s=>s.workOrdersById[tx.id].phase==='carrying','warehouse cargo pickup');h.save();h.until(s=>s.workOrdersById[tx.id].phase==='delivered','warehouse receives cargo');
 assert.equal(h.s.stockpilesById[sid].resources.food,10);assert.equal(stockStorageView(h.s,sid).reserved,0);assert.equal(h.s.stockpilesById[sid].ownerId,home.ownerId);h.save();
 const target=h.s.stockpilesById[sid];target.resources.food=595;
 assert.equal(stockpileReceiptPreview(h.s,sid,{food:6}).available,false);assert.match(stockpileReceiptPreview(h.s,sid,{food:6}).reason,/留种区/);
 assert.equal(stockpileReceiptPreview(h.s,sid,{wood:6}).available,true);
 const before=JSON.stringify(h.s);assert.throws(()=>h.act('startTransport',HOME,sid,MASTER,{food:6}),/留种区/);assert.equal(JSON.stringify(h.s),before);
 const reserved=h.act('startTransport',HOME,sid,MASTER,{food:5});assert.equal(stockStorageView(h.s,sid).receivable.food,0);assert.equal(stockpileReceiptPreview(h.s,sid,{food:1}).available,false);
 h.act('cancelTransport',reserved.id);assert.equal(stockStorageView(h.s,sid).receivable.food,5);h.save();
});


test('existing herb field retains its seed recipe and original crop snapshot',()=>{
 const h=harness(),bid='building:yunxiu:2',sid=`stockpile:${bid}`,wid=`work:production:${bid}`;
 const tx=h.act('startTransport',HOME,sid,MASTER,{herb:2});h.until(s=>s.workOrdersById[tx.id].phase==='delivered','herb seed delivered');
 assert.equal(h.act('inviteWork',WORKER,bid).accepted,true);h.until(s=>!!s.workOrdersById[wid]?.crop,'herb sowing');
 const order=h.s.workOrdersById[wid];assert.equal(order.recipeSnapshot.recipeVersion,'herb-crop:yunxiu:v1');assert.deepEqual(order.recipeSnapshot.inputCost,{herb:2});assert.equal(order.crop.maturityRequiredTicks,10);h.save();
 h.until(s=>!!s.factsById[`fact:crop:harvest:${bid}:${order.batch}`],'herb harvest');h.save();
});

test('warehouse pending pickup still occupies its source compartment and upgrades scale every compartment',()=>{
 const {h,bid,sid}=storage(),target=h.s.stockpilesById[sid];target.resources.food=600;
 const outbound=h.act('startTransport',sid,HOME,MASTER,{food:10});
 assert.equal(h.s.stockpilesById[sid].resources.food,590);assert.equal(stockStorageView(h.s,sid).used,600);assert.equal(stockStorageView(h.s,sid).receivable.food,0);
 assert.equal(stockpileReceiptPreview(h.s,sid,{food:1}).available,false);h.save();
 h.act('cancelTransport',outbound.id);assert.equal(h.s.stockpilesById[sid].resources.food,600);h.save();
 // Upgrade material/treasury values are deliberate boundary fixtures.
 Object.assign(h.s.stockpilesById[HOME].resources,{jade:500,wood:100,stone:100});
 const upgrade=h.act('upgrade',h.s.buildingsById[bid].id);h.until(s=>!s.workOrdersById[upgrade.workOrderId],'warehouse upgrade finishes');h.save();
 assert.equal(h.s.buildingsById[bid].level,2);assert.equal(stockStorageView(h.s,sid).capacity,4800);assert.deepEqual(stockStorageView(h.s,sid).categories.map(c=>c.capacity),[2400,1200,1200]);assert.equal(h.s.stockpilesById[sid].resources.food,600);
});

test('fractional and legacy tiny cargo retain exact capacity and ownership through warehouse delivery',()=>{
 const {h,sid}=storage(),cargo={wood:.02,stone:32.02,jade:7.96};
 Object.assign(h.s.stockpilesById[HOME].resources,cargo);
 const tx=h.act('startTransport',HOME,sid,MASTER,cargo);h.save();h.until(s=>s.workOrdersById[tx.id].phase==='delivered','exact forty-unit cargo');
 for(const [key,amount]of Object.entries(cargo))assert.equal(h.s.stockpilesById[sid].resources[key],amount);h.save();
 const tiny=3.552713678800501e-15;h.s.stockpilesById[sid].resources.jade=tiny;
 const returned=h.act('startTransport',sid,HOME,MASTER,{jade:tiny});h.until(s=>s.workOrdersById[returned.id].phase==='delivered','tiny owned quantity returns');assert.equal(h.s.stockpilesById[HOME].resources.jade,tiny);h.save();
 const corrupt=copy(h.s);corrupt.stockpilesById[sid].resources.food=601;assert.throws(()=>SIM.validateSave(corrupt),/库位|容量/);
 const wrongLevel=copy(h.s);wrongLevel.stockpilesById[sid].storageLevel=2;wrongLevel.stockpilesById[sid].capacity=4800;assert.throws(()=>SIM.validateSave(wrongLevel),/容量配置/);
 assert.equal(h.s.stockpilesById[sid].ownerId,MASTER);assert.equal(h.s.stockpilesById[sid].custodianId,MASTER);
});

function distantRiceInvitation({invite=true}={}){
 const h=harness();for(const name of ['enableSectDomain','enableCourtyardTerrain','enableWestValley'])h.act(name);
 const build=h.act('buildDomainSite','site:domain:gc-18');h.until(s=>!s.workOrdersById[build.workOrderId],'valley field construction');
 const bid=`building:yunxiu:${build.id}`,sid=`stockpile:${bid}`,delivery=h.act('startTransport',HOME,sid,MASTER,{food:2});
 h.until(s=>s.workOrdersById[delivery.id].phase==='delivered','distant field seed arrives');
 const offer=invite?h.act('inviteWork',WORKER,bid):null;if(invite)assert.equal(offer.accepted,true);
 return {h,bid,sid,offer};
}

test('a distant accepted invitation retains its journey across reload and starts the work period at its station',()=>{
 const {h,bid}=distantRiceInvitation({invite:false}),p=()=>h.s.personsById[WORKER],timing=()=>p().schedule.workTiming;
 const nextDay=(Math.floor(h.s.worldTick/h.s.ticksPerDay)+1)*h.s.ticksPerDay;
 // A public wait puts the journey across a daily boundary independently of
 // the chosen road length and the construction completion time.
 h.until(s=>s.worldTick>=nextDay-100,'wait until the final part of the current day');
 const offer=h.act('inviteWork',WORKER,bid);assert.equal(offer.accepted,true);
 assert.ok(timing().travelTicks>240);const departure=copy(timing());
 h.until(s=>s.worldTick>=nextDay,'the accepted journey crosses the daily supply boundary');
 assert.equal(p().job,h.s.buildingsById[bid].id);assert.equal(timing().arrivedAtTick,null);assert.deepEqual(timing(),departure);h.save();
 h.until(s=>s.worldTick>offer.atTick+240,'original local-work period passes while walking');
 assert.equal(p().job,h.s.buildingsById[bid].id);assert.equal(timing().arrivedAtTick,null);h.save();
 assert.deepEqual(h.act('inviteWork',WORKER,bid),offer);assert.deepEqual(timing(),departure);
 h.act('setSpeed',0);const stopped=JSON.stringify(h.s);h.step(30);assert.equal(JSON.stringify(h.s),stopped);h.act('setSpeed',1);
 h.until(()=>timing().arrivedAtTick!==null,'worker physically reaches the rice station');
 const arrived=timing().arrivedAtTick,deadline=p().schedule.commitUntilTick;
 assert.equal(deadline,arrived+240);assert.equal(h.s.activitiesById[p().activityId].phase,'executing');
 assert.ok(h.s.workOrdersById[`work:production:${bid}`]?.crop);h.save();
 assert.deepEqual(h.act('inviteWork',WORKER,bid),offer);assert.equal(p().schedule.commitUntilTick,deadline);
 h.step(1);
 assert.equal(timing().arrivedAtTick,arrived);assert.equal(p().schedule.commitUntilTick,deadline);assert.equal(p().job,h.s.buildingsById[bid].id);h.save();
 // Injury boundary uses a copied state; the accepted terms and earned crop stay intact.
 const wounded=copy(h.s);wounded.personsById[WORKER].wound=40;const hurt=harness(wounded);hurt.step(2);
 assert.equal(hurt.s.personsById[WORKER].job,null);assert.notEqual(hurt.s.activitiesById[hurt.s.personsById[WORKER].activityId]?.action,'work');hurt.save();
});

test('stored invitations without arrival timing keep their original deadline and v2 migration terms',()=>{
 const {h,bid}=distantRiceInvitation(),legacy=copy(h.s),p=legacy.personsById[WORKER];
 // Explicit compatibility fixture: an invitation saved under the original fixed-period contract.
 delete p.schedule.workTiming;p.schedule.commitUntilTick=legacy.worldTick+240;p.mind.commitUntil=h.s.time+24;
 const deadline=p.schedule.commitUntilTick;
 for(const source of [legacy,SIM.prepareAutonomyV2(legacy)]){
  const run=harness(source);run.save();assert.equal(run.s.personsById[WORKER].schedule.workTiming,undefined);
  run.step(10);assert.equal(run.s.personsById[WORKER].schedule.workTiming,undefined);assert.equal(run.s.personsById[WORKER].schedule.commitUntilTick,deadline);run.save();
  const commitment=Object.values(run.s.personsById[WORKER].schedule.commitmentsById||{}).find(c=>c.targetId===bid);
  if(commitment)assert.equal(commitment.endTick,deadline);
 }
});

test('a willing v2 worker records the same finite journey and actual arrival in the sourced commitment',()=>{
 const {h:old,bid}=distantRiceInvitation({invite:false}),h=harness(SIM.prepareAutonomyV2(old.s));
 h.until(s=>SIM.workCandidateV2(s,WORKER,bid).willing,'the member naturally becomes willing');
 const offer=h.act('inviteWork',WORKER,bid);assert.equal(offer.accepted,true);
 const p=()=>h.s.personsById[WORKER],promise=()=>Object.values(p().schedule.commitmentsById).find(c=>c.sourceFactId===offer.sourceFactId);
 assert.equal(promise().endTick,p().schedule.workTiming.arrivalDeadlineTick);h.save();
 h.until(()=>p().schedule.workTiming.arrivedAtTick!==null,'v2 worker reaches the actual station');
 assert.equal(promise().endTick,p().schedule.workTiming.arrivedAtTick+240);assert.equal(promise().status,'active');h.save();
 const deadline=promise().endTick;assert.deepEqual(h.act('inviteWork',WORKER,bid),offer);assert.equal(promise().endTick,deadline);
 h.act('toggleBuilding',h.s.buildingsById[bid].id);h.step(1);
 assert.equal(promise().status,'interrupted');assert.notEqual(p().schedule.workTiming.finishedAtTick,null);h.save();
});
