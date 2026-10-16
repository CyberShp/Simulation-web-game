import { REVIEW_POINTS, toArt, toWorld, ART_WIDTH, ART_HEIGHT } from './courtyard-space.mjs';
import { CLEAN_PATCHES } from './courtyard-layers.mjs';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const copy = value => structuredClone(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);

/** Drive the public courtyard inputs and observe real elapsed world time. */
export async function runCourtyardQA(api, settings) {
  if (!settings.qa || settings.qaScenario === 'native') return { skipped: true };
  const host = window.sceneHost;
  const scenario = settings.qaScenario;
  const checks = [], checkpoints = [], captures = [], errors = [], pixelComparisons = [], visualReview = [];
  const startedAt = new Date().toISOString(), started = performance.now();
  const master = () => api.view().people.find(person => person.id === 'person:master');
  const elapsed = () => (performance.now() - started) / 1000;
  let recorder = null, chunks = [], recordingStream = null;
  let autonomyObservation = null;

  const check = (name, ok, evidence = {}) => {
    checks.push({ name, ok: Boolean(ok), evidence });
    if (!ok) throw new Error('验证未通过：' + name);
  };
  const checkpoint = label => {
    const view = api.view();
    checkpoints.push({ label, wallSeconds: elapsed(), tick: view.tick, paused: view.paused,
      people: view.people.map(person => ({ id: person.id, x: person.x, y: person.y,
        art: toArt(person.x, person.y), indoor: person.indoor, activity: person.activity })),
      resources: copy(view.resources), route: copy(api.route()), camera: copy(api.renderer.camera) });
  };
  const report = phase => {
    const runtime = api.metrics();
    return host.metrics({ scenario, phase, startedAt, wallSeconds: elapsed(), checks,
      checkpoints, captures, pixelComparisons, visualReview, autonomyObservation,
      ...runtime, errors: [...runtime.errors, ...errors] });
  };
  const capture = async label => {
    await wait(160);
    const filename = label + '.png';
    const ok = await host.capture(filename);
    check('截图保存：' + label, ok, { filename });
    captures.push({ filename, tick: api.view().tick, camera: copy(api.renderer.camera),
      reference: api.renderer.reference, viewport: api.metrics().viewport });
  };
  const until = async (predicate, milliseconds, label) => {
    const deadline = performance.now() + milliseconds;
    while (!predicate()) {
      if (performance.now() >= deadline) throw new Error('等待超时：' + label);
      await wait(80);
    }
  };
  const frozen = async name => {
    const before = api.view().tick;
    await wait(1200);
    check(name, api.view().paused && api.view().tick === before,
      { before, after: api.view().tick, elapsedMilliseconds: 1200 });
  };

  function environmentPixels(label) {
    const original = document.createElement('canvas'), environment = document.createElement('canvas');
    for (const canvas of [original, environment]) { canvas.width = ART_WIDTH; canvas.height = ART_HEIGHT; }
    const sourceContext = original.getContext('2d', { willReadFrequently: true });
    const sceneContext = environment.getContext('2d', { willReadFrequently: true });
    sourceContext.imageSmoothingEnabled = false;
    sceneContext.imageSmoothingEnabled = false;
    sourceContext.drawImage(api.renderer.original, 0, 0);
    const view = api.view();
    api.renderer.paintEnvironment(sceneContext, view);
    const source = sourceContext.getImageData(0, 0, ART_WIDTH, ART_HEIGHT).data;
    const actual = sceneContext.getImageData(0, 0, ART_WIDTH, ART_HEIGHT).data;
    const exclusions = CLEAN_PATCHES.map(patch => ({
      id: patch.id,
      left: Math.floor(Math.min(...patch.polygon.map(point => point[0]))) - 2,
      right: Math.ceil(Math.max(...patch.polygon.map(point => point[0]))) + 2,
      top: Math.floor(Math.min(...patch.polygon.map(point => point[1]))) - 2,
      bottom: Math.ceil(Math.max(...patch.polygon.map(point => point[1]))) + 2,
    }));
    const cropVisual = view.buildings.find(building => building.type === 'farm')?.cropVisual;
    if (cropVisual === 'empty') exclusions.push({ id: 'empty-field', left: 175, right: 650, top: 640, bottom: 880 });
    let comparedPixels = 0, excludedPixels = 0, differentPixels = 0;
    const firstDifferences = [];
    for (let y = 0; y < ART_HEIGHT; y++) {
      for (let x = 0; x < ART_WIDTH; x++) {
        if (exclusions.some(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)) {
          excludedPixels++; continue;
        }
        comparedPixels++;
        const offset = (y * ART_WIDTH + x) * 4;
        if ([0, 1, 2, 3].some(channel => source[offset + channel] !== actual[offset + channel])) {
          differentPixels++;
          if (firstDifferences.length < 12) firstDifferences.push({ x, y,
            source: Array.from(source.subarray(offset, offset + 4)), actual: Array.from(actual.subarray(offset, offset + 4)) });
        }
      }
    }
    const evidence = { label, width: ART_WIDTH, height: ART_HEIGHT, cropVisual,
      comparedPixels, excludedPixels, differentPixels, exclusions, firstDifferences };
    pixelComparisons.push(evidence);
    check('原尺寸环境像素保真：' + label, comparedPixels > 0 && differentPixels === 0, evidence);
  }

  async function saveWalking() {
    const target = REVIEW_POINTS.eastPath, before = api.view().tick, start = copy(master());
    await startRecording();
    api.setPaused(false);
    const result = api.moveArt(target.art.x, target.art.y);
    check('行走存档接受目的地', result.ok, { result, destination: target.art });
    await until(() => {
      const route = api.route();
      if (route.failure) throw new Error(route.failure);
      return api.view().tick >= before + 8 && distance(master(), start) > 0.1
        && route.active && route.remaining > 2 && route.steps >= 3;
    }, 15000, '行走中到达保存检查点');
    api.setPaused(true);
    checkpoint('walking-paused-before-save');
    await capture('save-walk-paused');
    await stopRecording();
    await frozen('行走中手动暂停保持时钟');
    const route = copy(api.route()), saved = await api.save(false);
    check('行走中保存完成', saved.ok, { result: saved, tick: api.view().tick });
    const disk = await window.sectHost.load(), current = api.snapshot();
    check('行走中正式世界精确保存', disk.ok && disk.found && same(disk.data.state, current.state));
    const presentation = disk.data.courtyardPresentation;
    check('行走中待走队列与目标保存', Array.isArray(route.waypoints) && route.remaining > 2
      && same(presentation.route, route.waypoints) && same(presentation.activeWaypoint, route.active)
      && same(presentation.destination, route.destination) && same(route.destination, target.art),
      { remaining: route.remaining, active: route.active, destination: route.destination });
    check('行走存档运行错误为零', api.metrics().errors.length === 0, { errors: api.metrics().errors });
    checkpoint('walking-saved-for-close');
    await report('passed');
    await host.finish({});
    return { ok: true, checks, checkpoints };
  }

  async function resumeWalking(loaded) {
    const presentation = loaded.data.courtyardPresentation, route = copy(api.route());
    check('行走中原存档包含后续路线', presentation?.route?.length > 2
      && Boolean(presentation.activeWaypoint) && Boolean(presentation.destination));
    check('重开恢复完整待走队列', Array.isArray(route.waypoints) && same(route.waypoints, presentation.route)
      && route.remaining === presentation.route.length && same(route.active, presentation.activeWaypoint)
      && same(route.destination, presentation.destination),
      { remaining: route.remaining, active: route.active, destination: route.destination });
    const savedMaster = loaded.data.state.personsById['person:master'];
    check('重开恢复行走中真实位置', same(api.snapshot().state.personsById['person:master'], savedMaster),
      { position: { x: master().x, y: master().y }, art: toArt(master().x, master().y), tick: api.view().tick });
    const target = copy(route.destination), targetWorld = toWorld(target.x, target.y);
    const before = api.view().tick, start = copy(master());
    await startRecording();
    api.setPaused(false);
    await wait(400);
    await capture('resume-walk-moving');
    await report('resuming-saved-route');
    await until(() => {
      const state = api.route();
      if (state.failure) throw new Error(state.failure);
      return !state.active && state.remaining === 0;
    }, 90000, '恢复后完成原行程');
    api.setPaused(true);
    const arrived = master(), art = toArt(arrived.x, arrived.y), finalRoute = api.route();
    check('恢复后抵达原目的地', distance(arrived, targetWorld) <= 0.09 && distance(art, target) <= 12,
      { target, arrived: { x: arrived.x, y: arrived.y }, art,
        worldError: distance(arrived, targetWorld), artError: distance(art, target) });
    check('恢复后实际移动与时间推进', api.view().tick > before && distance(start, arrived) > 0.1,
      { before, after: api.view().tick, start: { x: start.x, y: start.y }, arrived: { x: arrived.x, y: arrived.y } });
    check('依原队列完成后续路点', finalRoute.steps === presentation.route.length && !finalRoute.active
      && finalRoute.remaining === 0 && finalRoute.destination === null,
      { expectedWaypoints: presentation.route.length, executedWaypoints: finalRoute.steps });
    await stopRecording();
    await capture('resume-walk-arrived');
    check('续走结束保存完成', (await api.save(false)).ok);
    const disk = await window.sectHost.load();
    check('续走结束保存清空待走队列', disk.ok && disk.found && disk.data.state.speed === 0
      && disk.data.courtyardPresentation.route.length === 0 && disk.data.courtyardPresentation.activeWaypoint === null
      && disk.data.courtyardPresentation.destination === null && same(disk.data.state, api.snapshot().state));
    check('续走运行错误为零', api.metrics().errors.length === 0, { errors: api.metrics().errors });
    checkpoint('saved-route-complete');
    await report('passed');
    await host.finish({});
    return { ok: true, checks, checkpoints };
  }

  async function observeAutonomy() {
    const loaded = await window.sectHost.load();
    check('自主观察使用全新存档', loaded.ok && !loaded.found,
      { savePath: settings.savePath, found: loaded.found });
    const initial = api.view(), policy = copy(api.snapshot().policy);
    check('自主观察使用正式两人起点', initial.provenance.kind === 'normal-public-command-checkpoint'
      && initial.people.filter(person => person.resident).length === 2);
    await startRecording();
    const observationStart = performance.now();
    autonomyObservation = { startedAt: new Date().toISOString(), targetSeconds: 70,
      sampleIntervalMilliseconds: 100, startTick: initial.tick, policy,
      samples: [], visualReview: 'pending-human-review' };
    const sample = () => {
      const view = api.view();
      autonomyObservation.samples.push({ wallSeconds: (performance.now() - observationStart) / 1000,
        tick: view.tick, paused: view.paused,
        people: view.people.filter(person => person.resident).map(person => ({
          id: person.id, x: person.x, y: person.y, art: toArt(person.x, person.y),
          indoor: person.indoor, activity: person.activity,
        })) });
    };
    api.setPaused(false);
    sample();
    const timer = setInterval(sample, 100);
    try {
      await capture('autonomy-initial');
      checkpoint('autonomy-start');
      await report('observing');
      while (performance.now() - observationStart < 70000) {
        await wait(Math.min(1000, Math.max(1, 70000 - (performance.now() - observationStart))));
      }
    } finally {
      clearInterval(timer);
      api.setPaused(true);
      sample();
      autonomyObservation.wallSeconds = (performance.now() - observationStart) / 1000;
      autonomyObservation.endTick = api.view().tick;
      autonomyObservation.sampleCount = autonomyObservation.samples.length;
      autonomyObservation.policyUnchanged = same(policy, api.snapshot().policy);
    }
    await stopRecording();
    await capture('autonomy-final-paused');
    const saved = await api.save(false);
    check('自主观察结束保存完成', saved.ok, { result: saved, tick: api.view().tick });
    checkpoint('autonomy-final-paused-save');
    const runtimeErrors = api.metrics().errors;
    autonomyObservation.runtimeErrors = copy(runtimeErrors);
    await report(runtimeErrors.length ? 'observed-errors' : 'observed');
    await host.finish({ failed: runtimeErrors.length > 0 });
    return { ok: runtimeErrors.length === 0, observation: autonomyObservation, errors: runtimeErrors };
  }

  async function startRecording() {
    check('画布录制可用', typeof api.canvas.captureStream === 'function' && typeof MediaRecorder === 'function');
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    check('WebM 编码可用', Boolean(mimeType), { mimeType });
    recordingStream = api.canvas.captureStream(12);
    recorder = new MediaRecorder(recordingStream, { mimeType, videoBitsPerSecond: 2000000 });
    chunks = [];
    recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
    recorder.start(1000);
  }
  async function stopRecording() {
    if (!recorder) return;
    const current = recorder;
    const stopped = new Promise((resolve, reject) => {
      current.addEventListener('stop', resolve, { once: true });
      current.addEventListener('error', event => reject(event.error || new Error('录制失败')), { once: true });
    });
    if (current.state !== 'inactive') current.stop();
    else throw new Error('录制已提前停止');
    await stopped;
    const bytes = await new Blob(chunks, { type: current.mimeType }).arrayBuffer();
    const filename = 'courtyard-' + scenario + '.webm';
    const saved = await host.recording({ filename, bytes });
    recordingStream.getTracks().forEach(track => track.stop());
    recordingStream = null; recorder = null; chunks = [];
    check('实际行程录像保存', saved && bytes.byteLength > 0, { filename, bytes: bytes.byteLength });
  }

  async function walk(label, target) {
    api.setPaused(false);
    const before = api.view().tick, start = copy(master()), startWall = performance.now();
    const result = api.moveArt(target.art.x, target.art.y);
    check(label + '接受行走命令', result?.ok, { result, start: toArt(start.x, start.y), destination: target.art });
    checkpoint(label + '-depart');
    await wait(250);
    await capture(label + '-walking');
    await report('walking-' + label);
    await until(() => {
      const route = api.route();
      if (route.failure) throw new Error(label + '：' + route.failure);
      return !route.active && route.remaining === 0;
    }, 90000, label + '实际抵达');
    const arrived = master(), art = toArt(arrived.x, arrived.y), tick = api.view().tick;
    const worldError = distance(arrived, target.world), artError = distance(art, target.art);
    check(label + '真实脚点抵达', worldError <= 0.09 && artError <= 12,
      { position: { x: arrived.x, y: arrived.y }, art, target: target.art, worldError, artError });
    check(label + '由实际时间推进', tick > before,
      { before, after: tick, wallSeconds: (performance.now() - startWall) / 1000, steps: api.route().steps });
    api.setPaused(true);
    checkpoint(label + '-arrived');
    await capture(label + '-arrived');
    await report('arrived-' + label);
  }

  function pickPerson(person) {
    const hit = api.renderer.hitRegions.find(region => region.person.id === person.id);
    if (!hit) return null;
    for (const vertical of [0.45, 0.7, 0.9, 0.2]) {
      for (const horizontal of [0.5, 0.3, 0.7]) {
        const point = api.renderer.artToScreen({ x: hit.x + hit.w * horizontal, y: hit.y + hit.h * vertical });
        const picked = api.renderer.pickPerson(point.x, point.y);
        if (picked?.id === person.id) return { picked, point };
      }
    }
    return null;
  }
  async function personDialogs() {
    api.renderer.showCourtyard();
    await wait(160);
    const people = api.view().people.filter(person => person.resident && !person.indoor);
    check('可查看院中人物', people.some(person => person.id === 'person:master'), { people: people.map(person => person.id) });
    const dialog = document.getElementById('dialog');
    for (const person of people) {
      const pick = pickPerson(person);
      check(person.name + '场景身体点选', pick?.picked.id === person.id, { personId: person.id, point: pick?.point });
      api.setPaused(false);
      api.openPerson(pick.picked);
      check(person.name + '使用人物对话窗', !dialog.hidden
        && document.getElementById('person-name').textContent === person.name
        && Boolean(document.getElementById('person-speech').textContent.trim()), { personId: person.id });
      await frozen(person.name + '阅读时世界暂停');
      await capture('person-' + (person.id === 'person:master' ? 'master' : 'companion'));
      api.closeDialog();
      check(person.name + '关闭对话恢复运行', dialog.hidden && !api.view().paused);
      api.setPaused(true);
      api.openPerson(pick.picked);
      api.closeDialog();
      check(person.name + '关闭对话保留手动暂停', dialog.hidden && api.view().paused);
    }
  }
  async function buildings() {
    for (const [type, art] of [['hall', { x: 660, y: 210 }], ['farm', { x: 500, y: 750 }]]) {
      const point = api.renderer.artToScreen(art);
      const building = api.renderer.pickBuilding(point.x, point.y);
      check(type + '建筑点选', building?.type === type, { point, buildingId: building?.id });
      api.setPaused(false);
      api.openBuilding(building);
      check(type + '建筑近况可见', !document.getElementById('building-dialog').hidden
        && Boolean(document.getElementById('building-detail').textContent.trim()));
      await frozen(type + '建筑阅读暂停');
      api.closeDialog();
      check(type + '关闭近况恢复运行', !api.view().paused);
      api.setPaused(true);
    }
  }
  async function compareFrames() {
    api.renderer.showCourtyard();
    api.setPaused(true);
    const camera = copy(api.renderer.camera), before = api.view().tick;
    environmentPixels('final');
    document.body.classList.add('hud-hidden');
    try {
      await capture('comparison-live');
      document.getElementById('compare').click();
      check('原稿对照使用同一镜头', api.renderer.reference && same(camera, api.renderer.camera));
      await capture('comparison-original');
      check('原稿查看保持世界时间', api.view().paused && api.view().tick === before);
      document.getElementById('compare').click();
      check('实景回到同一镜头', !api.renderer.reference && same(camera, api.renderer.camera));
    } finally {
      if (api.renderer.reference) document.getElementById('compare').click();
      document.body.classList.remove('hud-hidden');
    }
  }

  try {
    check('验收场景已定义', ['review', 'resume', 'save-walk', 'resume-walk', 'autonomy'].includes(scenario), { scenario });
    check('场景与素材已就绪', api.renderer.ready && document.getElementById('loading').hidden,
      { viewport: api.metrics().viewport, artSize: api.metrics().artSize });
    if (scenario === 'autonomy') return await observeAutonomy();
    let loaded = null;
    if (scenario === 'resume' || scenario === 'resume-walk') {
      loaded = await window.sectHost.load();
      const current = api.snapshot();
      check('跨进程存档可读', loaded.ok && loaded.found, { savePath: settings.savePath });
      check('恢复保存时的暂停与世界步', loaded.data.state.speed === 0 && current.state.speed === 0
        && current.state.worldTick === loaded.data.state.worldTick,
        { savedTick: loaded.data.state.worldTick, loadedTick: current.state.worldTick });
      check('恢复同一人物与物资', same(current.state.personsById, loaded.data.state.personsById)
        && same(current.state.stockpilesById, loaded.data.state.stockpilesById));
      check('恢复院务设置', same(current.policy, loaded.data.policy) && same(current.budget, loaded.data.budget));
      await frozen('重开等待保持保存时钟');
    }
    api.setPaused(true);
    api.renderer.showCourtyard();
    await capture(scenario + '-initial');
    environmentPixels('initial');
    checkpoint('initial');
    await frozen('手动暂停保持世界时间');
    check('来源与两位住民保持', api.view().provenance.kind === 'normal-public-command-checkpoint'
      && api.view().people.filter(person => person.resident).length === 2);
    if (scenario === 'save-walk') return await saveWalking();
    if (scenario === 'resume-walk') return await resumeWalking(loaded);

    for (const [name, target] of [['屋顶', { x: 660, y: 200 }], ['悬崖', { x: 1560, y: 700 }]]) {
      const before = api.snapshot(), route = api.route(), result = api.moveArt(target.x, target.y);
      check(name + '拒绝行走', !result.ok && Boolean(result.error), { target, result });
      check(name + '拒绝保持世界与行程', same(before, api.snapshot()) && same(route, api.route()));
    }
    await personDialogs();
    await buildings();
    const fixed = toWorld(720, 530), beforeCameraTick = api.view().tick;
    api.renderer.zoomAt(1.5, api.renderer.w * 0.55, api.renderer.h * 0.45);
    api.renderer.panBy(-80, 45);
    const screen = api.renderer.worldToScreen(fixed.x, fixed.y);
    const returned = api.renderer.screenToWorld(screen.x, screen.y);
    check('缩放拖动后坐标往返一致', distance(fixed, returned) < 1e-8,
      { fixed, screen, returned, camera: copy(api.renderer.camera) });
    check('镜头操作保持世界步', api.view().tick === beforeCameraTick);
    await capture('zoom-pan');
    api.renderer.showCourtyard();
    await startRecording();
    const firstTarget = scenario === 'resume' ? REVIEW_POINTS.farmDropoff : REVIEW_POINTS.courtyard;
    await walk(scenario === 'resume' ? 'resume-farm' : '01-courtyard', firstTarget);
    if (scenario === 'review') await walk('02-farm', REVIEW_POINTS.farmDropoff);
    await walk('03-courtyard', REVIEW_POINTS.courtyard);
    await walk('04-east-path', REVIEW_POINTS.eastPath);
    await walk('05-return-courtyard', REVIEW_POINTS.courtyard);
    if (scenario === 'review') {
      for (const [label, name, art] of [
        ['06-lamp-left', '左前灯后', { x: 615, y: 600 }],
        ['07-lamp-right', '右前灯后', { x: 942, y: 598 }],
        ['08-farm-fence', '田边栏内侧', { x: 450, y: 820 }],
      ]) {
        const target = { art, world: toWorld(art.x, art.y) };
        await walk(label, target);
        visualReview.push({ name, art, world: target.world, filename: label + '-arrived.png',
          subject: '人物与前景遮挡', status: 'pending-human-review' });
      }
      await walk('09-return-courtyard', REVIEW_POINTS.courtyard);
    }
    await stopRecording();
    await compareFrames();
    await frozen('行程完成后暂停保持时钟');
    const saved = await api.save(false);
    check('暂停院务保存完成', saved.ok, { result: saved, tick: api.view().tick });
    const disk = await window.sectHost.load(), current = api.snapshot();
    check('保存结果可读且世界一致', disk.ok && disk.found && same(disk.data.state, current.state),
      { savedTick: disk.data?.state?.worldTick, currentTick: current.state.worldTick });
    check('保存当前位置与暂停', disk.data.state.speed === 0
      && distance(toArt(master().x, master().y), REVIEW_POINTS.courtyard.art) <= 12);
    check('运行错误为零', api.metrics().errors.length === 0, { errors: api.metrics().errors });
    checkpoint('final-paused-save');
    await capture('final-paused');
    await report('passed');
    await host.finish({});
    return { ok: true, checks, checkpoints };
  } catch (error) {
    errors.push({ message: error.message || String(error), phase: 'courtyard-qa', wallSeconds: elapsed() });
    api.setPaused(true);
    try { await stopRecording(); } catch (recordError) { errors.push({ message: recordError.message, phase: 'recording' }); }
    recordingStream?.getTracks().forEach(track => track.stop());
    try { await host.capture('failure.png'); } catch {}
    await report('failed');
    await host.finish({ failed: true });
    return { ok: false, checks, errors };
  }
}
