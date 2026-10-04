import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-sim.mjs';
import { Player } from '../qa/ea-player.mjs';
import { normalRun } from '../qa/ea-normal-play.mjs';
import { facilityRecords, scenicHomeActors } from '../dist/ea-scene-state.mjs';
import { scenicPoint, scenicCanStand, scenicFindPath, scenicSweep, geometryRevision, buildingAccess } from '../dist/ea-scene-geometry.mjs';
import { sceneInteractionTarget, requestSceneInteraction, sceneInteractionReady } from '../dist/ea-interactions.mjs';
import { initNarrative, narrativeForState, acknowledgeNarrative, setNarrativePage } from '../dist/ea-narrative.mjs';
import { personLifeSummary, workOpportunity } from '../dist/ea-life.mjs';
import { createRuntimeClock } from '../dist/ea-runtime.mjs';
import { appearance } from '../dist/ea-scenic.mjs';

let chapterCache, fullCache;
const chapter = () => structuredClone(chapterCache ||= new Player().chapterOne().state);
const full = () => structuredClone(fullCache ||= normalRun({ reference: true }).state);

test('full real estate uses exact plot addresses and every physical entrance is reachable without sweeping through a building', () => {
  const s = full(), before = structuredClone(s), records = facilityRecords(s);
  assert.equal(records.length, 40);
  for (const record of records) {
    assert.deepEqual(record.position, scenicPoint(record.building.x, record.building.y));
    assert.equal(scenicCanStand(s, record.access), true, `Entrance for ${record.id}`);
    const path = scenicFindPath(s, { x: 840, y: 217 }, record.access);
    assert.ok(path, `Road to ${record.id}`);
    let point = { x: 840, y: 217 };
    for (const next of path) { assert.equal(scenicSweep(s, point, next).blocked, false); point = next; }
  }
  assert.deepEqual(s, before, 'Geometry and scene reads do not mutate a live world');
});

test('moving a real duplicate facility changes its plot, access and geometry revision, while failed placement costs nothing', () => {
  const p = new Player(chapter()), first = p.state.buildings.find(x => x.type === 'farm'), second = p.build('farm');
  const original = facilityRecords(p.state).find(x => x.id === second.id), revision = geometryRevision(p.state);
  p.resources({ jade: 10, wood: 8 });
  const cell = S.CELLS.find(({ x, y }) => !S.placementLock(p.state, 'farm', x, y, second.id) && (x !== second.x || y !== second.y));
  p.action('relocate', second.id, cell.x, cell.y);
  const moved = facilityRecords(p.state).find(x => x.id === second.id);
  assert.notDeepEqual(moved.position, original.position); assert.notDeepEqual(moved.access, original.access);
  assert.notEqual(geometryRevision(p.state), revision);
  const before = structuredClone(p.state);
  assert.throws(() => p.action('relocate', second.id, first.x, first.y));
  assert.deepEqual(p.state, before);
  assert.deepEqual(facilityRecords(S.validateSave(p.state)), facilityRecords(p.state));
});

test('an interaction cannot complete at a stale entrance after its facility is moved', () => {
  const p = new Player(chapter()), farm = p.state.buildings.find(x => x.type === 'farm');
  p.resources({ jade: 10, wood: 8 });
  requestSceneInteraction(p.state, 'building', farm.id, 'production');
  const oldAccess = { ...sceneInteractionTarget(p.state, 'building', farm.id).position };
  p.until(s => s.master.action !== 'walk', { limit: 100, chunk: 1, reason: 'Actually approach the original facility entrance' });
  assert.ok(sceneInteractionReady(p.state), 'Original entrance is physically reachable before relocation');
  const cell = S.CELLS.find(({ x, y }) => !S.placementLock(p.state, 'farm', x, y, farm.id) && Math.hypot(scenicPoint(x, y).x - oldAccess.x, scenicPoint(x, y).y + 24 - oldAccess.y) > 70);
  assert.ok(cell, 'A distant legal new plot exists'); p.action('relocate', farm.id, cell.x, cell.y);
  // The actor reached the original entrance through a public command; readiness
  // must now use the current facility entrance, rather than the saved intent.
  const ready = sceneInteractionReady(p.state);
  assert.ok(!ready || ready.cancelled, 'The old entrance cannot execute interaction for a relocated facility');
  assert.deepEqual(sceneInteractionTarget(p.state, 'building', farm.id).position, buildingAccess(p.state, farm));
});

test('interaction whose object is stopped or demolished cancels without producing a remote action', () => {
  const p = new Player(chapter()), library = p.state.buildings.find(x => x.type === 'library');
  requestSceneInteraction(p.state, 'building', library.id, 'manuals');
  p.action('toggleBuilding', library.id);
  assert.equal(sceneInteractionReady(p.state)?.cancelled, true);
  p.action('toggleBuilding', library.id); requestSceneInteraction(p.state, 'building', library.id, 'manuals');
  p.action('demolish', library.id);
  assert.equal(p.state.master.sceneIntent, null, 'Demolition proactively clears an intent attached to its exact ID');
  assert.equal(sceneInteractionReady(p.state), null, 'No removed-facility action remains ready to execute');
});

