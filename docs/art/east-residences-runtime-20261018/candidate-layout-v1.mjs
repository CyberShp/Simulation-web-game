/** U-167 / 61: measured v2 artwork and an independent spatial-calibration candidate.
 * Polygon/entrance coordinates are tile-local pixels. Candidate world coordinates
 * are metres; horizontal projection anchors are absolute art pixels.
 * This module contains data and pure helpers; importing it opens no terrain.
 */
export const RESIDENCES_LAYOUT = Object.freeze({x:6688,y:0,width:1672,height:941,status:'spatial-calibration'});
export const RESIDENCES_IMAGES = Object.freeze({complete:'east-residences-complete-v2.png',empty:'east-residences-empty-v2.png'});
export const RESIDENCES_SITES = Object.freeze([
  {"id":"site:domain:gc-11","planId":"GC-11","entrance":[418,386],"standingPolygon":[[385,382],[452,382],[453,418],[383,418]],"footprint":[[218,309],[602,309],[602,342],[485,346],[485,382],[350,382],[350,346],[218,342]],"buildingPolygon":[[180,140],[239,124],[263,86],[266,58],[289,48],[297,70],[545,70],[552,48],[575,57],[576,91],[610,128],[655,141],[651,172],[607,190],[607,332],[486,348],[486,382],[350,382],[350,348],[216,333],[216,190],[185,170]],"patch":[[165,42],[664,42],[677,190],[690,320],[679,415],[577,415],[568,443],[190,443],[163,365]],"feetY":382,"door":{"opening":[362,211,474,330],"centerX":418,"netWidthPx":112,"netHeightPx":119,"threshold":[418,330]},"candidate":{"status":"spatial-calibration","world":{"x":162,"y":40,"orientation":"south"},"level1":{"width":6,"height":6},"maxPlot":{"x":162,"y":40,"width":10,"height":10}}},
  {"id":"site:domain:gc-12","planId":"GC-12","entrance":[1118,386],"standingPolygon":[[1083,382],[1156,382],[1155,418],[1082,418]],"footprint":[[921,309],[1304,309],[1304,342],[1183,346],[1183,382],[1052,382],[1052,346],[921,342]],"buildingPolygon":[[882,140],[936,124],[962,88],[965,59],[987,48],[995,70],[1241,70],[1252,49],[1274,57],[1278,91],[1312,130],[1357,143],[1350,173],[1307,191],[1307,332],[1184,348],[1184,382],[1052,382],[1052,348],[919,333],[919,191],[888,172]],"patch":[[864,42],[1372,42],[1390,197],[1394,337],[1370,446],[1004,446],[988,415],[879,415],[864,330]],"feetY":382,"door":{"opening":[1062,211,1175,330],"centerX":1118.5,"netWidthPx":113,"netHeightPx":119,"threshold":[1118,330]},"candidate":{"status":"spatial-calibration","world":{"x":174,"y":40,"orientation":"south"},"level1":{"width":6,"height":6},"maxPlot":{"x":174,"y":40,"width":10,"height":10}}},
  {"id":"site:domain:gc-10","planId":"GC-10","entrance":[779,788],"standingPolygon":[[745,780],[815,780],[816,813],[742,813]],"footprint":[[550,710],[999,710],[999,742],[856,745],[856,779],[704,779],[704,745],[550,742]],"buildingPolygon":[[501,515],[548,496],[584,466],[596,433],[620,426],[638,446],[936,446],[944,430],[966,438],[972,475],[1011,513],[1056,534],[1039,566],[999,585],[999,735],[857,746],[857,779],[704,779],[704,746],[550,735],[550,585],[510,566]],"patch":[[595,423],[635,437],[936,437],[945,422],[974,432],[986,472],[1021,492],[1074,548],[1067,638],[1170,715],[1165,817],[552,817],[534,760],[466,717],[334,683],[334,586],[475,590],[489,515],[550,487],[582,461]],"feetY":779,"door":{"opening":[720,604,838,727],"centerX":779,"netWidthPx":118,"netHeightPx":123,"threshold":[779,727]},"candidate":{"status":"spatial-calibration","world":{"x":168,"y":60,"orientation":"south"},"level1":{"width":6,"height":6},"maxPlot":{"x":168,"y":60,"width":10,"height":10}}}
]);
export const RESIDENCES_ROADS = Object.freeze([
  {"id":"upper","center":[[100,478],[300,478],[418,478],[545,478],[700,478],[900,478],[1118,478],[1380,478],[1505,478]],"polygons":[[[104,449],[548,449],[590,461],[594,495],[547,502],[126,500],[104,515],[56,496]],[[970,455],[1458,451],[1538,464],[1542,488],[1482,504],[1012,500],[994,479]],[[580,450],[1005,450],[1005,505],[580,505]]],"occludedCenterSection":[[590,478],[995,478]]},
  {"id":"lower","center":[[112,844],[350,847],[600,847],[850,847],[1100,847],[1400,845],[1590,840]],"polygons":[[[118,818],[480,816],[740,820],[1100,815],[1440,816],[1620,812],[1630,859],[1450,871],[1110,870],[765,873],[475,872],[125,868],[87,850]]]},
  {"id":"west","center":[[80,478],[75,550],[75,650],[75,735],[75,775],[84,813],[112,844]],"polygons":[[[40,487],[76,451],[118,447],[130,470],[107,508],[106,730],[121,792],[145,818],[151,866],[85,869],[43,833],[40,803],[0,800],[0,750],[49,747],[42,705],[40,600]]]},
  {"id":"west-entry","center":[[0,775],[75,775]],"polygons":[]},
  {"id":"branch:GC-11","center":[[418,386],[418,440],[418,478]],"polygons":[[[387,380],[450,380],[451,450],[384,450]]]},
  {"id":"branch:GC-12","center":[[1118,386],[1118,439],[1118,478]],"polygons":[[[1083,380],[1155,380],[1156,452],[1081,452]]]},
  {"id":"branch:GC-10","center":[[779,788],[779,818],[779,847]],"polygons":[[[745,780],[813,780],[817,823],[742,823]]]}
]);
export const RESIDENCES_WALK_POLYGONS = Object.freeze([
  ...RESIDENCES_ROADS.flatMap(road=>road.polygons),
  ...RESIDENCES_SITES.map(site=>site.standingPolygon),
]);
export const RESIDENCES_JOIN_PROPOSAL = Object.freeze({"existingEastBoundaryArt":[6688,820.56],"v2BoundaryArt":[6688,775],"roadPatchWorldBounds":[6508,735,6808,880],"roadCenterWorld":[[6508,813],[6608,820.56],[6668,813],[6708,795],[6763,775]],"references":{"existingTerraceSourceBounds":[1492,735,1672,880],"newTileSourceBounds":[0,735,120,880]},"status":"minimal joining corridor proposal, not generated"});

