import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand,tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {meterCanStand,meterSweep,visibleBodyPointClear} from '../../../src/simulation/ea-sr-spatial.mjs';
import {geometryRevision} from '../../../src/simulation/ea-scene-geometry.mjs';

test('public wood harvest keeps its source anchor and chooses a reachable visible body target after geometry changes',()=>{
 let s=validateSave(structuredClone(seed.state));
 for(const name of ['enableCourtyardTerrain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;
 const before={x:s.master.scenic.x,y:s.master.scenic.y};
 s=dispatchCommand(s,{name:'startMasterHarvest',args:['wood']}).state;
 const id=s.master.activityId,a=s.activitiesById[id],anchor={...a.anchor},patch={...s.srEconomy.patches.wood.position};
 const checked=()=>{assert(Math.hypot(a.target.x-anchor.x,a.target.y-anchor.y)<=3+1e-9);assert(meterCanStand(s,a.target,.26));assert(visibleBodyPointClear(s,a.target));let from=s.master.scenic;for(const point of from.path){assert.equal(meterSweep(s,from,point,.26).blocked,false);from=point;}};
 assert.deepEqual({x:s.master.scenic.x,y:s.master.scenic.y},before);assert.equal(anchor.x,35);assert.equal(anchor.y,17.6);checked();
 // Re-select an old physical-only target after a real geometry revision changes.
 a.target={...anchor};s.master.scenic.goal={...anchor};s.spatial.geometryRevision++;
 const progress=a.progressTicks,reserved=a.reservedQuantity;
 tick(s,.1);assert.equal(s.master.activityId,id);assert.equal(s.activitiesById[id],a);assert.deepEqual(a.anchor,anchor);assert.equal(a.progressTicks,progress);assert.equal(a.reservedQuantity,reserved);assert.deepEqual(s.srEconomy.patches.wood.position,patch);assert.equal(s.master.scenic.revision,geometryRevision(s));checked();
 const bytes=JSON.stringify(s);s=validateSave(JSON.parse(bytes));assert.equal(JSON.stringify(s),bytes);
 for(let i=0;i<5000&&s.master.activityId===id;i++){const from={x:s.master.scenic.x,y:s.master.scenic.y};tick(s,.1);assert.equal(meterSweep(s,from,s.master.scenic,.26).blocked,false);assert(visibleBodyPointClear(s,s.master.scenic));}
 assert.notEqual(s.master.activityId,id);assert.equal(s.stockpilesById['stockpile:carried:master'].resources.wood,12);assert.equal(Object.values(s.factsById).filter(f=>f.operation==='manual-harvest'&&f.resource==='wood').length,1);
});
