/** Painted courtyard game HUD. All displayed progression comes from the shared simulation host. */
export function startPaintedGameUI(host) {
  const $ = selector => document.querySelector(selector);
  const panel = $('#dossier'), content = $('#panel-content'), notice = $('#notice');
  const labels = {jade:['玉','灵石'],wood:['木','木料'],stone:['石','石料'],herb:['草','灵草'],food:['谷','食粮']};
  const activities = {groundRest:'休憩',rest:'休息',heal:'疗伤',walk:'行走',study:'研习',work:'劳作',cultivate:'修炼',construct:'营造',carry:'搬运',wait:'等候',idle:'在院'};
  const artKinds = {main:'主修心法',support:'辅修法门',spell:'术法',movement:'身法',production:'生产技艺'};
  const orderPhases = {proposed:'待安排',reserved:'已预约',navigating:'前往书案',preparing:'准备研习',executing:'正在研习',waiting:'等待条件',interrupted:'已中断'};
  let tab = 'home', personId = 'person:master', artId = 'qingyuan', lastBody = '', lastSelection = '';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const view = () => JSON.parse(host.snapshot_json());
  const send = command => {
    const payload = command.type === 'select' ? command : {...JSON.parse(host.command_context()),...command};
    const result = JSON.parse(host.command(JSON.stringify(payload)));
    if (!result.ok) tell(result.error, true);
    else if (result.result?.accepted === false) tell(result.result.reason, true);
    else tell(host.notice() || '操作已记录');
    update(true);
    return result;
  };
  const tell = (message, error = false) => {notice.textContent=String(message||'操作未完成').replace(/^command[:：]\s*/, '');notice.dataset.error=String(error)};
  function update(force = false) {
    const state = view();
    $('#time').textContent=state.timeLabel;
    $('#resources').innerHTML=Object.entries(labels).map(([id,[icon,title]]) => `<span class="resource" title="${title}"><i>${icon}</i>${esc(state.resources[id] ?? 0)}</span>`).join('');
    $('#pause').textContent=state.paused?'▶':'Ⅱ';
    $('#pause').setAttribute('aria-pressed',String(state.paused));
    document.querySelectorAll('.rail-item').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.tab===tab)));
    panel.hidden=tab==='home';
    if (tab==='home') return;
    const body=JSON.stringify(tab==='disciples'?{tab,personId,
      roster:state.roster.map(({wound,energy,...person})=>({...person,wound:Math.ceil(wound||0)})),
      people:state.people.map(({id,name,appearance,activity})=>({id,name,appearance,activity})),
      arts:state.arts.map(({id,name})=>({id,name}))}:
      tab==='arts'?{tab,artId,arts:state.arts,
        students:state.roster.filter(p=>p.role==='disciple').map(({id,name,atHome})=>({id,name,atHome})),
        orders:state.cultivationOrders.map(({progressTicks,...order})=>({...order,progressTicks:Math.floor((progressTicks||0)/10)*10}))}:
      {tab,message:state.message,rosterLength:state.roster.length,buildingsLength:state.buildings.length});
    if (!force && body===lastBody) return;
    lastBody=body;
    $('#panel-title').textContent={disciples:'门人志',arts:'功法谱',archive:'山院档案'}[tab];
    content.innerHTML=tab==='disciples'?disciples(state):tab==='arts'?arts(state):archive(state);
  }
  const meter = (name,value,extra='') => `<div class="meter-row"><span>${name}</span><div class="meter ${extra}"><span style="width:${Math.max(0,Math.min(100,Number(value)||0))}%"></span></div><b>${esc(value)}%</b></div>`;
  const personArts = (person,state) => (person.arts||[]).map(a => `${esc(state.arts.find(art=>art.id===a.id)?.name||a.id)} · 理解 ${a.understanding}% · 熟练 ${a.mastery}%`).join('、')||'尚无可见修习记录';
  function disciples(state) {
    const visitor=state.people.find(p=>p.id==='person:lu-zhiwei'&&!state.roster.some(r=>r.id===p.id));
    const candidates=[...state.roster,...(visitor?[{id:visitor.id,name:visitor.name,role:'visitor',realm:null,action:visitor.activity,atHome:true,appearance:visitor.appearance,arts:[]}]:[])];
    if (!candidates.some(p=>p.id===personId)) personId=candidates[0]?.id;
    const person=candidates.find(p=>p.id===personId);
    if (!person) return '<p class="empty">当前没有可查看的人物。</p>';
    const role=person.role==='master'?'掌门':person.role==='visitor'?'来访者':'门人';
    const action=activities[person.action]||person.action||'在院';
    const tabs=`<div class="person-tabs">${candidates.map(p=>`<button class="person-tab" data-person="${esc(p.id)}" aria-pressed="${p.id===personId}">${esc(p.name)}</button>`).join('')}</div>`;
    const portraitIndex=Number.isInteger(person.appearance)&&person.appearance>=0&&person.appearance<6?person.appearance:null;
    const portrait=portraitIndex===null?`<div class="portrait" aria-label="${esc(person.name)}名牌">${esc(person.name.slice(-1))}</div>`:
      `<div class="portrait has-art" style="--portrait-x:${portraitIndex%3*50}%;--portrait-y:${Math.floor(portraitIndex/3)*100}%" aria-label="${esc(person.name)}肖像"></div>`;
    return `${tabs}${portrait}
      <h3 class="person-name">${esc(person.name)}</h3><p class="subline">${role} · ${person.atHome?'在院':'外出'} · ${esc(action)}</p>
      <div class="information"><div>境界<b>${person.realm==null?'尚未入宗':`炼气 ${esc(person.realm)} 层`}</b></div><div>当前状态<b>${person.wound>0?`伤势 ${Math.ceil(person.wound)}`:esc(action)}</b></div></div>
      <h4 class="section-label">修习</h4><p class="quiet">${personArts(person,state)}</p>
      ${person.role==='visitor'?'<p class="lore">陆知微仍是来访者；是否入宗由正式剧情决定。</p>':''}
      ${person.role!=='visitor'?`<button class="primary-action" data-open-art="${esc(person.mainArtId||'qingyuan')}">查看所习功法</button>`:''}`;
  }
  function arts(state) {
    const available=state.arts.filter(a=>a.access);
    if (!available.some(a=>a.id===artId)) artId=available[0]?.id;
    const art=available.find(a=>a.id===artId);
    if (!art) return '<p class="empty">当前没有可查看的功法。</p>';
    const active=state.cultivationOrders.filter(o=>o.artId===art.id);
    const students=state.roster.filter(p=>p.role==='disciple'&&p.atHome);
    const canStudy=art.access&&!state.cultivationOrders.some(o=>o.kind==='study');
    return `<div class="art-list">${available.map(a=>`<button class="art-tab" data-art="${esc(a.id)}" aria-pressed="${a.id===artId}">${esc(a.name)}</button>`).join('')}</div>
      <p class="art-kind">${esc(artKinds[art.kind]||art.kind)} · ${art.access?'已获典籍':'尚未取得'}</p><h3 class="art-name">${esc(art.name)}</h3><p class="art-source">${esc(art.source)}</p>
      ${meter('理解',art.understanding)}${meter('熟练',art.mastery,'mastery')}
      <p class="lore">${art.access?'典籍已在山院，可安排掌门实际研习。':'取得来源：'+esc(art.source)}<br>${art.teaching?.qualified?'掌门已具备授业资格。':'授业条件：'+esc(art.teaching?.reason||'尚未满足')}</p>
      ${active.map(o=>`<div class="order">${o.kind==='study'?'掌门研习':o.kind==='teach'?'门人授业':'转修'} · ${esc(orderPhases[o.phase]||o.phase)} · ${esc(o.progressTicks||0)} / ${esc(o.durationTicks||0)}${o.reason?`<br>${esc(o.reason)}`:''}<button class="secondary-action" data-cancel="${esc(o.id)}">中止安排</button></div>`).join('')}
      <button class="primary-action" data-study="${esc(art.id)}" ${canStudy?'':'disabled'}>${art.access?'安排研习':'尚未取得'}</button>
      ${students.length?`<h4 class="section-label">门人授业</h4><p class="quiet">授业会核对掌门的理解、熟练、门人状态与意愿。</p>${students.map(p=>`<button class="secondary-action" data-teach="${esc(art.id)}" data-student="${esc(p.id)}">邀请 ${esc(p.name)} 研习</button>`).join('')}`:''}`;
  }
  function archive(state) {
    return `<h3 class="art-name">云岫山院</h3><p class="lore">${esc(state.message)}</p><div class="information"><div>宗门成员<b>${state.roster.length} 人</b></div><div>建筑记录<b>${state.buildings.length} 处</b></div></div><p class="quiet">此处使用独立预览档，不影响正式游戏三个档位。</p><button class="primary-action" data-save>保存进度</button><button class="secondary-action" data-reload>读取预览档</button><button class="secondary-action" data-export>导出存档</button><button class="secondary-action" data-import>导入存档</button>`;
  }
  document.addEventListener('click',event => {
    const button=event.target.closest('button');
    if (!button) return;
    if (button.dataset.tab) {tab=button.dataset.tab;lastBody='';update(true)}
    else if (button.id==='close-panel') {tab='home';update(true)}
    else if (button.dataset.person) {personId=button.dataset.person;send({type:'select',kind:'person',id:personId})}
    else if (button.dataset.openArt) {artId=button.dataset.openArt;tab='arts';update(true)}
    else if (button.dataset.art) {artId=button.dataset.art;update(true)}
    else if (button.dataset.study) send({name:'studyArt',args:[button.dataset.study]});
    else if (button.dataset.teach) send({name:'teachArt',args:[button.dataset.teach,button.dataset.student]});
    else if (button.dataset.cancel) send({name:'cancelCultivationOrder',args:[button.dataset.cancel]});
    else if (button.hasAttribute('data-save')) {const result=JSON.parse(host.save_slot());tell(result.message||'当前进度已保存',!result.ok)}
    else if (button.hasAttribute('data-reload')) {host.reload_slot();tell('正在读取预览档')}
    else if (button.hasAttribute('data-export')) host.download_save();
    else if (button.hasAttribute('data-import')) host.import_save();
  });
  $('#zoom-out').addEventListener('click',()=>window.paintedCourtyardCommand?.('zoom_out'));
  $('#zoom-in').addEventListener('click',()=>window.paintedCourtyardCommand?.('zoom_in'));
  $('#follow').addEventListener('click',()=>window.paintedCourtyardCommand?.('follow'));
  $('#pause').addEventListener('click',()=>send({type:'pause',paused:!view().paused}));
  window.paintedGameSelect=(kind,id)=>{send({type:'select',kind,id});if(kind==='person'){personId=id;tab='disciples';update(true)}};
  window.paintedGameMove=(x,y)=>send({type:'move',x,y});
  window.paintedGamePause=()=>send({type:'pause',paused:!view().paused});
  window.paintedGameNotice=message=>tell(message,true);
  document.addEventListener('visibilitychange',()=>window.paintedCourtyardCommand?.(document.hidden?'background':'foreground'));
  window.addEventListener('pagehide',()=>window.paintedCourtyardCommand?.('background'));
  window.addEventListener('pageshow',()=>window.paintedCourtyardCommand?.(document.hidden?'background':'foreground'));
  // Touch gestures are handled by Godot; two-finger pinch is converted to its camera command.
  let pinch=0;
  const canvas=$('#canvas'), span=touches=>Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
  canvas.addEventListener('touchstart',e=>{if(e.touches.length===2){pinch=span(e.touches);window.paintedCourtyardCommand?.('gesture_start');e.preventDefault()}},{passive:false});
  canvas.addEventListener('touchmove',e=>{if(pinch&&e.touches.length===2){e.preventDefault();const next=span(e.touches),r=canvas.getBoundingClientRect();window.paintedCourtyardCommand?.('gesture_zoom',next/pinch,((e.touches[0].clientX+e.touches[1].clientX)/2-r.left)/r.width,((e.touches[0].clientY+e.touches[1].clientY)/2-r.top)/r.height);pinch=next}},{passive:false});
  canvas.addEventListener('touchend',e=>{if(e.touches.length<2&&pinch){pinch=0;window.paintedCourtyardCommand?.('gesture_end')}},{passive:false});
  update(true);
  setInterval(()=>update(),220);
}
