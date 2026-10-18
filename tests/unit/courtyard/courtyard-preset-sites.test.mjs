import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import { createSectSession, commandSect, advanceSect, viewSect, snapshotSect, restoreSect } from '../../../apps/courtyard/sect-sim.mjs';
import { CourtyardRenderer } from '../../../apps/courtyard/courtyard-renderer.mjs';

const WEST = 'site:domain:west-lumber-1', EAST = 'site:domain:east-residence-1';
const site = (session, id) => viewSect(session).domain.plannedSites.find(value => value.id === id);
const request = (session, input) => { const result = commandSect(session, input); assert.equal(result.ok, true, result.error); return result; };
function opened() {
  const session = createSectSession();
  request(session, { type: 'enable-domain' });
  request(session, { type: 'enable-courtyard-terrain' });
  return session;
}
function until(session, predicate, limit = 1800) {
  for (let step = 0; step < limit && !predicate(session); step++) advanceSect(session, .1);
  assert.ok(predicate(session), session.reason);
}

test('the plan exposes 31 unique sites and reads existing entities without changing the world', () => {
  const session = createSectSession(), before = snapshotSect(session), view = viewSect(session);
  assert.equal(view.domain.plannedSites.length, 31);
  assert.equal(new Set(view.domain.plannedSites.map(value => value.id)).size, 31);
  assert.deepEqual(view.domain.plannedSites.map(value => value.planId), Array.from({ length: 31 }, (_, index) => `GC-${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual([...new Set(view.domain.plannedSites.map(value => value.zoneId))], ['Z-01', 'Z-02', 'Z-03']);
  for (const [id, type] of [['site:domain:original-hall', 'hall'], ['site:domain:original-farm', 'farm']]) {
    const projected = view.domain.plannedSites.find(value => value.id === id);
    assert.equal(projected.status, 'complete');
    assert.equal(projected.buildingId, session.state.buildings.find(value => value.type === type).instanceId);
  }
  assert.equal(view.domain.sites[0].id, EAST);
  assert.equal(site(session, EAST).capacityText, '4张常住床');
  assert.equal(site(session, WEST).capacityText, '2处作业工位');
  assert.equal(site(session, WEST).capacity.beds, 0);
  assert.deepEqual(snapshotSect(session), before);
});

test('an old east save keeps its boundary until the public expansion command opens the west', () => {
  const session = createSectSession(), before = snapshotSect(session);
  assert.deepEqual(viewSect(session).bounds, { x: 0, y: 0, width: 160, height: 96 });
  assert.equal(site(session, EAST).status, 'available');
  assert.equal(site(session, WEST).status, 'locked');
  assert.match(site(session, WEST).buildAvailable.reason, /西林通路/);
  request(session, { type: 'enable-domain' });
  assert.deepEqual(viewSect(session).bounds, { x: -34, y: 0, width: 194, height: 96 });
  assert.equal(site(session, WEST).buildAvailable.available, true);
  assert.deepEqual(session.state.personsById, before.state.personsById);
  assert.deepEqual(session.state.stockpilesById, before.state.stockpilesById);
  assert.equal(session.state.worldTick, before.state.worldTick);
  request(session, { type: 'move', x: -16, y: 32.6 });
  assert.equal(session.state.master.scenic.goal.x, -16);
});

test('planning sites and missing materials are rejected atomically through the public gateway', () => {
  const session = opened(), before = snapshotSect(session);
  const planning = viewSect(session).domain.plannedSites.filter(value => value.status === 'planning');
  // GC03 and GC25/26 now have registered runtime sites; their roads remain explicit.
  assert.equal(planning.length, 14);
  assert.deepEqual(planning.map(value=>value.planId),['GC-04','GC-05','GC-06','GC-07','GC-08','GC-15','GC-21','GC-22','GC-23','GC-27','GC-28','GC-29','GC-30','GC-31']);
  const library=site(session,'site:domain:gc-02');
  assert.equal(library.supported,true);
  assert.equal(library.status,'locked');
  assert.equal(library.buildAvailable.available,false);
  assert.match(library.buildAvailable.reason,/北台/);
  assert.throws(()=>SIM.dispatchCommand(session.state,{name:'buildDomainSite',args:[library.id]}),/北台/);
  const meditation=site(session,'site:domain:gc-03');
  assert.equal(meditation.supported,true);assert.equal(meditation.status,'locked');assert.equal(meditation.buildAvailable.available,false);assert.match(meditation.buildAvailable.reason,/聚灵台山道/);
  assert.throws(()=>SIM.dispatchCommand(session.state,{name:'buildDomainSite',args:[meditation.id]}),/聚灵台地通路/);
  const workshops=['site:domain:gc-25','site:domain:gc-26'].map(id=>site(session,id));
  for(const target of workshops){assert.equal(target.supported,true);assert.equal(target.status,'locked');assert.equal(target.buildAvailable.available,false);assert.match(target.buildAvailable.reason,/丹房与百工坊道路/);assert.throws(()=>SIM.dispatchCommand(session.state,{name:'buildDomainSite',args:[target.id]}),target.type==='workshop'?/需山院初成/:/西谷双院通路/);}
  const valley = viewSect(session).domain.plannedSites.filter(value => value.valleySite);
  assert.equal(valley.length, 4);
  assert.ok(valley.every(value => value.status === 'locked' && !value.buildAvailable.available));
  const residences = ['site:domain:gc-10', 'site:domain:gc-11', 'site:domain:gc-12'].map(id => site(session, id));
  assert.ok(residences.every(value => value.status === 'locked' && !value.buildAvailable.available));
  assert.ok(residences.every(value => /住宅道路/.test(value.buildAvailable.reason)));
  const services = ['site:domain:gc-13', 'site:domain:gc-14'].map(id => site(session, id));
  assert.ok(services.every(value => value.supported && value.status === 'locked' && !value.buildAvailable.available));
  assert.ok(services.every(value => /膳房|医庐|生活院/.test(value.buildAvailable.reason)));
  for (const target of services) assert.throws(() => SIM.dispatchCommand(session.state, { name: 'buildDomainSite', args: [target.id] }), target.type === 'clinic' ? /需山院初成/ : /生活院通路/);
  assert.ok(planning.some(value => value.type === null));
  for (const target of planning) {
    assert.equal(target.buildAvailable.available, false);
    assert.equal(target.entrance, null);
    assert.throws(() => SIM.dispatchCommand(session.state, { name: 'buildDomainSite', args: [target.id] }), /筹备/);
  }
  assert.equal(site(session, EAST).buildAvailable.available, false);
  assert.deepEqual(site(session, EAST).missingCost, { wood: 15 });
  const refused = commandSect(session, { type: 'build-site', siteId: EAST });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /不足|材料/);
  assert.deepEqual(snapshotSect(session), before);
});

test('west construction projects its real cargo, supports exact reload and returns unused materials', () => {
  const session = opened();
  request(session, { type: 'build-site', siteId: WEST });
  const start = site(session, WEST);
  assert.equal(start.status, 'building');
  assert.equal(start.materialFlow.requiredQuantity, 28);
  assert.equal(start.buildAvailable.available, false);
  until(session, current => Object.values(current.state.workOrdersById).some(order => order.domainSiteId === WEST && order.materialFlow?.phase === 'carrying'));
  const saved = snapshotSect(session), loaded = restoreSect(saved);
  assert.deepEqual(snapshotSect(loaded), saved);
  assert.deepEqual(site(loaded, WEST), site(session, WEST));
  request(session, { type: 'cancel-activity' });
  assert.equal(site(session, WEST).materialFlow.cancelRequested, true);
  until(session, current => !Object.values(current.state.workOrdersById).some(order => order.domainSiteId === WEST));
  assert.equal(site(session, WEST).status, 'available');
  assert.equal(session.state.stockpilesById['stockpile:yunxiu'].resources.wood, 25);
  assert.equal(session.state.stockpilesById['stockpile:yunxiu'].resources.stone, 25);
  const beforeSecondCancel = snapshotSect(session);
  assert.equal(commandSect(session, { type: 'cancel-activity' }).ok, true);
  assert.deepEqual(session.state.stockpilesById, beforeSecondCancel.state.stockpilesById);
});

test('completed west lumber links its actual two work positions and production stockpile', () => {
  const session = opened();
  request(session, { type: 'build-site', siteId: WEST });
  until(session, current => current.state.buildings.some(value => value.type === 'lumber'));
  const view = viewSect(session), completed = view.domain.sites.find(value => value.id === WEST);
  assert.equal(completed.status, 'complete');
  assert.equal(completed.capacity.work, 2);
  assert.equal(completed.capacity.beds, 0);
  assert.equal(completed.completedCapacity, 0);
  assert.equal(session.state.buildingsById[completed.buildingId].transform.x, -18);
  const workplace = view.operations.workplaces.find(value => value.buildingId === completed.buildingId);
  assert.equal(workplace.availability.available, true);
  assert.ok(view.operations.inventory.stockpiles.some(value => value.id === workplace.stockpileId));
  const renderer = new CourtyardRenderer({ getContext: () => ({}), getBoundingClientRect: () => ({ width: 1672, height: 941 }) });
  renderer.view = view; renderer.focusLocation(completed.entrance);
  const point = renderer.artToScreen({ x: -1222, y: 420 });
  assert.equal(renderer.pickBuilding(point.x, point.y), view.buildings.find(value => value.type === 'lumber'), 'completed building selection uses the real public projection');
  assert.deepEqual(snapshotSect(restoreSect(snapshotSect(session))), snapshotSect(session));
});
