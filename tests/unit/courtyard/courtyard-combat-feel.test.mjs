import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {setCombatActorHp,srCombatAction,projectCombatActorMotion} from '../../../src/simulation/ea-sr-combat.mjs';
import {combatCanStand,combatClearLine} from '../../../src/simulation/ea-combat-geometry.mjs';

const send=(s,request)=>{const result=commandSect(s,request);assert.equal(result.ok,true,result.error);return result;};
const command=(s,actionId,target)=>send(s,{type:'combat',actionId,target});
const input=(s,x,y,reset=false)=>send(s,{type:'combat-input',move:{x,y},reset});
function until(s,predicate,label){for(let i=0;i<2000&&!predicate(s.state);i++)advanceSect(s,.1);assert(predicate(s.state),label);}
function encounter(){
 let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
 for(const [name,args]of [['masterAction',['heal']],['chooseOpeningInheritance',['qinglan']]])state=SIM.dispatchCommand(state,{name,args}).state;
 while(state.master.wound>0)SIM.tick(state,.1);
 const s=createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:'combat-feel-checkpoint'}}});
 const world=action=>send(s,{type:'world',action});
 world({action:'exit',exitId:'exit:yunxiu-valley'});until(s,s=>!s.master.scenic.path.length,'gate');
 world({action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}});until(s,s=>!s.srWorld.activeTravelId,'valley');
 world({action:'move',x:24.5,y:36});until(s,s=>!s.srWorld.interaction,'approach');world({action:'engage',objectId:'object:valley:shanxiao'});return s;
}
const point=s=>({x:s.state.combat.player.x,y:s.state.combat.player.y});
function queuedGuard(){const s=encounter();command(s,'guard');advanceSect(s,.5);command(s,'attack',{x:.6,y:4});assert(s.state.srCombat.buffered);return s;}

test('held movement survives spell windup and resumes on the first world step after release',()=>{
 const s=encounter(),from=point(s);input(s,1,0);command(s,'spell',{x:8,y:4});
 for(let i=0;i<3;i++){input(s,1,0);advanceSect(s,.1);assert.deepEqual(point(s),from);assert.equal(s.state.srCombat.pending.executed,false);assert.equal(viewSect(s).expedition.scene.player.motion.movementLocked,true);}
 advanceSect(s,.1);assert.equal(s.state.combat.projectiles.length,1);assert.deepEqual(point(s),from);
 const released=viewSect(s).expedition.scene.player.motion;assert.equal(released.movementLocked,false);assert.deepEqual(released.moveIntent,{x:1,y:0});
 advanceSect(s,.1);assert(Math.abs(point(s).x-from.x-.33)<1e-7);assert.equal(viewSect(s).expedition.scene.player.motion.moving,true);assert.equal(s.state.srCombat.pending.executed,true);
});

test('dodge replaces an unreleased attack spell or guard and only pays the dodge cost',()=>{
 for(const action of ['attack','spell','guard']){
  const s=encounter(),qi=s.state.combat.player.qi;command(s,action,{x:8,y:4});const previous=s.state.srCombat.pending.id,tick=s.state.worldTick,from=point(s);
  command(s,'dodge',{x:3.5,y:6});assert.equal(s.state.srCombat.pending.action,'dodge');assert.equal(s.state.combat.player.qi,qi);assert.equal(s.state.srCombat.cooldowns[action],undefined);
  assert.equal(s.state.worldTick,tick);assert.equal(s.state.srCombat.pending.executed,false);assert.deepEqual(point(s),from);
  const interrupted=s.state.srCombat.executions.find(o=>o.id===previous);assert.equal(interrupted.executed,false);assert.equal(interrupted.phase,'interrupted');
  advanceSect(s,.1);assert.equal(s.state.worldTick,tick+1);assert.equal(s.state.srCombat.pending.executed,true);assert.equal(viewSect(s).expedition.scene.player.motion.phase,'release');assert.equal(s.state.combat.player.qi,qi-8);assert(!s.state.combat.projectiles?.length);assert.equal(s.state.combat.player.guard,0);
 }
});

test('dodge cuts released spell recovery without refunding or removing its projectile',()=>{
 const s=encounter();command(s,'spell',{x:8,y:4});advanceSect(s,.4);
 const old=structuredClone(s.state.srCombat.pending),shot=structuredClone(s.state.combat.projectiles[0]),qi=s.state.combat.player.qi,cooldown=s.state.srCombat.cooldowns.spell;
 command(s,'dodge',{x:3.5,y:6});assert.equal(s.state.combat.player.qi,qi);assert.equal(s.state.srCombat.cooldowns.spell,cooldown);assert.deepEqual(s.state.combat.projectiles,[shot]);
 const saved=s.state.srCombat.executions.find(o=>o.id===old.id);assert.equal(saved.executed,true);assert.equal(saved.result.projectileId,shot.id);
 advanceSect(s,.1);assert.equal(s.state.srCombat.pending.action,'dodge');assert.equal(s.state.srCombat.cooldowns.spell,cooldown);assert.equal(s.state.combat.projectiles[0].id,shot.id);assert(Math.abs(s.state.combat.player.qi-(qi+.32-8))<1e-8);
 const path=viewSect(s).expedition.scene.player.motion.dodgePath;assert(path);assert.deepEqual(path.to,point(s));assert.equal(path.durationTicks,2);
});

