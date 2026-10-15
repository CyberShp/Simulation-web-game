/** Live management views. All actions return to the single official simulation. */
const RESOURCE = { herb: '灵草', food: '食粮', jade: '灵石', wood: '木材', stone: '石料', ore: '矿料', crystal: '灵晶', insight: '感悟' };
const number = value => Number.isFinite(value) ? Number(value.toFixed(2)).toLocaleString('zh-CN') : '—';
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function button(text, action, condition = {}) {
  const element = node('button', text);
  element.type = 'button';
  element.disabled = condition.available === false;
  element.title = condition.reason || '';
  element.onclick = action;
  return element;
}
function card(title, text) {
  const element = node('section', undefined, 'management-card');
  element.append(node('h3', title));
  if (text) element.append(node('p', text));
  return element;
}
function resources(values) {
  return Object.entries(values || {}).filter(([, value]) => value !== 0)
    .map(([key, value]) => `${RESOURCE[key] || key} ${number(value)}`).join(' · ') || '暂无物资';
}

export function createCourtyardPanels({ getView, inspect, command, openPerson, focusPerson, openBuilding, announce }) {
  const panel = document.getElementById('management');
  const body = document.getElementById('management-body');
  const tabs = [...panel.querySelectorAll('[data-tab]')];
  let tab = 'affairs', lastSignature = '', candidates = null, policyDraft = null, interacting = false;
  panel.addEventListener('pointerdown', () => { interacting = true; });
  document.addEventListener('pointerup', () => { interacting = false; });
  document.addEventListener('pointercancel', () => { interacting = false; });
  const choose = name => {
    tab = name; candidates = null; lastSignature = ''; render(true);
  };
  for (const item of tabs) item.onclick = () => choose(item.dataset.tab);
  document.getElementById('close-management').onclick = () => { panel.hidden = true; };
  const act = request => {
    const result = command(request);
    announce(result.ok ? result.message || '安排已提交，将按真实行程与条件进行。' : result.error || '当前无法执行。');
    lastSignature = ''; render(true);
    return result;
  };
  function controls(parent, entries) {
    const row = node('div', undefined, 'management-actions');
    for (const [text, request, condition] of entries) row.append(button(text, () => act(request), condition));
    parent.append(row);
  }
  function affairs(view) {
    const control = card('掌门安排', `${view.control.mode === 'auto' ? '按目标自主安排' : '亲控期'} · ${view.reason}`);
    controls(control, [['亲自安排', { type: 'manual' }], ['交回自主', { type: 'auto' }]]);
    control.append(node('p', '亲控后30秒未下达行动，将按当前目标自理。门人始终自行决定是否接受工作。', 'muted'));
    body.append(control);
    const form = node('form', undefined, 'management-card');
    form.append(node('h3', '供给目标'));
    for (const [name, label, max, value] of [
      ['herbTarget', '公库灵草目标', 500, view.policy.herbTarget],
      ['spendingCap', '自主整备灵石额度', 1000, view.policy.spendingCap]
    ]) {
      const field = node('label', label), input = node('input');
      input.type = 'number'; input.name = name; input.min = '0'; input.max = String(max); input.step = '1'; input.required = true; input.value = policyDraft?.[name] ?? value;
      field.append(input); form.append(field);
    }
    const label = node('label', '本地行动偏好'), select = node('select'); select.name = 'risk';
    for (const [value, text] of [['cautious', '守院生产'], ['balanced', '允许本地采集']]) {
      const option = node('option', text); option.value = value; select.append(option);
    }
    select.value = policyDraft?.risk ?? view.policy.risk; label.append(select); form.append(label);
    form.oninput = () => { policyDraft = { herbTarget: form.elements.herbTarget.value, spendingCap: form.elements.spendingCap.value, risk: select.value }; };
    form.append(node('p', `已用 ${number(view.budget.spent)}，剩余 ${number(view.budget.remaining)} 灵石。额度只约束自主恢复采集来源；日常食粮和生产工资另行结算。`, 'muted'));
    const submit = button('保存安排', () => {}); submit.type = 'submit'; form.append(submit);
    form.onsubmit = event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const result = act({ type: 'policy', policy: { herbTarget: form.elements.herbTarget.valueAsNumber,
        spendingCap: form.elements.spendingCap.valueAsNumber, risk: select.value } });
      if (result.ok) { policyDraft = null; render(true); }
    };
    body.append(form);
    const account = card('公库与供给', resources(view.resources));
    account.append(node('p', `灵草目标 ${view.targetMet ? '已达到' : '尚未达到'} · 当前饥荒 ${number(view.economy.starvation)} · 本次生产工资 ${number(view.economy.productionWages)} 灵石`, 'muted'));
    body.append(account);
    for (const farm of view.operations?.farms || []) {
      const section = card(farm.name || '灵草田', `${farm.enabled ? '开放照料' : '暂停生产'} · 田边灵草 ${number(farm.herbOnSite)} · ${farm.seedScope || '下轮种苗'}缺 ${number(farm.seedNeeded)}`);
      if (farm.availability?.reason) section.append(node('p', farm.availability.reason, 'muted'));
      controls(section, [
        [farm.enabled ? '暂停生产' : '恢复生产', { type: 'toggle-building', buildingId: farm.buildingId }],
        ['送入种苗', { type: 'transport', sourceStockpileId: 'stockpile:yunxiu', targetStockpileId: farm.stockpileId, cargo: { herb: farm.seedNeeded } },
          { available: farm.seedNeeded > 0 && (view.resources.herb || 0) >= farm.seedNeeded, reason: '需要公库有足够种苗；掌门实际搬运。' }],
        ['收成入库（留2份苗）', { type: 'transport', sourceStockpileId: farm.stockpileId, targetStockpileId: 'stockpile:yunxiu', cargo: { herb: Math.max(0, farm.herbOnSite - 2) } },
          { available: farm.herbOnSite > 2, reason: '田边保留两份种苗，有余量才搬运。' }]
      ]);
      for (const invite of farm.invites || []) {
        const row = node('div', undefined, 'invite-row');
        row.append(button(`商议请${invite.name}照料`, () => act({ type: 'invite-work', personId: invite.personId, buildingId: farm.buildingId }), invite));
        if (invite.reason) row.append(node('p', invite.reason, 'muted'));
        if (invite.lastResult) row.append(node('p', `上次答复：${invite.lastResult.accepted ? '愿意接受' : '暂未接受'} · ${invite.lastResult.reason || ''}`, 'muted'));
        section.append(row);
      }
      body.append(section);
    }
    const recent = card('最近院务');
    const entries = view.ledger.slice(-5).reverse();
    recent.append(...entries.map(entry => node('p', entry.text)));
    if (!entries.length) recent.append(node('p', '暂无新的院务安排。', 'muted'));
    body.append(recent);
  }
  function people() {
    const projection = inspect();
    if (candidates) {
      body.append(node('p', '这里有多位人物，请选择要查看的人。', 'muted'));
      body.append(button('查看全部人物', () => { candidates = null; render(true); }));
    }
    for (const person of projection.people.filter(p => !candidates || candidates.includes(p.id))) {
      const section = card(`${person.name} · ${person.role || '院中人物'}`, `${person.activityLabel || '料理事务'} · 精力 ${number(person.energy)} · 伤势 ${number(person.wound)}`);
      if (person.detail) section.append(node('p', person.detail, 'muted'));
      if (person.location?.buildingName) section.append(node('p', `所在：${person.location.buildingName}${person.location.kind === 'indoor' ? '内' : ''}`, 'muted'));
      const row = node('div', undefined, 'management-actions');
      row.append(button('查看近况', () => openPerson(person.id)), button('定位', () => focusPerson(person)));
      section.append(row); body.append(section);
    }
    if (!candidates) for (const building of projection.buildings) {
      const section = card(building.name, building.detail);
      const members = [...(building.occupants || []), ...(building.incoming || [])];
      section.append(node('p', members.length ? members.map(person => `${person.name}：${person.label || '按实际活动安排'}`).join('；') : '当前没有人物在此活动。', 'muted'));
      section.append(button('查看工位', () => openBuilding(building.id))); body.append(section);
    }
  }
  function growth(view) {
    const data = view.operations, master = data?.master;
    if (!master) return;
    const section = card(`${master.name} · ${master.realmLabel}`, `修为 ${number(master.xp)} / ${number(master.xpNeed)} · 精力 ${number(master.energy)} · 伤势 ${number(master.wound)}`);
    controls(section, [['休养', { type: 'rest' }, master.actions.rest], ['修炼', { type: 'cultivate' }, master.actions.cultivate], ['灵草疗伤', { type: 'heal' }, master.actions.heal], ['中止当前事务', { type: 'cancel-activity' }, master.actions.cancel]]);
    section.append(node('p', '修炼积累修为；研习提高具体法门的理解。执行会占用掌门的真实时间和位置。', 'muted')); body.append(section);
    if (data.study) body.append(card('正在研习', `${data.study.reason || '前往书案或研读中'} · ${number(data.study.progressTicks)} / ${number(data.study.durationTicks)} 步`));
    for (const art of data.arts) {
      const item = card(art.name + (art.main ? ' · 主修' : ''), `理解 ${number(art.understanding)} · 熟练 ${number(art.mastery)}`);
      item.append(node('p', art.source || '已接触的典籍', 'muted'));
      item.append(button(`研习 · ${resources(art.cost)}`, () => act({ type: 'study', artId: art.id }), art));
      if (art.reason) item.append(node('p', art.reason, 'muted')); body.append(item);
    }
  }
  function supply(view) {
    const data = view.operations;
    for (const group of data?.inventory?.summary || []) {
      const item = card(group.id === 'public' ? '公用物资账' : '掌门私人物资账');
      for (const [resource, amount] of Object.entries(group.amounts).filter(([, value]) => value.total > 0 || value.shortage > 0)) {
        item.append(node('p', `${RESOURCE[resource] || resource}：可用 ${number(amount.available)} · 预留 ${number(amount.reserved)} · 在途 ${number(amount.inTransit)}`));
      }
      body.append(item);
    }
    const stocks = data?.inventory?.stockpiles || view.stockpiles;
    for (const stock of stocks) {
      const item = card(stock.label || '物资存放处', `可用：${resources(stock.resources)}`);
      if (stock.reserved) item.append(node('p', `已预留：${resources(stock.reserved)}`, 'muted'));
      body.append(item);
    }
    const carried = stocks.find(stock => stock.id === 'stockpile:carried:master');
    if (carried && Object.values(carried.resources).some(n => n > 0)) {
      const item = card('随身物资入库', '掌门须实际走回公库，运输中物资归属和位置保持。');
      for (const [resource, value] of Object.entries(carried.resources).filter(([, n]) => n > 0)) {
        item.append(button(`搬回${RESOURCE[resource] || resource}（最多40份）`, () => act({ type: 'transport', sourceStockpileId: carried.id, targetStockpileId: 'stockpile:yunxiu', cargo: { [resource]: Math.min(40, value) } }), data?.canTransport));
      }
      body.append(item);
    }
    for (const patch of data?.harvest || []) {
      const item = card(patch.name, `可采来源 ${number(patch.remaining)} · 每次最多 ${number(patch.batchSize)} 份`);
      item.append(button('亲自采集', () => act({ type: 'harvest', resource: patch.id }), patch));
      if (patch.reason) item.append(node('p', patch.reason, 'muted'));
      if (patch.replenish) {
        item.append(button(`恢复来源 · ${resources(patch.replenish.cost)}`, () => act({ type: 'replenish', resource: patch.id }), patch.replenish));
        if (patch.replenish.reason) item.append(node('p', patch.replenish.reason, 'muted'));
      }
      body.append(item);
    }
    for (const transport of view.transports.filter(order => !['completed', 'cancelled', 'delivered'].includes(order.phase))) {
      body.append(card('在途搬运', `${resources(transport.cargo)} · ${transport.reason || transport.phase}`));
    }
  }
  function render(force = false) {
    if (panel.hidden) return;
    const view = getView();
    const signature = JSON.stringify([tab, candidates, Math.floor(view.tick / 10), view.control, view.policy, view.resources, view.operations]);
    if (!force && (interacting || signature === lastSignature || body.contains(document.activeElement) && /^(INPUT|SELECT)$/.test(document.activeElement.tagName))) return;
    lastSignature = signature;
    const scroll = body.scrollTop;
    body.replaceChildren();
    for (const item of tabs) item.setAttribute('aria-selected', String(item.dataset.tab === tab));
    ({ affairs, people, growth, supply }[tab])(view);
    body.scrollTop = scroll;
  }
  return {
    open(name = 'affairs', ids = null) { tab = name; candidates = ids; panel.hidden = false; render(true); },
    render,
    close() { panel.hidden = true; }
  };
}
