import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {sceneExitPointSR} from '../../../src/simulation/ea-sr-world.mjs';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';

const FOE='person:valley-shanxiao', HOME='scene:yunxiu-courtyard';
function fixture(){
  let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
  for(const [name,args] of [['masterAction',['heal']],['chooseOpeningInheritance',['qinglan']]]) state=SIM.dispatchCommand(state,{name,args}).state;
  while(state.master.wound>0)SIM.tick(state,.1);
  // Prepared public-rule unit checkpoint; desktop acceptance uses its own native save.
  return createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:'unit-combat-checkpoint'}}});
}
function send(run,request){const reply=commandSect(run,request);assert.equal(reply.ok,true,reply.error);return reply;}
const world=(run,action)=>send(run,{type:'world',action});
function until(run,predicate,label){for(let n=0;n<3500&&!predicate(run.state);n++)advanceSect(run,.1);assert.ok(predicate(run.state),label);}
function exit(run,id){world(run,{action:'exit',exitId:id});until(run,s=>!s.srWorld.interaction&&!s.master.scenic.path.length,'reach exit');world(run,{action:'exit',exitId:id,cargo:{food:4}});until(run,s=>!s.srWorld.activeTravelId,'finish journey');}
function closeForMelee(run){for(let n=0;n<80;n++){const c=run.state.combat,p=c.player,e=c.enemies.find(e=>e.hp>0),d=Math.hypot(e.x-p.x,e.y-p.y),range=SIM.viewSRCombat(run.state).actions.find(a=>a.id==='attack').range;if(d<=range)break;send(run,{type:'combat-input',move:{x:(e.x-p.x)/d,y:(e.y-p.y)/d}});advanceSect(run,.1);}send(run,{type:'combat-input',move:{x:0,y:0}});}
function battle(){const run=fixture();exit(run,'exit:yunxiu-valley');world(run,{action:'move',x:24.5,y:36});until(run,s=>!s.srWorld.interaction,'approach enemy');world(run,{action:'engage',objectId:'object:valley:shanxiao'});return run;}

test('desktop expedition exposes detached official projections and rejects invalid requests atomically',()=>{
  const run=fixture(),before=snapshotSect(run),view=viewSect(run).expedition;
  assert.equal(view.away,false);assert.equal(view.world.exits[0].id,'exit:yunxiu-valley');assert.deepEqual(snapshotSect(run),before);
  view.world.exits[0].x=999;assert.notEqual(viewSect(run).expedition.world.exits[0].x,999);
  for(const request of [{type:'world',action:{action:'engage',objectId:'object:valley:shanxiao'}},{type:'world',action:{action:'unknown'}},{type:'combat',actionId:'attack'},{type:'combat',actionId:'unknown'}]){
    const state=structuredClone(run.state);assert.equal(commandSect(run,request).ok,false);assert.deepEqual(run.state,state);
  }
});

test('desktop controls retain timed actions, wounds, retreat feet and native session restoration',()=>{
  let run=battle();const s=run.state,master=s.master.personId;
  assert.equal(viewSect(run).expedition.scene.sessionId,s.combat.sessionId);
  const hp=s.combat.enemies[0].hp;send(run,{type:'combat',actionId:'spell',target:'enemy-1'});
  assert.equal(run.state.combat.enemies[0].hp,hp);advanceSect(run,.6);assert.ok(run.state.combat.enemies[0].hp<hp);
  until(run,s=>!s.srCombat.pending&&!!s.combat.enemies[0].telegraph,'next visible strike');
  send(run,{type:'combat',actionId:'guard'});advanceSect(run,.3);assert.ok(run.state.combat.player.guard>0);
  until(run,s=>s.master.wound>0&&!s.srCombat.pending,'real wound');
  send(run,{type:'combat',actionId:'dodge',target:{x:run.state.combat.player.x,y:6.7}});advanceSect(run,.2);
  assert.equal(run.state.srCombat.pending.executed,true);
  send(run,{type:'pause',paused:true});const saved=snapshotSect(run),tick=run.state.worldTick;run=restoreSect(saved);advanceSect(run,3);assert.equal(run.state.worldTick,tick);
  assert.deepEqual(snapshotSect(run),saved);send(run,{type:'pause',paused:false});until(run,s=>!s.srCombat.pending,'dodge recovery');
  closeForMelee(run);until(run,s=>!s.srCombat.pending&&!SIM.viewSRCombat(s).actions.find(action=>action.id==='attack').disabled,'melee opportunity');
  const beforeAttack=run.state.combat.enemies[0].hp;send(run,{type:'combat',actionId:'attack',target:'enemy-1'});advanceSect(run,.4);
  assert.ok(run.state.combat.enemies[0].hp<beforeAttack);until(run,s=>!s.srCombat.pending,'attack recovery');
  const wound=run.state.master.wound;send(run,{type:'combat',actionId:'retreat'});assert.equal(run.state.combat.status,'active');
  until(run,s=>s.combat.status==='retreated','walk out');assert.ok(run.state.master.wound>=wound);assert.equal(run.state.master.personId,master);
  assert.equal(run.state.master.activityId,null);assert.equal(run.state.personsById[FOE].lifeStatus,'alive');
  send(run,{type:'combat-acknowledge'});exit(run,'exit:valley-yunxiu');assert.equal(run.state.master.location.sceneId,HOME);assert.ok(run.state.master.wound>0);
  run=restoreSect(snapshotSect(run));assert.equal(run.state.master.personId,master);assert.ok(run.state.master.wound>0);
});

