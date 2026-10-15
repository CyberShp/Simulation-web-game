import { createSectSession, commandSect, advanceSect, viewSect, snapshotSect, restoreSect } from './sect-sim.mjs';
import { CourtyardRenderer } from './courtyard-renderer.mjs';
import { toArt, toWorld, routeArt, isArtWalkable } from './courtyard-space.mjs';
import { spatialAccess } from '../../dist/ea-sr-spatial.mjs';
import { createCourtyardPersistence } from './courtyard-persistence.mjs';
import { inspectCourtyard } from './courtyard-inspection.mjs';
import { createCourtyardPanels } from './courtyard-panels.mjs';

const $=id=>document.getElementById(id),host=window.sectHost,sceneHost=window.sceneHost;
const canvas=$('scene'),renderer=new CourtyardRenderer(canvas),errors=[];
let session=createSectSession(),view=viewSect(session),manualPause=false,modal=null,suspended=false,closing=false,ready=false;
let lastPump=performance.now(),lastSave=performance.now(),lastUI=0,noticeUntil=0,selected=null,selectedBuilding=null;
let route=[],activeWaypoint=null,destination=null,routeFailure=null,routeSteps=0,renderedFrames=0;
const MASTER='person:master',master=()=>view.people.find(p=>p.id===MASTER),refresh=()=>view=viewSect(session);
const labels={rest:'休息',groundRest:'歇脚',cultivate:'修炼',plant:'照料灵草',harvest:'采集',transport:'搬运',move:'行走',heal:'疗伤'};
const inspection=()=>inspectCourtyard(session,view);
let persistence;
persistence=createCourtyardPersistence({getSnapshot:saveSnapshot,saveSnapshot:data=>host?.save(data)??{ok:false,error:'请在桌面应用中保存院务。'},exportSnapshot:data=>host?.exportRecovery(data)??{ok:false,error:'当前入口无法导出恢复文件。'},onStateChange:status=>{
 $('save-protection').hidden=!status.protected;$('save-error').textContent=status.error||'';
 $('retry-save').disabled=status.saving;$('export-recovery').disabled=status.exporting;
 if(status.protected)$('save-note').textContent='保存失败 · 已保护暂停';
 if(ready)syncPause();
}});
const panels=createCourtyardPanels({getView:()=>view,inspect:inspection,command:manageCommand,
 openPerson:id=>{const person=view.people.find(p=>p.id===id);if(person)openPerson(person);},
 focusPerson:person=>{renderer.focusLocation(person.location);if(person.indoor)notice('人物正在屋内，已定位建筑入口。');},
 openBuilding:id=>{const building=view.buildings.find(b=>b.id===id);if(building)openBuilding(building);},announce:notice});
