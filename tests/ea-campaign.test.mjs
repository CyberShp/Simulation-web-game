import test from 'node:test';
import assert from 'node:assert/strict';
import * as w from '../dist/ea-sim.mjs';
import * as legacy from '../dist/sect-sim.mjs';
import { Player } from '../qa/ea-player.mjs';

// These cached fixtures are produced with normal player operations. Tests clone
// them so each failure/reload boundary starts from an independently saved world.
let chapterCache, foundationCache, bossCache;
function chapter() {
  chapterCache ||= new Player().chapterOne().state;
  return new Player(structuredClone(chapterCache));
}
function foundation() {
  foundationCache ||= chapter().foundation().state;
  return new Player(structuredClone(foundationCache));
}
function boss() {
  if (!bossCache) {
    const p = foundation().prepareRevenge();
    p.action('resolveExploration', 'challenge');
    p.validate();
    bossCache = p.state;
  }
  return new Player(structuredClone(bossCache));
}
function sameAfterSeconds(a, b, seconds) {
  w.tick(a, seconds);
  for (let i=0;i<seconds*4;i++) w.tick(b,.25);
  assert.deepEqual(a,b);
}

test('opening migration keeps paid story rewards, followers and pending old journey exactly once', () => {
  const old = legacy.initial();
  legacy.masterAction(old,'heal');legacy.tick(old,15);
  legacy.advanceStory(old);legacy.advanceStory(old);
  legacy.startMasterTravel(old,'valley_path');legacy.tick(old,20);
  assert.equal(old.master.journey.status,'encounter');
  const resources={...old.resources},before=structuredClone(old);
  let state=w.validateSave(old);
  assert.deepEqual(old,before,'migration does not change the retained original');
  for(const [key,value] of Object.entries(resources))assert.equal(state.resources[key],value);
  assert.equal(state.story.step,2);
  assert.deepEqual(state.story.claimed,['story:0','story:1']);
  assert.equal(state.disciples.length,1);
  assert.equal(state.world.legacyJourney.status,'encounter');
  w.tick(state,10);assert.equal(state.world.legacyJourney.status,'encounter');
  state=w.validateSave(state);
  w.resolveMasterEncounter(state,'careful');
  const completed=state.stats.expeditions;
  w.tick(state,20);assert.equal(state.master.journey,null);assert.equal(state.stats.expeditions,completed+1);
  const saved=w.validateSave(state);w.tick(state,20);w.tick(saved,20);
  assert.deepEqual(state,saved);assert.equal(state.stats.expeditions,completed+1);
  assert.throws(()=>w.resolveMasterEncounter(state,'careful'));
});

test('either of two deterministic investigations can obtain the foundation manual without combat', () => {
  const p=chapter();
  p.explore('market','repair',{wood:20,stone:10});
  p.explore('ruins','observe');
  assert.deepEqual(new Set(p.state.story.clues),new Set(['ledger','seal']));
  p.action('advanceStory');
  assert.ok(p.state.doctrine.books.includes('foundation'));
  assert.ok(p.state.doctrine.books.includes('array'));
  assert.equal(p.state.story.step,5);
  const before=structuredClone(p.state);
  assert.throws(()=>p.action('advanceStory'),/筑基/);
  assert.deepEqual(p.state,before,'the next locked gate cannot replay the previous reward');
  p.validate();
});

test('travel, walking and pending exploration events survive save interruption without a new roll', () => {
  const p=chapter();p.rest();p.action('startExploration','valley');p.tick(5);
  const state=p.state,saved=w.validateSave(state),event=state.world.exploration.eventId;
  sameAfterSeconds(state,saved,15);
  assert.equal(state.world.exploration.status,'exploring');
  assert.equal(saved.world.exploration.eventId,event);
  assert.throws(()=>w.resolveExploration(state,'gather'),/走近/);
  w.moveExploration(state,8,4);w.moveExploration(saved,8,4);sameAfterSeconds(state,saved,1);
  const duringWalk=w.validateSave(state);sameAfterSeconds(state,duringWalk,2);
  const pending=w.validateSave(state),available=w.explorationOptions(state).active.choices.find(c=>!c.disabled);
  assert.ok(available);
  w.resolveExploration(state,available.id);w.resolveExploration(pending,available.id);
  assert.deepEqual(state,pending);
  const after=structuredClone(state);
  assert.throws(()=>w.resolveExploration(state,available.id));
  assert.deepEqual(state,after,'a resolved visit never spends or pays twice');
});

