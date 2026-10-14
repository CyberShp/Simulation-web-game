import { courtyardNavigation } from './world.mjs';
import { trailNavigation, TRAIL_LANDMARKS, TRAIL_ARRIVAL, isTrailArrival } from './trail-world.mjs';

export const TICK_SECONDS = .1;
export const SKILLS = Object.freeze(Object.fromEntries(Object.entries({
  attack: { name: '普通攻击', cooldown: 8, windup: 3, impact: 4, end: 8, range: 75, damage: 18, qi: 0 },
  sword: { name: '青岚剑气', cooldown: 28, windup: 3, impact: 8, end: 11, range: 260, damage: 34, qi: 9, radius: 35 },
  fire: { name: '赤阳火诀', cooldown: 50, windup: 4, impact: 9, end: 12, range: 320, damage: 28, qi: 16, radius: 55 },
  ward: { name: '凝气护阵', cooldown: 80, windup: 3, impact: 3, end: 8, range: 0, damage: 0, qi: 12, shield: 50, duration: 50 }
}).map(([id, skill]) => [id, Object.freeze(skill)])));

const MODES = ['team', 'duel', 'trail', 'trail32'];
const isTrail = state => state.mode === 'trail' || state.mode === 'trail32';
const teamSize = mode => mode === 'duel' ? 1 : mode === 'trail32' ? 16 : 8;
export const battleWorld = state => isTrail(state) ? trailNavigation : courtyardNavigation;

