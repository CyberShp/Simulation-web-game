/** Local resources use the same proximity and timed interaction as the world. */
import {sceneObjectNearSR} from '../../src/simulation/ea-sr-world.mjs';

export function expeditionResourceOptions(world) {
  if (!world?.scene || world.travel || world.scene.id === 'scene:yunxiu-courtyard') return [];
  const player = world.scene.player;
  return (world.scene.objects || []).filter(object => object.choices?.some(choice => choice.action === 'gather')).map(object => {
    const near = sceneObjectNearSR(player, object), busy = !!world.activity;
    const exhausted = object.resourceRemaining < 6;
    return {id: object.id, name: object.name, remaining: object.resourceRemaining, near,
      canApproach: !busy && !near && !exhausted, canGather: !busy && near && !exhausted,
      reason: busy ? world.activity.kind === 'walk' ? '掌门正在行走，抵达后可采集。' : '掌门正在处理当前事务，完成后可继续采寻。' : exhausted ? '此处余量不足，需另寻来源。' : near ? '已走近，可以采集。' : '先走到物资附近。',
      approach: {action: 'move', x: object.x, y: object.y + object.height / 2 + Math.min(1, object.interactionRadius)},
      gather: {action: 'interact', objectId: object.id, choice: 'gather'}};
  });
}

export function createExpeditionResources(parent, {getWorld, command}) {
  const section = document.createElement('div'); section.id = 'expedition-resources';
  section.setAttribute('aria-label', '当地采寻'); parent.append(section);
  const rows = new Map();
  function render() {
    const options = expeditionResourceOptions(getWorld()), ids = new Set(options.map(option => option.id));
    section.hidden = !options.length;
    for (const [id, row] of rows) if (!ids.has(id)) { row.element.remove(); rows.delete(id); }
    for (const option of options) {
      let row = rows.get(option.id);
      if (!row) {
        const element = document.createElement('div'), name = document.createElement('strong'), note = document.createElement('small');
        const approach = document.createElement('button'), gather = document.createElement('button');
        approach.type = gather.type = 'button';
        approach.dataset.uiKey = `expedition-resource-approach:${option.id}`;
        gather.dataset.uiKey = `expedition-resource-gather:${option.id}`;
        const act = key => { const current = expeditionResourceOptions(getWorld()).find(item => item.id === option.id); if (current?.[key === 'gather' ? 'canGather' : 'canApproach']) command(current[key]); };
        approach.onclick = () => act('approach'); gather.onclick = () => act('gather');
        element.append(name, approach, gather, note); section.append(element);
        row = {element, name, note, approach, gather}; rows.set(option.id, row);
      }
      row.name.textContent = `${option.name} · 余量 ${option.remaining}`;
      row.approach.textContent = `走近${option.name}`; row.approach.disabled = !option.canApproach;
      row.gather.textContent = `采集${option.name}`; row.gather.disabled = !option.canGather;
      row.note.textContent = option.reason;
    }
  }
  return {render};
}
