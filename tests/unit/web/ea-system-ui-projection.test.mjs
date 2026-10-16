import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial, validateSave} from '../../../src/simulation/ea-opening-sim.mjs';
import {createGodotBridge, projectGodotWorld} from '../../../src/simulation/ea-godot-bridge.mjs';
import {startTransport} from '../../../src/simulation/ea-sr-economy.mjs';
import {getSocietyView, viewPublicDiscipleLearning} from '../../../src/simulation/ea-society.mjs';

const sites = JSON.parse(readFileSync(new URL('../../../archive/godot/estate_2d/estate-sites.json', import.meta.url))).sites;
const farmSite = sites.find(site => site.id === 'site:herb-terrace');

function command(bridge, name, ...args) {
  const view = bridge.snapshot();
  const receipt = bridge.command({name, args, id:`command:${view.nextCommandId}`, expectedRevision:view.revision});
  assert.equal(receipt.ok, true, receipt.error);
  return receipt.result;
}

function until(bridge, predicate, label) {
  for (let n = 0; n < 3000 && !predicate(bridge.snapshot()); n++) bridge.advance(.1);
  assert.ok(predicate(bridge.snapshot()), `${label} did not finish`);
}

test('system UI snapshot is read only and keeps actual equipment instance, ownership and four slots through order and load', () => {
  const bridge = createGodotBridge();
  const saved = bridge.save(), view = bridge.snapshot();
  const master = view.systemPeople.persons.find(person => person.id === view.masterId);
  const sword = view.inventory.equipment.find(item => item.definitionId === 'equipment:iron-sword');
  assert.equal(master.realmLabel, '炼气6层');
  assert.deepEqual(view.inventory.slots, ['weapon', 'armor', 'artifact', 'accessory']);
  assert.equal(master.equipmentSlots.weapon, null);
  assert.equal(sword.ownerId, view.masterId);
  assert.deepEqual(sword.location, {kind:'person', id:view.masterId});
  assert.equal(view.inventory.stockpiles.find(stockpile => stockpile.id === 'stockpile:yunxiu')?.access, 'public');
  assert.ok(view.inventory.summary.find(group => group.id === 'public')?.amounts.herb);
  assert.throws(() => { view.inventory.equipment[0].ownerId = 'person:other'; }, TypeError);
  assert.throws(() => { master.equipmentSlots.weapon = 'item:fake'; }, TypeError);
  assert.equal(bridge.save(), saved);

  const order = command(bridge, 'equipItem', sword.id, 'weapon');
  assert.equal(order.pending, true);
  assert.equal(bridge.snapshot().systemPeople.persons[0].equipmentSlots.weapon, null);
  assert.equal(bridge.snapshot().inventory.equipmentOrders.find(item => item.id === order.orderId)?.phase, 'reserved');
  const pending = bridge.save(), restored = createGodotBridge({state:JSON.parse(pending)});
  assert.deepEqual(restored.snapshot().inventory, bridge.snapshot().inventory);
  until(restored, current => current.systemPeople.persons[0].equipmentSlots.weapon === sword.id, 'equip sword');
  const equipped = restored.snapshot().inventory.equipment.find(item => item.id === sword.id);
  assert.equal(equipped.ownerId, view.masterId);
  assert.deepEqual(equipped.location, {kind:'person', id:view.masterId, slot:'weapon'});
  assert.equal(restored.snapshot().inventory.equipmentOrders.some(item => item.id === order.orderId), false);
  const complete = restored.save();
  restored.snapshot();
  assert.equal(restored.save(), complete);
});

test('disciple learning matches the public society view when private and public values differ', () => {
  const state = validateSave(JSON.parse(readFileSync(new URL('../../fixtures/legacy/midgame.json', import.meta.url))),
    {upgrade:true});
  const disciple = state.disciples[0], secretId = state.society.nextIncidentId++;
  disciple.mind.main = 'wood';
  disciple.mind.publicMain = 'qingyuan';
  disciple.mind.knowledge.wood = 70;
  disciple.mind.hiddenKnowledge.wood = secretId;
  disciple.artsById.qingyuan.understanding = 95;
  disciple.artsById.wood = {artId:'wood', access:true, understanding:70, mastery:45};
  state.society.secrets.push({id:secretId, discipleId:disciple.id, kind:'book', subject:'wood',
    discovered:false, handled:false});

  const publicView = getSocietyView(state).disciples.find(person => person.id === disciple.id);
  const savedBeforeProjection = JSON.stringify(state);
  const learning = viewPublicDiscipleLearning(state, disciple);
  const snapshot = projectGodotWorld(state);
  const projected = snapshot.systemPeople.persons.find(person => person.id === disciple.personId);
  const rosterPerson = snapshot.roster.find(person => person.id === disciple.personId);
  assert.deepEqual(learning, {main:publicView.main, knowledge:publicView.knowledge});
  assert.equal(projected.mainArtId, 'qingyuan');
  assert.deepEqual(projected.arts, [{id:'qingyuan', understanding:20, mastery:null}]);
  assert.equal(projected.arts.some(art => art.id === 'wood'), false);
  assert.equal(rosterPerson.mainArtId, publicView.main);
  assert.deepEqual(rosterPerson.arts, projected.arts);
  assert.equal(JSON.stringify(state), savedBeforeProjection);
});

