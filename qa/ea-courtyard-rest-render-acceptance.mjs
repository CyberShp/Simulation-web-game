/** SR-XF-004/007/029: production Canvas from a normal public-command world.
 * NODE_PATH may supply the existing @napi-rs/canvas test dependency.
 * Optional XIANFU_QA_RENDER_DIR saves images outside the source repository.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as S from '../dist/ea-opening-sim.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';
import {createWorldRenderer} from '../dist/ea-courtyard-renderer.mjs';
import {restRenderAnchor, registerCultivatorAtlas, registerCultivatorRestAtlas} from '../dist/ea-character-art.mjs';
import {spatialPrefab, spatialTransform, spatialProject} from '../dist/ea-sr-spatial.mjs';

test('normal earned bed rest stays factual beneath the closed building exterior', async t => {
  const require = createRequire(import.meta.url);
  const {createCanvas, Image, GlobalFonts} = require('@napi-rs/canvas');
  const h = normalOpening();
  h.act('masterAction', 'rest');
  h.until(s => s.activitiesById[s.master.activityId]?.action === 'rest' && s.activitiesById[s.master.activityId].phase === 'executing', 'real resting arrival');
  h.act('setSpeed', 0);
  h.save();
  const saved = JSON.stringify(h.s);
  const globals = Object.fromEntries(['Image','fetch','devicePixelRatio','document','ResizeObserver'].map(key => [key, globalThis[key]]));
  GlobalFonts.registerFromPath(fileURLToPath(new URL('../dist/assets/fonts/xianfu-brush.woff2', import.meta.url)), 'serif');
  let missingRest = false;
  globalThis.Image = class extends Image {
    set src(value) {
      if (!value) return;
      queueMicrotask(() => {
        if (missingRest && value.endsWith('/characters-rest-v1.png')) this.onerror?.(new Error('QA: missing rest image'));
        else super.src = value.startsWith('file:') ? fileURLToPath(value) : value;
      });
    }
  };
  globalThis.fetch = async url => ({ok:true, json:async () => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'))});
  globalThis.devicePixelRatio = 1;
  globalThis.document = {createElement:() => createCanvas(1,1), getElementById:() => ({classList:{toggle(){}}})};
  globalThis.ResizeObserver = class {observe(){} disconnect(){}};
  let output = null;
  if (process.env.XIANFU_QA_RENDER_DIR) {
    output = resolve(process.env.XIANFU_QA_RENDER_DIR);
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const rel = relative(root, output);
    assert(rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel), 'QA images belong outside the repository');
    mkdirSync(output, {recursive:true});
  }
  const renderers = [];
  const makeRenderer = async () => {
    const canvas = createCanvas(1366,900);
    canvas.clientWidth = 1366; canvas.clientHeight = 900;
    canvas.getBoundingClientRect = () => ({left:0, top:0, width:1366, height:900});
    const ctx = canvas.getContext('2d');
    const calls = {images:[], text:[]};
    const drawImage = ctx.drawImage.bind(ctx), fillText = ctx.fillText.bind(ctx);
    ctx.drawImage = (...args) => {calls.images.push({width:args[0].width, height:args[0].height}); return drawImage(...args);};
    ctx.fillText = (...args) => {calls.text.push(args[0]); return fillText(...args);};
    const renderer = createWorldRenderer(canvas, {
      getState:() => h.s, getMode:() => 'inspect', getSelection:() => ({kind:'person', id:'master'}),
      getAppearance:S.appearanceView, getPrefs:() => ({reducedMotion:true}), getCampaignScene:() => null,
    });
    renderers.push(renderer);
    await renderer.ready;
    renderer.focusScenic(h.s.master.scenic.x, h.s.master.scenic.y);
    renderer.setZoom(.8);
    calls.images.length = calls.text.length = 0;
    renderer.render(0, true);
    return {renderer, canvas, calls};
  };
  const selectsMaster = hit => (hit.candidates || [hit]).some(person => person.id === 'master');
  try {
    const live = await makeRenderer();
    await t.test('normal reserved bed remains factual beneath a complete exterior', () => {
      const loading = live.renderer.loadingState();
      assert.deepEqual(loading.failed, []);
      assert.equal(loading.assets.people.status, 'loaded');
      assert.equal(loading.assets.restPeople.status, 'loaded');
      const activity = h.s.activitiesById[h.s.master.activityId];
      assert.equal(activity.phase, 'executing');
      assert.match(activity.slotId, /bed/);
      assert(!live.calls.images.some(image => image.width === 1024 && image.height === 1536));
      assert(!live.calls.text.some(text => text.includes(h.s.master.name)));
      assert.equal(JSON.stringify(h.s), saved);
    });
    await t.test('roof takes the pointer and repeated paused frames are read-only', () => {
      const anchor = restRenderAnchor(h.s, h.s.master, {prefab:spatialPrefab, transform:spatialTransform, project:spatialProject, camera:live.renderer.getCamera()});
      assert.equal(anchor.poseVariant, 'bed-rest');
      const foot = live.renderer.projectPoint(h.s.master.scenic),hit=live.renderer.pick({clientX:foot.x,clientY:foot.y});
      assert.equal(selectsMaster(hit),false);
      assert.equal(hit.kind,'building');
      const first = live.canvas.toBuffer('image/png');
      live.renderer.render(50000, true);
      assert.deepEqual(live.canvas.toBuffer('image/png'), first, 'wall-clock time cannot animate a paused body');
      assert.equal(JSON.stringify(h.s), saved);
      if (output) writeFileSync(resolve(output, 'courtyard-closed-rest.png'), first);
    });
    missingRest = true;
    const fallback = await makeRenderer();
    await t.test('missing indoor pose art keeps the same exterior, activity and save', () => {
      assert.deepEqual(fallback.renderer.loadingState().failed.map(asset => asset.id), ['restPeople']);
      assert(!fallback.calls.images.some(image => image.width === 1024 && image.height === 1536));
      assert(!fallback.calls.text.some(text => text.includes(h.s.master.name)));
      const foot = fallback.renderer.projectPoint(h.s.master.scenic);
      const hit=fallback.renderer.pick({clientX:foot.x,clientY:foot.y});
      assert.equal(selectsMaster(hit),false);
      assert.equal(hit.kind,'building');
      assert.equal(JSON.stringify(h.s), saved);
      assert.deepEqual(fallback.canvas.toBuffer('image/png'),live.canvas.toBuffer('image/png'));
      if (output) writeFileSync(resolve(output, 'courtyard-closed-rest-missing-pose.png'), fallback.canvas.toBuffer('image/png'));
    });
  } finally {
    for (const renderer of renderers) renderer.destroy();
    registerCultivatorAtlas(null); registerCultivatorRestAtlas(null);
    for (const [key,value] of Object.entries(globals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
