import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('Set GITHUB_REPOSITORY to owner/repository.');
const api = (suffix, method = 'GET') => JSON.parse(execFileSync('gh', ['api', '--method', method,
  `repos/${repository}/pages${suffix}`], { cwd: root, encoding: 'utf8' }));
const settings = api('');
if (settings.source?.branch !== 'gh-pages' || settings.source?.path !== '/') {
  throw new Error('Pages must use the existing gh-pages branch root. Check repository Pages settings.');
}
const revision = execFileSync('git', ['ls-remote', 'origin', 'refs/heads/gh-pages'], { cwd: root, encoding: 'utf8' }).trim().split(/\s/)[0];
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Cannot resolve the published Pages revision.');
api('/builds', 'POST');
let previousStatus;
for (let attempt = 0; attempt < 30; attempt += 1) {
  const build = api('/builds/latest');
  const status = `${build.commit}:${build.status}`;
  if (status !== previousStatus) { console.log(`Pages build ${build.commit}: ${build.status}`); previousStatus = status; }
  if (build.commit === revision && build.status === 'built') {
    console.log(`Pages published ${revision}: ${settings.html_url}`);
    process.exit(0);
  }
  if (build.commit === revision && build.status === 'errored') throw new Error(build.error?.message || 'Pages build failed.');
  await new Promise(resolve => setTimeout(resolve, 10000));
}
throw new Error(`Timed out waiting for Pages build ${revision}.`);
