import {drawCultivator,restRenderAnchor,registerCultivatorAtlas,hasCultivatorAtlas,CULTIVATOR_REST_ATLAS,registerCultivatorRestAtlas,hasCultivatorRestAtlas,drawRestingCultivator,CULTIVATOR_ACTIVITY_ATLAS,registerCultivatorActivityAtlas} from './ea-character-art.mjs?v=ea-160-courtyard-20261008-r1';
import {drawEstateGround,drawEstateField,drawEstateOutdoorFallback} from './ea-estate-ground-art.mjs?v=ea-160-courtyard-20261008-r1';
import {ESTATE_ART_URLS,drawEstateExterior,estateSpriteBounds,estateSpriteContains,estateStageImageReady} from './ea-estate-assets.mjs?v=ea-160-courtyard-20261008-r1';
import {drawLocalSceneGround,drawLocalSceneObject,worldObjectContains,worldObjectApproach} from './ea-world-scene-art.mjs?v=ea-160-courtyard-20261008-r1';
import {BUILDINGS} from './ea-data.mjs?v=ea-160-courtyard-20261008-r1';
import {BUILDING_GRID,buildingGridEnabled,buildingCellLabel,snapBuildingPoint} from './ea-building-grid.mjs?v=ea-160-courtyard-20261008-r1';
import {spatialEnabled,spatialProject,spatialUnproject,spatialPrefab,spatialTransform,spatialAccess,spatialFootprint,polygonContains,SPATIAL_TERRAIN,placementIssue,viewSpatial,spatialRevision,SPATIAL_SCENE} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r1';
import {hallInterior,indoorBuildingAt} from './ea-hall-interior.mjs?v=ea-160-courtyard-20261008-r1';
import {constructionView} from './ea-construction-view.mjs?v=ea-160-courtyard-20261008-r1';
import {personHitCandidates} from './ea-scene-picking.mjs?v=ea-160-courtyard-20261008-r1';
import {createWorldRenderer as createPlanRenderer} from './ea-renderer.mjs?v=ea-160-courtyard-20261008-r1';
import {WIDTH,HEIGHT,point,LANDMARKS,inPolygon} from './yunxiu-courtyard/navigation.mjs?v=ea-160-courtyard-20261008-r1';
import {foreground} from './ea-foreground.mjs?v=ea-160-courtyard-20261008-r1';
import {appearance,scenicPosition,advanceScenic,repairScenicActor} from './ea-scenic.mjs?v=ea-160-courtyard-20261008-r1';
import {facilityRecords,courtyardDestination,scenicHomeActors} from './ea-scene-state.mjs?v=ea-160-courtyard-20261008-r1';
import {SCENIC_PLOTS,SCENE_ROADS,scenicPoint,scenicInverse,scenicNearest,scenicFindPath,scenicDistance,scenicCanStand,geometryRevision,facilityHit,plotPolygon,buildingVisual,buildingAccess} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r1';
import {createAssetLoader} from './ea-runtime.mjs?v=ea-160-courtyard-20261008-r1';
import fallbackMeta from './ea-character-frames.mjs?v=ea-160-courtyard-20261008-r1';
import {equippedAppearanceMounts,viewEquipment} from './ea-sr-equipment.mjs?v=ea-160-courtyard-20261008-r1';

export function estateBuildingVisualStage(s,b){
 if(!['house','hall','clinic','library','farm','lumber','quarry','meditation','alchemy','well','granary','kitchen','workshop','watchtower'].includes(b.type))return null;
 const operation=b.spatialLock&&s.workOrdersById?.[b.spatialLock]?.operation;
 return operation==='upgrade'?'upgrade':b.condition<50?'damaged':'complete';
}

/** Actual equipped instances only; NPC candidates come from the existing public projection. */
export function sceneEquipmentMounts(s,personId,visibleNpcItems=null){
 const items=personId==='person:master'?Object.values(s.itemsById||{}):visibleNpcItems??viewEquipment(s).visibleNpcItems;
 return equippedAppearanceMounts(s,personId,items);
}

