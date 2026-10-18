import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const usage = 'node scripts/art/shen-yan-guard/pack-guard.mjs [sprites-directory] --qa-dir /absolute/qa-directory';
const args = process.argv.slice(2);
let directory = path.join(root, 'assets/characters/shen-yan/guard-study-v1/sprites');
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
const expectedOrder = ['effectBehind', 'equipment', 'body', 'effectFront'];
const activeFrames = [2, 3, 4, 5, 6, 7, 8, 9];
const expectedEvents = { 5: 'guard-start', 7: 'pressure', 9: 'guard-end' };
if (manifest.frameCount !== 12 || manifest.frames?.length !== 12 || manifest.fps !== 12) throw new Error('Expected 12 frames at reference 12 fps.');
if (width !== 640 || height !== 512 || manifest.sourceHeight !== 384 || manifest.nominalHeight !== 80) throw new Error('Expected a 640 × 512 frame, sourceHeight 384 and nominalHeight 80.');
if (JSON.stringify(manifest.anchor) !== JSON.stringify([255, 456])) throw new Error('Expected foot anchor [255, 456].');
if (JSON.stringify(manifest.layerOrder) !== JSON.stringify(expectedOrder)) throw new Error('Expected layerOrder effectBehind, equipment, body, effectFront.');
if (JSON.stringify(manifest.holdRange) !== JSON.stringify([5, 8])) throw new Error('Expected holdRange [5, 8].');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const frameName = (layer, index) => `${layer}-${String(index).padStart(3, '0')}.png`;
const roundPoint = point => point.map(value => Math.round(value));
const validPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
  && point[0] >= 0 && point[0] < width && point[1] >= 0 && point[1] < height;

function alphaMetrics(data) {
  let visiblePixels = 0, opaquePixels = 0, partialAlphaPixels = 0, boundaryPixels = 0, maximumAlpha = 0;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (!alpha) continue;
      visiblePixels += 1;
      if (alpha === 255) opaquePixels += 1;
      else partialAlphaPixels += 1;
      maximumAlpha = Math.max(maximumAlpha, alpha);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) boundaryPixels += 1;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return { width, height, visiblePixels, opaquePixels, partialAlphaPixels, maximumAlpha,
    transparentPixels: width * height - visiblePixels, boundaryPixels,
    bounds: visiblePixels ? [left, top, right, bottom] : null };
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
  if (frame.index !== index) throw new Error(`Frame index mismatch: ${index}`);
  if (!Array.isArray(frame.palms) || frame.palms.length !== 2 || !frame.palms.every(validPoint)) throw new Error(`Invalid palm points: ${index}`);
  if (JSON.stringify(frame.foot) !== JSON.stringify(manifest.anchor)) throw new Error(`Foot anchor mismatch: ${index}`);
  if (!(Number.isFinite(frame.durationMs) && frame.durationMs > 0) || typeof frame.phase !== 'string') throw new Error(`Invalid timing or phase: ${index}`);
  if (![frame.guardStrength, frame.pressure, frame.shieldRise].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error(`Invalid shield strength, pressure or rise: ${index}`);
  if ((frame.guardStrength > 0) !== activeFrames.includes(index)) throw new Error(`Unexpected shield visibility at frame ${index}`);
  if ((frame.pressure > 0) !== [7, 8].includes(index)) throw new Error(`Unexpected pressure response at frame ${index}`);
  if (index >= 5 && index <= 9 && frame.shieldRise !== 1) throw new Error(`Expected a closed shield at frame ${index}`);
  if (index >= 2 && index <= 5 && frame.shieldRise <= manifest.frames[index - 1].shieldRise) throw new Error(`Shield must rise from the ground at frame ${index}`);
  if ((frame.event ?? null) !== (expectedEvents[index] ?? null)) throw new Error(`Guard event mismatch: ${index}`);
  for (const layer of ['body', 'equipment']) {
    if (frame[layer] !== frameName(layer, index)) throw new Error(`Unexpected ${layer} filename at frame ${index}`);
  }
  const [body, equipment] = await Promise.all([readLayer(frame.body), readLayer(frame.equipment)]);
  sources.push({ body, equipment });
}

