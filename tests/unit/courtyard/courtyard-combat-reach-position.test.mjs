import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createSectSession} from '../../../apps/courtyard/sect-sim.mjs';
import {startSRCombat,combatOptions,getCampaignScene} from '../../../src/simulation/ea-campaign.mjs';
import {COMBAT_ACTIONS,setCombatActorHp} from '../../../src/simulation/ea-sr-combat.mjs';
import {combatCanStand,combatClearLine,combatInRange,moveCombatActor} from '../../../src/simulation/ea-combat-geometry.mjs';
import {companionPositionPlans,companionRoute,COMPANION_POSITIONING} from '../../../src/simulation/ea-combat-companion-positioning.mjs';
import {encounterCombatantVisualIdentity} from '../../../src/simulation/ea-combat-participants.mjs';
import {buildCombatGroupComponent} from '../../acceptance/build-combat-group-component.mjs';

const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const tick=(s,n=1)=>{for(let i=0;i<n;i++)SIM.tick(s,.1);};
const command=(s,name,...args)=>SIM.dispatchCommand(s,{name,args}).state;
// Isolated fixture feet; tests below use the production commands and clock.
function meleeFixture(distance,{ally=false}={}){
 const s=createSectSession().state,p=s.personsById[s.homeMemberIds[0]];
 s.master.realm=10;s.master.location={kind:'local',sceneId:'scene:prison',x:23.5,y:23};
 p.location={kind:'local',sceneId:'scene:prison',x:22.4,y:23.8};if(ally)p.mind.away={kind:'sr',id:'fixture:reach'};
 startSRCombat(s,'rescue',{sceneId:'scene:prison',companions:ally?[p.personId]:[]});
 const c=s.combat;c.enemies[0].x=c.player.x+distance;c.enemies[0].y=c.player.y;
 c.enemies[1].x=10;c.enemies[1].y=7;
 for(const a of c.enemies)s.world.encounterCombatantsById[a.combatantId].location={kind:'local',sceneId:'scene:prison',x:20+a.x,y:19+a.y};
 return s;
}

test('basic sword has one 1.2m range in targeted, mouse, automatic and read projections',()=>{
 assert.equal(COMBAT_ACTIONS.attack.range,1.2);
 for(const mode of ['targeted','mouse','auto'])for(const distance of [1.2,1.2001]){
  let s=meleeFixture(distance);const c=s.combat,e=c.enemies[0],hp=e.hp,feet={x:c.player.x,y:c.player.y};
  assert.equal(combatOptions(s).find(a=>a.id==='attack').range,1.2);assert.equal(SIM.viewSRCombat(s).actions.find(a=>a.id==='attack').range,1.2);
  if(mode==='targeted'&&distance>1.2){const before=JSON.stringify(s);assert.throws(()=>command(s,'combatAction','attack',e.id),/范围/);assert.equal(JSON.stringify(s),before);continue;}
  if(mode==='auto')s=command(s,'setSRAutoAttack',true);
  else s=command(s,'combatAction','attack',mode==='mouse'?{x:e.x,y:e.y}:e.id);
  // These existing guards remain still for the two-tick sword windup, avoiding
  // a test-only speed or hit rule. The sword releases before their next step.
  tick(s,mode==='auto'?3:2);
  assert.equal(s.combat.enemies[0].hp<hp,distance===1.2,`${mode}: ${distance}`);
  assert.deepEqual({x:s.combat.player.x,y:s.combat.player.y},feet,'automatic swords never supply pursuit');
 }
 assert(combatInRange({x:1,y:1},{x:2.2,y:1},COMBAT_ACTIONS.attack.range),'binary floating point must not reject the exact boundary');
});

