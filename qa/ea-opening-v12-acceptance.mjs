/** Normal public commands only. No resource/identity/progression injection. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as sim from '../dist/ea-opening-sim.mjs';
import {recommendedPlot,onboardingView} from '../dist/ea-onboarding.mjs';
import {buildingAccess} from '../dist/ea-scenic.mjs';

export function runOpening({seed=618033,invitation='invite'}={}){
 let state=sim.initial({seed}),commands=0,checks=0;
 const events=[];
 function act(name,...args){const result=sim.dispatchCommand(state,{name,args});state=result.state;commands++;return result.result;}
 function check(label){const saved=JSON.stringify(state);state=sim.validateSave(JSON.parse(saved));assert.equal(JSON.stringify(state),saved);checks++;events.push({label,worldTick:state.worldTick,gameSeconds:state.time});}
 function until(predicate,limit=600){const deadline=state.time+limit;while(!predicate()){assert.ok(state.time<deadline,'No progress within '+limit+' seconds: '+JSON.stringify(state.disciples.map(p=>({name:p.name,job:p.job,energy:p.energy,activity:p.mind.activity,reason:p.mind.reason,scenic:p.mind.scenic,body:state.activitiesById[p.activityId]}))));sim.tick(state,1);}}
 function walkTo(type){const b=state.buildings.find(b=>b.type===type),target=buildingAccess(state,b);act('moveScenicMaster',target.x,target.y);until(()=>state.master.action!=='walk');}
 function resources(cost){
  for(const [key,amount]of Object.entries(cost)){
   while(state.resources[key]<amount){
    if(state.master.energy<30){act('masterAction','rest');until(()=>state.master.energy>=70);}
    if(['wood','stone','herb','food'].includes(key)){act('masterAction',key);until(()=>state.resources[key]>=amount||state.master.energy<10);}
    else if(key==='jade'){if(state.resources.wood<10){act('masterAction','wood');until(()=>state.resources.wood>=10);}act('trade','wood','sell',sim.day(state),1);}
    else{throw Error('No basic recovery route for '+key);}
   }
  }
  act('masterAction','rest');
 }
 function build(type){resources(sim.BUILDINGS[type].cost);const p=recommendedPlot(state,type,sim.placementLock)||sim.CELLS.find(c=>!sim.placementLock(state,type,c.x,c.y));assert.ok(p);act('build',type,p.x,p.y);until(()=>!sim.constructionStatus(state));}

 act('masterAction','heal');until(()=>state.master.wound===0);walkTo('hall');act('advanceStory');
 act('advanceStory','gift');check('gifted-without-membership');act('advanceStory',invitation);
 assert.equal(state.disciples.length,invitation==='invite'?1:0);
 build('farm');build('lumber');walkTo('hall');act('advanceStory');check('voluntary-people-and-production-facilities');
 build('library');walkTo('library');act('advanceStory');
 act('masterStudy','spring');until(()=>!state.master.learning);assert.ok(state.master.knowledge.spring>=20);check('first-study-complete');
 // Build a distinct food chain, so waiting for an autonomous harvest is viable.
 build('granary');
 act('setPolicy','workFocus','herb');
 until(()=>onboardingView(state).feedback||state.story.onboarding.productions.length>0,1200);
 assert.ok(state.story.onboarding.productions.some(p=>['farm','lumber'].includes(p.type)));check('autonomous-harvest');
 act('masterAction','rest');until(()=>state.master.energy>=80);
 act('startExploration','valley',[]);until(()=>state.world.exploration.status==='exploring');
 const active=sim.explorationOptions(state).active;act('moveExploration',active.landmark.x,active.landmark.y);until(()=>sim.explorationOptions(state).active.canInteract);
 assert.equal(state.world.exploration.regionId,'valley');check('first-exploration-arrived');
 const choice=sim.explorationOptions(state).active.choices.find(c=>!c.disabled);assert.ok(choice);act('resolveExploration',choice.id);
 act('leaveRegion');check('first-exploration-returned');
 assert.ok(state.time<=1800,'Opening completes within 30 simulated minutes');
 return {state,report:{seed,invitation,commands,checks,gameSeconds:state.time,worldTick:state.worldTick,people:state.disciples.map(p=>({id:p.personId,name:p.name})),buildings:state.buildings.map(b=>b.type),productions:state.story.onboarding.productions,masterKnowledge:{...state.master.knowledge},events}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const output=new URL('./acceptance-indoor-v12/',import.meta.url);await mkdir(output,{recursive:true});
 const scenarios=[{seed:618033,invitation:'invite'},{seed:1907,invitation:'decline'}].map(runOpening);
 for(let i=0;i<scenarios.length;i++)await writeFile(new URL(`opening-${scenarios[i].report.invitation}.json`,output),JSON.stringify(scenarios[i].state,null,2));
 const report={generatedAt:new Date().toISOString(),gameVersion:sim.GAME_VERSION,schemaVersion:6,scope:'Opening slice through first trip; not full v1.2 revenge acceptance',scenarios:scenarios.map(s=>s.report),browser:{status:'blocked',reason:'Cloud browser could not connect to the local HTTP service (ERR_CONNECTION_REFUSED); no browser or real-device pass claimed.'}};
 await writeFile(new URL('command-report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
