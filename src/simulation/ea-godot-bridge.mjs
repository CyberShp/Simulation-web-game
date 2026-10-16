import {courtyardVisitorReady} from './ea-courtyard-visitors.mjs';
/** Godot Web presentation bridge: SR-XF-002/003/007/030, U-101 and runtime §4–11. */
import {initial, tick, dispatchCommand, validateSave, COMMAND_NAMES, appearanceView, getCampaignScene, viewSRCombat} from './ea-opening-sim.mjs';
import {BUILDINGS, RECIPES, RESOURCES, day, stage, realmName, xpNeed} from './ea-data.mjs';
import {facilitySlots} from './ea-facility-slots.mjs';
import {scenicHomeActors, nextObjective} from './ea-scene-state.mjs';
import {SPATIAL_SCENE, spatialTerrain, spatialRoom, spatialPrefab, spatialTransform, polygonContains, viewSpatial, sceneUnits} from './ea-sr-spatial.mjs';
import {artView, teachingQualificationSR} from './ea-sr-cultivation.mjs';
import {openingInheritanceView} from './ea-opening-inheritance.mjs';
import {FARM_CROP_RECIPE, HARVEST_BATCH, harvestAvailable, viewEconomy} from './ea-sr-economy.mjs';
import {viewPersons} from './ea-sr-persons.mjs';
import {personLifeSummary, workOpportunity} from './ea-life.mjs';
import {viewPublicDiscipleLearning} from './ea-society.mjs';
import {EQUIPMENT_SLOTS, viewEquipment, equipmentCombatBenefits} from './ea-sr-equipment.mjs';
import {godotMoveCommand, projectGodotScene} from './ea-godot-world.mjs';

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
  const canTalk = !!(visitor && courtyardVisitorReady(visitor) && position && master && atHome(state.master) && atHome(visitor) &&
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

function projectOpeningJourney(state) {
  const masterId = state.master.personId;
  const facts = Object.entries(state.factsById || {}).filter(([id, fact]) =>
    isRecord(fact) && fact.id === id && fact.actorId === masterId && fact.public !== false &&
    Number.isSafeInteger(fact.atTick) && fact.atTick >= 0 && fact.atTick <= state.worldTick
  ).map(([, fact]) => fact);
  const healingProduction = fact => fact.kind === 'inventory-transaction' &&
    fact.operation === 'pill-production' && fact.recipeId === 'heal' && Number.isSafeInteger(fact.quantity) && fact.quantity > 0;
  const battle = facts.filter(fact => {
    const session = state.combatSessionsById?.[fact.sessionId];
    return fact.kind === 'combat-result' && fact.encounterId === 'valley-shanxiao' &&
      fact.personId === 'person:valley-shanxiao' && fact.sceneId === 'scene:valley' &&
      fact.id === `fact:${fact.sessionId}:result` && ['won', 'retreated', 'lost'].includes(fact.result) &&
      session?.personId === masterId && session.phase === 'ended' &&
      session.result === fact.result && session.endedTick === fact.atTick &&
      !(state.combat?.sessionId === fact.sessionId && state.combat.status === 'active');
  }).sort((a, b) => b.atTick - a.atTick || b.id.localeCompare(a.id))[0];
  return {
    healingCrafted: facts.some(healingProduction),
    valleyGathered: facts.some(fact => {
      if (fact.kind !== 'interaction' || fact.sceneId !== 'scene:valley') return false;
      const match = /^fact:interaction:object:valley:herbs:gather:(\d+)$/.exec(fact.id);
      return !!match && Number.isSafeInteger(Number(match[1])) && Number(match[1]) <= fact.atTick;
    }),
    firstBattle: battle ? {result: battle.result, atTick: battle.atTick} : null,
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

function projectSystemPeople(state, equipment) {
  const publicPersons = new Map(viewPersons(state).map(person => [person.personId, person]));
  const societyPersons = new Map((state.society ? state.disciples : [])
    .map(person => [person.id, viewPublicDiscipleLearning(state, person)]));
  const peaks = new Map((state.society?.peaks || []).map(peak => [peak.id, peak]));
  const equipmentItems = [...equipment.items, ...equipment.visibleNpcItems];
  const workplaces = state.buildings.filter(building => BUILDINGS[building.type]?.work).map(building => {
    const available = building.enabled !== false && building.condition > 0 && !building.spatialLock &&
      facilitySlots(state, building, 'work').length > 0;
    return {id: String(building.id), instanceId: building.instanceId, name: BUILDINGS[building.type].name,
      type: building.type, available,
      reason: available ? '' : building.spatialLock ? '设施正在施工或迁建。' :
        building.enabled === false ? '设施已停用。' : building.condition <= 0 ? '设施需要修缮。' : '暂无可用工位。'};
  });
  const memberIds = new Set(state.homeMemberIds || []);
  const persons = [state.master.personId, ...memberIds].map(id => state.personsById[id]).filter(Boolean).map(person => {
    const id = person.personId, mind = person.mind || person, publicPerson = publicPersons.get(id);
    const publicSociety = societyPersons.get(person.id);
    const life = personLifeSummary(state, person);
    const privateActivity = life.reason === '独处参悟，暂不愿详谈。';
    const activity = state.activitiesById?.[person.activityId];
    const activityOrder = state.srEquipment?.orders?.[activity?.orderId] ||
      state.srCultivation?.orders?.[activity?.orderId] || state.workOrdersById?.[activity?.workOrderId];
    const schedule = publicPerson?.schedule;
    const peak = peaks.get(mind.peakId);
    const equipmentSlots = Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, null]));
    for (const item of equipmentItems) {
      if (item.location?.kind === 'person' && item.location.id === id &&
          EQUIPMENT_SLOTS.includes(item.location.slot)) equipmentSlots[item.location.slot] = item.id;
    }
    const mentorId = mind.mentorId;
    const mentor = mentorId === 'master' ? state.master : state.disciples?.find(item => item.id === mentorId);
    const relations = mentor && mentor.personId !== id ? [{personId: mentor.personId, name: mentor.name,
      label: '师承', description: `${person.name}的师父`}] : [];
    const workChoices = id === state.master.personId ? [] : workplaces.map(place => {
      const building = state.buildingsById[place.instanceId];
      // Full path and commitment checks belong to the invitation command. A
      // dense roster must not run a path search for every person and workplace
      // on every visual snapshot.
      const choice = workOpportunity(state, person, building || place.id, {checkPath:false});
      return {id: place.id, instanceId: place.instanceId, name: place.name,
        available: choice.available,
        reason: choice.available ? '可发出邀约；本人将在实际条件下答复。' : choice.reason};
    });
    return {
      id, name: person.name, role: id === state.master.personId ? 'master' : 'disciple',
      appearance: publicPerson?.appearance?.spriteIndex ?? appearanceView(state, id).spriteIndex,
      action: publicPerson?.appearance?.action ?? appearanceView(state, id).action,
      ...(id === state.master.personId ? {controlMode: state.masterControl?.mode || 'manual'} : {}),
      realm: person.realm, realmLabel: realmName(person.realm), xp: person.xp, xpNeed: xpNeed(person.realm),
      root: person.root ?? null, energy: person.energy, wound: person.wound,
      status: person.lifeStatus || person.life?.status || 'alive', satiety: mind.satiety ?? null,
      atHome: atHome(person) && !person.journey && !mind.away,
      peak: peak ? {id: peak.id, name: peak.name} : null,
      office: publicPerson?.office || null,
      mainArtId: publicSociety?.main ?? (id === state.master.personId ? mind.main || null : null),
      arts: id === state.master.personId ? Object.entries(person.artsById || {})
        .filter(([, value]) => value?.understanding > 0 || value?.mastery > 0)
        .map(([artId, value]) => ({id: artId, understanding: value.understanding || 0, mastery: value.mastery || 0})) :
        Object.entries(publicSociety?.knowledge || {}).filter(([, value]) => value > 0)
          .map(([artId, value]) => ({id: artId, understanding: value, mastery: null})),
      currentActivity: {id: activity?.id || null, kind: life.activity, label: life.label,
        phase: privateActivity ? life.status : activity?.phase || life.status, reason: life.reason,
        progressTicks: privateActivity ? null : activity?.progressTicks ?? activityOrder?.progressTicks ?? null,
        durationTicks: privateActivity ? null : activity?.durationTicks ?? activityOrder?.durationTicks ?? null},
      schedule: schedule ? {phase: schedule.phase, reason: privateActivity ? life.reason : schedule.reason,
        commitUntilTick: schedule.commitUntilTick ?? null,
        invitations: Object.entries(person.schedule?.invitations || {}).filter(([key]) => key.startsWith('work:'))
          .map(([key, result]) => ({targetId: key.slice(5), accepted: !!result.accepted,
            available: !!result.available, atTick: result.atTick ?? null,
            reason: result.publicReason || '', retryAfterTick: result.retryAfterTick ?? null}))} : null,
      relations, equipmentSlots, equipmentEffects: equipmentCombatBenefits(state, id), workChoices,
    };
  });
  return {persons, workplaces};
}

