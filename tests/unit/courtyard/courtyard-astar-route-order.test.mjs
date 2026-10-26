import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {meterFindPath,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';

const scene=()=>({spatial:{version:'spatial-metres-1',extentVersion:'courtyard-96-1'},buildings:[]});
const well=(id,x,y)=>({id,type:'well',level:1,buildingGridVersion:'building-units-1',transform:{x,y}});
// Expected waypoint bytes came from the frozen pre-change cb8538 control.
function route(state,from,to,radius=.26){
 const before=JSON.stringify(state),path=meterFindPath(state,from,to,{maxSnap:0,radius});
 assert.equal(JSON.stringify(state),before);
 if(path){let previous=from;for(const point of path){assert.equal(meterSweep(state,previous,point,radius).blocked,false);previous=point;}}
 return path;
}

test('cost pruning preserves established waypoint order around straight and diagonal obstacles',()=>{
 const one=scene();one.buildings.push(well('one',10,10));
 assert.deepEqual(route(one,{x:8,y:9.8},{x:15,y:9.8},.3),[{x:13.5,y:9.5},{x:15,y:9.8}]);
 const corner=scene();corner.buildings.push(well('one',10,10),well('two',12,12));
 assert.deepEqual(route(corner,{x:9,y:13},{x:15,y:9}),[{x:9.5,y:10},{x:10,y:9.5},{x:15,y:9}]);
});

test('same-target, outside and blocked-target results retain the pre-change route contract',()=>{
 assert.deepEqual(route(scene(),{x:8,y:20},{x:8,y:20}),[]);
 assert.equal(route(scene(),{x:8,y:20},{x:100,y:20}),null);
 const blocked=scene();blocked.buildings.push(well('one',10,10));
 assert.equal(route(blocked,{x:8,y:9.8},{x:11,y:11}),null);
});

test('narrow indoor routes keep their radius-specific waypoints and rejection',()=>{
 const from={x:24.5,y:10},to={x:24.5,y:11};
 assert.deepEqual(route(SIM.initial({sr:true}),from,to,.1),[{x:25.5,y:10},{x:26,y:10.5},{x:25.5,y:11},{x:24.5,y:11}]);
 assert.equal(route(SIM.initial({sr:true}),from,to,.8),null);
});
