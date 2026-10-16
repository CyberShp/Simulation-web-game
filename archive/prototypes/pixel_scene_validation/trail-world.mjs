import { WORLD, WALKABLE, FOOTPRINTS, OBSTACLES, createNavigation } from './world.mjs';

export const TRAIL_WORLD = Object.freeze({ width: WORLD.width, height: WORLD.height * 3 });
const terrainPolygon = points => points.map(([x, y]) => [x * 1672 / 1182, 941 + y * 1882 / 1330]);

// Pixel-space ground regions for the connected courtyard, forest and valley.
export const TRAIL_WALKABLE = [
  ...WALKABLE,
  [[710, 928], [930, 928], [930, 960], [710, 960]],
  terrainPolygon([[500, 0], [660, 0], [666, 110], [692, 170], [684, 230], [684, 415], [706, 445], [475, 445], [484, 415], [484, 230], [488, 170], [484, 110]]),
  terrainPolygon([[475, 410], [700, 410], [790, 470], [850, 520], [905, 580], [930, 650], [905, 716], [825, 785], [735, 825], [480, 825], [380, 770], [320, 705], [294, 638], [325, 567], [365, 515], [420, 467]]),
  terrainPolygon([[370, 770], [480, 803], [610, 816], [735, 800], [850, 760], [942, 780], [1040, 835], [1020, 900], [1046, 954], [1021, 1027], [945, 1080], [912, 1150], [807, 1182], [730, 1205], [568, 1215], [478, 1175], [390, 1150], [308, 1082], [225, 1045], [174, 975], [182, 901], [222, 854], [304, 819]])
];

export const TRAIL_SIGHT_BLOCKERS = [
  ...FOOTPRINTS,
  ...OBSTACLES,
  { id: 'hall', polygon: [[680, 170], [985, 170], [985, 310], [680, 310]] },
  { id: 'forest-rock-island', polygon: terrainPolygon([[465, 537], [535, 540], [617, 556], [707, 588], [771, 630], [790, 674], [768, 715], [702, 738], [620, 744], [536, 727], [465, 701], [423, 654], [431, 588]]) },
  { id: 'bridge-west-rail', polygon: terrainPolygon([[462, 232], [483, 232], [483, 414], [462, 414]]) },
  { id: 'bridge-east-rail', polygon: terrainPolygon([[687, 232], [710, 232], [710, 414], [687, 414]]) },
  { id: 'valley-east-stone', polygon: terrainPolygon([[1033, 915], [1064, 901], [1090, 934], [1082, 974], [1035, 970]]) }
];

export const TRAIL_LANDMARKS = Object.freeze({
  home: Object.freeze({ x: 820, y: 650 }),
  gate: Object.freeze({ x: 820, y: 928 }),
  forest: Object.freeze({ x: 540, y: 1835 }),
  crossing: Object.freeze({ x: 820, y: 1395 }),
  valley: Object.freeze({ x: 830, y: 2320 })
});

export const TRAIL_ARRIVAL = Object.freeze({ x: 830, y: 2320, radius: 100, minY: 2200, partyMinY: 2150 });
export function isTrailArrival(point) {
  return Boolean(point && trailNavigation.isWalkable(point.x, point.y) && point.y >= TRAIL_ARRIVAL.minY
    && Math.hypot(point.x - TRAIL_ARRIVAL.x, point.y - TRAIL_ARRIVAL.y) <= TRAIL_ARRIVAL.radius);
}

export const trailNavigation = createNavigation({
  bounds: TRAIL_WORLD,
  walkable: TRAIL_WALKABLE,
  footprints: TRAIL_SIGHT_BLOCKERS.filter(blocker => blocker.polygon),
  obstacles: TRAIL_SIGHT_BLOCKERS.filter(blocker => !blocker.polygon),
  sightBlockers: TRAIL_SIGHT_BLOCKERS,
  cellSize: 24,
  useHeap: true
});
