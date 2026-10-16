import test from 'node:test';
import assert from 'node:assert/strict';
import {spatialPrefab} from '../../../src/simulation/ea-sr-spatial.mjs';
import {BUILDING_GRID} from '../../../src/simulation/ea-building-grid.mjs';

// U-156 retires the estate stage images; physical furniture and study slots remain covered.
test('SR-XF-004-AC-01: clinic retains four physical beds',()=>{
 const prefab=spatialPrefab({type:'clinic',level:1,buildingGridVersion:BUILDING_GRID.version});
 assert.equal(prefab.furniture.filter(item=>item.kind==='bed').length,4);
});

test('SR-XF-004-AC-01: library retains two physical study desks and slots',()=>{
 const prefab=spatialPrefab({type:'library',level:1,buildingGridVersion:BUILDING_GRID.version});
 assert.equal(prefab.furniture.filter(item=>item.kind==='desk').length,2);
 assert.equal(prefab.slots.filter(slot=>slot.kind==='study').length,2);
});
