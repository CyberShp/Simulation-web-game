import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect} from '../../../apps/courtyard/sect-sim.mjs';
import {STUDY_FRAMES,STUDY_GROUND_Y_SCALE} from '../../../src/simulation/ea-combat-sword-study-frames.mjs';
import {receiveCombatImpact,COMBAT_IMPACT_TUNING} from '../../../src/simulation/ea-combat-impact.mjs';

const send=(s,q)=>{const result=commandSect(s,q);assert.equal(result.ok,true,result.error);return result;};
const command=(s,actionId,target)=>send(s,{type:'combat',actionId,target});
function until(s,predicate,label){for(let i=0;i<2000&&!predicate(s.state);i++)advanceSect(s,.1);assert(predicate(s.state),label);}
function encounter(){
 let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
 for(const [name,args]of [['masterAction',['heal']],['chooseOpeningInheritance',['qinglan']]])state=SIM.dispatchCommand(state,{name,args}).state;
 while(state.master.wound>0)SIM.tick(state,.1);
 const s=createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:'combat-impact-checkpoint'}}});
 const world=action=>send(s,{type:'world',action});
 world({action:'exit',exitId:'exit:yunxiu-valley'});until(s,s=>!s.master.scenic.path.length,'walk to gate');world({action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}});until(s,s=>!s.srWorld.activeTravelId,'arrive in valley');
 world({action:'move',x:24.5,y:36});until(s,s=>!s.srWorld.interaction,'approach');world({action:'engage',objectId:'object:valley:shanxiao'});return s;
}
function closeForMelee(s){for(let n=0;n<60;n++){const p=s.state.combat.player,e=s.state.combat.enemies.find(e=>e.hp>0);if(Math.hypot(e.x-p.x,e.y-p.y)<=SIM.viewSRCombat(s.state).actions.find(a=>a.id==='attack').range)break;send(s,{type:'combat-input',move:{x:1,y:0}});advanceSect(s,.1);}send(s,{type:'combat-input',move:{x:0,y:0}});}
const hit=(s,targetId)=>s.combat.effects.filter(e=>e.kind==='hit'&&e.targetId===targetId).at(-1);

test('normal public sword-qi emits one stable contact and briefly holds the real enemy windup',()=>{
 const s=encounter();until(s,s=>s.combat.enemies[0].telegraph?.remaining>=.7,'enemy raises its arm');
 closeForMelee(s);const foe=s.state.combat.enemies[0];command(s,'attack',{x:foe.x,y:foe.y});until(s,s=>!!hit(s,'enemy-1'),'sword-qi body contact');
 const event=hit(s.state,'enemy-1'),enemy=s.state.combat.enemies[0];assert(event);assert.equal(event.outcome,'hit');assert.equal(event.reaction,'light');assert.equal(event.staggerTicks,2);assert.equal(event.interrupted,false);assert(event.amount>0);assert.equal(event.tick,s.state.worldTick);assert.equal(event.sourceId,'master');assert.equal(event.actionId,s.state.srCombat.pending.id);assert(Math.abs(Math.hypot(event.direction.x,event.direction.y)-1)<1e-9);assert.equal(event.space,'visible-body-v1');assert.equal(typeof event.bodyFrameKey,'string');const frame=STUDY_FRAMES[event.bodyFrameKey],sign=enemy.facing.x>0?-1:1;const px=frame.root[0]+(event.contact.x-event.to.x)/(frame.scale*sign),py=frame.root[1]+(event.contact.y-event.to.y)*STUDY_GROUND_Y_SCALE/frame.scale;assert(frame.rows.some(row=>py>=row[0]-1e-7&&py<=row[0]+1+1e-7&&row.slice(1).some((x,i,spans)=>i%2===0&&px>=x-1e-7&&px<=spans[i+1]+1e-7)),'the actual impact lies on an opaque body row, before knockback');
 const remaining=enemy.telegraph.remaining,tick=s.state.worldTick,position={x:enemy.x,y:enemy.y};advanceSect(s,.1);assert.equal(s.state.combat.enemies[0].telegraph.remaining,remaining);assert.deepEqual({x:s.state.combat.enemies[0].x,y:s.state.combat.enemies[0].y},position);assert.equal(viewSect(s).expedition.scene.enemies[0].motion.phase,'hit');
 advanceSect(s,.1);assert(s.state.combat.enemies[0].telegraph.remaining<remaining);assert.equal(s.state.combat.enemies[0].staggerImmuneUntilTick,tick+2+COMBAT_IMPACT_TUNING.protectionTicks);
 const before=snapshotSect(s);for(let i=0;i<4;i++)viewSect(s);assert.deepEqual(snapshotSect(s),before);assert.equal(s.state.combat.effects.filter(e=>e.eventId===event.eventId).length,1);
});

