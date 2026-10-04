import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Player, summary } from './ea-player.mjs';

export function normalRun({ reference = false } = {}) {
  const player = new Player();
  player.foundation().prepareRevenge().finishRevenge().establishTwoPeaks();
  if (reference) player.referenceWorld();
  return player;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reference = process.argv.includes('--reference');
  const player = normalRun({ reference });
  const report = player.report();
  await writeFile(new URL('./ea-normal-play-report.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  if (reference) await writeFile(new URL('./ea-reference-world.json', import.meta.url), JSON.stringify(player.state, null, 2) + '\n');
  console.log(JSON.stringify({ final: summary(player.state), operations: report.operationCount, validationCount: report.validationCount, performance: report.performance }, null, 2));
}
