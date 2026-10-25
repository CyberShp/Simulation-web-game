import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCombatGroupComponent,checkedComponentOutput,componentWorldDiff,GROUP_COMPONENT_COMPANIONS} from '../../acceptance/build-combat-group-component.mjs';
import {restoreSect,validateSect,commandSect,snapshotSect,advanceSect} from '../../../apps/courtyard/sect-sim.mjs';
import {COURTYARD_MASTER_TERRAIN_VERSION} from '../../../src/simulation/ea-courtyard-master-terrain.mjs';

test('group component is explicitly labelled and its complete native envelope restores without a world change',()=>{
 const {native,context}=buildCombatGroupComponent(),restored=restoreSect(JSON.parse(JSON.stringify(native)));
 assert.equal(validateSect(restored),true);assert.deepEqual(restored,native);
 assert.equal(native.source.kind,'component-fixture');assert.equal(native.provenance.artifactKind,'component-fixture');assert.equal(context.normalPlayerProgression,false);assert.equal(native.provenance.normalPlayerProgression,false);assert.equal(native.courtyardPresentation.manualPause,true);assert.equal(native.state.speed,0);
 assert.equal(native.provenance.kind,context.base.provenance.kind,'the valid bundled source kind is retained as history, not manufactured for this fixture');
 const c=native.state.combat;assert.equal(c.status,'active');assert.equal(c.enemies.length,2);assert.equal(c.allies.length,2);assert.deepEqual(c.allies.map(a=>a.personId),GROUP_COMPONENT_COMPANIONS);assert.equal(c.geometryId,'prison-forecourt');assert.equal(c.rewardApplied,false);assert.equal(c.result,null);
});

test('every precondition edit is declared and the existing canonical Lin entity is reused',()=>{
 const built=buildCombatGroupComponent(),{baseWorld,preconditionsWorld,context,native}=built;
 assert.deepEqual(componentWorldDiff(baseWorld,preconditionsWorld),context.rawPreconditionDiff);
 assert.deepEqual(context.settings.map(s=>s.path).sort(),['/homeMemberIds','/personsById/person:master/realm','/srWorld/knownScenes']);assert.equal(context.validationIntroducedSettings,false);
 for(const id of ['person:master',...GROUP_COMPONENT_COMPANIONS]){assert.equal(native.state.personsById[id].id,baseWorld.personsById[id].id);assert.equal(native.state.personsById[id].name,baseWorld.personsById[id].name);assert.deepEqual(native.state.personsById[id].appearance,baseWorld.personsById[id].appearance);}
 assert(!baseWorld.homeMemberIds.includes('person:lin-changfeng'));assert(preconditionsWorld.homeMemberIds.includes('person:lin-changfeng'));
 assert.equal(preconditionsWorld.personsById['person:lin-changfeng'].realm,baseWorld.personsById['person:lin-changfeng'].realm);assert.equal(preconditionsWorld.personsById['person:lu-zhiwei'].realm,baseWorld.personsById['person:lu-zhiwei'].realm);
 assert.deepEqual(preconditionsWorld.stockpilesById,baseWorld.stockpilesById,'fixture setup does not grant resources');
});

test('public travel and actual party walking precede public engagement and a terminal pause',()=>{
 const {native,context}=buildCombatGroupComponent(),ops=context.operations,travel=ops.find(o=>o.api==='SIM.dispatchCommand');
 assert.equal(travel.request.name,'srWorldCommand');assert.equal(travel.request.args[0].action,'travel');assert.deepEqual(travel.request.args[0].companions,GROUP_COMPONENT_COMPANIONS);
 const movement=ops.find(o=>o.request?.type==='world'&&o.request.action.action==='move'),engage=ops.find(o=>o.request?.type==='world'&&o.request.action.action==='engage');assert(movement);assert(engage);assert.equal(engage.request.action.objectId,'object:prison:gate');
 assert(ops.indexOf(travel)<ops.indexOf(movement));assert(ops.indexOf(movement)<ops.indexOf(engage));assert(ops.filter(o=>o.api==='advanceSect').every(o=>o.steps>0&&o.stepSeconds===.1));
 assert.deepEqual(ops.at(-1).request,{type:'pause',paused:true});assert.deepEqual(native.state.travelsById[context.travelId].participantIds,['person:master',...GROUP_COMPONENT_COMPANIONS]);assert.equal(native.state.travelsById[context.travelId].status,'arrived');
 const c=native.state.combat;for(const actor of [c.player,...c.allies,...c.enemies]){const p=actor.personId?native.state.personsById[actor.personId]:native.state.world.encounterCombatantsById[actor.combatantId];assert.deepEqual(p.position?{kind:'local',sceneId:p.position.sceneId,x:p.position.x,y:p.position.y}:p.location,{kind:'local',sceneId:'scene:prison',x:c.sceneFrame.origin.x+actor.x,y:c.sceneFrame.origin.y+actor.y});}
});

test('the desktop terrain startup and paused input reset preserve the complete prepared native envelope',()=>{
 const {native,context,preconditionsWorld}=buildCombatGroupComponent(),ops=context.operations,contract=context.desktopStartupContract;
 assert.equal(preconditionsWorld.spatial.courtyardTerrain,undefined,'terrain is initialized by a public command, separate from the three explicit fixture settings');
 const terrain=ops[contract.terrainOperationIndex],reset=ops[contract.inputResetOperationIndex],travel=ops.find(o=>o.request?.name==='srWorldCommand');
 assert.deepEqual(terrain.request,{type:'enable-courtyard-terrain'});assert.equal(terrain.beforeTick,terrain.afterTick);assert.notEqual(terrain.beforeWorldSha256,terrain.afterWorldSha256);assert(ops.indexOf(terrain)<ops.indexOf(travel));
 assert.deepEqual(reset.request,{type:'combat-input',move:{x:0,y:0},reset:true});assert.equal(reset.beforeTick,reset.afterTick);assert.equal(contract.inputResetOperationIndex,ops.length-2);assert.deepEqual(ops.at(-1).request,{type:'pause',paused:true});
 assert.equal(native.state.spatial.courtyardTerrain.version,COURTYARD_MASTER_TERRAIN_VERSION);assert.equal(contract.terrainVersion,COURTYARD_MASTER_TERRAIN_VERSION);assert.deepEqual(contract.controls,native.state.combat.controls);assert.deepEqual(contract.controls,{move:{x:0,y:0},moveUntilTick:native.state.worldTick+5,autoAttack:false});
 const restored=restoreSect(JSON.parse(JSON.stringify(native)));
 for(let count=0;count<3;count++){
  const terrainResult=commandSect(restored,{type:'enable-courtyard-terrain'});assert.equal(terrainResult.ok,true);assert.equal(terrainResult.result.alreadyEnabled,true);
  const inputResult=commandSect(restored,{type:'combat-input',move:{x:0,y:0},reset:true});assert.equal(inputResult.ok,true);
  advanceSect(restored,1);assert.equal(validateSect(restored),true);assert.deepEqual(snapshotSect(restored),native,'repeated desktop initialization while paused must preserve all state and envelope fields');
 }
});

test('component output requires an explicit absolute directory outside the repository',()=>{
 const root=fileURLToPath(new URL('../../../',import.meta.url));assert.throws(()=>checkedComponentOutput());assert.throws(()=>checkedComponentOutput('relative-component'));assert.throws(()=>checkedComponentOutput(root));assert.throws(()=>checkedComponentOutput(path.join(root,'component-output')));
 assert.equal(checkedComponentOutput('/tmp/immortal-group-component-output'),'/tmp/immortal-group-component-output');
});
