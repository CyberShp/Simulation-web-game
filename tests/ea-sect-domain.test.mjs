import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial,dispatchCommand,tick,validateSave} from '../dist/ea-opening-sim.mjs';
import {createGodotBridge} from '../dist/ea-godot-bridge.mjs';
import {BUILDINGS} from '../dist/ea-data.mjs';
import {spatialBounds,meterCanStand,meterFindPath,meterSweep} from '../dist/ea-sr-spatial.mjs';
import {DOMAIN_EXTENT_VERSION,DOMAIN_LAYOUT_VERSION,firstSite,domainPoint,localPoint,domainContains,SECT_DOMAIN} from '../dist/ea-sect-domain.mjs';

const sites=JSON.parse(readFileSync(new URL('../godot/estate_2d/estate-sites.json',import.meta.url))).sites;
const copy=value=>JSON.parse(JSON.stringify(value));
function session(source){
  let state=source?validateSave(copy(source)):validateSave(JSON.parse(createGodotBridge({state:initial({sr:true,mountainOpening:true,seed:618033}),sites}).save()));
  return {
    get state(){return state;},
    command(name,...args){const response=dispatchCommand(state,{name,args});state=response.state;return response.result;},
    step(){tick(state,.1);},
    until(predicate,label,max=8000){for(let n=0;n<max&&!predicate(state);n++)tick(state,.1);assert.ok(predicate(state),label);},
    restore(){const text=JSON.stringify(state);state=validateSave(JSON.parse(text));assert.equal(JSON.stringify(state),text,'save/load retains the exact canonical world');}
  };
}
function ordinaryTwoMemberCourtyard(){
  const run=session();
  run.command('masterAction','heal');run.command('chooseOpeningInheritance','qinglan');
  run.until(s=>s.master.wound===0,'healing finishes');
  run.command('advanceStory');run.command('establishHall');
  run.until(s=>s.story.opening.hallPhase==='complete','hall finishes');
  run.command('advanceStory','gift');run.command('advanceStory','invite');
  const farm=sites.find(site=>site.type==='farm');run.command('build','farm',farm.x,farm.y);
  run.until(s=>s.buildings.some(b=>b.type==='farm'),'farm finishes');run.command('masterAction','rest');
  return copy(run.state);
}
const original=ordinaryTwoMemberCourtyard();
function provisionAndOpen(){
  const run=session(original);run.command('enableSectDomain');
  for(let n=0;n<2;n++){run.command('startMasterHarvest','wood');run.until(s=>!s.master.activityId,'gather wood from its finite source');}
  const transport=run.command('startTransport','stockpile:carried:master','stockpile:yunxiu','person:master',{wood:24});
  run.until(s=>s.workOrdersById[transport.id]?.phase==='delivered','gathered wood reaches the public store');
  return run;
}
function assertMaterialLocations(state,order){
  const flow=order.materialFlow;
  for(const resource of ['wood','stone'])assert.equal(
    state.stockpilesById[flow.sourceStockpileId].resources[resource]+state.stockpilesById[flow.siteStockpileId].resources[resource]+(flow.cargo[resource]||0)+(order.usedCost[resource]||0),
    BUILDINGS.house.cost[resource],`${resource} is conserved between old store, carrier, site and installation`);
}

test('explicit domain activation preserves the old courtyard, identities, resources and clock; reload and reactivation are safe',()=>{
  const run=session(original),before=copy(run.state),beforeTime=run.state.time,result=run.command('enableSectDomain');
  assert.equal(result.alreadyEnabled,false);assert.equal(run.state.schemaVersion,6);
  assert.equal(run.state.spatial.extentVersion,DOMAIN_EXTENT_VERSION);
  assert.equal(run.state.spatial.domain.layoutVersion,DOMAIN_LAYOUT_VERSION);
  assert.deepEqual(spatialBounds(run.state),{x:0,y:0,width:160,height:96});
  for(const field of ['worldTick','rngState','personsById','buildingsById','stockpilesById','activitiesById','workOrdersById','reservationsById'])assert.deepEqual(run.state[field],before[field],field);
  assert.equal(run.state.time,beforeTime);
  run.restore();const activated=copy(run.state),again=run.command('enableSectDomain');
  assert.equal(again.alreadyEnabled,true);assert.deepEqual(run.state.spatial,activated.spatial);assert.equal(run.state.worldTick,activated.worldTick);
  assert.deepEqual(spatialBounds(validateSave(original)),{id:'scene:yunxiu-courtyard',width:96,height:96,grid:.5,personRadius:.26,pixelsPerMetre:32,depth:.65});
  const mapped=localPoint(domainPoint({x:28,y:12.6}));assert.equal(mapped.x,28);assert.ok(Math.abs(mapped.y-12.6)<1e-9);
  assert.equal(SECT_DOMAIN.planningBounds.status,'planning');assert.equal(SECT_DOMAIN.zones.length,7);
});

