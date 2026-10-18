import {meditationSourceView,meditationCultivationView} from '../../src/simulation/ea-spirit-sources.mjs';
import {meditationBuildView,meditationBuildingChangeView,meditationSupplyEnabled} from '../../src/simulation/ea-meditation-definitions.mjs';
import {routeReachable,inheritReachabilityProof} from '../../src/simulation/ea-route-reachability.mjs';
import {inheritResidentialGeometryCache} from '../../src/simulation/ea-residential-housing.mjs';
import {viewSiteServices} from '../../src/simulation/ea-site-services.mjs';
import {SITE_SERVICE_VERSION,siteServiceEnabled} from '../../src/simulation/ea-service-definitions.mjs';
import {SERVICE_RESOURCES} from '../../src/simulation/ea-resource-types.mjs';
/** U-139 desktop policy adapter. All world facts are owned by the official SIM. */
import * as SIM from '../../src/simulation/ea-opening-sim.mjs';
import { projectGodotWorld } from '../../src/simulation/ea-godot-bridge.mjs';
import { godotMoveCommand } from '../../src/simulation/ea-godot-world.mjs';
import { SECT_DOMAIN, domainExtentEnabled, domainWestEnabled, domainValleyEnabled, domainResidencesEnabled, domainServicesEnabled, domainNorthLibraryEnabled, domainNorthMeditationEnabled, domainWestWorkshopsEnabled } from '../../src/simulation/ea-sect-domain.mjs';
import { stockStorageView, localMarketQuote, localMarketGoods, marketGoods, merchantPresent, serviceSupplyView, warehouseServiceStoragePreview, craftAvailabilitySR, craftProcessView, craftRefundPreview } from '../../src/simulation/ea-sr-economy.mjs';
import { spatialAccess, spatialBounds, spatialPrefab, spatialRevision, placementIssue, meterFindPath } from '../../src/simulation/ea-sr-spatial.mjs';
import { workOpportunity } from '../../src/simulation/ea-life.mjs';
import { openingCombatProfile } from '../../src/simulation/ea-opening-inheritance.mjs';
import { breakthroughView, familyNotesView, teachingQualificationSR, artStudyRequirement, libraryStudentReadiness } from '../../src/simulation/ea-sr-cultivation.mjs';
import { facilitySlots } from '../../src/simulation/ea-facility-slots.mjs';
import { residentialHousingApplicable, residentialProjectionState, residentialHousingView, residentialRestView } from '../../src/simulation/ea-residential-housing.mjs';
import { scenicFindPath, scenicNearest } from '../../src/simulation/ea-scene-geometry.mjs';
import { COURTYARD_MASTER_TERRAIN_VERSION } from '../../src/simulation/ea-courtyard-master-terrain.mjs';
import seed from './sect-seed.mjs';
import { OPENING_SOURCE_KIND, isOpeningSession, openingStage, openingView } from './sect-opening.mjs';
export { openingView } from './sect-opening.mjs';