function projectInventory(state, equipment, economy) {
  const visibleStockpiles = new Set((economy.stockpiles || []).map(stockpile => stockpile.id));
  const equipmentItems = new Map([...equipment.items, ...equipment.visibleNpcItems]
    .map(item => [item.id, item]));
  const equipmentDefinitions = ['guard', 'heal', 'reach', 'node', 'themeRole'];
  return {
    slots: [...EQUIPMENT_SLOTS],
    equipment: [...equipmentItems.values()].map(item => {
      const definition = item.definition;
      return {id: item.id, definitionId: item.definitionId, name: definition.name,
        slot: definition.slot, condition: item.condition, ownerId: item.ownerId,
        location: {...item.location}, loan: item.loan ? {borrowerId: item.loan.borrowerId,
          dueTick: item.loan.dueTick, status: item.loan.status} : null,
        quality: definition.quality, realm: definition.realm, weight: definition.weight,
        effects: Object.fromEntries(equipmentDefinitions.filter(key => definition[key] !== undefined)
          .map(key => [key, definition[key]])), description: definition.description || null};
    }),
    equipmentOrders: equipment.orders.map(order => ({id: order.id, operation: order.operation,
      phase: order.phase, personId: order.personId, itemId: order.parameters?.itemId || null,
      progressTicks: order.progressTicks, durationTicks: order.durationTicks,
      reason: order.reason || ''})),
    stockpiles: (economy.stockpiles || []).map(stockpile => ({id: stockpile.id,
      label: stockpile.label, ownerId: stockpile.ownerId, access: stockpile.access,
      position: stockpile.position, resources: stockpile.resources, pills: stockpile.pills,
      orderReserved: stockpile.orderReserved})),
    summary: economy.inventorySummary || [], pillAccess: economy.pillAccess || [],
    transports: (economy.transports || []).filter(order => visibleStockpiles.has(order.sourceStockpileId) &&
      visibleStockpiles.has(order.targetStockpileId)).map(order => ({id: order.id, phase: order.phase,
      carrierId: order.carrierId, sourceStockpileId: order.sourceStockpileId,
      targetStockpileId: order.targetStockpileId, cargo: order.cargo, reason: order.reason || ''})),
  };
}

