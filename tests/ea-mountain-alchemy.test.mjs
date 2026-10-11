import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {initial, tick, validateSave} from '../dist/ea-opening-sim.mjs';
import {createGodotBridge} from '../dist/ea-godot-bridge.mjs';
import {grantPills} from '../dist/ea-sr-economy.mjs';
import {placementIssue} from '../dist/ea-sr-spatial.mjs';

const sites = JSON.parse(readFileSync(new URL('../godot/estate_2d/estate-sites.json', import.meta.url))).sites;
const farmSite = sites.find(site => site.id === 'site:herb-terrace');
const alchemySite = sites.find(site => site.id === 'site:alchemy-court');

function checkpoint(name, bridge) {
  const directory = process.env.EA_ALCHEMY_FIXTURE_DIR;
  if (!directory) return;
  mkdirSync(directory, {recursive:true});
  writeFileSync(`${directory}/${name}.json`, bridge.save());
}

function command(bridge, name, ...args) {
  const view = bridge.snapshot();
  const result = bridge.command({name, args, id:`command:${view.nextCommandId}`, expectedRevision:view.revision});
  assert.equal(result.ok, true, `${name} at tick ${view.tick}: ${result.error}`);
  return result.result;
}

function until(bridge, predicate, label, limit = 400) {
  for (let i = 0; i < limit && !predicate(bridge.snapshot()); i++) bridge.advance(1);
  assert.ok(predicate(bridge.snapshot()), `${label} did not finish by tick ${bridge.snapshot().tick}`);
}

function masterActivity(bridge) {
  return bridge.snapshot().systemPeople.persons.find(person => person.id === 'person:master').currentActivity.id;
}

function transport(bridge, sourceId, targetId, cargo) {
  const order = command(bridge, 'startTransport', sourceId, targetId, 'person:master', cargo);
  until(bridge, view => view.inventory.transports.some(item => item.id === order.id && item.phase === 'delivered'),
    `delivery ${order.id}`);
  return order;
}

function harvestToPublic(bridge, resource, quantity) {
  command(bridge, 'startMasterHarvest', resource);
  until(bridge, () => !masterActivity(bridge), `manual ${resource} harvest`);
  const carried = bridge.snapshot().inventory.stockpiles.find(stockpile => stockpile.id === 'stockpile:carried:master');
  assert.ok(carried.resources[resource] >= quantity);
  transport(bridge, carried.id, 'stockpile:yunxiu', {[resource]:quantity});
}

function walkNearMerchant(bridge) {
  const result = bridge.command({type:'move', x:29, y:13});
  assert.equal(result.ok, true, result.error);
  until(bridge, view => view.masterPath.length === 0, 'merchant approach');
}

