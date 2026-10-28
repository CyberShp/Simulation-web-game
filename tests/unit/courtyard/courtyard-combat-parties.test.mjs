import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,advanceSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {startSRCombat,getCampaignScene,PRISON_FORECOURT} from '../../../src/simulation/ea-campaign.mjs';
import {setSRCombatTarget,setCombatTactic,setCombatActorHp,projectCombatActorMotion} from '../../../src/simulation/ea-sr-combat.mjs';
import {personLocalPathSR} from '../../../src/simulation/ea-sr-world.mjs';

const step=(s,n=1)=>{for(let i=0;i<n;i++)SIM.tick(s,.1);};
const send=(s,q)=>{const result=commandSect(s,q);assert.equal(result.ok,true,result.error);return result;};
const until=(s,p,label)=>{for(let n=0;n<2500&&!p(s.state);n++)advanceSect(s,.1);assert(p(s.state),label);};
// Independent component composition using the shipped two-enemy encounter and
// an existing canonical disciple. These assignments are not player-path evidence.
function partyFixture(){
 const s=createSectSession().state,p=s.personsById[s.homeMemberIds[0]];
 s.master.realm=10;s.master.wound=0;s.master.location={kind:'local',sceneId:'scene:prison',x:27,y:20.5};
 p.location={kind:'local',sceneId:'scene:prison',x:25.9,y:21.3};p.energy=90;p.wound=0;
 p.mind.away={kind:'sr',id:'fixture:party'};p.mind.revengeAttitude='cautious';
 return {s,p};
}
function partyBattle(){const {s,p}=partyFixture();startSRCombat(s,'rescue',{sceneId:'scene:prison',companions:[p.personId]});return {s,p};}
function assertWorldFeet(s){
 const c=s.combat,{origin,sceneId}=c.sceneFrame;
 for(const actor of [c.player,...c.allies,...c.enemies]){
  const record=actor.personId?s.personsById[actor.personId]:s.world.encounterCombatantsById[actor.combatantId];
  assert.deepEqual(record.location,{kind:'local',sceneId,x:origin.x+actor.x,y:origin.y+actor.y});
 }
}

test('invalid, duplicate, absent, occupied and unwilling companions fail before creating a battle',()=>{
 for(const boundary of ['missing','duplicate','absent','occupied','unwilling']){
  const {s,p}=partyFixture();let ids=[p.personId];
  if(boundary==='missing')ids=['person:missing'];
  if(boundary==='duplicate')ids.push(p.personId);
  if(boundary==='absent')p.location={kind:'local',sceneId:'scene:valley',x:7,y:27};
  if(boundary==='occupied')p.activityId='activity:fixture:occupied';
  if(boundary==='unwilling')p.mind.revengeAttitude='oppose';
  const before=JSON.stringify(s);assert.throws(()=>startSRCombat(s,'rescue',{sceneId:'scene:prison',companions:ids}));assert.equal(JSON.stringify(s),before,boundary);
 }
});

test('selected enemy and explicit mouse aim stay distinct; factions and identities are stable read projections',()=>{
 const {s}=partyBattle(),[first,second]=s.combat.enemies;
 setSRCombatTarget(s,second.id);const scene=getCampaignScene(s),before=JSON.stringify(s);
 assert.equal(scene.selectedTargetId,second.id);assert.equal(scene.player.faction,'sect');assert.equal(scene.allies[0].faction,'sect');assert.equal(scene.enemies[0].faction,'hostile');assert.notEqual(scene.player.visualIdentity,scene.allies[0].visualIdentity);
 getCampaignScene(s);assert.equal(JSON.stringify(s),before);
 assert.throws(()=>setSRCombatTarget(s,s.combat.allies[0].personId),/敌方/);assert.equal(s.combat.selectedTargetId,second.id);
 const aim={x:.6,y:.6},result=SIM.dispatchCommand(s,{name:'combatAction',args:['spell',aim]}).state;
 assert.deepEqual(result.srCombat.pending.target,aim);assert.equal(result.srCombat.pending.targetMode,'direction');
 setCombatActorHp(s,second,0);step(s);assert.equal(s.combat.selectedTargetId,null);setSRCombatTarget(s,first.id);
});