// The metre locations and transition are candidates for the next spatial review.
export const RESIDENCES_PROJECTION_CANDIDATE = Object.freeze({
  horizontal:[[160,6808],[165,7106],[171,7467],[177,7806],[184,8248],[186,8360]],
  transitionArtX:[6808,6927.2],
  // World depth -> art depth. Rows through y36 retain the terrace horizon;
  // y40/46 and y60/66 follow the measured rear ground and front step edge.
  // Intermediate rows keep every legacy depth breakpoint explicit.
  depth:[[0,-300],[4,-200],[12,-60],[12.6,65],[20,125],[28,190],[36,260],
    [40,309],[44,357.6666666666667],[44.6,364.96666666666664],
    [45.5,375.9166666666667],[46,382],[46.6,386],[48,404.2],
    [50,430.2],[50.6,438],[52,454.47058823529414],[54,478],
    [60,710],[66,779],[66.6,788],[70,806.7],[70.6,810],[72,847],[96,1225]],
  personRadiusMetres:.26,
});

function interpolate(pairs,value) {
  let i=0;
  while(i<pairs.length-2&&value>pairs[i+1][0])i++;
  const [ax,ay]=pairs[i],[bx,by]=pairs[i+1];
  return ay+(by-ay)*(value-ax)/(bx-ax);
}
/** Supply the existing projection from a separate read-only audit caller.
 * No runtime module is imported here. The returned projection delegates the
 * complete old domain unchanged and blends depth only east of world x=160.
 */
export function createResidencesCandidateProjection({legacyToArt,legacyToWorld}) {
  if(typeof legacyToArt!=='function'||typeof legacyToWorld!=='function')throw new TypeError('Existing projection functions are required.');
  const c=RESIDENCES_PROJECTION_CANDIDATE;
  const blend=artX=>Math.max(0,Math.min(1,(artX-c.transitionArtX[0])/(c.transitionArtX[1]-c.transitionArtX[0])));
  const depthAt=(artX,y)=>{
    const oldY=legacyToArt(160,y).y,t=blend(artX);
    return oldY+(interpolate(c.depth,y)-oldY)*t;
  };
  return Object.freeze({
    toArt(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y))return null;
      if(x<=160)return legacyToArt(x,y);
      const artX=interpolate(c.horizontal,x);
      return {x:artX,y:depthAt(artX,y)};
    },
    toWorld(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y))return null;
      if(x<=6808)return legacyToWorld(x,y);
      const worldX=interpolate(c.horizontal.map(([world,art])=>[art,world]),x);
      const inverseDepth=c.depth.map(([world])=>[depthAt(x,world),world]);
      return {x:worldX,y:interpolate(inverseDepth,y)};
    },
  });
}
