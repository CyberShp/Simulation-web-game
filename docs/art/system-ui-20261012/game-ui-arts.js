(() => {
  'use strict';

  const people = [
    { id: 'shen', name: '沈照', rank: '掌门', realm: 2, realmText: '炼气六层', insight: 240, portrait: 0, skills: { alchemy: 42, forge: 28, puppet: 22, talisman: 48 } },
    { id: 'lin', name: '林晚棠', rank: '内门', realm: 2, realmText: '炼气四层', insight: 180, portrait: 1, skills: { alchemy: 66, forge: 18, puppet: 26, talisman: 58 } },
    { id: 'zhao', name: '赵石', rank: '外门', realm: 2, realmText: '炼气二层', insight: 90, portrait: 2, skills: { alchemy: 18, forge: 72, puppet: 55, talisman: 20 } }
  ];
  const lawTypes = [['all', '全部'], ['heart', '心法'], ['sword', '招式'], ['spell', '术法'], ['array', '阵诀']];
  const laws = [
    {
      id: 'qingxi', name: '清溪养元诀', type: 'heart', typeName: '心法', icon: 'book', quality: '上乘', element: '水', through: '筑基', source: '沈氏家传 · 上下两卷', owned: true,
      brief: '以绵长水意涵养经脉，长于恢复与持久运转。',
      nodes: [
        { id: 'breath', name: '听息', stage: 0, icon: 'scroll', cost: 30, realm: 1, parents: [], effect: '调息恢复 +8%', desc: '收束杂念，辨明自身气息。', learned: ['shen', 'lin'] },
        { id: 'stream', name: '引溪入脉', stage: 0, icon: 'jade', cost: 60, realm: 1, parents: ['breath'], effect: '真气上限 +20', desc: '引细流循脉，积少成多。', learned: ['shen'] },
        { id: 'cycle', name: '周天回流', stage: 1, icon: 'book', cost: 90, realm: 2, parents: ['stream'], effect: '持续施术消耗 −6%', desc: '将散逸真气引回周天，适合连用术法。', learned: [] },
        { id: 'heal', name: '润脉', stage: 1, icon: 'herb', cost: 80, realm: 2, parents: ['stream'], effect: '轻伤调养速度 +12%', desc: '以柔和真气温养经脉，重伤仍须医治。', learned: [] },
        { id: 'ocean', name: '百川归海', stage: 2, icon: 'jade', cost: 180, realm: 3, parents: ['cycle', 'heal'], effect: '真气上限 +60', desc: '汇合支脉，筑成容纳百川的气海。', learned: [] }
      ]
    },
    {
      id: 'qinglan', name: '青岚剑诀', type: 'sword', typeName: '招式', icon: 'sword', quality: '精良', element: '木', through: '炼气', source: '云岫旧藏 · 全本', owned: true,
      brief: '剑势轻灵，先扰敌身法，再乘隙追击。',
      nodes: [
        { id: 'draw', name: '出鞘', stage: 0, icon: 'sword', cost: 30, realm: 1, parents: [], effect: '解锁招式「出鞘」', desc: '拔剑成势，攻击近身单一目标。', learned: ['shen', 'zhao'] },
        { id: 'wind', name: '拂柳', stage: 0, icon: 'sword', cost: 50, realm: 1, parents: ['draw'], effect: '命中后降低目标身法', desc: '顺其来势偏转兵刃，短暂牵制敌手。', learned: [] },
        { id: 'chase', name: '追岚', stage: 1, icon: 'sword', cost: 90, realm: 2, parents: ['wind'], effect: '对身法受损目标增伤', desc: '紧接拂柳追击，敌人脱离剑围后失效。', learned: [] },
        { id: 'return', name: '归剑', stage: 1, icon: 'sword', cost: 75, realm: 2, parents: ['wind'], effect: '收势时获得短暂守势', desc: '将攻势收回身前，减轻随后一次近战冲击。', learned: [] }
      ]
    },
    {
      id: 'dingyue', name: '定岳护身篇', type: 'spell', typeName: '术法', icon: 'stone', quality: '精良', element: '土', through: '炼气', source: '行商换得 · 全本', owned: true,
      brief: '稳固下盘，将土灵凝成近身护障。',
      nodes: [
        { id: 'stand', name: '抱石', stage: 0, icon: 'stone', cost: 35, realm: 1, parents: [], effect: '受击失衡降低', desc: '立定运气，维持稳定站姿。', learned: ['zhao', 'shen'] },
        { id: 'guard', name: '岩衣', stage: 0, icon: 'robe', cost: 60, realm: 1, parents: ['stand'], effect: '解锁护身术「岩衣」', desc: '凝成土灵护障，持续时身法略降。', learned: ['shen'] },
        { id: 'mountain', name: '定岳', stage: 1, icon: 'mountain', cost: 120, realm: 2, parents: ['guard'], effect: '岩衣护障强度 +20%', desc: '护障遭受重击时更加稳定。', learned: [] }
      ]
    },
    {
      id: 'huichun', name: '回春符解', type: 'spell', typeName: '术法', icon: 'herb', quality: '精良', element: '木', through: '筑基', source: '林氏药庐 · 上卷', owned: true,
      brief: '以符承载草木生机，辅助止血与调养。',
      nodes: [
        { id: 'ink', name: '辨药入墨', stage: 0, icon: 'herb', cost: 30, realm: 1, parents: [], effect: '可辨认回春符用料', desc: '识别灵药药性，避免冲突。', learned: ['lin'] },
        { id: 'bleed', name: '止血符', stage: 0, icon: 'scroll', cost: 60, realm: 1, parents: ['ink'], effect: '解锁止血符配方', desc: '用于常见外伤止血。', learned: [] },
        { id: 'spring', name: '回春符', stage: 1, icon: 'scroll', cost: 100, realm: 2, parents: ['bleed'], effect: '解锁回春符配方', desc: '辅助伤者调养，不能替代重伤诊治。', learned: [] },
        { id: 'rebirth', name: '续脉', stage: 2, icon: 'herb', cost: 190, realm: 3, parents: ['spring'], effect: '续接经脉的修行线索', desc: '下卷记有续脉法的用药与禁忌。', learned: [], missing: '尚缺下卷' }
      ]
    },
    {
      id: 'wuxing', name: '小五行阵录', type: 'array', typeName: '阵诀', icon: 'flag', quality: '上乘', element: '五行', through: '筑基', source: '藏经阁摹本 · 卷首', owned: true,
      brief: '五行互济，先识阵眼，再辨各处灵力流向。',
      nodes: [
        { id: 'eye', name: '识阵眼', stage: 0, icon: 'jade', cost: 40, realm: 1, parents: [], effect: '可查看已知阵眼状况', desc: '分辨阵法的主次节点与破损处。', learned: [] },
        { id: 'wood', name: '青木阵旗', stage: 0, icon: 'flag', cost: 65, realm: 1, parents: ['eye'], effect: '解锁青木阵旗配方', desc: '承载木行阵意，需与其余阵旗配合。', learned: [] },
        { id: 'cycle', name: '五行流转', stage: 1, icon: 'flag', cost: 130, realm: 2, parents: ['wood'], effect: '解锁小五行护阵', desc: '协调五处阵眼，须有对应灵力供给。', learned: [], missing: '尚缺中卷' }
      ]
    },
    {
      id: 'liuxia', name: '流霞御风诀', type: 'heart', typeName: '心法', icon: 'book', quality: '上乘', element: '风', through: '金丹', source: '望霞观访得目录 · 原卷待寻', owned: false,
      brief: '以霞气洗练周天，传有借风远行之法。',
      nodes: [
        { id: 'cloud', name: '采霞', stage: 0, icon: 'jade', cost: 70, realm: 1, parents: [], effect: '晨间修行加成', desc: '择天光初起时采纳霞气。', learned: [] },
        { id: 'wind', name: '御风', stage: 1, icon: 'boot', cost: 140, realm: 3, parents: ['cloud'], effect: '解锁短程御风', desc: '借风势跨越有限距离。', learned: [] },
        { id: 'travel', name: '流霞遁', stage: 2, icon: 'mountain', cost: 260, realm: 4, parents: ['wind'], effect: '长程遁行线索', desc: '完整法诀藏于传承后篇。', learned: [] }
      ]
    }
  ];
  const artsState = { law: 'qingxi', node: 'cycle', learner: 'shen', type: 'all', query: '', view: 'tree', study: [], from: '', returnPerson: '' };
  const groups = [
    { id: 'alchemy', label: '炼丹', icon: 'cauldron' },
    { id: 'forge', label: '炼器', icon: 'forge' },
    { id: 'puppet', label: '傀儡', icon: 'puppet' },
    { id: 'talisman', label: '符阵', icon: 'scroll' }
  ];
  const stock = {
    herb: { name: '青灵草', icon: 'herb', count: 32 },
    water: { name: '灵泉水', icon: 'jade', count: 16 },
    charcoal: { name: '松木炭', icon: 'wood', count: 24 },
    lotus: { name: '玉心莲', icon: 'herb', count: 0 },
    iron: { name: '玄铁', icon: 'stone', count: 18 },
    wood: { name: '灵木', icon: 'wood', count: 22 },
    jade: { name: '青玉', icon: 'jade', count: 8 },
    core: { name: '傀儡灵核', icon: 'jade', count: 1 },
    cinnabar: { name: '朱砂', icon: 'stone', count: 12 },
    paper: { name: '符纸', icon: 'scroll', count: 18 },
    thread: { name: '蚕丝', icon: 'robe', count: 6 }
  };
  const recipes = [
    { id: 'yangyuan', group: 'alchemy', name: '养元丹', icon: 'pill', quality: '一品', unit: '炉', yield: 4, outputUnit: '枚', time: 2, skill: 30, effect: '辅助调息 · 恢复真气', description: '温和药力缓慢化开，适合日常修行后的调息。', materials: [['herb', 6], ['water', 1], ['charcoal', 2]], steps: ['择药', '温炉', '凝丹'], worker: 'lin' },
    { id: 'yuxin', group: 'alchemy', name: '玉心丹', icon: 'pill', quality: '二品', unit: '炉', yield: 2, outputUnit: '枚', time: 4, skill: 60, effect: '安定心境 · 辅助入定', description: '以玉心莲为主药，散去修行前的杂念。', materials: [['lotus', 2], ['herb', 4], ['water', 2]], steps: ['醒莲', '合药', '收丹'], worker: 'lin' },
    { id: 'ironblade', group: 'forge', name: '玄铁剑', icon: 'sword', quality: '精良', unit: '柄', yield: 1, outputUnit: '柄', time: 3, skill: 40, effect: '近身兵器 · 坚实耐用', description: '以玄铁反复锻打，剑身厚实，适合正面交锋。', materials: [['iron', 5], ['wood', 2], ['charcoal', 3]], steps: ['冶炼', '锻打', '开刃'], worker: 'zhao' },
    { id: 'jadering', group: 'forge', name: '聚气玉环', icon: 'ring', quality: '精良', unit: '只', yield: 1, outputUnit: '只', time: 3, skill: 55, effect: '随身佩物 · 调息增益', description: '在青玉内刻入聚气纹路，温养佩戴者气息。', materials: [['jade', 3], ['iron', 2], ['cinnabar', 1]], steps: ['琢玉', '刻纹', '温养'], worker: 'zhao' },
    { id: 'woodpuppet', group: 'puppet', name: '运材木傀', icon: 'puppet', quality: '一阶', unit: '具', yield: 1, outputUnit: '具', time: 6, skill: 45, effect: '承担短途搬运', description: '以灵核驱动关节，可沿既定道路搬送营造用料。', materials: [['wood', 8], ['iron', 3], ['core', 1]], steps: ['制骨', '合榫', '启灵'], worker: 'zhao' },
    { id: 'stonepuppet', group: 'puppet', name: '守院石傀', icon: 'puppet', quality: '二阶', unit: '具', yield: 1, outputUnit: '具', time: 8, skill: 70, effect: '守卫指定院落', description: '玄铁筋骨配合厚重躯体，需更高的傀儡技艺。', materials: [['iron', 10], ['jade', 4], ['core', 2]], steps: ['铸骨', '布阵', '启灵'], worker: 'zhao' },
    { id: 'healtalisman', group: 'talisman', name: '止血符', icon: 'scroll', quality: '一品', unit: '批', yield: 3, outputUnit: '张', time: 1, skill: 25, effect: '随身符咒 · 外伤止血', description: '将药气封入符纸，伤时引动符纹。', materials: [['paper', 3], ['cinnabar', 2], ['herb', 2]], steps: ['研墨', '画符', '封气'], worker: 'lin' },
    { id: 'woodflag', group: 'talisman', name: '青木阵旗', icon: 'flag', quality: '一阶', unit: '面', yield: 1, outputUnit: '面', time: 3, skill: 45, effect: '阵法构件 · 木行阵眼', description: '承载木行阵意，用于小五行护阵。', materials: [['wood', 3], ['thread', 2], ['cinnabar', 2]], steps: ['缝幡', '绘纹', '注灵'], worker: 'shen' }
  ];
  const stations = [
    { id: 'dan-east', group: 'alchemy', name: '丹房 · 青铜丹炉', condition: '炉火平稳' },
    { id: 'dan-old', group: 'alchemy', name: '临时药庐 · 旧丹炉', condition: '炉壁破损，待修缮', unavailable: true },
    { id: 'forge-west', group: 'forge', name: '百工坊 · 锻台', condition: '风箱齐备' },
    { id: 'puppet-west', group: 'puppet', name: '百工坊 · 傀儡案', condition: '器具齐备' },
    { id: 'talisman-east', group: 'talisman', name: '藏经阁 · 符案', condition: '符墨齐备' }
  ];
  const craftState = {
    group: 'alchemy', recipe: 'yangyuan', quantity: 1, worker: 'lin', station: 'dan-east', nextId: 3,
    orders: [
      { id: 1, recipe: 'yangyuan', quantity: 1, worker: 'lin', station: 'dan-east', active: true, progress: 38 },
      { id: 2, recipe: 'ironblade', quantity: 1, worker: 'zhao', station: 'forge-west', active: false, progress: 0 }
    ]
  };
  const G = () => window.Game;
  const esc = value => G().escape(String(value));
  const icon = kind => G().icon(kind);
  const person = id => people.find(item => item.id === id) || people[0];
  const law = () => laws.find(item => item.id === artsState.law) || laws[0];
  const node = () => law().nodes.find(item => item.id === artsState.node) || law().nodes[0];
  const recipeById = id => recipes.find(item => item.id === id);
  const recipe = () => recipeById(craftState.recipe) || recipes[0];
  const stationById = id => stations.find(item => item.id === id);
  const learned = (item, learner) => item.learned.includes(learner.id);
  const studying = (art, item, learner) => artsState.study.find(order => order.law === art.id && order.node === item.id && order.person === learner.id);

  function requirements(art, item, learner) {
    const parentNodes = item.parents.map(id => art.nodes.find(other => other.id === id));
    return [
      { ok: art.owned && !item.missing, text: !art.owned ? '原卷待寻 · 望霞观' : item.missing || '原卷已收录' },
      { ok: learner.realm >= item.realm, text: `境界：${['', '养气', '炼气', '筑基', '金丹'][item.realm]} · 当前${learner.realmText}` },
      { ok: parentNodes.every(parent => learned(parent, learner)), text: parentNodes.length ? `前篇：${parentNodes.map(parent => parent.name).join('、')}` : '可从此篇开始' },
      { ok: learner.insight >= item.cost, text: `参悟：需 ${item.cost} · 现有 ${learner.insight}` }
    ];
  }
  function studyState(art, item, learner) {
    if (learned(item, learner)) return ['learned', '已通读'];
    if (studying(art, item, learner)) return ['studying', learner.rank === '掌门' ? '研习中' : '邀约待答复'];
    return requirements(art, item, learner).every(req => req.ok) ? ['ready', '可研习'] : ['locked', '待条件'];
  }
  function selectLaw(id) {
    const next = laws.find(item => item.id === id);
    if (!next) return;
    artsState.law = next.id;
    const learner = person(artsState.learner);
    artsState.node = (next.nodes.find(item => studyState(next, item, learner)[0] === 'ready') || next.nodes[0]).id;
  }
  function drawNode(art, item, learner) {
    const [status, label] = studyState(art, item, learner);
    return `<button class="arts-node ${status} ${item.id === artsState.node ? 'selected' : ''}" data-action="arts-node" data-id="${item.id}" data-parents="${item.parents.join(',')}" aria-pressed="${item.id === artsState.node}"><span class="icon-slot">${icon(item.icon)}</span><strong>${item.name}</strong><small>${label}</small></button>`;
  }
  function renderArts() {
    const art = law(), item = node(), learner = person(artsState.learner);
    const shown = laws.filter(other => (artsState.type === 'all' || other.type === artsState.type) && other.name.includes(artsState.query));
    const state = studyState(art, item, learner);
    const reqs = requirements(art, item, learner);
    const assigned = artsState.study.find(order => order.person === learner.id);
    const canStudy = state[0] === 'ready' && !assigned;
    return `<div class="arts-layout">
      <aside class="pane arts-catalog">
        ${artsState.from ? `<button class="game-button" data-action="arts-return">← 返回${artsState.from === 'bag' ? '行囊' : '人物'}</button>` : ''}
        <div class="pane-title"><h3>本门藏经</h3><span class="subtle">${laws.filter(other => other.owned).length} 部已收录</span></div>
        <div class="tab-row arts-filters">${lawTypes.map(([id, label]) => `<button data-action="arts-type" data-id="${id}" class="${artsState.type === id ? 'active' : ''}">${label}</button>`).join('')}</div>
        <label class="arts-search"><span class="subtle">寻卷</span><input data-field="arts-search" type="search" placeholder="功法名称" aria-label="查找功法" value="${esc(artsState.query)}"></label>
        <div class="scroll-area arts-law-list">${shown.map(other => `<button data-action="arts-law" data-id="${other.id}" class="arts-law ${art.id === other.id ? 'active' : ''}" aria-pressed="${art.id === other.id}"><span class="icon-slot">${icon(other.icon)}</span><span><strong>${other.name}</strong><small>${other.typeName} · ${other.element} · ${other.quality}</small></span><span class="${other.owned ? 'subtle' : 'gold'}">${other.owned ? other.through : '待寻'}</span></button>`).join('') || '<div class="empty-state">未找到这部功法</div>'}</div>
      </aside>
      <section class="pane arts-detail">
        <div class="arts-heading"><span class="icon-slot">${icon(art.icon)}</span><div><p class="subtle">${art.quality} · ${art.typeName} · ${art.element}行</p><h2>${art.name}</h2></div><span class="arts-realm">可修至<br><strong>${art.through}</strong></span></div>
        <p class="arts-intro">${art.brief}</p>
        <div class="tab-row"><button data-action="arts-view" data-id="tree" class="${artsState.view === 'tree' ? 'active' : ''}">传承脉络</button><button data-action="arts-view" data-id="source" class="${artsState.view === 'source' ? 'active' : ''}">卷册来历</button></div>
        ${artsState.view === 'tree' ? `<div class="arts-tree">${[0, 1, 2].filter(stage => art.nodes.some(other => other.stage === stage)).map(stage => `<section class="arts-stage"><h4>${['入门篇', '进境篇', '传承篇'][stage]}</h4><div class="arts-stage-nodes">${art.nodes.filter(other => other.stage === stage).map(other => drawNode(art, other, learner)).join('')}</div></section>`).join('')}</div><div class="arts-legend"><span class="good">● 已通读</span><span class="gold">○ 可研习</span><span class="subtle">◇ 待条件</span></div>` : `<div class="arts-source"><span class="icon-slot">${icon('scroll')}</span><h3>${art.source}</h3><p>${art.owned ? '已归入本门藏经，门人可按修行条件申请阅习。' : '卷目得自望霞观，需访得原卷后方能修习。'}</p><div class="data-row"><span>境界跨度</span><strong>养气 → ${art.through}</strong></div><div class="data-row"><span>已知篇目</span><strong>${art.nodes.length} 篇</strong></div><button class="game-button" data-action="arts-view" data-id="tree">查看传承脉络</button></div>`}
        <section class="arts-node-detail"><div class="pane-title"><h3>${item.name}</h3><span class="${state[0] === 'learned' ? 'good' : state[0] === 'locked' ? 'subtle' : 'gold'}">${state[1]}</span></div><p>${item.desc}</p><div class="arts-effect"><span class="icon-slot">${icon(item.icon)}</span><strong>${item.effect}</strong></div><p class="subtle">${item.parents.length ? `前置篇目：${item.parents.map(id => art.nodes.find(other => other.id === id).name).join(' → ')}` : '传承起点'} · 参悟所需 ${item.cost}</p></section>
      </section>
      <aside class="pane arts-side">
        <div class="pane-title"><h3>研习者</h3><span class="subtle">${people.length} 人</span></div>
        <div class="arts-learners">${people.map(other => `<button class="arts-learner ${learner.id === other.id ? 'active' : ''}" data-action="arts-learner" data-id="${other.id}" aria-pressed="${learner.id === other.id}">${G().portrait(other.portrait)}<span><strong>${other.name}</strong><small>${other.rank} · ${other.realmText}</small></span><span class="gold">${other.insight}<small>参悟</small></span></button>`).join('')}</div>
        <div class="pane-title"><h3>修习条件</h3><span class="subtle">${learner.name}</span></div>
        <ul class="arts-conditions">${reqs.map(req => `<li class="${req.ok ? 'good' : 'danger'}"><span aria-hidden="true">${req.ok ? '✓' : '◇'}</span>${req.text}</li>`).join('')}</ul>
        ${state[0] === 'learned' ? '<p class="good">此篇已通读，可继续选择后篇。</p>' : assigned ? `<div class="arts-current"><span class="subtle">${learner.rank === '掌门' ? '当前研习' : '邀约待答复'}</span><strong>${laws.find(other => other.id === assigned.law).name} · ${laws.find(other => other.id === assigned.law).nodes.find(other => other.id === assigned.node).name}</strong><small>参悟已留出 ${assigned.cost}</small><button class="game-button" data-action="arts-cancel" data-person="${learner.id}">${learner.rank === '掌门' ? '撤销研习' : '撤回邀约'}</button></div>` : `<button class="game-button primary" data-action="arts-study" ${canStudy ? '' : 'disabled'}>${learner.rank === '掌门' ? '开始研习' : '邀请研习'}</button><p class="subtle">${canStudy ? `所需参悟 ${item.cost}` : '修习条件尚未满足'}</p>`}
        <div class="arts-study-list"><h4>研习安排 <span class="subtle">${artsState.study.length}</span></h4>${artsState.study.map(order => `<div class="data-row"><span>${person(order.person).name}<small>${person(order.person).rank === '掌门' ? '研习中' : '邀约待答复'}</small></span><strong>${laws.find(other => other.id === order.law).nodes.find(other => other.id === order.node).name}</strong></div>`).join('') || '<p class="subtle">尚无待研习篇目</p>'}</div>
      </aside>
    </div>`;
  }
  function reserved(materialId) {
    return craftState.orders.reduce((sum, order) => sum + (recipeById(order.recipe).materials.find(([id]) => id === materialId)?.[1] || 0) * order.quantity, 0);
  }
  const available = id => stock[id].count - reserved(id);
  function craftRequirements(current = recipe()) {
    const worker = person(craftState.worker), station = stationById(craftState.station);
    const group = groups.find(item => item.id === current.group);
    const reasons = current.materials.flatMap(([id, count]) => available(id) < count * craftState.quantity ? [`${stock[id].name}还缺 ${count * craftState.quantity - available(id)}（可用 ${available(id)}）`] : []);
    if (worker.skills[current.group] < current.skill) reasons.push(`${worker.name}${group.label} ${worker.skills[current.group]}，需 ${current.skill}`);
    if (!station || station.group !== current.group) reasons.push('需选择适用工位');
    else if (station.unavailable) reasons.push(`${station.name}：${station.condition}`);
    return reasons;
  }
  function selectRecipe(id) {
    const current = recipeById(id);
    if (!current) return;
    craftState.recipe = id;
    craftState.group = current.group;
    craftState.quantity = 1;
    craftState.worker = current.worker;
    craftState.station = stations.find(item => item.group === current.group && !item.unavailable).id;
  }
  function orderWaiting(order, index) {
    if (order.active) return '制作中';
    const previous = craftState.orders.slice(0, index);
    const usingStation = previous.filter(other => other.station === order.station).length;
    if (usingStation) return `待工位 · 前有 ${usingStation} 单`;
    const usingWorker = previous.filter(other => other.worker === order.worker).length;
    return usingWorker ? `待${person(order.worker).name} · 前有 ${usingWorker} 单` : '待匠人接取';
  }
  function renderCrafts() {
    const current = recipe(), group = groups.find(item => item.id === craftState.group);
    const reasons = craftRequirements(current), worker = person(craftState.worker), station = stationById(craftState.station);
    const sameStation = craftState.orders.filter(order => order.station === station?.id).length;
    return `<div class="craft-layout">
      <aside class="pane craft-catalog"><div class="pane-title"><h3>百艺配方</h3><span class="subtle">${recipes.length} 方</span></div>
        <div class="panel-tabs craft-categories">${groups.map(item => `<button data-action="craft-group" data-id="${item.id}" aria-label="${item.label}" class="${item.id === craftState.group ? 'active' : ''}"><span class="icon-slot">${icon(item.icon)}</span>${item.label}</button>`).join('')}</div>
        <div class="scroll-area craft-recipe-list">${recipes.filter(item => item.group === craftState.group).map(item => `<button class="craft-recipe-item ${item.id === current.id ? 'active' : ''}" data-action="craft-recipe" data-id="${item.id}" aria-pressed="${item.id === current.id}"><span class="icon-slot">${icon(item.icon)}</span><span><strong>${item.name}</strong><small>${item.quality} · 每${item.unit} ${item.yield}${item.outputUnit}</small></span><span class="${item.materials.every(([id, count]) => available(id) >= count) ? 'good' : 'danger'}">${item.materials.every(([id, count]) => available(id) >= count) ? '有料' : '缺料'}</span></button>`).join('')}</div>
        <div class="craft-stock-note"><span class="icon-slot">${icon('wood')}</span><p class="subtle">公库用料 · 按单留存</p></div>
      </aside>
      <section class="pane craft-recipe"><div class="craft-heading"><span class="icon-slot">${icon(current.icon)}</span><div><p class="subtle">${group.label} · ${current.quality}</p><h2>${current.name}</h2><span>${current.effect}</span></div></div>
        <p class="craft-lore">${current.description}</p>
        <div class="craft-flow"><div class="craft-materials">${current.materials.map(([id, count]) => `<div class="craft-material ${available(id) < count * craftState.quantity ? 'shortage' : ''}"><span class="icon-slot">${icon(stock[id].icon)}</span><span><strong>${stock[id].name}</strong><small>可用 ${available(id)}</small></span><span class="${available(id) < count * craftState.quantity ? 'danger' : 'good'}">× ${count * craftState.quantity}</span></div>`).join('')}</div><div class="craft-vessel"><img src="${current.group==='alchemy'?'alchemy-cauldron.png':current.group==='forge'?'spirit-forge.png':current.group==='puppet'?'jade-puppet.png':'spirit-medicine.png'}" alt="${group.label}工艺"><span>${station?.name?.split(' · ')[1]||group.label}</span></div><div class="craft-result"><span class="icon-slot">${icon(current.icon)}</span><strong>${current.name}</strong><span class="gold">${current.yield * craftState.quantity} ${current.outputUnit}</span></div></div>
        <div class="craft-process">${current.steps.map((step, index) => `<span><small>${['一', '二', '三'][index]}</small>${step}</span>`).join('<b aria-hidden="true">→</b>')}</div>
        <div class="craft-settings"><div class="craft-quantity"><span>数量</span><button class="game-button" data-action="craft-minus" aria-label="减少制作数量" ${craftState.quantity <= 1 ? 'disabled' : ''}>−</button><strong aria-live="polite">${craftState.quantity} ${current.unit}</strong><button class="game-button" data-action="craft-plus" aria-label="增加制作数量" ${craftState.quantity >= 9 ? 'disabled' : ''}>＋</button><span class="subtle">约 ${current.time * craftState.quantity} 时辰</span></div>
          <div class="craft-choose"><span>匠人</span><small class="subtle">需要${group.label} ${current.skill}</small><div class="craft-worker-choices">${people.map(item => `<button class="craft-worker-choice ${item.id === worker.id ? 'active' : ''}" data-action="craft-worker" data-id="${item.id}" aria-pressed="${item.id === worker.id}" aria-label="选择${item.name}，${group.label}${item.skills[current.group]}">${G().portrait(item.portrait)}<span><strong>${item.name}</strong><small class="${item.skills[current.group] < current.skill ? 'danger' : 'subtle'}">${group.label} ${item.skills[current.group]}</small></span></button>`).join('')}</div></div>
          <div class="craft-choose"><span>工位</span><div class="craft-station-choices">${stations.filter(item => item.group === current.group).map(item => `<button class="craft-station-choice ${item.id === craftState.station ? 'active' : ''}" data-action="craft-station" data-id="${item.id}" aria-pressed="${item.id === craftState.station}"><strong>${item.name}</strong><small class="${item.unavailable ? 'danger' : 'subtle'}">${item.condition}${craftState.orders.some(order => order.station === item.id) ? ` · 已有 ${craftState.orders.filter(order => order.station === item.id).length} 单` : ''}</small></button>`).join('')}</div></div>
        </div>
        <div class="craft-submit">${reasons.length ? `<ul class="craft-reasons">${reasons.map(reason => `<li class="danger">${reason}</li>`).join('')}</ul>` : `<p class="good">用料齐备 · ${worker.name}可承接${sameStation ? ` · 按工位队列等候` : ''}</p>`}<button class="game-button primary" data-action="craft-add" ${reasons.length ? 'disabled' : ''}>安排工单 · ${current.yield * craftState.quantity}${current.outputUnit}</button></div>
      </section>
      <aside class="pane craft-side"><div class="pane-title"><h3>工单队列</h3><span class="subtle">${craftState.orders.length} 单</span></div><div class="scroll-area craft-orders">${craftState.orders.map((order, index) => { const item = recipeById(order.recipe); return `<article class="craft-order ${order.active ? 'working' : ''}"><div class="craft-order-title"><span class="icon-slot">${icon(item.icon)}</span><div><strong>${item.name} × ${order.quantity * item.yield}</strong><small>${person(order.worker).name} · ${item.quantity || order.quantity}${item.unit}</small></div><span class="${order.active ? 'good' : 'subtle'}">${orderWaiting(order, index)}</span></div><p class="subtle">${stationById(order.station).name}</p>${order.active ? G().bar('工序', order.progress, 100) : '<p class="subtle">用料已留出</p>'}<div class="craft-order-actions"><button class="game-button" data-action="craft-order-view" data-id="${order.id}">看配方</button><button class="game-button" data-action="craft-up" data-id="${order.id}" aria-label="提高${item.name}优先级" ${order.active || index === 0 || craftState.orders[index - 1].active ? 'disabled' : ''}>↑</button><button class="game-button" data-action="craft-down" data-id="${order.id}" aria-label="降低${item.name}优先级" ${order.active || index === craftState.orders.length - 1 || craftState.orders[index + 1]?.active ? 'disabled' : ''}>↓</button><button class="game-button" data-action="craft-cancel" data-id="${order.id}">撤销</button></div></article>`; }).join('') || '<div class="empty-state">工单已清空<br>从左侧选方，安排下一项制作。</div>'}</div><p class="subtle">前序工单优先，同一工位依次制作。</p></aside>
    </div>`;
  }

  function artsClick(button) {
    const { action, id } = button.dataset;
    if (action === 'arts-return' && artsState.from) { G().open(artsState.from, { person: artsState.returnPerson, ...(artsState.from === 'disciples' ? { detail: true } : {}) }); return; }
    else if (action === 'arts-law') selectLaw(id);
    else if (action === 'arts-node') {
      if (law().nodes.some(item => item.id === id)) artsState.node = id;
    } else if (action === 'arts-type') artsState.type = id;
    else if (action === 'arts-learner') {
      if (people.some(item => item.id === id)) artsState.learner = id;
    } else if (action === 'arts-view') artsState.view = id;
    else if (action === 'arts-study') {
      const art = law(), item = node(), learner = person(artsState.learner);
      if (studyState(art, item, learner)[0] !== 'ready' || artsState.study.some(order => order.person === learner.id)) return;
      learner.insight -= item.cost;
      artsState.study.push({ law: art.id, node: item.id, person: learner.id, cost: item.cost, status: learner.rank === '掌门' ? 'studying' : 'invited' });
      G().toast(learner.rank === '掌门' ? `已开始研习「${item.name}」` : `${learner.name} · 邀约待答复`);
    } else if (action === 'arts-cancel') {
      const index = artsState.study.findIndex(order => order.person === button.dataset.person);
      if (index < 0) return;
      const [order] = artsState.study.splice(index, 1);
      person(order.person).insight += order.cost;
      G().toast(person(order.person).rank === '掌门' ? '已撤销研习，参悟归还' : '已撤回邀约，参悟归还');
    } else return;
    G().refresh();
  }
  function craftsClick(button) {
    const { action, id } = button.dataset;
    if (action === 'craft-group') {
      const first = recipes.find(item => item.group === id);
      if (first) selectRecipe(first.id);
    } else if (action === 'craft-recipe') selectRecipe(id);
    else if (action === 'craft-worker') {
      if (people.some(item => item.id === id)) craftState.worker = id;
    } else if (action === 'craft-station') {
      if (stations.some(item => item.id === id && item.group === craftState.group)) craftState.station = id;
    }
    else if (action === 'craft-minus') craftState.quantity = Math.max(1, craftState.quantity - 1);
    else if (action === 'craft-plus') craftState.quantity = Math.min(9, craftState.quantity + 1);
    else if (action === 'craft-add') {
      const reasons = craftRequirements();
      if (reasons.length) { G().toast(reasons[0]); return; }
      craftState.orders.push({ id: craftState.nextId++, recipe: craftState.recipe, quantity: craftState.quantity, worker: craftState.worker, station: craftState.station, active: false, progress: 0 });
      G().toast(`已邀请${person(craftState.worker).name}制作${recipe().name}，用料已留出`);
    } else if (action === 'craft-cancel') {
      const index = craftState.orders.findIndex(order => order.id === Number(id));
      if (index < 0) return;
      const [removed] = craftState.orders.splice(index, 1);
      G().toast(`${recipeById(removed.recipe).name}工单已撤销，留料归还公库`);
    } else if (action === 'craft-up' || action === 'craft-down') {
      const index = craftState.orders.findIndex(order => order.id === Number(id));
      const target = index + (action === 'craft-up' ? -1 : 1);
      if (index < 0 || !craftState.orders[target] || craftState.orders[index].active || craftState.orders[target].active) return;
      [craftState.orders[index], craftState.orders[target]] = [craftState.orders[target], craftState.orders[index]];
      G().toast('工单次序已调整');
    } else if (action === 'craft-order-view') {
      const order = craftState.orders.find(item => item.id === Number(id));
      if (order) { selectRecipe(order.recipe); craftState.quantity = order.quantity; craftState.worker = order.worker; craftState.station = order.station; }
    } else return;
    G().refresh();
  }
  window.GamePanels = window.GamePanels || {};
  window.GamePanels.arts = {
    title: '功法', render: renderArts, click: artsClick,
    enter(params = {}) {
      artsState.from = ['master', 'disciples', 'bag'].includes(params.from) ? params.from : '';
      artsState.returnPerson = params.returnPerson || params.person;
      if (people.some(item => item.id === params.person)) artsState.learner = params.person;
      if (params.law) { artsState.query = ''; artsState.type = 'all'; selectLaw(params.law); }
    },
    input(element, eventType) {
      if (element.dataset.field !== 'arts-search' || eventType !== 'input') return;
      const cursor = element.selectionStart;
      artsState.query = element.value.trim();
      G().refresh();
      const replacement = document.querySelector('[data-field="arts-search"]');
      replacement?.focus();
      if (replacement && cursor !== null) replacement.setSelectionRange(cursor, cursor);
    }
  };
  window.GamePanels.crafts = {
    title: '百艺', render: renderCrafts, click: craftsClick,
    enter(params = {}) { if (params.recipe) selectRecipe(params.recipe); else if (params.group) { const first = recipes.find(item => item.group === params.group); if (first) selectRecipe(first.id); } },
    input(element, eventType) {
      if (eventType !== 'change') return;
      if (element.dataset.field === 'craft-worker' && people.some(item => item.id === element.value)) craftState.worker = element.value;
      else if (element.dataset.field === 'craft-station' && stations.some(item => item.id === element.value && item.group === craftState.group)) craftState.station = element.value;
      else return;
      G().refresh();
    }
  };
})();
