import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../dist/ea-opening-sim.mjs';
import {buildingVisual,facilityHit,scenicCanStand} from '../dist/ea-scene-geometry.mjs';
import {constructionView} from '../dist/ea-construction-view.mjs';
const act=(s,name,...args)=>sim.dispatchCommand(s,{name,args}).state;
const save=s=>sim.validateSave(JSON.parse(JSON.stringify(s)));
const site={x:2,y:2},crossing={x:384,y:291};
function fixture(){const s=sim.initial();s.master.wound=0;return s;}
function placeVisitor(s,p){Object.assign(s.personsById['person:lu-zhiwei'].mind.scenic,p,{path:[],goal:null});}
function finishedWork(){let s=act(fixture(),'build','farm',site.x,site.y);placeVisitor(s,crossing);for(let i=0;i<1000&&sim.constructionStatus(s)?.phase!=='blocked';i++)sim.tick(s,.1);assert.equal(sim.constructionStatus(s)?.progressTicks,200);return s;}

test('a visitor entering a cached legal preview rejects construction atomically without displacement',()=>{
 const s=fixture();assert.equal(sim.placementLock(s,'farm',site.x,site.y),'');
 assert.ok(scenicCanStand(s,crossing));placeVisitor(s,crossing);
 assert.match(sim.placementLock(s,'farm',site.x,site.y),/陆知微.*离开/);
 const before=JSON.stringify(s);assert.throws(()=>act(s,'build','farm',site.x,site.y),/陆知微/);assert.equal(JSON.stringify(s),before);
 placeVisitor(s,{x:818,y:225});assert.equal(sim.placementLock(s,'farm',site.x,site.y),'');
});

test('construction waits for a visitor at completion without teleporting, repeated work or log spam',()=>{
 const s=finishedWork(),energy=s.master.energy,logs=s.logs.length,resources={...s.resources},v=s.personsById['person:lu-zhiwei'].mind.scenic;
 sim.tick(s,.5);assert.deepEqual({x:v.x,y:v.y},crossing);assert.equal(s.buildings.length,1);
 assert.equal(sim.constructionStatus(s).progressTicks,200);assert.equal(s.master.energy,energy);assert.deepEqual(s.resources,resources);assert.equal(s.logs.length,logs);
});

test('completed-but-blocked construction survives pause and save, then commits once after clearance',()=>{
 let s=finishedWork();s=save(s);const workId=sim.constructionStatus(s).workOrderId;
 s.speed=0;const before=JSON.stringify(s);sim.tick(s,1000);assert.equal(JSON.stringify(s),before);
 s.speed=1;placeVisitor(s,{x:818,y:225});s=save(s);sim.tick(s,.1);
 assert.equal(sim.constructionStatus(s),null);assert.equal(s.buildings.length,2);assert.equal(s.stats.built,1);assert.equal(s.workOrdersById[workId],undefined);
 const r={...s.resources};sim.tick(s,.1);assert.equal(s.buildings.length,2);assert.deepEqual(s.resources,r);save(s);
});

test('cancelling the same blocked construction through a retried command cannot refund twice',()=>{
 let s=finishedWork();const before={...s.resources},command={name:'cancelConstruction',id:`command:${s.transactions.nextCommandId}`,expectedRevision:s.revision};
 s=sim.dispatchCommand(s,command).state;assert.deepEqual(s.resources,before);s=save(s);
 const held=JSON.stringify(s);assert.equal(sim.dispatchCommand(s,command).replayed,true);assert.equal(JSON.stringify(s),held);assert.equal(s.stats.built,0);
});

test('construction projection shows three phases and shares the final size, footprint and anchor',()=>{
 let s=act(fixture(),'build','farm',site.x,site.y);const a=sim.constructionStatus(s),work=s.workOrdersById[a.workOrderId];
 for(const [ticks,stage]of [[0,'foundation'],[70,'structure'],[140,'finishing']]){work.progressTicks=ticks;const before=JSON.stringify(s),v=constructionView(s);assert.equal(v.stage,stage);assert.deepEqual(v.position,buildingVisual(v.building).position);assert.deepEqual(v.footprint,buildingVisual(v.building).footprint);assert.equal(v.size,buildingVisual(v.building).size);assert.equal(JSON.stringify(s),before);}
 work.progressTicks=0;for(let i=0;i<1000&&sim.constructionStatus(s);i++)sim.tick(s,.1);
 const b=s.buildings.find(b=>b.type==='farm');assert.ok(b);assert.equal(constructionView(s),null);assert.equal(buildingVisual(b).size,62);save(s);
});

test('an upgraded relocation candidate retains the finished sprite dimensions and selection bounds',()=>{
 const b={type:'farm',x:site.x,y:site.y,level:3},v=buildingVisual(b);
 assert.equal(v.size,68);assert.ok(facilityHit(b,{x:v.bounds.left+.1,y:v.bounds.top+.1}));assert.equal(facilityHit(b,{x:v.bounds.left-.1,y:v.bounds.top+.1}),false);
 const moved={...b,x:5,y:3};assert.equal(buildingVisual(moved).size,v.size);assert.notDeepEqual(buildingVisual(moved).position,v.position);
});