test('real disciple, invitation and seed transport are projected from the same saved facts', () => {
  const bridge = createGodotBridge({state:initial({sr:true, mountainOpening:true}), sites});
  command(bridge, 'masterAction', 'heal');
  command(bridge, 'chooseOpeningInheritance', 'qinglan');
  until(bridge, view => view.roster[0].wound === 0, 'healing');
  command(bridge, 'advanceStory');
  command(bridge, 'establishHall');
  until(bridge, view => view.openingHallPhase === 'complete', 'main hall');
  command(bridge, 'advanceStory', 'gift');
  command(bridge, 'advanceStory', 'invite');
  command(bridge, 'build', 'farm', farmSite.x, farmSite.y);
  until(bridge, view => view.buildings.some(building => building.type === 'farm' && building.stage === 'complete'), 'herb terrace');

  const before = bridge.snapshot(), disciple = before.systemPeople.persons.find(person => person.id === 'person:lu-zhiwei');
  const farm = before.systemPeople.workplaces.find(place => place.instanceId === before.herbTerrace.instanceId);
  const publicStock = before.inventory.stockpiles.find(stockpile => stockpile.id === 'stockpile:yunxiu');
  assert.ok(disciple);
  assert.equal(disciple.workChoices.find(choice => choice.instanceId === farm.instanceId)?.available, false);
  assert.equal(JSON.stringify(disciple).includes('trust'), false);
  assert.equal(JSON.stringify(disciple).includes('privateMotives'), false);

  const order = command(bridge, 'startTransport', publicStock.id, before.herbTerrace.stockpileId, 'person:master', {herb:2});
  assert.ok(order.id);
  assert.equal(bridge.snapshot().inventory.transports.find(item => item.id === order.id)?.cargo.herb, 2);
  until(bridge, view => view.herbTerrace.herbOnSite === 2, 'seed delivery');
  const delivered = bridge.snapshot();
  assert.equal(delivered.inventory.stockpiles.find(stockpile => stockpile.id === publicStock.id).resources.herb,
    publicStock.resources.herb - 2);
  assert.equal(delivered.inventory.stockpiles.find(stockpile => stockpile.id === before.herbTerrace.stockpileId).resources.herb, 2);
  assert.equal(delivered.systemPeople.persons.find(person => person.id === disciple.id)
    .workChoices.find(choice => choice.instanceId === farm.instanceId)?.available, true);

  assert.equal(command(bridge, 'inviteWork', disciple.id, farm.instanceId).accepted, true);
  const invited = bridge.snapshot().systemPeople.persons.find(person => person.id === disciple.id);
  assert.equal(invited.schedule.invitations.find(item => item.targetId === farm.instanceId)?.accepted, true);
  const saved = bridge.save(), restored = createGodotBridge({state:JSON.parse(saved), sites});
  assert.deepEqual(restored.snapshot().systemPeople, bridge.snapshot().systemPeople);
  assert.deepEqual(restored.snapshot().inventory, bridge.snapshot().inventory);
  assert.equal(restored.save(), saved);
});

test('a new save can move public goods into an actual carried stockpile and return them without loss', () => {
  const bridge = createGodotBridge();
  command(bridge, 'masterAction', 'heal');
  command(bridge, 'chooseOpeningInheritance', 'qinglan');
  until(bridge, view => view.roster[0].wound === 0, 'healing');
  const before = bridge.snapshot(), savedBefore = bridge.save();
  const publicId = 'stockpile:yunxiu', carriedId = 'stockpile:carried:master';
  const herbBefore = before.inventory.stockpiles.find(stockpile => stockpile.id === publicId).resources.herb;
  assert.equal(before.inventory.stockpiles.some(stockpile => stockpile.id === carriedId), false);

  const tooMuch = bridge.command({name:'startTransport', args:[publicId, carriedId, 'person:master', {herb:41}]});
  assert.equal(tooMuch.ok, false);
  assert.equal(bridge.save(), savedBefore);
  const unavailable = bridge.command({name:'startTransport', args:[publicId, carriedId, 'person:master',
    {herb:herbBefore + 1}]});
  assert.equal(unavailable.ok, false);
  assert.equal(bridge.save(), savedBefore);
  const direct = validateSave(JSON.parse(savedBefore), {upgrade:true}), directBefore = JSON.stringify(direct);
  assert.throws(() => startTransport(direct, publicId, carriedId, 'person:master',
    {herb:herbBefore + 1}));
  assert.equal(JSON.stringify(direct), directBefore);
  assert.equal(direct.stockpilesById[carriedId], undefined);

  const outbound = command(bridge, 'startTransport', publicId, carriedId, 'person:master', {herb:3});
  assert.equal(outbound.accepted, true);
  const pending = bridge.snapshot();
  assert.equal(pending.inventory.stockpiles.find(stockpile => stockpile.id === carriedId).resources.herb, 0);
  assert.equal(pending.inventory.transports.find(order => order.id === outbound.id)?.cargo.herb, 3);
  const restored = createGodotBridge({state:JSON.parse(bridge.save())});
  until(restored, view => view.inventory.stockpiles.find(stockpile => stockpile.id === carriedId)?.resources.herb === 3,
    'public to carried delivery');
  const received = restored.snapshot();
  assert.equal(received.inventory.stockpiles.find(stockpile => stockpile.id === publicId).resources.herb,
    herbBefore - 3);
  assert.equal(received.inventory.equipment.length, before.inventory.equipment.length);

  const inbound = command(restored, 'startTransport', carriedId, publicId, 'person:master', {herb:3});
  assert.equal(inbound.accepted, true);
  until(restored, view => view.inventory.stockpiles.find(stockpile => stockpile.id === publicId).resources.herb === herbBefore,
    'carried to public delivery');
  const returned = restored.snapshot();
  assert.equal(returned.inventory.stockpiles.find(stockpile => stockpile.id === carriedId).resources.herb, 0);
  const finalSave = restored.save(), reloaded = createGodotBridge({state:JSON.parse(finalSave)});
  assert.deepEqual(reloaded.snapshot().inventory, returned.inventory);
  assert.equal(reloaded.save(), finalSave);
});
