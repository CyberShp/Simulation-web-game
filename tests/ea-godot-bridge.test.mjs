import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createGodotBridge, projectGodotWorld} from '../dist/ea-godot-bridge.mjs';
import {SPATIAL_TERRAIN, spatialRoom, polygonContains, spatialPrefab, meterCanStand, meterFindPath} from '../dist/ea-sr-spatial.mjs';

const parse = bridge => SIM.validateSave(JSON.parse(bridge.save()));
const master = bridge => bridge.snapshot().people.find(person => person.id === bridge.snapshot().masterId);
function accepted(bridge, request) {
  const receipt = bridge.command(request);
  assert.equal(receipt.ok, true, receipt.error);
  return receipt;
}

test('SR002/003: Godot snapshot is a detached, read-only projection of real identities and terrain', () => {
  const source = SIM.initial({sr: true}), original = JSON.stringify(source), bridge = createGodotBridge({state: source});
  const before = bridge.save(), view = bridge.snapshot();
  assert.equal(view.version, 1);
  assert.equal(view.width, 96); assert.equal(view.height, 96);
  assert.equal(view.masterId, source.master.personId);
  assert.deepEqual(view.people.map(person => person.id), ['person:master', 'person:lu-zhiwei']);
  for (const person of view.people) {
    const entity = source.personsById[person.id], point = entity === source.master ? entity.scenic : entity.mind.scenic;
    assert.equal(person.x, point.x); assert.equal(person.y, point.y);
    assert.equal(person.appearance, entity.appearance.spriteIndex);
    assert.ok(person.appearance >= 0 && person.appearance <= 5);
  }
  const hall = source.buildings[0], dimensions = spatialPrefab(hall);
  assert.deepEqual(view.buildings[0], {id: String(hall.id), type: hall.type, name: SIM.BUILDINGS.hall.name, x: hall.transform.x, y: hall.transform.y, width: dimensions.width, height: dimensions.height, indoor: true, level: hall.level, condition: hall.condition, stage: 'complete'});
  assert.deepEqual(view.terrain, SPATIAL_TERRAIN.map(({id, kind, polygon}) => ({id, kind, polygon: polygon.map(point => [...point])})));
  assert.ok(view.message.includes(source.master.name));
  assert.equal(view.sceneId, 'scene:yunxiu-courtyard');
  assert.equal(view.timeLabel, '第 1 日');
  assert.throws(() => { view.resources.wood = 900; }, TypeError);
  assert.throws(() => { view.people[0].x = 90; }, TypeError);
  assert.throws(() => { view.terrain[0].polygon[0][0] = 0; }, TypeError);
  assert.equal(bridge.save(), before);
  assert.equal(JSON.stringify(source), original);
  source.resources.wood = 999;
  assert.notEqual(bridge.snapshot().resources.wood, source.resources.wood);
});

test('SR002/003: public master movement and elapsed seconds match the sole simulation exactly', () => {
  const bridge = createGodotBridge(), start = master(bridge);
  let reference = SIM.validateSave(JSON.parse(bridge.save()));
  const request = {type: 'move', x: 32, y: 38};
  accepted(bridge, JSON.stringify(request));
  reference = SIM.dispatchCommand(reference, {name: 'moveScenicMaster', args: [32, 38]}).state;
  assert.equal(master(bridge).moving, true);
  assert.deepEqual(bridge.snapshot().masterPath, reference.master.scenic.path.map(({x, y}) => ({x, y})));
  for (const dt of [.09, .01, .25, .65, 1, 1, 1, 1, 1, 1]) {
    bridge.advance(dt); SIM.tick(reference, dt);
  }
  assert.equal(bridge.save(), JSON.stringify(SIM.validateSave(reference)));
  assert.ok(Math.hypot(master(bridge).x - start.x, master(bridge).y - start.y) > 0);
  assert.equal(bridge.snapshot().tick, 70);
});

test('SR002: pause preserves carry, positions, resources, and the world clock until resumed', () => {
  const bridge = createGodotBridge();
  accepted(bridge, {type: 'move', x: 32, y: 38});
  bridge.advance(.05);
  accepted(bridge, {type: 'pause', paused: true});
  const before = bridge.save();
  bridge.advance(30);
  assert.equal(bridge.snapshot().paused, true);
  assert.equal(bridge.save(), before);
  accepted(bridge, {type: 'pause', paused: false});
  bridge.advance(.05);
  assert.equal(bridge.snapshot().tick, 1);
  accepted(bridge, {name: 'setSpeed', args: [2]});
  bridge.advance(.5);
  assert.equal(bridge.snapshot().tick, 11);
});