test('narrative progress is pure acknowledgment, resumes the exact page, and never grants or advances twice', () => {
  const player = new Player(); initNarrative(player.state); player.action('acknowledgeIntro'); player.chapterOne(); const s = player.state;
  const pending = narrativeForState(s).pending; assert.ok(pending);
  const before = structuredClone(s), page = Math.min(1, pending.pages.length - 1);
  setNarrativePage(s, pending.id, page);
  const copy = S.validateSave(s); assert.equal(narrativeForState(copy).pending.cursor, page);
  acknowledgeNarrative(s, pending.id); assert.equal(acknowledgeNarrative(s, pending.id), false);
  assert.equal(s.story.step, before.story.step); assert.deepEqual(s.resources, before.resources);
  assert.deepEqual(s.story.claimed, before.story.claimed); assert.deepEqual(s.disciples, before.disciples);
  const after = structuredClone(s); assert.throws(() => acknowledgeNarrative(s, 'chapter:9')); assert.deepEqual(s, after);
});

test('read-only life reasons and work opportunities cannot reveal an away follower at home', () => {
  const p = new Player(chapter()), farmer = p.state.disciples[0], farm = p.state.buildings.find(x => x.type === 'farm');
  const snapshot = structuredClone(p.state); personLifeSummary(p.state, farmer); workOpportunity(p.state, farmer, farm.id); assert.deepEqual(p.state, snapshot);
  p.action('toggleBuilding', farm.id); assert.match(workOpportunity(p.state, farmer, farm.id).reason, /停用/);
  p.action('toggleBuilding', farm.id); p.rest();
  const follower = S.companionOptions(p.state, 'quarry').find(x => x.willing); assert.ok(follower);
  p.action('startExploration', 'quarry', { companionIds: [follower.id] });
  const person = p.state.disciples.find(x => x.id === follower.id);
  assert.equal(personLifeSummary(p.state, person).status, 'away');
  assert.ok(!scenicHomeActors(p.state).some(x => x.id === follower.id));
  assert.match(workOpportunity(p.state, person, farm.id).reason, /山外/);
});

test('long hidden-page interval advances neither a pending journey nor its deterministic simulation', () => {
  const p = new Player(chapter()); p.rest(); p.action('startExploration', 'valley');
  const before = structuredClone(p.state), clock = createRuntimeClock(); clock.next(100); clock.suspend();
  S.tick(p.state, clock.next(10000000).dt); clock.resume(10000000); S.tick(p.state, clock.next(10000000).dt);
  assert.deepEqual(p.state, before);
  assert.equal(clock.next(Infinity).dt, 0); assert.equal(clock.next(20000000).dt, 0);
  S.tick(p.state, clock.next(20000100).dt); assert.equal(p.state.time, before.time, 'Fractional visible time does not fabricate a whole simulation second');
  assert.ok(p.state.sim.carry > before.sim.carry);
});

test('actual willing companion identity and actual damage feedback survive scene changes and interruption', () => {
  const p = new Player(chapter()); p.rest();
  const follower = S.companionOptions(p.state, 'quarry').find(x => x.willing); assert.ok(follower);
  p.action('startExploration', 'quarry', { companionIds: [follower.id] });
  p.until(s => s.world.exploration.status === 'exploring', { limit: 100, chunk: 1 });
  const traveling = S.getCampaignScene(p.state).allies.find(x => x.id === follower.id);
  assert.equal(traveling.appearance, appearance(follower.id));
  p.action('moveExploration', 8, 4); p.until(s => S.explorationOptions(s).active.canInteract, { limit: 30, chunk: 1 });
  p.action('resolveExploration', 'defend');
  const scene = S.getCampaignScene(p.state), ally = scene.allies.find(x => x.id === follower.id);
  assert.equal(ally.name, traveling.name); assert.equal(ally.appearance, traveling.appearance);
  assert.ok(!scenicHomeActors(p.state).some(x => x.id === follower.id));
  const enemy = p.state.combat.enemies[0], hp = enemy.hp;
  p.action('combatAction', 'spell', enemy.id);
  const hit = p.state.combat.effects.find(x => x.kind === 'hit' && x.targetId === enemy.id);
  assert.ok(hit); assert.equal(hit.amount, hp - enemy.hp);
  const unchanged = structuredClone(p.state); assert.throws(() => p.action('combatAction', 'spell', enemy.id)); assert.deepEqual(p.state, unchanged);
  const restored = S.validateSave(p.state); assert.deepEqual(S.getCampaignScene(restored), S.getCampaignScene(p.state));
  S.tick(restored, 1); p.tick(1); assert.deepEqual(restored, p.state);
  const obstacle = S.getCampaignScene(p.state).obstacles[0], snapshot = structuredClone(p.state);
  assert.throws(() => p.action('combatAction', 'move', { x: obstacle.x + obstacle.w / 2, y: obstacle.y + obstacle.h / 2 }));
  assert.deepEqual(p.state, snapshot, 'Blocked ground rejects without changing destination, qi, effects or rewards');
  assert.ok(p.state.combat.effects.length <= 24);
});
