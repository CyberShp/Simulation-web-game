import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {toArt,isArtWalkable,HOME_STAIRS_WALK} from '../../../apps/courtyard/courtyard-space.mjs';

// Observed in kitchen desktop run-04, world tick 65060: a real body leaves
// the hall threshold and follows the existing west passage over the front stairs.
test('the hall threshold and observed westbound body follow visible stair treads',()=>{
 let s=validateSave(structuredClone(seed.state));s=dispatchCommand(s,{name:'enableCourtyardTerrain',args:[]}).state;
 const from={x:28,y:12},to={x:19.440860215053767,y:25.714285714285715};
 const observed={x:27.752128279088787,y:12.397164164446393};
 const options={terrain:true,domain:true,west:true,valley:true,residences:true,services:true};
 assert.deepEqual(toArt(from.x,from.y),{x:680,y:315});
 const art=toArt(observed.x,observed.y);assert.equal(isArtWalkable(art.x,art.y,options),true);
 assert.equal(meterSweep(s,from,to).blocked,false);
 const n=Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/.025);
 for(let i=0;i<=n;i++){
  const p=toArt(from.x+(to.x-from.x)*i/n,from.y+(to.y-from.y)*i/n);
  assert.equal(isArtWalkable(p.x,p.y,options),true,`stair route sample ${i}/${n}`);
 }
 assert.equal(n+1,648);assert.ok(HOME_STAIRS_WALK.length>=6);
 for(const [x,y]of[[570,375],[800,375],[680,300],[650,200]])assert.equal(isArtWalkable(x,y,options),false,`rail or roof ${x}/${y}`);
});