test('two stable person identities choose opposite reachable sides regardless of party array order',()=>{
 const c={player:{id:'master',hp:100,x:3.5,y:4},allies:[{id:1,personId:'person:lu-zhiwei',hp:50,x:2.4,y:4.8},{id:2,personId:'person:lin-changfeng',hp:50,x:2.4,y:3.2}],enemies:[{id:'enemy-1',hp:80,x:5.22,y:4}],selectedTargetId:'enemy-1'};
 const plans=companionPositionPlans(c,{range:COMBAT_ACTIONS.attack.range,geometry:'legacy'}),goals=Object.fromEntries([...plans].map(([a,p])=>[a.personId,p.goal]));
 assert(goals['person:lu-zhiwei'].y>4);assert(goals['person:lin-changfeng'].y<4);assert(gap(...Object.values(goals))>=COMPANION_POSITIONING.peerClearance);
 for(const plan of plans.values()){assert(combatCanStand(plan.goal,'legacy'));assert(combatInRange(plan.goal,plan.target,1.2));assert(combatClearLine(plan.goal,plan.target,'legacy'));assert(gap(plan.goal,c.player)>=.9);}
 c.allies.reverse();assert.deepEqual(Object.fromEntries([...companionPositionPlans(c,{range:1.2,geometry:'legacy'})].map(([a,p])=>[a.personId,p.goal])),goals);
 for(let tick=0;tick<40;tick++){
  const current=companionPositionPlans(c,{range:1.2,geometry:'legacy'});if([...current.values()].every(p=>p.canAttack))break;
  for(const a of c.allies){const plan=current.get(a),before={x:a.x,y:a.y};if(!plan.canAttack)moveCombatActor(a,plan.route[0],2,.1,'legacy');assert(gap(a,before)<=.200000001);assert(gap(a,c.player)>=.9-1e-8);}
 }
 assert([...companionPositionPlans(c,{range:1.2,geometry:'legacy'}).values()].every(p=>p.canAttack));
 assert(c.allies.find(a=>a.personId==='person:lu-zhiwei').y>4);assert(c.allies.find(a=>a.personId==='person:lin-changfeng').y<4);
});

test('the party05 overlap walks outward at the normal speed and routes around the master neighborhood',()=>{
 const c={player:{id:'master',hp:100,x:3.5,y:4},allies:[{id:1,personId:'person:lu-zhiwei',hp:50,x:3.369293992773896,y:4.554644156175694}],enemies:[{id:'enemy-1',hp:80,x:5.22,y:4}]};
 let previous=gap(c.allies[0],c.player);assert(previous<.6);
 for(let n=0;n<30;n++){
  const a=c.allies[0],plan=companionPositionPlans(c,{range:1.2,geometry:'legacy'}).get(a),before={x:a.x,y:a.y};assert(plan.goal);assert(!plan.canAttack||gap(a,c.player)>=.9);
  if(plan.canAttack)break;moveCombatActor(a,plan.route[0],2,.1,'legacy');assert(gap(before,a)<=.200000001);assert(combatCanStand(a,'legacy'));
  if(previous<.9)assert(gap(a,c.player)>=previous-1e-8);previous=gap(a,c.player);
 }
 assert(gap(c.allies[0],c.player)>=.9);assert(companionPositionPlans(c,{range:1.2,geometry:'legacy'}).get(c.allies[0]).canAttack);
 const a={x:2,y:4},master={x:3.5,y:4},route=companionRoute(a,{x:5,y:4},master,'legacy');assert(route.length>1);
 for(let n=0;route.length&&n<60;n++){const done=moveCombatActor(a,route[0],2,.1,'legacy');assert(gap(a,master)>=.9-1e-8);if(done)route.shift();}assert.equal(route.length,0);
});

test('formation routing keeps formal obstacle and bounds rules; unavailable routes are rejected',()=>{
 const master={x:2,y:4},actor={x:3,y:1.7},goal={x:6.3,y:1.7},route=companionRoute(actor,goal,master,'quarry');assert(route?.length>1,'the bridge crate still requires a detour');
 for(let n=0;route.length&&n<100;n++){const before={...actor},done=moveCombatActor(actor,route[0],2,.1,'quarry');assert(combatCanStand(actor,'quarry'));assert(combatClearLine(before,actor,'quarry',{movement:true}));assert(gap(before,actor)<=.200000001);if(done)route.shift();}assert.equal(route.length,0);
 assert.equal(companionRoute({x:3,y:1},{x:4.5,y:1.5},master,'quarry'),null);assert.equal(companionRoute({x:3,y:1},{x:12,y:4},master,'quarry'),null);
});

