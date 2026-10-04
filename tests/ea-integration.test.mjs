import test from 'node:test';
import assert from 'node:assert/strict';
import * as w from '../dist/ea-sim.mjs';
import { Player } from '../qa/ea-player.mjs';
import { createEAPersistence, slotKeys, MAX_IMPORT_BYTES } from '../dist/ea-persistence.mjs';
import { memoryStorage, memoryLocks, flushMicrotasks } from '../qa/ea-storage-fixture.mjs';
import { normalRun } from '../qa/ea-normal-play.mjs';
import * as v1 from '../dist/model.mjs';
import * as v2 from '../dist/world.mjs';
import * as v3 from '../dist/living-world.mjs';
import * as v4 from '../dist/sect-sim.mjs';

test('EA ordinary new game completes the introductory chapter through actual player commands', () => {
  const player = new Player();
  const initialResources = { ...player.state.resources };
  assert.equal(player.state.disciples.length, 0);
  assert.equal(player.state.master.realm, 6);
  player.chapterOne();
  assert.ok(player.state.disciples.length >= 2);
  assert.ok(player.operations.some(x => x.name === 'masterAction' && x.args[0] === 'wood'));
  assert.ok(player.state.buildings.some(x => x.type === 'granary'));
  assert.ok(initialResources.jade < 1000, 'No debug resource injection in this scenario');
});

test('EA fixed-step simulation and valid save continuation yield identical complete state', () => {
  const original = new Player().chapterOne().state;
  const coarse = structuredClone(original), fine = structuredClone(original);
  w.tick(coarse, 180);
  for (let index = 0; index < 720; index++) w.tick(fine, .25);
  assert.deepEqual(coarse, fine, 'Economy, AI, weather, events and seed are independent of tick subdivision');
  const restored = w.validateSave(coarse);
  w.tick(coarse, 240);
  w.tick(restored, 240);
  assert.deepEqual(coarse, restored, 'Loading must not re-roll or re-settle events');
});

test('EA pause and invalid tick values never advance economics, people or campaign', () => {
  const state = new Player().chapterOne().state;
  state.speed = 0; // Explicit pause fixture, not a progression shortcut.
  const paused = structuredClone(state);
  w.tick(state, 180);
  assert.deepEqual(state, paused);
  state.speed = 1;
  const before = structuredClone(state);
  for (const delta of [0, -1, NaN, Infinity]) {
    try { w.tick(state, delta); } catch (error) { assert.ok(error instanceof Error); }
    assert.deepEqual(state, before, `Invalid delta ${delta} must not partially mutate`);
  }
});

test('EA public commands reject illegal locations and forced NPC control without spending', () => {
  const state = new Player().chapterOne().state;
  for (const invoke of [
    () => w.build(state, 'quarry', 999, 999),
    () => w.build(state, 'hall', 1, 1),
    () => w.build(state, 'missing', 2, 2),
    () => w.masterStudy(state, 'missing'),
    () => w.trade(state, 'jade', 'buy'),
    () => w.assign(state, state.disciples[0].id, state.buildings[0].id),
    () => w.usePill(state, 'qi', state.disciples[0].id),
  ]) {
    const before = structuredClone(state);
    assert.throws(invoke);
    assert.deepEqual(state, before, 'Rejected command must leave the previous state intact');
  }
});

