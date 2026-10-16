/** Shared healing activity check from the historical opening fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../../src/simulation/ea-opening-sim.mjs';

test('opening healing reaches an executing indoor activity',()=>{
 let state=sim.initial();
 state=sim.dispatchCommand(state,{name:'masterAction',args:['heal']}).state;sim.tick(state,10);
 const activity=state.activitiesById[state.master.activityId];
 assert.equal(activity?.phase,'executing');
 assert.equal(activity.action,'heal');
});
