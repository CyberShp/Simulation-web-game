import { createOpeningSectSession, createSectCommandDriver, advanceSect, viewSect, createSectViewRefresh, snapshotSect, restoreSect, quoteSectTrade } from './sect-sim.mjs';
import { createCourtyardCombat } from './courtyard-combat.mjs';
import { CourtyardRenderer } from './courtyard-renderer.mjs';
import { residentialMovementWaypoints, commandMovementWaypoint } from './courtyard-navigation.mjs';
import { createCourtyardRoutePlanner } from './courtyard-route-planner.mjs';
import { geometryRevision } from '../../src/simulation/ea-scene-geometry.mjs';
import { toArt, toWorld, previousArtToWorld, routeArt, isArtWalkable, DOMAIN_ART_WIDTH, RESIDENCES_ART_RIGHT, SERVICES_ART_RIGHT, NORTH_LIBRARY_ART_TOP, NORTH_MEDITATION_ART_TOP } from './courtyard-space.mjs';
import { spatialAccess } from '../../src/simulation/ea-sr-spatial.mjs';
import { createCourtyardPersistence } from './courtyard-persistence.mjs';
import { inspectCourtyard } from './courtyard-inspection.mjs';
import { createCourtyardPanels } from './courtyard-panels.mjs';
import { createCourtyardOpening } from './courtyard-opening.mjs';
import { createCourtyardPersonDialogue } from './courtyard-person-dialogue.mjs';

const $=id=>document.getElementById(id),host=window.sectHost,sceneHost=window.sceneHost;
const canvas=$('scene'),renderer=new CourtyardRenderer(canvas),errors=[];
let session=createOpeningSectSession(),view=viewSect(session),manualPause=false,modal=null,suspended=false,closing=false,ready=false;
let openingReading=false,panelReading=false,departureReading=false,dialogTrigger=null,dialogTriggerKey=null,recoveryToken=null,recoveryBusy=false,importing=false;
let lastPump=performance.now(),lastSave=performance.now(),lastUI=0,noticeUntil=0,selected=null,selectedBuilding=null;
let restoredCamera=null,pendingApproach=null;
let route=[],activeWaypoint=null,destination=null,routeFailure=null,routeSteps=0,renderedFrames=0;
const approachPlanner=createCourtyardRoutePlanner();
let plannedExit=null;
const updateView=createSectViewRefresh(()=>session),ownedCommand=createSectCommandDriver(()=>session);
const MASTER='person:master',master=()=>view.people?.find(p=>p.id===MASTER),refresh=options=>{view=updateView(options);renderer.view=view;return view;};
const completeView=()=>view.people?view:refresh();
const inspection=preparedView=>inspectCourtyard(session,preparedView||refresh());
const needsFullView=()=>!!(modal||panelReading||openingReading||departureReading||pendingApproach||activeWaypoint||!$('management').hidden);
// QA records synchronous JavaScript separately from the asynchronous host wait.
// Production saves retain the same snapshot, queue, submission and error path.
let qaSaveTiming=false,qaSaveSpansCapped=false;
const qaSaveSpans=[];
function recordSaveSpan(kind,at,end,outcome='returned'){
 if(!qaSaveTiming)return;
 if(qaSaveSpans.length>=2000){qaSaveSpansCapped=true;return;}
 qaSaveSpans.push({kind,at,end,durationMs:end-at,outcome,tick:session.state.worldTick,paused:session.state.speed===0,combat:!!session.state.combat});
}
function saveJS(kind,callback){
 if(!qaSaveTiming)return callback();
 const at=performance.now();let outcome='threw';
 try{const result=callback();outcome='returned';return result;}finally{recordSaveSpan(kind,at,performance.now(),outcome);}
}
function submitSave(data){
 const serialized=typeof host?.saveSerialized==='function',payload=serialized?saveJS('save-serialize-js',()=>JSON.stringify(data)):data;
 const result=saveJS('host-save-submit-js',()=>serialized?host.saveSerialized(payload):host?.save(data)??{ok:false,error:'请在桌面应用中保存院务。'});
 if(!qaSaveTiming)return result;
 const at=performance.now();
 return Promise.resolve(result).then(value=>{recordSaveSpan('host-save-await-context',at,performance.now(),'fulfilled');return value;},error=>{recordSaveSpan('host-save-await-context',at,performance.now(),'rejected');throw error;});
}
let persistence;
persistence=createCourtyardPersistence({getSnapshot:saveSnapshot,snapshotOwnership:'owned',saveSnapshot:submitSave,exportSnapshot:data=>host?.exportRecovery(data)??{ok:false,error:'当前入口无法导出恢复文件。'},onStateChange:status=>{
 $('save-protection').hidden=!status.protected;$('save-error').textContent=status.error||'';
 $('retry-save').disabled=status.saving;$('export-recovery').disabled=status.exporting;
 if(status.protected){approachPlanner.invalidate('保存保护暂停。');$('save-note').textContent='保存失败 · 已保护暂停';}
 if(ready)syncPause();
}});
const panels=createCourtyardPanels({getView:completeView,inspect:inspection,command:manageCommand,
 openPerson:id=>{const person=completeView().people.find(p=>p.id===id);if(person)openPerson(person);},
 focusPerson:person=>{renderer.focusLocation(person.location);if(person.indoor)notice('人物正在屋内，已定位建筑入口。');},
 openBuilding:id=>{const building=completeView().buildings.find(b=>b.id===id);if(building)openBuilding(building);},announce:notice,
 onReadingChange:reading=>{panelReading=reading;if(ready)syncPause();},
 walkTo:location=>walkTo(location),focusLocation:location=>renderer.focusLocation(location)});
