import {startPaintedGameUI} from './base-ui.mjs?v=ea-issue6-history-20261012-r1';
import {BUILDINGS, STAGE_NAMES} from './runtime/ea-data.mjs?v=ea-issue6-history-20261012-r1';
import {HALL_ESTABLISH_COST} from './runtime/ea-sr-spatial.mjs?v=ea-issue6-history-20261012-r1';

/** Mountain courtyard construction surface. Character and art rules stay in base-ui. */
export function startEstateGameUI(host, layout) {
  const systemUI=startPaintedGameUI(host);
  const panel=document.getElementById('estate-panel');
  const content=document.getElementById('estate-content');
  const notice=document.getElementById('notice');
  const sites=layout.sites||[];
  const siteById=id=>sites.find(site=>site.id===id);
  const snapshot=()=>JSON.parse(host.snapshot_json());
  const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const resources={jade:'灵石',wood:'木料',stone:'石料',herb:'灵草',food:'食粮'};
  const costText=cost=>Object.entries(cost||{}).filter(([,amount])=>amount>0).map(([id,amount])=>(resources[id]||id)+' '+amount).join(' · ')||'无';
  const missingCost=(state,cost)=>Object.entries(cost||{}).filter(([id,amount])=>(state.resources[id]||0)<amount).map(([id])=>resources[id]||id);
  const actualAt=(state,site)=>site&&state.buildings.find(building=>building.type===site.type&&building.x===site.x&&building.y===site.y);
  const stageText={shelter:'暂栖',damaged:'待修',complete:'已落成',foundation:'清地立基',structure:'木石成架',finishing:'屋檐将合',upgrade:'扩建中'};
  const cropNotes={growing:'种苗已入畦，新芽正在生长。',mature:'药叶渐丰，还需有人继续照看。','ripe/waiting':'药草已经长成，待田边收下。','paused:waterlogged':'畦中积水，待水退后再照看。','paused:facility':'田地暂不可用，照料已停下。',harvested:'这一畦已经收下。'};
  let selectedSite='site:main-house',selectedBuilding=null,selectedStory=false,body='';

  function send(command) {
    const payload={...JSON.parse(host.command_context()),...command};
    const result=JSON.parse(host.command(JSON.stringify(payload)));
    const message=result.ok?(result.result?.accepted===false?String(result.result.publicReason||result.result.reason||'此事暂未应下'):result.result?.publicReason||host.notice()||'此事已记下'):String(result.error||'此事暂未办成');
    systemUI.tell(message,!result.ok||result.result===false||result.result?.accepted===false);
    render(true);
    return result;
  }

  function goal(state) {
    const master=state.roster.find(person=>person.role==='master');
    const hall=state.buildings.find(building=>building.type==='hall');
    const hallPhase=state.openingHallPhase||'complete';
    const story=state.openingStory||{};
    const terrace=state.herbTerrace||{};
    const field=actualAt(state,siteById('site:herb-terrace'));
    const lumber=actualAt(state,siteById('site:timber-grove'));
    const title=document.getElementById('goal-title');
    const copy=document.getElementById('goal-copy');
    const action=document.getElementById('goal-action');
    document.getElementById('build-tool').hidden=state.sceneId!=='scene:yunxiu-courtyard';
    if(state.sceneId==='scene:travel'){
      title.textContent='行在山间';copy.textContent='沿山道而行。';
      action.hidden=false;action.textContent='查看行程';action.dataset.goal='world';return;
    }
    if(state.sceneId==='scene:valley'){
      title.textContent=state.combat?'谷中交锋':'云岫山谷';
      copy.textContent=state.combat?'留意山魈的蓄势。':'山中药草未尽，桥旁似有人迹。';
      action.hidden=!!state.combat;action.textContent='查看山谷';action.dataset.goal='world';return;
    }
    if ((master?.wound||0)>0) {
      title.textContent='先稳住伤势';
      copy.textContent='一路风霜，伤口仍在作痛。先取灵草调息。';
      action.hidden=false;action.textContent='用灵草调息';action.dataset.goal='heal';
    } else if (story.visitor&&story.step===0) {
      title.textContent='整理母亲留下的线索';
      copy.textContent='伤势渐平，药匣里的旧纸与沿途见闻终于可以静心理清。';
      action.hidden=false;action.textContent='整理旧卷';action.dataset.goal='clues';
    } else if (story.visitor&&story.step===1&&story.invitation==='unasked'&&!story.gifted) {
      title.textContent='去见陆知微';
      copy.textContent=story.visitor?.canTalk?'她正为家中病人寻药，走近些听听她的难处。':'陆知微在院中等候，先走到她身边再谈。';
      action.hidden=false;action.textContent='查看陆知微';action.dataset.goal='story';
    } else if (hallPhase==='shelter') {
      title.textContent='在云岫立起主殿';
      copy.textContent='松坡小篷可暂避风雨。山前平地，正好立殿。';
      action.hidden=false;action.textContent='查看殿址';action.dataset.goal='site:main-house';
    } else if (hallPhase==='building') {
      title.textContent='主殿渐成';
      copy.textContent='殿址已开工，山上渐有梁柱声。';
      action.hidden=false;action.textContent='查看工地';action.dataset.goal='site:main-house';
    } else if ((hall?.condition??100)<50) {
      title.textContent='修整山院主殿';
      copy.textContent='殿宇受了损，添些木石便能修整。';
      action.hidden=false;action.textContent='查看主殿';action.dataset.goal='site:main-house';
    } else if (story.visitor&&story.step===1&&story.invitation==='unasked') {
      title.textContent=story.gifted?'与陆知微商议去留':'去见陆知微';
      copy.textContent=story.visitor?.canTalk?story.gifted?'药材已交到她手中，现在可以问她是否愿留在山院。':'她正为家中病人寻药，走近些听听她的难处。':'陆知微在院中等候，先走到她身边再谈。';
      action.hidden=false;action.textContent='查看陆知微';action.dataset.goal='story';
    } else if (!field||field.stage!=='complete') {
      title.textContent=field?'药圃开垦中':'开辟山南药圃';
      copy.textContent=field?'清去乱石，再引泉水入畦。':'泉边的山地，可辟成一片灵草田。';
      action.hidden=false;action.textContent='查看药圃';action.dataset.goal='site:herb-terrace';
    } else if (!terrace.lastHarvest&&terrace.crop&&terrace.crop.phase!=='harvested') {
      title.textContent=terrace.crop.phase==='ripe/waiting'?'田畦将迎首收':terrace.crop.phase==='mature'?'药叶渐丰':'药圃新种';
      copy.textContent=cropNotes[terrace.crop.phase]||'田边有人照看这一畦。';
      action.hidden=false;action.textContent='查看药圃';action.dataset.goal='site:herb-terrace';
    } else if (!terrace.lastHarvest&&terrace.seedTransports?.some(work=>['to-source','carrying'].includes(work.phase))) {
      title.textContent='种苗正在运往药圃';
      copy.textContent='掌门已领了差事，待种苗实际送到田边。';
      action.hidden=false;action.textContent='查看药圃';action.dataset.goal='site:herb-terrace';
    } else if (!terrace.lastHarvest&&(terrace.herbOnSite??0)<(terrace.seedNeeded??2)) {
      title.textContent='为新田送去种苗';
      copy.textContent='田畦已齐，公库中的灵草还须有人送到田边。';
      action.hidden=false;action.textContent='查看药圃';action.dataset.goal='site:herb-terrace';
    } else if (!terrace.lastHarvest&&!terrace.crop&&story.invitation==='joined') {
      title.textContent='请陆知微照看药圃';
      copy.textContent='种苗已到田边，可以问她愿否照料这片新田。';
      action.hidden=false;action.textContent='查看药圃';action.dataset.goal='site:herb-terrace';
    } else if (!state.crafting?.workstation) {
      title.textContent='筑炉炼药';
      copy.textContent='药圃初成，可在东台建一处丹房。';
      action.hidden=false;action.textContent='查看丹房';action.dataset.goal='site:alchemy-court';
    } else if (!state.crafting.orders.some(order=>order.phase==='completed')) {
      title.textContent='开第一炉回春散';
      copy.textContent='备好灵草，试炼一炉疗伤丹药。';
      action.hidden=false;action.textContent='查看丹方';action.dataset.goal='crafts';
    } else if (!lumber||lumber.stage!=='complete') {
      title.textContent=lumber?'林缘工棚在建':'筹建林缘伐木场';
      copy.textContent=lumber?'棚架立好，便可在松林边备木。':'松林在山道东侧，立一座工棚便能就近取材。';
      action.hidden=false;action.textContent='查看林地';action.dataset.goal='site:timber-grove';
    } else {
      title.textContent='经营云岫山院';
      copy.textContent='山路渐通，院中仍有许多空地待经营。';
      action.hidden=true;
    }
  }

  function storyMarkup(state) {
    const story=state.openingStory||{};
    const visitor=story.visitor;
    if (!visitor) return '<p class="empty">来客暂不在院中。</p>';
    const nearby=visitor.canTalk;
    let account='';
    if (story.invitation==='joined') account='她收下药材，也愿留在山院研习草木之道。';
    else if (story.invitation==='declined') account='她带着药材回去照应家人，临别仍记得山院这份善意。';
    else if (story.gifted) account='她已收下赠药。是否留在山院，还等她自己作答。';
    else account='她正为家中病人寻药。赠药之后，再谈山院的去留。';
    const approach=nearby||story.invitation!=='unasked'?'':'<p class="estate-lock">先走近陆知微，再当面说话。</p><button class="primary-action" data-story-visit>走近陆知微</button><button class="secondary-action" data-story-person>查看陆知微</button>';
    const choices=story.step!==1||story.invitation!=='unasked'?'':!story.gifted?
      '<p class="estate-cost">从公库赠药　灵草 10 份</p><button class="primary-action" data-story-choice="gift" '+(!nearby||(state.resources.herb||0)<10?'disabled':'')+'>赠她十份灵草</button>':
      (state.openingHallPhase==='complete'?'':'<p class="estate-lock">待主殿落成，再请她入院。</p>')+
      '<button class="primary-action" data-story-choice="invite" '+(!nearby||state.openingHallPhase!=='complete'?'disabled':'')+'>问她愿否入院</button><button class="secondary-action" data-story-choice="decline" '+(!nearby?'disabled':'')+'>让她先回去照应家人</button>';
    return '<div class="estate-emblem" aria-hidden="true"><span>人</span></div><p class="estate-kicker">云岫山院 · 来客</p>'+
      '<h3 class="estate-name">'+safe(visitor.name)+'</h3><p class="estate-story">'+safe(account)+'</p>'+approach+choices;
  }

  function farmMarkup(state,building) {
    const terrace=state.herbTerrace||{};
    if (!building||building.stage!=='complete'||terrace.instanceId!==building.id&&terrace.buildingId!==building.id) return '';
    const crop=terrace.crop;
    const active=terrace.seedTransports?.find(work=>['to-source','carrying'].includes(work.phase));
    const seedNeeded=terrace.seedNeeded??2;
    let content='<h4 class="section-label">田边近况</h4>';
    if (crop&&crop.phase==='harvested') {
      content+='<p class="estate-note">这一畦已收下，田边正收拾畦土。</p>';
    } else if (crop) {
      const growth=Math.round(100*Math.min(1,(crop.growthTicks||0)/Math.max(1,crop.maturityTicks||1)));
      content+='<p class="estate-note">'+safe(cropNotes[crop.phase]||'陆知微正在田边照看。')+'</p>'+
        '<div class="estate-progress"><span>药苗生长</span><b>'+growth+'%</b><div class="meter"><span style="width:'+growth+'%"></span></div></div>';
    } else if (active) {
      content+='<p class="estate-note">'+safe(active.phase==='to-source'?'掌门正去公库领种苗。':'种苗正在送往田边。')+'</p>';
    } else if ((terrace.herbOnSite??0)<seedNeeded) {
      content+='<p class="estate-note">新畦已备好，种苗还在公库。</p>'+
        '<button class="primary-action" data-estate-seeds '+(!terrace.stockpileId||!terrace.instanceId||(state.resources.herb||0)<seedNeeded?'disabled':'')+'>送 '+safe(seedNeeded)+' 份种苗到药圃</button>';
    } else if (state.openingStory?.invitation==='joined'&&state.openingStory.visitor?.id) {
      content+='<p class="estate-note">种苗已到田边，可以问陆知微愿否照料。</p>'+
        '<button class="primary-action" data-estate-care>请陆知微照看药圃</button>';
    } else {
      content+='<p class="estate-note">种苗已到田边，等愿意照料的人来下种。</p>';
    }
    if (terrace.lastHarvest) content+='<p class="estate-note">田边最近收得 '+safe(Math.round(terrace.lastHarvest.quantity*10)/10)+' 份灵草。</p>';
    return content;
  }

  function siteMarkup(state) {
    if (selectedStory) return storyMarkup(state);
    const chosen=siteById(selectedSite);
    const building=selectedBuilding?state.buildings.find(item=>item.id===selectedBuilding):actualAt(state,chosen);
    const site=chosen||sites.find(item=>building&&item.type===building.type&&item.x===building.x&&item.y===building.y);
    if (!site&&!building) return '<p class="empty">点选一处建筑或预留地，查看这里的工程。</p>';
    const type=building?.type||site?.type;
    const definition=BUILDINGS[type]||{};
    const level=building?.level||0;
    const stage=building?.stage||'empty';
    const hallPhase=type==='hall'?(state.openingHallPhase||'complete'):null;
    const damaged=stage==='damaged';
    const progressing=['foundation','structure','finishing','upgrade'].includes(stage);
    const construction=state.construction?.buildingId===building?.id?state.construction:null;
    const name=type==='hall'?(hallPhase==='shelter'?'临时落脚处':hallPhase==='building'?'山院主殿工地':'山院主殿'):(building?.name||site?.name||definition.name||'山院空地');
    const condition=building?.condition??100;
    const master=state.roster.find(person=>person.role==='master');
    const blocked=(master?.wound||0)>0?'掌门尚有伤势，先调息疗伤。':(master?.energy??100)<15?'掌门精力不足，先歇息一阵。':'';
    const terrace=state.herbTerrace||{};
    const farmDescription=progressing?'清石引水，田畦渐露。':terrace.crop&&terrace.crop.phase!=='harvested'?'泉水沿着田沟流过，药苗在畦中生长。':terrace.lastHarvest?'第一畦灵草已收，药香还留在田边。':(terrace.herbOnSite??0)>0?'种苗已经送到田边，待有人下种。':'田畦已齐，等种苗运来。';
    const description=type==='hall'?(hallPhase==='shelter'?'松坡小篷暂可遮雨。殿址已择在山前平地。':hallPhase==='building'?'立柱承梁，山风从尚未合拢的檐下穿过。':damaged?'殿宇受损，木石尚可修整。':'新殿立在山脊上，门前石路通向各处院地。'):
      site?.id==='site:herb-terrace'?(building?farmDescription:'近泉的山坡土色深润，可辟成灵草田。'):
      site?.id==='site:timber-grove'?(building?(progressing?'松林边的棚架渐渐立起。':'工棚已成，林边有了备木之所。'):'松林沿山道向东伸展，可在此立伐木工棚。'):
      type==='alchemy'?(building?(progressing?'药炉的烟道渐渐立起。':'炉火藏在青瓦之下，檐边飘着淡淡药香。'):'东台背风，可筑丹房、安炉炼药。'):
      building&&!progressing?'屋舍已成，院路从门前经过。':'这片山地已留作营造之用。';
    let action='';
    if (progressing) {
      const progress=Math.round(Math.max(0,Math.min(1,construction?.progress||0))*100);
      const workNote=type==='hall'?({foundation:'石料与木料陆续上山，殿基渐渐铺开。',structure:'木柱与横梁正在立起。',finishing:'屋檐将合，殿前石阶也渐渐齐整。',upgrade:'殿宇正在扩建。'})[stage]:type==='farm'?({foundation:'清去山石，翻出田土。',structure:'木边围起田畦，泉水引入沟中。',finishing:'田垄渐齐，等着下种。',upgrade:'旧畦旁正添新田。'})[stage]:({foundation:'地基正在整平。',structure:'木石正在成架。',finishing:'工地渐有模样。',upgrade:'屋舍正在扩建。'})[stage];
      action='<div class="estate-progress"><span>工程进度</span><b>'+progress+'%</b><div class="meter"><span style="width:'+progress+'%"></span></div></div>'+
        '<p class="estate-note">'+safe(workNote||'山上正忙着施工。')+'</p><button class="secondary-action" data-estate-cancel>停下工程</button>';
    } else if (type==='hall'&&hallPhase==='shelter') {
      const shortage=missingCost(state,HALL_ESTABLISH_COST);
      action='<p class="estate-cost">立殿所需　'+safe(costText(HALL_ESTABLISH_COST))+'</p>'+
        (blocked||shortage.length?'<p class="estate-lock">'+safe(blocked||'尚缺'+shortage.join('、'))+'</p>':'')+
        '<button class="primary-action" data-estate-establish '+(blocked||shortage.length?'disabled':'')+'>营造主殿</button>';
    } else if (type==='hall'&&hallPhase==='building') {
      action='<p class="estate-note">木石已入场，殿宇尚在营造。</p>';
    } else if (!building) {
      const shortage=missingCost(state,definition.cost);
      const siteLock=state.openingHallPhase!=='complete'?'主殿立稳后再动工。':
        state.construction?'先等眼前这处工程完工。':
        (state.estateStage??0)<(definition.stage??0)?`待${STAGE_NAMES[definition.stage]||'山院成长'}后再营造。`:'';
      action='<p class="estate-cost">营造所需　'+safe(costText(definition.cost))+'</p>'+
        (blocked||siteLock||shortage.length?'<p class="estate-lock">'+safe(blocked||siteLock||'尚缺'+shortage.join('、'))+'</p>':'')+
        '<button class="primary-action" data-estate-build="'+safe(site?.id||'')+'" '+(blocked||siteLock||shortage.length?'disabled':'')+'>在此营造'+safe(definition.name||'设施')+'</button>';
    } else if (damaged) {
      const repair={wood:Math.ceil((100-condition)/5),stone:Math.ceil((100-condition)/8)};
      const shortage=missingCost(state,repair);
      action='<p class="estate-cost">修整所需　'+safe(costText(repair))+'</p>'+
        (blocked||shortage.length?'<p class="estate-lock">'+safe(blocked||'尚缺'+shortage.join('、'))+'</p>':'')+
        '<button class="primary-action" data-estate-repair="'+safe(building.id)+'" '+(blocked||shortage.length?'disabled':'')+'>修整'+safe(name)+'</button>';
    } else if (level<(definition.max||1)) {
      const upgrade={jade:45*level,wood:30*level,stone:20*level};
      const shortage=missingCost(state,upgrade);
      action='<p class="estate-cost">升级所需　'+safe(costText(upgrade))+'</p>'+
        (blocked||shortage.length?'<p class="estate-lock">'+safe(blocked||'尚缺'+shortage.join('、'))+'</p>':'')+
        '<button class="primary-action" data-estate-upgrade="'+safe(building.id)+'" '+(blocked||shortage.length?'disabled':'')+'>筹备升至 '+(level+1)+' 级</button>';
    } else action=type==='farm'?'':'<p class="estate-note">这处屋舍已无扩建余地。</p>';
    const farmStages={foundation:'清石整畦',structure:'木架引水',finishing:'田畦将成'};
    const stageLabel=type==='hall'&&hallPhase==='shelter'?'暂栖':type==='farm'&&farmStages[stage]?farmStages[stage]:stageText[stage]||'待建';
    const current=type==='hall'&&hallPhase==='shelter'?'暂栖':type==='hall'&&hallPhase==='building'?stageLabel:building?level+' 级 · '+stageLabel:'待建';
    return '<div class="estate-emblem" aria-hidden="true"><span>'+safe(type==='hall'?'院':type==='farm'?'田':type==='lumber'?'木':'舍')+'</span></div>'+
      '<p class="estate-kicker">云岫山院 · '+safe(stageLabel)+'</p>'+
      '<h3 class="estate-name">'+safe(name)+'</h3><p class="estate-story">'+safe(description)+'</p>'+
      '<div class="estate-facts"><div><span>进展</span><b>'+safe(current)+'</b></div>'+
      (building&&stage==='complete'&&hallPhase!=='shelter'&&hallPhase!=='building'?'<div><span>'+safe(type==='farm'?'田畦完好':type==='lumber'?'工棚完好':'屋舍完好')+'</span><b>'+Math.ceil(condition)+'%</b></div>':'')+
      (building&&stage==='complete'&&building.workSlots?'<div><span>作业位</span><b>'+safe(building.workSlots)+' 处</b></div>':'')+
      (building&&stage==='complete'&&building.capacity?'<div><span>床位</span><b>'+safe(building.capacity)+' 处</b></div>':'')+'</div>'+
      farmMarkup(state,building)+(type==='alchemy'&&building&&stage==='complete'?'<button class="primary-action" data-estate-alchemy>入丹房</button>':'')+action;
  }

  function render(force=false) {
    const state=snapshot();
    goal(state);
    if (panel.hidden) return;
    const next=JSON.stringify({selectedSite,selectedBuilding,selectedStory,hallPhase:state.openingHallPhase,estateStage:state.estateStage,buildings:state.buildings,construction:state.construction,resources:state.resources,openingStory:state.openingStory,herbTerrace:state.herbTerrace,wound:state.roster.find(person=>person.role==='master')?.wound});
    if (!force&&next===body) return;
    body=next;
    document.getElementById('estate-side-title').textContent=selectedStory?'来客':'山院';
    content.innerHTML=siteMarkup(state);
  }

  function openSite(id,buildingId=null) {
    selectedSite=id;
    selectedBuilding=buildingId;
    selectedStory=false;
    systemUI.close();
    panel.hidden=false;
    render(true);
  }

  function openStory() {
    selectedStory=true;
    systemUI.close();
    panel.hidden=false;
    render(true);
  }

  const originalSelect=window.paintedGameSelect;
  window.estateGameSelect=(kind,id)=>{
    if (kind==='site') openSite(id);
    else if (kind==='building') {
      const building=snapshot().buildings.find(item=>item.id===id);
      originalSelect('building',id);
      openSite(sites.find(site=>building&&site.type===building.type&&site.x===building.x&&site.y===building.y)?.id||null,id);
    } else if (kind==='person') {
      panel.hidden=true;
      const object=snapshot().world?.objects.find(item=>item.personId===id);
      if(object){if(!snapshot().combat)window.estateWorldSelect?.('world-object',object.id);return;}
      if(id===snapshot().market?.merchant.id){systemUI.open('sect',{section:'market'});return;}
      originalSelect('person',id);
    }
  };
  window.estateGameMove=(x,y)=>window.paintedGameMove(x,y);
  window.paintedCourtyardCommand=(command,...args)=>window.estateSceneCommand?.(command,...args);
  window.estateGameOpenSite=(id='site:main-house')=>openSite(id);
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{panel.hidden=true}));
  document.getElementById('close-estate-panel').addEventListener('click',()=>{panel.hidden=true});
  document.getElementById('goal-action').addEventListener('click',event=>{
    const target=event.currentTarget.dataset.goal;
    if (target==='heal') send({name:'masterAction',args:['heal']});
    else if (target==='clues') send({name:'advanceStory',args:[]});
    else if (target==='story') openStory();
    else if (target==='crafts') systemUI.open('crafts');
    else if (target==='world') systemUI.open('world');
    else {openSite(target);window.estateSceneCommand?.('focus_site',target)}
  });
  content.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-estate-alchemy')) systemUI.open('crafts');
    else if (button.dataset.storyChoice) send({name:'advanceStory',args:[button.dataset.storyChoice]});
    else if (button.hasAttribute('data-story-visit')) {
      const state=snapshot();
      const visitor=state.openingStory?.visitor;
      const master=state.people.find(person=>person.id===state.masterId);
      if (visitor&&Number.isFinite(visitor.x)&&Number.isFinite(visitor.y)) {
        const dx=(master?.x??visitor.x+1)-visitor.x,dy=(master?.y??visitor.y)-visitor.y;
        const distance=Math.hypot(dx,dy)||1;
        const x=Math.max(0,Math.min(state.width,visitor.x+dx/distance*.45));
        const y=Math.max(0,Math.min(state.height,visitor.y+dy/distance*.45));
        const result=window.estateGameMove(x,y);
        if (result?.ok&&result.result!==false) panel.hidden=true;
      }
    } else if (button.hasAttribute('data-story-person')) {
      const visitor=snapshot().openingStory?.visitor;
      if (visitor) window.estateGameSelect('person',visitor.id);
    } else if (button.hasAttribute('data-estate-seeds')) {
      const terrace=snapshot().herbTerrace;
      if (terrace?.stockpileId) send({name:'startTransport',args:['stockpile:yunxiu',terrace.stockpileId,'person:master',{herb:terrace.seedNeeded??2}]});
    } else if (button.hasAttribute('data-estate-care')) {
      const state=snapshot();
      if (state.openingStory?.visitor?.id&&state.herbTerrace?.instanceId) send({name:'inviteWork',args:[state.openingStory.visitor.id,state.herbTerrace.instanceId]});
    } else if (button.dataset.estateBuild) {
      const site=siteById(button.dataset.estateBuild);
      if (site) send({name:'build',args:[site.type,site.x,site.y]});
    } else if (button.hasAttribute('data-estate-establish')) send({name:'establishHall',args:[]});
    else if (button.dataset.estateUpgrade) send({name:'upgrade',args:[Number(button.dataset.estateUpgrade)]});
    else if (button.dataset.estateRepair) send({name:'repairBuilding',args:[Number(button.dataset.estateRepair)]});
    else if (button.hasAttribute('data-estate-cancel')) send({name:'cancelConstruction',args:[]});
  });
  setInterval(()=>render(),220);
  render();
}
