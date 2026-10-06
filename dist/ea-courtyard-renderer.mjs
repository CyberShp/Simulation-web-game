import {hallInterior,indoorBuildingAt,indoorRoofOpen} from './ea-hall-interior.mjs';
import {constructionView} from './ea-construction-view.mjs';
import {personHitCandidates} from './ea-scene-picking.mjs';
import {createWorldRenderer as createPlanRenderer} from './ea-renderer.mjs';
import {WIDTH,HEIGHT,point,LANDMARKS,inPolygon} from './yunxiu-courtyard/navigation.mjs';
import {foreground} from './ea-foreground.mjs';
import {appearance,scenicPosition,advanceScenic,repairScenicActor} from './ea-scenic.mjs';
import {facilityRecords,courtyardDestination,scenicHomeActors} from './ea-scene-state.mjs';
import {SCENIC_PLOTS,SCENE_ROADS,scenicPoint,scenicInverse,scenicNearest,scenicFindPath,scenicDistance,scenicCanStand,geometryRevision,facilityHit,plotPolygon,buildingVisual,buildingAccess} from './ea-scene-geometry.mjs';
import {createAssetLoader} from './ea-runtime.mjs';
import fallbackMeta from './ea-character-frames.mjs';

export function createWorldRenderer(canvas,options){
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

 function drawHallFloor(s){
  const b=s.buildings.find(b=>b.type==='hall'),r=hallInterior(s,b);if(!r||!hallLayers)return;
  // Source atlas frames keep the interior and roof separate. Actual floor and
  // furniture positions are registered in ea-hall-interior, not inferred per frame.
  ctx.drawImage(hallLayers,48,90,932,675,690,55,272,156);
 }
 function drawHallRoof(s,people){
  const b=s.buildings.find(b=>b.type==='hall');if(!hallInterior(s,b)||!hallLayers)return;
  const open=indoorRoofOpen(s,b,{selection:getSelection(),hover,actors:people});
  ctx.save();ctx.globalAlpha=open?.06:1;ctx.drawImage(hallLayers,5,808,1014,621,680,32,292,180);ctx.restore();
 }
 function render(now=performance.now(),force=false){
  document.getElementById('viewport')?.classList.toggle('planning-view',isPlan()&&scene==='map');
  if(delegate()){plan.pan.x=pan.x;plan.pan.y=pan.y;return plan.render(now,force);}if(!force&&now-frameAt<(getPrefs().reducedMotion?65:30))return false;frameAt=now;
  const s=getState(),c=camera(),dpr=canvas.width/Math.max(1,c.w),records=facilityRecords(s);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#1d332e';ctx.fillRect(0,0,c.w,c.h);ctx.save();ctx.translate(c.ox,c.oy);ctx.scale(c.scale,c.scale);const ground=hallInterior(s,s.buildings.find(b=>b.type==='hall'))?emptyBg:bg;if(ground)ctx.drawImage(ground,0,0,WIDTH,HEIGHT);else{ctx.fillStyle='#718976';ctx.fillRect(0,0,WIDTH,HEIGHT);}roads(s);if(isPlan())plots(s);drawHallFloor(s);updatePeople(s,records);if(s.story.artisan&&['care','recovering'].includes(s.story.artisan.phase)){for(const slot of records.find(r=>r.type==='hall')?.slots.filter(slot=>slot.kind==='care')||[]){ctx.fillStyle='#c3b58b';ctx.beginPath();ctx.ellipse(slot.position.x,slot.position.y,8,4,0,0,Math.PI*2);ctx.fill();}}
  const m={...scenicPosition(s.master),path:scenicPosition(s.master).path.slice()};if(s.master.action==='walk'&&m.path.length&&!s.master.activityId)advanceScenic(m,46*((s.schemaVersion===6?(s.worldTick-s.schemaMigration.clockOriginTick)%10/10:0)+(s.sim.carry||0)),s);
  const items=records.map(r=>({y:r.position.y,facility:r}));if(!overview){for(const a of actors.values())items.push({y:a.y,actor:a});if(!s.world?.exploration&&!s.combat&&!s.master.journey)items.push({y:m.y,actor:{...m,id:'master'}});}
  items.sort((a,b)=>a.y-b.y).forEach(item=>item.facility?facility(item.facility,s):sprite(item.actor,item.actor.id==='master'));
  drawHallRoof(s,[...actors.values(),...(!s.world?.exploration&&!s.combat&&!s.master.journey?[m]:[])]);
  if(!overview&&!isPlan())storyObjects(s,records).forEach(storyMarker);
  if(s.schemaVersion===6&&!overview){for(const a of actors.values()){if(getSelection()?.id!==a.id&&(!hover||scenicDistance(hover,a)>48))continue;const label=s.activitiesById[a.d?.activityId]?.action==='care'?(s.story.artisan.phase==='recovering'?'休养':'换药照护'):s.activitiesById[a.d?.activityId]?.phase==='waiting'?'等候工位':a.path.length?'行走':a.d?.mind?.activity==='work'?'照料':a.d?.mind?.activity==='study'?'研习':a.path.length?'行走':a.d?.mind?.activity==='cultivate'?'修炼':s.homeMemberIds.includes(a.d.personId)?'休憩':'来客';tag(a.d.name+' · '+label,{x:a.x,y:a.y+4},{small:true});}if(getSelection()?.id==='master')tag(s.master.name+' · 掌门',{x:m.x,y:m.y+4},{small:true});}
  drawConstruction(s);
  const selection=getSelection();if(selection?.kind==='person'){const a=actors.get(selection.id);if(a)tag(a.d.name,a);}
  if(getMode()==='walk'&&m.path?.length){ctx.setLineDash([5,6]);ctx.strokeStyle='#f6d494a0';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(m.x,m.y);m.path.forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);}
  if(overview){for(const type of new Set(records.map(r=>r.type))){const group=records.filter(r=>r.type===type),off=group.filter(r=>!r.active).length,p={x:group.reduce((v,r)=>v+r.position.x,0)/group.length,y:Math.max(...group.map(r=>r.position.y))};tag(`${group[0].name} ×${group.length}${off?' · 停用'+off:''}`,p,{small:type!=='hall'});}tag(`山院实况 · ${records.length}处设施 · ${s.disciples.length}名门人`,{x:840,y:25});s.society.peaks.forEach((peak,i)=>tag(peak.name+' · 查看峰域供给',{x:500+i*550,y:880}));}
  ctx.restore();if(!getPrefs().reducedMotion&&s.world.weather.id==='rain'){ctx.strokeStyle='#ecf3e355';for(let i=0;i<38;i++){const x=(i*167+now*.027)%c.w,y=(i*91+now*.19)%c.h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5,y+16);ctx.stroke();}}if(s.time%120>82){ctx.fillStyle='#102c4525';ctx.fillRect(0,0,c.w,c.h);}return true;
 }
 function pick(e){
  if(delegate())return plan.pick(e);const p=screenPoint(e),s=getState();if(['build','move'].includes(getMode())){const tile=scenicInverse(p,{maxDistance:45});return tile?{...tile,kind:'ground',scenic:false,worldX:p.x,worldY:p.y}:{x:-1,y:-1,kind:'ground',distance:Infinity};}
  if(!overview){const m=scenicPosition(s.master),people=personHitCandidates(p,[...actors.values(),{...m,id:'master',name:s.master.name,activity:s.master.action}],{scale:camera().scale,height:s.schemaVersion===6?58:45});if(people.length)return{...p,kind:people.length>1?'people':'person',id:people[0].id,candidates:people,scenic:true};const object=storyObjects(s,facilityRecords(s)).find(o=>scenicDistance(p,{x:o.position.x,y:o.position.y-24})<24);if(object)return{...p,kind:'story-object',id:object.id,buildingId:object.buildingId,scenic:true};}
  const r=facilityRecords(s).sort((a,b)=>b.position.y-a.position.y).find(r=>hallInterior(s,r.building)?p.x>=680&&p.x<=972&&p.y>=32&&p.y<=212:facilityHit(r.building,p));
  if(r)return{...p,kind:'building',id:r.id,scenic:true};if(overview){const peak=s.society.peaks.find((_,i)=>Math.abs(p.x-(500+i*550))<180&&Math.abs(p.y-900)<40);if(peak)return{...p,kind:'peak',id:peak.id};}
  const l=LANDMARKS.find(l=>(l.id!=='main'||!hallInterior(s,s.buildings.find(b=>b.type==='hall')))&&inPolygon(p,l.hit));return{...p,kind:l?'area':'ground',id:l?.id,scenic:true};
 }
 return {pan,ready:readyPromise,render,resize:()=>{plan.resize();render(performance.now(),true);},pick,screenPoint,mapPoint:e=>delegate()?plan.mapPoint(e):isPlan()?scenicInverse(screenPoint(e),{maxDistance:45})||{x:-1,y:-1}:screenPoint(e),setHover:e=>{hover=e?(isPlan()?scenicInverse(screenPoint(e),{maxDistance:45}):screenPoint(e)):null;plan.setHover(e);},getHover:()=>delegate()?plan.getHover():hover,setHoverPlot:p=>{hover=p?{x:p.x,y:p.y}:null;},focusScenic:(x,y)=>{const p=scenicPoint(x,y);if(p){const c=camera();pan.x+=c.w*.5-(p.x*c.scale+c.ox);pan.y+=c.h*.45-(p.y*c.scale+c.oy);}},
  setGrid:v=>{planning=v??!planning;overview=false;plan.setGrid(planning);return planning;},setZoom:d=>{if(delegate())return plan.setZoom(d);zoom=Math.max(.8,Math.min(2.3,zoom+d));return zoom;},recenter:()=>{pan.x=pan.y=0;zoom=1;plan.recenter();},
  focus:(x,y,arena=false)=>{if(delegate())plan.focus(x,y,arena);else{const selection=getSelection(),r=selection?.kind==='building'?facilityRecords(getState()).find(r=>r.id===selection.id):null,a=selection?.kind==='person'?actors.get(selection.id):null,p=a||r?.position||scenicPosition(getState().master),c=camera();pan.x+=c.w*.5-(p.x*c.scale+c.ox);pan.y+=c.h*.4-(p.y*c.scale+c.oy);}},
  getPersonPosition:id=>{const s=getState();if(id==='master')return {...scenicPosition(s.master)};const d=scenicHomeActors(s).find(d=>d.id===id);if(!d||!scenicHomeActors(s).some(p=>p.id===id))return null;const a=d.mind?.scenic||actors.get(id);return a?{x:a.x,y:a.y}:null;},
  retryAssets:async()=>{await Promise.allSettled([assets.retry(),plan.retryAssets?.()]);render(performance.now(),true);return assets.snapshot();},loadingState:()=>({...assets.snapshot(),plan:plan.loadingState?.()}),
  setOverview:v=>{overview=v??!overview;if(overview)planning=false;pan.x=pan.y=0;zoom=1;return overview;},setScene:id=>{overview=false;scene=id;plan.setScene(id);},getScene:()=>scene,isPlanning:isPlan,destroy:plan.destroy,point:(x,y,arena=false)=>arena||delegate()?plan.point(x,y,arena):scenicPoint(x,y)};
}
