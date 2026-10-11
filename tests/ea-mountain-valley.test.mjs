import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {supportsGodotLocalJourney} from '../dist/ea-godot-host.mjs';

const HOME='scene:yunxiu-courtyard', VALLEY='scene:valley';
const OUT='exit:yunxiu-valley', BACK='exit:valley-yunxiu';
function player() {
  let state=S.initial({sr:true,mountainOpening:true,seed:271828});
  return {
    get state(){return state;},
    send(name,...args){const result=S.dispatchCommand(state,{name,args});state=result.state;return result.result;},
    world(payload){return this.send('srWorldCommand',payload);},
    step(count=1){for(let i=0;i<count;i++)S.tick(state,.1);},
    until(predicate,label){for(let i=0;i<3000&&!predicate(state);i++)this.step();assert.ok(predicate(state),label);},
    restore(){const text=JSON.stringify(state);state=S.validateSave(JSON.parse(text));assert.equal(JSON.stringify(state),text);},
  };
}
function ready(){
  const p=player();p.send('masterAction','heal');p.send('chooseOpeningInheritance','qinglan');
  p.until(s=>s.master.wound===0,'opening recovery');return p;
}
function approach(p,exitId){
  const result=p.world({action:'exit',exitId});
  if(result.phase==='approaching')p.until(s=>!s.srWorld.interaction&&!s.master.scenic.path.length,'exit approach');
  return result;
}
function depart(p,exitId,cargo={food:4}){
  const exit=S.viewSceneExitsSR(p.state).find(exit=>exit.id===exitId);
  if(!exit.near)approach(p,exitId);
  return p.world({action:'exit',exitId,cargo});
}
function arrive(p){p.until(s=>!s.srWorld.activeTravelId,'travel arrival');}
function walk(p,x,y){p.world({action:'move',x,y});p.until(s=>!s.srWorld.interaction,'local walk');}

test('scenic exit walks to the actual gate before travel and restores the same journey',()=>{
  const p=ready(),before={...p.state.master.location},tick=p.state.worldTick;
  const unchanged=JSON.stringify(p.state),view=S.viewSRWorld(p.state);
  assert.equal(JSON.stringify(p.state),unchanged);assert.equal(view.scene.width,96);assert.equal(view.scene.height,96);view.exits[0].x=0;
  assert.equal(S.viewSceneExitsSR(p.state)[0].x,32);
  const approachResult=p.world({action:'exit',exitId:OUT,cargo:{food:4}});
  assert.equal(approachResult.phase,'approaching');
  assert.equal(p.state.srWorld.activeTravelId,null);
  assert.deepEqual(p.state.master.location,before);
  assert.equal(p.state.worldTick,tick);
  assert.ok(p.state.master.scenic.path.length);
  p.restore();
  p.until(s=>S.viewSceneExitsSR(s)[0].near&&!s.master.scenic.path.length,'reach gate');
  const result=depart(p,OUT),travel=p.state.travelsById[result.travelId];
  assert.equal(result.phase,'traveling');assert.equal(travel.exitId,OUT);
  assert.equal(p.state.master.position.kind,'worldTravel');
  assert.deepEqual(travel.participantIds,['person:master']);
  p.step(10);const progress=p.state.travelsById[result.travelId].progressTicks;
  assert.ok(progress>0&&progress<travel.durationTicks);
  assert.equal(supportsGodotLocalJourney(p.state),true);p.restore();
  assert.equal(p.state.travelsById[result.travelId].progressTicks,progress);
  const invalid=JSON.parse(JSON.stringify(p.state));invalid.travelsById[result.travelId].exitId=BACK;
  assert.throws(()=>S.validateSave(invalid),/山道出口/);
  arrive(p);assert.equal(p.state.master.position.sceneId,VALLEY);
  assert.equal(p.state.master.personId,'person:master');
  assert.deepEqual({x:p.state.master.position.x,y:p.state.master.position.y},{x:7,y:27});
  assert.equal(supportsGodotLocalJourney(p.state),true);p.restore();
  assert.equal(S.viewSRWorld(p.state).scene.width,64);assert.equal(S.viewSRWorld(p.state).scene.height,48);
  assert.throws(()=>p.world({action:'exit',exitId:OUT}),/所在的场景/);
});

test('valley gathering is local and finite, and its carried stock returns without duplication',()=>{
  const p=ready();depart(p,OUT);arrive(p);
  const masterId=p.state.master.personId,homeHerbs=p.state.stockpilesById['stockpile:yunxiu'].resources.herb;
  assert.throws(()=>p.world({action:'interact',objectId:'object:valley:herbs',choice:'gather'}),/走近/);
  walk(p,11.5,16);
  const carriedBefore=p.state.stockpilesById['stockpile:sr-party'].resources.herb;
  for(let i=0;i<3;i++){
    p.world({action:'interact',objectId:'object:valley:herbs',choice:'gather'});
    if(i===0){p.step(10);p.restore();}
    p.until(s=>!s.srWorld.interaction,'gather');
    assert.equal(S.viewSRWorld(p.state).scene.objects.find(o=>o.id==='object:valley:herbs').resourceRemaining,12-i*6);
  }
  const before=JSON.stringify(p.state);
  assert.throws(()=>p.world({action:'interact',objectId:'object:valley:herbs',choice:'gather'}),/采尽/);
  assert.equal(JSON.stringify(p.state),before);
  assert.equal(p.state.stockpilesById['stockpile:sr-party'].resources.herb,carriedBefore+18);
  approach(p,BACK);const result=depart(p,BACK);arrive(p);
  assert.equal(p.state.master.personId,masterId);assert.equal(p.state.master.position.sceneId,HOME);
  assert.equal(p.state.travelsById[result.travelId].status,'arrived');
  assert.deepEqual({x:p.state.master.position.x,y:p.state.master.position.y},{x:32,y:60});
  assert.equal(p.state.stockpilesById['stockpile:sr-party'].resources.herb,carriedBefore+18);
  assert.equal(p.state.stockpilesById['stockpile:yunxiu'].resources.herb,homeHerbs);
  assert.equal(p.state.stockpilesById['stockpile:sr-party'].position.sceneId,HOME);
  p.restore();assert.equal(p.state.srWorld.resourcePatches['object:valley:herbs'],0);
});

