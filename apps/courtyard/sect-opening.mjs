/** Desktop guidance reads the opening records owned by the shared simulation. */
import { openingInheritanceView } from '../../src/simulation/ea-opening-inheritance.mjs';
import { HALL_ESTABLISH_COST } from '../../src/simulation/ea-sr-spatial.mjs';

export const OPENING_SOURCE_KIND = 'official-initial-opening';
export const isOpeningSession = session => session.provenance?.kind === OPENING_SOURCE_KIND;
export function openingStage(session) {
  if (!isOpeningSession(session)) return 'complete';
  const s = session.state, opening = s.story.opening;
  if (!s.story.intro) return 'intro';
  if (opening.inheritance.status === 'pending') return 'inheritance';
  if (opening.hallPhase === 'complete') return 'complete';
  if (opening.hallPhase === 'building') return 'hall-building';
  if (opening.inheritance.status === 'sealed') return 'shelter';
  return s.master.wound > 0 ? 'recovering' : 'hall-ready';
}

const copy = {
  intro: ['雨夜余烬', '双亲以性命护你逃生。数月流亡之后，你带着母亲留下的包裹，抵达云岫山中。'],
  shelter: ['云岫落脚', '先用随身留下的灵草温养经脉，在临时落脚处安顿下来。'],
  inheritance: ['母亲的遗卷', '药力入脉，你解开旧布包。封缄中的这一卷传承，将陪你走上往后的路。'],
  recovering: ['调息养伤', '遗卷已经启封，药力随调息缓缓化开。待伤势恢复，再营造主殿。'],
  'hall-ready': ['立山之始', '伤势已愈，殿址就在眼前。备好的木石可以用来营造主殿。'],
  'hall-building': ['主殿营造', '材料按实际路线运往殿址，掌门到场施工后，主殿才会落成。'],
  complete: ['主殿落成', '云岫山院已有了主殿，可以继续安排院务。']
};

export function openingView(session) {
  const s = session.state, enabled = isOpeningSession(session), stage = openingStage(session);
  const [title, description] = copy[stage], hall = Object.values(s.buildingsById).find(b => b.type === 'hall');
  const activity = s.activitiesById[s.master.activityId];
  const order = activity?.kind === 'construction' ? s.workOrdersById[activity.workOrderId] : null;
  const resources = s.stockpilesById['stockpile:yunxiu'].resources;
  const local = s.master.location?.kind === 'local' && s.master.location.sceneId === 'scene:yunxiu-courtyard';
  const busy = activity && activity.kind !== 'facility';
  const healing = s.master.action === 'heal';
  const healReason = !enabled ? '当前开局已完成。' : stage === 'intro' ? '先读完序章，在山中落脚。' :
    stage === 'inheritance' ? '先确定遗卷传承。' : healing ? '掌门正在调息养伤。' : s.master.wound <= 0 ? '伤势已经痊愈。' :
      !local ? '先返回山院。' : busy ? '先完成当前身体事务。' : resources.herb < 6 ? '公库需要六份灵草。' : '';
  const hallReason = stage !== 'hall-ready' ? stage === 'hall-building' ? '主殿正在营造。' : stage === 'complete' ? '主殿已经落成。' : '先完成疗伤与择卷。' :
    !local ? '先返回山院。' : busy ? '先完成当前身体事务。' : s.master.energy < 15 ? '先恢复到十五点精力。' :
      Object.entries(HALL_ESTABLISH_COST).some(([key, cost]) => resources[key] < cost) ? '备足营造主殿的材料后再动工。' : '';
  const inheritance = openingInheritanceView(s);
  return {
    enabled, active: enabled && stage !== 'complete', stage, introPage: s.story.onboarding?.introPage ?? 0,
    title, description, reading: enabled && ['intro', 'inheritance'].includes(stage),
    readingRequired: enabled && ['intro', 'shelter', 'inheritance'].includes(stage),
    canHeal: !healReason, healReason, canEstablishHall: !hallReason, hallReason,
    healCost: { herb: 6 }, hallCost: { ...HALL_ESTABLISH_COST },
    wound: s.master.wound, energy: s.master.energy, healing, masterName: s.master.name,
    hallPhase: s.story.opening?.hallPhase || 'complete',
    inheritance: inheritance ? { ...inheritance, options: inheritance.options.map(({ source, ...option }) => option) } : null,
    construction: order ? { activityId: activity.id, workOrderId: order.id, progressTicks: order.progressTicks,
      durationTicks: order.durationTicks, phase: activity.phase, materialPhase: order.materialFlow?.phase || null,
      reason: order.waitingReason || activity.reason || '按实际营造工单施工。' } : null,
    masterPosition: { x: s.master.scenic.x, y: s.master.scenic.y },
    hallPosition: hall ? { x: hall.transform.x, y: hall.transform.y } : null
  };
}
