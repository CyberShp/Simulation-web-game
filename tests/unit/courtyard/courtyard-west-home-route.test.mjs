import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {dispatchCommand,validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {firstSite,eastResidenceSites,westLumberSite,westValleySites} from '../../../src/simulation/ea-sect-domain.mjs';
import {meterFindPath,meterSweep,requestBodyYield,tickSpatial} from '../../../src/simulation/ea-sr-spatial.mjs';
import {toArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';

function fixture(){
 let s=validateSave(JSON.parse(JSON.stringify(seed.state)));
 for(const name of ['enableSectDomain','enableCourtyardTerrain','enableWestValley','enableEastResidences'])s=dispatchCommand(s,{name,args:[]}).state;
 return s;
}
function visibleRoute(s,from,to){
 const route=meterFindPath(s,from,to,{maxSnap:0});assert.ok(route);
 let start=from;
 for(const end of route){
  assert.equal(meterSweep(s,start,end).blocked,false);
  const n=Math.max(1,Math.ceil(Math.hypot(end.x-start.x,end.y-start.y)/.025));
  for(let i=0;i<=n;i++){const p=toArt(start.x+(end.x-start.x)*i/n,start.y+(end.y-start.y)*i/n);assert.ok(isArtWalkable(p.x,p.y,{valley:true,residences:true}),JSON.stringify(p));}
  start=end;
 }
 assert.deepEqual(route.at(-1),to);return route;
}
test('HOME and all residence entrances use visible courtyard paving in both directions to western stores',()=>{
 const s=fixture(),home={x:28,y:12.6},store=westValleySites.find(site=>site.number===24).entrance;
 for(const west of [westLumberSite.entrance,store]){visibleRoute(s,home,west);visibleRoute(s,west,home);}
 for(const residence of [firstSite,...eastResidenceSites]){visibleRoute(s,residence.entrance,store);visibleRoute(s,store,residence.entrance);}
});
test('mutually blocked v1 facility travel and moving construction crew can step aside with their activity intact',()=>{
 for(const kind of ['facility','sr-construction']){
  const s=fixture(),master=s.master,worker=s.personsById['person:lu-zhiwei'],m=master.scenic,q=worker.mind.scenic;
  Object.assign(m,{x:28.1399,y:12.8842,path:[{x:35.83485068135691,y:28.51851851851852}],waitingForPersonId:worker.personId});
  Object.assign(q,{x:28.4089,y:13.3557,path:[{x:27.5,y:11.5}],waitingForPersonId:master.personId});
  master.activityId='activity:test-master';worker.activityId='activity:test-worker';
  s.activitiesById[master.activityId]={id:master.activityId,kind:'construction',phase:'moving',workOrderId:'work:test'};
  s.activitiesById[worker.activityId]={id:worker.activityId,kind,phase:kind==='facility'?'waiting':'moving',workOrderId:'work:test'};
  const body=structuredClone(s.activitiesById[worker.activityId]),path=structuredClone(q.path);
  assert.equal(requestBodyYield(s,m,worker,m.path),true,kind);
  assert.equal(q.bodyYield.kind,'mutual-corridor');assert.deepEqual(s.activitiesById[worker.activityId],body);assert.deepEqual(q.path,path);
  for(let i=0;i<q.bodyYield.path.length;i++)assert.equal(meterSweep(s,i?q.bodyYield.path[i-1]:q,q.bodyYield.path[i]).blocked,false);
  delete q.bodyYield;s.activitiesById[worker.activityId].phase='working';
  assert.equal(requestBodyYield(s,m,worker,m.path),false,'active work retains its body');
 }
});
test('the final yielding step retains its body owner until the next world step',()=>{
 const s=fixture(),worker=s.personsById['person:lu-zhiwei'],q=worker.mind.scenic;
 worker.activityId='activity:test-worker';s.activitiesById[worker.activityId]={id:worker.activityId,kind:'facility',phase:'waiting'};
 Object.assign(q,{x:29,y:14,path:[{x:27.5,y:11.5}],bodyYield:{kind:'mutual-corridor',requestedBy:'person:master',startedTick:s.worldTick,target:{x:29.1,y:14},path:[{x:29.1,y:14}]}});
 const original=structuredClone(q.path);tickSpatial(s);
 assert.equal(q.x,29.1);assert.equal(q.y,14);assert.deepEqual(q.bodyYield.path,[]);assert.deepEqual(q.path,original);
});
