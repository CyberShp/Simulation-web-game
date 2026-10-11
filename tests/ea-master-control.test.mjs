import test from 'node:test';
import assert from 'node:assert/strict';
import {createGodotBridge} from '../dist/ea-godot-bridge.mjs';
import {initial} from '../dist/ea-opening-sim.mjs';

const create = () => createGodotBridge({state:initial({sr:true,mountainOpening:true})});
const state = world => JSON.parse(world.save());
const master = s => s.personsById['person:master'];
const command = (world,name,...args) => {
 const result=world.command({name,args});
 assert.equal(result.ok,true,result.error);
 return result.result;
};

test('a player walk stops at its destination until thirty foreground running seconds pass',()=>{
 const world=create(),start=state(world),x=master(start).scenic.x+2,y=master(start).scenic.y;
 assert.equal(world.command({type:'move',x,y}).ok,true);
 world.advance(29.9);
 let s=state(world);
 assert.equal(s.masterControl.mode,'manual');
 assert.equal(s.masterControl.idleMs,29900);
 assert.equal(master(s).scenic.x,x);
 assert.equal(master(s).scenic.y,y);
 assert.equal(master(s).activityId==null,true);
 world.advance(.1);
 s=state(world);
 assert.equal(s.masterControl.mode,'auto');
 assert.equal(s.activitiesById[master(s).activityId]?.action,'rest');
 world.advance(1);
 assert.ok(master(state(world)).scenic.x<x);
});

test('auto cultivation yields immediately to the next direct master command',()=>{
 const world=create();
 command(world,'masterAction','heal');
 command(world,'chooseOpeningInheritance','qinglan');
 world.advance(29.9);
 assert.equal(state(world).masterControl.mode,'manual');
 assert.equal(master(state(world)).wound,0);
 world.advance(.1);
 let s=state(world);
 assert.equal(s.masterControl.mode,'auto');
 assert.equal(master(s).action,'cultivate');
 world.advance(1);
 s=state(world);
 assert.ok(master(s).xp>0);
 const x=master(s).scenic.x+2,y=master(s).scenic.y;
 assert.equal(world.command({type:'move',x,y}).ok,true);
 s=state(world);
 assert.deepEqual(s.masterControl,{mode:'manual',idleMs:0});
 world.advance(1);
 s=state(world);
 assert.equal(master(s).scenic.x,x);
 assert.equal(master(s).activityId==null,true);
});

test('pause, speed and save/load preserve a real-time foreground grace period',()=>{
 const world=create();
 command(world,'setSpeed',4);
 world.advance(29.9);
 let s=state(world);
 assert.equal(s.masterControl.mode,'manual');
 assert.equal(s.masterControl.idleMs,29900);
 const saved=world.save();
 command(world,'setSpeed',0);
 world.advance(100);
 assert.equal(state(world).masterControl.idleMs,29900);
 assert.equal(world.load(saved).ok,true);
 world.advance(.1);
 assert.equal(state(world).masterControl.mode,'auto');
 const legacy=JSON.parse(saved);
 delete legacy.masterControl;
 assert.equal(world.load(JSON.stringify(legacy)).ok,true);
 assert.deepEqual(state(world).masterControl,{mode:'manual',idleMs:0});
 const before=world.save(),invalid=JSON.parse(before);
 invalid.masterControl={mode:'auto',idleMs:0};
 assert.equal(world.load(JSON.stringify(invalid)).ok,false);
 assert.equal(world.save(),before);
});

test('an already ordered main-hall construction continues during the manual grace period',()=>{
 const world=create();
 command(world,'masterAction','heal');
 command(world,'chooseOpeningInheritance','qinglan');
 world.advance(25);
 assert.equal(master(state(world)).wound,0);
 command(world,'establishHall');
 assert.deepEqual(state(world).masterControl,{mode:'manual',idleMs:0});
 world.advance(5);
 const s=state(world);
 assert.equal(s.story.opening.hallPhase,'building');
 assert.ok(s.workOrdersById['work:construction:1'].progressTicks>0);
 assert.equal(s.masterControl.mode,'manual');
});
