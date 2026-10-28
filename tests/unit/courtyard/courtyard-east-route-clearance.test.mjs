import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {meterFindPath,spatialRevision,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {advanceScenic} from '../../../src/simulation/ea-scenic.mjs';

test('east terrace routes remain executable across fractional approach points and walking speeds',()=>{
 // Finite movement fixtures from the failed public walk and second stone trip.
 // The complete public construction/material/reload chain remains in sect-sim.
 const starts=[{x:127.5,y:47},{x:127.98318937434719,y:46.8792026564132},
  {x:127.91473899450506,y:46.896315251373736},{x:126.5,y:47},{x:135,y:46.6}];
 for(const from of starts)for(const speed of [4.6,4.608,4.16]){
  let s=validateSave(structuredClone(seed.state));
  s=dispatchCommand(s,{name:'enableSectDomain',args:[]}).state;
  const goal=from.x===135?{x:127.5,y:47}:{x:135,y:46.6};
  const path=meterFindPath(s,from,goal,{maxSnap:0});assert(path?.length);
  const actor=s.master.scenic;
  Object.assign(actor,{...from,path,goal,revision:spatialRevision(s)});
  Object.assign(s.master.position,from);Object.assign(s.master.location,from);
  for(let n=0;n<100&&actor.path.length;n++){
   const before={x:actor.x,y:actor.y};advanceScenic(actor,speed,s);
   assert.equal(meterSweep(s,before,actor).blocked,false,'actual step retains static collision');
  }
  assert(Math.hypot(actor.x-goal.x,actor.y-goal.y)<1e-8,
   `route must reach its destination, not clear early at ${JSON.stringify({from,speed,feet:{x:actor.x,y:actor.y}})}`);
 }
});