test('EA live state validator rejects malformed critical fields rather than normalizing cheats', () => {
  const mutations = [
    ['nonfinite time', state => { state.time = Infinity; }],
    ['negative food', state => { state.resources.food = -1; }],
    ['nonfinite currency', state => { state.resources.jade = NaN; }],
    ['duplicate building IDs', state => { state.buildings.push({ ...state.buildings[0], x: 1, y: 3 }); }],
    ['unknown building', state => { state.buildings[0].type = 'missing'; }],
    ['invalid coordinate', state => { state.buildings[0].x = 999; }],
    ['reused next building ID', state => { state.nextId = 1; }],
    ['negative energy', state => { state.master.energy = -1; }],
    ['unbounded realm', state => { state.master.realm = 999; }],
    ['unknown master action', state => { state.master.action = 'grant_everything'; }],
    ['unknown main manual', state => { state.master.main = 'missing'; }],
    ['impossible mastery', state => { state.master.knowledge.qingyuan = 101; }],
    ['missing master main', state => { state.master.main = null; }],
    ['invalid random seed', state => { state.sim.seed = 0; }],
    ['unprocessed full tick carry', state => { state.sim.carry = 1; }],
    ['impossible story progress', state => { state.story.step = 999; }],
    ['unknown owned manual', state => { state.doctrine.books.push('missing'); }],
    ['duplicate owned manual', state => { state.doctrine.books.push('qingyuan'); }],
    ['negative completion statistics', state => { state.stats.crafted = -1; }],
  ];
  for (const [label, mutate] of mutations) {
    const state = w.initial();
    mutate(state);
    const before = structuredClone(state);
    assert.throws(() => w.validateSave(state), label);
    assert.deepEqual(state, before, `Validation must not mutate the rejected input: ${label}`);
  }
});

test('EA passive production is credited once per cycle and is unchanged by save-load boundaries', () => {
  const state = w.initial(), initialJade = state.resources.jade;
  w.tick(state, 19);
  assert.equal(state.resources.jade, initialJade);
  const resumed = w.validateSave(state);
  w.tick(state, 1);
  w.tick(resumed, 1);
  assert.equal(state.resources.jade, initialJade + w.TYPES.hall.out.jade);
  assert.deepEqual(state, resumed);
  w.tick(state, 1);
  assert.equal(state.resources.jade, initialJade + w.TYPES.hall.out.jade);
});

function storePair() {
  const storage = memoryStorage(), locks = memoryLocks();
  const make = () => createEAPersistence({ getStorage: () => storage, locks, validate: w.validateSave, channelFactory: null });
  return { storage, locks, make };
}

test('EA real-game saves use three isolated worlds and retain three rolling valid snapshots', async t => {
  const { make } = storePair(), store = make();
  t.after(() => store.close());
  const states = [];
  for (let slot = 1; slot <= 3; slot++) {
    const state = w.initial({ name: `掌门${slot}` });
    w.tick(state, slot * 10);
    assert.equal((await store.open(slot)).mode, 'writer');
    for (let revision = 0; revision < 5; revision++) {
      w.tick(state, 1);
      assert.equal(store.saveNow(state, { checkpoint: revision === 2 ? '验收检查点' : null }).ok, true);
    }
    states.push(structuredClone(state));
    assert.equal(store.inspect(slot).backups.length, 3);
    assert.ok(store.inspect(slot).backups.every(x => x.valid));
  }
  assert.equal(store.listSlots().length, 3);
  for (let slot = 1; slot <= 3; slot++) {
    assert.deepEqual((await store.open(slot)).state, states[slot - 1]);
  }
});

test('EA simultaneous world claims have one writer, then transfer only after release', async t => {
  const { make } = storePair(), first = make(), second = make();
  t.after(() => { first.close(); second.close(); });
  const results = await Promise.all([first.open(1), second.open(1)]);
  assert.equal(results.filter(result => result.mode === 'writer').length, 1);
  assert.equal(results.filter(result => result.mode === 'readonly').length, 1);
  const writer = first.mode === 'writer' ? first : second;
  const reader = writer === first ? second : first;
  const state = new Player().chapterOne().state;
  assert.equal(writer.saveNow(state).ok, true);
  assert.equal(reader.saveNow(w.initial()).ok, false);
  assert.deepEqual(writer.inspect(1).state, state);
  writer.release({ state });
  await flushMicrotasks();
  const reopened = await reader.open(1);
  assert.equal(reopened.mode, 'writer');
  assert.deepEqual(reopened.state, state);
  assert.equal(writer.saveNow(w.initial()).ok, false);
});

