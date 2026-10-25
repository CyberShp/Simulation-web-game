import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {courtyardMainArtWalkable,courtyardSouthGroundPoint,WALK_POLYGONS} from '../../../src/simulation/ea-courtyard-visible-ground.mjs';
import {legacyToArt} from '../../../src/simulation/ea-courtyard-east-visible-geometry.mjs';
import {toArt,toWorld,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';
import {placementIssue,visibleBodyPointClear,meterFindPath,spatialRevision,meterDoorPermit} from '../../../src/simulation/ea-sr-spatial.mjs';
import {advanceScenic} from '../../../src/simulation/ea-scenic.mjs';
import {feetClear} from '../../acceptance/courtyard-six-residents-body.mjs';
const failure={x:20.811952655578246,y:39.5829613180299},home={x:28,y:12.6},goal={x:14,y:44.6},domain={enabled:true,northLibraryEnabled:true};
function fixture(){let s=validateSave(structuredClone(seed.state));for(const name of ['enableCourtyardTerrain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;return s;}
test('shared original ground preserves fixed image samples and polygon boundaries',()=>{
 const points=[];for(let x=78;x<=1440;x+=29)for(let y=407;y<=941;y+=23)points.push([x,y]);for(const poly of WALK_POLYGONS)for(const [x,y]of poly)for(const delta of [-1e-6,0,1e-6])points.push([x+delta,y+delta]);
 for(const [x,y]of points){assert.equal(courtyardMainArtWalkable(x,y),isArtWalkable(x,y,{terrain:false,domain:false,west:false}));const world=toWorld(x,y);if(world.y>34&&x>=78&&x<=1440){const a=toArt(world.x,world.y),b=legacyToArt(world.x,world.y);assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-7);if(b.x>=78&&b.x<=1440)assert.equal(courtyardSouthGroundPoint(world),courtyardMainArtWalkable(b.x,b.y));}}
});
test('the observed original courtyard shortcut is rejected by shared and independent ground',()=>{const s=fixture();assert.equal(visibleBodyPointClear(s,failure),false);assert.equal(feetClear({id:'person:master',...failure},domain,s),false);const actor=s.master.scenic;Object.assign(actor,home,{path:[failure],goal:{...goal}});assert.equal(meterDoorPermit(s,actor,home,actor.path,failure),false);});
test('herb travel completes along the existing courtyard paths with its activity target intact',()=>{const s=fixture(),actor=s.master.scenic,id='activity:fixture:main-herb';s.master.activityId=id;s.activitiesById[id]={id,kind:'sr-harvest',personId:'person:master',phase:'moving',target:{...goal}};Object.assign(actor,home,{path:meterFindPath(s,home,goal,{maxSnap:0}),goal:{...goal},revision:spatialRevision(s)});assert(actor.path?.length);let n=0;while(actor.path.length&&n++<300){advanceScenic(actor,4.6,s);assert(feetClear({id:s.master.personId,x:actor.x,y:actor.y},domain,s));}assert.equal(actor.path.length,0);assert(Math.hypot(actor.x-goal.x,actor.y-goal.y)<.001);assert.equal(s.master.activityId,id);assert.deepEqual(s.activitiesById[id].target,goal);});

test('construction connectivity starts at the real main-hall entrance on visible ground',()=>{
 let s=fixture();for(const name of ['enableSectDomain','enableWestValley','enableWestWorkshops'])s=dispatchCommand(s,{name,args:[]}).state;
 assert.equal(visibleBodyPointClear(s,{x:32,y:56}),false,'historical generic anchor is outside the approved drawing');
 assert.equal(visibleBodyPointClear(s,home),true);
 assert.equal(placementIssue(s,'workshop',-62,4,{checkPeople:false}),'');
 assert.equal(placementIssue(s,'alchemy',-76,2,{checkPeople:false}),'');
});
