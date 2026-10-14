import { ArenaRenderer } from './arena-renderer.mjs';
import { TRAIL_LANDMARKS } from './trail-world.mjs';
import { createBattle, command, advanceBattle, snapshot, restoreBattle, SKILLS, TICK_SECONDS } from './arena-sim.mjs';
import { createRuntimeClock, createFrameDiagnostics } from './shared/ea-runtime.mjs';

const $ = id => document.getElementById(id);
const host = window.arenaHost;
const settings = host ? await host.settings() : { active: document.hasFocus(), qa: false, autoplay: false };
const sceneSettings = window.sceneHost ? await window.sceneHost.settings() : {};
const renderer = new ArenaRenderer($('scene'));
const clock = createRuntimeClock();
const diagnostics = createFrameDiagnostics({ sampleLimit: 600 });
const errors = [];
addEventListener('error', e => errors.push(e.message));
addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
let battle = createBattle();
let previous = snapshot(battle), accumulator = 0, hostActive = Boolean(settings.active), active = hostActive&&!document.hidden;
let sessionStarted = false, auto = false, lastAutoTick = -10, lastAutoSave = 0;
let saveFault = false, saved = null, loaded = null, lastStatus = 'ready', lastHud = 0;
let pointer = null, vectorKey = '0,0', noticeUntil = 0, autoResultAt = null, lastOrderFailure = 0;
const keys = new Set();
let followCamera = true;
const isTrail = () => Boolean(battle.trail);
function setAutoplay(value){auto=Boolean(value);lastAutoTick=-10;updateHUD();}
function followMaster(snap=false){renderer.setWorldForState(battle);renderer.followBattle(battle,{snap,zoom:Math.max(1,renderer.camera.zoom)});}
const metrics = { commands: {}, rejections: {}, saves: 0, loads: 0, results: [], activity: [], errors };
const reasonText = { busy:'正在运气，稍候再施法', cooldown:'此术仍在调息', qi:'灵气不足', mana:'灵气不足', no_target:'先选择一位对手', target:'请选择仍在场的对手', invalid_target:'请选择仍在场的对手', range:'距离太远，靠近后再施法', out_of_range:'距离太远，靠近后再施法', blocked:'此处被遮挡，请换个位置', path:'此处无法通行', no_path:'沿石阶与庭院通行', inactive:'请先开始演武', finished:'此场演武已经结束', dead:'沈砚已力竭', invalid:'这项行动暂不可用', paused:'静观中，行动已预排' };
const skillOrder = ['attack','sword','fire','ward'];
const skillLabels = ['普攻','剑气','火诀','护阵'];
const skillKeys = ['F','1','2','3'];
for (let i=0;i<24;i++) {
  const button=document.createElement('button'); button.className=`slot${i<4?'':' empty'}`;
  if(i<4){const skill=skillOrder[i];button.dataset.skill=skill;button.title=`${skillKeys[i]} · ${skillLabels[i]}`;button.setAttribute('aria-label',skillLabels[i]);button.innerHTML=`<small>${skillKeys[i]}</small><strong>${['剑','岚','火','阵'][i]}</strong><span class="cooldown" hidden></span>`;button.onclick=()=>issue(skill==='attack'?{type:'attack',targetId:battle.selectedTargetId}:{type:'cast',skill});}
  else {button.textContent='·';button.tabIndex=-1;button.setAttribute('aria-hidden','true');}
  $('slots').append(button);
}
function notice(text,seconds=2.4){$('notice').textContent=text;$('notice').classList.add('show');noticeUntil=performance.now()+seconds*1000;}
function issue(action,{silent=false,automated=false}={}) {
  if(!automated && !['pause','select','moveVector'].includes(action.type)) auto=false;
  const result=command(battle,action);
  metrics.commands[action.type]=(metrics.commands[action.type]||0)+1;
  if(!result.ok){metrics.rejections[result.reason]=(metrics.rejections[result.reason]||0)+1;if(!silent)notice(reasonText[result.reason]||result.reason);}
  else if(battle.paused && ['move','attack','cast'].includes(action.type) && !silent)notice('行动已预排 · 继续后执行');
  if(result.ok&&['move','moveVector','attack'].includes(action.type)&&!automated)followCamera=true;
  updateHUD();return result;
}
function setPaused(value){if(battle.status!=='active')return;issue({type:'pause',value},{silent:true});keys.clear();vectorKey='0,0';command(battle,{type:'moveVector',vector:{x:0,y:0}});accumulator=0;clock.reset();updateHUD();}
function setActivity(value){
  hostActive=Boolean(value);const next=hostActive&&!document.hidden;
  if(active===next)return;
  active=next;metrics.activity.push({active,tick:battle.tick});
  if(!active){keys.clear();pointer=null;vectorKey='0,0';command(battle,{type:'moveVector',vector:{x:0,y:0}});clock.suspend();accumulator=0;if(sessionStarted)void saveGame(true);}
  else clock.resume(performance.now());
  updateHUD();
}
if(host){host.onActivity(({active:value})=>setActivity(value));host.onClosing(async ({reason}={})=>{if(reason==='timeout'){notice('保存尚未完成，窗口已保留。可再次点击保存。',8);return;}setPaused(true);if(!sessionStarted||await saveGame(true)){if(settings.qaScenario==='native')await window.sceneHost.metrics({scenario:'native',...metrics,final:snapshot(battle),diagnostics:diagnostics.snapshot()});host.closeReady();}});}
else {addEventListener('focus',()=>setActivity(true));addEventListener('blur',()=>setActivity(false));}
document.addEventListener('visibilitychange',()=>setActivity(host?hostActive:document.hasFocus()));
if(!active)clock.suspend();