test('EA corruption recovery is explicit and preserves the damaged primary as raw evidence', async t => {
  const { make, storage } = storePair(), store = make();
  t.after(() => store.close());
  await store.open(1);
  const state = w.initial();
  assert.equal(store.saveNow(state).ok, true);
  w.tick(state, 60);
  assert.equal(store.saveNow(state).ok, true);
  store.release();
  await flushMicrotasks();
  storage.setItem(slotKeys(1).primary, '{damaged');
  const result = await store.open(1);
  assert.equal(result.status, 'recovery-required');
  assert.equal(result.state, null);
  assert.equal(store.saveNow(state).ok, false);
  assert.equal(storage.getItem(slotKeys(1).primary), '{damaged');
  const backup = result.backups.find(x => x.valid);
  assert.ok(backup);
  const recovered = await store.recover(1, backup.id);
  assert.equal(recovered.ok, true);
  assert.equal(recovered.state.time, 0);
  const raw = JSON.parse(store.exportBundle(1));
  assert.match(raw.raw.preserved, /damaged/);
  assert.ok(store.inspect(1).preserved.some(x => !x.valid));
});

test('EA a selected raw backup remains recoverable after quota repair rotates it out of the live backup list', async t => {
  const { make, storage } = storePair(), store = make();
  const originalWrite = storage.setItem;
  t.after(() => { storage.setItem = originalWrite; store.close(); });
  await store.open(1);
  const state = w.initial();
  for (let revision = 0; revision < 4; revision++) {
    w.tick(state, 20);
    assert.equal(store.saveNow(state).ok, true);
  }
  w.tick(state, 10);
  storage.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
  assert.equal(store.saveNow(state).code, 'storage-full');

  // This is the real application's fixed-list protocol, using the actual save
  // module and live simulation states. It is not a native browser UI test.
  const listed = store.inspect(1).backups;
  assert.equal(listed.length, 3);
  const snapshots = new Map(listed.map(record => [record.id, {
    raw: store.exportSlot(1, { source: record.id }), meta: structuredClone(record.meta),
  }]));
  const oldest = listed.at(-1), selected = snapshots.get(oldest.id);
  const selectedState = store.parseImport(selected.raw).state;
  assert.equal(selectedState.time, 20);

  // Space is released while the list is visible. A retry at auto-save or
  // detach may now succeed and remove the selected item from the rolling ring.
  storage.setItem = originalWrite;
  assert.equal(store.saveNow(state).ok, true);
  assert.ok(!store.inspect(1).backups.some(record => record.id === oldest.id));
  assert.throws(() => store.exportSlot(1, { source: oldest.id }));
  const currentPrimary = store.exportSlot(1);
  store.release();
  await flushMicrotasks();

  const recovered = await store.importInto(1, selected.raw, { confirmed: true });
  assert.equal(recovered.ok, true);
  assert.deepEqual(recovered.state, selectedState, 'Recovery uses the displayed snapshot, not a now-missing rolling ID');
  assert.deepEqual(store.inspect(1).state, selectedState);
  assert.ok(store.inspect(1).preserved.some(record => store.exportSlot(1, { source: record.id }) === currentPrimary),
    'The newer primary is preserved before replacing it with the chosen old state');
});

test('EA rejected import or storage write failure leaves the last good game untouched', async t => {
  const { make, storage } = storePair(), store = make();
  t.after(() => store.close());
  await store.open(1);
  const state = w.initial();
  assert.equal(store.saveNow(state).ok, true);
  const previous = storage.getItem(slotKeys(1).primary), savedAt = store.savedAt;
  for (const text of ['{}', 'null', '[]', '{bad', 'x'.repeat(MAX_IMPORT_BYTES + 1)]) {
    assert.equal(store.parseImport(text).ok, false);
    assert.equal((await store.importInto(1, text, { confirmed: true })).ok, false);
    assert.equal(storage.getItem(slotKeys(1).primary), previous);
  }
  const illegal = structuredClone(state);
  illegal.master.realm = 999;
  assert.equal((await store.importInto(1, JSON.stringify(illegal), { confirmed: true })).ok, false);
  assert.equal(storage.getItem(slotKeys(1).primary), previous);
  storage.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
  w.tick(state, 30);
  const failed = store.saveNow(state);
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'storage-full');
  assert.equal(store.savedAt, savedAt, 'Failure must not announce a fresh successful save');
  assert.equal(storage.getItem(slotKeys(1).primary), previous);
});