const personDialogue=createCourtyardPersonDialogue({getView:completeView,inspect:inspection,command:manageCommand,quoteTrade:request=>quoteSectTrade(session,request),drawPortrait:(canvas,person)=>renderer.drawPortrait(canvas,person),announce:notice,navigatePerson:(id,recipeId)=>{const person=completeView().people.find(p=>p.id===id);if(person)openPerson(person,{recipeId});}});
const opening=createCourtyardOpening({getSession:()=>session,getView:()=>view,command:manageCommand,save,
 onReadingChange:reading=>{openingReading=reading;if(ready)syncPause();}});
let combatUI;combatUI=createCourtyardCombat({getView:()=>view,command:manageCommand,announce:notice,pause:()=>{manualPause=true;syncPause();},canInteract:()=>ready&&!modal&&!openingReading&&!closing&&!importing&&!persistence.status().protected,requestGateWalk:location=>panels.requestMove(location),openMasterActivity:()=>panels.open('growth'),onDepartureReadingChange:reading=>{departureReading=reading;if(ready)syncPause();},beforeDepart:()=>{document.body.classList.remove('hud-hidden');panels.close();closeDialog();renderer.reference=false;renderer.mode='local';$('reference-note').hidden=true;syncPause();}});
const routeOptions=()=>({terrain:!!session.state.spatial?.courtyardTerrain,domain:!!view.domain.enabled,west:!!view.domain.westEnabled,valley:!!view.domain.valleyEnabled,residences:!!view.domain.residencesEnabled,services:!!view.domain.servicesEnabled,northLibrary:!!view.domain.northLibraryEnabled,northMeditation:!!view.domain.northMeditationEnabled,westWorkshops:!!view.domain.westWorkshopsEnabled});
function notice(text){$('notice').textContent=text;$('notice').hidden=false;noticeUntil=performance.now()+4500;}
function fail(e){errors.push({message:e.message||String(e),tick:session.state.worldTick});notice(e.message||String(e));}
addEventListener('error',e=>fail(e.error||e.message));addEventListener('unhandledrejection',e=>fail(e.reason));
function issue(request){
 if(request.type!=='pause'&&(closing||importing||persistence?.status().protected)){refresh();return{ok:false,error:importing?'请先完成或取消恢复。':'当前进度处于保护暂停，请先重试保存或导出恢复文件。'};}
 const result=ownedCommand(request);
 const battleProjection=(result.ok||session.state.combat?.status==='active'&&!['combat-target','combat-auto'].includes(request.type))&&['combat-input','combat','combat-target','combat-auto','pause'].includes(request.type)&&!!session.state.combat&&view.expedition?.scene?.type==='combat'&&view.opening?.stage==='complete'&&!needsFullView()&&!closing&&!importing&&!suspended;
 refresh(battleProjection?{automatic:true,force:true}:undefined);return result;
}
function pauseReasons(){return[manualPause&&'手动暂停',openingReading&&'开篇阅读',modal&&'详情阅读',panelReading&&'建筑详情',departureReading&&'出行准备',renderer.reference&&'原稿对照',suspended&&'系统休眠',closing&&'退出保存',persistence?.status().protected&&'保存保护'].filter(Boolean);}
function syncPause(){const reasons=pauseReasons(),paused=reasons.length>0;if(paused)combatUI?.clearInput();if((session.state.speed===0)!==paused){issue({type:'pause',paused});lastPump=performance.now();}$('simulation-status').textContent=paused?'已暂停 · '+reasons.join(' / '):'世界运行中';}
function manageCommand(request){if(request.type!=='pause')approachPlanner.invalidate('已改为新的行动。');const result=issue(request);if(result.ok&&!['policy','manual','invite-work','toggle-building','admit-visitor'].includes(request.type)){route=[];activeWaypoint=null;destination=null;renderer.target=null;pendingApproach=null;}ui();return result;}
function moveArt(x,y){
 approachPlanner.invalidate('已重新选择去处。');
 refresh();
 if(closing||persistence.status().protected)return{ok:false,error:'当前进度处于保护暂停，请先重试保存或导出恢复文件。'};
 if(renderer.mode!=='local'||renderer.reference)return{ok:false,error:'请先回到山院近景。'};
 const actor=master();if(!actor)return{ok:false,error:'掌门暂未在此场景。'};
 if(!isArtWalkable(x,y,routeOptions()))return{ok:false,error:'这里是屋墙、山石或未接通的地面，请选择院内道路。'};
 if(actor.indoor){const activity=session.state.activitiesById[session.state.master.activityId],building=session.state.buildingsById[activity?.targetId];if(!building)return{ok:false,error:'暂未找到所在建筑的入口。'};const world=spatialAccess(building),p=toArt(world.x,world.y),result=issue({type:'move',...world});if(!result.ok)return result;route=[];activeWaypoint={...p,world,tick:session.state.worldTick,exit:true};destination={x,y};renderer.target=destination;routeFailure=null;return result;}
 const start=toArt(actor.x,actor.y),options=routeOptions(),samples=routeArt(start,{x,y},options),next=samples&&residentialMovementWaypoints(session.state,start,samples,options);
 if(!next?.length)return{ok:false,error:'这里是屋墙、山石或未接通的地面，请选择院内道路。'};
 route=next.map(p=>({...p}));activeWaypoint=null;destination={x,y};routeFailure=null;renderer.target=destination;return nextWaypoint();
}
const approachBodyOwner=state=>{
 const p=state.master,a=state.activitiesById[p.activityId],w=state.workOrdersById?.[a?.workOrderId||a?.meditationOrderId],o=state.srCultivation?.orders?.[a?.orderId],flow=w?.materialFlow;
 // Keep the cancellation stages used by actionConsequences. Progress may keep
 // advancing; crossing into paid work or carried/site cargo needs a fresh review.
 const atSite=Object.values(state.stockpilesById?.[flow?.siteStockpileId]?.resources||{}).some(quantity=>quantity>0),carrying=Object.values(flow?.cargo||{}).some(quantity=>quantity>0);
 return JSON.stringify([p.activityId??null,a?.startedTick??null,a?.orderId??null,a?.workOrderId??null,a?.meditationOrderId??null,a?.kind,a?.phase,a?.progressTicks>0,w?.phase,w?.progressTicks>0,flow?.phase,!!flow?.cancelRequested,atSite,carrying,o?.phase,!!o?.consumed,!!o?.refineStarted]);
};
async function planApproach(location){
 approachPlanner.invalidate('已重新选择走近目标。');
 const point=location?.focus||location;
 if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return{ok:false,error:'当前未找到可达位置。'};
 renderer.mode='local';renderer.reference=false;$('reference-note').hidden=true;syncPause();refresh();
 if(closing||importing||persistence.status().protected)return{ok:false,error:'当前进度处于保护暂停，请先重试保存或完成恢复。'};
 const actor=master();if(!actor)return{ok:false,error:'掌门暂未在此场景。'};
 const target=toArt(point.x,point.y);
 if(actor.indoor)return moveArt(target.x,target.y);
 const sourceSession=session,revision=geometryRevision(session.state),owner=approachBodyOwner(session.state),options=routeOptions(),start=toArt(actor.x,actor.y);
 notice('正在查看可通行路线，当前行动继续。');
 // postMessage makes the independent canonical copy; the worker restores only
 // its non-persistent hydration getters, never a second simulation clock.
 const planned=await approachPlanner.plan({state:session.state,from:start,to:target,options});
 if(!planned.ok)return planned;
 if(!approachPlanner.isCurrent(planned.requestId))return{ok:false,cancelled:true,error:'已改为新的行动。'};
 const reject=error=>{approachPlanner.mark(planned.requestId,'rejected',{error,finishedAt:performance.now()});return{ok:false,error};};
 if(sourceSession!==session||revision!==geometryRevision(session.state)||owner!==approachBodyOwner(session.state)||JSON.stringify(options)!==JSON.stringify(routeOptions()))return reject('掌门当前事务或通路已有变化，请重新走近。');
 if(closing||importing||persistence.status().protected||renderer.mode!=='local'||renderer.reference||!master())return reject('当前无法接续走近，请重新选择。');
 approachPlanner.mark(planned.requestId,'planned',{commandStartedAt:performance.now()});
 // The live body's first leg is validated by the same official gateway. The
 // prior committed route remains intact until this command actually succeeds.
 let result;try{result=commandMovementWaypoint(session,planned.route[0],routeOptions(),planned.route.length>1,issue);}
 catch(error){result={ok:false,error:error?.message||String(error)};}
 finally{approachPlanner.mark(planned.requestId,'planned',{commandFinishedAt:performance.now()});}
 if(!result.ok)return reject(result.error);
 route=planned.route.slice(1).map(p=>({...p}));activeWaypoint=result.waypoint;destination={...target};routeFailure=null;renderer.target=destination;routeSteps++;
 approachPlanner.mark(planned.requestId,'accepted',{acceptedAt:performance.now(),commandId:result.commandId});return result;
}
function nextWaypoint(){if(!route.length){activeWaypoint=null;destination=null;renderer.target=null;return{ok:true,arrived:true};}const p=route.shift(),result=commandMovementWaypoint(session,p,routeOptions(),route.length>0,issue,{recheck:!!activeWaypoint?.adjusted});if(!result.ok){route=[];activeWaypoint=null;destination=null;routeFailure=result.error;renderer.target=null;notice(result.error);return result;}activeWaypoint=result.waypoint;routeSteps++;return result;}
function advanceRoute(){if(!activeWaypoint)return;const p=master();if(!p)return;const d=Math.hypot(p.x-activeWaypoint.world.x,p.y-activeWaypoint.world.y);if(d<.08){if(activeWaypoint.exit&&destination){if(approachPlanner.status()?.status==='pending')return;const target=destination;if(pendingApproach){if(plannedExit===activeWaypoint)return;plannedExit=activeWaypoint;void planApproach(toWorld(target.x,target.y)).then(result=>{if(!result.ok&&!result.cancelled)notice(result.error);});}else{activeWaypoint=null;const result=moveArt(target.x,target.y);if(!result.ok){destination=null;renderer.target=null;routeFailure=result.error;notice(result.error);}}}else nextWaypoint();return;}if(!p.path?.length||session.state.worldTick-activeWaypoint.tick>180){route=[];activeWaypoint=null;destination=null;routeFailure='当前道路未能抵达，请重新选点。';renderer.target=null;notice(routeFailure);}}
function closeDialog(){if(modal==='recovery-dialog'){void cancelRecovery();return;}if(modal)$(modal).hidden=true;if(modal==='dialog')personDialogue.close();modal=null;syncPause();const target=dialogTrigger?.isConnected?dialogTrigger:[...document.querySelectorAll('[data-ui-key]')].find(el=>el.dataset.uiKey===dialogTriggerKey);target?.focus();dialogTrigger=null;dialogTriggerKey=null;}
function openPerson(person,{recipeId=null}={}){if(importing)return;refresh();if(modal)$(modal).hidden=true;else{dialogTrigger=document.activeElement;dialogTriggerKey=dialogTrigger?.dataset.uiKey||null;}selected=person.id;renderer.selected=person.id;personDialogue.open(person.id,{recipeId});modal='dialog';$('dialog').hidden=false;syncPause();$('close-person').focus();}
function openBuilding(b){if(importing)return;refresh();closeDialog();selectedBuilding=b;panels.openBuilding(b.id);}
function walkTo(location){pendingApproach=null;const point=location?.focus||location;if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return{ok:false,error:'当前未找到可达位置。'};renderer.mode='local';renderer.reference=false;$('reference-note').hidden=true;syncPause();const art=toArt(point.x,point.y);return moveArt(art.x,art.y);}
function saveSnapshot(){return saveJS('get-snapshot-js',()=>{const data=snapshotSect(session);data.state.speed=manualPause||openingReading||data.state.story.opening?.inheritance?.status==='pending'?0:1;data.courtyardPresentation={version:2,manualPause,opening:opening.snapshotPresentation(),route:route.map(p=>toWorld(p.x,p.y)),activeWaypoint:activeWaypoint?{world:structuredClone(activeWaypoint.world),tick:activeWaypoint.tick,exit:!!activeWaypoint.exit,...(activeWaypoint.adjusted?{adjusted:true}:{})}:null,destination:destination?toWorld(destination.x,destination.y):null,camera:{...toWorld(renderer.camera.x,renderer.camera.y),zoom:renderer.camera.zoom}};return data;});}
async function save(show=true,reason=show?'manual':'auto'){if(!ready||importing)return{ok:false,error:importing?'请先完成或取消恢复。':'尚未入院。'};const result=await persistence.save({reason});if(result.ok){lastSave=performance.now();$('save-note').textContent='院务已保存';if(show)notice('院务已保存。');}return result;}
function restorePresentation(p){
 const finite=q=>q&&Number.isFinite(q.x)&&Number.isFinite(q.y);
 if(![1,2].includes(p?.version))return;
 const project=q=>{const w=p.version===1?previousArtToWorld(q.x,q.y):q;return toArt(w.x,w.y);};
 const c=p.camera;if(finite(c)&&Number.isFinite(c.zoom)&&c.zoom>=1&&c.zoom<=2)restoredCamera={...project(c),zoom:c.zoom};
 if(!Array.isArray(p.route)||p.route.length>10000||!p.route.every(finite)||p.destination&&!finite(p.destination))return;
 const next=p.route.map(project),end=p.destination?project(p.destination):null;
 if(!next.every(q=>isArtWalkable(q.x,q.y,routeOptions()))||end&&!isArtWalkable(end.x,end.y,routeOptions()))return;
 const a=p.activeWaypoint;if(a&&(!finite(a.world)||!Number.isFinite(a.tick)||a.adjusted!==undefined&&typeof a.adjusted!=='boolean'))return;
 route=next;activeWaypoint=a?{...a,...toArt(a.world.x,a.world.y)}:null;destination=end;renderer.target=destination;
}
function ui(){const p=master();$('clock').textContent=view.timeLabel;$('pause').textContent=manualPause?'继续':'暂停';$('action').textContent=renderer.mode==='planning'?'金丹篇山域 · 点击编号查看建位':renderer.reference?'原稿与实景使用同一镜头 · 再次点击切回实景':(activeWaypoint?'掌门行走中 · 点击地面可更改去处':view.masterActivityReason||p?.activityDetail?.reason||'左键行走与查看 · 滚轮缩放 · 右键拖动 · H 收起界面');panels.render();opening.render();if(modal==='dialog')personDialogue.render();combatUI.render();}
function pump(){
 const now=performance.now(),elapsed=Math.max(0,(now-lastPump)/1000);lastPump=now;let refreshed=false;
 if(ready&&!view.paused&&!closing&&!suspended&&!persistence.status().protected){try{
  const before=session.state.worldTick;advanceSect(session,elapsed);
  refresh({automatic:true,advanced:session.state.worldTick!==before,full:needsFullView()});refreshed=true;
  advanceApproach();if(!modal)advanceRoute();advanceApproach();
 }catch(e){manualPause=true;syncPause();fail(e);}}
 if(now-lastUI>250){if(!refreshed)refresh({automatic:true,full:needsFullView()});ui();lastUI=now;}
 if(host&&ready&&!closing&&!importing&&!persistence.status().pending&&!persistence.status().protected&&now-lastSave>15000)void save(false);
 if(noticeUntil&&now>noticeUntil){$('notice').hidden=true;noticeUntil=0;}
}
function frame(){if(combatUI.active())combatUI.draw();else renderer.draw(view);renderedFrames++;requestAnimationFrame(frame);}
$('home').onclick=()=>{if(combatUI.active())return;renderer.showCourtyard();$('reference-note').hidden=true;syncPause();ui();};
$('domain').onclick=()=>{if(combatUI.active())return;renderer.showOverview();$('reference-note').hidden=true;syncPause();ui();};
$('follow').onclick=()=>{if(combatUI.active())return;renderer.followPerson(MASTER);$('reference-note').hidden=true;syncPause();};
$('compare').onclick=()=>{if(combatUI.active())return;if(renderer.mode!=='local')renderer.showCourtyard();renderer.reference=!renderer.reference;$('reference-note').hidden=!renderer.reference;syncPause();ui();};
$('pause').onclick=()=>{manualPause=!manualPause;syncPause();};$('save').onclick=()=>void save();
for(const name of ['affairs','people','growth','supply'])$(name).onclick=()=>{if(!combatUI.active())panels.open(name);};
$('retry-save').onclick=async()=>{const result=await persistence.retry();if(result.ok){lastSave=performance.now();$('save-note').textContent='院务已保存';notice('保存成功，保护暂停已解除。');}};
$('export-recovery').onclick=async()=>{const result=await persistence.exportRecovery();$('exit-recovery').disabled=!(result.ok&&result.verified);$('recovery-note').textContent=result.ok?'恢复文件已导出并校验。可重试主存档保存，或使用恢复文件退出；下次入院选择该文件即可恢复。':result.cancelled?'已取消导出，当前进度仍保留。':result.error;};
$('exit-recovery').onclick=async()=>{const result=await host?.exitRecovery(saveSnapshot());if(!result?.ok){$('recovery-note').textContent=result?.error||'退出未完成。';$('exit-recovery').disabled=true;}};
function recoveryControls(){for(const id of ['recovery-choose','recovery-cancel'])$(id).disabled=recoveryBusy;$('recovery-confirm').disabled=recoveryBusy||!recoveryToken;}
async function chooseRecovery(){if(recoveryBusy)return;recoveryBusy=true;recoveryToken=null;recoveryControls();try{const result=await host?.previewRecovery();if(result?.ok){recoveryToken=result.token;const incoming=viewSect(restoreSect(result.data));$('recovery-preview').textContent=result.filename+' · '+(incoming.people.find(p=>p.id===MASTER)?.name||'掌门')+' · '+incoming.timeLabel+' · 世界步 '+incoming.tick;}else $('recovery-preview').textContent=result?.cancelled?'已取消选择，当前进度保留。':result?.error||'请在桌面应用中使用恢复文件。';}catch(e){$('recovery-preview').textContent=e.message;}finally{recoveryBusy=false;recoveryControls();}}
function openRecovery(){if(closing||recoveryBusy)return;approachPlanner.invalidate('正在恢复院务。');closeDialog();dialogTrigger=document.activeElement;dialogTriggerKey=dialogTrigger?.dataset.uiKey||null;importing=true;modal='recovery-dialog';recoveryToken=null;$('recovery-preview').textContent='请选择恢复文件。';$('recovery-dialog').hidden=false;recoveryControls();syncPause();$('recovery-choose').focus();}
async function cancelRecovery(){if(recoveryBusy)return;await host?.cancelRecovery();recoveryToken=null;importing=false;$('recovery-dialog').hidden=true;modal=null;syncPause();const target=dialogTrigger?.isConnected?dialogTrigger:[...document.querySelectorAll('[data-ui-key]')].find(el=>el.dataset.uiKey===dialogTriggerKey);target?.focus();dialogTrigger=null;dialogTriggerKey=null;}
$('recovery-open').onclick=$('loading-recovery').onclick=openRecovery;
$('recovery-choose').onclick=chooseRecovery;$('recovery-cancel').onclick=cancelRecovery;
$('recovery-confirm').onclick=async()=>{if(!recoveryToken||recoveryBusy)return;recoveryBusy=true;recoveryControls();await persistence.waitForIdle();try{const result=await host?.restoreRecovery({token:recoveryToken,previousState:ready?saveSnapshot():null});recoveryToken=null;if(result?.ok){location.reload();return;}$('recovery-preview').textContent=(result?.error||'恢复未完成。')+' 当前世界与原存档保留，请重新选择文件。';}catch(e){$('recovery-preview').textContent=e.message;}recoveryBusy=false;recoveryControls();};
$('retry-load').onclick=()=>location.reload();
$('close-person').onclick=$('leave-person').onclick=$('close-building').onclick=closeDialog;
$('focus-person').onclick=()=>{const person=inspection().people.find(p=>p.id===selected);closeDialog();if(person)renderer.focusLocation(person.location);};
function advanceApproach(){
 if(approachPlanner.status()?.status==='pending')return;
 if(!pendingApproach||modal)return;
 const person=view.people.find(p=>p.id===pendingApproach);
 if(!person){pendingApproach=null;notice('对方已离开当前可见范围，请从人物名单查看近况。');return;}
 if(person.admission?.distance?.near){
  const p=master(),stopped=issue({type:'move',x:p.x,y:p.y});
  pendingApproach=null;
  if(!stopped.ok)return notice(stopped.error);
  route=[];activeWaypoint=null;destination=null;renderer.target=null;routeFailure=null;
  openPerson(view.people.find(p=>p.id===person.id));return;
 }
 if(activeWaypoint||route.length)return;
 pendingApproach=null;if(routeFailure)return;
 openPerson(person);
 if(person.admission)notice(person.admission.distance?.reason||'对方的位置已有变化，请重新走近。');
}
$('approach-person').onclick=()=>{const person=inspection().people.find(p=>p.id===selected);closeDialog();if(!person)return notice('当前已不在可见人物名单中。');if(person.id===MASTER){panels.open('growth');return;}panels.close();const guestPoint=view.people.find(p=>p.id===person.id)?.lodging?.conversationPoint;panels.requestMove(guestPoint||person.location,{walk:planApproach,onStarted:()=>{pendingApproach=person.id;return manualPause?'走近已安排；点击继续后，掌门将沿路前往。':guestPoint?'掌门正前往客院，与来客当面交谈。':person.indoor?'掌门正前往所在建筑门前。':'掌门正沿路前往；抵达后重新查看交谈条件。';}});};
$('building-walk').onclick=()=>{const building=inspection().buildings.find(b=>b.id===selectedBuilding.id);closeDialog();const location=building?.location.focus;if(!location)return notice('当前未找到可达入口。');const p=toArt(location.x,location.y),result=moveArt(p.x,p.y);if(!result.ok)notice(result.error);};
let drag=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(combatUI.active())return;if(!ready||modal||openingReading||persistence.status().protected)return;if(e.button===2){drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);return;}if(e.button!==0)return;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(renderer.mode==='planning'){const site=renderer.pickDomainSite(x,y);return site?panels.openDomainSite(site.id):notice('选择编号建位查看设施与建设条件。');}if(renderer.reference)return notice('当前正在查看原稿，切回实景后可以行走。');const people=renderer.pickPeople(x,y);if(people.length>1)return panels.open('people',people.map(p=>p.id));if(people.length)return openPerson(people[0]);const b=renderer.pickBuilding(x,y);if(b)return openBuilding(b);const site=renderer.pickDomainSite(x,y);if(site)return panels.openDomainSite(site.id);const a=renderer.screenToArt(x,y),world=toWorld(a.x,a.y);pendingApproach=null;const result=panels.requestMove(world);if(result&&!result.ok)notice(result.error);});
canvas.addEventListener('pointermove',e=>{if(drag){renderer.panBy(e.clientX-drag.x,e.clientY-drag.y);drag={x:e.clientX,y:e.clientY};}else{const r=canvas.getBoundingClientRect();renderer.hover=renderer.pickPerson(e.clientX-r.left,e.clientY-r.top)?.id||null;}});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();if(modal||openingReading)return;const b=canvas.getBoundingClientRect();renderer.zoomAt(e.deltaY<0?1.1:1/1.1,e.clientX-b.left,e.clientY-b.top);},{passive:false});
addEventListener('resize',()=>{refresh();renderer.resize();});addEventListener('keydown',e=>{if(openingReading)return;if(combatUI.key(e))return;if(e.key==='Escape'){e.preventDefault();if(modal)closeDialog();else panels.back();return;}if(modal&&e.key==='Tab'){const items=[...$(modal).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>!el.hidden);if(items.length){const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}if(e.target.closest('input,select,textarea,button,[role=tab]'))return;if(e.code==='Space'&&!combatUI.active()){e.preventDefault();$('pause').click();}if(e.code==='KeyH'&&!combatUI.active()&&!modal&&$('management').hidden){document.body.classList.toggle('hud-hidden');}});
addEventListener('pagehide',()=>approachPlanner.dispose());
function refreshActivity(){
 if(!ready)return;
 const battleProjection=session.state.combat?.status==='active'&&view.expedition?.scene?.type==='combat'&&view.opening?.stage==='complete'&&!needsFullView()&&!closing&&!importing&&!suspended&&!persistence.status().protected;
 refresh(battleProjection?{automatic:true,force:true}:undefined);
}
for(const event of ['blur','focus'])addEventListener(event,refreshActivity);
document.addEventListener('visibilitychange',refreshActivity);
try{
 const settings=host?await host.settings():{qa:false};qaSaveTiming=!!settings.qa;suspended=!!settings.suspended;
 if(host){
  combatUI.setHostActivity(settings.active);
  host.onActivity(activity=>{combatUI.setHostActivity(activity.active);refreshActivity();});
  host.onClosing(async event=>{if(event?.reason==='timeout'){notice('仍在等待保存完成，请保留窗口。');return;}if(closing)return;if(importing){notice('请先完成或取消恢复。');await host.cancelClose?.();return;}if(!ready){await host.closeReady();return;}closing=true;approachPlanner.dispose();syncPause();await persistence.waitForIdle();const result=await save(false,'closing');if(result.ok)await host.closeReady();else{closing=false;await host.cancelClose?.();syncPause();}});
  const saved=await host.load();
  if(!saved.ok)throw Error('上次院务读取失败，原存档已保留。'+(saved.error||''));
  if(saved.found){session=restoreSect(saved.data);manualPause=typeof session.courtyardPresentation?.manualPause==='boolean'?session.courtyardPresentation.manualPause:session.state.speed===0;refresh();restorePresentation(session.courtyardPresentation);}
  host.onPower(p=>{suspended=p.suspended;syncPause();if(ready)refresh();});
 }
 ownedCommand.adopt();
 const farm=session.state.buildingsById['building:yunxiu:2'];
 if(farm?.type==='farm'&&farm.transform?.x===12&&farm.transform?.y===40){const terrain=issue({type:'enable-courtyard-terrain'});if(!terrain.ok)throw Error(terrain.error);}
 await renderer.load();await combatUI.load();renderer.resize();renderer.showCourtyard();refresh();renderer.view=view;if(restoredCamera){renderer.camera=restoredCamera;renderer.constrain();}opening.render();ready=true;lastPump=performance.now();syncPause();ui();$('loading').hidden=true;setInterval(pump,50);requestAnimationFrame(frame);
 if(settings.qa){window.courtyardQA={renderer,canvas,saveTimings:()=>({spans:qaSaveSpans.map(span=>({...span})),capped:qaSaveSpansCapped}),expedition:{canvas:combatUI.canvas,worldToScreen:combatUI.worldToScreen,screenToWorld:combatUI.screenToWorld,inputState:combatUI.inputState,presentationState:combatUI.presentationState},moveArt,openPerson,openBuilding,closeDialog,save,view:()=>refresh(),snapshot:()=>{refresh();return snapshotSect(session);},status:()=>({ready,manualPause,panelReading,openingReading,pauseReasons:pauseReasons(),persistence:persistence.status(),importing,errors:errors.map(error=>({...error}))}),setPaused:p=>{manualPause=p;syncPause();refresh();},route:()=>({remaining:route.length,waypoints:route.map(p=>({...p})),active:activeWaypoint,destination,failure:routeFailure,steps:routeSteps,planning:approachPlanner.status()}),metrics:()=>{refresh();return {tick:session.state.worldTick,errors:[...errors],renderedFrames,people:view.people.map(p=>({id:p.id,x:p.x,y:p.y,indoor:p.indoor})),crop:view.crop,routeSteps,routeFailure,viewport:{width:renderer.w,height:renderer.h,dpr:renderer.dpr},artSize:{width:view.domain.westWorkshopsEnabled?renderer.sceneRight()-renderer.sceneLeft():view.domain.servicesEnabled?SERVICES_ART_RIGHT:view.domain.residencesEnabled?RESIDENCES_ART_RIGHT:view.domain.enabled?DOMAIN_ART_WIDTH:1672,height:941-renderer.sceneTop(),top:renderer.sceneTop(),...(view.domain.westWorkshopsEnabled?{left:renderer.sceneLeft()}:{})}};}};if(settings.qaScenario&&settings.qaScenario!=='native'){const {runCourtyardQA}=await import('./courtyard-qa.mjs');void runCourtyardQA(window.courtyardQA,settings).catch(fail);}}
}catch(e){fail(e);$('loading-error').textContent='入院未完成：'+e.message;$('loading-actions').hidden=false;$('simulation-status').textContent='读取保护 · 世界尚未启动';}
