import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { packager } from '@electron/packager';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({ options: {
  platform: { type: 'string', default: process.platform },
  arch: { type: 'string', default: process.arch },
  'stage-only': { type: 'boolean', default: false }
} });
if (!['darwin', 'win32'].includes(values.platform)) throw new Error('Choose --platform=darwin or --platform=win32.');
if (!['arm64', 'x64'].includes(values.arch)) throw new Error('Choose --arch=arm64 or --arch=x64.');
if (!values['stage-only'] && process.platform !== values.platform) {
  throw new Error('Build desktop packages on the target OS. The build workflow provides macOS and Windows runners.');
}
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const checksums = JSON.parse(await readFile(path.join(root, 'node_modules/electron/checksums.json'), 'utf8'));
const title = '云岫山院·山院实景';
const stage = path.join(root, 'dist/staging/courtyard');
const output = path.join(root, 'dist/desktop');
const sourceDirectories = ['apps/courtyard', 'src/simulation', 'assets/courtyard'];
for (const directory of sourceDirectories) await readdir(path.join(root, directory));
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const directory of sourceDirectories) {
  await cp(path.join(root, directory), path.join(stage, directory), {
    recursive: true,
    filter: source => !path.basename(source).startsWith('.')
      && !source.endsWith('.test.mjs') && !source.endsWith('.md')
      && path.basename(source) !== 'sect-seed-build.mjs'
  });
}
// Runtime sources use built-in Node APIs and the packaged Electron runtime.
await writeFile(path.join(stage, 'package.json'), `${JSON.stringify({
  name: pkg.name, version: pkg.version, private: true, description: title,
  type: 'module', main: pkg.main
}, null, 2)}\n`);
console.log(`Desktop sources staged: ${path.relative(root, stage)}`);
if (!values['stage-only']) {
  const applications = await packager({
    dir: stage, out: output, name: title, executableName: 'yunxiu-courtyard-master',
    platform: values.platform, arch: values.arch,
    electronVersion: pkg.devDependencies.electron,
    download: { checksums },
    appVersion: pkg.version, appBundleId: 'games.xianfu.courtyard-master',
    appCategoryType: 'public.app-category.games',
    asar: false, prune: false, overwrite: true,
    win32metadata: { CompanyName: 'CyberShp', ProductName: title, FileDescription: title }
  });
  if (values.platform === 'darwin') {
    for (const application of applications) {
      execFileSync('codesign', ['--force', '--deep', '--sign', '-', path.join(application, `${title}.app`)], { stdio: 'inherit' });
    }
  }
  console.log(`Desktop package: ${applications.map(file => path.relative(root, file)).join(', ')}`);
}