test('new mountain courtyard makes a real healing batch from gathered and terrace material', () => {
  assert.ok(alchemySite, 'the playable courtyard needs the alchemy building site');
  const bridge = createGodotBridge({state:initial({sr:true, mountainOpening:true}), sites});
  const openingSave = bridge.save();
  assert.equal(bridge.snapshot().crafting.workstation, null);
  assert.equal(bridge.snapshot().crafting.recipes.find(recipe => recipe.id === 'heal').available, false);
  assert.equal(bridge.snapshot().crafting.orders.length, 0);
  assert.equal(bridge.save(), openingSave, 'read-only crafting projection must not advance or spend');

  command(bridge, 'masterAction', 'heal');
  command(bridge, 'chooseOpeningInheritance', 'qinglan');
  until(bridge, view => view.roster[0].wound === 0, 'opening treatment');
  command(bridge, 'advanceStory');
  command(bridge, 'establishHall');
  until(bridge, view => view.openingHallPhase === 'complete', 'main hall');
  command(bridge, 'advanceStory', 'gift');
  command(bridge, 'advanceStory', 'invite');
  command(bridge, 'build', 'farm', farmSite.x, farmSite.y);
  until(bridge, view => view.buildings.some(building => building.type === 'farm' && building.stage === 'complete'), 'terrace');

  // The first visiting merchant pays for finite wood. Wood and stone are
  // gathered on site and carried home through public commands.
  harvestToPublic(bridge, 'wood', 12);
  harvestToPublic(bridge, 'wood', 12);
  walkNearMerchant(bridge);
  command(bridge, 'marketTrade', 'wood', 'sell', 3);
  harvestToPublic(bridge, 'wood', 12);
  harvestToPublic(bridge, 'wood', 12);
  harvestToPublic(bridge, 'stone', 10);

  const farm = bridge.snapshot().herbTerrace;
  transport(bridge, 'stockpile:yunxiu', farm.stockpileId, {herb:2});
  assert.equal(command(bridge, 'inviteWork', 'person:lu-zhiwei', farm.instanceId).accepted, true);
  until(bridge, view => !!view.herbTerrace.lastHarvest, 'first terrace harvest');
  const firstHarvest = bridge.snapshot();
  assert.ok(firstHarvest.herbTerrace.herbOnSite >= 10);
  checkpoint('terrace-harvest', bridge);
  assert.equal(placementIssue(validateSave(JSON.parse(bridge.save())), 'alchemy', alchemySite.x, alchemySite.y), '');

  const materials = firstHarvest.resources;
  assert.ok(materials.jade >= 75 && materials.wood >= 35 && materials.stone >= 30,
    `earned building and batch cost: ${JSON.stringify(materials)}`);
  command(bridge, 'build', 'alchemy', alchemySite.x, alchemySite.y);
  until(bridge, view => view.buildings.some(building => building.type === 'alchemy' && building.stage === 'complete'), 'alchemy room');
  const workstation = bridge.snapshot().crafting.workstation;
  checkpoint('alchemy-built', bridge);
  assert.equal(workstation.stockpileId, `stockpile:${workstation.buildingId}`);
  assert.equal(workstation.workSlots, 1);
  assert.equal(bridge.snapshot().crafting.recipes.find(recipe => recipe.id === 'heal').available, false);

  transport(bridge, farm.stockpileId, workstation.stockpileId, {herb:10});
  const ready = bridge.snapshot().crafting.recipes.find(recipe => recipe.id === 'heal');
  assert.equal(ready.available, true, ready.reasons.join('；'));
  assert.deepEqual(ready.cost, {jade:10, herb:10});
  assert.equal(ready.yield, 2);
  assert.equal(ready.durationTicks, 200);
  const active = command(bridge, 'craftSR', 'heal');
  assert.equal(active.pending, true);
  const paid = bridge.snapshot();
  assert.equal(paid.crafting.orders.find(order => order.id === active.id).phase, 'active');
  assert.equal(paid.crafting.workstation.resources.herb, 0);
  assert.equal(paid.crafting.workstation.pills.heal, 0);
  const restored = createGodotBridge({state:JSON.parse(bridge.save()), sites});
  assert.equal(restored.snapshot().crafting.orders.find(order => order.id === active.id).phase, 'active');
  until(restored, view => view.crafting.orders.find(order => order.id === active.id).phase === 'completed', 'healing batch');
  const completed = restored.snapshot();
  assert.equal(completed.crafting.workstation.pills.heal, 2);
  checkpoint('healing-batch', restored);
  assert.equal(completed.crafting.orders.find(order => order.id === active.id).resultFactId, `fact:craft:${active.id}`);
  assert.equal(completed.inventory.stockpiles.find(stockpile => stockpile.id === workstation.stockpileId).pills.heal, 2);
  assert.equal(completed.inventory.pillAccess.find(pill => pill.recipeId === 'heal').available, 0);

  walkNearMerchant(restored);
  assert.equal(restored.snapshot().inventory.pillAccess.find(pill => pill.recipeId === 'heal').available, 0);
  const pickup = command(restored, 'preparePillUse', 'heal');
  assert.equal(pickup.pending, true);
  until(restored, view => view.inventory.transports.some(order => order.id === pickup.id && order.phase === 'delivered'),
    'physical medicine pickup');
  const carried = restored.snapshot().inventory.stockpiles.find(stockpile => stockpile.id === 'stockpile:carried:master');
  assert.equal(carried.pills.heal, 1);

  const healthy = JSON.parse(restored.save());
  healthy.personsById['person:master'].wound = 0;
  healthy.personsById['person:master'].energy = 100;
  const healthyBridge = createGodotBridge({state:validateSave(healthy), sites});
  const healthySave = healthyBridge.save();
  const rejected = healthyBridge.command({name:'masterPill', args:['heal']});
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /没有收益/);
  assert.equal(healthyBridge.save(), healthySave, 'a useless dose must preserve medicine and command state');
  assert.equal(createGodotBridge({state:JSON.parse(healthyBridge.save()), sites}).snapshot()
    .inventory.stockpiles.find(stockpile => stockpile.id === carried.id).pills.heal, 1);

  // Isolated injury boundary: production and pickup above used only public
  // commands; this single saved-state wound permits a healing-use assertion.
  const injured = JSON.parse(restored.save());
  injured.personsById['person:master'].wound = 25;
  const injuredBridge = createGodotBridge({state:validateSave(injured), sites});
  command(injuredBridge, 'masterPill', 'heal');
  assert.equal(injuredBridge.snapshot().roster[0].wound, 0);
  assert.equal(injuredBridge.snapshot().inventory.stockpiles.find(stockpile => stockpile.id === carried.id).pills.heal, 0);
  assert.equal(injuredBridge.snapshot().crafting.workstation.pills.heal, 1);
  const reload = createGodotBridge({state:JSON.parse(injuredBridge.save()), sites});
  assert.equal(reload.snapshot().roster[0].wound, 0);
  assert.equal(reload.snapshot().crafting.workstation.pills.heal, 1);
});

test('an injured disciple can still use a real private healing dose autonomously', () => {
  const state = initial({sr:true});
  const disciple = state.personsById['person:lu-zhiwei'];
  if (!state.homeMemberIds.includes(disciple.personId)) state.homeMemberIds.push(disciple.personId);
  disciple.wound = 35;
  disciple.energy = 100;
  disciple.mind.satiety = 100;
  disciple.mind.lastPillDay = -1;
  disciple.mind.restrictedUntil = 0;
  state.doctrine.pillRule = 'shared';
  grantPills(state, 'stockpile:lu-zhiwei', 'heal', 1, {factId:'fact:qa:disciple-healing-dose'});
  const consumedBefore = state.stats.consumed;
  for (let i = 0; i < 400 && state.stats.consumed === consumedBefore; i++) tick(state, .1);
  assert.equal(state.stats.consumed, consumedBefore + 1);
  assert.equal(disciple.wound, 10);
  assert.equal(state.stockpilesById['stockpile:lu-zhiwei'].pills.heal, 0);
  assert.doesNotThrow(() => validateSave(JSON.parse(JSON.stringify(state))));
});
