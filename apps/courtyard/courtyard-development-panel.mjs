/** Public opportunities and the member's own disclosed decisions. */
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function note(parent, text, className = 'person-note') { if (text) parent.append(node('p', text, className)); }
function facts(parent, rows, className) {
  const list = node('dl', null, className);
  for (const [label, value] of rows) if (value !== undefined && value !== null && value !== '') {
    const row = node('div'); row.append(node('dt', label), node('dd', value)); list.append(row);
  }
  parent.append(list);
}
const activityLabel = member => {
  const phase = { moving: '前往', waiting: '等候', blocked: '受阻', active: '进行中', away: '外出' }[member.activityStatus];
  return [phase, member.activityLabel || member.activity].filter(Boolean).join(' · ');
};
function reasons(parent, member, className) {
  note(parent, member.physicalReason ? `当前状态：${member.physicalReason}` : '', className);
  note(parent, member.reason ? `本人打算：${member.reason}` : '', className);
}
const number = value => Number.isFinite(value) ? String(Math.round(value * 10) / 10) : '—';

export function renderDiscipleDevelopment(parent, { data, openPerson, value, change, save }) {
  if (!data) return;
  const section = node('section', null, 'management-section');
  section.append(node('h3', '宗门分工'));
  note(section, '经营侧重增加相应事务的机会。门人依本人志向、身体与已有承诺选择是否参与。', 'muted');
  const focus = data.workFocus;
  if (focus) {
    const label = node('label', null, 'filter-field'); label.append(node('span', '经营侧重'));
    const select = node('select'); select.dataset.uiKey = 'development:focus';
    for (const item of focus.options || []) { const option = node('option', item.label); option.value = item.id; select.append(option); }
    select.value = value ?? focus.value;
    select.onchange = () => change(select.value); label.append(select); section.append(label);
    const button = node('button', '保存经营侧重'); button.type = 'button'; button.dataset.uiKey = 'development:save-focus';
    button.onclick = () => save(select.value); section.append(button);
    note(section, `当前已保存：${focus.label}`, 'muted');
  }
  for (const member of data.members || []) {
    const row = node('div', null, 'management-section');
    const button = node('button', member.name, 'management-list-row'); button.type = 'button'; button.dataset.uiKey = `development:person:${member.personId}`;
    button.onclick = () => openPerson(member.personId); row.append(button);
    facts(row, [['本人志向', member.goal], ['当前安排', activityLabel(member)]], 'management-facts');
    reasons(row, member, 'muted'); section.append(row);
  }
  parent.append(section);
}

