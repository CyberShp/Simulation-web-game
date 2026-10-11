/** 宗务卷册：山院取材与当面交易均交由正式世界命令办理。 */
export function createSectPanel({getState,send,open,escape,icon,portrait,bar}) {
  const e=value=>escape(value??'');
  const n=value=>Number.isFinite(Number(value))?Number(value):0;
  const amount=value=>String(Number(n(value).toFixed(2)));
  const resourceNames={wood:'灵木',stone:'青石',herb:'灵草'};
  const harvestPhases={moving:'前往采集地',working:'采集中',paused:'暂歇',blocked:'通路受阻'};
  const transportPhases={'to-source':'前往取货',carrying:'运回公库',delivered:'已经入库',cancelled:'已经停运'};
  const button=(action,label,{disabled=false,primary=false,extra=''}={})=>`<button class="game-button${primary?' primary':''}" data-system-action="${action}" ${extra} ${disabled?'disabled':''}>${e(label)}</button>`;
  let section='harvest',selectedSource='wood',selectedGood='wood',batches=1;

  function parts() {
    const state=getState();
    const sources=state.harvest?.sources||[];
    const goods=state.market?.goods||[];
    if(!sources.some(item=>item.id===selectedSource))selectedSource=sources[0]?.id||'wood';
    if(!goods.some(item=>item.id===selectedGood))selectedGood=goods.find(item=>item.id==='wood')?.id||goods[0]?.id||null;
    const stocks=state.inventory?.stockpiles||[];
    return {state,sources,source:sources.find(item=>item.id===selectedSource),goods,good:goods.find(item=>item.id===selectedGood),
      publicStock:stocks.find(item=>item.id==='stockpile:yunxiu'),carriedStock:stocks.find(item=>item.id==='stockpile:carried:master'),
      master:state.systemPeople?.persons?.find(person=>person.id===state.masterId)};
  }

  function harvestPage(p) {
    const {state,sources,source,publicStock,carriedStock,master}=p;
    const activity=state.harvest?.activity;
    const carrying=n(carriedStock?.resources?.[source?.id]);
    const publicCount=n(publicStock?.resources?.[source?.id]);
    const busy=!!master?.currentActivity?.id;
    const ready=!!source?.available&&!busy&&n(master?.wound)<=20&&n(master?.energy)>=15;
    const transports=(state.inventory?.transports||[]).filter(order=>order.sourceStockpileId==='stockpile:carried:master'&&order.targetStockpileId==='stockpile:yunxiu'&&order.cargo?.[source?.id]>0&&!['delivered','cancelled'].includes(order.phase));
    return `<div class="sect-work-layout"><aside class="pane sect-source-list"><div class="pane-title"><h3>山院取材</h3><small>山场</small></div>${sources.map(item=>`<button class="sect-source-choice${item.id===selectedSource?' active':''}" data-system-action="sect-source" data-resource="${e(item.id)}" aria-pressed="${item.id===selectedSource}"><span class="icon-slot">${icon(item.id)}</span><span><strong>${e(item.name||resourceNames[item.id]||item.id)}</strong><small>山场余量 ${e(amount(item.remaining))}</small></span></button>`).join('')||'<p class="empty-state">山场尚待查明。</p>'}</aside>
      <section class="pane sect-source-detail"><div class="sect-calligraphy">山中有材 · 亲身采得</div><div class="sect-source-hero"><div class="sect-source-emblem">${icon(source?.id||'mountain')}</div><div><small>云岫山院</small><h2>${e(source?.name||resourceNames[source?.id]||'山场')}</h2><p>一趟取 ${e(amount(source?.batchSize))} 份 · 山场余 ${e(amount(source?.remaining))} 份</p></div></div>
        <div class="sect-supply-ledger"><div><small>随身</small><strong>${e(amount(carrying))}</strong></div><div><small>公库</small><strong>${e(amount(publicCount))}</strong></div><div><small>这一趟</small><strong>${e(amount(source?.batchSize))}</strong></div></div>
        ${activity?`<div class="sect-active-work"><h3>${e(resourceNames[activity.resource]||activity.resource)} · ${e(harvestPhases[activity.phase]||activity.phase)}</h3>${bar('采集',n(activity.progressTicks),Math.max(1,n(activity.durationTicks)))}<p>${e(activity.reason||'')}</p>${button('sect-cancel-harvest','停下采集')}</div>`:
          `<div class="sect-harvest-action">${source?.reason&&!source.available?`<p class="danger">${e(source.reason)}</p>`:`<p>${ready?'山路可行，掌门可亲往取材。':busy?'掌门正有事务在身。':n(master?.wound)>20||n(master?.energy)<15?'掌门需先休整。':'待山场恢复可采。'}</p>`}${button('sect-harvest',`前往取 ${e(amount(source?.batchSize))} 份`,{primary:true,disabled:!ready||!source})}</div>`}
      </section><aside class="pane sect-source-side"><div class="pane-title"><h3>入库</h3><small>物资往来</small></div><p>采得的${e(source?.name||resourceNames[source?.id]||'物资')}随掌门带回。</p>${button('sect-deposit',`送入公库 ${e(amount(Math.min(40,carrying)))} 份`,{disabled:carrying<=0||busy})}
        ${transports.length?`<div class="sect-transit"><h4>正在运送</h4>${transports.map(order=>`<div><strong>${e(amount(order.cargo[source.id]))} 份</strong><span>${e(transportPhases[order.phase]||order.phase)}</span></div>`).join('')}</div>`:''}
        <div class="sect-supply-summary"><h4>公库现存</h4>${sources.map(item=>`<div><span>${e(item.name||resourceNames[item.id]||item.id)}</span><strong>${e(amount(publicStock?.resources?.[item.id]))}</strong></div>`).join('')}</div>${button('sect-bag','打开行囊')}</aside></div>`;
  }

  function approachMerchant(state,merchant) {
    if(!merchant?.position||!Number.isFinite(merchant.position.x)||!Number.isFinite(merchant.position.y))return;
    const master=state.people?.find(person=>person.id===state.masterId);
    const dx=(master?.x??merchant.position.x+1)-merchant.position.x;
    const dy=(master?.y??merchant.position.y)-merchant.position.y;
    const length=Math.hypot(dx,dy)||1;
    const x=Math.max(0,Math.min(n(state.width)||96,merchant.position.x+dx/length*1.8));
    const y=Math.max(0,Math.min(n(state.height)||96,merchant.position.y+dy/length*1.8));
    const result=send({type:'move',x,y});
    if(result?.ok&&result.result!==false)open('scene');
  }

  function marketPage(p) {
    const {state,goods,good}=p,market=state.market||{},merchant=market.merchant||{};
    const present=!!merchant.atCourtyard,near=present&&!!merchant.canTrade;
    const perBatch=n(market.unitsPerBatch)||10;
    const count=perBatch*batches,priceBuy=n(good?.buy)*batches,priceSell=n(good?.sell)*batches;
    const canBuy=near&&!!good&&n(good.merchantStock)>=count&&n(market.publicJade)>=priceBuy;
    const canSell=near&&!!good&&n(good.publicStock)>=count&&n(market.merchantJade)>=priceSell;
    const appearance=state.people?.find(person=>person.id===merchant.id)?.appearance;
    return `<div class="sect-market-layout"><aside class="pane sect-merchant"><div class="pane-title"><h3>山客</h3><small>${present?'已到山院':'候客'}</small></div><div class="sect-merchant-portrait">${present?portrait({name:merchant.name,appearance},true):icon('mountain')}</div><h2>${e(present?merchant.name||'青溪山客':'山路候客')}</h2><p>${present?near?'人已在近前，可当面交易。':'山客已抵山院，走近后再谈买卖。':'山客此刻不在山院，待其来访再议。'}</p><div class="sect-merchant-actions">${present&&!near?button('sect-approach','前往山客处',{primary:true}):''}</div></aside>
      <section class="pane sect-market-goods"><div class="pane-title"><h3>青溪货帖</h3><small>每组 ${e(amount(perBatch))} 份</small></div><div class="sect-goods-list scroll-area" data-scroll-key="sect-goods">${goods.map(item=>`<button class="sect-good-choice${item.id===selectedGood?' active':''}" data-system-action="sect-good" data-good="${e(item.id)}" aria-pressed="${item.id===selectedGood}"><span class="icon-slot">${icon(['wood','stone','herb','food'].includes(item.id)?item.id:'jade')}</span><span><strong>${e(item.name)}</strong><small>山客 ${e(amount(item.merchantStock))} · 公库 ${e(amount(item.publicStock))}</small></span><i>买 ${e(amount(item.buy))} / 卖 ${e(amount(item.sell))}</i></button>`).join('')||'<p class="empty-state">货帖尚未送到。</p>'}</div></section>
      <aside class="pane sect-market-deal"><div class="pane-title"><h3>当面议价</h3><small>${e(good?.name||'选择货物')}</small></div><div class="sect-deal-symbol">${icon(['wood','stone','herb','food'].includes(good?.id)?good.id:'jade')}</div><h2>${e(good?.name||'货物')}</h2><p>每组 ${e(amount(perBatch))} 份</p><div class="sect-deal-count"><span>组数</span>${button('sect-less','−',{disabled:batches<=1})}<strong>${e(batches)}</strong>${button('sect-more','＋',{disabled:batches>=Math.max(1,n(market.maxBatchesPerCommand)||8)})}</div><div class="sect-deal-ledger"><div><span>本次货量</span><strong>${e(count)} 份</strong></div><div><span>山客现货</span><strong>${e(amount(good?.merchantStock))}</strong></div><div><span>公库现货</span><strong>${e(amount(good?.publicStock))}</strong></div><div><span>公库灵石</span><strong>${e(amount(market.publicJade))}</strong></div><div><span>山客灵石</span><strong>${e(amount(market.merchantJade))}</strong></div></div><div class="sect-deal-actions">${button('sect-buy',`买入 · 灵石 ${e(amount(priceBuy))}`,{primary:true,disabled:!canBuy})}${button('sect-sell',`卖出 · 灵石 ${e(amount(priceSell))}`,{disabled:!canSell})}</div></aside></div>`;
  }

  function render() {
    const p=parts();
    return `<div class="system-sect"><nav class="sect-ledger-tabs" aria-label="宗务"><button data-system-action="sect-section" data-section="harvest" aria-pressed="${section==='harvest'}" class="${section==='harvest'?'active':''}">${icon('mountain')}山院取材</button><button data-system-action="sect-section" data-section="market" aria-pressed="${section==='market'}" class="${section==='market'?'active':''}">${icon('jade')}山客交易</button></nav>${section==='market'?marketPage(p):harvestPage(p)}</div>`;
  }

  function click(element) {
    const {systemAction:action,section:targetSection,resource,good:goodId}=element.dataset;
    if(!action?.startsWith('sect-'))return false;
    const p=parts();
    if(action==='sect-section')section=targetSection==='market'?'market':'harvest';
    else if(action==='sect-source'){if(p.sources.some(item=>item.id===resource))selectedSource=resource;}
    else if(action==='sect-good'){if(p.goods.some(item=>item.id===goodId))selectedGood=goodId;}
    else if(action==='sect-bag')open('bag');
    else if(action==='sect-harvest'&&p.source)send({name:'startMasterHarvest',args:[p.source.id]});
    else if(action==='sect-cancel-harvest')send({name:'cancelMasterHarvest',args:[]});
    else if(action==='sect-deposit'&&p.source){
      const quantity=Math.min(40,n(p.carriedStock?.resources?.[p.source.id]));
      if(quantity>0)send({name:'startTransport',args:['stockpile:carried:master','stockpile:yunxiu','person:master',{[p.source.id]:quantity}]});
    } else if(action==='sect-approach')approachMerchant(p.state,p.state.market?.merchant);
    else if(action==='sect-less')batches=Math.max(1,batches-1);
    else if(action==='sect-more')batches=Math.min(Math.max(1,n(p.state.market?.maxBatchesPerCommand)||8),batches+1);
    else if(['sect-buy','sect-sell'].includes(action)&&p.good)send({name:'marketTrade',args:[p.good.id,action==='sect-buy'?'buy':'sell',batches]});
    return true;
  }

  function input() {return false;}
  function enter(params={}) {
    if(params.section==='market'||params.section==='harvest')section=params.section;
    if(params.resource)selectedSource=params.resource;
    if(params.good)selectedGood=params.good;
  }
  return {render,click,input,enter};
}