export function createWorldRenderer(canvas,options){
 if(spatialEnabled(options.getState()))return createMetreRenderer(canvas,options);
 const {getState,getMode,getSelection,getCampaignScene,getPrefs=()=>({}),getPreview=()=>null,getHomeInteractions=()=>[],onLoad=()=>{}}=options;
 const ctx=canvas.getContext('2d'),pan={x:0,y:0},actors=new Map();
 let planFailed=[],bg,emptyBg,hallLayers,atlas,meta=fallbackMeta,overview=false,zoom=1,planning=false,scene='map',hover=null,lastTime=null,session=null,frameAt=0;
 const plan=createPlanRenderer(canvas,{...options,onLoad:failed=>{planFailed=failed;}});
 const load=src=>({signal}={})=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error(src));signal?.addEventListener('abort',()=>{im.onload=null;im.onerror=null;reject(new Error('画卷加载超时'));},{once:true});im.src=new URL(src,import.meta.url).href;});
 const assets=createAssetLoader({loaders:{courtyard:load('./assets/ea-courtyard-empty.jpg'),indoorGround:load('./assets/ea-courtyard-ground-v1.png'),hallLayers:load('./assets/ea-hall-layers-v1.png'),people:load('./yunxiu-courtyard/assets/characters.webp'),frames:async({signal})=>{const r=await fetch(new URL('./yunxiu-courtyard/assets/character-frames.json',import.meta.url),{signal});if(!r.ok)throw Error('人物素材');const value=await r.json();if(!Array.isArray(value.frames)||value.frames.length<4)throw Error('人物帧资料不完整');return value;}},onChange:status=>{bg=assets.get('courtyard');emptyBg=assets.get('indoorGround');hallLayers=assets.get('hallLayers');atlas=assets.get('people');meta=assets.get('frames')||fallbackMeta;onLoad([...planFailed,...status.failed.map(v=>v.id)]);}});
 const readyPromise=Promise.allSettled([assets.load(),plan.ready]);
 const isPlan=()=>planning||['build','move'].includes(getMode());
 const delegate=()=>!!getCampaignScene(getState())||scene!=='map';
 function camera(){const w=canvas.clientWidth,h=canvas.clientHeight,mobile=!overview&&w<760&&h>w,s=(mobile?Math.max(w/WIDTH,h/HEIGHT)*1.05:Math.min(w/WIDTH,h/HEIGHT))*zoom,master=scenicPosition(getState().master);return{w,h,scale:s,ox:mobile?Math.min(0,Math.max(w-WIDTH*s,w*.52-master.x*s+pan.x)):(w-WIDTH*s)/2+pan.x,oy:mobile?Math.min(0,Math.max(h-HEIGHT*s,h*.5-master.y*s+pan.y)):(h-HEIGHT*s)/2+pan.y};}
 function screenPoint(e){if(delegate())return plan.screenPoint(e);const r=canvas.getBoundingClientRect(),c=camera();return{x:(e.clientX-r.left-c.ox)/c.scale,y:(e.clientY-r.top-c.oy)/c.scale};}
 function updatePeople(s,records){
  if(session!==s||lastTime===null||s.time<lastTime){actors.clear();session=s;lastTime=s.time;}
  const dt=Math.min(4,Math.max(0,s.time-lastTime));lastTime=s.time;
  const present=scenicHomeActors(s),ids=new Set(present.map(d=>d.id));for(const id of actors.keys())if(!ids.has(id))actors.delete(id);
  for(const d of present){let a=actors.get(d.id);if(!a){a={...point('centre'),id:d.id,path:[],steps:0,facing:1,back:false};actors.set(d.id,a);}
   const dest=courtyardDestination(s,d,records),p=dest?.access||point('mainDoor'),offset=((d.id%5)-2)*5,target=scenicNearest(s,{x:p.x+offset,y:p.y})||p;
   const persistent=d.mind?.scenic,destination=`${dest?.id}:${target.x.toFixed(1)}:${target.y.toFixed(1)}:${geometryRevision(s)}`;
   if(persistent){Object.assign(a,persistent,{path:persistent.path.slice()});}
   else{if(a.destination!==destination){repairScenicActor(a,s);a.path=scenicFindPath(s,a,target)||[];a.goal=a.path.at(-1)||null;a.destination=destination;}if(dt&&a.path.length)advanceScenic(a,dt*31,s);}
   a.d=d;a.facility=dest;
  }
 }
 function sprite(a,master=false){
  const moving=master?getState().master.action==='walk'&&a.path.length:a.path.length,row=moving?(a.back?3:1+Math.floor((a.steps||0)/11)%2):0,person=master?getState().master:a.d,f=meta.frames[row][person?.appearance?.spriteIndex??appearance(master?'master':a.id)],height=getState().schemaVersion===6?58:45+a.y/HEIGHT*5,scale=height/f.h;
  ctx.save();ctx.fillStyle='#10291b55';ctx.beginPath();ctx.ellipse(a.x,a.y,9,3,0,0,Math.PI*2);ctx.fill();
  if(person?.appearance){ctx.fillStyle=person.appearance.accent;ctx.beginPath();ctx.arc(a.x+13,a.y-39,3,0,Math.PI*2);ctx.fill();}
  if(master){ctx.strokeStyle='#f8dda0c0';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(a.x,a.y,14,5,0,0,Math.PI*2);ctx.stroke();}
  for(const fg of (indoorBuildingAt(getState(),a)?[]:foreground).filter((_,i)=>i!==3))if(fg.zone(a)){ctx.beginPath();ctx.rect(0,0,WIDTH,HEIGHT);fg.poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip('evenodd');}
  ctx.translate(a.x,a.y);ctx.scale(a.facing||1,1);if(atlas)ctx.drawImage(atlas,f.x,f.y,f.w,f.h,-f.footX*scale,-f.footY*scale,f.w*scale,f.h*scale);else{ctx.fillStyle=master?'#cda262':'#799c80';ctx.beginPath();ctx.ellipse(0,-20,8,18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e6cda0';ctx.beginPath();ctx.arc(0,-39,6,0,Math.PI*2);ctx.fill();}ctx.restore();
  if(!moving&&!getPrefs().reducedMotion){const action=master?getState().master.action:a.d?.mind?.activity;if(['heal','cultivate','study','teach'].includes(action)){ctx.strokeStyle=action==='heal'?'#afdcad':'#e8d290';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(a.x,a.y-6,18,7,getState().time*.4,0,Math.PI*1.5);ctx.stroke();}}
 }
 function tag(text,p,{color='#173e35ec',small=false}={}){ctx.font=`${small?12:14}px serif`;ctx.textAlign='center';const width=ctx.measureText(text).width+16;ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(p.x-width/2,p.y+9,width,small?21:25,5);ctx.fill();ctx.fillStyle='#f5dfae';ctx.fillText(text,p.x,p.y+(small?24:27));}
 function facility(r,s){
  const b=r.building,p=r.position,selected=getSelection()?.kind==='building'&&getSelection().id===r.id;
  if(!hallInterior(s,r.building)&&(r.type!=='hall'||!bg)){
   ctx.save();if(!r.active)ctx.filter='grayscale(.85)';else if(b.condition<50)ctx.filter='sepia(.5)';plan.drawFacility(b,1,p,r.size||140);ctx.restore();
   if(r.active&&r.workers.length){ctx.strokeStyle='#f1d590';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+7,r.size*.3,6,0,0,Math.PI*2);ctx.stroke();}
   if(r.type==='alchemy'&&s.crafting&&r.active){ctx.fillStyle='#f0d498bb';ctx.beginPath();ctx.arc(p.x,p.y-r.size*.75,4,0,Math.PI*2);ctx.fill();}
  }
  if(!overview&&selected&&s.schemaVersion===6){for(const slot of r.slots){ctx.fillStyle=slot.personId?'#cfae78':'#68826d';ctx.beginPath();ctx.ellipse(slot.position.x,slot.position.y,6,2.8,0,0,Math.PI*2);ctx.fill();}}
  if(!overview&&(selected||r.type==='hall'))tag(`${r.name} · ${b.level}级${r.active?'':' · 停用'}${r.workers.length?' · '+r.workers.length+'人':''}`,hallInterior(s,b)?r.access:p,{small:r.type!=='hall',color:r.active?'#173e35ec':'#6c6055ed'});
  else if(!r.active){ctx.fillStyle='#776653';ctx.beginPath();ctx.arc(p.x+22,p.y-32,5,0,Math.PI*2);ctx.fill();}
  if(!overview&&selected&&r.type==='alchemy'&&s.crafting)tag(r.active?`炉火 · ${Math.ceil(s.crafting.remaining)}秒`:'炉火已暂停',{x:p.x,y:p.y+26},{small:true});
 }
 function polygon(points,{fill,stroke}={}){if(!points.length)return;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
 function roads(s){if(s.schemaVersion===6&&(!isPlan()||getPreview()))return;ctx.lineCap='round';for(const e of SCENE_ROADS.filter(e=>!e.painted)){ctx.strokeStyle='#b7ab8990';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(e.a.x,e.a.y);ctx.lineTo(e.b.x,e.b.y);ctx.stroke();ctx.strokeStyle='#e2d6b85b';ctx.lineWidth=7;ctx.stroke();}ctx.lineCap='butt';}
 function plots(s){
  const info=getPreview(),preview=info&&hover?{...info,x:hover.x,y:hover.y,valid:!info.lock}:null;
  if(!info||s.schemaVersion!==6){
   const occupied=new Set(s.buildings.map(b=>`${b.x},${b.y}`));
   for(const plot of SCENIC_PLOTS){const locked=(plot.x>=8||plot.y>=7)&&!s.sect.founded&&s.sect.level<2;
    polygon(plotPolygon(plot.x,plot.y),{fill:occupied.has(`${plot.x},${plot.y}`)?'#4a706433':locked?'#192e3933':'#e5dcad12',stroke:locked?'#927f6266':'#d8c68c99'});
    ctx.fillStyle=locked?'#c4bfa1':'#f5e8bc';ctx.font='10px serif';ctx.textAlign='center';ctx.fillText(`${plot.x}/${plot.y}`,plot.position.x,plot.position.y+7);
   }
  }
  if(info?.recommended){const p=scenicPoint(info.recommended.x,info.recommended.y);if(p){polygon(plotPolygon(info.recommended.x,info.recommended.y),{fill:'#ecd58b40',stroke:'#ecd58b'});tag('推荐位置',p,{small:true});}}
  if(preview?.x!==undefined){const b={type:preview.type,x:preview.x,y:preview.y,level:preview.level||1},v=buildingVisual(b);if(v){
   polygon(v.footprint,{fill:preview.valid?'#bad79588':'#be715577',stroke:preview.valid?'#e9dfa8':'#f5a184'});
   if(preview.type)plan.drawFacility(b,.55,v.position,v.size);
   const entry=buildingAccess(s,b);ctx.fillStyle=preview.valid?'#d8e6a6':'#efb09d';ctx.beginPath();ctx.ellipse(entry.x,entry.y,5,3,0,0,Math.PI*2);ctx.fill();
  }}
 }
 function drawConstruction(s){
  const v=constructionView(s);if(!v)return;
  polygon(v.footprint,{fill:'#a78e6266',stroke:'#e4c89b'});
  if(v.stage==='foundation'){for(const [x,y]of v.footprint){ctx.fillStyle='#b29463';ctx.fillRect(x-2,y-10,4,10);}}
  else if(v.stage==='structure'){const r=v.bounds;ctx.strokeStyle='#b29463';ctx.lineWidth=3;for(const x of [r.left+5,r.right-5]){ctx.beginPath();ctx.moveTo(x,r.bottom);ctx.lineTo(x,r.top+8);ctx.stroke();}ctx.beginPath();ctx.moveTo(r.left+5,r.top+8);ctx.lineTo(r.right-5,r.top+8);ctx.stroke();}
  else plan.drawFacility(v.building,.65,v.position,v.size);
  tag(v.label+' · '+Math.floor(v.progress*100)+'%',v.position,{small:true});
 }
 function storyObjects(s,records){return getHomeInteractions(s).map(object=>{const actor=object.personId&&actors.get(object.personId),r=records.find(r=>r.id===object.buildingId);return actor?{...object,position:{x:actor.x+19,y:actor.y-7}}:r?{...object,position:{x:r.access.x+19,y:r.access.y-7}}:null;}).filter(Boolean);}
 function storyMarker(object){const p=object.position;ctx.fillStyle='#cba967';ctx.strokeStyle='#f5e5b0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-24,13,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#283e32';ctx.font='bold 18px serif';ctx.textAlign='center';ctx.fillText(object.kind==='person'?'談':'卷',p.x,p.y-18);tag(object.name+' · '+(object.kind==='person'?'交谈':'查看'),{x:p.x,y:p.y-65},{small:true});}

 function drawHallRoof(s){
  const b=s.buildings.find(b=>b.type==='hall');if(!hallInterior(s,b)||!hallLayers)return;
  ctx.drawImage(hallLayers,5,808,1014,621,680,32,292,180);
 }
 function render(now=performance.now(),force=false){
  document.getElementById('viewport')?.classList.toggle('planning-view',isPlan()&&scene==='map');
  if(delegate()){plan.pan.x=pan.x;plan.pan.y=pan.y;return plan.render(now,force);}if(!force&&now-frameAt<(getPrefs().reducedMotion?65:30))return false;frameAt=now;
  const s=getState(),c=camera(),dpr=canvas.width/Math.max(1,c.w),records=facilityRecords(s);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#1d332e';ctx.fillRect(0,0,c.w,c.h);ctx.save();ctx.translate(c.ox,c.oy);ctx.scale(c.scale,c.scale);const ground=hallInterior(s,s.buildings.find(b=>b.type==='hall'))?emptyBg:bg;if(ground)ctx.drawImage(ground,0,0,WIDTH,HEIGHT);else{ctx.fillStyle='#718976';ctx.fillRect(0,0,WIDTH,HEIGHT);}roads(s);if(isPlan())plots(s);updatePeople(s,records);
  const m={...scenicPosition(s.master),path:scenicPosition(s.master).path.slice()};if(s.master.action==='walk'&&m.path.length&&!s.master.activityId)advanceScenic(m,46*((s.schemaVersion===6?(s.worldTick-s.schemaMigration.clockOriginTick)%10/10:0)+(s.sim.carry||0)),s);
  const items=records.map(r=>({y:r.position.y,facility:r}));if(!overview){for(const a of actors.values())if(!indoorBuildingAt(s,a))items.push({y:a.y,actor:a});if(!s.world?.exploration&&!s.combat&&!s.master.journey&&!indoorBuildingAt(s,m))items.push({y:m.y,actor:{...m,id:'master'}});}
  items.sort((a,b)=>a.y-b.y).forEach(item=>item.facility?facility(item.facility,s):sprite(item.actor,item.actor.id==='master'));
  drawHallRoof(s);
  if(!overview&&!isPlan())storyObjects(s,records).forEach(storyMarker);
  if(s.schemaVersion===6&&!overview){for(const a of actors.values()){if(indoorBuildingAt(s,a)||(getSelection()?.kind!=='person'||getSelection().id!==a.id)&&(!hover||scenicDistance(hover,a)>48))continue;const label=s.activitiesById[a.d?.activityId]?.action==='care'?(s.story.artisan.phase==='recovering'?'休养':'换药照护'):s.activitiesById[a.d?.activityId]?.phase==='waiting'?'等候工位':a.path.length?'行走':a.d?.mind?.activity==='work'?'照料':a.d?.mind?.activity==='study'?'研习':a.path.length?'行走':a.d?.mind?.activity==='cultivate'?'修炼':s.homeMemberIds.includes(a.d.personId)?'休憩':'来客';tag(a.d.name+' · '+label,{x:a.x,y:a.y+4},{small:true});}if(getSelection()?.kind==='person'&&getSelection().id==='master'&&!indoorBuildingAt(s,m))tag(s.master.name+' · 掌门',{x:m.x,y:m.y+4},{small:true});}
  drawConstruction(s);
  const selection=getSelection();if(selection?.kind==='person'){const a=actors.get(selection.id);if(a&&!indoorBuildingAt(s,a))tag(a.d.name,a);}
  if(getMode()==='walk'&&m.path?.length){ctx.setLineDash([5,6]);ctx.strokeStyle='#f6d494a0';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(m.x,m.y);m.path.forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);}
  if(overview){for(const type of new Set(records.map(r=>r.type))){const group=records.filter(r=>r.type===type),off=group.filter(r=>!r.active).length,p={x:group.reduce((v,r)=>v+r.position.x,0)/group.length,y:Math.max(...group.map(r=>r.position.y))};tag(`${group[0].name} ×${group.length}${off?' · 停用'+off:''}`,p,{small:type!=='hall'});}tag(`山院实况 · ${records.length}处设施 · ${s.disciples.length}名门人`,{x:840,y:25});s.society.peaks.forEach((peak,i)=>tag(peak.name+' · 查看峰域供给',{x:500+i*550,y:880}));}
  ctx.restore();if(!getPrefs().reducedMotion&&s.world.weather.id==='rain'){ctx.strokeStyle='#ecf3e355';for(let i=0;i<38;i++){const x=(i*167+now*.027)%c.w,y=(i*91+now*.19)%c.h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5,y+16);ctx.stroke();}}if(s.time%120>82){ctx.fillStyle='#102c4525';ctx.fillRect(0,0,c.w,c.h);}return true;
 }
 function pick(e){
  if(delegate())return plan.pick(e);const p=screenPoint(e),s=getState();if(['build','move'].includes(getMode())){const tile=scenicInverse(p,{maxDistance:45});return tile?{...tile,kind:'ground',scenic:false,worldX:p.x,worldY:p.y}:{x:-1,y:-1,kind:'ground',distance:Infinity};}
  if(!overview){const m=scenicPosition(s.master),people=personHitCandidates(p,[...actors.values(),{...m,id:'master',name:s.master.name,activity:s.master.action}].filter(a=>!indoorBuildingAt(s,a)),{scale:camera().scale,height:s.schemaVersion===6?58:45});if(people.length)return{...p,kind:people.length>1?'people':'person',id:people[0].id,candidates:people,scenic:true};const object=storyObjects(s,facilityRecords(s)).find(o=>scenicDistance(p,{x:o.position.x,y:o.position.y-24})<24);if(object)return{...p,kind:'story-object',id:object.id,buildingId:object.buildingId,scenic:true};}
  const r=facilityRecords(s).sort((a,b)=>b.position.y-a.position.y).find(r=>hallInterior(s,r.building)?p.x>=680&&p.x<=972&&p.y>=32&&p.y<=212:facilityHit(r.building,p));
  if(r)return{...p,kind:'building',id:r.id,scenic:true};if(overview){const peak=s.society.peaks.find((_,i)=>Math.abs(p.x-(500+i*550))<180&&Math.abs(p.y-900)<40);if(peak)return{...p,kind:'peak',id:peak.id};}
  const l=LANDMARKS.find(l=>(l.id!=='main'||!hallInterior(s,s.buildings.find(b=>b.type==='hall')))&&inPolygon(p,l.hit));return{...p,kind:l?'area':'ground',id:l?.id,scenic:true};
 }
 return {pan,ready:readyPromise,render,resize:()=>{plan.resize();render(performance.now(),true);},pick,screenPoint,mapPoint:e=>delegate()?plan.mapPoint(e):isPlan()?scenicInverse(screenPoint(e),{maxDistance:45})||{x:-1,y:-1}:screenPoint(e),setHover:e=>{hover=e?(isPlan()?scenicInverse(screenPoint(e),{maxDistance:45}):screenPoint(e)):null;plan.setHover(e);},getHover:()=>delegate()?plan.getHover():hover,setHoverPlot:p=>{hover=p?{x:p.x,y:p.y}:null;},focusScenic:(x,y)=>{const p=scenicPoint(x,y);if(p){const c=camera();pan.x+=c.w*.5-(p.x*c.scale+c.ox);pan.y+=c.h*.45-(p.y*c.scale+c.oy);}},
  setGrid:v=>{planning=v??!planning;overview=false;plan.setGrid(planning);return planning;},setZoom:(d,at)=>{if(delegate())return plan.setZoom(d,at);zoom=Math.max(.8,Math.min(2.3,zoom+d));return zoom;},recenter:()=>{pan.x=pan.y=0;zoom=1;plan.recenter();},
  focus:(x,y,arena=false)=>{if(delegate())plan.focus(x,y,arena);else{const selection=getSelection(),r=selection?.kind==='building'?facilityRecords(getState()).find(r=>r.id===selection.id):null,a=selection?.kind==='person'?actors.get(selection.id):null,p=a||r?.position||scenicPosition(getState().master),c=camera();pan.x+=c.w*.5-(p.x*c.scale+c.ox);pan.y+=c.h*.4-(p.y*c.scale+c.oy);}},
  getPersonPosition:id=>{const s=getState();if(id==='master')return {...scenicPosition(s.master)};const d=scenicHomeActors(s).find(d=>d.id===id);if(!d||!scenicHomeActors(s).some(p=>p.id===id))return null;const a=d.mind?.scenic||actors.get(id);return a?{x:a.x,y:a.y}:null;},
  retryAssets:async()=>{await Promise.allSettled([assets.retry(),plan.retryAssets?.()]);render(performance.now(),true);return assets.snapshot();},loadingState:()=>({...assets.snapshot(),plan:plan.loadingState?.()}),
  setOverview:v=>{overview=v??!overview;if(overview)planning=false;pan.x=pan.y=0;zoom=1;return overview;},setScene:id=>{overview=false;scene=id;plan.setScene(id);},getScene:()=>scene,isPlanning:isPlan,destroy:plan.destroy,point:(x,y,arena=false)=>arena||delegate()?plan.point(x,y,arena):scenicPoint(x,y)};
}

