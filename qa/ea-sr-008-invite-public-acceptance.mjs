/** SR-XF-008-AC-01: a real opening invitation, repeat, changed condition and recovery. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

test('SR-XF-008-AC-01: repeated public invitation keeps one choice until the facility condition changes', () => {
  const h = normalOpening();
  const personId = 'person:lu-zhiwei';
  const facility = h.s.buildings.find(b => b.type === 'lumber');
  assert(facility?.enabled, 'the opening produced a working lumber facility');
  assert(h.s.homeMemberIds.includes(personId), 'the companion joined by the opening choice');
  const sourceTick = h.s.worldTick;
  const persistence = createEAPersistence({validate: SIM.validateSave, dataVersion: 6, gameVersion: '1.6.0-dev', writerId: 'qa-sr008-ac01'});
  const evidenceDir = process.env.XIANFU_QA_SR008_DIR;
  const checkpoint = label => {
    h.save();
    const serialized = JSON.stringify(h.s);
    const exported = persistence.exportState(h.s, {slot: 1});
    const restored = persistence.parseImport(exported);
    assert.equal(restored.ok, true, `${label}: native save envelope imports cleanly`);
    assert.equal(JSON.stringify(restored.state), serialized, `${label}: save/reload preserves the complete state`);
    assert.equal(renderSRPanel(restored.state, SIM, 'disciples'), renderSRPanel(h.s, SIM, 'disciples'),
      `${label}: management card keeps the same public reason after reload`);
    assert.equal(JSON.stringify(h.s), serialized, `${label}: read-only card leaves the world untouched`);
    if (!evidenceDir) return;
    const dir = resolve(evidenceDir);
    mkdirSync(dir, {recursive: true});
    const provenance = {kind: 'normal-public-command-checkpoint', label: `SR-XF-008-AC-01 ${label}`, counts: h.counts};
    writeFileSync(resolve(dir, `${label}.json`), JSON.stringify({provenance, state: h.s}));
    writeFileSync(resolve(dir, `${label}-import.json`), exported);
  };
  const publicCard = () => renderSRPanel(h.s, SIM, 'disciples');

  const accepted = h.act('inviteWork', personId, facility.instanceId);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.available, true);
  assert.match(accepted.publicReason, /愿在承诺期内承担/);
  assert.match(publicCard(), /陆知微<\/h4><p[^>]*>我愿在承诺期内承担这份差事/,
    'the visible management card immediately reflects the accepted work choice');
  assert.match(publicCard(), /陆知微<\/h4>[\s\S]*?本次承诺尚余24游戏秒/);
  const initialUntil = h.s.personsById[personId].schedule.commitUntilTick;
  checkpoint('accepted');

  for (let i = 0; i < 3; i++) {
    const repeat = h.act('inviteWork', personId, facility.instanceId);
    assert.deepEqual(repeat, accepted, 'a fresh public click with unchanged conditions keeps the decision');
    assert.equal(h.s.personsById[personId].schedule.commitUntilTick, initialUntil,
      'repeated clicks cannot extend the commitment');
  }
  assert.equal(h.s.worldTick, sourceTick, 'invitation and read-only projection do not advance the world');
  checkpoint('repeated');

  h.act('toggleBuilding', facility.id);
  const unavailable = h.act('inviteWork', personId, facility.instanceId);
  assert.equal(unavailable.accepted, false);
  assert.equal(unavailable.available, false);
  assert.match(unavailable.publicReason, /设施停用/);
  assert.notEqual(unavailable.signature, accepted.signature);
  assert.match(publicCard(), /陆知微<\/h4><p[^>]*>设施暂停运行/,
    'the visible management card no longer describes the interrupted work promise');
  assert.match(publicCard(), /陆知微<\/h4>[\s\S]*?本次承诺尚余0游戏秒/,
    'the stopped work cannot display its former active commitment');
  assert.deepEqual(h.act('inviteWork', personId, facility.instanceId), unavailable,
    'repeating the unavailable offer cannot reroll it');
  checkpoint('unavailable');

  h.until(s => s.worldTick > sourceTick, 'a real world step after facility change', 1);
  h.act('toggleBuilding', facility.id);
  const renewed = h.act('inviteWork', personId, facility.instanceId);
  assert.equal(renewed.accepted, true);
  assert.equal(renewed.available, true);
  assert.equal(renewed.atTick, sourceTick + 1);
  assert.equal(h.s.personsById[personId].schedule.commitUntilTick, renewed.atTick + SIM.AUTONOMY.commitTicks);
  assert.match(publicCard(), /陆知微<\/h4><p[^>]*>我愿在承诺期内承担这份差事/);
  checkpoint('renewed');

  h.until(s => s.activitiesById[s.personsById[personId].activityId]?.phase === 'executing',
    'the voluntarily accepting person arrives at the real work slot', 300);
  const activity = h.s.activitiesById[h.s.personsById[personId].activityId];
  assert.equal(activity.targetId, facility.instanceId);
  assert(activity.slotId && activity.reservationId, 'actual execution owns one work slot');
  assert.match(publicCard(), /正在使用作业工位/);
  checkpoint('working');
});
