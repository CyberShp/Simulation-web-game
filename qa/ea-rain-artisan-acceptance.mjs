/** Public commands and real simulation time; does not access formal player slots. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {runOpening} from './ea-opening-v12-acceptance.mjs';
import * as sim from '../dist/ea-opening-sim.mjs';
export function runArtisan({outcome='treated',seed=618033}={}){
 let {state,report:opening}=runOpening({seed});let commands=0;const checkpoints=[];
 function act(name,...args){state=sim.dispatchCommand(state,{name,args}).state;commands++;}
 function save(label){const text=JSON.stringify(state);state=sim.validateSave(JSON.parse(text));assert.equal(JSON.stringify(state),text);checkpoints.push({label,worldTick:state.worldTick,phase:state.story.artisan.phase});}
 function until(check,limit=200){for(let i=0;i<limit&&!check();i++)sim.tick(state,1);assert.ok(check(),'artisan '+outcome+' makes progress within '+limit+' simulated seconds');}
 until(()=>state.story.artisan.phase==='present');save('arrived');const members=state.homeMemberIds.slice(),personId=state.story.artisan.personId;
 if(outcome==='declined'){act('declineArtisanCare');save('departing');until(()=>state.story.artisan.phase==='departed');save('departed');sim.tick(state,120);assert.equal(state.story.artisan.phase,'departed');}
 else{
  const herbs=state.resources.herb;act('offerArtisanCare');save('accepted-with-reserved-medicine');
  if(outcome==='cancel-resume'){act('cancelArtisanCare');assert.equal(state.resources.herb,herbs);save('cancelled-with-full-unused-refund');act('offerArtisanCare');}
  until(()=>sim.treatmentStatus(state)?.progressTicks>=50);save('actual-treatment');
  act('setSpeed',0);const paused=JSON.stringify(state);sim.tick(state,360);assert.equal(JSON.stringify(state),paused);act('setSpeed',1);
  until(()=>state.story.artisan.phase==='recovering');save('stable-in-recovery');assert.notEqual(state.activitiesById[state.master.activityId]?.action,'care');
  until(()=>state.story.artisan.phase==='recovered');save('recovered');assert.equal(state.personsById[personId].wound,0);assert.equal(state.personsById[personId].mind.memories.filter(m=>m.key==='rain-artisan:care').length,1);
 }
 assert.deepEqual(state.homeMemberIds,members);sim.validateSave(JSON.parse(JSON.stringify(state)));
 return {state,report:{outcome,seed,personId,commands,openingCommands:opening.commands,gameSeconds:state.time,worldTick:state.worldTick,checkpoints,finalPhase:state.story.artisan.phase,memberIds:state.homeMemberIds,cooperationFact:!!state.factsById['fact:rain-artisan:cooperation']}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out=new URL('./acceptance-indoor-v12/',import.meta.url);await mkdir(out,{recursive:true});const scenarios=['treated','cancel-resume','declined'].map(outcome=>runArtisan({outcome}));
 for(const scene of scenarios)await writeFile(new URL(`artisan-${scene.report.outcome}.json`,out),JSON.stringify(scene.state,null,2));
 const report={generatedAt:new Date().toISOString(),gameVersion:sim.GAME_VERSION,schemaVersion:sim.SCHEMA_VERSION,scope:'Actual arrival, care, recovery and refusal only; not full equipment/arts chain or lethal rescue',scenarios:scenarios.map(x=>x.report)};
 await writeFile(new URL('artisan-command-report.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
