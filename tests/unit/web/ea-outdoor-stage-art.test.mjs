import test from 'node:test';
import assert from 'node:assert/strict';
import {spatialPrefab} from '../../../src/simulation/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../../../src/simulation/ea-building-grid.mjs';

// U-156 retires the estate stage images; authoritative outdoor capacity remains covered.
const cases={farm:{work:4,cultivate:0},lumber:{work:2,cultivate:0},quarry:{work:2,cultivate:0},meditation:{work:2,cultivate:4}};
for(const [type,{work,cultivate}] of Object.entries(cases))test(`SR-XF-004-AC-01: ${type} retains shared work and cultivation capacity`,()=>{
 const prefab=spatialPrefab({type,level:1,buildingGridVersion:BUILDING_GRID.version});
 assert.equal(prefab.slots.filter(slot=>slot.kind==='work').length,work);
 assert.equal(prefab.slots.filter(slot=>slot.kind==='cultivate').length,cultivate);
});
