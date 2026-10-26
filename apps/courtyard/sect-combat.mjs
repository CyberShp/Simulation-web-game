/** Desktop expedition adapter. Commands and projections share the official world. */
import {viewSRWorld} from '../../src/simulation/ea-sr-world.mjs';
import {getCampaignScene} from '../../src/simulation/ea-campaign.mjs';
import {viewSRCombat,clearCombatInput,setSRCombatInput} from '../../src/simulation/ea-sr-combat.mjs';
export {clearCombatInput};
export function commitCombatInput(state,move,options={}){return setSRCombatInput(state,move,options);}

export function expeditionAway(state) {
  const location = state.master.location;
  return location?.kind !== 'local' || location.sceneId !== 'scene:yunxiu-courtyard' || state.combat != null;
}

export function expeditionCommand(request) {
  if(request.type==='combat-input')return {command:{name:'setSRCombatInput',args:[structuredClone(request.move),{reset:request.reset??false}]},reason:'掌门按输入方向行走。'};
  if(request.type==='combat-auto')return {command:{name:'setSRAutoAttack',args:[request.enabled]},reason:request.enabled?'已开启射程内自动普攻。':'已关闭自动普攻。'};
  if(request.type==='combat-target')return {command:{name:'setSRCombatTarget',args:[request.targetId??null]},reason:request.targetId?'已选定当前敌人。':'已解除当前目标。'};
  if(request.type==='combat-tactic')return {command:{name:'setCombatTactic',args:[request.tactic]},reason:'已调整同行战术，门人继续自主应战。'};
  if (request.type === 'world') {
    const payload = request.action;
    if (payload?.action === 'interact') {
      if (payload.choice !== 'gather' || typeof payload.objectId !== 'string') throw Error('请选择当地可采集的物资。');
      return {command: {name: 'srWorldCommand', args: [structuredClone(payload)]}, reason: '掌门在当地采集，所得放入随行物资。'};
    }
    if (!payload || typeof payload !== 'object' || !['exit', 'move', 'engage', 'return', 'travel'].includes(payload.action)) throw Error('请选择山道、林间地面或当前敌人。');
    return {command: {name: 'srWorldCommand', args: [structuredClone(payload)]}, reason: payload.action === 'engage' ? '掌门亲自应战。' : payload.action === 'exit' ? '掌门沿实际山道行走，抵达出口后可出发。' : payload.action === 'return' ? '掌门按已走行程返回。' : payload.action === 'travel' ? '掌门沿已知道路出行。' : '掌门走向林间指定位置。'};
  }
  if (request.type === 'combat') {
    if (!['move', 'attack', 'ground-sword', 'spell', 'guard', 'dodge', 'retreat'].includes(request.actionId)) throw Error('请选择当前可用的战斗动作。');
    return {command: {name: 'combatAction', args: [request.actionId, structuredClone(request.target ?? null)]}, reason: request.actionId === 'retreat' ? '掌门开始沿退路撤离。' : '掌门按实际起手、执行与收势应对敌人。'};
  }
  if (request.type === 'combat-acknowledge') return {command: {name: 'acknowledgeCombat', args: []}, reason: '战果已收存，可以继续沿山道行动。'};
  return null;
}

export function viewExpedition(state) {
  return structuredClone({away: expeditionAway(state), world: viewSRWorld(state), scene: getCampaignScene(state), combat: viewSRCombat(state)});
}
