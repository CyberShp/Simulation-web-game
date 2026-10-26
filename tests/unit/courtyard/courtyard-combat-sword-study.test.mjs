import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {basicCombatAttackProfile,SWORD_STUDY_PROFILE,VALLEY_SWORD_QI_ATTACK} from '../../../src/simulation/ea-combat-attack-profiles.mjs';
import {combatCanStand} from '../../../src/simulation/ea-combat-geometry.mjs';
import {getCampaignScene} from '../../../src/simulation/ea-campaign.mjs';
import {setCombatActorHp,projectCombatActorMotion} from '../../../src/simulation/ea-sr-combat.mjs';
import {sampleSwordStudyBody} from '../../../src/simulation/ea-combat-sword-study-frames.mjs';
import {studyMuzzle,studyAimDirection,advanceStudyShot,sweepStudyBody} from '../../../src/simulation/ea-combat-study-body.mjs';

const sources=new Map();
function harness(source){
 let state=source?SIM.validateSave(structuredClone(source)):SIM.initial({sr:true,mountainOpening:true,seed:271828});
 const api={get state(){return state;},send(name,...args){const reply=SIM.dispatchCommand(state,{name,args});state=reply.state;return reply.result;},step(n=1){for(let i=0;i<n;i++)SIM.tick(state,.1);},until(predicate,label,max=3500){for(let i=0;i<max&&!predicate(state);i++)this.step();assert(predicate(state),label);}};
 return api;
}
function battle(kit='jinfeng'){
 if(!sources.has(kit)){
  const p=harness();p.send('masterAction','heal');p.send('chooseOpeningInheritance',kit);p.until(s=>s.master.wound===0,'healed');
  const world=action=>p.send('srWorldCommand',action);
  world({action:'exit',exitId:'exit:yunxiu-valley'});p.until(s=>!s.master.scenic.path.length,'at gate');
  world({action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}});p.until(s=>!s.srWorld.activeTravelId,'in valley');
  world({action:'move',x:21,y:36});p.until(s=>!s.srWorld.interaction,'at encounter');
  world({action:'engage',objectId:'object:valley:shanxiao'});sources.set(kit,structuredClone(p.state));
 }
 return harness(sources.get(kit));
}
const action=(p,id,target)=>p.send('combatAction',id,target);
const enemy=p=>p.state.combat.enemies[0];
const aim=p=>({x:enemy(p).x,y:enemy(p).y});
const move=(p,x,y)=>p.send('setSRCombatInput',{x,y});

test('new single-player battle selects a creation-time profile; unmarked old in-flight rules survive roundtrip',()=>{
 const p=battle();assert.equal(p.state.combat.rulesProfile,SWORD_STUDY_PROFILE);
 assert.equal(getCampaignScene(p.state).rulesProfile,SWORD_STUDY_PROFILE);
 assert.equal(SIM.viewSRCombat(p.state).manualActions.find(a=>a.id==='attack').range,8);
 const old=structuredClone(p.state);delete old.combat.rulesProfile;const legacy=harness(old);
 assert.equal(basicCombatAttackProfile(legacy.state.combat),VALLEY_SWORD_QI_ATTACK);
 action(legacy,'attack',aim(legacy));legacy.step(2);
 const shot=structuredClone(legacy.state.combat.projectiles[0]);
 assert.equal(shot.speed,16);assert.equal(shot.range,10);assert.equal(shot.radius,.45);assert.equal(shot.space,undefined);
 const loaded=harness(legacy.state);assert.deepEqual(loaded.state.combat.projectiles[0],shot);
 loaded.step();assert(loaded.state.combat.projectiles[0].remainingDistance<shot.remainingDistance);
});

test('moving light attack releases from the visible muzzle at step two, travels and hits at most once',()=>{
 const p=battle(),start={...p.state.combat.player},hp=enemy(p).hp;move(p,0,-1);
 const target=aim(p);action(p,'attack',target);p.step();assert.equal(p.state.combat.projectiles,undefined);p.step();
 const shot=structuredClone(p.state.combat.projectiles[0]);assert.equal(shot.speed,12);assert.equal(shot.range,8);assert.equal(shot.coreLength,.7);assert.equal(shot.coreWidth,.1);
 assert.deepEqual(shot.from,studyMuzzle(p.state.combat.player));assert.equal(shot.launchedTick,p.state.worldTick);
 assert(Math.abs(start.y-p.state.combat.player.y-.66)<1e-6);assert.equal(enemy(p).hp,hp);
 move(p,0,0);p.until(s=>!s.combat.projectiles.length,'shot resolves',20);
 const hits=p.state.combat.effects.filter(e=>e.kind==='hit'&&e.projectileId===shot.id);
 assert.equal(hits.length,1);assert(hits[0].amount>0);assert(hits[0].bodyFrameKey);assert.equal(hits[0].contactHeight,0);
 const after=enemy(p).hp;p.step(3);assert.equal(enemy(p).hp,after);assert.equal(p.state.srCombat.pending,null);
});

