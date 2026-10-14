/** U-141: authored metre layout shared by simulation and presentation.
 * Planning coordinates describe the mountain domain. Local coordinates keep
 * every existing courtyard entity unchanged. Opening a render chunk grants no
 * navigation, construction, resources, or world time.
 */
export const DOMAIN_LAYOUT_VERSION = 'yunxiu-domain-layout-1';
export const DOMAIN_EXTENT_VERSION = 'yunxiu-domain-east-1';
const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
const rectangle = (x,y,width,height) => [[x,y],[x+width,y],[x+width,y+height],[x,y+height]];
export const originMetres = freeze({x:2952,y:2952});
export const planningBounds = freeze({x:0,y:0,width:6000,height:6000,source:'T-13',status:'planning'});
export const activeBounds = freeze({x:0,y:0,width:160,height:96});
export const initialOpenAreas = freeze([
  {id:'area:yunxiu:original-courtyard',zoneId:'Z-01',x:0,y:0,width:96,height:96,status:'open',polygon:rectangle(0,0,96,96)},
  {id:'area:yunxiu:east-approach',zoneId:'Z-01',x:90,y:38,width:36,height:12,status:'open',polygon:rectangle(90,38,36,12)},
  {id:'area:yunxiu:east-terrace',zoneId:'Z-02',x:120,y:30,width:36,height:40,status:'open',polygon:rectangle(120,30,36,40)}
]);
export const openedRoad = freeze({id:'road:yunxiu:east-approach',status:'open',fromZoneId:'Z-01',toZoneId:'Z-02',width:12,points:[{x:90,y:44},{x:126,y:44}],areaId:'area:yunxiu:east-approach'});
export const firstSite = freeze({id:'site:domain:east-residence-1',name:'东台门人居',zoneId:'Z-02',type:'house',x:132,y:40,width:6,height:6,reserveWidth:12,reserveHeight:12,maxLevel:3,entrance:{x:135,y:46.6},status:'open',areaId:'area:yunxiu:east-terrace'});
// The complement of the three open areas within activeBounds. These polygons
// are also real navigation barriers: a straight segment cannot cut a corner.
export const domainBarriers = freeze([
  {id:'domain:east-north-slope',label:'东侧未通山坡',kind:'slope',polygon:rectangle(96,0,24,38)},
  {id:'domain:east-south-slope',label:'东侧未通林坡',kind:'slope',polygon:rectangle(96,50,24,46)},
  {id:'domain:terrace-north',label:'东台北侧陡坡',kind:'slope',polygon:rectangle(120,0,36,30)},
  {id:'domain:terrace-south',label:'东台南侧崖缘',kind:'slope',polygon:rectangle(120,70,36,26)},
  {id:'domain:terrace-east',label:'东台外侧山崖',kind:'slope',polygon:rectangle(156,0,4,96)}
]);
const zone = (id,name,x,y,width,height,role) => ({id,name,status:'planning',role,polygon:rectangle(x,y,width,height),reservedAreas:[{id:`reserve:${id}:life`,polygon:rectangle(x+width*.2,y+height*.2,width*.6,height*.6),status:'planning'}]});
export const zones = freeze([
  zone('Z-01','主峰',2800,2720,270,600,'中枢、传承、接待与修行'),
  zone('Z-02','东侧住居',3070,2900,600,600,'住居、膳食、休养与日常研习'),
  zone('Z-03','西侧生产谷',1800,3000,800,700,'灵田、药田与公共储运'),
  zone('Z-04','近左分峰',1500,2000,650,650,'分峰生活与修行'),
  zone('Z-05','近右分峰',3800,2000,650,650,'分峰生活与修行'),
  zone('Z-06','远左分峰',1300,900,700,700,'分峰生活与传承'),
  zone('Z-07','远右分峰',4100,900,700,700,'分峰生活与传承')
]);
export const planningRoads = freeze([
  {id:'connection:Z01-Z02',from:'Z-01',to:'Z-02',points:[{x:3042,y:2996},{x:3078,y:2996},{x:3290,y:3090}],status:'planning',openRoadId:openedRoad.id},
  {id:'connection:Z01-Z03',from:'Z-01',to:'Z-03',points:[{x:2850,y:3070},{x:2690,y:3240},{x:2420,y:3290}],status:'planning'},
  {id:'connection:Z01-Z04',from:'Z-01',to:'Z-04',points:[{x:2850,y:2790},{x:2470,y:2540},{x:2060,y:2460}],status:'planning'},
  {id:'connection:Z01-Z05',from:'Z-01',to:'Z-05',points:[{x:3040,y:2790},{x:3460,y:2570},{x:3860,y:2460}],status:'planning'},
  {id:'connection:Z04-Z06',from:'Z-04',to:'Z-06',points:[{x:1760,y:2070},{x:1600,y:1840},{x:1690,y:1530}],status:'planning'},
  {id:'connection:Z05-Z07',from:'Z-05',to:'Z-07',points:[{x:4230,y:2060},{x:4400,y:1820},{x:4390,y:1530}],status:'planning'}
]);
export const SECT_DOMAIN = freeze({id:'domain:yunxiu',sceneId:'scene:yunxiu-courtyard',coordinateUnit:'metre',layoutVersion:DOMAIN_LAYOUT_VERSION,extentVersion:DOMAIN_EXTENT_VERSION,originMetres,planningBounds,activeBounds,initialOpenAreas,openedRoad,firstSite,sites:[firstSite],zones,planningRoads,chunkMetres:32});
export const domainPoint = ({x,y}) => ({x:x+originMetres.x,y:y+originMetres.y});
export const localPoint = ({x,y}) => ({x:x-originMetres.x,y:y-originMetres.y});
export function domainContains(point,radius=0) {
  const {x,y}=point||{};
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(radius)||radius<0||x<radius||y<radius||x>activeBounds.width-radius||y>activeBounds.height-radius)return false;
  return !domainBarriers.some(({polygon})=>{const [a,,b]=polygon,dx=Math.max(a[0]-x,0,x-b[0]),dy=Math.max(a[1]-y,0,y-b[1]);return dx===0&&dy===0||radius>0&&Math.hypot(dx,dy)<radius-1e-7;});
}
export const domainSiteAt = (type,x,y) => SECT_DOMAIN.sites.find(site=>site.type===type&&site.x===x&&site.y===y)||null;
