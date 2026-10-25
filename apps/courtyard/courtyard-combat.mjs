/** Desktop combat presentation. Formal commands and ticks own all outcomes. */
import {loadCombatActorAssets,createCombatActorRenderer} from './courtyard-combat-actors.mjs';
import {createCombatEffectsRenderer} from './courtyard-combat-effects.mjs';
import {createCombatPresentation,combatActorFaction,combatDepthOrder,combatActorAtScreen} from './courtyard-combat-presentation.mjs';
import {createCombatAudio} from './courtyard-combat-audio.mjs';
import {expeditionPartyPlan} from './courtyard-expedition-party.mjs';
import {COMBAT_BACKDROPS,combatBackdrop,combatGroundTiles,combatBackdropProps,combatBackdropDecorations,drawCombatBackdropProp} from './courtyard-combat-backdrops.mjs';
import {usesCombatCamera,combatCameraTransform,combatHudSafeBottom,legacyCombatTransform,combatWorldToScreen,combatScreenToWorld,combatPointerScreenPoint,combatSceneBounds,combatExitLandmark} from './courtyard-combat-camera.mjs';
import {combatActorHeight} from './courtyard-combat-dimensions.mjs';
import {expeditionReturnPlan} from './courtyard-expedition-return.mjs';
import {createExpeditionResources} from './courtyard-expedition-resources.mjs';
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const phaseNames={windup:'起手',execute:'出手',release:'出手',recovery:'收势',hit:'受击',down:'倒地',evade:'短步',guard:'护持'};
const MOVE_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD']);
const SHORTCUTS={Digit1:'attack',Digit2:'spell',Digit3:'guard',Space:'dodge'};
const loadImage=name=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('战场素材读取失败：'+name));im.src=new URL('assets/'+name,import.meta.url).href;});
const loadJson=async(name,{optional=false}={})=>{const response=await fetch(new URL('assets/'+name,import.meta.url));if(optional&&response.status===404)return null;if(!response.ok)throw Error('战场素材清单读取失败：'+name+' ('+response.status+')');return response.json();};
const tacticNames={guard:'护住掌门',focus:'合击目标',rally:'就近结阵',retreat:'同行撤离'};

