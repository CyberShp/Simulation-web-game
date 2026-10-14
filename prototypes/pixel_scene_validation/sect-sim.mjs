/** U-139 desktop policy adapter. All world facts are owned by the official SIM. */
import * as SIM from '../../dist/ea-opening-sim.mjs';
import { projectGodotWorld } from '../../dist/ea-godot-bridge.mjs';
import { godotMoveCommand } from '../../dist/ea-godot-world.mjs';
import { SECT_DOMAIN, DOMAIN_EXTENT_VERSION } from '../../dist/ea-sect-domain.mjs';
import { spatialBounds } from '../../dist/ea-sr-spatial.mjs';
import { COURTYARD_MASTER_TERRAIN_VERSION } from '../../dist/ea-courtyard-master-terrain.mjs';
import seed from './sect-seed.mjs';

export const SECT_FORMAT = 'pixel-sect-session';
export const SECT_VERSION = 1;
export const SECT_TICK_SECONDS = .1;
export const SECT_POLICY_DEFAULTS = Object.freeze({ herbTarget: 30, spendingCap: 12, risk: 'cautious' });
const MASTER = 'person:master', HOME = 'stockpile:yunxiu', CARRIED = 'stockpile:carried:master';
const clone = value => structuredClone(value);
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const terminal = phase => ['completed', 'cancelled', 'delivered'].includes(phase);
function assert(condition, message) { if (!condition) throw Error(`宗门存档无效：${message}`); }
// U-139's desktop policy owns the U-119 control entry point. This only mirrors
// control metadata; official commands/ticks still own bodies and all world facts.
function syncControl(session) { session.state.masterControl = { ...session.control }; }
function movementCommand(state, x, y) {
  const location = state.master.location;
  if (location?.kind === 'travel' || (location?.sceneId && location.sceneId !== SECT_DOMAIN.sceneId)) return godotMoveCommand(state, x, y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('位置无效。');
  const bounds = spatialBounds(state);
  if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) throw Error('请在当前场景范围内选择位置。');
  return { name: 'moveScenicMaster', args: [x, y] };
}
function checkedPolicy(input) {
  assert(input && Object.keys(input).every(k => ['herbTarget', 'spendingCap', 'risk'].includes(k)), '目标设置');
  assert(finite(input.herbTarget, 0, 500) && finite(input.spendingCap, 0, 1000) && ['cautious', 'balanced'].includes(input.risk), '目标、额度或行动偏好');
  return { herbTarget: input.herbTarget, spendingCap: input.spendingCap, risk: input.risk };
}
function note(session, kind, text, extra = {}) {
  session.reason = text;
  const key = `${kind}:${text}:${extra.action || ''}:${extra.actorId || ''}:${extra.commandId || ''}`;
  session.automation.lastNotes ??= {};
  if (key === session.automation.lastNotes[kind]) return;
  session.automation.lastNotes[kind] = key;
  const entry = { id: session.nextLedgerId++, tick: session.state.worldTick, kind, text, ...clone(extra) };
  session.ledger.push(entry);
  // Aggregate counts and spend remain durable; the visible narrative is bounded.
  if (session.ledger.length > 200) session.ledger.splice(0, session.ledger.length - 200);
  session.totals[kind] = (session.totals[kind] || 0) + 1;
}
function publicCommand(session, name, args, { autonomous = false, reason = name, actorId = MASTER } = {}) {
  const state = session.state, id = `command:${state.transactions.nextCommandId}`;
  try {
    const committed = SIM.dispatchCommand(state, { name, args, id, expectedRevision: state.revision });
    session.state = committed.state;
    syncControl(session);
    const result = clone(committed.result ?? null);
    if (result === false && name === 'moveScenicMaster' || result?.accepted === false) {
      const text = result?.publicReason || result?.reason || '当前条件不满足。';
      note(session, 'refused', text, { action: name, actorId, commandId: id, autonomous });
      return { ok: false, refused: true, error: text, result };
    }
    if (autonomous && name === 'startMasterHarvest') session.automation.autonomousHarvestId = session.state.master.activityId;
    note(session, autonomous ? 'autonomous-action' : 'manual-action', reason, { action: name, actorId, commandId: id, autonomous, result });
    return { ok: true, result, commandId: id };
  } catch (error) {
    note(session, 'blocked', error.message, { action: name, actorId, autonomous });
    return { ok: false, error: error.message };
  }
}
function cancelMaster(session) {
  const s = session.state, a = s.activitiesById[s.master.activityId];
  if (!a || a.kind === 'facility') return { ok: true };
  const request = a.kind === 'sr-harvest' ? ['cancelMasterHarvest', []] :
    a.kind === 'sr-transport' ? ['cancelTransport', [a.workOrderId]] :
      a.kind === 'sr-replenish' ? ['cancelReplenish', []] : null;
  if (!request) return { ok: false, error: '这项正式事务须完成或从对应入口中止。' };
  return publicCommand(session, ...request, { reason: '掌门接管，按原规则中止当前事务。' });
}
function farmState(s) {
  const building = Object.values(s.buildingsById).find(b => b.type === 'farm' && b.condition > 0);
  const stockpileId = building ? `stockpile:${building.instanceId}` : null;
  return { building, stockpileId, stock: s.stockpilesById[stockpileId], order: s.workOrdersById[`work:production:${building?.instanceId}`] };
}
function settleOrRest(session, message) {
  const s = session.state, master = s.master;
  const energyReady = master.action === 'cultivate' ? master.energy >= 25 : master.energy >= 80;
  const action = master.wound === 0 && s.economy.starvation === 0 && energyReady && master.main && master.xp < SIM.xpNeed(master.realm) ? 'cultivate' : 'rest';
  if (master.action !== action) {
    return publicCommand(session, 'masterAction', [action], { autonomous: true, reason: `${message}${action === 'cultivate' ? '掌门转入修炼。' : '掌门先行休整。'}` });
  }
  note(session, 'waiting', `${message}${action === 'cultivate' ? '掌门继续修炼。' : '掌门继续休整。'}`);
  return { ok: true };
}
function automaticCommand(session, name, args, reason, actorId = MASTER) {
  return publicCommand(session, name, args, { autonomous: true, reason, actorId });
}
function decide(session) {
  const s = session.state, master = s.master, a = s.activitiesById[master.activityId];
  const publicHerb = s.stockpilesById[HOME].resources.herb;
  const farm = farmState(s), patch = s.srEconomy.patches.herb;
  const lu = s.personsById['person:lu-zhiwei'];

  // Only the production opportunity supplied by this controller is parked.
  // The official facility command preserves the crop and lets NPCs reconsider.
  if (publicHerb >= session.policy.herbTarget && farm.building?.enabled !== false && session.automation.managedFarmId === farm.building?.instanceId) {
    const result = automaticCommand(session, 'toggleBuilding', [farm.building.id], '公库目标已达到，暂停本次自主供苗的药田，保留在田批次；门人重新安排生活。');
    if (result.ok) { session.automation.parkedFarmId = farm.building.instanceId; session.automation.parkedReason = 'goal'; }
    return;
  }
  if (publicHerb < session.policy.herbTarget && farm.building?.enabled !== false && session.automation.managedFarmId === farm.building?.instanceId && farm.order?.crop?.phase === 'ripe/waiting' && patch.remaining < 12) {
    const result = automaticCommand(session, 'toggleBuilding', [farm.building.id], '灵草来源暂不足，保留本次自主药田的已投入批次并暂停工位，门人先安排其他生活。');
    if (result.ok) { session.automation.parkedFarmId = farm.building.instanceId; session.automation.parkedReason = 'source'; }
    return;
  }
  if (publicHerb < session.policy.herbTarget && farm.building?.enabled === false && session.automation.parkedFarmId === farm.building.instanceId && (session.automation.parkedReason === 'goal' || patch.remaining >= 12)) {
    const result = automaticCommand(session, 'toggleBuilding', [farm.building.id], '公库再次低于目标，恢复本次自主安排暂停的药田。');
    if (result.ok) { session.automation.parkedFarmId = null; session.automation.parkedReason = null; }
    return;
  }

  // Consent is checked by the original command; an existing personal activity is respected.
  if (publicHerb < session.policy.herbTarget && farm.building && farm.building.enabled !== false && farm.stock?.resources.herb >= 2 && lu && !lu.activityId && lu.energy >= 22 && lu.wound <= 20) {
    const invitation = lu.schedule?.invitations?.[`work:${farm.building.instanceId}`];
    if (!invitation || (!invitation.accepted && s.worldTick >= invitation.retryAfterTick) || invitation.accepted && s.worldTick >= lu.schedule.commitUntilTick) {
      automaticCommand(session, 'inviteWork', [lu.personId, farm.building.instanceId], '向陆知微商议照看灵草，由她按条件和意愿答复。', lu.personId);
      return;
    }
  }
  if (a && a.kind !== 'facility') {
    if (a.kind === 'sr-harvest' && a.id === session.automation.autonomousHarvestId && ['blocked', 'paused'].includes(a.phase)) {
      automaticCommand(session, 'cancelMasterHarvest', [], '采集条件改变，保留已有物资并结束本次采集。');
      return;
    }
    note(session, 'waiting', a.reason || s.workOrdersById[a.workOrderId]?.reason || '继续完成已开始的正式事务。', { action: a.kind, actorId: MASTER });
    return;
  }
  if (session.automation.activeAction === 'manual-walk') {
    if (master.scenic.path.length) return;
    session.automation.activeAction = null;
  }
  if (master.wound > 20 || master.energy < 20 || s.economy.starvation > 0) { settleOrRest(session, '身体或供给状态需要恢复，暂缓新增劳动。'); return; }
  const carried = s.stockpilesById[CARRIED]?.resources.herb || 0;
  if (carried > 0) {
    automaticCommand(session, 'startTransport', [CARRIED, HOME, MASTER, { herb: Math.min(40, carried) }], '把随身灵草实际送入公库。');
    return;
  }
  if (publicHerb >= session.policy.herbTarget) { settleOrRest(session, '公库灵草目标已达到。'); return; }
  const fieldHerb = farm.stock?.resources.herb || 0;
  if (farm.stock && fieldHerb > 2) {
    automaticCommand(session, 'startTransport', [farm.stockpileId, HOME, MASTER, { herb: Math.min(40, Math.round((fieldHerb - 2) * 1e9) / 1e9) }], '田边留足下一轮种苗，将收成实际搬回公库。');
    return;
  }
  const cropActive = farm.order && !terminal(farm.order.phase);
  if (farm.stock && farm.building.enabled !== false && !cropActive && fieldHerb < 2 && publicHerb >= 2 && patch.remaining >= 12) {
    const result = automaticCommand(session, 'startTransport', [HOME, farm.stockpileId, MASTER, { herb: 2 - fieldHerb }], '公库灵草不足目标，先把两份种苗送到药田。');
    if (result.ok) session.automation.managedFarmId = farm.building.instanceId;
    return;
  }
  const cropSourceBlocked = cropActive && farm.order.crop?.phase === 'ripe/waiting' && patch.remaining < 12;
  if (farm.building?.enabled !== false && (cropActive && !cropSourceBlocked || farm.stock && fieldHerb >= 2 && patch.remaining >= 12)) {
    if (session.policy.risk === 'balanced' && patch.remaining >= 10) {
      automaticCommand(session, 'startMasterHarvest', ['herb'], '药田按门人自己的安排推进；本地采集已获允许，掌门先到已知来源补足缺量。');
    } else {
      if (patch.remaining >= 10 && session.policy.risk === 'cautious') note(session, 'risk-blocked', '守院生产偏好未开放掌门采集，等待药田按真实照料进度收获。', { action: 'startMasterHarvest', actorId: MASTER });
      settleOrRest(session, '药田由门人按承诺与生活安排照料，等待实收。');
    }
    return;
  }
  if (session.policy.risk === 'cautious') {
    note(session, 'risk-blocked', '守院生产偏好未开放掌门采集，继续保留物资并等待院内生产条件。', { action: 'startMasterHarvest', actorId: MASTER });
    settleOrRest(session, '当前采集未获偏好允许。');
    return;
  }
  if (patch.remaining >= 10) {
    automaticCommand(session, 'startMasterHarvest', ['herb'], '本地采集已获允许，掌门前往已知灵草来源实际采集。');
    return;
  }
  const remaining = Math.max(0, session.policy.spendingCap - session.budget.spent);
  if (remaining < 8) {
    note(session, 'budget-blocked', `恢复灵草来源需8灵石，自主整备额度剩余${remaining.toFixed(1)}，暂缓支出。`, { action: 'replenishPatch', actorId: MASTER });
    settleOrRest(session, '自主整备额度不足。');
    return;
  }
  if (publicHerb < 4) { settleOrRest(session, '恢复来源还需四份公库灵草，当前材料不足。'); return; }
  const result = automaticCommand(session, 'replenishPatch', ['herb'], '在自主整备额度内支出八灵石、四份灵草，实际前往恢复来源。');
  if (result.ok) {
    session.budget.spent += 8;
    session.budget.orders.push({ commandId: result.commandId, activityId: result.result.id, tick: session.state.worldTick, jade: 8, herb: 4 });
  }
}

