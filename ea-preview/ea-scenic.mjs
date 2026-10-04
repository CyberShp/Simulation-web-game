import {point,findPath,sweep,canStand,distance,LANDMARKS} from '../yunxiu-courtyard/navigation.mjs?v=ea-110-handoff4';

export const FACILITY_AREAS={hall:'main',house:'main',library:'main',watchtower:'gate',farm:'herbs',granary:'herbs',well:'herbs',lumber:'workshop',workshop:'workshop',quarry:'works',meditation:'meditation',alchemy:'kitchen',clinic:'kitchen',kitchen:'kitchen'};
export const areaPoint=id=>point(LANDMARKS.find(l=>l.id===id)?.node||'centre');
export const appearance=id=>id==='master'?0:1+((Number(id)-1)%5);
export function scenicPosition(master){return master.scenic||{...point('centre'),path:[],steps:0,facing:1,back:false};}
export function startScenicWalk(master,goal){
 const a=scenicPosition(master),path=findPath(a,goal);if(!path)return false;
 master.scenic={...a,path};master.path=[];master.action=path.length?'walk':'rest';master.learning=null;master.teaching=null;return true;
}
export function advanceScenic(actor,budget){
 let used=0;while(actor.path.length&&budget>.001){const target=actor.path[0],d=distance(actor,target);if(d<.001){actor.path.shift();continue;}
 const step=Math.min(budget,d),next={x:actor.x+(target.x-actor.x)*step/d,y:actor.y+(target.y-actor.y)*step/d},moved=sweep(actor,next);
 if(moved.blocked)throw Error('山道路径越过通行边界。');actor.facing=next.x<actor.x?-1:1;actor.back=next.y<actor.y-1;actor.x=next.x;actor.y=next.y;actor.steps=(actor.steps||0)+step;budget-=step;used+=step;if(step>=d-.001)actor.path.shift();
 }return used;
}
export function validateScenic(a){
 if(a===undefined||a===null)return true;
 if(!canStand(a)||!Number.isFinite(a.steps)||a.steps<0||![1,-1].includes(a.facing)||typeof a.back!=='boolean'||!Array.isArray(a.path)||a.path.length>80)return false;
 let p=a;for(const next of a.path){if(!Number.isFinite(next.x)||!Number.isFinite(next.y)||sweep(p,next).blocked)return false;p=next;}return true;
}
// Combat and exploration share one registered open courtyard plane. Its whole
// logical rectangle lies inside the painted paving, away from walls and stairs.
export const arenaPoint=(x,y)=>({x:500+55*x-25*y,y:365+9*x+29*y});
export const arenaInverse=p=>{const a=p.x-500,b=p.y-365;return{x:(29*a+25*b)/1820,y:(55*b-9*a)/1820};};