test('a real battle persists hp, qi, cooldowns and the exact warning across save/load', () => {
  const p=boss();
  assert.ok(Number.isFinite(p.state.combat.player.maxQi));
  p.tick(2);
  assert.ok(p.state.combat.enemies.some(e=>e.telegraph));
  const state=p.state,resumed=w.validateSave(state);
  sameAfterSeconds(state,resumed,1);
  assert.ok(Number.isFinite(state.combat.player.qi));
  const before=state.combat.enemies[0].hp;
  w.combatAction(state,'spell');
  assert.ok(state.combat.enemies[0].hp<before);
  const paid=structuredClone(state);
  assert.throws(()=>w.combatAction(state,'spell'),/调息/);
  assert.deepEqual(state,paid,'cooldown rejection cannot consume qi');
  const warningSave=w.validateSave(state);sameAfterSeconds(state,warningSave,1);
});

test('standing still cannot win; defeat returns a wounded master who can heal and retry normally', () => {
  const p=boss(),clues=[...p.state.story.clues],preparations={...p.state.story.preparations};
  p.until(s=>s.combat.status!=='active',{limit:200,chunk:1,reason:'standing idle loses'});
  assert.equal(p.state.combat.status,'lost');
  assert.equal(p.state.story.revengeDone,false);
  assert.equal(p.state.combat.result.injury,35);
  assert.ok(p.state.master.wound>34&&p.state.master.wound<=35,'the arrival tick may also provide a small amount of ordinary rest recovery');
  assert.equal(p.state.world.exploration,null);
  assert.equal(p.state.master.journey,null);
  assert.deepEqual(p.state.story.clues,clues);assert.deepEqual(p.state.story.preparations,preparations);
  p.state=p.validate();
  assert.throws(()=>p.action('startExploration','qixia'),/疗伤/);
  p.resources({herb:6});p.action('masterAction','heal');
  p.until(s=>s.master.wound===0,{limit:100,chunk:1,reason:'recover from battle injury'});
  p.explore('qixia','challenge',{}, {leave:false});
  assert.equal(p.state.combat.status,'active');
  assert.equal(p.fight(),'won');
  p.validate();
});

test('retreat uses the exit and carries no combat victory rewards', () => {
  const p=boss(),before=p.state.story.claimed.slice();
  p.action('combatAction','retreat');
  assert.equal(p.state.combat.status,'active','retreat is a movement to the exit');
  p.until(s=>s.combat.status!=='active',{limit:20,chunk:1,reason:'reach retreat exit'});
  assert.equal(p.state.combat.status,'retreated');
  assert.deepEqual(p.state.story.claimed,before);
  assert.equal(p.state.world.exploration,null);
  assert.equal(p.state.story.revengeDone,false);
  p.validate();
});

test('combat movement, range, guard and dodge change damage and only control the master', () => {
  const p=boss(),plain=structuredClone(p.state),guarded=structuredClone(p.state);
  w.tick(plain,2);w.tick(guarded,2);
  w.combatAction(guarded,'guard');
  w.tick(plain,2);w.tick(guarded,2);
  assert.ok(guarded.combat.player.hp>plain.combat.player.hp,'guard absorbs a real incoming strike');
  const far=boss().state;
  w.combatAction(far,'dodge',{x:.6,y:4});
  const dodgeEnd={x:far.combat.player.x,y:far.combat.player.y};
  assert.ok(dodgeEnd.x<8);
  assert.throws(()=>w.combatAction(far,'attack'),/范围/);
  const snapshot=structuredClone(far);
  assert.throws(()=>w.combatAction(far,'control-ally',1));
  assert.deepEqual(far,snapshot);
});

