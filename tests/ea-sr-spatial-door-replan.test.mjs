import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {meterCanStand,meterFindPath,meterSweep,spatialAccess,spatialSlots} from '../dist/ea-sr-spatial.mjs';

test('near-boundary sweep keeps the existing zero-radius collision tolerance',()=>{
 const s=SIM.initial({sr:true,seed:618033}),y=1+5e-12;
 assert.equal(meterSweep(s,{x:2,y},{x:3,y},0).blocked,true);
 assert.equal(meterSweep(s,{x:2,y:1.2},{x:3,y:1.2},0).blocked,false);
});

test('SR-XF-003-AC-01: completed construction keeps the door open and replans around its new walls',()=>{
 let s=SIM.initial({sr:true,seed:618033}),commands=0,reloads=0;
 const act=(name,...args)=>{const result=SIM.dispatchCommand(s,{name,args});s=result.state;commands++;return result.result;};
 const until=(predicate,label)=>{for(let tick=0;tick<3000&&!predicate(s);tick++)SIM.tick(s,.1);assert(predicate(s),label);};
 const reload=()=>{const raw=JSON.stringify(s);s=SIM.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);reloads++;};
 const walk=(x,y)=>{assert.equal(act('moveScenicMaster',x,y),true);const route=s.master.scenic.path.map(point=>({...point}));let previous={x:s.master.scenic.x,y:s.master.scenic.y};for(const point of route){assert.equal(meterSweep(s,previous,point).blocked,false);previous=point;}until(state=>state.master.scenic.path.length===0,'public walk completes');assert(Math.hypot(s.master.scenic.x-x,s.master.scenic.y-y)<.001);return route;};

 act('acknowledgeIntro');act('masterAction','heal');until(state=>state.master.wound===0,'opening treatment completes');
 assert.deepEqual(meterFindPath(s,{x:24,y:18},{x:34,y:18},{maxSnap:0}),[{x:34,y:18}],'open land has a direct route before construction');
 const order=act('build','house',26,16);until(state=>state.spatial.completedOrders.some(done=>done.id===order.workOrderId&&done.phase==='completed'),'house construction completes');
 reload();
 const house=s.buildings.find(building=>building.id===order.id),door=spatialAccess(house),bed=spatialSlots(house,'rest')[0].position;
 assert(meterCanStand(s,door));assert(meterCanStand(s,bed));
 const doorRoute=walk(bed.x,bed.y);assert(doorRoute.length>0,'master crosses the real doorway to an interior bed');
 walk(24,18);
 const before=JSON.stringify(s);assert.throws(()=>act('build','farm',28,22),/挡住门人居入口/);assert.equal(JSON.stringify(s),before,'failed placement keeps resources, position and existing building');
 assert.equal(meterSweep(s,{x:24,y:18},{x:34,y:18}).blocked,true,'direct crossing hits the completed house wall');
 const bypass=walk(34,18);assert(bypass.some(point=>point.y<16||point.y>22),'route passes outside the building footprint');
 reload();assert.equal(s.buildings.find(building=>building.id===order.id).instanceId,house.instanceId);
 assert.equal(s.master.scenic.x,34);assert.equal(s.master.scenic.y,18);
 assert.equal(commands,6);assert.equal(reloads,2);
});