test('EA detects a noncooperating external save before committing over it', async t => {
  const { make, storage } = storePair(), store = make();
  t.after(() => store.close());
  await store.open(1);
  const state = w.initial();
  assert.equal(store.saveNow(state).ok, true);
  const external = store.exportState(w.initial({ name: '外部新进度' }));
  const baseSet = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    baseSet(key, value);
    if (key === slotKeys(1).backups) baseSet(slotKeys(1).primary, external);
  };
  w.tick(state, 10);
  assert.equal(store.saveNow(state).ok, false);
  assert.equal(storage.getItem(slotKeys(1).primary), external);
  assert.equal(store.mode, 'readonly');
});

test('EA normal resources reach foundation, a closed revenge ending, a formal sect and two self-selected peaks', () => {
  const player = normalRun({ reference: true }), state = player.state;
  assert.equal(state.story.completed, true);
  assert.equal(state.story.step, 10);
  assert.equal(state.master.realm, 10);
  assert.equal(state.sect.founded, true);
  assert.equal(state.disciples.length, 30);
  assert.equal(state.buildings.length, 40);
  assert.deepEqual(state.society.peaks.map(p => p.direction).sort(), ['array', 'herb']);
  assert.equal(new Set(state.society.peaks.map(p => p.hostId)).size, 2);
  assert.ok(state.society.peaks.every(p => p.active && p.members.length));
  assert.ok(state.disciples[0].mind.memories.some(m => m.important && /亲人/.test(m.text)));
  assert.ok(Object.keys(player.activityCounts).some(key => key.endsWith(':work')));
  assert.ok(Object.keys(player.activityCounts).some(key => key.endsWith(':study')));
  assert.ok(Object.keys(player.activityCounts).some(key => key.endsWith(':cultivate')));
  assert.ok(!player.operations.some(op => ['assign', 'usePill', 'breakthroughPerson', 'learnTechnique', 'addDisciple'].includes(op.name)));
  const before = structuredClone(state);
  assert.throws(() => w.advanceStory(state, 'return'));
  assert.deepEqual(state, before, 'Completed story cannot pay its final rewards again');
  const restored = w.validateSave(state);
  w.tick(state, 360);
  w.tick(restored, 360);
  assert.deepEqual(state, restored, 'Post-ending production, NPCs and peaks continue identically after reload');
});

test('EA stopped facilities cannot be reassigned by autonomous workers or accrue production progress', () => {
  const player = new Player().chapterOne(), state = player.state;
  const facilities = state.buildings.filter(b => w.TYPES[b.type].work);
  for (const building of facilities) w.toggleBuilding(state, building.id);
  const progress = facilities.map(b => b.progress);
  for (let second = 0; second < 120; second++) {
    w.tick(state, 1);
    for (const disciple of state.disciples) assert.ok(!facilities.some(b => b.id === disciple.job));
  }
  assert.deepEqual(facilities.map(b => b.progress), progress);
  assert.deepEqual(w.validateSave(state), state);
});

