import assert from 'node:assert/strict';
import{writeFileSync}from'node:fs';
import{NODES,LANDMARKS,point,findPath,sweep,canStand,distance}from'../dist/yunxiu-courtyard/navigation.mjs';
import{createState,walk,update,upgrade,saveData}from'../dist/yunxiu-courtyard/world.mjs';
let routes=0,segments=0,sweeps=0;
for(const a in NODES)for(const b in NODES){const path=findPath(point(a),point(b));assert.ok(path,`${a} → ${b}`);let from=point(a);for(const to of path){assert.equal(sweep(from,to).blocked,false);segments++;from=to;}routes++;}
for(const id in NODES)for(let degrees=0;degrees<360;degrees+=5){const p=point(id),r=degrees*Math.PI/180;assert.ok(canStand(sweep(p,{x:p.x+Math.cos(r)*200,y:p.y+Math.sin(r)*200})));sweeps++;}
for(const p of [{x:650,y:650},{x:750,y:100},{x:1650,y:750}])assert.equal(findPath(point('centre'),p),null);
const s=createState();s.speed=4;let steps=0;
for(const destination of LANDMARKS){assert.ok(walk(s,s.actors[0],point(destination.node)));while(s.actors[0].path.length&&steps<20000){update(s,.05,()=>{});steps++;s.actors.forEach(a=>assert.ok(canStand(a)));}assert.ok(distance(s.actors[0],point(destination.node))<.1,destination.name);}
for(const follower of s.actors.slice(1,4)){follower.follow=true;follower.wait=0;}
assert.ok(walk(s,s.actors[0],point('mainDoor')));for(let i=0;i<1500;i++)update(s,.05,()=>{});assert.ok(distance(s.actors[0],point('mainDoor'))<.1);assert.equal(s.metrics.invalid,0);
s.paused=true;const paused=JSON.stringify(saveData(s));for(let i=0;i<100;i++)update(s,.05,()=>{});assert.equal(JSON.stringify(saveData(s)),paused);
const restored=createState(saveData(s));assert.deepEqual(restored.actors.map(a=>[a.id,a.variant,a.x,a.y,a.follow]),s.actors.map(a=>[a.id,a.variant,a.x,a.y,a.follow]));assert.deepEqual(restored.resources,s.resources);assert.equal(restored.paused,true);
const before={...s.resources},level=s.buildings.herbs.level;assert.equal(upgrade(s,'herbs').ok,true);assert.equal(s.buildings.herbs.level,level+1);assert.equal(s.resources.wood,before.wood-18*level);assert.equal(s.resources.stone,before.stone-12*level);
s.resources.wood=s.resources.stone=0;assert.equal(upgrade(s,'herbs').ok,false);assert.equal(s.buildings.herbs.level,level+1);
const report={version:'courtyard-1.3',generatedAt:new Date().toISOString(),routes,segments,fastMovementBoundarySweeps:sweeps,visitedLandmarks:LANDMARKS.length,followResidents:3,invalidPositions:s.metrics.invalid,pausedAndSaveRestore:'passed',upgradeResourceAccounting:'passed',assertions:'passed',scope:'Logical checks only. Rendering and painted-path registration require separate browser inspection.'};writeFileSync(new URL('./yunxiu-acceptance-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
