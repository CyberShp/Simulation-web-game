/** U-167 / 64 / T-22: fixed-camera north library image layers and shared projection. */
export const NORTH_LIBRARY_LAYOUT=Object.freeze({"x":836,"y":-907,"width":1672,"height":941,"logicalY":-941,"imageOffsetY":34});
export const NORTH_LIBRARY_IMAGES=Object.freeze({"complete":"north-library-complete-v6.png","empty":"north-library-empty-v1.png","construction":"north-library-construction-v1.png"});
export const NORTH_LIBRARY_SITE=Object.freeze({"id":"site:domain:gc-02","planId":"GC-02","type":"library","entrance":[780,541],"footprint":[[540,421],[1020,421],[1020,521],[844,521],[844,545],[716,545],[716,521],[540,521]],"standingPolygon":[[738,540],[812,540],[812,580],[738,580]],"buildingPolygon":[[440,391],[510,391],[512,345],[476,327],[464,307],[462,282],[475,277],[487,289],[528,283],[554,267],[568,232],[568,196],[580,184],[594,187],[602,208],[944,208],[949,189],[961,185],[977,195],[978,233],[992,268],[1035,287],[1069,278],[1084,289],[1080,311],[1067,329],[1028,345],[1030,462],[1068,471],[1082,523],[1066,535],[936,565],[843,561],[830,542],[718,542],[715,561],[607,565],[595,548],[440,532]],"stagePatches":{"complete":[[440,391],[510,391],[512,345],[476,327],[464,307],[462,282],[475,277],[487,289],[528,283],[554,267],[568,232],[568,196],[580,184],[594,187],[602,208],[944,208],[949,189],[961,185],[977,195],[978,233],[992,268],[1035,287],[1069,278],[1084,289],[1080,311],[1067,329],[1028,345],[1030,462],[1068,471],[1082,523],[1066,535],[936,565],[843,561],[830,542],[718,542],[715,561],[607,565],[595,548],[440,532]],"construction":[[439,500],[510,338],[543,310],[544,281],[564,281],[566,307],[678,307],[680,282],[699,282],[700,308],[835,308],[837,282],[857,282],[858,308],[972,308],[974,282],[992,283],[996,328],[1019,340],[1082,500],[1080,533],[936,565],[843,561],[830,542],[718,542],[715,561],[607,565],[595,548],[440,532]]},"feetY":541,"world":{"x":44,"y":-16},"maximumReserve":[[540,421],[1340,421],[1340,588],[540,588]],"door":{"top":[720,365],"bottom":[832,505],"netHeight":140}});
export const NORTH_LIBRARY_JOIN=Object.freeze({"image":"north-library-join-v3.png","x":836,"y":-400,"width":1672,"height":941,"feather":32,"polygons":[[[836,-295],[2508,-295],[2508,541],[1166,541],[1016,440],[1016,140],[836,90]]],"sceneryTop":-42,"sceneryBottom":32,"sceneryFeather":24});

export const NORTH_TILE = Object.freeze({x:836,y:-941,width:1672,height:941});
export const NORTH_SITE = Object.freeze({x:44,y:-16,type:'library'});
export const NORTH_DEPTH = Object.freeze([[-32,-941],[-24,-700],[-16,-486],[-10,-386],[-9.4,-366],[-8,-353],[-7.4,-333],[-6,-319],[-5.4,-299],[-3,-211]]);
const lerp=(a,b,t)=>a+(b-a)*t;
function interpolate(pairs,value){let i=0;while(i<pairs.length-2&&value>pairs[i+1][0])i++;const a=pairs[i],b=pairs[i+1];return lerp(a[1],b[1],(value-a[0])/(b[0]-a[0]));}
function inverseMonotone(fn,value,lo,hi){for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(fn(mid)<value)lo=mid;else hi=mid;}return (lo+hi)/2;}

/** Supply the complete current projection, including the east extensions.
 * Existing world y>=0 is delegated without arithmetic changes. North of that
 * boundary, x is monotone for each row and depth is monotone at a fixed art x.
 * This gives an ordered one-dimensional inverse rather than a 2-D root search.
 * Only the art strip [836,2508] has new negative-depth geometry; elsewhere the
 * previous projection remains available. Authorised terrain is a separate task.
 */
export function createNorthLibraryProjection(previousToArt,previousToWorld){
 const horizontal0=x=>previousToArt(x,0).x;
 const inverseCache=new Map();
 const inverse0=x=>{if(!inverseCache.has(x))inverseCache.set(x,inverseMonotone(horizontal0,x,-84,214));return inverseCache.get(x);};
 const left=inverse0(NORTH_TILE.x),right=inverse0(NORTH_TILE.x+NORTH_TILE.width);
 const rear=inverse0(1025),east=inverse0(2286);
 const horizontalTarget=[[left,836],[rear,1025],[44,1376],[54,2176],[east,2286],[right,2508]];
 const inStrip=x=>x>=836&&x<=2508;
 const boundary=x=>previousToArt(inverse0(x),0).y;
 // Keep the old columns through y=-3. Column blending happens only after
 // target depth is independent of art x, so the steep old seam at x1672..1673
 // cannot turn a northward metre step into a southward pixel step.
 function horizontal(x,y){if(x<=rear||x>=east)return horizontal0(x);const t=Math.min(1,Math.max(0,(-y-3)/2));return lerp(horizontal0(x),interpolate(horizontalTarget,x),t);}
 const edgeWeight=x=>Math.max(0,Math.min(1,(x-836)/189,(2508-x)/222));
 function depth(x,y){
  const baseX=inverse0(x),old=previousToArt(baseX,y).y;
  const target=interpolate([...NORTH_DEPTH,[0,previousToArt(baseX,0).y]],y);
  return lerp(old,target,edgeWeight(x));
 }
 function toArt(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  if(y>=0||x<left||x>right)return previousToArt(x,y);
  const ax=horizontal(x,y);return {x:ax,y:depth(ax,y)};
 }
 function toWorld(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  const old=previousToWorld(x,y);
  // The old inverse can round the exact seam by a few ulps. Return that exact
  // previous result for the seam as well as every existing non-negative row.
  if(!inStrip(x)||y>=boundary(x)-1e-10)return old;
  let lo=-32;while(depth(x,lo)>y&&lo>-1024)lo*=2;
  if(depth(x,lo)>y)return null;
  const wy=inverseMonotone(v=>depth(x,v),y,lo,0);
  return {x:inverseMonotone(v=>horizontal(v,wy),x,left,right),y:wy};
 }
 return {toArt,toWorld,boundary,horizontal,depth,worldStrip:{left,right},horizontalTarget};
}
