import {startPaintedGameUI} from './base-ui.mjs';
import {BUILDINGS} from './runtime/ea-data.mjs';

/** Estate-specific construction surface. Character and art rules stay in base-ui. */
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
  const stageText={damaged:'残败待修',complete:'已建成',foundation:'清地立基',structure:'木石成架',finishing:'收尾施工',upgrade:'升级施工'};
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
    const field=actualAt(state,siteById('site:herb-terrace'));
    const lumber=actualAt(state,siteById('site:timber-grove'));
    const title=document.getElementById('goal-title');
    const copy=document.getElementById('goal-copy');
    const action=document.getElementById('goal-action');
    if ((master?.wound||0)>0) {
      title.textContent='先养好逃亡留下的伤';
      copy.textContent='主屋年久失修，院地仍荒着。疗伤后才能动工。';
      action.hidden=false;action.textContent='用灵草调息';action.dataset.goal='heal';
    } else if ((hall?.condition??100)<100) {
      title.textContent='修缮别院主屋';
      copy.textContent='先让旧屋恢复可用，再筹划左右院落。';
      action.hidden=false;action.textContent='查看主屋';action.dataset.goal='site:main-house';
    } else if (!field||field.stage!=='complete') {
      title.textContent='开辟西南荒圃';
      copy.textContent=field?'灵草田正在营造，材料搬运与施工按世界时间推进。':'灵草田尚未建成；在旧址查看材料和道路。';
      action.hidden=false;action.textContent='查看荒圃';action.dataset.goal='site:herb-terrace';
    } else if (!lumber||lumber.stage!=='complete') {
      title.textContent='筹建东南伐木场';
      copy.textContent=lumber?'伐木场正在施工，完工后才会形成林缘工位。':'林缘工位需要真实营造，不会凭空产木。';
      action.hidden=false;action.textContent='查看林地';action.dataset.goal='site:timber-grove';
    } else {
      title.textContent='让旧院慢慢兴起来';
      copy.textContent='已建营造可继续升级；新区另有建设与剧情条件。';
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
    const damaged=stage==='damaged';
    const progressing=['foundation','structure','finishing','upgrade'].includes(stage);
    const construction=state.construction?.buildingId===building?.id?state.construction:null;
    const name=building?.name||site?.name||definition.name||'别院地块';
    const condition=building?.condition??100;
    const master=state.roster.find(person=>person.role==='master');
    const blocked=(master?.wound||0)>0?'掌门尚有伤势，先调息疗伤。':'';
    const description=site?.id==='site:main-house'?(damaged?'母亲早年留下的旧别院，屋瓦与门廊受尽风雨，仍可修缮。':'母亲早年留下的别院主屋已经修好，可以继续升级。'):
      site?.id==='site:herb-terrace'?(building?(progressing?'荒草与旧石界正在清理，完工后才会成为灵草田。':'灵草田已开垦，可继续照料与升级。'):'这里只是荒草与旧石界，待清地引水后才会成为灵草田。'):
      site?.id==='site:timber-grove'?(building?(progressing?'林缘工位尚待营造完成。':'伐木场已建成，林缘工位可投入使用。'):'林缘可设木料工位；没有动工，就没有可用的伐木场。'):
      building&&!progressing?'这处屋舍已建成，可继续维护和升级。':'旧址留出完整占地，往后扩建仍可保持院路通畅。';
    let action='';
    if (progressing) {
      const progress=Math.round(Math.max(0,Math.min(1,construction?.progress||0))*100);
      action='<div class="estate-progress"><span>工程进度</span><b>'+progress+'%</b><div class="meter"><span style="width:'+progress+'%"></span></div></div>'+
        '<p class="estate-note">'+safe(String(construction?.label||'材料搬运与施工按世界时间推进').replace(/[。；]+$/,''))+'；存档后可接着做。</p><button class="secondary-action" data-estate-cancel>取消当前工程</button>';
    } else if (!building) {
      const shortage=missingCost(state,definition.cost);
      action='<p class="estate-cost">营造所需　'+safe(costText(definition.cost))+'</p>'+
        (blocked||shortage.length?'<p class="estate-lock">'+safe(blocked||'尚缺'+shortage.join('、'))+'</p>':'')+
        '<button class="primary-action" data-estate-build="'+safe(site?.id||'')+'" '+(blocked||shortage.length?'disabled':'')+'>在此营造'+safe(definition.name||'设施')+'</button>';
    } else if (damaged) {
      const repair={wood:Math.ceil((100-condition)/5),stone:Math.ceil((100-condition)/8)};
      const shortage=missingCost(state,repair);
      action='<p class="estate-cost">修缮所需　'+safe(costText(repair))+'</p>'+
        (blocked||shortage.length?'<p class="estate-lock">'+safe(blocked||'尚缺'+shortage.join('、'))+'</p>':'')+
        '<button class="primary-action" data-estate-repair="'+safe(building.id)+'" '+(blocked||shortage.length?'disabled':'')+'>修缮这座主屋</button>';
    } else if (level<(definition.max||1)) {
      const upgrade={jade:45*level,wood:30*level,stone:20*level};
      const shortage=missingCost(state,upgrade);
      action='<p class="estate-cost">升级所需　'+safe(costText(upgrade))+'</p>'+
        (blocked||shortage.length?'<p class="estate-lock">'+safe(blocked||'尚缺'+shortage.join('、'))+'</p>':'')+
        '<button class="primary-action" data-estate-upgrade="'+safe(building.id)+'" '+(blocked||shortage.length?'disabled':'')+'>筹备升至 '+(level+1)+' 级</button>';
    } else action='<p class="estate-note">当前已达到这座营造的最高等级。</p>';
    return '<div class="estate-emblem" aria-hidden="true"><span>'+safe(type==='hall'?'院':type==='farm'?'田':type==='lumber'?'木':'舍')+'</span></div>'+
      '<p class="estate-kicker">云岫旧别院 · '+safe(stageText[stage]||'荒地待建')+'</p>'+
      '<h3 class="estate-name">'+safe(name)+'</h3><p class="estate-story">'+safe(description)+'</p>'+
      '<div class="estate-facts"><div><span>当前</span><b>'+safe(building?level+' 级 · '+(stageText[stage]||stage):'尚未营造')+'</b></div>'+
      '<div><span>预留</span><b>'+safe(site?site.reserveWidth+' × '+site.reserveHeight+' 米':'按现状')+'</b></div>'+
      (building?'<div><span>维护</span><b>'+Math.ceil(condition)+'%</b></div>':'')+'</div>'+
      action+(building?'':'<p class="estate-footnote">确认营造后，工程会预留所需材料。</p>');
  }

  function render(force=false) {
    const state=snapshot();
    goal(state);
    if (panel.hidden) return;
    const next=JSON.stringify({selectedSite,selectedBuilding,buildings:state.buildings,construction:state.construction,resources:state.resources,wound:state.roster.find(person=>person.role==='master')?.wound});
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
    } else if (button.dataset.estateUpgrade) send({name:'upgrade',args:[Number(button.dataset.estateUpgrade)]});
    else if (button.dataset.estateRepair) send({name:'repairBuilding',args:[Number(button.dataset.estateRepair)]});
    else if (button.hasAttribute('data-estate-cancel')) send({name:'cancelConstruction',args:[]});
  });
  setInterval(()=>render(),220);
  render();
}