test('Q freezes the submitted ground point, releases on step three, then allows movement and independent impact',()=>{
 const p=battle(),target=aim(p),requested={...target},at={...p.state.combat.player},qi=at.qi;
 move(p,0,-1);action(p,'ground-sword',requested);requested.x-=5;p.step(2);
 const windup=getCampaignScene(p.state).player.motion;assert.deepEqual(windup.target,target);windup.target.x-=1;assert.deepEqual(p.state.srCombat.pending.target,target);
 assert.equal(p.state.combat.player.y,at.y);assert.equal(p.state.combat.player.qi,qi);assert.equal(p.state.combat.groundStrikes,undefined);
 p.step();assert.equal(p.state.srCombat.pending,null);assert.equal(p.state.combat.player.y,at.y);assert.equal(p.state.combat.player.qi,qi-16);
 const released=getCampaignScene(p.state).player.motion;assert.equal(released.action,'ground-sword');assert.equal(released.phase,'release');assert.equal(released.movementLocked,false);
 const strike=structuredClone(p.state.combat.groundStrikes[0]);assert.deepEqual(strike.target,target);assert.equal(strike.landTick,strike.releasedTick+1);
 assert.equal(p.state.srCombat.cooldowns['ground-sword'],strike.releasedTick+18);
 action(p,'dodge',{x:at.x,y:at.y-2.8});p.step();
 assert(p.state.combat.player.y<at.y);assert.equal(p.state.combat.groundStrikes.length,0);
 const hits=p.state.combat.effects.filter(e=>e.kind==='hit'&&e.groundStrikeId===strike.id);assert.equal(hits.length,1);assert.equal(hits[0].tick,strike.landTick);assert(hits[0].amount>0);
 assert.equal(hits[0].rawAmount,(13+p.state.master.realm*2+40*.1)*1.8);
 assert(combatCanStand(enemy(p),p.state.combat.geometryId));
});

test('Q misses a displaced target and Space cancels unreleased actions without ghost effects or old costs',()=>{
 const p=battle(),at={...p.state.combat.player},target={x:at.x-2,y:at.y};action(p,'ground-sword',target);p.step(3);p.step();
 assert(!p.state.combat.effects.some(e=>e.kind==='hit'&&e.groundSword));assert(p.state.combat.effects.some(e=>e.kind==='miss'&&e.groundSword));
 for(const id of ['ground-sword','attack']){
  const q=battle(),qi=q.state.combat.player.qi;action(q,id,aim(q));q.step();
  action(q,'dodge',{x:q.state.combat.player.x,y:q.state.combat.player.y-2.8});q.step(4);
  assert.equal(q.state.srCombat.cooldowns[id],undefined);assert.equal(q.state.combat.groundStrikes?.length||0,0);assert.equal(q.state.combat.projectiles?.length||0,0);
  assert(!q.state.combat.effects.some(e=>e.kind==='hit'&&e.sourceId==='master'));assert(q.state.combat.player.qi>=qi-8);
 }
});

test('other inheritances retain their learned spell and Q rejection leaves their state intact',()=>{
 const p=battle('qinglan'),before=structuredClone(p.state);assert.throws(()=>action(p,'ground-sword',aim(p)),/剑术/);assert.deepEqual(p.state,before);
 assert.equal(SIM.viewSRCombat(p.state).manualActions.find(a=>a.id==='spell').name,'青岚引风术');
 action(p,'spell',aim(p));p.step(4);assert.equal(p.state.combat.projectiles[0].kind,'spell');assert.equal(p.state.combat.projectiles[0].speed,8);
});

test('new pending ground strike and visible projectile fields roundtrip; forged profile or timing fails atomically',()=>{
 const p=battle();action(p,'ground-sword',aim(p));p.step(3);const saved=structuredClone(p.state),loaded=harness(saved);assert.deepEqual(loaded.state,saved);
 for(const edit of [s=>s.combat.rulesProfile='unknown',s=>s.combat.groundStrikes[0].landTick++,s=>s.combat.groundStrikes[0].radius=8]){
  const forged=structuredClone(saved);edit(forged);assert.throws(()=>SIM.validateSave(forged));assert.deepEqual(p.state,saved);
 }
 const q=battle();action(q,'attack',aim(q));q.step(2);const flying=structuredClone(q.state);assert.deepEqual(harness(flying).state,flying);
 for(const edit of [v=>v.speed=16,v=>v.space='unknown',v=>v.coreLength=2]){const forged=structuredClone(flying);edit(forged.combat.projectiles[0]);assert.throws(()=>SIM.validateSave(forged),/飞行记录/);}
});