test('EA private book learning stays hidden in public people, teachers, peak eligibility, logs and incidents until evidence is found', () => {
  const state = new Player().chapterOne().state, disciple = state.disciples[0];
  // Adversarial opportunity/personality fixture. This is not playability evidence.
  state.doctrine.books = ['qingyuan', 'wood']; state.doctrine.sealed = ['wood'];
  disciple.realm = 4; disciple.talent = 2; disciple.energy = 100;
  Object.assign(disciple.mind, { main: 'qingyuan', publicMain: 'qingyuan', knowledge: { qingyuan: 100 }, support: [], learning: null,
    traits: [20, 90, 0, 70, 100], activity: 'rest', commitUntil: 0 });
  let hiddenSamples = 0, masteredWhileHidden = false, discovered;
  for (let second = 0; second < 450; second++) {
    w.tick(state, 1);
    const secret = state.society.secrets.find(e => e.discipleId === disciple.id && e.kind === 'book');
    if (!secret) continue;
    if (secret.discovered) { discovered = secret; break; }
    hiddenSamples++;
    const beforeView = structuredClone(state), view = w.getSocietyView(state);
    assert.deepEqual(state, beforeView, 'UI projections do not advance or mutate gameplay');
    const person = view.disciples.find(d => d.id === disciple.id);
    assert.ok(!person.support.includes('wood'));
    assert.equal(person.knowledge.wood, undefined);
    assert.notEqual(person.learning?.id, 'wood');
    assert.doesNotMatch(JSON.stringify(person), /青木调息法/);
    assert.ok(!w.teachers(state, 'wood').some(t => t.id === disciple.id));
    assert.equal(w.peakHostWillingness(state, disciple.id, 'herb').capable, false, 'A hidden manual cannot qualify its reader for a public office');
    assert.equal(view.peakOptions.find(p => p.id === 'herb').hosts.find(d => d.id === disciple.id).capable, false);
    assert.ok(!view.incidents.some(e => e.id === secret.id));
    assert.ok(!state.incidents.some(e => e.id === secret.id));
    assert.ok(!state.logs.some(l => l.time >= secret.time && l.text.includes(disciple.name) && /青木调息法|私阅|封卷/.test(l.text)));
    if (disciple.mind.knowledge.wood >= 60) masteredWhileHidden = true;
    if (hiddenSamples === 20) {
      assert.throws(() => w.settleIncident(state, secret.id, 'warn'));
      assert.deepEqual(w.validateSave(state), state);
    }
  }
  assert.ok(hiddenSamples >= 40, 'Observed a real interval before discovery');
  assert.ok(masteredWhileHidden, 'A hidden qualified teacher was actually exercised');
  assert.ok(discovered);
  assert.ok(w.getSocietyView(state).incidents.some(e => e.id === discovered.id));
  assert.equal(w.peakHostWillingness(state, disciple.id, 'herb').capable, true, 'Discovered knowledge becomes available for public qualification');
  const originalTraits = [...disciple.mind.traits];
  w.settleIncident(state, discovered.id, 'warn');
  assert.deepEqual(disciple.mind.traits, originalTraits, 'Punishment does not rewrite personality');
  const settled = structuredClone(state);
  assert.throws(() => w.settleIncident(state, discovered.id, 'warn'));
  assert.deepEqual(state, settled);
});

test('EA repeated reconciliation without new conflict and repeated mentor invitations do not farm relationships', () => {
  const player = new Player().chapterOne(), state = player.state, disciple = state.disciples[0];
  const relationship = disciple.mind.relationships.master;
  w.societyCommand(state, { type: 'talk', discipleId: disciple.id, topic: 'reconcile' });
  const afterTalk = { ...relationship };
  assert.equal(afterTalk.conflict, 0);
  player.tick(120);
  const beforeSecond = relationship.trust;
  w.societyCommand(state, { type: 'talk', discipleId: disciple.id, topic: 'reconcile' });
  assert.equal(relationship.trust, beforeSecond, 'No new disagreement means no repeat reconciliation reward');
  player.study('qingyuan', 80);
  assert.equal(w.inviteMentor(state, disciple.id, 'master').accepted, true);
  const afterInvitation = { ...relationship };
  w.inviteMentor(state, disciple.id, 'master');
  assert.deepEqual(relationship, afterInvitation, 'Inviting the existing mentor is idempotent');
});

test('EA personal quests and visitors have real completion, lasting memory and one-time settlement', () => {
  const player = new Player().chapterOne(), state = player.state;
  player.tick(150);
  const view = w.getSocietyView(state), family = view.quests.find(q => q.kind === 'family');
  const mastery = view.quests.find(q => q.kind === 'mastery');
  assert.ok(family && mastery);
  player.resources(family.cost);
  w.societyCommand(state, { type: 'quest', questId: family.id, choice: 'aid' });
  const started = structuredClone(state);
  assert.throws(() => w.societyCommand(state, { type: 'quest', questId: family.id, choice: 'aid' }));
  assert.deepEqual(state, started);
  player.tick(60);
  assert.equal(state.society.quests.find(q => q.id === family.id).status, 'completed');
  assert.ok(state.disciples.find(d => d.id === family.discipleId).mind.memories.some(m => m.important && m.key === `quest:${family.id}`));
  player.resources(mastery.cost);
  w.societyCommand(state, { type: 'quest', questId: mastery.id, choice: 'support' });
  const research = state.society.quests.find(q => q.id === mastery.id);
  assert.equal(research.status, 'active');
  player.until(() => research.status !== 'active', { limit: 2000, reason: 'actual personal research' });
  assert.equal(research.status, 'completed');
  assert.ok(state.disciples.find(d => d.id === research.discipleId).mind.knowledge[research.target] >= research.targetMastery);
  player.until(() => w.getSocietyView(state).visitors.length > 0, { limit: 600, reason: 'next visitor after cooldown' });
  const guest = w.getSocietyView(state).visitors[0];
  assert.ok(guest);
  const choice = guest.choices.find(c => !c.disabledReason && c.id !== 'decline') || guest.choices.at(-1);
  w.societyCommand(state, { type: 'visitor', visitorId: guest.id, choice: choice.id });
  const after = structuredClone(state);
  assert.throws(() => w.societyCommand(state, { type: 'visitor', visitorId: guest.id, choice: choice.id }));
  assert.deepEqual(state, after);
  assert.deepEqual(w.validateSave(state), state);
});

