import test from 'node:test';
import assert from 'node:assert/strict';
import {createMedicineMaterialsScenario} from '../../fixtures/medicine-materials.mjs';
import {commandSect,advanceSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';

test('medicine shortages favor delivering existing grain before planting more or starting medicine work',()=>{
 const f=createMedicineMaterialsScenario({condition:'food-shortage'});assert.equal(f.session.state.resources.food,5);assert(commandSect(f.session,{type:'medicine-supply',enabled:true,target:2}).ok);
 let receipt=null;
 for(let n=0;n<1000;n++){
  if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);
  advanceSect(f.session,.1);const s=f.session.state;
  assert.equal(s.economy.starvation,0);
  const w=Object.values(s.workOrdersById).find(w=>w.kind==='transport'&&w.cargo.food>0&&w.phase==='delivered');
  if(w){receipt=w;assert(s.resources.food>=35);break;}
  assert.equal(s.medicineSupply.active,null);
 }
 assert(receipt,'existing harvest reaches the public store');assert.equal(receipt.sourceStockpileId,`stockpile:${f.grainId}`);assert.equal(receipt.targetStockpileId,f.sourceStockpileId);assert(f.session.state.stockpilesById[`stockpile:${f.grainId}`].resources.food>=2);validateSect(f.session);
});