test('the opened road is navigable while unprepared slopes, arbitrary new sites and unknown save versions remain rejected',()=>{
  const run=session(original);run.command('enableSectDomain');
  assert.ok(meterFindPath(run.state,run.state.master.scenic,firstSite.entrance,{maxSnap:0}));
  for(const point of [{x:108,y:18},{x:108,y:64},{x:148,y:84},{x:158,y:44},{x:900,y:900}]){
    assert.equal(domainContains(point,.26),false);assert.equal(meterCanStand(run.state,point),false);
    assert.equal(meterFindPath(run.state,run.state.master.scenic,point,{maxSnap:0}),null);
  }
  assert.equal(meterSweep(run.state,{x:90,y:20},{x:140,y:40}).blocked,true,'a straight path cannot cut across a closed slope');
  const before=JSON.stringify(run.state);
  assert.throws(()=>run.command('build','house',134,40),/已规划/);
  assert.throws(()=>run.command('buildDomainSite','site:missing'),/不存在/);
  assert.throws(()=>run.command('buildDomainSite',firstSite.id),/wood材料不足/);
  assert.equal(JSON.stringify(run.state),before,'rejections do not spend materials or alter the live world');
  for(const change of [s=>s.spatial.extentVersion='unknown-domain',s=>s.spatial.domain.layoutVersion='unknown-layout',s=>delete s.spatial.domain,s=>s.spatial.extentVersion='courtyard-96-1']){
    const bad=copy(run.state);change(bad);const text=JSON.stringify(bad);assert.throws(()=>validateSave(bad));assert.equal(JSON.stringify(bad),text);
  }
});

test('same-world public harvesting, delivery and two construction trips build the new residence, with saved transit and work resuming once',()=>{
  const run=provisionAndOpen(),ids=Object.keys(run.state.personsById).sort(),before=copy(run.state);
  assert.equal(run.state.stockpilesById['stockpile:yunxiu'].resources.wood,49);
  const commandId=`command:${run.state.transactions.nextCommandId}`,expectedRevision=run.state.revision;
  const result=run.command('buildDomainSite',firstSite.id);
  assert.equal(result.siteId,firstSite.id);
  assert.deepEqual(run.state.stockpilesById[`stockpile:construction:source:${result.id}`].position,{sceneId:'scene:yunxiu-courtyard',...before.stockpilesById['stockpile:yunxiu'].position});
  let savedInTransit=false,savedWorking=false,crossed=false,maxTrips=0;
  for(let n=0;n<8000&&run.state.workOrdersById[result.workOrderId];n++){
    const previous={x:run.state.master.scenic.x,y:run.state.master.scenic.y};run.step();
    const state=run.state,feet=state.master.scenic,order=state.workOrdersById[result.workOrderId];
    assert.ok(Math.hypot(feet.x-previous.x,feet.y-previous.y)<.7,'the same body walks without a boundary jump');
    assert.equal(meterSweep(state,previous,feet).blocked,false);
    assert.equal(state.master.position.sceneId,'scene:yunxiu-courtyard');
    if(feet.x>96)crossed=true;
    if(!order)break;
    assertMaterialLocations(state,order);maxTrips=Math.max(maxTrips,order.materialFlow.trips.length);
    if(!savedInTransit&&feet.x>100&&order.materialFlow.phase==='carrying'){
      assert.equal(order.progressTicks,0,'construction waits for delivery');run.restore();savedInTransit=true;
      run.command('setSpeed',0);const text=JSON.stringify(run.state);run.step();assert.equal(JSON.stringify(run.state),text);run.command('setSpeed',1);
    }
    if(!savedWorking&&order.progressTicks>=50){run.restore();savedWorking=true;}
  }
  const state=run.state,built=state.buildings.find(b=>b.id===result.id),receipt=state.spatial.completedOrders.find(order=>order.id===result.workOrderId);
  assert.ok(crossed&&savedInTransit&&savedWorking);assert.equal(maxTrips,2);
  assert.equal(built.domainSiteId,firstSite.id);assert.deepEqual(built.transform,{x:132,y:40,orientation:'south'});
  assert.deepEqual(receipt.usedCost,BUILDINGS.house.cost);assert.equal(receipt.materialTrips.length,2);
  assert.ok(receipt.materialTrips.every(trip=>trip.phase==='delivered'&&trip.finishedTick>trip.startedTick));
  assert.deepEqual(Object.keys(state.personsById).sort(),ids);assert.equal(state.workOrdersById[result.workOrderId],undefined);
  assert.equal(state.spatial.completedOrders.filter(order=>order.id===result.workOrderId).length,1);run.restore();
  const replay=dispatchCommand(run.state,{name:'buildDomainSite',args:[firstSite.id],id:commandId,expectedRevision});
  assert.equal(replay.replayed,true);assert.equal(replay.state.buildings.filter(b=>b.domainSiteId===firstSite.id).length,1);
  assert.ok(state.worldTick>before.worldTick);assert.ok(meterFindPath(state,state.master.scenic,{x:28,y:12.6},{maxSnap:0}),'return route remains open');
});

test('cancelling a loaded trip from the new terrace physically returns the unused materials before refund',()=>{
  const run=provisionAndOpen(),before=copy(run.state.stockpilesById['stockpile:yunxiu'].resources),result=run.command('buildDomainSite',firstSite.id);
  run.until(s=>s.master.scenic.x>105&&s.workOrdersById[result.workOrderId]?.materialFlow.phase==='carrying','carrier reaches the east road');
  const cancelled=run.command('cancelConstruction');assert.equal(cancelled.pending,true);
  assert.equal(run.state.stockpilesById['stockpile:yunxiu'].resources.wood,before.wood-BUILDINGS.house.cost.wood);
  assert.ok(run.state.master.scenic.x>96);run.restore();
  run.until(s=>!s.workOrdersById[result.workOrderId],'unused materials return to the source');
  assert.equal(run.state.stockpilesById['stockpile:yunxiu'].resources.wood,before.wood);
  assert.equal(run.state.stockpilesById['stockpile:yunxiu'].resources.stone,before.stone);
  assert.equal(run.state.buildings.some(b=>b.domainSiteId===firstSite.id),false);
  const receipt=run.state.spatial.completedOrders.find(order=>order.id===result.workOrderId);
  assert.equal(receipt.phase,'cancelled');assert.ok(receipt.materialTrips.every(trip=>trip.phase==='returned'));run.restore();
});
