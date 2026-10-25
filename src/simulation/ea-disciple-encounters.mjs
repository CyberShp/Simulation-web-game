/** T-DISCIPLE-ENCOUNTER: local scouting and conservative retreat on the shared world clock. */
import { valleyEncounterDefinition } from './ea-campaign.mjs';
import { recordPermanentDeathSR } from './ea-sr-crises.mjs';
import { equipmentCombatBenefits } from './ea-sr-equipment.mjs';
export const DISCIPLE_SCOUT_POINT = Object.freeze({ x: 27, y: 30.5 });
// T-ENCOUNTER-DISTANCE-20261025: preserve the original 3m expedition contact
// threshold; campaign interactionRadius only permits choosing to enter combat.
export const DISCIPLE_ENCOUNTER_RULES = Object.freeze({ perception: 6, contactDistance: 3, contactTicks: 10, contactWound: 10 });

export function encounterStep(s, p, j) {
  const definition = valleyEncounterDefinition(), foe = s.personsById?.[definition.personId];
  const here = p?.location, there = foe?.location;
  if (!here || here.kind !== 'local' || here.sceneId !== definition.sceneId ||
      !there || there.kind !== 'local' || there.sceneId !== here.sceneId ||
      p.lifeStatus === 'dead' || foe.lifeStatus === 'dead') return null;
  const distance = Math.hypot(here.x - there.x, here.y - there.y);
  if (distance > DISCIPLE_ENCOUNTER_RULES.perception) return null;
  const observation = j.encounter ||= { personId: definition.personId, observedTick: s.worldTick, injury: 0 };
  observation.lastObservedTick = s.worldTick;
  observation.lastPosition = { sceneId: there.sceneId, x: there.x, y: there.y };
  const weak = (p.realm || 1) <= (foe.realm || definition.realm);
  observation.risk = weak || p.wound >= 20 || p.energy < 30 ? 'high' : 'avoidable';
  observation.reason = observation.risk === 'high'
    ? '亲眼发现山魈，衡量修为与身体后决定折返。'
    : '亲眼发现山魈，决定避开争斗，沿安全路线折返。';
  if (distance <= DISCIPLE_ENCOUNTER_RULES.contactDistance &&
      (observation.lastContactTick === undefined || s.worldTick - observation.lastContactTick >= DISCIPLE_ENCOUNTER_RULES.contactTicks)) {
    const guard = equipmentCombatBenefits(s, p.personId).guard;
    const injury = Math.min(100 - (p.wound || 0), DISCIPLE_ENCOUNTER_RULES.contactWound * (1 - guard));
    p.wound = Math.min(100, (p.wound || 0) + injury);
    p.energy = Math.max(0, (p.energy || 0) - 4);
    p.bodyState = 'impaired';
    observation.injury += injury;
    observation.lastContactTick = s.worldTick;
    if (p.wound >= 100) recordPermanentDeathSR(s, p.personId, { cause: '历练近身遭山魈重创', sceneId: here.sceneId });
    observation.reason = '进入山魈近身范围受伤，正在撤离，伤势需回院调养。';
  }
  return { retreat: true };
}