const generated = new Map();
const composites = [];
const metrics = [];
const geometry = [];
const colors = { dark: '#216376', cyan: '#72d7e5', pale: '#c7f4ef', gold: '#d4bf7d', core: '#ebf8da' };
const snap = value => Math.round(value / 2) * 2;
function square(context, x, y, size, color, alpha = 1) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(snap(x), snap(y), size, size);
}
function stroke(context, points, color, alpha, thickness = 2) {
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = thickness;
  context.lineJoin = 'bevel';
  context.lineCap = 'butt';
  context.beginPath();
  points.forEach(([x, y], index) => index ? context.lineTo(snap(x), snap(y)) : context.moveTo(snap(x), snap(y)));
  if (points.length > 2 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) context.closePath();
  context.stroke();
}
function curve(shape, from, to, scale = 1, points = 48) {
  const result = Array.from({ length: points + 1 }, (_, index) => {
    const angle = from + (to - from) * index / points;
    const y = shape.cy + Math.sin(angle) * shape.ry * scale;
    return [shape.cx + Math.cos(angle) * shape.rx * scale + (y - shape.cy) * shape.shear, y];
  });
  if (Math.abs(Math.abs(to - from) - Math.PI * 2) < 1e-8) result[result.length - 1] = [...result[0]];
  return result;
}
function shieldGeometry(frame, index) {
  const palms = frame.palms.map(roundPoint);
  const cx = frame.foot[0], cy = 265, rx = 220, ry = 235, shear = 0;
  const top = cy - ry, bottom = cy + ry;
  const revealTop = bottom - (bottom - top) * frame.shieldRise;
  const ground = { cx, cy: frame.foot[1] + 8, rx: 124, ry: 29, shear: 0 };
  if (cx - rx - 8 <= 0 || cx + rx + 8 >= width || top - 8 <= 0 || bottom + 8 >= height) throw new Error(`Shield contour exceeds frame ${index}.`);
  return { cx, cy, rx, ry, shear, top, bottom, revealTop, palms, ground };
}
function enclosedSilhouette(source, shape) {
  let visiblePixels = 0, outsidePixels = 0, maximumRadius = 0;
  for (let offset = 3; offset < source.body.pixels.length; offset += 4) {
    if (!source.body.pixels[offset] && !source.equipment.pixels[offset]) continue;
    const pixel = (offset - 3) / 4;
    const x = pixel % width, y = Math.floor(pixel / width);
    const radius = Math.hypot((x - shape.cx) / shape.rx, (y - shape.cy) / shape.ry);
    visiblePixels += 1;
    maximumRadius = Math.max(maximumRadius, radius);
    if (radius >= 1) outsidePixels += 1;
  }
  return { visiblePixels, outsidePixels, maximumRadius };
}
function ring(context, shape, from, to, strength, foreground = false) {
  const points = curve(shape, from, to, 1, 72);
  stroke(context, points, colors.dark, .78 * strength, foreground ? 6 : 5);
  stroke(context, points, foreground ? colors.pale : colors.cyan, .9 * strength, 3);
}
function shieldLayers(index, source) {
  const frame = manifest.frames[index];
  const behind = createCanvas(width, height), front = createCanvas(width, height);
  const back = behind.getContext('2d'), fore = front.getContext('2d');
  const shape = shieldGeometry(frame, index);
  const pulse = [1, 1, 1, 1, 1, 1, .95, 1, .97, 1, 1, 1][index];
  const strength = frame.guardStrength * pulse;
  const enclosed = enclosedSilhouette(source, shape);
  if (index >= manifest.holdRange[0] && index <= manifest.holdRange[1] && enclosed.outsidePixels) throw new Error(`Shield leaves ${enclosed.outsidePixels} character pixels uncovered at frame ${index}`);
  let centerFillMaximumAlpha = 0;
  if (strength > 0) {
    // A light rear membrane and split arcs describe the volume around the body.
    const center = back.createImageData(width, height);
    for (let y = Math.ceil(shape.revealTop); y <= shape.bottom; y += 1) {
      const ny = (y - shape.cy) / shape.ry;
      for (let x = Math.floor(shape.cx - shape.rx); x <= shape.cx + shape.rx; x += 1) {
        const nx = (x - shape.cx - (y - shape.cy) * shape.shear) / shape.rx;
        const radius = Math.sqrt(nx * nx + ny * ny);
        if (radius > .995) continue;
        const alpha = Math.round(strength * (radius > .87 ? 20 + 25 * (radius - .87) / .125 : 9 + 11 * radius));
        const offset = (y * width + x) * 4;
        center.data[offset] = 105; center.data[offset + 1] = 203; center.data[offset + 2] = 213; center.data[offset + 3] = alpha;
        if (radius < .7) centerFillMaximumAlpha = Math.max(centerFillMaximumAlpha, alpha);
      }
    }
    back.putImageData(center, 0, 0);
    back.save(); fore.save();
    for (const context of [back, fore]) {
      context.beginPath(); context.rect(0, Math.floor(shape.revealTop) - 4, width, height); context.clip();
    }
    const outline = curve(shape, -Math.PI / 2, 3 * Math.PI / 2, 1, 112);
    stroke(back, outline, colors.dark, .78 * strength, 7);
    stroke(back, outline, colors.cyan, .92 * strength, 3);
    stroke(back, curve(shape, Math.PI * 1.06, Math.PI * 1.88, .975), colors.gold, .5 * strength, 3);
    stroke(fore, curve(shape, -.3, Math.PI * .87, 1, 64), colors.pale, .94 * strength, 3);
    stroke(fore, curve(shape, -.18, Math.PI * .78, .975, 60), colors.gold, .56 * strength, 2);
    const belt = { cx: shape.cx, cy: 344, rx: 207, ry: 39, shear: 0 };
    stroke(back, curve(belt, Math.PI, Math.PI * 2), colors.cyan, .32 * strength, 3);
    stroke(fore, curve(belt, 0, Math.PI), colors.dark, .28 * strength, 4);
    stroke(fore, curve(belt, 0, Math.PI), colors.pale, .43 * strength, 2);
    const meridian = { ...shape, rx: shape.rx * .68 };
    stroke(back, curve(meridian, Math.PI, Math.PI * 1.46, .98), colors.pale, .27 * strength, 2);
    stroke(fore, curve(meridian, -.16, Math.PI * .38, .98), colors.cyan, .32 * strength, 2);
    back.restore(); fore.restore();
    // The advancing rim travels from the feet to the crown before closing.
    if (frame.shieldRise < 1) {
      const fraction = (shape.revealTop - shape.cy) / shape.ry;
      const rim = { cx: shape.cx, cy: shape.revealTop, rx: shape.rx * Math.sqrt(Math.max(0, 1 - fraction * fraction)), ry: 16 + 8 * frame.shieldRise, shear: 0 };
      ring(back, rim, Math.PI, Math.PI * 2, Math.min(1, strength + .25));
      ring(fore, rim, 0, Math.PI, Math.min(1, strength + .25), true);
    }
    const groundStrength = frame.shieldRise < 1 ? Math.min(1, strength + .35) : strength * .75;
    ring(back, shape.ground, Math.PI, Math.PI * 2, groundStrength);
    ring(fore, shape.ground, 0, Math.PI, groundStrength, true);
    const innerGround = { ...shape.ground, rx: 102, ry: 23 };
    stroke(back, curve(innerGround, Math.PI, Math.PI * 2), colors.gold, .64 * groundStrength, 3);
    stroke(fore, curve(innerGround, 0, Math.PI), colors.gold, .75 * groundStrength, 3);
    for (const angle of [.15, 1.15, 2.25, 3.3, 4.1, 5.4]) {
      const [x, y] = curve(shape.ground, angle, angle, 1.08, 1)[0];
      square(angle < Math.PI ? fore : back, x, y - (1 - frame.shieldRise) * 8, 4, colors.core, .8 * groundStrength);
    }
    const contactY = 228;
    if (frame.pressure > 0) {
      const rippleWidth = index === 7 ? 20 : 34;
      const rippleHeight = index === 7 ? 33 : 53;
      const rippleX = shape.cx + shape.rx * Math.sqrt(1 - ((contactY - shape.cy) / shape.ry) ** 2);
      const ripple = { cx: rippleX - 7, cy: contactY, rx: rippleWidth, ry: rippleHeight, shear: -.06 };
      stroke(fore, curve(ripple, 0, Math.PI * 2, 1, 54), colors.dark, .7 * frame.pressure, 6);
      stroke(fore, curve(ripple, 0, Math.PI * 2, 1, 54), colors.gold, .9 * frame.pressure, 3);
      stroke(fore, curve(ripple, 0, Math.PI * 2, .63, 42), colors.pale, .94 * frame.pressure, 3);
      for (const offset of [-22, 0, 22]) square(fore, rippleX + 14, contactY + offset, 4, colors.pale, .8 * frame.pressure);
    }
    if (index === 9) {
      for (const angle of [-1.27, -.85, -.22, 2.78, 3.64, 4.27]) {
        const [x, y] = curve(shape, angle, angle, .98, 1)[0];
        square(fore, x, y - 8, 4, colors.pale, .5 * strength);
      }
    }
  }
  back.globalAlpha = 1; fore.globalAlpha = 1;
  const frontImage = fore.getImageData(0, 0, width, height);
  let silhouettePixelsCleared = 0, overlappingSilhouettePixels = 0;
  for (let offset = 3; offset < frontImage.data.length; offset += 4) {
    if (frontImage.data[offset] && (source.body.pixels[offset] || source.equipment.pixels[offset])) {
      frontImage.data.fill(0, offset - 3, offset + 1);
      silhouettePixelsCleared += 1;
    }
    if (frontImage.data[offset] && (source.body.pixels[offset] || source.equipment.pixels[offset])) overlappingSilhouettePixels += 1;
  }
  fore.putImageData(frontImage, 0, 0);
  const behindPixels = back.getImageData(0, 0, width, height).data;
  const behindMetrics = alphaMetrics(behindPixels), frontMetrics = alphaMetrics(frontImage.data);
  geometry.push({ frame: index, strength: frame.guardStrength, pressure: frame.pressure, shieldRise: frame.shieldRise,
    center: [shape.cx, shape.cy], radius: [shape.rx, shape.ry], shear: shape.shear,
    top: shape.top, bottom: shape.bottom, revealTop: shape.revealTop, palms: shape.palms,
    groundRing: shape.ground, enclosedSilhouette: enclosed,
    centerFillMaximumAlpha, pulse, pressureRipple: frame.pressure > 0 });
  return { behind: { canvas: behind, pixels: behindPixels, metrics: behindMetrics },
    front: { canvas: front, pixels: frontImage.data, metrics: { ...frontMetrics, silhouettePixelsCleared, overlappingSilhouettePixels } } };
}

