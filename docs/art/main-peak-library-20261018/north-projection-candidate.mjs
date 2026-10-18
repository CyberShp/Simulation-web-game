/** T-LIB-SPACE-01: a document-only candidate. No runtime module imports this file. */
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
export function createNorthCandidateProjection(previousToArt,previousToWorld){
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
