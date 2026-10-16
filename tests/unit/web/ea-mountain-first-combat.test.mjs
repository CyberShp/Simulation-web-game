import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../../../src/simulation/ea-opening-sim.mjs';
import {openingCombatProfile} from '../../../src/simulation/ea-opening-inheritance.mjs';

const FOE='person:valley-shanxiao', OBJECT='object:valley:shanxiao';
function player(saved){
 let state=saved?S.validateSave(JSON.parse(saved)):S.initial({sr:true,mountainOpening:true,seed:271828});
 return {get state(){return state;},send(name,...args){const reply=S.dispatchCommand(state,{name,args});state=reply.state;return reply.result;},world(payload){return this.send('srWorldCommand',payload);},step(n=1){for(let i=0;i<n;i++)S.tick(state,.1);},until(predicate,label){for(let i=0;i<3000&&!predicate(state);i++)this.step();assert.ok(predicate(state),label);},restore(){const raw=JSON.stringify(state);state=S.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(state),raw);},request(request){const reply=S.dispatchCommand(state,request);state=reply.state;return reply;}};
}
function approach(p,id){p.world({action:'exit',exitId:id});p.until(s=>!s.srWorld.interaction&&!s.master.scenic.path.length,'walk to exit');}
function valley(kit='qinglan'){
 const p=player();p.send('masterAction','heal');p.send('chooseOpeningInheritance',kit);p.until(s=>s.master.wound===0,'opening recovery');
 approach(p,'exit:yunxiu-valley');p.world({action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}});p.until(s=>!s.srWorld.activeTravelId,'arrive in valley');return p;
}
function walk(p,x,y){p.world({action:'move',x,y});p.until(s=>!s.srWorld.interaction,'valley movement');}
function battle(kit='qinglan',x=24.5){const p=valley(kit);walk(p,x,36);p.world({action:'engage',objectId:OBJECT});return p;}
function assertFeet(s){
 const c=s.combat;
 for(const actor of [c.player,...c.enemies])assert.deepEqual(s.personsById[actor.personId].location,{kind:'local',sceneId:'scene:valley',x:c.sceneFrame.origin.x+actor.x,y:c.sceneFrame.origin.y+actor.y});
 assert.equal(c.player.personId,'person:master');assert.equal(c.enemies[0].personId,FOE);
}

test('the visible valley opponent requires a nearby deliberate engagement with persistent bodies',()=>{
 const p=valley(),object=S.viewSRWorld(p.state).scene.objects.find(o=>o.id===OBJECT);
 assert.equal(object.personId,FOE);assert.equal(object.available,true);assert.equal(p.state.combat,null);
 const old=JSON.parse(JSON.stringify(p.state));delete old.personsById[FOE];
 const existing=structuredClone(old.personsById),migrated=S.validateSave(old);
 for(const [id,person]of Object.entries(existing))assert.deepEqual(JSON.parse(JSON.stringify(migrated.personsById[id])),person);
 assert.equal(S.validateSave(JSON.parse(JSON.stringify(migrated))).personsById[FOE].id,migrated.personsById[FOE].id);
 const before=JSON.stringify(p.state);assert.throws(()=>p.world({action:'engage',objectId:OBJECT}),/走近/);assert.equal(JSON.stringify(p.state),before);
 walk(p,11.5,16);p.world({action:'interact',objectId:'object:valley:herbs',choice:'gather'});p.until(s=>!s.srWorld.interaction,'gather without battle');assert.equal(p.state.combat,null);
 walk(p,24.5,36);const feet={...p.state.master.location};p.world({action:'engage',objectId:OBJECT});
 assert.deepEqual(p.state.master.location,feet);assert.equal(p.state.master.realm,6);assertFeet(p.state);p.restore();
 const view=S.getCampaignScene(p.state);assert.equal(view.sessionId,p.state.combat.sessionId);assert.equal(view.sceneFrame.sceneId,'scene:valley');
 const invalid=JSON.parse(JSON.stringify(p.state));invalid.personsById['person:master'].position.x+=1;
 assert.throws(()=>S.validateSave(invalid),/实际脚点/);
 const outside=JSON.parse(JSON.stringify(p.state));outside.combat.player.x=.5;
 outside.personsById['person:master'].position.x=outside.combat.sceneFrame.origin.x+.5;
 outside.stockpilesById['stockpile:sr-party'].position.x=outside.combat.sceneFrame.origin.x+.5;
 assert.throws(()=>S.validateSave(outside),/林间人物越过战场通行边界/);
 assert.throws(()=>p.world({action:'move',x:20,y:30}),/身体活动/);
 const older=valley();assert.throws(()=>S.startSRCombat(older.state,'shao',{sceneId:'scene:quarry'}),/筑基/);
});

