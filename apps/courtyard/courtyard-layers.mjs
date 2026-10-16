/** Source-pixel metadata for the 1672 × 941 courtyard painting.
 * Frame feet are relative to the crop. Scale each frame by height/sourceHeight;
 * sourceHeight measures from the visible crown to the planted foot.
 */
export const SOURCE_SIZE = Object.freeze({ width: 1672, height: 941 });
import { EAST_LAYOUT, EAST_HOUSE_POLYGON } from './courtyard-east-layout.mjs';

/** U-153 opening variants use the approved camera. Only these site regions
 * replace the master painting; the rest of the environment stays unchanged. */
export const OPENING_IMAGES = Object.freeze({
  empty: 'opening-ground-v1.png',
  shelter: 'opening-shelter-v1.png',
  foundation: 'opening-hall-foundation-v1.png',
  structure: 'opening-hall-structure-v1.png',
  finishing: 'opening-hall-finishing-v1.png',
});
export const OPENING_HALL_PATCH = Object.freeze([
  [250,38],[1000,38],[1000,355],[844,445],[414,445],[415,311],
  [355,301],[265,283],[244,258],[275,230],[259,208],
]);
export const OPENING_FIELD_PATCH = Object.freeze([
  [233,550],[315,579],[400,598],[546,631],[684,667],[688,794],
  [622,851],[548,898],[359,901],[211,860],[87,805],[84,725],
  [143,679],[187,624],
]);
export const OPENING_SHELTER = Object.freeze({
  crop: [96,90,1416,844], foot: [645,794], width: 190,
  silhouette: [[68,740],[200,415],[195,120],[249,83],[250,5],[310,5],
    [315,105],[1180,160],[1180,60],[1250,55],[1260,152],[1300,175],
    [1300,211],[1260,236],[1375,774],[1345,790],[1260,765],
    [1250,830],[1190,830],[1175,800],[1030,810],[965,815],[740,777],[250,770]],
});

const frame = (crop, foot, sourceHeight) => ({ crop, foot, sourceHeight });
const rail = (id, a, b, width, feetY) => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[1] - a[1]) / length * width / 2;
  const dy = (a[0] - b[0]) / length * width / 2;
  return { id, feetY, polygon: [[a[0]+dx,a[1]+dy],[b[0]+dx,b[1]+dy],
    [b[0]-dx,b[1]-dy],[a[0]-dx,a[1]-dy]] };
};
const post = (id, x, top, bottom, width) => ({ id, feetY: bottom,
  polygon: [[x-width/2,top+3],[x-width/2+2,top],[x+width/2-2,top],
    [x+width/2,top+3],[x+width/2,bottom],[x-width/2,bottom]] });

const east = item => ({...item,source:'east',polygon:item.polygon.map(([x,y])=>[x+EAST_LAYOUT.terraceX,y])});
export const EAST_OCCLUDERS = Object.freeze([
  east({id:'east-residence',feetY:418,building:true,polygon:EAST_HOUSE_POLYGON}),
  east(rail('east-front-rail-a',[839,573],[1044,624],12,634)),
  east(post('east-front-post-a',839,551,598,14)),
  east(post('east-front-post-b',914,574,625,14)),
  east(post('east-front-post-c',1040,592,649,16)),
  east({id:'east-front-lamp',feetY:658,polygon:[[1045,570],[1061,552],[1070,535],[1081,554],[1095,569],[1090,607],[1102,632],[1100,657],[1047,657],[1044,631],[1054,611]]}),
  east({id:'east-step-lamp',feetY:751,polygon:[[1317,641],[1336,623],[1343,610],[1355,626],[1370,641],[1364,677],[1378,705],[1375,751],[1321,750],[1314,705],[1329,678]]}),
]);

