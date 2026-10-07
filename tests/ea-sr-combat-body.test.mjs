import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {projectedCombatHp,setCombatActorHp,executeSpatialCombatAction} from '../dist/ea-sr-combat.mjs';
import {carriedStockpile,grantPills} from '../dist/ea-sr-economy.mjs';
import {COVENANT_TEMPLATES} from '../dist/ea-sr-covenants.mjs';

function battle(){
 const s=S.initial({sr:true,seed:618033});
 s.master.realm=10; // Component fixture: campaign entry is checked by the story command elsewhere.
 S.startSRCombat(s,'shao',{sceneId:'scene:quarry'});
 return s;
}
function step(s,n){for(let i=0;i<n;i++)S.tick(s,.1);}
function assertBody(s){
 const c=s.combat,id=c.sessionId,session=s.combatSessionsById[id];
 assert.equal(c.player.personId,'person:master');
 assert.equal(s.master,s.personsById['person:master']);
 assert.equal(s.master.combatSessionId,id);
 assert.equal(session.phase,'active');
 assert.equal(s.activitiesById[s.master.activityId].orderId,id);
 assert.equal(Object.values(s.activitiesById).filter(a=>a.personId==='person:master').length,1);
 assert.equal(c.player.hp,projectedCombatHp(s.master,c.player.maxHp));
}

test('one person and one body activity persist through a timed combat action and save',()=>{
 let s=battle();assertBody(s);
 const activityId=s.master.activityId,sessionId=s.combat.sessionId;
 s=S.dispatchCommand(s,{name:'srCombatAction',args:['guard']}).state;
 assert.equal(s.activitiesById[activityId].actionId,s.srCombat.pending.id);
 step(s,20);assert.equal(s.srCombat.pending,null);assert.equal(s.master.activityId,activityId);
 assert.equal(s.master.combatSessionId,sessionId);assertBody(s);
 s=S.validateSave(JSON.parse(JSON.stringify(s)));assertBody(s);
});

test('the browser combat command works inside its own battle reservation while other body work stays blocked',()=>{
 let s=battle();const activityId=s.master.activityId,sessionId=s.combat.sessionId;
 s=S.dispatchCommand(s,{name:'combatAction',args:['move',{x:3,y:4}]}).state;
 assert.equal(s.master.activityId,activityId);assert.equal(s.master.combatSessionId,sessionId);
 assert.throws(()=>S.dispatchCommand(s,{name:'masterAction',args:['rest']}),/已有身体活动/);
 const before=JSON.stringify(s);assert.equal(JSON.stringify(S.validateSave(JSON.parse(before))),before);
});

test('acknowledging a same-tick victory records its responsibility before clearing combat',()=>{
 let s=S.initial({sr:true,seed:618033});s.master.realm=10;S.startSRCombat(s,'shao',{sceneId:'scene:supply'});
 for(const enemy of s.combat.enemies)setCombatActorHp(s,enemy,0);step(s,1);assert.equal(s.combat.status,'won');
 s.story.revenge.activeEncounter={personId:'person:shao-heng',encounterId:'shao',startedTick:s.worldTick,sceneId:'scene:supply'};
 const request={name:'acknowledgeCombat',id:`command:${s.transactions.nextCommandId}`,expectedRevision:s.revision};
 const first=S.dispatchCommand(s,request);s=first.state;
 assert.equal(s.combat,null);assert.equal(s.personsById['person:shao-heng'].lifeStatus,'dead');
 assert.equal(s.story.revenge.settled['person:shao-heng'],'fact:death:person:shao-heng');
 const raw=JSON.stringify(s);assert.equal(JSON.stringify(S.validateSave(JSON.parse(raw))),raw);
 assert.equal(S.dispatchCommand(s,request).status,'already-applied');
 assert.equal(Object.keys(s.factsById).filter(id=>id==='fact:death:person:shao-heng').length,1);
});

