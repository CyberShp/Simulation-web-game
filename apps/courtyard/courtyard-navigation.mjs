/** Execute long residential journeys through existing visible, physical ground. */
import {toArt,toWorld,routeArt,artSegmentClear,isArtWalkable} from './courtyard-space.mjs';
import {scenicCanStand,scenicFindPath,scenicSweep} from '../../src/simulation/ea-scene-geometry.mjs';
import {metreWalkTarget,visibleBodyPointClear,visibleBodyRouteClear,visibleBodyWalkPath} from '../../src/simulation/ea-sr-spatial.mjs';
import {domainNorthLibraryEnabled} from '../../src/simulation/ea-sect-domain.mjs';

// The measured body is the shared .26 m / sixteen-point visible-ground rule
// used by the simulation and the desktop observer. It is defined on the north
// body band; indoor floors and the 1.4 m door threshold stay exempt. Outside
// that band the painted foot centre remains the measured standard.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// Painted routes know the ground; completed buildings also have physical solids.
// Join the same nearby route through the existing body pathfinder, then check
// its actual world segments against the painted ground before issuing commands.
function physicalRouteJoin(state,from,targets,options){
 for(const target of targets){
  if(!scenicCanStand(state,target.point))continue;
  const path=scenicFindPath(state,from,target.point);
  if(!path?.length||distance(path.at(-1),target.point)>1e-6)continue;
  let previous=from,valid=true;const result=[];
  for(const next of path){
   if(scenicSweep(state,previous,next).blocked){valid=false;break;}
   const count=Math.max(1,Math.ceil(distance(previous,next)/3));
   for(let i=1;i<=count;i++){
    const point={x:previous.x+(next.x-previous.x)*i/count,y:previous.y+(next.y-previous.y)*i/count},start=i===1?previous:toWorld(result.at(-1).x,result.at(-1).y);
    const a=toArt(start.x,start.y),b=toArt(point.x,point.y),samples=Math.max(1,Math.ceil(distance(start,point)/.05),Math.ceil(distance(a,b)/4));
    if(!artSegmentClear(a,b,options)||scenicSweep(state,start,point).blocked||!visibleBodyRouteClear(state,start,[point])){valid=false;break;}
    let art=a;
    for(let j=1;j<=samples;j++){
     const t=j/samples,sample=toArt(start.x+(point.x-start.x)*t,start.y+(point.y-start.y)*t),world={x:start.x+(point.x-start.x)*t,y:start.y+(point.y-start.y)*t};
     if(!artSegmentClear(art,sample,options)||!visibleBodyPointClear(state,world)){valid=false;break;}
     art=sample;
    }
    if(!valid)break;
    result.push(b);
   }
   if(!valid)break;
   previous=next;
  }
  if(valid)return {end:target.index,points:result};
 }
 return null;
}

/** Rendering routes contain small samples for pixel-ground checking. A public
 * body command can cover several samples on one clear segment; this preserves
 * the simulation's walking speed instead of waiting for a UI pump per sample.
 * Each segment stays within three metres and passes terrain, walls, and the
 * measured body. Straight compaction must not cut a corner that the sampled
 * path avoided, so a leg that would lose body clearance shrinks to a nearer
 * sample instead of producing a body-over-edge command.
 */
export function residentialMovementWaypoints(state,from,route,options){
 if(!options?.residences)return route.map(point=>({...point}));
 const points=[from,...route],world=points.map(point=>toWorld(point.x,point.y)),result=[];
 for(let start=0;start<points.length-1;){
  let far=start+1,length=distance(world[start],world[far]);
  if(length>3)return null;
  while(far+1<points.length&&length+distance(world[far],world[far+1])<=3){length+=distance(world[far],world[far+1]);far++;}
  let end=far;
  while(end>start&&(!artSegmentClear(points[start],points[end],options)||scenicSweep(state,world[start],world[end]).blocked||!visibleBodyRouteClear(state,world[start],[world[end]])))end--;
  if(end===start){
   const targets=world.slice(start+1,far+1).map((point,i)=>({point,index:start+1+i})).reverse(),join=physicalRouteJoin(state,world[start],targets,options);
   if(!join)return null;
   result.push(...join.points);start=join.end;continue;
  }
  result.push({...points[end]});start=end;
 }
 return result;
}