export function renderPersonCraftRequests(parent, { data, requestCraft, prepareCraft, cancelPreparation, selectedRecipeId, changeRecipe }) {
  if (!data) return;
  const section = node('section', null, 'person-admission'); section.dataset.uiKey = 'person:craft-requests';
  section.append(node('h3', '商议炼制一炉'));
  if (!data.contact?.available) {
    note(section, data.contact?.reason || '走近后再商议炼药。', 'person-distance'); parent.append(section); return;
  }
  note(section, '提出一炉丹药的需要，由本人答复。现场投入、四段工序与成药搬回公库都需要实际完成。');
  const answer = data.lastAnswer;
  if (answer) {
    const last = node('div'); last.dataset.uiKey = 'person:craft-answer';
    const label = { accepted: '已接受', refused: '本人暂不愿', unavailable: '条件尚不具备', completed: '已实际交付', interrupted: '本批已中止' }[answer.status] || '已记录';
    facts(last, [['本次商议', `${answer.recipeName} · ${label}`]], 'person-facts'); note(last, answer.reason); section.append(last);
  }
  if (data.active) {
    const active = node('div'); active.dataset.uiKey = 'person:craft-active';
    if (data.active.deliveryStatus === 'preparing') {
      facts(active, [['本炉准备', data.active.recipeName], ['当前安排', '筹备实际材料']], 'person-facts');
      note(active, data.active.reason);
      for (const material of data.active.materials || []) note(active, `${material.label}需 ${number(material.required)}，丹房已有 ${number(material.site)}，公共余料 ${number(material.publicAvailable)}，实际在途 ${number(material.inTransit)}${material.missing > 0 ? `，仍缺 ${number(material.missing)}` : ''}。`);
      if (data.active.materialTransportId) note(active, ({ 'to-source': '本人正前往实际仓储取料。', carrying: '本批材料已取到，正在送往丹房。', delivered: '材料已运抵丹房，等待本人接续。', cancelled: '材料运输已中止，物资保留在实际结清位置。' })[data.active.materialTransportPhase] || '按材料运输的实际状态等待接续。');
      const cancel = node('button', '撤回本炉筹备'); cancel.type = 'button'; cancel.dataset.uiKey = 'person:cancel-craft-preparation';
      cancel.onclick = () => { cancel.disabled = true; cancelPreparation(data.active.requestId); }; active.append(cancel);
      note(active, '撤回停止后续开炉；已接下的搬运会沿原路完成，物资仍留在实际位置。');
    } else {
      const state = { crafting: '正在炼制', waiting: '等待成药搬运', delivering: '成药正在运往公库', delivered: '成药已运抵公库', interrupted: '本批已中止' }[data.active.deliveryStatus] || '按原炉单继续';
      const progress = data.active.durationTicks > 0 ? Math.round(Math.max(0, Math.min(1, data.active.progressTicks / data.active.durationTicks)) * 100) : 0;
      facts(active, [['实际炉单', data.active.recipeName], ['当前工序', data.active.stageLabel], ['炼制进度', `${progress}%`], ['交付', state]], 'person-facts');
      note(active, data.active.reason);
    }
    section.append(active);
  }
  const recipes = data.recipes || [];
  if (!data.active && recipes.length) {
    const label = node('label', null, 'person-field'); label.append(node('span', '本炉丹方'));
    const select = node('select'); select.dataset.uiKey = 'person:craft-recipe';
    for (const recipe of recipes) { const option = node('option', recipe.name); option.value = recipe.recipeId; select.append(option); }
    const selected = recipes.find(recipe => recipe.recipeId === selectedRecipeId) || recipes[0]; select.value = selected.recipeId;
    select.onchange = () => changeRecipe(select.value); label.append(select); section.append(label);
    const recipe = selected;
    const row = node('div', null, 'action-option'); row.dataset.uiKey = `person:craft-recipe:${recipe.recipeId}`; row.append(node('strong', recipe.name));
    facts(row, [['丹方资格', recipe.qualified ? '已具备' : '尚未具备']], 'person-facts');
    if (Number.isFinite(recipe.yield)) note(row, `本炉产出 ${number(recipe.yield)} 份${recipe.name}，完成后由本人实际搬回公库。`);
    for (const material of recipe.materials || []) note(row, `${material.label}需 ${number(material.required)}，${material.sourceLabel || '实际货位'}现有 ${number(material.available)}${material.available < material.required ? `，尚缺 ${number(material.required - material.available)}` : ''}。`);
    for (const material of recipe.preparationMaterials || []) if (material.deficit > 0 || material.inTransit > 0) note(row, `本炉${material.label}：丹房待补 ${number(material.deficit)}，同院公共余料 ${number(material.publicAvailable)}，实际在途 ${number(material.inTransit)}${material.missing > 0 ? `，仍缺 ${number(material.missing)}` : ''}。`);
    for (const reason of recipe.reasons || []) note(row, reason);
    const button = node('button', `商议炼制${recipe.name}`); button.type = 'button'; button.dataset.uiKey = `person:request-craft:${recipe.recipeId}`;
    button.disabled = !recipe.available; button.onclick = () => { button.disabled = true; requestCraft(recipe.recipeId, recipe.buildingId); }; row.append(button); section.append(row);
    if (!recipe.available && recipe.canPrepare) {
      const prepare = node('button', '筹备这一炉'); prepare.type = 'button'; prepare.dataset.uiKey = `person:prepare-craft:${recipe.recipeId}`;
      prepare.onclick = () => { prepare.disabled = true; prepareCraft(recipe.recipeId, recipe.buildingId); }; row.append(prepare);
      note(row, '先提出本炉筹备，由本人在原承诺与实际供料允许时搬料、炼制并交付。');
    }
    if (!recipe.available && !recipe.canPrepare) for (const reason of recipe.prepareReasons || []) if (!(recipe.reasons || []).includes(reason)) note(row, reason);
  } else if (!data.active && !recipes.length) note(section, '暂无可公开商议的丹方。');
  parent.append(section);
}

export function renderPersonAdvancement(parent, { data, navigateCraftPerson }) {
  if (!data?.contact?.available) return;
  const section = node('section', null, 'person-admission'); section.dataset.uiKey = 'person:advancement'; section.append(node('h3', '进阶准备'));
  note(section, data.reason);
  if (data.pill?.required) {
    if (data.pickup) facts(section, [['筑基丹', '正在实际取丹'], ['取药状态', data.pickup.phase === 'carrying' ? '已经取到，正收入随身' : '正在前往取药']], 'person-facts');
    else if (data.pill.reserved) facts(section, [['本次筑基丹', data.active?.consumed ? '已炼化使用' : '已为本次突破预留']], 'person-facts');
    else facts(section, [['所需筑基丹', `${number(data.pill.required)} 份`], ['本人身边可用', `${number(data.pill.available)} 份`], ['同院有权取用', `${number(data.pill.localAvailable)} 份`]], 'person-facts');
    note(section, data.pill.reason);
  }
  if (data.active) {
    const progress = data.active.durationTicks > 0 ? Math.round(Math.max(0, Math.min(1, data.active.progressTicks / data.active.durationTicks)) * 100) : 0;
    facts(section, [['突破进度', `${progress}%`]], 'person-facts');
  }
  if (data.needsFoundation && data.recipeId === 'foundation' && data.pharmacists?.length) {
    section.append(node('h3', '向同门商议炼丹'));
    note(section, '先查看同门，走近后再商议这一炉；是否愿意炼制、取药和突破，仍由本人决定。');
    for (const person of data.pharmacists) {
      const button = node('button', `与${person.name}商议炼丹`); button.type = 'button'; button.dataset.uiKey = `person:advancement-craft:${person.personId}`;
      button.onclick = () => navigateCraftPerson(person.personId, 'foundation'); section.append(button);
    }
  }
  parent.append(section);
}