test('SR002: replaying a confirmed healing command preserves its receipt and charges once', () => {
  const bridge = createGodotBridge(), context = bridge.snapshot();
  const request = {name:'masterAction', args:['heal'], id:`command:${context.nextCommandId}`, expectedRevision:context.revision};
  accepted(bridge, request);
  const saved = bridge.save();
  const replay = accepted(bridge, request);
  assert.equal(replay.replayed, true);
  assert.equal(bridge.save(), saved);
  assert.equal(bridge.snapshot().resources.herb, context.resources.herb - 6);
});

test('SR002/029: selection never dispatches or changes simulation state; malformed commands are rejected', () => {
  const bridge = createGodotBridge(), before = bridge.save();
  accepted(bridge, {type: 'select', kind: 'person', id: 'person:lu-zhiwei'});
  assert.deepEqual(bridge.snapshot().selection, {kind: 'person', id: 'person:lu-zhiwei'});
  accepted(bridge, {type: 'select', kind: 'building', id: bridge.snapshot().buildings[0].id});
  assert.equal(bridge.save(), before);
  const selected = bridge.snapshot().selection;
  for (const request of ['{', null, [], {type: 'pause', paused: 'false'}, {type: 'move', x: NaN, y: 1}, {type: 'move', x: 97, y: 1}, {type: 'move', actorId: 'person:lu-zhiwei', x: 30, y: 30}, {name: 'missing'}, {type: 'select', kind: 'person', id: 'person:missing'}]) {
    assert.equal(bridge.command(request).ok, false);
    assert.equal(bridge.save(), before);
    assert.deepEqual(bridge.snapshot().selection, selected);
  }
  for (const seconds of [-1, NaN, Infinity, 86401]) assert.throws(() => bridge.advance(seconds));
  assert.equal(bridge.save(), before);
  accepted(bridge, {type: 'select', id: null});
  assert.equal(bridge.snapshot().selection, undefined);
});

test('SR002/007 U-101: real arrival inside a closed room retains the same healing person and activity', () => {
  const bridge = createGodotBridge();
  accepted(bridge, {name: 'masterAction', args: ['heal']});
  assert.equal(master(bridge).indoor, false);
  for (let count = 0; count < 250 && !master(bridge).indoor; count++) bridge.advance(.1);
  const state = parse(bridge), person = master(bridge), room = spatialRoom(state.buildings[0]);
  assert.equal(person.id, state.master.personId);
  assert.equal(person.indoor, true);
  assert.equal(polygonContains(state.master.scenic, room.floor), true);
  assert.ok(state.master.activityId);
  assert.equal(state.activitiesById[state.master.activityId].action, 'heal');
  const before = bridge.save();
  for (let count = 0; count < 20; count++) bridge.snapshot();
  assert.equal(bridge.save(), before);
  assert.equal(bridge.load(before).ok, true);
  assert.equal(master(bridge).indoor, true);
  assert.equal(bridge.save(), before);
});

test('SR030: save/load retains exact state and rejects corrupt input without replacing the current world', () => {
  const bridge = createGodotBridge();
  accepted(bridge, {type: 'move', x: 32, y: 38}); bridge.advance(2.05);
  const saved = bridge.save(), copy = createGodotBridge();
  assert.equal(copy.load(saved).ok, true);
  assert.equal(copy.save(), saved);
  assert.deepEqual(copy.snapshot(), bridge.snapshot());
  const broken = JSON.parse(saved); broken.personsById['person:master'].personId = 'person:someone-else';
  for (const text of ['{', 'null', '{}', JSON.stringify(broken)]) {
    assert.equal(copy.load(text).ok, false);
    assert.equal(copy.save(), saved);
  }
  copy.advance(.95); bridge.advance(.95);
  assert.equal(copy.save(), bridge.save());
});

test('U-109: injured master cannot repair the old house through the preview command bridge', () => {
  const source = SIM.initial({sr:true});
  source.buildings.find(building => building.type === 'hall').condition = 35;
  const sites = [{id:'site:main-house',type:'hall',x:24,y:4}];
  const bridge = createGodotBridge({state:source,sites});
  const before = bridge.save();
  const result = bridge.command({name:'repairBuilding',args:[source.buildings[0].id]});
  assert.equal(result.ok,false);
  assert.match(result.error,/伤势/);
  const build = bridge.command({name:'build',args:['farm',12,40]});
  assert.equal(build.ok,false);
  assert.match(build.error,/伤势/);
  assert.equal(bridge.save(),before);
});

