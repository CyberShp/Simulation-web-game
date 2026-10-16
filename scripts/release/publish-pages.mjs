import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const web = path.join(root, 'dist/web');
const manifest = JSON.parse(await readFile(path.join(web, 'build-manifest.json'), 'utf8'));
const paths = [];
for (const entry of manifest.files) {
  if (path.isAbsolute(entry.path) || entry.path.split(/[\\/]/).includes('..') || paths.includes(entry.path)) {
    throw new Error(`Invalid Pages file path: ${entry.path}`);
  }
  const bytes = await readFile(path.join(web, entry.path));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== entry.bytes || sha256 !== entry.sha256) throw new Error(`Build file changed: ${entry.path}`);
  paths.push(entry.path);
}
paths.push('build-manifest.json');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const commit = git(['rev-parse', 'HEAD']);
if (values['dry-run']) {
  console.log(`Pages preflight: ${paths.length} verified files; source ${commit}; target gh-pages`);
} else {
  git(['fetch', 'origin', 'gh-pages:refs/remotes/origin/gh-pages']);
  const worktree = await mkdtemp(path.join(tmpdir(), 'immortal-pages-'));
  let attached = false;
  try {
    git(['worktree', 'add', '--detach', worktree, 'refs/remotes/origin/gh-pages']);
    attached = true;
    for (const filename of paths) {
      const destination = path.join(worktree, filename);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.join(web, filename), destination);
    }
    git(['add', '--', ...paths], worktree);
    const staged = git(['diff', '--cached', '--name-only'], worktree);
    if (!staged) {
      console.log(`Pages already matches source ${commit}.`);
    } else {
      git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
        'commit', '-m', `Build web from ${commit}`], worktree);
      git(['push', 'origin', 'HEAD:gh-pages'], worktree);
      console.log(`Pages source ${commit}; published ${git(['rev-parse', 'HEAD'], worktree)}; ${paths.length} files synchronized.`);
    }
  } finally {
    if (attached) git(['worktree', 'remove', '--force', worktree]);
    await rm(worktree, { recursive: true, force: true });
  }
}
