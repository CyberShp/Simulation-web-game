/** Godot Web host: one simulation clock, isolated preview saves, original save validation. */
import {createGodotBridge} from './ea-godot-bridge.mjs';
import {createEAPersistence, MAX_IMPORT_BYTES} from './ea-persistence.mjs';
import {initial, validateSave, SCHEMA_VERSION, GAME_VERSION} from './ea-opening-sim.mjs';
import {createRuntimeClock, createFrameDiagnostics} from './ea-runtime.mjs';

export async function bootGodotHost({preview = 'godot-preview', siteLayout = null} = {}) {
  if (!['godot-preview', 'painted-game', 'estate-game'].includes(preview)) throw Error('未知的预览档位');
  const openingState = preview === 'estate-game' ? initial({sr:true}) : undefined;
  if (openingState) openingState.buildings.find(building => building.type === 'hall').condition = 35;
  const world = createGodotBridge({state:openingState,sites:siteLayout?.sites});
  const clock = createRuntimeClock();
  const metrics = createFrameDiagnostics({sampleLimit: 600});
  const acceptance = new URLSearchParams(location.search).get('acceptance') || '';
  const scope = /^qa-[a-z0-9-]{1,48}$/.test(acceptance) ? acceptance : 'world';
  const namespace = `xianfu:simulation-web-game:${preview}:${scope}:`;
  let running = false, changed = false, frame = 0, lastSave = 0, parked = null, recoveryOnly = false, archiveRecovery = false;
  let message = '点地面行走 · 点人物或建筑查看 · 拖动与滚轮调整视野';
  let readout = world.snapshot();
  const state = () => JSON.parse(world.save());
  const persistence = createEAPersistence({
    namespace, validate: raw => validateSave(raw, {upgrade: true}),
    gameVersion: GAME_VERSION, dataVersion: SCHEMA_VERSION, getState: state,
  });
  const refresh = () => { const view = world.snapshot(); readout = {...view, paused: view.paused || !persistence.canWrite || recoveryOnly}; return readout; };
  persistence.subscribe(event => {
    if (running && !persistence.canWrite) {
      clock.suspend();
      message = event.status;
      refresh();
    }
  });
  const save = () => {
    if (recoveryOnly) return JSON.stringify({ok:false,message:'请先导出保留进度，再刷新读取最新档案'});
    const result = persistence.saveNow(state());
    message = result.ok ? '当前进度已保存' : result.message;
    if (result.ok) changed = false;
    else world.command({type: 'pause', paused: true});
    refresh();
    return JSON.stringify(result);
  };
  async function open({resume = false} = {}) {
    clock.suspend();
    const result = await persistence.open(1);
    archiveRecovery = !result.state && !['ready', 'empty'].includes(result.status);
    const pending = resume && parked?.dirty ? parked : null;
    recoveryOnly = !!pending && !persistence.matchesHead(pending.head);
    if (pending) {
      const loaded = world.load(pending.text);
      if (!loaded.ok) throw Error(loaded.error);
    } else if (result.state) {
      const loaded = world.load(JSON.stringify(result.state));
      if (!loaded.ok) throw Error(loaded.error);
    }
    if (recoveryOnly) {
      world.command({type:'pause',paused:true});
      persistence.release();
      message = '未保存进度已保留；档案发生变化，请先导出备份，再刷新读取最新档案';
    } else if (pending) {
      message = '未保存进度已恢复，可继续保存或导出';
    } else if (!result.ok) {
      world.command({type: 'pause', paused: true});
      message = result.message;
    } else if (result.status === 'empty') {
      save();
      message = world.snapshot().message;
    } else {
      message = '已恢复上次进度 · 点地面行走';
    }
    changed = !!pending;
    parked = null;
    refresh();
    clock.reset();
    if (!document.hidden) clock.resume(performance.now());
    return result;
  }
  const api = {
    start() {
      if (running) return;
      running = true;
      clock.reset();
      if (!document.hidden) clock.resume(performance.now());
      frame = requestAnimationFrame(loop);
    },
    snapshot_json() { return JSON.stringify(readout); },
    command_context() { const view = world.snapshot(); return JSON.stringify({id:`command:${view.nextCommandId}`,expectedRevision:view.revision}); },
    notice() { return message; },
    command(payload) {
      let command;
      try { command = JSON.parse(payload); }
      catch { return JSON.stringify({ok: false, error: '操作格式不正确'}); }
      if (command?.type !== 'select' && (!persistence.canWrite || recoveryOnly)) {
        if (!recoveryOnly) message = persistence.status;
        return JSON.stringify({ok: false, error: message});
      }
      if (command.type !== 'select') {
        if (typeof command.id !== 'string' || !Number.isInteger(command.expectedRevision)) return JSON.stringify({ok:false,error:'请重新确认本次操作'});
      }
      const result = world.command(command);
      if (!result.ok) message = result.error;
      else if (command.type === 'select') {
        const values = command.kind === 'person' ? refresh().people : refresh().buildings;
        const entity = values.find(item => item.id === String(command.id));
        const activities = {idle:'休憩',walk:'行走',heal:'疗伤',rest:'休息',groundRest:'就地休息',study:'研习',work:'劳作',cultivate:'修炼',construct:'营造',carry:'搬运',wait:'等候'};
        message = entity ? `${entity.name} · ${entity.indoor && command.kind === 'person' ? '屋内活动' : activities[entity.activity] || (entity.type ? '营造' : entity.activity) || '在院'}` : '未找到此对象';
      } else {
        changed = true;
        message = command.type === 'move' ? '掌门正在前往落点' : command.type === 'pause' ? (command.paused ? '世界已暂停' : '世界继续运行') : command.name === 'masterAction' && command.args?.[0] === 'heal' ? '已开始疗伤' : '操作已完成';
      }
      refresh();
      return JSON.stringify(result);
    },
    save_slot: save,
    reload_slot() {
      if (recoveryOnly) return;
      if (changed && !JSON.parse(save()).ok) return;
      return open().catch(fail);
    },
    download_save() {
      let content = world.save();
      const originalArchive = archiveRecovery && !recoveryOnly && !changed;
      if (originalArchive) {
        const bundle = JSON.parse(persistence.exportBundle(1));
        delete bundle.legacy;
        content = JSON.stringify(bundle, null, 2);
      }
      const blob = new Blob([content], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = originalArchive ? '云岫预览-档案恢复资料.json' : '云岫山院-进度.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message = originalArchive ? '原档与备份已导出，请保留恢复资料' : '已导出当前进度，请保留下载的文件';
    },
    import_save() {
      clock.suspend();
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.id = 'godot-import-file';
      input.hidden = true;
      document.body.append(input);
      const done = () => { input.remove(); if (!document.hidden) clock.resume(performance.now()); };
      input.addEventListener('cancel', done, {once:true});
      input.addEventListener('change', async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          if (file.size > MAX_IMPORT_BYTES) throw Error('档案超过可导入大小');
          const text = await file.text();
          const parsed = persistence.parseImport(text);
          if (!parsed.ok) throw Error(parsed.error);
          const preview = createGodotBridge({state:parsed.state,sites:siteLayout?.sites}).snapshot();
          if (!preview.people.some(person => person.id === preview.masterId)) throw Error('此预览支持山院存档，请先在游戏首页归院后导出');
          if (!window.confirm('将此档案导入当前预览？当前预览档会保留备份。')) return;
          if (recoveryOnly) throw Error('请先导出保留进度，再刷新读取最新档案');
          if (changed) {
            const saved = JSON.parse(save());
            if (!saved.ok) throw Error(saved.message);
          }
          const result = await persistence.importInto(1, text, {confirmed:true});
          if (!result.ok) throw Error(result.message);
          const loaded = world.load(JSON.stringify(result.state));
          if (!loaded.ok) throw Error(loaded.error);
          recoveryOnly = false;
          archiveRecovery = false;
          changed = false;
          message = parsed.migrated ? '旧档已迁入预览，原文已保留备份' : '档案已导入';
          refresh();
        } catch (error) {
          message = error.message || '导入未完成';
        } finally { done(); }
      }, {once:true});
      input.click();
    },
    export_save() { return world.save(); },
    diagnostics() { return {engine:'godot-4.6.3',namespace,canWrite:persistence.canWrite && !recoveryOnly,recoveryOnly,metrics:metrics.snapshot(),tick:readout.tick}; },
  };
  function fail(error) {
    world.command({type: 'pause', paused: true});
    message = error?.message || '当前操作未完成';
    refresh();
    console.error(error);
  }
  function loop(now) {
    if (!running) return;
    const timing = clock.next(now);
    const started = performance.now();
    if (!document.hidden && persistence.canWrite && !recoveryOnly && timing.dt > 0) {
      try {
        const priorTick = readout.tick;
        readout = world.advance(timing.dt);
        changed ||= priorTick !== readout.tick;
        if (changed && now-lastSave >= 10000) { lastSave = now; save(); }
      } catch (error) { fail(error); }
    }
    metrics.record({elapsedMs:timing.elapsedMs,workMs:performance.now()-started,visible:!document.hidden,droppedGap:timing.droppedGap});
    frame = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clock.suspend();
      if (changed && persistence.canWrite) save();
    } else clock.resume(performance.now());
  });
  window.addEventListener('pagehide', () => {
    clock.suspend();
    if (changed && persistence.canWrite) save();
    parked = {text:world.save(),head:persistence.captureHead(),dirty:changed};
    persistence.release();
    cancelAnimationFrame(frame);
    running = false;
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) open({resume:true}).then(() => api.start()).catch(fail);
  });
  await open();
  globalThis.xianfuGodot = api;
  return api;
}
