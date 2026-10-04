import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-sim.mjs';
import {Player} from '../qa/ea-player.mjs';
import {COMBAT_FIELDS,combatField,battlePoint,battleInverse,combatCanStand,combatPath,combatClearLine,moveCombatActor,dodgeEndpoint,combatOnPaintedGround} from '../dist/ea-combat-geometry.mjs';
import {COMBAT_ART,campaignArt} from '../dist/ea-region-art.mjs';
import {appearance} from '../dist/ea-scenic.mjs';

let earlyCache,bossCache;
function early(){earlyCache??=new Player().chapterOne().state;return new Player(structuredClone(earlyCache));}
function battle(){if(!bossCache){const p=early().foundation().prepareRevenge();p.action('resolveExploration','challenge');bossCache=p.state;}return new Player(structuredClone(bossCache));}

test('four region battles use their own existing art and an exactly invertible physical plane',()=>{
  for(const id of ['quarry','prison','supply','qixia']){
    const arena=combatField(id);assert.ok(COMBAT_ART[id]);assert.equal(campaignArt({type:'combat',background:'region',regionId:id}),COMBAT_ART[id]);
    for(let x=.6;x<=11.4;x+=.27)for(let y=.6;y<=7.4;y+=.23){const p=battlePoint(x,y,id),q=battleInverse(p,id);assert.ok(Number.isFinite(p.x+p.y));assert.ok(p.x>=0&&p.x<=1672&&p.y>=0&&p.y<=941,'paved field lies inside the painting');assert.ok(Math.hypot(q.x-x,q.y-y)<1e-9);}
    assert.ok(arena.obstacles.every(o=>!combatCanStand({x:o.x+o.w*.5,y:o.y+o.h*.5},id)));
  }
});

test('registered actor feet remain on surveyed painted floors instead of bridge masonry, cliffs or water',()=>{
  for(const region of ['quarry','prison','supply','qixia'])for(let x=.6;x<=11.4;x+=.2)for(let y=.6;y<=7.4;y+=.2){assert.equal(combatOnPaintedGround(battlePoint(x,y,region),region),true,`${region} ${x},${y} is outside its visible floor`);}
  assert.equal(combatOnPaintedGround({x:812,y:592},'quarry'),false,'the old quarry player anchor was on the bridge facade');
  assert.equal(combatOnPaintedGround({x:920,y:470},'supply'),false,'the old large supply patch crossed the wagon/water quay');
});

test('an active battle chooses title, art and geometry from its own region even if the world view is stale',()=>{
  const s=battle().state,before=SIM.getCampaignScene(s);s.world.exploration.regionId='quarry';const scene=SIM.getCampaignScene(s);
  assert.equal(scene.regionId,s.combat.regionId);assert.equal(scene.regionId,'qixia');assert.equal(scene.name,before.name);assert.equal(scene.geometryId,'qixia');assert.equal(campaignArt(scene),COMBAT_ART.qixia);assert.deepEqual(scene.arena,before.arena);assert.throws(()=>SIM.validateSave(s),/战斗与探索|掌门行程/,'stale contradictory state cannot be accepted as a real save');
});

test('visible obstacles block movement and attack rays; an actual traversed path walks around them',()=>{
  for(const id of ['quarry','prison','supply','qixia']){
    const o=combatField(id).obstacles[0],start={x:o.x-.5,y:o.y+o.h*.5},goal={x:o.x+o.w+.5,y:start.y};
    assert.equal(combatClearLine(start,goal,id),false);
    const path=combatPath(start,goal,id);assert.ok(path?.length>=3);let previous=start;for(const p of path){assert.equal(combatClearLine(previous,p,id,{movement:true}),true);previous=p;}
    const actor={...start,facing:{x:1,y:0}};let arrived=false;for(let i=0;i<500&&!arrived;i++){arrived=moveCombatActor(actor,goal,3.3,.02,id);assert.equal(combatCanStand(actor,id),true);}assert.equal(arrived,true);assert.ok(Math.hypot(actor.x-goal.x,actor.y-goal.y)<.001);
    const dash=dodgeEndpoint(start,goal,id);assert.ok(dash.x<o.x,'a swept dodge cannot tunnel through the obstacle');assert.equal(combatCanStand(dash,id),true);
    assert.equal(combatPath(start,{x:o.x+o.w*.5,y:o.y+o.h*.5},id),null);
  }
});

test('command rejection cannot spend qi, change hp or create a visual hit; every successful hit is saved once',()=>{
  const p=battle(),s=p.state,c=s.combat,enemy=c.enemies[0],before=enemy.hp;
  p.action('combatAction','spell',enemy.id);
  assert.ok(enemy.hp<before);assert.deepEqual(c.effects.map(e=>e.kind),['spell','hit']);assert.equal(c.effects.find(e=>e.kind==='hit').amount,before-enemy.hp);
  const saved=SIM.validateSave(s),snapshot=structuredClone(s);assert.throws(()=>SIM.combatAction(s,'spell',enemy.id),/调息/);assert.deepEqual(s,snapshot);
  SIM.tick(s,1);SIM.tick(saved,1);assert.deepEqual(s,saved,'loading keeps the remaining effect instead of creating another hit');
  assert.equal(c.effects.length,0,'short hit effects expire without changing the already applied damage');
  const wall=combatField('qixia').obstacles[0],blocked={x:wall.x+wall.w*.5,y:wall.y+wall.h*.5},held=structuredClone(s);assert.throws(()=>SIM.combatAction(s,'move',blocked),/货箱|碎石/);assert.deepEqual(s,held);
});

