import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const usage = 'node scripts/art/shen-yan-cast/pack-cast.mjs [sprites-directory] --qa-dir /absolute/qa-directory';
const args = process.argv.slice(2);
let directory = path.join(root, 'assets/characters/shen-yan/cast-study-v1/sprites');
let qaDirectory;
let positional = false;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--help' || arg === '-h') {
    console.log(usage);
    process.exit(0);
  } else if (arg === '--qa-dir') {
    if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing --qa-dir value. ${usage}`);
    qaDirectory = path.resolve(args[++index]);
  } else if (!arg.startsWith('-') && !positional) {
    directory = path.resolve(arg);
    positional = true;
  } else {
    throw new Error(`Unexpected argument: ${arg}. ${usage}`);
  }
}
if (!qaDirectory) throw new Error(`A separate QA directory is required. ${usage}`);
const within = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};
// Resolve existing ancestors so a QA symlink cannot put generated reviews in the repository.
async function resolveDestination(destination) {
  try { return await fs.realpath(destination); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await resolveDestination(path.dirname(destination)), path.basename(destination));
  }
}
qaDirectory = await resolveDestination(qaDirectory);
if (within(await fs.realpath(root), qaDirectory)) throw new Error('The QA directory must be outside the repository.');
directory = await fs.realpath(directory);
const manifestPath = path.join(directory, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const [width, height] = manifest.frameSize ?? [];
const expectedOrder = ['weapon', 'body', 'effect'];
const releaseFrames = manifest.frames?.flatMap((frame, index) => frame.event === 'release' ? [index] : []) ?? [];
if (manifest.frameCount !== 12 || manifest.frames?.length !== 12 || manifest.fps !== 12) throw new Error('Expected 12 frames at 12 fps.');
if (width !== 640 || height !== 512 || manifest.sourceHeight !== 384) throw new Error('Expected a 640 × 512 frame and sourceHeight 384.');
if (JSON.stringify(manifest.anchor) !== JSON.stringify([255, 456])) throw new Error('Expected foot anchor [255, 456].');
if (JSON.stringify(manifest.layerOrder) !== JSON.stringify(expectedOrder)) throw new Error('Expected layerOrder weapon, body, effect.');
if (releaseFrames.length !== 1 || releaseFrames[0] !== 5) throw new Error('Expected a single release event at frame 5.');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const frameName = (layer, index) => `${layer}-${String(index).padStart(3, '0')}.png`;
const roundPoint = point => point.map(value => Math.round(value));
const validPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
  && point[0] >= 0 && point[0] < width && point[1] >= 0 && point[1] < height;

function alphaMetrics(data) {
  let visiblePixels = 0, opaquePixels = 0, partialAlphaPixels = 0, boundaryPixels = 0;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (!alpha) continue;
      visiblePixels += 1;
      if (alpha === 255) opaquePixels += 1;
      else partialAlphaPixels += 1;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) boundaryPixels += 1;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return {
    width, height, visiblePixels, opaquePixels, partialAlphaPixels,
    transparentPixels: width * height - visiblePixels, boundaryPixels,
    bounds: visiblePixels ? [left, top, right, bottom] : null,
  };
}

async function readLayer(name) {
  if (path.basename(name) !== name || !name.endsWith('.png')) throw new Error(`Expected a local PNG filename: ${name}`);
  const bytes = await fs.readFile(path.join(directory, name));
  const image = await loadImage(bytes);
  if (image.width !== width || image.height !== height) throw new Error(`Unexpected dimensions: ${name}`);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  const metrics = alphaMetrics(pixels);
  if (!metrics.visiblePixels || !metrics.transparentPixels) throw new Error(`Expected nonempty transparent layer: ${name}`);
  if (metrics.boundaryPixels) throw new Error(`Layer reaches the canvas boundary: ${name}`);
  return { name, canvas, pixels, metrics, sha256: hash(bytes) };
}

const sources = [];
for (const [index, frame] of manifest.frames.entries()) {
  if (frame.index !== undefined && frame.index !== index) throw new Error(`Frame index mismatch: ${index}`);
  if (!validPoint(frame.finger) || !validPoint(frame.grip)) throw new Error(`Invalid finger or grip point: ${index}`);
  if (!(Number.isFinite(frame.durationMs) && frame.durationMs > 0) || typeof frame.phase !== 'string') throw new Error(`Invalid timing or phase: ${index}`);
  for (const layer of ['body', 'weapon']) {
    if (frame[layer] !== frameName(layer, index)) throw new Error(`Unexpected ${layer} filename at frame ${index}`);
  }
  const [body, weapon] = await Promise.all([readLayer(frame.body), readLayer(frame.weapon)]);
  sources.push({ body, weapon });
}

const releasePoint = roundPoint(manifest.frames[5].finger);
const trajectory = [];
const generated = new Map();
const composites = [];
const metrics = [];
const colors = { edge: '#174f59', cyan: '#72d6e8', pale: '#b9f6fc', core: '#efffff' };
function square(context, x, y, size, color, alpha = 1) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), size, size);
}
function effectLayer(index, source) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  let projectileHead = null;
  if (index === 3 || index === 4) {
    const [x, y] = roundPoint(manifest.frames[index].finger);
    const strength = index === 3 ? 0.55 : 0.9;
    square(context, x + 4, y - 2, 5, colors.edge, strength);
    square(context, x + 5, y - 1, 3, colors.core, strength);
    square(context, x + 7, y - 5, 2, colors.cyan, strength * 0.6);
    square(context, x + 10, y + 3, 2, colors.pale, strength * 0.7);
    if (index === 4) square(context, x + 13, y - 2, 2, colors.pale, 0.6);
  }
  if (index >= 5 && index <= 8) {
    const step = index - 5;
    const displacement = [0, 32, 68, 108][step];
    const length = [34, 38, 31, 20][step];
    const opacity = [1, 0.95, 0.7, 0.35][step];
    const x = releasePoint[0] + 5 + displacement, y = releasePoint[1];
    if (x + length + 3 >= width || y - 7 < 0 || y + 7 >= height) throw new Error('Projectile trajectory exceeds the frame.');
    context.fillStyle = colors.edge; context.globalAlpha = opacity * 0.9;
    context.fillRect(x + 1, y - 4, length - 3, 9);
    context.fillStyle = colors.cyan; context.globalAlpha = opacity;
    context.fillRect(x + 2, y - 3, length - 5, 6);
    context.fillStyle = colors.pale; context.globalAlpha = opacity * 0.85;
    context.fillRect(x + 5, y - 2, length - 5, 4);
    context.fillStyle = colors.core; context.globalAlpha = opacity;
    context.fillRect(x + 8, y - 1, length - 7, 2);
    square(context, x + length, y - 1, 2, colors.pale, opacity * 0.7);
    square(context, x, y - 5, 2, colors.cyan, opacity * 0.55);
    square(context, x + 6, y + 5, 2, colors.pale, opacity * 0.45);
    if (step < 3) square(context, x - 5, y + 2, 2, colors.cyan, opacity * 0.35);
    projectileHead = [x + length + 1, y];
  }
  context.globalAlpha = 1;
  const image = context.getImageData(0, 0, width, height);
  let silhouettePixelsCleared = 0;
  // Keep the visible hand, face, clothing, and weapon pixels available for inspection.
  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] && (source.body.pixels[offset] || source.weapon.pixels[offset])) {
      image.data.fill(0, offset - 3, offset + 1);
      silhouettePixelsCleared += 1;
    }
  }
  context.putImageData(image, 0, 0);
  trajectory.push({ frame: index, release: index === 5, origin: [...releasePoint], head: projectileHead });
  return { canvas, metrics: { ...alphaMetrics(image.data), silhouettePixelsCleared } };
}

for (const [index, source] of sources.entries()) {
  const frame = manifest.frames[index];
  const effect = effectLayer(index, source);
  if ((index >= 3 && index <= 8) !== (effect.metrics.visiblePixels > 0)) throw new Error(`Unexpected effect visibility at frame ${index}`);
  if (effect.metrics.boundaryPixels) throw new Error(`Effect reaches the canvas boundary at frame ${index}`);
  const composite = createCanvas(width, height);
  const context = composite.getContext('2d');
  context.drawImage(source.weapon.canvas, 0, 0);
  context.drawImage(source.body.canvas, 0, 0);
  context.drawImage(effect.canvas, 0, 0);
  const compositePixels = context.getImageData(0, 0, width, height).data;
  frame.index = index;
  frame.effect = frameName('effect', index);
  frame.composite = frameName('cast', index);
  generated.set(frame.effect, effect.canvas.toBuffer('image/png'));
  generated.set(frame.composite, composite.toBuffer('image/png'));
  frame.sha256 = {
    body: source.body.sha256, weapon: source.weapon.sha256,
    effect: hash(generated.get(frame.effect)), composite: hash(generated.get(frame.composite)),
  };
  composites.push({ canvas: composite, pixels: compositePixels });
  metrics.push({ index, phase: frame.phase, event: frame.event ?? null,
    finger: frame.finger, grip: frame.grip, body: source.body.metrics,
    weapon: source.weapon.metrics, effect: effect.metrics, composite: alphaMetrics(compositePixels),
    bodyBottomFromAnchor: source.body.metrics.bounds[3] - manifest.anchor[1],
  });
}

const columns = 4;
const rows = Math.ceil(manifest.frameCount / columns);
const atlas = createCanvas(width * columns, height * rows);
const atlasContext = atlas.getContext('2d');
manifest.atlas = 'cast-atlas.png';
manifest.frameRects = composites.map(({ canvas }, index) => {
  const rectangle = [index % columns * width, Math.floor(index / columns) * height, width, height];
  atlasContext.drawImage(canvas, rectangle[0], rectangle[1]);
  return rectangle;
});
generated.set(manifest.atlas, atlas.toBuffer('image/png'));
manifest.frameSha256 = manifest.frames.map(frame => frame.sha256.composite);
manifest.sha256 = Object.fromEntries(sources.flatMap(source => [
  [source.body.name, source.body.sha256], [source.weapon.name, source.weapon.sha256],
]).concat([...generated].map(([name, bytes]) => [name, hash(bytes)])));
manifest.effectStudy = {
  method: 'procedural-pixel-canvas', releaseFrame: 5, releasePoint,
  direction: [1, 0], chargeFrames: [3, 4], projectileFrames: [5, 6, 7, 8], trajectory,
};

function contactSheet(background, ink) {
  const labelHeight = 34, gutter = 12;
  const canvas = createCanvas(columns * (width + gutter) + gutter, rows * (height + labelHeight + gutter) + gutter);
  const context = canvas.getContext('2d');
  context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = '16px sans-serif'; context.textBaseline = 'top';
  for (const [index, composite] of composites.entries()) {
    const x = gutter + index % columns * (width + gutter);
    const y = gutter + Math.floor(index / columns) * (height + labelHeight + gutter);
    context.drawImage(composite.canvas, x, y);
    context.fillStyle = ink;
    const frame = manifest.frames[index];
    context.fillText(`FRAME ${String(index).padStart(2, '0')} · ${frame.durationMs} ms${frame.event ? ` · ${frame.event}` : ''}`, x + 12, y + height + 4);
  }
  return canvas.toBuffer('image/png');
}

function pixelDifference(first, last) {
  let changedPixels = 0, absoluteChannelDifference = 0;
  for (let offset = 0; offset < first.length; offset += 4) {
    let changed = false;
    for (let channel = 0; channel < 4; channel += 1) {
      const difference = Math.abs(first[offset + channel] - last[offset + channel]);
      absoluteChannelDifference += difference;
      changed ||= difference > 0;
    }
    if (changed) changedPixels += 1;
  }
  return { changedPixels, fractionOfFrame: changedPixels / (width * height), absoluteChannelDifference };
}
const report = {
  frameSize: [width, height], frameCount: manifest.frameCount, fps: manifest.fps,
  durationMs: manifest.frames.reduce((total, frame) => total + frame.durationMs, 0),
  anchor: manifest.anchor, releaseFrames, trajectory, frames: metrics,
  firstLastPixelDifference: {
    body: pixelDifference(sources[0].body.pixels, sources.at(-1).body.pixels),
    weapon: pixelDifference(sources[0].weapon.pixels, sources.at(-1).weapon.pixels),
    composite: pixelDifference(composites[0].pixels, composites.at(-1).pixels),
  },
  footBottomRange: [Math.min(...metrics.map(frame => frame.body.bounds[3])), Math.max(...metrics.map(frame => frame.body.bounds[3]))],
  resources: manifest.sha256,
};
const qaOutputs = new Map([
  ['cast-contact-white.png', contactSheet('#ffffff', '#16303a')],
  ['cast-contact-dark.png', contactSheet('#17252d', '#d9eff2')],
]);
// All source files are read and validated before generated resources are saved.
for (const source of sources) {
  for (const layer of [source.body, source.weapon]) {
    if (hash(await fs.readFile(path.join(directory, layer.name))) !== layer.sha256) throw new Error(`Source changed during packing: ${layer.name}`);
  }
}
async function writeAtomic(destination, bytes) {
  const temporary = `${destination}.tmp-${process.pid}`;
  await fs.writeFile(temporary, bytes);
  await fs.rename(temporary, destination);
}
await fs.mkdir(qaDirectory, { recursive: true });
for (const [name, bytes] of generated) await writeAtomic(path.join(directory, name), bytes);
const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
await writeAtomic(manifestPath, manifestBytes);
report.manifestSha256 = hash(manifestBytes);
for (const [name, bytes] of qaOutputs) await writeAtomic(path.join(qaDirectory, name), bytes);
await writeAtomic(path.join(qaDirectory, 'cast-pack-report.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, digest] of Object.entries(manifest.sha256)) {
  if (hash(await fs.readFile(path.join(directory, name))) !== digest) throw new Error(`Saved hash mismatch: ${name}`);
}
console.log(JSON.stringify({
  directory, qaDirectory, frameCount: manifest.frameCount, frameSize: manifest.frameSize,
  durationMs: report.durationMs, releaseFrames, footBottomRange: report.footBottomRange,
  firstLastPixelDifference: report.firstLastPixelDifference,
  effectVisiblePixels: metrics.map(frame => frame.effect.visiblePixels),
  atlas: [atlas.width, atlas.height], manifestSha256: report.manifestSha256,
  report: path.join(qaDirectory, 'cast-pack-report.json'),
}, null, 2));
