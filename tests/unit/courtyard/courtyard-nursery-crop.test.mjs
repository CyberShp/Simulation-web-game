import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import { SECT_DOMAIN } from '../../../src/simulation/ea-sect-domain.mjs';

test('the standard farm and granary keep their shipped crop recipes and unknown versions resolve to nothing', () => {
  assert.equal(SIM.cropRecipeFor({ type: 'farm' }), SIM.FARM_CROP_RECIPE);
  assert.equal(SIM.cropRecipeFor({ type: 'granary' }), SIM.GRANARY_CROP_RECIPE);
  assert.equal(SIM.cropRecipeFor({ type: 'farm', domainSiteId: 'site:domain:gc-21' }), SIM.FARM_CROP_RECIPE);
  assert.equal(SIM.cropRecipeFor({ type: 'lumber' }), null);
  assert.equal(SIM.cropRecipeFor({ type: 'farm', domainSiteId: 'site:domain:gc-22' }), SIM.NURSERY_CROP_RECIPE);
  assert.equal(SIM.cropRecipeByVersion('farm', 'herb-crop:yunxiu:v1'), SIM.FARM_CROP_RECIPE);
  assert.equal(SIM.cropRecipeByVersion('granary', 'grain-crop:yunxiu:v1'), SIM.GRANARY_CROP_RECIPE);
  assert.equal(SIM.cropRecipeByVersion('farm', 'seedling-crop:yunxiu:v1'), SIM.NURSERY_CROP_RECIPE);
  assert.equal(SIM.cropRecipeByVersion('farm', 'no-such-crop:v1'), null);
  assert.equal(SIM.cropRecipeByVersion('lumber', 'herb-crop:yunxiu:v1'), null);
});

test('the nursery parameters stay the registered T-27 values and are not yet reachable before its anchor exists', () => {
  const recipe = SIM.NURSERY_CROP_RECIPE;
  assert.equal(recipe.recipeId, 'recipe:farm:nursery');
  assert.equal(recipe.recipeVersion, 'seedling-crop:yunxiu:v1');
  assert.deepEqual(recipe.seedCost, { herb: 3 });
  assert.equal(recipe.maturityRequiredTicks, 160);
  assert.equal(recipe.careRequired, 240);
  assert.deepEqual(recipe.output, { herb: 18 });
  assert.equal(recipe.skill, 'plant');
  assert.equal(SIM.cropRecipeFor({ type: 'farm', domainSiteId: 'site:domain:gc-22' }, { phase: 'completed' }), recipe);
  assert.equal(SIM.cropRecipeFor({ type: 'farm', domainSiteId: 'site:domain:gc-22' }, { phase: 'active', recipeSnapshot: { recipeVersion: 'herb-crop:yunxiu:v1' } }), null);
  // The anchor waits for the west-valley plate; no fixed site identity exists yet.
  assert.equal(SECT_DOMAIN.sites.some(site => site.id === 'site:domain:gc-22'), false);
  assert.equal(SECT_DOMAIN.plannedSites.find(site => site.id === 'site:domain:gc-22').runtimeStatus, 'planning');
});
