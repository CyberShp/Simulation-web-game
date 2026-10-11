/** Godot Web presentation bridge: SR-XF-002/003/007/030, U-101 and runtime §4–11. */
import {initial, tick, dispatchCommand, validateSave, COMMAND_NAMES, appearanceView} from './ea-opening-sim.mjs';
import {BUILDINGS, day, stage} from './ea-data.mjs';
import {facilitySlots} from './ea-facility-slots.mjs';
import {scenicHomeActors, nextObjective} from './ea-scene-state.mjs';
import {SPATIAL_SCENE, spatialTerrain, spatialRoom, spatialPrefab, spatialTransform, polygonContains, viewSpatial, sceneUnits} from './ea-sr-spatial.mjs';
import {artView, teachingQualificationSR} from './ea-sr-cultivation.mjs';
import {openingInheritanceView} from './ea-opening-inheritance.mjs';
import {FARM_CROP_RECIPE} from './ea-sr-economy.mjs';

const publicCommands = new Set(COMMAND_NAMES);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const atHome = person => !person.location || person.location.kind === 'local' && person.location.sceneId === SPATIAL_SCENE.id;

function readonly(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) readonly(child);
    Object.freeze(value);
  }
  return value;
}

function projectOpeningStory(state) {
  const opening = state.story?.opening;
  const visitor = opening && state.personsById?.[opening.visitorId];
  const position = visitor?.mind?.scenic || visitor?.scenic;
  const master = state.master?.scenic;
  const canTalk = !!(visitor && position && master && atHome(state.master) && atHome(visitor) &&
    !state.world?.exploration && !state.master.journey && state.combat?.status !== 'active' &&
    Math.hypot(master.x - position.x, master.y - position.y) <= sceneUnits(state, 48));
  return {
    step: state.story?.step ?? 0,
    gifted: !!opening?.gifted,
    invitation: opening?.invitation ?? 'unasked',
    visitor: visitor ? {id: visitor.personId, name: visitor.name,
      x: position?.x ?? null, y: position?.y ?? null, canTalk} : null,
  };
}

function farmCropVisual(state, building) {
  if (building.type !== 'farm') return null;
  const order = state.workOrdersById?.[`work:production:${building.instanceId}`];
  const crop = order?.crop;
  if (!crop || ['completed', 'cancelled'].includes(order.phase) || crop.harvestedAtTick != null) return 'empty';
  return crop.maturedAtTick != null || ['mature', 'ripe/waiting'].includes(crop.phase) ? 'ripe' : 'growing';
}

function projectHerbTerrace(state, construction, sites) {
  const site = sites?.find(item => item.id === 'site:herb-terrace');
  const candidates = [...state.buildings];
  if (construction?.operation === 'build' && construction.building?.type === 'farm') candidates.push(construction.building);
  const farm = candidates.find(building => building.type === 'farm' && (!site ||
    (spatialTransform(building).x === site.x && spatialTransform(building).y === site.y)));
  const instanceId = farm?.instanceId || null;
  const stockpile = instanceId && state.stockpilesById?.[`stockpile:${instanceId}`];
  const order = instanceId && state.workOrdersById?.[`work:production:${instanceId}`];
  const crop = order?.crop;
  const harvest = instanceId ? Object.values(state.factsById || {})
    .filter(fact => fact.kind === 'crop-harvest' && fact.buildingId === instanceId)
    .sort((a, b) => b.atTick - a.atTick || b.batch - a.batch)[0] : null;
  const transports = stockpile ? Object.values(state.workOrdersById || {})
    .filter(work => work.kind === 'transport' && work.targetStockpileId === stockpile.id && (work.cargo?.herb || 0) > 0)
    .sort((a, b) => a.startedTick - b.startedTick) : [];
  const activeTransports = transports.filter(work => !['delivered', 'cancelled'].includes(work.phase));
  const latestFinished = transports.filter(work => ['delivered', 'cancelled'].includes(work.phase)).slice(-1);
  return {
    buildingId: farm ? String(farm.id) : null,
    instanceId,
    stockpileId: stockpile?.id || null,
    herbOnSite: stockpile ? (stockpile.resources?.herb ?? 0) : null,
    seedNeeded: FARM_CROP_RECIPE.seedCost.herb,
    seedTransports: [...activeTransports, ...latestFinished].map(work => ({
      id: work.id, phase: work.phase, herb: work.cargo.herb, reason: work.reason || '',
    })),
    crop: crop ? {
      batch: order.batch, phase: crop.phase, growthTicks: crop.growthElapsedTicks,
      maturityTicks: crop.maturityRequiredTicks, careContribution: crop.careContribution,
      careRequired: order.durationTicks, sownAtTick: crop.sownAtTick,
      harvestedAtTick: crop.harvestedAtTick, sowFactId: crop.sowFactId || null,
    } : null,
    lastHarvest: harvest ? {factId: harvest.id, quantity: harvest.quantity, atTick: harvest.atTick} : null,
  };
}

