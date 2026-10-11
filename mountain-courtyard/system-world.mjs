/** 近山卷图：地点选择留在界面，行走、交互与旅程交给同一世界。 */
export function createWorldPanel({getState,send,open,close,escape,icon,portrait,bar}) {
  const HOME='scene:yunxiu-courtyard', VALLEY='scene:valley';
  const names={jade:'灵石',wood:'木料',stone:'石料',herb:'灵草',food:'口粮',crystal:'灵晶',insight:'道韵'};
  const places={[HOME]:'云岫山院',[VALLEY]:'云岫山谷'};
  const activityNames={walk:'行走中',interact:'正在料理',investigate:'正在查验',gather:'正在采集',talk:'正在交谈'};
  const e=value=>escape(value??'');
  const num=value=>Number.isFinite(Number(value))?Number(value):0;
  const amount=value=>String(Number(num(value).toFixed(1)));
  const button=(action,label,{disabled=false,primary=false,extra=''}={})=>`<button class="game-button${primary?' primary':''}" data-system-action="world-${action}" ${extra} ${disabled?'disabled':''}>${e(label)}</button>`;
  let selected={kind:'route',id:VALLEY}, packedFood=null;

  function parts() {
    const state=getState(), world=state.world||{}, scene=world.scene;
    const party=(state.inventory?.stockpiles||[]).find(stock=>stock.id==='stockpile:sr-party');
    const home=(state.inventory?.stockpiles||[]).find(stock=>stock.id==='stockpile:yunxiu');
    const feet=scene?.player?.position||scene?.player||(state.people||[]).find(person=>person.id===state.masterId);
    const objects=world.objects||scene?.objects||[];
    const exits=(world.exits||[]).filter(exit=>places[exit.destination]);
    const people=world.publicPeople||[];
    const active=!!world.activity||!!state.combat;
    const walking=world.activity?.kind==='walk';
    return {state,world,scene,party,home,feet,objects,exits,people,active,walking};
  }

  function resolve(p) {
    if(selected.kind==='object')return p.objects.find(item=>item.id===selected.id);
    if(selected.kind==='exit')return p.exits.find(item=>item.id===selected.id);
    if(selected.kind==='person')return p.objects.find(item=>item.personId===selected.id)||p.people.find(item=>item.id===selected.id);
    if(selected.kind==='route')return p.exits.find(item=>item.destination===selected.id);
    return null;
  }

  function near(object,p) {
    if(!object||!p.feet)return false;
    if(p.exits.some(exit=>exit.id===object.id))return object.near;
    const dx=Math.abs(num(p.feet.x)-num(object.x)),dy=Math.abs(num(p.feet.y)-num(object.y));
    return object.personId||p.people.some(person=>person.id===object.id)
      ? Math.hypot(dx,dy)<=num(object.interactionRadius||3.1)
      : Math.max(dx-num(object.width)/2,dy-num(object.height)/2)<=num(object.interactionRadius||2.4);
  }

  function distance(object,p) {
    return p.feet&&object?`${amount(Math.hypot(num(object.x)-num(p.feet.x),num(object.y)-num(p.feet.y)))} 米`:'';
  }

  function objectIcon(object) {
    if(object.entityKind==='beast')return 'sword';
    if(object.personId||object.selectionKind==='person')return 'person';
    if(object.choices?.some(choice=>choice.action==='gather'))return 'herb';
    return object.kind==='building'?'build':'mountain';
  }

  function routeMap(p) {
    const current=p.scene?.id;
    return `<div class="journey-route-map" aria-label="云岫近山路线"><div class="journey-route-line" aria-hidden="true"></div>${[HOME,VALLEY].map((id,index)=>`<button class="journey-route-node${current===id?' here':''}${selected.kind==='route'&&selected.id===id?' selected':''}" data-system-action="world-select" data-kind="route" data-id="${id}" aria-pressed="${selected.kind==='route'&&selected.id===id}"><span>${icon(index?'mountain':'build')}</span><strong>${places[id]}</strong><small>${current===id?'身在此地':p.world.travel?.destinationId===id?'正在前往':'山道相通'}</small></button>`).join('')}<span class="journey-route-caption">山门外山道</span></div>`;
  }

  function localMap(p) {
    if(!p.scene)return `<div class="journey-road-view"><span>${icon('mountain')}</span><h2>${p.world.travel?'行于山道':'近山舆图'}</h2><p>${p.world.travel?`前往${e(p.world.travel.destination)}`:'地界信息尚未展开'}</p></div>`;
    const w=num(p.scene.width)||96,h=num(p.scene.height)||96;
    const markers=[...p.objects.map(object=>({...object,selectionKind:'object'})),...p.exits.map(exit=>({...exit,selectionKind:'exit'}))];
    for(const person of p.people)if(!markers.some(item=>item.personId===person.id))markers.push({...person,selectionKind:'person'});
    const pos=item=>`left:${Math.max(3,Math.min(97,num(item.x)/w*100))}%;top:${Math.max(5,Math.min(94,num(item.y)/h*100))}%`;
    return `<div class="journey-local-chart" aria-label="${e(p.scene.name)}地界略图"><span class="journey-chart-seal">${e(p.scene.name)}</span><svg class="journey-chart-grain" viewBox="0 0 640 400" preserveAspectRatio="none" aria-hidden="true"><path d="M-20 80Q160 180 250 70T660 70M-20 110Q160 210 250 100T660 100M-20 140Q160 240 250 130T660 130M-20 300Q170 230 320 320T680 300M-20 326Q170 256 320 346T680 326"/></svg>${markers.map(item=>`<button class="journey-chart-point${item.selectionKind==='exit'?' is-exit':''}${item.entityKind==='beast'?' is-beast':''}${resolve(p)?.id===item.id?' selected':''}${item.available===false?' unavailable':''}" style="${pos(item)}" data-system-action="world-select" data-kind="${item.selectionKind}" data-id="${e(item.id)}" aria-label="${e(item.name)}${item.available===false?'，'+e(item.reason):''}" aria-pressed="${resolve(p)?.id===item.id}"><span>${icon(item.selectionKind==='exit'?'flag':objectIcon(item))}</span><b>${e(item.name)}</b></button>`).join('')}${p.feet?`<div class="journey-master-point" style="${pos(p.feet)}" title="掌门当前位置"><i></i><b>掌门</b></div>`:''}<span class="journey-chart-legend">● 掌门脚点　◇ 可选地点</span></div>`;
  }

  function cargo(p) {
    const stock=p.party?.resources||{};
    const rows=Object.entries(stock).filter(([,value])=>num(value)>0);
    const transfer=homeTransfer(p),quantity=Object.values(transfer.cargo).reduce((total,value)=>total+value,0);
    return `<section class="journey-cargo"><div class="pane-title"><span>随行物资</span>${button('bag','行囊')}</div>${rows.length?`<div class="journey-cargo-items">${rows.map(([key,value])=>`<div><span>${icon(key==='crystal'?'jade':key)}${e(names[key]||key)}</span><strong>${amount(value)}</strong></div>`).join('')}</div>`:'<p class="subtle">随行物资箱尚空。</p>'}${transfer.here?`<div class="journey-cargo-transfer">${button('store',transfer.active?'正在送入公库':`送入公库 · ${amount(quantity)} 份`,{disabled:!quantity||transfer.active||p.active,primary:quantity>0&&!transfer.active})}${transfer.active?`<p class="subtle">${e(transfer.active.reason||({'to-source':'正去取回随行物资',carrying:'正将随行物资送往公库'})[transfer.active.phase]||'送运中')}</p>`:''}</div>`:''}</section>`;
  }

  function homeTransfer(p) {
    const here=p.scene?.id===HOME&&p.party?.position?.sceneId===HOME&&p.home?.position?.sceneId===HOME;
    const transports=(p.state.inventory?.transports||[]).filter(order=>!['delivered','cancelled'].includes(order.phase));
    const active=transports.find(order=>order.carrierId===p.state.masterId||order.sourceStockpileId===p.party?.id);
    const cargo={};let left=40;
    for(const key of ['herb','wood','stone','crystal','jade','food']) {
      const reserved=transports.filter(order=>order.sourceStockpileId===p.party?.id).reduce((total,order)=>total+num(order.cargo?.[key]),0);
      const available=p.party?.orderReserved||p.home?.orderReserved?0:Math.max(0,num(p.party?.resources?.[key])-reserved);
      const quantity=Math.min(left,available);if(quantity>0){cargo[key]=quantity;left-=quantity;}
    }
    return {here,active,cargo};
  }

  function activity(p) {
    const current=p.world.activity;
    if(!current)return p.world.lastInteraction?.status==='interrupted'?`<p class="journey-feedback">${e(p.world.lastInteraction.reason)}</p>`:'';
    return `<div class="journey-current-work"><strong>${e(activityNames[current.kind]||'正在料理眼前事务')}</strong>${num(current.durationTicks)>0?bar('进展',num(current.progressTicks),num(current.durationTicks)):''}${button('cancel','停下当前事务')}</div>`;
  }

  function travelDetail(p) {
    const travel=p.world.travel;
    return `<div class="journey-detail-heading"><small>在途</small><h2>${e(travel.destination)}</h2><p>${e(travel.routeName)}</p></div><div class="journey-remaining"><strong>${Math.ceil(num(travel.remainingTicks)/10)}</strong><span>秒余程</span></div><p class="journey-detail-copy">${e(travel.reason||({traveling:'正沿山道前行',returning:'正沿原路折返',waiting:'在原地候行',blocked:'行程暂阻'})[travel.status]||'行程进行中')}</p>${button('return','沿途折返',{disabled:!travel.returnAvailable})}${!travel.returnAvailable&&travel.returnReason?`<p class="subtle">${e(travel.returnReason)}</p>`:''}`;
  }

  function exitDetail(exit,p) {
    const atHome=p.scene?.id===HOME, cost=exit.cost||{};
    const stock=atHome?p.home:p.party;
    const pack=packedFood??Math.max(0,4-num(p.party?.resources?.food));
    const missing=Object.entries(cost).some(([key,value])=>num(stock?.resources?.[key])<num(value))||atHome&&num(p.home?.resources?.food)<num(cost.food)+pack;
    const label=exit.near?`前往${places[exit.destination]}`:`走向${exit.name}`;
    return `<div class="journey-detail-heading"><small>山道出口</small><h2>${e(places[exit.destination])}</h2><p>${e(exit.name)}</p></div><div class="journey-route-facts"><div><span>路程</span><strong>${Math.ceil(num(exit.durationTicks)/10)} 秒</strong></div><div><span>此行耗用</span><strong>${Object.entries(cost).map(([key,value])=>`${e(names[key]||key)} ${amount(value)}`).join(' · ')||'无'}</strong></div><div><span>距出口</span><strong>${e(distance(exit,p))}</strong></div></div>${atHome?`<label class="journey-pack-label"><span>从公库携粮<small>已有随行口粮 ${amount(p.party?.resources?.food)}</small></span><input type="number" min="0" max="${Math.max(0,num(p.home?.resources?.food)-num(cost.food))}" step="1" value="${pack}" data-system-field="world-food" aria-label="从公库携带的口粮份数"></label>`:''}<p class="journey-detail-copy">${e(exit.reason)}</p>${button('exit',label,{primary:true,disabled:!exit.available||exit.near&&missing,extra:`data-id="${e(exit.id)}"`})}${!exit.available&&atHome?button('master','掌门事务'):''}${exit.near&&missing?'<p class="danger">身边口粮不足，先备齐此行耗用与携粮。</p>':''}`;
  }

  function objectDetail(object,p) {
    const nearby=near(object,p), unavailable=object.available===false;
    const person=p.people.find(person=>person.id===(object.personId||object.id));
    const choices=object.choices||[];
    const isBeast=object.entityKind==='beast';
    const canApproach=!unavailable&&(!p.active||p.walking);
    const busy=p.active;
    return `<div class="journey-object-emblem${isBeast?' is-beast':''}">${person&&!isBeast?portrait(person,true):icon(objectIcon(object))}</div><div class="journey-detail-heading"><small>${isBeast?'林间遭遇':person?e(object.name):'眼前物件'}</small><h2>${e(person?.name||object.name)}</h2><p>${e(distance(object,p))}${nearby?' · 已在近处':''}</p></div>${object.resourceRemaining!==undefined?`<div class="journey-resource-count"><span>可采灵草</span><strong>${amount(object.resourceRemaining)}</strong></div>`:''}${object.reason?`<p class="journey-detail-copy">${e(object.reason)}</p>`:''}${!nearby?button('approach','走近察看',{primary:true,disabled:!canApproach,extra:`data-id="${e(object.id)}"`}):`<div class="journey-object-actions">${choices.map(choice=>button('interact',choice.label,{primary:choice.action==='gather'||choice.action==='engage',disabled:unavailable||busy||choice.action==='gather'&&num(object.resourceRemaining)===0,extra:`data-id="${e(object.id)}" data-choice="${e(choice.action)}"`})).join('')||'<p class="subtle">此刻可在场景中查看。</p>'}</div>`}${isBeast&&object.available!==false?'<p class="journey-detail-copy">应战后可护持、闪避或沿林间出口撤离。</p>':''}`;
  }

  function knownRecords(object,p) {
    if(!object)return '';
    const source=object.id,personId=object.personId||object.id;
    const facts=source==='object:valley:guardian'?['fact:rain:guardian']:[];
    const messages=(p.world.messages||[]).filter(message=>message.sourcePersonId===personId||message.sourceId===source||message.sourceId?.includes(source)||(message.evidenceFactIds||[]).some(id=>id.includes(source)||facts.includes(id))).sort((a,b)=>num(b.receivedAtTick)-num(a.receivedAtTick)).slice(0,3);
    if(!messages.length)return '';
    return `<section class="journey-known-records"><div class="pane-title">会面与查验</div>${messages.map(message=>`<p>${e(message.text)}</p>`).join('')}</section>`;
  }

  function render() {
    const p=parts(), object=resolve(p);
    const detail=p.world.travel?travelDetail(p):object?(p.exits.some(exit=>exit.id===object.id)?exitDetail(object,p):objectDetail(object,p)):`<div class="journey-detail-heading"><small>云岫近山</small><h2>${e(places[selected.id]||p.scene?.name||'近山舆图')}</h2><p>${selected.id===p.scene?.id?'身在此地':'点选地界中的人物、物件或山道'}</p></div>${button('scene','回到场景',{primary:true})}`;
    return `<section class="system-world" data-scroll-key="world-page"><header class="journey-toolbar"><div><span>近山舆图</span><small>${e(p.world.travel?'行于山道':p.scene?.name||'云岫')}${p.state.paused?' · 时辰暂歇':''}</small></div>${button('scene','回到场景')}</header><div class="journey-layout"><div class="journey-chart-column"><section class="journey-route-pane">${routeMap(p)}</section><section class="journey-map-pane">${localMap(p)}</section><div class="journey-place-list" data-scroll-key="world-places">${[...p.exits.map(exit=>({...exit,kindKey:'exit'})),...p.objects.map(object=>({...object,kindKey:'object'}))].map(item=>`<button class="journey-place-choice${object?.id===item.id?' active':''}" data-system-action="world-select" data-kind="${item.kindKey}" data-id="${e(item.id)}">${icon(item.kindKey==='exit'?'flag':objectIcon(item))}<span>${e(item.name)}</span></button>`).join('')}</div></div><aside class="journey-detail scroll-area" data-scroll-key="world-detail">${detail}${activity(p)}${!p.world.travel?knownRecords(object,p):''}${cargo(p)}</aside></div></section>`;
  }

  function approachPoint(object,p) {
    if(object.approach)return object.approach;
    const x=num(object.x),y=num(object.y),feet=p.feet||{x:x-3,y};
    if(object.personId||p.people.some(person=>person.id===object.id)) {
      const length=Math.hypot(num(feet.x)-x,num(feet.y)-y)||1;
      return {x:x+(num(feet.x)-x)/length*2.2,y:y+(num(feet.y)-y)/length*2.2};
    }
    const dx=num(object.width)/2+1.2,dy=num(object.height)/2+1.2;
    const candidates=[{x:x-dx,y},{x:x+dx,y},{x,y:y-dy},{x,y:y+dy}];
    return candidates.filter(point=>point.x>=1&&point.y>=1&&point.x<num(p.scene?.width)-1&&point.y<num(p.scene?.height)-1&&!p.objects.some(other=>other!==object&&!other.personId&&Math.abs(point.x-num(other.x))<num(other.width)/2+.45&&Math.abs(point.y-num(other.y))<num(other.height)/2+.45)).sort((a,b)=>Math.hypot(a.x-num(feet.x),a.y-num(feet.y))-Math.hypot(b.x-num(feet.x),b.y-num(feet.y)))[0]||candidates[0];
  }

  function select(kind,id) {
    if(kind==='world-object')kind='object';
    if(['route','exit','object','person'].includes(kind)&&typeof id==='string')selected={kind,id};
  }

  function click(element) {
    const action=element?.dataset?.systemAction;
    if(!action?.startsWith('world-'))return false;
    if(element.disabled)return true;
    const p=parts(),id=element.dataset.id;
    if(action==='world-select'){select(element.dataset.kind,id);return true;}
    if(action==='world-scene'){if(close)close();else open('scene');return true;}
    if(action==='world-bag'){open('bag');return true;}
    if(action==='world-master'){open('master',{person:p.state.masterId});return true;}
    if(action==='world-store') {
      const transfer=homeTransfer(p);
      if(transfer.here&&!transfer.active&&!p.active&&Object.values(transfer.cargo).some(value=>value>0))send({name:'startTransport',args:[p.party.id,p.home.id,p.state.masterId||'person:master',transfer.cargo]});
      return true;
    }
    let command,followScene=false;
    if(action==='world-exit') {
      const exit=p.exits.find(item=>item.id===id);
      if(!exit?.available)return true;
      command={name:'srWorldCommand',args:[{action:'exit',exitId:id,...(p.scene?.id===HOME?{cargo:{food:packedFood??Math.max(0,4-num(p.party?.resources?.food))}}:{})}]};
      followScene=!exit.near;
    } else if(action==='world-approach') {
      const object=p.objects.find(item=>item.id===id)||p.people.find(item=>item.id===id);
      if(!object||object.available===false||p.active&&!p.walking)return true;
      const point=approachPoint(object,p);
      command={type:'move',x:point.x,y:point.y};followScene=true;
    } else if(action==='world-interact') {
      const object=p.objects.find(item=>item.id===id),choice=element.dataset.choice;
      if(!object||object.available===false||!near(object,p)||p.active||!object.choices?.some(item=>item.action===choice))return true;
      command={name:'srWorldCommand',args:[choice==='engage'?{action:'engage',objectId:id}:{action:'interact',objectId:id,choice}]};
      followScene=choice==='engage';
    } else if(action==='world-return') {
      if(!p.world.travel?.returnAvailable)return true;
      command={name:'srWorldCommand',args:[{action:'return'}]};
    } else if(action==='world-cancel')command={name:'srWorldCommand',args:[{action:'cancel'}]};
    if(command){const result=send(command);if(result?.ok&&followScene){if(close)close();else open('scene');}}
    return true;
  }

  function input(element) {
    if(element?.dataset?.systemField!=='world-food')return false;
    packedFood=Math.max(0,Math.floor(num(element.value)));return true;
  }

  function enter(params={}) {
    if(params.kind&&params.id)select(params.kind,params.id);
    else {const p=parts();if(selected.kind==='route'&&selected.id===p.scene?.id)selected={kind:'route',id:p.scene.id===HOME?VALLEY:HOME};}
  }
  return {render,click,input,enter,select};
}