test('a willing companion spends energy, acts through AI, and remembers the return', () => {
  const p=chapter();p.rest();
  const option=w.companionOptions(p.state,'quarry').find(o=>o.willing);
  assert.ok(option,'early followers can willingly support a local protective mission');
  const d=p.state.disciples.find(d=>d.id===option.id),energy=d.energy;
  p.action('startExploration','quarry',{companionIds:[option.id]});
  assert.ok(d.energy<energy);assert.equal(d.mind.away.kind,'campaign');
  p.until(s=>s.world.exploration.status==='exploring',{limit:60,chunk:1,reason:'companion travel'});
  p.action('moveExploration',8,4);p.tick(3);p.action('resolveExploration','defend');
  const ally=p.state.combat.allies[0],initial={x:ally.x,y:ally.y};
  p.tick(3);
  assert.notDeepEqual({x:ally.x,y:ally.y},initial,'an ally follows its own battle movement');
  assert.equal(p.fight(),'won');
  // Acknowledging the modal must not destroy the saved journey consequences.
  p.action('acknowledgeCombat');p.state=p.validate();p.action('leaveRegion');
  const returned=p.state.disciples.find(d=>d.id===option.id);
  assert.equal(returned.mind.away,null);
  assert.ok(returned.mind.memories.some(m=>/共同经历/.test(m.text)));
  p.validate();
});

test('the complete first chapter ends after actual prepared combat and continues its economy', () => {
  const p=boss();assert.equal(p.fight(),'won');
  assert.ok(p.state.story.claimed.includes('battle:challenge'));
  assert.equal(p.state.story.revengeDone,true);
  let state=p.validate();
  const jade=state.resources.jade;
  w.advanceStory(state);
  assert.equal(state.resources.jade,jade+180);
  state=w.validateSave(state);
  w.advanceStory(state,'rebuild');
  assert.equal(state.story.completed,true);assert.equal(state.story.step,10);assert.equal(state.story.ending,'rebuild');
  const completed=structuredClone(state);
  assert.throws(()=>w.advanceStory(state));assert.deepEqual(state,completed);
  w.leaveRegion(state);
  const time=state.time;
  w.tick(state,120);
  assert.equal(state.time,time+120);
  assert.equal(state.story.completed,true);
  assert.equal(state.story.claimed.filter(k=>k==='story:8').length,1);
  assert.deepEqual(w.validateSave(state),state);
});

test('weather affects production, travel and battle risk while visitors settle once', () => {
  const clear=chapter().state,rain=structuredClone(clear);
  clear.world.weather.id='clear';rain.world.weather.id='rain';
  assert.ok(w.weatherEffects(rain).production.herb>w.weatherEffects(clear).production.herb);
  assert.ok(w.weatherEffects(rain).risk>w.weatherEffects(clear).risk);
  clear.master.energy=100;rain.master.energy=100;
  w.startExploration(clear,'valley');w.startExploration(rain,'valley');
  assert.ok(rain.world.exploration.total>clear.world.exploration.total);
  const p=chapter();
  p.until(s=>w.visitorOptions(s).length>0,{limit:360,chunk:10,reason:'world visitor arrival'});
  const visitor=w.visitorOptions(p.state)[0],option=visitor.choices.find(c=>!c.disabled);
  assert.ok(option);
  const resumed=w.validateSave(p.state);
  w.resolveVisitor(p.state,visitor.id,option.id);w.resolveVisitor(resumed,visitor.id,option.id);
  assert.deepEqual(p.state,resumed);
  const after=structuredClone(p.state);
  assert.throws(()=>w.resolveVisitor(p.state,visitor.id,option.id));assert.deepEqual(p.state,after);
});

test('campaign validation rejects broken result, duplicate rewards and invalid battle inputs', () => {
  const base=boss().state;
  for(const corrupt of [
    s=>{s.combat.player.qi=NaN;},
    s=>{delete s.combat.player.maxQi;},
    s=>{s.combat.player.x=Infinity;},
    s=>{s.world.exploration.id=0;},
    s=>{s.master.journey.status='exploring';},
    s=>{s.combat.rewardApplied=true;},
    s=>{s.story.claimed.push(s.story.claimed[0]);},
    s=>{s.story.completed=true;},
    s=>{s.world.weather.id='unknown';}
  ]){const s=structuredClone(base);corrupt(s);const before=structuredClone(s);assert.throws(()=>w.validateCampaign(s));assert.deepEqual(s,before);}
  const before=structuredClone(base);
  assert.throws(()=>w.combatAction(base,'move',{x:NaN,y:1}));assert.deepEqual(base,before);
});