export function createSectSession({ policy = {}, source = seed } = {}) {
  const state = SIM.validateSave(source.state);
  const session = {
    format: SECT_FORMAT, version: SECT_VERSION, state,
    provenance: clone(source.provenance), policy: checkedPolicy({ ...SECT_POLICY_DEFAULTS, ...policy }),
    control: { mode: 'manual', idleMs: 0 }, budget: { spent: 0, orders: [] },
    automation: { nextDecisionTick: state.worldTick, activeAction: null, autonomousHarvestId: null, managedFarmId: null, parkedFarmId: null, parkedReason: null, lastNotes: {} },
    ledger: [], nextLedgerId: 1, totals: {}, carrySeconds: 0,
    reason: '掌门亲控中，三十秒未下达行动后按目标自理。',
    baseline: { tick: state.worldTick, publicResources: clone(state.stockpilesById[HOME].resources), economyExpense: clone(state.economy.expense) }
  };
  syncControl(session);
  return session;
}
export function commandSect(session, request) {
  try {
    if (!request || typeof request !== 'object') throw Error('操作格式无效。');
    if (request.type === 'policy') {
      session.policy = checkedPolicy({ ...session.policy, ...(request.policy || request.value || {}) });
      session.automation.nextDecisionTick = session.state.worldTick;
      note(session, 'policy', '已更新灵草目标、自主整备额度和本地行动偏好。');
      return { ok: true, policy: clone(session.policy) };
    }
    if (['auto', 'return-auto'].includes(request.type)) {
      session.control = { mode: 'auto', idleMs: 30000 };
      syncControl(session);
      session.automation.nextDecisionTick = session.state.worldTick;
      note(session, 'control', '掌门开始按目标自理。');
      return { ok: true };
    }
    if (request.type === 'manual') {
      session.control = { mode: 'manual', idleMs: 0 };
      syncControl(session);
      note(session, 'control', '掌门进入亲控期，当前事务继续；三十秒内不另开自主事务。');
      return { ok: true };
    }
    if (request.type === 'pause') {
      if (typeof request.paused !== 'boolean') throw Error('暂停须为布尔值。');
      return publicCommand(session, 'setSpeed', [request.paused ? 0 : 1], { reason: request.paused ? '世界已手动暂停。' : '世界继续运行。' });
    }
    if (request.type === 'enable-domain') return publicCommand(session, 'enableSectDomain', [], { reason: '已采用东侧山域布局，旧院位置、人物和物资延续原存档。' });
    if (request.type === 'enable-courtyard-terrain') {
      const trial = restoreSect(snapshotSect(session));
      if (trial.state.spatial.courtyardTerrain?.version === COURTYARD_MASTER_TERRAIN_VERSION) return { ok: true, result: { enabled: true, alreadyEnabled: true, version: trial.state.spatial.courtyardTerrain.version } };
      const result = publicCommand(trial, 'enableCourtyardTerrain', [], { reason: '山院地面物件已接入当前院落的实际通路。' });
      if (result.ok) Object.assign(session, trial);
      return result;
    }
    let command, reason, replacesBody = false;
    if (request.type === 'move') { command = movementCommand(session.state, request.x, request.y); reason = '掌门按玩家指定的位置实际行走。'; replacesBody = true; }
    else if (['rest', 'cultivate'].includes(request.type)) { command = { name: 'masterAction', args: [request.type] }; reason = request.type === 'rest' ? '掌门按玩家指令休整。' : '掌门按玩家指令修炼。'; replacesBody = true; }
    else if (request.type === 'build-site') { command = { name: 'buildDomainSite', args: [request.siteId] }; reason = '掌门按玩家选择营造东台门人居，材料须从旧院实际运往工地。'; }
    else if (request.type === 'harvest') { command = { name: 'startMasterHarvest', args: [request.resource] }; reason = '掌门按玩家安排前往实际来源采集，所得先存入随身包裹。'; }
    else if (request.type === 'transport') { command = { name: 'startTransport', args: [request.sourceStockpileId, request.targetStockpileId, MASTER, request.cargo] }; reason = '掌门按玩家安排实际取料并送至指定仓储。'; }
    else throw Error('操作尚未接入。');
    // An invalid replacement must not abandon an existing transport or crop task.
    const trial = restoreSect(snapshotSect(session));
    if (replacesBody) { const cancelled = cancelMaster(trial); if (!cancelled.ok) return cancelled; }
    const result = publicCommand(trial, command.name, command.args, { reason });
    if (result.ok) {
      trial.control = { mode: 'manual', idleMs: 0 };
      syncControl(trial);
      trial.automation.activeAction = request.type === 'move' ? 'manual-walk' : null;
      Object.assign(session, trial);
    }
    return result;
  } catch (error) { return { ok: false, error: error.message }; }
}
export function advanceSect(session, seconds) {
  if (!finite(seconds, 0, 86400)) throw Error('推进时间须为0至86400秒。');
  if (session.state.speed === 0) return session;
  session.carrySeconds = Math.round((session.carrySeconds + seconds) * 1e10) / 1e10;
  const steps = Math.floor((session.carrySeconds + 1e-9) / SECT_TICK_SECONDS);
  session.carrySeconds = Math.max(0, Math.round((session.carrySeconds - steps * SECT_TICK_SECONDS) * 1e10) / 1e10);
  for (let i = 0; i < steps && session.state.speed !== 0; i++) {
    syncControl(session);
    SIM.tick(session.state, SECT_TICK_SECONDS);
    if (session.control.mode === 'manual') {
      session.control.idleMs = Math.min(30000, session.control.idleMs + 100);
      if (session.control.idleMs === 30000) session.control.mode = 'auto';
    }
    syncControl(session);
    if (session.control.mode === 'auto' && session.state.worldTick >= session.automation.nextDecisionTick) {
      session.automation.nextDecisionTick = session.state.worldTick + 10;
      decide(session);
    }
  }
  return session;
}
function checkedSect(input) {
  assert(input?.format === SECT_FORMAT && input.version === SECT_VERSION, '格式或版本');
  const policy = checkedPolicy(input.policy), control = input.control;
  assert(control && ['manual', 'auto'].includes(control.mode) && Number.isSafeInteger(control.idleMs) && control.idleMs >= 0 && control.idleMs <= 30000 && (control.mode === 'auto') === (control.idleMs === 30000), '掌门交接状态');
  assert(finite(input.carrySeconds, 0, .09999999999), '时间余量');
  assert(input.budget && finite(input.budget.spent, 0, 1000000) && Array.isArray(input.budget.orders) && input.budget.orders.every(o => o.jade === 8 && o.herb === 4 && typeof o.commandId === 'string' && typeof o.activityId === 'string' && Number.isSafeInteger(o.tick)), '整备支出记录');
  assert(input.budget.spent === input.budget.orders.reduce((n, o) => n + o.jade, 0), '整备支出与记录不符');
  assert(Array.isArray(input.ledger) && input.ledger.length <= 200 && input.ledger.every(e => Number.isSafeInteger(e.id) && Number.isSafeInteger(e.tick) && typeof e.kind === 'string' && typeof e.text === 'string'), '行为记录');
  assert(Number.isSafeInteger(input.nextLedgerId) && input.nextLedgerId > Math.max(0, ...input.ledger.map(e => e.id)), '行为记录编号');
  assert(input.automation && Number.isSafeInteger(input.automation.nextDecisionTick) && input.automation.nextDecisionTick >= 0, '自主安排游标');
  assert(input.automation.autonomousHarvestId == null || typeof input.automation.autonomousHarvestId === 'string', '自主采集事务编号');
  assert(typeof input.reason === 'string' && input.totals && Object.values(input.totals).every(n => Number.isSafeInteger(n) && n >= 0), '自主原因与计数');
  assert(input.baseline && Number.isSafeInteger(input.baseline.tick) && input.baseline.tick >= 0, '起始世界步');
  assert([null, 'goal', 'source'].includes(input.automation.parkedReason), '药田暂停原因');
  assert(input.provenance?.kind === 'normal-public-command-checkpoint' && typeof input.provenance.stateSha256 === 'string', '起始存档来源');
  const result = clone(input);
  result.state = SIM.validateSave(input.state);
  assert(result.baseline.tick <= result.state.worldTick, '起始世界步超出当前时间');
  for (const key of ['managedFarmId', 'parkedFarmId']) assert(result.automation[key] === null || result.state.buildingsById[result.automation[key]]?.type === 'farm', '自主药田引用');
  assert(result.automation.parkedFarmId === null || result.automation.parkedFarmId === result.automation.managedFarmId, '药田暂停权限');
  assert(input.ledger.every(e => e.tick <= result.state.worldTick), '行为记录超出世界时间');
  result.policy = policy;
  syncControl(result);
  return result;
}
export function validateSect(input) { checkedSect(input); return true; }
export function snapshotSect(session) { return clone(session); }
export function restoreSect(data) { return checkedSect(typeof data === 'string' ? JSON.parse(data) : data); }
function constructionView(s, projection) {
  const activity = s.activitiesById[s.master.activityId], order = activity && s.workOrdersById[activity.workOrderId];
  if (activity?.kind !== 'construction' || order?.kind !== 'construction') return null;
  return { ...clone(projection), activityId: activity.id, workOrderId: order.id, phase: activity.phase,
    progressTicks: order.progressTicks, durationTicks: order.durationTicks,
    usedCost: clone(order.usedCost || {}), materialFlow: clone(order.materialFlow || null),
    reason: order.waitingReason || activity.reason || projection?.label || '按正式工单继续营造。' };
}
function domainView(s, construction) {
  const enabled = s.spatial?.extentVersion === DOMAIN_EXTENT_VERSION;
  return { ...clone(SECT_DOMAIN), enabled,
    openedAreas: clone(enabled ? SECT_DOMAIN.initialOpenAreas : SECT_DOMAIN.initialOpenAreas.slice(0, 1)),
    sites: SECT_DOMAIN.sites.map(site => {
      const building = Object.values(s.buildingsById).find(b => b.type === site.type && (b.transform?.x ?? b.x) === site.x && (b.transform?.y ?? b.y) === site.y);
      const order = Object.values(s.workOrdersById).find(w => w.kind === 'construction' && w.buildingType === site.type && w.targetTransform?.x === site.x && w.targetTransform?.y === site.y);
      const cost = clone(SIM.BUILDINGS[site.type].cost), missing = Object.entries(cost).filter(([resource, quantity]) => s.stockpilesById[HOME].resources[resource] < quantity);
      const status = building ? 'complete' : order ? 'building' : enabled ? 'available' : 'locked';
      return { ...clone(site), status, buildingId: building?.instanceId || order?.targetId || null, workOrderId: order?.id || null,
        progress: building ? 1 : order ? order.progressTicks / order.durationTicks : 0, cost,
        reason: building ? '门人居已经落成，可按真实床位与通路使用。' : order ? construction?.reason || '材料与施工按同一工单推进。' : !enabled ? '东侧台地尚未开放。' : missing.length ? '公库尚需备足营造材料。' : '材料已备足，可由掌门发起营造。' };
    }) };
}
export function viewSect(session) {
  const s = session.state, view = projectGodotWorld(s), members = new Set([MASTER, ...s.homeMemberIds]);
  const knownStocks = [HOME, CARRIED, ...Object.keys(s.stockpilesById).filter(id => id.startsWith('stockpile:building:') || id.startsWith('stockpile:construction:') || id.startsWith('stockpile:dropped:'))];
  const construction = constructionView(s, view.construction);
  const bounds = spatialBounds(s);
  return {
    tick: s.worldTick, time: s.time, timeLabel: view.timeLabel, paused: s.speed === 0,
    width: bounds.width, height: bounds.height, sceneId: view.sceneId, terrain: clone(view.terrain),
    bounds: { x: 0, y: 0, width: bounds.width, height: bounds.height }, domain: domainView(s, construction), construction,
    policy: clone(session.policy), control: clone(session.control), reason: session.reason,
    resources: clone(s.stockpilesById[HOME].resources), baseline: clone(session.baseline),
    people: view.people.map(p => { const official = s.personsById[p.id], body = p.id === MASTER ? official : official.mind, activity = s.activitiesById[official.activityId]; return { ...clone(p), resident: members.has(p.id), path: clone(body.scenic?.path || []), energy: official.energy, wound: official.wound, xp: official.xp, realm: official.realm, activityId: official.activityId, activityDetail: activity ? { id: activity.id, kind: activity.kind, phase: activity.phase, reason: activity.reason || s.workOrdersById[activity.workOrderId]?.reason || body.reason || '', target: clone(activity.target || null), progressTicks: activity.progressTicks ?? null, durationTicks: activity.durationTicks ?? null } : null, reason: p.id === MASTER ? session.reason : body.reason || official.schedule?.lastReason || '' }; }),
    buildings: view.buildings.map(b => ({ ...clone(b), enabled: s.buildingsById[`building:yunxiu:${b.id}`]?.enabled !== false })), masterPath: clone(view.masterPath), crop: clone(view.herbTerrace),
    stockpiles: knownStocks.filter(id => s.stockpilesById[id]).map(id => { const st = s.stockpilesById[id]; return { id, resources: clone(st.resources), position: clone(st.carrierId ? { sceneId: s.personsById[st.carrierId].position.sceneId, ...s.personsById[st.carrierId].scenic } : st.position), capacity: st.capacity, buildingId: st.buildingId || null }; }),
    patches: clone(s.srEconomy.patches), budget: { ...clone(session.budget), remaining: Math.max(0, session.policy.spendingCap - session.budget.spent), label: '自主整备灵石额度', scope: '掌门自主发起的来源恢复支出；宗门日常供给和生产工资继续按正式规则结算。' },
    economy: { expenses: clone(s.economy.expense), previousExpenses: clone(s.economy.previous.expense), starvation: s.economy.starvation, productionWages: Object.values(s.factsById).filter(f => f.operation === 'production' && f.atTick >= session.baseline.tick).reduce((total, f) => total + (f.wagesFromPublic || 0), 0) },
    ledger: clone(session.ledger), totals: clone(session.totals), provenance: clone(session.provenance),
    transports: Object.values(s.workOrdersById).filter(w => w.kind === 'transport').map(w => ({ id: w.id, phase: w.phase, carrierId: w.carrierId, sourceStockpileId: w.sourceStockpileId, targetStockpileId: w.targetStockpileId, cargo: clone(w.cargo), reason: w.reason })),
    targetMet: s.stockpilesById[HOME].resources.herb >= session.policy.herbTarget
  };
}