test('enemy chooses the nearby companion and telegraphs at that real body',()=>{
 const {s}=partyBattle(),c=s.combat,ally=c.allies[0],enemy=c.enemies[0];
 c.player.x=.7;c.player.y=4;ally.x=7.7;ally.y=3;enemy.x=8.5;enemy.y=3;enemy.cooldown=0;
 const aimedAt={x:ally.x,y:ally.y};step(s);assert.equal(enemy.targetId,ally.id);assert(enemy.telegraph);assert.equal(enemy.telegraph.targetId,ally.id);assert.equal(enemy.telegraph.x,aimedAt.x);assert.equal(enemy.telegraph.y,aimedAt.y);assert.notEqual(ally.x,aimedAt.x,'the companion responds to the frozen warning by moving');
});

test('companion windup persists across save, releases once and switches after target death',()=>{
 let {s}=partyBattle();setCombatTactic(s,'focus');const c=s.combat,ally=c.allies[0],[first,second]=c.enemies;
 ally.x=8.5;ally.y=2;ally.cooldown=0;first.x=8.5;first.y=3;second.x=9.5;second.y=5;
 setSRCombatTarget(s,first.id);for(let n=0;n<12&&!ally.pendingAttack;n++)step(s);assert(ally.pendingAttack);assert.equal(projectCombatActorMotion(s,ally).phase,'windup');assert.equal(first.hp,first.maxHp);
 const actionId=ally.pendingAttack.id;s=SIM.validateSave(JSON.parse(JSON.stringify(s)));step(s,2);
 assert(s.combat.enemies[0].hp<first.maxHp);assert.equal(s.combat.effects.filter(e=>e.kind==='hit'&&e.actionId===actionId).length,1);const hp=s.combat.enemies[0].hp;step(s,4);assert.equal(s.combat.enemies[0].hp,hp);
 setCombatActorHp(s,s.combat.enemies[0],0);step(s);assert.equal(s.combat.allies[0].targetId,second.id);
});

test('victory, retreat and defeat release every original participant exactly once',()=>{
 for(const status of ['won','lost','retreated']){
  const {s,p}=partyBattle(),c=s.combat,session=c.sessionId;
  if(status==='won')for(const enemy of c.enemies)setCombatActorHp(s,enemy,0);
  if(status==='lost')setCombatActorHp(s,c.player,0);
  if(status==='retreated'){c.retreatRequested=true;c.player.x=.7;c.player.y=4;}
  step(s);assert.equal(c.status,status);assert.equal(s.master.activityId,null);assert.equal(p.activityId,null);assert.equal(p.combatSessionId,null);assert.equal(s.combatSessionsById[session].phase,'ended');
  const result=structuredClone(c.result),wound=p.wound;step(s,3);assert.deepEqual(c.result,result);assert.equal(p.wound,wound);SIM.validateSave(s);
 }
});

test('ordinary guards keep their original wounds and unique deaths through retreat and another encounter',()=>{
 let {s,p}=partyBattle();const first=s.combat.enemies[0],second=s.combat.enemies[1],firstId=first.combatantId,secondId=second.combatantId;
 assert.equal(firstId,'combatant:rescue:enemy-1');assert(s.combatSessionsById[s.combat.sessionId].combatantIds.includes(firstId));
 setCombatActorHp(s,first,0);setCombatActorHp(s,second,20);step(s);const factId=s.world.encounterCombatantsById[firstId].deathFactId;
 assert.equal(s.factsById[factId].combatantId,firstId);s.combat.retreatRequested=true;s.combat.player.x=.7;s.combat.player.y=4;step(s);
 s=SIM.dispatchCommand(s,{name:'acknowledgeCombat'}).state;s=SIM.validateSave(JSON.parse(JSON.stringify(s)));p=s.personsById[p.personId];
 startSRCombat(s,'rescue',{sceneId:'scene:prison',companions:[p.personId]});assert.equal(s.combat.enemies[0].hp,0);assert.equal(s.combat.enemies[1].hp,20);assert.equal(s.combat.enemies[1].combatantId,secondId);
 setCombatActorHp(s,s.combat.enemies[1],0);step(s);assert.equal(s.combat.status,'won');assert.equal(Object.values(s.factsById).filter(f=>f.kind==='encounter-combatant-death').length,2);
 assert.equal(s.world.encounterCombatantsById[firstId].deathFactId,factId);assert.equal(s.story.claimed.filter(id=>id==='battle:rescue').length,1);
 s=SIM.dispatchCommand(s,{name:'acknowledgeCombat'}).state;const before=JSON.stringify(s);assert.throws(()=>startSRCombat(s,'rescue',{sceneId:'scene:prison',companions:[p.personId]}),/均已身死/);assert.equal(JSON.stringify(s),before);SIM.validateSave(s);
});

