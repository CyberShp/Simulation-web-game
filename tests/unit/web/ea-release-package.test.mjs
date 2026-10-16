import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeb } from '../../../scripts/build/web.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('U-156: web build, preview and release commands fail before creating output', async () => {
  const isolated = mkdtempSync(path.join(os.tmpdir(), 'immortal-web-freeze-'));
  const output = path.join(isolated, 'dist/web');
  const commands = [
    [process.execPath, 'scripts/build/web.mjs', '--out', output],
    [process.execPath, 'scripts/dev/web.mjs', '--port', '0'],
    [process.execPath, 'scripts/release/publish-pages.mjs'],
    [process.execPath, 'scripts/release/request-pages-build.mjs'],
    [process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), 'scripts/release/package-pages.py', '--tag', 'qa-freeze', '--output', path.join(output, 'tree.json')],
  ];
  try {
    mkdirSync(output, { recursive: true });
    writeFileSync(path.join(output, 'sentinel.txt'), 'existing output');
    await assert.rejects(buildWeb({ tag: 'qa-freeze', output }), /U-156/);
    for (const [command, script, ...args] of commands) {
      const target = path.join(isolated, script);
      mkdirSync(path.dirname(target), { recursive: true });
      cpSync(path.join(root, script), target);
      const result = spawnSync(command, [target, ...args], { cwd: isolated, encoding: 'utf8', timeout: 5000,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
      assert.ifError(result.error);
      assert.equal(result.status, 1, `${script}: must reject execution`);
      assert.match(result.stderr, /U-156/, `${script}: must explain the publication freeze`);
      assert.deepEqual(readdirSync(output), ['sentinel.txt'], `${script}: output stays untouched`);
      assert.equal(readFileSync(path.join(output, 'sentinel.txt'), 'utf8'), 'existing output');
    }
  } finally { rmSync(isolated, { recursive: true, force: true }); }
});

test('U-156: repository workflows cannot publish or upload a web build', () => {
  assert.equal(existsSync(path.join(root, '.github/workflows/pages.yml')), false);
  assert.equal(existsSync(path.join(root, 'scripts/build/web-files.json')), false);
  for (const filename of readdirSync(path.join(root, '.github/workflows'))) {
    if (!/\.ya?ml$/.test(filename)) continue;
    const workflow = readFileSync(path.join(root, '.github/workflows', filename), 'utf8');
    assert.doesNotMatch(workflow, /build:web|publish-pages|request-pages-build|deploy-pages|dist\/web|pages:\s*write/, filename);
  }
});
