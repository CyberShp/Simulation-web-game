import { isTrailArrival, TRAIL_ARRIVAL } from './trail-world.mjs';

/** Foreground route acceptance through the same commands, clock and save API as play. */
export async function createTrailQA({ scenario, sceneSettings, host, api }) {
  const checks = [], captures = [], timeline = [], runs = [];
  const startedAt = performance.now();
  let phase = 'begin', phaseAt = startedAt, busy = false, finished = false, lastPoll = 0;
  let run = null, pausedSnapshot = null, previousCamera = null, recording = null, inactiveSnapshot = null;
  let inactiveProblemReported = false;
  const backgroundChecks = [];

  const player = state => state.actors.find(actor => actor.id === state.playerId);
  const check = (name, ok, detail = {}) => {
    checks.push({ name, ok: Boolean(ok), detail });
    if (!ok) console.error('TRAIL_QA_FAIL', name, JSON.stringify(detail));
  };
  const go = name => {
    phase = name;
    phaseAt = performance.now();
    const state = api.getState();
    timeline.push({ phase, tick: state.tick, trailPhase: state.trail?.phase, mode: state.mode });
  };
  const capture = async name => {
    // Let the regular HUD cadence and a complete painted frame catch up.
    await new Promise(resolve => setTimeout(resolve, 100));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const ok = await host.capture(name);
    if (ok) captures.push(name);
    else check(`capture_${name}`, false);
  };
  const ids = state => state.actors.map(actor => actor.id).sort().join('|');
  const metrics = () => api.getMetrics();
  const diagnostics = () => {
    const current = metrics().diagnostics || {};
    return {
      samples: current.samples,
      callbackRatePerSecond: current.fps,
      callbackIntervalP95Ms: current.frameP95Ms,
      cpuFrameWorkP95Ms: current.workP95Ms,
      slowFrames: current.slowFrames,
      measurement: 'foreground animation callbacks and CPU frame work; not display FPS'
    };
  };

  if (sceneSettings.record) {
    const stream = api.canvas.captureStream(30), chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 7500000 });
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.start(1000);
    recording = { stream, chunks, recorder };
  }

  async function finish() {
    if (finished) return;
    finished = true;
    api.setPaused(true);
    if (recording) {
      try {
        await new Promise(resolve => { recording.recorder.onstop = resolve; recording.recorder.stop(); });
        const bytes = await new Blob(recording.chunks, { type: 'video/webm' }).arrayBuffer();
        if (!await host.recording({ filename: 'trail-playthrough.webm', bytes })) check('recording_saved', false);
      } catch (error) {
        check('recording_saved', false, { message: error.message });
      } finally {
        recording.stream.getTracks().forEach(track => track.stop());
      }
    }
    const current = metrics();
    const report = {
      scenario, checks, captures, timeline, runs, backgroundChecks,
      durationSeconds: (performance.now() - startedAt) / 1000,
      final: api.getState(), ...current,
      diagnostics: diagnostics(),
      measurementScope: 'visible desktop, real foreground clock, public commands; no state edits or accelerated simulation'
    };
    await host.metrics(report);
    await host.finish({ failed: checks.some(item => !item.ok) || (current.errors || []).length > 0 });
  }

  function beginRun(mode, now) {
    api.newBattle(mode, true);
    const state = api.getState(), master = player(state);
    run = {
      mode, initialIds: ids(state), initialMaster: { x: master.x, y: master.y },
      expectedCount: mode === 'trail32' ? 32 : 16,
      lastState: state, lastObservedAt: now, activeWallSeconds: 0,
      identityStable: true, continuousMovement: true, maxStepExcess: 0,
      maxY: master.y, masterDistance: 0, actualPathDistance: 0,
      actorFarthestY: Object.fromEntries(state.actors.map(actor => [actor.id, actor.y])),
      phases: [], samples: [], events: new Map(), returnTick: null, returnPosition: null,
      firstCombatTick: null, valleyFirstTick: null, valleyObservedActiveSeconds: 0,
      valleyCombatActiveSeconds: 0, lastSampleTick: -100, commandBaseline: { ...metrics().commands }
    };
    check(`${mode}_starts_in_courtyard`, state.mode === mode && state.trail?.phase === 'outbound'
      && state.actors.length === run.expectedCount && master.y < 941,
    { mode: state.mode, actors: state.actors.length, master: run.initialMaster, trail: state.trail });
    observe(state, now);
  }

  function observe(state, now) {
    if (!run) return;
    const prior = run.lastState, master = player(state), tickDelta = state.tick - prior.tick;
    if (api.getActive() && prior.status === 'active' && !prior.paused) {
      const elapsed = Math.max(0, now - run.lastObservedAt) / 1000;
      run.activeWallSeconds += elapsed;
      if (run.valleyFirstTick !== null) {
        run.valleyObservedActiveSeconds += elapsed;
        if (prior.trail?.phase === 'combat') run.valleyCombatActiveSeconds += elapsed;
      }
    }
    run.lastObservedAt = now;
    run.identityStable &&= ids(state) === run.initialIds && state.actors.length === run.expectedCount;
    if (tickDelta >= 0) {
      for (const actor of state.actors) {
        const before = prior.actors.find(value => value.id === actor.id);
        if (!before) continue;
        const movement = Math.hypot(actor.x - before.x, actor.y - before.y);
        const allowed = Math.max(actor.speed || 0, before.speed || 0) * tickDelta * .1 + .25;
        if (movement > allowed) {
          run.continuousMovement = false;
          run.maxStepExcess = Math.max(run.maxStepExcess, movement - allowed);
        }
        if (actor.id === state.playerId) run.actualPathDistance += movement;
        run.actorFarthestY[actor.id] = Math.max(run.actorFarthestY[actor.id] ?? actor.y, actor.y);
      }
    } else run.continuousMovement = false;
    run.maxY = Math.max(run.maxY, master.y);
    if (isTrailArrival(master) && run.valleyFirstTick === null) run.valleyFirstTick = state.tick;
    run.masterDistance = Math.max(run.masterDistance, master.distance || 0);
    for (const event of state.events) run.events.set(event.id, event);
    const currentPhase = state.trail?.phase;
    if (currentPhase && run.phases.at(-1) !== currentPhase) {
      run.phases.push(currentPhase);
      timeline.push({ phase: `world-${currentPhase}`, mode: state.mode, tick: state.tick, player: { x: master.x, y: master.y } });
      if (currentPhase === 'combat' && run.firstCombatTick === null) {
        run.firstCombatTick = state.tick;
        const livingParty = state.actors.filter(actor => actor.team === 'blue' && actor.hp > 0);
        check(`${run.mode}_combat_starts_after_party_arrives`, isTrailArrival(master)
          && livingParty.every(actor => actor.y >= TRAIL_ARRIVAL.partyMinY),
        { tick: state.tick, master: { x: master.x, y: master.y }, arrival: TRAIL_ARRIVAL,
          partyY: Object.fromEntries(livingParty.map(actor => [actor.id, actor.y])) });
      }
      if (currentPhase === 'return' && run.returnTick === null) {
        run.returnTick = state.tick;
        run.returnPosition = { x: master.x, y: master.y };
        check(`${run.mode}_enemies_cleared_before_return`, state.status === 'active'
          && state.actors.filter(actor => actor.team === 'red').every(actor => actor.hp === 0)
          && master.y > 941, { tick: state.tick, status: state.status, playerY: master.y });
      }
    }
    if (state.tick - run.lastSampleTick >= 20 && state.status === 'active') {
      run.lastSampleTick = state.tick;
      run.samples.push({ tick: state.tick, phase: currentPhase, actors: state.actors.length,
        alive: state.actors.filter(actor => actor.hp > 0).length,
        activeActions: state.actors.filter(actor => actor.action).length,
        ...diagnostics() });
    }
    run.lastState = state;
  }

  function completeRun(state) {
    const master = player(state), events = [...run.events.values()];
    const label = run.mode, commands = metrics().commands || {};
    const homeDistance = state.trail?.home ? Math.hypot(master.x - state.trail.home.x, master.y - state.trail.home.y) : Infinity;
    const commandCounts = Object.fromEntries(Object.entries(commands).map(([key, count]) => [key, count - (run.commandBaseline[key] || 0)]));
    if (label === 'trail') {
      check('trail_full_route_and_return_result', state.status === 'victory'
        && run.phases.join('|') === 'outbound|combat|return' && master.y < 941
        && homeDistance <= state.trail.returnRadius
        && run.valleyFirstTick !== null && run.returnTick !== null && state.tick > run.returnTick,
      { status: state.status, phases: run.phases, maxY: run.maxY, returnedY: master.y,
        homeDistance, returnRadius: state.trail?.returnRadius, tick: state.tick, returnTick: run.returnTick });
    } else {
      check('trail32_reaches_valley_and_records_result', run.valleyFirstTick !== null && run.phases.includes('combat')
        && ['victory', 'defeat', 'draw', 'retreated'].includes(state.status),
      { status: state.status, phases: run.phases, maxY: run.maxY, tick: state.tick });
    }
    check(`${label}_stable_identities_and_continuous_walk`, run.identityStable && run.continuousMovement,
      { identities: run.identityStable, continuousMovement: run.continuousMovement, maxStepExcess: run.maxStepExcess });
    const blue = state.actors.filter(actor => actor.team === 'blue');
    check(`${label}_party_really_leaves_courtyard`, blue.every(actor => run.actorFarthestY[actor.id] > 941),
      { farthestY: Object.fromEntries(blue.map(actor => [actor.id, run.actorFarthestY[actor.id]])) });
    if (label === 'trail') {
      check('trail_public_movement_and_combat_commands', commandCounts.move > 0
        && commandCounts.attack > 0 && commandCounts.cast > 0, { commands: commandCounts });
      check('trail_real_combat_and_one_result', ['master', 'blue-', 'red-'].every(prefix => events.some(event =>
        event.kind === 'hit' && event.amount > 0 && event.sourceId?.startsWith(prefix)))
        && events.filter(event => event.kind === 'result').length === 1);
    } else {
      check('trail32_real_movement_combat_and_one_result', commandCounts.move > 0
        && events.some(event => event.kind === 'hit' && event.amount > 0)
        && events.filter(event => event.kind === 'result').length === 1,
      { commands: commandCounts, result: state.status });
    }
    check(`${label}_uses_foreground_clock`, state.tick * .1 <= run.activeWallSeconds + 1.5,
      { simulatedSeconds: state.tick * .1, observedActiveSeconds: run.activeWallSeconds });
    if (label === 'trail32') {
      check('trail32_live_combat_sampled', run.expectedCount === 32 && run.samples.some(sample =>
        sample.actors === 32 && sample.phase === 'combat' && sample.activeActions > 0),
      { combatSamples: run.samples.filter(sample => sample.phase === 'combat').length });
      check('trail32_samples_until_15_seconds_or_battle_result', run.valleyObservedActiveSeconds >= 15
        || ['victory', 'defeat', 'draw'].includes(state.status),
      { activeSecondsAfterValley: run.valleyObservedActiveSeconds, combatActiveSeconds: run.valleyCombatActiveSeconds,
        result: state.status, sampleEnded: run.valleyObservedActiveSeconds >= 15 ? 'sample-duration' : 'battle-result' });
    }
    runs.push({ mode: label, actors: run.expectedCount, phases: run.phases,
      firstCombatTick: run.firstCombatTick, returnTick: run.returnTick, finalTick: state.tick,
      valleyFirstTick: run.valleyFirstTick, valleyObservedActiveSeconds: run.valleyObservedActiveSeconds,
      valleyCombatActiveSeconds: run.valleyCombatActiveSeconds,
      activeWallSeconds: run.activeWallSeconds, maxY: run.maxY, masterDistance: run.masterDistance,
      observedPathDistance: run.actualPathDistance, commands: commandCounts,
      samples: run.samples, finalStatus: state.status, finalMaster: { x: master.x, y: master.y, hp: master.hp } });
  }

  async function step(now) {
    if (now - startedAt > 300000) {
      check('trail_integration_finishes_in_300_seconds', false, { phase });
      await finish();
      return;
    }
    if (!api.getActive() || now - startedAt < 350) {
      if (run && !api.getActive()) {
        const state = api.getState();
        if (!inactiveSnapshot) inactiveSnapshot = state;
        else if (!inactiveProblemReported && JSON.stringify(state) !== JSON.stringify(inactiveSnapshot)) {
          check('trail_background_snapshot_frozen', false, { beforeTick: inactiveSnapshot.tick, afterTick: state.tick });
          inactiveProblemReported = true;
        }
      }
      if (run) run.lastObservedAt = now;
      return;
    }
    let state = api.getState();
    if (inactiveSnapshot) {
      const unchanged = JSON.stringify(state) === JSON.stringify(inactiveSnapshot);
      const detail = { beforeTick: inactiveSnapshot.tick, afterTick: state.tick, unchanged };
      backgroundChecks.push(detail);
      check('trail_background_resume_without_catchup', unchanged, detail);
      inactiveSnapshot = null;
      inactiveProblemReported = false;
    }
    if (phase === 'begin') {
      if (typeof api.setAutoplay !== 'function') throw new Error('Trail QA requires setAutoplay(value) to resume normal driving after load');
      beginRun('trail', now);
      await capture('trail-01-courtyard.png');
      go('outbound');
      return;
    }
    observe(state, now);
    if (state.status !== 'active' && ['outbound', 'save-on-trail'].includes(phase)) {
      check('trail_reaches_valley_after_reload', false, { phase, status: state.status, tick: state.tick });
      await finish();
      return;
    }
    if (phase === 'outbound' && player(state).y > 1100) {
      api.setPaused(true);
      pausedSnapshot = api.getState();
      previousCamera = { ...api.renderer.camera };
      api.renderer.camera = { ...previousCamera, x: previousCamera.x + 100, zoom: Math.min(2.8, previousCamera.zoom + .25) };
      go('save-on-trail');
    } else if (phase === 'save-on-trail' && now - phaseAt > 600) {
      check('trail_pause_and_camera_are_readonly', JSON.stringify(state) === JSON.stringify(pausedSnapshot));
      const saved = await api.saveGame(true), file = await api.readSaved(), loaded = await api.loadGame();
      state = api.getState();
      check('trail_file_save_reload_exact_snapshot', saved && file.ok && file.found && loaded
        && JSON.stringify(file.data) === JSON.stringify(pausedSnapshot)
        && JSON.stringify(state) === JSON.stringify(pausedSnapshot), { tick: state.tick, playerY: player(state).y });
      await capture('trail-02-restored-path.png');
      api.renderer.camera = previousCamera;
      api.setAutoplay(true);
      api.setPaused(false);
      go('route');
    } else if (phase === 'route' || phase === 'route32') {
      const suffix = run.mode === 'trail32' ? '32' : '16';
      if (state.trail?.phase === 'outbound' && player(state).y >= 1800
        && !captures.includes(`trail-${suffix}-pine.png`)) await capture(`trail-${suffix}-pine.png`);
      if (run.valleyFirstTick !== null && !captures.includes(`trail-${suffix}-valley.png`)) await capture(`trail-${suffix}-valley.png`);
      if (state.trail?.phase === 'combat' && run.firstCombatTick !== null && state.tick - run.firstCombatTick >= 30
        && !captures.includes(`trail-${suffix}-combat.png`)) await capture(`trail-${suffix}-combat.png`);
      if (state.trail?.phase === 'return' && !captures.includes(`trail-${suffix}-return.png`)) await capture(`trail-${suffix}-return.png`);
      if (run.mode === 'trail32' && state.status === 'active' && run.valleyObservedActiveSeconds >= 15) {
        const result = api.issue({ type: 'retreat' });
        check('trail32_sample_exit_command', result.ok, { result });
        state = api.getState();
        observe(state, performance.now());
      }
      if (state.status !== 'active') {
        completeRun(state);
        await capture(`trail-${suffix}-result.png`);
        if (run.mode === 'trail') { pausedSnapshot = api.getState(); go('hold-result'); }
        else await finish();
      }
    } else if (phase === 'hold-result' && now - phaseAt > 750) {
      check('trail_result_stays_frozen', JSON.stringify(state) === JSON.stringify(pausedSnapshot));
      beginRun('trail32', now);
      await capture('trail-32-courtyard.png');
      go('route32');
    }
  }

  return {
    update(now) {
      if (busy || finished || now - lastPoll < 50) return;
      lastPoll = now;
      busy = true;
      step(now).catch(async error => {
        check('trail_integration_exception', false, { message: error.stack || String(error) });
        await finish();
      }).finally(() => { busy = false; });
    }
  };
}