test('an older SR guard battle upgrades its existing hit points without changing the retained source',()=>{
 const {s}=partyBattle();setCombatActorHp(s,s.combat.enemies[0],50);
 const old=JSON.parse(JSON.stringify(s));delete old.world.encounterCombatantsById;delete old.combat.geometryId;delete old.combat.sceneFrame;delete old.combatSessionsById[old.combat.sessionId].combatantIds;
 for(const enemy of old.combat.enemies){delete enemy.combatantId;delete enemy.configId;}
 const source=JSON.stringify(old),loaded=SIM.validateSave(old);assert.equal(JSON.stringify(old),source);assert.equal(loaded.combat.enemies[0].hp,50);
 const record=loaded.world.encounterCombatantsById[loaded.combat.enemies[0].combatantId];assert(Math.abs(record.wound-100*(1-50/record.maxHp))<1e-9);assert.equal(record.lifeStatus,'alive');step(loaded);assert.equal(loaded.combat.enemies[0].hp,50);SIM.validateSave(loaded);
});

test('the prison forecourt maps to genuinely passable outdoor world ground and keeps every body through retreat and readback',()=>{
 let {s}=partyBattle();assert.equal(s.combat.geometryId,'prison-forecourt');assert.deepEqual(s.combat.sceneFrame.origin,{x:20,y:19});assertWorldFeet(s);
 // Sample the complete registered rectangle, including all four outer corners,
 // through the actual world path authority rather than a second test floor.
 for(const x of [.6,2,4,6,8,10,11.4])for(const y of [.6,2,4,6,7.4])assert(personLocalPathSR(s,'person:master',{x:PRISON_FORECOURT.origin.x+x,y:PRISON_FORECOURT.origin.y+y}));
 const startY=s.master.location.y;s=SIM.dispatchCommand(s,{name:'setSRCombatInput',args:[{x:0,y:1}]}).state;step(s,6);assert(s.master.location.y>startY);assertWorldFeet(s);
 s=SIM.validateSave(JSON.parse(JSON.stringify(s)));assertWorldFeet(s);
 for(let n=0;n<40&&!(s.master.wound>0);n++)step(s);assert(s.master.wound>0,'the same outdoor body actually receives damage');
 while(s.combat.player.staggerUntilTick>s.worldTick)step(s);
 s=SIM.dispatchCommand(s,{name:'combatAction',args:['retreat']}).state;for(let n=0;n<300&&s.combat.status==='active';n++)step(s);assert.equal(s.combat.status,'retreated');assertWorldFeet(s);
 assert(Math.hypot(s.master.location.x-PRISON_FORECOURT.safePoint.x,s.master.location.y-PRISON_FORECOURT.safePoint.y)<.4);assert(s.master.wound>0);assert.equal(s.master.activityId,null);
 const saved=JSON.stringify(s),restored=SIM.validateSave(JSON.parse(saved));assert.equal(JSON.stringify(restored),saved);assertWorldFeet(restored);
 const bad=JSON.parse(saved);bad.combat.sceneFrame.origin.x++;const original=JSON.stringify(bad);assert.throws(()=>SIM.validateSave(bad),/战场与真实空间映射/);assert.equal(JSON.stringify(bad),original);
});

