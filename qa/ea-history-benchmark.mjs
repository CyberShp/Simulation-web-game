/** Issue #6: real simulation steps, isolated command samples, UTF-8 save bytes.
 * Run against two runtime directories with the same fixture/options for A/B.
 * Reports/checkpoint saves belong outside the repository (see CODEX-HANDOFF).
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cpus} from 'node:os';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const runtime=resolve(option('--runtime','dist')),output=resolve(option('--output','/tmp/ea-history-benchmark'));
const hours=option('--hours','6,12,24').split(',').map(Number).sort((a,b)=>a-b);
assert.ok(hours.length&&new Set(hours).size===hours.length&&hours.every(h=>Number.isFinite(h)&&h>0&&h<=168&&Number.isSafeInteger(h*3600)),'hours must be unique, 0 < h <= 168, with whole-second boundaries');
const sim=await import(pathToFileURL(join(runtime,'ea-opening-sim.mjs')));
const fixture=option('--fixture',null),label=option('--label',fixture?'reference':'opening');
const raw=fixture?JSON.parse(readFileSync(resolve(fixture),'utf8')):sim.initial({sr:true});
let s=sim.validateSave(raw,{upgrade:true});
assert.equal(s.speed,1,'use a speed-1 fixture');
const origin=s.worldTick,samples=[],timings=[],validationRepeats=Number(option('--repeats','7'));
assert.ok(Number.isSafeInteger(validationRepeats)&&validationRepeats>0&&validationRepeats<=100,'repeats must be an integer from 1 to 100');
mkdirSync(output,{recursive:true});
const stats=values=>{const v=[...values].sort((a,b)=>a-b),percentile=q=>v[Math.floor((v.length-1)*q)]??0;return {count:v.length,mean:v.reduce((a,b)=>a+b,0)/Math.max(1,v.length),p50:percentile(.5),p95:percentile(.95),max:v.at(-1)??0};};
const measure=fn=>{const a=[];for(let i=0;i<validationRepeats;i++){const t=performance.now();fn();a.push(performance.now()-t);}return stats(a);};
function snapshot(hour){
 const json=JSON.stringify(s),restored=sim.validateSave(JSON.parse(json));
 assert.deepEqual(JSON.parse(JSON.stringify(restored)),JSON.parse(json),'exact save/restore');
 const command=measure(()=>{const r=sim.dispatchCommand(s,{name:'setSpeed',args:[s.speed]});assert.equal(r.status,'committed');assert.equal(s.transactions.nextCommandId+1,r.state.transactions.nextCommandId);});
 const entry={hour,worldTick:s.worldTick,persons:Object.keys(s.personsById).length,members:s.homeMemberIds.length,
  facts:Object.keys(s.factsById).length,factKinds:Object.values(s.factsById).reduce((m,f)=>(m[f.kind||'untyped']=(m[f.kind||'untyped']||0)+1,m),{}),
  travels:Object.keys(s.travelsById).length,saveBytes:Buffer.byteLength(json),history:s.historyRetention??null,
  tickCallMs:stats(timings),tick100msMean:stats(timings).mean/10,
  commandMs:command,validateMs:measure(()=>sim.validateSave(s)),serializeMs:measure(()=>JSON.stringify(s))};
 samples.push(entry);timings.length=0;
 writeFileSync(join(output,label+'-'+hour+'h.json'),json+'\n');
 writeFileSync(join(output,label+'-report.json'),JSON.stringify({runtime:process.version,cpu:cpus()[0]?.model,baseline:option('--commit','unspecified'),fixture:fixture??'initial({sr:true})',hours,samples,units:'tickCallMs = SIM.tick(state,1): 10 actual 100ms world steps; tick100msMean divides by 10; Node CPU only, no browser FPS'},null,2)+'\n');
 console.log(JSON.stringify(entry));
}
snapshot(0);
let next=0,lastProgress=performance.now();
let seconds=0;
while(next<hours.length){
 const t=performance.now();sim.tick(s,1);timings.push(performance.now()-t);
 assert.equal(s.worldTick-origin,++seconds*10,'every requested second executes ten real world steps');
 if(s.speed!==1||s.story?.opening?.inheritance?.status==='pending')throw Error('fixture stopped; cannot claim requested game duration');
 const elapsed=(s.worldTick-origin)/36000;
 if(elapsed>=hours[next])snapshot(hours[next++]);
 if(performance.now()-lastProgress>30000){console.error(label+': '+elapsed.toFixed(2)+' game hours');lastProgress=performance.now();}
}