for (const [index, source] of sources.entries()) {
  const frame = manifest.frames[index];
  let equipmentExposedPixels = 0;
  for (let offset = 3; offset < source.equipment.pixels.length; offset += 4) {
    if (source.equipment.pixels[offset] >= 128 && source.body.pixels[offset] < 128) equipmentExposedPixels += 1;
  }
  if (!equipmentExposedPixels) throw new Error(`Equipment is fully occluded at frame ${index}`);
  const effect = shieldLayers(index, source);
  for (const layer of [effect.behind, effect.front]) {
    if ((frame.guardStrength > 0) !== (layer.metrics.visiblePixels > 0)) throw new Error(`Unexpected effect visibility at frame ${index}`);
    if (layer.metrics.boundaryPixels) throw new Error(`Effect reaches the canvas boundary at frame ${index}`);
  }
  if (effect.front.metrics.overlappingSilhouettePixels) throw new Error(`Foreground effect covers the character at frame ${index}`);
  const composite = createCanvas(width, height);
  const context = composite.getContext('2d');
  context.drawImage(effect.behind.canvas, 0, 0);
  context.drawImage(source.equipment.canvas, 0, 0);
  context.drawImage(source.body.canvas, 0, 0);
  context.drawImage(effect.front.canvas, 0, 0);
  const compositePixels = context.getImageData(0, 0, width, height).data;
  frame.effectBehind = frameName('effect-behind', index);
  frame.effectFront = frameName('effect-front', index);
  frame.composite = frameName('guard', index);
  generated.set(frame.effectBehind, effect.behind.canvas.toBuffer('image/png'));
  generated.set(frame.effectFront, effect.front.canvas.toBuffer('image/png'));
  generated.set(frame.composite, composite.toBuffer('image/png'));
  frame.sha256 = { body: source.body.sha256, equipment: source.equipment.sha256,
    effectBehind: hash(generated.get(frame.effectBehind)), effectFront: hash(generated.get(frame.effectFront)), composite: hash(generated.get(frame.composite)) };
  composites.push({ canvas: composite, pixels: compositePixels });
  metrics.push({ index, phase: frame.phase, event: frame.event ?? null, palms: frame.palms,
    foot: frame.foot, guardStrength: frame.guardStrength, pressure: frame.pressure, shieldRise: frame.shieldRise,
    body: source.body.metrics, equipment: source.equipment.metrics, equipmentExposedPixels,
    effectBehind: effect.behind.metrics, effectFront: effect.front.metrics,
    composite: alphaMetrics(compositePixels), bodyBottomFromAnchor: source.body.metrics.bounds[3] - manifest.anchor[1] });
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
const firstLastPixelDifference = {
  body: pixelDifference(sources[0].body.pixels, sources.at(-1).body.pixels),
  equipment: pixelDifference(sources[0].equipment.pixels, sources.at(-1).equipment.pixels),
  composite: pixelDifference(composites[0].pixels, composites.at(-1).pixels),
};
if (Object.values(firstLastPixelDifference).some(result => result.changedPixels)) throw new Error('The first and final poses must match exactly.');
const columns = 4, rows = Math.ceil(manifest.frameCount / columns);
const atlas = createCanvas(width * columns, height * rows);
const atlasContext = atlas.getContext('2d');
manifest.atlas = 'guard-atlas.png';
manifest.frameRects = composites.map(({ canvas }, index) => {
  const rectangle = [index % columns * width, Math.floor(index / columns) * height, width, height];
  atlasContext.drawImage(canvas, rectangle[0], rectangle[1]);
  return rectangle;
});
generated.set(manifest.atlas, atlas.toBuffer('image/png'));
manifest.frameSha256 = manifest.frames.map(frame => frame.sha256.composite);
manifest.sha256 = Object.fromEntries(sources.flatMap(source => [[source.body.name, source.body.sha256], [source.equipment.name, source.equipment.sha256]])
  .concat([...generated].map(([name, bytes]) => [name, hash(bytes)])));
manifest.effectStudy = { method: 'procedural-pixel-canvas', shape: 'full-body-ellipsoid', riseDirection: [0, -1],
  activeFrames, guardStartFrame: 5, pressureFrame: 7,
  pressureDecayFrame: 8, guardEndFrame: 9, geometry };

function contactSheet(background, ink, characterHeight = manifest.sourceHeight) {
  const scale = characterHeight / manifest.sourceHeight;
  const drawWidth = Math.round(width * scale), drawHeight = Math.round(height * scale);
  const labelHeight = scale < 1 ? 42 : 34, gutter = 12;
  const tileWidth = Math.max(drawWidth, 176);
  const canvas = createCanvas(columns * (tileWidth + gutter) + gutter, rows * (drawHeight + labelHeight + gutter) + gutter);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = `${scale < 1 ? 12 : 16}px sans-serif`; context.textBaseline = 'top';
  for (const [index, composite] of composites.entries()) {
    const x = gutter + index % columns * (tileWidth + gutter);
    const y = gutter + Math.floor(index / columns) * (drawHeight + labelHeight + gutter);
    context.drawImage(composite.canvas, x + Math.round((tileWidth - drawWidth) / 2), y, drawWidth, drawHeight);
    context.fillStyle = ink;
    const frame = manifest.frames[index];
    context.fillText(`FRAME ${String(index).padStart(2, '0')} · ${frame.durationMs} ms${scale === 1 && frame.event ? ` · ${frame.event}` : ''}`, x + 12, y + drawHeight + 4);
    if (scale < 1 && frame.event) context.fillText(frame.event, x + 12, y + drawHeight + 20);
  }
  return canvas.toBuffer('image/png');
}
const report = { frameSize: [width, height], frameCount: manifest.frameCount, fps: manifest.fps,
  durationMs: manifest.frames.reduce((total, frame) => total + frame.durationMs, 0),
  anchor: manifest.anchor, holdRange: manifest.holdRange, geometry, frames: metrics,
  firstLastPixelDifference,
  footBottomRange: [Math.min(...metrics.map(frame => frame.body.bounds[3])), Math.max(...metrics.map(frame => frame.body.bounds[3]))],
  resources: manifest.sha256 };
const qaOutputs = new Map([
  ['guard-contact-white.png', contactSheet('#ffffff', '#16303a')],
  ['guard-contact-dark.png', contactSheet('#17252d', '#d9eff2')],
  ['guard-contact-80px.png', contactSheet('#c9c9bb', '#16303a', manifest.nominalHeight)],
]);
for (const source of sources) {
  for (const layer of [source.body, source.equipment]) {
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
await writeAtomic(path.join(qaDirectory, 'guard-pack-report.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const [name, digest] of Object.entries(manifest.sha256)) {
  if (hash(await fs.readFile(path.join(directory, name))) !== digest) throw new Error(`Saved hash mismatch: ${name}`);
}
console.log(JSON.stringify({ directory, qaDirectory, frameCount: manifest.frameCount, frameSize: manifest.frameSize,
  durationMs: report.durationMs, holdRange: report.holdRange, footBottomRange: report.footBottomRange,
  firstLastPixelDifference, effectBehindVisiblePixels: metrics.map(frame => frame.effectBehind.visiblePixels),
  effectFrontVisiblePixels: metrics.map(frame => frame.effectFront.visiblePixels),
  atlas: [atlas.width, atlas.height], manifestSha256: report.manifestSha256,
  report: path.join(qaDirectory, 'guard-pack-report.json') }, null, 2));
