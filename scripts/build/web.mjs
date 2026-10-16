import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url));
const textExtensions = new Set(['.mjs', '.js', '.css', '.html', '.json', '.txt', '.md', '.svg']);
const mirroredExtensions = new Set(['.mjs', '.js', '.css', '.html']);
const slash = value => value.split(path.sep).join('/');
const isMirrored = target => !target.includes('/') && mirroredExtensions.has(path.extname(target));

function referencePath(source, reference, output, targets, preview) {
  const [, filename, suffix = ''] = reference.match(/^([^?#]*)(.*)$/);
  const resolved = path.resolve(path.dirname(source), filename);
  const target = targets.get(resolved);
  if (!target) return reference;
  const destination = preview && isMirrored(target) ? `ea-preview/${target}` : target;
  let relative = slash(path.relative(path.dirname(output), destination));
  if (!relative.startsWith('.')) relative = `./${relative}`;
  return relative + suffix;
}

function rewriteText(content, source, output, targets, preview, tag) {
  const rewrite = reference => referencePath(source, reference, output, targets, preview);
  // Source references include ESM imports, new URL(), HTML attributes and CSS URLs.
  content = content.replace(/(['"])(\.{1,2}\/[^'"\r\n]+)\1/g,
    (_match, quote, reference) => `${quote}${rewrite(reference)}${quote}`);
  content = content.replace(/url\((\.{1,2}\/[^)'"\s]+)\)/g,
    (_match, reference) => `url(${rewrite(reference)})`);
  // Asset loaders also concatenate a filename onto a quoted directory prefix.
  for (const [directory, publicDirectory] of [
    ['assets/web', 'assets'], ['apps/web/yunxiu-courtyard', 'yunxiu-courtyard'],
    ['src/simulation/vendor', 'vendor']
  ]) {
    let sourcePrefix = slash(path.relative(path.dirname(source), path.join(root, directory)));
    if (!sourcePrefix.startsWith('.')) sourcePrefix = `./${sourcePrefix}`;
    let outputPrefix = slash(path.relative(path.dirname(output), publicDirectory));
    if (!outputPrefix.startsWith('.')) outputPrefix = `./${outputPrefix}`;
    for (const quote of ["'", '"', '`']) {
      content = content.replaceAll(`${quote}${sourcePrefix}/`, `${quote}${outputPrefix}/`);
    }
  }
  // Replace each cache key once, keeping unrelated query parameters intact.
  return content.replace(/(['"])([^'"\s<>]+\.(?:mjs|css)(?:\?[^'"\s<>]*)?)\1/g,
    (_match, quote, reference) => {
      if (!reference.startsWith('.')) return `${quote}${reference}${quote}`;
      const url = new URL(reference, 'https://build.invalid/');
      url.searchParams.set('v', tag);
      const filename = reference.split(/[?#]/)[0];
      return `${quote}${filename}${url.search}${url.hash}${quote}`;
    });
}

function viewportPage(tag) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>仙府 · 网页视口验收</title><style>body{margin:0;background:#173e37;color:#f1ecd8;font:14px system-ui;display:grid;place-items:center;gap:8px;padding:12px}p{margin:0}iframe{border:1px solid #bcb17f;border-radius:12px;background:#e9eddb}</style><p id="label">网页视口验收 · 独立存档</p><iframe title="仙府网页视口试玩"></iframe><script>const q=new URLSearchParams(location.search),w=Math.max(320,Math.min(2560,Number(q.get('width'))||820)),h=Math.max(240,Math.min(1600,Number(q.get('height'))||1180)),scope=/^qa-[a-z0-9-]{1,48}$/.test(q.get('acceptance')||'')?q.get('acceptance'):'qa-viewport';document.querySelector('iframe').style.cssText=\`width:\${w}px;height:\${h}px\`;document.querySelector('iframe').src='./index.html?v=${encodeURIComponent(tag)}&acceptance='+scope;document.querySelector('#label').textContent=\`\${w} × \${h} · 独立存档网页视口验收\`;</script></html>\n`;
}

export async function buildWeb({ tag, output = path.join(root, 'dist/web') } = {}) {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  tag ??= pkg.version;
  if (!/^[A-Za-z0-9._-]+$/.test(tag)) throw new Error('Build tag must contain letters, numbers, dot, underscore or hyphen.');
  output = path.resolve(output);
  const buildRoot = path.join(root, 'dist');
  if (!output.startsWith(`${buildRoot}${path.sep}`)) throw new Error('Web output must be a directory inside dist/.');
  const files = JSON.parse(await readFile(new URL('./web-files.json', import.meta.url), 'utf8'));
  const targets = new Map(files.map(file => [path.join(root, file.source), file.target]));
  const seen = new Set();
  const prepared = [];
  for (const { source, target } of files) {
    if (seen.has(target) || path.isAbsolute(target) || target.split('/').includes('..')) throw new Error(`Invalid output path: ${target}`);
    seen.add(target);
    const filename = path.join(root, source);
    if (!(await stat(filename)).isFile()) throw new Error(`Missing source: ${source}`);
    const bytes = await readFile(filename);
    const text = textExtensions.has(path.extname(target)) || target.endsWith('LICENSE');
    for (const preview of isMirrored(target) ? [false, true] : [false]) {
      const destination = preview ? `ea-preview/${target}` : target;
      prepared.push({ target: destination, bytes: text
        ? Buffer.from(rewriteText(bytes.toString('utf8'), filename, destination, targets, preview, tag)) : bytes });
    }
  }
  for (const name of ['mobile.html', 'viewport.html']) prepared.push({ target: `ea-preview/${name}`, bytes: Buffer.from(viewportPage(tag)) });
  prepared.push({ target: '.nojekyll', bytes: Buffer.alloc(0) });
  await rm(output, { recursive: true, force: true });
  for (const entry of prepared) {
    const destination = path.join(output, entry.target);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, entry.bytes);
  }
  const manifest = { version: 1, tag, files: prepared.map(({ target, bytes }) => ({
    path: target, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')
  })) };
  await writeFile(path.join(output, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Web build: ${slash(path.relative(root, output))}; ${prepared.length} files; tag ${tag}`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { tag: { type: 'string' }, out: { type: 'string' } } });
  await buildWeb({ tag: values.tag, output: values.out });
}