export const FRAME_TABLE = Object.freeze({
  master: {
    atlas: 'assets/cultivator-v1.png', atlasWidth: 1536, atlasHeight: 1024, height: 111,
    idle: frame([70, 660, 218, 335], [134, 329], 323),
    walk: [
      frame([55, 18, 250, 335], [173, 328], 321),
      frame([433, 18, 225, 335], [154, 329], 322),
      frame([803, 18, 237, 335], [157, 330], 322),
      frame([1200, 18, 211, 335], [137, 329], 321),
    ],
    walkAway: [
      frame([76, 360, 281, 300], [125, 293], 286),
      frame([444, 360, 288, 300], [133, 294], 292),
      frame([805, 360, 296, 300], [133, 294], 286),
      frame([1212, 360, 279, 300], [130, 294], 292),
    ],
  },
  female: {
    atlas: 'assets/disciples-v1.png', atlasWidth: 1536, atlasHeight: 1024, height: 100,
    idle: frame([62, 525, 288, 469], [153, 449], 444),
    walk: [
      frame([410, 531, 290, 458], [158, 442], 430),
      frame([788, 531, 288, 460], [161, 448], 436),
      frame([62, 525, 288, 469], [153, 449], 444),
    ],
    walkAway: [],
  },
  other: {
    atlas: 'assets/disciples-v1.png', atlasWidth: 1536, atlasHeight: 1024, height: 100,
    idle: frame([55, 42, 280, 447], [151, 438], 431),
    walk: [
      frame([407, 44, 270, 446], [160, 436], 423),
      frame([784, 42, 286, 449], [177, 438], 427),
      frame([55, 42, 280, 447], [151, 438], 431),
    ],
    walkAway: [],
  },
});

/** Repaint each clipped source region after actors whose feetY is smaller.
 * The hall's front platform ends at y=324; staircase treads stay in the ground.
 * Bamboo rails and posts each keep their own silhouette and depth anchor.
 */
