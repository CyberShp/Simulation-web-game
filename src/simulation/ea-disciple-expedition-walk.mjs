/** Local expedition steps use the courtyard's .53 m body separation and .12 m budget. */
import {personLocalSegmentClearSR} from './ea-sr-world.mjs';
export const EXPEDITION_BODY_SEPARATION=.53;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return distance(p,{x:a.x+dx*t,y:a.y+dy*t});}
function bodies(s,p){return Object.values(s.personsById).filter(q=>q!==p&&q.lifeStatus!=='dead'&&q.location?.kind==='local'&&q.location.sceneId===p.location.sceneId).map(q=>q.location);}
function clear(from,to,occupied){return occupied.every(q=>{
 const before=distance(from,q),after=distance(to,q);
 // Inherited overlap can only move monotonically out, never through a body.
 if(before<EXPEDITION_BODY_SEPARATION-1e-7)return after>before+1e-7&&(to.x-from.x)*(from.x-q.x)+(to.y-from.y)*(from.y-q.y)>=-1e-9;
 return segmentDistance(q,from,to)>=EXPEDITION_BODY_SEPARATION-1e-7;
});}
export function expeditionLandingClear(s,p,point,sceneId){return Object.values(s.personsById).filter(q=>q!==p&&q.lifeStatus!=='dead'&&q.location?.kind==='local'&&q.location.sceneId===sceneId).every(q=>distance(q.location,point)>=EXPEDITION_BODY_SEPARATION-1e-7);}
// Bounded quarter-metre search rejoins a nearby point of the existing route.
function detour(s,p,goal,occupied){
 const origin=p.location,queue=[{x:origin.x,y:origin.y}],parent=new Map([['0,0',null]]),nodes=new Map([['0,0',queue[0]]]);queue[0].key='0,0';
 const heading={x:goal.x-origin.x,y:goal.y-origin.y},right={x:-heading.y,y:heading.x};
 const directions=[[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,-1],[-1,1]].sort((a,b)=>(b[0]*right.x+b[1]*right.y)-(a[0]*right.x+a[1]*right.y));
 for(let i=0;i<queue.length&&i<625;i++){
  const at=queue[i];if(distance(at,goal)<=.36&&clear(at,goal,occupied)&&personLocalSegmentClearSR(s,p.personId,at,goal)){
   const path=[{...goal}];for(let n=at;parent.get(n.key)!==null;n=nodes.get(parent.get(n.key)))path.push({x:n.x,y:n.y});return path.reverse();
  }
  for(const [dx,dy] of directions){
   const [ix,iy]=at.key.split(',').map(Number),nx=ix+dx,ny=iy+dy,key=`${nx},${ny}`,next={x:origin.x+nx*.25,y:origin.y+ny*.25,key};
   if(parent.has(key)||Math.abs(nx)>10||Math.abs(ny)>10||!clear(at,next,occupied)||!personLocalSegmentClearSR(s,p.personId,at,next))continue;
   parent.set(key,at.key);nodes.set(key,next);queue.push(next);
  }
 }
 return null;
}
/** Mutates only this body's real step and route cursor; no extra world tick. */
export function advanceExpeditionWalk(s,p,j,route,{returning=false}={}){
 if(!route.length)return true;
 if(j.walkDetour?.phase!==j.phase)delete j.walkDetour;
 const occupied=bodies(s,p),at=p.location,det=j.walkDetour,target=det?.path[0]||route[returning?route.length-1:0],d=distance(at,target),n=Math.min(.12,d),next=d?{x:at.x+(target.x-at.x)*n/d,y:at.y+(target.y-at.y)*n/d}:{x:at.x,y:at.y};
 if(d>.001&&!clear(at,next,occupied)){
  delete j.walkDetour;
  const indices=returning?Array.from({length:route.length},(_,i)=>route.length-1-i):route.map((_,i)=>i);
  for(const index of indices){const goal=route[index],range=distance(at,goal);if(range>2.5)break;if(range<.6||!occupied.every(q=>distance(q,goal)>=EXPEDITION_BODY_SEPARATION))continue;
   const path=detour(s,p,goal,occupied);if(path){j.walkDetour={phase:j.phase,index,path};break;}
  }
  p.mind.reason='眼前通路有人，沿附近可行地面让行后接回原路。';return false;
 }
 if(det&&!personLocalSegmentClearSR(s,p.personId,at,next)){delete j.walkDetour;return false;}
 at.x=next.x;at.y=next.y;p.position={kind:'scene',sceneId:at.sceneId,x:at.x,y:at.y};
 if(!returning&&d>.001)j.valleyTrail.push({x:at.x,y:at.y});
 if(d<=(returning&&!det ? .01 : .12)){
  if(det){det.path.shift();if(!det.path.length){if(returning)route.splice(det.index);else route.splice(0,det.index+1);delete j.walkDetour;}}
  else if(returning)route.pop();else route.shift();
 }
 return !route.length;
}
export function validateExpeditionWalk(j,fail){
 const d=j.walkDetour;if(!d)return;
 if(!['exploring','scouting','valley-return'].includes(d.phase)||d.phase!==j.phase||!Number.isSafeInteger(d.index)||d.index<0||!Array.isArray(d.path)||!d.path.length||d.path.length>625||d.path.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))fail('历练局部让行路径');
 const route=d.phase==='valley-return'?j.valleyTrail:d.phase==='scouting'?j.scoutPath:j.valleyPath;if(!route||d.index>=route.length)fail('历练让行接回原路');
}
