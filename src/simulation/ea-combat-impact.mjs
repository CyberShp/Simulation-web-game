/** T-COMBAT-IMPACT-20261023: first-combat reaction timing, in 100 ms world steps. */
export const COMBAT_IMPACT_TUNING = Object.freeze({lightTicks:2,heavyTicks:3,protectionTicks:12,reactionTicks:4,interruptedRecoveryTicks:6});
export const combatActorId = actor => actor?.id ?? 'master';
// Legacy campaign saves own their time in seconds; this is a unit projection.
export const combatWorldTick = s => Number.isSafeInteger(s.worldTick)?s.worldTick:Math.round((s.time||0)*10);
export function combatDirection(from,to,fallback={x:1,y:0}) {
 const length=Math.hypot(to.x-from.x,to.y-from.y);
 return length>1e-8?{x:(to.x-from.x)/length,y:(to.y-from.y)/length}:{...fallback};
}
export const combatStaggered = (actor,tick) => actor.hp>0 && (actor.staggerUntilTick||0)>tick;
export function clearCombatReaction(actor){
 delete actor.hitReaction;delete actor.staggerUntilTick;delete actor.staggerImmuneUntilTick;
}
export function receiveCombatImpact(s,c,target,{eventId,direction,contact,outcome,kind,amount}){
 const tick=combatWorldTick(s),down=target.hp<=0,heavy=kind==='spell'||kind==='strike';
 const protectedNow=(target.staggerImmuneUntilTick||0)>tick;
 const staggerTicks=amount>0&&outcome==='hit'&&!down&&!protectedNow?(heavy?COMBAT_IMPACT_TUNING.heavyTicks:COMBAT_IMPACT_TUNING.lightTicks):0;
 const reaction=down?'down':outcome==='guarded'?'guard':outcome==='evaded'?'evade':heavy?'heavy':'light';
 let interrupted=false;
 if(down){clearCombatReaction(target);target.downedTick??=tick;target.target=null;target.targetId=null;delete target.pendingAttack;if(Object.hasOwn(target,'telegraph')){target.telegraph=null;target.windup=0;}delete target.motionAction;}
 else if(staggerTicks){
  target.staggerUntilTick=tick+staggerTicks;
  target.staggerImmuneUntilTick=target.staggerUntilTick+COMBAT_IMPACT_TUNING.protectionTicks;
  if(heavy&&target.telegraph){target.telegraph=null;target.windup=0;target.cooldown=Math.max(target.cooldown,COMBAT_IMPACT_TUNING.interruptedRecoveryTicks/10);delete target.motionAction;interrupted=true;}
  if(heavy&&target.pendingAttack){delete target.pendingAttack;target.cooldown=Math.max(target.cooldown,COMBAT_IMPACT_TUNING.interruptedRecoveryTicks/10);delete target.motionAction;interrupted=true;}
 }
 // Protected hits still report damage, but cannot restart or extend the existing flinch.
 if(down||!protectedNow||outcome!=='hit')target.hitReaction={eventId,tick,untilTick:tick+COMBAT_IMPACT_TUNING.reactionTicks,staggerUntilTick:target.staggerUntilTick||tick,kind:reaction,direction:{...direction},contact:{...contact},interrupted};
 return {reaction,staggerTicks,staggerUntilTick:target.staggerUntilTick||tick,interrupted};
}
