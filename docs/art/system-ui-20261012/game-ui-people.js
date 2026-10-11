(function () {
  'use strict';

  const panels = window.GamePanels = window.GamePanels || {};
  const g = () => window.Game;
  const esc = value => g().escape(String(value));
  const icon = kind => g().icon(kind);
  const button = (action, text, extra = '', primary = false) => `<button class="game-button${primary ? ' primary' : ''}" data-action="${action}" ${extra}>${text}</button>`;
  const slots = [
    { id: 'weapon', label: '法器', icon: 'sword' },
    { id: 'head', label: '冠饰', icon: 'jade' },
    { id: 'body', label: '法衣', icon: 'robe' },
    { id: 'feet', label: '步履', icon: 'boot' },
    { id: 'charm', label: '佩饰', icon: 'ring' }
  ];
  const people = [
    { id: 'lin', name: '林晚棠', portrait: 1, peak: '云岫主峰', rank: '内门', realm: '炼气四层', level: 4, art: '清溪养元诀', aptitude: '木水双灵根', talent: '草木亲和', work: '炼制养元丹', place: '青梧丹房', health: 93, energy: 76, mood: '安心', issue: '', skill: '药理 32 · 种植 46', experience: 412, next: 700, relation: '相知', story: '清晨换下了药圃的旧竹篱，留了一束新采的青芽。', promise: '午后照料药圃', guard: '回春诀' },
    { id: 'zhao', name: '赵石', portrait: 0, peak: '云岫主峰', rank: '外门', realm: '炼气二层', level: 2, art: '定岳护身篇', aptitude: '土金双灵根', talent: '筋骨坚韧', work: '运送木料', place: '西侧木场', health: 88, energy: 32, mood: '疲惫', issue: '精力偏低', skill: '营造 38 · 伐木 51', experience: 186, next: 420, relation: '信任', story: '答应将最后一车木料送回，随后便去膳房歇脚。', promise: '送完本车木料', guard: '磐石式' },
    { id: 'su', name: '苏见雪', portrait: 1, peak: '清溪峰', rank: '亲传', realm: '炼气七层', level: 7, art: '青岚剑诀', aptitude: '水灵根', talent: '澄心明剑', work: '研习剑诀', place: '清溪听雨台', health: 100, energy: 81, mood: '专注', issue: '', skill: '剑术 62 · 悟性 58', experience: 810, next: 1200, relation: '敬重', story: '将新悟的剑式抄成一页，盼着下次问剑。', promise: '酉时完成研习', guard: '流泉护体' },
    { id: 'gu', name: '顾长风', portrait: 0, peak: '赤炉峰', rank: '内门', realm: '炼气五层', level: 5, art: '青岚剑诀', aptitude: '火金双灵根', talent: '巧手', work: '炼制铁胚', place: '赤炉工坊', health: 91, energy: 59, mood: '平和', issue: '', skill: '炼器 56 · 营造 29', experience: 561, next: 850, relation: '熟识', story: '把炉边温度记在木牌上，反复校正淬火时机。', promise: '完成本炉铁胚', guard: '御火障' },
    { id: 'ye', name: '叶青禾', portrait: 1, peak: '青梧峰', rank: '外门', realm: '炼气三层', level: 3, art: '清溪养元诀', aptitude: '木土双灵根', talent: '细心', work: '修养轻伤', place: '青梧医庐', health: 57, energy: 65, mood: '安定', issue: '左臂轻伤', skill: '种植 41 · 药理 27', experience: 272, next: 540, relation: '友善', story: '昨日采药时擦伤左臂，已由医庐敷药。', promise: '今日休养', guard: '青藤缠护' },
    { id: 'wen', name: '温玄', portrait: 0, peak: '清溪峰', rank: '内门', realm: '炼气六层', level: 6, art: '清溪养元诀', aptitude: '水木双灵根', talent: '博闻', work: '整理藏经', place: '清溪藏经阁', health: 97, energy: 71, mood: '平和', issue: '', skill: '悟性 54 · 阵法 43', experience: 713, next: 1000, relation: '熟识', story: '正为三卷残篇编写索引，已找到两处缺页。', promise: '申时归还旧卷', guard: '凝水诀' },
    { id: 'lu', name: '陆怀川', portrait: 0, peak: '云岫主峰', rank: '外门', realm: '炼气一层', level: 1, art: '清溪养元诀', aptitude: '金木土三灵根', talent: '耐心', work: '山门值守', place: '云岫山门', health: 100, energy: 84, mood: '安心', issue: '', skill: '营造 22 · 悟性 26', experience: 80, next: 280, relation: '初识', story: '初入山门，认真记下了今日三位来客的名姓。', promise: '午时换班', guard: '定岳护身篇' },
    { id: 'bai', name: '白露', portrait: 1, peak: '青梧峰', rank: '内门', realm: '炼气五层', level: 5, art: '回春符解', aptitude: '木灵根', talent: '丹心', work: '候炉炼丹', place: '青梧丹房', health: 94, energy: 69, mood: '专注', issue: '等待丹炉', skill: '炼丹 61 · 药理 55', experience: 420, next: 850, relation: '信任', story: '材料已按份包好，还需等前一炉收丹。', promise: '今日一炉养气散', guard: '灵露护身' },
    { id: 'qiao', name: '乔远山', portrait: 0, peak: '赤炉峰', rank: '外门', realm: '炼气三层', level: 3, art: '定岳护身篇', aptitude: '土火双灵根', talent: '沉稳', work: '采石', place: '赤炉石场', health: 90, energy: 58, mood: '安心', issue: '', skill: '采石 49 · 营造 31', experience: 364, next: 540, relation: '熟识', story: '挑出了适合铺设殿阶的青石，另作一堆。', promise: '日落前一批青石', guard: '磐石式' },
    { id: 'tang', name: '唐疏月', portrait: 1, peak: '清溪峰', rank: '外门', realm: '炼气二层', level: 2, art: '清溪养元诀', aptitude: '水土双灵根', talent: '敏锐', work: '休息', place: '清溪竹舍', health: 100, energy: 43, mood: '平和', issue: '', skill: '符法 28 · 悟性 39', experience: 245, next: 420, relation: '友善', story: '昨夜守过山道，正在竹舍补眠。', promise: '暂无安排', guard: '凝水诀' },
    { id: 'he', name: '何砚秋', portrait: 0, peak: '青梧峰', rank: '亲传', realm: '炼气八层', level: 8, art: '回春符解', aptitude: '木火双灵根', talent: '识药', work: '下山采药', place: '云岫南麓', health: 92, energy: 61, mood: '平和', issue: '山外', skill: '药理 72 · 炼丹 66', experience: 1240, next: 1500, relation: '敬重', story: '今晨报平安，约定天黑前回到山门。', promise: '天黑前返山', guard: '青藤缠护' },
    { id: 'chen', name: '陈照微', portrait: 1, peak: '赤炉峰', rank: '内门', realm: '炼气四层', level: 4, art: '青岚剑诀', aptitude: '火灵根', talent: '专心', work: '研习符法', place: '赤炉静室', health: 98, energy: 79, mood: '专注', issue: '', skill: '符法 47 · 炼器 36', experience: 522, next: 700, relation: '熟识', story: '已画坏了三张符纸，第四张终于收住火意。', promise: '完成本页火符', guard: '御火障' }
  ];
  const roster = { peak: '全部', query: '', rank: '全部', filter: '全部', sort: 'default', page: 0, selected: 'lin', detail: false, tab: 'cultivation', invitation: '照料药圃' };
  const pageSize = 6;
  const requests = {};
  const master = { name: '沈照', health: 72, energy: 68, mana: 82, cultivation: 640, activity: '静候', place: '云岫静室', equipment: { weapon: 'old-sword', head: 'hairpin', body: 'cloud-robe', feet: 'cloth-boots', charm: 'jade-pendant' } };
  const items = [
    { id: 'cloud-sword', name: '云纹剑', kind: 'sword', category: '装备', slot: 'weapon', quality: '灵品', tier: 3, count: 1, attack: 18, defense: 0, info: '剑身轻盈，导引灵气时隐有青纹。', source: '南麓试炼所得', use: '炼气三层以上可用', detail: '攻伐 +18 · 灵力消耗 −4%' },
    { id: 'old-sword', name: '青锋剑', kind: 'sword', category: '装备', slot: 'weapon', quality: '凡品', tier: 1, count: 0, attack: 9, defense: 0, info: '随身旧剑，刃口经数次修磨。', source: '入山随身携带', use: '掌门可装备', detail: '攻伐 +9' },
    { id: 'hairpin', name: '乌木簪', kind: 'wood', category: '装备', slot: 'head', quality: '凡品', tier: 1, count: 0, attack: 0, defense: 1, info: '乌木磨制的束发簪。', source: '入山随身携带', use: '掌门可装备', detail: '护体 +1' },
    { id: 'cloud-robe', name: '青云法衣', kind: 'robe', category: '装备', slot: 'body', quality: '良品', tier: 2, count: 0, attack: 0, defense: 7, info: '衣内缝有细密护身纹路。', source: '百工坊织造', use: '掌门可装备', detail: '护体 +7' },
    { id: 'hemp-robe', name: '素麻道袍', kind: 'robe', category: '装备', slot: 'body', quality: '凡品', tier: 1, count: 1, attack: 0, defense: 3, info: '素净耐穿，适宜日常劳作。', source: '山下集市购入', use: '掌门可装备', detail: '护体 +3' },
    { id: 'cloth-boots', name: '布底履', kind: 'boot', category: '装备', slot: 'feet', quality: '凡品', tier: 1, count: 0, attack: 0, defense: 2, info: '靴底新纳过一层粗布。', source: '入山随身携带', use: '掌门可装备', detail: '护体 +2' },
    { id: 'wind-boots', name: '踏风履', kind: 'boot', category: '装备', slot: 'feet', quality: '良品', tier: 2, count: 1, attack: 0, defense: 4, info: '步履轻快，山路行走更为省力。', source: '山下集市购入', use: '掌门可装备', detail: '护体 +4 · 移速 +5%' },
    { id: 'jade-pendant', name: '温玉佩', kind: 'jade', category: '装备', slot: 'charm', quality: '良品', tier: 2, count: 0, attack: 0, defense: 3, info: '握在掌心微温，定神养气。', source: '家传旧物', use: '掌门可装备', detail: '护体 +3 · 养气 +2%' },
    { id: 'spirit-ring', name: '凝神环', kind: 'ring', category: '装备', slot: 'charm', quality: '灵品', tier: 3, count: 1, attack: 3, defense: 5, info: '银环内侧刻有凝神小篆。', source: '赤炉工坊炼成', use: '掌门可装备', detail: '攻伐 +3 · 护体 +5' },
    { id: 'healing-pill', name: '回春丹', kind: 'pill', category: '丹药', quality: '良品', tier: 2, count: 5, effect: 'health', amount: 20, info: '温养血气，用于调理轻伤。', source: '青梧丹房 · 白露', use: '气血未满时可服用', detail: '恢复气血 20' },
    { id: 'energy-pill', name: '养气散', kind: 'pill', category: '丹药', quality: '凡品', tier: 1, count: 3, effect: 'energy', amount: 25, info: '气味清淡，能缓解一日劳顿。', source: '青梧丹房', use: '精力未满时可服用', detail: '恢复精力 25' },
    { id: 'mana-pill', name: '回灵丸', kind: 'pill', category: '丹药', quality: '良品', tier: 2, count: 2, effect: 'mana', amount: 30, info: '药力徐徐散入经脉，补足灵气。', source: '山下集市购入', use: '灵力未满时可服用', detail: '恢复灵力 30' },
    { id: 'herb', name: '凝露草', kind: 'herb', category: '材料', quality: '凡品', tier: 1, count: 18, info: '叶上凝露不散，是常见的温养灵草。', source: '东坡药圃收获', use: '回春丹、养气散的炼制材料', detail: '药性温和 · 木属' },
    { id: 'iron', name: '玄铁', kind: 'stone', category: '材料', quality: '良品', tier: 2, count: 8, info: '乌黑沉重，适合锻造法器。', source: '赤炉石场采得', use: '法器、傀儡的炼制材料', detail: '坚硬 · 金属' },
    { id: 'wood', name: '青松木', kind: 'wood', category: '材料', quality: '凡品', tier: 1, count: 12, info: '纹理细直，略带松香。', source: '西侧木场运回', use: '营造与百工制作材料', detail: '韧性良好 · 木属' },
    { id: 'stone', name: '青石', kind: 'stone', category: '材料', quality: '凡品', tier: 1, count: 9, info: '纹理坚实，切面平整。', source: '云岫石场采得', use: '台阶、地基和院墙的营造材料', detail: '营造材料' },
    { id: 'scroll', name: '清溪手札', kind: 'scroll', category: '典籍', quality: '良品', tier: 2, count: 1, info: '前人将吐纳要领录在薄册之中。', source: '藏经阁抄录', use: '查看清溪养元诀', detail: '传承注解 · 已抄录入藏经' }
  ];
  const bag = { category: '全部', query: '', selected: 'cloud-sword', sorted: false, store: {}, notice: '' };
  const getItem = id => items.find(item => item.id === id);
  const getPerson = () => people.find(person => person.id === roster.selected) || people[0];
  const peakNames = ['全部', '云岫主峰', '清溪峰', '青梧峰', '赤炉峰'];

  function filteredPeople() {
    const q = roster.query.trim().toLowerCase();
    const result = people.filter(person => (roster.peak === '全部' || person.peak === roster.peak) && (roster.rank === '全部' || person.rank === roster.rank) && (roster.filter === '全部' || (roster.filter === '需留意' ? Boolean(person.issue) : Boolean(requests[person.id]))) && (!q || [person.name, person.art, person.work, person.skill, person.peak, person.issue].some(value => value.toLowerCase().includes(q))));
    if (roster.sort === 'realm') result.sort((a, b) => b.level - a.level);
    if (roster.sort === 'energy') result.sort((a, b) => a.energy - b.energy);
    return result;
  }

  function personSummary(person) {
    const request = requests[person.id];
    return `<aside class="pane people-summary"><div class="people-summary-head">${g().portrait(person.portrait)}<div><h3>${person.name}</h3><div class="subtle">${person.peak} · ${person.rank}</div><strong class="gold">${person.realm}</strong></div></div>
      <div class="people-current"><span class="subtle">正在</span><strong>${request ? '收到事务邀约' : person.work}</strong><span>${person.place}</span></div>
      ${g().bar('气血', person.health, 100, person.health < 60 ? 'red' : 'jade')}${g().bar('精力', person.energy, 100, person.energy < 40 ? 'gold' : 'jade')}
      <dl class="people-facts"><div><dt>所修</dt><dd>${person.art}</dd></div><div><dt>专长</dt><dd>${person.skill}</dd></div><div><dt>心情</dt><dd>${person.mood}</dd></div><div><dt>当前承诺</dt><dd>${person.promise}</dd></div></dl>
      ${person.issue ? `<p class="people-attention">${person.issue} · ${person.id === 'ye' ? '宜先完成休养' : person.id === 'zhao' ? '本次劳作后需要休息' : person.id === 'he' ? '天黑前预计返山' : '待丹炉空闲后继续'}</p>` : ''}
      <div class="toolbar">${button('person-detail', '打开人物志', '', true)}${button('person-locate', '定位')}</div>
      <div class="people-invitation"><h4>事务邀约</h4>${request ? `<p class="gold">已邀约：${request.job}</p><p class="subtle">等待${person.name}回应；当前承诺保留。</p>${button('invite-withdraw', '撤回邀约')}` : `<label class="subtle" for="people-invite-job">希望邀请承担</label><select id="people-invite-job" data-field="invite-job">${['照料药圃', '运送材料', '研习功法', '山门值守'].map(job => `<option${roster.invitation === job ? ' selected' : ''}>${job}</option>`).join('')}</select>${button('person-invite', '发出邀约')}`}</div>
    </aside>`;
  }

  function renderRoster() {
    const list = filteredPeople();
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    roster.page = Math.min(roster.page, pages - 1);
    if (list.length && !list.some(person => person.id === roster.selected)) roster.selected = list[0].id;
    const visible = list.slice(roster.page * pageSize, (roster.page + 1) * pageSize);
    return `<div class="people-layout">
      <aside class="pane people-peaks"><h3 class="pane-title">各峰门籍</h3>${peakNames.map(peak => `<button class="people-peak${roster.peak === peak ? ' active' : ''}" data-action="people-peak" data-peak="${peak}"><span>${peak === '全部' ? '全宗门' : peak}</span><b>${peak === '全部' ? people.length : people.filter(p => p.peak === peak).length}</b></button>`).join('')}<div class="people-peak-note"><span class="subtle">全宗门</span><strong>12 位门人</strong><span>外门 5 · 内门 5 · 亲传 2</span></div></aside>
      <section class="pane people-roster"><div class="pane-title"><h3>门人名册</h3><span class="subtle">${list.length} 人</span></div><div class="toolbar people-search"><input aria-label="搜索门人" data-field="people-search" placeholder="姓名、所修功法、专长" value="${esc(roster.query)}"><select aria-label="门籍" data-field="people-rank">${['全部', '外门', '内门', '亲传'].map(rank => `<option value="${rank}"${roster.rank === rank ? ' selected' : ''}>${rank === '全部' ? '全部门籍' : rank}</option>`).join('')}</select></div>
      <div class="toolbar people-filter"><div class="tab-row">${['全部', '需留意', '已邀约'].map(filter => `<button class="${roster.filter === filter ? 'active' : ''}" data-action="people-filter" data-filter="${filter}">${filter}${filter === '需留意' ? ' 4' : filter === '已邀约' ? ` ${Object.keys(requests).length}` : ''}</button>`).join('')}</div><select aria-label="排列名册" data-field="people-sort"><option value="default"${roster.sort === 'default' ? ' selected' : ''}>名册顺序</option><option value="realm"${roster.sort === 'realm' ? ' selected' : ''}>修为高低</option><option value="energy"${roster.sort === 'energy' ? ' selected' : ''}>精力由低到高</option></select></div>
      <div class="scroll-area people-table-wrap"><table class="people-table"><thead><tr><th>门人</th><th>门籍 / 修为</th><th>当前事务</th><th>精力 / 身况</th></tr></thead><tbody>${visible.map(person => `<tr class="${roster.selected === person.id ? 'selected' : ''}"><td><button class="people-person-button" data-action="people-select" data-id="${person.id}" aria-pressed="${roster.selected === person.id}">${g().portrait(person.portrait)}<span><strong>${person.name}</strong><small>${person.peak}</small></span></button></td><td><span>${person.rank}</span><small>${person.realm}</small></td><td><span>${requests[person.id] ? '待回应邀约' : person.work}</span><small>${person.place}</small></td><td><span class="${person.energy < 40 ? 'danger' : ''}">${person.energy} / 100</span><small class="${person.issue ? 'gold' : 'subtle'}">${person.issue || '安好'}</small></td></tr>`).join('')}</tbody></table>${!list.length ? '<div class="empty-state">未找到符合条件的门人。<br>可更换峰别或搜索词。</div>' : ''}</div>
      <div class="people-pagination">${button('people-prev', '上一页', roster.page === 0 ? 'disabled' : '')}<span>第 ${roster.page + 1} / ${pages} 页</span>${button('people-next', '下一页', roster.page + 1 >= pages ? 'disabled' : '')}</div></section>
      ${list.length ? personSummary(getPerson()) : '<aside class="pane people-summary"><div class="empty-state">选择名册中的一位门人<br>查看身况与当前事务</div></aside>'}
    </div>`;
  }

  function personDetailBody(person) {
    if (roster.tab === 'cultivation') return `<h3 class="pane-title">当前修行</h3><div class="profile-art-focus"><span class="icon-slot">${icon('book')}</span><div><h3>${person.art}</h3><span class="subtle">炼气篇 · 正在研习</span></div></div>${g().bar('修为', person.experience, person.next)}<dl class="people-facts"><div><dt>灵根</dt><dd>${person.aptitude}</dd></div><div><dt>禀赋</dt><dd>${person.talent}</dd></div><div><dt>专长</dt><dd>${person.skill}</dd></div></dl><div class="profile-config"><div><span>守御</span><strong>${person.guard}</strong></div><div><span>近日心得</span><p>${person.story}</p></div></div>${button('person-art', '查阅所修功法')}`;
    if (roster.tab === 'equipment') return `<h3 class="pane-title">随身装备</h3><div class="profile-equipment-list">${[{ label: '法器', kind: 'sword', name: person.level > 5 ? '凝霜长剑' : '青锋剑', note: '随身佩用' }, { label: '法衣', kind: 'robe', name: `${person.peak.substring(0, 2)}道袍`, note: '完好' }, { label: '步履', kind: 'boot', name: '布底履', note: '完好' }, { label: '佩饰', kind: 'jade', name: '门籍玉牌', note: `${person.rank}门籍` }].map(item => `<div class="data-row"><span class="icon-slot">${icon(item.kind)}</span><div><small>${item.label}</small><strong>${item.name}</strong></div><span class="subtle">${item.note}</span></div>`).join('')}</div><p class="subtle">${person.name}正在使用这些装备。</p>`;
    if (roster.tab === 'health') return `<h3 class="pane-title">身况</h3>${g().bar('气血', person.health, 100, person.health < 60 ? 'red' : 'jade')}${g().bar('精力', person.energy, 100, person.energy < 40 ? 'gold' : 'jade')}<div class="profile-condition"><strong>${person.id === 'ye' ? '左臂轻伤' : person.id === 'zhao' ? '劳作疲惫' : '气息平稳'}</strong><p>${person.id === 'ye' ? '擦伤已敷药，今日正在医庐休养。' : person.id === 'zhao' ? '今日往返木场多次，已准备在送完木料后歇息。' : '经脉运行平稳，可以照常工作和修行。'}</p></div><dl class="people-facts"><div><dt>心情</dt><dd>${person.mood}</dd></div><div><dt>所在</dt><dd>${person.place}</dd></div><div><dt>现有承诺</dt><dd>${person.promise}</dd></div></dl>`;
    return `<h3 class="pane-title">人情纪事</h3><div class="profile-relation"><span class="icon-slot">${icon('person')}</span><div><strong>与掌门 · ${person.relation}</strong><p>${person.story}</p></div></div><div class="profile-relation"><span class="icon-slot">${icon('flag')}</span><div><strong>${person.peak} · ${person.rank}</strong><p>在峰中修行，并依自身意愿承担事务。</p></div></div><h4>当前约定</h4><p>${person.promise}</p>${requests[person.id] ? `<p class="gold">另有邀约待回应：${requests[person.id].job}</p>` : ''}`;
  }

  function renderPersonDetail() {
    const person = getPerson();
    return `<div class="people-detail"><div class="people-detail-nav">${button('people-back', '‹ 返回名册')}<span class="subtle">${roster.peak === '全部' ? '全宗门' : roster.peak} / ${person.name}</span><div class="toolbar">${button('person-previous', '上一位')}${button('person-next', '下一位')}</div></div><div class="people-detail-layout"><aside class="pane profile-person"><div class="profile-person-portrait">${g().portrait(person.portrait, true)}</div><h2>${person.name}</h2><p class="gold">${person.realm} · ${person.rank}</p><p>${person.peak}</p><div class="people-current"><span class="subtle">当前事务</span><strong>${person.work}</strong><span>${person.place}</span></div>${button('person-locate', '在山院中定位')}</aside><section class="pane people-detail-content"><nav class="panel-tabs">${[['cultivation', '修行'], ['equipment', '装备'], ['health', '身况'], ['relations', '关系']].map(([id, title]) => `<button data-action="person-tab" data-tab="${id}" class="${roster.tab === id ? 'active' : ''}">${title}</button>`).join('')}</nav><div class="people-detail-body">${personDetailBody(person)}</div></section>${personSummary(person)}</div></div>`;
  }

  function equipmentBody(compact = false) {
    return `<div class="profile-equipment-body${compact ? ' compact' : ''}"><div class="profile-body-portrait">${g().portrait(0, true)}</div>${slots.map(slot => { const item = getItem(master.equipment[slot.id]); return `<button class="profile-equip-slot profile-slot-${slot.id}" data-action="equipment-slot" data-slot="${slot.id}" data-id="${item.id}" aria-label="${slot.label}：${item.name}，查看装备"><span class="subtle">${slot.label}</span><span class="icon-slot profile-item-tier-${item.tier}">${icon(item.kind)}</span><strong>${item.name}</strong></button>`; }).join('')}</div>`;
  }

  function masterStats() {
    const equipped = Object.values(master.equipment).map(getItem);
    return { attack: 26 + equipped.reduce((sum, item) => sum + item.attack, 0), defense: 12 + equipped.reduce((sum, item) => sum + item.defense, 0) };
  }

  function renderMaster() {
    const stats = masterStats();
    return `<div class="profile-layout"><aside class="pane profile-vitals"><h3 class="pane-title">身况</h3>${g().bar('气血', master.health, 100, master.health < 60 ? 'red' : 'jade')}${g().bar('精力', master.energy, 100)}${g().bar('灵力', master.mana, 120)}<div class="profile-condition"><strong>${master.health < 100 ? '肩背余伤' : '气血充盈'}</strong><p>${master.health < 100 ? '伤势已稳定，调息与丹药有助于恢复。' : '旧伤渐愈，运气已无滞涩。'}</p></div><div class="profile-stat-grid"><div class="stat-pair"><span>攻伐</span><strong>${stats.attack}</strong></div><div class="stat-pair"><span>护体</span><strong>${stats.defense}</strong></div><div class="stat-pair"><span>神识</span><strong>42</strong></div><div class="stat-pair"><span>根骨</span><strong>上佳</strong></div></div><div class="toolbar">${button('master-breathe', master.activity === '调息中' ? '收功' : '调息', '', true)}${button('master-medicine', '查看丹药')}</div><p class="subtle profile-activity">${master.activity} · ${master.place}</p></aside>
      <section class="pane profile-person"><div class="profile-heading"><h2>${master.name}</h2><span>云岫掌门 · 炼气六层</span></div>${equipmentBody()}<div class="profile-equipment-footer"><span class="subtle">随身装备</span>${button('master-bag', '打开行囊')}</div></section>
      <section class="pane profile-cultivation"><h3 class="pane-title">修行</h3>${g().bar('修为', master.cultivation, 1000)}<div class="profile-realm"><strong>炼气六层</strong><span class="subtle">下一层 · 修为尚差 ${1000 - master.cultivation}</span></div><div class="profile-config">${[['心法', '清溪养元诀', 'book', '吐纳养气 · 炼气篇'], ['攻伐', '青岚剑诀', 'sword', '近身剑招 · 已习得'], ['守御', '定岳护身篇', 'jade', '护持心神 · 已习得']].map(([label, name, kind, detail]) => `<button class="profile-art-slot" data-action="master-art" data-art="${name}"><span class="icon-slot">${icon(kind)}</span><span><small>${label}</small><strong>${name}</strong><span class="subtle">${detail}</span></span><b>›</b></button>`).join('')}</div><div class="profile-practice"><p>${master.activity === '修炼中' ? '已在静室静心吐纳。' : '静室可用，灵气平稳。'}</p>${button('master-practice', master.activity === '修炼中' ? '结束修炼' : '开始修炼', '', true)}</div></section></div>`;
  }

  function filteredItems() {
    const q = bag.query.trim();
    const result = items.filter(item => item.count > 0 && (bag.category === '全部' || item.category === bag.category) && (!q || item.name.includes(q)));
    if (bag.sorted) result.sort((a, b) => b.tier - a.tier || a.category.localeCompare(b.category, 'zh'));
    return result;
  }

  function renderBagDetail() {
    const item = getItem(bag.selected);
    if (!item) return '<div class="empty-state">选择一件随身物品<br>查看属性与用途</div>';
    const equipped = item.slot && master.equipment[item.slot] === item.id;
    return `<div class="bag-item-heading"><span class="icon-slot bag-featured-icon profile-item-tier-${item.tier}">${icon(item.kind)}</span><span><h3>${item.name}</h3><span class="gold">${item.quality} · ${item.category}</span></span></div><p class="bag-description">${item.info}</p><div class="bag-item-effect">${item.detail}</div><dl class="people-facts"><div><dt>数量</dt><dd>行囊 ${item.count}${equipped ? ' · 已装备 1' : ''}</dd></div><div><dt>用途</dt><dd>${item.use}</dd></div><div><dt>来源</dt><dd>${item.source}</dd></div>${item.slot ? `<div><dt>当前部位</dt><dd>${slots.find(slot => slot.id === item.slot).label} · ${getItem(master.equipment[item.slot]).name}</dd></div>` : ''}</dl>
      ${item.slot && !equipped ? `<div class="bag-compare"><h4>更换后</h4><span>攻伐 <b class="${item.attack - getItem(master.equipment[item.slot]).attack < 0 ? 'danger' : 'good'}">${signed(item.attack - getItem(master.equipment[item.slot]).attack)}</b></span><span>护体 <b class="${item.defense - getItem(master.equipment[item.slot]).defense < 0 ? 'danger' : 'good'}">${signed(item.defense - getItem(master.equipment[item.slot]).defense)}</b></span></div>` : ''}
      <div class="bag-item-actions">${item.slot ? button('bag-equip', equipped ? '已装备' : '装备', equipped || item.count === 0 ? 'disabled' : '', true) : item.effect ? button('bag-consume', '服用一份', item.count === 0 || master[item.effect] >= (item.effect === 'mana' ? 120 : 100) ? 'disabled' : '', true) : item.id === 'scroll' ? button('bag-read', '查阅手札', '', true) : '<p class="subtle">存入公库后可用于宗门工单。</p>'}${button('bag-store', '移入公库 ×1', item.count === 0 ? 'disabled' : '')}</div>${bag.notice ? `<p class="bag-notice good" role="status">${esc(bag.notice)}</p>` : ''}`;
  }

  const signed = number => number > 0 ? `+${number}` : String(number);

  function renderBag() {
    const visible = filteredItems();
    const carried = items.filter(item => item.count > 0).length;
    const deposited = Object.values(bag.store).reduce((sum, count) => sum + count, 0);
    return `<div class="bag-layout"><section class="pane bag-equipment"><div class="pane-title"><h3>${master.name}</h3><span class="subtle">随身装备</span></div>${equipmentBody(true)}${g().bar('气血', master.health, 100)}${g().bar('精力', master.energy, 100)}<div class="toolbar">${button('bag-master', '人物详情')}</div></section><section class="pane bag-inventory"><div class="pane-title"><h3>随身行囊</h3><span class="subtle">${carried} / 24 格</span></div><div class="tab-row bag-categories">${['全部', '装备', '丹药', '材料', '典籍'].map(category => `<button class="${bag.category === category ? 'active' : ''}" data-action="bag-category" data-category="${category}">${category}</button>`).join('')}</div><div class="toolbar"><input data-field="bag-search" aria-label="搜索行囊" placeholder="查找物品" value="${esc(bag.query)}">${button('bag-sort', bag.sorted ? '已按品相整理' : '整理')}</div><div class="bag-grid">${visible.map(item => `<button class="bag-slot profile-item-tier-${item.tier}${bag.selected === item.id ? ' selected' : ''}" data-action="bag-select" data-id="${item.id}" aria-label="${item.name}，${item.count}份"><span class="bag-slot-icon">${icon(item.kind)}</span><span class="bag-slot-name">${item.name}</span><b>${item.count}</b></button>`).join('')}${Array.from({ length: Math.max(0, 18 - visible.length) }, () => '<div class="bag-slot empty" aria-hidden="true"></div>').join('')}</div>${!visible.length ? '<p class="empty-state">此分类下暂无物品。</p>' : ''}<div class="bag-inventory-footer"><span>公库已收：${deposited} 份</span><span class="subtle">${bag.sorted ? '按品相排列' : '按收纳顺序排列'}</span></div></section><aside class="pane bag-detail">${renderBagDetail()}</aside></div>`;
  }

  function openArt(name, personId) {
    const law = { '清溪养元诀': 'qingxi', '青岚剑诀': 'qinglan', '定岳护身篇': 'dingyue', '回春符解': 'huichun', '小五行阵录': 'wuxing' }[name];
    if (!law) { g().toast(`${name}尚未收入本门藏经。`); return; }
    g().open('arts', { law, person: ['lin', 'zhao', 'shen'].includes(personId) ? personId : undefined, from: g().current, returnPerson: personId });
  }

  function handleDisciples(buttonElement) {
    const d = buttonElement.dataset;
    const person = getPerson();
    if (d.action === 'people-peak') { roster.peak = d.peak; roster.page = 0; }
    else if (d.action === 'people-filter') { roster.filter = d.filter; roster.page = 0; }
    else if (d.action === 'people-select') roster.selected = d.id;
    else if (d.action === 'people-prev') roster.page = Math.max(0, roster.page - 1);
    else if (d.action === 'people-next') roster.page++;
    else if (d.action === 'person-detail') { roster.detail = true; roster.tab = 'cultivation'; }
    else if (d.action === 'people-back') roster.detail = false;
    else if (d.action === 'person-tab') roster.tab = d.tab;
    else if (d.action === 'person-next' || d.action === 'person-previous') { const list = filteredPeople(); const i = list.findIndex(p => p.id === person.id); roster.selected = list[(i + (d.action === 'person-next' ? 1 : -1) + list.length) % list.length]?.id || person.id; }
    else if (d.action === 'person-invite') { requests[person.id] = { job: roster.invitation }; g().toast(`已向${person.name}发出「${roster.invitation}」邀约，等待回应。`); }
    else if (d.action === 'invite-withdraw') { delete requests[person.id]; g().toast(`已撤回给${person.name}的事务邀约。`); }
    else if (d.action === 'person-locate') { g().open('scene', { person: person.id, label: `${person.name} · ${person.place}` }); return; }
    else if (d.action === 'person-art') { openArt(person.art, person.id); return; }
    else return;
    g().refresh();
  }

  function handlePeopleInput(element, eventType) {
    const field = element.dataset.field;
    if (field === 'invite-job') { roster.invitation = element.value; return; }
    if (field === 'people-search') roster.query = element.value;
    else if (field === 'people-rank') roster.rank = element.value;
    else if (field === 'people-sort') roster.sort = element.value;
    else return;
    roster.page = 0;
    g().refresh();
  }

  function handleMaster(buttonElement) {
    const d = buttonElement.dataset;
    if (d.action === 'equipment-slot') { g().open('bag', { selected: d.id, category: '装备' }); return; }
    if (d.action === 'master-bag') { g().open('bag'); return; }
    if (d.action === 'master-medicine') { g().open('bag', { selected: 'healing-pill', category: '丹药' }); return; }
    if (d.action === 'master-art') { openArt(d.art, 'shen'); return; }
    if (d.action === 'master-breathe') { master.activity = master.activity === '调息中' ? '静候' : '调息中'; g().toast(master.activity === '调息中' ? '沈照已在静室调息。' : '沈照已收功。'); }
    else if (d.action === 'master-practice') { master.activity = master.activity === '修炼中' ? '静候' : '修炼中'; g().toast(master.activity === '修炼中' ? '沈照开始研习清溪养元诀。' : '沈照结束本次修炼。'); }
    else return;
    g().refresh();
  }

  function handleBag(buttonElement) {
    const d = buttonElement.dataset;
    const item = getItem(bag.selected);
    if (d.action === 'bag-category') { bag.category = d.category; bag.notice = ''; }
    else if (d.action === 'bag-select' || d.action === 'equipment-slot') { bag.selected = d.id; bag.notice = ''; }
    else if (d.action === 'bag-sort') { bag.sorted = true; bag.notice = '已按品相整理行囊。'; }
    else if (d.action === 'bag-master') { g().open('master'); return; }
    else if (d.action === 'bag-read') { openArt('清溪养元诀', 'shen'); return; }
    else if (d.action === 'bag-equip' && item?.slot && item.count > 0 && master.equipment[item.slot] !== item.id) { const old = getItem(master.equipment[item.slot]); item.count--; old.count++; master.equipment[item.slot] = item.id; bag.notice = `已装备${item.name}，${old.name}放回行囊。`; g().toast(bag.notice); }
    else if (d.action === 'bag-consume' && item?.effect && item.count > 0) { const limit = item.effect === 'mana' ? 120 : 100; const restored = Math.min(item.amount, limit - master[item.effect]); if (restored <= 0) return; item.count--; master[item.effect] += restored; bag.notice = `服用${item.name}，${{ health: '气血', energy: '精力', mana: '灵力' }[item.effect]}恢复 ${restored}。剩余 ${item.count} 份。`; g().toast(bag.notice); }
    else if (d.action === 'bag-store' && item?.count > 0) { item.count--; bag.store[item.id] = (bag.store[item.id] || 0) + 1; g().addToStore?.(item.name, 1); bag.notice = `${item.name} ×1 已移入公库，行囊剩余 ${item.count} 份。`; g().toast(bag.notice); }
    else return;
    g().refresh();
  }

  panels.disciples = { title: '门人', render: () => roster.detail ? renderPersonDetail() : renderRoster(), click: handleDisciples, input: handlePeopleInput, enter(params = {}) { if (params.person && people.some(person => person.id === params.person)) roster.selected = params.person; if (params.detail) roster.detail = true; } };
  panels.master = { title: '掌门', render: renderMaster, click: handleMaster };
  panels.bag = { title: '行囊', render: renderBag, click: handleBag, input(element) { if (element.dataset.field === 'bag-search') { bag.query = element.value; g().refresh(); } }, enter(params = {}) { if (params.category) bag.category = params.category; if (params.selected && getItem(params.selected)) bag.selected = params.selected; bag.notice = ''; } };
}());
