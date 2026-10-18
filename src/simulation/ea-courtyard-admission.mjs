import {courtyardSeekerView,acceptCourtyardSeeker,SEEKER_SOURCE} from './ea-courtyard-seekers.mjs';
/** U-111/U-125: one confirmed admission of the existing opening visitor. */
import { capacity } from './ea-data.mjs';
import { campaignSummary } from './ea-campaign.mjs';
import { rememberPerson } from './ea-society.mjs';
import { courtyardVisitorReady } from './ea-courtyard-visitors.mjs';
import { sceneUnits, SPATIAL_SCENE } from './ea-sr-spatial.mjs';
import {residentialHousingApplicable,residentialProjectionState,residentialAdmissionView,residentialHousingView} from './ea-residential-housing.mjs';

export const COURTYARD_ADMISSION_VERSION = 'courtyard-admissions-1';
export const COURTYARD_ADMISSION_RANKS = Object.freeze([
  Object.freeze({ id: 'outer', label: '外门' }),
  Object.freeze({ id: 'inner', label: '内门' }),
  Object.freeze({ id: 'direct', label: '亲传' }),
]);
const MASTER = 'person:master', CANDIDATE = 'person:lin-changfeng';
const CONSENT_SOURCE = 'opening:changfeng-join';
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
const rankLabel = rank => COURTYARD_ADMISSION_RANKS.find(option => option.id === rank)?.label || '';
const affiliationLabel = s => `${s.sect?.name || s.society?.name || '云岫山院'}·本院`;
const admissionId = personId => `fact:courtyard-admission:${personId}`;

/** Missing records mean that the earlier save did not record a formal rank. */
export function initCourtyardAdmissions(s) {
  if (s.courtyardAdmissions === undefined) s.courtyardAdmissions = { version: COURTYARD_ADMISSION_VERSION, recordsByPersonId: {} };
  return s;
}

function membershipView(s, personId) {
  const record = s.courtyardAdmissions?.recordsByPersonId?.[personId];
  return record ? { ...structuredClone(record), rankLabel: rankLabel(record.rank),
    affiliationLabel: affiliationLabel(s), mentorName: record.mentorId ? s.personsById[record.mentorId]?.name || '' : null } : null;
}

function locallyPresent(s, person) {
  if (!person || person.lifeStatus === 'dead' || person.left || person.mind?.away || person.mind?.journey || person.journey) return false;
  if (person.position?.kind && person.position.kind !== 'scene') return false;
  if (person.position?.sceneId && person.position.sceneId !== SPATIAL_SCENE.id) return false;
  if (person.location && (person.location.kind !== 'local' || person.location.sceneId !== SPATIAL_SCENE.id)) return false;
  return true;
}

