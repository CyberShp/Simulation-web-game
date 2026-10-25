// One registered plane per existing painting. These are paved approach/court
// patches, not permission to walk across the whole illustration. Actor feet,
// hit ranges, warning circles, picking and collision use the same coordinates.
export const VALLEY_COMBAT_V2=Object.freeze({
 id:'valley-open-v2',version:2,sceneId:'scene:valley',width:48,height:32,
 bounds:Object.freeze({left:.6,right:47.4,top:.6,bottom:31.4}),
 worldOrigin:Object.freeze({x:6,y:12}),worldSafePoint:Object.freeze({x:7,y:27}),
 approach:Object.freeze({x:18,y:36}),interactionRadius:9,
 exit:Object.freeze({id:'exit',name:'归院山道',x:1,y:15,radius:2,worldExitId:'exit:valley-yunxiu'}),
 source:'T-COMBAT-FIELD-20261025',movementMargin:.45,
 // Existing world objects, unchanged; rectangles are centred-object bounds.
 worldObstacles:Object.freeze([
  Object.freeze({id:'object:valley:herbs',name:'溪边药丛',kind:'resource',x:13,y:14.5,w:4,h:3}),
  Object.freeze({id:'object:valley:bridge',name:'石桥与旧路',kind:'bridge',x:27.5,y:21.5,w:7,h:3}),
  Object.freeze({id:'object:valley:cave',name:'听雨侧洞',kind:'cave',x:44,y:28.5,w:6,h:5})
 ])
});
const legacyExit=Object.freeze({id:'exit',name:'撤离出口',x:.7,y:4,radius:.7});
const legacySpawns=Object.freeze({enemy:{x:8.5,y:3,stepX:1,stepY:2},ally:{x:2,y:2,stepX:0,stepY:3}});
const fields = {
 [VALLEY_COMBAT_V2.id]:{...VALLEY_COMBAT_V2,projection:'world-metres',origin:VALLEY_COMBAT_V2.worldOrigin,u:{x:1,y:0},v:{x:0,y:1},spriteScale:1,
  obstacles:VALLEY_COMBAT_V2.worldObstacles.map(o=>({...o,x:o.x-VALLEY_COMBAT_V2.worldOrigin.x,y:o.y-VALLEY_COMBAT_V2.worldOrigin.y}))},
  legacy:{origin:{x:500,y:365},u:{x:55,y:9},v:{x:-25,y:29},spriteScale:1,obstacles:[]},
  'legacy-qixia':{origin:{x:670,y:375},u:{x:50,y:8},v:{x:-15,y:28},spriteScale:1,obstacles:[]},
  // Quarry is the narrow TOP of the foreground stone bridge. Its masonry face
  // is 60–100px lower and is never a floor. The previous broad rectangle covered
  // that facade; these anchors are taken from the enlarged atlas cell.
  quarry:{origin:{x:650,y:402},u:{x:36,y:9.3},v:{x:-5,y:5.5},spriteScale:.84,obstacles:[{id:'bridge-crates',name:'桥边货箱',kind:'crates',x:4.1,y:1.2,w:1,h:1.3}]},
  prison:{origin:{x:610,y:680},u:{x:18,y:-5},v:{x:9,y:7},spriteScale:.66,obstacles:[{id:'prison-stone',name:'牢前石堆',kind:'rubble',x:5,y:5.4,w:1.1,h:1.1}]},
  // Ambush on the empty dry approach, not on the painted wagons or water quay.
  supply:{origin:{x:637,y:752},u:{x:14,y:9.5},v:{x:-2,y:2},spriteScale:.66,obstacles:[{id:'supply-crates',name:'粮道货箱',kind:'crates',x:5,y:2,w:1.2,h:1.3}]},
  // T-COMBAT-PARTY-20261024: real outdoor prison forecourt, world origin (20,19).
  'prison-forecourt':{origin:{x:500,y:365},u:{x:55,y:9},v:{x:-25,y:29},spriteScale:1,obstacles:[]},
  qixia:{origin:{x:670,y:375},u:{x:50,y:8},v:{x:-15,y:28},spriteScale:1,obstacles:[{id:'court-rubble',name:'残阵碎石',kind:'rubble',x:5.1,y:5.9,w:1.25,h:.95},{id:'court-stone',name:'断柱基座',kind:'rubble',x:9.6,y:1.1,w:.8,h:1}]}
};
export const COMBAT_FIELDS=Object.freeze(fields);
// Independently surveyed visible floor outlines (1672×941 coordinates).
// These guard art registration, not just numerical projection round-tripping.
export const COMBAT_GROUND=Object.freeze({
  quarry:[[595,386],[1191,535],[1117,595],[558,456]],
  prison:[[590,633],[821,609],[940,689],[701,784],[551,733]],
  supply:[[620,744],[819,859],[804,910],[605,784]],
  qixia:[[520,355],[1200,360],[1360,650],[1090,730],[530,625]]
});
export function combatOnPaintedGround(p,id){const polygon=COMBAT_GROUND[id];if(!polygon)return true;let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if((yi>p.y)!==(yj>p.y)&&p.x<(xj-xi)*(p.y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
export const combatGeometryId=c=>c.geometryId||(c.geometryVersion===1?c.regionId:c.regionId==='qixia'?'legacy-qixia':'legacy');
export const COMBAT_BOUNDS=Object.freeze({left:.6,right:11.4,top:.6,bottom:7.4});
const margin=.2;
const within=(p,b=COMBAT_BOUNDS)=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&p.x>=b.left&&p.x<=b.right&&p.y>=b.top&&p.y<=b.bottom;
const box=(o,pad=margin)=>({left:o.x-pad,right:o.x+o.w+pad,top:o.y-pad,bottom:o.y+o.h+pad});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const combatInRange=(a,b,reach)=>dist(a,b)<=reach+1e-8;
const field=id=>fields[id]||fields.qixia;
export function combatField(id){const f=field(id);return {...f,width:f.width??12,height:f.height??8,bounds:{...(f.bounds||COMBAT_BOUNDS)},exit:{...(f.exit||legacyExit)},movementMargin:f.movementMargin??margin,obstacles:f.obstacles.map(o=>({...o}))};}
export function combatBounds(id){return {...(field(id).bounds||COMBAT_BOUNDS)};}
export function combatClamp(p,id){const b=field(id).bounds||COMBAT_BOUNDS;return {x:Math.max(b.left,Math.min(b.right,p.x)),y:Math.max(b.top,Math.min(b.bottom,p.y))};}
export function combatExit(id){return {...(field(id).exit||legacyExit)};}
export function combatRetreatReached(p,id){const exit=combatExit(id);return id===VALLEY_COMBAT_V2.id?dist(p,exit)<=exit.radius+1e-8:p.x<=1&&Math.abs(p.y-4)<.5;}
export function combatSpawn(index,side,id){const spawn=(field(id).spawns||legacySpawns)[side];return {x:spawn.x+index*spawn.stepX,y:spawn.y+index*spawn.stepY};}
export function battlePoint(x,y,id){const f=field(id);return {x:f.origin.x+f.u.x*x+f.v.x*y,y:f.origin.y+f.u.y*x+f.v.y*y};}
export function battleInverse(p,id){const f=field(id),x=p.x-f.origin.x,y=p.y-f.origin.y,det=f.u.x*f.v.y-f.u.y*f.v.x;return{x:(x*f.v.y-y*f.v.x)/det,y:(y*f.u.x-x*f.u.y)/det};}
export function combatCanStand(p,id){const f=field(id);return within(p,f.bounds||COMBAT_BOUNDS)&&!f.obstacles.some(o=>{const b=box(o,f.movementMargin??margin);return p.x>b.left&&p.x<b.right&&p.y>b.top&&p.y<b.bottom;});}
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
export function combatClearLine(a,b,id,{movement=false}={}){const f=field(id),pad=movement?(f.movementMargin??margin):0;return !f.obstacles.some(o=>intersects(a,b,box(o,pad)));}
export function combatPath(start,end,id){
  if(!combatCanStand(start,id)||!combatCanStand(end,id))return null;
  if(combatClearLine(start,end,id,{movement:true}))return [{...end}];
  const nodes=[{...start},{...end}];
  for(const o of field(id).obstacles){const r=box(o,(field(id).movementMargin??margin)+.025);for(const p of [{x:r.left,y:r.top},{x:r.right,y:r.top},{x:r.right,y:r.bottom},{x:r.left,y:r.bottom}])if(combatCanStand(p,id))nodes.push(p);}
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
