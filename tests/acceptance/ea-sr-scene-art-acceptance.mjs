/** Public local-object approach routes; explicit scene fixtures, not natural discovery or device evidence. */
import assert from 'node:assert/strict';
import * as S from '../../src/simulation/ea-opening-sim.mjs';
import {worldObjectApproach,worldObjectFootprint} from '../../apps/web/ea-world-scene-art.mjs';

let count=0;
for(const sceneId of ['scene:valley','scene:market','scene:quarry','scene:ruins','scene:prison','scene:supply','scene:qixia']){
 let s=S.initial({sr:true});s.master.wound=0;s.master.energy=90;
 s.master.location={kind:'local',sceneId,x:32,y:46};s.master.position={kind:'scene',sceneId,x:32,y:46};
 for(const o of S.WORLD_SCENES[sceneId].objects){
  const b=worldObjectFootprint(o),approachPoint=worldObjectApproach(o);
  assert(approachPoint.y>b.bottom,'approach stays outside the blocked object base');
  s=S.dispatchCommand(s,{name:'srWorldCommand',args:[{action:'move',...approachPoint}]}).state;
  for(let n=0;n<1500&&s.srWorld.interaction;n++)S.tick(s,.1);
  assert.equal(s.srWorld.interaction,null,`${o.id} actual path reaches safe approach point`);
  assert(Math.hypot(s.master.location.x-approachPoint.x,s.master.location.y-approachPoint.y)<.1);
  count++;
 }
 S.validateSave(JSON.parse(JSON.stringify(s)));
 console.log(`PASS ${sceneId}: public object approach paths and save validation`);
}
console.log(JSON.stringify({suite:'sr-local-object-approach',scenes:7,objects:count,failed:0,scope:'collision and public-command fixtures'}));
