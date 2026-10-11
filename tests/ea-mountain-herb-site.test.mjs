import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial} from '../dist/ea-opening-sim.mjs';
import {createGodotBridge} from '../dist/ea-godot-bridge.mjs';

const sites = JSON.parse(readFileSync(new URL('../godot/estate_2d/estate-sites.json', import.meta.url))).sites;
const farm = sites.find(site => site.id === 'site:herb-terrace');

function command(bridge, name, ...args) {
  const view = bridge.snapshot();
  const result = bridge.command({name, args, id:`command:${view.nextCommandId}`, expectedRevision:view.revision});
  assert.equal(result.ok, true, result.error);
  return result;
}

function until(bridge, predicate, label) {
  for (let i = 0; i < 1200 && !predicate(bridge.snapshot()); i++) bridge.advance(.1);
  assert.ok(predicate(bridge.snapshot()), `${label} did not finish`);
}

test('mountain herb site rejects an offset build, keeps its work order through reload, and opens work slots on completion', () => {
  const bridge = createGodotBridge({state:initial({sr:true,mountainOpening:true}),sites});
  command(bridge,'masterAction','heal');
  command(bridge,'chooseOpeningInheritance','qinglan');
  until(bridge, view => view.roster[0].wound === 0, 'healing');
  command(bridge,'establishHall');
  until(bridge, view => view.openingHallPhase === 'complete', 'main hall');

  const before = bridge.snapshot(), savedBefore = bridge.save();
  const invalid = bridge.command({name:'build',args:['farm',farm.x + 2,farm.y],id:`command:${before.nextCommandId}`,expectedRevision:before.revision});
  assert.equal(invalid.ok,false);
  assert.equal(bridge.save(),savedBefore);

  command(bridge,'build','farm',farm.x,farm.y);
  const started = bridge.snapshot().buildings.find(building => building.type === 'farm');
  assert.equal(started.stage,'foundation');
  assert.equal(started.workSlots,0);
  until(bridge, view => view.construction?.progress > .3, 'herb terrace construction');
  const mid = bridge.snapshot(), restored = createGodotBridge({state:JSON.parse(bridge.save()),sites});
  assert.deepEqual(restored.snapshot().construction,mid.construction);
  until(restored, view => view.buildings.some(building => building.type === 'farm' && building.stage === 'complete'), 'herb terrace');
  const finished = restored.snapshot().buildings.find(building => building.type === 'farm');
  assert.equal(finished.workSlots,4);
  assert.equal(finished.capacity,0);
  assert.equal(Object.values(JSON.parse(restored.save()).buildingsById).filter(building => building.type === 'farm').length,1);
});
