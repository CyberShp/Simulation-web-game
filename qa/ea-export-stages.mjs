import { writeFile } from 'node:fs/promises';
import { Player } from './ea-player.mjs';

const battle = new Player().foundation().prepareRevenge();
battle.validate();
await writeFile(new URL('./ea-battle-ready-world.json', import.meta.url), JSON.stringify(battle.state, null, 2) + '\n');
battle.action('resolveExploration', 'challenge');
battle.validate();
await writeFile(new URL('./ea-battle-world.json', import.meta.url), JSON.stringify(battle.state, null, 2) + '\n');

const journey = new Player().chapterOne();
journey.rest();
journey.action('startExploration', 'market', { companionIds: [] });
journey.tick(3);
journey.validate();
await writeFile(new URL('./ea-travel-world.json', import.meta.url), JSON.stringify(journey.state, null, 2) + '\n');
journey.until(s => s.world.exploration.status === 'exploring', { limit: 100, chunk: 1 });
journey.action('moveExploration', 8, 4);
journey.until(s => !s.world.exploration.target, { limit: 30, chunk: 1 });
journey.validate();
await writeFile(new URL('./ea-pending-world.json', import.meta.url), JSON.stringify(journey.state, null, 2) + '\n');
console.log('Exported four normal-operation stage worlds: battle-ready, active battle, traveling, pending market choice.');
