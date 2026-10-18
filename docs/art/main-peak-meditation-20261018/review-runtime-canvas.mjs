import fs from 'node:fs/promises';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {createCanvas,Image} from '/Volumes/Media/immortal/node_modules/@napi-rs/canvas/index.js';
import {CourtyardRenderer,inPolygon} from '../../../apps/courtyard/courtyard-renderer.mjs';
import * as space from '../../../apps/courtyard/courtyard-space.mjs';
import * as baseline from '/Volumes/Media/immortal/apps/courtyard/courtyard-space.mjs';
import {NORTH_MEDITATION_LAYOUT as L,NORTH_MEDITATION_SITE as S} from '../../../apps/courtyard/courtyard-north-meditation-layout.mjs';
import {NORTH_LIBRARY_LAYOUT as OL,NORTH_LIBRARY_SITE as OS} from '../../../apps/courtyard/courtyard-north-library-layout.mjs';
import * as geo from '../../../src/simulation/ea-north-meditation-geometry.mjs';
import {spatialAccess,spatialSlots,spatialPrefab,meterCanStand,meterFindPath,meterSweep} from '../../../src/simulation/ea-sr-spatial.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';
const dir=new URL('./runtime-canvas-review/',import.meta.url);await fs.mkdir(dir,{recursive:true});
const files=['apps/courtyard/courtyard-space.mjs','apps/courtyard/courtyard-renderer.mjs','apps/courtyard/courtyard-main.mjs','apps/courtyard/courtyard-north-meditation-layout.mjs','src/simulation/ea-north-meditation-geometry.mjs','src/simulation/ea-sect-domain.mjs','src/simulation/ea-sr-spatial.mjs'];
const hash=async path=>crypto.createHash('sha256').update(await fs.readFile(new URL('../../../'+path,import.meta.url))).digest('hex');const before=Object.fromEntries(await Promise.all(files.map(async f=>[f,await hash(f)])));
const survey=JSON.parse(await fs.readFile(new URL('ground-and-join-survey.json',import.meta.url)));
const failures=[],checks=[];function check(name,ok,detail){checks.push({name,ok,detail});if(!ok)failures.push(name);}
globalThis.document={createElement:()=>createCanvas(1,1)};globalThis.Image=class extends Image{set src(v){super.src=fileURLToPath(v).replace('/apps/courtyard/assets/','/assets/courtyard/');}};
const canvas=createCanvas(1672,941);canvas.getBoundingClientRect=()=>({width:canvas.width,height:canvas.height});const r=new CourtyardRenderer(canvas);await r.load();
const building={id:80,instanceId:'building:yunxiu:80',type:'meditation',level:1,stage:'complete',domainSiteId:S.id,x:44,y:-46};
const library={id:79,instanceId:'building:yunxiu:79',type:'library',level:1,stage:'complete',domainSiteId:OS.id,x:44,y:-16};
const site={id:S.id,buildingId:building.instanceId,status:'complete',progress:1},oldSite={id:OS.id,buildingId:library.instanceId,status:'complete',progress:1};
const domain={enabled:true,westEnabled:true,valleyEnabled:true,residencesEnabled:true,servicesEnabled:true,northLibraryEnabled:true,northMeditationEnabled:true,sites:[site,oldSite]};
const view={tick:0,paused:true,people:[],buildings:[building,library],domain};
const actors=S.feet.map((f,i)=>({id:i===0?'person:master':`fixture:${i}`,appearance:i%2,name:`脚点 ${i+1}`,x:f.world.x,y:f.world.y,indoor:false}));
function setCanvas(w,h,camera){canvas.width=w;canvas.height=h;r.w=w;r.h=h;r.fit=1;r.dpr=1;r.ctx=canvas.getContext('2d');r.camera={...camera,zoom:1};r.followId=null;r.mode='local';r.reference=false;r.actorMemory=new Map();}
const camera={x:L.x+836,y:L.y+470.5};
for(const [stage,status,progress]of [['empty','open',0],['foundation','building',.2],['construction','building',.6],['complete','complete',1]]){
 site.status=status;site.progress=progress;view.people=stage==='complete'?actors:[{id:'person:master',x:47,y:-39.4,indoor:false}];setCanvas(1672,941,camera);r.draw(view);
 await fs.writeFile(new URL(`${stage}.png`,dir),canvas.toBuffer('image/png'));
 const point=r.artToScreen({x:L.x+780,y:L.y+555});check(`${stage}:stage`,r.northMeditationStage()===stage,r.northMeditationStage());check(`${stage}:site-pick`,r.pickDomainSite(point.x,point.y)?.id===S.id,r.pickDomainSite(point.x,point.y)?.id);
 if(stage==='complete'){check('complete:building-pick',r.pickBuilding(point.x,point.y)?.instanceId===building.instanceId);check('complete:six-actor-regions',r.hitRegions.length===6,r.hitRegions.length);for(const h of r.hitRegions){let hit=null;for(let yy=h.y+8;yy<h.y+h.h-5&&!hit;yy+=5)for(let xx=h.x+8;xx<h.x+h.w-5&&!hit;xx+=5){const p=r.artToScreen({x:xx,y:yy});if(r.pickPerson(p.x,p.y)?.id===h.person.id)hit=p;}check(`actor-pick:${h.person.id}`,!!hit,hit);}check('complete:eight-occluders',r.occluders().filter(o=>o.source==='northMeditation').length===8);}
}
// Exact pixel comparison inside the existing library body before/after opening GC03.
view.people=[];r.view=view;const oldImages=[];
for(const enabled of [false,true]){domain.northMeditationEnabled=enabled;const c=createCanvas(1672,941),ctx=c.getContext('2d');ctx.translate(-OL.x,-OL.y);r.paintEnvironment(ctx,view);oldImages.push(ctx.getImageData(0,0,1672,941).data);}
domain.northMeditationEnabled=true;let compared=0,changed=0;const edgeDifferences=[];
for(let y=185;y<565;y++)for(let x=440;x<1085;x++){if(![[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>inPolygon(x+dx,y+dy,OS.buildingPolygon)))continue;const i=(y*1672+x)*4;compared++;if([0,1,2,3].some(k=>oldImages[0][i+k]!==oldImages[1][i+k])){const edgeDistance=Math.min(...OS.buildingPolygon.map((a,k)=>distSegment({x,y},{x:a[0],y:a[1]},{x:OS.buildingPolygon[(k+1)%OS.buildingPolygon.length][0],y:OS.buildingPolygon[(k+1)%OS.buildingPolygon.length][1]})));edgeDifferences.push({x,y,edgeDistance,maxChannelDelta:Math.max(...[0,1,2,3].map(k=>Math.abs(oldImages[0][i+k]-oldImages[1][i+k])))});if(edgeDistance>2)changed++;}}
check('old-library-body-pixels',changed===0,{compared,changedBeyond2PixelBoundary:changed,antiAliasBoundaryDifferences:edgeDifferences});
view.people=[...actors,...[[1252,-211],[1213,-455],[1256,-701],[1142,-971]].map((p,i)=>({id:`stairs:${i}`,appearance:i%2,...space.toWorld(...p),indoor:false}))];setCanvas(1672,1882,{x:L.x+836,y:L.y+941});r.draw(view);await fs.writeFile(new URL('full-connection.png',dir),canvas.toBuffer('image/png'));
view.people=[{id:'person:master',x:49,y:-35.4,indoor:false}];setCanvas(1672,941,camera);r.draw(view);await fs.writeFile(new URL('l3-entry-person.png',dir),canvas.toBuffer('image/png'));const foot=r.worldToScreen(49,-35.4);check('l3-person-pick',r.pickPerson(foot.x,foot.y-40)?.id==='person:master',{foot});
// Test the actual camera constraints at ordinary and wide viewports.
const cameras=[];for(const [w,h]of [[1672,941],[2560,1080],[3440,1440],[3840,2160]]){r.w=w;r.h=h;r.fit=Math.min(w/1672,h/941);for(const zoom of [1,2]){r.camera={x:99999,y:-99999,zoom};r.constrain();const first={...r.camera};for(let i=0;i<20;i++)r.constrain();const stable=JSON.stringify(first)===JSON.stringify(r.camera),finite=Object.values(r.camera).every(Number.isFinite);cameras.push({w,h,zoom,stable,finite,camera:{...r.camera}});check(`camera:${w}:${h}:${zoom}`,stable&&finite);}}
const exact=(a,b)=>a?.x===b?.x&&a?.y===b?.y;let projectionSamples=0,projectionMismatch=0;
for(let x=-70;x<=214;x+=2)for(let y=-24;y<=96;y+=2){const a=space.toArt(x,y),b=baseline.toArt(x,y);projectionSamples++;if(!exact(a,b)||!exact(space.toWorld(a.x,a.y),baseline.toWorld(b.x,b.y)))projectionMismatch++;}
check('old-projection-exact',projectionMismatch===0,{projectionSamples,projectionMismatch});
check('walk-polygons-same-survey',JSON.stringify(geo.NORTH_MEDITATION_WALK_POLYGONS)===JSON.stringify(survey.walkPolygons.map(p=>p.world.map(q=>[q.x,q.y]))));
check('feet-same-survey',geo.NORTH_MEDITATION_FEET.every((f,i)=>exact(f.position,survey.feet[i].world)));
function distSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
let roadError=0;for(let i=0;i<survey.roads.length;i++){const core=geo.NORTH_MEDITATION_ROADS[i].centre;for(const p of survey.roads[i].world)roadError=Math.max(roadError,Math.min(...core.slice(1).map((b,j)=>distSegment(p,core[j],b))));}check('road-compression-preserves-line',roadError<1e-8,{maxMetres:roadError});
let state=validateSave(structuredClone(seed.state));for(const name of ['enableCourtyardTerrain','enableSectDomain','enableWestValley','enableEastResidences','enableEastServices','enableNorthLibrary','enableNorthMeditation'])state=dispatchCommand(state,{name,args:[]}).state;
const options={terrain:true,domain:true,west:true,valley:true,residences:true,services:true,northLibrary:true,northMeditation:true};let walked=0;
for(const level of [1,2,3]){const s=validateSave(structuredClone(state)),b={...building,level,buildingGridVersion:'building-units-1',transform:{x:44,y:-46,orientation:'south'}};s.buildings.push(b);s.spatial.geometryRevision++;const entry=spatialAccess(b);check(`L${level}:outdoor`,spatialPrefab(b).indoor===false);check(`L${level}:entry-ground`,meterCanStand(s,entry)&&space.isArtWalkable(...Object.values(space.toArt(entry.x,entry.y)),options));
 for(const kind of ['cultivate','work'])for(const slot of spatialSlots(b,kind)){const path=meterFindPath(s,entry,slot.position,{maxSnap:0});let at=entry,ok=!!path;for(const p of path||[]){if(meterSweep(s,at,p).blocked)ok=false;const n=Math.ceil(Math.hypot(p.x-at.x,p.y-at.y)/.1);for(let i=0;i<=n;i++){const q=space.toArt(at.x+(p.x-at.x)*i/n,at.y+(p.y-at.y)*i/n);walked++;if(!space.isArtWalkable(q.x,q.y,options))ok=false;}at=p;}check(`L${level}:${slot.suffix}:formal-and-art`,ok,{pathPoints:path?.length});}
}
const artRoute=space.routeArt(space.toArt(47,-9.4),space.toArt(47,-39.4),options);check('desktop-route:library-to-platform',!!artRoute,{points:artRoute?.length});
const after=Object.fromEntries(await Promise.all(files.map(async f=>[f,await hash(f)])));check('source-stable-during-review',JSON.stringify(before)===JSON.stringify(after),Object.keys(before).filter(f=>before[f]!==after[f]));
const report={kind:'Actual CourtyardRenderer Canvas and source geometry review; not Electron acceptance',files:after,checks,failures,walkedArtSamples:walked,cameras};await fs.writeFile(new URL('report.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({checks:checks.length,failures,projectionSamples,walkedArtSamples:walked,oldBody:{compared,changed},artRoute:artRoute?.length}));
