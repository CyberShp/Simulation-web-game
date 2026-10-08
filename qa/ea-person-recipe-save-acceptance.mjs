/** SR-XF-007-I01: persistent appearance recipe compatibility and load validation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Legacy from '../dist/ea-sim.mjs';
import * as Opening from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';

const saved = state => JSON.parse(JSON.stringify(state));
const persistence = createEAPersistence({
  validate: Opening.validateSave, dataVersion: 6, gameVersion: '1.6.0-dev',
  writerId: 'qa-sr007-recipe', now: () => 1,
});

test('SR-XF-007-I01: new appearance survives exact simulation and native save reload', () => {
  const fresh = Opening.initial({sr: true});
  for (const [personId, person] of Object.entries(fresh.personsById)) {
    assert.equal(person.appearance?.recipe?.id, `appearance:${personId}:v1`, `${personId}: initial recipe`);
    assert(person.schedule, `${personId}: initial schedule`);
  }
  assert.equal(Opening.appearanceView(fresh, 'person:xu-qinghe').recipe.id, 'appearance:person:xu-qinghe:v1');
  const state = Opening.validateSave(fresh);
  const raw = JSON.stringify(state);
  const restored = Opening.validateSave(JSON.parse(raw));
  assert(JSON.stringify(restored) === raw, 'validated fresh save reloads exactly');
  for (const [personId, person] of Object.entries(restored.personsById)) {
    assert.equal(person.appearance.recipe.id, `appearance:${personId}:v1`);
    assert(Number.isSafeInteger(person.appearance.recipe.faceMark));
    assert(person.appearance.recipe.faceMark >= 0 && person.appearance.recipe.faceMark <= 4);
  }
  const imported = persistence.parseImport(persistence.exportState(fresh, {slot: 1}));
  assert.equal(imported.ok, true);
  assert(JSON.stringify(imported.state) === raw, 'native save reloads exactly');
});

test('SR-XF-007-I01: sourced completed v5 save keeps people and appearance through upgrade and native reload', () => {
  const old = JSON.parse(readFileSync(new URL('./ea-reference-world.json', import.meta.url), 'utf8'));
  const source = JSON.stringify(old);
  assert.equal(old.version, 5);
  assert.equal(old.story.completed, true);
  const upgraded = Opening.validateSave(old, {upgrade: true});
  assert.equal(JSON.stringify(old), source, 'source fixture remains untouched');
  assert.equal(upgraded.story.completed, true);
  assert.equal(upgraded.schemaMigration.completedEndingPreserved, true);
  for (const [personId, person] of Object.entries(upgraded.personsById)) {
    assert.equal(person.appearance?.recipe?.id, `appearance:${personId}:v1`, `${personId}: upgraded recipe`);
  }
  const client = upgraded.personsById['person:late:chen-yuanshu'];
  const template = Object.values(upgraded.personsById).find(person => person.mind);
  for (const field of ['body', 'face', 'hair', 'outfit', 'faceMark', 'height']) {
    assert.equal(client.appearance.recipe[field], template.appearance.recipe[field], `${field}: saved visual trait`);
  }
  const raw = JSON.stringify(upgraded);
  assert(JSON.stringify(Opening.validateSave(JSON.parse(raw))) === raw);
  const imported = persistence.parseImport(persistence.exportState(upgraded, {slot: 1}));
  assert.equal(imported.ok, true);
  assert(JSON.stringify(imported.state) === raw, 'native completed save reloads exactly');

  const prior = saved(upgraded);
  prior.personsById[client.personId].appearance.recipe.id = template.appearance.recipe.id;
  const priorRaw = JSON.stringify(prior);
  const migrated = Opening.validateSave(prior);
  assert.equal(JSON.stringify(prior), priorRaw);
  assert.deepEqual(migrated.personsById[client.personId].appearance, client.appearance);
  const migratedRaw = JSON.stringify(migrated);
  assert(JSON.stringify(Opening.validateSave(JSON.parse(migratedRaw))) === migratedRaw);
  const envelope = JSON.parse(persistence.exportState(upgraded, {slot: 1}));
  envelope.state = prior;
  const importedPrior = persistence.parseImport(JSON.stringify(envelope));
  assert.equal(importedPrior.ok, true, 'native import recognizes the known historical template ID');
  assert(JSON.stringify(importedPrior.state) === migratedRaw);

  for (const change of [
    recipe => { recipe.id = 'appearance:person:master:v1'; },
    recipe => { recipe.faceMark = 5; },
  ]) {
    const corrupt = saved(prior);
    change(corrupt.personsById[client.personId].appearance.recipe);
    assert.throws(() => Opening.validateSave(corrupt), /人物外观配方或自主日程异常/);
    envelope.state = corrupt;
    assert.equal(persistence.parseImport(JSON.stringify(envelope)).ok, false);
  }
});

test('SR-XF-007-I01: legal older saves gain only absent recipes on a validated copy', () => {
  const state = saved(Opening.initial({sr: true}));
  const preserved = state.personsById['person:lu-zhiwei'].appearance.recipe;
  delete state.personsById['person:master'].appearance.recipe;
  const source = JSON.stringify(state);
  const restored = Opening.validateSave(state);
  assert.equal(JSON.stringify(state), source);
  assert.equal(restored.master.appearance.recipe.id, 'appearance:person:master:v1');
  assert.deepEqual(restored.personsById['person:lu-zhiwei'].appearance.recipe, preserved);
  const migratedRaw = JSON.stringify(restored);
  assert(JSON.stringify(Opening.validateSave(JSON.parse(migratedRaw))) === migratedRaw);
  const legacyEnvelope = JSON.parse(persistence.exportState(restored, {slot: 1}));
  legacyEnvelope.state = state;
  const imported = persistence.parseImport(JSON.stringify(legacyEnvelope));
  assert.equal(imported.ok, true, 'native import accepts a known schema 6 save without recipe');
  assert(JSON.stringify(imported.state) === migratedRaw);

  const old = Legacy.initial({seed: 719});
  const oldRaw = JSON.stringify(old);
  const upgraded = Opening.validateSave(old, {upgrade: true});
  assert.equal(JSON.stringify(old), oldRaw);
  assert.equal(upgraded.master.appearance.recipe.id, 'appearance:person:master:v1');
  const upgradedRaw = JSON.stringify(upgraded);
  assert(JSON.stringify(Opening.validateSave(JSON.parse(upgradedRaw))) === upgradedRaw);
});

test('SR-XF-007-I01: both face mark bounds remain valid', () => {
  const state = saved(Opening.validateSave(Opening.initial({sr: true})));
  for (const mark of [0, 4]) {
    const copy = saved(state);
    copy.personsById['person:master'].appearance.recipe.faceMark = mark;
    assert.equal(Opening.validateSave(copy).master.appearance.recipe.faceMark, mark);
  }
});

test('SR-XF-007-I01: invalid versions and face marks fail simulation and native import', () => {
  const envelope = JSON.parse(persistence.exportState(Opening.initial({sr: true}), {slot: 1}));
  const cases = [
    ['unknown version', recipe => { recipe.id = 'appearance:person:master:v2'; }],
    ['other identity', recipe => { recipe.id = 'appearance:person:lu-zhiwei:v1'; }],
    ['missing version', recipe => { delete recipe.id; }],
    ['negative face mark', recipe => { recipe.faceMark = -1; }],
    ['oversized face mark', recipe => { recipe.faceMark = 5; }],
    ['fractional face mark', recipe => { recipe.faceMark = 0.5; }],
    ['missing face mark', recipe => { delete recipe.faceMark; }],
    ['explicitly invalid recipe', (_recipe, appearance) => { appearance.recipe = null; }],
  ];
  for (const [label, change] of cases) {
    const corrupt = saved(envelope);
    const appearance = corrupt.state.personsById['person:master'].appearance;
    change(appearance.recipe, appearance);
    const source = JSON.stringify(corrupt.state);
    assert.throws(() => Opening.validateSave(corrupt.state), /人物外观配方或自主日程异常/, label);
    assert.equal(JSON.stringify(corrupt.state), source, `${label}: rejected source stays intact`);
    const imported = persistence.parseImport(JSON.stringify(corrupt));
    assert.equal(imported.ok, false, `${label}: native import must reject the bad record`);
    assert.match(imported.message, /人物外观配方或自主日程异常/, label);
  }
});