test('attack, timed guard and dodge change actual damage, wounds and valley feet',()=>{
 const p=battle();p.until(s=>!!s.combat.enemies[0].telegraph,'visible windup');
 const start=JSON.stringify(p.state),unguarded=player(start),hp=p.state.combat.player.hp;
 p.send('combatAction','guard');p.step(1);p.restore();p.step(19);unguarded.step(20);
 const guardedDamage=hp-p.state.combat.player.hp,plainDamage=hp-unguarded.state.combat.player.hp;
 assert.ok(plainDamage>0);assert.ok(guardedDamage>0&&guardedDamage<plainDamage);assert.ok(p.state.master.wound>0);
 p.until(s=>!!s.combat.enemies[0].telegraph&&!s.srCombat.pending,'next windup');
 const beforeDodge=p.state.combat.player.hp,feet={...p.state.master.location};
 p.send('combatAction','dodge',{x:p.state.combat.player.x,y:6.7});p.step(2);p.restore();p.step(18);
 assert.equal(p.state.combat.player.hp,beforeDodge);assert.notDeepEqual(p.state.master.location,feet);assertFeet(p.state);
 p.until(s=>!s.srCombat.pending&&S.viewSRCombat(s).actions.find(a=>a.id==='attack').disabled===false,'melee range');
 const enemyHp=p.state.combat.enemies[0].hp;p.send('combatAction','attack','enemy-1');p.step(4);
 assert.ok(p.state.combat.enemies[0].hp<enemyHp);assert.ok(p.state.personsById[FOE].wound>0);assertFeet(p.state);p.restore();
});

test('retreat walks to the valley escape point and returns the injured same master for treatment',()=>{
 const p=battle();p.until(s=>s.master.wound>0,'take a real hit');const wound=p.state.master.wound,feet={...p.state.master.location};
 p.send('combatAction','retreat');assert.deepEqual(p.state.master.location,feet);assert.equal(p.state.combat.status,'active');
 p.step(3);p.restore();p.until(s=>s.combat.status==='retreated','walk out of combat');
 assert.ok(p.state.master.wound>=wound);assertFeet(p.state);assert.ok(Math.hypot(p.state.master.location.x-21.7,p.state.master.location.y-36)<.4);
 assert.equal(p.state.master.activityId,null);p.send('acknowledgeCombat');
 approach(p,'exit:valley-yunxiu');p.world({action:'exit',exitId:'exit:valley-yunxiu'});assert.equal(p.state.master.position.kind,'worldTravel');p.restore();
 p.until(s=>!s.srWorld.activeTravelId,'real return');assert.equal(p.state.master.personId,'person:master');assert.equal(p.state.master.position.sceneId,'scene:yunxiu-courtyard');
 const herbs=p.state.resources.herb;p.send('masterAction','heal');assert.equal(p.state.resources.herb,herbs-6);p.until(s=>s.master.wound===0,'home treatment');p.restore();
});

test('a public action victory persists one death and one result through save and acknowledgement retry',()=>{
 const p=battle(),jade=p.state.resources.jade;
 for(let i=0;i<1500&&p.state.combat.status==='active';i++){
  if(!p.state.srCombat.pending){const actions=S.viewSRCombat(p.state).actions;const id=p.state.combat.enemies[0].telegraph&&!actions.find(a=>a.id==='guard').disabled?'guard':['spell','attack'].find(id=>!actions.find(a=>a.id===id).disabled);if(id)p.send('combatAction',id,'enemy-1');}
  p.step();
 }
 assert.equal(p.state.combat.status,'won');assert.equal(p.state.personsById[FOE].lifeStatus,'dead');assert.equal(p.state.resources.jade,jade);
 const factId=p.state.combat.result.factId,death=p.state.deathRecordsByPersonId[FOE].factId;assert.equal(p.state.factsById[factId].result,'won');assertFeet(p.state);p.restore();p.step(10);
 assert.equal(p.state.story.claimed.filter(id=>id==='battle:valley-shanxiao').length,1);assert.equal(p.state.deathRecordsByPersonId[FOE].factId,death);
 const request={name:'acknowledgeCombat',id:`command:${p.state.transactions.nextCommandId}`,expectedRevision:p.state.revision};p.request(request);assert.equal(p.request(request).status,'already-applied');
 assert.equal(S.viewSRWorld(p.state).scene.objects.find(o=>o.id===OBJECT).available,false);p.restore();
 assert.throws(()=>p.world({action:'engage',objectId:OBJECT}),/已身死/);assert.ok(p.state.factsById[factId]);
});

test('defeat retains actual injury, opponent identity and result without advancing the revenge chain',()=>{
 const p=battle(),revenge=JSON.stringify(p.state.story.revenge.settled);p.until(s=>s.combat.status==='lost','natural defeat');
 assert.equal(p.state.master.wound,100);assert.equal(p.state.master.lifeStatus,'alive');assert.equal(p.state.personsById[FOE].lifeStatus,'alive');
 assert.equal(p.state.master.location.sceneId,'scene:valley');assertFeet(p.state);assert.equal(JSON.stringify(p.state.story.revenge.settled),revenge);
 assert.equal(p.state.combatSessionsById[p.state.combat.sessionId].result,'lost');p.restore();p.send('acknowledgeCombat');p.restore();
});

test('each chosen opening attack and guard performs its existing real effect at qi realm',()=>{
 for(const kit of ['qinglan','chiyang','hanquan','houttu','jinfeng']){
  const p=battle(kit,25),profile=openingCombatProfile(p.state),view=S.viewSRCombat(p.state);
  assert.equal(view.actions.find(a=>a.id==='spell').name,profile.attackName);assert.ok(p.state.master.knowledge[profile.attackArtId]>0);
  const hp=p.state.combat.enemies[0].hp;p.send('combatAction','spell','enemy-1');p.step(6);assert.ok(p.state.combat.enemies[0].hp<hp,kit);
  p.until(s=>!s.srCombat.pending,'attack recovery');p.send('combatAction','guard');p.step(3);assert.ok(p.state.combat.player.guard>0,kit);
  assert.equal(S.viewSRCombat(p.state).actions.find(a=>a.id==='guard').name,profile.guardName);p.restore();
 }
});
