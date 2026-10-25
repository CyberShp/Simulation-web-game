/** Read predicates shared by native Electron and JSON-serialized simulation checks. */
export const masterOf=r=>r.session.state.personsById['person:master'];
export const atExit=(r,id)=>r.view.expedition.world.exits.some(e=>e.id===id&&e.near)&&!masterOf(r).scenic.path.length&&!r.session.state.srWorld.interaction;
export const arrivedIn=(r,id)=>masterOf(r).position.sceneId===id&&!r.session.state.srWorld.activeTravelId;
export const walkSettled=r=>!r.session.state.srWorld.interaction&&!masterOf(r).scenic.path.length;
export const pendingDone=r=>!r.session.state.srCombat.pending&&!r.session.state.srCombat.buffered;
export const actionReady=(r,id)=>pendingDone(r)&&!!r.view.expedition.combat?.actions.some(a=>a.id===id&&!a.disabled&&!a.bufferable);
export const guardActive=r=>r.session.state.combat.player.guard>0;
export const injuredReady=r=>masterOf(r).wound>0&&pendingDone(r)&&!(r.session.state.combat.player.staggerUntilTick>r.session.state.worldTick);
export const retreatComplete=r=>r.session.state.combat.status==='retreated';

export const manualActionReady=(r,id)=>pendingDone(r)&&!!r.view.expedition.combat?.manualActions?.some(a=>a.id===id&&!a.disabled&&!a.bufferable);
export const movementCleared=r=>{const m=r.view.expedition.combat.controls.move;return m.x===0&&m.y===0;};
export const combatPoint=r=>{const {x,y}=r.session.state.combat.player;return {x,y};};
export const firstEnemy=r=>r.session.state.combat.enemies[0];
export const distanceBetween=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const projectilePresent=r=>(r.session.state.combat.projectiles?.length||0)>0;
export const attackSettled=r=>pendingDone(r)&&!projectilePresent(r);
export const automaticAttackProven=(r,executionStart)=>{
 const added=r.session.state.srCombat.executions.slice(executionStart),pending=r.session.state.srCombat.pending;
 const automatic=a=>a?.action==='attack'&&a.automatic===true;
 return added.every(automatic)&&(!pending||automatic(pending))&&(added.some(automatic)||automatic(pending));
};
