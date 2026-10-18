/** Sample the candidate metre routes against surveyed, visible ground. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createCandidateProjection} from './audit-spatial-proposal.mjs';
import {RESIDENCES_WALK_POLYGONS,RESIDENCES_LAYOUT} from '../../../apps/courtyard/courtyard-residences-layout.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const proposal=JSON.parse(fs.readFileSync(path.join(dir,'spatial-proposal.json'))),survey=JSON.parse(fs.readFileSync(path.join(dir,'ground-and-join-survey.json'))),projection=createCandidateProjection();
const scaleX=1672/1670,radius=.26,step=.025;
const global=p=>[8360+p[0]*scaleX,p[1]],world=p=>projection.toWorld(...p),art=p=>projection.toArt(p.x,p.y);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a[0]-dx*t,p.y-a[1]-dy*t);};
const inside=(p,poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(segmentDistance(p,a,b)<1e-7)return true;if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const ground=survey.ground.map(g=>g.polygon.map(global));
const roads=survey.roads.flatMap(r=>r.polygons.map(poly=>poly.map(global)));
const stairs=survey.sites.flatMap(s=>[s.standingPolygon,s.stairsWalkPolygon].map(poly=>poly.map(global)));
const oldWalk=RESIDENCES_WALK_POLYGONS.map(poly=>poly.map(p=>[p[0]+RESIDENCES_LAYOUT.x,p[1]]));
const joinWalk=survey.join.roads.map(r=>r.globalWalkPolygon);
const walk=[...ground,...roads,...stairs,...oldWalk,...joinWalk];
const solids=survey.sites.flatMap(site=>site.solidFootprints.map(f=>({id:site.planId+':'+f.id,polygon:f.polygon.map(global)})));
const result={kind:'static visible-ground sampling',sourceHashes:{},radiusMetres:radius,segmentStepMetres:step,circleSamples:32,paths:[],plots:[],queues:[],failures:[],runtimeIntegrated:false};
for(const file of ['spatial-proposal.json','ground-and-join-survey.json',survey.source.ground.file,survey.source.join.file])result.sourceHashes[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,file))).digest('hex');
function footClear(p,polygons,{objects=true}={}){
 for(let n=0;n<=32;n++){const angle=n*Math.PI/16,q=n===32?p:{x:p.x+radius*Math.cos(angle),y:p.y+radius*Math.sin(angle)},a=art(q);if(!polygons.some(poly=>inside(a,poly)))return {reason:'outside-surveyed-ground',world:q,art:a};if(objects){const hit=solids.find(s=>inside(a,s.polygon));if(hit)return {reason:'inside-surveyed-solid',solid:hit.id,world:q,art:a};}}
 return null;
}
function pathCheck(id,points,{objects=true,polygons=walk}={}){
 let samples=0,firstFailure=null;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.max(1,Math.ceil(distance(a,b)/step));for(let j=0;j<=n;j++){const t=j/n,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},error=footClear(p,polygons,{objects});samples++;if(error&&!firstFailure)firstFailure={path:id,segment:i-1,centre:p,...error};}}
 if(firstFailure)result.failures.push(firstFailure);return {id,samples,passed:!firstFailure,world:points};
}
for(const road of survey.roads){let points=road.center.map(p=>world(global(p)));let limitedBoundary=false;
 if(road.id==='rescue'){const last=points.at(-1);points[points.length-1]={x:186+radius+.001,y:last.y};limitedBoundary=true;}
 if(road.id==='lower'){const last=points.at(-1);points[points.length-1]={x:214-radius-.001,y:last.y};limitedBoundary=true;}
 result.paths.push({...pathCheck('service:'+road.id,points),limitedBoundary});
}
for(const road of survey.join.roads)result.paths.push(pathCheck('join:'+road.id,road.globalCenter.map(world)));
const upperJoin=survey.join.roads.find(r=>r.id==='upper'),lowerJoin=survey.join.roads.find(r=>r.id==='lower');
result.paths.push(pathCheck('complete:residences-to-clinic',[...upperJoin.globalCenter.map(world),...[[280,464],[600,463],[815,466],[815,420],[815,386]].map(p=>world(global(p)))]));
result.paths.push(pathCheck('complete:residences-to-kitchen',[...lowerJoin.globalCenter.map(world),...[[280,812],[620,820],[620,803],[620,783]].map(p=>world(global(p)))]));
for(const site of proposal.sites){const size=10,x=site.world.x,y=site.world.y,points=[{x,y},{x:x+size,y},{x:x+size,y:y+size},{x,y:y+size},{x,y}];result.plots.push(pathCheck('maximum:'+site.planId,points,{objects:false,polygons:ground}));
 for(const level of site.queuePolicy.levels)for(let i=0;i<level.world.length;i++){const p={x:level.world[i][0],y:level.world[i][1]},error=footClear(p,walk);result.queues.push({site:site.planId,level:level.level,index:i,world:p,passed:!error});if(error)result.failures.push({queue:site.planId,level:level.level,index:i,...error});}
}
result.passed=!result.failures.length;
fs.writeFileSync(path.join(dir,'ground-and-join-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,paths:result.paths.map(p=>({id:p.id,passed:p.passed,samples:p.samples})),plots:result.plots.map(p=>({id:p.id,passed:p.passed,samples:p.samples})),queues:result.queues.length,failures:result.failures},null,2));
if(!result.passed)process.exitCode=1;
