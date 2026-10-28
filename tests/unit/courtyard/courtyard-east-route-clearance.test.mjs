import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {meterFindPath,spatialRevision,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {advanceScenic} from '../../../src/simulation/ea-scenic.mjs';
import {createSectSession,commandSect,advanceSect,snapshotSect,restoreSect,validateSect} from '../../../apps/courtyard/sect-sim.mjs';

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

for(const north of [false,true])test(`a saved east terrace walk retains its goal through automatic handoff (north library ${north})`,()=>{
 const session=createSectSession(),from={x:127.91473899450506,y:46.896315251373736},goal={x:135,y:46.6};
 if(north)for(const type of ['enable-courtyard-terrain','enable-north-library'])assert.equal(commandSect(session,{type}).ok,true);
 // Explicit retained-route fixture: the coordinates and polyline were captured
 // before the old long-segment planner stopped at this east terrace corner.
 const master=session.state.master;
 Object.assign(master.scenic,from);Object.assign(master.position,from);Object.assign(master.location,from);
 assert.equal(commandSect(session,{type:'move',...goal}).ok,true);
 assert.equal(commandSect(session,{type:'auto'}).ok,true);
 session.state.master.scenic.path=[{x:129.5,y:46.5},{...goal}];
 const saved=snapshotSect(session),restored=restoreSect(JSON.stringify(saved));
 assert.deepEqual(snapshotSect(restored),saved,'loading preserves the retained route, feet and world clock');
 advanceSect(restored,.1);
 let actor=restored.state.master.scenic;
 assert.deepEqual({x:actor.x,y:actor.y},from,'replanning does not teleport across the rejected step');
 assert.equal(restored.state.worldTick,saved.state.worldTick+1);
 assert.deepEqual(actor.goal,goal);assert.notDeepEqual(actor.path,saved.state.personsById['person:master'].scenic.path);
 assert.equal(restored.automation.activeAction,'manual-walk');assert.equal(restored.state.master.activityId,null);
 const repaired=restoreSect(JSON.stringify(snapshotSect(restored)));
 for(let i=0;i<100&&Math.hypot(actor.x-goal.x,actor.y-goal.y)>1e-8;i++){
  assert.deepEqual(actor.goal,goal);assert.equal(restored.automation.activeAction,'manual-walk');
  assert.equal(restored.state.master.activityId,null,'autonomy waits for the player walk to arrive');
  advanceSect(restored,.1);advanceSect(repaired,.1);
  actor=restored.state.master.scenic;
 }
 assert(Math.hypot(actor.x-goal.x,actor.y-goal.y)<1e-8,'the retained goal is physically reached');
 assert.deepEqual(snapshotSect(repaired),snapshotSect(restored));assert.equal(validateSect(restored),true);
});

test('an east terrace route without a reachable retained goal stops at the actual feet',()=>{
 const s=validateSave(structuredClone(seed.state)),actor=s.master.scenic;
 const from={x:127.91473899450506,y:46.896315251373736},goal={x:10000,y:46.6};
 Object.assign(actor,{...from,path:[{x:129.5,y:46.5},goal],goal,revision:spatialRevision(s)});
 s.master.action='walk';
 Object.assign(s.master.position,from);Object.assign(s.master.location,from);
 assert.equal(meterFindPath(s,from,goal,{maxSnap:0}),null);
 advanceScenic(actor,4.6,s);
 assert.deepEqual({x:actor.x,y:actor.y},from);assert.deepEqual(actor.path,[]);assert.equal(actor.goal,null);
});
