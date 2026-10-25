import { renderPersonDevelopment } from './courtyard-development-panel.mjs';
/** U-111 / U-125: one persistent person, observed facts and explicit admission. */
const MASTER = 'person:master';
const $ = id => document.getElementById(id);
const node = (tag, text, className = '') => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const keyed = (element, key) => { element.dataset.uiKey = key; return element; };
const rounded = value => Number.isFinite(value) ? String(Math.round(value * 10) / 10) : '待确认';
const canRequest = admission => admission?.canRequestAdmission ?? admission?.canAdmit;

export function membershipSummary(membership) {
  if (!membership) return '';
  return [membership.rankLabel, membership.affiliationLabel, membership.mentorName ? `师父 ${membership.mentorName}` : ''].filter(Boolean).join(' · ');
}

export function createCourtyardPersonDialogue({ getView, inspect, command, quoteTrade, drawPortrait, announce, navigatePerson }) {
  let personId = null, draft = null, tradeDraft = null, craftRecipeId = null, feedback = null, signature = '';
  const content = $('person-content');
  function action(parent, label, key, run, { disabled = false, primary = false } = {}) {
    const button = keyed(node('button', label, primary ? 'primary' : ''), key);
    button.type = 'button'; button.disabled = disabled; button.onclick = run; parent.append(button); return button;
  }
  function fields(parent, rows) {
    const list = node('dl', undefined, 'person-facts');
    for (const [label, value] of rows) { const row = node('div'); row.append(node('dt', label), node('dd', value)); list.append(row); }
    parent.append(list);
  }
  function submit() {
    const person = getView().people.find(item => item.id === personId), admission = person?.admission;
    if (!draft || !canRequest(admission) || !admission.distance?.near) {
      feedback = { ok: false, message: admission?.reason || '收录条件已变化，请重新查看。' }; render(true); return;
    }
    const rank = draft.rank, mentorId = rank === 'direct' ? draft.mentorId : null;
    const result = command({ type: 'admit-visitor', personId, rank, affiliationId: admission.affiliation?.id, mentorId });
    feedback = { ok: result.ok || result.refused, message: result.refused ? result.error || result.result?.reason || '对方已说明本次答复。' : result.ok ? result.message || `${person.name}已正式入门。` : result.error || '当前未能收录，请查看条件。' };
    if (result.ok || result.refused) draft = null;
    announce(feedback.message); render(true);
  }
  function answerSeeker(answer) {
    const result = command({ type: 'answer-seeker', personId, answer });
    feedback = { ok: result.ok, message: result.ok ? result.message : result.error };
    if (result.ok) draft = null;
    announce(feedback.message); render(true);
  }
  function offerLodging() {
    const result = command({ type: 'offer-guest-lodging', personId });
    feedback = { ok: result.ok || result.refused, message: result.ok ? result.message : result.error };
    announce(feedback.message); render(true);
  }
  function recommend(techniqueId) {
    const result = command({ type: 'recommend-disciple-technique', personId, techniqueId });
    feedback = { ok: result.ok || result.refused, message: result.message || result.result?.publicReason || result.result?.reason || result.error || '已记录本次答复。' };
    announce(feedback.message); render(true);
  }
  function requestCraft(recipeId, buildingId) {
    const result = command({ type: 'request-disciple-craft', personId, recipeId, buildingId });
    feedback = { ok: result.ok || result.refused, message: result.message || result.result?.publicReason || result.result?.reason || result.error || '已记录本次炼药商议。' };
    announce(feedback.message); render(true);
  }
  function prepareCraft(recipeId, buildingId) {
    const result = command({ type: 'prepare-disciple-craft', personId, recipeId, buildingId });
    feedback = { ok: result.ok || result.refused, message: result.message || result.result?.reason || result.error || '已记录本炉筹备答复。' };
    announce(feedback.message); render(true);
  }
  function cancelPreparation(requestId) {
    const result = command({ type: 'cancel-disciple-craft-preparation', requestId });
    feedback = { ok: result.ok, message: result.message || result.result?.reason || result.error || '已记录筹备变更。' };
    announce(feedback.message); render(true);
  }
  function navigateCraftPerson(id, recipeId) {
    if (navigatePerson) navigatePerson(id, recipeId);
    else open(id, { recipeId });
  }
  function submitTrade() {
    if (!tradeDraft) return;
    const quote = quoteTrade(tradeDraft);
    if (!quote.available) { feedback = { ok: false, message: quote.reason }; render(true); return; }
    const result = command({ type: 'market-trade', personId, ...tradeDraft });
    feedback = { ok: result.ok, message: result.ok ? result.message || '已当面交付，货物与灵石留在随身包裹。' : result.error };
    if (result.ok) tradeDraft = null;
    announce(feedback.message); render(true);
  }
  function renderTrade(quote) {
    if (!quote.contact) { content.append(node('p', quote.reason || '先走到商人身边，再商议买卖。', 'person-distance')); return; }
    if (!tradeDraft) {
      content.append(node('p', '带好要卖的物资或买货的灵石，当面交付。成交所得放在随身包裹，可再搬回公库。', 'person-note'));
      action(content, '商议买卖', 'person:trade', () => { tradeDraft = { resource: 'stone', side: 'sell', batches: 1 }; feedback = null; render(true); }, { primary: true });
      return;
    }
    const form = node('form', undefined, 'person-admission'); form.append(node('h2', '当面买卖'));
    function selectField(labelText, key, value, options, change) {
      const label = node('label', undefined, 'person-field'); label.append(node('span', labelText));
      const select = keyed(node('select'), key);
      for (const item of options) { const option = node('option', item.label); option.value = String(item.id); select.append(option); }
      select.value = String(value); select.onchange = () => { change(select.value); feedback = null; render(true); };
      label.append(select); form.append(label);
    }
    selectField('物资', 'person:trade-resource', tradeDraft.resource, quote.goods, value => { tradeDraft.resource = value; });
    selectField('买卖', 'person:trade-side', tradeDraft.side, [{ id: 'sell', label: '出售随身物资' }, { id: 'buy', label: '购入商人现货' }], value => { tradeDraft.side = value; });
    selectField('数量', 'person:trade-batches', tradeDraft.batches, Array.from({ length: 8 }, (_, i) => ({ id: i + 1, label: `${(i + 1) * 10} 份` })), value => { tradeDraft.batches = Number(value); });
    const name = quote.goods.find(item => item.id === tradeDraft.resource)?.label || '物资';
    fields(form, [['随身' + name, rounded(quote.carriedAmount) + ' 份'], ['随身灵石', rounded(quote.carriedJade)],
      ['商人现货', quote.merchantStock === null ? '待商议' : rounded(quote.merchantStock) + ' 份'], ['商人本金', quote.merchantCash === null ? '待商议' : rounded(quote.merchantCash)]]);
    form.append(node('p', `${tradeDraft.side === 'sell' ? '交出' : '取得'}${quote.quantity}份${name}，${tradeDraft.side === 'sell' ? '收到' : '支付'}${quote.price}灵石。`, 'person-note'));
    if (!quote.available) form.append(node('p', quote.reason, 'person-note attention'));
    const row = node('div', undefined, 'person-actions');
    const confirm = action(row, tradeDraft.side === 'sell' ? '确认出售' : '确认购买', 'person:trade-confirm', submitTrade, { primary: true, disabled: !quote.available });
    confirm.type = 'submit'; confirm.onclick = null;
    action(row, '返回交谈', 'person:trade-cancel', () => { tradeDraft = null; feedback = null; render(true); });
    form.append(row); form.onsubmit = event => { event.preventDefault(); submitTrade(); }; content.append(form);
  }
  function render(force = false) {
    const person = getView().people.find(item => item.id === personId);
    if (!person) return;
    const known = inspect().people.find(item => item.id === personId), admission = person.admission, membership = admission?.membership, lodging = person.lodging;
    const housing = getView().housing?.residents.find(resident => resident.personId === personId && resident.isResident);
    const market = personId === 'person:merchant-qingxi' && quoteTrade ? quoteTrade(tradeDraft || {}) : null;
    const development = getView().discipleDevelopment?.members?.find(member => member.personId === personId);
    const craftRequests = getView().discipleCraftRequests?.members?.find(member => member.personId === personId);
    const advancement = getView().discipleAdvancement?.members?.find(member => member.personId === personId);
    const nextSignature = JSON.stringify([personId, person.name, known, admission, housing, lodging, draft, tradeDraft, craftRecipeId, market, development, craftRequests, advancement, feedback]);
    if (!force && signature === nextSignature) return;
    signature = nextSignature;
    const active = content.contains(document.activeElement) ? document.activeElement.dataset.uiKey : null;
    const scroll = $('person-reading').scrollTop;
    $('person-name').textContent = person.name;
    $('person-role').textContent = membershipSummary(membership) || known?.role || '院中人物';
    $('person-eyebrow').textContent = personId === MASTER ? '掌门近况' : membership ? '门人近况' : '人物观察';
    $('person-speech').textContent = admission?.publicReason || (admission?.status === 'candidate' && admission.summary ? '已知来意：' + admission.summary : '当前观察：' + (known?.detail || '在山院稍作停留。'));
    $('person-detail').textContent = `${known?.location?.label || '院中'} · ${known?.activityLabel || '料理事务'}　精力 ${Math.round(person.energy)}　伤势 ${Math.round(person.wound)}`;
    $('focus-person').textContent = known?.indoor ? '定位所在建筑' : '看看位置';
    $('approach-person').textContent = personId === MASTER ? '安排修行' : lodging?.conversationPoint ? '走近客院交谈' : known?.indoor ? '走到所在建筑门前' : admission ? '走近交谈' : '走近查看';
    $('approach-person').hidden = personId !== MASTER && (market ? market.contact : admission?.distance?.near === true);
    drawPortrait($('portrait'), person);
    content.replaceChildren();
    if (feedback) { const message = node('p', feedback.message, `person-feedback ${feedback.ok ? '' : 'failure'}`); message.setAttribute('role', 'status'); content.append(message); }
    if (housing) fields(content, [['安置', housing.statusLabel], ['住处', housing.homeLabel || '尚未入住'], ...(housing.pendingLabel ? [['待入住', housing.pendingLabel]] : [])]);
    if (lodging?.phase) {
      const building = getView().buildings.find(item => `building:yunxiu:${item.id}` === lodging.buildingId);
      fields(content, [['客院住宿', lodging.phase === 'staying' ? '已入住' : '正在前往客床'], ['客床', `${building?.name || '客院'} · 第${lodging.slotId?.split(':').at(-1) || ''}床`]]);
      content.append(node('p', '按本次来访约定的期限退房。', 'person-note'));
    }
    if (market) renderTrade(market);
    else if (membership || development) {
      if (membership) fields(content, [['门籍', membership.rankLabel], ['归属', membership.affiliationLabel], ...(membership.mentorName ? [['师父', membership.mentorName]] : [])]);
      content.append(node('p', known?.detail || '依当前身体、意愿与院中事务自行安排。', 'person-note'));
      renderPersonDevelopment(content, { member: development, recommend, craftRequests, requestCraft, prepareCraft, cancelPreparation, advancement, navigateCraftPerson, selectedCraftRecipe: craftRecipeId, changeCraftRecipe: id => { craftRecipeId = id; feedback = null; render(true); } });
    } else if (admission?.status === 'candidate') {
      if (!admission.distance?.near) {
        content.append(node('p', admission.distance?.reason || '掌门尚未走到可交谈的位置。', 'person-distance'));
        if (Number.isFinite(admission.distance?.meters)) content.append(node('p', `相距约 ${rounded(admission.distance.meters)} 米`, 'person-note'));
      }
      const conditions = node('ul', undefined, 'person-conditions');
      for (const condition of admission.conditions || []) {
        const text = `${condition.met ? '已具备' : '待满足'} · ${condition.label}${!condition.met && condition.reason ? `：${condition.reason}` : ''}`;
        conditions.append(node('li', text, condition.met ? '' : 'attention'));
      }
      if (draft && canRequest(admission)) content.append(node('p', '选好门籍与归属，再当面询问本人意愿。', 'person-note'));
      else if (conditions.childNodes.length) content.append(conditions);
      if (admission.reason && !admission.canAdmit) content.append(node('p', admission.reason, 'person-note attention'));
      if (admission.distance?.near) {
        if (!draft) action(content, '商议入门', 'person:admission', () => {
          draft = { rank: admission.rankOptions[0].id, mentorId: admission.mentorOptions?.[0]?.id || null };
          feedback = null; render(true); content.querySelector('select')?.focus();
        }, { disabled: !canRequest(admission), primary: true });
        else {
          const form = node('form', undefined, 'person-admission');
          form.append(node('h2', `收录${person.name}`));
          const label = node('label', undefined, 'person-field'); label.append(node('span', '门籍'));
          const select = keyed(node('select'), 'person:rank');
          for (const rank of admission.rankOptions) { const option = node('option', rank.label); option.value = rank.id; select.append(option); }
          select.value = draft.rank; select.onchange = () => { draft.rank = select.value; render(true); }; label.append(select); form.append(label);
          fields(form, [['归属', admission.affiliation?.label || '当前本院']]);
          if (draft.rank === 'direct') {
            const mentorLabel = node('label', undefined, 'person-field'); mentorLabel.append(node('span', '师父'));
            const mentors = keyed(node('select'), 'person:mentor');
            for (const mentor of admission.mentorOptions || []) { const option = node('option', mentor.label); option.value = mentor.id; mentors.append(option); }
            mentors.value = draft.mentorId || ''; mentors.onchange = () => { draft.mentorId = mentors.value; }; mentorLabel.append(mentors); form.append(mentorLabel);
          }
          const rankLabel = admission.rankOptions.find(item => item.id === draft.rank)?.label || draft.rank;
          const mentorName = admission.mentorOptions?.find(item => item.id === draft.mentorId)?.label;
          form.append(node('p', `${person.name}同意后成为${rankLabel}，归属${admission.affiliation?.label || '本院'}${draft.rank === 'direct' && mentorName ? `，师从${mentorName}` : ''}，随后按本人意愿参与院中生活。`, 'person-note'));
          const row = node('div', undefined, 'person-actions');
          const confirm = action(row, `确认收录为${rankLabel}`, 'person:admission-confirm', submit, { disabled: !canRequest(admission) || draft.rank === 'direct' && !draft.mentorId, primary: true });
          confirm.type = 'submit'; confirm.onclick = null;
          action(row, '取消', 'person:admission-cancel', () => { draft = null; feedback = null; render(true); });
          form.append(row); form.onsubmit = event => { event.preventDefault(); submit(); }; content.append(form);
        }
        if (admission.canTalk !== undefined && !draft) {
          const row = node('div', undefined, 'person-actions');
          if (lodging && !lodging.phase) {
            action(row, '邀请客院暂住', 'person:guest-lodging', offerLodging, { disabled: !lodging.canOffer });
            if (!lodging.canOffer && lodging.reason) content.append(node('p', lodging.reason, 'person-note'));
          }
          action(row, admission.deferred ? '本次已请稍候' : '请稍候', 'person:seeker-defer', () => answerSeeker('defer'), { disabled: !admission.canTalk || admission.deferred });
          action(row, '婉拒来意', 'person:seeker-decline', () => answerSeeker('decline'), { disabled: !admission.canTalk });
          content.append(row);
        }
      }
    }
    if (active) [...content.querySelectorAll('[data-ui-key]')].find(element => element.dataset.uiKey === active)?.focus({ preventScroll: true });
    $('person-reading').scrollTop = scroll;
  }
  function open(id, { recipeId = null } = {}) { personId = id; draft = null; tradeDraft = null; craftRecipeId = recipeId; feedback = null; signature = ''; render(true); $('person-reading').scrollTop = 0; }
  return {
    open,
    render,
    close() { personId = null; draft = null; tradeDraft = null; craftRecipeId = null; feedback = null; signature = ''; },
  };
}
