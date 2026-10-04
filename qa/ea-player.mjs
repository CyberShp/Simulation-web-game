/**
 * Independent player-operation driver. All progression is performed by exported
 * game commands and ticks. It never writes resources, characters or flags.
 * Reading state to choose a next action is permitted; adversarial test fixtures
 * belong in ea-integration.test.mjs and are not used to prove playability.
 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import * as sim from '../dist/ea-sim.mjs';

export class Player {
  constructor(state = sim.initial()) {
    this.state = state;
    this.operations = [];
    this.milestones = [];
    this.activityCounts = {};
    this.tickSamples = [];
    this.validationCount = 0;
  }

  action(name, ...args) {
    assert.equal(typeof sim[name], 'function', `Public command missing: ${name}`);
    const result = sim[name](this.state, ...args);
    this.operations.push({ time: this.state.time, name, args: structuredClone(args) });
    return result;
  }

  tick(seconds = 10) {
    const before = this.state.time, started = performance.now();
    sim.tick(this.state, seconds);
    this.tickSamples.push({ seconds, milliseconds: performance.now() - started });
    assert.equal(this.state.time, before + seconds, 'Unpaused game must advance requested seconds');
    for (const disciple of this.state.disciples) {
      const key = `${disciple.id}:${disciple.mind.activity}`;
      this.activityCounts[key] = (this.activityCounts[key] || 0) + seconds;
      assert.ok(Number.isFinite(disciple.energy) && disciple.energy >= 0 && disciple.energy <= 100);
    }
    for (const [key, value] of Object.entries(this.state.resources)) {
      assert.ok(Number.isFinite(value) && value >= 0, `${key} is a finite nonnegative stock`);
    }
    return this.state;
  }

  validate() {
    const copy = sim.validateSave(this.state);
    assert.deepEqual(copy, this.state, 'Valid live state must round-trip without silently changing it');
    this.validationCount++;
    return copy;
  }

  until(predicate, { limit = 20000, chunk = 10, reason = 'player wait', maintainFood = false } = {}) {
    const deadline = this.state.time + limit;
    while (!predicate(this.state)) {
      assert.ok(this.state.time < deadline, `${reason}: no progress within ${limit} game seconds`);
      if (maintainFood) this.feedIfNeeded();
      this.tick(Math.min(chunk, deadline - this.state.time));
    }
  }

  feedIfNeeded() {
    const s = this.state;
    const reserve = Math.max(10, s.disciples.length * 4);
    if (s.resources.food >= reserve || s.master.journey || s.campaign?.exploration || s.campaign?.combat) return;
    // Maintaining food is itself a legal gather operation, never a grant.
    if (s.master.energy < 10) {
      this.action('masterAction', 'rest');
      this.until(x => x.master.energy >= 80, { limit: 200, maintainFood: false, reason: 'recover energy to gather food' });
    }
    this.action('masterAction', 'food');
    this.until(x => x.resources.food >= reserve * 2, { limit: 1200, maintainFood: false, reason: 'food recovery' });
    this.action('masterAction', 'rest');
  }

  rest(minimum = 98) {
    if (this.state.master.energy >= minimum) return;
    this.action('masterAction', 'rest');
    this.until(s => s.master.energy >= minimum, { limit: 400, maintainFood: false, reason: 'master energy' });
  }

  resources(cost, { limit = 24000 } = {}) {
    const deadline = this.state.time + limit;
    while (!sim.canPay(this.state, cost)) {
      assert.ok(this.state.time < deadline, `Resource recovery exceeded ${limit}s: ${JSON.stringify(cost)}`);
      this.feedIfNeeded();
      const missing = Object.entries(cost).find(([key, needed]) => this.state.resources[key] < needed);
      if (!missing) break;
      const [key, needed] = missing;
      if (['food', 'wood', 'stone', 'herb'].includes(key)) {
        this.rest(65);
        this.action('masterAction', key);
        this.until(s => s.resources[key] >= needed || s.master.energy < 5, {
          limit: Math.min(5000, deadline - this.state.time), maintainFood: false, reason: `gather ${key}`,
        });
      } else if (key === 'jade') {
        const surplus = ['herb', 'wood', 'stone', 'food'].find(resource =>
          this.state.resources[resource] >= (cost[resource] || 0) + Math.max(100, this.state.disciples.length * 6));
        if (surplus) this.action('trade', surplus, 'sell');
        else {
          this.action('masterAction', 'rest');
          // The hall is a guaranteed source; no simulated resource grants.
          this.tick(20);
        }
      } else {
        const quote = sim.GOODS[key];
        assert.ok(quote, `No normal resource path configured for ${key}`);
        if (this.state.resources.jade < quote.buy) {
          this.resources({ jade: quote.buy });
        }
        try {
          this.action('trade', key, 'buy');
        } catch (error) {
          if (!/每日|限购|售罄|库存|份额|明日/.test(error.message)) throw error;
          this.tick(120 - this.state.time % 120);
        }
      }
    }
    this.action('masterAction', 'rest');
  }

  build(type, preferred) {
    this.resources(sim.TYPES[type].cost);
    const candidates = preferred ? [preferred, ...sim.CELLS] : sim.CELLS;
    const cell = candidates.find(({ x, y }) => !sim.placementLock(this.state, type, x, y));
    assert.ok(cell, `No available legal location for ${type}`);
    return this.action('build', type, cell.x, cell.y);
  }

  recruitTo(count) {
    while (this.state.disciples.length < count) {
      if (sim.capacity(this.state) <= this.state.disciples.length) this.build('house');
      this.resources({ jade: 80, herb: 10, food: Math.max(20, this.state.disciples.length * 4) });
      this.action('recruit');
    }
    this.mark(`${count} followers`);
  }

  book(id) {
    if (this.state.doctrine.books.includes(id)) return;
    this.resources(sim.TECHNIQUES[id].cost);
    this.action('obtainBook', id);
  }

  study(id, mastery = 35) {
    const started = this.state.time;
    while ((this.state.master.knowledge[id] || 0) < mastery) {
      assert.ok(this.state.time - started < 2400, `Study ${id} reaches mastery ${mastery}`);
      this.rest();
      this.action('masterStudy', id);
      this.until(s => !s.master.learning, { limit: 500, maintainFood: false, reason: `study ${id}` });
    }
    this.mark(`master ${id} mastery ${mastery}`);
  }

  chapterOne() {
    this.action('masterAction', 'heal');
    this.until(s => s.master.wound === 0, { limit: 100, maintainFood: false, reason: 'initial healing' });
    this.action('advanceStory');
    this.resources({ herb: 10 });
    this.action('advanceStory');
    this.build('farm', { x: 4, y: 4 });
    this.build('lumber', { x: 1, y: 3 });
    this.build('granary', { x: 5, y: 3 });
    this.action('advanceStory');
    this.build('library', { x: 2, y: 4 });
    this.action('advanceStory');
    assert.equal(this.state.story.step, 4);
    assert.ok(this.state.doctrine.books.includes('spring'));
    this.mark('first chapter complete');
    this.validate();
    return this;
  }

  claimReady() {
    for (const quest of sim.QUESTS) {
      if (!this.state.claimed.includes(quest.id) && quest.check(this.state)) this.action('claim', quest.id);
    }
  }

  explore(region, choice, cost = {}, { leave = true, companions = [] } = {}) {
    this.resources(cost);
    this.feedIfNeeded();
    this.rest();
    this.action('startExploration', region, { companionIds: companions });
    this.until(s => s.world.exploration?.status === 'exploring', {
      limit: 100, chunk: 1, reason: `travel to ${region}`,
    });
    this.validate();
    this.action('moveExploration', 8, 4);
    this.until(s => sim.explorationOptions(s).active?.canInteract, {
      limit: 30, chunk: 1, reason: `approach landmark in ${region}`,
    });
    this.action('resolveExploration', choice);
    this.validate();
    if (leave && this.state.combat?.status !== 'active') this.action('leaveRegion');
    this.claimReady();
    return this.state.world.exploration;
  }

  foundation() {
    if (this.state.story.step < 4) this.chapterOne();
    this.explore('market', 'ledger', { jade: 35 });
    this.explore('quarry', 'treat', { herb: 16 });
    this.action('advanceStory');
    this.mark('reliable foundation manual obtained');
    this.build('quarry');
    this.build('meditation');
    this.build('alchemy');
    this.claimReady();
    this.book('alchemy');
    this.study('spring', 20);
    this.study('alchemy', 40);
    while (this.state.master.realm < 9) this.advanceMasterRealm();
    this.study('foundation', 60);
    this.resources(sim.RECIPES.foundation.cost);
    this.action('craft', 'foundation');
    this.until(s => !s.crafting, { limit: 200, chunk: 1, reason: 'foundation pill' });
    this.advanceMasterRealm();
    assert.equal(this.state.master.realm, 10);
    this.claimReady();
    this.action('advanceStory');
    this.mark('foundation breakthrough');
    this.validate();
    return this;
  }

  advanceMasterRealm() {
    const realm = this.state.master.realm;
    while (this.state.master.xp < sim.xpNeed(realm)) {
      this.feedIfNeeded();
      this.rest();
      this.action('masterAction', 'cultivate');
      this.until(s => s.master.xp >= sim.xpNeed(realm) || s.master.action !== 'cultivate', {
        limit: 1200, chunk: 10, reason: `cultivate realm ${realm}`,
      });
    }
    const prepareUntil = this.state.time + 6000;
    while (!sim.canPay(this.state, sim.breakthroughCost(this.state.master)) || this.state.master.energy < 80) {
      assert.ok(this.state.time < prepareUntil, 'Breakthrough supplies and energy must be ready together');
      // Other inhabitants may spend common supplies while the master rests.
      // Recheck the actual public conditions instead of assuming a reservation.
      this.resources(sim.breakthroughCost(this.state.master));
      this.rest(80);
    }
    this.action('masterBreakthrough');
    this.claimReady();
    this.mark(`master realm ${this.state.master.realm}`);
  }

  prepareRevenge() {
    this.explore('ward', 'unweave', { insight: 18, stone: 25 });
    this.explore('council', 'testify', { jade: 35, food: 10 });
    this.explore('supply', 'settle', { food: 20, wood: 30 });
    this.explore('prison', 'ransom', { jade: 75, herb: 10 });
    this.action('advanceStory');
    this.explore('qixia', 'open', { wood: 20, stone: 20 }, { leave: false });
    this.action('advanceStory');
    this.mark('qixia gate opened with four preparations');
    return this;
  }

  fight() {
    const started = this.state.time;
    while (this.state.combat?.status === 'active') {
      assert.ok(this.state.time - started < 200, 'The battle must end within 200 seconds of player actions');
      const c = this.state.combat, player = c.player;
      const enemy = c.enemies.filter(e => e.hp > 0).sort((a, b) =>
        Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
      if (!enemy) break;
      const danger = c.enemies.find(e => e.telegraph && Math.hypot(e.telegraph.x - player.x, e.telegraph.y - player.y) <= e.telegraph.radius + .2);
      const choices = sim.combatOptions(this.state);
      if (danger && !choices.find(c => c.id === 'dodge').disabled) {
        this.action('combatAction', 'dodge', { x: player.x, y: player.y <= 4 ? 7.2 : .8 });
      }
      for (const id of ['spell', 'attack']) {
        const option = sim.combatOptions(this.state).find(c => c.id === id);
        if (this.state.combat?.status === 'active' && option && !option.disabled) this.action('combatAction', id, enemy.id);
      }
      if (this.state.combat?.status !== 'active') break;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) > 1.85 && !danger) {
        this.action('combatAction', 'move', { x: enemy.x, y: enemy.y });
      }
      this.tick(1);
    }
    this.validate();
    return this.state.combat?.status;
  }

  finishRevenge() {
    this.action('resolveExploration', 'challenge');
    this.validate();
    assert.equal(this.fight(), 'won', 'Prepared solo master can win through movement and active combat commands');
    this.action('advanceStory');
    this.action('advanceStory', 'return');
    this.action('leaveRegion');
    assert.equal(this.state.story.step, 10);
    assert.equal(this.state.story.completed, true);
    assert.equal(this.state.story.revengeDone, true);
    this.mark('first major chapter completed');
    this.tick(120);
    this.validate();
    return this;
  }

  establishTwoPeaks() {
    this.recruitTo(12);
    this.build('kitchen');
    this.build('workshop');
    this.claimReady();
    this.resources(sim.foundingStatus(this.state).cost);
    this.action('foundSect', '云岫承道仙府');
    this.mark('formal sect founded');
    this.book('wood');
    this.book('earth');
    const deadline = this.state.time + 12000;
    const hostPair = () => {
      const herb = sim.peakStatus(this.state, 'herb').hosts.filter(host => host.willing);
      const array = sim.peakStatus(this.state, 'array').hosts.filter(host => host.willing);
      for (const left of herb) {
        const right = array.find(host => host.id !== left.id);
        if (right) return { herb: left, array: right };
      }
      return null;
    };
    while (!hostPair()) {
      assert.ok(this.state.time < deadline, 'Normal NPC growth must produce two willing qualified peak hosts');
      this.feedIfNeeded();
      this.resources({ jade: 250, herb: 80, food: 80, insight: 15 });
      this.tick(60);
      this.validate();
    }
    const combined = {};
    for (const direction of ['herb', 'array']) for (const [resource, amount] of Object.entries(sim.peakStatus(this.state, direction).cost)) {
      combined[resource] = (combined[resource] || 0) + amount;
    }
    // Founding immediately funds the first day's operation of each peak.
    // Keep a small ordinary operating reserve in addition to construction.
    for (const [resource, amount] of Object.entries({ jade: 20, herb: 10, stone: 10 })) {
      combined[resource] = (combined[resource] || 0) + amount;
    }
    this.resources(combined);
    const pair = hostPair();
    assert.ok(pair, 'Two distinct willing hosts remain available after preparing both budgets');
    for (const direction of ['herb', 'array']) {
      const host = pair[direction];
      this.action('foundPeak', direction, host.id);
    }
    this.tick(120);
    assert.equal(this.state.society.peaks.length, 2);
    assert.ok(this.state.society.peaks.every(peak => peak.active));
    assert.notEqual(this.state.society.peaks[0].hostId, this.state.society.peaks[1].hostId);
    this.mark('two independently hosted active peaks');
    this.validate();
    return this;
  }

  referenceWorld() {
    this.recruitTo(30);
    for (const type of Object.keys(sim.TYPES)) {
      if (type === 'hall' || this.state.buildings.some(b => b.type === type)) continue;
      this.build(type);
    }
    const types = ['workshop', 'granary', 'farm', 'meditation', 'lumber', 'quarry'];
    while (this.state.buildings.length < 40) {
      this.build(types[this.state.buildings.length % types.length]);
    }
    this.resources({ jade: 1200, wood: 500, stone: 500, herb: 500, food: 1000, crystal: 100 });
    this.rest();
    this.action('masterAction', 'teach');
    this.tick(120);
    this.mark('30 followers and 40 connected buildings');
    this.validate();
    return this;
  }

  mark(label) {
    this.milestones.push({ label, ...summary(this.state) });
  }

  report() {
    const samples = this.tickSamples.map(x => x.milliseconds / x.seconds).sort((a, b) => a - b);
    return {
      scenario: 'Normal initial state; public player commands only; accelerated deterministic simulation',
      generatedAt: new Date().toISOString(),
      final: summary(this.state),
      operationCount: this.operations.length,
      validationCount: this.validationCount,
      milestones: this.milestones,
      activityCounts: this.activityCounts,
      performance: { logicalMillisecondsPerGameSecondP50: samples[Math.floor(samples.length * .5)], logicalMillisecondsPerGameSecondP95: samples[Math.floor(samples.length * .95)], tickCalls: samples.length },
      operations: this.operations,
    };
  }
}

export function summary(s) {
  return {
    time: s.time, day: Math.floor(s.time / 120) + 1,
    masterRealm: s.master.realm, masterKnowledge: { ...s.master.knowledge },
    storyStep: s.story.step, followers: s.disciples.length,
    buildings: s.buildings.length, resources: { ...s.resources },
    founded: !!s.sect.founded, peaks: s.society?.peaks?.map(p => ({ id: p.id, name: p.name, direction: p.direction, hostId: p.hostId })) || [],
    stats: { ...s.stats },
  };
}

export { sim };
