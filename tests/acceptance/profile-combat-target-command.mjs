/** Node command/view attribution for an unchanged native QA source. Native input
 * latency is a separate gate; these timings are not frame-rate measurements. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import inspector from 'node:inspector';
import {restoreSect,commandSect,createSectCommandDriver,viewSect,viewSectCombat} from '../../apps/courtyard/sect-sim.mjs';
import * as SIM from '../../src/simulation/ea-opening-sim.mjs';

const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const source=option('source'),output=option('output'),samples=Number(option('samples')||12);
assert(source&&path.isAbsolute(source));assert(output&&path.isAbsolute(output));assert(Number.isInteger(samples)&&samples>1);
await fs.mkdir(output,{recursive:false});
const bytes=await fs.readFile(source),native=JSON.parse(bytes),hash=x=>createHash('sha256').update(x).digest('hex');
const summaries={},spans=[],clone=globalThis.structuredClone,profiler=new inspector.Session();profiler.connect();
const post=(name,args={})=>new Promise((resolve,reject)=>profiler.post(name,args,(error,result)=>error?reject(error):resolve(result)));
const stats=values=>{const a=[...values].sort((a,b)=>a-b);return {n:a.length,p50:a[Math.floor((a.length-1)*.5)],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1),min:a[0]};};
const files=['apps/courtyard/sect-sim.mjs','apps/courtyard/sect-combat.mjs','src/simulation/ea-opening-sim.mjs','apps/courtyard/courtyard-main.mjs'];
const root=path.resolve(new URL('../..',import.meta.url).pathname),runtime={};
for(const file of files){const data=await fs.readFile(path.join(root,file));runtime[file]=hash(data);await fs.writeFile(path.join(output,path.basename(file)),data);}
try{
 for(const kind of ['clone-world','validate-world','full-view','battle-view','public-target','owned-target']){
  const session=restoreSect(native),driver=createSectCommandDriver(()=>session);driver.adopt();
  const targetId=session.state.combat.enemies[0].id,request={type:'combat-target',targetId};
  const run=()=>kind==='clone-world'?clone(session.state):kind==='validate-world'?SIM.validateSave(session.state):kind==='full-view'?viewSect(session):kind==='battle-view'?viewSectCombat(session):kind==='public-target'?commandSect(session,request):driver(request);
  const coldAt=performance.now();const cold=run();const coldMs=performance.now()-coldAt;if(kind.endsWith('target'))assert(cold.ok,cold.error);
  const timings=[];
  for(let index=0;index<samples;index++){
   const clones=[];globalThis.structuredClone=(value,...args)=>{const at=performance.now();try{return clone(value,...args);}finally{clones.push({kind:value?.schemaVersion===6?'world':value?.state?.schemaVersion===6?'session':'other',ms:performance.now()-at});}};
   const at=performance.now();let result;try{result=run();}finally{globalThis.structuredClone=clone;}
   const ms=performance.now()-at;if(kind.endsWith('target'))assert(result.ok,result.error);timings.push(ms);spans.push({kind,index,ms,clones});
  }
  summaries[kind]={coldMs,...stats(timings)};
  if(['owned-target','full-view'].includes(kind)){
   await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:100});await post('Profiler.start');
   for(let i=0;i<3;i++)run();const {profile}=await post('Profiler.stop');await fs.writeFile(path.join(output,kind+'.cpuprofile'),JSON.stringify(profile));
   const counts=new Map();for(let i=0;i<(profile.samples||[]).length;i++){const node=profile.nodes.find(n=>n.id===profile.samples[i]),key=`${node.callFrame.functionName||'(anonymous)'} @ ${node.callFrame.url.split('/').at(-1)}:${node.callFrame.lineNumber+1}`;counts.set(key,(counts.get(key)||0)+(profile.timeDeltas?.[i]||0));}
   summaries[kind].cpuSamplesUs=Object.fromEntries([...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30));await post('Profiler.disable');
  }
 }
 assert.equal(hash(await fs.readFile(source)),hash(bytes));
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({scope:'Node attribution only; unchanged real native source; warm samples after one labelled cold call; no FPS/native latency claim',source,sourceSha256:hash(bytes),samples,tick:native.state.worldTick,persons:Object.keys(native.state.personsById).length,runtime,summaries,spans},null,2)+'\n');
 console.log(JSON.stringify(summaries,null,2));
}finally{globalThis.structuredClone=clone;profiler.disconnect();}
