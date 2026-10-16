/** Desktop opening presentation. World changes use the shared simulation commands. */
import { openingView } from './sect-sim.mjs';
import { INTRO_FRAMES, BUNDLE_FRAMES, BUNDLE_FRAME_MS, restoreOpeningPresentation, advanceBundleFrame } from './courtyard-opening-presentation.mjs';

const ART = 'assets/';
const RESOURCES = { jade: '灵石', wood: '木材', stone: '石料', herb: '灵草' };
const ELEMENT_CLASS = { qinglan: 'wind', chiyang: 'fire', hanquan: 'water', houttu: 'earth', jinfeng: 'metal' };
const READING_STAGES = new Set(['intro', 'shelter', 'inheritance', 'hall-ready']);
const number = value => Number.isFinite(value) ? String(Math.round(value * 10) / 10) : '—';
const node = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
function button(label, key, run, disabled = false, kind = 'primary') {
  const el = node('button', label, `opening-button opening-button-${kind}`);
  el.type = 'button'; el.dataset.openingAction = key; el.disabled = disabled;
  el.addEventListener('click', run); return el;
}
function paragraph(parent, text, className = 'opening-copy') {
  if (text) parent.append(node('p', text, className));
}
function costLine(cost) {
  return Object.entries(cost || {}).filter(([, amount]) => amount > 0)
    .map(([id, amount]) => `${RESOURCES[id] || id} ${number(amount)}`).join('　·　');
}