const ACTIVE = 'active';
const TERMINAL = new Set(['victory', 'defeat', 'draw', 'retreated']);
const STATUSES = new Set(['ready', ACTIVE, ...TERMINAL]);
const EVENT_KINDS = new Set(['release', 'hit', 'miss', 'result', 'ward', 'cast', 'order_failed']);
const PLANNABLE = new Set(['move', 'moveVector', 'attack', 'cast']);
const EPSILON = 1e-7;
const MAX_EVENTS = 512;
const copyPoint = p => ({ x: p.x, y: p.y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const isPoint = p => p && finite(p.x) && finite(p.y);
const skillKnown = id => typeof id === 'string' && Object.hasOwn(SKILLS, id);
const fail = reason => ({ ok: false, reason });
const success = () => ({ ok: true });
const actorById = (state, id) => state.actors.find(actor => actor.id === id);
const enemyOf = (state, actor, id) => state.actors.find(other => other.id === id && other.team !== actor.team && other.hp > 0);
const orderedActors = state => [...state.actors].sort((a, b) => a.id.localeCompare(b.id));

function nearestEnemy(state, actor) {
  return state.actors.filter(other => other.team !== actor.team && other.hp > 0)
    .sort((a, b) => distance(actor, a) - distance(actor, b) || a.id.localeCompare(b.id))[0] || null;
}

function makeActor(id, name, team, x, y, index, seed) {
  const master = id === 'master';
  const maxHp = master ? 280 : 100;
  const maxQi = master ? 100 : 65;
  return {
    id, name, team, appearance: team === 'red' ? 'red' : !master && index % 3 === 0 ? 'white' : 'blue',
    x, y, hp: maxHp, maxHp, qi: maxQi, maxQi, shield: 0, shieldUntil: 0,
    dir: team === 'blue' ? 1 : -1, back: false, distance: 0, moving: false,
    action: null, path: [], moveInput: { x: 0, y: 0 },
    cooldowns: { attack: 0, sword: 0, fire: 0, ward: 0 },
    targetId: null, autoAttack: false, aiNextTick: (seed + index * 7) % 5,
    power: master ? 1 : .5, speed: master ? 110 : team === 'blue' ? 60 : 65,
    pathTarget: null, pathUpdatedTick: 0
  };
}

export function createBattle({ mode = 'team', seed = 17 } = {}) {
  if (!MODES.includes(mode) || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('演武模式或种子无效。');
  const actors = [makeActor('master', '掌门', 'blue', 720, 710, 0, seed)];
  if (mode === 'trail' || mode === 'trail32') {
    Object.assign(actors[0], TRAIL_LANDMARKS.home);
    for (let i = 0; i < teamSize(mode) - 1; i++) {
      const row = Math.floor(i / 5), offset = mode === 'trail32' && row === 1 ? 42.5 : 0;
      const ally = makeActor(`blue-${i + 1}`, `青衣弟子${i + 1}`, 'blue', 650 + i % 5 * 85 + offset, 710 - row * 60, i + 1, seed);
      ally.speed = 110;
      actors.push(ally);
    }
    const columns = mode === 'trail32' ? 8 : 4;
    for (let i = 0; i < teamSize(mode); i++) actors.push(makeActor(`red-${i + 1}`, `赤衣弟子${i + 1}`, 'red', (mode === 'trail32' ? 600 : 650) + i % columns * (mode === 'trail32' ? 84 : 140), 2470 + Math.floor(i / columns) * 70, i + teamSize(mode), seed));
  } else if (mode === 'team') {
    for (let i = 0; i < 7; i++) actors.push(makeActor(`blue-${i + 1}`, `青衣弟子${i + 1}`, 'blue', 520 + i % 3 * 105, 455 + Math.floor(i / 3) * 90, i + 1, seed));
    for (let i = 0; i < 8; i++) actors.push(makeActor(`red-${i + 1}`, `赤衣弟子${i + 1}`, 'red', 980 + i % 3 * 95, 455 + Math.floor(i / 3) * 90, i + 8, seed));
  } else actors.push(makeActor('red-1', '赤衣弟子', 'red', 990, 710, 1, seed));
  const state = {
    kind: 'yunxiu-arena', version: 1, ruleset: 'arena-v1', id: `arena:${mode}:${seed}`, mode, seed,
    tick: 0, status: 'ready', paused: false, playerId: 'master', selectedTargetId: null,
    actors, events: [], nextEventId: 1, plannedCommand: null, result: null
  };
  if (isTrail(state)) state.trail = { phase: 'outbound', home: copyPoint(TRAIL_LANDMARKS.home), engagementRadius: 380, returnRadius: 50, startedTick: null, clearedTick: null };
  validateBattle(state);
  return state;
}

function emit(state, kind, actor, action, target, extra = {}) {
  const event = {
    id: state.nextEventId++, kind, skill: action?.skill ?? null, atTick: state.tick,
    sourceId: actor.id, targetId: target?.id ?? action?.targetId ?? null,
    from: copyPoint(actor), to: copyPoint(target || action?.to || actor), ...extra
  };
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  return event;
}

function stopMotion(actor) {
  actor.path = [];
  actor.pathTarget = null;
  actor.moveInput = { x: 0, y: 0 };
  actor.moving = false;
}

function finish(state, status) {
  if (state.status !== ACTIVE) return;
  state.status = status;
  state.result = { status, atTick: state.tick };
  state.plannedCommand = null;
  for (const actor of state.actors) {
    stopMotion(actor);
    actor.autoAttack = false;
    actor.action = null;
  }
  emit(state, 'result', actorById(state, state.playerId), null, null, { result: status });
}

function canStartSkill(state, actor, skill, target) {
  if (!skillKnown(skill)) return '未知招式。';
  if (actor.hp <= 0) return '人物已倒下。';
  if (actor.action) return '当前招式尚未收势。';
  const definition = SKILLS[skill];
  if (isTrail(state) && state.trail.phase === 'outbound' && skill !== 'ward') return '先到谷地与同门会合，再开始会武。';
  if (actor.cooldowns[skill] > state.tick) return '招式仍在冷却。';
  if (actor.qi + EPSILON < definition.qi) return '灵力不足。';
  if (skill === 'ward') return '';
  if (!target || target.hp <= 0 || target.team === actor.team) return '请选择仍在场的对手。';
  if (distance(actor, target) > definition.range + EPSILON) return '目标超出招式范围。';
  if (!battleWorld(state).clearLine(actor, target)) return '目标被障碍遮挡。';
  return '';
}

function startSkill(state, actor, skill, target) {
  const reason = canStartSkill(state, actor, skill, target);
  if (reason) return fail(reason);
  const definition = SKILLS[skill];
  const aim = skill === 'ward' ? actor : target;
  actor.qi = Math.max(0, actor.qi - definition.qi);
  actor.cooldowns[skill] = state.tick + definition.cooldown;
  stopMotion(actor);
  if (aim !== actor) {
    if (Math.abs(aim.x - actor.x) > EPSILON) actor.dir = Math.sign(aim.x - actor.x);
    actor.back = aim.y < actor.y;
  }
  actor.action = {
    skill, startTick: state.tick, releaseTick: state.tick + definition.windup,
    impactTick: state.tick + definition.impact, endTick: state.tick + definition.end,
    from: copyPoint(actor), to: copyPoint(aim), targetId: aim.id, released: false, impacted: false
  };
  emit(state, 'cast', actor, actor.action, aim);
  return success();
}

function normalizeRequest(state, request) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || typeof request.type !== 'string') return null;
  if (request.actorId !== undefined && request.actorId !== state.playerId) return null;
  const type = request.type;
  if (type === 'move' || type === 'moveVector') {
    const position = request.target || request.vector || request;
    if (!isPoint(position)) return null;
    return { type, x: position.x, y: position.y };
  }
  if (type === 'cast') return { type, skill: request.skill, targetId: request.targetId ?? state.selectedTargetId };
  if (type === 'select') return { type, targetId: request.targetId === undefined ? state.selectedTargetId : request.targetId };
  if (type === 'attack') return { type, targetId: request.targetId ?? state.selectedTargetId };
  if (type === 'pause') return typeof request.value === 'boolean' ? { type, value: request.value } : null;
  return { type };
}

function applyActionCommand(state, request) {
  const actor = actorById(state, state.playerId);
  if (actor.hp <= 0) return fail('掌门已倒下。');
  if (request.type === 'cast') {
    const target = request.skill === 'ward' ? actor : enemyOf(state, actor, request.targetId);
    return startSkill(state, actor, request.skill, target);
  }
  if (request.type === 'attack') {
    if (isTrail(state) && state.trail.phase === 'outbound') return fail('先到谷地与同门会合，再开始会武。');
    if (actor.action) return fail('当前招式尚未收势。');
    const target = enemyOf(state, actor, request.targetId);
    if (!target) return fail('请选择仍在场的对手。');
    actor.autoAttack = true;
    actor.targetId = target.id;
    state.selectedTargetId = target.id;
    stopMotion(actor);
    return success();
  }
  if (request.type === 'move' || request.type === 'moveVector') {
    if (actor.action?.released) return fail('当前招式尚未收势。');
    let route = null;
    if (request.type === 'move') {
      route = battleWorld(state).findPath(actor, request);
      if (!route) return fail('此处无法通行。');
    }
    actor.action = null;
    actor.autoAttack = false;
    actor.targetId = null;
    stopMotion(actor);
    if (request.type === 'move') {
      actor.path = route;
      actor.pathTarget = copyPoint(request);
      actor.pathUpdatedTick = state.tick;
    } else {
      const length = Math.hypot(request.x, request.y);
      actor.moveInput = length > EPSILON ? { x: request.x / length, y: request.y / length } : { x: 0, y: 0 };
    }
    return success();
  }
  return fail('未知演武指令。');
}

export function command(state, request) {
  const input = normalizeRequest(state, request);
  if (!input) return fail('指令无效；只能操控掌门。');
  if (input.type === 'start') {
    if (state.status === ACTIVE) return success();
    if (state.status !== 'ready') return fail('本场演武已经结束。');
    state.status = ACTIVE;
    state.paused = false;
    return success();
  }
  if (TERMINAL.has(state.status)) return input.type === 'retreat' && state.status === 'retreated' ? success() : fail('本场演武已经结束。');
  if (input.type === 'pause') {
    state.paused = input.value;
    return success();
  }
  if (input.type === 'select') {
    const master = actorById(state, state.playerId);
    if (input.targetId !== null && !enemyOf(state, master, input.targetId)) return fail('请选择仍在场的对手。');
    state.selectedTargetId = input.targetId;
    return success();
  }
  if (state.status !== ACTIVE) return fail('先开始演武。');
  if (input.type === 'moveVector' && Math.hypot(input.x, input.y) <= EPSILON) {
    actorById(state, state.playerId).moveInput = { x: 0, y: 0 };
    return success();
  }
  if (input.type === 'retreat') {
    finish(state, 'retreated');
    return success();
  }
  if (input.type === 'stop') {
    const actor = actorById(state, state.playerId);
    stopMotion(actor);
    actor.autoAttack = false;
    actor.targetId = null;
    if (actor.action && !actor.action.released) actor.action = null;
    state.plannedCommand = null;
    return success();
  }
  if (!PLANNABLE.has(input.type)) return fail('未知演武指令。');
  if (input.type === 'cast' && !skillKnown(input.skill)) return fail('未知招式。');
  if (input.type === 'move' && !battleWorld(state).isWalkable(input.x, input.y)) return fail('此处无法通行。');
  if ((input.type === 'attack' || input.type === 'cast' && input.skill !== 'ward') && !enemyOf(state, actorById(state, state.playerId), input.targetId)) return fail('请选择仍在场的对手。');
  if (state.paused) {
    state.plannedCommand = input;
    return success();
  }
  return applyActionCommand(state, input);
}

function pursue(state, actor, target) {
  if (distance(actor, target) <= SKILLS.attack.range * .9 && battleWorld(state).clearLine(actor, target)) {
    actor.path = [];
    actor.pathTarget = null;
    return;
  }
  if (state.tick - actor.pathUpdatedTick < 5 && actor.pathTarget) return;
  if (actor.path.length && actor.pathTarget && distance(actor.pathTarget, target) < 24) return;
  const length = distance(actor, target);
  const stop = {
    x: target.x + (actor.x - target.x) / Math.max(length, 1) * SKILLS.attack.range * .8,
    y: target.y + (actor.y - target.y) / Math.max(length, 1) * SKILLS.attack.range * .8
  };
  actor.path = battleWorld(state).findPath(actor, battleWorld(state).isWalkable(stop.x, stop.y) ? stop : target) || [];
  actor.pathTarget = copyPoint(target);
  actor.pathUpdatedTick = state.tick;
}

function followMaster(state, actor) {
  if (actor.action) return;
  actor.targetId = null;
  const master = actorById(state, state.playerId);
  const index = Number(actor.id.split('-')[1]);
  const heading = master.path[0] ? { x: master.path[0].x - master.x, y: master.path[0].y - master.y } : master.moveInput;
  const length = Math.hypot(heading.x, heading.y);
  const dx = length > EPSILON ? heading.x / length : 0, dy = length > EPSILON ? heading.y / length : master.back ? -1 : 1;
  const lateral = ((index - 1) % 5 - 2) * (master.y >= TRAIL_ARRIVAL.partyMinY ? 60 : 32), forward = 80 - Math.floor((index - 1) / 5) * 55;
  const offset = { x: master.x + dx * forward + dy * lateral, y: master.y + dy * forward - dx * lateral };
  if (isTrailArrival(master)) offset.y = Math.max(TRAIL_ARRIVAL.partyMinY + 24, offset.y);
  const target = battleWorld(state).isWalkable(offset.x, offset.y) ? offset : master;
  if (distance(actor, target) <= 18) {
    stopMotion(actor);
    return;
  }
  // A moving leader keeps the cached route until it has changed substantially.
  if (state.tick - actor.pathUpdatedTick < 10) return;
  if (actor.path.length && actor.pathTarget && distance(actor.pathTarget, target) < 45) return;
  actor.path = battleWorld(state).findPath(actor, target) || [];
  actor.pathTarget = copyPoint(target);
  actor.pathUpdatedTick = state.tick;
}

function decideNpc(state, actor) {
  if (actor.hp <= 0 || state.tick < actor.aiNextTick) return;
  actor.aiNextTick = state.tick + 5;
  if (isTrail(state) && state.trail.phase !== 'combat') {
    if (actor.team === 'blue') followMaster(state, actor);
    return;
  }
  const target = nearestEnemy(state, actor);
  actor.targetId = target?.id ?? null;
  if (!target || actor.action) return;
  if (actor.hp < actor.maxHp * .45 && actor.shield <= 0 && startSkill(state, actor, 'ward', actor).ok) return;
  if (distance(actor, target) <= SKILLS.attack.range && startSkill(state, actor, 'attack', target).ok) return;
  if (startSkill(state, actor, 'sword', target).ok) return;
  if (distance(actor, target) > SKILLS.attack.range * 1.2 && startSkill(state, actor, 'fire', target).ok) return;
  pursue(state, actor, target);
}

function updateMasterAttack(state, actor) {
  if (!actor.autoAttack || actor.hp <= 0 || actor.action) return;
  const target = enemyOf(state, actor, actor.targetId) || nearestEnemy(state, actor);
  actor.targetId = target?.id ?? null;
  if (!target) return;
  if (!startSkill(state, actor, 'attack', target).ok) pursue(state, actor, target);
}

function moveActor(state, actor) {
  actor.moving = false;
  if (actor.hp <= 0 || actor.action) return;
  const before = copyPoint(actor);
  if (Math.hypot(actor.moveInput.x, actor.moveInput.y) > EPSILON) {
    battleWorld(state).moveTowards(actor, { x: actor.x + actor.moveInput.x * actor.speed * TICK_SECONDS, y: actor.y + actor.moveInput.y * actor.speed * TICK_SECONDS }, TICK_SECONDS, actor.speed);
  } else {
    let budget = actor.speed * TICK_SECONDS;
    while (actor.path.length && budget > EPSILON) {
      const origin = copyPoint(actor);
      const result = battleWorld(state).moveTowards(actor, actor.path[0], budget / actor.speed, actor.speed);
      budget -= distance(origin, actor);
      if (result.reached) actor.path.shift();
      else {
        if (result.blocked) actor.path = [];
        break;
      }
    }
  }
  const moved = distance(before, actor);
  actor.distance += moved;
  actor.moving = moved > EPSILON;
  if (actor.moving) {
    if (Math.abs(actor.x - before.x) > EPSILON) actor.dir = Math.sign(actor.x - before.x);
    actor.back = actor.y < before.y;
  }
}

function collectImpacts(state, actors) {
  const wards = [];
  const hits = [];
  for (const actor of actors) {
    const action = actor.action;
    if (!action) continue;
    if (actor.hp <= 0 && !action.released) {
      actor.action = null;
      continue;
    }
    if (!action.released && state.tick >= action.releaseTick) {
      action.released = true;
      action.from = copyPoint(actor);
      emit(state, 'release', actor, action, null, { from: copyPoint(action.from), to: copyPoint(action.to) });
    }
    if (!action.impacted && state.tick >= action.impactTick) {
      action.impacted = true;
      const definition = SKILLS[action.skill];
      if (action.skill === 'ward') {
        if (actor.hp > 0) wards.push({ actor, action });
      } else if (action.skill === 'fire') {
        const targets = actors.filter(other => other.hp > 0 && other.team !== actor.team && distance(other, action.to) <= definition.radius && battleWorld(state).clearLine(actor, action.to) && battleWorld(state).clearLine(action.to, other));
        for (const target of targets) hits.push({ actor, action, target, damage: Math.round(definition.damage * actor.power * 100) / 100 });
        if (!targets.length) emit(state, 'miss', actor, action, null, { to: copyPoint(action.to), amount: 0 });
      } else {
        const target = enemyOf(state, actor, action.targetId);
        const inReach = target && (action.skill === 'attack' ? distance(actor, target) <= definition.range + EPSILON : distance(target, action.to) <= definition.radius + EPSILON);
        if (inReach && battleWorld(state).clearLine(actor, target)) hits.push({ actor, action, target, damage: Math.round(definition.damage * actor.power * 100) / 100 });
        else emit(state, 'miss', actor, action, target, { to: copyPoint(action.to), amount: 0 });
      }
    }
  }
  for (const { actor, action } of wards) {
    actor.shield = Math.max(actor.shield, SKILLS.ward.shield);
    actor.shieldUntil = state.tick + SKILLS.ward.duration;
    emit(state, 'ward', actor, action, actor, { amount: actor.shield });
  }
  hits.sort((a, b) => a.target.id.localeCompare(b.target.id) || a.actor.id.localeCompare(b.actor.id));
  const losses = new Map();
  for (const hit of hits) {
    const { actor, action, target, damage } = hit;
    const prior = losses.get(target.id) || { hp: 0, shield: 0 };
    const absorbed = Math.min(Math.max(0, target.shield - prior.shield), damage);
    const amount = Math.min(Math.max(0, target.hp - prior.hp), damage - absorbed);
    prior.hp += amount;
    prior.shield += absorbed;
    losses.set(target.id, prior);
    emit(state, 'hit', actor, action, target, { amount, absorbed });
  }
  for (const [id, loss] of losses) {
    const target = actorById(state, id);
    target.hp = Math.max(0, target.hp - loss.hp);
    target.shield = Math.max(0, target.shield - loss.shield);
    if (target.hp === 0) {
      stopMotion(target);
      target.autoAttack = false;
      if (!target.action?.released) target.action = null;
    }
  }
  for (const actor of actors) if (actor.action && state.tick >= actor.action.endTick) actor.action = null;
}

function step(state) {
  state.tick++;
  if (state.plannedCommand) {
    const planned = state.plannedCommand;
    state.plannedCommand = null;
    const outcome = applyActionCommand(state, planned);
    if (!outcome.ok) {
      const actor = actorById(state, state.playerId);
      const target = actorById(state, planned.targetId);
      const aim = planned.type === 'move' ? planned : target || actor;
      emit(state, 'order_failed', actor, { skill: planned.skill ?? null, targetId: planned.targetId ?? null, to: aim }, target, { reason: outcome.reason });
    }
  }
  const actors = orderedActors(state);
  if (isTrail(state) && state.trail.phase === 'outbound') {
    const allies = actors.filter(actor => actor.team === 'blue' && actor.hp > 0);
    const enemies = actors.filter(actor => actor.team === 'red' && actor.hp > 0);
    if (isTrailArrival(actorById(state, state.playerId)) && allies.every(ally => ally.y >= TRAIL_ARRIVAL.partyMinY)
      && allies.some(ally => enemies.some(enemy => distance(ally, enemy) <= state.trail.engagementRadius))) {
      state.trail.phase = 'combat';
      state.trail.startedTick = state.tick;
    }
  }
  for (const actor of actors) {
    if (actor.shieldUntil <= state.tick) actor.shield = 0;
    if (actor.hp > 0) actor.qi = Math.min(actor.maxQi, actor.qi + .25);
    if (actor.id !== state.playerId) decideNpc(state, actor);
  }
  updateMasterAttack(state, actorById(state, state.playerId));
  for (const actor of actors) moveActor(state, actor);
  collectImpacts(state, actors);
  const masterAlive = actorById(state, state.playerId).hp > 0;
  const redAlive = actors.some(actor => actor.team === 'red' && actor.hp > 0);
  if (!masterAlive && !redAlive) finish(state, 'draw');
  else if (!masterAlive) finish(state, 'defeat');
  else if (!redAlive && isTrail(state)) {
    if (state.trail.phase !== 'return') {
      state.trail.phase = 'return';
      state.trail.clearedTick = state.tick;
      for (const actor of actors) {
        actor.autoAttack = false;
        actor.targetId = null;
        stopMotion(actor);
      }
    }
    if (distance(actorById(state, state.playerId), state.trail.home) <= state.trail.returnRadius) finish(state, 'victory');
  } else if (!redAlive) finish(state, 'victory');
}

export function advanceBattle(state, ticks = 1) {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > 100000) throw new Error('推进步数无效。');
  for (let i = 0; i < ticks && state.status === ACTIVE && !state.paused; i++) step(state);
  return state;
}