test('damage and carried treatment update the same wound fact and projected HP',()=>{
 const s=battle(),startWound=s.master.wound;
 step(s,100);assert.equal(s.combat.status,'active');assert(s.master.wound>startWound);assertBody(s);
 s.master.artsById.spring={artId:'spring',understanding:20,mastery:0};
 const carried=carriedStockpile(s);grantPills(s,carried,'heal',1,{factId:'fact:test:combat-treatment'});
 const beforeHp=s.combat.player.hp,beforeWound=s.master.wound;
 const result=executeSpatialCombatAction(s,'pulse-heal',null,()=>{throw Error('unexpected legacy action');});
 assert(result.healed>0);assert.equal(s.combat.player.hp,beforeHp+result.healed);
 assert(s.master.wound<beforeWound);assert.equal(s.combat.player.hp,projectedCombatHp(s.master,s.combat.player.maxHp));
 assert.equal(s.stockpilesById[carried].pills.heal,0);assertBody(S.validateSave(s));
});

test('an external injury remains authoritative across save and the next combat step',()=>{
 const s=battle(),foe=s.combat.enemies[0],person=s.personsById[foe.personId];
 person.wound=25;
 const loaded=S.validateSave(s);
 assert.equal(loaded.combat.enemies[0].hp,projectedCombatHp(loaded.personsById[foe.personId],foe.maxHp));
 assert.equal(s.combat.enemies[0].hp,foe.maxHp);
 step(s,1);
 assert.equal(s.combat.enemies[0].hp,projectedCombatHp(person,foe.maxHp));
 const fatal=battle();fatal.master.wound=100;const unchanged=JSON.stringify(fatal);
 assert.throws(()=>S.validateSave(fatal),/须先推进世界步完成结算/);
 assert.equal(JSON.stringify(fatal),unchanged);
 step(fatal,1);assert.equal(fatal.combat.status,'lost');S.validateSave(fatal);
});

test('a later same-tick body injury settles combat before the state is saved',()=>{
 let s=battle();s=S.dispatchCommand(s,{name:'srCombatAction',args:['guard']}).state;
 const id='covenant:test:combat',terms=COVENANT_TEMPLATES['clause:supply-herbs'];
 s.master.wound=99.9;
 s.srCovenants.records[id]={id,mode:'oath',templateId:'clause:supply-herbs',debtorId:'person:master',creditorId:'person:su-yelan',phase:'breached',informed:true,terms:structuredClone(terms),delivered:0,deadlineTick:0,graceUsed:false,consequence:{cause:'deliberate',createdTick:s.worldTick,remainingTicks:1,appliedWound:0,totalWound:18,relationApplied:true},formedTick:0};
 step(s,1);
 assert.equal(s.combat.status,'lost');assert.equal(s.master.wound,100);
 assert.equal(s.srCombat.pending,null);assert.equal(s.master.activityId,null);
 const loaded=S.validateSave(JSON.parse(JSON.stringify(s)));
 assert.equal(loaded.combat.status,'lost');
});

test('a winning strike and later same-tick fatal injury resolve as loss without reward',()=>{
 let s=battle(),enemy=s.combat.enemies[0];
 enemy.x=s.combat.player.x+1;enemy.y=s.combat.player.y;
 setCombatActorHp(s,enemy,1);
 s=S.dispatchCommand(s,{name:'srCombatAction',args:['attack',enemy.id]}).state;
 step(s,3);
 assert.equal(s.combat.status,'active');
 const id='covenant:test:winning-strike',terms=COVENANT_TEMPLATES['clause:supply-herbs'];
 s.master.wound=99.95;
 s.srCovenants.records[id]={id,mode:'oath',templateId:'clause:supply-herbs',debtorId:'person:master',creditorId:'person:su-yelan',phase:'breached',informed:true,terms:structuredClone(terms),delivered:0,deadlineTick:0,graceUsed:false,consequence:{cause:'deliberate',createdTick:s.worldTick,remainingTicks:1,appliedWound:0,totalWound:18,relationApplied:true},formedTick:0};
 step(s,1);
 assert.equal(s.combat.status,'lost');
 assert.equal(s.master.wound,100);
 assert.equal(s.combat.rewardApplied,false);
 assert.equal(s.combatSessionsById[s.combat.sessionId].result,'lost');
 assert.equal(s.master.activityId,null);
 S.validateSave(JSON.parse(JSON.stringify(s)));
});

