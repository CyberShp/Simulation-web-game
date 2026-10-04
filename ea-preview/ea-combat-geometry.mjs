// One registered plane per existing painting. These are paved approach/court
// patches, not permission to walk across the whole illustration. Actor feet,
// hit ranges, warning circles, picking and collision use the same coordinates.
const fields = {
  legacy:{origin:{x:500,y:365},u:{x:55,y:9},v:{x:-25,y:29},spriteScale:1,obstacles:[]},
  'legacy-qixia':{origin:{x:670,y:375},u:{x:50,y:8},v:{x:-15,y:28},spriteScale:1,obstacles:[]},
  // Quarry is the narrow TOP of the foreground stone bridge. Its masonry face
  // is 60–100px lower and is never a floor. The previous broad rectangle covered
  // that facade; these anchors are taken from the enlarged atlas cell.
  quarry:{origin:{x:650,y:402},u:{x:36,y:9.3},v:{x:-5,y:5.5},spriteScale:.84,obstacles:[{id:'bridge-crates',name:'桥边货箱',kind:'crates',x:4.1,y:1.2,w:1,h:1.3}]},
  prison:{origin:{x:610,y:680},u:{x:18,y:-5},v:{x:9,y:7},spriteScale:.66,obstacles:[{id:'prison-stone',name:'牢前石堆',kind:'rubble',x:5,y:5.4,w:1.1,h:1.1}]},
  // Ambush on the empty dry approach, not on the painted wagons or water quay.
  supply:{origin:{x:637,y:752},u:{x:14,y:9.5},v:{x:-2,y:2},spriteScale:.66,obstacles:[{id:'supply-crates',name:'粮道货箱',kind:'crates',x:5,y:2,w:1.2,h:1.3}]},
  qixia:{origin:{x:670,y:375},u:{x:50,y:8},v:{x:-15,y:28},spriteScale:1,obstacles:[{id:'court-rubble',name:'残阵碎石',kind:'rubble',x:5.1,y:5.9,w:1.25,h:.95},{id:'court-stone',name:'断柱基座',kind:'rubble',x:9.6,y:1.1,w:.8,h:1}]}
};
export const COMBAT_FIELDS=Object.freeze(fields);
export const combatGeometryId=c=>c.geometryVersion===1?c.regionId:c.regionId==='qixia'?'legacy-qixia':'legacy';
export const COMBAT_BOUNDS=Object.freeze({left:.6,right:11.4,top:.6,bottom:7.4});
const margin=.2;
const within=(p,b=COMBAT_BOUNDS)=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom;
const box=(o,pad=margin)=>({left:o.x-pad,right:o.x+o.w+pad,top:o.y-pad,bottom:o.y+o.h+pad});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const field=id=>fields[id]||fields.qixia;
export function combatField(id){return {...field(id),width:12,height:8,bounds:{...COMBAT_BOUNDS},obstacles:field(id).obstacles.map(o=>({...o}))};}
export function battlePoint(x,y,id){const f=field(id);return {x:f.origin.x+f.u.x*x+f.v.x*y,y:f.origin.y+f.u.y*x+f.v.y*y};}
export function battleInverse(p,id){const f=field(id),x=p.x-f.origin.x,y=p.y-f.origin.y,det=f.u.x*f.v.y-f.u.y*f.v.x;return{x:(x*f.v.y-y*f.v.x)/det,y:(y*f.u.x-x*f.u.y)/det};}
export function combatCanStand(p,id){return within(p)&&!field(id).obstacles.some(o=>{const b=box(o);return p.x>b.left&&p.x<b.right&&p.y>b.top&&p.y<b.bottom;});}
function intersects(a,b,r){
  // Liang–Barsky segment clipping; touching the boundary is allowed, crossing
  // an obstacle interior is not. The same expanded box protects actor feet.
  const tiny=1e-7,dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;
  r={left:r.left+tiny,right:r.right-tiny,top:r.top+tiny,bottom:r.bottom-tiny};
  for(const [p,q] of [[-dx,a.x-r.left],[dx,r.right-a.x],[-dy,a.y-r.top],[dy,r.bottom-a.y]]){
    if(Math.abs(p)<1e-12){if(q<0)return false;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;
  }
  return hi>=0&&lo<=1;
}
export function combatClearLine(a,b,id,{movement=false}={}){return !field(id).obstacles.some(o=>intersects(a,b,box(o,movement?margin:0)));}
export function combatPath(start,end,id){
  if(!combatCanStand(start,id)||!combatCanStand(end,id))return null;
  if(combatClearLine(start,end,id,{movement:true}))return [{...end}];
  const nodes=[{...start},{...end}];
  for(const o of field(id).obstacles){const r=box(o,margin+.025);for(const p of [{x:r.left,y:r.top},{x:r.right,y:r.top},{x:r.right,y:r.bottom},{x:r.left,y:r.bottom}])if(combatCanStand(p,id))nodes.push(p);}
  const costs=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),seen=new Set();costs[0]=0;
  while(seen.size<nodes.length){let index=-1,best=Infinity;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&costs[i]<best){best=costs[i];index=i;}if(index<0)break;if(index===1){const result=[];for(let i=1;i>0;i=previous[i])result.unshift({...nodes[i]});return result;}seen.add(index);
    for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&combatClearLine(nodes[index],nodes[i],id,{movement:true})){const cost=best+dist(nodes[index],nodes[i]);if(cost<costs[i]){costs[i]=cost;previous[i]=index;}}
  }
  return null;
}
export function moveCombatActor(actor,target,speed,dt,id){
  const path=combatPath(actor,target,id);if(!path)return false;let budget=speed*dt;
  for(const goal of path){const length=dist(actor,goal);if(length>.00001&&actor.facing)actor.facing={x:(goal.x-actor.x)/length,y:(goal.y-actor.y)/length};if(length<=budget){actor.x=goal.x;actor.y=goal.y;budget-=length;}else{actor.x+=(goal.x-actor.x)/length*budget;actor.y+=(goal.y-actor.y)/length*budget;return false;}}
  return true;
}
export function dodgeEndpoint(start,end,id){
  // A dodge sweeps the intended line and stops before a wall; it cannot tunnel
  // through a crate just because its endpoint happens to be on the other side.
  let lo=0,hi=1;for(let n=0;n<24;n++){const t=(lo+hi)/2,p={x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t};if(combatCanStand(p,id)&&combatClearLine(start,p,id,{movement:true}))lo=t;else hi=t;}return{x:start.x+(end.x-start.x)*lo,y:start.y+(end.y-start.y)*lo};
}