function projectCrafting(state, economy) {
  const furnace = state.buildings.find(building => building.type === 'alchemy') || null;
  const stockpile = furnace && state.stockpilesById?.[`stockpile:${furnace.instanceId}`];
  const orders = Object.values(state.workOrdersById || {}).filter(order => order.kind === 'sr-crafting')
    .map(order => {
      const activity = state.activitiesById?.[order.activityId];
      return {id: order.id, recipeId: order.recipeId, recipeName: RECIPES[order.recipeId]?.name || order.recipeId,
        phase: order.phase, activityPhase: activity?.phase || null, reason: activity?.reason || order.reason || '',
        personId: order.personId, buildingId: order.targetId, stockpileId: `stockpile:${order.targetId}`,
        progressTicks: order.progressTicks, durationTicks: order.durationTicks, yield: order.yield,
        cost: {...order.cost}, sourceStockpileIds: {...order.sourceStockpileIds},
        startedTick: order.startedTick, finishedTick: order.finishedTick ?? null,
        resultFactId: order.resultFactId || null};
    });
  return {
    workstation: furnace ? {buildingId: furnace.instanceId, stockpileId: stockpile?.id || null,
      name: BUILDINGS.alchemy.name, level: furnace.level, condition: furnace.condition,
      enabled: furnace.enabled !== false && !furnace.spatialLock,
      workSlots: facilitySlots(state, furnace, 'work').length,
      resources: stockpile ? {...stockpile.resources} : null, pills: stockpile ? {...stockpile.pills} : null} : null,
    recipes: (economy.craftRecipes || []).map(recipe => ({id: recipe.id, name: recipe.name,
      description: RECIPES[recipe.id]?.description || '', available: recipe.available,
      reasons: [...recipe.reasons], cost: {...recipe.cost}, durationTicks: recipe.durationTicks,
      yield: recipe.yield, buildingId: recipe.buildingId,
      physicalStockpileId: recipe.physicalStockpileId, effect: {...(RECIPES[recipe.id]?.effect || {})}})),
    orders,
  };
}

