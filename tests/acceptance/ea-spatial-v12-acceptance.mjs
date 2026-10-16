/** Shared construction progress and save validation from the historical opening fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../../src/simulation/ea-opening-sim.mjs';
import {constructionView} from '../../apps/web/ea-construction-view.mjs';

test('public construction exposes foundation, structure and finishing before completion',()=>{
 let state=sim.initial();state=sim.dispatchCommand(state,{name:'masterAction',args:['heal']}).state;sim.tick(state,40);
 state=sim.dispatchCommand(state,{name:'build',args:['farm',2,2]}).state;
 for(const stage of ['foundation','structure','finishing']){
  for(let i=0;i<1500&&constructionView(state)?.stage!==stage;i++)sim.tick(state,.1);
  assert.equal(constructionView(state)?.stage,stage);sim.validateSave(JSON.parse(JSON.stringify(state)));
 }
 for(let i=0;i<1500&&sim.constructionStatus(state);i++)sim.tick(state,.1);
 assert.equal(sim.constructionStatus(state),null);
});
