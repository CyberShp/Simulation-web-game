import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {routeReachable,inheritReachabilityProof} from '../../../src/simulation/ea-route-reachability.mjs';
import {scenicFindPath,scenicCanStand} from '../../../src/simulation/ea-scene-geometry.mjs';
import {residentialHousingView,inheritResidentialGeometryCache} from '../../../src/simulation/ea-residential-housing.mjs';
import {createSectSession,commandSect,snapshotSect,viewSect} from '../../../apps/courtyard/sect-sim.mjs';
import {personLifeSummary} from '../../../src/simulation/ea-life.mjs';
const copy=s=>SIM.validateSave(JSON.parse(JSON.stringify(s)));

test('availability follows the actual path after movement and isolates geometry changes between command worlds',()=>{
 const s=SIM.initial({sr:true}),from={x:28,y:13},to={x:40,y:25},before=JSON.stringify(s);
 assert(scenicCanStand(s,from));assert(scenicCanStand(s,to));
 for(const start of [from,{x:28.1,y:13},from]){
  assert.equal(routeReachable(s,start,to,'master'),scenicFindPath(s,start,to,{maxSnap:0})!==null);
 }
 const next=copy(s);inheritReachabilityProof(s,next);assert(routeReachable(next,from,to,'master'));
 next.buildings[0].transform={x:40,y:25,orientation:'south'};
 assert.equal(scenicCanStand(next,to),false);assert.equal(routeReachable(next,from,to,'master'),false);
 assert(routeReachable(s,from,to,'master'));assert.equal(JSON.stringify(s),before);
 assert.equal(routeReachable(s,{x:-200,y:-200},to,'master'),false);
 assert(routeReachable(s,from,to,'master'));
});

test('inherited bed geometry binds the new world and still respects current building availability',()=>{
 const s=SIM.initial({sr:true});s.story.opening.hallPhase='complete';
 residentialHousingView(s);const before=JSON.stringify(s),next=copy(s);inheritResidentialGeometryCache(s,next);
 assert.deepEqual(residentialHousingView(next),residentialHousingView(copy(next)));
 next.buildings[0].enabled=false;
 const changed=residentialHousingView(next);assert.deepEqual(changed,residentialHousingView(copy(next)));
 assert.equal(changed.counts.usable,0);assert.equal(JSON.stringify(s),before);
});

test('walking reports actual movement without assigning a nearby house as its activity facility',()=>{
 const run=createSectSession(),result=commandSect(run,{type:'move',x:30,y:25});assert(result.ok,result.error);
 const before=JSON.stringify(snapshotSect(run)),life=personLifeSummary(run.state,run.state.master);
 assert.equal(life.activity,'walk');assert.equal(life.facilityId,null);assert.equal(life.facilityName,null);
 viewSect(run);assert.equal(JSON.stringify(snapshotSect(run)),before);
 assert(commandSect(run,{type:'pause',paused:true}).ok);const paused=JSON.stringify(snapshotSect(run));viewSect(run);assert.equal(JSON.stringify(snapshotSect(run)),paused);
});
