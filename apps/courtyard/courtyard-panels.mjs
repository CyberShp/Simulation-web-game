/** U-149 / UIA-01–27: management reads public facts and submits official commands. */
import { transportLimit, transportQuantity, filterPeople, filterArts, sameBuilding } from './courtyard-panel-state.mjs';
import { membershipSummary } from './courtyard-person-dialogue.mjs';
const RESOURCE = { herb: '灵草', food: '食粮', jade: '灵石', wood: '木材', stone: '石料', ore: '矿料', crystal: '灵晶', insight: '感悟', rawWater: '原水', cleanWater: '洁水', meal: '饭食', spiritMeal: '灵膳', 'pill:qi': '聚气丹', 'pill:spirit': '灵息丹', 'pill:heal': '回春散', 'pill:foundation': '筑基丹' };
const HOME = 'stockpile:yunxiu', CARRIED = 'stockpile:carried:master';
const PAGE = { affairs: '院务', people: '人物', growth: '修行', supply: '物资' };
const PHASE = { 'to-source': '前往取货', carrying: '正在送货', 'waiting-for-goods': '等候货物', moving: '前往', navigating: '前往', waiting: '候位', executing: '进行中', working: '进行中', blocked: '受阻', preparing: '准备中' };
const number = value => Number.isFinite(value) ? Number(value.toFixed(2)).toLocaleString('zh-CN') : '—';
const activeTransports = view => (view.transports || []).filter(order => !['completed', 'cancelled', 'delivered', 'failed'].includes(order.phase));
const resourceName = (id, definition) => definition?.name || RESOURCE[id] || '物品';
const resources = values => Object.entries(values || {}).filter(([, value]) => value > 0).map(([id, value]) => `${resourceName(id)} ${number(value)}`).join(' · ') || '无';
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function section(title, text) { const el = node('section', undefined, 'management-section'); el.append(node('h3', title)); if (text) el.append(node('p', text, 'muted')); return el; }
function keyed(el, key) { el.dataset.uiKey = key; return el; }
function button(text, action, key, condition = {}, className = '') {
  const el = keyed(node('button', text, className), key); el.type = 'button'; el.disabled = condition.available === false;
  el.onclick = action; return el;
}
function note(parent, text, className = 'muted') { if (text) parent.append(node('p', text, className)); }
function action(parent, text, run, key, condition = {}, className = '') {
  const wrap = node('div', undefined, 'action-option'); wrap.append(button(text, run, key, condition, className));
  if (condition.reason) note(wrap, condition.reason, condition.available === false ? 'action-reason' : 'muted');
  parent.append(wrap); return wrap;
}
function choices(parent, labelText, key, value, options, change) {
  const label = node('label', undefined, 'filter-field'); label.append(node('span', labelText)); const select = keyed(node('select'), key);
  for (const [id, name] of options) { const option = node('option', name); option.value = id; select.append(option); }
  select.value = value; select.onchange = () => change(select.value); label.append(select); parent.append(label); return select;
}
function search(parent, labelText, key, value, change) {
  const label = node('label', undefined, 'filter-field search-field'); label.append(node('span', labelText)); const input = keyed(node('input'), key);
  input.type = 'search'; input.value = value; input.placeholder = labelText; input.oninput = () => change(input.value); label.append(input); parent.append(label);
}
function facts(parent, entries) {
  const dl = node('dl', undefined, 'management-facts');
  for (const [label, value] of entries) { const group = node('div'); group.append(node('dt', label), node('dd', value)); dl.append(group); } parent.append(dl);
}
function listEntry(parent, title, detail, run, key, selected = false) {
  const row = button('', run, key, {}, 'management-list-row'); row.setAttribute('aria-pressed', String(selected));
  row.append(node('strong', title), node('span', detail)); parent.append(row); return row;
}
function itemRows(stock) {
  if (stock?.items) return stock.items;
  return Object.entries(stock?.resources || {}).map(([id, amount]) => ({ id, name: resourceName(id), available: amount,
    reserved: stock.reserved?.[id] || 0, inTransit: stock.inTransit?.[id] || 0, total: amount, transportable: id !== 'insight' }));
}

