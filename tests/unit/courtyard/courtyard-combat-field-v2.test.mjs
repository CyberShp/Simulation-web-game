import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {startSRCombat,getCampaignScene,valleyEncounterDefinition} from '../../../src/simulation/ea-campaign.mjs';
import {WORLD_SCENES,worldSceneObjectsSR,viewSceneExitsSR,personLocalPathSR} from '../../../src/simulation/ea-sr-world.mjs';
import {setSRCombatInput,srCombatAction} from '../../../src/simulation/ea-sr-combat.mjs';
import {beginOpeningInheritance} from '../../../src/simulation/ea-opening-inheritance.mjs';
import {VALLEY_COMBAT_V2,combatField,combatGeometryId,combatCanStand,combatClamp,combatClearLine,combatPath,dodgeEndpoint,combatExit,combatRetreatReached} from '../../../src/simulation/ea-combat-geometry.mjs';

const FIELD=VALLEY_COMBAT_V2.id,FOE='person:valley-shanxiao';
const worldPoint=p=>({x:p.x+VALLEY_COMBAT_V2.worldOrigin.x,y:p.y+VALLEY_COMBAT_V2.worldOrigin.y});
const near=(a,b,epsilon=1e-7)=>assert(Math.hypot(a.x-b.x,a.y-b.y)<epsilon,JSON.stringify([a,b]));
const blocked=p=>p.x<2||p.x>62||p.y<2||p.y>46||WORLD_SCENES['scene:valley'].objects.some(o=>o.kind!=='person'&&Math.abs(p.x-o.x)<o.width/2+.45&&Math.abs(p.y-o.y)<o.height/2+.45);

// These are isolated component worlds, not normal-growth or desktop acceptance.
let componentBase;
function componentWorld(position={x:18,y:36}){
 if(!componentBase){
  let s=SIM.initial({sr:true,mountainOpening:true,seed:424242});
  s.master.wound=0;
  beginOpeningInheritance(s);
  s=SIM.dispatchCommand(s,{name:'chooseOpeningInheritance',args:['qinglan']}).state;
  componentBase=structuredClone(s);
 }
 const s=SIM.validateSave(componentBase);
 s.master.location={kind:'local',sceneId:'scene:valley',...position};
 return s;
}
function start(position){const s=componentWorld(position);startSRCombat(s,'valley-shanxiao',{sceneId:'scene:valley'});return s;}

test('the 48 by 32 field fits existing valley metre bounds and matches all three real world blockers',()=>{
 const f=combatField(FIELD);
 assert.equal(f.width,48);assert.equal(f.height,32);assert.equal(f.version,2);
 assert.deepEqual(f.bounds,{left:.6,right:47.4,top:.6,bottom:31.4});
 assert.equal(f.movementMargin,.45);
 const actual=WORLD_SCENES['scene:valley'].objects.filter(o=>o.kind!=='person');
 assert.equal(actual.length,f.obstacles.length);
 for(const o of f.obstacles){
  const original=actual.find(v=>v.id===o.id);assert(original);
  assert.deepEqual([o.x+6,o.y+12,o.w,o.h],[original.x-original.width/2,original.y-original.height/2,original.width,original.height]);
  assert.equal(combatCanStand({x:o.x+o.w/2,y:o.y+o.h/2},FIELD),false);
 }
 for(let x=.6;x<=47.4;x+=.8)for(let y=.6;y<=31.4;y+=.8){
  const p={x,y},world=worldPoint(p);
  assert(world.x>=2&&world.x<=62&&world.y>=2&&world.y<=46);
  assert.equal(combatCanStand(p,FIELD),!blocked(world));
 }
 assert(combatCanStand({x:30,y:26},FIELD));assert(!combatCanStand({x:30,y:26},'legacy'));
 assert.deepEqual(combatClamp({x:100,y:-5},FIELD),{x:47.4,y:.6});
 assert.deepEqual(combatClamp({x:100,y:-5},'legacy'),{x:11.4,y:.6});
});

