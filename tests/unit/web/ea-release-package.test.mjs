import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeb } from '../../../scripts/build/web.mjs';
import { checkWebBuild, localReferences } from '../../../scripts/check.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));

test('web package resolves module and asset paths for root and preview with one cache version', async () => {
  const output = path.join(root, 'dist', `test-web-${process.pid}`);
  try {
    await buildWeb({ tag: 'qa-package-test', output });
    const result = checkWebBuild(output);
    assert(result.references > 200);
    for (const prefix of ['', 'ea-preview/']) {
      const html = readFileSync(path.join(output, prefix, 'index.html'), 'utf8');
      assert.match(html, /ea-bootstrap\.mjs\?v=qa-package-test/);
      const scenic = readFileSync(path.join(output, prefix, 'ea-scenic.mjs'), 'utf8');
      assert(scenic.includes(prefix ? '../yunxiu-courtyard/navigation.mjs' : './yunxiu-courtyard/navigation.mjs'));
    }
    const manifest = JSON.parse(readFileSync(path.join(output, 'build-manifest.json'), 'utf8'));
    for (const entry of manifest.files.filter(entry => entry.path.endsWith('.mjs'))) {
      for (const ref of localReferences(entry.path, readFileSync(path.join(output, entry.path), 'utf8'))) {
        if (!/\.mjs(?:\?|$)/.test(ref)) continue;
        const url = new URL(ref, 'https://example.test/' + entry.path);
        assert.deepEqual(url.searchParams.getAll('v'), ['qa-package-test'], `${entry.path} → ${ref}`);
      }
    }
  } finally { rmSync(output, { recursive: true, force: true }); }
});
