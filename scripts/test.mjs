import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const suites = {
  quick: [
    'tests/unit/courtyard',
    'tests/unit/engineering',
    'tests/unit/web/ea-persistence.test.mjs',
    'tests/unit/web/ea-runtime.test.mjs',
    'tests/unit/web/ea-scene-geometry.test.mjs',
    'tests/unit/web/ea-sr-spatial-door-replan.test.mjs',
    'tests/unit/web/ea-opening-replay-gate.test.mjs',
    'tests/unit/web/ea-release-package.test.mjs',
  ],
  all: ['tests/unit'],
};

function filesAt(relative) {
  if (/\.test\.(?:mjs|cjs)$/.test(relative)) return [relative];
  return readdirSync(path.join(root, relative), { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? filesAt(`${relative}/${entry.name}`)
      : /\.test\.(?:mjs|cjs)$/.test(entry.name) ? [`${relative}/${entry.name}`] : []);
}

if (args.includes('--help')) {
  console.log('Usage: npm test [-- --all | tests/unit/...test.mjs]');
  console.log('Default: courtyard behavior, shared persistence/clock/space, source and web packaging.');
  console.log('Desktop migration: node tests/acceptance/courtyard-migration-desktop.mjs --source-save=/absolute/paused-save.json');
  console.log('Long autonomy: node tests/acceptance/courtyard-autonomy-desktop.mjs --app=/absolute/package.app --source=/absolute/paused-save.json --output=/absolute/evidence');
  process.exit(0);
}

const all = args.includes('--all');
const selected = args.filter(arg => arg !== '--all');
for (const filename of selected) {
  if (!/^tests\/unit\/.*\.test\.(?:mjs|cjs)$/.test(filename)) throw Error(`Unsupported test path: ${filename}`);
}
const files = [...new Set((selected.length ? selected : suites[all ? 'all' : 'quick']).flatMap(filesAt))].sort();
console.log(`Running ${selected.length ? 'selected' : all ? 'all unit' : 'default'} suite (${files.length} files).`);
const run = spawnSync(process.execPath, ['--test', '--test-concurrency=4', ...files], { cwd: root, stdio: 'inherit' });
if (run.error) throw run.error;
process.exit(run.status ?? 1);
