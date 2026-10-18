import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const directory = path.resolve(process.argv[2] || '');
const manifestPath = path.join(directory, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const [width, height] = manifest.frameSize;
const columns = 4;
const canvas = createCanvas(width * columns, height * Math.ceil(manifest.frames.length / columns));
const context = canvas.getContext('2d');
const hashes = [];
for (let i = 0; i < manifest.frames.length; i += 1) {
  const bytes = await fs.readFile(path.join(directory, manifest.frames[i]));
  const image = await loadImage(bytes);
  if (image.width !== width || image.height !== height) throw new Error(`Unexpected frame dimensions: ${manifest.frames[i]}`);
  context.drawImage(image, i % columns * width, Math.floor(i / columns) * height);
  hashes.push(createHash('sha256').update(bytes).digest('hex'));
}
manifest.atlas = 'walk-atlas.png';
manifest.frameRects = manifest.frames.map((_, i) => [i % columns * width, Math.floor(i / columns) * height, width, height]);
manifest.frameSha256 = hashes;
manifest.stridePixels = manifest.forwardScreenPerWorld.map(value => value * manifest.strideWorld);
await fs.writeFile(path.join(directory, manifest.atlas), canvas.toBuffer('image/png'));
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({directory, frames: hashes.length, distinctFrames: new Set(hashes).size, atlas: [canvas.width, canvas.height]}));
