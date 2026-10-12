/** U-124: opening guidance reads the shared snapshot and returns an existing entrance. */
const HOME='scene:yunxiu-courtyard',VALLEY='scene:valley';
const names={jade:'灵石',wood:'木料',stone:'石料',herb:'灵草',food:'食粮'};
const cropNotes={growing:'种苗已入畦，新芽正在生长。',mature:'药叶渐丰，还需有人继续照看。','ripe/waiting':'药草已经长成，待田边收下。','paused:waterlogged':'畦中积水，待水退后再照看。','paused:facility':'田地暂不可用，照料已停下。',harvested:'这一畦已经收下。'};
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const amount=value=>String(Number(number(value).toFixed(2)));
const active=order=>!['delivered','cancelled','completed'].includes(order.phase);
const goal=(id,title,copy,label,target,params)=>({id,title,copy,action:target?{label,target,...(params?{params}:{})}:null});

export function materialShortages(resources,cost) {
  return Object.entries(cost||{}).filter(([key,need])=>number(resources?.[key])<number(need))
    .map(([resource,need])=>({resource,amount:Number((number(need)-number(resources?.[resource])).toFixed(9))}));
}

export function openingGoal(state,{sites=[],alchemyCost={}}={}) {
  const buildings=state.buildings||[],stocks=state.inventory?.stockpiles||[];
  const master=(state.roster||[]).find(person=>person.role==='master')||{};
  const masterId=state.masterId||'person:master';
  const stock=id=>stocks.find(item=>item.id===id);
  const carried=stock('stockpile:carried:master'),publicStock=stock('stockpile:yunxiu'),party=stock('stockpile:sr-party');
  const publicResources=publicStock?.resources||state.resources||{};
  const transports=(state.inventory?.transports||[]).filter(active);
  const masterTransport=transports.find(order=>order.carrierId===masterId);
  const journey=state.openingJourney||{},world=state.world||{};
  const worldRoute=destination=>({kind:'route',id:destination});
  const worldObject=object=>({kind:'object',id:object.id});
  const healPills=stocks.filter(item=>item.access==='public'||item.ownerId===masterId)
    .reduce((total,item)=>total+number(item.pills?.heal),0);
  const pillTransport=transports.find(order=>number(order.cargo?.['pill:heal'])>0&&order.carrierId===masterId);

  if(state.sceneId==='scene:travel')return goal('travel','行在山间','沿山道而行，可查看余程与目的地。','查看行程','world');
  if(state.sceneId===VALLEY) {
    if(state.combat)return goal('battle','谷中交锋','留意对手蓄势，可护持、闪避或沿出口撤离。');
    if(journey.firstBattle)return goal('return-home','沿山道归院','此番交锋已有结果，沿归院山道返回，伤势与随行物资回院后料理。','查看归院山道','world',worldRoute(HOME));
    if(world.activity)return goal('valley-activity','料理谷中事务',world.activity.kind==='gather'?'正在采集，收获将留在随行物资箱。':'掌门正在谷中行动，可查看当前事务。','查看当前事务','world');
    const objects=world.objects||world.scene?.objects||[];
    const herbs=objects.find(item=>item.available!==false&&number(item.resourceRemaining)>0&&item.choices?.some(choice=>choice.action==='gather'));
    if(!journey.valleyGathered&&herbs)return goal('valley-gather','采些谷中灵草',`可走近${herbs.name||'眼前药丛'}，采得的药草随行带回。`,'查看药丛','world',worldObject(herbs));
    const encounter=objects.find(item=>item.available!==false&&item.choices?.some(choice=>choice.action==='engage'));
    if(encounter)return goal('valley-encounter','查看谷中遭遇',`可走近${encounter.name||'眼前对手'}察看，再决定是否应战；也可沿山道归院。`,'查看遭遇','world',worldObject(encounter));
    return goal('valley-explore','云岫山谷','点选已见的人物、药丛与山道，查看可做之事。','查看山谷','world');
  }

  if(number(master.wound)>0) {
    if(pillTransport)return goal('healing-transport','疗伤药正在运送',pillTransport.reason||'掌门正在取药，待回春散实际送到再服用。','查看药物','bag',{pill:'heal'});
    if(healPills>0)return goal('heal-pill','用回春散调养伤势',number(carried?.pills?.heal)>0?'随身已有回春散，可在行囊中查看并服用。':'院中已有回春散，可在行囊中查看药物所在，再实际取用。','查看回春散','bag',{pill:'heal'});
    if(number(publicResources.herb)>=6)return goal('heal-herb','先稳住伤势','一路风霜，伤口仍在作痛。先取灵草调息。','用灵草调息','heal');
    if(number(carried?.resources?.herb)>0||number(party?.resources?.herb)>0)return goal('healing-supplies','把疗伤灵草送回公库',`公库还缺灵草 ${amount(6-number(publicResources.herb))} 份，身边的药草可先送回。`,'查看身边物资',number(party?.resources?.herb)>0?'world':'bag',number(party?.resources?.herb)>0?undefined:{category:'材料',selected:'herb'});
    return goal('healing-shortage','筹些灵草疗伤',`调息需公库灵草 6 份，尚缺 ${amount(6-number(publicResources.herb))} 份。可查看采集条件或从山客处补齐。`,'查看灵草来源','sect',{section:'harvest',resource:'herb'});
  }

  const hall=buildings.find(item=>item.type==='hall'),hallPhase=state.openingHallPhase||'complete';
  const story=state.openingStory||{},terrace=state.herbTerrace||{};
  const atSite=id=>{const site=sites.find(item=>item.id===id);return site&&buildings.find(item=>item.type===site.type&&item.x===site.x&&item.y===site.y);};
  const field=atSite('site:herb-terrace'),lumber=atSite('site:timber-grove');
  if(story.visitor&&story.step===0)return goal('opening-clues','整理母亲留下的线索','伤势渐平，药匣里的旧纸与沿途见闻终于可以静心理清。','整理旧卷','clues');
  if(story.visitor&&story.step===1&&story.invitation==='unasked'&&!story.gifted)return goal('opening-gift','去见陆知微',story.visitor.canTalk?'她正为家中病人寻药，走近些听听她的难处。':'陆知微在院中等候，先走到她身边再谈。','查看陆知微','story');
  if(hallPhase==='shelter')return goal('hall-site','在云岫立起主殿','松坡小篷可暂避风雨。山前平地，正好立殿。','查看殿址','site:main-house');
  if(hallPhase==='building')return goal('hall-building','主殿渐成','殿址已开工，山上渐有梁柱声。','查看工地','site:main-house');
  if((hall?.condition??100)<50)return goal('hall-repair','修整山院主殿','殿宇受了损，添些木石便能修整。','查看主殿','site:main-house');
  if(story.visitor&&story.step===1&&story.invitation==='unasked')return goal('opening-invite',story.gifted?'与陆知微商议去留':'去见陆知微',story.visitor.canTalk?story.gifted?'药材已交到她手中，现在可以问她是否愿留在山院。':'她正为家中病人寻药，走近些听听她的难处。':'陆知微在院中等候，先走到她身边再谈。','查看陆知微','story');
  if(!field||field.stage!=='complete')return goal('farm-site',field?'药圃开垦中':'开辟山南药圃',field?'清去乱石，再引泉水入畦。':'泉边的山地，可辟成一片灵草田。','查看药圃','site:herb-terrace');
  if(!terrace.lastHarvest&&terrace.crop&&terrace.crop.phase!=='harvested')return goal('farm-crop',terrace.crop.phase==='ripe/waiting'?'田畦将迎首收':terrace.crop.phase==='mature'?'药叶渐丰':'药圃新种',cropNotes[terrace.crop.phase]||'田边有人照看这一畦。','查看药圃','site:herb-terrace');
  if(!terrace.lastHarvest&&terrace.seedTransports?.some(order=>['to-source','carrying'].includes(order.phase)))return goal('farm-seeds-moving','种苗正在运往药圃','掌门已领了差事，待种苗实际送到田边。','查看药圃','site:herb-terrace');
  if(!terrace.lastHarvest&&number(terrace.herbOnSite)<(terrace.seedNeeded??2))return goal('farm-seeds','为新田送去种苗','田畦已齐，公库中的灵草还须有人送到田边。','查看药圃','site:herb-terrace');
  if(!terrace.lastHarvest&&!terrace.crop&&story.invitation==='joined')return goal('farm-care','请陆知微照看药圃','种苗已到田边，可以问她愿否照料这片新田。','查看药圃','site:herb-terrace');

  if(journey.firstBattle) {
    const delivering=transports.some(order=>order.sourceStockpileId===party?.id&&order.targetStockpileId==='stockpile:yunxiu');
    if(delivering||Object.values(party?.resources||{}).some(value=>number(value)>0))return goal('home-cargo',delivering?'随行物资正在入库':'将随行物资送入公库',delivering?'待掌门把这一趟物资实际送到库中。':'采回的药草与余粮还在随行物资箱，可在山外卷图中安排送入公库。','查看随行物资','world');
    if(!lumber||lumber.stage!=='complete')return goal('opening-complete','归院休整已毕','此番山行已经收束。可继续经营山院，查看林地的营造条件。','查看林地','site:timber-grove');
    return goal('opening-complete','经营云岫山院','山行之后，院中仍有许多事务待经营。');
  }

  const alchemy=buildings.find(item=>item.type==='alchemy');
  if(state.construction) {
    const building=buildings.find(item=>String(item.id)===String(state.construction.buildingId));
    const site=sites.find(item=>building&&item.type===building.type&&item.x===building.x&&item.y===building.y);
    return goal('construction',alchemy&&building===alchemy?'丹房正在营造':'院中工程在办',`工程进度 ${Math.round(number(state.construction.progress)*100)}%，待工地实际落成。`,'查看工地',site?.id||'site:alchemy-court');
  }
  if(state.harvest?.activity)return goal('harvest','筹料途中',state.harvest.activity.reason||'掌门正在山场取材，采得后还须实际送入公库。','查看取材','sect',{section:'harvest',resource:state.harvest.activity.resource});
  if(masterTransport) {
    const furnaceId=state.crafting?.workstation?.stockpileId;
    const furnaceTrip=masterTransport.sourceStockpileId===furnaceId||masterTransport.targetStockpileId===furnaceId;
    return goal('transport',pillTransport?'回春散正在运送':'物资正在运送',masterTransport.reason||'待掌门实际送达，再接下一件事。','查看运送',furnaceTrip?'crafts':'bag',furnaceTrip?{recipe:'heal'}:pillTransport?{pill:'heal'}:undefined);
  }
  if(!alchemy||alchemy.stage!=='complete') {
    const shortage=materialShortages(publicResources,alchemyCost);
    return goal('alchemy-site',alchemy?'丹房正在营造':shortage.length?'筹料营造丹房':'筑炉炼药',alchemy?'待丹房落成，再送料开炉。':shortage.length?`公库尚缺${shortage.map(item=>`${names[item.resource]||item.resource} ${amount(item.amount)}`).join('、')}。查看丹房可前往取材或山客交易。`:'药圃初成，可在东台建一处丹房。','查看丹房','site:alchemy-court');
  }
  const crafting=state.crafting||{},order=crafting.orders?.find(item=>item.phase==='active');
  if(order)return goal('crafting','炉火正在照看',order.reason||'本炉尚未完成，可查看火候与用料。','查看炉事','crafts',{recipe:order.recipeId});
  const crafted=journey.healingCrafted??crafting.orders?.some(item=>item.recipeId==='heal'&&item.phase==='completed');
  if(!crafted)return goal('first-healing-craft','开第一炉回春散','先把灵草实际送到炉边，用料齐备后开炉。','查看丹方','crafts',{recipe:'heal'});
  if(number(carried?.pills?.heal)<1) {
    const furnace=stock(crafting.workstation?.stockpileId);
    if(number(furnace?.pills?.heal)>0)return goal('carry-healing','携一份回春散入山','回春散已在炉边。到百艺中选择携带一份，待实际取入随身后再出发。','查看成丹','crafts',{recipe:'heal'});
    if(healPills>0)return goal('carry-healing','携一份回春散入山','回春散仍在院中库位，可从行囊安排领入随身。','查看回春散','bag',{pill:'heal'});
    return goal('replenish-healing','备好入山的回春散','随身尚无回春散，可再炼一炉，留作入山后的疗伤之用。','查看丹方','crafts',{recipe:'heal'});
  }
  return goal('depart-valley','备粮前往云岫山谷','随身已有回春散。打开山外查看路程与口粮，先走到出口，再明确启程。','查看入谷山道','world',worldRoute(VALLEY));
}
