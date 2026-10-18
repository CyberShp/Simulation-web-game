import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import { enableServiceResources } from '../../../src/simulation/ea-resource-types.mjs';

const spring = { instanceId: 'building:yunxiu:99', type: 'well', domainSiteId: 'site:domain:gc-23', enabled: true, condition: 100, level: 1 };
const plainWell = { instanceId: 'building:yunxiu:98', type: 'well', enabled: true, condition: 100, level: 1 };

test('the standard well keeps its crystal recipe and only the GC23 spring resolves the water version', () => {
  assert.equal(SIM.productionVersionFor(plainWell), SIM.PRODUCTION_RECIPE_VERSION);
  assert.equal(SIM.productionVersionFor({ type: 'well', domainSiteId: 'site:domain:gc-24' }), SIM.PRODUCTION_RECIPE_VERSION);
  assert.equal(SIM.productionVersionFor(spring), SIM.SPRING_WATER_RECIPE_VERSION);
  const recipe = SIM.productionRecipeDefinition(SIM.SPRING_WATER_RECIPE_VERSION, 'well');
  assert.deepEqual(recipe.inputCost, {});
  assert.deepEqual(recipe.outputDefinition, { cleanWater: 12 });
  assert.equal(recipe.durationValue, 200);
  assert.equal(recipe.skill, 'array');
  assert.equal(SIM.productionRecipeDefinition(SIM.SPRING_WATER_RECIPE_VERSION, 'farm'), null);
  assert.deepEqual(SIM.productionRecipeDefinition(SIM.PRODUCTION_RECIPE_VERSION, 'well').outputDefinition, { crystal: 4 });
});

test('the batch snapshot carries the spring recipe and the clean-water output', () => {
  const snapshot = SIM.productionRecipeSnapshot({ worldTick: 7 }, spring);
  assert.equal(snapshot.recipeId, 'recipe:well');
  assert.equal(snapshot.recipeVersion, SIM.SPRING_WATER_RECIPE_VERSION);
  assert.deepEqual(snapshot.outputDefinition, { cleanWater: 12 });
  assert.deepEqual(snapshot.inputCost, {});
  assert.equal(snapshot.createdTick, 7);
  const plain = SIM.productionRecipeSnapshot({ worldTick: 7 }, plainWell);
  assert.equal(plain.recipeVersion, SIM.PRODUCTION_RECIPE_VERSION);
  assert.deepEqual(plain.outputDefinition, { crystal: 4 });
});

test('the spring refuses to draw before life supplies exist and opens once they are enabled', () => {
  const state = SIM.validateSave(structuredClone(seed.state));
  const blocked = SIM.productionAvailability(state, spring);
  assert.equal(blocked.available, false);
  assert.match(blocked.reason, /生活物资/);
  const enabled = structuredClone(state);
  enableServiceResources(enabled);
  const open = SIM.productionAvailability(enabled, spring, SIM.SPRING_WATER_RECIPE_VERSION);
  assert.equal(open.available, true, open.reason);
  assert.equal(SIM.productionAvailability(state, plainWell).available, true);
});
