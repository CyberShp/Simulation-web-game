/** Battle sides are projections of the existing participant lists. */
export const combatParticipants = c => [c.player,...c.allies,...c.enemies];
export const combatSide = (c,actor) => actor===c.player||c.allies.includes(actor)?'sect':c.enemies.includes(actor)?'hostile':null;
export const combatParticipant = (c,id) => combatParticipants(c).find(a=>(a.id??'master')===id||a.personId===id);
export const combatOpponents = (c,actor) => (combatSide(c,actor)==='sect'?c.enemies:[c.player,...c.allies]).filter(a=>a.hp>0);
export function chooseCombatTarget(c,actor,{preferredId=null,anchor=actor}={}) {
 const opponents=combatOpponents(c,actor),preferred=preferredId&&opponents.find(a=>(a.id??'master')===preferredId||a.personId===preferredId);
 if(preferred)return preferred;
 return opponents.slice().sort((a,b)=>Math.hypot(a.x-anchor.x,a.y-anchor.y)-Math.hypot(b.x-anchor.x,b.y-anchor.y)||String(a.id??'master').localeCompare(String(b.id??'master')))[0]||null;
}
export function selectedCombatEnemy(c) {
 return c.selectedTargetId?c.enemies.find(a=>a.id===c.selectedTargetId&&a.hp>0)||null:null;
}