export const SECT_FORMAT = 'pixel-sect-session';
export const SECT_VERSION = 1;
export const SECT_TICK_SECONDS = .1;
export const SECT_POLICY_DEFAULTS = Object.freeze({ herbTarget: 30, foodTarget: 32, spendingCap: 12, risk: 'cautious' });
const MASTER = 'person:master', HOME = 'stockpile:yunxiu', CARRIED = 'stockpile:carried:master';
const clone = value => structuredClone(value);
const LIBRARY_KINDS = new Set(['study', 'teach', 'family-notes']);
const managedCultivation = order => LIBRARY_KINDS.has(order?.kind) || order?.kind === 'breakthrough' && order.parameters.fromRealm <= 9;
const libraryOrderName = order => order.kind === 'breakthrough' ? '突破调息' : order.kind === 'family-notes' ? '整理家传遗卷' : `${order.kind === 'teach' ? '讲习' : '研习'}《${SIM.TECHNIQUES[order.parameters.artId]?.name || '法门'}》`;
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
  if (x < (bounds.x || 0) || y < (bounds.y || 0) || x > (bounds.x || 0) + bounds.width || y > (bounds.y || 0) + bounds.height) throw Error('请在当前场景范围内选择位置。');
  return { name: 'moveScenicMaster', args: [x, y] };
}
function checkedPolicy(input) {
  assert(input && Object.keys(input).every(k => ['herbTarget', 'foodTarget', 'spendingCap', 'risk'].includes(k)), '目标设置');
  const foodTarget = Object.hasOwn(input, 'foodTarget') ? input.foodTarget : SECT_POLICY_DEFAULTS.foodTarget;
  assert(Number.isInteger(foodTarget) && finite(foodTarget, 0, 500), '口粮目标');
  assert(finite(input.herbTarget, 0, 500) && finite(input.spendingCap, 0, 1000) && ['cautious', 'balanced'].includes(input.risk), '目标、额度或行动偏好');
  return { herbTarget: input.herbTarget, foodTarget, spendingCap: input.spendingCap, risk: input.risk };
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
    inheritReachabilityProof(state, session.state);
    inheritResidentialGeometryCache(state, session.state);
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
function meditationActivityOrder(s, activity) {
  const id = activity?.kind === 'sr-spirit-survey' ? activity.workOrderId : activity?.meditationOrderId;
  const order = id && s.workOrdersById[id];
  return order && !terminal(order.phase) ? order : null;
}
function cancelMaster(session) {
  const s = session.state, a = s.activitiesById[s.master.activityId];
  const meditationOrder = meditationActivityOrder(s, a);
  if (!a || a.kind === 'facility' && !meditationOrder) return { ok: true };
  const request = meditationOrder ? ['cancelMeditationSourceOrder', [meditationOrder.id]] : a.kind === 'sr-harvest' ? ['cancelMasterHarvest', []] :
    a.kind === 'sr-transport' ? ['cancelTransport', [a.workOrderId]] :
      a.kind === 'sr-replenish' ? ['cancelReplenish', []] :
        a.kind === 'sr-craft' ? ['cancelCraft', []] :
        a.kind === 'construction' ? ['cancelConstruction', []] :
        a.kind === 'sr-cultivation' && managedCultivation(s.srCultivation.orders[a.orderId]) ? ['cancelCultivationOrder', [a.orderId]] : null;
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
function foodCarrySpace(s) {
  const carried = s.stockpilesById[CARRIED];
  const used = Object.values(carried?.resources || {}).reduce((sum, n) => sum + n, 0) + Object.values(carried?.pills || {}).reduce((sum, n) => sum + n, 0);
  return (carried?.capacity ?? 40) - used;
}
function foodStock(s) {
  for (const stock of Object.values(s.stockpilesById)) {
    const building = s.buildingsById[stock.buildingId], retained = building?.type === 'granary' ? 2 : 0;
    if (stock.id === HOME || stock.access !== 'public' || !['granary', 'warehouse'].includes(building?.type) ||
      !(stock.resources.food > retained) || building.type === 'warehouse' && !stockStorageView(s, stock.id).available) continue;
    return { stock, retained };
  }
  return null;
}
function foodSupply(session) {
  const s = session.state, home = s.stockpilesById[HOME].resources, patch = s.srEconomy.patches.food;
  const target = session.policy.foodTarget, available = home.food, carried = s.stockpilesById[CARRIED]?.resources.food || 0;
  const dailyDemand = SIM.foodDemand(s), a = s.activitiesById[s.master.activityId];
  const lowSource = patch.remaining <= patch.max * .25;
  const remainingBudget = Math.max(0, session.policy.spendingCap - session.budget.spent);
  const source = foodStock(s), stock = source?.stock;
  let status = 'supplied', reason = '公库口粮已达到储备目标。';
  if (!target) { status = 'disabled'; reason = '自动备粮已暂停，已开始的事务继续。'; }
  else if (a?.kind === 'sr-harvest' && a.resource === 'food') { status = 'collecting'; reason = a.reason || '掌门正在采粮，采得后还需送入公库。'; }
  else if (a?.kind === 'sr-transport' && s.workOrdersById[a.workOrderId]?.cargo.food > 0) { status = 'delivering'; reason = '口粮正在搬运，送达公库后才可用于日常供给。'; }
  else if (a?.kind === 'sr-replenish' && a.resource === 'food') { status = 'restoring'; reason = a.reason || '掌门正在实际补种口粮来源。'; }
  else if (carried > 0 || available < target || lowSource) {
    status = 'needed'; reason = carried > 0 ? '随身口粮待送回公库。' : stock ? source.retained ? '灵稻田收成待搬回主殿公库。' : '储运院口粮待搬回主殿公库。' : '掌门将按目标补足公库口粮。';
    if (s.master.wound > 20 || s.master.energy < 20) { status = 'blocked'; reason = '掌门先养伤、恢复精力，再继续备粮。'; }
    else if (!carried && !stock && session.policy.risk !== 'balanced') { status = 'blocked'; reason = '当前为守院生产；允许本地采集后，掌门可自动采粮并补种。'; }
    else if (!carried && !stock && available < target && foodCarrySpace(s) < SIM.HARVEST_BATCH.food) { status = 'blocked'; reason = '随身包裹装不下一批口粮；灵草会先搬回公库，其他物资可在物资页安排搬运。'; }
    else if (lowSource && !carried && !stock) {
      const materialReserve = 8 + dailyDemand;
      if (available >= materialReserve && remainingBudget >= 4 && home.jade >= 4) { status = 'needed'; reason = '口粮来源偏少，将用8份食粮、4灵石实际补种，保留一日口粮。'; }
      else {
        const missing = remainingBudget < 4 ? `自主整备额度不足4灵石，当前剩余${remainingBudget.toFixed(1)}。` : home.jade < 4 ? '公库不足4灵石，暂不能补种口粮。' : `补种需8份食粮并留一日口粮，公库需至少${materialReserve}份。`;
        status = SIM.harvestAvailable(s, 'food', SIM.HARVEST_BATCH.food) ? 'source-low' : 'blocked';
        reason = `${missing}${status === 'source-low' ? '仍可采集现有口粮来源。' : '来源不足一批，需补足材料或另行采购。'}`;
      }
    }
  }
  return { target, available, carried, dailyDemand, sourceRemaining: patch.remaining, sourceMax: patch.max, status, reason };
}
function supplyFood(session) {
  const s = session.state, supply = foodSupply(session), home = s.stockpilesById[HOME].resources;
  if (!supply.target) return false;
  if (supply.carried > 0) {
    automaticCommand(session, 'startTransport', [CARRIED, HOME, MASTER, { food: Math.min(40, supply.carried) }], '把随身口粮实际送入公库，供院中日常消耗。');
    return true;
  }
  if (supply.available < supply.target) {
    const source = foodStock(s);
    if (source) {
      const target = stockStorageView(s, HOME), quantity = Math.min(40, source.stock.resources.food - source.retained, supply.target - supply.available, target.receivable.food || 0);
      if (target.available && quantity > 0) return automaticCommand(session, 'startTransport', [source.stock.id, HOME, MASTER, { food: quantity }], source.retained ? '田边留两份种粮，把灵稻田收成实际搬回主殿公库。' : '将储运院口粮实际搬回主殿公库，补足日常储备。').ok;
      note(session, 'food-blocked', target.reason || '主殿公库当前没有接收口粮的容量。');
      return false;
    }
    const rice = s.buildings.find(b => b.type === 'granary' && b.enabled !== false && b.condition > 0 && !b.spatialLock && !b.progress &&
      (!s.workOrdersById[`work:production:${b.instanceId}`] || terminal(s.workOrdersById[`work:production:${b.instanceId}`].phase)) &&
      (s.stockpilesById[`stockpile:${b.instanceId}`]?.resources.food || 0) < 2);
    if (rice && home.food >= 2 + supply.dailyDemand && supply.sourceRemaining >= 22) {
      const siteId = `stockpile:${rice.instanceId}`, quantity = 2 - (s.stockpilesById[siteId]?.resources.food || 0);
      return automaticCommand(session, 'startTransport', [HOME, siteId, MASTER, { food: quantity }], '保留一日口粮，将下一轮种粮实际送到稻田。').ok;
    }
  }
  if (session.policy.risk !== 'balanced') {
    if (supply.available < supply.target) note(session, 'food-blocked', supply.reason);
    return false;
  }
  // Restore while seed food and a day's meals are still available, rather than
  // consuming the finite patch down to a state that cannot fund its restoration.
  if (supply.sourceRemaining <= supply.sourceMax * .25) {
    const remaining = Math.max(0, session.policy.spendingCap - session.budget.spent);
    if (home.food >= 8 + supply.dailyDemand && home.jade >= 4 && remaining >= 4) {
      const result = automaticCommand(session, 'replenishPatch', ['food'], '在自主整备额度内支出四灵石、八份食粮，实际前往补种口粮来源。');
      if (result.ok) {
        session.budget.spent += 4;
        session.budget.orders.push({ commandId: result.commandId, activityId: result.result.id, tick: session.state.worldTick, resource: 'food', jade: 4, food: 8 });
      }
      return true;
    }
    note(session, 'food-blocked', supply.reason);
  }
  if (supply.available >= supply.target) return false;
  if (!SIM.harvestAvailable(s, 'food', SIM.HARVEST_BATCH.food)) {
    note(session, 'food-blocked', supply.reason);
    return false;
  }
  if (foodCarrySpace(s) < SIM.HARVEST_BATCH.food) {
    note(session, 'food-blocked', supply.reason);
    return false;
  }
  automaticCommand(session, 'startMasterHarvest', ['food'], '公库口粮低于储备目标，掌门前往已知本地来源采粮。');
  return true;
}
function decide(session) {
  const s = session.state, master = s.master, a = s.activitiesById[master.activityId];
  const publicHerb = s.stockpilesById[HOME].resources.herb;
  const farm = farmState(s), patch = s.srEconomy.patches.herb;

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
  if (publicHerb < session.policy.herbTarget && farm.building && farm.building.enabled !== false && farm.stock?.resources.herb >= 2) {
    for (const id of s.homeMemberIds) {
      const person = s.personsById[id];
      if (!person || person.activityId || !workOpportunity(s, person, farm.building).available) continue;
      const invitation = person.schedule?.invitations?.[`work:${farm.building.instanceId}`];
      if (!invitation || (!invitation.accepted && s.worldTick >= invitation.retryAfterTick) || invitation.accepted && s.worldTick >= person.schedule.commitUntilTick) {
        automaticCommand(session, 'inviteWork', [id, farm.building.instanceId], `向${person.name}商议照看灵草，由本人按条件和意愿答复。`, id);
        return;
      }
    }
  }
  if (a && (a.kind !== 'facility' || a.serviceOrderId || a.serviceMealOrderId)) {
    if (a.kind === 'sr-harvest' && a.id === session.automation.autonomousHarvestId && ['blocked', 'paused'].includes(a.phase)) {
      automaticCommand(session, 'cancelMasterHarvest', [], '采集条件改变，保留已有物资并结束本次采集。');
      return;
    }
    note(session, 'waiting', a.reason || s.workOrdersById[a.workOrderId || a.serviceOrderId || a.serviceMealOrderId]?.reason || '继续完成已开始的正式事务。', { action: a.kind, actorId: MASTER });
    return;
  }
  if (session.automation.activeAction === 'manual-walk') {
    if (master.scenic.path.length) return;
    session.automation.activeAction = null;
  }
  if (master.wound > 20 || master.energy < 20) { settleOrRest(session, '身体需要恢复，暂缓新增劳动。'); return; }
  if (supplyFood(session)) return;
  const carried = s.stockpilesById[CARRIED]?.resources.herb || 0;
  if (carried > 0) {
    automaticCommand(session, 'startTransport', [CARRIED, HOME, MASTER, { herb: Math.min(40, carried) }], '把随身灵草实际送入公库。');
    return;
  }
  if (s.economy.starvation > 0) { settleOrRest(session, '供给状态需要恢复，暂缓新增劳动。'); return; }
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
      note(session, 'policy', '已更新口粮与灵草目标、自主整备额度和本地行动偏好。');
      return { ok: true, policy: clone(session.policy), message: '口粮与灵草目标、自主整备累计额度和行动偏好已更新。' };
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
    if (request.type === 'enable-domain') return publicCommand(session, 'enableSectDomain', [], { reason: '已启用东台与西林通路，沿原山院继续营造。' });
    if (request.type === 'enable-west-workshops') return publicCommand(session, 'enableWestWorkshops', [], { reason: '西谷工坊道路已开通，可前往丹房与百工坊的预设场地。' });
    if (request.type === 'enable-valley') return publicCommand(session, 'enableWestValley', [], { reason: '西谷道路已开通，可前往石场、稻田与公库的预设场地。' });
    if (request.type === 'enable-north-meditation') return publicCommand(session, 'enableNorthMeditation', [], { reason: '聚灵台山道已开通，可前往北台勘察脉眼。' });
    if (request.type === 'enable-north-library') return publicCommand(session, 'enableNorthLibrary', [], { reason: '藏经阁北台道路已开通，可沿山后石阶抵达预设阁址。' });
    if (request.type === 'enable-services') return publicCommand(session, 'enableEastServices', [], { reason: '膳房与医庐道路已开通，可前往预设院址。' });
    if (request.type === 'enable-service-supplies') return publicCommand(session, 'enableServiceSupplies', [], { reason: '生活物资采购已启用，洁水由青溪商人实际运来。' });
    if (request.type === 'enable-warehouse-services') return publicCommand(session, 'enableWarehouseServiceStorage', [request.stockpileId], { reason: '储运院已划出粮食、药材与水储库位。' });
    if (request.type === 'enable-residences') return publicCommand(session, 'enableEastResidences', [], { reason: '东台住宅道路已开通，可前往三处预设院址。' });
    if (request.type === 'claim-building-reward') {
      if (request.rewardId !== 'quarry') throw Error('当前没有这项营造奖励。');
      return publicCommand(session, 'claim', [request.rewardId], { reason: '已领取开山取石的营造奖励，可用于后续营建。' });
    }
    if (request.type === 'enable-courtyard-terrain') {
      const trial = transactionCopy(session);
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
    else if (['rest', 'cultivate'].includes(request.type)) { command = { name: 'masterAction', args: request.type === 'rest' && ('buildingId' in request || 'slotId' in request) ? ['rest', { buildingId: request.buildingId, slotId: request.slotId }] : [request.type] }; reason = request.type === 'rest' ? '掌门按玩家指令休整。' : '掌门按玩家指令修炼。'; replacesBody = true; }
    else if (request.type === 'heal') {
      if (openingActive && !openingView(session).canHeal) throw Error(openingView(session).healReason);
      command = { name: 'masterAction', args: ['heal'] }; reason = '掌门使用公库六份灵草，按正式疗伤规则休养。';
    }
    else if (request.type === 'survey-meditation') {
      command = { name: 'surveyMeditationSource', args: [] }; reason = '掌门沿山道前往脉眼，到位后实际勘察。';
    }
    else if (request.type === 'maintain-meditation') {
      command = { name: 'startMeditationMaintenance', args: [request.buildingId] }; reason = '现场材料已预留，掌门前往维护位检修引流设施。';
    }
    else if (request.type === 'cancel-meditation-order') {
      command = { name: 'cancelMeditationSourceOrder', args: [request.workOrderId] }; reason = '脉眼事务已中止，已发生的投入与自然变化保留。';
    }
    else if (request.type === 'cultivate-meditation') {
      command = { name: 'startMeditationCultivation', args: [{ buildingId: request.buildingId, slotId: request.slotId }] }; reason = '掌门前往所选蒲团，到位后按实际供给修行。';
    }
    else if (request.type === 'upgrade-meditation') {
      const building = session.state.buildingsById[request.buildingId];if (!meditationSupplyEnabled(building)) throw Error('当前聚灵台尚未接入脉眼。');
      command = { name: 'upgrade', args: [building.id] }; reason = '聚灵台扩建已安排，掌门实际运料施工。';
    }
    else if (request.type === 'craft-pill') {
      const gate = craftAvailabilitySR(session.state, request.recipeId);
      if (gate.buildingId !== request.buildingId) throw Error('请在实际丹房中选择丹方。');
      if (!gate.available) throw Error(gate.reasons.join('；'));
      command = { name: 'craft', args: [request.recipeId] }; reason = '掌门前往丹房照料炉火，成药留在炉边货位。';
    }
    else if (request.type === 'breakthrough') {
      const gate = breakthroughEntry(session.state); if (!gate.available) throw Error(gate.reason);
      command = { name: 'beginBreakthrough', args: [] }; reason = '掌门前往真实修炼席，调息后按既有阶段突破。';
    }
    else if (request.type === 'study') {
      if (!session.state.doctrine.books.includes(request.artId) || !SIM.TECHNIQUES[request.artId]) throw Error('尚不能实际接触该典籍。');
      command = { name: 'masterStudy', args: [request.artId, request.buildingId ? { buildingId: request.buildingId } : {}] }; reason = `掌门到真实阅卷席研习《${SIM.TECHNIQUES[request.artId].name}》。`;
    }
    else if (request.type === 'collate-family') {
      command = { name: 'collateFamilyNotes', args: [request.buildingId] }; reason = '掌门前往所选藏经阁，实际到席整理家传遗卷。';
    }
    else if (request.type === 'teach-library') {
      if (!session.state.homeMemberIds.includes(request.personId)) throw Error('只能与在籍门人商议阁内讲习。');
      command = { name: 'masterTeach', args: [request.artId, request.personId, { buildingId: request.buildingId }] }; reason = '商议阁内讲习；双方到席后才累计研读时间。';
    }
    else if (request.type === 'start-service') {
      command = { name: 'startSiteService', args: [{ buildingId: request.buildingId, recipeId: request.recipeId, patientId: request.patientId }] };
      reason = '现场材料已预留，等待本人到工位承担工序。';
    }
    else if (request.type === 'master-service') {
      command = { name: 'masterSiteService', args: [request.workOrderId] };
      reason = '掌门前往实际工位，抵达后开始工序。';
    }
    else if (request.type === 'invite-service-work') {
      if (!session.state.homeMemberIds.includes(request.personId)) throw Error('只能向在院门人商议这项差事。');
      command = { name: 'requestServiceWork', args: [{ workOrderId: request.workOrderId, personId: request.personId }] };
      actorId = request.personId; reason = '商议承担现场工序，由本人根据药理、身体和已有安排答复。';
    }
    else if (request.type === 'cancel-service') {
      command = { name: 'cancelSiteService', args: [request.workOrderId] };
      reason = '工单已中止，尚未投入的材料回到现场货位。';
    }
    else if (request.type === 'eat-service-meal') {
      command = { name: 'eatSiteMeal', args: [{ buildingId: request.buildingId, resourceKey: request.resourceKey }] };
      reason = '掌门前往膳房席位，抵达后实际用膳。';
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
    else if (request.type === 'cancel-production') {
      const building = session.state.buildingsById[request.buildingId];
      if (!building || !SIM.BUILDINGS[building.type]?.work) throw Error('该设施没有可中止的生产批次。');
      const order = session.state.workOrdersById[`work:production:${building.instanceId}`];
      if (!order || order.phase === 'completed') throw Error('当前没有未完成的生产批次。');
      command = { name: 'cancelProduction', args: [building.id] };
      reason = `中止${SIM.BUILDINGS[building.type].name}本批生产；未耗原料按进度退回现场货位，已投入部分不退。`;
    }
    else if (request.type === 'start-workshop-process') {
      const building = session.state.buildingsById[request.buildingId];
      if (!building || building.type !== 'workshop') throw Error('只有百工坊可安排专业工序。');
      const process = (SIM.WORKSHOP_PROCESSES || []).find(row => row.id === request.processId);
      if (!process) throw Error('百工坊工序不存在。');
      command = { name: 'startWorkshopProcess', args: [building.instanceId, process.id] };
      reason = `宗主指定百工坊本批做${process.name}；原料须已在坊内，本人到岗后开工。`;
    }
    else if (request.type === 'replenish') {
      if (!['wood', 'stone', 'herb', 'food'].includes(request.resource)) throw Error('请选择已知基础物资来源。');
      command = { name: 'replenishPatch', args: [request.resource] }; reason = '掌门按明确指令支付材料，实际前往恢复来源；此支出单列于正式账本。';
    }
    else if (request.type === 'cancel-activity') {
      const trial = transactionCopy(session), result = cancelMaster(trial);
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
    else if (request.type === 'admit-visitor') {
      const { personId, rank, affiliationId, mentorId } = request;
      command = { name: 'admitCourtyardVisitor', args: [{ personId, rank, affiliationId, mentorId }] };
      reason = '已当面确认门籍与归属，正式收录入院。'; actorId = personId;
    }
    else if (request.type === 'set-reception') {
      command = { name: 'setCourtyardReception', args: [{ enabled: request.enabled }] };
      reason = request.enabled ? '已安排山门接待，来客按行程沿南路入院。' : '已暂停接待新的求见，当前来访继续按原行程处理。';
    }
    else if (request.type === 'answer-seeker') {
      command = { name: 'answerCourtyardSeeker', args: [{ personId: request.personId, answer: request.answer }] };
      reason = request.answer === 'defer' ? '已当面请来客稍候，本次答复已记下。' : '已当面婉拒，来客将沿南路离院。'; actorId = request.personId;
    }
    else if (request.type === 'market-trade') {
      if (request.personId !== 'person:merchant-qingxi') throw Error('当前交易对象不可用。');
      command = { name: 'marketTrade', args: [request.resource, request.side, request.batches, { stockpileId: CARRIED }] };
      reason = `已与来访商当面${request.side === 'buy' ? '购入' : '出售'}${marketGoods(session.state)[request.resource]?.name || '物资'}，货物与灵石记入实际随身货位。`;
    }
    else if (request.type === 'build-site') {
      const site = SECT_DOMAIN.sites.find(item => item.id === request.siteId);
      command = { name: 'buildDomainSite', args: [request.siteId] };
      reason = `掌门按玩家选择营造${site?.name || '预设工程'}，材料须从公库实际运往工地。`;
    }
    else if (request.type === 'harvest') { command = { name: 'startMasterHarvest', args: [request.resource] }; reason = '掌门按玩家安排前往实际来源采集，所得先存入随身包裹。'; }
    else if (request.type === 'transport') { command = { name: 'startTransport', args: [request.sourceStockpileId, request.targetStockpileId, MASTER, request.cargo] }; reason = '掌门按玩家安排实际取料并送至指定仓储。'; }
    else throw Error('操作尚未接入。');
    // An invalid replacement must not abandon an existing transport or crop task.
    const trial = transactionCopy(session);
    let consequences = null;
    if (replacesBody) { const cancelled = cancelMaster(trial); if (!cancelled.ok) return cancelled; consequences = cancelled.consequences || null; }
    if (request.type === 'establish-hall' && trial.state.story.step === 0) {
      const healed = publicCommand(trial, 'advanceStory', [], { reason: '伤势已愈，带着家传在云岫立足。' });
      if (!healed.ok) return healed;
    }
    const result = publicCommand(trial, command.name, command.args, { reason, actorId });
    // A refusal is a committed NPC answer, not a failed transaction. Keep it so
    // repeated invitations and reloads cannot reroll the same conditions.
    if (result.ok || ['invite-work', 'invite-service-work', 'start-service', 'teach-library', 'admit-visitor'].includes(request.type) && result.refused) {
      trial.control = { mode: 'manual', idleMs: 0 };
      syncControl(trial);
      if (['move', 'rest', 'cultivate', 'study', 'breakthrough', 'craft-pill', 'collate-family', 'teach-library', 'heal', 'harvest', 'transport', 'replenish', 'build-site', 'establish-hall'].includes(request.type)) {
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
    if (result.ok && ['invite-work', 'invite-service-work'].includes(request.type)) result.message = result.result?.publicReason || result.result?.reason || '本人已接受这次差事。';
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
  assert(input.budget && finite(input.budget.spent, 0, 1000000) && Array.isArray(input.budget.orders) && input.budget.orders.every(o =>
    ((o.resource === 'food' && o.jade === 4 && o.food === 8 && o.herb === undefined) ||
      (o.resource === undefined && o.jade === 8 && o.herb === 4 && o.food === undefined)) &&
    typeof o.commandId === 'string' && typeof o.activityId === 'string' && Number.isSafeInteger(o.tick)), '整备支出记录');
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
function transactionCopy(session) {
  const trial = restoreSect(snapshotSect(session));
  inheritReachabilityProof(session.state, trial.state);
  inheritResidentialGeometryCache(session.state, trial.state);
  return trial;
}
function canVisitDomainPoint(s, target) {
  return routeReachable(s, s.master.scenic, target, MASTER);
}
function domainView(s, construction) {
  const enabled = domainExtentEnabled(s.spatial?.extentVersion), westEnabled = domainWestEnabled(s.spatial?.extentVersion), valleyEnabled = domainValleyEnabled(s.spatial?.extentVersion), residencesEnabled = domainResidencesEnabled(s.spatial?.eastResidences?.version), servicesEnabled = domainServicesEnabled(s.spatial?.eastServices?.version), northLibraryEnabled = domainNorthLibraryEnabled(s.spatial?.northLibrary?.version), northMeditationEnabled = domainNorthMeditationEnabled(s.spatial?.northMeditation?.version), westWorkshopsEnabled = domainWestWorkshopsEnabled(s.spatial?.westWorkshops?.version);
  const home = s.stockpilesById[HOME], activity = s.activitiesById[s.master.activityId];
  const projectSite = plan => {
    const runtime = SECT_DOMAIN.sites.find(site => site.id === plan.id), site = { ...plan, ...runtime };
    const existing = plan.runtimeStatus === 'existing';
    const building = existing ? s.buildings.find(item => item.type === plan.type) : s.buildings.find(item => item.domainSiteId === site.id || runtime && item.type === site.type && (item.transform?.x ?? item.x) === site.x && (item.transform?.y ?? item.y) === site.y);
    const order = Object.values(s.workOrdersById).find(item => item.kind === 'construction' && (item.domainSiteId === site.id || building && item.targetId === building.instanceId || runtime && item.buildingType === site.type && item.targetTransform?.x === site.x && item.targetTransform?.y === site.y));
    const definition = SIM.BUILDINGS[site.type], supported = !!runtime && !!definition && plan.runtimeStatus === 'open';
    const valleySite = ['GC-17', 'GC-18', 'GC-19', 'GC-24'].includes(site.planId);
    const unlocked = supported && (site.westWorkshops ? westWorkshopsEnabled : site.northMeditation ? northMeditationEnabled : site.northLibrary ? northLibraryEnabled : site.services ? servicesEnabled : site.residences ? residencesEnabled : valleySite ? valleyEnabled : site.zoneId === 'Z-03' ? westEnabled : enabled);
    const complete = !!building && !(building.type === 'hall' && s.story?.opening && s.story.opening.hallPhase !== 'complete');
    const cost = clone(supported ? definition.cost : {}), missingCost = {};
    if (!building && !order) for (const [resource, quantity] of Object.entries(cost)) {
      const missing = quantity - (home?.resources[resource] || 0); if (missing > 0) missingCost[resource] = missing;
    }
    const status = order ? 'building' : complete ? 'complete' : existing ? 'locked' : !supported ? 'planning' : unlocked ? 'available' : 'locked';
    const entrance = building ? spatialAccess(building) : runtime?.entrance || null;
    const rulesReason = supported ? SIM.buildingLock(s, site.type) || (site.northMeditation&&!building ? meditationBuildView(s).reason : '') : '';
    const localReason = s.master.location?.kind === 'travel' || s.master.location?.sceneId && s.master.location.sceneId !== SECT_DOMAIN.sceneId ? '先返回山院。' : '';
    const bodyReason = activity && activity.kind !== 'facility' ? '先完成或中止当前身体活动。' : s.master.wound > 0 || s.master.energy < 15 ? '先归院养伤并恢复精力。' : '';
    let routeReason = '';
    if (unlocked && !building && !order && !localReason && !bodyReason && !rulesReason && !Object.keys(missingCost).length) {
      routeReason = placementIssue(s, site.type, site.x, site.y, { checkConnectivity: false }) ||
        (!canVisitDomainPoint(s, entrance) ? '掌门无法实际抵达工地入口。' : '') ||
        (home?.position && !canVisitDomainPoint(s, home.position) ? '掌门无法实际抵达公库取料。' : '');
    }
    const reason = order ? construction?.workOrderId === order.id ? construction.reason : '材料与施工按同一工单推进。' :
      complete ? `${site.name}已落成，可查看实际工位。` : existing ? '先完成主殿营造。' :
      !supported ? '此处正在筹备，场地、工位与供给条件齐备后开放营造。' : !unlocked ? site.westWorkshops ? '先开通丹房与百工坊道路。' : site.northMeditation ? '先开通聚灵台山道。' : site.northLibrary ? '先开通藏经阁北台道路。' : site.services ? '先开通膳房与医庐道路。' : site.residences ? '先开通东台住宅道路。' : valleySite ? '先开通西谷道路。' : site.zoneId === 'Z-03' ? '先启用西林通路。' : '先启用东台通路。' :
      s.story?.opening?.hallPhase && s.story.opening.hallPhase !== 'complete' ? '先营造主殿，再安排其他院务。' :
      rulesReason || localReason || bodyReason || (Object.keys(missingCost).length ? '公库尚需备足营造材料。' : '') || routeReason || '材料与通路已备好，可由掌门发起营造。';
    const buildReason = status === 'available' ? rulesReason || localReason || bodyReason || (s.story?.opening?.hallPhase && s.story.opening.hallPhase !== 'complete' ? '先完成主殿营造。' : '') || (Object.keys(missingCost).length ? '公库尚需备足营造材料。' : '') || routeReason : reason;
    const prefab = building ? spatialPrefab(building) : supported ? spatialPrefab({ type: site.type, level: 1, domainSiteId: site.id, buildingGridVersion: s.spatial?.buildingGridVersion, ...(site.services ? { serviceVersion: SITE_SERVICE_VERSION } : {}) }) : null;
    const capacity = { beds: ['hall', 'house'].includes(site.type) ? prefab?.slots.filter(slot => slot.kind === 'rest').length || 0 : 0,
      careBeds: site.type === 'clinic' ? prefab?.slots.filter(slot => slot.kind === 'heal').length || 0 : 0,
      work: prefab?.slots.filter(slot => slot.kind === 'work').length || 0,
      study: prefab?.slots.filter(slot => slot.kind === 'study').length || 0,
      cultivate: prefab?.slots.filter(slot => slot.kind === 'cultivate').length || 0,
      storage: (definition?.storageCapacity || 0) * (building?.level || 1) };
    const capacityText = [[capacity.beds, '张常住床'], [capacity.careBeds, '张调养床'], [capacity.work, '处作业工位'], [capacity.study, '处阅卷席'], [capacity.cultivate, '处修行位'], [capacity.storage, '份仓储容量']]
      .filter(([count]) => count > 0).map(([count, label]) => `${count}${label}`).join('、');
    const navigationReason = !entrance ? '此处通路仍在筹备。' : !existing && !unlocked ? reason : localReason || (construction ? '先完成营造或中止后收回材料。' : '') ||
      (!canVisitDomainPoint(s, entrance) ? '当前路线无法抵达此处。' : '');
    const rewardDefinition = site.type === 'quarry' ? SIM.QUESTS.find(quest => quest.id === 'quarry') : null;
    const reward = rewardDefinition ? { id: rewardDefinition.id, name: rewardDefinition.title, resources: clone(rewardDefinition.reward),
      claimed: s.claimed.includes(rewardDefinition.id), ...availability(s.claimed.includes(rewardDefinition.id) ? '奖励已领取。' : rewardDefinition.check(s) ? '' : '采石场落成后可领取。') } : null;
    return { ...clone(site), status, supported, valleySite, entrance: clone(entrance), buildingId: building?.instanceId || order?.targetId || null, workOrderId: order?.id || null,
      progress: order ? order.progressTicks / order.durationTicks : complete ? 1 : 0, cost, missingCost, reason,
      buildAvailable: availability(buildReason), visitAvailable: availability(navigationReason), capacity, capacityText, reward,
      completedCapacity: complete ? capacity.beds : 0, materialFlow: order && construction?.workOrderId === order.id ? clone(construction.materialFlow) : null };
  };
  const plannedSites = SECT_DOMAIN.plannedSites.map(projectSite);
  return { ...clone(SECT_DOMAIN), enabled, westEnabled, valleyEnabled, residencesEnabled, servicesEnabled, northLibraryEnabled, northMeditationEnabled, westWorkshopsEnabled,
    openedAreas: clone(SECT_DOMAIN.initialOpenAreas.filter(area => area.westWorkshops ? westWorkshopsEnabled : area.northMeditation ? northMeditationEnabled : area.northLibrary ? northLibraryEnabled : area.services ? servicesEnabled : area.residences ? residencesEnabled : area.valley ? valleyEnabled : area.zoneId === 'Z-03' ? westEnabled : area.id === 'area:yunxiu:original-courtyard' || enabled)),
    sites: SECT_DOMAIN.sites.map(site => plannedSites.find(plan => plan.id === site.id)), plannedSites };
}
// Presentation of the existing opening rules. Commands always revalidate these
// conditions, the actual route, ownership and exclusive work positions.
const availability = reason => ({ available: !reason, reason: reason || '' });

const replenishCosts = { herb: { herb: 4, jade: 8 }, food: { food: 8, jade: 4 }, wood: { jade: 12, herb: 2 } };
const roundAmount = value => Math.round(value * 1e9) / 1e9;
const itemDefinition = id => ({ id, name: id.startsWith('pill:') ? SIM.RECIPES[id.slice(5)]?.name || '丹药' : SIM.RESOURCES[id] || SERVICE_RESOURCES[id] || id,
  kind: id.startsWith('pill:') ? 'pill' : id === 'insight' ? 'knowledge-budget' : id === 'jade' ? 'currency' : 'resource', transportable: id !== 'insight' });
const cargoText = cargo => Object.entries(cargo || {}).filter(([, quantity]) => quantity > 0)
  .map(([id, quantity]) => `${itemDefinition(id).name}${Number(quantity.toFixed(2))}份`).join('、');
const buildingName = building => SECT_DOMAIN.sites.find(site => site.id === building?.domainSiteId)?.name || (building?.type === 'hall' ? '主殿' : SIM.BUILDINGS[building?.type]?.name || '院中设施');
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
  const meditationOrder = meditationActivityOrder(s, a);
  if (!a || a.kind === 'facility' && !meditationOrder) return result;
  if (meditationOrder) {
    const survey = meditationOrder.kind === 'sr-spirit-survey';
    result.active = true; result.label = survey ? '脉眼勘察' : '引流检修'; result.orderId = meditationOrder.id;
    result.progressLost = meditationOrder.progressTicks; result.sourceStockpileId = meditationOrder.sourceStockpileId || null;
    result.consumed = clone(meditationOrder.usedInput || {});
    result.refunded = clone(s.reservationsById[meditationOrder.reservationId]?.remainingCost || {});
    result.requiresConfirmation = meditationOrder.progressTicks > 0;
    result.summary = survey ? '中止本次勘察，保留已有观测与天然脉眼状态。' :
      meditationOrder.progressTicks ? `中止检修；已投入${cargoText(result.consumed)}，引流余量保持当前值。` :
      `尚未开工；中止后${cargoText(result.refunded)}退回${stockLabel(s, meditationOrder.sourceStockpileId)}。`;
    result.resultMessage = survey ? '本次勘察已中止，已有观测与脉眼状态保留。' : '本次检修已中止，材料按实际投入结清。';
  } else if (a.kind === 'sr-craft') {
    const order = s.workOrdersById[a.workOrderId];
    if (!order || order.phase !== 'active') return result;
    result.active = true; result.label = SIM.RECIPES[order.recipeId]?.name || '本炉丹药'; result.orderId = order.id;
    result.progressLost = order.progressTicks; result.sourceStockpileIds = clone(order.sourceStockpileIds);
    const materials = craftRefundPreview(s, order);
    result.refunded = clone(materials.refundable); result.consumed = clone(materials.consumed);
    result.requiresConfirmation = order.progressTicks > 0;
    result.summary = order.progressTicks ? `中止本炉；已投入${cargoText(result.consumed)}，尚余${cargoText(result.refunded)}按来源退回。原货位满时留在当地退料暂存处。` : '尚未动工，中止后预留材料按来源退回。';
    result.resultMessage = '本炉已中止，剩余材料按来源退回，已投入部分保留消耗。';
  } else if (a.kind === 'sr-cultivation') {
    const order = s.srCultivation.orders[a.orderId];
    if (!managedCultivation(order)) return result;
    const name = libraryOrderName(order);
    const heldCost = { ...order.cost, ...(order.kind === 'breakthrough' && order.parameters.pillCost ? { 'pill:foundation': order.parameters.pillCost } : {}) };
    result.active = true; result.label = name;
    result.sourceStockpileId = order.sourceStockpileId; result.progressLost = order.progressTicks;
    if (order.consumed) {
      result.consumed = clone(heldCost);
      result.summary = `中止${name}会结束本次工序；${cargoText(heldCost)}已耗用，本次未完成的收益不结算。`;
      result.resultMessage = order.kind === 'breakthrough' ? `已中止突破；${cargoText(heldCost)}已耗用，原有境界与修为保留。` : `已中止${name}；${cargoText(heldCost)}已耗用，已有典籍、理解与熟练保留。`;
      result.requiresConfirmation = true;
    } else {
      result.refunded = clone(heldCost);
      result.summary = order.kind === 'breakthrough' ? `尚未进入炼化；中止后${cargoText(heldCost)}按预留记录退回各自原来源。` : `尚未开工；中止后${cargoText(heldCost)}退回${stockLabel(s, order.sourceStockpileId)}。`;
      result.resultMessage = order.kind === 'breakthrough' ? `突破已中止；${cargoText(heldCost)}已按预留记录退回原来源。` : `${name}已中止，${cargoText(heldCost)}已退回${stockLabel(s, order.sourceStockpileId)}。`;
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
function breakthroughEntry(s, view = breakthroughView(s)) {
  const master=s.master,body=s.activitiesById[master.activityId],home=s.stockpilesById[HOME].resources;
  const away=master.location?.kind==='travel'||master.location?.sceneId&&master.location.sceneId!==SECT_DOMAIN.sceneId||master.journey||s.world.exploration||s.combat?.status==='active';
  const reason=master.realm>9?'当前入口可安排炼气升层与筑基。':away?'先返回山院。':
    body&&(body.kind!=='facility'||meditationActivityOrder(s,body))?'先完成或中止当前身体活动。':
    view.locks[0]|| (Object.entries(view.cost).some(([k,n])=>(home[k]||0)<n)?'公库突破材料尚未备足。':'');
  return availability(reason);
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
  const meditationOrder = meditationActivityOrder(s, activity);
  const craftOrder = activity?.kind === 'sr-craft' ? s.workOrdersById[activity.workOrderId] : null;
  const cancelable = !!meditationOrder || craftOrder?.phase === 'active' || ['sr-harvest', 'sr-transport', 'sr-replenish'].includes(activity?.kind) || managedCultivation(cultivationOrder) || !!construction && !returningMaterials;
  const replacementReason = busy && (!cancelable || construction) ? busy : '';
  const consequences = actionConsequences(s), combatProfile = openingCombatProfile(s);
  const publicActivity = activity ? {
    id: activity.id, kind: activity.kind, phase: activity.phase,
    reason: meditationOrder?.reason || cultivationOrder?.reason || activity.reason || s.workOrdersById[activity.workOrderId]?.reason || '',
    progressTicks: meditationOrder?.progressTicks ?? cultivationOrder?.progressTicks ?? craftOrder?.progressTicks ?? activity.progressTicks ?? null,
    durationTicks: meditationOrder?.durationTicks ?? cultivationOrder?.durationTicks ?? craftOrder?.durationTicks ?? activity.durationTicks ?? null,
    targetId: activity.targetId || cultivationOrder?.workstationId || null,
    ...(craftOrder ? { process: clone(craftProcessView(s, craftOrder)) } : {}),
  } : null;
  const study = LIBRARY_KINDS.has(cultivationOrder?.kind) ? { id: cultivationOrder.id, artId: cultivationOrder.parameters.artId,
    kind: cultivationOrder.kind, name: libraryOrderName(cultivationOrder), consumed: cultivationOrder.consumed, cost: clone(cultivationOrder.cost),
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
  const libraries = s.buildings.filter(b => b.type === 'library').map(b => {
    const buildingReason = b.enabled === false ? '藏经阁已停用。' : b.condition <= 0 || b.spatialLock ? '藏经阁当前不可用。' : '';
    const family = familyNotesView(s, b.instanceId);
    const readable = arts.map(art => ({ ...art, ...availability(buildingReason || art.reason) }));
    const lessons = arts.map(art => {
      const qualification = teachingQualificationSR(s, MASTER, art.id);
      const baseReason = buildingReason || local || busy || qualification.reason || (home.food < 4 ? '公库口粮不足4份。' : '');
      const students = s.homeMemberIds.filter(id => id !== MASTER).map(id => {
        const person = s.personsById[id], current = person?.artsById?.[art.id]?.understanding || 0;
        const reason = baseReason || (!person || person.lifeStatus === 'dead' ? '本人无法参加。' : '') ||
          artStudyRequirement(person, art.id) || (current >= qualification.understanding ? '已理解掌门可授的章节。' : '') ||
          libraryStudentReadiness(s, id).reason;
        return { id, name: person?.name || '门人', understanding: current, ...availability(reason) };
      });
      return { artId: art.id, name: art.name, qualification, cost: { food: 4 }, durationTicks: 120, students, ...availability(baseReason) };
    });
    return { buildingId: b.instanceId, family, arts: readable, lessons, studySeats: facilitySlots(s, b, 'study').length,
      teachingSeats: facilitySlots(s, b, 'teach').length, orders: Object.values(s.srCultivation.orders).filter(o => o.parameters?.preferredBuildingId === b.instanceId).map(o => ({ ...clone(o), name: libraryOrderName(o) })) };
  });
  const farms = s.buildings.filter(b => ['farm', 'granary'].includes(b.type)).map(b => {
    const stockpileId = `stockpile:${b.instanceId}`, stock = s.stockpilesById[stockpileId];
    const order = s.workOrdersById[`work:production:${b.instanceId}`];
    const resource = b.type === 'granary' ? 'food' : 'herb', seedName = resource === 'food' ? '种粮' : '种苗', productOnSite = stock?.resources[resource] || 0, name = buildingName(b);
    const source = SIM.productionAvailability(s, b);
    const reason = b.enabled === false ? `${name}已暂停，可恢复使用。` : b.condition <= 0 || b.spatialLock ? `${name}当前不可用。` :
      order && !terminal(order.phase) ? order.waitingReason || '' : productOnSite < 2 ? `${name}缺少田边${seedName}2份，先实际搬入。` : source.reason;
    const harvestQuantity = roundAmount(Math.max(0, Math.min(40, productOnSite - 2)));
    return { id: b.instanceId, buildingId: b.instanceId, name, resource, seedName, productOnSite, enabled: b.enabled !== false,
      stockpileId, seedNeeded: Math.max(0, 2 - productOnSite), seedRequirement: 2,
      seedScope: `${order && !terminal(order.phase) ? '下一轮' : '本轮'}${seedName}`, crop: clone(order?.crop || null),
      herbOnSite: stock?.resources.herb || 0, availability: availability(reason),
      harvestTransport: { quantity: harvestQuantity, retained: 2, remaining: roundAmount(Math.max(0, productOnSite - 2 - harvestQuantity)),
        sourceStockpileId: stockpileId, targetStockpileId: HOME, ...availability(local || busy || (harvestQuantity > 0 ? '' : `田边需留下两份${seedName}，当前没有可搬收成。`)) },
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
  const workplaces = s.buildings.filter(b => ['lumber', 'quarry', 'workshop'].includes(b.type)).map(b => {
    const source = SIM.productionAvailability(s, b);
    const name = SIM.BUILDINGS[b.type].name;
    const reason = b.enabled === false ? `${name}已暂停，可恢复使用。` : b.condition <= 0 || b.spatialLock ? `${name}当前不可用。` : source.reason;
    const stockpileId = `stockpile:${b.instanceId}`, stock = s.stockpilesById[stockpileId];
    const order = s.workOrdersById[`work:production:${b.instanceId}`] || null;
    const recipe = typeof SIM.productionRecipeDefinition === 'function' && SIM.PRODUCTION_RECIPE_VERSION ? SIM.productionRecipeDefinition(SIM.PRODUCTION_RECIPE_VERSION, b.type) : null;
    const onsite = stock?.resources || {}, missingCost = {};
    for (const [id, quantity] of Object.entries(recipe?.inputCost || {})) { const missing = Math.max(0, quantity - (onsite[id] || 0)); if (missing > 0) missingCost[id] = missing; }
    const processes = b.type === 'workshop' && b.domainSiteId === 'site:domain:gc-25' && Array.isArray(SIM.WORKSHOP_PROCESSES) ? SIM.WORKSHOP_PROCESSES.map(process => {
      const processMissing = {};
      for (const [id, quantity] of Object.entries(process.recipe.inputCost)) { const missing = Math.max(0, quantity - (onsite[id] || 0)); if (missing > 0) processMissing[id] = missing; }
      const gate = SIM.productionAvailability(s, b, process.version);
      return { id: process.id, name: process.name, version: process.version, inputCost: clone(process.recipe.inputCost),
        outputDefinition: clone(process.recipe.outputDefinition), durationTicks: process.recipe.durationValue,
        missingCost: processMissing, availability: availability(gate.available && !Object.keys(processMissing).length ? '' : gate.available ? '工位原料未齐，先从公库搬入。' : gate.reason) };
    }) : [];
    const selectedProcess = processes.find(process => process.version === order?.recipeSnapshot?.recipeVersion) || null;
    return { buildingId: b.instanceId, name: SIM.BUILDINGS[b.type].name, enabled: b.enabled !== false, availability: availability(reason),
      stockpileId, resources: clone(onsite), order: clone(order), processes, selectedProcess: selectedProcess?.id || null,
      recipe: recipe ? { inputCost: clone(recipe.inputCost), outputDefinition: clone(recipe.outputDefinition), durationTicks: recipe.durationValue, skillKey: recipe.skill } : null,
      missingCost, cancelable: !!order && order.phase !== 'completed',
      workers: projection.systemPeople.persons.filter(p => s.activitiesById[p.currentActivity?.id]?.targetId === b.instanceId).map(p => ({ id: p.id, name: p.name, activity: clone(p.currentActivity) })),
      invites: s.homeMemberIds.map(id => {
        const p = s.personsById[id], opportunity = workOpportunity(s, p, b), answer = p.schedule?.invitations?.[`work:${b.instanceId}`];
        return { personId: id, name: p.name, ...availability(opportunity.reason), available: opportunity.available,
          lastResult: answer ? { accepted: answer.accepted, available: answer.available, atTick: answer.atTick, reason: answer.publicReason, retryAfterTick: answer.retryAfterTick } : null };
      }) };
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
    for (const order of Object.values(s.srCultivation.orders)) if (managedCultivation(order) && order.sourceStockpileId === st.id && !terminal(order.phase) && !order.consumed) {
      for (const [resource, quantity] of Object.entries(order.cost)) reserve(resource, quantity, order.id, libraryOrderName(order));
    }
    if (st.id === HOME) for (const action of Object.values(s.activitiesById)) if (action.kind === 'sr-replenish') {
      for (const [resource, quantity] of Object.entries(s.reservationsById[action.reservationId]?.cost || {})) reserve(resource, quantity * Math.max(0, 1 - action.progressTicks / action.durationTicks), action.id, '恢复采集来源');
    }
    for (const allocation of Object.values(s.srEconomy.pillAllocations || {})) if (allocation.phase === 'reserved') {
      for (const part of allocation.parts) if (part.stockpileId === st.id) reserve(`pill:${allocation.recipeId}`, part.quantity, allocation.id, '丹药使用预留');
    }
    for (const order of Object.values(s.workOrdersById)) {
      if (['sr-site-service', 'sr-site-meal', 'sr-meditation-maintenance'].includes(order.kind) && order.sourceStockpileId === st.id) for (const [resource, quantity] of Object.entries(s.reservationsById[order.reservationId]?.remainingCost || {})) reserve(resource, quantity, order.id, order.kind==='sr-meditation-maintenance'?'聚灵台检修投入':'现场服务投入');
      if (order.kind === 'sr-crafting' && order.phase === 'active') for (const [resource, quantity] of Object.entries(craftRefundPreview(s, order).refundable)) {
        if (order.sourceStockpileIds[resource] === st.id) reserve(resource, quantity, order.id, `炼制${SIM.RECIPES[order.recipeId].name}`);
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
      capacity: s.stockpilesById[st.id]?.capacity ?? null, storage: stockStorageView(s, st.id), buildingId: s.stockpilesById[st.id]?.buildingId || null,
      warehouse: s.buildingsById[s.stockpilesById[st.id]?.buildingId]?.type === 'warehouse', serviceFacility: siteServiceEnabled(s.buildingsById[s.stockpilesById[st.id]?.buildingId]), serviceStorage: s.buildingsById[s.stockpilesById[st.id]?.buildingId]?.type === 'warehouse' ? warehouseServiceStoragePreview(s, st.id) : null, available, reserved, inTransit, items, allocations, dropped,
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
  // Refundable cultivation costs remain reserved until their actual work stage consumes them.
  for (const order of Object.values(s.srCultivation.orders)) if (LIBRARY_KINDS.has(order.kind) && !terminal(order.phase) && !order.consumed) {
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
  const entry = breakthroughEntry(s, breakthrough);
  breakthrough.entryAvailable = entry.available; breakthrough.entryReason = entry.reason;
  breakthrough.entryVisible = master.realm <= 9;
  breakthrough.current = cultivationOrder?.kind === 'breakthrough' ? { id: cultivationOrder.id,
    phase: cultivationOrder.phase, progressTicks: cultivationOrder.progressTicks, durationTicks: cultivationOrder.durationTicks,
    consumed: cultivationOrder.consumed, refineStarted: cultivationOrder.refineStarted, phases: clone(breakthrough.phases),
    stageLabel: cultivationOrder.phase === 'blocked' ? '受阻' : master.wound > 0 || master.energy < 1 ? '等待身体恢复' : cultivationOrder.phase === 'reserved' ? (cultivationOrder.reason.includes('工位不足') ? '等候修炼席' : '前往修炼席') : cultivationOrder.progressTicks < breakthrough.phases.reserveTicks ? '调息准备' : cultivationOrder.progressTicks < breakthrough.phases.reserveTicks + breakthrough.phases.refineTicks ? '炼化' : '稳固境界',
    reason: cultivationOrder.reason, sourceStockpileId: cultivationOrder.sourceStockpileId, workstationId: cultivationOrder.workstationId || null, cost: clone(cultivationOrder.cost), pillCost: cultivationOrder.parameters.pillCost, cancel: consequences } : null;
  const meditation = { ...meditationSourceView(s), buildings: s.buildings.filter(meditationSupplyEnabled).map(b=>{
    const source=meditationSourceView(s,b.instanceId),cost={jade:45*b.level,wood:30*b.level,stone:20*b.level};
    const reason=b.level>=SIM.BUILDINGS.meditation.max?'聚灵台已达当前最高等级。':local||busy||source.upgrade?.reason||(master.wound>0||master.energy<15?'先养伤并恢复精力。':'')||(Object.entries(cost).some(([k,n])=>(home[k]||0)<n)?'公库尚需备足扩建材料。':'');
    return {...source,stockpileId:`stockpile:${b.instanceId}`,level:b.level,upgrade:{...availability(reason),cost},seats:facilitySlots(s,b,'cultivate').map(slot=>({label:slot.label,...meditationCultivationView(s,MASTER,b.instanceId,slot.id)})),invites:s.homeMemberIds.filter(id=>id!==MASTER).map(id=>{const p=s.personsById[id],v=workOpportunity(s,p,b);return {personId:id,name:p.name,...availability(v.reason),available:v.available};})};
  }) };
  return {
    master: { id: MASTER, name: master.name, realmLabel: SIM.realmName(master.realm), xp: master.xp, xpNeed: SIM.xpNeed(master.realm),
      energy: master.energy, wound: master.wound, activity: publicActivity, mainArtId: master.main, mainArtName: SIM.TECHNIQUES[master.main]?.name || '尚未主修', breakthrough,
      actions: { rest: { ...availability(local || replacementReason), consequence: consequences }, cultivate: { ...availability(local || replacementReason || (master.wound > 0 ? '先养好伤势。' : '') || (!master.main ? '先取得并修习主修心法。' : '') || (master.xp >= SIM.xpNeed(master.realm) ? '本层积累已满，继续修炼不会增加修为。' : '')), consequence: consequences },
        heal: availability(local || busy || (master.wound <= 0 ? '伤势已愈，无需耗药。' : '') || (home.herb < 6 ? '公库灵草不足6份，可采集后实际入库。' : '')),
        cancel: { ...availability(returningMaterials ? '掌门正在回收未用材料，返库后结束营造事务。' : cancelable ? '' : '当前没有可在此中止的事务。'), consequence: consequences } } },
    alchemy: clone(projection.crafting),
    services: s.buildings.filter(siteServiceEnabled).map(b => viewSiteServices(s, b.instanceId)), serviceSupplies: serviceSupplyView(s), actionConsequences: consequences, arts, study, libraries, meditation, farms, workplaces, inventory: { stockpiles: stocks, summary: inventorySummary },
    harvest, canTransport: availability(local || busy),
  };
}
export function quoteSectTrade(session, request = {}) {
  const s = session.state, resource = request.resource || 'stone', side = request.side || 'sell', batches = request.batches ?? 1;
  const quote = localMarketQuote(s, { resource, side, batches, stockpileId: CARRIED });
  return { ...quote, contact: merchantPresent(s), goods: localMarketGoods(s).map(id => ({ id, label: marketGoods(s)[id].name })),
    carriedAmount: s.stockpilesById[CARRIED]?.resources[resource] || 0, carriedJade: s.stockpilesById[CARRIED]?.resources.jade || 0 };
}
function housingProjection(s, preparedState) {
  if (!preparedState) return null;
  const housing = residentialHousingView(preparedState);
  const label = binding => {
    if (!binding) return null;
    const building = s.buildingsById[binding.buildingId];
    return `${buildingName(building)} · 第${binding.slotId.split(':').at(-1)}床`;
  };
  return { ...housing, residents: housing.residents.map(resident => ({ ...resident,
    homeLabel: label(resident.home), pendingLabel: label(resident.pending),
    statusLabel: resident.release ? resident.release.reason === 'dead' ? '住处已释放' : '已离院' : resident.reason ? resident.reason : resident.home ? resident.pending ? '迁入途中' : '已入住' : resident.pending ? '待入住' : '待安置',
  })), beds: housing.beds.map(bed => ({ ...bed, label: label(bed), masterRest: residentialRestView(preparedState, MASTER, bed.slotId),
    homePersonName: s.personsById[bed.homePersonId]?.name || '', pendingPersonName: s.personsById[bed.pendingPersonId]?.name || '', occupantPersonName: s.personsById[bed.occupantPersonId]?.name || '',
  })) };
}
export function viewSect(session) {
  const s = session.state, view = projectGodotWorld(s), members = new Set([MASTER, ...s.homeMemberIds]);
  const knownStocks = [HOME, CARRIED, ...Object.keys(s.stockpilesById).filter(id => id.startsWith('stockpile:building:') || id.startsWith('stockpile:construction:') || id.startsWith('stockpile:dropped:'))];
  const construction = constructionView(s, view.construction);
  const bounds = spatialBounds(s), housingState = residentialHousingApplicable(s) ? residentialProjectionState(s) : null, housing = housingProjection(s, housingState);
  return {
    tick: s.worldTick, time: s.time, timeLabel: view.timeLabel, paused: s.speed === 0,
    width: bounds.width, height: bounds.height, sceneId: view.sceneId, terrain: clone(view.terrain),
    bounds: { x: bounds.x || 0, y: bounds.y || 0, width: bounds.width, height: bounds.height }, domain: domainView(s, construction), construction,
    policy: clone(session.policy), foodSupply: foodSupply(session), control: clone(session.control), reason: session.reason, housing, reception: SIM.courtyardReceptionView(s),
    resources: clone(s.stockpilesById[HOME].resources), baseline: clone(session.baseline),
    people: view.people.map(p => { const official = s.personsById[p.id], body = p.id === MASTER ? official : official.mind, activity = s.activitiesById[official.activityId]; return { ...clone(p), resident: members.has(p.id), admission: SIM.courtyardAdmissionView(s, p.id, { preparedHousingState: housingState }), path: clone(body.scenic?.path || []), energy: official.energy, wound: official.wound, xp: official.xp, realm: official.realm, activityId: official.activityId, activityDetail: activity ? { id: activity.id, kind: activity.kind, phase: activity.phase, reason: activity.reason || s.workOrdersById[activity.workOrderId]?.reason || body.reason || '', target: clone(activity.target || null), progressTicks: activity.progressTicks ?? null, durationTicks: activity.durationTicks ?? null } : null, reason: p.id === MASTER ? session.reason : body.reason || official.schedule?.lastReason || '' }; }),
    buildings: view.buildings.map(b => {
      const official = s.buildingsById[`building:yunxiu:${b.id}`];
      return { ...clone(b), name: official?.domainSiteId ? buildingName(official) : b.name, enabled: official?.enabled !== false, entrance: official ? clone(spatialAccess(official)) : null };
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
