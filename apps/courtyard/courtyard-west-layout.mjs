/** Source-pixel placement of the west forest in the continuous courtyard. */
export const WEST_LAYOUT = Object.freeze({
  x: -1672, width: 1672, height: 941, siteId: 'site:domain:west-lumber-1',
  entrance: Object.freeze({x:-16,y:32.6}),
  entranceArt: Object.freeze({x:-1171.75,y:607.1}),
});
export const WEST_IMAGES = Object.freeze({
  complete:'west-forest-complete-v1.png', empty:'west-forest-empty-v1.png',
  construction:'west-forest-construction-v1.png',
});
export const WEST_JOIN = Object.freeze({image:'west-forest-join-v1.png',x:-910,left:-300,right:240,feather:64});
// Local tile pixels. The full environment stays fixed while this site changes.
export const WEST_BUILD_PATCH = Object.freeze([[145,350],[625,350],[635,530],[610,585],[480,598],[300,590],[150,555]]);
export const WEST_SITE_POLYGON = Object.freeze([[180,525],[570,510],[720,535],[820,585],[820,635],[680,650],[450,625],[300,590],[180,560]]);
export const WEST_BUILDING_POLYGON = Object.freeze([[180,415],[265,380],[395,370],[465,412],[560,402],[605,440],[593,510],[460,519],[230,525]]);
export const WEST_OCCLUDERS = Object.freeze([
  {id:'west-lumber-shelter',source:'west',feetY:520,polygon:WEST_BUILDING_POLYGON.map(([x,y])=>[x+WEST_LAYOUT.x,y])},
]);
export const WEST_WALK_POLYGONS = Object.freeze([
  WEST_SITE_POLYGON,
]);
export const WEST_PATH_CENTER = Object.freeze([
  [500.25,607.1],[772,640],[1052,620],[1342,580],[1672,562],[1750,562],
]);
export const DOMAIN_PLAN = Object.freeze({width:1800,height:1250,mapTop:115,image:'golden-core-site-plan.svg'});
