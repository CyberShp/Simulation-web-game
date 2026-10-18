/** Documentation audit: pure candidate projection and isolated room geometry.
 * Run: node docs/art/east-services-20261018/audit-spatial-proposal.mjs
 * Writes only spatial-audit.json beside this script. Imports do not enable terrain.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {toArt as currentToArt,toWorld as currentToWorld} from '../../../apps/courtyard/courtyard-space.mjs';
import {RESIDENCES_PROJECTION_CANDIDATE} from '../../../apps/courtyard/courtyard-residences-layout.mjs';
import {spatialPrefab,meterFindPath,meterCanStand,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const proposal=JSON.parse(fs.readFileSync(path.join(dir,'spatial-proposal.json'),'utf8'));
const scaleX=proposal.source.logicalSize[0]/proposal.source.nativeSize[0];
const origin=proposal.source.artOrigin;
const clamp=v=>Math.max(0,Math.min(1,v));
const interpolate=(pairs,v)=>{let i=0;while(i<pairs.length-2&&v>pairs[i+1][0])i++;const [a,b]=pairs[i],[c,d]=pairs[i+1];return b+(d-b)*(v-a)/(c-a);};
const globalArt=p=>({x:origin[0]+p[0]*scaleX,y:origin[1]+p[1]});
const nativeArt=p=>[ (p.x-origin[0])/scaleX,p.y-origin[1] ];
export function createCandidateProjection({toArt=currentToArt,toWorld=currentToWorld}={}) {
 const config=proposal.projection;
 const horizontal=y=>{const [a,b]=config.horizontalNativeColumns,t=clamp((y-a.worldY)/(b.worldY-a.worldY));return a.anchors.map(([x,px],i)=>[x,origin[0]+(px+(b.anchors[i][1]-px)*t)*scaleX]);};
 const transition=config.transitionNativeX.map(x=>origin[0]+x*scaleX);
 const depth=(x,y)=>{const t=clamp((x-transition[0])/(transition[1]-transition[0])),old=toArt(config.delegateWorldXThrough,y).y;return old+(interpolate(config.depth,y)-old)*t;};
 const depthKeys=[...new Set([...config.depth,...RESIDENCES_PROJECTION_CANDIDATE.depth].map(p=>p[0]))].sort((a,b)=>a-b);
 return {
  toArt(x,y){if(x<=config.delegateWorldXThrough)return toArt(x,y);const ax=interpolate(horizontal(y),x);return {x:ax,y:depth(ax,y)};},
  toWorld(x,y){if(x<=config.delegateArtXThrough)return toWorld(x,y);const wy=interpolate(depthKeys.map(w=>[depth(x,w),w]),y);return {x:interpolate(horizontal(wy).map(([w,a])=>[a,w]),x),y:wy};}
 };
}
const candidate=createCandidateProjection();
const toWorldNative=p=>candidate.toWorld(...Object.values(globalArt(p)));
const worldDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rect=(x,y,size)=>[[x,y],[x+size,y],[x+size,y+size],[x,y+size]];
const pointInRect=(p,r,pad=0)=>p.x>=r.x-pad&&p.x<=r.x+r.width+pad&&p.y>=r.y-pad&&p.y<=r.y+r.height+pad;
const result={kind:'documentation-only spatial audit',sourceHashes:{},checks:[],levels:[],roads:[],joins:[],pending:[]};
for(const name of ['spatial-proposal.json',proposal.source.complete,proposal.source.empty,'candidate-measurements.json','../../../apps/courtyard/courtyard-space.mjs','../../../apps/courtyard/courtyard-residences-layout.mjs','../../../src/simulation/ea-sr-spatial.mjs','../../../src/simulation/ea-sect-domain.mjs','../../../src/simulation/ea-building-grid.mjs'])result.sourceHashes[name]=crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex');
let oldSamples=0;
for(let x=-66;x<=186;x+=2)for(let y=0;y<=96;y+=2){const a=currentToArt(x,y);assert.deepEqual(candidate.toArt(x,y),a);assert.deepEqual(candidate.toWorld(a.x,a.y),currentToWorld(a.x,a.y));oldSamples++;}
result.checks.push({name:'old projection delegated exactly',samples:oldSamples,passed:true});
let newSamples=0,maxError=0;
for(let x=186.25;x<=214;x+=.25)for(let y=24;y<=82;y+=.25){const p={x,y},a=candidate.toArt(x,y),w=candidate.toWorld(a.x,a.y),e=worldDistance(p,w);maxError=Math.max(maxError,e);assert.ok(e<1e-10);newSamples++;}
result.checks.push({name:'new projection round trip',samples:newSamples,maxErrorMetres:maxError,passed:true});
for(const column of proposal.projection.horizontalNativeColumns)for(let i=1;i<column.anchors.length;i++)assert.ok(column.anchors[i][0]>column.anchors[i-1][0]&&column.anchors[i][1]>column.anchors[i-1][1]);
for(let i=1;i<proposal.projection.depth.length;i++)assert.ok(proposal.projection.depth[i][0]>proposal.projection.depth[i-1][0]&&proposal.projection.depth[i][1]>proposal.projection.depth[i-1][1]);
result.checks.push({name:'monotone horizontal rows and depth',passed:true});
const roadWorld=proposal.roadsNative.map(r=>({...r,world:r.center.map(toWorldNative)}));
for(const site of proposal.sites)for(let level=1;level<=3;level++){
 const size=site.levelSizes[level-1],footprint=rect(site.world.x,site.world.y,size),entry={x:site.world.x+size/2,y:site.world.y+size+.6};
 const b={id:1,instanceId:'audit:isolated-room',type:site.type,level,x:10,y:40,buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1'};
 const prefab=spatialPrefab(b),s={spatial:{version:'spatial-metres-1',extentVersion:'courtyard-96-1',buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1'},buildings:[b]};
 const from={x:b.x+prefab.access.x,y:b.y+prefab.access.y};
 let slots=prefab.slots.filter(slot=>site.type==='clinic'?['rest','heal'].includes(slot.kind):slot.kind==='work').map(slot=>({...slot,origin:'existing prefab'}));
 if(site.type==='clinic')for(const [suffix,x] of [['doctor:1',1.5],['consult:1',2.4]])slots.push({kind:suffix.startsWith('doctor')?'work':'treatment',suffix,position:{x,y:[4.7,6.7,9.3][level-1]},origin:'new service-layout candidate'});
 const slotResults=[];
 for(const slot of slots){const target={x:b.x+slot.position.x,y:b.y+slot.position.y},route=meterFindPath(s,from,target,{throughCourtyardPassage:false,throughEastPassage:false,throughWestPassage:false,throughValleyPassage:false,throughResidencesPassage:false,maxSnap:0});assert.ok(meterCanStand(s,target),`${site.planId} L${level} ${slot.suffix} stand`);assert.ok(route,`${site.planId} L${level} ${slot.suffix} route`);let at=from;for(const p of route){assert.equal(meterSweep(s,at,p).blocked,false);at=p;}
  const world={x:site.world.x+slot.position.x,y:site.world.y+slot.position.y};slotResults.push({suffix:slot.suffix,kind:slot.kind,origin:slot.origin,local:slot.position,world,nativeArt:nativeArt(candidate.toArt(world.x,world.y)),routeLocal:route.map(p=>[p.x-b.x,p.y-b.y])});
 }
 const physicalSlots=slots.filter(slot=>slot.kind!=='heal'||slot.suffix==='consult:1');
 for(let i=0;i<physicalSlots.length;i++)for(let j=i+1;j<physicalSlots.length;j++)assert.ok(worldDistance(physicalSlots[i].position,physicalSlots[j].position)>=.52,`${site.planId} L${level} exclusive-body spacing`);
 const bounds={...site.world,width:size,height:size};
 let roadSamples=0;
 for(const road of roadWorld.filter(r=>['upper','lower','west-connector'].includes(r.id)))for(let i=1;i<road.world.length;i++){const a=road.world[i-1],z=road.world[i],steps=Math.ceil(worldDistance(a,z)/.025);for(let n=0;n<=steps;n++){const t=n/steps,p={x:a.x+(z.x-a.x)*t,y:a.y+(z.y-a.y)*t};assert.equal(pointInRect(p,bounds,.26),false,`${site.planId} L${level} intersects ${road.id}`);roadSamples++;}}
 if(level===1){const target=site.level1MeasuredMainHouseNative.stairFoot,a=nativeArt(candidate.toArt(entry.x,entry.y));assert.ok(Math.hypot(a[0]-target[0],a[1]-target[1])<1e-9);}
 result.levels.push({siteId:site.id,planId:site.planId,level,size,footprintWorld:footprint,footprintNative:footprint.map(p=>nativeArt(candidate.toArt(...p))),entranceWorld:entry,entranceNative:nativeArt(candidate.toArt(entry.x,entry.y)),slots:slotResults,isolatedRoomRoutesPassed:true,publicRoadCenterSeparationSamples:roadSamples,groundStatus:site.groundStatus});
}
result.checks.push({name:'all six level envelopes separated from surveyed public road centres with 0.26m margin',passed:true});
result.checks.push({name:'level-one doors match measured stair feet',passed:true});
result.checks.push({name:'distinct physical bed and treatment feet retain two 0.26m body circles',passed:true});
result.checks.push({name:'isolated real prefab entrance to every level 1-3 existing slot and proposed treatment pair',passed:true,limitation:'Room-only collision check; final outdoor ground and active-body occupancy require integration validation.'});
for(const road of roadWorld)result.roads.push({id:road.id,native:road.center,world:road.world,status:road.status});
for(const join of proposal.residencesJoinsGlobal)result.joins.push({...join,world:join.centerProposal.map(p=>candidate.toWorld(...p))});
result.pending=[
 'Static stage-patch composite and final runtime terrain/path integration.',
 'Stage-specific exterior obstacles and level 2/3 closed bodies, entrance branches and waiting feet.',
 ...proposal.pendingNaturalConnections
];
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 fs.writeFileSync(path.join(dir,'spatial-audit.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({checks:result.checks,levelCount:result.levels.length,pending:result.pending},null,2));
}
