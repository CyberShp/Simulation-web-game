import test from 'node:test';
import assert from 'node:assert/strict';
import {createMedicineSupplyScenario} from '../../fixtures/medicine-supply.mjs';
import {commandSect,advanceSect,viewSect} from '../../../apps/courtyard/sect-sim.mjs';
import {carriedStockpile} from '../../../src/simulation/ea-sr-economy.mjs';

test('invalid stock goals are rejected atomically and private master medicine does not satisfy public supply',()=>{
 const f=createMedicineSupplyScenario(),s=f.session.state;
 const id=carriedStockpile(s);s.stockpilesById[id].pills.heal=2; // Declared private-stock condition.
 for(const target of [-1,11,1.5,NaN]){const before=JSON.stringify(f.session.state);assert.equal(commandSect(f.session,{type:'medicine-supply',enabled:true,target}).ok,false);assert.equal(JSON.stringify(f.session.state),before);}
 assert.equal(commandSect(f.session,{type:'medicine-supply',enabled:true,target:2}).ok,true);
 advanceSect(f.session,.1);const v=viewSect(f.session).medicineSupply;
 assert.equal(v.home,0);assert.equal(v.local,0);assert.equal(v.committed,0);assert.equal(f.session.state.medicineSupply.active.kind,'materials');
 assert.equal(f.session.state.stockpilesById[id].pills.heal,2);
});

test('public pills reserved by a real transport remain part of supply commitments before physical pickup',()=>{
 const f=createMedicineSupplyScenario(),s=f.session.state;
 s.stockpilesById[f.siteStockpileId].pills.heal=2; // Configured finished stock at the real room.
 assert.equal(commandSect(f.session,{type:'medicine-supply',enabled:true,target:2}).ok,true);
 advanceSect(f.session,.1);const next=f.session.state,a=next.medicineSupply.active,w=next.workOrdersById[a.workOrderId],v=viewSect(f.session).medicineSupply;
 assert.equal(a.kind,'deliver');assert.equal(w.phase,'to-source');assert.equal(next.stockpilesById[f.siteStockpileId].pills.heal,0);
 assert.equal(v.home,0);assert.equal(v.transit,2);assert.equal(v.committed,2);
 assert.equal(Object.values(next.workOrdersById).filter(w=>w.kind==='sr-crafting').length,0);
});
