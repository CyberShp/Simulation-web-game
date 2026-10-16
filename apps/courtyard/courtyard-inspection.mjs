/** P1 / OPEN-02,03,06: read-only local people and real facility inspection.
 * No identities are discovered here: viewSect supplies the public local roster.
 * Room membership uses actual feet; a reserved station is not an arrival.
 */
import { viewSect } from './sect-sim.mjs';
import { personLifeSummary } from '../../src/simulation/ea-life.mjs';
import { facilitySlotView } from '../../src/simulation/ea-facility-slots.mjs';
import { spatialRoom, spatialAccess, spatialFootprint, polygonContains } from '../../src/simulation/ea-sr-spatial.mjs';

const copy = value => structuredClone(value);
const MASTER = 'person:master';
const phases = { moving: '前往', navigating: '前往', waiting: '等候', blocked: '受阻', paused: '暂缓', executing: '进行中', working: '进行中', active: '进行中', free: '空闲',
  'to-source': '取货途中', carrying: '送货途中', 'waiting-for-goods': '候货', preparing: '准备' };
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : null;
const shortPerson = person => ({ id: person.id, name: person.name, label: person.activityLabel });

export function inspectCourtyard(session, view = viewSect(session)) {
  const state = session.state;
  const buildings = view.buildings.map(building => {
    const official = state.buildings.find(item => String(item.id) === building.id);
    return { visible: building, official, room: official ? spatialRoom(official) : null,
      footprint: official ? spatialFootprint(official) : [], entrance: official ? point(spatialAccess(official)) : null };
  });
  const people = view.people.map(person => {
    const official = state.personsById[person.id];
    const life = personLifeSummary(state, official);
    const feet = point(person);
    const here = buildings.find(building => building.room && feet && polygonContains(feet, building.room.floor)) ||
      buildings.find(building => !building.room && feet && building.footprint.length && polygonContains(feet, building.footprint));
    const indoor = !!here?.room;
    const location = {
      kind: indoor ? 'indoor' : here ? 'onsite' : 'outdoor',
      label: here ? `${here.visible.name}${indoor ? '内' : '作业区'}` : '山院露天',
      buildingId: here?.visible.id || null, buildingName: here?.visible.name || null,
      // Indoor inspection locates the entrance without displaying an interior body.
      x: indoor ? here.entrance?.x ?? null : feet?.x ?? null,
      y: indoor ? here.entrance?.y ?? null : feet?.y ?? null,
      focus: indoor ? point(here.entrance) : feet,
    };
    const privateActivity = life.reason === '独处参悟，暂不愿详谈。';
    const body = person.activityDetail;
    // These official body activities temporarily retain the old life intent.
    // A transport must never be presented as the cultivation it interrupted.
    const bodyLabel = !privateActivity && ({ 'sr-transport': '搬运', construction: '营造',
      'sr-replenish': '整备来源', 'sr-harvest': '采集', 'sr-equipment': '炼制' })[body?.kind];
    const transport = body?.kind === 'sr-transport' && view.transports.find(order =>
      order.id === state.activitiesById[official.activityId]?.workOrderId);
    const status = bodyLabel ? transport?.phase || body.phase : life.status;
    const phase = !body && life.status === 'active' && ['cultivate', 'work', 'study', 'teach', 'heal'].includes(life.activity)
      ? '准备' : phases[status] || (status ? '进行中' : '');
    const activityLabel = `${phase ? `${phase} · ` : ''}${bodyLabel || (person.activity === 'groundRest' ? '歇脚' : life.label) || '停留'}`;
    const reason = bodyLabel ? body.reason || `${bodyLabel}事务按实际进度继续。` : life.reason;
    return { id: person.id, name: person.name,
      role: person.id === MASTER ? '云岫掌门' : person.resident ? '院中同伴' : '山院来客',
      appearance: person.appearance, resident: person.resident, indoor,
      activity: privateActivity ? 'study' : person.activity, activityLabel,
      detail: reason || '在山院稍作停留。', energy: person.energy, wound: person.wound,
      location, slotId: life.slotId || null, slotName: life.slotName || null,
      activityDetail: { kind: bodyLabel ? body.kind : life.activity, phase: status, reason,
        progress: !bodyLabel && life.progress ? copy(life.progress) : null },
    };
  });
  const byId = new Map(people.map(person => [person.id, person]));
  const inspectedBuildings = buildings.map(({ visible, official, entrance }) => {
    const slots = official ? facilitySlotView(state, official).map(slot => {
      const person = byId.get(slot.personId);
      const body = view.people.find(item => item.id === slot.personId);
      const arrived = body && Math.hypot(body.x - slot.position.x, body.y - slot.position.y) < .35 &&
        ['executing', 'working'].includes(slot.phase);
      const status = slot.personId ? arrived ? 'occupied' : 'reserved' : 'free';
      return { id: slot.id, name: slot.label, kind: slot.kind, status,
        personId: person?.id || null, personName: person?.name || null,
        label: `${slot.label} · ${status === 'occupied' ? '使用中' : status === 'reserved' ? '已预约' : '空闲'}${person ? ` · ${person.name}` : ''}`,
        phase: slot.personId ? person?.activityDetail.phase || 'reserved' : 'free' };
    }) : [];
    const occupants = people.filter(person => person.location.buildingId === visible.id).map(shortPerson);
    const occupantIds = new Set(occupants.map(person => person.id));
    const incoming = official ? people.filter(person => {
      if (occupantIds.has(person.id)) return false;
      const actor = state.personsById[person.id], activity = state.activitiesById[actor.activityId];
      return activity?.targetId === official.instanceId || slots.some(slot => slot.personId === person.id);
    }).map(shortPerson) : [];
    const occupied = slots.filter(slot => slot.status === 'occupied').length;
    const reserved = slots.filter(slot => slot.status === 'reserved').length;
    const free = slots.filter(slot => slot.status === 'free').length;
    const availability = !official || official.spatialLock ? '施工期间暂不可用' : visible.enabled === false ? '已停用' : visible.condition <= 0 ? '需要修缮' : '可用';
    const detail = `${availability}；${visible.indoor ? '屋内' : '作业区'} ${occupants.length} 人，前往或候位 ${incoming.length} 人；实际床位／工位 ${slots.length} 处，使用 ${occupied}、预约 ${reserved}、空闲 ${free}。`;
    return { id: visible.id, name: visible.name, type: visible.type, stage: visible.stage,
      detail, occupants, incoming, slots, slotCounts: { total: slots.length, occupied, reserved, free },
      location: { kind: 'building', buildingId: visible.id, buildingName: visible.name, label: `${visible.name}入口`,
        x: entrance?.x ?? null, y: entrance?.y ?? null, focus: entrance },
    };
  });
  return { tick: view.tick, sceneId: view.sceneId, people, buildings: inspectedBuildings };
}
