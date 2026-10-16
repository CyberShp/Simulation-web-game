import test from 'node:test';
import assert from 'node:assert/strict';
import {spatialPrefab} from '../../../src/simulation/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../../../src/simulation/ea-building-grid.mjs';

// U-156 retires the estate stage images; authoritative work slots remain covered.
const cases={alchemy:{work:1,furniture:'furnace'},well:{work:1},granary:{work:4},kitchen:{work:1,furniture:'stove'},workshop:{work:2,furniture:'bench'},watchtower:{work:0}};
for(const [type,{work,furniture}] of Object.entries(cases))test(`SR-XF-004-AC-01: ${type} retains shared work slots and furniture`,()=>{
 const prefab=spatialPrefab({type,level:1,buildingGridVersion:BUILDING_GRID.version});
 assert.equal(prefab.slots.filter(slot=>slot.kind==='work').length,work);
 if(furniture)assert.ok(prefab.furniture.some(item=>item.kind===furniture));
});
