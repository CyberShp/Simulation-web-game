import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {meterFindPath,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {validateScenic} from '../../../src/simulation/ea-scenic.mjs';
function enabled(){let s=validateSave(seed.state);for(const name of ['enableCourtyardTerrain','enableSectDomain','enableWestValley','enableEastResidences','enableEastServices'])s=dispatchCommand(s,{name,args:[]}).state;return s;}
const from={x:188.51598325826538,y:64.88494205153805},goal={x:-37.1,y:15.2};
test('a service-yard to quarry work route keeps every painted-road turn in its saved actor',()=>{
 const s=enabled(),path=meterFindPath(s,from,goal,{maxSnap:0});assert(path);assert(path.length>160);assert(path.length<=512);
 let at=from;for(const p of path){assert.equal(meterSweep(s,at,p).blocked,false);at=p;}
 const actor={...s.master.scenic,...from,path,goal},bytes=JSON.stringify(actor);
 assert.equal(validateScenic(actor,s),true);assert.equal(validateScenic(JSON.parse(bytes),s),true);assert.equal(JSON.stringify(actor),bytes);
});
test('expanded routes still reject blocked segments, nonfinite points and excessive data; old scenes keep their limit',()=>{
 const s=enabled(),path=meterFindPath(s,from,goal,{maxSnap:0}),actor={...s.master.scenic,...from,path,goal};
 for(const bad of [{...actor,path:Array.from({length:513},()=>({...from}))},{...actor,path:[{x:NaN,y:65}]},{...actor,path:[{x:200,y:25}]}])assert.equal(validateScenic(bad,s),false);
 const old=validateSave(seed.state),sc=old.master.scenic;assert.equal(validateScenic({...sc,path:Array.from({length:81},()=>({x:sc.x,y:sc.y}))},old),false);
});