// The measured body band changes at x18/47.62 and y1/34. A narrow edge strip
// can sit between two 5 cm samples, so every crossing of a band boundary is
// checked at the boundary and one centimetre either side before a leg is issued.
const BAND_EDGES={x:[18,47.62],y:[1,34]};
function bandCrossings(a,b){
 const ts=[],len=distance(a,b);if(len<1e-9)return ts;
 for(const value of BAND_EDGES.x){const t=(value-a.x)/(b.x-a.x);if(t>.001&&t<.999&&(a.x-value)*(b.x-value)<0)ts.push(t);}
 for(const value of BAND_EDGES.y){const t=(value-a.y)/(b.y-a.y);if(t>.001&&t<.999&&(a.y-value)*(b.y-value)<0)ts.push(t);}
 const fine=.01/len;return ts.flatMap(t=>[t-fine,t,t+fine]).filter(t=>t>0&&t<1);
}

/** The command's actual straight path, checked at 5 cm against the painted
 * ground and the shared measured body, plus explicit band-edge crossings. The
 * kind separates a broken route from a landing that is itself over an edge. */
function verifiedPath(state,from,to,options){
 const path=scenicFindPath(state,from,to);
 if(!path?.length)return {ok:false,kind:'path'};
 let previous=from;
 for(const next of path){
  if(scenicSweep(state,previous,next).blocked)return {ok:false,kind:'path'};
  const start=toArt(previous.x,previous.y),end=toArt(next.x,next.y);
  const count=Math.max(1,Math.ceil(distance(previous,next)/.05),Math.ceil(distance(start,end)/4));
  let art=start;
  for(let i=1;i<=count;i++){
   const t=i/count,world={x:previous.x+(next.x-previous.x)*t,y:previous.y+(next.y-previous.y)*t},point=toArt(world.x,world.y);
   if(!artSegmentClear(art,point,options))return {ok:false,kind:'art',sample:world};
   if(!visibleBodyPointClear(state,world))return {ok:false,kind:'body',sample:world};
   art=point;
  }
  for(const t of bandCrossings(previous,next)){
   const world={x:previous.x+(next.x-previous.x)*t,y:previous.y+(next.y-previous.y)*t},point=toArt(world.x,world.y);
   if(!isArtWalkable(point.x,point.y,options))return {ok:false,kind:'art',sample:world};
   if(!visibleBodyPointClear(state,world))return {ok:false,kind:'body',sample:world};
  }
  previous=next;
 }
 return {ok:true,path};
}

/** The one inherited off-ground stance may use the simulation's bounded
 * recovery. Its first legal sample is the handoff point: before that the
 * prefix belongs to the inherited stance, but from that sample onward both the
 * painted centre and the measured body must stay legal through the landing. */
function recoveryWalkClear(state,from,target,options){
 const path=visibleBodyWalkPath(state,from,target);
 if(!path?.length)return null;
 const landing=path[0],art=toArt(landing.x,landing.y);
 if(!isArtWalkable(art.x,art.y,options))return null;
 const count=Math.max(1,Math.ceil(distance(from,landing)/.05));let legal=false;
 for(let i=0;i<=count;i++){
  const p={x:from.x+(landing.x-from.x)*i/count,y:from.y+(landing.y-from.y)*i/count},point=toArt(p.x,p.y),body=visibleBodyPointClear(state,p);
  if(legal&&!body)return null;
  if(body){if(!isArtWalkable(point.x,point.y,options))return null;legal=true;}
 }
 if(!legal)return null;
 let at=landing;
 for(const next of path.slice(1)){
  if(scenicSweep(state,at,next).blocked||!artSegmentClear(toArt(at.x,at.y),toArt(next.x,next.y),options)||!visibleBodyRouteClear(state,at,[next]))return null;
  at=next;
 }
 return distance(at,target)<=1e-6?path:null;
}

/** A narrow body edge can sit between samples while the route itself is mostly
 * clear. Search a small local offset for a bridge that is reachable from the
 * real feet and still reaches the intended landing with the same full-body
 * checks; the public route continues from that legal bridge. */