test('the courtyard controller leaves an idle valley body and supplies available to the player',()=>{
  const run=fixture();exit(run,'exit:yunxiu-valley');
  const ledger=run.ledger.filter(entry=>entry.kind==='autonomous-action').length;
  advanceSect(run,32);assert.equal(run.control.mode,'auto');assert.equal(run.state.master.location.sceneId,'scene:valley');
  assert.equal(run.ledger.filter(entry=>entry.kind==='autonomous-action').length,ledger);assert.equal(run.state.master.activityId,null);
});

test('paused combat accepts one plan and executes it once after resuming',()=>{
  const run=battle();send(run,{type:'pause',paused:true});
  const tick=run.state.worldTick,qi=run.state.combat.player.qi,hp=run.state.combat.enemies[0].hp;
  send(run,{type:'combat',actionId:'spell',target:'enemy-1'});
  const planned=structuredClone(run.state),actionId=run.state.srCombat.pending.id;
  for(const actionId of ['spell','guard']){
    const result=commandSect(run,{type:'combat',actionId,target:'enemy-1'});
    assert.equal(result.ok,false);assert.match(result.error,/起手|收势/);assert.deepEqual(run.state,planned);
  }
  advanceSect(run,5);assert.deepEqual(run.state,planned);assert.equal(run.state.worldTick,tick);
  assert.equal(run.state.combat.player.qi,qi);assert.equal(run.state.combat.enemies[0].hp,hp);assert.deepEqual(run.state.srCombat.cooldowns,planned.srCombat.cooldowns);
  send(run,{type:'pause',paused:false});advanceSect(run,.6);assert.ok(run.state.combat.enemies[0].hp<hp);
  const after=run.state.combat.enemies[0].hp,cooldown=run.state.srCombat.cooldowns.spell;
  until(run,s=>!s.srCombat.pending,'one spell recovery');
  assert.equal(run.state.combat.enemies[0].hp,after);assert.equal(run.state.srCombat.cooldowns.spell,cooldown);
  assert.equal(run.state.srCombat.executions.filter(action=>action.id===actionId&&action.action==='spell'&&action.executed&&!action.failure).length,1);
});

test('the current courtyard terrain permits the public walk to the valley gate',()=>{
  const run=createSectSession();send(run,{type:'enable-courtyard-terrain'});
  assert.equal(run.state.spatial.courtyardTerrain.version,'courtyard-master-terrain-2');
  world(run,{action:'exit',exitId:'exit:yunxiu-valley'});assert.equal(run.automation.activeAction,'manual-walk');
  until(run,s=>!s.master.scenic.path.length,'current terrain gate approach');
  const gate=sceneExitPointSR(run.state,'exit:yunxiu-valley');
  assert.deepEqual(run.state.master.location,{kind:'local',sceneId:HOME,x:gate.x,y:gate.y});
  assert.equal(viewSect(run).expedition.world.exits[0].near,true);
  assert.equal(run.state.srWorld.activeTravelId,null);
});
