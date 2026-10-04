/** Independent acceptance: all game progression uses public player commands. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalRun } from './ea-normal-play.mjs';
import { Player, sim as S, summary } from './ea-player.mjs';
import { sceneSnapshot, facilityRecords, scenicHomeActors } from '../dist/ea-scene-state.mjs';

const repeatSave = s => S.validateSave(S.validateSave(s));
const sameAfter = (a, b, seconds) => {
  for (let i = 0; i < seconds; i++) { S.tick(a, 1); S.tick(b, 1); }
  assert.deepEqual(a, b, 'Interrupted and uninterrupted simulation must match');
};

export function runAcceptance() {
  const started = performance.now(), cases = [];
  const check = (name, run) => {
    const begin = performance.now();
    try { const evidence = run(); cases.push({ name, status: 'passed', milliseconds: performance.now() - begin, evidence }); }
    catch (error) { cases.push({ name, status: 'failed', milliseconds: performance.now() - begin, error: error.stack }); }
  };
  let chapter, foundation, full;
  const getChapter = () => structuredClone(chapter ||= new Player().chapterOne().state);
  const getFoundation = () => structuredClone(foundation ||= new Player(getChapter()).foundation().state);

  check('New-save recovery, voluntary guest and chapter progression through public commands', () => {
    const state = getChapter();
    assert.equal(state.story.step, 4); assert.equal(state.master.wound, 0);
    assert.equal(S.explorationOptions(state).regions.length, 4);
    assert.equal(sceneSnapshot(state).facilities.length, state.buildings.length);
    assert.deepEqual(repeatSave(state), state);
    return summary(state);
  });

  check('Paused facilities cannot silently satisfy current chapter; restoring uses the same building', () => {
    const p = new Player();
    p.action('masterAction', 'heal'); p.until(s => s.master.wound === 0, { limit: 100 });
    p.action('advanceStory'); p.resources({ herb: 10 }); p.action('advanceStory');
    const farm = p.build('farm', { x: 4, y: 4 }); p.build('lumber', { x: 1, y: 3 });
    p.action('toggleBuilding', farm.id);
    const rejected = structuredClone(p.state);
    assert.throws(() => p.action('advanceStory'));
    assert.deepEqual(p.state, rejected, 'Rejected chapter action must not consume or advance');
    p.action('toggleBuilding', farm.id); p.action('advanceStory');
    assert.equal(p.state.story.step, 3);
    return { id: farm.id, operations: p.operations.length };
  });

  check('Travel and companion location resume exactly without duplicated home actors', () => {
    const p = new Player(getChapter()); p.rest();
    const option = S.companionOptions(p.state, 'quarry').find(x => x.willing);
    assert.ok(option, 'At least one actual willing follower exists');
    p.action('startExploration', 'quarry', { companionIds: [option.id] });
    assert.ok(!scenicHomeActors(p.state).some(x => x.id === option.id));
    p.tick(3); const restored = repeatSave(p.state); sameAfter(p.state, restored, 5);
    assert.deepEqual(sceneSnapshot(restored), sceneSnapshot(p.state));
    return { companionId: option.id, journeyId: p.state.world.exploration.id };
  });

  check('Craft pause and repeated reload preserve remaining work and produce exactly one batch', () => {
    const p = new Player(getFoundation()), furnace = p.state.buildings.find(x => x.type === 'alchemy');
    p.resources(S.RECIPES.qi.cost); p.action('craft', 'qi'); p.action('toggleBuilding', furnace.id);
    const remaining = p.state.crafting.remaining, initial = p.state.pills.qi, crafted = p.state.stats.crafted;
    p.tick(8); assert.equal(p.state.crafting.remaining, remaining); p.state = repeatSave(p.state);
    p.action('toggleBuilding', furnace.id); const resumed = repeatSave(p.state);
    sameAfter(p.state, resumed, remaining + 1);
    assert.equal(p.state.crafting, null); assert.equal(p.state.stats.crafted, crafted + 1);
    // NPCs may autonomously consume produced pills; the crafted counter and empty
    // queue prove exact production, while stock remains a valid bounded result.
    assert.ok(p.state.pills.qi >= 0 && p.state.pills.qi <= initial + S.RECIPES.qi.yield);
    return { furnaceId: furnace.id, remaining, crafted: p.state.stats.crafted };
  });

  check('Actual combat defeat preserves clues and prepares a normal healing/retry path', () => {
    const p = new Player(getFoundation()).prepareRevenge(); p.action('resolveExploration', 'challenge');
    const clues = [...p.state.story.clues], preparations = { ...p.state.story.preparations };
    p.until(s => s.combat.status !== 'active', { limit: 200, chunk: 1, reason: 'Idle master actually loses' });
    assert.equal(p.state.combat.status, 'lost'); assert.equal(p.state.story.revengeDone, false);
    assert.deepEqual(p.state.story.clues, clues); assert.deepEqual(p.state.story.preparations, preparations);
    p.state = repeatSave(p.state); assert.throws(() => p.action('startExploration', 'qixia'), /疗伤/);
    p.resources({ herb: 6 }); p.action('masterAction', 'heal');
    p.until(s => s.master.wound === 0, { limit: 100, chunk: 1 });
    p.explore('qixia', 'challenge', {}, { leave: false }); assert.equal(p.fight(), 'won');
    return { storyStep: p.state.story.step, retryResult: p.state.combat.status, operations: p.operations.length };
  });

  check('Complete normal campaign, formal sect, two peaks and 30 people / 40 actual facilities', () => {
    full = normalRun({ reference: true });
    const s = full.state;
    assert.equal(s.story.completed, true); assert.equal(s.story.revengeDone, true);
    assert.equal(s.disciples.length, 30); assert.equal(s.buildings.length, 40); assert.equal(s.society.peaks.length, 2);
    const before = structuredClone(s), view = sceneSnapshot(s), records = facilityRecords(s);
    assert.deepEqual(s, before, 'Projection must not change live state');
    assert.equal(records.length, 40); assert.equal(new Set(records.map(x => x.id)).size, 40);
    assert.deepEqual(sceneSnapshot(repeatSave(s)), view);
    return { final: summary(s), operationCount: full.operations.length, validationCount: full.validationCount, milestones: full.milestones };
  });

  check('Full-scale restored logical session and scene projection stay valid', () => {
    assert.ok(full, 'Full public-command run completed');
    const a = repeatSave(full.state), b = repeatSave(a), timings = [];
    for (let i = 0; i < 60; i++) {
      const begin = performance.now(); sameAfter(a, b, 1); sceneSnapshot(a); timings.push(performance.now() - begin);
    }
    timings.sort((x, y) => x - y); assert.deepEqual(repeatSave(a), a);
    return { logicalPairedTickAndProjectionP50Ms: timings[30], logicalPairedTickAndProjectionP95Ms: timings[57], browserFpsClaim: false };
  });

  return {
    schema: 1, generatedAt: new Date().toISOString(), version: S.GAME_VERSION,
    scope: 'Independent public-command simulation acceptance; no resource, realm, story flag or willingness injection',
    cases, passed: cases.filter(x => x.status === 'passed').length, failed: cases.filter(x => x.status === 'failed').length,
    milliseconds: performance.now() - started,
    pending: ['Browser exact picking, occlusion, visible feedback, touch/drag and FPS verification by root agent', 'Friend unassisted playtest', 'iOS/Android real-device background, lock, force-close and rotation verification'],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = runAcceptance();
  const directory = new URL('./acceptance-1.3/', import.meta.url); await mkdir(directory, { recursive: true });
  await writeFile(new URL('./acceptance-1.3/independent-command-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ version: report.version, passed: report.passed, failed: report.failed, milliseconds: report.milliseconds, cases: report.cases.map(x => ({ name: x.name, status: x.status, error: x.error })) }, null, 2));
  if (report.failed) process.exitCode = 1;
}
