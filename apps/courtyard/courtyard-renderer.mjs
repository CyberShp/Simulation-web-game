import { toArt, toWorld, ART_WIDTH, ART_HEIGHT, DOMAIN_ART_WIDTH, DOMAIN_ART_LEFT, VALLEY_ART_LEFT, RESIDENCES_ART_RIGHT, SERVICES_ART_RIGHT, NORTH_LIBRARY_ART_TOP, NORTH_MEDITATION_ART_TOP } from './courtyard-space.mjs';
import { FRAME_TABLE, OCCLUDERS, CLEAN_PATCHES, EAST_OCCLUDERS, OPENING_IMAGES, OPENING_HALL_PATCH, OPENING_FIELD_PATCH, OPENING_SHELTER } from './courtyard-layers.mjs';
import { EAST_LAYOUT, EAST_IMAGES, EAST_CLEAN_PATCHES, EAST_HOUSE_POLYGON, EAST_SITE_POLYGON, EAST_BUILD_PATCH, EAST_SEAMS } from './courtyard-east-layout.mjs';

import { WEST_LAYOUT, WEST_IMAGES, WEST_JOIN, WEST_BUILD_PATCH, WEST_SITE_POLYGON, WEST_BUILDING_POLYGON, WEST_OCCLUDERS, DOMAIN_PLAN } from './courtyard-west-layout.mjs';
import { VALLEY_LAYOUT, VALLEY_IMAGES, VALLEY_SITES, VALLEY_JOIN, VALLEY_SERVICE_PATH } from './courtyard-valley-layout.mjs';
import { RESIDENCES_LAYOUT, RESIDENCES_IMAGES, RESIDENCES_SITES, RESIDENCES_JOIN } from './courtyard-residences-layout.mjs';
import {NORTH_LIBRARY_LAYOUT,NORTH_LIBRARY_IMAGES,NORTH_LIBRARY_SITE,NORTH_LIBRARY_JOIN} from './courtyard-north-library-layout.mjs';
import {NORTH_MEDITATION_LAYOUT,NORTH_MEDITATION_IMAGES,NORTH_MEDITATION_SITE,NORTH_MEDITATION_JOIN,NORTH_MEDITATION_SHARED_GROUND} from './courtyard-north-meditation-layout.mjs';
import {WEST_WORKSHOPS_ART_LEFT,WEST_WORKSHOPS_ART_TOP,WEST_WORKSHOPS_BACKGROUNDS,WEST_WORKSHOPS_TILES,WEST_WORKSHOPS_JOINS,WEST_WORKSHOPS_SITES,westWorkshopsSpritePlacement} from './courtyard-west-workshops-layout.mjs';
import { SERVICES_LAYOUT, SERVICES_IMAGES, SERVICES_SITES, SERVICES_JOIN } from './courtyard-services-layout.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const loadImage=path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('素材读取失败：'+path));im.src=new URL(path,import.meta.url).href;});
export function inPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const trace=(ctx,points)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();};
const FIELD=[[195,729],[240,686],[387,650],[604,695],[627,761],[499,844],[359,816],[260,791]];
const HALL=[[279,79],[878,61],[980,198],[910,319],[480,330],[342,294]];

/** Visual phases come from the public building projection, never a UI timer. */
export function courtyardSceneStages(view){
 const hall=view?.buildings?.find(b=>b.type==='hall'),farm=view?.buildings?.find(b=>b.type==='farm');
 const hallStage=hall?(['shelter','foundation','structure','finishing'].includes(hall.stage)?hall.stage:'complete'):'empty';
 const farmBuilt=!!farm&&!['foundation','structure','finishing'].includes(farm.stage);
 return {hall:hallStage,farm:farmBuilt?(farm.cropVisual==='empty'?'fallow':'planted'):'unbuilt'};
}
export function openingShelterPlacement(hall){
 const entrance=hall?.entrance;if(hall?.stage!=='shelter'||!Number.isFinite(entrance?.x)||!Number.isFinite(entrance?.y))return null;
 const foot=toArt(entrance.x,entrance.y),scale=OPENING_SHELTER.width/OPENING_SHELTER.crop[2];
 return {foot,x:foot.x-OPENING_SHELTER.foot[0]*scale,y:foot.y-OPENING_SHELTER.foot[1]*scale,width:OPENING_SHELTER.width,height:OPENING_SHELTER.crop[3]*scale};
}

const samePoint=(a,b,tolerance=1e-6)=>Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
const copyPath=path=>(path||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:p.x,y:p.y}));
const compactPoints=points=>points.filter((p,i)=>!i||!samePoint(p,points[i-1]));
function sampleMotion(memory,now){
 const points=memory.motion,t=memory.durationMs?clamp((now-memory.startedAt)/memory.durationMs,0,1):1;
 const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
 let distance=lengths.reduce((sum,n)=>sum+n,0)*t;
 for(let i=0;i<lengths.length;i++){
  if(distance<=lengths[i]&&lengths[i]>0){const a=points[i],b=points[i+1],f=distance/lengths[i],world={x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};return{world,remaining:compactPoints([world,...points.slice(i+1)]),dx:b.x-a.x,dy:b.y-a.y};}
  distance-=lengths[i];
 }
 return{world:{x:memory.actual.x,y:memory.actual.y},remaining:[memory.actual],dx:memory.dx,dy:memory.dy};
}
function consumedRoute(before,after){
 const oldPath=before.path,nextPath=after.path;
 if(!oldPath.length||nextPath.length>oldPath.length)return null;
 const consumed=oldPath.length-nextPath.length;
 if(!nextPath.every((p,i)=>samePoint(p,oldPath[consumed+i])))return null;
 const start=consumed?oldPath[consumed-1]:before,end=oldPath[consumed];
 if(end){
  const dx=end.x-start.x,dy=end.y-start.y,length2=dx*dx+dy*dy;
  const t=length2?((after.x-start.x)*dx+(after.y-start.y)*dy)/length2:0;
  if(t<-.000001||t>1.000001||!samePoint(after,{x:start.x+dx*t,y:start.y+dy*t}))return null;
 }else if(!samePoint(after,oldPath.at(-1),.08))return null;
 return compactPoints([before,...oldPath.slice(0,consumed),after]);
}
/** Interpolate through already consumed formal path nodes. Replaced paths,
 * long observation gaps and paused/indoor views align with the actual position. */
export function observeActorDisplay(previous,person,tick,paused,now){
 const actual={x:person.x,y:person.y,tick,path:copyPath(person.path)},indoor=!!person.indoor;
 let memory=previous?{...previous,lastTick:tick,indoor,actual:{...previous.actual,path:actual.path}}:{actual,prior:null,motion:[actual],startedAt:now,durationMs:0,lastTick:tick,indoor,dx:0,dy:0};
 const changed=previous&&(person.x!==previous.actual.x||person.y!==previous.actual.y);
 if(changed){
  const interval=(tick-previous.actual.tick)*100,travel=consumedRoute(previous.actual,actual),display=sampleMotion(previous,now);
  memory={...memory,prior:previous.actual,actual,motion:travel?compactPoints([...display.remaining,...travel.slice(1)]):[actual],startedAt:now,
   durationMs:travel&&interval>0&&interval<=1000?interval:0,dx:person.x-previous.actual.x,dy:person.y-previous.actual.y};
 }
 if(paused||indoor||previous&&((previous.indoor!==indoor)||tick<previous.lastTick)){
  memory={...memory,actual,motion:[actual],startedAt:now,durationMs:0};
 }
 const display=sampleMotion(memory,now);memory.world=display.world;memory.art=toArt(memory.world.x,memory.world.y);memory.dx=display.dx;memory.dy=display.dy;
 memory.interpolating=memory.durationMs>0&&now-memory.startedAt<memory.durationMs;
 return memory;
}

