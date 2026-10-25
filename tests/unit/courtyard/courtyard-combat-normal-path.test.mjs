import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpeningSectSession,commandSect,advanceSect,openingView,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
function send(s,q){const reply=commandSect(s,q);assert.equal(reply.ok,true,reply.error);return reply;}
function until(s,p,label){for(let n=0;n<3000&&!p(s);n++)advanceSect(s,.1);assert(p(s),label);}
function ready(){const s=createOpeningSectSession();for(const page of [1,2])send(s,{type:'opening-intro',page});send(s,{type:'opening-intro',complete:true});send(s,{type:'heal'});send(s,{type:'choose-inheritance',lineage:'qinglan'});until(s,()=>openingView(s).stage==='hall-ready','recovery');send(s,{type:'establish-hall'});until(s,()=>openingView(s).stage==='complete','construction');return s;}
const world=(s,action)=>send(s,{type:'world',action});
function exit(s,exitId){world(s,{action:'exit',exitId});until(s,()=>!s.state.srWorld.interaction&&!s.state.master.scenic.path.length,'walk to actual exit');world(s,{action:'exit',exitId});until(s,()=>!s.state.srWorld.activeTravelId,'travel');}
function encounter(){const s=ready();exit(s,'exit:yunxiu-valley');world(s,{action:'move',x:24.5,y:36});until(s,()=>!s.state.srWorld.interaction,'approach opponent');world(s,{action:'engage',objectId:'object:valley:shanxiao'});return s;}
function closeForMelee(s){for(let n=0;n<80;n++){const c=s.state.combat,p=c.player,e=c.enemies.find(e=>e.hp>0),d=Math.hypot(e.x-p.x,e.y-p.y),range=viewSect(s).expedition.combat.actions.find(a=>a.id==='attack').range;if(d<=range)break;send(s,{type:'combat-input',move:{x:(e.x-p.x)/d,y:(e.y-p.y)/d}});advanceSect(s,.1);}send(s,{type:'combat-input',move:{x:0,y:0}});}
function restore(s){const running=s.state.speed!==0;if(running)send(s,{type:'pause',paused:true});const before=snapshotSect(s),after=restoreSect(before);assert.deepEqual(after,before);if(running)send(after,{type:'pause',paused:false});return after;}
test('the completed official desktop opening physically reaches the gate and returns its injured master',()=>{
 let s=encounter();assert.equal(s.state.master.personId,'person:master');assert.equal(viewSect(s).expedition.scene.type,'combat');
 until(s,()=>s.state.master.wound>0,'actual enemy damage');const wound=s.state.master.wound;
 until(s,()=>!(s.state.combat.player.staggerUntilTick>s.state.worldTick),'recover from the actual hit before retreating');
 send(s,{type:'combat',actionId:'retreat'});until(s,()=>s.state.combat.status==='retreated','physical retreat');
 assert(s.state.master.wound>=wound);assert(Math.hypot(s.state.master.location.x-21.7,s.state.master.location.y-36)<.4);
 s=restore(s);send(s,{type:'combat-acknowledge'});exit(s,'exit:valley-yunxiu');
 assert.equal(s.state.master.location.sceneId,'scene:yunxiu-courtyard');assert(s.state.master.wound>0);assert.equal(s.state.master.personId,'person:master');restore(s);
});
test('desktop paused spell planning and expedition reads preserve costs and pending action across restore',()=>{
 let s=encounter();send(s,{type:'pause',paused:true});const before=structuredClone(s.state),qi=before.combat.player.qi;
 send(s,{type:'combat',actionId:'spell',target:'enemy-1'});assert.equal(s.state.worldTick,before.worldTick);assert.equal(s.state.combat.player.qi,qi);assert.deepEqual(s.state.combat.enemies,before.combat.enemies);
 const planned=snapshotSect(s);for(let n=0;n<3;n++){viewSect(s);advanceSect(s,1);}assert.deepEqual(s,planned);
 s=restore(s);assert.equal(s.state.srCombat.pending.action,'spell');send(s,{type:'pause',paused:false});until(s,()=>!s.state.srCombat.pending,'spell recovery');assert(s.state.combat.player.qi<qi);assert(s.state.combat.enemies[0].hp<before.combat.enemies[0].hp);restore(s);
});

