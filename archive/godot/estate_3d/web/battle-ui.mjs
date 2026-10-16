/** 林间斗法操作层；伤势、冷却、出招与战果均读取正式战斗。 */
export function createBattleUI({getState,send,open,escape,icon,portrait,bar}) {
  const e=value=>escape(value??'');
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const amount=value=>String(Number(n(value).toFixed(1)));
  const labels={attack:'攻击',spell:'术法',guard:'护持',dodge:'闪避',retreat:'撤退'};
  const symbols={attack:'sword',spell:'scroll',guard:'jade',dodge:'boot',retreat:'flag'};
  const directions={north:{x:0,y:-1,label:'向上闪避',glyph:'↑'},west:{x:-1,y:0,label:'向左闪避',glyph:'←'},east:{x:1,y:0,label:'向右闪避',glyph:'→'},south:{x:0,y:1,label:'向下闪避',glyph:'↓'}};
  let dodgeOpen=false,session=null;

  function parts() {
    const state=getState(),combat=state.combat;
    if(combat?.sessionId!==session){session=combat?.sessionId||null;dodgeOpen=false;}
    return {state,combat,controls:combat?.controls,master:(state.systemPeople?.persons||state.roster||[]).find(person=>person.id===(combat?.player?.personId||state.masterId)),enemy:combat?.enemies?.find(enemy=>n(enemy.hp)>0)||combat?.enemies?.[0]};
  }

  function actionButton(action,state) {
    const cooldown=Math.max(0,(n(action.cooldownUntil)-n(state.tick))/10);
    const hint=cooldown?`${amount(cooldown)} 秒`:(action.disabled?action.reason:n(action.qi)?`灵力 ${amount(action.qi)}`:'可施展');
    return `<button class="battle-command command-${e(action.id)}${action.id==='dodge'&&dodgeOpen?' selected':''}" data-battle-action="${e(action.id)}" ${action.disabled?'disabled':''} title="${e(action.reason||action.name)}" ${action.id==='dodge'?`aria-expanded="${dodgeOpen}"`:''}><span class="battle-command-symbol">${icon(symbols[action.id])}</span><strong>${e(labels[action.id])}</strong><span class="battle-command-name">${e(action.name)}</span><small>${e(hint||'暂不可用')}</small></button>`;
  }

  function dodgeDirection(direction,combat,range=2.8) {
    const vector=directions[direction],player=combat.player;
    if(!vector||!player)return null;
    return {x:Math.max(.6,Math.min(n(combat.width)-.6,n(player.x)+vector.x*range)),y:Math.max(.6,Math.min(n(combat.height)-.6,n(player.y)+vector.y*range))};
  }

  function dodgeChoices(combat,controls) {
    if(!dodgeOpen)return '';
    const action=controls.actions?.find(action=>action.id==='dodge');
    return `<div class="battle-dodge-chooser"><span class="battle-dodge-title">选择闪避方向</span><div class="battle-dodge-compass">${Object.entries(directions).map(([id,direction])=>{const target=dodgeDirection(id,combat,n(action?.range)||2.8),blocked=action?.disabled||!target||Math.hypot(target.x-n(combat.player.x),target.y-n(combat.player.y))<.1;return `<button class="battle-dodge-direction direction-${id}" data-battle-action="dodge-${id}" aria-label="${direction.label}" title="${direction.label}" ${blocked?'disabled':''}>${direction.glyph}</button>`;}).join('')}<span aria-hidden="true">步</span></div><small>择向挪步</small></div>`;
  }

  function pendingLine(combat,controls) {
    const pending=controls?.pending;
    if(!pending)return `<div class="battle-action-state"><span>${n(combat.player.guard)>0?'护持正在生效':n(combat.player.evade)>0?'正在闪避':combat.player.target?'正在移步':'可点地移步'}</span><small>注视落点，择机出招</small></div>`;
    const action=controls.actions?.find(action=>action.id===pending.action);
    const total=n(action?.windup)+n(action?.execute)+n(action?.recovery);
    const phase={windup:'起手',execute:'施展',recovery:'收势'}[pending.phase]||'出招';
    return `<div class="battle-action-state is-pending"><span>${e(action?.name||labels[pending.action]||'出招')} · ${phase}</span><div class="battle-cast-track"><i style="width:${Math.max(0,Math.min(100,n(pending.progressTicks)/Math.max(1,total)*100))}%"></i></div></div>`;
  }

  function resultView(combat,master) {
    const result=combat.result||{},titles={won:'林间得胜',lost:'伤重止战',retreated:'已经撤出'};
    return `<div class="battle-result-shade"><section class="battle-result" aria-label="斗法结果"><span class="battle-result-seal">${icon(combat.status==='won'?'sword':'mountain')}</span><small>林间战报</small><h2>${e(result.title||titles[combat.status]||'斗法已止')}</h2><p>${e(result.text||'战斗已经结束。')}</p><div class="battle-result-state"><span>${e(master?.name||'掌门')} · 当前伤势</span><strong>${amount(master?.wound??result.injury)} / 100</strong></div><button class="battle-result-confirm game-button primary" data-battle-action="acknowledge">回到山谷</button></section></div>`;
  }

  function render() {
    const {state,combat,controls,master,enemy}=parts();
    if(!combat)return '';
    if(combat.status!=='active')return resultView(combat,master);
    const telegraph=enemy?.telegraph;
    const actions=['attack','spell','guard','dodge','retreat'].map(id=>controls?.actions?.find(action=>action.id===id)).filter(Boolean);
    return `<section class="battle-ui" aria-label="林间斗法"><button class="battle-archive game-button" data-battle-action="archive">存档</button><div class="battle-foe-panel"><div class="battle-foe-title"><span>${e(enemy?.name||combat.name)}</span><small>${state.paused?'时辰暂歇':'林间交锋'}</small></div>${enemy?bar('气血',enemy.hp,enemy.maxHp,'red'):''}${telegraph?`<div class="battle-danger-call"><b>${e(telegraph.kind||'敌方起手')}</b><span>${amount(telegraph.remaining)} 秒后落下</span><i style="width:${Math.max(0,Math.min(100,n(telegraph.remaining)/Math.max(.1,n(telegraph.total))*100))}%"></i></div>`:'<div class="battle-foe-movement">留意敌手起势与落点</div>'}</div><div class="battle-bottom"><div class="battle-self"><div class="battle-self-portrait">${portrait(master||{name:'掌门',appearance:combat.player?.appearance})}</div><div class="battle-self-details"><strong>${e(master?.name||'掌门')}</strong>${bar('气血',combat.player.hp,combat.player.maxHp,'red')}${bar('灵力',combat.player.qi,combat.player.maxQi)}<small>伤势 ${amount(master?.wound)}${n(combat.player.guard)>0?` · 护持 ${amount(combat.player.guard)} 秒`:''}</small></div></div><div class="battle-controls">${pendingLine(combat,controls)}<div class="battle-command-rail">${actions.map(action=>actionButton(action,state)).join('')}</div>${dodgeChoices(combat,controls||{})}</div></div></section>`;
  }

  function click(element) {
    const action=element?.dataset?.battleAction;
    if(!action)return false;
    if(element.disabled)return true;
    const {combat,controls,enemy}=parts();
    if(!combat)return true;
    if(action==='archive'){open('archive');return true;}
    if(action==='acknowledge'){if(combat.status!=='active')send({name:'acknowledgeCombat',args:[]});return true;}
    if(combat.status!=='active')return true;
    const id=action.startsWith('dodge-')?'dodge':action;
    const definition=controls?.actions?.find(item=>item.id===id);
    if(!definition||definition.disabled)return true;
    if(action==='dodge'){dodgeOpen=!dodgeOpen;return true;}
    let target;
    if(action.startsWith('dodge-')) {
      target=dodgeDirection(action.slice(6),combat,n(definition.range)||2.8);
      if(!target||Math.hypot(target.x-n(combat.player.x),target.y-n(combat.player.y))<.1)return true;
    } else if(['attack','spell'].includes(action)) {
      if(!enemy||n(enemy.hp)<=0)return true;
      target=enemy.id;
    }
    const result=send({name:'combatAction',args:target===undefined?[id]:[id,target]});
    if(result?.ok&&id==='dodge')dodgeOpen=false;
    return true;
  }
  return {render,click,input:()=>false,enter:()=>{}};
}
