/** Isolated Node profiling of an explicitly supplied QA session.
 * --source=/absolute/qa-native.json --output=/absolute/new-directory
 * --ticks=100 --runs=3 --profile-run=0 [--runtime-root=/absolute/runtime]
 * Advance, view and clone timings are CPU measurements, not desktop FPS.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {Session} from 'node:inspector';

const args=process.argv.slice(2),root=fileURLToPath(new URL('../../',import.meta.url));
const option=(name,fallback)=>{const prefix=name+'=',value=args.find(a=>a.startsWith(prefix));if(value)return value.slice(prefix.length);const at=args.indexOf(name);return at<0?fallback:args[at+1];};
const source=option('--source'),output=option('--output'),runtime=path.resolve(option('--runtime-root',root));
assert(source&&path.isAbsolute(source),'Pass an explicit absolute QA --source.');
assert(output&&path.isAbsolute(output),'Pass an explicit absolute fresh --output directory.');
const destination=path.resolve(output);assert(destination!==root&&!destination.startsWith(root+path.sep),'Keep profile artifacts outside the repository.');
const count=Number(option('--ticks','100')),runs=Number(option('--runs','3')),profileRun=Number(option('--profile-run','0'));
const hashViews=option('--view-hashes','false')==='true';
const primeView=option('--prime-view','false')==='true';
assert(Number.isSafeInteger(count)&&count>=1&&count<=1000,'ticks must be 1..1000');assert(Number.isSafeInteger(runs)&&runs>=1&&runs<=5,'runs must be 1..5');assert(Number.isSafeInteger(profileRun)&&profileRun>=-1&&profileRun<runs,'profile-run must be -1 or an actual run index');
const hash=value=>createHash('sha256').update(value).digest('hex');
const stats=values=>{const v=values.slice().sort((a,b)=>a-b),at=q=>v[Math.floor((v.length-1)*q)]??null;return {n:v.length,p50:at(.5),p95:at(.95),max:v.at(-1)??null,total:v.reduce((a,b)=>a+b,0)};};
const bytes=await fs.readFile(source),original=JSON.parse(bytes);assert(original.state&&original.format==='pixel-sect-session','Source must be a complete QA native session.');
await fs.mkdir(path.dirname(destination),{recursive:true});await fs.mkdir(destination,{recursive:false});await fs.writeFile(path.join(destination,'source-copy.json'),bytes,{flag:'wx'});
const sim=await import(pathToFileURL(path.join(runtime,'apps/courtyard/sect-sim.mjs'))),{SECT_DOMAIN}=await import(pathToFileURL(path.join(runtime,'src/simulation/ea-sect-domain.mjs')));
const inspector=new Session(),nativeClone=globalThis.structuredClone;inspector.connect();
const post=(method,parameters={})=>new Promise((resolve,reject)=>inspector.post(method,parameters,(error,result)=>error?reject(error):resolve(result)));
const report={scope:'Node QA clone: public resume and all real 100ms world steps; complete views timed separately with native clone timing instrumentation; optional view hashes are computed after the timed view; optional initial view priming is reported separately; no Electron or progression acceptance',source:path.resolve(source),sourceSha256:hash(bytes),runtime,nodeVersion:process.version,ticksPerRun:count,profileRun,hashViews,primeView,runs:[],deterministicFinalWorlds:true};
let tracked=null,viewActive=false,cloneSamples=null;
globalThis.structuredClone=function(value,options){
 if(!viewActive)return nativeClone(value,options);
 const kind=value===tracked.provenance?'session.provenance':value===SECT_DOMAIN?'SECT_DOMAIN':value===tracked.state?'complete-world':'other',start=performance.now();
 try{return nativeClone(value,options);}finally{cloneSamples[kind].push(performance.now()-start);}
};
try{
 for(let run=0;run<runs;run++){
  const session=sim.restoreSect(JSON.parse(bytes)),resumed=sim.commandSect(session,{type:'pause',paused:false});assert.equal(resumed.ok,true,resumed.error);tracked=session;
  cloneSamples={'session.provenance':[],SECT_DOMAIN:[],'complete-world':[],other:[]};
  const initial=JSON.stringify(session.state),ticks=[];
  let primeViewMs=null;if(primeView){const start=performance.now();sim.viewSect(session);primeViewMs=performance.now()-start;assert.equal(JSON.stringify(session.state),initial,'initial read-only priming must preserve the complete world');}
  if(run===profileRun){await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');}
  for(let n=0;n<count;n++){
   const before=session.state.worldTick,start=performance.now();sim.advanceSect(session,.1);const advanced=performance.now();
   let view;viewActive=true;try{view=sim.viewSect(session);}finally{viewActive=false;}const viewed=performance.now();
   assert.equal(session.state.worldTick,before+1,'every requested step must execute one actual 100ms world tick');
   ticks.push({tick:session.state.worldTick,crossedSecond:Math.floor((before-session.state.schemaMigration.clockOriginTick)/10)!==Math.floor((session.state.worldTick-session.state.schemaMigration.clockOriginTick)/10),advanceMs:advanced-start,viewMs:viewed-advanced,combatStatus:session.state.combat?.status??null,...(hashViews?{completeViewSha256:hash(JSON.stringify(view))}:{})});
  }
  if(run===profileRun){const {profile}=await post('Profiler.stop');await fs.writeFile(path.join(destination,`world-run-${run}.cpuprofile`),JSON.stringify(profile),{flag:'wx'});await post('Profiler.disable');}
  const final=JSON.stringify(session.state),entry={run,profiled:run===profileRun,primeViewMs,initialWorldSha256:hash(initial),finalWorldSha256:hash(final),initialTick:JSON.parse(initial).worldTick,finalTick:session.state.worldTick,advanceOrdinary:stats(ticks.filter(t=>!t.crossedSecond).map(t=>t.advanceMs)),advanceSecond:stats(ticks.filter(t=>t.crossedSecond).map(t=>t.advanceMs)),view:stats(ticks.map(t=>t.viewMs)),clones:Object.fromEntries(Object.entries(cloneSamples).map(([kind,values])=>[kind,stats(values)])),ticks};
  report.runs.push(entry);assert.equal(entry.finalWorldSha256,report.runs[0].finalWorldSha256,'caches and CPU sampling must preserve every world fact across independent runs');
  await fs.writeFile(path.join(destination,`final-world-${run}.json`),final,{flag:'wx'});await fs.writeFile(path.join(destination,'report.json'),JSON.stringify(report,null,2)+'\n');
 }
 const control=sim.restoreSect(JSON.parse(bytes));assert.equal(sim.commandSect(control,{type:'pause',paused:false}).ok,true);for(let n=0;n<count;n++)sim.advanceSect(control,.1);
 report.withoutViewsWorldSha256=hash(JSON.stringify(control.state));assert.equal(report.withoutViewsWorldSha256,report.runs[0].finalWorldSha256,'adding complete read-only views must preserve every authoritative world fact');
 report.sourceUnchanged=hash(await fs.readFile(source))===report.sourceSha256;assert.equal(report.sourceUnchanged,true);report.metadataBytes={provenance:Buffer.byteLength(JSON.stringify(tracked.provenance)),domain:Buffer.byteLength(JSON.stringify(SECT_DOMAIN))};
 await fs.writeFile(path.join(destination,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({report:path.join(destination,'report.json'),sourceUnchanged:true,runs:report.runs.map(({ticks,...r})=>r)},null,2));
}finally{viewActive=false;globalThis.structuredClone=nativeClone;inspector.disconnect();}
