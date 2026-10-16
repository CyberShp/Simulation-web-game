import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FRAME_TABLE } from '../apps/courtyard/courtyard-layers.mjs';
import { EAST_IMAGES, EAST_SEAMS } from '../apps/courtyard/courtyard-east-layout.mjs';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceExtensions = /\.(?:mjs|cjs|js|css|html)$/;
const assetExtension = /\.(?:png|jpe?g|webp|svg|gif|woff2?|ttf|otf|mp3|ogg|wav|json)(?:[?#].*)?$/i;
const remote = /^(?:[a-z][\w+.-]*:|\/\/|#)/i;
const sha = value => createHash('sha256').update(value).digest('hex');
const slash = value => value.split(path.sep).join('/');

export function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  });
}

/** Literal dependencies used by the source and the generated static site. */
export function localReferences(filename, text) {
  const refs = new Set();
  const add = value => { if (value && !remote.test(value) && !value.includes('${')) refs.add(value); };
  if (/\.(?:mjs|cjs|js)$/.test(filename)) {
    for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('.')) add(match[1]);
    }
    for (const match of text.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) if (match[1].startsWith('.')) add(match[1]);
    for (const match of text.matchAll(/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g)) add(match[1]);
    for (const match of text.matchAll(/['"]((?:\.\.?\/|assets\/)[^'"\n]+)['"]/g)) if (assetExtension.test(match[1])) add(match[1]);
  }
  if (/\.html$/.test(filename)) {
    for (const match of text.matchAll(/<(?:script|link|img|source|audio|video)\b[^>]*?\b(?:src|href|poster)\s*=\s*['"]([^'"]+)['"]/gi)) add(match[1]);
  }
  if (/\.(?:css|html)$/.test(filename)) {
    for (const match of text.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) add(match[1]);
    for (const match of text.matchAll(/@import\s*['"]([^'"]+)['"]/g)) add(match[1]);
  }
  return [...refs];
}

function requireFile(filename, label = filename) {
  assert(existsSync(filename) && statSync(filename).isFile(), `Missing file: ${label}`);
}

function resolveReference(filename, ref, root) {
  const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
  return clean.startsWith('/') ? path.join(root, clean) : path.resolve(path.dirname(filename), clean);
}

export function checkWebBuild(directory) {
  requireFile(path.join(directory, 'build-manifest.json'));
  const manifest = JSON.parse(readFileSync(path.join(directory, 'build-manifest.json'), 'utf8'));
  assert.equal(manifest.version, 1);
  assert(manifest.tag && Array.isArray(manifest.files) && manifest.files.length > 0);
  const published = new Set();
  let references = 0;
  for (const entry of manifest.files) {
    assert(!published.has(entry.path), `Duplicate published path: ${entry.path}`);
    assert(!path.isAbsolute(entry.path) && !entry.path.split('/').includes('..'), `Unsafe published path: ${entry.path}`);
    published.add(entry.path);
    const filename = path.join(directory, entry.path);
    requireFile(filename, entry.path);
    const bytes = readFileSync(filename);
    assert.equal(bytes.length, entry.bytes, `${entry.path}: byte length`);
    assert.equal(sha(bytes), entry.sha256, `${entry.path}: content digest`);
    if (!sourceExtensions.test(filename)) continue;
    for (const ref of localReferences(filename, bytes.toString('utf8'))) {
      const target = resolveReference(filename, ref, directory);
      assert(!path.relative(directory, target).startsWith('..'), `${entry.path}: reference leaves release: ${ref}`);
      requireFile(target, `${entry.path} → ${ref}`);
      references++;
    }
  }
  for (const required of ['index.html', 'ea-preview/index.html', 'ea-opening-sim.mjs', 'ea-preview/ea-opening-sim.mjs']) {
    assert(published.has(required), `Required public entry missing: ${required}`);
  }
  return { files: published.size, references, tag: manifest.tag };
}

export function checkSources(root = repositoryRoot) {
  let references = 0;
  const files = ['apps/courtyard', 'apps/web', 'src/simulation'].flatMap(dir => walk(path.join(root, dir))).filter(file => sourceExtensions.test(file));
  for (const filename of files) {
    for (const ref of localReferences(filename, readFileSync(filename, 'utf8'))) {
      const courtyardAsset = filename.startsWith(path.join(root, 'apps/courtyard') + path.sep) && ref.startsWith('assets/');
      const target = courtyardAsset ? path.join(root, 'assets/courtyard', ref.slice(7).split(/[?#]/)[0]) : resolveReference(filename, ref, root);
      requireFile(target, `${slash(path.relative(root, filename))} → ${ref}`);
      references++;
    }
  }
  const mapping = JSON.parse(readFileSync(path.join(root, 'scripts/build/web-files.json'), 'utf8'));
  const targets = new Set();
  for (const entry of mapping) {
    assert(!targets.has(entry.target), `Duplicate web target: ${entry.target}`);
    targets.add(entry.target);
    requireFile(path.join(root, entry.source), entry.source);
  }
  const courtyardAssets = new Set(['courtyard-master-v2.png', 'courtyard-clean-v2.png', 'courtyard-fallow-v2.png', 'courtyard-domain-v1.png',
    ...Object.values(EAST_IMAGES), ...EAST_SEAMS.map(seam => seam.image), ...Object.values(FRAME_TABLE).map(frame => frame.atlas.replace(/^assets\//, ''))]);
  for (const name of courtyardAssets) requireFile(path.join(root, 'assets/courtyard', name), `courtyard image ${name}`);
  const design = JSON.parse(readFileSync(path.join(root, 'docs/design/manifest.json'), 'utf8'));
  const currentEntries = [design.entry, design.index, ...(design.requiredRead || []), ...(design.files || []).map(entry => entry.path)];
  for (const entry of currentEntries.filter(Boolean)) requireFile(path.join(root, entry.split('#')[0]), entry);
  for (const required of ['README.md', 'AGENTS.md', 'docs/CODEX-HANDOFF.md', 'docs/design/STATUS.md', 'docs/requirements/registry.json']) requireFile(path.join(root, required), required);
  return { modules: files.length, references, courtyardAssets: courtyardAssets.size, publishInputs: mapping.length, documentEntries: new Set(currentEntries).size };
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed`);
}

async function main() {
  const sourceOnly = process.argv.includes('--source-only');
  console.log('Source:', checkSources());
  run(process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['scripts/requirements/sr-manager.py', 'validate']);
  if (!sourceOnly) {
    run(process.execPath, ['scripts/build/web.mjs']);
    console.log('Web release:', checkWebBuild(path.join(repositoryRoot, 'dist/web')));
  }
  console.log('Engineering checks passed.');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
}