function projectBuilding(state, building, visualStage) {
  const prefab = spatialPrefab(building), position = spatialTransform(building);
  const operation = building.spatialLock && state.workOrdersById[building.spatialLock]?.operation;
  const hallPhase = state.story?.opening?.hallPhase || 'complete';
  const established = state.buildings.includes(building);
  return {
    id: String(building.id), type: building.type,
    name: building.type === 'hall' ? hallPhase === 'shelter' ? '临时落脚处' : '山院主殿' : BUILDINGS[building.type].name,
    x: position.x, y: position.y, width: prefab.width, height: prefab.height,
    indoor: prefab.indoor, level: building.level, condition: building.condition,
    capacity: established ? (BUILDINGS[building.type].capacity || 0) * building.level : 0,
    workSlots: established ? facilitySlots(state, building, 'work').length : 0,
    ...(building.type === 'farm' ? {cropVisual: farmCropVisual(state, building)} : {}),
    stage: visualStage || (building.type === 'hall' && hallPhase === 'shelter' ? 'shelter' : operation === 'upgrade' ? 'upgrade' :
      building.type === 'hall' && state.spatial?.estateCollisionVersion === 'estate-gate-1' && building.condition < 100 ? 'damaged' :
      building.condition < 50 ? 'damaged' : 'complete'),
  };
}