test('invalid dodge preserves the current action, paid effects and existing input atomically',()=>{
 for(const block of ['qi','cooldown','stagger','clone','body']){
  const s=encounter();command(s,'spell',{x:8,y:4});advanceSect(s,.4);
  // Isolated resource and reaction boundaries; normal held-cast flow is covered above.
  if(block==='qi')s.state.combat.player.qi=0;
  if(block==='cooldown')s.state.srCombat.cooldowns.dodge=s.state.worldTick+3;
  if(block==='stagger')s.state.combat.player.staggerUntilTick=s.state.worldTick+3;
  if(block==='body')s.state.activitiesById[s.state.master.activityId].orderId='fixture:another-body';
  const before=snapshotSect(s);
  if(block==='clone')assert.throws(()=>srCombatAction(s.state,'dodge',()=>{}));
  else if(block==='body')assert.throws(()=>srCombatAction(s.state,'dodge',{x:3.5,y:6}),/身体占用/);
  else assert.equal(commandSect(s,{type:'combat',actionId:'dodge',target:{x:3.5,y:6}}).ok,false);
  assert.deepEqual(snapshotSect(s),before);
 }
});

test('one short input slot keeps the latest frozen target and starts it only once',()=>{
 const s=queuedGuard(),aim={x:.6,y:2};command(s,'spell',aim);aim.x=11;
 assert.equal(s.state.srCombat.buffered.action,'spell');assert.deepEqual(s.state.srCombat.buffered.target,{x:.6,y:2});
 advanceSect(s,.2);assert.equal(s.state.srCombat.buffered,undefined);assert.equal(s.state.srCombat.pending.action,'spell');assert.deepEqual(s.state.srCombat.pending.target,{x:.6,y:2});assert.equal(s.state.srCombat.pending.progressTicks,0);assert.equal(s.state.srCombat.pending.executed,false);
 const id=s.state.srCombat.pending.id,started=s.state.worldTick;advanceSect(s,.3);assert.equal(s.state.srCombat.pending.executed,false);assert.equal(s.state.srCombat.pending.progressTicks,3);
 advanceSect(s,.1);assert.equal(s.state.worldTick,started+4);assert.equal(s.state.srCombat.pending.id,id);assert.equal(viewSect(s).expedition.scene.player.motion.phase,'release');assert.equal(s.state.combat.projectiles.length,1);
 advanceSect(s,.3);assert.equal(s.state.srCombat.executions.filter(o=>o.id===id&&o.executed).length,1);assert.equal(s.state.srCombat.pending,null);
});

test('buffer expiry and short stagger recovery do not retain a delayed extra action',()=>{
 const expired=queuedGuard();expired.state.combat.player.staggerUntilTick=expired.state.worldTick+3;advanceSect(expired,.3);assert.equal(expired.state.srCombat.buffered,undefined);assert.equal(expired.state.srCombat.pending.action,'guard');
 const s=encounter();s.state.combat.player.staggerUntilTick=s.state.worldTick+2;const from=point(s);const result=command(s,'dodge',{x:3.5,y:6});assert.equal(result.result.buffered,true);
 advanceSect(s,.1);assert.deepEqual(point(s),from);assert.equal(s.state.srCombat.pending,null);
 advanceSect(s,.1);assert.equal(s.state.srCombat.pending.action,'dodge');assert.equal(s.state.srCombat.pending.executed,true);
});

test('ordinary key release keeps a buffered skill while reset pause load and combat end clear it',()=>{
 const ordinary=queuedGuard();input(ordinary,0,0);assert(ordinary.state.srCombat.buffered);
 const reset=queuedGuard(),plan=structuredClone(reset.state.srCombat.pending);input(reset,0,0,true);assert.equal(reset.state.srCombat.buffered,undefined);assert.deepEqual(reset.state.srCombat.pending,plan);
 const paused=queuedGuard();send(paused,{type:'pause',paused:true});assert.equal(paused.state.srCombat.buffered,undefined);const before=snapshotSect(paused);advanceSect(paused,1);assert.deepEqual(snapshotSect(paused),before);
 const loading=queuedGuard(),loaded=restoreSect(JSON.parse(JSON.stringify(snapshotSect(loading))));assert.equal(loaded.state.srCombat.buffered,undefined);assert.deepEqual(loaded.state.srCombat.pending,loading.state.srCombat.pending);
 const ended=queuedGuard();setCombatActorHp(ended.state,ended.state.combat.enemies[0],0);advanceSect(ended,.1);assert.equal(ended.state.combat.status,'won');assert.equal(ended.state.srCombat.buffered,undefined);
});

test('a short step stops at the same authoritative obstacle boundary used by movement',()=>{
 const s=encounter();
 // Registered quarry collision fixture, with the same local person/actor coordinates.
 delete s.state.combat.rulesProfile;delete s.state.combat.geometryId;
 s.state.combat.geometryVersion=1;s.state.combat.regionId='quarry';
 s.state.combat.player.x=3.5;s.state.combat.player.y=1.8;s.state.master.location.x=24.5;s.state.master.location.y=33.8;
 srCombatAction(s.state,'dodge',{x:6.3,y:1.8});SIM.tick(s.state,.1);
 const path=projectCombatActorMotion(s.state,s.state.combat.player).dodgePath;assert(path);assert(path.to.x<3.901);assert(combatCanStand(path.to,'quarry'));assert(combatClearLine(path.from,path.to,'quarry',{movement:true}));assert.deepEqual(path.to,point(s));
});