export function createCourtyardCombat({getView,command,announce,beforeDepart,canInteract,pause,requestGateWalk=null,openMasterActivity=null,onDepartureReadingChange=()=>{}}){
 const canvas=$('expedition-canvas'),ctx=canvas.getContext('2d');
 const held=new Set();let images=null,actorRenderer=null,effectRenderer=null,aim=null,pointer=null,lastMove={x:0,y:0},lastSkill='spell',transform=null,sceneKey=null,hostActive=true,hoveredActorId=null,targetSignature='',hudLayout=null;
 const presentation=createCombatPresentation(),combatAudio=createCombatAudio();let renderScene=null;
 const returnNote=document.createElement('small');returnNote.id='expedition-return-note';$('expedition-world-actions').append(returnNote);
 const artCreditsButton=document.createElement('button');artCreditsButton.id='combat-art-credits-open';artCreditsButton.type='button';artCreditsButton.textContent='美术署名';$('expedition-heading').append(artCreditsButton);
 const artCredits=document.createElement('dialog');artCredits.id='combat-art-credits-dialog';artCredits.setAttribute('aria-labelledby','combat-art-credits-title');
 const artCreditsTitle=document.createElement('h2');artCreditsTitle.id='combat-art-credits-title';artCreditsTitle.textContent='美术署名';
 const artCreditsText=document.createElement('pre');artCreditsText.id='combat-art-credits-content';artCreditsText.textContent='正在读取署名清单…';
 const artCreditsClose=document.createElement('button');artCreditsClose.type='button';artCreditsClose.textContent='关闭';artCredits.append(artCreditsTitle,artCreditsText,artCreditsClose);document.body.append(artCredits);
 let creditsRequest=null,creditsReading=false;
 const exp=()=>getView().expedition;
 const resourcesUI=createExpeditionResources($('expedition-world-actions'),{getWorld:()=>exp()?.world,command:action=>world(action)});
 const active=()=>!!exp()?.away;
 const battle=()=>exp()?.scene?.type==='combat'?exp().scene:null;
 const running=()=>hostActive&&!!battle()?.interactive&&!getView().paused&&canInteract()&&document.hasFocus();
 const departure=document.createElement('dialog');departure.id='expedition-departure';departure.setAttribute('aria-labelledby','expedition-departure-title');
 const departureTitle=document.createElement('h2');departureTitle.id='expedition-departure-title';departureTitle.textContent='出谷准备';
 const departureHelp=document.createElement('p');departureHelp.textContent='邀请愿意同行的门人，最多两位。未选择时由掌门独行。';
 const departureSupply=document.createElement('p');departureSupply.id='expedition-supply-note';
 const departureCandidates=document.createElement('div');departureCandidates.id='expedition-party-candidates';
 const departureMessage=document.createElement('p');departureMessage.id='expedition-party-message';departureMessage.setAttribute('role','status');
 const departureActions=document.createElement('div');departureActions.className='expedition-departure-actions';
 const departureCancel=document.createElement('button');departureCancel.id='expedition-depart-cancel';departureCancel.textContent='暂不出谷';
 const departureCurrent=document.createElement('button');departureCurrent.id='expedition-depart-current';departureCurrent.textContent='查看当前事务';departureCurrent.onclick=()=>{closeDeparture();openMasterActivity?.();};
 const departureConfirm=document.createElement('button');departureConfirm.id='expedition-depart-confirm';departureConfirm.textContent='掌门独行出谷';
 departureActions.append(departureCurrent,departureCancel,departureConfirm);departure.append(departureTitle,departureHelp,departureSupply,departureCandidates,departureMessage,departureActions);document.body.append(departure);
 let departureSelection=[],departureSignature='',departureReading=false;
 function setDepartureReading(reading){if(departureReading!==reading){departureReading=reading;onDepartureReadingChange(departureReading||creditsReading);}}
 function setCreditsReading(reading){if(creditsReading!==reading){creditsReading=reading;onDepartureReadingChange(departureReading||creditsReading);}}
 function closeCredits(){if(artCredits.open)artCredits.close();setCreditsReading(false);canvas.focus({preventScroll:true});}
 function openCredits(){
  if(!canInteract()||departure.open||artCredits.open)return;clearInput();artCredits.showModal();setCreditsReading(true);artCreditsClose.focus();
  creditsRequest??=fetch(new URL('assets/combat-pixel-v1/CREDITS.txt',import.meta.url)).then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.text();}).then(content=>{artCreditsText.textContent=content;}).catch(error=>{artCreditsText.textContent='美术署名清单读取失败：'+error.message;creditsRequest=null;});
 }
 artCreditsButton.onclick=openCredits;artCreditsClose.onclick=closeCredits;artCredits.addEventListener('cancel',event=>{event.preventDefault();closeCredits();});artCredits.addEventListener('close',()=>setCreditsReading(false));
 function closeDeparture(){if(departure.open)departure.close();setDepartureReading(false);$('expedition-open').focus({preventScroll:true});}
 function renderDeparture(){
  if(!departure.open)return;const plan=expeditionPartyPlan(exp()?.world?.party,departureSelection),signature=JSON.stringify([plan.maxCompanions,plan.candidates]);
  departureHelp.textContent=`邀请愿意同行的门人，最多${plan.maxCompanions}位。未选择时由掌门独行。`;
  const supply=getView().foodSupply;departureSupply.textContent=supply?`院中现有口粮 ${Number(supply.available.toFixed(1))} 份，当前全院每日消耗 ${supply.dailyDemand} 份。出发会携走路粮；留守收成实际送入公库后才能供给。`:'';
  if(signature!==departureSignature){
   departureSignature=signature;departureCandidates.replaceChildren();
   if(!plan.candidates.length){const empty=document.createElement('p');empty.className='party-empty';empty.textContent='当前院中没有可邀请的门人，掌门仍可独行。';departureCandidates.append(empty);}
   for(const person of plan.candidates){const row=document.createElement('label'),check=document.createElement('input'),body=document.createElement('span'),name=document.createElement('strong'),reason=document.createElement('small');row.className='expedition-party-candidate';check.type='checkbox';check.value=person.personId;check.dataset.companionId=person.personId;name.textContent=person.name;reason.textContent=person.reason||'';body.append(name,reason);row.append(check,body);departureCandidates.append(row);check.onchange=()=>{departureSelection=check.checked?[...departureSelection,person.personId]:departureSelection.filter(id=>id!==person.personId);departureMessage.textContent='';renderDeparture();};}
  }
  for(const check of departureCandidates.querySelectorAll('input')){const person=plan.candidates.find(c=>c.personId===check.value),selected=plan.selected.includes(check.value);check.checked=selected;check.disabled=!person?.available||!selected&&plan.selected.length>=plan.maxCompanions;}
  const exit=exp()?.world?.exits?.find(e=>e.id==='exit:yunxiu-valley');departureCurrent.hidden=!openMasterActivity||!!exit?.available;departureConfirm.textContent=plan.label;departureConfirm.disabled=!plan.available||!exit?.available;departureMessage.textContent=plan.reason||(!exit?.available?exit?.reason||'当前无法出谷。':'')||departureMessage.textContent;
 }
 function openDeparture(){if(!canInteract()||departure.open||artCredits.open)return;beforeDepart();departureSelection=[];departureSignature='';departureMessage.textContent='';departure.showModal();setDepartureReading(true);renderDeparture();departureConfirm.focus();}
 departureCancel.onclick=closeDeparture;departure.addEventListener('cancel',event=>{event.preventDefault();closeDeparture();});departure.addEventListener('close',()=>setDepartureReading(false));
 departureConfirm.onclick=()=>{const plan=expeditionPartyPlan(exp()?.world?.party,departureSelection);if(!plan.available){departureMessage.textContent=plan.reason;return;}const result=world({action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4},companions:plan.selected});if(result?.ok)closeDeparture();else{departureMessage.textContent=result?.error||'当前出行条件有变，请重新查看。';renderDeparture();}};
 const partyStatus=document.createElement('p');partyStatus.id='expedition-party-status';$('expedition-world-actions').before(partyStatus);
 const squadControls=document.createElement('div');squadControls.id='combat-squad-controls';
 const targetLabel=document.createElement('label');targetLabel.textContent='目标 ';const targetSelect=document.createElement('select');targetSelect.id='combat-target-select';targetSelect.setAttribute('aria-label','当前敌人');targetLabel.append(targetSelect);
 const tacticLabel=document.createElement('label');tacticLabel.textContent='同行 ';const tacticSelect=document.createElement('select');tacticSelect.id='combat-tactic-select';tacticSelect.setAttribute('aria-label','同行战术');for(const [id,name] of Object.entries(tacticNames)){const option=document.createElement('option');option.value=id;option.textContent=name;tacticSelect.append(option);}tacticLabel.append(tacticSelect);
 squadControls.append(targetLabel,tacticLabel);$('combat-actions').before(squadControls);
 targetSelect.onchange=()=>send({type:'combat-target',targetId:targetSelect.value||null});
 tacticSelect.onchange=()=>send({type:'combat-tactic',tactic:tacticSelect.value});
 function send(request,{silent=false}={}){if(!canInteract())return {ok:false};const result=command(request);if(!result.ok&&!silent)announce(result.error);return result;}
 function world(payload){clearInput();return send({type:'world',action:payload});}
 function movement(force=false){
  const next=running()?{x:Number(held.has('KeyD'))-Number(held.has('KeyA')),y:Number(held.has('KeyS'))-Number(held.has('KeyW'))}:{x:0,y:0};
  if(!force&&next.x===lastMove.x&&next.y===lastMove.y)return;
  lastMove=next;if(battle()?.interactive)send({type:'combat-input',move:next},{silent:true});
 }
 function clearInput(){held.clear();lastMove={x:0,y:0};if(battle()?.interactive)send({type:'combat-input',move:{x:0,y:0},reset:true},{silent:true});}
 const inputTimer=setInterval(()=>{if(held.size){if(running())movement(true);else clearInput();}},200);
 addEventListener('blur',clearInput);
 addEventListener('keyup',event=>{if(MOVE_KEYS.has(event.code)&&held.delete(event.code)){event.preventDefault();movement();}});
 function target(refresh=true){if(refresh)updatePointerAim();const b=battle();return aim?{...aim}:b?{x:b.player.x+3,y:b.player.y}:null;}
 function cast(actionId){
  void combatAudio.unlock();
  if(!battle()?.interactive||!canInteract()||!hostActive||!document.hasFocus())return;
  lastSkill=actionId;const point=target();
  const request={type:'combat',actionId,...(actionId==='guard'||actionId==='retreat'?{}:{target:point})};
  const result=send(request);if(result?.ok)canvas.focus({preventScroll:true});
 }
 function key(event){
  if(artCredits.open){if(event.code==='Escape'){event.preventDefault();closeCredits();}return true;}
  if(departure.open){if(event.code==='Escape'){event.preventDefault();closeDeparture();}return true;}
  if(!active()||!battle()?.interactive)return false;
  if(!canInteract()){clearInput();return false;}
  if(!hostActive){clearInput();return true;}
  if(event.target.closest('input,textarea,select,[contenteditable=true]'))return false;
  void combatAudio.unlock();
  if(event.code==='Escape'){event.preventDefault();clearInput();pause();return true;}
  if(event.code==='Tab'){event.preventDefault();if(!event.repeat){const b=battle(),enemies=b.enemies.filter(e=>e.hp>0);if(enemies.length){const index=enemies.findIndex(e=>e.id===b.selectedTargetId);send({type:'combat-target',targetId:enemies[(index+1)%enemies.length].id});}}return true;}
  if(MOVE_KEYS.has(event.code)){
   event.preventDefault();if(running()&&!event.repeat){held.add(event.code);movement();}return true;
  }
  if(SHORTCUTS[event.code]){event.preventDefault();if(!event.repeat)cast(SHORTCUTS[event.code]);return true;}
  return false;
 }
 function exit(){if(!active()){const e=exp()?.world?.exits?.find(e=>e.id==='exit:yunxiu-valley');if(e)world({action:'exit',exitId:e.id,cargo:{food:4}});return;}const plan=expeditionReturnPlan(exp()?.world);if(plan?.available)world(plan.request);else if(plan?.reason)announce(plan.reason);}
 $('expedition-open').onclick=()=>{if(!canInteract())return;const homeExit=exp()?.world?.exits?.find(e=>e.id==='exit:yunxiu-valley');if(homeExit?.near)openDeparture();else{beforeDepart();if(requestGateWalk&&homeExit){const result=requestGateWalk(homeExit);if(result&&!result.ok)announce(result.error);}else exit();}};
 $('expedition-exit').onclick=exit;
 const encounter=()=>exp()?.world?.scene?.objects?.find(object=>object.encounterId);
 $('expedition-approach').onclick=()=>{const foe=encounter();if(foe?.approach)world({action:'move',...foe.approach});};
 $('expedition-engage').onclick=()=>{const foe=encounter();if(foe?.available&&foe.near){world({action:'engage',objectId:foe.id});canvas.focus({preventScroll:true});}};
 $('expedition-return').onclick=()=>world({action:'return'});
 $('combat-acknowledge').onclick=()=>{clearInput();send({type:'combat-acknowledge'});};
 $('combat-auto').onclick=()=>send({type:'combat-auto',enabled:!exp()?.combat?.controls?.autoAttack});
 for(const button of document.querySelectorAll('[data-combat-action]'))button.onclick=()=>cast(button.dataset.combatAction);
 for(const button of document.querySelectorAll('[data-combat-action]'))button.onpointerenter=()=>{lastSkill=button.dataset.combatAction;};
 const actorAt=at=>combatActorAtScreen(renderScene||battle(),at,{worldToScreen,heightOf:()=>combatActorHeight(transform||coordinates())});
 function updatePointerAim(){
  if(!pointer||!battle())return null;const t=transform||coordinates(),at=combatPointerScreenPoint(pointer,canvas.getBoundingClientRect(),t);
  if(!at)return null;aim=combatScreenToWorld(t,at.x,at.y);hoveredActorId=pointer.inside?actorAt(at)?.id||null:null;return at;
 }
 function rememberPointer(event){pointer={clientX:event.clientX,clientY:event.clientY,inside:true};return updatePointerAim();}
 canvas.addEventListener('pointermove',event=>{if(battle())rememberPointer(event);});
 canvas.addEventListener('pointerleave',()=>{if(pointer)pointer.inside=false;hoveredActorId=null;});
 canvas.addEventListener('pointerdown',event=>{if(event.button!==0||!battle())return;void combatAudio.unlock();const at=rememberPointer(event),actor=at?actorAt(at):null;if(battle().interactive&&(!actor||combatActorFaction(actor,battle())==='hostile'))send({type:'combat-target',targetId:actor?.id||null});canvas.focus({preventScroll:true});});
 canvas.addEventListener('contextmenu',event=>event.preventDefault());

 function coordinates(scene=renderScene||battle()){
  const width=canvas.clientWidth,height=canvas.clientHeight;if(usesCombatCamera(scene)){
   if(!hudLayout||hudLayout.width!==width||hudLayout.height!==height){const panel=$('expedition-controls');hudLayout={width,height,safeBottom:combatHudSafeBottom(canvas.getBoundingClientRect(),panel.hidden?null:panel.getBoundingClientRect(),height)};}
   return combatCameraTransform(scene,{width,height,safeBottom:hudLayout.safeBottom});
  }
  const config=combatBackdrop(scene);return legacyCombatTransform({width,height,image:images?.backgrounds?.[config.id],inset:config.clearGround});
 }
 function worldToScreen(x,y){return combatWorldToScreen(transform||coordinates(),x,y);}
 function screenToWorld(x,y){return combatScreenToWorld(transform||coordinates(),x,y);}
 function text(id,value){const node=$(id);if(node.textContent!==value)node.textContent=value;}
 function render(){
  // Measure after this UI update on the next paint, rather than on every rAF.
  hudLayout=null;
  const v=getView(),e=v.expedition,b=battle(),away=active(),travel=e?.world?.travel,scene=e?.world?.scene;
  if(departure.open){if(away)closeDeparture();else renderDeparture();}
  $('expedition').hidden=!away;document.body.classList.toggle('expedition-away',away);document.body.classList.toggle('combat-active',!!b);
  for(const id of ['home','domain','follow','compare','affairs','people','growth','supply'])$(id).disabled=away;
  const homeExit=e?.world?.exits?.find(x=>x.id==='exit:yunxiu-valley');
  $('expedition-open').hidden=away||v.opening?.stage!=='complete';text('expedition-open',homeExit?.near?'出谷':'去山门');$('expedition-open').disabled=!homeExit;
  $('expedition-open').title=homeExit?.reason||'沿山道出谷，携带实际口粮。';
  if(!away)return;
  const party=e?.world?.party,memberIds=party?.companionIds||[],memberNames=memberIds.map(id=>party?.members?.find(p=>p.personId===id)?.name||v.people?.find(p=>p.id===id)?.name||e?.world?.scene?.actors?.find(p=>p.personId===id)?.name||id);partyStatus.hidden=!!b;partyStatus.textContent=memberNames.length?'同行：'+memberNames.join('、'):'掌门独行';
  const key=b?.sessionId||scene?.id||'travel';if(sceneKey!==key){sceneKey=key;aim=null;pointer=null;hoveredActorId=null;renderScene=null;held.clear();lastMove={x:0,y:0};transform=null;presentation.reset();}
  text('expedition-name',b?combatBackdrop(b).title:travel?'山间行程':scene?.name||'山外行程');
  canvas.setAttribute('aria-label',b?combatBackdrop(b).title+'，WASD移动，鼠标瞄准，数字键施技':'掌门山外行程');
  text('expedition-help',b?'WASD 走位　鼠标瞄准　1 / 2 / 3 施技　空格短步　Tab 选敌　Esc 暂停':'沿已知山道出行，近处确认应战。');
  $('expedition-world-actions').hidden=!!b||!!travel;$('combat-actions').hidden=!b?.interactive;
  resourcesUI.render();
  squadControls.hidden=!b?.interactive;
  if(b){
   const enemies=b.enemies||[],signature=JSON.stringify(enemies.map(e=>[e.id,e.name,e.hp>0]));
   if(signature!==targetSignature){targetSignature=signature;targetSelect.replaceChildren();const none=document.createElement('option');none.value='';none.textContent='未锁定';targetSelect.append(none);for(const enemy of enemies){const option=document.createElement('option');option.value=enemy.id;option.textContent=enemy.name+(enemy.hp<=0?' · 倒下':'');option.disabled=enemy.hp<=0;targetSelect.append(option);}}
   targetSelect.value=b.selectedTargetId||'';targetSelect.disabled=!b.interactive;tacticLabel.hidden=!b.allies?.length;tacticSelect.value=e.combat?.tactic||'guard';tacticSelect.disabled=!b.interactive;
  }
  $('expedition-encounter').hidden=!!b||!!travel;
  $('expedition-return').hidden=!travel||!travel.returnAvailable;
  $('combat-acknowledge').hidden=!b||b.interactive;
  text('combat-acknowledge',({won:'收存战果',lost:'确认伤势，安排返院',retreated:'确认撤离，继续返院'})[b?.status]||'确认战报');
  const returnPlan=expeditionReturnPlan(e?.world),exitView=e?.world?.exits?.find(x=>x.destination==='scene:yunxiu-courtyard');text('expedition-exit',returnPlan?.label||'返院');$('expedition-exit').disabled=!returnPlan?.available;$('expedition-exit').title=returnPlan?.reason||'';returnNote.textContent=returnPlan?.reason||'';
  const foe=scene?.objects?.find(o=>o.encounterId),p=scene?.player,near=foe?.near===true;
  $('expedition-engage').disabled=!foe?.available||!near;$('expedition-approach').disabled=!foe?.available;
  $('encounter-foe').hidden=!foe?.available||foe?.entityKind!=='beast';
  text('expedition-approach','走近'+(foe?.name||'遭遇地点'));
  text('encounter-name',foe?.name||'当地见闻');
  text('encounter-description',foe?.reason||'当前未见可应战的对象，可沿已知路线继续行动。');
  text('encounter-person-name',(p?.name||'掌门')+' · '+(scene?.name||'山外'));
  const eyebrow=$('expedition-encounter').querySelector('.encounter-eyebrow');if(eyebrow)eyebrow.textContent=(scene?.name||'山外')+'遭遇';
  text('encounter-position',travel?'':e?.world?.activity?.kind==='walk'?'掌门正沿山道行走……':near?'已来到'+(foe?.name||'遭遇地点')+'附近，可决定应战。':exitView?.near?'掌门已到归院道。':'掌门正在'+(scene?.name||'当地')+'。');
  const actions=e?.combat?.manualActions||e?.combat?.actions||[];
  for(const button of document.querySelectorAll('[data-combat-action]')){
   const id=button.dataset.combatAction,a=actions.find(a=>a.id===id),remaining=Math.max(0,(a?.cooldownUntil-v.tick)/10);
   button.disabled=!b?.interactive||!a||a.disabled;button.title=a?.reason||'';
   const label=button.querySelector('.skill-name'),cooldown=button.querySelector('.skill-cooldown');
   if(label)label.textContent=id==='retreat'?'撤退':a?.name||({attack:'剑式',spell:'青岚术',guard:'护持',dodge:'短步'})[id];
   if(cooldown)cooldown.textContent=remaining>0?remaining.toFixed(1)+'s':a?.qi?'灵力 '+a.qi:'就绪';
  }
  const automatic=!!e?.combat?.controls?.autoAttack;$('combat-auto').setAttribute('aria-pressed',String(automatic));text('combat-auto',automatic?'自动普攻 · 开':'自动普攻 · 关');
  const pending=e?.combat?.pending,wound=v.masterWound??v.people?.find(x=>x.id==='person:master')?.wound;
  if(!Number.isFinite(wound))throw Error('战场展示缺少掌门真实伤势。');
  text('combat-state',b?`气血 ${Math.ceil(b.player.hp)} / ${b.player.maxHp}　灵力 ${Math.ceil(b.player.qi)}　伤势 ${wound.toFixed(1)}%`+(b.player.guard>0?'　护持 '+b.player.guard.toFixed(1)+'s':'')+(pending?'　'+(phaseNames[pending.phase]||pending.phase):''):travel?`前往${travel.destination} · 还需 ${(travel.remainingTicks/10).toFixed(1)} 秒`:`伤势 ${wound.toFixed(1)}%`);
  text('combat-message',b?(pending?.failure||({won:'此战已结束，战果与伤势已记存。',lost:'掌门重伤，确认战报后可安排返院。',retreated:'已撤离战场，伤势随同一人物保留。'})[b.status]||(v.paused?'世界已暂停，恢复后动作继续。':'留意抬臂落点，走位与短步可避开攻击。')):travel?.reason||'');
  const enemy=b?.enemies?.find(a=>a.id===b.selectedTargetId)||b?.enemies?.find(a=>a.hp>0)||b?.enemies?.[0];$('combat-enemy-status').hidden=!enemy;text('combat-enemy-status',enemy?`${enemy.name}　${Math.ceil(enemy.hp)} / ${enemy.maxHp}`+(b.enemies.length>1?`　余敌 ${b.enemies.filter(a=>a.hp>0).length}`:''):'');
 }
 function ellipse(point,rx,ry,fill,stroke,width=1){ctx.beginPath();ctx.ellipse(point.x,point.y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
 function drawBackdrop(scene){const config=combatBackdrop(scene),im=images.backgrounds[config.id],t=transform;if(im){if(config.mode==='tiled')for(const tile of combatGroundTiles(config,t))ctx.drawImage(im,tile.x,tile.y,tile.width,tile.height);else ctx.drawImage(im,t.imageX,t.imageY,t.imageWidth,t.imageHeight);return;}ctx.fillStyle='#172d26';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);ctx.fillStyle='#e9d9ac';ctx.font='15px serif';ctx.textAlign='center';ctx.fillText(config.title+'场景图暂未加载',canvas.clientWidth/2,canvas.clientHeight*.25);}
 function drawBoundary(b){const bounds=combatSceneBounds(b),tl=worldToScreen(bounds.left,bounds.top),br=worldToScreen(bounds.right,bounds.bottom),p=b.player;const close=Math.min(p.x-bounds.left,bounds.right-p.x,p.y-bounds.top,bounds.bottom-p.y)<.4;
  if(close){ctx.save();ctx.strokeStyle='#dfd5a950';ctx.lineWidth=1;ctx.setLineDash([3,9]);ctx.strokeRect(tl.x,tl.y,br.x-tl.x,br.y-tl.y);ctx.restore();}
  const config=combatBackdrop(b);for(const o of b.obstacles||[]){if(images.propAtlases?.[config.id]&&config.props?.[o.id])continue;const a=worldToScreen(o.x,o.y),z=worldToScreen(o.x+o.w,o.y+o.h);ctx.fillStyle='#425344';ctx.fillRect(a.x,a.y,z.x-a.x,z.y-a.y);ctx.strokeStyle='#a6a992';ctx.strokeRect(a.x,a.y,z.x-a.x,z.y-a.y);}
 }
 function drawAim(b){if(!b.interactive)return;const point=target(false),p=b.player,a=worldToScreen(p.x,p.y),z=worldToScreen(point.x,point.y),definition=(exp().combat?.manualActions||[]).find(x=>x.id===lastSkill),mode=definition?.targetMode||'direction';
  const dx=point.x-p.x,dy=point.y-p.y,d=Math.hypot(dx,dy)||1,range=definition?.range||6;
  ctx.save();ctx.globalAlpha=.65;ctx.strokeStyle='#d5e6bd';ctx.lineWidth=1;ctx.setLineDash([5,6]);
  if(mode==='direction'){const end=worldToScreen(p.x+dx/d*range,p.y+dy/d*range);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(end.x,end.y);ctx.stroke();}else if(mode==='point')ellipse(z,.3*transform.sx,.3*transform.sy,null,'#d5e6bd');
  ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(z.x-8,z.y);ctx.lineTo(z.x+8,z.y);ctx.moveTo(z.x,z.y-6);ctx.lineTo(z.x,z.y+6);ctx.stroke();ctx.restore();
 }
 function drawActor(actor,b,tick){
  const shown=actorRenderer.draw(actor,b,tick);
  effectRenderer.drawActorOverlay(actor,b,tick);
  return shown;
 }
 function drawAffiliation(actor,b){const p=worldToScreen(actor.x,actor.y),selected=actor.id===b.selectedTargetId,hostile=combatActorFaction(actor,b)==='hostile';if(actor.hp<=0)return;
  ctx.save();ellipse({x:p.x,y:p.y+2},selected?24:18,selected?8:6,null,selected?'#f5d58c':hostile?'#bc7967a8':'#a8ca96a8',selected?2:1);if(actor.id===b.player.id)ellipse({x:p.x,y:p.y+2},10,3,null,'#e7edc5',1);ctx.restore();
 }
 function drawActorLabel(actor,b,shown){const {height,foot:p,sample}=shown,selected=actor.id===b.selectedTargetId,hovered=actor.id===hoveredActorId,hostile=combatActorFaction(actor,b)==='hostile';
  if(actor.maxHp&&sample.phase!=='down'&&(actor.hp<actor.maxHp||selected||actor.id===b.player.id||hovered)){ctx.fillStyle='#11241b';ctx.fillRect(p.x-25,p.y-height-14,50,4);ctx.fillStyle=hostile?'#cb7e67':'#a7ca88';ctx.fillRect(p.x-25,p.y-height-14,50*clamp(actor.hp/actor.maxHp,0,1),4);}
  if((selected||hovered)&&actor.name){ctx.save();ctx.font='12px serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#10271f';ctx.strokeText(actor.name,p.x,p.y-height-20);ctx.fillStyle=selected?'#f2daa1':hostile?'#f0c4ac':'#d2e5bc';ctx.fillText(actor.name,p.x,p.y-height-20);ctx.restore();}
 }
 function draw(){
  if(!active()||!images){combatAudio.update(null,{active:false,paused:getView().paused});return;}const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,w,h);
  const authority=battle(),intent=running()?{x:Number(held.has('KeyD'))-Number(held.has('KeyA')),y:Number(held.has('KeyS'))-Number(held.has('KeyW'))}:{x:0,y:0};
  const b=authority?presentation.sample(authority,{paused:getView().paused,intent}):null;renderScene=b;transform=coordinates(b||authority);if(b&&usesCombatCamera(b))b.camera={center:{...transform.center},viewMetres:transform.viewMetres};updatePointerAim();drawBackdrop(b);
  combatAudio.update(b,{paused:getView().paused,active:hostActive&&document.hasFocus()&&document.visibilityState==='visible'&&!!b});
  if(b){const tick=b.visualTick;drawBoundary(b);effectRenderer.drawGround(b,tick);drawAim(b);
   const ordered=combatDepthOrder(b),shown=new Map(),config=combatBackdrop(b),propImage=images.propAtlases?.[config.id],props=propImage?[...combatBackdropProps(config,b),...combatBackdropDecorations(config,transform)]:[];
   for(const actor of ordered)drawAffiliation(actor,b);
   if(props.length){const queue=[...ordered.map(actor=>({kind:'actor',id:actor.id,x:actor.x,y:actor.y,actor})),...props].sort((a,z)=>a.y-z.y||a.x-z.x||String(a.id).localeCompare(String(z.id)));for(const item of queue)if(item.kind==='prop')drawCombatBackdropProp(ctx,propImage,item,transform);else shown.set(item.id,drawActor(item.actor,b,tick));}
   else for(const actor of ordered)shown.set(actor.id,drawActor(actor,b,tick));
   effectRenderer.drawProjectiles(b,tick);effectRenderer.drawForeground(b,tick);
   for(const actor of ordered)drawActorLabel(actor,b,shown.get(actor.id));
   const landmark=combatExitLandmark(b);if(landmark){const exit=worldToScreen(landmark.x,landmark.y);ctx.fillStyle='#e9d9ac';ctx.font='14px serif';ctx.textAlign='left';ctx.fillText(combatBackdrop(b).exitLabel,exit.x-20,exit.y+35);}
  }else{ctx.fillStyle='#10261d35';ctx.fillRect(0,0,w,h);const travel=exp().world?.travel;if(travel){ctx.font='26px serif';ctx.textAlign='center';ctx.fillStyle='#f1dfad';ctx.fillText('山路行进中',w/2,h*.45);}}
 }
 return {active,render,draw,key,clearInput,setHostActivity:active=>{hostActive=!!active;if(!hostActive){hoveredActorId=null;clearInput();}},canvas,worldToScreen,screenToWorld,inputState:()=>({held:[...held],aim:aim?{...aim}:null,pointer:pointer?{...pointer}:null,lastMove:{...lastMove},hostActive,active:running()}),presentationState:()=>{const config=combatBackdrop(battle());return {scene:renderScene?structuredClone(renderScene):null,camera:transform?structuredClone(transform):null,cache:actorRenderer?.cacheStats()||null,background:{...config,loaded:!!images?.backgrounds?.[config.id],propsLoaded:!!images?.propAtlases?.[config.id],error:images?.backgroundIssues?.[config.id]||null,propsError:images?.backgroundIssues?.[config.id+':props']||null}};},
  async load(){combatAudio.prepare();const configs=Object.values(COMBAT_BACKDROPS),jobs=configs.flatMap(config=>[{id:config.id,name:config.image,kind:'ground'},...(config.propsImage?[{id:config.id,name:config.propsImage,kind:'props'}]:[])]),[results,assets]=await Promise.all([Promise.allSettled(jobs.map(job=>loadImage(job.name))),loadCombatActorAssets({loadImage,loadJson})]);const backgrounds={},propAtlases={},backgroundIssues={};for(let i=0;i<results.length;i++){const result=results[i],job=jobs[i];if(result.status==='fulfilled')(job.kind==='props'?propAtlases:backgrounds)[job.id]=result.value;else backgroundIssues[job.id+(job.kind==='props'?':props':'')]=result.reason?.message||String(result.reason);}images={backgrounds,propAtlases,backgroundIssues};actorRenderer=createCombatActorRenderer({ctx,worldToScreen,getTransform:()=>transform||coordinates(),assets});await actorRenderer.prewarm();effectRenderer=createCombatEffectsRenderer({ctx,worldToScreen,getTransform:()=>transform||coordinates(),getActorPresentation:actorRenderer.presentation});if(assets.issues.length)announce('部分战斗动作素材读取失败，已保留人物显示。'+assets.issues.map(i=>i.error).join('；'));},
  dispose(){clearInterval(inputTimer);clearInput();combatAudio.dispose();presentation.reset();squadControls.remove();returnNote.remove();if(departure.open)departure.close();setDepartureReading(false);if(artCredits.open)artCredits.close();setCreditsReading(false);departure.remove();artCredits.remove();artCreditsButton.remove();partyStatus.remove();}
 };
}
