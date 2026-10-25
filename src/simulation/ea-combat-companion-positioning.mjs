/** T-COMBAT-REACH-POSITION-20261024. AI destinations, not body collision. */
import {combatCanStand,combatClearLine,combatPath,combatInRange} from './ea-combat-geometry.mjs';
import {chooseCombatTarget} from './ea-combat-targeting.mjs';
export const COMPANION_POSITIONING=Object.freeze({masterClearance:.9,peerClearance:.8,attackRadiusRatio:.8,supportRadius:1.25,detourMargin:.3});
const point=p=>({x:p.x,y:p.y}),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),identity=a=>a.personId||`actor:${a.id}`;
const length=(start,path)=>path.reduce((result,p,index)=>result+distance(index?path[index-1]:start,p),0);
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function leavesMasterClear(start,path,master){
 const clearance=COMPANION_POSITIONING.masterClearance;let from=start,inside=distance(start,master)<clearance-1e-8;
 for(const to of path){
  if(inside){if((from.x-master.x)*(to.x-from.x)+(from.y-master.y)*(to.y-from.y)<-1e-8||distance(to,master)+1e-8<distance(from,master))return false;inside=distance(to,master)<clearance-1e-8;}
  else if(segmentDistance(master,from,to)<clearance-1e-8)return false;
  from=to;
 }
 return !inside;
}
/** Each leg is still a real combatPath. Only NPC route preference avoids the master. */
export function companionRoute(actor,goal,master,geometry){
 const direct=combatPath(actor,goal,geometry);if(direct&&leavesMasterClear(actor,direct,master))return direct;
 const radius=COMPANION_POSITIONING.masterClearance+COMPANION_POSITIONING.detourMargin;
 const nodes=[point(actor),point(goal),...Array.from({length:8},(_,i)=>({x:master.x+Math.cos(i*Math.PI/4)*radius,y:master.y+Math.sin(i*Math.PI/4)*radius})).filter(p=>combatCanStand(p,geometry))];
 const costs=nodes.map(()=>Infinity),previous=nodes.map(()=>null),seen=new Set();costs[0]=0;
 while(seen.size<nodes.length){
  let at=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(at<0||costs[i]<costs[at]))at=i;
  if(at<0||!Number.isFinite(costs[at]))break;
  if(at===1){const legs=[];for(let i=1;i!==0;i=previous[i].from)legs.unshift(previous[i].path);return legs.flat();}
  seen.add(at);
  for(let i=1;i<nodes.length;i++)if(i!==at&&!seen.has(i)){
   const path=combatPath(nodes[at],nodes[i],geometry);if(!path||!leavesMasterClear(nodes[at],path,master))continue;
   const cost=costs[at]+length(nodes[at],path);if(cost<costs[i]-1e-8){costs[i]=cost;previous[i]={from:at,path};}
  }
 }
 return null;
}
function selectPosition(c,actor,target,rank,range,geometry,reserved,support,tactic){
 const master=c.player,center=support?master:target,side=rank%2?-1:1;
 const base=Math.atan2(master.y-target.y,master.x-target.x),offsets=support?[45,75,105,135,180,-45,-75]:[90,60,120,45,135,180,0,-90,-60,-120];
 const radius=support?COMPANION_POSITIONING.supportRadius:range*COMPANION_POSITIONING.attackRadiusRatio;
 for(const degrees of offsets){
  const angle=base+side*degrees*Math.PI/180,goal={x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius};
  if(!combatCanStand(goal,geometry)||distance(goal,master)<COMPANION_POSITIONING.masterClearance-1e-8||reserved.some(p=>distance(p,goal)<COMPANION_POSITIONING.peerClearance-1e-8))continue;
  if(c.allies.some(a=>a!==actor&&a.hp>0&&distance(a,goal)<COMPANION_POSITIONING.peerClearance-1e-8))continue;
  if(!support&&(!combatInRange(goal,target,range)||!combatClearLine(goal,target,geometry)||tactic==='guard'&&distance(goal,master)>2.5))continue;
  const route=companionRoute(actor,goal,master,geometry);if(route)return {goal,route};
 }
 return null;
}
/** Stable person ordering assigns opposite first choices, independent of array order. */
export function companionPositionPlans(c,{range,geometry,tacticFor=()=> 'focus'}={}){
 const ordered=c.allies.slice().sort((a,b)=>identity(a).localeCompare(identity(b))),plans=new Map(),reserved=[];
 for(const [rank,actor]of ordered.entries()){
  if(actor.hp<=0)continue;
  const tactic=tacticFor(actor)||'focus',target=chooseCombatTarget(c,actor,{preferredId:tactic==='focus'?c.selectedTargetId:null,anchor:tactic==='focus'?c.player:actor});
  if(!target){plans.set(actor,{tactic,target:null});continue;}
  const support=tactic==='rally'||tactic==='guard'&&(distance(actor,c.player)>2.5||distance(target,c.player)>4||distance(actor,c.player)<COMPANION_POSITIONING.masterClearance);
  let position=selectPosition(c,actor,target,rank,range,geometry,reserved,support,tactic),isSupport=support;
  if(!position&&tactic==='guard'){position=selectPosition(c,actor,target,rank,range,geometry,reserved,true,tactic);isSupport=true;}
  const peerFree=!c.allies.some(a=>a!==actor&&a.hp>0&&distance(a,actor)<COMPANION_POSITIONING.peerClearance-1e-8),masterFree=distance(actor,c.player)>=COMPANION_POSITIONING.masterClearance-1e-8;
  const arrived=position&&distance(actor,position.goal)<=range*(1-COMPANION_POSITIONING.attackRadiusRatio)+1e-8;
  const canAttack=!isSupport&&position&&masterFree&&peerFree&&arrived&&combatInRange(actor,target,range)&&combatClearLine(actor,target,geometry);
  plans.set(actor,{tactic,target,support:isSupport,canAttack:!!canAttack,...position});
  if(actor.pendingAttack||canAttack)reserved.push(point(actor));else if(position)reserved.push(position.goal);
 }
 return plans;
}
