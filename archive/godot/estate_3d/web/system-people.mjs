/** U-120 character panels. UI selections are local; world changes use the shared host. */
export function createPeoplePanels({getState, send, open, selectPerson, escape: escapeText, icon, portrait, bar}) {
  const ui = {page:'disciples', selected:null, peak:'all', query:'', filter:'all', sort:'default', pageIndex:0, detail:false, tab:'cultivation', workplace:null};
  const notices = new Map();
  const pageSize = 6;
  const esc = value => escapeText(String(value ?? ''));
  const num = value => Number.isFinite(value) ? Number(value.toFixed(1)) : null;
  const slots = [
    {id:'weapon', label:'兵器', icon:'sword'}, {id:'armor', label:'衣甲', icon:'robe'},
    {id:'artifact', label:'法器', icon:'jade'}, {id:'accessory', label:'佩饰', icon:'ring'},
  ];
  const phases = {reserved:'已预约', proposed:'待商议', moving:'前往途中', navigating:'前往途中', preparing:'准备中', executing:'进行中', working:'进行中', waiting:'等候', blocked:'等待条件', paused:'暂歇', active:'进行中', away:'外出', completed:'已完成', cancelled:'已中止', interrupted:'已中断'};
  const activities = {rest:'休息', groundRest:'休憩', heal:'疗伤', cultivate:'修炼', study:'研习', teach:'授业', work:'劳作', carry:'搬运', walk:'行走', idle:'在院', wait:'等候', construct:'营造', travel:'行旅', combat:'斗法'};
  const artKinds = {main:'心法', support:'辅修', martial:'武学', spell:'术法', movement:'身法', production:'百艺'};
  const button = (action, label, attrs='', primary=false) => `<button class="game-button${primary?' primary':''}" data-system-action="${action}" ${attrs}>${label}</button>`;
  const fact = (label, value) => value !== undefined && value !== null && value !== '' ? `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : '';
  const empty = text => `<div class="empty-state">${esc(text)}</div>`;
  const meter = (label, value, maximum=100, tone='jade') => Number.isFinite(value) && Number.isFinite(maximum) && maximum > 0 ? bar(label, num(value), maximum, tone) : '';
  const state = () => getState();
  const persons = s => {
    const recorded=s.systemPeople?.persons ? s.systemPeople.persons.map(p=>({...s.roster?.find(r=>r.id===p.id),...p})) : s.roster || [];
    const visitors=(s.people||[]).filter(p=>!recorded.some(r=>r.id===p.id)).map(p=>({
      id:p.id,name:p.name,appearance:p.appearance,role:'visitor',atHome:true,
      action:p.activity,currentActivity:{label:activities[p.activity]||'在院',phase:null,reason:''},
      arts:[],relations:[],
    }));
    return [...recorded,...visitors];
  };
  const master = s => persons(s).find(p => p.id === s.masterId || p.role === 'master');
  const members = s => persons(s).filter(p => p.id !== s.masterId && p.role !== 'master');
  const personById = (s, id) => persons(s).find(p => p.id === id);
  const peakName = p => p.peak?.name || (p.role === 'visitor' ? '来访者' : '山院');
  const peakKey = p => p.role==='visitor'?'visitors':p.peak?.id!=null?String(p.peak.id):'home';
  const roleName = p => ({master:'掌门', visitor:'来访者', disciple:'门人', resident:'暂居者'})[p.role] || '同门';
  const realmName = p => p.realmLabel || (Number.isFinite(p.realm) ? p.realm < 10 ? `炼气 ${p.realm} 层` : `筑基 ${p.realm - 9} 层` : '修为未详');
  const actionName = p => p.currentActivity?.label || activities[p.action] || '暂无活动记录';
  const locationName = p => p.currentActivity?.place || (p.atHome ? '云岫山院' : '山外');
  const activityReason = p => p.currentActivity?.reason || p.schedule?.reason || '';
  const artById = (s, id) => (s.arts || []).find(a => a.id === id);
  const artName = (s, id) => id ? artById(s,id)?.name || (persons(s).flatMap(p=>p.arts||[]).find(a=>a.id===id)?.name) || '所修法门' : '尚无主修记录';
  const learnedArts = (s, p) => (p.arts || []).map(a=>({...artById(s,a.id), ...a}));
  const knownIssue = p => (p.wound > 0 ? `伤势 ${num(p.wound)}` : '') || (p.energy < 30 ? '精力偏低' : '') || (p.currentActivity?.phase === 'blocked' ? '等待条件' : '');
  const workChoices = (s,p) => p.workChoices || s.systemPeople?.workplaces || [];
  const currentInvitation = p => [...(p.schedule?.invitations || [])].sort((a,b)=>(b.atTick??0)-(a.atTick??0))[0];
  const sceneVisible = (s,p) => (s.people || []).some(item=>item.id===p.id);

  function equipmentItem(s, id) {
    if (!id) return null;
    const inventory = s.systemInventory || s.inventory || {};
    return (inventory.items || (Array.isArray(inventory.equipment) ? inventory.equipment : inventory.equipment?.items) || s.equipment?.items || []).find(item=>item.id===id || item.itemId===id) || null;
  }
  const equipmentName = item => item?.name || item?.definition?.name || '已佩用';

  function filteredPeople(s) {
    const query = ui.query.trim().toLocaleLowerCase();
    const result = members(s).filter(p => (ui.peak==='all' || peakKey(p)===ui.peak)
      && (ui.filter==='all' || ui.filter==='home' && p.atHome || ui.filter==='attention' && Boolean(knownIssue(p)) || ui.filter==='invited' && Boolean(currentInvitation(p)))
      && (!query || [p.name, p.root, peakName(p), actionName(p), artName(s,p.mainArtId)].some(v=>String(v||'').toLocaleLowerCase().includes(query))));
    if (ui.sort==='realm') result.sort((a,b)=>(b.realm??-1)-(a.realm??-1));
    if (ui.sort==='energy') result.sort((a,b)=>(a.energy??101)-(b.energy??101));
    return result;
  }

  function current(s) { return personById(s,ui.selected); }

  function invitation(s,p) {
    if (p.role !== 'disciple') return '';
    const choices = workChoices(s,p);
    const chosen = choices.find(w=>(w.instanceId || String(w.id))===ui.workplace) || choices.find(w=>w.available) || choices[0];
    const last = currentInvitation(p);
    const notice = notices.get(p.id);
    return `<div class="people-invitation"><h4>事务邀约</h4>
      ${choices.length ? `<label for="system-people-workplace" class="subtle">希望邀请承担</label><select id="system-people-workplace" data-system-field="people-workplace">${choices.map(w=>`<option value="${esc(w.instanceId||w.id)}"${w===chosen?' selected':''}>${esc(w.name)}${w.available===false?' · 暂不可接':''}</option>`).join('')}</select>
        ${chosen?.reason?`<p class="subtle">${esc(chosen.reason)}</p>`:''}
        ${button('people-invite','发出邀约',`data-person="${esc(p.id)}" data-workplace="${esc(chosen?.instanceId||chosen?.id||'')}" ${chosen?.available===false?'disabled':''}`)}` : '<p class="subtle">山院暂没有可提供的差事。</p>'}
      ${notice?`<p class="people-response ${notice.kind}" role="status">${esc(notice.text)}</p>`:last?`<p class="people-response ${last.accepted?'good':'gold'}">${esc(last.accepted?'已应下邀约':'邀约回应')}：${esc(last.reason||'已记录本人回应')}</p>`:''}
    </div>`;
  }

  function currentActivity(p) {
    const a=p.currentActivity;
    return `<div class="people-current"><span class="subtle">当前事务</span><strong>${esc(actionName(p))}</strong><span>${esc(locationName(p))}${a?.phase?` · ${esc(phases[a.phase]||a.phase)}`:''}</span>${activityReason(p)?`<p>${esc(activityReason(p))}</p>`:''}</div>
      ${a?.durationTicks>0?meter('进度',a.progressTicks,a.durationTicks):''}`;
  }

  function vitals(p) {
    return meter('精力',p.energy,100,p.energy<30?'gold':'jade')
      + (p.wound>0 ? meter('伤势',p.wound,100,'red') : Number.isFinite(p.wound)?'<p class="people-well good">当前无伤</p>':'')
      + meter('饱食',p.satiety,100,p.satiety<30?'gold':'jade');
  }

  function summary(s,p,detail=false) {
    if (!p) return `<aside class="pane people-summary">${empty('选择一位门人，查看身况与当前事务。')}</aside>`;
    return `<aside class="pane people-summary" data-scroll-key="people-${detail?'detail':'roster'}-summary:${esc(p.id)}"><div class="people-summary-head">${portrait(p)}<div><h3>${esc(p.name)}</h3><div class="subtle">${esc(peakName(p))} · ${esc(roleName(p))}</div><strong class="gold">${esc(realmName(p))}</strong></div></div>
      ${currentActivity(p)}${vitals(p)}
      <dl class="people-facts">${fact('所修',artName(s,p.mainArtId))}${fact('灵根',p.root)}${fact('职司',p.office?.name||p.office)}${fact('所在',locationName(p))}</dl>
      <div class="toolbar">${!detail?button('people-detail','打开人物志',`data-person="${esc(p.id)}"`,true):''}${button('people-locate','在山院中定位',`data-person="${esc(p.id)}" ${sceneVisible(s,p)?'':'disabled'}`)}</div>
      ${!sceneVisible(s,p)?'<p class="subtle people-location-note">此人当前不在山院可定位范围。</p>':''}
      ${invitation(s,p)}</aside>`;
  }

  function renderRoster(s) {
    const all=members(s), list=filteredPeople(s);
    const pages=Math.max(1,Math.ceil(list.length/pageSize));
    ui.pageIndex=Math.max(0,Math.min(ui.pageIndex,pages-1));
    if (!list.some(p=>p.id===ui.selected)) ui.selected=list[0]?.id||null;
    const visible=list.slice(ui.pageIndex*pageSize,(ui.pageIndex+1)*pageSize);
    const peaks=[...new Map(all.map(p=>[peakKey(p),peakName(p)])).entries()];
    return `<div class="people-layout"><aside class="pane people-peaks"><h3 class="pane-title">人物归属</h3>
      ${[['all','全部人物'],...peaks].map(([id,name])=>`<button class="people-peak${ui.peak===id?' active':''}" data-system-action="people-peak" data-peak="${esc(id)}"><span>${esc(name)}</span><b>${id==='all'?all.length:all.filter(p=>peakKey(p)===id).length}</b></button>`).join('')}
      <div class="people-peak-note"><span>名册</span><strong>${all.filter(p=>p.role==='disciple').length} 位门人</strong><span>${all.filter(p=>p.role==='visitor').length} 位来访者 · ${all.filter(p=>p.atHome).length} 人在院</span></div></aside>
      <section class="pane people-roster"><div class="pane-title"><h3>人物名册</h3><span class="subtle">${list.length} 人</span></div>
      <div class="toolbar people-search"><input type="search" data-system-field="people-search" aria-label="搜索门人" placeholder="姓名、所修功法、当前事务" value="${esc(ui.query)}"></div>
      <div class="toolbar people-filter"><div class="tab-row">${[['all','全部'],['home','在院'],['attention','需休养'],['invited','有邀约']].map(([id,label])=>`<button class="${ui.filter===id?'active':''}" data-system-action="people-filter" data-filter="${id}">${label}</button>`).join('')}</div><select data-system-field="people-sort" aria-label="排列名册">${[['default','名册顺序'],['realm','修为高低'],['energy','精力由低到高']].map(([id,label])=>`<option value="${id}"${ui.sort===id?' selected':''}>${label}</option>`).join('')}</select></div>
      <div class="scroll-area people-table-wrap" data-scroll-key="people-roster-table:${ui.pageIndex}"><table class="people-table"><thead><tr><th>门人</th><th>归属 / 修为</th><th>当前事务</th><th>精力 / 身况</th></tr></thead><tbody>${visible.map(p=>`<tr class="${ui.selected===p.id?'selected':''}"><td><button class="people-person-button" data-system-action="people-select" data-person="${esc(p.id)}" aria-pressed="${ui.selected===p.id}">${portrait(p)}<span><strong>${esc(p.name)}</strong><small>${esc(roleName(p))}</small></span></button></td><td><span>${esc(peakName(p))}</span><small>${esc(realmName(p))}</small></td><td><span>${esc(actionName(p))}</span><small>${esc(locationName(p))}</small></td><td><span class="${p.energy<30?'danger':''}">${num(p.energy)??'—'}</span><small class="${knownIssue(p)?'gold':'subtle'}">${esc(knownIssue(p)|| (Number.isFinite(p.wound)?'无伤':'身况未详'))}</small></td></tr>`).join('')}</tbody></table>${!list.length?empty(all.length?'没有符合条件的门人。可调整归属、状态或搜索词。':'山院尚无门人。来访者正式入院后会记入名册。'):''}</div>
      <div class="people-pagination">${button('people-prev','上一页',ui.pageIndex===0?'disabled':'')}<span>第 ${ui.pageIndex+1} / ${pages} 页</span>${button('people-next','下一页',ui.pageIndex+1>=pages?'disabled':'')}</div></section>${summary(s,current(s))}</div>`;
  }

  function artEntry(s,p,a) {
    const definition=artById(s,a.id);
    return `<div class="people-art-entry"><div class="profile-art-focus"><span class="icon-slot">${icon(definition?.kind==='martial'?'sword':'book')}</span><div><h3>${esc(a.name||definition?.name||'所修法门')}</h3><span class="subtle">${esc(p.mainArtId===a.id?'主修心法':artKinds[definition?.kind]||'已习法门')}</span></div>${definition?button('people-art','查阅',`data-art="${esc(a.id)}" data-person="${esc(p.id)}"`):''}</div>${meter('理解',a.understanding)}${meter('熟练',a.mastery)}</div>`;
  }

  function detailBody(s,p) {
    if (ui.tab==='cultivation') return `<h3 class="pane-title">当前修行</h3>${meter('修为',p.xp,p.xpNeed)}<dl class="people-facts">${fact('境界',realmName(p))}${fact('灵根',p.root)}${fact('主修',artName(s,p.mainArtId))}</dl>${learnedArts(s,p).map(a=>artEntry(s,p,a)).join('')||empty('尚无可见修习记录。')}`;
    if (ui.tab==='equipment') return `<h3 class="pane-title">随身装备</h3>${p.equipmentSlots?`<div class="profile-equipment-list">${slots.map(slot=>{const id=p.equipmentSlots?.[slot.id],item=equipmentItem(s,id);return `<div class="data-row"><span class="icon-slot">${icon(slot.icon)}</span><div><small>${slot.label}</small><strong>${esc(id?equipmentName(item):'未佩用')}</strong></div><span class="subtle">${item&&Number.isFinite(item.condition)?`完好 ${Math.round(item.condition*100)}%`:''}</span></div>`;}).join('')}</div>`:empty('尚无可见装备记录。')}`;
    if (ui.tab==='health') return `<h3 class="pane-title">身况</h3>${vitals(p)}<div class="profile-condition"><strong>${esc(!Number.isFinite(p.wound)?'身况尚未详知':p.status==='dead'?'已故':p.wound>0?'尚有伤势':p.energy<30?'需要歇息':'身况平稳')}</strong>${activityReason(p)?`<p>${esc(activityReason(p))}</p>`:''}</div>${currentActivity(p)}<dl class="people-facts">${fact('所在',locationName(p))}${fact('日程',p.schedule?.phase ? ({rest:'休息时段',work:'劳作时段',study:'研习时段',cultivate:'修炼时段',morning:'晨间',day:'日间',night:'夜间'})[p.schedule.phase]||p.schedule.phase:null)}</dl>`;
    return `<h3 class="pane-title">人情与师承</h3>${(p.relations||[]).map(r=>`<div class="profile-relation"><span class="icon-slot">${icon('person')}</span><div><strong>${esc(r.name)} · ${esc(r.label)}</strong>${r.description?`<p>${esc(r.description)}</p>`:''}</div></div>`).join('')||empty('尚无已公开的师承与关系记录。')}<dl class="people-facts">${fact('归属',peakName(p))}${fact('职司',p.office?.name||p.office)}</dl>`;
  }

  function renderDetail(s) {
    const p=current(s);
    if (!p) return `<div class="people-detail">${button('people-back','‹ 返回名册')}${empty('此人物当前没有可查看的记录。')}</div>`;
    return `<div class="people-detail"><div class="people-detail-nav">${button('people-back','‹ 返回名册')}<span class="subtle">${esc(peakName(p))} / ${esc(p.name)}</span><div class="toolbar">${button('people-previous-person','上一位')}${button('people-next-person','下一位')}</div></div>
      <div class="people-detail-layout"><aside class="pane profile-person" data-scroll-key="people-detail-person:${esc(p.id)}"><div class="profile-person-portrait">${portrait(p,true)}</div><h2>${esc(p.name)}</h2><p class="gold">${esc(realmName(p))} · ${esc(roleName(p))}</p><p>${esc(peakName(p))}</p>${currentActivity(p)}${button('people-locate','在山院中定位',`data-person="${esc(p.id)}" ${sceneVisible(s,p)?'':'disabled'}`)}</aside>
      <section class="pane people-detail-content" data-scroll-key="people-detail-content:${esc(p.id)}:${ui.tab}"><nav class="panel-tabs">${[['cultivation','修行'],['equipment','装备'],['health','身况'],['relations','关系']].map(([id,label])=>`<button data-system-action="people-tab" data-tab="${id}" class="${ui.tab===id?'active':''}">${label}</button>`).join('')}</nav><div class="people-detail-body">${detailBody(s,p)}</div></section>${summary(s,p,true)}</div></div>`;
  }

  function equipmentBody(s,p) {
    return `<div class="profile-equipment-body"><div class="profile-body-portrait">${portrait(p,true)}</div>${slots.map(slot=>{const id=p.equipmentSlots?.[slot.id],item=equipmentItem(s,id);return `<button class="profile-equip-slot profile-slot-${slot.id}" data-system-action="people-equipment" data-item="${esc(id||'')}" aria-label="${slot.label}：${esc(id?equipmentName(item):'未佩用')}，打开行囊"><span class="subtle">${slot.label}</span><span class="icon-slot">${icon(slot.icon)}</span><strong>${esc(id?equipmentName(item):'未佩用')}</strong>${item&&Number.isFinite(item.condition)?`<small>完好 ${Math.round(item.condition*100)}%</small>`:''}</button>`;}).join('')}</div>`;
  }

  function masterArts(s,p) {
    const arts=learnedArts(s,p);
    return arts.map(a=>{const def=artById(s,a.id),kind=def?.kind||a.kind;return `<button class="profile-art-slot" data-system-action="people-art" data-art="${esc(a.id)}" data-person="${esc(p.id)}" ${def?'':'disabled'}><span class="icon-slot">${icon(kind==='martial'?'sword':'book')}</span><span><small>${esc(p.mainArtId===a.id?'主修心法':artKinds[kind]||'已习法门')}</small><strong>${esc(a.name||def?.name||'所修法门')}</strong><span class="subtle">理解 ${num(a.understanding)??'—'} · 熟练 ${num(a.mastery)??'—'}</span></span><b>›</b></button>`;}).join('')||empty('尚无可见修习记录。');
  }

  function renderMaster(s) {
    const p=master(s);
    if (!p) return empty('掌门记录尚未载入。');
    const effect=p.equipmentEffects, notice=notices.get(p.id);
    return `<div class="profile-layout"><aside class="pane profile-vitals" data-scroll-key="people-master-vitals"><h3 class="pane-title">身况</h3>${vitals(p)}<div class="profile-condition"><strong>${esc(p.wound>0?'伤势未愈':p.energy<30?'精力偏低':'气息平稳')}</strong><p>${esc(p.wound>0?'可取灵草疗伤，或查看随身丹药。':p.energy<30?'歇息片刻，恢复后再安排修行。':'可按当前事务与修行安排继续行动。')}</p></div>
      <dl class="people-facts">${fact('灵根',p.root)}${fact('所在',locationName(p))}${fact('控制',p.controlMode==='auto'?'自理':p.controlMode==='manual'?'亲控':null)}</dl>
      ${effect?`<div class="profile-stat-grid">${Number.isFinite(effect.guard)?`<div class="stat-pair"><span>装备护持</span><strong>${Math.round(effect.guard*100)}%</strong></div>`:''}${Number.isFinite(effect.healMultiplier)?`<div class="stat-pair"><span>疗愈加成</span><strong>${Math.round((effect.healMultiplier-1)*100)}%</strong></div>`:''}</div>`:''}
      <div class="toolbar">${button('people-rest','休息','',true)}${button('people-medicine','查看丹药')}</div>${p.wound>0?button('people-heal','灵草疗伤 · 6 份',p.action==='heal'?'disabled':'',true):''}
      ${notice?`<p class="people-response ${notice.kind}" role="status">${esc(notice.text)}</p>`:''}${currentActivity(p)}</aside>
      <section class="pane profile-person" data-scroll-key="people-master-equipment"><div class="profile-heading"><h2>${esc(p.name)}</h2><span>云岫掌门 · ${esc(realmName(p))}</span></div>${equipmentBody(s,p)}<div class="profile-equipment-footer"><span class="subtle">随身装备</span>${button('people-bag','打开行囊')}</div></section>
      <section class="pane profile-cultivation" data-scroll-key="people-master-cultivation"><h3 class="pane-title">修行</h3>${meter('修为',p.xp,p.xpNeed)}<div class="profile-realm"><strong>${esc(realmName(p))}</strong>${Number.isFinite(p.xp)&&Number.isFinite(p.xpNeed)?`<span class="subtle">${p.xp>=p.xpNeed?'修为积累已足':`距当前层积累所需尚差 ${num(p.xpNeed-p.xp)}`}</span>`:''}</div><div class="profile-config">${masterArts(s,p)}</div><div class="profile-practice">${p.wound>0?'<p>伤势恢复后可继续修炼。</p>':''}${button('people-practice',p.action==='cultivate'?'结束修炼':'开始修炼',p.wound>0?'disabled':'',true)}</div></section></div>`;
  }

  function commandNotice(id, command, fallback) {
    const result=send(command);
    const value=result?.result;
    if (!result?.ok) notices.set(id,{kind:'danger',text:result?.error||'此事暂未办成。'});
    else if (value?.accepted===false) notices.set(id,{kind:'gold',text:value.publicReason||value.reason||'本人暂未应下这份邀约。'});
    else notices.set(id,{kind:'good',text:value?.publicReason||value?.reason||(value?.pending?'已安排，等待实际行动。':fallback)});
    return result;
  }

  function choosePerson(s,id) {
    const p=personById(s,id);
    if (!p) return false;
    ui.selected=id; ui.workplace=null;
    if (sceneVisible(s,p)) selectPerson(id);
    return true;
  }

  function click(element) {
    const d=element.dataset, action=d.systemAction;
    if (!action?.startsWith('people-')) return false;
    if (element.disabled) return true;
    const s=state(), p=personById(s,d.person)||current(s), m=master(s);
    if (action==='people-peak') {ui.peak=d.peak;ui.pageIndex=0;}
    else if (action==='people-filter') {ui.filter=d.filter;ui.pageIndex=0;}
    else if (action==='people-select') choosePerson(s,d.person);
    else if (action==='people-prev') ui.pageIndex=Math.max(0,ui.pageIndex-1);
    else if (action==='people-next') ui.pageIndex++;
    else if (action==='people-detail') {if(p){choosePerson(s,p.id);ui.detail=true;ui.tab='cultivation';}}
    else if (action==='people-back') ui.detail=false;
    else if (action==='people-tab') ui.tab=d.tab;
    else if (action==='people-previous-person'||action==='people-next-person') {const list=filteredPeople(s);if(list.length){const i=list.findIndex(q=>q.id===ui.selected);choosePerson(s,list[(i+(action==='people-next-person'?1:-1)+list.length)%list.length].id);}}
    else if (action==='people-locate') {if(p&&sceneVisible(s,p)){selectPerson(p.id);open('scene',{person:p.id});}}
    else if (action==='people-invite') {if(p&&d.workplace)commandNotice(p.id,{name:'inviteWork',args:[p.id,d.workplace]},'本人已应下邀约，将按约安排这份差事。');}
    else if (action==='people-art') {if(artById(s,d.art))open('arts',{art:d.art,person:d.person,from:ui.page,returnPerson:d.person});}
    else if (action==='people-equipment') open('bag',{itemId:d.item||undefined,selected:d.item||undefined,category:'装备'});
    else if (action==='people-bag') open('bag');
    else if (action==='people-medicine') open('bag',{category:'丹药'});
    else if (action==='people-rest'&&m) commandNotice(m.id,{name:'masterAction',args:['rest']},'已安排休息。');
    else if (action==='people-heal'&&m) commandNotice(m.id,{name:'masterAction',args:['heal']},'已取灵草疗伤。');
    else if (action==='people-practice'&&m) commandNotice(m.id,{name:'masterAction',args:[m.action==='cultivate'?'rest':'cultivate']},m.action==='cultivate'?'已收功休息。':'已安排修炼，待到达修行处。');
    else return false;
    return true;
  }

  function input(element) {
    const field=element.dataset.systemField;
    if (field==='people-search') {ui.query=element.value;ui.pageIndex=0;}
    else if (field==='people-sort') {ui.sort=element.value;ui.pageIndex=0;}
    else if (field==='people-workplace') ui.workplace=element.value;
    else return false;
    return true;
  }

  function enter(page,params={}) {
    ui.page=page;
    if (params.person) {
      ui.selected=params.person;
      if(page==='disciples')ui.detail=true;
    }
    if (params.detail!==undefined) ui.detail=Boolean(params.detail);
    if (params.tab && ['cultivation','equipment','health','relations'].includes(params.tab)) ui.tab=params.tab;
  }

  return {render(page) {ui.page=page;const s=state();return `<div class="system-people" data-scroll-key="people-viewport:${page==='master'?'master':ui.detail?'detail:'+esc(ui.selected):'roster'}">${page==='master'?renderMaster(s):ui.detail?renderDetail(s):renderRoster(s)}</div>`;}, click, input, enter};
}
