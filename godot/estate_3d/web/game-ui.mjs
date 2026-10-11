import {startPaintedGameUI} from './base-ui.mjs';
import {BUILDINGS} from './runtime/ea-data.mjs';
import {HALL_ESTABLISH_COST} from './runtime/ea-sr-spatial.mjs';

/** Mountain courtyard construction surface. Character and art rules stay in base-ui. */
export function startEstateGameUI(host, layout) {
  startPaintedGameUI(host);
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
  let selectedSite='site:main-house',selectedBuilding=null,body='';

  function send(command) {
    const payload={...JSON.parse(host.command_context()),...command};
    const result=JSON.parse(host.command(JSON.stringify(payload)));
    notice.textContent=result.ok?(result.result?.accepted===false?String(result.result.reason||'操作尚未完成'):host.notice()||'操作已记录'):String(result.error||'操作尚未完成');
    notice.dataset.error=String(!result.ok||result.result?.accepted===false);
    render(true);
    return result;
  }

  function goal(state) {
    const master=state.roster.find(person=>person.role==='master');
    const hall=state.buildings.find(building=>building.type==='hall');
    const hallPhase=state.openingHallPhase||'complete';
    const field=actualAt(state,siteById('site:herb-terrace'));
    const lumber=actualAt(state,siteById('site:timber-grove'));
    const title=document.getElementById('goal-title');
    const copy=document.getElementById('goal-copy');
    const action=document.getElementById('goal-action');
    if ((master?.wound||0)>0) {
      title.textContent='先稳住伤势';
      copy.textContent='一路风霜，伤口仍在作痛。先取灵草调息。';
      action.hidden=false;action.textContent='用灵草调息';action.dataset.goal='heal';
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
    } else if (!field||field.stage!=='complete') {
      title.textContent=field?'药圃开垦中':'开辟山南药圃';
      copy.textContent=field?'清去乱石，再引泉水入畦。':'泉边的山地，可辟成一片灵草田。';
      action.hidden=false;action.textContent='查看药圃';action.dataset.goal='site:herb-terrace';
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

  function siteMarkup(state) {
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
    const blocked=(master?.wound||0)>0?'掌门尚有伤势，先调息疗伤。':'';
    const description=type==='hall'?(hallPhase==='shelter'?'松坡小篷暂可遮雨。殿址已择在山前平地。':hallPhase==='building'?'立柱承梁，山风从尚未合拢的檐下穿过。':damaged?'殿宇受损，木石尚可修整。':'新殿立在山脊上，门前石路通向各处院地。'):
      site?.id==='site:herb-terrace'?(building?(progressing?'清石引水，田畦渐露。':'灵草田已开垦，可继续照料。'):'近泉的山坡土色深润，可辟成灵草田。'):
      site?.id==='site:timber-grove'?(building?(progressing?'松林边的棚架渐渐立起。':'工棚已成，林边有了备木之所。'):'松林沿山道向东伸展，可在此立伐木工棚。'):
      building&&!progressing?'屋舍已成，院路从门前经过。':'这片山地已留作营造之用。';
    let action='';
    if (progressing) {
      const progress=Math.round(Math.max(0,Math.min(1,construction?.progress||0))*100);
      const workNote=type==='hall'?({foundation:'石料与木料陆续上山，殿基渐渐铺开。',structure:'木柱与横梁正在立起。',finishing:'屋檐将合，殿前石阶也渐渐齐整。',upgrade:'殿宇正在扩建。'})[stage]:({foundation:'地基正在整平。',structure:'木石正在成架。',finishing:'屋檐将合，工地渐有模样。',upgrade:'屋舍正在扩建。'})[stage];
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
      action='<p class="estate-cost">营造所需　'+safe(costText(definition.cost))+'</p>'+
        (blocked||shortage.length?'<p class="estate-lock">'+safe(blocked||'尚缺'+shortage.join('、'))+'</p>':'')+
        '<button class="primary-action" data-estate-build="'+safe(site?.id||'')+'" '+(blocked||shortage.length?'disabled':'')+'>在此营造'+safe(definition.name||'设施')+'</button>';
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
    } else action='<p class="estate-note">这处屋舍已无扩建余地。</p>';
    const stageLabel=type==='hall'&&hallPhase==='shelter'?'暂栖':stageText[stage]||'待建';
    const current=type==='hall'&&hallPhase==='shelter'?'暂栖':type==='hall'&&hallPhase==='building'?stageLabel:building?level+' 级 · '+stageLabel:'待建';
    return '<div class="estate-emblem" aria-hidden="true"><span>'+safe(type==='hall'?'院':type==='farm'?'田':type==='lumber'?'木':'舍')+'</span></div>'+
      '<p class="estate-kicker">云岫山院 · '+safe(stageLabel)+'</p>'+
      '<h3 class="estate-name">'+safe(name)+'</h3><p class="estate-story">'+safe(description)+'</p>'+
      '<div class="estate-facts"><div><span>进展</span><b>'+safe(current)+'</b></div>'+
      (building&&hallPhase!=='shelter'&&hallPhase!=='building'?'<div><span>屋况</span><b>'+Math.ceil(condition)+'%</b></div>':'')+'</div>'+
      action;
  }

  function render(force=false) {
    const state=snapshot();
    goal(state);
    if (panel.hidden) return;
    const next=JSON.stringify({selectedSite,selectedBuilding,hallPhase:state.openingHallPhase,buildings:state.buildings,construction:state.construction,resources:state.resources,wound:state.roster.find(person=>person.role==='master')?.wound});
    if (!force&&next===body) return;
    body=next;
    content.innerHTML=siteMarkup(state);
  }

  function openSite(id,buildingId=null) {
    selectedSite=id;
    selectedBuilding=buildingId;
    document.querySelector('.rail-item[data-tab="home"]').click();
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
      originalSelect('person',id);
    }
  };
  window.estateGameMove=(x,y)=>window.paintedGameMove(x,y);
  window.paintedCourtyardCommand=(command,...args)=>window.estateSceneCommand?.(command,...args);
  document.querySelectorAll('.rail-item').forEach(button=>button.addEventListener('click',()=>{panel.hidden=true}));
  document.getElementById('close-estate-panel').addEventListener('click',()=>{panel.hidden=true});
  document.getElementById('goal-action').addEventListener('click',event=>{
    const target=event.currentTarget.dataset.goal;
    if (target==='heal') send({name:'masterAction',args:['heal']});
    else {openSite(target);window.estateSceneCommand?.('focus_site',target)}
  });
  content.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if (!button) return;
    if (button.dataset.estateBuild) {
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