async function saveGame(quiet=false){
  if(!sessionStarted)return true;
  if(!host){if(!quiet)notice('请从桌面应用保存演武');return false;}
  const data=snapshot(battle);
  $('save-state').textContent='正在保存…';
  let result;try{result=await host.save(data);}catch(error){result={ok:false,error:error.message};}
  if(!result.ok){saveFault=true;command(battle,{type:'pause',value:true});clock.reset();$('save-state').textContent='保存失败 · 已暂停';notice(`保存失败，演武已暂停。${result.error||''}`,12);updateHUD();return false;}
  saved=data;saveFault=false;metrics.saves++;$('save-state').textContent=`已保存 · ${(data.tick/10).toFixed(1)} 秒`;if(!quiet)notice('演武已保存');return true;
}
async function loadGame(){
  const result=await host.load();
  if(!result.ok||!result.found){notice(result.error||'尚无演武存档',5);return false;}
  try{battle=restoreBattle(result.data);}catch(error){notice(`存档暂无法读取：${error.message}`,8);return false;}
  previous=snapshot(battle);sessionStarted=true;auto=false;saved=snapshot(battle);metrics.loads++;lastStatus=battle.status;accumulator=0;clock.reset();saveFault=false;keys.clear();pointer=null;vectorKey='0,0';lastAutoSave=battle.tick;lastOrderFailure=battle.nextEventId-1;
  if(battle.status==='active'){command(battle,{type:'pause',value:true});$('menu').hidden=true;notice('已回到保存的位置 · 空格继续');}else showResult();
  renderer.setWorldForState(battle);followCamera=isTrail();if(followCamera)followMaster(true);
  $('save-state').textContent=`已读取 · ${(battle.tick/10).toFixed(1)} 秒`;updateHUD();return true;
}
function newBattle(mode='team',watch=false){
  battle=createBattle({mode,seed:17});command(battle,{type:'start'});previous=snapshot(battle);sessionStarted=true;auto=watch;lastAutoTick=-10;lastAutoSave=0;lastOrderFailure=0;autoResultAt=null;lastStatus=battle.status;accumulator=0;keys.clear();vectorKey='0,0';saveFault=false;clock.reset();$('menu').hidden=true;
  renderer.setWorldForState(battle);renderer.camera={x:836,y:540,zoom:1.25};followCamera=isTrail();if(followCamera)followMaster(true);notice(isTrail()?(watch?'结伴下山 · 可随时接管':'沿南侧石阶下山，过桥赴谷中会武'):(watch?'自动演武 · 可随时接管':'演武开始 · Tab 选敌，F 追击'));void saveGame(true);updateHUD();
}
function showResult(){
  const titles={victory:'切磋得胜',defeat:'力竭收招',draw:'难分高下',retreated:'收招离场'};
  $('menu-title').textContent=isTrail()&&battle.status==='victory'?'会武归来':titles[battle.status]||'庭中演武';
  $('menu-copy').textContent=`本场 ${(battle.tick/10).toFixed(1)} 秒。${battle.status==='victory'?(isTrail()?'已走过溪桥与松林，携同门回到山院。':'同门相互印证，诸般招式尽收心中。'):battle.status==='retreated'?'留得余力，来日再试身手。':'调息片刻，再来切磋。'}`;
  $('start-actions').hidden=true;$('end-actions').hidden=false;$('menu').hidden=false;
}
function showMenu(){sessionStarted=false;auto=false;battle=createBattle();previous=snapshot(battle);lastStatus='ready';renderer.setWorldForState(battle);renderer.camera={x:836,y:470.5,zoom:1};$('menu-title').textContent='近山试行';$('menu-copy').textContent='携同门走下山阶，渡溪绕松，赴谷中会武。初阶三法随身，归来仍是同一段行程。';$('start-actions').hidden=false;$('end-actions').hidden=true;$('continue').hidden=!saved;$('menu').hidden=false;updateHUD();}
function nearestTarget(){const p=battle.actors.find(a=>a.id===battle.playerId);return battle.actors.filter(a=>a.team!==p.team&&a.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];}
function autopilot(){
  if(!auto||battle.tick-lastAutoTick<5)return;lastAutoTick=battle.tick;
  const p=battle.actors.find(a=>a.id===battle.playerId);if(!p||p.hp<=0||p.action)return;
  if(isTrail()&&battle.trail.phase!=='combat'){
    const goal=battle.trail.phase==='return'?TRAIL_LANDMARKS.home:TRAIL_LANDMARKS.valley;
    if(!p.path.length&&Math.hypot(p.x-goal.x,p.y-goal.y)>22)issue({type:'move',target:goal},{silent:true,automated:true});
    return;
  }
  const target=nearestTarget();if(!target)return;
  issue({type:'select',targetId:target.id},{silent:true,automated:true});
  const distance=Math.hypot(p.x-target.x,p.y-target.y);
  const cast=skill=>issue({type:'cast',skill,targetId:target.id},{silent:true,automated:true}).ok;
  if(p.shield<=0&&p.cooldowns.ward<=battle.tick&&p.qi>=12&&cast('ward'))return;
  if(distance<=320&&p.cooldowns.fire<=battle.tick&&p.qi>=16&&cast('fire'))return;
  if(distance<=260&&p.cooldowns.sword<=battle.tick&&p.qi>=9&&cast('sword'))return;
  issue({type:'attack',targetId:target.id},{silent:true,automated:true});
}
function updateHUD(){
  const p=battle.actors.find(a=>a.id===battle.playerId);if(!p)return;
  const seconds=Math.floor(battle.tick/10);$('battle-time').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('hp-fill').style.width=`${100*p.hp/p.maxHp}%`;$('hp-text').textContent=`气血 ${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('qi-fill').style.width=`${100*p.qi/p.maxQi}%`;$('qi-text').textContent=`灵气 ${Math.floor(p.qi)} / ${p.maxQi}`;
  $('shield-text').textContent=p.shield>0?`护身 ${Math.ceil(p.shield)} · ${Math.max(0,(p.shieldUntil-battle.tick)/10).toFixed(1)} 秒`:'演武以切磋为限';
  $('hero-status').textContent=p.hp<=0?'调息中':auto?'自动演武':p.action?skillLabels[skillOrder.indexOf(p.action.skill)]:p.autoAttack?'追击对手':'青岚剑修';
  const enemies=battle.actors.filter(a=>a.team==='red'&&a.hp>0).length,allies=battle.actors.filter(a=>a.team==='blue'&&a.hp>0).length;
  $('teams').textContent=`青方 ${allies}　·　赤方 ${enemies}`;$('battle-mode').textContent=isTrail()?`${battle.actors.length} 人近山会武`:battle.actors.length===2?'一对一切磋':'十六人演武';
  $('area-name').textContent=isTrail()?(p.y<941?'云 岫 山 院':p.y<1600?'松 溪 石 桥':p.y<2100?'绕 松 林 道':'谷 中 会 武'):'庭 中 演 武';
  $('journey').hidden=!isTrail()||battle.status!=='active';
  if(isTrail()){const phase=battle.trail.phase;$('journey-title').textContent=phase==='return'?'归院':phase==='combat'?'谷中会武':'结伴下山';$('journey-copy').textContent=phase==='return'?'沿原路走回山院，行程结束。':phase==='combat'?'移动选敌，借地形避让。剑气、火诀与护阵均需调息。':'循南侧石阶过桥，从松石两侧绕行，到谷中与同门切磋。';$('watch').textContent=auto?'亲自接管':'自动行进';}
  const target=battle.actors.find(a=>a.id===battle.selectedTargetId);$('target').hidden=!target;
  if(target){$('target-name').textContent=target.name;$('target-hp').textContent=`${Math.ceil(target.hp)} / ${target.maxHp}`;$('target-fill').style.width=`${100*target.hp/target.maxHp}%`;}
  $('pause').textContent=battle.paused?'继续 · 空格':'暂停 · 空格';$('pause').disabled=battle.status!=='active';$('leave').disabled=battle.status!=='active';$('save').disabled=!sessionStarted;
  $('pause-note').hidden=battle.status!=='active'||active&&!battle.paused;
  $('pause-note').textContent=!active?'暂离庭院 · 演武已静止':battle.plannedCommand?'行动已预排 · 空格继续后执行':'静观中 · 可选择目标并预排一项行动';
  for(const button of document.querySelectorAll('[data-skill]')){const skill=button.dataset.skill,remain=Math.max(0,(p.cooldowns[skill]-battle.tick)/10);const cd=button.querySelector('.cooldown');cd.hidden=remain===0;cd.textContent=remain.toFixed(1);button.classList.toggle('unavailable',remain>0);button.disabled=battle.status!=='active'||p.hp<=0;}
}
$('start-trail').onclick=()=>newBattle('trail');$('watch-trail').onclick=()=>newBattle('trail',true);$('start-trail32').onclick=()=>newBattle('trail32');$('watch').onclick=()=>setAutoplay(!auto);
$('start-team').onclick=()=>newBattle('team');$('start-duel').onclick=()=>newBattle('duel');$('start-auto').onclick=()=>newBattle('team',true);$('continue').onclick=()=>loadGame();$('again').onclick=()=>newBattle(battle.mode,auto);$('back-menu').onclick=showMenu;
$('pause').onclick=()=>setPaused(!battle.paused);$('save').onclick=()=>saveGame();$('leave').onclick=()=>{issue({type:'retreat'});};$('overview').onclick=()=>{followCamera=false;renderer.showOverview();};$('follow').onclick=()=>{followCamera=true;renderer.camera.zoom=1.25;followMaster(true);};
function cycleTarget(){const p=battle.actors.find(a=>a.id===battle.playerId),list=battle.actors.filter(a=>a.team!==p.team&&a.hp>0).sort((a,b)=>a.id.localeCompare(b.id));if(!list.length)return;const i=list.findIndex(a=>a.id===battle.selectedTargetId);issue({type:'select',targetId:list[(i+1)%list.length].id});}
addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();if(e.metaKey||e.ctrlKey||e.altKey)return;
  if([' ','tab','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  if(battle.status!=='active'||!$('menu').hidden)return;
  if(e.repeat&&[' ','tab','1','2','3','f','escape'].includes(key))return;
  if(key===' '){setPaused(!battle.paused);return;}if(key==='tab'){cycleTarget();return;}
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){auto=false;keys.add(key);if(!battle.paused&&!e.repeat){const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));issue({type:'moveVector',vector:{x,y}},{silent:true});}}
  if(key==='f')issue({type:'attack',targetId:battle.selectedTargetId});
  if(key==='escape'){issue({type:'stop'});setPaused(true);}
  const skill={'1':'sword','2':'fire','3':'ward'}[key];if(skill)issue({type:'cast',skill});
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const canvas=$('scene');canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,originX:e.clientX,originY:e.clientY,button:e.button};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.button!==2)return;followCamera=false;const a=renderer.screenToWorld(pointer.x,pointer.y),b=renderer.screenToWorld(e.clientX,e.clientY);renderer.camera.x+=a.x-b.x;renderer.camera.y+=a.y-b.y;pointer.x=e.clientX;pointer.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{
  if(pointer?.button===0&&Math.hypot(e.clientX-pointer.originX,e.clientY-pointer.originY)<6&&battle.status==='active'){
    const mini=renderer.minimapRect;
    if(mini&&e.clientX>=mini.x&&e.clientX<=mini.x+mini.w&&e.clientY>=mini.y&&e.clientY<=mini.y+mini.h){const aim=renderer.minimapToWorld(e.clientX,e.clientY);if(aim){followCamera=false;renderer.camera.x=aim.x;renderer.camera.y=aim.y;renderer.constrainCamera();}pointer=null;return;}
    const at=renderer.screenToWorld(e.clientX,e.clientY);const candidates=battle.actors.filter(a=>a.hp>0&&a.team==='red'&&Math.abs(a.x-at.x)<26&&at.y>=a.y-76&&at.y<a.y+10).sort((a,b)=>b.y-a.y);
    if(candidates.length)issue({type:'select',targetId:candidates[0].id});else issue({type:'move',target:at});
  }pointer=null;
});
canvas.addEventListener('dblclick',e=>{const mini=renderer.minimapRect;if(mini&&e.clientX>=mini.x&&e.clientX<=mini.x+mini.w&&e.clientY>=mini.y&&e.clientY<=mini.y+mini.h)return;const at=renderer.screenToWorld(e.clientX,e.clientY),target=battle.actors.filter(a=>a.hp>0&&a.team==='red'&&Math.abs(a.x-at.x)<26&&at.y>=a.y-76&&at.y<a.y+10).sort((a,b)=>b.y-a.y)[0];if(target)issue({type:'attack',targetId:target.id});});
canvas.addEventListener('wheel',e=>{e.preventDefault();const before=renderer.screenToWorld(e.clientX,e.clientY);followCamera=false;renderer.camera.zoom=Math.max(isTrail()?.33:1,Math.min(2.8,renderer.camera.zoom*Math.exp(-e.deltaY*.001)));const after=renderer.screenToWorld(e.clientX,e.clientY);renderer.camera.x+=before.x-after.x;renderer.camera.y+=before.y-after.y;},{passive:false});
addEventListener('resize',()=>renderer.resize());

let qa=null;
try{
  await renderer.load();renderer.resize();renderer.camera={x:836,y:470.5,zoom:1};
  if(host){loaded=await host.load();if(loaded.ok&&loaded.found){saved=loaded.data;$('continue').hidden=false;}else if(!loaded.ok){$('load-warning').hidden=false;$('load-warning').textContent=`原存档已保留，暂无法读取：${loaded.error}`;}}
  $('loading').hidden=true;updateHUD();
  if(settings.qa)console.log('ARENA_READY',JSON.stringify({scenario:settings.qaScenario,hostActive,hidden:document.hidden,active}));
  if(settings.autoplay)newBattle(settings.trail32?'trail32':settings.trail?'trail':'team',true);
  else if(settings.trail)newBattle(settings.trail32?'trail32':'trail');
  if(settings.qaScenario&&settings.qaScenario!=='native'){const trailQA=settings.qaScenario.startsWith('trail-');const mod=await import(trailQA?'./trail-qa.mjs':'./arena-qa.mjs');qa=await (trailQA?mod.createTrailQA:mod.createArenaQA)({scenario:settings.qaScenario,sceneSettings,host:window.sceneHost,api:{newBattle,issue,setPaused,setAutoplay,saveGame,loadGame,readSaved:()=>host.load(),getState:()=>snapshot(battle),getMetrics:()=>({...metrics,diagnostics:diagnostics.snapshot()}),getActive:()=>active,renderer,canvas,notice}});}
}catch(error){errors.push(error.message);$('loading').textContent=`入院失败：${error.message}`;throw error;}
function frame(now){
  const began=performance.now(),elapsed=clock.next(now);
  if(active&&!document.hidden&&!battle.paused&&battle.status==='active'&&!saveFault){
    accumulator+=elapsed.dt;
    const x=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
    const p=battle.actors.find(a=>a.id===battle.playerId),length=Math.hypot(x,y),nx=length?x/length:0,ny=length?y/length:0;
    if((!p.action||!length)&&(Math.abs(p.moveInput.x-nx)>.001||Math.abs(p.moveInput.y-ny)>.001))command(battle,{type:'moveVector',vector:{x,y}});
    while(accumulator>=TICK_SECONDS){previous=snapshot(battle);autopilot();advanceBattle(battle,1);accumulator-=TICK_SECONDS;if(battle.status!=='active')break;}
    if(battle.tick-lastAutoSave>=50){lastAutoSave=battle.tick;void saveGame(true);}
  }
  if(battle.status!==lastStatus){lastStatus=battle.status;if(!['active','ready'].includes(lastStatus)){metrics.results.push({status:lastStatus,tick:battle.tick});showResult();void saveGame(true);autoResultAt=now;}}
  if(auto&&autoResultAt&&now-autoResultAt>6000&&active&&!settings.qaScenario)newBattle(battle.mode,true);
  const failedOrder=battle.events.findLast(e=>e.kind==='order_failed'&&e.id>lastOrderFailure);if(failedOrder){lastOrderFailure=failedOrder.id;notice(`预排行动未执行：${failedOrder.reason}`,4);}
  if(followCamera&&isTrail())followMaster();
  renderer.render(battle,{previous,alpha:battle.paused||!active?1:Math.min(1,accumulator/TICK_SECONDS)});
  if(now-lastHud>=80){updateHUD();lastHud=now;}if(now>noticeUntil)$('notice').classList.remove('show');
  diagnostics.record({elapsedMs:elapsed.elapsedMs,workMs:performance.now()-began,visible:active&&!document.hidden,droppedGap:elapsed.droppedGap});
  qa?.update(now);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