test('projectile collision keeps the launched direction and original source while the caster moves',()=>{
 const s=encounter(),foe=s.state.combat.enemies[0];command(s,'spell',{x:foe.x,y:foe.y});advanceSect(s,.4);const shot=structuredClone(s.state.combat.projectiles[0]);
 send(s,{type:'combat-input',move:{x:0,y:-1}});advanceSect(s,.1);send(s,{type:'combat-input',move:{x:0,y:0}});
 until(s,s=>!!hit(s,'enemy-1'),'actual projectile impact');const event=hit(s.state,'enemy-1'),enemy=s.state.combat.enemies[0];
 assert.equal(event.projectileId,shot.id);assert.equal(event.actionId,shot.actionId);assert.deepEqual(event.direction,shot.direction);assert.deepEqual(event.from,shot.from);assert.notEqual(event.from.y,s.state.combat.player.y);assert(Math.abs(Math.hypot(event.contact.x-event.to.x,event.contact.y-event.to.y)-shot.radius)<1e-7);assert.equal(event.staggerTicks,3);
 const hp=enemy.hp;advanceSect(s,.1);assert.equal(s.state.combat.enemies[0].hp,hp);
});

test('a real heavy hit interrupts an unreleased player spell without paying or setting its cooldown',()=>{
 const s=encounter();until(s,s=>s.combat.enemies[0].telegraph?.remaining<=.21,'imminent enemy strike');
 const foe=s.state.combat.enemies[0],qi=s.state.combat.player.qi;command(s,'spell',{x:foe.x,y:foe.y});const actionId=s.state.srCombat.pending.id;
 until(s,s=>!!hit(s,'master'),'actual hit');const event=hit(s.state,'master');assert.equal(event.interrupted,true);assert.equal(event.staggerTicks,3);assert.equal(s.state.srCombat.pending,null);assert.equal(s.state.combat.player.qi,qi);assert.equal(s.state.srCombat.cooldowns.spell,undefined);assert(!s.state.combat.projectiles?.length);assert.equal(s.state.srCombat.executions.filter(o=>o.id===actionId&&o.phase==='interrupted').length,1);
 const p={x:s.state.combat.player.x,y:s.state.combat.player.y};send(s,{type:'combat-input',move:{x:0,y:-1}});advanceSect(s,.1);assert.deepEqual({x:s.state.combat.player.x,y:s.state.combat.player.y},p);const queued=commandSect(s,{type:'combat',actionId:'guard'});assert.equal(queued.ok,true);assert.equal(queued.result.buffered,true);assert.equal(s.state.combat.player.guard,0);assert.equal(s.state.srCombat.pending,null);
 send(s,{type:'pause',paused:true});const before=snapshotSect(s);advanceSect(s,2);assert.deepEqual(snapshotSect(s),before);send(s,{type:'pause',paused:false});send(s,{type:'combat-input',move:{x:0,y:-1}});
 until(s,s=>s.worldTick>=event.staggerUntilTick,'stand up');assert(s.state.combat.player.y<p.y);send(s,{type:'combat-input',move:{x:0,y:0}});command(s,'spell',{x:foe.x,y:foe.y});advanceSect(s,.4);assert.equal(s.state.combat.projectiles.length,1);assert.equal(s.state.srCombat.executions.filter(o=>o.id===actionId).length,1);
});

test('heavy projectile impact cancels a real enemy windup and gives it a bounded recovery',()=>{
 const s=encounter();until(s,s=>s.combat.enemies[0].telegraph?.remaining>=.7,'enemy windup');const foe=s.state.combat.enemies[0];command(s,'spell',{x:foe.x,y:foe.y});
 until(s,s=>!!hit(s,'enemy-1'),'heavy projectile contact');const event=hit(s.state,'enemy-1');assert.equal(event.interrupted,true);assert.equal(s.state.combat.enemies[0].telegraph,null);assert(s.state.combat.enemies[0].cooldown>0);
 until(s,s=>!!s.combat.enemies[0].telegraph,'enemy attacks again after recovery');assert(s.state.worldTick>event.staggerUntilTick);
});

test('guarded contact and short-step evasion have distinct damage results and no hitstun',()=>{
 const guarded=encounter();until(guarded,s=>s.combat.enemies[0].telegraph?.remaining<.8,'guard opportunity');command(guarded,'guard');until(guarded,s=>!!hit(s,'master'),'guard collision');const guard=hit(guarded.state,'master');assert.equal(guard.outcome,'guarded');assert(guard.amount>0&&guard.amount<guard.rawAmount);assert.equal(guard.staggerTicks,0);assert.equal(guard.reaction,'guard');assert(guard.preventedAmount>0);
 const evaded=encounter();until(evaded,s=>s.combat.enemies[0].telegraph?.remaining<.5,'dodge opportunity');const p=evaded.state.combat.player;command(evaded,'dodge',{x:p.x,y:p.y+1.05});until(evaded,s=>!!hit(s,'master'),'evaded contact');const evade=hit(evaded.state,'master');assert.equal(evade.outcome,'evaded');assert.equal(evade.amount,0);assert.equal(evade.reaction,'evade');assert.equal(evade.staggerTicks,0);assert.equal(evaded.state.master.wound,0);
});

