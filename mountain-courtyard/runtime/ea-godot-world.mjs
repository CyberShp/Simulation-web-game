/** Public local scene projection for the Godot presentation bridge. */
import {appearanceView} from './ea-opening-sim.mjs?v=283cdc422cd2';
import {viewSRWorld} from './ea-sr-world.mjs?v=283cdc422cd2';

const HOME = 'scene:yunxiu-courtyard';
const TRAVEL = 'scene:travel';
const copy = value => value == null ? value : structuredClone(value);

function visiblePerson(state, actor) {
  const appearance = appearanceView(state, actor.personId);
  return {
    id: actor.personId, name: actor.name, x: actor.x, y: actor.y,
    appearance: actor.appearance?.spriteIndex ?? appearance?.spriteIndex ?? 0,
    activity: appearance?.action || 'stand', indoor: false, moving: false,
  };
}

/** Local bodies come only from viewSRWorld's public same-scene actor list. */
export function projectGodotScene(state, {homePeople = [], homeMasterPath = []} = {}) {
  const publicWorld = state.srWorld ? viewSRWorld(state) : null;
  const scene = publicWorld?.scene;
  const world = publicWorld ? {
    scene: copy(scene),
    travel: copy(publicWorld.travel), exits: copy(publicWorld.exits || []),
    objects: copy(scene?.objects || []),
    publicPeople: (scene?.actors || []).map(actor => visiblePerson(state, actor)),
    activity: copy(publicWorld.activity), lastInteraction: copy(publicWorld.lastInteraction),
    messages: copy(publicWorld.messages || []),
  } : null;
  if (world?.scene?.id === HOME) world.scene.name = '云岫山院';
  if (world?.travel?.destinationId === HOME) world.travel.destination = '云岫山院';

  if (!publicWorld || scene?.id === HOME) {
    const people = [...homePeople];
    // The merchant is a public visitor but is not part of the home disciple list.
    const merchant = world?.publicPeople.find(person => person.id === 'person:merchant-qingxi');
    if (merchant && !people.some(person => person.id === merchant.id)) people.push(merchant);
    if (world) world.publicPeople = world.publicPeople.filter(person => people.some(visible => visible.id === person.id));
    return {sceneId: HOME, width: 96, height: 96, people,
      masterPath: homeMasterPath.map(point => ({x: point.x, y: point.y})), world};
  }

  if (!scene) return {sceneId: TRAVEL, width: 64, height: 48, people: [], masterPath: [], world};

  const master = scene.player && {
    ...visiblePerson(state, scene.player),
    moving: publicWorld.activity?.kind === 'walk',
  };
  const people = [...(master ? [master] : []), ...world.publicPeople];
  const masterPath = publicWorld.activity?.kind === 'walk'
    ? (state.srWorld?.interaction?.path || []).map(point => ({x: point.x, y: point.y})) : [];
  return {sceneId: scene.id, width: scene.width, height: scene.height, people, masterPath, world};
}

/** Bounds are presentation validation; the selected scene's formal command checks the path. */
export function godotMoveCommand(state, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('位置无效。');
  const location = state.master.location;
  if (location?.kind === 'travel') throw Error('行程中无法指定场景落点。');
  const scene = state.srWorld ? viewSRWorld(state)?.scene : null;
  const sceneId = location?.sceneId || HOME;
  const width = scene?.width || (sceneId === HOME ? 96 : 64);
  const height = scene?.height || (sceneId === HOME ? 96 : 48);
  if (x < 0 || y < 0 || x > width || y > height) throw Error('请在当前场景范围内选择位置。');
  return sceneId === HOME ? {name: 'moveScenicMaster', args: [x, y]} :
    {name: 'srWorldCommand', args: [{action: 'move', x, y}]};
}