/** Read-only projection; callers use the same distance and requirements as commit. */
export function courtyardAdmissionView(s, personId, {preparedHousingState=null}={}) {
  const person = s.personsById?.[personId], master = s.personsById?.[MASTER];
  const member = s.homeMemberIds?.includes(personId) || false;
  const membership = membershipView(s, personId);
  const affiliation = s.scenesById?.[SPATIAL_SCENE.id] ? { id: SPATIAL_SCENE.id, label: affiliationLabel(s) } : null;
  const seeker=courtyardSeekerView(s,personId);
  if(seeker)return {...seeker,membership,status:membership?'admitted':seeker.status,summary:seeker.publicReason,
    rankOptions:COURTYARD_ADMISSION_RANKS.map(option=>({...option})),affiliation,
    mentorOptions:master&&master.lifeStatus!=='dead'?[{id:master.personId,label:master.name}]:[],
    capacity:{used:s.homeMemberIds.length,limit:Math.min(15,s.homeMemberIds.length+seeker.housing.freeBeds)}};
  const masterPoint = master?.scenic, visitorPoint = person?.mind?.scenic;
  const sameScene = locallyPresent(s, master) && locallyPresent(s, person) && !s.world?.exploration && s.combat?.status !== 'active';
  const units = masterPoint && visitorPoint ? Math.hypot(masterPoint.x - visitorPoint.x, masterPoint.y - visitorPoint.y) : null;
  const threshold = sceneUnits(s, 48), near = sameScene && Number.isFinite(units) && units <= threshold;
  const metresPerUnit = 1 / sceneUnits(s, 32);
  const distance = { near, meters: sameScene && Number.isFinite(units) ? units * metresPerUnit : null,
    limit: threshold * metresPerUnit, reason: near ? '' : sameScene ? `先走到${person?.name || '来客'}身边，再商议入院。` : '须与来客一同在山院内，才能当面商议。' };
  const candidate = personId === CANDIDATE && s.story?.opening?.secondVisitorId === personId;
  const housingState=candidate&&s.story.step===2&&!member&&!membership&&residentialHousingApplicable(s)
    ?preparedHousingState||residentialProjectionState(s):null;
  const housing=housingState?residentialAdmissionView(housingState,personId):null;
  const body = s.activitiesById?.[master?.activityId];
  const conditions = [
    { id: 'candidate', label: '来客已表明求道意向', met: !!candidate, reason: '此人当前没有可确认的入院约定。' },
    { id: 'story', label: '正在商议入院', met: candidate && s.story.step === 2 && !member, reason: member ? '此人已在山院名册中。' : '尚未到商议这位来客入院的阶段。' },
    { id: 'arrival', label: '来客已到院前', met: !!person && locallyPresent(s, person) && courtyardVisitorReady(person), reason: '林长风尚在山路上，等他抵达院前再商议。' },
    { id: 'distance', label: '掌门已走近交谈', met: near, reason: distance.reason },
    { id: 'hall', label: '主殿已经建成', met: s.story?.opening?.hallPhase === 'complete', reason: '先营造主殿，再商议入院。' },
    { id: 'available', label: '掌门可当面主持收录', met: !!master && master.lifeStatus !== 'dead' && (!body || body.kind === 'facility'), reason: '掌门已有身体活动，先完成或中止。' },
  ];
  if (candidate && s.story.step === 2) {
    for (const [index, requirement] of campaignSummary(s).requirements.entries()) conditions.push({
      id: ['farm', 'lumber', 'capacity'][index] || `story:${index}`, label: requirement.label, met: requirement.met,
      reason: requirement.label === '有可用居所' ? `居所暂不可用。${housing?.reason||'先营造或升级门人居。'}` : `${requirement.label}后，再商议入院。`,
    });
  }
  conditions.push({ id: 'roster-limit', label: '在籍门人未满十五人', met: (s.homeMemberIds?.length || 0) < 15, reason: '在籍门人已满十五人。' });
  if(housing)conditions.push({id:'housing',label:'有可承诺的实体床位',met:housing.available,reason:housing.reason||''});
  conditions.push({ id: 'affiliation', label: '归属当前本院', met: !!affiliation, reason: '当前本院记录不可用。' });
  const blocked = conditions.find(condition => !condition.met);
  const status = membership ? 'admitted' : member ? 'member' : candidate ? 'candidate' : 'unavailable';
  return { personId, name: person?.name || '', status, canAdmit: status === 'candidate' && !blocked,
    reason: membership ? '已正式收录。' : member ? '已在山院共同生活。' : blocked?.reason || '',
    summary: near ? person?.mind?.reason || '' : '', conditions: conditions.map(condition => ({ ...condition, reason: condition.met ? '' : condition.reason })), distance,
    rankOptions: COURTYARD_ADMISSION_RANKS.map(option => ({ ...option })), affiliation,
    mentorOptions: master && master.lifeStatus !== 'dead' ? [{ id: master.personId, label: master.name }] : [],
    membership, housing, capacity: { used: s.homeMemberIds?.length || 0, limit: housingState?Math.min(15,(s.homeMemberIds?.length||0)+residentialHousingView(housingState).counts.freeForAdmission):Math.min(15, capacity(s)) } };
}

