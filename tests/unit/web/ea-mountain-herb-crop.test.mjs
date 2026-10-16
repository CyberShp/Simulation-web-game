import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial} from '../../../src/simulation/ea-opening-sim.mjs';
import {createGodotBridge} from '../../../src/simulation/ea-godot-bridge.mjs';

const sites = JSON.parse(readFileSync(new URL('../../../archive/godot/estate_2d/estate-sites.json', import.meta.url))).sites;
const farmSite = sites.find(site => site.id === 'site:herb-terrace');

function command(bridge, name, ...args) {
  const view = bridge.snapshot();
  const result = bridge.command({name, args, id:`command:${view.nextCommandId}`, expectedRevision:view.revision});
  assert.equal(result.ok, true, result.error);
  return result.result;
}

function until(bridge, predicate, label) {
  for (let i = 0; i < 3000 && !predicate(bridge.snapshot()); i++) bridge.advance(.1);
  assert.ok(predicate(bridge.snapshot()), `${label} did not finish`);
}

test('Yunxiu first herb crop uses local seeds and keeps its harvest at the terrace', () => {
  const bridge = createGodotBridge({state:initial({sr:true,mountainOpening:true}), sites});
  command(bridge, 'masterAction', 'heal');
  command(bridge, 'chooseOpeningInheritance', 'qinglan');
  until(bridge, view => view.roster[0].wound === 0, 'healing');
  command(bridge, 'advanceStory');
  command(bridge, 'establishHall');
  until(bridge, view => view.openingHallPhase === 'complete', 'main hall');
  command(bridge, 'advanceStory', 'gift');
  command(bridge, 'advanceStory', 'invite');
  assert.equal(bridge.snapshot().openingStory.invitation, 'joined');
  command(bridge, 'build', 'farm', farmSite.x, farmSite.y);
  until(bridge, view => view.buildings.some(building => building.type === 'farm' && building.stage === 'complete'), 'herb terrace');

  const empty = bridge.snapshot();
  assert.equal(empty.herbTerrace.herbOnSite, 0);
  assert.equal(empty.buildings.find(building => building.type === 'farm').cropVisual, 'empty');
  assert.equal(command(bridge, 'inviteWork', 'person:lu-zhiwei', empty.herbTerrace.instanceId).accepted, false);
  const publicHerbBefore = bridge.snapshot().resources.herb;
  command(bridge, 'startTransport', 'stockpile:yunxiu', empty.herbTerrace.stockpileId, 'person:master', {herb:2});
  until(bridge, view => view.herbTerrace.herbOnSite === 2, 'seed delivery');
  assert.equal(bridge.snapshot().resources.herb, publicHerbBefore - 2);
  assert.equal(command(bridge, 'inviteWork', 'person:lu-zhiwei', empty.herbTerrace.instanceId).accepted, true);
  until(bridge, view => view.buildings.find(building => building.type === 'farm').cropVisual === 'growing', 'sowing');

  const growing = bridge.snapshot();
  const restored = createGodotBridge({state:JSON.parse(bridge.save()), sites});
  assert.deepEqual(restored.snapshot().herbTerrace.crop, growing.herbTerrace.crop);
  until(restored, view => view.buildings.find(building => building.type === 'farm').cropVisual === 'ripe', 'maturing');
  until(restored, view => !!view.herbTerrace.lastHarvest, 'first harvest');
  const harvested = restored.snapshot();
  assert.ok(harvested.herbTerrace.lastHarvest.quantity > 0);
  assert.ok(harvested.herbTerrace.herbOnSite > 0);
  assert.equal(harvested.resources.herb, publicHerbBefore - 2);
  const saved = restored.save();
  restored.snapshot();
  assert.equal(restored.save(), saved);
});