test('guard and enemy windup resolve actual damage and matching impact/strike events',()=>{
  const p=battle();p.tick(2);const enemy=p.state.combat.enemies.find(e=>e.telegraph);assert.ok(enemy);
  const warning=structuredClone(enemy.telegraph),before=p.state.combat.player.hp;p.action('combatAction','guard');
  p.tick(2);const c=p.state.combat;assert.ok(c.player.hp<before);assert.ok(c.effects.some(e=>e.kind==='impact'));assert.ok(c.effects.some(e=>e.kind==='strike'&&e.targetId==='master'));const hit=c.effects.find(e=>e.kind==='hit'&&e.targetId==='master');assert.equal(hit.amount,Math.round(warning.damage*.3));
  assert.deepEqual(SIM.validateSave(p.state),p.state);
});

test('a non-default companion keeps exactly its identity and art through travel, battle, return and restore',()=>{
  const p=early();p.rest();const options=SIM.companionOptions(p.state,'quarry').filter(d=>d.willing),id=options.at(-1)?.id;assert.ok(id);
  p.action('startExploration','quarry',{companionIds:[id]});p.until(s=>s.world.exploration.status==='exploring',{limit:60,chunk:1,reason:'arrival'});
  const traveling=SIM.getCampaignScene(p.state);assert.deepEqual(traveling.allies.map(a=>a.id),[id]);assert.equal(traveling.allies[0].appearance,appearance(id));
  p.action('moveExploration',8,4);p.tick(3);p.action('resolveExploration','defend');const c=SIM.getCampaignScene(p.state);assert.deepEqual(c.allies.map(a=>a.id),[id]);assert.equal(c.allies[0].appearance,traveling.allies[0].appearance);assert.equal(c.geometryId,'quarry');assert.deepEqual(SIM.getCampaignScene(SIM.validateSave(p.state)),c);
  assert.equal(p.fight(),'won');assert.equal(SIM.getCampaignScene(p.state).status,'won','the winning field retains downed opponents until confirmation');assert.ok(SIM.getCampaignScene(p.state).enemies.every(e=>e.hp===0));p.action('acknowledgeCombat');p.action('leaveRegion');assert.equal(p.state.disciples.find(d=>d.id===id).mind.away,null);p.validate();
});

test('public player actions finish the two-enemy prison battle and the supply battle on their registered floors',()=>{
  const foundation=early().foundation().state;
  for(const [region,action] of [['prison','rescue'],['supply','intercept']]){
    const p=new Player(structuredClone(foundation));p.rest();const ids=SIM.companionOptions(p.state,region).filter(o=>o.willing).slice(-2).map(o=>o.id);
    p.action('startExploration',region,{companionIds:ids});p.until(s=>s.world.exploration.status==='exploring',{limit:60,chunk:1,reason:'arrival'});p.action('moveExploration',8,4);p.tick(3);p.action('resolveExploration',action);
    if(region==='prison')assert.equal(p.state.combat.enemies.length,2);
    assert.equal(p.fight(),'won');assert.equal(p.state.story.preparations[region==='prison'?'witness':'supply'],true);p.action('acknowledgeCombat');p.action('leaveRegion');p.validate();
  }
});

test('legacy active combat stays on its original unblocked plane and is not relocated on restore',()=>{
  const s=battle().state;delete s.combat.geometryVersion;delete s.combat.effects;delete s.combat.nextEffectId;s.combat.player.x=5.5;s.combat.player.y=6.3;
  const before=structuredClone(s),loaded=SIM.validateSave(s);assert.deepEqual(s,before);assert.deepEqual(loaded,before);const scene=SIM.getCampaignScene(loaded);assert.equal(scene.geometryId,'legacy-qixia');assert.deepEqual(scene.obstacles,[]);assert.equal(scene.background,'arena');
  SIM.combatAction(loaded,'move',{x:8,y:4});SIM.tick(loaded,1);assert.ok(loaded.combat.player.x>5.5);assert.deepEqual(loaded.story.claimed,s.story.claimed);
});

test('save validation rejects a different party, actor in a wall, and malformed unbounded visual events',()=>{
  const s=battle().state;for(const corrupt of [v=>{v.combat.geometryVersion=99;},v=>{const o=combatField('qixia').obstacles[0];v.combat.player.x=o.x+.5;v.combat.player.y=o.y+.5;},v=>{v.combat.effects=Array(25).fill({});},v=>{v.combat.regionId='supply';},v=>{v.combat.allies.push({id:1,name:'误入者',x:2,y:2,hp:60,maxHp:60,damage:9,cooldown:1,knockedOut:false});}]){const invalid=structuredClone(s);corrupt(invalid);const before=structuredClone(invalid);assert.throws(()=>SIM.validateSave(invalid));assert.deepEqual(invalid,before);}
  assert.equal(Object.keys(COMBAT_FIELDS).length,6,'four registered fields and two backwards-compatible planes');
});
