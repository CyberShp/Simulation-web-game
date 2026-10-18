import test from 'node:test';import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,viewSect,commandSect,snapshotSect,restoreSect,advanceSect} from '../../../apps/courtyard/sect-sim.mjs';
const copy=v=>structuredClone(v);
function prepared(){let state=SIM.validateSave(copy(seed.state));for(const name of ['enableCourtyardTerrain','enableNorthLibrary'])state=SIM.dispatchCommand(state,{name,args:[]}).state;return createSectSession({source:{...seed,state}});}
test('the desktop source view is read-only and formal survey retains the paused walking order',()=>{
 const run=prepared(),before=snapshotSect(run),view=viewSect(run);assert.equal(view.operations.meditation.enabled,false);assert.deepEqual(snapshotSect(run),before);
 assert.equal(commandSect(run,{type:'enable-north-meditation'}).ok,true);const opened=snapshotSect(run);assert.equal(run.state.spiritSources,undefined);assert.equal(viewSect(run).domain.northMeditationEnabled,true);assert.deepEqual(snapshotSect(run),opened);
 const start=commandSect(run,{type:'survey-meditation'});assert.equal(start.ok,true,start.error);const id=start.result.workOrderId;
 assert.equal(run.state.workOrdersById[id].progressTicks,0);assert.equal(run.state.spiritSources.discoveredAtTick,null);
 assert.equal(commandSect(run,{type:'pause',paused:true}).ok,true);const paused=snapshotSect(run);advanceSect(run,2);assert.deepEqual(snapshotSect(run),paused);assert.deepEqual(snapshotSect(restoreSect(paused)),paused);
 const surveyView=viewSect(run).operations.meditation;assert.equal(surveyView.orders.find(o=>o.id===id).progressTicks,0);assert.deepEqual(snapshotSect(run),paused);
 const stop=commandSect(run,{type:'cancel-meditation-order',workOrderId:id});assert.equal(stop.ok,true,stop.error);assert.equal(run.state.workOrdersById[id].phase,'cancelled');assert.equal(run.state.spiritSources.discoveredAtTick,null);
 assert.equal(run.state.worldTick,paused.state.worldTick);assert.deepEqual(run.state.stockpilesById,paused.state.stockpilesById);const ended=snapshotSect(run);assert.deepEqual(snapshotSect(restoreSect(ended)),ended);
});

test('the shared current-activity control reports and cancels a survey through its public order',()=>{
 const run=prepared();assert.equal(commandSect(run,{type:'enable-north-meditation'}).ok,true);
 const start=commandSect(run,{type:'survey-meditation'});assert.equal(start.ok,true,start.error);const id=start.result.workOrderId;
 const before=snapshotSect(run),view=viewSect(run);assert.equal(view.operations.master.actions.cancel.available,true);
 assert.equal(view.operations.master.activity.progressTicks,0);assert.equal(view.operations.master.activity.durationTicks,80);
 assert.equal(view.operations.actionConsequences.orderId,id);assert.deepEqual(snapshotSect(run),before);
 const stop=commandSect(run,{type:'cancel-activity'});assert.equal(stop.ok,true,stop.error);
 assert.equal(run.state.workOrdersById[id].phase,'cancelled');assert.equal(run.state.master.action,'rest');
 assert.equal(run.state.worldTick,before.state.worldTick);assert.deepEqual(run.state.stockpilesById,before.state.stockpilesById);
 const final=snapshotSect(run);assert.deepEqual(snapshotSect(restoreSect(final)),final);
});
