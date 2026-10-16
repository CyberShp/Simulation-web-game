/** U-139 desktop policy adapter. All world facts are owned by the official SIM. */
import * as SIM from '../../src/simulation/ea-opening-sim.mjs';
import { projectGodotWorld } from '../../src/simulation/ea-godot-bridge.mjs';
import { godotMoveCommand } from '../../src/simulation/ea-godot-world.mjs';
import { SECT_DOMAIN, DOMAIN_EXTENT_VERSION } from '../../src/simulation/ea-sect-domain.mjs';
import { spatialAccess, spatialBounds } from '../../src/simulation/ea-sr-spatial.mjs';
import { workOpportunity } from '../../src/simulation/ea-life.mjs';
import { openingCombatProfile } from '../../src/simulation/ea-opening-inheritance.mjs';
import { breakthroughView } from '../../src/simulation/ea-sr-cultivation.mjs';
import { facilitySlots } from '../../src/simulation/ea-facility-slots.mjs';
import { scenicFindPath, scenicNearest } from '../../src/simulation/ea-scene-geometry.mjs';
import { COURTYARD_MASTER_TERRAIN_VERSION } from '../../src/simulation/ea-courtyard-master-terrain.mjs';
import seed from './sect-seed.mjs';
import { OPENING_SOURCE_KIND, isOpeningSession, openingStage, openingView } from './sect-opening.mjs';
export { openingView } from './sect-opening.mjs';

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
    return { ok: true, result, commandId: id, message: reason };
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
      a.kind === 'sr-replenish' ? ['cancelReplenish', []] :
        a.kind === 'construction' ? ['cancelConstruction', []] :
        a.kind === 'sr-cultivation' && s.srCultivation.orders[a.orderId]?.kind === 'study' ? ['cancelCultivationOrder', [a.orderId]] : null;
  if (!request) return { ok: false, error: '这项正式事务须完成或从对应入口中止。' };
  const consequences = actionConsequences(s);
  const result = publicCommand(session, ...request, { reason: consequences.resultMessage });
  return { ...result, consequences };
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
export function createOpeningSectSession({ name } = {}) {
  const initialOptions = { sr: true, mountainOpening: true, ...(name === undefined ? {} : { name }) };
  const state = SIM.initial(initialOptions);
  const session = createSectSession({ source: { state, provenance: {
    kind: OPENING_SOURCE_KIND, initialTick: state.worldTick, initialOptions,
    rulesetVersion: state.rulesetVersion
  } } });
  session.reason = '先读完序章，在云岫山中落脚。';
  return session;
}
export function commandSect(session, request) {
  try {
    if (!request || typeof request !== 'object') throw Error('操作格式无效。');
    const stage = openingStage(session), openingActive = isOpeningSession(session) && stage !== 'complete';
    if (openingActive && ['auto', 'return-auto'].includes(request.type)) throw Error('先完成落脚、疗伤与主殿营造，再交由掌门自主安排。');
    if (openingActive && ['intro', 'inheritance'].includes(stage) && !['opening-intro', 'choose-inheritance', 'pause', 'manual', 'policy'].includes(request.type)) {
      throw Error(stage === 'intro' ? '先读完序章，在山中落脚。' : '先确定遗卷传承。');
    }
    if (request.type === 'policy') {
      session.policy = checkedPolicy({ ...session.policy, ...(request.policy || request.value || {}) });
      session.automation.nextDecisionTick = session.state.worldTick;
      note(session, 'policy', '已更新灵草目标、自主整备额度和本地行动偏好。');
      return { ok: true, policy: clone(session.policy), message: '灵草目标、自主整备累计额度和行动偏好已更新。' };
    }
    if (['auto', 'return-auto'].includes(request.type)) {
      session.control = { mode: 'auto', idleMs: 30000 };
      syncControl(session);
      session.automation.nextDecisionTick = session.state.worldTick;
      note(session, 'control', '掌门开始按目标自理。');
      return { ok: true, message: '掌门开始按目标自理，当前事务继续。' };
    }
    if (request.type === 'manual') {
      session.control = { mode: 'manual', idleMs: 0 };
      syncControl(session);
      note(session, 'control', '掌门进入亲控期，当前事务继续；三十秒内不另开自主事务。');
      return { ok: true, message: '已由玩家亲自安排，当前事务继续。' };
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
    let command, reason, replacesBody = false, actorId = MASTER;
    if (request.type === 'opening-intro') {
      if (!isOpeningSession(session) || stage !== 'intro') throw Error('序章已经读完。');
      if (request.complete === true) {
        if (session.state.story.onboarding.introPage !== 2) throw Error('先读至序章最后一幕。');
        command = { name: 'acknowledgeIntro', args: [] }; reason = '带着母亲的包裹，在云岫山中落脚。';
      } else { command = { name: 'setIntroPage', args: [request.page] }; reason = '继续读序章。'; }
    }
    else if (request.type === 'choose-inheritance') {
      if (!isOpeningSession(session) || stage !== 'inheritance') throw Error('此刻没有待择的传承。');
      command = { name: 'chooseOpeningInheritance', args: [request.lineage] }; reason = '遗卷传承已经确定，继续调息养伤。';
    }
    else if (request.type === 'establish-hall') {
      const opening = openingView(session);
      if (!opening.enabled || !opening.canEstablishHall) throw Error(opening.hallReason || '先完成开局疗伤与择卷。');
      command = { name: 'establishHall', args: [] }; reason = '已确认营造主殿，掌门开始按实际路线运料施工。';
    }
    else if (request.type === 'move') { command = movementCommand(session.state, request.x, request.y); reason = '掌门按玩家指定的位置实际行走。'; replacesBody = true; }
    else if (['rest', 'cultivate'].includes(request.type)) { command = { name: 'masterAction', args: [request.type] }; reason = request.type === 'rest' ? '掌门按玩家指令休整。' : '掌门按玩家指令修炼。'; replacesBody = true; }
    else if (request.type === 'heal') {
      if (openingActive && !openingView(session).canHeal) throw Error(openingView(session).healReason);
      command = { name: 'masterAction', args: ['heal'] }; reason = '掌门使用公库六份灵草，按正式疗伤规则休养。';
    }
    else if (request.type === 'study') {
      if (!session.state.doctrine.books.includes(request.artId) || !SIM.TECHNIQUES[request.artId]) throw Error('尚不能实际接触该典籍。');
      command = { name: 'masterStudy', args: [request.artId] }; reason = `掌门到真实阅卷席研习《${SIM.TECHNIQUES[request.artId].name}》。`;
    }
    else if (request.type === 'invite-work') {
      const building = session.state.buildingsById[request.buildingId];
      if (!building || !session.state.homeMemberIds.includes(request.personId)) throw Error('只能向在院门人商议现有设施的真实差事。');
      command = { name: 'inviteWork', args: [request.personId, building.instanceId] }; actorId = request.personId;
      reason = `商议照看${SIM.BUILDINGS[building.type].name}，由本人决定是否接受。`;
    }
    else if (request.type === 'toggle-building') {
      const building = session.state.buildingsById[request.buildingId];
      if (!building) throw Error('设施不存在。');
      command = { name: 'toggleBuilding', args: [building.id] }; reason = `${building.enabled === false ? '恢复' : '暂停'}${SIM.BUILDINGS[building.type].name}，保留实际工单和已投入材料。`;
    }
    else if (request.type === 'replenish') {
      if (!['wood', 'stone', 'herb', 'food'].includes(request.resource)) throw Error('请选择已知基础物资来源。');
      command = { name: 'replenishPatch', args: [request.resource] }; reason = '掌门按明确指令支付材料，实际前往恢复来源；此支出单列于正式账本。';
    }
    else if (request.type === 'cancel-activity') {
      const trial = restoreSect(snapshotSect(session)), result = cancelMaster(trial);
      if (!result.ok) return result;
      const message = result.consequences?.resultMessage || '掌门已转入休整。';
      if (!result.result?.pending) {
        const rest = publicCommand(trial, 'masterAction', ['rest'], { reason: message });
        if (!rest.ok) return rest;
      }
      trial.control = { mode: 'manual', idleMs: 0 }; syncControl(trial);
      trial.automation.activeAction = null; Object.assign(session, trial);
      return { ...result, ok: true, message };
    }
    else if (request.type === 'build-site') { command = { name: 'buildDomainSite', args: [request.siteId] }; reason = '掌门按玩家选择营造东台门人居，材料须从旧院实际运往工地。'; }
    else if (request.type === 'harvest') { command = { name: 'startMasterHarvest', args: [request.resource] }; reason = '掌门按玩家安排前往实际来源采集，所得先存入随身包裹。'; }
    else if (request.type === 'transport') { command = { name: 'startTransport', args: [request.sourceStockpileId, request.targetStockpileId, MASTER, request.cargo] }; reason = '掌门按玩家安排实际取料并送至指定仓储。'; }
    else throw Error('操作尚未接入。');
    // An invalid replacement must not abandon an existing transport or crop task.
    const trial = restoreSect(snapshotSect(session));
    let consequences = null;
    if (replacesBody) { const cancelled = cancelMaster(trial); if (!cancelled.ok) return cancelled; consequences = cancelled.consequences || null; }
    if (request.type === 'establish-hall' && trial.state.story.step === 0) {
      const healed = publicCommand(trial, 'advanceStory', [], { reason: '伤势已愈，带着家传在云岫立足。' });
      if (!healed.ok) return healed;
    }
    const result = publicCommand(trial, command.name, command.args, { reason, actorId });
    // A refusal is a committed NPC answer, not a failed transaction. Keep it so
    // repeated invitations and reloads cannot reroll the same conditions.
    if (result.ok || request.type === 'invite-work' && result.refused) {
      trial.control = { mode: 'manual', idleMs: 0 };
      syncControl(trial);
      if (['move', 'rest', 'cultivate', 'study', 'heal', 'harvest', 'transport', 'replenish', 'build-site', 'establish-hall'].includes(request.type)) {
        trial.automation.activeAction = request.type === 'move' ? 'manual-walk' : null;
      }
      if (request.type === 'toggle-building') {
        // An explicit facility choice supersedes this adapter's old auto-pause.
        if (trial.automation.managedFarmId === request.buildingId) trial.automation.managedFarmId = null;
        if (trial.automation.parkedFarmId === request.buildingId) { trial.automation.parkedFarmId = null; trial.automation.parkedReason = null; }
      }
      Object.assign(session, trial);
    }
    if (result.ok && consequences) {
      result.consequences = consequences;
      result.message = `${consequences.resultMessage}${result.message}`;
    }
    if (result.ok && request.type === 'invite-work') result.message = result.result?.publicReason || result.result?.reason || '本人已接受这次差事。';
    return result;
  } catch (error) { return { ok: false, error: error.message }; }
}
export function advanceSect(session, seconds) {
  if (!finite(seconds, 0, 86400)) throw Error('推进时间须为0至86400秒。');
  if (isOpeningSession(session) && ['intro', 'inheritance'].includes(openingStage(session))) return session;
  if (session.state.speed === 0) return session;
  session.carrySeconds = Math.round((session.carrySeconds + seconds) * 1e10) / 1e10;
  const steps = Math.floor((session.carrySeconds + 1e-9) / SECT_TICK_SECONDS);
  session.carrySeconds = Math.max(0, Math.round((session.carrySeconds - steps * SECT_TICK_SECONDS) * 1e10) / 1e10);
  for (let i = 0; i < steps && session.state.speed !== 0; i++) {
    const openingActive = isOpeningSession(session) && openingStage(session) !== 'complete';
    if (openingActive) session.control = { mode: 'manual', idleMs: 0 };
    syncControl(session);
    SIM.tick(session.state, SECT_TICK_SECONDS);
    if (openingActive) session.control = { mode: 'manual', idleMs: 0 };
    else if (session.control.mode === 'manual') {
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
  const provenance = input.provenance;
  const initialSource = provenance?.kind === OPENING_SOURCE_KIND && provenance.initialTick === 0 &&
    provenance.initialOptions?.sr === true && provenance.initialOptions?.mountainOpening === true &&
    Object.keys(provenance.initialOptions).every(key => ['sr', 'mountainOpening', 'name'].includes(key)) &&
    (provenance.initialOptions.name === undefined || typeof provenance.initialOptions.name === 'string' && provenance.initialOptions.name.trim().length > 0 && provenance.initialOptions.name.trim().length <= 20) &&
    typeof provenance.rulesetVersion === 'string';
  assert(initialSource || provenance?.kind === 'normal-public-command-checkpoint' && typeof provenance.stateSha256 === 'string', '起始存档来源');
  const result = clone(input);
  result.state = SIM.validateSave(input.state);
  if (initialSource) assert(result.baseline.tick === 0 && result.state.story.opening && result.state.story.onboarding, '正式开局记录');
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
  const flow = order.materialFlow, source = flow && s.stockpilesById[flow.sourceStockpileId], site = flow && s.stockpilesById[flow.siteStockpileId];
  const total = resources => Object.values(resources || {}).reduce((sum, quantity) => sum + quantity, 0);
  const cost = s.reservationsById[order.reservationId]?.cost || {};
  const requiredQuantity = Object.entries(cost).reduce((sum, [key, quantity]) => sum + (key === 'jade' ? 0 : quantity), 0);
  const materialFlow = flow ? { ...clone(flow), sourceResources: clone(source?.resources || {}), siteResources: clone(site?.resources || {}),
    deliveredQuantity: total(site?.resources) + Object.entries(order.usedCost || {}).reduce((sum, [key, quantity]) => sum + (key === 'jade' ? 0 : quantity), 0),
    requiredQuantity, carryCapacity: 40, currentTrip: flow.trips.length,
    stageLabel: flow.cancelRequested ? '返料中' : flow.phase === 'to-source' ? '取料中' : flow.phase === 'carrying' ? '运料中' : '施工中' } : null;
  return { ...clone(projection), activityId: activity.id, workOrderId: order.id, phase: activity.phase,
    progressTicks: order.progressTicks, durationTicks: order.durationTicks,
    usedCost: clone(order.usedCost || {}), cost: clone(cost), materialFlow,
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
      const activity = s.activitiesById[s.master.activityId];
      const buildReason = !enabled ? '先启用东台山路。' : building ? '门人居已经落成。' : order ? '该处营造正在推进。' :
        s.master.location?.kind === 'travel' || s.master.location?.sceneId && s.master.location.sceneId !== SECT_DOMAIN.sceneId ? '先返回山院。' :
          activity && activity.kind !== 'facility' ? '先完成或中止当前身体活动。' : s.master.wound > 0 || s.master.energy < 15 ? '先归院养伤并恢复精力。' : missing.length ? '公库尚需备足营造材料。' : '';
      return { ...clone(site), status, buildingId: building?.instanceId || order?.targetId || null, workOrderId: order?.id || null,
        progress: building ? 1 : order ? order.progressTicks / order.durationTicks : 0, cost,
        missingCost: order || building ? {} : Object.fromEntries(missing.map(([resource, quantity]) => [resource, quantity - s.stockpilesById[HOME].resources[resource]])),
        buildAvailable: availability(buildReason), completedCapacity: building ? SIM.BUILDINGS[building.type].capacity * building.level : 0,
        materialFlow: order && construction?.workOrderId === order.id ? clone(construction.materialFlow) : null,
        reason: building ? '门人居已经落成，可按真实床位与通路使用。' : order ? construction?.reason || '材料与施工按同一工单推进。' : !enabled ? '东侧台地尚未开放。' : missing.length ? '公库尚需备足营造材料。' : '材料已备足，可由掌门发起营造。' };
    }) };
}
// Presentation of the existing opening rules. Commands always revalidate these
// conditions, the actual route, ownership and exclusive work positions.
const availability = reason => ({ available: !reason, reason: reason || '' });
const replenishCosts = { herb: { herb: 4, jade: 8 }, food: { food: 8, jade: 4 }, wood: { jade: 12, herb: 2 } };
const roundAmount = value => Math.round(value * 1e9) / 1e9;
const itemDefinition = id => ({ id, name: id.startsWith('pill:') ? SIM.RECIPES[id.slice(5)]?.name || '丹药' : SIM.RESOURCES[id] || id,
  kind: id.startsWith('pill:') ? 'pill' : id === 'insight' ? 'knowledge-budget' : id === 'jade' ? 'currency' : 'resource', transportable: id !== 'insight' });
const cargoText = cargo => Object.entries(cargo || {}).filter(([, quantity]) => quantity > 0)
  .map(([id, quantity]) => `${itemDefinition(id).name}${Number(quantity.toFixed(2))}份`).join('、');
const buildingName = building => building?.type === 'hall' ? '主殿' : SIM.BUILDINGS[building?.type]?.name || '院中设施';
function locationLabel(s, position) {
  if (position?.kind === 'travel') return '实际旅途停留处';
  if (position?.sceneId !== 'scene:yunxiu-courtyard') return '山院之外';
  const closest = s.buildings.map(b => ({ b, distance: Math.hypot(position.x - (b.transform?.x ?? b.x), position.y - (b.transform?.y ?? b.y)) }))
    .sort((a, b) => a.distance - b.distance)[0];
  return closest ? `${buildingName(closest.b)}附近` : '山院地面';
}
function stockLabel(s, id) {
  if (id === HOME) return '山院公库';
  if (id === CARRIED) return '掌门随身';
  const st = s.stockpilesById[id];
  if (id?.startsWith('stockpile:dropped:')) return `${locationLabel(s, st?.position)}的落地包裹`;
  if (st?.buildingId) return `${buildingName(s.buildingsById[st.buildingId])}货位`;
  if (id?.startsWith('stockpile:construction:')) return '营造专用货位';
  return st?.label || '院中货位';
}
function actionConsequences(s) {
  const a = s.activitiesById[s.master.activityId];
  const result = { active: false, activityId: a?.id || null, requiresConfirmation: false,
    summary: '', resultMessage: '', refunded: {}, consumed: {}, dropped: null, progressLost: 0 };
  if (!a || a.kind === 'facility') return result;
  if (a.kind === 'sr-cultivation') {
    const order = s.srCultivation.orders[a.orderId];
    if (order?.kind !== 'study') return result;
    const name = SIM.TECHNIQUES[order.parameters.artId].name;
    result.active = true;
    result.label = `研习《${name}》`;
    result.sourceStockpileId = order.sourceStockpileId;
    result.progressLost = order.progressTicks;
    if (order.consumed) {
      result.consumed = clone(order.cost);
      result.summary = `中止《${name}》会结束本次研读；${cargoText(order.cost)}已耗用，本次未完成的理解收益不结算。`;
      result.resultMessage = `已中止《${name}》；${cargoText(order.cost)}已耗用，已有理解与熟练保留。`;
      result.requiresConfirmation = true;
    } else {
      result.refunded = clone(order.cost);
      result.summary = `尚未开始研读；中止后${cargoText(order.cost)}退回${stockLabel(s, order.sourceStockpileId)}。`;
      result.resultMessage = `研习已中止，${cargoText(order.cost)}已退回${stockLabel(s, order.sourceStockpileId)}。`;
    }
  } else if (a.kind === 'sr-transport') {
    const order = s.workOrdersById[a.workOrderId];
    if (!order || terminal(order.phase)) return result;
    result.active = true; result.label = '搬运物资'; result.orderId = order.id;
    if (order.phase === 'to-source') {
      result.refunded = clone(order.cargo); result.sourceStockpileId = order.sourceStockpileId;
      result.summary = `尚未取货；中止后${cargoText(order.cargo)}退回${stockLabel(s, order.sourceStockpileId)}。`;
      result.resultMessage = `搬运已中止，${cargoText(order.cargo)}已退回${stockLabel(s, order.sourceStockpileId)}。`;
    } else {
      const position = { sceneId: s.master.position.sceneId, x: s.master.scenic.x, y: s.master.scenic.y };
      result.dropped = { stockpileId: `stockpile:dropped:${order.id}`, cargo: clone(order.cargo), position, locationLabel: locationLabel(s, position) };
      result.summary = `已经取货；中止后${cargoText(order.cargo)}留在${result.dropped.locationLabel}，需要另行搬回。`;
      result.resultMessage = `搬运已中止，${cargoText(order.cargo)}留在${result.dropped.locationLabel}，可从物资页回收。`;
      result.requiresConfirmation = true;
    }
  } else if (a.kind === 'sr-replenish') {
    const cost = s.reservationsById[a.reservationId]?.cost || {};
    result.active = true; result.label = '来源整备'; result.progressLost = a.progressTicks;
    for (const [key, quantity] of Object.entries(cost)) {
      result.refunded[key] = quantity * (1 - a.progressTicks / a.durationTicks);
      result.consumed[key] = quantity - result.refunded[key];
    }
    result.requiresConfirmation = a.progressTicks > 0;
    result.summary = `中止来源整备，退回${cargoText(result.refunded)}${a.progressTicks > 0 ? `；已用${cargoText(result.consumed)}，本次尚未完成的来源恢复不结算` : ''}。`;
    result.resultMessage = `来源整备已中止，已退回${cargoText(result.refunded)}${a.progressTicks > 0 ? `，已耗${cargoText(result.consumed)}` : ''}。`;
  } else if (a.kind === 'construction') {
    const order = s.workOrdersById[a.workOrderId], cost = s.reservationsById[a.reservationId]?.cost || {}, flow = order?.materialFlow;
    if (!order) return result;
    const refund = Object.fromEntries(Object.entries(cost).map(([key, quantity]) => [key, quantity - (order.usedCost[key] || 0)]));
    const materialAtSite = flow && Object.values(s.stockpilesById[flow.siteStockpileId]?.resources || {}).some(quantity => quantity > 0);
    const carrying = flow && Object.values(flow.cargo).some(quantity => quantity > 0);
    result.active = true; result.label = `营造${SIM.BUILDINGS[order.buildingType]?.name || '院中设施'}`; result.orderId = order.id;
    result.consumed = clone(order.usedCost); result.progressLost = order.progressTicks;
    result.pendingReturn = !!(materialAtSite || carrying); result.cancelRequested = !!flow?.cancelRequested;
    result.requiresConfirmation = result.pendingReturn || order.progressTicks > 0;
    if (result.pendingReturn) result.refundPending = refund; else result.refunded = refund;
    const used = cargoText(result.consumed);
    result.summary = flow?.cancelRequested ? '正在把工地与途中剩余材料带回公库，返库后结清退款。' :
      `中止营造${used ? `，已投入${used}` : ''}；${result.pendingReturn ? `掌门须把未用木石实际带回公库，返库后退还${cargoText(refund)}` : `退还${cargoText(refund)}`}。`;
    result.resultMessage = result.pendingReturn ? '已停止施工，掌门正在回收未用材料；返库后结清退款。' : `营造已中止，已退回${cargoText(refund)}${used ? `，已投入${used}` : ''}。`;
  } else if (a.kind === 'sr-harvest') {
    result.active = true; result.label = `采集${SIM.RESOURCES[a.resource]}`;
    result.progressLost = a.progressTicks || 0; result.requiresConfirmation = result.progressLost > 0;
    result.summary = '中止当前采集；未完成的这一批不结算，已经取得的物资保留在随身包裹。';
    result.resultMessage = '采集已中止，已经取得的物资保留在随身包裹。';
  }
  return result;
}
function recoveryView(s, stock, local, busy) {
  const cargo = {}, target = s.stockpilesById[HOME];
  let capacity = Math.max(0, Math.min(40, target.capacity - Object.values(target.resources).reduce((n, q) => n + q, 0) - Object.values(target.pills || {}).reduce((n, q) => n + q, 0)));
  for (const [id, quantity] of [...Object.entries(stock.resources || {}), ...Object.entries(stock.pills || {}).map(([id, q]) => [`pill:${id}`, q])]) {
    const amount = id.startsWith('pill:') ? Math.floor(Math.min(quantity, capacity)) : roundAmount(Math.min(quantity, capacity));
    if (id !== 'insight' && amount > 0) { cargo[id] = amount; capacity = roundAmount(capacity - amount); }
  }
  const onlyPills = Object.keys(cargo).length > 0 && Object.keys(cargo).every(id => id.startsWith('pill:'));
  let reason = local || busy || (stock.position?.sceneId !== 'scene:yunxiu-courtyard' ? '须在对应地点实际取回。' : '') ||
    (s.master.wound > (onlyPills ? 85 : 20) || s.master.energy < (onlyPills ? 5 : 15) ? '先恢复身体与精力。' : '') ||
    (s.master.scenic.spatialEvacuationOrderId ? '先完成当前撤离。' : '') ||
    (target.buildingId && s.buildingsById[target.buildingId]?.spatialLock ? '公库所在设施正在迁建。' : '') ||
    (!Object.keys(cargo).length ? '没有可回收物资，或公库空间不足。' : '');
  if (!reason) {
    const point = scenicNearest(s, stock.position, { maxDistance: s.spatial?.version === 'spatial-metres-1' ? 1.5 : 48 });
    if (!point || scenicFindPath(s, s.master.scenic, point, { maxSnap: 0 }) === null) reason = '落地处暂时没有可达通路。';
  }
  return { ...availability(reason), cargo, quantity: roundAmount(Object.values(cargo).reduce((n, q) => n + q, 0)), targetStockpileId: HOME };
}
function operationsView(s, projection) {
  const master = s.master, activity = s.activitiesById[master.activityId];
  const away = master.location?.kind === 'travel' || master.location?.sceneId && master.location.sceneId !== 'scene:yunxiu-courtyard' || master.journey || s.world.exploration || s.combat?.status === 'active';
  const busy = activity && activity.kind !== 'facility' ? '先完成或中止当前身体活动。' : '';
  const local = away ? '先返回山院。' : '';
  const home = s.stockpilesById[HOME].resources;
  const cultivationOrder = activity?.kind === 'sr-cultivation' ? s.srCultivation.orders[activity.orderId] : null;
  const construction = activity?.kind === 'construction' ? s.workOrdersById[activity.workOrderId] : null;
  const returningMaterials = !!construction?.materialFlow?.cancelRequested;
  const cancelable = ['sr-harvest', 'sr-transport', 'sr-replenish'].includes(activity?.kind) || cultivationOrder?.kind === 'study' || !!construction && !returningMaterials;
  const replacementReason = busy && (!cancelable || construction) ? busy : '';
  const consequences = actionConsequences(s), combatProfile = openingCombatProfile(s);
  const publicActivity = activity ? {
    id: activity.id, kind: activity.kind, phase: activity.phase,
    reason: cultivationOrder?.reason || activity.reason || s.workOrdersById[activity.workOrderId]?.reason || '',
    progressTicks: cultivationOrder?.progressTicks ?? activity.progressTicks ?? null,
    durationTicks: cultivationOrder?.durationTicks ?? activity.durationTicks ?? null,
    targetId: activity.targetId || cultivationOrder?.workstationId || null,
  } : null;
  const study = cultivationOrder?.kind === 'study' ? { id: cultivationOrder.id, artId: cultivationOrder.parameters.artId,
    name: SIM.TECHNIQUES[cultivationOrder.parameters.artId].name, consumed: cultivationOrder.consumed, cost: clone(cultivationOrder.cost),
    sourceStockpileId: cultivationOrder.sourceStockpileId, cancel: consequences,
    stageLabel: cultivationOrder.phase === 'blocked' || /受阻|中断/.test(cultivationOrder.reason) ? '受阻' : /工位不足|占用/.test(cultivationOrder.reason) ? '等候阅卷席' : master.wound > 0 || master.energy < 1 ? '等待身体恢复' : cultivationOrder.phase === 'executing' ? '研读中' : '前往阅卷席',
    durationSeconds: cultivationOrder.durationTicks * SECT_TICK_SECONDS,
    remainingSeconds: (cultivationOrder.durationTicks - cultivationOrder.progressTicks) * SECT_TICK_SECONDS,
    phase: cultivationOrder.phase, progressTicks: cultivationOrder.progressTicks, durationTicks: cultivationOrder.durationTicks, reason: cultivationOrder.reason } : null;
  const studyPlaces = s.buildings.filter(b => ['hall', 'library'].includes(b.type) && b.enabled !== false && b.condition > 0 && !b.spatialLock)
    .flatMap(b => facilitySlots(s, b, 'study').map(slot => ({ buildingId: b.instanceId, name: `${buildingName(b)} · ${slot.label}` })));
  const arts = projection.arts.filter(art => art.access || master.artsById[art.id]).map(art => {
    const definition = SIM.TECHNIQUES[art.id];
    const conditions = [
      { id: 'access', label: '典籍可阅', met: art.access, current: art.access, required: true, reason: '已知这部法门，当前无法实际接触典籍。' },
      { id: 'home', label: '人在山院', met: !local, current: !local, required: true, reason: local },
      { id: 'body', label: '身体空闲', met: !busy, current: !busy, required: true, reason: busy },
      { id: 'wound', label: '伤势已愈', met: master.wound <= 0, current: master.wound, required: 0, reason: '先养好伤势。' },
      { id: 'energy', label: '精力', met: master.energy >= 20, current: master.energy, required: 20, reason: '研习需要精力20。' },
      { id: 'realm', label: '境界', met: master.realm >= art.realm, current: master.realm, required: art.realm, reason: `需要${SIM.realmName(art.realm)}。` },
      ...definition.prerequisites.map((pre, index) => { const id = pre.id || master.main, current = master.artsById[id]?.understanding || 0, required = pre.mastery || pre.anyMain;
        return { id: `prerequisite:${index}`, artId: id, label: `${SIM.TECHNIQUES[id]?.name || '主修心法'}理解`, met: current >= required, current, required, reason: `先理解${SIM.TECHNIQUES[id]?.name || '主修心法'}至${required}。` }; }),
      { id: 'food', label: '公库口粮', met: home.food >= 2, current: home.food, required: 2, stockpileId: HOME, reason: '公库口粮不足2份，可采集后实际入库。' },
      { id: 'study-place', label: '阅卷场所', met: studyPlaces.length > 0, current: studyPlaces.length, required: 1, reason: '需要可用的主殿或藏经阁阅卷席。' },
    ];
    const reason = conditions.find(condition => !condition.met)?.reason || (art.understanding >= 100 ? '本篇理解已满，可通过有效实践继续熟练。' : '');
    const enabled = art.main || master.support.includes(art.id) || [combatProfile?.attackArtId, combatProfile?.guardArtId].includes(art.id);
    return { id: art.id, name: art.name, source: art.source, understanding: art.understanding, mastery: art.mastery, main: art.main,
      access: art.access, learned: art.understanding > 0, enabled, kind: art.kind,
      kindLabel: ({ main: '主修心法', support: '辅修心法', spell: '术法', martial: '武学' })[art.kind] || '法门',
      purpose: definition.description, chapterLabel: art.id === 'foundation' ? '筑基篇' : '炼气篇',
      roleLabel: art.main ? '当前主修' : master.support.includes(art.id) ? '已启用辅修' : combatProfile?.attackArtId === art.id ? '当前攻击法门' : combatProfile?.guardArtId === art.id ? '当前护持法门' : '已知法门',
      useCondition: art.id === combatProfile?.attackArtId ? `有效目标在${combatProfile.range}米内，视线通畅；消耗灵力${combatProfile.cost}。` : art.id === combatProfile?.guardArtId ? '战斗中施展护持，须有足够灵力并结束当前动作。' : definition.kind === 'main' ? '作为当前主修时用于积累修为。' : '按对应实际活动及启用条件生效。',
      conditions, studyPlaces, understandingGain: Math.max(0, Math.min(12, 100 - art.understanding)), masteryGain: 0,
      sourceStockpileId: HOME, sourceStockpileLabel: '山院公库', durationSeconds: 80 * SECT_TICK_SECONDS, travelTimeSeparate: true,
      ...availability(reason), cost: { food: 2 }, durationTicks: 80 };
  });
  const farms = s.buildings.filter(b => b.type === 'farm').map(b => {
    const stockpileId = `stockpile:${b.instanceId}`, stock = s.stockpilesById[stockpileId];
    const order = s.workOrdersById[`work:production:${b.instanceId}`];
    const source = SIM.productionAvailability(s, b);
    const reason = b.enabled === false ? '药田已暂停，可恢复使用。' : b.condition <= 0 || b.spatialLock ? '药田当前不可用。' :
      order && !terminal(order.phase) ? order.waitingReason || '' : (stock?.resources.herb || 0) < 2 ? '药田缺少田边灵草2份种苗，先实际搬入。' : source.reason;
    const harvestQuantity = roundAmount(Math.max(0, Math.min(40, (stock?.resources.herb || 0) - 2)));
    return { id: b.instanceId, buildingId: b.instanceId, name: SIM.BUILDINGS[b.type].name, enabled: b.enabled !== false,
      stockpileId, seedNeeded: Math.max(0, 2 - (stock?.resources.herb || 0)), seedRequirement: 2,
      seedScope: order && !terminal(order.phase) ? '下一轮种苗' : '本轮种苗',
      herbOnSite: stock?.resources.herb || 0, availability: availability(reason),
      harvestTransport: { quantity: harvestQuantity, retained: 2, remaining: roundAmount(Math.max(0, (stock?.resources.herb || 0) - 2 - harvestQuantity)),
        sourceStockpileId: stockpileId, targetStockpileId: HOME, ...availability(local || busy || (harvestQuantity > 0 ? '' : '田边需留下两份种苗，当前没有可搬收成。')) },
      workers: projection.systemPeople.persons.filter(p => s.activitiesById[p.currentActivity?.id]?.targetId === b.instanceId)
        .map(p => ({ id: p.id, name: p.name, activity: clone(p.currentActivity) })),
      invites: s.homeMemberIds.map(id => {
        const p = s.personsById[id], opportunity = workOpportunity(s, p, b), answer = p.schedule?.invitations?.[`work:${b.instanceId}`];
        return { personId: id, name: p.name, ...availability(opportunity.reason), available: opportunity.available,
          lastResult: answer ? { accepted: answer.accepted, available: answer.available, atTick: answer.atTick,
            reason: answer.publicReason, retryAfterTick: answer.retryAfterTick } : null };
      }),
    };
  });
  const stocks = projection.inventory.stockpiles.filter(st => st.access === 'public' || st.ownerId === MASTER).map(st => {
    const reserved = {}, inTransit = {}, allocations = [];
    const reserve = (resource, quantity, orderId, purpose) => { if (quantity > 0) { reserved[resource] = (reserved[resource] || 0) + quantity;
      allocations.push({ resource, name: itemDefinition(resource).name, quantity, orderId, purpose, phase: 'reserved' }); } };
    for (const order of Object.values(s.workOrdersById)) if (order.kind === 'transport' && order.sourceStockpileId === st.id && !terminal(order.phase)) {
      const quantities = order.phase === 'to-source' ? reserved : inTransit;
      for (const [resource, quantity] of Object.entries(order.cargo)) {
        quantities[resource] = (quantities[resource] || 0) + quantity;
        allocations.push({ resource, name: itemDefinition(resource).name, quantity, orderId: order.id,
          purpose: `送往${stockLabel(s, order.targetStockpileId)}`, phase: order.phase === 'to-source' ? 'reserved' : 'inTransit' });
      }
    }
    for (const order of Object.values(s.workOrdersById)) if (order.kind === 'production' && `stockpile:${order.targetId}` === st.id && !terminal(order.phase)) {
      const reservation = s.reservationsById[order.reservationId];
      for (const [resource, quantity] of Object.entries(reservation?.cost || {})) reserve(resource,
        reservation.remainingCost?.[resource] ?? quantity * Math.max(0, 1 - order.progressTicks / order.durationTicks), order.id, `${buildingName(s.buildingsById[order.targetId])}生产投入`);
    }
    for (const order of Object.values(s.srCultivation.orders)) if (order.kind === 'study' && order.sourceStockpileId === st.id && !terminal(order.phase) && !order.consumed) {
      for (const [resource, quantity] of Object.entries(order.cost)) reserve(resource, quantity, order.id, `研习《${SIM.TECHNIQUES[order.parameters.artId].name}》`);
    }
    if (st.id === HOME) for (const action of Object.values(s.activitiesById)) if (action.kind === 'sr-replenish') {
      for (const [resource, quantity] of Object.entries(s.reservationsById[action.reservationId]?.cost || {})) reserve(resource, quantity * Math.max(0, 1 - action.progressTicks / action.durationTicks), action.id, '恢复采集来源');
    }
    for (const allocation of Object.values(s.srEconomy.pillAllocations || {})) if (allocation.phase === 'reserved') {
      for (const part of allocation.parts) if (part.stockpileId === st.id) reserve(`pill:${allocation.recipeId}`, part.quantity, allocation.id, '丹药使用预留');
    }
    for (const order of Object.values(s.workOrdersById)) {
      if (order.kind === 'sr-crafting' && order.phase === 'active') for (const [resource, quantity] of Object.entries(order.cost)) {
        if (order.sourceStockpileIds[resource] === st.id) reserve(resource, quantity * Math.max(0, 1 - order.progressTicks / order.durationTicks), order.id, `炼制${SIM.RECIPES[order.recipeId].name}`);
      }
      if (order.kind === 'construction' && st.id === HOME) for (const [resource, quantity] of Object.entries(s.reservationsById[order.reservationId]?.cost || {})) {
        if (!order.materialFlow || resource === 'jade') reserve(resource, Math.max(0, quantity - (order.usedCost?.[resource] || 0)), order.id, '营造投入');
      }
      if (order.kind === 'construction' && order.materialFlow?.sourceStockpileId === st.id) for (const [resource, quantity] of Object.entries(order.materialFlow.cargo || {})) {
        if (quantity > 0) {
          inTransit[resource] = (inTransit[resource] || 0) + quantity;
          allocations.push({ resource, name: itemDefinition(resource).name, quantity, orderId: order.id, purpose: '运往营造工地', phase: 'inTransit' });
        }
      }
    }
    const constructionOrder = Object.values(s.workOrdersById).find(w => w.kind === 'construction' && [w.materialFlow?.sourceStockpileId, w.materialFlow?.siteStockpileId].includes(st.id));
    const held = !!constructionOrder || st.orderReserved;
    const available = { ...st.resources, ...Object.fromEntries(Object.entries(st.pills || {}).map(([id, q]) => [`pill:${id}`, q])) };
    if (held) for (const [resource, quantity] of Object.entries(available)) { reserve(resource, quantity, constructionOrder?.id || null, constructionOrder ? '营造专用材料' : '商单预留'); available[resource] = 0; }
    const itemIds = new Set([...Object.keys(available), ...Object.keys(reserved), ...Object.keys(inTransit)]);
    const items = [...itemIds].map(id => ({ ...itemDefinition(id), available: available[id] || 0, reserved: reserved[id] || 0, inTransit: inTransit[id] || 0,
      total: (available[id] || 0) + (reserved[id] || 0) + (inTransit[id] || 0) })).filter(item => item.total > 0);
    const dropped = st.id.startsWith('stockpile:dropped:');
    return { ...clone(st), label: stockLabel(s, st.id), locationLabel: st.id === CARRIED ? '由掌门随身携带' : locationLabel(s, st.position),
      ownerLabel: s.personsById[st.ownerId]?.name || '山院', ownershipLabel: st.access === 'public' ? '山院公用' : '掌门私有',
      capacity: s.stockpilesById[st.id]?.capacity ?? null, available, reserved, inTransit, items, allocations, dropped,
      ...(dropped ? { recovery: recoveryView(s, st, local, busy) } : {}),
      transport: availability(local || busy || (held ? '此货位物资已由事务占用。' : '')) };
  });
  // The first gather/transport command creates this actual carried stockpile.
  if (!stocks.some(st => st.id === CARRIED)) stocks.push({ id: CARRIED, label: '掌门随身', ownerId: MASTER, access: 'private',
    resources: {}, pills: {}, available: {}, reserved: {}, inTransit: {}, items: [], allocations: [],
    ownerLabel: master.name, ownershipLabel: '掌门私有', locationLabel: '由掌门随身携带',
    position: clone(master.position), capacity: 40, notYetCreated: true });
  const harvest = Object.entries(SIM.HARVEST_BATCH).map(([id, batchSize]) => {
    const patch = s.srEconomy.patches[id], cost = replenishCosts[id];
    const carried = s.stockpilesById[CARRIED];
    const carriedQuantity = Object.values(carried?.resources || {}).reduce((sum, quantity) => sum + quantity, 0) + Object.values(carried?.pills || {}).reduce((sum, quantity) => sum + quantity, 0);
    const reason = local || busy || (master.wound > 20 || master.energy < 15 ? '先恢复身体与精力，采集需要精力15。' : '') ||
      (carriedQuantity + batchSize > (carried?.capacity || 40) ? '随身空间不足一整批，请先实际搬入公库。' : '') ||
      (!SIM.harvestAvailable(s, id, batchSize) ? '整批来源不足，先恢复或另寻补给。' : '');
    const replenishReason = !cost ? '青石矿脉不可凭空恢复，须采购或寻找其他矿源。' : local || busy ||
      (master.wound > 20 || master.energy < 20 ? '先恢复身体与精力，整备需要精力20。' : '') ||
      (patch.remaining > patch.max * .25 ? '当前来源尚足，暂不需要恢复。' : '') ||
      (Object.entries(cost).some(([key, amount]) => home[key] < amount) ? '公库补种或整备材料不足，先采集并实际入库。' : '');
    return { id, name: SIM.RESOURCES[id], batchSize, remaining: patch.remaining, ...availability(reason),
      replenish: { cost: clone(cost || {}), ...availability(replenishReason) } };
  });
  const inventorySummary = clone(projection.inventory.summary.filter(group => ['public', 'personal'].includes(group.id)));
  // The generic inventory view predates SR study meals. Their unconsumed cost
  // is already removed from available stock, and remains refundable in this order.
  for (const order of Object.values(s.srCultivation.orders)) if (order.kind === 'study' && !terminal(order.phase) && !order.consumed) {
    const stock = s.stockpilesById[order.sourceStockpileId];
    const group = inventorySummary.find(item => item.id === (stock?.access === 'public' ? 'public' : stock?.ownerId === MASTER ? 'personal' : null));
    for (const [resource, quantity] of Object.entries(order.cost)) if (group?.amounts[resource]) {
      group.amounts[resource].reserved += quantity;
      group.amounts[resource].total += quantity;
    }
  }
  for (const group of inventorySummary) for (const [id, amounts] of Object.entries(group.amounts)) Object.assign(amounts, itemDefinition(id));
  const breakthrough = clone(breakthroughView(s));
  breakthrough.costConditions = Object.entries(breakthrough.cost).map(([id, required]) => ({ ...itemDefinition(id), current: home[id] || 0, required, met: (home[id] || 0) >= required }));
  breakthrough.entryAvailable = false;
  breakthrough.entryReason = '此山院界面可查看突破条件，突破安排入口待接入。';
  return {
    master: { id: MASTER, name: master.name, realmLabel: SIM.realmName(master.realm), xp: master.xp, xpNeed: SIM.xpNeed(master.realm),
      energy: master.energy, wound: master.wound, activity: publicActivity, mainArtId: master.main, mainArtName: SIM.TECHNIQUES[master.main]?.name || '尚未主修', breakthrough,
      actions: { rest: { ...availability(local || replacementReason), consequence: consequences }, cultivate: { ...availability(local || replacementReason || (master.wound > 0 ? '先养好伤势。' : '') || (!master.main ? '先取得并修习主修心法。' : '') || (master.xp >= SIM.xpNeed(master.realm) ? '本层积累已满，继续修炼不会增加修为。' : '')), consequence: consequences },
        heal: availability(local || busy || (master.wound <= 0 ? '伤势已愈，无需耗药。' : '') || (home.herb < 6 ? '公库灵草不足6份，可采集后实际入库。' : '')),
        cancel: { ...availability(returningMaterials ? '掌门正在回收未用材料，返库后结束营造事务。' : cancelable ? '' : '当前没有可在此中止的事务。'), consequence: consequences } } },
    actionConsequences: consequences, arts, study, farms, inventory: { stockpiles: stocks, summary: inventorySummary },
    harvest, canTransport: availability(local || busy),
  };
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
    buildings: view.buildings.map(b => {
      const official = s.buildingsById[`building:yunxiu:${b.id}`];
      return { ...clone(b), enabled: official?.enabled !== false, entrance: official ? clone(spatialAccess(official)) : null };
    }), masterPath: clone(view.masterPath), crop: clone(view.herbTerrace),
    stockpiles: knownStocks.filter(id => s.stockpilesById[id]).map(id => { const st = s.stockpilesById[id]; return { id, resources: clone(st.resources), position: clone(st.carrierId ? { sceneId: s.personsById[st.carrierId].position.sceneId, ...s.personsById[st.carrierId].scenic } : st.position), capacity: st.capacity, buildingId: st.buildingId || null }; }),
    patches: clone(s.srEconomy.patches), budget: { ...clone(session.budget), remaining: Math.max(0, session.policy.spendingCap - session.budget.spent), label: '自主整备灵石额度', scope: '掌门自主发起的来源恢复支出；宗门日常供给和生产工资继续按正式规则结算。' },
    economy: { expenses: clone(s.economy.expense), previousExpenses: clone(s.economy.previous.expense), starvation: s.economy.starvation, productionWages: Object.values(s.factsById).filter(f => f.operation === 'production' && f.atTick >= session.baseline.tick).reduce((total, f) => total + (f.wagesFromPublic || 0), 0) },
    ledger: clone(session.ledger), totals: clone(session.totals), provenance: clone(session.provenance),
    transports: Object.values(s.workOrdersById).filter(w => w.kind === 'transport').map(w => ({ id: w.id, phase: w.phase, carrierId: w.carrierId,
      sourceStockpileId: w.sourceStockpileId, sourceLabel: stockLabel(s, w.sourceStockpileId), targetStockpileId: w.targetStockpileId, targetLabel: stockLabel(s, w.targetStockpileId),
      carrierName: s.personsById[w.carrierId]?.name || '承运者', stageLabel: ({ 'to-source': '前往取货', carrying: '已取货，正在送达', delivered: '已送达', cancelled: '已中止' })[w.phase],
      returnedTo: w.returnedTo || null, returnedToLabel: w.returnedTo ? stockLabel(s, w.returnedTo) : null, cargo: clone(w.cargo), reason: w.reason })),
    targetMet: s.stockpilesById[HOME].resources.herb >= session.policy.herbTarget,
    operations: operationsView(s, view), opening: openingView(session)
  };
}