test('new world objects block rays and swept dodges while real paths go around them',()=>{
 for(const o of combatField(FIELD).obstacles){
  const start={x:o.x-1,y:o.y+o.h/2},end={x:o.x+o.w+1,y:start.y};
  assert(!combatClearLine(start,end,FIELD));
  const path=combatPath(start,end,FIELD);assert(path?.length>=3);
  let previous=start;
  for(const p of path){assert(combatCanStand(p,FIELD));assert(combatClearLine(previous,p,FIELD,{movement:true}));previous=p;}
  const stopped=dodgeEndpoint(start,end,FIELD);assert(stopped.x<o.x);assert(combatCanStand(stopped,FIELD));
 }
});

test('public valley approach is nine metres from the retained NPC and new combat only converts the frame',()=>{
 const s=componentWorld(),originalMaster=structuredClone(s.master.location),originalFoe=structuredClone(s.personsById[FOE].location);
 const definition=valleyEncounterDefinition(),object=worldSceneObjectsSR(s,'scene:valley').find(o=>o.id===definition.objectId);
 assert.deepEqual(object.approach,{x:18,y:36});assert.equal(object.interactionRadius,9);assert(object.near);
 assert(personLocalPathSR(s,'person:master',object.approach));
 startSRCombat(s,definition.id,{sceneId:'scene:valley'});
 assert.deepEqual(s.master.location,originalMaster);assert.deepEqual(s.personsById[FOE].location,originalFoe);
 assert.equal(combatGeometryId(s.combat),FIELD);assert.equal(s.combat.geometryVersion,2);
 assert.deepEqual(s.combat.arena,{width:48,height:32});
 near(s.combat.player,{x:12,y:24});near(s.combat.enemies[0],{x:21,y:24});
 const scene=getCampaignScene(s);assert.equal(scene.width,48);assert.equal(scene.height,32);assert.equal(scene.geometryVersion,2);
 assert.deepEqual(scene.sceneFrame.origin,{x:6,y:12});
 assert.deepEqual(scene.landmarks[0],{id:'exit',name:'归院山道',x:1,y:15,radius:2,worldExitId:'exit:valley-yunxiu'});
 const saved=JSON.parse(JSON.stringify(s));assert.deepEqual(SIM.validateSave(saved),saved);
});

test('out of reach or a changed world blocker rejects before creating a combat or moving a body',()=>{
 for(const changed of ['distance','world-object']){
  const s=componentWorld(changed==='distance'?{x:17.9,y:36}:undefined);
  if(changed==='world-object')s.scenesById['scene:valley'].objects.find(o=>o.id==='object:valley:bridge').x++;
  const before=JSON.stringify(s);
  assert.throws(()=>startSRCombat(s,'valley-shanxiao',{sceneId:'scene:valley'}),changed==='distance'?/走近/:/物件/);
  assert.equal(JSON.stringify(s),before);
 }
});

test('new movement and a launched projectile retain metre speed outside the former 12 by 8 rectangle',()=>{
 let s=start(),before={...s.combat.player};
 setSRCombatInput(s,{x:0,y:1});SIM.tick(s,.1);setSRCombatInput(s,{x:0,y:0});
 near(s.combat.player,{x:before.x,y:before.y+.33});
 near(s.master.location,worldPoint(s.combat.player));
 srCombatAction(s,'spell',{x:s.combat.player.x,y:30});
 for(let n=0;n<6;n++)SIM.tick(s,.1);
 assert.equal(s.combat.projectiles.length,1);
 assert(s.combat.projectiles[0].y>24&&s.combat.projectiles[0].y<31.4);
 assert.equal(s.combat.projectiles[0].speed,8);assert.equal(s.combat.projectiles[0].radius,.45);
 const saved=JSON.parse(JSON.stringify(s));s=SIM.validateSave(saved);assert.deepEqual(s,saved);
 const bad=structuredClone(saved);bad.combat.sceneFrame.origin.x++;const original=JSON.stringify(bad);
 assert.throws(()=>SIM.validateSave(bad),/战场与山谷位置/);assert.equal(JSON.stringify(bad),original);
});