function bodyBridge(state,from,target,at,options){
 const base=at||target;let best=null,bestScore=Infinity;
 for(let dx=-.35;dx<=.3501;dx+=.05)for(let dy=-.35;dy<=.3501;dy+=.05){
  const p={x:base.x+dx,y:base.y+dy},first=distance(from,p),second=distance(p,target);
  if(first<.1||second<.05)continue;
  if(first+second>distance(from,target)+1.2)continue;
  if(!isArtWalkable(toArt(p.x,p.y).x,toArt(p.x,p.y).y,options)||!visibleBodyPointClear(state,p))continue;
  if(!verifiedPath(state,from,p,options).ok||!verifiedPath(state,p,target,options).ok)continue;
  if(first+second<bestScore){bestScore=first+second;best=p;}
 }
 return best;
}

/** The interface stops within 8 cm of a leg target. At a corner that inherited
 * offset can make the next straight leg clip the inside edge even though the
 * sampled route did not. Advance to the farthest painted point of this leg that
 * the real feet can still reach directly; the next route point then starts from
 * a legal approach instead of asking the player to stop exactly on a corner. */
function paintedDetour(state,from,target,options){
 const painted=routeArt(toArt(from.x,from.y),toArt(target.x,target.y),options);
 if(!painted?.length)return null;
 let best=null;
 for(const point of painted){
  const accepted=metreWalkTarget(state,from,toWorld(point.x,point.y));
  if(distance(accepted,from)<.1)continue;
  if(verifiedPath(state,from,accepted,options).ok)best=accepted;
 }
 return best;
}

/** Start one public movement command from the current body position. Nearby
 * people may change an intermediate landing; the final business target stays
 * exact. The accepted landing and every 5 cm path sample keep the shared
 * measured body. A missing or painted-ground path keeps the route message; a
 * measured-body failure names the body, so the two causes stay distinguishable.
 */
export function commandMovementWaypoint(session,point,options,intermediate,issue,{recheck=false}={}){
 const state=session.state,from=state.master.scenic,requested=toWorld(point.x,point.y);
 const accepted=metreWalkTarget(state,from,requested);
 const blockedPath=()=>({ok:false,error:'当前道路未能接续，请重新选点。'});
 const blockedBody=()=>({ok:false,error:'当前落点身体会越出可见地面，请重新选点。'});
 const center=toArt(accepted.x,accepted.y);
 if(!isArtWalkable(center.x,center.y,options))return blockedPath();
 if(!visibleBodyPointClear(state,accepted))return blockedBody();
 // The inherited off-ground stance is the only place where the measured body
 // starts illegal. The shared bounded recovery owns that prefix; once it hands
 // over the first legal sample, the app still checks the painted route and body.
 if(!visibleBodyPointClear(state,from)&&domainNorthLibraryEnabled(state.spatial?.northLibrary?.version)){
  if(!recoveryWalkClear(state,from,accepted,options))return blockedBody();
  const recovered=issue({type:'move',x:requested.x,y:requested.y});
  if(!recovered.ok)return recovered;
  const goal=session.state.master.scenic.goal,world=goal&&distance(goal,accepted)<1e-6?{...goal}:accepted;
  return{...recovered,waypoint:{...toArt(world.x,world.y),world,tick:session.state.worldTick,recovered:true,
   ...(distance(world,requested)>1e-6?{adjusted:true}:{})}};
 }
 const direct=verifiedPath(state,from,accepted,options);
 if(!direct.ok){
  if(intermediate&&direct.kind!=='path'){
   const detour=bodyBridge(state,from,accepted,direct.sample,options)||paintedDetour(state,from,accepted,options);
   if(detour){
    const issued=issue({type:'move',x:detour.x,y:detour.y});
    if(!issued.ok)return issued;
    const goal=session.state.master.scenic.goal;
    const world=goal&&distance(goal,detour)<1e-6?{...goal}:detour;
    return{...issued,waypoint:{...toArt(world.x,world.y),world,tick:session.state.worldTick,adjusted:true}};
   }
  }
  return direct.kind==='body'?blockedBody():blockedPath();
 }
 const result=issue({type:'move',x:requested.x,y:requested.y});
 if(!result.ok)return result;
 const goal=session.state.master.scenic.goal;
 const world=intermediate&&goal&&distance(goal,accepted)<1e-6?{...goal}:requested;
 return{...result,waypoint:{...toArt(world.x,world.y),world,tick:session.state.worldTick,
  ...(intermediate&&distance(world,requested)>1e-6?{adjusted:true}:{})}};
}