function projectHarvest(state, economy) {
  const activity = state.activitiesById?.[state.master.activityId];
  const current = activity?.kind === 'sr-harvest' ? {id: activity.id, resource: activity.resource,
    phase: activity.phase, reason: activity.reason || '', progressTicks: activity.progressTicks,
    durationTicks: activity.durationTicks} : null;
  return {
    activity: current,
    sources: ['wood', 'stone', 'herb'].map(id => {
      const patch = economy.patches?.[id];
      const reason = !atHome(state.master) || state.master.journey || state.world?.exploration ||
          state.combat?.status === 'active' ? '先归院再亲自采集。' :
        state.master.activityId ? '先完成或取消当前身体活动。' :
        state.master.wound > 20 || state.master.energy < 15 ? '先恢复身体与精力。' :
        !patch || !harvestAvailable(state, id, HARVEST_BATCH[id]) ? '此处整批来源不足，需实际恢复或采购。' : '';
      return {id, name: RESOURCES[id], position: patch?.position ? {...patch.position} : null,
        remaining: patch?.remaining ?? 0, batchSize: HARVEST_BATCH[id],
        available: !reason, reason};
    }),
  };
}

function projectMarket(state, economy) {
  const merchant = state.personsById?.['person:merchant-qingxi'];
  const position = merchant?.position;
  const atCourtyard = position?.kind === 'scene' && position.sceneId === SPATIAL_SCENE.id;
  const merchantStock = state.stockpilesById?.['stockpile:qingxi'];
  const publicStock = state.stockpilesById?.['stockpile:yunxiu'];
  return {
    merchant: {id: merchant?.personId || null, name: merchant?.name || '',
      position: atCourtyard ? {x: position.x, y: position.y} : null,
      atCourtyard, canTrade: !!economy.market?.merchantPresent},
    goods: Object.entries(economy.market?.goods || {}).map(([id, definition]) => ({
      id, name: definition.name, buy: definition.buy, sell: definition.sell,
      merchantStock: merchantStock?.resources?.[id] ?? 0,
      publicStock: publicStock?.resources?.[id] ?? 0,
    })),
    publicJade: publicStock?.resources?.jade ?? 0,
    merchantJade: merchantStock?.resources?.jade ?? 0,
    unitsPerBatch: 10, maxBatchesPerCommand: 8,
    arrivalTick: economy.market?.arrivalTick ?? null,
    departureTick: economy.market?.departureTick ?? null,
  };
}

function projectLocalCombat(state, sceneId) {
  if (!state.combat?.localEncounter || sceneId !== 'scene:valley' || state.combat.sceneFrame?.sceneId !== sceneId) return null;
  const scene = getCampaignScene(state);
  return scene?.type === 'combat' ? {...structuredClone(scene), controls: structuredClone(viewSRCombat(state))} : null;
}

