import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-sim.mjs';
import {appearance,arenaPoint,arenaInverse,validateScenic} from '../dist/ea-scenic.mjs';
import {REGION_ART,regionPoint,regionInverse,finalArenaPoint,finalArenaInverse} from '../dist/ea-region-art.mjs';
import {LANDMARKS,point,canStand} from '../dist/yunxiu-courtyard/navigation.mjs';

test('formal EA walks every approved courtyard destination, saves in transit and resumes',()=>{
 for(const destination of LANDMARKS){const s=SIM.initial(),goal=point(destination.node);assert.equal(SIM.moveScenicMaster(s,goal.x,goal.y),true);SIM.tick(s,3.25);const copy=SIM.validateSave(s);assert.deepEqual(copy.master.scenic,s.master.scenic);let guard=0;while(copy.master.action==='walk'&&guard++<500){SIM.tick(copy,1);assert.equal(canStand(copy.master.scenic),true);}assert.ok(guard<500);assert.ok(Math.hypot(copy.master.scenic.x-goal.x,copy.master.scenic.y-goal.y)<.01);assert.equal(copy.master.action,'rest');}
});
test('home commands reject lakes and malformed navigation and do not invent work income',()=>{
 const s=SIM.initial(),resources={...s.resources};assert.equal(SIM.moveScenicMaster(s,10,20),false);assert.deepEqual(s.resources,resources);assert.equal(s.master.scenic,undefined);
 SIM.moveScenicMaster(s,1300,397);SIM.masterAction(s,'rest');assert.equal(s.master.scenic.path.length,0);
 s.master.scenic.x=10;assert.equal(validateScenic(s.master.scenic),false);assert.throws(()=>SIM.validateSave(s),/山院行走/);
});
test('pause and speed remain part of the real EA clock',()=>{
 const s=SIM.initial();SIM.moveScenicMaster(s,840,217);s.speed=0;const held=structuredClone(s);SIM.tick(s,100);assert.deepEqual(s,held);s.speed=4;SIM.tick(s,1);assert.equal(s.time,4);assert.equal(canStand(s.master.scenic),true);
});
test('all nine prototype road plates have finite invertible continuous coordinates',()=>{
 assert.equal(Object.keys(REGION_ART).length,9);for(const id of Object.keys(REGION_ART)){for(let x=0;x<=12;x+=.05){const p=regionPoint(x,4,id),q=regionInverse(p,id);assert.ok(Number.isFinite(p.x+p.y));assert.ok(q.distance<.001);assert.ok(Math.abs(q.x-x)<.01);}const objective=regionInverse(regionPoint(8,4,id),id);assert.ok(Math.abs(objective.x-8)<.001);}
});
test('combat plane inversion and party art identity survive arbitrary lineups',()=>{
 for(const [forward,inverse] of [[arenaPoint,arenaInverse],[finalArenaPoint,finalArenaInverse]])for(let x=0;x<=12;x+=.3)for(let y=0;y<=8;y+=.3){const q=inverse(forward(x,y));assert.ok(Math.hypot(q.x-x,q.y-y)<1e-9);}
 assert.equal(appearance('master'),0);for(let id=1;id<=100;id++)assert.ok(appearance(id)>=1&&appearance(id)<=5);
});