function requireValid(condition, message) {
  if (!condition) throw new Error(`演武存档无效：${message}`);
}

function validatePoint(state, p, label, { walkable = false } = {}) {
  requireValid(isPoint(p), `${label}坐标`);
  requireValid(p.x >= 0 && p.x <= battleWorld(state).world.width && p.y >= 0 && p.y <= battleWorld(state).world.height, `${label}边界`);
  if (walkable) requireValid(battleWorld(state).isWalkable(p.x, p.y), `${label}脚点`);
}

export function validateBattle(data) {
  requireValid(data && typeof data === 'object' && !Array.isArray(data), '结构');
  requireValid(data.kind === 'yunxiu-arena' && data.version === 1 && data.ruleset === 'arena-v1', '版本');
  requireValid(MODES.includes(data.mode) && Number.isSafeInteger(data.seed) && data.seed >= 0 && data.seed <= 0xffffffff, '模式');
  requireValid(data.id === `arena:${data.mode}:${data.seed}` && data.playerId === 'master', '标识');
  requireValid(Number.isSafeInteger(data.tick) && data.tick >= 0 && data.tick <= 1e9 && STATUSES.has(data.status) && typeof data.paused === 'boolean', '时钟或阶段');
  requireValid(Array.isArray(data.actors) && data.actors.length === (teamSize(data.mode) * 2), '人数');
  const ids = new Set(data.actors.map(actor => actor?.id));
  requireValid(ids.size === data.actors.length && ids.has('master'), '人物标识');
  requireValid(data.actors.filter(actor => actor?.team === 'blue').length === teamSize(data.mode) && data.actors.filter(actor => actor?.team === 'red').length === teamSize(data.mode), '阵营');
  requireValid(data.selectedTargetId === null || ids.has(data.selectedTargetId), '选中目标');
  if (isTrail(data)) {
    const trail = data.trail;
    requireValid(trail && ['outbound', 'combat', 'return'].includes(trail.phase), '行旅阶段');
    validatePoint(data, trail.home, '返院目标', { walkable: true });
    requireValid(trail.home.x === TRAIL_LANDMARKS.home.x && trail.home.y === TRAIL_LANDMARKS.home.y && trail.engagementRadius === 380 && trail.returnRadius === 50, '行旅参数');
    for (const key of ['startedTick', 'clearedTick']) requireValid(trail[key] === null || Number.isSafeInteger(trail[key]) && trail[key] >= 0 && trail[key] <= data.tick, '行旅时刻');
    requireValid(trail.phase !== 'outbound' || trail.startedTick === null && trail.clearedTick === null, '出行阶段');
    requireValid(trail.phase !== 'combat' || trail.startedTick !== null && trail.clearedTick === null, '交战阶段');
    requireValid(trail.phase !== 'return' || trail.clearedTick !== null && data.actors.every(actor => actor.team !== 'red' || actor.hp === 0), '返院阶段');
    requireValid(trail.startedTick === null || trail.clearedTick === null || trail.startedTick <= trail.clearedTick, '行旅顺序');
  } else requireValid(data.trail === undefined, '模式专属行旅状态');
  for (const actor of data.actors) {
    requireValid(actor && typeof actor.id === 'string' && (actor.id === 'master' || /^(blue|red)-[1-9][0-9]*$/.test(actor.id) && Number(actor.id.split('-')[1]) <= teamSize(data.mode) - (actor.team === 'blue' ? 1 : 0)) && typeof actor.name === 'string' && actor.name.length > 0 && actor.name.length <= 80, '人物');
    requireValid(['blue', 'red'].includes(actor.team) && ['blue', 'red', 'white'].includes(actor.appearance), '人物阵营或外观');
    requireValid(actor.id === 'master' ? actor.team === 'blue' : actor.id.startsWith(`${actor.team}-`), '人物阵营引用');
    validatePoint(data, actor, actor.id, { walkable: true });
    requireValid(finite(actor.maxHp) && actor.maxHp > 0 && actor.maxHp <= 10000 && finite(actor.hp) && actor.hp >= 0 && actor.hp <= actor.maxHp, '生命');
    requireValid(finite(actor.maxQi) && actor.maxQi > 0 && actor.maxQi <= 10000 && finite(actor.qi) && actor.qi >= 0 && actor.qi <= actor.maxQi, '灵力');
    requireValid(finite(actor.shield) && actor.shield >= 0 && actor.shield <= 10000 && Number.isSafeInteger(actor.shieldUntil) && actor.shieldUntil >= 0, '护盾');
    requireValid([-1, 1].includes(actor.dir) && typeof actor.back === 'boolean' && typeof actor.moving === 'boolean' && finite(actor.distance) && actor.distance >= 0, '动作外观');
    requireValid(finite(actor.speed) && actor.speed > 0 && actor.speed <= 1000 && finite(actor.power) && actor.power >= 0 && actor.power <= 100, '演武能力');
    requireValid(isPoint(actor.moveInput) && Math.hypot(actor.moveInput.x, actor.moveInput.y) <= 1 + EPSILON, '移动输入');
    requireValid(actor.targetId === null || ids.has(actor.targetId), '人物目标');
    requireValid(typeof actor.autoAttack === 'boolean' && Number.isSafeInteger(actor.aiNextTick) && actor.aiNextTick >= 0, '自主行动');
    requireValid(actor.cooldowns && Object.keys(actor.cooldowns).length === 4 && Object.keys(SKILLS).every(skill => Number.isSafeInteger(actor.cooldowns[skill]) && actor.cooldowns[skill] >= 0), '冷却');
    requireValid(Array.isArray(actor.path) && actor.path.length <= 512, '路径');
    for (const p of actor.path) validatePoint(data, p, '路径', { walkable: true });
    requireValid(Number.isSafeInteger(actor.pathUpdatedTick) && actor.pathUpdatedTick >= 0 && actor.pathUpdatedTick <= data.tick, '路径时刻');
    if (actor.pathTarget !== null) validatePoint(data, actor.pathTarget, '路径目标', { walkable: true });
    if (actor.action !== null) {
      const action = actor.action;
      requireValid(action && skillKnown(action.skill) && ids.has(action.targetId), '招式');
      const definition = SKILLS[action.skill];
      requireValid(Number.isSafeInteger(action.startTick) && action.startTick >= 0 && action.startTick <= data.tick && action.releaseTick === action.startTick + definition.windup && action.impactTick === action.startTick + definition.impact && action.endTick === action.startTick + definition.end && action.endTick > data.tick, '招式时刻');
      requireValid(typeof action.released === 'boolean' && typeof action.impacted === 'boolean' && action.released === (data.tick >= action.releaseTick) && action.impacted === (data.tick >= action.impactTick), '招式阶段');
      validatePoint(data, action.from, '招式起点', { walkable: true });
      validatePoint(data, action.to, '招式落点', { walkable: true });
    }
  }
  requireValid(Array.isArray(data.events) && data.events.length <= MAX_EVENTS && Number.isSafeInteger(data.nextEventId) && data.nextEventId >= 1, '事件');
  let lastEventId = 0;
  let lastEventTick = 0;
  for (const event of data.events) {
    requireValid(event && Number.isSafeInteger(event.id) && event.id > lastEventId && event.id < data.nextEventId && EVENT_KINDS.has(event.kind), '事件编号');
    requireValid(Number.isSafeInteger(event.atTick) && event.atTick >= lastEventTick && event.atTick <= data.tick && ids.has(event.sourceId) && (event.targetId === null || ids.has(event.targetId)), '事件引用');
    requireValid(event.skill === null ? ['result', 'order_failed'].includes(event.kind) : skillKnown(event.skill), '事件招式');
    if (event.kind === 'order_failed' || event.reason !== undefined) requireValid(typeof event.reason === 'string' && event.reason.length > 0 && event.reason.length <= 200, '事件原因');
    validatePoint(data, event.from, '事件起点');
    validatePoint(data, event.to, '事件落点');
    for (const field of ['amount', 'absorbed']) if (event[field] !== undefined) requireValid(finite(event[field]) && event[field] >= 0 && event[field] <= 1e6, '事件数值');
    lastEventId = event.id;
    lastEventTick = event.atTick;
  }
  if (data.plannedCommand !== null) {
    const plan = data.plannedCommand;
    requireValid(plan && PLANNABLE.has(plan.type), '暂停计划');
    if (plan.type === 'move' || plan.type === 'moveVector') requireValid(isPoint(plan), '计划位置');
    if (plan.type === 'move') requireValid(battleWorld(data).isWalkable(plan.x, plan.y), '计划脚点');
    if (plan.type === 'cast') requireValid(skillKnown(plan.skill), '计划招式');
    if (plan.type === 'attack' || plan.type === 'cast' && plan.skill !== 'ward') requireValid(ids.has(plan.targetId), '计划目标');
  }
  if (TERMINAL.has(data.status)) {
    requireValid(data.result?.status === data.status && Number.isSafeInteger(data.result.atTick) && data.result.atTick === data.tick && data.plannedCommand === null && data.actors.every(actor => !actor.action && !actor.moving && actor.path.length === 0 && !actor.autoAttack), '结算');
    requireValid(data.events.filter(event => event.kind === 'result').length === 1 && data.events.at(-1).kind === 'result', '结算事件');
    const masterAlive = actorById(data, 'master').hp > 0;
    const redAlive = data.actors.some(actor => actor.team === 'red' && actor.hp > 0);
    if (data.status === 'victory') {
      requireValid(masterAlive && !redAlive, '胜局');
      if (isTrail(data)) requireValid(data.trail.phase === 'return' && distance(actorById(data, 'master'), data.trail.home) <= data.trail.returnRadius, '返院胜局');
    }
    if (data.status === 'defeat') requireValid(!masterAlive && redAlive, '败局');
    if (data.status === 'draw') requireValid(!masterAlive && !redAlive, '平局');
  } else {
    requireValid(data.result === null && data.events.every(event => event.kind !== 'result'), '进行中的结果');
    requireValid(actorById(data, 'master').hp > 0 && (data.actors.some(actor => actor.team === 'red' && actor.hp > 0) || isTrail(data) && data.trail.phase === 'return'), '进行中的人物');
  }
  return true;
}

export function snapshot(state) {
  return JSON.parse(JSON.stringify(state));
}

export function serializeBattle(state) {
  validateBattle(state);
  return JSON.stringify(state);
}

export function restoreBattle(value) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  validateBattle(parsed);
  return snapshot(parsed);
}