export function createCourtyardOpening({ getSession, getView, command, save,
  onReadingChange = () => {}, onComplete = () => {} }) {
  const root = node('div', undefined, 'courtyard-opening');
  root.id = 'courtyard-opening'; root.hidden = true;
  const backdrop = node('div', undefined, 'opening-backdrop'); backdrop.setAttribute('aria-hidden', 'true');
  const surface = node('div', undefined, 'opening-surface');
  const feedback = node('p', undefined, 'opening-feedback');
  feedback.hidden = true; feedback.setAttribute('role', 'alert');
  root.append(backdrop, surface, feedback); document.body.append(root);
  let reading = false, busy = false, disposed = false, lastSignature = '', previousStage = null;
  let selected = null, error = '', completionVisible = false, completedSession = null, lastSession = null, hallDeferred = false;
  let focusBeforeReading = null;
  let presentation = null, bundleTimer = null, bundleSaving = false, bundleBlocked = false, bundleGeneration = 0;
  let artwork = null;

  function showArt(filename) {
    if (artwork === filename) return;
    artwork = filename; backdrop.replaceChildren();
    if (!filename) return;
    const image = node('img', undefined, 'opening-art-frame');
    image.src = new URL(ART + filename, import.meta.url).href; image.alt = ''; image.draggable = false;
    backdrop.append(image);
  }
  function stopBundle() {
    if (bundleTimer !== null) clearTimeout(bundleTimer);
    bundleTimer = null; bundleGeneration++;
  }
  async function persistPresentation() {
    if (!save) return true;
    try {
      const saved = await save(false, 'manual');
      if (saved?.ok === false) { error = saved.error || '进度暂未保存，请先处理保存提示。'; return false; }
      return true;
    } catch (cause) { error = cause?.message || '进度暂未保存。'; return false; }
  }
  function scheduleBundle() {
    if (disposed || bundleTimer !== null || bundleSaving || bundleBlocked || previousStage !== 'inheritance' || presentation?.bundle.phase !== 'playing') return;
    const generation = bundleGeneration;
    bundleTimer = setTimeout(async () => {
      bundleTimer = null;
      if (disposed || generation !== bundleGeneration || openingView(getSession()).stage !== 'inheritance') return;
      bundleSaving = true;
      presentation.bundle = advanceBundleFrame(presentation.bundle);
      render();
      const saved = await persistPresentation();
      if (disposed || generation !== bundleGeneration) return;
      bundleSaving = false; bundleBlocked = !saved;
      render(); scheduleBundle();
    }, BUNDLE_FRAME_MS);
  }
  async function openBundle(replay = false) {
    if (busy || bundleSaving || disposed || openingView(getSession()).stage !== 'inheritance') return;
    if (!replay && presentation.bundle.phase === 'open') return;
    stopBundle(); const generation = bundleGeneration;
    if (replay || presentation.bundle.phase === 'closed') presentation.bundle = { phase: 'playing', frame: 0 };
    error = ''; bundleBlocked = false; bundleSaving = true; render();
    const saved = await persistPresentation();
    if (disposed || generation !== bundleGeneration) return;
    bundleSaving = false; bundleBlocked = !saved;
    render(); scheduleBundle();
  }

  function syncReading(next) {
    if (next === reading) return;
    reading = next;
    document.body.classList.toggle('opening-reading', reading);
    if (reading) focusBeforeReading = document.activeElement;
    onReadingChange(reading);
    if (!reading && focusBeforeReading?.isConnected) focusBeforeReading.focus({ preventScroll: true });
  }
  async function submit(request, nextIntroFrame = null) {
    if (busy || disposed) return;
    const previousFrame = presentation.introFrame;
    if (nextIntroFrame !== null) presentation.introFrame = nextIntroFrame;
    busy = true; error = '';
    try {
      const result = request ? command(request) : { ok: true };
      if (!result?.ok) {
        presentation.introFrame = previousFrame;
        error = result?.error || '此刻尚无法继续，请稍后再试。';
      } else {
        render();
        await persistPresentation();
      }
    } catch (cause) { presentation.introFrame = previousFrame; error = cause?.message || '此次操作未完成。'; }
    finally { busy = false; render(); }
  }
  function heading(parent, chapter, title) {
    paragraph(parent, chapter, 'opening-chapter');
    const h = node('h1', title, 'opening-title'); h.id = 'opening-title'; parent.append(h);
  }
  function renderIntro(view) {
    const frame = presentation.introFrame, content = INTRO_FRAMES[frame];
    root.dataset.page = String(content.page); root.dataset.frame = String(frame);
    showArt(content.image);
    const sheet = node('div', undefined, 'opening-story');
    const caption = node('div', undefined, 'opening-caption');
    heading(caption, content.chapter, content.title);
    for (const line of content.lines) paragraph(caption, line);
    const actions = node('div', undefined, 'opening-actions');
    const progress = node('span', `${String(frame + 1).padStart(2, '0')} / 06`, 'opening-page');
    actions.append(progress);
    const turnTo = next => submit(INTRO_FRAMES[next].page === view.introPage ? null : { type: 'opening-intro', page: INTRO_FRAMES[next].page }, next);
    if (frame > 0) actions.append(button('前一幕', 'intro-back', () => turnTo(frame - 1), busy, 'quiet'));
    actions.append(button(frame === INTRO_FRAMES.length - 1 ? '在此落脚' : '继续', 'intro-next', () => frame === INTRO_FRAMES.length - 1
      ? submit({ type: 'opening-intro', complete: true }) : turnTo(frame + 1), busy));
    sheet.append(caption, actions); surface.append(sheet);
  }
  function renderShelter(view) {
    const sheet = node('div', undefined, 'opening-scene-sheet');
    heading(sheet, '初至云岫', '先安此身');
    paragraph(sheet, '石阶尽头，是母亲记忆里的旧院。');
    paragraph(sheet, '你放下包裹，用余下的灵草调理旧伤。');
    const status = node('div', undefined, 'opening-condition');
    const realm = getView?.()?.operations?.master?.realmLabel;
    status.append(node('span', `${view.masterName || '沈砚'}${realm ? `　·　${realm}` : ''}`), node('span', `旧伤 ${number(view.wound)}`));
    sheet.append(status);
    paragraph(sheet, `本次用药：${costLine(view.healCost)}`, 'opening-cost');
    if (!view.canHeal) paragraph(sheet, view.healReason, 'opening-reason');
    sheet.append(button('灵草疗伤', 'heal', () => submit({ type: 'heal' }), busy || !view.canHeal));
    surface.append(sheet);
  }
  function renderInheritance(view) {
    const bundle = presentation.bundle, content = BUNDLE_FRAMES[bundle.frame];
    root.dataset.bundlePhase = bundle.phase; root.dataset.bundleFrame = String(bundle.frame);
    showArt(content.image);
    if (bundle.phase !== 'open') {
      const sheet = node('div', undefined, 'opening-story opening-bundle-story');
      const caption = node('div', undefined, 'opening-caption');
      heading(caption, '母亲留下的旧布包', content.title);
      paragraph(caption, content.line);
      const actions = node('div', undefined, 'opening-actions');
      if (bundle.phase === 'closed' || bundleBlocked) actions.append(button(bundleBlocked ? '继续展开' : '打开包裹', 'bundle-open', () => openBundle(), busy || bundleSaving));
      else {
        const progress = node('span', `${String(bundle.frame + 1).padStart(2, '0')} / 04`, 'opening-page');
        progress.setAttribute('role', 'status'); progress.setAttribute('aria-label', `包裹展开，第 ${bundle.frame + 1} 幕`);
        actions.append(progress);
      }
      sheet.append(caption, actions); surface.append(sheet); return;
    }
    const options = view.inheritance?.options || [];
    if (!options.some(option => option.id === selected)) selected = view.inheritance?.selected || options[0]?.id;
    const chosen = options.find(option => option.id === selected);
    const sheet = node('div', undefined, 'opening-inheritance-sheet');
    heading(sheet, '母亲留下的旧布包', '一卷薪火');
    paragraph(sheet, '旧布已展，定下这一卷传承。', 'opening-inheritance-intro');
    const choices = node('div', undefined, 'opening-lineages');
    choices.setAttribute('role', 'tablist'); choices.setAttribute('aria-label', '入门传承');
    for (const option of options) {
      const choice = button('', `lineage:${option.id}`, () => { selected = option.id; error = ''; render(); }, busy || bundleSaving, 'lineage');
      choice.setAttribute('role', 'tab'); choice.setAttribute('aria-selected', String(option.id === selected));
      choice.setAttribute('aria-controls', 'opening-lineage-detail');
      choice.id = `opening-lineage-${option.id}`; choice.dataset.element = ELEMENT_CLASS[option.id] || 'wind';
      choice.append(node('span', option.element, 'opening-element'), node('strong', option.name)); choices.append(choice);
    }
    sheet.append(choices);
    if (chosen) {
      const detail = node('div', undefined, 'opening-lineage-detail'); detail.id = 'opening-lineage-detail';
      detail.setAttribute('role', 'tabpanel'); detail.setAttribute('aria-labelledby', `opening-lineage-${chosen.id}`);
      paragraph(detail, chosen.flavor, 'opening-flavor');
      const arts = node('dl', undefined, 'opening-arts');
      for (const [label, name] of [['心法', chosen.heartName], ['攻', chosen.attackName], ['守', chosen.guardName]]) {
        const row = node('div'); row.append(node('dt', label), node('dd', name)); arts.append(row);
      }
      detail.append(arts);
      paragraph(detail, `${chosen.supply}　·　${chosen.temper}`, 'opening-temper');
      sheet.append(detail);
      sheet.append(button(`承此传承 · ${chosen.name}`, 'choose-inheritance', () => submit({ type: 'choose-inheritance', lineage: chosen.id }), busy || bundleSaving));
    }
    paragraph(sheet, '择定后继续疗伤。此为修行起点，日后仍可兼修。', 'opening-footnote');
    sheet.append(button('重看展开', 'bundle-replay', () => openBundle(true), busy || bundleSaving, 'quiet'));
    surface.append(sheet);
  }
  function renderHallReady(view) {
    const sheet = node('div', undefined, 'opening-scene-sheet opening-hall-sheet');
    heading(sheet, '第一座营造', '立起主殿');
    paragraph(sheet, '伤势已稳，旧院也该重新有个根基。');
    paragraph(sheet, '确认后，掌门将走到营造处，动工修建主殿。');
    paragraph(sheet, costLine(view.hallCost), 'opening-cost');
    if (!view.canEstablishHall) paragraph(sheet, view.hallReason, 'opening-reason');
    const actions = node('div', undefined, 'opening-actions');
    actions.append(button('确认营造主殿', 'establish-hall', () => submit({ type: 'establish-hall' }), busy || !view.canEstablishHall),
      button('稍后营造', 'defer-hall', deferHall, busy, 'quiet'));
    sheet.append(actions);
    surface.append(sheet);
  }
  function renderGuide(view) {
    const guide = node('div', undefined, 'opening-guide');
    if (view.stage === 'recovering') {
      heading(guide, '安身', '调息疗伤');
      paragraph(guide, view.healing ? '药力正缓缓化开，待旧伤平复，再着手营造。' : '身上仍有旧伤，安顿伤势后再着手营造。');
      paragraph(guide, `旧伤 ${number(view.wound)}　·　${getView?.()?.paused ? '已暂停' : view.healing ? '调息中' : '待疗伤'}`, 'opening-guide-state');
      if (!view.healing) {
        if (!view.canHeal) paragraph(guide, view.healReason, 'opening-reason');
        guide.append(button(`继续疗伤 · ${costLine(view.healCost)}`, 'resume-heal', () => submit({ type: 'heal' }), busy || !view.canHeal, 'quiet'));
      }
    } else if (view.stage === 'hall-ready') {
      heading(guide, '立山', '营造主殿');
      paragraph(guide, view.canEstablishHall ? '伤势已稳，木石已备。可查看营造安排。' : view.hallReason);
      guide.append(button('查看营造', 'review-hall', () => { hallDeferred = false; error = ''; render(true); }, false, 'quiet'));
    } else if (view.stage === 'hall-building') {
      heading(guide, '立山', '主殿营造中');
      paragraph(guide, view.construction?.reason || '掌门正前往营造处，按实际工时完成修建。');
      const duration = view.construction?.durationTicks || 0, progress = view.construction?.progressTicks || 0;
      const ratio = duration > 0 ? Math.max(0, Math.min(1, progress / duration)) : 0;
      const track = node('div', undefined, 'opening-progress');
      track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', '主殿营造进度');
      track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100'); track.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      const fill = node('span'); fill.style.width = `${ratio * 100}%`; track.append(fill); guide.append(track);
      paragraph(guide, `${Math.round(ratio * 100)}%　·　${getView?.()?.paused ? '已暂停' : '工事进行中'}`, 'opening-guide-state');
    } else {
      heading(guide, '云岫山院', '山中有了归处');
      paragraph(guide, '主殿已成。余烬尚存，从这里重新立山。');
      guide.append(button('继续山院', 'complete', () => { completionVisible = false; render(true); }, false, 'quiet'));
    }
    surface.append(guide);
  }
  function render(force = false) {
    if (disposed) return;
    const session = getSession(), view = openingView(session);
    if (lastSession !== session) {
      stopBundle(); bundleSaving = false; bundleBlocked = false; error = ''; lastSignature = '';
      presentation = restoreOpeningPresentation(session.courtyardPresentation?.opening, view);
      previousStage = null; selected = null; completionVisible = false; completedSession = null; hallDeferred = false; lastSession = session;
    }
    if (view.stage !== 'inheritance' && (bundleTimer !== null || bundleSaving)) { stopBundle(); bundleSaving = false; }
    if (view.enabled && view.stage === 'complete' && previousStage === 'hall-building' && completedSession !== session) {
      completionVisible = true; completedSession = session; onComplete(view);
    }
    previousStage = view.stage;
    const visible = !!view.enabled && (view.active || completionVisible);
    const nextReading = visible && READING_STAGES.has(view.stage) && !(view.stage === 'hall-ready' && hallDeferred);
    syncReading(nextReading);
    root.hidden = !visible;
    if (!visible) { lastSignature = ''; showArt(null); return; }
    const signature = JSON.stringify([view.stage, view.introPage, view.canHeal, view.healReason, view.canEstablishHall,
      view.hallReason, Math.ceil(view.wound || 0), view.construction, view.healing, selected, error, busy, completionVisible, hallDeferred,
      presentation.introFrame, presentation.bundle, bundleSaving, bundleBlocked, getView?.()?.paused]);
    if (!force && signature === lastSignature) { scheduleBundle(); return; }
    lastSignature = signature;
    const focusKey = root.contains(document.activeElement) ? document.activeElement.dataset.openingAction : null;
    surface.replaceChildren(); root.dataset.stage = view.stage; root.dataset.reading = String(nextReading);
    root.setAttribute('role', nextReading ? 'dialog' : 'region'); root.setAttribute('aria-labelledby', 'opening-title');
    if (nextReading) root.setAttribute('aria-modal', 'true'); else root.removeAttribute('aria-modal');
    delete root.dataset.page; delete root.dataset.frame; delete root.dataset.bundlePhase; delete root.dataset.bundleFrame;
    if (!['intro', 'inheritance'].includes(view.stage)) showArt(null);
    if (view.stage === 'intro') renderIntro(view);
    else if (view.stage === 'shelter') renderShelter(view);
    else if (view.stage === 'inheritance') renderInheritance(view);
    else if (view.stage === 'hall-ready' && !hallDeferred) renderHallReady(view);
    else renderGuide(view);
    feedback.textContent = error; feedback.hidden = !error;
    const focus = focusKey && [...surface.querySelectorAll('button')].find(el => el.dataset.openingAction === focusKey && !el.disabled);
    if (focus) focus.focus({ preventScroll: true });
    else if (nextReading && !root.contains(document.activeElement)) (surface.querySelector('.opening-button-primary:not(:disabled)') || surface.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
    scheduleBundle();
  }
  function deferHall() { if (busy) return; hallDeferred = true; error = ''; render(true); }
  function onKeydown(event) {
    if (!reading || disposed) return;
    if (event.key === 'Tab') {
      const items = [...root.querySelectorAll('button:not(:disabled)')];
      const index = items.indexOf(document.activeElement);
      if (items.length && (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === items.length - 1)) {
        event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus();
      }
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (previousStage === 'hall-ready') deferHall(); }
    if (event.code === 'Space' && !event.target.closest('button')) event.preventDefault();
  }
  root.addEventListener('keydown', onKeydown);
  return {
    render, isReading: () => reading, back() { const consumed = reading; if (reading && previousStage === 'hall-ready') deferHall(); return consumed; },
    snapshotPresentation() {
      const state = presentation || restoreOpeningPresentation(getSession().courtyardPresentation?.opening, openingView(getSession()));
      return { version: state.version, introFrame: state.introFrame, bundle: { ...state.bundle } };
    },
    destroy() { disposed = true; stopBundle(); syncReading(false); root.removeEventListener('keydown', onKeydown); root.remove(); }
  };
}
