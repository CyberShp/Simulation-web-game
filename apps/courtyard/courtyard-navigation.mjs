/** Execute long residential journeys through existing visible, physical ground. */
import {toArt,toWorld,artSegmentClear} from './courtyard-space.mjs';
import {scenicCanStand,scenicFindPath,scenicSweep} from '../../src/simulation/ea-scene-geometry.mjs';
import {metreWalkTarget} from '../../src/simulation/ea-sr-spatial.mjs';
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
    if(!artSegmentClear(a,b,options)||scenicSweep(state,start,point).blocked){valid=false;break;}
    let art=a;
    for(let j=1;j<=samples;j++){
     const t=j/samples,sample=toArt(start.x+(point.x-start.x)*t,start.y+(point.y-start.y)*t);
     if(!artSegmentClear(art,sample,options)){valid=false;break;}
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
 * Each segment stays within three metres and passes both terrain and walls.
 */
export function residentialMovementWaypoints(state,from,route,options){
 if(!options?.residences)return route.map(point=>({...point}));
 const points=[from,...route],world=points.map(point=>toWorld(point.x,point.y)),result=[];
 for(let start=0;start<points.length-1;){
  let far=start+1,length=distance(world[start],world[far]);
  if(length>3)return null;
  while(far+1<points.length&&length+distance(world[far],world[far+1])<=3){length+=distance(world[far],world[far+1]);far++;}
  let end=far;
  while(end>start&&(!artSegmentClear(points[start],points[end],options)||scenicSweep(state,world[start],world[end]).blocked))end--;
  if(end===start){
   const targets=world.slice(start+1,far+1).map((point,i)=>({point,index:start+1+i})).reverse(),join=physicalRouteJoin(state,world[start],targets,options);
   if(!join)return null;
   result.push(...join.points);start=join.end;continue;
  }
  result.push({...points[end]});start=end;
 }
 return result;
}

/** Start one public movement command from the current body position. Nearby
 * people may change an intermediate landing; the final business target stays
 * exact. Displaced landings and their next leg are checked from actual feet.
 */
export function commandMovementWaypoint(session,point,options,intermediate,issue,{recheck=false}={}){
 const state=session.state,from=state.master.scenic,requested=toWorld(point.x,point.y);
 const accepted=metreWalkTarget(state,from,requested);
 if(recheck||distance(accepted,requested)>1e-6){
  const path=scenicFindPath(state,from,accepted);
  const blocked=()=>({ok:false,error:'当前道路未能接续，请重新选点。'});
  if(!path)return blocked();
  let previous=from;
  for(const next of path){
   if(scenicSweep(state,previous,next).blocked)return blocked();
   const start=toArt(previous.x,previous.y),end=toArt(next.x,next.y);
   const count=Math.max(1,Math.ceil(distance(previous,next)/.05),Math.ceil(distance(start,end)/4));
   let art=start;
   for(let i=1;i<=count;i++){
    const t=i/count,point=toArt(previous.x+(next.x-previous.x)*t,previous.y+(next.y-previous.y)*t);
    if(!artSegmentClear(art,point,options))return blocked();
    art=point;
   }
   previous=next;
  }
 }
 const result=issue({type:'move',x:requested.x,y:requested.y});
 if(!result.ok)return result;
 const goal=session.state.master.scenic.goal;
 const world=intermediate&&goal&&distance(goal,accepted)<1e-6?{...goal}:requested;
 return{...result,waypoint:{...toArt(world.x,world.y),world,tick:session.state.worldTick,
  ...(intermediate&&distance(world,requested)>1e-6?{adjusted:true}:{})}};
}