test('U-109: the old house stays visibly repairable until fully restored', () => {
  const source = SIM.initial({sr:true});
  source.buildings.find(building => building.type === 'hall').condition = 35;
  const bridge = createGodotBridge({state:source,sites:[{id:'site:main-house',type:'hall',x:24,y:4}]});
  bridge.advance(121);
  assert.equal(parse(bridge).buildings[0].condition,35);
  source.buildings[0].condition = 59;
  const partlyWeathered = createGodotBridge({state:source,sites:[{id:'site:main-house',type:'hall',x:24,y:4}]});
  assert.equal(partlyWeathered.snapshot().buildings[0].stage,'damaged');
  assert.equal(bridge.snapshot().buildings[0].stage,'damaged');
  source.buildings[0].condition = 100;
  const restored = createGodotBridge({state:source,sites:[{id:'site:main-house',type:'hall',x:24,y:4}]});
  assert.equal(restored.snapshot().buildings[0].stage,'complete');
});

test('U-109: visible gate posts block metre-space paths only in the old-estate preview', () => {
  const source = SIM.initial({sr:true});
  const bridge = createGodotBridge({state:source,sites:[{id:'site:main-house',type:'hall',x:24,y:4}]});
  const estate = parse(bridge);
  assert.equal(meterCanStand(source,{x:29.14,y:58}),true);
  assert.equal(meterCanStand(estate,{x:29.14,y:58}),false);
  assert.equal(meterCanStand(estate,{x:32,y:58}),true);
  assert.ok(meterFindPath(estate,{x:32,y:56},{x:32,y:65})?.length);
  assert.equal(bridge.snapshot().terrain.some(item=>item.id==='estate:gate-west'),true);
});

test('SR030: supported legacy save is upgraded by the original validator with identity and resources retained', () => {
  const text = readFileSync(new URL('../qa/ea-reference-world.json', import.meta.url), 'utf8');
  const legacy = JSON.parse(text), expected = SIM.validateSave(legacy, {upgrade: true}), bridge = createGodotBridge();
  assert.equal(bridge.load(text).ok, true);
  assert.equal(bridge.save(), JSON.stringify(SIM.validateSave(expected)));
  assert.deepEqual(bridge.snapshot().resources, expected.resources);
  assert.equal(bridge.snapshot().buildings.length, expected.buildings.length);
  const second = createGodotBridge();
  assert.equal(second.load(bridge.save()).ok, true);
  assert.equal(second.save(), bridge.save());
});

test('SR007/014: Godot shows real disciples and a study order without creating a second learning clock', () => {
  const source = JSON.parse(readFileSync(new URL('../qa/acceptance-indoor-v12/opening-invite.json', import.meta.url), 'utf8'));
  const bridge = createGodotBridge({state: source});
  const before = bridge.save(), view = bridge.snapshot();
  assert.deepEqual(view.roster.map(person => person.id), ['person:master', 'person:lu-zhiwei', 'person:lin-changfeng']);
  assert.equal(view.arts.find(art => art.id === 'qingyuan').understanding, 40);
  assert.match(view.arts.find(art => art.id === 'qingyuan').teaching.reason, /理解65/);
  assert.equal(bridge.command({name:'teachArt',args:['qingyuan','person:lu-zhiwei']}).ok, false);
  assert.equal(bridge.save(), before);
  const started = accepted(bridge, {name:'studyArt',args:['qingyuan']});
  assert.equal(started.result.pending, true);
  assert.equal(bridge.snapshot().cultivationOrders[0].artId, 'qingyuan');
  accepted(bridge, {type:'pause',paused:true});
  const frozen = bridge.save();
  bridge.advance(20);
  assert.equal(bridge.save(), frozen);
  const restored = createGodotBridge();
  assert.equal(restored.load(frozen).ok, true);
  accepted(restored, {type:'pause',paused:false});
  for (let step = 0; step < 600; step++) restored.advance(.1);
  assert.equal(restored.snapshot().cultivationOrders.length, 0);
  assert.ok(restored.snapshot().arts.find(art => art.id === 'qingyuan').understanding > 40);
  assert.equal(restored.snapshot().roster.find(person => person.id === 'person:lu-zhiwei').id, 'person:lu-zhiwei');
});

test('SR002/003: courtyard projection does not show a travelling master at the cached home position', () => {
  const state = SIM.dispatchCommand(SIM.initial({sr: true}), {name: 'srWorldCommand', args: [{action: 'travel', destination: 'scene:valley'}]}).state;
  const before = JSON.stringify(state), view = projectGodotWorld(state);
  assert.equal(view.people.some(person => person.id === state.master.personId), false);
  assert.deepEqual(view.masterPath, []);
  assert.equal(JSON.stringify(state), before);
});