test('a real spell contact outside the old rectangle retains its hit event through save readback',()=>{
 const s=start();
 for(let n=0;n<30&&Math.hypot(s.combat.enemies[0].x-s.combat.player.x,s.combat.enemies[0].y-s.combat.player.y)>5;n++){
  setSRCombatInput(s,{x:1,y:0});SIM.tick(s,.1);
 }
 setSRCombatInput(s,{x:0,y:0});
 const foe=s.combat.enemies[0],before=foe.hp;
 srCombatAction(s,'spell',{x:foe.x,y:foe.y});
 for(let n=0;n<30&&foe.hp===before;n++)SIM.tick(s,.1);
 assert(foe.hp<before);
 const hit=s.combat.effects.find(e=>e.kind==='hit');assert(hit);
 assert(hit.contact.x>12&&hit.contact.y>8);
 const saved=JSON.parse(JSON.stringify(s));assert.deepEqual(SIM.validateSave(saved),saved);
});

test('new retreat walks to the existing public valley exit without teleporting the same master',()=>{
 const s=start(),exit=combatExit(FIELD);assert.deepEqual(worldPoint(exit),{x:7,y:27});
 const before={...s.master.location};srCombatAction(s,'retreat');
 assert.deepEqual(s.master.location,before);
 let steps=0;
 while(s.combat.status==='active'&&steps++<160)SIM.tick(s,.1);
 assert.equal(s.combat.status,'retreated');assert(combatRetreatReached(s.combat.player,FIELD));
 near(s.master.location,worldPoint(s.combat.player));
 assert(viewSceneExitsSR(s).find(e=>e.id==='exit:valley-yunxiu').near);
 assert(s.worldTick>0);assert.equal(s.combat.sceneFrame.origin.x,6);
 SIM.validateSave(s);
});

test('an active legacy local checkpoint retains its old frame, size, bodies and retreat rule through readback',()=>{
 const s=start({x:24.5,y:36}),c=s.combat;
 // Construct the documented old-version component representation from unchanged world locations.
 delete c.rulesProfile;delete c.geometryId;delete c.geometryVersion;c.arena={width:12,height:8};
 c.sceneFrame={sceneId:'scene:valley',origin:{x:21,y:32},safePoint:{x:21.7,y:36}};
 for(const a of [c.player,...c.allies,...c.enemies]){const p=s.personsById[a.personId];a.x=p.location.x-21;a.y=p.location.y-32;}
 s.world.exploration.position={x:c.player.x,y:c.player.y};
 const saved=JSON.parse(JSON.stringify(s)),restored=SIM.validateSave(saved);
 assert.deepEqual(restored,saved);assert.equal(combatGeometryId(restored.combat),'legacy');
 assert.equal(getCampaignScene(restored).width,12);assert.equal(getCampaignScene(restored).height,8);
 assert.deepEqual(getCampaignScene(restored).landmarks,[{id:'exit',name:'撤离出口',x:.7,y:4,radius:.7}]);
 assert(combatRetreatReached({x:.9,y:4},'legacy'));assert(!combatRetreatReached({x:1.2,y:4},'legacy'));
 assert.deepEqual(restored.master.location,s.master.location);assert.deepEqual(restored.personsById[FOE].location,s.personsById[FOE].location);
 const bad=structuredClone(saved);bad.combat.arena.width=48;assert.throws(()=>SIM.validateSave(bad),/战斗结构/);
 const from={...restored.combat.player};setSRCombatInput(restored,{x:1,y:0});SIM.tick(restored,.1);
 near(restored.combat.player,{x:from.x+.33,y:from.y});
 srCombatAction(restored,'retreat');
 for(let n=0;n<80&&restored.combat.status==='active';n++)SIM.tick(restored,.1);
 assert.equal(restored.combat.status,'retreated');assert(restored.combat.player.x<=1);
 near(restored.master.location,{x:21+restored.combat.player.x,y:32+restored.combat.player.y});
 assert.deepEqual(restored.combat.arena,{width:12,height:8});SIM.validateSave(restored);
});