test('retreat, defeat and victory release the same body once without injury added at settlement',()=>{
 const retreat=battle(),originalWound=retreat.master.wound;
 let s=S.dispatchCommand(retreat,{name:'srCombatAction',args:['retreat']}).state;
 for(let i=0;i<100&&s.combat.status==='active';i++)S.tick(s,.1);
 assert.equal(s.combat.status,'retreated');assert.equal(s.master.wound,originalWound);
 assert.equal(s.master.activityId,null);assert.equal(s.master.combatSessionId,null);
 assert.equal(s.combatSessionsById[s.combat.sessionId].phase,'ended');S.validateSave(s);

 const lost=battle();setCombatActorHp(lost,lost.combat.player,0);step(lost,1);
 assert.equal(lost.combat.status,'lost');assert.equal(lost.master.wound,100);
 assert.equal(lost.combat.result.injury,70);assert.equal(lost.master.activityId,null);S.validateSave(lost);

 const won=battle(),foe=won.combat.enemies[0];setCombatActorHp(won,foe,0);step(won,1);
 assert.equal(won.combat.status,'won');assert.equal(won.master.wound,30);
 assert.equal(won.master.activityId,null);assert.equal(won.master.combatSessionId,null);assert.equal(won.master.action,'rest');S.validateSave(won);
});

test('old active combat loads atomically; malformed current session is rejected',()=>{
 const current=battle(),legacy=JSON.parse(JSON.stringify(current));
 for(const personId of current.combatSessionsById[current.combat.sessionId].participantIds){
  const person=legacy.personsById[personId];delete legacy.activitiesById[person.activityId];person.activityId=null;delete person.combatSessionId;
 }
 delete legacy.combatSessionsById[legacy.combat.sessionId];delete legacy.combat.sessionId;delete legacy.combat.player.personId;
 legacy.combat.player.hp-=20;
 const original=JSON.stringify(legacy),loaded=S.validateSave(legacy);
 assert.equal(JSON.stringify(legacy),original);assert(loaded.master.wound>legacy.personsById['person:master'].wound);
 assertBody(loaded);assertBody(S.validateSave(JSON.parse(JSON.stringify(loaded))));

 const bad=JSON.parse(JSON.stringify(current));bad.combat.sessionId='combat:campaign:999';
 const before=JSON.stringify(bad);
 assert.throws(()=>S.validateSave(bad),/战斗会话引用异常/);
 assert.equal(JSON.stringify(bad),before);

 const malformed=JSON.parse(JSON.stringify(current));
 malformed.combatSessionsById[malformed.combat.sessionId].participantIds=['person:master','person:missing'];
 const malformedText=JSON.stringify(malformed);
 assert.throws(()=>S.validateSave(malformed),/invalid-reference|战斗会话记录异常/);
 assert.equal(JSON.stringify(malformed),malformedText);

 const wrongLegacy=JSON.parse(JSON.stringify(legacy));wrongLegacy.combat.player.personId='person:missing';
 assert.throws(()=>S.validateSave(wrongLegacy),/战斗掌门人物引用异常/);
});

test('old windup save keeps its pending action on the same upgraded body',()=>{
 let s=battle();s=S.dispatchCommand(s,{name:'srCombatAction',args:['guard']}).state;
 const legacy=JSON.parse(JSON.stringify(s)),sessionId=legacy.combat.sessionId;
 legacy.activitiesById[legacy.personsById['person:master'].activityId].orderId=legacy.srCombat.pending.id;
 delete legacy.activitiesById[legacy.personsById['person:master'].activityId].actionId;
 legacy.srCombat.battleId=`${legacy.combat.journeyId}:${legacy.combat.encounterId}:${legacy.combat.regionId}`;
 for(const personId of legacy.combatSessionsById[sessionId].participantIds)delete legacy.personsById[personId].combatSessionId;
 delete legacy.combatSessionsById[sessionId];delete legacy.combat.sessionId;delete legacy.combat.player.personId;
 const raw=JSON.stringify(legacy),loaded=S.validateSave(legacy);
 assert.equal(JSON.stringify(legacy),raw);assert.equal(loaded.srCombat.pending.action,'guard');
 assert.equal(loaded.activitiesById[loaded.master.activityId].actionId,loaded.srCombat.pending.id);
 assertBody(loaded);step(loaded,20);assert.equal(loaded.srCombat.pending,null);assertBody(S.validateSave(loaded));
});
