import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {appearanceView} from '../dist/ea-sr-persons.mjs';
import {cultivatorSpriteFrame} from '../dist/ea-character-art.mjs';

for (const [command,args,resource,workingAction] of [
  ['startMasterHarvest',['wood'],null,'gather'],
  ['replenishPatch',['herb'],'herb','plant'],
]) {
  test(`SR-XF-007/009: ${command} shows a paused body when onsite work stops, then resumes after reload`, () => {
    let s=SIM.initial({sr:true});
    s.master.wound=0;
    s.master.energy=100;
    s.master.activityId=null;
    if(resource)s.srEconomy.patches[resource].remaining=0;
    s=SIM.dispatchCommand(s,{name:command,args}).state;
    let activity=s.activitiesById[s.master.activityId];
    for(let steps=0;activity.phase!=='working'&&steps<300;steps++){
      SIM.tick(s,.1);
      activity=s.activitiesById[s.master.activityId];
    }
    assert.equal(activity.phase,'working');
    const active=appearanceView(s,'person:master');
    assert.equal(active.action,workingAction);
    assert.equal(active.asset,'yunxiu-courtyard:characters:v1');
    assert.equal(active.fullAnimationAvailable,false);
    assert.match(active.fallback,/专用连续身体动作尚未绘制/);
    assert.equal(cultivatorSpriteFrame(active,s.worldTick).animated,false);

    s.master.wound=50;
    SIM.tick(s,.1);
    activity=s.activitiesById[s.master.activityId];
    const stoppedProgress=activity.progressTicks;
    assert.equal(activity.phase,'paused');
    assert.equal(appearanceView(s,'person:master').action,'waiting');
    SIM.tick(s,.1);
    assert.equal(activity.progressTicks,stoppedProgress);
    const saved=JSON.stringify(s);
    s=SIM.validateSave(JSON.parse(saved));
    assert.equal(s.activitiesById[s.master.activityId].phase,'paused');
    assert.equal(appearanceView(s,'person:master').action,'waiting');

    s.master.wound=0;
    SIM.tick(s,.1);
    activity=s.activitiesById[s.master.activityId];
    assert.equal(activity.phase,'working');
    assert.equal(activity.progressTicks,stoppedProgress+1);
    assert.equal(appearanceView(s,'person:master').action,workingAction);

    s.master.energy=4;
    SIM.tick(s,.1);
    activity=s.activitiesById[s.master.activityId];
    assert.equal(activity.phase,'paused');
    assert.equal(activity.progressTicks,stoppedProgress+1);
    assert.equal(appearanceView(s,'person:master').action,'waiting');
    s.master.energy=100;
    SIM.tick(s,.1);
    assert.equal(activity.phase,'working');
    assert.equal(activity.progressTicks,stoppedProgress+2);
  });
}

test('SR-XF-009: a full carried pack pauses harvest without consuming the finite source',()=>{
  let s=SIM.initial({sr:true});
  s.master.wound=0;
  s.master.energy=100;
  s.master.activityId=null;
  for(let batch=0;batch<4;batch++){
    s=SIM.dispatchCommand(s,{name:'startMasterHarvest',args:['wood']}).state;
    for(let steps=0;s.master.activityId&&steps<250;steps++)SIM.tick(s,.1);
  }
  const activity=s.activitiesById[s.master.activityId];
  assert.equal(activity.phase,'paused');
  assert.match(activity.reason,/包裹已满/);
  assert.equal(appearanceView(s,'person:master').action,'waiting');
  assert.equal(s.stockpilesById['stockpile:carried:master'].resources.wood,36);
  assert.equal(s.srEconomy.patches.wood.remaining,684);
  SIM.tick(s,.1);
  assert.equal(activity.phase,'paused');
  assert.equal(activity.progressTicks,activity.durationTicks);
  assert.equal(s.srEconomy.patches.wood.remaining,684);
  s=SIM.validateSave(JSON.parse(JSON.stringify(s)));
  s=SIM.dispatchCommand(s,{name:'cancelMasterHarvest',args:[]}).state;
  assert.equal(s.master.activityId,null);
  assert.equal(s.stockpilesById['stockpile:carried:master'].resources.wood,36);
  assert.equal(s.srEconomy.patches.wood.remaining,684);
});
