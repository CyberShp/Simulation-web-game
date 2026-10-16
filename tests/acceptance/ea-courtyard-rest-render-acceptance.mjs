/** SR-XF-004/007/029: earned bed rest uses the shared character anchor and save. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';
import {restRenderAnchor} from '../../apps/web/ea-character-art.mjs';
import {spatialPrefab, spatialTransform, spatialProject} from '../../src/simulation/ea-sr-spatial.mjs';

test('normal earned bed rest keeps its reserved activity and shared character anchor', () => {
  const h = normalOpening();
  h.act('masterAction', 'rest');
  h.until(s => s.activitiesById[s.master.activityId]?.action === 'rest' && s.activitiesById[s.master.activityId].phase === 'executing', 'real resting arrival');
  h.act('setSpeed', 0);
  h.save();
  const saved = JSON.stringify(h.s);
  const activity = h.s.activitiesById[h.s.master.activityId];
  assert.equal(activity.phase, 'executing');
  assert.match(activity.slotId, /bed/);
  const anchor = restRenderAnchor(h.s, h.s.master, {
    prefab:spatialPrefab, transform:spatialTransform, project:spatialProject,
    camera:{scale:32,depth:.65,rotation:Math.PI/4,ox:0,oy:0},
  });
  assert.equal(anchor.poseVariant, 'bed-rest');
  assert.equal(JSON.stringify(h.s), saved);
});
