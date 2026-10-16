import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function buildWeb() {
  throw new Error('U-156: 网页构建已停用。用户完成网页版重构并明确恢复发布后，才能建立新的网页构建。');
}

if (process.argv[1] && realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  buildWeb().catch(error => { console.error(error.message); process.exitCode = 1; });
}
