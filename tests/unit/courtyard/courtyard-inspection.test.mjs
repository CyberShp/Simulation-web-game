import test from 'node:test';
import assert from 'node:assert/strict';
import { createSectSession, commandSect, advanceSect, viewSect, snapshotSect, restoreSect } from '../../../apps/courtyard/sect-sim.mjs';
import { buildSectSeed } from '../../../apps/courtyard/sect-seed-build.mjs';
import { inspectCourtyard } from '../../../apps/courtyard/courtyard-inspection.mjs';
import { dispatchCommand } from '../../../src/simulation/ea-opening-sim.mjs';
import { spatialAccess } from '../../../src/simulation/ea-sr-spatial.mjs';

const MASTER = 'person:master';
function until(session, predicate, limit = 2400) {
  for (let i = 0; i < limit && !predicate(); i++) advanceSect(session, .1);
  assert.ok(predicate(), 'formal activity must reach the observed condition');
}

test('four public same-scene people keep their identities without revealing remote NPCs or changing the world', () => {
  const session = createSectSession({ source: buildSectSeed() });
  const before = snapshotSect(session), projected = viewSect(session);
  const inspected = inspectCourtyard(session, projected);
  assert.equal(inspected.people.length, 4);
  assert.deepEqual(inspected.people.map(person => person.id), projected.people.map(person => person.id));
  assert.equal(inspected.people.some(person => person.id === 'person:great:guiyuan:hidden'), false);
  assert.ok(inspected.people.every(person => person.name && person.activityLabel && person.location.focus));
  assert.deepEqual(snapshotSect(session), before);
  inspected.people[0].location.focus.x = -999;
  inspected.buildings[0].slots[0].name = 'changed projection';
  assert.deepEqual(snapshotSect(session), before, 'all returned data are detached from the simulation');
});

test('a real indoor station is queryable; locating it uses the entrance and survives exact restore', () => {
  const session = createSectSession();
  assert.equal(commandSect(session, { type: 'cultivate' }).ok, true);
  advanceSect(session, 1);
  const heading = inspectCourtyard(session);
  const first = heading.people.find(person => person.id === MASTER);
  assert.notEqual(first.location.kind, 'indoor');
  assert.ok(heading.buildings.find(building => building.type === 'hall').incoming.some(person => person.id === MASTER));
  until(session, () => {
    const inspected = inspectCourtyard(session);
    return inspected.people.find(person => person.id === MASTER).location.kind === 'indoor' &&
      inspected.buildings[0].slots.some(slot => slot.personId === MASTER && slot.status === 'occupied');
  });
  const before = snapshotSect(session), inspected = inspectCourtyard(session), hall = inspected.buildings.find(building => building.type === 'hall');
  const person = inspected.people.find(person => person.id === MASTER);
  assert.equal(person.location.buildingId, hall.id);
  assert.deepEqual(person.location.focus, spatialAccess(session.state.buildings[0]));
  assert.notDeepEqual(person.location.focus, { x: session.state.master.scenic.x, y: session.state.master.scenic.y });
  assert.ok(hall.occupants.some(item => item.id === MASTER));
  assert.equal(hall.incoming.some(item => item.id === MASTER), false);
  assert.ok(hall.slots.some(slot => slot.personId === MASTER && slot.name.startsWith('蒲团') && slot.status === 'occupied'));
  assert.equal(hall.slots.length, 13, 'rest and healing share physical beds rather than counting twice');
  assert.deepEqual(snapshotSect(session), before);
  assert.deepEqual(inspectCourtyard(restoreSect(before)), inspected);
});

test('accepted field work appears at its real outdoor station, without issuing work from inspection', () => {
  const session = createSectSession();
  assert.equal(commandSect(session, { type: 'transport', sourceStockpileId: 'stockpile:yunxiu',
    targetStockpileId: 'stockpile:building:yunxiu:2', cargo: { herb: 2 } }).ok, true);
  assert.match(inspectCourtyard(session).people.find(person => person.id === MASTER).activityLabel, /搬运/);
  until(session, () => session.state.activitiesById[session.state.master.activityId]?.kind !== 'sr-transport');
  const result = dispatchCommand(session.state, { name: 'inviteWork', args: ['person:lu-zhiwei', 'building:yunxiu:2'] });
  assert.equal(result.result.accepted, true);
  session.state = result.state;
  until(session, () => inspectCourtyard(session).buildings.find(building => building.type === 'farm')
    .slots.some(slot => slot.personId === 'person:lu-zhiwei' && slot.status === 'occupied'));
  const before = snapshotSect(session), inspection = inspectCourtyard(session);
  const farm = inspection.buildings.find(building => building.type === 'farm');
  const worker = inspection.people.find(person => person.id === 'person:lu-zhiwei');
  assert.equal(worker.indoor, false);
  assert.equal(worker.location.buildingId, farm.id);
  assert.ok(farm.occupants.some(person => person.id === worker.id));
  assert.deepEqual(worker.location.focus, { x: session.state.personsById[worker.id].mind.scenic.x, y: session.state.personsById[worker.id].mind.scenic.y });
  assert.notDeepEqual(worker.location.focus, spatialAccess(session.state.buildings[1]));
  assert.deepEqual(snapshotSect(session), before);
});

test('private learning details stay private even when the scene view contains an internal activity reason', () => {
  const session = createSectSession(), person = session.state.personsById['person:lu-zhiwei'];
  // An isolated knowledge fixture tests disclosure, not an attainable gameplay path.
  person.mind.activity = 'study';
  person.mind.learning = { id: 'wood', progress: 7, total: 40 };
  person.mind.reason = '作者暗线：偷学私传卷';
  session.state.doctrine.sealed.push('wood');
  const view = viewSect(session), before = snapshotSect(session);
  const row = inspectCourtyard(session, view).people.find(item => item.id === person.personId);
  assert.equal(row.detail, '独处参悟，暂不愿详谈。');
  assert.equal(row.activityDetail.progress, null);
  assert.equal(JSON.stringify(row).includes('偷学'), false);
  assert.deepEqual(snapshotSect(session), before);
});