/** Copy public courtyard facts. Foot positions and room floors decide indoor visibility. */
export function projectGodotWorld(state, selection = null, sites = null) {
  const rooms = state.buildings.map(spatialRoom).filter(Boolean);
  const homePeople = scenicHomeActors(state).filter(atHome);
  if (atHome(state.master) && !state.master.journey && !state.world?.exploration && !state.combat) homePeople.unshift(state.master);
  const people = [...new Map(homePeople.map(person => [person.personId, person])).values()].map(person => {
    const position = person === state.master ? person.scenic : person.mind.scenic;
    const appearance = appearanceView(state, person.personId);
    return {
      id: person.personId, name: person.name, x: position.x, y: position.y,
      appearance: appearance.spriteIndex, activity: appearance.action,
      indoor: rooms.some(room => polygonContains(position, room.floor)), moving: !!position.path?.length,
    };
  });
  const construction = viewSpatial(state);
  const buildings = state.buildings.map(building => projectBuilding(state, building,
    building.type === 'hall' && construction?.operation === 'establish' && String(construction.building.id) === String(building.id)
      ? construction.stage : null));
  if (construction && construction.operation === 'build' && !buildings.some(building => building.id === String(construction.building.id))) {
    buildings.push(projectBuilding(state, construction.building, construction.stage));
  }
  const objective = nextObjective(state);
  const memberIds = new Set(state.homeMemberIds || []);
  const roster = [state.master.personId, ...memberIds].map(id => state.personsById[id]).filter(Boolean).map(person => {
    const appearance = appearanceView(state, person.personId);
    const mind = person.mind || person;
    return {
      id: person.personId, name: person.name, role: person === state.master ? 'master' : 'disciple',
      appearance: appearance.spriteIndex,
      realm: person.realm, root: person.root, energy: person.energy, wound: person.wound,
      action: appearance.action, atHome: atHome(person) && !person.journey && !mind.away,
      ...(person === state.master ? {controlMode: state.masterControl?.mode || 'manual'} : {}),
      mainArtId: mind.main || null,
      arts: Object.entries(person.artsById || {}).filter(([, value]) => value?.understanding > 0 || value?.mastery > 0)
        .map(([id, value]) => ({id, understanding: value.understanding || 0, mastery: value.mastery || 0})),
    };
  });
  const arts = artView(state).map(art => ({
    ...art, teaching: teachingQualificationSR(state, state.master.personId, art.id),
  }));
  const cultivationOrders = Object.values(state.srCultivation?.orders || {})
    .filter(order => ['study', 'teach', 'retrain'].includes(order.kind) && !['completed', 'cancelled'].includes(order.phase))
    .map(order => ({
      id: order.id, kind: order.kind, phase: order.phase, reason: order.reason,
      progressTicks: order.progressTicks, durationTicks: order.durationTicks,
      artId: order.parameters.artId || order.parameters.to || null,
      studentId: order.parameters.studentId || null,
    }));
  const snapshot = {
    version: 1, tick: state.worldTick, revision: state.revision, nextCommandId: state.transactions.nextCommandId, paused: state.speed === 0,
    width: SPATIAL_SCENE.width, height: SPATIAL_SCENE.height, sceneId: SPATIAL_SCENE.id,
    masterId: state.master.personId, timeLabel: `第 ${day(state) + 1} 日`,
    message: !state.story.intro
      ? `${state.master.name}携家传逃至云岫山院，先在落脚处养伤。${objective.text}`
      : objective.text,
    resources: {...state.resources}, people, buildings, roster, arts, cultivationOrders,
    openingInheritance: openingInheritanceView(state),
    openingStory: projectOpeningStory(state),
    openingHallPhase: state.story?.opening?.hallPhase || 'complete',
    herbTerrace: projectHerbTerrace(state, construction, sites),
    estateStage: stage(state),
    construction: construction ? {buildingId:String(construction.building.id),operation:construction.operation,
      progress:construction.progress,stage:construction.stage,label:construction.label} : null,
    terrain: spatialTerrain(state).map(({id, kind, polygon}) => ({id, kind, polygon: polygon.map(point => [...point])})),
    masterPath: atHome(state.master) ? (state.master.scenic.path || []).map(({x, y}) => ({x, y})) : [],
  };
  if (selection) {
    const collection = selection.kind === 'person' ? people : buildings;
    if (collection.some(entity => entity.id === selection.id)) snapshot.selection = {...selection};
  }
  return readonly(snapshot);
}

/**
 * The host calls advance with foreground elapsed seconds from one clock.
 * tick owns speed and 100 ms carry; the host must drop elapsed background time.
 * Save text uses the existing schema. This adapter does not access browser storage.
 */