export function createCourtyardPanels({ getView, inspect, command, openPerson, focusPerson, walkTo, announce, onReadingChange = () => {} }) {
  const panel = document.getElementById('management'), body = document.getElementById('management-body');
  const tabs = [...panel.querySelectorAll('[data-tab]')], title = panel.querySelector('h2'), statusNote = panel.querySelector('.management-note');
  const states = { affairs: {}, people: { query: '', scope: 'all', activity: 'all', selected: null, ids: null },
    growth: { mode: 'current', query: '', kind: 'all', access: 'all', selected: null }, supply: { mode: 'summary', owner: 'all', selected: null } };
  let current = { tab: 'affairs', page: 'index' }, history = [], scrolls = new Map(), listScrolls = new Map(), policyDraft = null, transferDrafts = new Map();
  let lastSignature = '', interacting = false, rendering = false, reading = false, pending = null, feedback = null;
  const pageKey = state => `${state.tab}:${state.page}:${state.id || ''}:${state.source || ''}:${state.target || ''}:${state.resource || ''}`;
  const stocks = view => view.operations?.inventory?.stockpiles || view.stockpiles || [];
  const stockLabel = (view, id) => stocks(view).find(stock => stock.id === id)?.label || '物资存放处';
  const remember = () => scrolls.set(pageKey(current), body.scrollTop);
  const syncReading = () => { const next = !panel.hidden && (current.page === 'building' || current.reading === true || pending?.freezeWorld === true); if (next !== reading) { reading = next; onReadingChange(next); } };
  const clearFeedback = () => { feedback = null; pending = null; };
  function go(next, { push = true } = {}) {
    remember(); if (push && !panel.hidden) history.push({ ...current }); current = next; panel.hidden = false;
    clearFeedback(); syncReading(); render(true, true);
  }
  function choose(tab) { go({ tab, page: 'index' }, { push: false }); history = []; }
  function close() { remember(); panel.hidden = true; pending = null; syncReading(); }
  function back() {
    if (panel.hidden) return false;
    if (pending) { pending = null; syncReading(); render(true); return true; }
    if (history.length) { remember(); current = history.pop(); clearFeedback(); syncReading(); render(true, true); }
    else close();
    return true;
  }
  function building(id) { go({ tab: 'affairs', page: 'building', id: String(id) }); }
  function domainSite(id) { go({ tab: 'affairs', page: 'domain-site', id }); }
  function stockPage(id) { go({ tab: 'supply', page: 'stock', id }); }
  function transfer(source, target, resource, retained = 0, requested = null) {
    const next = { tab: 'supply', page: 'transfer', source, target, resource, retained };
    if (requested !== null) transferDrafts.set(pageKey(next), String(requested)); go(next);
  }
  for (const item of tabs) item.onclick = () => choose(item.dataset.tab);
  document.getElementById('close-management').onclick = close;
  panel.addEventListener('pointerdown', () => { interacting = true; });
  document.addEventListener('pointerup', () => { interacting = false; });
  document.addEventListener('pointercancel', () => { interacting = false; });

  function submit(request, { confirmed = false, run = null } = {}) {
    const view = getView(), consequence = view.operations?.actionConsequences;
    if (!confirmed && ['cancel-activity', 'rest', 'cultivate', 'move'].includes(request.type) && consequence?.requiresConfirmation) {
      pending = { request, run, activityId: view.operations?.master?.activity?.id || null, consequence, freezeWorld: view.operations?.master?.activity?.kind === 'construction' };
      syncReading(); render(true); body.querySelector('[data-ui-key="confirm-action"]')?.focus(); return null;
    }
    pending = null;
    const result = run ? run() : command(request);
    const message = result.ok ? result.message || ({ policy: '自主安排已保存。', manual: '已由你亲自安排掌门行动。', auto: '掌门已按当前目标自主安排。', 'toggle-building': '生产设置已更新。' }[request.type] || '行动已安排，可在正在进行中查看进展。') : result.error || '当前无法执行。';
    feedback = { ok: result.ok, message, consequences: result.consequences || null };
    announce(message);
    if (result.ok && request.type === 'build') {
      remember(); current = { tab: 'affairs', page: 'construction', id: request.buildingType }; history = []; syncReading();
    } else if (result.ok && ['enable-domain', 'enable-valley', 'enable-residences', 'enable-services', 'enable-north-library', 'enable-north-meditation', 'enable-west-workshops', 'build-site'].includes(request.type)) {
      remember(); current = { tab: 'affairs', page: 'domain-site', id: request.siteId || (request.type === 'enable-west-workshops' ? current.id || view.domain?.sites?.find(site => site.westWorkshops)?.id : request.type === 'enable-north-meditation' ? current.id || view.domain?.sites?.find(site => site.northMeditation)?.id : request.type === 'enable-north-library' ? current.id || view.domain?.sites?.find(site => site.northLibrary)?.id : request.type === 'enable-services' ? current.id || view.domain?.sites?.find(site => site.services)?.id : request.type === 'enable-residences' ? current.id || view.domain?.sites?.find(site => site.residences)?.id : request.type === 'enable-valley' ? view.domain?.sites?.find(site => site.planId === 'GC-17')?.id : view.domain?.sites?.[0]?.id) }; history = []; syncReading();
    } else if (result.ok && !['policy', 'manual', 'auto', 'toggle-building', 'invite-work', 'start-service', 'cancel-service', 'invite-service-work'].includes(request.type)) {
      remember(); current = { tab: ['study', 'collate-family', 'teach-library', 'cultivate-meditation'].includes(request.type) || ['rest', 'cultivate', 'heal', 'cancel-activity'].includes(request.type) ? 'growth' : 'affairs', page: 'index' };
      states.growth.mode = 'current'; history = []; syncReading();
    }
    syncReading(); lastSignature = ''; render(true, result.ok && !reading); return result;
  }
  function commandAction(parent, text, request, key, condition = {}, className = '') {
    return action(parent, text, () => submit(request), key, condition, className);
  }
  function walk(parent, text, location, key) {
    const point = location?.focus || location;
    action(parent, text, () => submit({ type: 'move', x: point.x, y: point.y }, { run: walkTo ? () => walkTo(location) : null }), key,
      { available: Number.isFinite(point?.x) && Number.isFinite(point?.y), reason: Number.isFinite(point?.x) ? '' : '当前尚无可靠位置。' });
  }
  function subnav(parent, selected, items, change) {
    const nav = node('div', undefined, 'management-subtabs');
    for (const [id, label] of items) { const el = button(label, () => change(id), `subtab:${id}`); el.setAttribute('aria-pressed', String(selected === id)); nav.append(el); } parent.append(nav);
  }
  function ongoing(parent, view) {
    const currentSection = section('正在进行'), master = view.operations?.master, known = inspect().people.find(person => person.id === master?.id);
    note(currentSection, `${master?.name || '掌门'} · ${known?.activityLabel || '院中停留'}`);
    note(currentSection, master?.activity?.reason || view.reason, 'muted');
    const study = view.operations?.study;
    if (study) note(currentSection, `${study.name || '法门研习'} · ${study.stageLabel || PHASE[study.phase] || '研习中'} · 研读 ${number(study.progressTicks / 10)} / ${number(study.durationTicks / 10)} 秒`);
    for (const order of activeTransports(view)) note(currentSection,
      `${order.sourceLabel || stockLabel(view, order.sourceStockpileId)} → ${order.targetLabel || stockLabel(view, order.targetStockpileId)} · ${resources(order.cargo)} · ${order.stageLabel || PHASE[order.phase] || '搬运中'}`);
    if (view.construction) note(currentSection, view.construction.reason);
    const row = node('div', undefined, 'management-actions');
    row.append(button('查看掌门安排', () => { states.growth.mode = 'current'; go({ tab: 'growth', page: 'index' }); }, 'ongoing:master'));
    currentSection.append(row); parent.append(currentSection);
  }
  function affairs(view) {
    const projection = inspect(), farms = view.operations?.farms || [], currentSection = section('院中现状');
    const food = view.foodSupply;
    facts(currentSection, [['在院人物', `${projection.people.length} 人`], ['可用灵草', number(view.resources.herb)], ['公库食粮 / 目标', `${number(food.available)} / ${number(food.target)}`], ['预计每日消耗', `${number(food.dailyDemand)} 份食粮`]]);
    if (view.housing) {
      const counts = view.housing.counts;
      facts(currentSection, [['住宅床位', `${counts.usable} / ${counts.physical} 可用`], ['居住安置', `${counts.settled} 已入住 · ${counts.pending} 待入住`]]);
      if (counts.unassignedResidents) note(currentSection, `尚有${counts.unassignedResidents}位居民待安置。`, 'attention');
    }
    if (view.economy.starvation > 0) note(currentSection, `饥荒 ${number(view.economy.starvation)}`, 'attention');
    note(currentSection, food.reason);
    const bar = node('div', undefined, 'section-tail'); bar.append(node('span', `掌门 · ${view.control.mode === 'auto' ? '自主安排' : '亲自安排'}`), button('自主设置', () => go({ tab: 'affairs', page: 'policy' }), 'affairs:policy', {}, 'text-button')); currentSection.append(bar); body.append(currentSection);
    if (view.reception) {
      const reception = view.reception, visitors = section('山门接待');
      note(visitors, reception.enabled ? '接待已开启。求道者沿南山道到访，走近后可商议入门。' : '备好空床和一日口粮，可安排接待求道者。');
      if (reception.reason) note(visitors, reception.reason, reception.canEnable ? '' : 'attention');
      commandAction(visitors, reception.enabled ? '暂停接待新来客' : '开启接待', { type: 'set-reception', enabled: !reception.enabled }, 'reception:toggle', { available: reception.enabled || reception.canEnable, reason: reception.reason });
      const phaseName = { approaching: '沿南路前来', arriving: '沿南路前来', present: '在院等候', departing: '正在离院' };
      for (const caller of reception.callers || []) if (!caller.admitted && view.people.some(person => person.id === caller.personId)) {
        listEntry(visitors, caller.name, phaseName[caller.phase] || '来访途中', () => openPerson(caller.personId), `reception:person:${caller.personId}`);
      }
      body.append(visitors);
    }
    const todo = section('需要处理'); let count = 0;
    for (const farm of farms) {
      if (farm.seedNeeded > 0 || !farm.enabled || farm.availability?.reason) {
        listEntry(todo, `${farm.name} · ${farm.seedNeeded > 0 ? `待送${farm.seedName || '种苗'}` : !farm.enabled ? '生产已暂停' : '照料条件'}`, farm.availability?.reason || `${farm.seedScope}还需${resourceName(farm.resource || 'herb')} ${number(farm.seedNeeded)} 份`, () => building(farm.buildingId), `todo:farm:${farm.id}`); count++;
      }
    }
    for (const stock of stocks(view).filter(stock => stock.dropped || stock.id.startsWith('stockpile:dropped:'))) {
      if (!itemRows(stock).some(item => item.available > 0)) continue;
      listEntry(todo, `${stock.label || '落地物资'} · 待回收`, stock.locationLabel || '查看落地点并安排掌门搬回', () => stockPage(stock.id), `todo:stock:${stock.id}`); count++;
    }
    if (view.construction?.reason) { note(todo, view.construction.reason); count++; }
    if (!count) note(todo, '眼下没有需要立即处理的院务。'); body.append(todo);
    if (view.growth?.buildings?.length) {
      const construction = section('本院营造');
      for (const plan of view.growth.buildings) listEntry(construction, plan.name,
        plan.status === 'complete' ? '已落成 · 查看实际工位' : plan.status === 'building' ? `营造中 · ${number(plan.progress * 100)}% · ${plan.reason || ''}` : Object.keys(plan.missingCost || {}).length ? `尚缺 ${resources(plan.missingCost)}` : plan.reason || '材料已备足，可确认营造',
        () => go({ tab: 'affairs', page: 'construction', id: plan.id }), `growth:building:${plan.id}`);
      body.append(construction);
    }
    if (view.domain?.plannedSites?.length) {
      const expansion = section('山域营造', '按主峰、东台与西谷的预设建位分期营建。');
      if (!view.domain.westEnabled) commandAction(expansion, view.domain.enabled ? '启用西林通路' : '启用山域通路', { type: 'enable-domain' }, 'domain:enable', {}, 'primary');
      else if (!view.domain.valleyEnabled) commandAction(expansion, '开通西谷道路', { type: 'enable-valley' }, 'domain:enable-valley', {}, 'primary');
      const region = states.affairs.region || 'Z-03';
      choices(expansion, '营造区域', 'domain:region', region, [['Z-01', '主峰'], ['Z-02', '东台'], ['Z-03', '西谷']], value => { states.affairs.region = value; render(true); });
      for (const site of view.domain.plannedSites.filter(item => item.zoneId === region)) listEntry(expansion, `${site.planId} · ${site.name}`,
        site.status === 'complete' ? `已落成${site.capacityText ? ` · ${site.capacityText}` : ''}` : site.status === 'building' ? `${site.materialFlow?.stageLabel || '营造中'} · ${number(site.progress * 100)}%` : site.status === 'planning' ? '筹备中 · 查看用途与条件' : site.reason,
        () => domainSite(site.id), `domain:site:${site.id}`);
      body.append(expansion);
    }
    ongoing(body, view);
    const facilities = section('院中建筑');
    for (const entry of projection.buildings) listEntry(facilities, entry.name, `${entry.slotCounts.occupied} 处使用 · ${entry.slotCounts.reserved} 处预约 · ${entry.occupants.length} 人在场`, () => building(entry.id), `building:${entry.id}`);
    body.append(facilities);
    const recent = section('院务记事');
    for (const entry of (view.ledger || []).slice(-4).reverse()) note(recent, entry.text);
    if (!view.ledger?.length) note(recent, '暂无新的院务记录。'); body.append(recent);
  }
  function policy(view) {
    const control = section('掌门自主安排', view.reason), row = node('div', undefined, 'management-actions');
    commandAction(row, '亲自安排', { type: 'manual' }, 'policy:manual'); commandAction(row, '交回自主', { type: 'auto' }, 'policy:auto'); control.append(row);
    note(control, '亲控后30秒未下达行动，掌门按当前目标自理。门人依本人意愿接受事务。'); body.append(control);
    const form = node('form', undefined, 'management-section'); form.append(node('h3', '供给目标与累计额度'));
    for (const [name, labelText, max, value] of [['foodTarget', '公库口粮目标', 500, view.policy.foodTarget], ['herbTarget', '公库灵草目标', 500, view.policy.herbTarget], ['spendingCap', '自主整备累计额度', 1000, view.policy.spendingCap]]) {
      const label = node('label', undefined, 'setting-field'); label.append(node('span', labelText)); const input = keyed(node('input'), `policy:${name}`);
      input.type = 'number'; input.name = name; input.min = '0'; input.max = String(max); input.step = '1'; input.required = true; input.value = policyDraft?.[name] ?? value; label.append(input); form.append(label);
    }
    const select = choices(form, '本地行动偏好', 'policy:risk', policyDraft?.risk ?? view.policy.risk, [['cautious', '守院生产'], ['balanced', '允许本地采集']], () => draft()); select.name = 'risk';
    function draft() { policyDraft = { foodTarget: form.elements.foodTarget.value, herbTarget: form.elements.herbTarget.value, spendingCap: form.elements.spendingCap.value, risk: select.value }; }
    form.oninput = draft;
    facts(form, [['公库食粮 / 目标', `${number(view.foodSupply.available)} / ${number(view.foodSupply.target)}`], ['预计每日消耗', `${number(view.foodSupply.dailyDemand)} 份食粮`]]);
    note(form, view.foodSupply.reason);
    note(form, '口粮目标设为0时暂停自动备粮；选用“允许本地采集”后，掌门可自动采粮、补种。补种消耗8份食粮和4灵石，灵石计入自主整备额度。');
    facts(form, [['公库灵草', `${number(view.resources.herb)} / ${number(view.policy.herbTarget)}`], ['还需入库', number(Math.max(0, view.policy.herbTarget - view.resources.herb))], ['额度已用', `${number(view.budget.spent)} 灵石`], ['额度剩余', `${number(view.budget.remaining)} 灵石`]]);
    note(form, '累计额度用于掌门自主恢复采集来源，随已用支出累计；日常口粮与生产工资另行结算。');
    const save = button('保存自主安排', () => {}, 'policy:save', {}, 'primary'); save.type = 'submit'; form.append(save);
    form.onsubmit = event => { event.preventDefault(); if (!form.reportValidity()) return; const result = submit({ type: 'policy', policy: { foodTarget: form.elements.foodTarget.valueAsNumber, herbTarget: form.elements.herbTarget.valueAsNumber, spendingCap: form.elements.spendingCap.valueAsNumber, risk: select.value } }); if (result?.ok) { policyDraft = null; render(true); } }; body.append(form);
  }
  function people(view) {
    const state = states.people, projection = inspect();
    projection.people = projection.people.map(person => {
      const membership = view.people.find(item => item.id === person.id)?.admission?.membership;
      return { ...person, membership, role: membership?.rankLabel || person.role };
    });
    const filters = node('div', undefined, 'management-filters');
    search(filters, '姓名、身份或活动', 'people:query', state.query, value => { state.query = value; render(true); });
    choices(filters, '名单', 'people:scope', state.scope, [['all', '在院人物'], ['resident', '本院居住者'], ['guest', '来客']], value => { state.scope = value; render(true); });
    choices(filters, '状态', 'people:activity', state.activity, [['all', '全部状态'], ['attention', '受伤或等候'], ['indoor', '正在屋内'], ['work', '正在劳作'], ['study', '正在研习']], value => { state.activity = value; render(true); }); body.append(filters);
    if (state.ids) { const bar = node('div', undefined, 'section-tail'); bar.append(node('span', '同一位置的人物'), button('回到在院名单', () => { state.ids = null; render(true); }, 'people:clear-candidates')); body.append(bar); }
    const visible = filterPeople(projection.people, state), split = node('div', undefined, 'management-split'), list = node('div', undefined, 'management-list'), detail = node('section', undefined, 'management-detail'); list.dataset.scrollKey = 'people:list';
    if (!state.selected && visible.length) state.selected = visible[0].id;
    for (const person of visible) listEntry(list, person.name, `${person.role} · ${person.activityLabel}`, () => { state.selected = person.id; render(true); }, `person:${person.id}`, state.selected === person.id);
    if (!visible.length) note(list, '没有符合条件的在院人物。');
    const person = projection.people.find(item => item.id === state.selected);
    if (person) {
      detail.append(node('h3', person.name)); note(detail, `${person.role} · ${person.resident ? '居住本院' : '来访本院'}`);
      if (person.membership) note(detail, membershipSummary(person.membership), 'source-note');
      note(detail, person.activityLabel, 'detail-lead'); note(detail, person.detail);
      facts(detail, [['精力', number(person.energy)], ['伤势', number(person.wound)], ['所在', person.location?.label || '山院'], ['本人工位', person.slotName || '尚未占用']]);
      const housing = view.housing?.residents.find(resident => resident.personId === person.id && resident.isResident);
      if (housing) facts(detail, [['安置', housing.statusLabel], ['住处', housing.homeLabel || '尚未入住'], ...(housing.pendingLabel ? [['待入住', housing.pendingLabel]] : [])]);
      note(detail, '消息来源：当前在院观察与公开活动。', 'source-note');
      const row = node('div', undefined, 'management-actions');
      row.append(button(person.id === 'person:master' ? '掌门近况' : '查看近况', () => openPerson(person.id), `person:inspect:${person.id}`, {}, 'primary'), button('定位', () => focusPerson(person), `person:focus:${person.id}`)); detail.append(row);
      if (person.location?.buildingId) detail.append(button(`查看${person.location.buildingName}`, () => building(person.location.buildingId), `person:building:${person.id}`, {}, 'text-button'));
      if (!visible.some(item => item.id === person.id)) note(detail, '当前所选人物保留，未包含在本次筛选结果中。');
    } else note(detail, state.selected ? '所选人物已离开当前在院名单，可选择另一位人物。' : '选择人物查看近况。');
    split.append(list, detail); body.append(split);
  }
  function growth(view) {
    const state = states.growth, data = view.operations, master = data?.master; if (!master) return note(body, '掌门的修行近况暂不可查。');
    subnav(body, state.mode, [['current', '掌门安排'], ['arts', '法门目录']], mode => { state.mode = mode; render(true); });
    if (state.mode === 'current') {
      const currentSection = section(`${master.name} · ${master.realmLabel}`);
      facts(currentSection, [['修为', `${number(master.xp)} / ${number(master.xpNeed)}`], ['精力', number(master.energy)], ['伤势', number(master.wound)]]);
      note(currentSection, master.activity?.reason || '可安排休养或修炼。', 'detail-lead');
      const row = node('div', undefined, 'management-action-grid');
      commandAction(row, '休养调息', { type: 'rest' }, 'growth:rest', master.actions.rest);
      commandAction(row, '掌门修炼 · 积累修为', { type: 'cultivate' }, 'growth:cultivate', master.actions.cultivate);
      commandAction(row, '灵草疗伤 · 公库6份', { type: 'heal' }, 'growth:heal', master.actions.heal);
      commandAction(row, '中止当前事务', { type: 'cancel-activity' }, 'growth:cancel', master.actions.cancel, 'quiet-danger');
      currentSection.append(row); if (data.actionConsequences?.active) note(currentSection, data.actionConsequences.summary, 'consequence-note');
      body.append(currentSection);
      if (data.study) {
        const study = data.study, progress = section(study.name || '正在研习');
        note(progress, `${study.stageLabel || PHASE[study.phase] || '研习'} · ${study.reason || '按当前安排继续'}`, 'detail-lead');
        facts(progress, [['研读时间', `${number(study.progressTicks / 10)} / ${number(study.durationSeconds ?? study.durationTicks / 10)} 秒`], ['食粮结算', study.consumed ? '已开始研读，食粮已耗用' : '到席开工前保留退还']]);
        if (study.artId) action(progress, '查看这门法门', () => { state.selected = study.artId; state.mode = 'arts'; render(true); }, 'growth:current-art'); body.append(progress);
      }
      if (master.breakthrough?.current) {
        const current=master.breakthrough.current,progress=section('突破调息');
        note(progress,`${current.stageLabel} · ${current.reason}`,'detail-lead');
        facts(progress,[['到席工时',`${number(current.progressTicks / 10)} / ${number(current.durationTicks / 10)} 秒`],['材料结算',current.consumed?'已进入炼化；中止保留已耗材料':'炼化前中止，材料与丹药退回原处']]);
        body.append(progress);
      }
      const help = section('修行进展'); note(help, '掌门修炼积累修为；研习典籍提高该法门理解，熟练来自实际运用。');
      if (master.xp >= master.xpNeed) {
        const breakthrough = master.breakthrough;
        if (breakthrough?.entryVisible) commandAction(help, '准备突破', { type: 'breakthrough' }, 'growth:breakthrough', { available: breakthrough.entryAvailable, reason: breakthrough.entryReason });
        note(help, breakthrough?.current ? '调息准备3秒，炼化9秒，稳固6秒；到席后累计工时。' : breakthrough?.entryReason || '材料备齐后可前往修炼席突破。');
        if (!breakthrough?.current) {
          for (const lock of breakthrough?.locks || []) note(help, typeof lock === 'string' ? lock : lock.reason || lock.label);
          for (const cost of breakthrough?.costConditions || []) note(help, `${cost.name} ${number(cost.current)} / ${number(cost.required)}${cost.met ? ' · 已备足' : ' · 待备齐'}`);
        }
      }
      help.append(button('查看已知法门', () => { state.mode = 'arts'; render(true); }, 'growth:catalogue')); body.append(help); return;
    }
    const filters = node('div', undefined, 'management-filters'); search(filters, '法门名称或用途', 'arts:query', state.query, value => { state.query = value; render(true); });
    const kinds = [...new Map((data.arts || []).filter(art => art.kind).map(art => [art.kind, art.kindLabel || art.kind])).entries()];
    choices(filters, '类型', 'arts:kind', state.kind, [['all', '全部类型'], ...kinds], value => { state.kind = value; render(true); });
    choices(filters, '阅读与掌握', 'arts:access', state.access, [['all', '全部已知'], ['learned', '已掌握'], ['readable', '当前可阅'], ['unavailable', '暂不可阅']], value => { state.access = value; render(true); }); body.append(filters);
    const visible = filterArts(data.arts || [], state), split = node('div', undefined, 'management-split'), list = node('div', undefined, 'management-list'), detail = node('section', undefined, 'management-detail'); list.dataset.scrollKey = 'arts:list';
    if (!state.selected && visible.length) state.selected = visible[0].id;
    for (const art of visible) listEntry(list, art.name, `${art.main ? '主修 · ' : ''}${art.kindLabel || '法门'} · ${art.access === false ? '暂不可阅' : '理解 ' + number(art.understanding)}`, () => { state.selected = art.id; render(true); }, `art:${art.id}`, state.selected === art.id);
    if (!visible.length) note(list, '没有符合条件的已知法门。');
    const art = data.arts.find(item => item.id === state.selected);
    if (art) {
      detail.append(node('h3', art.name)); note(detail, `${art.roleLabel || (art.main ? '当前主修' : '已知法门')} · ${art.kindLabel || '法门'} · ${art.chapterLabel || '当前所知篇章'}`); note(detail, art.purpose, 'detail-lead'); note(detail, art.useCondition); note(detail, art.source, 'source-note');
      facts(detail, [['理解', `${number(art.understanding)} / 100`], ['熟练', number(art.mastery)], ['研读耗时', `${number(art.durationSeconds ?? art.durationTicks / 10)} 秒，行路另计`], ['研习收益', art.understandingGain != null ? `理解 +${number(art.understandingGain)}` : '按本篇理解结算']]);
      note(detail, `耗用 ${resources(art.cost)} · 来自${stockLabel(view, art.sourceStockpileId || HOME)}`);
      const conditions = node('ul', undefined, 'condition-list');
      for (const condition of art.conditions || []) { const text = typeof condition === 'string' ? condition : condition.label || condition.reason || condition.name;
        if (text) conditions.append(node('li', `${condition.met === false || condition.available === false ? '未满足 · ' : '已满足 · '}${text}${typeof condition === 'object' && Number.isFinite(condition.current) && Number.isFinite(condition.required) ? `（${number(condition.current)} / ${number(condition.required)}）` : ''}`)); }
      if (conditions.childNodes.length) detail.append(conditions);
      commandAction(detail, `研习《${art.name}》`, { type: 'study', artId: art.id }, `art:study:${art.id}`, art, 'primary');
      detail.append(button('查看供给', () => stockPage(art.sourceStockpileId || HOME), `art:stock:${art.id}`, {}, 'text-button'));
      if (!visible.some(item => item.id === art.id)) note(detail, '已保留所选法门，当前筛选未包含它。');
    } else note(detail, '选择已知法门查看用途与研习条件。');
    split.append(list, detail); body.append(split);
  }
  function supply(view) {
    const state = states.supply;
    const supplies = view.operations?.serviceSupplies;
    if (supplies) {
      const service = section('生活用水', '膳房炊事与医庐诊疗需要洁水。');
      if (!supplies.enabled) commandAction(service, '启用生活物资采购', { type: 'enable-service-supplies' }, 'supply:enable-services', supplies, 'primary');
      else { note(service, '洁水由青溪商人沿商路购运；走到商人身旁，用随身灵石购买。');
        note(service, `商人现货 ${number(supplies.merchantWater)} 份`);
        service.append(button('与周行舟交谈', () => openPerson(supplies.merchantId), 'supply:water-merchant', { available: view.people.some(person => person.id === supplies.merchantId) })); }
      body.append(service);
    }
    subnav(body, state.mode, [['summary', '归属汇总'], ['stocks', '各处货位'], ['sources', '采集来源']], mode => { state.mode = mode; render(true); });
    if (state.mode === 'summary') {
      for (const group of view.operations?.inventory?.summary || []) {
        const account = section(group.id === 'public' ? '公用物资' : '掌门私人物资'), table = node('table', undefined, 'inventory-table');
        const head = node('thead'), hrow = node('tr'); for (const label of ['物资', '可用', '预留', '在途', '缺口']) hrow.append(node('th', label)); head.append(hrow); table.append(head);
        const rows = node('tbody');
        for (const [id, amount] of Object.entries(group.amounts || {}).filter(([, amount]) => amount.total > 0 || amount.shortage > 0)) {
          const row = node('tr'); row.append(node('th', `${resourceName(id, amount)}${amount.kind === 'knowledge-budget' ? ' · 感悟' : amount.kind === 'currency' ? ' · 货币' : ''}`));
          for (const key of ['available', 'reserved', 'inTransit', 'shortage']) row.append(node('td', number(amount[key] || 0), key === 'shortage' && amount[key] > 0 ? 'attention' : ''));
          rows.append(row);
        }
        if (rows.childNodes.length) { table.append(rows); account.append(table); } else note(account, '当前没有记账物资。');
        for (const shortage of group.shortageReasons || []) {
          const row = node('div', undefined, 'need-row'); note(row, `${shortage.targetName || '当前事务'} · 尚缺${resourceName(shortage.resource)} ${number(shortage.quantity)} 份`);
          note(row, shortage.reason); if (shortage.targetId) row.append(button('查看需求', () => building(shortage.targetId), `need:${group.id}:${shortage.targetId}:${shortage.resource}`, {}, 'text-button')); account.append(row);
        }
        account.append(button('查看对应货位', () => { state.owner = group.id; state.mode = 'stocks'; render(true); }, `supply:owner:${group.id}`)); body.append(account);
      }
      note(body, '归属与存放位置分别记账；搬运中的同一批物资从预留转为在途，送达后成为目的地可用物资。', 'source-note'); return;
    }
    if (state.mode === 'stocks') {
      const filters = node('div', undefined, 'management-filters'); choices(filters, '物资归属', 'stocks:owner', state.owner, [['all', '全部货位'], ['public', '公用'], ['personal', '掌门私人']], value => { state.owner = value; render(true); }); body.append(filters);
      const list = section('货位与当前用途');
      for (const stock of stocks(view).filter(stock => state.owner === 'all' || (state.owner === 'public' ? stock.access === 'public' : stock.access !== 'public'))) {
        const itemText = itemRows(stock).filter(item => item.available > 0).map(item => `${item.name || resourceName(item.id)} ${number(item.available)}`).join(' · ') || '暂无可用物资';
        listEntry(list, stock.label || '物资货位', `${stock.orderReserved ? '工单专用 · ' : stock.dropped ? '等待回收 · ' : ''}${itemText}`, () => stockPage(stock.id), `stock:${stock.id}`);
      }
      body.append(list); return;
    }
    const sources = section('掌门亲自采集', '采得物资随身携带，可从货位详情安排实际入库。');
    for (const patch of view.operations?.harvest || []) listEntry(sources, patch.name, `每批 ${number(patch.batchSize)} 份 · ${patch.available ? '可前往采集' : patch.reason}`, () => go({ tab: 'supply', page: 'source', id: patch.id }), `source:${patch.id}`);
    body.append(sources);
  }
  function stockDetail(view) {
    const stock = stocks(view).find(item => item.id === current.id); if (!stock) return note(body, '这个货位已结清或暂不可查看，可返回选择其他货位。');
    const detail = section(stock.label || '物资货位', stock.locationLabel);
    note(detail, stock.ownershipLabel || stock.ownerLabel || (stock.access === 'public' ? '归属：公用物资' : '归属：掌门私人'));
    if (stock.storage) {
      facts(detail, [['库存', `${number(stock.storage.used)} / ${number(stock.storage.capacity)} 份`], ['在途预留', `${number(stock.storage.reserved)} 份`]]);
      for (const category of stock.storage.categories || []) note(detail, `${category.label} · ${number(category.used)} / ${number(category.capacity)} 份${category.reserved ? ` · 在途 ${number(category.reserved)} 份` : ''}`);
    }
    if (stock.serviceStorage && !stock.serviceStorage.enabled) {
      note(detail, '生活库位每级可存木石1200、粮食400、药材600、水200份。');
      commandAction(detail, '划分生活库位', { type: 'enable-warehouse-services', stockpileId: stock.id }, 'stock:enable-services', stock.serviceStorage);
    }
    if (stock.orderReserved) note(detail, '这里存放当前工单材料，按对应事务结算。', 'consequence-note');
    const table = node('table', undefined, 'inventory-table'), head = node('tr'); for (const name of ['物品', '可用', '预留', '在途']) head.append(node('th', name)); table.append(head);
    for (const item of itemRows(stock).filter(item => item.available > 0 || item.reserved > 0 || item.inTransit > 0)) { const row = node('tr'); row.append(node('th', item.name || resourceName(item.id)), node('td', number(item.available)), node('td', number(item.reserved)), node('td', number(item.inTransit))); table.append(row); }
    if (table.childNodes.length > 1) detail.append(table); else note(detail, '当前货位没有物资。');
    if (stock.allocations?.length) {
      const allocation = node('div', undefined, 'allocation-list'); allocation.append(node('h4', '已占用物资的去向'));
      for (const entry of stock.allocations) note(allocation, `${entry.name || resourceName(entry.resource)} ${number(entry.quantity)} · ${entry.purpose || '当前事务'} · ${entry.phase === 'inTransit' ? '在途' : '预留'}`);
      detail.append(allocation);
    }
    if (stock.position) { const row = node('div', undefined, 'management-actions'); row.append(button('定位货位', () => focusPerson({ location: { focus: stock.position }, indoor: false }), `stock:focus:${stock.id}`)); if (stock.dropped) walk(row, '走到落地点', stock.position, `stock:walk:${stock.id}`); detail.append(row); }
    body.append(detail);
    const farm = (view.operations?.farms || []).find(farm => farm.stockpileId === stock.id);
    if (farm) { const link = section('田边供给'); note(link, `下轮保留${farm.seedName || '种苗'} ${number(farm.seedRequirement || 2)} 份，田边收成可分趟入库。`); link.append(button(`查看${farm.name}生产`, () => building(farm.buildingId), 'stock:farm')); body.append(link); }
    const destinations = stocks(view).filter(item => item.id !== stock.id && !item.orderReserved &&
      (item.access === 'public' && (item.id === HOME || item.warehouse || item.serviceFacility || view.operations?.alchemy?.workstation?.stockpileId === item.id || view.operations?.meditation?.buildings?.some(building => building.stockpileId === item.id)) || item.id === 'stockpile:carried:master' && item.ownerId === 'person:master' && item.access === 'private'));
    if (destinations.length && !stock.orderReserved) {
      const targetId = destinations.some(item => item.id === states.supply.target) ? states.supply.target : destinations[0].id;
      const move = section(stock.dropped ? '回收落地物资' : '安排搬运', '每趟由掌门承运，最多40份；选择数量后按实际路径取货和送达。');
      choices(move, '送往', 'stock:destination', targetId, destinations.map(item => [item.id, item.label]), value => { states.supply.target = value; render(true); });
      for (const item of itemRows(stock).filter(item => item.available > 0)) {
        const retained = farm && item.id === (farm.resource || 'herb') ? 2 : 0, limit = transportLimit(item.available, retained);
        action(move, `${stock.dropped ? '回收' : '搬运'}${item.name || resourceName(item.id)}`, () => transfer(stock.id, targetId, item.id, retained), `stock:transfer:${item.id}`,
          { available: item.transportable !== false && limit >= 1 && view.operations?.canTransport?.available !== false,
            reason: item.transportable === false ? '此项按专属账目使用。' : limit < 1 ? `可搬余量不足1份${retained ? `，田边保留两份${farm.seedName || '种苗'}` : ''}。` : view.operations?.canTransport?.reason || (retained ? `田边保留两份${farm.seedName || '种苗'}。` : '') });
      }
      body.append(move);
    }
    const orders = activeTransports(view).filter(order => [order.sourceStockpileId, order.targetStockpileId].includes(stock.id));
    if (orders.length) { const underway = section('关联搬运'); for (const order of orders) note(underway, `${stockLabel(view, order.sourceStockpileId)} → ${stockLabel(view, order.targetStockpileId)} · ${resources(order.cargo)} · ${PHASE[order.phase] || order.phase}`); underway.append(button('查看掌门事务', () => { states.growth.mode = 'current'; go({ tab: 'growth', page: 'index' }); }, 'stock:current')); body.append(underway); }
  }
  function transferDetail(view) {
    const stock = stocks(view).find(item => item.id === current.source), target = stocks(view).find(item => item.id === current.target);
    if (!stock || !target) return note(body, '搬运货位已变化，请返回重新查看。');
    const item = itemRows(stock).find(item => item.id === current.resource), available = item?.available || 0,
      receivingLimit = target.storage?.receivable?.[current.resource] ?? Infinity,
      limit = Math.min(transportLimit(available, current.retained), receivingLimit), key = pageKey(current);
    const amount = transferDrafts.get(key) ?? String(Math.min(limit, 40));
    const form = node('form', undefined, 'management-section'); form.append(node('h3', `${stock.dropped ? '回收' : '搬运'}${item?.name || resourceName(current.resource)}`));
    facts(form, [['从', stock.label], ['到', target.label], ['承运', view.operations?.master?.name || '掌门'], ['单趟运力', '40 份'], ['此处可用', number(available)], ['本趟上限', number(limit)]]);
    note(form, current.retained ? `田边保留 ${number(current.retained)} 份供下轮播种，余下可分趟送回。` : target.id === 'stockpile:carried:master' ? '掌门实际取货后装入随身包裹，可携往商人处交易。' : stock.access !== target.access ? '送入公库后按公用物资记账。' : '本次搬运保持物资归属。');
    const label = node('label', undefined, 'setting-field'); label.append(node('span', '本趟数量')); const input = keyed(node('input'), 'transfer:quantity'); input.type = 'number'; input.min = '1'; input.max = String(limit); input.step = 'any'; input.required = true; input.value = amount; label.append(input); form.append(label);
    const summary = node('p', undefined, 'consequence-note'), submitButton = button('安排掌门搬运', () => {}, 'transfer:submit', {}, 'primary'); submitButton.type = 'submit';
    const update = () => { transferDrafts.set(key, input.value); const quantity = transportQuantity(input.value, available, current.retained);
      summary.textContent = quantity == null || quantity > limit ? limit >= 1 ? `请输入1至${number(limit)}份。` : '目标货位当前没有足够的接收容量。' : `本趟 ${number(quantity)} 份 · 送出后原处保留 ${number(available - quantity)} 份。`;
      submitButton.disabled = quantity == null || quantity > limit || item?.transportable === false || view.operations?.canTransport?.available === false || target.storage?.available === false; };
    input.oninput = update; update(); form.append(summary); note(form, view.operations?.canTransport?.reason, 'action-reason');
    note(form, target.storage?.reason || (limit < 1 ? '目标货位当前没有足够的接收容量。' : ''), 'action-reason');
    note(form, '取货前中止会退回原处；取货后中止会落在掌门当时位置，可从物资页重新回收。'); form.append(submitButton);
    form.onsubmit = event => { event.preventDefault(); if (!form.reportValidity()) return;
      const live = getView(), liveStock = stocks(live).find(entry => entry.id === current.source), liveItem = itemRows(liveStock).find(entry => entry.id === current.resource);
      const quantity = transportQuantity(input.value, liveItem?.available, current.retained), liveTarget = stocks(live).find(entry => entry.id === current.target);
      if (quantity == null || quantity > (liveTarget?.storage?.receivable?.[current.resource] ?? Infinity) || liveTarget?.storage?.available === false) { feedback = { ok: false, message: '货位数量或接收容量已变化，请重新选择。' }; render(true); return; }
      submit({ type: 'transport', sourceStockpileId: current.source, targetStockpileId: current.target, cargo: { [current.resource]: quantity } }); };
    body.append(form);
  }
  function sourceDetail(view) {
    const patch = view.operations?.harvest?.find(item => item.id === current.id); if (!patch) return note(body, '暂未找到这一采集来源。');
    const detail = section(`${patch.name}来源`); note(detail, `每次采集 ${number(patch.batchSize)} 份，存入掌门随身货位。`, 'detail-lead');
    commandAction(detail, `亲采${patch.name}`, { type: 'harvest', resource: patch.id }, `source:harvest:${patch.id}`, patch, 'primary');
    if (patch.replenish && Object.keys(patch.replenish.cost || {}).length) {
      const name = patch.id === 'food' ? '补种口粮' : patch.id === 'herb' ? '补植灵草' : '整备林地';
      commandAction(detail, `${name} · ${resources(patch.replenish.cost)}`, { type: 'replenish', resource: patch.id }, `source:replenish:${patch.id}`, patch.replenish);
    }
    body.append(detail);
  }
  function meditationDetails(view, buildingId = null) {
    const all=view.operations?.meditation, source=buildingId?all?.buildings?.find(b=>sameBuilding(b.buildingId,buildingId)):all;if(!source)return;
    const detail=section(source.name || '北台脉眼');
    if(source.discovered)facts(detail,[['天然积蓄',`${number(source.reserveMilli/1000)} / ${number(source.capacityMilli/1000)} 脉息`],['脉势',`${number(source.integrityBp/100)}%`],['每秒恢复',`${number(source.recoveryMilliPerTick/100)} 脉息`],['每秒引流上限',`${number(source.flowMilliPerSecond/1000)} 脉息`]]);
    else note(detail,'掌门到台地勘察后，可知脉眼积蓄与当前脉势。');
    commandAction(detail,source.discovered?'到脉眼复测':'勘察脉眼',{type:'survey-meditation'},'meditation:survey',source.survey,'primary');
    for(const order of source.orders.filter(o=>!['completed','cancelled'].includes(o.phase))){
      const row=node('div',undefined,'station-row');row.append(node('strong',order.kind==='sr-spirit-survey'?'现场勘察':'引流检修'));note(row,`${order.reason||'正在前往现场。'} · ${number(order.progressTicks/10)} / ${number(order.durationTicks/10)}秒`);
      if(order.kind==='sr-meditation-maintenance')note(row,`已投入${resources(order.usedInput)}；中止后尚未投入的材料退回现场货位。`);
      commandAction(row,'中止本次事务',{type:'cancel-meditation-order',workOrderId:order.id},`meditation:cancel:${order.id}`,{});detail.append(row);
    }
    if(source.maintenance){
      facts(detail,[['引流设施余量',`${number(source.maintenance.remainingMilli/source.maintenance.capacityMilli*100)}%`],['检修用料',resources(source.maintenance.cost)],['实际检修',`${number(source.maintenance.durationTicks/10)}秒`]]);
      commandAction(detail,'掌门检修引流设施',{type:'maintain-meditation',buildingId:source.buildingId},'meditation:maintain',source.maintain);
      detail.append(button('查看现场货位',()=>stockPage(source.stockpileId),'meditation:stock'));
      for(const [resource,quantity]of Object.entries(source.maintenance.cost))detail.append(button(`送入${resourceName(resource)}`,()=>transfer(HOME,source.stockpileId,resource,0,quantity),`meditation:deliver:${resource}`));
      for(const invite of source.invites||[])commandAction(detail,`请${invite.name}协助检修`,{type:'invite-work',personId:invite.personId,buildingId:source.buildingId},`meditation:invite:${invite.personId}`,invite);
    }
    body.append(detail);
    if(source.seats){const seats=section('台上吐纳','到达所选蒲团后，四席共享脉眼的实际供给。');for(const seat of source.seats){const row=node('div',undefined,'station-row');row.append(node('strong',seat.label));note(row,seat.powerReason||`完整供给时修行倍率 ${number(seat.maximumMultiplier)} 倍`);commandAction(row,'在此修炼',{type:'cultivate-meditation',buildingId:source.buildingId,slotId:seat.slotId},`meditation:cultivate:${seat.slotId}`,seat);seats.append(row);}body.append(seats);}
    if(source.upgrade&&source.level<3){const change=section('扩建聚灵台');note(change,`用度${resources(source.upgrade.cost)}。扩建前须复测脉眼，确认脉势、积蓄及引流设施余量。`);commandAction(change,'安排扩建',{type:'upgrade-meditation',buildingId:source.buildingId},'meditation:upgrade',source.upgrade);body.append(change);}
  }
  function domainSiteDetail(view) {
    const site = view.domain?.plannedSites?.find(item => item.id === current.id) || view.domain?.sites?.find(item => item.id === current.id);
    if (!site) return note(body, '当前建位已变化，可返回院务重新查看。');
    const flow = site.materialFlow, detail = section(`${site.planId ? `${site.planId} · ` : ''}${site.name}`, site.region || '山域预设建位');
    note(detail, site.description);
    note(detail, site.reason, 'detail-lead');
    if (site.reward && !site.reward.claimed) commandAction(detail, `${site.reward.name} · 领取${resources(site.reward.resources)}`,
      { type: 'claim-building-reward', rewardId: site.reward.id }, `domain:reward:${site.reward.id}`, site.reward, 'primary');
    if (site.status !== 'planning') {
      facts(detail, [['营造用度', resources(site.cost)], ['公库尚缺', resources(site.missingCost)],
        ['实际容量', site.capacityText ? `${site.capacityText}${site.status === 'complete' ? '已启用' : '，落成后启用'}` : '依设施工位开放'],
        ['施工进度', `${number(site.progress * 100)}%`]]);
    }
    if (site.status === 'locked' && site.supported) commandAction(detail, site.westWorkshops ? '开通丹房与百工坊道路' : site.northMeditation ? '开通聚灵台山道' : site.northLibrary ? '开通藏经阁北台道路' : site.services ? '开通膳房与医庐道路' : site.residences ? '开通东台住宅道路' : site.valleySite ? '开通西谷道路' : site.zoneId === 'Z-03' ? '启用西林通路' : '启用山域通路', { type: site.westWorkshops ? 'enable-west-workshops' : site.northMeditation ? 'enable-north-meditation' : site.northLibrary ? 'enable-north-library' : site.services ? 'enable-services' : site.residences ? 'enable-residences' : site.valleySite ? 'enable-valley' : 'enable-domain' }, site.westWorkshops ? 'domain:enable-west-workshops' : site.northMeditation ? 'domain:enable-north-meditation' : site.northLibrary ? 'domain:enable-north-library' : site.services ? 'domain:enable-services' : site.residences ? 'domain:enable-residences' : site.valleySite ? 'domain:enable-valley' : 'domain:enable', {}, 'primary');
    else if (site.status === 'available') {
      commandAction(detail, `营造${site.name}`, { type: 'build-site', siteId: site.id }, `domain:build:${site.id}`, site.buildAvailable, 'primary');
      note(detail, '确认后预留公库材料；掌门分趟运往工地，全部送达后到场施工。');
      if (Object.keys(site.missingCost || {}).length) {
        const supplies = node('div', undefined, 'management-actions');
        supplies.append(button('查看公库', () => stockPage(HOME), 'domain:stock'));
        for (const resource of Object.keys(site.missingCost).filter(id => view.operations?.harvest?.some(patch => patch.id === id)))
          supplies.append(button(`查看${resourceName(resource)}来源`, () => go({ tab: 'supply', page: 'source', id: resource }), `domain:source:${resource}`));
        detail.append(supplies);
      }
    } else if (site.status === 'planning') {
      commandAction(detail, '筹备中', { type: 'build-site', siteId: site.id }, `domain:build:${site.id}`, site.buildAvailable);
    }
    if (site.northMeditation && !['planning','locked','complete'].includes(site.status)) meditationDetails(view);
    if (site.entrance) {
      const location = { focus: site.entrance, label: site.name }, visit = node('div', undefined, 'management-actions');
      visit.append(button('定位建位', () => focusPerson({ location, indoor: false }), 'domain:focus', { available: site.status !== 'locked' }));
      action(visit, '走到入口', () => submit({ type: 'move', x: site.entrance.x, y: site.entrance.y }, { run: walkTo ? () => walkTo(location) : null }), 'domain:walk', site.visitAvailable);
      detail.append(visit);
    }
    body.append(detail);
    if (flow) {
      const logistics = section(flow.stageLabel || '材料与施工');
      facts(logistics, [['运送趟次', `${flow.currentTrip ? `第 ${number(flow.currentTrip)} 趟` : '准备首趟'} · 每趟最多 ${number(flow.carryCapacity)} 份`],
        ['已送至工地', `${number(flow.deliveredQuantity)} / ${number(flow.requiredQuantity)} 份`],
        ['途中携带', resources(flow.cargo)], ['旧院待取', resources(flow.sourceResources)], ['工地待用', resources(flow.siteResources)]]);
      note(logistics, view.construction?.reason);
      if (view.construction?.usedCost && Object.values(view.construction.usedCost).some(value => value > 0)) note(logistics, `已投入 ${resources(view.construction.usedCost)}`);
      for (const trip of flow.trips || []) note(logistics, `第 ${trip.id.split(':').at(-1)} 趟 · ${trip.kind === 'return' ? '返料' : '运料'} · ${resources(trip.cargo)} · ${{ carrying: '在途', delivered: '已送达', returned: '已返库' }[trip.phase] || '进行中'}`);
      commandAction(logistics, flow.cancelRequested ? '正在返料' : '中止营造并收回余料', { type: 'cancel-activity' }, 'domain:cancel', view.operations?.master?.actions?.cancel, 'quiet-danger');
      if (view.operations?.actionConsequences?.summary) note(logistics, view.operations.actionConsequences.summary, 'consequence-note');
      body.append(logistics);
    }
    if (site.status === 'complete' && site.buildingId) {
      const completed = section(`${site.name}已落成`, '实际工位与使用情况可在建筑详情中查看。');
      completed.append(button('查看建筑与工位', () => building(site.buildingId), 'domain:building', {}, 'primary')); body.append(completed);
    }
  }
  function constructionDetail(view) {
    const plan = view.growth?.buildings?.find(item => item.id === current.id);
    if (!plan) return note(body, '当前营造安排已变化，可返回院务重新查看。');
    const detail = section(plan.name, plan.status === 'complete' ? '已经落成' : plan.status === 'building' ? '正在营造' : '本院预定地块');
    note(detail, plan.reason, 'detail-lead');
    facts(detail, [['营造用度', resources(plan.cost)], ['公库尚缺', resources(plan.missingCost)], ['施工进度', `${number((plan.progress || 0) * 100)}%`]]);
    if (!['complete', 'building'].includes(plan.status)) {
      note(detail, '确认后按本次营造用度投入公库材料，掌门沿真实通路前往施工；完工后启用实际工位。', 'consequence-note');
      commandAction(detail, `确认营造${plan.name}`, { type: 'build', buildingType: plan.id }, `growth:build:${plan.id}`,
        { available: plan.available, reason: plan.available ? '' : plan.reason }, 'primary');
      if (Object.keys(plan.missingCost || {}).length) {
        const supply = node('div', undefined, 'management-actions'); supply.append(button('查看公库', () => stockPage(HOME), 'growth:stock'));
        for (const resource of Object.keys(plan.missingCost).filter(id => view.operations?.harvest?.some(patch => patch.id === id)))
          supply.append(button(`查看${resourceName(resource)}来源`, () => go({ tab: 'supply', page: 'source', id: resource }), `growth:source:${resource}`));
        detail.append(supply);
      }
    }
    if (plan.status === 'building') {
      note(detail, view.construction?.reason || '掌门按当前进度继续营造。');
      detail.append(button('查看掌门安排', () => { states.growth.mode = 'current'; go({ tab: 'growth', page: 'index' }); }, 'growth:construction-progress'));
    }
    if (plan.status === 'complete' && plan.buildingId) detail.append(button('查看建筑与工位', () => building(plan.buildingId), `growth:completed:${plan.id}`, {}, 'primary'));
    body.append(detail);
  }
  function buildingDetail(view) {
    const projection = inspect(), entry = projection.buildings.find(item => sameBuilding(item.id, current.id));
    if (!entry) return note(body, '当前建筑已变化，可返回院务重新查看。');
    const official = view.buildings.find(item => sameBuilding(item.id, current.id)), farm = view.operations?.farms?.find(item => sameBuilding(item.buildingId, current.id));
    const detail = section(entry.name, `${official?.stage === 'complete' ? '已建成' : '营造中'} · ${official?.enabled === false ? '暂停使用' : '开放使用'}`);
    note(detail, entry.detail); const location = node('div', undefined, 'management-actions'); walk(location, farm ? '走到田边' : '走到门前', entry.location, 'building:walk');
    location.append(button('定位建筑', () => focusPerson({ location: entry.location, indoor: false }), 'building:focus')); detail.append(location); body.append(detail);
    const warehouse = stocks(view).find(stock => stock.warehouse && sameBuilding(stock.buildingId, current.id));
    if (warehouse) {
      const storage = section('公库货位', '物资按实际承运记录入库，可查看各类库位的余量。');
      storage.append(button('查看公库库存', () => stockPage(warehouse.id), 'warehouse:stock', {}, 'primary')); body.append(storage);
    }
    const library = view.operations?.libraries?.find(item => sameBuilding(item.buildingId, current.id));
    if (library) {
      const family = library.family, familySection = section('家传遗卷');
      note(familySection, family.completed ? '家传已整理，现可在阁中研读《春雨养脉法》与《青岚筑基篇》。' : family.reason || '到阁内阅卷席整理家传，完成后收入可读典籍。');
      if (!family.completed) {
        facts(familySection, [['所需口粮', '2份'], ['实际整理', `${number(family.durationTicks / 10)}秒`]]);
        commandAction(familySection, '整理家传遗卷', { type: 'collate-family', buildingId: library.buildingId }, 'library:collate', family, 'primary');
      }
      body.append(familySection);
      const reading = section('阁内阅卷', `${library.studySeats}处阅卷席 · 到席后开始研读`);
      for (const art of library.arts) {
        const row = node('div', undefined, 'station-row');row.append(node('strong', art.name));
        note(row, `理解 ${number(art.understanding)} · 口粮2份 · 研读${number(art.durationTicks / 10)}秒`);
        commandAction(row, '在此研习', { type: 'study', artId: art.id, buildingId: library.buildingId }, `library:study:${art.id}`, art);
        reading.append(row);
      }
      body.append(reading);
      const lectures = section('阁内讲习', `${library.teachingSeats}处讲席 · 师生各有实际席位`);
      const qualified = library.lessons.filter(lesson => lesson.qualification.qualified);
      if (!qualified.length) note(lectures, '掌门对法门的理解达到65、实际熟练达到60，养好伤势并恢复精力后，可与门人商议讲习。');
      for (const lesson of qualified) {
        const row = node('div', undefined, 'station-row');row.append(node('strong', lesson.name));
        note(row, `口粮4份 · 双方到席讲习${number(lesson.durationTicks / 10)}秒`);
        for (const student of lesson.students) commandAction(row, `与${student.name}商议讲习`,
          { type: 'teach-library', buildingId: library.buildingId, artId: lesson.artId, personId: student.id }, `library:teach:${lesson.artId}:${student.id}`, student);
        lectures.append(row);
      }
      for (const order of library.orders.filter(order => !['completed', 'cancelled'].includes(order.phase))) note(lectures, `${order.name} · ${order.reason} · ${number(order.progressTicks / 10)} / ${number(order.durationTicks / 10)}秒`);
      body.append(lectures);
    }
    if (view.operations?.meditation?.buildings?.some(item=>sameBuilding(item.buildingId,current.id))) meditationDetails(view,current.id);
    const beds = view.housing?.beds.filter(bed => sameBuilding(bed.buildingId, current.id)) || [];
    if (beds.length) {
      const residence = section('住处与床位', '住处随本人保留；实际走到床位后才登记入住。');
      for (const bed of beds) {
        const row = node('div', undefined, 'station-row'); row.append(node('strong', bed.label));
        const facts = [bed.homePersonName && `${bed.homePersonName}的住处`, bed.pendingPersonName && `${bed.pendingPersonName}待入住`,
          bed.occupantPersonName && `${bed.occupantPersonName}${bed.activityPhase === 'executing' ? '正在使用' : '正在前往'}`].filter(Boolean);
        note(row, facts.join(' · ') || (bed.usable ? '尚未分配' : bed.reason));
        if (facts.length && !bed.usable) note(row, bed.reason, 'attention');
        if (bed.masterRest?.available) commandAction(row, '掌门在此休息', { type: 'rest', buildingId: bed.buildingId, slotId: bed.slotId }, `housing:rest:${bed.slotId}`, view.operations?.master?.actions?.rest);
        residence.append(row);
      }
      body.append(residence);
    }
    if (farm) {
      const resource = farm.resource || 'herb', seedName = farm.seedName || '种苗', productOnSite = farm.productOnSite ?? farm.herbOnSite;
      const production = section(`${farm.name}生产`);
      facts(production, [[`田边${resourceName(resource)}`, `${number(productOnSite)} 份`], [`${seedName}投入`, `每轮 ${number(farm.seedRequirement || 2)} 份`], ['当前照料', `${farm.workers.length} 人`], [`下轮缺${seedName}`, `${number(farm.seedNeeded)} 份`]]);
      if (farm.crop) {
        const phases = {growing:'生长中',mature:'已成熟','ripe/waiting':'成熟待收','paused:waterlogged':'积水停长','paused:facility':'暂停照料',harvested:'已收获'};
        note(production, `${phases[farm.crop.phase] || '照料中'} · 生长 ${number(farm.crop.growthElapsedTicks)} / ${number(farm.crop.maturityRequiredTicks)} · 照料 ${number(farm.crop.careContribution)}`);
      }
      note(production, farm.availability.reason, farm.availability.available === false ? 'action-reason' : 'muted');
      const row = node('div', undefined, 'management-actions');
      const seedDelivery = Math.max(1, Math.min(40, farm.seedNeeded));
      action(row, `送入${seedName}`, () => transfer(HOME, farm.stockpileId, resource, 0, seedDelivery), 'farm:seed', { available: farm.seedNeeded > 0 && view.operations.canTransport.available && view.resources[resource] >= seedDelivery,
        reason: farm.seedNeeded <= 0 ? `田边${seedName}已足。` : view.operations.canTransport.reason || (view.resources[resource] < seedDelivery ? `公库${seedName}不足本趟补给。` : '') }, 'primary');
      const harvest = farm.harvestTransport, harvestMax = harvest?.quantity ?? transportLimit(productOnSite, farm.seedRequirement);
      action(row, `收成入库 · 本趟最多${number(harvestMax)}份`, () => transfer(farm.stockpileId, HOME, resource, farm.seedRequirement || 2), 'farm:harvest', { available: harvest ? harvest.available : harvestMax >= 1 && view.operations.canTransport.available,
        reason: harvest?.reason || (harvestMax < 1 ? `田边留${number(farm.seedRequirement)}份${seedName}，可搬余量不足1份。` : view.operations.canTransport.reason) }); production.append(row);
      const tail = node('div', undefined, 'management-actions');
      commandAction(tail, farm.enabled ? '暂停生产' : '恢复生产', { type: 'toggle-building', buildingId: farm.buildingId }, 'farm:toggle'); tail.append(button('查看田边货位', () => stockPage(farm.stockpileId), 'farm:stock')); production.append(tail); body.append(production);
      const invites = section('商议照料', '由本人根据当前身体、已有安排与作业条件答复。');
      for (const invite of farm.invites) {
        const row = node('div', undefined, 'invite-row'); row.append(node('strong', invite.name));
        if (invite.lastResult) note(row, `上次答复：${invite.lastResult.accepted ? '愿意接受' : '暂未接受'} · ${invite.lastResult.reason || ''}`);
        commandAction(row, `请${invite.name}照料`, { type: 'invite-work', personId: invite.personId, buildingId: farm.buildingId }, `farm:invite:${invite.personId}`, invite);
        row.append(button('查看本人', () => { states.people.selected = invite.personId; go({ tab: 'people', page: 'index' }); }, `farm:person:${invite.personId}`, {}, 'text-button')); invites.append(row);
      }
      body.append(invites);
    }
    const workplace = view.operations?.workplaces?.find(item => sameBuilding(item.buildingId, current.id));
    if (workplace && !farm) {
      const work = section(`${entry.name}作业`, '由本人根据身体、已有安排与工位条件答复邀请。');
      note(work, workplace.availability?.reason, workplace.availability?.available === false ? 'action-reason' : 'muted');
      const siteStock = Object.entries(workplace.resources || {}).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => `${resourceName(id)} ${number(quantity)}`).join('、') || '空';
      facts(work, [['当前作业', `${workplace.workers?.length || 0} 人`], ['生产状态', workplace.enabled === false ? '已暂停' : '开放作业'], ['现场物资', siteStock]]);
      for (const [id, quantity] of Object.entries(workplace.resources || {}).filter(([, amount]) => amount > 0)) {
        const movable = Math.min(40, Math.floor(quantity));
        action(work, `搬回${resourceName(id)} · 现场${number(quantity)}`, () => transfer(workplace.stockpileId, HOME, id, 0, Math.max(1, movable)), `workplace:haul:${id}`,
          { available: movable >= 1 && view.operations.canTransport.available, reason: view.operations.canTransport.reason || (movable < 1 ? '现场可搬量不足1份。' : '') });
      }
      if (workplace.recipe) {
        facts(work, [['每批投料', resources(workplace.recipe.inputCost)], ['每批产出', `${resources(workplace.recipe.outputDefinition)}　交来访商人取货付款`], ['单批工时', `${number(workplace.recipe.durationTicks / 10)} 秒`]]);
        for (const [id, missing] of Object.entries(workplace.missingCost || {})) {
          const delivery = Math.min(40, missing, view.resources[id] || 0);
          action(work, `送入${resourceName(id)} · 缺${number(missing)}`, () => transfer(HOME, workplace.stockpileId, id, 0, Math.max(1, delivery)), `workplace:deliver:${id}`,
            { available: delivery > 0 && view.operations.canTransport.available, reason: view.operations.canTransport.reason || (delivery <= 0 ? `公库${resourceName(id)}不足。` : '') });
        }
        note(work, '材料先实际送到工位；本人到岗后开工，成品由商人到坊取货付款。');
      }
      const order = workplace.order;
      const processes = workplace.processes || [];
      if (processes.length) {
        const list = section('专业工序', '宗主指定本坊下一批工序；原料须已在坊内，本人到岗后开工。');
        for (const process of processes) {
          const row = node('div', undefined, 'station-row'); row.append(node('strong', process.name));
          note(row, `每批投料 ${resources(process.inputCost)} · 产出 ${resources(process.outputDefinition)} · 工时 ${number(process.durationTicks / 10)} 秒`);
          for (const [id, missing] of Object.entries(process.missingCost || {})) {
            const delivery = Math.min(40, missing, view.resources[id] || 0);
            action(row, `送入${resourceName(id)} · 缺${number(missing)}`, () => transfer(HOME, workplace.stockpileId, id, 0, Math.max(1, delivery)), `workplace:process:${process.id}:${id}`,
              { available: delivery > 0 && view.operations.canTransport.available, reason: view.operations.canTransport.reason || (delivery <= 0 ? `公库${resourceName(id)}不足。` : '') });
          }
          commandAction(row, `委托${process.name}`, { type: 'start-workshop-process', buildingId: workplace.buildingId, processId: process.id }, `workplace:process:${process.id}`,
            { available: process.availability.available && workplace.availability.available && (!order || order.phase === 'completed'), reason: order && order.phase !== 'completed' ? '已有在制批次，先完成或中止。' : process.availability.reason }, 'primary');
          list.append(row);
        }
        work.append(list);
      }
      commandAction(work, workplace.enabled === false ? '恢复生产' : '暂停生产', { type: 'toggle-building', buildingId: workplace.buildingId }, 'workplace:toggle');
      if (order) {
        const processName = workplace.selectedProcess ? processes.find(process => process.id === workplace.selectedProcess)?.name || '常规器物' : '常规器物';
        facts(work, [['本批工序', processName], ['在制批次', `第 ${number(order.batch ?? 1)} 批`], ['加工进度', `${number(order.progressTicks || 0)} / ${number(order.durationTicks || 0)}`], ['工单状态', order.phase === 'completed' ? (workplace.recipe ? '已完工，商人到坊取货付款' : '已完工，待搬入府库') : order.phase === 'waiting' ? '已委托，待本人到岗' : '加工中']]);
        commandAction(work, '中止本批生产', { type: 'cancel-production', buildingId: workplace.buildingId }, 'workplace:cancel',
          { available: order.phase !== 'completed', reason: order.phase === 'completed' ? '本批已完工，无需中止。' : '' });
      } else note(work, '当前没有在制工单；材料送到工位、本人到岗后开工。');
      for (const invite of workplace.invites || []) {
        const row = node('div', undefined, 'invite-row'); row.append(node('strong', invite.name));
        if (invite.lastResult) note(row, `上次答复：${invite.lastResult.accepted ? '愿意接受' : '暂未接受'} · ${invite.lastResult.reason || ''}`);
        commandAction(row, `请${invite.name}参与作业`, { type: 'invite-work', personId: invite.personId, buildingId: workplace.buildingId }, `workplace:invite:${invite.personId}`, invite);
        row.append(button('查看本人', () => openPerson(invite.personId), `workplace:person:${invite.personId}`, {}, 'text-button')); work.append(row);
      }
      body.append(work);
    }
    const alchemy = view.operations?.alchemy;
    if (alchemy?.workstation && sameBuilding(alchemy.workstation.buildingId, current.id)) {
      const furnace = alchemy.workstation, staged = alchemy.recipes.some(recipe => recipe.processStages?.length),
        work = section('丹房', staged ? '药材与洁水先送到药库，掌门依次整理、浸滤、照炉和封藏。' : '药材先搬到炉边，掌门到位后照料火候。');
      facts(work, [['操作工位', `${furnace.workSlots} 处`], ['炉况', furnace.enabled ? '可用' : '暂停']]);
      work.append(button('查看炉边药库', () => stockPage(furnace.stockpileId), 'alchemy:stock'));
      for (const recipe of alchemy.recipes) {
        const row = node('div', undefined, 'station-row'); row.append(node('strong', recipe.name));
        note(row, `${recipe.description} · 每炉 ${recipe.yield} 份 · ${recipe.processStages?.length ? '工序合计' : '照炉'} ${number(recipe.durationTicks / 10)} 秒`);
        if (recipe.processStages?.length) note(row, recipe.processStages.map(stage => `${stage.label} ${number(stage.durationTicks / 10)}秒`).join(' → '));
        note(row, `每炉投入 ${resources(recipe.cost)}`);
        commandAction(row, `开炉炼制${recipe.name}`, { type: 'craft-pill', buildingId: furnace.buildingId, recipeId: recipe.id }, `alchemy:craft:${recipe.id}`, { available: recipe.available, reason: recipe.reasons.join('；') }, 'primary');
        for (const [id, quantity] of Object.entries(recipe.cost)) if (!['jade', 'insight'].includes(id)) {
          const missing = Math.max(0, quantity - (furnace.resources?.[id] || 0)), delivery = Math.min(40, missing, view.resources[id] || 0);
          if (missing > 0) action(row, `送入${resourceName(id)} · 缺${number(missing)}`, () => transfer(HOME, furnace.stockpileId, id, 0, Math.max(1, delivery)), `alchemy:deliver:${recipe.id}:${id}`, { available: delivery > 0 && view.operations.canTransport.available, reason: view.operations.canTransport.reason || (delivery <= 0 ? `公库${resourceName(id)}不足。` : '') });
        }
        work.append(row);
      }
      const orders = alchemy.orders.filter(order => order.buildingId === furnace.buildingId), active = orders.filter(order => order.phase === 'active');
      for (const order of active.concat(orders.filter(order => order.phase !== 'active').slice(-3))) {
        const row = node('div', undefined, 'station-row'); row.append(node('strong', order.recipeName));
        const phaseLabel = order.phase === 'active' ? order.process?.stageLabel || '照炉中' : { completed: '已成药', cancelled: '已中止', interrupted: '炉事中断' }[order.phase] || order.phase;
        note(row, `${phaseLabel} · ${number(order.progressTicks / 10)} / ${number(order.durationTicks / 10)} 秒`);
        if (order.phase === 'active' && order.process?.stageCount > 1) note(row, `当前工序 ${number(order.process.progressTicks / 10)} / ${number(order.process.durationTicks / 10)} 秒`);
        if (order.reason) note(row, order.reason);
        if (order.phase === 'active') commandAction(row, '中止本炉', { type: 'cancel-activity' }, `alchemy:cancel:${order.id}`, view.operations.master.actions.cancel);
        work.append(row);
      }
      const pills = Object.entries(furnace.pills || {}).filter(([,quantity]) => quantity > 0);
      for (const [id, quantity] of pills) {
        const label = alchemy.recipes.find(recipe => recipe.id === id)?.name || id;
        action(work, `取出${label} · ${number(quantity)}份`, () => transfer(furnace.stockpileId, CARRIED, `pill:${id}`, 0, Math.min(40, quantity)), `alchemy:take:${id}`, view.operations.canTransport);
      }
      body.append(work);
    }
    const service = view.operations?.services?.find(item => sameBuilding(item.buildingId, current.id));
    if (service?.enabled) {
      const work = section('现场工序', '材料先送到本院，工序由本人到场完成。');
      work.append(button('查看现场货位', () => stockPage(service.stockpileId), 'service:stock'));
      for (const recipe of service.recipes) {
        const row = node('div', undefined, 'station-row'); row.append(node('strong', recipe.name));
        note(row, `每批投入 ${resources(recipe.input)}${Object.keys(recipe.output || {}).length ? ` · 产出 ${resources(recipe.output)}` : ''}`);
        if (recipe.patientSlotKind) {
          for (const patient of service.patients || []) {
            commandAction(row, `为${patient.name}安排${recipe.name}`, { type: 'start-service', buildingId: service.buildingId, recipeId: recipe.id, patientId: patient.personId },
              `service:start:${recipe.id}:${patient.personId}`, { available: recipe.available && patient.available, reason: recipe.reason || patient.reason });
          }
        } else commandAction(row, `安排一批${recipe.name}`, { type: 'start-service', buildingId: service.buildingId, recipeId: recipe.id }, `service:start:${recipe.id}`, recipe, 'primary');
        note(row, recipe.reason, 'action-reason'); work.append(row);
      }
      for (const order of service.orders.filter(item => !['completed', 'cancelled'].includes(item.phase)).concat(service.orders.filter(item => ['completed', 'cancelled'].includes(item.phase)).slice(-3))) {
        const recipe = service.recipes.find(item => item.id === order.recipeId), row = node('div', undefined, 'station-row');
        row.append(node('strong', `${recipe?.name || '现场工序'} · ${{ queued: '等待开工', moving: '前往工位', working: '作业中', waiting: '等待条件', completed: '已完成', cancelled: '已中止' }[order.phase] || '进行中'}`));
        note(row, `${number(order.progressTicks / order.durationTicks * 100)}% · ${order.reason || ''}`);
        if (!['completed', 'cancelled'].includes(order.phase)) {
          if (!order.workerId) {
            commandAction(row, '掌门亲自承担', { type: 'master-service', workOrderId: order.id }, `service:master:${order.id}`, order.masterWork || {});
            for (const invite of order.invites || []) {
              commandAction(row, `请${invite.name}承担`, { type: 'invite-service-work', workOrderId: order.id, personId: invite.personId }, `service:invite:${order.id}:${invite.personId}`, invite);
              if (invite.lastResult) note(row, `${invite.name}上次答复：${invite.lastResult.publicReason || invite.lastResult.reason || (invite.lastResult.accepted ? '愿意接受' : '暂未接受')}`);
            }
          }
          commandAction(row, '中止工序', { type: 'cancel-service', workOrderId: order.id }, `service:cancel:${order.id}`, {}, 'quiet-danger');
        }
        work.append(row);
      }
      body.append(work);
      if (service.recipes.some(recipe => recipe.id === 'meal')) {
        const meals = section('到场用膳', '每日最多两份，在膳房实际用膳后抵扣当天口粮。');
        commandAction(meals, '掌门用一份饭食', { type: 'eat-service-meal', buildingId: service.buildingId, resourceKey: 'meal' }, 'service:eat:meal', service.meal || {});
        commandAction(meals, '掌门用一份灵膳', { type: 'eat-service-meal', buildingId: service.buildingId, resourceKey: 'spiritMeal' }, 'service:eat:spiritMeal', service.spiritMeal || {});
        note(meals, service.meal?.reason); body.append(meals);
      }
    }
    const stations = section('实际席位');
    facts(stations, [['使用中', String(entry.slotCounts.occupied)], ['已预约', String(entry.slotCounts.reserved)], ['空闲', String(entry.slotCounts.free)]]);
    for (const status of ['occupied', 'reserved', 'free']) {
      const slots = entry.slots.filter(slot => slot.status === status); if (!slots.length) continue;
      const group = node('div', undefined, 'station-group'); group.append(node('h4', { occupied: '正在使用', reserved: '已预约', free: '可用空席' }[status]));
      for (const slot of slots) {
        const row = node('div', undefined, 'station-row'); row.append(node('span', slot.name));
        if (slot.personId) row.append(button(slot.personName, () => { states.people.selected = slot.personId; go({ tab: 'people', page: 'index' }); }, `slot:${slot.id}`, {}, 'text-button')); group.append(row);
      } stations.append(group);
    }
    body.append(stations);
    for (const [label, people] of [['当前在场', entry.occupants], ['正在前往', entry.incoming]]) {
      if (!people.length) continue; const group = section(label);
      for (const person of people) listEntry(group, person.name, person.label || '按当前安排活动', () => { states.people.selected = person.id; go({ tab: 'people', page: 'index' }); }, `building:person:${label}:${person.id}`); body.append(group);
    }
    const exit = section('安排完成后'); exit.append(button('返回院务 · 继续运行', () => { history = []; go({ tab: 'affairs', page: 'index' }, { push: false }); }, 'building:continue', {}, 'primary')); body.append(exit);
  }
  function renderFeedback() {
    if (feedback) {
      const result = node('div', undefined, `management-feedback ${feedback.ok ? 'success' : 'failure'}`); result.setAttribute('role', 'status'); result.append(node('p', feedback.message));
      if (feedback.consequences?.summary && feedback.consequences.summary !== feedback.message) note(result, feedback.consequences.summary);
      body.append(result);
    }
    if (pending) {
      const confirm = node('section', undefined, 'management-confirm'); confirm.setAttribute('role', 'alert'); confirm.append(node('h3', '更改当前安排'));
      note(confirm, pending.consequence.summary); const row = node('div', undefined, 'management-actions');
      row.append(button('确认更改', () => { const next = pending, latest = getView();
        if ((latest.operations?.master?.activity?.id || null) !== next.activityId) { pending = null; syncReading(); feedback = { ok: false, message: '当前事务已变化，请重新查看后再安排。' }; render(true); return; }
        const effect = latest.operations?.actionConsequences;
        if (effect?.summary !== next.consequence.summary) { pending.consequence = effect; feedback = { ok: false, message: '当前事务已有进展，请查看更新后的结算说明。' }; render(true); return; }
        submit(next.request, { confirmed: true, run: next.run }); }, 'confirm-action', {}, 'quiet-danger'), button('保留当前安排', () => { pending = null; syncReading(); render(true); }, 'cancel-confirm'));
      confirm.append(row); body.append(confirm);
    }
  }
  function captureFocus() {
    const active = document.activeElement;
    if (!body.contains(active) || !active.dataset.uiKey) return null;
    return { key: active.dataset.uiKey, start: active.selectionStart, end: active.selectionEnd };
  }
  function restoreFocus(focus) {
    if (!focus) return;
    const target = [...body.querySelectorAll('[data-ui-key]')].find(el => el.dataset.uiKey === focus.key);
    if (!target || target.disabled) return;
    target.focus({ preventScroll: true });
    if (focus.start != null && /^(search|text)$/.test(target.type)) target.setSelectionRange(focus.start, focus.end);
  }
  function render(force = false, navigated = false) {
    if (panel.hidden || rendering) return;
    const view = getView(), signature = JSON.stringify([current, states, Math.floor(view.tick / 10), view.control, view.policy, view.foodSupply, view.resources, view.operations, view.domain, view.construction, view.growth, view.housing, view.reception, view.people.map(person => person.admission)]);
    const editing = body.contains(document.activeElement) && /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (!force && (interacting || editing || signature === lastSignature)) return;
    rendering = true; lastSignature = signature; const focus = navigated ? null : captureFocus(), scroll = navigated ? scrolls.get(pageKey(current)) || 0 : body.scrollTop;
    try {
      for (const list of body.querySelectorAll('[data-scroll-key]')) listScrolls.set(list.dataset.scrollKey, list.scrollTop);
      body.replaceChildren();
      title.textContent = current.page === 'building' ? '建筑详情' : current.page === 'construction' ? '本院营造' : current.page === 'domain-site' ? '山域营造' : current.page === 'transfer' ? '搬运安排' : current.page === 'stock' ? '货位详情' : '山院簿';
      for (const item of tabs) item.setAttribute('aria-selected', String(item.dataset.tab === current.tab));
      statusNote.textContent = pending?.freezeWorld ? '正在确认营造结算 · 世界暂停' : reading ? '正在阅读建筑 · 返回院务后继续运行' : '院务随世界更新 · 可随时暂停';
      if (history.length || current.page !== 'index') {
        const trail = node('div', undefined, 'management-breadcrumb'); trail.append(button('‹ 返回', back, 'page:back', {}, 'text-button'), node('span', `${PAGE[current.tab]}${current.page === 'policy' ? ' · 自主安排' : ''}`)); body.append(trail);
      }
      renderFeedback();
      ({ index: () => ({ affairs, people, growth, supply }[current.tab])(view), policy: () => policy(view), construction: () => constructionDetail(view), building: () => buildingDetail(view), 'domain-site': () => domainSiteDetail(view), stock: () => stockDetail(view), transfer: () => transferDetail(view), source: () => sourceDetail(view) }[current.page] || (() => note(body, '此页暂不可查看。')))();
      restoreFocus(focus); body.scrollTop = scroll;
      for (const list of body.querySelectorAll('[data-scroll-key]')) list.scrollTop = listScrolls.get(list.dataset.scrollKey) || 0;
    } finally { rendering = false; }
  }
  return {
    open(name = 'affairs', ids = null) { if (!PAGE[name]) name = 'affairs'; if (name === 'people') states.people.ids = ids; go({ tab: name, page: 'index' }, { push: false }); history = []; },
    openBuilding: building,
    openDomainSite: domainSite,
    requestMove(location, { onStarted } = {}) {
      const point = location?.focus || location;
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return { ok: false, error: '当前尚无可靠位置。' };
      if (getView().operations?.actionConsequences?.requiresConfirmation) {
        states.growth.mode = 'current'; go({ tab: 'growth', page: 'index' });
      }
      const request = { type: 'move', x: point.x, y: point.y };
      return submit(request, { run: () => { const result = walkTo ? walkTo(location) : command(request); if (result.ok) { const message = onStarted?.(result); if (message) result.message = message; } return result; } });
    },
    back, close, render,
  };
}
