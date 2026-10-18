/** Candidate-only kitchen furniture/seat audit; no runtime state is changed. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {spatialPrefab,polygonContains} from '../../../src/simulation/ea-sr-spatial.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const proposal=JSON.parse(fs.readFileSync(path.join(dir,'spatial-proposal.json'),'utf8'));
const kitchen=proposal.sites.find(s=>s.type==='kitchen');
const radius=.26,step=.5;
const rect=([x,y,w,h])=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
function routeRoom(prefab,extras,occupied,target){
 const polygons=[...prefab.walls,...prefab.furniture.map(f=>f.polygon),...extras.map(f=>rect(f.rect))];
 const clear=p=>p.x>=radius&&p.x<=prefab.width-radius&&p.y>=radius&&p.y<=prefab.height+.7&&!polygons.some(poly=>polygonContains(p,poly,radius))&&!occupied.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<2*radius-1e-9);
 const line=(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/.025);for(let i=0;i<=n;i++){const t=n?i/n:0;if(!clear({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}))return false;}return true;};
 const from=prefab.access;if(!clear(from)||!clear(target))return null;
 const cols=Math.round(prefab.width/step)+1,rows=Math.ceil((prefab.height+.7)/step)+1,key=(x,y)=>y*cols+x;
 const pos=k=>({x:(k%cols)*step,y:Math.floor(k/cols)*step});
 const start=key(Math.round(from.x/step),Math.round(from.y/step)),queue=[start],prev=new Map([[start,null]]),valid=new Map(),isValid=k=>{if(!valid.has(k))valid.set(k,clear(pos(k)));return valid.get(k);};
 for(let q=0;q<queue.length;q++){
  const k=queue[q],p=pos(k);
  if(Math.hypot(p.x-target.x,p.y-target.y)<=step*1.5&&line(p,target)){const route=[target];let at=k;while(at!==null){route.push(pos(at));at=prev.get(at);}route.reverse();assert(line(from,route[0]));return [from,...route];}
  const x=k%cols,y=Math.floor(k/cols);
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=cols||ny<0||ny>=rows)continue;const nk=key(nx,ny);if(prev.has(nk)||!isValid(nk)||!line(p,pos(nk)))continue;prev.set(nk,k);queue.push(nk);}
 }
 return null;
}
const result={kind:'proposed service furniture geometry',bodyRadiusMetres:radius,gridMetres:step,sweepStepMetres:.025,rooms:[],limitation:'Candidate sampler uses current prefab walls/furniture plus proposed stove/tables and occupied body circles. Runtime implementation and simultaneous movement remain pending.'};
for(const layout of kitchen.serviceLayoutByLevel){
 const prefab=spatialPrefab({type:'kitchen',level:layout.level,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1'});
 const slots=[...prefab.slots.filter(s=>s.kind==='work').map(s=>({suffix:s.suffix,kind:s.kind,position:s.position})),...layout.additionalSlots.map(s=>({suffix:s.suffix,kind:s.kind,position:{x:s.local[0],y:s.local[1]}}))];
 assert.equal(slots.filter(s=>s.kind==='eat').length,4*layout.level);
 const paths=[];
 for(const slot of slots){const occupied=slots.filter(other=>other!==slot).map(s=>s.position),route=routeRoom(prefab,layout.additionalFurniture,occupied,slot.position);assert.ok(route,`L${layout.level} ${slot.suffix} with other seats and stove occupied`);let length=0;for(let i=1;i<route.length;i++)length+=Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y);paths.push({slotId:slot.suffix,position:slot.position,allOtherStationsOccupied:true,lengthMetres:length,samplePoints:route.length});}
 result.rooms.push({level:layout.level,width:prefab.width,height:prefab.height,seats:layout.seatCount,cookingStations:2,paths,passed:true});
}
fs.writeFileSync(path.join(dir,'service-room-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.rooms.map(r=>({level:r.level,seats:r.seats,cookingStations:r.cookingStations,paths:r.paths.length,passed:r.passed})),null,2));
