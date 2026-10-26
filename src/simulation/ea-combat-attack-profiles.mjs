/** T-COMBAT-SWORD-20261025: the open valley's basic player shot and one
 * fixed-ground enemy warning. These are author tuning values for this sample.
 * Existing battle geometry keeps its established action profiles.
 */
export const BASIC_COMBAT_ATTACK=Object.freeze({name:'基础剑式',windup:1,execute:1,recovery:3,range:1.2,qi:0,cooldown:5,legacy:'attack'});
export const VALLEY_SWORD_QI_ATTACK=Object.freeze({...BASIC_COMBAT_ATTACK,name:'基础剑气',range:10,projectileKind:'sword-qi',projectileSpeed:16,projectileRadius:.45});
export const VALLEY_SHANXIAO_ATTACK=Object.freeze({realm:2,style:'震地岩刺',windupTicks:8,reach:10,recoveryTicks:24,radius:1.2,damage:10,counter:'岩刺落点在排招时固定；走开或短步避开红圈。'});
export const openValleyCombat=c=>c?.geometryId==='valley-open-v2'&&c.geometryVersion===2;
// T-COMBAT-SWORD-STUDY-20261026. Selected only when creating a single-player
// valley battle; an unmarked loaded battle keeps the established v2 rules.
export const SWORD_STUDY_PROFILE='sword-study-v1';
export const swordStudyCombat=c=>openValleyCombat(c)&&c.rulesProfile===SWORD_STUDY_PROFILE;
export const SWORD_STUDY_ATTACK=Object.freeze({...VALLEY_SWORD_QI_ATTACK,windup:1,execute:1,recovery:2,cooldown:2,range:8,projectileSpeed:12,projectileRadius:.05});
export const GROUND_SWORD_ACTION=Object.freeze({name:'落剑重击',windup:2,execute:1,recovery:0,range:8,qi:16,cooldown:18,legacy:'ground-sword',radius:1.1,delayTicks:1,damageMultiplier:1.8,role:'锁定实际地面落点，三步释放，下一步落击；须已学剑术'});
export function basicCombatAttackProfile(c,actor=c?.player){return openValleyCombat(c)&&!!c.player&&actor===c.player?(swordStudyCombat(c)?SWORD_STUDY_ATTACK:VALLEY_SWORD_QI_ATTACK):BASIC_COMBAT_ATTACK;}
export function learnedCombatSword(s){const p=s.personsById?.['person:master']||s.master;return ['swordbasic','sword'].find(id=>(p?.artsById?.[id]?.understanding??p?.knowledge?.[id]??0)>0)||null;}
/** Creation-time selection only: a loaded existing actor retains its own config. */
export function enemyCombatAttackProfile(c,personId,fallback){return fallback&&openValleyCombat(c)&&personId==='person:valley-shanxiao'?{...fallback,...VALLEY_SHANXIAO_ATTACK}:fallback;}