export function renderPersonDevelopment(parent, { member, recommend, craftRequests, requestCraft, prepareCraft, cancelPreparation, advancement, navigateCraftPerson, selectedCraftRecipe, changeCraftRecipe }) {
  if (!member) return;
  const section = node('section', null, 'person-admission'); section.append(node('h2', '修行与分工'));
  facts(section, [['本人志向', member.goal], ['当前安排', activityLabel(member)]], 'person-facts');
  reasons(section, member);
  if (!member.contact?.available) {
    note(section, member.contact?.reason || '走近后可商议修行安排。', 'person-distance');
    parent.append(section); return;
  }
  const cultivation = member.cultivation;
  if (cultivation) {
    const progress = node('div'); progress.dataset.uiKey = 'person:cultivation-progress';
    facts(progress, [['境界', cultivation.realm], ['修为积累', `${number(cultivation.xp)} / ${number(cultivation.required)}`]], 'person-facts');
    if (cultivation.breakthrough) {
      facts(progress, [['突破进度', `${number(cultivation.breakthrough.progress)} / ${number(cultivation.breakthrough.total)}`]], 'person-facts');
      note(progress, cultivation.breakthrough.reason);
    }
    if (advancement?.pickup) note(progress, '本人正在实际领取筑基丹，取药完成后再按原规则决定突破。');
    else {
      for (const condition of cultivation.conditions || []) note(progress, condition);
      for (const material of cultivation.materials || []) note(progress, `突破所需${material.label} ${number(material.required)}，公库现有 ${number(material.available)}${material.available < material.required ? `，尚缺 ${number(material.required - material.available)}` : ''}。`);
      if (!cultivation.breakthrough) note(progress, '积累、材料与身体条件齐备后，由本人选择并到静修位置突破。');
    }
    section.append(progress);
  }
  renderPersonAdvancement(section, { data: advancement, navigateCraftPerson });
  const learning = member.learning;
  if (learning) facts(section, [['当前研习', learning.name], [learning.practice ? '本轮研考' : '学习进度', `${number(learning.progress)} / ${number(learning.total ?? (learning.practice ? 40 : undefined))}`]], 'person-facts');
  else note(section, '当前没有正在研习的法门。');
  const knowledge = member.knowledge || [], skills = member.skills || [];
  section.append(node('h3', '已取得的知识与技艺'));
  if (!knowledge.length && !skills.length) note(section, '尚无已知的研习与技艺记录。');
  facts(section, [...knowledge.map(item => [item.name, `理解 ${number(item.value)}`]), ...skills.map(item => [item.label, number(item.value)])], 'person-facts');
  const pharmacist = member.pharmacist;
  if (pharmacist) {
    const details = node('div'); details.dataset.uiKey = 'person:pharmacist-progress';
    details.append(node('h3', '炼药与进阶'));
    note(details, '完成一炉积累医理；已学药理可在实操中加深理解。丹方资格具备后，仍须本人愿意、身体允许且现场材料齐备。');
    const last = pharmacist.lastCompletion;
    if (last) note(details, `最近炼制：医理 ${number(last.growth.medicine.before)} → ${number(last.growth.medicine.after)}；药理理解 ${number(last.growth.alchemy.before)} → ${number(last.growth.alchemy.after)}。`);
    for (const recipe of pharmacist.recipes || []) {
      facts(details, [[recipe.name, recipe.qualified ? '已具备丹方资格' : recipe.reasons.join('；')]], 'person-facts');
    }
    section.append(details);
  }
  renderPersonCraftRequests(section, { data: craftRequests, requestCraft, prepareCraft, cancelPreparation, selectedRecipeId: selectedCraftRecipe, changeRecipe: changeCraftRecipe });
  if (member.recommendation) note(section, `上次商议${member.recommendation.name ? ` · ${member.recommendation.name}` : ''}：${member.recommendation.publicReason || '已记录本次答复。'}`);
  section.append(node('h3', '推荐已开放法门'));
  note(section, '当面提出建议，由本人答复；愿意研习者仍需完成当前承诺，并满足到场与阅卷条件。');
  if (!member.options?.length) note(section, '暂无可商议的新法门。');
  for (const option of member.options || []) {
    const row = node('div', null, 'action-option'); row.append(node('strong', option.name));
    note(row, `${option.available ? '可商议' : '暂不可商议'} · ${!option.available ? '待条件具备后询问意愿' : option.willing === true ? '愿在当前安排结束后考虑研习' : option.willing === false ? '本人不愿' : '待本人答复'}`);
    note(row, option.reason);
    const button = node('button', `推荐${option.name}`); button.type = 'button'; button.dataset.uiKey = `person:recommend:${option.techniqueId}`;
    button.disabled = !member.contact?.available || !option.available;
    button.onclick = () => recommend(option.techniqueId); row.append(button); section.append(row);
  }
  parent.append(section);
}