function notice(text){$('notice').textContent=text;$('notice').hidden=false;noticeUntil=performance.now()+4500;}
function fail(e){errors.push({message:e.message||String(e),tick:session.state.worldTick});notice(e.message||String(e));}
addEventListener('error',e=>fail(e.error||e.message));addEventListener('unhandledrejection',e=>fail(e.reason));
function issue(request){if(request.type!=='pause'&&(closing||persistence?.status().protected))return{ok:false,error:'当前进度处于保护暂停，请先重试保存或导出恢复文件。'};const result=commandSect(session,request);refresh();return result;}
function syncPause(){const paused=manualPause||modal||renderer.reference||suspended||closing||persistence?.status().protected;if((session.state.speed===0)!==!!paused){issue({type:'pause',paused:!!paused});lastPump=performance.now();}}
function manageCommand(request){const result=issue(request);if(result.ok&&!['policy','manual','invite-work','toggle-building'].includes(request.type)){route=[];activeWaypoint=null;destination=null;renderer.target=null;}ui();return result;}
function moveArt(x,y){
 if(closing||persistence.status().protected)return{ok:false,error:'当前进度处于保护暂停，请先重试保存或导出恢复文件。'};
 if(renderer.mode!=='local'||renderer.reference)return{ok:false,error:'请先回到山院近景。'};
 const actor=master();if(!actor)return{ok:false,error:'掌门暂未在此场景。'};
 if(!isArtWalkable(x,y))return{ok:false,error:'这里是屋墙、山石或未接通的地面，请选择院内道路。'};
 if(actor.indoor){const activity=session.state.activitiesById[session.state.master.activityId],building=session.state.buildingsById[activity?.targetId];if(!building)return{ok:false,error:'暂未找到所在建筑的入口。'};const world=spatialAccess(building),p=toArt(world.x,world.y),result=issue({type:'move',...world});if(!result.ok)return result;route=[];activeWaypoint={...p,world,tick:session.state.worldTick,exit:true};destination={x,y};renderer.target=destination;routeFailure=null;return result;}
 const start=toArt(actor.x,actor.y),next=routeArt(start,{x,y});
 if(!next?.length)return{ok:false,error:'这里是屋墙、山石或未接通的地面，请选择院内道路。'};
 route=next.map(p=>({...p}));activeWaypoint=null;destination={x,y};routeFailure=null;renderer.target=destination;return nextWaypoint();
}
function nextWaypoint(){if(!route.length){activeWaypoint=null;destination=null;renderer.target=null;return{ok:true,arrived:true};}const p=route.shift(),w=toWorld(p.x,p.y),result=issue({type:'move',x:w.x,y:w.y});if(!result.ok){route=[];activeWaypoint=null;destination=null;routeFailure=result.error;renderer.target=null;notice(result.error);return result;}activeWaypoint={...p,world:w,tick:session.state.worldTick};routeSteps++;return result;}
function advanceRoute(){if(!activeWaypoint)return;const p=master();if(!p)return;const d=Math.hypot(p.x-activeWaypoint.world.x,p.y-activeWaypoint.world.y);if(d<.08){if(activeWaypoint.exit&&destination){const target=destination;activeWaypoint=null;const result=moveArt(target.x,target.y);if(!result.ok){destination=null;renderer.target=null;routeFailure=result.error;notice(result.error);}}else nextWaypoint();return;}if(!p.path?.length||session.state.worldTick-activeWaypoint.tick>180){route=[];activeWaypoint=null;destination=null;routeFailure='当前道路未能抵达，请重新选点。';renderer.target=null;notice(routeFailure);}}
function closeDialog(){if(modal)$(modal).hidden=true;modal=null;syncPause();}
function openPerson(person){if(modal)$(modal).hidden=true;selected=person.id;renderer.selected=person.id;const known=inspection().people.find(p=>p.id===person.id);$('person-name').textContent=person.name;$('person-role').textContent=known?.role||'院中人物';$('person-speech').textContent=known?.detail||'在山院稍作停留。';$('person-detail').textContent=(known?.location.label||'院中')+' · '+(known?.activityLabel||labels[person.activity]||'料理事务')+'　精力 '+Math.round(person.energy)+'　伤势 '+Math.round(person.wound);$('focus-person').textContent=known?.indoor?'定位所在建筑':'看看位置';renderer.drawPortrait($('portrait'),person);modal='dialog';$('dialog').hidden=false;syncPause();}
function openBuilding(b){if(modal)$(modal).hidden=true;selectedBuilding=b;const known=inspection().buildings.find(item=>item.id===b.id);$('building-name').textContent=b.name||({hall:'主殿',farm:'灵草田'}[b.type]);$('building-detail').textContent=(known?.detail||'当前建筑状态暂不可查。')+(b.type==='farm'?' 田边灵草 '+Number(view.crop?.herbOnSite||0).toFixed(1)+' 份。':'');$('building-slots').replaceChildren();for(const slot of known?.slots||[]){const row=document.createElement('p');row.textContent=slot.label;$('building-slots').append(row);}for(const person of [...(known?.occupants||[]),...(known?.incoming||[])]){const row=document.createElement('p');row.textContent=person.name+' · '+person.label;$('building-slots').append(row);}$('building-walk').textContent=b.type==='farm'?'走到田边':'走到门前';modal='building-dialog';$(modal).hidden=false;syncPause();}
function saveSnapshot(){const data=snapshotSect(session);data.state.speed=manualPause?0:1;data.courtyardPresentation={version:1,route,activeWaypoint,destination,camera:{...renderer.camera}};return data;}
async function save(show=true,reason=show?'manual':'auto'){if(!ready)return{ok:false,error:'尚未入院。'};const result=await persistence.save({reason});if(result.ok){lastSave=performance.now();$('save-note').textContent='院务已保存';if(show)notice('院务已保存。');}return result;}
function restorePresentation(p){
 const finite=q=>q&&Number.isFinite(q.x)&&Number.isFinite(q.y);
 if(p?.version!==1||!Array.isArray(p.route)||p.route.length>10000||!p.route.every(q=>finite(q)&&isArtWalkable(q.x,q.y)))return;
 if(p.destination&&(!finite(p.destination)||!isArtWalkable(p.destination.x,p.destination.y)))return;
 const a=p.activeWaypoint;if(a&&(!finite(a)||!finite(a.world)||!Number.isFinite(a.tick)))return;
 route=p.route.map(q=>({x:q.x,y:q.y}));activeWaypoint=a||null;destination=p.destination||null;renderer.target=destination;
}
function ui(){const p=master();$('clock').textContent=view.timeLabel+(view.paused?' · 静观':'');$('pause').textContent=manualPause?'继续':'暂停';$('action').textContent=renderer.mode==='planning'?'山域规划 · 回小院继续行走':renderer.reference?'原稿与实景使用同一镜头 · 再次点击切回实景':(activeWaypoint?'掌门行走中 · 点击地面可更改去处':p?.activityDetail?.reason||'左键行走与交谈 · 滚轮缩放 · 右键拖动 · Tab 收起界面');panels.render();}
function pump(){const now=performance.now(),elapsed=Math.max(0,(now-lastPump)/1000);lastPump=now;if(ready&&!view.paused&&!closing&&!suspended&&!persistence.status().protected){try{advanceSect(session,elapsed);refresh();advanceRoute();}catch(e){manualPause=true;syncPause();fail(e);}}if(now-lastUI>250){refresh();ui();lastUI=now;}if(host&&ready&&!closing&&!persistence.status().pending&&!persistence.status().protected&&now-lastSave>15000)void save(false);if(noticeUntil&&now>noticeUntil){$('notice').hidden=true;noticeUntil=0;}}
function frame(){renderer.draw(view);renderedFrames++;requestAnimationFrame(frame);}
$('home').onclick=()=>{renderer.showCourtyard();$('reference-note').hidden=true;syncPause();ui();};
$('domain').onclick=()=>{renderer.showOverview();$('reference-note').hidden=true;syncPause();ui();};
$('follow').onclick=()=>{renderer.followPerson(MASTER);$('reference-note').hidden=true;syncPause();};
$('compare').onclick=()=>{if(renderer.mode!=='local')renderer.showCourtyard();renderer.reference=!renderer.reference;$('reference-note').hidden=!renderer.reference;syncPause();ui();};
$('pause').onclick=()=>{manualPause=!manualPause;syncPause();};$('save').onclick=()=>void save();
for(const name of ['affairs','people','growth','supply'])$(name).onclick=()=>panels.open(name);
$('retry-save').onclick=async()=>{const result=await persistence.retry();if(result.ok){lastSave=performance.now();$('save-note').textContent='院务已保存';notice('保存成功，保护暂停已解除。');}};
$('export-recovery').onclick=async()=>{const result=await persistence.exportRecovery();$('recovery-note').textContent=result.ok?'恢复文件已导出；请保留文件，主存档仍需重试保存。':result.cancelled?'已取消导出，当前进度仍保留。':result.error;};
$('close-person').onclick=$('leave-person').onclick=$('close-building').onclick=closeDialog;
$('focus-person').onclick=()=>{const person=inspection().people.find(p=>p.id===selected);closeDialog();if(person)renderer.focusLocation(person.location);};
$('building-walk').onclick=()=>{const building=inspection().buildings.find(b=>b.id===selectedBuilding.id);closeDialog();const location=building?.location.focus;if(!location)return notice('当前未找到可达入口。');const p=toArt(location.x,location.y),result=moveArt(p.x,p.y);if(!result.ok)notice(result.error);};
let drag=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(!ready||modal||persistence.status().protected)return;if(e.button===2){drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);return;}if(e.button!==0)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(renderer.mode==='planning')return notice('这里显示山域规划，回小院可继续行走。');if(renderer.reference)return notice('当前正在查看原稿，切回实景后可以行走。');const people=renderer.pickPeople(x,y);if(people.length>1)return panels.open('people',people.map(p=>p.id));if(people.length)return openPerson(people[0]);const b=renderer.pickBuilding(x,y);if(b)return openBuilding(b);const a=renderer.screenToArt(x,y),result=moveArt(a.x,a.y);if(!result.ok)notice(result.error);});
canvas.addEventListener('pointermove',e=>{if(drag){renderer.panBy(e.clientX-drag.x,e.clientY-drag.y);drag={x:e.clientX,y:e.clientY};}else{const r=canvas.getBoundingClientRect();renderer.hover=renderer.pickPerson(e.clientX-r.left,e.clientY-r.top)?.id||null;}});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(modal)return;const b=canvas.getBoundingClientRect();renderer.zoomAt(e.deltaY<0?1.1:1/1.1,e.clientX-b.left,e.clientY-b.top);},{passive:false});
addEventListener('resize',()=>renderer.resize());addEventListener('keydown',e=>{if(e.key==='Escape'){closeDialog();panels.close();return;}if(e.target.closest('input,select,textarea,button,[role=tab]'))return;if(e.code==='Space'){e.preventDefault();$('pause').click();}if(e.key==='Tab'&&!modal&&$('management').hidden){e.preventDefault();document.body.classList.toggle('hud-hidden');}});
try{
 const settings=host?await host.settings():{qa:false};suspended=!!settings.suspended;
 if(host){
  host.onClosing(async event=>{if(event?.reason==='timeout'){notice('仍在等待保存完成，请保留窗口。');return;}if(closing)return;if(!ready){await host.closeReady();return;}closing=true;syncPause();await persistence.waitForIdle();const result=await save(false,'closing');if(result.ok)await host.closeReady();else{closing=false;await host.cancelClose?.();syncPause();}});
  const saved=await host.load();
  if(!saved.ok)throw Error('上次院务读取失败，原存档已保留。'+(saved.error||''));
  if(saved.found){session=restoreSect(saved.data);manualPause=session.state.speed===0;restorePresentation(session.courtyardPresentation);}
  host.onPower(p=>{suspended=p.suspended;syncPause();});
 }
 const terrain=issue({type:'enable-courtyard-terrain'});if(!terrain.ok)throw Error(terrain.error);
 await renderer.load();renderer.resize();renderer.showCourtyard();refresh();ready=true;lastPump=performance.now();syncPause();ui();$('loading').hidden=true;setInterval(pump,50);requestAnimationFrame(frame);
 if(settings.qa){window.courtyardQA={renderer,canvas,moveArt,openPerson,openBuilding,closeDialog,save,view:()=>refresh(),snapshot:()=>snapshotSect(session),setPaused:p=>{manualPause=p;syncPause();refresh();},route:()=>({remaining:route.length,waypoints:route.map(p=>({...p})),active:activeWaypoint,destination,failure:routeFailure,steps:routeSteps}),metrics:()=>({tick:session.state.worldTick,errors:[...errors],renderedFrames,people:view.people.map(p=>({id:p.id,x:p.x,y:p.y,indoor:p.indoor})),crop:view.crop,routeSteps,routeFailure,viewport:{width:renderer.w,height:renderer.h,dpr:renderer.dpr},artSize:{width:1672,height:941}})};if(settings.qaScenario&&settings.qaScenario!=='native'){const {runCourtyardQA}=await import('./courtyard-qa.mjs');void runCourtyardQA(window.courtyardQA,settings).catch(fail);}}
}catch(e){fail(e);$('loading').textContent='入院未完成：'+e.message;}
