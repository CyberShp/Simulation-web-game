import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';

const FOE='person:valley-shanxiao';
function send(s,request){const r=commandSect(s,request);assert.equal(r.ok,true,r.error);return r;}
const world=(s,action)=>send(s,{type:'world',action});
const input=(s,x,y)=>send(s,{type:'combat-input',move:{x,y}});
function until(s,predicate,label){for(let n=0;n<3500&&!predicate(s.state);n++)advanceSect(s,.1);assert(predicate(s.state),label);}
function encounter(){
 let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
 for(const [name,args]of [['masterAction',['heal']],['chooseOpeningInheritance',['qinglan']]])state=SIM.dispatchCommand(state,{name,args}).state;
 while(state.master.wound>0)SIM.tick(state,.1);
 const s=createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:'direct-input-unit-checkpoint'}}});
 world(s,{action:'exit',exitId:'exit:yunxiu-valley'});until(s,s=>!s.master.scenic.path.length,'gate');world(s,{action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}});until(s,s=>!s.srWorld.activeTravelId,'valley');
 world(s,{action:'move',x:24.5,y:36});until(s,s=>!s.srWorld.interaction,'approach');world(s,{action:'engage',objectId:'object:valley:shanxiao'});return s;
}
function closeForMelee(s){for(let n=0;n<60;n++){const p=s.state.combat.player,e=s.state.combat.enemies.find(e=>e.hp>0);if(Math.hypot(e.x-p.x,e.y-p.y)<=SIM.viewSRCombat(s.state).actions.find(a=>a.id==='attack').range)break;input(s,1,0);advanceSect(s,.1);}input(s,0,0);}
function command(s,actionId,target){return send(s,{type:'combat',actionId,target});}
function cast(s,target){command(s,'spell',target);advanceSect(s,.4);assert.equal(s.state.combat.projectiles.length,1);return s.state.combat.projectiles[0];}

test('WASD direction is normalized, key release, expiry, pause and load stop movement',()=>{
 const s=encounter(),p=s.state.combat.player,from={x:p.x,y:p.y};input(s,1,1);advanceSect(s,.1);
 assert(Math.abs(Math.hypot(s.state.combat.player.x-from.x,s.state.combat.player.y-from.y)-.33)<1e-7);
 assert(Math.abs(viewSect(s).expedition.combat.controls.move.x-Math.SQRT1_2)<1e-14);input(s,0,0);const stopped=structuredClone(s.state.combat.player);advanceSect(s,.1);assert.equal(s.state.combat.player.x,stopped.x);assert.equal(s.state.combat.player.y,stopped.y);
 input(s,1,0);advanceSect(s,.6);assert.deepEqual(s.state.combat.controls.move,{x:0,y:0});
 input(s,-1,0);send(s,{type:'pause',paused:true});assert.deepEqual(s.state.combat.controls.move,{x:0,y:0});const tick=s.state.worldTick;advanceSect(s,2);assert.equal(s.state.worldTick,tick);
 send(s,{type:'pause',paused:false});input(s,-1,0);const serialized=JSON.parse(JSON.stringify(snapshotSect(s))),loaded=restoreSect(serialized);assert.deepEqual(loaded.state.combat.controls.move,{x:0,y:0});
 const expected=structuredClone(serialized.state);expected.combat.controls.move={x:0,y:0};expected.combat.controls.moveUntilTick=expected.worldTick;assert.deepEqual(loaded.state,expected);
 const x=loaded.state.combat.player.x;advanceSect(loaded,.1);assert.equal(loaded.state.combat.player.x,x);
 for(let n=0;n<15;n++){input(loaded,-1,0);advanceSect(loaded,.2);}assert(loaded.state.combat.player.x>=.6);assert.equal(loaded.state.master.location.x,loaded.state.combat.sceneFrame.origin.x+loaded.state.combat.player.x);
});

test('manual sword-qi and spell use the supplied direction and empty casts pay without effective practice',()=>{
 const s=encounter(),p=s.state.combat.player,hp=s.state.combat.enemies[0].hp,qi=p.qi,artBefore=structuredClone(s.state.master.artsById);
 command(s,'attack',{x:p.x-5,y:p.y});const attackId=s.state.srCombat.pending.id;until(s,s=>!s.srCombat.pending&&!s.combat.projectiles?.length,'empty sword-qi completes');assert.equal(s.state.combat.enemies[0].hp,hp);assert.equal(s.state.srCombat.executions.filter(a=>a.id===attackId&&a.executed).length,1);assert(!s.state.combat.effects.some(e=>e.actionId===attackId&&e.kind==='hit'));
 until(s,s=>!s.srCombat.pending,'sword recovery');const aim={x:s.state.combat.player.x,y:.6};const shot=cast(s,aim);
 assert.deepEqual(shot.aim,aim);assert.equal(s.state.combat.enemies[0].hp,hp);assert(s.state.combat.player.qi<qi);assert(s.state.srCombat.cooldowns.spell>s.state.worldTick);
 advanceSect(s,1);assert.equal(s.state.combat.enemies[0].hp,hp);assert.equal(s.state.combat.projectiles.length,0);assert.deepEqual(s.state.master.artsById,artBefore);
 assert(s.state.combat.effects.some(e=>e.kind==='miss'));
});

