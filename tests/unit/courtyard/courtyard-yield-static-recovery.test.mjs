import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {meterSweep,meterBodyBlocker,visibleBodyRouteClear,tickSpatial,COURTYARD_WALK_RATE} from '../../../src/simulation/ea-sr-spatial.mjs';
import {releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
const copy=x=>structuredClone(x),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(){
 let s=validateSave(copy(seed.state));for(const name of ['enableCourtyardTerrain','enableSectDomain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;
 const p=s.personsById['person:lu-zhiwei'];releaseBodyActivity(s,p);
 // Explicit rule fixture at the measured north-library desk bend. These
 // activity records test route recovery; full normal-world replay is separate.
 const b={id:80,instanceId:'building:yunxiu:80',type:'library',level:1,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:44,y:-16,orientation:'south'}};s.buildings.push(b);s.buildingsById[b.instanceId]=b;s.spatial.geometryRevision++;
 const a=p.mind.scenic;Object.assign(a,{x:47.815791431651036,y:-9.566839481587616,path:[{x:47,y:-9.4}],goal:{x:47,y:-9.4},bodyYield:{kind:'mutual-corridor',requestedBy:s.master.personId,startedTick:s.worldTick,target:{x:46,y:-12},path:[{x:46,y:-12}]}});
 p.activityId='activity:test-static-yield';p.mind.learning={id:'qingguard',progress:48.5,total:80,mode:'deepen'};
 s.activitiesById[p.activityId]={id:p.activityId,kind:'facility',personId:p.personId,action:'study',phase:'waiting',targetId:b.instanceId,slotId:`${b.instanceId}/slot:desk:2`,reservationId:'reservation:test-static-yield',startedTick:s.worldTick};
 s.reservationsById['reservation:test-static-yield']={id:'reservation:test-static-yield',kind:'slot',personId:p.personId,activityId:p.activityId,slotId:`${b.instanceId}/slot:desk:2`};return{s,p,a};
}
test('a visible yield route blocked by static collision recovers without losing the original task',()=>{
 const {s,p,a}=fixture(),start={x:a.x,y:a.y},original=copy({activity:s.activitiesById[p.activityId],reservation:s.reservationsById['reservation:test-static-yield'],learning:p.mind.learning,path:a.path,goal:a.goal}),bad=copy(a.bodyYield.path),q=bad[0],d=distance(a,q),n=.13*COURTYARD_WALK_RATE,to={x:a.x+(q.x-a.x)*n/d,y:a.y+(q.y-a.y)*n/d};
 assert.equal(meterSweep(s,a,to).blocked,true);assert.equal(meterBodyBlocker(s,a,a,to),null);assert.equal(visibleBodyRouteClear(s,a,[to]),true);
 tickSpatial(s);assert.equal(distance(start,a),0);assert.notDeepEqual(a.bodyYield?.path,bad);
 for(let i=0;i<40&&a.bodyYield;i++){const before={x:a.x,y:a.y};tickSpatial(s);assert(distance(before,a)<=.13*COURTYARD_WALK_RATE+1e-7);assert.equal(meterSweep(s,before,a).blocked,false);}
 assert.equal(a.bodyYield,undefined);
 assert.deepEqual({activity:s.activitiesById[p.activityId],reservation:s.reservationsById['reservation:test-static-yield'],learning:p.mind.learning,path:a.path,goal:a.goal},original);
});
test('an unreachable temporary retreat releases only the yield and keeps its original reservation and learning',()=>{
 const {s,p,a}=fixture();a.bodyYield.target={x:10000,y:10000};const before=copy({x:a.x,y:a.y,activity:s.activitiesById[p.activityId],reservation:s.reservationsById['reservation:test-static-yield'],learning:p.mind.learning,path:a.path,goal:a.goal});
 tickSpatial(s);assert.equal(a.bodyYield,undefined);assert.deepEqual({x:a.x,y:a.y,activity:s.activitiesById[p.activityId],reservation:s.reservationsById['reservation:test-static-yield'],learning:p.mind.learning,path:a.path,goal:a.goal},before);
});
