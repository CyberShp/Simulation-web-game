import { execFileSync } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({ options: {
  tag: { type: 'string' }, 'dry-run': { type: 'boolean', default: false }
} });
if (!values.tag || !/^v[0-9][A-Za-z0-9._-]*$/.test(values.tag)) throw new Error('Pass a version tag with --tag=v<version>.');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const commit = git(['rev-parse', `${values.tag}^{commit}`]);
let previous;
try { previous = git(['describe', '--tags', '--abbrev=0', `${values.tag}^`]); } catch { /* First release tag. */ }
const changes = git(['log', '--format=- %h %s', ...(previous ? [`${previous}..${values.tag}`] : ['--max-count=20', values.tag])]);
const directory = path.join(root, 'dist/release');
await mkdir(directory, { recursive: true });
const files = (await readdir(directory)).filter(file => /^yunxiu-courtyard-master-(?:darwin-(?:arm64|x64)|win32-x64)\.zip$/.test(file)).sort();
if (files.length !== 3) throw new Error('Expected macOS arm64, macOS x64 and Windows x64 ZIP files.');
const notes = `云岫山院桌面构建草稿。源码：${commit}\n\n包含 macOS arm64、macOS x64 和 Windows x64 构建产物。工作流已执行工程检查与单元测试；目标设备的实际游戏操作验收单独记录。macOS 包使用临时签名，公开分发的签名与公证待发布配置。\n\n变更记录${previous ? `（${previous} → ${values.tag}）` : ''}：\n\n${changes}\n`;
const notesFile = path.join(directory, 'release-notes.md');
await writeFile(notesFile, notes);
if (values['dry-run']) {
  console.log(`Draft release preflight: ${values.tag}; ${files.length} ZIP files; dist/release/release-notes.md`);
} else {
  const gh = args => execFileSync('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let existing;
  try { existing = JSON.parse(gh(['release', 'view', values.tag, '--json', 'isDraft'])); }
  catch (error) {
    if (!String(error.stderr).includes('release not found')) throw error;
  }
  if (existing) {
    if (!existing.isDraft) throw new Error(`Release ${values.tag} is already published; keep its contents unchanged.`);
    gh(['release', 'upload', values.tag, ...files.map(file => path.join(directory, file)), '--clobber']);
  } else {
    gh(['release', 'create', values.tag, ...files.map(file => path.join(directory, file)),
      '--verify-tag', '--draft', '--title', `云岫山院 ${values.tag}`, '--notes-file', notesFile]);
  }
  console.log(`Draft release prepared: ${values.tag}; ${files.length} ZIP files.`);
}
