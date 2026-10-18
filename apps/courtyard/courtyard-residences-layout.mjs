/** U-167 / 61: measured v2 artwork and an independent spatial-calibration candidate.
 * Polygon/entrance coordinates are tile-local pixels. Candidate world coordinates
 * are metres; horizontal projection anchors are absolute art pixels.
 * This module contains data and pure helpers; importing it opens no terrain.
 */
export const RESIDENCES_LAYOUT = Object.freeze({x:6688,y:0,width:1672,height:941,status:'spatial-calibration'});
export const RESIDENCES_IMAGES = Object.freeze({complete:'east-residences-complete-v2.png',empty:'east-residences-empty-v4.png',construction:'east-residences-construction-v1.png'});
export const RESIDENCES_SITES = Object.freeze([
  {"id":"site:domain:gc-11","planId":"GC-11","stagePatches":{"complete":[[175,139],[237,119],[260,83],[264,47],[290,44],[303,65],[543,65],[549,44],[579,52],[583,89],[613,123],[660,138],[656,176],[613,195],[613,310],[619,334],[620,352],[604,373],[613,391],[635,419],[591,437],[476,432],[449,412],[384,412],[354,429],[253,433],[219,421],[239,389],[257,373],[252,350],[217,349],[210,331],[182,339],[176,312],[195,303],[208,304],[210,194],[180,175]],"construction":[[228,139],[255,132],[261,106],[280,107],[279,134],[308,130],[328,135],[335,155],[474,156],[478,140],[495,140],[500,160],[547,155],[550,105],[569,103],[574,159],[597,161],[601,219],[632,258],[636,334],[604,352],[604,377],[617,412],[590,435],[477,432],[449,412],[384,412],[354,430],[253,433],[217,418],[246,378],[223,356],[207,336],[211,265],[226,238]]},"entrance":[418,386],"standingPolygon":[[385,382],[452,382],[453,418],[383,418]],"footprint":[[218,309],[602,309],[602,342],[485,346],[485,382],[350,382],[350,346],[218,342]],"buildingPolygon":[[180,140],[239,124],[263,86],[266,58],[289,48],[297,70],[545,70],[552,48],[575,57],[576,91],[610,128],[655,141],[651,172],[607,190],[607,332],[486,348],[486,382],[350,382],[350,348],[216,333],[216,190],[185,170]],"patch":[[165,42],[664,42],[677,190],[690,320],[679,415],[577,415],[568,443],[190,443],[163,365]],"feetY":382,"door":{"opening":[362,211,474,330],"centerX":418,"netWidthPx":112,"netHeightPx":119,"threshold":[418,330]},"candidate":{"status":"spatial-calibration","world":{"x":162,"y":40,"orientation":"south"},"level1":{"width":6,"height":6},"maxPlot":{"x":162,"y":40,"width":10,"height":10}}},
  {"id":"site:domain:gc-12","planId":"GC-12","stagePatches":{"complete":[[877,139],[934,119],[959,85],[963,52],[987,44],[1000,66],[1240,66],[1248,45],[1277,53],[1282,88],[1316,126],[1362,141],[1356,177],[1312,195],[1312,330],[1336,337],[1366,338],[1374,365],[1346,374],[1350,410],[1326,438],[1180,433],[1155,412],[1082,412],[1050,433],[951,436],[916,420],[930,386],[948,371],[944,349],[919,339],[914,191],[883,175]],"construction":[[934,140],[960,135],[968,107],[991,106],[994,136],[1040,137],[1063,153],[1180,157],[1182,139],[1200,140],[1203,155],[1240,155],[1241,107],[1261,107],[1266,154],[1295,148],[1304,220],[1323,266],[1331,337],[1311,355],[1316,384],[1341,418],[1326,438],[1180,433],[1155,412],[1082,412],[1050,433],[951,436],[916,420],[934,380],[915,355],[899,337],[903,270],[925,226]]},"entrance":[1118,386],"standingPolygon":[[1083,382],[1156,382],[1155,418],[1082,418]],"footprint":[[921,309],[1304,309],[1304,342],[1183,346],[1183,382],[1052,382],[1052,346],[921,342]],"buildingPolygon":[[882,140],[936,124],[962,88],[965,59],[987,48],[995,70],[1241,70],[1252,49],[1274,57],[1278,91],[1312,130],[1357,143],[1350,173],[1307,191],[1307,332],[1184,348],[1184,382],[1052,382],[1052,348],[919,333],[919,191],[888,172]],"patch":[[864,42],[1372,42],[1390,197],[1394,337],[1370,446],[1004,446],[988,415],[879,415],[864,330]],"feetY":382,"door":{"opening":[1062,211,1175,330],"centerX":1118.5,"netWidthPx":113,"netHeightPx":119,"threshold":[1118,330]},"candidate":{"status":"spatial-calibration","world":{"x":174,"y":40,"orientation":"south"},"level1":{"width":6,"height":6},"maxPlot":{"x":174,"y":40,"width":10,"height":10}}},
  {"id":"site:domain:gc-10","planId":"GC-10","stagePatches":{"complete":[[497,515],[545,491],[580,464],[592,429],[620,421],[640,442],[936,442],[942,426],[970,433],[977,472],[1015,508],[1061,532],[1043,571],[1004,589],[1004,736],[1050,742],[1090,767],[1128,790],[1100,813],[856,812],[815,792],[742,792],[704,812],[493,811],[481,791],[519,756],[523,729],[494,724],[477,708],[465,707],[454,694],[449,665],[457,639],[497,624],[548,639],[546,585],[506,569]],"construction":[[558,510],[585,506],[590,477],[617,476],[622,506],[679,511],[681,499],[702,499],[706,513],[855,513],[858,500],[880,500],[884,514],[941,510],[942,475],[964,476],[970,505],[1008,503],[1009,611],[1038,661],[1048,735],[1030,746],[1047,776],[1104,802],[1084,813],[856,812],[815,792],[742,792],[704,812],[514,810],[505,792],[539,754],[515,735],[520,671],[548,613]]},"entrance":[779,788],"standingPolygon":[[745,780],[815,780],[816,813],[742,813]],"footprint":[[550,710],[999,710],[999,742],[856,745],[856,779],[704,779],[704,745],[550,742]],"buildingPolygon":[[501,515],[548,496],[584,466],[596,433],[620,426],[638,446],[936,446],[944,430],[966,438],[972,475],[1011,513],[1056,534],[1039,566],[999,585],[999,735],[857,746],[857,779],[704,779],[704,746],[550,735],[550,585],[510,566]],"patch":[[595,423],[635,437],[936,437],[945,422],[974,432],[986,472],[1021,492],[1074,548],[1067,638],[1170,715],[1165,817],[552,817],[534,760],[466,717],[334,683],[334,586],[475,590],[489,515],[550,487],[582,461]],"feetY":779,"door":{"opening":[720,604,838,727],"centerX":779,"netWidthPx":118,"netHeightPx":123,"threshold":[779,727]},"candidate":{"status":"spatial-calibration","world":{"x":168,"y":60,"orientation":"south"},"level1":{"width":6,"height":6},"maxPlot":{"x":168,"y":60,"width":10,"height":10}}}
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
// Cleared, visible outdoor ground measured on empty-v4. Building collisions
// and indoor access remain the simulation's separate responsibility.
export const RESIDENCES_GROUND_POLYGONS = Object.freeze([
  [[210,300],[830,300],[830,451],[210,451]],
  [[910,300],[1570,300],[1570,449],[1480,454],[910,454]],
  [[542,708],[1208,708],[1208,825],[542,825]],
]);
export const RESIDENCES_WALK_POLYGONS = Object.freeze([
  ...RESIDENCES_ROADS.flatMap(road=>road.polygons),
  ...RESIDENCES_GROUND_POLYGONS,
  ...RESIDENCES_SITES.map(site=>site.standingPolygon),
]);
export const RESIDENCES_JOIN_PROPOSAL = Object.freeze({"existingEastBoundaryArt":[6688,820.56],"v2BoundaryArt":[6688,775],"roadPatchWorldBounds":[6508,735,6808,880],"roadCenterWorld":[[6508,813],[6608,820.56],[6668,813],[6708,795],[6763,775]],"references":{"existingTerraceSourceBounds":[1492,735,1672,880],"newTileSourceBounds":[0,735,120,880]},"status":"minimal joining corridor proposal, not generated"});

// The metre locations and transition are candidates for the next spatial review.
export const RESIDENCES_PROJECTION_CANDIDATE = Object.freeze({
  version:'residences-projection-candidate-v2',
  // Shared x160/162 columns keep the depth transition independent of row shape.
  // The rear row matches both rear houses; the foreground row matches GC10.
  horizontalColumns:[
    {worldY:50,anchors:[[160,6808],[162,6906],[165,7106],[168,7290],[171,7449.5],[174,7609],[177,7806],[180,7992],[184,8248],[186,8360]]},
    {worldY:60,anchors:[[160,6808],[162,6906],[165,7072],[168,7238],[171,7467],[174,7687],[177,7839.5],[180,7992],[184,8248],[186,8360]]},
  ],
  transitionArtX:[6808,6906],
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
 * Rear/foreground horizontal rows share their transition anchors. Given art X,
 * depth is inverted first, then the selected horizontal row is inverted exactly.
 */
export function createResidencesCandidateProjection({legacyToArt,legacyToWorld}) {
  if(typeof legacyToArt!=='function'||typeof legacyToWorld!=='function')throw new TypeError('Existing projection functions are required.');
  const c=RESIDENCES_PROJECTION_CANDIDATE;
  const horizontalAt=y=>{
    const [rear,front]=c.horizontalColumns,t=Math.max(0,Math.min(1,(y-rear.worldY)/(front.worldY-rear.worldY)));
    return rear.anchors.map(([world,art],i)=>[world,art+(front.anchors[i][1]-art)*t]);
  };
  const blend=artX=>Math.max(0,Math.min(1,(artX-c.transitionArtX[0])/(c.transitionArtX[1]-c.transitionArtX[0])));
  const depthAt=(artX,y)=>{
    const oldY=legacyToArt(160,y).y,t=blend(artX);
    return oldY+(interpolate(c.depth,y)-oldY)*t;
  };
  return Object.freeze({
    toArt(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y))return null;
      if(x<=160)return legacyToArt(x,y);
      const artX=interpolate(horizontalAt(y),x);
      return {x:artX,y:depthAt(artX,y)};
    },
    toWorld(x,y) {
      if(!Number.isFinite(x)||!Number.isFinite(y))return null;
      if(x<=6808)return legacyToWorld(x,y);
      const inverseDepth=c.depth.map(([world])=>[depthAt(x,world),world]);
      const worldY=interpolate(inverseDepth,y);
      const worldX=interpolate(horizontalAt(worldY).map(([world,art])=>[art,world]),x);
      return {x:worldX,y:worldY};
    },
  });
}

/** Shared join: global art pixels; polygon clips scenery, walkPolygon marks footing. */
export const RESIDENCES_JOIN = Object.freeze({"image":"east-residences-join-v3.png","x":5852,"y":0,"width":1672,"height":941,"feather":20,"sceneryLeft":6632,"sceneryRight":6744,"sceneryFeather":24,"polygon":[[6307,720],[6392,720],[6492,740],[6672,755],[6752,750],[6802,740],[6842,800],[6822,855],[6692,870],[6532,850],[6412,825],[6322,805]],"walkPolygon":[[6312,750],[6342,738],[6407,750],[6477,770],[6612,785],[6692,785],[6732,770],[6767,755],[6792,765],[6772,815],[6722,844],[6657,845],[6552,828],[6472,815],[6412,798],[6352,795],[6322,780]],"center":[[6327,765],[6356,775],[6476,805],[6688,820.56],[6730,801],[6763,775]]});
