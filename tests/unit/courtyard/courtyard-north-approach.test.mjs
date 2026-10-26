import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand,tick} from '../../../src/simulation/ea-opening-sim.mjs';
import {meterFindPath,meterSweep,spatialRevision,visibleBodyRouteClear,meterDoorPermit} from '../../../src/simulation/ea-sr-spatial.mjs';
import {NORTH_LIBRARY_APPROACH_VERSION,COURTYARD_EAST_ROAD,northLibrarySites} from '../../../src/simulation/ea-sect-domain.mjs';
import {toArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';

const copy=x=>JSON.parse(JSON.stringify(x)),MASTER='person:master',HOME='stockpile:yunxiu';
function session(){let state=validateSave(copy(seed.state));return {get state(){return state;},command(name,...args){const r=dispatchCommand(state,{name,args});state=r.state;return r.result;},step(){tick(state,.1);},restore(){const text=JSON.stringify(state);state=validateSave(JSON.parse(text));assert.equal(JSON.stringify(state),text);}};}
function enabled(){const r=session();r.command('enableCourtyardTerrain');r.command('enableNorthLibrary');return r;}
function circleOpen(p){for(let i=-1;i<16;i++){const q=i<0?p:{x:p.x+.26*Math.cos(i*Math.PI/8),y:p.y+.26*Math.sin(i*Math.PI/8)},a=toArt(q.x,q.y);if(!isArtWalkable(a.x,a.y,{northLibrary:true}))return false;}return true;}
function routeOnVisibleGround(s,from,to){const path=meterFindPath(s,from,to,{maxSnap:0});assert.ok(path);let a=from;for(const b of path){assert.equal(meterSweep(s,a,b).blocked,false);const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.025));for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};assert.ok(circleOpen(p),JSON.stringify({from,to,p,art:toArt(p.x,p.y)}));}a=b;}return path;}

test('north entry and return keep the complete body circle on original paving, eastern road and stairs',()=>{
 const r=enabled(),to=northLibrarySites[0].entrance;
 // Rule fixture positions are the existing HOME threshold, Lin's visitor position,
 // the shared central paving and a point already on the eastern road.
 for(const from of [{x:27.94,y:12.65},{x:28.5,y:14},{x:29.03326810176125,y:20.571428571428573},COURTYARD_EAST_ROAD[3]]){
  assert.ok(circleOpen(from));routeOnVisibleGround(r.state,from,to);routeOnVisibleGround(r.state,to,from);
 }
});

test('new route revision is scoped to the enabled north domain and reading leaves legacy route bytes intact',()=>{
 const r=session(),before=spatialRevision(r.state);assert.ok(!before.includes(NORTH_LIBRARY_APPROACH_VERSION));r.command('enableCourtyardTerrain');r.command('enableNorthLibrary');
 const a=r.state.master.scenic;Object.assign(a,{x:28.5,y:14});Object.assign(r.state.master.position,{x:28.5,y:14});a.revision=spatialRevision(r.state).replace(`:${NORTH_LIBRARY_APPROACH_VERSION}`,'');a.goal={...northLibrarySites[0].entrance};a.path=[{x:47.093333333333334,y:12.42391304347826},...meterFindPath(r.state,{x:47.093333333333334,y:12.42391304347826},a.goal,{maxSnap:0})];
 const beforeRead=JSON.stringify(r.state);r.restore();assert.equal(JSON.stringify(r.state),beforeRead);assert.ok(!r.state.master.scenic.revision.includes(NORTH_LIBRARY_APPROACH_VERSION));
});

test('an active legacy northern material trip recovers by actual steps and keeps its order through saves',()=>{
 const r=enabled();
 // Explicit compatibility rule fixture: sufficient materials and a saved body
 // on the formerly generated shortcut. Normal-source proof is recorded separately.
 Object.assign(r.state.stockpilesById[HOME].resources,{jade:65,wood:45,stone:20});
 const order=r.command('buildDomainSite',northLibrarySites[0].id),id=order.workOrderId;
 for(let i=0;i<1000&&r.state.workOrdersById[id].materialFlow.phase!=='carrying';i++)r.step();
 const o=r.state.workOrdersById[id];assert.equal(o.materialFlow.phase,'carrying');
 const p=r.state.personsById[MASTER],a=p.scenic,legacy={x:40.80379280067213,y:12.481917899465497};Object.assign(a,legacy);Object.assign(p.position,legacy);if(p.location?.kind==='local')Object.assign(p.location,legacy);
 a.revision=spatialRevision(r.state).replace(`:${NORTH_LIBRARY_APPROACH_VERSION}`,'');a.path=[{x:47.093333333333334,y:12.42391304347826},...meterFindPath(r.state,{x:47.093333333333334,y:12.42391304347826},a.goal,{maxSnap:0})];
 const cargo=copy(o.materialFlow.cargo),activity=p.activityId,originTick=r.state.worldTick;assert.equal(circleOpen(p.position),false);r.restore();
 let recovered=null,maxStep=0;
 for(let i=0;i<200;i++){
  const previous={...r.state.master.scenic};r.step();const at=r.state.master.scenic,step=Math.hypot(previous.x-at.x,previous.y-at.y);maxStep=Math.max(maxStep,step);assert.ok(step<=.316801);
  assert.equal(r.state.master.activityId,activity);assert.equal(r.state.workOrdersById[id].id,id);
  if(circleOpen(at)&&recovered===null)recovered=r.state.worldTick;
  if(recovered!==null)assert.ok(circleOpen(at),`tick ${r.state.worldTick}`);
  if(i===0||i===6||i===100)r.restore();
 }
 assert.ok(recovered!==null&&recovered-originTick<30);assert.ok(maxStep>0);const current=r.state.workOrdersById[id],flow=current.materialFlow;for(const [resource,quantity]of Object.entries(cargo))assert.equal((flow.cargo[resource]||0)+(r.state.stockpilesById[flow.siteStockpileId].resources[resource]||0),quantity);assert.equal(current.progressTicks,0);
});