/** Copy public courtyard facts. Foot positions and room floors decide indoor visibility. */
export function projectGodotWorld(state, selection = null, sites = null) {
  const rooms = state.buildings.map(spatialRoom).filter(Boolean);
  const homePeople = scenicHomeActors(state).filter(atHome);
  const merchant = state.personsById?.['person:merchant-qingxi'];
  if (merchant && atHome(merchant) && merchant.lifeStatus !== 'dead') homePeople.push(merchant);
  if (atHome(state.master) && !state.master.journey && !state.world?.exploration && state.combat?.status !== 'active') homePeople.unshift(state.master);
  const people = [...new Map(homePeople.map(person => [person.personId, person])).values()].map(person => {
    const position = person === state.master ? person.scenic : person.mind.scenic;
    const appearance = appearanceView(state, person.personId);
    return {
      id: person.personId, name: person.name, x: position.x, y: position.y,
      visit: person.courtyardVisit ? structuredClone(person.courtyardVisit) : null,
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
    const publicLearning = person === state.master || !state.society ? null : viewPublicDiscipleLearning(state, person);
    return {
      id: person.personId, name: person.name, role: person === state.master ? 'master' : 'disciple',
      appearance: appearance.spriteIndex,
      realm: person.realm, root: person.root, energy: person.energy, wound: person.wound,
      action: appearance.action, atHome: atHome(person) && !person.journey && !mind.away,
      ...(person === state.master ? {controlMode: state.masterControl?.mode || 'manual'} : {}),
      mainArtId: publicLearning ? publicLearning.main : mind.main || null,
      arts: publicLearning ? Object.entries(publicLearning.knowledge).filter(([, value]) => value > 0)
        .map(([id, value]) => ({id, understanding: value, mastery: null})) :
        Object.entries(person.artsById || {}).filter(([, value]) => value?.understanding > 0 || value?.mastery > 0)
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
  const equipment = viewEquipment(state);
  const systemPeople = projectSystemPeople(state, equipment);
  const economy = viewEconomy(state);
  const inventory = projectInventory(state, equipment, economy);
  const crafting = projectCrafting(state, economy);
  const harvest = projectHarvest(state, economy);
  const market = projectMarket(state, economy);
  const scene = projectGodotScene(state, {homePeople: people,
    homeMasterPath: atHome(state.master) ? state.master.scenic.path || [] : []});
  const courtyard = scene.sceneId === SPATIAL_SCENE.id;
  const snapshot = {
    version: 1, tick: state.worldTick, revision: state.revision, nextCommandId: state.transactions.nextCommandId, paused: state.speed === 0,
    width: scene.width, height: scene.height, sceneId: scene.sceneId,
    masterId: state.master.personId, timeLabel: `第 ${day(state) + 1} 日`,
    message: !state.story.intro
      ? `${state.master.name}携家传逃至云岫山院，先在落脚处养伤。${objective.text}`
      : objective.text,
    resources: {...state.resources}, people: scene.people, buildings: courtyard ? buildings : [], roster, arts, cultivationOrders,
    systemPeople, inventory, crafting, harvest, market,
    world: scene.world, combat: projectLocalCombat(state, scene.sceneId),
    openingInheritance: openingInheritanceView(state),
    openingStory: projectOpeningStory(state),
    openingJourney: projectOpeningJourney(state),
    openingHallPhase: state.story?.opening?.hallPhase || 'complete',
    herbTerrace: projectHerbTerrace(state, construction, sites),
    estateStage: stage(state),
    construction: construction ? {buildingId:String(construction.building.id),operation:construction.operation,
      progress:construction.progress,stage:construction.stage,label:construction.label} : null,
    terrain: courtyard ? spatialTerrain(state).map(({id, kind, polygon}) => ({id, kind, polygon: polygon.map(point => [...point])})) : [],
    masterPath: scene.masterPath,
  };
  if (selection) {
    const collection = selection.kind === 'person' ? snapshot.people : snapshot.buildings;
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
        const frame = state.combat?.status === 'active' && state.combat.localEncounter ? state.combat.sceneFrame : null;
        if (frame?.sceneId === 'scene:valley') {
          if (!Number.isFinite(request.x) || !Number.isFinite(request.y)) throw Error('位置无效。');
          const local = {x: request.x - frame.origin.x, y: request.y - frame.origin.y};
          const arena = getCampaignScene(state);
          if (local.x < 0 || local.y < 0 || local.x > arena.width || local.y > arena.height)
            throw Error('请在林间战场内选择落点。');
          name = 'combatAction';
          args = ['move', local];
        } else {
          ({name, args} = godotMoveCommand(state, request.x, request.y));
        }
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