test('real party approach preserves feet and save; a companion release rechecks the shared reach once',()=>{
 let s=buildCombatGroupComponent().native.state;s=command(s,'setSpeed',1);s=command(s,'setCombatTactic','focus');
 const ids=s.combat.allies.map(a=>a.personId),start=s.combat.allies.map(a=>({x:a.x,y:a.y}));tick(s);
 for(const [i,a]of s.combat.allies.entries()){assert(gap(a,start[i])<=.200000001);assert.deepEqual(s.personsById[a.personId].location,{kind:'local',sceneId:'scene:prison',x:20+a.x,y:19+a.y});}
 s=SIM.validateSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(s.combat.allies.map(a=>a.personId),ids);
 for(let n=0;n<250&&!s.combat.allies.some(a=>a.pendingAttack)&&s.combat.status==='active';n++)tick(s);
 const a=s.combat.allies.find(a=>a.pendingAttack);assert(a,'a real companion reaches a legal side and starts the normal windup');
 const action=structuredClone(a.pendingAttack),e=s.combat.enemies.find(e=>e.id===action.targetId),hp=e.hp;
 // Component displacement models a target leaving the already-started swing.
 e.x=a.x>6?.6:11.4;e.y=7.4;assert(!combatInRange(a,e,COMBAT_ACTIONS.attack.range));tick(s,2);
 assert.equal(e.hp,hp);assert.equal(s.combat.effects.filter(e=>e.kind==='miss'&&e.actionId===action.id).length,1);assert.equal(s.combat.effects.filter(e=>e.kind==='hit'&&e.actionId===action.id).length,0);
});

test('a ready second companion does not start a new swing at an enemy killed earlier in the same world step',()=>{
 let s=buildCombatGroupComponent().native.state;s=command(s,'setSpeed',1);s=command(s,'setCombatTactic','focus');s=command(s,'setSRCombatTarget',s.combat.enemies[0].id);
 const c=s.combat,[first,second]=c.enemies,[a,b]=c.allies,plans=companionPositionPlans(c,{range:COMBAT_ACTIONS.attack.range,geometry:c.geometryId});
 for(const actor of c.allies){Object.assign(actor,plans.get(actor).goal);s.personsById[actor.personId].location={kind:'local',sceneId:'scene:prison',x:20+actor.x,y:19+actor.y};}
 a.cooldown=0;b.cooldown=.3;tick(s);assert(a.pendingAttack);assert.equal(b.pendingAttack,undefined);
 setCombatActorHp(s,first,1);tick(s,2);assert.equal(first.hp,0);assert.equal(b.targetId,second.id);assert.notEqual(b.pendingAttack?.targetId,first.id);
});

test('guard art identities persist exactly by stable combatant identity and old saves derive the same read-only result',()=>{
 let s=meleeFixture(1.2);const expected=['prison-guard-armored','prison-guard-cloth'];
 for(const [i,a]of s.combat.enemies.entries()){assert.equal(a.visualIdentity,expected[i]);assert.equal(s.world.encounterCombatantsById[a.combatantId].visualIdentity,expected[i]);}
 s=SIM.validateSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(getCampaignScene(s).enemies.map(a=>a.visualIdentity),expected);
 for(const a of s.combat.enemies){delete a.visualIdentity;delete s.world.encounterCombatantsById[a.combatantId].visualIdentity;}
 const before=JSON.stringify(s);assert.deepEqual(getCampaignScene(s).enemies.map(a=>a.visualIdentity),expected);assert.equal(JSON.stringify(s),before);
 assert.equal(encounterCombatantVisualIdentity(s,{id:'enemy-1',combatantId:'combatant:other:enemy-1'}),null);
 const loaded=SIM.validateSave(JSON.parse(before));assert.deepEqual(loaded.combat.enemies.map(a=>a.visualIdentity),expected);assert.equal(s.combat.enemies[0].visualIdentity,undefined);
});
