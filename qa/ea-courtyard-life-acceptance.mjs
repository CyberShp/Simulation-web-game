/** SR-XF-004/005/006: earned courtyard actions through the production gateway.
 * Run with Node. Optional --output-dir must point outside the repository.
 * Reports simulation facts; browser interaction and device experience are separate.
 */
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import * as S from '../dist/ea-opening-sim.mjs';
import {spatialSlots, spatialAccess, spatialPrefab, spatialTransform, spatialProject, meterCanStand, meterFindPath} from '../dist/ea-sr-spatial.mjs';
import {restRenderAnchor} from '../dist/ea-character-art.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

export function runCourtyardLife(invitation = 'invite') {
  const h = normalOpening(invitation);
  const checks = [];
  const identity = Object.fromEntries(Object.values(h.s.personsById).map(p => [p.personId, {name:p.name, appearance:structuredClone(p.appearance)}]));
  const body = () => h.s.activitiesById[h.s.master.activityId];
  const master = () => h.s.master.scenic;
  const check = label => { h.save(); checks.push({label, worldTick:h.s.worldTick}); };
  const pause = label => {
    h.act('setSpeed', 0);
    const frozen = JSON.stringify(h.s);
    S.tick(h.s, 30);
    assert.equal(JSON.stringify(h.s), frozen, `${label}: global pause keeps the exact state`);
    h.save();
    h.act('setSpeed', 1);
  };

  check('normal opening, voluntary membership, real harvest delivery and study');
  h.act('masterAction', 'rest');
  h.until(() => body()?.action === 'rest' && body().phase === 'navigating', 'rest has a real route');
  const energyBeforeWalking = h.s.master.energy;
  pause('walking to a bed');
  h.until(() => {
    assert(meterCanStand(h.s, master()), 'rest route stays on walkable floor');
    if (body()?.phase !== 'executing') assert(h.s.master.energy <= energyBeforeWalking + 1e-8, 'walking cannot earn bed recovery');
    return body()?.action === 'rest' && body().phase === 'executing';
  }, 'actual bed arrival');
  const restActivity = body();
  const bedBuilding = h.s.buildingsById[restActivity.targetId];
  const bedSlot = spatialSlots(bedBuilding, 'rest').find(slot => slot.id === restActivity.slotId);
  assert(bedSlot, 'rest refers to a physical bed slot');
  assert(Math.hypot(master().x-bedSlot.position.x, master().y-bedSlot.position.y) < .04);
  assert.notDeepEqual(bedSlot.position, spatialAccess(bedBuilding), 'bed position is inside the building');
  assert.equal(h.s.reservationsById[restActivity.reservationId].slotId, bedSlot.id);
  const beforeProjection = JSON.stringify(h.s);
  const restAnchor = restRenderAnchor(h.s, h.s.master, {prefab:spatialPrefab, transform:spatialTransform, project:spatialProject, camera:{scale:32, depth:.65, ox:0, oy:0, rotation:Math.PI/4}});
  assert.equal(restAnchor?.poseVariant, 'bed-rest', 'the normal live reservation produces the adult bed pose');
  assert.equal(restAnchor.slotId, bedSlot.id);
  assert.equal(JSON.stringify(h.s), beforeProjection, 'the visible rest pose is read-only');
  const energyAtBed = h.s.master.energy;
  pause('using a bed');
  h.until(s => s.master.energy > energyAtBed, 'bed recovers energy after actual arrival');
  check('rest walks to an exclusive physical bed; paused walking and resting survive exact reload');

  // Fund the displayed relocation cost by harvesting, transporting and trading.
  h.resources({jade:20, wood:16, food:40});
  h.rest();
  const building = h.s.buildings.find(b => b.type === 'lumber');
  const buildingId = building.instanceId;
  const from = {...building.transform};
  const target = S.recommendedPlacement(h.s, building.type);
  assert(target, 'a legal relocation site is available');
  const resourcesBefore = {...h.s.resources};
  const cancelOrder = h.act('relocate', building.id, target.x, target.y);
  assert.deepEqual(h.s.buildingsById[buildingId].transform, from, 'planning retains the source building');
  assert.equal(h.s.workOrdersById[cancelOrder.workOrderId].progressTicks, 0);
  pause('relocation before work');
  const cancel = h.act('cancelConstruction');
  assert.deepEqual(h.s.resources, resourcesBefore, 'cancel before work returns all reserved resources');
  assert.deepEqual(h.s.buildingsById[buildingId].transform, from);
  assert.equal(h.s.buildingsById[buildingId].spatialLock, undefined);
  assert(!h.s.workOrdersById[cancelOrder.workOrderId]);
  assert(Object.values(cancel.refund).some(q => q > 0), 'the cancellation actually refunds a reservation');
  h.act('cancelConstruction');
  assert.deepEqual(h.s.resources, resourcesBefore, 'repeated cancellation has no second refund');
  check('normal relocation cancellation preserves the building and refunds its reservation once');

  const relocationCount = h.s.stats.relocated;
  const order = h.act('relocate', building.id, target.x, target.y);
  h.until(s => (s.workOrdersById[order.workOrderId]?.progressTicks || 0) > 0, 'worker reaches the relocation site');
  assert.deepEqual(h.s.buildingsById[buildingId].transform, from, 'the original position persists while working');
  pause('relocation in progress');
  h.until(s => {
    assert(meterCanStand(s, master()), 'construction worker stays at a safe position');
    return !s.workOrdersById[order.workOrderId];
  }, 'relocation completes after real work');
  const relocated = h.s.buildingsById[buildingId];
  assert.equal(h.s.stats.relocated, relocationCount + 1);
  assert.deepEqual(relocated.transform, {...target, orientation:'south'});
  assert.equal(h.s.buildings.filter(b => b.instanceId === buildingId).length, 1);
  assert(!Object.values(h.s.reservationsById).some(r => r.activityId === order.activityId));
  assert.notEqual(meterFindPath(h.s, master(), spatialAccess(relocated), {maxSnap:0}), null, 'the new entrance is reachable');
  h.walk(spatialAccess(relocated).x, spatialAccess(relocated).y);
  check('relocation resumes after pause and reload, preserves one identity and exposes a reachable new entrance');

  for (const [id, expected] of Object.entries(identity)) {
    const person = h.s.personsById[id];
    assert(person, `person ${id} remains registered`);
    assert.deepEqual({name:person.name, appearance:person.appearance}, expected);
  }
  return {state:h.s, report:{invitation, ...h.counts, checks, provenance:'new SR world and public commands', notCovered:['browser pointer and touch interaction','target-device FPS','first-player experience','complete SR closure']}};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const option = process.argv.indexOf('--output-dir');
  let output = null;
  if (option !== -1) {
    assert(process.argv[option+1], '--output-dir requires a path');
    output = resolve(process.argv[option+1]);
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const rel = relative(root, output);
    assert(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel), 'QA output belongs outside the source repository');
    mkdirSync(output, {recursive:true});
  }
  const reports = [];
  for (const invitation of ['invite','decline']) {
    const result = runCourtyardLife(invitation);
    reports.push(result.report);
    if (output) writeFileSync(resolve(output, `courtyard-${invitation}.json`), JSON.stringify(result.state));
  }
  const report = {suite:'courtyard public life', gameVersion:S.GAME_VERSION, schemaVersion:S.SCHEMA_VERSION, scenarios:reports};
  if (output) writeFileSync(resolve(output, 'courtyard-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