test('the public original travel party walks into combat, restores and retreats on the same world',()=>{
 let s=createSectSession();const personId=s.state.homeMemberIds[0];
 send(s,{type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley'}});until(s,s=>!s.master.scenic.path.length&&!s.srWorld.interaction,'walk to original gate');
 send(s,{type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley',companions:[personId],cargo:{food:4}}});const travelId=s.state.srWorld.activeTravelId;
 until(s,s=>!s.srWorld.activeTravelId,'original party arrives');assert(s.state.travelsById[travelId].participantIds.includes(personId));
 const origin={...s.state.personsById[personId].location};send(s,{type:'world',action:{action:'move',x:24.5,y:36}});advanceSect(s,.1);
 const moved=s.state.personsById[personId].location;assert(Math.hypot(moved.x-origin.x,moved.y-origin.y)>0);assert(Math.hypot(moved.x-origin.x,moved.y-origin.y)<=.270001);
 until(s,s=>!s.srWorld.interaction,'both actual walks complete');send(s,{type:'world',action:{action:'engage',objectId:'object:valley:shanxiao'}});
 assert.equal(s.state.combat.allies[0].personId,personId);assert.equal(s.state.combat.partyTravelId,travelId);
 send(s,{type:'pause',paused:true});const before=snapshotSect(s);s=restoreSect(before);assert.deepEqual(s,before);send(s,{type:'pause',paused:false});
 send(s,{type:'combat',actionId:'retreat'});until(s,s=>s.combat.status==='retreated','actual party retreat');
 assert.equal(s.state.personsById[personId].activityId,null);assert.equal(s.state.personsById[personId].mind.away.id,travelId);send(s,{type:'combat-acknowledge'});
 const departure=send(s,{type:'world',action:{action:'exit',exitId:'exit:valley-yunxiu'}});
 if(departure.result.phase==='approaching'){until(s,s=>!s.srWorld.interaction,'both walk to return gate');send(s,{type:'world',action:{action:'exit',exitId:'exit:valley-yunxiu'}});}assert(s.state.travelsById[s.state.srWorld.activeTravelId].participantIds.includes(personId));until(s,s=>!s.srWorld.activeTravelId,'original party returns home');
 assert.equal(s.state.personsById[personId].location.sceneId,'scene:yunxiu-courtyard');assert.equal(s.state.personsById[personId].mind.away,null);
});

test('a foundation component world uses the public prison travel, engage and combat commands to free the same witness',()=>{
 // The foundation realm and known destination are fixture inputs; the travel,
 // walking, invitation, fighting and result below all use public commands.
 let s=createSectSession().state;s.master.realm=10;s.srWorld.knownScenes.push('scene:prison');const personId=s.homeMemberIds[0];
 const command=(name,...args)=>{s=SIM.dispatchCommand(s,{name,args}).state;};
 const untilState=(predicate,label)=>{for(let n=0;n<3000&&!predicate();n++)SIM.tick(s,.1);assert(predicate(),label);};
 command('srWorldCommand',{action:'travel',destination:'scene:prison',companions:[personId],cargo:{food:8}});const travelId=s.srWorld.activeTravelId;
 untilState(()=>!s.srWorld.activeTravelId,'actual journey reaches the prison');
 const remote=JSON.stringify(s);assert.throws(()=>command('srWorldCommand',{action:'engage',objectId:'object:prison:gate'}),/走近/);assert.equal(JSON.stringify(s),remote);
 command('srWorldCommand',{action:'move',x:27,y:20.5});untilState(()=>!s.srWorld.interaction,'both original participants reach the prison gate');
 command('srWorldCommand',{action:'engage',objectId:'object:prison:gate'});assert.equal(s.combat.encounterId,'rescue');assert.equal(s.combat.enemies.length,2);assert.equal(s.combat.allies[0].personId,personId);
 command('setCombatTactic','focus');command('setSRAutoAttack',true);
 for(let n=0;n<3000&&s.combat.status==='active';n++){
  const p=s.combat.player,e=s.combat.enemies.filter(e=>e.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0],distance=Math.hypot(e.x-p.x,e.y-p.y),range=SIM.viewSRCombat(s).actions.find(a=>a.id==='attack').range;
  command('setSRCombatInput',distance>range?{x:(e.x-p.x)/distance,y:(e.y-p.y)/distance}:{x:0,y:0});SIM.tick(s,.1);
 }
 assert(s.combat.status!=='active','public movement and ordinary attacks settle the encounter');assert.equal(s.combat.status,'won');
 assert.equal(s.personsById['person:shen-witness'].location.x,30);assert.equal(s.personsById['person:shen-witness'].location.y,27);assert.equal(s.factsById['fact:preparation:witness'].personId,'person:shen-witness');
 assert.equal(s.personsById[personId].mind.away.id,travelId);assert.equal(s.world.exploration,null);assert.equal(s.master.journey.kind,'sr');assert.equal(getCampaignScene(s).status,'won');
 command('acknowledgeCombat');command('srWorldCommand',{action:'move',x:27,y:20.5});untilState(()=>!s.srWorld.interaction,'return to the same gate before checking its resolved encounter');const done=JSON.stringify(s);assert.throws(()=>command('srWorldCommand',{action:'engage',objectId:'object:prison:gate'}),/已获救/);assert.equal(JSON.stringify(s),done);SIM.validateSave(s);
});
