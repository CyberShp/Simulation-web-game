import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {visibleBodyPointClear,visibleBodyRouteClear,meterFindPath,nearestVisibleBodyGround,meterSweep,spatialRevision,spatialSlots} from '../../../src/simulation/ea-sr-spatial.mjs';
import {advanceScenic} from '../../../src/simulation/ea-scenic.mjs';
import {toArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';
import {feetClear} from '../../acceptance/courtyard-six-residents-body.mjs';
const failures=[{x:54.07518457680216,y:19.625717798675076},{x:51.17213658336199,y:15.670223160342807}],domain={enabled:true,northLibraryEnabled:true,residencesEnabled:true,servicesEnabled:true};
function fixture(){let s=validateSave(structuredClone(seed.state));for(const name of ['enableCourtyardTerrain','enableSectDomain','enableEastResidences','enableEastServices','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;return s;}
test('the two observed early east-road centres remain blocked by the unchanged picture ground',()=>{const s=fixture();for(const p of failures){const a=toArt(p.x,p.y);assert.equal(isArtWalkable(a.x,a.y,{northLibrary:true,residences:true,services:true}),false);assert.equal(visibleBodyPointClear(s,p),false);}});
test('an inherited rest or study body walks the bounded recovery prefix while retaining its slot',()=>{
 for(const action of ['rest','study']){
  const s=fixture(),p=action==='rest'?s.master:s.personsById['person:lu-zhiwei'],actor=action==='rest'?p.scenic:p.mind.scenic,from=failures[action==='rest'?0:1];
  const library={id:13,instanceId:'building:yunxiu:13',type:'library',level:1,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:44,y:-16},condition:100,enabled:true};if(action==='study')s.buildingsById[library.instanceId]=library;
  const building=action==='rest'?s.buildings.find(b=>b.type==='hall'):library,slot=spatialSlots(building,action)[0],id='activity:fixture:'+action,rid='reservation:fixture:'+action;
  p.activityId=id;s.activitiesById[id]={id,kind:'facility',personId:p.personId,action,phase:'navigating',targetId:building.instanceId,slotId:slot.id,reservationId:rid};s.reservationsById[rid]={id:rid,kind:'slot',personId:p.personId,activityId:id,slotId:slot.id};Object.assign(actor,from,{goal:{...slot.position},revision:spatialRevision(s)});
  const before=JSON.stringify(s),nearest=nearestVisibleBodyGround(s,actor),path=meterFindPath(s,actor,slot.position,{maxSnap:0});assert.equal(JSON.stringify(s),before,'route queries preserve world');assert(path?.length>1);assert(nearest.distance<=.11);assert.equal(meterSweep(s,from,path[0]).blocked,false);assert(visibleBodyRouteClear(s,path[0],path.slice(1)));actor.path=path;
  let legal=false,n=0;while(actor.path.length&&n++<20){const previous={x:actor.x,y:actor.y};advanceScenic(actor,4.6,s);assert.equal(meterSweep(s,previous,actor).blocked,false);const now=visibleBodyPointClear(s,actor);if(legal)assert(now,'body cannot leave visible ground after recovery');if(now)legal=true;}
  assert(legal);assert(Math.hypot(actor.x-from.x,actor.y-from.y)>.01);assert.deepEqual(actor.goal,slot.position);assert.equal(p.activityId,id);assert.equal(s.activitiesById[id].slotId,slot.id);assert.equal(s.reservationsById[rid].activityId,id);
 }
});