test('a launched spell keeps its exact trajectory through native session load and damages only on collision',()=>{
 let s=encounter();const enemy=s.state.combat.enemies[0],aim={x:enemy.x,y:enemy.y},hp=enemy.hp,shot=cast(s,aim);
 assert.equal(s.state.combat.enemies[0].hp,hp);const saved=JSON.parse(JSON.stringify(snapshotSect(s)));s=restoreSect(saved);
 assert.deepEqual(s.state.combat.projectiles,saved.state.combat.projectiles);assert.deepEqual(s.state.srCombat.pending.target,aim);assert.equal(s.state.combat.enemies[0].hp,hp);
 until(s,s=>s.combat.projectiles.length===0,'projectile collision');assert(s.state.combat.enemies[0].hp<hp);assert(s.state.personsById[FOE].wound>0);
 const executed=s.state.srCombat.pending?.id===shot.actionId?s.state.srCombat.pending:s.state.srCombat.executions.find(a=>a.id===shot.actionId);assert(executed?.executed);assert.equal(executed.result.projectileId,shot.id);assert.deepEqual(executed.result.aim,aim);
 const after=s.state.combat.enemies[0].hp;advanceSect(s,.3);assert.equal(s.state.combat.enemies[0].hp,after);
});

test('movement intent survives an unreleased spell, while a released spell retains qi cooldown and trajectory',()=>{
 const s=encounter(),aim={x:8,y:4},qi=s.state.combat.player.qi;
 command(s,'spell',aim);advanceSect(s,.2);input(s,0,1);assert.equal(s.state.srCombat.pending.action,'spell');assert.equal(s.state.srCombat.pending.executed,false);assert.equal(s.state.combat.player.qi,qi);assert.equal(s.state.srCombat.cooldowns.spell,undefined);
 advanceSect(s,.2);const cooldown=s.state.srCombat.cooldowns.spell,paid=s.state.combat.player.qi;input(s,0,1);assert.equal(s.state.srCombat.pending.executed,true);assert.equal(s.state.srCombat.cooldowns.spell,cooldown);assert.equal(s.state.combat.player.qi,paid);assert.equal(s.state.combat.projectiles.length,1);
});

test('automatic attack has no pursuit or spell, and an unreleased automatic attack yields to a manual skill',()=>{
 const s=encounter();for(let n=0;n<60&&Math.hypot(s.state.combat.enemies[0].x-s.state.combat.player.x,s.state.combat.enemies[0].y-s.state.combat.player.y)<=SIM.viewSRCombat(s.state).actions.find(a=>a.id==='attack').range+2;n++){input(s,-1,0);advanceSect(s,.1);}input(s,0,0);const start={x:s.state.combat.player.x,y:s.state.combat.player.y};send(s,{type:'combat-auto',enabled:true});advanceSect(s,.1);
 assert.equal(s.state.srCombat.pending,null);assert.equal(s.state.combat.player.x,start.x);assert.equal(s.state.combat.player.y,start.y);
 advanceSect(s,.4);assert.equal(s.state.srCombat.pending,null);assert.equal(s.state.combat.player.x,start.x);closeForMelee(s);const inReach={x:s.state.combat.player.x,y:s.state.combat.player.y};until(s,s=>s.srCombat.pending?.automatic&&!s.srCombat.pending.executed,'player walks into basic sword reach');assert.equal(s.state.srCombat.pending.action,'attack');
 const aim={x:.6,y:.6};command(s,'spell',aim);assert.equal(s.state.srCombat.pending.action,'spell');assert.deepEqual(s.state.srCombat.pending.target,aim);assert(!s.state.srCombat.pending.automatic);
 advanceSect(s,.6);assert.equal(s.state.combat.projectiles.length,1);assert.equal(s.state.combat.player.x,inReach.x);assert.equal(s.state.combat.player.y,inReach.y);
});

test('direction input rejects atomically and only changes controls and the manual control handoff',()=>{
 const s=encounter();for(const move of [null,{x:Infinity,y:0},{x:0,y:NaN},{x:2,y:0}]){const before=snapshotSect(s);assert.equal(commandSect(s,{type:'combat-input',move}).ok,false);assert.deepEqual(snapshotSect(s),before);}
 const before=JSON.parse(JSON.stringify(snapshotSect(s)));input(s,1,0);const after=JSON.parse(JSON.stringify(snapshotSect(s)));
 before.state.combat.controls=after.state.combat.controls;before.control=after.control;before.state.masterControl=after.state.masterControl;before.automation.activeAction=after.automation.activeAction;
 assert.deepEqual(after,before);
});

test('manual forward sword-qi and automatic basic attacks apply their real hit without automatically casting a spell',()=>{
 const s=encounter();closeForMelee(s);until(s,s=>!SIM.viewSRCombat(s).actions.find(a=>a.id==='attack').disabled,'player has walked into melee reach');
 let enemy=s.state.combat.enemies[0],hp=enemy.hp;command(s,'attack',{x:enemy.x,y:enemy.y});advanceSect(s,.4);assert(s.state.combat.enemies[0].hp<hp);
 until(s,s=>!s.srCombat.pending,'manual recovery');send(s,{type:'combat-auto',enabled:true});hp=s.state.combat.enemies[0].hp;
 until(s,s=>s.combat.enemies[0].hp<hp,'automatic in-range hit');assert(!s.state.srCombat.executions.some(o=>o.action==='spell'));assert((s.state.combat.projectiles||[]).every(shot=>shot.kind==='sword-qi'));
 send(s,{type:'combat-auto',enabled:false});
});