test('EA malformed society containers and orphan journeys cannot enter an imported game', () => {
  const base = new Player().chapterOne().state;
  for (const [label, mutate] of [
    ['missing production skills', s => { s.disciples[0].mind.skills = {}; }],
    ['missing statistics keys', s => { s.society.stats = {}; }],
    ['invalid departed memories', s => { s.society.departed.push({ id: 999, name: '旧客', time: s.time, reason: '离开', memories: 3 }); }],
    ['orphan autonomous travel', s => { s.disciples[0].mind.away = { kind: 'errand', id: 'valley_path' }; s.disciples[0].mind.journey = null; }],
  ]) {
    const state = structuredClone(base); mutate(state);
    assert.throws(() => w.validateSave(state), label);
  }
});

test('EA fire, water and earth development routes are each reachable from ordinary opening resources', () => {
  for (const id of ['ember', 'frost', 'earth']) {
    const player = new Player().chapterOne();
    player.book(id);
    player.study(id, 20);
    player.advanceMasterRealm();
    assert.equal(player.state.master.main, id);
    assert.equal(player.state.master.realm, 7);
    player.validate();
  }
});

test('EA migration of v1-v4 initial worlds preserves source assets and does not mutate input', () => {
  for (const previous of [v1, v2, v3, v4]) {
    const old = previous.initial(), before = structuredClone(old), migrated = w.validateSave(old);
    assert.equal(migrated.version, 5);
    assert.deepEqual(old, before);
    for (const [resource, value] of Object.entries(old.resources)) assert.equal(migrated.resources[resource], value);
    assert.deepEqual(migrated.disciples.map(d => d.id), old.disciples.map(d => d.id));
    assert.deepEqual(migrated.buildings.map(b => [b.id, b.type, b.x, b.y, b.level]), old.buildings.map(b => [b.id, b.type, b.x, b.y, b.level]));
    assert.equal(migrated.stats.crafted, old.stats.crafted || 0);
    assert.equal(migrated.stats.expeditions, old.stats.expeditions || 0);
    assert.deepEqual(w.validateSave(migrated), migrated);
  }
});

test('EA migration retains a pending old alchemy yield and a paused master encounter without double rewards', () => {
  const oldCraft = v2.initial();
  v2.build(oldCraft, 'alchemy', 2, 4);
  v2.craft(oldCraft, 'qi');
  v2.tick(oldCraft, 12);
  const crafting = w.validateSave(oldCraft);
  assert.equal(crafting.crafting.remaining, oldCraft.crafting.remaining);
  w.tick(crafting, 13);
  assert.equal(crafting.stats.crafted, oldCraft.stats.crafted + 1);
  assert.equal(crafting.pills.qi, 1, 'An old batch retains its original yield, not the larger new recipe yield');
  const crafted = crafting.stats.crafted;
  w.tick(crafting, 30);
  assert.equal(crafting.stats.crafted, crafted);

  const oldTravel = v4.initial();
  v4.masterAction(oldTravel, 'heal');
  v4.tick(oldTravel, 15);
  v4.advanceStory(oldTravel);
  v4.advanceStory(oldTravel);
  v4.startMasterTravel(oldTravel, 'valley_path');
  v4.tick(oldTravel, 20);
  assert.equal(oldTravel.master.journey.status, 'encounter');
  const travel = w.validateSave(oldTravel);
  assert.equal(travel.master.journey.status, 'encounter');
  assert.equal(travel.stats.expeditions, oldTravel.stats.expeditions);
  w.tick(travel, 30);
  assert.equal(travel.master.journey.remaining, 20);
  w.resolveMasterEncounter(travel, 'careful');
  w.tick(travel, 20);
  assert.equal(travel.master.journey, null);
  assert.equal(travel.stats.expeditions, oldTravel.stats.expeditions + 1);
  const resolved = w.validateSave(travel);
  w.tick(resolved, 30);
  assert.equal(resolved.stats.expeditions, travel.stats.expeditions);
});

