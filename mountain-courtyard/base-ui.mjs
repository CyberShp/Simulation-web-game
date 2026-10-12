/** U-120: system windows read the shared simulation and issue its public commands. */
import {createPeoplePanels} from './system-people.mjs?v=99194c505dfc';
import {createInventoryPanel} from './system-inventory.mjs?v=99194c505dfc';
import {createCraftingPanel} from './system-crafting.mjs?v=99194c505dfc';
import {createSectPanel} from './system-sect.mjs?v=99194c505dfc';
import {createWorldPanel} from './system-world.mjs?v=99194c505dfc';
import {createBattleUI} from './battle-ui.mjs?v=99194c505dfc';
import {escape as esc, amount, icon, portrait, bar} from './system-ui-helpers.mjs?v=99194c505dfc';

export function startPaintedGameUI(host) {
  const $ = selector => document.querySelector(selector);
  const panel=$('#dossier'), content=$('#panel-content'), notice=$('#notice');
  const labels={jade:'灵石',wood:'木料',stone:'石料',herb:'灵草',food:'食粮'};
  const titles={disciples:'门人',master:'掌门',arts:'功法',bag:'行囊',crafts:'百艺',tasks:'任务',world:'山外',sect:'宗务',archive:'存档'};
  const artKinds={main:'主修心法',support:'辅修法门',spell:'术法',martial:'武学',movement:'身法',production:'百艺'};
  const orderPhases={proposed:'待安排',reserved:'已预约',navigating:'前往书案',preparing:'准备研习',executing:'正在研习',waiting:'等待条件',interrupted:'已中断'};
  let tab='home', artId='qingyuan', artSource=null, lastBody='', rendered=false, pointerHeld=false, noticeTimer;
  const view=()=>JSON.parse(host.snapshot_json());
  const tell=(message,error=false)=>{
    const text=String(message||'此事暂未办成').replace(/^command[:：]\s*/,'');
    notice.textContent=text; notice.dataset.error=String(error); notice.dataset.active='true';
    $('#panel-feedback').textContent=text; $('#panel-feedback').classList.toggle('danger',error);
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.dataset.active='false',4500);
  };
  const send=command=>{
    const payload=command.type==='select'?command:{...JSON.parse(host.command_context()),...command};
    const result=JSON.parse(host.command(JSON.stringify(payload)));
    const rejected=!result.ok||result.result===false||result.result?.accepted===false;
    tell(!result.ok?result.error:result.result?.publicReason||result.result?.reason||(result.result===false?'此时无法办理':command.type==='select'?host.notice():'已记下这项安排'),rejected);
    update(true); return result;
  };
  const selectPerson=id=>{
    if(view().people.some(p=>p.id===id)) return send({type:'select',kind:'person',id});
    return {ok:true};
  };
  const context={getState:view,send,open,close,selectPerson,escape:esc,icon,portrait,bar};
  const people=createPeoplePanels(context), bag=createInventoryPanel(context), crafting=createCraftingPanel(context), sect=createSectPanel(context);
  const world=createWorldPanel(context), battle=createBattleUI(context);
  function close() {
    tab='home';panel.hidden=true;$('#system-shade').hidden=true;document.body.classList.remove('system-panel-open');
    document.querySelectorAll('#system-nav [data-tab]').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});
    $('#canvas').focus({preventScroll:true});lastBody='';
  }
  function open(page,params={}) {
    if(page==='scene'||page==='home'){close();if(params.person)window.paintedCourtyardCommand?.('focus_person',params.person);return}
    if(page==='archive'&&params.inventory)page='bag';
    if(!titles[page])return;
    tab=page;lastBody='';$('#panel-feedback').textContent='';
    document.getElementById('estate-panel').hidden=true;
    if(page==='disciples'||page==='master')people.enter?.(page,{...params,person:params.person||params.personId});
    if(page==='bag')bag.enter?.(params);
    if(page==='crafts')crafting.enter?.(params);
    if(page==='sect')sect.enter?.(params);
    if(page==='world')world.enter?.(params);
    if(page==='arts'){artId=params.art||params.artId||artId;artSource=params.from?params:null}
    panel.hidden=false;$('#system-shade').hidden=false;document.body.classList.add('system-panel-open');
    update(true);
    $('#close-panel').focus({preventScroll:true});
  }
  // Keep controls in place while live values change, including a pointer already over a button.
  function patchChildren(parent, next) {
    const count=Math.max(parent.childNodes.length,next.childNodes.length);
    for(let i=0;i<count;i++) {
      const current=parent.childNodes[i],incoming=next.childNodes[i];
      if(!incoming){while(parent.childNodes.length>i)parent.lastChild.remove();break}
      if(!current){parent.append(incoming.cloneNode(true));continue}
      if(current.nodeType!==incoming.nodeType||current.nodeName!==incoming.nodeName){current.replaceWith(incoming.cloneNode(true));continue}
      if(current.nodeType===Node.TEXT_NODE){if(current.data!==incoming.data)current.data=incoming.data;continue}
      if(current.nodeType!==Node.ELEMENT_NODE)continue;
      for(const attr of [...current.attributes])if(!incoming.hasAttribute(attr.name))current.removeAttribute(attr.name);
      for(const attr of incoming.attributes)if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
      patchChildren(current,incoming);
      if(current.nodeName==='INPUT'&&incoming.hasAttribute('value')&&current.value!==incoming.value)current.value=incoming.value;
      if(current.nodeName==='OPTION'&&current.selected!==incoming.selected)current.selected=incoming.selected;
    }
  }
  function update(force=false) {
    const state=view();
    document.body.classList.toggle('opening-inheritance-active',state.openingInheritance?.status==='pending');
    if(state.openingInheritance?.status==='pending'&&tab!=='home')close();
    $('#time').textContent=state.timeLabel;
    const resourceHTML=Object.entries(labels).map(([id,name])=>`<span class="resource" title="公库 · ${name}">${icon(id)}${amount(state.resources[id]??0)}</span>`).join('');
    if($('#resources').innerHTML!==resourceHTML)$('#resources').innerHTML=resourceHTML;
    const master=state.systemPeople?.persons.find(p=>p.id===state.masterId)||state.roster.find(p=>p.id===state.masterId);
    $('#master-hud-name').textContent=master?.name||'掌门';
    $('#master-hud-realm').textContent=master?.realmLabel||`炼气 ${master?.realm??''} 层`;
    const face=portrait(master);if($('#master-hud-portrait').innerHTML!==face)$('#master-hud-portrait').innerHTML=face;
    $('#pause').textContent=state.paused?'▶':'Ⅱ';$('#pause').setAttribute('aria-pressed',String(state.paused));
    document.querySelector('.nameplate small').textContent=state.world?.scene?.name|| (state.sceneId==='scene:travel'?'云岫山道':'云岫山院');
    document.body.classList.toggle('in-battle',!!state.combat);
    document.body.classList.toggle('on-mountain-road',state.sceneId==='scene:travel');
    $('#travel-veil').hidden=state.sceneId!=='scene:travel';
    $('#travel-remaining').textContent=`尚余 ${Math.ceil((state.world?.travel?.remainingTicks||0)/10)} 息`;
    $('#battle-hud').hidden=!state.combat;
    const combatMarkup=document.createElement('template');combatMarkup.innerHTML=battle.render();
    patchChildren($('#battle-hud'),combatMarkup.content);
    if(tab==='home')return;
    if(pointerHeld&&!force)return;
    const signature=JSON.stringify({tab,people:state.systemPeople,inventory:state.inventory,crafting:state.crafting,harvest:state.harvest,market:state.market,world:state.world,combat:state.combat,arts:state.arts,orders:state.cultivationOrders,buildings:state.buildings,message:state.message,story:state.openingStory,resources:state.resources,goal:tab==='tasks'?[$('#goal-title').textContent,$('#goal-copy').textContent,$('#goal-action').textContent,$('#goal-action').hidden]:null});
    if(!force&&signature===lastBody)return;
    lastBody=signature;
    const focus=document.activeElement,field=focus?.dataset.systemField,start=focus?.selectionStart,end=focus?.selectionEnd;
    const scroll=[...content.querySelectorAll('[data-scroll-key]')].map(el=>[el.dataset.scrollKey,el.scrollTop]);
    const top=content.scrollTop;
    rendered=true;
    const markup=tab==='disciples'||tab==='master'?people.render(tab):tab==='bag'?bag.render():tab==='crafts'?crafting.render():tab==='sect'?sect.render():tab==='world'?world.render():tab==='arts'?arts(state):tab==='archive'?archive():overview(state);
    const next=document.createElement('template');next.innerHTML=markup;
    patchChildren(content,next.content);
    rendered=false;
    content.dataset.page=tab;$('#panel-title').textContent=titles[tab];content.scrollTop=top;
    for(const [key,y] of scroll){const el=[...content.querySelectorAll('[data-scroll-key]')].find(el=>el.dataset.scrollKey===key);if(el)el.scrollTop=y}
    if(field){const next=[...content.querySelectorAll('[data-system-field]')].find(el=>el.dataset.systemField===field);next?.focus({preventScroll:true});if(next?.setSelectionRange&&typeof start==='number'&&['text','search','textarea'].includes(next.type||next.localName))next.setSelectionRange(start,end)}
    document.querySelectorAll('#system-nav [data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
  }
  const meter=(name,value)=>bar(name,value,100);
  function arts(state) {
    const available=state.arts.filter(a=>a.access);
    if(!available.some(a=>a.id===artId))artId=available[0]?.id;
    const art=available.find(a=>a.id===artId);
    if(!art)return `<div class="live-overview"><section class="pane">${icon('book')}<h3>藏经</h3><p>尚未取得典籍。</p><button class="game-button" data-tab="master">查看掌门</button></section></div>`;
    const active=state.cultivationOrders.filter(o=>o.artId===art.id),students=state.roster.filter(p=>p.role==='disciple'&&p.atHome);
    return `<div class="live-arts"><aside class="pane"><h3 class="pane-title">本门藏经</h3>${available.map(a=>`<button class="art-tab" data-art="${esc(a.id)}" aria-pressed="${a.id===artId}">${esc(a.name)}</button>`).join('')}${artSource?'<button class="game-button" data-art-return>返回人物</button>':''}</aside><article class="pane"><div class="manual-art"><span class="manual-cover-title">${esc(art.name)}</span></div><h2>${esc(art.name)}</h2><p class="art-kind">${esc(artKinds[art.kind]||art.kind)}</p><p class="art-source">${esc(art.source)}</p>${meter('理解',art.understanding)}${meter('熟练',art.mastery)}<p class="subtle">${art.teaching?.qualified?'此卷可授门人。':esc(art.teaching?.reason||'尚待研习')}</p><button class="primary-action" data-study="${esc(art.id)}" ${state.cultivationOrders.some(o=>o.kind==='study')?'disabled':''}>掌门研习</button></article><aside class="pane"><h3 class="pane-title">修习事务</h3>${active.map(o=>`<div class="order">${o.kind==='study'?'掌门研习':o.kind==='teach'?'门人授业':'转修'} · ${esc(orderPhases[o.phase]||o.phase)}${bar('进度',o.progressTicks||0,o.durationTicks||1)}<p>${esc(o.reason||'')}</p><button class="secondary-action" data-cancel="${esc(o.id)}">中止安排</button></div>`).join('')||'<p class="subtle">当前无修习安排。</p>'}${students.length?`<h3 class="pane-title">门人授业</h3>${students.map(p=>`<button class="secondary-action" data-teach="${esc(art.id)}" data-student="${esc(p.id)}">邀请 ${esc(p.name)} 研习</button>`).join('')}`:''}</aside></div>`;
  }
  function archive(){return `<div class="live-archive"><button class="game-button primary" data-save>保存进度</button><button class="game-button" data-reload>读取档案</button><button class="game-button" data-export>导出存档</button><button class="game-button" data-import>导入存档</button></div>`}
  function overview(state){
    const siteButton=b=>`<button class="game-button" data-live-building="${esc(b.id)}">查看${esc(b.name)}</button>`;
    if(tab==='tasks')return `<div class="live-overview"><section class="pane">${icon('scroll')}<h3>${esc($('#goal-title').textContent)}</h3><p>${esc($('#goal-copy').textContent)}</p>${!$('#goal-action').hidden?`<button class="game-button primary" data-current-goal>${esc($('#goal-action').textContent)}</button>`:''}</section><section class="pane"><h3>山院近况</h3>${state.construction?bar('工程',Math.round(state.construction.progress*100),100):'<p class="subtle">目前没有营造中的工程。</p>'}${state.buildings.map(b=>`<div class="data-row"><span>${esc(b.name)}</span>${siteButton(b)}</div>`).join('')}</section></div>`;
    if(tab==='crafts'){const facilities=state.buildings.filter(b=>['alchemy','workshop','forge'].includes(b.type));return `<div class="live-overview"><section class="pane">${icon('cauldron')}<h3>丹房</h3>${facilities.filter(b=>b.type==='alchemy').map(siteButton).join('')||'<p class="subtle">院中尚无丹房。</p>'}<button class="game-button" data-live-build>查看营造地</button></section><section class="pane">${icon('forge')}<h3>百工坊</h3>${facilities.filter(b=>b.type!=='alchemy').map(siteButton).join('')||'<p class="subtle">院中尚无百工坊。</p>'}<button class="game-button" data-tab="bag">查看用料</button></section></div>`}
    if(tab==='world')return `<div class="live-overview"><section class="pane">${icon('mountain')}<h3>云岫山院</h3><p>群峰环抱，山道从院前延伸。</p><button class="game-button primary" data-live-home>回望山院</button></section><section class="pane"><h3>在外门人</h3>${state.roster.filter(p=>!p.atHome).map(p=>`<div class="data-row"><span>${esc(p.name)}</span><button class="game-button" data-live-person="${esc(p.id)}">查看近况</button></div>`).join('')||'<p class="subtle">门人皆在院中。</p>'}</section></div>`;
    return `<div class="live-overview"><section class="pane"><h3>院中事务</h3>${state.buildings.map(b=>`<div class="data-row"><span>${esc(b.name)}</span>${siteButton(b)}</div>`).join('')}<button class="game-button" data-tab="disciples">查看门人</button></section><section class="pane"><h3>公库</h3>${Object.entries(labels).map(([id,name])=>`<div class="data-row"><span>${name}</span><b>${amount(state.resources[id]||0)}</b></div>`).join('')}<button class="game-button" data-tab="bag">查看物资</button></section></div>`;
  }
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.hasAttribute('data-battle-action')){if(battle.click(button))update(true);return;}
    if(button.dataset.tab&&!button.hasAttribute('data-system-action')){open(button.dataset.tab);return}
    if(button.id==='close-panel'){close();return}
    if(button.hasAttribute('data-system-action')){
      const handled=(tab==='disciples'||tab==='master')?people.click(button):tab==='bag'?bag.click(button):tab==='crafts'?crafting.click(button):tab==='sect'?sect.click(button):tab==='world'?world.click(button):false;
      if(handled)update(true);return;
    }
    if(button.dataset.art){artId=button.dataset.art;update(true)}
    else if(button.hasAttribute('data-art-return'))open(artSource?.from||'disciples',{person:artSource?.person,personId:artSource?.person});
    else if(button.dataset.study)send({name:'studyArt',args:[button.dataset.study]});
    else if(button.dataset.teach)send({name:'teachArt',args:[button.dataset.teach,button.dataset.student]});
    else if(button.dataset.cancel)send({name:'cancelCultivationOrder',args:[button.dataset.cancel]});
    else if(button.hasAttribute('data-save')){const r=JSON.parse(host.save_slot());tell(r.message||'进度已保存',!r.ok)}
    else if(button.hasAttribute('data-reload')){Promise.resolve(host.reload_slot()).then(()=>{update(true);tell(host.notice()||'档案已读取')}).catch(e=>tell(e.message,true))}
    else if(button.hasAttribute('data-export')){host.download_save();tell(host.notice())}
    else if(button.hasAttribute('data-import'))host.import_save();
    else if(button.hasAttribute('data-current-goal')){close();$('#goal-action').click()}
    else if(button.hasAttribute('data-live-building')){close();window.estateGameSelect?.('building',button.dataset.liveBuilding)}
    else if(button.hasAttribute('data-live-person'))open('disciples',{personId:button.dataset.livePerson});
    else if(button.hasAttribute('data-live-build')||button.id==='build-tool'){close();window.estateGameOpenSite?.()}
    else if(button.hasAttribute('data-live-home')){close();window.paintedCourtyardCommand?.('follow')}
  });
  for(const eventType of ['input','change'])content.addEventListener(eventType,event=>{
    if(rendered)return;const input=event.target;if(!input.dataset.systemField)return;
    const handled=(tab==='disciples'||tab==='master')?people.input(input,eventType):tab==='bag'?bag.input(input,eventType):tab==='crafts'?crafting.input(input,eventType):tab==='sect'?sect.input(input,eventType):tab==='world'?world.input(input,eventType):false;
    if(handled)update(true);
  });
  document.addEventListener('pointerdown',event=>{if(panel.contains(event.target))pointerHeld=true});
  document.addEventListener('pointerup',()=>{pointerHeld=false});
  document.addEventListener('pointercancel',()=>{pointerHeld=false});
  $('#system-shade').addEventListener('click',close);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){close();$('#estate-panel').hidden=true;return}
    if(['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
    const pages=['disciples','arts','bag','crafts','tasks','world','sect'];if(/^[1-7]$/.test(event.key))open(pages[Number(event.key)-1]);
  });
  $('#zoom-out').addEventListener('click',()=>window.paintedCourtyardCommand?.('zoom_out'));
  $('#zoom-in').addEventListener('click',()=>window.paintedCourtyardCommand?.('zoom_in'));
  $('#follow').addEventListener('click',()=>window.paintedCourtyardCommand?.('follow'));
  $('#pause').addEventListener('click',()=>send({type:'pause',paused:!view().paused}));
  window.paintedGameSelect=(kind,id)=>{send({type:'select',kind,id});if(kind==='person')open(id===view().masterId?'master':'disciples',{personId:id,person:id})};
  window.paintedGameMove=(x,y)=>send({type:'move',x,y});
  window.estateWorldSelect=(kind,id)=>open('world',{kind,id});
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
  return {open,close,tell};
}
