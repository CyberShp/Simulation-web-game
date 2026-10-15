import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../dist/ea-opening-sim.mjs';

for (const sr of [true, false]) {
  test(`SR002 TX-01: committed healing replays through the inheritance gate (${sr ? 'SR' : 'legacy'})`, () => {
    const initial = SIM.initial({ sr, mountainOpening: true, seed: 618033 });
    const command = { name: 'masterAction', args: ['heal'], id: `command:${initial.transactions.nextCommandId}`, expectedRevision: initial.revision };
    const healed = SIM.dispatchCommand(initial, command);
    assert.equal(healed.state.story.opening.inheritance.status, 'pending');
    assert.equal(healed.state.resources.herb, initial.resources.herb - 6);
    for (const state of [healed.state, SIM.validateSave(JSON.parse(JSON.stringify(healed.state)))]) {
      const before = JSON.stringify(state);
      const replay = SIM.dispatchCommand(state, command);
      assert.equal(replay.replayed, true);
      assert.strictEqual(replay.state, state);
      assert.deepEqual(replay.result, healed.result);
      assert.equal(JSON.stringify(state), before);
      assert.throws(() => SIM.dispatchCommand(state, { ...command, args: ['rest'] }), /编号|复用|请求/);
      assert.throws(() => SIM.dispatchCommand(state, { name: 'masterAction', args: ['heal'] }), /先在包裹中择定/);
      assert.throws(() => SIM.dispatchCommand(state, { name: 'setSpeed', args: [1] }), /先在包裹中择定/);
      SIM.tick(state, 10);
      assert.equal(JSON.stringify(state), before, 'replay/rejection/read/load cannot advance a pending world');
      const selected = SIM.dispatchCommand(state, { name: 'chooseOpeningInheritance', args: ['qinglan'] });
      assert.notEqual(selected.state.story.opening.inheritance.status, 'pending');
      assert.equal(selected.state.resources.herb, state.resources.herb, 'choosing the chapter does not charge healing again');
    }
  });
}