/** Presentation only: the original master supplies every unchanged environment pixel. */
export class CourtyardRenderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d',{willReadFrequently:true});this.camera={x:ART_WIDTH/2,y:ART_HEIGHT/2,zoom:1};this.mode='local';this.reference=false;this.selected=null;this.target=null;this.hover=null;this.people=[];this.actorMemory=new Map();this.hitRegions=[];this.ready=false;this.resize();}
 async load(){
  const assets=[...new Set([...WEST_WORKSHOPS_BACKGROUNDS.map(t=>t.image),...WEST_WORKSHOPS_TILES.map(t=>t.image),...WEST_WORKSHOPS_JOINS.map(j=>j.image),...WEST_WORKSHOPS_SITES.flatMap(s=>[...Object.values(s.images),...s.levels.map(l=>l.longStair?.image)])].filter(Boolean)),NORTH_MEDITATION_SHARED_GROUND.image,NORTH_MEDITATION_JOIN.image,...Object.values(NORTH_MEDITATION_IMAGES),NORTH_LIBRARY_JOIN.image,...Object.values(NORTH_LIBRARY_IMAGES),'courtyard-master-v2.png','courtyard-clean-v2.png','courtyard-fallow-v2.png','courtyard-domain-v1.png',DOMAIN_PLAN.image,WEST_JOIN.image,VALLEY_JOIN.image,VALLEY_SERVICE_PATH.image,RESIDENCES_JOIN.image,SERVICES_JOIN.image,...Object.values(SERVICES_IMAGES),...Object.values(RESIDENCES_IMAGES),...Object.values(VALLEY_IMAGES),...Object.values(WEST_IMAGES),...Object.values(OPENING_IMAGES),...Object.values(EAST_IMAGES),...EAST_SEAMS.map(seam=>seam.image),...new Set(Object.values(FRAME_TABLE).map(t=>t.atlas))];
  this.images=Object.fromEntries(await Promise.all(assets.map(async name=>[name,await loadImage('assets/'+name.replace(/^assets\//,''))])));
  this.original=this.images['courtyard-master-v2.png'];this.clean=this.images['courtyard-clean-v2.png'];this.fallow=this.images['courtyard-fallow-v2.png'];this.domain=this.images[DOMAIN_PLAN.image];
  this.plate=document.createElement('canvas');this.plate.width=ART_WIDTH;this.plate.height=ART_HEIGHT;const ctx=this.plate.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(this.original,0,0);
  for(const patch of CLEAN_PATCHES){ctx.save();trace(ctx,patch.polygon);ctx.clip();ctx.drawImage(this.clean,0,0,ART_WIDTH,ART_HEIGHT);ctx.restore();}
  this.courtyardPlates=new Map();
  this.eastPlate=document.createElement('canvas');this.eastPlate.width=ART_WIDTH;this.eastPlate.height=ART_HEIGHT;const eastCtx=this.eastPlate.getContext('2d');eastCtx.imageSmoothingEnabled=false;eastCtx.drawImage(this.images[EAST_IMAGES.terrace],0,0);
  for(const polygon of EAST_CLEAN_PATCHES){eastCtx.save();trace(eastCtx,polygon);eastCtx.clip();eastCtx.drawImage(this.images[EAST_IMAGES.clean],0,0,ART_WIDTH,ART_HEIGHT);eastCtx.restore();}
  this.eastStages={complete:this.eastPlate};
  for(const [stage,name] of [['available',EAST_IMAGES.empty],['building',EAST_IMAGES.construction]]){const plate=document.createElement('canvas');plate.width=ART_WIDTH;plate.height=ART_HEIGHT;const stageCtx=plate.getContext('2d');stageCtx.imageSmoothingEnabled=false;stageCtx.drawImage(this.eastPlate,0,0);stageCtx.save();trace(stageCtx,EAST_BUILD_PATCH);stageCtx.clip();stageCtx.drawImage(this.images[name],0,0,ART_WIDTH,ART_HEIGHT);stageCtx.restore();this.eastStages[stage]=plate;}
  this.westStages={};
  const complete=this.images[WEST_IMAGES.complete];
  for(const [stage,name] of [['complete',WEST_IMAGES.complete],['available',WEST_IMAGES.empty],['building',WEST_IMAGES.construction]]){
   const plate=document.createElement('canvas');plate.width=WEST_LAYOUT.width;plate.height=WEST_LAYOUT.height;
   const target=plate.getContext('2d');target.imageSmoothingEnabled=false;target.drawImage(complete,0,0,plate.width,plate.height);
   if(stage!=='complete'){target.save();trace(target,WEST_BUILD_PATCH);target.clip();target.drawImage(this.images[name],0,0,plate.width,plate.height);target.restore();}
   this.westStages[stage]=plate;
  }
  this.westJoin=document.createElement('canvas');this.westJoin.width=ART_WIDTH;this.westJoin.height=ART_HEIGHT;
  const joinCtx=this.westJoin.getContext('2d'),left=WEST_JOIN.left-WEST_JOIN.x,right=WEST_JOIN.right-WEST_JOIN.x;
  joinCtx.imageSmoothingEnabled=false;joinCtx.drawImage(this.images[WEST_JOIN.image],0,0,ART_WIDTH,ART_HEIGHT);
  const mask=joinCtx.createLinearGradient(left,0,right,0),edge=WEST_JOIN.feather/(right-left);
  mask.addColorStop(0,'transparent');mask.addColorStop(edge,'#000');mask.addColorStop(1-edge,'#000');mask.addColorStop(1,'transparent');
  joinCtx.globalCompositeOperation='destination-in';joinCtx.fillStyle=mask;joinCtx.fillRect(0,0,ART_WIDTH,ART_HEIGHT);
  this.valleyPlate=document.createElement('canvas');this.valleyPlate.width=VALLEY_LAYOUT.width;this.valleyPlate.height=VALLEY_LAYOUT.height;
  this.valleyPlateKey=null;
  this.prepareServicesLayers();
  this.prepareNorthLibraryLayers();
  this.prepareNorthMeditationLayers();
  this.prepareWestWorkshopsLayers();
  this.residencesPlate=document.createElement('canvas');this.residencesPlate.width=RESIDENCES_LAYOUT.width;this.residencesPlate.height=RESIDENCES_LAYOUT.height;this.residencesPlateKey=null;
  this.residencesJoin=document.createElement('canvas');this.residencesJoin.width=RESIDENCES_JOIN.width;this.residencesJoin.height=RESIDENCES_JOIN.height;
  const residencesJoinCtx=this.residencesJoin.getContext('2d');
  residencesJoinCtx.imageSmoothingEnabled=false;residencesJoinCtx.drawImage(this.images[RESIDENCES_JOIN.image],0,0,RESIDENCES_JOIN.width,RESIDENCES_JOIN.height);
  trace(residencesJoinCtx,RESIDENCES_JOIN.polygon.map(([x,y])=>[x-RESIDENCES_JOIN.x,y-RESIDENCES_JOIN.y]));
  residencesJoinCtx.globalCompositeOperation='destination-in';residencesJoinCtx.fillStyle='#000';residencesJoinCtx.fill();
  residencesJoinCtx.globalCompositeOperation='destination-out';
  for(let width=RESIDENCES_JOIN.feather;width>=1;width--){residencesJoinCtx.lineWidth=width*2;residencesJoinCtx.globalAlpha=1/(width+1);residencesJoinCtx.stroke();}
  residencesJoinCtx.globalAlpha=1;
  const residencesScenery=document.createElement('canvas');residencesScenery.width=RESIDENCES_JOIN.width;residencesScenery.height=RESIDENCES_JOIN.height;
  const sceneryCtx=residencesScenery.getContext('2d'),sceneryLeft=RESIDENCES_JOIN.sceneryLeft-RESIDENCES_JOIN.x,sceneryRight=RESIDENCES_JOIN.sceneryRight-RESIDENCES_JOIN.x;
  sceneryCtx.imageSmoothingEnabled=false;sceneryCtx.drawImage(this.images[RESIDENCES_JOIN.image],0,0,RESIDENCES_JOIN.width,RESIDENCES_JOIN.height);
  const sceneryMask=sceneryCtx.createLinearGradient(sceneryLeft,0,sceneryRight,0),sceneryEdge=RESIDENCES_JOIN.sceneryFeather/(sceneryRight-sceneryLeft);
  sceneryMask.addColorStop(0,'transparent');sceneryMask.addColorStop(sceneryEdge,'#000');sceneryMask.addColorStop(1-sceneryEdge,'#000');sceneryMask.addColorStop(1,'transparent');
  sceneryCtx.globalCompositeOperation='destination-in';sceneryCtx.fillStyle=sceneryMask;sceneryCtx.fillRect(0,0,RESIDENCES_JOIN.width,RESIDENCES_JOIN.height);
  residencesJoinCtx.globalCompositeOperation='source-over';residencesJoinCtx.drawImage(residencesScenery,0,0);
  this.valleyJoin=document.createElement('canvas');this.valleyJoin.width=ART_WIDTH;this.valleyJoin.height=ART_HEIGHT;
  const valleyJoinCtx=this.valleyJoin.getContext('2d'),joinLeft=VALLEY_JOIN.left-VALLEY_JOIN.x,joinRight=VALLEY_JOIN.right-VALLEY_JOIN.x;
  valleyJoinCtx.imageSmoothingEnabled=false;valleyJoinCtx.drawImage(this.images[VALLEY_JOIN.image],0,0,ART_WIDTH,ART_HEIGHT);
  const valleyMask=valleyJoinCtx.createLinearGradient(joinLeft,0,joinRight,0),valleyEdge=VALLEY_JOIN.feather/(joinRight-joinLeft);
  valleyMask.addColorStop(0,'transparent');valleyMask.addColorStop(valleyEdge,'#000');valleyMask.addColorStop(1-valleyEdge,'#000');valleyMask.addColorStop(1,'transparent');
  valleyJoinCtx.globalCompositeOperation='destination-in';valleyJoinCtx.fillStyle=valleyMask;valleyJoinCtx.fillRect(0,0,ART_WIDTH,ART_HEIGHT);
  if(VALLEY_JOIN.polygon){
   trace(valleyJoinCtx,VALLEY_JOIN.polygon.map(([x,y])=>[x-VALLEY_JOIN.x,y]));valleyJoinCtx.fillStyle='#000';valleyJoinCtx.fill();
   valleyJoinCtx.globalCompositeOperation='destination-out';
   for(let width=12;width>=1;width--){valleyJoinCtx.lineWidth=width*2;valleyJoinCtx.globalAlpha=1/(width+1);valleyJoinCtx.stroke();}
   valleyJoinCtx.globalAlpha=1;
  }
  if(Number.isFinite(VALLEY_JOIN.sceneryRight)){
   const scenery=document.createElement('canvas');scenery.width=ART_WIDTH;scenery.height=ART_HEIGHT;
   const ctx=scenery.getContext('2d'),right=VALLEY_JOIN.sceneryRight-VALLEY_JOIN.x,edge=Math.min(.45,VALLEY_JOIN.feather/(right-joinLeft));
   ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[VALLEY_JOIN.image],0,0,ART_WIDTH,ART_HEIGHT);
   const mask=ctx.createLinearGradient(joinLeft,0,right,0);mask.addColorStop(0,'transparent');mask.addColorStop(edge,'#000');mask.addColorStop(1-edge,'#000');mask.addColorStop(1,'transparent');
   ctx.globalCompositeOperation='destination-in';ctx.fillStyle=mask;ctx.fillRect(0,0,ART_WIDTH,ART_HEIGHT);
   valleyJoinCtx.globalCompositeOperation='source-over';valleyJoinCtx.drawImage(scenery,0,0);
  }
  this.ready=true;return this;
 }
 resize(){const b=this.canvas.getBoundingClientRect();this.w=Math.round(b.width||ART_WIDTH);this.h=Math.round(b.height||ART_HEIGHT);this.dpr=Math.min(2,globalThis.devicePixelRatio||1);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);this.fit=Math.min(this.w/ART_WIDTH,this.h/ART_HEIGHT);this.ctx.imageSmoothingEnabled=false;}
 showCourtyard(){this.mode='local';this.reference=false;this.followId=null;this.camera={x:ART_WIDTH/2,y:ART_HEIGHT/2,zoom:1};}
 showOverview(){this.mode='planning';this.reference=false;this.followId=null;}
 worldToScreen(x,y){return this.artToScreen(toArt(x,y));}
 artToScreen(p){const s=this.fit*this.camera.zoom;return{x:(p.x-this.camera.x)*s+this.w/2,y:(p.y-this.camera.y)*s+this.h/2};}
 screenToArt(x,y){const s=this.fit*this.camera.zoom;return{x:(x-this.w/2)/s+this.camera.x,y:(y-this.h/2)/s+this.camera.y};}
 screenToWorld(x,y){const p=this.screenToArt(x,y);return toWorld(p.x,p.y);}
 zoomAt(factor,x=this.w/2,y=this.h/2){if(this.mode!=='local')return;const before=this.screenToArt(x,y);this.followId=null;this.camera.zoom=clamp(this.camera.zoom*factor,1,2);const after=this.screenToArt(x,y);this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;this.constrain();}
 panBy(dx,dy){if(this.mode!=='local')return;this.followId=null;const s=this.fit*this.camera.zoom;this.camera.x-=dx/s;this.camera.y-=dy/s;this.constrain();}
 sceneLeft(){return this.view?.domain?.westWorkshopsEnabled?WEST_WORKSHOPS_ART_LEFT:this.view?.domain?.valleyEnabled?VALLEY_ART_LEFT:this.view?.domain?.westEnabled?DOMAIN_ART_LEFT:0;}
 sceneRight(){return this.view?.domain?.servicesEnabled?SERVICES_ART_RIGHT:this.view?.domain?.residencesEnabled?RESIDENCES_ART_RIGHT:this.view?.domain?.enabled?DOMAIN_ART_WIDTH:ART_WIDTH;}
 sceneTop(){return this.view?.domain?.northMeditationEnabled?NORTH_MEDITATION_ART_TOP:this.view?.domain?.northLibraryEnabled?NORTH_LIBRARY_ART_TOP:this.view?.domain?.westWorkshopsEnabled?WEST_WORKSHOPS_ART_TOP:0;}
 constrain(){
  const right=this.sceneRight(),left=this.sceneLeft(),top=this.sceneTop(),width=right-left,halfX=Math.min(width/2,this.w/(2*this.fit*this.camera.zoom)),halfY=Math.min((ART_HEIGHT-top)/2,this.h/(2*this.fit*this.camera.zoom));
  this.camera.x=clamp(this.camera.x,left+halfX,right-halfX);this.camera.y=clamp(this.camera.y,top+halfY,ART_HEIGHT-halfY);
  if(this.view?.domain?.westWorkshopsEnabled&&this.camera.x<0){const bridge=WEST_WORKSHOPS_JOINS.find(join=>join.id==='valley-bridge'),westTop=this.camera.x+halfX<=bridge.x+bridge.width?WEST_WORKSHOPS_ART_TOP:0;this.camera.y=clamp(this.camera.y,westTop+halfY,ART_HEIGHT-halfY);return;}
  if(this.view?.domain?.northLibraryEnabled&&this.camera.y-halfY<0){const northHalfX=Math.min(NORTH_LIBRARY_LAYOUT.width/2,halfX);this.camera.x=clamp(this.camera.x,NORTH_LIBRARY_LAYOUT.x+northHalfX,NORTH_LIBRARY_LAYOUT.x+NORTH_LIBRARY_LAYOUT.width-northHalfX);}
 }
 followPerson(id){this.mode='local';this.reference=false;this.followId=id;this.camera.zoom=1.35;}
 focusLocation(location){const p=location?.focus||location;if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;const art=toArt(p.x,p.y);this.mode='local';this.reference=false;this.followId=null;this.camera.zoom=1.35;this.camera.x=art.x;this.camera.y=art.y-75;this.constrain();return true;}
 displayPoint(person){return this.actorMemory.get(person.id)?.art||toArt(person.x,person.y);}
 frameFor(person){const table=person.id==='person:master'?FRAME_TABLE.master:person.id==='person:lu-zhiwei'||person.appearance===1?FRAME_TABLE.female:FRAME_TABLE.other;const memory=this.actorMemory.get(person.id);const moving=person.moving||person.path?.length>0||memory?.interpolating;const frames=moving?(memory?.dy<0&&table.walkAway?.length?table.walkAway:table.walk):[table.idle];const frame=frames[Math.floor((this.view?.tick||0)/2)%frames.length];return{table,frame,flip:moving&&memory?.dx<-.001};}
 drawPortrait(canvas,person){const {table,frame}=this.frameFor(person),ctx=canvas.getContext('2d'),[x,y,w,h]=frame.crop,s=Math.min(canvas.width*.9/w,canvas.height*.94/h);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[table.atlas],x,y,w,h,(canvas.width-w*s)/2,canvas.height-h*s,w*s,h*s);}
 drawActor(person){const p=this.displayPoint(person),width=this.sceneRight();if(p.x<this.sceneLeft()-70||p.y<this.sceneTop()||p.x>width+70||p.y>ART_HEIGHT+150||person.indoor)return;const{table,frame,flip}=this.frameFor(person),[sx,sy,sw,sh]=frame.crop,scale=table.height/frame.sourceHeight,ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#17282050';ctx.beginPath();ctx.ellipse(-5,0,23,6,0,0,Math.PI*2);ctx.fill();if(this.selected===person.id){ctx.strokeStyle='#f4d589';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(0,1,24,7,0,0,Math.PI*2);ctx.stroke();}if(flip)ctx.scale(-1,1);ctx.drawImage(this.images[table.atlas],sx,sy,sw,sh,-frame.foot[0]*scale,-frame.foot[1]*scale,sw*scale,sh*scale);ctx.restore();this.hitRegions.push({person,p,x:p.x-(flip?(sw-frame.foot[0]):frame.foot[0])*scale,y:p.y-frame.foot[1]*scale,w:sw*scale,h:sh*scale});}
 westSite(){return this.view?.domain?.sites?.find(site=>site.id===WEST_LAYOUT.siteId)||null;}
 westStage(){const site=this.westSite();return site?.status==='complete'?'complete':site?.status==='building'&&site.progress>0?'building':'available';}
 westImage(){return this.westStages?.[this.westStage()];}
 valleySite(id){return this.view?.domain?.sites?.find(site=>site.id===id)||null;}
 buildingForSite(site){return this.view?.buildings?.find(b=>b.instanceId===site?.buildingId||String(b.id)===String(site?.buildingId).replace(/^building:yunxiu:/,''))||null;}
 valleyStage(id){const site=this.valleySite(id);if(site?.status!=='complete')return site?.status==='building'&&site.progress>0?'construction':'empty';const building=this.buildingForSite(site);return building?.type==='granary'?(building.cropVisual==='ripe'?'complete':building.cropVisual==='growing'?'growing':'fallow'):'complete';}
 valleyImage(){
  const states=VALLEY_SITES.map(site=>[site,this.valleyStage(site.id)]),key=states.map(([site,stage])=>`${site.id}:${stage}`).join('|');
  if(this.valleyPlateKey!==key){const ctx=this.valleyPlate.getContext('2d');ctx.clearRect(0,0,VALLEY_LAYOUT.width,VALLEY_LAYOUT.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[VALLEY_IMAGES.complete],0,0,VALLEY_LAYOUT.width,VALLEY_LAYOUT.height);
   for(const [site,stage]of states)if(stage!=='complete'){ctx.save();trace(ctx,(['fallow','growing'].includes(stage)&&site.cropPatch)||site.patch);ctx.clip();ctx.drawImage(this.images[VALLEY_IMAGES[stage]],0,0,VALLEY_LAYOUT.width,VALLEY_LAYOUT.height);ctx.restore();}
   ctx.save();trace(ctx,VALLEY_SERVICE_PATH.polygon);ctx.clip();ctx.drawImage(this.images[VALLEY_SERVICE_PATH.image],0,0,VALLEY_LAYOUT.width,VALLEY_LAYOUT.height);ctx.restore();
   this.valleyPlateKey=key;
  }return this.valleyPlate;
 }
 prepareWestWorkshopsLayers(){
  this.westWorkshopJoins=WEST_WORKSHOPS_JOINS.map(join=>{
   const result=document.createElement('canvas');result.width=join.width;result.height=join.height;const target=result.getContext('2d');
   const addLayer=(polygon,feather,xOnly=false)=>{
    const layer=document.createElement('canvas');layer.width=join.width;layer.height=join.height;const ctx=layer.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[join.image],0,0,join.width,join.height);
    trace(ctx,polygon.map(([x,y])=>[x-join.x,y-join.y]));ctx.globalCompositeOperation='destination-in';ctx.fillStyle='#000';ctx.fill();
    if(xOnly){const mask=ctx.createLinearGradient(0,0,join.width,0),edge=Math.min(.49,feather/join.width);mask.addColorStop(0,'transparent');mask.addColorStop(edge,'#000');mask.addColorStop(1-edge,'#000');mask.addColorStop(1,'transparent');ctx.fillStyle=mask;ctx.fillRect(0,0,join.width,join.height);}
    else{ctx.globalCompositeOperation='destination-out';ctx.lineJoin='round';for(let width=feather;width>=1;width--){ctx.lineWidth=width*2;ctx.globalAlpha=1/(width+1);ctx.stroke();}}
    target.drawImage(layer,0,0);
   };
   for(const polygon of join.polygons||[join.polygon])addLayer(polygon,join.featherX??join.feather??0,Number.isFinite(join.featherX));
   if(join.sceneryPolygon)addLayer(join.sceneryPolygon,join.sceneryFeather||0);
   return {join,image:result};
  });
 }
 westWorkshopSite(id){return this.view?.domain?.sites?.find(site=>site.id===id)||null;}
 westWorkshopState(site){
  const runtime=this.westWorkshopSite(site.id),building=this.buildingForSite(runtime),level=building?.level||1;
  const stage=building?'complete':runtime?.status==='building'&&runtime.progress>0?(runtime.progress<.35?'foundation':'construction'):'empty';
  return {runtime,level,stage,layout:site.levels.find(l=>l.level===level)||site.levels[0]};
 }
 westWorkshopPolygon(site){
  const {stage,level,layout}=this.westWorkshopState(site);if(stage==='empty')return layout.artFootprint;
  const p=westWorkshopsSpritePlacement(site,level,stage),sprite=site.stageSprites?.[stage]||site.sprite;return sprite.sourceSelectionPolygon.map(([x,y])=>[p.x+x*sprite.scale,p.y+y*sprite.scale]);
 }
 paintWestWorkshopSite(ctx,site){
  const {stage,level,layout}=this.westWorkshopState(site);if(stage==='empty')return;
  const image=this.images[site.images[stage]],p=westWorkshopsSpritePlacement(site,level,stage);
  if(layout.longStair){const t=layout.longStair;ctx.drawImage(this.images[t.image],t.footArt[0]-t.footSource[0]*t.scale,t.footArt[1]-t.footSource[1]*t.scale,t.sourceWidth*t.scale,t.sourceHeight*t.scale);}
  if(image)ctx.drawImage(image,p.x,p.y,p.width,p.height);
 }
 paintWestWorkshops(ctx){
  for(const layer of WEST_WORKSHOPS_BACKGROUNDS){ctx.save();if(layer.polygon){trace(ctx,layer.polygon);ctx.clip();}ctx.drawImage(this.images[layer.image],layer.x,layer.y,layer.width,layer.height);ctx.restore();}
  for(const tile of WEST_WORKSHOPS_TILES)ctx.drawImage(this.images[tile.image],tile.x,tile.y,tile.width,tile.height);
  for(const {join,image}of this.westWorkshopJoins)ctx.drawImage(image,join.x,join.y);
  for(const site of WEST_WORKSHOPS_SITES)this.paintWestWorkshopSite(ctx,site);
 }
 prepareNorthMeditationLayers(){
  this.northMeditationStages={};
  for(const stage of ['empty','foundation','construction','complete']){
   const plate=document.createElement('canvas');plate.width=NORTH_MEDITATION_LAYOUT.width;plate.height=NORTH_MEDITATION_LAYOUT.height;const ctx=plate.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[NORTH_MEDITATION_IMAGES.empty],0,0,plate.width,plate.height);
   if(stage!=='empty'){ctx.save();trace(ctx,NORTH_MEDITATION_SITE.stagePatches[stage]);ctx.clip();ctx.drawImage(this.images[NORTH_MEDITATION_IMAGES[stage]],0,0,plate.width,plate.height);ctx.restore();}
   this.northMeditationStages[stage]=plate;
  }
  this.northMeditationJoin=document.createElement('canvas');this.northMeditationJoin.width=NORTH_MEDITATION_JOIN.width;this.northMeditationJoin.height=NORTH_MEDITATION_JOIN.height;const target=this.northMeditationJoin.getContext('2d');
  for(const polygon of NORTH_MEDITATION_JOIN.polygons){
   const layer=document.createElement('canvas');layer.width=NORTH_MEDITATION_JOIN.width;layer.height=NORTH_MEDITATION_JOIN.height;const ctx=layer.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[NORTH_MEDITATION_JOIN.image],0,0,layer.width,layer.height);
   trace(ctx,polygon.map(([x,y])=>[x-NORTH_MEDITATION_JOIN.x,y-NORTH_MEDITATION_JOIN.y]));ctx.globalCompositeOperation='destination-in';ctx.fill();ctx.globalCompositeOperation='destination-out';ctx.lineJoin='round';for(let width=NORTH_MEDITATION_JOIN.feather;width>=1;width--){ctx.lineWidth=width*2;ctx.globalAlpha=1/(width+1);ctx.stroke();}target.drawImage(layer,0,0);
  }
  this.northMeditationGround=document.createElement('canvas');this.northMeditationGround.width=NORTH_MEDITATION_SHARED_GROUND.width;this.northMeditationGround.height=NORTH_MEDITATION_SHARED_GROUND.height;const ground=this.northMeditationGround.getContext('2d');ground.imageSmoothingEnabled=false;ground.drawImage(this.images[NORTH_MEDITATION_SHARED_GROUND.image],0,0,this.northMeditationGround.width,this.northMeditationGround.height);trace(ground,NORTH_MEDITATION_SHARED_GROUND.polygon.map(([x,y])=>[x-NORTH_MEDITATION_SHARED_GROUND.x,y-NORTH_MEDITATION_SHARED_GROUND.y]));ground.globalCompositeOperation='destination-in';ground.fill();ground.globalCompositeOperation='destination-out';ground.lineJoin='round';for(let width=NORTH_MEDITATION_SHARED_GROUND.feather;width>=1;width--){ground.lineWidth=width*2;ground.globalAlpha=1/(width+1);ground.stroke();}
  target.globalCompositeOperation='destination-out';target.globalAlpha=1;for(const polygon of NORTH_MEDITATION_JOIN.excludePolygons){trace(target,polygon.map(([x,y])=>[x-NORTH_MEDITATION_JOIN.x,y-NORTH_MEDITATION_JOIN.y]));target.fill();}target.globalCompositeOperation='source-over';
 }
 northMeditationSite(){return this.view?.domain?.sites?.find(site=>site.id===NORTH_MEDITATION_SITE.id)||null;}
 northMeditationStage(){const site=this.northMeditationSite();return site?.status==='complete'?'complete':site?.status==='building'&&site.progress>0?(site.progress<.35?'foundation':'construction'):'empty';}
 northMeditationImage(){return this.northMeditationStages[this.northMeditationStage()];}
 paintNorthMeditation(ctx){ctx.drawImage(this.northMeditationImage(),NORTH_MEDITATION_LAYOUT.x,NORTH_MEDITATION_LAYOUT.y);ctx.drawImage(this.northMeditationJoin,NORTH_MEDITATION_JOIN.x,NORTH_MEDITATION_JOIN.y);ctx.drawImage(this.northMeditationGround,NORTH_MEDITATION_SHARED_GROUND.x,NORTH_MEDITATION_SHARED_GROUND.y);}
 prepareNorthLibraryLayers(){
  this.northLibraryStages={};
  for(const stage of ['empty','construction','complete']){
   const plate=document.createElement('canvas');plate.width=NORTH_LIBRARY_LAYOUT.width;plate.height=NORTH_LIBRARY_LAYOUT.height;const ctx=plate.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[NORTH_LIBRARY_IMAGES.empty],0,0,plate.width,plate.height);
   if(stage!=='empty'){ctx.save();trace(ctx,NORTH_LIBRARY_SITE.stagePatches[stage]);ctx.clip();ctx.drawImage(this.images[NORTH_LIBRARY_IMAGES[stage]],0,0,plate.width,plate.height);ctx.restore();}
   this.northLibraryStages[stage]=plate;
  }
  this.northLibraryJoin=document.createElement('canvas');this.northLibraryJoin.width=NORTH_LIBRARY_JOIN.width;this.northLibraryJoin.height=NORTH_LIBRARY_JOIN.height;const target=this.northLibraryJoin.getContext('2d');
  for(const polygon of NORTH_LIBRARY_JOIN.polygons){const layer=document.createElement('canvas');layer.width=NORTH_LIBRARY_JOIN.width;layer.height=NORTH_LIBRARY_JOIN.height;const ctx=layer.getContext('2d');ctx.drawImage(this.images[NORTH_LIBRARY_JOIN.image],0,0,layer.width,layer.height);trace(ctx,polygon.map(([x,y])=>[x-NORTH_LIBRARY_JOIN.x,y-NORTH_LIBRARY_JOIN.y]));ctx.globalCompositeOperation='destination-in';ctx.fill();ctx.globalCompositeOperation='destination-out';ctx.lineJoin='round';for(let width=NORTH_LIBRARY_JOIN.feather;width>=1;width--){ctx.lineWidth=width*2;ctx.globalAlpha=1/(width+1);ctx.stroke();}target.drawImage(layer,0,0);}
  const scenery=document.createElement('canvas');scenery.width=NORTH_LIBRARY_JOIN.width;scenery.height=NORTH_LIBRARY_JOIN.height;const ctx=scenery.getContext('2d'),top=NORTH_LIBRARY_JOIN.sceneryTop-NORTH_LIBRARY_JOIN.y,bottom=NORTH_LIBRARY_JOIN.sceneryBottom-NORTH_LIBRARY_JOIN.y,edge=NORTH_LIBRARY_JOIN.sceneryFeather/(bottom-top);ctx.drawImage(this.images[NORTH_LIBRARY_JOIN.image],0,0,scenery.width,scenery.height);const gradient=ctx.createLinearGradient(0,top,0,bottom);gradient.addColorStop(0,'transparent');gradient.addColorStop(edge,'#000');gradient.addColorStop(1-edge,'#000');gradient.addColorStop(1,'transparent');ctx.globalCompositeOperation='destination-in';ctx.fillStyle=gradient;ctx.fillRect(0,0,scenery.width,scenery.height);target.drawImage(scenery,0,0);
 }
 northLibrarySite(){return this.view?.domain?.sites?.find(site=>site.id===NORTH_LIBRARY_SITE.id)||null;}
 northLibraryStage(){const site=this.northLibrarySite();return site?.status==='complete'?'complete':site?.status==='building'&&site.progress>0?'construction':'empty';}
 northLibraryImage(){return this.northLibraryStages[this.northLibraryStage()];}
 paintNorthLibrary(ctx){ctx.save();ctx.beginPath();ctx.rect(NORTH_LIBRARY_LAYOUT.x,NORTH_LIBRARY_LAYOUT.y,NORTH_LIBRARY_LAYOUT.width,-NORTH_LIBRARY_LAYOUT.y);ctx.clip();ctx.drawImage(this.northLibraryImage(),NORTH_LIBRARY_LAYOUT.x,NORTH_LIBRARY_LAYOUT.y);ctx.restore();ctx.drawImage(this.northLibraryJoin,NORTH_LIBRARY_JOIN.x,NORTH_LIBRARY_JOIN.y);}
 prepareServicesLayers(){
  this.servicesPlate=document.createElement('canvas');this.servicesPlate.width=SERVICES_LAYOUT.width;this.servicesPlate.height=SERVICES_LAYOUT.height;this.servicesPlateKey=null;
  this.servicesStages=new Map();
  for(const site of SERVICES_SITES)for(const stage of ['complete','construction']){
   const layer=document.createElement('canvas');layer.width=SERVICES_LAYOUT.width;layer.height=SERVICES_LAYOUT.height;const lc=layer.getContext('2d');lc.imageSmoothingEnabled=false;
   lc.save();trace(lc,site.stagePatches[stage]);lc.clip();lc.drawImage(this.images[SERVICES_IMAGES[stage]],0,0,layer.width,layer.height);lc.restore();
   lc.globalCompositeOperation='destination-out';lc.lineJoin='round';lc.lineCap='round';
   for(const edge of site.stageBlendEdges?.[stage]||[]){lc.beginPath();edge.forEach(([x,y],i)=>i?lc.lineTo(x,y):lc.moveTo(x,y));for(let width=site.groundEdgeFeatherPixels;width>=1;width--){lc.lineWidth=width*2;lc.globalAlpha=1/(width+1);lc.stroke();}}
   this.servicesStages.set(`${site.id}:${stage}`,layer);
  }
  this.servicesJoin=document.createElement('canvas');this.servicesJoin.width=SERVICES_JOIN.width;this.servicesJoin.height=SERVICES_JOIN.height;
  const ctx=this.servicesJoin.getContext('2d');ctx.imageSmoothingEnabled=false;
  for(const polygon of SERVICES_JOIN.polygons){
   const layer=document.createElement('canvas');layer.width=SERVICES_JOIN.width;layer.height=SERVICES_JOIN.height;const lc=layer.getContext('2d');lc.imageSmoothingEnabled=false;
   lc.drawImage(this.images[SERVICES_JOIN.image],0,0,layer.width,layer.height);trace(lc,polygon.map(([x,y])=>[x-SERVICES_JOIN.x,y-SERVICES_JOIN.y]));lc.globalCompositeOperation='destination-in';lc.fillStyle='#000';lc.fill();
   lc.globalCompositeOperation='destination-out';for(let width=SERVICES_JOIN.feather;width>=1;width--){lc.lineWidth=width*2;lc.globalAlpha=1/(width+1);lc.stroke();}ctx.drawImage(layer,0,0);
  }
  const scenery=document.createElement('canvas');scenery.width=SERVICES_JOIN.width;scenery.height=SERVICES_JOIN.height;const sc=scenery.getContext('2d'),left=SERVICES_JOIN.sceneryLeft-SERVICES_JOIN.x,right=SERVICES_JOIN.sceneryRight-SERVICES_JOIN.x;
  sc.imageSmoothingEnabled=false;sc.drawImage(this.images[SERVICES_JOIN.image],0,0,scenery.width,scenery.height);const mask=sc.createLinearGradient(left,0,right,0),edge=SERVICES_JOIN.sceneryFeather/(right-left);
  mask.addColorStop(0,'transparent');mask.addColorStop(edge,'#000');mask.addColorStop(1-edge,'#000');mask.addColorStop(1,'transparent');sc.globalCompositeOperation='destination-in';sc.fillStyle=mask;sc.fillRect(0,0,scenery.width,scenery.height);ctx.drawImage(scenery,0,0);
 }
 serviceSite(id){return this.view?.domain?.sites?.find(site=>site.id===id)||null;}
 serviceStage(id){const site=this.serviceSite(id);return site?.status==='complete'?'complete':site?.status==='building'&&site.progress>0?'construction':'empty';}
 servicesImage(){
  const states=SERVICES_SITES.map(site=>[site,this.serviceStage(site.id)]),key=states.map(([site,stage])=>`${site.id}:${stage}`).join('|');
  if(this.servicesPlateKey!==key){const ctx=this.servicesPlate.getContext('2d');ctx.clearRect(0,0,SERVICES_LAYOUT.width,SERVICES_LAYOUT.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[SERVICES_IMAGES.empty],0,0,SERVICES_LAYOUT.width,SERVICES_LAYOUT.height);
   for(const[site,stage]of states)if(stage!=='empty')ctx.drawImage(this.servicesStages.get(`${site.id}:${stage}`),0,0);
   this.servicesPlateKey=key;
  }return this.servicesPlate;
 }
 paintServices(ctx){ctx.drawImage(this.servicesImage(),SERVICES_LAYOUT.x,0);ctx.drawImage(this.servicesJoin,SERVICES_JOIN.x,SERVICES_JOIN.y);}
 residenceSite(id){return this.view?.domain?.sites?.find(site=>site.id===id)||null;}
 residenceStage(id){const site=this.residenceSite(id);return site?.status==='complete'?'complete':site?.status==='building'&&site.progress>0?'construction':'empty';}
 residencesImage(){
  const states=RESIDENCES_SITES.map(site=>[site,this.residenceStage(site.id)]),key=states.map(([site,stage])=>`${site.id}:${stage}`).join('|');
  if(this.residencesPlateKey!==key){const ctx=this.residencesPlate.getContext('2d');ctx.clearRect(0,0,RESIDENCES_LAYOUT.width,RESIDENCES_LAYOUT.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[RESIDENCES_IMAGES.empty],0,0,RESIDENCES_LAYOUT.width,RESIDENCES_LAYOUT.height);
   for(const [site,stage]of states)if(stage!=='empty'){ctx.save();trace(ctx,site.stagePatches?.[stage]||site.patch);ctx.clip();ctx.drawImage(this.images[RESIDENCES_IMAGES[stage]],0,0,RESIDENCES_LAYOUT.width,RESIDENCES_LAYOUT.height);ctx.restore();}
   this.residencesPlateKey=key;
  }return this.residencesPlate;
 }
 planningTransform(){const scale=Math.min(this.w/DOMAIN_PLAN.width,this.h/DOMAIN_PLAN.height);return{scale,x:(this.w-DOMAIN_PLAN.width*scale)/2,y:(this.h-DOMAIN_PLAN.height*scale)/2};}
 eastSite(){return this.view?.domain?.sites?.find(site=>site.id===EAST_LAYOUT.siteId)||null;}
 eastStage(){const site=this.eastSite();return site?.status==='complete'?'complete':site?.status==='building'&&site.progress>0?'building':'available';}
 eastImage(){return this.eastStages?.[this.eastStage()];}
 sceneStages(){return this.view?courtyardSceneStages(this.view):{hall:'complete',farm:'planted'};}
 courtyardImage(){
  const stages=this.sceneStages(),key=stages.hall+':'+stages.farm;
  if(key==='complete:planted')return this.plate;
  if(this.courtyardPlates.has(key))return this.courtyardPlates.get(key);
  const plate=document.createElement('canvas');plate.width=ART_WIDTH;plate.height=ART_HEIGHT;
  const ctx=plate.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(this.plate,0,0);
  const patch=(polygon,image)=>{
   const layer=document.createElement('canvas');layer.width=ART_WIDTH;layer.height=ART_HEIGHT;
   const patchCtx=layer.getContext('2d');patchCtx.imageSmoothingEnabled=false;patchCtx.drawImage(image,0,0,ART_WIDTH,ART_HEIGHT);
   patchCtx.globalCompositeOperation='destination-in';trace(patchCtx,polygon);patchCtx.fill();
   // Blend only a narrow edge of the new terrain into the original pixels.
   patchCtx.globalCompositeOperation='destination-out';
   for(let width=8;width>=1;width--){patchCtx.lineWidth=width*2;patchCtx.globalAlpha=1/(width+1);patchCtx.stroke();}
   patchCtx.lineWidth=1;patchCtx.globalAlpha=1;patchCtx.stroke();ctx.drawImage(layer,0,0);
  };
  if(stages.hall!=='complete')patch(OPENING_HALL_PATCH,this.images[OPENING_IMAGES[['shelter','empty'].includes(stages.hall)?'empty':stages.hall]]);
  if(stages.farm==='unbuilt')patch(OPENING_FIELD_PATCH,this.images[OPENING_IMAGES.empty]);
  else if(stages.farm==='fallow')patch(FIELD,this.fallow);
  this.courtyardPlates.set(key,plate);return plate;
 }
 shelterPlacement(){return openingShelterPlacement(this.view?.buildings?.find(b=>b.type==='hall'));}
 drawShelter(){const p=this.shelterPlacement();if(p)this.ctx.drawImage(this.images[OPENING_IMAGES.shelter],...OPENING_SHELTER.crop,p.x,p.y,p.width,p.height);}
 occluders(){
  const stages=this.sceneStages(),local=OCCLUDERS.filter(o=>!(o.id.startsWith('hall-')&&stages.hall!=='complete')&&!(o.id.startsWith('herb-')&&stages.farm==='unbuilt'));
  if(stages.hall==='finishing')local.push({...OCCLUDERS.find(o=>o.id==='hall-front'),id:'opening-hall-finishing'});
  const shelter=this.shelterPlacement();if(shelter){const scale=shelter.width/OPENING_SHELTER.crop[2];local.push({id:'opening-shelter',source:'shelter',feetY:shelter.foot.y-.5,polygon:OPENING_SHELTER.silhouette.map(([x,y])=>[shelter.x+x*scale,shelter.y+y*scale])});}
  if(this.view?.domain?.westEnabled&&this.westStage()==='complete')local.push(...WEST_OCCLUDERS);
  if(this.view?.domain?.valleyEnabled)for(const site of VALLEY_SITES)if(site.buildingPolygon&&this.valleySite(site.id)?.status==='complete')local.push({id:site.id,source:'valley',feetY:site.feetY,polygon:site.buildingPolygon.map(([x,y])=>[x+VALLEY_LAYOUT.x,y])});
  if(this.view?.domain?.servicesEnabled)for(const site of SERVICES_SITES)if(this.serviceStage(site.id)==='complete')local.push({id:site.id,source:'services',feetY:site.feetY,polygon:site.buildingPolygon.map(([x,y])=>[x+SERVICES_LAYOUT.x,y])});
  if(this.view?.domain?.residencesEnabled)for(const site of RESIDENCES_SITES)if(this.residenceStage(site.id)==='complete')local.push({id:site.id,source:'residences',feetY:site.feetY,polygon:site.buildingPolygon.map(([x,y])=>[x+RESIDENCES_LAYOUT.x,y])});
  if(this.view?.domain?.westWorkshopsEnabled)for(const site of WEST_WORKSHOPS_SITES){const state=this.westWorkshopState(site);if(state.stage!=='empty')local.push({id:site.id,source:'westWorkshops',site,feetY:state.layout.houseFootArt[1],polygon:this.westWorkshopPolygon(site)});}
  if(this.view?.domain?.northMeditationEnabled&&this.northMeditationStage()==='complete')for(const solid of NORTH_MEDITATION_SITE.solids)local.push({id:`${NORTH_MEDITATION_SITE.id}:${solid.id}`,source:'northMeditation',feetY:solid.feetY+NORTH_MEDITATION_LAYOUT.y,polygon:solid.occlusion.map(([x,y])=>[x+NORTH_MEDITATION_LAYOUT.x,y+NORTH_MEDITATION_LAYOUT.y])});
  if(this.view?.domain?.northLibraryEnabled&&this.northLibraryStage()==='complete')local.push({id:NORTH_LIBRARY_SITE.id,source:'northLibrary',feetY:NORTH_LIBRARY_SITE.feetY+NORTH_LIBRARY_LAYOUT.y,polygon:NORTH_LIBRARY_SITE.buildingPolygon.map(([x,y])=>[x+NORTH_LIBRARY_LAYOUT.x,y+NORTH_LIBRARY_LAYOUT.y])});
  return this.view?.domain?.enabled?[...local,...EAST_OCCLUDERS.filter(o=>!o.building||this.eastStage()!=='available')]:local;
 }
 pickPeople(x,y,{minTarget=44}={}){if(this.mode!=='local'||this.reference||!Number.isFinite(x)||!Number.isFinite(y))return [];const p=this.screenToArt(x,y),scale=this.fit*this.camera.zoom,minimum=Math.max(0,minTarget)/scale,seen=new Set();return [...this.hitRegions].reverse().filter(h=>{if(h.person.indoor||seen.has(h.person.id))return false;const padx=Math.max(0,(minimum-h.w)/2),pady=Math.max(0,(minimum-h.h)/2);if(p.x<h.x-padx||p.x>h.x+h.w+padx||p.y<h.y-pady||p.y>h.y+h.h+pady)return false;const visiblePoint={x:clamp(p.x,h.x,h.x+h.w),y:clamp(p.y,h.y,h.y+h.h)};if(this.occluders().some(o=>h.p.y<o.feetY&&inPolygon(visiblePoint.x,visiblePoint.y,o.polygon)))return false;seen.add(h.person.id);return true;}).map(h=>h.person);}
 pickPerson(x,y){return this.pickPeople(x,y)[0]||null;}
 pickDomainSite(x,y){
  if(this.reference)return null;
  if(this.mode==='planning'){
   const t=this.planningTransform(),px=(x-t.x)/t.scale,py=(y-t.y)/t.scale;
   return this.view?.domain?.plannedSites?.find(site=>site.diagramPosition&&Math.abs(px-site.diagramPosition[0])<=98&&Math.abs(py-site.diagramPosition[1]-(site.diagramOffsetY??DOMAIN_PLAN.mapTop))<=34)||null;
  }
  if(this.mode!=='local'||!this.view?.domain?.enabled)return null;
  const p=this.screenToArt(x,y);
  if(this.view.domain.westWorkshopsEnabled){const site=WEST_WORKSHOPS_SITES.find(site=>inPolygon(p.x,p.y,this.westWorkshopPolygon(site)));if(site)return this.westWorkshopSite(site.id);}
  if(this.view.domain.northMeditationEnabled&&inPolygon(p.x-NORTH_MEDITATION_LAYOUT.x,p.y-NORTH_MEDITATION_LAYOUT.y,this.northMeditationStage()==='empty'?NORTH_MEDITATION_SITE.footprint:NORTH_MEDITATION_SITE.stagePatches[this.northMeditationStage()]))return this.northMeditationSite();
  if(this.view.domain.northLibraryEnabled&&inPolygon(p.x-NORTH_LIBRARY_LAYOUT.x,p.y-NORTH_LIBRARY_LAYOUT.y,this.northLibraryStage()==='empty'?NORTH_LIBRARY_SITE.footprint:NORTH_LIBRARY_SITE.stagePatches[this.northLibraryStage()]))return this.northLibrarySite();
  if(this.view.domain.servicesEnabled){const site=SERVICES_SITES.find(site=>inPolygon(p.x-SERVICES_LAYOUT.x,p.y,this.serviceStage(site.id)==='empty'?site.footprint:site.stagePatches[this.serviceStage(site.id)]));if(site)return this.serviceSite(site.id);}
  if(this.view.domain.residencesEnabled){const site=RESIDENCES_SITES.find(site=>inPolygon(p.x-RESIDENCES_LAYOUT.x,p.y,this.residenceStage(site.id)==='empty'?site.footprint:site.buildingPolygon));if(site)return this.residenceSite(site.id);}
  if(this.view.domain.valleyEnabled){const site=VALLEY_SITES.find(site=>inPolygon(p.x-VALLEY_LAYOUT.x,p.y,this.valleySite(site.id)?.status==='complete'&&site.buildingPolygon?site.buildingPolygon:site.footprint)||this.valleySite(site.id)?.status==='complete'&&site.selectionPolygon&&inPolygon(p.x-VALLEY_LAYOUT.x,p.y,site.selectionPolygon));if(site)return this.valleySite(site.id);}
  if(this.view.domain.westEnabled&&inPolygon(p.x-WEST_LAYOUT.x,p.y,this.westStage()==='available'?WEST_SITE_POLYGON:WEST_BUILDING_POLYGON))return this.westSite();
  return inPolygon(p.x-EAST_LAYOUT.terraceX,p.y,this.eastStage()==='available'?EAST_SITE_POLYGON:EAST_HOUSE_POLYGON)?this.eastSite():null;
 }
 pickBuilding(x,y){
  if(this.mode!=='local'||this.reference)return null;
  const p=this.screenToArt(x,y),shelter=this.shelterPlacement();
  if(this.view?.domain?.westWorkshopsEnabled){const site=WEST_WORKSHOPS_SITES.find(site=>this.westWorkshopState(site).stage==='complete'&&inPolygon(p.x,p.y,this.westWorkshopPolygon(site)));if(site)return this.buildingForSite(this.westWorkshopSite(site.id));}
  if(this.view?.domain?.northMeditationEnabled&&this.northMeditationStage()==='complete'&&inPolygon(p.x-NORTH_MEDITATION_LAYOUT.x,p.y-NORTH_MEDITATION_LAYOUT.y,NORTH_MEDITATION_SITE.selectionPolygon))return this.buildingForSite(this.northMeditationSite());
  if(this.view?.domain?.northLibraryEnabled&&this.northLibraryStage()==='complete'&&inPolygon(p.x-NORTH_LIBRARY_LAYOUT.x,p.y-NORTH_LIBRARY_LAYOUT.y,NORTH_LIBRARY_SITE.buildingPolygon))return this.buildingForSite(this.northLibrarySite());
  if(this.view?.domain?.servicesEnabled){const site=SERVICES_SITES.find(site=>this.serviceStage(site.id)==='complete'&&inPolygon(p.x-SERVICES_LAYOUT.x,p.y,site.buildingPolygon));if(site)return this.buildingForSite(this.serviceSite(site.id));}
  if(this.view?.domain?.residencesEnabled){const site=RESIDENCES_SITES.find(site=>this.residenceStage(site.id)==='complete'&&inPolygon(p.x-RESIDENCES_LAYOUT.x,p.y,site.buildingPolygon));if(site)return this.buildingForSite(this.residenceSite(site.id));}
  if(shelter&&p.x>=shelter.x&&p.x<=shelter.x+shelter.width&&p.y>=shelter.y&&p.y<=shelter.y+shelter.height)return this.view.buildings.find(b=>b.type==='hall');
  if(this.view?.domain?.valleyEnabled){const site=VALLEY_SITES.find(site=>this.valleySite(site.id)?.status==='complete'&&(inPolygon(p.x-VALLEY_LAYOUT.x,p.y,site.buildingPolygon||site.footprint)||site.selectionPolygon&&inPolygon(p.x-VALLEY_LAYOUT.x,p.y,site.selectionPolygon)));if(site)return this.buildingForSite(this.valleySite(site.id));}
  if(this.view?.domain?.westEnabled&&this.westStage()==='complete'&&inPolygon(p.x-WEST_LAYOUT.x,p.y,WEST_BUILDING_POLYGON))return this.buildingForSite(this.westSite());
  if(this.view?.domain?.enabled&&inPolygon(p.x-EAST_LAYOUT.terraceX,p.y,EAST_HOUSE_POLYGON))return this.view.buildings.find(b=>b.type==='house'&&b.x===132&&b.y===40)||null;
  return this.sceneStages().hall!=='shelter'&&inPolygon(p.x,p.y,HALL)?this.view?.buildings.find(b=>b.type==='hall'):inPolygon(p.x,p.y,FIELD)?this.view?.buildings.find(b=>b.type==='farm'):null;
 }
 paintSeams(ctx){for(const seam of EAST_SEAMS){ctx.save();ctx.translate(seam.x-836,0);trace(ctx,seam.polygon);ctx.clip();ctx.drawImage(this.images[seam.image],0,0);ctx.restore();}}
 paintEnvironment(ctx,view){if(view?.domain?.valleyEnabled)ctx.drawImage(this.valleyImage(),VALLEY_LAYOUT.x,0);if(view?.domain?.westEnabled)ctx.drawImage(this.westImage(),WEST_LAYOUT.x,0);if(view?.domain?.valleyEnabled)ctx.drawImage(this.valleyJoin,VALLEY_JOIN.x,0);ctx.drawImage(this.courtyardImage(),0,0);if(view?.domain?.westEnabled)ctx.drawImage(this.westJoin,WEST_JOIN.x,0);if(view?.domain?.enabled){ctx.drawImage(this.images[EAST_IMAGES.pathA],1672,0);ctx.drawImage(this.images[EAST_IMAGES.pathB],3344,0);ctx.drawImage(this.eastImage(),EAST_LAYOUT.terraceX,0);this.paintSeams(ctx);}if(view?.domain?.residencesEnabled){ctx.drawImage(this.residencesImage(),RESIDENCES_LAYOUT.x,0);ctx.drawImage(this.residencesJoin,RESIDENCES_JOIN.x,RESIDENCES_JOIN.y);}if(view?.domain?.servicesEnabled)this.paintServices(ctx);if(view?.domain?.northLibraryEnabled)this.paintNorthLibrary(ctx);if(view?.domain?.northMeditationEnabled)this.paintNorthMeditation(ctx);if(view?.domain?.westWorkshopsEnabled)this.paintWestWorkshops(ctx);}
 draw(view){this.view=view;this.people=view.people;const now=performance.now(),ids=new Set();for(const p of view.people){ids.add(p.id);this.actorMemory.set(p.id,observeActorDisplay(this.actorMemory.get(p.id),p,view.tick,view.paused,now));}for(const id of this.actorMemory.keys())if(!ids.has(id))this.actorMemory.delete(id);const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.w,this.h);ctx.fillStyle='#142b2b';ctx.fillRect(0,0,this.w,this.h);this.hitRegions=[];if(!this.ready)return;
  if(this.mode==='planning'){const t=this.planningTransform();ctx.drawImage(this.domain,t.x,t.y,DOMAIN_PLAN.width*t.scale,DOMAIN_PLAN.height*t.scale);return;}
  if(this.followId){const p=view.people.find(p=>p.id===this.followId);if(p&&!p.indoor){const a=this.displayPoint(p);this.camera.x=a.x;this.camera.y=a.y-75;this.constrain();}}
  const s=this.fit*this.camera.zoom;ctx.translate(this.w/2-this.camera.x*s,this.h/2-this.camera.y*s);ctx.scale(s,s);ctx.imageSmoothingEnabled=false;
  if(this.reference){if(view?.domain?.valleyEnabled)ctx.drawImage(this.valleyImage(),VALLEY_LAYOUT.x,0);if(view?.domain?.westEnabled)ctx.drawImage(this.westImage(),WEST_LAYOUT.x,0);if(view?.domain?.valleyEnabled)ctx.drawImage(this.valleyJoin,VALLEY_JOIN.x,0);ctx.drawImage(this.original,0,0);if(view?.domain?.westEnabled)ctx.drawImage(this.westJoin,WEST_JOIN.x,0);if(view?.domain?.enabled){ctx.drawImage(this.images[EAST_IMAGES.pathA],1672,0);ctx.drawImage(this.images[EAST_IMAGES.pathB],3344,0);ctx.drawImage(this.images[EAST_IMAGES.terrace],EAST_LAYOUT.terraceX,0);this.paintSeams(ctx);}if(view?.domain?.residencesEnabled){ctx.drawImage(this.residencesImage(),RESIDENCES_LAYOUT.x,0);ctx.drawImage(this.residencesJoin,RESIDENCES_JOIN.x,RESIDENCES_JOIN.y);}if(view?.domain?.servicesEnabled)this.paintServices(ctx);if(view?.domain?.northLibraryEnabled)this.paintNorthLibrary(ctx);if(view?.domain?.northMeditationEnabled)this.paintNorthMeditation(ctx);if(view?.domain?.westWorkshopsEnabled)this.paintWestWorkshops(ctx);return;}
  this.paintEnvironment(ctx,view);
  if(this.target){ctx.strokeStyle='#e9dca4';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(this.target.x,this.target.y,13,5,0,0,Math.PI*2);ctx.stroke();}
  const queue=[];
  for(const p of view.people)if(!p.indoor)queue.push({y:this.displayPoint(p).y,person:p});
  for(const o of this.occluders())queue.push({y:o.feetY,occluder:o});queue.sort((a,b)=>a.y-b.y);
  for(const item of queue){if(item.person)this.drawActor(item.person);else if(item.occluder.source==='shelter')this.drawShelter();else if(item.occluder.source==='westWorkshops'){ctx.save();trace(ctx,item.occluder.polygon);ctx.clip();this.paintWestWorkshopSite(ctx,item.occluder.site);ctx.restore();}else if(item.occluder.source==='northMeditation'){ctx.save();trace(ctx,item.occluder.polygon);ctx.clip();ctx.drawImage(this.northMeditationImage(),NORTH_MEDITATION_LAYOUT.x,NORTH_MEDITATION_LAYOUT.y);ctx.restore();}else if(item.occluder.source==='northLibrary'){ctx.save();trace(ctx,item.occluder.polygon);ctx.clip();ctx.drawImage(this.northLibraryImage(),NORTH_LIBRARY_LAYOUT.x,NORTH_LIBRARY_LAYOUT.y);ctx.restore();}else{ctx.save();trace(ctx,item.occluder.polygon);ctx.clip();ctx.drawImage(item.occluder.source==='services'?this.servicesImage():item.occluder.source==='residences'?this.residencesImage():item.occluder.source==='valley'?this.valleyImage():item.occluder.source==='west'?this.westImage():item.occluder.source==='east'?this.eastImage():this.courtyardImage(),item.occluder.source==='services'?SERVICES_LAYOUT.x:item.occluder.source==='residences'?RESIDENCES_LAYOUT.x:item.occluder.source==='valley'?VALLEY_LAYOUT.x:item.occluder.source==='west'?WEST_LAYOUT.x:item.occluder.source==='east'?EAST_LAYOUT.terraceX:0,0);ctx.restore();}}
  const hovered=view.people.find(p=>p.id===this.hover||p.id===this.selected);if(hovered&&!hovered.indoor){const a=this.displayPoint(hovered),height=this.frameFor(hovered).table.height;ctx.font='16px "Songti SC",serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#152b2d';ctx.strokeText(hovered.name,a.x,a.y-height-12);ctx.fillStyle='#fff0c1';ctx.fillText(hovered.name,a.x,a.y-height-12);}
 }
}