test('EA different ordinary starting seeds can each finish revenge and establish two willing peaks', () => {
  for (const seed of [42, 20261004, 4294967295]) {
    const player = new Player(w.initial({ seed }));
    player.foundation().prepareRevenge().finishRevenge().establishTwoPeaks();
    assert.equal(player.state.story.completed, true, `Story completed for seed ${seed}`);
    assert.equal(player.state.master.realm, 10);
    assert.equal(player.state.society.peaks.length, 2);
    assert.ok(player.state.society.peaks.every(peak => peak.active));
    assert.notEqual(player.state.society.peaks[0].hostId, player.state.society.peaks[1].hostId);
    player.validate();
  }
});

test('EA optional early breakthrough has saved deterministic success and recoverable failure through normal play', () => {
  const outcomes = new Set();
  // Seeds are chosen at ordinary world creation, never rewritten to reroll an attempt.
  for (const seed of [1, 3]) {
    const player = new Player(w.initial({ seed }));
    player.action('masterAction', 'heal');
    player.until(s => s.master.wound === 0, { limit: 100 });
    player.resources(w.breakthroughCost(player.state.master));
    player.rest();
    player.action('masterAction', 'cultivate');
    player.until(s => s.master.xp >= w.xpNeed(s.master.realm) * .85, { limit: 200, chunk: 1 });
    player.action('masterAction', 'rest');
    const before = player.validate(), info = w.riskBreakthroughInfo(player.state);
    assert.equal(info.lock, '');
    assert.ok(info.chance > 0 && info.chance < 1);
    assert.deepEqual(player.state, before, 'Showing the risk must be a pure read');
    const result = player.action('masterRiskBreakthrough');
    const reloadedBeforeAttempt = w.validateSave(before);
    assert.deepEqual(w.masterRiskBreakthrough(reloadedBeforeAttempt), result, 'Loading before the choice must not change the roll');
    assert.deepEqual(reloadedBeforeAttempt, player.state);
    outcomes.add(result.success);
    for (const [key, amount] of Object.entries(info.cost)) assert.equal(player.state.resources[key], before.resources[key] - amount);
    assert.equal(player.state.master.energy, before.master.energy - info.energyCost);
    const settled = player.validate();
    assert.throws(() => player.action('masterRiskBreakthrough'));
    assert.deepEqual(player.state, settled, 'An immediate retry cannot spend or settle again');
    if (!result.success) {
      assert.equal(player.state.master.realm, before.master.realm);
      assert.equal(player.state.master.wound, 12);
      assert.equal(player.state.master.xp, before.master.xp * .85);
      assert.equal(player.state.master.breakthroughCooldown, before.time + 60);
      player.resources({ herb: 6 });
      player.action('masterAction', 'heal');
      player.until(s => s.master.wound === 0, { limit: 100, chunk: 1 });
      player.advanceMasterRealm();
      assert.equal(player.state.master.realm, 7, 'A failed ordinary attempt can recover and use the safe breakthrough');
      assert.equal(player.state.master.talent, before.master.talent);
      player.validate();
    } else {
      assert.equal(player.state.master.realm, before.master.realm + 1);
      assert.equal(player.state.master.xp, 0);
      assert.equal(player.state.master.wound, 0);
    }
    assert.equal(player.state.master.breakthroughHistory.length, 1);
  }
  assert.deepEqual(outcomes, new Set([true, false]));
});