// Same predicates as the native harness, applied after a JSON boundary like IPC.
import {masterOf,atExit,arrivedIn,walkSettled,pendingDone,actionReady,guardActive,injuredReady,retreatComplete} from '../../acceptance/courtyard-combat-observations.mjs';
import fs from 'node:fs/promises';
test('all native harness predicates use serialized canonical fields through the complete normal path',async()=>{
 let s=ready();const stages=[];
 const read=()=>JSON.parse(JSON.stringify({session:snapshotSect(s),view:viewSect(s),status:{manualPause:s.state.speed===0},errors:[]}));
 const sample=label=>{const r=read();const p=masterOf(r);assert.equal(p.personId,'person:master');assert(p.position&&typeof p.position.sceneId==='string');assert(Array.isArray(p.scenic.path));assert.equal(typeof p.wound,'number');assert(Number.isSafeInteger(r.session.state.worldTick));assert(r.session.state.srWorld);assert(r.session.state.srCombat);assert(Array.isArray(r.view.expedition.world.exits));stages.push({label,...r});return r;};
 const untilRead=(predicate,label)=>{until(s,()=>predicate(read()),label);return sample(label);};
 const resumed=()=>send(s,{type:'pause',paused:false});
 const travel=id=>{world(s,{action:'exit',exitId:id});untilRead(r=>atExit(r,id),'at '+id);world(s,{action:'exit',exitId:id});};
 sample('official opening complete');travel('exit:yunxiu-valley');untilRead(r=>arrivedIn(r,'scene:valley'),'valley arrival');
 world(s,{action:'move',x:24.5,y:36});untilRead(walkSettled,'opponent approach');world(s,{action:'engage',objectId:'object:valley:shanxiao'});sample('engaged');send(s,{type:'pause',paused:true});
 const queuedBefore=read(),qi=queuedBefore.session.state.combat.player.qi,hp=queuedBefore.session.state.combat.enemies[0].hp;
 send(s,{type:'combat',actionId:'spell',target:'enemy-1'});let r=sample('paused spell');assert.equal(r.session.state.combat.player.qi,qi);assert.equal(r.session.state.worldTick,queuedBefore.session.state.worldTick);assert.equal(r.session.state.srCombat.pending.action,'spell');
 s=restore(s);resumed();r=untilRead(pendingDone,'spell execution');assert(r.session.state.combat.enemies[0].hp<hp);assert(r.session.state.combat.player.qi<qi);
 closeForMelee(s);untilRead(r=>actionReady(r,'attack'),'attack available after actual approach');const enemyHp=read().session.state.combat.enemies[0].hp;send(s,{type:'combat',actionId:'attack',target:'enemy-1'});r=untilRead(pendingDone,'attack execution');assert(r.session.state.combat.enemies[0].hp<enemyHp);
 untilRead(r=>actionReady(r,'guard'),'guard available');send(s,{type:'combat',actionId:'guard'});untilRead(guardActive,'guard effect');untilRead(pendingDone,'guard recovery');
 const beforeDodge=masterOf(read()).position,p=read().session.state.combat.player;send(s,{type:'combat',actionId:'dodge',target:{x:p.x,y:Math.min(7.4,p.y+2.8)}});r=untilRead(pendingDone,'dodge');assert.notDeepEqual(masterOf(r).position,beforeDodge);
 r=untilRead(injuredReady,'actual wound');assert(r.session.state.combat.player.hp<r.session.state.combat.player.maxHp);send(s,{type:'combat',actionId:'retreat'});r=untilRead(retreatComplete,'physical retreat');assert(masterOf(r).wound>0);assert(Math.hypot(masterOf(r).position.x-21.7,masterOf(r).position.y-36)<.4);s=restore(s);
 send(s,{type:'combat-acknowledge'});travel('exit:valley-yunxiu');r=untilRead(r=>arrivedIn(r,'scene:yunxiu-courtyard'),'injured home');assert(masterOf(r).wound>0);s=restore(s);sample('injured home restored');
 if(process.env.COMBAT_SERIALIZED_EVIDENCE){await fs.writeFile(process.env.COMBAT_SERIALIZED_EVIDENCE,JSON.stringify({scope:'Node integer simulation preparation and JSON-serialized native predicate checks; not Electron acceptance',stages},null,2)+'\n');}
});

