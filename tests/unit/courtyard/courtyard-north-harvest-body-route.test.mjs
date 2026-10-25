import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {visibleBodyWalkPath,meterFindPath,meterDoorPermit,spatialRevision,visibleBodyPointClear,visibleBodyRouteClear,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {advanceScenic} from '../../../src/simulation/ea-scenic.mjs';
import {feetClear} from '../../acceptance/courtyard-six-residents-body.mjs';
const from={x:28,y:12.6},goal={x:23,y:17.6},failure={x:25.092907245846806,y:15.507092754153188};
const domain={enabled:true,northLibraryEnabled:true};
function fixture(){let s=validateSave(structuredClone(seed.state));for(const name of ['enableCourtyardTerrain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;return s;}
test('the observed harvest road edge fails the unchanged full-body checks',()=>{const s=fixture();assert.equal(visibleBodyPointClear(s,failure),false);assert.equal(feetClear({id:'person:master',...failure},domain,s),false);assert.equal(visibleBodyRouteClear(s,from,[goal]),false);});
test('default harvest navigation completes over measured body ground and retains its owning activity',()=>{
 const s=fixture(),actor=s.master.scenic,id='activity:fixture:harvest';s.master.activityId=id;s.activitiesById[id]={id,kind:'sr-harvest',personId:'person:master',target:{...goal},phase:'moving'};
 const path=meterFindPath(s,from,goal,{maxSnap:0});assert(path?.length);assert(visibleBodyRouteClear(s,from,path));Object.assign(actor,from,{path,goal:{...goal},revision:spatialRevision(s)});
 let steps=0;while(actor.path.length&&steps++<100){const before={x:actor.x,y:actor.y};advanceScenic(actor,4.6,s);assert.equal(meterSweep(s,before,actor).blocked,false);assert(feetClear({id:'person:master',x:actor.x,y:actor.y},domain,s));}
 assert.equal(actor.path.length,0);assert(Math.hypot(actor.x-goal.x,actor.y-goal.y)<.001);assert.equal(s.master.activityId,id);assert.deepEqual(s.activitiesById[id].target,goal);
});
test('a retained north road shortcut stops before its body leaves the visible ground',()=>{const s=fixture(),actor=s.master.scenic;Object.assign(actor,from,{path:[{...goal}],goal:{...goal},revision:spatialRevision(s)});assert.equal(meterDoorPermit(s,actor,from,actor.path,failure),false);assert.deepEqual(actor.path,[]);assert.equal(actor.x,from.x);assert.equal(actor.y,from.y);});

test('an impassable full-body yielding goal is rejected before graph search',()=>{
 const s=fixture(),start={x:35.64073051603313,y:2.5614780208112133},target={x:36,y:1.5};
 assert.equal(visibleBodyPointClear(s,start),true);assert.equal(visibleBodyPointClear(s,target),false);
 assert.equal(meterSweep(s,start,target).blocked,false,'physical collision alone permits the observed candidate');
 assert.equal(meterFindPath(s,start,target,{maxSnap:0}),null);
 assert.equal(meterFindPath(s,start,target,{maxSnap:0,visibleBody:true}),null);
});
test('an inherited north road edge can still walk its recovery prefix and continue its harvest',()=>{
 const s=fixture(),actor=s.master.scenic,id='activity:fixture:north-harvest-recovery';s.master.activityId=id;s.activitiesById[id]={id,kind:'sr-harvest',personId:'person:master',phase:'moving',target:{...goal}};
 Object.assign(actor,failure,{revision:spatialRevision(s),goal:{...goal}});actor.path=visibleBodyWalkPath(s,actor,goal);assert(actor.path?.length>1);
 const before={x:actor.x,y:actor.y};let steps=0;while(actor.path.length&&steps++<100){advanceScenic(actor,4.6,s);}
 assert.equal(actor.path.length,0);assert(Math.hypot(actor.x-before.x,actor.y-before.y)>.1);assert(Math.hypot(actor.x-goal.x,actor.y-goal.y)<.001);assert.equal(s.master.activityId,id);assert.deepEqual(s.activitiesById[id].target,goal);
});