test('guardian conversation follows the same person and stops when the person leaves or dies',()=>{
  const p=ready();depart(p,OUT);arrive(p);
  // Explicit movement/death fixtures test the identity boundary after a normal arrival.
  p.state.personsById['person:qing-luo'].location={kind:'local',sceneId:VALLEY,x:39,y:25};
  const guardian=S.viewSRWorld(p.state).scene.objects.find(o=>o.id==='object:valley:guardian');
  assert.equal(guardian.personId,'person:qing-luo');assert.equal(guardian.x,39);
  assert.throws(()=>p.world({action:'interact',objectId:guardian.id,choice:'talk'}),/走近青萝本人/);
  walk(p,38,25);p.world({action:'interact',objectId:guardian.id,choice:'talk'});
  p.step(10);p.restore();
  p.state.personsById['person:qing-luo'].location={kind:'local',sceneId:'scene:market',x:20,y:20};
  p.step();assert.equal(p.state.srWorld.interaction,null);
  assert.equal(p.state.srWorld.lastInteraction.status,'interrupted');
  assert.equal(p.state.factsById['fact:rain:guardian'],undefined);
  assert.throws(()=>p.world({action:'interact',objectId:guardian.id,choice:'talk'}),/暂未见到/);
  p.state.personsById['person:qing-luo'].location={kind:'local',sceneId:VALLEY,x:39,y:25};
  p.world({action:'interact',objectId:guardian.id,choice:'talk'});p.until(s=>!s.srWorld.interaction,'guardian talk');
  assert.ok(p.state.factsById['fact:rain:guardian']);p.restore();
  S.recordPermanentDeathSR(p.state,'person:qing-luo',{cause:'专项死亡边界',sceneId:VALLEY});
  assert.equal(S.viewSRWorld(p.state).scene.objects.find(o=>o.id===guardian.id).available,false);
  assert.throws(()=>p.world({action:'interact',objectId:guardian.id,choice:'talk'}),/暂未见到/);
  p.restore();
});

test('the physical exit rejects a blocked route atomically and preserves historic travel calls',()=>{
  const p=ready();approach(p,OUT);
  S.setRouteConditionSR(p.state,'route:home-valley','blocked');
  const before=JSON.stringify(p.state);
  assert.throws(()=>depart(p,OUT),/道路中断/);assert.equal(JSON.stringify(p.state),before);
  assert.equal(S.viewSceneExitsSR(p.state)[0].available,false);
  S.setRouteConditionSR(p.state,'route:home-valley','open');
  const old=p.world({action:'travel',destination:VALLEY,cargo:{food:4}});
  assert.equal(old.exitId,undefined);p.step(10);p.restore();
  const tick=p.state.worldTick,returning=p.world({action:'return'});
  assert.equal(returning.returning,true);assert.equal(returning.durationTicks,10);
  assert.equal(p.state.master.position.kind,'worldTravel');p.restore();arrive(p);
  assert.equal(p.state.worldTick,tick+10);assert.equal(p.state.master.position.sceneId,HOME);
  assert.equal(supportsGodotLocalJourney(p.state),true);
  const unsupported=S.validateSave(JSON.parse(JSON.stringify(p.state)));unsupported.master.position={kind:'scene',sceneId:'scene:market',x:7,y:27};
  assert.equal(supportsGodotLocalJourney(unsupported),false);
});


test('valley walking can turn immediately while an invalid target keeps the committed path',()=>{
  const p=ready();depart(p,OUT);arrive(p);
  p.world({action:'move',x:20,y:28});p.step(8);
  const old=structuredClone(p.state.srWorld.interaction),feet={...p.state.master.location};
  p.world({action:'move',x:12,y:32});
  assert.notEqual(p.state.srWorld.interaction.id,old.id);
  assert.deepEqual(p.state.master.location,feet);
  const valid=JSON.stringify(p.state.srWorld.interaction);
  assert.throws(()=>p.world({action:'move',x:15,y:16}),/阻挡/);
  assert.equal(JSON.stringify(p.state.srWorld.interaction),valid);
  p.step(8);assert.notDeepEqual(p.state.master.location,feet);
  const retarget=p.world({action:'exit',exitId:BACK});assert.equal(retarget.phase,'approaching');
  assert.equal(p.state.srWorld.activeTravelId,null);
  p.until(s=>!s.srWorld.interaction,'walking to return exit');
  walk(p,11.5,16);p.world({action:'interact',objectId:'object:valley:herbs',choice:'gather'});
  assert.throws(()=>p.world({action:'move',x:12,y:32}),/身体活动/);
  assert.equal(p.state.srWorld.interaction.kind,'interact');
});
