import {createWorldRenderer as createPlanRenderer} from './ea-renderer.mjs?v=ea-120-preview-20261005-r1';
import {WIDTH,HEIGHT,point,nearest,LANDMARKS,inPolygon,findPath} from '../yunxiu-courtyard/navigation.mjs?v=ea-120-preview-20261005-r1';
import {foreground} from './ea-foreground.mjs?v=ea-120-preview-20261005-r1';
import {appearance,scenicPosition,advanceScenic} from './ea-scenic.mjs?v=ea-120-preview-20261005-r1';
import {facilityRecords,courtyardDestination,scenicHomeActors} from './ea-scene-state.mjs?v=ea-120-preview-20261005-r1';

export function createWorldRenderer(canvas,options){
 const {getState,getMode,getSelection,getCampaignScene,getPrefs=()=>({}),onLoad=()=>{}}=options;
 const ctx=canvas.getContext('2d'),pan={x:0,y:0},actors=new Map();
 let planFailed=[],bg,atlas,meta,overview=false,zoom=1,planning=false,scene='map',hover=null,lastTime=null,session=null,ready=false;
 const plan=createPlanRenderer(canvas,{...options,onLoad:failed=>{planFailed=failed;}});
 const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(src);im.src=new URL(src,import.meta.url).href;});
 const readyPromise=Promise.all([load('../assets/ea-courtyard-empty.jpg'),load('../yunxiu-courtyard/assets/characters.webp'),fetch(new URL('../yunxiu-courtyard/assets/character-frames.json',import.meta.url)).then(r=>{if(!r.ok)throw Error('人物素材');return r.json();}),plan.ready]).then(([b,a,m])=>{bg=b;atlas=a;meta=m;ready=true;onLoad(planFailed);}).catch(error=>onLoad([String(error)]));
 const isPlan=()=>planning||['build','move'].includes(getMode());
 const delegate=()=>!!getCampaignScene(getState())||scene!=='map'||isPlan();
 function camera(){const w=canvas.clientWidth,h=canvas.clientHeight,mobile=!overview&&w<760&&h>w,s=(mobile?Math.max(w/WIDTH,h/HEIGHT)*1.05:Math.min(w/WIDTH,h/HEIGHT))*zoom,master=scenicPosition(getState().master);return{w,h,scale:s,ox:mobile?Math.min(0,Math.max(w-WIDTH*s,w*.52-master.x*s+pan.x)):(w-WIDTH*s)/2+pan.x,oy:mobile?Math.min(0,Math.max(h-HEIGHT*s,h*.5-master.y*s+pan.y)):(h-HEIGHT*s)/2+pan.y};}
 function screenPoint(e){if(delegate())return plan.screenPoint(e);const r=canvas.getBoundingClientRect(),c=camera();return{x:(e.clientX-r.left-c.ox)/c.scale,y:(e.clientY-r.top-c.oy)/c.scale};}
 function updatePeople(s,records){
  if(session!==s||lastTime===null||s.time<lastTime){actors.clear();session=s;lastTime=s.time;}
  const dt=Math.min(4,Math.max(0,s.time-lastTime));lastTime=s.time;
  const present=scenicHomeActors(s),ids=new Set(present.map(d=>d.id));for(const id of actors.keys())if(!ids.has(id))actors.delete(id);
  for(const d of present){let a=actors.get(d.id);if(!a){a={...point('centre'),id:d.id,path:[],steps:0,facing:1,back:false};actors.set(d.id,a);}
   const dest=courtyardDestination(s,d,records),p=dest?.access||point('mainDoor'),offset=((d.id%7)-3)*8,target=nearest({x:p.x+offset,y:p.y+offset*.3});
   const destination=`${dest?.id}:${target.x.toFixed(1)}:${target.y.toFixed(1)}`;
   if(a.destination!==destination){a.path=findPath(a,target)||[];a.destination=destination;}
   if(dt&&a.path.length)advanceScenic(a,dt*31);a.d=d;a.facility=dest;
  }
 }
 function sprite(a,master=false){
  const moving=master?getState().master.action==='walk'&&a.path.length:a.path.length,row=moving?(a.back?3:1+Math.floor((a.steps||0)/11)%2):0,f=meta.frames[row][appearance(master?'master':a.id)],height=53+a.y/HEIGHT*8,scale=height/f.h;
  ctx.save();ctx.fillStyle='#10291b55';ctx.beginPath();ctx.ellipse(a.x,a.y,9,3,0,0,Math.PI*2);ctx.fill();
  if(master){ctx.strokeStyle='#f8dda0c0';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(a.x,a.y,14,5,0,0,Math.PI*2);ctx.stroke();}
  for(const fg of foreground.filter((_,i)=>i!==3))if(fg.zone(a)){ctx.beginPath();ctx.rect(0,0,WIDTH,HEIGHT);fg.poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip('evenodd');}
  ctx.translate(a.x,a.y);ctx.scale(a.facing||1,1);ctx.drawImage(atlas,f.x,f.y,f.w,f.h,-f.footX*scale,-f.footY*scale,f.w*scale,f.h*scale);ctx.restore();
  if(!moving&&!getPrefs().reducedMotion){const action=master?getState().master.action:a.d?.mind?.activity;if(['heal','cultivate','study','teach'].includes(action)){ctx.strokeStyle=action==='heal'?'#afdcad':'#e8d290';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(a.x,a.y-6,18,7,getState().time*.4,0,Math.PI*1.5);ctx.stroke();}}
 }
 function tag(text,p,{color='#173e35ec',small=false}={}){ctx.font=`${small?12:14}px serif`;ctx.textAlign='center';const width=ctx.measureText(text).width+16;ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(p.x-width/2,p.y+9,width,small?21:25,5);ctx.fill();ctx.fillStyle='#f5dfae';ctx.fillText(text,p.x,p.y+(small?24:27));}
 function facility(r,s){
  const b=r.building,p=r.position,selected=getSelection()?.kind==='building'&&getSelection().id===r.id;
  if(r.type!=='hall'){
   ctx.save();if(!r.active)ctx.filter='grayscale(.85)';else if(b.condition<50)ctx.filter='sepia(.5)';plan.drawFacility(b,1,p,r.size*(1+(b.level-1)*.08));ctx.restore();
   if(r.active&&r.workers.length){ctx.strokeStyle='#f1d590';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+7,r.size*.3,6,0,0,Math.PI*2);ctx.stroke();}
   if(r.type==='alchemy'&&s.crafting&&r.active){ctx.fillStyle='#f0d498bb';ctx.beginPath();ctx.arc(p.x,p.y-r.size*.75,4,0,Math.PI*2);ctx.fill();}
  }
  if(overview||selected||!r.active||r.workers.length||r.type==='hall')tag(`${r.name} · ${b.level}级${r.active?'':' · 停用'}${r.workers.length?' · '+r.workers.length+'人':''}`,p,{small:r.type!=='hall',color:r.active?'#173e35ec':'#6c6055ed'});
  if((selected||overview)&&r.type==='alchemy'&&s.crafting)tag(r.active?`炉火 · ${Math.ceil(s.crafting.remaining)}秒`:'炉火已暂停',{x:p.x,y:p.y+26},{small:true});
 }
 function render(now=performance.now(),force=false){
  document.getElementById('viewport')?.classList.toggle('planning-view',isPlan()&&scene==='map');
  if(delegate()){plan.pan.x=pan.x;plan.pan.y=pan.y;plan.render(now,force);return;}if(!ready)return;
  const s=getState(),c=camera(),dpr=canvas.width/Math.max(1,c.w),records=facilityRecords(s);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#1d332e';ctx.fillRect(0,0,c.w,c.h);ctx.save();ctx.translate(c.ox,c.oy);ctx.scale(c.scale,c.scale);ctx.drawImage(bg,0,0,WIDTH,HEIGHT);updatePeople(s,records);
  const m={...scenicPosition(s.master),path:scenicPosition(s.master).path.slice()};if(s.master.action==='walk'&&m.path.length)advanceScenic(m,46*(s.sim.carry||0));
  const items=records.map(r=>({y:r.position.y,facility:r}));if(!overview){for(const a of actors.values())items.push({y:a.y,actor:a});if(!s.world?.exploration&&!s.combat&&!s.master.journey)items.push({y:m.y,actor:{...m,id:'master'}});}
  items.sort((a,b)=>a.y-b.y).forEach(item=>item.facility?facility(item.facility,s):sprite(item.actor,item.actor.id==='master'));
  const selection=getSelection();if(selection?.kind==='person'){const a=actors.get(selection.id);if(a)tag(a.d.name,a);}
  if(getMode()==='walk'&&m.path?.length){ctx.setLineDash([5,6]);ctx.strokeStyle='#f6d494a0';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(m.x,m.y);m.path.forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.setLineDash([]);}
  if(overview){tag(`山院实况 · ${records.length}处设施 · ${s.disciples.length}名门人`,{x:840,y:25});s.society.peaks.forEach((peak,i)=>tag(peak.name+' · 查看峰域供给',{x:500+i*550,y:880}));}
  ctx.restore();if(!getPrefs().reducedMotion&&s.world.weather.id==='rain'){ctx.strokeStyle='#ecf3e355';for(let i=0;i<38;i++){const x=(i*167+now*.027)%c.w,y=(i*91+now*.19)%c.h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-5,y+16);ctx.stroke();}}if(s.time%120>82){ctx.fillStyle='#102c4525';ctx.fillRect(0,0,c.w,c.h);}
 }
 function pick(e){
  if(delegate())return plan.pick(e);const p=screenPoint(e),s=getState();if(!overview){const person=[...actors.values()].sort((a,b)=>b.y-a.y).find(a=>Math.abs(p.x-a.x)<19&&p.y>a.y-59&&p.y<a.y+6);if(person)return{kind:'person',id:person.id,...p};}
  const r=facilityRecords(s).sort((a,b)=>b.position.y-a.position.y).find(r=>r.type==='hall'?inPolygon(p,LANDMARKS.find(l=>l.id==='main').hit):Math.abs(p.x-r.position.x)<r.size*.48&&p.y<r.position.y+24&&p.y>r.position.y-r.size*.88);
  if(r)return{...p,kind:'building',id:r.id,scenic:true};if(overview){const peak=s.society.peaks.find((_,i)=>Math.abs(p.x-(500+i*550))<180&&Math.abs(p.y-900)<40);if(peak)return{...p,kind:'peak',id:peak.id};}
  const l=LANDMARKS.find(l=>inPolygon(p,l.hit));return{...p,kind:l?'area':'ground',id:l?.id,scenic:true};
 }
 return {pan,ready:readyPromise,render,resize:()=>{plan.resize();render(performance.now(),true);},pick,screenPoint,mapPoint:e=>delegate()?plan.mapPoint(e):screenPoint(e),setHover:e=>{hover=e?screenPoint(e):null;plan.setHover(e);},getHover:()=>delegate()?plan.getHover():hover,
  setGrid:v=>{planning=v??!planning;overview=false;plan.setGrid(planning);pan.x=pan.y=0;return planning;},setZoom:d=>{if(delegate())return plan.setZoom(d);zoom=Math.max(.8,Math.min(2.3,zoom+d));return zoom;},recenter:()=>{pan.x=pan.y=0;zoom=1;plan.recenter();},
  focus:(x,y,arena=false)=>{if(delegate())plan.focus(x,y,arena);else{const selection=getSelection(),r=selection?.kind==='building'?facilityRecords(getState()).find(r=>r.id===selection.id):null,a=selection?.kind==='person'?actors.get(selection.id):null,p=a||r?.position||scenicPosition(getState().master),c=camera();pan.x+=c.w*.5-(p.x*c.scale+c.ox);pan.y+=c.h*.4-(p.y*c.scale+c.oy);}},
  setOverview:v=>{overview=v??!overview;if(overview)planning=false;pan.x=pan.y=0;zoom=1;return overview;},setScene:id=>{overview=false;scene=id;plan.setScene(id);},getScene:()=>scene,isPlanning:isPlan,destroy:plan.destroy,point:plan.point};
}