/** Invoked only inside the official command transaction, after explicit selection. */
export function commitCourtyardAdmission(s, selection, acceptVisitor) {
  if (!isRecord(selection)) throw Error('请选择本次收录的门籍与归属。');
  const { personId, rank, affiliationId, mentorId = null } = selection;
  if (!rankLabel(rank)) throw Error('门籍须选择外门、内门或亲传。');
  const view = courtyardAdmissionView(s, personId);
  if (affiliationId !== view.affiliation?.id) throw Error('归属须为当前本院。');
  if (rank === 'direct' ? mentorId !== MASTER : mentorId !== null) throw Error(rank === 'direct' ? '亲传须明确拜当前掌门为师。' : '外门与内门收录不指定亲传师父。');
  if (view.membership || s.homeMemberIds.includes(personId)) throw Error('此人已在山院名册中，请查看现有记录。');
  if (!(view.canRequestAdmission??view.canAdmit)) throw Error(view.reason);
  if (s.personsById[personId].mind.mentorId !== null && rank === 'direct' && s.personsById[personId].mind.mentorId !== 'master') throw Error('此人已有师承，需要先按原约定处理。');
  const seeker=!!s.courtyardSeekers?.recordsByPersonId[personId];
  const result=seeker?acceptCourtyardSeeker(s,personId):acceptVisitor();
  if(result?.accepted===false)return result;
  const consentSource=seeker?SEEKER_SOURCE:CONSENT_SOURCE;
  initCourtyardAdmissions(s);
  const record = { personId, rank, affiliationId, mentorId, admittedById: MASTER,
    admittedAtTick: s.worldTick, consentSource, factId: admissionId(personId) };
  s.courtyardAdmissions.recordsByPersonId[personId] = record;
  s.factsById[record.factId] = { id: record.factId, kind: 'courtyard-admission', atTick: s.worldTick,
    personId, actorId: MASTER, rank, affiliationId, mentorId, consentSource };
  const person = s.personsById[personId];
  if (rank === 'direct') person.mind.mentorId = 'master';
  rememberPerson(s, person, `我已录入${affiliationLabel(s)}，门籍为${rankLabel(rank)}${rank === 'direct' ? `，拜${s.master.name}为师` : ''}。`,
    { important: true, key: `courtyard-admission:${personId}` });
  return { accepted: true, personId, membership: membershipView(s, personId) };
}

export function validateCourtyardAdmissions(s) {
  const ledger = s.courtyardAdmissions;
  const fail = message => { throw Error(`存档校验失败：门籍${message}，原存档保留。`); };
  if (ledger === undefined) {
    if (Object.values(s.factsById).some(fact => fact.kind === 'courtyard-admission')) fail('收录凭据缺少对应记录');
    return true;
  }
  if (!isRecord(ledger) || ledger.version !== COURTYARD_ADMISSION_VERSION || !isRecord(ledger.recordsByPersonId)) fail('版本或记录容器异常');
  for (const [personId, record] of Object.entries(ledger.recordsByPersonId)) {
    const person = s.personsById[personId], fact = s.factsById[record?.factId];
    const seeker=!!s.courtyardSeekers?.recordsByPersonId[personId];
    if (!isRecord(record) || (seeker?record.consentSource!==SEEKER_SOURCE:personId !== CANDIDATE) || !person || record.personId !== personId || !rankLabel(record.rank)
      || record.affiliationId !== SPATIAL_SCENE.id || !s.scenesById?.[record.affiliationId]
      || record.admittedById !== MASTER || record.consentSource !== (seeker?SEEKER_SOURCE:CONSENT_SOURCE)
      || (record.rank === 'direct' ? record.mentorId !== MASTER : record.mentorId !== null)
      || record.mentorId !== null && !s.personsById[record.mentorId]
      || !Number.isSafeInteger(record.admittedAtTick) || record.admittedAtTick < 0 || record.admittedAtTick > s.worldTick
      || record.factId !== admissionId(personId)) fail('身份、归属或收录时刻异常');
    if (!s.homeMemberIds.includes(personId) && person.lifeStatus !== 'dead' && !person.left && !s.society.departed.some(entry => entry.id === person.id)) fail('人物名册引用异常');
    if (!seeker&&(!s.story?.claimed.includes('story:2') || s.story.step < 3)) fail('缺少已完成的入院约定');
    if (!fact || fact.kind !== 'courtyard-admission' || fact.personId !== personId || fact.actorId !== MASTER
      || fact.atTick !== record.admittedAtTick || fact.rank !== record.rank || fact.affiliationId !== record.affiliationId
      || fact.mentorId !== record.mentorId || fact.consentSource !== record.consentSource) fail('收录凭据异常');
  }
  for (const fact of Object.values(s.factsById)) if (fact.kind === 'courtyard-admission'
    && ledger.recordsByPersonId[fact.personId]?.factId !== fact.id) fail('收录凭据缺少对应记录');
  return true;
}
