import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {meterFindPath,meterCanStand,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';

test('each route caller owns its points and reads leave the world unchanged',()=>{
 const s=SIM.initial({sr:true}),before=JSON.stringify(s),from={x:28,y:13},to={x:40,y:25};
 const first=meterFindPath(s,from,to,{maxSnap:0}),expected=structuredClone(first);
 assert(first?.length);first[0].x=-1000;first.splice(1);
 assert.deepEqual(meterFindPath(s,from,to,{maxSnap:0}),expected);
 let previous=from;for(const point of expected){assert(!meterSweep(s,previous,point).blocked);previous=point;}
 assert.equal(JSON.stringify(s),before);
});

test('geometry changes invalidate both successful and failed routes in one world',()=>{
 const s=SIM.initial({sr:true}),from={x:28,y:13},to={x:40,y:25},old=structuredClone(s.buildings[0].transform);
 assert(meterCanStand(s,to));assert(meterFindPath(s,from,to,{maxSnap:0}));
 s.buildings[0].transform={x:40,y:25,orientation:'south'};
 assert(!meterCanStand(s,to));assert.equal(meterFindPath(s,from,to,{maxSnap:0}),null);
 s.buildings[0].transform=old;
 assert(meterCanStand(s,to));assert(meterFindPath(s,from,to,{maxSnap:0}));
});

test('radius and target snapping retain their separate route conditions',()=>{
 const s=SIM.initial({sr:true}),from={x:28,y:13},wall={x:24,y:4};
 assert.equal(meterFindPath(s,from,wall,{maxSnap:0}),null);
 const snapped=meterFindPath(s,from,wall,{maxSnap:2});assert(snapped?.length);
 assert.notDeepEqual(snapped.at(-1),wall);
 const narrowFrom={x:24.5,y:10},narrowTo={x:24.5,y:11};
 assert(meterFindPath(s,narrowFrom,narrowTo,{maxSnap:0,radius:.1}));
 assert.equal(meterFindPath(s,narrowFrom,narrowTo,{maxSnap:0,radius:.8}),null);
 assert(meterFindPath(s,narrowFrom,narrowTo,{maxSnap:0,radius:.1}));
});
