/** U-144: fixed collision content for the courtyard-v2 first-screen artwork. */
export const COURTYARD_MASTER_TERRAIN_VERSION='courtyard-master-terrain-2';
export const COURTYARD_MASTER_TERRAIN_V1='courtyard-master-terrain-1';
// The solid bamboo line lies within the posts' projected height. Metre points
// are calibrated from the image; they remain fixed for this content version.
const FENCE_LINE=[[15.87753333,38.80412371],[15.81372537,38.69915651],[15.75216349,38.59418932],[15.69273114,38.48922212],[15.6353197,38.38425492],[15.57982783,38.27928772],[15.52616082,38.17432052],[15.47423013,38.06935333],[15.42395282,37.96438613],[15.37525118,37.85941893],[15.32805228,37.75445173],[15.28228762,37.64948454],[15.23559156,37.54076851],[15.19032029,37.43205248],[15.14640959,37.32333646],[15.10379903,37.21462043],[15.06243171,37.1059044],[15.022254,36.99718838],[14.9832153,36.88847235],[14.94526788,36.77975633],[14.90836659,36.6710403],[14.87246876,36.56232427],[14.83753402,36.45360825],[14.80714155,36.34756996],[14.77752409,36.24153166],[14.74865239,36.13549337],[14.72049861,36.02945508],[14.68688295,35.86243386],[14.65078598,35.67195767],[14.61444388,35.48148148],[14.57312073,35.66666667],[14.53206862,35.85185185],[14.48900871,36.02061856],[14.43618723,36.12371134],[14.38205851,36.22680412],[14.32657343,36.32989691],[14.26968034,36.43298969],[14.21132497,36.53608247],[14.1514502,36.63917526],[14.08999591,36.74226804],[14.02689877,36.84536082],[13.85924193,36.94845361],[13.62678245,37.07216495],[13.40491291,37.19587629],[13.19292576,37.31958763],[12.99017514,37.44329897],[12.79607023,37.56701031],[12.61006959,37.69072165],[12.41407745,37.84977909],[12.22807037,38.00883652],[12.05130425,38.16789396],[11.84830044,38.3269514],[11.63567846,38.48600884],[11.42767498,38.64506627],[11.22414113,38.80412371],[11.21333333,39.15463918],[11.20301418,39.50515464],[11.29771279,39.71134021],[11.38995806,39.91752577],[11.51190476,40.2],[11.6547619,40.53333333],[11.79761905,40.86666667],[11.94047619,41.2],[12.05714286,41.53333333],[12.15510204,41.86666667],[12.25306122,42.2],[12.35102041,42.53333333],[12.44897959,42.86666667],[12.54693878,43.2],[12.64489796,43.53333333],[12.74285714,43.86666667],[12.8225,44.03375],[12.79928571,44.1875],[12.77607143,44.34125],[12.75285714,44.495],[12.71885346,44.61828125],[12.65762582,44.6759375],[12.5895639,44.73359375],[12.51345579,44.79125],[12.42778503,44.84890625],[12.33062856,44.9065625],[12.21951061,44.96421875],[12.09118881,45.021875],[11.96824681,45.07953125],[11.88780929,45.1371875],[11.81372679,45.19484375],[11.74527479,45.2525],[11.89020071,45.23],[12.09836066,45.2075],[12.45558739,45.185],[12.7862069,45.1625],[13.09308511,45.14],[13.37869063,45.1175],[13.64516129,45.095],[13.89435774,45.0725],[14.30643073,44.98025],[14.62980031,44.888],[14.88896576,44.79575],[15.10132159,44.7035],[15.27849928,44.61125],[15.57257143,44.384],[15.88514286,44.138],[16.27439614,43.88],[16.44829309,43.60666667],[16.63448276,43.33333333]];
// Short overlapping rectangles use the official spatial index and body radius.
const boxes=[];
for(let i=1;i<FENCE_LINE.length;i++){
 const a=FENCE_LINE[i-1],b=FENCE_LINE[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.15));
 for(let j=0;j<n;j++){
  const x=a[0]+(b[0]-a[0])*j/n,y=a[1]+(b[1]-a[1])*j/n,xx=a[0]+(b[0]-a[0])*(j+1)/n,yy=a[1]+(b[1]-a[1])*(j+1)/n,pad=.015;
  boxes.push(Object.freeze({left:Math.min(x,xx)-pad,right:Math.max(x,xx)+pad,top:Math.min(y,yy)-pad,bottom:Math.max(y,yy)+pad}));
 }
}
export const COURTYARD_MASTER_FENCES=Object.freeze(boxes.map((b,i)=>Object.freeze({id:`courtyard-master:fence:${i+1}`,label:'药田竹栏',kind:'solid',buildingId:'building:yunxiu:2',polygon:Object.freeze([[b.left,b.top],[b.right,b.top],[b.right,b.bottom],[b.left,b.bottom]].map(Object.freeze))})));
// The east-entry jar's visible base is art (599..626,752..765). Its fixed
// metre bounds contain the six traced base vertices; actor radius is shared
// with the official pathfinder. Version 1 retains its original fence content.
const jarBox=Object.freeze({left:15.6231884,right:15.90670554,top:40.13333333,bottom:41});
export const COURTYARD_MASTER_JAR=Object.freeze({id:'courtyard-master:entry-jar',label:'田口陶罐',kind:'solid',buildingId:'building:yunxiu:2',polygon:Object.freeze([[jarBox.left,jarBox.top],[jarBox.right,jarBox.top],[jarBox.right,jarBox.bottom],[jarBox.left,jarBox.bottom]].map(Object.freeze))});
const solids=Object.freeze([...COURTYARD_MASTER_FENCES,COURTYARD_MASTER_JAR]);
const collisionBoxes=[...boxes,jarBox];
export function courtyardTerrainSolids(version){
 return version===COURTYARD_MASTER_TERRAIN_VERSION?solids:version===COURTYARD_MASTER_TERRAIN_V1?COURTYARD_MASTER_FENCES:[];
}
const fieldBoundary=FENCE_LINE;
function outsideSouth(p){
 if(p.x<10.5||p.x>17.3||p.y<43||p.y>49)return false;
 let inside=false;
 for(let i=0,j=fieldBoundary.length-1;i<fieldBoundary.length;j=i++){
  const a=fieldBoundary[i],b=fieldBoundary[j];
  if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return !inside;
}
/** The bamboo enclosure's east passage is shared by all formal actor routes. */
export function courtyardPassage(from,to){
 const a=outsideSouth(from),b=outsideSouth(to);
 if(a===b)return null;
 const passage=[{x:17.5,y:44.5},{x:17.5,y:41.5}];
 return a?passage:passage.reverse();
}
export function courtyardTerrainPointClear(p,radius=.26){
 return Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&collisionBoxes.every(b=>Math.hypot(Math.max(b.left-p.x,0,p.x-b.right),Math.max(b.top-p.y,0,p.y-b.bottom))>=radius-1e-7);
}
export function courtyardTerrainSegmentClear(a,b,radius=.26){
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.025));
 for(let i=0;i<=n;i++)if(!courtyardTerrainPointClear({x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},radius))return false;
 return true;
}
export function validateCourtyardTerrainRecord(s){
 const record=s.spatial?.courtyardTerrain;
 if(record===undefined)return true;
 if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).some(key=>!['version','activatedAtTick'].includes(key))||![COURTYARD_MASTER_TERRAIN_VERSION,COURTYARD_MASTER_TERRAIN_V1].includes(record.version)||!Number.isSafeInteger(record.activatedAtTick)||record.activatedAtTick<0||record.activatedAtTick>s.worldTick)throw Error('山院首屏地形版本或启用记录异常，原存档保留。');
 const farm=s.buildingsById?.['building:yunxiu:2'];
 if(farm?.type!=='farm'||farm.level!==1||farm.transform?.x!==12||farm.transform?.y!==40)throw Error('山院首屏药田位置与地形版本不符，原存档保留。');
 return true;
}
