/** Godot Web presentation bridge: SR-XF-002/003/007/030, U-101 and runtime §4–11. */
import {initial, tick, dispatchCommand, validateSave, COMMAND_NAMES, appearanceView} from './ea-opening-sim.mjs';
import {BUILDINGS, day, stage} from './ea-data.mjs';
import {scenicHomeActors, nextObjective} from './ea-scene-state.mjs';
import {SPATIAL_SCENE, spatialTerrain, spatialRoom, spatialPrefab, spatialTransform, polygonContains, viewSpatial} from './ea-sr-spatial.mjs';
import {artView, teachingQualificationSR} from './ea-sr-cultivation.mjs';

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

function projectBuilding(state, building, visualStage) {
  const prefab = spatialPrefab(building), position = spatialTransform(building);
  const operation = building.spatialLock && state.workOrdersById[building.spatialLock]?.operation;
  return {
    id: String(building.id), type: building.type,
    name: building.type === 'hall' && stage(state) >= 3 ? '宗门正殿' : BUILDINGS[building.type].name,
    x: position.x, y: position.y, width: prefab.width, height: prefab.height,
    indoor: prefab.indoor, level: building.level, condition: building.condition,
    stage: visualStage || (operation === 'upgrade' ? 'upgrade' :
      building.type === 'hall' && state.spatial?.estateCollisionVersion === 'estate-gate-1' && building.condition < 100 ? 'damaged' :
      building.condition < 50 ? 'damaged' : 'complete'),
  };
}

/** Copy public courtyard facts. Foot positions and room floors decide indoor visibility. */
export function projectGodotWorld(state, selection = null) {
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
  const buildings = state.buildings.map(building => projectBuilding(state, building));
  const construction = viewSpatial(state);
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
      ? `${state.master.name}携家传逃至云岫旧居，先安顿伤势，再恢复山院。${objective.text}`
      : objective.text,
    resources: {...state.resources}, people, buildings, roster, arts, cultivationOrders,
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
  const fixedSites = Array.isArray(sites) ? sites.filter(site =>
    site && typeof site.type === 'string' && Number.isFinite(site.x) && Number.isFinite(site.y)
  ) : null;
  if (fixedSites) state.spatial.estateCollisionVersion = 'estate-gate-1';
  const snapshot = () => projectGodotWorld(state, selection);
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
        )) throw Error('请在别院已规划的营造地选择项目。');
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
        if (fixedSites) state.spatial.estateCollisionVersion = 'estate-gate-1';
        selection = null;
        return {ok: true, tick: state.worldTick, revision: state.revision};
      } catch (error) {
        return failure(error);
      }
    },
  });
}