test('construction warehouse return rejoins the measured road from a legal boundary stance',()=>{
 const r=enabled();r.command('enableEastResidences');r.command('enableEastServices');Object.assign(r.state.stockpilesById[HOME].resources,{jade:65,wood:45,stone:20});
 const {workOrderId:id}=r.command('buildDomainSite',northLibrarySites[0].id),p=r.state.master;
 // A rule fixture reproduces a saved legal road stance; the order and material reservations are real.
 const origin={x:50.44237537561094,y:12.146878315716327};Object.assign(p.scenic,origin,{path:[],goal:null});Object.assign(p.position,origin);if(p.location?.kind==='local')Object.assign(p.location,origin);
 const materials=copy(r.state.stockpilesById[r.state.workOrdersById[id].materialFlow.sourceStockpileId].resources);r.restore();
 for(let i=0;i<250&&r.state.workOrdersById[id].materialFlow.phase==='to-source';i++){
  const before={...r.state.master.scenic};r.step();const after=r.state.master.scenic;
  assert.equal(meterSweep(r.state,before,after).blocked,false);assert.ok(visibleBodyRouteClear(r.state,before,[after]));assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<=.316801);
  if(i===0||i===50)r.restore();
 }
 const flow=r.state.workOrdersById[id].materialFlow;assert.equal(flow.phase,'carrying');assert.equal(flow.trips.length,1);
 for(const [key,value]of Object.entries(materials))assert.equal((flow.cargo[key]||0)+r.state.stockpilesById[flow.sourceStockpileId].resources[key],value);
 r.restore();
});

function strandedCarrier(){
 const r=enabled();Object.assign(r.state.stockpilesById[HOME].resources,{jade:65,wood:45,stone:20});
 const initial=copy(r.state.stockpilesById[HOME].resources),{workOrderId:id}=r.command('buildDomainSite',northLibrarySites[0].id);
 for(let i=0;i<1000&&r.state.workOrdersById[id].materialFlow.phase!=='carrying';i++)r.step();
 assert.equal(r.state.workOrdersById[id].materialFlow.phase,'carrying');
 const p=r.state.master,legacy={x:40.80379280067213,y:12.481917899465497};Object.assign(p.scenic,legacy,{path:[],goal:null});Object.assign(p.position,legacy);if(p.location?.kind==='local')Object.assign(p.location,legacy);
 return {r,id,initial};
}
test('a cancelled stranded construction carrier physically returns cargo before refund',()=>{
 const {r,id,initial}=strandedCarrier(),start=r.state.worldTick;assert.equal(r.command('cancelConstruction').pending,true);r.restore();
 let recovered=null,moved=0;
 for(let i=0;i<1000&&r.state.workOrdersById[id];i++){
  const before={...r.state.master.scenic};r.step();const at=r.state.master.scenic,step=Math.hypot(at.x-before.x,at.y-before.y);assert.ok(step<=.316801);moved+=step;
  if(circleOpen(at)&&recovered===null)recovered=r.state.worldTick;
  if(recovered!==null)assert.ok(circleOpen(at));
  if(i===0||i===6||i===50)r.restore();
 }
 assert.ok(recovered!==null&&recovered-start<30);assert.ok(moved>1);assert.equal(r.state.workOrdersById[id],undefined);
 for(const k of ['wood','stone'])assert.equal(r.state.stockpilesById[HOME].resources[k],initial[k]);
 assert.equal(r.state.spatial.completedOrders.at(-1).phase,'cancelled');assert.equal(r.state.spatial.completedOrders.at(-1).progressTicks,0);
});
test('construction recovery requires the matching active order, reservation, carrier and destination',()=>{
 const {r,id}=strandedCarrier(),saved=copy(r.state);
 const mutations=[null,s=>{s.activitiesById[s.master.activityId].personId='person:lin-changfeng';},s=>{s.workOrdersById[id].activityIds=[];},s=>{s.workOrdersById[id].phase='cancelled';},s=>{s.workOrdersById[id].materialFlow.carrierId='person:lin-changfeng';},s=>{delete s.reservationsById[s.workOrdersById[id].reservationId];},s=>{s.reservationsById[s.workOrdersById[id].reservationId].activityId='other';},s=>{s.master.scenic.goal.x+=1;}];
 for(const mutate of mutations){const s=validateSave(copy(saved)),a=s.master.scenic,flow=s.workOrdersById[id].materialFlow,goal=s.stockpilesById[flow.siteStockpileId].position;a.path=meterFindPath(s,a,goal,{maxSnap:0});a.goal={...goal};assert.ok(a.path?.length);const target=a.path[0],d=Math.hypot(target.x-a.x,target.y-a.y),next={x:a.x+(target.x-a.x)*Math.min(.1,d)/d,y:a.y+(target.y-a.y)*Math.min(.1,d)/d};if(mutate)mutate(s);assert.equal(meterDoorPermit(s,a,a,a.path,next),!mutate);}
});