export function createGodotBridge({state: source, sites = null} = {}) {
  let state = validateSave(source ?? initial({sr: true}), {upgrade: true});
  let selection = null;
  let projected = null, projectedRevision = -1, projectedSelection = '';
  const fixedSites = Array.isArray(sites) ? sites.filter(site =>
    site && typeof site.type === 'string' && Number.isFinite(site.x) && Number.isFinite(site.y)
  ) : null;
  if (fixedSites) state.spatial.estateCollisionVersion = 'estate-gate-1';
  const snapshot = () => {
    const key = selection ? `${selection.kind}:${selection.id}` : '';
    if (projected && projectedRevision === state.revision && projectedSelection === key) return projected;
    projected = projectGodotWorld(state, selection, fixedSites);
    projectedRevision = state.revision;
    projectedSelection = key;
    return projected;
  };
  const failure = error => ({ok: false, error: error instanceof Error ? error.message : String(error), tick: state.worldTick, revision: state.revision});

  function command(input) {
    try {
      const request = typeof input === 'string' ? JSON.parse(input) : input;
      if (!isRecord(request)) throw Error('操作格式无效。');
      if (request.actorId !== undefined && request.actorId !== state.master.personId) throw Error('只能直接控制掌门。');
      const type = request.type ?? request.name;
      if (type === 'select') {
        if (request.id == null) selection = null;
        else {
          if (!['person', 'building'].includes(request.kind) || typeof request.id !== 'string') throw Error('选择对象无效。');
          const view = snapshot(), collection = request.kind === 'person' ? view.people : view.buildings;
          if (!collection.some(entity => entity.id === request.id)) throw Error('对象已不在山院。');
          selection = {kind: request.kind, id: request.id};
        }
        return {ok: true, result: selection && {...selection}, tick: state.worldTick, revision: state.revision};
      }
      let name, args;
      if (type === 'move') {
        if (!Number.isFinite(request.x) || !Number.isFinite(request.y) || request.x < 0 || request.y < 0 || request.x > SPATIAL_SCENE.width || request.y > SPATIAL_SCENE.height) throw Error('请在山院范围内选择位置。');
        name = 'moveScenicMaster'; args = [request.x, request.y];
      } else if (type === 'pause') {
        if (typeof request.paused !== 'boolean') throw Error('暂停状态须为布尔值。');
        name = 'setSpeed'; args = [request.paused ? 0 : 1];
      } else {
        name = request.name; args = request.args ?? [];
        if (!publicCommands.has(name) || !Array.isArray(args)) throw Error('操作尚未接入。');
        if (fixedSites && ['repairBuilding','build','upgrade','relocate','demolish'].includes(name) && state.master.wound > 0)
          throw Error('掌门尚有伤势，先调息疗伤。');
        if (fixedSites && name === 'build' && !fixedSites.some(site =>
          site.type === args[0] && site.x === args[1] && site.y === args[2]
        )) throw Error('请在山院已选定的营造地动工。');
        if (fixedSites && name === 'relocate') {
          const building = state.buildings.find(item => item.id === args[0]);
          if (!building || !fixedSites.some(site =>
            site.type === building.type && site.x === args[1] && site.y === args[2]
          )) throw Error('这座营造只能迁至已规划的地块。');
        }
      }
      const dispatched = dispatchCommand(state, {name, args, ...(request.id !== undefined ? {id: request.id} : {}), ...(request.expectedRevision !== undefined ? {expectedRevision: request.expectedRevision} : {})});
      if (type === 'move' && dispatched.result === false) return failure(Error('此处暂时无法抵达。'));
      state = dispatched.state;
      return {ok: true, result: structuredClone(dispatched.result), replayed: !!dispatched.replayed, tick: state.worldTick, revision: state.revision};
    } catch (error) {
      return failure(error);
    }
  }

  return Object.freeze({
    snapshot,
    advance(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) throw Error('推进时间须为 0 至 86400 秒。');
      tick(state, seconds);
      return snapshot();
    },
    command,
    save() { return JSON.stringify(validateSave(state)); },
    load(text) {
      try {
        if (typeof text !== 'string') throw Error('存档须为 JSON 文本。');
        const next = validateSave(JSON.parse(text), {upgrade: true});
        state = next;
        projected = null;
        if (fixedSites) state.spatial.estateCollisionVersion = 'estate-gate-1';
        selection = null;
        return {ok: true, tick: state.worldTick, revision: state.revision};
      } catch (error) {
        return failure(error);
      }
    },
  });
}
