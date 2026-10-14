import { toArt, toWorld, ART_WIDTH, ART_HEIGHT } from './courtyard-space.mjs';
import { FRAME_TABLE, OCCLUDERS, CLEAN_PATCHES } from './courtyard-layers.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const loadImage=path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('素材读取失败：'+path));im.src=new URL(path,import.meta.url).href;});
export function inPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
const trace=(ctx,points)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();};
const FIELD=[[195,729],[240,686],[387,650],[604,695],[627,761],[499,844],[359,816],[260,791]];
const HALL=[[279,79],[878,61],[980,198],[910,319],[480,330],[342,294]];

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
  const assets=['courtyard-master-v2.png','courtyard-clean-v2.png','courtyard-fallow-v2.png','courtyard-domain-v1.png',...new Set(Object.values(FRAME_TABLE).map(t=>t.atlas))];
  this.images=Object.fromEntries(await Promise.all(assets.map(async name=>[name,await loadImage('assets/'+name.replace(/^assets\//,''))])));
  this.original=this.images['courtyard-master-v2.png'];this.clean=this.images['courtyard-clean-v2.png'];this.fallow=this.images['courtyard-fallow-v2.png'];this.domain=this.images['courtyard-domain-v1.png'];
  this.plate=document.createElement('canvas');this.plate.width=ART_WIDTH;this.plate.height=ART_HEIGHT;const ctx=this.plate.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(this.original,0,0);
  for(const patch of CLEAN_PATCHES){ctx.save();trace(ctx,patch.polygon);ctx.clip();ctx.drawImage(this.clean,0,0,ART_WIDTH,ART_HEIGHT);ctx.restore();}
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
 constrain(){const halfX=Math.min(ART_WIDTH/2,this.w/(2*this.fit*this.camera.zoom)),halfY=Math.min(ART_HEIGHT/2,this.h/(2*this.fit*this.camera.zoom));this.camera.x=clamp(this.camera.x,halfX,ART_WIDTH-halfX);this.camera.y=clamp(this.camera.y,halfY,ART_HEIGHT-halfY);}
 followPerson(id){this.mode='local';this.reference=false;this.followId=id;this.camera.zoom=1.35;}
 displayPoint(person){return this.actorMemory.get(person.id)?.art||toArt(person.x,person.y);}
 frameFor(person){const table=person.id==='person:master'?FRAME_TABLE.master:person.id==='person:lu-zhiwei'||person.appearance===1?FRAME_TABLE.female:FRAME_TABLE.other;const memory=this.actorMemory.get(person.id);const moving=person.moving||person.path?.length>0||memory?.interpolating;const frames=moving?(memory?.dy<0&&table.walkAway?.length?table.walkAway:table.walk):[table.idle];const frame=frames[Math.floor((this.view?.tick||0)/2)%frames.length];return{table,frame,flip:moving&&memory?.dx<-.001};}
 drawPortrait(canvas,person){const {table,frame}=this.frameFor(person),ctx=canvas.getContext('2d'),[x,y,w,h]=frame.crop,s=Math.min(canvas.width*.9/w,canvas.height*.94/h);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(this.images[table.atlas],x,y,w,h,(canvas.width-w*s)/2,canvas.height-h*s,w*s,h*s);}
 drawActor(person){const p=this.displayPoint(person);if(p.x<-70||p.y<0||p.x>ART_WIDTH+70||p.y>ART_HEIGHT+150||person.indoor)return;const{table,frame,flip}=this.frameFor(person),[sx,sy,sw,sh]=frame.crop,scale=table.height/frame.sourceHeight,ctx=this.ctx;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#17282050';ctx.beginPath();ctx.ellipse(-5,0,23,6,0,0,Math.PI*2);ctx.fill();if(this.selected===person.id){ctx.strokeStyle='#f4d589';ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(0,1,24,7,0,0,Math.PI*2);ctx.stroke();}if(flip)ctx.scale(-1,1);ctx.drawImage(this.images[table.atlas],sx,sy,sw,sh,-frame.foot[0]*scale,-frame.foot[1]*scale,sw*scale,sh*scale);ctx.restore();this.hitRegions.push({person,p,x:p.x-(flip?(sw-frame.foot[0]):frame.foot[0])*scale,y:p.y-frame.foot[1]*scale,w:sw*scale,h:sh*scale});}
 pickPerson(x,y){if(this.mode!=='local'||this.reference)return null;const p=this.screenToArt(x,y);return [...this.hitRegions].reverse().find(h=>p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h&&!OCCLUDERS.some(o=>h.p.y<o.feetY&&inPolygon(p.x,p.y,o.polygon)))?.person||null;}
 pickBuilding(x,y){if(this.mode!=='local'||this.reference)return null;const p=this.screenToArt(x,y);return inPolygon(p.x,p.y,HALL)?this.view?.buildings.find(b=>b.type==='hall'):inPolygon(p.x,p.y,FIELD)?this.view?.buildings.find(b=>b.type==='farm'):null;}
 paintEnvironment(ctx,view){ctx.drawImage(this.plate,0,0);const farm=view?.buildings?.find(b=>b.type==='farm');if(farm?.cropVisual==='empty'){ctx.save();trace(ctx,FIELD);ctx.clip();ctx.drawImage(this.fallow,0,0,ART_WIDTH,ART_HEIGHT);ctx.restore();}}
 draw(view){this.view=view;this.people=view.people;const now=performance.now(),ids=new Set();for(const p of view.people){ids.add(p.id);this.actorMemory.set(p.id,observeActorDisplay(this.actorMemory.get(p.id),p,view.tick,view.paused,now));}for(const id of this.actorMemory.keys())if(!ids.has(id))this.actorMemory.delete(id);const ctx=this.ctx;ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,this.w,this.h);ctx.fillStyle='#142b2b';ctx.fillRect(0,0,this.w,this.h);this.hitRegions=[];if(!this.ready)return;
  if(this.mode==='planning'){const s=Math.min(this.w/ART_WIDTH,this.h/ART_HEIGHT);ctx.drawImage(this.domain,(this.w-ART_WIDTH*s)/2,(this.h-ART_HEIGHT*s)/2,ART_WIDTH*s,ART_HEIGHT*s);return;}
  if(this.followId){const p=view.people.find(p=>p.id===this.followId);if(p&&!p.indoor){const a=this.displayPoint(p);this.camera.x=a.x;this.camera.y=a.y-75;this.constrain();}}
  const s=this.fit*this.camera.zoom;ctx.translate(this.w/2-this.camera.x*s,this.h/2-this.camera.y*s);ctx.scale(s,s);ctx.imageSmoothingEnabled=false;
  if(this.reference){ctx.drawImage(this.original,0,0);return;}
  this.paintEnvironment(ctx,view);
  if(this.target){ctx.strokeStyle='#e9dca4';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(this.target.x,this.target.y,13,5,0,0,Math.PI*2);ctx.stroke();}
  const queue=[];
  for(const p of view.people)if(!p.indoor)queue.push({y:this.displayPoint(p).y,person:p});
  for(const o of OCCLUDERS)queue.push({y:o.feetY,occluder:o});queue.sort((a,b)=>a.y-b.y);
  for(const item of queue){if(item.person)this.drawActor(item.person);else{ctx.save();trace(ctx,item.occluder.polygon);ctx.clip();ctx.drawImage(this.plate,0,0);ctx.restore();}}
  const hovered=view.people.find(p=>p.id===this.hover||p.id===this.selected);if(hovered&&!hovered.indoor){const a=this.displayPoint(hovered),height=this.frameFor(hovered).table.height;ctx.font='16px "Songti SC",serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#152b2d';ctx.strokeText(hovered.name,a.x,a.y-height-12);ctx.fillStyle='#fff0c1';ctx.fillText(hovered.name,a.x,a.y-height-12);}
 }
}
