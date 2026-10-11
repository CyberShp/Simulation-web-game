/** 丹房卷册：只呈现正式丹方、实物货位与炼丹工单。 */
export function createCraftingPanel({getState,send,open,escape,icon,portrait,bar}) {
  const names={jade:'灵石',wood:'木料',stone:'石料',herb:'灵草',food:'食粮',crystal:'灵晶',insight:'道韵'};
  const transportPhases={'to-source':'前往取料',delivered:'已经送达',cancelled:'已停运'};
  const orderPhases={active:'本炉在办',completed:'已经成丹',cancelled:'已停炉',interrupted:'炉事中断'};
  const activityPhases={moving:'前往炉台',working:'照看火候',paused:'暂歇',blocked:'通路受阻'};
  const e=value=>escape(value??'');
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const amount=value=>String(Number(n(value).toFixed(2)));
  const stockAmount=(stock,key)=>key.startsWith('pill:')?n(stock?.pills?.[key.slice(5)]):n(stock?.resources?.[key]);
  const activeFurnaceTransports=(state,workstation)=>(state.inventory?.transports||[]).filter(order=>
    workstation?.stockpileId&&
    (order.sourceStockpileId===workstation.stockpileId||order.targetStockpileId===workstation.stockpileId)&&
    !['delivered','cancelled'].includes(order.phase));
  const button=(action,label,{disabled=false,primary=false,extra=''}={})=>`<button class="game-button${primary?' primary':''}" data-system-action="${action}" ${extra} ${disabled?'disabled':''}>${e(label)}</button>`;
  let selected='heal';
  const selectedSources={};

  function stateParts() {
    const state=getState();
    const crafting=state.crafting||{};
    const recipes=Array.isArray(crafting.recipes)?crafting.recipes:[];
    if(!recipes.some(recipe=>recipe.id===selected))selected=recipes.find(recipe=>recipe.id==='heal')?.id||recipes[0]?.id||null;
    const workstation=crafting.workstation||null;
    const stockpiles=state.inventory?.stockpiles||[];
    const publicStock=stockpiles.find(stock=>stock.id==='stockpile:yunxiu');
    const furnaceStock=stockpiles.find(stock=>stock.id===workstation?.stockpileId);
    const orders=Array.isArray(crafting.orders)?crafting.orders:[];
    return {state,recipes,recipe:recipes.find(item=>item.id===selected),workstation,publicStock,furnaceStock,orders};
  }

  function effectText(effect) {
    if(typeof effect==='string')return effect;
    if(!effect||typeof effect!=='object')return '';
    const parts=[];
    if(n(effect.wound)>0)parts.push(`疗伤 ${amount(effect.wound)}`);
    if(n(effect.energy)>0)parts.push(`回气 ${amount(effect.energy)}`);
    if(n(effect.xp)>0)parts.push(`修为 ${amount(effect.xp)}`);
    return parts.join(' · ');
  }

  function reasonText(reason,workstation) {
    const known={
      '需可运行且未迁建的丹炉。':workstation?'丹房待修整':'先营造丹房',
      '掌门须真实归院操作丹炉。':'掌门须先回山院',
      '先完成或取消当前身体活动。':'掌门尚有事务在身',
      '旧丹炉工序尚待现场接续。':'先料理未完炉事',
      '先恢复身体与精力。':'先疗伤歇息',
      '掌门尚未达到此丹方操作境界。':'掌门修为未至',
      '先取得可靠筑基丹方。':'尚无筑基丹方',
      '丹炉操作工位已被预约。':'炉台正有人用',
    };
    if(known[reason])return known[reason];
    const material=reason.match(/^(.+?)需(.+?)：(院中公共预算不足|先实际搬入丹炉工位缓存)。$/);
    if(material)return material[3]==='院中公共预算不足'?`公库${material[1]}不足`:`炉边需${material[1]} ${material[2]}`;
    const knowledge=reason.match(/^掌门需理解《(.+?)》(.+?)。$/);
    if(knowledge)return `需领悟《${knowledge[1]}》至 ${knowledge[2]}`;
    return reason;
  }

  function sourceStocks(state,key,workstation) {
    const stocks=state.inventory?.stockpiles||[];
    const targetScene=stocks.find(stock=>stock.id===workstation?.stockpileId)?.position?.sceneId;
    return stocks.filter(stock=>
      stock.id!==workstation?.stockpileId&&
      (stock.access==='public'||stock.ownerId===state.masterId)&&
      (!targetScene||stock.position?.sceneId===targetScene)&&
      stockAmount(stock,key)>0);
  }

  function sourceName(stock) {
    if(stock.id==='stockpile:yunxiu')return '山院公库';
    if(stock.id==='stockpile:carried:master')return '掌门随身';
    return stock.label||'院中库位';
  }

  function materialRows(state,recipe,publicStock,furnaceStock,workstation,transports) {
    return Object.entries(recipe.cost||{}).map(([key,need])=>{
      const publicUse=['jade','insight'].includes(key);
      const stock=publicUse?publicStock:furnaceStock;
      const here=stockAmount(stock,key);
      const missing=Math.max(0,n(need)-here);
      const sources=publicUse?[]:sourceStocks(state,key,workstation);
      const chosen=sources.find(item=>item.id===selectedSources[key])||sources[0];
      const source=stockAmount(chosen,key);
      const inbound=publicUse?0:transports.filter(order=>order.targetStockpileId===workstation?.stockpileId).reduce((total,order)=>total+n(order.cargo?.[key]),0);
      const moveAmount=Math.min(40,Math.max(0,missing-inbound),source);
      const canDeliver=!publicUse&&!!workstation?.stockpileId&&moveAmount>0&&!transports.length;
      const moveButton=!publicUse&&missing>0?button('craft-deliver',inbound?`运送中 ${amount(inbound)} 份`:`送入 ${amount(moveAmount)} 份`,{disabled:!canDeliver,extra:`data-resource="${e(key)}"`}):'';
      const sourceChoice=!publicUse&&missing>0&&sources.length?`<label class="alchemy-source-label">取自 <select data-system-field="craft-source" data-resource="${e(key)}" aria-label="${e(names[key]||key)}来源">${sources.map(item=>`<option value="${e(item.id)}" ${item.id===chosen?.id?'selected':''}>${e(sourceName(item))} ${e(amount(stockAmount(item,key)))}</option>`).join('')}</select></label>`:'';
      return `<div class="alchemy-material${missing?' shortage':''}"><span class="icon-slot">${icon(key==='insight'?'jade':key)}</span><div><strong>${e(names[key]||key)}</strong><small>${publicUse?'公库':'炉边'} ${e(amount(here))} / ${e(amount(need))}${inbound?` · 在途 ${e(amount(inbound))}`:''}</small>${sourceChoice}</div>${moveButton}</div>`;
    }).join('')||'<p class="subtle">此方无须添料。</p>';
  }

  function activeTransportRows(state,workstation,recipes) {
    if(!workstation?.stockpileId)return '';
    const relevant=activeFurnaceTransports(state,workstation);
    return relevant.length?`<div class="alchemy-transports"><h4>炉边往来</h4>${relevant.map(order=>{
      const cargo=Object.entries(order.cargo||{}).map(([key,value])=>{
        const name=key.startsWith('pill:')?recipes.find(recipe=>recipe.id===key.slice(5))?.name||key.slice(5):names[key]||key;
        return `${e(name)} ${e(amount(value))}`;
      }).join(' · ');
      const phase=order.phase==='carrying'?(order.targetStockpileId===workstation.stockpileId?'送往丹房':order.targetStockpileId==='stockpile:yunxiu'?'运回公库':'送往随身'):transportPhases[order.phase]||order.phase;
      return `<div class="alchemy-transport"><span>${e(cargo)}</span><small>${e(phase)}</small></div>`;
    }).join('')}</div>`:'';
  }

  function orderRows(orders,recipes,workstation) {
    const rows=[...orders].sort((a,b)=>n(b.startedTick)-n(a.startedTick));
    return rows.map(order=>{
      const name=order.recipeName||recipes.find(recipe=>recipe.id===order.recipeId)?.name||'丹药';
      const active=order.phase==='active';
      const phase=active?(activityPhases[order.activityPhase]||orderPhases.active):(orderPhases[order.phase]||order.phase);
      const destination=order.phase==='completed'?`<small>成丹 ${e(amount(order.yield))} · ${e(workstation?.stockpileId===order.stockpileId?workstation.name||'丹房':'丹房货位')}</small>`:'';
      const showReason=order.reason&&(order.phase==='interrupted'||active&&['paused','blocked'].includes(order.activityPhase));
      return `<article class="alchemy-order${active?' current':''}"><div class="alchemy-order-head"><span class="icon-slot">${icon('pill')}</span><div><strong>${e(name)}</strong><small>${e(phase)}</small></div></div>${active?bar('火候',n(order.progressTicks),Math.max(1,n(order.durationTicks))):''}${destination}${showReason?`<p class="danger">${e(order.reason)}</p>`:''}<div class="alchemy-order-actions">${button('craft-select', '看丹方',{extra:`data-recipe="${e(order.recipeId)}"`})}${active?button('craft-stop','停炉'):''}</div></article>`;
    }).join('')||'<p class="empty-state">炉台清静，尚无丹事。</p>';
  }

  function render() {
    const {state,recipes,recipe,workstation,publicStock,furnaceStock,orders}=stateParts();
    const active=orders.find(order=>order.phase==='active');
    const transports=activeFurnaceTransports(state,workstation);
    const pillCount=recipe?stockAmount(furnaceStock,`pill:${recipe.id}`):0;
    const pillAccess=(state.inventory?.pillAccess||[]).find(item=>item.recipeId===recipe?.id);
    const reachablePills=(state.inventory?.stockpiles||[]).filter(stock=>stock.access==='public'||stock.ownerId===state.masterId).reduce((total,stock)=>total+stockAmount(stock,`pill:${recipe?.id||''}`),0);
    const reasons=recipe?.reasons||[];
    const master=state.systemPeople?.persons?.find(person=>person.id===state.masterId);
    const effect=effectText(recipe?.effect);
    const canBenefit=!!recipe&&!!master&&(
      n(recipe.effect?.wound)>0&&n(master.wound)>0||
      n(recipe.effect?.energy)>0&&n(master.energy)<100||
      n(recipe.effect?.xp)>0&&n(master.xp)<n(master.xpNeed));
    const canUsePill=n(pillAccess?.available)>0;
    const canFetchPill=reachablePills>0;
    return `<div class="system-crafting alchemy-layout">
      <aside class="pane alchemy-catalog"><div class="pane-title"><h3>丹方</h3><span class="subtle">${e(recipes.length)} 卷</span></div><div class="alchemy-catalog-mark">${icon('cauldron')}<span>云岫丹录</span></div>
        <div class="alchemy-recipe-list scroll-area" data-scroll-key="craft-recipes">${recipes.map(item=>`<button class="alchemy-recipe-choice${item.id===selected?' active':''}" data-system-action="craft-select" data-recipe="${e(item.id)}" aria-pressed="${item.id===selected}"><span class="icon-slot">${icon('pill')}</span><span><strong>${e(item.name)}</strong><small>一炉 · 成丹 ${e(amount(item.yield))} 份</small></span><i>${item.available?'可炼':'待备'}</i></button>`).join('')||'<p class="empty-state">丹录尚未展开。</p>'}</div>
        ${button('craft-bag','查看行囊')}
      </aside>
      <section class="pane alchemy-recipe"><div class="alchemy-heading"><span class="icon-slot">${icon('pill')}</span><div><small>丹房 · 掌门亲炼</small><h2>${e(recipe?.name||'炉台待启')}</h2>${effect?`<p>${e(effect)}${recipe?.id==='heal'&&n(master?.wound)===0?' · 伤势已愈':''}</p>`:''}</div></div>
        ${recipe?.description?`<p class="alchemy-lore">${e(recipe.description)}</p>`:''}
        <div class="alchemy-flow"><div class="alchemy-ingredients"><h3>本炉用料</h3>${recipe?materialRows(state,recipe,publicStock,furnaceStock,workstation,transports):''}</div>
          <div class="alchemy-vessel"><img src="alchemy-cauldron.png" alt="丹炉" draggable="false"><span>${e(workstation?.name||'丹炉营造地')}</span></div>
          <div class="alchemy-output"><span class="icon-slot">${icon('pill')}</span><strong>${e(recipe?.name||'丹药')}</strong><small>一炉成丹 ${e(amount(recipe?.yield||0))} 份</small><b>炉边现存 ${e(amount(pillCount))}</b></div></div>
        <div class="alchemy-workplace"><span>执炉</span><strong>${e(master?.name||'掌门')}</strong><span>工位</span><strong>${e(workstation?.name||'丹房待营')}</strong>${workstation?button('craft-view-workstation','看炉台'):button('craft-build-site','前往营造地')}</div>
        <div class="alchemy-submit"><div>${reasons.length?`<p class="alchemy-reasons">${reasons.map(reason=>`<span>${e(reasonText(reason,workstation))}</span>`).join('')}</p>`:`<p class="good">${active?'炉火已起':'用料齐备，可开此炉。'}</p>`}</div>${button('craft-start',`开炉 · ${e(amount(recipe?.yield||0))} 份`,{primary:true,disabled:!recipe?.available||!!active})}</div>
      </section>
      <aside class="pane alchemy-side"><div class="pane-title"><h3>炉事</h3><span class="subtle">${e(orders.length)} 录</span></div><div class="alchemy-orders scroll-area" data-scroll-key="craft-orders">${orderRows(orders,recipes,workstation)}</div>
        <div class="alchemy-medicine"><h4>成丹去处</h4><p>${e(workstation?.name||'丹房')} · ${e(recipe?.name||'丹药')} ${e(amount(pillCount))} 份</p><div class="alchemy-medicine-actions">${button('craft-collect',`送回公库 ${e(amount(Math.min(40,pillCount)))} 份`,{disabled:pillCount<1||!workstation?.stockpileId||!!transports.length})}${recipe?.id!=='foundation'?button('craft-pill',canUsePill?'服用一份':transports.length?'炉边运送中':canFetchPill?'取药一份':'尚无成丹',{disabled:!recipe||!canUsePill&&(!canFetchPill||!!transports.length)||canUsePill&&!canBenefit}):''}</div>${canUsePill&&!canBenefit?'<small class="subtle">此时服丹无益。</small>':''}</div>
        ${activeTransportRows(state,workstation,recipes)}
      </aside>
    </div>`;
  }

  function click(element) {
    const {systemAction:action,recipe:recipeId,resource}=element.dataset;
    if(!action?.startsWith('craft-'))return false;
    const {state,recipe,workstation,furnaceStock,recipes}=stateParts();
    const transporting=activeFurnaceTransports(state,workstation).length>0;
    if(action==='craft-select') {if(recipes.some(item=>item.id===recipeId))selected=recipeId;}
    else if(action==='craft-bag')open('bag');
    else if(action==='craft-build-site'){open('scene');window.estateGameOpenSite?.('site:alchemy-court');}
    else if(action==='craft-view-workstation'){
      open('scene');
      const building=state.buildings?.find(item=>item.instanceId===workstation?.buildingId);
      if(building)window.estateGameSelect?.('building',building.id);
      else window.estateGameOpenSite?.('site:alchemy-court');
    }
    else if(action==='craft-start'&&recipe)send({name:'craftSR',args:[recipe.id]});
    else if(action==='craft-stop')send({name:'cancelCraftSR',args:[]});
    else if(action==='craft-deliver'&&recipe&&workstation?.stockpileId&&Object.hasOwn(recipe.cost||{},resource)&&!['jade','insight'].includes(resource)){
      const missing=Math.max(0,n(recipe.cost[resource])-stockAmount(furnaceStock,resource));
      const sources=sourceStocks(state,resource,workstation);
      const source=sources.find(item=>item.id===selectedSources[resource])||sources[0];
      const quantity=Math.min(40,missing,stockAmount(source,resource));
      if(source&&quantity>0&&!transporting)send({name:'startTransport',args:[source.id,workstation.stockpileId,'person:master',{[resource]:quantity}]});
    } else if(action==='craft-collect'&&recipe&&workstation?.stockpileId){
      const count=Math.min(40,stockAmount(furnaceStock,`pill:${recipe.id}`));
      if(count>0&&!transporting)send({name:'startTransport',args:[workstation.stockpileId,'stockpile:yunxiu','person:master',{[`pill:${recipe.id}`]:count}]});
    } else if(action==='craft-pill'&&recipe&&recipe.id!=='foundation'){
      const access=getState().inventory?.pillAccess?.find(item=>item.recipeId===recipe.id);
      send({name:n(access?.available)>0?'masterPill':'preparePillUse',args:[recipe.id]});
    }
    return true;
  }

  function input(element) {
    if(element.dataset.systemField!=='craft-source'||!element.dataset.resource)return false;
    selectedSources[element.dataset.resource]=element.value;
    return true;
  }
  function enter(params={}) {if(params.recipe||params.recipeId)selected=params.recipe||params.recipeId;}
  return {render,click,input,enter};
}
