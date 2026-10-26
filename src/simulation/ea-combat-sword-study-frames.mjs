/** Pure whole-frame selection shared by the formal body collision and Canvas. */
import { SWORD_STUDY_METADATA as DATA } from './ea-combat-sword-study-data.mjs';
export const STUDY_PROFILE = 'sword-study-v1';
export const STUDY_GROUND_Y_SCALE = (992 / 1585) * (.33 / .56) * (10.8 / 6.8);
export const STUDY_FRAMES = DATA.frames;
export const STUDY_METADATA = DATA;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const cardinal = d => Math.abs(d.x || 0) >= Math.abs(d.y || 0) ? (d.x < 0 ? 'left' : 'right') : (d.y < 0 ? 'up' : 'down');
const angle = d => ['right', 'se', 'down', 'sw', 'left', 'nw', 'up', 'ne'][(Math.round(Math.atan2(d.y || 0, d.x || 0) / (Math.PI / 4)) + 8) % 8];
const loop = (list, ms, durations = null) => {
  const times = durations || list.map(() => 480 / list.length), total = times.reduce((a, b) => a + b, 0);
  let at = ((ms % total) + total) % total;
  for (let i = 0; i < list.length; i++) { if (at < times[i]) return list[i]; at -= times[i]; }
  return list.at(-1);
};

export function sampleSwordStudyBody(actor, tick = 0) {
  const m = actor.motion || {}, phase = actor.hp <= 0 ? 'down' : m.phase || (m.moving ? 'move' : 'idle');
  const d = phase === 'hit' || phase === 'down' ? actor.facing || m.direction || { x: 1, y: 0 } : m.direction || actor.facing || { x: 1, y: 0 };
  const beast = actor.entityKind === 'beast' || actor.personId === 'person:valley-shanxiao';
  const accepted=m.moveIntent||{x:0,y:0},releasedMove=!beast&&['release','recovery'].includes(phase)&&['attack','spell','guard'].includes(m.action)&&!m.movementLocked&&Math.hypot(accepted.x,accepted.y)>0&&Number.isFinite(m.executeAtTick)&&Math.floor(tick)>m.executeAtTick;
  const start = m.phaseStartedTick ?? m.startedTick ?? tick, elapsed = Math.max(0, tick - start);
  const duration = Math.max(1, m.phaseDurationTicks || 1), progress = clamp(elapsed / duration, 0, 1);
  const animationMs = (actor.animationElapsedTicks ?? tick) * 100;
  let key, mirror = beast ? d.x > 0 : false;
  if (beast) {
    const b = DATA.beast;
    if (phase === 'down') key = b.down[Math.min(3, Math.floor(elapsed))];
    else if (phase === 'hit') key = b.hit[Math.min(1, Math.floor(progress * 2))];
    else if (phase === 'move' || m.moving && phase === 'idle') key = loop(b.move, tick * 100);
    else key = b[phase] || b.idle;
  } else {
    const p = DATA.player, side = cardinal(d), octant = angle(d);
    if (phase === 'down') {
      const downMs = Number.isFinite(actor.downedTick) ? Math.max(0, (tick - actor.downedTick) * 100) : Infinity;
      key = Array.isArray(p.down) ? p.down[downMs < p.downFrameBoundariesMs[0] ? 0 : downMs < p.downFrameBoundariesMs[1] ? 1 : 2] : p.down;
      mirror = d.x < 0;
    }
    else if (phase === 'hit') { key = p.hit[Math.min(3, Math.floor(progress * 4))]; mirror = d.x < 0; }
    else if (phase === 'evade' || m.action === 'dodge') {
      // Release/recovery are rule phases of the same two-tick displacement.
      // Their local clocks must not restart the four complete evade frames.
      const path = m.dodgePath, flight = path ? clamp((tick - path.startedTick) / Math.max(1, path.durationTicks), 0, 1) : phase === 'windup' ? 0 : phase === 'evade' ? 1 : progress;
      key = p.evade[Math.min(3, Math.floor(flight * 4))]; mirror = d.x < 0;
    }
    else if (m.action === 'ground-sword' && ['windup', 'release', 'recovery'].includes(phase)) {
      const clip = p.heavy[side] || p.heavy.right;
      key = clip[phase === 'windup' ? Math.min(1, Math.floor(progress * 2)) : phase === 'release' ? 2 : 3]; mirror = side === 'left';
    } else if (!releasedMove && ['attack', 'strike', 'spell'].includes(m.action) && ['windup', 'release', 'recovery'].includes(phase)) {
      const clip = p.attack[octant] || p.attack[side] || p.attack.right;
      key = clip[phase === 'windup' ? Math.min(clip.length - 1, Math.floor(progress * Math.min(2, clip.length))) : phase === 'release' ? Math.min(2, clip.length - 1) : clip.length - 1];
      mirror = ['left', 'nw', 'sw'].includes(octant);
    } else if (actor.stopPresentation && ['idle', 'move'].includes(phase) && p.stop) {
      const stop = actor.stopPresentation, fraction = clamp(stop.elapsedMs / Math.max(1, stop.durationMs), 0, 1);
      key = p.stop[Math.min(p.stop.length - (stop.settled ? 1 : 2), Math.floor(fraction * p.stop.length))]; mirror = stop.direction.x < 0;
    } else if (phase === 'move' || m.moving || releasedMove) {
      const move = m.moveIntent && Math.hypot(m.moveIntent.x || 0, m.moveIntent.y || 0) ? m.moveIntent : d, direction = cardinal(move), clip = p.move[direction] || p.move.right;
      key = loop(clip, animationMs, direction === 'left' || direction === 'right' ? p.runDurationMs : null); mirror = direction === 'left';
    } else if (phase === 'idle' && p.idleByDirection?.[side]) key = p.idleByDirection[side];
    else if (side === 'up' || side === 'down') key = p.move[side][1];
    else { key = p.idle; mirror = side === 'left'; }
  }
  const frame = DATA.frames[key];
  if (!frame) throw Error('Sword-study frame missing: ' + key);
  return { ...frame, mirror,visualPhase:!beast&&actor.stopPresentation&&DATA.player.stop?.includes(key)?'stop':releasedMove?'move':phase };
}
