/** Public disciple plans and disclosed journey reports; policy never assigns a person. */
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function note(parent, text) { if (text) parent.append(node('p', text, 'muted')); }
function facts(parent, entries) {
  const list = node('dl', null, 'management-facts');
  for (const [label, value] of entries) {
    if (!value) continue;
    const group = node('div'); group.append(node('dt', label), node('dd', value)); list.append(group);
  }
  parent.append(list);
}
function personTitle(parent, person, openPerson, key) {
  if (person.personId && typeof openPerson === 'function') {
    const button = node('button', person.name || '门人', 'management-list-row');
    button.type = 'button'; button.dataset.uiKey = key;
    button.onclick = () => openPerson(person.personId); parent.append(button);
  } else parent.append(node('h4', person.name || '门人'));
}

export function renderDiscipleExpeditions(parent, { view, openPerson, command }) {
  const data = view?.discipleExpeditions;
  const section = node('section', null, 'management-section');
  section.append(node('h3', '门人近况'));
  if (!data) {
    note(section, '门人近况暂未传来。'); parent.append(section); return section;
  }
  note(section, data.summary);
  const policy = node('div', null, 'action-option');
  const toggle = node('button', data.enabled ? '暂停新的历练' : '开放门人历练');
  toggle.type = 'button'; toggle.dataset.uiKey = 'disciple-expeditions-policy';
  toggle.disabled = typeof command !== 'function' || (!data.enabled && data.availability?.available === false);
  toggle.onclick = () => command({ type: 'disciple-expeditions', enabled: !data.enabled });
  policy.append(toggle); note(policy, data.availability?.reason); section.append(policy);
  const companions = node('button', data.allowCompanions ? '暂停新的结伴机会' : '开放结伴机会');
  companions.type = 'button'; companions.dataset.uiKey = 'disciple-expeditions-companions';
  companions.disabled = typeof command !== 'function' || (!data.allowCompanions && data.availability?.available === false);
  companions.onclick = () => command({ type: 'disciple-expeditions', enabled: data.enabled, allowCompanions: !data.allowCompanions });
  policy.append(companions); note(policy, '两位同门分别同意并各自准备口粮，按实际储备携药；院中至少留一人。');
  note(section, data.nextOpportunityLabel);

  const supply = view?.medicineSupply;
  if (supply) {
    const box = node('div', null, 'management-section');
    box.append(node('h4', '回春散储备'));
    facts(box, [['公库现存', `${supply.home}份`], ['储备目标', `${supply.target}份`], ['在制与待入库', `${supply.pending + supply.transit + supply.local - supply.home}份`]]);
    note(box, supply.reason);
    if (supply.lastInterruption) note(box, `上次中止：${supply.lastInterruption.reason}`);
    const materials=supply.materials;
    if(materials?.enabled&&materials.needed){
      const names={herb:'灵草',cleanWater:'洁水',wood:'木材'};
      const gaps=Object.entries(materials.materials||{}).filter(([,m])=>m.deficit>0).map(([key,m])=>`${names[key]||key}尚缺${Number(m.deficit.toFixed(2))}份`);
      if(gaps.length)note(box, `本批备料：${gaps.join('、')}`);
      if(materials.reason)note(box, materials.reason);
    }
    if (supply.active) note(box, `${supply.active.name} · ${supply.active.kind} · ${supply.active.phase}`);
    const label = node('label', '目标份数 '), input = node('input');
    input.dataset.uiKey = 'medicine-supply-target'; input.type = 'number'; input.min = '0'; input.max = '10'; input.step = '1'; input.value = String(supply.target); input.setAttribute('aria-label', '回春散储备目标');
    label.append(input); box.append(label);
    const apply = node('button', '应用储备目标'); apply.dataset.uiKey = 'medicine-supply-apply'; apply.type = 'button'; apply.disabled = typeof command !== 'function';
    apply.onclick = () => command({ type: 'medicine-supply', enabled: true, target: Number(input.value) });
    const toggleSupply = node('button', supply.enabled ? '暂停补药' : '开启补药'); toggleSupply.dataset.uiKey = 'medicine-supply-toggle'; toggleSupply.type = 'button'; toggleSupply.disabled = typeof command !== 'function';
    toggleSupply.onclick = () => command({ type: 'medicine-supply', enabled: !supply.enabled, target: Number(input.value) });
    box.append(apply, toggleSupply); section.append(box);
  }

  section.append(node('h4', '院中生活与职责'));
  const members = data.members || [];
  if (!members.length) note(section, '暂无院中门人近况。');
  for (const member of members) {
    const row = node('div', null, 'management-section');
    const away = (data.journeys || []).some(journey => journey.personId === member.personId && !journey.report);
    if (away) row.append(node('h4', member.name || '门人'));
    else personTitle(row, member, openPerson, `disciple-member:${member.personId}`);
    facts(row, [['志向', member.goal], ['职责', member.duty], ['当前活动', member.activity]]);
    note(row, member.reason); section.append(row);
  }
  section.append(node('h4', '历练消息'));
  const journeys = data.journeys || [];
  if (!journeys.length) note(section, '尚无门人历练消息。');
  for (const journey of journeys) {
    const row = node('div', null, 'management-section');
    row.append(node('h4', journey.name || '门人')); 
    facts(row, [['目的', journey.purposeLabel], ['同行约定', journey.partyLabel], ['结伴同门', journey.companionName], ['去处', journey.routeLabel], ['行程', journey.phaseLabel], ['已知消息', journey.knownStatus]]);
    note(row, journey.decisionReason);
    if (journey.preparation?.length) {
      const list = node('ul');
      for (const item of journey.preparation) list.append(node('li', item));
      row.append(list);
    }
    if (journey.report) {
      row.append(node('h4', '归来汇报'));
      if (typeof journey.report === 'string') note(row, journey.report);
      else if (Array.isArray(journey.report)) for (const line of journey.report) note(row, line);
    }
    section.append(row);
  }
  parent.append(section); return section;
}
