import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('copied simulation source loads and round-trips the desktop checkpoint without build output', () => {
  const clean = mkdtempSync(path.join(os.tmpdir(), 'immortal-source-'));
  try {
    cpSync(path.join(root, 'src/simulation'), path.join(clean, 'src/simulation'), { recursive: true });
    cpSync(path.join(root, 'apps/courtyard'), path.join(clean, 'apps/courtyard'), { recursive: true });
    writeFileSync(path.join(clean, 'check.mjs'), `
      import assert from 'node:assert/strict';
      import * as SIM from './src/simulation/ea-opening-sim.mjs';
      import {createSectSession,snapshotSect,restoreSect,commandSect,advanceSect} from './apps/courtyard/sect-sim.mjs';
      const session=createSectSession();
      assert.equal(SIM.validateSave(session.state).worldTick,session.state.worldTick);
      assert(commandSect(session,{type:'pause',paused:true}).ok);
      const before=snapshotSect(session);
      assert.deepEqual(snapshotSect(restoreSect(JSON.stringify(before))),before);
      advanceSect(session,10);
      assert.deepEqual(snapshotSect(session),before);
      assert(commandSect(session,{type:'pause',paused:false}).ok);
      advanceSect(session,.3);
      assert(session.state.worldTick>before.state.worldTick);
      const after=snapshotSect(session);
      assert.deepEqual(snapshotSect(restoreSect(JSON.stringify(after))),after);
    `);
    const run = spawnSync(process.execPath, ['check.mjs'], { cwd: clean, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  } finally { rmSync(clean, { recursive: true, force: true }); }
});