test('reaction protection keeps later damage from extending light stagger or discarding windup',()=>{
 const target={hp:50,telegraph:{remaining:1},windup:1,cooldown:0},s={worldTick:10},details={eventId:'fixture:1',direction:{x:1,y:0},contact:{x:2,y:2},outcome:'hit',kind:'attack',amount:5};
 const first=receiveCombatImpact(s,{},target,details);assert.equal(first.staggerTicks,2);const until=target.staggerUntilTick,protectedUntil=target.staggerImmuneUntilTick,reaction=structuredClone(target.hitReaction);s.worldTick=11;
 const second=receiveCombatImpact(s,{},target,{...details,eventId:'fixture:2'});assert.equal(second.staggerTicks,0);assert.equal(target.staggerUntilTick,until);assert.equal(target.staggerImmuneUntilTick,protectedUntil);assert.deepEqual(target.hitReaction,reaction);assert.equal(target.telegraph.remaining,1);
 s.worldTick=protectedUntil;assert.equal(receiveCombatImpact(s,{},target,{...details,eventId:'fixture:3'}).staggerTicks,2);
});

test('a light-reaction fixture freezes the existing player windup and resumes it once',()=>{
 const s=encounter(),foe=s.state.combat.enemies[0];command(s,'spell',{x:foe.x,y:foe.y});advanceSect(s,.2);const pending=structuredClone(s.state.srCombat.pending),tick=s.state.worldTick;
 // Isolated reaction fixture: real damage and normal paths are covered separately above.
 receiveCombatImpact(s.state,s.state.combat,s.state.combat.player,{eventId:'fixture:light',direction:{x:1,y:0},contact:{x:s.state.combat.player.x,y:s.state.combat.player.y},outcome:'hit',kind:'attack',amount:1});
 advanceSect(s,.1);assert.equal(s.state.srCombat.pending.progressTicks,pending.progressTicks);assert.equal(s.state.srCombat.pending.id,pending.id);assert.equal(viewSect(s).expedition.scene.player.motion.phase,'hit');
 advanceSect(s,.1);assert.equal(s.state.worldTick,tick+2);assert.equal(s.state.srCombat.pending.progressTicks,pending.progressTicks+1);assert.equal(s.state.srCombat.pending.executed,false);
 until(s,s=>s.srCombat.pending?.executed,'resume the same spell');assert.equal(s.state.srCombat.pending.id,pending.id);assert.equal(s.state.combat.projectiles.length,1);
});

test('a spell already in flight keeps moving while its caster is staggered and is charged once',()=>{
 const s=encounter();until(s,s=>s.combat.enemies[0].telegraph?.remaining<=.61,'windup release opportunity');const p=s.state.combat.player;command(s,'spell',{x:p.x-6,y:p.y});advanceSect(s,.6);const actionId=s.state.srCombat.pending.id,shotId=s.state.combat.projectiles[0].id,cooldown=s.state.srCombat.cooldowns.spell;
 until(s,s=>!!hit(s,'master'),'caster struck after launch');assert.equal(s.state.srCombat.pending.executed,true);assert.equal(hit(s.state,'master').interrupted,false);const shot=structuredClone(s.state.combat.projectiles[0]);assert.equal(shot.id,shotId);const paid=s.state.combat.player.qi;
 advanceSect(s,.1);assert(s.state.combat.projectiles[0].remainingDistance<shot.remainingDistance);assert.equal(s.state.srCombat.cooldowns.spell,cooldown);assert(s.state.combat.player.qi>=paid);
 until(s,s=>!s.srCombat.pending,'caster finishes recovery');assert.equal(s.state.srCombat.executions.filter(o=>o.id===actionId&&o.executed).length,1);
});

test('normal public victory settles once and releases every reaction and pending combat body',()=>{
 const s=encounter();closeForMelee(s);send(s,{type:'combat-auto',enabled:true});until(s,s=>s.combat.status==='won','ordinary automatic attacks win');
 const result=structuredClone(s.state.combat.result),facts=Object.values(s.state.factsById).filter(f=>f.kind==='combat-result');assert.equal(facts.length,1);assert.equal(s.state.srCombat.pending,null);assert.equal(s.state.master.activityId,null);assert.equal(s.state.combat.enemies[0].telegraph,null);assert(s.state.master.wound>0,'the enemy still gets a real strike through repeated light hits');
 for(const a of [s.state.combat.player,...s.state.combat.enemies]){assert.equal(a.hitReaction,undefined);assert.equal(a.staggerUntilTick,undefined);}
 advanceSect(s,1);assert.deepEqual(s.state.combat.result,result);assert.equal(Object.values(s.state.factsById).filter(f=>f.kind==='combat-result').length,1);
});