/** Real metre scene, using one projection for terrain, prefabs, people and input. */
function createMetreRenderer(canvas,options){
 const {getState,getMode,getSelection,getPrefs=()=>({}),getPreview=()=>null,getHomeInteractions=()=>[],getLocalScene=()=>null,getAppearance=()=>null,onLoad=()=>{}}=options;
 const ctx=canvas.getContext('2d'),pan={x:0,y:0};let zoom=1,overview=false,planning=false,hover=null,anchor=null,scene='map',atlas=null,destroyed=false,frameNpcEquipment=[];const initial=getState().master.scenic||{x:27,y:10},centre={x:initial.x,y:initial.y};
 // The mountain and estate ground change only with camera/terrain/resource state.
 // Keep them in a separate retained bitmap so dense high-DPR scenes do not
 // repaint two full-screen images beneath every actor on every frame.
 const groundCanvas=canvas.parentElement&&globalThis.document?.createElement?.('canvas');
 const groundCtx=groundCanvas?.getContext?.('2d')||null;
 const originalCanvasBackground=canvas.style?.background||'';
 if(groundCtx){groundCanvas.setAttribute('aria-hidden','true');groundCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;';canvas.parentElement.insertBefore(groundCanvas,canvas);canvas.style.background='transparent';}
 let groundViewKey=null,estateArtRevision=0;
 const estateImages={};
 const loadImage=src=>({signal}={})=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('山院素材加载失败'));signal?.addEventListener('abort',()=>reject(Error('山院素材加载超时')),{once:true});im.src=new URL(src,import.meta.url).href;});
 const assets=createAssetLoader({loaders:{people:loadImage('./yunxiu-courtyard/assets/characters.webp'),restPeople:loadImage(CULTIVATOR_REST_ATLAS.source),activityPeople:loadImage(CULTIVATOR_ACTIVITY_ATLAS.source),...Object.fromEntries(Object.entries(ESTATE_ART_URLS).map(([id,src])=>[id,loadImage(src)]))},onChange:status=>{atlas=assets.get('people');registerCultivatorAtlas(atlas);registerCultivatorRestAtlas(assets.get('restPeople'));registerCultivatorActivityAtlas(assets.get('activityPeople'));for(const id of Object.keys(ESTATE_ART_URLS))estateImages[id]=assets.get(id);estateArtRevision++;onLoad(status.failed.map(f=>f.id));}});
 const ready=assets.load().then(status=>{resize();return status;});
 const atHome=s=>{const loc=s.master.location;return loc?.kind!=='local'||!loc.sceneId||['scene:yunxiu','scene:yunxiu-courtyard'].includes(loc.sceneId);};
 const camera=()=>{
  const w=canvas.clientWidth||800,h=canvas.clientHeight||600,s=getState(),home=!options.getCampaignScene?.(s)&&atHome(s);
  const rotation=home?Math.PI/4:0,depth=home?.62:.65,co=Math.cos(rotation),si=Math.sin(rotation);
  const worldWidth=home?SPATIAL_SCENE.width:64,worldHeight=home?SPATIAL_SCENE.height:64;
  const scale=overview?Math.min(w/(worldWidth*co+worldHeight*si),h/((worldWidth*si+worldHeight*co)*depth))*.88:32*zoom;
  const focus=overview&&home?{x:worldWidth/2,y:worldHeight/2}:centre;
  let ox=w/2-(focus.x*co-focus.y*si)*scale+pan.x,oy=h/2-(focus.x*si+focus.y*co)*scale*depth+pan.y;if(home){const left=-worldHeight*si*scale,right=worldWidth*co*scale,bottom=(worldWidth*si+worldHeight*co)*scale*depth;ox=right-left>=w?Math.min(-left,Math.max(w-right,ox)):(w-left-right)/2;oy=bottom>=h?Math.min(0,Math.max(h-bottom,oy)):(h-bottom)/2;}return{w,h,scale,depth,rotation,ox,oy};
 };
 function syncBitmap(){const {w,h}=camera(),dpr=Math.max(1,Math.min(Number(globalThis.devicePixelRatio)||1,1.75)),width=Math.max(1,Math.round(w*dpr)),height=Math.max(1,Math.round(h*dpr));if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;if(groundCtx&&(groundCanvas.width!==width||groundCanvas.height!==height)){groundCanvas.width=width;groundCanvas.height=height;groundCtx.imageSmoothingEnabled=true;groundCtx.imageSmoothingQuality='high';groundViewKey=null;}ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';}
 function resize(){syncBitmap();return render(0,true);}
 const css=e=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
 const screenPoint=e=>spatialUnproject(css(e),camera());
 const local=()=>{const s=getState();return atHome(s)?null:getLocalScene(s);};
 const campaign=()=>options.getCampaignScene?.(getState())||null;let campaignIdentity=null;
 const combatPeople=()=>{const s=getState(),c=campaign();if(!c)return null;return [...(c.allies||[]).map(p=>({...p,role:'ally'})),...(c.enemies||[]).map(p=>({...p,role:'enemy'})),{...c.player,id:'master',personId:'person:master',name:s.master.name,role:'master'}].map(p=>{const person=s.personsById[p.personId]||s.disciples.find(d=>d.id===p.id)||p,hit=(c.effects||[]).some(e=>e.kind==='hit'&&e.targetId===p.id),cast=(c.effects||[]).some(e=>['spell','attack','strike'].includes(e.kind)&&e.sourceId===p.id);return{id:p.id,person,name:p.name,position:p.position||p,role:p.role,hp:p.hp,maxHp:p.maxHp||p.hpMax||100,actionOverride:hit?'hit':cast||p.windup||p.telegraph||p.role==='master'&&s.srCombat?.pending?'cast':p.target?'walk':p.hp<=0?'down':'stand'};});};
 const awayScene=()=>{const l=local();return l?.scene&& !['scene:yunxiu','scene:yunxiu-courtyard'].includes(l.scene.id)?l:null;};
 const people=()=>{const s=getState(),battle=combatPeople();if(battle)return battle;const l=awayScene();if(l)return [...(l.scene.player?[l.scene.player]:[]),...(l.actors||l.scene.actors||[])].map(p=>({...p,id:p.personId==='person:master'?'master':getState().personsById[p.personId]?.id??p.id??p.personId,name:p.name,person:getState().personsById[p.personId]||p,position:p.location||p.position||p}));return [s.master,...scenicHomeActors(s)].map(p=>({id:p===s.master?'master':p.id,person:p,name:p.name,position:p===s.master?p.scenic:p.mind?.scenic})).filter(p=>p.position);};
 function poly(points,{fill,stroke='#514b3c',width=1}={}){const c=camera();ctx.beginPath();points.forEach(([x,y],i)=>{const p=spatialProject({x,y},c);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
 const rectangle=(x,y,w,h,fill,stroke)=>poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],{fill,stroke});
 function label(text,p,color='#213d33e8'){const q=spatialProject(p,camera());ctx.font='13px serif';ctx.textAlign='center';const w=ctx.measureText(text).width+14;ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(q.x-w/2,q.y+8,w,23,4);ctx.fill();ctx.fillStyle='#f1deb1';ctx.fillText(text,q.x,q.y+24);}
 const artOptions={project:spatialProject,prefab:spatialPrefab,transform:spatialTransform};
 const depthAt=p=>{const c=camera();return p.x*Math.sin(c.rotation)+p.y*Math.cos(c.rotation);};
 function floor(b,alpha=1){
  const d=spatialPrefab(b);ctx.save();ctx.globalAlpha=alpha;
  if(!drawEstateField(ctx,b,getState(),camera(),artOptions)){
   if(d.indoor&&!estateStageImageReady(b.type,estateImages[`${b.type}Stages`]))poly(spatialFootprint(b),{fill:'#7c866438',stroke:'#75836170',width:.8});
   else if(!d.indoor&&!estateStageImageReady(b.type,estateImages[`${b.type}Stages`]))poly(spatialFootprint(b),{fill:'#b7b697',stroke:'#8c9478',width:1});
  }ctx.restore();
 }
 const openAirWorkTypes=new Set(['farm','granary','lumber','quarry','meditation','well']);
 let groundGeometryRevision=null,terrainFootprints=[],indoorFootprints=[],outdoorWorksites=[];
 function sceneFootprints(s){
  const revision=spatialRevision(s);
  if(groundGeometryRevision!==revision){
   groundGeometryRevision=revision;
   terrainFootprints=s.buildings.map(spatialFootprint);
   indoorFootprints=[];outdoorWorksites=[];
   s.buildings.forEach((b,i)=>{
    if(spatialPrefab(b).indoor)indoorFootprints.push(terrainFootprints[i]);
    else if(openAirWorkTypes.has(b.type))outdoorWorksites.push({building:b,footprint:terrainFootprints[i]});
   });
  }
  return indoorFootprints;
 }
 function ground(){
  const s=getState();sceneFootprints(s);
  // U-98: grid land first; paving is deferred. Actual navigation remains in
  // the shared simulation geometry, independent of decorative roads.
  const c=camera(),isPlanning=planning||['build','move'].includes(getMode());
  if(groundCtx){
   const patches=Object.entries(s.srEconomy?.patches||{}).map(([kind,p])=>`${kind}:${p.remaining}:${p.max}:${p.position?.x}:${p.position?.y}:${p.position?.sceneId}`).join('|');
   const wet=s.ecologiesBySceneId?.['scene:yunxiu-courtyard']?.surfaceZones?.['zone:yard-path']?.wetness||0;
   const key=[groundCanvas.width,groundCanvas.height,c.ox,c.oy,c.scale,c.depth,c.rotation,groundGeometryRevision,estateArtRevision,patches,wet,isPlanning].join(';');
   if(key!==groundViewKey){groundCtx.setTransform(groundCanvas.width/Math.max(1,c.w),0,0,groundCanvas.height/Math.max(1,c.h),0,0);drawEstateGround(groundCtx,s,c,{project:spatialProject,footprints:terrainFootprints,terrainArt:estateImages,planning:isPlanning});groundViewKey=key;}
  }else drawEstateGround(ctx,s,c,{project:spatialProject,footprints:terrainFootprints,terrainArt:estateImages,planning:isPlanning});
  if(hover&&!getPreview()&&hover.x>=0&&hover.x<SPATIAL_SCENE.width&&hover.y>=0&&hover.y<SPATIAL_SCENE.height){const step=BUILDING_GRID.metres,x=Math.floor(hover.x/step)*step,y=Math.floor(hover.y/step)*step;poly([[x,y],[x+step,y],[x+step,y+step],[x,y+step]],{fill:'#e8dfaa32',stroke:'#e8dfaa90',width:1});}
 }
 function unitCells(b,fill,stroke){
  const d=spatialPrefab(b),t=spatialTransform(b),step=BUILDING_GRID.metres;
  if(d.cells){for(let row=0;row<d.cells.rows;row++)for(let col=0;col<d.cells.columns;col++)poly([[t.x+col*step,t.y+row*step],[t.x+(col+1)*step,t.y+row*step],[t.x+(col+1)*step,t.y+(row+1)*step],[t.x+col*step,t.y+(row+1)*step]],{fill,stroke,width:1});}
  poly(spatialFootprint(b),{fill:d.cells?null:fill,stroke,width:2});
 }
 const walkPoint=e=>{const p=screenPoint(e);return !campaign()&&!awayScene()?{x:snapMetre(p.x),y:snapMetre(p.y)}:p;};
 function closedBuildingFallback(b,stage='complete'){
  const d=spatialPrefab(b),t=spatialTransform(b),c=camera(),lift=Math.min(2.4*c.scale,100);
  const base=[[0,0],[d.width,0],[d.width,d.height],[0,d.height]].map(([x,y])=>spatialProject({x:t.x+x,y:t.y+y},c));
  const top=base.map(p=>({x:p.x,y:p.y-lift}));
  const shape=(points,fill)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();};
  if(stage==='foundation'||stage==='structure'){
   const curb=base.map(p=>({x:p.x,y:p.y-.2*c.scale}));
   shape([curb[1],base[1],base[2],curb[2]],'#95856b');
   shape([curb[2],base[2],base[3],curb[3]],'#776c5b');
   shape(curb,'#aa9d7c');
   if(stage==='structure'){
    const frame=base.map(p=>({x:p.x,y:p.y-Math.min(1.9*c.scale,lift)}));
    ctx.strokeStyle='#866d4f';ctx.lineWidth=Math.max(2,c.scale*.1);ctx.beginPath();
    for(let i=0;i<4;i++){ctx.moveTo(curb[i].x,curb[i].y);ctx.lineTo(frame[i].x,frame[i].y);}
    for(const [a,b]of [[0,1],[1,2],[2,3],[3,0]]){ctx.moveTo(frame[a].x,frame[a].y);ctx.lineTo(frame[b].x,frame[b].y);}
    ctx.stroke();
   }
   return;
  }
  shape([top[1],base[1],base[2],top[2]],'#8c876f');
  shape([top[2],base[2],base[3],top[3]],'#716f61');
  shape(top,'#435b53');
  ctx.strokeStyle='#c8b58b';ctx.lineWidth=Math.max(1,c.scale*.035);ctx.beginPath();ctx.moveTo(top[0].x,top[0].y);ctx.lineTo(top[2].x,top[2].y);ctx.stroke();
 }
 function roof(b,alpha=1,visualStage=null){
  ctx.save();ctx.globalAlpha=alpha;
  if(!drawEstateExterior(ctx,b,camera(),estateImages,{...artOptions,alpha,visualStage:visualStage||estateBuildingVisualStage(getState(),b)})){
   if(spatialPrefab(b).indoor)closedBuildingFallback(b);
   else drawEstateOutdoorFallback(ctx,b,camera(),artOptions);
  }
  ctx.restore();
 }
 function buildingDepth(b){const d=spatialPrefab(b),t=spatialTransform(b);return depthAt({x:t.x+d.width/2,y:t.y+d.height/2});}
 function visiblePerson(record,closedRooms){
  return !closedRooms.some(footprint=>polygonContains(record.position,footprint));
 }
 function outdoorWorksiteAt(position){
  return outdoorWorksites.find(site=>polygonContains(position,site.footprint))?.building||null;
 }
 function buildingOnScreen(b,c,s){
  const box=estateSpriteBounds(b,c,{...artOptions,visualStage:estateBuildingVisualStage(s,b),stageImageAvailable:estateStageImageReady(b.type,estateImages[`${b.type}Stages`])});
  if(!box)return true;
  const margin=Math.max(48,c.scale*4);
  return box.x<=c.w+margin&&box.x+box.width>=-margin&&box.y<=c.h+margin&&box.bottom>=-margin;
 }
 function personOnScreen(position,c){
  const p=spatialProject(position,c),margin=Math.max(48,c.scale*4);
  return p.x>=-margin&&p.x<=c.w+margin&&p.y>=-margin&&p.y<=c.h+margin;
 }
 function actor(record){const p=record.position,q=spatialProject(p,camera()),s=getState(),person=record.person,next=p.path?.[0],toward=next?spatialProject(next,camera()):null,facing=toward&&Math.abs(toward.x-q.x)>.1?Math.sign(toward.x-q.x):typeof p.facing==='number'?p.facing:1,back=!!(toward&&toward.y<q.y-.1),a=s.activitiesById?.[person?.activityId],moving=p.path?.length,look=getAppearance(s,person?.personId)||null,rest=restRenderAnchor(s,person,{...artOptions,camera:camera()});if(rest?.poseVariant==='bed-rest'&&hasCultivatorRestAtlas()&&drawRestingCultivator(ctx,look||person?.appearance,rest,{selected:getSelection()?.kind==='person'&&getSelection()?.id===record.id})){if(getSelection()?.kind==='person'&&getSelection().id===record.id||hover&&Math.hypot(p.x-hover.x,p.y-hover.y)<1.5)label(`${record.name} · ${rest.label}`,rest.visualWorldPosition);return;}if(look?.recipe){drawAppearance(ctx,{...look,back,poseVariant:rest?.poseVariant,mounts:sceneEquipmentMounts(s,person?.personId,frameNpcEquipment),action:record.actionOverride||look.action},{x:q.x,y:q.y,scale:camera().scale,tick:s.worldTick+(s.sim?.carry||0)*10,atlas,facing,reducedMotion:!!getPrefs().reducedMotion});if(getSelection()?.kind==='person'&&getSelection().id===record.id||hover&&Math.hypot(p.x-hover.x,p.y-hover.y)<1.5)label(`${record.name} · ${(rest?.poseVariant==='bed-rest'?'床边歇息':rest?.label)||appearanceActionLabel(record.actionOverride||look.action)}`,p);return;}drawCultivator(ctx,{...person?.appearance,back,action:record.actionOverride||(moving?'walk':person?.mind?.activity||person?.action||'stand')},{x:q.x,y:q.y,scale:camera().scale,tick:s.worldTick,atlas,facing,reducedMotion:!!getPrefs().reducedMotion});if(getSelection()?.kind==='person'&&getSelection().id===record.id||hover&&Math.hypot(p.x-hover.x,p.y-hover.y)<1.5)label(`${record.name} · ${a?.phase==='executing'?a.action:a?.phase==='navigating'?'前往工位':moving?'行走':person?.mind?.activity||person?.action||'休憩'}`,p);}
 function render(now=0,force=false){if(destroyed)return false;syncBitmap();const battle=campaign();if(battle&&campaignIdentity!==(getState().combat?.journeyId||battle.regionId||battle.type)){campaignIdentity=getState().combat?.journeyId||battle.regionId||battle.type;centre.x=battle.player.x;centre.y=battle.player.y;pan.x=pan.y=0;}else if(!battle&&campaignIdentity!==null){campaignIdentity=null;centre.x=getState().master.scenic.x;centre.y=getState().master.scenic.y;pan.x=pan.y=0;}const s=getState(),c=camera(),ratio=canvas.width/Math.max(1,c.w),ratioY=canvas.height/Math.max(1,c.h),home=!battle&&!awayScene();frameNpcEquipment=home?viewEquipment(s).visibleNpcItems:Object.values(s.itemsById||{});ctx.setTransform(ratio,0,0,ratioY,0,0);if(groundCtx){groundCanvas.style.display=home?'block':'none';ctx.clearRect(0,0,c.w,c.h);}if(home)ground();else{ctx.fillStyle='#80987b';ctx.fillRect(0,0,c.w,c.h);}
  if(battle){const b=battle.arena?.bounds||{left:.5,top:.5,right:battle.width-.5,bottom:battle.height-.5};rectangle(b.left,b.top,b.right-b.left,b.bottom-b.top,'#a7ae87','#e0d2aa');for(const o of battle.obstacles||[])rectangle(o.x,o.y,o.w,o.h,o.kind==='crates'?'#957b55':'#788575','#526454');for(const enemy of battle.enemies||[]){const tel=enemy.telegraph||enemy.warning;if(tel){const at=tel.target||tel.position||tel,centre=spatialProject({x:at.x??enemy.x,y:at.y??enemy.y},c);ctx.fillStyle='#b9544445';ctx.strokeStyle='#de9d74';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(centre.x,centre.y,(tel.radius||1.3)*c.scale,(tel.radius||1.3)*c.scale*c.depth,0,0,Math.PI*2);ctx.fill();ctx.stroke();}}for(const node of s.srCombat?.nodes||[])if(node.until>s.worldTick){const p=spatialProject(node,c);ctx.fillStyle='#94c2ad35';ctx.strokeStyle='#afd7bb';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,node.radius*c.scale,node.radius*c.scale*c.depth,0,0,Math.PI*2);ctx.fill();ctx.stroke();}for(const l of battle.landmarks||[])label(l.name,l);for(const a of people().sort((a,b)=>a.position.y-b.position.y)){actor(a);if(Number.isFinite(a.hp)){const p=spatialProject(a.position,c);ctx.fillStyle='#304034';ctx.fillRect(p.x-22,p.y-65,44,5);ctx.fillStyle=a.role==='enemy'?'#c78c71':'#9ac49e';ctx.fillRect(p.x-22,p.y-65,44*Math.max(0,a.hp/a.maxHp),5);}}for(const effect of battle.effects||[]){if(['attack','spell','strike'].includes(effect.kind)){const a=spatialProject(effect.from,c),b=spatialProject(effect.to,c);ctx.strokeStyle=effect.kind==='spell'?'#b4dfc9':'#e4c08b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(a.x,a.y-25);ctx.lineTo(b.x,b.y-25);ctx.stroke();}}return true;}
  const l=awayScene();if(l){drawLocalSceneGround(ctx,l.scene,c,spatialProject);const objects=l.scene.objects||l.objects||[];for(const o of [...objects].sort((a,b)=>a.y-b.y))drawLocalSceneObject(ctx,o,l.scene,c,spatialProject);for(const o of objects)label(o.name,worldObjectApproach(o));people().sort((a,b)=>a.position.y-b.position.y).forEach(actor);return true;}
  const visibleBuildings=s.buildings.filter(b=>buildingOnScreen(b,c,s));
  for(const b of visibleBuildings)floor(b);
  const occupants=people(),closedRooms=sceneFootprints(s),layers=[];
  for(const b of visibleBuildings)layers.push({depth:buildingDepth(b),kind:'building',b});
  for(const a of occupants)if(visiblePerson(a,closedRooms)&&personOnScreen(a.position,c)){
   const rest=hasCultivatorRestAtlas()&&restRenderAnchor(s,a.person,{...artOptions,camera:c});
   const site=outdoorWorksiteAt(a.position),depth=depthAt(rest?.depthPosition||a.position);
   layers.push({depth:site?Math.max(depth,buildingDepth(site)+.001):depth,kind:'person',a});
  }
  layers.sort((a,b)=>a.depth-b.depth||Number(a.kind==='person')-Number(b.kind==='person'));
  for(const item of layers){if(item.kind==='building')roof(item.b);else actor(item.a);}
  for(const b of s.buildings){if(getSelection()?.kind==='building'&&getSelection().id===b.id||hover&&polygonContains(hover,spatialFootprint(b))){if(b.buildingGridVersion===BUILDING_GRID.version)unitCells(b,'#d9ce9420','#e9dba888');label(`${BUILDINGS[b.type].name} · ${b.buildingGridVersion===BUILDING_GRID.version?buildingCellLabel(b.type,b.level):b.level+'级'}${b.spatialLock?' · 改动中':''}`,spatialAccess(b));}}
  const selected=occupants.find(a=>getSelection()?.kind==='person'&&getSelection().id===a.id&&visiblePerson(a,closedRooms));
  if(selected){const rest=hasCultivatorRestAtlas()&&restRenderAnchor(s,selected.person,{...artOptions,camera:c});const q=rest?.poseVariant==='bed-rest'?rest:spatialProject(selected.position,c);ctx.strokeStyle='#f1d29a';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q.x,q.y,.35*c.scale,.18*c.scale,0,0,Math.PI*2);ctx.stroke();}
  const path=s.master.scenic?.path;if(path?.length){ctx.strokeStyle='#f4e2b18c';ctx.lineWidth=2;ctx.setLineDash([4,6]);ctx.beginPath();[s.master.scenic,...path].forEach((p,i)=>{const q=spatialProject(p,c);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.setLineDash([]);const q=spatialProject(path[path.length-1],c);ctx.strokeStyle='#f4e2b1';ctx.beginPath();ctx.ellipse(q.x,q.y,9,5,0,0,Math.PI*2);ctx.stroke();}
  const info=getPreview();if(info&&hover){const b={type:info.type,level:info.level||1,...(buildingGridEnabled(s)?{buildingGridVersion:BUILDING_GRID.version,interiorLayoutVersion:s.spatial?.interiorLayoutVersion}:{}),transform:{...snapBuildingPoint(s,hover),orientation:'south'}},issue=info.lock||placementIssue(s,b.type,b.transform.x,b.transform.y,{ignoreId:info.buildingId||info.id||null,level:b.level});floor(b,.5);roof(b,.4,'preview');unitCells(b,issue?'#b9684b40':'#c2d99544',issue?'#f2a38c':'#ecdeb0');label(`${buildingGridEnabled(s)?buildingCellLabel(b.type,b.level)+' · ':''}${issue||'入口连通 · 点击确认'}`,spatialAccess(b),issue?'#6e4035e8':'#254936e8');}
  const work=viewSpatial(s);if(work){const b=work.building;unitCells(b,'#b0986c55','#ead2a4');const stageImage=estateImages[`${b.type}Stages`],stage=work.operation==='upgrade'?'upgrade':work.operation==='demolish'?'damaged':work.stage;const stageArt=estateStageImageReady(b.type,stageImage)&&drawEstateExterior(ctx,b,c,estateImages,{...artOptions,alpha:.85,visualStage:stage});if(!stageArt){if(spatialPrefab(b).indoor)closedBuildingFallback(b,stage);else if(work.stage==='foundation'){for(const [x,y]of work.footprint){const p=spatialProject({x,y},c);ctx.fillStyle='#8d7655';ctx.fillRect(p.x-2,p.y-12,4,12);}}else if(work.stage==='structure'){const t=spatialTransform(b),d=spatialPrefab(b);for(const [x,y]of work.footprint){const p=spatialProject({x,y},c);ctx.strokeStyle='#95724f';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x,p.y-1.8*c.scale);ctx.stroke();}rectangle(t.x,t.y,d.width,d.height,'#c7b88522','#b59a69');}else{floor(b,.7);roof(b,.6);}}label(`${work.label} · ${Math.floor(work.progress*100)}%`,work.position);}
  for(const object of getHomeInteractions(s)){const p=occupants.find(a=>a.person?.personId===object.personId)?.position||s.buildings.find(b=>b.id===object.buildingId)&&spatialAccess(s.buildings.find(b=>b.id===object.buildingId));if(p){const q=spatialProject(p,c);ctx.fillStyle='#ddbc74';ctx.beginPath();ctx.arc(q.x+22,q.y-34,12,0,Math.PI*2);ctx.fill();}}
  return true;
 }
 function pick(e){const p=screenPoint(e),s=getState(),c=camera();const battle=campaign();if(battle){const q=css(e),enemy=(battle.enemies||[]).find(a=>{const v=spatialProject(a.position||a,c);return a.hp>0&&Math.abs(q.x-v.x)<=22&&q.y>=v.y-1.8*c.scale&&q.y<=v.y+6;}),landmark=(battle.landmarks||[]).find(a=>Math.hypot(a.x-p.x,a.y-p.y)<(a.radius||1));return{...p,kind:enemy?'enemy':landmark?'landmark':'ground',id:enemy?.id||landmark?.id,scenic:true};}if(['build','move'].includes(getMode()))return{...snapBuildingPoint(s,p),kind:'ground',scenic:false,worldX:p.x,worldY:p.y};const q=css(e),away=awayScene(),closedRooms=away?[]:sceneFootprints(s),hits=people().filter(r=>away||visiblePerson(r,closedRooms)).filter(r=>{const rest=hasCultivatorRestAtlas()&&restRenderAnchor(s,r.person,{...artOptions,camera:c});if(rest?.poseVariant==='bed-rest'){const b=rest.bounds,cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;return Math.abs(q.x-cx)<=Math.max(44,b.right-b.left)/2&&Math.abs(q.y-cy)<=Math.max(44,b.bottom-b.top)/2;}const foot=spatialProject(r.position,c),height=1.8*c.scale,width=Math.max(44,.9*c.scale);return Math.abs(q.x-foot.x)<=width/2&&q.y>=foot.y-Math.max(44,height)&&q.y<=foot.y+6&&(away||!s.buildings.some(b=>b!==outdoorWorksiteAt(r.position)&&buildingDepth(b)>depthAt(r.position)&&estateSpriteContains(q,b,c,estateImages,{...artOptions,visualStage:estateBuildingVisualStage(s,b)})));}).sort((a,b)=>depthAt(b.position)-depthAt(a.position)).map(r=>({id:r.id,name:r.name,activity:r.person?.mind?.activity||r.person?.action||'rest',x:r.position.x,y:r.position.y}));if(hits.length)return{...p,kind:hits.length>1?'people':'person',id:hits[0].id,candidates:hits,scenic:true};if(away){const object=(away.scene.objects||away.objects||[]).find(o=>worldObjectContains(o,p));return{...p,kind:object?'world-object':'ground',id:object?.id,approachPoint:object?worldObjectApproach(object):null,scenic:true};}for(const object of getHomeInteractions(s)){const at=people().find(a=>a.person?.personId===object.personId)?.position||s.buildings.find(b=>b.id===object.buildingId)&&spatialAccess(s.buildings.find(b=>b.id===object.buildingId));if(at){const q=spatialProject(at,c);if(Math.hypot(css(e).x-q.x-22,css(e).y-q.y+34)<=22)return{...p,kind:'story-object',id:object.id,buildingId:object.buildingId,scenic:true};}}const b=s.buildings.slice().sort((a,b)=>buildingDepth(b)-buildingDepth(a)).find(b=>polygonContains(p,spatialFootprint(b))||estateSpriteContains(q,b,c,estateImages,{...artOptions,visualStage:estateBuildingVisualStage(s,b)}));return{...p,kind:b?'building':'ground',id:b?.id,scenic:true};}
 function focusPoint(p){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;centre.x=p.x;centre.y=p.y;pan.x=pan.y=0;}
 function selectionPoint(){const selection=getSelection();if(selection?.kind==='person')return people().find(p=>p.id===selection.id)?.position||null;if(selection?.kind==='building'){const b=getState().buildings.find(b=>b.id===selection.id);return b?spatialAccess(b):null;}return null;}
 syncBitmap();
 return {pan,ready,render,pick,screenPoint,walkPoint,projectPoint:p=>spatialProject(p,camera()),getCamera:()=>({...camera()}),mapPoint:e=>{const p=screenPoint(e);return planning||['build','move'].includes(getMode())?snapBuildingPoint(getState(),p):p;},resize,setHover:e=>{anchor=e?css(e):null;hover=e?screenPoint(e):null;},getHover:()=>hover,setHoverPlot:p=>{hover=p?{x:p.x,y:p.y}:null;},focusScenic:(x,y)=>focusPoint({x,y}),setGrid:v=>{planning=v??!planning;return planning;},setZoom:(d,atClient)=>{const c=camera(),buttonFromOverview=overview&&!atClient,at=atClient?css(atClient):buttonFromOverview?{x:c.w/2,y:c.h/2}:anchor||{x:c.w/2,y:c.h/2},target=selectionPoint()||getState().master.scenic,before=buttonFromOverview&&target?target:spatialUnproject(at,c);overview=false;zoom=Math.max(.35,Math.min(2.5,zoom+d));const after=spatialProject(before,camera());pan.x+=at.x-after.x;pan.y+=at.y-after.y;return zoom;},recenter:()=>{zoom=1;overview=false;focusPoint(getState().master.scenic);},focus:(x,y)=>focusPoint(selectionPoint()||{x,y}),getPersonPosition:id=>people().find(p=>p.id===id)?.position||null,retryAssets:()=>assets.retry(),loadingState:()=>assets.snapshot(),setOverview:v=>{overview=v??!overview;return overview;},setScene:id=>{scene=id;const l=awayScene();if(l)focusPoint(people()[0]?.position||{x:32,y:24});},getScene:()=>scene,isPlanning:()=>planning||['build','move'].includes(getMode()),destroy:()=>{destroyed=true;if(groundCtx){groundCanvas.remove();canvas.style.background=originalCanvasBackground;}},point:(x,y)=>({x,y})};
}
const snapMetre=n=>Math.round(n/SPATIAL_SCENE.grid)*SPATIAL_SCENE.grid;

/** SR-XF-007 code-native frame recipe. Simulation facts select the action; this is a pure pose. */
export function appearanceFrame(view,tick=0,{reducedMotion=false}={}){
 const recipe=view?.recipe||{height:1.75,body:'regular',face:'oval',hair:'topknot',outfit:'disciple',faceMark:0},action=view?.action||'stand',phase=reducedMotion?0:(tick%24)/24*Math.PI*2,swing=Math.sin(phase),stride=['walk','transport'].includes(action)?swing*.2:0;
 const height=recipe.height||1.75,width=recipe.body==='slim'?.25:recipe.body==='broad'?.38:.3,bend=['plant','gather','work'].includes(action)?.18+Math.sin(phase)*.08:action==='hit'?-.22:0,seated=['study','heal','cultivate','teach','groundRest'].includes(action),sleep=['rest','down'].includes(action);
 const breathing=Math.sin(phase)*.008,torsoY=(seated?-height*.5:-height*.62)+breathing,headY=(seated?-height*.72:-height*.88)+breathing,armPhase=['plant','gather','work','cast'].includes(action)?swing*.17:seated?swing*.018:stride*.6;
 return {version:'procedural:yunxiu-v1',action,phase,height,width,bend,seated,sleep,bodyY:torsoY,headY,bob:['walk','transport'].includes(action)?Math.abs(swing)*.035:0,leftFoot:{x:-.1+stride,y:0},rightFoot:{x:.1-stride,y:0},leftHand:{x:-width-.08,y:torsoY+.23-armPhase},rightHand:{x:width+.08+(['cast','work','plant'].includes(action)?.13:0),y:torsoY+.23+armPhase},recipe,tool:view?.tool||null,mounts:view?.mounts||{}};
}
export function drawAppearance(ctx,view,{x=0,y=0,scale=32,tick=0,facing=1,reducedMotion=false,portrait=false,atlas}={}){
 drawCultivator(ctx,view,{x,y,scale,tick,facing,reducedMotion,portrait,atlas});return appearanceFrame(view,tick,{reducedMotion});
}

export function portraitDataURL(view){if(typeof document==='undefined'||!view||!hasCultivatorAtlas())return null;const canvas=document.createElement('canvas');canvas.width=96;canvas.height=112;const ctx=canvas.getContext('2d');ctx.fillStyle='#263d32';ctx.fillRect(0,0,96,112);drawAppearance(ctx,{...view,action:'stand'},{x:48,y:56+(view.recipe?.height||1.75)*.88*105,scale:105,portrait:true,reducedMotion:true});return canvas.toDataURL('image/png');}

export const appearanceActionLabel=action=>({stand:'站立',walk:'行走',work:'操作',plant:'栽培',gather:'采集',study:'研习',rest:'休养',groundRest:'暂歇',heal:'疗伤',cast:'施法',hit:'受击',transport:'搬运',waiting:'等候',down:'倒地',cultivate:'修炼',teach:'授业'}[action]||action);
