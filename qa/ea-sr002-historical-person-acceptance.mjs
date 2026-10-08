import test from 'node:test';
import assert from 'node:assert/strict';
import * as Legacy from '../dist/ea-sim.mjs';
import * as Opening from '../dist/ea-opening-sim.mjs';
import {validateContracts} from '../dist/ea-sr-contracts.mjs';
import {hydrateWorldPositionSR,shareClaimSR,tickSRWorld,viewSRWorld} from '../dist/ea-sr-world.mjs';

function historicalV5() {
  const state=Legacy.initial({seed:719});
  const departed=Legacy.addDisciple(state,{name:'旧山同门',reason:'自愿加入'});
  const active=Legacy.addDisciple(state,{name:'留院同门',reason:'自愿加入'});
  state.society.departed.push({
    id:departed.id,name:departed.name,time:state.time,reason:'另赴山外求道',
    memories:structuredClone(departed.mind.memories.filter(memory=>memory.public!==false)),
  });
  state.disciples=state.disciples.filter(person=>person.id!==departed.id);
  Legacy.validateSave(state);
  return {state,departedId:`person:yunxiu:${departed.id}`,activeId:`person:yunxiu:${active.id}`};
}

test('SR002 historical v5 identity keeps its facts without acquiring an active world body',()=>{
  const {state,departedId,activeId}=historicalV5();
  const original=JSON.stringify(state),clock=state.time,seed=state.sim.seed,resources=structuredClone(state.resources);
  const upgraded=Opening.validateSave(state,{upgrade:true});
  assert.equal(JSON.stringify(state),original,'the source save remains untouched');
  const departed=upgraded.personsById[departedId],active=upgraded.personsById[activeId];
  assert.equal(departed.compatibilityMode,'historical-only');
  assert.equal(departed.name,'旧山同门');
  assert.equal(departed.reason,'另赴山外求道');
  assert.deepEqual(departed.memories,state.society.departed[0].memories);
  for(const field of ['lifeStatus','position','location'])assert.equal(Object.hasOwn(departed,field),false,field);
  assert.equal(upgraded.homeMemberIds.includes(departedId),false);
  assert.equal(upgraded.homeMemberIds.includes(activeId),true);
  assert.equal(active.lifeStatus,'alive');
  assert.equal(active.location.kind,'local');
  assert.equal(upgraded.time,clock);
  assert.equal(upgraded.rngState,seed);
  assert.deepEqual(upgraded.resources,resources);
  assert.equal(viewSRWorld(upgraded).scene.actors.some(actor=>actor.personId===departedId),false);
  assert.equal(viewSRWorld(upgraded).scene.actors.some(actor=>actor.personId===activeId),true);
  const saved=JSON.stringify(upgraded),loaded=Opening.validateSave(JSON.parse(saved));
  assert.equal(JSON.stringify(loaded),saved,'the upgraded save reloads exactly');
  assert.equal(Object.hasOwn(loaded.personsById[departedId],'position'),false);
  assert.equal(Object.hasOwn(loaded.personsById[departedId],'lifeStatus'),false);
  assert.equal(viewSRWorld(loaded).scene.actors.some(actor=>actor.personId===departedId),false);
});

test('SR002 historical markers prevent hydration, scene projection and conversation',()=>{
  const {state,departedId}=historicalV5();
  const upgraded=Opening.validateSave(state,{upgrade:true});
  const historical=upgraded.personsById[departedId],before=JSON.stringify(historical);
  assert.equal(hydrateWorldPositionSR(upgraded,historical),historical);
  assert.equal(JSON.stringify(historical),before);

  const oldSaved=JSON.parse(JSON.stringify(upgraded));
  const oldRecord=oldSaved.personsById[departedId];
  oldRecord.lifeStatus='alive';
  oldRecord.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:12,y:27};
  const loaded=Opening.validateSave(oldSaved),loadedRecord=loaded.personsById[departedId];
  assert.equal(loadedRecord.position.x,12,'existing saved coordinates are preserved');
  assert.equal(viewSRWorld(loaded).scene.actors.some(actor=>actor.personId===departedId),false);
  const beforeConversation=JSON.stringify(loaded);
  assert.throws(()=>shareClaimSR(loaded,'claim:shen:direct',departedId),/不可达/);
  assert.equal(JSON.stringify(loaded),beforeConversation);
  const masterPosition=loaded.master.location;
  loadedRecord.position={kind:'scene',sceneId:masterPosition.sceneId,x:masterPosition.x,y:masterPosition.y};
  loaded.srWorld.interaction={id:'activity:sr:historical-share',kind:'share',claimId:'claim:shen:direct',recipientId:departedId,sceneId:masterPosition.sceneId,startedTick:loaded.worldTick,lastTick:loaded.worldTick,durationTicks:1,progressTicks:0,status:'executing'};
  assert.throws(()=>Opening.validateSave(JSON.parse(JSON.stringify(loaded))),/历史记录不可作为进行中传话对象/,'a historical identity cannot be a saved active conversation target');
  loaded.worldTick++;
  tickSRWorld(loaded);
  assert.equal(loaded.srWorld.interaction,null);
  assert.equal(loadedRecord.beliefs?.['shen-revenge'],undefined);
  assert.equal(loaded.claimsById['claim:shen:direct'].recipients.includes(departedId),false);

  const scoped=structuredClone(historical);
  delete scoped.compatibilityMode;
  scoped.recordScope='historical-only';
  assert.equal(hydrateWorldPositionSR(upgraded,scoped),scoped);
  assert.equal(Object.hasOwn(scoped,'position'),false);
});

test('SR002 active SR persons still require a lifecycle state',()=>{
  const {state,activeId}=historicalV5();
  const upgraded=Opening.validateSave(state,{upgrade:true});
  delete upgraded.personsById[activeId].lifeStatus;
  assert.throws(()=>validateContracts(upgraded),error=>error.code==='invalid-contract'&&error.path===`personsById.${activeId}.lifeStatus`);
});