export const OCCLUDERS = Object.freeze([
  {
    id: 'hall-front', feetY: 324,
    polygon: [[274,164],[369,166],[374,104],[406,136],[473,112],
      [483,57],[546,73],[775,73],[789,59],[806,114],[850,134],
      [888,111],[891,166],[945,158],[971,191],[945,219],[884,229],
      [881,304],[837,324],[425,324],[420,296],[361,281],[315,244],[279,220]],
  },
  {
    id: 'hall-lion-left', feetY: 377,
    polygon: [[546,283],[566,282],[575,294],[575,311],[581,327],
      [579,345],[583,351],[581,377],[544,377],[541,346],[539,329],[545,311]],
  },
  {
    id: 'hall-lion-right', feetY: 377,
    polygon: [[759,282],[782,281],[791,296],[790,317],[797,333],
      [793,348],[801,357],[801,377],[762,375],[758,348],[753,334],[758,310]],
  },
  {
    id: 'hall-stair-rail-left', feetY: 430,
    polygon: [[574,343],[585,346],[601,425],[589,430]],
  },
  {
    id: 'hall-stair-rail-right', feetY: 430,
    polygon: [[775,344],[786,343],[803,425],[790,430]],
  },
  {
    id: 'hall-pillar-left', feetY: 436,
    polygon: [[558,375],[567,369],[577,376],[580,387],[578,393],
      [584,400],[583,435],[554,435],[553,398],[560,392]],
  },
  {
    id: 'hall-pillar-right', feetY: 434,
    polygon: [[796,374],[806,368],[815,374],[819,388],[815,394],
      [823,401],[823,433],[794,433],[791,398],[798,394]],
  },
  {
    id: 'court-lamp-left', feetY: 652,
    polygon: [[590,579],[603,563],[615,554],[625,569],[645,581],
      [641,611],[636,619],[641,650],[594,652],[596,615]],
  },
  {
    id: 'court-lamp-right', feetY: 666,
    polygon: [[928,576],[940,560],[953,546],[966,562],[983,575],
      [980,609],[974,617],[984,661],[934,667],[935,615]],
  },
  {
    id: 'herb-shelf', feetY: 724,
    polygon: [[281,636],[348,613],[387,629],[383,701],
      [363,713],[307,724],[287,710]],
  },
  {
    id: 'herb-entry-jar', feetY: 765,
    polygon: [[607,734],[614,733],[620,735],[622,738],[619,742],
      [623,747],[625,753],[624,758],[620,762],[606,763],
      [600,760],[598,755],[599,747],[602,742],[603,740],[602,737]],
  },
  rail('herb-west-top', [95,754], [121,784], 7, 800),
  rail('herb-west-bottom', [95,774], [120,800], 6, 802),
  post('herb-west-post-a', 95, 739, 788, 9),
  post('herb-west-post-b', 118, 760, 804, 10),
  rail('herb-front-a-top', [175,743], [234,776], 7, 798),
  rail('herb-front-a-bottom', [175,762], [234,796], 6, 800),
  post('herb-front-post-a', 175, 716, 768, 11),
  post('herb-front-post-b', 202, 745, 794, 9),
  rail('herb-front-b-top', [235,776], [287,796], 7, 817),
  rail('herb-front-b-bottom', [235,796], [287,818], 7, 822),
  post('herb-front-post-c', 232, 758, 810, 12),
  post('herb-front-post-d', 283, 777, 829, 11),
  rail('herb-front-c-top', [295,800], [355,815], 8, 847),
  rail('herb-front-c-bottom', [295,819], [355,838], 7, 851),
  post('herb-front-post-e', 295, 784, 838, 11),
  post('herb-front-post-f', 353, 796, 858, 13),
  rail('herb-front-d-top', [374,820], [448,839], 8, 868),
  rail('herb-front-d-bottom', [374,842], [448,858], 7, 872),
  post('herb-front-post-g', 367, 805, 864, 13),
  rail('herb-front-e-top', [455,840], [502,840], 8, 875),
  rail('herb-front-e-bottom', [455,860], [502,861], 7, 876),
  post('herb-front-post-h', 447, 824, 879, 13),
  post('herb-front-post-i', 500, 829, 877, 11),
  post('herb-front-post-j', 518, 822, 876, 14),
  rail('herb-east-a-top', [515,835], [572,806], 7, 849),
  rail('herb-east-a-bottom', [515,856], [572,827], 7, 851),
  post('herb-east-post-a', 538, 803, 852, 10),
  rail('herb-east-b-top', [572,806], [604,791], 6, 824),
  rail('herb-east-b-bottom', [572,827], [604,813], 6, 829),
  post('herb-east-post-b', 572, 786, 834, 9),
  post('herb-east-post-c', 603, 773, 823, 8),
  {
    id: 'south-lamp-left', feetY: 843,
    polygon: [[702,748],[712,731],[726,715],[740,731],[758,748],
      [751,784],[752,795],[762,834],[704,843],[705,792]],
  },
  {
    id: 'south-lamp-right', feetY: 842,
    polygon: [[991,741],[1002,722],[1018,707],[1033,726],[1049,741],
      [1042,777],[1040,788],[1050,833],[995,842],[995,789]],
  },
]);

/** Copy these source-coordinate patches from the cleaned painting onto the
 * approved painting. Both images use SOURCE_SIZE and the same camera.
 */
export const CLEAN_PATCHES = Object.freeze([
  {
    id: 'master-body',
    polygon: [[599,397],[621,397],[625,414],[633,439],[639,467],
      [639,496],[636,516],[589,521],[579,507],[576,483],
      [580,453],[587,428],[598,416]],
  },
  {
    id: 'master-shadow',
    polygon: [[501,505],[556,499],[589,501],[612,507],
      [613,520],[558,523],[519,519],[500,514]],
  },
  {
    id: 'female-body',
    polygon: [[363,653],[388,653],[395,678],[406,690],[414,716],
      [417,755],[400,764],[365,760],[359,744],[348,731],
      [342,711],[351,684]],
  },
  {
    id: 'female-tool',
    polygon: [[350,698],[362,703],[348,724],[340,741],
      [327,741],[328,730],[338,715]],
  },
  {
    id: 'female-shadow',
    polygon: [[351,744],[387,750],[420,757],[422,765],
      [392,773],[360,764],[348,755]],
  },
]);
