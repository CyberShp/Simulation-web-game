/** U-120 inventory page. Every quantity and order comes from the current simulation snapshot. */
export function createInventoryPanel({getState,send,open,escape,icon,portrait,bar}) {
  const slotNames={weapon:'武器',armor:'衣甲',artifact:'法器',accessory:'佩饰'};
  const slotIcons={weapon:'sword',armor:'robe',artifact:'jade',accessory:'ring'};
  const resourceNames={jade:'灵石',wood:'木料',stone:'石料',herb:'灵草',food:'食粮',crystal:'灵晶',insight:'道韵'};
  const phases={'to-source':'前往取料',carrying:'运送途中',delivered:'已经送达',cancelled:'已取消',reserved:'已预约',navigating:'前往办理',preparing:'准备中',executing:'正在办理',waiting:'等待条件',interrupted:'已中断',proposed:'待安排',moving:'正在前往',working:'正在办理',paused:'暂缓',blocked:'受阻',completed:'已完成'};
  const categories=['全部','装备','丹药','材料'];
  let category='全部',query='',selected=null,quantity=1,sorted=false;
  const e=value=>escape(value??'');
  const number=value=>Number.isFinite(Number(value))?Number(value):0;
  const amount=value=>String(Number(number(value).toFixed(2)));
  const stockAmount=(stock,key)=>key.startsWith('pill:')?number(stock?.pills?.[key.slice(5)]):number(stock?.resources?.[key]);
  const button=(action,label,{disabled=false,primary=false,extra=''}={})=>
    `<button class="game-button${primary?' primary':''}" data-system-action="${action}" ${extra} ${disabled?'disabled':''}>${e(label)}</button>`;
  const stockName=stock=>stock?.id==='stockpile:yunxiu'?'山院公库':stock?.id==='stockpile:carried:master'?'掌门随身':stock?.label||stock?.id||'未知库位';
  const locationName=(item,state)=>{
    const loc=item.location||{};
    if(loc.kind==='person') {
      const name=state.systemPeople?.persons?.find(person=>person.id===loc.id)?.name||state.people?.find(person=>person.id===loc.id)?.name||loc.id;
      return `${name}${loc.slot?' · '+(slotNames[loc.slot]||loc.slot):' · 随身保管'}`;
    }
    if(loc.kind==='stockpile') return stockName(state.inventory?.stockpiles?.find(stock=>stock.id===loc.id));
    if(loc.kind==='travel') return '山外随行';
    return loc.kind||'位置待查';
  };
  const ownerName=(item,state)=>item.ownerId==='person:master'?'掌门私有':
    item.ownerId==='sect:yunxiu'||item.ownerId==='sect:master'?'山院共有':
    state.systemPeople?.persons?.find(person=>person.id===item.ownerId)?.name||item.ownerId||'所有者待查';
  const effectText=effects=>[
    Number.isFinite(effects?.guard)?`护体减伤 ${Math.round(effects.guard*100)}%`:null,
    Number.isFinite(effects?.heal)?`养伤效果 ×${amount(effects.heal)}`:null,
    Number.isFinite(effects?.reach)?`兵刃触及 ${amount(effects.reach)} 米`:null,
    effects?.node?'可布护持节点':null,
    effects?.themeRole?'护脉器组部件':null,
  ].filter(Boolean).join(' · ');
  const visibleStock=(state,id)=>state.inventory?.stockpiles?.find(stock=>stock.id===id);
  const routineReasons=new Set(['材料已预留；须实际行动。','先到仓储实际取料。','已实际取料，携带前往交付地点。','前往主屋公库交还处。']);
  const orderReason=(reason,operation)=>routineReasons.has(reason)||operation&&/^前往.+。$/.test(reason)?'':reason;

  function itemsFor(state) {
    const inventory=state.inventory||{},stocks=(inventory.stockpiles||[]).filter(stock=>stock.ownerId==='person:master'&&['public','private'].includes(stock.access));
    const ownedSummary=(inventory.summary||[]).filter(group=>['public','personal'].includes(group.id));
    const carried=visibleStock(state,'stockpile:carried:master');
    const publicStock=visibleStock(state,'stockpile:yunxiu');
    const items=[];
    for(const item of inventory.equipment||[]) items.push({key:`equipment:${item.id}`,category:'装备',name:item.name,
      kind:slotIcons[item.slot]||'jade',item,total:1,carried:item.location?.kind==='person'&&item.location.id==='person:master'?1:0,
      public:item.location?.kind==='stockpile'&&item.location.id==='stockpile:yunxiu'?1:0});
    const keys=new Set();
    for(const stock of stocks) {
      for(const [key,value] of Object.entries(stock.resources||{})) if(number(value)>0) keys.add(key);
      for(const [key,value] of Object.entries(stock.pills||{})) if(number(value)>0) keys.add(`pill:${key}`);
    }
    for(const pill of inventory.pillAccess||[]) if(number(pill.available)>0) keys.add(`pill:${pill.recipeId}`);
    for(const group of ownedSummary) for(const [key,amounts] of Object.entries(group.amounts||{}))
      if(number(amounts.total)>0) keys.add(key);
    for(const key of keys) {
      const pill=key.startsWith('pill:');
      const pillInfo=pill?(inventory.pillAccess||[]).find(entry=>entry.recipeId===key.slice(5)):null;
      const stocked=stocks.reduce((sum,stock)=>sum+stockAmount(stock,key),0);
      const total=ownedSummary.length?ownedSummary.reduce((sum,group)=>sum+number(group.amounts?.[key]?.total),0):stocked;
      const other=stocks.filter(stock=>!['stockpile:carried:master','stockpile:yunxiu'].includes(stock.id))
        .reduce((sum,stock)=>sum+stockAmount(stock,key),0);
      items.push({key:`cargo:${key}`,cargoKey:key,category:pill?'丹药':'材料',name:pill?pillInfo?.name||key.slice(5):resourceNames[key]||key,
        kind:pill?'pill':({herb:'herb',wood:'wood',stone:'stone',food:'food',jade:'jade',crystal:'jade',insight:'scroll'})[key]||'scroll',
        total,carried:stockAmount(carried,key),public:stockAmount(publicStock,key),other,pillInfo});
    }
    return items;
  }

  function filteredItems(items) {
    let list=items.filter(item=>(category==='全部'||item.category===category)&&
      (!query||item.name.includes(query)||item.key.toLowerCase().includes(query.toLowerCase())));
    if(sorted) list=[...list].sort((a,b)=>a.category.localeCompare(b.category,'zh')||a.name.localeCompare(b.name,'zh'));
    return list;
  }

  function equipmentBody(state,master,items) {
    const slots=state.inventory?.slots||Object.keys(slotNames);
    const equipped=master?.equipmentSlots||{};
    return `<div class="profile-equipment-body compact"><div class="profile-body-portrait">${portrait(master,true)}</div>${slots.map(slot=>{
      const item=items.find(entry=>entry.item?.id===equipped[slot]);
      const label=slotNames[slot]||slot;
      return `<button class="profile-equip-slot profile-slot-${e(slot)}" data-system-action="inventory-select-slot" data-slot="${e(slot)}" aria-label="${e(label)}：${e(item?.name||'空位')}"><span class="subtle">${e(label)}</span><span class="icon-slot">${icon(item?.kind||slotIcons[slot]||'jade')}</span><strong>${e(item?.name||'空位')}</strong></button>`;
    }).join('')}</div>`;
  }

  function orderList(state,item) {
    const inventory=state.inventory||{};
    const orders=(inventory.equipmentOrders||[]).filter(order=>!item||order.itemId===item.item?.id);
    const transports=item?.cargoKey?(inventory.transports||[]).filter(work=>number(work.cargo?.[item.cargoKey])>0):[];
    const activeTransports=transports.filter(work=>!['delivered','cancelled'].includes(work.phase));
    const relevant=orders.filter(order=>!['completed','cancelled'].includes(order.phase));
    if(!relevant.length&&!activeTransports.length) return '';
    return `<section class="bag-orders"><h4>正在办理</h4>${relevant.map(order=>`<p><strong>${e(({equip:'换装',store:'入库保管'})[order.operation]||order.operation)}</strong> · ${e(phases[order.phase]||order.phase)}${order.durationTicks?` · ${e(Math.floor(100*number(order.progressTicks)/Math.max(1,number(order.durationTicks))))}%`:''}${orderReason(order.reason,order.operation)?`<small>${e(order.reason)}</small>`:''}</p>`).join('')}${activeTransports.map(work=>`<p><strong>搬运 ${e(amount(work.cargo?.[item?.cargoKey]||Object.values(work.cargo||{})[0]))} 份</strong> · ${e(phases[work.phase]||work.phase)}<small>${e(stockName(visibleStock(state,work.sourceStockpileId)))} → ${e(stockName(visibleStock(state,work.targetStockpileId)))}</small>${orderReason(work.reason)?`<small>${e(work.reason)}</small>`:''}</p>`).join('')}</section>`;
  }

  function detail(state,item,master) {
    if(!item) return '<div class="empty-state">选择一件物品，查看它的归属、位置与用途。</div>';
    const inventory=state.inventory||{};
    const iconHead=`<div class="bag-item-heading"><span class="icon-slot bag-featured-icon">${icon(item.kind)}</span><span><h3>${e(item.name)}</h3><span class="gold">${e(item.category)}</span></span></div>`;
    if(item.item) {
      const gear=item.item,active=(inventory.equipmentOrders||[]).some(order=>order.itemId===gear.id&&!['completed','cancelled'].includes(order.phase));
      const equipped=gear.location?.kind==='person'&&gear.location.id==='person:master'&&gear.location.slot===gear.slot;
      const permitted=gear.ownerId==='person:master'||gear.ownerId==='sect:yunxiu'||gear.loan?.borrowerId==='person:master';
      const owned=gear.ownerId==='person:master';
      const stored=gear.location?.kind==='stockpile'&&gear.location.id==='stockpile:yunxiu';
      return `${iconHead}${gear.description?`<p class="bag-description">${e(gear.description)}</p>`:''}${effectText(gear.effects)?`<div class="bag-item-effect">${e(effectText(gear.effects))}</div>`:''}
        <dl class="people-facts"><div><dt>部位</dt><dd>${e(slotNames[gear.slot]||gear.slot)}</dd></div><div><dt>品相</dt><dd>${e(gear.quality||'未记载')}</dd></div><div><dt>适用境界</dt><dd>炼气 ${e(gear.realm??1)} 层</dd></div><div><dt>负重</dt><dd>${e(amount(gear.weight))}</dd></div><div><dt>完好</dt><dd>${e(Math.round(number(gear.condition)*100))}%</dd></div><div><dt>所有权</dt><dd>${e(ownerName(gear,state))}</dd></div><div><dt>实际位置</dt><dd>${e(locationName(gear,state))}</dd></div>${gear.loan?`<div><dt>借用</dt><dd>${e(gear.loan.borrowerId)} · ${e(gear.loan.status)}</dd></div>`:''}</dl>
        <div class="bag-item-actions">${button('inventory-equip',equipped?'正在佩用':'安排换装',{primary:true,disabled:equipped||active||!permitted})}${button('inventory-store',stored?'已在公库保管':'收入公库保管',{disabled:active||!owned||stored})}</div>
        ${orderList(state,item)}`;
    }
    const key=item.cargoKey,stockPublic=visibleStock(state,'stockpile:yunxiu'),stockCarried=visibleStock(state,'stockpile:carried:master');
    const pill=item.category==='丹药',available=number(item.pillInfo?.available);
    const physical=key!=='insight';
    const masterFeet=state.people?.find(person=>person.id===state.masterId);
    const hallPosition=stockPublic?.position;
    const atPublic=masterFeet&&Number.isFinite(hallPosition?.x)&&Number.isFinite(hallPosition?.y)&&hallPosition.sceneId===state.sceneId&&
      Math.hypot(number(masterFeet.x)-number(hallPosition.x),number(masterFeet.y)-number(hallPosition.y))<=1.5;
    const maxQuantity=Math.min(40,Math.max(item.carried,item.public,1));
    const chosen=Math.max(1,Math.min(Math.floor(quantity)||1,maxQuantity));
    quantity=chosen;
    const stockRows=[`<div><dt>掌门随身</dt><dd>${e(amount(item.carried))}</dd></div>`,`<div><dt>山院公库</dt><dd>${e(amount(item.public))}</dd></div>`];
    if(item.other) stockRows.push(`<div><dt>其他库位</dt><dd>${e(amount(item.other))}</dd></div>`);
    const publicSummary=(inventory.summary||[]).find(group=>group.id==='public')?.amounts?.[key];
    if(publicSummary) stockRows.push(`<div><dt>公用物资</dt><dd>可用 ${e(amount(publicSummary.available))} · 预留 ${e(amount(publicSummary.reserved))} · 在途 ${e(amount(publicSummary.inTransit))}</dd></div>`);
    const pillAction=pill?`<div class="bag-item-actions">${button('inventory-pill',available>0?'服用一份':'实际取药一份',{primary:true,disabled:number(item.pillInfo?.total)<=0||key==='pill:foundation'})}</div><p class="subtle">${e(item.pillInfo?.reason||'可用量取决于掌门当前所处位置。')}</p>`:'';
    const transportActions=physical?`<div class="bag-transfer"><label>本次数量 <input type="number" data-system-field="inventory-quantity" min="1" max="40" step="1" value="${e(chosen)}"></label><div class="bag-item-actions">${button('inventory-carry','从公库领入随身',{disabled:!stockPublic||item.public<chosen||!!stockPublic?.orderReserved})}${button('inventory-deposit','送入公库',{disabled:!stockPublic||!stockCarried||item.carried<chosen||!!stockCarried?.orderReserved})}</div>${atPublic&&item.carried>=chosen?button('inventory-gift-public','当面交入公库',{disabled:!!stockCarried?.orderReserved}):''}</div>`:'';
    return `${iconHead}<dl class="people-facts">${stockRows.join('')}<div><dt>已知总量</dt><dd>${e(amount(item.total))}</dd></div></dl>${pillAction}${transportActions}${orderList(state,item)}`;
  }

  function render() {
    const state=getState(),inventory=state.inventory||{},items=itemsFor(state),master=state.systemPeople?.persons?.find(person=>person.id===state.masterId)||state.roster?.find(person=>person.id===state.masterId);
    const visible=filteredItems(items);
    if(!visible.some(item=>item.key===selected)) selected=visible[0]?.key||null;
    const chosen=visible.find(item=>item.key===selected);
    return `<div class="bag-layout system-inventory"><section class="pane bag-equipment"><div class="pane-title"><h3>${e(master?.name||'掌门')}</h3><span class="subtle">随身装备</span></div>${equipmentBody(state,master,items)}${bar('精力',master?.energy??0,100,master?.energy<30?'gold':'jade')}${bar('伤势',master?.wound??0,100,master?.wound>0?'red':'jade')}<div class="toolbar">${button('inventory-master','人物详情')}</div></section>
      <section class="pane bag-inventory"><div class="pane-title"><h3>行囊与公库</h3><span class="subtle">实物 ${e(items.length)} 类</span></div><div class="tab-row bag-categories">${categories.map(name=>`<button data-system-action="inventory-category" data-category="${e(name)}" class="${category===name?'active':''}">${e(name)}</button>`).join('')}</div>
        <div class="toolbar"><input data-system-field="inventory-search" aria-label="搜索物品" placeholder="查找物品" value="${e(query)}">${button('inventory-sort',sorted?'按名称排列':'整理次序')}</div>
        <div class="bag-grid scroll-area" data-scroll-key="inventory-grid">${visible.map(item=>`<button class="bag-slot${selected===item.key?' selected':''}" data-system-action="inventory-select" data-key="${e(item.key)}" aria-pressed="${selected===item.key}" aria-label="${e(item.name)}"><span class="bag-slot-icon">${icon(item.kind)}</span><span class="bag-slot-name">${e(item.name)}</span><b>${e(item.item?item.item.location?.slot?'佩用':'1':amount(item.total))}</b><small>${item.item?e(locationName(item.item,state)):e(`随身 ${amount(item.carried)} · 公库 ${amount(item.public)}`)}</small></button>`).join('')}</div>${visible.length?'':'<p class="empty-state">当前分类没有可见实物。</p>'}
        </section>
      <aside class="pane bag-detail scroll-area" data-scroll-key="inventory-detail">${detail(state,chosen,master)}</aside></div>`;
  }

  function click(element) {
    const d=element.dataset,action=d.systemAction;
    if(!action?.startsWith('inventory-')) return false;
    if(action==='inventory-category') category=categories.includes(d.category)?d.category:'全部';
    else if(action==='inventory-select') selected=d.key;
    else if(action==='inventory-select-slot') {
      const state=getState(),master=state.systemPeople?.persons?.find(person=>person.id===state.masterId);
      selected=`equipment:${master?.equipmentSlots?.[d.slot]||''}`;category='装备';
    } else if(action==='inventory-sort') sorted=!sorted;
    else if(action==='inventory-master') open('master');
    else {
      const state=getState(),item=itemsFor(state).find(entry=>entry.key===selected);
      if(!item) return true;
      if(action==='inventory-equip'&&item.item) send({name:'equipItem',args:[item.item.id,item.item.slot]});
      else if(action==='inventory-store'&&item.item) send({name:'storeItem',args:[item.item.id]});
      else if(action==='inventory-pill'&&item.pillInfo) send({name:number(item.pillInfo.available)>0?'masterPill':'preparePillUse',args:[item.pillInfo.recipeId]});
      else if(item.cargoKey&&['inventory-carry','inventory-deposit','inventory-gift-public'].includes(action)) {
        const source=action==='inventory-carry'?'stockpile:yunxiu':'stockpile:carried:master';
        const target=action==='inventory-carry'?'stockpile:carried:master':'stockpile:yunxiu';
        const count=Math.max(1,Math.min(40,Math.floor(quantity)||1));
        if(action==='inventory-gift-public') send({name:'transferProperty',args:[source,target,item.cargoKey,count,'gift']});
        else send({name:'startTransport',args:[source,target,'person:master',{[item.cargoKey]:count}]});
      }
    }
    return true;
  }

  function input(element) {
    const field=element.dataset.systemField;
    if(field==='inventory-search') query=element.value;
    else if(field==='inventory-quantity') quantity=Math.max(1,Math.min(40,Math.floor(Number(element.value))||1));
    else return false;
    return true;
  }

  function enter(params={}) {
    if(categories.includes(params.category)) category=params.category;
    if(params.selected) {
      const raw=String(params.selected);
      selected=raw.startsWith('equipment:')||raw.startsWith('cargo:')?raw:
        getState().inventory?.equipment?.some(item=>item.id===raw)?`equipment:${raw}`:`cargo:${raw}`;
    }
    if(params.pill) {category='丹药';selected=`cargo:pill:${params.pill}`;}
  }

  return {render,click,input,enter};
}