import {manualActionReady,movementCleared,combatPoint,firstEnemy,projectilePresent,attackSettled,automaticAttackProven} from '../../acceptance/courtyard-combat-observations.mjs';
test('native direct control predicates survive JSON through input, projectile, auto, and injured return',async()=>{
 let s=encounter();const stages=[];
 const read=()=>JSON.parse(JSON.stringify({session:snapshotSect(s),view:viewSect(s),status:{manualPause:s.state.speed===0},errors:[]}));
 const sample=label=>{const r=read();assert.equal(masterOf(r).personId,'person:master');assert(masterOf(r).position);if(r.session.state.combat?.status==='active'){assert.equal(r.view.expedition.scene.presentation,'independent-arena');assert(Array.isArray(r.view.expedition.combat.manualActions));assert.equal(typeof r.view.expedition.combat.controls.autoAttack,'boolean');assert(Array.isArray(r.view.expedition.combat.projectiles));}stages.push({label,...r});return r;};
 const untilRead=(predicate,label)=>{until(s,()=>predicate(read()),label);return sample(label);};
 const input=move=>send(s,{type:'combat-input',move}),auto=enabled=>send(s,{type:'combat-auto',enabled});
 const hold=(move,ticks)=>{for(let n=0;n<ticks;n++){if(n%2===0)input(move);advanceSect(s,.1);}input({x:0,y:0});};
 sample('engaged independent arena');const initial=combatPoint(read());hold({x:0,y:-1},4);assert(combatPoint(read()).y<initial.y);assert(movementCleared(read()));const stopped=combatPoint(read());advanceSect(s,.5);assert.deepEqual(combatPoint(read()),stopped);sample('keyup stopped');
 input({x:1,y:1});assert(Math.abs(Math.hypot(...Object.values(read().view.expedition.combat.controls.move))-1)<1e-8);hold({x:1,y:1},4);sample('normalized diagonal');
 hold({x:-1,y:0},35);assert(combatPoint(read()).x>=.599999);assert(combatPoint(read()).x<.61);sample('left boundary');input({x:1,y:0});send(s,{type:'pause',paused:true});assert(movementCleared(read()));s=restore(s);assert(movementCleared(read()));sample('paused input cleared');send(s,{type:'pause',paused:false});
 const p=combatPoint(read()),e=firstEnemy(read()),empty=[{x:.8,y:.8},{x:.8,y:7.2},{x:11.2,y:.8},{x:11.2,y:7.2}].sort((a,b)=>((a.x-p.x)*(e.x-p.x)+(a.y-p.y)*(e.y-p.y))/Math.hypot(a.x-p.x,a.y-p.y)-((b.x-p.x)*(e.x-p.x)+(b.y-p.y)*(e.y-p.y))/Math.hypot(b.x-p.x,b.y-p.y))[0];
 const blankBefore=read(),art=blankBefore.view.expedition.combat.manualActions.find(a=>a.id==='spell').art;
 send(s,{type:'pause',paused:true});send(s,{type:'combat',actionId:'spell',target:empty});sample('paused empty spell');s=restore(s);send(s,{type:'pause',paused:false});let r=untilRead(attackSettled,'empty directional spell');assert.equal(firstEnemy(r).hp,firstEnemy(blankBefore).hp);assert(r.session.state.combat.player.qi<blankBefore.session.state.combat.player.qi);assert.deepEqual(masterOf(r).artsById[art],masterOf(blankBefore).artsById[art]);
 untilRead(r=>manualActionReady(r,'spell'),'manual spell available');const hitBefore=read();send(s,{type:'combat',actionId:'spell',target:{x:firstEnemy(hitBefore).x,y:firstEnemy(hitBefore).y}});r=untilRead(projectilePresent,'projectile in flight');assert.equal(firstEnemy(r).hp,firstEnemy(hitBefore).hp);assert.deepEqual(masterOf(r).artsById[art],masterOf(hitBefore).artsById[art]);s=restore(s);r=untilRead(r=>attackSettled(r)&&firstEnemy(r).hp<firstEnemy(hitBefore).hp,'projectile collided');
 closeForMelee(s);const autoBefore=read(),feet=combatPoint(autoBefore),executionStart=s.state.srCombat.executions.length;auto(true);r=untilRead(r=>firstEnemy(r).hp<firstEnemy(autoBefore).hp,'automatic normal attack');assert.deepEqual(combatPoint(r),feet);assert.equal(r.session.state.combat.player.target,null);assert(automaticAttackProven(r,executionStart));auto(false);untilRead(pendingDone,'auto action recovered');const hpOff=firstEnemy(read()).hp;advanceSect(s,1.6);assert.equal(firstEnemy(read()).hp,hpOff);sample('auto off remains stopped');
 untilRead(r=>manualActionReady(r,'guard')&&(!firstEnemy(r).telegraph||firstEnemy(r).telegraph.remaining>(r.view.expedition.combat.manualActions.find(a=>a.id==='guard').windup+1)/10),'guard ready before the visible strike');send(s,{type:'combat',actionId:'guard'});untilRead(guardActive,'guard duration');untilRead(pendingDone,'guard recovered');const dodgeFrom=combatPoint(read());send(s,{type:'combat',actionId:'dodge',target:{x:dodgeFrom.x,y:7.2}});r=untilRead(pendingDone,'directional dodge');assert.notDeepEqual(combatPoint(r),dodgeFrom);untilRead(injuredReady,'actual enemy injury');send(s,{type:'combat',actionId:'retreat'});r=untilRead(retreatComplete,'physical retreat');assert(masterOf(r).wound>0);s=restore(s);send(s,{type:'combat-acknowledge'});exit(s,'exit:valley-yunxiu');r=sample('injured home');assert(arrivedIn(r,'scene:yunxiu-courtyard'));assert(masterOf(r).wound>0);s=restore(s);sample('injured home restored');
 if(process.env.COMBAT_DIRECT_EVIDENCE)await fs.writeFile(process.env.COMBAT_DIRECT_EVIDENCE,JSON.stringify({scope:'public integer simulation with JSON boundary and native shared predicates; no Electron',stages},null,2)+'\n');
});