test('shared body sampler and swept capsule agree on native opaque and transparent pixels, including mirrors',()=>{
 const actor={x:12,y:20,visualIdentity:'shanxiao',personId:'person:valley-shanxiao',facing:{x:-1,y:0},motion:{action:'idle',phase:'idle',startedTick:0,phaseStartedTick:0,phaseDurationTicks:1,phaseProgressTicks:0}};
 for(const facing of [-1,1]){
  actor.facing={x:facing,y:0};const frame=sampleSwordStudyBody(actor,100);assert(frame.rows.length>0);
  const row=frame.rows[Math.floor(frame.rows.length/2)],nativeX=(row[1]+row[2])/2,nativeY=row[0]+.5;
  const target={x:actor.x+(nativeX-frame.root[0])*frame.scale*(frame.mirror?-1:1),y:actor.y+(nativeY-frame.root[1])*frame.scale/.5857646528643004};
  const origin={x:target.x-3,y:target.y},dir=studyAimDirection(origin,target),end=advanceStudyShot(origin,dir,6);
  const hit=sweepStudyBody(origin,end,dir,actor,frame);assert(hit);assert.equal(hit.frameKey,frame.key);
  const above={x:actor.x-3,y:actor.y-(frame.height+50)*frame.scale/.5857646528643004};
  assert.equal(sweepStudyBody(above,{x:above.x+6,y:above.y},{x:1,y:0},actor,frame),null);
 }
});

test('beast collision and final scene projection select the same authoritative frame despite private presentation clocks',()=>{
 const p=battle(),tick=p.state.worldTick,actor=enemy(p);actor.movedTick=tick;
 const canonical=sampleSwordStudyBody({...actor,motion:projectCombatActorMotion(p.state,actor)},tick);
 const projected=getCampaignScene(p.state).enemies[0];
 assert.equal(projected.motion.phase,'move');
 for(const animationElapsedTicks of [0,.7,1234])assert.equal(sampleSwordStudyBody({...projected,animationElapsedTicks},tick).key,canonical.key);
});

test('configured upper-edge head shot kills through actual contact and its visible-space down event survives validation',()=>{
 const p=battle(),c=p.state.combat;
 // Declared component setup: live people and their combat feet move together;
 // the opponent begins badly wounded, with the actual projectile earning death.
 for(const [actor,x] of [[c.player,15],[c.enemies[0],21]]){
  actor.x=x;actor.y=.6;p.state.personsById[actor.personId].location={kind:'local',sceneId:c.sceneFrame.sceneId,x:c.sceneFrame.origin.x+x,y:c.sceneFrame.origin.y+.6};
 }
 p.state.world.exploration.position={x:15,y:.6};setCombatActorHp(p.state,c.enemies[0],1);SIM.validateSave(structuredClone(p.state));
 const foe=getCampaignScene(p.state).enemies[0],frame=sampleSwordStudyBody(foe,p.state.worldTick),row=frame.rows[0];
 const target={x:foe.x+((row[1]+row[2])/2-frame.root[0])*frame.scale*(frame.mirror?-1:1),y:foe.y+(row[0]+.5-frame.root[1])*frame.scale/.5857646528643004};
 action(p,'attack',target);p.until(s=>s.combat.status==='won','real head-shot victory',20);
 const down=p.state.combat.effects.find(e=>e.kind==='down');assert(down);assert(down.contact.y<0);assert.equal(down.space,'visible-body-v1');assert.equal(down.contactHeight,0);
 assert.equal(p.state.personsById[foe.personId].lifeStatus,'dead');assert.deepEqual(harness(p.state).state,p.state);
});

test('ordinary attacks win once, clear live effects, acknowledge and take the actual path home',()=>{
 const p=battle();p.send('setSRAutoAttack',true);p.until(s=>s.combat.status==='won','actual victory',250);
 assert.equal(p.state.combat.projectiles.length,0);assert.equal(p.state.srCombat.pending,null);assert.equal(p.state.master.activityId,null);
 const fact=p.state.combat.result.factId;p.step(5);assert.equal(p.state.combat.result.factId,fact);
 p.send('acknowledgeCombat');assert.equal(p.state.combat,null);
 p.send('srWorldCommand',{action:'exit',exitId:'exit:valley-yunxiu'});p.until(s=>!s.srWorld.interaction,'walk to return exit');
 p.send('srWorldCommand',{action:'exit',exitId:'exit:valley-yunxiu'});p.until(s=>!s.srWorld.activeTravelId,'return to courtyard');
 assert.equal(p.state.master.personId,'person:master');assert.equal(p.state.master.location.sceneId,'scene:yunxiu-courtyard');
});

test('natural defeat ends the existing body session, rejects later combat and returns the injured same master home',()=>{
 const p=battle();p.until(s=>s.combat.status==='lost','natural defeat',700);
 assert.equal(p.state.master.wound,100);assert.equal(p.state.master.lifeStatus,'alive');assert.equal(p.state.master.activityId,null);
 assert.equal(p.state.combat.groundStrikes?.length||0,0);assert.equal(p.state.combat.projectiles?.length||0,0);
 const result=structuredClone(p.state.combat.result);assert.throws(()=>action(p,'attack',aim(p)),/当前无战斗/);p.step(5);assert.deepEqual(p.state.combat.result,result);
 p.send('acknowledgeCombat');p.send('srWorldCommand',{action:'exit',exitId:'exit:valley-yunxiu'});p.until(s=>!s.srWorld.interaction,'injured walk to exit');
 p.send('srWorldCommand',{action:'exit',exitId:'exit:valley-yunxiu'});p.until(s=>!s.srWorld.activeTravelId,'injured return');
 assert.equal(p.state.master.location.sceneId,'scene:yunxiu-courtyard');assert.equal(p.state.master.wound,100);
});
